-- NOME DE EXIBIÇÃO: como o colaborador quer ser chamado no Uniko (ex.: "Maria Renata
-- Souza" que atende por "Renata"). Escolhido pelo próprio colaborador em Portal →
-- Seus Dados → "Como quer ser chamado(a)". É só apresentação: o nome completo continua
-- sendo a chave de todas as outras tabelas. Chave aqui = nome completo (igual a
-- profile_photos.employee_name), pra os colegas também verem o nome escolhido.
-- Sem linha = o app usa o primeiro nome. Rode no SQL Editor do Supabase.

create table if not exists public.nomes_exibicao (
  employee_name  text primary key,          -- nome completo (mesmo do login)
  cpf            text,                      -- só dígitos (conveniência p/ o RH)
  nome_exibicao  text not null,             -- partes do nome completo, ex.: "Renata"
  updated_at     timestamptz not null default now()
);

alter table public.nomes_exibicao enable row level security;

-- App usa a chave anônima → políticas permissivas (mesmo padrão de profile_photos).
drop policy if exists nomes_exibicao_read   on public.nomes_exibicao;
drop policy if exists nomes_exibicao_insert on public.nomes_exibicao;
drop policy if exists nomes_exibicao_update on public.nomes_exibicao;
drop policy if exists nomes_exibicao_delete on public.nomes_exibicao;

create policy nomes_exibicao_read   on public.nomes_exibicao for select using (true);
create policy nomes_exibicao_insert on public.nomes_exibicao for insert with check (true);
create policy nomes_exibicao_update on public.nomes_exibicao for update using (true) with check (true);
create policy nomes_exibicao_delete on public.nomes_exibicao for delete using (true);
