-- ════════════════════════════════════════════════════════════════════════
-- CACHE COMPARTILHADO DO ACOMPANHAMENTO DE FATURAMENTO DO GMAIL
--
-- Rode no SQL Editor do projeto Supabase PRINCIPAL do Uniko.
-- Guarda somente metadados das mensagens e a paginação do Gmail; não guarda
-- corpos completos, anexos nem tokens OAuth.
--
-- A tabela não fica acessível ao navegador (anon/authenticated). O backend
-- deverá acessá-la com a chave service_role guardada somente na VPS.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_gmail_faturamento_cache (
  id                bigint generated always as identity primary key,
  mailbox_email     varchar(320) not null,
  filter_key        varchar(128) not null,
  page_token        text not null default '',
  page_token_hash   text generated always as (md5(page_token)) stored,
  next_page_token   text not null default '',
  messages          jsonb not null default '[]'::jsonb,
  synced_at         timestamptz not null default now(),
  constraint uniko_gmail_faturamento_cache_mailbox_normalized
    check (
      mailbox_email = lower(btrim(mailbox_email))
      and position('@' in mailbox_email) > 1
    ),
  constraint uniko_gmail_faturamento_cache_filter_not_empty
    check (length(btrim(filter_key)) > 0),
  constraint uniko_gmail_faturamento_cache_page_token_size
    check (length(page_token) <= 2048 and length(next_page_token) <= 2048),
  constraint uniko_gmail_faturamento_cache_messages_array
    check (jsonb_typeof(messages) = 'array')
);

create unique index if not exists uniko_gmail_faturamento_cache_page_unique
  on public.uniko_gmail_faturamento_cache (mailbox_email, filter_key, page_token_hash);

create index if not exists uniko_gmail_faturamento_cache_synced_idx
  on public.uniko_gmail_faturamento_cache (synced_at desc);

alter table public.uniko_gmail_faturamento_cache enable row level security;

revoke all on table public.uniko_gmail_faturamento_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.uniko_gmail_faturamento_cache to service_role;
grant usage, select on sequence public.uniko_gmail_faturamento_cache_id_seq to service_role;

comment on table public.uniko_gmail_faturamento_cache is
  'Cache compartilhado entre dispositivos dos metadados de páginas da caixa Gmail institucional usada no acompanhamento de faturamento.';
comment on column public.uniko_gmail_faturamento_cache.mailbox_email is
  'Endereço Gmail normalizado em minúsculas; identifica a caixa compartilhada.';
comment on column public.uniko_gmail_faturamento_cache.filter_key is
  'Filtro exato, por exemplo month:2026-11 ou date:2026-11-01:2026-11-10.';
comment on column public.uniko_gmail_faturamento_cache.messages is
  'Array de metadados necessários ao painel; não incluir corpo completo nem dados dos anexos.';
