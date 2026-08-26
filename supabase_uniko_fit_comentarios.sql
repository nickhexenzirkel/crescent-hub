-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — RESPOSTAS E FOTO NOS COMENTÁRIOS
--  Dá duas coisas ao drawer de comentários do feed:
--    • `parent_id` → responder um comentário (thread de 1 nível, estilo
--      Instagram: a resposta de uma resposta continua pendurada no
--      comentário raiz, então nunca vira escada infinita).
--    • `media_url` → comentar (ou responder) com uma FOTO. O arquivo vai
--      pro mesmo bucket `uniko-fit-fotos` já usado pelo feed/chat, na
--      pasta `<cpf>/comentarios/`.
--  `texto` deixa de ser obrigatório: comentário só de foto manda texto vazio.
--  Ver src/modules/uniko-fit/index.jsx (drawer "Comentários").
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_fit_comments
  add column if not exists parent_id bigint references public.uniko_fit_comments(id) on delete cascade;
alter table public.uniko_fit_comments
  add column if not exists media_url text;
-- comentário só com foto não tem texto
alter table public.uniko_fit_comments alter column texto drop not null;

-- Busca das respostas de um comentário (e das notificações "responderam você")
create index if not exists uniko_fit_comments_parent_idx
  on public.uniko_fit_comments (parent_id, created_at);
