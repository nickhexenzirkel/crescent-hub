// Dashboard RH → aba "Gerenciar Permissões".
// Cargos: camada ADICIONAL de acesso a módulo, por cima do admin/moderador
// que já existem (esses continuam vendo tudo, sem nenhuma mudança). Cada
// cargo lista os módulos liberados; um colaborador pode ter vários cargos —
// o acesso dele é a UNIÃO dos módulos de todos os cargos atribuídos. Só
// admin de verdade vê esta aba (ver isRestrito em index.jsx — nem moderador
// nem quem só tem cargo consegue criar/editar cargo, pra não se
// autoconceder mais acesso).
import { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { SERVER_URL } from '../../contexts/user';
import { Card, Btn } from '../../shared/components';
import { MODULES_CATALOG } from '../../shared/modulesCatalog';
import {
  loadCargos, loadCargoMembros, createCargo, renameCargo,
  updateCargoModules, deleteCargo, addMembro, removeMembro,
} from '../../shared/cargoPermissions';

const authHeader = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` });

const GerenciarPermissoesTab = ({ cardBg }) => {
  const bg = cardBg || T.surface;
  const [cargos, setCargos] = useState([]);
  const [membros, setMembros] = useState([]); // [{id, cargo_id, employee_id}]
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [novoCargoNome, setNovoCargoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [expandido, setExpandido] = useState(null); // id do cargo aberto
  const [buscaPessoa, setBuscaPessoa] = useState({}); // {cargoId: termo}
  const [renomeando, setRenomeando] = useState(null); // {id, nome}

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2800); };

  const empById = (id) => employees.find(e => e.id === id);

  const load = async () => {
    setLoading(true);
    try {
      const [cargosData, membrosData, empRes] = await Promise.all([
        loadCargos(),
        loadCargoMembros(),
        fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() }).then(r => r.json()).catch(() => ({ employees: [] })),
      ]);
      setCargos(cargosData);
      setMembros(membrosData);
      setEmployees((empRes.employees || []).filter(e => e.active !== false));
    } catch (err) {
      flash('Erro ao carregar: ' + err.message);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const criarCargo = async () => {
    const nome = novoCargoNome.trim();
    if (!nome) { flash('Digite o nome do cargo.'); return; }
    setCriando(true);
    try {
      const novo = await createCargo(nome);
      setCargos(prev => [...prev, novo].sort((a, b) => a.name.localeCompare(b.name)));
      setNovoCargoNome('');
      setExpandido(novo.id);
      flash('Cargo criado.');
    } catch (err) {
      flash('Erro: ' + err.message);
    }
    setCriando(false);
  };

  const salvarNome = async () => {
    if (!renomeando || !renomeando.nome.trim()) return;
    try {
      await renameCargo(renomeando.id, renomeando.nome.trim());
      setCargos(prev => prev.map(c => c.id === renomeando.id ? { ...c, name: renomeando.nome.trim() } : c));
      setRenomeando(null);
    } catch (err) { flash('Erro: ' + err.message); }
  };

  const toggleModulo = async (cargo, moduleId) => {
    const atual = cargo.module_ids || [];
    const novo = atual.includes(moduleId) ? atual.filter(m => m !== moduleId) : [...atual, moduleId];
    setCargos(prev => prev.map(c => c.id === cargo.id ? { ...c, module_ids: novo } : c)); // otimista
    try {
      await updateCargoModules(cargo.id, novo);
    } catch (err) {
      flash('Erro: ' + err.message);
      setCargos(prev => prev.map(c => c.id === cargo.id ? { ...c, module_ids: atual } : c)); // desfaz
    }
  };

  const excluirCargo = async (cargo) => {
    if (!window.confirm(`Excluir o cargo "${cargo.name}"? Quem estava nele perde o acesso liberado por ele imediatamente.`)) return;
    try {
      await deleteCargo(cargo.id);
      setCargos(prev => prev.filter(c => c.id !== cargo.id));
      setMembros(prev => prev.filter(m => m.cargo_id !== cargo.id));
      flash('Cargo excluído.');
    } catch (err) { flash('Erro: ' + err.message); }
  };

  const adicionarPessoa = async (cargoId, employeeId) => {
    try {
      await addMembro(cargoId, employeeId);
      setMembros(prev => [...prev, { id: `tmp-${employeeId}`, cargo_id: cargoId, employee_id: employeeId }]);
      setBuscaPessoa(prev => ({ ...prev, [cargoId]: '' }));
      load(); // recarrega pra pegar o id real do vínculo
    } catch (err) { flash('Erro: ' + err.message); }
  };

  const removerPessoa = async (cargoId, employeeId) => {
    try {
      await removeMembro(cargoId, employeeId);
      setMembros(prev => prev.filter(m => !(m.cargo_id === cargoId && m.employee_id === employeeId)));
    } catch (err) { flash('Erro: ' + err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Cabeçalho */}
      <div style={{ padding: '14px 20px', borderRadius: 13, background: bg, border: `1px solid ${T.border}`, boxShadow: T.shM }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: '.04em' }}>Gerenciar Permissões</div>
        <div style={{ fontSize: 13, color: T.textS, marginTop: 2 }}>
          Crie cargos e marque quais módulos cada um libera. Isso é ADICIONAL ao acesso de Administrador/Moderador — eles continuam vendo tudo do jeito que já é. Um colaborador pode ter vários cargos ao mesmo tempo: o acesso dele é a soma dos módulos de todos os cargos que tiver.
        </div>
      </div>

      {/* Criar cargo */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 10 }}>Novo cargo</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={novoCargoNome} onChange={e => setNovoCargoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && criarCargo()}
            placeholder="Ex: Supervisor Financeiro"
            style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surface, fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
          <Btn v="primary" onClick={criarCargo} disabled={criando}>{criando ? 'Criando…' : '+ Criar cargo'}</Btn>
        </div>
      </Card>

      {/* Lista de cargos */}
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando…</div>
      ) : cargos.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: T.textT, fontSize: 13 }}>Nenhum cargo criado ainda.</div>
      ) : cargos.map(cargo => {
        const aberto = expandido === cargo.id;
        const membrosDoCargo = membros.filter(m => m.cargo_id === cargo.id);
        const termo = (buscaPessoa[cargo.id] || '').trim().toLowerCase();
        const jaNoCargo = new Set(membrosDoCargo.map(m => m.employee_id));
        const sugestoes = termo.length >= 1
          ? employees.filter(e => !jaNoCargo.has(e.id) && e.name.toLowerCase().includes(termo)).slice(0, 8)
          : [];

        return (
          <Card key={cargo.id} style={{ padding: 0, overflow: 'visible' }}>
            <div onClick={() => setExpandido(aberto ? null : cargo.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                <polyline points="9 6 15 12 9 18" />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{cargo.name}</div>
                <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>
                  {(cargo.module_ids || []).length} módulo{(cargo.module_ids || []).length === 1 ? '' : 's'} · {membrosDoCargo.length} pessoa{membrosDoCargo.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {aberto && (
              <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }} onClick={e => e.stopPropagation()}>
                {/* Nome do cargo */}
                <div>
                  {renomeando?.id === cargo.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input autoFocus value={renomeando.nome} onChange={e => setRenomeando({ id: cargo.id, nome: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && salvarNome()}
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${T.gold}`, background: T.surface, fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
                      <Btn v="primary" onClick={salvarNome}>Salvar</Btn>
                      <Btn v="ghostGray" onClick={() => setRenomeando(null)}>Cancelar</Btn>
                    </div>
                  ) : (
                    <button onClick={() => setRenomeando({ id: cargo.id, nome: cargo.name })}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 12, fontFamily: 'var(--font-body)', padding: 0, textDecoration: 'underline' }}>
                      Renomear cargo
                    </button>
                  )}
                </div>

                {/* Módulos liberados */}
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 8 }}>Módulos liberados</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {MODULES_CATALOG.map(mod => {
                      const ativo = (cargo.module_ids || []).includes(mod.id);
                      return (
                        <button key={mod.id} onClick={() => toggleModulo(cargo, mod.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, cursor: 'pointer',
                            border: `1.5px solid ${ativo ? T.gold : T.border}`, background: ativo ? T.goldGl : 'transparent',
                            color: ativo ? T.gold : T.textS, fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                          {ativo && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                          {mod.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pessoas no cargo */}
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 8 }}>Pessoas neste cargo</div>
                  {membrosDoCargo.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                      {membrosDoCargo.map(m => {
                        const emp = empById(m.employee_id);
                        return (
                          <span key={m.employee_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,0.04)', border: `1px solid ${T.border}`, fontSize: 12.5, color: T.text }}>
                            {emp?.name || 'Colaborador removido'}
                            <button onClick={() => removerPessoa(cargo.id, m.employee_id)} title="Remover do cargo"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex', padding: 0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ position: 'relative', maxWidth: 320 }}>
                    <input value={buscaPessoa[cargo.id] || ''} onChange={e => setBuscaPessoa(prev => ({ ...prev, [cargo.id]: e.target.value }))}
                      placeholder="Buscar colaborador pra adicionar…"
                      style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, fontSize: 12.5, color: T.text, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
                    {sugestoes.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, boxShadow: T.shM, zIndex: 20, maxHeight: 200, overflowY: 'auto' }}>
                        {sugestoes.map(e => (
                          <div key={e.id} onClick={() => adicionarPessoa(cargo.id, e.id)}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, color: T.text, borderBottom: `1px solid ${T.border}` }}
                            onMouseEnter={ev => ev.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,0.03)'}
                            onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                            {e.name} <span style={{ color: T.textT }}>· {e.cargo || 'sem cargo de RH cadastrado'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Btn v="danger" onClick={() => excluirCargo(cargo)}>Excluir cargo</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {msg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: T.text, color: T.surface, padding: '11px 20px', borderRadius: 11, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {msg}
        </div>
      )}
    </div>
  );
};

export default GerenciarPermissoesTab;
