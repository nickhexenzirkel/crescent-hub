-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — guarda o ÁUDIO bruto da chamada (não só a transcrição),
--  pra dar pra ouvir de volta na tela. Mesmo padrão de bucket do Uniko
--  Safer (supabase_uniko_safer.sql) — bucket público, RLS aberta só pra
--  esse bucket (segurança de verdade é a política das tabelas em si +
--  quem tem o link, mesmo espírito do resto do Safer/Security).
--
--  Rode no MESMO projeto Supabase do Uniko Safer/Security. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_call_recordings add column if not exists audio_url text;

insert into storage.buckets (id, name, public)
  values ('uniko-call', 'uniko-call', true)
  on conflict (id) do nothing;

drop policy if exists "uniko call audio read"   on storage.objects;
drop policy if exists "uniko call audio insert" on storage.objects;
drop policy if exists "uniko call audio delete" on storage.objects;
create policy "uniko call audio read"   on storage.objects for select using (bucket_id = 'uniko-call');
create policy "uniko call audio insert" on storage.objects for insert with check (bucket_id = 'uniko-call');
create policy "uniko call audio delete" on storage.objects for delete using (bucket_id = 'uniko-call');
