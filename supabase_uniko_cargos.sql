-- ════════════════════════════════════════════════════════════════════════
--  CARGOS — permissão de acesso a módulo por cargo, camada ADICIONAL por
--  cima do admin/moderador já existente (que continuam vendo tudo, sem
--  nenhuma mudança). Cada cargo lista os módulos liberados; um colaborador
--  pode ter vários cargos ao mesmo tempo — o acesso dele é a UNIÃO dos
--  módulos de todos os cargos atribuídos. Gerenciado em Dashboard RH →
--  Gerenciar Permissões (só admin de verdade vê essa aba) — ver
--  src/modules/dashboard-rh/GerenciarPermissoesTab.jsx e
--  src/shared/cargoPermissions.js.
--
--  Rode este script no SQL Editor do Supabase (projeto principal do Uniko —
--  é dado de permissão do sistema, não tem nada a ver com o projeto
--  dedicado do Uniko Safer). É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_cargos (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  module_ids jsonb not null default '[]'::jsonb,  -- ex: ["dashboard","ponto","uniko-safer"]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vínculo cargo↔colaborador, pelo `id` (uuid) da tabela `employees` — NÃO
-- pelo CPF: a API /api/employees devolve o CPF MASCARADO (maskCpf, ver
-- crescent-hub-server/index.js:873), então nunca bateria com o CPF de
-- verdade que vem no token de login (authUser.cpf). O `id` não é mascarado
-- e já vem no JWT (authUser.id) — chave segura pra isso.
create table if not exists public.uniko_cargo_membros (
  id          bigint generated always as identity primary key,
  cargo_id    bigint not null references public.uniko_cargos(id) on delete cascade,
  employee_id uuid not null,
  created_at  timestamptz not null default now(),
  unique (cargo_id, employee_id)
);
create index if not exists uniko_cargo_membros_employee_idx on public.uniko_cargo_membros (employee_id);

alter table public.uniko_cargos enable row level security;
alter table public.uniko_cargo_membros enable row level security;

drop policy if exists uniko_cargos_all on public.uniko_cargos;
drop policy if exists uniko_cargo_membros_all on public.uniko_cargo_membros;
-- Política permissiva (chave anon, sem Supabase Auth) — mesmo padrão do
-- resto do Portal: o acesso à ABA de gerenciamento (só admin) é aplicado no
-- CLIENTE; a leitura dos módulos liberados (pra montar o menu de quem tem
-- cargo) precisa ser de qualquer usuário logado, não só admin.
create policy uniko_cargos_all on public.uniko_cargos for all using (true) with check (true);
create policy uniko_cargo_membros_all on public.uniko_cargo_membros for all using (true) with check (true);
