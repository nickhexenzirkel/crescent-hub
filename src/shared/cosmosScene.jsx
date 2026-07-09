// src/shared/cosmosScene.jsx
// Cenário cósmico reutilizável (nebulosa roxa, planetas trincados/glowing com anéis,
// buraco negro/portal, asteroides à deriva, cacos de cristal flutuando e estrelas
// piscando). Feito pro Uniko "Destruidora de Mundos" (Oficina) — mesmo espírito do
// oceanScene.jsx/vampireScene.jsx, mas sombrio/roxo e "destruição estelar". Preenche
// o elemento pai (que deve ser position:relative/absolute).
import React, { useState } from 'react';

export const COSMOS_SCENE_CSS = `
@keyframes csTwinkle{0%,100%{opacity:.25;}50%{opacity:1;}}
@keyframes csNebulaDrift{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(var(--ndx),var(--ndy)) scale(1.06);}}
@keyframes csPlanetDrift{0%,100%{transform:translate(0,0);}50%{transform:translate(var(--pdx),var(--pdy));}}
@keyframes csPlanetGlow{0%,100%{opacity:.55;}50%{opacity:1;}}
@keyframes csRingSpin{0%{transform:rotate(var(--rr0));}100%{transform:rotate(calc(var(--rr0) + 360deg));}}
@keyframes csHoleSpin{0%{transform:rotate(0deg) scale(1);}50%{transform:rotate(180deg) scale(1.08);}100%{transform:rotate(360deg) scale(1);}}
@keyframes csAsteroidDrift{0%{transform:translate(0,0) rotate(0deg);}100%{transform:translate(var(--adx),var(--ady)) rotate(var(--arot));}}
@keyframes csShardFloat{0%{transform:translate(0,0) rotate(0deg) scale(.7);opacity:0;}10%{opacity:.95;}90%{opacity:.6;}100%{transform:translate(var(--sdx),-150px) rotate(var(--srot)) scale(1);opacity:0;}}
`;

const rndN = (a, b) => a + Math.random() * (b - a);

/* ── Estrelas piscando (fundo) ── */
const Star = () => {
  const [p] = useState(() => ({ top: rndN(0, 100), left: rndN(0, 100), sz: rndN(1, 2.6), dur: rndN(1.6, 4), delay: rndN(0, 3) }));
  return (
    <div style={{
      position: 'absolute', top: `${p.top}%`, left: `${p.left}%`, width: p.sz, height: p.sz,
      borderRadius: '50%', background: '#fff', pointerEvents: 'none',
      boxShadow: '0 0 4px 1px rgba(255,255,255,.6)',
      animation: `csTwinkle ${p.dur}s ease-in-out ${p.delay}s infinite`,
    }} />
  );
};

/* ── Nebulosa roxa (blobs suaves, gradiente radial) ── */
const NebulaBlob = ({ top, left, sz, color, op = 0.4, dur = 20, delay = 0 }) => {
  const ndx = (Math.random() < 0.5 ? -1 : 1) * rndN(8, 20);
  const ndy = (Math.random() < 0.5 ? -1 : 1) * rndN(4, 12);
  return (
    <div style={{
      position: 'absolute', top, left, width: sz, height: sz * 0.7, borderRadius: '50%',
      background: `radial-gradient(ellipse at 50% 50%, ${color} 0%, transparent 72%)`,
      opacity: op, pointerEvents: 'none', filter: 'blur(1px)',
      '--ndx': `${ndx}px`, '--ndy': `${ndy}px`,
      animation: `csNebulaDrift ${dur}s ease-in-out ${delay}s infinite`,
    }} />
  );
};

/* ── Planeta trincado: esfera escura com rachaduras roxas brilhando e núcleo à mostra,
   anel opcional girando devagar. Gerado com trigonometria pra rachaduras ramificadas
   (não retas chutadas à mão). ── */
const PLANET_PALETTE = [
  { base: '#241234', crack: '#b98bff', glow: '#e6d1ff' },
  { base: '#1c0f2e', crack: '#9d6bff', glow: '#d9b8ff' },
  { base: '#2a1440', crack: '#c9a3ff', glow: '#f0e0ff' },
];
const _crackPath = (cx, cy, r, seed) => {
  // Rachadura ramificada: caminha do centro pra borda em passos curtos com leve
  // desvio angular aleatório, cria 1-2 ramos curtos no meio do caminho.
  let ang = seed * 137.5 % 360 * Math.PI / 180;
  let x = cx, y = cy, d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  const steps = 4 + Math.floor(rndN(0, 2));
  const branches = [];
  for (let i = 0; i < steps; i++) {
    ang += rndN(-0.5, 0.5);
    const len = r / steps * rndN(0.8, 1.3);
    x += Math.cos(ang) * len; y += Math.sin(ang) * len;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    if (i === 1 && Math.random() < 0.7) {
      const bAng = ang + rndN(0.6, 1.3) * (Math.random() < 0.5 ? -1 : 1);
      const bx = x + Math.cos(bAng) * len * 1.4, by = y + Math.sin(bAng) * len * 1.4;
      branches.push(`M${x.toFixed(1)} ${y.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}`);
    }
  }
  return [d, ...branches];
};
const CrackedPlanet = ({ top, left, sz = 70, ring = true, delay = 0, flip = false, dur = 14 }) => {
  const [p] = useState(() => {
    const pal = PLANET_PALETTE[Math.floor(rndN(0, PLANET_PALETTE.length))];
    const cracks = Array.from({ length: 3 }).flatMap((_, i) => _crackPath(50, 50, 44, i + rndN(0, 9)));
    const pdx = rndN(-6, 6), pdy = rndN(-5, 5);
    const rr0 = rndN(-18, 18);
    return { pal, cracks, pdx, pdy, rr0 };
  });
  return (
    <div style={{
      position: 'absolute', top, left, width: sz, height: sz, pointerEvents: 'none',
      '--pdx': `${p.pdx}px`, '--pdy': `${p.pdy}px`,
      animation: `csPlanetDrift ${dur}s ease-in-out ${delay}s infinite`,
      transform: flip ? 'scaleX(-1)' : undefined,
    }}>
      {ring && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: sz * 1.85, height: sz * 0.5,
          border: `2px solid ${p.pal.crack}99`, borderRadius: '50%',
          transform: `translate(-50%,-50%) rotate(${p.rr0}deg)`, '--rr0': `${p.rr0}deg`,
          animation: `csRingSpin ${dur * 2.4}s linear infinite`, boxShadow: `0 0 10px ${p.pal.crack}55`,
        }} />
      )}
      <svg viewBox="0 0 100 100" width={sz} height={sz} style={{ position: 'relative', display: 'block', filter: `drop-shadow(0 0 ${sz * 0.14}px ${p.pal.crack}66)` }}>
        <defs>
          <radialGradient id={`csPlanetBody${sz}${delay}`} cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#4a3068" /><stop offset="60%" stopColor={p.pal.base} /><stop offset="100%" stopColor="#0a0512" />
          </radialGradient>
          <radialGradient id={`csPlanetCore${sz}${delay}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.pal.glow} /><stop offset="55%" stopColor={p.pal.crack} /><stop offset="100%" stopColor={p.pal.crack} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill={`url(#csPlanetBody${sz}${delay})`} />
        {/* núcleo brilhando através das rachaduras */}
        <circle cx="50" cy="50" r="30" fill={`url(#csPlanetCore${sz}${delay})`} style={{ animation: `csPlanetGlow ${2.6 + delay * 0.2}s ease-in-out infinite`, mixBlendMode: 'screen' }} />
        <g stroke={p.pal.crack} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".92">
          {p.cracks.map((d, i) => <path key={i} d={d} />)}
        </g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="2" />
      </svg>
    </div>
  );
};

/* ── Buraco negro / portal: núcleo escuro com anel de energia roxa girando ── */
const BlackHole = ({ top, left, sz = 46 }) => (
  <div style={{ position: 'absolute', top, left, width: sz, height: sz, pointerEvents: 'none' }}>
    <div style={{
      position: 'absolute', inset: -sz * 0.22, borderRadius: '50%',
      background: 'conic-gradient(from 0deg, #b98bff00, #b98bffcc, #6c3bd400, #b98bffcc, #b98bff00)',
      animation: 'csHoleSpin 9s linear infinite', filter: `blur(${sz * 0.05}px)`,
    }} />
    <div style={{
      position: 'absolute', inset: sz * 0.08, borderRadius: '50%',
      background: 'radial-gradient(circle at 45% 40%, #150a24 0%, #000 70%)',
      boxShadow: 'inset 0 0 10px 2px #000, 0 0 14px 3px #9d6bff77',
    }} />
  </div>
);

/* ── Asteroide: rocha irregular (polígono trigonométrico), à deriva devagar ── */
const _rockPoints = (n, rBase) => Array.from({ length: n }).map((_, i) => {
  const a = (i / n) * Math.PI * 2;
  const r = rBase * rndN(0.68, 1);
  return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
}).join(' ');
const Asteroid = () => {
  const [p] = useState(() => ({
    top: rndN(4, 92), left: rndN(0, 90), sz: rndN(8, 20),
    adx: (Math.random() < 0.5 ? -1 : 1) * rndN(50, 130),
    ady: (Math.random() < 0.5 ? -1 : 1) * rndN(14, 40),
    arot: rndN(-70, 70), dur: rndN(14, 26), delay: rndN(0, 8),
    pts: _rockPoints(7, 40),
  }));
  return (
    <div style={{
      position: 'absolute', top: `${p.top}%`, left: `${p.left}%`, pointerEvents: 'none',
      '--adx': `${p.adx}px`, '--ady': `${p.ady}px`, '--arot': `${p.arot}deg`,
      animation: `csAsteroidDrift ${p.dur}s ease-in-out ${p.delay}s infinite alternate`,
    }}>
      <svg width={p.sz} height={p.sz} viewBox="0 0 100 100" style={{ display: 'block', filter: 'drop-shadow(0 0 3px rgba(157,107,255,.4))' }}>
        <polygon points={p.pts} fill="#2b1d3f" stroke="#8a63c9" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/* ── Caco de cristal roxo (mesmo motivo dos enfeites pendurados do Uniko) subindo devagar ── */
const CrystalShard = () => {
  const [p] = useState(() => ({
    left: rndN(2, 96), sz: rndN(6, 13), dur: rndN(9, 16), delay: rndN(0, 8),
    sdx: rndN(-16, 16), srot: rndN(-40, 40),
  }));
  return (
    <div style={{
      position: 'absolute', bottom: 4, left: `${p.left}%`, pointerEvents: 'none',
      '--sdx': `${p.sdx}px`, '--srot': `${p.srot}deg`,
      animation: `csShardFloat ${p.dur}s ease-in ${p.delay}s infinite`,
    }}>
      <svg width={p.sz} height={p.sz * 1.6} viewBox="0 0 10 16" style={{ display: 'block', filter: 'drop-shadow(0 0 3px #b98bffaa)' }}>
        <polygon points="5,0 10,6 6,16 4,16 0,6" fill="#c9a3ff" opacity=".85" />
        <polygon points="5,0 7,6 5,13 3,6" fill="#f0e0ff" opacity=".6" />
      </svg>
    </div>
  );
};

// Cenário completo — preenche o elemento pai (que deve ser position:relative/absolute).
export default function CosmosScene({ stars = 26, asteroids = 6, shards = 6, planets = 2, blackHole = true }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <style>{COSMOS_SCENE_CSS}</style>

      {/* Fundo profundo de espaço */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(140% 100% at 50% 0%, #241234 0%, #120a1e 45%, #06030c 100%)' }} />

      {/* Nebulosa roxa em camadas */}
      <NebulaBlob top="4%" left="-6%" sz={180} color="#7a4fd688" dur={24} delay={0} op={.35} />
      <NebulaBlob top="30%" left="55%" sz={160} color="#b98bff77" dur={19} delay={2} op={.3} />
      <NebulaBlob top="52%" left="10%" sz={140} color="#4a2a7a99" dur={22} delay={4} op={.32} />

      {Array.from({ length: stars }).map((_, i) => <Star key={i} />)}

      {blackHole && <BlackHole top="10%" left="46%" sz={34} />}

      {planets >= 1 && <CrackedPlanet top="6%" left="4%" sz={64} delay={0} dur={13} />}
      {planets >= 2 && <CrackedPlanet top="54%" left="72%" sz={78} delay={1.5} dur={15} flip />}
      {planets >= 3 && <CrackedPlanet top="60%" left="2%" sz={46} ring={false} delay={3} dur={11} />}

      {Array.from({ length: asteroids }).map((_, i) => <Asteroid key={i} />)}
      {Array.from({ length: shards }).map((_, i) => <CrystalShard key={i} />)}

      {/* Brilho atmosférico roxo */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 0%, #9d6bff22 0%, transparent 62%)' }} />
    </div>
  );
}
