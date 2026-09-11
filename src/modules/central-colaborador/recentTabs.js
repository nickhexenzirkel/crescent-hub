// src/modules/central-colaborador/recentTabs.js
// Histórico de abas recentemente abertas no Portal (pra o widget "Acessos
// recentes" da Início) — por CONTA, não por aparelho, mesmo padrão já usado
// em outros lugares do app (ver `userTag` em captureUniko.js/assistantSkin.js).
import { getAuthUser } from '../../contexts/user';

const KEY_PREFIX = 'uniko_recent_tabs_';
const MAX = 8;

const userTag = () => {
  try { return (getAuthUser()?.cpf || getAuthUser()?.name || 'anon').toLowerCase(); }
  catch { return 'anon'; }
};

export const loadRecentTabs = () => {
  try {
    const r = JSON.parse(localStorage.getItem(KEY_PREFIX + userTag()) || '[]');
    return Array.isArray(r) ? r : [];
  } catch { return []; }
};

// Chamado a cada troca de aba: manda pro topo (sem duplicar) e guarda só as
// últimas MAX. "inicio" não entra — não faz sentido "acesso recente" pra ela.
export const recordRecentTab = (tabId) => {
  if (!tabId || tabId === 'inicio') return;
  try {
    const atual = loadRecentTabs().filter(id => id !== tabId);
    atual.unshift(tabId);
    localStorage.setItem(KEY_PREFIX + userTag(), JSON.stringify(atual.slice(0, MAX)));
  } catch { /* ignora */ }
};
