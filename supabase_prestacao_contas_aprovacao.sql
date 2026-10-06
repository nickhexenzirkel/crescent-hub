-- ════════════════════════════════════════════════════════════════════════
--  PRESTAÇÕES DE CONTAS — APROVAÇÃO / REJEIÇÃO PELO RH
--  O Administrador/Moderador (Dashboard RH → Prestações de Contas) aprova ou
--  rejeita cada prestação e pode escrever uma observação (motivo da rejeição
--  etc.). O comercial que lançou recebe o aviso na Caixa de Entrada, que lê
--  estas colunas direto da própria tabela (ver useCaixaEntrada).
--
--  Pré-requisito: supabase_prestacao_contas.sql já rodado.
--  Rode no SQL Editor do Supabase principal. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.prestacoes_contas
  add column if not exists status          text not null default 'pendente',
  add column if not exists observacao_rh   text,
  add column if not exists avaliada_por    text,
  add column if not exists avaliada_em     timestamptz;

alter table public.prestacoes_contas drop constraint if exists prestacoes_contas_status_chk;
alter table public.prestacoes_contas
  add constraint prestacoes_contas_status_chk check (status in ('pendente', 'aprovada', 'rejeitada'));

create index if not exists prestacoes_contas_status_idx on public.prestacoes_contas (status, avaliada_em desc);

-- A política de update deixa o dono mexer na própria linha (editar/excluir); sem
-- esta trava ele poderia se aprovar sozinho. Só Administrador/Moderador altera
-- status e observação; quem não é RH sempre insere como 'pendente'.
create or replace function public.protege_avaliacao_prestacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_ou_moderador() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.observacao_rh := null;
    new.avaliada_por := null;
    new.avaliada_em := null;
  elsif new.status         is distinct from old.status
     or new.observacao_rh  is distinct from old.observacao_rh
     or new.avaliada_por   is distinct from old.avaliada_por
     or new.avaliada_em    is distinct from old.avaliada_em then
    raise exception 'Só o RH pode aprovar ou rejeitar uma prestação de contas.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protege_avaliacao_prestacao on public.prestacoes_contas;
create trigger trg_protege_avaliacao_prestacao
  before insert or update on public.prestacoes_contas
  for each row execute function public.protege_avaliacao_prestacao();

-- Caixa de Entrada em tempo real (tabela precisa estar na publicação).
do $$
begin
  alter publication supabase_realtime add table public.prestacoes_contas;
exception when duplicate_object then null;
end $$;
