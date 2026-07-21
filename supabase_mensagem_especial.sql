-- Mensagem Especial da Máquina do Tempo: bucket público pra capa (imagem) e
-- vídeo escolhidos pelo RH no Dashboard. Vídeo pode ser grande (qualidade boa),
-- então o limite do bucket é 80MB. A config (URLs) fica na tabela `settings`
-- (key mensagem_especial_config) — não precisa de tabela nova.
insert into storage.buckets (id, name, public, file_size_limit)
values ('mensagem-especial', 'mensagem-especial', true, 83886080)
on conflict (id) do update set public = true, file_size_limit = 83886080;

-- Políticas permissivas (mesma linha dos outros buckets públicos do projeto).
drop policy if exists "mensagem-especial read" on storage.objects;
create policy "mensagem-especial read" on storage.objects
  for select using (bucket_id = 'mensagem-especial');

drop policy if exists "mensagem-especial insert" on storage.objects;
create policy "mensagem-especial insert" on storage.objects
  for insert with check (bucket_id = 'mensagem-especial');

drop policy if exists "mensagem-especial update" on storage.objects;
create policy "mensagem-especial update" on storage.objects
  for update using (bucket_id = 'mensagem-especial');

drop policy if exists "mensagem-especial delete" on storage.objects;
create policy "mensagem-especial delete" on storage.objects
  for delete using (bucket_id = 'mensagem-especial');
