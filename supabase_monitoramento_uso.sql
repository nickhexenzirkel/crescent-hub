-- Monitoramento de uso do Uniko.
-- Requer supabase_seguranca_auth_helper.sql para validar os tokens ch-auth.
-- Rode no SQL Editor do projeto Supabase PRINCIPAL. Idempotente.

create table if not exists public.uniko_usage_daily (
  employee_id uuid not null,
  usage_day date not null,
  total_seconds integer not null default 0 check (total_seconds >= 0),
  module_seconds jsonb not null default '{}'::jsonb,
  theme_seconds jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (employee_id, usage_day)
);

create index if not exists uniko_usage_daily_day_employee_idx
  on public.uniko_usage_daily (usage_day, employee_id);

create table if not exists public.uniko_usage_presence (
  employee_id uuid primary key,
  module_key text not null,
  theme_key text not null,
  is_active boolean not null default false,
  last_seen_at timestamptz not null default now()
);

create index if not exists uniko_usage_presence_seen_idx
  on public.uniko_usage_presence (last_seen_at desc);

alter table public.uniko_usage_daily enable row level security;
alter table public.uniko_usage_presence enable row level security;

drop policy if exists uniko_usage_daily_admin_read on public.uniko_usage_daily;
create policy uniko_usage_daily_admin_read on public.uniko_usage_daily
  for select using ((select public.current_role_uniko()) = 'admin');

drop policy if exists uniko_usage_presence_admin_read on public.uniko_usage_presence;
create policy uniko_usage_presence_admin_read on public.uniko_usage_presence
  for select using ((select public.current_role_uniko()) = 'admin');

revoke all on public.uniko_usage_daily from anon, authenticated;
revoke all on public.uniko_usage_presence from anon, authenticated;
grant select on public.uniko_usage_daily to anon, authenticated;
grant select on public.uniko_usage_presence to anon, authenticated;

create or replace function public.record_uniko_usage_heartbeat(
  p_module text,
  p_theme text,
  p_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee_id uuid;
  v_now timestamptz := clock_timestamp();
  v_previous public.uniko_usage_presence%rowtype;
  v_found boolean := false;
  v_active boolean := coalesce(p_is_active, false);
  v_delta integer := 0;
  v_gap integer := 0;
  v_module text := p_module;
  v_theme text := p_theme;
  v_day date;
begin
  v_employee_id := public.current_employee_id();
  if v_employee_id is null or public.current_name() is null then
    raise exception 'É necessário estar autenticado para registrar o uso.'
      using errcode = '42501';
  end if;

  if v_module is null or v_module not in (
    'modules', 'colaborador', 'ponto', 'dashboard', 'alexa', 'faturamento',
    'conexao-setorial', 'info-adicional', 'uniko-safer', 'uniko-security',
    '7-beneficios', 'mercado-estelar', 'uniko-fit', 'uniko-call',
    'prestacao-contas'
  ) then
    raise exception 'Módulo inválido para monitoramento.' using errcode = '22023';
  end if;

  if v_theme is null or v_theme !~ '^[A-Za-z0-9_-]{1,40}$' then
    raise exception 'Tema inválido para monitoramento.' using errcode = '22023';
  end if;

  select * into v_previous
  from public.uniko_usage_presence
  where employee_id = v_employee_id
  for update;
  v_found := found;

  if v_found and v_previous.is_active then
    v_gap := floor(extract(epoch from (v_now - v_previous.last_seen_at)))::integer;
    if v_gap between 1 and 35 then v_delta := v_gap; end if;
  end if;

  if v_delta > 0 then
    v_day := (v_previous.last_seen_at at time zone 'UTC')::date;
    insert into public.uniko_usage_daily (
      employee_id, usage_day, total_seconds, module_seconds, theme_seconds, updated_at
    ) values (
      v_employee_id,
      v_day,
      v_delta,
      jsonb_build_object(
        coalesce(v_previous.module_key, v_module),
        v_delta
      ),
      jsonb_build_object(
        coalesce(v_previous.theme_key, v_theme),
        v_delta
      ),
      v_now
    )
    on conflict (employee_id, usage_day) do update set
      total_seconds = uniko_usage_daily.total_seconds + excluded.total_seconds,
      module_seconds = uniko_usage_daily.module_seconds || jsonb_build_object(
        coalesce(v_previous.module_key, v_module),
        coalesce((uniko_usage_daily.module_seconds ->> coalesce(v_previous.module_key, v_module))::integer, 0) + v_delta
      ),
      theme_seconds = uniko_usage_daily.theme_seconds || jsonb_build_object(
        coalesce(v_previous.theme_key, v_theme),
        coalesce((uniko_usage_daily.theme_seconds ->> coalesce(v_previous.theme_key, v_theme))::integer, 0) + v_delta
      ),
      updated_at = v_now;
  end if;

  insert into public.uniko_usage_presence (
    employee_id, module_key, theme_key, is_active, last_seen_at
  ) values (v_employee_id, v_module, v_theme, v_active, v_now)
  on conflict (employee_id) do update set
    module_key = excluded.module_key,
    theme_key = excluded.theme_key,
    is_active = excluded.is_active,
    last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.record_uniko_usage_heartbeat(text, text, boolean) from public;
grant execute on function public.record_uniko_usage_heartbeat(text, text, boolean) to anon, authenticated;
