-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — chamadas do WhatsApp Web gravadas (extensão Cat-Bot) e
--  transcritas (Groq Whisper). Mesmo espírito visual do Uniko Security:
--  lista de "contatos" (aqui, por NOME — a UI de chamada do WhatsApp Web
--  não expõe o número de telefone), cada um com um histórico de chamadas
--  já transcritas.
--
--  Rode no MESMO projeto Supabase do Uniko Safer/Security (decisão
--  deliberada — reaproveita jwt_claims()/is_admin_ou_moderador() já
--  configurados ali). Admin-only, mesma política do Security.
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_call_contacts (
  id           bigint generated always as identity primary key,
  name         text not null,
  name_manual  boolean not null default false,
  notes        text,
  last_call_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists uniko_call_contacts_name_idx on public.uniko_call_contacts (lower(name));

create table if not exists public.uniko_call_recordings (
  id          bigint generated always as identity primary key,
  contact_id  bigint not null references public.uniko_call_contacts(id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  transcript  text not null default '',
  status      text not null default 'processing' check (status in ('processing','done','error')),
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists uniko_call_recordings_contact_idx on public.uniko_call_recordings (contact_id, started_at);

alter table public.uniko_call_contacts   enable row level security;
alter table public.uniko_call_recordings enable row level security;

drop policy if exists uniko_call_contacts_all   on public.uniko_call_contacts;
drop policy if exists uniko_call_recordings_all on public.uniko_call_recordings;

-- Só admin de verdade (nem moderador), mesmo critério do Uniko Security —
-- gravação de ligação é dado sensível. Os INSERTS do webhook (servidor, via
-- service_role) não passam por aqui, bypassam RLS por design.
create policy uniko_call_contacts_all on public.uniko_call_contacts
  for all using ((select current_role_uniko()) = 'admin') with check ((select current_role_uniko()) = 'admin');

create policy uniko_call_recordings_all on public.uniko_call_recordings
  for all using ((select current_role_uniko()) = 'admin') with check ((select current_role_uniko()) = 'admin');
