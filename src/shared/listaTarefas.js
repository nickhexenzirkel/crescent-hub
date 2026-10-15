/* Lista de Tarefas (Meus Lembretes) — dados, cronograma de faturamento e estatísticas.
   Tudo na tabela `settings` (chave/valor), sem SQL novo:
   - lista_tarefas:<nome>            → { tarefas, feitas }
   - cronograma_faturamento:<nome>   → { atualizado, desde, itens } (enviado pelo Controle de Clientes da Oficina Estelar)
   - colegas_setores                 → { nome: [setores] } (marcado no Portal → Colegas) */
import { supabase } from '../contexts/user';

const KEY_LISTA = 'lista_tarefas:';
const KEY_CRONO = 'cronograma_faturamento:';
const KEY_SETORES = 'colegas_setores';

export const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ── datas (sempre no fuso local, nunca toISOString, que vira o dia errado à noite) ── */
const p2 = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hojeIso = () => iso(new Date());
export const daIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDias = (s, n) => { const d = daIso(s); d.setDate(d.getDate() + n); return iso(d); };

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const parse = (v, padrao) => {
  if (v == null) return padrao;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return padrao; }
};

/* ── setor ── */
export const ehDoFaturamento = async (nome) => {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', KEY_SETORES).maybeSingle();
    const mapa = parse(data?.value, {});
    return (mapa[nome] || []).includes('faturamento');
  } catch { return false; }
};

/* ── lista pessoal ── */
export const listaVazia = () => ({ tarefas: [], feitas: {} });

export const carregarLista = async (nome) => {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', KEY_LISTA + nome).maybeSingle();
    const v = parse(data?.value, null);
    return v && Array.isArray(v.tarefas) ? { tarefas: v.tarefas, feitas: v.feitas || {} } : listaVazia();
  } catch { return listaVazia(); }
};

export const salvarLista = async (nome, lista) => {
  const { error } = await supabase.from('settings').upsert({ key: KEY_LISTA + nome, value: JSON.stringify(lista) }, { onConflict: 'key' });
  return !error;
};

/* Todas as listas (para o admin/moderador comparar a equipe). */
export const carregarTodasListas = async () => {
  try {
    const { data } = await supabase.from('settings').select('key,value').like('key', KEY_LISTA + '%');
    return (data || []).map((r) => ({ nome: r.key.slice(KEY_LISTA.length), lista: { ...listaVazia(), ...parse(r.value, {}) } }));
  } catch { return []; }
};

/* ── cronograma de faturamento (vem do Controle de Clientes) ── */
const DIA_POR_NOME = [['segunda', 1], ['terca', 2], ['quarta', 3], ['quinta', 4], ['sexta', 5]];

/* 'TERÇA E SEXTA' → [2, 5]; 'MENSAL', 'DECENDIAL', 'QUINZENAL', 'SOLICITAÇÃO' → [] (sem dia fixo da semana). */
export const diasDoPeriodo = (periodo) => {
  const t = norm(periodo);
  return DIA_POR_NOME.filter(([n]) => t.includes(n)).map(([, d]) => d);
};

/* Decendial: dias 1, 11 e 21; quinzenal: dias 1 e 16; mensal: dia 1. Cai em fim de semana → passa para a segunda-feira seguinte. */
export const diasDoMes = (periodo) => (norm(periodo).includes('decen') ? [1, 11, 21] : norm(periodo).includes('quinzen') ? [1, 16] : norm(periodo).includes('mensal') ? [1] : []);

const venceNoDia = (diasMes, dia) => {
  if (!diasMes.length) return false;
  const dt = daIso(dia); const dow = dt.getDay();
  if (dow === 0 || dow === 6) return false;
  const nominais = [dt.getDate()];
  if (dow === 1) nominais.push(addDias(dia, -1).slice(8) * 1, addDias(dia, -2).slice(8) * 1); // domingo e sábado anteriores
  return nominais.some((n) => diasMes.includes(n));
};

/* Chave = cliente + período: ABAST e MANUT do mesmo cliente no mesmo dia viram UMA tarefa só. */
export const chaveItem = (it) => `${norm(it.cliente)}|${norm(it.periodo)}`;

export const montarCronograma = (linhas) => juntarRepetidos(linhas.map((r) => ({
  k: chaveItem(r),
  cliente: String(r.cliente || '').trim().toUpperCase(),
  categoria: String(r.categoria || '').trim().toUpperCase(),
  periodo: String(r.periodo || '').trim().toUpperCase(),
  comercial: String(r.comercial || '').trim().toUpperCase(),
  metodo: String(r.metodo || '').trim().toUpperCase(),
  obs: String(r.obs || '').trim(),
  dias: diasDoPeriodo(r.periodo),
  diasMes: diasDoMes(r.periodo),
})));

/* Junta linhas repetidas (mesmo cliente e período): categorias viram 'ABAST/MANUT', sem duplicar. */
function juntarRepetidos(itens) {
  const mapa = new Map();
  for (const it of itens) {
    const ant = mapa.get(it.k);
    if (!ant) { mapa.set(it.k, { ...it }); continue; }
    const cats = [...new Set([...ant.categoria.split('/'), ...it.categoria.split('/')].map((x) => x.trim()).filter(Boolean))];
    ant.categoria = cats.join('/');
    if (it.metodo && !ant.metodo.includes(it.metodo)) ant.metodo = [ant.metodo, it.metodo].filter(Boolean).join(' / ');
    if (it.obs && !ant.obs.includes(it.obs)) ant.obs = [ant.obs, it.obs].filter(Boolean).join(' | ');
  }
  return [...mapa.values()];
}

export const carregarCronograma = async (nome) => {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', KEY_CRONO + nome).maybeSingle();
    const v = parse(data?.value, null);
    return v && Array.isArray(v.itens) ? { ...v, itens: juntarRepetidos(v.itens.map((i) => ({ ...i, k: chaveItem(i), diasMes: diasDoMes(i.periodo) }))) } : null; // também limpa duplicados de envios antigos
  } catch { return null; }
};

/* Guarda o cronograma. `desde` (1ª vez que foi enviado) evita contar como "não feito" os dias anteriores ao uso. */
export const salvarCronograma = async (nome, itens) => {
  try {
    const atual = await carregarCronograma(nome);
    const valor = { atualizado: new Date().toISOString(), desde: atual?.desde || hojeIso(), itens };
    const { error } = await supabase.from('settings').upsert({ key: KEY_CRONO + nome, value: JSON.stringify(valor) }, { onConflict: 'key' });
    return !error;
  } catch { return false; }
};

/* ── o que vale para um dia ── */
export const tarefaValeNoDia = (t, dia) => {
  if (t.criada && dia < t.criada) return false;
  if (t.removida && dia >= t.removida) return false;
  if (t.freq === 'unica') return t.data === dia;
  if (t.freq === 'semana') return (t.dias || []).includes(daIso(dia).getDay());
  return true; // diária
};

export const itensCronogramaDoDia = (crono, dia) => {
  if (!crono) return [];
  const dow = daIso(dia).getDay();
  return crono.itens.filter((it) => (it.dias || []).includes(dow) || venceNoDia(it.diasMes || [], dia));
};

/* Tudo do dia numa lista só: { id, tipo:'t'|'c', titulo, detalhe, feita } */
export const itensDoDia = (lista, crono, dia) => {
  const f = lista.feitas?.[dia] || { t: [], c: [] };
  const pessoais = lista.tarefas.filter((t) => tarefaValeNoDia(t, dia))
    .map((t) => ({ id: t.id, tipo: 't', titulo: t.titulo, detalhe: '', feita: (f.t || []).includes(t.id) }));
  const fat = itensCronogramaDoDia(crono, dia)
    .map((it) => ({ id: it.k, tipo: 'c', titulo: it.cliente, detalhe: [it.categoria, it.periodo, it.metodo].filter(Boolean).join(' · '), obs: it.obs, feita: (f.c || []).includes(it.k) }));
  return { pessoais, fat };
};

/* ── estatísticas ── */
export const resumoDia = (lista, crono, dia) => {
  const { pessoais, fat } = itensDoDia(lista, crono, dia);
  // antes do 1º envio do cronograma os dias só contam nas estatísticas se algo foi marcado
  const fatConta = crono?.desde && dia < crono.desde ? fat.filter((x) => x.feita) : fat;
  const todos = [...pessoais, ...fatConta];
  return { total: todos.length, feitas: todos.filter((x) => x.feita).length };
};

/* Soma dos dias de `ini` até `fim` (inclusive). Dias futuros não contam (ainda não dá para ter feito). */
export const resumoPeriodo = (lista, crono, ini, fim) => {
  const limite = hojeIso();
  let total = 0; let feitas = 0;
  for (let d = ini; d <= fim && d <= limite; d = addDias(d, 1)) {
    const r = resumoDia(lista, crono, d);
    total += r.total; feitas += r.feitas;
  }
  return { total, feitas };
};

export const pct = (r) => (r.total ? Math.round((r.feitas / r.total) * 100) : 0);

/* Barras: 'dia' = últimos 14 dias; 'mes' = últimos 12 meses; 'ano' = anos desde o primeiro registro. */
export const serie = (lista, crono, visao) => {
  const hoje = hojeIso();
  const out = [];
  if (visao === 'dia') {
    for (let i = 13; i >= 0; i--) {
      const d = addDias(hoje, -i);
      out.push({ rotulo: `${p2(daIso(d).getDate())}/${p2(daIso(d).getMonth() + 1)}`, sub: DIAS_CURTO[daIso(d).getDay()], ...resumoDia(lista, crono, d) });
    }
  } else if (visao === 'mes') {
    const base = new Date();
    for (let i = 11; i >= 0; i--) {
      const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const ini = iso(m); const fim = iso(new Date(m.getFullYear(), m.getMonth() + 1, 0));
      out.push({ rotulo: MESES[m.getMonth()].slice(0, 3), sub: String(m.getFullYear()), ...resumoPeriodo(lista, crono, ini, fim) });
    }
  } else {
    const anoAtual = new Date().getFullYear();
    const datas = [...lista.tarefas.map((t) => t.criada), crono?.desde, ...Object.keys(lista.feitas || {})].filter(Boolean).sort();
    const primeiro = datas.length ? Number(datas[0].slice(0, 4)) : anoAtual;
    for (let a = Math.min(primeiro, anoAtual); a <= anoAtual; a++) {
      out.push({ rotulo: String(a), sub: '', ...resumoPeriodo(lista, crono, `${a}-01-01`, `${a}-12-31`) });
    }
  }
  return out;
};
