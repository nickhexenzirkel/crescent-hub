-- ════════════════════════════════════════════════════════════════════════
--  RESTAURA o comportamento antigo do Supabase: tabela NOVA já fica exposta
--  pra Data API automaticamente (SELECT/INSERT/UPDATE/DELETE pra
--  anon/authenticated/service_role), sem precisar de GRANT manual depois de
--  cada CREATE TABLE.
--
--  Motivo: a partir de 30/out/2026 a Supabase muda esse padrão em TODOS os
--  projetos existentes — dali pra frente, tabela criada sem GRANT explícito
--  fica invisível pra API (mesmo com RLS certo). Não é retroativo — tabela
--  que já existe não é afetada. Isso aqui evita que esse dia quebre
--  silenciosamente o próximo módulo novo.
--
--  Segurança continua garantida pelo RLS de cada tabela (já é o padrão
--  usado em todo supabase_*.sql deste projeto) — esse script só reabre a
--  EXPOSIÇÃO à API, não abre acesso a dado nenhum sozinho.
--
--  Rode em CADA projeto Supabase que você usa (principal, Safer/Security/
--  Call, 7 Benefícios, e qualquer outro que vier depois). É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
