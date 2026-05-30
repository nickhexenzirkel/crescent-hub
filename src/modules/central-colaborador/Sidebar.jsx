import React, { useState } from 'react';
import { T, THEMES } from '../../contexts/theme';
import { USER, NOTIFS_DATA } from '../../contexts/user';
import { StarDivider, UnikoIcon, Logo, AvatarCircle } from '../../shared/components';

const I = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);
const NAV=[
  /* Grupo 1 — Pessoal */
  {id:'inicio',     label:'Início',         icon:<I><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-5H9v5H4a1 1 0 01-1-1z"/></I>},
  {id:'dados',      label:'Seus Dados',     icon:<I><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></I>},
  {id:'financeiro', label:'Financeiro',     icon:<I><circle cx="12" cy="12" r="9"/><path d="M12 7v1.5M12 15.5V17M9.5 10.5c0-1.1.9-2 2.5-2s2.5.9 2.5 2-2.5 2-2.5 2-2.5.9-2.5 2 .9 2 2.5 2 2.5-.9 2.5-2"/></I>},
  {id:'horas',      label:'Banco de Horas', icon:<I><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></I>},
  {id:'lembretes',  label:'Meus Lembretes', icon:<I><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></I>},
  /* Grupo 2 — Corporativo (divider antes) */
  {id:'comunicados',label:'Comunicados',    icon:<I><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></I>},
  {id:'eventos',    label:'Eventos',        icon:<I><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></I>},
  {id:'feedback',   label:'Feedback',       icon:<I><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></I>},
  {id:'conquistas', label:'Conquistas',     icon:<I><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></I>},
  /* Grupo 3 — Entretenimento (divider antes) */
  {id:'feed',       label:'Feed',           icon:<I><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="11" y2="18"/></I>},
  {id:'uniko',      label:'My Uniko',       icon:<I><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></I>},
  {id:'games',      label:'Games',          icon:<I><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m-1-1v2M14 12h2"/></I>},
];

const Sidebar = ({tab,setTab,onBack,activeTheme,onTheme,onOpenSettings,userPhoto}) => {
  const [hov,sh]=useState(null);
  return(
    <div style={{width:252,minHeight:'100vh',
      background:T.sidebarBg,
      borderRight:`1px solid ${T.border}`,
      display:'flex',flexDirection:'column',
      position:'fixed',top:0,left:0,bottom:0,zIndex:200,
      fontFamily:'var(--font-body)'}}>

      {/* Brand — mini lava lamp azul animado */}
      <div style={{padding:'18px 16px 12px',position:'relative',overflow:'hidden',
        borderBottom:`1px solid rgba(42,130,210,0.10)`}}>
        {/* blobs animados de fundo */}
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',width:110,height:110,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb1} 0%,transparent 70%)`,
            top:'-30px',left:'-20px',filter:'blur(22px)',
            animation:'brandBlob1 6s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:95,height:95,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb2} 0%,transparent 70%)`,
            top:'-10px',right:'-10px',filter:'blur(18px)',
            animation:'brandBlob2 8s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb3} 0%,transparent 70%)`,
            bottom:'-20px',left:'30%',filter:'blur(16px)',
            animation:'brandBlob3 7s ease-in-out infinite'}}/>
        </div>
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:13,marginBottom:12}}>
          {/* Logo com blob #1F6FA9 atrás */}
          <div style={{position:'relative',flexShrink:0,width:58,height:58}}>
            <div style={{position:'absolute',inset:'-8px',borderRadius:'50%',
              background:`radial-gradient(circle,${T.lb} 0%,${T.lb2} 55%,transparent 80%)`,
              filter:'blur(10px)',animation:'brandBlob1 12s ease-in-out infinite',
              zIndex:0,pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,zIndex:1,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <UnikoIcon size={52} rounded={true}/>
            </div>
          </div>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:15.5,fontWeight:700,
              color:T.text,letterSpacing:'.05em'}}>UNIKO</div>
            <div style={{fontSize:12,color:T.textT,letterSpacing:'.06em',
              textTransform:'uppercase',marginTop:3}}>Portal do Colaborador</div>
          </div>
        </div>
        {/* star divider under brand */}
        <StarDivider my={0}/>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:'8px 12px',display:'flex',flexDirection:'column',
        gap:2,overflowY:'auto'}}>
        <div style={{fontSize:11.5,color:T.textD,letterSpacing:'.09em',
          textTransform:'uppercase',padding:'2px 8px 10px',fontWeight:600}}>NAVEGAÇÃO</div>

        {NAV.map((n,idx)=>{
          const a=tab===n.id;
          const showDivider = idx===5 || idx===9; /* dividers between logical groups */
          return(
            <div key={n.id}>
              {showDivider && <StarDivider my={5} dim/>}
              <div onClick={()=>setTab(n.id)}
                onMouseEnter={()=>sh(n.id)} onMouseLeave={()=>sh(null)}
                style={{display:'flex',alignItems:'center',gap:11,padding:'11px 13px',
                  borderRadius:10,cursor:'pointer',
                  background:a?T.goldGl:hov===n.id?(T.surfaceSub||'rgba(0,0,0,0.03)'):'transparent',
                  border:a?`1px solid rgba(212,168,75,0.22)`:'1px solid transparent',
                  color:a?T.gold:hov===n.id?T.text:T.textS,
                  transition:'all .14s'}}>
                <span style={{color:a?T.gold:hov===n.id?T.textS:T.textT,fontSize:18,
                  minWidth:22,textAlign:'center'}}>{n.icon}</span>
                <span style={{fontSize:15,fontWeight:a?600:400}}>{n.label}</span>
                {a&&<span style={{marginLeft:'auto',flexShrink:0}}>
                </span>}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{padding:'10px 12px 18px'}}>
        <StarDivider my={0}/>
        <div onClick={onOpenSettings}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          style={{display:'flex',alignItems:'center',gap:9,padding:'9px 11px',
            borderRadius:9,cursor:'pointer',marginBottom:6,transition:'background .14s'}}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none"
            stroke={T.textS} strokeWidth="1.6" strokeLinecap="round">
            <circle cx="10" cy="10" r="3"/>
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/>
          </svg>
          <span style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textS}}>Configurações</span>
          <span style={{marginLeft:'auto',fontFamily:'var(--font-body)',fontSize:10,
            fontWeight:500,
            color:THEMES[activeTheme]?.dark ? '#fff' : T.gold,
            background:THEMES[activeTheme]?.dark ? T.gold+'CC' : T.goldGl,
            border:`1px solid ${T.gold}44`,
            padding:'2px 8px',borderRadius:6}}>
            {THEMES[activeTheme]?.name?.split(' ')[0]||'Azul'}
          </span>
        </div>
        <div style={{marginTop:4,display:'flex',alignItems:'center',gap:11,padding:'12px 13px',
          background:T.goldGl,borderRadius:12,
          border:`1px solid rgba(212,168,75,0.15)`,marginBottom:7}}>
          <AvatarCircle name={USER.name} photo={userPhoto} size={38} fontSize={13}/>
          <div style={{overflow:'hidden',flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{USER.name}</div>
            <div style={{fontSize:12,color:T.textT,marginTop:1}}>Colaborador</div>
          </div>
        </div>
        <div onClick={onBack}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(192,64,80,0.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          style={{display:'flex',alignItems:'center',gap:8,padding:'9px 13px',
            borderRadius:9,cursor:'pointer',color:T.danger,fontSize:14,fontWeight:500,
            transition:'background .14s'}}>
          ← Sair
        </div>
      </div>
    </div>
  );
};

/* ── TOP BAR ── */
const TopBar = ({tab,onBack}) => {
  const nm={inicio:'Início',financeiro:'Financeiro',dados:'Seus Dados',horas:'Banco de Horas',
    lembretes:'Meus Lembretes',feedback:'Feedback',eventos:'Eventos',games:'Games',
    conquistas:'Conquistas',feed:'Feed',comunicados:'Comunicados',simulador:'Simulação',
    uniko:'My Uniko'};
  const [notifOpen,setNO]=useState(false);
  const [notifs,setNotifs]=useState(NOTIFS_DATA);
  const unread=notifs.filter(n=>!n.read).length;
  if(tab==='inicio')return null;
  return(
    <div style={{height:52,display:'flex',alignItems:'center',gap:12,padding:'0 30px',
      background:T.topbarBg,backdropFilter:'blur(12px)',
      borderBottom:`1px solid ${T.border}`,flexShrink:0,
      fontFamily:'var(--font-body)',position:'relative',zIndex:300}}>
      <button onClick={onBack}
        onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        style={{display:'flex',alignItems:'center',gap:7,background:'none',border:'none',
          cursor:'pointer',color:T.textS,fontFamily:'var(--font-body)',fontSize:14,
          padding:'4px 9px',borderRadius:7,transition:'background .14s'}}>← Voltar</button>
      <div style={{width:1,height:16,background:T.divider}}/>
      <div style={{fontSize:14,color:T.textT,flex:1}}>
        Portal do Colaborador<span style={{color:T.textD,margin:'0 5px'}}>›</span>
        <strong style={{color:T.text,fontWeight:500}}>{nm[tab]||tab}</strong>
      </div>
      <div style={{position:'relative'}}>
        <button onClick={()=>setNO(o=>!o)} style={{position:'relative',
          background:notifOpen?T.goldGl:'none',border:'none',cursor:'pointer',
          width:36,height:36,borderRadius:10,outline:'none',
          display:'flex',alignItems:'center',justifyContent:'center',
          color:T.textS,transition:'all .15s'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={unread>0?T.gold:'currentColor'} strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          {unread>0&&<div style={{position:'absolute',top:4,right:4,width:16,height:16,
            borderRadius:'50%',background:T.gold,color:'#fff',fontSize:9,fontWeight:700,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontFamily:'var(--font-body)',border:`2px solid ${T.topbarBg}`}}>{unread}</div>}
        </button>
        {notifOpen&&(<div style={{position:'absolute',top:44,right:0,width:340,
          background:T.surface,border:`1px solid ${T.border}`,
          borderRadius:14,boxShadow:T.shL,zIndex:400,overflow:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'14px 16px 10px',borderBottom:`1px solid ${T.divider}`}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Notificações
              {unread>0&&<span style={{marginLeft:8,background:T.goldGl,color:T.gold,
                borderRadius:999,padding:'1px 8px',fontSize:11,
                border:`1px solid ${T.goldLine}44`}}>{unread} novas</span>}
            </div>
            {unread>0&&<button onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))}
              style={{background:'none',border:'none',cursor:'pointer',
                color:T.gold,fontSize:12,fontFamily:'var(--font-body)'}}>Marcar lidas</button>}
          </div>
          <div style={{maxHeight:300,overflowY:'auto'}}>
            {notifs.map(n=>(
              <div key={n.id}
                onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))}
                style={{display:'flex',gap:12,padding:'12px 16px',cursor:'pointer',
                  background:n.read?'transparent':T.goldGl,
                  borderBottom:`1px solid ${T.divider}`,transition:'background .14s'}}>
                <div style={{width:34,height:34,borderRadius:9,background:T.goldGl,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:13,fontWeight:700,color:T.gold,flexShrink:0}}>{n.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.text,fontWeight:n.read?400:500,lineHeight:1.5}}>{n.msg}</div>
                  <div style={{fontSize:11,color:T.textT,marginTop:2}}>{n.time}</div>
                </div>
                {!n.read&&<div style={{width:6,height:6,borderRadius:'50%',
                  background:T.gold,flexShrink:0,marginTop:6}}/>}
              </div>
            ))}
          </div>
          <div style={{padding:'10px',borderTop:`1px solid ${T.divider}`,
            textAlign:'center',fontSize:12,color:T.textT}}>Últimas notificações</div>
        </div>)}
      </div>
    </div>
  );
};

export { I, NAV, Sidebar, TopBar };
