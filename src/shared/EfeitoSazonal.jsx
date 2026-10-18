// Efeitos flutuantes globais — Dashboard RH → Painéis → Modo Sazonal (ver
// shared/modoSazonal.js e os temas 'halloween'/'natal' em contexts/theme.js).
// Tudo em SVG (nada de emoji) — o raio reaproveita a técnica do Uniko
// Vampire Robot (shared/vampireScene.jsx: bolt em zig-zag + glow), mas na
// cor do TEMA ativo da pessoa (T.gold), não fixo em vermelho — pedido
// explícito do dono, 17/10/2026.
// Só transform/opacity nos keyframes, nunca filter:blur() animado — mesma
// lição do fundo de bolhas (shared/bolhas.js): blur animado força o
// navegador a repintar a cada frame e já derrubou FPS noutras telas deste
// app. Tudo pointer-events:none, nunca atrapalha um clique.
import React, { useState, useEffect, useRef } from 'react';
import { T, onThemeChange } from '../contexts/theme';
import { useModoSazonal } from './modoSazonal';

/* ───────────────────────── Ícones (SVG puro) ───────────────────────── */

// Morcego — mesma imagem do Uniko Vampire Robot (ver shared/vampireScene.jsx
// → VampBat), não desenho próprio: é a forma de morcego que o dono pediu.
const IconBat = ({ size = 24, flip = false, rot = 0 }) => (
  <img src="/morcego.png" alt="" style={{
    width: size, height: 'auto', display: 'block',
    transform: `scaleX(${flip ? -1 : 1}) rotate(${rot}deg)`,
    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.55))',
  }}/>
);

// Abóbora grande e malvada — gomos marcados, sobrancelha única franzida,
// olhos triangulares inclinados pra dentro e boca serrilhada de dentes.
const IconPumpkin = ({ size = 72 }) => (
  <svg width={size} height={size * 0.86} viewBox="0 0 120 103" style={{ display: 'block' }}>
    <path d="M58 14c-2-7 0-13 7-14-3 5-3 10-1 15l-6-1z" fill="#3A6B2A"/>
    <rect x="54" y="8" width="11" height="16" rx="5" fill="#4C7A20" transform="rotate(-10 59 16)"/>
    <path d="M60 20C26 20 6 40 6 64c0 23 23 35 54 35s54-12 54-35c0-24-20-44-54-44Z" fill="#FF7A0F"/>
    <path d="M28 26C19 36 14 50 14 64c0 20 13 31 19 33M92 26c9 10 14 24 14 38 0 20-13 31-19 33M44 22c-6 13-8 30-8 42 0 18 6 31 10 35M76 22c6 13 8 30 8 42 0 18-6 31-10 35M60 20v79"
      stroke="#D45C00" strokeWidth="2.5" fill="none" opacity=".5"/>
    <path d="M28 54 L47 47 L53 56 L38 58Z" fill="#200D02"/>
    <path d="M92 54 L73 47 L67 56 L82 58Z" fill="#200D02"/>
    <polygon points="30,60 50,58 37,80" fill="#200D02"/>
    <polygon points="90,60 70,58 83,80" fill="#200D02"/>
    <polygon points="57,72 63,72 60,83" fill="#200D02"/>
    <path d="M24 87 L33 78 L40 89 L48 80 L55 91 L60 81 L65 91 L72 80 L80 89 L87 78 L96 87 L89 97 L31 97Z" fill="#200D02"/>
  </svg>
);

const IconSkull = ({ size = 26, color = '#EDEDF2' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <path fill={color} d="M50 6C28 6 14 24 14 44c0 15 7 24 13 30v16c0 5 4 8 8 8h6v-11h5v11h8v-11h5v11h6c4 0 8-3 8-8V74c6-6 13-15 13-30C86 24 72 6 50 6z"/>
    <circle cx="35" cy="44" r="9" fill={color === '#EDEDF2' ? '#1A0F24' : '#fff'}/>
    <circle cx="65" cy="44" r="9" fill={color === '#EDEDF2' ? '#1A0F24' : '#fff'}/>
    <path d="M43 64l7 9 7-9z" fill={color === '#EDEDF2' ? '#1A0F24' : '#fff'}/>
  </svg>
);

const IconNuvem = ({ w = 92, h = 38, color = '#180611', op = 0.4 }) => (
  <svg width={w} height={h} viewBox="0 0 92 38" style={{ display: 'block', opacity: op }}>
    <g fill={color}>
      <ellipse cx="26" cy="26" rx="22" ry="11"/>
      <ellipse cx="46" cy="19" rx="21" ry="14"/>
      <ellipse cx="65" cy="25" rx="20" ry="11"/>
      <ellipse cx="46" cy="29" rx="32" ry="9"/>
    </g>
  </svg>
);

// Raio em zig-zag — mesmo desenho/glow do Uniko Vampire Robot (ver
// shared/vampireScene.jsx → VampLightning), mas na cor do tema ATIVO (T.gold/
// T.goldLine) em vez de fixo em vermelho — acompanha qualquer um dos temas
// normais, e também o próprio tema Halloween quando é esse o escolhido.
const IconRaio = ({ w = 24, h = 60 }) => (
  <svg width={w} height={h} viewBox="0 0 24 60" preserveAspectRatio="none"
    style={{ display: 'block', filter: `drop-shadow(0 0 5px ${T.goldLine}) drop-shadow(0 0 12px ${T.gold})` }}>
    <path d="M14 0 L5 26 L12 26 L3 60 L20 22 L12 22 L19 0 Z" fill={T.gold}/>
    <path d="M14 0 L5 26 L12 26 L3 60 L20 22 L12 22 L19 0 Z" fill="#fff" opacity=".3"/>
  </svg>
);

// Floco de verdade (dendrítico, 3 eixos a 60° = 6 pontas), não setas — cada
// braço tem 2 pares de galhinhos simétricos nos dois lados, igual ao ❆.
const IconFloco = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <g stroke={color} strokeWidth="6" strokeLinecap="round">
      {[0, 60, 120].map(a => (
        <g key={a} transform={`rotate(${a} 50 50)`}>
          <line x1="50" y1="6" x2="50" y2="94"/>
          <line x1="50" y1="22" x2="38" y2="14"/><line x1="50" y1="22" x2="62" y2="14"/>
          <line x1="50" y1="38" x2="41" y2="31"/><line x1="50" y1="38" x2="59" y2="31"/>
          <line x1="50" y1="78" x2="38" y2="86"/><line x1="50" y1="78" x2="62" y2="86"/>
          <line x1="50" y1="62" x2="41" y2="69"/><line x1="50" y1="62" x2="59" y2="69"/>
        </g>
      ))}
    </g>
    <circle cx="50" cy="50" r="4.5" fill={color}/>
  </svg>
);

const IconEstrela = ({ size = 18, color = '#C8F3FF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }}>
    <polygon points="12,1 15,9 23,9 16.5,14 19,22 12,17.5 5,22 7.5,14 1,9 9,9"/>
  </svg>
);

// Pinheiro nevado — 3 camadas, com neve branca na borda de cada uma.
const IconPinheiro = ({ h = 70, tone = '#1E5878' }) => {
  const w = +(h * 0.62).toFixed(1);
  return (
    <svg width={w} height={h} viewBox="0 0 62 70" style={{ display: 'block' }}>
      <rect x="27" y="60" width="8" height="10" fill="#243444"/>
      <polygon points="31,0 10,24 18,24 4,42 14,42 0,62 62,62 48,42 58,42 44,24 52,24" fill={tone}/>
      <polygon points="31,0 24,12 38,12" fill="#EAF6FF"/>
      <polygon points="18,24 11,33 51,33 44,24" fill="#EAF6FF" opacity=".92"/>
      <polygon points="14,42 6,50 56,50 48,42" fill="#EAF6FF" opacity=".8"/>
    </svg>
  );
};

// Cordilheira nevada — silhueta em duas camadas (profundidade), fixa no
// rodapé da tela. Base do "cenário de verdade" pedido (não só ícones soltos).
const MontanhaNeve = () => (
  <svg width="100%" height="130" viewBox="0 0 1000 130" preserveAspectRatio="none"
    style={{ position: 'absolute', bottom: 0, left: 0, display: 'block' }}>
    <polygon points="0,130 0,85 90,35 170,75 270,15 350,65 440,25 530,80 620,40 710,85 810,30 910,70 1000,45 1000,130" fill="#0E2140" opacity=".88"/>
    <polygon points="0,130 0,105 110,70 230,100 330,55 430,95 550,65 660,105 770,60 890,100 1000,80 1000,130" fill="#16325C"/>
  </svg>
);

/* ───────────────────────── CSS (keyframes) ───────────────────────── */

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
@keyframes sazLightning {
  0%{opacity:0;}1%{opacity:1;}3%{opacity:.15;}5%{opacity:.95;}8%{opacity:0;}100%{opacity:0;}
}
@keyframes sazLightningFlash {
  0%{opacity:0;}1.5%{opacity:.5;}4%{opacity:.12;}6%{opacity:.42;}9%{opacity:0;}100%{opacity:0;}
}
@keyframes sazSkel {
  0%,100% { opacity: .5; transform: translateY(0) scale(1); }
  50%     { opacity: .9; transform: translateY(-6px) scale(1.08); }
}
@keyframes sazBurstBat {
  0%   { transform: translate(0,0) rotate(0deg) scale(.4); opacity: 0; }
  18%  { opacity: 1; }
  100% { transform: translate(var(--bx), var(--by)) rotate(var(--br)) scale(1); opacity: 0; }
}
`;

const NATAL_CSS = `
@keyframes sazNeve {
  0%   { transform: translate(0, -10vh) rotate(0deg); opacity: 0; }
  10%  { opacity: .9; }
  90%  { opacity: .9; }
  100% { transform: translate(var(--drift,20px), 110vh) rotate(360deg); opacity: 0; }
}
@keyframes sazTwinkle {
  0%,100% { opacity: .6; transform: scale(1); }
  50%     { opacity: 1;  transform: scale(1.35); }
}
`;

const wrapStyle = { position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none', overflow: 'hidden' };

/* ───────────────────────── Efeito ambiente — Halloween ───────────────────────── */

const RaiosVermelhos = () => {
  const bolts = useRef(null);
  if (!bolts.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    bolts.current = Array.from({ length: 6 }).map((_, i) => ({
      id: i, left: `${rnd(6, 88)}%`, top: rnd(4, 26), h: rnd(55, 150), delay: rnd(0, 0.8),
    }));
  }
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: 0,
        background: 'radial-gradient(ellipse at 55% 0%, #ff2d4055 0%, transparent 55%)',
        animation: 'sazLightningFlash 9s linear infinite' }}/>
      {bolts.current.map(b => (
        <div key={b.id} style={{ position: 'absolute', left: b.left, top: b.top, opacity: 0,
          animation: `sazLightning 9s linear ${b.delay}s infinite` }}>
          <IconRaio w={Math.round(b.h * 0.3)} h={b.h}/>
        </div>
      ))}
    </>
  );
};

const EfeitoHalloween = () => {
  const morcegos = [
    { top: '10%', dur: '16s', delay: '0s', size: 30, flip: false, rot: -6 },
    { top: '28%', dur: '21s', delay: '-6s', size: 24, flip: true, rot: 4 },
    { top: '46%', dur: '18s', delay: '-11s', size: 28, flip: false, rot: 8 },
  ];
  const nuvens = [
    { top: '5%', dur: '60s', delay: '0s', scale: 1.4, op: .14 },
    { top: '15%', dur: '82s', delay: '-24s', scale: 1.9, op: .10 },
  ];
  return (
    <div style={wrapStyle} aria-hidden="true">
      <style>{HALLOWEEN_CSS}</style>
      <RaiosVermelhos/>
      {nuvens.map((n, i) => (
        <div key={'nv' + i} style={{ position: 'absolute', top: n.top, left: 0,
          animation: `sazDerivaNuvem ${n.dur} linear ${n.delay} infinite` }}>
          <IconNuvem w={92 * n.scale} h={38 * n.scale} op={n.op}/>
        </div>
      ))}
      {morcegos.map((m, i) => (
        <div key={'mc' + i} style={{ position: 'absolute', top: m.top, left: 0,
          animation: `sazVoarMorcego ${m.dur} ease-in-out ${m.delay} infinite` }}>
          <IconBat size={m.size} flip={m.flip} rot={m.rot}/>
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: 10, left: '5%', animation: 'sazBobPumpkin 4.5s ease-in-out infinite' }}><IconPumpkin size={92}/></div>
      <div style={{ position: 'absolute', bottom: 6, right: '7%', animation: 'sazBobPumpkin 5.5s ease-in-out -2s infinite' }}><IconPumpkin size={62}/></div>
      <div style={{ position: 'absolute', bottom: 92, right: '4%', animation: 'sazSkel 3.4s ease-in-out infinite' }}><IconSkull size={28}/></div>
    </div>
  );
};

// Explosão de morcegos ao entrar num módulo — mesmo espírito do Uniko
// Vampire Robot (shared/vampireScene.jsx), só que num burst único em vez de
// morcegos ambientes: ~1.6s, depois some sozinho.
const BurstMorcegos = () => {
  const [sumiu, setSumiu] = useState(false);
  const bats = useRef(null);
  if (!bats.current) {
    bats.current = Array.from({ length: 14 }).map((_, i) => {
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.35;
      const dist = 30 + Math.random() * 30;
      return {
        bx: `${Math.cos(ang) * dist}vmin`, by: `${Math.sin(ang) * dist}vmin`,
        br: `${Math.round(Math.random() * 360 - 180)}deg`,
        dur: `${1.0 + Math.random() * 0.5}s`, delay: `${Math.random() * 0.18}s`,
        size: 16 + Math.random() * 14, flip: Math.random() < 0.5,
      };
    });
  }
  useEffect(() => { const t = setTimeout(() => setSumiu(true), 1700); return () => clearTimeout(t); }, []);
  if (sumiu) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true">
      <style>{HALLOWEEN_CSS}</style>
      {bats.current.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%', marginTop: -b.size / 2, marginLeft: -b.size / 2,
          '--bx': b.bx, '--by': b.by, '--br': b.br,
          animation: `sazBurstBat ${b.dur} cubic-bezier(.17,.82,.32,1) ${b.delay} forwards`,
        }}>
          <IconBat size={b.size} flip={b.flip}/>
        </div>
      ))}
    </div>
  );
};

/* ───────────────────────── Efeito ambiente — Natal ─────────────────────────
   Cenário de verdade (não só ícone solto): cordilheira nevada no rodapé +
   uma floresta de pinheiros (vários, tamanhos/tons diferentes) + neve caindo
   + estrelas — pedido explícito do dono, 17/10/2026. */

const PINHEIROS = Array.from({ length: 11 }, (_, i) => ({
  left: `${2 + i * 9}%`,
  h: [58, 78, 46, 90, 64, 100, 54, 82, 70, 48, 86][i],
  tone: ['#1E5878', '#174866', '#276A8E', '#1A4E6E', '#246082'][i % 5],
}));

const EfeitoNatal = () => {
  const flocos = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 5.6) % 100}%`, dur: `${9 + (i % 5) * 2}s`, delay: `-${(i * 1.7) % 14}s`,
    size: 12 + (i % 3) * 6, drift: `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 3) * 10)}px`,
  }));
  const estrelas = [
    { top: '8%', left: '12%', size: 16, dur: '2.2s', delay: '0s' },
    { top: '14%', left: '82%', size: 20, dur: '1.9s', delay: '-.6s' },
    { top: '22%', left: '48%', size: 13, dur: '2.6s', delay: '-1.1s' },
    { top: '10%', left: '65%', size: 15, dur: '2.1s', delay: '-1.6s' },
    { top: '26%', left: '22%', size: 12, dur: '2.4s', delay: '-.3s' },
  ];
  return (
    <div style={wrapStyle} aria-hidden="true">
      <style>{NATAL_CSS}</style>
      {/* glow frio no céu, atrás de tudo */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% -10%, rgba(79,201,232,0.14) 0%, transparent 55%)' }}/>
      {estrelas.map((e, i) => (
        <div key={'es' + i} style={{ position: 'absolute', top: e.top, left: e.left,
          animation: `sazTwinkle ${e.dur} ease-in-out ${e.delay} infinite` }}>
          <IconEstrela size={e.size}/>
        </div>
      ))}
      {flocos.map((f, i) => (
        <div key={'fl' + i} style={{ position: 'absolute', top: 0, left: f.left,
          '--drift': f.drift, animation: `sazNeve ${f.dur} linear ${f.delay} infinite` }}>
          <IconFloco size={f.size}/>
        </div>
      ))}
      <MontanhaNeve/>
      {/* floresta — fixa no rodapé, atrás do conteúdo real por causa do z-index baixo do wrapper */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}>
        {PINHEIROS.map((p, i) => (
          <div key={i} style={{ position: 'absolute', bottom: 0, left: p.left }}>
            <IconPinheiro h={p.h} tone={p.tone}/>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────── Módulos que disparam o burst ─────────────────────── */
const TELAS_MODULO = new Set([
  'colaborador', 'ponto', 'dashboard', 'alexa', 'faturamento', 'conexao-setorial',
  'info-adicional', 'uniko-safer', 'uniko-security', '7-beneficios', 'mercado-estelar',
  'uniko-fit', 'uniko-call', 'prestacao-contas',
]);

// `screen` vem do App.jsx (estado de navegação) — só pra saber QUANDO disparar
// o burst de morcegos; o efeito ambiente não depende disso.
const EfeitoSazonal = ({ screen }) => {
  const modo = useModoSazonal();
  // T é mutável e este componente vive no App, fora da tela que troca o
  // tema — sem ouvir o aviso, o raio ficava preso na cor de quando montou
  // (mesmo motivo do LavaLamp em shared/components.jsx).
  const [, redesenha] = useState(0);
  useEffect(() => onThemeChange(() => redesenha(n => n + 1)), []);
  const [burstKey, setBurstKey] = useState(0);
  const telaAnteriorRef = useRef(screen);
  useEffect(() => {
    const anterior = telaAnteriorRef.current;
    telaAnteriorRef.current = screen;
    if (modo === 'halloween' && screen !== anterior && TELAS_MODULO.has(screen)) {
      setBurstKey(k => k + 1);
    }
  }, [screen, modo]);

  if (modo === 'halloween') {
    return (
      <>
        <EfeitoHalloween/>
        {burstKey > 0 && <BurstMorcegos key={burstKey}/>}
      </>
    );
  }
  if (modo === 'natal') return <EfeitoNatal/>;
  return null;
};

export default EfeitoSazonal;
