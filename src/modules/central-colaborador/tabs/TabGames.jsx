import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { Card, Tag, StarDivider, SHead } from '../../../shared/components';
import { useIsMobile } from '../../../hooks/useIsMobile';

// ── Paleta pixel ──────────────────────────────────────────────────────
const PC = {
  space:'#06101E', star:'#E8D060', meteor:'#A06030', rock:'#4A2A10',
  blue:'#2A82D2', blueDk:'#1A5280', gold:'#D4A843', eye:'#FFFFFF',
  pupil:'#0A1428', green:'#28C870', red:'#D04060', purple:'#9060E0',
  pipe:'#2A1E60', pipeL:'#4030A0', teal:'#20B090',
};

// ── Imagem do UnikoPixel — carregada uma vez ──────────────────────────
const UNIKO_IMG = new Image();
UNIKO_IMG.src = '/UnikoPixel.png';

// ── Utilitário: retângulo com bordas arredondadas ─────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Desenha Uniko com pernas brancas pixel ────────────────────────────
// legAnim > 0 = pernas animadas (corrida), = 0 = parado
function drawUniko(ctx, cx, bot, size, legAnim = 0) {
  const legW  = Math.max(4, Math.round(size * .19));
  const legH  = Math.max(6, Math.round(size * .3));
  const gap   = Math.max(2, Math.round(size * .05));
  const bounce = legAnim ? Math.round(Math.sin(legAnim * .42) * size * .07) : 0;

  // Perna esquerda (sobe quando direita desce)
  ctx.fillStyle = '#EEF2FF';
  ctx.fillRect(cx - gap - legW, bot - legH + bounce, legW, legH - bounce);
  // Sola esquerda
  ctx.fillStyle = '#B0BADA';
  ctx.fillRect(cx - gap - legW - 1, bot - 3, legW + 2, 3);

  // Perna direita
  ctx.fillStyle = '#EEF2FF';
  ctx.fillRect(cx + gap, bot - legH - bounce, legW, legH + bounce);
  // Sola direita
  ctx.fillStyle = '#B0BADA';
  ctx.fillRect(cx + gap - 1, bot - 3, legW + 2, 3);

  // Corpo — UnikoPixel.png
  if (UNIKO_IMG.complete && UNIKO_IMG.naturalHeight) {
    ctx.drawImage(UNIKO_IMG, cx - size / 2, bot - legH - size, size, size);
  } else {
    ctx.fillStyle = '#FFFFFF';
    rrect(ctx, cx - size / 2, bot - legH - size, size, size, 4); ctx.fill();
  }
}

// ── Desenha Uniko voando (sem pernas — Flap e Invaders) ──────────────
function drawUFO(ctx, cx, cy, size) {
  const s = size * 2;
  if (UNIKO_IMG.complete && UNIKO_IMG.naturalHeight) {
    ctx.drawImage(UNIKO_IMG, cx - s / 2, cy - s / 2, s, s);
  } else {
    ctx.fillStyle = '#FFFFFF';
    rrect(ctx, cx - s / 2, cy - s / 2, s, s, 4); ctx.fill();
  }
}

// ── Estrelas fixas ────────────────────────────────────────────────────
function drawStars(ctx, W, H, tick = 0) {
  for (let i = 0; i < 50; i++) {
    const sx = (i * 73 + i * 5) % W;
    const sy = (i * 37 + i * 11) % H;
    const blink = Math.sin(tick * .04 + i) > .7 ? .9 : .45;
    ctx.fillStyle = `rgba(255,255,220,${blink})`;
    ctx.fillRect(sx, sy, i % 6 === 0 ? 2 : 1, i % 6 === 0 ? 2 : 1);
  }
}

// ── Score localStorage ────────────────────────────────────────────────
const getBest = k => { try { return +localStorage.getItem('ug_' + k) || 0; } catch { return 0; } };
const saveBest = (k, v) => { try { if (v > getBest(k)) localStorage.setItem('ug_' + k, v); } catch {} };

// ═══════════════════════════════════════════════════════════════════════
// JOGO 1 — UnikoRun  (corredor infinito com pulo e agachamento)
// Pulo: Espaço / Seta cima / tap metade superior da tela
// Agachar: Seta baixo / S / tap metade inferior da tela
// ═══════════════════════════════════════════════════════════════════════
const UnikoRun = () => {
  const cv = useRef(null);
  useEffect(() => {
    const canvas = cv.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const GY  = H - 48;   // chão
    const UX  = 90;       // x fixo do Uniko
    const US  = 44;       // tamanho base do sprite

    // Alturas de referência para colisão (relativas ao GY)
    const LEG_H     = Math.round(US * .28);  // ≈12 — comprimento das pernas
    const STAND_H   = LEG_H + US;            // ≈56 — altura total em pé
    const DUCK_H    = Math.round(US * .48);  // ≈21 — altura agachado (sem pernas)
    // Obstáculo aéreo: voa entre GY-STAND_H e GY-DUCK_H
    // → bate em pé, passa se agachado
    const AIR_BOT   = GY - Math.round(STAND_H * .70);  // fundo do obstáculo aéreo
    const AIR_H     = 22;                               // altura do alien voador

    const s = {
      started: false, dead: false, tick: 0,
      uy: GY, uvy: 0, onGround: true, ducking: false,
      obs: [], score: 0, speed: 3.5, lastType: 'ground',
    };

    const jump = () => {
      if (!s.started) { s.started = true; return; }
      if (s.dead)     { reset(); return; }
      if (s.onGround && !s.ducking) { s.uvy = -16; s.onGround = false; }
    };
    const duck    = () => { if (s.started && !s.dead && s.onGround) s.ducking = true; };
    const unduck  = () => { s.ducking = false; };
    const reset   = () => {
      Object.assign(s, {
        dead: false, started: true, uy: GY, uvy: 0, onGround: true,
        ducking: false, obs: [], score: 0, speed: 3.5, tick: 0, lastType: 'ground',
      });
    };

    const onKey = e => {
      if (e.code === 'Space' || e.code === 'ArrowUp')   { e.preventDefault(); jump(); }
      if (e.code === 'ArrowDown' || e.code === 'KeyS')  { e.preventDefault(); duck(); }
    };
    const onKeyUp = e => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') unduck();
    };
    const onTouch = e => {
      e.preventDefault();
      if (!s.started || s.dead) { jump(); return; }
      const rect = canvas.getBoundingClientRect();
      const ty = (e.touches[0].clientY - rect.top) * (H / rect.height);
      if (ty > H * .55) duck(); else jump();
    };
    const onTouchEnd = () => unduck();

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('touchstart', onTouch,   { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);
    canvas.addEventListener('mousedown', jump);

    // ── Desenha alien voador (pterodáctilo alienígena) ────────────────
    const drawBird = (x, yBot, w) => {
      const bh = AIR_H;
      const yT = yBot - bh;
      // asa esquerda (2 retângulos)
      ctx.fillStyle = '#7040B8';
      ctx.fillRect(x,            yT + bh*.3,  w*.28, bh*.35);
      ctx.fillRect(x + w*.05,    yT + bh*.05, w*.18, bh*.28);
      // asa direita
      ctx.fillRect(x + w*.72,    yT + bh*.3,  w*.28, bh*.35);
      ctx.fillRect(x + w*.77,    yT + bh*.05, w*.18, bh*.28);
      // corpo
      ctx.fillStyle = '#9060D8';
      ctx.fillRect(x + w*.28,    yT + bh*.1,  w*.44, bh*.75);
      // olhos
      ctx.fillStyle = '#FF3050';
      ctx.fillRect(x + w*.34, yT + bh*.18, w*.12, bh*.22);
      ctx.fillRect(x + w*.54, yT + bh*.18, w*.12, bh*.22);
      // bico
      ctx.fillStyle = '#C8A030';
      ctx.fillRect(x + w*.38, yT + bh*.42, w*.24, bh*.18);
    };

    // ── Desenha Uniko agachado ────────────────────────────────────────
    const drawUnikoDuck = (cx) => {
      const dH = DUCK_H;
      // perninha achatada
      ctx.fillStyle = '#D0D8F0';
      ctx.fillRect(cx - US*.22, GY - 3, US*.19, 3);
      ctx.fillRect(cx + US*.03, GY - 3, US*.19, 3);
      // sprite comprimido verticalmente
      if (UNIKO_IMG.complete && UNIKO_IMG.naturalHeight)
        ctx.drawImage(UNIKO_IMG, cx - US/2, GY - dH, US, dH);
    };

    let raf;
    const loop = () => {
      s.tick++;
      ctx.fillStyle = PC.space; ctx.fillRect(0, 0, W, H);
      drawStars(ctx, W, H, s.tick);

      // chão
      ctx.fillStyle = '#1A3050'; ctx.fillRect(0, GY + 4, W, 4);
      ctx.fillStyle = '#0D2040'; ctx.fillRect(0, GY + 8, W, H - GY - 8);
      ctx.fillStyle = '#1E3A60';
      for (let gx = (s.tick * s.speed) % 44; gx < W; gx += 44)
        ctx.fillRect(gx, GY + 6, 1, 2);

      if (!s.started) {
        drawUniko(ctx, UX, GY, US, s.tick);
        ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('↑ ESPAÇO para pular  |  ↓ S para agachar', W/2, H/2 - 8);
        ctx.fillText('No celular: toque em cima para pular, embaixo para agachar', W/2, H/2 + 10);
        raf = requestAnimationFrame(loop); return;
      }

      if (!s.dead) {
        s.score += .1;
        s.speed = Math.min(11, 3.5 + s.score * .016);

        // física
        if (!s.ducking) {
          s.uvy += .72; s.uy += s.uvy;
          if (s.uy >= GY) { s.uy = GY; s.uvy = 0; s.onGround = true; }
          else s.onGround = false;
        } else {
          s.uy = GY; s.uvy = 0; s.onGround = true;
        }

        // gera obstáculos (chão e aéreo misturados)
        const last = s.obs[s.obs.length - 1];
        const gap  = 240 + Math.random() * 200;
        if (!last || last.x < W - gap) {
          // aéreo só após score 18 e nunca dois seguidos
          const canAir = s.score > 18 && s.lastType !== 'air';
          const isAir  = canAir && Math.random() < .38;
          if (isAir) {
            const bw = 28 + Math.random() * 16;
            s.obs.push({ x: W + 20, w: bw, type: 'air' });
            s.lastType = 'air';
          } else {
            const oh = 22 + Math.random() * 22;
            const ow = 15 + Math.random() * 9;
            s.obs.push({ x: W + 20, w: ow, h: oh, type: 'ground', eye: Math.random() > .5 });
            s.lastType = 'ground';
          }
        }
        for (const o of s.obs) o.x -= s.speed;
        s.obs = s.obs.filter(o => o.x > -60);

        // colisão
        for (const o of s.obs) {
          if (o.type === 'ground') {
            const hitX = o.x < UX + US*.30 && o.x + o.w > UX - US*.30;
            const hitY = s.uy > GY - o.h + 5;       // pés abaixo do topo da rocha
            if (hitX && hitY) { s.dead = true; saveBest('run', Math.floor(s.score)); }
          } else {
            // obstáculo aéreo: acerta em pé, passa se agachado
            const hitX = o.x < UX + US*.38 && o.x + o.w > UX - US*.38;
            const bodyTop = s.ducking ? (GY - DUCK_H) : (s.uy - STAND_H);
            // colide se o corpo do Uniko sobrepõe o range [AIR_BOT-AIR_H , AIR_BOT]
            const hitY = bodyTop < AIR_BOT && s.uy > (AIR_BOT - AIR_H);
            if (hitX && hitY) { s.dead = true; saveBest('run', Math.floor(s.score)); }
          }
        }
      }

      // desenha obstáculos
      for (const o of s.obs) {
        if (o.type === 'ground') {
          ctx.fillStyle = PC.meteor;
          rrect(ctx, o.x, GY - o.h, o.w, o.h, 3); ctx.fill();
          ctx.fillStyle = PC.rock;
          ctx.fillRect(o.x + 3, GY - o.h + 4, o.w - 6, 3);
          if (o.eye) { ctx.fillStyle = PC.red; ctx.fillRect(o.x + o.w/2 - 4, GY - o.h + 9, 8, 5); }
        } else {
          drawBird(o.x, AIR_BOT, o.w);
        }
      }

      // desenha Uniko (agachado ou normal)
      if (s.ducking && s.onGround) drawUnikoDuck(UX);
      else drawUniko(ctx, UX, s.uy, US, s.onGround ? s.tick : 0);

      // HUD
      ctx.fillStyle = PC.gold; ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.floor(s.score), W - 18, 28);
      ctx.textAlign = 'left'; ctx.fillStyle = '#4A7090'; ctx.font = '10px monospace';
      ctx.fillText('BEST ' + getBest('run'), 18, 28);

      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W/2, H/2 - 24);
        ctx.font = '14px monospace';
        ctx.fillText('Pontuação: ' + Math.floor(s.score), W/2, H/2 + 8);
        ctx.fillStyle = PC.gold;
        ctx.fillText('Toque ou ESPAÇO para reiniciar', W/2, H/2 + 34);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup',   onKeyUp);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchend',   onTouchEnd);
      canvas.removeEventListener('mousedown',  jump);
    };
  }, []);
  return <canvas ref={cv} width={860} height={320} style={{ display: 'block', borderRadius: 10, maxWidth: '100%', touchAction: 'none' }} />;
};

// ═══════════════════════════════════════════════════════════════════════
// JOGO 2 — Meteor Storm (desviar de meteoros)
// ═══════════════════════════════════════════════════════════════════════
const MeteorStorm = () => {
  const cv = useRef(null);
  useEffect(() => {
    const canvas = cv.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const US = 34;
    const SPEED = 4;

    const s = {
      ux: W / 2, speed: 0,
      meteors: [], stars: [],
      score: 0, lives: 5, dead: false, started: false, tick: 0,
      keys: {}, touchX: null,
    };

    const start = () => { if (!s.started) s.started = true; };
    const reset = () => {
      s.ux = W / 2; s.meteors = []; s.stars = [];
      s.score = 0; s.lives = 5; s.dead = false; s.started = true; s.tick = 0;
    };

    const onKey = e => {
      s.keys[e.code] = e.type === 'keydown';
      if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')
        e.preventDefault();
      if (s.dead && e.type === 'keydown') reset();
      if (!s.started && e.type === 'keydown') start();
    };
    const onTouch = e => {
      e.preventDefault();
      if (s.dead) { reset(); return; }
      if (!s.started) { start(); return; }
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      s.touchX = (touch.clientX - rect.left) * (W / rect.width);
    };
    const onTouchEnd = () => { s.touchX = null; };
    const onMouse = e => {
      if (!s.started) { start(); return; }
      const rect = canvas.getBoundingClientRect();
      s.touchX = (e.clientX - rect.left) * (W / rect.width);
    };
    const onMouseUp = () => { s.touchX = null; };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('mousedown', onMouse);
    canvas.addEventListener('mouseup', onMouseUp);

    let raf;
    const loop = () => {
      s.tick++;
      ctx.fillStyle = PC.space; ctx.fillRect(0, 0, W, H);
      drawStars(ctx, W, H, s.tick);

      if (!s.started) {
        drawUniko(ctx, s.ux, H - 20, US, 0);
        ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SETAS ou arraste para mover', W / 2, H / 2 - 8);
        ctx.fillText('Desvie dos meteoros!', W / 2, H / 2 + 12);
        raf = requestAnimationFrame(loop); return;
      }

      if (!s.dead) {
        s.score += .06;
        const spd = Math.min(10, SPEED + s.score * .04);

        // movimento por teclado ou touch
        if (s.keys['ArrowLeft'] || s.keys['KeyA']) s.ux -= 4;
        if (s.keys['ArrowRight'] || s.keys['KeyD']) s.ux += 4;
        if (s.touchX !== null) {
          s.ux += (s.touchX - s.ux) * .18;
        }
        s.ux = Math.max(US, Math.min(W - US, s.ux));

        // gera meteoros — mais espaçados e mais lentos
        if (s.tick % Math.max(40, 90 - Math.floor(s.score * .3)) === 0) {
          const mx = 20 + Math.random() * (W - 40);
          const ms = 10 + Math.random() * 10;
          s.meteors.push({ x: mx, y: -20, r: ms,
            vx: (Math.random() - .5) * .8, vy: spd * (.4 + Math.random() * .4) });
        }
        // gera estrelas coletáveis
        if (s.tick % 60 === 0) {
          s.stars.push({ x: 20 + Math.random() * (W - 40), y: -10, vy: 2.2 });
        }

        for (const m of s.meteors) { m.y += m.vy; m.x += m.vx; }
        for (const st of s.stars) st.y += st.vy;
        s.meteors = s.meteors.filter(m => m.y < H + 30);
        s.stars   = s.stars.filter(st => st.y < H + 20);

        // colisão meteoros — hitbox mais generosa
        for (const m of s.meteors) {
          const dx = m.x - s.ux, dy = m.y - (H - 20 - US / 2);
          if (Math.sqrt(dx * dx + dy * dy) < m.r + US * .25) {
            s.meteors = s.meteors.filter(x => x !== m);
            s.lives--;
            if (s.lives <= 0) { s.dead = true; saveBest('meteor', Math.floor(s.score * 10)); }
          }
        }
        // coleta estrelas
        for (const st of s.stars) {
          const dx = st.x - s.ux, dy = st.y - (H - 20 - US / 2);
          if (Math.sqrt(dx * dx + dy * dy) < 20) {
            s.stars = s.stars.filter(x => x !== st);
            s.score += 2;
          }
        }
      }

      // desenha estrelas coletáveis
      for (const st of s.stars) {
        ctx.fillStyle = PC.star;
        ctx.beginPath(); ctx.arc(st.x, st.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(st.x - 1, st.y - 5, 2, 10);
        ctx.fillRect(st.x - 5, st.y - 1, 10, 2);
      }

      // desenha meteoros
      for (const m of s.meteors) {
        ctx.fillStyle = PC.meteor;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PC.rock;
        ctx.beginPath(); ctx.arc(m.x - m.r * .2, m.y - m.r * .2, m.r * .35, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#AA8060';
        ctx.beginPath(); ctx.arc(m.x + m.r * .25, m.y + m.r * .2, m.r * .2, 0, Math.PI * 2); ctx.fill();
      }

      // uniko
      drawUniko(ctx, s.ux, H - 20, US, s.tick);

      // HUD
      ctx.textAlign = 'left'; ctx.fillStyle = PC.gold; ctx.font = 'bold 14px monospace';
      ctx.fillText(Math.floor(s.score * 10), 16, 26);
      ctx.fillStyle = '#4A7090'; ctx.font = '10px monospace';
      ctx.fillText('BEST ' + getBest('meteor'), 16, 42);
      for (let i = 0; i < s.lives; i++) {
        ctx.fillStyle = PC.red;
        ctx.beginPath(); ctx.arc(W - 20 - i * 20, 20, 7, 0, Math.PI * 2); ctx.fill();
      }

      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 22);
        ctx.font = '13px monospace';
        ctx.fillText('Pontuação: ' + Math.floor(s.score * 10), W / 2, H / 2 + 6);
        ctx.fillStyle = PC.gold;
        ctx.fillText('Toque ou ESPAÇO para reiniciar', W / 2, H / 2 + 30);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      ['touchstart','touchmove','touchend','mousemove','mousedown','mouseup']
        .forEach((ev, i) => canvas.removeEventListener(ev, [onTouch,onTouch,onTouchEnd,onMouse,onMouse,onMouseUp][i]));
    };
  }, []);
  return <canvas ref={cv} width={640} height={700} style={{ display: 'block', borderRadius: 10, maxWidth: '100%', touchAction: 'none', cursor: 'none' }} />;
};

// ═══════════════════════════════════════════════════════════════════════
// JOGO 3 — Alien Invaders (space invaders mini com o Uniko como herói)
// ═══════════════════════════════════════════════════════════════════════
const AlienInvaders = () => {
  const cv = useRef(null);
  useEffect(() => {
    const canvas = cv.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const COLS = 7, ROWS = 3;
    const buildAliens = () => {
      const a = [];
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          a.push({ x: 60 + c * 46, y: 55 + r * 42, alive: true, r, c });
      return a;
    };

    const s = {
      ux: W / 2, bullets: [], enemyBullets: [],
      aliens: buildAliens(), dir: 1,
      score: 0, lives: 5, dead: false, win: false, started: false, tick: 0,
      keys: {}, level: 1, canShoot: true, shotCooldown: 0,
      alienMoveTimer: 0, alienDir: 1,
    };

    const shoot = () => {
      if (s.canShoot && !s.dead && !s.win && s.started) {
        s.bullets.push({ x: s.ux, y: H - 55, vy: -12 });
        s.canShoot = false;
        s.shotCooldown = 10;  // cooldown menor = atira mais rápido
      }
    };

    const onKey = e => {
      s.keys[e.code] = e.type === 'keydown';
      if (e.code === 'Space') { e.preventDefault(); if (e.type === 'keydown') shoot(); }
      if (!s.started && e.type === 'keydown') s.started = true;
      if ((s.dead || s.win) && e.type === 'keydown') {
        s.aliens = buildAliens(); s.bullets = []; s.enemyBullets = [];
        s.ux = W / 2; s.score = 0; s.lives = 5; s.dead = false; s.win = false;
        s.level = 1; s.alienDir = 1; s.tick = 0;
      }
    };
    const onTouch = e => {
      e.preventDefault();
      if (!s.started) { s.started = true; return; }
      if (s.dead || s.win) {
        s.aliens = buildAliens(); s.bullets = []; s.enemyBullets = [];
        s.ux = W / 2; s.score = 0; s.lives = 5; s.dead = false; s.win = false;
        s.level = 1; s.tick = 0; return;
      }
      const rect = canvas.getBoundingClientRect();
      const tx = (e.touches[0].clientX - rect.left) * (W / rect.width);
      if (tx < W / 2 - 20) s.keys['ArrowLeft'] = true;
      else if (tx > W / 2 + 20) s.keys['ArrowRight'] = true;
      else shoot();
    };
    const onTouchEnd = () => { s.keys['ArrowLeft'] = false; s.keys['ArrowRight'] = false; };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // desenha alien inimigo (pixelado)
    const drawAlien = (ctx, x, y, size, row, tick) => {
      const colors = [PC.red, PC.purple, PC.teal];
      ctx.fillStyle = colors[row % 3];
      const bob = Math.floor(tick / 20) % 2;
      // corpo oval
      rrect(ctx, x - size * .5, y - size * .4 + bob, size, size * .8, size * .25); ctx.fill();
      // olhos brilhantes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - size * .3, y - size * .15 + bob, size * .22, size * .2);
      ctx.fillRect(x + size * .08, y - size * .15 + bob, size * .22, size * .2);
      ctx.fillStyle = '#000';
      ctx.fillRect(x - size * .22, y - size * .1 + bob, size * .1, size * .1);
      ctx.fillRect(x + size * .12, y - size * .1 + bob, size * .1, size * .1);
      // tentáculos
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = colors[row % 3];
        ctx.fillRect(x + i * size * .3, y + size * .38 + bob, size * .12, size * .22 + (i === 0 ? 4 : 0));
      }
    };

    let raf;
    const loop = () => {
      s.tick++;
      ctx.fillStyle = PC.space; ctx.fillRect(0, 0, W, H);
      drawStars(ctx, W, H, s.tick);

      if (!s.started) {
        // preview
        for (let i = 0; i < 3; i++) drawAlien(ctx, 80 + i * 90, H / 2 - 20, 22, i, s.tick);
        drawUFO(ctx, W / 2, H - 60, 20);
        ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
        ctx.fillText('← → para mover  |  ESPAÇO para atirar', W / 2, H - 20);
        ctx.fillText('Toque: esq/dir para mover, centro para atirar', W / 2, H - 4);
        raf = requestAnimationFrame(loop); return;
      }

      if (!s.dead && !s.win) {
        // movimento Uniko
        if (s.keys['ArrowLeft'] || s.keys['KeyA']) s.ux = Math.max(26, s.ux - 4);
        if (s.keys['ArrowRight'] || s.keys['KeyD']) s.ux = Math.min(W - 26, s.ux + 4);

        // cooldown tiro
        if (s.shotCooldown > 0) s.shotCooldown--;
        else s.canShoot = true;


        // move balas do jogador
        for (const b of s.bullets) b.y += b.vy;
        s.bullets = s.bullets.filter(b => b.y > -10);

        // move balas inimigas
        for (const b of s.enemyBullets) b.y += b.vy;
        s.enemyBullets = s.enemyBullets.filter(b => b.y < H + 10);

        // move alienígenas em bloco — velocidade reduzida
        const speed = .4 + s.level * .18;
        s.alienMoveTimer += speed;
        if (s.alienMoveTimer >= 1) {
          s.alienMoveTimer = 0;
          const alive = s.aliens.filter(a => a.alive);
          if (!alive.length) { s.win = true; }
          else {
            const maxX = Math.max(...alive.map(a => a.x));
            const minX = Math.min(...alive.map(a => a.x));
            if ((s.alienDir > 0 && maxX > W - 40) || (s.alienDir < 0 && minX < 40)) {
              s.alienDir *= -1;
              for (const a of s.aliens) a.y += 8;  // desce menos a cada virada
            }
            for (const a of s.aliens) a.x += s.alienDir;
          }
        }

        // tiro inimigo — cadência bem mais lenta
        const alive = s.aliens.filter(a => a.alive);
        if (alive.length && s.tick % Math.max(70, 140 - s.level * 10) === 0) {
          const shooter = alive[Math.floor(Math.random() * alive.length)];
          s.enemyBullets.push({ x: shooter.x, y: shooter.y + 16, vy: 3 + s.level * .3 });
        }

        // colisão bala jogador × alien
        for (const b of s.bullets) {
          for (const a of s.aliens) {
            if (a.alive && Math.abs(b.x - a.x) < 18 && Math.abs(b.y - a.y) < 18) {
              a.alive = false;
              s.bullets = s.bullets.filter(x => x !== b);
              s.score += 10 * s.level;
              break;
            }
          }
        }
        // colisão bala inimiga × jogador
        for (const b of s.enemyBullets) {
          if (Math.abs(b.x - s.ux) < 20 && Math.abs(b.y - (H - 55)) < 20) {
            s.enemyBullets = s.enemyBullets.filter(x => x !== b);
            s.lives--;
            if (s.lives <= 0) { s.dead = true; saveBest('invaders', s.score); }
          }
        }
        // aliens chegaram na base
        if (s.aliens.filter(a => a.alive).some(a => a.y > H - 90)) {
          s.dead = true; saveBest('invaders', s.score);
        }
        // vitória
        if (!s.aliens.find(a => a.alive)) {
          s.level++;
          s.aliens = buildAliens();
          s.bullets = []; s.enemyBullets = [];
          s.win = false; // continua
          s.score += 100 * s.level;
        }
      }

      // desenha alienígenas
      for (const a of s.aliens) {
        if (!a.alive) continue;
        drawAlien(ctx, a.x, a.y, 20, a.r, s.tick);
      }

      // balas jogador
      ctx.fillStyle = PC.gold;
      for (const b of s.bullets) {
        ctx.fillRect(b.x - 2, b.y - 6, 4, 10);
        ctx.fillStyle = '#FFFFA0';
        ctx.fillRect(b.x - 1, b.y - 8, 2, 4);
        ctx.fillStyle = PC.gold;
      }

      // balas inimigas
      ctx.fillStyle = PC.red;
      for (const b of s.enemyBullets) {
        ctx.fillRect(b.x - 2, b.y - 5, 4, 10);
      }

      // uniko UFO
      drawUFO(ctx, s.ux, H - 55, 20);

      // HUD
      ctx.textAlign = 'left'; ctx.fillStyle = PC.gold; ctx.font = 'bold 14px monospace';
      ctx.fillText(s.score, 14, 26);
      ctx.fillStyle = '#4A7090'; ctx.font = '10px monospace';
      ctx.fillText('BEST ' + getBest('invaders'), 14, 40);
      ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText('FASE ' + s.level, W / 2, 22);
      for (let i = 0; i < s.lives; i++) {
        ctx.fillStyle = PC.red;
        ctx.beginPath(); ctx.arc(W - 16 - i * 22, 20, 7, 0, Math.PI * 2); ctx.fill();
      }

      if (s.dead || s.win) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = s.win ? PC.gold : '#fff';
        ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText(s.win ? 'VITÓRIA!' : 'GAME OVER', W / 2, H / 2 - 22);
        ctx.fillStyle = '#fff'; ctx.font = '13px monospace';
        ctx.fillText('Pontuação: ' + s.score, W / 2, H / 2 + 6);
        ctx.fillStyle = PC.gold;
        ctx.fillText('Toque ou ESPAÇO para reiniciar', W / 2, H / 2 + 30);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);
  return <canvas ref={cv} width={660} height={700} style={{ display: 'block', borderRadius: 10, maxWidth: '100%', touchAction: 'none' }} />;
};

// ═══════════════════════════════════════════════════════════════════════
// JOGO 4 — UnikoFlap (Flappy Bird com o Uniko UFO em campo de asteroides)
// ═══════════════════════════════════════════════════════════════════════
const UnikoFlap = () => {
  const cv = useRef(null);
  useEffect(() => {
    const canvas = cv.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const GAP = 270, PIPE_W = 38, PIPE_SPEED = 1.5;

    const s = {
      y: H / 2, vy: 0, started: false, dead: false,
      pipes: [], score: 0, tick: 0,
    };

    const flap = () => {
      if (!s.started) { s.started = true; s.vy = -6; return; }
      if (s.dead) {
        s.y = H / 2; s.vy = 0; s.pipes = [];
        s.score = 0; s.dead = false; s.started = false; s.tick = 0;
        return;
      }
      s.vy = -6;
    };

    const onKey = e => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); } };
    const onTouch = e => { e.preventDefault(); flap(); };
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('mousedown', flap);

    // desenha asteroide-tubo
    const drawAsteroidPipe = (x, topH, botY) => {
      // tubo superior
      const grad1 = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
      grad1.addColorStop(0, PC.pipe); grad1.addColorStop(.5, PC.pipeL); grad1.addColorStop(1, PC.pipe);
      ctx.fillStyle = grad1;
      ctx.fillRect(x, 0, PIPE_W, topH);
      // borda inferior do tubo superior
      ctx.fillStyle = PC.pipeL;
      ctx.fillRect(x - 4, topH - 14, PIPE_W + 8, 14);
      // crateras
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.arc(x + 14, topH - 30, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 30, topH - 60, 5, 0, Math.PI * 2); ctx.fill();

      // tubo inferior
      ctx.fillStyle = grad1;
      ctx.fillRect(x, botY, PIPE_W, H - botY);
      ctx.fillStyle = PC.pipeL;
      ctx.fillRect(x - 4, botY, PIPE_W + 8, 14);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.arc(x + 18, botY + 30, 7, 0, Math.PI * 2); ctx.fill();
    };

    let raf;
    const loop = () => {
      s.tick++;
      ctx.fillStyle = PC.space; ctx.fillRect(0, 0, W, H);
      drawStars(ctx, W, H, s.tick);

      if (!s.started) {
        drawUFO(ctx, W / 2, s.y + Math.sin(s.tick * .04) * 6, 22);
        ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ESPAÇO ou toque para voar!', W / 2, H / 2 + 70);
        raf = requestAnimationFrame(loop); return;
      }

      if (!s.dead) {
        s.vy += .20; s.y += s.vy;

        // gera pipes — distância bem maior entre eles
        if (s.pipes.length === 0 || s.pipes[s.pipes.length - 1].x < W - 310) {
          const topH = 60 + Math.random() * (H - GAP - 120);
          s.pipes.push({ x: W + PIPE_W, topH, botY: topH + GAP, passed: false });
        }
        for (const p of s.pipes) p.x -= PIPE_SPEED;
        s.pipes = s.pipes.filter(p => p.x > -PIPE_W - 10);

        // score
        for (const p of s.pipes) {
          if (!p.passed && p.x + PIPE_W < 60) {
            p.passed = true; s.score++;
            saveBest('flap', s.score);
          }
        }

        // colisão — hitbox reduzida (mais perdoadora)
        const ux = 60, ur = 15;
        if (s.y - ur < 0 || s.y + ur > H) { s.dead = true; saveBest('flap', s.score); }
        for (const p of s.pipes) {
          const inX = ux + ur > p.x + 4 && ux - ur < p.x + PIPE_W - 4;
          if (inX && (s.y - ur < p.topH + 4 || s.y + ur > p.botY - 4)) {
            s.dead = true; saveBest('flap', s.score);
          }
        }
      }

      // pipes
      for (const p of s.pipes) drawAsteroidPipe(p.x, p.topH, p.botY);

      // UFO Uniko
      const wobble = s.vy * .15;
      drawUFO(ctx, 60, s.y, 22);
      // rastro do UFO
      ctx.fillStyle = `rgba(${s.vy < 0 ? '100,180,255' : '255,200,50'},.35)`;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(60, s.y + i * 7 * (s.vy < 0 ? 1 : -1), 6 - i, 0, Math.PI * 2);
        ctx.fill();
      }

      // HUD
      ctx.textAlign = 'center'; ctx.fillStyle = PC.gold; ctx.font = 'bold 22px monospace';
      ctx.fillText(s.score, W / 2, 36);
      ctx.fillStyle = '#4A7090'; ctx.font = '10px monospace';
      ctx.fillText('BEST ' + getBest('flap'), W / 2, 52);

      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 22);
        ctx.font = '14px monospace';
        ctx.fillText('Pontuação: ' + s.score, W / 2, H / 2 + 6);
        ctx.fillStyle = PC.gold;
        ctx.fillText('Toque ou ESPAÇO para reiniciar', W / 2, H / 2 + 30);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', flap);
    };
  }, []);
  return <canvas ref={cv} width={600} height={720} style={{ display: 'block', borderRadius: 10, maxWidth: '100%', touchAction: 'none' }} />;
};

// ═══════════════════════════════════════════════════════════════════════
// LOBBY — Grade de jogos
// ═══════════════════════════════════════════════════════════════════════
const GAMES = [
  {
    id: 'run', label: 'UnikoRun', tag: 'Corredor', tagColor: '#2A82D2',
    desc: 'Uniko corre pelo espaço. Pule sobre as rochas alienígenas e sobreviva o máximo que puder!',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#06101E"/>
        <rect x="6" y="22" width="24" height="3" fill="#1A3050"/>
        <rect x="6" y="10" width="8" height="10" rx="2" fill="#2A82D2"/>
        <rect x="8" y="8" width="5" height="4" rx="1" fill="#2A82D2"/>
        <rect x="9" y="9" width="2" height="2" fill="#fff"/>
        <rect x="11" y="9" width="2" height="2" fill="#fff"/>
        <rect x="21" y="15" width="5" height="7" rx="1" fill="#8B6840"/>
        <rect x="27" y="17" width="4" height="5" rx="1" fill="#8B6840"/>
      </svg>
    ),
    Component: UnikoRun, bestKey: 'run', wide: true,
  },
  {
    id: 'meteor', label: 'Meteor Storm', tag: 'Desvio', tagColor: '#C04050',
    desc: 'Meteoros caem do espaço! Mova o Uniko para desviar e colete estrelas douradas.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#06101E"/>
        <circle cx="14" cy="12" r="6" fill="#8B6840"/>
        <circle cx="12" cy="10" r="2" fill="#5A3A1A"/>
        <circle cx="25" cy="20" r="4" fill="#8B6840"/>
        <rect x="14" y="26" width="8" height="6" rx="2" fill="#2A82D2"/>
        <rect x="16" y="24" width="4" height="3" rx="1" fill="#2A82D2"/>
        <rect x="16" y="25" width="2" height="2" fill="#fff"/>
        <rect x="18" y="25" width="2" height="2" fill="#fff"/>
        <polygon points="28,8 30,4 32,8" fill="#E8D060"/>
      </svg>
    ),
    Component: MeteorStorm, bestKey: 'meteor', wide: false,
  },
  {
    id: 'invaders', label: 'Alien Invaders', tag: 'Shooter', tagColor: '#8B5FD8',
    desc: 'Invasão alienígena! Controle o UFO do Uniko e destrua as hordas inimigas.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#06101E"/>
        <rect x="6" y="7" width="6" height="5" rx="2" fill="#C04050"/>
        <rect x="7" y="8" width="2" height="2" fill="#fff"/><rect x="9" y="8" width="2" height="2" fill="#fff"/>
        <rect x="15" y="7" width="6" height="5" rx="2" fill="#8B5FD8"/>
        <rect x="16" y="8" width="2" height="2" fill="#fff"/><rect x="18" y="8" width="2" height="2" fill="#fff"/>
        <rect x="24" y="7" width="6" height="5" rx="2" fill="#20B090"/>
        <rect x="25" y="8" width="2" height="2" fill="#fff"/><rect x="27" y="8" width="2" height="2" fill="#fff"/>
        <rect x="6" y="16" width="6" height="5" rx="2" fill="#C04050"/>
        <rect x="15" y="16" width="6" height="5" rx="2" fill="#8B5FD8"/>
        <rect x="24" y="16" width="6" height="5" rx="2" fill="#20B090"/>
        <ellipse cx="18" cy="30" rx="7" ry="3" fill="#1A5280"/>
        <ellipse cx="18" cy="28" rx="5" ry="2" fill="#2A82D2"/>
        <rect x="17" y="24" width="2" height="4" fill="#D4A843"/>
      </svg>
    ),
    Component: AlienInvaders, bestKey: 'invaders', wide: false,
  },
  {
    id: 'flap', label: 'UnikoFlap', tag: 'Arcade', tagColor: '#28A870',
    desc: 'Pilote o UFO do Uniko pelos campos de asteroides. Um toque para subir!',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#06101E"/>
        <rect x="0" y="6" width="12" height="24" rx="2" fill="#3A2870"/>
        <rect x="24" y="4" width="12" height="18" rx="2" fill="#3A2870"/>
        <rect x="-2" y="18" width="14" height="4" rx="1" fill="#5040A8"/>
        <rect x="22" y="16" width="14" height="4" rx="1" fill="#5040A8"/>
        <ellipse cx="18" cy="19" rx="7" ry="3" fill="#1A5280"/>
        <ellipse cx="18" cy="17" rx="5" ry="2" fill="#2A82D2"/>
        <rect x="17" y="13" width="2" height="4" fill="#D4A843"/>
        <rect x="15" y="12" width="6" height="3" rx="1" fill="#4AAAE8"/>
        <circle cx="16" cy="17" r="1" fill="#FFD700"/>
        <circle cx="18" cy="18" r="1" fill="#FF4444"/>
        <circle cx="20" cy="17" r="1" fill="#44FF88"/>
      </svg>
    ),
    Component: UnikoFlap, bestKey: 'flap', wide: false,
  },
];


const TabGames = () => {
  const isMobile = useIsMobile();
  const [active, setActive] = useState(null); // game id
  const [, rerender] = useState(0);

  const game = GAMES.find(g => g.id === active);

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <SHead sub="Entretenimento alienígena — temática Uniko">Games</SHead>

      {/* Jogos novos */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {GAMES.map(g => (
          <Card key={g.id} style={{ padding: '22px 24px', cursor: 'pointer', transition: 'transform .12s' }} elevated
            onClick={() => setActive(g.id)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ borderRadius: 10, overflow: 'hidden', boxShadow: `0 4px 12px rgba(0,0,0,.3)` }}>{g.icon}</div>
              <Tag color={g.tagColor}>{g.tag}</Tag>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>{g.label}</div>
            <div style={{ fontSize: 13, color: T.textS, lineHeight: 1.5, marginBottom: 12 }}>{g.desc}</div>
            <StarDivider my={8} dim />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: T.textD }}>
                Recorde: <strong style={{ color: g.tagColor }}>{getBest(g.bestKey) || '—'}</strong>
              </span>
              <button onClick={e => { e.stopPropagation(); setActive(g.id); rerender(n => n + 1); }}
                style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg,${g.tagColor},${g.tagColor}bb)`,
                  color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)' }}>
                ▶ Jogar
              </button>
            </div>
          </Card>
        ))}
      </div>


      {/* Overlay do jogo ativo */}
      {active && game && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, width: '100%', maxWidth: 780, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ borderRadius: 8, overflow: 'hidden' }}>{game.icon}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{game.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>{game.tag}</div>
              </div>
            </div>
            <button onClick={() => { setActive(null); rerender(n => n + 1); }}
              style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,.2)',
                background: 'rgba(255,255,255,.08)', cursor: 'pointer', color: '#fff', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>
              ✕
            </button>
          </div>

          {/* Canvas do jogo */}
          <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.6)',
            maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <game.Component key={active} />
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>
            {active === 'run' && '↑ ESPAÇO para pular  •  ↓ S para agachar  |  celular: toque em cima = pular, embaixo = agachar'}
            {active === 'meteor' && '← → para mover • arraste no celular'}
            {active === 'invaders' && '← → para mover • ESPAÇO para atirar • toque: esq/dir/centro'}
            {active === 'flap' && 'ESPAÇO / tap para subir'}
          </div>
        </div>
      )}
    </div>
  );
};

export { TabGames };
