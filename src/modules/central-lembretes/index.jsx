import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { Card } from '../../shared/components';

const CentralLembretes = ({ onBack, authUser }) => {
  const [lembretes, setLembretes]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [form, setForm]             = useState({ title:'', message:'', time:'', date:'', repeat:'never', active:true });

  const userName = authUser?.name || 'Colaborador';

  const load = async () => {
    setLoading(true);
    const { data } = await _supabase.from('reminders')
      .select('*').eq('type','lembrete').eq('created_by', userName)
      .order('created_at', { ascending: false });
    setLembretes(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ title:'', message:'', time:'', date:'', repeat:'never', active:true });
    setEditItem(null); setMsg(''); setShowModal(true);
  };

  const openEdit = (l) => {
    setForm({ title:l.title||'', message:l.message||'', time:l.time||'', date:l.date||'', repeat:l.repeat||'never', active:l.active });
    setEditItem(l); setMsg(''); setShowModal(true);
  };

  const save = async () => {
    if (!form.title.trim()) { setMsg('Título obrigatório'); return; }
    setSaving(true); setMsg('');
    const payload = { ...form, type:'lembrete', created_by: userName, updated_at: new Date().toISOString() };
    if (editItem) {
      const { error } = await _supabase.from('reminders').update(payload).eq('id', editItem.id);
      if (error) { setMsg('Erro: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await _supabase.from('reminders').insert({ ...payload, created_at: new Date().toISOString() });
      if (error) { setMsg('Erro: ' + error.message); setSaving(false); return; }
    }
    await load();
    setShowModal(false);
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Remover este lembrete?')) return;
    await _supabase.from('reminders').delete().eq('id', id);
    await load();
  };

  const toggle = async (id, active) => {
    await _supabase.from('reminders').update({ active: !active }).eq('id', id);
    await load();
  };

  const repeatLabel = { never:'Sem repetição', daily:'Diário', weekly:'Semanal', monthly:'Mensal' };

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const cardBg = isDark ? T.surface : 'white';

  return (
    <div style={{minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)',padding:'32px'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:32}}>
        <button onClick={onBack}
          style={{width:36,height:36,borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <img src="/UnikoQuadrado.png" alt="Uniko" style={{width:40,height:40,borderRadius:10,objectFit:'cover'}}/>
        <div>
          <div style={{fontFamily:'var(--font-brand)',fontSize:22,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Central Lembretes</div>
          <div style={{fontSize:13,color:T.textT,marginTop:2}}>O Uniko te lembra no horário certo · {userName}</div>
        </div>
        <div style={{flex:1}}/>
        <button onClick={openNew}
          style={{display:'flex',alignItems:'center',gap:7,padding:'10px 20px',borderRadius:12,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.gold}44`}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Lembrete
        </button>
      </div>

      {/* Lista */}
      {loading
        ? <div style={{textAlign:'center',padding:60,color:T.textT}}>
            <div style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 10px'}}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Carregando...
          </div>
        : lembretes.length === 0
          ? <div style={{textAlign:'center',padding:'80px 0',color:T.textT}}>
              <img src="/Uniko.png" alt="Uniko" style={{width:80,opacity:.4,marginBottom:16,display:'block',margin:'0 auto 16px'}}/>
              <div style={{fontSize:15,marginBottom:6}}>Nenhum lembrete ainda</div>
              <div style={{fontSize:13,opacity:.7}}>Crie um lembrete e o Uniko vai te avisar no horário!</div>
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:720,margin:'0 auto'}}>
              {lembretes.map(l=>(
                <Card key={l.id} style={{padding:'16px 20px',background:cardBg,display:'flex',alignItems:'center',gap:14,opacity:l.active?1:0.55}} elevated>
                  {/* toggle ativo */}
                  <button onClick={()=>toggle(l.id,l.active)}
                    style={{width:38,height:22,borderRadius:11,border:'none',cursor:'pointer',outline:'none',flexShrink:0,
                      background:l.active?T.gold:'rgba(0,0,0,0.15)',position:'relative',transition:'background .2s'}}>
                    <div style={{position:'absolute',top:3,width:16,height:16,borderRadius:'50%',background:'white',
                      transition:'left .2s',left:l.active?19:3,boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
                  </button>
                  {/* conteúdo */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                    {l.message&&l.message!==l.title&&<div style={{fontSize:12,color:T.textS,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.message}</div>}
                    <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                      {l.time&&<span style={{fontSize:11,color:T.textD}}>⏰ {l.time}</span>}
                      {l.date&&<span style={{fontSize:11,color:T.textD}}>📅 {l.date}</span>}
                      {l.repeat&&l.repeat!=='never'&&<span style={{fontSize:11,color:T.gold}}>↻ {repeatLabel[l.repeat]||l.repeat}</span>}
                    </div>
                  </div>
                  {/* ações */}
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button onClick={()=>openEdit(l)} title="Editar"
                      style={{width:30,height:30,borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={()=>del(l.id)} title="Remover"
                      style={{width:30,height:30,borderRadius:8,border:'1px solid rgba(192,64,80,0.25)',background:'rgba(192,64,80,0.05)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#C04050',outline:'none'}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
      }

      {/* Modal */}
      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
          <div style={{background:cardBg,borderRadius:20,padding:32,width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
            <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:20}}>
              {editItem?'Editar Lembrete':'Novo Lembrete'}
            </div>

            {[
              {key:'title',label:'Título',placeholder:'Ex: Enviar relatório'},
              {key:'message',label:'Mensagem (opcional)',placeholder:'Detalhes do lembrete...'},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>{f.label}</div>
                <input value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
              </div>
            ))}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Data</div>
                <input type="date" value={form.date||''} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                  style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Horário</div>
                <input type="time" value={form.time||''} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
                  style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
              </div>
            </div>

            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Repetição</div>
              <select value={form.repeat||'never'} onChange={e=>setForm(p=>({...p,repeat:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                <option value="never">Sem repetição</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>

            <div style={{fontSize:11,color:'#1A6FB5',background:'rgba(26,111,181,0.06)',border:'1px solid rgba(26,111,181,0.2)',borderRadius:8,padding:'8px 12px',marginBottom:16}}>
              🎵 O Uniko vai aparecer no seu canto inferior esquerdo no horário programado.
            </div>

            {msg&&<div style={{fontSize:12,color:msg.startsWith('Erro')?'#C04050':'#16a34a',marginBottom:12,padding:'7px 12px',borderRadius:7,background:msg.startsWith('Erro')?'rgba(192,64,80,0.06)':'rgba(34,197,94,0.08)'}}>{msg}</div>}

            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowModal(false)}
                style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:saving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                {saving?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CentralLembretes;
