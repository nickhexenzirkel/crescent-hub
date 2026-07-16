// src/shared/oliviaScene.jsx
// Cenário de colagem estilo "SOUR" (Olivia Rodrigo) — pro Uniko Olivia Rodrigo.
// Fundo roxo com nuvens, arco-íris, borboletas roxas/azuis/rosa voando, flores
// que sorriem, margaridas, corações, estrelas cintilando e joias — tudo com cara
// de sticker/scrapbook. Mesmo molde de cosmosScene/fairyScene: UM componente
// canvas com prop `fixed` — serve o card (fixed=false, preenche o pai) e o fundo
// de página inteira (fixed=true, redimensiona sozinho).
import { useEffect, useRef } from 'react';

const PI2 = Math.PI * 2;
const rng = (a, b) => Math.random() * (b - a) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Paleta SOUR: roxos, lilás, rosa, azul-borboleta, amarelo-sorriso.
const ROXO_FUNDO = ['#8b6fd6', '#9d7fe0', '#7c5fc9'];        // fundo de tela cheia (claro)
const ROXO_ESCURO = ['#3a2465', '#2c1a52', '#1e1240'];      // fundo do card (roxo escuro)

// Título "OLIVIA RODRIGO" estilo colagem/ransom-note: cada letra numa fonte,
// cor e inclinação diferentes, recortada num quadradinho — como as letras de
// revista dos moodboards SOUR. Fontes genéricas do canvas (serif/mono/cursive/
// fantasy) + as do app, misturadas de propósito pra não ficar uniforme.
const TITULO_FONTES = [
  '900 {s}px Poppins, sans-serif',
  'italic 800 {s}px Georgia, serif',
  '700 {s}px "Courier New", monospace',
  '800 {s}px Impact, "Arial Black", fantasy',
  'italic 700 {s}px "Times New Roman", serif',
  '900 {s}px Arial, sans-serif',
  'bold {s}px "Comic Sans MS", "Segoe UI", cursive',
  '800 {s}px Verdana, sans-serif',
];
const TITULO_BOXES = ['#ffffff', '#ffd166', '#ff8fd6', '#a06bff', '#6bd3ff', '#ff5d8f', '#c9f26b', '#ffffff'];
const FLOR_CORES = ['#ff8fd6', '#ffd166', '#a06bff', '#ff5d8f', '#6bd3ff', '#ffb3e6', '#c56bff'];
const BORBO_CORES = ['#a06bff', '#7b5fe0', '#6bb0ff', '#ff8fd6', '#c56bff', '#8f9bff'];
const JOIA_CORES = ['#ff5d8f', '#6bd3ff', '#a06bff', '#5be08f', '#ffd166'];

// Flores-sticker espalhadas (algumas com carinha). Coords normalizadas 0..1.
const FLORES = Array.from({ length: 16 }, () => ({
  x: Math.random(), y: rng(0.05, 0.95), size: rng(0.03, 0.075),
  cor: pick(FLOR_CORES), petalas: Math.random() < 0.5 ? 5 : 6,
  sorri: Math.random() < 0.55, rot: rng(0, PI2), fase: rng(0, PI2),
}));

// Estrelinhas cintilando.
const ESTRELAS = Array.from({ length: 40 }, () => ({
  x: Math.random(), y: Math.random(), r: rng(1.5, 5),
  fase: rng(0, PI2), vel: rng(0.6, 1.8), cor: pick(['#ffffff', '#ffe08f', '#ffd6f0', '#c9b6ff']),
  pontas: Math.random() < 0.5 ? 4 : 5,
}));

// Joias/gemas brilhando.
const JOIAS = Array.from({ length: 9 }, () => ({
  x: Math.random(), y: rng(0.05, 0.95), size: rng(0.014, 0.03),
  cor: pick(JOIA_CORES), fase: rng(0, PI2),
}));

// Corações pequenos.
const CORACOES = Array.from({ length: 8 }, () => ({
  x: Math.random(), y: rng(0.1, 0.9), size: rng(0.02, 0.04),
  cor: pick(['#ff5d8f', '#ff8fd6', '#c56bff']), fase: rng(0, PI2), rot: rng(-0.3, 0.3),
}));

// Nuvens fofas ao fundo.
const NUVENS = [
  { x: 0.16, y: 0.16, s: 0.9, vel: 0.010 },
  { x: 0.78, y: 0.10, s: 1.1, vel: 0.008 },
  { x: 0.55, y: 0.30, s: 0.7, vel: 0.013 },
  { x: 0.10, y: 0.62, s: 0.8, vel: 0.009 },
  { x: 0.88, y: 0.72, s: 0.95, vel: 0.011 },
];

// Borboletas vagueando (Lissajous) e batendo asas.
function makeBorboletas(n) {
  return Array.from({ length: n }, () => ({
    ax: rng(0.06, 0.94), ay: rng(0.1, 0.9),
    axr: rng(0.06, 0.18), ayr: rng(0.05, 0.14),
    sxf: rng(0.3, 0.7), syf: rng(0.4, 0.9),
    p1: rng(0, PI2), p2: rng(0, PI2), asa: rng(0, PI2),
    size: rng(0.8, 1.5), cor: pick(BORBO_CORES),
  }));
}

// ── Desenhos de sticker ──────────────────────────────────────────────────────

// Flor de sticker: pétalas arredondadas + miolo (com carinha opcional).
function drawFlor(ctx, cx, cy, r, cor, petalas, rot, sorri) {
  ctx.save();
  ctx.translate(cx, cy);
  // contorno branco tipo sticker
  ctx.save(); ctx.rotate(rot);
  for (let i = 0; i < petalas; i++) {
    ctx.rotate(PI2 / petalas);
    ctx.beginPath(); ctx.ellipse(0, -r * 0.92, r * 0.58, r * 0.95, 0, 0, PI2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.restore();
  // pétalas coloridas (um tico menores, deixa a borda branca aparecer)
  ctx.save(); ctx.rotate(rot);
  for (let i = 0; i < petalas; i++) {
    ctx.rotate(PI2 / petalas);
    ctx.beginPath(); ctx.ellipse(0, -r * 0.9, r * 0.48, r * 0.85, 0, 0, PI2);
    ctx.fillStyle = cor; ctx.fill();
  }
  ctx.restore();
  // miolo amarelo
  const g = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.05, 0, 0, r * 0.6);
  g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#ffca3a');
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, PI2); ctx.fillStyle = g; ctx.fill();
  // carinha
  if (sorri) {
    ctx.fillStyle = '#5a3d1a';
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.08, r * 0.075, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.08, r * 0.075, 0, PI2); ctx.fill();
    ctx.strokeStyle = '#5a3d1a'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, r * 0.02, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // bochechas rosinhas
    ctx.fillStyle = 'rgba(255,120,170,0.55)';
    ctx.beginPath(); ctx.arc(-r * 0.32, r * 0.12, r * 0.09, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.32, r * 0.12, r * 0.09, 0, PI2); ctx.fill();
  }
  ctx.restore();
}

// Estrela de N pontas com contorno branco.
function drawEstrela(ctx, cx, cy, r, cor, pontas) {
  ctx.save(); ctx.translate(cx, cy);
  const passo = Math.PI / pontas;
  const path = (raio, raioInt) => {
    ctx.beginPath();
    for (let i = 0; i < pontas * 2; i++) {
      const rr = i % 2 === 0 ? raio : raioInt;
      const a = i * passo - Math.PI / 2;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  path(r * 1.25, r * 0.55); ctx.fillStyle = '#fff'; ctx.fill();   // borda
  path(r, r * 0.44); ctx.fillStyle = cor; ctx.fill();
  ctx.restore();
}

// Coração de sticker.
function drawCoracao(ctx, cx, cy, r, cor, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(r / 16, r / 16);
  const heart = (s) => {
    ctx.beginPath(); ctx.moveTo(0, 5 * s);
    ctx.bezierCurveTo(-9 * s, -5 * s, -16 * s, 5 * s, 0, 15 * s);
    ctx.bezierCurveTo(16 * s, 5 * s, 9 * s, -5 * s, 0, 5 * s);
    ctx.closePath();
  };
  heart(1.15); ctx.fillStyle = '#fff'; ctx.fill();
  heart(1); ctx.fillStyle = cor; ctx.fill();
  // brilhinho
  ctx.beginPath(); ctx.ellipse(-4, 2, 2.2, 3.4, -0.5, 0, PI2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();
}

// Gema/joia (losango facetado).
function drawJoia(ctx, cx, cy, r, cor, brilho) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, -r * 0.3); ctx.lineTo(r * 0.55, r);
  ctx.lineTo(-r * 0.55, r); ctx.lineTo(-r * 0.8, -r * 0.3); ctx.closePath();
  ctx.fillStyle = cor; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
  // facetas
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r * 0.8, -r * 0.3); ctx.lineTo(r * 0.8, -r * 0.3); ctx.stroke();
  // reflexo piscando
  ctx.globalAlpha = brilho;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.35, r * 0.16, 0, PI2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Nuvem fofa (3 bolhas + base).
function drawNuvem(ctx, cx, cy, s, sc) {
  const u = sc * 0.08 * s;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.28, 0.72], [-0.45, -0.35, 0.62], [0.5, -0.3, 0.6]]
    .forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx * u, cy + dy * u, r * u, 0, PI2); ctx.fill(); });
  ctx.fillRect(cx - u, cy, u * 2, u * 0.9);
}

// Arco-íris com nuvenzinhas nas pontas.
function drawArcoIris(ctx, cx, cy, R, sc) {
  const cores = ['#ff6b8f', '#ffab5e', '#ffe066', '#7bd88f', '#6bbcff', '#a678ff'];
  const larg = R * 0.14;
  ctx.lineCap = 'round';
  cores.forEach((c, i) => {
    ctx.strokeStyle = c; ctx.lineWidth = larg;
    ctx.beginPath(); ctx.arc(cx, cy, R - i * larg, Math.PI, PI2); ctx.stroke();
  });
  const nr = R - cores.length * larg;
  drawNuvem(ctx, cx - R + larg * 3, cy, 0.55 * (R / (sc * 0.08 * 0.55)) / 6.5, sc);
  drawNuvem(ctx, cx + nr + larg * 0.5, cy, 0.55 * (R / (sc * 0.08 * 0.55)) / 6.5, sc);
}

// Borboleta (2 pares de asas batendo + corpo).
function drawBorboleta(ctx, x, y, r, cor, asa) {
  ctx.save(); ctx.translate(x, y);
  const flap = 0.35 + Math.abs(Math.sin(asa)) * 0.75;   // abre/fecha
  const asaLado = (lado) => {
    ctx.save(); ctx.scale(lado * flap, 1);
    // asa de cima
    ctx.beginPath(); ctx.ellipse(r * 0.75, -r * 0.55, r * 0.78, r * 0.62, -0.5, 0, PI2);
    ctx.fillStyle = cor; ctx.fill();
    // asa de baixo
    ctx.beginPath(); ctx.ellipse(r * 0.62, r * 0.5, r * 0.6, r * 0.5, 0.4, 0, PI2);
    ctx.fillStyle = cor; ctx.fill();
    // pintinhas claras
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(r * 0.85, -r * 0.6, r * 0.16, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.6, r * 0.5, r * 0.11, 0, PI2); ctx.fill();
    ctx.restore();
  };
  asaLado(-1); asaLado(1);
  // corpo
  ctx.fillStyle = '#3a2a5a';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.12, r * 0.7, 0, 0, PI2); ctx.fill();
  // anteninhas
  ctx.strokeStyle = '#3a2a5a'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -r * 0.6);
  ctx.quadraticCurveTo(-r * 0.3, -r * 1.1, -r * 0.45, -r * 1.15);
  ctx.moveTo(0, -r * 0.6);
  ctx.quadraticCurveTo(r * 0.3, -r * 1.1, r * 0.45, -r * 1.15); ctx.stroke();
  ctx.restore();
}

// Título ransom-note "OLIVIA RODRIGO" (duas linhas de letras recortadas).
// `seed` fixa a aparência (fonte/cor/rotação por letra) pra não piscar a cada
// frame. cx/cy = centro; s = altura da letra em px.
function drawTitulo(ctx, cx, cy, s, seed) {
  const linhas = ['OLIVIA', 'RODRIGO'];
  // gerador determinístico (a mesma seed → sempre o mesmo visual)
  let r = seed >>> 0;
  const rnd = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296;
  const gap = s * 0.14;
  linhas.forEach((linha, li) => {
    // largura da linha pra centralizar
    const larguras = [];
    for (const ch of linha) {
      ctx.font = TITULO_FONTES[0].replace('{s}', s);
      larguras.push(s * 0.78);
    }
    const totalW = larguras.reduce((a, b) => a + b + gap, -gap);
    let x = cx - totalW / 2;
    const y = cy + li * (s * 1.32);
    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i], w = larguras[i];
      const fonte = TITULO_FONTES[Math.floor(rnd() * TITULO_FONTES.length)];
      const box = TITULO_BOXES[Math.floor(rnd() * TITULO_BOXES.length)];
      const rot = (rnd() - 0.5) * 0.34;
      const bob = (rnd() - 0.5) * s * 0.12;
      ctx.save();
      ctx.translate(x + w / 2, y + bob);
      ctx.rotate(rot);
      // quadradinho recortado (com sombra sutil)
      const bw = w * 1.02, bh = s * 1.12;
      ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = s * 0.14; ctx.shadowOffsetY = s * 0.05;
      ctx.fillStyle = box;
      const rr = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + rr, -bh / 2);
      ctx.arcTo(bw / 2, -bh / 2, bw / 2, bh / 2, rr);
      ctx.arcTo(bw / 2, bh / 2, -bw / 2, bh / 2, rr);
      ctx.arcTo(-bw / 2, bh / 2, -bw / 2, -bh / 2, rr);
      ctx.arcTo(-bw / 2, -bh / 2, bw / 2, -bh / 2, rr);
      ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent';
      // letra (escura em box claro, branca em box escuro)
      const clara = box === '#ffffff' || box === '#ffd166' || box === '#c9f26b' || box === '#6bd3ff';
      ctx.fillStyle = clara ? '#2a1150' : '#ffffff';
      ctx.font = fonte.replace('{s}', s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, s * 0.04);
      ctx.restore();
      x += w + gap;
    }
  });
}

// `fixed`: position:fixed;inset:0 (fundo de tela cheia) vs position:absolute (card).
// `dark`: fundo roxo ESCURO (pro card do Uniko) em vez do roxo claro da tela cheia.
export default function OliviaScene({ fixed = false, dark = false }) {
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

    const BORBOLETAS = makeBorboletas(fixed ? 12 : 7);

    const PAL = dark ? ROXO_ESCURO : ROXO_FUNDO;
    const drawFundo = (w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, PAL[0]);
      g.addColorStop(0.55, PAL[1]);
      g.addColorStop(1, PAL[2]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // manchas de brilho suaves
      const b1 = ctx.createRadialGradient(w * 0.2, h * 0.2, 0, w * 0.2, h * 0.2, Math.max(w, h) * 0.5);
      b1.addColorStop(0, `rgba(255,255,255,${dark ? 0.08 : 0.14})`); b1.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = b1; ctx.fillRect(0, 0, w, h);
      const b2 = ctx.createRadialGradient(w * 0.85, h * 0.85, 0, w * 0.85, h * 0.85, Math.max(w, h) * 0.5);
      b2.addColorStop(0, `rgba(255,150,220,${dark ? 0.10 : 0.12})`); b2.addColorStop(1, 'rgba(255,150,220,0)');
      ctx.fillStyle = b2; ctx.fillRect(0, 0, w, h);
    };

    const frame = () => {
      t += 0.016;
      const w = W(), h = H(), d = dpr(), sc = Math.min(w, h);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawFundo(w, h);

      // nuvens deslizando (com wrap)
      NUVENS.forEach(n => {
        let nx = (n.x + t * n.vel) % 1.2 - 0.1;
        drawNuvem(ctx, nx * w, n.y * h, n.s, sc);
      });

      // arco-íris no alto
      drawArcoIris(ctx, w * 0.5, h * (fixed ? 0.34 : 0.42), sc * (fixed ? 0.26 : 0.34), sc);

      // stickers estáticos (flores, corações, joias, estrelas)
      FLORES.forEach(f => {
        const bob = Math.sin(t * 0.8 + f.fase) * sc * 0.004;
        drawFlor(ctx, f.x * w, f.y * h + bob, f.size * sc, f.cor, f.petalas, f.rot, f.sorri);
      });
      CORACOES.forEach(c => {
        const pulse = 1 + Math.sin(t * 1.6 + c.fase) * 0.08;
        drawCoracao(ctx, c.x * w, c.y * h, c.size * sc * pulse, c.cor, c.rot);
      });
      JOIAS.forEach(j => {
        const br = Math.sin(t * 2 + j.fase) * 0.5 + 0.5;
        drawJoia(ctx, j.x * w, j.y * h, j.size * sc, j.cor, br);
      });
      ESTRELAS.forEach(s => {
        const tw = Math.sin(t * s.vel + s.fase) * 0.5 + 0.5;
        if (tw < 0.12) return;
        ctx.globalAlpha = 0.4 + tw * 0.6;
        drawEstrela(ctx, s.x * w, s.y * h, s.r * (sc / 320) * (0.7 + tw * 0.6), s.cor, s.pontas);
        ctx.globalAlpha = 1;
      });

      // adesivo "OLIVIA RODRIGO" ransom-note — só na tela cheia, no canto inferior
      // esquerdo (área visível fora dos painéis). POR CIMA dos stickers pra ficar
      // legível (senão as flores cobrem as letras).
      if (fixed) drawTitulo(ctx, w * 0.155, h * 0.7, Math.max(20, sc * 0.05), 1337);

      // borboletas por cima de tudo
      BORBOLETAS.forEach(b => {
        const bx = (b.ax + Math.sin(t * b.sxf + b.p1) * b.axr) * w;
        const by = (b.ay + Math.sin(t * b.syf + b.p2) * b.ayr * 1.15) * h;
        const r = b.size * (sc / 180) * 3.4;
        drawBorboleta(ctx, bx, by, r, b.cor, t * 6 + b.asa);
      });

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
