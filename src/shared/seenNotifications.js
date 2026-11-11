const STORAGE_PREFIX = 'uniko_notificacoes_vistas_';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SAVED_IDS = 500;

const storageKey = (userId) => `${STORAGE_PREFIX}${String(userId || 'visitante')}`;

function readEntries(userId, now = Date.now()) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(entry => Array.isArray(entry)
      && typeof entry[0] === 'string'
      && Number.isFinite(entry[1])
      && now - entry[1] <= RETENTION_MS);
  } catch (error) {
    console.warn('[notificações] Não foi possível ler o histórico local de avisos:', error);
    return [];
  }
}

export function loadSeenNotifications(userId, now = Date.now()) {
  return new Set(readEntries(userId, now).map(([id]) => id));
}

export function rememberSeenNotification(userId, id, now = Date.now()) {
  if (id === null || id === undefined || String(id) === '') return;
  const entries = readEntries(userId, now).filter(([savedId]) => savedId !== String(id));
  entries.push([String(id), now]);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(entries.slice(-MAX_SAVED_IDS)));
  } catch (error) {
    console.warn('[notificações] Não foi possível salvar o histórico local de avisos:', error);
  }
}
