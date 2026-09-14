-- ════════════════════════════════════════════════════════════════════
-- CATEGORIAS DE UNIKO — tags tipo "Frutas", "Seres Místicos", "Desenho
-- Animado", "Especiais"... criadas pelo admin (Dashboard RH → Capture o
-- Uniko → Oficina de Uniko → aba "Categoria") e atribuídas a cada Uniko
-- (fixo do roster OU criado na Oficina). A Coleção de Unikos usa isso
-- pra filtrar só os Unikos que têm alguma das tags marcadas.
--
-- Duas tabelas, mesmo padrão já usado por uniko_bg_videos/
-- uniko_reward_overrides: aplica em cima do objeto do roster em memória
-- (fixos E Oficina, chave é só o uniko_id), então nenhum lugar que já lê
-- o roster precisa mudar.
-- ════════════════════════════════════════════════════════════════════

-- Catálogo de tags (lista global).
create table if not exists uniko_categoria_tags (
  id         text primary key,            -- ex.: cat_frutas
  nome       text not null,
  cor        text not null default '#6C5CE7',
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

-- Quais tags cada Uniko tem.
create table if not exists uniko_categorias (
  uniko_id   text primary key,
  tags       text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table uniko_categoria_tags enable row level security;
alter table uniko_categorias     enable row level security;

drop policy if exists "uniko_categoria_tags all" on uniko_categoria_tags;
create policy "uniko_categoria_tags all" on uniko_categoria_tags for all using (true) with check (true);
drop policy if exists "uniko_categorias all" on uniko_categorias;
create policy "uniko_categorias all" on uniko_categorias for all using (true) with check (true);

-- Realtime: a Coleção aberta pega tag nova / atribuição na hora. Idempotente.
do $$ begin
  alter publication supabase_realtime add table uniko_categoria_tags;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table uniko_categorias;
exception when duplicate_object then null; end $$;
