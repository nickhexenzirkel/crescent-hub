-- ═══════════════════════════════════════════════════════════════════════════
-- UNIKO PAINT — ranking geral (rode DEPOIS de supabase_uniko_paint.sql).
--
-- Acumula os pontos de TODAS as partidas por jogador. O placar da sala vive no
-- estado da partida e some quando ela acaba; isto é o histórico que sobrevive.
--
-- Por que uma RPC e não um update direto: somar exige ler-antes-de-escrever, e
-- duas partidas terminando ao mesmo tempo (salas diferentes) se sobrescreveriam.
-- O `on conflict do update` soma no PRÓPRIO banco, numa operação atômica.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_paint_ranking (
  player      text primary key,
  pontos      integer not null default 0,   -- soma de todas as partidas
  partidas    integer not null default 0,
  vitorias    integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- o lobby lista por pontos desc
create index if not exists uniko_paint_ranking_pontos_idx
  on public.uniko_paint_ranking (pontos desc);

alter table public.uniko_paint_ranking enable row level security;

-- App usa a chave anônima → políticas permissivas, igual ao resto do projeto.
drop policy if exists uniko_paint_ranking_read   on public.uniko_paint_ranking;
drop policy if exists uniko_paint_ranking_insert on public.uniko_paint_ranking;
drop policy if exists uniko_paint_ranking_update on public.uniko_paint_ranking;

create policy uniko_paint_ranking_read   on public.uniko_paint_ranking for select using (true);
create policy uniko_paint_ranking_insert on public.uniko_paint_ranking for insert with check (true);
create policy uniko_paint_ranking_update on public.uniko_paint_ranking for update using (true) with check (true);

-- Soma os pontos de uma partida ao ranking do jogador (atômico).
create or replace function public.uniko_paint_add_score(
  p_player text, p_pontos integer, p_venceu boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.uniko_paint_ranking (player, pontos, partidas, vitorias, updated_at)
  values (p_player, greatest(p_pontos, 0), 1, case when p_venceu then 1 else 0 end, now())
  on conflict (player) do update set
    pontos     = public.uniko_paint_ranking.pontos   + greatest(excluded.pontos, 0),
    partidas   = public.uniko_paint_ranking.partidas + 1,
    vitorias   = public.uniko_paint_ranking.vitorias + excluded.vitorias,
    updated_at = now();
$$;

grant execute on function public.uniko_paint_add_score(text, integer, boolean) to anon, authenticated;

-- ADMIN: zerar o ranking (rode manualmente quando quiser recomeçar)
--   truncate table public.uniko_paint_ranking;
