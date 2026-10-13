// Visibilidade e nomes de MÓDULOS (cards da tela inicial) e ABAS (menu do Portal), controlados
// pelo admin sem mexer em código: esconder pra todos ou só pra algumas pessoas, e renomear.
// Quem escreve é o agente de Pedidos de Ajuste (crescent-hub-server/agent/acoes.js) ou a aba
// "Módulos e Abas" do Dashboard RH; aqui só LEMOS e aplicamos.
//   tipo:'modulo' → id do card (ex.: 'uniko-fit'),  tipo:'aba' → id da aba do Portal (ex.: 'unikosuspect')
// Tabela uniko_visibilidade (supabase_visibilidade.sql, projeto principal).
import { useEffect, useState } from 'react';
import { supabase, getAuthUser } from '../contexts/user';

const CACHE_KEY = 'uniko_visibilidade_v1';
const EVENTO = 'uniko-visibilidade:changed';

/* Nunca escondem (evita o admin se trancar pra fora do próprio sistema). */
export const PROTEGIDOS = new Set(['modulo:colaborador', 'modulo:dashboard', 'aba:inicio']);

const norm = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

let linhas = (() => { try { const r = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); return Array.isArray(r) ? r : []; } catch { return []; } })();

export const linhasVisibilidade = () => linhas;

const escondePara = (l, nomeUsuario) => {
  if (PROTEGIDOS.has(`${l.tipo}:${l.item_id}`)) return false;
  if (l.oculto_todos) return true;
  const lista = Array.isArray(l.ocultar_para) ? l.ocultar_para : [];
  const eu = norm(nomeUsuario);
  return !!eu && lista.some(n => norm(n) === eu);
};

/** Aplica esconder/renomear numa lista de itens ({id,label,…}). Não altera a lista original. */
export function aplicarVisibilidade(tipo, lista, nomeUsuario = getAuthUser?.()?.name) {
  if (!linhas.length) return lista;
  const porId = new Map(linhas.filter(l => l.tipo === tipo).map(l => [l.item_id, l]));
  if (!porId.size) return lista;
  return lista
    .filter(item => { const l = porId.get(item.id); return !(l && escondePara(l, nomeUsuario)); })
    .map(item => { const l = porId.get(item.id); return l && l.nome ? { ...item, label: l.nome } : item; });
}

/** Faz o componente re-renderizar quando a visibilidade muda (vinda do Supabase). */
export function useVisibilidade() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump(x => x + 1);
    window.addEventListener(EVENTO, f);
    return () => window.removeEventListener(EVENTO, f);
  }, []);
}

export async function carregarVisibilidade() {
  try {
    const { data, error } = await supabase.from('uniko_visibilidade').select('*');
    if (error || !Array.isArray(data)) return null;
    const mudou = JSON.stringify(data) !== JSON.stringify(linhas);
    linhas = data;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* sem storage */ }
    if (mudou) window.dispatchEvent(new CustomEvent(EVENTO));
    return data;
  } catch { return null; }
}

/** Chamar UMA vez (main.jsx). Atualiza a cada 3 min e ao voltar pra aba. */
export function iniciarVisibilidade() {
  if (typeof window === 'undefined') return;
  carregarVisibilidade();
  setInterval(carregarVisibilidade, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregarVisibilidade(); });
}
