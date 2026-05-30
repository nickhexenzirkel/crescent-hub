import React, { useState } from 'react';
import { T } from '../contexts/theme';
import { BrandLogo, StarDivider, Logo, Tag } from './components';

const ModuleSelector = ({onSelect, authUser, onLogout}) => {
  const [hov,sh]=useState(null);
  const isAdmin = authUser?.role === 'admin';

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
  const IcoLembretes = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );

  const allMods=[
    {id:'colaborador', label:'Central do Colaborador', sub:'Portal RH completo',              icon:IcoColab,     color:T.gold, bg:T.goldGl, tag:'Principal', adminOnly:false},
    {id:'alexa',       label:'Central Alexa',          sub:'Festival · Música · Biblioteca',  icon:IcoAlexa,     color:T.gold, bg:T.goldGl, tag:'Música',    adminOnly:false},
    {id:'lembretes',   label:'Central Lembretes',      sub:'Seus lembretes pessoais',         icon:IcoLembretes, color:T.gold, bg:T.goldGl, tag:'Pessoal',   adminOnly:false},
    {id:'dashboard',   label:'Dashboard RH',           sub:'Gestão · Funcionários',           icon:IcoDash,      color:T.gold, bg:T.goldGl, tag:'Admin',     adminOnly:true},
    {id:'ponto',       label:'Ponto Eletrônico',       sub:'Leitor de arquivo AFD',           icon:IcoPonto,     color:T.gold, bg:T.goldGl, tag:'Admin',     adminOnly:true},
  ];
  const mods = allMods.filter(m => !m.adminOnly || isAdmin);
  const cols  = mods.length <= 3 ? 3 : 3;

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,padding:'40px 32px'}}>

      {/* ── Perfil — canto superior direito ── */}
      {authUser&&(
        <div style={{position:'fixed',top:16,right:20,display:'flex',alignItems:'center',gap:8,zIndex:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
            <div style={{width:24,height:24,borderRadius:7,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white'}}>
              {authUser.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
            </div>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>{authUser.name}</span>
            {isAdmin&&<span style={{fontSize:10,color:T.gold,fontWeight:700,padding:'1px 6px',borderRadius:4,background:`${T.gold}18`}}>Admin</span>}
          </div>
          <button onClick={onLogout}
            style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textD,fontFamily:'var(--font-body)',outline:'none'}}>
            Sair
          </button>
        </div>
      )}

      <div className="fsu" style={{textAlign:'center',marginBottom:44}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
          <BrandLogo size={165}/>
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:28,fontWeight:700,
          color:T.text,letterSpacing:'.07em',lineHeight:1}}>UNIKO</div>
        <div style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textT,
          letterSpacing:'.10em',textTransform:'uppercase',marginTop:5,marginBottom:14}}>
          Sistema Corporativo
        </div>
        <div style={{width:'380px',margin:'0 auto 14px'}}><StarDivider/></div>
        <div style={{fontFamily:'var(--font-body)',fontSize:16,color:T.textS}}>
          Selecione um módulo para continuar
        </div>
      </div>

      <div className="fsu2" style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,
        gap:18,width:'100%',maxWidth: mods.length<=3 ? 900 : 1050}}>
        {mods.map(m=>(
          <div key={m.id} onClick={()=>onSelect(m.id)}
            onMouseEnter={()=>sh(m.id)} onMouseLeave={()=>sh(null)}
            style={{background:T.surface,
              border:`1px solid ${hov===m.id?m.color+'55':T.border}`,
              borderRadius:18,boxShadow:hov===m.id?T.shL:T.sh,padding:'36px 30px',
              cursor:'pointer',transform:hov===m.id?'translateY(-6px)':'none',
              transition:'all .25s cubic-bezier(.16,1,.3,1)',
              position:'relative',overflow:'hidden',fontFamily:'var(--font-body)'}}>
            <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:2,
              background:`linear-gradient(90deg,transparent,${T.goldV},transparent)`,
              borderRadius:999}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div style={{width:54,height:54,borderRadius:14,background:m.bg,
                border:`1px solid ${m.color}22`,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:23,color:m.color}}>{m.icon}</div>
              <Tag color={m.color} style={{marginTop:4}}>{m.tag}</Tag>
            </div>
            <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:7}}>{m.label}</div>
            <div style={{fontSize:14,color:T.textS,marginBottom:22,lineHeight:1.65}}>{m.sub}</div>
            <div style={{marginBottom:18}}></div>
            <div style={{display:'flex',alignItems:'center',gap:8,color:m.color,fontSize:13,fontWeight:500}}>
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
          </div>
        ))}
      </div>

      <div className="fsu3" style={{marginTop:44,display:'flex',alignItems:'center',gap:10,opacity:.35}}>
        <Logo size={22}/>
        <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT,whiteSpace:'nowrap'}}>
          Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
        </span>
      </div>
    </div>
  );
};

export { ModuleSelector };
