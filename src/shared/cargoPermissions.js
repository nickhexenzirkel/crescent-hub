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

// Módulos liberados pro funcionário informado, pela união de todos os
// cargos dele.
export async function loadCargoModulesForEmployeeId(employeeId) {
  if (!employeeId) return new Set();
  const { data, error } = await supabase
    .from(TABLE_MEMBROS)
    .select('uniko_cargos(module_ids)')
    .eq('employee_id', employeeId);
  if (error || !data) return new Set();
  const ids = new Set();
  data.forEach(row => { (row.uniko_cargos?.module_ids || []).forEach(id => ids.add(id)); });
  return ids;
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
