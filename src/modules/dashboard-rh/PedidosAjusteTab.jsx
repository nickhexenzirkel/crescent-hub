// Dashboard RH → "Pedidos de Ajuste" (só admin).
// Fila de pequenas mudanças no Uniko. O admin descreve aqui; o AGENTE do
// servidor (crescent-hub-server/agent) resolve sozinho: edita o código numa
// branch, confere o build e abre um pull request. Aqui o admin vê o resultado e
// APROVA (publica) ou RECUSA (o pedido volta com o comentário). O Claude Code
// (/pedidos) continua podendo resolver a fila também. Ver vault/Como pedir ajustes.md.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase, USER, SERVER_URL } from '../../contexts/user';

const STATUS = {
  pendente:     { label: 'Pendente',          cor: '#E8A020' },
  em_andamento: { label: 'Agente trabalhando…', cor: '#3B82F6' },
  em_revisao:   { label: 'Aguardando você',   cor: '#8B5CF6' },
  reaberto:     { label: 'Reaberto',          cor: '#E8603C' },
  falhou:       { label: 'Agente não conseguiu', cor: '#C04050' },
  feito:        { label: 'Feito',             cor: '#28A870' },
  descartado:   { label: 'Descartado',        cor: '#8B93A7' },
};
const ABERTOS = ['pendente', 'reaberto', 'em_andamento', 'em_revisao', 'falhou'];
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}`, 'Content-Type': 'application/json' });

// Mostra, em destaque, em que o agente está mexendo AGORA (última linha de ação do log).
const AoVivo = ({ log }) => {
  const acoes = String(log || '').split('\n').filter(l => /(EDITANDO|CRIANDO|Lendo|Procurando|Olhando|Conferindo|Build|Clonando|Instalando)/.test(l));
  const ultima = (acoes[acoes.length - 1] || '').replace(/^\[[^\]]*\]\s*/, '');
  return (
    <div style={{ margin: '8px 0 6px', padding: '8px 11px', borderRadius: 9, background: 'rgba(59,130,246,.12)', color: T.text, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, animation: 'pedPulso 1.2s ease-in-out infinite' }} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>Agora:</b> {ultima || 'iniciando…'}</span>
      <style>{'@keyframes pedPulso{0%,100%{opacity:1}50%{opacity:.25}}'}</style>
    </div>
  );
};
// Botão de prévia: a Vercel publica a branch do agente num endereço de teste (~1 min).
// Pergunta ao servidor até ficar pronta e abre numa aba nova — sem esperar o site principal.
const Previa = ({ id }) => {
  const [st, setSt] = useState({ state: 'gerando', url: null });
  useEffect(() => {
    let vivo = true, t;
    const tick = async () => {
      try {
        const r = await fetch(`${SERVER_URL}/api/agent/preview/${id}`, { headers: authHeaders() });
        const d = await r.json();
        if (!vivo) return;
        if (r.ok) setSt(d);
        if (!r.ok || d.state === 'gerando') t = setTimeout(tick, 5000);
      } catch { if (vivo) t = setTimeout(tick, 8000); }
    };
    tick();
    return () => { vivo = false; clearTimeout(t); };
  }, [id]);
  const base = { padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', textDecoration: 'none' };
  if (st.state === 'pronta') return <a href={st.url} target="_blank" rel="noreferrer" style={{ ...base, border: '1px solid #3B82F6', background: '#3B82F6', color: '#fff' }}>Abrir prévia ao vivo ↗</a>;
  if (st.state === 'falhou') return <span style={{ ...base, border: `1px solid ${T.border}`, color: T.textT }}>Prévia indisponível</span>;
  return <span style={{ ...base, border: `1px solid ${T.border}`, color: T.textT }}>Gerando prévia… (~1 min)</span>;
};

// Console do passo a passo: rola sozinho pro fim enquanto chegam linhas novas.
const LogTela = ({ log }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log]);
  return <pre ref={ref} style={{ margin: '6px 0 0', padding: 10, borderRadius: 8, background: T.surfaceSub || 'rgba(0,0,0,.05)', color: T.textS, fontSize: 11, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>{log}</pre>;
};

const PedidosAjusteTab = ({ cardBg }) => {
  const bg = cardBg || T.surface;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [area, setArea] = useState('');
  // Publicar direto na versão definitiva assim que o agente terminar (lembra a última escolha).
  const [auto, setAuto] = useState(() => { try { return localStorage.getItem('uniko_pedido_auto') !== '0'; } catch { return true; } });
  const mudarAuto = (v) => { setAuto(v); try { localStorage.setItem('uniko_pedido_auto', v ? '1' : '0'); } catch { /* sem storage */ } };
  // Qual agente resolve o pedido: Groq (grátis) ou OpenAI (pago, cartão da conta). Lembra a última escolha.
  const [qualAgente, setQualAgente] = useState(() => { try { return localStorage.getItem('uniko_pedido_agente') || ''; } catch { return ''; } });
  const mudarQualAgente = (v) => { setQualAgente(v); try { localStorage.setItem('uniko_pedido_agente', v); } catch { /* sem storage */ } };
  const [filtro, setFiltro] = useState('abertos'); // abertos | feito | todos
  const [reabrir, setReabrir] = useState(null);    // { id, texto, modo: 'reabrir' | 'recusar' }
  const [agente, setAgente] = useState(null);      // { llm, github, auto, busy, model, notReady }
  const [logAberto, setLogAberto] = useState(null);
  const [ocupado, setOcupado] = useState(null);    // id do pedido com ação em andamento
  const timer = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await _supabase.from('uniko_pedidos_ajuste').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) setErro(error.message.includes('does not exist') || error.message.includes('schema cache') ? 'Tabela não existe — rode supabase_pedidos_ajuste.sql (e depois supabase_pedidos_ajuste_agente.sql) no Supabase principal.' : error.message);
    else { setErro(''); setRows(data || []); }
    setLoading(false);
  }, []);
  const loadAgente = useCallback(async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/agent/config`, { headers: authHeaders() });
      setAgente(r.ok ? await r.json() : { notReady: 'Servidor sem a rota do agente (faça o deploy na VPS).' });
    } catch { setAgente({ notReady: 'Sem conexão com o servidor.' }); }
  }, []);
  useEffect(() => { load(); loadAgente(); }, [load, loadAgente]);

  // Enquanto o agente trabalha, atualiza sozinho.
  const trabalhando = rows.some(r => r.status === 'em_andamento');
  useEffect(() => {
    clearInterval(timer.current);
    if (trabalhando) timer.current = setInterval(load, 2500);
    return () => clearInterval(timer.current);
  }, [trabalhando, load]);

  const criar = async () => {
    if (!titulo.trim()) return;
    const { error } = await _supabase.from('uniko_pedidos_ajuste').insert({ titulo: titulo.trim(), descricao: descricao.trim() || null, area: area.trim() || null, autor: USER?.name || null, auto_publicar: auto, agente: qualAgente || agente?.padrao || 'groq' });
    if (error) { setErro(error.message); return; }
    setTitulo(''); setDescricao(''); setArea(''); load();
  };
  const mudar = async (id, patch) => {
    const { error } = await _supabase.from('uniko_pedidos_ajuste').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) setErro(error.message); else load();
  };
  const excluir = async (id) => {
    if (!window.confirm('Excluir este pedido?')) return;
    await _supabase.from('uniko_pedidos_ajuste').delete().eq('id', id); load();
  };
  const chamar = async (rota, id, body, okMsg) => {
    setOcupado(id); setErro(''); setInfo('');
    try {
      const r = await fetch(`${SERVER_URL}/api/agent/${rota}/${id}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (okMsg) setInfo(okMsg);
    } catch (e) { setErro(e.message === 'Failed to fetch' ? 'Sem conexão com o servidor.' : e.message); }
    setOcupado(null); load(); loadAgente();
  };
  const aprovar = (r) => {
    if (r.acao) { if (window.confirm(`${r.nota_ia?.replace(/^Vou fazer: /, '').replace(/\. Clique em Aplicar.*$/, '') || 'Aplicar esta ação'}?`)) chamar('approve', r.id, null, 'Ação aplicada! Quem está com o Uniko aberto recebe em até 3 minutos.'); return; }
    if (window.confirm('Aprovar e publicar esta mudança no site?')) chamar('approve', r.id, null, 'Publicado! A Vercel atualiza o site em ~1 minuto.');
  };

  const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };
  const btn = (primario) => ({ padding: '7px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
    border: `1px solid ${primario ? T.gold : T.border}`, background: primario ? T.gold : 'transparent', color: primario ? '#fff' : T.textS });

  const visiveis = rows.filter(r => filtro === 'todos' ? true : filtro === 'feito' ? r.status === 'feito' : ABERTOS.includes(r.status));
  const nAbertos = rows.filter(r => ABERTOS.includes(r.status)).length;
  const agentePronto = agente && !agente.notReady;
  const OPCOES_AGENTE = [['groq', 'Groq — grátis, mais simples'], ['openai', 'OpenAI — pago, mais capaz']];
  const agenteEfetivo = (r) => (r && r.agente) || qualAgente || agente?.padrao || 'groq';
  const seletorAgente = (valor, onChange, estilo) => (
    <select value={valor} onChange={e => onChange(e.target.value)} style={{ padding: '6px 8px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12, fontFamily: 'var(--font-body)', ...estilo }}>
      {OPCOES_AGENTE.map(([id, rotulo]) => <option key={id} value={id} disabled={agente?.provedores && !agente.provedores[id]}>{rotulo}{agente?.provedores && !agente.provedores[id] ? ' (sem chave no servidor)' : ''}</option>)}
    </select>
  );

  return (
    <div>
<div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Ajuste Inteligente</div>
      <div style={{ fontSize: 12.5, color: T.textT, margin: '2px 0 12px', lineHeight: 1.5 }}>
        Descreva uma mudança pequena no Uniko. O <b>agente</b> faz a alteração e confere se o site continua montando. Com <b>Publicar direto</b> marcado, a mudança vai pra versão que todo mundo usa assim que ficar pronta (e dá pra desfazer); desmarcado, ela espera a sua aprovação.
      </div>
      {agente && (
        <div style={{ fontSize: 11.5, marginBottom: 14, padding: '7px 11px', borderRadius: 9, display: 'inline-block',
          background: agentePronto ? 'rgba(40,168,112,.12)' : 'rgba(232,160,32,.14)', color: agentePronto ? '#1d7a52' : '#9a6a00' }}>
          {agentePronto ? `Agente pronto (${agente.model})${agente.auto ? ' · fila automática ligada' : ' · rode manualmente em cada pedido'}` : `Agente indisponível: ${agente.notReady}`}
        </div>
      )}

      {erro && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: T.danger, background: `${T.danger}18`, border: `1px solid ${T.danger}44` }}>{erro}</div>}
      {info && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: '#1d7a52', background: 'rgba(40,168,112,.12)', border: '1px solid rgba(40,168,112,.35)' }}>{info}</div>}

      <div style={{ background: bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px 18px', marginBottom: 16, boxShadow: T.sh }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>Novo pedido</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que você quer mudar? (ex.: botão Salvar maior no mobile)" style={campo} />
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="Detalhes: como está hoje, como deveria ficar…" style={{ ...campo, resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.textS }}>
            <span>Agente:</span>{seletorAgente(agenteEfetivo(null), mudarQualAgente, { flex: 1 })}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: T.textS, cursor: 'pointer', lineHeight: 1.45 }}>
            <input type="checkbox" checked={auto} onChange={e => mudarAuto(e.target.checked)} style={{ marginTop: 2 }} />
            <span><b style={{ color: T.text }}>Publicar direto</b> na versão que todo mundo usa assim que ficar pronto (o site só é atualizado se o build passar). Dá pra desfazer depois. Desmarque pra revisar antes.</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="Tela / módulo (opcional — ajuda o agente a achar)" style={{ ...campo, flex: 1 }} />
            <button onClick={criar} disabled={!titulo.trim()} style={{ ...btn(true), opacity: titulo.trim() ? 1 : .5 }}>Enviar pedido</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        {[['abertos', `Abertos (${nAbertos})`], ['feito', 'Feitos'], ['todos', 'Todos']].map(([id, l]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{ ...btn(filtro === id), padding: '5px 12px' }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ fontSize: 13, color: T.textT }}>Carregando…</div>
        : visiveis.length === 0 ? <div style={{ fontSize: 13, color: T.textT, padding: '14px 0' }}>Nenhum pedido aqui.</div>
        : visiveis.map(r => {
          const st = STATUS[r.status] || STATUS.pendente;
          const podeRodar = ['pendente', 'reaberto', 'falhou'].includes(r.status);
          return (
            <div key={r.id} style={{ background: bg, border: `1px solid ${T.border}`, borderLeft: `4px solid ${st.cor}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1, minWidth: 180 }}>{r.titulo}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: st.cor, background: `${st.cor}1f`, padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
              </div>
              {r.area && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>Tela: {r.area}</div>}
              {r.descricao && <div style={{ fontSize: 12.5, color: T.textS, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.descricao}</div>}
              {r.nota_ia && (
                <div style={{ fontSize: 12.5, color: T.text, marginTop: 8, padding: '8px 10px', borderRadius: 8, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  background: r.status === 'falhou' ? `${T.danger}14` : 'rgba(40,168,112,.10)' }}>
                  <b>{r.status === 'falhou' ? 'Problema:' : r.status === 'em_revisao' ? 'O agente fez:' : 'Feito:'}</b> {r.nota_ia}
                </div>
              )}
              {r.comentario && <div style={{ fontSize: 12, color: T.textS, marginTop: 6 }}><b>Seu comentário:</b> {r.comentario}</div>}
              {r.status === 'em_andamento' && !r.agente_log && <div style={{ fontSize: 12, color: T.textT, marginTop: 8 }}>Preparando o agente…</div>}
              {r.agente_log && (
                <div style={{ marginTop: 6 }}>
                  {r.status === 'em_andamento' && <AoVivo log={r.agente_log} />}
                  <button onClick={() => setLogAberto(logAberto === r.id ? null : r.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: T.textT, textDecoration: 'underline' }}>
                    {(logAberto === r.id || r.status === 'em_andamento') ? 'Esconder passo a passo' : 'Ver passo a passo do agente'}
                  </button>
                  {(logAberto === r.id || r.status === 'em_andamento') && <LogTela log={r.agente_log} />}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: T.textT, flex: 1 }}>{r.autor || ''} · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                {podeRodar && seletorAgente(agenteEfetivo(r), (v) => mudar(r.id, { agente: v }))}
                {podeRodar && <button disabled={!agentePronto || ocupado === r.id || !!agente?.busy} onClick={() => chamar('run', r.id, null, 'O agente começou a trabalhar. Acompanhe por aqui.')}
                  title={agentePronto ? '' : agente?.notReady} style={{ ...btn(true), opacity: agentePronto && !agente?.busy ? 1 : .5 }}>{r.status === 'falhou' ? 'Tentar de novo' : 'Rodar agente'}</button>}
                {r.status === 'em_revisao' && r.branch && <Previa id={r.id} />}
                {r.status === 'em_revisao' && r.pr_url && <a href={r.pr_url} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: 'none' }}>Ver mudanças ↗</a>}
                {r.status === 'em_revisao' && <button disabled={ocupado === r.id} onClick={() => aprovar(r)} style={{ ...btn(true), background: '#28A870', borderColor: '#28A870' }}>{ocupado === r.id ? (r.acao ? 'Aplicando…' : 'Publicando…') : (r.acao ? 'Aplicar' : 'Aprovar e publicar')}</button>}
                {r.status === 'em_revisao' && <button disabled={ocupado === r.id} onClick={() => setReabrir({ id: r.id, texto: '', modo: 'recusar' })} style={btn(false)}>Recusar</button>}
                {r.status === 'feito' && (r.merge_sha || r.acao?.undo) && <button disabled={ocupado === r.id} onClick={() => { if (window.confirm(r.acao ? 'Desfazer esta ação?' : 'Desfazer esta mudança na versão definitiva?')) chamar('undo', r.id, null, r.acao ? 'Ação desfeita.' : 'Mudança desfeita. A Vercel atualiza o site em ~1 minuto.'); }} style={btn(false)}>{ocupado === r.id ? 'Desfazendo…' : 'Desfazer'}</button>}
                {r.status === 'feito' && <button onClick={() => setReabrir({ id: r.id, texto: '', modo: 'reabrir' })} style={btn(false)}>Reabrir</button>}
                {['pendente', 'reaberto', 'falhou'].includes(r.status) && <button onClick={() => mudar(r.id, { status: 'descartado' })} style={btn(false)}>Descartar</button>}
                {r.status !== 'em_andamento' && <button onClick={() => excluir(r.id)} style={{ ...btn(false), color: T.danger }}>Excluir</button>}
              </div>
              {reabrir?.id === r.id && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={reabrir.texto} onChange={e => setReabrir({ ...reabrir, texto: e.target.value })} placeholder="O que ficou errado? O agente vai tentar de novo com isso." style={{ ...campo, flex: 1 }} />
                  <button onClick={() => {
                    if (reabrir.modo === 'recusar') chamar('reject', r.id, { comentario: reabrir.texto }, 'Mudança recusada. O pedido voltou pra fila com o seu comentário.');
                    else mudar(r.id, { status: 'reaberto', comentario: reabrir.texto.trim() || null });
                    setReabrir(null);
                  }} style={btn(true)}>{reabrir.modo === 'recusar' ? 'Recusar' : 'Reabrir'}</button>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};

export default PedidosAjusteTab;
