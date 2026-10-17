// Matrícula e lotação de cada funcionário — faltam no cadastro do
// crescent-hub-server (fora deste repo), então ficam numa tabela própria no
// Supabase principal (ver supabase_contracheque_dados.sql). Acesso direto,
// mesmo padrão de shared/cargoPermissions.js — só o Dashboard RH usa.
import { supabase } from '../contexts/user';

const TABELA = 'contracheque_dados';

export async function loadContrachequeDados(employeeId) {
  if (!employeeId) return { matricula: '', lotacao: 'GERAL' };
  const { data } = await supabase.from(TABELA).select('matricula, lotacao').eq('employee_id', employeeId).maybeSingle();
  return { matricula: data?.matricula || '', lotacao: data?.lotacao || 'GERAL' };
}

export async function saveContrachequeDados(employeeId, { matricula, lotacao }) {
  const { error } = await supabase.from(TABELA).upsert(
    { employee_id: employeeId, matricula: matricula || null, lotacao: lotacao || 'GERAL', updated_at: new Date().toISOString() },
    { onConflict: 'employee_id' },
  );
  if (error) throw error;
}
