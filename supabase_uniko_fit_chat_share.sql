-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — compartilhar um post do "Para Você" no Bate-Papo. A mensagem
--  guarda o id do check-in original (`shared_checkin_id`) pra, ao tocar
--  nela no chat, levar a pessoa direto pro post (mesmo mecanismo de
--  `irParaFeed` já usado no Meu Perfil/Amigos).
--  Ver src/modules/uniko-fit/index.jsx (tipo 'compartilhado' no chat).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_fit_chat
  add column if not exists shared_checkin_id bigint references public.uniko_fit_checkins(id) on delete set null;
