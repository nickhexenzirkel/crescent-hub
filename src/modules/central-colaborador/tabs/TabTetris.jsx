// Uniko Tetris — jogo de blocos em estilo pixel, dentro do Portal do Colaborador.
// Teclado: ← → mover · ↓ descer · ↑ ou X girar · Z girar ao contrário · Espaço queda rápida · P pausar.
// No celular: botões na tela. Melhor pontuação guardada no navegador. Regras em tetrisLogic.js.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import {
  COLS, ROWS, PECAS, criarTabuleiro, colide, fixar, limparLinhas, pontosPorLinhas,
  nivelPorLinhas, velocidade, sacoDePecas, girarComChute,
} from './tetrisLogic';

const CELULA = 24;
const CORES = ['', '#22d3ee', '#facc15', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#fb923c'];
const MELHOR_KEY = 'uniko_tetris_melhor';

const lerMelhor = () => { try { return Number(localStorage.getItem(MELHOR_KEY)) || 0; } catch { return 0; } };

// Quadradinho "pixel": cor cheia + brilho em cima/esquerda + sombra embaixo/direita.
function desenhaBloco(ctx, x, y, cor, tam = CELULA, alfa = 1) {
  ctx.globalAlpha = alfa;
  ctx.fillStyle = cor; ctx.fillRect(x, y, tam, tam);
  ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fillRect(x, y, tam, 3); ctx.fillRect(x, y, 3, tam);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y + tam - 3, tam, 3); ctx.fillRect(x + tam - 3, y, 3, tam);
  ctx.globalAlpha = 1;
}

export const TabTetris = () => {
  const campoRef = useRef(null), proximaRef = useRef(null);
  // Estado do jogo fica em ref (muda a cada quadro); a tela só é atualizada quando algo "de placar" muda.
  const jogo = useRef(null);
  const [ui, setUi] = useState({ pontos: 0, linhas: 0, nivel: 1, fim: false, pausado: false, comecou: false, melhor: lerMelhor() });

  const sincroniza = useCallback(() => {
    const g = jogo.current;
    setUi(u => ({ ...u, pontos: g.pontos, linhas: g.linhas, nivel: g.nivel, fim: g.fim, pausado: g.pausado, comecou: g.comecou, melhor: g.melhor }));
  }, []);

  const nova = useCallback((peca) => {
    const m = PECAS[peca].m.map(l => [...l]);
    return { nome: peca, m, cor: PECAS[peca].cor, x: Math.floor((COLS - m[0].length) / 2), y: m.length > 2 && peca === 'I' ? -1 : 0 };
  }, []);

  const proximaDaFila = useCallback((g) => { if (g.fila.length < 2) g.fila.push(...sacoDePecas()); return g.fila.shift(); }, []);

  const iniciar = useCallback(() => {
    const g = { tab: criarTabuleiro(), fila: [], pontos: 0, linhas: 0, nivel: 1, fim: false, pausado: false, comecou: true, acum: 0, melhor: lerMelhor() };
    g.peca = nova(proximaDaFila(g));
    g.proxima = proximaDaFila(g);
    jogo.current = g;
    sincroniza();
  }, [nova, proximaDaFila, sincroniza]);

  // Peça travou: cola, limpa linhas, pontua e traz a próxima (fim de jogo se não couber).
  const travar = useCallback(() => {
    const g = jogo.current;
    g.tab = fixar(g.tab, g.peca.m, g.peca.x, g.peca.y, g.peca.cor);
    const r = limparLinhas(g.tab);
    g.tab = r.tab; g.linhas += r.linhas;
    g.pontos += pontosPorLinhas(r.linhas, g.nivel);
    g.nivel = nivelPorLinhas(g.linhas);
    g.peca = nova(g.proxima); g.proxima = proximaDaFila(g);
    if (colide(g.tab, g.peca.m, g.peca.x, g.peca.y)) {
      g.fim = true;
      if (g.pontos > g.melhor) { g.melhor = g.pontos; try { localStorage.setItem(MELHOR_KEY, String(g.pontos)); } catch { /* sem storage */ } }
    }
    sincroniza();
  }, [nova, proximaDaFila, sincroniza]);

  const mover = useCallback((dx) => {
    const g = jogo.current; if (!g || g.fim || g.pausado || !g.comecou) return;
    if (!colide(g.tab, g.peca.m, g.peca.x + dx, g.peca.y)) g.peca.x += dx;
  }, []);
  const descer = useCallback((manual = true) => {
    const g = jogo.current; if (!g || g.fim || g.pausado || !g.comecou) return;
    if (!colide(g.tab, g.peca.m, g.peca.x, g.peca.y + 1)) { g.peca.y += 1; if (manual) { g.pontos += 1; sincroniza(); } }
    else travar();
  }, [travar, sincroniza]);
  const girar = useCallback((dir = 1) => {
    const g = jogo.current; if (!g || g.fim || g.pausado || !g.comecou) return;
    const r = girarComChute(g.tab, g.peca.m, g.peca.x, g.peca.y, dir);
    if (r) { g.peca.m = r.m; g.peca.x = r.x; }
  }, []);
  const queda = useCallback(() => {
    const g = jogo.current; if (!g || g.fim || g.pausado || !g.comecou) return;
    let n = 0; while (!colide(g.tab, g.peca.m, g.peca.x, g.peca.y + 1)) { g.peca.y += 1; n++; }
    g.pontos += n * 2; travar();
  }, [travar]);
  const pausar = useCallback(() => {
    const g = jogo.current; if (!g || g.fim || !g.comecou) return;
    g.pausado = !g.pausado; sincroniza();
  }, [sincroniza]);

  // Teclado (só enquanto a aba está aberta). Setas e espaço não rolam a página.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const k = e.key;
      const usa = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'x', 'X', 'z', 'Z', 'p', 'P', 'Enter'].includes(k);
      if (!usa) return;
      e.preventDefault();
      const g = jogo.current;
      if (!g || !g.comecou || g.fim) { if (k === 'Enter' || k === ' ') iniciar(); return; }
      if (k === 'ArrowLeft') mover(-1); else if (k === 'ArrowRight') mover(1); else if (k === 'ArrowDown') descer(true);
      else if (k === 'ArrowUp' || k === 'x' || k === 'X') girar(1); else if (k === 'z' || k === 'Z') girar(-1);
      else if (k === ' ') queda(); else if (k === 'p' || k === 'P') pausar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [iniciar, mover, descer, girar, queda, pausar]);

  // Laço do jogo: gravidade por tempo + desenho.
  useEffect(() => {
    jogo.current = { tab: criarTabuleiro(), fila: [], pontos: 0, linhas: 0, nivel: 1, fim: false, pausado: false, comecou: false, acum: 0, melhor: lerMelhor(), peca: null, proxima: 'T' };
    let raf, ultimo = performance.now();
    const campo = campoRef.current.getContext('2d'), prox = proximaRef.current.getContext('2d');
    campo.imageSmoothingEnabled = false; prox.imageSmoothingEnabled = false;

    const desenha = () => {
      const g = jogo.current;
      campo.fillStyle = '#0b1020'; campo.fillRect(0, 0, COLS * CELULA, ROWS * CELULA);
      campo.strokeStyle = 'rgba(255,255,255,.05)'; campo.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { campo.beginPath(); campo.moveTo(x * CELULA + .5, 0); campo.lineTo(x * CELULA + .5, ROWS * CELULA); campo.stroke(); }
      for (let y = 1; y < ROWS; y++) { campo.beginPath(); campo.moveTo(0, y * CELULA + .5); campo.lineTo(COLS * CELULA, y * CELULA + .5); campo.stroke(); }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g.tab[y][x]) desenhaBloco(campo, x * CELULA, y * CELULA, CORES[g.tab[y][x]]);
      if (g.peca && g.comecou) {
        let gy = g.peca.y; while (!colide(g.tab, g.peca.m, g.peca.x, gy + 1)) gy++;      // sombra de onde vai cair
        g.peca.m.forEach((l, y) => l.forEach((v, x) => { if (v && gy + y >= 0) desenhaBloco(campo, (g.peca.x + x) * CELULA, (gy + y) * CELULA, CORES[g.peca.cor], CELULA, .22); }));
        g.peca.m.forEach((l, y) => l.forEach((v, x) => { if (v && g.peca.y + y >= 0) desenhaBloco(campo, (g.peca.x + x) * CELULA, (g.peca.y + y) * CELULA, CORES[g.peca.cor]); }));
      }
      prox.fillStyle = '#0b1020'; prox.fillRect(0, 0, 96, 96);
      if (g.comecou && g.proxima) {
        const p = PECAS[g.proxima], t = 20, w = p.m[0].length * t, h = p.m.length * t;
        p.m.forEach((l, y) => l.forEach((v, x) => { if (v) desenhaBloco(prox, (96 - w) / 2 + x * t, (96 - h) / 2 + y * t, CORES[p.cor], t); }));
      }
    };

    const quadro = (agora) => {
      const g = jogo.current, dt = Math.min(100, agora - ultimo); ultimo = agora;
      if (g.comecou && !g.fim && !g.pausado) {
        g.acum += dt;
        const passo = velocidade(g.nivel);
        while (g.acum >= passo) { g.acum -= passo; descer(false); if (g.fim) break; }
      }
      desenha();
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [descer]);

  const btn = { width: 54, height: 54, borderRadius: 14, border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.06)', color: T.text, fontSize: 22, fontWeight: 800, cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none' };
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: '10px 14px', textAlign: 'center', minWidth: 96 };
  const num = { fontSize: 22, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' };
  const rot = { fontSize: 10.5, fontWeight: 700, color: T.textT, letterSpacing: '.08em', textTransform: 'uppercase' };
  const sobreposto = !ui.comecou || ui.fim || ui.pausado;

  return (
    <div style={{ padding: '18px 16px 28px', maxWidth: 640, margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 4px' }}>Uniko Tetris</h2>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 14 }}>Complete linhas para marcar pontos. A velocidade aumenta a cada 10 linhas.</div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', lineHeight: 0 }}>
          <canvas ref={campoRef} width={COLS * CELULA} height={ROWS * CELULA}
            style={{ width: 'min(240px, 62vw)', aspectRatio: `${COLS} / ${ROWS}`, imageRendering: 'pixelated', borderRadius: 10, border: `3px solid ${T.border}`, background: '#0b1020' }} />
          {sobreposto && (
            <div style={{ position: 'absolute', inset: 3, borderRadius: 8, background: 'rgba(5,8,20,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, lineHeight: 1.3, textAlign: 'center', padding: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{ui.fim ? 'Fim de jogo' : ui.pausado ? 'Pausado' : 'Uniko Tetris'}</div>
              {ui.fim && <div style={{ color: '#cbd5e1', fontSize: 13 }}>{ui.pontos} pontos{ui.pontos > 0 && ui.pontos >= ui.melhor ? ' — novo recorde! 🎉' : ''}</div>}
              <button onClick={ui.pausado ? pausar : iniciar} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: T.gold, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                {ui.pausado ? 'Continuar' : ui.fim ? 'Jogar de novo' : 'Jogar'}
              </button>
              {!ui.comecou && <div style={{ color: '#94a3b8', fontSize: 11.5 }}>← → mover · ↑ girar · ↓ descer<br />Espaço queda rápida · P pausa</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <div style={card}><div style={rot}>Próxima</div><canvas ref={proximaRef} width={96} height={96} style={{ imageRendering: 'pixelated', borderRadius: 8, marginTop: 6 }} /></div>
          <div style={card}><div style={rot}>Pontos</div><div style={num}>{ui.pontos}</div></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={card}><div style={rot}>Linhas</div><div style={num}>{ui.linhas}</div></div>
            <div style={card}><div style={rot}>Nível</div><div style={num}>{ui.nivel}</div></div>
          </div>
          <div style={card}><div style={rot}>Recorde</div><div style={num}>{ui.melhor}</div></div>
          {ui.comecou && !ui.fim && <button onClick={pausar} style={{ ...btn, width: '100%', height: 40, fontSize: 13 }}>{ui.pausado ? '▶ Continuar' : '⏸ Pausar'}</button>}
        </div>
      </div>

      {/* Controles na tela (celular) */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => mover(-1)} aria-label="Esquerda">◀</button>
        <button style={btn} onClick={() => girar(1)} aria-label="Girar">⟳</button>
        <button style={btn} onClick={() => descer(true)} aria-label="Descer">▼</button>
        <button style={btn} onClick={() => mover(1)} aria-label="Direita">▶</button>
        <button style={{ ...btn, width: 90, fontSize: 14 }} onClick={queda}>⤓ Queda</button>
      </div>
    </div>
  );
};
