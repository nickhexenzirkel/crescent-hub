-- ════════════════════════════════════════════════════════════════════
-- BIBLIOTECA LOCAL — MP3s locais na fila do Festival (Central Alexa).
--
-- Hoje o Festival só toca faixas do Spotify (Spotify Connect no Echo
-- Spot). Isso adiciona uma biblioteca de MP3s enviados pelos próprios
-- colaboradores, guardados no Storage do Supabase, que entram na MESMA
-- fila (`queue`) marcados com `source='local'` — o servidor
-- (crescent-hub-server, repo separado) decide, na hora de tocar, se
-- manda pro Spotify ou fala pra Alexa reproduzir a URL via SSML.
--
-- Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

-- ── Bucket de Storage pros arquivos .mp3 (público, mesmo padrão de
--    mercado-fotos/uniko-fotos em supabase_fotos_storage.sql) ──
insert into storage.buckets (id, name, public)
values ('biblioteca-local', 'biblioteca-local', true)
on conflict (id) do update set public = true;

drop policy if exists biblioteca_local_read   on storage.objects;
drop policy if exists biblioteca_local_insert on storage.objects;
drop policy if exists biblioteca_local_update on storage.objects;
drop policy if exists biblioteca_local_delete on storage.objects;

create policy biblioteca_local_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'biblioteca-local');

create policy biblioteca_local_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'biblioteca-local');

create policy biblioteca_local_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'biblioteca-local')
  with check (bucket_id = 'biblioteca-local');

create policy biblioteca_local_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'biblioteca-local');

-- ── Tabela de metadados (o que aparece na busca da aba) ──
create table if not exists public.biblioteca_local (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  artist      text,
  album_art   text,                          -- data-URL base64 da capa extraída do ID3 (ou null)
  mp3_path    text not null,                 -- caminho no bucket biblioteca-local
  mp3_url     text not null,                 -- URL pública
  duration_ms integer,
  duration_str text,
  uploaded_by text,
  created_at  timestamptz not null default now()
);

alter table public.biblioteca_local enable row level security;

drop policy if exists biblioteca_local_row_read   on public.biblioteca_local;
drop policy if exists biblioteca_local_row_insert on public.biblioteca_local;
drop policy if exists biblioteca_local_row_delete on public.biblioteca_local;

create policy biblioteca_local_row_read   on public.biblioteca_local for select using (true);
create policy biblioteca_local_row_insert on public.biblioteca_local for insert with check (true);
create policy biblioteca_local_row_delete on public.biblioteca_local for delete using (true);

create index if not exists biblioteca_local_created_idx on public.biblioteca_local (created_at desc);

-- ── Fila (`queue`): dá pra ela aceitar uma faixa LOCAL, sem spotify_uri/spotify_id ──
alter table public.queue add column if not exists source text not null default 'spotify';
alter table public.queue add column if not exists mp3_url text;
alter table public.queue alter column spotify_uri drop not null;
alter table public.queue alter column spotify_id  drop not null;
