-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — "até quando" a pessoa já leu as notificações (curtida/
--  comentário). Antes isso vivia só no localStorage do navegador — no
--  iPhone, rodando como app instalado (Adicionado à Tela de Início), o
--  Safari às vezes NÃO persiste localStorage de forma confiável entre
--  sessões, e a marcação de "lida" voltava a zero sozinha depois de um
--  tempo/reload, mesmo com vários fixes do lado do cliente. Fonte de
--  verdade agora é o banco: guarda só 1 timestamp por pessoa
--  (`last_read_at`) — notificação com `created_at` depois disso é "nova".
--  Ver src/modules/uniko-fit/index.jsx (lastReadAt / marcarNotifsComoLidas).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_notif_reads (
  player       text primary key,
  last_read_at timestamptz not null default now()
);

alter table public.uniko_fit_notif_reads enable row level security;

drop policy if exists "uniko_fit_notif_reads select" on public.uniko_fit_notif_reads;
create policy "uniko_fit_notif_reads select" on public.uniko_fit_notif_reads for select using (true);
drop policy if exists "uniko_fit_notif_reads insert" on public.uniko_fit_notif_reads;
create policy "uniko_fit_notif_reads insert" on public.uniko_fit_notif_reads for insert with check (true);
drop policy if exists "uniko_fit_notif_reads update" on public.uniko_fit_notif_reads;
create policy "uniko_fit_notif_reads update" on public.uniko_fit_notif_reads for update using (true);
