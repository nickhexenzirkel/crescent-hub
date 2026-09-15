-- supabase_conexao_setorial_list_shares.sql
-- Trello (Conexão Setorial) → COMPARTILHAR UMA COLUNA com um colega específico,
-- sem dar acesso à sala inteira (as outras colunas continuam invisíveis pra
-- quem recebeu). Fluxo: dono da coluna manda o convite (fica "pendente"), o
-- convidado vê um aviso na Caixa de Entrada, abre e Aceita/Recusa. Aceitando,
-- ele passa a enxergar SÓ aquela coluna (e outras que aceitar na mesma sala)
-- sempre que voltar ao Trello — sem precisar da senha da sala.
--
-- Mesmo padrão de segurança das outras tabelas do hub: RLS permissiva pra
-- chave anon, o controle de quem vê o quê é feito no CLIENTE (ver
-- conexao-setorial/index.jsx, guestListIds). Não é cofre — é organização
-- entre colegas.
--
-- Rodar UMA vez no SQL Editor do Supabase, DEPOIS de
-- supabase_conexao_setorial_salas.sql.

create table if not exists conexao_list_shares (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references conexao_rooms(id) on delete cascade,
  list_id      uuid not null references conexao_lists(id) on delete cascade,
  list_title   text not null,              -- snapshot (o convite continua legível mesmo se a coluna for renomeada)
  room_name    text not null,
  room_color   text not null default '#A24CE0',
  from_name    text not null,
  to_name      text not null,
  status       text not null default 'pendente',   -- pendente | aceito | recusado
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists conexao_list_shares_to_idx on conexao_list_shares(to_name, status);
create index if not exists conexao_list_shares_room_idx on conexao_list_shares(room_id);

alter table conexao_list_shares enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='conexao_list_shares' and policyname='conexao_list_shares_all') then
    create policy conexao_list_shares_all on conexao_list_shares for all using (true) with check (true);
  end if;
end $$;

-- Realtime: a Caixa de Entrada e a tela do convidado atualizam sozinhas.
do $$ begin
  begin execute 'alter publication supabase_realtime add table conexao_list_shares'; exception when duplicate_object then null; end;
end $$;
