// src/shared/cosmosScene.jsx
// Cenário cósmico animado (canvas) — planetas com anéis, planetas ESTILHAÇADOS com cacos
// orbitando, mini-galáxias espirais orbitando, estrelas cintilantes, estrelas cadentes,
// destroços à deriva e a peça central: uma espada cravada destruindo um planeta. Feito pro
// Uniko "Destruidora de Mundos" (Oficina). Portado 1:1 (mesmos números/cores) do protótipo
// em Figma Make do usuário (`Criar cenário animado/src/app/App.tsx`), só TS→JS e adaptado
// pra ocupar o elemento pai em vez da tela toda sozinho. Preenche o pai (position:relative).
import React, { useEffect, useRef } from 'react';

const rng = (min, max) => Math.random() * (max - min) + min;

function makeVerts(n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rng(-0.4, 0.4);
    return [Math.cos(a) * rng(0.55, 1), Math.sin(a) * rng(0.55, 1)];
  });
}

function makeSurface(n) {
  return Array.from({ length: n }, () => ({
    x: rng(-0.6, 0.6), y: rng(-0.7, 0.7),
    rx: rng(0.08, 0.28), ry: rng(0.05, 0.16),
    a: rng(0, Math.PI), dark: Math.random() > 0.45,
  }));
}

function makeBrokenPlanet(x, y, r) {
  const shardCount = Math.floor(rng(10, 18));
  const shards = Array.from({ length: shardCount }, (_, i) => {
    const angle = (i / shardCount) * Math.PI * 2 + rng(-0.3, 0.3);
    const dist = rng(1.3, 5.0); // órbita a partir do centro do planeta (em unidades de r)
    return {
      ox: Math.cos(angle) * dist, oy: Math.sin(angle) * dist,
      orbitR: rng(0.05, 0.35), orbitSpeed: rng(-0.008, 0.008), orbitPhase: rng(0, Math.PI * 2),
      verts: makeVerts(4 + Math.floor(Math.random() * 4)),
      rot: rng(0, Math.PI * 2), rotSpeed: rng(-0.012, 0.012),
      size: rng(0.06, 0.22), // fração de r
      alpha: rng(0.4, 0.85),
    };
  });
  const crackSeeds = Array.from({ length: 4 }, () => ({ a1: rng(0, Math.PI * 2), a2: rng(0, Math.PI * 2) }));
  return { x, y, r, shards, crackSeeds, rotSpeed: rng(0.008, 0.02) };
}

const STARS = Array.from({ length: 240 }, () => ({
  x: Math.random(), y: Math.random(), r: rng(0.2, 1.6),
  speed: rng(0.4, 1.8), phase: rng(0, Math.PI * 2),
}));

const DEBRIS = Array.from({ length: 40 }, () => ({
  cx: Math.random(), cy: Math.random(),
  verts: makeVerts(5 + Math.floor(Math.random() * 4)),
  rotSpeed: rng(-0.008, 0.008), rot: rng(0, Math.PI * 2),
  driftX: rng(-0.00009, 0.00009), driftY: rng(-0.00009, 0.00009),
  alpha: rng(0.12, 0.45), size: rng(3, 11),
}));

function makeGalaxyStars(count, arms) {
  return Array.from({ length: count }, () => {
    const arm = Math.floor(Math.random() * arms);
    const frac = Math.pow(Math.random(), 0.55);
    const baseA = (arm / arms) * Math.PI * 2;
    const spiralA = baseA + frac * Math.PI * 2.8 + rng(-frac * 0.4, frac * 0.4);
    return {
      dist: frac, angle: spiralA,
      r: rng(0.4, frac < 0.12 ? 3.0 : 1.4) * (1 - frac * 0.5),
      alpha: rng(0.25, 0.9) * (1 - frac * 0.4),
      bright: Math.random() < 0.04,
    };
  });
}

const G1 = makeGalaxyStars(380, 2);
const G2 = makeGalaxyStars(260, 3);
const G3 = makeGalaxyStars(200, 2);

const SURF1 = makeSurface(8);
const SURF2 = makeSurface(10);

// Planetas estilhaçados — cluster inferior-esquerdo + canto superior-direito
const BROKEN_PLANETS = [
  makeBrokenPlanet(0.058, 0.45, 0.046),
  makeBrokenPlanet(0.042, 0.60, 0.036),
  makeBrokenPlanet(0.068, 0.73, 0.030),
  makeBrokenPlanet(0.036, 0.84, 0.021),
  // cluster do canto superior-direito
  makeBrokenPlanet(0.940, 0.055, 0.030),
  makeBrokenPlanet(0.920, 0.130, 0.022),
  makeBrokenPlanet(0.960, 0.180, 0.016),
];

// `fixed`: usa position:fixed;inset:0 (fundo de tela cheia da página) em vez de
// position:absolute;inset:0 (preenche o card/elemento pai — encontro do Capture o Uniko,
// card "Uniko x Alexa"). O canvas se redimensiona sozinho (ResizeObserver) então o MESMO
// componente serve pros dois contextos, só troca o wrapper.
export default function CosmosScene({ fixed = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let rafId;
    let t = 0;
    const particles = [];
    const shooters = [];

    const dpr = () => devicePixelRatio || 1;
    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const resize = () => { canvas.width = W() * dpr(); canvas.height = H() * dpr(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── fundo ────────────────────────────────────────────────────────────────
    const drawBg = () => {
      const w = W(), h = H();
      const g = ctx.createRadialGradient(w * 0.6, h * 0.55, 0, w * 0.5, h * 0.5, w);
      g.addColorStop(0, '#1e003a'); g.addColorStop(0.18, '#10001e');
      g.addColorStop(0.55, '#070012'); g.addColorStop(1, '#000005');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    };

    // ── nebulosa ─────────────────────────────────────────────────────────────
    const blob = (bx, by, br, c0, a0, c1, a1) => {
      const w = W(), h = H();
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, c0.replace('$', String(a0)));
      g.addColorStop(0.5, c1.replace('$', String(a1)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    };

    const drawNebula = () => {
      const w = W(), h = H();
      const p1 = Math.sin(t * 0.22) * 0.12 + 0.88;
      blob(w * 0.18, h * 0.25, w * 0.40, `rgba(72,0,135,$)`, 0.28 * p1, `rgba(40,0,90,$)`, 0.10 * p1);
      const p2 = Math.sin(t * 0.17 + 1.3) * 0.15 + 0.85;
      blob(w * 0.62, h * 0.60, w * 0.44, `rgba(130,0,220,$)`, 0.40 * p2, `rgba(85,0,155,$)`, 0.16 * p2);
      const p3 = Math.sin(t * 0.28 + 2) * 0.1 + 0.9;
      blob(w * 0.08, h * 0.50, w * 0.22, `rgba(55,0,110,$)`, 0.18 * p3, `rgba(30,0,70,$)`, 0.07 * p3);
    };

    // ── estrelas ─────────────────────────────────────────────────────────────
    const drawStars = () => {
      const w = W(), h = H();
      STARS.forEach(s => {
        const alpha = (Math.sin(t * s.speed + s.phase) * 0.32 + 0.68) * 0.92;
        const x = s.x * w, y = s.y * h;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
        if (s.r > 1.05 && alpha > 0.74) {
          const len = s.r * 4.5;
          ctx.strokeStyle = `rgba(200,150,255,${alpha * 0.45})`; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
          ctx.moveTo(x, y - len); ctx.lineTo(x, y + len); ctx.stroke();
        }
      });
    };

    // ── estrelas cadentes — raras, lentas, rumo ao canto superior-direito ─────
    const spawnShooter = () => {
      const angle = rng(-Math.PI * 0.11, -Math.PI * 0.30);
      const speed = rng(0.003, 0.006);
      shooters.push({
        x: rng(-0.05, 0.55), y: rng(0.3, 0.85),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0, maxLife: rng(90, 160), angle,
      });
    };

    const drawShooters = () => {
      const w = W(), h = H(), diag = Math.max(w, h);
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x += s.vx; s.y += s.vy; s.life++;
        if (s.life >= s.maxLife || s.x > 1.15 || s.y < -0.1) { shooters.splice(i, 1); continue; }
        const alpha = Math.sin((s.life / s.maxLife) * Math.PI) * 0.55;
        const x = s.x * w, y = s.y * h;
        const len = rng(0.06, 0.12) * diag;
        const tx = x - Math.cos(s.angle) * len, ty = y - Math.sin(s.angle) * len;
        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, `rgba(210,185,255,${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(255,255,255,${alpha})`);
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.2; ctx.stroke();
        const hg = ctx.createRadialGradient(x, y, 0, x, y, 3);
        hg.addColorStop(0, `rgba(255,255,255,${alpha})`); hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    };

    // ── mini-galáxias orbitando ────────────────────────────────────────────────
    const drawGalaxy = (stars, cx, cy, radius, spin, tilt) => {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(spin); ctx.scale(1, tilt);
      stars.forEach(s => {
        const x = Math.cos(s.angle) * s.dist * radius;
        const y = Math.sin(s.angle) * s.dist * radius;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.bright
          ? `rgba(255,225,255,${s.alpha})`
          : s.dist < 0.14
          ? `rgba(255,205,255,${s.alpha * 0.9})`
          : `rgba(148,58,255,${s.alpha * 0.62})`;
        ctx.fill();
      });
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.13);
      core.addColorStop(0, 'rgba(255,215,255,0.72)');
      core.addColorStop(0.5, 'rgba(180,80,255,0.28)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, radius * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const drawGalaxies = () => {
      const w = W(), h = H();
      const sc = Math.min(w, h);

      const g1a = t * 0.012;
      const g1cx = w * 0.48 + Math.cos(g1a) * w * 0.22;
      const g1cy = h * 0.72 + Math.sin(g1a) * h * 0.12;
      drawGalaxy(G1, g1cx, g1cy, sc * 0.185, t * 0.040, 0.30);

      const g2a = -t * 0.009 + 1.2;
      const g2cx = w * 0.68 + Math.cos(g2a) * w * 0.16;
      const g2cy = h * 0.28 + Math.sin(g2a) * h * 0.10;
      drawGalaxy(G2, g2cx, g2cy, sc * 0.135, -t * 0.032, 0.27);

      const g3a = t * 0.018 + 2.8;
      const g3cx = w * 0.14 + Math.cos(g3a) * w * 0.07;
      const g3cy = h * 0.42 + Math.sin(g3a) * h * 0.08;
      drawGalaxy(G3, g3cx, g3cy, sc * 0.095, t * 0.055, 0.35);
    };

    // ── planeta com superfície girando ────────────────────────────────────────
    const drawPlanet = (cx, cy, r, opts) => {
      const { light, dark, glow, glowR, glowA, rotSpeed, rotOffset, surface, surfaceLight, surfaceDark, rings } = opts;

      const ag = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r + glowR);
      ag.addColorStop(0, glow.replace('rgb(', 'rgba(').replace(')', `,${glowA})`));
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, r + glowR, 0, Math.PI * 2); ctx.fill();

      if (rings) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rings.angle); ctx.scale(1, rings.tilt);
        ctx.globalAlpha = rings.alpha * 0.88; ctx.strokeStyle = rings.color; ctx.lineWidth = r * 0.20;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 2.35, r * 0.35, 0, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      const pg = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.28, r * 0.04, cx, cy, r);
      pg.addColorStop(0, light); pg.addColorStop(0.45, dark); pg.addColorStop(1, '#04000e');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill();

      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(t * rotSpeed + rotOffset);
      surface.forEach(p => {
        ctx.beginPath();
        ctx.ellipse(p.x * r, p.y * r, p.rx * r, p.ry * r, p.a, 0, Math.PI * 2);
        ctx.fillStyle = p.dark ? surfaceDark : surfaceLight; ctx.fill();
      });
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
      ctx.restore();

      const sg = ctx.createRadialGradient(cx + r * 0.48, cy + r * 0.48, 0, cx, cy, r);
      sg.addColorStop(0, 'rgba(0,0,0,0.80)'); sg.addColorStop(0.55, 'rgba(0,0,0,0.20)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();

      if (rings) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rings.angle); ctx.scale(1, rings.tilt);
        ctx.globalAlpha = rings.alpha; ctx.strokeStyle = rings.color; ctx.lineWidth = r * 0.20;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 2.35, r * 0.35, 0, 0, Math.PI); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    // ── bloom ────────────────────────────────────────────────────────────────
    const drawBloom = (cx, cy, r) => {
      const p = Math.sin(t * 0.48) * 0.18 + 0.82;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * p);
      g.addColorStop(0, 'rgba(220,90,255,0.75)'); g.addColorStop(0.12, 'rgba(160,30,230,0.55)');
      g.addColorStop(0.4, 'rgba(100,0,185,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * p, 0, Math.PI * 2); ctx.fill();
    };

    // ── planetas estilhaçados (lado esquerdo + canto sup. direito) ────────────
    const drawBrokenPlanets = () => {
      const w = W(), h = H(), sc = Math.min(w, h);

      BROKEN_PLANETS.forEach(bp => {
        const cx = bp.x * w, cy = bp.y * h, r = bp.r * sc;

        const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 3.5);
        halo.addColorStop(0, 'rgba(80,0,140,0.18)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 3.5, 0, Math.PI * 2); ctx.fill();

        const coreG = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r);
        coreG.addColorStop(0, '#6a28a8'); coreG.addColorStop(0.40, '#32005e'); coreG.addColorStop(0.80, '#160028'); coreG.addColorStop(1, '#080012');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = coreG; ctx.fill();

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2); ctx.clip();
        ctx.translate(cx, cy); ctx.rotate(t * bp.rotSpeed);
        SURF1.slice(0, 5).forEach(p => {
          ctx.beginPath();
          ctx.ellipse(p.x * r, p.y * r, p.rx * r, p.ry * r, p.a, 0, Math.PI * 2);
          ctx.fillStyle = p.dark ? 'rgba(8,0,20,0.30)' : 'rgba(110,35,175,0.22)'; ctx.fill();
        });
        ctx.restore();

        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * bp.rotSpeed * 0.5);
        ctx.strokeStyle = 'rgba(180,80,255,0.35)'; ctx.lineWidth = 0.8;
        bp.crackSeeds.forEach(c => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(c.a1) * r * 0.2, Math.sin(c.a1) * r * 0.2);
          ctx.lineTo(Math.cos(c.a1) * r * 0.85, Math.sin(c.a1) * r * 0.85);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(Math.cos(c.a2) * r * 0.15, Math.sin(c.a2) * r * 0.15);
          ctx.lineTo(Math.cos(c.a2 + 0.6) * r * 0.9, Math.sin(c.a2 + 0.6) * r * 0.9);
          ctx.stroke();
        });
        ctx.restore();

        const sh = ctx.createRadialGradient(cx + r * 0.4, cy + r * 0.4, 0, cx, cy, r);
        sh.addColorStop(0, 'rgba(0,0,0,0.80)'); sh.addColorStop(0.5, 'rgba(0,0,0,0.15)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = sh; ctx.fill();

        const atm = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
        atm.addColorStop(0, 'rgba(120,30,210,0)'); atm.addColorStop(0.7, 'rgba(120,30,210,0.18)'); atm.addColorStop(1, 'rgba(160,70,240,0.35)');
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = atm; ctx.fill();

        bp.shards.forEach(s => {
          s.rot += s.rotSpeed;
          const orbitX = s.ox * r + Math.cos(t * s.orbitSpeed + s.orbitPhase) * s.orbitR * r;
          const orbitY = s.oy * r + Math.sin(t * s.orbitSpeed + s.orbitPhase) * s.orbitR * r;
          const sx = cx + orbitX, sy = cy + orbitY;
          const sr = s.size * r;

          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.5);
          sg.addColorStop(0, `rgba(100,30,180,${s.alpha * 0.25})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr * 2.5, 0, Math.PI * 2); ctx.fill();

          ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.rot); ctx.globalAlpha = s.alpha;
          ctx.beginPath();
          s.verts.forEach(([vx, vy], i) => { i === 0 ? ctx.moveTo(vx * sr, vy * sr) : ctx.lineTo(vx * sr, vy * sr); });
          ctx.closePath();

          const shardG = ctx.createLinearGradient(-sr, -sr, sr, sr);
          shardG.addColorStop(0, '#4a1880'); shardG.addColorStop(0.5, '#220040'); shardG.addColorStop(1, '#0e0020');
          ctx.fillStyle = shardG; ctx.fill();
          ctx.strokeStyle = 'rgba(140,50,230,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();
          ctx.restore();
        });
      });
      ctx.globalAlpha = 1;
    };

    // ── destroços gerais ──────────────────────────────────────────────────────
    const drawDebris = () => {
      const w = W(), h = H();
      DEBRIS.forEach(d => {
        d.rot += d.rotSpeed;
        d.cx = ((d.cx + d.driftX) % 1 + 1) % 1;
        d.cy = ((d.cy + d.driftY) % 1 + 1) % 1;
        ctx.save(); ctx.translate(d.cx * w, d.cy * h); ctx.rotate(d.rot); ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        d.verts.forEach(([vx, vy], i) => { i === 0 ? ctx.moveTo(vx * d.size, vy * d.size) : ctx.lineTo(vx * d.size, vy * d.size); });
        ctx.closePath(); ctx.fillStyle = '#130622'; ctx.strokeStyle = 'rgba(90,20,160,0.55)';
        ctx.lineWidth = 0.5; ctx.fill(); ctx.stroke(); ctx.restore();
      });
      ctx.globalAlpha = 1;
    };

    // ── espada + planeta (peça central) ───────────────────────────────────────
    const drawSwordEarth = () => {
      const w = W(), h = H();
      const cx = w * 0.88, cy = h * 0.78;
      const pr = Math.min(w, h) * 0.072;
      const swAngle = -Math.PI * 0.28;
      const bLen = pr * 2.3, hLen = pr * 0.75, bW = pr * 0.095;
      const gW = pr * 0.60, pommelR = pr * 0.12, guardY = pr * 1.15;
      const tipY = -(bLen + guardY);
      const entryFrac = (-pr - tipY) / (guardY - tipY);
      const entryW = bW * entryFrac;

      const haloG = ctx.createRadialGradient(cx, cy, pr * 0.7, cx, cy, pr * 1.75);
      haloG.addColorStop(0, 'rgba(90,0,165,0.42)'); haloG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haloG; ctx.beginPath(); ctx.arc(cx, cy, pr * 1.75, 0, Math.PI * 2); ctx.fill();

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(swAngle); ctx.globalAlpha = 0.22;
      const backG = ctx.createLinearGradient(-bW, 0, bW, 0);
      backG.addColorStop(0, '#4a3080'); backG.addColorStop(0.5, '#bba8e8'); backG.addColorStop(1, '#3a2060');
      ctx.fillStyle = backG;
      ctx.beginPath(); ctx.moveTo(-entryW, -pr); ctx.lineTo(entryW, -pr);
      ctx.lineTo(bW, guardY); ctx.lineTo(-bW, guardY); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.restore();

      const earthSpin = t * 0.06;
      const bodyG = ctx.createRadialGradient(cx - pr * 0.28, cy - pr * 0.28, pr * 0.04, cx, cy, pr);
      bodyG.addColorStop(0, '#7a30b8'); bodyG.addColorStop(0.35, '#3e0075'); bodyG.addColorStop(0.75, '#1c0038'); bodyG.addColorStop(1, '#0a0018');
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fillStyle = bodyG; ctx.fill();

      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(earthSpin);
      [{ dx: -0.28, dy: -0.32, rx: 0.40, ry: 0.24, a: 0.4 }, { dx: 0.22, dy: -0.18, rx: 0.28, ry: 0.35, a: -0.5 }, { dx: -0.08, dy: 0.38, rx: 0.42, ry: 0.22, a: 0.7 }, { dx: 0.38, dy: 0.28, rx: 0.24, ry: 0.20, a: -0.2 }, { dx: -0.42, dy: 0.08, rx: 0.20, ry: 0.28, a: 0.5 }]
        .forEach(c => { ctx.save(); ctx.translate(c.dx * pr, c.dy * pr); ctx.rotate(c.a); ctx.beginPath(); ctx.ellipse(0, 0, c.rx * pr, c.ry * pr, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(100,18,168,0.55)'; ctx.fill(); ctx.restore(); });
      ctx.restore();

      const atmG = ctx.createRadialGradient(cx, cy, pr * 0.83, cx, cy, pr);
      atmG.addColorStop(0, 'rgba(130,40,220,0)'); atmG.addColorStop(0.65, 'rgba(130,40,220,0.22)'); atmG.addColorStop(1, 'rgba(185,85,255,0.42)');
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fillStyle = atmG; ctx.fill();

      const shG = ctx.createRadialGradient(cx + pr * 0.38, cy + pr * 0.38, 0, cx, cy, pr);
      shG.addColorStop(0, 'rgba(0,0,0,0.75)'); shG.addColorStop(0.55, 'rgba(0,0,0,0.18)'); shG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fillStyle = shG; ctx.fill();

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(swAngle);
      const gGlow = ctx.createLinearGradient(0, tipY, 0, -pr);
      gGlow.addColorStop(0, 'rgba(200,160,255,0)'); gGlow.addColorStop(0.4, 'rgba(180,100,255,0.30)'); gGlow.addColorStop(1, 'rgba(210,180,255,0.12)');
      ctx.fillStyle = gGlow; ctx.fillRect(-pr * 0.28, tipY, pr * 0.56, Math.abs(tipY) - pr);

      const bladeG = ctx.createLinearGradient(-bW, 0, bW, 0);
      bladeG.addColorStop(0, '#5a4090'); bladeG.addColorStop(0.28, '#d0c0f8'); bladeG.addColorStop(0.5, '#ffffff'); bladeG.addColorStop(0.72, '#c0b0e8'); bladeG.addColorStop(1, '#4a3080');
      ctx.fillStyle = bladeG;
      ctx.beginPath(); ctx.moveTo(0, tipY); ctx.lineTo(-entryW, -pr); ctx.lineTo(entryW, -pr); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(225,210,255,0.80)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, tipY); ctx.lineTo(0, -pr); ctx.stroke();

      const gFill = ctx.createLinearGradient(0, guardY - pr * 0.09, 0, guardY + pr * 0.09);
      gFill.addColorStop(0, '#9878d8'); gFill.addColorStop(0.5, '#caaeff'); gFill.addColorStop(1, '#6040a8');
      ctx.fillStyle = gFill;
      ctx.beginPath();
      ctx.moveTo(-gW, guardY - pr * 0.075); ctx.lineTo(-gW + pr * 0.04, guardY - pr * 0.09); ctx.lineTo(gW - pr * 0.04, guardY - pr * 0.09); ctx.lineTo(gW, guardY - pr * 0.075); ctx.lineTo(gW, guardY + pr * 0.075); ctx.lineTo(gW - pr * 0.04, guardY + pr * 0.09); ctx.lineTo(-gW + pr * 0.04, guardY + pr * 0.09); ctx.lineTo(-gW, guardY + pr * 0.075);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(200,175,255,0.70)'; ctx.lineWidth = 0.9; ctx.stroke();

      [-1, 1].forEach(side => {
        const ox = side * gW;
        const og = ctx.createRadialGradient(ox, guardY, 0, ox, guardY, pr * 0.09);
        og.addColorStop(0, 'rgba(210,170,255,0.95)'); og.addColorStop(1, 'rgba(80,0,160,0.25)');
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(ox, guardY, pr * 0.09, 0, Math.PI * 2); ctx.fill();
        const sp = Math.sin(t * 1.2 + side) * 0.4 + 0.6;
        ctx.fillStyle = `rgba(255,240,255,${sp})`; ctx.beginPath(); ctx.arc(ox, guardY, pr * 0.025, 0, Math.PI * 2); ctx.fill();
      });

      const gripTop = guardY + pr * 0.09, gripBot = guardY + hLen, gripW = pr * 0.062;
      const gripG = ctx.createLinearGradient(-gripW, 0, gripW, 0);
      gripG.addColorStop(0, '#1e0c38'); gripG.addColorStop(0.4, '#5e3090'); gripG.addColorStop(0.6, '#4a2075'); gripG.addColorStop(1, '#160826');
      ctx.fillStyle = gripG;
      ctx.beginPath(); ctx.moveTo(-gripW, gripTop); ctx.lineTo(gripW, gripTop); ctx.lineTo(gripW * 0.85, gripBot); ctx.lineTo(-gripW * 0.85, gripBot); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,210,0.6)'; ctx.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) {
        const wy = gripTop + (i + 0.5) * ((gripBot - gripTop) / 5), ww = gripW * (1 - 0.15 * (i / 5));
        ctx.beginPath(); ctx.moveTo(-ww, wy); ctx.lineTo(ww, wy); ctx.stroke();
      }

      const pY = gripBot + pommelR * 1.2, pPulse = Math.sin(t * 0.7) * 0.15 + 0.85;
      const pGlow = ctx.createRadialGradient(0, pY, 0, 0, pY, pommelR * 3 * pPulse);
      pGlow.addColorStop(0, `rgba(190,90,255,${0.45 * pPulse})`); pGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pGlow; ctx.beginPath(); ctx.arc(0, pY, pommelR * 3 * pPulse, 0, Math.PI * 2); ctx.fill();
      const pFill = ctx.createRadialGradient(-pommelR * 0.35, pY - pommelR * 0.35, 0, 0, pY, pommelR);
      pFill.addColorStop(0, '#ceb0ff'); pFill.addColorStop(0.45, '#7040c0'); pFill.addColorStop(1, '#1e0838');
      ctx.fillStyle = pFill; ctx.beginPath(); ctx.arc(0, pY, pommelR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(185,140,255,0.65)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = `rgba(255,240,255,${0.5 * pPulse})`; ctx.beginPath(); ctx.arc(-pommelR * 0.28, pY - pommelR * 0.28, pommelR * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.save(); ctx.translate(cx, cy); ctx.rotate(swAngle);
      const eg = ctx.createRadialGradient(0, -pr, 0, 0, -pr, pr * 0.25);
      eg.addColorStop(0, `rgba(220,180,255,${0.5 + Math.sin(t * 0.9) * 0.15})`); eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0, -pr, pr * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    // ── partículas ────────────────────────────────────────────────────────────
    const spawnParticle = () => {
      const w = W(), h = H();
      const srcs = [[w * 0.60, h * 0.60], [w * 0.15, h * 0.22]];
      const [sx, sy] = srcs[Math.floor(Math.random() * srcs.length)];
      particles.push({ x: sx + rng(-90, 90), y: sy + rng(-90, 90), vx: rng(-0.45, 0.45), vy: rng(-0.55, -0.05), life: 0, maxLife: rng(60, 150), r: rng(0.3, 1.8), purple: Math.random() > 0.38 });
    };

    const drawParticles = () => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (++p.life >= p.maxLife) { particles.splice(i, 1); continue; }
        const a = Math.sin((p.life / p.maxLife) * Math.PI) * 0.88;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.purple ? `rgba(188,95,255,${a})` : `rgba(255,255,255,${a})`; ctx.fill();
      }
    };

    // ── loop principal ─────────────────────────────────────────────────────────
    const frame = () => {
      t += 0.007;
      const w = W(), h = H(), d = dpr();
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawBg();
      drawNebula();
      drawStars();

      if (Math.random() < 0.004) spawnShooter();
      drawShooters();

      drawGalaxies();

      // Planetas estilhaçados — desenhados antes dos planetas principais (ficam atrás)
      drawBrokenPlanets();

      // Planeta 1 — diagonal superior-esquerda, anéis +35°
      drawPlanet(w * 0.15, h * 0.22, Math.min(w, h) * 0.112, {
        light: '#7a6592', dark: '#2a0e48',
        glow: 'rgb(58,0,108)', glowR: Math.min(w, h) * 0.044, glowA: 0.52,
        rotSpeed: 0.38, rotOffset: 0.5,
        surface: SURF1, surfaceLight: 'rgba(130,85,195,0.32)', surfaceDark: 'rgba(8,0,24,0.38)',
        rings: { color: 'rgba(108,58,168,0.68)', alpha: 0.78, tilt: 0.28, angle: Math.PI * 0.22 },
      });

      // Planeta 2 — diagonal centro-direita, anéis -25°
      drawBloom(w * 0.60, h * 0.60, Math.min(w, h) * 0.23);
      drawPlanet(w * 0.60, h * 0.60, Math.min(w, h) * 0.165, {
        light: '#6a2e92', dark: '#2c0056',
        glow: 'rgb(108,0,200)', glowR: Math.min(w, h) * 0.090, glowA: 0.56 + Math.sin(t * 0.38) * 0.09,
        rotSpeed: 0.52, rotOffset: 1.2,
        surface: SURF2, surfaceLight: 'rgba(155,65,235,0.28)', surfaceDark: 'rgba(4,0,18,0.35)',
        rings: { color: 'rgba(128,48,228,0.72)', alpha: 0.88, tilt: 0.24, angle: -Math.PI * 0.20 },
      });

      // Lua orbitando
      const moonA = t * 0.12;
      drawPlanet(
        w * 0.60 + Math.cos(moonA) * Math.min(w, h) * 0.22,
        h * 0.60 + Math.sin(moonA) * Math.min(w, h) * 0.09,
        Math.min(w, h) * 0.021,
        { light: '#998ab8', dark: '#281840', glow: 'rgb(80,30,140)', glowR: Math.min(w, h) * 0.016, glowA: 0.55, rotSpeed: 0.70, rotOffset: 0.8, surface: SURF1.slice(0, 4), surfaceLight: 'rgba(170,140,215,0.30)', surfaceDark: 'rgba(12,4,30,0.35)' },
      );

      drawDebris();
      drawSwordEarth();

      if (Math.random() < 0.38) spawnParticle();
      drawParticles();

      rafId = requestAnimationFrame(frame);
    };

    frame();
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, []);

  return (
    <div style={{ position: fixed ? 'fixed' : 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: fixed ? 1 : 0 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
