// Dashboard RH → aba "Painéis".
// Liga/desliga, pra TODOS os usuários, os cards do menu de módulos e o
// Assistente UNIKO. O estado fica na tabela `settings` (ver shared/paineisConfig.js)
// e cada mudança grava na hora.
import { useState } from 'react';
import { T } from '../../contexts/theme';
import { PAINEIS, savePaineis, usePaineisOcultos } from '../../shared/paineisConfig';

const Chave = ({ ligado, onClick, disabled, label }) => (
  <button onClick={onClick} disabled={disabled} role="switch" aria-checked={ligado} aria-label={label}
    style={{ width:44, height:26, borderRadius:13, border:'none', padding:3, flexShrink:0, cursor: disabled ? 'wait' : 'pointer',
      background: ligado ? '#1A9C70' : T.border, transition:'background .2s', display:'flex', alignItems:'center',
      justifyContent: ligado ? 'flex-end' : 'flex-start', opacity: disabled ? .6 : 1 }}>
    <span style={{ width:20, height:20, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/>
  </button>
);

const PaineisTab = ({ cardBg }) => {
  const ocultos = usePaineisOcultos();
  const [salvando, setSalvando] = useState(null);
  const [msg, setMsg] = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2800); };
  const alternar = async (id) => {
    setSalvando(id);
    try { await savePaineis({ ...ocultos, [id]: !ocultos[id] }); }
    catch { flash('Não consegui salvar. Tente de novo.'); }
    setSalvando(null);
  };

  const total = PAINEIS.reduce((n, g) => n + g.itens.length, 0);
  const desligados = Object.values(ocultos).filter(Boolean).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, maxWidth:760 }}>
      <div>
        <div style={{ fontSize:18, fontWeight:700, color:T.text }}>Painéis</div>
        <div style={{ fontSize:13, color:T.textT, marginTop:4, lineHeight:1.5 }}>
          Ligue ou desligue os cards do Uniko para todos os usuários. A mudança vale na hora, a cada vez que o menu é aberto.
          Os cards de Check-in, Banco de Horas, Ponto e Comunicados continuam respeitando também as permissões por cargo.
        </div>
        <div style={{ fontSize:12.5, color:T.textS, marginTop:6 }}>{total - desligados} de {total} ligados</div>
        {msg && <div style={{ fontSize:12.5, color:T.danger, marginTop:6 }}>{msg}</div>}
      </div>

      {PAINEIS.map(g => (
        <div key={g.grupo}>
          <div style={{ fontSize:12, fontWeight:700, color:T.textT, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>{g.grupo}</div>
          <div style={{ background: cardBg || T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:'hidden' }}>
            {g.itens.map((p, k) => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                borderTop: k ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:600, color: ocultos[p.id] ? T.textT : T.text }}>{p.label}</div>
                  <div style={{ fontSize:12.5, color:T.textT, marginTop:2 }}>{p.desc}</div>
                </div>
                <span style={{ fontSize:12, color:T.textT }}>{ocultos[p.id] ? 'Desligado' : 'Ligado'}</span>
                <Chave ligado={!ocultos[p.id]} onClick={() => alternar(p.id)} disabled={salvando === p.id} label={p.label}/>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PaineisTab;
