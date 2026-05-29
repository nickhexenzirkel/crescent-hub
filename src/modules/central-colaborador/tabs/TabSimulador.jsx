import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { USER } from '../../../contexts/user';
import { Card, Btn, StarDivider, SHead } from '../../../shared/components';

const TabSimulador = () => {
  const [tipo,setTipo]=useState('ferias');
  const [dataInicio,setDI]=useState('2022-02-01');
  const [dataSaida,setDS]=useState('2025-08-15');
  const [diasFerias,setDF]=useState(30);
  const calcular=()=>{
    const admissao=new Date(dataInicio);
    const saida=new Date(dataSaida);
    const meses=Math.floor((saida-admissao)/(1000*60*60*24*30.44));
    const sal=USER.salary;
    if(tipo==='ferias'){
      const vF=sal*(diasFerias/30), t=vF/3;
      return{items:[
        {label:`Férias (${diasFerias} dias)`,valor:vF,c:T.blue},
        {label:'1/3 Constitucional',valor:t,c:T.gold},
        {label:'Total Bruto',valor:vF+t,c:T.green,bold:true},
        {label:'INSS estimado',valor:-(vF+t)*0.11,c:T.danger},
        {label:'Valor Líquido estimado',valor:(vF+t)*0.89,c:T.green,bold:true},
      ]};
    }
    if(tipo==='decimoTerceiro'){
      const mesesAno=Math.min(saida.getMonth()+1,12);
      const prop=(sal/12)*mesesAno;
      return{items:[
        {label:`13º proporcional (${mesesAno}/12 meses)`,valor:prop,c:T.blue},
        {label:'1ª parcela (adiantamento Jun)',valor:prop*0.5,c:T.textT},
        {label:'2ª parcela (Dezembro)',valor:prop*0.5,c:T.green},
        {label:'INSS sobre 2ª parcela',valor:-prop*0.5*0.11,c:T.danger},
        {label:'Valor líquido 2ª parcela',valor:prop*0.5*0.89,c:T.green,bold:true},
      ]};
    }
    if(tipo==='rescisao'){
      const mp=meses%12;
      const saldo=sal*(saida.getDate()/30);
      const ferias=sal*(mp/12), terco=ferias/3;
      const dec=(sal/12)*mp;
      const fgts=sal*meses*0.08, multa=fgts*0.4;
      return{items:[
        {label:'Saldo de salário',valor:saldo,c:T.blue},
        {label:`Férias proporcionais (${mp} meses)`,valor:ferias,c:T.blue},
        {label:'1/3 sobre férias',valor:terco,c:T.gold},
        {label:`13º proporcional (${mp} meses)`,valor:dec,c:T.gold},
        {label:'Multa FGTS (40%)',valor:multa,c:T.green},
        {label:'Total Bruto da Rescisão',valor:saldo+ferias+terco+dec+multa,c:T.green,bold:true},
      ]};
    }
    return{items:[]};
  };
  const res=calcular();
  const fmt=(v)=>(v<0?'- ':'')+`R$ ${Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  const tipos=[
    {id:'ferias',label:'Simulação de Férias',iKey:'sun'},
    {id:'decimoTerceiro',label:'13º Salário',iKey:'gift'},
    {id:'rescisao',label:'Rescisão',iKey:'doc'},
  ];
  const TipoIcon=({iKey,active})=>{
    const props={width:16,height:16,viewBox:"0 0 24 24",fill:"none",
      stroke:active?T.gold:T.textD,strokeWidth:"1.7",strokeLinecap:"round",
      style:{flexShrink:0}};
    if(iKey==='sun')return(<svg {...props}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>);
    if(iKey==='gift')return(<svg {...props}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>);
    return(<svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>);
  };
  return(<div className="fi" style={{fontFamily:'var(--font-body)'}}>
    <SHead sub="Calcule valores de férias, 13º e rescisão">Simulação</SHead>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div>
        <Card style={{padding:'24px',marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>Tipo de simulação</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {tipos.map(t=>(
              <div key={t.id} onClick={()=>setTipo(t.id)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                  borderRadius:11,cursor:'pointer',
                  background:tipo===t.id?T.goldGl:'transparent',
                  border:`1.5px solid ${tipo===t.id?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                <TipoIcon iKey={t.iKey} active={tipo===t.id}/>
                <span style={{fontSize:14,fontWeight:tipo===t.id?500:400,
                  color:tipo===t.id?T.gold:T.text}}>{t.label}</span>
                {tipo===t.id&&<div style={{marginLeft:'auto',width:7,height:7,borderRadius:'50%',background:T.gold}}/>}
              </div>
            ))}
          </div>
        </Card>
        <Card style={{padding:'24px'}}>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>Dados para cálculo</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:T.textS,marginBottom:6,fontWeight:500}}>Data de admissão</div>
            <input type="date" value={dataInicio} onChange={e=>setDI(e.target.value)}
              style={{width:'100%',background:T.surfaceSub||'rgba(0,0,0,0.025)',
                border:`1.5px solid ${T.border}`,borderRadius:9,padding:'10px 12px',
                color:T.text,fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=T.gold}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:13,color:T.textS,marginBottom:6,fontWeight:500}}>
              {tipo==='rescisao'?'Data de saída':'Data de referência'}
            </div>
            <input type="date" value={dataSaida} onChange={e=>setDS(e.target.value)}
              style={{width:'100%',background:T.surfaceSub||'rgba(0,0,0,0.025)',
                border:`1.5px solid ${T.border}`,borderRadius:9,padding:'10px 12px',
                color:T.text,fontFamily:'var(--font-body)',fontSize:14,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=T.gold}
              onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {tipo==='ferias'&&(<div>
            <div style={{fontSize:13,color:T.textS,marginBottom:6,fontWeight:500}}>Dias de férias</div>
            <div style={{display:'flex',gap:8}}>
              {[10,15,20,30].map(d=>(
                <button key={d} onClick={()=>setDF(d)}
                  style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',outline:'none',
                    fontFamily:'var(--font-body)',fontSize:13,fontWeight:500,
                    background:diasFerias===d?T.goldGl:'transparent',
                    border:`1.5px solid ${diasFerias===d?T.goldLine+'55':T.border}`,
                    color:diasFerias===d?T.gold:T.textS,transition:'all .15s'}}>{d}d</button>
              ))}
            </div>
          </div>)}
          <div style={{marginTop:14,padding:'10px 12px',background:T.blueGl,
            border:`1px solid ${T.blue}22`,borderRadius:9,fontSize:12,color:T.textS}}>
            Valores estimados. Consulte o RH para confirmação oficial.
          </div>
        </Card>
      </div>
      <div>
        <Card style={{padding:'24px',background:`linear-gradient(160deg,${T.goldGl},${T.surface} 60%)`}} elevated>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:5}}>Resultado estimado</div>
          <div style={{fontSize:13,color:T.textT,marginBottom:16}}>{tipos.find(t=>t.id===tipo)?.label}</div>
          <StarDivider my={0}/>
          <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:10}}>
            {res.items.map((item,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:item.bold?'14px 16px':'10px 14px',
                background:item.bold?`linear-gradient(135deg,${item.c},${item.c}bb)`:'transparent',
                borderRadius:item.bold?11:0,
                borderBottom:!item.bold?`1px solid ${T.divider}`:'none'}}>
                <span style={{fontSize:item.bold?14:13,color:item.bold?'#fff':T.textS,fontWeight:item.bold?500:400}}>{item.label}</span>
                <span style={{fontSize:item.bold?18:14,fontWeight:700,color:item.bold?'#fff':item.c}}>{fmt(item.valor)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </div>);
};


export { TabSimulador };
