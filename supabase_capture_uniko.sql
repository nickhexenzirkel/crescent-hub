-- "Capture o Uniko" — coleção de Unikos capturados pelos colaboradores no Portal.
-- A CONFIG do evento (ativo? janela de início/fim? qual Uniko?) NÃO mora aqui: fica na
-- tabela `settings` já existente, na chave 'capture_uniko_config' (valor JSON), gravada
-- pelo Dashboard RH. Esta tabela guarda só o histórico/coleção de quem capturou.
-- Rode no SQL Editor do Supabase.

create table if not exists public.capture_uniko_captures (
  id          bigint generated always as identity primary key,
  player      text not null,
  uniko_id    text not null,            -- ex.: vampire-robot
  uniko_name  text,
  captured_at timestamptz not null default now()
);

-- varrer a coleção de um jogador rapidamente
create index if not exists capture_uniko_player_idx on public.capture_uniko_captures (player, captured_at desc);

alter table public.capture_uniko_captures enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura/inserção/remoção públicas).
-- A REMOÇÃO é necessária pro "Resetar coleção" do Dashboard RH funcionar.
drop policy if exists capture_uniko_read   on public.capture_uniko_captures;
drop policy if exists capture_uniko_insert on public.capture_uniko_captures;
drop policy if exists capture_uniko_delete on public.capture_uniko_captures;

create policy capture_uniko_read   on public.capture_uniko_captures for select using (true);
create policy capture_uniko_insert on public.capture_uniko_captures for insert with check (true);
create policy capture_uniko_delete on public.capture_uniko_captures for delete using (true);

-- ── Lock GLOBAL do evento: SÓ UM colaborador captura por evento ──────────────
-- event_id é a chave primária → o 1º insert vence; os demais recebem conflito
-- (23505) e o app mostra "já capturado por X".
create table if not exists public.capture_uniko_event (
  event_id    text primary key,
  player      text not null,
  uniko_id    text,
  uniko_name  text,
  comum       integer not null default 0,
  premium     integer not null default 0,
  captured_at timestamptz not null default now()
);

alter table public.capture_uniko_event enable row level security;

drop policy if exists capture_event_read   on public.capture_uniko_event;
drop policy if exists capture_event_insert on public.capture_uniko_event;
drop policy if exists capture_event_delete on public.capture_uniko_event;

create policy capture_event_read   on public.capture_uniko_event for select using (true);
create policy capture_event_insert on public.capture_uniko_event for insert with check (true);
create policy capture_event_delete on public.capture_uniko_event for delete using (true);
