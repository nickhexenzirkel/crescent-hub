-- ════════════════════════════════════════════════════════════════════════
--  PEDIDOS DE AJUSTE — fila de pequenas mudanças no Uniko (interface, textos,
--  etc.) que o admin descreve no Dashboard RH e o Claude Code resolve depois
--  (comando /pedidos). Sem API paga: a "IA" é o próprio Claude Code.
--  Rode no projeto Supabase PRINCIPAL. Idempotente.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.uniko_pedidos_ajuste (
  id          bigint generated always as identity primary key,
  titulo      text not null,
  descricao   text,
  area        text,                                   -- tela/módulo afetado (texto livre)
  status      text not null default 'pendente' check (status in ('pendente','feito','reaberto','descartado')),
  nota_ia     text,                                   -- o que foi feito (preenchido pelo Claude Code)
  comentario  text,                                   -- o que o dono achou, ao reabrir
  autor       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists uniko_pedidos_ajuste_status_idx on public.uniko_pedidos_ajuste (status, created_at desc);

alter table public.uniko_pedidos_ajuste enable row level security;
drop policy if exists uniko_pedidos_ajuste_all on public.uniko_pedidos_ajuste;
create policy uniko_pedidos_ajuste_all on public.uniko_pedidos_ajuste for all using (true) with check (true);
