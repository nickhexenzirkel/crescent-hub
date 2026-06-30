-- Dias com saldo NEGATIVO por funcionário (em MINUTOS), gravados pelo módulo do Ponto
-- Eletrônico ao processar/justificar. Alimenta a aba "Banco de Horas" do colaborador,
-- que mostra em quais DIAS ele ficou negativo. Dias JUSTIFICADOS (abonados) têm saldo
-- zerado no cálculo e por isso NÃO entram aqui. Rode no SQL Editor do Supabase.

create table if not exists public.ponto_negativos (
  cpf         text not null,
  data        text not null,                 -- "YYYY-MM-DD"
  saldo       integer not null default 0,     -- saldo do dia em MINUTOS (negativo)
  updated_at  timestamptz not null default now(),
  primary key (cpf, data)
);

create index if not exists ponto_negativos_cpf_idx on public.ponto_negativos (cpf, data);

alter table public.ponto_negativos enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura/gravação/remoção públicas).
-- A REMOÇÃO é necessária: o módulo regrava os dias negativos de cada CPF do zero.
drop policy if exists ponto_negativos_read   on public.ponto_negativos;
drop policy if exists ponto_negativos_insert on public.ponto_negativos;
drop policy if exists ponto_negativos_update on public.ponto_negativos;
drop policy if exists ponto_negativos_delete on public.ponto_negativos;

create policy ponto_negativos_read   on public.ponto_negativos for select using (true);
create policy ponto_negativos_insert on public.ponto_negativos for insert with check (true);
create policy ponto_negativos_update on public.ponto_negativos for update using (true) with check (true);
create policy ponto_negativos_delete on public.ponto_negativos for delete using (true);
