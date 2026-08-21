-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — aceite das regras de convivência, mostrado uma única vez na
--  PRIMEIRA vez que a pessoa abre o módulo (tela com fundo borrado, texto
--  aparecendo em partes, botão "Estou de acordo" só depois de 10s). Guarda
--  por CONTA (não só no navegador) pra não pedir de novo noutro aparelho.
--  Ver src/modules/uniko-fit/index.jsx (mostrarTermos / aceitarTermos).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_terms_acceptance (
  player      text primary key,
  accepted_at timestamptz not null default now()
);

alter table public.uniko_fit_terms_acceptance enable row level security;

drop policy if exists "uniko_fit_terms_acceptance select" on public.uniko_fit_terms_acceptance;
create policy "uniko_fit_terms_acceptance select" on public.uniko_fit_terms_acceptance for select using (true);
drop policy if exists "uniko_fit_terms_acceptance insert" on public.uniko_fit_terms_acceptance;
create policy "uniko_fit_terms_acceptance insert" on public.uniko_fit_terms_acceptance for insert with check (true);
drop policy if exists "uniko_fit_terms_acceptance update" on public.uniko_fit_terms_acceptance;
create policy "uniko_fit_terms_acceptance update" on public.uniko_fit_terms_acceptance for update using (true);
