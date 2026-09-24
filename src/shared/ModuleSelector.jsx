import React, { useState, useEffect } from 'react';
import { T, applyTheme } from '../contexts/theme';
import { AvatarCircle } from './components';
import { SettingsModal } from './SettingsModal';
/* A tela de módulos no computador é o MenuLayoutNovo (módulos + widgets).
   A órbita — o anel de bolhas com o Uniko no meio — saiu em set/2026; o
   código dela está no histórico do git (antes do commit que tirou o
   interruptor do Dashboard RH). No celular continua a lista vertical daqui. */
import { MenuLayoutNovo, WIDGETS_NOVO } from './MenuLayoutNovo';
/* O catálogo de atalhos são as próprias abas internas dos módulos (Portal,
   Prisma Store, Central Alexa, Oficina Estelar) — reunidas em shared/atalhos.jsx
   a partir das listas que cada módulo exporta, sem cópia local. */
import { catalogoAtalhos, resolverAtalho, useSalasConexao } from './atalhos';
import { useIsMobile } from '../hooks/useIsMobile';
import { nomeChamado, useNomesExibicao } from './nomeExibicao';

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

/* Tamanho pequeno/grande de cada item da tela de módulos (módulos e widgets),
   como nos widgets do iPhone.
   Guarda { idDoItem: 'p' | 'g' }; o que não está aqui usa o padrão do layout. */
const TAM_NOVO_PREFIX = 'uniko_menu_novo_tamanho_';
const tamNovoKey = (authUser) => TAM_NOVO_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
/* Ajustes de tamanho que valem uma vez pra todo mundo, mesmo pra quem já
   tinha escolhido tamanhos (quem mexe em UM módulo grava o de todos, então sem
   isto o novo padrão nunca chegaria nessas contas). Depois disso a pessoa muda
   à vontade e não é sobrescrita de novo. */
const TAM_NOVO_LEVAS = [
  { flag: 'uniko_tam_padrao_v1_', tamanhos: { 'atalho:dados': 'g' } },   // Seus Dados grande (set/2026)
];
const loadTamNovo = (authUser) => {
  let r = {};
  try { const j = JSON.parse(localStorage.getItem(tamNovoKey(authUser)) || '{}'); r = (j && typeof j === 'object') ? j : {}; }
  catch { /* ignora */ }
  const conta = (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
  try {
    let mudou = false;
    for (const leva of TAM_NOVO_LEVAS) {
      if (localStorage.getItem(leva.flag + conta)) continue;
      r = { ...r, ...leva.tamanhos };
      localStorage.setItem(leva.flag + conta, '1');
      mudou = true;
    }
    if (mudou) localStorage.setItem(tamNovoKey(authUser), JSON.stringify(r));
  } catch { /* sem localStorage: fica com o padrão do layout */ }
  return r;
};
const saveTamNovo = (authUser, prefs) => { try { localStorage.setItem(tamNovoKey(authUser), JSON.stringify(prefs)); } catch { /* ignora */ } };

/* Atalhos — itens que levam direto a uma ABA de dentro de um módulo (Uniko
   Paint, Carteira da Prisma Store, Playlist da Alexa...) em vez de ao módulo. Guardados por usuário,
   igual à ordem/tamanho/cor: é uma preferência de tela, não um dado do RH. */
const ATALHOS_PREFIX = 'uniko_module_atalhos_';
const atalhosKey = (authUser) => ATALHOS_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
/* Atalhos que TODO MUNDO ganha (set/2026 — preenchem a grade de módulos, que
   pra quem tem poucos módulos ficava com um vão ao lado dos widgets).
   Cada LEVA entra uma vez só por conta, marcada pela própria flag: quem já
   tinha atalhos salvos ganha os da leva somados aos dele, e quem tirar algum
   depois não vê ele voltar. Pra dar um atalho novo a todos, crie uma leva nova
   (não mexa numa que já rodou — as contas que passaram por ela não veriam). */
const ATALHOS_PADRAO_LEVAS = [
  { flag: 'uniko_atalhos_padrao_v1_', abas: ['unikopaint', 'financeiro', 'dados'] },
];
/* Levas DESFEITAS: foram pro ar e depois saíram dos padrões. Quem chegou a
   receber (tem a flag da leva) perde aqueles atalhos uma vez; quem nunca
   recebeu não é afetado. Eventos foi padrão por poucos minutos em set/2026. */
const ATALHOS_PADRAO_DESFEITAS = [
  { flag: 'uniko_atalhos_padrao_v2_', abas: ['eventos'] },
];
const loadAtalhos = (authUser) => {
  let salvos = [];
  try { const r = JSON.parse(localStorage.getItem(atalhosKey(authUser)) || '[]'); salvos = Array.isArray(r) ? r : []; }
  catch { /* ignora */ }
  const conta = (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
  try {
    let mudou = false;
    for (const leva of ATALHOS_PADRAO_LEVAS) {
      if (localStorage.getItem(leva.flag + conta)) continue;
      salvos = [...new Set([...salvos, ...leva.abas])];
      localStorage.setItem(leva.flag + conta, '1');
      mudou = true;
    }
    for (const leva of ATALHOS_PADRAO_DESFEITAS) {
      const recebeu = localStorage.getItem(leva.flag + conta);
      if (!recebeu || recebeu === 'desfeita') continue;
      salvos = salvos.filter(a => !leva.abas.includes(a));
      localStorage.setItem(leva.flag + conta, 'desfeita');
      mudou = true;
    }
    if (mudou) localStorage.setItem(atalhosKey(authUser), JSON.stringify(salvos));
  } catch { /* sem localStorage: fica só com o que veio */ }
  return salvos;
};
const saveAtalhos = (authUser, ids) => { try { localStorage.setItem(atalhosKey(authUser), JSON.stringify(ids)); } catch { /* ignora */ } };
/* Prefixo no id da bolha pra o atalho nunca colidir com o id de um módulo —
   os dois convivem na mesma lista de ordem, tamanho e cor. */
const ATALHO_ID = (chave) => `atalho:${chave}`;

/* Cor pessoal de cada módulo — mesmo padrão de tamanho/ordem: só guarda quem
   a pessoa mudou (id de uma cor da paleta); o resto usa a cor padrão do
   próprio módulo (a do tema, ou a fixa de módulos como Uniko FIT). */
const MODULE_COLOR_PREFIX = 'uniko_module_color_';
const colorKey = (authUser) => MODULE_COLOR_PREFIX + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
const loadColorPrefs = (authUser) => {
  try { const r = JSON.parse(localStorage.getItem(colorKey(authUser)) || '{}'); return (r && typeof r === 'object') ? r : {}; }
  catch { return {}; }
};
const saveColorPrefs = (authUser, prefs) => { try { localStorage.setItem(colorKey(authUser), JSON.stringify(prefs)); } catch { /* ignora */ } };
/* Paleta das bolhas. Vai em volta do círculo cromático — azul, roxo, rosa,
   vermelho, laranja, amarelo, verde, ciano — e só depois os neutros, pra a
   lista de escolha ler como um degradê contínuo em vez de cores jogadas.
   Todos os tons são de saturação média-alta: precisam se sustentar tanto no
   tema claro quanto no escuro, já que a mesma cor pinta ícone, aura e borda. */
const COLOR_STEPS = [
  { id:'blue',    label:'Azul',      hex:'#3B82F6' },
  { id:'sky',     label:'Celeste',   hex:'#0EA5E9' },
  { id:'indigo',  label:'Índigo',    hex:'#6366F1' },
  { id:'purple',  label:'Roxo',      hex:'#8B5CF6' },
  { id:'violet',  label:'Violeta',   hex:'#A855F7' },
  { id:'fuchsia', label:'Magenta',   hex:'#D946EF' },
  { id:'pink',    label:'Rosa',      hex:'#EC4899' },
  { id:'rose',    label:'Cereja',    hex:'#F43F5E' },
  { id:'red',     label:'Vermelho',  hex:'#EF4444' },
  { id:'orange',  label:'Laranja',   hex:'#F97316' },
  { id:'amber',   label:'Âmbar',     hex:'#F59E0B' },
  { id:'yellow',  label:'Amarelo',   hex:'#EAB308' },
  { id:'lime',    label:'Limão',     hex:'#84CC16' },
  { id:'green',   label:'Verde',     hex:'#22C55E' },
  { id:'emerald', label:'Esmeralda', hex:'#10B981' },
  { id:'teal',    label:'Turquesa',  hex:'#14B8A6' },
  { id:'cyan',    label:'Ciano',     hex:'#06B6D4' },
  { id:'brown',   label:'Terra',     hex:'#B45309' },
  { id:'slate',   label:'Ardósia',   hex:'#64748B' },
  { id:'graphite',label:'Grafite',   hex:'#334155' },
];

/* Wordmark "UNIKO" desenhado em traços (monoline). O "N" é um "U" invertido. Um ponto de luz
   AZUL PERCORRE o traço de cada letra (do início ao fim, dando a volta) e pula pra próxima,
   em loop — como se estivesse escrevendo.

   DESEMPENHO (set/2026): o ponto era um pedaço do próprio traço, animado com
   stroke-dashoffset e dois drop-shadow por cima. Isso obriga o navegador a
   REPINTAR o SVG (e o filtro) a cada frame, sem trégua — medido com tracing,
   era ~600 pinturas a cada 2s na tela de módulos, e pausar só esta animação
   derrubava pra zero. Era o que o interruptor 3 (animações) "consertava".

   Agora o ponto é um <div> com brilho fixo (box-shadow pintado uma vez) que
   só se DESLOCA por transform — trabalho do compositor, zero repintura. A
   trilha de cada letra é amostrada uma vez do próprio path (getPointAtLength)
   e vira keyframes de translate.
   O translate é em % do tamanho do wordmark, então acompanha qualquer escala
   sem medir nada. */
const UNIKO_W = 487, UNIKO_H = 130;
const UNIKO_TRACOS = [
  'M18,18 L18,80 Q18,112 50,112 Q82,112 82,80 L82,18',                          // U
  'M128,112 L128,50 Q128,18 160,18 Q192,18 192,50 L192,112',                    // N (U invertido)
  'M238,18 L238,112',                                                           // I
  'M284,18 L284,112 M341,18 L286,65 L345,112',                                  // K
  'M430,18 Q469,18 469,65 Q469,112 430,112 Q391,112 391,65 Q391,18 430,18 Z',   // O
];
const UNIKO_DUR = 3.2;
let uTraceCSS = null;                     // calculado uma vez por carga
const keyframesUniko = () => {
  if (uTraceCSS !== null) return uTraceCSS;
  try {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
    document.body.appendChild(svg);
    uTraceCSS = UNIKO_TRACOS.map((d, i) => {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', d); svg.appendChild(el);
      const L = el.getTotalLength(), PASSOS = 36;
      let q = '';
      let ult = '';
      for (let k = 0; k <= PASSOS; k++) {
        const pt = el.getPointAtLength(L * k / PASSOS);
        ult = `translate(${(pt.x / UNIKO_W * 100).toFixed(2)}%,${(pt.y / UNIKO_H * 100).toFixed(2)}%)`;
        // Anda nos primeiros 20% do ciclo; o resto do tempo fica apagado,
        // esperando a vez das outras letras.
        q += `${(20 * k / PASSOS).toFixed(3)}%{transform:${ult};opacity:1}`;
      }
      q += `20.01%,100%{transform:${ult};opacity:0}`;
      return `@keyframes uTrace${i}{${q}}`;
    }).join('');
    svg.remove();
  } catch { uTraceCSS = ''; }             // sem DOM de SVG: fica só o wordmark
  return uTraceCSS;
};

const UnikoName = () => {
  const W = 11;
  const css = keyframesUniko();
  return (
    <span style={{ position:'relative', display:'inline-block', height:'0.82em', aspectRatio:`${UNIKO_W} / ${UNIKO_H}`,
      verticalAlign:'middle', color:'inherit' }}>
      <svg viewBox={`0 0 ${UNIKO_W} ${UNIKO_H}`} role="img" aria-label="UNIKO"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible' }}>
        {UNIKO_TRACOS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round"/>
        ))}
      </svg>
      {css && <style>{css}</style>}
      {css && UNIKO_TRACOS.map((_, i) => (
        <span key={i} aria-hidden="true" style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:0,
          willChange:'transform, opacity',
          animation:`uTrace${i} ${UNIKO_DUR}s linear infinite`, animationDelay:`${(i / UNIKO_TRACOS.length) * UNIKO_DUR}s` }}>
          {/* margens em % valem sobre a LARGURA do pai nos dois eixos — daí o
              mesmo -1.23% centralizando o ponto (12 de 487 unidades de largo). */}
          <span style={{ position:'absolute', left:0, top:0, width:'2.46%', aspectRatio:'1', marginLeft:'-1.23%', marginTop:'-1.23%',
            borderRadius:'50%', background:'#4AA6FF', boxShadow:'0 0 4px #4AA6FF, 0 0 9px #4AA6FF' }}/>
        </span>
      ))}
    </span>
  );
};

/* Estrelas cadentes cruzando o fundo — mesmo efeito da capa/hero da aba
   Início do Portal do Colaborador. Aqui a tela é bem maior, então espalha
   mais riscos por toda a área em vez de só 3. */
const SHOOT_POS = [
  {x:'8%',  y:'10%', delay:'-1.5s'}, {x:'64%', y:'6%',  delay:'-3.8s'},
  {x:'30%', y:'20%', delay:'-0.6s'}, {x:'86%', y:'32%', delay:'-2.4s'},
  {x:'46%', y:'66%', delay:'-4.6s'}, {x:'14%', y:'74%', delay:'-1.1s'},
  {x:'74%', y:'78%', delay:'-3.1s'},
];

const ModuleSelector = ({onSelect, authUser, onLogout, userPhoto, cargoModules, cargoRestricted, cargoTabRestrictions}) => {
  // Cargos (Dashboard RH → Gerenciar Permissões) liberam módulo por módulo
  // pra quem não é admin/moderador — camada ADICIONAL, só soma acesso, nunca
  // tira o que admin/moderador já tinham. `cargoRestricted` é a exceção: um
  // cargo em "modo restrito" (ver supabase_uniko_cargos_restrito.sql) faz a
  // pessoa só ver os módulos marcados nele, escondendo até os que normalmente
  // são abertos por padrão pra todo mundo — nunca afeta admin/moderador.
  const temCargoPara = (id) => cargoModules?.has?.(id) || false;
  useNomesExibicao(); // re-renderiza quando o nome de exibição carrega/muda
  const [pressed, setPressed] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);   // menu do ⚙ no celular
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
  // Modo "tamanho" — cada módulo e widget ganha um seletor pequeno/grande.
  const [sizeMode, setSizeMode] = useState(false);
  // Modo "cor dos módulos" — toca num módulo pra escolher a cor SÓ dele, ou
  // usa "Todos" no banner pra aplicar em todo mundo.
  // Modo "atalhos" — escolhe quais abas internas dos módulos viram atalho.
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
  const [tamNovo, setTamNovo] = useState(() => loadTamNovo(authUser));
  const mudarTamNovo = (patch) => {
    setTamNovo(prev => { const next = { ...prev, ...patch }; saveTamNovo(authUser, next); return next; });
  };
  const todosTamNovo = (v) => {
    const next = {};
    if (v) [...filteredMods.map(m => m.id), ...WIDGETS_NOVO].forEach(id => { next[id] = v; });
    setTamNovo(next); saveTamNovo(authUser, next);
  };
  /* Os quatro modos de personalizar a tela são mutuamente exclusivos, e cada
     botão repetia os cinco setStates pra desligar os outros. Um lugar só:
     liga o pedido, desliga o resto, e limpa a bolha que estava selecionada. */
  const abrirModo = (qual) => {
    setReorderMode(m => qual === 'ordem'   ? !m : false);
    setSizeMode(   m => qual === 'tamanho' ? !m : false);
    setColorMode(  m => qual === 'cor'     ? !m : false);
    setAtalhoMode( m => qual === 'atalhos' ? !m : false);
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
  const isMobile = useIsMobile();
  /* Num celular DEITADO (iPhone 14: 844x390) a largura passa do corte de
     "mobile", mas não há altura pra módulos + widgets lado a lado. Abaixo de
     520px de altura a lista é simplesmente a forma certa, não importa a largura. */
  const [alturaCurta, setAlturaCurta] = useState(() => window.innerHeight < 520);
  useEffect(() => {
    const medir = () => setAlturaCurta(window.innerHeight < 520);
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('orientationchange', medir); };
  }, []);
  const emLista = isMobile || alturaCurta;
  const isAdmin  = authUser?.role === 'admin';
  const isModerador = authUser?.role === 'moderador';
  // Cards com adminOnly (Dashboard RH, Ponto Eletrônico, Uniko Safer) liberam
  // pra moderador também. Cards com strictAdmin (Uniko Call, Prestações de
  // Contas, Portal dos Credenciados) NÃO liberam pra moderador — só admin de
  // verdade ou cargo.
  const podeAdminOnly = isAdmin || isModerador;
  // Mesma checagem que os módulos usam (moduloPermitido) + recorte de aba
  // (abaPermitida, ver supabase_uniko_cargos_tab_restrict.sql) — usada pelos
  // WIDGETS fixos da tela (Checkin, Banco de Horas, Ponto, Comunicados), que
  // não passam pela lista de módulos/atalhos e por isso furavam a restrição
  // de cargo (ex: cargo Comercial via widget "Banco de Horas" mesmo sem essa
  // aba marcada). Nunca afeta admin/moderador.
  const isPlainColaborador = !isAdmin && !isModerador;
  const moduloPermitido = (moduloId) => !isPlainColaborador || !cargoRestricted || temCargoPara(moduloId);
  const abaPermitida = (moduloId, abaId) => {
    if (!moduloPermitido(moduloId)) return false;
    if (!isPlainColaborador) return true;
    const lista = cargoTabRestrictions?.[moduloId];
    return !lista?.length || lista.includes(abaId);
  };

  const IcoColab = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
  // Nota musical dupla. Era uma lua — bonita, mas não dizia "música" nenhuma
  // pra quem bate o olho na tela procurando a Central Alexa.
  const IcoAlexa = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
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
  /* Rede: um nó no centro ligado a outros três — setores conectados. (Era um
     quadro Kanban, que dizia "tarefas" e não "conexão".) */
  const IcoConexao = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12.5" r="2.8"/>
      <circle cx="5" cy="5.5" r="2.2"/><circle cx="19" cy="5.5" r="2.2"/><circle cx="12" cy="20.5" r="1.9"/>
      <path d="M10.1 10.6L6.6 7.1M13.9 10.6l3.5-3.5M12 15.3v3.3"/>
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
  // Escudo com balão de conversa — organizador de conversas exportadas do WhatsApp.
  const IcoSafer = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5.5c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6z"/>
      <path d="M9 11.5c0-1.2 1.2-2 3-2s3 .8 3 2-1.2 2-3 2h-1.2l-1 1v-1.4c-.5-.2-.8-.9-.8-1.6z" fill="currentColor" stroke="none"/>
    </svg>
  );
  // Escudo com cadeado — Uniko Security (mesma família visual do IcoSafer,
  // mas com cadeado em vez de balão de conversa: dado oficial/API, não
  // export manual).
  const IcoSecurityMod = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5.5c0 4.6-3 8.3-7 9.5-4-1.2-7-4.9-7-9.5V6z"/>
      <rect x="9.3" y="11.2" width="5.4" height="4.2" rx="1" fill="currentColor" stroke="none"/>
      <path d="M10.3 11.2v-1.4a1.7 1.7 0 013.4 0v1.4"/>
    </svg>
  );
  // Crachá/carteirinha de credenciado — Portal dos Credenciados.
  const IcoBeneficios = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="15" rx="2"/>
      <path d="M9 2.5h6" strokeLinecap="round"/>
      <circle cx="8.5" cy="11.3" r="2"/>
      <path d="M6 16.5c.4-1.5 1.4-2.3 2.5-2.3s2.1.8 2.5 2.3"/>
      <line x1="13.5" y1="9.8" x2="18" y2="9.8"/>
      <line x1="13.5" y1="12.8" x2="18" y2="12.8"/>
    </svg>
  );
  // Módulos "em breve" — só admin vê, ainda sem tela de verdade por trás.
  const IcoCall = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4c0 1-1 2-2 2-8 0-15-7-15-15 0-1 1-2 2-2z"/>
    </svg>
  );
  const IcoPrestacaoContas = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l3 3v17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M9 12h6M9 16h6"/><circle cx="9.5" cy="8" r="1.2"/>
    </svg>
  );
  const allMods = [
    // `fixo`: o Portal é o módulo principal — sempre o primeiro, e nasce grande.
    {id:'colaborador',      label:'Portal do Colaborador', sub:'Portal RH completo',               icon:IcoColab,       color:T.gold, bg:T.goldGl, tag:'Principal',  adminOnly:false, fixo:true},
    {id:'alexa',            label:'Central Alexa',         sub:'Festival · Música · Biblioteca',   icon:IcoAlexa,       color:T.gold, bg:T.goldGl, tag:'Música',     adminOnly:false},
    {id:'faturamento',      label:'Oficina Estelar',       sub:'Controle de Notas · Assinatura',   icon:IcoFaturamento, color:T.gold, bg:T.goldGl, tag:'Documentos', adminOnly:false},
    // Uniko FIT acompanha o tema como os outros (era laranja fixo até set/2026).
    {id:'uniko-fit',        label:'Uniko FIT',             sub:'Check-in de treino · Ranking',     icon:IcoFit,         color:T.gold, bg:T.goldGl, tag:'Fitness',    adminOnly:false},
    {id:'dashboard',        label:'Dashboard RH',          sub:'Gestão · Funcionários',            icon:IcoDash,        color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'ponto',            label:'Ponto Eletrônico',      sub:'Leitor de arquivo AFD',            icon:IcoPonto,       color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'mercado-estelar',  label:'Prisma Store',          sub:'Loja de benefícios e recompensas', icon:IcoMercado,     color:T.gold, bg:T.goldGl, tag:'Recompensas', adminOnly:false},
    {id:'conexao-setorial', label:'Trello',                sub:'Quadro Kanban · Salas por assunto',  icon:IcoConexao,        color:T.gold, bg:T.goldGl, tag:'Equipe',     adminOnly:false},
    {id:'info-adicional',   label:'Informações Adicionais', sub:'Instalar app · Sobre o Uniko',     icon:IcoInfo,        color:T.blue, bg:T.blueGl||T.goldGl, tag:'Guia', adminOnly:false},
    {id:'uniko-safer',      label:'Uniko Safer',           sub:'Conversas do WhatsApp organizadas', icon:IcoSafer,       color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    // Só admin vê (não moderador) — pedido explícito: dado sensível vindo da
    // WhatsApp Cloud API oficial (Coexistence), não export manual.
    {id:'uniko-security',   label:'Uniko Security',        sub:'Conversas via WhatsApp Cloud API', icon:IcoSecurityMod, color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true, strictAdmin:true},
    {id:'7-beneficios',     label:'Portal dos Credenciados', sub:'Plataforma 7 Benefícios',        icon:IcoBeneficios,  color:T.gold, bg:T.goldGl, tag:'Ferramenta', adminOnly:true, strictAdmin:true},
    // Só admin vê (não moderador) — chamadas gravadas do WhatsApp Web, dado sensível.
    {id:'uniko-call',       label:'Uniko Call',            sub:'Chamadas gravadas e transcritas',  icon:IcoCall,        color:T.gold, bg:T.goldGl, tag:'Admin',    adminOnly:true, strictAdmin:true},
    {id:'prestacao-contas', label:'Prestações de Contas',  sub:'Em breve',                          icon:IcoPrestacaoContas, color:T.gold, bg:T.goldGl, tag:'Ferramenta', adminOnly:true, strictAdmin:true},
  ];
  /* Os atalhos viram "módulos" de mentira: daí em diante tudo que a tela já
     sabe fazer (ordenar, redimensionar, colorir) vale pra eles de graça. O que
     muda é só o clique, que leva pro módulo já na aba certa. */
  const salasConexao = useSalasConexao();
  const catalogo = catalogoAtalhos(authUser, salasConexao, isPlainColaborador ? cargoTabRestrictions : {});
  const atalhoMods = atalhos
    .map(chave => ({ chave, a: resolverAtalho(chave, catalogo) }))
    .filter(x => x.a)
    .map(({ chave, a }) => ({
      id: ATALHO_ID(chave), label: a.label, sub: `Atalho · ${a.nomeModulo}`,
      // Sala da Conexão Setorial usa a cor da própria sala; o resto, o azul do tema.
      icon: a.icon, color: a.cor || T.blue || T.gold, bg: a.cor ? a.cor + '22' : (T.blueGl || T.goldGl),
      tag: 'Atalho', adminOnly: false, atalho: true, modulo: a.modulo, tab: a.aba,
      // Seus Dados nasce grande (widget deitado); os outros atalhos, pequenos.
      tamPadrao: chave === 'dados' ? 'g' : undefined,
    }));
  const filteredMods = [...allMods, ...atalhoMods]
    .filter(m => {
      // Atalho aponta pra um módulo de verdade via `m.modulo` (ex: atalho
      // "Seus Dados" → módulo 'colaborador') — no modo restrito, checa esse
      // alvo real, senão um atalho furava a restrição do card principal.
      if (cargoRestricted && !isAdmin && !isModerador) return temCargoPara(m.modulo || m.id);
      return !m.adminOnly || (m.strictAdmin ? isAdmin : podeAdminOnly) || temCargoPara(m.id);
    });
  /* O Portal do Colaborador fica SEMPRE em primeiro — em qualquer ordem salva,
     no computador e no celular. Reordenar mexe só nos outros. */
  const fixarPrincipal = (lista) => {
    const i = lista.findIndex(x => (x.id || x) === 'colaborador');
    return i > 0 ? [lista[i], ...lista.slice(0, i), ...lista.slice(i + 1)] : lista;
  };
  const mods = fixarPrincipal(applyOrder(filteredMods, order));
  // Computador: 1ª vez (sem ordem salva) usa esta sequência. Depois que a
  // pessoa reorganiza, lista do celular e grade do computador seguem a MESMA
  // ordem escolhida por ela.
  const ORDEM_PADRAO = ['colaborador','mercado-estelar','alexa','faturamento','dashboard','conexao-setorial','ponto','uniko-fit','info-adicional','uniko-safer','uniko-security','7-beneficios','uniko-call','prestacao-contas'];
  const modsTela = order.length ? mods : fixarPrincipal(applyOrder(filteredMods, ORDEM_PADRAO));
  /* Reordenar no celular é por SETAS, não arrastando. Não é preguiça: o
     drag-and-drop HTML5 (o mesmo que a grade usa no computador) simplesmente não
     existe no Safari do iOS — arrastar ali nunca funcionaria. Subir/descer um
     item é o gesto que funciona em qualquer toque. */
  const moverModulo = (id, direcao) => {
    const ids = mods.map(m => m.id);
    const de = ids.indexOf(id);
    const para = de + direcao;
    if (de < 0 || para < 0 || para >= ids.length) return;
    if (ids[de] === 'colaborador' || ids[para] === 'colaborador') return;   // o principal não sai do 1º lugar
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    setOrder(ids);
    saveModuleOrder(authUser, ids);
  };

  const reorderCard = (list, fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const ids = list.map(m => m.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const final = fixarPrincipal(ids);   // soltar em cima do Portal põe logo depois dele
    setOrder(final); saveModuleOrder(authUser, final);
  };

  // ─── MOBILE — lista vertical ─────────────────────────────────────────────
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
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{nomeChamado(authUser.name)}</div>
                <div style={{fontSize:9.5, color:T.gold, fontWeight:700}}>
                  {isAdmin?'Admin':isModerador?'Moderador':'Colaborador'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Título · "⚙" abre o menu.
            A seta "<" que ficava à esquerda saiu: ela DESLOGAVA. Um chevron
            apontando pra trás promete "voltar uma tela", e esta é a primeira
            tela depois do login — não há pra onde voltar. Quem quer sair usa
            "Sair" no menu, escrito. */}
        <div style={{padding:'20px 16px 2px', display:'flex', alignItems:'center', gap:10}}>
          <div style={{fontFamily:'var(--font-brand)', fontSize:26, fontWeight:800, color:T.text, flex:1}}>Módulos</div>
          {/* O menu precisa nascer DENTRO deste invólucro posicionado. Solto,
              o `position:absolute` dele resolvia contra a raiz da página e ele
              aparecia grudado no topo da tela — por baixo da status bar do
              iPhone, com "Tema" escondido atrás do relógio e da bateria. */}
          <div style={{position:'relative', flexShrink:0}}>
          <button onClick={()=>setMenuMobile(v=>!v)} title="Menu"
            style={{width:32, height:32, borderRadius:10, border:`1px solid ${T.border}`, background:T.surface,
              color:T.textS, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
              WebkitTapHighlightColor:'transparent'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>

        {/* Menu do ⚙ — no celular ele é o único ponto de entrada pra tudo que
            no desktop mora no card de perfil. Pende do próprio botão
            (top:100%), então acompanha o cabeçalho e nunca sobe pra cima da
            status bar. */}
        {menuMobile && (
          <>
            <div onClick={()=>setMenuMobile(false)}
              style={{position:'fixed', inset:0, zIndex:60, background:'transparent'}}/>
            <div style={{position:'absolute', top:'100%', right:0, marginTop:8, zIndex:61,
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:14,
              boxShadow:T.shL, overflow:'hidden', minWidth:210,
              maxHeight:'calc(100vh - 140px)', overflowY:'auto'}}>
              {[
                { rot:'Tema',              dica:'Cor do sistema',        onClick:()=>{ setPainelConfig('theme'); setShowSettings(true); },
                  icone:<><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></> },
                { rot:'Conta',             dica:'Senha e dados',          onClick:()=>{ setPainelConfig('account'); setShowSettings(true); },
                  icone:<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></> },
                { rot:'Atalhos',           dica:'Abas dos módulos na lista', ativo:atalhoMode, onClick:()=>{ setAtalhoMode(v=>!v); setReorderMode(false); },
                  icone:<><path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></> },
                { rot:'Organizar módulos', dica:'Mudar a ordem da lista',  ativo:reorderMode, onClick:()=>{ setReorderMode(v=>!v); setAtalhoMode(false); },
                  icone:<><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></> },
                { rot:'Sair',              dica:'Encerrar a sessão',       perigo:true, onClick:onLogout,
                  icone:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></> },
              ].map((it,i,arr) => (
                <button key={it.rot} onClick={()=>{ it.onClick(); setMenuMobile(false); }}
                  style={{display:'flex', alignItems:'center', gap:11, width:'100%', padding:'13px 15px',
                    border:'none', borderBottom: i<arr.length-1 ? `1px solid ${T.divider||T.border}` : 'none',
                    background: it.ativo ? T.goldGl : 'transparent', cursor:'pointer', textAlign:'left',
                    color: it.perigo ? T.danger : it.ativo ? T.gold : T.text,
                    fontSize:14.5, fontWeight:600, fontFamily:'var(--font-body)',
                    WebkitTapHighlightColor:'transparent'}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                    strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{it.icone}</svg>
                  <span style={{flex:1}}>{it.rot}</span>
                  {it.ativo && <span style={{fontSize:10.5, fontWeight:700, color:T.gold}}>ON</span>}
                </button>
              ))}
            </div>
          </>
        )}
          </div>
        </div>

        <div style={{padding:'2px 16px 18px', fontSize:12.5, color:T.textT}}>
          {reorderMode ? 'Use as setas pra mudar a ordem dos módulos'
            : atalhoMode ? 'Toque numa aba pra pôr ou tirar da lista'
            : 'Escolha um módulo para continuar'}
        </div>

        {/* Escolha de atalhos — mesma lista do desktop, em pílulas que quebram
            linha (no celular não há espaço pra uma faixa só). */}
        {atalhoMode && (
          <div style={{padding:'0 16px 14px', display:'flex', flexDirection:'column', gap:12}}>
            {catalogo.map(g => (
              <div key={g.modulo}>
                <div style={{fontSize:11.5, fontWeight:700, color:T.textT, marginBottom:6}}>{g.nome}</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:7}}>
                  {g.abas.map(n => {
                    const ligado = atalhos.includes(n.chave);
                    return (
                      <button key={n.chave} onClick={()=>toggleAtalho(n.chave)}
                        style={{display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:10, cursor:'pointer',
                          border:`1px solid ${ligado?T.gold:T.border}`, background:ligado?T.gold:T.surface,
                          color:ligado?'#fff':T.textS, fontSize:12.5, fontWeight:600, fontFamily:'var(--font-body)',
                          WebkitTapHighlightColor:'transparent'}}>
                        {React.cloneElement(n.icon, {width:14, height:14})}
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista vertical dos módulos */}
        <div style={{padding:'0 16px 24px', display:'flex', flexDirection:'column', gap:10}}>
          {mods.map(m => {
            const isPressed = pressed === m.id;
            const { color: mColor, bg: mBg } = getModuleColor(m);
            return (
              <div key={m.id}
                className="mob-card"
                onClick={reorderMode ? undefined : () => onSelect(m.atalho ? m.modulo : m.id, m.tab)}
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
                {reorderMode ? (
                  <div style={{display:'flex', flexDirection:'column', gap:4, flexShrink:0}}>
                    {[[-1,'M18 15l-6-6-6 6'],[1,'M6 9l6 6 6-6']].map(([dir,d],k) => {
                      const i = mods.findIndex(x => x.id === m.id);
                      const fixo = m.id === 'colaborador';
                      const bloqueado = fixo || (dir === -1 ? i === 0 || mods[i - 1]?.id === 'colaborador' : i === mods.length - 1);
                      return (
                        <button key={k} disabled={bloqueado}
                          onClick={(e)=>{ e.stopPropagation(); moverModulo(m.id, dir); }}
                          aria-label={dir === -1 ? 'Subir' : 'Descer'}
                          style={{width:34, height:26, borderRadius:8, border:`1px solid ${T.border}`,
                            background: bloqueado ? 'transparent' : T.goldGl, color: bloqueado ? T.textD : T.gold,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado ? .4 : 1,
                            WebkitTapHighlightColor:'transparent'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <path d="M9 6l6 6-6 6"/>
                  </svg>
                )}
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

  // ─── COMPUTADOR — módulos + widgets ──────────────────────────────────────
  /* Ações do widget de perfil (Perfil, Conta, Tema, os modos de personalizar
     e Sair). */
  const acoesCard = [
    { id:'perfil', rot:'Perfil', dica:'Editar seus dados',
      onClick:()=>onSelect('colaborador','dados'), destaque:true,
      icone:<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></> },
    { id:'conta', rot:'Conta', dica:'Senha e dados da conta',
      onClick:()=>{ setPainelConfig('account'); setShowSettings(true); },
      icone:<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></> },
    { id:'tema', rot:'Tema', dica:'Cor do sistema (claro/escuro)',
      onClick:()=>{ setPainelConfig('theme'); setShowSettings(true); },
      icone:<><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></> },
    { id:'ordem', rot:'Ordem', dica:'Arrastar pra reorganizar os módulos',
      ativo:reorderMode, onClick:()=>abrirModo('ordem'),
      icone:<><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></> },
    { id:'tamanho', rot:'Tamanho', dica:'Pequeno ou grande, como os widgets do iPhone',
      ativo:sizeMode, onClick:()=>abrirModo('tamanho'),
      icone:<><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></> },
    { id:'cor', rot:'Cor', dica:'Cor de cada módulo',
      ativo:colorMode, onClick:()=>abrirModo('cor'),
      icone:<><circle cx="13.5" cy="6.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="7" cy="12.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="11" cy="18" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c1.9 0 3.6-1.6 3.6-3.6C21 6.4 16.9 2 12 2z"/></> },
    { id:'atalhos', rot:'Atalhos', dica:'Pôr abas internas dos módulos como atalho',
      ativo:atalhoMode, onClick:()=>abrirModo('atalhos'),
      icone:<><path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></> },
    { id:'sair', rot:'Sair', dica:'Encerrar a sessão', perigo:true, onClick:onLogout,
      icone:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></> },
  ];

  /* Popover de cor — abre ao tocar num módulo em "modo cor". Nasce centrado na
     tela (não preso ao módulo) pra nunca correr risco de sair dela. */
  const popoverCor = () => {
    if (!colorMode || !coloringId) return null;
    const m = modsTela.find(x=>x.id===coloringId);
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
  };

  return(
    // SEM background aqui. Tinha um `background: T.page` opaco nesta div, e
    // era ele que escondia o lava lamp do App — o fundo animado rodava atrás,
    // tapado, e esta tela parecia ter fundo chapado. Ele existia porque o
    // wrapper do App só repinta quando o PRÓPRIO App re-renderiza, e trocar de
    // tema aqui dentro (activeTheme é estado local desta tela) não causa isso:
    // o fundo ficava com a cor do tema anterior. Agora quem resolve isso é o
    // aviso de troca de tema (onThemeChange, em contexts/theme.js), que o
    // lava lamp escuta e se redesenha sozinho — e é ele que pinta o fundo.
    <div style={{height:'calc(100vh / 0.8)',overflow:'hidden',display:'flex',flexDirection:'column',
      position:'relative',zIndex:1,padding:'22px 34px 26px',boxSizing:'border-box',
      // Zoom de 80%: os cards em 100% ficavam grandes demais e a tela não
      // respirava — aqui reduzimos tudo (cards, textos, ícones) igual a um
      // Ctrl+- do navegador, sem precisar remexer em cada número do layout.
      // A altura precisa compensar o zoom (100vh/0.8) porque o `vh` é medido
      // pela viewport de verdade, não pelo espaço já encolhido — sem isso a
      // caixa ficava menor que a tela E cortava conteúdo (overflow:hidden
      // corta ANTES do zoom encolher), sobrando uma faixa vazia embaixo.
      zoom:0.8}}>

      <style>{`@keyframes msShootStar{0%,33%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(8px,8px)}65%{opacity:.45;transform:translate(140px,140px)}72%,100%{opacity:0;transform:translate(180px,180px)}}`}</style>
      <div style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',pointerEvents:'none'}}>
        {SHOOT_POS.map((s,i)=>(
          <div key={i} className="estrela-cadente" style={{position:'absolute',left:s.x,top:s.y,animation:`msShootStar 6s ${s.delay} linear infinite`}}>
            <div style={{width:76,height:1.5,background:'linear-gradient(to right,transparent,rgba(255,255,255,.88),rgba(255,255,255,.28),transparent)',borderRadius:2,transform:'rotate(45deg)',transformOrigin:'center'}}/>
          </div>
        ))}
      </div>

      {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} painelInicial={painelConfig} onClose={()=>setShowSettings(false)}/>}

      {/* ── Cabeçalho: wordmark à esquerda · saudação + título ao centro ── */}
      <div className="fsu" style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'start',marginBottom:8}}>
        <div>
          <div style={{fontFamily:'var(--font-brand)',fontSize:46,fontWeight:700,color:T.text,letterSpacing:'.08em'}}><UnikoName/></div>
          <div style={{fontSize:15,color:T.textT,letterSpacing:'.14em',textTransform:'uppercase',marginTop:4}}>Sistema Corporativo</div>
        </div>
        <div style={{textAlign:'center'}}>
          {authUser?.name && <div style={{fontSize:11,color:T.textT,letterSpacing:'.16em',textTransform:'uppercase',marginBottom:6}}>
            Bem-vindo, {nomeChamado(authUser.name)}
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
          <span>✛ Arraste os módulos pra reorganizar como eles aparecem na sua tela.</span>
          <button onClick={()=>setReorderMode(false)}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {sizeMode && (
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',width:'fit-content'}}>
          <span>📐 Escolha pequeno ou grande em cada módulo e widget, ou aplique em tudo:</span>
          <div style={{display:'flex',gap:4}}>
            {[['p','Tudo pequeno'],['g','Tudo grande'],[null,'Padrão']].map(([v,rot])=>(
              <button key={rot} onClick={()=>todosTamNovo(v)}
                style={{padding:'4px 11px',borderRadius:7,border:`1px solid ${T.goldLine}55`,background:T.surface,color:T.text,
                  cursor:'pointer',fontWeight:700,fontSize:11.5,fontFamily:'var(--font-body)'}}>{rot}</button>
            ))}
          </div>
          <button onClick={()=>setSizeMode(false)}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {atalhoMode && (
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',
          width:'fit-content',maxWidth:'min(94vw, 900px)'}}>
          <span style={{flexBasis:'100%',textAlign:'center'}}>
            🧭 Escolha as abas que você quer como atalho junto dos módulos:
          </span>
          {/* Uma linha por módulo. Com quatro módulos e dezenas de abas, sem o
              teto de altura o banner empurrava a tela inteira pra baixo. */}
          <div style={{display:'flex',flexDirection:'column',gap:8,flexBasis:'100%',maxHeight:'34vh',overflowY:'auto'}}>
            {catalogo.map(g => (
              <div key={g.modulo} style={{display:'flex',alignItems:'baseline',gap:10}}>
                <span style={{flex:'0 0 140px',textAlign:'right',fontSize:11.5,fontWeight:700,color:T.textT}}>{g.nome}</span>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {g.abas.map(n => {
                    const ligado = atalhos.includes(n.chave);
                    return (
                      <button key={n.chave} onClick={()=>toggleAtalho(n.chave)} title={ligado?'Remover dos atalhos':'Adicionar aos atalhos'}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'6px 11px',borderRadius:9,cursor:'pointer',
                          border:`1px solid ${ligado?T.gold:T.border}`,background:ligado?T.gold:'transparent',
                          color:ligado?'#fff':T.textS,fontSize:12,fontWeight:600,fontFamily:'var(--font-body)'}}>
                        {React.cloneElement(n.icon, {width:13,height:13})}
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setAtalhoMode(false)}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      {colorMode && (
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,margin:'6px auto 0',padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)',
          width:'fit-content',maxWidth:'min(94vw, 780px)'}}>
          <span>🎨 Toque num módulo pra escolher a cor só dele, ou aplique em todos:</span>
          {/* maxWidth obriga a paleta a quebrar em linhas: com 20 cores, sem
              isto o banner esticava numa faixa única atravessando a tela. */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap',maxWidth:312}}>
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

      {/* ── O palco: módulos à esquerda, widgets à direita ──────────────────
          A lista chega pronta daqui (ordenada, com os atalhos dentro e com as
          cores escolhidas pela pessoa); o MenuLayoutNovo só desenha. */}
      <MenuLayoutNovo mods={modsTela} onSelect={onSelect} getModuleColor={getModuleColor}
        authUser={authUser} userPhoto={userPhoto}
        widgetsOcultos={{
          checkin: !abaPermitida('mercado-estelar', 'checkin'),
          horas: !abaPermitida('colaborador', 'horas'),
          ponto: !abaPermitida('colaborador', 'ponto'),
          avisos: !abaPermitida('colaborador', 'comunicados'),
        }}
        acoes={acoesCard}
        tamanhos={tamNovo} onTamanhos={mudarTamNovo}
        modo={{ reorderMode, colorMode, sizeMode, dragModId, coloringId, setDragModId,
          onSoltar: (paraId) => { reorderCard(modsTela, dragModId, paraId); setDragModId(null); },
          onEscolherCor: (id) => setColoringId(atual => atual === id ? null : id) }}
        sobreposicao={colorMode && coloringId ? (
          <div style={{position:'fixed',inset:0,zIndex:30,pointerEvents:'none'}}>
            <div style={{pointerEvents:'auto'}}>{popoverCor()}</div>
          </div>
        ) : null}/>
    </div>
  );
};

export { ModuleSelector };
