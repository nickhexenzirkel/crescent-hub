// Helpers compartilhados entre a tela principal do Uniko Call e o Dashboard.

// Mesmos setores/cores das tags de colegas (central-colaborador/tabs/TabColegas.jsx) — o servidor grava só o id.
export const SETORES = {
  faturamento: { label: 'Faturamento', cor: '#2E8DD4' }, gestao: { label: 'Gestão', cor: '#8B5FE8' },
  financeiro: { label: 'Financeiro', cor: '#28A870' }, suporte_tecnico: { label: 'Suporte Técnico', cor: '#E08030' },
  contratual: { label: 'Contratual', cor: '#C0307A' }, distribuicao: { label: 'Distribuição', cor: '#14A3A3' },
  telemetria: { label: 'Telemetria', cor: '#5B60D0' }, pos_venda: { label: 'Pós Venda', cor: '#D9468F' },
  diretor: { label: 'Diretor', cor: '#B8860B' }, outros: { label: 'Outros', cor: '#6B7280' },
};
export const SEM_SETOR = '__sem_setor';
export const setorInfo = (id) => id === SEM_SETOR ? { label: 'Sem setor', cor: '#6B7280' } : (SETORES[id] || { label: id, cor: '#6B7280' });
export const callMs = (r) => { const ms = r.ended_at ? new Date(r.ended_at) - new Date(r.started_at) : 0; return Number.isFinite(ms) && ms > 0 ? ms : 0; };
export const totalLabel = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };
export const callsLabel = (n) => `${n} ${n === 1 ? 'ligação' : 'ligações'}`;
