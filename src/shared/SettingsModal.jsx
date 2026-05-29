import React, { useState } from 'react';
import { T, THEMES } from '../contexts/theme';

const SettingsModal = ({activeTheme,onTheme,onClose}) => {
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1000,
      background:'rgba(10,20,40,0.35)',backdropFilter:'blur(14px)',
      WebkitBackdropFilter:'blur(14px)',
      display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'rgba(255,255,255,0.96)',backdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.85)',borderRadius:22,
        padding:'28px',width:660,maxWidth:'90vw',
        boxShadow:'0 24px 64px rgba(0,0,0,0.20)',position:'relative'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:'#0D1B2E'}}>Configurações</div>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,color:'#7A92A8',marginTop:2}}>Personalize o visual do sistema</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(0,0,0,0.06)',border:'none',
            borderRadius:'50%',width:32,height:32,cursor:'pointer',fontSize:16,
            color:'#3A5068',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',gap:'0 18px'}}>
          {/* Modo Claro */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
                letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>MODO CLARO</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {['blue','purple','pink','green','orange'].map(key=>{
                const th=THEMES[key]; const isActive=activeTheme===key;
                return(<div key={key} onClick={()=>onTheme(key)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                    borderRadius:11,cursor:'pointer',
                    background:isActive?`${th.goldGl}`:'rgba(0,0,0,0.03)',
                    border:`1.5px solid ${isActive?th.goldLine+'66':'rgba(0,0,0,0.06)'}`,
                    transition:'all .18s'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                    background:`linear-gradient(135deg,${th.goldV},${th.goldL},${th.gold})`,
                    boxShadow:isActive?`0 0 0 2px white,0 0 0 3.5px ${th.goldL}`:
                      `0 2px 6px ${th.gold}44`}}/>
                  <div style={{flex:1,fontFamily:'var(--font-body)',fontSize:13,
                    fontWeight:isActive?500:400,color:isActive?th.gold:'#0D1B2E'}}>{th.name}</div>
                  {isActive&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8L7 11L12 5.5" stroke={th.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>);
              })}
            </div>
          </div>
          {/* Divider */}
          <div style={{background:'rgba(0,0,0,0.08)',borderRadius:1}}/>
          {/* Modo Escuro */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.7" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
              <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
                letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>MODO ESCURO</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {['blueDark','purpleDark','pinkDark','greenDark','orangeDark'].map(key=>{
                const th=THEMES[key]; const isActive=activeTheme===key;
                if(!th)return null;
                return(<div key={key} onClick={()=>onTheme(key)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                    borderRadius:11,cursor:'pointer',
                    background:isActive?`${th.goldGl}`:'rgba(0,0,0,0.03)',
                    border:`1.5px solid ${isActive?th.goldLine+'66':'rgba(0,0,0,0.06)'}`,
                    transition:'all .18s'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                    background:`linear-gradient(135deg,${th.page},${th.gold}88,${th.goldL})`,
                    boxShadow:isActive?`0 0 0 2px white,0 0 0 3.5px ${th.goldL}`:
                      `0 2px 6px ${th.gold}55`,
                    border:`1px solid ${th.goldLine}44`}}/>
                  <div style={{flex:1,fontFamily:'var(--font-body)',fontSize:13,
                    fontWeight:isActive?500:400,color:isActive?th.gold:'#0D1B2E'}}>{th.name}</div>
                  {isActive&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8L7 11L12 5.5" stroke={th.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
                </div>);
              })}
            </div>
          </div>
        </div>
        <div style={{marginTop:18,fontFamily:'var(--font-body)',fontSize:11,
          color:'#9AA8B8',textAlign:'center'}}>Clique fora para fechar</div>
      </div>
    </div>
  );
};



export { SettingsModal };
