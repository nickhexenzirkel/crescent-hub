-- Amigo Secreto 2026: uma única planilha compartilhada no Supabase principal.
-- Pré-requisito: supabase_seguranca_auth_helper.sql já executado.
-- Colaboradores autenticados podem consultar; somente administrador publica/substitui.

create table if not exists public.amigo_secreto_2026 (
  id            text primary key default '2026' check (id = '2026'),
  participantes jsonb not null default '[]'::jsonb check (jsonb_typeof(participantes) = 'array'),
  atualizado_em timestamptz not null default now()
);

alter table public.amigo_secreto_2026 enable row level security;

revoke all on public.amigo_secreto_2026 from public;
grant select, insert, update on public.amigo_secreto_2026 to anon, authenticated;

drop policy if exists amigo_secreto_2026_select on public.amigo_secreto_2026;
drop policy if exists amigo_secreto_2026_insert on public.amigo_secreto_2026;
drop policy if exists amigo_secreto_2026_update on public.amigo_secreto_2026;

create policy amigo_secreto_2026_select
  on public.amigo_secreto_2026 for select
  using (public.esta_logado());

create policy amigo_secreto_2026_insert
  on public.amigo_secreto_2026 for insert
  with check (public.current_role_uniko() = 'admin');

create policy amigo_secreto_2026_update
  on public.amigo_secreto_2026 for update
  using (public.current_role_uniko() = 'admin')
  with check (public.current_role_uniko() = 'admin');
