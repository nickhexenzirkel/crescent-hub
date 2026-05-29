import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { USER } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';

const TabInicio = ({setTab}) => {
  const [sv,ssv]=useState(false);
  const Qi=({d})=>(<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>);
  const q=[
    {id:'financeiro',label:'Financeiro',sub:'Contracheques',c:T.green,bg:T.greenGl,
      e:<Qi d={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>}/>},
    {id:'feedback',label:'Feedback',sub:'Sugestões',c:T.pink,bg:T.pinkGl,
      e:<Qi d={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>}/>},
    {id:'eventos',label:'Eventos',sub:'Agenda',c:T.blue,bg:T.blueGl,
      e:<Qi d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>},
    {id:'games',label:'Games',sub:'Jogar',c:T.gold,bg:T.goldGl,
      e:<Qi d={<><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 12h2m-1-1v2M14 12h2"/></>}/>},
  ];
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      {/* Banner */}
      <div style={{borderRadius:18,overflow:'hidden',marginBottom:20,height:158,position:'relative',
        background:`linear-gradient(120deg,${T.blue},${T.blueL} 55%,${T.gold})`,boxShadow:T.shM}}>
        <div style={{position:'absolute',right:-40,top:-40,width:280,height:280,
          borderRadius:'50%',background:'rgba(255,255,255,0.06)',pointerEvents:'none'}}/>
        {/* crescent in banner */}
        <div style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)'}}>
        </div>
        <div style={{position:'relative',zIndex:1,padding:'26px 30px',
          display:'flex',alignItems:'center',gap:20,height:'100%'}}>
          <div style={{width:72,height:72,borderRadius:'50%',
            background:'rgba(255,255,255,0.92)',display:'flex',alignItems:'center',
            justifyContent:'center',fontSize:24,fontWeight:700,color:T.blue,
            border:'3px solid rgba(255,255,255,.55)',boxShadow:'0 4px 20px rgba(0,0,0,.15)',
            flexShrink:0,cursor:'pointer'}}>
            {USER.avatar}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:24,fontWeight:600,color:'#fff',marginBottom:5}}>Olá, {USER.short}!</div>
            <div style={{fontSize:15,color:'rgba(255,255,255,.78)'}}>Bem-vindo(a) à sua Central de RH</div>
          </div>
          <button style={{padding:'9px 18px',background:'rgba(255,255,255,.15)',
            border:'1px solid rgba(255,255,255,.3)',borderRadius:9,color:'#fff',
            fontFamily:'var(--font-body)',fontSize:13,cursor:'pointer'}}>
            Trocar Banner
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card style={{padding:'24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:T.greenGl,
              border:`1px solid ${T.green}22`,display:'flex',alignItems:'center',
              justifyContent:'center',color:T.green,fontSize:20}}>$</div>
            <button onClick={()=>ssv(!sv)} style={{background:'none',border:'none',
              cursor:'pointer',color:sv?T.gold:T.textD,padding:3,display:'flex',
              alignItems:'center',transition:'color .18s'}}>
              {sv
                ?<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                :<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/>
                  </svg>}
            </button>
          </div>
          <div style={{fontSize:13,color:T.textT,marginBottom:5,fontWeight:500}}>Último Salário</div>
          <div style={{fontSize:24,fontWeight:700,color:T.text,marginBottom:8,letterSpacing:'-.01em'}}>
            {sv?`R$ ${USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'R$ ••••,••'}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:T.green}}/>
            <span style={{fontSize:13,color:T.green,fontWeight:500}}>Pagamento em dia</span>
          </div>
        </Card>

        <Card style={{padding:'24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:T.goldGl,
              border:`1px solid ${T.gold}22`,display:'flex',alignItems:'center',
              justifyContent:'center',color:T.gold}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4a2 2 0 01-2-2V5h4"/><path d="M18 9h2a2 2 0 002-2V5h-4"/>
                <path d="M12 17v4M8 21h8"/>
                <path d="M6 5v4a6 6 0 0012 0V5H6z"/>
              </svg>
            </div>
            <button onClick={()=>setTab('conquistas')} style={{background:'none',border:'none',
              cursor:'pointer',color:T.textD,fontSize:16,padding:3}}>↗</button>
          </div>
          <div style={{fontSize:13,color:T.textT,marginBottom:5,fontWeight:500}}>Troféus</div>
          <div style={{fontSize:30,fontWeight:700,color:T.text,marginBottom:8}}>{USER.trophies.length}</div>
          <div style={{display:'flex',gap:7}}>
            {USER.trophies.map((t,i)=><span key={i} style={{fontSize:20}}>{t.icon}</span>)}
          </div>
        </Card>
      </div>

      <Card style={{padding:'24px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
          <div style={{fontSize:18,fontWeight:600,color:T.text}}>Acesso Rápido</div>
        </div>
        <div style={{fontSize:14,color:T.textT,marginBottom:4}}>Módulos mais utilizados</div>
        <StarDivider my={12}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
          {q.map(ql=>(
            <div key={ql.id} onClick={()=>setTab(ql.id)}
              style={{display:'flex',alignItems:'center',gap:13,padding:'14px 16px',
                background:ql.bg,border:`1px solid rgba(0,0,0,0.05)`,borderRadius:12,
                cursor:'pointer',transition:'all .18s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=T.shM;}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
              <span style={{color:ql.c,display:'flex',alignItems:'center'}}>{ql.e}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500,color:T.text}}>{ql.label}</div>
                <div style={{fontSize:12,color:T.textT}}>{ql.sub}</div>
              </div>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5H10.5M10.5 6.5L7.5 3.5M10.5 6.5L7.5 9.5"
                  stroke={ql.c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>
      </Card>

      <div style={{display:'flex',alignItems:'center',gap:13,padding:'13px 18px',
        background:T.goldGl,border:`1px solid rgba(184,144,42,.16)`,borderRadius:12}}>
        <span style={{flexShrink:0,color:T.gold,display:'flex',alignItems:'center'}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/>
          </svg></span>
        <div style={{fontSize:14,color:T.textS,lineHeight:1.65}}>
          <strong style={{color:T.gold,fontWeight:500}}>Dica:</strong> Clique na foto de perfil para alterá-la a qualquer momento.
        </div>
      </div>
    </div>
  );
};


export { TabInicio };
