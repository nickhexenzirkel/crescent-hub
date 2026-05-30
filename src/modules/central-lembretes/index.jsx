import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { Card, StarDivider } from '../../shared/components';

/* ── cores de destaque para anotações ── */
const NOTA_CORES = [
  { id:'default', label:'Padrão'  },
  { id:'amber',   label:'Âmbar'   },
  { id:'blue',    label:'Azul'    },
  { id:'green',   label:'Verde'   },
  { id:'red',     label:'Vermelho'},
  { id:'purple',  label:'Roxo'    },
];
const corStyle = (id) => ({
  default: { bg:'transparent',              border:'', dot:'#AAB8C4'      },
  amber:   { bg:'rgba(255,200,50,0.10)',    border:'rgba(200,150,30,0.28)', dot:'#C8960A' },
  blue:    { bg:'rgba(50,130,255,0.08)',    border:'rgba(30,100,200,0.22)', dot:'#2A6FB5' },
  green:   { bg:'rgba(40,180,100,0.08)',    border:'rgba(20,150,70,0.22)',  dot:'#1A9060' },
  red:     { bg:'rgba(200,50,50,0.08)',     border:'rgba(180,40,40,0.22)',  dot:'#C02030' },
  purple:  { bg:'rgba(120,70,220,0.09)',    border:'rgba(100,60,200,0.22)', dot:'#7040C8' },
}[id] || { bg:'transparent', border:'', dot:'#AAB8C4' });

const Ico = ({ d, size=14, stroke='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/* ═══════════════════════════════════════════════════════════════ */
const CentralLembretes = ({ onBack, authUser }) => {
  const userName = authUser?.name || 'Colaborador';
  const [activeTab, setActiveTab] = useState('lembretes');

  /* ── estado lembretes ── */
  const [lembretes,  setLembretes]  = useState([]);
  const [lLoading,   setLLoading]   = useState(false);
  const [lModal,     setLModal]     = useState(false);
  const [lEdit,      setLEdit]      = useState(null);
  const [lSaving,    setLSaving]    = useState(false);
  const [lMsg,       setLMsg]       = useState('');
  const [lForm,      setLForm]      = useState({ title:'', message:'', time:'', date:'', repeat:'never', active:true });

  /* ── estado anotações ── */
  const [notas,      setNotas]      = useState([]);
  const [nLoading,   setNLoading]   = useState(false);
  const [nModal,     setNModal]     = useState(false);
  const [nEdit,      setNEdit]      = useState(null);
  const [nSaving,    setNSaving]    = useState(false);
  const [nMsg,       setNMsg]       = useState('');
  const [nForm,      setNForm]      = useState({ title:'', message:'', color:'default' });
  const [nExpanded,  setNExpanded]  = useState(new Set());

  /* ── carregar ── */
  const loadLembretes = async () => {
    setLLoading(true);
    const { data } = await _supabase.from('reminders')
      .select('*').eq('type','lembrete').eq('created_by', userName)
      .order('created_at', { ascending: false });
    setLembretes(data || []);
    setLLoading(false);
  };

  const loadNotas = async () => {
    setNLoading(true);
    const { data } = await _supabase.from('reminders')
      .select('*').eq('type','anotacao').eq('created_by', userName)
      .order('created_at', { ascending: false });
    setNotas(data || []);
    setNLoading(false);
  };

  useEffect(() => { loadLembretes(); loadNotas(); }, []);

  /* ── lembretes CRUD ── */
  const openNewL = () => { setLForm({ title:'', message:'', time:'', date:'', repeat:'never', active:true }); setLEdit(null); setLMsg(''); setLModal(true); };
  const openEditL = (l) => { setLForm({ title:l.title||'', message:l.message||'', time:l.time||'', date:l.date||'', repeat:l.repeat||'never', active:l.active }); setLEdit(l); setLMsg(''); setLModal(true); };
  const saveL = async () => {
    if (!lForm.title.trim()) { setLMsg('Título obrigatório'); return; }
    setLSaving(true); setLMsg('');
    const payload = { ...lForm, type:'lembrete', created_by: userName, updated_at: new Date().toISOString() };
    if (lEdit) {
      const { error } = await _supabase.from('reminders').update(payload).eq('id', lEdit.id);
      if (error) { setLMsg('Erro: ' + error.message); setLSaving(false); return; }
    } else {
      const { error } = await _supabase.from('reminders').insert({ ...payload, created_at: new Date().toISOString() });
      if (error) { setLMsg('Erro: ' + error.message); setLSaving(false); return; }
    }
    await loadLembretes(); setLModal(false); setLSaving(false);
  };
  const delL = async (id) => {
    if (!window.confirm('Remover este lembrete?')) return;
    await _supabase.from('reminders').delete().eq('id', id);
    await loadLembretes();
  };
  const toggleL = async (id, active) => {
    await _supabase.from('reminders').update({ active: !active }).eq('id', id);
    await loadLembretes();
  };

  /* ── anotações CRUD ── */
  const openNewN = () => { setNForm({ title:'', message:'', color:'default' }); setNEdit(null); setNMsg(''); setNModal(true); };
  const openEditN = (n) => { setNForm({ title:n.title||'', message:n.message||'', color:n.time||'default' }); setNEdit(n); setNMsg(''); setNModal(true); };
  const saveN = async () => {
    if (!nForm.message.trim()) { setNMsg('Escreva algo na anotação'); return; }
    setNSaving(true); setNMsg('');
    const payload = {
      title:   nForm.title || 'Anotação',
      message: nForm.message,
      time:    nForm.color,   // campo time guarda a cor (sem constraint)
      repeat:  'never',       // valor válido para a check constraint
      type:    'anotacao',
      active:  true,
      created_by: userName,
      updated_at: new Date().toISOString(),
    };
    if (nEdit) {
      const { error } = await _supabase.from('reminders').update(payload).eq('id', nEdit.id);
      if (error) { setNMsg('Erro: ' + error.message); setNSaving(false); return; }
    } else {
      const { error } = await _supabase.from('reminders').insert({ ...payload, created_at: new Date().toISOString() });
      if (error) { setNMsg('Erro: ' + error.message); setNSaving(false); return; }
    }
    await loadNotas(); setNModal(false); setNSaving(false);
  };
  const delN = async (id) => {
    if (!window.confirm('Remover esta anotação?')) return;
    await _supabase.from('reminders').delete().eq('id', id);
    await loadNotas();
  };
  const toggleExpand = (id) => {
    setNExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const repeatLabel = { never:'Sem repetição', daily:'Diário', weekly:'Semanal', monthly:'Mensal' };
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day:'numeric', month:'short', year:'numeric' }) : '';

  /* ═══════════ RENDER ════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily:'var(--font-body)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:10, border:`1px solid ${T.border}`, background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:T.textS, outline:'none' }}>
          <Ico d={<polyline points="15 18 9 12 15 6"/>}/>
        </button>
        <img src="/UnikoQuadrado.png" alt="Uniko" style={{ width:40, height:40, borderRadius:10, objectFit:'cover' }}/>
        <div>
          <div style={{ fontFamily:'var(--font-brand)', fontSize:22, fontWeight:700, color:T.text, letterSpacing:'.04em' }}>
            {activeTab === 'lembretes' ? 'Meus Lembretes' : 'Minhas Anotações'}
          </div>
          <div style={{ fontSize:13, color:T.textT, marginTop:2 }}>
            {activeTab === 'lembretes' ? 'O Uniko te avisa no horário' : 'Suas notas pessoais'} · {userName}
          </div>
        </div>
        <div style={{ flex:1 }}/>
        <button onClick={activeTab === 'lembretes' ? openNewL : openNewN} style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 20px', borderRadius:12, border:'none', cursor:'pointer', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:'white', fontWeight:700, fontSize:13, fontFamily:'var(--font-body)', boxShadow:`0 3px 12px ${T.gold}44` }}>
          <Ico d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>} size={12} stroke="white"/>
          {activeTab === 'lembretes' ? 'Novo Lembrete' : 'Nova Anotação'}
        </button>
      </div>

      {/* ── ABAS ── */}
      <div style={{ display:'flex', gap:4, marginBottom:22, padding:'4px', background:T.surfaceSub||'rgba(0,0,0,0.04)', borderRadius:14, width:'fit-content' }}>
        {[
          {
            id:'lembretes',
            label: <span style={{display:'flex',alignItems:'center',gap:6}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></svg>
              Lembretes
            </span>,
          },
          {
            id:'anotacoes',
            label: <span style={{display:'flex',alignItems:'center',gap:6}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Anotações
            </span>,
          },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding:'8px 20px', borderRadius:11, border:'none', cursor:'pointer',
            fontFamily:'var(--font-body)', fontSize:13, fontWeight:activeTab===tab.id?600:400,
            background: activeTab===tab.id ? T.surface||'white' : 'transparent',
            color: activeTab===tab.id ? T.gold : T.textS,
            boxShadow: activeTab===tab.id ? `0 1px 4px rgba(0,0,0,0.10)` : 'none',
            transition:'all .15s', outline:'none',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════════ ABA LEMBRETES ══════════════ */}
      {activeTab === 'lembretes' && (
        <>
          {lLoading
            ? <div style={{ textAlign:'center', padding:60, color:T.textT }}>
                <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${T.gold}`, borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 10px' }}/>
                Carregando...
              </div>
            : lembretes.length === 0
              ? <div style={{ textAlign:'center', padding:'60px 0', color:T.textT }}>
                  <img src="/Uniko.png" alt="" style={{ width:70, opacity:.35, display:'block', margin:'0 auto 14px' }}/>
                  <div style={{ fontSize:15, marginBottom:6 }}>Nenhum lembrete ainda</div>
                  <div style={{ fontSize:13, opacity:.65 }}>Crie um e o Uniko te avisa no horário!</div>
                </div>
              : <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:720, margin:'0 auto' }}>
                  {lembretes.map(l => (
                    <Card key={l.id} style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14, opacity:l.active?1:0.55 }} elevated>
                      <button onClick={() => toggleL(l.id, l.active)} style={{ width:38, height:22, borderRadius:11, border:'none', cursor:'pointer', outline:'none', flexShrink:0, background:l.active?T.gold:'rgba(0,0,0,0.15)', position:'relative', transition:'background .2s' }}>
                        <div style={{ position:'absolute', top:3, width:16, height:16, borderRadius:'50%', background:'white', transition:'left .2s', left:l.active?19:3, boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                      </button>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.title}</div>
                        {l.message&&l.message!==l.title&&<div style={{ fontSize:12, color:T.textS, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.message}</div>}
                        <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                          {l.time&&<span style={{ fontSize:11, color:T.textD }}>⏰ {l.time}</span>}
                          {l.date&&<span style={{ fontSize:11, color:T.textD }}>📅 {l.date}</span>}
                          {l.repeat&&l.repeat!=='never'&&<span style={{ fontSize:11, color:T.gold }}>↻ {repeatLabel[l.repeat]||l.repeat}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button onClick={() => openEditL(l)} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${T.border}`, background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:T.textS, outline:'none' }}>
                          <Ico d={<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>}/>
                        </button>
                        <button onClick={() => delL(l.id)} style={{ width:30, height:30, borderRadius:8, border:'1px solid rgba(192,64,80,0.25)', background:'rgba(192,64,80,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#C04050', outline:'none' }}>
                          <Ico d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></>} size={11}/>
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
          }
        </>
      )}

      {/* ══════════════ ABA ANOTAÇÕES ══════════════ */}
      {activeTab === 'anotacoes' && (
        <>
          {nLoading
            ? <div style={{ textAlign:'center', padding:60, color:T.textT }}>
                <div style={{ width:24, height:24, borderRadius:'50%', border:`2px solid ${T.gold}`, borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 10px' }}/>
                Carregando...
              </div>
            : notas.length === 0
              ? <div style={{ textAlign:'center', padding:'60px 0', color:T.textT }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.1" strokeLinecap="round" style={{ display:'block', margin:'0 auto 14px', opacity:.4 }}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <div style={{ fontSize:15, marginBottom:6 }}>Nenhuma anotação ainda</div>
                  <div style={{ fontSize:13, opacity:.65 }}>Guarde lembretes importantes, alertas ou instruções.</div>
                </div>
              : <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:720, margin:'0 auto' }}>
                  {notas.map(n => {
                    const cs = corStyle(n.time || 'default');
                    const expanded = nExpanded.has(n.id);
                    const longBody = (n.message || '').length > 160;
                    return (
                      <div key={n.id} style={{
                        borderRadius:14, padding:'18px 20px',
                        background: cs.bg || (T.surface || 'white'),
                        border:`1.5px solid ${cs.border || T.border}`,
                        boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
                        transition:'box-shadow .15s',
                      }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                          {/* dot de cor */}
                          <div style={{ width:10, height:10, borderRadius:'50%', background:cs.dot, flexShrink:0, marginTop:5 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            {n.title && n.title !== 'Anotação' && (
                              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:6 }}>{n.title}</div>
                            )}
                            <div style={{
                              fontSize:13.5, color:T.textS, lineHeight:1.65,
                              whiteSpace:'pre-wrap', wordBreak:'break-word',
                              maxHeight: expanded ? 'none' : '5em',
                              overflow: expanded ? 'visible' : 'hidden',
                            }}>{n.message}</div>
                            {longBody && (
                              <button onClick={() => toggleExpand(n.id)} style={{ background:'none', border:'none', cursor:'pointer', color:T.gold, fontSize:12, fontFamily:'var(--font-body)', padding:'4px 0 0', fontWeight:600 }}>
                                {expanded ? '▲ Ver menos' : '▼ Ver mais'}
                              </button>
                            )}
                            <div style={{ fontSize:11, color:T.textD, marginTop:8 }}>
                              {fmtDate(n.created_at)}
                              {n.updated_at && n.updated_at !== n.created_at && ' · editado'}
                            </div>
                          </div>
                          {/* ações */}
                          <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                            <button onClick={() => openEditN(n)} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.border}`, background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:T.textS, outline:'none' }}>
                              <Ico d={<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>} size={11}/>
                            </button>
                            <button onClick={() => delN(n.id)} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(192,64,80,0.25)', background:'rgba(192,64,80,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#C04050', outline:'none' }}>
                              <Ico d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></>} size={10}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
          }
        </>
      )}

      {/* ══════════════ MODAL LEMBRETE ══════════════ */}
      {lModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:T.surface||'white', borderRadius:20, padding:32, width:420, boxShadow:'0 20px 60px rgba(0,0,0,0.25)', border:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:'var(--font-brand)', fontSize:17, fontWeight:700, color:T.text, marginBottom:20 }}>
              {lEdit ? 'Editar Lembrete' : 'Novo Lembrete'}
            </div>
            {[{key:'title',label:'Título',ph:'Ex: Enviar relatório'},{key:'message',label:'Mensagem (opcional)',ph:'Detalhes...'}].map(f=>(
              <div key={f.key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:4 }}>{f.label}</div>
                <input value={lForm[f.key]||''} onChange={e=>setLForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, background:T.surface||'white', fontSize:13, color:T.text, outline:'none', boxSizing:'border-box', fontFamily:'var(--font-body)' }}/>
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:4 }}>Data</div>
                <input type="date" value={lForm.date||''} onChange={e=>setLForm(p=>({...p,date:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, background:T.surface||'white', fontSize:13, color:T.text, outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }}/>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:4 }}>Horário</div>
                <input type="time" value={lForm.time||''} onChange={e=>setLForm(p=>({...p,time:e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, background:T.surface||'white', fontSize:13, color:T.text, outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:4 }}>Repetição</div>
              <select value={lForm.repeat||'never'} onChange={e=>setLForm(p=>({...p,repeat:e.target.value}))}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, background:T.surface||'white', fontSize:13, color:T.text, outline:'none', fontFamily:'var(--font-body)' }}>
                <option value="never">Sem repetição</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
            <div style={{ fontSize:11, color:T.blue||'#1A6FB5', background:'rgba(26,111,181,0.06)', border:'1px solid rgba(26,111,181,0.2)', borderRadius:8, padding:'8px 12px', marginBottom:14 }}>
              🔔 O Uniko aparece no canto esquerdo no horário programado.
            </div>
            {lMsg&&<div style={{ fontSize:12, color:lMsg.startsWith('Erro')?'#C04050':'#16a34a', marginBottom:12, padding:'7px 12px', borderRadius:7 }}>{lMsg}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setLModal(false)} style={{ flex:1, padding:'11px', borderRadius:10, border:`1px solid ${T.border}`, background:'transparent', cursor:'pointer', fontSize:13, color:T.textS, fontFamily:'var(--font-body)', outline:'none' }}>Cancelar</button>
              <button onClick={saveL} disabled={lSaving} style={{ flex:1, padding:'11px', borderRadius:10, border:'none', cursor:lSaving?'wait':'pointer', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:'white', fontWeight:700, fontSize:13, fontFamily:'var(--font-body)', outline:'none' }}>{lSaving?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL ANOTAÇÃO ══════════════ */}
      {nModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:T.surface||'white', borderRadius:20, padding:32, width:460, boxShadow:'0 20px 60px rgba(0,0,0,0.25)', border:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:'var(--font-brand)', fontSize:17, fontWeight:700, color:T.text, marginBottom:20 }}>
              {nEdit ? 'Editar Anotação' : 'Nova Anotação'}
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:4 }}>Título (opcional)</div>
              <input value={nForm.title} onChange={e=>setNForm(p=>({...p,title:e.target.value}))} placeholder="Ex: Atenção ao faturar Canindé"
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, background:T.surface||'white', fontSize:13, color:T.text, outline:'none', boxSizing:'border-box', fontFamily:'var(--font-body)' }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:4 }}>Anotação *</div>
              <textarea value={nForm.message} onChange={e=>setNForm(p=>({...p,message:e.target.value}))}
                placeholder="Escreva aqui sua anotação..."
                rows={5}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${T.border}`, background:T.surface||'white', fontSize:13, color:T.text, outline:'none', boxSizing:'border-box', fontFamily:'var(--font-body)', resize:'vertical', lineHeight:1.6 }}/>
            </div>
            {/* seletor de cor */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.textS, marginBottom:8 }}>Cor de destaque</div>
              <div style={{ display:'flex', gap:8 }}>
                {NOTA_CORES.map(c => {
                  const cs = corStyle(c.id);
                  const sel = nForm.color === c.id;
                  return (
                    <button key={c.id} onClick={() => setNForm(p=>({...p,color:c.id}))} title={c.label} style={{
                      width:26, height:26, borderRadius:'50%', border:`2px solid ${sel ? cs.dot : 'transparent'}`,
                      background: c.id === 'default' ? T.surfaceSub||'rgba(0,0,0,0.07)' : cs.dot,
                      cursor:'pointer', outline: sel ? `2px solid ${cs.dot}` : 'none',
                      outlineOffset:2, transition:'transform .1s',
                      transform: sel ? 'scale(1.2)' : 'scale(1)',
                    }}/>
                  );
                })}
              </div>
            </div>
            {nMsg&&<div style={{ fontSize:12, color:'#C04050', marginBottom:10, padding:'7px 12px', borderRadius:7, background:'rgba(192,64,80,0.06)' }}>{nMsg}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setNModal(false)} style={{ flex:1, padding:'11px', borderRadius:10, border:`1px solid ${T.border}`, background:'transparent', cursor:'pointer', fontSize:13, color:T.textS, fontFamily:'var(--font-body)', outline:'none' }}>Cancelar</button>
              <button onClick={saveN} disabled={nSaving} style={{ flex:1, padding:'11px', borderRadius:10, border:'none', cursor:nSaving?'wait':'pointer', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:'white', fontWeight:700, fontSize:13, fontFamily:'var(--font-body)', outline:'none' }}>{nSaving?'Salvando...':'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CentralLembretes;
