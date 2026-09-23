-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SAFER — garante os índices da busca global de mensagens.
--
--  Confirmado ao vivo: a busca global de mensagens (ILIKE '%termo%' ORDER BY
--  sent_at DESC LIMIT 80, sem filtrar por contato) estava dando "canceling
--  statement due to statement timeout" (código 57014).
--
--  1ª rodada (índice trigram) não foi suficiente sozinha: o único índice que
--  toca sent_at é o composto (contact_id, sent_at) — inútil pra ordenar por
--  data numa busca que não fixa um contato. Mesmo achando as linhas que batem
--  com o texto rápido via trigram, o Postgres ainda precisa juntar TODAS elas
--  (anos de histórico) antes de ordenar por data e pegar só as 80 mais
--  recentes — e isso sozinho já estoura o tempo limite.
--
--  O índice novo (sent_at desc) resolve isso de verdade: dá pro Postgres
--  escanear a partir da mensagem mais recente pra mais antiga e ir parando
--  assim que achar 80 que batem no texto, sem nunca precisar tocar no
--  histórico velho (plano "Limit + Index Scan Backward + Filter").
--
--  Rode no SQL Editor do projeto Supabase DEDICADO do Uniko Safer.
--  Idempotente, seguro rodar de novo a qualquer momento (NÃO mexe em
--  nenhuma política de RLS). Criar o índice pode demorar um pouco com a
--  tabela grande — normal.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;
create index if not exists uniko_safer_messages_text_trgm_idx on public.uniko_safer_messages using gin (text gin_trgm_ops);
create index if not exists uniko_safer_messages_sent_at_idx on public.uniko_safer_messages (sent_at desc);
