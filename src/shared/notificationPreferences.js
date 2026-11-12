import { compactPhotoCache } from '../contexts/user';

export const NOTIFICATION_SETTINGS_OPEN_EVENT = 'uniko:open-notification-settings';
export const NOTIFICATION_PREFERENCE_CHANGED_EVENT = 'uniko:notification-preference-changed';
export const NOTIFICATION_SCREEN_EVENT = 'uniko:screen-notification';

export const NOTIFICATION_MODES = [
  { id: 'off', label: 'Desativadas' },
  { id: 'screen', label: 'Só na tela' },
  { id: 'desktop', label: 'Só no desktop' },
  { id: 'both', label: 'Tela + desktop' },
  { id: 'sound', label: 'Só som da aba' },
  { id: 'screen_sound', label: 'Tela + som da aba' },
  { id: 'screen_sound_desktop', label: 'Tela + som + desktop' },
];

export const NOTIFICATION_CATEGORIES = [
  { id: 'atualizacoes', label: 'Atualizações', description: 'Mural de novidades do RH.' },
  { id: 'avisos_rh', label: 'Avisos e lembretes do RH', description: 'Avisos gerais, urgentes e lembretes pessoais.' },
  {
    id: 'email_recebidos',
    label: 'E-mails recebidos',
    description: 'Novas mensagens recebidas na Caixa de Entrada do Gmail. A verificação ocorre enquanto o Uniko estiver aberto.',
    modes: ['off', 'screen', 'screen_sound', 'screen_sound_desktop'],
  },
  { id: 'capture_uniko', label: 'Spawn de Unikos', description: 'Quando um Uniko fica disponível para captura.' },
  { id: 'capture_numero', label: 'Spawn de Números', description: 'Quando um número fica disponível para captura.' },
  { id: 'chat_secreto', label: 'Mensagens do Chat Secreto', description: 'Novas mensagens no Blog Secreto do UNIKO.' },
  { id: 'faturamento_regional', label: 'Faturamento da regional', description: 'Quando um município da sua regional é faturado.' },
  { id: 'convites_jogos', label: 'Convites de jogos', description: 'Convites para jogar Uniko Paint e Stop.' },
  { id: 'chat_uniko_fit', label: 'Bate-Papo do Uniko FIT', description: 'Novas mensagens enquanto você está fora do módulo.' },
  { id: 'conexao_setorial', label: 'Conexão Setorial', description: 'Avisos de novas mensagens recebidas na conexão.' },
];

export const DEFAULT_NOTIFICATION_MODES = {
  atualizacoes: 'both',
  avisos_rh: 'both',
  email_recebidos: 'off',
  capture_uniko: 'desktop',
  capture_numero: 'desktop',
  chat_secreto: 'screen',
  faturamento_regional: 'both',
  convites_jogos: 'both',
  chat_uniko_fit: 'both',
  conexao_setorial: 'both',
};

const validMode = mode => NOTIFICATION_MODES.some(({ id }) => id === mode);
export const isValidNotificationMode = (categoryId, mode) => {
  const category = NOTIFICATION_CATEGORIES.find(({ id }) => id === categoryId);
  return validMode(mode) && (!category?.modes || category.modes.includes(mode));
};
export const notificationModesForCategory = categoryId => {
  const category = NOTIFICATION_CATEGORIES.find(({ id }) => id === categoryId);
  return NOTIFICATION_MODES.filter(mode => !category?.modes || category.modes.includes(mode.id));
};
const preferenceKey = (user) => {
  const identity = user?.cpf || user?.name || user?.id || 'anon';
  return `uniko_notification_preferences_${String(identity).trim().toLowerCase()}`;
};

function storedPreferences(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey(user)) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function legacyChatPreference(user) {
  try {
    const name = String(user?.name || 'anon').toLowerCase();
    const common = localStorage.getItem(`uniko_blog_notifications_${name}`);
    const savedSound = localStorage.getItem(`uniko_blog_sound_${name}`);
    const savedAlerts = localStorage.getItem(`uniko_blog_alerts_${name}`);
    if (common == null && savedSound == null && savedAlerts == null) return null;
    const sound = savedSound == null ? common !== '0' : savedSound !== '0';
    const alerts = savedAlerts == null ? common !== '0' : savedAlerts !== '0';
    if (sound && !alerts) return 'sound';
    if (!sound && !alerts) return 'off';
    return 'screen';
  } catch {
    return null;
  }
}

let globalPreferences = null;
const DEFAULTS_CHANGED_EVENT = 'uniko:notification-defaults-changed';

export function setGlobalNotificationDefaults(preferences) {
  if (!preferences || typeof preferences !== 'object') return;
  globalPreferences = Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => [
    id,
    isValidNotificationMode(id, preferences[id]) ? preferences[id] : DEFAULT_NOTIFICATION_MODES[id],
  ]));
  window.dispatchEvent(new CustomEvent(DEFAULTS_CHANGED_EVENT, {
    detail: { preferences: { ...globalPreferences } },
  }));
}

export function getGlobalNotificationDefaults() {
  return globalPreferences ? { ...globalPreferences } : { ...DEFAULT_NOTIFICATION_MODES };
}

export function hasPersonalNotificationOverride(user, category) {
  const saved = storedPreferences(user);
  return isValidNotificationMode(category, saved[category]) || (category === 'chat_secreto' && legacyChatPreference(user) != null);
}

function effectiveMode(user, category, saved) {
  if (isValidNotificationMode(category, saved[category])) return saved[category];
  if (category === 'chat_secreto') {
    const legacy = legacyChatPreference(user);
    if (legacy) return legacy;
  }
  return globalPreferences?.[category] || DEFAULT_NOTIFICATION_MODES[category];
}

export function getNotificationPreferences(user) {
  const saved = storedPreferences(user);
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => [id, effectiveMode(user, id, saved)]));
}

const storageErrorDetails = error => ({
  name: error?.name || 'Error',
  code: error?.code || error?.number || '',
  message: error?.message || String(error),
});

const isStorageQuotaError = error => error?.name === 'QuotaExceededError'
  || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  || error?.code === 22
  || error?.code === 1014;

export async function saveNotificationMode(user, category, mode) {
  if (!Object.hasOwn(DEFAULT_NOTIFICATION_MODES, category) || !isValidNotificationMode(category, mode)) {
    console.error('[notificações] Preferência inválida; não foi salva.', { category, mode });
    return false;
  }
  const preferences = storedPreferences(user);
  preferences[category] = mode;
  const key = preferenceKey(user);
  const value = JSON.stringify(preferences);
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      console.error(`[notificações] Falha ao salvar preferência no armazenamento local (${storageErrorDetails(error).name}: ${storageErrorDetails(error).message}).`, {
        category, mode, key, error: storageErrorDetails(error),
      });
      return false;
    }

    console.warn('[notificações] Armazenamento local cheio; compactando o cache de fotos e tentando salvar novamente.', {
      category,
      mode,
      key,
      error: storageErrorDetails(error),
    });
    await compactPhotoCache();
    try {
      localStorage.setItem(key, value);
    } catch (retryError) {
      console.error(`[notificações] A preferência continua sem ser salva após compactar o cache (${storageErrorDetails(retryError).name}: ${storageErrorDetails(retryError).message}).`, {
        category, mode, key, error: storageErrorDetails(retryError),
      });
      return false;
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCE_CHANGED_EVENT, {
      detail: { category, mode, user: String(user?.cpf || user?.name || user?.id || 'anon').toLowerCase() },
    }));
  } catch (error) {
    console.error('[notificações] Preferência salva, mas não foi possível notificar os componentes abertos.', {
      category,
      mode,
      error: storageErrorDetails(error),
    });
  }
  return true;
}

export function resetNotificationMode(user, category) {
  if (!Object.hasOwn(DEFAULT_NOTIFICATION_MODES, category)) return false;
  const preferences = storedPreferences(user);
  delete preferences[category];
  try {
    if (category === 'chat_secreto') {
      const name = String(user?.name || 'anon').toLowerCase();
      localStorage.removeItem(`uniko_blog_notifications_${name}`);
      localStorage.removeItem(`uniko_blog_sound_${name}`);
      localStorage.removeItem(`uniko_blog_alerts_${name}`);
    }
    if (Object.keys(preferences).length) localStorage.setItem(preferenceKey(user), JSON.stringify(preferences));
    else localStorage.removeItem(preferenceKey(user));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCE_CHANGED_EVENT, {
      detail: { category, mode: getNotificationPreferences(user)[category], user: String(user?.cpf || user?.name || user?.id || 'anon').toLowerCase() },
    }));
    return true;
  } catch (error) {
    console.error('[notificações] Falha ao restaurar preferência padrão no armazenamento local.', {
      category,
      name: error?.name,
      message: error?.message || String(error),
    });
    return false;
  }
}

export function getNotificationChannels(user, category) {
  const mode = getNotificationPreferences(user)[category] || DEFAULT_NOTIFICATION_MODES[category] || 'both';
  return {
    screen: mode === 'screen' || mode === 'both' || mode === 'screen_sound' || mode === 'screen_sound_desktop',
    desktop: mode === 'desktop' || mode === 'both' || mode === 'screen_sound_desktop',
    sound: mode === 'sound' || mode === 'screen_sound' || mode === 'screen_sound_desktop',
  };
}

export function emitScreenNotification(category, notification) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_SCREEN_EVENT, { detail: { category, notification } }));
}
