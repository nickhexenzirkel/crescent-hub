// src/modules/central-colaborador/tabs/TabUnikoFaster.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO FASTER (EM DESENVOLVIMENTO) — jogo de corrida em 1ª pessoa estilo
// Outrun/Asphalt, com a música tocando no fundo.
//
// COMO FUNCIONA O 3D: é pseudo-3D clássico (o mesmo truque do Outrun) — a pista
// é uma lista de SEGMENTOS com profundidade z; cada segmento é projetado na tela
// com perspectiva (quanto mais longe, menor). Curvas = deslocamento lateral
// acumulado por segmento; ladeiras = variação de altura. Sem WebGL, tudo em
// canvas 2D, roda liso em qualquer máquina.
//
// MÚSICA: iframe OCULTO do YouTube (autoplay+loop), mesma abordagem do Uniko
// Wave. O jogador escolhe da BIBLIOTECA (lista embutida + o que ele salvou no
// Uniko Wave, lido do localStorage dw_library_v2) ou cola um LINK do YouTube.
// A música é só trilha de fundo — não afeta a física (por enquanto).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo } from 'react';
import { T } from '../../../contexts/theme';

/* ── Música ──────────────────────────────────────────────────────────────── */
// Biblioteca embutida (mesmos IDs das músicas iniciais do Uniko Wave).
const TRILHAS = [
  { vid: 'Dst9gZkq1a8', title: 'Goosebumps — Travis Scott' },
  { vid: 'pzPElFdxMCM', title: 'Shinigami Eyes — Grimes' },
  { vid: 'r20zq0QfVM4', title: 'Desgraça — Anitta' },
  { vid: 'lIxQe1R5hs0', title: 'Stateside — PinkPantheress' },
  { vid: 'i0p1bmr0EmE', title: 'What Is Love? — TWICE' },
  { vid: 's49rOuVY3s0', title: 'Vira Lata — João Gomes, Pabllo Vittar' },
  { vid: '0-mKwNMXETo', title: 'Lud Session #2 — Ludmilla' },
  { vid: 'q0u47Nl7N7M', title: 'Lua Cheia — Marina Sena' },
];
const getYTId = (url) => {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|\/embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{11}$/.test((url || '').trim()) ? url.trim() : null);
};
// Músicas que o jogador salvou no Uniko Wave (mesmo navegador/conta).
const bibliotecaSalva = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('dw_library_v2') || '[]');
    return (Array.isArray(raw) ? raw : []).filter(x => x?.vid).map(x => ({ vid: x.vid, title: x.title || 'Música salva' }));
  } catch { return []; }
};

/* ── Pista (pseudo-3D) ───────────────────────────────────────────────────── */
const SEG_LEN = 200;          // comprimento de um segmento no "mundo"
const RUMBLE = 3;             // segmentos por faixa de zebra
const ROAD_W = 3100;          // meia-largura da pista (mais larga = mais espaço p/ ultrapassar)
const LANES = 4;
const CAM_H = 1000;           // altura da câmera
const CAM_D = 0.84;           // distância da câmera ao plano (fov)
const DRAW_N = 300;           // segmentos desenhados à frente
const MAX_SPEED = SEG_LEN * 60;
const ACCEL = MAX_SPEED / 4.5;
const BRAKE = -MAX_SPEED / 2.2;
const DECEL = -MAX_SPEED / 5.5;
const OFFROAD_DECEL = -MAX_SPEED / 2;
const OFFROAD_MAX = MAX_SPEED / 4.2;
const CENTRIFUGAL = 0.22;
// Nitro (boost estilo Speedstorm): medidor 0..1, gasta rápido, recarrega devagar.
const NITRO_MAX = 1;
const NITRO_DRAIN = 0.42;     // por segundo em uso
const NITRO_FILL = 0.075;     // recarrega por segundo correndo
const BOOST_MULT = 1.45;      // teto de velocidade durante o nitro
// Rampas de TURBO na pista (atalho de velocidade pra ultrapassar): pisou, disparou.
const TURBO_MULT = 1.6;       // teto de velocidade em cima/logo após a rampa
const TURBO_DUR = 1.1;        // segundos que o impulso dura depois de sair da rampa
const RIVAIS_N = 5;
const VOLTA_MAX = 60;         // teto de SEGURANÇA (a corrida acaba junto com a música)

// Paleta vibrante estilo Disney Speedstorm (arcade kart colorido).
const COR = {
  ceu1: '#1b1470', ceu2: '#2f8bff', ceu3: '#ff67c7',
  grama: ['#18c85e', '#13b452'], zebra: ['#ffffff', '#ff2e63'],
  pista: ['#5a6480', '#515b74'], linha: '#ffffff',
};
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── Sprites personalizados (PNG em /public/unikofaster/) ──────────────────────
   Carrega uma vez e guarda em cache. Cada sprite tem .ok (carregou) — o desenho
   só usa a imagem quando .ok; senão cai no desenho procedural (fallback). Assim
   o jogador vai soltando os PNGs e cada um aparece sozinho, sem quebrar nada. */
const SPRITE_CACHE = {};
const carregarSprite = (nome) => {
  if (SPRITE_CACHE[nome]) return SPRITE_CACHE[nome];
  const rec = { ok: false, img: new Image() };
  rec.img.onload = () => { rec.ok = true; rec.rz = rec.img.naturalWidth / rec.img.naturalHeight; };
  rec.img.onerror = () => { rec.ok = false; };   // sem PNG → fallback silencioso
  rec.img.src = `/unikofaster/${nome}.png`;
  SPRITE_CACHE[nome] = rec;
  return rec;
};

/* ── Mapas (temas visuais) ────────────────────────────────────────────────────
   Cada mapa troca o FUNDO, o CHÃO das laterais e os OBJETOS de beira de pista.
   Pista, carros, pneu e placas são compartilhados. */
const MAPAS = {
  cidade: {
    id: 'cidade', nome: 'Cidade Futurista', emoji: '🏙️',
    desc: 'Neon, arranha-céus e lua cheia',
    fundo: 'fundo-cidade', chao: 'chao-cidade',
    cenarios: ['cenario-predio-1', 'cenario-predio-2'], cenarioLarg: 1.15,
  },
  campo: {
    id: 'campo', nome: 'Campo', emoji: '🌳',
    desc: 'Pôr do sol retrowave e árvores',
    fundo: 'fundo', chao: 'grama',
    cenarios: ['cenario-arvore'], cenarioLarg: 0.9,
  },
};
const MAPA_PADRAO = 'cidade';

// Trilhas que tocam de fundo na TELA INICIAL (uma aleatória por sessão).
const MUSICAS_MENU = ['/unikofaster/menu-lifestyle.mp3', '/unikofaster/menu-vroom.mp3', '/unikofaster/menu-nfs.mp3'];

/* ── Traçados (4 formatos de pista, valem pra qualquer mapa) ───────────────────
   Cada traçado é uma lista de trechos [comprimento, curva, variação de altura].
   A curva sobe e volta a 0 sozinha (sin), então o loop sempre fecha na direção;
   só a altura é fechada por um trecho final. Todos com POUCAS curvas suaves. */
const TRACADOS = [
  { id: 0, nome: 'Clássico', emoji: '🏁', trechos: [
    [150, 0, 0], [80, 2.4, 200], [170, 0, 0], [80, -2.4, -200], [150, 0, 150],
    [80, 2, 0], [180, 0, -150], [80, -2, 100], [150, 0, 0],
  ] },
  { id: 1, nome: 'Reta Veloz', emoji: '🚀', trechos: [
    [260, 0, 0], [90, 1.8, 250], [280, 0, -250], [90, -1.8, 0], [260, 0, 0],
  ] },
  { id: 2, nome: 'Sinuoso', emoji: '🐍', trechos: [
    [90, 0, 0], [70, 3, 120], [70, -3, -120], [70, 3, 120], [70, -3, -120],
    [90, 0, 0], [70, -3, 150], [70, 3, -150], [70, -3, 100], [70, 3, -100], [90, 0, 0],
  ] },
  { id: 3, nome: 'Técnico', emoji: '🏎️', trechos: [
    [120, 0, 0], [60, 3, 200], [90, 0, 0], [60, -3, -100], [80, 0, 100],
    [70, 2.5, -200], [90, 0, 0], [70, -2.5, 250], [120, 0, -250],
  ] },
];
const TRACADO_PADRAO = 0;

// Constrói a pista a partir de um traçado (lista de trechos). Loopável.
function montarPista(trechos = TRACADOS[TRACADO_PADRAO].trechos) {
  const segs = [];
  const add = (curve, y) => {
    const n = segs.length;
    segs.push({
      index: n, curve, p1y: lastY(), p2y: y,
      cor: Math.floor(n / RUMBLE) % 2 ? 'dark' : 'light',
    });
  };
  function lastY() { return segs.length ? segs[segs.length - 1].p2y : 0; }
  const trecho = (n, curve, dy) => {
    const yBase = lastY();
    for (let i = 0; i < n; i++) {
      const y = yBase + dy * (Math.sin((i / n) * Math.PI - Math.PI / 2) / 2 + 0.5);
      add(curve * (Math.sin((i / n) * Math.PI)), y);   // curva sobe e desce suave
    }
  };
  for (const [n, curve, dy] of trechos) trecho(n, curve, dy);
  // FECHA O LOOP suave: traz a altura de volta a 0 (senão há um DEGRAU entre o
  // último segmento e o primeiro, e a pista "reseta"/salta ao dar a volta).
  trecho(80, 0, -segs[segs.length - 1].p2y);
  // LINHA DE LARGADA/CHEGADA (xadrez) nos primeiros segmentos.
  for (let i = 0; i < 4; i++) segs[i].start = true;
  // RAMPAS DE TURBO: faixas brilhantes que dão um impulso de velocidade (atalho
  // pra ultrapassar). Cada rampa ocupa uma sequência de segmentos numa faixa
  // lateral (x, largura w), espalhadas pelo circuito.
  const NPADS = 9, passoPad = Math.floor(segs.length / NPADS);
  for (let k = 0; k < NPADS; k++) {
    const ini = 90 + k * passoPad + Math.floor(rnd(0, passoPad * 0.4));
    const x = [-0.55, 0, 0.55][k % 3], comp = 12;
    for (let i = ini; i < ini + comp && i < segs.length - 6; i++) segs[i].turbo = { x, w: 0.34 };
  }
  // pequenos OBSTÁCULOS pra desviar (cones/pneus), RAROS — nunca logo na largada,
  // nem dois seguidos, nem em cima de uma rampa de turbo.
  let ultimo = -99;
  for (let i = 120; i < segs.length - 10; i += Math.floor(rnd(30, 48))) {
    if (i - ultimo < 24 || segs[i].turbo) continue;
    segs[i].obstaculos = [{ x: rnd(-0.65, 0.65) }];
    ultimo = i;
  }
  // CENÁRIO de beira de pista (genérico — o MAPA decide o sprite): objetos
  // frequentes alternando os lados; placas em pontos marcantes. Ficam FORA da
  // pista (não atrapalham).
  let vk = 0;
  for (let i = 24; i < segs.length; i += Math.floor(rnd(6, 12))) {
    segs[i].cenario = { lado: Math.random() < 0.5 ? -1 : 1, variante: vk++ };
  }
  for (let k = 1; k <= 5; k++) {
    const i = Math.floor((segs.length / 6) * k);
    segs[i].placa = { lado: k % 2 ? 1 : -1 };
  }
  return segs;
}

// Formato TOP-DOWN da pista (pra prévia): integra as curvas num caminho 2D.
function pontosDaForma(trechos) {
  const segs = montarPista(trechos);
  let ang = 0, x = 0, y = 0;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const pts = [];
  for (let i = 0; i < segs.length; i++) {
    ang += (segs[i].curve || 0) * 0.03;
    x += Math.sin(ang); y += Math.cos(ang);
    if (i % 5 === 0) pts.push([x, y]);           // amostra pra caminho leve
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { pts, minX, maxX, minY, maxY };
}

// Carrega a IFrame API do YouTube uma única vez (mesma da Central Alexa).
function loadYouTubeApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
}

// Rivais que CORREM comigo (posição, velocidade e progresso próprios na pista).
// Cada um tem uma COR (ponto do minimapa + fallback desenhado) e um SPRITE PNG.
const RIVAL_DEFS = [
  { cor: '#ef4444', spr: 'rival-vermelho', nome: 'Blaze' },
  { cor: '#3b82f6', spr: 'rival-azul', nome: 'Volt' },
  { cor: '#f59e0b', spr: 'rival-amarelo', nome: 'Turbo' },
  { cor: '#22c55e', spr: 'rival-verde', nome: 'Rex' },
  { cor: '#e879f9', spr: 'rival-rosa', nome: 'Ace' },
];
function montarRivais() {
  // GRID DE LARGADA: fileiras alternadas (esquerda/direita), logo à frente da
  // linha de partida, escalonados como num grid de kart.
  return Array.from({ length: RIVAIS_N }, (_, i) => {
    const fila = Math.floor(i / 2);
    const def = RIVAL_DEFS[i % RIVAL_DEFS.length];
    return {
      pos: SEG_LEN * (14 + fila * 6),           // escalonados à frente da largada
      x: (i % 2 === 0 ? -0.5 : 0.5),            // duas colunas
      cor: def.cor,
      spr: def.spr,
      nome: def.nome,
      base: MAX_SPEED * rnd(0.78, 0.94),        // ritmo natural de cada um
      speed: 0,
      traveled: 0,                              // distância total (p/ ranking)
      lento: 0,                                 // timer de "tomou dano" (bateu em cone)
      turbo: 0,                                 // timer de impulso (pegou rampa)
    };
  });
}

/* Prévia do formato da pista (traçado top-down) — desenhada em SVG. */
const PreviaPista = ({ tracado = 0, cor = US_ACCENT }) => {
  const { pts, minX, maxX, minY, maxY } = useMemo(
    () => pontosDaForma(TRACADOS[tracado]?.trechos), [tracado]);
  const W = 300, H = 150, pad = 18;
  const sx = (maxX - minX) || 1, sy = (maxY - minY) || 1;
  const sc = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
  const ox = (W - sx * sc) / 2 - minX * sc, oy = (H - sy * sc) / 2 - minY * sc;
  const proj = ([x, y]) => [x * sc + ox, y * sc + oy];
  const d = pts.map((p, i) => { const [X, Y] = proj(p); return `${i ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)}`; }).join(' ') + ' Z';
  const [lx, ly] = proj(pts[0] || [0, 0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 170, display: 'block' }}>
      <path d={d} fill="none" stroke={`${cor}33`} strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={cor} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      {/* linha de largada/chegada */}
      <circle cx={lx} cy={ly} r={7} fill="#fff" stroke={cor} strokeWidth={3} />
      <text x={lx} y={ly - 12} textAnchor="middle" fontSize={12} fontWeight="800" fill={cor}>🏁</text>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoFaster = () => {
  const [tela, setTela] = useState('menu');   // menu | correndo
  const [trilha, setTrilha] = useState(null); // {vid, title}
  const [link, setLink] = useState('');
  const [erroLink, setErroLink] = useState('');
  const [pausado, setPausado] = useState(false);
  const [mapa, setMapa] = useState(MAPA_PADRAO);      // cidade (padrão) | campo
  const [tracado, setTracado] = useState(TRACADO_PADRAO);   // 0..3 — formato da pista
  const [etapa, setEtapa] = useState(0);   // wizard: 0 início · 1 música · 2 mapa · 3 traçado · 4 confirmar
  const [corridaKey, setCorridaKey] = useState(0);   // muda pra reiniciar a corrida limpa
  const [hud, setHud] = useState({ vel: 0, dist: 0, best: 0, rank: 1, nitro: 1, volta: 1, boost: false });

  const salvas = useMemo(() => bibliotecaSalva(), []);
  const biblioteca = useMemo(() => {
    const vistos = new Set();
    return [...TRILHAS, ...salvas].filter(m => (vistos.has(m.vid) ? false : (vistos.add(m.vid), true)));
  }, [salvas]);

  // recorde: state (mostrado no menu) + ref (atualizado no loop do jogo sem re-render)
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('uf_best') || 0); } catch { return 0; } });
  const bestRef = useRef(best);

  // Tela cheia: envolve TODO o jogo (menu + corrida) num root estável, então
  // continua em tela cheia ao clicar em JOGAR.
  const rootRef = useRef(null);
  const [telaCheia, setTelaCheia] = useState(false);
  useEffect(() => {
    const onFsc = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsc);
    return () => document.removeEventListener('fullscreenchange', onFsc);
  }, []);
  const toggleTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => { /* bloqueado */ });
  };

  // Música de fundo da tela inicial (uma aleatória por sessão, estilo Uniko Wave).
  const menuAudio = useRef(null);
  const [menuTrack] = useState(() => MUSICAS_MENU[Math.floor(Math.random() * MUSICAS_MENU.length)]);
  useEffect(() => {
    const a = menuAudio.current;
    if (!a || tela !== 'menu') return;
    a.volume = 0.45;
    const tocar = () => { a.play().catch(() => { /* autoplay bloqueado */ }); };
    tocar();
    // fallback: se o autoplay foi bloqueado, toca no 1º clique/toque
    const noGesto = () => { tocar(); window.removeEventListener('pointerdown', noGesto); };
    window.addEventListener('pointerdown', noGesto);
    return () => window.removeEventListener('pointerdown', noGesto);
  }, [tela]);

  // No wizard, escolher a música AVANÇA pro passo do mapa (não começa a corrida).
  const jogarLink = () => {
    const vid = getYTId(link);
    if (!vid) { setErroLink('Link do YouTube inválido — cole a URL do vídeo.'); return; }
    setErroLink('');
    setTrilha({ vid, title: 'Sua música do YouTube' });
    setEtapa(2);
  };
  const jogar = (m) => { setTrilha(m); setEtapa(2); };
  const comecar = () => setTela('correndo');   // botão final do wizard

  /* ── MENU ── */
  let conteudo = null;
  if (tela === 'menu') {
    // Segue o tema do app (T.dark), mantendo o visual premium chrome + neon.
    const dark = !!T.dark;
    const pal = dark ? {
      bg: 'radial-gradient(130% 90% at 50% -20%, #1c2742 0%, #131b31 52%, #0b1020 100%)',
      panelBg: 'rgba(255,255,255,.055)', panelBorder: 'rgba(255,255,255,.12)',
      panelSh: '0 16px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)',
      txt: '#f1f5f9', txt2: 'rgba(255,255,255,.78)', txtSub: 'rgba(255,255,255,.58)',
      selBg: 'rgba(34,211,238,.14)', unselBg: 'rgba(255,255,255,.05)', unselBorder: 'rgba(255,255,255,.14)',
      unselSh: 'inset 0 1px 0 rgba(255,255,255,.05)', glow: '#22d3ee', accent: '#22d3ee',
      titleGrad: 'linear-gradient(100deg, #e2e8f0 0%, #94a3b8 30%, #ffffff 47%, #94a3b8 63%, #e2e8f0 100%)',
      badgeBg: 'rgba(34,211,238,.14)', badgeTx: '#67e8f9', badgeBd: 'rgba(34,211,238,.4)',
      inputBg: 'rgba(0,0,0,.3)', inputBd: 'rgba(255,255,255,.16)',
      previewBox: 'rgba(0,0,0,.28)', previewLine: 'rgba(255,255,255,.5)',
      blob1: 'rgba(217,70,239,.28)', blob2: 'rgba(34,211,238,.3)', blob3: 'rgba(124,58,237,.26)',
      carSh: 'rgba(0,0,0,.6)', mascotSh: 'rgba(0,0,0,.55)',
    } : {
      bg: 'radial-gradient(130% 90% at 50% -20%, #ffffff 0%, #eef2fb 52%, #e5e9f6 100%)',
      panelBg: 'rgba(255,255,255,.72)', panelBorder: 'rgba(148,163,184,.28)',
      panelSh: '0 14px 34px rgba(30,41,90,.12), inset 0 1px 0 rgba(255,255,255,.9)',
      txt: '#0f172a', txt2: '#475569', txtSub: '#64748b',
      selBg: 'rgba(6,182,212,.08)', unselBg: 'rgba(255,255,255,.62)', unselBorder: 'rgba(148,163,184,.3)',
      unselSh: '0 2px 8px rgba(30,41,90,.06)', glow: '#06b6d4', accent: '#7c3aed',
      titleGrad: 'linear-gradient(100deg, #1e293b 0%, #64748b 30%, #f8fafc 47%, #64748b 63%, #1e293b 100%)',
      badgeBg: 'rgba(6,182,212,.1)', badgeTx: '#0e7490', badgeBd: 'rgba(6,182,212,.35)',
      inputBg: '#fff', inputBd: 'rgba(148,163,184,.45)',
      previewBox: 'rgba(15,23,42,.05)', previewLine: '#94a3b8',
      blob1: 'rgba(217,70,239,.18)', blob2: 'rgba(34,211,238,.2)', blob3: 'rgba(124,58,237,.16)',
      carSh: 'rgba(0,0,0,.4)', mascotSh: 'rgba(0,0,0,.35)',
    };
    const painel = {
      position: 'relative', borderRadius: 18, padding: 18,
      background: pal.panelBg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${pal.panelBorder}`, boxShadow: pal.panelSh,
    };
    const secTitle = { fontSize: 13, fontWeight: 800, color: pal.txt, display: 'flex', alignItems: 'center', gap: 7 };
    const secSub = { fontSize: 11.5, color: pal.txtSub };
    const selCard = (sel) => ({
      cursor: 'pointer', color: pal.txt, borderRadius: 13,
      background: sel ? pal.selBg : pal.unselBg,
      border: `2px solid ${sel ? pal.glow : pal.unselBorder}`,
      boxShadow: sel ? `0 0 0 1px ${pal.glow}, 0 8px 22px ${pal.glow}44` : pal.unselSh,
    });
    const ctaStyle = {
      padding: '13px 34px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 16, fontWeight: 800,
      cursor: 'pointer', background: 'linear-gradient(135deg, #22d3ee, #7c3aed 55%, #ec4899)',
      boxShadow: `0 8px 24px ${pal.glow}55`,
    };
    const voltarStyle = {
      padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
      color: pal.txt2, background: pal.unselBg, border: `1px solid ${pal.unselBorder}`,
    };
    const tituloEstilo = { fontFamily: 'var(--font-brand)', fontWeight: 800, letterSpacing: '.01em',
      backgroundImage: pal.titleGrad, backgroundSize: '250% 100%' };
    conteudo = (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ position: 'relative', height: etapa === 0 ? '100%' : undefined, minHeight: '100%', overflow: 'hidden', padding: 12, background: pal.bg }}>
          <style>{FASTER_CSS}</style>
          <audio ref={menuAudio} src={menuTrack} loop preload="auto" />
          {/* brilhos neon de fundo */}
          <div className="uf-blob" style={{ width: 460, height: 460, top: -160, left: -130, background: `radial-gradient(circle, ${pal.blob1}, transparent 70%)` }} />
          <div className="uf-blob uf-blob2" style={{ width: 520, height: 520, top: 40, right: -190, background: `radial-gradient(circle, ${pal.blob2}, transparent 70%)` }} />
          <div className="uf-blob uf-blob3" style={{ width: 540, height: 540, bottom: -220, left: '26%', background: `radial-gradient(circle, ${pal.blob3}, transparent 70%)` }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: etapa === 0 ? '100%' : 760, height: etapa === 0 ? '100%' : undefined, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: etapa === 0 ? 0 : 20 }}>

            {/* ══ ETAPA 0 — HERO com MOLDURA preenchendo TODA a área do jogo ══ */}
            {etapa === 0 && (
              <div className="uf-hero-frame" style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
                {/* card interno preenche a área toda */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden',
                  background: pal.panelBg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
                  <div className="uf-grid" style={{ opacity: 0.1 }} />
                </div>
                {/* CONTEÚDO — ancorado no topo, centralizado */}
                <div style={{ position: 'absolute', top: '6%', left: '8%', right: '8%', textAlign: 'center', zIndex: 2 }}>
                  <div style={{ display: 'inline-block', padding: '3px 13px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                    letterSpacing: '.1em', background: pal.badgeBg, color: pal.badgeTx, marginBottom: 4, border: `1px solid ${pal.badgeBd}` }}>
                    EM DESENVOLVIMENTO
                  </div>
                  <img src="/uniko-speed.png" alt="" className="uf-float"
                    style={{ display: 'block', margin: '2px auto 0', width: 'min(112px, 15vw)', height: 'auto', objectFit: 'contain',
                      filter: `drop-shadow(0 8px 22px ${pal.mascotSh})` }} />
                  <div className="uf-title" style={{ ...tituloEstilo, fontSize: 'clamp(32px, 5vw, 60px)', lineHeight: 0.95 }}>
                    UNIKO SPEED
                  </div>
                  <div style={{ height: 3, width: 200, maxWidth: '50%', margin: '8px auto 0', borderRadius: 999,
                    background: 'linear-gradient(90deg, transparent, #22d3ee, #d946ef, transparent)', boxShadow: '0 0 12px rgba(34,211,238,.6)' }} />
                  <div style={{ fontSize: 13, color: pal.txt2, maxWidth: 500, margin: '8px auto 0', lineHeight: 1.45 }}>
                    Corrida em 1ª pessoa com a sua música no volume máximo. 🏎️💨
                  </div>
                  <div style={{ position: 'relative', marginTop: 4, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minHeight: 90 }}>
                    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: '50%', height: 44,
                      background: 'radial-gradient(ellipse, rgba(34,211,238,.4), rgba(217,70,239,.22) 55%, transparent 74%)', filter: 'blur(15px)' }} />
                    <img src="/unikofaster/carro-jogador.png" alt="" className="uf-float-2"
                      style={{ position: 'relative', width: 'min(34%, 320px)', filter: `drop-shadow(0 14px 24px ${pal.carSh})` }} />
                  </div>
                  {best > 0 && (
                    <div style={{ fontSize: 12, color: pal.txtSub, marginTop: 6 }}>
                      🏁 Recorde: <b style={{ color: pal.accent }}>{best.toLocaleString('pt-BR')} m</b>
                    </div>
                  )}
                </div>
                {/* TELA CHEIA — acima do JOGAR (% da altura) */}
                <button className="uf-btn" onClick={toggleTelaCheia}
                  style={{ position: 'absolute', left: '50%', bottom: '20%', transform: 'translateX(-50%)', zIndex: 4,
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 15px', borderRadius: 999, cursor: 'pointer',
                    fontSize: 12, fontWeight: 800, color: pal.txt2, background: pal.unselBg, border: `1px solid ${pal.unselBorder}`, whiteSpace: 'nowrap' }}>
                  ⛶ {telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
                </button>
                {/* JOGAR — encaixado no slot (% da altura, largura ~ do slot) */}
                <button className="uf-btn uf-cta" onClick={() => setEtapa(1)}
                  style={{ position: 'absolute', left: '50%', bottom: '7%', transform: 'translateX(-50%)', zIndex: 4,
                    ...ctaStyle, width: 'min(36%, 560px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'clamp(15px, 1.8vw, 22px)', padding: 'clamp(11px, 1.6vh, 18px) 16px', whiteSpace: 'nowrap' }}>▶ JOGAR</button>

                {/* MOLDURA por cima (centro transparente) */}
                <img src="/unikofaster/borda-inicial.png" alt="" aria-hidden
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', zIndex: 3 }} />
              </div>
            )}

            {/* ══ ETAPAS 1-4 — WIZARD ══ */}
            {etapa >= 1 && (
              <div style={painel}>
                {/* topo: voltar · logo · passo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <button className="uf-btn" style={voltarStyle} onClick={() => setEtapa(e => e - 1)}>◂ Voltar</button>
                  <div className="uf-title" style={{ ...tituloEstilo, fontSize: 21 }}>UNIKO SPEED</div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: pal.txtSub, whiteSpace: 'nowrap' }}>Passo {etapa}/4</div>
                </div>
                {/* barra de progresso */}
                <div style={{ height: 6, borderRadius: 999, background: pal.unselBg, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ width: `${(etapa / 4) * 100}%`, height: '100%', transition: 'width .3s',
                    background: 'linear-gradient(90deg, #22d3ee, #7c3aed, #ec4899)' }} />
                </div>

                {/* ETAPA 1 — MÚSICA */}
                {etapa === 1 && (
                  <>
                    <div style={secTitle}>🎵 Escolha a música</div>
                    <div style={{ ...secSub, margin: '4px 0 12px' }}>Clique numa faixa da biblioteca, ou cole um link do YouTube.</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <input value={link} onChange={e => setLink(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && jogarLink()}
                        placeholder="https://youtube.com/watch?v=..."
                        style={{ flex: 1, padding: '11px 13px', borderRadius: 11, border: `1px solid ${pal.inputBd}`,
                          background: pal.inputBg, color: pal.txt, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none' }} />
                      <button className="uf-btn uf-cta" onClick={jogarLink}
                        style={{ padding: '11px 20px', borderRadius: 11, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
                          cursor: 'pointer', whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #22d3ee, #7c3aed 55%, #ec4899)' }}>
                        Usar ▸
                      </button>
                    </div>
                    {erroLink && <div style={{ fontSize: 12, color: '#ff9db0', margin: '4px 0 8px' }}>{erroLink}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 9,
                      maxHeight: 280, overflowY: 'auto', marginTop: 10, paddingRight: 4 }}>
                      {biblioteca.map(m => (
                        <button key={m.vid} className="uf-btn uf-panel-btn uf-song" onClick={() => jogar(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 9, borderRadius: 12, cursor: 'pointer', color: pal.txt,
                            border: `1px solid ${pal.unselBorder}`, background: pal.unselBg, textAlign: 'left' }}>
                          <img src={`https://i.ytimg.com/vi/${m.vid}/mqdefault.jpg`} alt="" loading="lazy"
                            style={{ width: 54, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0, background: '#0003' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                            <div style={{ fontSize: 11, color: pal.glow, fontWeight: 800, marginTop: 2 }}>▸ escolher</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ETAPA 2 — MAPA */}
                {etapa === 2 && (
                  <>
                    <div style={secTitle}>🗺️ Escolha o mapa</div>
                    <div style={{ ...secSub, margin: '4px 0 14px' }}>O cenário da sua corrida.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      {Object.values(MAPAS).map(m => {
                        const sel = mapa === m.id;
                        return (
                          <button key={m.id} className="uf-btn uf-panel-btn" onClick={() => setMapa(m.id)}
                            style={{ ...selCard(sel), display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', textAlign: 'left' }}>
                            <span style={{ fontSize: 26 }}>{m.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{m.nome}</div>
                              <div style={{ fontSize: 11, color: pal.txtSub }}>{m.desc}</div>
                            </div>
                            {sel && <span style={{ fontSize: 13, fontWeight: 800, color: pal.glow }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 18 }}>
                      <button className="uf-btn uf-cta" style={ctaStyle} onClick={() => setEtapa(3)}>Próximo ▸</button>
                    </div>
                  </>
                )}

                {/* ETAPA 3 — TRAÇADO */}
                {etapa === 3 && (
                  <>
                    <div style={secTitle}>🏁 Escolha o traçado</div>
                    <div style={{ ...secSub, margin: '4px 0 14px' }}>4 formatos de pista (as voltas duram até a música acabar).</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      {TRACADOS.map(t => {
                        const sel = tracado === t.id;
                        return (
                          <button key={t.id} className="uf-btn uf-panel-btn" onClick={() => setTracado(t.id)}
                            style={{ ...selCard(sel), display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
                            <div style={{ background: pal.previewBox, borderRadius: 9, padding: 4 }}>
                              <PreviaPista tracado={t.id} cor={sel ? pal.glow : pal.previewLine} />
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 800, textAlign: 'center', color: sel ? pal.txt : pal.txt2 }}>
                              {t.emoji} {t.nome}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 18 }}>
                      <button className="uf-btn uf-cta" style={ctaStyle} onClick={() => setEtapa(4)}>Próximo ▸</button>
                    </div>
                  </>
                )}

                {/* ETAPA 4 — CONFIRMAR */}
                {etapa === 4 && (
                  <div style={{ textAlign: 'center', padding: '4px 0' }}>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 26, fontWeight: 800, color: pal.txt }}>Tudo pronto! 🚦</div>
                    <div style={{ ...secSub, marginTop: 6 }}>Confira e acelera.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '18px 0' }}>
                      {[['🎵', trilha?.title || 'Música'], ['🗺️', MAPAS[mapa]?.nome], ['🏁', TRACADOS[tracado]?.nome]].map(([e, l], i) => (
                        <span key={i} style={{ padding: '8px 14px', borderRadius: 999, background: pal.unselBg, border: `1px solid ${pal.unselBorder}`,
                          color: pal.txt, fontSize: 12.5, fontWeight: 700, maxWidth: 230, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {e} {l}
                        </span>
                      ))}
                    </div>
                    <button className="uf-btn uf-cta" onClick={comecar}
                      style={{ ...ctaStyle, fontSize: 18, padding: '15px 46px' }}>🏁 Começar corrida!</button>
                    <div style={{ ...secSub, marginTop: 12 }}>Toque em <b style={{ color: pal.txt2 }}>Voltar</b> pra trocar algo.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    /* ── CORRIDA ── */
    conteudo = (
      <Corrida key={corridaKey} trilha={trilha} mapa={mapa} tracado={tracado} bestRef={bestRef} setBest={setBest} hud={hud} setHud={setHud}
        pausado={pausado} setPausado={setPausado}
        onReiniciar={() => { setPausado(false); setCorridaKey(k => k + 1); }}
        onSair={() => { setTela('menu'); setPausado(false); setEtapa(0); }} />
    );
  }

  // Root estável (alvo do fullscreen) que envolve menu e corrida.
  return (
    <div ref={rootRef} style={{ height: '100%', background: '#0a0616' }}>
      {conteudo}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CORRIDA — canvas pseudo-3D + iframe de música
   ═══════════════════════════════════════════════════════════════════════════ */
const Corrida = ({ trilha, mapa, tracado, bestRef, setBest, hud, setHud, pausado, setPausado, onSair, onReiniciar }) => {
  const canvasRef = useRef(null);
  const teclas = useRef({});
  const estado = useRef(null);
  const rafRef = useRef(0);
  const pausadoRef = useRef(pausado);
  useEffect(() => { pausadoRef.current = pausado; }, [pausado]);
  const [fim, setFim] = useState(null);      // {rank, voltas} quando a corrida acaba
  const fimRef = useRef(false);
  const ytHolder = useRef(null);             // <div> que a API do YouTube vira player

  // Música via IFrame API: toca UMA vez (sem loop) e, quando ACABA, sinaliza o
  // fim da corrida (st.acabar). É o que faz "as voltas durarem até a música".
  useEffect(() => {
    if (!trilha?.vid) return;
    let player, cancelado = false;
    loadYouTubeApi().then(() => {
      if (cancelado || !ytHolder.current) return;
      player = new window.YT.Player(ytHolder.current, {
        width: '1', height: '1', videoId: trilha.vid,
        playerVars: { autoplay: 1, controls: 0, playsinline: 1, modestbranding: 1, rel: 0, iv_load_policy: 3 },
        events: {
          onReady: (e) => { try { e.target.playVideo(); } catch { /* */ } },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED && estado.current) estado.current.acabar = true;
          },
        },
      });
    });
    return () => { cancelado = true; try { player?.destroy(); } catch { /* */ } };
  }, [trilha?.vid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pista = montarPista(TRACADOS[tracado]?.trechos);
    const trackLen = pista.length * SEG_LEN;
    const rivais = montarRivais();
    const sprCarro = carregarSprite('carro-jogador');   // chase cam do jogador
    rivais.forEach(r => { r.sprite = carregarSprite(r.spr); });   // PNG de cada rival
    const sprCone = carregarSprite('cone');
    const tema = MAPAS[mapa] || MAPAS[MAPA_PADRAO];
    const sprFundo = carregarSprite(tema.fundo);
    const sprChao = carregarSprite(tema.chao);
    const sprCenarios = tema.cenarios.map(carregarSprite);   // objetos de beira de pista
    const sprPlaca = carregarSprite('cenario-placa');
    let chaoPat = null;   // pattern do chão (criado quando o PNG carrega)
    const st = {
      pos: 0, playerX: 0, speed: 0, tempo: 0, batendo: 0,
      nitro: NITRO_MAX, boost: 0,       // medidor 0..1 e intensidade visual do boost
      turbo: 0,                         // impulso ativo de rampa (segundos restantes)
      traveled: 0, rank: 1,             // distância total e colocação
      bgOffset: 0,                      // parallax do fundo (desliza nas curvas)
      largada: 3.2,                     // contagem regressiva antes de liberar (3,2,1,JÁ!)
    };
    estado.current = st;

    const dpr = () => Math.min(devicePixelRatio || 1, 2);
    const W = () => canvas.offsetWidth, H = () => canvas.offsetHeight;
    const resize = () => { canvas.width = W() * dpr(); canvas.height = H() * dpr(); };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Projeta um ponto do mundo (x,y,z relativo à câmera) → tela.
    const project = (p, camX, camY, camZ, w, h, roadW) => {
      const cz = p.z - camZ || 0.0001;
      const scale = CAM_D / cz;
      p.sx = Math.round(w / 2 + scale * (p.x - camX) * w / 2);
      p.sy = Math.round(h / 2 - scale * (p.y - camY) * h / 2);
      p.sw = Math.round(scale * roadW * w / 2);
      p.scale = scale;
    };

    const quad = (x1, y1, w1, x2, y2, w2, cor) => {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2);
      ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1);
      ctx.closePath(); ctx.fill();
    };

    // Desenha um carro adversário (retângulo com cabine + rodas), escalado.
    const drawCarro = (cx, cy, larg, cor) => {
      const w = larg, h = w * 0.62;
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.05, w * 0.6, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cor;
      rr(ctx, cx - w / 2, cy - h, w, h, h * 0.22); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      rr(ctx, cx - w * 0.32, cy - h * 0.82, w * 0.64, h * 0.4, h * 0.12); ctx.fill();
      ctx.fillStyle = '#1a1a24';
      ctx.fillRect(cx - w * 0.52, cy - h * 0.28, w * 0.12, h * 0.3);
      ctx.fillRect(cx + w * 0.4, cy - h * 0.28, w * 0.12, h * 0.3);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(cx - w * 0.4, cy - h * 0.14, w * 0.12, h * 0.1);
      ctx.fillRect(cx + w * 0.28, cy - h * 0.14, w * 0.12, h * 0.1);
    };

    // Cone de obstáculo (pequeno, dá pra desviar).
    const drawCone = (cx, cy, larg) => {
      const w = larg * 0.5, h = w * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.7, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6a00';
      ctx.beginPath(); ctx.moveTo(cx, cy - h); ctx.lineTo(cx - w * 0.55, cy); ctx.lineTo(cx + w * 0.55, cy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - w * 0.42, cy - h * 0.55, w * 0.84, h * 0.16);
      ctx.fillRect(cx - w * 0.5, cy - h * 0.05, w, h * 0.06);
    };

    // Sprite genérico ancorado pela BASE num ponto da pista (rivais, cones,
    // árvores, placas). Respeita a proporção original (rz) e escala pela largura.
    const drawBillboard = (spr, cx, cyBase, larg, sombra = true) => {
      const w2 = larg, h2 = w2 / (spr.rz || 1.4);
      if (sombra) {
        ctx.fillStyle = 'rgba(0,0,0,.26)';
        ctx.beginPath(); ctx.ellipse(cx, cyBase, w2 * 0.42, h2 * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.drawImage(spr.img, cx - w2 / 2, cyBase - h2, w2, h2);
    };

    // Carro do jogador em CHASE CAM (sprite visto por trás), no centro de baixo.
    // Desliza pros lados com a direção e balança de leve; inclina na curva.
    const drawCarroJogador = (w, h, steer, tremor) => {
      const cw = w * 0.34, ch = cw / (sprCarro.rz || 1.4);
      const cx = w / 2 + steer * w * 0.05;
      const cy = h - ch * 0.5 - h * 0.02 + tremor;
      ctx.save();
      // sombra no chão
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx, cy + ch * 0.42, cw * 0.44, ch * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(cx, cy); ctx.rotate(steer * 0.03);      // inclina na curva
      ctx.drawImage(sprCarro.img, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    };

    // Capô do jogador (1ª pessoa) — desenhado no rodapé, inclina na curva.
    const drawCapo = (w, h, steer, tremor) => {
      ctx.save();
      ctx.translate(w / 2 + steer * w * 0.04, h + tremor);
      const cw = w * 0.66, ch = h * 0.26;
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(0, -ch * 0.1, cw * 0.6, ch * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      // corpo do capô
      const g = ctx.createLinearGradient(0, -ch, 0, 0);
      g.addColorStop(0, '#e11d74'); g.addColorStop(1, '#7c1d52');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-cw / 2, 0); ctx.lineTo(-cw * 0.36, -ch);
      ctx.lineTo(cw * 0.36, -ch); ctx.lineTo(cw / 2, 0); ctx.closePath(); ctx.fill();
      // faixa central
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillRect(-cw * 0.03, -ch, cw * 0.06, ch);
      // para-brisa reflexo
      ctx.fillStyle = 'rgba(90,220,255,.25)';
      ctx.beginPath();
      ctx.moveTo(-cw * 0.34, -ch); ctx.lineTo(cw * 0.34, -ch);
      ctx.lineTo(cw * 0.24, -ch * 1.5); ctx.lineTo(-cw * 0.24, -ch * 1.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    };

    const drawCeu = (w, h, curveAccum) => {
      // FUNDO por IMAGEM (paisagem panorâmica), deslizando com as curvas e em loop.
      if (sprFundo.ok) {
        const bh = h * 0.6;
        const bw = bh * (sprFundo.rz || 3);
        let off = (-st.bgOffset - curveAccum) % bw; if (off > 0) off -= bw;
        for (let bx = off; bx < w + bw; bx += bw) ctx.drawImage(sprFundo.img, bx, 0, bw, bh);
        return;
      }
      // fallback: céu retrowave desenhado
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.62);
      g.addColorStop(0, COR.ceu1); g.addColorStop(0.6, COR.ceu2); g.addColorStop(1, COR.ceu3);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.62);
      const sx = w / 2 - curveAccum * 0.5, sy = h * 0.36;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.3);
      sg.addColorStop(0, 'rgba(255,220,120,.95)'); sg.addColorStop(0.5, 'rgba(255,120,180,.5)'); sg.addColorStop(1, 'rgba(255,120,180,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, h * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,10,40,.5)';
      for (let i = 0; i < 6; i++) ctx.fillRect(sx - h * 0.2, sy - h * 0.02 + i * h * 0.03, h * 0.4, h * 0.012);
    };

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = W(), h = H(), d = dpr();
      ctx.setTransform(d, 0, 0, d, 0, 0);

      if (!pausadoRef.current && !fimRef.current) {
        st.tempo += dt;
        // ── CONTAGEM DE LARGADA: 3,2,1,JÁ! Ninguém anda antes do "JÁ!". ──
        const largou = st.largada <= 0;
        if (!largou) st.largada -= dt;

        // ── RAMPA DE TURBO: piso numa faixa brilhante → impulso de velocidade ──
        const segNaCam = pista[Math.floor(st.pos / SEG_LEN) % pista.length];
        if (largou && segNaCam.turbo && Math.abs(st.playerX - segNaCam.turbo.x) < segNaCam.turbo.w) {
          st.turbo = TURBO_DUR;
        } else if (st.turbo > 0) st.turbo -= dt;

        // ── NITRO / BOOST ──
        const querBoost = (teclas.current.boost || teclas.current.shift) && largou;
        const podeBoost = querBoost && st.nitro > 0.02 && st.speed > MAX_SPEED * 0.2;
        if (podeBoost) st.nitro = Math.max(0, st.nitro - NITRO_DRAIN * dt);
        else st.nitro = Math.min(NITRO_MAX, st.nitro + NITRO_FILL * dt);
        // intensidade visual do boost: sobe se nitro OU rampa ativos
        const impulso = podeBoost || st.turbo > 0;
        st.boost = impulso ? Math.min(1, st.boost + dt * 4) : Math.max(0, st.boost - dt * 3);
        const tetoVel = MAX_SPEED * (st.turbo > 0 ? TURBO_MULT : podeBoost ? BOOST_MULT : 1);

        // aceleração / freio (travados durante a contagem)
        const acelerando = largou && (teclas.current.up || teclas.current.w || (!teclas.current.down && !teclas.current.s));
        if (!largou) st.speed += DECEL * 1.5 * dt;
        else if (teclas.current.down || teclas.current.s) st.speed += BRAKE * dt;
        else if (st.turbo > 0) st.speed += ACCEL * 2.4 * dt;
        else if (podeBoost) st.speed += ACCEL * 1.8 * dt;
        else if (acelerando) st.speed += ACCEL * dt;
        else st.speed += DECEL * dt;
        // fora da pista freia
        const fora = Math.abs(st.playerX) > 1;
        if (fora && st.speed > OFFROAD_MAX) st.speed += OFFROAD_DECEL * dt;
        if (st.batendo > 0) { st.batendo -= dt; st.speed = Math.min(st.speed, MAX_SPEED * 0.35); }
        st.speed = clamp(st.speed, 0, tetoVel);
        // Direção e centrífuga usam a velocidade RELATIVA travada em 1 — sem isso,
        // no turbo (speed até 1.6×) tanto o giro quanto a centrífuga eram
        // amplificados e jogavam o carro pra fora do caminho (o "bug da rampa").
        const velRel = Math.min(1, st.speed / MAX_SPEED);
        const dx = dt * 2 * velRel;
        if (largou && (teclas.current.left || teclas.current.a)) st.playerX -= dx;
        if (largou && (teclas.current.right || teclas.current.d)) st.playerX += dx;
        // centrífuga na curva (mais suave e sem estourar no turbo)
        st.playerX -= dx * CENTRIFUGAL * velRel * (segNaCam.curve || 0);
        st.playerX = clamp(st.playerX, -1.6, 1.6);
        // anda (e acumula distância total pro ranking)
        st.pos = (st.pos + st.speed * dt) % trackLen;
        if (st.pos < 0) st.pos += trackLen;
        st.traveled += st.speed * dt;
        st.bgOffset += (segNaCam.curve || 0) * velRel * dt * 140;   // fundo desliza na curva
        // VOLTAS: cada trackLen percorrido = 1 volta. A corrida acaba quando a
        // MÚSICA termina (st.acabar, vindo da API do YouTube) — ou no teto de
        // segurança VOLTA_MAX, caso a música não sinalize o fim.
        st.volta = Math.floor(st.traveled / trackLen) + 1;
        if (largou && (st.acabar || st.traveled >= trackLen * VOLTA_MAX) && !fimRef.current) {
          st.rank = 1 + rivais.reduce((c, r) => c + (r.traveled > st.traveled ? 1 : 0), 0);
          fimRef.current = true;
          setFim({ rank: st.rank, voltas: st.volta });
        }

        // ── RIVAIS ──
        rivais.forEach(r => {
          // "tomou dano" ao bater num cone → fica lento por um tempo
          if (r.lento > 0) r.lento -= dt;
          if (r.turbo > 0) r.turbo -= dt;
          // alvo de velocidade: base, reduzido no dano, ampliado no turbo
          const alvo = r.base * (r.lento > 0 ? 0.45 : 1) * (r.turbo > 0 ? TURBO_MULT : 1);
          r.speed += (alvo - r.speed) * Math.min(1, dt * 2.5);   // acelera/desacelera suave
          if (!largou) r.speed = 0;                              // esperam a largada também
          r.pos = (r.pos + r.speed * dt) % trackLen;
          r.traveled += r.speed * dt;
          r.x = clamp(r.x + Math.sin(st.tempo * 0.6 + r.pos) * 0.004, -0.8, 0.8);
          const segR = pista[Math.floor(r.pos / SEG_LEN) % pista.length];
          // colisão do rival com CONE: perde aceleração (dano), igual a mim
          if (r.lento <= 0 && segR.obstaculos) {
            for (const o of segR.obstaculos) if (Math.abs(o.x - r.x) < 0.3) { r.lento = 1.1; break; }
          }
          // rival pega RAMPA DE TURBO: também dispara (a IA tende a mirar a rampa)
          if (segR.turbo) {
            if (Math.abs(r.x - segR.turbo.x) < segR.turbo.w) r.turbo = TURBO_DUR;
            else r.x += Math.sign(segR.turbo.x - r.x) * 0.01;   // desvia de leve pra pegar
          }
          // colisão comigo: os dois perdem ritmo (hitbox justo — encostou de verdade)
          let dz = r.pos - st.pos; if (dz < -trackLen / 2) dz += trackLen; if (dz > trackLen / 2) dz -= trackLen;
          if (Math.abs(dz) < SEG_LEN * 0.8 && Math.abs(r.x - st.playerX) < 0.26 && st.batendo <= 0) {
            st.batendo = 0.5; r.lento = Math.max(r.lento, 0.6);
          }
        });
        // COLOCAÇÃO: 1º + quantos rivais percorreram mais que eu
        st.rank = 1 + rivais.reduce((c, r) => c + (r.traveled > st.traveled ? 1 : 0), 0);
      }

      const baseSeg = Math.floor(st.pos / SEG_LEN);
      const camH = CAM_H + pista[baseSeg % pista.length].p1y;
      let x = 0, dx2 = 0;

      drawCeu(w, h, pista[baseSeg % pista.length].curve * 40);
      // base de grama cobrindo tudo abaixo do horizonte — evita cantos pretos onde
      // a pista (por causa de ladeira/curva) não chega até o rodapé. Usa a TEXTURA
      // de grama (pattern) se o PNG existir; senão cor lisa.
      if (sprChao.ok) {
        if (!chaoPat) {
          const oc = document.createElement('canvas'); oc.width = 220; oc.height = 220;
          oc.getContext('2d').drawImage(sprChao.img, 0, 0, 220, 220);
          chaoPat = ctx.createPattern(oc, 'repeat');
        }
        ctx.fillStyle = chaoPat;
      } else {
        ctx.fillStyle = COR.grama[1];
      }
      ctx.fillRect(0, h * 0.44, w, h * 0.56);

      let maxY = h;
      // Projeta DRAW_N segmentos à frente. A profundidade z é sempre contínua:
      // z = (índice corrido) * SEG_LEN - st.pos. O CONTEÚDO do segmento dá a volta
      // (% pista.length), mas o z NUNCA reinicia — por isso a pista é infinita e
      // não há mais aquele "buraco" na virada da volta (o bug antigo subtraía
      // trackLen do camZbase e contava a distância em dobro, empurrando os
      // segmentos da virada pra fora da tela).
      const pontos = [];
      for (let n = 0; n < DRAW_N; n++) {
        const seg = pista[(baseSeg + n) % pista.length];
        const p1 = { x: x, y: seg.p1y, z: (baseSeg + n) * SEG_LEN - st.pos };
        x += dx2; dx2 += seg.curve;
        const p2 = { x: x, y: seg.p2y, z: (baseSeg + n + 1) * SEG_LEN - st.pos };
        project(p1, st.playerX * ROAD_W, camH, 0, w, h, ROAD_W);
        project(p2, st.playerX * ROAD_W, camH, 0, w, h, ROAD_W);
        pontos.push({ seg, p1, p2 });
      }

      // Desenha de PERTO pra LONGE (n=0 é o mais próximo). O clip `maxY` faz cada
      // segmento mais distante pintar só ACIMA do anterior (nunca por cima), então
      // não há sobreposição e ladeiras escondem o que vem atrás. Iterar ao contrário
      // (o que eu tinha feito) desenhava só o horizonte e a pista sumia.
      for (let n = 0; n < pontos.length; n++) {
        const { seg, p1, p2 } = pontos[n];
        if (p1.z <= CAM_D || p2.sy >= maxY) continue;
        maxY = p2.sy;
        const escuro = seg.cor === 'dark';
        // chão: com textura, só uma FAIXA de sombra semitransparente (dá o senso de
        // movimento sem tampar a textura); sem textura, cor lisa cobrindo a faixa.
        if (sprChao.ok) {
          if (escuro) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, p2.sy, w, p1.sy - p2.sy + 1); }
        } else {
          ctx.fillStyle = COR.grama[escuro ? 0 : 1];
          ctx.fillRect(0, p2.sy, w, p1.sy - p2.sy + 1);
        }
        // zebra lateral
        quad(p1.sx, p1.sy, p1.sw * 1.15, p2.sx, p2.sy, p2.sw * 1.15, COR.zebra[escuro ? 0 : 1]);
        // pista
        quad(p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw, COR.pista[escuro ? 0 : 1]);
        // LINHA DE LARGADA/CHEGADA: tabuleiro xadrez atravessando a pista
        if (seg.start) {
          const cols = 10;
          for (let c = 0; c < cols; c++) {
            const t1 = -1 + (2 * c) / cols, t2 = -1 + (2 * (c + 1)) / cols;
            const preto = (c + (seg.index % 2)) % 2 === 0;
            ctx.fillStyle = preto ? '#12121a' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(p1.sx + t1 * p1.sw, p1.sy); ctx.lineTo(p1.sx + t2 * p1.sw, p1.sy);
            ctx.lineTo(p2.sx + t2 * p2.sw, p2.sy); ctx.lineTo(p2.sx + t1 * p2.sw, p2.sy);
            ctx.closePath(); ctx.fill();
          }
        } else if (!escuro) {
          // faixas de divisão de pista
          for (let l = 1; l < LANES; l++) {
            const lx1 = p1.sx - p1.sw + (2 * p1.sw) * (l / LANES);
            const lx2 = p2.sx - p2.sw + (2 * p2.sw) * (l / LANES);
            quad(lx1, p1.sy, p1.sw * 0.012, lx2, p2.sy, p2.sw * 0.012, COR.linha);
          }
        }
        // RAMPA DE TURBO: faixa ciano brilhante + setas amarelas animadas apontando
        // pra frente (some quando muito longe pra não poluir o horizonte).
        if (seg.turbo && p1.sw > 6) {
          const { x: tx, w: tw } = seg.turbo;
          const xL1 = p1.sx + (tx - tw) * p1.sw, xR1 = p1.sx + (tx + tw) * p1.sw;
          const xL2 = p2.sx + (tx - tw) * p2.sw, xR2 = p2.sx + (tx + tw) * p2.sw;
          ctx.fillStyle = 'rgba(34,211,238,.4)';
          ctx.beginPath();
          ctx.moveTo(xL1, p1.sy); ctx.lineTo(xR1, p1.sy); ctx.lineTo(xR2, p2.sy); ctx.lineTo(xL2, p2.sy);
          ctx.closePath(); ctx.fill();
          // seta (chevron) rolando: acende 1 a cada 3 segmentos, alternando no tempo
          if (seg.index % 3 === Math.floor(st.tempo * 9) % 3) {
            ctx.fillStyle = 'rgba(255,236,120,.95)';
            ctx.beginPath();
            ctx.moveTo(xL1, p1.sy); ctx.lineTo((xL2 + xR2) / 2, p2.sy); ctx.lineTo(xR1, p1.sy);
            ctx.closePath(); ctx.fill();
          }
        }
      }

      // Distribui os RIVAIS nos segmentos visíveis (bucket por profundidade).
      const spritesPorSeg = {};
      rivais.forEach(r => {
        let dz = r.pos - st.pos; if (dz < 0) dz += trackLen;
        const nSeg = Math.round(dz / SEG_LEN);
        if (nSeg >= 0 && nSeg < pontos.length) (spritesPorSeg[nSeg] = spritesPorSeg[nSeg] || []).push(r);
      });

      // Cenário lateral + obstáculos + rivais, de LONGE pra PERTO (perto por cima).
      for (let n = pontos.length - 1; n >= 0; n--) {
        const { seg, p1 } = pontos[n];
        if (p1.z <= CAM_D) continue;
        // CENÁRIO de beira de pista — BEM afastado da pista (2.2× a meia-largura)
        // pra nunca invadir/cobrir a pista (senão parece que o carro os atropela).
        if (seg.cenario && p1.sw > 5 && sprCenarios.length) {
          const { lado, variante } = seg.cenario;
          const spr = sprCenarios[variante % sprCenarios.length];
          if (spr?.ok) {
            const cx = p1.sx + lado * p1.sw * 2.2;                       // longe da pista
            const larg = Math.min(w * 0.46, p1.sw * tema.cenarioLarg);
            if (larg >= 3) drawBillboard(spr, cx, p1.sy, larg, false);
          }
        }
        // PLACA "Uniko" (sprite compartilhado entre os mapas)
        if (seg.placa && p1.sw > 5 && sprPlaca.ok) {
          const cx = p1.sx + seg.placa.lado * p1.sw * 2.2;
          const larg = Math.min(w * 0.42, p1.sw * 0.7);
          if (larg >= 3) drawBillboard(sprPlaca, cx, p1.sy, larg, false);
        }
        // obstáculos (pneu/cone)
        (seg.obstaculos || []).forEach(o => {
          const cx = p1.sx + o.x * p1.sw, larg = Math.min(w * 0.16, p1.sw * 0.28);
          if (larg < 2) return;
          if (sprCone.ok) drawBillboard(sprCone, cx, p1.sy, larg);
          else drawCone(cx, p1.sy, larg);
          if (n < 2 && Math.abs(o.x - st.playerX) < 0.17 && st.batendo <= 0 && !pausadoRef.current) st.batendo = 0.45;
        });
        // rivais — largura escala com a distância, mas com TETO (~30% da tela) pra
        // não virar um blocão gigante quando estão colados na câmera. Fica na
        // mesma proporção do carro do jogador (chase cam, ~34%).
        (spritesPorSeg[n] || []).forEach(r => {
          const cx = p1.sx + r.x * p1.sw, larg = Math.min(w * 0.3, p1.sw * 0.3);
          if (larg < 2) return;
          if (r.sprite?.ok) drawBillboard(r.sprite, cx, p1.sy, larg);
          else drawCarro(cx, p1.sy, larg, r.cor);
        });
      }

      // carro do jogador: sprite chase cam se o PNG existir; senão o capô desenhado
      const steer = (teclas.current.left || teclas.current.a ? -1 : 0) + (teclas.current.right || teclas.current.d ? 1 : 0);
      const tremor = st.speed > MAX_SPEED * 0.7 ? Math.sin(st.tempo * 40) * 1.5 : 0;
      const inclina = steer + st.playerX * 0.3;
      const bal = tremor + (st.batendo > 0 ? Math.sin(st.tempo * 60) * 4 : 0);
      if (sprCarro.ok) drawCarroJogador(w, h, inclina, bal);
      else drawCapo(w, h, inclina, bal);

      // flash de batida
      if (st.batendo > 0) {
        ctx.fillStyle = `rgba(255,40,40,${st.batendo * 0.4})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── BOOST: linhas de velocidade radiais saindo do centro + vinheta azul ──
      if (st.boost > 0.02) {
        ctx.save();
        const cx = w / 2, cy = h * 0.42, b = st.boost;
        const vg = ctx.createRadialGradient(cx, cy, h * 0.1, cx, cy, w * 0.7);
        vg.addColorStop(0, 'rgba(0,200,255,0)');
        vg.addColorStop(1, `rgba(40,140,255,${0.28 * b})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = `rgba(180,240,255,${0.5 * b})`; ctx.lineWidth = 2;
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2 + st.tempo * 3;
          const r0 = h * 0.18 + (Math.sin(i * 12.9 + st.tempo * 30) * 0.5 + 0.5) * h * 0.1;
          const r1 = r0 + h * (0.16 + 0.14 * b);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── CONTAGEM DE LARGADA: 3 · 2 · 1 · JÁ! ──
      if (st.largada > 0) {
        const n = Math.ceil(st.largada - 0.2);
        const txt = n <= 0 ? 'JÁ!' : String(n);
        const frac = 1 - (st.largada % 1);   // "pulsa" a cada número
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.min(w, h) * (0.22 + frac * 0.05)}px var(--font-brand), sans-serif`;
        ctx.fillStyle = n <= 0 ? '#22e06a' : '#fff';
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20;
        ctx.fillText(txt, w / 2, h * 0.4);
        ctx.restore();
      }

      // ── MINIMAPA REDONDO (canto inf. dir.): o circuito é um loop, então vira um
      //    anel; cada carro é um ponto na sua volta (progresso → ângulo). Dá pra
      //    ver quem está na frente. ──
      const mmR = Math.min(w, h) * 0.11, mmX = w - mmR - 22, mmY = h - mmR - 22;
      const ang = (p) => (p / trackLen) * Math.PI * 2 - Math.PI / 2;   // 0 no topo
      const ponto = (p) => [mmX + Math.cos(ang(p)) * mmR, mmY + Math.sin(ang(p)) * mmR];
      ctx.save();
      ctx.beginPath(); ctx.arc(mmX, mmY, mmR + 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,6,22,.6)'; ctx.fill();
      ctx.beginPath(); ctx.arc(mmX, mmY, mmR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(3, mmR * 0.16); ctx.stroke();
      rivais.forEach(r => { const [px, py] = ponto(r.pos); ctx.fillStyle = r.cor; ctx.beginPath(); ctx.arc(px, py, mmR * 0.12, 0, Math.PI * 2); ctx.fill(); });
      const [ex, ey] = ponto(st.pos);   // você = ponto branco maior com anel ciano
      ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(ex, ey, mmR * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      // HUD (atualiza o React ~8x/s — nitro/posição pedem mais fluidez)
      if (!pausadoRef.current && Math.floor(st.tempo * 8) !== Math.floor((st.tempo - dt) * 8)) {
        const distM = Math.floor(st.traveled / 100);   // "metros" percorridos no total
        const b = Math.max(bestRef.current, distM);
        if (b > bestRef.current) { bestRef.current = b; setBest(b); try { localStorage.setItem('uf_best', String(b)); } catch { /* sem storage */ } }
        setHud({ vel: Math.floor(st.speed / SEG_LEN * 4), dist: distM, best: b, rank: st.rank, nitro: st.nitro, volta: st.volta || 1, boost: st.boost > 0.15 });
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    const kd = (e) => {
      if (e.key === 'Escape') { setPausado(p => !p); return; }
      setTecla(e, true);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    const ku = (e) => setTecla(e, false);
    const setTecla = (e, v) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup') teclas.current.up = v;
      if (k === 'arrowdown') teclas.current.down = v;
      if (k === 'arrowleft') teclas.current.left = v;
      if (k === 'arrowright') teclas.current.right = v;
      if (k === 'shift' || k === ' ') teclas.current.shift = v;   // nitro
      if ('wasd'.includes(k)) teclas.current[k] = v;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      cancelAnimationFrame(rafRef.current); ro.disconnect();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    };
  }, [mapa, tracado, bestRef, setBest, setHud, setPausado, setFim]);

  // botões de toque (celular) — setam as mesmas flags
  const touch = (dir, v) => { teclas.current[dir] = v; };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0,
      borderRadius: 16, overflow: 'hidden', background: '#0a0616' }}>
      <style>{FASTER_CSS}</style>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />

      {/* Música — player oculto criado pela IFrame API (toca 1x; ao acabar, encerra a
          corrida). Fica num WRAPPER estável: a API do YouTube SUBSTITUI a div interna
          por um <iframe> por fora do React; sem o wrapper, mostrar/esconder o NITRO ao
          lado quebrava a reconciliação (erro insertBefore). */}
      <div aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div ref={ytHolder} />
      </div>

      {/* MOLDURA DE NITRO — aparece durante nitro/rampa. mix-blend-mode:screen faz o
          centro preto da imagem sumir e a moldura neon brilhar sobre a tela. */}
      <img src="/unikofaster/borda-nitro.png" alt="" aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill',
          mixBlendMode: 'screen', pointerEvents: 'none', opacity: hud.boost ? 1 : 0, transition: 'opacity .12s' }} />
      {/* Texto NITRO gigante */}
      {hud.boost && (
        <div key="nitro" className="uf-nitro-txt" aria-hidden
          style={{ position: 'absolute', top: '16%', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          NITRO
        </div>
      )}

      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', pointerEvents: 'none' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1,
            textShadow: '0 2px 12px rgba(0,0,0,.6)' }}>
            {hud.vel}<span style={{ fontSize: 15, opacity: .8 }}> km/h</span>
          </div>
          <div style={{ fontSize: 13, color: '#22d3ee', fontWeight: 800, marginTop: 4, textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>
            {hud.dist.toLocaleString('pt-BR')} m · 🏁 {hud.best.toLocaleString('pt-BR')} m
          </div>
          {/* barra de NITRO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#ffd166', textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>⚡</span>
            <div style={{ width: 120, height: 9, borderRadius: 999, background: 'rgba(0,0,0,.45)',
              border: '1px solid rgba(255,255,255,.25)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(hud.nitro * 100)}%`, height: '100%',
                background: hud.nitro > 0.15 ? 'linear-gradient(90deg,#22d3ee,#3b82f6)' : '#ef4444',
                transition: 'width .12s linear' }} />
            </div>
          </div>
        </div>
        {/* COLOCAÇÃO + VOLTA */}
        <div style={{ textAlign: 'center', lineHeight: 1 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, color: '#ffd166',
            fontSize: 44, textShadow: '0 2px 14px rgba(0,0,0,.7)' }}>
            {hud.rank}º
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.9)', textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>
            de {RIVAIS_N + 1}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#22d3ee', marginTop: 6, textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>
            🏁 Volta {hud.volta || 1}
          </div>
        </div>
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 8 }}>
          <button className="uf-btn" onClick={() => setPausado(p => !p)}
            style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.3)',
              background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {pausado ? '▸ Continuar' : '⏸ Pausar'}
          </button>
          <button className="uf-btn" onClick={onSair}
            style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.3)',
              background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Sair
          </button>
        </div>
      </div>

      {/* faixa da música tocando */}
      {trilha?.title && (
        <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,.5)', pointerEvents: 'none',
          maxWidth: '70%' }}>
          <span className="uf-note">🎵</span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{trilha.title}</span>
        </div>
      )}

      {/* controles de toque (celular) — direção à direita */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 12, pointerEvents: 'none' }}>
        {[['left', '◀'], ['right', '▶']].map(([dir, ic]) => (
          <button key={dir} className="uf-touch"
            onPointerDown={() => touch(dir, true)} onPointerUp={() => touch(dir, false)}
            onPointerLeave={() => touch(dir, false)} onContextMenu={e => e.preventDefault()}
            style={{ pointerEvents: 'auto', width: 62, height: 62, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,.35)', background: 'rgba(124,58,237,.5)',
              color: '#fff', fontSize: 22, cursor: 'pointer', touchAction: 'none' }}>{ic}</button>
        ))}
      </div>
      {/* botão de NITRO à esquerda */}
      <div style={{ position: 'absolute', bottom: 70, left: 16, pointerEvents: 'none' }}>
        <button className="uf-touch"
          onPointerDown={() => touch('shift', true)} onPointerUp={() => touch('shift', false)}
          onPointerLeave={() => touch('shift', false)} onContextMenu={e => e.preventDefault()}
          style={{ pointerEvents: 'auto', width: 70, height: 70, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,.4)', background: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
            color: '#fff', fontSize: 26, fontWeight: 800, cursor: 'pointer', touchAction: 'none',
            boxShadow: '0 4px 16px rgba(6,182,212,.5)' }}>⚡</button>
      </div>

      {/* overlay de pausa */}
      {pausado && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 14, background: 'rgba(10,6,22,.72)', backdropFilter: 'blur(3px)' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 30, fontWeight: 800, color: '#fff' }}>Pausado</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', textAlign: 'center', lineHeight: 1.6 }}>
            Setas ou A/D pra virar · ↑ acelera · ↓ freia<br />
            <b style={{ color: '#22d3ee' }}>Shift ou Espaço</b> = nitro ⚡ · <b style={{ color: '#ffd166' }}>Esc</b> = pausar<br />
            Pise nas <b style={{ color: '#22d3ee' }}>rampas azuis</b> pra ganhar turbo e ultrapassar 🏎️💨
          </div>
          <button className="uf-btn" onClick={() => setPausado(false)}
            style={{ padding: '11px 28px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>▸ Continuar</button>
        </div>
      )}

      {/* TELA DE CHEGADA — cruzou a linha na última volta */}
      {fim && (() => {
        const venceu = fim.rank === 1;
        const medalha = fim.rank === 1 ? '🥇' : fim.rank === 2 ? '🥈' : fim.rank === 3 ? '🥉' : '🏁';
        return (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, textAlign: 'center', padding: 20,
            background: 'rgba(10,6,22,.82)', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontSize: 64, lineHeight: 1 }}>{medalha}</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 34, fontWeight: 800,
              color: venceu ? '#ffd166' : '#fff' }}>
              {venceu ? 'VOCÊ VENCEU!' : 'Corrida encerrada!'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22d3ee' }}>
              Você chegou em <b style={{ color: '#fff' }}>{fim.rank}º</b> de {RIVAIS_N + 1}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>
              🎵 a música acabou · {fim.voltas || hud.volta || 1} volta{(fim.voltas || 1) > 1 ? 's' : ''} · 🏁 recorde {hud.best.toLocaleString('pt-BR')} m
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="uf-btn" onClick={onReiniciar}
                style={{ padding: '12px 28px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                  cursor: 'pointer', background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>▸ Correr de novo</button>
              <button className="uf-btn" onClick={onSair}
                style={{ padding: '12px 28px', borderRadius: 999, border: '1px solid rgba(255,255,255,.3)', color: '#fff',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer', background: 'rgba(0,0,0,.4)' }}>✕ Sair</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// retângulo arredondado
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const US_ACCENT = '#7c3aed';
const FASTER_CSS = `
@keyframes ufGrid { 0% { background-position: 0 0; } 100% { background-position: 0 40px; } }
.uf-grid { position: absolute; inset: 0; opacity: .18; pointer-events: none;
  background-image: linear-gradient(rgba(34,211,238,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.5) 1px, transparent 1px);
  background-size: 40px 40px; animation: ufGrid 1.2s linear infinite; mask-image: linear-gradient(transparent, #000 80%); }
.uf-btn { transition: transform .12s, filter .12s; }
.uf-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.uf-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
.uf-song:hover { border-color: ${US_ACCENT}88 !important; }
.uf-touch:active { background: rgba(124,58,237,.85) !important; }
@keyframes ufNote { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-2px) rotate(6deg); } }
.uf-note { display: inline-block; animation: ufNote .6s ease-in-out infinite; }
@keyframes ufFloat { 0%,100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-6px) rotate(1.5deg); } }
.uf-icone { animation: ufFloat 3s ease-in-out infinite; }
/* ── tela inicial Arcade brilhante ── */
@keyframes ufBlob { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(26px,-22px) scale(1.14); } }
.uf-blob { position: absolute; border-radius: 50%; filter: blur(46px); pointer-events: none; animation: ufBlob 14s ease-in-out infinite; z-index: 0; }
.uf-blob2 { animation-duration: 18s; animation-direction: reverse; }
.uf-blob3 { animation-duration: 16s; }
@keyframes ufHue { to { background-position: 250% 0; } }
.uf-title { background: linear-gradient(100deg, #1e293b 0%, #64748b 30%, #f8fafc 47%, #64748b 63%, #1e293b 100%); background-size: 250% 100%;
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  animation: ufHue 6.5s linear infinite; filter: drop-shadow(0 1px 0 rgba(255,255,255,.7)) drop-shadow(0 6px 18px rgba(34,211,238,.4)); }
@keyframes ufFloatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.uf-float { animation: ufFloatY 3.4s ease-in-out infinite; }
.uf-float-2 { animation: ufFloatY 4.4s ease-in-out infinite; }
@keyframes ufSpark { 0%,100% { opacity: .2; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.15); } }
.uf-spark { position: absolute; border-radius: 50%; background: #fff; box-shadow: 0 0 8px #fff; pointer-events: none; z-index: 0; animation: ufSpark 2.4s ease-in-out infinite; }
.uf-panel-btn { transition: transform .14s, box-shadow .14s, border-color .14s; }
.uf-panel-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(34,211,238,.4) !important; }
@keyframes ufCta { 0%,100% { box-shadow: 0 6px 20px rgba(124,58,237,.5); } 50% { box-shadow: 0 6px 30px rgba(34,211,238,.75); } }
.uf-cta { animation: ufCta 2.6s ease-in-out infinite; }
/* moldura da tela inicial: mantém a proporção da imagem (não distorce) e enche a
   largura. No mobile vira mais alta pra o conteúdo caber. */
.uf-hero-frame { min-height: 0; }
/* Texto NITRO (slam neon) durante o boost */
@keyframes ufNitroIn { 0% { transform: scale(.5) skewX(-12deg); opacity: 0; } 55% { transform: scale(1.15) skewX(-12deg); opacity: 1; } 100% { transform: scale(1) skewX(-12deg); opacity: 1; } }
.uf-nitro-txt { font-family: var(--font-brand), sans-serif; font-weight: 900; font-style: italic; line-height: 1;
  font-size: clamp(46px, 13vw, 118px); letter-spacing: .03em;
  background: linear-gradient(180deg, #a5f3fc, #22d3ee 42%, #ec4899);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  filter: drop-shadow(0 3px 0 rgba(0,0,0,.35)) drop-shadow(0 0 26px rgba(34,211,238,.9)) drop-shadow(0 0 46px rgba(236,72,153,.65));
  animation: ufNitroIn .32s cubic-bezier(.2,1.4,.4,1) both; }
@media (prefers-reduced-motion: reduce) {
  .uf-grid, .uf-note, .uf-icone, .uf-blob, .uf-title, .uf-float, .uf-float-2, .uf-spark, .uf-cta, .uf-nitro-txt { animation: none !important; }
}
`;

export { TabUnikoFaster };
export default TabUnikoFaster;
