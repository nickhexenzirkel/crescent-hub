/* ══════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO DE PERFORMANCE — o medidor (HUD)

   Caixinha no canto com FPS, pior frame, travadas longas, memória e contagens
   do DOM, mais os quatro interruptores que desligam um suspeito de cada vez.
   Abre com Ctrl+Alt+P ou ?perf=1 na URL; fechado, não renderiza nem mede nada.
   A mecânica (interruptores, sondas, contagem de timers) está no
   diagnosticoPerfCore.js — aqui é só a tela. Ver também as regras .pd-* no
   index.css, que são o que de fato apaga cada efeito.
══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  timers, envolverTimers, lerFlags, aplicarFlags, querAbrir,
  FLAGS_PADRAO, CHAVE_ABERTO, contarBackdrops, contarAnimando,
} from './diagnosticoPerfCore';

/* ══════════════════════════════════════════════════════════════════════════
   O MEDIDOR
══════════════════════════════════════════════════════════════════════════ */
export default function PerfHud() {
  const [aberto, setAberto] = useState(querAbrir);
  const [flags, setFlags] = useState(lerFlags);
  const [m, setM] = useState({ fps: 0, pior: 0, longas: 0, msLongas: 0, heap: 0, nos: 0, backdrops: 0, animando: 0, timersVivos: 0, timersCriados: 0 });

  /* Ctrl+Alt+P abre/fecha; 1..4 mexem nos interruptores; 0 religa tudo. */
  useEffect(() => {
    const tecla = (e) => {
      if (e.ctrlKey && e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setAberto(a => {
          const novo = !a;
          try { localStorage.setItem(CHAVE_ABERTO, novo ? '1' : '0'); } catch {}
          if (novo) envolverTimers();
          return novo;
        });
        return;
      }
      if (!aberto) return;
      // Só atalho solto — digitar "1" num campo de texto não pode virar comando.
      const alvo = e.target;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      if (e.key === '0') { setFlags({ ...FLAGS_PADRAO }); return; }
      const mapa = { '1': 'semBackdrop', '2': 'semLava', '3': 'semAnim', '4': 'semSombra',
                     '5': 'semEstrelas', '6': 'semMistura', '7': 'semOrbita' };
      const chave = mapa[e.key];
      if (chave) setFlags(f => ({ ...f, [chave]: !f[chave] }));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto]);

  useEffect(() => { aplicarFlags(flags); }, [flags]);

  /* ── Medição ────────────────────────────────────────────────────────────
     Um laço de requestAnimationFrame conta frames e guarda o maior intervalo
     entre dois frames (o "pior frame" — é ele que a gente SENTE como engasgo,
     não a média). Em paralelo, um PerformanceObserver registra as "long
     tasks": pedaços de JavaScript acima de 50ms que seguram a página inteira.

     FPS baixo COM travadas longas  = culpa do JAVASCRIPT.
     FPS baixo SEM travadas longas  = culpa do DESENHO (blur, sombra, animação).
     É essa bifurcação que decide onde mexer. */
  useEffect(() => {
    if (!aberto) return;
    let rodando = true, frames = 0, pior = 0, ultimo = performance.now(), t0 = performance.now();
    let longas = 0, msLongas = 0;

    let obs;
    try {
      obs = new PerformanceObserver(lista => {
        for (const ent of lista.getEntries()) { longas++; msLongas += ent.duration; }
      });
      obs.observe({ entryTypes: ['longtask'] });
    } catch { /* Safari/Firefox não têm longtask — os outros números seguem válidos */ }

    const laco = () => {
      if (!rodando) return;
      const agora = performance.now();
      const dt = agora - ultimo; ultimo = agora;
      frames++; if (dt > pior) pior = dt;

      if (agora - t0 >= 1000) {
        const seg = (agora - t0) / 1000;
        setM({
          fps: Math.round(frames / seg),
          pior: Math.round(pior),
          longas, msLongas: Math.round(msLongas),
          heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0,
          nos: document.getElementsByTagName('*').length,
          backdrops: contarBackdrops(),
          animando: contarAnimando(),
          timersVivos: timers.vivos, timersCriados: timers.criados,
        });
        frames = 0; pior = 0; longas = 0; msLongas = 0; t0 = agora;
      }
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
    return () => { rodando = false; try { obs?.disconnect(); } catch {} };
  }, [aberto]);

  if (!aberto) return null;

  const cor = m.fps >= 55 ? '#4ade80' : m.fps >= 40 ? '#fbbf24' : '#f87171';
  const veredito =
    m.fps >= 55 ? 'fluido'
      : m.msLongas > 250 ? 'travando por JAVASCRIPT'
        : 'travando por DESENHO — teste os interruptores';

  const fechar = () => { setAberto(false); try { localStorage.setItem(CHAVE_ABERTO, '0'); } catch {} };

  return (
    <div style={{
      position: 'fixed', top: 10, right: 10, zIndex: 2147483647, width: 252,
      background: 'rgba(12,14,20,.93)', color: '#e6e8ef', borderRadius: 12,
      border: '1px solid rgba(255,255,255,.14)', padding: '10px 12px',
      font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      boxShadow: '0 10px 34px rgba(0,0,0,.5)',
      // O próprio HUD não pode custar frames: nada de blur nem animação aqui.
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <b style={{ fontSize: 11, letterSpacing: '.06em', opacity: .7 }}>DIAGNÓSTICO</b>
        <button onClick={fechar} aria-label="Fechar"
          style={{ border: 'none', background: 'none', color: '#8b93a7', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
      </div>

      <div style={{ fontSize: 30, fontWeight: 800, color: cor, lineHeight: 1.05 }}>
        {m.fps}<span style={{ fontSize: 12, opacity: .55, fontWeight: 600 }}> fps</span>
      </div>
      <div style={{ fontSize: 10.5, color: cor, opacity: .9, marginBottom: 7 }}>{veredito}</div>

      <Linha rot="pior frame"  val={m.pior + ' ms'} alerta={m.pior > 50}      dica="acima de ~33ms já dá pra ver o engasgo" />
      <Linha rot="travadas/s"  val={m.longas ? m.longas + '× · ' + m.msLongas + 'ms' : '—'} alerta={m.msLongas > 250} dica="JavaScript segurando a tela (>50ms cada)" />
      <Linha rot="elementos"   val={m.nos}          alerta={m.nos > 4000}     dica="nós no DOM" />
      <Linha rot="c/ desfoque" val={m.backdrops}    alerta={m.backdrops > 12} dica="backdrop-filter visíveis agora" />
      <Linha rot="animando"    val={m.animando}     alerta={m.animando > 25}  dica="elementos com animação rodando" />
      <Linha rot="timers"      val={m.timersVivos + ' (' + m.timersCriados + ')'} alerta={m.timersVivos > 25} dica="ativos (total criado) — se só cresce ao navegar, é vazamento" />
      {m.heap > 0 && <Linha rot="memória" val={m.heap + ' MB'} alerta={m.heap > 700} dica="heap do JavaScript" />}

      <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', margin: '8px 0 7px' }} />
      <div style={{ fontSize: 10, opacity: .6, marginBottom: 5 }}>DESLIGUE UM POR VEZ (teclas 1-7)</div>
      <Chave n="1" on={flags.semBackdrop} rot="desfoque de fundo" onClick={() => setFlags(f => ({ ...f, semBackdrop: !f.semBackdrop }))} />
      <Chave n="2" on={flags.semLava}     rot="fundo lava lamp"   onClick={() => setFlags(f => ({ ...f, semLava: !f.semLava }))} />
      <Chave n="3" on={flags.semAnim}     rot="animações"         onClick={() => setFlags(f => ({ ...f, semAnim: !f.semAnim }))} />
      <Chave n="4" on={flags.semSombra}   rot="sombras/filtros"   onClick={() => setFlags(f => ({ ...f, semSombra: !f.semSombra }))} />
      <Chave n="5" on={flags.semEstrelas} rot="estrelas do fundo"  onClick={() => setFlags(f => ({ ...f, semEstrelas: !f.semEstrelas }))} />
      <Chave n="6" on={flags.semMistura}  rot="mistura das bolhas" onClick={() => setFlags(f => ({ ...f, semMistura: !f.semMistura }))} />
      <Chave n="7" on={flags.semOrbita}   rot="estrelas em órbita" onClick={() => setFlags(f => ({ ...f, semOrbita: !f.semOrbita }))} />
      <button onClick={() => setFlags({ ...FLAGS_PADRAO })}
        style={{ marginTop: 6, width: '100%', padding: '5px', borderRadius: 7, border: '1px solid rgba(255,255,255,.16)',
          background: 'transparent', color: '#8b93a7', cursor: 'pointer', font: 'inherit', fontSize: 10.5 }}>
        religar tudo (0)
      </button>
    </div>
  );
}

const Linha = ({ rot, val, alerta, dica }) => (
  <div title={dica} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1.5px 0' }}>
    <span style={{ opacity: .62 }}>{rot}</span>
    <b style={{ color: alerta ? '#f87171' : '#e6e8ef', fontVariantNumeric: 'tabular-nums' }}>{val}</b>
  </div>
);

const Chave = ({ n, on, rot, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '3px 5px', marginBottom: 2,
    borderRadius: 6, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 11, textAlign: 'left',
    background: on ? 'rgba(248,113,113,.16)' : 'transparent',
    color: on ? '#fca5a5' : '#aab1c2' }}>
    <span style={{ opacity: .45, width: 8 }}>{n}</span>
    <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: on ? '#f87171' : 'rgba(255,255,255,.18)' }} />
    <span>{on ? rot + ' — OFF' : rot}</span>
  </button>
);
