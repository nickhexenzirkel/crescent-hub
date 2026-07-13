// src/shared/sakuraScene.jsx
// Cenário de floresta de sakura animado (canvas) — árvores de cerejeira em flor, pétalas
// de sakura caindo levemente e se acumulando no chão, grama rosa balançando, cachoeira
// caindo num rio, névoas passando e um portão torii vermelho ao fundo. Feito pro Uniko
// "Kitsune" (a raposa). Mesmo espírito do cosmosScene.jsx: UM único componente canvas
// que serve pro card (fixed=false, preenche o pai) e pra tela cheia da página (fixed=true,
// o canvas se redimensiona sozinho via ResizeObserver). Suave/calmo, funciona em qualquer tema.
import React, { useEffect, useRef } from 'react';

const rng = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const PETAL_COLORS = ['#ffe0ee', '#ffcfe4', '#ffbcda', '#ffa9cf', '#ff9ec7'];

// ── Elementos estáticos (posições normalizadas 0..1 → adaptam a qualquer tamanho) ──

// Névoas: faixas horizontais translúcidas passando devagar em alturas diferentes.
const MIST_BANDS = Array.from({ length: 5 }, (_, i) => ({
  y: rng(0.30, 0.74), h: rng(0.05, 0.12), speed: rng(0.006, 0.016) * (i % 2 ? -1 : 1),
  alpha: rng(0.10, 0.24), phase: rng(0, Math.PI * 2), off: rng(0, 1),
}));

// Copas de sakura distantes (floresta ao fundo) — aglomerados de "bolhas" rosa desfocadas.
const BACK_CANOPIES = Array.from({ length: 22 }, () => ({
  x: Math.random(), y: rng(0.34, 0.56), r: rng(0.04, 0.10),
  alpha: rng(0.28, 0.55), hue: pick(['#f9c6de', '#f7b6d2', '#fbd4e6', '#f4a9cc']),
}));

// Árvores de sakura em primeiro plano — nas laterais, com copas grandes que balançam.
const TREES = [
  { x: 0.09, base: 0.86, scale: 1.05, phase: 0.0, lean: -0.04 },
  { x: 0.90, base: 0.88, scale: 1.18, phase: 1.4, lean: 0.05 },
  { x: 0.30, base: 0.83, scale: 0.62, phase: 2.6, lean: -0.02 },
  { x: 0.70, base: 0.84, scale: 0.7, phase: 3.7, lean: 0.03 },
];

// Grama rosa — lâminas na base, cada uma com fase própria de balanço.
const GRASS = Array.from({ length: 150 }, () => ({
  x: Math.random(), h: rng(0.02, 0.055), phase: rng(0, Math.PI * 2),
  lean: rng(-0.5, 0.5), color: pick(['#f7a8cf', '#ef8fbf', '#f9b8d6', '#e87fb4']),
}));

// Pétalas caídas descansando no chão (dão a sensação de acúmulo) — jiggle bem de leve.
const REST_PETALS = Array.from({ length: 46 }, () => ({
  x: Math.random(), y: rng(0.84, 0.99), r: rng(0.006, 0.012),
  rot: rng(0, Math.PI * 2), phase: rng(0, Math.PI * 2), color: pick(PETAL_COLORS),
}));

// Pétalas caindo — muitas, com deriva horizontal (sopro do vento) + rotação.
function makePetals(n) {
  return Array.from({ length: n }, () => ({
    x: Math.random(), y: Math.random(), depth: rng(0.4, 1),  // depth: tamanho/velocidade
    sway: rng(0.02, 0.06), freq: rng(0.6, 1.6), phase: rng(0, Math.PI * 2),
    rot: rng(0, Math.PI * 2), rotSpeed: rng(-0.03, 0.03),
    fall: rng(0.0011, 0.0028), color: pick(PETAL_COLORS), flip: Math.random() < 0.5,
  }));
}

// Fios de água da cachoeira — linhas verticais que "correm" para baixo em loop.
const WATER_STREAKS = Array.from({ length: 26 }, () => ({
  xoff: Math.random(), speed: rng(0.9, 1.8), len: rng(0.06, 0.16),
  alpha: rng(0.25, 0.6), w: rng(0.6, 1.8), off: Math.random(),
}));

// Desenha uma pétala de sakura (com o entalhe característico na ponta) centrada na origem.
function petalPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.95, -r * 0.55, r * 0.72, r * 0.7, r * 0.12, r);
  ctx.quadraticCurveTo(0, r * 0.78, -r * 0.12, r);           // entalhe da ponta
  ctx.bezierCurveTo(-r * 0.72, r * 0.7, -r * 0.95, -r * 0.55, 0, -r);
  ctx.closePath();
}

// `fixed`: position:fixed;inset:0 (fundo de tela cheia) vs position:absolute;inset:0
// (preenche o card/elemento pai). O MESMO componente serve pros dois — só troca o wrapper.
export default function SakuraScene({ fixed = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let rafId, t = 0;

    const dpr = () => devicePixelRatio || 1;
    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;
    const resize = () => { canvas.width = W() * dpr(); canvas.height = H() * dpr(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const PETALS = makePetals(fixed ? 95 : 46);

    // ── Céu ──────────────────────────────────────────────────────────────────
    const drawSky = (w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ffc9e0');
      g.addColorStop(0.42, '#ffdcec');
      g.addColorStop(0.72, '#ffe9f2');
      g.addColorStop(1, '#fdeef4');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // brilho quente de sol no alto
      const sun = ctx.createRadialGradient(w * 0.74, h * 0.14, 0, w * 0.74, h * 0.14, Math.min(w, h) * 0.6);
      sun.addColorStop(0, 'rgba(255,246,224,0.55)');
      sun.addColorStop(0.4, 'rgba(255,232,240,0.18)');
      sun.addColorStop(1, 'rgba(255,232,240,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    };

    // ── Névoas ──────────────────────────────────────────────────────────────
    const drawMist = (w, h, front) => {
      MIST_BANDS.forEach((m, i) => {
        if ((i % 2 === 0) !== front) return; // metade atrás, metade na frente
        const y = m.y * h + Math.sin(t * 0.4 + m.phase) * h * 0.01;
        const bh = m.h * h;
        const shift = ((m.off + t * m.speed) % 1.4 - 0.2) * w;
        const g = ctx.createLinearGradient(0, y, 0, y + bh);
        g.addColorStop(0, `rgba(255,255,255,0)`);
        g.addColorStop(0.5, `rgba(255,250,253,${m.alpha})`);
        g.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(w * 0.5 + shift, y + bh / 2, w * 0.75, bh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // ── Copas distantes ───────────────────────────────────────────────────────
    const drawBackForest = (w, h) => {
      const sc = Math.min(w, h);
      BACK_CANOPIES.forEach(c => {
        const x = c.x * w, y = c.y * h, r = c.r * sc;
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = c.hue;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x - r * 0.5, y + r * 0.2, r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.15, r * 0.65, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    // ── Cachoeira caindo de um rochedo natural pro rio ──────────────────────────
    const drawWaterfall = (w, h) => {
      const cx = w * 0.40;          // centro da queda (num vão entre as árvores)
      const topY = h * 0.26, botY = h * 0.73;
      const wf = Math.min(w, h) * 0.05;  // meia-largura da queda
      const rw = wf * 2.5;               // meia-largura do rochedo

      // Rochedo irregular (duas faces flanqueando a fenda por onde a água desce)
      const rock = (x0, x1, shade) => {
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(x0, botY);
        ctx.lineTo(x0, topY + h * 0.03);
        ctx.lineTo(x0 + (x1 - x0) * 0.28, topY - h * 0.02);
        ctx.lineTo(x0 + (x1 - x0) * 0.6, topY + h * 0.02);
        ctx.lineTo(x1, topY + h * 0.005);
        ctx.lineTo(x1, botY);
        ctx.closePath(); ctx.fill();
      };
      rock(cx - rw, cx - wf * 0.7, '#6c584f');       // face esquerda (sombra)
      rock(cx + wf * 0.7, cx + rw, '#816a5f');       // face direita (clara)
      // Musgo/grama rosa na crista do rochedo
      ctx.fillStyle = '#ef8fbf';
      ctx.fillRect(cx - rw, topY + h * 0.005, (cx - wf * 0.7) - (cx - rw), h * 0.016);
      ctx.fillRect(cx + wf * 0.7, topY, rw - wf * 0.7, h * 0.014);
      // Fendas escuras nas rochas
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = Math.max(1, wf * 0.18);
      [[-0.75, 0.35], [-0.45, 0.6], [0.55, 0.4], [0.8, 0.55]].forEach(([fx, fl]) => {
        const x = cx + fx * rw;
        ctx.beginPath(); ctx.moveTo(x, topY + h * 0.05);
        ctx.lineTo(x + wf * 0.2, topY + h * 0.05 + (botY - topY) * fl); ctx.stroke();
      });

      // Corpo d'água da queda
      const g = ctx.createLinearGradient(cx - wf, 0, cx + wf, 0);
      g.addColorStop(0, 'rgba(196,232,244,0.55)');
      g.addColorStop(0.5, 'rgba(244,253,255,0.92)');
      g.addColorStop(1, 'rgba(196,232,244,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - wf, topY, wf * 2, botY - topY);

      // Fios de água correndo pra baixo
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - wf, topY, wf * 2, botY - topY); ctx.clip();
      const span = botY - topY;
      WATER_STREAKS.forEach(s => {
        const x = cx - wf + s.xoff * wf * 2;
        const yy = topY + (((s.off + t * s.speed) % 1) * (span + span * s.len)) - span * s.len;
        const len = s.len * span;
        ctx.strokeStyle = `rgba(255,255,255,${s.alpha})`;
        ctx.lineWidth = s.w;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, yy + len); ctx.stroke();
      });
      ctx.restore();

      // Espuma/spray na base (onde bate no rio)
      for (let i = 0; i < 7; i++) {
        const p = Math.sin(t * 2 + i) * 0.5 + 0.5;
        const fx = cx + (i - 3) * wf * 0.5;
        const fy = botY - h * 0.005 + Math.sin(t * 3 + i) * h * 0.006;
        ctx.fillStyle = `rgba(255,255,255,${0.30 + p * 0.4})`;
        ctx.beginPath(); ctx.arc(fx, fy, wf * (0.4 + p * 0.3), 0, Math.PI * 2); ctx.fill();
      }
    };

    // ── Rio ────────────────────────────────────────────────────────────────────
    const drawRiver = (w, h) => {
      const top = h * 0.72, bot = h * 0.86;
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, '#cdeaf2');
      g.addColorStop(0.5, '#a9d8e6');
      g.addColorStop(1, '#bfe3ec');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, w, bot - top);
      // reflexos/brilho correndo na superfície
      for (let i = 0; i < 9; i++) {
        const yy = top + (i + 0.5) * ((bot - top) / 9);
        const shimmer = Math.sin(t * 1.4 + i * 1.3) * w * 0.04;
        ctx.strokeStyle = `rgba(255,255,255,${0.10 + (i % 2) * 0.08})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(w * 0.05 + shimmer, yy);
        ctx.lineTo(w * 0.95 + shimmer, yy);
        ctx.stroke();
      }
    };

    // ── Torii ──────────────────────────────────────────────────────────────────
    const drawTorii = (cx, baseY, height, alpha) => {
      const pillarW = height * 0.085;
      const span = height * 0.34;          // meia-distância entre pilares
      const topY = baseY - height;
      const nukiY = baseY - height * 0.72;
      const vermil = `rgba(214,58,48,${alpha})`;
      const dark = `rgba(150,34,28,${alpha})`;

      ctx.save();
      // Pilares (leve afinamento pra cima)
      ctx.fillStyle = vermil;
      [-1, 1].forEach(side => {
        const x = cx + side * span;
        ctx.beginPath();
        ctx.moveTo(x - pillarW, baseY);
        ctx.lineTo(x - pillarW * 0.8, topY + height * 0.14);
        ctx.lineTo(x + pillarW * 0.8, topY + height * 0.14);
        ctx.lineTo(x + pillarW, baseY);
        ctx.closePath(); ctx.fill();
      });
      // Nuki (viga inferior, atravessa os pilares)
      ctx.fillStyle = dark;
      ctx.fillRect(cx - span - pillarW * 1.6, nukiY, (span + pillarW * 1.6) * 2, height * 0.075);
      // Shimaki (viga sob o kasagi)
      ctx.fillStyle = vermil;
      ctx.fillRect(cx - span - height * 0.16, topY + height * 0.13, (span + height * 0.16) * 2, height * 0.06);
      // Kasagi (viga superior curva, pontas erguidas)
      ctx.fillStyle = dark;
      const kw = span + height * 0.22, kh = height * 0.075;
      ctx.beginPath();
      ctx.moveTo(cx - kw, topY + height * 0.10);
      ctx.quadraticCurveTo(cx, topY - height * 0.02, cx + kw, topY + height * 0.10);
      ctx.lineTo(cx + kw, topY + height * 0.10 + kh);
      ctx.quadraticCurveTo(cx, topY + kh - height * 0.005, cx - kw, topY + height * 0.10 + kh);
      ctx.closePath(); ctx.fill();
      // Gakuzuka (plaquinha central)
      ctx.fillStyle = vermil;
      ctx.fillRect(cx - pillarW * 0.55, topY + height * 0.19, pillarW * 1.1, height * 0.11);
      ctx.restore();
    };

    // ── Árvore de sakura em primeiro plano ──────────────────────────────────────
    const drawTree = (tr, w, h) => {
      const sc = Math.min(w, h);
      const x = tr.x * w, base = tr.base * h;
      const trunkH = sc * 0.30 * tr.scale;
      const trunkW = sc * 0.028 * tr.scale;
      const sway = Math.sin(t * 0.5 + tr.phase) * 0.03 + tr.lean;

      ctx.save();
      ctx.translate(x, base);
      ctx.rotate(sway * 0.15);
      // Tronco
      ctx.fillStyle = '#6b4a3d';
      ctx.beginPath();
      ctx.moveTo(-trunkW, 0);
      ctx.lineTo(-trunkW * 0.45, -trunkH);
      ctx.lineTo(trunkW * 0.45, -trunkH);
      ctx.lineTo(trunkW, 0);
      ctx.closePath(); ctx.fill();
      // Galhos
      ctx.strokeStyle = '#6b4a3d';
      ctx.lineWidth = trunkW * 0.55; ctx.lineCap = 'round';
      const bY = -trunkH * 0.78;
      [[-1, -0.5], [1, -0.6], [-0.6, -0.85], [0.7, -0.9]].forEach(([dir, up]) => {
        ctx.beginPath(); ctx.moveTo(0, bY);
        ctx.quadraticCurveTo(dir * trunkH * 0.2, bY + up * trunkH * 0.15, dir * trunkH * 0.42, bY + up * trunkH * 0.28);
        ctx.stroke();
      });
      // Copa de flores (aglomerado de bolhas rosa) balançando junto
      const canopyY = -trunkH * 1.02;
      const cr = sc * 0.16 * tr.scale;
      const blobs = [
        [0, 0, 1], [-0.7, 0.15, 0.72], [0.7, 0.12, 0.75], [-0.35, -0.5, 0.7],
        [0.4, -0.55, 0.7], [0, -0.75, 0.62], [-0.9, -0.2, 0.5], [0.95, -0.25, 0.52],
      ];
      // sombra da copa
      blobs.forEach(([bx, by, bs]) => {
        ctx.fillStyle = '#e97fb0';
        ctx.beginPath(); ctx.arc(bx * cr + cr * 0.12, canopyY + by * cr + cr * 0.12, cr * bs, 0, Math.PI * 2); ctx.fill();
      });
      // corpo da copa
      blobs.forEach(([bx, by, bs]) => {
        ctx.fillStyle = '#ff9ec7';
        ctx.beginPath(); ctx.arc(bx * cr, canopyY + by * cr, cr * bs, 0, Math.PI * 2); ctx.fill();
      });
      // brilhos claros
      blobs.forEach(([bx, by, bs]) => {
        ctx.fillStyle = '#ffd0e6';
        ctx.beginPath(); ctx.arc(bx * cr - cr * 0.28, canopyY + by * cr - cr * 0.28, cr * bs * 0.55, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    };

    // ── Grama rosa ──────────────────────────────────────────────────────────────
    const drawGrass = (w, h) => {
      const sc = Math.min(w, h);
      const ground = h * 0.965;
      GRASS.forEach(bl => {
        const x = bl.x * w;
        const bh = bl.h * sc * 1.3;
        const tipX = x + (Math.sin(t * 1.1 + bl.phase) * 0.35 + bl.lean) * bh;
        ctx.strokeStyle = bl.color;
        ctx.lineWidth = Math.max(1, sc * 0.006);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, ground);
        ctx.quadraticCurveTo((x + tipX) / 2, ground - bh * 0.6, tipX, ground - bh);
        ctx.stroke();
      });
    };

    // ── Pétalas descansando no chão ─────────────────────────────────────────────
    const drawRestPetals = (w, h) => {
      const sc = Math.min(w, h);
      REST_PETALS.forEach(p => {
        const x = p.x * w, y = p.y * h;
        const jig = Math.sin(t * 1.5 + p.phase) * 0.15;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + jig);
        ctx.scale(1, 0.5); // achatada (deitada no chão)
        ctx.fillStyle = p.color;
        petalPath(ctx, p.r * sc);
        ctx.fill();
        ctx.restore();
      });
    };

    // ── Pétalas caindo ──────────────────────────────────────────────────────────
    const drawPetals = (w, h) => {
      const sc = Math.min(w, h);
      PETALS.forEach(p => {
        p.y += p.fall * p.depth;
        p.rot += p.rotSpeed;
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
        const drift = Math.sin(t * p.freq + p.phase) * p.sway;
        const x = ((p.x + drift) % 1.1) * w;
        const y = p.y * h;
        const r = (3 + p.depth * 6) * (sc / 320);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.scale(p.flip ? -1 : 1, Math.sin(p.rot * 1.3) * 0.4 + 0.75); // "gira" no ar
        ctx.globalAlpha = 0.5 + p.depth * 0.5;
        ctx.fillStyle = p.color;
        petalPath(ctx, r);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    };

    // ── Loop principal ──────────────────────────────────────────────────────────
    const frame = () => {
      t += 0.016;
      const w = W(), h = H(), d = dpr();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawSky(w, h);
      drawMist(w, h, false);       // névoa de trás
      drawBackForest(w, h);
      drawTorii(w * 0.5, h * 0.72, Math.min(w, h) * 0.26, 0.32); // torii distante (silhueta clara)
      drawWaterfall(w, h);
      drawRiver(w, h);
      drawTorii(w * 0.62, h * 0.78, Math.min(w, h) * 0.34, 0.95); // torii principal
      TREES.forEach(tr => drawTree(tr, w, h));
      drawGrass(w, h);
      drawRestPetals(w, h);
      drawMist(w, h, true);        // véu de névoa na frente (bem sutil)
      drawPetals(w, h);

      // vinheta rosada suave
      const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(255,220,236,0)');
      vg.addColorStop(1, 'rgba(214,120,170,0.16)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

      rafId = requestAnimationFrame(frame);
    };

    frame();
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [fixed]);

  return (
    <div style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: fixed ? 1 : 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
