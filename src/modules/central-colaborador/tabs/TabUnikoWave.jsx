import React, { useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { SHead } from '../../../shared/components';

const TabUnikoWave = () => {
  const iframeRef = useRef(null);

  // Escuta mensagens do jogo (para futuras extensões)
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'uw_xp') {
        // XP já é gravado no localStorage diretamente pelo jogo
        // Este handler existe para extensões futuras
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.page }}>
      <iframe
        ref={iframeRef}
        src="/unikowave/index.html"
        title="Uniko Wave"
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
        allow="autoplay; fullscreen"
      />
    </div>
  );
};

export { TabUnikoWave };
