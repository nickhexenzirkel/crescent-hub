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
  -- 'playtime' | 'compras' | 'colecao' | 'feedback' | 'rank_mes' | 'manual'
  metric      text    not null default 'manual',
  -- só p/ metric='playtime': 'wave' | 'speed' | 'stop' | 'paint' | 'any'
  game        text    not null default 'any',
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

create index if not exists mercado_missions_sort_idx on public.mercado_missions (sort);

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
