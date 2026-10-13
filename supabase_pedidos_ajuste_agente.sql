-- ════════════════════════════════════════════════════════════════════════
--  PEDIDOS DE AJUSTE — campos do AGENTE autônomo (crescent-hub-server/agent/).
--  Novos estados (em_andamento, em_revisao, falhou) + link do pull request.
--  Rode no projeto Supabase PRINCIPAL, DEPOIS de supabase_pedidos_ajuste.sql.
--  Idempotente.
-- ════════════════════════════════════════════════════════════════════════
alter table public.uniko_pedidos_ajuste add column if not exists pr_url      text;
alter table public.uniko_pedidos_ajuste add column if not exists pr_number   integer;
alter table public.uniko_pedidos_ajuste add column if not exists branch      text;
alter table public.uniko_pedidos_ajuste add column if not exists agente_log  text;

alter table public.uniko_pedidos_ajuste drop constraint if exists uniko_pedidos_ajuste_status_check;
alter table public.uniko_pedidos_ajuste add constraint uniko_pedidos_ajuste_status_check
  check (status in ('pendente','em_andamento','em_revisao','feito','reaberto','descartado','falhou'));

-- Publicação automática + desfazer
alter table public.uniko_pedidos_ajuste add column if not exists auto_publicar boolean not null default false;
alter table public.uniko_pedidos_ajuste add column if not exists merge_sha     text;

-- Qual agente resolve o pedido: groq (grátis) ou openai (pago)
alter table public.uniko_pedidos_ajuste add column if not exists agente text;
