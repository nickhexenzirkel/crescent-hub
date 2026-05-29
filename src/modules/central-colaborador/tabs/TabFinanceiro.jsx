import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, SERVER_URL } from '../../../contexts/user';
import { Card, Tag, Btn, StarDivider, SHead } from '../../../shared/components';

const TabFinanceiro = () => {
  const liq = USER.salary - USER.inss - USER.ir;
  const [salaryHistory, setSalaryHistory]   = useState([]);
  const [histLoading, setHistLoading]       = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (!token) { setHistLoading(false); return; }
    fetch(`${SERVER_URL}/api/auth/salary-history`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.ok ? r.json() : { history: [] })
    .then(d => { setSalaryHistory(d.history || []); })
    .catch(() => {})
    .finally(() => setHistLoading(false));
  }, []);
  return(
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Salários e contracheques">Financeiro</SHead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',
        background:T.surface,border:`1px solid ${T.border}`,
        borderRadius:14,overflow:'hidden',marginBottom:20,boxShadow:T.sh}}>
        {[['Nome',USER.name],['Categoria',USER.category],['Cargo',USER.cargo],
          ['Admissão',USER.admission],['Dependentes',USER.dependents],['Hora/Mês',USER.horasMes]].map(([l,v],i)=>(
          <div key={l} style={{padding:'15px 17px',borderRight:i<5?`1px solid ${T.divider}`:'none'}}>
            <div style={{fontSize:11,color:T.textD,letterSpacing:'.06em',
              textTransform:'uppercase',marginBottom:5,fontWeight:500}}>{l}</div>
            <div style={{fontSize:13,fontWeight:500,color:T.text}}>{v}</div>
          </div>
        ))}
      </div>
      <Card style={{padding:'28px',marginBottom:18}} elevated>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div>
            <div style={{fontSize:20,fontWeight:600,color:T.text}}>Resumo Financeiro</div>
            <div style={{fontSize:14,color:T.textT,marginTop:4}}>Cálculo do salário líquido</div>
          </div>
        </div>
        <StarDivider my={14}/>
        <div style={{background:T.greenGl,border:`1px solid ${T.green}22`,borderRadius:13,
          padding:'20px 24px',marginBottom:14,display:'flex',
          justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:11,color:T.green,letterSpacing:'.07em',
              textTransform:'uppercase',marginBottom:6,fontWeight:500}}>+ SALÁRIO BRUTO</div>
            <div style={{fontSize:24,fontWeight:700,color:T.green}}>
              R$ {USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </div>
          </div>
          <div style={{width:46,height:46,borderRadius:'50%',background:T.green,
            display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20}}>$</div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:16,padding:'12px',
          fontSize:14,marginBottom:14,color:T.textS}}>
          <span style={{color:T.green,fontWeight:500}}>R$ {USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span>−</span>
          <span style={{color:T.danger,fontWeight:500}}>R$ {(USER.inss+USER.ir).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
          <span>=</span>
          <span style={{color:T.gold,fontWeight:600}}>R$ {liq.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
        </div>
        <div style={{background:`linear-gradient(135deg,${T.gold},${T.goldL})`,
          borderRadius:13,padding:'22px 26px',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          boxShadow:`0 6px 24px rgba(184,144,42,0.28)`}}>
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.65)',letterSpacing:'.07em',
              textTransform:'uppercase',marginBottom:6}}>↑ SALÁRIO LÍQUIDO</div>
            <div style={{fontSize:26,fontWeight:700,color:'#fff'}}>
              R$ {liq.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,.6)',marginTop:4}}>Valor final a receber</div>
          </div>
          <div style={{width:46,height:46,borderRadius:'50%',background:'rgba(255,255,255,.22)',
            display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20}}>↗</div>
        </div>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
        {[['INSS',USER.inss,T.danger,T.dangerGl],['IR Retido',USER.ir,T.gold,T.goldGl],
          ['VT',USER.vt,T.blue,T.blueGl],['VA',USER.va,T.green,T.greenGl]].map(([l,v,c,bg])=>(
          <div key={l} style={{background:bg,border:`1px solid ${c}22`,borderRadius:13,
            padding:'16px 20px',display:'flex',justifyContent:'space-between',
            alignItems:'center',boxShadow:T.sh}}>
            <span style={{fontSize:14,color:T.textS}}>— {l}</span>
            <span style={{fontSize:16,fontWeight:700,color:c}}>
              R$ {v.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </span>
          </div>
        ))}
      </div>
      <Card style={{padding:'28px',marginBottom:16}}>
        <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:4}}>Evolução Salarial</div>
        <div style={{fontSize:14,color:T.textT,marginBottom:14}}>Histórico de reajustes</div>
        <StarDivider my={14}/>
        {histLoading
          ? <div style={{textAlign:'center',padding:'20px 0',color:T.textT,fontSize:13}}>
              <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>
              Carregando histórico...
            </div>
          : salaryHistory.length === 0
            ? <div style={{textAlign:'center',padding:'28px 0',color:T.textT,fontSize:13}}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 10px',display:'block'}}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                Nenhum histórico salarial registrado ainda.<br/>
                <span style={{fontSize:11,opacity:.7}}>O RH registra automaticamente ao salvar o salário no Dashboard.</span>
              </div>
            : <>
                <SalaryChart data={salaryHistory}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:14}}>
                  {salaryHistory.map((s,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
                      background:T.surfaceSub||'rgba(0,0,0,0.025)',borderRadius:9,border:`1px solid ${T.border}`}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:T.gold,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:500,color:T.text}}>
                          {s.date} — R$ {Number(s.salary).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </div>
                        {s.pct
                          ? <div style={{fontSize:11,color:T.green}}>{s.pct} · {s.event}</div>
                          : <div style={{fontSize:11,color:T.textT}}>{s.event}</div>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </>
        }
      </Card>
      <Card style={{padding:'28px'}}>
        <div style={{fontSize:19,fontWeight:600,color:T.text,marginBottom:4}}>Contracheques</div>
        <div style={{fontSize:14,color:T.textT,marginBottom:14}}>Histórico de pagamentos</div>
        <StarDivider my={14}/>
        <div style={{textAlign:'center',padding:'32px 0',color:T.textT}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 10px',display:'block'}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <div style={{fontSize:14}}>Nenhum contracheque disponível ainda.</div>
          <div style={{fontSize:12,marginTop:4,opacity:.7}}>Os contracheques serão disponibilizados pelo RH mensalmente.</div>
        </div>
      </Card>
    </div>
  );
};


const SalaryChart = ({ data }) => {
  if (!data || data.length < 2) return (
    <div style={{textAlign:'center',padding:'32px 0',color:T.textT,fontSize:13}}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 8px',display:'block'}}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
      Histórico insuficiente para exibir o gráfico.<br/>
      <span style={{fontSize:11,opacity:.7}}>Aparece automaticamente após ao menos 2 registros salariais.</span>
    </div>
  );
  const maxS=Math.max(...data.map(d=>d.salary));
  const minS=Math.min(...data.map(d=>d.salary));
  const W=540,H=160,padX=44,padY=22;
  const xStep=(W-padX*2)/Math.max(data.length-1,1);
  const yRange=maxS-minS||1;
  const pts=data.map((d,i)=>({x:padX+i*xStep,y:padY+(1-(d.salary-minS)/yRange)*(H-padY*2),...d}));
  const polyline=pts.map(p=>`${p.x},${p.y}`).join(' ');
  const area=`M${pts[0].x},${H-padY} `+pts.map(p=>`L${p.x},${p.y}`).join(' ')+` L${pts[pts.length-1].x},${H-padY} Z`;
  return(<div style={{overflowX:'auto'}}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block',overflow:'visible'}}>
      <defs><linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={T.gold} stopOpacity="0.22"/>
        <stop offset="100%" stopColor={T.gold} stopOpacity="0.02"/>
      </linearGradient></defs>
      {[0,0.25,0.5,0.75,1].map((f,i)=>{
        const y=padY+f*(H-padY*2);
        const val=Math.round(maxS-f*yRange);
        return(<g key={i}>
          <line x1={padX} y1={y} x2={W-padX} y2={y} stroke={T.divider} strokeWidth="1" strokeDasharray="4 4"/>
          <text x={padX-6} y={y+4} fontSize="9" fill={T.textD} textAnchor="end" fontFamily="var(--font-body)">
            {val>=1000?`${(val/1000).toFixed(1)}k`:val}
          </text>
        </g>);
      })}
      <path d={area} fill="url(#salGrad)"/>
      <polyline points={polyline} fill="none" stroke={T.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill={T.surface} stroke={T.gold} strokeWidth="2.5"/>
          <circle cx={p.x} cy={p.y} r="2.5" fill={T.gold}/>
          <text x={p.x} y={H-4} fontSize="9" fill={T.textT} textAnchor="middle" fontFamily="var(--font-body)">{p.date}</text>
          <text x={p.x} y={p.y-12} fontSize="9" fill={T.gold} fontWeight="600" textAnchor="middle" fontFamily="var(--font-body)">
            {p.salary>=1000?`R$${(p.salary/1000).toFixed(1)}k`:`R$${p.salary}`}
          </text>
          {p.pct&&<text x={p.x} y={p.y-22} fontSize="8" fill={T.green} textAnchor="middle" fontFamily="var(--font-body)">{p.pct}</text>}
        </g>
      ))}
    </svg>
  </div>);
};


export { TabFinanceiro };
