import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const Ico = ({ d, size = 14, children, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, verticalAlign:'-2px' }}>{d ? <path d={d}/> : children}</svg>
);
const IcoFone = (p) => <Ico {...p} d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>;
const IcoBusca = (p) => <Ico {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></Ico>;
const IcoFiltro = (p) => <Ico {...p} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>;
const IcoChat = (p) => <Ico {...p} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>;
const IcoLista = (p) => <Ico {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></Ico>;
const IcoX = (p) => <Ico {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ico>;
const IcoVolta = (p) => <Ico {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></Ico>;
const IcoSeta = ({ aberto, ...p }) => <Ico {...p}><polyline points={aberto ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></Ico>;
const IcoCadeado = (p) => <Ico {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></Ico>;
const IcoAviso = (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><line x1="12" y1="16" x2="12.01" y2="16"/></Ico>;

const useEstreito = () => {
  const [e, setE] = useState(() => window.innerWidth < 760);
  useEffect(() => { const f = () => setE(window.innerWidth < 760); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return e;
};

const statusDe = (r) => (r.consent_given === false ? 'semaviso' : r.status === 'error' ? 'erro' : r.status === 'processing' ? 'proc' : 'ok');

export default function MinhasLigacoes() {
  const eu = getAuthUser();
  const [itens, setItens] = useState([]);
  const [nomes, setNomes] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberta, setAberta] = useState({});
  const [vista, setVista] = useState('conversas'); // conversas (estilo chat por contato) | lista
  const [sel, setSel] = useState(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
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

  const nFiltros = [f.periodo !== 'tudo', f.status !== 'todas', !!f.contato, f.dur !== '0', f.ordem !== 'novas'].filter(Boolean).length;
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

  const estreito = useEstreito();
  const fimRef = useRef(null);
  const conversas = useMemo(() => {
    const m = new Map();
    filtradas.forEach((r) => { if (!m.has(r.contact_id)) m.set(r.contact_id, []); m.get(r.contact_id).push(r); });
    return [...m.entries()].map(([id, lista]) => ({ id, lista, nome: nomes[id] || 'Contato', ms: lista.reduce((t, r) => t + callMs(r), 0),
      ultima: lista.reduce((a, b) => (new Date(b.started_at) > new Date(a.started_at) ? b : a)) }))
      .sort((a, b) => new Date(b.ultima.started_at) - new Date(a.ultima.started_at));
  }, [filtradas, nomes]);
  useEffect(() => { if (!estreito && !sel && conversas.length) setSel(conversas[0].id); }, [estreito, sel, conversas]);
  const atual = conversas.find((c) => c.id === sel) || null;
  useEffect(() => { const el = fimRef.current; if (el) el.scrollTop = el.scrollHeight; }, [sel, vista, atual?.lista.length]);

  const cartao = (r, mostrarContato) => {
    const dur = callMs(r); const semAviso = r.consent_given === false;
    const aberto = !!aberta[r.id]; const txt = r.transcript || '';
    const longo = txt.length > 280;
    return (
      <div style={{ padding:'12px 14px', borderRadius: mostrarContato ? 14 : '16px 16px 16px 4px', marginBottom:8, marginTop: mostrarContato ? 0 : 8, maxWidth: mostrarContato ? 'none' : '92%', background:T.surface, border:`1px solid ${semAviso ? T.danger : T.border}`, borderLeft:`4px solid ${semAviso ? T.danger : VERDE}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:12, marginBottom:6 }}>
          <b style={{ color:VERDE_DK, fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}><IcoFone size={13}/> {mostrarContato ? (nomes[r.contact_id] || 'Contato') : 'Ligação'}</b>
          <span style={{ color:T.textT }}>{mostrarContato && f.ordem === 'longas' ? `${dia(r.started_at)} · ` : ''}{hora(r.started_at)}{dur ? ` · ${totalLabel(dur)}` : ''}{r.protocol ? ` · Protocolo #${r.protocol}` : ''}</span>
        </div>
        {semAviso ? (
          <div style={{ color:T.danger, fontSize:12.5 }} ><span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><IcoAviso size={14}/> Aviso prévio não dito — ligação não registrada.</span></div>
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
    );
  };

  if (carregando) return <div style={{ textAlign:'center', padding:60, color:T.textT }}>Carregando...</div>;
  if (erro) return <div style={{ padding:20, color:T.textS }}>{erro}</div>;

  return (
    <div>
      {/* cabeçalho compacto com mascote */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', borderRadius:16, marginBottom:10,
        background:`linear-gradient(135deg, ${VERDE}26, ${VERDE_DK}10 60%, transparent)`, border:`1px solid ${VERDE}55` }}>
        <img src="/UNIKO_CALL.png" alt="Uniko Call" style={{ width:48, height:48, objectFit:'contain', flexShrink:0, filter:`drop-shadow(0 4px 10px ${VERDE}55)` }}/>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.text, lineHeight:1.2 }}>Minhas ligações</div>
          <div style={{ fontSize:11.5, color:T.textT, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span><b style={{ color:VERDE_DK }}>{itens.length}</b> no total · <b style={{ color:VERDE_DK }}>{hojeN}</b> hoje · <b style={{ color:VERDE_DK }}>{semana}</b> na semana</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><IcoCadeado size={11}/> só você vê</span>
          </div>
        </div>
      </div>

      {/* barra enxuta: visão + busca + filtros (recolhidos) */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:filtrosAbertos ? 8 : 12 }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setVista('conversas')} style={{ ...chip(vista === 'conversas'), display:'inline-flex', alignItems:'center', gap:6 }}><IcoChat size={13}/> Conversas</button>
          <button onClick={() => setVista('lista')} style={{ ...chip(vista === 'lista'), display:'inline-flex', alignItems:'center', gap:6 }}><IcoLista size={13}/> Lista</button>
        </div>
        <div style={{ position:'relative', flex:'1 1 200px', minWidth:160 }}>
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:T.textT, display:'flex' }}><IcoBusca size={14}/></span>
          <input value={f.busca} onChange={(e) => mudar({ busca:e.target.value })} placeholder="Buscar contato, protocolo ou conversa" style={{ ...campo, width:'100%', boxSizing:'border-box', paddingLeft:32 }}/>
        </div>
        <button onClick={() => setFiltrosAbertos((v) => !v)} title={filtrosAbertos ? 'Esconder filtros' : 'Mostrar filtros'}
          style={{ ...chip(filtrosAbertos || nFiltros > 0), display:'inline-flex', alignItems:'center', gap:6 }}>
          <IcoFiltro size={13}/> Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''} <IcoSeta size={12} aberto={filtrosAbertos}/>
        </button>
        {filtrando && <button onClick={limpar} title="Limpar filtros e busca" style={{ border:'none', background:'none', cursor:'pointer', color:VERDE_DK, fontWeight:800, fontSize:12, fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:4 }}><IcoX size={12}/> Limpar</button>}
      </div>

      {filtrosAbertos && (
        <div style={{ padding:'12px 14px', borderRadius:14, background:T.surface, border:`1px solid ${T.border}`, marginBottom:12, display:'flex', flexDirection:'column', gap:10 }}>
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
          <div style={{ fontSize:11.5, color:T.textT }}>{filtradas.length} {filtradas.length === 1 ? 'ligação encontrada' : 'ligações encontradas'}{totalMs ? ` · ${totalLabel(totalMs)} de conversa` : ''}</div>
        </div>
      )}

      {vista === 'lista' ? (<>
        {!visiveis.length
          ? <div style={{ textAlign:'center', padding:50, color:T.textT, fontSize:13 }}>{itens.length ? 'Nada encontrado com esses filtros.' : 'Você ainda não tem ligações gravadas.'}</div>
          : (() => { let ultimo = null; return visiveis.map((r) => {
            const k = dia(r.started_at); const novoDia = k !== ultimo && f.ordem !== 'longas'; if (f.ordem !== 'longas') ultimo = k;
            return (<div key={r.id}>
              {novoDia && <div style={{ fontSize:11, fontWeight:800, color:VERDE_DK, margin:'16px 0 6px' }}>{k}</div>}
              {cartao(r, true)}
            </div>);
          }); })()}
        {filtradas.length > limite && (
          <button onClick={() => setLimite((l) => l + POR_PAGINA)} style={{ display:'block', margin:'10px auto', padding:'9px 22px', borderRadius:10, border:'none', background:`linear-gradient(135deg,${VERDE},${VERDE_DK})`, color:'#fff', fontWeight:800, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13 }}>Mostrar mais ({filtradas.length - limite})</button>
        )}
      </>) : (
        <div style={{ display:'flex', gap:12, alignItems:'stretch', flexWrap:'wrap' }}>
          {/* contatos */}
          <div style={{ flex:'1 1 240px', maxWidth: estreito ? 'none' : 340, minWidth:0, display: sel && estreito ? 'none' : 'block' }}>
            {!conversas.length
              ? <div style={{ textAlign:'center', padding:36, color:T.textT, fontSize:13 }}>{itens.length ? 'Nenhum contato com esses filtros.' : 'Você ainda não tem ligações gravadas.'}</div>
              : conversas.map((c) => {
                const on = sel === c.id;
                return (
                  <button key={c.id} onClick={() => setSel(c.id)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', padding:'10px 12px', marginBottom:6, borderRadius:14, cursor:'pointer', fontFamily:'var(--font-body)',
                    border:`1px solid ${on ? VERDE : T.border}`, background: on ? `${VERDE}18` : T.surface }}>
                    <span style={{ width:38, height:38, borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${VERDE},${VERDE_DK})`, color:'#fff', fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>{(c.nome.trim()[0] || '?').toUpperCase()}</span>
                    <span style={{ minWidth:0, flex:1 }}>
                      <span style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                        <b style={{ fontSize:13, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nome}</b>
                        <span style={{ fontSize:10.5, color:T.textT, flexShrink:0 }}>{ymd(c.ultima.started_at) === hojeYmd() ? hora(c.ultima.started_at) : new Date(c.ultima.started_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}</span>
                      </span>
                      <span style={{ display:'block', fontSize:11.5, color:T.textT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.lista.length} {c.lista.length === 1 ? 'ligação' : 'ligações'} · {(c.ultima.transcript || '').trim().slice(0, 50) || 'sem transcrição'}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
          {/* conversa */}
          <div style={{ flex:'2 1 340px', minWidth:0, display: !sel && estreito ? 'none' : 'flex', flexDirection:'column', borderRadius:18, border:`1px solid ${T.border}`, background:T.surfaceSub, overflow:'hidden', minHeight:420 }}>
            {!atual ? (
              <div style={{ margin:'auto', textAlign:'center', padding:30, color:T.textT, fontSize:13 }}>
                <img src="/UNIKO_CALL.png" alt="" style={{ width:90, height:90, objectFit:'contain', opacity:.85 }}/>
                <div>Escolha um contato para ver todas as ligações com ele.</div>
              </div>
            ) : (<>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:`linear-gradient(135deg,${VERDE}26,transparent)`, borderBottom:`1px solid ${T.border}` }}>
                {estreito && <button onClick={() => setSel(null)} style={{ border:'none', background:'none', cursor:'pointer', color:VERDE_DK, padding:0, display:'flex' }}><IcoVolta size={18}/></button>}
                <span style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${VERDE},${VERDE_DK})`, color:'#fff', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{(atual.nome.trim()[0] || '?').toUpperCase()}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{atual.nome}</div>
                  <div style={{ fontSize:11.5, color:T.textT }}>{atual.lista.length} {atual.lista.length === 1 ? 'ligação' : 'ligações'}{atual.ms ? ` · ${totalLabel(atual.ms)} de conversa` : ''}</div>
                </div>
              </div>
              <div ref={fimRef} style={{ flex:1, overflowY:'auto', height:'calc(100vh - 330px)', minHeight:380, padding:'4px 14px 14px' }}>
                {(() => { let ultimo = null; return [...atual.lista].sort((a, b) => new Date(a.started_at) - new Date(b.started_at)).map((r) => {
                  const k = dia(r.started_at); const novoDia = k !== ultimo; ultimo = k;
                  return (<div key={r.id}>
                    {novoDia && <div style={{ textAlign:'center', fontSize:11, fontWeight:700, color:T.textT, background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, padding:'4px 14px', margin:'14px auto 6px', width:'fit-content' }}>{k}</div>}
                    {cartao(r, false)}
                  </div>);
                }); })()}
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
