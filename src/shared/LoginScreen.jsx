import React, { useState } from 'react';
import { T } from '../contexts/theme';
import { SERVER_URL } from '../contexts/user';
import { StarDivider, Logo } from './components';
import logoNicolas from '../assets/LogoTipoNicolas.png';

const Ico = ({ d, size = 16, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const LoginScreen = ({ onLogin }) => {
  const [cpf,      setCpf]      = useState('');
  const [pass,     setPass]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');

  const isDark  = !!T.dark;
  const panelL  = isDark ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.30)';
  const panelR  = isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';

  const maskCpf = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, '$1.$2');
    if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  };

  const go = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) { setErr('CPF inválido. Digite os 11 dígitos.'); return; }
    if (!pass)                 { setErr('Digite sua senha.'); return; }
    setErr(''); setLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: rawCpf, password: pass }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || 'Erro ao entrar.'); setLoading(false); return; }
      localStorage.setItem('ch_token', data.token);
      onLogin(data.user);
    } catch {
      setErr('Servidor offline. Verifique se o servidor está rodando.');
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter') go(); };

  const inputWrap = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', borderRadius: 11,
    border: `1.5px solid ${T.border}`,
    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative', zIndex: 1 }}>

      {/* ── LEFT ── */}
      <div className="fsu" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 64,
        background: panelL,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${T.border}`,
      }}>

        {/* logos de parceria */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
          <img src={T.unikoSrc || '/Uniko.png'} alt="Uniko"
            style={{ width: 96, height: 96, objectFit: 'contain', filter: `drop-shadow(0 6px 24px ${T.goldLine}44)` }}/>
          <div style={{ width: 1, height: 72, background: T.border, flexShrink: 0, opacity: 0.6 }}/>
          <img src={logoNicolas} alt="Nicolas Andrade"
            style={{ height: 96, width: 'auto', objectFit: 'contain', filter: isDark ? 'brightness(0) invert(1)' : 'none', opacity: isDark ? 0.85 : 1 }}/>
        </div>

        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 38, fontWeight: 700, color: T.text, letterSpacing: '.10em', textAlign: 'center', lineHeight: 1 }}>
          UNIKO
        </div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 400, color: T.gold, letterSpacing: '.28em', marginTop: 6, textAlign: 'center' }}>
          HUB
        </div>
        <div style={{ margin: '20px 0 16px', width: 320 }}><StarDivider /></div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: T.textS, textAlign: 'center', lineHeight: 1.8 }}>
          Sistema Integrado de Gestão<br />de Recursos Humanos
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="fsu2" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64,
        background: panelR,
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontWeight: 600, color: T.text, marginBottom: 7 }}>
              Entrar no Sistema
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: T.textS }}>
              Use seu CPF e a senha fornecida pelo RH
            </div>
          </div>

          {/* CPF */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: T.textS, marginBottom: 6 }}>CPF</div>
            <div style={inputWrap}>
              <Ico stroke={T.textD} d={<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>} />
              <input
                value={cpf}
                onChange={e => setCpf(maskCpf(e.target.value))}
                onKeyDown={handleKey}
                placeholder="000.000.000-00"
                autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: T.text, fontFamily: 'var(--font-body)', letterSpacing: '.04em' }} />
            </div>
          </div>

          {/* Senha */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: T.textS, marginBottom: 6 }}>Senha</div>
            <div style={inputWrap}>
              <Ico stroke={T.textD} d={<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>} />
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={handleKey}
                placeholder="••••••••"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: T.text, fontFamily: 'var(--font-body)' }} />
              <button onClick={() => setShowPass(s => !s)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 4px', color: T.textD, outline: 'none', display: 'flex', alignItems: 'center' }}>
                {showPass
                  ? <Ico stroke={T.textD} d={<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>} />
                  : <Ico stroke={T.textD} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>} />
                }
              </button>
            </div>
          </div>

          {err && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-body)', fontSize: 13, color: T.danger || '#C04050',
              background: 'rgba(192,64,80,0.06)', border: '1px solid rgba(192,64,80,0.20)',
              borderRadius: 9, padding: '9px 14px', marginBottom: 14,
            }}>
              <Ico stroke={T.danger || '#C04050'} d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>} />
              {err}
            </div>
          )}

          <button onClick={go} disabled={loading} style={{
            width: '100%', padding: '14px', fontSize: 15, borderRadius: 11,
            border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`,
            color: 'white', fontWeight: 700, fontFamily: 'var(--font-body)',
            boxShadow: `0 4px 16px ${T.goldLine || T.gold}44`, marginTop: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}>
            {loading
              ? <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                  Entrando...
                </>
              : 'Entrar'
            }
          </button>

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: T.textD }}>
              Esqueceu a senha? Fale com o RH
            </span>
          </div>
          <div style={{ marginTop: 26, width: '100%' }}><StarDivider /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, justifyContent: 'center', marginTop: 16 }}>
            <Logo size={26} />
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: T.textT }}>
              Criado por <span style={{ fontFamily: 'var(--font-brand)', fontSize: 12, fontWeight: 600, color: T.gold }}>Nicolas Andrade</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { LoginScreen };
