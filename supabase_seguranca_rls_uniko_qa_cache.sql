-- ════════════════════════════════════════════════════════════════════════
--  CORREÇÃO — alerta CRÍTICO do Supabase (19/set/2026): uniko_qa_cache
--  (cache/aprendizado do Assistente UNIKO) era a ÚNICA tabela do projeto
--  PRINCIPAL sem RLS habilitado. Qualquer um com a chave anon (pública no
--  JS do site) podia ler/inserir/editar/APAGAR qualquer linha direto pela
--  API REST, sem passar pelo app — inclusive marcar in_faq=true numa
--  resposta forjada, o que faria essa resposta aparecer como "oficial" pro
--  Assistente UNIKO de TODO MUNDO (ver UnikoAssistant.jsx, que carrega tudo
--  com in_faq=true e usa como resposta prioritária).
--
--  Diferente das outras tabelas (supabase_seguranca_rls_*.sql), o SERVIDOR
--  (crescent-hub-server/index.js) escreve nessa tabela com a chave anon
--  pura, sem mandar o header x-ch-auth — então SELECT/INSERT/UPDATE
--  continuam abertos aqui (igual ao comportamento de hoje, zero risco de
--  regressão no cache automático). O que fecha o risco de verdade é travar
--  o DELETE — só é chamado mesmo pela aba admin do Dashboard RH
--  (UnikoQATab.jsx).
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql já rodado neste
--  projeto (principal) — já está, é o mesmo usado pras outras tabelas.
--
--  Rode no SQL Editor do projeto Supabase PRINCIPAL (iqsufxvuufkaswellisy).
--  É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_qa_cache enable row level security;

drop policy if exists uniko_qa_cache_read   on public.uniko_qa_cache;
drop policy if exists uniko_qa_cache_insert on public.uniko_qa_cache;
drop policy if exists uniko_qa_cache_update on public.uniko_qa_cache;
drop policy if exists uniko_qa_cache_delete on public.uniko_qa_cache;

-- Leitura e escrita (insert/update) continuam abertas — é o que já acontece
-- hoje sem RLS nenhum, e o servidor (chave anon, sem x-ch-auth) depende
-- disso pro cache de perguntas/hits funcionar.
create policy uniko_qa_cache_read on public.uniko_qa_cache
  for select using (true);

create policy uniko_qa_cache_insert on public.uniko_qa_cache
  for insert with check (true);

create policy uniko_qa_cache_update on public.uniko_qa_cache
  for update using (true) with check (true);

-- Só isso muda de verdade: apagar linha só admin/moderador (só a tela do
-- RH chama delete nessa tabela).
create policy uniko_qa_cache_delete on public.uniko_qa_cache
  for delete using (is_admin_ou_moderador());

-- ── ROLLBACK (reverter às pressas, se algo quebrar em produção) ────────
-- drop policy uniko_qa_cache_delete on public.uniko_qa_cache;
-- create policy uniko_qa_cache_delete on public.uniko_qa_cache for delete using (true);
-- (ou, pra voltar exatamente ao estado sem RLS nenhum:)
-- alter table public.uniko_qa_cache disable row level security;
