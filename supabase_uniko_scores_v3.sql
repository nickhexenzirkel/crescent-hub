-- Mostra o NICK escolhido no jogo + ícone (avatar) e borda no ranking.
-- Rode no SQL Editor do Supabase DEPOIS dos scripts v1 e v2.

alter table public.uniko_scores add column if not exists nick   text;
alter table public.uniko_scores add column if not exists avatar text;  -- avatarId do personagem (ex: dodoco)
alter table public.uniko_scores add column if not exists border text;  -- borderId (ex: svg_nexus)
