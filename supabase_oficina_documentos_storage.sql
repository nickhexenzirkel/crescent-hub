-- ════════════════════════════════════════════════════════════════════
-- OFICINA ESTELAR — Bucket de Storage pros documentos gerados (Carta de
-- Correção, etc.) — guarda um snapshot do documento assinado/baixado
-- pra aparecer no Histórico de Assinatura (ver/baixar depois).
-- A app usa a chave anônima, então precisa de políticas permissivas.
-- Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('oficina-documentos', 'oficina-documentos', true)
on conflict (id) do update set public = true;

drop policy if exists oficina_documentos_read   on storage.objects;
drop policy if exists oficina_documentos_insert on storage.objects;
drop policy if exists oficina_documentos_update on storage.objects;
drop policy if exists oficina_documentos_delete on storage.objects;

create policy oficina_documentos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'oficina-documentos');

create policy oficina_documentos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'oficina-documentos');

create policy oficina_documentos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'oficina-documentos')
  with check (bucket_id = 'oficina-documentos');

create policy oficina_documentos_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'oficina-documentos');
