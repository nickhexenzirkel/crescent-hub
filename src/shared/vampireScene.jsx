// src/shared/vampireScene.jsx
// Cenário vampírico reutilizável (lua de sangue, nuvens escuras, relâmpagos vermelhos,
// castelo detalhado, árvores secas e morcegos com a imagem /morcego.png). Mesmo visual
// do card do Vampire-Robot na Central Alexa. Preenche o elemento pai (position:absolute).
import React, { useState, useEffect, useRef } from 'react';

export const VAMP_SCENE_CSS = `
@keyframes vsMoonPulse{0%,100%{opacity:.65;transform:scale(1);}50%{opacity:1;transform:scale(1.08);}}
@keyframes vsBatWander{0%,100%{transform:translate(0,0);}20%{transform:translate(var(--dx),calc(var(--dy) * -.6));}40%{transform:translate(calc(var(--dx) * 1.15),calc(var(--dy) * .5));}60%{transform:translate(calc(var(--dx) * .3),var(--dy));}80%{transform:translate(calc(var(--dx) * -.7),calc(var(--dy) * -.2));}}
@keyframes vsBatFlap{0%,100%{transform:scaleY(1);}50%{transform:scaleY(.84);}}
@keyframes vsCloudDrift{0%,100%{transform:translateX(0);}50%{transform:translateX(-16px);}}
@keyframes vsLightning{0%{opacity:0;}1%{opacity:1;}3%{opacity:.15;}5%{opacity:.95;}8%{opacity:0;}100%{opacity:0;}}
@keyframes vsLightningFlash{0%{opacity:0;}1.5%{opacity:.5;}4%{opacity:.12;}6%{opacity:.42;}9%{opacity:0;}100%{opacity:0;}}
@keyframes vsWinGlow{0%,100%{opacity:.12;}50%{opacity:.28;}}
`;

const rndN = (a, b) => a + Math.random() * (b - a);
const newBatPose = () => ({
  top:  rndN(0, 30),
  left: rndN(2, 86),
  dx:   (Math.random() < 0.5 ? -1 : 1) * rndN(16, 58),
  dy:   (Math.random() < 0.5 ? -1 : 1) * rndN(10, 34),
  dur:  rndN(4.5, 8),
  sz:   Math.round(rndN(24, 44)),
  flip: Math.random() < 0.5,
  rot:  rndN(-12, 12),
});

// Morcego (imagem): voa, some e reaparece em lugares diferentes
const VampBat = () => {
  const [pose, setPose] = useState(newBatPose);
  const [vis,  setVis]  = useState(false);
  useEffect(() => {
    let tShow, tHide, tNext;
    const cycle = () => {
      setPose(newBatPose());
      setVis(false);
      tShow = setTimeout(() => setVis(true), 60);
      const showMs = rndN(4000, 8000);
      tHide = setTimeout(() => setVis(false), showMs);
      tNext = setTimeout(cycle, showMs + rndN(1400, 4000));
    };
    const start = setTimeout(cycle, rndN(0, 5000));
    return () => { clearTimeout(start); clearTimeout(tShow); clearTimeout(tHide); clearTimeout(tNext); };
  }, []);
  const p = pose;
  return (
    <div style={{
      position:'absolute', top:`${p.top}%`, left:`${p.left}%`, pointerEvents:'none',
      opacity: vis ? 0.95 : 0, transition:'opacity .8s ease',
      '--dx':`${p.dx}px`, '--dy':`${p.dy}px`,
      animation:`vsBatWander ${p.dur}s ease-in-out infinite`,
    }}>
      <div style={{ animation:'vsBatFlap .55s ease-in-out infinite' }}>
        <img src="/morcego.png" alt="" style={{
          width:p.sz, height:'auto', display:'block',
          transform:`scaleX(${p.flip ? -1 : 1}) rotate(${p.rot}deg)`,
          filter:'drop-shadow(0 3px 5px rgba(0,0,0,.55))',
        }}/>
      </div>
    </div>
  );
};

// Nuvem escura (cluster de elipses)
const VampCloud = ({ top, left, scale = 1, dur = 26, delay = 0, op = 0.45 }) => (
  <svg width={92 * scale} height={38 * scale} viewBox="0 0 92 38" fill="none"
    style={{ position:'absolute', top, left, opacity:op, animation:`vsCloudDrift ${dur}s ease-in-out ${delay}s infinite` }}>
    <g fill="#180611">
      <ellipse cx="26" cy="26" rx="22" ry="11"/>
      <ellipse cx="46" cy="19" rx="21" ry="14"/>
      <ellipse cx="65" cy="25" rx="20" ry="11"/>
      <ellipse cx="46" cy="29" rx="32" ry="9"/>
    </g>
  </svg>
);

const VampClouds = () => (
  <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
    <VampCloud top={2}   left="44%" scale={1}    dur={28} delay={0}   op={0.5} />
    <VampCloud top={20}  left="56%" scale={0.7}  dur={34} delay={3}   op={0.35} />
    <VampCloud top={-4}  left="66%" scale={0.85} dur={23} delay={1.5} op={0.55} />
    <VampCloud top={12}  left="30%" scale={0.6}  dur={30} delay={4.5} op={0.3} />
    <VampCloud top={6}   left="8%"  scale={0.8}  dur={26} delay={2.2} op={0.42} />
    <VampCloud top={18}  left="74%" scale={0.65} dur={31} delay={5}   op={0.35} />
    <VampCloud top={-2}  left="86%" scale={0.7}  dur={27} delay={3.5} op={0.48} />
    <VampCloud top={10}  left="-2%" scale={0.55} dur={33} delay={1}   op={0.3} />
  </div>
);

// Relâmpago vermelho (zig-zag) piscando
const VampLightning = ({ left, top = 0, h = 52, delay = 0 }) => (
  <svg width={Math.round(h * 0.3)} height={h} viewBox="0 0 24 60" fill="none" preserveAspectRatio="none"
    style={{ position:'absolute', left, top, pointerEvents:'none', opacity:0,
             animation:`vsLightning 6s linear ${delay}s infinite`,
             filter:'drop-shadow(0 0 5px #ff2d40) drop-shadow(0 0 12px #c41e3a)' }}>
    <path d="M14 0 L5 26 L12 26 L3 60 L20 22 L12 22 L19 0 Z" fill="#ff3a4e" />
    <path d="M14 0 L5 26 L12 26 L3 60 L20 22 L12 22 L19 0 Z" fill="#fff" opacity=".3" />
  </svg>
);

const VampStorm = () => {
  const bolts = useRef(null);
  if (!bolts.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    bolts.current = Array.from({ length: 7 }).map((_, i) => ({
      id: i, left: `${rnd(6, 88)}%`, top: rnd(12, 34), h: rnd(50, 160), delay: rnd(0, 0.7),
    }));
  }
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:0,
        background:'radial-gradient(ellipse at 55% 0%, #ff2d4055 0%, transparent 55%)',
        animation:'vsLightningFlash 6s linear infinite' }} />
      {bolts.current.map(b => <VampLightning key={b.id} left={b.left} top={b.top} h={b.h} delay={b.delay} />)}
    </div>
  );
};

// Árvore seca e PRETA (silhueta de galhos retorcidos)
const BareTree = ({ x, h = 30, s = 1, g = 105 }) => (
  <g stroke="#080106" strokeWidth={1.6 * s} fill="none" strokeLinecap="round">
    <path d={`M${x} ${g} L${x} ${g - h}`} />
    <path d={`M${x} ${g - h * 0.48} L${x - 5 * s} ${g - h * 0.72}`} />
    <path d={`M${x} ${g - h * 0.42} L${x + 5 * s} ${g - h * 0.64}`} />
    <path d={`M${x - 5 * s} ${g - h * 0.72} L${x - 8 * s} ${g - h * 0.86}`} />
    <path d={`M${x + 5 * s} ${g - h * 0.64} L${x + 8 * s} ${g - h * 0.78}`} />
    <path d={`M${x} ${g - h * 0.74} L${x - 4 * s} ${g - h * 0.94}`} />
    <path d={`M${x} ${g - h * 0.80} L${x + 4 * s} ${g - h * 0.98}`} />
    <path d={`M${x - 4 * s} ${g - h * 0.94} L${x - 6 * s} ${g - h * 1.02}`} />
    <path d={`M${x + 4 * s} ${g - h * 0.98} L${x + 6 * s} ${g - h * 1.05}`} />
  </g>
);

// Grupo de árvores secas (3 troncos); posicionável e espelhável
const TreeCluster = ({ style, flip }) => (
  <svg viewBox="0 0 58 50" width="58" height="50" fill="none"
    style={{ position:'absolute', bottom:0, pointerEvents:'none', zIndex:1,
             transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
    <BareTree x={13} h={36} s={1}    g={50} />
    <BareTree x={31} h={22} s={0.7}  g={50} />
    <BareTree x={46} h={28} s={0.85} g={50} />
  </svg>
);

// Janela lanceta (arco gótico pontudo) com brilho vermelho fraco
const Lancet = ({ x, y, w, h, d = 0 }) => (
  <>
    <path d={`M${x} ${y + h} L${x} ${y + 5} Q${x + w / 2} ${y - 5} ${x + w} ${y + 5} L${x + w} ${y + h} Z`} fill="#080005" />
    <path d={`M${x + 1} ${y + h} L${x + 1} ${y + 5} Q${x + w / 2} ${y - 2} ${x + w - 1} ${y + 5} L${x + w - 1} ${y + h} Z`}
      fill="#c41e3a" opacity=".14" style={{ animation:`vsWinGlow ${3 + d}s ease-in-out ${d}s infinite` }} />
  </>
);

// Catedral gótica (igreja antiga) — silhueta escura com torres/agulhas e rosácea
const VampCastle = () => (
  <svg viewBox="0 0 220 120" width="256" height="140" fill="none"
    style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:1 }}>
    <g fill="#0d0208">
      {/* Torre esquerda + agulha */}
      <rect x="26" y="46" width="34" height="74"/>
      <polygon points="26,46 60,46 43,6"/>
      <polygon points="24,48 34,48 29,32"/>
      <polygon points="52,48 62,48 57,32"/>
      {/* Torre direita + agulha */}
      <rect x="160" y="46" width="34" height="74"/>
      <polygon points="160,46 194,46 177,6"/>
      <polygon points="158,48 168,48 163,32"/>
      <polygon points="186,48 196,48 191,32"/>
      {/* Nave central + empena (frontão triangular) */}
      <rect x="60" y="60" width="100" height="60"/>
      <polygon points="60,60 160,60 110,30"/>
      {/* Fleche central (agulha fina e alta) */}
      <polygon points="105,34 115,34 110,0"/>
      <rect x="108" y="30" width="4" height="8"/>
    </g>

    {/* Rosácea */}
    <circle cx="110" cy="74" r="13" fill="#080005"/>
    <circle cx="110" cy="74" r="10" fill="#c41e3a" opacity=".16" style={{ animation:'vsWinGlow 3.6s ease-in-out infinite' }}/>
    <g stroke="#080005" strokeWidth="1.3">
      <line x1="110" y1="63" x2="110" y2="85"/><line x1="99" y1="74" x2="121" y2="74"/>
      <line x1="102.5" y1="66.5" x2="117.5" y2="81.5"/><line x1="117.5" y1="66.5" x2="102.5" y2="81.5"/>
    </g>

    {/* Portal (arco pontudo da entrada) */}
    <path d="M97 120 L97 96 Q110 78 123 96 L123 120 Z" fill="#060004"/>
    <path d="M100 120 L100 98 Q110 84 120 98 L120 120 Z" fill="#c41e3a" opacity=".10" style={{ animation:'vsWinGlow 4s ease-in-out .6s infinite' }}/>

    {/* Janelas lanceta — nave e torres */}
    <Lancet x={70}  y={74} w={8} h={26} d={0.2} />
    <Lancet x={86}  y={92} w={7} h={16} d={1.1} />
    <Lancet x={127} y={92} w={7} h={16} d={0.7} />
    <Lancet x={142} y={74} w={8} h={26} d={1.4} />
    <Lancet x={35}  y={60} w={8} h={22} d={0.5} />
    <Lancet x={169} y={60} w={8} h={22} d={1.0} />
    <Lancet x={35}  y={92} w={7} h={16} d={1.7} />
    <Lancet x={170} y={92} w={7} h={16} d={0.9} />
  </svg>
);

// Cenário completo — preenche o elemento pai (que deve ser position:relative/absolute).
export default function VampireScene({ bats = 5, moon = true }) {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <style>{VAMP_SCENE_CSS}</style>

      {/* Lua de sangue */}
      {moon && (
        <div style={{
          position:'absolute', top:12, right:20, width:52, height:52, borderRadius:'50%',
          background:'radial-gradient(circle, #e02848 0%, #7a0010 100%)',
          boxShadow:'0 0 18px 6px #c41e3a66, 0 0 44px 14px #c41e3a22',
          animation:'vsMoonPulse 3.5s ease-in-out infinite', zIndex:0,
        }}/>
      )}

      <VampClouds />
      <VampStorm />
      <VampCastle />

      {/* Floresta seca e preta espalhada na base */}
      <TreeCluster style={{ left: 0 }} />
      <TreeCluster style={{ left: '14%' }} />
      <TreeCluster style={{ left: '28%' }} />
      <TreeCluster style={{ right: '28%' }} flip />
      <TreeCluster style={{ right: '14%' }} flip />
      <TreeCluster style={{ right: 0 }} flip />

      {Array.from({ length: bats }).map((_, i) => <VampBat key={i} />)}

      {/* Brilho atmosférico */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse at 60% 0%, #c41e3a1c 0%, transparent 62%)' }}/>
    </div>
  );
}
