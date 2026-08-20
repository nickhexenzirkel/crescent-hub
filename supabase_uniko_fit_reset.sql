-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — RESET TOTAL
--  Apaga TODOS os check-ins/posts, curtidas, comentários e mensagens do
--  Bate-Papo (inclusive as notificações somem junto, já que elas são
--  calculadas em cima das curtidas/comentários — não existe tabela própria
--  de notificação). O ranking e o "Meu Perfil" voltam a ficar zerados.
--
--  ⚠️ AÇÃO IRREVERSÍVEL. Não apaga os arquivos já enviados pro Storage
--  (bucket uniko-fit-fotos) — só os REGISTROS no banco (então o feed/chat
--  ficam vazios, mas o bucket pode acumular arquivos órfãos; se quiser
--  limpar o bucket também, faça isso manualmente no painel do Supabase em
--  Storage → uniko-fit-fotos).
--
--  Rode isso no SQL Editor do Supabase SÓ quando quiser mesmo começar do
--  zero. Depois de rodar, é só recarregar o Uniko FIT no navegador.
-- ════════════════════════════════════════════════════════════════════════

truncate table
  public.uniko_fit_reactions,
  public.uniko_fit_comments,
  public.uniko_fit_chat,
  public.uniko_fit_checkins
restart identity cascade;
