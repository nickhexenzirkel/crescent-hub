// Dashboard RH → aba "Configurar Visitante".
// Define o que quem entra sem login ("Entrar como visitante" na landing/tela
// de login — ver shared/visitante.js) consegue acessar: módulo por módulo,
// aba por aba. Estado na tabela `settings` (ver shared/visitanteConfig.js),
// mesmo padrão da aba Painéis — cada clique grava na hora.
import { useState } from 'react';
import { T } from '../../contexts/theme';
import { CATALOGO, useVisitanteConfig, saveVisitanteConfig } from '../../shared/visitanteConfig';

const Chave = ({ ligado, onClick, disabled, label }) => (
  <button onClick={onClick} disabled={disabled} role="switch" aria-checked={ligado} aria-label={label}
    style={{ width:40, height:24, borderRadius:12, border:'none', padding:3, flexShrink:0, cursor: disabled ? 'wait' : 'pointer',
      background: ligado ? '#1A9C70' : T.border, transition:'background .2s', display:'flex', alignItems:'center',
      justifyContent: ligado ? 'flex-end' : 'flex-start', opacity: disabled ? .6 : 1 }}>
    <span style={{ width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/>
  </button>
);

const Checkbox = ({ checked, onClick, disabled, label }) => (
  <label style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 0', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .45 : 1 }}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onClick}
      style={{ width:16, height:16, accentColor: T.gold, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink:0 }}/>
    <span style={{ fontSize:13, color:T.text }}>{label}</span>
  </label>
);

const VisitanteConfigTab = ({ cardBg }) => {
  const cfg = useVisitanteConfig();
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2800); };

  const gravar = async (next) => {
    setSalvando(true);
    try { await saveVisitanteConfig(next); }
    catch { flash('Não consegui salvar. Tente de novo.'); }
    setSalvando(false);
  };

  const alternarModulo = (moduloId) => gravar({ ...cfg, modulos: { ...cfg.modulos, [moduloId]: !cfg.modulos[moduloId] } });
  const alternarAba = (chave, abaId) => {
    const atuais = cfg.abas[chave] || [];
    const proximo = atuais.includes(abaId) ? atuais.filter(id => id !== abaId) : [...atuais, abaId];
    gravar({ ...cfg, abas: { ...cfg.abas, [chave]: proximo } });
  };
  const alternarAcao = (acaoId) => gravar({ ...cfg, acoesMercado: { ...cfg.acoesMercado, [acaoId]: !cfg.acoesMercado[acaoId] } });

  const grupoStyle = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:2 };
  const rotuloGrupo = { fontSize:11.5, fontWeight:700, color:T.textT, letterSpacing:'.05em', textTransform:'uppercase', marginTop:12, marginBottom:4 };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, maxWidth:780 }}>
      <div>
        <div style={{ fontSize:18, fontWeight:700, color:T.text }}>Configurar Visitante</div>
        <div style={{ fontSize:13, color:T.textT, marginTop:4, lineHeight:1.5 }}>
          Define o que quem clica em "Entrar como visitante" (sem cadastro nem login) consegue
          acessar. Cada módulo pode ser ligado por completo ou só em algumas abas — a mudança
          vale na hora, pra qualquer visitante que já esteja usando ou entrar depois.
        </div>
        {msg && <div style={{ fontSize:12.5, color:T.danger, marginTop:6 }}>{msg}</div>}
      </div>

      <div style={{ padding:'12px 16px', borderRadius:12, background:'rgba(192,64,80,0.06)', border:'1px solid rgba(192,64,80,0.2)' }}>
        <div style={{ fontSize:12.5, fontWeight:700, color:T.danger, marginBottom:4 }}>Sempre bloqueados pro visitante</div>
        <div style={{ fontSize:12, color:T.textS, lineHeight:1.6 }}>
          Dashboard RH, Ponto Eletrônico, Uniko Safer, Uniko WhatsApp, Uniko Call, Portal dos
          Credenciados e Prestações de Contas — têm dado real de RH, financeiro ou vigilância e
          não entram aqui, sem exceção.
        </div>
      </div>

      {CATALOGO.map(sec => {
        const ligado = !!cfg.modulos[sec.modulo];
        const temConteudo = sec.abas.length > 0 || sec.acoes?.length || sec.subsecoes?.length;
        return (
          <div key={sec.modulo} style={{ background: cardBg || T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom: temConteudo ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:700, color:T.text }}>{sec.label}</div>
                <div style={{ fontSize:12, color:T.textT, marginTop:1 }}>{ligado ? 'Visitante entra neste módulo' : 'Visitante não entra neste módulo'}</div>
              </div>
              <Chave ligado={ligado} onClick={() => alternarModulo(sec.modulo)} disabled={salvando} label={sec.label}/>
            </div>

            {temConteudo && (
              <div style={{ padding:'10px 18px 14px', opacity: ligado ? 1 : .5 }}>
                {sec.abas.length > 0 && (
                  <div style={grupoStyle}>
                    {sec.abas.map(a => (
                      <Checkbox key={a.id} checked={(cfg.abas[sec.modulo] || []).includes(a.id)}
                        disabled={salvando || !ligado} onClick={() => alternarAba(sec.modulo, a.id)} label={a.label}/>
                    ))}
                  </div>
                )}
                {sec.acoes?.length > 0 && (
                  <>
                    <div style={rotuloGrupo}>Ações</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))', gap:2 }}>
                      {sec.acoes.map(a => (
                        <Checkbox key={a.id} checked={!!cfg.acoesMercado[a.id]}
                          disabled={salvando || !ligado} onClick={() => alternarAcao(a.id)} label={a.label}/>
                      ))}
                    </div>
                  </>
                )}
                {(sec.subsecoes || []).map(sub => (
                  <div key={sub.chave}>
                    <div style={rotuloGrupo}>{sub.label}</div>
                    <div style={grupoStyle}>
                      {sub.abas.map(a => (
                        <Checkbox key={a.id} checked={(cfg.abas[sub.chave] || []).includes(a.id)}
                          disabled={salvando || !ligado} onClick={() => alternarAba(sub.chave, a.id)} label={a.label}/>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VisitanteConfigTab;
