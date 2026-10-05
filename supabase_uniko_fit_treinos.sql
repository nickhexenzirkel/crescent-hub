-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — aba "Treinos" (biblioteca de vídeos/fotos por grupo muscular,
--  curada por Admin/Moderador) e "Progressão de carga" (privada por pessoa).
--  Ver src/modules/uniko-fit/treinos.jsx.
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql já rodado neste projeto
--  (usa current_name(), esta_logado(), is_admin_ou_moderador()).
--  Rode no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── Biblioteca de treinos: todo mundo logado LÊ, só Admin/Moderador escreve ──
create table if not exists public.uniko_fit_treinos_midia (
  id         uuid primary key default gen_random_uuid(),
  grupo      text not null,          -- peito | costas | posteriores | quadriceps | gluteos | ombros | biceps | triceps | abdomen | panturrilha | cardio
  titulo     text,
  url        text not null,
  tipo       text,                   -- youtube | tiktok | imagem | video | link
  created_at timestamptz not null default now()
);
create index if not exists uniko_fit_treinos_midia_grupo_idx on public.uniko_fit_treinos_midia (grupo, created_at desc);
alter table public.uniko_fit_treinos_midia enable row level security;
drop policy if exists "uniko_fit_treinos_midia select" on public.uniko_fit_treinos_midia;
drop policy if exists "uniko_fit_treinos_midia insert" on public.uniko_fit_treinos_midia;
drop policy if exists "uniko_fit_treinos_midia update" on public.uniko_fit_treinos_midia;
drop policy if exists "uniko_fit_treinos_midia delete" on public.uniko_fit_treinos_midia;
create policy "uniko_fit_treinos_midia select" on public.uniko_fit_treinos_midia for select using (public.esta_logado());
create policy "uniko_fit_treinos_midia insert" on public.uniko_fit_treinos_midia for insert with check (public.is_admin_ou_moderador());
create policy "uniko_fit_treinos_midia update" on public.uniko_fit_treinos_midia for update using (public.is_admin_ou_moderador()) with check (public.is_admin_ou_moderador());
create policy "uniko_fit_treinos_midia delete" on public.uniko_fit_treinos_midia for delete using (public.is_admin_ou_moderador());

-- ── Progressão de carga: uma linha por pessoa + máquina + dia ──
create table if not exists public.uniko_fit_cargas (
  player     text          not null,
  exercicio  text          not null,
  data       date          not null,
  carga      numeric(6,1)  not null check (carga > 0 and carga <= 1000),
  reps       integer       check (reps is null or (reps between 1 and 200)),
  created_at timestamptz   not null default now(),
  primary key (player, exercicio, data)
);
alter table public.uniko_fit_cargas enable row level security;
drop policy if exists "uniko_fit_cargas select" on public.uniko_fit_cargas;
drop policy if exists "uniko_fit_cargas insert" on public.uniko_fit_cargas;
drop policy if exists "uniko_fit_cargas update" on public.uniko_fit_cargas;
drop policy if exists "uniko_fit_cargas delete" on public.uniko_fit_cargas;
create policy "uniko_fit_cargas select" on public.uniko_fit_cargas for select using (player = public.current_name());
create policy "uniko_fit_cargas insert" on public.uniko_fit_cargas for insert with check (player = public.current_name());
create policy "uniko_fit_cargas update" on public.uniko_fit_cargas for update using (player = public.current_name()) with check (player = public.current_name());
create policy "uniko_fit_cargas delete" on public.uniko_fit_cargas for delete using (player = public.current_name());
