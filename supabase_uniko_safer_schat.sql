-- Uniko Safer — armazenamento separado para backups do SCHAT.
-- Rodar no projeto Supabase dedicado do Uniko Safer, após
-- supabase_seguranca_auth_helper.sql. Idempotente.

create extension if not exists pg_trgm;

create table if not exists public.uniko_safer_schat_threads (
  id              bigint generated always as identity primary key,
  sector          text not null default 'geral' check (sector in ('geral', 'faturamento', 'financeiro', 'suporte_tecnico', 'suporte_contratual')),
  contact         text not null,
  contact_name    text,
  contact_name_at timestamptz,
  channel         text not null default 'geral',
  last_message_at timestamptz not null,
  created_at      timestamptz not null default now(),
  unique (sector, contact, channel)
);

alter table public.uniko_safer_schat_threads alter column sector set default 'geral';
alter table public.uniko_safer_schat_threads alter column channel set default 'geral';
alter table public.uniko_safer_schat_threads add column if not exists contact_name text;
alter table public.uniko_safer_schat_threads add column if not exists contact_name_at timestamptz;
alter table public.uniko_safer_schat_threads drop constraint if exists uniko_safer_schat_threads_sector_check;
alter table public.uniko_safer_schat_threads add constraint uniko_safer_schat_threads_sector_check
  check (sector in ('geral', 'faturamento', 'financeiro', 'suporte_tecnico', 'suporte_contratual'));

create index if not exists uniko_safer_schat_threads_sector_recent_idx
  on public.uniko_safer_schat_threads (sector, last_message_at desc);

create table if not exists public.uniko_safer_schat_messages (
  id           bigint generated always as identity primary key,
  thread_id    bigint not null references public.uniko_safer_schat_threads(id) on delete cascade,
  protocol     text not null,
  sender       text not null,
  message      text not null,
  sent_at      timestamptz not null,
  message_hash text not null,
  created_at   timestamptz not null default now(),
  unique (thread_id, message_hash)
);

create index if not exists uniko_safer_schat_messages_thread_idx
  on public.uniko_safer_schat_messages (thread_id, sent_at, id);

create index if not exists uniko_safer_schat_messages_sent_at_idx
  on public.uniko_safer_schat_messages (sent_at desc);

create index if not exists uniko_safer_schat_messages_text_trgm_idx
  on public.uniko_safer_schat_messages using gin (message gin_trgm_ops);

alter table public.uniko_safer_schat_threads enable row level security;
alter table public.uniko_safer_schat_messages enable row level security;

drop policy if exists uniko_safer_schat_threads_read on public.uniko_safer_schat_threads;
drop policy if exists uniko_safer_schat_threads_admin_write on public.uniko_safer_schat_threads;
drop policy if exists uniko_safer_schat_messages_read on public.uniko_safer_schat_messages;
drop policy if exists uniko_safer_schat_messages_admin_write on public.uniko_safer_schat_messages;

create policy uniko_safer_schat_threads_read on public.uniko_safer_schat_threads
  for select using ((select is_admin_ou_moderador()));

create policy uniko_safer_schat_threads_admin_write on public.uniko_safer_schat_threads
  for all using ((select current_role_uniko()) = 'admin')
  with check ((select current_role_uniko()) = 'admin');

create policy uniko_safer_schat_messages_read on public.uniko_safer_schat_messages
  for select using ((select is_admin_ou_moderador()));

create policy uniko_safer_schat_messages_admin_write on public.uniko_safer_schat_messages
  for all using ((select current_role_uniko()) = 'admin')
  with check ((select current_role_uniko()) = 'admin');
