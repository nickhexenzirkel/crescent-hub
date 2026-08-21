-- ════════════════════════════════════════════════════════════════════════
--  ATUALIZAÇÕES (mural do RH) — permite anexar uma imagem, que aparece
--  dentro do painel branco da moldura junto com o título/descrição.
--  Ver src/modules/dashboard-rh/index.jsx (aba Atualizações) e
--  src/shared/atualizacao.jsx (AtualizacaoFrame/Overlay).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.atualizacoes add column if not exists imagem_url text;

-- Bucket público pra imagem da atualização (até 8MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('atualizacoes-imagens', 'atualizacoes-imagens', true, 8388608)
on conflict (id) do update set public = true, file_size_limit = 8388608;

drop policy if exists "atualizacoes-imagens read" on storage.objects;
create policy "atualizacoes-imagens read" on storage.objects
  for select using (bucket_id = 'atualizacoes-imagens');
drop policy if exists "atualizacoes-imagens insert" on storage.objects;
create policy "atualizacoes-imagens insert" on storage.objects
  for insert with check (bucket_id = 'atualizacoes-imagens');
drop policy if exists "atualizacoes-imagens update" on storage.objects;
create policy "atualizacoes-imagens update" on storage.objects
  for update using (bucket_id = 'atualizacoes-imagens');
drop policy if exists "atualizacoes-imagens delete" on storage.objects;
create policy "atualizacoes-imagens delete" on storage.objects
  for delete using (bucket_id = 'atualizacoes-imagens');
