// ── Tempo jogado por JOGO — fonte única (Uniko Wave, Speed, Stop, Paint) ──
// Alimenta as missões de "Maratona" da Prisma Store (ver prismaMissions.js).
// Grava na tabela uniko_playtime, agora com a coluna `game`
// (ver supabase_uniko_missoes.sql).
import { supabase, getAuthUser, USER } from '../contexts/user';

// Os jogos que contam tempo. O id é o que vai pro banco — NÃO renomeie sem
// migrar as linhas existentes (as antigas, do Wave, foram gravadas como 'wave').
export const PLAYTIME_GAMES = [
  { id: 'wave',  label: 'Uniko Wave'  },
  { id: 'speed', label: 'Uniko Speed' },
  { id: 'stop',  label: 'Uniko Stop'  },
  { id: 'paint', label: 'Uniko Paint' },
];
export const GAME_LABEL = Object.fromEntries(PLAYTIME_GAMES.map(g => [g.id, g.label]));
const VALID_GAMES = new Set(PLAYTIME_GAMES.map(g => g.id));

// Dia LOCAL (YYYY-MM-DD), não UTC. Tem que ser o mesmo cálculo do
// prismaMissions.js: como estamos em UTC-3, `toISOString()` já devolve o dia
// SEGUINTE a partir das 21h — quem jogasse às 22h gravava na data de amanhã e
// os minutos contavam de novo pra missão diária do dia seguinte. "Jogue 20 min
// hoje" é o hoje de quem joga, não o de Londres.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const myName = () => (getAuthUser()?.name || USER?.name || '').trim();

// Acumula `seconds` no total do jogador naquele JOGO, no dia de hoje.
// Silencioso de propósito: tempo jogado é métrica secundária, nunca pode
// atrapalhar a partida com erro na tela.
export async function addGamePlaytime(game, seconds, player) {
  const add = Math.round(Number(seconds) || 0);
  const p = (player || myName()).trim();
  if (add <= 0 || !p || !VALID_GAMES.has(game)) return;
  const day = today();
  try {
    const { data } = await supabase.from('uniko_playtime')
      .select('seconds').eq('player', p).eq('day', day).eq('game', game).maybeSingle();
    const cur = data?.seconds || 0;
    await supabase.from('uniko_playtime').upsert(
      { player: p, day, game, seconds: cur + add, updated_at: new Date().toISOString() },
      { onConflict: 'player,day,game' });
  } catch {}
}

// Soma os SEGUNDOS jogados por um jogador num período.
//   game  — id do jogo, ou 'any' pra somar todos
//   from  — 'YYYY-MM-DD' inicial (inclusivo); sem `from` = tudo (missão 'unica')
export async function fetchPlaytimeSeconds({ player, game = 'any', from } = {}) {
  const p = (player || myName()).trim();
  if (!p) return 0;
  try {
    let q = supabase.from('uniko_playtime').select('seconds,game,day').eq('player', p);
    if (game && game !== 'any') q = q.eq('game', game);
    if (from) q = q.gte('day', from);
    const { data } = await q;
    return (data || []).reduce((acc, r) => acc + (r.seconds || 0), 0);
  } catch { return 0; }
}

// Mesma soma, mas pra VÁRIOS jogadores de uma vez (1 query) — usado no snapshot
// de baseline do "Zerar missões" do admin. Retorna { [player]: segundos }.
export async function fetchPlaytimeSecondsBulk({ players, game = 'any', from } = {}) {
  const list = [...new Set((players || []).map(x => (x || '').trim()).filter(Boolean))];
  const out = {}; list.forEach(p => { out[p] = 0; });
  if (!list.length) return out;
  try {
    let q = supabase.from('uniko_playtime').select('player,seconds').in('player', list);
    if (game && game !== 'any') q = q.eq('game', game);
    if (from) q = q.gte('day', from);
    const { data } = await q;
    for (const r of (data || [])) {
      const k = (r.player || '').trim();
      if (k in out) out[k] += r.seconds || 0;
    }
  } catch {}
  return out;
}
