-- Informações pessoais EXTRAS do colaborador: contato de familiares (2), grau de
-- parentesco, celular de cada um, e dados de saúde (doenças e alergias). O próprio
-- colaborador preenche na aba "Seus Dados" do Portal, e Administradores/Moderadores
-- editam pelo Dashboard RH → aba "Informações Pessoais". Chave = CPF (11 dígitos, cru).
-- Rode no SQL Editor do Supabase.

create table if not exists public.colaborador_info (
  cpf                    text primary key,       -- CPF do colaborador (só dígitos)
  nome                   text,                    -- nome (conveniência p/ o RH visualizar)
  familiar1_nome         text,
  familiar1_cel          text,
  familiar1_parentesco   text,
  familiar2_nome         text,
  familiar2_cel          text,
  familiar2_parentesco   text,
  doencas                text,
  alergias               text,
  updated_at             timestamptz not null default now(),
  updated_by             text                     -- quem gravou por último (colaborador ou RH)
);

alter table public.colaborador_info enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura/gravação públicas).
drop policy if exists colaborador_info_read   on public.colaborador_info;
drop policy if exists colaborador_info_insert on public.colaborador_info;
drop policy if exists colaborador_info_update on public.colaborador_info;

create policy colaborador_info_read   on public.colaborador_info for select using (true);
create policy colaborador_info_insert on public.colaborador_info for insert with check (true);
create policy colaborador_info_update on public.colaborador_info for update using (true) with check (true);
