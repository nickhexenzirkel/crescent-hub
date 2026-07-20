-- supabase_conexao_setorial_salas.sql
-- Conexão Setorial → SALAS. Cada sala é um quadro Kanban próprio, protegido por
-- senha. O admin cria as salas e define a senha; quem entra digita a senha uma
-- vez por sessão e vê as colunas e cards daquela sala.
--
-- SEGURANÇA — leia antes de confiar nisso:
-- Guardamos apenas o HASH SHA-256 da senha, nunca o texto. Isso evita expor a
-- senha em si (importante se alguém reusa senha em outro lugar), mas a
-- verificação acontece no CLIENTE e a tabela é legível pela chave anon. Ou seja:
-- a senha organiza o acesso entre colegas, ela NÃO é uma barreira contra quem
-- sabe abrir o DevTools. Não use as salas para segredo real (dado sensível de
-- pessoa, financeiro crítico) sem antes mover a validação para o servidor.
--
-- Rodar UMA vez no SQL Editor do Supabase, DEPOIS de supabase_conexao_setorial_trello.sql.

-- ── Salas ─────────────────────────────────────────────────────────────────────
create table if not exists conexao_rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  descricao   text not null default '',
  pass_hash   text,                                  -- SHA-256 hex; null = sala aberta
  color       text not null default '#A24CE0',       -- cor do card da sala no lobby
  position    double precision not null default 0,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- ── Vínculo das colunas com a sala ────────────────────────────────────────────
alter table conexao_lists add column if not exists room_id uuid references conexao_rooms(id) on delete cascade;
create index if not exists conexao_lists_room_idx on conexao_lists(room_id, position);

-- ── Sala padrão + adoção do quadro que já existe ──────────────────────────────
-- O quadro atual do Financeiro vira a sala "Financeiro" e nada se perde.
-- Sem senha por enquanto: o admin define a dele no painel de salas.
insert into conexao_rooms (name, descricao, color, position)
select 'Financeiro', 'Quadro original do time do Financeiro', '#A24CE0', 1000.0
where not exists (select 1 from conexao_rooms);

update conexao_lists
   set room_id = (select id from conexao_rooms order by position limit 1)
 where room_id is null;

-- ── RLS (mesmo padrão permissivo das outras tabelas do hub) ───────────────────
alter table conexao_rooms enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='conexao_rooms' and policyname='conexao_rooms_all') then
    create policy conexao_rooms_all on conexao_rooms for all using (true) with check (true);
  end if;
end $$;

-- ── Realtime (a lista de salas atualiza sozinha entre os abertos) ─────────────
do $$ begin
  begin execute 'alter publication supabase_realtime add table conexao_rooms'; exception when duplicate_object then null; end;
end $$;
