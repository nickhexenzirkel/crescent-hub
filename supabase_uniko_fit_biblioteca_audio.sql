-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — biblioteca de áudio (ago/2026): todo áudio que alguém usa
--  como música de um post (upload próprio OU extraído de um vídeo — ver
--  MusicPicker em src/modules/uniko-fit/index.jsx) entra aqui, pra
--  qualquer outra pessoa reaproveitar depois sem subir o arquivo de novo.
--  `duration` guarda a duração TOTAL do áudio enviado (não o recorte usado
--  num post específico — isso continua só em uniko_fit_checkins.music_*).
--  Reusa o bucket 'uniko-fit-fotos' (já público, já criado em
--  supabase_uniko_fit.sql) — os arquivos entram sob o prefixo
--  "<cpf>/biblioteca-<timestamp>.<ext>".
--
--  Rode este script no SQL Editor do Supabase. É idempotente. Precisa ter
--  rodado supabase_uniko_fit.sql (bucket) e supabase_uniko_fit_musica.sql
--  (colunas music_* em uniko_fit_checkins) antes.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_audios (
  id          bigint generated always as identity primary key,
  title       text not null,
  url         text not null,
  duration    numeric,
  player      text not null,
  origem      text not null default 'audio', -- 'audio' (upload direto) | 'video' (extraído de um vídeo)
  created_at  timestamptz not null default now()
);
create index if not exists uniko_fit_audios_created_idx on public.uniko_fit_audios (created_at desc);

alter table public.uniko_fit_audios enable row level security;
drop policy if exists uniko_fit_audios_read   on public.uniko_fit_audios;
drop policy if exists uniko_fit_audios_insert on public.uniko_fit_audios;
create policy uniko_fit_audios_read   on public.uniko_fit_audios for select using (true);
create policy uniko_fit_audios_insert on public.uniko_fit_audios for insert with check (true);
