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

// Árvore seca (silhueta de galhos)
const BareTree = ({ x, h = 30, s = 1, g = 105 }) => (
  <g stroke="#34161f" strokeWidth={1.5 * s} fill="none" strokeLinecap="round">
    <path d={`M${x} ${g} L${x} ${g - h}`} />
    <path d={`M${x} ${g - h * 0.5} L${x - 5 * s} ${g - h * 0.72}`} />
    <path d={`M${x} ${g - h * 0.45} L${x + 5 * s} ${g - h * 0.66}`} />
    <path d={`M${x - 5 * s} ${g - h * 0.72} L${x - 8 * s} ${g - h * 0.84}`} />
    <path d={`M${x + 5 * s} ${g - h * 0.66} L${x + 8 * s} ${g - h * 0.78}`} />
    <path d={`M${x} ${g - h * 0.78} L${x - 4 * s} ${g - h * 0.95}`} />
    <path d={`M${x} ${g - h * 0.82} L${x + 4 * s} ${g - h * 0.98}`} />
  </g>
);

const SideTreeCluster = ({ side }) => (
  <svg viewBox="0 0 58 48" width="58" height="48" fill="none"
    style={{ position:'absolute', bottom:0, [side]:0, pointerEvents:'none', zIndex:1,
             transform: side === 'right' ? 'scaleX(-1)' : undefined }}>
    <BareTree x={13} h={34} s={1}    g={48} />
    <BareTree x={31} h={21} s={0.7}  g={48} />
    <BareTree x={46} h={27} s={0.85} g={48} />
  </svg>
);

const VampCastle = () => (
  <svg viewBox="0 0 220 105" width="240" height="115" fill="none"
    style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', pointerEvents:'none', zIndex:1 }}>
    <rect x="2" y="62" width="22" height="43" fill="#180610"/>
    <rect x="2"  y="56" width="4" height="7" fill="#180610"/>
    <rect x="8"  y="56" width="4" height="7" fill="#180610"/>
    <rect x="14" y="56" width="4" height="7" fill="#180610"/>
    <rect x="20" y="56" width="4" height="7" fill="#180610"/>
    <rect x="22" y="48" width="36" height="57" fill="#140410"/>
    <rect x="22" y="42" width="5" height="8" fill="#140410"/>
    <rect x="29" y="42" width="5" height="8" fill="#140410"/>
    <rect x="36" y="42" width="5" height="8" fill="#140410"/>
    <rect x="43" y="42" width="5" height="8" fill="#140410"/>
    <rect x="50" y="42" width="7" height="8" fill="#140410"/>
    <rect x="31" y="60" width="16" height="22" fill="#0c0008"/>
    <rect x="33" y="62" width="12" height="18" fill="#c41e3a" opacity=".1" style={{ animation:'vsWinGlow 3s ease-in-out infinite' }}/>
    <rect x="64" y="22" width="92" height="83" fill="#100308"/>
    <rect x="62"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="72"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="82"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="92"  y="14" width="8"  height="10" fill="#100308"/>
    <rect x="102" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="112" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="122" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="132" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="142" y="14" width="8"  height="10" fill="#100308"/>
    <rect x="152" y="14" width="10" height="10" fill="#100308"/>
    <rect x="82" y="36" width="56" height="50" fill="#0a0006"/>
    <rect x="84" y="38" width="52" height="46" fill="#c41e3a" opacity=".12" style={{ animation:'vsWinGlow 3.5s ease-in-out 1s infinite' }}/>
    <path d="M96 105 L96 72 Q110 56 124 72 L124 105" fill="#0a0006"/>
    <rect x="162" y="48" width="36" height="57" fill="#140410"/>
    <rect x="162" y="42" width="5" height="8" fill="#140410"/>
    <rect x="169" y="42" width="5" height="8" fill="#140410"/>
    <rect x="176" y="42" width="5" height="8" fill="#140410"/>
    <rect x="183" y="42" width="5" height="8" fill="#140410"/>
    <rect x="190" y="42" width="7" height="8" fill="#140410"/>
    <rect x="173" y="60" width="16" height="22" fill="#0c0008"/>
    <rect x="175" y="62" width="12" height="18" fill="#c41e3a" opacity=".1" style={{ animation:'vsWinGlow 2.8s ease-in-out .5s infinite' }}/>
    <rect x="196" y="62" width="22" height="43" fill="#180610"/>
    <rect x="196" y="56" width="4" height="7" fill="#180610"/>
    <rect x="202" y="56" width="4" height="7" fill="#180610"/>
    <rect x="208" y="56" width="4" height="7" fill="#180610"/>
    <rect x="214" y="56" width="4" height="7" fill="#180610"/>
    <BareTree x={11}  h={32} s={1} />
    <BareTree x={28}  h={20} s={0.65} />
    <BareTree x={209} h={34} s={1.05} />
    <BareTree x={192} h={21} s={0.7} />
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
      <SideTreeCluster side="left" />
      <SideTreeCluster side="right" />

      {Array.from({ length: bats }).map((_, i) => <VampBat key={i} />)}

      {/* Brilho atmosférico */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse at 60% 0%, #c41e3a1c 0%, transparent 62%)' }}/>
    </div>
  );
}
