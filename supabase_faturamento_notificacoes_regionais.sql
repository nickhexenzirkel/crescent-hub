-- Notificações individuais para faturamentos por regional.
-- Rode no SQL Editor do projeto Supabase PRINCIPAL do Uniko.
-- Requer supabase_seguranca_auth_helper.sql e a tabela public.notifications.
-- Idempotente; notificações antigas (recipient_id nulo) continuam como broadcast.

alter table public.notifications
  add column if not exists recipient_id uuid,
  add column if not exists source_id text;

create unique index if not exists notifications_source_recipient_unique
  on public.notifications (source_id, recipient_id);

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (
    esta_logado()
    and (recipient_id is null or recipient_id = current_employee_id())
  );

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (
    esta_logado()
    and (recipient_id is null or current_role_uniko() = 'admin')
  );

comment on column public.notifications.recipient_id is
  'ID do funcionário destinatário; nulo mantém o comportamento de broadcast.';
comment on column public.notifications.source_id is
  'Identificador único da origem da notificação, usado para evitar duplicidade.';
