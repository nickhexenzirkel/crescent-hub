import React, { useState } from 'react';
import { T } from '../contexts/theme';
import { StarDivider, BrandLogo, Logo } from './components';

const LandingPage = ({onStart}) => {
  const [hov,sh]=useState(false);
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',position:'relative',zIndex:1,overflow:'hidden'}}>
      {/* sem luas nos cantos e sem linhas absolutas */}

      <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center'}}>
        {/* Logo principal — Uniko */}
        <div className="fsu" style={{marginBottom:28,display:'flex',justifyContent:'center',alignItems:'center'}}>
          <BrandLogo size={168}/>
        </div>

        <div className="fsu2">
          <div style={{fontFamily:'var(--font-brand)',fontSize:54,fontWeight:700,
            color:T.text,letterSpacing:'.12em',lineHeight:1}}>UNIKO</div>
          <div style={{fontFamily:'var(--font-brand)',fontSize:28,fontWeight:400,
            color:T.gold,letterSpacing:'.30em',marginTop:6}}>HUB</div>
        </div>

        <div className="fsu3" style={{margin:'22px 0 10px',width:'460px'}}>
          <StarDivider/>
        </div>

        <div className="fsu3" style={{fontFamily:'var(--font-body)',fontSize:17,
          color:T.textT,marginBottom:44,fontWeight:400}}>
          Sistema Integrado de Gestão de Recursos Humanos
        </div>

        <div className="fsu4">
          <button onClick={onStart} onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
            style={{display:'inline-flex',alignItems:'center',gap:14,padding:'15px 52px',
              background:hov
                ?`linear-gradient(135deg,${T.gold},${T.blueL})`
                :`linear-gradient(135deg,${T.blueL},${T.gold})`,
              color:'#fff',border:'none',borderRadius:14,cursor:'pointer',
              fontFamily:'var(--font-body)',fontSize:16,fontWeight:500,
              boxShadow:hov?`0 10px 36px rgba(14,80,180,0.40)`:`0 5px 22px rgba(14,80,180,0.28)`,
              transform:hov?'translateY(-2px)':'none',
              transition:'all .22s cubic-bezier(.16,1,.3,1)',outline:'none',letterSpacing:'.01em'}}>
            Iniciar
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"
              style={{transition:'transform .2s',transform:hov?'translateX(3px)':'none'}}>
              <path d="M3 8.5H14M14 8.5L9.5 4M14 8.5L9.5 13"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="fsu4" style={{marginTop:50,display:'flex',alignItems:'center',gap:10,opacity:.45}}>
          <Logo size={22}/>
          <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT}}>
            Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
          </span>
        </div>
      </div>

    </div>
  );
};

export { LandingPage };
