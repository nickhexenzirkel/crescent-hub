import { T } from '../../contexts/theme';

const MSGS = {
  idle:     'Pronto para começar!',
  rc:       'Baixando Relatórios de Consumo...',
  os:       'Baixando Ordens de Serviço...',
  building: 'Montando o ZIP final...',
  done:     'Tudo certo! ZIP baixado.',
  error:    'Algo deu errado. Veja o log abaixo.',
};

const CONFETTI = [
  { deg: 0,   color: '#D4A84B' }, { deg: 45,  color: '#68D391' },
  { deg: 90,  color: '#90CDF4' }, { deg: 135, color: '#F6E05E' },
  { deg: 180, color: '#FC8181' }, { deg: 225, color: '#B794F4' },
  { deg: 270, color: '#68D391' }, { deg: 315, color: '#D4A84B' },
];

export const CatbotStatus = ({ phase, doneText }) => {
  const isDone  = phase === 'done';
  const isError = phase === 'error';
  const isWork  = ['rc', 'os', 'building'].includes(phase);
  const isIdle  = phase === 'idle';

  if (isIdle) return null;

  const msg = (isDone && doneText) ? doneText : MSGS[phase] || '';

  const catAnim = isDone  ? 'cbDone 0.85s cubic-bezier(.36,.07,.19,.97) both'
               : isError  ? 'cbShake 0.55s ease-out'
               : isWork   ? 'cbBounce 1s ease-in-out infinite'
               : 'cbFloat 3s ease-in-out infinite';

  const bg  = isDone  ? 'rgba(26,156,112,.08)'
            : isError ? 'rgba(192,64,80,.07)'
            : T.goldGl;
  const bdr = isDone  ? 'rgba(26,156,112,.28)'
            : isError ? 'rgba(192,64,80,.22)'
            : `${T.gold}33`;
  const tc  = isDone  ? '#1A9C70'
            : isError ? '#FC8181'
            : T.text;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18,
      padding: '14px 18px', borderRadius: 16, marginBottom: 14,
      background: bg, border: `1px solid ${bdr}`,
      transition: 'background .3s, border-color .3s',
    }}>
      <style>{`
        @keyframes cbFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes cbBounce { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-13px) rotate(4deg)} }
        @keyframes cbDone   { 0%{transform:scale(1) rotate(0)} 25%{transform:scale(1.3) translateY(-22px) rotate(-10deg)} 55%{transform:scale(1.12) translateY(-9px) rotate(7deg)} 80%{transform:scale(1.04) translateY(-3px) rotate(-2deg)} 100%{transform:scale(1) translateY(0) rotate(0)} }
        @keyframes cbShake  { 0%,100%{transform:translateX(0) rotate(0)} 15%{transform:translateX(-11px) rotate(-6deg)} 30%{transform:translateX(11px) rotate(6deg)} 50%{transform:translateX(-8px) rotate(-4deg)} 70%{transform:translateX(8px) rotate(4deg)} 85%{transform:translateX(-4px)} }
        @keyframes cbRing   { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.85;transform:scale(1.16)} }
        @keyframes cbGlow   { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes cbPop    { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0.2)} }
        @keyframes cbDot    { 0%,70%,100%{opacity:.2;transform:scale(.75)} 35%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Catbot ── */}
      <div style={{ position: 'relative', flexShrink: 0, width: 76, height: 76 }}>

        {/* Pulsing ring — working */}
        {isWork && (
          <div style={{
            position: 'absolute', inset: -7, borderRadius: '50%',
            border: `2.5px solid ${T.gold}`,
            animation: 'cbRing 1s ease-in-out infinite',
            pointerEvents: 'none',
          }}/>
        )}

        {/* Done glow */}
        {isDone && (
          <div style={{
            position: 'absolute', inset: -18,
            background: 'radial-gradient(circle, rgba(26,156,112,.45) 0%, transparent 70%)',
            borderRadius: '50%', animation: 'cbGlow 1.8s ease-in-out infinite',
            pointerEvents: 'none',
          }}/>
        )}

        {/* Confetti particles */}
        {isDone && CONFETTI.map(({ deg, color }, i) => (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: i % 2 === 0 ? 8 : 5, height: i % 2 === 0 ? 8 : 5,
            borderRadius: i % 3 === 0 ? '50%' : 2,
            background: color,
            '--tx': `${Math.round(Math.cos(deg * Math.PI / 180) * 42)}px`,
            '--ty': `${Math.round(Math.sin(deg * Math.PI / 180) * 42)}px`,
            animation: `cbPop 0.75s ${i * 0.065}s ease-out both`,
            pointerEvents: 'none',
          }}/>
        ))}

        <img
          src="/Unikocatbot.png"
          alt="Uniko Catbot"
          style={{
            width: 76, height: 76, objectFit: 'contain',
            position: 'relative', zIndex: 1,
            animation: catAnim,
            filter: isError ? 'grayscale(.4) hue-rotate(170deg)' : 'none',
            transition: 'filter .3s',
          }}
        />
      </div>

      {/* ── Bubble ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: tc,
          lineHeight: 1.4, transition: 'color .3s',
        }}>
          {msg}
        </div>

        {/* Working dots */}
        {isWork && (
          <div style={{ display: 'flex', gap: 5, marginTop: 7, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: T.gold,
                animation: `cbDot 1.3s ${i * 0.18}s ease-in-out infinite`,
              }}/>
            ))}
          </div>
        )}

        {/* Done row */}
        {isDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#1A9C70" strokeWidth="2.8" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontSize: 12, color: '#1A9C70', fontWeight: 500 }}>Processo finalizado</span>
          </div>
        )}

        {/* Error row */}
        {isError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#FC8181" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontSize: 12, color: '#FC8181', fontWeight: 500 }}>Verifique o log abaixo</span>
          </div>
        )}
      </div>
    </div>
  );
};
