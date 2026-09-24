-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — corrige a coluna transcript pra aceitar NULL.
--
--  Ela foi criada como "not null" antes de existir o recurso de aviso
--  prévio (LGPD): quando o aviso NÃO é dito, o servidor tenta gravar
--  transcript = null de propósito (a gravação não é mantida) — e o banco
--  recusava, travando o registro em status="processing" pra sempre, sem
--  nunca virar "done" nem "error" (achado ao vivo 24/set/2026, com o
--  erro exato: "null value in column transcript ... violates not-null
--  constraint").
--
--  Rode no MESMO projeto Supabase do Uniko Call. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_call_recordings alter column transcript drop not null;
