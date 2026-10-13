-- ════════════════════════════════════════════════════════════════════════
--  UNIKO WHATSAPP + UNIKO CALL — Arquivo anual: medidor de uso do Supabase.
--  Devolve quanto o banco e o Storage estão pesando, pra tela "Arquivo anual"
--  mostrar a barra de uso. Só o servidor (service_role) chama — nenhum
--  acesso pra anon/authenticated.
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer/Security. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.uniko_archive_usage()
returns jsonb
language sql
security definer
set search_path = public, storage
as $$
  select jsonb_build_object(
    'db_bytes',      pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'security_msgs_bytes', pg_total_relation_size('public.uniko_security_messages'),
    'security_raw_bytes',  pg_total_relation_size('public.uniko_security_webhook_raw'),
    'call_bytes',          pg_total_relation_size('public.uniko_call_recordings'),
    'media_bytes',   coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'uniko-security-media'), 0),
    'audio_bytes',   coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'uniko-call'), 0)
  );
$$;

revoke all on function public.uniko_archive_usage() from public, anon, authenticated;
grant execute on function public.uniko_archive_usage() to service_role;
