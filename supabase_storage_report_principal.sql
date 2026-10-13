-- ════════════════════════════════════════════════════════════════════════
--  Só no projeto PRINCIPAL do Portal. O servidor usa a chave "anon" nesse
--  projeto (não a service_role), então a função do relatório de
--  armazenamento precisa ser liberada pra ela. A função só devolve TAMANHOS
--  e nomes de tabelas/buckets (nenhum dado de linha) e a rota que a chama no
--  servidor (/api/storage/report) é só pra admin.
--  Rode DEPOIS de supabase_storage_report.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════
grant execute on function public.uniko_storage_report() to anon, authenticated;
