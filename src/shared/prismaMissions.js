// ── Missões da Prisma Store — fonte ÚNICA (definições + cálculo de progresso ao vivo) ──
// Usado pela Prisma Store (mercado-estelar) e pelo widget "Missões em andamento" do Portal.
//
// A DEFINIÇÃO das missões (título, meta, recompensa) mora na tabela
// `mercado_missions` e é editada pelo admin em Administrador → Missões
// (ver supabase_uniko_missoes.sql). DEFAULT_MISSIONS aqui é só a semente da
// primeira vez / fallback quando o banco não responde.
//
// COMO SE MEDE O PROGRESSO: cada missão tem uma `metric` (ver MISSION_METRICS).
// É o que permite o admin criar "Jogue 15 min no Uniko Paint" sem tocar em
// código — ele escolhe a métrica `playtime`, o jogo, a meta e a recompensa.
import { supabase } from '../contexts/user';
import { countOwnedUnikos } from './captureUniko';
import { fetchPlaytimeSeconds, fetchPlaytimeSecondsBulk, PLAYTIME_GAMES, GAME_LABEL } from './gamePlaytime';

export { PLAYTIME_GAMES, GAME_LABEL };

const _today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isSysDj = (n) => {
  const rb = (n || '').trim().toLowerCase();
  return !rb || rb.includes('autoplay') || rb.includes('sistema') || rb.includes('uniko') || rb.includes('alexa');
};

// ── Métricas disponíveis (é o menu que o admin vê ao criar/editar uma missão) ──
// `game`  = a métrica pergunta em qual jogo contar
// `param` = rótulo do parâmetro extra (null = não usa)
// `cumulative` = o "Zerar missões" do admin precisa tirar um snapshot dela
export const MISSION_METRICS = [
  { id: 'playtime', label: 'Minutos jogados',        unit: 'minutos',  game: true,  param: null,      cumulative: true,
    hint: 'Conta o tempo de partida no jogo escolhido. A meta é em MINUTOS.' },
  { id: 'compras',  label: 'Compras na loja',        unit: 'compras',  game: false, param: null,      cumulative: false,
    hint: 'Total de prêmios/Unikos já comprados na Prisma Store.' },
  { id: 'colecao',  label: 'Unikos na Coleção',      unit: 'Unikos',   game: false, param: null,      cumulative: false,
    hint: 'Quantos Unikos o colaborador possui (padrão + capturados + comprados).' },
  { id: 'feedback', label: 'Feedbacks enviados',     unit: 'feedbacks',game: false, param: null,      cumulative: true,
    hint: 'Feedbacks não anônimos enviados pelo colaborador no período.' },
  { id: 'rank_mes', label: 'Top do mês (Alexa)',     unit: '—',        game: false, param: 'Posição', cumulative: false,
    hint: 'Posição de quem mais colocou música no mês PASSADO (já fechado). Meta fica em 1.' },
  { id: 'manual',   label: 'Manual / sem medição',   unit: '—',        game: false, param: null,      cumulative: false,
    hint: 'O progresso não é calculado automaticamente — use junto com "Em manutenção".' },
];
export const METRIC_META = Object.fromEntries(MISSION_METRICS.map(m => [m.id, m]));

export const MISSION_PERIODS = [
  { id: 'dia',   label: 'Diária',  hint: 'Reinicia todo dia' },
  { id: 'mes',   label: 'Mensal',  hint: 'Reinicia todo mês' },
  { id: 'unica', label: 'Única',   hint: 'Resgata uma vez só' },
];

// Missões-semente. progress/claimed são por usuário; o resto é a DEFINIÇÃO.
export const DEFAULT_MISSIONS = [
  // ── DIÁRIAS ──
  { id: 'c_uniko20',   title: 'Maratona Uniko Wave',  desc: 'Jogue 20 minutos no Uniko Wave',                      period: 'dia',   metric: 'playtime', game: 'wave', param: 0, goal: 20, comum: 100, premium: 0,   progress: 0, claimed: false },
  { id: 'c_uniko40',   title: 'Maratona Uniko Wave',  desc: 'Jogue 40 minutos no Uniko Wave',                      period: 'dia',   metric: 'playtime', game: 'wave', param: 0, goal: 40, comum: 0,   premium: 10,  progress: 0, claimed: false },
  // ── MENSAIS ──
  { id: 'c_feedback',  title: 'Voz ativa',            desc: 'Dê um feedback no sistema',                           period: 'mes',   metric: 'feedback', game: 'any',  param: 0, goal: 1,  comum: 0,   premium: 30,  progress: 0, claimed: false },
  { id: 'c_rank1',     title: '🥇 Top 1 do mês',       desc: '1º lugar de quem mais colocou música no mês passado', period: 'mes',   metric: 'rank_mes', game: 'any',  param: 1, goal: 1,  comum: 0,   premium: 100, progress: 0, claimed: false },
  { id: 'c_rank2',     title: '🥈 Top 2 do mês',       desc: '2º lugar de quem mais colocou música no mês passado', period: 'mes',   metric: 'rank_mes', game: 'any',  param: 2, goal: 1,  comum: 0,   premium: 70,  progress: 0, claimed: false },
  { id: 'c_rank3',     title: '🥉 Top 3 do mês',       desc: '3º lugar de quem mais colocou música no mês passado', period: 'mes',   metric: 'rank_mes', game: 'any',  param: 3, goal: 1,  comum: 0,   premium: 50,  progress: 0, claimed: false },
  { id: 'c_setor',     title: 'Setor nota 90+',       desc: 'Seu setor passou de 90% no chatbot do mês',           period: 'mes',   metric: 'manual',   game: 'any',  param: 0, goal: 1,  comum: 500, premium: 0,   progress: 0, claimed: false, maintenance: true },
  // ── ESPECIAIS (única vez) ──
  { id: 'c_firstbuy',      title: 'Primeira compra',      desc: 'Faça sua primeira compra na Prisma Store', period: 'unica', metric: 'compras', game: 'any', param: 0, goal: 1,  comum: 200, premium: 0,  progress: 0, claimed: false },
  { id: 'c_secondbuy',     title: 'Segunda compra',       desc: 'Faça sua segunda compra na Prisma Store',  period: 'unica', metric: 'compras', game: 'any', param: 0, goal: 2,  comum: 400, premium: 0,  progress: 0, claimed: false },
  { id: 'c_colec_pequeno', title: 'Pequeno Colecionador', desc: 'Tenha 10 Unikos na sua Coleção',           period: 'unica', metric: 'colecao', game: 'any', param: 0, goal: 10, comum: 0,   premium: 50, progress: 0, claimed: false },
  { id: 'c_colec_grande',  title: 'Grande Colecionador',  desc: 'Tenha mais de 20 Unikos na sua Coleção',   period: 'unica', metric: 'colecao', game: 'any', param: 0, goal: 21, comum: 0,   premium: 50, progress: 0, claimed: false },
];

// Nome antigo — vários pontos do app (widget do Portal, assistente) importam
// esta constante. Mantido como alias pra não quebrar nada.
export const PRISMA_MISSIONS = DEFAULT_MISSIONS;

// ── Definição ↔ linha do Supabase ──
export const missionToRow = (m, idx) => ({
  id: m.id, title: m.title, descr: m.desc || '', period: m.period || 'dia',
  metric: m.metric || 'manual', game: m.game || 'any', param: Number(m.param) || 0,
  goal: Number(m.goal) || 1, comum: Number(m.comum) || 0, premium: Number(m.premium) || 0,
  maintenance: !!m.maintenance, active: m.active !== false,
  sort: idx, updated_at: new Date().toISOString(),
});
export const missionFromRow = (r) => ({
  id: r.id, title: r.title, desc: r.descr || '', period: r.period || 'dia',
  metric: r.metric || 'manual', game: r.game || 'any', param: r.param || 0,
  goal: r.goal || 1, comum: r.comum || 0, premium: r.premium || 0,
  maintenance: !!r.maintenance, active: r.active !== false,
  progress: 0, claimed: false,
});

// Carrega as definições do Supabase. Tabela vazia (1ª vez) → semeia com os
// defaults; erro/tabela ausente → devolve os defaults sem gravar nada, pra
// Prisma Store nunca abrir sem missão nenhuma.
export async function loadMissionDefs({ seed = true } = {}) {
  try {
    const { data, error } = await supabase.from('mercado_missions').select('*').order('sort');
    if (error) throw error;
    if (data && data.length) return data.map(missionFromRow);
    if (seed) {
      try { await supabase.from('mercado_missions').upsert(DEFAULT_MISSIONS.map(missionToRow)); } catch {}
    }
  } catch (e) {
    console.error('[prisma-store] não consegui carregar as missões (usando os padrões):', e);
  }
  return DEFAULT_MISSIONS.map(m => ({ ...m, active: true }));
}

// Grava a lista inteira (upsert + apaga o que saiu). Usado só pelo admin.
export async function saveMissionDefs(missions, removedIds = []) {
  const rows = missions.map(missionToRow);
  const { error } = await supabase.from('mercado_missions').upsert(rows);
  if (error) throw error;
  if (removedIds.length) {
    const { error: delErr } = await supabase.from('mercado_missions').delete().in('id', removedIds);
    if (delErr) throw delErr;
  }
}

// Primeiro dia do período de uma missão ('YYYY-MM-DD'), ou null p/ 'unica' (tudo).
const periodStart = (period) => {
  const td = _today();
  if (period === 'dia') return td;
  if (period === 'mes') return td.slice(0, 7) + '-01';
  return null;
};

// Calcula o progresso AO VIVO de cada missão.
//   purchases — nº de compras já carregado (opcional; senão consulta o histórico)
//   baseline  — snapshot do "Zerar missões" do admin
//   missions  — definições já carregadas (evita uma ida ao banco)
export async function loadMissionProgress({ userName, purchases, baseline, missions } = {}) {
  const defs = (missions && missions.length ? missions : await loadMissionDefs()).filter(m => m.active !== false);
  const prog = {};
  const today = _today();
  const month = today.slice(0, 7);

  // Baseline de reset (admin "Zerar missões"): subtrai o valor que o usuário JÁ tinha no momento
  // do reset, dentro do MESMO período — assim Voz ativa/Maratona voltam a 0 e exigem atividade
  // NOVA, sem apagar dados reais (feedbacks/playtime). Fora do período (outro dia/mês) é ignorado.
  const bl = baseline || {};
  const baseAdj = (id, raw, period) => {
    const b = bl[id]; if (!b) return raw;
    const same = period === 'dia' ? b.d === today : period === 'mes' ? (b.d || '').slice(0, 7) === month : true;
    return same ? Math.max(0, raw - (b.v || 0)) : raw;
  };
  const has = (metric) => defs.some(m => m.metric === metric);

  // ── compras: 1ª/2ª compra — conta prêmio físico ('compra') E Uniko ('compra_uniko',
  // sempre pago em prisma comum); antes só contava 'compra', então comprar Uniko não
  // avançava a missão. ──
  let buys = purchases;
  if (has('compras')) {
    if (buys == null) {
      try {
        const { count } = await supabase.from('mercado_history')
          .select('id', { count: 'exact', head: true }).eq('player', userName).in('kind', ['compra', 'compra_uniko']);
        buys = count || 0;
      } catch { buys = 0; }
    }
  }

  // ── colecao: quantos Unikos o jogador possui (padrão + capturados/comprados) ──
  let owned = 0;
  if (has('colecao')) { try { owned = await countOwnedUnikos(userName); } catch {} }

  // ── feedback: feedbacks não anônimos do usuário no mês ──
  let feedbacks = 0;
  if (has('feedback')) {
    try {
      const { count } = await supabase.from('feedbacks')
        .select('id', { count: 'exact', head: true }).eq('employee_name', userName).gte('created_at', month + '-01');
      feedbacks = count || 0;
    } catch {}
  }

  // ── playtime: minutos jogados. Uma query por combinação jogo+período que
  // alguma missão realmente pede (não uma por missão) — duas Maratonas do
  // mesmo jogo no mesmo dia dividem a mesma leitura. ──
  const ptCombos = [...new Set(defs.filter(m => m.metric === 'playtime')
    .map(m => `${m.game || 'any'}|${m.period}`))];
  const ptSeconds = {};
  await Promise.all(ptCombos.map(async (key) => {
    const [game, period] = key.split('|');
    ptSeconds[key] = await fetchPlaytimeSeconds({ player: userName, game, from: periodStart(period) });
  }));

  // ── rank_mes: quem mais colocou música no MÊS PASSADO (já fechado), não no mês
  // corrente. Antes usava o mês em andamento: quem entrasse no top 3 nos primeiros
  // dias (com pouca gente tendo jogado ainda) já conseguia resgatar, mesmo sendo
  // ultrapassado depois — o "resultado" mudava, mas o resgate já tinha acontecido.
  // Usando o mês fechado, o ranking só fica disponível quando já é definitivo. ──
  let myRank = 0;
  if (has('rank_mes')) {
    try {
      const [py, pm] = month.split('-').map(Number);
      const prevD = new Date(py, pm - 2, 1);
      const prevMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
      const { data } = await supabase.from('maquina_monthly_djs').select('requested_by,plays').eq('month', prevMonth);
      // Nome normalizado (sem espaço nas pontas, sem depender de maiúscula/minúscula) —
      // `requested_by` na fila é digitado/gravado a partir do cadastro, e uma diferença
      // boba de caixa faria a pessoa simplesmente não se achar no ranking.
      const key = (s) => (s || '').trim().toLowerCase();
      const agg = {};
      for (const d of (data || [])) {
        if (isSysDj(d.requested_by)) continue;
        const k = key(d.requested_by);
        if (!k) continue;
        agg[k] = (agg[k] || 0) + (Number(d.plays) || 0);
      }
      // Posição por VALOR distinto de plays (dense rank), não por índice na lista ordenada.
      // Com índice, um EMPATE (ex.: duas pessoas com 190 plays) dava 3º pra uma e 4º pra
      // outra — e quem ficava com o 3º dependia da ordem em que o Postgres devolveu as
      // linhas (a query não tem ORDER BY), ou seja, sorteio. Agora quem empata divide a
      // mesma posição e as duas conseguem resgatar.
      const mine = agg[key(userName)];
      myRank = mine == null ? 0
        : [...new Set(Object.values(agg).sort((a, b) => b - a))].indexOf(mine) + 1;
    } catch {}
  }

  for (const m of defs) {
    const goal = Number(m.goal) || 1;
    let v;
    switch (m.metric) {
      case 'playtime': {
        const raw = ptSeconds[`${m.game || 'any'}|${m.period}`] || 0;
        v = Math.floor(baseAdj(m.id, raw, m.period) / 60);
        break;
      }
      case 'compras':  v = buys || 0; break;
      case 'colecao':  v = owned; break;
      case 'feedback': v = baseAdj(m.id, feedbacks, m.period); break;
      case 'rank_mes': v = myRank > 0 && myRank === (Number(m.param) || 1) ? goal : 0; break;
      default:         v = 0; break; // 'manual'
    }
    prog[m.id] = Math.min(goal, Math.max(0, v));
  }

  return prog;
}

// Snapshot do baseline de reset para VÁRIOS jogadores de uma vez (admin "Zerar missões").
// Captura o valor BRUTO atual das métricas ACUMULATIVAS (feedbacks do período; segundos
// jogados no período) por jogador. O progresso ao vivo passa a contar só o que vier
// DEPOIS deste ponto (ver baseAdj em loadMissionProgress). Poucas queries — uma por
// métrica/combinação, não uma por usuário.
// Retorna { [player]: { [missionId]: { v, d } } }.
export async function snapshotMissionBaseline({ players, missions } = {}) {
  const today = _today();
  const month = today.slice(0, 7);
  const defs = (missions && missions.length ? missions : await loadMissionDefs({ seed: false })).filter(m => m.active !== false);
  const list = [...new Set((players || []).map(p => (p || '').trim()).filter(Boolean))];
  const out = {}; list.forEach(p => { out[p] = {}; });
  if (!list.length) return out;

  // Feedbacks do mês por employee_name
  const fbMissions = defs.filter(m => m.metric === 'feedback');
  if (fbMissions.length) {
    try {
      const { data } = await supabase.from('feedbacks').select('employee_name').gte('created_at', month + '-01');
      const cnt = {}; for (const r of (data || [])) { const n = (r.employee_name || '').trim(); cnt[n] = (cnt[n] || 0) + 1; }
      list.forEach(p => fbMissions.forEach(m => { out[p][m.id] = { v: cnt[p] || 0, d: today }; }));
    } catch {}
  }

  // Segundos jogados por jogo+período (uma query por combinação usada)
  const ptMissions = defs.filter(m => m.metric === 'playtime');
  const combos = [...new Set(ptMissions.map(m => `${m.game || 'any'}|${m.period}`))];
  await Promise.all(combos.map(async (key) => {
    const [game, period] = key.split('|');
    const secs = await fetchPlaytimeSecondsBulk({ players: list, game, from: periodStart(period) });
    ptMissions.filter(m => `${m.game || 'any'}|${m.period}` === key)
      .forEach(m => list.forEach(p => { out[p][m.id] = { v: secs[p] || 0, d: today }; }));
  }));

  return out;
}
