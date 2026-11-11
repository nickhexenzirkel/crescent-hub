import { supabase } from '../contexts/user';

export const FATURAMENTO_COMERCIAIS_KEY = 'faturamento_comerciais';
export const FATURAMENTO_CORES_REGIONAIS_KEY = 'faturamento_cores_regionais';
export const FATURAMENTO_VINCULOS_REGIONAIS_KEY = 'faturamento_vinculos_regionais';
export const FATURAMENTO_NOTIFICACOES_ESTADO_KEY = 'faturamento_notificacoes_estado';
const EVENTO = 'uniko-faturamento-comerciais';

export const REGIONAIS_FATURAMENTO = [
  { nome: 'Cleber', aliases: ['cleber', 'cléber'], cor: '#E53935' },
  { nome: 'Henrique (Aurontech)', aliases: ['henrique aurontech', 'aurontech', 'arountech'], cor: '#00BCD4' },
  { nome: 'Klayton', aliases: ['klayton', 'klayon'], cor: '#7E57C2' },
  { nome: 'Marcos', aliases: ['marcos'], cor: '#E91E63' },
  { nome: 'Mikael', aliases: ['mikael'], cor: '#222222' },
  { nome: 'Raniere', aliases: ['raniere'], cor: '#F4C430' },
  { nome: 'Rene', aliases: ['rene', 'rené'], cor: '#64B5F6' },
  { nome: 'Renato', aliases: ['renato'], cor: '#808080' },
  { nome: 'Sr Junior', aliases: ['sr junior', 'senhor junior'], cor: '#A85D24' },
  { nome: 'Thiago Intech', aliases: ['thiago intech', 'intech'], cor: '#142B5E' },
];

export function normalizarCadastroFaturamento(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function nomeRegionalFaturamento(valor) {
  const nome = String(valor || '').trim().replace(/^regional\s+/i, '');
  const chave = normalizarCadastroFaturamento(nome);
  return REGIONAIS_FATURAMENTO.find(regional => regional.aliases.some(alias => normalizarCadastroFaturamento(alias) === chave))?.nome || nome;
}

export function chaveRegionalFaturamento(valor) {
  return normalizarCadastroFaturamento(nomeRegionalFaturamento(valor));
}

export function corPadraoRegional(valor) {
  const chave = chaveRegionalFaturamento(valor);
  return REGIONAIS_FATURAMENTO.find(regional => chaveRegionalFaturamento(regional.nome) === chave)?.cor || '#087EAA';
}

function lerCadastro(valor) {
  let parsed = valor;
  try {
    if (typeof valor === 'string') parsed = JSON.parse(valor);
  } catch {
    throw new Error('O cadastro de comerciais está corrompido. Corrija os dados antes de salvar.');
  }
  if (parsed == null) return [];
  if (!Array.isArray(parsed.clientes)) {
    throw new Error('O cadastro de comerciais está corrompido. Corrija os dados antes de salvar.');
  }
  return parsed.clientes
    .filter(item => item && typeof item.municipio === 'string' && item.municipio.trim())
    .map(item => ({
      municipio: item.municipio.trim(),
      regional: typeof item.regional === 'string' && item.regional.trim()
        ? item.regional.trim()
        : typeof item.comercial === 'string' ? item.comercial.trim() : '',
      responsavelFaturamento: typeof item.responsavelFaturamento === 'string' ? item.responsavelFaturamento.trim() : '',
    }));
}

function lerCoresRegionais(valor) {
  let parsed = valor;
  try {
    if (typeof valor === 'string') parsed = JSON.parse(valor);
  } catch {
    throw new Error('As cores das regionais estão corrompidas. Corrija os dados antes de salvar.');
  }
  if (parsed == null) return {};
  const cores = parsed.cores && typeof parsed.cores === 'object' && !Array.isArray(parsed.cores) ? parsed.cores : parsed;
  return Object.fromEntries(Object.entries(cores)
    .filter(([nome, cor]) => nome && /^#[0-9a-f]{6}$/i.test(cor || ''))
    .map(([nome, cor]) => [chaveRegionalFaturamento(nome), cor]));
}

function lerVinculosRegionais(valor) {
  let parsed = valor;
  try {
    if (typeof valor === 'string') parsed = JSON.parse(valor);
  } catch {
    throw new Error('Os vínculos das regionais estão corrompidos. Corrija os dados antes de salvar.');
  }
  if (parsed == null) return {};
  const vinculos = parsed.vinculos && typeof parsed.vinculos === 'object' && !Array.isArray(parsed.vinculos)
    ? parsed.vinculos
    : parsed;
  if (typeof vinculos !== 'object' || Array.isArray(vinculos)) {
    throw new Error('Os vínculos das regionais estão corrompidos. Corrija os dados antes de salvar.');
  }
  return Object.fromEntries(Object.entries(vinculos)
    .filter(([regional, userId]) => regional && typeof userId === 'string' && userId.trim())
    .map(([regional, userId]) => [chaveRegionalFaturamento(regional), userId.trim()]));
}

export async function carregarCadastroFaturamento() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', FATURAMENTO_COMERCIAIS_KEY)
    .maybeSingle();
  if (error) throw error;
  return lerCadastro(data?.value);
}

export async function carregarVinculosRegionaisFaturamento() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', FATURAMENTO_VINCULOS_REGIONAIS_KEY)
    .maybeSingle();
  if (error) throw error;
  return lerVinculosRegionais(data?.value);
}

export async function salvarVinculosRegionaisFaturamento(vinculos) {
  const limpos = lerVinculosRegionais({ vinculos });
  const { error } = await supabase.from('settings').upsert({
    key: FATURAMENTO_VINCULOS_REGIONAIS_KEY,
    value: JSON.stringify({ vinculos: limpos, updatedAt: new Date().toISOString() }),
  }, { onConflict: 'key' });
  if (error) throw error;
  return limpos;
}

export async function carregarEstadoNotificacoesFaturamento(mailbox) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', FATURAMENTO_NOTIFICACOES_ESTADO_KEY)
    .maybeSingle();
  if (error) throw error;
  let estado = data?.value;
  try {
    if (typeof estado === 'string') estado = JSON.parse(estado);
  } catch {
    throw new Error('O estado das notificações de faturamento está corrompido.');
  }
  if (!estado || estado.mailbox !== mailbox || !Number.isFinite(Date.parse(estado.iniciadoEm || ''))) return null;
  return estado;
}

export async function salvarEstadoNotificacoesFaturamento(mailbox, iniciadoEm) {
  const { error } = await supabase.from('settings').upsert({
    key: FATURAMENTO_NOTIFICACOES_ESTADO_KEY,
    value: JSON.stringify({ mailbox, iniciadoEm }),
  }, { onConflict: 'key' });
  if (error) throw error;
}

export async function emitirNotificacaoFaturamento({
  messageId, threadId, mailbox, recipientId, municipio, regional, faturista, faturadoEm,
}) {
  const horario = new Date(faturadoEm);
  if (!messageId || !mailbox || !recipientId || !municipio || Number.isNaN(horario.getTime())) return false;
  const horarioFormatado = horario.toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const { error } = await supabase.from('notifications').insert({
    type: 'faturamento_regional',
    title: `Faturamento realizado: ${municipio}`,
    message: `${municipio} foi faturado em ${horarioFormatado} por ${faturista || 'faturista não identificado'}${regional ? ` · Regional ${regional}` : ''}.`,
    active: true,
    recipient_id: recipientId,
    source_id: `faturamento:${mailbox}:${threadId || messageId}`,
  });
  if (error?.code === '23505') return false;
  if (error) throw error;
  return true;
}

export async function carregarCoresRegionais() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', FATURAMENTO_CORES_REGIONAIS_KEY)
    .maybeSingle();
  if (error) throw error;
  return lerCoresRegionais(data?.value);
}

export async function salvarCoresRegionais(cores) {
  const limpas = lerCoresRegionais({ cores });
  const { error } = await supabase.from('settings').upsert({
    key: FATURAMENTO_CORES_REGIONAIS_KEY,
    value: JSON.stringify({ cores: limpas, updatedAt: new Date().toISOString() }),
  }, { onConflict: 'key' });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent(EVENTO));
  return limpas;
}

export async function salvarCadastroFaturamento(clientes) {
  const limpos = lerCadastro({ clientes });
  const municipios = new Set();
  for (const cliente of limpos) {
    const chave = normalizarCadastroFaturamento(cliente.municipio);
    if (municipios.has(chave)) {
      throw new Error(`O município ${cliente.municipio} já está cadastrado.`);
    }
    municipios.add(chave);
  }
  const { error } = await supabase.from('settings').upsert({
    key: FATURAMENTO_COMERCIAIS_KEY,
    value: JSON.stringify({ clientes: limpos, updatedAt: new Date().toISOString() }),
  }, { onConflict: 'key' });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent(EVENTO));
  return limpos;
}

export function ouvirCadastroFaturamento(callback) {
  window.addEventListener(EVENTO, callback);
  return () => window.removeEventListener(EVENTO, callback);
}
