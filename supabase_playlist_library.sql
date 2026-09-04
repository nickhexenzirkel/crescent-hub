-- ════════════════════════════════════════════════════════════════════════
--  BIBLIOTECA DE PLAYLISTS — Central Alexa → aba "Playlist".
--  Qualquer colaborador cola o link de uma playlist do Spotify e ela fica
--  salva aqui, visível pra TODOS (biblioteca compartilhada com busca).
--  Acessada só pelo crescent-hub-server (GET/POST/DELETE /api/playlist/library),
--  nunca direto pelo cliente — não precisa de realtime.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.playlist_library (
  spotify_id  text primary key,
  name        text not null,
  image       text,
  owner       text,                                  -- dono da playlist no Spotify
  track_count integer not null default 0,             -- snapshot de quando foi adicionada
  added_by    text,                                   -- colaborador que colou o link
  created_at  timestamptz not null default now()
);

create index if not exists playlist_library_created_idx on public.playlist_library (created_at desc);

alter table public.playlist_library enable row level security;

-- Server usa a chave anônima → políticas permissivas (o gate de "quem remove" é
-- no app/servidor: DELETE exige admin/moderador via JWT em requireAuth).
drop policy if exists playlist_library_read   on public.playlist_library;
drop policy if exists playlist_library_insert on public.playlist_library;
drop policy if exists playlist_library_delete on public.playlist_library;

create policy playlist_library_read   on public.playlist_library for select using (true);
create policy playlist_library_insert on public.playlist_library for insert with check (true);
create policy playlist_library_delete on public.playlist_library for delete using (true);
