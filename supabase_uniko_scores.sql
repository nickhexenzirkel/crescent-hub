-- Ranking global do Uniko Wave — guarda a MAIOR pontuação de cada jogador
-- e em qual música ela foi feita. Rode no SQL Editor do Supabase.

create table if not exists public.uniko_scores (
  player      text primary key,
  score       integer not null default 0,
  song        text,
  grade       text,
  difficulty  text,
  video_id    text,
  updated_at  timestamptz not null default now()
);

-- índice para ordenar o ranking por pontuação rapidamente
create index if not exists uniko_scores_score_idx on public.uniko_scores (score desc);

alter table public.uniko_scores enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura e gravação pública).
drop policy if exists uniko_scores_read   on public.uniko_scores;
drop policy if exists uniko_scores_insert on public.uniko_scores;
drop policy if exists uniko_scores_update on public.uniko_scores;

create policy uniko_scores_read   on public.uniko_scores for select using (true);
create policy uniko_scores_insert on public.uniko_scores for insert with check (true);
create policy uniko_scores_update on public.uniko_scores for update using (true) with check (true);
