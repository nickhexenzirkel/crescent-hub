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

/* ── calendário útil: sábado, domingo e feriado nacional acumulam para o próximo dia útil ── */
const pascoa = (ano) => { // Páscoa (algoritmo de Meeus/Jones/Butcher)
  const a = ano % 19; const b = Math.floor(ano / 100); const c = ano % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30; const i = Math.floor(c / 4); const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); const dd = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dd);
};
const feriadosCache = {};
export const feriadosDoAno = (ano) => {
  if (feriadosCache[ano]) return feriadosCache[ano];
  const set = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map((x) => `${ano}-${x}`));
  const p = pascoa(ano);
  [-48, -47, -2, 60].forEach((n) => { const d = new Date(p); d.setDate(d.getDate() + n); set.add(iso(d)); }); // carnaval (2 dias), sexta-feira santa, corpus christi
  feriadosCache[ano] = set;
  return set;
};
export const ehFeriado = (dia) => feriadosDoAno(Number(dia.slice(0, 4))).has(dia);
export const ehUtil = (dia) => { const w = daIso(dia).getDay(); return w !== 0 && w !== 6 && !ehFeriado(dia); };
const addUteis = (dia, n) => { let d = dia; let c = 0; while (c < n) { d = addDias(d, 1); if (ehUtil(d)) c++; } return d; };

/* Prazo, em dias úteis depois do vencimento, em que a tarefa continua valendo (acumulada) antes de contar como não feita. */
export const PRAZO_UTEIS = { semanal: 1, decendial: 5, quinzenal: 7, mensal: 10 };
const prazoDias = (it) => {
  const t = norm(it.periodo);
  return t.includes('mensal') ? PRAZO_UTEIS.mensal : t.includes('quinzen') ? PRAZO_UTEIS.quinzenal : t.includes('decen') ? PRAZO_UTEIS.decendial : PRAZO_UTEIS.semanal;
};

/* A data "de calendário" do período cai em x? (dia da semana ou dia do mês) */
const nominalCai = (it, x) => (it.dias || []).includes(daIso(x).getDay()) || (it.diasMes || []).includes(daIso(x).getDate());

/* O item vence neste dia útil? Inclui o que caiu em sábado/domingo/feriado imediatamente antes. */
const vencimentoNoDia = (it, dia) => {
  if (!ehUtil(dia)) return false;
  if (nominalCai(it, dia)) return true;
  for (let d = addDias(dia, -1); !ehUtil(d); d = addDias(d, -1)) if (nominalCai(it, d)) return true;
  return false;
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

/* Quando cada ocorrência (cliente + data de vencimento) foi concluída: Map 'k@vencimento' → dia em que foi marcada.
   Marcas antigas (só 'k', feitas no próprio dia) valem para o vencimento daquele dia. */
const idxCache = new WeakMap();
const indiceFeitas = (lista) => {
  const ref = lista.feitas || {};
  let m = idxCache.get(ref);
  if (m) return m;
  m = new Map();
  for (const [dia, f] of Object.entries(ref)) {
    for (const id of (f.c || [])) {
      const chave = id.includes('@') ? id : `${id}@${dia}`;
      if (!m.has(chave) || dia < m.get(chave)) m.set(chave, dia);
    }
  }
  idxCache.set(ref, m);
  return m;
};

/* Ocorrências do cronograma para um dia: as que vencem nele e — olhando o dia de hoje — as que ficaram
   pendentes de dias úteis anteriores e ainda estão no prazo (acumuladas). Concluída em outro dia some da lista. */
export const ocorrenciasDoDia = (lista, crono, dia, acumular = true) => {
  if (!crono) return [];
  const idx = indiceFeitas(lista);
  const out = []; const vistos = new Set();
  const add = (it, due) => {
    const id = `${it.k}@${due}`;
    if (vistos.has(id)) return;
    vistos.add(id);
    out.push({ it, due, id, feitaEm: idx.get(id) || null });
  };
  for (const it of crono.itens) if (vencimentoNoDia(it, dia)) add(it, dia);
  if (acumular && dia === hojeIso()) {
    const ini = crono.desde || addDias(dia, -30);
    for (let x = addDias(dia, -1), n = 0; n < 45 && x >= ini; x = addDias(x, -1), n++) {
      if (!ehUtil(x)) continue;
      for (const it of crono.itens) {
        if (!vencimentoNoDia(it, x)) continue;
        const feitaEm = idx.get(`${it.k}@${x}`);
        if (feitaEm ? feitaEm === dia : addUteis(x, prazoDias(it)) >= dia) add(it, x);
      }
    }
  }
  return out;
};

/* Tudo do dia numa lista só: { id, tipo:'t'|'c', titulo, detalhe, feita, due?, atrasada? } */
export const itensDoDia = (lista, crono, dia) => {
  const f = lista.feitas?.[dia] || { t: [], c: [] };
  const pessoais = lista.tarefas.filter((t) => tarefaValeNoDia(t, dia))
    .map((t) => ({ id: t.id, tipo: 't', titulo: t.titulo, detalhe: '', feita: (f.t || []).includes(t.id) }));
  const fat = ocorrenciasDoDia(lista, crono, dia)
    .map((o) => ({ id: o.id, tipo: 'c', titulo: o.it.cliente, detalhe: [o.it.categoria, o.it.periodo, o.it.metodo].filter(Boolean).join(' · '), obs: o.it.obs, feita: !!o.feitaEm, due: o.due, atrasada: o.due < dia }));
  return { pessoais, fat };
};

/* Marca/desmarca. Cliente concluído conta no dia do VENCIMENTO, mesmo feito dias depois (dentro do prazo). */
export const alternarFeita = (lista, item, dia) => {
  const feitas = { ...(lista.feitas || {}) };
  const campo = item.tipo;
  if (item.feita) {
    if (campo === 't') {
      const f = feitas[dia] || { t: [], c: [] };
      feitas[dia] = { ...f, t: (f.t || []).filter((x) => x !== item.id) };
    } else {
      const antigo = item.id.split('@')[0];
      for (const [d, f] of Object.entries(feitas)) {
        const arr = f.c || [];
        const rem = arr.filter((x) => x !== item.id && !(x === antigo && d === item.due));
        if (rem.length !== arr.length) feitas[d] = { ...f, c: rem };
      }
    }
  } else {
    const f = feitas[dia] || { t: [], c: [] };
    feitas[dia] = { ...f, [campo]: [...(f[campo] || []), item.id] };
  }
  return { ...lista, feitas };
};

/* ── estatísticas ──
   Pessoais: contam no próprio dia. Faturamento: contam no dia do vencimento; ainda dentro do prazo e sem
   marcar, NÃO contam como não feitas (continuam acumuladas); depois do prazo viram não feitas. */
export const resumoDia = (lista, crono, dia) => {
  const hoje = hojeIso();
  const f = lista.feitas?.[dia] || { t: [] };
  const pess = lista.tarefas.filter((t) => tarefaValeNoDia(t, dia));
  let total = pess.length; let feitas = pess.filter((t) => (f.t || []).includes(t.id)).length;
  for (const o of ocorrenciasDoDia(lista, crono, dia, false)) {
    const antesDoUso = crono?.desde && dia < crono.desde;
    const expirou = addUteis(o.due, prazoDias(o.it)) < hoje;
    if (o.feitaEm) { total++; feitas++; } else if (!antesDoUso && (dia === hoje || expirou)) total++;
  }
  return { total, feitas };
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
