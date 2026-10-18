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

// Abóbora — imagem enviada pelo dono (public/abobora-halloween.png),
// substituindo o desenho próprio anterior (achou mais bonita).
const IconPumpkin = ({ size = 72 }) => (
  <img src="/abobora-halloween.png" alt="" style={{
    width: size, height: 'auto', display: 'block',
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.4))',
  }}/>
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

// Pinheiro nevado — imagem enviada pelo dono (public/pinheiro-natal.png),
// substituindo o desenho SVG anterior. `brilho` varia um pouco de árvore
// pra árvore só pra não ficar tudo clonado igual (sensação de profundidade).
const PINHEIRO_RATIO = 593 / 759;
const IconPinheiro = ({ h = 70, brilho = 1 }) => (
  <img src="/pinheiro-natal.png" alt="" style={{
    width: +(h * PINHEIRO_RATIO).toFixed(1), height: h, display: 'block',
    filter: `brightness(${brilho}) drop-shadow(0 3px 6px rgba(0,0,0,.35))`,
  }}/>
);

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
@keyframes sazCintilar {
  0%,100% { opacity: .25; transform: scale(.7); }
  50%     { opacity: 1;   transform: scale(1.15); }
}
`;

const wrapStyle = { position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none', overflow: 'hidden' };
// Cenário de fundo (castelo, montanha, floresta) fica ATRÁS do conteúdo —
// zIndex 0, igual ao LavaLamp — não na frente dos botões/telas dos módulos
// (zIndex 1 em App.jsx). Só os efeitos que sobrevoam a tela de leve (neve,
// morcego, raio...) ficam no zIndex 5, acima de tudo. Pedido explícito do
// dono, 17/10/2026: o campo/árvores do Natal tampava botão dentro de módulo.
const wrapStyleFundo = { ...wrapStyle, zIndex: 0 };

/* ───────────────────────── Efeito ambiente — Halloween ───────────────────────── */

const RaiosVermelhos = () => {
  const bolts = useRef(null);
  if (!bolts.current) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    // Mais raios (12) e delay espalhado pelo ciclo inteiro — cada um tem o
    // próprio ciclo de 7-10s, então os flashes ficam espalhados no tempo em
    // vez de todos piscarem juntos de 9 em 9s.
    bolts.current = Array.from({ length: 12 }).map((_, i) => ({
      id: i, left: `${rnd(3, 94)}%`, top: rnd(2, 30), h: rnd(50, 165),
      dur: rnd(7, 10), delay: rnd(0, 10),
    }));
  }
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: 0,
        background: 'radial-gradient(ellipse at 55% 0%, #ff2d4055 0%, transparent 55%)',
        animation: 'sazLightningFlash 6s linear infinite' }}/>
      {bolts.current.map(b => (
        <div key={b.id} style={{ position: 'absolute', left: b.left, top: b.top, opacity: 0,
          animation: `sazLightning ${b.dur}s linear ${b.delay}s infinite` }}>
          <IconRaio w={Math.round(b.h * 0.3)} h={b.h}/>
        </div>
      ))}
    </>
  );
};

// Campo (colina + cemitério) pro castelo "pousar" em cima — mesma ideia da
// cordilheira do Natal, só que com lápides em vez de pinheiro. Tons quase
// pretos/roxo escuro, combinando com o castelo. Pedido explícito do dono.
const IconLapide = ({ h = 40, tone = '#140A1C' }) => {
  const w = +(h * 0.72).toFixed(1);
  return (
    <svg width={w} height={h} viewBox="0 0 36 50" style={{ display: 'block' }}>
      <path d="M2 50V18C2 8 10 2 18 2s16 6 16 16v32z" fill={tone}/>
      <line x1="13" y1="17" x2="23" y2="27" stroke="#2E1A38" strokeWidth="2.2"/>
      <line x1="23" y1="17" x2="13" y2="27" stroke="#2E1A38" strokeWidth="2.2"/>
    </svg>
  );
};

const CampoHalloween = () => (
  <>
    <svg width="100%" height="110" viewBox="0 0 1000 110" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, display: 'block' }}>
      <polygon points="0,110 0,68 90,30 180,64 280,18 370,56 460,22 560,60 650,26 740,58 840,20 930,54 1000,34 1000,110" fill="#120616" opacity=".9"/>
      <polygon points="0,110 0,90 110,62 230,86 340,48 450,82 570,52 680,84 790,50 900,82 1000,66 1000,110" fill="#1C0A22"/>
    </svg>
    {[
      { left: '9%', h: 36 }, { left: '18%', h: 46 }, { left: '72%', h: 40 },
      { left: '83%', h: 50 }, { left: '92%', h: 34 }, { left: '3%', h: 44 },
    ].map((l, i) => (
      <div key={i} style={{ position: 'absolute', bottom: 0, left: l.left }}><IconLapide h={l.h}/></div>
    ))}
  </>
);

// Castelo gótico (imagem enviada pelo dono, public/castelo-halloween.png) —
// recolorido na hora pra cor do TEMA ATIVO da pessoa, não fixo em vermelho
// como veio na imagem original. Técnica: a imagem vira uma MÁSCARA (usa só
// o canal alfa como silhueta) sobre uma cor sólida — recolor exato, não uma
// aproximação de filtro (hue-rotate erra a cor quando o tema não é vermelho).
const CASTELO_RATIO = 1536 / 1024;
const CasteloTema = () => (
  <div style={{
    position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: 'min(680px, 82vw)', aspectRatio: `${CASTELO_RATIO}`,
    backgroundColor: T.gold,
    WebkitMaskImage: 'url(/castelo-halloween.png)', maskImage: 'url(/castelo-halloween.png)',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskPosition: 'bottom center', maskPosition: 'bottom center',
    opacity: .9, filter: `drop-shadow(0 0 26px ${T.goldLine}77)`,
  }}/>
);

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
    <>
      {/* Fundo — atrás do conteúdo, nunca tampa botão (castelo, abóboras e
          caveira são peças grandes/paradas no rodapé, mesmo problema que o
          campo do Natal tinha). */}
      <div style={wrapStyleFundo} aria-hidden="true">
        <style>{HALLOWEEN_CSS}</style>
        <CampoHalloween/>
        <CasteloTema/>
        <div style={{ position: 'absolute', bottom: 10, left: '5%', animation: 'sazBobPumpkin 4.5s ease-in-out infinite' }}><IconPumpkin size={92}/></div>
        <div style={{ position: 'absolute', bottom: 6, right: '7%', animation: 'sazBobPumpkin 5.5s ease-in-out -2s infinite' }}><IconPumpkin size={62}/></div>
        <div style={{ position: 'absolute', bottom: 92, right: '4%', animation: 'sazSkel 3.4s ease-in-out infinite' }}><IconSkull size={28}/></div>
      </div>
      {/* Efeitos que sobrevoam a tela — só o que realmente se move por cima (raio, nuvem, morcego) */}
      <div style={wrapStyle} aria-hidden="true">
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
      </div>
    </>
  );
};

// Explosão de morcegos ao entrar num módulo — mesmo espírito do Uniko
// Vampire Robot (shared/vampireScene.jsx), só que num burst único em vez de
// morcegos ambientes: ~1.6s, depois some sozinho.
const BURST_TOTAL = 28;
const BurstMorcegos = () => {
  const [sumiu, setSumiu] = useState(false);
  const bats = useRef(null);
  if (!bats.current) {
    // Dois anéis (mais perto/mais longe) em vez de um só — fica mais denso
    // sem precisar de mais raio de explosão.
    bats.current = Array.from({ length: BURST_TOTAL }).map((_, i) => {
      const anel = i % 2;
      const ang = (i / BURST_TOTAL) * Math.PI * 2 + Math.random() * 0.3;
      const dist = (anel === 0 ? 20 : 42) + Math.random() * 20;
      return {
        bx: `${Math.cos(ang) * dist}vmin`, by: `${Math.sin(ang) * dist}vmin`,
        br: `${Math.round(Math.random() * 360 - 180)}deg`,
        dur: `${1.0 + Math.random() * 0.6}s`, delay: `${Math.random() * 0.22}s`,
        size: 14 + Math.random() * 16, flip: Math.random() < 0.5,
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

// Trenó de Natal (imagem — Papai Noel, o mascote Uniko e as renas) cruzando
// a tela em linha reta, de tempos em tempos, com um rastro de brilho +
// estrelas cintilantes atrás dele. Pedido explícito do dono, 17/10/2026.
const TRILHA_TRENO = Array.from({ length: 10 }, (_, i) => ({
  offset: 36 + i * 26, size: Math.max(6, 14 - i), dur: 0.55 + (i % 3) * 0.22,
  delay: (i * 0.13) % 1, op: Math.max(0.18, 0.9 - i * 0.08),
}));

// Cada passagem tem o PRÓPRIO keyframe (nome único) — assim `topFrom`/`topTo`/
// `rot` dão um ângulo de voo diferente por instância (reto, mergulhando,
// subindo...), em vez de sempre a mesma trajetória horizontal. Pedido
// explícito do dono, 17/10/2026.
let _trenoSeq = 0;
const TrenoComTrilha = ({ topFrom = 16, topTo = 16, rot = 0, largura = 260, dur = 30, delay = -8 }) => {
  const nomeRef = useRef(null);
  if (!nomeRef.current) nomeRef.current = `sazTrenoVoo${++_trenoSeq}`;
  const nome = nomeRef.current;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: largura,
      animation: `${nome} ${dur}s linear ${delay}s infinite` }}>
      <style>{`
        @keyframes ${nome} {
          0%   { transform: translate(-32vw, ${topFrom}vh) rotate(${rot}deg); opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { transform: translate(132vw, ${topTo}vh) rotate(${rot}deg); opacity: 0; }
        }
      `}</style>
      {/* brilho — gradiente estático (sem blur animado), só o grupo todo que translada */}
      <div style={{ position: 'absolute', top: '40%', right: largura * 0.32, width: largura * 0.9, height: largura * 0.14,
        background: 'linear-gradient(to left, rgba(200,243,255,0.4), transparent)', borderRadius: 999 }}/>
      {TRILHA_TRENO.map((t, i) => (
        <div key={i} style={{ position: 'absolute', top: '36%', right: t.offset, opacity: t.op,
          animation: `sazCintilar ${t.dur}s ease-in-out ${t.delay}s infinite` }}>
          <IconEstrela size={t.size} color="#C8F3FF"/>
        </div>
      ))}
      <img src="/trenozonatal.png" alt="" style={{ width: largura, height: 'auto', display: 'block',
        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.35)) drop-shadow(0 0 16px rgba(200,243,255,.45))' }}/>
    </div>
  );
};

const PINHEIROS = Array.from({ length: 11 }, (_, i) => ({
  left: `${2 + i * 9}%`,
  h: [58, 78, 46, 90, 64, 100, 54, 82, 70, 48, 86][i],
  brilho: [1, .88, 1.08, .92, 1, .85, 1.05, .9, 1, 1.1, .95][i],
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
    <>
      {/* Fundo — cordilheira + floresta, atrás do conteúdo (eram essas que
          tampavam botão dentro de módulo — pedido explícito do dono). */}
      <div style={wrapStyleFundo} aria-hidden="true">
        <style>{NATAL_CSS}</style>
        <div style={{ position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% -10%, rgba(79,201,232,0.14) 0%, transparent 55%)' }}/>
        <MontanhaNeve/>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 }}>
          {PINHEIROS.map((p, i) => (
            <div key={i} style={{ position: 'absolute', bottom: 0, left: p.left }}>
              <IconPinheiro h={p.h} brilho={p.brilho}/>
            </div>
          ))}
        </div>
      </div>
      {/* Efeitos que sobrevoam a tela — neve, estrelas, trenó */}
      <div style={wrapStyle} aria-hidden="true">
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
        {/* 3 passagens com ângulo/altura/velocidade diferentes, em momentos
            diferentes (delay escalonado) — nunca sempre a mesma trajetória. */}
        <TrenoComTrilha topFrom={14} topTo={16} rot={1} dur={28} delay={-4}/>
        <TrenoComTrilha topFrom={4} topTo={38} rot={11} dur={24} delay={-19}/>
        <TrenoComTrilha topFrom={42} topTo={8} rot={-11} dur={33} delay={-9}/>
      </div>
    </>
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
