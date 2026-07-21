-- Vídeo de fundo por Uniko (Central Alexa): o admin sobe um vídeo no Dashboard
-- (Capture o Uniko) e ele vira o fundo do card do Uniko + cenário quando aquele
-- Uniko é o DJ, substituindo o cenário animado. Vale pros Unikos fixos E os da
-- Oficina (chave = uniko_id).
create table if not exists uniko_bg_videos (
  uniko_id text primary key,
  video_url text,
  updated_at timestamptz not null default now()
);

alter table uniko_bg_videos enable row level security;

drop policy if exists "uniko_bg_videos select" on uniko_bg_videos;
create policy "uniko_bg_videos select" on uniko_bg_videos for select using (true);
drop policy if exists "uniko_bg_videos insert" on uniko_bg_videos;
create policy "uniko_bg_videos insert" on uniko_bg_videos for insert with check (true);
drop policy if exists "uniko_bg_videos update" on uniko_bg_videos;
create policy "uniko_bg_videos update" on uniko_bg_videos for update using (true);
drop policy if exists "uniko_bg_videos delete" on uniko_bg_videos;
create policy "uniko_bg_videos delete" on uniko_bg_videos for delete using (true);

-- Realtime: pra todos os clientes com a Central Alexa aberta pegarem a troca de
-- vídeo na hora (sem isso, só quem recarrega a página vê). Idempotente.
do $$ begin
  alter publication supabase_realtime add table uniko_bg_videos;
exception when duplicate_object then null; end $$;

-- Bucket público pros vídeos (até 80MB, boa qualidade).
insert into storage.buckets (id, name, public, file_size_limit)
values ('uniko-videos', 'uniko-videos', true, 83886080)
on conflict (id) do update set public = true, file_size_limit = 83886080;

drop policy if exists "uniko-videos read" on storage.objects;
create policy "uniko-videos read" on storage.objects
  for select using (bucket_id = 'uniko-videos');
drop policy if exists "uniko-videos insert" on storage.objects;
create policy "uniko-videos insert" on storage.objects
  for insert with check (bucket_id = 'uniko-videos');
drop policy if exists "uniko-videos update" on storage.objects;
create policy "uniko-videos update" on storage.objects
  for update using (bucket_id = 'uniko-videos');
drop policy if exists "uniko-videos delete" on storage.objects;
create policy "uniko-videos delete" on storage.objects
  for delete using (bucket_id = 'uniko-videos');
