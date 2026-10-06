// Dashboard RH → aba "Prestações de Contas": prestações de TODOS os
// funcionários com cargo Comercial (cargo cujo nome contém "comercial").
import { useState, useEffect, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { loadCargos, loadCargoMembros } from '../../shared/cargoPermissions';
import { getAuthUser } from '../../contexts/user';
import { listarPrestacoes, excluirPrestacao, avaliarPrestacao, STATUS_PRESTACAO, brl } from '../prestacao-contas/api';
import PrestacoesPainel from '../prestacao-contas/Painel';

/* Janela de decisão: aprovar ou rejeitar, com uma observação (obrigatória só ao rejeitar —
   o comercial precisa saber o motivo). O aviso na Caixa de Entrada dele sai sozinho. */
function AvaliarModal({ p, status, onClose, onSalvo }) {
  const [obs, setObs] = useState(p.status === status ? (p.observacao_rh || '') : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const rejeitar = status === 'rejeitada';
  const st = STATUS_PRESTACAO[status];
  const salvar = async () => {
    if (rejeitar && !obs.trim()) { setErro('Explique o motivo da rejeição para o comercial.'); return; }
    setSalvando(true); setErro('');
    try { onSalvo(await avaliarPrestacao(p.id, status, obs, getAuthUser()?.name)); }
    catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, color: T.text, borderRadius: 16, width: '100%', maxWidth: 460, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: st.cor }}>
          {rejeitar ? 'Rejeitar prestação de contas' : 'Aprovar prestação de contas'}
        </div>
        <div style={{ fontSize: 13, color: T.textS, margin: '6px 0 14px' }}>
          <b style={{ color: T.text }}>{p.motivo}</b> · {brl(p.valor)} · {p.employee_name}
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: T.textS, display: 'block', marginBottom: 4 }}>
          Observação {rejeitar ? '(motivo da rejeição)' : '(opcional)'}
        </label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={4} maxLength={600} autoFocus
          placeholder={rejeitar ? 'Ex.: comprovante ilegível, valor não confere com o recibo…' : 'Ex.: aprovado, será reembolsado na folha…'}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-body)' }} />
        <div style={{ fontSize: 12, color: T.textS, marginTop: 6 }}>O comercial recebe um aviso na Caixa de Entrada com essa observação.</div>
        {erro && <div style={{ marginTop: 10, color: T.danger || '#C04050', fontSize: 13, fontWeight: 600 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={salvando} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: st.cor, color: '#fff', cursor: salvando ? 'default' : 'pointer', fontWeight: 700, opacity: salvando ? 0.7 : 1, fontFamily: 'var(--font-body)' }}>
            {salvando ? 'Salvando…' : rejeitar ? 'Rejeitar' : 'Aprovar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PrestacoesContasTab() {
  const [rows, setRows] = useState([]);
  const [comerciais, setComerciais] = useState(new Set());
  const [semCargo, setSemCargo] = useState(false);
  const [func, setFunc] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [avaliando, setAvaliando] = useState(null);   // { p, status }

  useEffect(() => {
    (async () => {
      try {
        const [cargos, membros, todas] = await Promise.all([loadCargos(), loadCargoMembros(), listarPrestacoes()]);
        const ids = new Set(cargos.filter(c => /comercial/i.test(c.name)).map(c => c.id));
        setSemCargo(ids.size === 0);
        setComerciais(new Set(membros.filter(m => ids.has(m.cargo_id)).map(m => String(m.employee_id))));
        setRows(todas);
      } catch (e) { setErro(e.message); }
      setCarregando(false);
    })();
  }, []);

  const doComercial = useMemo(() => rows.filter(r => comerciais.has(String(r.employee_id))), [rows, comerciais]);
  const nomes = useMemo(() => {
    const m = new Map();
    doComercial.forEach(r => m.set(String(r.employee_id), r.employee_name || '—'));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [doComercial]);
  const visiveis = func ? doComercial.filter(r => String(r.employee_id) === func) : doComercial;

  const excluir = async (p) => {
    if (!window.confirm(`Excluir a prestação "${p.motivo}" de ${p.employee_name}?`)) return;
    try { await excluirPrestacao(p); setRows(r => r.filter(x => x.id !== p.id)); } catch (e) { setErro(e.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800, color: T.text, marginRight: 'auto' }}>Prestações de Contas — Comercial</div>
        <select value={func} onChange={e => setFunc(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontFamily: 'var(--font-body)' }}>
          <option value="">Todos os comerciais</option>
          {nomes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
      </div>
      {erro && <div style={{ color: T.danger || '#C04050', fontSize: 13 }}>{erro}</div>}
      {semCargo && !carregando && (
        <div style={{ color: T.textS, fontSize: 13 }}>Nenhum cargo com "Comercial" no nome foi encontrado em Gerenciar Permissões — crie o cargo e adicione os funcionários.</div>
      )}
      {carregando ? <div style={{ color: T.textS }}>Carregando…</div>
        : <PrestacoesPainel rows={visiveis} mostrarFuncionario onExcluir={excluir} podeExcluir={() => true}
          onAvaliar={(p, status) => setAvaliando({ p, status })} />}
      {avaliando && (
        <AvaliarModal p={avaliando.p} status={avaliando.status} onClose={() => setAvaliando(null)}
          onSalvo={(nova) => { setRows(r => r.map(x => (x.id === nova.id ? nova : x))); setAvaliando(null); }} />
      )}
    </div>
  );
}
