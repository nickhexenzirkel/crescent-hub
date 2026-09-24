// src/shared/cargoPermissions.js
// Cargos: camada ADICIONAL de acesso a módulo por cima do role
// admin/moderador já existente (que continuam vendo tudo, sem nenhuma
// mudança de comportamento). Um cargo lista os módulos liberados; um
// colaborador pode ter vários cargos — o acesso efetivo é a UNIÃO dos
// módulos de todos os cargos atribuídos a ele. Gerenciado inteiramente em
// Dashboard RH → Gerenciar Permissões (GerenciarPermissoesTab.jsx), acesso
// direto ao Supabase (mesmo padrão de colaborador_info — não passa pelo
// servidor Node, que não sabe nada sobre cargo).
//
// Vínculo é pelo `id` (uuid) do funcionário, NÃO pelo CPF: a API
// /api/employees devolve o CPF mascarado (maskCpf, no servidor), então
// nunca bateria com o CPF de verdade do token de login. O `id` não é
// mascarado e já vem no JWT (authUser.id).
import { supabase } from '../contexts/user';

const TABLE_CARGOS = 'uniko_cargos';
const TABLE_MEMBROS = 'uniko_cargo_membros';

// Módulos liberados pro funcionário informado (união de todos os cargos
// dele) + se algum desses cargos é "restrito" (ver supabase_uniko_cargos_restrito.sql)
// + restrição de ABA dentro de módulo (ver supabase_uniko_cargos_tab_restrict.sql):
// nesse caso, quem chama (App.jsx) esconde até os módulos abertos por
// padrão que não estiverem nessa união — não só os sensíveis de sempre —
// e recorta a navegação interna de módulos como Portal do Colaborador/
// Oficina Estelar pras abas liberadas (união entre os cargos do funcionário).
export async function loadCargoModulesForEmployeeId(employeeId) {
  if (!employeeId) return { moduleIds: new Set(), restricted: false, tabRestrictions: {} };
  const { data, error } = await supabase
    .from(TABLE_MEMBROS)
    .select('uniko_cargos(module_ids, restrict_only, tab_restrictions)')
    .eq('employee_id', employeeId);
  if (error || !data) return { moduleIds: new Set(), restricted: false, tabRestrictions: {} };
  const moduleIds = new Set();
  let restricted = false;
  const tabRestrictions = {};
  data.forEach(row => {
    (row.uniko_cargos?.module_ids || []).forEach(id => moduleIds.add(id));
    if (row.uniko_cargos?.restrict_only) restricted = true;
    Object.entries(row.uniko_cargos?.tab_restrictions || {}).forEach(([moduleId, tabIds]) => {
      if (!Array.isArray(tabIds) || !tabIds.length) return;
      const set = tabRestrictions[moduleId] || (tabRestrictions[moduleId] = new Set());
      tabIds.forEach(id => set.add(id));
    });
  });
  return { moduleIds, restricted, tabRestrictions };
}

export async function updateCargoRestrict(cargoId, restrictOnly) {
  const { error } = await supabase.from(TABLE_CARGOS).update({ restrict_only: restrictOnly, updated_at: new Date().toISOString() }).eq('id', cargoId);
  if (error) throw new Error(error.message);
}

export async function updateCargoTabRestrictions(cargoId, tabRestrictions) {
  const { error } = await supabase.from(TABLE_CARGOS).update({ tab_restrictions: tabRestrictions, updated_at: new Date().toISOString() }).eq('id', cargoId);
  if (error) throw new Error(error.message);
}

export async function loadCargos() {
  const { data, error } = await supabase.from(TABLE_CARGOS).select('*').order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

// Todos os vínculos cargo↔funcionário de uma vez (evita N+1 ao montar a
// lista de cargos com quem está em cada um).
export async function loadCargoMembros() {
  const { data, error } = await supabase.from(TABLE_MEMBROS).select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createCargo(name) {
  const { data, error } = await supabase.from(TABLE_CARGOS).insert({ name, module_ids: [] }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameCargo(cargoId, name) {
  const { error } = await supabase.from(TABLE_CARGOS).update({ name, updated_at: new Date().toISOString() }).eq('id', cargoId);
  if (error) throw new Error(error.message);
}

export async function updateCargoModules(cargoId, moduleIds) {
  const { error } = await supabase.from(TABLE_CARGOS).update({ module_ids: moduleIds, updated_at: new Date().toISOString() }).eq('id', cargoId);
  if (error) throw new Error(error.message);
}

export async function deleteCargo(cargoId) {
  const { error } = await supabase.from(TABLE_CARGOS).delete().eq('id', cargoId);
  if (error) throw new Error(error.message);
}

export async function addMembro(cargoId, employeeId) {
  const { error } = await supabase.from(TABLE_MEMBROS).insert({ cargo_id: cargoId, employee_id: employeeId });
  if (error) throw new Error(error.message);
}

export async function removeMembro(cargoId, employeeId) {
  const { error } = await supabase.from(TABLE_MEMBROS).delete().eq('cargo_id', cargoId).eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
}
