-- Resumo de PRESENÇA por funcionário e MÊS, calculado pelo módulo do Ponto Eletrônico
-- a partir das marcações. Alimenta a missão "Presença Impecável" da Prisma Store:
-- impecável = saldo == 0 (sem horas positivas nem negativas) E issues == 0 (sem inconsistências).
-- O Ponto faz upsert deste resumo quando o admin abre/processa o módulo. Rode no SQL Editor.

create table if not exists public.ponto_presenca (
  cpf         text not null,
  month       text not null,                 -- "YYYY-MM"
  saldo       integer not null default 0,     -- saldo do mês em MINUTOS (0 = sem +/- horas)
  issues      integer not null default 0,     -- nº de inconsistências do mês
  updated_at  timestamptz not null default now(),
  primary key (cpf, month)
);

create index if not exists ponto_presenca_cpf_month_idx on public.ponto_presenca (cpf, month);

alter table public.ponto_presenca enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura e gravação pública).
drop policy if exists ponto_presenca_read   on public.ponto_presenca;
drop policy if exists ponto_presenca_insert on public.ponto_presenca;
drop policy if exists ponto_presenca_update on public.ponto_presenca;

create policy ponto_presenca_read   on public.ponto_presenca for select using (true);
create policy ponto_presenca_insert on public.ponto_presenca for insert with check (true);
create policy ponto_presenca_update on public.ponto_presenca for update using (true) with check (true);
