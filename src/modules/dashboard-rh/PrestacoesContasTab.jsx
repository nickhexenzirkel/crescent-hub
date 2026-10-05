// Dashboard RH → aba "Prestações de Contas": prestações de TODOS os
// funcionários com cargo Comercial (cargo cujo nome contém "comercial").
import { useState, useEffect, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { loadCargos, loadCargoMembros } from '../../shared/cargoPermissions';
import { listarPrestacoes, excluirPrestacao } from '../prestacao-contas/api';
import PrestacoesPainel from '../prestacao-contas/Painel';

export default function PrestacoesContasTab() {
  const [rows, setRows] = useState([]);
  const [comerciais, setComerciais] = useState(new Set());
  const [semCargo, setSemCargo] = useState(false);
  const [func, setFunc] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

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
        : <PrestacoesPainel rows={visiveis} mostrarFuncionario onExcluir={excluir} podeExcluir={() => true} />}
    </div>
  );
}
