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

const IconBat = ({ size = 24, color = '#1A0F24' }) => (
  <svg width={size} height={size * 0.62} viewBox="0 0 100 62" style={{ display: 'block' }}>
    <path fill={color} d="M48 24C34 6 14 2 2 10c8 6 14 8 22 8C14 20 4 28 2 40c12-2 22-8 28-14-2 8-2 16 2 24 6-8 10-16 12-22 2 6 6 14 12 22 4-8 4-16 2-24 6 6 16 12 28 14-2-12-12-20-22-22 8 0 14-2 22-8C86 2 66 6 52 24h-4z"/>
    <path fill={color} d="M46 20l-2-8 6 6-4 2zM54 20l2-8-6 6 4 2z"/>
  </svg>
);

const IconPumpkin = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <rect x="46" y="2" width="8" height="16" rx="3" fill="#3A6B2A"/>
    <path d="M50 20c-26 0-40 17-40 40s14 38 40 38 40-16 40-38-14-40-40-40z" fill="#FF8C1A"/>
    <path d="M30 26c-5 11-5 52 0 68M70 26c5 11 5 52 0 68M50 22v76" stroke="#D96A0A" strokeWidth="3" fill="none" opacity=".45"/>
    <polygon points="33,50 43,50 38,62" fill="#2A1505"/>
    <polygon points="57,50 67,50 62,62" fill="#2A1505"/>
    <path d="M30 70 Q50 86 70 70 Q58 80 50 78 Q42 80 30 70Z" fill="#2A1505"/>
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

const IconFloco = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <g stroke={color} strokeWidth="7" strokeLinecap="round">
      <line x1="50" y1="6" x2="50" y2="94"/>
      <line x1="6" y1="50" x2="94" y2="50"/>
      <line x1="20" y1="20" x2="80" y2="80"/>
      <line x1="80" y1="20" x2="20" y2="80"/>
      <line x1="50" y1="6" x2="36" y2="22"/><line x1="50" y1="6" x2="64" y2="22"/>
      <line x1="50" y1="94" x2="36" y2="78"/><line x1="50" y1="94" x2="64" y2="78"/>
    </g>
  </svg>
);

const IconEstrela = ({ size = 18, color = '#C8F3FF' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }}>
    <polygon points="12,1 15,9 23,9 16.5,14 19,22 12,17.5 5,22 7.5,14 1,9 9,9"/>
  </svg>
);

// Árvore gelada — azul-petróleo em vez de verde, topo e enfeites em tons de
// gelo/ciano (vibe Snezhnaya, pedido explícito do dono, 17/10/2026).
const IconArvore = ({ size = 56 }) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 100 115" style={{ display: 'block' }}>
    <rect x="44" y="96" width="12" height="16" fill="#2A3A4A"/>
    <polygon points="50,0 20,42 32,42 8,78 28,78 2,110 98,110 72,78 92,78 68,42 80,42" fill="#1E5878"/>
    <polygon points="50,0 44,16 56,16" fill="#C8F3FF"/>
    <circle cx="26" cy="68" r="4" fill="#4FC9E8"/>
    <circle cx="70" cy="60" r="4" fill="#C8F3FF"/>
    <circle cx="40" cy="90" r="4" fill="#7FE0FA"/>
    <circle cx="62" cy="96" r="4" fill="#4FC9E8"/>
  </svg>
);

// Trenó + saco de presentes + Papai Noel do gelo — silhueta simples, paleta
// azul/prata em vez do vermelho+verde tradicional.
const IconTrenoNoel = ({ w = 110, h = 56 }) => (
  <svg width={w} height={h} viewBox="0 0 140 70" style={{ display: 'block' }}>
    <path d="M14 56Q4 56 4 46L4 30Q4 20 20 20L88 20Q98 20 98 30L98 50Q112 44 124 54Q108 64 92 57L20 57Q10 60 14 56Z" fill="#2E6B8A"/>
    <path d="M4 46Q-6 56-16 50" stroke="#2E6B8A" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <circle cx="36" cy="30" r="12" fill="#4FC9E8"/>
    <circle cx="56" cy="25" r="10" fill="#C8F3FF"/>
    <circle cx="80" cy="16" r="11" fill="#6FA8E0"/>
    <circle cx="80" cy="7" r="6" fill="#EAF6FF"/>
    <polygon points="74,1 86,1 80,-8" fill="#6FA8E0"/>
    <circle cx="80" cy="-8" r="2.4" fill="#fff"/>
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
@keyframes sazTrenoSaz {
  0%   { transform: translate(-20vw, 0); opacity: 0; }
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
    { top: '10%', dur: '16s', delay: '0s', size: 26 },
    { top: '28%', dur: '21s', delay: '-6s', size: 20 },
    { top: '46%', dur: '18s', delay: '-11s', size: 24 },
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
          <IconBat size={m.size}/>
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: 18, left: '6%', animation: 'sazBobPumpkin 4.5s ease-in-out infinite' }}><IconPumpkin size={40}/></div>
      <div style={{ position: 'absolute', bottom: 14, right: '8%', animation: 'sazBobPumpkin 5.5s ease-in-out -2s infinite' }}><IconPumpkin size={30}/></div>
      <div style={{ position: 'absolute', bottom: 74, right: '4%', animation: 'sazSkel 3.4s ease-in-out infinite' }}><IconSkull size={26}/></div>
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
        size: 16 + Math.random() * 14,
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
          <IconBat size={b.size}/>
        </div>
      ))}
    </div>
  );
};

/* ───────────────────────── Efeito ambiente — Natal ───────────────────────── */

const EfeitoNatal = () => {
  const flocos = Array.from({ length: 16 }, (_, i) => ({
    left: `${(i * 6.3) % 100}%`, dur: `${9 + (i % 5) * 2}s`, delay: `-${(i * 1.7) % 14}s`,
    size: 12 + (i % 3) * 6, drift: `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 3) * 10)}px`,
  }));
  return (
    <div style={wrapStyle} aria-hidden="true">
      <style>{NATAL_CSS}</style>
      {flocos.map((f, i) => (
        <div key={'fl' + i} style={{ position: 'absolute', top: 0, left: f.left,
          '--drift': f.drift, animation: `sazNeve ${f.dur} linear ${f.delay} infinite` }}>
          <IconFloco size={f.size}/>
        </div>
      ))}
      <div style={{ position: 'absolute', top: '14%', left: 0, animation: 'sazTrenoSaz 22s linear -5s infinite' }}>
        <IconTrenoNoel/>
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: '5%', transformOrigin: 'bottom center', animation: 'sazSway 5s ease-in-out infinite' }}>
        <IconArvore size={54}/>
      </div>
      <div style={{ position: 'absolute', bottom: 72, left: '8.5%', animation: 'sazTwinkle 1.8s ease-in-out infinite' }}>
        <IconEstrela size={18}/>
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
