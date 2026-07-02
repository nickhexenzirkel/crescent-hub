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

/* ── Baleia (SVG): pose de humpback estilo desenho — corpo grosso arqueado, barriga
   pregueada clara, nadadeiras peitorais penduradas, cauda em leque bem na ponta,
   barbatana pequena perto da cauda. Baseada em referência de baleia real. ── */
const WHALE_PALETTE = ['#2f8f9e', '#3a9db0', '#5aa8c2'];
const WHALE_BELLY = '#eaf7f8';
const newWhalePose = () => {
  const fdx = (Math.random() < 0.5 ? -1 : 1) * rndN(90, 170);
  return {
    top: rndN(15, 42), left: rndN(0, 55), sz: Math.round(rndN(52, 72)),
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
      <svg width={pose.sz} height={pose.sz * .64} viewBox="-4 -32 90 58" style={{ display: 'block', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,.22))' }}>
        <path d="M2 14 Q8 -6 34 -16 Q52 -22 68 -18 Q78 -14 74 -6" stroke={c} strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 18 Q14 4 32 -8" stroke={WHALE_BELLY} strokeWidth="6" fill="none" strokeLinecap="round" />
        <g stroke={WHALE_BELLY} strokeWidth="1" opacity=".7" fill="none">
          <path d="M8 16 Q12 8 16 2" />
          <path d="M12 15 Q16 7 20 1" />
          <path d="M16 14 Q20 6 24 0" />
        </g>
        <ellipse cx="1" cy="14" rx="7" ry="6" fill={c} />
        <path d="M18 10 Q14 24 8 30 Q20 26 24 12 Z" fill={c} />
        <path d="M26 4 Q24 16 20 22 Q28 18 30 6 Z" fill={c} opacity=".9" />
        <path d="M56 -22 Q58 -30 63 -21 Q59 -20 56 -22 Z" fill={c} />
        <path d="M68 -18 Q80 -26 87 -18 Q80 -13 76 -10 Q82 -3 85 6 Q74 1 69 -9 Z" fill={c} />
        <path d="M71 -17 Q78 -22 82 -19" stroke={WHALE_BELLY} strokeWidth="1.5" fill="none" opacity=".7" />
        <circle cx="-2" cy="12" r="1.7" fill="#0b1a20" />
      </svg>
    </div>
  );
};

/* ── Golfinho (SVG): pose arqueada de "salto" (corpo em curva completa, focinho
   arredondado com sorriso, olho grande estilo cartoon, barbatana peitoral, barbatana
   dorsal no pico do arco, cauda em leque bem na ponta) — baseada em referência real. ── */
const DOLPHIN_PALETTE = ['#7fa0b8', '#8facc4', '#6f93ab'];
const DOLPHIN_BELLY = '#eef4f7';
const newDolphinPose = () => {
  const fdx = (Math.random() < 0.5 ? -1 : 1) * rndN(110, 200);
  return {
    top: rndN(20, 55), left: rndN(0, 55), sz: Math.round(rndN(34, 46)),
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
      <svg width={pose.sz} height={pose.sz * .68} viewBox="-6 -26 74 50" style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }}>
        <path d="M2 18 Q10 -8 28 -18 Q42 -25 56 -14 Q62 -9 60 0" stroke={c} strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 19 Q12 -2 26 -13" stroke={DOLPHIN_BELLY} strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="1" cy="17" rx="6.2" ry="5.2" fill={c} />
        <path d="M14 10 Q10 21 4 25 Q15 22 19 12 Z" fill={c} />
        <path d="M27 -19 Q29 -28 34 -18 Q30 -17 27 -19 Z" fill={c} />
        <path d="M54 -12 Q64 -20 71 -13 Q65 -9 61 -6 Q66 -1 68 8 Q59 3 55 -5 Z" fill={c} />
        <circle cx="-1" cy="14" r="2.7" fill="#fff" />
        <circle cx="-0.6" cy="14" r="1.7" fill="#1a3a5c" />
        <circle cx="0.1" cy="13.2" r=".7" fill="#fff" />
        <path d="M-5 18 Q0 22.5 6.5 19" stroke="#33465a" strokeWidth="1.3" fill="none" strokeLinecap="round" />
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

      {/* Brilho atmosférico azul-turquesa */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 0%, #7ee8fa22 0%, transparent 62%)' }} />
    </div>
  );
}
