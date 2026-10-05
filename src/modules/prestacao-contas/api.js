// Prestações de Contas — acesso ao Supabase (tabela prestacoes_contas + bucket
// privado prestacao-anexos). Ver supabase_prestacao_contas.sql.
import { supabase } from '../../contexts/user';

export const CATEGORIAS = [
  { id: 'Alimentação',         cor: '#E8903A' },
  { id: 'Transporte',          cor: '#3B82C4' },
  { id: 'Combustível',         cor: '#C94F4F' },
  { id: 'Hospedagem',          cor: '#7C5CC4' },
  { id: 'Estacionamento/Pedágio', cor: '#2FA39A' },
  { id: 'Material/Brinde',     cor: '#C4A23B' },
  { id: 'Cliente/Evento',      cor: '#D6568F' },
  { id: 'Outros',              cor: '#7F8A99' },
];
export const corCategoria = (c) => CATEGORIAS.find(x => x.id === c)?.cor || '#7F8A99';

export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtData = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const TABLE = 'prestacoes_contas';
const BUCKET = 'prestacao-anexos';

// employeeId: só as do funcionário; omitido = todas (RH).
export async function listarPrestacoes(employeeId) {
  let q = supabase.from(TABLE).select('*').order('data_gasto', { ascending: false }).order('created_at', { ascending: false });
  if (employeeId) q = q.eq('employee_id', String(employeeId));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function enviarAnexo(file, cpf) {
  const ext = (file.name.split('.').pop() || 'dat').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const path = `${cpf || 'anon'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error('Falha ao enviar o anexo: ' + error.message);
  return { name: file.name, path, type: file.type || '', size: file.size };
}

export async function urlAnexo(anexo) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.path, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function criarPrestacao(row) {
  const { data, error } = await supabase.from(TABLE).insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function excluirPrestacao(p) {
  const { error } = await supabase.from(TABLE).delete().eq('id', p.id);
  if (error) throw new Error(error.message);
  const paths = (p.anexos || []).map(a => a.path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}
