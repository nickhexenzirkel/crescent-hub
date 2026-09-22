-- ════════════════════════════════════════════════════════════════════════
--  CORREÇÃO — segunda leva: dados de saúde/família (colaborador_info),
--  holerites (contracheques) e permissões por cargo (uniko_cargos), no
--  projeto PRINCIPAL do Uniko. Mesmo padrão do script do Uniko Safer.
--
--  Pré-requisito: rode supabase_seguranca_auth_helper.sql NESTE projeto
--  (o principal) antes deste script, com o segredo real colado.
--
--  Rode no SQL Editor do projeto Supabase principal. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ── colaborador_info — dados de saúde/família, chave = CPF cru ──────────
-- Cada colaborador só vê/edita a própria linha; admin/moderador (RH) vê e
-- edita qualquer uma — igual ao que a aba "Informações Pessoais" do
-- Dashboard RH já faz na tela, agora garantido também no banco.
drop policy if exists colaborador_info_read   on public.colaborador_info;
drop policy if exists colaborador_info_insert on public.colaborador_info;
drop policy if exists colaborador_info_update on public.colaborador_info;

create policy colaborador_info_read on public.colaborador_info
  for select using (is_admin_ou_moderador() or cpf = current_cpf());

create policy colaborador_info_insert on public.colaborador_info
  for insert with check (is_admin_ou_moderador() or cpf = current_cpf());

create policy colaborador_info_update on public.colaborador_info
  for update using (is_admin_ou_moderador() or cpf = current_cpf())
  with check (is_admin_ou_moderador() or cpf = current_cpf());

-- ── contracheques — TABELA (metadados + registro de qual arquivo é de
-- quem). Continua igual ao que já existe hoje na tela: cada colaborador só
-- lista os PRÓPRIOS, pelo nome (mesmo campo que TabFinanceiro.jsx já usa
-- pra filtrar); upload/edição continua só com RH (admin/moderador). ─────
--
-- ⚠️ Isso NÃO fecha o holerite em si: o arquivo é servido por uma URL
-- pública salva em `file_url` (bucket de Storage público), então quem já
-- tiver esse link específico ainda consegue abrir o arquivo direto, sem
-- passar por aqui. Fechar esse lado exige trocar `file_url` por link
-- assinado (gerado na hora, expira sozinho) — é a próxima etapa, precisa
-- de um ajuste em Dashboard RH (upload) e TabFinanceiro (download), não só
-- de RLS. Ainda não fiz essa parte.
drop policy if exists contracheques_tbl_read   on public.contracheques;
drop policy if exists contracheques_tbl_insert on public.contracheques;
drop policy if exists contracheques_tbl_update on public.contracheques;
drop policy if exists contracheques_tbl_delete on public.contracheques;

create policy contracheques_tbl_read on public.contracheques
  for select using (is_admin_ou_moderador() or employee_name = current_name());

create policy contracheques_tbl_insert on public.contracheques
  for insert with check (is_admin_ou_moderador());

create policy contracheques_tbl_update on public.contracheques
  for update using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());

create policy contracheques_tbl_delete on public.contracheques
  for delete using (is_admin_ou_moderador());

-- ── uniko_cargos / uniko_cargo_membros — permissões por cargo ───────────
-- Leitura precisa continuar aberta a qualquer colaborador LOGADO (é assim
-- que o menu descobre quais módulos o cargo dele libera) — mas agora exige
-- pelo menos um token válido (esta_logado()), não mais chave anon pura.
-- Escrita (criar/editar cargo, atribuir colaborador) passa a exigir admin
-- de verdade, batendo com a regra que já existe na tela (só admin vê a aba
-- Gerenciar Permissões).
drop policy if exists uniko_cargos_all    on public.uniko_cargos;
drop policy if exists uniko_cargos_read   on public.uniko_cargos;
drop policy if exists uniko_cargos_write  on public.uniko_cargos;
drop policy if exists uniko_cargos_update on public.uniko_cargos;
drop policy if exists uniko_cargos_delete on public.uniko_cargos;
drop policy if exists uniko_cargo_membros_all    on public.uniko_cargo_membros;
drop policy if exists uniko_cargo_membros_read   on public.uniko_cargo_membros;
drop policy if exists uniko_cargo_membros_write  on public.uniko_cargo_membros;
drop policy if exists uniko_cargo_membros_update on public.uniko_cargo_membros;
drop policy if exists uniko_cargo_membros_delete on public.uniko_cargo_membros;

create policy uniko_cargos_read on public.uniko_cargos
  for select using (esta_logado());
create policy uniko_cargos_write on public.uniko_cargos
  for insert with check (current_role_uniko() = 'admin');
create policy uniko_cargos_update on public.uniko_cargos
  for update using (current_role_uniko() = 'admin') with check (current_role_uniko() = 'admin');
create policy uniko_cargos_delete on public.uniko_cargos
  for delete using (current_role_uniko() = 'admin');

create policy uniko_cargo_membros_read on public.uniko_cargo_membros
  for select using (esta_logado());
create policy uniko_cargo_membros_write on public.uniko_cargo_membros
  for insert with check (current_role_uniko() = 'admin');
create policy uniko_cargo_membros_update on public.uniko_cargo_membros
  for update using (current_role_uniko() = 'admin') with check (current_role_uniko() = 'admin');
create policy uniko_cargo_membros_delete on public.uniko_cargo_membros
  for delete using (current_role_uniko() = 'admin');

-- ── ROLLBACK (reverter às pressas, se algo quebrar em produção) ────────
-- drop policy colaborador_info_read on public.colaborador_info;
-- create policy colaborador_info_read on public.colaborador_info for select using (true);
-- (mesmo padrão pra insert/update, e pras demais tabelas deste script)
