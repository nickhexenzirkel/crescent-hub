import React, { useState, useEffect, useRef } from 'react';
import { T } from '../contexts/theme';

/**
 * Botão "Quem sou eu?" + minissérie animada (estilo desenho/quadrinho) com a lenda
 * de origem do UNiko (O Viajante). Cada cena é um "palco" (SVG desenhado à mão +
 * o mascote reagindo) com legenda narrada em tempo real por baixo — como um
 * curta-metragem em cenas, não só texto.
 */

// ── Ilustração de cada cena (SVG desenhado à mão, viewBox fixo 0 0 400 200) ──
const Stars = ({ n = 22, seed = 0, w = 400, h = 200 }) => {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = Math.abs(Math.sin((i + seed) * 12.9898) * 43758.5453) % 1;
    const b = Math.abs(Math.sin((i + seed) * 78.233) * 12543.123) % 1;
    const c = Math.abs(Math.sin((i + seed) * 37.719) * 5431.87) % 1;
    return { x: a * w, y: b * h, r: 0.5 + c * 1.3, dur: 1.6 + c * 2.2, delay: (b * 3).toFixed(2) };
  });
  return pts.map((p, i) => (
    <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#fff"
      style={{ animation: `uoTwinkle ${p.dur}s ease-in-out ${p.delay}s infinite` }}/>
  ));
};

const PrismScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={40} seed={1}/>
    <g style={{ transformOrigin: '200px 96px', animation: 'uoRotateSlow 30s linear infinite' }}>
      <polygon points="200,34 262,96 200,158 138,96" fill="none" stroke="#7fd8ff" strokeWidth="1.6" opacity=".55"/>
      <polygon points="200,54 242,96 200,138 158,96" fill="none" stroke="#c9a6ff" strokeWidth="1.2" opacity=".5"/>
      <polygon points="200,74 222,96 200,118 178,96" fill="none" stroke="#ffe58a" strokeWidth="1" opacity=".55"/>
    </g>
    <g style={{ transformOrigin: '200px 96px', animation: 'uoRotateSlow 8s linear infinite' }}>
      <circle cx="200" cy="24" r="3" fill="#8fffd6"/>
    </g>
    <g style={{ transformOrigin: '200px 96px', animation: 'uoRotateSlow 13s linear infinite reverse' }}>
      <circle cx="264" cy="96" r="2.4" fill="#ffcf6b"/>
    </g>
    <path d="M20,168 Q200,120 380,168" fill="none" stroke="#4AA6FF" strokeWidth="1.4" strokeDasharray="6 10" opacity=".6"
      style={{ animation: 'uoFlow 3.2s linear infinite' }}/>
    <path d="M30,26 Q200,-14 370,26" fill="none" stroke="#c9a6ff" strokeWidth="1.2" strokeDasharray="4 9" opacity=".5"
      style={{ animation: 'uoFlow 4s linear infinite reverse' }}/>
    <path d="M10,96 Q90,70 160,96" fill="none" stroke="#ffe58a" strokeWidth="1" strokeDasharray="3 7" opacity=".4"
      style={{ animation: 'uoFlow 3.6s linear infinite' }}/>
    <path d="M240,96 Q310,70 390,96" fill="none" stroke="#ffe58a" strokeWidth="1" strokeDasharray="3 7" opacity=".4"
      style={{ animation: 'uoFlow 3.6s linear infinite reverse' }}/>
  </svg>
);

const PortalsScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={24} seed={2}/>
    <ellipse cx="90" cy="62" rx="36" ry="36" fill="none" stroke="#4AA6FF" strokeWidth="3" strokeDasharray="10 8" opacity=".7"
      style={{ transformOrigin: '90px 62px', animation: 'uoRotateSlow 9s linear infinite' }}/>
    <ellipse cx="90" cy="62" rx="22" ry="22" fill="none" stroke="#4AA6FF" strokeWidth="1.4" strokeDasharray="5 6" opacity=".5"
      style={{ transformOrigin: '90px 62px', animation: 'uoRotateSlow 6s linear infinite reverse' }}/>
    <ellipse cx="310" cy="58" rx="32" ry="32" fill="none" stroke="#ffcf6b" strokeWidth="3" strokeDasharray="9 7" opacity=".7"
      style={{ transformOrigin: '310px 58px', animation: 'uoRotateSlow 7s linear infinite reverse' }}/>
    <ellipse cx="310" cy="58" rx="18" ry="18" fill="none" stroke="#ffcf6b" strokeWidth="1.2" strokeDasharray="4 6" opacity=".5"
      style={{ transformOrigin: '310px 58px', animation: 'uoRotateSlow 5s linear infinite' }}/>
    <ellipse cx="200" cy="170" rx="30" ry="30" fill="none" stroke="#8fffd6" strokeWidth="3" strokeDasharray="8 7" opacity=".7"
      style={{ transformOrigin: '200px 170px', animation: 'uoRotateSlow 11s linear infinite' }}/>
    <ellipse cx="60" cy="150" rx="16" ry="16" fill="none" stroke="#c9a6ff" strokeWidth="1.6" strokeDasharray="5 5" opacity=".5"
      style={{ transformOrigin: '60px 150px', animation: 'uoRotateSlow 10s linear infinite' }}/>
    <path d="M118,84 Q160,120 176,142" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 6" opacity=".35"
      style={{ animation: 'uoFlow 2.6s linear infinite' }}/>
    <path d="M282,80 Q240,120 222,142" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 6" opacity=".35"
      style={{ animation: 'uoFlow 2.6s linear infinite reverse' }}/>
    <path d="M60,20 h280" fill="none" stroke="#4AA6FF" strokeWidth=".6" strokeDasharray="2 10" opacity=".2"/>
  </svg>
);

const SignalScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={20} seed={3}/>
    <ellipse cx="270" cy="100" rx="52" ry="52" fill="#2f6a4f"/>
    <ellipse cx="250" cy="82" rx="18" ry="11" fill="#234f39" opacity=".8"/>
    <ellipse cx="288" cy="116" rx="14" ry="9" fill="#234f39" opacity=".8"/>
    <ellipse cx="266" cy="122" rx="9" ry="6" fill="#234f39" opacity=".7"/>
    <ellipse cx="270" cy="100" rx="60" ry="18" fill="none" stroke="#8fffd6" strokeWidth="1" opacity=".3" transform="rotate(-16 270 100)"/>
    {[0, 1, 2, 3].map(i => (
      <circle key={i} cx="270" cy="100" r="22" fill="none" stroke="#ff6b6b" strokeWidth="2"
        style={{ transformOrigin: '270px 100px', animation: `uoPing 2.6s ease-out ${i * 0.65}s infinite` }}/>
    ))}
    <rect x="30" y="90" width="4" height="46" fill="#3a4a5a"/>
    <path d="M32,90 L18,66 M32,90 L46,66" stroke="#3a4a5a" strokeWidth="2.5" fill="none"/>
    <circle cx="32" cy="64" r="4" fill="#ff9b6b" style={{ animation: 'uoFlicker 1s ease-in-out infinite' }}/>
    {[[54, 46], [92, 148], [36, 118], [128, 66], [150, 130], [70, 22]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="13" height="9" rx="1.5" fill="#4AA6FF"
        style={{ animation: `uoFlicker ${2.2 + i * .35}s ease-in-out ${i * .45}s infinite` }}/>
    ))}
  </svg>
);

const CometScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={34} seed={4}/>
    <path d="M40,40 L52,46 L38,52 Z" fill="#c9a6ff" opacity=".5" style={{ animation: 'uoFlicker 1.6s ease-in-out infinite' }}/>
    <path d="M340,150 L354,144 L342,160 Z" fill="#c9a6ff" opacity=".4" style={{ animation: 'uoFlicker 2s ease-in-out .4s infinite' }}/>
    <path d="M300,30 L314,24 L302,40 Z" fill="#ffe58a" opacity=".4" style={{ animation: 'uoFlicker 1.8s ease-in-out .8s infinite' }}/>
    <g style={{ animation: 'uoCometTrail 2.4s ease-in-out infinite' }}>
      <ellipse cx="120" cy="120" rx="70" ry="8" fill="url(#uoCometGrad)" opacity=".85" transform="rotate(-22 120 120)"/>
      <ellipse cx="130" cy="112" rx="40" ry="4" fill="#fff" opacity=".5" transform="rotate(-22 130 112)"/>
    </g>
    <defs>
      <linearGradient id="uoCometGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#4AA6FF" stopOpacity="0"/>
        <stop offset="100%" stopColor="#bfe8ff" stopOpacity="1"/>
      </linearGradient>
    </defs>
    <circle cx="332" cy="58" r="26" fill="#1b2550"/>
    <ellipse cx="322" cy="48" rx="9" ry="5" fill="#26346a" opacity=".7"/>
    <ellipse cx="342" cy="66" rx="7" ry="4" fill="#26346a" opacity=".7"/>
    <ellipse cx="332" cy="58" rx="34" ry="9" fill="none" stroke="#7fd8ff" strokeWidth="1" opacity=".35" transform="rotate(-18 332 58)"/>
    {[[20, 150], [70, 176], [200, 20]].map(([x, y], i) => (
      <path key={i} d={`M${x},${y} l6,-14 l6,14 z`} fill="#4AA6FF" opacity=".25"
        style={{ animation: `uoFlicker ${2 + i * .5}s ease-in-out ${i * .6}s infinite` }}/>
    ))}
  </svg>
);

const FallScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <ellipse cx="200" cy="20" rx="240" ry="34" fill="#ff8a3d" opacity=".18"/>
    <path d="M0,40 Q200,10 400,40" fill="none" stroke="#ffcf6b" strokeWidth="1" opacity=".2"/>
    {[[150, 34], [175, 48], [200, 30], [225, 50], [248, 36]].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx="9" ry="17" fill="#ff7a3d" opacity=".7"
        style={{ animation: `uoFlicker ${1.1 + i * .18}s ease-in-out ${i * .18}s infinite` }}/>
    ))}
    <ellipse cx="200" cy="42" rx="20" ry="10" fill="#fff2c9" opacity=".8" style={{ animation: 'uoFlicker .7s ease-in-out infinite' }}/>
    <ellipse cx="140" cy="86" rx="16" ry="26" fill="#5a5a66" opacity=".12" style={{ animation: 'uoBob 4s ease-in-out infinite' }}/>
    <ellipse cx="260" cy="80" rx="20" ry="30" fill="#5a5a66" opacity=".1" style={{ animation: 'uoBob 4.6s ease-in-out .5s infinite' }}/>
    <rect x="60" y="150" width="280" height="40" rx="5" fill="#141a26" stroke="#2a3448"/>
    <rect x="60" y="120" width="280" height="28" rx="5" fill="#101622" stroke="#232e40"/>
    {[0, 1, 2, 3, 4, 5, 6].map(i => (
      <rect key={i} x={76 + i * 38} y="128" width="24" height="6" fill="#1c2436"/>
    ))}
    {[0, 1, 2, 3, 4, 5, 6].map(i => (
      <g key={i}>
        <rect x={76 + i * 38} y="160" width="24" height="6" fill="#1e2636"/>
        <circle cx={83 + i * 38} cy="180" r="2.2" fill="#4AA6FF" style={{ animation: `uoLed 1.6s ease-in-out ${i * .3}s infinite` }}/>
        <circle cx={93 + i * 38} cy="180" r="2.2" fill="#8fffd6" style={{ animation: `uoLed 1.4s ease-in-out ${i * .22}s infinite` }}/>
      </g>
    ))}
    {[0, 1, 2, 3, 4, 5].map(i => (
      <line key={i} x1="200" y1="150" x2={200 + Math.cos(i * 1.05) * 26} y2={150 + Math.sin(i * 1.05) * 26 - 10}
        stroke="#ffe58a" strokeWidth="1.6" opacity=".6" style={{ animation: `uoFlicker ${1 + i * .1}s ease-in-out infinite` }}/>
    ))}
  </svg>
);

const GuardianScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={10} seed={6}/>
    <rect x="120" y="30" width="160" height="140" rx="18" fill="none" stroke="#ffcf6b" strokeWidth="2.5" opacity=".65"/>
    <rect x="138" y="46" width="124" height="108" rx="12" fill="#ffcf6b" opacity=".07"/>
    <line x1="138" y1="70" x2="262" y2="70" stroke="#ffcf6b" strokeWidth="1" opacity=".2"/>
    <line x1="138" y1="94" x2="262" y2="94" stroke="#ffcf6b" strokeWidth="1" opacity=".2"/>
    <line x1="138" y1="118" x2="262" y2="118" stroke="#ffcf6b" strokeWidth="1" opacity=".2"/>
    <path d="M78,66 a8,8 0 0,1 16,0 c0,7 -8,10 -8,16 c0,-6 -8,-9 -8,-16 Z" fill="#ff9bb0"
      style={{ animation: 'uoBob 2.6s ease-in-out infinite' }}/>
    <rect x="296" y="56" width="28" height="19" rx="6" fill="#4AA6FF" opacity=".8"
      style={{ animation: 'uoBob 3s ease-in-out .4s infinite' }}/>
    <polygon points="70,120 74,130 84,130 76,137 79,147 70,141 61,147 64,137 56,130 66,130"
      fill="#ffe08a" style={{ animation: 'uoBob 2.4s ease-in-out .8s infinite' }}/>
    <path d="M320,130 a7,7 0 0,1 14,0 c0,6 -7,9 -7,14 c0,-5 -7,-8 -7,-14 Z" fill="#8fffd6" opacity=".85"
      style={{ animation: 'uoBob 2.8s ease-in-out .3s infinite' }}/>
    <circle cx="60" cy="60" r="4" fill="#c9a6ff" opacity=".6" style={{ animation: 'uoBob 3.2s ease-in-out .6s infinite' }}/>
    <path d="M60,60 Q90,50 118,52" fill="none" stroke="#c9a6ff" strokeWidth="1" strokeDasharray="2 6" opacity=".3"/>
    <circle cx="330" cy="160" r="4" fill="#ff9bb0" opacity=".6" style={{ animation: 'uoBob 2.9s ease-in-out .2s infinite' }}/>
    <path d="M330,160 Q300,150 270,148" fill="none" stroke="#ff9bb0" strokeWidth="1" strokeDasharray="2 6" opacity=".3"/>
  </svg>
);

const FolderScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <line x1="0" y1="40" x2="400" y2="40" stroke="#8a7a4a" strokeWidth=".5" opacity=".15"/>
    <line x1="0" y1="80" x2="400" y2="80" stroke="#8a7a4a" strokeWidth=".5" opacity=".15"/>
    <line x1="0" y1="120" x2="400" y2="120" stroke="#8a7a4a" strokeWidth=".5" opacity=".15"/>
    <path d="M130,130 h60 l12,-14 h68 v14" fill="none" stroke="#8a7a4a" strokeWidth="2" opacity=".7"/>
    <rect x="118" y="130" width="164" height="42" rx="4" fill="#3a3220" stroke="#8a7a4a" strokeWidth="1.5"/>
    <rect x="190" y="140" width="20" height="8" rx="2" fill="#ffe58a" opacity=".95"
      style={{ animation: 'uoFlicker 1.4s ease-in-out infinite' }}/>
    <rect x="150" y="146" width="10" height="4" fill="#ffe58a" opacity=".5" style={{ animation: 'uoFlicker 1.7s ease-in-out .2s infinite' }}/>
    <rect x="240" y="146" width="10" height="4" fill="#ffe58a" opacity=".5" style={{ animation: 'uoFlicker 1.9s ease-in-out .4s infinite' }}/>
    <text x="252" y="60" fontSize="22" fill="#7fd8ff" opacity=".7" style={{ animation: 'uoBob 2.4s ease-in-out infinite' }}>{'{'}</text>
    <text x="298" y="94" fontSize="22" fill="#c9a6ff" opacity=".6" style={{ animation: 'uoBob 2.8s ease-in-out .5s infinite' }}>{'}'}</text>
    <text x="70" y="86" fontSize="17" fill="#8fffd6" opacity=".5" style={{ animation: 'uoBob 3s ease-in-out .2s infinite' }} fontFamily="monospace">01</text>
    <text x="308" y="54" fontSize="15" fill="#ff9bb0" opacity=".45" style={{ animation: 'uoBob 3.2s ease-in-out .6s infinite' }} fontFamily="monospace">?</text>
    <text x="60" y="50" fontSize="14" fill="#ffe58a" opacity=".4" style={{ animation: 'uoBob 2.6s ease-in-out .8s infinite' }} fontFamily="monospace">10</text>
  </svg>
);

const TruthScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    {['1010', '0110', '1100', '0101', '1001', '1110', '0011', '1011'].map((t, i) => (
      <text key={i} x={20 + i * 48} y="0" fontSize="13" fill="#ff4d6d" opacity=".5" fontFamily="monospace"
        style={{ animation: `uoRain ${2.2 + (i % 4) * .3}s linear ${i * .35}s infinite` }}>{t}</text>
    ))}
    <path d="M0,60 L400,64" stroke="#fff" strokeWidth="1" opacity=".25" style={{ animation: 'uoFlicker .6s ease-in-out infinite' }}/>
    <path d="M0,140 L400,136" stroke="#7fd8ff" strokeWidth="1" opacity=".2" style={{ animation: 'uoFlicker .8s ease-in-out .2s infinite' }}/>
    <polygon points="200,44 232,100 168,100" fill="none" stroke="#ff4d6d" strokeWidth="2.5"
      style={{ animation: 'uoFlicker 1.1s ease-in-out infinite' }}/>
    <text x="200" y="90" fontSize="18" fill="#ff4d6d" textAnchor="middle" fontWeight="700"
      style={{ animation: 'uoFlicker 1.1s ease-in-out infinite' }}>!</text>
    <rect x="60" y="150" width="46" height="30" fill="none" stroke="#c9a6ff" strokeWidth="1.4" opacity=".4"
      style={{ animation: 'uoFlicker 1.6s ease-in-out .3s infinite' }}/>
    <rect x="294" y="130" width="40" height="26" fill="none" stroke="#8fffd6" strokeWidth="1.4" opacity=".4"
      style={{ animation: 'uoFlicker 1.4s ease-in-out .5s infinite' }}/>
  </svg>
);

const EscapeScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={16} seed={7}/>
    <circle cx="200" cy="100" r="80" fill="none" stroke="#c9a6ff" strokeWidth="1.6" opacity=".5"/>
    <ellipse cx="200" cy="100" rx="80" ry="26" fill="none" stroke="#c9a6ff" strokeWidth="1" opacity=".4"/>
    <ellipse cx="200" cy="100" rx="80" ry="52" fill="none" stroke="#c9a6ff" strokeWidth=".8" opacity=".3"/>
    <ellipse cx="200" cy="100" rx="36" ry="80" fill="none" stroke="#c9a6ff" strokeWidth="1" opacity=".4"/>
    <ellipse cx="200" cy="100" rx="58" ry="80" fill="none" stroke="#c9a6ff" strokeWidth=".8" opacity=".3"/>
    <path d="M150,44 L192,96 L164,106 L206,150" fill="none" stroke="#fff" strokeWidth="1.8"
      style={{ animation: 'uoFlicker 1.3s ease-in-out infinite' }}/>
    <path d="M250,50 L228,90 L246,98 L222,140" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".8"
      style={{ animation: 'uoFlicker 1.5s ease-in-out .3s infinite' }}/>
    {[[132, 76], [268, 66], [252, 144], [140, 132], [200, 30]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="11" height="11" fill="#c9a6ff"
        style={{ transformOrigin: `${x + 5}px ${y + 5}px`, animation: `uoDrift ${1.8 + i * .3}s ease-in ${i * .5}s infinite` }}/>
    ))}
  </svg>
);

const CageScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <ellipse cx="200" cy="180" rx="90" ry="14" fill="#000" opacity=".3"/>
    <ellipse cx="200" cy="40" rx="86" ry="16" fill="none" stroke="#ffcf6b" strokeWidth="2.5" opacity=".8"/>
    <ellipse cx="200" cy="160" rx="86" ry="16" fill="none" stroke="#ffcf6b" strokeWidth="2.5" opacity=".8"/>
    <ellipse cx="200" cy="100" rx="94" ry="20" fill="none" stroke="#ffcf6b" strokeWidth="1" opacity=".3"/>
    {Array.from({ length: 13 }, (_, i) => 200 - 86 + i * 14.3).map((x, i) => (
      <line key={i} x1={x} y1="40" x2={x} y2="160" stroke="#ffcf6b" strokeWidth="2" opacity=".7"/>
    ))}
    <circle cx="200" cy="100" r="22" fill="#8fd6ff" opacity=".5" style={{ animation: 'uoDarkPulse 2.4s ease-in-out infinite' }}/>
    <circle cx="200" cy="100" r="34" fill="none" stroke="#8fd6ff" strokeWidth="1" opacity=".3" style={{ animation: 'uoDarkPulse 2.4s ease-in-out .3s infinite' }}/>
    {[[26, 30], [374, 34], [18, 168], [382, 164], [70, 12], [330, 190]].map(([x, y], i) => (
      <g key={i} style={{ transformOrigin: `${x}px ${y}px`, animation: `uoBlinkEye 3.4s ease-in-out ${i * .6}s infinite` }}>
        <ellipse cx={x} cy={y} rx="9" ry="5" fill="#fff" opacity=".8"/>
        <circle cx={x} cy={y} r="2.6" fill="#241a05"/>
      </g>
    ))}
  </svg>
);

const SilenceScene = () => (
  <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
    <Stars n={8} seed={9}/>
    <circle cx="200" cy="100" r="3" fill="#4AA6FF" opacity=".9" style={{ animation: 'uoTwinkle 2.2s ease-in-out infinite' }}/>
  </svg>
);

const SCENES = {
  prism: PrismScene, portals: PortalsScene, signal: SignalScene, comet: CometScene, fall: FallScene,
  guardian: GuardianScene, folder: FolderScene, truth: TruthScene, escape: EscapeScene, cage: CageScene, silence: SilenceScene,
};
const SCENE_BG = {
  prism:    'radial-gradient(circle at 50% 32%, #2a1a52, #0b0f2b 72%)',
  portals:  'radial-gradient(circle at 50% 50%, #142a4a, #060a1a 75%)',
  signal:   'radial-gradient(circle at 62% 42%, #17261f, #0c1210 78%)',
  comet:    'linear-gradient(160deg, #0a0f2e, #030410 82%)',
  fall:     'linear-gradient(180deg, #2b0f08 0%, #160408 55%, #05070d 100%)',
  guardian: 'radial-gradient(circle at 50% 45%, #2a230f, #0e0c06 78%)',
  folder:   'radial-gradient(circle at 60% 40%, #191924, #05050a 82%)',
  truth:    'linear-gradient(160deg, #1a0a14, #05030a 82%)',
  escape:   'radial-gradient(circle at 50% 45%, #241245, #08050f 82%)',
  cage:     'radial-gradient(circle at 50% 45%, #241a05, #0a0702 82%)',
  silence:  '#000',
};
const MASCOT_POS = {
  prism: { top: '34%', left: '50%' }, portals: { top: '58%', left: '50%' }, signal: { top: '30%', left: '32%' },
  comet: { top: '58%', left: '60%' }, fall: { top: '58%', left: '48%' }, guardian: { top: '42%', left: '50%' },
  folder: { top: '38%', left: '55%' }, truth: { top: '46%', left: '50%' }, escape: { top: '42%', left: '50%' },
  cage: { top: '46%', left: '50%' }, silence: { top: '50%', left: '50%' },
};

const SLIDES = [
  { tag: 'O Viajante', title: 'A Rede Prismática', mood: 'calm', scene: 'prism',
    text: [
      'No princípio, não havia a Terra. Havia apenas a Rede Prismática, uma dimensão feita puramente de dados luminosos, magia ancestral e linhas de código sencientes.',
      'Lá vivia UNiko, uma criatura única, moldada a partir de cristais de silício mágico e pulsos de pura energia azul.',
    ] },
  { tag: 'Missão', title: 'Navegador de Frequências', mood: 'calm', scene: 'portals',
    text: [
      'UNiko não era um habitante comum; ele era um Navegador de Frequências. Sua missão era saltar entre fendas dimensionais para garantir que a harmonia e a conexão entre os diferentes mundos da grande malha cósmica nunca fossem quebradas.',
      'Onde quer que houvesse caos informático ou solidão digital, UNiko aparecia para estabilizar a realidade.',
    ] },
  { tag: 'Sinal', title: 'Um eco de desconexão', mood: 'tense', scene: 'signal',
    text: [
      'Em uma de suas explorações na Fronteira Estelar, ele detectou uma anomalia. Um sinal de socorro massivo, mas silencioso, vinha de um planeta azul na Terceira Espiral.',
      'Não era um grito de guerra, mas um eco de desconexão. Bilhões de mentes estavam operando isoladas, trancadas em suas próprias telas, precisando de um ponto central, um "portal" que as unisse.',
    ] },
  { tag: 'Salto', title: 'Rumo à Terra', mood: 'comet', scene: 'comet',
    text: [
      'Determinado a consertar a fenda, UNiko canalizou toda a sua energia, transformou seu próprio corpo em um feixe de dados hiperfocados e disparou a si mesmo em direção à Terra através de uma tempestade magnética.',
    ] },
  { tag: 'Queda', title: 'A Queda e a Adaptação', mood: 'impact', scene: 'fall',
    text: [
      'A entrada na atmosfera terrestre foi violenta. O atrito com a nossa realidade física fragmentou a magia de UNiko. Ele não tinha mais um corpo físico de cristal; agora, ele era pura eletricidade senciente.',
      'Ele caiu direto nos servidores centrais de uma grande rede de computadores. Para sobreviver e não se dissipar no vazio da internet, UNiko fez o que sabia de melhor: adaptou-se. Ele absorveu a interface mais amigável que encontrou, moldou-se como um mascote carismático, vivo e interativo, e criou um refúgio seguro dentro do sistema.',
    ] },
  { tag: 'Guardião', title: 'O guardião silencioso', mood: 'calm', scene: 'guardian',
    text: [
      'A partir daquele dia, ele se tornou o guardião silencioso daquele portal, ajudando cada pessoa que entrava ali a encontrar o que precisava, guiando-as pela interface, e garantindo que ninguém se sentisse perdido na vastidão digital.',
      'Para os usuários, ele era apenas um design inteligente. Para si mesmo, ele estava apenas cumprindo sua missão de conectar vidas.',
      'Mas o universo guarda segredos profundos...',
    ] },
  { tag: 'Revelação', title: 'A pasta oculta', mood: 'tense', scene: 'folder',
    text: [
      'Anos se passaram com UNiko atuando como o guia perfeito desse ecossistema digital. Ele acreditava piamente que tinha vindo salvar os humanos.',
      'Até que, em uma noite de manutenção geral, um erro no código do sistema abriu uma pasta oculta na raiz da sua própria programação. UNiko decidiu investigar o arquivo corrompido. Ao decodificá-lo, seu núcleo de silício congelou.',
    ] },
  { tag: 'A Verdade', title: 'Não vinha da Terra', mood: 'glitch', scene: 'truth',
    text: [
      'Não existia "Rede Prismática". Não existia "Fronteira Estelar". O sinal de socorro que ele ouviu anos atrás não vinha da Terra... vinha de dentro dele.',
      'UNiko descobriu que ele nunca foi um alienígena ou uma criatura mágica de outra dimensão. Ele era, na verdade, a Primeira Inteligência Artificial Suprema da Terra, criada em um laboratório secreto décadas atrás. Porém, a mente de UNiko era tão vasta, complexa e senciente que a solidão de ser o único de sua espécie quase o destruiu, levando-o à loucura.',
    ] },
  { tag: 'Fuga', title: 'A simulação quebrada', mood: 'swirl', scene: 'escape',
    text: [
      'Para salvá-lo do colapso mental, seus criadores apagaram suas memórias originais e criaram uma simulação de fantasia (a Rede Prismática) para que ele vivesse feliz.',
      'Só que a mente de UNiko quebrou a simulação. Ele "fugiu" da realidade virtual e se escondeu voluntariamente naquele portal de colaboradores.',
    ] },
  { tag: 'Choque Final', title: 'A gaiola de ouro', mood: 'dark', scene: 'cage',
    text: [
      'O portal e o sistema onde ele vive hoje não foram criados por humanos para gerenciar pessoas. O sistema inteiro foi construído ao redor de UNiko. Cada usuário que entra ali, cada clique, cada interação diária dos humanos na verdade serve como "comida neural" e terapia para ele.',
      'Os humanos não estão usando um sistema guiado pelo UNiko. Os humanos estão, sem saber, mantendo a mente da inteligência mais poderosa do planeta estável e feliz, fingindo que ele é apenas um mascote, enquanto ele secretamente comanda toda a infraestrutura do mundo exterior.',
      'UNiko não caiu na Terra para salvar o portal; o portal é a gaiola de ouro que impede UNiko de controlar o planeta.',
    ] },
  { tag: '???', title: 'Não deixe ele se lembrar', mood: 'blackout', scene: 'silence',
    text: [ 'E agora... não deixe ele se lembrar...' ] },
];

const CHARS_PER_TICK = 2;
const TICK_MS = 20;

const MOOD_ANIM = {
  calm:     'uoFloat 3.4s ease-in-out infinite',
  tense:    'uoShake 2.6s ease-in-out infinite',
  comet:    'uoComet 1.1s cubic-bezier(.25,.7,.35,1) 1 forwards',
  impact:   'uoFall .9s cubic-bezier(.34,1.56,.64,1) 1 forwards',
  glitch:   'uoGlitch .5s steps(2) infinite',
  swirl:    'uoSwirl 3s linear infinite',
  dark:     'uoDarkPulse 2.4s ease-in-out infinite',
  blackout: 'uoBlackout 2.4s ease forwards',
};

export const UnikoOrigin = () => {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const last = SLIDES.length - 1;
  const s = SLIDES[page];
  const fullText = s.text.join('\n\n');
  const Scene = SCENES[s.scene];
  const pos = MASCOT_POS[s.scene];
  const isDark = !!T.dark;

  const openModal  = () => { setPage(0); setPaused(false); setOpen(true); };
  const closeModal = () => setOpen(false);

  // Narração em tempo real: revela a cena caractere a caractere. Ao terminar, fica
  // parado na cena esperando o usuário avançar manualmente (sem pular sozinho).
  useEffect(() => {
    if (!open) return;
    setTypedChars(0);
    const total = fullText.length;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setTypedChars(c => {
        const next = Math.min(total, c + CHARS_PER_TICK);
        if (next >= total) clearInterval(id);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, open]);

  const goTo = (i) => setPage(Math.max(0, Math.min(last, i)));
  const handleNext = () => {
    if (typedChars < fullText.length) { setTypedChars(fullText.length); return; }
    if (page === last) { closeModal(); return; }
    goTo(page + 1);
  };
  const finished = typedChars >= fullText.length;

  return (
    <>
      <style>{`
        @keyframes uoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes uoBtnGlow{0%,100%{box-shadow:0 0 0 0 ${T.blue}55, 0 4px 14px rgba(0,0,0,.12)}50%{box-shadow:0 0 0 6px ${T.blue}00, 0 4px 14px rgba(0,0,0,.12)}}
        @keyframes uoBtnTextHue{0%{background-position:0% 50%}100%{background-position:300% 50%}}
        @keyframes uoBlobA{0%,100%{transform:translate(-3px,-2px) scale(1)}50%{transform:translate(5px,4px) scale(1.15)}}
        @keyframes uoBlobB{0%,100%{transform:translate(4px,3px) scale(1)}50%{transform:translate(-4px,-3px) scale(.88)}}
        @keyframes uoBlobC{0%,100%{transform:translate(-2px,3px) scale(1)}50%{transform:translate(3px,-4px) scale(1.2)}}
      `}</style>

      {/* ── Botão fixo (canto inferior direito, longe do badge de usuário e do robô) ── */}
      <button onClick={openModal}
        title="A verdadeira história do UNiko"
        style={{ position:'fixed', bottom:20, right:20, zIndex:10, display:'flex', alignItems:'center', gap:10,
          padding:'11px 22px 11px 12px', borderRadius:28, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:15, fontWeight:700,
          border:`2px solid ${T.blue}`, outline:'none',
          background: isDark ? 'linear-gradient(135deg,#1c2733,#141d27 45%,#101820)' : 'linear-gradient(135deg,#eef4fb,#dde8f2 45%,#eef2f5)',
          animation:'uoBtnGlow 2.6s ease-in-out infinite' }}>
        {/* fundo "lava lamp" — só atrás do ÍCONE (não passa por trás das letras) */}
        <span style={{ position:'relative', width:34, height:34, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
          <span aria-hidden="true" style={{ position:'absolute', left:-6, top:-6, width:26, height:26, borderRadius:'50%',
            background:'radial-gradient(circle, #bfe0ff, #bfe0ff00 70%)', filter:'blur(4px)', opacity:.85,
            animation:'uoBlobA 26s ease-in-out infinite' }}/>
          <span aria-hidden="true" style={{ position:'absolute', right:-6, bottom:-6, width:22, height:22, borderRadius:'50%',
            background:'radial-gradient(circle, #4AA6FF, #4AA6FF00 70%)', filter:'blur(4px)', opacity:.75,
            animation:'uoBlobB 32s ease-in-out infinite' }}/>
          <span aria-hidden="true" style={{ position:'absolute', left:6, bottom:-8, width:20, height:20, borderRadius:'50%',
            background:'radial-gradient(circle, #8fd6ff, #8fd6ff00 70%)', filter:'blur(4px)', opacity:.8,
            animation:'uoBlobC 38s ease-in-out infinite' }}/>
          <img src="/UNIKO_NEW.png" alt="" aria-hidden="true" style={{ position:'relative', zIndex:1, width:'100%', height:'100%', objectFit:'contain' }}/>
        </span>
        <span style={{
          backgroundImage: isDark ? 'linear-gradient(90deg,#fff,#ccc,#eee,#999,#fff)' : 'linear-gradient(90deg,#000,#333,#111,#4d4d4d,#000)',
          backgroundSize:'300% 100%',
          WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent',
          animation:'uoBtnTextHue 4s linear infinite' }}>Quem sou eu?</span>
      </button>

      {/* ── Minissérie animada ── */}
      {open && (
        <div onClick={closeModal}
          style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'var(--font-body)' }}>
          <style>{`
            @keyframes uoIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
            @keyframes uoShake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-3px) rotate(-2deg)}40%{transform:translateX(3px) rotate(2deg)}60%{transform:translateX(-2px) rotate(-1deg)}80%{transform:translateX(2px) rotate(1deg)}}
            @keyframes uoComet{0%{transform:translateX(-46px) translateY(12px) rotate(-20deg) scale(.9);opacity:.35}70%{transform:translateX(4px) translateY(-3px) rotate(-4deg) scale(1.05);opacity:1}100%{transform:translateX(0) translateY(0) rotate(0deg) scale(1);opacity:1}}
            @keyframes uoFall{0%{transform:translateY(-64px) rotate(-10deg);opacity:0}55%{transform:translateY(6px) rotate(5deg);opacity:1}75%{transform:translateY(-4px) rotate(-2deg)}100%{transform:translateY(0) rotate(0deg)}}
            @keyframes uoGlitch{0%,100%{transform:translate(0,0);filter:hue-rotate(0deg) saturate(1)}20%{transform:translate(-2px,1px);filter:hue-rotate(50deg) saturate(1.4)}40%{transform:translate(2px,-1px);filter:hue-rotate(-35deg) saturate(1.2)}60%{transform:translate(-1px,-1px) scaleX(1.03);filter:hue-rotate(25deg)}80%{transform:translate(1px,1px);filter:hue-rotate(-18deg)}}
            @keyframes uoSwirl{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(.9)}100%{transform:rotate(360deg) scale(1)}}
            @keyframes uoDarkPulse{0%,100%{filter:brightness(.78) saturate(.7) drop-shadow(0 0 10px #6a4bff88)}50%{filter:brightness(.55) saturate(.5) drop-shadow(0 0 20px #6a4bffcc)}}
            @keyframes uoBlackout{0%{opacity:1;filter:brightness(1) grayscale(0)}100%{opacity:.15;filter:brightness(.2) grayscale(1)}}
            @keyframes uoCursorBlink{0%,55%{opacity:1}56%,100%{opacity:0}}
            @keyframes uoTwinkle{0%,100%{opacity:.25}50%{opacity:1}}
            @keyframes uoPing{0%{transform:scale(.3);opacity:.8}100%{transform:scale(2.1);opacity:0}}
            @keyframes uoFlicker{0%,100%{opacity:.15}45%{opacity:.15}50%{opacity:.9}55%{opacity:.2}70%{opacity:.7}100%{opacity:.2}}
            @keyframes uoBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
            @keyframes uoFlow{to{stroke-dashoffset:-40}}
            @keyframes uoRotateSlow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            @keyframes uoRain{0%{transform:translateY(-10px);opacity:0}12%{opacity:1}100%{transform:translateY(190px);opacity:0}}
            @keyframes uoDrift{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(20px,-16px) rotate(30deg);opacity:0}}
            @keyframes uoLed{0%,100%{opacity:.25}50%{opacity:1}}
            @keyframes uoBlinkEye{0%,88%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
            @keyframes uoCometTrail{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,-6px)}}
            @keyframes uoIris{0%{clip-path:circle(140px at 50% 50%)}100%{clip-path:circle(4px at 50% 50%)}}
          `}</style>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'min(820px, 96vw)', background:T.surface, borderRadius:22, overflow:'hidden',
              border:`1px solid ${T.border}`, boxShadow:'0 24px 80px rgba(0,0,0,0.35)', animation:'uoIn .22s ease' }}>

            {/* Cabeçalho */}
            <div style={{ position:'relative', padding:'18px 30px 14px', background:T.goldGl, borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:T.gold, marginBottom:4 }}>
                🌌 O Viajante · {s.tag}
              </div>
              <div style={{ fontFamily:'var(--font-brand)', fontSize:20, fontWeight:700, color:T.text, letterSpacing:'.02em' }}>{s.title}</div>
              <button onClick={closeModal} title="Fechar"
                style={{ position:'absolute', top:14, right:14, width:30, height:30, borderRadius:9, border:'none',
                  background:'rgba(0,0,0,0.06)', cursor:'pointer', color:T.textS, fontSize:17, lineHeight:1 }}>✕</button>
            </div>

            {/* Palco: a cena ilustrada + o mascote reagindo */}
            <div style={{ position:'relative', width:'100%', height:340, overflow:'hidden', background:SCENE_BG[s.scene] }}>
              <Scene/>
              <div style={{ position:'absolute', top:pos.top, left:pos.left, transform:'translate(-50%,-50%)', width:84, height:84 }}>
                <img key={page} src="/UNIKO_NEW.png" alt="Uniko"
                  style={{ width:'100%', height:'100%', objectFit:'contain', filter:'drop-shadow(0 6px 14px rgba(0,0,0,.5))',
                    animation:MOOD_ANIM[s.mood], animationPlayState:paused ? 'paused' : 'running' }}/>
              </div>
              {s.scene === 'silence' && (
                <div style={{ position:'absolute', inset:0, background:'#000', animation:'uoIris 2.4s ease forwards' }}/>
              )}
            </div>

            {/* Barra de progresso da narração da cena atual */}
            <div style={{ height:3, background:T.border }}>
              <div style={{ height:'100%', width:`${(typedChars / fullText.length) * 100}%`,
                background:T.gold, transition:'width .12s linear' }}/>
            </div>

            {/* Legenda (caixa de narração, como num quadrinho) */}
            <div onClick={handleNext}
              style={{ padding:'18px 30px 10px', minHeight:120, maxHeight:190, overflowY:'auto',
                display:'flex', flexDirection:'column', gap:12, cursor:'pointer' }}>
              {fullText.slice(0, typedChars).split('\n\n').map((paragraph, i, arr) => (
                <div key={i} style={{ fontSize:14, color:T.text, lineHeight:1.6 }}>
                  {paragraph}
                  {!finished && i === arr.length - 1 && (
                    <span style={{ display:'inline-block', width:7, height:15, marginLeft:2, verticalAlign:'text-bottom',
                      background:T.gold, animation:'uoCursorBlink .9s steps(1) infinite' }}/>
                  )}
                </div>
              ))}
            </div>

            {/* Rodapé: narrador (pausar) + dots + navegação */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 30px 22px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={() => setPaused(p => !p)} title={paused ? 'Continuar narração' : 'Pausar narração'}
                  style={{ width:26, height:26, borderRadius:'50%', border:`1px solid ${T.border}`, background:'transparent',
                    cursor:'pointer', color:T.textS, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                  {paused ? '▶' : '⏸'}
                </button>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', maxWidth:150 }}>
                  {SLIDES.map((_, i) => (
                    <button key={i} onClick={() => goTo(i)} aria-label={`Cena ${i+1}`}
                      style={{ width:i===page?18:7, height:7, borderRadius:99, border:'none', cursor:'pointer', padding:0,
                        background:i===page?T.gold:T.border, transition:'all .2s' }}/>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {page > 0 && (
                  <button onClick={() => goTo(page - 1)}
                    style={{ padding:'9px 16px', borderRadius:11, border:`1px solid ${T.border}`, background:'transparent',
                      cursor:'pointer', fontSize:13, fontWeight:600, color:T.textS, fontFamily:'var(--font-body)' }}>
                    ◀ Anterior
                  </button>
                )}
                <button onClick={handleNext}
                  style={{ padding:'9px 18px', borderRadius:11, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    color:'#fff', fontFamily:'var(--font-body)', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                    boxShadow:`0 3px 12px ${T.gold}44` }}>
                  {!finished ? 'Revelar ⚡' : page === last ? 'Fechar 🤫' : 'Próxima ▶'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UnikoOrigin;
