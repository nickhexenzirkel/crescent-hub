-- Vínculo Portal ↔ Ponto Eletrônico. No AFD o identificador costuma ser PIS/PASEP
-- (≠ CPF do cadastro), então o RH liga cada colaborador do Portal ao seu registro do
-- ponto (ponto_funcionarios.cpf = o número do AFD). Rode no SQL Editor do Supabase.

create table if not exists public.ponto_vinculo (
  portal_cpf  text primary key,            -- CPF do colaborador no Portal (só dígitos)
  ponto_id    text not null,               -- identificador no ponto (PIS/PASEP, = ponto_marcacoes.cpf)
  ponto_nome  text,
  updated_at  timestamptz not null default now()
);

create index if not exists ponto_vinculo_pontoid_idx on public.ponto_vinculo (ponto_id);

alter table public.ponto_vinculo enable row level security;

drop policy if exists ponto_vinculo_read   on public.ponto_vinculo;
drop policy if exists ponto_vinculo_insert on public.ponto_vinculo;
drop policy if exists ponto_vinculo_update on public.ponto_vinculo;
drop policy if exists ponto_vinculo_delete on public.ponto_vinculo;

create policy ponto_vinculo_read   on public.ponto_vinculo for select using (true);
create policy ponto_vinculo_insert on public.ponto_vinculo for insert with check (true);
create policy ponto_vinculo_update on public.ponto_vinculo for update using (true) with check (true);
create policy ponto_vinculo_delete on public.ponto_vinculo for delete using (true);

-- guarda também o identificador do ponto na solicitação (pra abonar o dia certo ao aprovar)
alter table public.ponto_solicitacoes add column if not exists ponto_cpf text;
