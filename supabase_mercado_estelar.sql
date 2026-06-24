-- Mercado Estelar — persistência no Supabase.
-- Três tabelas: catálogo de prêmios (compartilhado), estado por usuário
-- (saldos/check-in/coleção/desafios) e histórico de transações (consultável
-- pelo admin). Rode no SQL Editor do Supabase.
-- O app usa a chave anônima → políticas permissivas.

-- ── Catálogo de prêmios (gerenciado pelo admin, compartilhado) ──────────────
create table if not exists public.mercado_items (
  id         text primary key,
  name       text not null,
  descr      text default '',            -- "desc" é palavra reservada → descr
  price      int  not null default 0,
  cur        text not null default 'comum',   -- comum | premium
  stock      int  not null default 0,
  rarity     text default 'Comum',
  emoji      text default '🎁',
  featured   boolean default false,
  images     jsonb not null default '[]'::jsonb,  -- [url, ...] (1ª = capa)
  sort       int default 0,
  updated_at timestamptz not null default now()
);

-- ── Estado por usuário (saldos, check-in, coleção, desafios) ────────────────
create table if not exists public.mercado_state (
  player     text primary key,           -- nome do colaborador
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Histórico de transações (1 linha por evento; consultável p/ admin) ──────
create table if not exists public.mercado_history (
  id         uuid primary key default gen_random_uuid(),
  player     text not null,
  kind       text not null,              -- checkin | compra | missao | envio | troca | admin
  descr      text default '',
  comum      int,                        -- delta (+/-) ou null
  premium    int,
  created_at timestamptz not null default now()
);
create index if not exists mercado_history_player_idx  on public.mercado_history (player, created_at desc);
create index if not exists mercado_history_created_idx on public.mercado_history (created_at desc);

-- ── RLS (permissivo, chave anônima) ────────────────────────────────────────
alter table public.mercado_items   enable row level security;
alter table public.mercado_state   enable row level security;
alter table public.mercado_history enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mercado_items','mercado_state','mercado_history'] loop
    execute format('drop policy if exists %1$s_read   on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_read   on public.%1$s for select using (true)', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (true)', t);
    execute format('create policy %1$s_update on public.%1$s for update using (true) with check (true)', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (true)', t);
  end loop;
end $$;
