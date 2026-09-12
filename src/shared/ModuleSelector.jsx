import React, { useState, useRef, useEffect, useMemo } from 'react';
import { T, applyTheme } from '../contexts/theme';
import { AvatarCircle } from './components';
import { SettingsModal } from './SettingsModal';
import { calcularOrbita } from './orbita';
/* O catálogo de atalhos são as próprias abas do Portal do Colaborador. Vem da
   lista NAV em vez de uma cópia local de propósito: assim uma aba nova nasce
   disponível como atalho sem ninguém lembrar de duplicar rótulo e ícone aqui.
   (É o único ponto em que shared/ importa de modules/ — o preço de ter uma
   fonte de verdade só.) */
import { NAV } from '../modules/central-colaborador/Sidebar';
import { useIsMobile } from '../hooks/useIsMobile';

/* Ordem pessoal dos módulos na tela — por usuário (mesmo padrão de outras
   preferências client-only do app: chave por CPF, senão nome, senão 'anon'). */
const MODULE_ORDER_PREFIX = 'uniko_module_order_';
const orderKey = (authUser) => MODULE_ORDER_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
const loadModuleOrder = (authUser) => {
  try { const r = JSON.parse(localStorage.getItem(orderKey(authUser)) || '[]'); return Array.isArray(r) ? r : []; }
  catch { return []; }
};
const saveModuleOrder = (authUser, order) => { try { localStorage.setItem(orderKey(authUser), JSON.stringify(order)); } catch { /* ignora */ } };
// Módulos na ordem salva primeiro (na ordem salva); os que não estão nela (novos
// módulos, ou 1ª vez do usuário) ficam no fim, na ordem padrão entre si.
const applyOrder = (list, order) => {
  if (!order || !order.length) return list;
  const idx = new Map(order.map((id, i) => [id, i]));
  return [...list].sort((a, b) => (idx.has(a.id) ? idx.get(a.id) : 999) - (idx.has(b.id) ? idx.get(b.id) : 999));
};

/* Posição livre do card de perfil (avatar/editar perfil/config/sair) — o usuário
   pode arrastá-lo pra qualquer lugar da tela; fica salvo por navegador. Sem
   posição salva, usa o canto padrão (top:16, right:20). */
const CARD_POS_KEY = 'uniko_profile_card_pos';
const loadCardPos = () => {
  try { const p = JSON.parse(localStorage.getItem(CARD_POS_KEY) || 'null'); if (p && typeof p.x === 'number' && typeof p.y === 'number') return p; }
  catch { /* ignora */ }
  return null;
};
const saveCardPos = (p) => { try { localStorage.setItem(CARD_POS_KEY, JSON.stringify(p)); } catch { /* ignora */ } };

/* Tamanho pessoal de cada bolha — por usuário, igual à ordem. Guarda só os
   módulos que a pessoa mexeu (multiplicador != 1); o resto fica no padrão. */
const MODULE_SIZE_PREFIX = 'uniko_module_size_';
const sizeKey = (authUser) => MODULE_SIZE_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
const loadSizePrefs = (authUser) => {
  try { const r = JSON.parse(localStorage.getItem(sizeKey(authUser)) || '{}'); return (r && typeof r === 'object') ? r : {}; }
  catch { return {}; }
};
const saveSizePrefs = (authUser, prefs) => { try { localStorage.setItem(sizeKey(authUser), JSON.stringify(prefs)); } catch { /* ignora */ } };
/* Atalhos na órbita — bolhas que levam direto a uma ABA do Portal (Uniko
   Paint, Uniko Wave, Colegas...) em vez de a um módulo. Guardados por usuário,
   igual à ordem/tamanho/cor: é uma preferência de tela, não um dado do RH. */
const ATALHOS_PREFIX = 'uniko_module_atalhos_';
const atalhosKey = (authUser) => ATALHOS_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
const loadAtalhos = (authUser) => {
  try { const r = JSON.parse(localStorage.getItem(atalhosKey(authUser)) || '[]'); return Array.isArray(r) ? r : []; }
  catch { return []; }
};
const saveAtalhos = (authUser, ids) => { try { localStorage.setItem(atalhosKey(authUser), JSON.stringify(ids)); } catch { /* ignora */ } };
/* Prefixo no id da bolha pra o atalho nunca colidir com o id de um módulo —
   os dois convivem na mesma lista de ordem, tamanho e cor. */
const ATALHO_ID = (tab) => `atalho:${tab}`;

// 4 tamanhos discretos (não contínuo) — assim dá pra GARANTIR que o algoritmo
// de espaçamento da órbita sempre encontra um jeito de encaixar todo mundo
// sem uma bolha maior comer o espaço da vizinha.
const SIZE_STEPS = [
  { id:'p',  label:'P',  mult:0.82 },
  { id:'m',  label:'M',  mult:1    },
  { id:'g',  label:'G',  mult:1.18 },
  { id:'gg', label:'GG', mult:1.35 },
];

/* Cor pessoal de cada bolha — mesmo padrão de tamanho/ordem: só guarda quem
   a pessoa mudou (id de uma cor da paleta); o resto usa a cor padrão do
   próprio módulo (a do tema, ou a fixa de módulos como Uniko FIT). */
const MODULE_COLOR_PREFIX = 'uniko_module_color_';
const colorKey = (authUser) => MODULE_COLOR_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
const loadColorPrefs = (authUser) => {
  try { const r = JSON.parse(localStorage.getItem(colorKey(authUser)) || '{}'); return (r && typeof r === 'object') ? r : {}; }
  catch { return {}; }
};
const saveColorPrefs = (authUser, prefs) => { try { localStorage.setItem(colorKey(authUser), JSON.stringify(prefs)); } catch { /* ignora */ } };
const COLOR_STEPS = [
  { id:'blue',   label:'Azul',    hex:'#3B82F6' },
  { id:'purple', label:'Roxo',    hex:'#8B5CF6' },
  { id:'pink',   label:'Rosa',    hex:'#EC4899' },
  { id:'red',    label:'Vermelho',hex:'#EF4444' },
  { id:'orange', label:'Laranja', hex:'#F97316' },
  { id:'yellow', label:'Amarelo', hex:'#EAB308' },
  { id:'green',  label:'Verde',   hex:'#22C55E' },
  { id:'teal',   label:'Turquesa',hex:'#14B8A6' },
];

/* Wordmark "UNIKO" desenhado em traços (monoline). O "N" é um "U" invertido. Um ponto de luz
   AZUL PERCORRE o traço de cada letra (do início ao fim, dando a volta) e pula pra próxima,
   em loop — como se estivesse escrevendo. */
const UnikoName = () => {
  const W = 11, DUR = 3.2, N = 5;
  const paths = [
    'M18,18 L18,80 Q18,112 50,112 Q82,112 82,80 L82,18',                          // U
    'M128,112 L128,50 Q128,18 160,18 Q192,18 192,50 L192,112',                    // N (U invertido)
    'M238,18 L238,112',                                                           // I
    'M284,18 L284,112 M341,18 L286,65 L345,112',                                  // K
    'M430,18 Q469,18 469,65 Q469,112 430,112 Q391,112 391,65 Q391,18 430,18 Z',   // O
  ];
  return (
    <svg viewBox="0 0 487 130" role="img" aria-label="UNIKO"
      style={{ height:'0.82em', width:'auto', display:'inline-block', verticalAlign:'middle', overflow:'visible', color:'inherit' }}>
      <style>{`@keyframes uTrace{0%{stroke-dashoffset:0;opacity:1}20%{stroke-dashoffset:-1;opacity:1}20.01%,100%{opacity:0}}`}</style>
      {paths.map((d, i) => (
        <g key={i}>
          {/* letra (cor do texto) */}
          <path d={d} fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round"/>
          {/* ponto de luz azul percorrendo o traço */}
          <path d={d} fill="none" stroke="#4AA6FF" strokeWidth={W + 1} strokeLinecap="round" strokeLinejoin="round"
            pathLength="1"
            style={{ strokeDasharray:'0.05 1', strokeDashoffset:0, opacity:0,
              filter:'drop-shadow(0 0 4px #4AA6FF) drop-shadow(0 0 9px #4AA6FF)',
              animation:`uTrace ${DUR}s linear infinite`, animationDelay:`${(i / N) * DUR}s` }}/>
        </g>
      ))}
    </svg>
  );
};

/* Ícone do Uniko na home: flutua de leve (lento) e PISCA a cada 3s com 3 frames —
   normal (UNIKO_NEW) → meio fechado (UNIKO_PISCA_FRAME_2) → fechado (UNIKO_PISCA) → meio → normal. */
const UnikoMascot = ({ size }) => {
  const img = { position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain' };
  return (
    <div style={{ position:'relative', width:size, height:size, animation:'unikoFloat 5s ease-in-out infinite',
      filter:`drop-shadow(0 8px 26px ${T.goldLine}44)` }}>
      <style>{`
        @keyframes unikoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes unikoBlinkTop{0%,90%{opacity:1}90.6%,99%{opacity:0}99.4%,100%{opacity:1}}
        @keyframes unikoBlinkMid{0%,93.8%{opacity:1}94.2%,96%{opacity:0}96.4%,100%{opacity:1}}
      `}</style>
      {/* base: olho FECHADO */}
      <img src="/UNIKO_PISCA.png" alt="" aria-hidden="true" style={img}/>
      {/* meio: olho MEIO FECHADO (aparece no fechar e no abrir) */}
      <img src="/UNIKO_PISCA_FRAME_2.png" alt="" aria-hidden="true" style={{ ...img, animation:'unikoBlinkMid 3s linear infinite' }}/>
      {/* topo: NORMAL — some durante a piscada revelando os frames abaixo */}
      <img src="/UNIKO_NEW.png" alt="Uniko" style={{ ...img, animation:'unikoBlinkTop 3s linear infinite' }}/>
    </div>
  );
};

/* Estrelas cadentes cruzando o fundo — mesmo efeito da capa/hero da aba
   Início do Portal do Colaborador. Aqui a tela é bem maior, então espalha
   mais riscos por toda a área em vez de só 3. */
const ESTRELINHAS_ORBITA = [
  { dur:26, r:3.5, fill:'branco' },
  { dur:19, r:3,   fill:'gold'   },
  { dur:13, r:2.6, fill:'branco' },
];

const SHOOT_POS = [
  {x:'8%',  y:'10%', delay:'-1.5s'}, {x:'64%', y:'6%',  delay:'-3.8s'},
  {x:'30%', y:'20%', delay:'-0.6s'}, {x:'86%', y:'32%', delay:'-2.4s'},
  {x:'46%', y:'66%', delay:'-4.6s'}, {x:'14%', y:'74%', delay:'-1.1s'},
  {x:'74%', y:'78%', delay:'-3.1s'},
];

/* Trilha elíptica das estrelinhas em órbita, como keyframes de transform.

   Antes isso era <animateMotion> (SMIL), e SMIL é a pior opção possível aqui:
   o navegador não consegue compor essa animação, então a cada frame ele
   INVALIDA e repinta o SVG inteiro da órbita — os três anéis, os pontinhos
   entre as bolhas e as próprias estrelinhas, numa área de 1420x800. Era o
   maior custo de desenho da tela, por três bolinhas de 3px.

   Com transform em keyframes a bolinha vira uma camada que o compositor só
   desloca, e o SVG dos anéis passa a ser pintado uma vez e nunca mais. A
   elipse sai aproximada por 40 passos — o suficiente pra não se ver canto. */
const trilhaOrbital = (nome, rx, ry, passos = 40) => {
  let quadros = '';
  for (let i = 0; i <= passos; i++) {
    const t = i / passos, a = t * Math.PI * 2 - Math.PI / 2;
    quadros += `${(t * 100).toFixed(2)}%{transform:translate(${(rx * Math.cos(a)).toFixed(1)}px,${(ry * Math.sin(a)).toFixed(1)}px)}`;
  }
  return `@keyframes ${nome}{${quadros}}`;
};

const ModuleSelector = ({onSelect, authUser, onLogout, userPhoto}) => {
  const [hov, sh]     = useState(null);
  const [pressed, setPressed] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  // Em qual aba o modal de configurações abre: 'theme' (cor do sistema) ou
  // 'account' (senha/dados). Cada uma tem o seu botão no card.
  const [painelConfig, setPainelConfig] = useState('theme');
  const [activeTheme, setActiveTheme] = useState(() => {
    const s = localStorage.getItem('ch_theme') || 'blue'; applyTheme(s); return s;
  });
  const handleTheme = (key) => { applyTheme(key); setActiveTheme(key); localStorage.setItem('ch_theme', key); };
  const [reorderMode, setReorderMode] = useState(false);
  const [order, setOrder]   = useState(() => loadModuleOrder(authUser));
  const [dragModId, setDragModId] = useState(null);
  // Modo "tamanho dos módulos" — toca numa bolha pra escolher o tamanho SÓ
  // dela, ou usa "Todos" no banner pra aplicar o mesmo tamanho em todo mundo.
  const [sizeMode, setSizeMode] = useState(false);
  const [sizePrefs, setSizePrefs] = useState(() => loadSizePrefs(authUser));
  const [sizingId, setSizingId] = useState(null);
  const getSizeMult = (id) => SIZE_STEPS.find(s => s.id === (sizePrefs[id] || 'm'))?.mult || 1;
  const setModuleSize = (id, stepId) => {
    setSizePrefs(prev => {
      const next = { ...prev };
      if (stepId === 'm') delete next[id]; else next[id] = stepId;
      saveSizePrefs(authUser, next);
      return next;
    });
  };
  const setAllSizes = (stepId) => {
    setSizePrefs(() => {
      const next = {};
      if (stepId !== 'm') filteredMods.forEach(m => { next[m.id] = stepId; });
      saveSizePrefs(authUser, next);
      return next;
    });
  };
  // Modo "cor dos módulos" — mesmo esquema do tamanho: toca numa bolha pra
  // escolher a cor SÓ dela, ou usa "Todos" no banner pra aplicar em todo mundo.
  // Modo "atalhos" — escolhe quais abas do Portal ganham bolha na órbita.
  const [atalhoMode, setAtalhoMode] = useState(false);
  const [atalhos, setAtalhos] = useState(() => loadAtalhos(authUser));
  const toggleAtalho = (tab) => {
    setAtalhos(prev => {
      const next = prev.includes(tab) ? prev.filter(t => t !== tab) : [...prev, tab];
      saveAtalhos(authUser, next);
      return next;
    });
  };
  const [colorMode, setColorMode] = useState(false);
  /* Os quatro modos de personalizar a órbita são mutuamente exclusivos, e cada
     botão repetia os cinco setStates pra desligar os outros. Um lugar só:
     liga o pedido, desliga o resto, e limpa a bolha que estava selecionada. */
  const abrirModo = (qual) => {
    setReorderMode(m => qual === 'ordem'   ? !m : false);
    setSizeMode(   m => qual === 'tamanho' ? !m : false);
    setColorMode(  m => qual === 'cor'     ? !m : false);
    setAtalhoMode( m => qual === 'atalhos' ? !m : false);
    setSizingId(null);
    setColoringId(null);
  };
  const [colorPrefs, setColorPrefs] = useState(() => loadColorPrefs(authUser));
  const [coloringId, setColoringId] = useState(null);
  // Sem cor escolhida, mantém a cor ORIGINAL do módulo (a do tema, ou a fixa
  // de módulos como Uniko FIT) — só troca quando a pessoa mexeu de propósito.
  const getModuleColor = (m) => {
    const step = COLOR_STEPS.find(s => s.id === colorPrefs[m.id]);
    return step ? { color: step.hex, bg: step.hex + '22' } : { color: m.color, bg: m.bg };
  };
  /* ── Desfazer/refazer das cores ─────────────────────────────────────────
     Pintar as 9 bolhas de uma vez e se arrepender era caro: não havia volta,
     só repintar uma a uma no olho — e a cor "original" de cada módulo nem
     aparece na paleta pra ser reescolhida. Então toda alteração de cor passa
     por `mudarCores`, que empilha o estado ANTERIOR antes de aplicar o novo.
     Ctrl+Z volta, Ctrl+Shift+Z (ou Ctrl+Y) refaz, e o mesmo par está no
     banner como botão, pra quem não tenta atalho.

     Os estados são objetos pequenos ({id do módulo: id da cor}), então
     guardar 50 passos não pesa nada.

     Cuidado que vale registrar: nada disso pode acontecer DENTRO de um
     updater de setState. O React roda updater duas vezes em StrictMode, e a
     pilha ganharia entradas duplicadas. Por isso o próximo estado é montado
     a partir de `colorPrefs` aqui fora, e os três setState são irmãos. */
  const [colorUndo, setColorUndo] = useState([]);
  const [colorRedo, setColorRedo] = useState([]);
  const PASSOS_COR = 50;

  const mudarCores = (next) => {
    setColorUndo(h => [...h, colorPrefs].slice(-PASSOS_COR));
    setColorRedo([]);                       // ramo novo: o que era "refazer" morreu
    setColorPrefs(next);
    saveColorPrefs(authUser, next);
  };
  const desfazerCor = () => {
    if (!colorUndo.length) return;
    const anterior = colorUndo[colorUndo.length - 1];
    setColorUndo(colorUndo.slice(0, -1));
    setColorRedo(r => [...r, colorPrefs].slice(-PASSOS_COR));
    setColorPrefs(anterior);
    saveColorPrefs(authUser, anterior);
  };
  const refazerCor = () => {
    if (!colorRedo.length) return;
    const proximo = colorRedo[colorRedo.length - 1];
    setColorRedo(colorRedo.slice(0, -1));
    setColorUndo(h => [...h, colorPrefs].slice(-PASSOS_COR));
    setColorPrefs(proximo);
    saveColorPrefs(authUser, proximo);
  };

  const setModuleColor = (id, colorId) => {
    const next = { ...colorPrefs };
    if (!colorId) delete next[id]; else next[id] = colorId;
    mudarCores(next);
  };
  const setAllColors = (colorId) => {
    const next = {};
    if (colorId) filteredMods.forEach(m => { next[m.id] = colorId; });
    mudarCores(next);
  };

  /* O atalho vale enquanto esta tela estiver aberta, não só no modo cor:
     quem pintou tudo, fechou o modo e só então se arrependeu continua
     conseguindo voltar. Campo de texto em foco tem prioridade — lá o Ctrl+Z
     é do navegador. */
  useEffect(() => {
    const tecla = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const alvo = e.target;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const refazer = k === 'y' || (k === 'z' && e.shiftKey);
      if (refazer ? !colorRedo.length : !colorUndo.length) return;
      e.preventDefault();
      if (refazer) refazerCor(); else desfazerCor();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorUndo, colorRedo, colorPrefs, authUser]);
  // Card de perfil arrastável pra qualquer canto da tela (pega pela alcinha ⋮⋮ no topo).
  const [cardPos, setCardPos] = useState(() => loadCardPos());
  const cardPosRef = useRef(cardPos);
  const cardElRef  = useRef(null);
  const cardDragRef = useRef(null);
  // Área da órbita se encolhe (bolhas, mascote e anéis juntos, sem perder as
  // proporções) até caber na altura disponível da tela — sem isso, em telas
  // de notebook mais baixas, o rodapé (tagline) só aparecia rolando a página.
  const orbitAreaRef = useRef(null);
  const [orbitScale, setOrbitScale] = useState(1);
  const [draggingCard, setDraggingCard] = useState(false);
  useEffect(() => { cardPosRef.current = cardPos; }, [cardPos]);
  // O card só pode DESCANSAR em um dos 4 cantos da tela (não em qualquer
  // lugar) — arrastar ainda segue o cursor livremente pra dar feedback, mas
  // ao soltar ele sempre encaixa no canto mais próximo de onde foi solto.
  const CARD_MARGIN = 18;
  const cornerFromPoint = (cx, cy, w, h) => ({
    x: cx > window.innerWidth / 2 ? window.innerWidth - w - CARD_MARGIN : CARD_MARGIN,
    y: cy > window.innerHeight / 2 ? window.innerHeight - h - CARD_MARGIN : CARD_MARGIN,
  });
  // Posição salva pode ter ficado FORA da tela — foi arrastada com outro nível
  // de zoom/tamanho de janela, e sem isso o card simplesmente sumia (relatado:
  // "com o zoom de 100% o card some da tela"). Reencaixa no canto mais
  // próximo assim que monta e sempre que a janela muda de tamanho/zoom.
  useEffect(() => {
    const reencaixar = () => {
      setCardPos(p => {
        if (!p) return p;
        const w = cardElRef.current?.offsetWidth || 200, h = cardElRef.current?.offsetHeight || 140;
        const next = cornerFromPoint(p.x + w / 2, p.y + h / 2, w, h);
        if (next.x === p.x && next.y === p.y) return p;
        saveCardPos(next); return next;
      });
    };
    reencaixar();
    window.addEventListener('resize', reencaixar);
    return () => window.removeEventListener('resize', reencaixar);
  }, []);
  useEffect(() => {
    const move = (e) => {
      const d = cardDragRef.current; if (!d) return;
      const w = cardElRef.current?.offsetWidth || 116, h = cardElRef.current?.offsetHeight || 116;
      const x = Math.max(4, Math.min(window.innerWidth - w - 4, e.clientX - d.ox));
      const y = Math.max(4, Math.min(window.innerHeight - h - 4, e.clientY - d.oy));
      setCardPos({ x, y });
    };
    const up = () => {
      if (!cardDragRef.current) return;
      cardDragRef.current = null; setDraggingCard(false);
      setCardPos(p => {
        if (!p) return p;
        const w = cardElRef.current?.offsetWidth || 200, h = cardElRef.current?.offsetHeight || 140;
        const next = cornerFromPoint(p.x + w / 2, p.y + h / 2, w, h);
        saveCardPos(next); return next;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  const startCardDrag = (e) => {
    e.preventDefault();
    const rect = cardElRef.current.getBoundingClientRect();
    cardDragRef.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    setDraggingCard(true);
  };
  const isMobile = useIsMobile();
  /* A órbita precisa de altura: ela é uma elipse com o mascote no meio e nove
     bolhas em volta. Num celular DEITADO (iPhone 14: 844x390) a largura passa
     do corte de "mobile", então caía na órbita — que encolhia pra cerca de 30%
     e virava um amontoado ilegível. Abaixo de 520px de altura a lista é
     simplesmente a forma certa, não importa a largura. */
  const [alturaCurta, setAlturaCurta] = useState(() => window.innerHeight < 520);
  useEffect(() => {
    const medir = () => setAlturaCurta(window.innerHeight < 520);
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('orientationchange', medir); };
  }, []);
  const emLista = isMobile || alturaCurta;
  useEffect(() => {
    // `emLista` e não `isMobile`: numa janela baixa a órbita nem é renderizada,
    // e sem isto o observer não voltaria a se prender ao esticar a janela.
    if (emLista) return;
    const el = orbitAreaRef.current; if (!el) return;
    const calc = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / 1420, h / 800, 1);   // 1420x800 = caixa de projeto da órbita
      setOrbitScale(s > 0 ? s : 1);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [emLista]);
  const isAdmin  = authUser?.role === 'admin';
  const isModerador = authUser?.role === 'moderador';
  // Os únicos cards com adminOnly são Dashboard RH e Ponto Eletrônico — moderador
  // tem acesso aos dois (o Dashboard RH internamente já restringe as abas dele).
  const podeAdminOnly = isAdmin || isModerador;

  const IcoColab = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
  const IcoAlexa = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );
  const IcoDash = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
  const IcoPonto = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      <circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/>
    </svg>
  );
  const IcoMercado = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
      <path d="M12 13l1.5 1.5L16 12"/>
    </svg>
  );
  const IcoFaturamento = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
  /* quadro Kanban — colunas com cartões, que é o que a Conexão Setorial virou */
  const IcoChat = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5"/>
      <line x1="2.5" y1="7.5" x2="21.5" y2="7.5"/>
      <rect x="5.5" y="10.5" width="4.5" height="7" rx="1"/>
      <rect x="14" y="10.5" width="4.5" height="4" rx="1"/>
    </svg>
  );
  const IcoFit = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="4" height="8" rx="1.3"/><rect x="18" y="8" width="4" height="8" rx="1.3"/><line x1="6" y1="12" x2="18" y2="12"/>
    </svg>
  );
  /* Instalar Aplicativo + Sobre o Uniko, agora reunidos num módulo só */
  const IcoInfo = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
  // Uniko Fit é o ÚNICO módulo com cor FIXA (laranja), independente do tema — exceto
  // quando o tema ativo já É o laranja, aí ela vira azul (senão o card some no fundo
  // do próprio tema). `T.key` é o id do tema aplicado agora (contexts/theme.js).
  const isOrangeTheme = T.key === 'orange' || T.key === 'orangeDark';
  const fitColor = isOrangeTheme ? '#2A82D2' : '#FF6B35';
  const allMods = [
    {id:'colaborador',      label:'Portal do Colaborador', sub:'Portal RH completo',               icon:IcoColab,       color:T.gold, bg:T.goldGl, tag:'Principal',  adminOnly:false},
    {id:'alexa',            label:'Central Alexa',         sub:'Festival · Música · Biblioteca',   icon:IcoAlexa,       color:T.gold, bg:T.goldGl, tag:'Música',     adminOnly:false},
    {id:'faturamento',      label:'Oficina Estelar',       sub:'Controle de Notas · Assinatura',   icon:IcoFaturamento, color:T.gold, bg:T.goldGl, tag:'Documentos', adminOnly:false},
    {id:'uniko-fit',        label:'Uniko FIT',             sub:'Check-in de treino · Ranking',     icon:IcoFit,         color:fitColor, bg:fitColor+'18', tag:'Fitness',    adminOnly:false},
    {id:'dashboard',        label:'Dashboard RH',          sub:'Gestão · Funcionários',            icon:IcoDash,        color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'ponto',            label:'Ponto Eletrônico',      sub:'Leitor de arquivo AFD',            icon:IcoPonto,       color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'mercado-estelar',  label:'Prisma Store',          sub:'Loja de benefícios e recompensas', icon:IcoMercado,     color:T.gold, bg:T.goldGl, tag:'Recompensas', adminOnly:false},
    {id:'conexao-setorial', label:'Conexão Setorial',      sub:'Quadro Kanban · Salas por assunto',  icon:IcoChat,        color:T.gold, bg:T.goldGl, tag:'Equipe',     adminOnly:false},
    {id:'info-adicional',   label:'Informações Adicionais', sub:'Instalar app · Sobre o Uniko',     icon:IcoInfo,        color:T.blue, bg:T.blueGl||T.goldGl, tag:'Guia', adminOnly:false},
  ];
  /* Os atalhos viram "módulos" de mentira: daí em diante tudo que a órbita já
     sabe fazer (ordenar, redimensionar, colorir, espaçar) vale pra eles de
     graça. O que muda é só o clique, que leva pro Portal já na aba certa. */
  const atalhoMods = atalhos
    .map(tab => NAV.find(n => n.id === tab))
    .filter(Boolean)
    .map(n => ({
      id: ATALHO_ID(n.id), label: n.label, sub: 'Atalho · Portal do Colaborador',
      icon: n.icon, color: T.blue || T.gold, bg: T.blueGl || T.goldGl,
      tag: 'Atalho', adminOnly: false, atalho: true, tab: n.id,
    }));
  const filteredMods = [...allMods, ...atalhoMods]
    .filter(m => !m.adminOnly || (m.strictAdmin ? isAdmin : podeAdminOnly));
  const mods = applyOrder(filteredMods, order);
  // Desktop em órbita: 1ª vez (sem ordem salva) usa esta sequência — é o que
  // reproduz exatamente as posições da referência (relógio a partir do topo).
  // Depois que a pessoa arrasta pra reorganizar, os dois (lista mobile e
  // órbita desktop) passam a seguir a MESMA ordem escolhida por ela.
  // O SEGUNDO da lista fica cravado no topo; o primeiro nasce à esquerda dele
  // e o terceiro à direita. Daí em diante segue no sentido horário.
  const ORBIT_DEFAULT = ['mercado-estelar','colaborador','alexa','faturamento','dashboard','conexao-setorial','ponto','uniko-fit','info-adicional'];
  const orbitMods = order.length ? mods : applyOrder(filteredMods, ORBIT_DEFAULT);
  const reorderCard = (list, fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const ids = list.map(m => m.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids); saveModuleOrder(authUser, ids);
  };

  // ─── MOBILE — lista vertical ─────────────────────────────────────────────
  /* ── Geometria da órbita (desktop) ──────────────────────────────────────
     Fica aqui, acima do `if (isMobile)`, porque usa useMemo: hook não pode
     nascer depois de um return condicional — a ordem dos hooks mudaria ao
     alternar entre celular e desktop.

     A conta toda (e as duas tentativas que deram errado antes) está em
     shared/orbita.js. Em resumo: folga IGUAL entre todos os pares, medida na
     distância real entre centros, e as bolhas crescem juntas pra ocupar o
     anel em vez de deixar vão. Sai em px de projeto (a caixa ORBIT_W×ORBIT_H);
     quem encolhe tudo pra caber na janela é o orbitScale, na hora de pintar. */
  const ORBIT_W = 1420, ORBIT_H = 800;   // caixa de projeto da órbita, em px
  const BASE_D = 178;                    // diâmetro de referência de uma bolha "M"
  /* O Uniko do meio e o espaço dele.

     No layout padrão o anel reserva VAO_CENTRAL de raio livre — o mascote
     inteiro (MASCOTE_MAX) mais um respiro. Sem essa reserva as bolhas de cima
     e de baixo encostavam nele (sobravam 14px).

     Mas a reserva não pode virar uma camisa de força: era ela que fazia o
     G/GG do módulo do TOPO não surtir efeito nenhum (o "M" já nascia no teto).
     Então quem for marcado G/GG avança sobre a reserva, e o MASCOTE É QUE
     ENCOLHE pra caber no que sobrou — a escolha da pessoa ganha do meu
     respiro automático. VAO_DURO é o limite de tudo: nem a maior bolha pode
     apagar o mascote. */
  const MASCOTE_MAX = 148, MASCOTE_MIN = 92;
  const VAO_CENTRAL = MASCOTE_MAX / 2 + 58;
  const VAO_DURO    = MASCOTE_MIN / 2 + 14;
  const chaveOrbita = orbitMods.map(m => `${m.id}:${getSizeMult(m.id)}`).join('|');
  const orbita = useMemo(
    () => calcularOrbita({ mults: orbitMods.map(m => getSizeMult(m.id)),
                           W: ORBIT_W, H: ORBIT_H, base: BASE_D, vaoMin: VAO_CENTRAL, vaoDuro: VAO_DURO }),
    // chaveOrbita resume o que muda o layout (quais módulos e que tamanhos);
    // orbitMods e getSizeMult trocam de identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chaveOrbita]);

  if (emLista) {
    return (
      // idem desktop: sem fundo opaco, pra o lava lamp do App aparecer aqui também
      <div style={{minHeight:'100vh', display:'flex', flexDirection:'column',
        fontFamily:'var(--font-body)', position:'relative', zIndex:0}}>

        <style>{`.mob-card { -webkit-tap-highlight-color: transparent; }
          @keyframes msShootStar{0%,33%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(8px,8px)}65%{opacity:.45;transform:translate(90px,90px)}72%,100%{opacity:0;transform:translate(115px,115px)}}`}</style>
        <div style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',pointerEvents:'none'}}>
          {SHOOT_POS.map((s,i)=>(
            <div key={i} className="estrela-cadente" style={{position:'absolute',left:s.x,top:s.y,animation:`msShootStar 6s ${s.delay} linear infinite`}}>
              <div style={{width:48,height:1.3,background:'linear-gradient(to right,transparent,rgba(255,255,255,.88),rgba(255,255,255,.28),transparent)',borderRadius:2,transform:'rotate(45deg)',transformOrigin:'center'}}/>
            </div>
          ))}
        </div>

        {/* Top bar: wordmark + chip de perfil (toca pra editar) */}
        <div style={{padding:'calc(16px + env(safe-area-inset-top)) 16px 2px', display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:'var(--font-brand)', fontSize:36, fontWeight:700,
              color:T.text, letterSpacing:'.07em'}}><UnikoName/></div>
            <div style={{fontSize:13, color:T.textT, letterSpacing:'.11em',
              textTransform:'uppercase', marginTop:3}}>Sistema Corporativo</div>
          </div>
          {authUser && (
            <div onClick={()=>onSelect('colaborador','dados')} title="Editar perfil"
              style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
              <AvatarCircle name={authUser.name} photo={userPhoto} size={34} fontSize={12} rounded="10px"/>
              <div>
                <div style={{fontSize:12.5, fontWeight:700, color:T.text, lineHeight:1.25, maxWidth:90,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{authUser.name.split(' ')[0]}</div>
                <div style={{fontSize:9.5, color:T.gold, fontWeight:700}}>
                  {isAdmin?'Admin':isModerador?'Moderador':'Colaborador'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Título: "<" volta pro login (sair) · "⚙" abre ajustes */}
        <div style={{padding:'20px 16px 2px', display:'flex', alignItems:'center', gap:10}}>
          <button onClick={onLogout} title="Sair"
            style={{width:32, height:32, borderRadius:10, border:`1px solid ${T.border}`, background:T.surface,
              color:T.textS, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
              WebkitTapHighlightColor:'transparent'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{fontFamily:'var(--font-brand)', fontSize:26, fontWeight:800, color:T.text, flex:1}}>Módulos</div>
          <button onClick={()=>setShowSettings(true)} title="Configurações"
            style={{width:32, height:32, borderRadius:10, border:`1px solid ${T.border}`, background:T.surface,
              color:T.textS, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
              WebkitTapHighlightColor:'transparent'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>
        <div style={{padding:'2px 16px 18px 58px', fontSize:12.5, color:T.textT}}>Escolha um módulo para continuar</div>

        {/* Lista vertical dos módulos */}
        <div style={{padding:'0 16px 24px', display:'flex', flexDirection:'column', gap:10}}>
          {mods.map(m => {
            const isPressed = pressed === m.id;
            const { color: mColor, bg: mBg } = getModuleColor(m);
            return (
              <div key={m.id}
                className="mob-card"
                onClick={() => onSelect(m.atalho ? 'colaborador' : m.id, m.tab)}
                onTouchStart={() => setPressed(m.id)}
                onTouchEnd={() => setPressed(null)}
                onTouchCancel={() => setPressed(null)}
                style={{
                  display:'flex', alignItems:'center', gap:16,
                  background: isPressed ? T.page : T.surface,
                  border:`1px solid ${isPressed ? mColor+'55' : T.border}`,
                  borderRadius:18, padding:'16px 16px', cursor:'pointer',
                  transform: isPressed ? 'scale(0.98)' : 'scale(1)',
                  transition:'transform .12s, background .12s, border-color .12s',
                  WebkitTapHighlightColor:'transparent', userSelect:'none',
                }}>
                <div style={{width:54, height:54, borderRadius:15, background:mBg,
                  border:`1px solid ${mColor}22`, display:'flex', alignItems:'center',
                  justifyContent:'center', color:mColor, flexShrink:0}}>
                  {React.cloneElement(m.icon, {width:26, height:26})}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:17, fontWeight:700, color:T.text}}>{m.label}</div>
                  <div style={{fontSize:13, color:T.textT, marginTop:2,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.sub}</div>
                </div>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                  <path d="M9 6l6 6-6 6"/>
                </svg>
              </div>
            );
          })}
        </div>

        {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} painelInicial={painelConfig} onClose={()=>setShowSettings(false)}/>}

        {/* Rodapé */}
        <div style={{marginTop:'auto', padding:'0 16px 26px', textAlign:'center'}}>
          <span style={{fontSize:10.5, color:T.textT, letterSpacing:'.12em', textTransform:'uppercase'}}>
            <span style={{color:T.gold}}>◆</span> Conectar · Colaborar · Evoluir
          </span>
        </div>
      </div>
    );
  }

  // ─── DESKTOP — órbita ────────────────────────────────────────────────────
  const N = orbitMods.length || 1;
  // Posições, diâmetros e raios da elipse já saíram do useMemo; aqui é só ler.
  // Tudo em px de projeto — o orbitScale entra na hora de pintar.
  const { angulos: orbitAngles, diams: orbitDiams, RXpx, RYpx } = orbita;
  // O mascote ocupa o vão que sobrou, nunca mais que isso.
  const mascoteTam = Math.max(MASCOTE_MIN, Math.min(MASCOTE_MAX, (orbita.vaoCentral - 14) * 2));
  const pctDoAngulo = (ang) => {
    const a = ang * Math.PI / 180;
    return { left: 50 + RXpx * Math.cos(a) / ORBIT_W * 100,
             top:  50 + RYpx * Math.sin(a) / ORBIT_H * 100 };
  };
  const orbitDiam = (i) => (orbitDiams[i] ?? 178) * orbitScale;
  const orbitPt = (i) => pctDoAngulo(orbitAngles[i % N] ?? -90);
  // Pontinho decorativo entre duas bolhas vizinhas — só o meio ANGULAR entre
  // elas (não precisa ser exato, é decoração).
  const orbitMidPt = (i) => {
    const a0 = orbitAngles[i] ?? -90, a1raw = orbitAngles[(i + 1) % N] ?? -90;
    const a1 = a1raw > a0 ? a1raw : a1raw + 360;
    return pctDoAngulo((a0 + a1) / 2);
  };
  // Os anéis decorativos saem dos raios REAIS da elipse, senão deixam de
  // passar por baixo das bolhas quando elas mudam de tamanho.
  const aneis = [1, 0.845, 0.69].map(k => ({ rx: RXpx * k, ry: RYpx * k }));

  return(
    // SEM background aqui. Tinha um `background: T.page` opaco nesta div, e
    // era ele que escondia o lava lamp do App — o fundo animado rodava atrás,
    // tapado, e esta tela parecia ter fundo chapado. Ele existia porque o
    // wrapper do App só repinta quando o PRÓPRIO App re-renderiza, e trocar de
    // tema aqui dentro (activeTheme é estado local desta tela) não causa isso:
    // o fundo ficava com a cor do tema anterior. Agora quem resolve isso é o
    // aviso de troca de tema (onThemeChange, em contexts/theme.js), que o
    // lava lamp escuta e se redesenha sozinho — e é ele que pinta o fundo.
    <div style={{height:'100vh',overflow:'hidden',display:'flex',flexDirection:'column',
      position:'relative',zIndex:1,padding:'22px 34px 26px',boxSizing:'border-box'}}>

      <style>{`@keyframes msShootStar{0%,33%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(8px,8px)}65%{opacity:.45;transform:translate(140px,140px)}72%,100%{opacity:0;transform:translate(180px,180px)}}`}</style>
      <div style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',pointerEvents:'none'}}>
        {SHOOT_POS.map((s,i)=>(
          <div key={i} className="estrela-cadente" style={{position:'absolute',left:s.x,top:s.y,animation:`msShootStar 6s ${s.delay} linear infinite`}}>
            <div style={{width:76,height:1.5,background:'linear-gradient(to right,transparent,rgba(255,255,255,.88),rgba(255,255,255,.28),transparent)',borderRadius:2,transform:'rotate(45deg)',transformOrigin:'center'}}/>
          </div>
        ))}
      </div>

      {authUser&&(
        <div ref={cardElRef} style={{position:'fixed',
          ...(cardPos ? {left:cardPos.x, top:cardPos.y} : {top:18, right:26}),
          width:200,display:'flex',flexDirection:'column',
          gap:8,padding:'10px 12px',borderRadius:16,zIndex:10,
          background:T.surface,border:`1px solid ${T.border}`,boxShadow:T.shL,
          transition:draggingCard?'none':'box-shadow .15s'}}>
          <div onPointerDown={startCardDrag} title="Arraste para mover"
            style={{display:'flex',alignItems:'center',gap:10,cursor:draggingCard?'grabbing':'grab',touchAction:'none'}}>
            <AvatarCircle name={authUser.name} photo={userPhoto} size={38} fontSize={13} rounded="11px"/>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:13.5,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {authUser.name.split(' ')[0]}
              </div>
              <div style={{fontSize:10.5,fontWeight:600,color:isModerador?'#4A78C4':T.gold}}>
                {isAdmin?'Admin':isModerador?'Moderador':'Colaborador'}
              </div>
            </div>
          </div>
          {/* Ações do card. Antes eram seis ícones sem rótulo numa grade de
              três, e ninguém adivinhava qual era qual: a paleta trocava a cor
              das BOLHAS, mas parecia o tema do sistema; a engrenagem abria um
              modal que tinha tema E conta juntos. Agora cada ação tem o seu
              botão, com ícone próprio e nome escrito — inclusive Tema e Conta,
              que viraram entradas separadas do mesmo modal. */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,width:'100%'}}>
            {[
              { id:'perfil', rot:'Perfil', dica:'Editar seus dados',
                onClick:()=>onSelect('colaborador','dados'), destaque:true,
                icone:<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></> },
              { id:'conta', rot:'Conta', dica:'Senha e dados da conta',
                onClick:()=>{ setPainelConfig('account'); setShowSettings(true); },
                icone:<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></> },
              { id:'tema', rot:'Tema', dica:'Cor do sistema (claro/escuro)',
                onClick:()=>{ setPainelConfig('theme'); setShowSettings(true); },
                icone:<><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></> },
              { id:'ordem', rot:'Ordem', dica:'Arrastar pra reorganizar a órbita',
                ativo:reorderMode, onClick:()=>abrirModo('ordem'),
                icone:<><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></> },
              { id:'tamanho', rot:'Tamanho', dica:'Tamanho das bolhas (P/M/G/GG)',
                ativo:sizeMode, onClick:()=>abrirModo('tamanho'),
                icone:<><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></> },
              { id:'cor', rot:'Cor', dica:'Cor das bolhas dos módulos',
                ativo:colorMode, onClick:()=>abrirModo('cor'),
                icone:<><circle cx="13.5" cy="6.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="7" cy="12.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="11" cy="18" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c1.9 0 3.6-1.6 3.6-3.6C21 6.4 16.9 2 12 2z"/></> },
              { id:'atalhos', rot:'Atalhos', dica:'Pôr abas do Portal na órbita',
                ativo:atalhoMode, onClick:()=>abrirModo('atalhos'),
                icone:<><path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></> },
              { id:'sair', rot:'Sair', dica:'Encerrar a sessão', perigo:true, onClick:onLogout,
                icone:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></> },
            ].map(b => {
              const aceso = b.ativo || b.destaque;
              return (
                <button key={b.id} onClick={b.onClick} title={b.dica}
                  style={{display:'flex',alignItems:'center',gap:6,height:30,padding:'0 8px',borderRadius:9,
                    border:`1px solid ${b.perigo ? (T.dangerGl||T.border) : aceso ? T.goldLine+'44' : T.border}`,
                    background: aceso && !b.perigo ? T.goldGl : 'transparent',
                    color: b.perigo ? T.danger : aceso ? T.gold : T.textS,
                    cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'var(--font-body)',
                    textAlign:'left',overflow:'hidden'}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{b.icone}</svg>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.rot}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} painelInicial={painelConfig} onClose={()=>setShowSettings(false)}/>}

      {/* ── Cabeçalho: wordmark à esquerda · saudação + título ao centro ── */}
      <div className="fsu" style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'start',marginBottom:8}}>
        <div>
          <div style={{fontFamily:'var(--font-brand)',fontSize:46,fontWeight:700,color:T.text,letterSpacing:'.08em'}}><UnikoName/></div>
          <div style={{fontSize:15,color:T.textT,letterSpacing:'.14em',textTransform:'uppercase',marginTop:4}}>Sistema Corporativo</div>
        </div>
        <div style={{textAlign:'center'}}>
          {authUser?.name && <div style={{fontSize:11,color:T.textT,letterSpacing:'.16em',textTransform:'uppercase',marginBottom:6}}>
            Bem-vindo, {authUser.name.split(' ')[0]}
          </div>}
          <div style={{fontFamily:'var(--font-brand)',fontSize:32,fontWeight:800,color:T.text,letterSpacing:'-.01em'}}>
            Escolha seu <span style={{color:T.gold}}>módulo</span>
          </div>
          <div style={{fontSize:11,color:T.textT,letterSpacing:'.13em',textTransform:'uppercase',marginTop:7}}>
            Acesse as ferramentas do seu dia a dia
          </div>
          <div style={{width:56,height:2,background:T.goldLine||T.gold,margin:'12px auto 0',borderRadius:2,opacity:.7}}/>
        </div>
        <div/>
      </div>

      {reorderMode && (
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',width:'fit-content'}}>
          <span>✛ Arraste as bolhas pra reorganizar como elas aparecem na sua tela.</span>
          <button onClick={()=>setReorderMode(false)}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {sizeMode && (
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',width:'fit-content'}}>
          <span>📐 Toque numa bolha pra escolher o tamanho SÓ dela, ou aplique em todas:</span>
          <div style={{display:'flex',gap:4}}>
            {SIZE_STEPS.map(s=>(
              <button key={s.id} onClick={()=>setAllSizes(s.id)}
                style={{padding:'4px 11px',borderRadius:7,border:`1px solid ${T.goldLine}55`,background:T.surface,color:T.text,
                  cursor:'pointer',fontWeight:700,fontSize:11.5,fontFamily:'var(--font-body)'}}>{s.label}</button>
            ))}
          </div>
          <button onClick={()=>{setSizeMode(false); setSizingId(null);}}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {atalhoMode && (
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',
          width:'fit-content',maxWidth:'min(94vw, 900px)'}}>
          <span style={{flexBasis:'100%',textAlign:'center'}}>
            🧭 Escolha as abas do Portal que você quer como bolha na órbita:
          </span>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
            {NAV.map(n => {
              const ligado = atalhos.includes(n.id);
              return (
                <button key={n.id} onClick={()=>toggleAtalho(n.id)} title={ligado?'Remover da órbita':'Adicionar à órbita'}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 11px',borderRadius:9,cursor:'pointer',
                    border:`1px solid ${ligado?T.gold:T.border}`,background:ligado?T.gold:'transparent',
                    color:ligado?'#fff':T.textS,fontSize:12,fontWeight:600,fontFamily:'var(--font-body)'}}>
                  {React.cloneElement(n.icon, {width:13,height:13})}
                  {n.label}
                </button>
              );
            })}
          </div>
          <button onClick={()=>setAtalhoMode(false)}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {colorMode && (
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',width:'fit-content'}}>
          <span>🎨 Toque numa bolha pra escolher a cor SÓ dela, ou aplique em todas:</span>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            <button onClick={()=>setAllColors(null)} title="Padrão"
              style={{width:22,height:22,borderRadius:'50%',border:`1.5px solid ${T.border}`,background:T.surface,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',color:T.textD,fontSize:10}}>✕</button>
            {COLOR_STEPS.map(c=>(
              <button key={c.id} onClick={()=>setAllColors(c.id)} title={c.label}
                style={{width:22,height:22,borderRadius:'50%',border:`1.5px solid ${T.goldLine}55`,background:c.hex,cursor:'pointer'}}/>
            ))}
          </div>
          {/* Desfazer/refazer também no banner: o atalho existe, mas ninguém
              descobre atalho que não está escrito em lugar nenhum. */}
          <div style={{display:'flex',gap:4,marginLeft:2}}>
            <button onClick={desfazerCor} disabled={!colorUndo.length}
              title={colorUndo.length ? `Desfazer (Ctrl+Z) — ${colorUndo.length} ${colorUndo.length===1?'passo':'passos'}` : 'Nada pra desfazer'}
              style={{padding:'5px 10px',borderRadius:9,cursor:colorUndo.length?'pointer':'default',fontWeight:700,fontSize:12.5,
                border:`1px solid ${T.border}`,background:'transparent',fontFamily:'var(--font-body)',
                color:colorUndo.length?T.text:T.textD,opacity:colorUndo.length?1:.55}}>↶ Desfazer</button>
            <button onClick={refazerCor} disabled={!colorRedo.length}
              title={colorRedo.length ? 'Refazer (Ctrl+Shift+Z)' : 'Nada pra refazer'}
              style={{padding:'5px 10px',borderRadius:9,cursor:colorRedo.length?'pointer':'default',fontWeight:700,fontSize:12.5,
                border:`1px solid ${T.border}`,background:'transparent',fontFamily:'var(--font-body)',
                color:colorRedo.length?T.text:T.textD,opacity:colorRedo.length?1:.55}}>↷</button>
          </div>
          <button onClick={()=>{setColorMode(false); setColoringId(null);}}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {/* ── Órbita: anéis decorativos + mascote central + bolhas dos módulos ──
          A área abaixo ocupa o espaço vertical que sobrar (flex:1) e mede a si
          mesma; a órbita (anéis+mascote+bolhas) encolhe junto, mantendo as
          proporções, até caber sem precisar rolar a página. */}
      <div ref={orbitAreaRef} style={{flex:'1 1 0',minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',width:'100%'}}>
      <div className="fsu2" style={{position:'relative',width:ORBIT_W*orbitScale,height:ORBIT_H*orbitScale,flex:'0 0 auto'}}>
        <svg viewBox={`0 0 ${ORBIT_W} ${ORBIT_H}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'}}>
          {aneis.map((a, i) => (
            <ellipse key={'anel'+i} cx={ORBIT_W/2} cy={ORBIT_H/2} rx={a.rx} ry={a.ry}
              fill="none" stroke={T.goldLine||T.gold} strokeWidth="1" opacity={[.22, .15, .1][i]}/>
          ))}
          {orbitMods.map((_,i)=>{ const p = orbitMidPt(i); return (
            <circle key={i} cx={p.left/100*ORBIT_W} cy={p.top/100*ORBIT_H} r="4" fill={T.goldLine||T.gold} opacity=".55"/>
          );})}
        </svg>

        {/* Estrelinhas viajando pelos anéis — quanto mais interno o anel, mais
            rápido (como órbitas de verdade: raio menor gira mais rápido).
            Ficam FORA do svg de propósito: ver trilhaOrbital lá em cima. */}
        <style>{ESTRELINHAS_ORBITA.map((o,i)=>trilhaOrbital(`orbTrilha${i}`, aneis[i].rx*orbitScale, aneis[i].ry*orbitScale)).join('')}</style>
        {ESTRELINHAS_ORBITA.map((o,i)=>{
          const d = o.r * 2 * orbitScale;
          return (
            <div key={'orb'+i} className="orbita-estrelinha" style={{position:'absolute',
              left:'50%', top:'50%', width:d, height:d, marginLeft:-d/2, marginTop:-d/2,
              borderRadius:'50%', background:o.fill==='gold' ? (T.goldL||T.gold) : '#ffffff',
              boxShadow:`0 0 ${3*orbitScale}px ${T.goldL||T.gold}`, opacity:.95,
              animation:`orbTrilha${i} ${o.dur}s linear infinite`, animationDelay:`${-i*4}s`,
              willChange:'transform', pointerEvents:'none', zIndex:1}}/>
          );
        })}

        <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:2,pointerEvents:'none'}}>
          <UnikoMascot size={mascoteTam*orbitScale}/>
        </div>

        {orbitMods.map((m,i)=>{
          const p = orbitPt(i);
          const bd = orbitDiam(i);
          /* Ícone, textos e aura acompanham o tamanho final da bolha — e `bd`
             JÁ inclui o orbitScale. Dividir aqui por (BASE_D * orbitScale)
             cancelava a escala: num iPhone deitado a órbita encolhia pra ~30%
             e os textos continuavam em tamanho cheio, atropelando as bolhas. */
          const bs = bd / BASE_D;
          const { color: mColor, bg: mBg } = getModuleColor(m);
          return (
            <div key={m.id}
              draggable={reorderMode}
              onDragStart={reorderMode ? (e)=>{ setDragModId(m.id); e.dataTransfer.effectAllowed='move'; } : undefined}
              onDragOver={reorderMode ? (e)=>e.preventDefault() : undefined}
              onDrop={reorderMode ? (e)=>{ e.preventDefault(); reorderCard(orbitMods, dragModId, m.id); setDragModId(null); } : undefined}
              onDragEnd={reorderMode ? ()=>setDragModId(null) : undefined}
              onClick={reorderMode ? undefined : sizeMode ? ()=>setSizingId(id=>id===m.id?null:m.id) : colorMode ? ()=>setColoringId(id=>id===m.id?null:m.id) : ()=>onSelect(m.atalho ? 'colaborador' : m.id, m.tab)}
              onMouseEnter={()=>sh(m.id)} onMouseLeave={()=>sh(null)}
              style={{position:'absolute',left:`${p.left}%`,top:`${p.top}%`,transform:'translate(-50%,-50%)',
                width:bd,height:bd,borderRadius:'50%',zIndex:3,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4*bs,
                textAlign:'center',padding:`0 ${16*bs}px`,boxSizing:'border-box',
                background:T.surface,
                border:reorderMode ? `2px dashed ${dragModId===m.id?T.gold:T.goldLine+'88'}`
                  : sizingId===m.id||coloringId===m.id ? `2px solid ${T.gold}` : `1.5px solid ${hov===m.id?mColor+'77':T.border}`,
                // 3 camadas de aura ao redor da bolha (mesma ideia da foto de perfil
                // no Portal do Colaborador), na cor do próprio módulo (ou na cor
                // escolhida pela pessoa, se ela tiver mudado).
                boxShadow:`0 0 0 ${6*bs}px ${mColor}26, 0 0 0 ${13*bs}px ${mColor}12, 0 0 0 ${21*bs}px ${mColor}07, ${hov===m.id?T.shL:T.sh}`,
                cursor:reorderMode?'grab':'pointer',
                opacity:dragModId===m.id?0.4:1,
                transition:'width .22s ease, height .22s ease, transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s, border-color .18s, background .22s, color .22s',
                ...(!reorderMode && hov===m.id ? {transform:'translate(-50%,-50%) scale(1.06)'} : null)}}>
              <div style={{width:46*bs,height:46*bs,borderRadius:13*bs,background:mBg,border:`1px solid ${mColor}22`,
                display:'flex',alignItems:'center',justifyContent:'center',color:mColor,marginBottom:2,transition:'background .22s, color .22s, border-color .22s'}}>
                {React.cloneElement(m.icon, {width:23*bs,height:23*bs})}
              </div>
              <div style={{fontSize:16*bs,fontWeight:700,color:T.text,lineHeight:1.2}}>{m.label}</div>
              <div style={{fontSize:11*bs,color:T.textT,lineHeight:1.35,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{m.sub}</div>
              {sizeMode && (
                <div style={{position:'absolute',top:6,right:6,width:16*orbitScale,height:16*orbitScale,borderRadius:'50%',
                  background:T.goldGl,border:`1px solid ${T.goldLine}66`,display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:9*orbitScale,fontWeight:800,color:T.gold,pointerEvents:'none'}}>
                  {(SIZE_STEPS.find(s=>s.id===(sizePrefs[m.id]||'m'))?.label)||'M'}
                </div>
              )}
              {colorMode && (
                <div style={{position:'absolute',top:6,right:6,width:16*orbitScale,height:16*orbitScale,borderRadius:'50%',
                  background:mColor,border:`1.5px solid ${T.surface}`,pointerEvents:'none'}}/>
              )}
            </div>
          );
        })}

        {/* Popover de tamanho — abre ao tocar numa bolha em "modo tamanho".
            Fica centrado no meio da órbita (não preso à bolha) pra nunca correr
            risco de nascer fora da tela numa bolha perto da borda. */}
        {sizeMode && sizingId && (() => {
          const m = orbitMods.find(x=>x.id===sizingId);
          if (!m) return null;
          const curStep = sizePrefs[m.id] || 'm';
          return (
            <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:20,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:'16px 18px',boxShadow:T.shL,
              display:'flex',flexDirection:'column',alignItems:'center',gap:12,minWidth:210}}>
              <div style={{fontSize:13.5,fontWeight:700,color:T.text}}>Tamanho — {m.label}</div>
              <div style={{display:'flex',gap:6}}>
                {SIZE_STEPS.map(s=>(
                  <button key={s.id} onClick={()=>setModuleSize(m.id, s.id)}
                    style={{width:40,height:36,borderRadius:9,border:`1.5px solid ${curStep===s.id?T.gold:T.border}`,
                      background:curStep===s.id?T.goldGl:'transparent',color:curStep===s.id?T.gold:T.textS,
                      cursor:'pointer',fontWeight:700,fontSize:12.5,fontFamily:'var(--font-body)'}}>{s.label}</button>
                ))}
              </div>
              <button onClick={()=>setSizingId(null)}
                style={{fontSize:11.5,color:'#fff',background:T.gold,border:'none',borderRadius:9,padding:'5px 16px',
                  cursor:'pointer',fontWeight:700,fontFamily:'var(--font-body)'}}>Fechar</button>
            </div>
          );
        })()}

        {/* Popover de cor — mesmo esquema do tamanho: centrado na órbita. */}
        {colorMode && coloringId && (() => {
          const m = orbitMods.find(x=>x.id===coloringId);
          if (!m) return null;
          const curColor = colorPrefs[m.id] || null;
          return (
            <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:20,
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:'16px 18px',boxShadow:T.shL,
              display:'flex',flexDirection:'column',alignItems:'center',gap:12,minWidth:220}}>
              <div style={{fontSize:13.5,fontWeight:700,color:T.text}}>Cor — {m.label}</div>
              <div style={{display:'flex',gap:7,flexWrap:'wrap',justifyContent:'center',maxWidth:200}}>
                <button onClick={()=>setModuleColor(m.id, null)} title="Padrão"
                  style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${!curColor?T.gold:T.border}`,
                    background:T.surface,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                    color:T.textD,fontSize:12}}>✕</button>
                {COLOR_STEPS.map(c=>(
                  <button key={c.id} onClick={()=>setModuleColor(m.id, c.id)} title={c.label}
                    style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${curColor===c.id?T.gold:'transparent'}`,
                      background:c.hex,cursor:'pointer',boxShadow:curColor===c.id?`0 0 0 2px ${T.surface}`:'none'}}/>
                ))}
              </div>
              <button onClick={()=>setColoringId(null)}
                style={{fontSize:11.5,color:'#fff',background:T.gold,border:'none',borderRadius:9,padding:'5px 16px',
                  cursor:'pointer',fontWeight:700,fontFamily:'var(--font-body)'}}>Fechar</button>
            </div>
          );
        })()}
      </div>
      </div>

      {/* ── Rodapé: tagline de marca à esquerda · assinatura à direita ── */}
      <div className="fsu3" style={{marginTop:'auto',paddingTop:20,display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:20}}>
        <div>
          <div style={{width:36,height:2,background:T.border,marginBottom:8,borderRadius:2}}/>
          {['Pessoas','Ideias','Resultados','Em órbita'].map(w=>(
            <div key={w} style={{fontSize:10,color:T.textD,letterSpacing:'.16em',textTransform:'uppercase',lineHeight:1.7}}>{w}</div>
          ))}
        </div>
        <div style={{fontSize:11.5,color:T.textT,letterSpacing:'.1em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
          <span style={{color:T.gold}}>✦</span> Conectar · Colaborar · Evoluir
        </div>
      </div>
    </div>
  );
};

export { ModuleSelector };
