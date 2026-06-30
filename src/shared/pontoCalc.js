// src/shared/pontoCalc.js
// Cálculo do banco de horas a partir das MARCAÇÕES de UM colaborador — mesma lógica do
// módulo admin (jornada 8h, tolerâncias), pra o colaborador ver o saldo/dias negativos
// direto das marcações, sem depender do admin ter processado/salvo o resumo.
import { supabase } from '../contexts/user';

const isWknd = iso => { try { const d = new Date(iso + 'T12:00:00').getDay(); return d === 0 || d === 6; } catch { return false; } };

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
  const [mar, just] = await Promise.all([
    supabase.from('ponto_marcacoes').select('cpf,data,hora').in('cpf', cpfs).limit(3000),
    supabase.from('ponto_justificativas').select('cpf,data,texto,abonado,autor').in('cpf', cpfs),
  ]);
  const marcacoes = mar.data || [];
  // id do ponto = cpf mais frequente nas marcações
  const freq = {};
  for (const m of marcacoes) if (m.cpf) freq[m.cpf] = (freq[m.cpf] || 0) + 1;
  const pontoCpf = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || cpfs[0] || '';
  return { marcacoes, justifs: just.data || [], cpfs, pontoCpf };
}

export const PONTO_DEFAULTS = { jornada: 480, tolerance: 1, toleranciaAtraso: 10 };

// marcacoes: [{data:'YYYY-MM-DD', hora:'HH:MM(:SS)'}]; abonadoDates: Set de 'YYYY-MM-DD'.
// Devolve dias ASC: [{date, times[], totalMin, expected, balance(min), wknd, abonado}].
export function computePontoDays(marcacoes, abonadoDates = new Set(), cfg = {}) {
  const jornada   = cfg.jornada ?? PONTO_DEFAULTS.jornada;
  const tolerance = cfg.tolerance ?? PONTO_DEFAULTS.tolerance;
  const tolAtraso = cfg.toleranciaAtraso ?? PONTO_DEFAULTS.toleranciaAtraso;

  const byDay = {};
  for (const m of (marcacoes || [])) {
    if (!m?.data) continue;
    (byDay[m.data] = byDay[m.data] || []).push((m.hora || '').slice(0, 5));
  }

  return Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, raw]) => {
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
    return { date, times, totalMin, expected, balance, rawBalance: baseBal, wknd, abonado };
  });
}
