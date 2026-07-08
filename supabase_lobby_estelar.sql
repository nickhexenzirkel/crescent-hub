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

-- CRÍTICO pro tempo real funcionar: sem isso, o postgres_changes do Supabase
-- Realtime NUNCA dispara pra essa tabela — o app só atualiza a posição dos
-- outros jogadores a cada 5s (o poll de reforço), o que parece "teletransporte"
-- em vez de movimento suave. Precisa rodar mesmo se a tabela já existia (o
-- bloco abaixo é idempotente, mesmo padrão de supabase_capture_uniko_realtime.sql).

-- REPLICA IDENTITY FULL → entrega a linha completa nos eventos de UPDATE (a
-- posição/mensagem é sempre atualizada via UPSERT, ou seja, UPDATE por baixo).
alter table public.lobby_presence replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'lobby_presence'
  ) then
    alter publication supabase_realtime add table public.lobby_presence;
  end if;
end $$;

-- Conferência — deve retornar uma linha (lobby_presence).
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'lobby_presence';
