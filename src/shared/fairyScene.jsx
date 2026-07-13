// src/shared/fairyScene.jsx
// Cenário de jardim encantado animado (canvas) — pro Uniko "Rainha das Fadas".
// Sol brilhando, árvores grandes, rio serpenteando, um jardim de flores coloridas
// (várias pequenas + algumas GRANDES), grama, fadinhas coloridas voando com rastro
// e brilhos/partículas cintilando por toda a cena. Mesmo molde do cosmosScene/
// sakuraScene: UM componente canvas com prop `fixed` — serve o card (fixed=false,
// preenche o pai) e o fundo de página inteira (fixed=true, redimensiona sozinho).
import React, { useEffect, useRef } from 'react';

const PI2 = Math.PI * 2;
const rng = (a, b) => Math.random() * (b - a) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const FLOWER_COLORS = ['#ff6b9d', '#ffd166', '#a06bff', '#ff8c42', '#ff5d5d', '#6bd3ff', '#ff9ecd', '#c56bff'];
const FAIRY_COLORS = ['#ff8fd6', '#8fe3ff', '#ffe08f', '#c79bff', '#9bffc4', '#ffb3e6'];

// ── Elementos estáticos (coords normalizadas 0..1 → adaptam a qualquer tamanho) ──

// Árvores grandes: nas laterais (faixa visível na tela cheia; o centro fica atrás dos painéis).
const TREES = [
  { x: 0.06, base: 0.84, scale: 1.15, phase: 0.0 },
  { x: 0.94, base: 0.85, scale: 1.25, phase: 1.6 },
  { x: 0.30, base: 0.80, scale: 0.6, phase: 2.7 },
  { x: 0.72, base: 0.81, scale: 0.66, phase: 3.9 },
];

// Colinas ao fundo (jardim).
const HILLS = [
  { y: 0.62, amp: 0.03, color: '#a6e08a', speed: 0.6 },
  { y: 0.68, amp: 0.025, color: '#8fd47a', speed: 0.9 },
];

// Flores do campo (jardim) — muitas pequenas/médias espalhadas na base.
const FLOWERS = Array.from({ length: 46 }, () => ({
  x: Math.random(), y: rng(0.82, 0.98), size: rng(0.012, 0.03),
  color: pick(FLOWER_COLORS), petals: Math.random() < 0.5 ? 5 : 6,
  phase: rng(0, PI2), rot: rng(0, PI2),
}));

// Flores GRANDES em primeiro plano — nos cantos (visíveis na tela cheia).
const BIG_FLOWERS = [
  { x: 0.11, y: 0.96, size: 0.075, color: '#ff6b9d', petals: 6, phase: 0.0 },
  { x: 0.20, y: 0.99, size: 0.055, color: '#c56bff', petals: 5, phase: 1.2 },
  { x: 0.89, y: 0.97, size: 0.08, color: '#ffd166', petals: 6, phase: 0.6 },
  { x: 0.80, y: 0.995, size: 0.05, color: '#6bd3ff', petals: 5, phase: 2.1 },
];

// Grama.
const GRASS = Array.from({ length: 130 }, () => ({
  x: Math.random(), h: rng(0.02, 0.05), phase: rng(0, PI2),
  lean: rng(-0.4, 0.4), color: pick(['#6cc24a', '#59b23c', '#7fd05a', '#4fa838']),
}));

// Brilhos ambientes (partículas que cintilam).
const SPARKLES = Array.from({ length: 60 }, () => ({
  x: Math.random(), y: rng(0.05, 0.95), r: rng(1, 3.2),
  phase: rng(0, PI2), speed: rng(0.6, 1.8), rise: rng(0.0002, 0.0009),
  color: pick(['#ffffff', '#fff2b0', '#ffd6f0', '#d6f0ff']),
}));

// Fadinhas: cada uma vagueia (Lissajous) ao redor de uma âncora, batendo asas.
function makeFairies(n) {
  return Array.from({ length: n }, () => ({
    ax: rng(0.05, 0.95), ay: rng(0.2, 0.78),
    axr: rng(0.05, 0.16), ayr: rng(0.04, 0.12),
    sxf: rng(0.3, 0.7), syf: rng(0.4, 0.9),
    p1: rng(0, PI2), p2: rng(0, PI2), wing: rng(0, PI2),
    size: rng(0.7, 1.3), color: pick(FAIRY_COLORS),
    trail: [],
  }));
}

// Desenha uma flor (pétalas ao redor + miolo).
function drawFlower(ctx, cx, cy, r, color, petals, rot, big) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  // sombra das pétalas (camada de trás, levemente girada)
  for (let i = 0; i < petals; i++) {
    ctx.rotate(PI2 / petals);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.95, r * 0.52, r * 0.95, 0, 0, PI2);
    ctx.fillStyle = color; ctx.fill();
  }
  if (big) {
    // camada interna de pétalas mais claras
    ctx.rotate(PI2 / petals / 2);
    for (let i = 0; i < petals; i++) {
      ctx.rotate(PI2 / petals);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.6, r * 0.32, r * 0.6, 0, 0, PI2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    }
  }
  // miolo
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.55);
  g.addColorStop(0, '#fff4c2'); g.addColorStop(1, '#ffbe3d');
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, PI2); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}

// `fixed`: position:fixed;inset:0 (fundo de tela cheia) vs position:absolute (card).
export default function FairyScene({ fixed = false }) {
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

    const FAIRIES = makeFairies(fixed ? 14 : 8);

    // ── Céu ensolarado ─────────────────────────────────────────────────────────
    const drawSky = (w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#bfe6ff');
      g.addColorStop(0.45, '#d9f2ec');
      g.addColorStop(0.72, '#e9f8dd');
      g.addColorStop(1, '#f2fbe4');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    };

    // ── Sol com raios girando ──────────────────────────────────────────────────
    const drawSun = (w, h) => {
      const sx = w * 0.14, sy = h * 0.15, R = Math.min(w, h) * 0.085;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 3.4);
      glow.addColorStop(0, 'rgba(255,247,205,0.95)');
      glow.addColorStop(0.25, 'rgba(255,226,120,0.45)');
      glow.addColorStop(1, 'rgba(255,226,120,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, R * 3.4, 0, PI2); ctx.fill();

      const pulse = Math.sin(t * 1.1) * 0.5 + 0.5;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.05);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(PI2 / 12);
        ctx.fillStyle = `rgba(255,238,150,${0.16 + pulse * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(R * 1.15, 0);
        ctx.lineTo(R * (2.3 + pulse * 0.5), -R * 0.13);
        ctx.lineTo(R * (2.3 + pulse * 0.5), R * 0.13);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      const d = ctx.createRadialGradient(sx - R * 0.25, sy - R * 0.25, R * 0.1, sx, sy, R);
      d.addColorStop(0, '#fffdf0'); d.addColorStop(0.6, '#ffe373'); d.addColorStop(1, '#ffc93c');
      ctx.fillStyle = d; ctx.beginPath(); ctx.arc(sx, sy, R, 0, PI2); ctx.fill();
    };

    // ── Colinas ────────────────────────────────────────────────────────────────
    const drawHills = (w, h) => {
      HILLS.forEach(hl => {
        ctx.fillStyle = hl.color;
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) {
          const y = hl.y * h + Math.sin(x / w * Math.PI * 2 + t * hl.speed * 0.2) * hl.amp * h;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      });
    };

    // ── Rio serpenteando ───────────────────────────────────────────────────────
    const drawRiver = (w, h) => {
      const top = h * 0.70, bot = h * 0.86;
      ctx.beginPath();
      ctx.moveTo(0, top);
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, top + Math.sin(x / w * Math.PI * 3 + 0.6) * h * 0.018);
      ctx.lineTo(w, bot);
      for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, bot + Math.sin(x / w * Math.PI * 2) * h * 0.012);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, '#8fd6f0'); g.addColorStop(0.5, '#5cb8e6'); g.addColorStop(1, '#89d2ee');
      ctx.fillStyle = g; ctx.fill();
      // reflexos correndo
      ctx.save(); ctx.clip();
      for (let i = 0; i < 8; i++) {
        const yy = top + (i + 0.5) * ((bot - top) / 8);
        const sh = Math.sin(t * 1.3 + i * 1.2) * w * 0.05;
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + (i % 2) * 0.1})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(w * 0.03 + sh, yy); ctx.lineTo(w * 0.97 + sh, yy); ctx.stroke();
      }
      ctx.restore();
    };

    // ── Árvore grande ──────────────────────────────────────────────────────────
    const drawTree = (tr, w, h) => {
      const sc = Math.min(w, h);
      const x = tr.x * w, base = tr.base * h;
      const trunkH = sc * 0.34 * tr.scale, trunkW = sc * 0.03 * tr.scale;
      const sway = Math.sin(t * 0.5 + tr.phase) * 0.025;
      ctx.save(); ctx.translate(x, base); ctx.rotate(sway);
      // tronco
      ctx.fillStyle = '#8a5a3c';
      ctx.beginPath();
      ctx.moveTo(-trunkW, 0); ctx.lineTo(-trunkW * 0.45, -trunkH);
      ctx.lineTo(trunkW * 0.45, -trunkH); ctx.lineTo(trunkW, 0); ctx.closePath(); ctx.fill();
      // copa (aglomerado de bolhas verdes)
      const cy = -trunkH * 1.02, cr = sc * 0.18 * tr.scale;
      const blobs = [[0, 0, 1], [-0.7, 0.2, 0.72], [0.7, 0.16, 0.76], [-0.35, -0.5, 0.72], [0.4, -0.55, 0.72], [0, -0.8, 0.62], [-0.9, -0.15, 0.5], [0.95, -0.2, 0.52]];
      blobs.forEach(([bx, by, bs]) => { ctx.fillStyle = '#3f9e4a'; ctx.beginPath(); ctx.arc(bx * cr + cr * 0.1, cy + by * cr + cr * 0.1, cr * bs, 0, PI2); ctx.fill(); });
      blobs.forEach(([bx, by, bs]) => { ctx.fillStyle = '#5bbd5f'; ctx.beginPath(); ctx.arc(bx * cr, cy + by * cr, cr * bs, 0, PI2); ctx.fill(); });
      blobs.forEach(([bx, by, bs]) => { ctx.fillStyle = 'rgba(160,230,150,0.5)'; ctx.beginPath(); ctx.arc(bx * cr - cr * 0.3, cy + by * cr - cr * 0.3, cr * bs * 0.5, 0, PI2); ctx.fill(); });
      // florzinhas coloridas na copa
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI2 + tr.phase;
        const rr = cr * (0.5 + (i % 3) * 0.22);
        ctx.fillStyle = FLOWER_COLORS[i % FLOWER_COLORS.length];
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, cr * 0.09, 0, PI2); ctx.fill();
      }
      ctx.restore();
    };

    // ── Flor do campo (com haste que balança) ──────────────────────────────────
    const drawFieldFlower = (f, w, h, big) => {
      const sc = Math.min(w, h);
      const bx = f.x * w, by = f.y * h;
      const r = f.size * sc;
      const stemH = r * (big ? 5 : 4);
      const sway = Math.sin(t * 0.9 + f.phase) * (big ? 0.06 : 0.1);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(sway);
      // haste
      ctx.strokeStyle = '#4fa838'; ctx.lineWidth = Math.max(1.4, r * 0.14); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.5, -stemH * 0.55, 0, -stemH); ctx.stroke();
      // folha
      ctx.fillStyle = '#5bbd5f';
      ctx.beginPath(); ctx.ellipse(r * 0.5, -stemH * 0.45, r * 0.5, r * 0.24, -0.6, 0, PI2); ctx.fill();
      // flor
      drawFlower(ctx, 0, -stemH, r, f.color, f.petals, f.rot + t * 0.1, big);
      ctx.restore();
    };

    // ── Grama ───────────────────────────────────────────────────────────────────
    const drawGrass = (w, h) => {
      const sc = Math.min(w, h), ground = h * 0.985;
      GRASS.forEach(bl => {
        const x = bl.x * w, bh = bl.h * sc * 1.2;
        const tipX = x + (Math.sin(t * 1.0 + bl.phase) * 0.3 + bl.lean) * bh;
        ctx.strokeStyle = bl.color; ctx.lineWidth = Math.max(1, sc * 0.006); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, ground);
        ctx.quadraticCurveTo((x + tipX) / 2, ground - bh * 0.6, tipX, ground - bh); ctx.stroke();
      });
    };

    // ── Brilhos cintilando ──────────────────────────────────────────────────────
    const drawSparkles = (w, h) => {
      const sc = Math.min(w, h);
      SPARKLES.forEach(s => {
        s.y -= s.rise; if (s.y < 0.03) { s.y = 0.98; s.x = Math.random(); }
        const tw = Math.sin(t * s.speed + s.phase) * 0.5 + 0.5;
        if (tw < 0.15) return;
        const x = s.x * w, y = s.y * h, r = s.r * (sc / 320) * (0.6 + tw);
        ctx.globalAlpha = tw;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, PI2); ctx.fill();
        // 4 pontas
        ctx.strokeStyle = s.color; ctx.lineWidth = Math.max(0.6, r * 0.3); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - r * 1.8, y); ctx.lineTo(x + r * 1.8, y);
        ctx.moveTo(x, y - r * 1.8); ctx.lineTo(x, y + r * 1.8); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };

    // ── Fadinha (corpo brilhante + asas batendo + rastro) ───────────────────────
    const drawFairy = (f, w, h) => {
      const sc = Math.min(w, h);
      const fx = (f.ax + Math.sin(t * f.sxf + f.p1) * f.axr) * w;
      const fy = (f.ay + Math.sin(t * f.syf + f.p2) * f.ayr * 1.2) * h;
      const r = f.size * (sc / 180) * 3.2;
      // rastro de brilhos
      f.trail.unshift({ x: fx, y: fy }); if (f.trail.length > 6) f.trail.pop();
      f.trail.forEach((p, i) => {
        const a = (1 - i / 6) * 0.4;
        ctx.globalAlpha = a; ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.35 * (1 - i / 8), 0, PI2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // halo
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 3);
      glow.addColorStop(0, f.color); glow.addColorStop(0.4, f.color + '80'); glow.addColorStop(1, f.color + '00');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(fx, fy, r * 3, 0, PI2); ctx.fill();
      // asas
      const flap = Math.abs(Math.sin(t * 9 + f.wing));
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      [-1, 1].forEach(side => {
        ctx.save(); ctx.translate(fx, fy); ctx.scale(side, 1);
        ctx.beginPath(); ctx.ellipse(r * 1.1, -r * 0.3, r * 1.1 * (0.5 + flap * 0.5), r * 0.7, -0.5, 0, PI2); ctx.fill();
        ctx.restore();
      });
      // corpo
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(fx, fy, r * 0.62, 0, PI2); ctx.fill();
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(fx, fy, r * 0.42, 0, PI2); ctx.fill();
    };

    // ── Feixes de luz suaves vindos do sol ──────────────────────────────────────
    const drawBeams = (w, h) => {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const ox = w * 0.14, oy = h * 0.15;
      for (let i = 0; i < 3; i++) {
        const a = 0.35 + i * 0.35 + Math.sin(t * 0.2 + i) * 0.05;
        const len = Math.max(w, h) * 1.3, wdt = Math.min(w, h) * (0.05 + i * 0.02);
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, 'rgba(255,244,180,0.14)'); g.addColorStop(1, 'rgba(255,244,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -wdt); ctx.lineTo(len, -wdt * 3); ctx.lineTo(len, wdt * 3); ctx.lineTo(0, wdt); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    // ── Loop principal ──────────────────────────────────────────────────────────
    const frame = () => {
      t += 0.016;
      const w = W(), h = H(), d = dpr();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawSky(w, h);
      drawSun(w, h);
      drawBeams(w, h);
      drawHills(w, h);
      TREES.forEach(tr => tr.scale < 0.8 && drawTree(tr, w, h)); // árvores de trás (menores)
      drawRiver(w, h);
      TREES.forEach(tr => tr.scale >= 0.8 && drawTree(tr, w, h)); // árvores grandes (frente)
      // jardim de flores
      FLOWERS.forEach(f => drawFieldFlower(f, w, h, false));
      drawGrass(w, h);
      BIG_FLOWERS.forEach(f => drawFieldFlower(f, w, h, true));
      // fadinhas + brilhos por cima de tudo
      FAIRIES.forEach(f => drawFairy(f, w, h));
      drawSparkles(w, h);

      // brilho atmosférico quente
      const vg = ctx.createRadialGradient(w * 0.14, h * 0.15, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
      vg.addColorStop(0, 'rgba(255,248,210,0.18)'); vg.addColorStop(1, 'rgba(200,120,180,0.08)');
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
