// src/shared/EmBreveModulo.jsx
// Vitrine de módulo "em breve" — usada pelos módulos que só existem no menu
// (visível só pra admin) mas ainda não têm tela de verdade por trás.
import { T } from '../contexts/theme';

const IcoBack = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export default function EmBreveModulo({ title, subtitle, icon, onBack }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.page, color: T.text, fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: `1px solid ${T.border}`, background: T.topbarBg || T.surface }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', padding: '6px 8px', borderRadius: 8 }}>
          {IcoBack} Módulos
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 8 }}>{title}</div>
          <div style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: T.gold, background: T.goldGl, borderRadius: 999, padding: '4px 12px', marginBottom: 14 }}>EM BREVE</div>
          <div style={{ fontSize: 14, color: T.textS, lineHeight: 1.6 }}>{subtitle || 'Esse módulo ainda está em desenvolvimento e por enquanto só aparece pra admin.'}</div>
        </div>
      </div>
    </div>
  );
}
