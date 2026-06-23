-- Save POR CONTA do Uniko Wave: personagens/mascotes conquistados, carteira
-- (GW/GC), personagem selecionado, perfil e pity do gacha. Assim o progresso
-- acompanha o usuário em qualquer dispositivo (PC, celular, etc.).
-- Rode no SQL Editor do Supabase.

create table if not exists public.uniko_wave_saves (
  player     text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.uniko_wave_saves enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura e gravação pública).
drop policy if exists uniko_wave_saves_read   on public.uniko_wave_saves;
drop policy if exists uniko_wave_saves_insert on public.uniko_wave_saves;
drop policy if exists uniko_wave_saves_update on public.uniko_wave_saves;

create policy uniko_wave_saves_read   on public.uniko_wave_saves for select using (true);
create policy uniko_wave_saves_insert on public.uniko_wave_saves for insert with check (true);
create policy uniko_wave_saves_update on public.uniko_wave_saves for update using (true) with check (true);
