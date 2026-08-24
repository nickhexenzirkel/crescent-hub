-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — post com VÁRIAS fotos/vídeos (carrossel, estilo Instagram):
--  a pessoa escolhe várias mídias de uma vez e quem vê arrasta pro lado.
--
--  `photo_url` CONTINUA sendo a capa (1ª mídia) de propósito: todo o resto do
--  app já lê essa coluna (miniaturas do Meu Perfil/Amigos, resultados da
--  busca, aviso de check-in no Bate-Papo, notificações). Assim nada disso
--  precisou mudar e posts antigos seguem funcionando sem migração de dados.
--  `media_urls` guarda a lista COMPLETA (incluindo a capa, na posição 0);
--  quando é null ou tem 1 item só, o feed renderiza igual a antes.
--  Ver src/modules/uniko-fit/index.jsx (FeedCarrossel / postarFoto).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_fit_checkins
  add column if not exists media_urls jsonb;

comment on column public.uniko_fit_checkins.media_urls is
  'Lista de URLs do carrossel (a capa em photo_url é o item 0). Null/1 item = post de mídia única.';
