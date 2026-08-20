-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SUSPECT — jogo estilo Among Us (Tripulantes x Impostor).
--  Mesmo padrão dos outros jogos sem servidor (Uniko Paint / Uniko Stop):
--  uma linha por SALA, o estado inteiro (fase, jogadores, papéis, tarefas...)
--  vive em `state` (jsonb) e só o HOST (eleito no cliente) escreve. Ver
--  src/modules/central-colaborador/tabs/TabUnikoSuspect.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_suspect_state (
  id          text primary key,              -- código da sala
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.uniko_suspect_state enable row level security;

-- App usa a chave anônima → políticas permissivas (a aba inteira já é admin-only
-- no cliente; aqui só precisa deixar ler/gravar/apagar pra chave anônima).
drop policy if exists uniko_suspect_state_read   on public.uniko_suspect_state;
drop policy if exists uniko_suspect_state_insert on public.uniko_suspect_state;
drop policy if exists uniko_suspect_state_update on public.uniko_suspect_state;
drop policy if exists uniko_suspect_state_delete on public.uniko_suspect_state;

create policy uniko_suspect_state_read   on public.uniko_suspect_state for select using (true);
create policy uniko_suspect_state_insert on public.uniko_suspect_state for insert with check (true);
create policy uniko_suspect_state_update on public.uniko_suspect_state for update using (true) with check (true);
create policy uniko_suspect_state_delete on public.uniko_suspect_state for delete using (true);

-- Realtime: entrega mudanças de estado (fase, jogadores, papéis) ~instantâneas.
alter table public.uniko_suspect_state replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'uniko_suspect_state'
  ) then
    alter publication supabase_realtime add table public.uniko_suspect_state;
  end if;
end $$;
