-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — "Meu Peso": registros de peso e meta, PRIVADOS por pessoa.
--  Cada pessoa só enxerga e altera as próprias linhas (player = nome do
--  token, via current_name() do supabase_seguranca_auth_helper.sql — rode
--  aquele script antes, se ainda não rodou neste projeto).
--  Ver src/modules/uniko-fit/index.jsx (carregarPeso / registrarPeso).
--
--  Rode no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_peso (
  player     text         not null,
  data       date         not null,
  peso       numeric(5,1) not null check (peso between 20 and 400),
  created_at timestamptz  not null default now(),
  primary key (player, data)
);

create table if not exists public.uniko_fit_peso_meta (
  player     text primary key,
  meta       numeric(5,1) not null check (meta between 20 and 400),
  updated_at timestamptz  not null default now()
);

alter table public.uniko_fit_peso enable row level security;
alter table public.uniko_fit_peso_meta enable row level security;

drop policy if exists "uniko_fit_peso select" on public.uniko_fit_peso;
drop policy if exists "uniko_fit_peso insert" on public.uniko_fit_peso;
drop policy if exists "uniko_fit_peso update" on public.uniko_fit_peso;
drop policy if exists "uniko_fit_peso delete" on public.uniko_fit_peso;
create policy "uniko_fit_peso select" on public.uniko_fit_peso for select using (player = public.current_name());
create policy "uniko_fit_peso insert" on public.uniko_fit_peso for insert with check (player = public.current_name());
create policy "uniko_fit_peso update" on public.uniko_fit_peso for update using (player = public.current_name()) with check (player = public.current_name());
create policy "uniko_fit_peso delete" on public.uniko_fit_peso for delete using (player = public.current_name());

drop policy if exists "uniko_fit_peso_meta select" on public.uniko_fit_peso_meta;
drop policy if exists "uniko_fit_peso_meta insert" on public.uniko_fit_peso_meta;
drop policy if exists "uniko_fit_peso_meta update" on public.uniko_fit_peso_meta;
drop policy if exists "uniko_fit_peso_meta delete" on public.uniko_fit_peso_meta;
create policy "uniko_fit_peso_meta select" on public.uniko_fit_peso_meta for select using (player = public.current_name());
create policy "uniko_fit_peso_meta insert" on public.uniko_fit_peso_meta for insert with check (player = public.current_name());
create policy "uniko_fit_peso_meta update" on public.uniko_fit_peso_meta for update using (player = public.current_name()) with check (player = public.current_name());
create policy "uniko_fit_peso_meta delete" on public.uniko_fit_peso_meta for delete using (player = public.current_name());
