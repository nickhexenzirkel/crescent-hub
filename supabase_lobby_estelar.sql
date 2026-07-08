-- Lobby Estelar — quem está "no lobby" agora, posição (andando pro lado) e
-- balão de fala (chat). Uma linha por jogador (upsert); linhas velhas (sem
-- heartbeat recente) são filtradas no CLIENTE, não precisa cron de limpeza.
-- Rode no SQL Editor do Supabase.

create table if not exists public.lobby_presence (
  player      text primary key,
  skin_id     text not null default 'default',   -- Uniko usado como avatar (mesmo id do assistente)
  scene       text not null default 'hangar',    -- cenário atual (futuro: mais de um)
  x           numeric not null default 50,        -- posição horizontal, 0-100 (%)
  y           numeric not null default 40,        -- posição dentro da faixa do chão, 0-100 (%)
  message     text,                               -- último balão de fala (nulo = sem balão)
  message_at  timestamptz,                        -- quando foi enviado (cliente expira o balão sozinho)
  updated_at  timestamptz not null default now()   -- heartbeat — usado pra saber quem está online
);

-- Se a tabela já existia (versão anterior, sem chão 2D) — adiciona a coluna sem quebrar nada.
alter table public.lobby_presence add column if not exists y numeric not null default 40;

alter table public.lobby_presence enable row level security;

drop policy if exists lobby_presence_all on public.lobby_presence;
create policy lobby_presence_all on public.lobby_presence for all using (true) with check (true);
