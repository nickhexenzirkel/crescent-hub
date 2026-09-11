/* ══════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO DE PERFORMANCE — "por que o Uniko está travando?"

   Duas ferramentas que ligam juntas, pensadas pra achar o culpado SEM chutar:

   1) MEDIDOR (HUD)  — caixinha no canto com FPS, pior frame, travadas longas
      (long tasks), memória, nº de elementos na tela, quantos deles pedem
      desfoque de fundo (backdrop-filter) e quantos timers estão rodando.

   2) INTERRUPTORES  — desligam, um a um e ao vivo, os quatro suspeitos de
      sempre. Se o FPS pular quando você desliga UM deles, achou o culpado.
        [1] desfoque de fundo (backdrop-filter)  — 179 usos no projeto
        [2] fundo lava lamp (8 bolhas com blur 78px animadas sem parar)
        [3] animações e transições               — 386 usos
        [4] sombras e filtros (box-shadow / drop-shadow)

   COMO ABRIR
     • tecle  Ctrl + Alt + P  em qualquer tela, ou
     • entre com  ?perf=1  na URL  (ex: http://localhost:5173/?perf=1)
     Com o HUD aberto, as teclas 1/2/3/4 ligam e desligam cada interruptor,
     e  0  religa tudo. A escolha fica salva no navegador.

   Nada disso aparece pra quem não abriu: sem a tecla/URL o componente não
   renderiza nada e não instala nenhum medidor.

   Este arquivo é a parte SEM React (estado, interruptores, sondas do DOM); o
   HUD em si mora no diagnosticoPerf.jsx ao lado.
══════════════════════════════════════════════════════════════════════════ */
const CHAVE_FLAGS = 'perf_diag_flags';
const CHAVE_ABERTO = 'perf_diag_aberto';

/* ── Contagem de timers ativos ─────────────────────────────────────────────
   setInterval é o vazamento clássico: a tela some, o componente desmonta, mas
   alguém esqueceu o clearInterval e o timer continua acordando o app pra
   sempre. Envolvemos setInterval/clearInterval num contador pra o HUD mostrar
   esse número; se ele só cresce conforme você navega, há vazamento.
   Só é instalado quando o diagnóstico está ligado — em uso normal o app roda
   com os métodos originais do navegador. */
const timers = { vivos: 0, criados: 0 };
let jaEnvolveu = false;
function envolverTimers() {
  if (jaEnvolveu) return;
  jaEnvolveu = true;
  const setOriginal = window.setInterval;
  const clearOriginal = window.clearInterval;
  const ids = new Set();
  window.setInterval = function (...args) {
    const id = setOriginal.apply(this, args);
    ids.add(id); timers.vivos = ids.size; timers.criados++;
    return id;
  };
  window.clearInterval = function (id) {
    if (ids.delete(id)) timers.vivos = ids.size;
    return clearOriginal.call(this, id);
  };
}

/* ── Estado dos interruptores ──────────────────────────────────────────── */
const FLAGS_PADRAO = { semBackdrop: false, semLava: false, semAnim: false, semSombra: false };

function lerFlags() {
  try { return { ...FLAGS_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_FLAGS) || '{}') }; }
  catch { return { ...FLAGS_PADRAO }; }
}

/* Aplica as classes no <body>. O CSS que realmente desliga cada efeito está
   em index.css (regras .pd-*), pra valer no app inteiro de uma vez. */
function aplicarFlags(f) {
  const b = document.body;
  b.classList.toggle('pd-sem-backdrop', !!f.semBackdrop);
  b.classList.toggle('pd-sem-lava',     !!f.semLava);
  b.classList.toggle('pd-sem-anim',     !!f.semAnim);
  b.classList.toggle('pd-sem-sombra',   !!f.semSombra);
  try { localStorage.setItem(CHAVE_FLAGS, JSON.stringify(f)); } catch {}
}

function querAbrir() {
  try {
    return new URLSearchParams(location.search).has('perf')
      || localStorage.getItem(CHAVE_ABERTO) === '1';
  } catch { return false; }
}

/* As escolhas valem desde o primeiro pixel (antes do React montar), senão a
   tela pisca com os efeitos ligados e a medição do começo sai contaminada. */
export function iniciarDiagnosticoPerf() {
  aplicarFlags(lerFlags());
  if (querAbrir()) envolverTimers();
}


export { timers, envolverTimers, lerFlags, aplicarFlags, querAbrir, FLAGS_PADRAO, CHAVE_ABERTO };

/* ── Sondas do DOM ──────────────────────────────────────────────────────────
   Ler estilo computado do DOM inteiro a cada segundo custaria caro e falsearia
   a própria medição, então olhamos no máximo 1500 elementos. É o suficiente
   pra comparar a ordem de grandeza de uma tela pra outra. */
export function contarBackdrops() {
  let n = 0;
  const todos = document.body.querySelectorAll('div,section,header,aside,nav,button');
  const limite = Math.min(todos.length, 1500);
  for (let i = 0; i < limite; i++) {
    const cs = getComputedStyle(todos[i]);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    if (bf && bf !== 'none') n++;
  }
  return n;
}
export function contarAnimando() {
  let n = 0;
  const todos = document.body.querySelectorAll('*');
  const limite = Math.min(todos.length, 1500);
  for (let i = 0; i < limite; i++) {
    const a = getComputedStyle(todos[i]).animationName;
    if (a && a !== 'none') n++;
  }
  return n;
}
