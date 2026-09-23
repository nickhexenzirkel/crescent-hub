-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SECURITY — setores (mesmo padrão do Uniko Safer: uma coluna
--  `category` no contato, abas na tela). Diferença importante em relação
--  ao Safer: aqui cada setor é um NÚMERO/conexão Dualhook diferente (Cloud
--  API de verdade), não uma sessão WhatsApp Web — o servidor decide o
--  setor pelo `phone_number_id` que vem em cada webhook (ver
--  UNIKO_SECURITY_SECTORS em whatsappCloudApi.js).
--
--  wa_id deixa de ser único GLOBALMENTE — passa a ser único POR SETOR,
--  porque a mesma pessoa pode escrever tanto pro WhatsApp do Faturamento
--  quanto pro do Financeiro, e isso são conversas/contatos DIFERENTES.
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer/Security. É
--  idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_security_contacts add column if not exists category text not null default 'faturamento';
create index if not exists uniko_security_contacts_category_idx on public.uniko_security_contacts (category);

-- Troca a constraint de único-global (wa_id) por único-por-setor (wa_id, category).
alter table public.uniko_security_contacts drop constraint if exists uniko_security_contacts_wa_id_key;
create unique index if not exists uniko_security_contacts_wa_id_category_uidx
  on public.uniko_security_contacts (wa_id, category);
