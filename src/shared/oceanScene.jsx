// src/shared/oceanScene.jsx
// Cenário de recife de corais reutilizável (raios de luz suaves, bolhas subindo, corais
// coloridos, água-vivas flutuando e peixinhos nadando). Usado pelo Uniko Sereia — mesmo
// espírito do vampireScene.jsx, mas calmo/suave em vez de sombrio. Preenche o elemento
// pai (que deve ser position:relative/absolute).
import React, { useState, useEffect, useRef } from 'react';

export const OCEAN_SCENE_CSS = `
@keyframes osRayDrift{0%,100%{opacity:.22;transform:translateX(0) skewX(-12deg);}50%{opacity:.4;transform:translateX(10px) skewX(-12deg);}}
@keyframes osBubbleRise{0%{transform:translate(0,0) scale(.7);opacity:0;}8%{opacity:.85;}92%{opacity:.5;}100%{transform:translate(var(--bx),-160px) scale(1);opacity:0;}}
@keyframes osJellyFloat{0%,100%{transform:translate(0,0);}25%{transform:translate(calc(var(--jdx) * .4),-10px);}50%{transform:translate(var(--jdx),-4px);}75%{transform:translate(calc(var(--jdx) * .5),6px);}}
@keyframes osJellyPulse{0%,100%{transform:scaleY(1) scaleX(1);}50%{transform:scaleY(.82) scaleX(1.08);}}
@keyframes osFishSwim{0%{transform:translateX(0) translateY(0);}25%{transform:translateX(calc(var(--fdx) * .5)) translateY(-6px);}50%{transform:translateX(var(--fdx)) translateY(0);}75%{transform:translateX(calc(var(--fdx) * .5)) translateY(6px);}100%{transform:translateX(0) translateY(0);}}
@keyframes osFishTail{0%,100%{transform:rotate(-14deg);}50%{transform:rotate(14deg);}}
@keyframes osCoralSway{0%,100%{transform:rotate(-2.5deg);}50%{transform:rotate(2.5deg);}}
@keyframes osCaustic{0%,100%{opacity:.10;}50%{opacity:.22;}}
`;

const rndN = (a, b) => a + Math.random() * (b - a);

/* ── Bolhas subindo ── */
const SeaBubble = () => {
  const [pose, setPose] = useState(() => ({ left: rndN(4, 96), sz: rndN(4, 12), dur: rndN(6, 12), bx: rndN(-14, 14) }));
  useEffect(() => {
    const cycle = () => setPose({ left: rndN(4, 96), sz: rndN(4, 12), dur: rndN(6, 12), bx: rndN(-14, 14) });
    const id = setInterval(cycle, pose.dur * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose.dur]);
  return (
    <div style={{
      position: 'absolute', bottom: 6, left: `${pose.left}%`, width: pose.sz, height: pose.sz,
      borderRadius: '50%', pointerEvents: 'none',
      background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.9), rgba(180,240,255,.25) 60%, transparent 75%)',
      border: '1px solid rgba(220,250,255,.5)',
      '--bx': `${pose.bx}px`,
      animation: `osBubbleRise ${pose.dur}s ease-in infinite`,
    }} />
  );
};

/* ── Água-viva (SVG): sino translúcido + tentáculos ondulando ── */
const JELLY_PALETTE = ['#ff9ad5', '#b28dff', '#7ee8fa', '#ffd166', '#8affc1'];
const newJellyPose = () => ({
  top: rndN(4, 30), left: rndN(4, 88), sz: Math.round(rndN(26, 44)),
  jdx: (Math.random() < 0.5 ? -1 : 1) * rndN(14, 40),
  dur: rndN(7, 13), delay: rndN(0, 4), color: JELLY_PALETTE[Math.floor(rndN(0, JELLY_PALETTE.length))],
});
const Jellyfish = () => {
  const [pose] = useState(newJellyPose);
  const c = pose.color;
  return (
    <div style={{
      position: 'absolute', top: `${pose.top}%`, left: `${pose.left}%`, pointerEvents: 'none',
      opacity: .88, '--jdx': `${pose.jdx}px`,
      animation: `osJellyFloat ${pose.dur}s ease-in-out ${pose.delay}s infinite`,
    }}>
      <svg width={pose.sz} height={pose.sz * 1.6} viewBox="0 0 40 64" style={{ display: 'block', animation: `osJellyPulse ${2.4 + pose.delay * .1}s ease-in-out infinite`, transformOrigin: '50% 20%' }}>
        <path d="M4 22 Q4 2 20 2 Q36 2 36 22 Q36 28 20 28 Q4 28 4 22 Z" fill={c} opacity=".78" />
        <path d="M8 20 Q20 26 32 20" stroke="rgba(255,255,255,.5)" strokeWidth="1.4" fill="none" />
        {[8, 15, 20, 25, 32].map((x, i) => (
          <path key={i} d={`M${x} 27 Q${x + (i % 2 ? 4 : -4)} 42 ${x} 58`} stroke={c} strokeWidth="2" fill="none" opacity=".55" strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
};

/* ── Peixinho (SVG): corpo + cauda balançando, nada de um lado a outro ── */
const FISH_PALETTE = ['#ff8a65', '#ffd54f', '#4fd1c5', '#f472b6', '#60a5fa'];
const newFishPose = () => {
  const fdx = (Math.random() < 0.5 ? -1 : 1) * rndN(60, 140);
  // O SVG (olho/cabeça em x=6, cauda em x=26-30) fica de cara pra ESQUERDA por padrão —
  // só espelha (scaleX(-1)) quando o trajeto (fdx) vai pra DIREITA, senão nada de costas.
  return {
    top: rndN(38, 78), left: rndN(0, 70), sz: Math.round(rndN(16, 26)),
    fdx, dur: rndN(6, 11), delay: rndN(0, 5), flip: fdx > 0,
    color: FISH_PALETTE[Math.floor(rndN(0, FISH_PALETTE.length))],
  };
};
const Fish = () => {
  const [pose] = useState(newFishPose);
  const c = pose.color;
  return (
    <div style={{
      position: 'absolute', top: `${pose.top}%`, left: `${pose.left}%`, pointerEvents: 'none',
      '--fdx': `${pose.fdx}px`, opacity: .92,
      animation: `osFishSwim ${pose.dur}s ease-in-out ${pose.delay}s infinite`,
      transform: pose.flip ? 'scaleX(-1)' : undefined,
    }}>
      <svg width={pose.sz} height={pose.sz * .7} viewBox="0 0 30 20" style={{ display: 'block', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.2))' }}>
        <g style={{ animation: 'osFishTail 1s ease-in-out infinite', transformOrigin: '26px 10px' }}>
          <polygon points="26,10 30,3 30,17" fill={c} opacity=".85" />
        </g>
        <ellipse cx="14" cy="10" rx="12" ry="7" fill={c} />
        <circle cx="6" cy="8" r="1.6" fill="#0b1a20" />
        <path d="M14 4 L18 0 L18 6 Z" fill={c} opacity=".7" />
      </svg>
    </div>
  );
};

/* ── Baleia (SVG): pose HORIZONTAL/nivelada (não arqueada — a versão em "salto" ficava
   torta/diagonal e ilegível em telas pequenas). Corpo oval gordo, barriga pregueada
   clara, nadadeira peitoral, barbatana pequena e cauda em leque — nível, sem torção. ── */
const WHALE_PALETTE = ['#2f8f9e', '#3a9db0', '#5aa8c2'];
const WHALE_BELLY = '#eaf7f8';
const newWhalePose = () => {
  const fdx = (Math.random() < 0.5 ? -1 : 1) * rndN(90, 170);
  return {
    top: rndN(15, 42), left: rndN(0, 55), sz: Math.round(rndN(58, 82)),
    fdx, dur: rndN(17, 26), delay: rndN(0, 10), flip: fdx > 0,
    color: WHALE_PALETTE[Math.floor(rndN(0, WHALE_PALETTE.length))],
  };
};
const Whale = () => {
  const [pose] = useState(newWhalePose);
  const c = pose.color;
  return (
    <div style={{
      position: 'absolute', top: `${pose.top}%`, left: `${pose.left}%`, pointerEvents: 'none',
      '--fdx': `${pose.fdx}px`, opacity: .9, zIndex: 0,
      animation: `osFishSwim ${pose.dur}s ease-in-out ${pose.delay}s infinite`,
      transform: pose.flip ? 'scaleX(-1)' : undefined,
    }}>
      <svg width={pose.sz} height={pose.sz * .4} viewBox="-2 -8 100 40" style={{ display: 'block', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.22))' }}>
        <ellipse cx="32" cy="16" rx="28" ry="13" fill={c} />
        <path d="M2 10 Q-2 16 2 22 Q5 25 10 23 Q5 19 5 15 Q4 12 2 10 Z" fill={c} />
        <ellipse cx="28" cy="25" rx="19" ry="5" fill={WHALE_BELLY} opacity=".8" />
        <path d="M20 24 Q16 34 10 38 Q20 34 24 26 Z" fill={c} />
        <path d="M56 4 Q60 -4 63 4 Q59 5 56 4 Z" fill={c} />
        <path d="M58 10 Q72 2 84 8 Q74 11 68 12 Q75 16 80 24 Q66 19 59 13 Z" fill={c} />
        <g opacity=".6">
          <circle cx="6" cy="-2" r="1.5" fill="#d8f2ff" />
          <circle cx="9" cy="-6" r="1" fill="#d8f2ff" />
        </g>
      </svg>
    </div>
  );
};

/* ── Golfinho (SVG): pose HORIZONTAL/nivelada, corpo oval, focinho com sorriso, olho
   grande estilo cartoon, barbatana peitoral, barbatana dorsal, cauda em leque — nível,
   sem a torção da versão em "salto" anterior. ── */
const DOLPHIN_PALETTE = ['#7fa0b8', '#8facc4', '#6f93ab'];
const DOLPHIN_BELLY = '#eef4f7';
const newDolphinPose = () => {
  const fdx = (Math.random() < 0.5 ? -1 : 1) * rndN(110, 200);
  return {
    top: rndN(20, 55), left: rndN(0, 55), sz: Math.round(rndN(40, 56)),
    fdx, dur: rndN(10, 17), delay: rndN(0, 8), flip: fdx > 0,
    color: DOLPHIN_PALETTE[Math.floor(rndN(0, DOLPHIN_PALETTE.length))],
  };
};
const Dolphin = () => {
  const [pose] = useState(newDolphinPose);
  const c = pose.color;
  return (
    <div style={{
      position: 'absolute', top: `${pose.top}%`, left: `${pose.left}%`, pointerEvents: 'none',
      '--fdx': `${pose.fdx}px`, opacity: .92, zIndex: 0,
      animation: `osFishSwim ${pose.dur}s ease-in-out ${pose.delay}s infinite`,
      transform: pose.flip ? 'scaleX(-1)' : undefined,
    }}>
      <svg width={pose.sz} height={pose.sz * .4} viewBox="-6 -14 84 34" style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }}>
        <ellipse cx="24" cy="10" rx="20" ry="8" fill={c} />
        <path d="M2 8 Q-4 9 -2 13 Q0 16 6 14 Q2 12 2 8 Z" fill={c} />
        <ellipse cx="22" cy="15" rx="15" ry="3.5" fill={DOLPHIN_BELLY} opacity=".85" />
        <path d="M14 14 Q11 22 6 26 Q15 23 18 15 Z" fill={c} />
        <path d="M22 -1 Q24 -10 28 -1 Q25 0 22 -1 Z" fill={c} />
        <path d="M42 6 Q56 -2 66 5 Q58 8 53 9 Q59 13 63 20 Q50 15 43 9 Z" fill={c} />
        <path d="M-4 10 Q1 14 8 11.5" stroke="#33465a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/* ── Coral ramificado (galhos arredondados, coloridos) ── */
const BranchCoral = ({ x, h = 32, s = 1, g = 118, color = '#ff8a76' }) => (
  <g style={{ animation: 'osCoralSway 5s ease-in-out infinite', transformOrigin: `${x}px ${g}px` }}>
    <g stroke={color} strokeWidth={4.5 * s} fill="none" strokeLinecap="round">
      <path d={`M${x} ${g} L${x} ${g - h}`} />
      <path d={`M${x} ${g - h * 0.5} L${x - 7 * s} ${g - h * 0.78}`} />
      <path d={`M${x} ${g - h * 0.42} L${x + 7 * s} ${g - h * 0.7}`} />
      <path d={`M${x} ${g - h * 0.82} L${x - 5 * s} ${g - h * 1.02}`} />
      <path d={`M${x} ${g - h * 0.86} L${x + 5 * s} ${g - h * 1.05}`} />
    </g>
    <g fill={color}>
      <circle cx={x} cy={g - h} r={3.2 * s} /><circle cx={x - 7 * s} cy={g - h * 0.78} r={2.6 * s} />
      <circle cx={x + 7 * s} cy={g - h * 0.7} r={2.6 * s} /><circle cx={x - 5 * s} cy={g - h * 1.02} r={2.2 * s} />
      <circle cx={x + 5 * s} cy={g - h * 1.05} r={2.2 * s} />
    </g>
  </g>
);

// Coral-cérebro (domo bolhoso) + coral-leque (semicírculo raiado) — cluster completo na base
const CoralCluster = ({ style, flip }) => (
  <svg viewBox="0 0 70 54" width="70" height="54" fill="none"
    style={{ position: 'absolute', bottom: -2, pointerEvents: 'none', zIndex: 1, transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
    {/* leque roxo */}
    <g opacity=".9">
      <path d="M6 54 Q6 18 30 14 Q54 18 54 54 Z" fill="#a78bfa" opacity=".55" />
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1="30" y1="54" x2={10 + i * 11} y2="16" stroke="#c4b5fd" strokeWidth="1.2" opacity=".8" />
      ))}
    </g>
    {/* coral-cérebro amarelo */}
    <g transform="translate(2,34)">
      <ellipse cx="12" cy="16" rx="14" ry="10" fill="#ffd76e" />
      <path d="M2 16 Q6 10 10 16 Q14 10 18 16 Q22 10 24 16" stroke="#f5a623" strokeWidth="1.4" fill="none" opacity=".7" />
    </g>
    {/* galhos coral-rosa */}
    <BranchCoral x={54} h={30} s={1}   g={54} color="#ff8a76" />
    <BranchCoral x={44} h={20} s={0.7} g={54} color="#ff6f91" />
  </svg>
);

/* ── Coral cogumelo/mesa: caule fino + capa achatada arredondada (leitura de coral bem
   diferente do coral-galho/coral-cérebro que já existiam — baseado em referências de
   coral-mesa/cogumelo). Balança de leve, igual ao coral-galho. ── */
export const MushroomCoral = ({ style, capColor = '#8bc34a', stemColor = '#c9a3e0', scale = 1 }) => (
  <svg viewBox="0 0 36 50" width={36 * scale} height={50 * scale} fill="none"
    style={{ position: 'absolute', bottom: -2, pointerEvents: 'none', zIndex: 1, ...style }}>
    <g style={{ animation: 'osCoralSway 5.4s ease-in-out infinite', transformOrigin: '18px 46px' }}>
      <rect x="16" y="22" width="4" height="24" rx="2" fill={stemColor} />
      <ellipse cx="18" cy="18" rx="16" ry="8" fill={capColor} />
      <ellipse cx="18" cy="15" rx="11" ry="4" fill="#fff" opacity=".22" />
      <ellipse cx="18" cy="22.5" rx="14" ry="2.6" fill="#000" opacity=".08" />
    </g>
  </svg>
);

/* ── Coral tubo: fileira de tubinhos com "boca" escura no topo (tipo coral-órgão). ── */
export const TubeCoral = ({ style, color = '#ff8a3d', scale = 1 }) => {
  const heights = [13, 19, 15, 22, 12];
  const w = heights.length * 9 + 4;
  return (
    <svg viewBox={`0 0 ${w} 28`} width={w * scale} height={28 * scale} fill="none"
      style={{ position: 'absolute', bottom: -2, pointerEvents: 'none', zIndex: 1, ...style }}>
      {heights.map((h, i) => {
        const x = i * 9 + 6, y = 26 - h;
        return (
          <g key={i}>
            <rect x={x - 3.4} y={y} width="6.8" height={h} rx="3" fill={color} />
            <ellipse cx={x} cy={y + 1.4} rx="2.4" ry="1.5" fill="#7a1c00" opacity=".85" />
          </g>
        );
      })}
    </svg>
  );
};

/* ── Coral bolha/uva: cacho de bolhas redondas sobrepostas — textura bem diferente do
   coral-cérebro liso e do coral-galho ramificado que já existiam. ── */
export const BubbleCoral = ({ style, color = '#c77dff', scale = 1 }) => {
  const bubbles = [
    { x: 8, y: 23, r: 7 }, { x: 19, y: 18, r: 9 }, { x: 30, y: 23, r: 7 },
    { x: 13.5, y: 12, r: 6 }, { x: 24.5, y: 11.5, r: 6.5 }, { x: 19, y: 27, r: 6 },
  ];
  return (
    <svg viewBox="0 0 38 34" width={38 * scale} height={34 * scale} fill="none"
      style={{ position: 'absolute', bottom: -2, pointerEvents: 'none', zIndex: 1, ...style }}>
      {bubbles.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={color} opacity=".92" />)}
      {bubbles.map((b, i) => <circle key={'h' + i} cx={b.x - b.r * .3} cy={b.y - b.r * .35} r={b.r * .32} fill="#fff" opacity=".28" />)}
    </svg>
  );
};

/* ── Faixa de areia no chão (duas camadas de dunas, preenche a largura toda) ── */
const SandFloor = () => (
  <svg viewBox="0 0 400 46" preserveAspectRatio="none" width="100%" height="15%"
    style={{ position: 'absolute', left: 0, right: 0, bottom: -2, pointerEvents: 'none', zIndex: 0 }}>
    <path d="M0 46 L0 24 Q40 10 90 18 Q150 28 200 16 Q260 6 320 20 Q365 30 400 18 L400 46 Z" fill="#e8c98a" opacity=".92" />
    <path d="M0 46 L0 32 Q60 22 120 30 Q200 40 280 28 Q340 20 400 32 L400 46 Z" fill="#d9b571" opacity=".9" />
  </svg>
);

/* ── Concha aberta com pérola dentro (leque rendilhado, cantos do chão) ──
   Contorno calculado como um arco de 180° com "petalas" arredondadas (tipo vieira de
   verdade), não duas linhas finas — isso é o que parecia "olho com pálpebra" antes. ── */
const PearlShell = ({ style, flip }) => (
  <svg viewBox="-2 24 64 42" width="60" height="39" fill="none"
    style={{ position: 'absolute', bottom: 2, pointerEvents: 'none', zIndex: 1, transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
    {/* corpo da concha — leque com borda rendilhada */}
    <path d="M3 56 Q-0.4 51.2 4.3 47.7 Q2.6 42 8.2 40.1 Q8.2 34.2 14.1 34.2 Q16 28.6 21.7 30.3 Q25.2 25.6 30 29 Q34.8 25.6 38.3 30.3 Q44 28.6 45.9 34.2 Q51.8 34.2 51.8 40.1 Q57.4 42 55.7 47.7 Q60.4 51.2 57 56 Q30 63 3 56 Z"
      fill="#fdf3fb" stroke="#f3b6d8" strokeWidth="1.1" />
    {/* lavagem rosa perto do topo (dobradiça) e azul na base — pede as 3 cores */}
    <path d="M14.1 34.2 Q30 26 45.9 34.2 Q38.3 30.3 30 29 Q21.7 30.3 14.1 34.2 Z" fill="#ffcbe8" opacity=".6" />
    <path d="M3 56 Q30 63 57 56 Q30 59.5 3 56 Z" fill="#bfe0fb" opacity=".55" />
    <ellipse cx="30" cy="30" rx="3.2" ry="2.4" fill="#ffb0d6" opacity=".7" />
    {/* nervuras do leque, alternando rosa e azul */}
    <g strokeWidth="1" opacity=".65" strokeLinecap="round">
      <path d="M30 57 L4.3 47.7" stroke="#f5abd4" />
      <path d="M30 57 L8.2 40.1" stroke="#a9d4f0" />
      <path d="M30 57 L14.1 34.2" stroke="#f5abd4" />
      <path d="M30 57 L21.7 30.3" stroke="#a9d4f0" />
      <path d="M30 57 L30 29" stroke="#f5abd4" />
      <path d="M30 57 L38.3 30.3" stroke="#a9d4f0" />
      <path d="M30 57 L45.9 34.2" stroke="#f5abd4" />
      <path d="M30 57 L51.8 40.1" stroke="#a9d4f0" />
      <path d="M30 57 L55.7 47.7" stroke="#f5abd4" />
    </g>
    {/* pérola branca (sem gradiente pra não colidir id entre instâncias) */}
    <circle cx="31.4" cy="48" r="7.2" fill="#cfe0f7" opacity=".4" />
    <circle cx="30" cy="46" r="7.2" fill="#fbf6ff" stroke="#e8d9f5" strokeWidth=".5" opacity=".97" />
    <circle cx="26.9" cy="42.8" r="2.2" fill="#fff" opacity=".95" />
  </svg>
);

/* ── Raios de luz suaves vindos de cima ── */
const SunRays = () => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
    {[10, 34, 58, 78].map((left, i) => (
      <div key={i} style={{
        position: 'absolute', top: -20, left: `${left}%`, width: 34, height: '140%',
        background: 'linear-gradient(180deg, rgba(255,255,255,.5) 0%, rgba(180,240,255,.12) 55%, transparent 100%)',
        animation: `osRayDrift ${7 + i}s ease-in-out ${i * 0.6}s infinite`,
      }} />
    ))}
  </div>
);

// Cenário completo — preenche o elemento pai (que deve ser position:relative/absolute).
export default function OceanScene({ jellies = 4, fish = 5, bubbles = 8, whales = true, dolphins = true }) {
  // Baleia/golfinho são raros de propósito — no máximo 1 ou 2 de cada, sorteado uma
  // vez só (não a cada render, senão trocaria de bicho o tempo todo).
  const [whaleCount] = useState(() => (whales ? 1 + Math.round(Math.random()) : 0));
  const [dolphinCount] = useState(() => (dolphins ? 1 + Math.round(Math.random()) : 0));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <style>{OCEAN_SCENE_CSS}</style>

      <SunRays />

      {/* Cintilação da água (caustics) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'repeating-linear-gradient(120deg, rgba(255,255,255,.10) 0 6px, transparent 6px 18px)',
        animation: 'osCaustic 4.5s ease-in-out infinite',
      }} />

      {Array.from({ length: whaleCount }).map((_, i) => <Whale key={i} />)}
      {Array.from({ length: dolphinCount }).map((_, i) => <Dolphin key={i} />)}
      {Array.from({ length: jellies }).map((_, i) => <Jellyfish key={i} />)}
      {Array.from({ length: fish }).map((_, i) => <Fish key={i} />)}
      {Array.from({ length: bubbles }).map((_, i) => <SeaBubble key={i} />)}

      {/* Areia cobrindo o chão inteiro (atrás dos corais/conchas) */}
      <SandFloor />

      {/* Conchas abertas com pérola, bem nos dois cantos do chão */}
      <PearlShell style={{ left: '1%' }} />
      <PearlShell style={{ right: '1%' }} flip />

      {/* Corais espalhados entre as conchas — inclusive um centralizado no meio */}
      <CoralCluster style={{ left: '19%' }} flip />
      <CoralCluster style={{ left: '50%', transform: 'translateX(-50%) scale(.85)' }} />
      <CoralCluster style={{ right: '19%' }} />

      {/* Mais tipos de coral (cogumelo/mesa + bolha) nos vãos entre concha e coral */}
      <MushroomCoral style={{ left: '8%' }} scale={.7} />
      <BubbleCoral style={{ right: '9%' }} scale={.7} />

      {/* Brilho atmosférico azul-turquesa */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 0%, #7ee8fa22 0%, transparent 62%)' }} />
    </div>
  );
}
