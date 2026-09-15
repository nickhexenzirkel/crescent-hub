// src/shared/listShares.js
// Compartilhar UMA coluna do Trello (Conexão Setorial) com um colega — ele vê
// só aquela coluna, não a sala inteira. Ver supabase_conexao_setorial_list_shares.sql
// e conexao-setorial/index.jsx (guestListIds, quem de fato aplica a restrição).
import { supabase, getAuthUser } from '../contexts/user';

// "Convite pendente" que o Trello deve abrir assim que montar — mesma ideia
// do JOIN_KEY de gameInvites.js, só que aqui não é "entra na sala", é "mostra
// o convite de coluna pra aceitar/recusar".
const PENDING_KEY = 'uniko_list_share_pending';
export const setPendingListInvite = (shareId) => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ id: shareId, ts: Date.now() })); } catch {}
};
export const readPendingListInvite = () => {
  try {
    const raw = localStorage.getItem(PENDING_KEY); if (!raw) return null;
    const j = JSON.parse(raw);
    if (Date.now() - (j.ts || 0) > 30 * 60000) { localStorage.removeItem(PENDING_KEY); return null; } // >30min = velho, ignora
    return j.id || null;
  } catch { return null; }
};
export const clearPendingListInvite = () => { try { localStorage.removeItem(PENDING_KEY); } catch {} };

// Envia o convite (fica "pendente" até o colega aceitar/recusar).
export async function sendListShare({ toName, roomId, roomName, roomColor, listId, listTitle }) {
  const from_name = getAuthUser()?.name;
  if (!from_name || !toName || from_name === toName) return { error: 'nome inválido' };
  const { error } = await supabase.from('conexao_list_shares').insert({
    room_id: roomId, list_id: listId, list_title: listTitle, room_name: roomName,
    room_color: roomColor || '#A24CE0', from_name, to_name: toName, status: 'pendente',
  });
  return { error };
}

export async function fetchListShare(id) {
  const { data } = await supabase.from('conexao_list_shares').select('*').eq('id', id).maybeSingle();
  return data || null;
}

export async function respondListShare(id, aceitar) {
  await supabase.from('conexao_list_shares')
    .update({ status: aceitar ? 'aceito' : 'recusado', responded_at: new Date().toISOString() })
    .eq('id', id);
}

// Colunas que ACEITEI (pra mostrar "compartilhado com você" no lobby das salas).
export async function fetchMyAcceptedShares() {
  const me = getAuthUser()?.name; if (!me) return [];
  const { data } = await supabase.from('conexao_list_shares')
    .select('*').eq('to_name', me).eq('status', 'aceito').order('created_at', { ascending: false });
  return data || [];
}

// Convites pendentes que EU MANDEI pra uma coluna específica (pra não deixar
// mandar dois convites da mesma coluna pro mesmo colega ao mesmo tempo).
export async function fetchPendingSharesForList(listId) {
  const { data } = await supabase.from('conexao_list_shares')
    .select('to_name,status').eq('list_id', listId).eq('status', 'pendente');
  return data || [];
}
