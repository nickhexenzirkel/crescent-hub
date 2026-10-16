import React, { useState } from 'react';
import { T } from '../contexts/theme';
import { useTarefasHoje, useTarefasFixadas } from './menuWidgets';

/* "Tarefas de hoje" fixa na tela, em qualquer módulo. Liga/desliga pelo alfinete
   do widget no menu (ou pelo X daqui). Minimiza pra uma bolinha com o contador. */
const COR = '#30B0C7';
const linha = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };

export default function TarefasFixas({ authUser }) {
  const [fixada, alternar] = useTarefasFixadas();
  if (!fixada || !authUser?.name) return null;
  return <Painel authUser={authUser} desafixar={() => alternar(false)} />;
}

function Painel({ authUser, desafixar }) {
  const t = useTarefasHoje(authUser);
  const [min, setMin] = useState(() => { try { return localStorage.getItem('uniko_tarefas_fixas_min') === '1'; } catch { return false; } });
  const trocar = () => setMin((m) => { try { localStorage.setItem('uniko_tarefas_fixas_min', m ? '0' : '1'); } catch {} return !m; });
  const pend = t.itens.filter((x) => !x.feita);
  const n = pend.length;
  const base = { position:'fixed', right:14, bottom:86, zIndex:9000, fontFamily:'inherit' };

  if (min) return (
    <button onClick={trocar} title="Tarefas de hoje" style={{ ...base, width:44, height:44, borderRadius:22, border:'none', cursor:'pointer',
      background:COR, color:'#fff', fontWeight:800, fontSize:15, boxShadow:'0 6px 20px rgba(0,0,0,.25)' }}>{t.carregando ? '…' : n}</button>
  );
  return (
    <div style={{ ...base, width:260, maxWidth:'calc(100vw - 28px)', borderRadius:16, padding:'10px 12px', boxSizing:'border-box',
      background:T.surface || '#fff', border:`1px solid ${T.border}`, boxShadow:'0 10px 30px rgba(0,0,0,.22)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <span style={{ width:8, height:8, borderRadius:4, background:COR, flexShrink:0 }}/>
        <span style={{ flex:1, fontSize:13, fontWeight:700, color:T.text }}>
          Tarefas de hoje{!t.carregando && n > 0 ? ` · ${n}` : ''}
        </span>
        <button onClick={trocar} title="Minimizar" style={{ border:'none', background:'none', cursor:'pointer', color:T.textT, fontSize:16, lineHeight:1 }}>–</button>
        <button onClick={desafixar} title="Desafixar" style={{ border:'none', background:'none', cursor:'pointer', color:T.textT, fontSize:14, lineHeight:1 }}>✕</button>
      </div>
      {t.carregando ? <div style={{ fontSize:12, color:T.textT }}>Carregando…</div>
        : !n ? <div style={{ fontSize:12, color:T.textS }}>{t.total ? 'Tudo feito hoje! 🎉' : 'Nada para hoje'}</div>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:'40vh', overflowY:'auto' }}>
            {pend.map((it) => (
              <div key={it.tipo + it.id} onClick={() => t.marcar(it)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:10, cursor:'pointer',
                  border:`1px solid ${T.border}`, background:T.surfaceSub || 'transparent' }}>
                <span style={{ width:14, height:14, borderRadius:4, flexShrink:0, border:`2px solid ${COR}` }}/>
                <span style={{ fontSize:12, color:T.text, fontWeight:600, ...linha }}>{it.titulo}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
