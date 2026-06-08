-- Ranking por dificuldade: a chave passa a ser (player, difficulty),
-- guardando a MAIOR pontuação de cada jogador EM CADA dificuldade.
-- Rode no SQL Editor do Supabase DEPOIS do supabase_uniko_scores.sql.

-- garante difficulty preenchida e obrigatória
alter table public.uniko_scores alter column difficulty set default 'normal';
update public.uniko_scores set difficulty = 'normal' where difficulty is null or difficulty = '';
alter table public.uniko_scores alter column difficulty set not null;

-- troca a primary key de (player) para (player, difficulty)
alter table public.uniko_scores drop constraint if exists uniko_scores_pkey;
alter table public.uniko_scores add constraint uniko_scores_pkey primary key (player, difficulty);
