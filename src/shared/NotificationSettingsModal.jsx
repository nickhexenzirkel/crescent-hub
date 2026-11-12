import { useEffect, useState } from 'react';
import { T } from '../contexts/theme';
import { ensureNotifyPermission, notifyPermission } from '../utils/desktopNotify';
import {
  getGlobalNotificationDefaults,
  getNotificationChannels,
  getNotificationPreferences,
  hasPersonalNotificationOverride,
  NOTIFICATION_CATEGORIES,
  notificationModesForCategory,
  resetNotificationMode,
  saveNotificationMode,
} from './notificationPreferences';
import { GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT } from './globalNotificationPreferences';

export default function NotificationSettingsModal({ authUser, emailNotificationStatus, onClose }) {
  const [preferences, setPreferences] = useState(() => getNotificationPreferences(authUser));
  const [status, setStatus] = useState('');
  const [savingError, setSavingError] = useState('');

  useEffect(() => {
    const atualizar = () => setPreferences(getNotificationPreferences(authUser));
    window.addEventListener(GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT, atualizar);
    return () => window.removeEventListener(GLOBAL_NOTIFICATION_PREFERENCES_CHANGED_EVENT, atualizar);
  }, [authUser]);

  const changeMode = async (category, mode) => {
    console.info('[notificações] Clique em opção de preferência pessoal.', { category, mode });
    if (!await saveNotificationMode(authUser, category, mode)) {
      console.error('[notificações] Preferência pessoal não foi ativada porque o salvamento falhou.', { category, mode });
      setSavingError('Não foi possível salvar a preferência neste navegador.');
      return;
    }
    setSavingError('');
    setPreferences(current => ({ ...current, [category]: mode }));
    console.info('[notificações] Preferência pessoal salva.', {
      category,
      mode,
      channels: getNotificationChannels(authUser, category),
    });
    setStatus('Preferência pessoal salva somente neste dispositivo.');

    if (getNotificationChannels(authUser, category).desktop) {
      const permission = await ensureNotifyPermission();
      console.info('[notificações] Resultado da permissão desktop.', { permission });
      setStatus(permission === 'granted'
        ? 'Notificações do desktop estão autorizadas neste navegador.'
        : permission === 'denied'
          ? 'A permissão do desktop foi bloqueada no navegador. Altere-a nas configurações do site.'
          : 'O navegador não oferece notificações do desktop.');
    }
  };

  const usarPadrao = category => {
    console.info('[notificações] Clique para restaurar o padrão da empresa.', { category });
    if (!resetNotificationMode(authUser, category)) {
      setSavingError('Não foi possível aplicar o padrão da empresa neste navegador.');
      return;
    }
    setSavingError('');
    setPreferences(getNotificationPreferences(authUser));
    console.info('[notificações] Padrão da empresa aplicado.', {
      category,
      mode: getGlobalNotificationDefaults()[category],
      channels: getNotificationChannels(authUser, category),
    });
    setStatus(`Padrão da empresa aplicado: ${notificationModesForCategory(category).find(mode => mode.id === getGlobalNotificationDefaults()[category])?.label || 'padrão'}.`);
  };

  const initialPermission = notifyPermission();
  const permissionNote = status || (initialPermission === 'denied'
    ? 'A permissão do desktop está bloqueada nas configurações do navegador.'
    : initialPermission === 'unsupported'
      ? 'Este navegador não oferece notificações do desktop.'
      : 'O padrão é definido pela empresa e sincronizado entre dispositivos. Preferências pessoais são exceções salvas apenas neste navegador.');

  return (
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(5px)' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-settings-title"
        style={{ width: 'min(620px, 100%)', maxHeight: 'min(88vh, 760px)', overflowY: 'auto',
          padding: 22, borderRadius: 18, border: `1px solid ${T.border}`, background: T.surface,
          boxShadow: '0 24px 80px rgba(0,0,0,.38)', color: T.text, fontFamily: 'var(--font-body)' }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h2 id="notification-settings-title" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Notificações</h2>
            <p style={{ margin: '6px 0 0', color: T.textS, fontSize: 12.5, lineHeight: 1.5 }}>
              Escolha como cada função deve avisar você.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar configurações de notificações"
            style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 9, background: 'transparent',
              color: T.textS, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </header>

        <div style={{ display: 'grid', gap: 12 }}>
          {NOTIFICATION_CATEGORIES.map(category => (
            <fieldset key={category.id} style={{ margin: 0, minWidth: 0, padding: 13, border: `1px solid ${T.border}`,
              borderRadius: 13 }}>
              <legend style={{ padding: '0 5px', color: T.text, fontSize: 13, fontWeight: 800 }}>{category.label}</legend>
              <div style={{ margin: '0 0 10px', color: T.textS, fontSize: 11.5 }}>{category.description}</div>
              {category.id === 'email_recebidos' && (
                <div role="status" aria-live="polite" style={{ margin: '0 0 10px', color: T.textT, fontSize: 11.5, lineHeight: 1.5 }}>
                  {emailNotificationStatus || 'Desativada. Ao ativar, somente novos e-mails recebidos serão notificados.'}
                </div>
              )}
              {hasPersonalNotificationOverride(authUser, category.id) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9, color: T.textT, fontSize: 10.5 }}>
                  <span>Preferência pessoal neste dispositivo</span>
                  <button type="button" onClick={() => usarPadrao(category.id)}
                    style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '5px 8px', background: 'transparent', color: T.gold, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700 }}>
                    Usar padrão da empresa
                  </button>
                </div>
              )}
              <div role="radiogroup" aria-label={`Tipo de notificação: ${category.label}`}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 7 }}>
                {notificationModesForCategory(category.id).map(mode => {
                  const selected = preferences[category.id] === mode.id;
                  return (
                    <button key={mode.id} type="button" role="radio" aria-checked={selected}
                      onClick={() => changeMode(category.id, mode.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '7px 9px',
                        border: `1px solid ${selected ? T.gold : T.border}`, borderRadius: 9,
                        background: selected ? T.goldGl : 'transparent', color: selected ? T.gold : T.textS,
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: 11.5,
                        fontWeight: selected ? 800 : 600 }}>
                      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 14, height: 14,
                        flexShrink: 0, border: `1.5px solid ${selected ? T.gold : T.textT}`, borderRadius: '50%' }}>
                        {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.gold }} />}
                      </span>
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div role="status" style={{ minHeight: 18, marginTop: 12, color: savingError ? (T.danger || '#C04050') : T.textT,
          fontSize: 11.5, lineHeight: 1.5 }}>
          {savingError || permissionNote}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" onClick={onClose}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 10, background: T.gold, color: '#fff',
              cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 800 }}>Concluir</button>
        </div>
      </section>
    </div>
  );
}
