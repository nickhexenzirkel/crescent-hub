// Prestações de Contas — o comercial lança os gastos necessários feitos pela
// empresa (valor, motivo, descrição, comprovante) e acompanha o próprio
// histórico e gráficos. O RH vê todos em Dashboard RH → Prestações de Contas.
// Precisa de supabase_prestacao_contas.sql rodado.
import { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';
import { getAuthUser } from '../../contexts/user';
import PrestacoesPainel from './Painel';
import { CATEGORIAS, listarPrestacoes, criarPrestacao, excluirPrestacao, enviarAnexo, hojeISO } from './api';

const input = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' };
const label = { fontSize: 12, fontWeight: 700, color: T.textS, marginBottom: 4, display: 'block' };

function NovaPrestacao({ authUser, onClose, onSaved }) {
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0].id);
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hojeISO());
  const [arquivos, setArquivos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef(null);

  const valorNum = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
  const salvar = async () => {
    if (!(valorNum > 0)) { setErro('Informe o valor do gasto.'); return; }
    if (!motivo.trim()) { setErro('Informe o motivo.'); return; }
    if (!arquivos.length) { setErro('Anexe pelo menos um recibo ou comprovante.'); return; }
    setSalvando(true); setErro('');
    try {
      const anexos = [];
      for (const f of arquivos) anexos.push(await enviarAnexo(f, authUser.cpf));
      const row = await criarPrestacao({
        employee_id: String(authUser.id), employee_cpf: authUser.cpf || null, employee_name: authUser.name || null,
        categoria, motivo: motivo.trim(), descricao: descricao.trim() || null, valor: valorNum, data_gasto: data, anexos,
      });
      onSaved(row);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, color: T.text, borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, marginBottom: 16 }}>Nova prestação de contas</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px' }}>
            <label style={label}>Valor (R$)</label>
            <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" style={input} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={label}>Data do gasto</label>
            <input type="date" value={data} max={hojeISO()} onChange={e => setData(e.target.value)} style={input} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={label}>Categoria</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} style={input}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={label}>Motivo</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: Almoço com cliente, visita à empresa X" maxLength={120} style={input} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={label}>Descrição (opcional)</label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="Detalhes do gasto…" style={{ ...input, resize: 'vertical' }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={label}>Recibo / comprovante</label>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }}
            onChange={e => { setArquivos(prev => [...prev, ...Array.from(e.target.files || [])].slice(0, 6)); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} style={{ ...input, cursor: 'pointer', borderStyle: 'dashed', color: T.gold, fontWeight: 700, background: T.goldGl }}>
            📎 Anexar foto ou PDF
          </button>
          {arquivos.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: T.danger || '#C04050', cursor: 'pointer', fontSize: 12 }}>remover</button>
            </div>
          ))}
        </div>
        {erro && <div style={{ marginTop: 12, color: T.danger || '#C04050', fontSize: 13, fontWeight: 600 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={salvando} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: T.gold, color: '#fff', cursor: salvando ? 'default' : 'pointer', fontWeight: 700, opacity: salvando ? 0.7 : 1, fontFamily: 'var(--font-body)' }}>
            {salvando ? 'Enviando…' : 'Enviar prestação'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PrestacaoContas({ onBack, authUser: authProp }) {
  const authUser = authProp || getAuthUser() || {};
  const [rows, setRows] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarPrestacoes(authUser.id)
      .then(r => { if (vivo) setRows(r); })
      .catch(e => { if (vivo) setErro(e.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [authUser.id]);

  const excluir = async (p) => {
    if (!window.confirm(`Excluir a prestação "${p.motivo}"? Os comprovantes também serão apagados.`)) return;
    try { await excluirPrestacao(p); setRows(r => r.filter(x => x.id !== p.id)); } catch (e) { setErro(e.message); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.page, color: T.text, fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: `1px solid ${T.border}`, background: T.topbarBg || T.surface }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', padding: '6px 8px', borderRadius: 8 }}>‹ Módulos</button>
        <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 18 }}>Prestações de Contas</div>
        <button onClick={() => setNovo(true)} style={{ marginLeft: 'auto', padding: '9px 16px', borderRadius: 10, border: 'none', background: T.gold, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>+ Nova prestação</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize: 13.5, color: T.textS, marginBottom: 14 }}>
            Registre aqui os gastos necessários feitos pela empresa no seu trabalho comercial, com recibo ou comprovante.
          </div>
          {erro && <div style={{ color: T.danger || '#C04050', fontSize: 13, marginBottom: 12 }}>{erro}</div>}
          {carregando ? <div style={{ color: T.textS }}>Carregando…</div>
            : <PrestacoesPainel rows={rows} onExcluir={excluir} podeExcluir={() => true} />}
        </div>
      </div>
      {novo && <NovaPrestacao authUser={authUser} onClose={() => setNovo(false)} onSaved={(row) => { setRows(r => [row, ...r]); setNovo(false); }} />}
    </div>
  );
}
