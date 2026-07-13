-- supabase_conexao_setorial_trello.sql
-- Conexão Setorial → quadro Kanban (estilo Trello) do time do Financeiro.
-- Substitui o chat mock por um quadro REAL, compartilhado e em tempo real.
-- Rodar UMA vez no SQL Editor do Supabase.

-- ── Colunas (listas) do quadro ────────────────────────────────────────────────
create table if not exists conexao_lists (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  position   double precision not null default 0,  -- ordem das colunas (float p/ inserir no meio)
  created_at timestamptz not null default now()
);

-- ── Cards (tarefas) ───────────────────────────────────────────────────────────
create table if not exists conexao_cards (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references conexao_lists(id) on delete cascade,
  position    double precision not null default 0,  -- ordem dentro da coluna
  title       text not null,
  description text not null default '',
  due_date    timestamptz,                          -- prazo (null = sem prazo)
  priority    text,                                 -- baixa|media|alta|urgente|null
  labels      jsonb not null default '[]'::jsonb,   -- ["urgente","faturamento",...]
  assignees   jsonb not null default '[]'::jsonb,   -- ["Nome Colega", ...]
  checklist   jsonb not null default '[]'::jsonb,   -- [{id,text,done}]
  comments    jsonb not null default '[]'::jsonb,   -- [{id,author,text,at}]
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conexao_cards_list_idx on conexao_cards(list_id);
create index if not exists conexao_cards_pos_idx  on conexao_cards(list_id, position);

-- ── RLS: app usa a chave anon; acesso é restrito no CLIENTE (módulo só abre p/ admin).
--    Políticas permissivas p/ a anon (mesmo padrão das outras tabelas do hub). ──
alter table conexao_lists enable row level security;
alter table conexao_cards enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='conexao_lists' and policyname='conexao_lists_all') then
    create policy conexao_lists_all on conexao_lists for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='conexao_cards' and policyname='conexao_cards_all') then
    create policy conexao_cards_all on conexao_cards for all using (true) with check (true);
  end if;
end $$;

-- ── Realtime (sincroniza o quadro entre todos ao vivo) ─────────────────────────
do $$ begin
  begin execute 'alter publication supabase_realtime add table conexao_lists'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table conexao_cards'; exception when duplicate_object then null; end;
end $$;

-- ── Colunas iniciais (só se o quadro estiver vazio) ───────────────────────────
insert into conexao_lists (title, position)
select v.title, v.position
from (values
  ('📥 A Fazer',        1000.0),
  ('⚙️ Em Andamento',   2000.0),
  ('👀 Em Revisão',     3000.0),
  ('✅ Concluído',      4000.0)
) as v(title, position)
where not exists (select 1 from conexao_lists);
