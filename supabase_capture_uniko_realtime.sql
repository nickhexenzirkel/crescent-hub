-- ════════════════════════════════════════════════════════════════════════
--  Capture o Uniko — habilita REALTIME nas tabelas usadas pelo evento.
--
--  Com isso, o "Spawnar agora" e a captura por outra pessoa propagam de forma
--  ~instantânea para todos os clientes (sem depender do polling do app).
--
--  Rode este script no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- ════════════════════════════════════════════════════════════════════════

-- 1) REPLICA IDENTITY FULL → entrega a linha completa nos eventos de UPDATE/DELETE
--    (importante para `settings`, que é atualizado via UPSERT/UPDATE).
alter table public.settings            replica identity full;
alter table public.capture_uniko_event replica identity full;

-- 2) Adiciona as tabelas à publicação de realtime (só adiciona se ainda faltar).
do $$
begin
  -- Garante que a publicação exista (em projetos Supabase ela já vem pronta).
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'capture_uniko_event'
  ) then
    alter publication supabase_realtime add table public.capture_uniko_event;
  end if;
end $$;

-- 3) Conferência — deve retornar as duas linhas (settings e capture_uniko_event).
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('settings', 'capture_uniko_event')
order by tablename;

-- Observações:
--  • RLS: o realtime respeita RLS. Confirme que os clientes conseguem SELECT nessas
--    tabelas (se a leitura já funciona no app hoje, está ok).
--  • O app continua funcionando sem realtime (via polling); isto só reduz a latência.
