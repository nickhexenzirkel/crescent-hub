-- Padrões compartilhados de notificações do Uniko.
-- Execute no Supabase principal. A autorização de escrita usa o papel do JWT
-- próprio validado por public.current_role_uniko().

create table if not exists public.notification_defaults (
  id smallint primary key check (id = 1),
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.notification_defaults enable row level security;

drop policy if exists notification_defaults_read on public.notification_defaults;
create policy notification_defaults_read
  on public.notification_defaults for select
  using (true);

drop policy if exists notification_defaults_insert_admin on public.notification_defaults;
create policy notification_defaults_insert_admin
  on public.notification_defaults for insert
  with check (public.current_role_uniko() = 'admin');

drop policy if exists notification_defaults_update_admin on public.notification_defaults;
create policy notification_defaults_update_admin
  on public.notification_defaults for update
  using (public.current_role_uniko() = 'admin')
  with check (public.current_role_uniko() = 'admin');

grant select, insert, update on public.notification_defaults to anon, authenticated;

alter table public.notification_defaults replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_defaults'
  ) then
    alter publication supabase_realtime add table public.notification_defaults;
  end if;
end $$;
