-- ════════════════════════════════════════════════════════════════════════
--  PONTO ELETRÔNICO — mesma correção de RLS aplicada ao resto do sistema
--  (ver supabase_seguranca_rls_dados_sensiveis.sql), agora nas tabelas de
--  ponto. Chave usada: CPF de login (current_cpf()) OU o vínculo explícito
--  cadastrado pelo RH (ponto_vinculo) — NUNCA o casamento por nome parecido
--  que o front faz como fallback (src/shared/pontoCalc.js), porque isso
--  não é reproduzível com segurança dentro de uma regra do banco.
--
--  ⚠️ RODE ISTO PRIMEIRO, ANTES do restante do script — mostra quem hoje
--  só tem o ponto casado por nome (sem vínculo explícito). Cadastre o
--  vínculo de cada um (Dashboard RH → aba "Vínculo") ANTES de aplicar as
--  políticas abaixo, senão essas pessoas param de ver o próprio ponto até
--  o vínculo ser criado:
--
--    select f.cpf as ponto_id, f.nome
--    from public.ponto_funcionarios f
--    where f.excluido = false
--      and not exists (select 1 from public.ponto_vinculo v where v.ponto_id = f.cpf);
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql já rodado neste projeto
--  (usa is_admin_ou_moderador(), current_cpf(), esta_logado()).
--
--  Rode no SQL Editor do projeto Supabase principal. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- Um colaborador pode ter o próprio ponto batido com o CPF cru, o CPF com
-- zero à esquerda (comum em AFD/PIS de 11 dígitos), ou um "ponto_id"
-- totalmente diferente (PIS) vinculado explicitamente pelo RH.
create or replace function public.e_meu_ponto(p_cpf_ponto text)
returns boolean
language sql stable as $$
  select
    p_cpf_ponto = current_cpf()
    or p_cpf_ponto = lpad(current_cpf(), 11, '0')
    or exists (
      select 1 from public.ponto_vinculo v
      where v.portal_cpf = current_cpf() and v.ponto_id = p_cpf_ponto
    );
$$;
grant execute on function public.e_meu_ponto(text) to anon, authenticated;

-- Data da última marcação de QUALQUER pessoa no sistema — usada só pra saber
-- até onde os dados do ponto vão (limite honesto pra contar falta, ver
-- src/shared/pontoCalc.js). É uma agregação (uma data só, sem nenhuma linha
-- pessoal), então pode ficar liberada pra qualquer colaborador logado sem
-- reabrir o que a RLS de ponto_marcacoes acima acabou de fechar.
create or replace function public.ultima_marcacao_ponto()
returns date
language sql
security definer
stable
set search_path = public
as $$
  select max(data) from public.ponto_marcacoes;
$$;
grant execute on function public.ultima_marcacao_ponto() to anon, authenticated;

-- ── ponto_vinculo — só o próprio vínculo (colaborador) ou tudo (RH) ─────
drop policy if exists ponto_vinculo_all    on public.ponto_vinculo;
drop policy if exists ponto_vinculo_select on public.ponto_vinculo;
drop policy if exists ponto_vinculo_write  on public.ponto_vinculo;
drop policy if exists ponto_vinculo_update on public.ponto_vinculo;
drop policy if exists ponto_vinculo_delete on public.ponto_vinculo;
create policy ponto_vinculo_select on public.ponto_vinculo
  for select using (is_admin_ou_moderador() or portal_cpf = current_cpf());
create policy ponto_vinculo_write on public.ponto_vinculo
  for insert with check (is_admin_ou_moderador());
create policy ponto_vinculo_update on public.ponto_vinculo
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
create policy ponto_vinculo_delete on public.ponto_vinculo
  for delete using (is_admin_ou_moderador());

-- ── ponto_marcacoes — leitura só do próprio ponto; escrita (import AFD) só RH ──
drop policy if exists ponto_marcacoes_all    on public.ponto_marcacoes;
drop policy if exists ponto_marcacoes_select on public.ponto_marcacoes;
drop policy if exists ponto_marcacoes_write  on public.ponto_marcacoes;
drop policy if exists ponto_marcacoes_update on public.ponto_marcacoes;
drop policy if exists ponto_marcacoes_delete on public.ponto_marcacoes;
create policy ponto_marcacoes_select on public.ponto_marcacoes
  for select using (is_admin_ou_moderador() or public.e_meu_ponto(cpf));
create policy ponto_marcacoes_write on public.ponto_marcacoes
  for insert with check (is_admin_ou_moderador());
create policy ponto_marcacoes_update on public.ponto_marcacoes
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
create policy ponto_marcacoes_delete on public.ponto_marcacoes
  for delete using (is_admin_ou_moderador());

-- ── ponto_justificativas — leitura só do próprio ponto; escrita (RH abona) só RH ──
drop policy if exists ponto_justificativas_all    on public.ponto_justificativas;
drop policy if exists ponto_justificativas_select on public.ponto_justificativas;
drop policy if exists ponto_justificativas_write  on public.ponto_justificativas;
drop policy if exists ponto_justificativas_update on public.ponto_justificativas;
drop policy if exists ponto_justificativas_delete on public.ponto_justificativas;
create policy ponto_justificativas_select on public.ponto_justificativas
  for select using (is_admin_ou_moderador() or public.e_meu_ponto(cpf));
create policy ponto_justificativas_write on public.ponto_justificativas
  for insert with check (is_admin_ou_moderador());
create policy ponto_justificativas_update on public.ponto_justificativas
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
create policy ponto_justificativas_delete on public.ponto_justificativas
  for delete using (is_admin_ou_moderador());

-- ── ponto_solicitacoes — colaborador lê/cria as PRÓPRIAS (cpf = login,
--    coluna já é o CPF do portal, não o ponto_id); RH lê/atualiza todas. ──
drop policy if exists ponto_solic_read   on public.ponto_solicitacoes;
drop policy if exists ponto_solic_insert on public.ponto_solicitacoes;
drop policy if exists ponto_solic_update on public.ponto_solicitacoes;
drop policy if exists ponto_solic_delete on public.ponto_solicitacoes;

create policy ponto_solic_read on public.ponto_solicitacoes
  for select using (is_admin_ou_moderador() or cpf = current_cpf());
create policy ponto_solic_insert on public.ponto_solicitacoes
  for insert with check (is_admin_ou_moderador() or cpf = current_cpf());
create policy ponto_solic_update on public.ponto_solicitacoes
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
create policy ponto_solic_delete on public.ponto_solicitacoes
  for delete using (is_admin_ou_moderador());

-- ── ponto_funcionarios — fica de leitura ampla de propósito: é usada pelo
--    PRÓPRIO front (resolvePontoCpfs, src/shared/pontoCalc.js) pra tentar
--    casar o colaborador logado pelo nome quando não há vínculo explícito
--    ainda. Só passa a exigir estar logado de verdade (antes era anon puro).
--    Escrita continua só RH (importação do AFD). ─────────────────────────
drop policy if exists ponto_funcionarios_all    on public.ponto_funcionarios;
drop policy if exists ponto_funcionarios_select on public.ponto_funcionarios;
drop policy if exists ponto_funcionarios_write  on public.ponto_funcionarios;
drop policy if exists ponto_funcionarios_update on public.ponto_funcionarios;
drop policy if exists ponto_funcionarios_delete on public.ponto_funcionarios;
create policy ponto_funcionarios_select on public.ponto_funcionarios
  for select using (esta_logado());
create policy ponto_funcionarios_write on public.ponto_funcionarios
  for insert with check (is_admin_ou_moderador());
create policy ponto_funcionarios_update on public.ponto_funcionarios
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
create policy ponto_funcionarios_delete on public.ponto_funcionarios
  for delete using (is_admin_ou_moderador());

-- ── ponto_empresa — cabeçalho único da empresa, baixa sensibilidade ─────
drop policy if exists ponto_empresa_all    on public.ponto_empresa;
drop policy if exists ponto_empresa_select on public.ponto_empresa;
drop policy if exists ponto_empresa_write  on public.ponto_empresa;
drop policy if exists ponto_empresa_update on public.ponto_empresa;
create policy ponto_empresa_select on public.ponto_empresa
  for select using (esta_logado());
create policy ponto_empresa_write on public.ponto_empresa
  for insert with check (is_admin_ou_moderador());
create policy ponto_empresa_update on public.ponto_empresa
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());

-- ── ROLLBACK (reverter às pressas, se algo travar acesso indevido) ─────
-- drop policy ponto_marcacoes_select on public.ponto_marcacoes;
-- create policy ponto_marcacoes_all on public.ponto_marcacoes for all using (true) with check (true);
-- (mesmo padrão pras demais tabelas deste script)
