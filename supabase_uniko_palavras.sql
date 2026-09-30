-- ═══════════════════════════════════════════════════════════════════════════
-- UNIKO PALAVRAS — Blefe de palavras (estilo "Ghost") em tempo real. Rode no SQL Editor.
--
-- Mesma arquitetura do Uniko Stop / Paint: uma linha por SALA, o `id` é o código
-- dela e só o ESTADO DA PARTIDA mora aqui (letras, vidas, vez, dúvida). O que é
-- efêmero (jogadas a caminho do host, resposta da dúvida, chat) trafega por
-- Realtime broadcast e nunca toca no banco.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_palavras_state (
  id          text primary key,              -- código da sala
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists uniko_palavras_state_updated_idx
  on public.uniko_palavras_state (updated_at desc);

alter table public.uniko_palavras_state enable row level security;

-- App usa a chave anônima → políticas permissivas, igual ao resto do projeto.
drop policy if exists uniko_palavras_state_read   on public.uniko_palavras_state;
drop policy if exists uniko_palavras_state_insert on public.uniko_palavras_state;
drop policy if exists uniko_palavras_state_update on public.uniko_palavras_state;
drop policy if exists uniko_palavras_state_delete on public.uniko_palavras_state;

create policy uniko_palavras_state_read   on public.uniko_palavras_state for select using (true);
create policy uniko_palavras_state_insert on public.uniko_palavras_state for insert with check (true);
create policy uniko_palavras_state_update on public.uniko_palavras_state for update using (true) with check (true);
create policy uniko_palavras_state_delete on public.uniko_palavras_state for delete using (true);

-- Realtime: o app escuta postgres_changes pra sincronizar a partida.
do $$
begin
  alter publication supabase_realtime add table public.uniko_palavras_state;
exception
  when duplicate_object then null;
  when others then null;
end $$;
