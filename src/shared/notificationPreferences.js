export const NOTIFICATION_SETTINGS_OPEN_EVENT = 'uniko:open-notification-settings';
export const NOTIFICATION_PREFERENCE_CHANGED_EVENT = 'uniko:notification-preference-changed';
export const NOTIFICATION_SCREEN_EVENT = 'uniko:screen-notification';

export const NOTIFICATION_MODES = [
  { id: 'off', label: 'Desativadas' },
  { id: 'screen', label: 'Só na tela' },
  { id: 'desktop', label: 'Só no desktop' },
  { id: 'both', label: 'Tela + desktop' },
  { id: 'sound', label: 'Só som da aba' },
];

export const NOTIFICATION_CATEGORIES = [
  { id: 'atualizacoes', label: 'Atualizações', description: 'Mural de novidades do RH.' },
  { id: 'capture_uniko', label: 'Spawn de Unikos', description: 'Quando um Uniko fica disponível para captura.' },
  { id: 'capture_numero', label: 'Spawn de Números', description: 'Quando um número fica disponível para captura.' },
  { id: 'chat_secreto', label: 'Mensagens do Chat Secreto', description: 'Novas mensagens no Blog Secreto do UNIKO.' },
  { id: 'faturamento_regional', label: 'Faturamento da regional', description: 'Quando um município da sua regional é faturado.' },
];

const DEFAULT_MODES = {
  atualizacoes: 'both',
  capture_uniko: 'desktop',
  capture_numero: 'desktop',
  chat_secreto: 'screen',
  faturamento_regional: 'both',
};

const preferenceKey = (user) => {
  const identity = user?.cpf || user?.name || user?.id || 'anon';
  return `uniko_notification_preferences_${String(identity).trim().toLowerCase()}`;
};

function legacyChatMode(user) {
  const name = String(user?.name || 'anon').toLowerCase();
  const common = localStorage.getItem(`uniko_blog_notifications_${name}`);
  const savedSound = localStorage.getItem(`uniko_blog_sound_${name}`);
  const savedAlerts = localStorage.getItem(`uniko_blog_alerts_${name}`);
  if (common == null && savedSound == null && savedAlerts == null) return DEFAULT_MODES.chat_secreto;
  const sound = savedSound == null ? common !== '0' : savedSound !== '0';
  const alerts = savedAlerts == null ? common !== '0' : savedAlerts !== '0';
  if (sound && !alerts) return 'sound';
  if (!sound && !alerts) return 'off';
  return 'screen';
}

export function getNotificationPreferences(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey(user)) || '{}');
    return Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => [
      id,
      NOTIFICATION_MODES.some(({ id: mode }) => mode === saved[id])
        ? saved[id]
        : id === 'chat_secreto' ? legacyChatMode(user) : DEFAULT_MODES[id],
    ]));
  } catch {
    return { ...DEFAULT_MODES };
  }
}

export function saveNotificationMode(user, category, mode) {
  if (!DEFAULT_MODES[category] || !NOTIFICATION_MODES.some(({ id }) => id === mode)) return false;
  const preferences = getNotificationPreferences(user);
  preferences[category] = mode;
  try {
    localStorage.setItem(preferenceKey(user), JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCE_CHANGED_EVENT, {
      detail: { category, mode, user: String(user?.cpf || user?.name || user?.id || 'anon').toLowerCase() },
    }));
    return true;
  } catch {
    return false;
  }
}

export function getNotificationChannels(user, category) {
  const mode = getNotificationPreferences(user)[category] || DEFAULT_MODES[category] || 'both';
  return {
    screen: mode === 'screen' || mode === 'both',
    desktop: mode === 'desktop' || mode === 'both',
    sound: mode === 'sound',
  };
}

export function emitScreenNotification(category, notification) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_SCREEN_EVENT, { detail: { category, notification } }));
}
