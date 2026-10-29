import { T } from '../../../contexts/theme';

const GameAdminBanner = ({ visible }) => visible ? (
  <div role="status" aria-live="polite" style={{
    position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: '50%',
    transform: 'translateX(-50%)', zIndex: 11000, width: 'max-content',
    maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box', padding: '10px 16px',
    borderRadius: 999, border: `1px solid ${T.gold || '#F0B429'}`,
    background: T.surface || '#fff', color: T.text, boxShadow: T.sh,
    fontSize: 13, fontWeight: 800, lineHeight: 1.4, textAlign: 'center',
    pointerEvents: 'none',
  }}>
    Há um administrador presente. Esta partida gerará bônus de vitória!
  </div>
) : null;

export default GameAdminBanner;
