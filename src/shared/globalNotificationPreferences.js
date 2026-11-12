import { supabase } from '../contexts/user';
import {
  DEFAULT_NOTIFICATION_MODES,
  NOTIFICATION_CATEGORIES,
  isValidNotificationMode,
  setGlobalNotificationDefaults,
} from './notificationPreferences';

export const GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT = 'uniko:notification-defaults-changed';
const TABLE = 'notification_defaults';
const ROW_ID = 1;
let cachedPreferences = null;
let lastSyncErrorAt = 0;

function normalizePreferences(value) {
  let preferences = value;
  if (typeof preferences === 'string') {
    try { preferences = JSON.parse(preferences); } catch { preferences = {}; }
  }
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map(({ id }) => {
    const mode = preferences?.[id];
    return [id, isValidNotificationMode(id, mode)
      ? mode
      : DEFAULT_NOTIFICATION_MODES[id]];
  }));
}

function publish(preferences) {
  cachedPreferences = normalizePreferences(preferences);
  setGlobalNotificationDefaults(cachedPreferences);
  return { ...cachedPreferences };
}

export function getGlobalNotificationPreferences() {
  return cachedPreferences ? { ...cachedPreferences } : null;
}

export async function loadGlobalNotificationPreferences() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,preferences')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return publish(data?.preferences || DEFAULT_NOTIFICATION_MODES);
}

export async function saveGlobalNotificationPreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  const { error } = await supabase.from(TABLE).upsert({
    id: ROW_ID,
    preferences: normalized,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw error;
  return publish(normalized);
}

export function startGlobalNotificationPreferencesSync() {
  let active = true;
  const reportSyncError = error => {
    if (!active || Date.now() - lastSyncErrorAt < 60_000) return;
    lastSyncErrorAt = Date.now();
    console.warn('[notificações] Não foi possível sincronizar o padrão global:', error?.message || error);
  };
  const refresh = async () => {
    if (!active || document.visibilityState !== 'visible') return;
    try {
      await loadGlobalNotificationPreferences();
    } catch (error) {
      reportSyncError(error);
    }
  };
  const channel = supabase
    .channel('uniko-notification-defaults')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLE,
      filter: `id=eq.${ROW_ID}`,
    }, payload => {
      if (payload.eventType === 'DELETE') {
        publish(DEFAULT_NOTIFICATION_MODES);
        return;
      }
      if (payload.new?.preferences) publish(payload.new.preferences);
    })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reportSyncError(new Error(`Realtime respondeu ${status}`));
      }
    });
  refresh();
  const interval = window.setInterval(refresh, 30_000);
  return () => {
    active = false;
    window.clearInterval(interval);
    supabase.removeChannel(channel);
  };
}
