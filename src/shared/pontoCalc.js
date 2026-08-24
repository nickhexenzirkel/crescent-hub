// src/shared/pontoCalc.js
// Cálculo do banco de horas a partir das MARCAÇÕES de UM colaborador — mesma lógica do
// módulo admin (jornada 8h, tolerâncias), pra o colaborador ver o saldo/dias negativos
// direto das marcações, sem depender do admin ter processado/salvo o resumo.
import { supabase } from '../contexts/user';

const isWknd = iso => { try { const d = new Date(iso + 'T12:00:00').getDay(); return d === 0 || d === 6; } catch { return false; } };

// ── Feriados nacionais do Brasil (fixos + móveis via Páscoa) — mesma lógica do módulo
//    admin, pra não gerar falta em dia que a empresa não abre. ──
const _toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const _easter = (year) => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};
const _holCache = {};
const _holidays = (year) => {
  if (_holCache[year]) return _holCache[year];
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const easter = _easter(year);
  const fixed = [`${year}-01-01`, `${year}-04-21`, `${year}-05-01`, `${year}-09-07`, `${year}-10-12`, `${year}-11-02`, `${year}-11-15`, `${year}-11-20`, `${year}-12-25`];
  const moving = [_toISO(addDays(easter, -47)), _toISO(addDays(easter, -2)), _toISO(addDays(easter, 60))];
  return (_holCache[year] = new Set([...fixed, ...moving]));
};
const isHoliday = iso => { try { return _holidays(+iso.slice(0, 4)).has(iso); } catch { return false; } };
// Dia sem expediente (não gera falta): fim de semana OU feriado nacional.
const isDayOff = iso => isWknd(iso) || isHoliday(iso);

const normName = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
const tok = s => normName(s).split(' ').filter(t => t.length >= 2);
const subset = (a, b) => a.length >= 2 && a.every(t => b.includes(t)); // todos os tokens de a estão em b

// Resolve o identificador do colaborador no ponto. IMPORTANTE: no AFD o número costuma ser
// PIS/PASEP (≠ CPF do cadastro), então o vínculo confiável é pelo NOME (ponto_funcionarios).
// Devolve: CPF do perfil (e zero-padded, caso o AFD use CPF) + o MELHOR match único por nome.
export async function resolvePontoCpfs({ cpf, name }) {
  const cpfs = new Set();
  const c = (cpf || '').replace(/\D/g, '');
  // 1) VÍNCULO explícito (RH ligou Portal ↔ ponto) — fonte da verdade
  if (c) {
    try {
      const { data: v } = await supabase.from('ponto_vinculo').select('ponto_id').eq('portal_cpf', c).maybeSingle();
      if (v?.ponto_id) cpfs.add(v.ponto_id);
    } catch {}
  }
  if (c) { cpfs.add(c); cpfs.add(c.padStart(11, '0')); }
  try {
    const { data: funcs } = await supabase.from('ponto_funcionarios').select('cpf,nome');
    const my = normName(name);
    const myTok = tok(name);
    if (my && (funcs || []).length) {
      let best = null, bestScore = -1;
      for (const f of funcs) {
        if (!f.cpf) continue;
        const fNorm = normName(f.nome);
        const fTok = tok(f.nome);
        let score = -1;
        if (fNorm && fNorm === my) score = 1000;                       // nome idêntico
        else if (subset(myTok, fTok) || subset(fTok, myTok))            // um nome contém todos os tokens do outro
          score = Math.min(myTok.length, fTok.length) * 10 - Math.abs(myTok.length - fTok.length);
        if (score > bestScore) { bestScore = score; best = f.cpf; }
      }
      if (best && bestScore >= 0) cpfs.add(best);
    }
  } catch {}
  return [...cpfs].filter(Boolean);
}

// Carrega marcações + justificativas do colaborador (resolvendo o id por vínculo/nome).
// pontoCpf = o identificador (PIS) que de fato tem marcações — usado pra abonar o dia certo.
export async function loadColaboradorPonto({ cpf, name }) {
  const cpfs = await resolvePontoCpfs({ cpf, name });
  if (!cpfs.length) return { marcacoes: [], justifs: [], cpfs: [], pontoCpf: '' };
  // Justificativas tolerando o banco AINDA sem as colunas de anexo (migration
  // supabase_ponto_justificativa_anexo.sql não rodada) → recarrega sem elas.
  const fetchJust = async () => {
    const full = await supabase.from('ponto_justificativas').select('cpf,data,texto,abonado,autor,file_url,file_name').in('cpf', cpfs);
    if (full.error?.code === '42703') return supabase.from('ponto_justificativas').select('cpf,data,texto,abonado,autor').in('cpf', cpfs);
    return full;
  };
  const [mar, just] = await Promise.all([
    supabase.from('ponto_marcacoes').select('cpf,data,hora').in('cpf', cpfs).limit(3000),
    fetchJust(),
  ]);
  const marcacoes = mar.data || [];
  // id do ponto = cpf mais frequente nas marcações
  const freq = {};
  for (const m of marcacoes) if (m.cpf) freq[m.cpf] = (freq[m.cpf] || 0) + 1;
  const pontoCpf = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || cpfs[0] || '';
  // Até onde os dados do ponto vão NO SISTEMA (última marcação de QUALQUER
  // pessoa). É o limite honesto pra contar falta: além disso o lote ainda não
  // foi importado, então o dia não é falta — é dia sem dado.
  // Sem isso o corte era a última marcação DA PRÓPRIA PESSOA, e quem faltou/
  // se afastou depois dela simplesmente não via esses dias (bug real: a
  // colaboradora tinha afastamento em dias posteriores à última batida dela e
  // eles não apareciam, embora o RH os tivesse lançado).
  let limiteISO = '';
  try {
    const { data: ult } = await supabase.from('ponto_marcacoes').select('data').order('data', { ascending: false }).limit(1);
    limiteISO = ult?.[0]?.data || '';
  } catch { /* sem limite global: cai no comportamento antigo */ }
  return { marcacoes, justifs: just.data || [], cpfs, pontoCpf, limiteISO };
}

export const PONTO_DEFAULTS = { jornada: 480, tolerance: 1, toleranciaAtraso: 10 };

// marcacoes: [{data:'YYYY-MM-DD', hora:'HH:MM(:SS)'}]; abonadoDates: Set de 'YYYY-MM-DD'.
// Devolve dias ASC: [{date, times[], totalMin, expected, balance(min), wknd, abonado, falta}].
// Além dos dias COM marcação, gera os dias úteis SEM nenhuma marcação (faltas) da 1ª
// marcação até o fim da janela, pra que o colaborador veja/justifique — do contrário
// esses dias somem do cálculo e a falta nunca aparece.
// cfg.limiteISO = até onde os dados do ponto vão no sistema (última marcação de QUALQUER
// pessoa, ver loadColaboradorPonto). Passe sempre que tiver: sem isso a janela para na
// última batida da própria pessoa e quem faltou/se afastou depois some da tela.
export function computePontoDays(marcacoes, abonadoDates = new Set(), cfg = {}) {
  const jornada   = cfg.jornada ?? PONTO_DEFAULTS.jornada;
  const tolerance = cfg.tolerance ?? PONTO_DEFAULTS.tolerance;
  const tolAtraso = cfg.toleranciaAtraso ?? PONTO_DEFAULTS.toleranciaAtraso;

  const byDay = {};
  for (const m of (marcacoes || [])) {
    if (!m?.data) continue;
    (byDay[m.data] = byDay[m.data] || []).push((m.hora || '').slice(0, 5));
  }

  const markedDays = Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, raw]) => {
    const times = raw.filter(Boolean).sort();
    let totalMin = 0;
    for (let i = 0; i < times.length; i += 2) {
      if (i + 1 < times.length) {
        const [eh, em] = times[i].split(':').map(Number);
        const [xh, xm] = times[i + 1].split(':').map(Number);
        const diff = (xh * 60 + xm) - (eh * 60 + em);
        totalMin += (diff > 0 && diff < tolerance) ? 0 : Math.max(0, diff);
      }
    }
    const wknd     = isWknd(date);
    const expected = wknd ? 0 : jornada;
    const rawBal   = totalMin - expected;
    const abonado  = abonadoDates.has(date);
    const baseBal  = (!wknd && rawBal < 0 && Math.abs(rawBal) <= tolAtraso) ? 0 : rawBal; // antes do abono
    const balance  = abonado ? 0 : baseBal;
    return { date, times, totalMin, expected, balance, rawBalance: baseBal, wknd, abonado, falta: false };
  });

  // ── Faltas: dias úteis (seg–sex, sem feriado) sem NENHUMA marcação, entre a 1ª e a
  //    última marcação do colaborador (limitado a hoje). Saldo = -jornada (0 se abonado). ──
  const faltaDays = [];
  const datas = Object.keys(byDay).sort();
  if (datas.length) {
    const todayISO = _toISO(new Date());
    const firstMark = datas[0];
    const lastMark  = datas[datas.length - 1];
    // Fim da janela: o mais LONGE entre a última batida da pessoa, o limite
    // global de dados (cfg.limiteISO) e o último dia que tem justificativa
    // dela — sempre limitado a hoje. Parar na última batida da PRÓPRIA pessoa
    // escondia quem faltou/se afastou depois disso (era o bug); o limite
    // global evita o oposto, inventar falta em dia que ainda não foi importado.
    const ultimaJustif = [...abonadoDates].sort().pop() || '';
    let endISO = [lastMark, cfg.limiteISO || '', ultimaJustif].filter(Boolean).sort().pop();
    if (endISO > todayISO) endISO = todayISO;
    let cursor = new Date(firstMark + 'T12:00:00');
    const end  = new Date(endISO + 'T12:00:00');
    while (cursor <= end) {
      const date = _toISO(cursor);
      if (!byDay[date] && !isDayOff(date)) {
        const abonado = abonadoDates.has(date);
        faltaDays.push({
          date, times: [], totalMin: 0, expected: jornada,
          balance: abonado ? 0 : -jornada, rawBalance: -jornada,
          wknd: false, abonado, falta: true,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return [...markedDays, ...faltaDays].sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));
}
