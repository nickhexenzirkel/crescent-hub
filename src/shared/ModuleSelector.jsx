import React, { useState, useRef, useEffect } from 'react';
import { T, applyTheme } from '../contexts/theme';
import { BrandLogo, StarDivider, Logo, Tag, AvatarCircle } from './components';
import { SettingsModal } from './SettingsModal';
import { UnikoOrigin } from './UnikoOrigin';
import { InstalarAppGuide } from './InstalarAppGuide';
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
  // Card de perfil arrastável pra qualquer canto da tela (pega pela alcinha ⋮⋮ no topo).
  const [cardPos, setCardPos] = useState(() => loadCardPos());
  const cardPosRef = useRef(cardPos);
  const cardElRef  = useRef(null);
  const cardDragRef = useRef(null);
  const [draggingCard, setDraggingCard] = useState(false);
  useEffect(() => { cardPosRef.current = cardPos; }, [cardPos]);
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
      if (cardPosRef.current) saveCardPos(cardPosRef.current);
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
  // Uniko Fit é o ÚNICO módulo com cor FIXA (laranja), independente do tema — exceto
  // quando o tema ativo já É o laranja, aí ela vira azul (senão o card some no fundo
  // do próprio tema). `T.key` é o id do tema aplicado agora (contexts/theme.js).
  const isOrangeTheme = T.key === 'orange' || T.key === 'orangeDark';
  const fitColor = isOrangeTheme ? '#2A82D2' : '#FF6B35';
  const allMods = [
    {id:'colaborador',      label:'Portal do Colaborador', sub:'Portal RH completo',               icon:IcoColab,       color:T.gold, bg:T.goldGl, tag:'Principal',  adminOnly:false},
    {id:'alexa',            label:'Central Alexa',         sub:'Festival · Música · Biblioteca',   icon:IcoAlexa,       color:T.gold, bg:T.goldGl, tag:'Música',     adminOnly:false},
    {id:'mercado-estelar',  label:'Prisma Store',          sub:'Loja de benefícios e recompensas', icon:IcoMercado,     color:T.gold, bg:T.goldGl, tag:'Recompensas', adminOnly:false},
    {id:'uniko-fit',        label:'Uniko FIT',             sub:'Check-in de treino · Ranking',     icon:IcoFit,         color:fitColor, bg:fitColor+'18', tag:'Fitness',    adminOnly:false},
    {id:'dashboard',        label:'Dashboard RH',          sub:'Gestão · Funcionários',            icon:IcoDash,        color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'ponto',            label:'Ponto Eletrônico',      sub:'Leitor de arquivo AFD',            icon:IcoPonto,       color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'faturamento',      label:'Oficina Estelar',       sub:'Controle de Notas · Assinatura',   icon:IcoFaturamento, color:T.gold, bg:T.goldGl, tag:'Documentos', adminOnly:false},
    {id:'conexao-setorial', label:'Conexão Setorial',      sub:'Quadro Kanban · Salas por assunto',  icon:IcoChat,        color:T.gold, bg:T.goldGl, tag:'Equipe',     adminOnly:false},
  ];
  const mods = applyOrder(allMods.filter(m => !m.adminOnly || (m.strictAdmin ? isAdmin : podeAdminOnly)), order);
  const reorderCard = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const ids = mods.map(m => m.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setOrder(ids); saveModuleOrder(authUser, ids);
  };

  // ─── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{minHeight:'100vh', display:'flex', flexDirection:'column',
        background:T.page, fontFamily:'var(--font-body)'}}>

        <style>{`
          @keyframes starPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.18)}}
          .mob-card { -webkit-tap-highlight-color: transparent; }
        `}</style>

        <UnikoOrigin/>
        <InstalarAppGuide/>

        {/* Top bar */}
        <div style={{position:'sticky', top:0, zIndex:20, background:T.surface,
          borderBottom:`1px solid ${T.border}`,
          padding:'10px 16px', display:'flex', alignItems:'center', gap:10}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0}}>
            <BrandLogo size={32}/>
            <span style={{fontFamily:'var(--font-brand)', fontSize:16, fontWeight:700,
              color:T.text, letterSpacing:'.06em'}}><UnikoName/></span>
          </div>
          {authUser && (
            <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
              <AvatarCircle name={authUser.name} photo={userPhoto} size={28} fontSize={10} rounded="8px"/>
              <span style={{fontSize:12, fontWeight:600, color:T.text, maxWidth:90,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{authUser.name.split(' ')[0]}</span>
              <button onClick={onLogout}
                style={{padding:'5px 11px', borderRadius:16, border:`1px solid ${T.border}`,
                  background:'transparent', cursor:'pointer', fontSize:12, color:T.textS,
                  fontFamily:'var(--font-body)', WebkitTapHighlightColor:'transparent'}}>
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Logo + tagline */}
        <div style={{textAlign:'center', padding:'28px 20px 20px'}}>
          <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
            <UnikoMascot size={128}/>
          </div>
          <div style={{fontFamily:'var(--font-brand)', fontSize:32, fontWeight:700,
            color:T.text, letterSpacing:'.07em'}}><UnikoName/></div>
          <div style={{fontSize:11, color:T.textT, letterSpacing:'.10em',
            textTransform:'uppercase', marginTop:3, marginBottom:12}}>Sistema Corporativo</div>
          <div style={{maxWidth:240, margin:'0 auto'}}>
            <StarDivider/>
          </div>
          <div style={{fontSize:14, color:T.textS, marginTop:10}}>Selecione um módulo</div>
        </div>

        {/* Grid 2 colunas */}
        <div style={{padding:'4px 14px 32px', display:'grid',
          gridTemplateColumns:'1fr 1fr', gap:12}}>
          {mods.map(m => {
            const isPressed = pressed === m.id;
            return (
              <div key={m.id}
                className="mob-card"
                onClick={m.comingSoon ? undefined : () => onSelect(m.id)}
                onTouchStart={() => !m.comingSoon && setPressed(m.id)}
                onTouchEnd={() => setPressed(null)}
                onTouchCancel={() => setPressed(null)}
                style={{
                  background: isPressed ? T.page : T.surface,
                  border:`1px solid ${isPressed && !m.comingSoon ? m.color+'66' : m.comingSoon ? m.color+'33' : T.border}`,
                  borderRadius:14,
                  padding:'13px 12px 12px',
                  cursor: m.comingSoon ? 'default' : 'pointer',
                  opacity: m.comingSoon ? 0.78 : 1,
                  transform: isPressed ? 'scale(0.96)' : 'scale(1)',
                  transition:'transform .12s, background .12s, border-color .12s',
                  position:'relative', overflow:'hidden',
                  WebkitTapHighlightColor:'transparent',
                  userSelect:'none',
                }}>
                {/* Linha dourada topo */}
                <div style={{position:'absolute', top:0, left:'10%', right:'10%', height:2,
                  background:`linear-gradient(90deg,transparent,${m.comingSoon?m.color+'55':T.goldV},transparent)`,
                  borderRadius:999}}/>

                {/* Ícone + tag */}
                <div style={{display:'flex', justifyContent:'space-between',
                  alignItems:'flex-start', marginBottom:10}}>
                  <div style={{width:38, height:38, borderRadius:11, background:m.bg,
                    border:`1px solid ${m.color}22`, display:'flex', alignItems:'center',
                    justifyContent:'center', color:m.color}}>
                    {/* Ícones menores no mobile */}
                    {React.cloneElement(m.icon, {width:18, height:18})}
                  </div>
                  <Tag color={m.color} style={{fontSize:8, padding:'2px 5px'}}>{m.tag}</Tag>
                </div>

                {/* Textos */}
                <div style={{fontSize:13, fontWeight:700, color:T.text,
                  lineHeight:1.25, marginBottom:4}}>{m.label}</div>
                <div style={{fontSize:11, color:T.textS, lineHeight:1.45,
                  marginBottom:12, minHeight:32}}>{m.sub}</div>

                {/* Rodapé */}
                {m.comingSoon
                  ? <div style={{fontSize:11, fontWeight:600, color:m.color,
                      display:'flex', alignItems:'center', gap:5}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke={m.color} strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="12" cy="12" r="9"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Em breve
                    </div>
                  : <div style={{display:'flex', alignItems:'center', gap:5,
                      color:m.color, fontSize:12, fontWeight:600}}>
                      <svg width="10" height="10" viewBox="0 0 14 14"
                        style={{flexShrink:0, animation:'starPulse 2s ease-in-out infinite',
                          animationDelay:`${mods.indexOf(m)*0.3}s`}}>
                        <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z"
                          fill={m.color}/>
                      </svg>
                      Acessar
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{marginLeft:'auto'}}>
                        <path d="M2.5 7H11.5M11.5 7L8 3.5M11.5 7L8 10.5"
                          stroke={m.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                }
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div style={{marginTop:'auto', padding:'0 16px 24px',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:.3}}>
          <Logo size={18}/>
          <span style={{fontSize:11, color:T.textT}}>
            Criado por <span style={{fontFamily:'var(--font-brand)', fontWeight:600,
              color:T.gold}}>Nicolas Andrade</span>
          </span>
        </div>
      </div>
    );
  }

  // ─── DESKTOP ───────────────────────────────────────────────────────────────
  const cols = mods.length <= 3 ? 3 : 3;

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,padding:'20px 32px'}}>

      <UnikoOrigin/>
      <InstalarAppGuide/>

      {authUser&&(
        <div ref={cardElRef} style={{position:'fixed',
          ...(cardPos ? {left:cardPos.x, top:cardPos.y} : {top:16, right:20}),
          width:210,display:'flex',flexDirection:'column',
          gap:8,padding:'6px 12px 10px',borderRadius:20,zIndex:10,
          background:T.surface,border:`1px solid ${T.border}`,boxShadow:T.shL,
          transition:draggingCard?'none':'box-shadow .15s'}}>
          {/* Alça de arrastar — pega aqui pra mover o card pra qualquer canto da tela */}
          <div onPointerDown={startCardDrag} title="Arraste para mover"
            style={{display:'flex',justifyContent:'center',padding:'5px 0 1px',cursor:draggingCard?'grabbing':'grab',touchAction:'none'}}>
            <div style={{width:28,height:4,borderRadius:3,background:T.border}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <AvatarCircle name={authUser.name} photo={userPhoto} size={76} fontSize={26} rounded="18px"/>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:14.5,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {authUser.name.split(' ')[0]}
              </div>
              {isAdmin&&<span style={{display:'inline-block',marginTop:4,fontSize:9,color:T.gold,fontWeight:700,padding:'1px 5px',borderRadius:4,background:`${T.gold}18`}}>Admin</span>}
              {isModerador&&<span style={{display:'inline-block',marginTop:4,fontSize:9,color:'#4A78C4',fontWeight:700,padding:'1px 5px',borderRadius:4,background:'rgba(74,120,196,0.14)'}}>Moderador</span>}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,width:'100%'}}>
            <button onClick={()=>onSelect('colaborador','dados')} title="Editar perfil"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,height:28,borderRadius:9,fontSize:11.5,fontWeight:600,fontFamily:'var(--font-body)',
                border:`1px solid ${T.goldLine}44`,background:T.goldGl,color:T.gold,cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Perfil
            </button>
            <button onClick={()=>setReorderMode(r=>!r)} title="Organizar a ordem dos módulos"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,height:28,borderRadius:9,fontSize:11.5,fontWeight:600,fontFamily:'var(--font-body)',
                border:`1px solid ${reorderMode?T.goldLine+'44':T.border}`,background:reorderMode?T.goldGl:'transparent',color:reorderMode?T.gold:T.textS,cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
                <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
              </svg>
              Módulos
            </button>
            <button onClick={()=>setShowSettings(true)} title="Configurações"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,height:28,borderRadius:9,fontSize:11.5,fontWeight:600,fontFamily:'var(--font-body)',
                border:`1px solid ${T.border}`,background:'transparent',color:T.textS,cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              Ajustes
            </button>
            <button onClick={onLogout} title="Sair"
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,height:28,borderRadius:9,fontSize:11.5,fontWeight:600,fontFamily:'var(--font-body)',
                border:`1px solid ${T.dangerGl||T.border}`,background:'transparent',color:T.danger,cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sair
            </button>
          </div>
        </div>
      )}

      {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} onClose={()=>setShowSettings(false)}/>}

      <div className="fsu" style={{textAlign:'center',marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <UnikoMascot size={172}/>
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:42,fontWeight:700,
          color:T.text,letterSpacing:'.07em',lineHeight:1}}><UnikoName/></div>
        <div style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT,
          letterSpacing:'.10em',textTransform:'uppercase',marginTop:4,marginBottom:10}}>
          Sistema Corporativo
        </div>
        <div style={{width:'320px',margin:'0 auto 10px'}}><StarDivider/></div>
        <div style={{fontFamily:'var(--font-body)',fontSize:15,color:T.textS}}>
          Selecione um módulo para continuar
        </div>
      </div>

      {reorderMode && (
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,padding:'9px 16px',borderRadius:12,
          background:T.goldGl,border:`1px solid ${T.goldLine}44`,fontSize:13,color:T.text,fontFamily:'var(--font-body)'}}>
          <span>✛ Arraste os cards para reorganizar como eles aparecem na sua tela.</span>
          <button onClick={()=>setReorderMode(false)}
            style={{marginLeft:6,padding:'5px 14px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,
              color:'#fff',background:T.gold,fontFamily:'var(--font-body)'}}>Concluir</button>
        </div>
      )}

      <div className="fsu2" style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,
        gap:14,width:'100%',maxWidth: mods.length<=3 ? 720 : 940}}>
        {mods.map(m=>(
          <div key={m.id}
            draggable={reorderMode}
            onDragStart={reorderMode ? (e)=>{ setDragModId(m.id); e.dataTransfer.effectAllowed='move'; } : undefined}
            onDragOver={reorderMode ? (e)=>e.preventDefault() : undefined}
            onDrop={reorderMode ? (e)=>{ e.preventDefault(); reorderCard(dragModId, m.id); setDragModId(null); } : undefined}
            onDragEnd={reorderMode ? ()=>setDragModId(null) : undefined}
            onClick={reorderMode || m.comingSoon ? undefined : ()=>onSelect(m.id)}
            onMouseEnter={()=>sh(m.id)} onMouseLeave={()=>sh(null)}
            style={{background:T.surface,
              border:reorderMode ? `2px dashed ${dragModId===m.id?T.gold:T.goldLine+'88'}` : `1px solid ${hov===m.id && !m.comingSoon ? m.color+'55' : m.comingSoon ? m.color+'33' : T.border}`,
              borderRadius:16,
              boxShadow: m.comingSoon ? T.sh : hov===m.id ? T.shL : T.sh,
              padding:'16px 18px',
              cursor: reorderMode ? 'grab' : m.comingSoon ? 'default' : 'pointer',
              transform: m.comingSoon ? 'none' : (!reorderMode && hov===m.id) ? 'translateY(-5px)' : 'none',
              opacity: dragModId===m.id ? 0.5 : m.comingSoon ? 0.82 : 1,
              transition:'all .25s cubic-bezier(.16,1,.3,1)',
              position:'relative',overflow:'hidden',fontFamily:'var(--font-body)'}}>
            {reorderMode && (
              <div title="Arraste para mover" style={{position:'absolute',top:10,right:10,zIndex:2,color:T.textD,display:'flex',gap:2}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="5" r="1.6"/><circle cx="16" cy="5" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/></svg>
              </div>
            )}
            <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:2,
              background:`linear-gradient(90deg,transparent,${m.comingSoon?m.color+'66':T.goldV},transparent)`,
              borderRadius:999}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div style={{width:42,height:42,borderRadius:11,background:m.bg,
                border:`1px solid ${m.color}22`,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:19,color:m.color}}>
                {React.cloneElement(m.icon, {width:20, height:20})}
              </div>
              <Tag color={m.color} style={{marginTop:4}}>{m.tag}</Tag>
            </div>
            <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:5}}>{m.label}</div>
            <div style={{fontSize:12.5,color:T.textS,marginBottom:10,lineHeight:1.5}}>{m.sub}</div>
            <div style={{marginBottom:6}}></div>
            {m.comingSoon
              ? <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:600,color:m.color}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Em breve
                </div>
              : <div style={{display:'flex',alignItems:'center',gap:8,color:m.color,fontSize:13,fontWeight:500}}>
                  <svg width="11" height="11" viewBox="0 0 14 14"
                    style={{flexShrink:0,animation:'starPulse 2s ease-in-out infinite',animationDelay:`${mods.indexOf(m)*0.3}s`}}>
                    <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z" fill={m.color}/>
                  </svg>
                  Acessar
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                    style={{transition:'transform .18s',transform:hov===m.id?'translateX(4px)':'none'}}>
                    <path d="M2.5 7H11.5M11.5 7L8 3.5M11.5 7L8 10.5"
                      stroke={m.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
            }
          </div>
        ))}
      </div>

      <div className="fsu3" style={{marginTop:24,display:'flex',alignItems:'center',gap:10,opacity:.35}}>
        <Logo size={22}/>
        <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT,whiteSpace:'nowrap'}}>
          Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
        </span>
      </div>
    </div>
  );
};

export { ModuleSelector };
