import React, { useState, useEffect, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { getAuthUser } from '../../contexts/user';
import { supabase as callDb } from '../uniko-call/callSupabase';
import { AudioPlayer } from '../uniko-call/index';
import { callMs, totalLabel } from '../uniko-call/callUtils';

/* "Uniko Call" dentro de Minhas Tarefas — ESPELHO só de leitura das ligações do próprio colaborador.
   Lê as mesmas tabelas do Uniko Call (uniko_call_recordings / _contacts) e toca o mesmo áudio do bucket:
   nada é copiado nem regravado. Quem barra as ligações dos outros é o RLS do banco
   (supabase_uniko_call_minhas.sql: só vê a linha cujo attendant_id é o dele). */
const POR_PAGINA = 20;
const dia = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }); };
const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); };

export default function MinhasLigacoes() {
  const eu = getAuthUser();
  const [itens, setItens] = useState([]);
  const [nomes, setNomes] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState({});

  const carregar = useCallback(async () => {
    if (!eu?.id) { setCarregando(false); return; }
    const { data, error } = await callDb.from('uniko_call_recordings')
      .select('id, contact_id, started_at, ended_at, transcript, status, error, consent_given, protocol, audio_url')
      .eq('attendant_id', String(eu.id)).order('started_at', { ascending: false }).limit(500);
    if (error) { setErro('Não consegui carregar suas ligações agora.'); setCarregando(false); return; }
    setErro('');
    setItens(data || []);
    const ids = [...new Set((data || []).map((r) => r.contact_id))];
    if (ids.length) {
      const { data: cs } = await callDb.from('uniko_call_contacts').select('id, name').in('id', ids);
      setNomes(Object.fromEntries((cs || []).map((c) => [c.id, c.name])));
    }
    setCarregando(false);
  }, [eu?.id]);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);

  const q = busca.trim().toLowerCase();
  const filtradas = itens.filter((r) => !q || (nomes[r.contact_id] || '').toLowerCase().includes(q) || (r.transcript || '').toLowerCase().includes(q) || String(r.protocol || '').includes(q));
  const visiveis = filtradas.slice(0, limite);
  const totalMs = itens.reduce((s, r) => s + callMs(r), 0);

  if (carregando) return <div style={{ textAlign:'center', padding:60, color:T.textT }}>Carregando...</div>;
  if (erro) return <div style={{ padding:20, color:T.textS }}>{erro}</div>;

  let ultimoDia = null;
  return (
    <div>
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
        <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA); }} placeholder="Buscar por contato, protocolo ou trecho da conversa…"
          style={{ flex:1, minWidth:220, padding:'9px 12px', borderRadius:10, border:`1px solid ${T.border}`, background:T.surfaceSub, color:T.text, fontSize:13, outline:'none', fontFamily:'var(--font-body)' }}/>
        <span style={{ fontSize:12, color:T.textT }}>{itens.length} {itens.length === 1 ? 'ligação' : 'ligações'}{totalMs ? ` · ${totalLabel(totalMs)}` : ''}</span>
      </div>
      <div style={{ fontSize:11.5, color:T.textT, marginBottom:12 }}>🔒 Só você vê estas ligações — são as que você mesmo atendeu.</div>

      {!visiveis.length
        ? <div style={{ textAlign:'center', padding:50, color:T.textT, fontSize:13 }}>{itens.length ? 'Nada encontrado para essa busca.' : 'Você ainda não tem ligações gravadas.'}</div>
        : visiveis.map((r) => {
          const k = dia(r.started_at); const novoDia = k !== ultimoDia; ultimoDia = k;
          const dur = callMs(r); const semAviso = r.consent_given === false;
          const aberto = !!aberta[r.id]; const txt = r.transcript || '';
          const longo = txt.length > 280;
          return (
            <div key={r.id}>
              {novoDia && <div style={{ fontSize:11, fontWeight:700, color:T.textT, margin:'16px 0 6px' }}>{k}</div>}
              <div style={{ padding:'12px 14px', borderRadius:14, marginBottom:8, background:T.surface, border:`1px solid ${semAviso ? T.danger : T.border}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:12, marginBottom:6 }}>
                  <b style={{ color:T.gold, fontSize:13 }}>📞 {nomes[r.contact_id] || 'Contato'}</b>
                  <span style={{ color:T.textT }}>{hora(r.started_at)}{dur ? ` · ${totalLabel(dur)}` : ''}{r.protocol ? ` · Protocolo #${r.protocol}` : ''}</span>
                </div>
                {semAviso ? (
                  <div style={{ color:T.danger, fontSize:12.5 }}>❌ Aviso prévio não dito — ligação não registrada.</div>
                ) : (<>
                  {r.audio_url && <AudioPlayer src={r.audio_url} fileName={`chamada-${r.protocol || r.id}`} />}
                  {r.status === 'processing' ? <span style={{ color:T.textT, fontStyle:'italic', fontSize:12.5 }}>Transcrevendo…</span>
                    : r.status === 'error' ? <span style={{ color:T.danger, fontSize:12.5 }}>Não foi possível transcrever esta ligação.</span>
                    : (
                      <div style={{ fontSize:13, lineHeight:1.5, color:T.text, whiteSpace:'pre-wrap', wordBreak:'break-word', marginTop:r.audio_url ? 8 : 0 }}>
                        {txt ? (longo && !aberto ? txt.slice(0, 280) + '…' : txt) : <i style={{ color:T.textT }}>(sem fala reconhecida)</i>}
                        {longo && <button onClick={() => setAberta((a) => ({ ...a, [r.id]: !aberto }))} style={{ display:'block', border:'none', background:'none', cursor:'pointer', color:T.gold, fontWeight:700, fontSize:12, padding:'4px 0 0', fontFamily:'inherit' }}>{aberto ? 'Ver menos' : 'Ver transcrição completa'}</button>}
                      </div>
                    )}
                </>)}
              </div>
            </div>
          );
        })}
      {filtradas.length > limite && (
        <button onClick={() => setLimite((l) => l + POR_PAGINA)} style={{ display:'block', margin:'10px auto', padding:'8px 20px', borderRadius:10, border:`1px solid ${T.border}`, background:'transparent', color:T.textS, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13 }}>Mostrar mais</button>
      )}
    </div>
  );
}
