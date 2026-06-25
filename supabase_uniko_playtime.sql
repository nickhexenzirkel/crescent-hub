-- Tempo jogado no Uniko Wave por DIA (em segundos), por jogador. Usado nas missões
-- "Maratona Uniko Wave" (20 / 40 minutos jogados no dia) da Prisma Store.
-- O host do jogo (TabUnikoWave) soma os segundos de cada partida que termina no total do dia.
-- Rode no SQL Editor do Supabase.

create table if not exists public.uniko_playtime (
  player      text not null,
  day         date not null,                 -- dia (YYYY-MM-DD) — o total reinicia a cada dia
  seconds     integer not null default 0,     -- segundos acumulados jogados nesse dia
  updated_at  timestamptz not null default now(),
  primary key (player, day)
);

-- índice para buscar rapidamente o tempo de um jogador num dia
create index if not exists uniko_playtime_player_day_idx on public.uniko_playtime (player, day);

alter table public.uniko_playtime enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura e gravação pública).
drop policy if exists uniko_playtime_read   on public.uniko_playtime;
drop policy if exists uniko_playtime_insert on public.uniko_playtime;
drop policy if exists uniko_playtime_update on public.uniko_playtime;

create policy uniko_playtime_read   on public.uniko_playtime for select using (true);
create policy uniko_playtime_insert on public.uniko_playtime for insert with check (true);
create policy uniko_playtime_update on public.uniko_playtime for update using (true) with check (true);
