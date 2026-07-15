import React, { useState, useEffect } from 'react';
import { T, THEMES } from '../../contexts/theme';
import { USER, supabase as _supabase, getAuthUser } from '../../contexts/user';
import { StarDivider, UnikoIcon, Logo, AvatarCircle } from '../../shared/components';
import { useIsMobile } from '../../hooks/useIsMobile';

const READ_KEY = 'uniko_notif_read';
const getReadIds = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY)) || []); } catch { return new Set(); } };
const saveReadId = (id) => { try { const s = getReadIds(); s.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...s])); } catch {} };
const markAllRead = (ids) => { try { localStorage.setItem(READ_KEY, JSON.stringify(ids)); } catch {} };
const comumToNotif = (c) => ({
  id:   c.id,
  icon: c.urgent ? '🚨' : c.cat === 'Evento' ? '📅' : '📋',
  msg:  c.title || c.body || 'Novo comunicado',
  time: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '',
  read: getReadIds().has(c.id),
});

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
  {id:'ponto',      label:'Ponto Eletrônico', icon:<I><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3V2h6v1"/><circle cx="12" cy="13" r="3.2"/><path d="M12 11.6V13l1 .8"/></I>},
  {id:'lembretes',  label:'Meus Lembretes', icon:<I><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></I>},
  /* Grupo 2 — Corporativo (divider antes) */
  {id:'comunicados',label:'Comunicados',    icon:<I><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></I>},
  {id:'eventos',    label:'Eventos',        icon:<I><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></I>},
  {id:'colegas',    label:'Colegas',        icon:<I><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></I>},
  {id:'feedback',   label:'Feedback',       icon:<I><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></I>},
  /* Grupo 3 — Entretenimento (divider antes) */
  {id:'uniko',      label:'Coleção',        icon:<I><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></I>},
  {id:'games',      label:'Games',          icon:<I><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m-1-1v2M14 12h2"/></I>},
  {id:'unikowave',  label:'Uniko Wave',     icon:<I><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></I>},
  {id:'unikopaint', label:'Uniko Paint',    icon:<I><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z"/></I>},
];

/* Esconde os itens marcados adminOnly de quem não é admin. Hoje nenhum item usa
   (o Uniko Paint foi liberado pra todo mundo), mas o filtro fica pronto pra
   próxima feature que nascer restrita — basta pôr `adminOnly:true` no item. */
const NAV_FOR = (isAdmin) => NAV.filter(n => !n.adminOnly || isAdmin);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{flexShrink:0}}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const Sidebar = ({tab,setTab,onBack,activeTheme,onTheme,onOpenSettings,userPhoto,profileComplete,collapsed}) => {
  const isMobile = useIsMobile();
  const [hov,sh]=useState(null);
  const nav = NAV_FOR(getAuthUser()?.role === 'admin');
  if (isMobile) return null;
  return(
    <div style={{width:collapsed?76:252,minHeight:'100vh',
      background:T.sidebarBg,
      borderRight:`1px solid ${T.border}`,
      display:'flex',flexDirection:'column',
      position:'fixed',top:0,left:0,bottom:0,zIndex:200,
      transition:'width .22s ease',overflowX:'hidden',
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
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:13,marginBottom:12,
          justifyContent:collapsed?'center':'flex-start'}}>
          {/* Logo com blob #1F6FA9 atrás */}
          <div style={{position:'relative',flexShrink:0,width:collapsed?42:58,height:collapsed?42:58}}>
            <div style={{position:'absolute',inset:'-8px',borderRadius:'50%',
              background:`radial-gradient(circle,${T.lb} 0%,${T.lb2} 55%,transparent 80%)`,
              filter:'blur(10px)',animation:'brandBlob1 12s ease-in-out infinite',
              zIndex:0,pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,zIndex:1,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <UnikoIcon size={collapsed?36:52} rounded={true}/>
            </div>
          </div>
          {!collapsed && (
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:15.5,fontWeight:700,
              color:T.text,letterSpacing:'.05em'}}>UNIKO</div>
            <div style={{fontSize:12,color:T.textT,letterSpacing:'.06em',
              textTransform:'uppercase',marginTop:3}}>Portal do Colaborador</div>
          </div>
          )}
        </div>
        {/* star divider under brand */}
        <StarDivider my={0}/>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:'6px 12px',display:'flex',flexDirection:'column',
        gap:1,overflowY:'auto'}}>
        {!collapsed && <div style={{fontSize:11.5,color:T.textD,letterSpacing:'.09em',
          textTransform:'uppercase',padding:'2px 8px 6px',fontWeight:600}}>NAVEGAÇÃO</div>}

        {nav.map((n,idx)=>{
          const a=tab===n.id;
          const locked = n.id==='uniko' && !profileComplete;
          const showDivider = idx===6 || idx===10; /* dividers between logical groups */
          return(
            <div key={n.id}>
              {showDivider && <StarDivider my={3} dim/>}
              <div
                onClick={()=> locked ? setTab('dados') : setTab(n.id)}
                onMouseEnter={()=>sh(n.id)} onMouseLeave={()=>sh(null)}
                title={collapsed ? n.label : (locked ? 'Preencha seus dados (email, endereço, etc.) para liberar esta função' : undefined)}
                style={{display:'flex',alignItems:'center',gap:11,padding:collapsed?'8px 0':'8px 13px',
                  justifyContent:collapsed?'center':'flex-start',
                  borderRadius:10,cursor:'pointer',
                  background:a?T.goldGl:hov===n.id?(T.surfaceSub||'rgba(0,0,0,0.03)'):'transparent',
                  border:a?`1px solid rgba(212,168,75,0.22)`:'1px solid transparent',
                  color:a?T.gold:hov===n.id?T.text:T.textS,
                  opacity:locked?0.45:1,
                  transition:'all .14s'}}>
                <span style={{color:a?T.gold:hov===n.id?T.textS:T.textT,fontSize:18,
                  minWidth:22,textAlign:'center'}}>{n.icon}</span>
                {!collapsed && <span style={{fontSize:15,fontWeight:a?600:400}}>{n.label}</span>}
                {locked && !collapsed && <span style={{marginLeft:'auto',color:T.textD}}><LockIcon/></span>}
                {a&&!locked&&!collapsed&&<span style={{marginLeft:'auto',flexShrink:0}}>
                </span>}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{padding:'10px 12px 18px'}}>
        <StarDivider my={0}/>
        <div onClick={profileComplete ? onOpenSettings : () => setTab('dados')}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          title={collapsed ? 'Configurações' : (!profileComplete ? 'Preencha seus dados (email, endereço, etc.) para liberar esta função' : undefined)}
          style={{display:'flex',alignItems:'center',gap:9,padding:'9px 11px',
            justifyContent:collapsed?'center':'flex-start',
            borderRadius:9,cursor:'pointer',marginBottom:6,transition:'background .14s',
            opacity:profileComplete?1:0.45}}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none"
            stroke={T.textS} strokeWidth="1.6" strokeLinecap="round">
            <circle cx="10" cy="10" r="3"/>
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/>
          </svg>
          {!collapsed && <span style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textS}}>Configurações</span>}
          {!collapsed && (profileComplete
            ? <span style={{marginLeft:'auto',fontFamily:'var(--font-body)',fontSize:10,
                fontWeight:500,
                color:THEMES[activeTheme]?.dark ? '#fff' : T.gold,
                background:THEMES[activeTheme]?.dark ? T.gold+'CC' : T.goldGl,
                border:`1px solid ${T.gold}44`,
                padding:'2px 8px',borderRadius:6}}>
                {THEMES[activeTheme]?.name?.split(' ')[0]||'Azul'}
              </span>
            : <span style={{marginLeft:'auto',color:T.textD}}><LockIcon/></span>)
          }
        </div>
        <div style={{marginTop:4,display:'flex',alignItems:'center',gap:11,padding:collapsed?'8px':'12px 13px',
          background:T.goldGl,borderRadius:12,justifyContent:collapsed?'center':'flex-start',
          border:`1px solid rgba(212,168,75,0.15)`,marginBottom:7}}>
          <AvatarCircle name={USER.name} photo={userPhoto} size={collapsed?34:38} fontSize={13}/>
          {!collapsed && <div style={{overflow:'hidden',flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{USER.name}</div>
            <div style={{fontSize:12,color:T.textT,marginTop:1}}>Colaborador</div>
          </div>}
        </div>
        <div onClick={onBack}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(192,64,80,0.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          title={collapsed?'Sair':undefined}
          style={{display:'flex',alignItems:'center',gap:8,padding:'9px 13px',
            justifyContent:collapsed?'center':'flex-start',
            borderRadius:9,cursor:'pointer',color:T.danger,fontSize:14,fontWeight:500,
            transition:'background .14s'}}>
          {collapsed ? '←' : '← Sair'}
        </div>
      </div>
    </div>
  );
};

/* ── TOP BAR ── */
const TopBar = ({tab,onBack}) => {
  const isMobile = useIsMobile();
  const nm={inicio:'Início',financeiro:'Financeiro',dados:'Seus Dados',horas:'Banco de Horas',
    ponto:'Ponto Eletrônico',
    lembretes:'Meus Lembretes',feedback:'Feedback',eventos:'Eventos',games:'Games',
    conquistas:'Conquistas',comunicados:'Comunicados',simulador:'Simulação',
    uniko:'Coleção de Unikos',colegas:'Colegas',unikowave:'Uniko Wave',unikopaint:'Uniko Paint'};
  const [notifOpen,setNO]=useState(false);
  const [notifs,setNotifs]=useState([]);
  const unread=notifs.filter(n=>!n.read).length;

  useEffect(()=>{
    _supabase.from('comunicados').select('*').eq('active',true)
      .order('created_at',{ascending:false}).limit(15)
      .then(({data})=>setNotifs((data||[]).map(comumToNotif)));

    const sub = _supabase.channel('topbar_comuns_rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'comunicados'},({new:c})=>{
        if(!c?.active) return;
        setNotifs(p=>[comumToNotif(c), ...p]);
      })
      .subscribe();
    return ()=>_supabase.removeChannel(sub);
  },[]);

  if(tab==='inicio')return null;
  return(
    <div style={{height:52,display:'flex',alignItems:'center',gap:isMobile?8:12,padding:isMobile?'0 14px':'0 30px',
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
            {unread>0&&<button onClick={()=>{ const ids=notifs.map(n=>n.id); markAllRead(ids); setNotifs(n=>n.map(x=>({...x,read:true}))); }}
              style={{background:'none',border:'none',cursor:'pointer',
                color:T.gold,fontSize:12,fontFamily:'var(--font-body)'}}>Marcar lidas</button>}
          </div>
          <div style={{maxHeight:300,overflowY:'auto'}}>
            {notifs.map(n=>(
              <div key={n.id}
                onClick={()=>{ saveReadId(n.id); setNotifs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x)); }}
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

export { I, NAV, NAV_FOR, Sidebar, TopBar };
