-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — poses extras dos Desafios, criadas pelo admin (Dashboard RH
--  → aba "Uniko FIT"). Somam com as poses fixas (array POSES, com arte no
--  sprite sheet /uniko-fit/poses-uniko.png) — cada pose extra tem a própria
--  imagem (upload livre, sem precisar mexer no sprite sheet).
--  Ver src/modules/uniko-fit/index.jsx (poseDoDia) e
--  src/modules/dashboard-rh/UnikoFitPosesTab.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_poses_custom (
  id         bigint generated always as identity primary key,
  emoji      text,
  texto      text not null,
  image_url  text not null,
  ativo      boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.uniko_fit_poses_custom enable row level security;

drop policy if exists "uniko_fit_poses_custom select" on public.uniko_fit_poses_custom;
create policy "uniko_fit_poses_custom select" on public.uniko_fit_poses_custom for select using (true);
drop policy if exists "uniko_fit_poses_custom insert" on public.uniko_fit_poses_custom;
create policy "uniko_fit_poses_custom insert" on public.uniko_fit_poses_custom for insert with check (true);
drop policy if exists "uniko_fit_poses_custom update" on public.uniko_fit_poses_custom;
create policy "uniko_fit_poses_custom update" on public.uniko_fit_poses_custom for update using (true);
drop policy if exists "uniko_fit_poses_custom delete" on public.uniko_fit_poses_custom;
create policy "uniko_fit_poses_custom delete" on public.uniko_fit_poses_custom for delete using (true);

-- Bucket público pras imagens das poses extras (PNG/JPG, até 12MB).
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
