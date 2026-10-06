// Painel de Prestações de Contas — KPIs, gráficos e histórico. Usado pelo módulo
// do comercial (só os dele) e pela aba do Dashboard RH (todos os comerciais).
import { useMemo, useState } from 'react';
import { T } from '../../contexts/theme';
import { CATEGORIAS, STATUS_PRESTACAO, corCategoria, brl, fmtData, urlAnexo } from './api';

const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 };
const sel = { padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const Kpi = ({ label, valor, sub }) => (
  <div style={{ ...card, flex: '1 1 150px', minWidth: 140 }}>
    <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textS, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 4, fontFamily: 'var(--font-brand)' }}>{valor}</div>
    {sub && <div style={{ fontSize: 12, color: T.textS, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
  </div>
);

function Rosca({ fatias }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  if (!total) return <div style={{ color: T.textS, fontSize: 13, padding: 20, textAlign: 'center' }}>Sem gastos no período.</div>;
  const R = 52, C = 2 * Math.PI * R;
  const offsets = fatias.map((f, i) => fatias.slice(0, i).reduce((a, x) => a + (x.valor / total) * C, 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width="150" height="150" viewBox="0 0 150 150" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 75 75)">
          {fatias.map((f, i) => {
            const len = (f.valor / total) * C;
            return <circle key={f.id} cx="75" cy="75" r={R} fill="none" stroke={f.cor} strokeWidth="26" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]} />;
          })}
        </g>
        <text x="75" y="72" textAnchor="middle" fontSize="11" fill={T.textS}>Total</text>
        <text x="75" y="90" textAnchor="middle" fontSize="13" fontWeight="800" fill={T.text}>{brl(total)}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
        {fatias.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: f.cor, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{f.id}</span>
            <b>{Math.round((f.valor / total) * 100)}%</b>
            <span style={{ color: T.textS, width: 86, textAlign: 'right' }}>{brl(f.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarrasMes({ meses }) {
  const max = Math.max(...meses.map(m => m.valor), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 170, paddingTop: 8 }}>
      {meses.map(m => (
        <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: T.textS, marginBottom: 3, whiteSpace: 'nowrap' }}>{m.valor ? brl(m.valor).replace('R$', '').trim() : ''}</div>
          <div title={`${m.label}: ${brl(m.valor)}`} style={{ width: '100%', maxWidth: 46, height: `${Math.max((m.valor / max) * 100, m.valor ? 3 : 0)}%`, background: T.gold, borderRadius: '6px 6px 0 0', opacity: m.atual ? 1 : 0.6 }} />
          <div style={{ fontSize: 11.5, color: T.textS, marginTop: 5, fontWeight: m.atual ? 700 : 400 }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function Anexos({ anexos }) {
  const [erro, setErro] = useState('');
  if (!anexos?.length) return null;
  const abrir = async (a) => {
    try { window.open(await urlAnexo(a), '_blank', 'noopener'); setErro(''); } catch (e) { setErro(e.message); }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {anexos.map(a => (
        <button key={a.path} onClick={() => abrir(a)} title="Abrir comprovante"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, border: `1px solid ${T.border}`, background: T.goldGl, color: T.gold, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📎 {a.name}
        </button>
      ))}
      {erro && <span style={{ fontSize: 12, color: T.danger || '#C04050' }}>{erro}</span>}
    </div>
  );
}

/* Selo de situação (Em análise / Aprovada / Rejeitada) + a observação do RH, quando houver. */
function SituacaoPrestacao({ r }) {
  const st = STATUS_PRESTACAO[r.status] || STATUS_PRESTACAO.pendente;
  return (
    <>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: st.cor, borderRadius: 999, padding: '2px 9px' }}>{st.rot}</span>
      {r.status !== 'pendente' && r.observacao_rh && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, borderLeft: `3px solid ${st.cor}`, background: T.goldGl, fontSize: 13, color: T.text, whiteSpace: 'pre-wrap' }}>
          <b style={{ color: st.cor }}>Observação do RH{r.avaliada_por ? ` (${r.avaliada_por})` : ''}:</b> {r.observacao_rh}
        </div>
      )}
    </>
  );
}

export default function PrestacoesPainel({ rows, mostrarFuncionario = false, onExcluir, podeExcluir, onAvaliar }) {
  const [cat, setCat] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (cat && r.categoria !== cat) return false;
      if (situacao && (r.status || 'pendente') !== situacao) return false;
      if (de && r.data_gasto < de) return false;
      if (ate && r.data_gasto > ate) return false;
      if (q && !`${r.motivo} ${r.descricao || ''} ${r.employee_name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, cat, situacao, de, ate, busca]);

  const stats = useMemo(() => {
    const total = filtradas.reduce((s, r) => s + Number(r.valor), 0);
    const agora = new Date();
    const mesKey = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const doMes = filtradas.filter(r => r.data_gasto.startsWith(mesKey)).reduce((s, r) => s + Number(r.valor), 0);
    const maior = filtradas.reduce((m, r) => (Number(r.valor) > Number(m?.valor || 0) ? r : m), null);
    const porCat = {};
    filtradas.forEach(r => { porCat[r.categoria] = (porCat[r.categoria] || 0) + Number(r.valor); });
    const fatias = Object.entries(porCat).map(([id, valor]) => ({ id, valor, cor: corCategoria(id) })).sort((a, b) => b.valor - a.valor);
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      meses.push({ key, label: MESES[d.getMonth()], atual: i === 0, valor: filtradas.filter(r => r.data_gasto.startsWith(key)).reduce((s, r) => s + Number(r.valor), 0) });
    }
    const porFunc = {};
    filtradas.forEach(r => { const k = r.employee_name || '—'; porFunc[k] = (porFunc[k] || 0) + Number(r.valor); });
    const ranking = Object.entries(porFunc).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    return { total, doMes, maior, fatias, meses, ranking };
  }, [filtradas]);

  const maxRank = Math.max(...stats.ranking.map(r => r.valor), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Kpi label="Total no período" valor={brl(stats.total)} sub={`${filtradas.length} lançamento${filtradas.length === 1 ? '' : 's'}`} />
        <Kpi label="Este mês" valor={brl(stats.doMes)} />
        <Kpi label="Média por lançamento" valor={brl(filtradas.length ? stats.total / filtradas.length : 0)} />
        <Kpi label="Maior gasto" valor={brl(stats.maior?.valor)} sub={stats.maior?.motivo} />
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 340px' }}>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 12, fontSize: 14 }}>Gastos por categoria</div>
          <Rosca fatias={stats.fatias} />
        </div>
        <div style={{ ...card, flex: '1 1 340px' }}>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 4, fontSize: 14 }}>Evolução — últimos 6 meses</div>
          <BarrasMes meses={stats.meses} />
        </div>
      </div>

      {mostrarFuncionario && stats.ranking.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 12, fontSize: 14 }}>Gastos por comercial</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.ranking.map(r => (
              <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text }}>
                <span style={{ width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span>
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: T.goldGl, overflow: 'hidden' }}>
                  <div style={{ width: `${(r.valor / maxRank) * 100}%`, height: '100%', background: T.gold, borderRadius: 6 }} />
                </div>
                <b style={{ width: 96, textAlign: 'right', flexShrink: 0 }}>{brl(r.valor)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: T.text, fontSize: 14, marginRight: 'auto' }}>Histórico de prestações</div>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" style={{ ...sel, width: 140 }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={sel}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
          </select>
          <select value={situacao} onChange={e => setSituacao(e.target.value)} style={sel}>
            <option value="">Todas as situações</option>
            {Object.entries(STATUS_PRESTACAO).map(([id, st]) => <option key={id} value={id}>{st.rot}</option>)}
          </select>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} style={sel} title="De" />
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={sel} title="Até" />
        </div>
        {filtradas.length === 0 ? (
          <div style={{ color: T.textS, fontSize: 13.5, textAlign: 'center', padding: '26px 0' }}>Nenhuma prestação de contas encontrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtradas.map(r => (
              <div key={r.id} style={{ border: `1px solid ${T.border}`, borderLeft: `4px solid ${corCategoria(r.categoria)}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ color: T.text, fontSize: 14 }}>{r.motivo}</b>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: corCategoria(r.categoria) }}>{r.categoria}</span>
                  <SituacaoPrestacao r={r} />
                  <span style={{ marginLeft: 'auto', fontWeight: 800, color: T.text, fontSize: 15 }}>{brl(r.valor)}</span>
                </div>
                <div style={{ fontSize: 12, color: T.textS, marginTop: 2 }}>
                  {fmtData(r.data_gasto)}{mostrarFuncionario && r.employee_name ? ` · ${r.employee_name}` : ''}
                </div>
                {r.descricao && <div style={{ fontSize: 13, color: T.text, marginTop: 6, whiteSpace: 'pre-wrap' }}>{r.descricao}</div>}
                <Anexos anexos={r.anexos} />
                {onAvaliar && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => onAvaliar(r, 'aprovada')} disabled={r.status === 'aprovada'}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: STATUS_PRESTACAO.aprovada.cor, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: r.status === 'aprovada' ? 'default' : 'pointer', opacity: r.status === 'aprovada' ? 0.45 : 1, fontFamily: 'var(--font-body)' }}>
                      ✓ Aprovar
                    </button>
                    <button onClick={() => onAvaliar(r, 'rejeitada')} disabled={r.status === 'rejeitada'}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: STATUS_PRESTACAO.rejeitada.cor, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: r.status === 'rejeitada' ? 'default' : 'pointer', opacity: r.status === 'rejeitada' ? 0.45 : 1, fontFamily: 'var(--font-body)' }}>
                      ✕ Rejeitar
                    </button>
                  </div>
                )}
                {podeExcluir?.(r) && (
                  <button onClick={() => onExcluir?.(r)} style={{ marginTop: 8, background: 'transparent', border: 'none', color: T.danger || '#C04050', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>Excluir</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
