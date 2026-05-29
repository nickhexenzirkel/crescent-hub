import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { SERVER_URL } from '../../../contexts/user';
import { Card, Btn, Tag, Inp, StarDivider, SHead } from '../../../shared/components';

const TabHoras = () => {
  const [s,ss]=useState('');
  const [nh,snh]=useState('');
  const [nd,snd]=useState('');
  const [ents,se]=useState([]);
  const total=ents.reduce((a,e)=>a+e.h,0);
  const add=()=>{
    if(!nh||!nd)return;
    se(p=>[{id:Date.now(),date:new Date().toLocaleDateString('pt-BR'),desc:nd,h:Number(nh)},...p]);
    snh('');snd('');
  };
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
        borderRadius:18,padding:'30px',marginBottom:22,textAlign:'center',
        boxShadow:`0 8px 28px rgba(78,143,168,0.25)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-20,top:-20}}>
        </div>
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:600,
            color:'#fff',letterSpacing:'.08em',marginBottom:8}}>BANCO DE HORAS</div>
          <div style={{width:'250px',margin:'0 auto 10px'}}><StarDivider/></div>
          <div style={{fontSize:48,fontWeight:700,color:'#fff',marginBottom:10,letterSpacing:'-.02em'}}>
            {total}<span style={{fontSize:26,opacity:.7}}>h</span>
          </div>
          <div style={{fontSize:15,color:'rgba(255,255,255,.72)',marginBottom:12}}>
            Total acumulado · {ents.length} registros
          </div>
          <div style={{display:'inline-flex',alignItems:'center',gap:7,
            background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.28)',
            borderRadius:999,padding:'5px 16px',fontSize:13,color:'#fff'}}>
            ● Sincronizado
          </div>
        </div>
      </div>
      <Card style={{padding:'26px',marginBottom:14}}>
        <div style={{fontSize:18,fontWeight:600,color:T.text,marginBottom:14}}>Registrar Horas</div>
        <StarDivider my={0}/>
        <div style={{marginTop:16,display:'flex',gap:12,alignItems:'flex-end'}}>
          <div style={{flex:2}}><Inp label="Descrição" value={nd} onChange={snd} placeholder="Ex: Plantão, reunião extra..."/></div>
          <div style={{flex:'0 0 100px'}}><Inp label="Horas" value={nh} onChange={snh} type="number" placeholder="Ex: 2"/></div>
          <Btn v="primary" onClick={add} style={{marginBottom:16,padding:'12px 20px',fontSize:14}}>Adicionar</Btn>
        </div>
      </Card>
      <Card style={{padding:'26px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:18,fontWeight:600,color:T.text}}>Histórico</div>
          <input value={s} onChange={e=>ss(e.target.value)} placeholder="Buscar..."
            style={{background:'rgba(0,0,0,0.03)',border:`1.5px solid ${T.border}`,
              borderRadius:9,padding:'8px 14px',color:T.text,
              fontFamily:'var(--font-body)',fontSize:14,outline:'none',width:200}}
            onFocus={e=>e.target.style.borderColor=T.gold}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <StarDivider my={4}/>
        {ents.filter(e=>e.desc.toLowerCase().includes(s.toLowerCase())).length === 0
          ? <div style={{textAlign:'center',padding:'32px 0',color:T.textT}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 10px',display:'block'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div style={{fontSize:13}}>Nenhuma hora extra registrada ainda.</div>
              <div style={{fontSize:12,marginTop:4,opacity:.7}}>Use o formulário acima para adicionar suas horas extras.</div>
            </div>
          : ents.filter(e=>e.desc.toLowerCase().includes(s.toLowerCase())).map(e=>(
              <div key={e.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 15px',
                background:'rgba(0,0,0,0.02)',border:`1px solid ${T.divider}`,
                borderRadius:11,marginBottom:10}}>
                <div style={{width:42,height:42,borderRadius:11,
                  background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color:'#fff',fontSize:13,fontWeight:600,flexShrink:0}}>{e.h}h</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500,color:T.text}}>{e.desc}</div>
                  <div style={{fontSize:12,color:T.textT,marginTop:2}}>{e.date}</div>
                </div>
                <Tag color={T.teal}>Extra</Tag>
              </div>
            ))
        }
      </Card>
    </div>
  );
};


export { TabHoras };
