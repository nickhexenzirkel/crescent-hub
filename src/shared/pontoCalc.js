// src/shared/pontoCalc.js
// Cálculo do banco de horas a partir das MARCAÇÕES de UM colaborador — mesma lógica do
// módulo admin (jornada 8h, tolerâncias), pra o colaborador ver o saldo/dias negativos
// direto das marcações, sem depender do admin ter processado/salvo o resumo.
import { supabase } from '../contexts/user';

const isWknd = iso => { try { const d = new Date(iso + 'T12:00:00').getDay(); return d === 0 || d === 6; } catch { return false; } };

const normName = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

// Resolve os CPFs do colaborador no ponto: o do perfil (e zero-padded) + os que casarem
// pelo NOME na ponto_funcionarios (contorna diferença de formato de CPF entre perfil e AFD).
export async function resolvePontoCpfs({ cpf, name }) {
  const cpfs = new Set();
  const c = (cpf || '').replace(/\D/g, '');
  if (c) { cpfs.add(c); cpfs.add(c.padStart(11, '0')); }
  try {
    const { data: funcs } = await supabase.from('ponto_funcionarios').select('cpf,nome');
    const my = normName(name);
    if (my) {
      const exact = [], partial = [];
      for (const f of (funcs || [])) {
        const fn = normName(f.nome);
        if (!fn || !f.cpf) continue;
        if (fn === my) exact.push(f.cpf);
        else if (fn.includes(my) || my.includes(fn)) partial.push(f.cpf);
      }
      (exact.length ? exact : partial).forEach(x => cpfs.add(x));
    }
  } catch {}
  return [...cpfs].filter(Boolean);
}

// Carrega marcações + justificativas do colaborador (resolvendo o CPF por nome se preciso).
export async function loadColaboradorPonto({ cpf, name }) {
  const cpfs = await resolvePontoCpfs({ cpf, name });
  if (!cpfs.length) return { marcacoes: [], justifs: [], cpfs: [] };
  const [mar, just] = await Promise.all([
    supabase.from('ponto_marcacoes').select('data,hora').in('cpf', cpfs).limit(3000),
    supabase.from('ponto_justificativas').select('data,texto,abonado,autor').in('cpf', cpfs),
  ]);
  return { marcacoes: mar.data || [], justifs: just.data || [], cpfs };
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
    const balance  = abonado ? 0
      : (!wknd && rawBal < 0 && Math.abs(rawBal) <= tolAtraso) ? 0
      : rawBal;
    return { date, times, totalMin, expected, balance, wknd, abonado };
  });
}
