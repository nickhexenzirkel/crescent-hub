-- ════════════════════════════════════════════════════════════════════
-- CONTRACHEQUES — Bucket de Storage + políticas
-- A app usa a chave anônima (o login de admin é validado pela própria
-- aplicação, não pelo Supabase Auth). Sem estas políticas o upload falha
-- com "new row violates row-level security policy" (HTTP 400/403).
-- Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

-- 1) Garante o bucket público (leitura via URL pública dos contracheques)
insert into storage.buckets (id, name, public)
values ('contracheques', 'contracheques', true)
on conflict (id) do update set public = true;

-- 2) Políticas permissivas no bucket 'contracheques' (anon + authenticated)
drop policy if exists contracheques_read   on storage.objects;
drop policy if exists contracheques_insert on storage.objects;
drop policy if exists contracheques_update on storage.objects;
drop policy if exists contracheques_delete on storage.objects;

create policy contracheques_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'contracheques');

create policy contracheques_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'contracheques');

create policy contracheques_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'contracheques')
  with check (bucket_id = 'contracheques');

create policy contracheques_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'contracheques');
