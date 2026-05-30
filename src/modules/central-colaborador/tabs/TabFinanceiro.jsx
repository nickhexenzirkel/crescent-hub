import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, SERVER_URL, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider, SHead } from '../../../shared/components';

/* ── helpers ──────────────────────────────────────────────────── */
const BRL = v => (v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
const Ico = ({ d, size=16, stroke='currentColor', fill='none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/* ── componente principal ──────────────────────────────────────── */
const TabFinanceiro = () => {
  const [histLoading, setHistLoading] = useState(true);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [contracheques, setContracheques] = useState([]);
  const [chLoading, setChLoading] = useState(true);
  const [eventosOpen, setEventosOpen] = useState(true);
  const [salVisible, setSalVisible] = useState(false);

  /* cálculos: Salário Bruto + 1K Service - INSS = Líquido */
  const gross1k        = USER.salary_1k || 0;
  const inss           = USER.inss      || 0;
  const totalBruto     = USER.salary + gross1k;
  const totalDescontos = inss;
  const liquido        = totalBruto - totalDescontos;

  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (token) {
      fetch(`${SERVER_URL}/api/auth/salary-history`, { headers:{ Authorization:`Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { history:[] })
        .then(d => setSalaryHistory(d.history || []))
        .catch(() => {})
        .finally(() => setHistLoading(false));
    } else setHistLoading(false);

    _supabase.from('contracheques').select('*')
      .eq('employee_name', USER.name)
      .order('competencia', { ascending: false })
      .then(({ data }) => { setContracheques(data || []); setChLoading(false); });
  }, []);

  const fmtDate = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
      <SHead sub="Salários e contracheques">Financeiro</SHead>

      {/* ── BANNER COLABORADOR ─────────────────────────────────── */}
      <div style={{
        borderRadius:16, overflow:'hidden', marginBottom:20, position:'relative',
        background:`linear-gradient(135deg,${T.blue} 0%,${T.blueL} 55%,${T.gold}88 100%)`,
        boxShadow:T.shM,
      }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
          <div style={{ position:'absolute', width:220, height:220, borderRadius:'50%',
            background:'rgba(255,255,255,0.06)', top:-60, right:-40, filter:'blur(20px)' }}/>
          <div style={{ position:'absolute', width:160, height:160, borderRadius:'50%',
            background:'rgba(255,255,255,0.04)', bottom:-40, left:'30%', filter:'blur(18px)' }}/>
        </div>
        <div style={{ position:'relative', zIndex:1, padding:'16px 24px' }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', letterSpacing:'.10em',
            textTransform:'uppercase', marginBottom:10, fontWeight:600 }}>
            Informações do Colaborador
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:0 }}>
            {[
              ['Nome',        USER.name],
              ['Categoria',   USER.category],
              ['Cargo',       USER.cargo],
              ['Admissão',    USER.admission],
              ['Dependentes', USER.dependents],
              ['Hora/Mês',    USER.horasMes],
            ].map(([l, v], i) => (
              <div key={l} style={{
                padding:'10px 14px',
                borderRight: i < 5 ? '1px solid rgba(255,255,255,0.14)' : 'none',
              }}>
                <div style={{ fontSize:9.5, color:'rgba(255,255,255,0.52)', letterSpacing:'.08em',
                  textTransform:'uppercase', marginBottom:4, fontWeight:600 }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#fff',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v||'—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RESUMO FINANCEIRO ──────────────────────────────────── */}
      <Card style={{ padding:'26px 28px', marginBottom:18 }} elevated>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <div style={{ fontSize:19, fontWeight:700, color:T.text }}>Resumo Financeiro</div>
            <div style={{ fontSize:13, color:T.textT, marginTop:3 }}>Cálculo do salário líquido</div>
          </div>
          <button onClick={() => setSalVisible(v => !v)} title={salVisible ? 'Ocultar valores' : 'Mostrar valores'}
            style={{ background:'none', border:'none', cursor:'pointer', color:salVisible?T.gold:T.textD, padding:4 }}>
            <Ico size={15} d={salVisible
              ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></>
            }/>
          </button>
        </div>

        <StarDivider my={16}/>

        {/* SALÁRIO BRUTO */}
        <div style={{
          background:'rgba(40,168,112,0.08)', border:'1px solid rgba(40,168,112,0.22)',
          borderRadius:13, padding:'18px 22px', marginBottom:10,
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div>
            <div style={{ fontSize:10.5, color:'#28A870', letterSpacing:'.08em',
              textTransform:'uppercase', marginBottom:5, fontWeight:600 }}>+ Salário Bruto</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#28A870' }}>
              {salVisible ? `R$ ${BRL(USER.salary)}` : 'R$ ••••,••'}
            </div>
          </div>
          <div style={{ width:44, height:44, borderRadius:'50%', background:'#28A870',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 14px rgba(40,168,112,0.35)' }}>
            <Ico size={18} stroke="white" d={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>}/>
          </div>
        </div>

        {/* 1K SERVICE — todos os colaboradores recebem */}
        <div style={{
          background:'rgba(42,109,181,0.08)', border:`1px solid ${T.blue}30`,
          borderRadius:13, padding:'18px 22px', marginBottom:10,
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div>
            <div style={{ fontSize:10.5, color:T.blue, letterSpacing:'.08em',
              textTransform:'uppercase', marginBottom:5, fontWeight:600 }}>+ 1K Service</div>
            <div style={{ fontSize:22, fontWeight:700, color:T.blue }}>
              {salVisible ? `+ R$ ${BRL(gross1k)}` : '+ R$ ••••,••'}
            </div>
          </div>
          <div style={{ width:44, height:44, borderRadius:'50%', background:T.blue,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 4px 14px ${T.blue}44` }}>
            <Ico size={18} stroke="white" d={<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>}/>
          </div>
        </div>

        {/* EVENTOS / DESCONTOS */}
        <div style={{
          background:'rgba(192,64,80,0.06)', border:'1px solid rgba(192,64,80,0.22)',
          borderRadius:13, marginBottom:10, overflow:'hidden',
        }}>
          <button onClick={() => setEventosOpen(o => !o)} style={{
            width:'100%', padding:'16px 22px', background:'none', border:'none',
            cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
            outline:'none',
          }}>
            <div style={{ fontSize:10.5, color:'#C04050', letterSpacing:'.08em',
              textTransform:'uppercase', fontWeight:600 }}>− Eventos (Descontos)</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#C04050' }}>
                {salVisible ? `- R$ ${BRL(totalDescontos)}` : '- R$ ••••,••'}
              </span>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#C04050',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Ico size={12} stroke="white" d={eventosOpen
                  ? <polyline points="18 15 12 9 6 15"/>
                  : <polyline points="6 9 12 15 18 9"/>
                }/>
              </div>
            </div>
          </button>

          {eventosOpen && (
            <div style={{ borderTop:'1px solid rgba(192,64,80,0.15)', padding:'4px 0 8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 22px' }}>
                <span style={{ fontSize:13, color:T.textS }}>INSS</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#C04050' }}>
                  {salVisible ? `- R$ ${BRL(inss)}` : '- R$ ••••,••'}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 22px', borderTop:'1px solid rgba(192,64,80,0.14)', marginTop:2 }}>
                <span style={{ fontSize:12, color:'#C04050', fontWeight:700, letterSpacing:'.04em',
                  textTransform:'uppercase' }}>Total Eventos</span>
                <span style={{ fontSize:14, fontWeight:700, color:'#C04050' }}>
                  {salVisible ? `- R$ ${BRL(totalDescontos)}` : '- R$ ••••,••'}
                </span>
              </div>
            </div>
          )}
        </div>

        <StarDivider my={16}/>

        {/* FÓRMULA */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
          gap:8, flexWrap:'wrap', padding:'10px 0', marginBottom:14 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#28A870' }}>
            R$ {salVisible ? BRL(USER.salary) : '••••'}
          </span>
          <span style={{ fontSize:13, color:T.textD }}>+</span>
          <span style={{ fontSize:13, fontWeight:600, color:T.blue }}>
            R$ {salVisible ? BRL(gross1k) : '••••'}
          </span>
          {totalDescontos > 0 && <>
            <span style={{ fontSize:13, color:T.textD }}>−</span>
            <span style={{ fontSize:13, fontWeight:600, color:'#C04050' }}>
              R$ {salVisible ? BRL(totalDescontos) : '••••'}
            </span>
          </>}
          <span style={{ fontSize:13, color:T.textD }}>=</span>
          <span style={{ fontSize:15, fontWeight:700, color:T.gold }}>
            R$ {salVisible ? BRL(liquido) : '•••••'}
          </span>
        </div>

        {/* SALÁRIO LÍQUIDO */}
        <div style={{
          background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold+'cc'} 55%,${T.blue}88)`,
          borderRadius:14, padding:'22px 26px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          boxShadow:`0 6px 28px ${T.gold}44`,
        }}>
          <div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.62)', letterSpacing:'.10em',
              textTransform:'uppercase', marginBottom:5, fontWeight:600 }}>↑ Salário Líquido</div>
            <div style={{ fontSize:28, fontWeight:700, color:'#fff', letterSpacing:'-.01em' }}>
              {salVisible ? `R$ ${BRL(liquido)}` : 'R$ •••••,••'}
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.58)', marginTop:4 }}>Valor final a receber</div>
          </div>
          <div style={{ width:48, height:48, borderRadius:'50%',
            background:'rgba(255,255,255,0.18)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Ico size={20} stroke="white" d={<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>}/>
          </div>
        </div>
      </Card>

      {/* ── CONTRACHEQUES ANEXADOS ─────────────────────────────── */}
      <Card style={{ padding:'26px 28px', marginBottom:18 }} elevated>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <div style={{ fontSize:19, fontWeight:700, color:T.text }}>Contracheques Anexados</div>
            <div style={{ fontSize:13, color:T.textT, marginTop:3 }}>
              Documentos enviados pelo RH
              {contracheques.length > 0 && <span style={{ marginLeft:6, background:T.goldGl,
                color:T.gold, borderRadius:20, padding:'1px 8px', fontSize:11, fontWeight:600,
                border:`1px solid ${T.gold}33` }}>({contracheques.length})</span>}
            </div>
          </div>
          <Ico size={20} stroke={T.textD} d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>}/>
        </div>
        <StarDivider my={16}/>

        {chLoading ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:T.textT }}>
            <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${T.gold}`,
              borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 8px' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Carregando contracheques...
          </div>
        ) : contracheques.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:T.textT }}>
            <Ico size={36} stroke={T.textD} d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>}/>
            <div style={{ fontSize:14, marginTop:10 }}>Nenhum contracheque disponível</div>
            <div style={{ fontSize:12, marginTop:4, opacity:.65 }}>O RH disponibiliza mensalmente</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {contracheques.map((ch, i) => (
              <div key={ch.id || i} style={{
                display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
                transition:'border-color .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${T.gold}55`}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
              >
                {/* ícone */}
                <div style={{ width:40, height:40, borderRadius:10, background:T.goldGl,
                  border:`1px solid ${T.gold}22`, display:'flex', alignItems:'center',
                  justifyContent:'center', flexShrink:0 }}>
                  <Ico size={16} stroke={T.gold} d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>}/>
                </div>
                {/* info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.text }}>
                    {ch.competencia || ch.month || `Competência ${i+1}`}
                  </div>
                  <div style={{ fontSize:11.5, color:T.textT, marginTop:3, display:'flex', alignItems:'center', gap:5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.7" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Anexado em: {fmtDate(ch.created_at || ch.attached_at)}
                  </div>
                </div>
                {/* ações */}
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  {ch.file_url && (
                    <a href={ch.file_url} download target="_blank" rel="noreferrer"
                      title="Baixar" style={{
                        width:34, height:34, borderRadius:9, display:'flex', alignItems:'center',
                        justifyContent:'center', background:'rgba(40,168,112,0.10)',
                        border:'1px solid rgba(40,168,112,0.25)', color:'#28A870',
                        textDecoration:'none', transition:'background .14s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(40,168,112,0.20)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(40,168,112,0.10)'}>
                      <Ico size={13} stroke="#28A870" d={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>}/>
                    </a>
                  )}
                  {ch.file_url && (
                    <a href={ch.file_url} target="_blank" rel="noreferrer"
                      title="Visualizar" style={{
                        width:34, height:34, borderRadius:9, display:'flex', alignItems:'center',
                        justifyContent:'center', background:T.blueGl,
                        border:`1px solid ${T.blue}25`, color:T.blue,
                        textDecoration:'none', transition:'background .14s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background=`${T.blue}20`}
                      onMouseLeave={e => e.currentTarget.style.background=T.blueGl}>
                      <Ico size={13} stroke={T.blue} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}/>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── EVOLUÇÃO SALARIAL ─────────────────────────────────── */}
      <Card style={{ padding:'26px 28px' }} elevated>
        <div style={{ marginBottom:4 }}>
          <div style={{ fontSize:19, fontWeight:700, color:T.text }}>Evolução Salarial</div>
          <div style={{ fontSize:13, color:T.textT, marginTop:3 }}>Histórico de reajustes</div>
        </div>
        <StarDivider my={16}/>
        {histLoading
          ? <div style={{ textAlign:'center', padding:'24px 0', color:T.textT, fontSize:13 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${T.gold}`,
                borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 8px' }}/>
              Carregando histórico...
            </div>
          : salaryHistory.length === 0
            ? <div style={{ textAlign:'center', padding:'32px 0', color:T.textT }}>
                <Ico size={34} stroke={T.textD} d={<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>}/>
                <div style={{ fontSize:14, marginTop:10 }}>Nenhum histórico registrado ainda</div>
                <div style={{ fontSize:12, marginTop:4, opacity:.65 }}>
                  O RH registra automaticamente ao atualizar o salário
                </div>
              </div>
            : <>
                <SalaryChart data={salaryHistory}/>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:16 }}>
                  {salaryHistory.map((s, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8,
                      padding:'7px 13px', background:T.surfaceSub||'rgba(0,0,0,0.025)',
                      borderRadius:9, border:`1px solid ${T.border}` }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:T.gold, flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:12, fontWeight:500, color:T.text }}>
                          {s.date} — R$ {Number(s.salary).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </div>
                        {s.pct
                          ? <div style={{ fontSize:11, color:'#28A870' }}>{s.pct} · {s.event}</div>
                          : <div style={{ fontSize:11, color:T.textT }}>{s.event}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
        }
      </Card>
    </div>
  );
};

/* ── Gráfico de evolução ────────────────────────────────────────── */
const SalaryChart = ({ data }) => {
  if (!data || data.length < 2) return (
    <div style={{ textAlign:'center', padding:'28px 0', color:T.textT, fontSize:13 }}>
      <div style={{ fontSize:12, opacity:.7 }}>Aparece com ao menos 2 registros.</div>
    </div>
  );
  const maxS = Math.max(...data.map(d => d.salary));
  const minS = Math.min(...data.map(d => d.salary));
  const W=540, H=160, padX=44, padY=22;
  const xStep = (W-padX*2) / Math.max(data.length-1, 1);
  const yRange = maxS - minS || 1;
  const pts = data.map((d,i) => ({ x:padX+i*xStep, y:padY+(1-(d.salary-minS)/yRange)*(H-padY*2), ...d }));
  const poly = pts.map(p=>`${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${H-padY} `+pts.map(p=>`L${p.x},${p.y}`).join(' ')+` L${pts[pts.length-1].x},${H-padY} Z`;
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:'block', overflow:'visible' }}>
        <defs>
          <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.gold} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={T.gold} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0,.25,.5,.75,1].map((f,i) => {
          const y = padY+f*(H-padY*2);
          const val = Math.round(maxS-f*yRange);
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={W-padX} y2={y} stroke={T.divider||T.border} strokeWidth="1" strokeDasharray="4 4"/>
              <text x={padX-6} y={y+4} fontSize="9" fill={T.textD} textAnchor="end" fontFamily="var(--font-body)">
                {val>=1000?`${(val/1000).toFixed(1)}k`:val}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#sGrad)"/>
        <polyline points={poly} fill="none" stroke={T.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill={T.surface} stroke={T.gold} strokeWidth="2.5"/>
            <circle cx={p.x} cy={p.y} r="2.5" fill={T.gold}/>
            <text x={p.x} y={H-4} fontSize="9" fill={T.textT} textAnchor="middle" fontFamily="var(--font-body)">{p.date}</text>
            <text x={p.x} y={p.y-12} fontSize="9" fill={T.gold} fontWeight="600" textAnchor="middle" fontFamily="var(--font-body)">
              {p.salary>=1000?`R$${(p.salary/1000).toFixed(1)}k`:`R$${p.salary}`}
            </text>
            {p.pct&&<text x={p.x} y={p.y-22} fontSize="8" fill="#28A870" textAnchor="middle" fontFamily="var(--font-body)">{p.pct}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
};

export { TabFinanceiro };
