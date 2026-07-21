// ── Missões da Prisma Store — fonte ÚNICA (definições + cálculo de progresso ao vivo) ──
// Usado pela Prisma Store (mercado-estelar) e pelo widget "Missões em andamento" do Portal.
import { supabase } from '../contexts/user';
import { countOwnedUnikos } from './captureUniko';

const _today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isSysDj = (n) => {
  const rb = (n || '').trim().toLowerCase();
  return !rb || rb.includes('autoplay') || rb.includes('sistema') || rb.includes('uniko') || rb.includes('alexa');
};

// progress/claimed são por usuário; o resto é a DEFINIÇÃO da missão.
export const PRISMA_MISSIONS = [
  // ── DIÁRIAS ──
  { id: 'c_uniko20',   title: 'Maratona Uniko Wave',   desc: 'Jogue 20 minutos no Uniko Wave',                period: 'dia',   progress: 0, goal: 20, comum: 100, premium: 0,   claimed: false },
  { id: 'c_uniko40',   title: 'Maratona Uniko Wave',   desc: 'Jogue 40 minutos no Uniko Wave',                period: 'dia',   progress: 0, goal: 40, comum: 0,   premium: 10,  claimed: false },
  // ── MENSAIS ──
  { id: 'c_feedback',  title: 'Voz ativa',             desc: 'Dê um feedback no sistema',                     period: 'mes',   progress: 0, goal: 1,  comum: 0,   premium: 30,  claimed: false },
  { id: 'c_rank1',     title: '🥇 Top 1 do mês',        desc: '1º lugar de quem mais colocou música no mês passado',   period: 'mes',   progress: 0, goal: 1,  comum: 0,   premium: 100, claimed: false },
  { id: 'c_rank2',     title: '🥈 Top 2 do mês',        desc: '2º lugar de quem mais colocou música no mês passado',   period: 'mes',   progress: 0, goal: 1,  comum: 0,   premium: 70,  claimed: false },
  { id: 'c_rank3',     title: '🥉 Top 3 do mês',        desc: '3º lugar de quem mais colocou música no mês passado',   period: 'mes',   progress: 0, goal: 1,  comum: 0,   premium: 50,  claimed: false },
  { id: 'c_setor',     title: 'Setor nota 90+',        desc: 'Seu setor passou de 90% no chatbot do mês',     period: 'mes',   progress: 0, goal: 1,  comum: 500, premium: 0,   claimed: false, maintenance: true },
  // ── ESPECIAIS (única vez) ──
  { id: 'c_firstbuy',  title: 'Primeira compra',       desc: 'Faça sua primeira compra na Prisma Store',      period: 'unica', progress: 0, goal: 1,  comum: 200, premium: 0,   claimed: false },
  { id: 'c_secondbuy', title: 'Segunda compra',        desc: 'Faça sua segunda compra na Prisma Store',       period: 'unica', progress: 0, goal: 1,  comum: 400, premium: 0,   claimed: false },
  { id: 'c_colec_pequeno', title: 'Pequeno Colecionador', desc: 'Tenha 10 Unikos na sua Coleção',              period: 'unica', progress: 0, goal: 10, comum: 0,   premium: 50,  claimed: false },
  { id: 'c_colec_grande',  title: 'Grande Colecionador',  desc: 'Tenha mais de 20 Unikos na sua Coleção',      period: 'unica', progress: 0, goal: 21, comum: 0,   premium: 50,  claimed: false },
];

// Calcula o progresso AO VIVO de cada missão (mesmas fontes da Prisma Store).
// `purchases` = nº de compras já carregado (opcional; senão consulta o histórico).
export async function loadMissionProgress({ userName, purchases, baseline } = {}) {
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

  // 1ª/2ª compra — conta prêmio físico ('compra') E Uniko ('compra_uniko', sempre pago
  // em prisma comum); antes só contava 'compra', então comprar Uniko não avançava a missão.
  let buys = purchases;
  if (buys == null) {
    try {
      const { count } = await supabase.from('mercado_history')
        .select('id', { count: 'exact', head: true }).eq('player', userName).in('kind', ['compra', 'compra_uniko']);
      buys = count || 0;
    } catch { buys = 0; }
  }
  prog.c_firstbuy = buys >= 1 ? 1 : 0;
  prog.c_secondbuy = buys >= 2 ? 1 : 0;

  // Maratona Uniko Wave — minutos jogados HOJE
  try {
    const { data } = await supabase.from('uniko_playtime')
      .select('seconds').eq('player', userName).eq('day', today).maybeSingle();
    const rawSec = data?.seconds || 0;
    prog.c_uniko20 = Math.min(20, Math.floor(baseAdj('c_uniko20', rawSec, 'dia') / 60));
    prog.c_uniko40 = Math.min(40, Math.floor(baseAdj('c_uniko40', rawSec, 'dia') / 60));
  } catch {}

  // Pequeno/Grande Colecionador — quantos Unikos o jogador possui (padrão + capturados/comprados)
  try {
    const total = await countOwnedUnikos(userName);
    prog.c_colec_pequeno = Math.min(10, total);
    prog.c_colec_grande = Math.min(21, total);
  } catch {}

  // Voz ativa — feedback não anônimo do usuário neste mês
  try {
    const { count } = await supabase.from('feedbacks')
      .select('id', { count: 'exact', head: true }).eq('employee_name', userName).gte('created_at', month + '-01');
    prog.c_feedback = baseAdj('c_feedback', (count || 0), 'mes') >= 1 ? 1 : 0;
  } catch {}

  // Top 1/2/3 — quem mais colocou música no MÊS PASSADO (já fechado), não no mês
  // corrente. Antes usava o mês em andamento: quem entrasse no top 3 nos primeiros
  // dias (com pouca gente tendo jogado ainda) já conseguia resgatar, mesmo sendo
  // ultrapassado depois — o "resultado" mudava, mas o resgate já tinha acontecido.
  // Usando o mês fechado, o ranking só fica disponível quando já é definitivo, e
  // quem ultrapassar alguém só no fim do mês também consegue resgatar.
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
    const rank = mine == null ? 0
      : [...new Set(Object.values(agg).sort((a, b) => b - a))].indexOf(mine) + 1;
    prog.c_rank1 = rank === 1 ? 1 : 0;
    prog.c_rank2 = rank === 2 ? 1 : 0;
    prog.c_rank3 = rank === 3 ? 1 : 0;
  } catch {}

  return prog;
}

// Snapshot do baseline de reset para VÁRIOS jogadores de uma vez (admin "Zerar missões").
// Captura o valor BRUTO atual das métricas acumulativas (Voz ativa = feedbacks do mês;
// Maratona = segundos jogados hoje) por jogador. O progresso ao vivo passa a contar só o que
// vier DEPOIS deste ponto (ver baseAdj em loadMissionProgress). 1 query por métrica (não por
// usuário). Retorna { [player]: { c_feedback:{v,d}, c_uniko20:{v,d}, c_uniko40:{v,d} } }.
export async function snapshotMissionBaseline({ players } = {}) {
  const today = _today();
  const month = today.slice(0, 7);
  const list = [...new Set((players || []).map(p => (p || '').trim()).filter(Boolean))];
  const out = {}; list.forEach(p => { out[p] = {}; });

  // Feedbacks do mês por employee_name
  try {
    const { data } = await supabase.from('feedbacks').select('employee_name').gte('created_at', month + '-01');
    const cnt = {}; for (const r of (data || [])) { const n = (r.employee_name || '').trim(); cnt[n] = (cnt[n] || 0) + 1; }
    list.forEach(p => { out[p].c_feedback = { v: cnt[p] || 0, d: today }; });
  } catch {}

  // Segundos jogados HOJE por player
  try {
    const { data } = await supabase.from('uniko_playtime').select('player,seconds').eq('day', today);
    const sec = {}; for (const r of (data || [])) sec[(r.player || '').trim()] = r.seconds || 0;
    list.forEach(p => { const v = sec[p] || 0; out[p].c_uniko20 = { v, d: today }; out[p].c_uniko40 = { v, d: today }; });
  } catch {}

  return out;
}
