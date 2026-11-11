import { useState } from 'react';
import { T } from '../contexts/theme';
import { ensureNotifyPermission, notifyPermission } from '../utils/desktopNotify';
import {
  getNotificationPreferences,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_MODES,
  saveNotificationMode,
} from './notificationPreferences';

export default function NotificationSettingsModal({ authUser, onClose }) {
  const [preferences, setPreferences] = useState(() => getNotificationPreferences(authUser));
  const [status, setStatus] = useState('');
  const [savingError, setSavingError] = useState('');

  const changeMode = async (category, mode) => {
    if (!saveNotificationMode(authUser, category, mode)) {
      setSavingError('Não foi possível salvar a preferência neste navegador.');
      return;
    }
    setSavingError('');
    setPreferences(current => ({ ...current, [category]: mode }));

    if (mode === 'desktop' || mode === 'both') {
      const permission = await ensureNotifyPermission();
      setStatus(permission === 'granted'
        ? 'Notificações do desktop estão autorizadas neste navegador.'
        : permission === 'denied'
          ? 'A permissão do desktop foi bloqueada no navegador. Altere-a nas configurações do site.'
          : 'O navegador não oferece notificações do desktop.');
    } else {
      setStatus('');
    }
  };

  const initialPermission = notifyPermission();
  const permissionNote = status || (initialPermission === 'denied'
    ? 'A permissão do desktop está bloqueada nas configurações do navegador.'
    : initialPermission === 'unsupported'
      ? 'Este navegador não oferece notificações do desktop.'
      : 'As preferências ficam salvas neste navegador para este usuário.');

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
              <div role="radiogroup" aria-label={`Tipo de notificação: ${category.label}`}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 7 }}>
                {NOTIFICATION_MODES.map(mode => {
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
