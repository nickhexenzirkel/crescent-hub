import { useState } from 'react';
import { T } from '../../contexts/theme';

/**
 * Painel de credenciais do 7Benefícios com persistência em localStorage.
 * Usa o hook useCredenciais() — não gerencia estado interno de credenciais.
 */
export const CredenciaisPanel = ({
  credUser, setCredUser,
  credPass, setCredPass,
  saved, editing, setEditing,
  saveCredentials, clearCredentials,
}) => {
  const [showPass, setShowPass] = useState(false);
  const canSave = credUser.trim() && credPass.trim();

  /* ── Estado salvo (compacto) ── */
  if (saved && !editing) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 18px',
        background: 'rgba(26,156,112,.07)',
        border: '1px solid rgba(26,156,112,.25)',
        borderRadius: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(26,156,112,.15)',
          border: '1.5px solid rgba(26,156,112,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="#1A9C70" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>
            7Benefícios
          </div>
          <div style={{ fontSize: 12, color: T.textS, marginTop: 1 }}>
            Conectado como <strong style={{ color: T.text }}>{credUser}</strong>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'none', border: `1px solid ${T.border}`,
            borderRadius: 8, padding: '5px 12px',
            color: T.textS, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-body)', flexShrink: 0,
            transition: 'all .14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textS; }}
        >
          Trocar
        </button>
      </div>
    );
  }

  /* ── Estado de edição / novo login ── */
  return (
    <div style={{
      padding: '16px 18px',
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: T.textS, marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={T.textT} strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        Credenciais do 7Benefícios
        {saved && editing && (
          <span style={{ fontSize: 11, color: T.textT, fontWeight: 400 }}>
            — editando
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: T.textS, display: 'block', marginBottom: 5 }}>Usuário</label>
          <input
            value={credUser}
            onChange={e => setCredUser(e.target.value)}
            placeholder="Nome de usuário"
            autoComplete="username"
            style={{
              width: '100%', padding: '9px 10px', borderRadius: 9,
              border: `1px solid ${credUser ? T.gold : T.border}`,
              background: T.surface, color: T.text, fontSize: 13,
              fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: T.textS, display: 'block', marginBottom: 5 }}>Senha</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={credPass}
              onChange={e => setCredPass(e.target.value)}
              placeholder="Senha"
              autoComplete="current-password"
              onKeyDown={e => { if (e.key === 'Enter' && canSave) saveCredentials(); }}
              style={{
                width: '100%', padding: '9px 36px 9px 10px', borderRadius: 9,
                border: `1px solid ${credPass ? T.gold : T.border}`,
                background: T.surface, color: T.text, fontSize: 13,
                fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setShowPass(p => !p)}
              style={{
                position: 'absolute', right: 8, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: T.textT,
              }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {showPass
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={saveCredentials}
          disabled={!canSave}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 9,
            background: canSave ? T.gold : T.textD,
            border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-body)', transition: 'all .15s',
            boxShadow: canSave ? `0 3px 10px ${T.gold}44` : 'none',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Salvar
        </button>
        <span style={{ fontSize: 11.5, color: T.textT }}>
          Fica salvo no navegador — não precisa preencher novamente
        </span>
        {saved && editing && (
          <button
            onClick={() => setEditing(false)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: T.textT, fontSize: 12,
              fontFamily: 'var(--font-body)',
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};
