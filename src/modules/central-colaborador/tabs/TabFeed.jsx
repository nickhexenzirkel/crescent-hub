import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { Card, StarDivider, SHead } from '../../../shared/components';

const NEXUS_URL = 'https://dodoconexus.vercel.app/login';

const TabFeed = () => {
  const [full,setFull]=useState(false);
  return(
    <div style={{fontFamily:'var(--font-body)',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:600,color:T.text}}>Feed Nexus</div>
          <div style={{fontSize:14,color:T.textT,marginTop:2}}>Conecte-se com seus colegas</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href={NEXUS_URL} target="_blank" rel="noopener noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,
              padding:'7px 14px',borderRadius:9,
              background:T.surfaceSub||'rgba(0,0,0,0.04)',
              border:`1px solid ${T.border}`,color:T.textS,
              fontFamily:'var(--font-body)',fontSize:13,textDecoration:'none',transition:'all .15s'}}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8"/>
              <path d="M8 1h3v3M11 1L5.5 6.5"/>
            </svg>
            Acessar direto
          </a>
          <button onClick={()=>setFull(f=>!f)}
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',
              borderRadius:9,background:full?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.04)'),
              border:`1px solid ${full?T.goldLine+'55':T.border}`,
              color:full?T.gold:T.textS,fontFamily:'var(--font-body)',fontSize:13,
              cursor:'pointer',outline:'none',transition:'all .15s'}}>
            {full
              ?<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4.5 1v4H.5M8.5 1v4h4M4.5 12v-4H.5M8.5 12v-4h4"/></svg>
              :<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M.5 4.5V.5h4M8.5.5h4v4M12.5 8.5v4h-4M4.5 12.5H.5v-4"/></svg>}
            Tela Cheia
          </button>
        </div>
      </div>
      <div style={{
        position:full?'fixed':'relative',inset:full?0:'auto',zIndex:full?999:'auto',
        height:full?'100vh':'calc(100vh - 160px)',minHeight:500,
        borderRadius:full?0:16,overflow:'hidden',
        boxShadow:full?'none':T.shL,border:full?'none':`1px solid ${T.border}`,
      }}>
        <iframe src={NEXUS_URL} title="Nexus Feed"
          style={{width:'100%',height:'100%',border:'none',display:'block'}}
          allow="fullscreen; camera; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"/>
        {full&&(<button onClick={()=>setFull(false)}
          style={{position:'fixed',top:14,right:14,zIndex:1000,width:36,height:36,
            borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.55)',
            backdropFilter:'blur(8px)',color:'#fff',fontSize:17,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',outline:'none'}}>✕</button>)}
      </div>
    </div>
  );
};


export { TabFeed };
