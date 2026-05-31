import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { supabase as _supabase, SERVER_URL } from '../../../contexts/user';
import { Card, Tag, StarDivider, SHead } from '../../../shared/components';

const Ico = ({d, size=16, stroke='currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const TabEventos = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const typeColor = { Feriado:T.blue, Confraternização:T.pink, Reunião:T.purple, Evento:T.gold, Outro:T.teal };

  useEffect(() => {
    const load = async () => {
      const { data } = await _supabase.from('calendar_events').select('*').order('event_date', { ascending: true });
      setEvents(data || []);
      setLoading(false);
    };
    load();
    const sub = _supabase.channel('tab_events_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe();
    return () => _supabase.removeChannel(sub);
  }, []);

  const today = new Date();
  const yr = calMonth.getFullYear();
  const mo = calMonth.getMonth();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDay    = new Date(yr, mo, 1).getDay();
  const monthName   = calMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const eventsThisMonth = events.filter(e => {
    const d = new Date(e.event_date + 'T12:00:00');
    return d.getFullYear() === yr && d.getMonth() === mo;
  });
  const daysWithEvents = new Set(eventsThisMonth.map(e => new Date(e.event_date + 'T12:00:00').getDate()));

  const prevMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <SHead sub="Agenda corporativa de eventos">Eventos da Empresa</SHead>
      {loading
        ? <div style={{textAlign:'center',padding:40,color:T.textT}}>
            <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>
            Carregando eventos...
          </div>
        : <div style={{display:'grid',gridTemplateColumns:'1fr 295px',gap:20}}>
            <div>
              <div style={{fontSize:12,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:14,fontWeight:500}}>
                {monthName.toUpperCase()}
              </div>
              {eventsThisMonth.length === 0
                ? <Card style={{padding:'32px',textAlign:'center'}}>
                    <div style={{marginBottom:12,display:'flex',justifyContent:'center'}}><Ico size={40} stroke={T.textD} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/></div>
                    <div style={{color:T.textT,fontSize:14}}>Nenhum evento este mês.</div>
                  </Card>
                : eventsThisMonth.map((ev, i) => {
                    const d = new Date(ev.event_date + 'T12:00:00');
                    const day = d.getDate();
                    const isToday = d.toDateString() === today.toDateString();
                    const color = typeColor[ev.type] || T.gold;
                    return (
                      <div key={ev.id} style={{display:'flex',alignItems:'stretch',marginBottom:12}}>
                        <div style={{width:4,background:`linear-gradient(180deg,${color},${color}44)`,borderRadius:4,flexShrink:0,marginRight:14}}/>
                        <Card style={{flex:1,padding:'15px 20px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:14}}>
                            <div style={{width:52,textAlign:'center',flexShrink:0}}>
                              <div style={{fontSize:22,fontWeight:700,color:isToday?T.gold:T.text}}>{day}</div>
                              <div style={{fontSize:10,color:T.textD,letterSpacing:'.06em'}}>
                                {d.toLocaleString('pt-BR',{month:'short'}).toUpperCase()}
                              </div>
                            </div>
                            <div style={{flex:1}}>
                              <div style={{marginBottom:6}}><Tag color={color}>{ev.type}</Tag></div>
                              <div style={{fontSize:15,fontWeight:500,color:T.text}}>{ev.title}</div>
                              <div style={{fontSize:12,color:T.textT,marginTop:2,display:'flex',alignItems:'center',gap:4}}><Ico size={12} stroke={T.textT} d={<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 14.5 14"/></>}/>{ev.event_time||'Dia todo'}</div>
                              {ev.description&&<div style={{fontSize:12,color:T.textS,marginTop:4}}>{ev.description}</div>}
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })
              }
            </div>
            {/* Mini calendário */}
            <Card style={{padding:'22px',alignSelf:'start'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <button onClick={prevMonth} style={{background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:17,padding:4}}>‹</button>
                <span style={{fontSize:13,fontWeight:500,color:T.text,textTransform:'capitalize'}}>{monthName}</span>
                <button onClick={nextMonth} style={{background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:17,padding:4}}>›</button>
              </div>
              <StarDivider my={0}/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginTop:10,marginBottom:8}}>
                {['D','S','T','Q','Q','S','S'].map((d,i)=>(
                  <div key={i} style={{textAlign:'center',fontSize:10.5,color:T.textD,fontWeight:500,padding:'2px 0'}}>{d}</div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                {Array.from({length:firstDay},(_,i)=><div key={`o${i}`}/>)}
                {Array.from({length:daysInMonth},(_,i)=>{
                  const d=i+1;
                  const isT = yr===today.getFullYear()&&mo===today.getMonth()&&d===today.getDate();
                  const hasEv = daysWithEvents.has(d);
                  return(
                    <div key={d} style={{textAlign:'center',padding:'6px 2px',borderRadius:7,position:'relative',
                      background:isT?T.gold:hasEv?T.goldGl:'transparent',
                      color:isT?'#fff':hasEv?T.gold:T.textS,
                      fontSize:12,fontWeight:isT?600:400}}>
                      {d}
                      {hasEv&&!isT&&<span style={{position:'absolute',bottom:1,left:'50%',transform:'translateX(-50%)',
                        width:3,height:3,borderRadius:'50%',background:T.goldL,display:'block'}}/>}
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:12}}><StarDivider my={0}/></div>
              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:7}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:T.gold}}/><span style={{fontSize:12,color:T.textS}}>Hoje</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:2,background:T.goldGl,border:`1px solid ${T.goldL}44`}}/><span style={{fontSize:12,color:T.textS}}>Com eventos</span>
                </div>
              </div>
            </Card>
          </div>
      }
    </div>
  );
};


export { TabEventos };
