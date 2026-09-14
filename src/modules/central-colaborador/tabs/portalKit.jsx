// src/modules/central-colaborador/tabs/portalKit.jsx
// Peças visuais compartilhadas pelas abas "de painel" do Portal (Banco de Horas,
// Ponto Eletrônico): cabeçalho com card de saldo, card de seção com busca/filtros
// e a linha expansível do histórico. Cores sempre derivadas do tema ativo (T).
import React from 'react';
import { T } from '../../../contexts/theme';

export const Ico = ({ d, size = 14, stroke = 'currentColor', sw = 1.8, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

// Glifos (traço estilo feather).
export const G = {
  clock:     <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></>,
  calendar:  <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  calPlus:   <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="13.5" x2="12" y2="18" /><line x1="9.75" y1="15.75" x2="14.25" y2="15.75" /></>,
  building:  <><rect x="4.5" y="3" width="15" height="18" rx="1.5" /><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M10.5 21v-3h3v3" /></>,
  arrowUp:   <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5.5 11.5 12 5 18.5 11.5" /></>,
  arrowDown: <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="5.5 12.5 12 19 18.5 12.5" /></>,
  upCircle:  <><circle cx="12" cy="12" r="9" /><polyline points="8.5 11.5 12 8 15.5 11.5" /><line x1="12" y1="16" x2="12" y2="8.5" /></>,
  downCircle:<><circle cx="12" cy="12" r="9" /><polyline points="8.5 12.5 12 16 15.5 12.5" /><line x1="12" y1="8" x2="12" y2="15.5" /></>,
  money:     <><circle cx="12" cy="12" r="9" /><path d="M14.6 9.3c-.5-.8-1.4-1.3-2.6-1.3-1.5 0-2.5.8-2.5 1.9 0 2.6 5.1 1.4 5.1 4.1 0 1.1-1.1 2-2.6 2-1.2 0-2.2-.5-2.7-1.4M12 6.5V8M12 16v1.5" /></>,
  coins:     <><ellipse cx="9.5" cy="6" rx="6" ry="2.6" /><path d="M3.5 6v5c0 1.4 2.7 2.6 6 2.6M3.5 11v5c0 1.4 2.7 2.6 6 2.6M15.5 6v2.5" /><circle cx="17" cy="16" r="4.2" /><polyline points="17 14.2 17 16 18.2 17" /></>,
  search:    <><circle cx="11" cy="11" r="7" /><line x1="20.5" y1="20.5" x2="16.2" y2="16.2" /></>,
  filter:    <polygon points="21.5 4 2.5 4 10 12.9 10 19 14 21 14 12.9 21.5 4" />,
  chevR:     <polyline points="9 18 15 12 9 6" />,
  chevL:     <polyline points="15 18 9 12 15 6" />,
  chevD:     <polyline points="6 9 12 15 18 9" />,
  trash:     <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" /></>,
  x:         <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  check:     <polyline points="20 6 9 17 4 12" />,
  alert:     <><circle cx="12" cy="12" r="9" /><line x1="12" y1="7.5" x2="12" y2="12.5" /><line x1="12" y1="16.2" x2="12.01" y2="16.2" /></>,
  fileText:  <><path d="M14 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8z" /><polyline points="14 2.5 14 8 19.5 8" /><line x1="8.5" y1="13" x2="15.5" y2="13" /><line x1="8.5" y1="17" x2="13" y2="17" /></>,
  filePlus:  <><path d="M14 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8z" /><polyline points="14 2.5 14 8 19.5 8" /><line x1="12" y1="11" x2="12" y2="17.5" /><line x1="8.75" y1="14.25" x2="15.25" y2="14.25" /></>,
  clip:      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />,
  shield:    <><path d="M12 21.5s7.5-3.6 7.5-9.5V5.2L12 2.5 4.5 5.2V12c0 5.9 7.5 9.5 7.5 9.5z" /><polyline points="8.8 12 11.2 14.4 15.4 9.8" /></>,
  finger:    <><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></>,
  logIn:     <><path d="M15 3.5h3.5a2 2 0 012 2v13a2 2 0 01-2 2H15" /><polyline points="10 16.5 14.5 12 10 7.5" /><line x1="14.5" y1="12" x2="3.5" y2="12" /></>,
  logOut:    <><path d="M9 20.5H5.5a2 2 0 01-2-2v-13a2 2 0 012-2H9" /><polyline points="15.5 16.5 20 12 15.5 7.5" /><line x1="20" y1="12" x2="9" y2="12" /></>,
  trend:     <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  sun:       <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>,
  list:      <><line x1="9" y1="6" x2="20.5" y2="6" /><line x1="9" y1="12" x2="20.5" y2="12" /><line x1="9" y1="18" x2="20.5" y2="18" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  grid:      <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
};

// ── cores ──
const hexRgb = h => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  let s = m[1]; if (s.length === 3) s = s.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
};
// Mistura duas cores hex (t = peso de b). Cores fora do formato caem na primeira.
export const mix = (a, b, t) => {
  const A = hexRgb(a), B = hexRgb(b);
  if (!A || !B) return a;
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export const alpha = (h, a) => { const c = hexRgb(h); return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : h; };

// Tons semânticos: mais vivos nos temas escuros, mais sóbrios nos claros.
export const tone = (name) => {
  const d = T.dark;
  switch (name) {
    case 'pos':   return d ? { bg: 'rgba(52,211,153,0.13)',  color: '#3DDC97' } : { bg: 'rgba(26,156,112,0.11)', color: '#168A62' };
    case 'neg':   return d ? { bg: 'rgba(248,113,133,0.14)', color: '#FF7A8E' } : { bg: 'rgba(192,64,80,0.11)',  color: '#C04050' };
    case 'warn':  return d ? { bg: 'rgba(245,176,70,0.14)',  color: '#F5B046' } : { bg: 'rgba(216,144,48,0.13)', color: '#B97416' };
    case 'info':  return d ? { bg: 'rgba(107,184,255,0.14)', color: '#7CC0FF' } : { bg: 'rgba(30,112,181,0.10)', color: '#1E70B5' };
    case 'brand': return { bg: alpha(T.blue, d ? 0.18 : 0.1), color: d ? mix(T.blueL, '#FFFFFF', 0.25) : T.blue };
    default:      return { bg: T.surfaceSub, color: T.textS };
  }
};

export const Pill = ({ t, icon, children, strike, size = 'md', style }) => {
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 5 : 7, padding: sm ? '3px 9px' : '5px 13px', borderRadius: sm ? 7 : 9,
      background: t.bg, color: t.color, fontSize: sm ? 12 : 14.5, fontWeight: 700, whiteSpace: 'nowrap',
      textDecoration: strike ? 'line-through' : 'none', ...style,
    }}>
      {icon && <Ico d={icon} size={sm ? 12 : 15} stroke="currentColor" sw={2.4} />}
      {children}
    </span>
  );
};

export const StatusPill = ({ t, children }) => (
  <span style={{ fontSize: 13.5, fontWeight: 700, padding: '6px 15px', borderRadius: 999, background: t.bg, color: t.color, whiteSpace: 'nowrap', justifySelf: 'end' }}>
    {children}
  </span>
);

// ── CSS compartilhado (container queries: o layout segue a largura da ÁREA, não da janela) ──
export const PortalKitStyles = () => (
  <style>{`
    @keyframes spin{to{transform:rotate(360deg)}}
    .pk-row{transition:background .16s, border-color .16s}
    .pk-row:hover{background:${T.itemHover || T.surfaceSub} !important}
    .pk-row:hover .pk-chev{color:${T.text} !important}
    .pk-cta{transition:transform .16s, box-shadow .16s}
    .pk-cta:hover{transform:translateY(-1px);box-shadow:0 12px 30px ${alpha(T.blueL, 0.45)} !important}
    .pk-field:focus-within{border-color:${alpha(T.blue, 0.55)} !important}
    .pk-field input::-webkit-calendar-picker-indicator{filter:${T.dark ? 'invert(1)' : 'none'};opacity:.6;cursor:pointer}
    .pk-select option, .pk-select optgroup{background:${T.surface};color:${T.text}}
    .pk-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,560px) auto;align-items:center}
    .pk-head{display:flex;align-items:center;gap:20px}
    .pk-tools{display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end}
    .pk-search{width:300px}
    .pk-sel{width:220px}
    .pk-scroll{scrollbar-width:thin}
    .pk-bar{display:grid;grid-template-columns:var(--pk-cols);gap:12px}
    .pk-bar .pk-search,.pk-bar .pk-sel{width:auto}
    @container (max-width: 1380px){
      .pk-hero{grid-template-columns:minmax(0,1fr) auto}
      .pk-hero-title{grid-column:1 / -1}
    }
    @container (max-width: 1240px){
      .pk-bar{grid-template-columns:repeat(2,minmax(0,1fr))}
      .pk-bar .pk-search{grid-column:1 / -1}
    }
    @container (max-width: 1100px){
      .pk-head{flex-direction:column;align-items:stretch}
      .pk-tools{justify-content:flex-start}
      .pk-search{flex:1 1 260px;width:auto}
      .pk-bar{grid-template-columns:repeat(2,minmax(0,1fr))}
      .pk-bar .pk-search{grid-column:1 / -1}
    }
    @container (max-width: 700px){
      .pk-hero{grid-template-columns:minmax(0,1fr)}
      .pk-hero .pk-cta{width:100%}
      .pk-tools{flex-direction:column;flex-wrap:nowrap}
      .pk-search,.pk-sel{width:100%;flex:none}
      .pk-bar{grid-template-columns:minmax(0,1fr)}
    }
  `}</style>
);

// ── Cabeçalho: título à esquerda, card de saldo no meio, ação à direita ──
export const PortalHero = ({ isMobile, icon, kicker, title, accent, subtitle, card, action }) => {
  const heroBase   = mix(T.blue, '#070618', T.dark ? 0.72 : 0.62);
  const heroMid    = mix(T.blue, '#070618', T.dark ? 0.84 : 0.78);
  const glow       = T.blueL;
  const accentCor  = mix(T.blueL, '#FFFFFF', 0.38);

  return (
    <div style={{ containerType: 'inline-size', marginBottom: 22 }}>
      <div className="pk-hero" style={{
        position: 'relative', overflow: 'hidden', borderRadius: 22, boxSizing: 'border-box',
        padding: isMobile ? '22px 18px' : '28px 44px 28px 58px', gap: isMobile ? 18 : 28,
        background: `radial-gradient(120% 140% at 0% 110%, ${alpha(glow, 0.42)} 0%, transparent 42%),
                     radial-gradient(90% 120% at 100% -10%, ${alpha(glow, 0.5)} 0%, transparent 38%),
                     linear-gradient(115deg, ${heroBase} 0%, ${heroMid} 52%, ${heroBase} 100%)`,
        border: `1px solid ${alpha(T.blueL, 0.35)}`,
        boxShadow: `0 18px 44px ${alpha(T.blue, T.dark ? 0.22 : 0.2)}`,
      }}>
        {/* ondas decorativas nos cantos inferiores */}
        <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, bottom: 0, width: isMobile ? '70%' : '32%', height: '55%', pointerEvents: 'none' }}>
          <path d="M0 30 C 90 40, 170 80, 260 120 L0 120 Z" fill={alpha(glow, 0.22)} />
          <path d="M0 70 C 70 78, 130 100, 180 120 L0 120 Z" fill={alpha(glow, 0.18)} />
        </svg>
        <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="none"
          style={{ position: 'absolute', right: 0, bottom: 0, width: isMobile ? '60%' : '26%', height: '48%', pointerEvents: 'none' }}>
          <path d="M400 10 C 330 60, 250 100, 140 120 L400 120 Z" fill={alpha(glow, 0.2)} />
        </svg>

        {/* título */}
        <div className="pk-hero-title" style={{ position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 30 }}>
          <div style={{
            width: isMobile ? 64 : 130, height: isMobile ? 64 : 130, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(circle at 50% 40%, ${alpha(glow, 0.28)}, ${alpha(glow, 0.06)} 70%)`,
            border: `1px solid ${alpha(accentCor, 0.22)}`,
          }}>
            <div style={{
              width: isMobile ? 44 : 84, height: isMobile ? 44 : 84, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: alpha(glow, 0.14), boxShadow: `0 0 34px ${alpha(glow, 0.35)}`,
            }}>
              <Ico d={icon} size={isMobile ? 26 : 50} stroke="#FFFFFF" sw={2.2} />
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, letterSpacing: '.06em', color: accentCor, marginBottom: 4 }}>{kicker}</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: isMobile ? 23 : 36, fontWeight: 700, color: '#fff', lineHeight: 1.12, letterSpacing: '-.015em' }}>
              {title} <span style={{ color: accentCor, whiteSpace: 'nowrap' }}>{accent}</span>
            </div>
            {!isMobile && subtitle && (
              <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,.72)', marginTop: 10, lineHeight: 1.55, maxWidth: 470 }}>{subtitle}</div>
            )}
          </div>
        </div>

        {/* card de saldo */}
        <div style={{
          position: 'relative', minWidth: 0, boxSizing: 'border-box',
          borderRadius: 18, padding: isMobile ? '18px 16px' : '20px 28px 20px 32px',
          background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.14)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(glow, 0.3), border: `1px solid ${alpha(accentCor, 0.25)}` }}>
              <Ico d={card.icon} size={22} stroke="#FFFFFF" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '.04em', color: 'rgba(255,255,255,.9)', marginTop: 3 }}>{card.label}</div>
              <div style={{ fontSize: isMobile ? 36 : 46, fontWeight: 800, color: card.negative ? '#FFB3BE' : '#FFFFFF', letterSpacing: '-.02em', lineHeight: 1.05, marginTop: 4 }}>
                {card.value}
              </div>
              {card.note && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>{card.note}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? '12px 18px' : '10px 28px', marginTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{card.stats}</div>
            {card.aside && <>
              {!isMobile && <div style={{ width: 1, alignSelf: 'stretch', minHeight: 40, background: 'rgba(255,255,255,.14)' }} />}
              {card.aside}
            </>}
          </div>
        </div>

        {/* ação */}
        {action && (
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="pk-cta" onClick={action.onClick} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              height: isMobile ? 50 : 62, padding: '0 26px 0 30px', borderRadius: 999,
              border: `1px solid ${alpha('#FFFFFF', 0.22)}`,
              background: T.dark
                ? `linear-gradient(135deg, ${mix(T.blue, '#0B0A1E', 0.38)}, ${mix(T.blue, '#0B0A1E', 0.1)})`
                : `linear-gradient(135deg, ${T.blue}, ${mix(T.blue, '#FFFFFF', 0.22)})`,
              boxShadow: `0 8px 24px ${alpha(T.blueL, 0.35)}`,
              color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)', outline: 'none', whiteSpace: 'nowrap',
            }}>
              <Ico d={action.icon} size={21} stroke="#fff" />
              {action.label}
              <Ico d={G.chevR} size={17} stroke="#fff" sw={2.2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Linha de estatística dentro do card de saldo.
export const HeroStat = ({ icon, color, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'rgba(255,255,255,.86)', whiteSpace: 'nowrap' }}>
    <Ico d={icon} size={19} stroke={color} />
    {label} <strong style={{ color: '#fff', fontWeight: 600 }}>{value}</strong>
  </div>
);

export const HeroChip = ({ icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: mix(T.blueL, '#FFFFFF', 0.38) }}>
    <span style={{ width: 22, height: 22, borderRadius: '50%', background: alpha(T.blueL, 0.35), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Ico d={icon} size={14} stroke="#FFFFFF" sw={2} />
    </span>
    {children}
  </div>
);

export const HeroAside = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <Ico d={icon} size={21} stroke="rgba(255,255,255,.85)" />
    <div>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.7)' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{value}</div>
    </div>
  </div>
);

// ── Card de seção: ícone redondo + título/subtítulo + ferramentas à direita ──
// bar = linha de filtros de largura total abaixo do cabeçalho; barCols = colunas (CSS grid) no desktop.
export const SectionCard = ({ isMobile, icon, title, subtitle, tools, bar, barCols, children, style, bodyRef }) => (
  <div ref={bodyRef} style={{ containerType: 'inline-size', marginBottom: 22, scrollMarginTop: 70, ...style }}>
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: T.sh,
      padding: isMobile ? '18px 14px' : '26px 30px 30px', boxSizing: 'border-box',
    }}>
      <div className="pk-head" style={{ marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 26 }}>
          <div style={{
            width: isMobile ? 46 : 64, height: isMobile ? 46 : 64, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(circle at 50% 35%, ${alpha(T.blueL, 0.28)}, ${alpha(T.blue, 0.1)})`,
            color: T.dark ? '#fff' : T.blue,
          }}>
            <Ico d={icon} size={isMobile ? 22 : 30} sw={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 19 : 24, fontWeight: 700, color: T.text, letterSpacing: '-.01em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: isMobile ? 12.5 : 15, color: T.textS, marginTop: 2 }}>{subtitle}</div>}
          </div>
        </div>
        {tools && <div className="pk-tools">{tools}</div>}
      </div>
      {bar && <div className="pk-bar" style={{ '--pk-cols': barCols || 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 16 }}>{bar}</div>}
      {children}
    </div>
  </div>
);

const fieldBase = () => ({
  height: 44, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surfaceInput || T.surfaceSub,
  color: T.text, fontFamily: 'var(--font-body)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
});

export const SearchField = ({ value, onChange, placeholder }) => (
  <label className="pk-field pk-search" style={{ ...fieldBase(), display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', cursor: 'text' }}>
    <Ico d={G.search} size={18} stroke={T.textS} />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: 'inherit' }} />
    {value && (
      <button onClick={() => onChange('')} title="Limpar" style={{ display: 'flex', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: T.textT }}>
        <Ico d={G.x} size={15} sw={2} />
      </button>
    )}
  </label>
);

// options: [[valor, rótulo], ...] ou [{ grupo, itens: [[valor, rótulo], ...] }, ...]
export const SelectField = ({ value, onChange, options, icon = G.filter, width, title }) => (
  <label className="pk-field pk-sel" title={title} style={{ ...fieldBase(), position: 'relative', display: 'flex', alignItems: 'center', ...(width ? { width } : null) }}>
    <Ico d={icon} size={17} stroke={T.text} style={{ position: 'absolute', left: 16, pointerEvents: 'none' }} />
    <select className="pk-select" value={value} onChange={e => onChange(e.target.value)}
      style={{ appearance: 'none', WebkitAppearance: 'none', width: '100%', height: '100%', padding: '0 40px 0 46px', background: 'none', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 500, cursor: 'pointer', textOverflow: 'ellipsis' }}>
      {options.map(o => Array.isArray(o)
        ? <option key={o[0]} value={o[0]}>{o[1]}</option>
        : <optgroup key={o.grupo} label={o.grupo}>{o.itens.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>)}
    </select>
    <Ico d={G.chevD} size={17} stroke={T.text} style={{ position: 'absolute', right: 16, pointerEvents: 'none' }} />
  </label>
);

export const DateField = ({ value, onChange, min, max, width }) => (
  <label className="pk-field pk-sel" style={{ ...fieldBase(), display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 0 16px', ...(width ? { width } : null) }}>
    <Ico d={G.calendar} size={17} stroke={T.text} />
    <input type="date" value={value} min={min} max={max} onChange={e => onChange(e.target.value)}
      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: value ? T.text : T.textT, fontFamily: 'inherit', fontSize: 'inherit', colorScheme: T.dark ? 'dark' : 'light' }} />
    {value && (
      <button onClick={e => { e.preventDefault(); onChange(''); }} title="Limpar dia" style={{ display: 'flex', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: T.textT }}>
        <Ico d={G.x} size={15} sw={2} />
      </button>
    )}
  </label>
);

// ── Linha expansível: faixa de cor à esquerda, bloco/ícone, textos, coluna do meio, status e seta ──
// Sem onToggle a linha é estática (sem seta, sem cursor de clique).
export const ListRow = ({ isMobile, accent, tile, title, meta, middle, status, open, onToggle, children, rowRef }) => (
  <div ref={rowRef} className="pk-row" style={{
    borderRadius: 16, border: `1px solid ${T.border}`, background: T.surfaceSub,
    boxShadow: `inset 4px 0 0 ${accent}`, overflow: 'hidden', boxSizing: 'border-box', scrollMarginTop: 80,
  }}>
    <div {...(onToggle ? {
        role: 'button', tabIndex: 0, 'aria-expanded': !!open, onClick: onToggle,
        onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } },
      } : null)}
      style={{
        display: 'grid', cursor: onToggle ? 'pointer' : 'default', outline: 'none', alignItems: 'center',
        gridTemplateColumns: isMobile ? 'auto minmax(0,1fr) auto' : 'auto minmax(0,1.1fr) 1px minmax(0,1fr) 118px auto',
        columnGap: isMobile ? 12 : 26, rowGap: 12,
        padding: isMobile ? '14px 12px 14px 16px' : '16px 22px 16px 28px',
      }}>
      {tile}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 6 }}>
        <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {meta}
      </div>
      {isMobile
        ? (onToggle ? <Ico d={G.chevR} size={18} stroke={T.textS} sw={2} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} /> : <span />)
        : <>
            <div style={{ width: 1, height: 62, background: T.border }} />
            <div style={{ minWidth: 0 }}>{middle}</div>
            {status}
            <span className="pk-chev" style={{ color: T.textS, display: 'flex', transition: 'color .16s', width: 20 }}>
              {onToggle && <Ico d={G.chevR} size={20} sw={2} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />}
            </span>
          </>}
      {isMobile && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          <div style={{ minWidth: 0 }}>{middle}</div>
          {status}
        </div>
      )}
    </div>
    {open && children && (
      <div style={{ borderTop: `1px solid ${T.border}`, padding: isMobile ? '14px 16px 16px' : '16px 28px 18px 126px', fontSize: 12.5, color: T.textS }}>
        {children}
      </div>
    )}
  </div>
);

export const MetaLine = ({ isMobile, icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 12.5 : 14, color: T.textS, flexWrap: 'wrap', minWidth: 0 }}>
    {icon && <Ico d={icon} size={16} stroke={T.textS} />}
    {children}
  </div>
);

export const Dot = () => <span style={{ color: T.textT }}>•</span>;

// Bloco quadrado com gradiente (ícone ou conteúdo livre).
export const Tile = ({ isMobile, gradient, shadow, children }) => (
  <div style={{
    width: isMobile ? 52 : 72, height: isMobile ? 52 : 72, borderRadius: isMobile ? 12 : 14, flexShrink: 0,
    background: gradient || `linear-gradient(135deg, ${T.blue}, ${T.blueL})`, color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 6px 18px ${alpha(shadow || T.blue, 0.28)}`,
  }}>
    {children}
  </div>
);

export const RED_GRAD = 'linear-gradient(135deg, #B8384C, #E0697A)';

export const Spinner = ({ label = 'Carregando...' }) => (
  <div style={{ textAlign: 'center', padding: 48, color: T.textT }}>
    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.blue}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
    {label}
  </div>
);

export const Empty = ({ icon = G.clock, title, hint }) => (
  <div style={{ textAlign: 'center', padding: '40px 12px', color: T.textT }}>
    <Ico d={icon} size={36} stroke={T.textD} sw={1.2} style={{ display: 'block', margin: '0 auto 12px', opacity: .6 }} />
    <div style={{ fontSize: 13 }}>{title}</div>
    {hint && <div style={{ fontSize: 12, marginTop: 4, opacity: .75 }}>{hint}</div>}
  </div>
);
