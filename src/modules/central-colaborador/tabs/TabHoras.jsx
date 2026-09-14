import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase as _supabase } from '../../../contexts/user';
import { computePontoDays, loadColaboradorPonto } from '../../../shared/pontoCalc';
import { useIsMobile } from '../../../hooks/useIsMobile';
import {
  Ico, G, alpha, tone, Pill, StatusPill, PortalKitStyles, PortalHero, HeroStat, HeroChip, HeroAside,
  SectionCard, SearchField, SelectField, ListRow, MetaLine, Dot, Tile, RED_GRAD, Spinner, Empty,
} from './portalKit';

const BRL = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calcHoras = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  return Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
};

const fmtHoras = h => {
  if (!h || h <= 0) return '0h';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2, '0')}` : `${hh}h`;
};

const fmtData = iso => {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
};

const fmtMin = m => { const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60; return `${m < 0 ? '-' : ''}${h}h${mm.toString().padStart(2, '0')}`; };
const diaSemana = iso => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }); } catch { return ''; } };
const hhmm = t => (t || '').slice(0, 5);

const nowTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false });

const todayIso = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

// Status dos registros de extra (e o marcador dos dias negativos do ponto).
const statusStyle = (status) => ({
  pendente:  { label: 'Pendente',  ...tone('warn') },
  aprovado:  { label: 'Aprovado',  ...tone('pos') },
  rejeitado: { label: 'Rejeitado', ...tone('neg') },
  negativa:  { label: 'Ponto',     ...tone('muted') },
}[status] || { label: 'Pendente', ...tone('warn') });

const FILTROS = [
  { grupo: 'Tipo', itens: [['todos', 'Todos os tipos'], ['extra', 'Horas extras'], ['feriado', 'Feriado / Domingo'], ['negativa', 'Negativas do ponto']] },
  { grupo: 'Status', itens: [['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['rejeitado', 'Rejeitados']] },
];


const TabHoras = () => {
  const isMobile  = useIsMobile();
  const authData  = getAuthUser();
  const salarioBase = USER.salary || authData?.salary || 0;
  const salario1k   = USER.salary_1k || authData?.salary_1k || 0;
  const salario     = salarioBase + salario1k;          // base + 1K Service
  const valorHora   = salario > 0 ? salario / 240 : 0;  // salário ÷ 30 dias ÷ 8h

  const [registros, setRegistros] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [modal,     setModal]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');
  const [horaFimErr, setHoraFimErr] = useState('');
  const [search,    setSearch]    = useState('');
  const [filtro,    setFiltro]    = useState('todos');
  const [aberto,    setAberto]    = useState(null);
  const [form,      setForm]      = useState({
    data: new Date().toISOString().slice(0, 10),
    descricao: '',
    hora_inicio: '',
    hora_fim: '',
    feriado_domingo: false,
  });

  const loadRegistros = async () => {
    setLoading(true);
    const { data } = await _supabase.from('banco_horas')
      .select('*').eq('created_by', USER.name)
      .order('created_at', { ascending: false });
    setRegistros(data || []);
    setLoading(false);
  };

  // Saldo do ponto (negativas) — calculado das marcações do colaborador (vínculo/nome).
  const [negDays, setNegDays] = useState([]);
  const [pontoBalanceMin, setPontoBalanceMin] = useState(0); // saldo líquido do ponto (min)
  useEffect(() => {
    let alive = true;
    (async () => {
      const { marcacoes, justifs, limiteISO } = await loadColaboradorPonto({ cpf: authData?.cpf || USER.cpf, name: USER.name });
      if (!alive) return;
      const abonado = new Set((justifs || []).filter(j => j.texto && j.abonado !== false).map(j => j.data));
      const days = computePontoDays(marcacoes, abonado, { limiteISO });
      const negs = days.filter(d => d.balance < 0).map(d => ({ data: d.date, saldo: d.balance })).sort((a, b) => (a.data < b.data ? 1 : -1));
      setNegDays(negs);
      setPontoBalanceMin(days.reduce((a, d) => a + d.balance, 0));
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { loadRegistros(); }, []);

  const delRegistro = async (id) => {
    if (!window.confirm('Remover este registro?')) return;
    await _supabase.from('banco_horas').delete().eq('id', id);
    await loadRegistros();
  };

  const totalValor     = registros.reduce((a, r) => a + Number(r.valor_total || 0), 0);

  // Banco LÍQUIDO = horas extras (não rejeitadas) − horas negativas do ponto.
  const extraMin   = registros.filter(r => r.status !== 'rejeitado').reduce((a, r) => a + Number(r.horas_calculadas || 0) * 60, 0);
  const netMin     = extraMin + pontoBalanceMin;       // pontoBalanceMin é negativo se devendo horas
  const netPos     = netMin >= 0;

  const previewTotal = calcHoras(form.hora_inicio, form.hora_fim);
  const previewCalc  = previewTotal * (form.feriado_domingo ? 2 : 1);
  const previewMult  = form.feriado_domingo ? 2.0 : 1.5;
  const previewValor = valorHora > 0 ? previewTotal * valorHora * previewMult : null;

  const openModal = () => {
    setForm({ data: todayIso(), descricao: '', hora_inicio: '', hora_fim: '', feriado_domingo: false });
    setMsg(''); setHoraFimErr('');
    setModal(true);
  };

  const saveRegistro = async () => {
    if (!form.descricao.trim())    { setMsg('Informe a descrição do serviço'); return; }
    if (!form.hora_inicio || !form.hora_fim) { setMsg('Informe hora início e hora fim'); return; }
    if (form.data === todayIso() && form.hora_fim > nowTime()) { setMsg('Hora fim não pode ser no futuro'); return; }
    const total = calcHoras(form.hora_inicio, form.hora_fim);
    if (total <= 0) { setMsg('Hora fim deve ser maior que hora início'); return; }
    setSaving(true); setMsg('');
    const calc         = total * (form.feriado_domingo ? 2 : 1);
    const multiplicador = form.feriado_domingo ? 2.0 : 1.5;
    const vH   = valorHora > 0 ? valorHora : null;
    const vT   = vH ? total * vH * multiplicador : null;
    const { error } = await _supabase.from('banco_horas').insert({
      created_by:       USER.name,
      data:             form.data,
      descricao:        form.descricao,
      hora_inicio:      form.hora_inicio,
      hora_fim:         form.hora_fim,
      total_horas:      total,
      feriado_domingo:  form.feriado_domingo,
      horas_calculadas: calc,
      valor_hora:       vH,
      valor_total:      vT,
      status:           'pendente',
    });
    if (error) { setMsg('Erro: ' + error.message); setSaving(false); return; }
    await loadRegistros();
    setModal(false);
    setSaving(false);
  };

  // Histórico unificado: registros de extra + dias negativos do ponto, do mais recente pro mais antigo.
  const itens = [
    ...registros.map(r => ({ kind: 'extra', key: 'r' + r.id, data: r.data, r })),
    ...negDays.map(d => ({ kind: 'negativa', key: 'n' + d.data, data: d.data, d })),
  ].sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? 1 : -1));

  const q = search.trim().toLowerCase();
  const filtrados = itens.filter(it => {
    if (filtro === 'extra'    && it.kind !== 'extra') return false;
    if (filtro === 'feriado'  && !(it.kind === 'extra' && it.r.feriado_domingo)) return false;
    if (filtro === 'negativa' && it.kind !== 'negativa') return false;
    if (['pendente', 'aprovado', 'rejeitado'].includes(filtro) && !(it.kind === 'extra' && it.r.status === filtro)) return false;
    if (!q) return true;
    const alvo = it.kind === 'extra'
      ? `${it.r.descricao} ${fmtData(it.r.data)} ${it.r.status}`
      : `ponto negativa ${fmtData(it.data)} ${diaSemana(it.data)}`;
    return alvo.toLowerCase().includes(q);
  });

  const pontoNeg = pontoBalanceMin < 0;

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <PortalKitStyles />

      {/* ── CABEÇALHO (saldo LÍQUIDO: extras − negativas do ponto) ── */}
      <PortalHero isMobile={isMobile} icon={G.clock} kicker="BANCO DE HORAS" title="Seu tempo, no" accent="seu ritmo"
        subtitle="Acompanhe suas horas acumuladas, visualize os registros e mantenha seu banco sempre em dia."
        card={{
          icon: G.coins, label: 'SALDO ATUAL', value: `${netPos ? '+' : ''}${fmtMin(netMin)}`,
          negative: !netPos, note: !netPos ? 'saldo devendo' : null,
          stats: <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
              <HeroStat icon={G.upCircle} color="#3DDC97" label="Extras" value={fmtMin(extraMin)} />
              {pontoBalanceMin !== 0 && (
                <HeroStat icon={pontoNeg ? G.downCircle : G.clock} color={pontoNeg ? '#FF8A9C' : '#6BB8FF'}
                  label="Ponto" value={pontoNeg ? fmtMin(pontoBalanceMin) : '+' + fmtMin(pontoBalanceMin)} />
              )}
            </div>
            {valorHora > 0 && totalValor > 0 && <HeroChip icon={G.money}>Extras: {BRL(totalValor)}</HeroChip>}
          </>,
          aside: <HeroAside icon={G.clock} label="Total de registros" value={registros.length} />,
        }}
        action={{ label: 'Registrar Horas', icon: G.calPlus, onClick: openModal }} />

      {/* ── HISTÓRICO ── */}
      <SectionCard isMobile={isMobile} icon={G.clock} title="Histórico" subtitle="Aqui você encontra todos os registros de horas do seu banco."
        tools={<>
          <SearchField value={search} onChange={setSearch} placeholder="Buscar no histórico..." />
          <SelectField value={filtro} onChange={setFiltro} options={FILTROS} />
        </>}>
        {loading
          ? <Spinner />
          : filtrados.length === 0
            ? <Empty title={itens.length === 0 ? 'Nenhuma hora registrada ainda.' : 'Nada encontrado com esse filtro.'}
                hint={itens.length === 0 ? 'Use o botão acima para registrar suas horas extras.' : null} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtrados.map(it => <HistRow key={it.key} it={it} isMobile={isMobile} open={aberto === it.key}
                  onToggle={() => setAberto(a => (a === it.key ? null : it.key))} onDelete={delRegistro} />)}
              </div>
        }
      </SectionCard>

      {/* ── MODAL REGISTRO ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: isMobile ? 12 : 0, boxSizing: 'border-box' }}>
          <div style={{ background: T.surface || 'white', borderRadius: 20, padding: isMobile ? '22px 18px' : 32, width: isMobile ? '100%' : 460, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${T.border}`, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 20, textAlign: isMobile ? 'center' : 'left' }}>
              Registrar Horas Extras
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Data</div>
              <input type="date" value={form.data} onChange={e => { setHoraFimErr(''); setForm(p => ({ ...p, data: e.target.value })); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Descrição do serviço *</div>
              <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Plantão, reunião extra, entrega de relatório..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Hora início *</div>
                <input type="time" value={form.hora_inicio} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Hora fim *</div>
                <input type="time" value={form.hora_fim}
                  max={form.data === todayIso() ? nowTime() : undefined}
                  onChange={e => {
                    const val = e.target.value;
                    if (form.data === todayIso() && val > nowTime()) {
                      setHoraFimErr(`Não é possível registrar um horário futuro. Aguarde até ${val} para lançar.`);
                      return;
                    }
                    setHoraFimErr('');
                    setForm(p => ({ ...p, hora_fim: val }));
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {horaFimErr && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 13px', borderRadius: 9, background: 'rgba(192,64,80,0.07)', border: '1px solid rgba(192,64,80,0.25)', marginBottom: 4 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 12.5, color: '#C04050', lineHeight: 1.5 }}>{horaFimErr}</span>
              </div>
            )}

            {/* Toggle Feriado/Domingo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(216,144,48,0.08)', border: '1px solid rgba(216,144,48,0.22)', marginBottom: 16, cursor: 'pointer' }}
              onClick={() => setForm(p => ({ ...p, feriado_domingo: !p.feriado_domingo }))}>
              <div style={{ width: 38, height: 22, borderRadius: 11, border: 'none', outline: 'none', flexShrink: 0, background: form.feriado_domingo ? '#D89030' : 'rgba(0,0,0,0.15)', position: 'relative', transition: 'background .2s', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', left: form.feriado_domingo ? 19 : 3, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#D89030' }}>Feriado / Domingo</div>
                <div style={{ fontSize: 11, color: T.textS }}>Horas contadas em dobro no banco (×2)</div>
              </div>
            </div>

            {/* Preview do cálculo */}
            {previewTotal > 0 && (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: `rgba(78,143,168,0.08)`, border: `1px solid rgba(78,143,168,0.22)`, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.blue || '#2A6FB5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Estimativa do cálculo</div>

                {/* Fórmula detalhada */}
                {valorHora > 0 && (
                  <div style={{ fontSize: 12.5, color: T.text, marginBottom: 12, padding: '8px 10px', background: 'rgba(26,156,112,0.07)', borderRadius: 7, border: '1px solid rgba(26,156,112,0.18)', fontFamily: 'monospace', lineHeight: 1.7 }}>
                    {form.hora_inicio} — {form.hora_fim} = <strong>{previewTotal.toFixed(2)}h</strong> × <strong>{BRL(valorHora)}</strong> × <strong style={{ color: form.feriado_domingo ? '#D89030' : T.blue }}>{form.feriado_domingo ? '200% (base + 100%)' : '150% (base + 50%)'}</strong> = <strong style={{ color: '#1A9C70', fontSize: 14 }}>{BRL(previewValor)}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left' }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textD, marginBottom: 2 }}>Horas trabalhadas</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{fmtHoras(previewTotal)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textD, marginBottom: 2 }}>No banco {form.feriado_domingo ? '(×2)' : '(×1)'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: form.feriado_domingo ? '#D89030' : T.text }}>{fmtHoras(previewCalc)}</div>
                  </div>
                  {previewValor !== null && (
                    <div>
                      <div style={{ fontSize: 11, color: T.textD, marginBottom: 2 }}>Valor a receber</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1A9C70' }}>{BRL(previewValor)}</div>
                    </div>
                  )}
                </div>
                {valorHora <= 0 && (
                  <div style={{ fontSize: 11, color: T.textD, marginTop: 8, opacity: .7 }}>
                    Salário não configurado — o valor em reais não está disponível.
                  </div>
                )}
              </div>
            )}

            {msg && <div style={{ fontSize: 12, color: '#C04050', marginBottom: 10, padding: '7px 12px', borderRadius: 7, background: 'rgba(192,64,80,0.06)' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: T.textS, fontFamily: 'var(--font-body)', outline: 'none' }}>Cancelar</button>
              <button onClick={saveRegistro} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer', background: `linear-gradient(135deg,${T.blue},${T.blueL})`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}>
                {saving ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Linha do histórico: extra lançada ou dia negativo do ponto ──
const HistRow = ({ it, isMobile, open, onToggle, onDelete }) => {
  const extra = it.kind === 'extra';
  const r = it.r;
  const ss = statusStyle(extra ? r.status : 'negativa');
  const rejeitado = extra && r.status === 'rejeitado';
  const valor = extra && Number(r.valor_total) > 0 ? BRL(Number(r.valor_total)) : null;

  const middle = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
      {extra
        ? <Pill t={rejeitado ? tone('muted') : tone('pos')} icon={G.arrowUp} strike={rejeitado}>+ {fmtHoras(Number(r.horas_calculadas))}</Pill>
        : <Pill t={tone('neg')} icon={G.arrowDown}>- {fmtMin(Number(it.d.saldo || 0)).replace('-', '')}</Pill>}
      {valor
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600, color: T.text }}>
            <Ico d={G.money} size={18} stroke={T.textS} />{valor}
          </span>
        : !extra && <span style={{ fontSize: 12.5, color: T.textT }}>Saldo do dia no ponto</span>}
    </div>
  );

  return (
    <ListRow isMobile={isMobile} open={open} onToggle={onToggle}
      accent={extra ? ss.color : tone('neg').color}
      tile={<Tile isMobile={isMobile} gradient={extra ? null : RED_GRAD} shadow={extra ? null : '#C04050'}>
        <Ico d={G.clock} size={isMobile ? 26 : 36} stroke="#fff" sw={2.2} />
      </Tile>}
      title={extra ? r.descricao : 'Horas negativas no ponto'}
      meta={<>
        <MetaLine isMobile={isMobile} icon={G.calendar}>
          <span>{fmtData(it.data)}</span><Dot />
          {extra
            ? <span>{hhmm(r.hora_inicio)} → {hhmm(r.hora_fim)}</span>
            : <span style={{ textTransform: 'capitalize' }}>{diaSemana(it.data)}</span>}
        </MetaLine>
        {extra && (
          <MetaLine isMobile={isMobile} icon={G.building}>
            <span>{fmtHoras(Number(r.total_horas))} trabalhadas</span><Dot />
            <span>{fmtHoras(Number(r.horas_calculadas))} no banco</span>
            {r.feriado_domingo && <Pill t={tone('warn')} size="sm">Feriado/Dom ×2</Pill>}
          </MetaLine>
        )}
      </>}
      middle={middle}
      status={<StatusPill t={ss}>{ss.label}</StatusPill>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {extra ? (
          <>
            {Number(r.valor_hora) > 0 && Number(r.total_horas) > 0
              ? <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>
                  {Number(r.total_horas).toFixed(2)}h × {BRL(Number(r.valor_hora))} × <strong style={{ color: r.feriado_domingo ? '#D89030' : T.blueL }}>{r.feriado_domingo ? '200%' : '150%'}</strong> = <strong style={{ color: tone('pos').color }}>{BRL(Number(r.valor_total))}</strong>
                </div>
              : <div>Valor em reais indisponível — salário não configurado quando o registro foi feito.</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span>
                {r.feriado_domingo ? 'Feriado/Domingo: horas contam em dobro no banco. ' : ''}
                {r.status === 'pendente' && 'Aguardando aprovação do RH.'}
                {r.status === 'aprovado' && 'Aprovado pelo RH.'}
                {rejeitado && 'Rejeitado pelo RH — não entra no saldo.'}
              </span>
              {rejeitado && (
                <button onClick={() => onDelete(r.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: `1px solid ${alpha('#C04050', 0.3)}`, background: alpha('#C04050', 0.08), color: tone('neg').color, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)', outline: 'none' }}>
                  <Ico d={G.trash} size={13} /> Excluir registro
                </button>
              )}
            </div>
          </>
        ) : (
          <div>Dias justificados pelo RH são abonados e deixam de contar como negativos.</div>
        )}
      </div>
    </ListRow>
  );
};

export { TabHoras };
