-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SAFER — data/hora da última mensagem de cada contato, pra ordenar
--  a barra lateral estilo WhatsApp (mais recente primeiro), atualizando
--  sozinha a cada importação/sincronização.
--  Ver src/modules/uniko-safer/index.jsx.
--
--  Rode no SQL Editor do projeto Supabase DEDICADO do Uniko Safer. É
--  idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_safer_contacts add column if not exists last_message_at timestamptz;
create index if not exists uniko_safer_contacts_last_message_idx on public.uniko_safer_contacts (last_message_at desc nulls last);
