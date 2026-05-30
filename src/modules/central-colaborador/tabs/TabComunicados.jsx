import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { supabase as _supabase } from '../../../contexts/user';
import { Card, Tag, StarDivider, SHead } from '../../../shared/components';

const catColor = { Política:'#7060C8', RH:T.blue, Benefícios:T.green, Compliance:T.gold, Geral:T.gold };

const TabComunicados = () => {
  const [comuns,   setComuns]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  const LIDO_KEY = 'uniko_comunicados_lidos';
  const getLidos = () => { try { return JSON.parse(localStorage.getItem(LIDO_KEY)||'[]'); } catch { return []; } };
  const marcarLido = (id) => {
    const lidos = getLidos();
    if (!lidos.includes(id)) localStorage.setItem(LIDO_KEY, JSON.stringify([...lidos, id]));
    setComuns(p => p.map(c => c.id === id ? { ...c, read: true } : c));
  };

  const load = async () => {
    setLoading(true);
    const { data } = await _supabase.from('comunicados')
      .select('*').eq('active', true).order('created_at', { ascending: false });
    const lidos = getLidos();
    setComuns((data || []).map(c => ({ ...c, read: lidos.includes(c.id) })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const sub = _supabase.channel('comunicados_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, load)
      .subscribe();
    return () => _supabase.removeChannel(sub);
  }, []);

  const unread = comuns.filter(c => !c.read).length;
  const fmt = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });

  if (selected) {
    const c = comuns.find(x => x.id === selected);
    if (!c) { setSelected(null); return null; }
    return (
      <div className="fi" style={{fontFamily:'var(--font-body)'}}>
        <button onClick={()=>setSelected(null)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:14,marginBottom:20,padding:0}}>
          ← Voltar aos comunicados
        </button>
        <Card style={{padding:'28px'}} elevated>
          {c.urgent && (
            <div style={{display:'inline-flex',alignItems:'center',gap:5,background:'rgba(192,64,80,0.08)',border:'1px solid rgba(192,64,80,0.25)',borderRadius:6,padding:'3px 10px',fontSize:11,color:'#C04050',fontWeight:600,marginBottom:10}}>
              🚨 Urgente
            </div>
          )}
          <div style={{fontSize:20,fontWeight:600,color:T.text,marginBottom:6}}>{c.title}</div>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:4}}>
            <Tag color={catColor[c.cat]||T.gold}>{c.cat}</Tag>
            <span style={{fontSize:12,color:T.textT}}>{fmt(c.created_at)}</span>
            {c.created_by && <span style={{fontSize:12,color:T.textT}}>· por {c.created_by}</span>}
          </div>
          <StarDivider my={16}/>
          <div style={{fontSize:15,color:T.textS,lineHeight:1.8,whiteSpace:'pre-wrap'}}>{c.body}</div>
          <StarDivider my={20}/>
          <div style={{display:'flex',alignItems:'center',gap:10,background:T.greenGl,border:`1px solid ${T.green}22`,borderRadius:10,padding:'12px 16px'}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill={T.green} opacity="0.15"/>
              <path d="M4.5 8L7 10.5L11.5 5.5" stroke={T.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{fontSize:13,color:T.green,fontWeight:500}}>Leitura confirmada — {fmt(c.created_at)}</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontSize:22,fontWeight:600,color:T.text}}>Comunicados</div>
          <div style={{fontSize:15,color:T.textT,marginTop:4}}>Avisos e informações oficiais do RH</div>
        </div>
        {unread > 0 && (
          <div style={{background:T.goldGl,border:`1px solid ${T.goldLine}44`,borderRadius:8,padding:'6px 14px',fontSize:13,color:T.gold,fontWeight:500}}>
            {unread} não {unread === 1 ? 'lido' : 'lidos'}
          </div>
        )}
      </div>
      <StarDivider my={16}/>
      {loading
        ? <div style={{textAlign:'center',padding:48,color:T.textT}}>
            <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 10px'}}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Carregando...
          </div>
        : comuns.length === 0
          ? <div style={{textAlign:'center',padding:'48px 0',color:T.textT}}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 12px',display:'block'}}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              <div style={{fontSize:14}}>Nenhum comunicado por enquanto.</div>
              <div style={{fontSize:12,marginTop:4,opacity:.7}}>Os comunicados do RH aparecerão aqui.</div>
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {comuns.map(c => (
                <Card key={c.id} style={{padding:'20px 24px',cursor:'pointer',opacity:c.read?.6:1,transition:'all .15s'}} elevated
                  onClick={()=>{ setSelected(c.id); marcarLido(c.id); }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
                        {c.urgent && <span style={{fontSize:10,fontWeight:700,color:'#C04050',background:'rgba(192,64,80,0.08)',border:'1px solid rgba(192,64,80,0.2)',padding:'1px 7px',borderRadius:4}}>🚨 URGENTE</span>}
                        <Tag color={catColor[c.cat]||T.gold}>{c.cat||'Geral'}</Tag>
                        {!c.read && <span style={{width:7,height:7,borderRadius:'50%',background:T.gold,display:'inline-block'}}/>}
                      </div>
                      <div style={{fontSize:15,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                      {c.body && <div style={{fontSize:13,color:T.textS,marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.body}</div>}
                    </div>
                    <div style={{fontSize:12,color:T.textT,whiteSpace:'nowrap',flexShrink:0}}>{fmt(c.created_at)}</div>
                  </div>
                </Card>
              ))}
            </div>
      }
    </div>
  );
};

export { TabComunicados };
