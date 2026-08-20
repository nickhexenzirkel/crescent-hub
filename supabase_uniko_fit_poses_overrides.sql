-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — foto customizada pra uma pose FIXA (das colagens
--  poses-uniko-classicas.png / poses-uniko.png). O admin troca a arte de
--  UMA pose específica pela Dashboard RH (aba "Uniko FIT") sem precisar
--  editar as colagens — a pose passa a usar essa imagem em vez do recorte
--  do sprite sheet, em todo mundo, em qualquer cliente.
--  Ver src/modules/uniko-fit/index.jsx (posesTodas) e
--  src/modules/dashboard-rh/UnikoFitPosesTab.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_poses_overrides (
  pose_id    text primary key,   -- id da pose fixa (array POSES no client), ex.: 'biceps-duplo'
  image_url  text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.uniko_fit_poses_overrides enable row level security;

drop policy if exists "uniko_fit_poses_overrides select" on public.uniko_fit_poses_overrides;
create policy "uniko_fit_poses_overrides select" on public.uniko_fit_poses_overrides for select using (true);
drop policy if exists "uniko_fit_poses_overrides insert" on public.uniko_fit_poses_overrides;
create policy "uniko_fit_poses_overrides insert" on public.uniko_fit_poses_overrides for insert with check (true);
drop policy if exists "uniko_fit_poses_overrides update" on public.uniko_fit_poses_overrides;
create policy "uniko_fit_poses_overrides update" on public.uniko_fit_poses_overrides for update using (true);
drop policy if exists "uniko_fit_poses_overrides delete" on public.uniko_fit_poses_overrides;
create policy "uniko_fit_poses_overrides delete" on public.uniko_fit_poses_overrides for delete using (true);

-- Reusa o MESMO bucket público das poses extras (supabase_uniko_fit_poses_custom.sql).
insert into storage.buckets (id, name, public, file_size_limit)
values ('uniko-fit-poses', 'uniko-fit-poses', true, 12582912)
on conflict (id) do update set public = true, file_size_limit = 12582912;

drop policy if exists "uniko-fit-poses read" on storage.objects;
create policy "uniko-fit-poses read" on storage.objects
  for select using (bucket_id = 'uniko-fit-poses');
drop policy if exists "uniko-fit-poses insert" on storage.objects;
create policy "uniko-fit-poses insert" on storage.objects
  for insert with check (bucket_id = 'uniko-fit-poses');
drop policy if exists "uniko-fit-poses update" on storage.objects;
create policy "uniko-fit-poses update" on storage.objects
  for update using (bucket_id = 'uniko-fit-poses');
drop policy if exists "uniko-fit-poses delete" on storage.objects;
create policy "uniko-fit-poses delete" on storage.objects
  for delete using (bucket_id = 'uniko-fit-poses');
