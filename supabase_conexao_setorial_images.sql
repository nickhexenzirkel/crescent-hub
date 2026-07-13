-- supabase_conexao_setorial_images.sql
-- Adiciona IMAGENS aos cards do Conexão Setorial (Trello) + bucket de Storage.
-- Rodar DEPOIS do supabase_conexao_setorial_trello.sql. Rodar UMA vez.

-- ── Coluna de imagens no card (array de {url,path,name}) ──────────────────────
alter table conexao_cards add column if not exists images jsonb not null default '[]'::jsonb;

-- ── Bucket público de imagens ────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('conexao', 'conexao', true)
on conflict (id) do nothing;

-- Políticas do Storage p/ o bucket 'conexao' (app usa a chave anon; acesso ao
-- módulo é restrito a admin no cliente). Leitura pública + upload/remoção anon.
do $$ begin
  begin
    create policy conexao_obj_read on storage.objects for select using (bucket_id = 'conexao');
  exception when duplicate_object then null; end;
  begin
    create policy conexao_obj_insert on storage.objects for insert with check (bucket_id = 'conexao');
  exception when duplicate_object then null; end;
  begin
    create policy conexao_obj_update on storage.objects for update using (bucket_id = 'conexao');
  exception when duplicate_object then null; end;
  begin
    create policy conexao_obj_delete on storage.objects for delete using (bucket_id = 'conexao');
  exception when duplicate_object then null; end;
end $$;

-- ── Tira os emojis dos títulos das colunas padrão (viraram ícones SVG na UI).
--    Só toca nos títulos EXATOS que foram semeados — não mexe em colunas renomeadas. ──
update conexao_lists set title = 'A Fazer'      where title = '📥 A Fazer';
update conexao_lists set title = 'Em Andamento' where title = '⚙️ Em Andamento';
update conexao_lists set title = 'Em Revisão'   where title = '👀 Em Revisão';
update conexao_lists set title = 'Concluído'    where title = '✅ Concluído';
