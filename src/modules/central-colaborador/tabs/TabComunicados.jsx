import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { COMUNICADOS_DATA } from '../../../contexts/user';
import { Card, Tag, StarDivider, SHead } from '../../../shared/components';

const TabComunicados = () => {
  const [comuns,setComuns]=useState(COMUNICADOS_DATA);
  const [selected,setSelected]=useState(null);
  const unread=comuns.filter(c=>!c.read).length;
  const markRead=(id)=>setComuns(p=>p.map(c=>c.id===id?{...c,read:true}:c));
  const catColor={Política:T.purple||'#7060C8',RH:T.blue,Benefícios:T.green,Compliance:T.gold};
  if(selected){
    const c=comuns.find(x=>x.id===selected);
    return(<div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <button onClick={()=>setSelected(null)} style={{display:'flex',alignItems:'center',
        gap:6,background:'none',border:'none',cursor:'pointer',color:T.textS,
        fontSize:14,marginBottom:20,padding:0}}>← Voltar aos comunicados</button>
      <Card style={{padding:'28px'}} elevated>
        <div style={{flex:1,marginBottom:16}}>
          {c.urgent&&<div style={{display:'inline-flex',alignItems:'center',gap:5,
            background:T.dangerGl,border:`1px solid ${T.danger}33`,borderRadius:6,
            padding:'3px 10px',fontSize:11,color:T.danger,fontWeight:500,marginBottom:10}}>
            Urgente</div>}
          <div style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:6}}>{c.title}</div>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <Tag color={catColor[c.cat]||T.gold}>{c.cat}</Tag>
            <span style={{fontSize:12,color:T.textT}}>Publicado em {c.date}</span>
          </div>
        </div>
        <StarDivider my={16}/>
        <div style={{fontSize:15,color:T.textS,lineHeight:1.8}}>{c.body}</div>
        <StarDivider my={20}/>
        <div style={{display:'flex',alignItems:'center',gap:10,background:T.greenGl,
          border:`1px solid ${T.green}22`,borderRadius:10,padding:'12px 16px'}}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill={T.green} opacity="0.15"/>
            <path d="M4.5 8L7 10.5L11.5 5.5" stroke={T.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{fontSize:13,color:T.green,fontWeight:500}}>Leitura confirmada — {c.date}</span>
        </div>
      </Card>
    </div>);
  }
  return(<div className="fi" style={{fontFamily:'var(--font-body)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
      <div>
        <div style={{fontSize:22,fontWeight:600,color:T.text}}>Comunicados</div>
        <div style={{fontSize:15,color:T.textT,marginTop:4}}>Avisos e informações oficiais do RH</div>
      </div>
      {unread>0&&<div style={{background:T.goldGl,border:`1px solid ${T.goldLine}44`,
        borderRadius:8,padding:'6px 14px',fontSize:13,color:T.gold,fontWeight:500}}>
        {unread} não {unread===1?'lido':'lidos'}</div>}
    </div>
    <StarDivider my={16}/>
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {comuns.length === 0
        ? <div style={{textAlign:'center',padding:'48px 0',color:T.textT}}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 12px',display:'block'}}><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            <div style={{fontSize:14}}>Nenhum comunicado por enquanto.</div>
            <div style={{fontSize:12,marginTop:4,opacity:.7}}>Os comunicados do RH aparecerão aqui.</div>
          </div>
        : comuns.map(c=>(
          <Card key={c.id} onClick={()=>{setSelected(c.id);markRead(c.id);}}
            style={{padding:'20px 22px',borderLeft:`3px solid ${c.urgent?T.danger:(catColor[c.cat]||T.gold)}`}}>
            <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                  <Tag color={catColor[c.cat]||T.gold}>{c.cat}</Tag>
                  {c.urgent&&<Tag color={T.danger}>Urgente</Tag>}
                  {!c.read&&<div style={{width:7,height:7,borderRadius:'50%',background:T.gold,flexShrink:0}}/>}
                </div>
                <div style={{fontSize:15,fontWeight:c.read?400:600,color:T.text,marginBottom:5}}>{c.title}</div>
                <div style={{fontSize:13,color:T.textT}}>{c.date}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,color:T.textD,fontSize:13}}>
                {c.read
                  ?<span style={{color:T.green,fontSize:12}}>Lido</span>
                  :<span style={{color:T.textD,fontSize:12}}>Não lido</span>}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3.5L9 7L5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  </div>);
};


export { TabComunicados };
