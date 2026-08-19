// src/shared/atualizacao.jsx
// Moldura "ATUALIZAÇÕES" (public/atualizacoes.png) + overlay em tela cheia mostrado
// a TODOS quando o RH emite uma atualização. O texto (título grande + descrição
// menor, em preto) fica posicionado sobre o painel BRANCO da moldura via percentuais
// do próprio PNG (1672×941), então acompanha qualquer escala.
import React from 'react';

export const ATUAL_IMG = '/atualizacoes.png';

// Caixa de texto sobre o painel branco. Insets calibrados na arte (deixa margem
// pras bordas arredondadas e pros cantos dos robôs).
const BOX_STYLE = {
  position: 'absolute', left: '20%', right: '20%', top: '26%', bottom: '12%',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
  gap: '2%', textAlign: 'center', overflow: 'hidden',
};

export function AtualizacaoFrame({ maxWidth = 860, children, style }) {
  // colorScheme 'only light' exclui esta moldura do "forçar tema escuro" do
  // Opera/Chromium (auto-dark) — sem isso o texto preto e os emojis eram
  // invertidos pra branco e sumiam no painel branco. Herdado pelos filhos.
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth, margin: '0 auto', colorScheme: 'only light', ...style }}>
      <img src={ATUAL_IMG} alt="Atualizações" draggable={false}
        style={{ width: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
      <div style={BOX_STYLE}>{children}</div>
    </div>
  );
}

// Tela cheia mostrada quando chega uma atualização nova (App.jsx).
export function AtualizacaoOverlay({ atual, onClose }) {
  if (!atual) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.86)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(7px)',
      WebkitBackdropFilter: 'blur(7px)', padding: 20, animation: 'atualIn .25s ease' }}>
      <style>{`@keyframes atualIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 920, position: 'relative' }}>
        <AtualizacaoFrame maxWidth={920}>
          <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, color: '#111',
            fontSize: 'clamp(20px, 4vw, 46px)', lineHeight: 1.05, letterSpacing: '.01em',
            textTransform: 'uppercase', wordBreak: 'break-word' }}>{atual.titulo}</div>
          {atual.descricao && (
            <div style={{ color: '#222', fontWeight: 600, fontSize: 'clamp(11px, 1.55vw, 17px)', lineHeight: 1.28,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '64%', overflowY: 'auto' }}>{atual.descricao}</div>
          )}
        </AtualizacaoFrame>
        <button onClick={onClose} title="Fechar" style={{ position: 'absolute', top: -14, right: -8, width: 42, height: 42,
          borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff', color: '#333', fontSize: 22,
          lineHeight: 1, boxShadow: '0 6px 22px rgba(0,0,0,.45)' }}>×</button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '12px 30px', borderRadius: 13, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#7C3AED,#C026D3)', color: '#fff', fontWeight: 700, fontSize: 15,
            fontFamily: 'var(--font-body)', boxShadow: '0 8px 26px rgba(124,58,237,.5)' }}>Entendi 🎉</button>
        </div>
      </div>
    </div>
  );
}
