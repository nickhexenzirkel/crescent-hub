-- ════════════════════════════════════════════════════════════════════
-- Buckets de Storage pras fotos que hoje ficam em base64 embutido no
-- banco (prêmios da Prisma Store e frames dos Unikos personalizados).
-- Isso deixava a página lenta pra carregar (o navegador tinha que
-- baixar o JSON INTEIRO, com todas as imagens em texto, antes de
-- conseguir mostrar qualquer coisa). Storage guarda arquivo de
-- verdade, com URL e cache real do navegador.
-- A app usa a chave anônima, então precisa de políticas permissivas
-- (mesmo padrão já usado em oficina-documentos/contracheques/ponto-anexos).
-- Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('mercado-fotos', 'mercado-fotos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('uniko-fotos', 'uniko-fotos', true)
on conflict (id) do update set public = true;

drop policy if exists mercado_fotos_read   on storage.objects;
drop policy if exists mercado_fotos_insert on storage.objects;
drop policy if exists mercado_fotos_update on storage.objects;
drop policy if exists mercado_fotos_delete on storage.objects;

create policy mercado_fotos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'mercado-fotos');

create policy mercado_fotos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'mercado-fotos');

create policy mercado_fotos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'mercado-fotos')
  with check (bucket_id = 'mercado-fotos');

create policy mercado_fotos_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'mercado-fotos');

drop policy if exists uniko_fotos_read   on storage.objects;
drop policy if exists uniko_fotos_insert on storage.objects;
drop policy if exists uniko_fotos_update on storage.objects;
drop policy if exists uniko_fotos_delete on storage.objects;

create policy uniko_fotos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'uniko-fotos');

create policy uniko_fotos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'uniko-fotos');

create policy uniko_fotos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'uniko-fotos')
  with check (bucket_id = 'uniko-fotos');

create policy uniko_fotos_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'uniko-fotos');
