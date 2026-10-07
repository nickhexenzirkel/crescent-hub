-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — preenche as ligações antigas (sem atendente) como sendo do
--  Nicolas, setor Faturamento. Uso único; rode no SQL Editor do Supabase do
--  Uniko Safer.
--
--  O id e o nome vêm das ligações que o Nicolas gravou já logado na
--  extensão — assim elas caem no MESMO grupo na aba Atendentes (em vez de
--  criar um "Nicolas" duplicado).
-- ════════════════════════════════════════════════════════════════════════

-- 1) Confira antes: deve retornar 1 linha com o seu id/nome (e quantas sem atendente existem).
select
  (select count(*) from public.uniko_call_recordings where attendant_id is null) as sem_atendente,
  (select attendant_id   from public.uniko_call_recordings where attendant_name ilike 'nicolas%' order by started_at desc limit 1) as id_nicolas,
  (select attendant_name from public.uniko_call_recordings where attendant_name ilike 'nicolas%' order by started_at desc limit 1) as nome_nicolas;

-- 2) Aplica (só mexe em quem está SEM atendente; não faz nada se id_nicolas vier nulo).
update public.uniko_call_recordings
   set attendant_id   = n.attendant_id,
       attendant_name = n.attendant_name,
       sectors        = array['faturamento']
  from (select attendant_id, attendant_name from public.uniko_call_recordings
         where attendant_name ilike 'nicolas%' and attendant_id is not null
         order by started_at desc limit 1) n
 where public.uniko_call_recordings.attendant_id is null;
