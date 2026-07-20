import React, { useState } from 'react';
import { T } from '../contexts/theme';
import { BrandLogo, StarDivider, Logo, Tag, AvatarCircle } from './components';
import { WhatsNew } from './WhatsNew';
import { UnikoOrigin } from './UnikoOrigin';
import { useIsMobile } from '../hooks/useIsMobile';

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
  const isMobile = useIsMobile();
  const isAdmin  = authUser?.role === 'admin';

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
  const IcoLobby = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="2.6"/>
      <path d="M4 20c0-3 2.2-5 5-5s5 2 5 5"/>
      <circle cx="18" cy="9" r="2"/>
      <path d="M14.5 20c.2-2.4 1.7-4 3.5-4s3.3 1.6 3.5 4"/>
    </svg>
  );

  const allMods = [
    {id:'colaborador',      label:'Portal do Colaborador', sub:'Portal RH completo',               icon:IcoColab,       color:T.gold, bg:T.goldGl, tag:'Principal',  adminOnly:false},
    {id:'alexa',            label:'Central Alexa',         sub:'Festival · Música · Biblioteca',   icon:IcoAlexa,       color:T.gold, bg:T.goldGl, tag:'Música',     adminOnly:false},
    {id:'mercado-estelar',  label:'Prisma Store',          sub:'Loja de benefícios e recompensas', icon:IcoMercado,     color:T.gold, bg:T.goldGl, tag:'Recompensas', adminOnly:false},
    {id:'dashboard',        label:'Dashboard RH',          sub:'Gestão · Funcionários',            icon:IcoDash,        color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'ponto',            label:'Ponto Eletrônico',      sub:'Leitor de arquivo AFD',            icon:IcoPonto,       color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
    {id:'faturamento',      label:'Oficina Estelar',       sub:'Controle de Notas · Assinatura',   icon:IcoFaturamento, color:T.gold, bg:T.goldGl, tag:'Documentos', adminOnly:false},
    {id:'conexao-setorial', label:'Conexão Setorial',      sub:'Quadro Kanban · Salas por assunto',  icon:IcoChat,        color:T.gold, bg:T.goldGl, tag:'Equipe',     adminOnly:false},
    {id:'lobby-estelar',    label:'Lobby Estelar',         sub:'Espaço social · Andar e conversar', icon:IcoLobby,      color:T.gold, bg:T.goldGl, tag:'Admin',      adminOnly:true},
  ];
  const mods = allMods.filter(m => !m.adminOnly || isAdmin);

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

      <WhatsNew/>
      <UnikoOrigin/>

      {authUser&&(
        <div style={{position:'fixed',top:16,right:20,display:'flex',alignItems:'center',gap:8,zIndex:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
            <AvatarCircle name={authUser.name} photo={userPhoto} size={26} fontSize={9} rounded="7px"/>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>{authUser.name}</span>
            {isAdmin&&<span style={{fontSize:10,color:T.gold,fontWeight:700,padding:'1px 6px',borderRadius:4,background:`${T.gold}18`}}>Admin</span>}
          </div>
          <button onClick={onLogout}
            style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textD,fontFamily:'var(--font-body)',outline:'none'}}>
            Sair
          </button>
        </div>
      )}

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

      <div className="fsu2" style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,
        gap:14,width:'100%',maxWidth: mods.length<=3 ? 720 : 940}}>
        {mods.map(m=>(
          <div key={m.id}
            onClick={m.comingSoon ? undefined : ()=>onSelect(m.id)}
            onMouseEnter={()=>sh(m.id)} onMouseLeave={()=>sh(null)}
            style={{background:T.surface,
              border:`1px solid ${hov===m.id && !m.comingSoon ? m.color+'55' : m.comingSoon ? m.color+'33' : T.border}`,
              borderRadius:16,
              boxShadow: m.comingSoon ? T.sh : hov===m.id ? T.shL : T.sh,
              padding:'16px 18px',
              cursor: m.comingSoon ? 'default' : 'pointer',
              transform: m.comingSoon ? 'none' : hov===m.id ? 'translateY(-5px)' : 'none',
              opacity: m.comingSoon ? 0.82 : 1,
              transition:'all .25s cubic-bezier(.16,1,.3,1)',
              position:'relative',overflow:'hidden',fontFamily:'var(--font-body)'}}>
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
