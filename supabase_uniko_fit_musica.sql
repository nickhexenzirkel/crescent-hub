-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — música no post (estilo TikTok): a pessoa escolhe uma música
--  do Spotify e um trechinho dela pra tocar junto com a foto/vídeo no feed
--  "Para Você". Guarda só o CLIPE de prévia do Spotify (~30s, `preview_url`
--  vindo de /api/search no crescent-hub-server) + o recorte {início,duração}
--  escolhido — nunca a faixa inteira.
--  Ver src/modules/uniko-fit/index.jsx (MusicPicker / FeedMusic).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_fit_checkins
  add column if not exists music_url text,
  add column if not exists music_title text,
  add column if not exists music_artist text,
  add column if not exists music_start numeric,
  add column if not exists music_duration numeric;
