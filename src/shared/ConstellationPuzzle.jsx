// src/shared/ConstellationPuzzle.jsx
// Mini-jogo de "desbloqueio" pro Capture o Uniko/Número: quem já capturou 2+ vezes
// nesse sistema precisa ligar 6 estrelas, da MENOR até a MAIOR, antes de poder
// arrastar o assistente até a área de captura de novo — dá uma chance maior pra
// quem ainda não ganhou nada. Usado dentro de CaptureUnikoWidget.jsx e
// CaptureNumeroWidget.jsx (ver `mustSolvePuzzle` em cada um).
import React, { useState } from 'react';

const STAR_SIZES = [8, 12, 16, 20, 24, 28]; // raio, menor → maior (ordem certa de clique)
// Posições (% da área do puzzle) espalhadas o bastante pra nenhuma estrela grande
// encostar na vizinha mesmo no maior tamanho — a ORDEM espacial é embaralhada
// à parte (ver `order` abaixo), só os tamanhos precisam ser clicados em sequência.
const POSITIONS = [
  { x: 14, y: 74 }, { x: 32, y: 26 }, { x: 50, y: 70 },
  { x: 68, y: 22 }, { x: 84, y: 58 }, { x: 93, y: 16 },
];

const ConstellationPuzzle = ({ onSolved, accent = '#ffb020' }) => {
  // Embaralha quais POSIÇÕES recebem quais TAMANHOS — o layout muda a cada
  // tentativa, então não dá pra decorar "sempre clica no canto tal primeiro".
  const [order] = useState(() => {
    const idx = [0, 1, 2, 3, 4, 5];
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.map((posIdx, sizeIdx) => ({ size: STAR_SIZES[sizeIdx], pos: POSITIONS[posIdx] }));
  });
  const [done, setDone]   = useState(0);     // quantas estrelas já ligadas em ordem (0-6)
  const [shakeAt, setShakeAt] = useState(-1); // índice que tremeu por clique errado

  const clickStar = (i) => {
    if (i < done) return; // já ligada, ignora
    if (i !== done) { setShakeAt(i); setTimeout(() => setShakeAt(-1), 350); return; }
    const next = done + 1;
    setDone(next);
    if (next === order.length) setTimeout(() => onSolved?.(), 550);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`
        @keyframes cpShake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(calc(-50% - 4px),-50%)}75%{transform:translate(calc(-50% + 4px),-50%)}}
        @keyframes cpPop{from{transform:translate(-50%,-50%) scale(.5);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
      `}</style>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {order.slice(1, done).map((s, i) => (
          <line key={i} x1={order[i].pos.x} y1={order[i].pos.y} x2={s.pos.x} y2={s.pos.y}
            stroke={accent} strokeWidth="0.7" strokeLinecap="round" opacity=".85" />
        ))}
      </svg>
      {order.map((s, i) => {
        const lit = i < done;
        return (
          <button key={i} onClick={() => clickStar(i)} aria-label={`Estrela ${i + 1} de ${order.length}`}
            style={{
              position: 'absolute', left: `${s.pos.x}%`, top: `${s.pos.y}%`, transform: 'translate(-50%,-50%)',
              width: s.size * 2, height: s.size * 2, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
              background: lit ? `radial-gradient(circle at 35% 30%,#fff,${accent})` : 'rgba(255,255,255,.28)',
              boxShadow: lit ? `0 0 ${s.size}px ${accent}` : 'inset 0 0 0 1.5px rgba(255,255,255,.4)',
              animation: shakeAt === i ? 'cpShake .35s ease' : lit ? 'cpPop .25s ease' : 'none',
              transition: 'background .2s, box-shadow .2s',
            }} />
        );
      })}
    </div>
  );
};

export default ConstellationPuzzle;
