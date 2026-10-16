import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { getAuthUser } from '../../contexts/user';
import { supabase as callDb } from '../uniko-call/callSupabase';
import { AudioPlayer } from '../uniko-call/index';
import { callMs, totalLabel } from '../uniko-call/callUtils';

/* "Uniko Call" dentro de Minhas Tarefas — ESPELHO só de leitura das ligações do próprio colaborador.
   Lê as mesmas tabelas do Uniko Call (uniko_call_recordings / _contacts) e toca o mesmo áudio do bucket:
   nada é copiado nem regravado. Quem barra as ligações dos outros é o RLS do banco
   (supabase_uniko_call_minhas.sql: só vê a linha cujo attendant_id é o dele). */
const VERDE = '#22c55e', VERDE_DK = '#16a34a';
const POR_PAGINA = 20;
const dia = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }); };
const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); };
const ymd = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hojeYmd = () => ymd(new Date().toISOString());
const somaDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d.toISOString()); };

const PERIODOS = [['tudo', 'Tudo'], ['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['custom', 'Datas']];
const STATUS = [['todas', 'Todas'], ['ok', 'Transcritas'], ['semaviso', 'Sem aviso'], ['erro', 'Com erro'], ['proc', 'Processando']];
const DURACOES = [['0', 'Qualquer duração'], ['60000', '+1 min'], ['300000', '+5 min'], ['600000', '+10 min']];
const ORDENS = [['novas', 'Mais recentes'], ['antigas', 'Mais antigas'], ['longas', 'Mais longas']];

const statusDe = (r) => (r.consent_given === false ? 'semaviso' : r.status === 'error' ? 'erro' : r.status === 'processing' ? 'proc' : 'ok');

export default function MinhasLigacoes() {
  const eu = getAuthUser();
  const [itens, setItens] = useState([]);
  const [nomes, setNomes] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberta, setAberta] = useState({});
  const [f, setF] = useState({ busca:'', periodo:'tudo', de:'', ate:'', contato:'', status:'todas', dur:'0', ordem:'novas' });
  const mudar = (p) => { setF((x) => ({ ...x, ...p })); setLimite(POR_PAGINA); };

  const carregar = useCallback(async () => {
    if (!eu?.id) { setCarregando(false); return; }
    const { data, error } = await callDb.from('uniko_call_recordings')
      .select('id, contact_id, started_at, ended_at, transcript, status, error, consent_given, protocol, audio_url')
      .eq('attendant_id', String(eu.id)).order('started_at', { ascending: false }).limit(1000);
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

  const contatos = useMemo(() => {
    const m = new Map();
    itens.forEach((r) => m.set(r.contact_id, (m.get(r.contact_id) || 0) + 1));
    return [...m.entries()].map(([id, n]) => ({ id, n, nome: nomes[id] || 'Contato' })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itens, nomes]);

  const filtradas = useMemo(() => {
    const q = f.busca.trim().toLowerCase();
    let ini = '', fim = '';
    if (f.periodo === 'hoje') ini = fim = hojeYmd();
    else if (f.periodo === '7') ini = somaDias(6);
    else if (f.periodo === '30') ini = somaDias(29);
    else if (f.periodo === 'custom') { ini = f.de; fim = f.ate; }
    const durMin = Number(f.dur);
    const out = itens.filter((r) => {
      const d = ymd(r.started_at);
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      if (f.contato && String(r.contact_id) !== f.contato) return false;
      if (f.status !== 'todas' && statusDe(r) !== f.status) return false;
      if (durMin && callMs(r) < durMin) return false;
      if (q && !((nomes[r.contact_id] || '').toLowerCase().includes(q) || (r.transcript || '').toLowerCase().includes(q) || String(r.protocol || '').includes(q))) return false;
      return true;
    });
    if (f.ordem === 'antigas') out.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    else if (f.ordem === 'longas') out.sort((a, b) => callMs(b) - callMs(a));
    return out;
  }, [itens, nomes, f]);

  const filtrando = f.busca || f.periodo !== 'tudo' || f.contato || f.status !== 'todas' || f.dur !== '0' || f.ordem !== 'novas';
  const limpar = () => mudar({ busca:'', periodo:'tudo', de:'', ate:'', contato:'', status:'todas', dur:'0', ordem:'novas' });
  const visiveis = filtradas.slice(0, limite);
  const totalMs = filtradas.reduce((s, r) => s + callMs(r), 0);
  const hojeN = itens.filter((r) => ymd(r.started_at) === hojeYmd()).length;
  const semana = itens.filter((r) => ymd(r.started_at) >= somaDias(6)).length;

  const chip = (on) => ({ padding:'6px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'var(--font-body)', whiteSpace:'nowrap',
    border:`1px solid ${on ? VERDE : T.border}`, background: on ? VERDE : 'transparent', color: on ? '#fff' : T.textS });
  const campo = { padding:'8px 10px', borderRadius:10, border:`1px solid ${T.border}`, background:T.surfaceSub, color:T.text, fontSize:12.5, outline:'none', fontFamily:'var(--font-body)' };
  const rotulo = { fontSize:10.5, fontWeight:800, letterSpacing:.5, textTransform:'uppercase', color:T.textT, marginBottom:5 };

  if (carregando) return <div style={{ textAlign:'center', padding:60, color:T.textT }}>Carregando...</div>;
  if (erro) return <div style={{ padding:20, color:T.textS }}>{erro}</div>;

  let ultimoDia = null;
  return (
    <div>
      {/* cabeçalho com mascote */}
      <div style={{ position:'relative', overflow:'hidden', display:'flex', alignItems:'center', gap:16, padding:'16px 18px', borderRadius:20, marginBottom:16,
        background:`linear-gradient(135deg, ${VERDE}26, ${VERDE_DK}12 60%, transparent)`, border:`1px solid ${VERDE}55` }}>
        <div style={{ position:'absolute', right:-30, top:-40, width:140, height:140, borderRadius:'50%', background:`${VERDE}18`, filter:'blur(2px)' }}/>
        <img src="/UNIKO_CALL.png" alt="Uniko Call" style={{ width:84, height:84, objectFit:'contain', flexShrink:0, filter:`drop-shadow(0 6px 14px ${VERDE}55)` }}/>
        <div style={{ minWidth:0, flex:1, position:'relative' }}>
          <div style={{ fontSize:18, fontWeight:800, color:T.text, lineHeight:1.2 }}>Minhas ligações</div>
          <div style={{ fontSize:12.5, fontWeight:700, color:VERDE_DK, marginBottom:8 }}>Uniko Call · áudio e transcrição das suas chamadas</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[[itens.length, 'no total'], [hojeN, 'hoje'], [semana, 'na semana']].map(([n, l]) => (
              <span key={l} style={{ padding:'4px 11px', borderRadius:20, background:T.surface, border:`1px solid ${VERDE}44`, fontSize:11.5, color:T.textS }}>
                <b style={{ color:VERDE_DK }}>{n}</b> {l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* filtros */}
      <div style={{ padding:'14px 16px', borderRadius:16, background:T.surface, border:`1px solid ${T.border}`, marginBottom:12, display:'flex', flexDirection:'column', gap:12 }}>
        <input value={f.busca} onChange={(e) => mudar({ busca:e.target.value })} placeholder="🔎 Buscar por contato, protocolo ou trecho da conversa…" style={{ ...campo, width:'100%', boxSizing:'border-box', fontSize:13 }}/>
        <div>
          <div style={rotulo}>Período</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {PERIODOS.map(([id, l]) => <button key={id} onClick={() => mudar({ periodo:id })} style={chip(f.periodo === id)}>{l}</button>)}
            {f.periodo === 'custom' && (<>
              <input type="date" value={f.de} max={f.ate || undefined} onChange={(e) => mudar({ de:e.target.value })} style={campo}/>
              <span style={{ color:T.textT, fontSize:12 }}>até</span>
              <input type="date" value={f.ate} min={f.de || undefined} onChange={(e) => mudar({ ate:e.target.value })} style={campo}/>
            </>)}
          </div>
        </div>
        <div>
          <div style={rotulo}>Situação</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {STATUS.map(([id, l]) => <button key={id} onClick={() => mudar({ status:id })} style={chip(f.status === id)}>{l}</button>)}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ flex:'1 1 180px' }}>
            <div style={rotulo}>Contato</div>
            <select value={f.contato} onChange={(e) => mudar({ contato:e.target.value })} style={{ ...campo, width:'100%' }}>
              <option value="">Todos os contatos ({contatos.length})</option>
              {contatos.map((c) => <option key={c.id} value={String(c.id)}>{c.nome} ({c.n})</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 150px' }}>
            <div style={rotulo}>Duração</div>
            <select value={f.dur} onChange={(e) => mudar({ dur:e.target.value })} style={{ ...campo, width:'100%' }}>
              {DURACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 150px' }}>
            <div style={rotulo}>Ordenar por</div>
            <select value={f.ordem} onChange={(e) => mudar({ ordem:e.target.value })} style={{ ...campo, width:'100%' }}>
              {ORDENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', fontSize:12, color:T.textT }}>
          <span>{filtradas.length} {filtradas.length === 1 ? 'ligação' : 'ligações'}{totalMs ? ` · ${totalLabel(totalMs)} de conversa` : ''} · 🔒 só você vê estas ligações</span>
          {filtrando && <button onClick={limpar} style={{ border:'none', background:'none', cursor:'pointer', color:VERDE_DK, fontWeight:800, fontSize:12, fontFamily:'inherit' }}>✕ Limpar filtros</button>}
        </div>
      </div>

      {!visiveis.length
        ? <div style={{ textAlign:'center', padding:50, color:T.textT, fontSize:13 }}>{itens.length ? 'Nada encontrado com esses filtros.' : 'Você ainda não tem ligações gravadas.'}</div>
        : visiveis.map((r) => {
          const k = dia(r.started_at); const novoDia = k !== ultimoDia && f.ordem !== 'longas'; if (f.ordem !== 'longas') ultimoDia = k;
          const dur = callMs(r); const semAviso = r.consent_given === false;
          const aberto = !!aberta[r.id]; const txt = r.transcript || '';
          const longo = txt.length > 280;
          return (
            <div key={r.id}>
              {novoDia && <div style={{ fontSize:11, fontWeight:800, color:VERDE_DK, margin:'16px 0 6px' }}>{k}</div>}
              <div style={{ padding:'12px 14px', borderRadius:14, marginBottom:8, background:T.surface, border:`1px solid ${semAviso ? T.danger : T.border}`, borderLeft:`4px solid ${semAviso ? T.danger : VERDE}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:12, marginBottom:6 }}>
                  <b style={{ color:VERDE_DK, fontSize:13 }}>📞 {nomes[r.contact_id] || 'Contato'}</b>
                  <span style={{ color:T.textT }}>{f.ordem === 'longas' ? `${k} · ` : ''}{hora(r.started_at)}{dur ? ` · ${totalLabel(dur)}` : ''}{r.protocol ? ` · Protocolo #${r.protocol}` : ''}</span>
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
                        {longo && <button onClick={() => setAberta((a) => ({ ...a, [r.id]: !aberto }))} style={{ display:'block', border:'none', background:'none', cursor:'pointer', color:VERDE_DK, fontWeight:700, fontSize:12, padding:'4px 0 0', fontFamily:'inherit' }}>{aberto ? 'Ver menos' : 'Ver transcrição completa'}</button>}
                      </div>
                    )}
                </>)}
              </div>
            </div>
          );
        })}
      {filtradas.length > limite && (
        <button onClick={() => setLimite((l) => l + POR_PAGINA)} style={{ display:'block', margin:'10px auto', padding:'9px 22px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${VERDE},${VERDE_DK})`, color:'#fff', fontWeight:800, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13 }}>Mostrar mais ({filtradas.length - limite})</button>
      )}
    </div>
  );
}
