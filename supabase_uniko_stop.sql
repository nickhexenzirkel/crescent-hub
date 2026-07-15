-- ═══════════════════════════════════════════════════════════════════════════
-- UNIKO STOP! — Stop/Adedonha online (estilo stopots). Rode no SQL Editor.
--
-- Mesma arquitetura do Uniko Paint (supabase_uniko_paint.sql), que já está
-- rodando: uma linha por SALA, o `id` é o código dela, e só o ESTADO DA PARTIDA
-- mora aqui. O que é efêmero (o que cada um está digitando, o STOP, os votos)
-- trafega por Realtime broadcast e nunca toca no banco.
--
-- A sala 'global' é a "Sala Geral": fixa, sempre no lobby, nunca apagada.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_stop_state (
  id          text primary key,              -- 'global' ou código da sala
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists uniko_stop_state_updated_idx
  on public.uniko_stop_state (updated_at desc);

-- Sala Geral
insert into public.uniko_stop_state (id, state)
values ('global', '{"phase":"lobby","round":0,"scores":{},"nome":"Sala Geral"}'::jsonb)
on conflict (id) do nothing;

alter table public.uniko_stop_state enable row level security;

-- App usa a chave anônima → políticas permissivas, igual ao resto do projeto.
drop policy if exists uniko_stop_state_read   on public.uniko_stop_state;
drop policy if exists uniko_stop_state_insert on public.uniko_stop_state;
drop policy if exists uniko_stop_state_update on public.uniko_stop_state;
drop policy if exists uniko_stop_state_delete on public.uniko_stop_state;

create policy uniko_stop_state_read   on public.uniko_stop_state for select using (true);
create policy uniko_stop_state_insert on public.uniko_stop_state for insert with check (true);
create policy uniko_stop_state_update on public.uniko_stop_state for update using (true) with check (true);
create policy uniko_stop_state_delete on public.uniko_stop_state for delete using (true);

-- Realtime: o app escuta postgres_changes pra sincronizar a partida.
do $$
begin
  alter publication supabase_realtime add table public.uniko_stop_state;
exception
  when duplicate_object then null;
  when others then null;
end $$;

-- ── Ranking geral (mesma ideia do Uniko Paint) ────────────────────────────
create table if not exists public.uniko_stop_ranking (
  player      text primary key,
  pontos      integer not null default 0,
  partidas    integer not null default 0,
  vitorias    integer not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists uniko_stop_ranking_pontos_idx
  on public.uniko_stop_ranking (pontos desc);

alter table public.uniko_stop_ranking enable row level security;

drop policy if exists uniko_stop_ranking_read   on public.uniko_stop_ranking;
drop policy if exists uniko_stop_ranking_insert on public.uniko_stop_ranking;
drop policy if exists uniko_stop_ranking_update on public.uniko_stop_ranking;

create policy uniko_stop_ranking_read   on public.uniko_stop_ranking for select using (true);
create policy uniko_stop_ranking_insert on public.uniko_stop_ranking for insert with check (true);
create policy uniko_stop_ranking_update on public.uniko_stop_ranking for update using (true) with check (true);

-- Soma atômica (duas salas terminando juntas não se sobrescrevem).
create or replace function public.uniko_stop_add_score(
  p_player text, p_pontos integer, p_venceu boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uniko_stop_ranking (player, pontos, partidas, vitorias, updated_at)
  values (p_player, greatest(p_pontos, 0), 1, case when p_venceu then 1 else 0 end, now())
  on conflict (player) do update set
    pontos     = public.uniko_stop_ranking.pontos   + greatest(excluded.pontos, 0),
    partidas   = public.uniko_stop_ranking.partidas + 1,
    vitorias   = public.uniko_stop_ranking.vitorias + excluded.vitorias,
    updated_at = now();
$$;

grant execute on function public.uniko_stop_add_score(text, integer, boolean) to anon, authenticated;
