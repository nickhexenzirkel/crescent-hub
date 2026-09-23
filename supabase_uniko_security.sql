-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SECURITY — mesma ideia do Uniko Safer (organizador de conversas do
--  WhatsApp, admin-only), mas alimentado pela WhatsApp Cloud API oficial
--  (modo Coexistence) em vez do robô Playwright no WhatsApp Web. O servidor
--  (crescent-hub-server/whatsappCloudApi.js) recebe um webhook da Meta a
--  cada mensagem nova e grava direto aqui — não existe "importação manual"
--  nem robô de navegador neste módulo.
--
--  Roda no MESMO projeto Supabase dedicado do Uniko Safer (decisão
--  deliberada — reaproveita jwt_claims()/is_admin_ou_moderador() já
--  configurados ali, ver supabase_seguranca_auth_helper.sql). Segurança
--  aqui é MAIS estrita que o Safer: só ADMIN de verdade, nem moderador
--  (pedido explícito do usuário) — usa current_role_uniko() = 'admin'
--  direto, não is_admin_ou_moderador().
--
--  Índices de busca (trigram + sent_at) já entram certos desde o início —
--  lição aprendida ao vivo com o Safer (ver supabase_uniko_safer_indice_busca.sql
--  e supabase_seguranca_rls_uniko_safer.sql): sem eles E sem a política
--  envolvida em (select ...), a busca global de mensagens estoura o
--  statement_timeout assim que a tabela cresce.
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── Contatos (populados automaticamente pelo webhook — não há cadastro
--    manual "criar contato", só edição de nome/notas/etiquetas depois que
--    ele aparece sozinho na primeira mensagem recebida) ────────────────────
create table if not exists public.uniko_security_contacts (
  id              bigint generated always as identity primary key,
  wa_id           text not null unique,   -- número no formato da Cloud API (ex: 5511999999999, sem "+")
  name            text not null,          -- nome de perfil do WhatsApp, ou renomeado manualmente
  name_manual     boolean not null default false, -- true = admin já renomeou; webhook para de sobrescrever com o nome de perfil
  notes           text,
  tag_ids         bigint[] not null default '{}',
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists uniko_security_contacts_wa_id_idx  on public.uniko_security_contacts (wa_id);
create index if not exists uniko_security_contacts_tag_ids_idx on public.uniko_security_contacts using gin (tag_ids);

-- ── Mensagens ──────────────────────────────────────────────────────────
create table if not exists public.uniko_security_messages (
  id            bigint generated always as identity primary key,
  contact_id    bigint not null references public.uniko_security_contacts(id) on delete cascade,
  wa_message_id text unique,  -- id que a Meta dá pra mensagem — evita duplicar se o webhook reentregar
  sent_at       timestamptz not null,
  direction     text not null check (direction in ('in','out')), -- 'in' = contato mandou, 'out' = a empresa mandou (Coexistence ecoa os dois lados)
  sender_name   text,        -- nome de quem mandou (perfil do contato, ou null pra 'out')
  text          text not null,
  msg_type      text not null default 'text', -- text, image, audio, video, document, sticker, location, other...
  created_at    timestamptz not null default now()
);
create index if not exists uniko_security_messages_contact_idx  on public.uniko_security_messages (contact_id, sent_at);
-- Sozinho o índice de trigram NÃO basta pra "ORDER BY sent_at DESC LIMIT N"
-- sem contato fixo — precisa dos dois (ver supabase_seguranca_rls_uniko_safer.sql).
create index if not exists uniko_security_messages_sent_at_idx on public.uniko_security_messages (sent_at desc);
create extension if not exists pg_trgm;
create index if not exists uniko_security_messages_text_trgm_idx on public.uniko_security_messages using gin (text gin_trgm_ops);

-- ── Etiquetas personalizadas (mesmo padrão do Safer) ──────────────────────
create table if not exists public.uniko_security_tags (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  color      text not null default '#d4a017',
  created_at timestamptz not null default now()
);

-- ── Log de auditoria (mesmo padrão do Safer) ──────────────────────────────
create table if not exists public.uniko_security_access_log (
  id           bigint generated always as identity primary key,
  contact_id   bigint references public.uniko_security_contacts(id) on delete set null,
  contact_name text,
  viewer_name  text,
  viewer_role  text,
  action       text not null default 'view' check (action in ('view','edit','delete')),
  details      text,
  viewed_at    timestamptz not null default now()
);
create index if not exists uniko_security_access_log_contact_idx on public.uniko_security_access_log (contact_id, viewed_at desc);
create index if not exists uniko_security_access_log_viewed_idx  on public.uniko_security_access_log (viewed_at desc);
create index if not exists uniko_security_access_log_action_idx  on public.uniko_security_access_log (action, viewed_at desc);

-- ── Log cru de todo webhook recebido (dead-letter/depuração) ──────────────
-- Guarda o payload EXATO que a Meta mandou, antes de qualquer parsing — se o
-- formato de algum tipo de mensagem vier diferente do esperado (bem provável
-- na primeira integração de verdade, mesmo padrão de hoje com o WhatsApp
-- Web), dá pra olhar aqui o que chegou de fato e ajustar o parser sem
-- precisar reproduzir o problema ao vivo. Sem RLS de leitura pelo cliente
-- (só o backend, com a service role, escreve e lê isso via SQL Editor).
create table if not exists public.uniko_security_webhook_raw (
  id          bigint generated always as identity primary key,
  payload     jsonb not null,
  processed   boolean not null default false,
  error       text,
  received_at timestamptz not null default now()
);
create index if not exists uniko_security_webhook_raw_received_idx on public.uniko_security_webhook_raw (received_at desc);

alter table public.uniko_security_contacts    enable row level security;
alter table public.uniko_security_messages    enable row level security;
alter table public.uniko_security_tags        enable row level security;
alter table public.uniko_security_access_log  enable row level security;
alter table public.uniko_security_webhook_raw enable row level security;

drop policy if exists uniko_security_contacts_all on public.uniko_security_contacts;
drop policy if exists uniko_security_messages_all on public.uniko_security_messages;
drop policy if exists uniko_security_tags_all     on public.uniko_security_tags;

-- Só admin de verdade (nem moderador) via API normal (anon + x-ch-auth) —
-- é o que o módulo React usa pra ler/editar/marcar etiqueta/excluir.
-- Os INSERTS de mensagem/contato vindos do webhook NÃO passam por aqui:
-- o backend usa a service_role key (bypassa RLS por design), porque um
-- webhook da Meta não carrega token de nenhum usuário logado.
create policy uniko_security_contacts_all on public.uniko_security_contacts
  for all using ((select current_role_uniko()) = 'admin') with check ((select current_role_uniko()) = 'admin');

create policy uniko_security_messages_all on public.uniko_security_messages
  for all using ((select current_role_uniko()) = 'admin') with check ((select current_role_uniko()) = 'admin');

create policy uniko_security_tags_all on public.uniko_security_tags
  for all using ((select current_role_uniko()) = 'admin') with check ((select current_role_uniko()) = 'admin');

drop policy if exists uniko_security_access_log_insert on public.uniko_security_access_log;
drop policy if exists uniko_security_access_log_select on public.uniko_security_access_log;
create policy uniko_security_access_log_insert on public.uniko_security_access_log
  for insert with check ((select current_role_uniko()) = 'admin');
create policy uniko_security_access_log_select on public.uniko_security_access_log
  for select using ((select current_role_uniko()) = 'admin');

-- webhook_raw: nenhuma política pra anon/authenticated — só a service_role
-- (que bypassa RLS) e o próprio dono do projeto (SQL Editor) enxergam.
