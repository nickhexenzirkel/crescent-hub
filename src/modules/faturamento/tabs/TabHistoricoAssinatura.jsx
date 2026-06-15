import { useState, useEffect, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { StellarHero } from '../StellarHero';
import { loadAssinaturas } from '../assinaturaDb';

/* CPF "12345678900" → "123.456.789-00" (quando for o caso) */
const fmtLogin = (s) => {
  const n = (s || '').replace(/\D/g, '');
  if (n.length === 11) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  return s || '—';
};

const fmtData = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
};
const fmtHora = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
  catch { return '—'; }
};

export const TabHistoricoAssinatura = () => {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const carregar = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await loadAssinaturas()); }
    catch (e) { setError('Não foi possível carregar o histórico: ' + (e?.message || 'erro')); }
    finally { setLoading(false); }
  }, []);

  // carga inicial — setState só após o await (sem render em cascata)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try { const d = await loadAssinaturas(); if (!cancel) setRows(d); }
      catch (e) { if (!cancel) setError('Não foi possível carregar o histórico: ' + (e?.message || 'erro')); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, []);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.usuario||'').toLowerCase().includes(q)
        || (r.login||'').toLowerCase().includes(q)
        || (r.arquivo||'').toLowerCase().includes(q);
  });

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      <StellarHero
        compact
        eyebrow="Auditoria · PDF"
        title="Histórico de Assinatura"
        subtitle="Registro de todas as assinaturas automáticas: quem assinou, o login usado e quando."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
          </svg>
        )}
      />

      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,flex:1,minWidth:220}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Buscar por usuário, login ou arquivo..."
            style={{flex:1,border:'none',background:'transparent',outline:'none',fontSize:14,color:T.text,fontFamily:'var(--font-body)'}}/>
        </div>

        <div style={{padding:'6px 14px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10,fontSize:13,color:T.textS}}>
          <strong style={{color:T.text}}>{rows.length}</strong> assinatura{rows.length!==1?'s':''}
        </div>

        <button onClick={carregar}
          style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',color:T.textS,fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Atualizar
        </button>
      </div>

      {error && (
        <div style={{padding:'12px 16px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger,marginBottom:16}}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 18px',background:T.goldGl,borderRadius:10,fontSize:14,color:T.textS}}>
          <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite'}}/>
          Carregando histórico...
        </div>
      ) : (
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:'hidden',boxShadow:T.sh}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)',fontSize:13}}>
              <thead>
                <tr style={{background:T.goldGl,borderBottom:`1px solid ${T.border}`}}>
                  {['Usuário','Login','Arquivo','Data','Hora'].map(h => (
                    <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:T.textS,letterSpacing:'.05em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}
                    style={{borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'10px 14px',color:T.text,fontWeight:600,whiteSpace:'nowrap'}}>{r.usuario || '—'}</td>
                    <td style={{padding:'10px 14px',color:T.textS,whiteSpace:'nowrap'}}>{fmtLogin(r.login)}</td>
                    <td style={{padding:'10px 14px',color:T.text,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.arquivo}>{r.arquivo || '—'}</td>
                    <td style={{padding:'10px 14px',color:T.textS,whiteSpace:'nowrap'}}>{fmtData(r.assinado_em)}</td>
                    <td style={{padding:'10px 14px',color:T.textS,whiteSpace:'nowrap'}}>{fmtHora(r.assinado_em)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:14}}>
                      {search ? 'Nenhum resultado para a busca' : 'Nenhuma assinatura registrada ainda'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
