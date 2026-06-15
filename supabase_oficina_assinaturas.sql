-- ════════════════════════════════════════════════════════════════════
-- OFICINA ESTELAR — Histórico de Assinatura Automática
-- Registra cada assinatura aplicada: quem assinou (nome), o login (CPF)
-- usado no acesso, o arquivo assinado e a data/hora.
-- Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.assinatura_historico (
  id          bigint generated always as identity primary key,
  usuario     text,                              -- nome de quem assinou
  login       text,                              -- CPF/login usado no acesso
  arquivo     text,                              -- nome do PDF assinado
  assinado_em timestamptz not null default now() -- quando assinou
);

create index if not exists assinatura_historico_data_idx
  on public.assinatura_historico (assinado_em desc);

-- ── RLS: app usa a chave anônima → políticas permissivas ─────────────
alter table public.assinatura_historico enable row level security;

drop policy if exists assinatura_historico_read   on public.assinatura_historico;
drop policy if exists assinatura_historico_insert on public.assinatura_historico;

create policy assinatura_historico_read   on public.assinatura_historico for select using (true);
create policy assinatura_historico_insert on public.assinatura_historico for insert with check (true);
