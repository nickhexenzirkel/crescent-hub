-- ════════════════════════════════════════════════════════════════════════
--  ARMAZENAMENTO SUPABASE — relatório de uso pra aba "Armazenamento" do
--  Dashboard RH. Devolve o tamanho do banco, do Storage, das maiores tabelas
--  e de cada bucket. Só o servidor (service_role) chama.
--
--  RODE NOS DOIS projetos Supabase (a função é a mesma):
--    1) o PRINCIPAL do Portal (Uniko geral)
--    2) o do Uniko Safer/Security/Call (npfgggoavzzyzcjjachi)
--  Idempotente.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.uniko_storage_report()
returns jsonb
language sql
security definer
set search_path = public, storage
as $$
  select jsonb_build_object(
    'db_bytes',      pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.relname, 'bytes', t.b, 'rows', t.r) order by t.b desc)
      from (
        select c.relname, pg_total_relation_size(c.oid) as b, greatest(c.reltuples, 0)::bigint as r
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc limit 40
      ) t), '[]'::jsonb),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('name', b.bucket_id, 'bytes', b.s, 'files', b.n) order by b.s desc)
      from (
        select bucket_id, coalesce(sum((metadata->>'size')::bigint), 0) as s, count(*) as n
        from storage.objects group by bucket_id
      ) b), '[]'::jsonb)
  );
$$;

revoke all on function public.uniko_storage_report() from public, anon, authenticated;
grant execute on function public.uniko_storage_report() to service_role;
