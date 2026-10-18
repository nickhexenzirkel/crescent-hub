// Efeitos flutuantes dos temas sazonais de festa — Páscoa, Carnaval e São João
// (Dashboard RH → Painéis → Modo Sazonal; ver shared/modoSazonal.js, os temas
// 'pascoa'/'carnaval'/'saojoao' em contexts/theme.js e o Halloween/Natal em
// EfeitoSazonal.jsx, que é quem decide ONDE esses efeitos aparecem).
// Mesmas regras dos outros: tudo em SVG/CSS (sem emoji, sem imagem nova), só
// transform/opacity nos keyframes (nunca filter:blur() animado — ver
// shared/bolhas.js), tudo pointer-events:none, cenário de fundo em zIndex 0
// (atrás dos botões) e só o que sobrevoa a tela de leve em zIndex 5.
import React from 'react';

// Número "aleatório" estável por índice — o componente re-renderiza quando o
// tema muda (ver EfeitoSazonal) e não pode reembaralhar tudo de lugar.
const det = (i, k = 0) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const faixa = (i, k, a, b) => a + det(i, k) * (b - a);

const wrapStyle = { position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none', overflow: 'hidden' };
const wrapStyleFundo = { ...wrapStyle, zIndex: 0 };

const FESTA_CSS = `
@keyframes fstCair {
  0%   { transform: translate(0, -10vh) rotate(0deg); opacity: 0; }
  8%   { opacity: .95; }
  92%  { opacity: .95; }
  100% { transform: translate(var(--dx, 30px), 110vh) rotate(var(--rot, 360deg)); opacity: 0; }
}
@keyframes fstBalanca {
  0%,100% { transform: rotate(-2.2deg); }
  50%     { transform: rotate(2.2deg); }
}
@keyframes fstBob {
  0%,100% { transform: translateY(0) rotate(-3deg); }
  50%     { transform: translateY(-9px) rotate(3deg); }
}
@keyframes fstCintila {
  0%,100% { opacity: .35; transform: scale(.8); }
  50%     { opacity: 1;   transform: scale(1.25); }
}
@keyframes fstFogo {
  0%   { transform: scale(.12); opacity: 0; }
  5%   { opacity: 1; }
  38%  { transform: scale(1); opacity: 1; }
  58%  { transform: scale(1.18); opacity: 0; }
  100% { transform: scale(1.18); opacity: 0; }
}
/* Páscoa */
@keyframes fstCoelhoCorre {
  0%   { transform: translateX(-18vw); }
  100% { transform: translateX(118vw); }
}
@keyframes fstPulo {
  0%,100% { transform: translateY(0) rotate(0deg); }
  25%     { transform: translateY(-34px) rotate(-7deg); }
  50%     { transform: translateY(0) rotate(0deg); }
  60%     { transform: translateY(-4px) rotate(3deg); }
  70%     { transform: translateY(0) rotate(0deg); }
}
@keyframes fstBorboleta {
  0%   { transform: translate(-8vw, 62vh); opacity: 0; }
  6%   { opacity: .95; }
  25%  { transform: translate(24vw, 40vh); }
  50%  { transform: translate(52vw, 56vh); }
  75%  { transform: translate(80vw, 30vh); }
  94%  { opacity: .95; }
  100% { transform: translate(112vw, 44vh); opacity: 0; }
}
@keyframes fstAsa {
  0%,100% { transform: scaleX(1); }
  50%     { transform: scaleX(.28); }
}
/* Carnaval */
@keyframes fstConfete {
  0%   { transform: translate(0, -8vh) rotate(0deg) rotateX(0deg); opacity: 0; }
  8%   { opacity: 1; }
  92%  { opacity: 1; }
  100% { transform: translate(var(--dx, 40px), 108vh) rotate(var(--rot, 540deg)) rotateX(720deg); opacity: 0; }
}
@keyframes fstSerpentina {
  0%,100% { transform: rotate(-3.5deg) scaleY(1); }
  50%     { transform: rotate(3.5deg) scaleY(1.05); }
}
@keyframes fstMascaraFlutua {
  0%,100% { transform: translateY(0) rotate(-8deg); }
  50%     { transform: translateY(-14px) rotate(6deg); }
}
/* São João */
@keyframes fstChama {
  0%,100% { transform: scale(1, 1) rotate(-1.5deg); }
  30%     { transform: scale(.92, 1.1) rotate(2deg); }
  60%     { transform: scale(1.06, .94) rotate(-2deg); }
}
@keyframes fstBrilhoFogueira {
  0%,100% { opacity: .75; transform: translateX(-50%) scale(1); }
  50%     { opacity: 1;   transform: translateX(-50%) scale(1.08); }
}
@keyframes fstFaisca {
  0%   { transform: translate(0, 0) scale(1); opacity: 0; }
  12%  { opacity: 1; }
  100% { transform: translate(var(--dx, 20px), -190px) scale(.2); opacity: 0; }
}
@keyframes fstBalao {
  0%   { transform: translate(var(--x0, 0px), 112vh); opacity: 0; }
  6%   { opacity: 1; }
  94%  { opacity: 1; }
  100% { transform: translate(var(--x1, 60px), -34vh); opacity: 0; }
}
@keyframes fstOscila {
  0%,100% { transform: translateX(-12px) rotate(-4deg); }
  50%     { transform: translateX(12px) rotate(4deg); }
}
`;

const Estrelinha = ({ size = 10, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }}>
    <polygon points="12,1 15,9 23,9 16.5,14 19,22 12,17.5 5,22 7.5,14 1,9 9,9"/>
  </svg>
);

/* Explosão de fogos — raios + pontinhas; um ciclo longo, então estoura de vez em quando */
const Fogo = ({ left, top, size = 120, cores, dur = 9, delay = 0 }) => (
  <div style={{ position: 'absolute', left, top, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
    animation: `fstFogo ${dur}s ease-out ${delay}s infinite`, opacity: 0 }}>
    <svg width={size} height={size} viewBox="0 0 100 100">
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2, c = cores[i % cores.length];
        const x1 = 50 + Math.cos(a) * 16, y1 = 50 + Math.sin(a) * 16, x2 = 50 + Math.cos(a) * 44, y2 = 50 + Math.sin(a) * 44;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="2.6" strokeLinecap="round"/>
            <circle cx={50 + Math.cos(a) * 48} cy={50 + Math.sin(a) * 48} r="2.6" fill={c}/>
          </g>
        );
      })}
    </svg>
  </div>
);

/* ═════════════════════════════ PÁSCOA ═════════════════════════════ */

const PALETAS_OVO = [
  ['#FF9EC7', '#FFE066', '#FFFFFF'], ['#9B8CFF', '#7FE0C4', '#FFFFFF'], ['#FFD166', '#FF6B9A', '#FFFFFF'],
  ['#7FE0C4', '#FF9EC7', '#FFFFFF'], ['#6FB8FF', '#FFE066', '#FFFFFF'], ['#FF8A5B', '#FFE9A8', '#FFFFFF'],
];

// Ovo de Páscoa — corpo em degradê + faixa decorada (zigue-zague, bolinhas ou listras).
const Ovo = ({ w = 44, paleta = 0, estampa = 0, uid }) => {
  const [c1, c2, c3] = PALETAS_OVO[paleta % PALETAS_OVO.length];
  const h = +(w * 1.27).toFixed(1);
  const forma = 'M30 3C15 3 4 28 4 46c0 17 11 27 26 27s26-10 26-27C56 28 45 3 30 3Z';
  return (
    <svg width={w} height={h} viewBox="0 0 60 76" style={{ display: 'block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.35))' }}>
      <defs>
        <linearGradient id={`ovo-g-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c1} stopOpacity=".72"/>
        </linearGradient>
        <clipPath id={`ovo-c-${uid}`}><path d={forma}/></clipPath>
      </defs>
      <path d={forma} fill={`url(#ovo-g-${uid})`}/>
      <g clipPath={`url(#ovo-c-${uid})`}>
        {estampa % 3 === 0 && (
          <>
            <rect x="0" y="34" width="60" height="16" fill={c2} opacity=".95"/>
            <polyline points="0,42 8,36 16,42 24,36 32,42 40,36 48,42 56,36 64,42" fill="none" stroke={c3} strokeWidth="3" strokeLinejoin="round"/>
          </>
        )}
        {estampa % 3 === 1 && [[18, 26], [38, 24], [28, 40], [14, 50], [44, 48], [28, 60]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 4 : 5.2} fill={i % 2 ? c2 : c3} opacity=".95"/>
        ))}
        {estampa % 3 === 2 && [22, 36, 50].map((y, i) => (
          <rect key={i} x="0" y={y} width="60" height={i === 1 ? 7 : 4.5} fill={i === 1 ? c3 : c2}/>
        ))}
        <ellipse cx="21" cy="20" rx="6" ry="11" fill="#fff" opacity=".26" transform="rotate(18 21 20)"/>
      </g>
    </svg>
  );
};

const Cenoura = ({ h = 54 }) => (
  <svg width={h * 0.42} height={h} viewBox="0 0 24 60" style={{ display: 'block' }}>
    <path d="M12 58C7 46 3 30 5 17c1-4 4-6 7-6s6 2 7 6c2 13-2 29-7 41Z" fill="#FF8A2B"/>
    <path d="M8 26h6M7 36h7M9 46h5" stroke="#E86A10" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M12 12C9 5 5 3 3 4c1 4 4 7 9 8Zm0 0c0-6 1-10 3-11 1 4 0 8-3 11Zm0 0c3-4 7-6 9-5-1 4-4 6-9 5Z" fill="#46C266"/>
  </svg>
);

const Coelho = ({ w = 92 }) => (
  <svg width={w} height={w * 0.95} viewBox="0 0 120 114" style={{ display: 'block', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.4))' }}>
    {/* orelhas */}
    <g>
      <ellipse cx="78" cy="22" rx="9.5" ry="24" fill="#F6EEFF" transform="rotate(10 78 22)"/>
      <ellipse cx="78" cy="23" rx="4.6" ry="17" fill="#FFB3D1" transform="rotate(10 78 23)"/>
      <ellipse cx="96" cy="26" rx="9" ry="22" fill="#F6EEFF" transform="rotate(26 96 26)"/>
      <ellipse cx="96" cy="27" rx="4.2" ry="15" fill="#FFB3D1" transform="rotate(26 96 27)"/>
    </g>
    {/* corpo, rabinho, patas */}
    <ellipse cx="46" cy="76" rx="36" ry="26" fill="#F6EEFF"/>
    <circle cx="10" cy="74" r="10" fill="#FFFFFF"/>
    <ellipse cx="62" cy="100" rx="16" ry="8" fill="#EADFFB"/>
    <ellipse cx="26" cy="100" rx="13" ry="7" fill="#EADFFB"/>
    {/* cabeça */}
    <circle cx="86" cy="62" r="21" fill="#F6EEFF"/>
    <circle cx="93" cy="58" r="3.2" fill="#2A1838"/>
    <circle cx="94" cy="57" r="1" fill="#fff"/>
    <ellipse cx="104" cy="66" rx="4.4" ry="3.4" fill="#FF8DB5"/>
    <circle cx="80" cy="68" r="5" fill="#FFB3D1" opacity=".7"/>
    <path d="M101 70q-3 4-7 3" stroke="#B58BC8" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
  </svg>
);

const Borboleta = ({ size = 40, c1 = '#FF9EC7', c2 = '#FFE066' }) => (
  <div style={{ width: size, height: size * 0.8, position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, animation: 'fstAsa .5s ease-in-out infinite', transformOrigin: '50% 50%' }}>
      <svg width={size} height={size * 0.8} viewBox="0 0 50 40" style={{ display: 'block' }}>
        <ellipse cx="14" cy="15" rx="13" ry="12" fill={c1}/><ellipse cx="36" cy="15" rx="13" ry="12" fill={c1}/>
        <ellipse cx="17" cy="29" rx="9" ry="8" fill={c2}/><ellipse cx="33" cy="29" rx="9" ry="8" fill={c2}/>
        <circle cx="14" cy="14" r="4" fill="#fff" opacity=".55"/><circle cx="36" cy="14" r="4" fill="#fff" opacity=".55"/>
      </svg>
    </div>
    <div style={{ position: 'absolute', left: '50%', top: '14%', width: 3, height: '70%', marginLeft: -1.5, background: '#3A2448', borderRadius: 3 }}/>
  </div>
);

const Petala = ({ size = 14, cor = '#FFB8D8' }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 20 26" style={{ display: 'block' }}>
    <path d="M10 1C4 7 2 14 5 20c2 4 8 4 10 0 3-6 1-13-5-19Z" fill={cor}/>
    <path d="M10 5c-1 5-1 10 0 16" stroke="#fff" strokeOpacity=".4" strokeWidth="1.2" fill="none"/>
  </svg>
);

const Flor = ({ size = 26, cor = '#FF9EC7' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
    {[0, 72, 144, 216, 288].map(a => (
      <ellipse key={a} cx="20" cy="9" rx="6.5" ry="9" fill={cor} transform={`rotate(${a} 20 20)`}/>
    ))}
    <circle cx="20" cy="20" r="5" fill="#FFE066"/>
  </svg>
);

const EfeitoPascoa = () => {
  const ovos = [
    { left: '4%', w: 46, paleta: 0, estampa: 0 }, { left: '9.5%', w: 34, paleta: 1, estampa: 1 },
    { left: '17%', w: 40, paleta: 2, estampa: 2 }, { left: '36%', w: 30, paleta: 3, estampa: 0 },
    { left: '55%', w: 44, paleta: 4, estampa: 1 }, { left: '66%', w: 32, paleta: 5, estampa: 2 },
    { left: '81%', w: 48, paleta: 1, estampa: 0 }, { left: '91%', w: 36, paleta: 0, estampa: 2 },
  ];
  const petalas = Array.from({ length: 16 }, (_, i) => ({
    left: `${(i * 6.4 + det(i, 1) * 5) % 100}%`, dur: faixa(i, 2, 11, 19), delay: -faixa(i, 3, 0, 18),
    size: faixa(i, 4, 11, 19), dx: (det(i, 5) > .5 ? 1 : -1) * faixa(i, 6, 30, 90),
    cor: ['#FFB8D8', '#FFFFFF', '#D8C8FF', '#FFE9A8'][i % 4],
  }));
  const flores = [{ left: '12%', top: '8%', size: 28 }, { left: '88%', top: '14%', size: 22 }, { left: '70%', top: '5%', size: 18 }];
  return (
    <>
      <div style={wrapStyleFundo} aria-hidden="true">
        <style>{FESTA_CSS}</style>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% -10%, rgba(255,158,199,0.20) 0%, transparent 55%)' }}/>
        <svg width="100%" height="150" viewBox="0 0 1000 150" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, display: 'block' }}>
          <path d="M0 150V80C120 40 220 60 330 84S520 70 640 50 860 56 1000 84V150Z" fill="#122A1E" opacity=".9"/>
        </svg>
        <svg width="100%" height="96" viewBox="0 0 1000 96" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, display: 'block' }}>
          <path d="M0 96V52C100 28 210 40 320 56S540 62 660 44 880 34 1000 54V96Z" fill="#1B4430"/>
          {[40, 130, 260, 420, 560, 690, 810, 930].map((x, i) => (
            <path key={i} d={`M${x} 90l-3-16M${x} 90l1-18M${x} 90l4-15`} stroke="#2F7A4E" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          ))}
        </svg>
        {ovos.map((o, i) => (
          <div key={i} style={{ position: 'absolute', bottom: 8 + (i % 3) * 7, left: o.left,
            animation: `fstBob ${4 + (i % 4) * 0.7}s ease-in-out ${-i * 0.8}s infinite` }}>
            <Ovo w={o.w} paleta={o.paleta} estampa={o.estampa} uid={`p${i}`}/>
          </div>
        ))}
        {[{ left: '27%', h: 58 }, { left: '47%', h: 48 }, { left: '75%', h: 54 }].map((c, i) => (
          <div key={'c' + i} style={{ position: 'absolute', bottom: 2, left: c.left, transform: `rotate(${i * 9 - 8}deg)` }}><Cenoura h={c.h}/></div>
        ))}
        {flores.map((f, i) => (
          <div key={'f' + i} style={{ position: 'absolute', top: f.top, left: f.left, opacity: .85, animation: `fstCintila ${3 + i}s ease-in-out ${-i}s infinite` }}>
            <Flor size={f.size} cor={['#FF9EC7', '#C2B8FF', '#FFE066'][i % 3]}/>
          </div>
        ))}
      </div>
      <div style={wrapStyle} aria-hidden="true">
        {petalas.map((p, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: p.left, '--dx': `${p.dx}px`, '--rot': '420deg',
            animation: `fstCair ${p.dur}s linear ${p.delay}s infinite` }}>
            <Petala size={p.size} cor={p.cor}/>
          </div>
        ))}
        <div style={{ position: 'absolute', top: 0, left: 0, animation: 'fstBorboleta 38s linear -9s infinite' }}><Borboleta size={42}/></div>
        <div style={{ position: 'absolute', top: 0, left: 0, animation: 'fstBorboleta 52s linear -31s infinite' }}><Borboleta size={30} c1="#9B8CFF" c2="#7FE0C4"/></div>
        {/* coelhinho pulando pelo rodapé, um por vez */}
        <div style={{ position: 'absolute', bottom: 34, left: 0, animation: 'fstCoelhoCorre 44s linear -10s infinite' }}>
          <div style={{ animation: 'fstPulo .9s ease-in-out infinite' }}><Coelho w={92}/></div>
        </div>
      </div>
    </>
  );
};

/* ═════════════════════════════ CARNAVAL ═════════════════════════════ */

const CORES_FOLIA = ['#FFD21F', '#FF4FA3', '#19D3B4', '#7A5CFF', '#FF7A2E', '#4DA3FF', '#FFFFFF'];

const Mascara = ({ w = 130, c1 = '#FFD21F', c2 = '#FF4FA3', uid }) => (
  <svg width={w} height={w * 0.72} viewBox="0 0 130 94" style={{ display: 'block', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,.4))' }}>
    <defs>
      <linearGradient id={`mas-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c2}/></linearGradient>
    </defs>
    {/* plumas */}
    <ellipse cx="108" cy="12" rx="6" ry="22" fill="#19D3B4" transform="rotate(32 108 12)"/>
    <ellipse cx="118" cy="22" rx="5.5" ry="19" fill="#7A5CFF" transform="rotate(52 118 22)"/>
    <ellipse cx="96" cy="8" rx="5" ry="17" fill="#FFFFFF" transform="rotate(14 96 8)"/>
    <path d="M8 44C20 22 42 28 65 42C88 28 110 22 122 44C120 70 98 84 80 76C72 72 69 62 65 62C61 62 58 72 50 76C32 84 10 70 8 44Z" fill={`url(#mas-${uid})`}/>
    <ellipse cx="38" cy="48" rx="15" ry="9" fill="#150A2E" transform="rotate(-14 38 48)"/>
    <ellipse cx="92" cy="48" rx="15" ry="9" fill="#150A2E" transform="rotate(14 92 48)"/>
    <path d="M14 40C30 32 44 36 56 44M116 40C100 32 86 36 74 44" stroke="#fff" strokeOpacity=".55" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {[[24, 64], [40, 70], [90, 70], [106, 64], [65, 30]].map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="2.6" fill="#fff" opacity=".85"/>))}
    <path d="M65 24l3 6 6 .8-4.5 4.2 1.2 6L65 38l-5.7 3 1.2-6-4.5-4.2 6-.8Z" fill="#fff" opacity=".9"/>
  </svg>
);

const SERPENTINAS = [
  { left: '3%', cor: '#FF4FA3', h: 300, dur: 5.5, delay: 0 }, { left: '9%', cor: '#FFD21F', h: 230, dur: 6.5, delay: -2 },
  { left: '24%', cor: '#19D3B4', h: 260, dur: 6, delay: -1 }, { left: '58%', cor: '#7A5CFF', h: 240, dur: 7, delay: -3 },
  { left: '77%', cor: '#FF7A2E', h: 310, dur: 5.8, delay: -4 }, { left: '88%', cor: '#4DA3FF', h: 250, dur: 6.2, delay: -1.5 },
  { left: '95%', cor: '#FFD21F', h: 290, dur: 6.8, delay: -2.5 },
];

const EfeitoCarnaval = () => {
  const confetes = Array.from({ length: 34 }, (_, i) => ({
    left: `${(i * 3 + det(i, 1) * 6) % 100}%`, dur: faixa(i, 2, 8, 15), delay: -faixa(i, 3, 0, 16),
    w: faixa(i, 4, 7, 13), h: faixa(i, 5, 4, 8), dx: (det(i, 6) > .5 ? 1 : -1) * faixa(i, 7, 30, 120),
    rot: Math.round(faixa(i, 8, 360, 900)), cor: CORES_FOLIA[i % CORES_FOLIA.length], redondo: i % 4 === 0,
  }));
  return (
    <>
      <div style={wrapStyleFundo} aria-hidden="true">
        <style>{FESTA_CSS}</style>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 0% 0%, rgba(255,79,163,0.20) 0%, transparent 45%), radial-gradient(ellipse at 100% 0%, rgba(25,211,180,0.18) 0%, transparent 45%), radial-gradient(ellipse at 50% 110%, rgba(255,210,31,0.16) 0%, transparent 50%)' }}/>
        {/* serpentinas penduradas no topo */}
        {SERPENTINAS.map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: s.left, transformOrigin: '50% 0', opacity: .85,
            animation: `fstSerpentina ${s.dur}s ease-in-out ${s.delay}s infinite` }}>
            <svg width="34" height={s.h} viewBox="0 0 34 300" preserveAspectRatio="none">
              <path d="M17 0C34 28 0 56 17 84S34 140 17 168S0 224 17 252S30 290 17 300" stroke={s.cor} strokeWidth="6" fill="none" strokeLinecap="round"/>
              <path d="M17 0C34 28 0 56 17 84S34 140 17 168S0 224 17 252S30 290 17 300" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: 14, left: '3%', animation: 'fstMascaraFlutua 5s ease-in-out infinite' }}>
          <Mascara w={150} c1="#FFD21F" c2="#FF4FA3" uid="a"/>
        </div>
        <div style={{ position: 'absolute', bottom: 22, right: '4%', animation: 'fstMascaraFlutua 6s ease-in-out -2.5s infinite' }}>
          <Mascara w={116} c1="#19D3B4" c2="#7A5CFF" uid="b"/>
        </div>
      </div>
      <div style={wrapStyle} aria-hidden="true">
        <Fogo left="22%" top="22%" size={130} cores={['#FFD21F', '#FF4FA3', '#fff']} dur={9} delay={0}/>
        <Fogo left="74%" top="16%" size={150} cores={['#19D3B4', '#FFD21F', '#fff']} dur={11} delay={-4}/>
        <Fogo left="50%" top="32%" size={110} cores={['#7A5CFF', '#FF4FA3', '#fff']} dur={8} delay={-6.5}/>
        {confetes.map((c, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: c.left, '--dx': `${c.dx}px`, '--rot': `${c.rot}deg`,
            animation: `fstConfete ${c.dur}s linear ${c.delay}s infinite` }}>
            <div style={{ width: c.w, height: c.redondo ? c.w : c.h, background: c.cor, borderRadius: c.redondo ? '50%' : 2, opacity: .92 }}/>
          </div>
        ))}
      </div>
    </>
  );
};

/* ═════════════════════════════ SÃO JOÃO ═════════════════════════════ */

const CORES_JUNINA = ['#FF4D4D', '#FFC233', '#3DBE6C', '#4DA3FF', '#FF7AC8', '#FFFFFF'];

// Varal de bandeirinhas: triângulos ao longo de um arco (um arco a cada 500u).
const Bandeirinhas = ({ topo = 0, desloca = 0, seed = 0 }) => {
  const N = 26, tri = [];
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 1000, y = 6 + 30 * Math.sin(((x % 500) / 500) * Math.PI);
    tri.push(
      <polygon key={i} points={`${x - 15},${y} ${x + 15},${y} ${x},${y + 36}`} fill={CORES_JUNINA[(i + seed) % CORES_JUNINA.length]} opacity=".95"/>
    );
  }
  return (
    <div style={{ position: 'absolute', top: topo, left: 0, right: 0, transformOrigin: '50% 0', animation: `fstBalanca ${7 + desloca}s ease-in-out ${-desloca}s infinite` }}>
      <svg width="100%" height="80" viewBox="0 0 1000 80" preserveAspectRatio="none" style={{ display: 'block' }}>
        <path d="M0 6Q250 42 500 6T1000 6" stroke="#8A6A3E" strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke"/>
        {tri}
      </svg>
    </div>
  );
};

const Chama = ({ w, h, c, atraso = 0, dur = 0.9 }) => (
  <div style={{ position: 'absolute', bottom: 18, left: '50%', width: w, height: h, marginLeft: -w / 2, transformOrigin: '50% 100%',
    animation: `fstChama ${dur}s ease-in-out ${atraso}s infinite` }}>
    <svg width={w} height={h} viewBox="0 0 60 100" preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d="M30 2C26 26 6 40 8 66c1 22 15 32 22 32s21-10 22-32C54 40 34 26 30 2Z" fill={c}/>
    </svg>
  </div>
);

const Fogueira = () => (
  <div style={{ position: 'absolute', bottom: 6, left: '13%', width: 150, height: 190 }}>
    <div style={{ position: 'absolute', bottom: -60, left: '50%', width: 360, height: 300, borderRadius: '50%',
      background: 'radial-gradient(ellipse at center, rgba(255,170,40,.45) 0%, rgba(255,110,20,.18) 45%, transparent 72%)',
      animation: 'fstBrilhoFogueira 2.4s ease-in-out infinite' }}/>
    <Chama w={112} h={150} c="#E8452A" dur={1.1}/>
    <Chama w={86} h={118} c="#FF9A1F" atraso={-.3} dur={.9}/>
    <Chama w={54} h={78} c="#FFE066" atraso={-.55} dur={.8}/>
    <svg width="150" height="190" viewBox="0 0 150 190" style={{ position: 'absolute', inset: 0 }}>
      <rect x="14" y="160" width="122" height="17" rx="8.5" fill="#5A3318" transform="rotate(-11 75 168)"/>
      <rect x="14" y="160" width="122" height="17" rx="8.5" fill="#6B3E1E" transform="rotate(11 75 168)"/>
      <circle cx="26" cy="166" r="6" fill="#3A200E"/><circle cx="124" cy="166" r="6" fill="#3A200E"/>
    </svg>
    {Array.from({ length: 9 }).map((_, i) => (
      <div key={i} style={{ position: 'absolute', bottom: 70, left: 52 + det(i, 1) * 50, width: 4, height: 4, borderRadius: '50%',
        background: i % 2 ? '#FFE066' : '#FF9A1F', boxShadow: '0 0 6px #FFB347', '--dx': `${(det(i, 2) - .5) * 90}px`,
        animation: `fstFaisca ${faixa(i, 3, 2.2, 4.4)}s ease-out ${-faixa(i, 4, 0, 4)}s infinite`, opacity: 0 }}/>
    ))}
  </div>
);

const Milho = ({ h = 96 }) => (
  <svg width={h * 0.4} height={h} viewBox="0 0 40 100" style={{ display: 'block' }}>
    <path d="M20 4C9 14 6 40 10 62c2 12 8 18 10 18s8-6 10-18c4-22 1-48-10-58Z" fill="#FFC233"/>
    {[16, 28, 40, 52, 64].map((y, i) => (
      <g key={i} fill="#E8A21A" opacity=".8">
        <circle cx="14" cy={y} r="2.6"/><circle cx="21" cy={y + 4} r="2.6"/><circle cx="28" cy={y} r="2.6"/>
      </g>
    ))}
    <path d="M20 96C6 88 2 66 8 46c4 14 10 24 12 30Z" fill="#3DBE6C"/>
    <path d="M20 96c14-8 18-30 12-50-4 14-10 24-12 30Z" fill="#2FA05A"/>
  </svg>
);

const Balao = ({ w = 62, cores = ['#FF4D4D', '#FFC233'], uid }) => (
  <svg width={w} height={w * 1.55} viewBox="0 0 60 93" style={{ display: 'block', filter: 'drop-shadow(0 0 14px rgba(255,170,60,.5))' }}>
    <defs>
      <clipPath id={`bal-${uid}`}><path d="M30 3C8 3 2 28 10 46c6 14 14 22 16 28h8c2-6 10-14 16-28C58 28 52 3 30 3Z"/></clipPath>
    </defs>
    <g clipPath={`url(#bal-${uid})`}>
      {[0, 1, 2, 3, 4, 5].map(i => (<rect key={i} x={i * 10} y="0" width="10" height="80" fill={cores[i % cores.length]}/>))}
      <ellipse cx="20" cy="22" rx="6" ry="13" fill="#fff" opacity=".22" transform="rotate(14 20 22)"/>
    </g>
    <path d="M26 74h8l-1 5h-6Z" fill="#7A4A22"/>
    <ellipse cx="30" cy="84" rx="5" ry="7" fill="#FFB347"/><ellipse cx="30" cy="85" rx="2.6" ry="4.4" fill="#FFF0A0"/>
  </svg>
);

const EfeitoSaoJoao = () => {
  const estrelas = Array.from({ length: 14 }, (_, i) => ({ left: `${det(i, 1) * 96 + 1}%`, top: `${det(i, 2) * 42 + 8}%`, size: faixa(i, 3, 6, 13), dur: faixa(i, 4, 2, 4), delay: -faixa(i, 5, 0, 3) }));
  const baloes = [
    { x0: 8, x1: 90, dur: 62, delay: -8, w: 60, cores: ['#FF4D4D', '#FFC233'] },
    { x0: 46, x1: -30, dur: 78, delay: -41, w: 76, cores: ['#4DA3FF', '#FFFFFF'] },
    { x0: 80, x1: 40, dur: 70, delay: -26, w: 52, cores: ['#3DBE6C', '#FFC233'] },
  ];
  return (
    <>
      <div style={wrapStyleFundo} aria-hidden="true">
        <style>{FESTA_CSS}</style>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 18% 100%, rgba(255,140,30,0.20) 0%, transparent 52%), radial-gradient(ellipse at 50% -10%, rgba(232,87,58,0.12) 0%, transparent 55%)' }}/>
        {estrelas.map((e, i) => (
          <div key={i} style={{ position: 'absolute', left: e.left, top: e.top, animation: `fstCintila ${e.dur}s ease-in-out ${e.delay}s infinite` }}>
            <Estrelinha size={e.size} color="#FFEAA8"/>
          </div>
        ))}
        <Bandeirinhas topo={0} desloca={0} seed={0}/>
        <Bandeirinhas topo={54} desloca={2.2} seed={3}/>
        <svg width="100%" height="120" viewBox="0 0 1000 120" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, display: 'block' }}>
          <path d="M0 120V70C140 34 260 52 380 70S600 60 720 44 900 48 1000 72V120Z" fill="#1A0D04"/>
          <path d="M0 120V92C160 70 300 84 440 92S680 80 820 72 940 78 1000 90V120Z" fill="#26140A"/>
        </svg>
        <Fogueira/>
        {[{ right: '5%', h: 104, rot: 6 }, { right: '9.5%', h: 84, rot: -5 }, { right: '13.5%', h: 96, rot: 9 }].map((m, i) => (
          <div key={i} style={{ position: 'absolute', bottom: 4, right: m.right, transform: `rotate(${m.rot}deg)` }}><Milho h={m.h}/></div>
        ))}
      </div>
      <div style={wrapStyle} aria-hidden="true">
        <Fogo left="30%" top="20%" size={140} cores={['#FFC233', '#FF4D4D', '#fff']} dur={10} delay={-2}/>
        <Fogo left="70%" top="26%" size={120} cores={['#FF7A2E', '#FFE066', '#fff']} dur={12} delay={-7}/>
        {baloes.map((b, i) => (
          <div key={i} style={{ position: 'absolute', top: 0, left: 0, '--x0': `${b.x0}vw`, '--x1': `${b.x1}vw`,
            animation: `fstBalao ${b.dur}s linear ${b.delay}s infinite`, opacity: 0 }}>
            <div style={{ animation: `fstOscila ${4 + i}s ease-in-out infinite` }}><Balao w={b.w} cores={b.cores} uid={`b${i}`}/></div>
          </div>
        ))}
      </div>
    </>
  );
};

export { EfeitoPascoa, EfeitoCarnaval, EfeitoSaoJoao };
