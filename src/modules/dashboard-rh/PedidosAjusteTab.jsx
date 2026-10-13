// Dashboard RH → "Pedidos de Ajuste" (só admin).
// Fila de pequenas mudanças no Uniko. O admin descreve aqui; o Claude Code
// resolve depois com o comando /pedidos (lê os pendentes, mexe no código e marca
// como feito com uma nota). Ver vault/Como pedir ajustes.md.
import React, { useState, useEffect, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase, USER } from '../../contexts/user';

const STATUS = {
  pendente:   { label: 'Pendente',   cor: '#E8A020' },
  reaberto:   { label: 'Reaberto',   cor: '#E8603C' },
  feito:      { label: 'Feito',      cor: '#28A870' },
  descartado: { label: 'Descartado', cor: '#8B93A7' },
};

const PedidosAjusteTab = ({ cardBg }) => {
  const bg = cardBg || T.surface;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [area, setArea] = useState('');
  const [filtro, setFiltro] = useState('abertos'); // abertos | feito | todos
  const [reabrir, setReabrir] = useState(null);    // { id, texto }

  const load = useCallback(async () => {
    const { data, error } = await _supabase.from('uniko_pedidos_ajuste').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) setErro(error.message.includes('does not exist') || error.message.includes('schema cache') ? 'Tabela não existe — rode supabase_pedidos_ajuste.sql no Supabase principal.' : error.message);
    else { setErro(''); setRows(data || []); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const criar = async () => {
    if (!titulo.trim()) return;
    const { error } = await _supabase.from('uniko_pedidos_ajuste').insert({ titulo: titulo.trim(), descricao: descricao.trim() || null, area: area.trim() || null, autor: USER?.name || null });
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

  const campo = { width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };
  const btn = (primario) => ({ padding: '7px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
    border: `1px solid ${primario ? T.gold : T.border}`, background: primario ? T.gold : 'transparent', color: primario ? '#fff' : T.textS });

  const visiveis = rows.filter(r => filtro === 'todos' ? true : filtro === 'feito' ? r.status === 'feito' : (r.status === 'pendente' || r.status === 'reaberto'));
  const nPend = rows.filter(r => r.status === 'pendente' || r.status === 'reaberto').length;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Pedidos de Ajuste</div>
      <div style={{ fontSize: 12.5, color: T.textT, margin: '2px 0 16px', lineHeight: 1.5 }}>
        Descreva uma mudança que você quer no Uniko. Quando abrir o Claude Code no projeto, rode <b>/pedidos</b> — ele resolve os pendentes e marca como feitos.
      </div>

      {erro && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: T.danger, background: `${T.danger}18`, border: `1px solid ${T.danger}44` }}>{erro}</div>}

      <div style={{ background: bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px 18px', marginBottom: 16, boxShadow: T.sh }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>Novo pedido</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que você quer mudar? (ex.: botão Salvar maior no mobile)" style={campo} />
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="Detalhes: como está hoje, como deveria ficar…" style={{ ...campo, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="Tela / módulo (opcional)" style={{ ...campo, flex: 1 }} />
            <button onClick={criar} disabled={!titulo.trim()} style={{ ...btn(true), opacity: titulo.trim() ? 1 : .5 }}>Enviar pedido</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        {[['abertos', `Abertos (${nPend})`], ['feito', 'Feitos'], ['todos', 'Todos']].map(([id, l]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{ ...btn(filtro === id), padding: '5px 12px' }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ fontSize: 13, color: T.textT }}>Carregando…</div>
        : visiveis.length === 0 ? <div style={{ fontSize: 13, color: T.textT, padding: '14px 0' }}>Nenhum pedido aqui.</div>
        : visiveis.map(r => {
          const st = STATUS[r.status] || STATUS.pendente;
          return (
            <div key={r.id} style={{ background: bg, border: `1px solid ${T.border}`, borderLeft: `4px solid ${st.cor}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text, flex: 1, minWidth: 180 }}>{r.titulo}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: st.cor, background: `${st.cor}1f`, padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
              </div>
              {r.area && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>Tela: {r.area}</div>}
              {r.descricao && <div style={{ fontSize: 12.5, color: T.textS, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.descricao}</div>}
              {r.nota_ia && <div style={{ fontSize: 12.5, color: T.text, marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(40,168,112,.10)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><b>Feito:</b> {r.nota_ia}</div>}
              {r.comentario && <div style={{ fontSize: 12, color: T.textS, marginTop: 6 }}><b>Seu comentário:</b> {r.comentario}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: T.textT, flex: 1 }}>{r.autor || ''} · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                {r.status === 'feito' && <button onClick={() => setReabrir({ id: r.id, texto: '' })} style={btn(false)}>Reabrir</button>}
                {(r.status === 'pendente' || r.status === 'reaberto') && <button onClick={() => mudar(r.id, { status: 'descartado' })} style={btn(false)}>Descartar</button>}
                <button onClick={() => excluir(r.id)} style={{ ...btn(false), color: T.danger }}>Excluir</button>
              </div>
              {reabrir?.id === r.id && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={reabrir.texto} onChange={e => setReabrir({ id: r.id, texto: e.target.value })} placeholder="O que ficou errado?" style={{ ...campo, flex: 1 }} />
                  <button onClick={() => { mudar(r.id, { status: 'reaberto', comentario: reabrir.texto.trim() || null }); setReabrir(null); }} style={btn(true)}>Reabrir</button>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};

export default PedidosAjusteTab;
