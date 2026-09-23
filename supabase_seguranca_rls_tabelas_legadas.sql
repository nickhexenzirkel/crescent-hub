-- ════════════════════════════════════════════════════════════════════════
--  CORREÇÃO — 8 alertas ERROR do Supabase Advisor (19/set/2026), projeto
--  PRINCIPAL (iqsufxvuufkaswellisy): "RLS Disabled in Public". São tabelas
--  ANTIGAS, de antes da convenção de 1 supabase_*.sql por feature (por isso
--  passaram batido da leva de correção de set/2026 — ver
--  supabase_seguranca_rls_dados_sensiveis.sql / _ponto.sql / _uniko_safer.sql).
--
--  Confirmei owner/uso real de cada tabela lendo o código-fonte (quem lê,
--  quem escreve, direto do cliente ou via servidor) antes de escrever as
--  políticas abaixo — ver resumo por tabela nos comentários.
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql já rodado neste
--  projeto (já está).
--
--  Rode no SQL Editor do projeto Supabase PRINCIPAL. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.comunicados    enable row level security;
alter table public.notifications  enable row level security;
alter table public.alexa_chat     enable row level security;
alter table public.banco_horas    enable row level security;
alter table public.profile_photos enable row level security;
alter table public.trophies       enable row level security;
alter table public.doko_states    enable row level security;
alter table public.playlists      enable row level security;

drop policy if exists comunicados_read   on public.comunicados;
drop policy if exists comunicados_write  on public.comunicados;
drop policy if exists notifications_read   on public.notifications;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists alexa_chat_read   on public.alexa_chat;
drop policy if exists alexa_chat_insert on public.alexa_chat;
drop policy if exists alexa_chat_delete on public.alexa_chat;
drop policy if exists banco_horas_read   on public.banco_horas;
drop policy if exists banco_horas_insert on public.banco_horas;
drop policy if exists banco_horas_update on public.banco_horas;
drop policy if exists banco_horas_delete on public.banco_horas;
drop policy if exists profile_photos_read   on public.profile_photos;
drop policy if exists profile_photos_write  on public.profile_photos;
drop policy if exists trophies_read   on public.trophies;
drop policy if exists trophies_insert on public.trophies;
drop policy if exists doko_states_read on public.doko_states;
drop policy if exists playlists_read  on public.playlists;

-- ── comunicados — mural de avisos (Mural do RH antigo). Escrita só existe
-- via crescent-hub-server (POST/DELETE admin, rota já protegida por
-- requireAdmin) usando a chave anon SEM x-ch-auth — por isso insert/update
-- ficam abertos (senão quebra o mural pro RH). Nenhum client faz
-- insert/update/delete direto; leitura passa a exigir estar logado. ──────
create policy comunicados_read on public.comunicados
  for select using (esta_logado());
create policy comunicados_write on public.comunicados
  for insert with check (true);
create policy comunicados_update on public.comunicados
  for update using (true) with check (true);

-- ── notifications — avisos/lembretes broadcast. Insert é feito DIRETO do
-- cliente por qualquer colaborador logado (TabQuizMM.jsx, lembretes do
-- App.jsx) — não é admin-only na tela, então a política também não é.
-- Nenhum update/delete usado — fica bloqueado por padrão (sem política). ─
create policy notifications_read on public.notifications
  for select using (esta_logado());
create policy notifications_insert on public.notifications
  for insert with check (esta_logado());

-- ── alexa_chat — chat compartilhado da Central Alexa (não é por usuário,
-- é uma "sala" só). Insert/select/delete (limpeza de mensagens >24h, roda
-- pra QUALQUER colaborador que abrir a tela) tudo direto do cliente, com
-- token válido. Sem update usado. ─────────────────────────────────────
create policy alexa_chat_read on public.alexa_chat
  for select using (esta_logado());
create policy alexa_chat_insert on public.alexa_chat
  for insert with check (esta_logado());
create policy alexa_chat_delete on public.alexa_chat
  for delete using (esta_logado());

-- ── banco_horas — horas extras/banco de horas, dinheiro de verdade
-- (valor_hora/valor_total). Colaborador só vê/insere/apaga o PRÓPRIO
-- (created_by = nome), sempre pendente de aprovação; só admin/moderador
-- aprova (update de status) e vê/mexe em tudo. Mesmo padrão do
-- ponto_eletronico/contracheques. ─────────────────────────────────────
create policy banco_horas_read on public.banco_horas
  for select using (is_admin_ou_moderador() or created_by = current_name());
create policy banco_horas_insert on public.banco_horas
  for insert with check (is_admin_ou_moderador() or created_by = current_name());
create policy banco_horas_update on public.banco_horas
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
create policy banco_horas_delete on public.banco_horas
  for delete using (is_admin_ou_moderador() or created_by = current_name());

-- ── profile_photos — foto de perfil. Todo colaborador logado pode VER a
-- foto de qualquer colega (aba Colegas mostra todo mundo); só pode
-- alterar/enviar a PRÓPRIA (employee_name = nome), admin pode mexer em
-- qualquer uma (moderação). ───────────────────────────────────────────
create policy profile_photos_read on public.profile_photos
  for select using (esta_logado());
create policy profile_photos_write on public.profile_photos
  for insert with check (is_admin_ou_moderador() or employee_name = current_name());
create policy profile_photos_update on public.profile_photos
  for update using (is_admin_ou_moderador() or employee_name = current_name())
  with check (is_admin_ou_moderador() or employee_name = current_name());

-- ── trophies — "troféus" que um colega dá a outro (reconhecimento). Todo
-- mundo logado vê; só pode criar um troféu EM NOME PRÓPRIO (from_name =
-- nome de quem está dando), pra não falsificar quem enviou. ───────────
create policy trophies_read on public.trophies
  for select using (esta_logado());
create policy trophies_insert on public.trophies
  for insert with check (from_name = current_name());

-- ── doko_states — estado do mascote Dodoco por colaborador. NENHUM
-- insert/update/delete encontrado em nenhum lugar do código atual (nem
-- client nem servidor) — tabela parece órfã/legada, e está vazia agora.
-- Deixei só leitura liberada pra logado; se reativarem essa feature,
-- precisa voltar aqui e adicionar as políticas de escrita certas. ─────
create policy doko_states_read on public.doko_states
  for select using (esta_logado());

-- ── playlists — SEM NENHUM USO no código-fonte atual (nem select, nem
-- insert) — parece ter sido substituída pela `playlist_library`
-- (supabase_playlist_library.sql, que já tem RLS). Deixei só leitura
-- liberada pra logado, por segurança; vale considerar DROP TABLE depois
-- de confirmar com o time que não tem nada usando. ────────────────────
create policy playlists_read on public.playlists
  for select using (esta_logado());

-- ── security_definer_view — maquina_monthly_songs / maquina_monthly_djs
-- (Central Alexa → Máquina do Tempo). Views criadas sem security_invoker
-- rodam com o privilégio de quem CRIOU a view (você, no SQL Editor), não
-- de quem consulta — ignora RLS da tabela `queue` por baixo. Consultadas
-- DIRETO do cliente (central-alexa/index.jsx, prismaMissions.js). Setar
-- security_invoker=true faz a view passar a rodar com o privilégio de
-- quem está CONSULTANDO (comportamento correto) — testei e não quebra
-- nada agora porque `queue` hoje aceita leitura mesmo só com a chave anon
-- (achado à parte, fora do escopo deste script: vale revisar o RLS de
-- `queue` depois também). ─────────────────────────────────────────────
alter view public.maquina_monthly_songs set (security_invoker = true);
alter view public.maquina_monthly_djs   set (security_invoker = true);

-- ── ROLLBACK (reverter às pressas, se algo quebrar em produção) ────────
-- Pra qualquer tabela acima, reverter ao estado sem RLS nenhum:
-- alter table public.<tabela> disable row level security;
-- Pras views:
-- alter view public.maquina_monthly_songs set (security_invoker = false);
-- alter view public.maquina_monthly_djs   set (security_invoker = false);
