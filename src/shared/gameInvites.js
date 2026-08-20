// src/shared/gameInvites.js
// Convites de jogo (Uniko Paint / Uniko Stop): enviar, receber (realtime) e a
// "ponte" de navegação (aceitar → abre o jogo e entra na sala). Tudo via tabela
// game_invites (rodar supabase_game_invites.sql). Ver App.jsx (listener global),
// FriendsInvite.jsx (lista de amigos) e as abas dos jogos (auto-join).
import { supabase, getAuthUser, SERVER_URL } from '../contexts/user';

export const GAME_LABEL = { paint: 'Uniko Paint', stop: 'Uniko Stop!' };
export const GAME_TAB   = { paint: 'unikopaint', stop: 'unikostop' };

// "Sala pendente" que o convidado deve entrar assim que abrir o jogo.
const JOIN_KEY = 'uniko_game_join';
export const setPendingJoin = (game, roomId) => {
  try { localStorage.setItem(JOIN_KEY, JSON.stringify({ game, room: roomId || null, ts: Date.now() })); } catch { /* sem localStorage */ }
};
export const readPendingJoin = (game) => {
  try {
    const raw = localStorage.getItem(JOIN_KEY); if (!raw) return null;
    const j = JSON.parse(raw);
    if (j.game !== game) return null;
    if (Date.now() - (j.ts || 0) > 120000) { localStorage.removeItem(JOIN_KEY); return null; } // >2min = velho
    return j;
  } catch { return null; }
};
export const clearPendingJoin = () => { try { localStorage.removeItem(JOIN_KEY); } catch { /* sem localStorage */ } };

// Evento que a aba do jogo escuta pra entrar na sala mesmo já estando montada.
export const GAME_JOIN_EVENT = 'uniko-game-join';

// Foto (URL leve) do Uniko de quem convida — mesma chave que os jogos usam na presence.
const myPhotoSrc = () => { try { return localStorage.getItem('up_photo_src') || '/UNIKO_NEW.png'; } catch { return '/UNIKO_NEW.png'; } };

// Envia convites pra uma lista de nomes. roomId opcional (entra direto na sala).
export async function sendGameInvites({ toNames, game, roomId = null, roomName = null }) {
  const a = getAuthUser();
  const from_name = a?.name; if (!from_name) return;
  const alvos = [...new Set((toNames || []).filter(n => n && n !== from_name))];
  if (!alvos.length) return;
  const from_photo = myPhotoSrc();
  const rows = alvos.map(to_name => ({ from_name, from_photo, to_name, game, room_id: roomId, room_name: roomName }));
  try { await supabase.from('game_invites').insert(rows); } catch (e) { console.error('[game-invites] envio falhou:', e); }
}

// Assina os convites destinados a `myName` (realtime + poll de fallback). Chama
// onInvite(invite) pra cada convite novo. Devolve uma função de cleanup.
export function subscribeGameInvites(myName, onInvite) {
  if (!myName) return () => {};
  const vistos = new Set();
  const handle = (inv) => {
    if (!inv?.id || inv.to_name !== myName || vistos.has(inv.id)) return;
    vistos.add(inv.id);
    onInvite(inv);
  };
  // Sem filtro no servidor (nome com espaço/acento quebra o filtro realtime): assina
  // todos os INSERT e filtra no cliente (handle já checa to_name === myName).
  const ch = supabase.channel('uniko-game-invites')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_invites' },
      ({ new: inv }) => handle(inv))
    .subscribe();
  // Poll de rede de segurança (realtime pode perder eventos). 1ª passada só marca
  // os antigos pra não reabrir convites velhos ao logar.
  let baseline = true;
  const poll = async () => {
    const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data } = await supabase.from('game_invites').select('*')
      .eq('to_name', myName).gte('created_at', since).order('created_at', { ascending: true });
    for (const inv of (data || [])) {
      if (vistos.has(inv.id)) continue;
      if (baseline) { vistos.add(inv.id); continue; }
      handle(inv);
    }
    baseline = false;
  };
  poll();
  const id = setInterval(poll, 20000);
  return () => { supabase.removeChannel(ch); clearInterval(id); };
}

// Lista de colegas (todos os colaboradores ativos, menos você) — a "lista de amigos".
export async function fetchColegas() {
  try {
    const token = localStorage.getItem('ch_token');
    const r = await fetch(`${SERVER_URL}/api/employees`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const me = getAuthUser()?.name;
    return (d.employees || [])
      .filter(e => e.active !== false && e.name && e.name !== me)
      .map(e => ({ name: e.name, cargo: e.cargo || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}
