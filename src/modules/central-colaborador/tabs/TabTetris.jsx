import React, { useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';

export const TabTetris = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 200;
    const h = canvas.height = 400;
    // fundo
    ctx.fillStyle = T.surface;
    ctx.fillRect(0, 0, w, h);
    // grade de blocos (exemplo simples)
    const blockSize = 20;
    ctx.strokeStyle = T.border;
    for (let y = 0; y < h; y += blockSize) {
      for (let x = 0; x < w; x += blockSize) {
        ctx.strokeRect(x, y, blockSize, blockSize);
      }
    }
    // texto placeholder
    ctx.fillStyle = T.text;
    ctx.font = '16px var(--font-body)';
    ctx.fillText('Tetris simples', 10, 30);
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Tetris</h2>
      <canvas ref={canvasRef} style={{ border: `1px solid ${T.border}`, background: T.surface }} />
    </div>
  );
};
