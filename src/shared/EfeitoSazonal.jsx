// Efeitos flutuantes globais — Dashboard RH → Painéis → Modo Sazonal (ver
// shared/modoSazonal.js e os temas 'halloween'/'natal' em contexts/theme.js).
// Só transform/opacity nos keyframes, nunca filter:blur() animado — é a
// mesma lição do fundo de bolhas (shared/bolhas.js): blur animado força o
// navegador a repintar a cada frame e já derrubou FPS noutras telas deste
// app. Tudo aqui é pointer-events:none, então nunca atrapalha um clique.
import React from 'react';
import { useModoSazonal } from './modoSazonal';

const HALLOWEEN_CSS = `
@keyframes sazVoarMorcego {
  0%   { transform: translate(-10vw, 70vh) scale(.8); opacity: 0; }
  8%   { opacity: .85; }
  50%  { transform: translate(55vw, 15vh) scale(1.1); }
  92%  { opacity: .85; }
  100% { transform: translate(115vw, 55vh) scale(.9); opacity: 0; }
}
@keyframes sazBobPumpkin {
  0%,100% { transform: translateY(0) rotate(-4deg); }
  50%     { transform: translateY(-10px) rotate(4deg); }
}
@keyframes sazDerivaNuvem {
  0%   { transform: translateX(-15vw); }
  100% { transform: translateX(115vw); }
}
@keyframes sazRaio {
  0%, 91%, 100% { opacity: 0; }
  92%, 94.5%    { opacity: .38; }
  93.2%         { opacity: .05; }
  95.5%         { opacity: .20; }
}
@keyframes sazSkel {
  0%,100% { opacity: .5; transform: translateY(0) scale(1); }
  50%     { opacity: .9; transform: translateY(-6px) scale(1.08); }
}
`;

const NATAL_CSS = `
@keyframes sazNeve {
  0%   { transform: translate(0, -10vh) rotate(0deg); opacity: 0; }
  10%  { opacity: .9; }
  90%  { opacity: .9; }
  100% { transform: translate(var(--drift,20px), 110vh) rotate(360deg); opacity: 0; }
}
@keyframes sazTrenoSaz {
  0%   { transform: translate(-15vw, 0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate(120vw, 0); opacity: 0; }
}
@keyframes sazSway {
  0%,100% { transform: rotate(-3deg); }
  50%     { transform: rotate(3deg); }
}
@keyframes sazTwinkle {
  0%,100% { opacity: .6; transform: scale(1); }
  50%     { opacity: 1;  transform: scale(1.35); }
}
`;

const wrapStyle = { position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none', overflow: 'hidden' };

const EfeitoHalloween = () => {
  const morcegos = [
    { top: '10%', dur: '16s', delay: '0s', size: 26 },
    { top: '28%', dur: '21s', delay: '-6s', size: 20 },
    { top: '46%', dur: '18s', delay: '-11s', size: 24 },
  ];
  const nuvens = [
    { top: '5%', dur: '60s', delay: '0s', size: 90, op: .14 },
    { top: '15%', dur: '82s', delay: '-24s', size: 130, op: .10 },
  ];
  return (
    <div style={wrapStyle} aria-hidden="true">
      <style>{HALLOWEEN_CSS}</style>
      {/* raio — flash geral, bem ocasional */}
      <div style={{ position: 'absolute', inset: 0, background: '#C9A8FF', animation: 'sazRaio 13s linear infinite' }}/>
      {nuvens.map((n, i) => (
        <div key={'nv' + i} style={{ position: 'absolute', top: n.top, left: 0, fontSize: n.size, opacity: n.op,
          animation: `sazDerivaNuvem ${n.dur} linear ${n.delay} infinite` }}>☁️</div>
      ))}
      {morcegos.map((m, i) => (
        <div key={'mc' + i} style={{ position: 'absolute', top: m.top, left: 0, fontSize: m.size,
          animation: `sazVoarMorcego ${m.dur} ease-in-out ${m.delay} infinite` }}>🦇</div>
      ))}
      <div style={{ position: 'absolute', bottom: 18, left: '6%', fontSize: 40, animation: 'sazBobPumpkin 4.5s ease-in-out infinite' }}>🎃</div>
      <div style={{ position: 'absolute', bottom: 14, right: '8%', fontSize: 30, animation: 'sazBobPumpkin 5.5s ease-in-out -2s infinite' }}>🎃</div>
      <div style={{ position: 'absolute', bottom: 74, right: '4%', fontSize: 26, animation: 'sazSkel 3.4s ease-in-out infinite' }}>💀</div>
    </div>
  );
};

const EfeitoNatal = () => {
  const flocos = Array.from({ length: 16 }, (_, i) => ({
    left: `${(i * 6.3) % 100}%`, dur: `${9 + (i % 5) * 2}s`, delay: `-${(i * 1.7) % 14}s`,
    size: 12 + (i % 3) * 6, drift: `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 3) * 10)}px`,
  }));
  return (
    <div style={wrapStyle} aria-hidden="true">
      <style>{NATAL_CSS}</style>
      {flocos.map((f, i) => (
        <div key={'fl' + i} style={{ position: 'absolute', top: 0, left: f.left, fontSize: f.size, color: '#fff',
          '--drift': f.drift, animation: `sazNeve ${f.dur} linear ${f.delay} infinite` }}>❄️</div>
      ))}
      <div style={{ position: 'absolute', top: '14%', left: 0, fontSize: 34, animation: 'sazTrenoSaz 22s linear -5s infinite' }}>🦌🛷🎅</div>
      <div style={{ position: 'absolute', bottom: 16, left: '5%', fontSize: 54, transformOrigin: 'bottom center', animation: 'sazSway 5s ease-in-out infinite' }}>🎄</div>
      <div style={{ position: 'absolute', bottom: 72, left: '8.5%', fontSize: 18, animation: 'sazTwinkle 1.8s ease-in-out infinite' }}>⭐</div>
    </div>
  );
};

const EfeitoSazonal = () => {
  const modo = useModoSazonal();
  if (modo === 'halloween') return <EfeitoHalloween/>;
  if (modo === 'natal') return <EfeitoNatal/>;
  return null;
};

export default EfeitoSazonal;
