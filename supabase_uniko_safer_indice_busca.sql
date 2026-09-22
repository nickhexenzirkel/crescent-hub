-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SAFER — garante o índice de busca por texto em uniko_safer_messages.
--
--  Confirmado ao vivo: a busca global de mensagens (ILIKE '%termo%') estava
--  dando "canceling statement due to statement timeout" (código 57014) —
--  sinal de que está fazendo uma varredura completa da tabela, sem usar
--  índice nenhum. Provavelmente porque supabase_uniko_safer.sql foi rodado
--  ANTES da linha do índice trigram ter sido adicionada a esse arquivo, ou
--  a extensão nunca foi ativada nesse projeto.
--
--  Rode no SQL Editor do projeto Supabase DEDICADO do Uniko Safer. É só
--  isso duas linhas, idempotente, seguro rodar de novo a qualquer momento
--  (NÃO mexe em nenhuma política de RLS).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;
create index if not exists uniko_safer_messages_text_trgm_idx on public.uniko_safer_messages using gin (text gin_trgm_ops);
