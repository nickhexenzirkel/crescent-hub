const GameAdminBanner = ({ visible }) => visible ? (
  <div className="game-admin-banner" role="status" aria-live="polite" style={{
    position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: '50%',
    transform: 'translateX(-50%)', zIndex: 11000, width: 'max-content',
    maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box', padding: '3px',
    borderRadius: 20,
    background: 'linear-gradient(110deg, #7C3AED, #2563EB 38%, #0891B2 72%, #10B981)',
    boxShadow: '0 8px 26px rgba(37,99,235,.35), 0 2px 8px rgba(0,0,0,.2)',
    animation: 'game-admin-banner-glow 2.8s ease-in-out infinite',
    pointerEvents: 'none',
  }}>
    <style>{`
      @keyframes game-admin-banner-glow {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(124,58,237,0)); }
        50% { filter: drop-shadow(0 0 9px rgba(124,58,237,.45)); }
      }
      @media (prefers-reduced-motion: reduce) {
        .game-admin-banner { animation: none !important; }
      }
    `}</style>
    <div className="game-admin-banner-content" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 17,
      background: 'linear-gradient(110deg, rgba(91,33,182,.96), rgba(29,78,216,.96) 42%, rgba(8,145,178,.96) 76%, rgba(5,150,105,.96))',
      color: '#fff', fontFamily: 'var(--font-body)', textAlign: 'left',
    }}>
      <span aria-hidden="true" style={{
        display: 'grid', placeItems: 'center', flexShrink: 0, width: 34, height: 34,
        borderRadius: 12, background: 'rgba(255,255,255,.2)',
        border: '1px solid rgba(255,255,255,.38)', fontSize: 19,
      }}>👑</span>
      <span style={{ minWidth: 0, fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>
        Há um administrador presente.
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, opacity: .92 }}>
          Esta partida gerará bônus de vitória!
        </span>
      </span>
      <span style={{
        flexShrink: 0, padding: '5px 8px', borderRadius: 999,
        background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.35)',
        fontSize: 9, fontWeight: 900, letterSpacing: '.07em', whiteSpace: 'nowrap',
      }}>BÔNUS ATIVO</span>
    </div>
  </div>
) : null;

export default GameAdminBanner;
