-- ════════════════════════════════════════════════════════════════════════
--  CORREÇÃO — Uniko Safer passa a exigir admin/moderador de verdade (via
--  jwt_claims(), ver supabase_seguranca_auth_helper.sql) em vez da política
--  antiga `using (true)` que liberava geral pra quem tivesse a chave anon.
--
--  Pré-requisito: rode supabase_seguranca_auth_helper.sql NESTE MESMO
--  projeto (o dedicado do Safer) antes deste script, com o segredo real já
--  colado. Sem isso, jwt_claims() sempre devolve NULL e ninguém — nem admin
--  — vai conseguir acessar (falha fechada, não aberta: se algo estiver
--  errado, o pior caso é o módulo parecer vazio, nunca expor dados).
--
--  CAUSA RAIZ ACHADA AO VIVO (22/09/2026) — `is_admin_ou_moderador()` chamada
--  direto (sem "select") na política deixava a busca global de mensagens
--  (ILIKE, ~59 mil linhas) em ~4.5s e estourando o statement_timeout via API.
--  Confirmado com EXPLAIN ANALYZE simulando o papel `anon` de verdade: o
--  Postgres faz Seq Scan na tabela INTEIRA, sem usar nenhum índice, porque
--  RLS não deixa misturar livremente a condição da política com uma
--  condição "suja" do usuário (ILIKE não é leakproof) — as duas acabam
--  avaliadas juntas, linha por linha, recalculando o HMAC de jwt_claims()
--  ~59 mil vezes. Envolver a chamada em `(select ...)` é o padrão oficial
--  do Postgres/Supabase pra isso: vira um plano inicial calculado UMA VEZ
--  (cacheado), não mais por linha — mesmo debaixo de RLS.
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists uniko_safer_contacts_all on public.uniko_safer_contacts;
drop policy if exists uniko_safer_exports_all  on public.uniko_safer_exports;
drop policy if exists uniko_safer_messages_all on public.uniko_safer_messages;

create policy uniko_safer_contacts_all on public.uniko_safer_contacts
  for all using ((select is_admin_ou_moderador())) with check ((select is_admin_ou_moderador()));

create policy uniko_safer_exports_all on public.uniko_safer_exports
  for all using ((select is_admin_ou_moderador())) with check ((select is_admin_ou_moderador()));

create policy uniko_safer_messages_all on public.uniko_safer_messages
  for all using ((select is_admin_ou_moderador())) with check ((select is_admin_ou_moderador()));

-- ── Bucket de arquivos originais (.zip/.txt importados) ──────────────────
-- Estava marcado `public = true`, o que faz o Supabase servir qualquer
-- arquivo por URL direta (/object/public/...) SEM checar política nenhuma
-- de storage.objects — a política abaixo só vale pra quem usa a API de
-- Storage (list/upload/remove), não pra essa rota pública. O código do
-- Safer (index.jsx) só usa list/upload/remove, nunca URL pública — então
-- fechar isso não muda nada visível no app.
update storage.buckets set public = false where id = 'uniko-safer';

drop policy if exists "uniko safer arquivos read"   on storage.objects;
drop policy if exists "uniko safer arquivos insert" on storage.objects;
drop policy if exists "uniko safer arquivos delete" on storage.objects;

create policy "uniko safer arquivos read" on storage.objects
  for select using (bucket_id = 'uniko-safer' and (select is_admin_ou_moderador()));

create policy "uniko safer arquivos insert" on storage.objects
  for insert with check (bucket_id = 'uniko-safer' and (select is_admin_ou_moderador()));

create policy "uniko safer arquivos delete" on storage.objects
  for delete using (bucket_id = 'uniko-safer' and (select is_admin_ou_moderador()));

-- ── ROLLBACK (só se precisar reverter em produção às pressas) ───────────
-- drop policy uniko_safer_contacts_all on public.uniko_safer_contacts;
-- create policy uniko_safer_contacts_all on public.uniko_safer_contacts for all using (true) with check (true);
-- (repita para exports/messages e volte storage.buckets.public para true se necessário)
