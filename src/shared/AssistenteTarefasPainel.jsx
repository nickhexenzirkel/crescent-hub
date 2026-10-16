import React, { useState, useEffect, useCallback } from 'react';
import { T } from '../contexts/theme';
import { supabase } from '../contexts/user';
import { useTarefasHoje } from './menuWidgets';
import { criarTarefa, hojeIso, addDias } from './listaTarefas';

/* Aba "Tarefas" do assistente UNIKO: tudo por botões, sem precisar digitar frases.
   Tarefas de hoje (marcar / adicionar) e lembretes (criar / apagar). */
const COR = '#30B0C7';
const btn = (extra) => ({ border:'none', borderRadius:10, cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:700, fontSize:12, ...extra });
const campo = { padding:'8px 10px', borderRadius:10, border:`1px solid ${T.border || 'rgba(0,0,0,.15)'}`, background:T.surfaceSub || 'rgba(0,0,0,0.03)', color:T.text, fontSize:13, outline:'none', fontFamily:'var(--font-body)', minWidth:0 };

export default function AssistenteTarefasPainel({ authUser, accent }) {
  const nome = authUser?.name;
  const t = useTarefasHoje(authUser);
  const [aba, setAba] = useState('tarefas');
  const [titulo, setTitulo] = useState('');
  const [quando, setQuando] = useState('hoje');
  const [msg, setMsg] = useState('');
  const [lembs, setLembs] = useState([]);
  const [texto, setTexto] = useState('');
  const [hora, setHora] = useState('');

  const carregarLembs = useCallback(async () => {
    if (!nome) return;
    const { data } = await supabase.from('reminders').select('*').in('type', ['personal', 'lembrete']).eq('created_by', nome).eq('active', true)
      .or('time.is.null,time.not.like.nota:%').order('created_at', { ascending: false });
    setLembs(data || []);
  }, [nome]);
  useEffect(() => { carregarLembs(); }, [carregarLembs]);

  const aviso = (s) => { setMsg(s); setTimeout(() => setMsg(''), 2500); };

  const addTarefa = async () => {
    if (!titulo.trim()) return;
    const ok = await criarTarefa(nome, quando === 'diaria' ? { titulo, freq:'diaria' } : { titulo, freq:'unica', data: quando === 'amanha' ? addDias(hojeIso(), 1) : hojeIso() });
    if (ok) { setTitulo(''); aviso('Tarefa adicionada ✅'); } else aviso('Não consegui salvar. Tente de novo.');
  };

  const addLemb = async () => {
    if (!texto.trim() || !hora) { aviso('Informe o texto e o horário.'); return; }
    const agora = new Date().toISOString();
    const { error } = await supabase.from('reminders').insert({ title:'Lembrete', message:texto.trim(), time:hora + ':00', date:hojeIso(), repeat:'never', active:true, type:'personal', created_by:nome, created_at:agora, updated_at:agora });
    if (error) { aviso('Não consegui salvar o lembrete.'); return; }
    setTexto(''); setHora(''); aviso('Lembrete criado ⏰'); carregarLembs();
  };
  const apagarLemb = async (id) => { await supabase.from('reminders').delete().eq('id', id); carregarLembs(); };

  const pend = t.itens.filter((x) => !x.feita);
  const feitas = t.itens.filter((x) => x.feita);

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', gap:6, padding:'10px 12px 0' }}>
        {[['tarefas', '✅ Tarefas de hoje'], ['lembretes', '⏰ Lembretes']].map(([id, l]) => (
          <button key={id} onClick={() => setAba(id)} style={btn({ flex:1, padding:'7px 0', background: aba === id ? accent : (T.surfaceSub || 'rgba(0,0,0,.05)'), color: aba === id ? (T.dark ? '#3a2a05' : '#fff') : T.textS })}>{l}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
        {aba === 'tarefas' && (<>
          {t.carregando ? <div style={{ fontSize:12, color:T.textT }}>Carregando…</div>
            : !t.itens.length ? <div style={{ fontSize:12, color:T.textS }}>Nenhuma tarefa para hoje. Adicione abaixo 👇</div>
            : [...pend, ...feitas].map((it) => (
              <div key={it.tipo + it.id} onClick={() => t.marcar(it)} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:10, cursor:'pointer', border:`1px solid ${T.border}`, background:T.surfaceSub || 'transparent', opacity: it.feita ? .55 : 1 }}>
                <span style={{ width:16, height:16, borderRadius:5, flexShrink:0, border:`2px solid ${COR}`, background: it.feita ? COR : 'transparent', color:'#fff', fontSize:11, lineHeight:'12px', textAlign:'center' }}>{it.feita ? '✓' : ''}</span>
                <span style={{ fontSize:13, color:T.text, fontWeight:600, textDecoration: it.feita ? 'line-through' : 'none' }}>{it.titulo}</span>
              </div>
            ))}
        </>)}
        {aba === 'lembretes' && (!lembs.length
          ? <div style={{ fontSize:12, color:T.textS }}>Nenhum lembrete ativo. Crie um abaixo 👇</div>
          : lembs.map((r) => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:10, border:`1px solid ${T.border}`, background:T.surfaceSub || 'transparent' }}>
              <span style={{ fontSize:12, fontWeight:800, color:COR, flexShrink:0 }}>{String(r.time || '').slice(0, 5)}</span>
              <span style={{ flex:1, fontSize:13, color:T.text, fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.message}</span>
              <button onClick={() => apagarLemb(r.id)} title="Apagar" style={btn({ background:'none', color:T.textT, fontSize:14, padding:4 })}>✕</button>
            </div>
          )))}
      </div>
      {msg && <div style={{ padding:'0 12px 4px', fontSize:12, color:T.textS, fontWeight:600 }}>{msg}</div>}
      <div style={{ padding:10, borderTop:`1px solid ${T.border || 'rgba(0,0,0,.08)'}`, display:'flex', flexDirection:'column', gap:6 }}>
        {aba === 'tarefas' ? (<>
          <div style={{ display:'flex', gap:6 }}>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTarefa(); }} placeholder="Nova tarefa…" style={{ ...campo, flex:1 }}/>
            <button onClick={addTarefa} style={btn({ padding:'0 14px', background:accent, color:(T.dark ? '#3a2a05' : '#fff') })}>Adicionar</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['diaria', 'Todo dia']].map(([id, l]) => (
              <button key={id} onClick={() => setQuando(id)} style={btn({ flex:1, padding:'5px 0', background: quando === id ? COR : (T.surfaceSub || 'rgba(0,0,0,.05)'), color: quando === id ? '#fff' : T.textS })}>{l}</button>
            ))}
          </div>
        </>) : (
          <div style={{ display:'flex', gap:6 }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Do que lembrar?" style={{ ...campo, flex:1 }}/>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...campo, width:92 }}/>
            <button onClick={addLemb} style={btn({ padding:'0 12px', background:accent, color:(T.dark ? '#3a2a05' : '#fff') })}>Criar</button>
          </div>
        )}
      </div>
    </div>
  );
}
