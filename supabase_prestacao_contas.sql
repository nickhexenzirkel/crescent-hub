-- ════════════════════════════════════════════════════════════════════════
--  PRESTAÇÕES DE CONTAS — gastos necessários feitos pela empresa pros
--  COMERCIAIS (comprovante, valor, motivo, descrição). O colaborador lança e
--  vê só os próprios; Administrador/Moderador veem tudo (Dashboard RH → aba
--  "Prestações de Contas"). Ver src/modules/prestacao-contas.
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql já rodado
--  (usa is_admin_ou_moderador() e current_cpf()).
--  Rode no SQL Editor do Supabase principal. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.prestacoes_contas (
  id             uuid primary key default gen_random_uuid(),
  employee_id    text not null,            -- id do funcionário (JWT authUser.id)
  employee_cpf   text,                     -- CPF cru (11 dígitos) de quem lançou
  employee_name  text,
  categoria      text not null default 'Outros',
  motivo         text not null,
  descricao      text,
  valor          numeric(12,2) not null check (valor >= 0),
  data_gasto     date not null default current_date,
  anexos         jsonb not null default '[]'::jsonb,  -- [{name,path,type,size}] no bucket prestacao-anexos
  created_at     timestamptz not null default now()
);
create index if not exists prestacoes_contas_emp_idx  on public.prestacoes_contas (employee_id, data_gasto desc);
create index if not exists prestacoes_contas_data_idx on public.prestacoes_contas (data_gasto desc);

alter table public.prestacoes_contas enable row level security;
drop policy if exists prestacoes_read   on public.prestacoes_contas;
drop policy if exists prestacoes_insert on public.prestacoes_contas;
drop policy if exists prestacoes_update on public.prestacoes_contas;
drop policy if exists prestacoes_delete on public.prestacoes_contas;
create policy prestacoes_read   on public.prestacoes_contas for select using (is_admin_ou_moderador() or employee_cpf = current_cpf());
create policy prestacoes_insert on public.prestacoes_contas for insert with check (is_admin_ou_moderador() or employee_cpf = current_cpf());
create policy prestacoes_update on public.prestacoes_contas for update using (is_admin_ou_moderador() or employee_cpf = current_cpf()) with check (is_admin_ou_moderador() or employee_cpf = current_cpf());
create policy prestacoes_delete on public.prestacoes_contas for delete using (is_admin_ou_moderador() or employee_cpf = current_cpf());

-- Bucket PRIVADO dos comprovantes (acesso por URL assinada de curta duração).
insert into storage.buckets (id, name, public) values ('prestacao-anexos', 'prestacao-anexos', false)
  on conflict (id) do nothing;
drop policy if exists "prestacao anexos read"   on storage.objects;
drop policy if exists "prestacao anexos insert" on storage.objects;
drop policy if exists "prestacao anexos delete" on storage.objects;
create policy "prestacao anexos read"   on storage.objects for select using (bucket_id = 'prestacao-anexos');
create policy "prestacao anexos insert" on storage.objects for insert with check (bucket_id = 'prestacao-anexos');
create policy "prestacao anexos delete" on storage.objects for delete using (bucket_id = 'prestacao-anexos');
