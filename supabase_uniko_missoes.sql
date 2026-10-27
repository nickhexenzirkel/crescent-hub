-- ═══════════════════════════════════════════════════════════════════════════
-- MISSÕES GERENCIÁVEIS (Prisma Store) + TEMPO JOGADO POR JOGO
--
-- Duas mudanças que andam juntas:
--
--  1) uniko_playtime ganha a coluna `game`. Antes a tabela só media o Uniko
--     Wave (a chave era player+dia), então não havia onde guardar os minutos
--     do Speed / Stop / Paint. Agora a chave é player+dia+jogo e cada jogo
--     acumula o seu próprio total. As linhas que já existem são do Wave —
--     por isso o default 'wave' (nada de histórico se perde).
--
--  2) mercado_missions guarda a DEFINIÇÃO das missões (título, descrição,
--     meta, recompensa, período). Antes isso era uma constante no código
--     (PRISMA_MISSIONS), ou seja: mudar o valor de uma missão exigia deploy.
--     Com a tabela, o admin cria/edita/remove pela aba Administrador →
--     Missões, e o cálculo do progresso é escolhido pelo campo `metric`.
--
-- O progresso e o resgate de cada pessoa continuam onde sempre estiveram
-- (mercado_state.data.missions) — esta tabela é só a definição, global.
--
-- Rode no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1) TEMPO JOGADO POR JOGO
-- ─────────────────────────────────────────────────────────────────────────
alter table public.uniko_playtime
  add column if not exists game text not null default 'wave';

-- Troca a PK (player, day) por (player, day, game). O nome da constraint que
-- o Postgres gera pra PK é sempre "<tabela>_pkey".
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.uniko_playtime'::regclass and contype = 'p'
      and array_length(conkey, 1) = 2
  ) then
    alter table public.uniko_playtime drop constraint uniko_playtime_pkey;
    alter table public.uniko_playtime add primary key (player, day, game);
  end if;
end $$;

create index if not exists uniko_playtime_player_day_game_idx
  on public.uniko_playtime (player, day, game);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) DEFINIÇÃO DAS MISSÕES (gerenciada pelo admin)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.mercado_missions (
  id          text primary key,
  title       text    not null,
  descr       text    not null default '',
  -- 'dia' | 'mes' | 'unica' — quando o resgate reinicia
  period      text    not null default 'dia',
  -- COMO o progresso é medido (ver MISSION_METRICS em src/shared/prismaMissions.js):
  -- 'playtime' | 'game_wins' | 'compras' | 'colecao' | 'feedback' | 'rank_mes' | 'manual'
  metric      text    not null default 'manual',
  -- só p/ metric='playtime': 'wave' | 'speed' | 'stop' | 'paint' | 'palavras' | 'any'
  game        text    not null default 'any',
  -- jogos somados em missões de playtime; vazio mantém compatibilidade com `game`
  games       text[]  not null default '{}',
  -- parâmetro extra da métrica (metric='rank_mes' → posição: 1, 2 ou 3)
  param       integer not null default 0,
  -- meta (playtime = MINUTOS; o resto = quantidade)
  goal        integer not null default 1,
  comum       integer not null default 0,   -- recompensa em Prisma Comum
  premium     integer not null default 0,   -- recompensa em Prisma Premium
  maintenance boolean not null default false, -- aparece cinza, "🔧 Em manutenção"
  active      boolean not null default true,  -- false = some da lista dos colaboradores
  sort        integer not null default 0,     -- ordem na aba Missões
  updated_at  timestamptz not null default now()
);

alter table public.mercado_missions
  add column if not exists games text[] not null default '{}';

update public.mercado_missions
set games = case when game = 'any' then array['any']::text[] else array[game]::text[] end
where cardinality(games) = 0;

create index if not exists mercado_missions_sort_idx on public.mercado_missions (sort);

-- Migra a antiga missão de crédito automático do Palavras para a missão
-- configurável de resgate manual. Se houver várias, preserva a primeira e
-- desativa as demais sem apagar as definições/recompensas existentes.
do $$
declare
  v_mission_id text;
begin
  select id into v_mission_id
  from public.mercado_missions
  where metric = 'vitoria_palavras'
  order by sort, id
  limit 1;

  if v_mission_id is not null and not exists (
    select 1 from public.mercado_missions where metric = 'game_wins'
  ) then
    update public.mercado_missions
    set title = 'Vitórias Uniko Games',
        descr = 'Ganhe partidas elegíveis para resgatar até 3 bônus por dia',
        period = 'dia',
        metric = 'game_wins',
        game = 'any',
        games = array['any']::text[],
        param = 0,
        goal = 3,
        updated_at = now()
    where id = v_mission_id;
  end if;

  update public.mercado_missions
  set metric = 'manual',
      active = false,
      maintenance = true,
      updated_at = now()
  where metric = 'vitoria_palavras';
end $$;

insert into public.mercado_missions
  (id, title, descr, period, metric, game, games, param, goal, comum, premium, maintenance, active, sort)
select
  'c_game_wins',
  'Vitórias Uniko Games',
  'Ganhe partidas elegíveis para resgatar até 3 bônus por dia',
  'dia',
  'game_wins',
  'any',
  array['any']::text[],
  0,
  3,
  0,
  0,
  false,
  false,
  coalesce((select max(sort) + 1 from public.mercado_missions), 11)
where not exists (select 1 from public.mercado_missions where metric = 'game_wins')
on conflict (id) do nothing;

create unique index if not exists mercado_missions_one_game_wins_idx
  on public.mercado_missions (metric)
  where metric = 'game_wins';

alter table public.mercado_missions enable row level security;

-- App usa a chave anônima → políticas permissivas (mesmo padrão de mercado_items).
drop policy if exists mercado_missions_read   on public.mercado_missions;
drop policy if exists mercado_missions_insert on public.mercado_missions;
drop policy if exists mercado_missions_update on public.mercado_missions;
drop policy if exists mercado_missions_delete on public.mercado_missions;

create policy mercado_missions_read   on public.mercado_missions for select using (true);
create policy mercado_missions_insert on public.mercado_missions for insert with check (true);
create policy mercado_missions_update on public.mercado_missions for update using (true) with check (true);
create policy mercado_missions_delete on public.mercado_missions for delete using (true);

-- Semente com as missões que hoje estão fixas no código. O app também semeia
-- sozinho na primeira vez que abre a Prisma Store com a tabela vazia — rodar
-- aqui só adianta o passo. `on conflict do nothing` = não sobrescreve o que o
-- admin já tiver ajustado.
insert into public.mercado_missions (id, title, descr, period, metric, game, param, goal, comum, premium, maintenance, sort) values
  ('c_uniko20',       'Maratona Uniko Wave',   'Jogue 20 minutos no Uniko Wave',                            'dia',   'playtime', 'wave', 0, 20, 100,   0, false,  0),
  ('c_uniko40',       'Maratona Uniko Wave',   'Jogue 40 minutos no Uniko Wave',                            'dia',   'playtime', 'wave', 0, 40,   0,  10, false,  1),
  ('c_feedback',      'Voz ativa',             'Dê um feedback no sistema',                                 'mes',   'feedback', 'any',  0,  1,   0,  30, false,  2),
  ('c_rank1',         '🥇 Top 1 do mês',        '1º lugar de quem mais colocou música no mês passado',        'mes',   'rank_mes', 'any',  1,  1,   0, 100, false,  3),
  ('c_rank2',         '🥈 Top 2 do mês',        '2º lugar de quem mais colocou música no mês passado',        'mes',   'rank_mes', 'any',  2,  1,   0,  70, false,  4),
  ('c_rank3',         '🥉 Top 3 do mês',        '3º lugar de quem mais colocou música no mês passado',        'mes',   'rank_mes', 'any',  3,  1,   0,  50, false,  5),
  ('c_setor',         'Setor nota 90+',        'Seu setor passou de 90% no chatbot do mês',                 'mes',   'manual',   'any',  0,  1, 500,   0, true,   6),
  ('c_firstbuy',      'Primeira compra',       'Faça sua primeira compra na Prisma Store',                  'unica', 'compras',  'any',  0,  1, 200,   0, false,  7),
  ('c_secondbuy',     'Segunda compra',        'Faça sua segunda compra na Prisma Store',                   'unica', 'compras',  'any',  0,  2, 400,   0, false,  8),
  ('c_colec_pequeno', 'Pequeno Colecionador',  'Tenha 10 Unikos na sua Coleção',                            'unica', 'colecao',  'any',  0, 10,   0,  50, false,  9),
  ('c_colec_grande',  'Grande Colecionador',   'Tenha mais de 20 Unikos na sua Coleção',                    'unica', 'colecao',  'any',  0, 21,   0,  50, false, 10)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) VITÓRIAS UNIKO GAMES: registro pendente + resgate atômico
-- ─────────────────────────────────────────────────────────────────────────
create unique index if not exists mercado_history_uniko_game_claim_once_idx
  on public.mercado_history (player, descr)
  where kind = 'uniko_game_win_claim';

-- Registra uma vitória só se a missão estiver ativa. O ID de partida é a chave
-- idempotente; placar/quantidade de prêmio são lidos da definição da missão.
create or replace function public.mercado_record_uniko_game_win(
  p_match_id uuid,
  p_player text,
  p_game text
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_comum integer;
  v_premium integer;
  v_player text;
begin
  if p_match_id is null or nullif(trim(p_player), '') is null or p_game is null
     or p_game not in ('palavras', 'stop', 'paint', 'speed') then
    raise exception 'Dados inválidos para registrar a vitória.';
  end if;

  perform pg_advisory_xact_lock(hashtext(trim(p_player)));

  select player into v_player
  from public.mercado_history
  where id = p_match_id and kind = 'uniko_game_win';
  if found then
    return v_player = trim(p_player);
  end if;

  select comum, premium into v_comum, v_premium
  from public.mercado_missions
  where metric = 'game_wins' and period = 'dia' and active and not maintenance
  limit 1;
  if not found or (coalesce(v_comum, 0) <= 0 and coalesce(v_premium, 0) <= 0) then
    return false;
  end if;

  insert into public.mercado_history (id, player, kind, descr, comum, premium)
  values (
    p_match_id,
    trim(p_player),
    'uniko_game_win',
    'Vitória Uniko Games · ' || p_game,
    v_comum,
    v_premium
  );
  return true;
end;
$$;

-- O marcador de resgate e o crédito acontecem na mesma transação. Assim, cliques
-- repetidos/retries não duplicam o saldo e uma falha não deixa a vitória presa.
create or replace function public.mercado_claim_uniko_game_win(
  p_player text,
  p_win_id uuid
)
returns table (comum integer, premium integer)
language plpgsql
set search_path = public
as $$
declare
  v_comum integer;
  v_premium integer;
  v_start timestamptz;
  v_claim_id uuid;
  v_descr text := 'Vitória: ' || p_win_id::text;
  v_claimed integer;
begin
  if nullif(trim(p_player), '') is null or p_win_id is null then
    raise exception 'Dados inválidos para resgatar a vitória.';
  end if;

  perform pg_advisory_xact_lock(hashtext(trim(p_player)));

  select h.comum, h.premium into v_comum, v_premium
  from public.mercado_history h
  where h.player = trim(p_player)
    and h.kind = 'uniko_game_win_claim'
    and h.descr = v_descr;
  if found then
    return query select coalesce(v_comum, 0), coalesce(v_premium, 0);
    return;
  end if;

  select h.comum, h.premium into v_comum, v_premium
  from public.mercado_history h
  where h.id = p_win_id
    and h.player = trim(p_player)
    and h.kind = 'uniko_game_win';
  if not found then
    raise exception 'Esta vitória não está disponível para resgate.';
  end if;

  v_start := date_trunc('day', now() at time zone 'America/Fortaleza')
    at time zone 'America/Fortaleza';
  select count(*) into v_claimed
  from public.mercado_history h
  where h.player = trim(p_player)
    and h.kind = 'uniko_game_win_claim'
    and h.created_at >= v_start;
  if v_claimed >= 3 then
    raise exception 'Você já resgatou o limite de 3 vitórias de hoje.';
  end if;

  insert into public.mercado_history (player, kind, descr, comum, premium)
  values (trim(p_player), 'uniko_game_win_claim', v_descr, v_comum, v_premium)
  on conflict (player, descr) where kind = 'uniko_game_win_claim' do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    select h.comum, h.premium into v_comum, v_premium
    from public.mercado_history h
    where h.player = trim(p_player)
      and h.kind = 'uniko_game_win_claim'
      and h.descr = v_descr;
    return query select coalesce(v_comum, 0), coalesce(v_premium, 0);
    return;
  end if;

  perform public.mercado_credit(trim(p_player), coalesce(v_comum, 0), coalesce(v_premium, 0));
  return query select coalesce(v_comum, 0), coalesce(v_premium, 0);
end;
$$;

grant execute on function public.mercado_record_uniko_game_win(uuid, text, text)
  to anon, authenticated;
grant execute on function public.mercado_claim_uniko_game_win(text, uuid)
  to anon, authenticated;
