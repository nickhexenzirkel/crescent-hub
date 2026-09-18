-- ════════════════════════════════════════════════════════════════════════
--  ROLETA DA SORTE — Histórico de Ganhadores com foto. O histórico em si
--  (quem ganhou, quando) já mora dentro do mesmo JSON de `settings` que a
--  roleta usa (key = 'roleta_sorte_config', campo novo `history`) — não
--  precisa de tabela nova pra isso. Só as FOTOS precisam de um bucket no
--  Storage, igual o Uniko Camera já faz.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
  values ('roleta-sorte', 'roleta-sorte', true)
  on conflict (id) do nothing;

drop policy if exists "roleta sorte fotos read"   on storage.objects;
drop policy if exists "roleta sorte fotos insert" on storage.objects;
drop policy if exists "roleta sorte fotos delete" on storage.objects;
create policy "roleta sorte fotos read"   on storage.objects for select using (bucket_id = 'roleta-sorte');
create policy "roleta sorte fotos insert" on storage.objects for insert with check (bucket_id = 'roleta-sorte');
create policy "roleta sorte fotos delete" on storage.objects for delete using (bucket_id = 'roleta-sorte');
