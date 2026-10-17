-- ════════════════════════════════════════════════════════════════════════
--  CONTRACHEQUE GERADO PELO UNIKO — dados que faltam no cadastro do
--  funcionário (crescent-hub-server, fora deste repositório) pra montar o
--  "Recibo de Pagamento": matrícula (número do contador) e lotação. Fica
--  numa tabela própria, lida/escrita direto pelo Dashboard RH (mesmo padrão
--  de uniko_cargos — sem passar pelo servidor Node), porque adicionar um
--  campo novo em employees exigiria mexer no servidor, que é outro repo.
--  Rode no projeto Supabase PRINCIPAL (o mesmo de `employees`). Idempotente.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.contracheque_dados (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  matricula   text,
  lotacao     text not null default 'GERAL',
  updated_at  timestamptz not null default now()
);

alter table public.contracheque_dados enable row level security;
drop policy if exists contracheque_dados_all on public.contracheque_dados;
create policy contracheque_dados_all on public.contracheque_dados for all using (true) with check (true);

notify pgrst, 'reload schema';
