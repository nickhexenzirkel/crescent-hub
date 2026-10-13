-- ════════════════════════════════════════════════════════════════════════
--  IMAGENS DO SITE — troca imagens do Uniko (mascote, logo, cards…) pela tela
--  do Dashboard RH → "Imagens do Site", valendo pra todo mundo sem deploy.
--  Rode no projeto Supabase PRINCIPAL. Idempotente.
--
--  Segurança: segue o mesmo padrão aberto das outras tabelas do projeto principal
--  (a tela só aparece pra admin, mas a regra no banco não distingue admin).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.uniko_site_imagens (
  path        text primary key,          -- caminho original em /public, ex.: /UNIKO_NEW.png
  url         text not null,             -- imagem nova (URL pública do Storage)
  label       text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table public.uniko_site_imagens enable row level security;
drop policy if exists uniko_site_imagens_all on public.uniko_site_imagens;
create policy uniko_site_imagens_all on public.uniko_site_imagens for all using (true) with check (true);

insert into storage.buckets (id, name, public)
  values ('site-imagens', 'site-imagens', true)
  on conflict (id) do nothing;

drop policy if exists "site imagens read"   on storage.objects;
drop policy if exists "site imagens insert" on storage.objects;
drop policy if exists "site imagens delete" on storage.objects;
create policy "site imagens read"   on storage.objects for select using (bucket_id = 'site-imagens');
create policy "site imagens insert" on storage.objects for insert with check (bucket_id = 'site-imagens');
create policy "site imagens delete" on storage.objects for delete using (bucket_id = 'site-imagens');
