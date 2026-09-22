-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SAFER — expande o log de acesso (supabase_seguranca_log_acesso_safer.sql)
--  pra um registro de auditoria completo: visualizar, editar, excluir e
--  importar (sincronizar) conversa — não só "quem abriu qual conversa".
--
--  Pré-requisito: supabase_seguranca_log_acesso_safer.sql já rodado neste
--  projeto (cria a tabela uniko_safer_access_log).
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_safer_access_log add column if not exists action text not null default 'view';
alter table public.uniko_safer_access_log add column if not exists details text;

alter table public.uniko_safer_access_log drop constraint if exists uniko_safer_access_log_action_check;
alter table public.uniko_safer_access_log add constraint uniko_safer_access_log_action_check
  check (action in ('view','edit','delete','import'));

create index if not exists uniko_safer_access_log_action_idx on public.uniko_safer_access_log (action, viewed_at desc);

-- Tela de auditoria é só pro ADMINISTRADOR (pedido explícito do usuário —
-- diferente do resto do módulo, que é admin+moderador). Moderador continua
-- gerando entradas no log (ver policy de insert, que não muda), só não lê
-- de volta.
drop policy if exists uniko_safer_access_log_select on public.uniko_safer_access_log;
create policy uniko_safer_access_log_select on public.uniko_safer_access_log
  for select using (current_role_uniko() = 'admin');
