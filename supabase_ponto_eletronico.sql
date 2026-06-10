-- ════════════════════════════════════════════════════════════════════
-- PONTO ELETRÔNICO — persistência do banco de horas, marcações,
-- funcionários e justificativas. Rode no SQL Editor do Supabase.
--
-- Estratégia: guardamos as MARCAÇÕES BRUTAS (tipo 3 do AFD). O banco de
-- horas é recalculado no frontend a partir delas. Subir um AFD novo faz
-- upsert das marcações (acumula e deduplica por cpf+data+hora), então
-- nada se perde e os pontos mais recentes entram automaticamente.
-- Empresa única (sem separação por CNPJ).
-- ════════════════════════════════════════════════════════════════════

-- ── Funcionários (nome por CPF/PIS) ──────────────────────────────────
create table if not exists public.ponto_funcionarios (
  cpf         text primary key,
  nome        text,
  excluido    boolean not null default false,  -- desligado/excluído no REP (op. E)
  updated_at  timestamptz not null default now()
);

-- ── Marcações de ponto (tipo 3) ──────────────────────────────────────
create table if not exists public.ponto_marcacoes (
  id          bigint generated always as identity primary key,
  cpf         text not null,
  data        date not null,
  hora        text not null,                   -- "HH:MM"
  nsr         text,                            -- número sequencial de registro
  created_at  timestamptz not null default now(),
  unique (cpf, data, hora)                     -- dedup: mesma batida nunca duplica
);

create index if not exists ponto_marcacoes_cpf_data_idx on public.ponto_marcacoes (cpf, data);

-- ── Justificativas (por funcionário e dia) ───────────────────────────
create table if not exists public.ponto_justificativas (
  cpf         text not null,
  data        date not null,
  texto       text,
  abonado     boolean not null default false,
  autor       text,                            -- quem registrou (nome do usuário admin)
  updated_at  timestamptz not null default now(),
  primary key (cpf, data)
);

-- ── Cabeçalho da empresa (linha única) ───────────────────────────────
create table if not exists public.ponto_empresa (
  id          integer primary key default 1,
  cnpj        text,
  razao       text,
  modelo      text,
  fmt         text,
  updated_at  timestamptz not null default now(),
  constraint ponto_empresa_single check (id = 1)
);

-- ── RLS: app usa a chave anônima → políticas permissivas ─────────────
alter table public.ponto_funcionarios   enable row level security;
alter table public.ponto_marcacoes      enable row level security;
alter table public.ponto_justificativas enable row level security;
alter table public.ponto_empresa        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ponto_funcionarios','ponto_marcacoes','ponto_justificativas','ponto_empresa']
  loop
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
