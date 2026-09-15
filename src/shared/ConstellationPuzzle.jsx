// src/shared/ConstellationPuzzle.jsx
// Mini-jogo de "desbloqueio" pro Capture o Uniko/Número: quem já capturou 2+ vezes
// nesse sistema precisa ligar 6 estrelas, da MENOR até a MAIOR, antes de poder
// arrastar o assistente até a área de captura de novo — dá uma chance maior pra
// quem ainda não ganhou nada. Usado dentro de CaptureUnikoWidget.jsx e
// CaptureNumeroWidget.jsx (ver `mustSolvePuzzle` em cada um).
//
// Layout FIXO (não embaralha posição) — pedido explícito do usuário: antes as
// estrelas apareciam espalhadas em cantos aleatórios sem relação com o tamanho,
// confuso ("cada uma está em um canto diferente"). Agora ficam num caminho só,
// crescendo da esquerda pra direita — 1 é a menor, 6 é a maior, na ordem visual
// óbvia — com um número em cada uma pra não deixar dúvida.
//
// Interação por ARRASTAR (pedido do usuário): segura em qualquer ponto e desliza
// passando pelas estrelas em ordem, sem precisar soltar e clicar uma por uma —
// igual um padrão de desbloqueio. Clique direto na próxima estrela também
// continua funcionando (acessibilidade/mouse).
import React, { useState, useRef } from 'react';

const STARS = [
  { n: 1, size: 8,  x: 10, y: 82 },
  { n: 2, size: 12, x: 26, y: 64 },
  { n: 3, size: 16, x: 42, y: 72 },
  { n: 4, size: 20, x: 58, y: 48 },
  { n: 5, size: 24, x: 74, y: 56 },
  { n: 6, size: 28, x: 90, y: 24 },
];

const ConstellationPuzzle = ({ onSolved, accent = '#ffb020' }) => {
  const [done, setDone]       = useState(0);  // quantas estrelas já ligadas em ordem (0-6)
  const [shakeAt, setShakeAt] = useState(-1); // índice que tremeu por clique errado
  const containerRef = useRef(null);
  const draggingRef   = useRef(false);
  const doneRef        = useRef(0); // espelha `done` sem defasagem durante o arrastar (vários pointermove por render)

  const advance = () => {
    const next = doneRef.current + 1;
    doneRef.current = next;
    setDone(next);
    if (next === STARS.length) setTimeout(() => onSolved?.(), 550);
  };

  const clickStar = (i) => {
    if (i < doneRef.current) return; // já ligada, ignora
    if (i !== doneRef.current) { setShakeAt(i); setTimeout(() => setShakeAt(-1), 350); return; }
    advance();
  };

  // Checa se o ponteiro está perto o bastante da PRÓXIMA estrela esperada; se
  // sim, acende — permite deslizar por várias seguidas num só gesto contínuo.
  const checkDragPoint = (clientX, clientY) => {
    if (doneRef.current >= STARS.length) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Permite ligar mais de uma estrela por movimento (swipe rápido pula frames).
    for (let guard = 0; guard < STARS.length - doneRef.current; guard++) {
      const target = STARS[doneRef.current];
      if (!target) break;
      const px = ((clientX - rect.left) / rect.width) * 100;
      const py = ((clientY - rect.top) / rect.height) * 100;
      const dx = (px - target.x) * (rect.width / 100);
      const dy = (py - target.y) * (rect.height / 100);
      const dist = Math.hypot(dx, dy);
      const hitRadius = Math.max(26, target.size * 1.7); // generoso — dedo/mouse não precisa ser exato
      if (dist <= hitRadius) advance();
      else break;
    }
  };

  const onPointerDown = (e) => {
    draggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    checkDragPoint(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    checkDragPoint(e.clientX, e.clientY);
  };
  const endDrag = () => { draggingRef.current = false; };

  return (
    <div ref={containerRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={endDrag}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <style>{`
        @keyframes cpShake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(calc(-50% - 4px),-50%)}75%{transform:translate(calc(-50% + 4px),-50%)}}
        @keyframes cpPop{from{transform:translate(-50%,-50%) scale(.5);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
      `}</style>
      {/* Trilha fantasma mostrando o caminho inteiro (1→6) desde o início, bem fraca,
          pra deixar a ordem óbvia antes mesmo de clicar em nada. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {STARS.slice(1).map((s, i) => (
          <line key={`ghost${i}`} x1={STARS[i].x} y1={STARS[i].y} x2={s.x} y2={s.y}
            stroke="#fff" strokeWidth="0.5" strokeDasharray="2,2" opacity=".22" />
        ))}
        {STARS.slice(1, done).map((s, i) => (
          <line key={`lit${i}`} x1={STARS[i].x} y1={STARS[i].y} x2={s.x} y2={s.y}
            stroke={accent} strokeWidth="0.8" strokeLinecap="round" opacity=".9" />
        ))}
      </svg>
      {STARS.map((s, i) => {
        const lit = i < done;
        const next = i === done;
        return (
          <button key={s.n} onClick={() => clickStar(i)} aria-label={`Estrela ${s.n} de ${STARS.length}`}
            style={{
              position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)',
              width: s.size * 2, height: s.size * 2, borderRadius: '50%', border: next ? `1.5px solid ${accent}` : 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none',
              background: lit ? `radial-gradient(circle at 35% 30%,#fff,${accent})` : 'rgba(255,255,255,.28)',
              boxShadow: lit ? `0 0 ${s.size}px ${accent}` : next ? `0 0 ${Math.max(6, s.size * .6)}px ${accent}aa` : 'inset 0 0 0 1.5px rgba(255,255,255,.4)',
              animation: shakeAt === i ? 'cpShake .35s ease' : lit ? 'cpPop .25s ease' : 'none',
              transition: 'background .2s, box-shadow .2s',
              fontSize: Math.max(9, s.size * .68), fontWeight: 800, color: lit ? '#3a2400' : '#fff', fontFamily: 'var(--font-body)', lineHeight: 1,
            }}>
            {s.n}
          </button>
        );
      })}
    </div>
  );
};

export default ConstellationPuzzle;
