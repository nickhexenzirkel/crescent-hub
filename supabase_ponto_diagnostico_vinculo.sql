-- ════════════════════════════════════════════════════════════════════════
--  PONTO — diagnóstico: quem vê "0 horas" por falta de vínculo
--  Desde supabase_seguranca_rls_ponto.sql o colaborador só lê as PRÓPRIAS
--  marcações se (a) ponto_marcacoes.cpf = CPF de login, ou (b) existe
--  vínculo em ponto_vinculo. Quem antes funcionava só pelo casamento por
--  NOME (pontoCalc.js) passou a ver tudo zerado.
--  Rode no SQL Editor do Supabase (só leitura nos passos 1 e 2).
-- ════════════════════════════════════════════════════════════════════════

-- 0) Extensão usada pra comparar nomes sem acento (necessária nos passos 2 e 3)
create extension if not exists unaccent with schema extensions;
set search_path = public, extensions;

-- 1) Renata Vieira: perfil, vínculo e registro no ponto
select e.name, e.cpf as cpf_portal, v.ponto_id as vinculo,
       (select count(*) from public.ponto_marcacoes m where m.cpf in (e.cpf, lpad(e.cpf, 11, '0'), v.ponto_id)) as marcacoes_visiveis_pra_ela
from public.employees e
left join public.ponto_vinculo v on v.portal_cpf = e.cpf
where e.name ilike '%renata%vieira%';

select cpf as ponto_id, nome from public.ponto_funcionarios where nome ilike '%renata%vieira%';

-- 2) TODOS afetados: registros do ponto (com marcações) sem vínculo e cujo
--    id não é o CPF de nenhum colaborador, + candidato por nome
select f.cpf as ponto_id, f.nome as nome_no_ponto,
       (select count(*) from public.ponto_marcacoes m where m.cpf = f.cpf) as marcacoes,
       (select string_agg(e.name || ' (' || e.cpf || ')', ' | ')
          from public.employees e
         where lower(unaccent(e.name)) = lower(unaccent(f.nome))) as colaborador_mesmo_nome
from public.ponto_funcionarios f
where coalesce(f.excluido, false) = false
  and not exists (select 1 from public.ponto_vinculo v where v.ponto_id = f.cpf)
  and not exists (select 1 from public.employees e where e.cpf in (f.cpf, ltrim(f.cpf, '0')))
order by marcacoes desc;

-- 3) CORREÇÃO em massa (só NOME IDÊNTICO e único dos dois lados). Descomente pra rodar.
-- insert into public.ponto_vinculo (portal_cpf, ponto_id, ponto_nome)
-- select e.cpf, f.cpf, f.nome
-- from public.ponto_funcionarios f
-- join public.employees e on lower(unaccent(e.name)) = lower(unaccent(f.nome))
-- where coalesce(f.excluido, false) = false
--   and not exists (select 1 from public.ponto_vinculo v where v.ponto_id = f.cpf or v.portal_cpf = e.cpf)
--   and (select count(*) from public.employees x where lower(unaccent(x.name)) = lower(unaccent(f.nome))) = 1
--   and (select count(*) from public.ponto_funcionarios y where lower(unaccent(y.nome)) = lower(unaccent(f.nome))) = 1
-- on conflict (portal_cpf) do nothing;
