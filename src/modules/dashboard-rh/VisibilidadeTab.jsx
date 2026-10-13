// Dashboard RH → "Módulos e Abas" (só admin).
// Lista o que o agente (Pedidos de Ajuste) escondeu ou renomeou — módulos da tela inicial e abas
// do Portal — e permite remover cada regra. Pra criar regras novas, é só fazer um pedido na aba
// "Pedidos de Ajuste" (ex.: "esconder o Uniko Wave para o Nicolas", "renomear o módulo X para Y").
import React, { useState, useEffect, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { supabase as _supabase } from '../../contexts/user';
import { carregarVisibilidade } from '../../shared/visibilidade';

const VisibilidadeTab = ({ cardBg }) => {
  const bg = cardBg || T.surface;
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await _supabase.from('uniko_visibilidade').select('*').order('tipo').order('item_id');
    if (error) setErro(error.message.includes('does not exist') || error.message.includes('schema cache') ? 'Tabela não existe — rode supabase_visibilidade.sql no Supabase principal.' : error.message);
    else { setErro(''); setRows(data || []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remover = async (r) => {
    if (!window.confirm('Remover esta regra? O item volta ao normal (nome e visibilidade originais).')) return;
    setOcupado(`${r.tipo}:${r.item_id}`);
    const { error } = await _supabase.from('uniko_visibilidade').delete().eq('tipo', r.tipo).eq('item_id', r.item_id);
    if (error) setErro(error.message);
    await load(); await carregarVisibilidade();
    setOcupado(null);
  };

  const btn = { padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', border: `1px solid ${T.border}`, background: 'transparent', color: T.danger };
  const tag = (txt, cor) => <span style={{ fontSize: 10.5, fontWeight: 700, color: cor, background: `${cor}1f`, padding: '2px 8px', borderRadius: 999, marginRight: 6 }}>{txt}</span>;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Módulos e Abas</div>
      <div style={{ fontSize: 12.5, color: T.textT, margin: '2px 0 16px', lineHeight: 1.5 }}>
        Regras de visibilidade e nome criadas pelo agente. Pra criar uma nova, faça um pedido em <b>Pedidos de Ajuste</b> —
        por exemplo: <i>"esconder o Uniko Wave para o Nicolas"</i>, <i>"renomear o módulo Trello para Quadro"</i> ou <i>"tirar o Uniko Sereia do Nicolas Andrade"</i> (essa última remove da coleção dele).
      </div>
      {erro && <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: T.danger, background: `${T.danger}18`, border: `1px solid ${T.danger}44` }}>{erro}</div>}
      {rows === null ? <div style={{ fontSize: 13, color: T.textT }}>Carregando…</div>
        : rows.length === 0 ? <div style={{ fontSize: 13, color: T.textT, padding: '14px 0' }}>Nenhuma regra ativa — tudo aparece com o nome e a visibilidade originais.</div>
        : rows.map(r => (
          <div key={`${r.tipo}:${r.item_id}`} style={{ background: bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ marginBottom: 4 }}>
                {tag(r.tipo === 'rh_aba' ? 'ABA DO DASHBOARD RH' : r.tipo === 'aba' ? 'ABA DO PORTAL' : 'MÓDULO', T.gold)}
                <b style={{ color: T.text, fontSize: 14 }}>{r.item_id}</b>
                {r.nome && <span style={{ color: T.textS, fontSize: 13 }}> → chamado de <b>{r.nome}</b></span>}
              </div>
              <div>
                {r.oculto_todos && tag('ESCONDIDO PARA TODOS', '#C04050')}
                {!r.oculto_todos && (r.ocultar_para || []).length > 0 && tag(`ESCONDIDO PARA: ${r.ocultar_para.join(', ')}`, '#E8A020')}
              </div>
              <div style={{ fontSize: 11, color: T.textT, marginTop: 4 }}>{r.updated_by || ''} · {r.updated_at ? new Date(r.updated_at).toLocaleString('pt-BR') : ''}</div>
            </div>
            <button disabled={ocupado === `${r.tipo}:${r.item_id}`} onClick={() => remover(r)} style={btn}>Remover regra</button>
          </div>
        ))}
    </div>
  );
};

export default VisibilidadeTab;
