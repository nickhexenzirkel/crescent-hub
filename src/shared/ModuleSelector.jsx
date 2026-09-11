import React, { useState, useRef, useEffect } from 'react';
import { T, applyTheme } from '../contexts/theme';
import { AvatarCircle } from './components';
import { SettingsModal } from './SettingsModal';
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
// 4 tamanhos discretos (não contínuo) — assim dá pra GARANTIR que o algoritmo
// de espaçamento da órbita sempre encontra um jeito de encaixar todo mundo
// sem uma bolha maior comer o espaço da vizinha.
const SIZE_STEPS = [
  { id:'p',  label:'P',  mult:0.82 },
  { id:'m',  label:'M',  mult:1    },
  { id:'g',  label:'G',  mult:1.18 },
  { id:'gg', label:'GG', mult:1.35 },
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
const SHOOT_POS = [
  {x:'8%',  y:'10%', delay:'-1.5s'}, {x:'64%', y:'6%',  delay:'-3.8s'},
  {x:'30%', y:'20%', delay:'-0.6s'}, {x:'86%', y:'32%', delay:'-2.4s'},
  {x:'46%', y:'66%', delay:'-4.6s'}, {x:'14%', y:'74%', delay:'-1.1s'},
  {x:'74%', y:'78%', delay:'-3.1s'},
];

const ModuleSelector = ({onSelect, authUser, onLogout, userPhoto}) => {
  const [hov, sh]     = useState(null);
  const [pressed, setPressed] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
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
  useEffect(() => {
    if (isMobile) return;
    const el = orbitAreaRef.current; if (!el) return;
    const calc = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / 1180, h / 720, 1);
      setOrbitScale(s > 0 ? s : 1);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);
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
  const filteredMods = allMods.filter(m => !m.adminOnly || (m.strictAdmin ? isAdmin : podeAdminOnly));
  const mods = applyOrder(filteredMods, order);
  // Desktop em órbita: 1ª vez (sem ordem salva) usa esta sequência — é o que
  // reproduz exatamente as posições da referência (relógio a partir do topo).
  // Depois que a pessoa arrasta pra reorganizar, os dois (lista mobile e
  // órbita desktop) passam a seguir a MESMA ordem escolhida por ela.
  const ORBIT_DEFAULT = ['alexa','faturamento','dashboard','mercado-estelar','conexao-setorial','ponto','uniko-fit','colaborador','info-adicional'];
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
  if (isMobile) {
    return (
      <div style={{minHeight:'100vh', display:'flex', flexDirection:'column',
        background:T.page, fontFamily:'var(--font-body)', position:'relative', zIndex:0}}>

        <style>{`.mob-card { -webkit-tap-highlight-color: transparent; }
          @keyframes msShootStar{0%,33%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(8px,8px)}65%{opacity:.45;transform:translate(90px,90px)}72%,100%{opacity:0;transform:translate(115px,115px)}}`}</style>
        <div style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',pointerEvents:'none'}}>
          {SHOOT_POS.map((s,i)=>(
            <div key={i} style={{position:'absolute',left:s.x,top:s.y,animation:`msShootStar 6s ${s.delay} linear infinite`}}>
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
            return (
              <div key={m.id}
                className="mob-card"
                onClick={() => onSelect(m.id)}
                onTouchStart={() => setPressed(m.id)}
                onTouchEnd={() => setPressed(null)}
                onTouchCancel={() => setPressed(null)}
                style={{
                  display:'flex', alignItems:'center', gap:16,
                  background: isPressed ? T.page : T.surface,
                  border:`1px solid ${isPressed ? m.color+'55' : T.border}`,
                  borderRadius:18, padding:'16px 16px', cursor:'pointer',
                  transform: isPressed ? 'scale(0.98)' : 'scale(1)',
                  transition:'transform .12s, background .12s, border-color .12s',
                  WebkitTapHighlightColor:'transparent', userSelect:'none',
                }}>
                <div style={{width:54, height:54, borderRadius:15, background:m.bg,
                  border:`1px solid ${m.color}22`, display:'flex', alignItems:'center',
                  justifyContent:'center', color:m.color, flexShrink:0}}>
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

        {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} onClose={()=>setShowSettings(false)}/>}

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
  const RX = 44, RY = 35; // raio da elipse, em % da largura/altura do container
  const BASE_D = 178, BUBBLE_GAP = 30; // diâmetro e respiro mínimo padrão, em px (escala 1x)
  // Ângulos igualmente espaçados NÃO viram distância igual numa elipse: como
  // ela é mais "achatada" nos lados (RX > RY), bolhas perto do meio-esquerda/
  // meio-direita ficavam bem mais coladas que as de cima/baixo (relatado —
  // "Prisma Store" e "Conexão Setorial" quase se tocando). Em vez do ângulo
  // bruto, os N ângulos abaixo dividem o PERÍMETRO da elipse — mas agora NÃO
  // em partes iguais: cada módulo recebe uma fatia do anel PROPORCIONAL ao
  // tamanho que a pessoa escolheu pra ele (`getSizeMult`), então uma bolha
  // "GG" ganha mais espaço ao redor dela automaticamente, sem invadir a
  // vizinha. Se a soma dos tamanhos pedidos não couber no anel inteiro, todo
  // mundo encolhe PROPORCIONALMENTE junto (nunca uma bolha "come" o espaço
  // reservado da outra) — é o `fitFactor` abaixo.
  const orbitWpx = 1180 * orbitScale, orbitHpx = 720 * orbitScale;
  const pxPerUnit = (orbitWpx / 100 + orbitHpx / 100) / 2;
  const weights = orbitMods.map(m => (BASE_D * orbitScale * getSizeMult(m.id) + BUBBLE_GAP * orbitScale) / pxPerUnit);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const { orbitAngles, slotArc } = (() => {
    const SAMPLES = 720, STEP = 360 / SAMPLES;
    const arcAt = [0];
    let prevX = RX * Math.cos(-Math.PI / 2), prevY = RY * Math.sin(-Math.PI / 2), total = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      const ang = (-90 + i * STEP) * Math.PI / 180;
      const x = RX * Math.cos(ang), y = RY * Math.sin(ang);
      total += Math.hypot(x - prevX, y - prevY);
      arcAt.push(total); prevX = x; prevY = y;
    }
    const angAt = (want) => {
      let i = 0; while (i < arcAt.length - 1 && arcAt[i] < want) i++;
      return -90 + i * STEP;
    };
    let acc = 0; const out = []; const slots = [];
    for (let k = 0; k < N; k++) {
      const w = weights[k] ?? (totalWeight / N);
      slots.push((w / totalWeight) * total);
      out.push(angAt((acc + w / 2) / totalWeight * total));
      acc += w;
    }
    return { orbitAngles: out, slotArc: slots };
  })();
  // Diâmetro final de cada bolha: o que a pessoa pediu, mas nunca maior do
  // que a fatia do anel que sobrou pra ela (garante que nunca engole a vizinha).
  const orbitDiam = (i) => {
    const desired = BASE_D * orbitScale * getSizeMult(orbitMods[i]?.id);
    const allocatedPx = (slotArc[i] ?? 0) * pxPerUnit;
    const capped = Math.min(desired, Math.max(0, allocatedPx - BUBBLE_GAP * 0.5 * orbitScale));
    return Math.max(90 * orbitScale, capped);
  };
  const orbitPt = (i) => {
    const ang = orbitAngles[i % N] * Math.PI / 180;
    return { left: 50 + RX * Math.cos(ang), top: 50 + RY * Math.sin(ang) };
  };
  // Pontinho decorativo entre duas bolhas vizinhas — só o meio ANGULAR entre
  // elas (não precisa ser exato, é decoração).
  const orbitMidPt = (i) => {
    const a0 = orbitAngles[i], a1raw = orbitAngles[(i + 1) % N];
    const a1 = a1raw > a0 ? a1raw : a1raw + 360;
    const ang = ((a0 + a1) / 2) * Math.PI / 180;
    return { left: 50 + RX * Math.cos(ang), top: 50 + RY * Math.sin(ang) };
  };

  return(
    // background:T.page precisa estar aqui, e não só no wrapper do App.jsx —
    // aquele wrapper só repinta quando o PRÓPRIO App re-renderiza, e trocar
    // de tema aqui dentro (activeTheme é estado local do ModuleSelector) não
    // causa isso. Resultado: o fundo ficava com a cor do tema ANTERIOR
    // enquanto textos/bolhas já mostravam a cor nova (baixo contraste, tudo
    // "sumindo"). Lendo T.page no próprio render do ModuleSelector, ele sai
    // sempre atualizado junto com o resto.
    <div style={{height:'100vh',overflow:'hidden',display:'flex',flexDirection:'column',
      position:'relative',zIndex:1,padding:'22px 34px 26px',boxSizing:'border-box',background:T.page}}>

      <style>{`@keyframes msShootStar{0%,33%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(8px,8px)}65%{opacity:.45;transform:translate(140px,140px)}72%,100%{opacity:0;transform:translate(180px,180px)}}`}</style>
      <div style={{position:'absolute',inset:0,zIndex:-1,overflow:'hidden',pointerEvents:'none'}}>
        {SHOOT_POS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.x,top:s.y,animation:`msShootStar 6s ${s.delay} linear infinite`}}>
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
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:5,width:'100%'}}>
            <button onClick={()=>onSelect('colaborador','dados')} title="Editar perfil"
              style={{display:'flex',alignItems:'center',justifyContent:'center',height:30,borderRadius:9,
                border:`1px solid ${T.goldLine}44`,background:T.goldGl,color:T.gold,cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button onClick={()=>setShowSettings(true)} title="Configurações"
              style={{display:'flex',alignItems:'center',justifyContent:'center',height:30,borderRadius:9,
                border:`1px solid ${T.border}`,background:'transparent',color:T.textS,cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
            <button onClick={()=>setReorderMode(r=>!r)} title="Organizar a ordem dos módulos"
              style={{display:'flex',alignItems:'center',justifyContent:'center',height:30,borderRadius:9,
                border:`1px solid ${reorderMode?T.goldLine+'44':T.border}`,background:reorderMode?T.goldGl:'transparent',color:reorderMode?T.gold:T.textS,cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </button>
            <button onClick={onLogout} title="Sair"
              style={{display:'flex',alignItems:'center',justifyContent:'center',height:30,borderRadius:9,
                border:`1px solid ${T.dangerGl||T.border}`,background:'transparent',color:T.danger,cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} onClose={()=>setShowSettings(false)}/>}

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

      {/* ── Órbita: anéis decorativos + mascote central + bolhas dos módulos ──
          A área abaixo ocupa o espaço vertical que sobrar (flex:1) e mede a si
          mesma; a órbita (anéis+mascote+bolhas) encolhe junto, mantendo as
          proporções, até caber sem precisar rolar a página. */}
      <div ref={orbitAreaRef} style={{flex:'1 1 0',minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',width:'100%'}}>
      <div className="fsu2" style={{position:'relative',width:1180*orbitScale,height:720*orbitScale,flex:'0 0 auto'}}>
        <svg viewBox="0 0 1180 720" style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'}}>
          <ellipse cx="590" cy="360" rx="519" ry="252" fill="none" stroke={T.goldLine||T.gold} strokeWidth="1" opacity=".22"/>
          <ellipse cx="590" cy="360" rx="440" ry="211" fill="none" stroke={T.goldLine||T.gold} strokeWidth="1" opacity=".15"/>
          <ellipse cx="590" cy="360" rx="360" ry="170" fill="none" stroke={T.goldLine||T.gold} strokeWidth="1" opacity=".1"/>
          {orbitMods.map((_,i)=>{ const p = orbitMidPt(i); return (
            <circle key={i} cx={p.left/100*1180} cy={p.top/100*720} r="4" fill={T.goldLine||T.gold} opacity=".55"/>
          );})}
          {/* estrelinhas/planetinhas viajando pelos anéis — quanto mais interno o
              anel, mais rápido (como órbitas de verdade: raio menor gira mais rápido) */}
          {[
            { rx:519, ry:252, dur:'26s', r:3.5, fill:'#ffffff' },
            { rx:440, ry:211, dur:'19s', r:3,   fill:T.goldL||T.gold },
            { rx:360, ry:170, dur:'13s', r:2.6, fill:'#ffffff' },
          ].map((o,oi)=>(
            <circle key={'orb'+oi} r={o.r} fill={o.fill} opacity=".95" style={{filter:`drop-shadow(0 0 3px ${T.goldL||T.gold})`}}>
              <animateMotion dur={o.dur} begin={`${-oi*4}s`} repeatCount="indefinite"
                path={`M ${590+o.rx},360 A ${o.rx},${o.ry} 0 1,1 ${590-o.rx},360 A ${o.rx},${o.ry} 0 1,1 ${590+o.rx},360`}/>
            </circle>
          ))}
        </svg>

        <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:2,pointerEvents:'none'}}>
          <UnikoMascot size={168*orbitScale}/>
        </div>

        {orbitMods.map((m,i)=>{
          const p = orbitPt(i);
          const bd = 178*orbitScale;
          return (
            <div key={m.id}
              draggable={reorderMode}
              onDragStart={reorderMode ? (e)=>{ setDragModId(m.id); e.dataTransfer.effectAllowed='move'; } : undefined}
              onDragOver={reorderMode ? (e)=>e.preventDefault() : undefined}
              onDrop={reorderMode ? (e)=>{ e.preventDefault(); reorderCard(orbitMods, dragModId, m.id); setDragModId(null); } : undefined}
              onDragEnd={reorderMode ? ()=>setDragModId(null) : undefined}
              onClick={reorderMode ? undefined : ()=>onSelect(m.id)}
              onMouseEnter={()=>sh(m.id)} onMouseLeave={()=>sh(null)}
              style={{position:'absolute',left:`${p.left}%`,top:`${p.top}%`,transform:'translate(-50%,-50%)',
                width:bd,height:bd,borderRadius:'50%',zIndex:3,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4*orbitScale,
                textAlign:'center',padding:`0 ${16*orbitScale}px`,boxSizing:'border-box',
                background:T.surface,
                border:reorderMode ? `2px dashed ${dragModId===m.id?T.gold:T.goldLine+'88'}` : `1.5px solid ${hov===m.id?m.color+'77':T.border}`,
                // 3 camadas de aura ao redor da bolha (mesma ideia da foto de perfil
                // no Portal do Colaborador), na cor do próprio módulo — a maioria já
                // usa o dourado do tema, então a aura acompanha o tema automaticamente.
                boxShadow:`0 0 0 ${6*orbitScale}px ${m.color}26, 0 0 0 ${13*orbitScale}px ${m.color}12, 0 0 0 ${21*orbitScale}px ${m.color}07, ${hov===m.id?T.shL:T.sh}`,
                cursor:reorderMode?'grab':'pointer',
                opacity:dragModId===m.id?0.4:1,
                transition:'transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s, border-color .18s',
                ...(!reorderMode && hov===m.id ? {transform:'translate(-50%,-50%) scale(1.06)'} : null)}}>
              <div style={{width:46*orbitScale,height:46*orbitScale,borderRadius:13*orbitScale,background:m.bg,border:`1px solid ${m.color}22`,
                display:'flex',alignItems:'center',justifyContent:'center',color:m.color,marginBottom:2}}>
                {React.cloneElement(m.icon, {width:23*orbitScale,height:23*orbitScale})}
              </div>
              <div style={{fontSize:16*orbitScale,fontWeight:700,color:T.text,lineHeight:1.2}}>{m.label}</div>
              <div style={{fontSize:11*orbitScale,color:T.textT,lineHeight:1.35,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{m.sub}</div>
            </div>
          );
        })}
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
