-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — preenche as ligações antigas (sem atendente) como sendo do
--  Nicolas Andrade Barboza, setor Faturamento. Uso único; rode no SQL Editor
--  do Supabase do Uniko Safer.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Antes: quantas estão sem atendente (esperado: 13).
select count(*) as sem_atendente from public.uniko_call_recordings where attendant_name is null;

-- 2) Aplica. Se já existir ligação sua gravada logada, reaproveita o id do Portal.
update public.uniko_call_recordings
   set attendant_name = 'Nicolas Andrade Barboza',
       attendant_id   = (select attendant_id from public.uniko_call_recordings
                          where attendant_name ilike 'nicolas andrade%' and attendant_id is not null
                          order by started_at desc limit 1),
       sectors        = array['faturamento']
 where attendant_name is null;

-- 3) Depois: deve mostrar 0 sem atendente.
select count(*) as sem_atendente from public.uniko_call_recordings where attendant_name is null;
