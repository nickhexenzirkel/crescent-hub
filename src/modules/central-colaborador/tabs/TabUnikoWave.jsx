import React, { useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';

const TabUnikoWave = () => {
  const iframeRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const type = e.data?.type;
      if (!type) return;

      // Jogo → content script: repassa UNIKO_YT_* do iframe para a janela principal
      if (e.source === iframeRef.current?.contentWindow && type.startsWith('UNIKO_YT_')) {
        window.postMessage(e.data, '*');
        return;
      }

      // Content script → jogo: repassa YT_* da janela principal de volta ao iframe
      if (e.source === window && type.startsWith('YT_')) {
        iframeRef.current?.contentWindow?.postMessage(e.data, '*');
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
