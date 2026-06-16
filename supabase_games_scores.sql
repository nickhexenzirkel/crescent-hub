-- Ranking geral da aba Games — guarda a MAIOR pontuação (recorde) de cada
-- jogador EM CADA jogo arcade (run / meteor / invaders / flap). O total do
-- ranking é a soma de PONTOS NORMALIZADOS calculada no app (cada jogo é
-- convertido para uma escala comum para nenhum dominar). Rode no SQL Editor.

create table if not exists public.games_scores (
  player      text not null,
  game        text not null,          -- run | meteor | invaders | flap
  score       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (player, game)
);

-- índice para varrer o ranking por jogo/pontuação rapidamente
create index if not exists games_scores_game_score_idx on public.games_scores (game, score desc);

alter table public.games_scores enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura e gravação pública).
drop policy if exists games_scores_read   on public.games_scores;
drop policy if exists games_scores_insert on public.games_scores;
drop policy if exists games_scores_update on public.games_scores;

create policy games_scores_read   on public.games_scores for select using (true);
create policy games_scores_insert on public.games_scores for insert with check (true);
create policy games_scores_update on public.games_scores for update using (true) with check (true);
