// src/modules/central-colaborador/tabs/TabMyDoko.jsx
// COLEÇÃO DE UNIKOS — substitui o antigo "My Uniko" (pet/tamagotchi). Aqui o colaborador
// vê os Unikos colecionáveis: os CAPTURADOS (no Portal) viram cards com suas vantagens
// visuais + botões "Usar como foto de perfil" e "Usar como assistente" (troca o robô do
// canto pela carinha do Uniko). Os ainda não capturados aparecem como silhueta bloqueada.
import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { Card } from '../../../shared/components';
import { USER, saveUserPhoto, getAuthUser } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection } from '../../../shared/captureUniko';
import { ASSISTANT_SKINS, getActiveAssistantSkinId, setActiveAssistantSkin, getAssistantSkin, onAssistantSkinChange } from '../../../shared/assistantSkin';

/* Mantém a MESMA chave do antigo My Uniko — TabGames/TabInicio ainda a importam. */
export const DOKO_KEY = (() => {
  try { const auth = getAuthUser(); return auth?.cpf ? `uniko_doko_${auth.cpf}` : 'uniko_doko'; }
  catch { return 'uniko_doko'; }
})();

const TabMyDoko = ({ onPhotoChange }) => {
  const [captured, setCaptured] = useState(() => getCapturedCollection());
  const [activeAssistant, setActiveAssistant] = useState(getActiveAssistantSkinId);
  const [photoOk, setPhotoOk] = useState(null); // id com feedback "Salvo!"

  useEffect(() => {
    const refresh = () => setCaptured(getCapturedCollection());
    window.addEventListener('uniko-collection:changed', refresh);
    return () => window.removeEventListener('uniko-collection:changed', refresh);
  }, []);
  useEffect(() => onAssistantSkinChange((id) => setActiveAssistant(id || 'default')), []);

  const isCaptured = (id) => captured.some(c => c.id === id);

  // Salva a imagem do Uniko como foto de perfil (canvas 300x300; fallback = URL direta).
  const setAsPhoto = (imgUrl, id) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (val) => {
      saveUserPhoto(val);
      if (onPhotoChange) onPhotoChange(val);
      try { const a = getAuthUser(); localStorage.setItem(a?.cpf ? `uniko_photo_${a.cpf}` : `uniko_photo_${USER.name}`, val); } catch {}
      setPhotoOk(id); setTimeout(() => setPhotoOk(null), 2500);
    };
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 300;
        const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, 300, 300);
        done(c.toDataURL('image/png'));
      } catch { done(imgUrl); }
    };
    img.onerror = () => done(imgUrl);
    img.src = imgUrl;
  };

  const roster = Object.values(CAPTURE_UNIKOS);
  const capturedCount = roster.filter(u => isCaptured(u.id)).length;
  const activeSkin = getAssistantSkin(activeAssistant);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{`@keyframes colIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '.02em' }}>Coleção de Unikos</div>
        <div style={{ fontSize: 13, color: T.textT, marginTop: 3 }}>
          Capture Unikos no Portal e use as vantagens visuais aqui — {capturedCount}/{roster.length} desbloqueado{capturedCount === 1 ? '' : 's'}.
        </div>
      </div>

      {/* Assistente ativo */}
      <Card style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: T.surfaceSub || 'rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}` }}>
          <img src={activeSkin.blink.open} alt={activeSkin.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: T.textT, fontWeight: 600, letterSpacing: '.04em' }}>ASSISTENTE ATUAL</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{activeSkin.name}</div>
        </div>
        {activeAssistant !== 'default' && (
          <button onClick={() => setActiveAssistantSkin('default')}
            style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            Voltar ao UNIKO padrão
          </button>
        )}
      </Card>

      {/* Grade da coleção */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {roster.map(u => {
          const owned = isCaptured(u.id);
          const th = u.theme;
          const canAssist = u.canBeAssistant && ASSISTANT_SKINS[u.id];
          const isActive = activeAssistant === u.id;
          const okPhoto = photoOk === u.id;

          if (!owned) {
            // ── Bloqueado (silhueta) ──
            return (
              <Card key={u.id} style={{ padding: 0, overflow: 'hidden', opacity: .96 }}>
                <div style={{ position: 'relative', height: 168, background: 'radial-gradient(120% 90% at 50% 0%, #20242c, #0d0f13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={u.img} alt="???" style={{ width: 118, height: 118, objectFit: 'contain', filter: 'grayscale(1) brightness(.18)' }}/>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                </div>
                <div style={{ padding: '12px 16px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textS }}>???</div>
                  <div style={{ fontSize: 11.5, color: T.textT, marginTop: 4 }}>Capture no Portal para desbloquear</div>
                </div>
              </Card>
            );
          }

          // ── Capturado (card completo) ──
          return (
            <Card key={u.id} style={{ padding: 0, overflow: 'hidden', animation: 'colIn .35s ease', border: `1px solid ${th.accent}55` }}>
              <div style={{ position: 'relative', height: 180, background: th.scene || 'radial-gradient(120% 90% at 50% 0%, #2a0810, #0b0204)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={u.img} alt={u.name} style={{ width: 140, height: 140, objectFit: 'contain', filter: `drop-shadow(0 0 20px ${th.accent})` }}/>
                {isActive && (
                  <div style={{ position: 'absolute', top: 10, right: 10, padding: '4px 10px', borderRadius: 999, background: th.accent, color: '#fff', fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em' }}>ASSISTENTE ✓</div>
                )}
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: 'var(--font-brand)' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: T.textT, marginBottom: 10 }}>{u.tagline}</div>

                {/* vantagens visuais */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                  {(u.perks || []).map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: T.textS, lineHeight: 1.4 }}>
                      <span style={{ color: th.accent, flexShrink: 0, fontWeight: 800 }}>✦</span>{p}
                    </div>
                  ))}
                </div>

                {/* ações */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setAsPhoto(u.img, u.id)}
                    style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: okPhoto ? 'rgba(40,200,112,.15)' : (T.surfaceSub || 'rgba(0,0,0,.04)'), color: okPhoto ? (T.success || '#28a060') : T.text, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                    {okPhoto ? '✓ Foto salva!' : '📷 Usar como foto'}
                  </button>
                  {canAssist && (
                    <button onClick={() => setActiveAssistantSkin(isActive ? 'default' : u.id)}
                      style={{ flex: 1, minWidth: 120, padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                        background: isActive ? (T.surfaceSub || 'rgba(0,0,0,.06)') : `linear-gradient(135deg,${th.accent2},${th.accent})`,
                        color: isActive ? T.textS : '#fff' }}>
                      {isActive ? '↩ Remover assistente' : '🤖 Usar como assistente'}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export { TabMyDoko };
