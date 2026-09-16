-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CAMERA — câmera estilo MacBook/Photo Booth: filtros de cor,
--  melhorador de qualidade e galeria de fotos PRIVADA (cada colaborador só
--  vê as próprias). O papel de parede é decorativo (por trás da janela da
--  câmera) e fica só no localStorage do aparelho — não precisa de tabela.
--  Aba nova na sidebar do Portal, logo abaixo do Uniko Paint, liberada pra
--  todo mundo — ver src/modules/central-colaborador/tabs/TabUnikoCamera.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_camera_photos (
  id         bigint generated always as identity primary key,
  owner      text not null,       -- nome de quem tirou (mesmo padrão de `created_by`/`player` usado em outras tabelas do Portal)
  url        text not null,
  path       text not null,       -- caminho no Storage, pra dar delete depois
  filtro     text,                -- id do filtro usado (só histórico/depuração)
  created_at timestamptz not null default now()
);
create index if not exists uniko_camera_photos_owner_idx on public.uniko_camera_photos (owner, created_at desc);

alter table public.uniko_camera_photos enable row level security;
drop policy if exists uniko_camera_photos_select on public.uniko_camera_photos;
drop policy if exists uniko_camera_photos_insert on public.uniko_camera_photos;
drop policy if exists uniko_camera_photos_delete on public.uniko_camera_photos;
-- Política permissiva (chave anon, sem Supabase Auth) — mesmo padrão do resto
-- do Portal: a privacidade de "só vejo minhas fotos" é aplicada no CLIENTE
-- (filtro `.eq('owner', me)`), não no banco.
create policy uniko_camera_photos_select on public.uniko_camera_photos for select using (true);
create policy uniko_camera_photos_insert on public.uniko_camera_photos for insert with check (true);
create policy uniko_camera_photos_delete on public.uniko_camera_photos for delete using (true);

-- Bucket de fotos (público — a URL só é descoberta por quem já tem a foto na
-- própria galeria; não há listagem pública de fotos de outra pessoa pelo client).
insert into storage.buckets (id, name, public)
  values ('uniko-camera', 'uniko-camera', true)
  on conflict (id) do nothing;

drop policy if exists "uniko camera fotos read"   on storage.objects;
drop policy if exists "uniko camera fotos insert" on storage.objects;
drop policy if exists "uniko camera fotos delete" on storage.objects;
create policy "uniko camera fotos read"   on storage.objects for select using (bucket_id = 'uniko-camera');
create policy "uniko camera fotos insert" on storage.objects for insert with check (bucket_id = 'uniko-camera');
create policy "uniko camera fotos delete" on storage.objects for delete using (bucket_id = 'uniko-camera');
