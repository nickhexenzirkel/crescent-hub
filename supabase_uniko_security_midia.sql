-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SECURITY — armazenamento de mídia (imagem/áudio) DAQUI EM DIANTE.
--  O webhook da Cloud API já chegava com o ID da mídia (msg.image.id,
--  msg.audio.id) mas descartava — só gravava um rótulo tipo "[imagem]".
--  Agora o servidor (crescent-hub-server/whatsappCloudApi.js) baixa o
--  arquivo de verdade via proxy da Graph API do Dualhook
--  (UNIKO_SECURITY_DUALHOOK_API_KEY, configurada no .env da VPS) e sobe pra
--  este bucket. Mensagens antigas continuam só com o rótulo em texto — não é
--  retroativo, por decisão explícita do usuário.
--
--  Mesmo padrão de bucket já usado no Uniko Call (supabase_uniko_call_audio.sql):
--  público, RLS aberta só nesse bucket (segurança de verdade é o módulo em
--  si ser admin-only, não o link do arquivo).
--
--  Rode no MESMO projeto Supabase do Uniko Safer/Security. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_security_messages add column if not exists media_url  text;
alter table public.uniko_security_messages add column if not exists media_mime text;

insert into storage.buckets (id, name, public)
  values ('uniko-security-media', 'uniko-security-media', true)
  on conflict (id) do nothing;

drop policy if exists "uniko security media read"   on storage.objects;
drop policy if exists "uniko security media insert" on storage.objects;
drop policy if exists "uniko security media delete" on storage.objects;
create policy "uniko security media read"   on storage.objects for select using (bucket_id = 'uniko-security-media');
create policy "uniko security media insert" on storage.objects for insert with check (bucket_id = 'uniko-security-media');
create policy "uniko security media delete" on storage.objects for delete using (bucket_id = 'uniko-security-media');
