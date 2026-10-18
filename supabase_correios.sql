-- ════════════════════════════════════════════════════════════════════════
--  CORREIOS — Dashboard RH → Correios: o admin manda uma mensagem (título,
--  descrição, imagem opcional) pra um ou vários colaboradores escolhidos.
--  Uma linha por destinatário (mesmo padrão de game_invites/conexao_list_
--  shares) — chega na Caixa de Entrada de cada um (ver shared/menuWidgets.js,
--  itemCorreio) e some de lá como qualquer outro aviso (marcar lido/excluir
--  já é tudo local, não mexe nesta tabela).
--  Rode no projeto Supabase PRINCIPAL. Idempotente.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.correios (
  id          uuid primary key default gen_random_uuid(),
  from_name   text not null,
  to_name     text not null,
  titulo      text not null,
  descricao   text,
  imagem_url  text,
  created_at  timestamptz not null default now()
);
create index if not exists correios_to_name_idx on public.correios (to_name);

alter table public.correios enable row level security;
drop policy if exists correios_all on public.correios;
create policy correios_all on public.correios for all using (true) with check (true);

-- Bucket público pra imagem do correio (até 8MB) — mesmo padrão das imagens
-- de Atualizações (ver supabase_atualizacoes_imagem.sql).
insert into storage.buckets (id, name, public, file_size_limit)
values ('correios-imagens', 'correios-imagens', true, 8388608)
on conflict (id) do update set public = true, file_size_limit = 8388608;

drop policy if exists "correios-imagens read" on storage.objects;
create policy "correios-imagens read" on storage.objects
  for select using (bucket_id = 'correios-imagens');
drop policy if exists "correios-imagens insert" on storage.objects;
create policy "correios-imagens insert" on storage.objects
  for insert with check (bucket_id = 'correios-imagens');
drop policy if exists "correios-imagens delete" on storage.objects;
create policy "correios-imagens delete" on storage.objects
  for delete using (bucket_id = 'correios-imagens');

notify pgrst, 'reload schema';
