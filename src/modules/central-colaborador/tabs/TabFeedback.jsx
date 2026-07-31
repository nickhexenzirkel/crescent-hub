import React, { useState } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider, SHead } from '../../../shared/components';

const Ico = ({d, size=20, stroke='currentColor'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const CATS = [
  { id:'Sugestão',
    iconD:<><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></>,
    desc:'Ideias para melhorar' },
  { id:'Elogio',
    iconD:<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    desc:'Reconheça algo positivo' },
  { id:'Crítica',
    iconD:<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    desc:'Aponte algo a melhorar' },
  { id:'Reportar Problema',
    iconD:<><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></>,
    desc:'Relate um problema técnico ou operacional' },
];

const CAT_COLOR = {
  'Sugestão':          '#2A82D2',
  'Elogio':            '#28A870',
  'Crítica':           '#D89030',
  'Reportar Problema': '#C04050',
};

const TabFeedback = () => {
  const [cat,      setCat]      = useState('Sugestão');
  const [msg,      setMsg]      = useState('');
  const [anon,     setAnon]     = useState(false);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [err,      setErr]      = useState('');

  const color = CAT_COLOR[cat] || T.gold;

  const send = async () => {
    if (!msg.trim()) { setErr('Escreva uma mensagem antes de enviar.'); return; }
    setSending(true); setErr('');
    try {
      const { error } = await _supabase.from('feedbacks').insert({
        // Sempre grava quem enviou de verdade — mesmo quando é "anônimo".
        // O anonimato é só visual: a aba Feedback do dashboard RH esconde o
        // nome (mostra "Colaborador Anônimo") quando `anonymous` é true, mas
        // quem for direto no Supabase consegue ver o employee_name aqui.
        employee_name: USER.name,
        category:      cat,
        message:       msg.trim(),
        anonymous:     anon,
        read:          false,
        created_at:    new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      setSent(true);
    } catch (e) {
      setErr('Erro ao enviar: ' + (e.message || 'tente novamente.'));
    }
    setSending(false);
  };

  if (sent) return (
    <div className="fi" style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:420, gap:20, fontFamily:'var(--font-body)' }}>
      <div style={{ width:72, height:72, borderRadius:'50%',
        background:`${CAT_COLOR[cat]}15`, border:`2px solid ${CAT_COLOR[cat]}33`,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Ico d={CATS.find(c => c.id === cat)?.iconD} size={34} stroke={CAT_COLOR[cat]}/>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:700, color:T.text, marginBottom:6 }}>Feedback enviado!</div>
        <div style={{ fontSize:14, color:T.textS, lineHeight:1.6 }}>
          {anon
            ? 'Seu feedback foi registrado anonimamente.'
            : 'Sua contribuição foi registrada. Obrigado!'}
        </div>
      </div>
      <div style={{ width:220 }}><StarDivider/></div>
      <button onClick={() => { setMsg(''); setSent(false); setAnon(false); }}
        style={{ padding:'10px 28px', borderRadius:10, border:`1.5px solid ${T.border}`,
          background:'transparent', cursor:'pointer', fontFamily:'var(--font-body)',
          fontSize:13, fontWeight:600, color:T.textS }}>
        Enviar outro feedback
      </button>
    </div>
  );

  return (
    <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
      <SHead sub="Sugestões, elogios, críticas e problemas">Feedback</SHead>

      {/* Seleção de categoria */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:18 }}>
        {CATS.map(c => {
          const active = cat === c.id;
          const col    = CAT_COLOR[c.id];
          return (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              padding:'14px 16px', borderRadius:13, cursor:'pointer', textAlign:'left',
              fontFamily:'var(--font-body)', border:`2px solid ${active ? col+'66' : T.border}`,
              background: active ? `${col}10` : 'transparent',
              transition:'all .15s', outline:'none',
            }}>
              <div style={{ marginBottom:8 }}><Ico d={c.iconD} size={22} stroke={active ? col : T.textS}/></div>
              <div style={{ fontSize:13, fontWeight:700, color: active ? col : T.text, marginBottom:2 }}>{c.id}</div>
              <div style={{ fontSize:11, color:T.textT, lineHeight:1.4 }}>{c.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Formulário */}
      <Card style={{ padding:'24px 26px' }} elevated>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:`${color}15`,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Ico d={CATS.find(c => c.id === cat)?.iconD} size={18} stroke={color}/>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{cat}</div>
            <div style={{ fontSize:12, color:T.textT }}>{CATS.find(c => c.id === cat)?.desc}</div>
          </div>
        </div>

        <StarDivider my={12}/>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:600, color:T.textD,
            textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:8 }}>
            Mensagem
          </label>
          <textarea value={msg} onChange={e => { setMsg(e.target.value); setErr(''); }}
            placeholder="Escreva aqui sua mensagem com detalhes..."
            rows={5}
            style={{ width:'100%', background: T.dark ? (T.surfaceSub||'rgba(255,255,255,0.04)') : 'rgba(0,0,0,0.02)',
              border:`1.5px solid ${err ? '#C04050' : T.border}`, borderRadius:11, padding:'14px',
              color:T.text, fontFamily:'var(--font-body)', fontSize:14,
              outline:'none', resize:'vertical', lineHeight:1.65,
              transition:'border-color .15s', boxSizing:'border-box' }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = err ? '#C04050' : T.border}/>
          {err && <div style={{ marginTop:6, fontSize:12, color:'#C04050' }}>{err}</div>}
        </div>

        {/* Enviar anonimamente */}
        <button onClick={() => setAnon(a => !a)} style={{
          display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
          borderRadius:10, border:`1.5px solid ${anon ? T.goldLine+'66' : T.border}`,
          background: anon ? T.goldGl : 'transparent',
          cursor:'pointer', marginBottom:18, width:'100%', textAlign:'left',
          fontFamily:'var(--font-body)', transition:'all .15s', outline:'none',
        }}>
          {/* toggle visual */}
          <div style={{ width:36, height:20, borderRadius:10,
            background: anon ? T.gold : T.textD,
            position:'relative', transition:'background .2s', flexShrink:0 }}>
            <div style={{ position:'absolute', top:3, left: anon ? 18 : 3,
              width:14, height:14, borderRadius:'50%', background:'white',
              transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }}/>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color: anon ? T.gold : T.text }}>
              Enviar anonimamente
            </div>
            <div style={{ fontSize:11, color:T.textT, marginTop:1 }}>
              {anon ? 'Seu nome não será revelado ao RH' : 'Seu nome será visível para o RH'}
            </div>
          </div>
          <div style={{ marginLeft:'auto', flexShrink:0 }}>
            <Ico size={15} stroke={anon ? T.gold : T.textD} d={
              anon
                ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></>
                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
            }/>
          </div>
        </button>

        <button onClick={send} disabled={sending || !msg.trim()}
          style={{ width:'100%', padding:'13px', borderRadius:11, border:'none',
            cursor: (sending || !msg.trim()) ? 'not-allowed' : 'pointer',
            background: (sending || !msg.trim())
              ? T.border
              : `linear-gradient(135deg,${color},${color}cc)`,
            color: (sending || !msg.trim()) ? T.textD : 'white',
            fontWeight:700, fontSize:14, fontFamily:'var(--font-body)',
            boxShadow: (!sending && msg.trim()) ? `0 4px 16px ${color}44` : 'none',
            transition:'all .15s' }}>
          {sending ? 'Enviando...' : `Enviar ${cat}`}
        </button>
      </Card>
    </div>
  );
};

export { TabFeedback };
