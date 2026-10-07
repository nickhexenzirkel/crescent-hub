// src/modules/uniko-call/Dashboard.jsx
// Dashboard do Uniko Call — totais, porcentagens e gráficos por atendente e setor.
// Recebe as chamadas JÁ filtradas pelo período (filtro de data do painel esquerdo) e só
// agrega; nada é buscado aqui. Gráficos em HTML/CSS puro (sem biblioteca), cores pelo tema.
import { useState, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { SETORES, SEM_SETOR, setorInfo, callMs, totalLabel, callsLabel } from './callUtils';

const WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const GOOD = '#0ca30c', BAD = '#d03b3b'; // status fixos — sempre acompanhados de ícone + texto
const SERIES = () => (T.dark ? '#3987e5' : '#2a78d6'); // cor única de série (azul do palette validado)
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const avgLabel = (ms, n) => { if (!n || !ms) return '—'; const s = Math.round(ms / n / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const initials = (name) => (name || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');

// Ícones SVG (traço currentColor) — no lugar dos emojis.
const Ico = ({ size = 18, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true" {...rest}>{children}</svg>
);
const IcoTrophy = (p) => <Ico {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></Ico>;
const IcoBuilding = (p) => <Ico {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></Ico>;
const IcoClock = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></Ico>;
const IcoCalendar = (p) => <Ico {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Ico>;
const IcoCheckCircle = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16 9.5" /></Ico>;
const IcoXCircle = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></Ico>;
const IcoAlert = (p) => <Ico {...p}><path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Ico>;

const cardStyle = () => ({ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px 18px', minWidth: 0 });
const Card = ({ title, sub, children, style }) => (
  <div style={{ ...cardStyle(), ...style }}>
    <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>{title}</div>
    {sub && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>{sub}</div>}
    <div style={{ marginTop: 12 }}>{children}</div>
  </div>
);

const Kpi = ({ label, value, sub, tone }) => (
  <div style={{ ...cardStyle(), padding: '14px 16px' }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color: tone || T.text, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 12.5, color: T.textT, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>{sub}</div>}
  </div>
);

// Colunas finas (topo arredondado 4px), grade discreta, tooltip no hover.
const ColChart = ({ data, color, height = 150, label }) => {
  const [hov, setHov] = useState(null);
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d.value));
  const step = Math.max(1, Math.ceil(n / 8));
  const grid = max > 1 ? [max, Math.round(max / 2)] : [max];
  return (
    <div role="img" aria-label={label} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', height, marginLeft: 28, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-end', gap: n > 31 ? 2 : 4 }}>
        {grid.map(g => (
          <div key={g} style={{ position: 'absolute', left: -28, right: 0, bottom: `${(g / max) * 100}%`, borderTop: `1px solid ${T.border}`, opacity: .5, pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', left: 0, top: -14, fontSize: 10, color: T.textT, background: T.surface, paddingRight: 3 }}>{g}</span>
          </div>
        ))}
        {data.map((d, i) => (
          <div key={d.key ?? i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            style={{ flex: 1, minWidth: 2, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
            <div style={{ width: '100%', maxWidth: 26, margin: '0 auto', height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0,
              background: color, borderRadius: '4px 4px 0 0', opacity: hov == null || hov === i ? 1 : .5, transition: 'opacity .1s' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: n > 31 ? 2 : 4, marginLeft: 28, marginTop: 5 }}>
        {data.map((d, i) => (
          <div key={d.key ?? i} style={{ flex: 1, minWidth: 2, textAlign: 'center', fontSize: 10, color: T.textT, whiteSpace: 'nowrap', overflow: 'visible', height: 12 }}>
            {i % step === 0 ? d.label : ''}
          </div>
        ))}
      </div>
      {hov != null && (
        <div style={{ position: 'absolute', top: -6, left: `calc(28px + (100% - 28px) * ${(hov + 0.5) / n})`, transform: 'translate(-50%,-100%)', zIndex: 5, pointerEvents: 'none',
          background: T.text, color: T.surface, padding: '5px 9px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
          {data[hov].tip || `${data[hov].label}: ${data[hov].value}`}
        </div>
      )}
    </div>
  );
};

// Barras horizontais: rótulo | barra | valor (%).
const HBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  return rows.map(r => (
    <div key={r.key} title={r.tip} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 36%) 1fr auto', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
      <div style={{ height: 8, borderRadius: 4, background: T.surfaceSub || 'rgba(0,0,0,.06)' }}>
        <div style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 3 : 0, height: '100%', borderRadius: 4, background: r.color }} />
      </div>
      <div style={{ fontSize: 12, color: T.textS || T.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.right}</div>
    </div>
  ));
};

// Aviso prévio: barra 100% (dito × não dito) com 2px de respiro, sempre com ícone + texto.
const ConsentBar = ({ yes, no, compact }) => {
  const total = yes + no;
  if (!total) return <span style={{ fontSize: 11.5, color: T.textT }}>sem dados</span>;
  const py = pct(yes, total);
  return (
    <div style={{ minWidth: compact ? 110 : 0 }}>
      <div style={{ display: 'flex', gap: 2, height: 8 }}>
        {yes > 0 && <div style={{ flex: yes, background: GOOD, borderRadius: no ? '4px 0 0 4px' : 4 }} />}
        {no > 0 && <div style={{ flex: no, background: BAD, borderRadius: yes ? '0 4px 4px 0' : 4 }} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: T.textS || T.text, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: GOOD }}><IcoCheckCircle size={14} /><span style={{ color: T.textS || T.text }}>{py}% dito</span></span>
        {no > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: BAD }}><IcoXCircle size={14} /><span style={{ color: T.textS || T.text }}>{no}</span></span>}
      </div>
    </div>
  );
};

const PRESETS = [['Hoje', 0], ['7 dias', 6], ['30 dias', 29], ['Tudo', null]];

const CallDashboard = ({ recs, contacts, dateFrom, dateTo, setDateFrom, setDateTo, totalAll }) => {
  const [sector, setSector] = useState('');

  const applyPreset = (back) => {
    if (back == null) { setDateFrom(''); setDateTo(''); return; }
    const to = new Date(), from = new Date(); from.setDate(from.getDate() - back);
    setDateFrom(dayKey(from)); setDateTo(dayKey(to));
  };
  const activePreset = (() => {
    if (!dateFrom && !dateTo) return null;
    const today = dayKey(new Date());
    if (dateTo !== today) return undefined;
    return PRESETS.find(([, back]) => back != null && (() => { const f = new Date(); f.setDate(f.getDate() - back); return dayKey(f) === dateFrom; })())?.[0];
  })();

  const S = useMemo(() => {
    const list = sector ? recs.filter(r => (sector === SEM_SETOR ? !(r.sectors?.length) : (r.sectors || []).includes(sector))) : recs;
    let ms = 0, withDur = 0, yes = 0, no = 0, errors = 0;
    const byDay = new Map(), byHour = Array(24).fill(0), byWeek = Array(7).fill(0);
    const byAtt = new Map(), bySec = new Map(), byContact = new Map();
    list.forEach(r => {
      const dur = callMs(r); if (dur) { ms += dur; withDur++; }
      if (r.consent_given === true) yes++; else if (r.consent_given === false) no++;
      if (r.status === 'error') errors++;
      const d = new Date(r.started_at);
      if (!isNaN(d)) { const k = dayKey(d); byDay.set(k, (byDay.get(k) || 0) + 1); byHour[d.getHours()]++; byWeek[d.getDay()]++; }
      const add = (map, key, init) => { if (!map.has(key)) map.set(key, { ...init, calls: 0, ms: 0, withDur: 0, yes: 0, no: 0 }); const g = map.get(key); g.calls++; if (dur) { g.ms += dur; g.withDur++; } if (r.consent_given === true) g.yes++; else if (r.consent_given === false) g.no++; return g; };
      const name = r.attendant_name ? r.attendant_name.trim() : '';
      add(byAtt, name ? name.toLowerCase() : 'none', { name: name || 'Sem atendente identificado' });
      (r.sectors?.length ? r.sectors : [SEM_SETOR]).forEach(id => add(bySec, id, { id }));
      byContact.set(r.contact_id, (byContact.get(r.contact_id) || 0) + 1);
    });
    // Série por dia: do 1º ao último dia com ligação (máx. 60 dias mais recentes), zerando os vazios.
    const days = [];
    if (byDay.size) {
      const keys = [...byDay.keys()].sort();
      let cur = new Date(`${keys[0]}T12:00:00`); const last = new Date(`${keys[keys.length - 1]}T12:00:00`);
      while (cur <= last) { const k = dayKey(cur); days.push({ key: k, value: byDay.get(k) || 0, label: `${k.slice(8)}/${k.slice(5, 7)}`, tip: `${k.slice(8)}/${k.slice(5, 7)}/${k.slice(0, 4)}: ${callsLabel(byDay.get(k) || 0)}` }); cur.setDate(cur.getDate() + 1); }
    }
    return {
      total: list.length, ms, withDur, yes, no, errors, days: days.slice(-60), byHour, byWeek,
      atts: [...byAtt.values()].sort((a, b) => (a.name.startsWith('Sem atendente')) - (b.name.startsWith('Sem atendente')) || b.calls - a.calls),
      secs: [...bySec.values()].sort((a, b) => (a.id === SEM_SETOR) - (b.id === SEM_SETOR) || b.calls - a.calls),
      contacts: [...byContact.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [recs, sector]);

  const color = SERIES();
  const nameOf = (id) => contacts.find(c => c.id === id)?.name || 'Contato removido';
  const consentTotal = S.yes + S.no;
  const peakHour = S.byHour.reduce((b, v, i) => (v > S.byHour[b] ? i : b), 0);
  const peakDay = S.byWeek.reduce((b, v, i) => (v > S.byWeek[b] ? i : b), 0);
  const known = S.atts.filter(a => !a.name.startsWith('Sem atendente'));
  const topAtt = known[0];
  const topSec = S.secs.find(s => s.id !== SEM_SETOR);
  const withoutAtt = S.atts.find(a => a.name.startsWith('Sem atendente'));

  const insights = [];
  if (S.total) {
    if (topAtt) insights.push({ icon: IcoTrophy, text: `${topAtt.name} lidera com ${callsLabel(topAtt.calls)} (${pct(topAtt.calls, S.total)}% do total).` });
    if (topSec) insights.push({ icon: IcoBuilding, text: `${setorInfo(topSec.id).label} é o setor com mais ligações: ${callsLabel(topSec.calls)} (${pct(topSec.calls, S.total)}%).` });
    if (S.byHour[peakHour]) insights.push({ icon: IcoClock, text: `Horário de pico: ${pad(peakHour)}h às ${pad(peakHour + 1 > 23 ? 0 : peakHour + 1)}h (${callsLabel(S.byHour[peakHour])}).` });
    if (S.byWeek[peakDay]) insights.push({ icon: IcoCalendar, text: `Dia mais movimentado: ${WEEK[peakDay]} (${callsLabel(S.byWeek[peakDay])}).` });
    if (S.no > 0) insights.push({ icon: IcoXCircle, tone: BAD, text: `${S.no} ${S.no === 1 ? 'ligação ficou' : 'ligações ficaram'} sem o aviso prévio dito — a gravação não foi registrada, por segurança.` });
    else if (consentTotal) insights.push({ icon: IcoCheckCircle, tone: GOOD, text: 'Todas as ligações avaliadas tiveram o aviso prévio dito.' });
    if (withoutAtt) insights.push({ icon: IcoAlert, tone: '#e0a100', text: `${callsLabel(withoutAtt.calls)} sem atendente identificado (feitas antes do login na extensão ou com a sessão expirada).` });
    if (S.errors) insights.push({ icon: IcoAlert, tone: BAD, text: `${S.errors} ${S.errors === 1 ? 'transcrição falhou' : 'transcrições falharam'}.` });
  }

  const selectStyle = { padding: '7px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 12.5, fontFamily: 'var(--font-body)', outline: 'none' };
  const periodText = dateFrom || dateTo ? `${dateFrom ? dateFrom.split('-').reverse().join('/') : 'início'} até ${dateTo ? dateTo.split('-').reverse().join('/') : 'hoje'}` : 'todo o histórico';

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1180, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginRight: 6 }}>Dashboard</div>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: T.surfaceSub || 'rgba(0,0,0,.05)' }}>
          {PRESETS.map(([label, back]) => {
            const on = back == null ? (!dateFrom && !dateTo) : activePreset === label;
            return <button key={label} onClick={() => applyPreset(back)} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', background: on ? T.surface : 'transparent', color: on ? T.gold : T.textT, boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{label}</button>;
          })}
        </div>
        <select value={sector} onChange={e => setSector(e.target.value)} style={selectStyle} aria-label="Filtrar por setor">
          <option value="">Todos os setores</option>
          {Object.entries(SETORES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          <option value={SEM_SETOR}>Sem setor</option>
        </select>
        <span style={{ fontSize: 11.5, color: T.textT, marginLeft: 'auto' }}>Período: {periodText}{sector ? ` · ${setorInfo(sector).label}` : ''}</span>
      </div>

      {S.total === 0 ? (
        <div style={{ ...cardStyle(), padding: 36, textAlign: 'center', color: T.textT, fontSize: 13, borderStyle: 'dashed' }}>
          {totalAll === 0 ? 'Nenhuma chamada gravada ainda.' : 'Nenhuma chamada nesse período/setor.'}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <Kpi label="Ligações" value={S.total} sub={`${known.length} ${known.length === 1 ? 'atendente' : 'atendentes'}`} />
            <Kpi label="Tempo total" value={S.ms ? totalLabel(S.ms) : '—'} sub={`${S.withDur} com duração registrada`} />
            <Kpi label="Duração média" value={avgLabel(S.ms, S.withDur)} sub="min:seg por ligação" />
            <Kpi label="Aviso prévio dito" value={consentTotal ? `${pct(S.yes, consentTotal)}%` : '—'}
              tone={consentTotal ? (S.no ? BAD : GOOD) : undefined}
              sub={consentTotal ? <><span>{S.yes} de {consentTotal} avaliadas</span>{S.no ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: BAD, fontWeight: 700 }}><IcoXCircle size={14} />{S.no} sem aviso</span> : <span style={{ color: GOOD, display: 'inline-flex' }}><IcoCheckCircle size={15} /></span>}</> : 'sem ligações avaliadas'} />
            <Kpi label="Falhas" value={S.errors} sub={S.errors ? 'transcrições com erro' : 'nenhuma transcrição com erro'} tone={S.errors ? BAD : undefined} />
          </div>

          {/* Destaques */}
          {insights.length > 0 && (
            <Card title="Destaques do período">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      color: it.tone || T.gold, background: it.tone ? `${it.tone}1f` : (T.goldGl || T.surfaceSub) }}><it.icon size={19} /></span>
                    <span style={{ fontSize: 15.5, fontWeight: 600, color: T.text, lineHeight: 1.4 }}>{it.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Ligações por dia */}
          <Card title="Ligações por dia" sub={S.days.length >= 60 ? 'Últimos 60 dias do período' : undefined}>
            <ColChart data={S.days} color={color} label="Ligações por dia" height={160} />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
            {/* Por setor */}
            <Card title="Ligações por setor" sub="% sobre o total de ligações (quem tem mais de um setor conta em cada um)">
              <HBars rows={S.secs.map(s => {
                const st = setorInfo(s.id);
                return { key: s.id, label: st.label, value: s.calls, color: st.cor, tip: `${st.label}: ${callsLabel(s.calls)} · ${totalLabel(s.ms)}`, right: `${s.calls} · ${pct(s.calls, S.total)}%` };
              })} />
            </Card>

            {/* Aviso prévio por setor */}
            <Card title="Aviso prévio por setor" sub="Ligações em que o aviso de gravação foi dito ou não">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {S.secs.map(s => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 36%) 1fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{setorInfo(s.id).label}</div>
                    <ConsentBar yes={s.yes} no={s.no} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Horário */}
            <Card title="Ligações por horário" sub="Hora em que a ligação começou">
              <ColChart data={S.byHour.map((v, h) => ({ key: h, value: v, label: `${pad(h)}h`, tip: `${pad(h)}h: ${callsLabel(v)}` }))} color={color} label="Ligações por hora do dia" height={130} />
            </Card>

            {/* Dia da semana */}
            <Card title="Ligações por dia da semana">
              <ColChart data={S.byWeek.map((v, d) => ({ key: d, value: v, label: WEEK_SHORT[d], tip: `${WEEK[d]}: ${callsLabel(v)}` }))} color={color} label="Ligações por dia da semana" height={130} />
            </Card>
          </div>

          {/* Ranking de atendentes */}
          <Card title="Ranking de atendentes" sub="Ligações, participação no total, tempo, duração média e aviso prévio">
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 620 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(130px, 1.3fr) minmax(120px, 1.4fr) 60px 70px 70px minmax(110px, 1fr)', gap: 10, padding: '0 4px 6px', fontSize: 10.5, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: `1px solid ${T.border}` }}>
                  <span /><span>Atendente</span><span>Ligações</span><span>% total</span><span>Tempo</span><span>Média</span><span>Aviso prévio</span>
                </div>
                {S.atts.map(a => {
                  const none = a.name.startsWith('Sem atendente');
                  const top = S.atts[0]?.calls || 1;
                  return (
                    <div key={a.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(130px, 1.3fr) minmax(120px, 1.4fr) 60px 70px 70px minmax(110px, 1fr)', gap: 10, alignItems: 'center', padding: '8px 4px', borderBottom: `1px solid ${T.border}55` }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: none ? (T.surfaceSub || '#eceef0') : T.gold, color: none ? T.textT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{none ? '?' : initials(a.name)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.name}>{a.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: T.surfaceSub || 'rgba(0,0,0,.06)' }}><div style={{ width: `${(a.calls / top) * 100}%`, height: '100%', borderRadius: 4, background: none ? T.textT : color }} /></div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text, minWidth: 18, textAlign: 'right' }}>{a.calls}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: T.textS || T.text }}>{pct(a.calls, S.total)}%</div>
                      <div style={{ fontSize: 12.5, color: T.textS || T.text }}>{a.ms ? totalLabel(a.ms) : '—'}</div>
                      <div style={{ fontSize: 12.5, color: T.textS || T.text, fontVariantNumeric: 'tabular-nums' }}>{avgLabel(a.ms, a.withDur)}</div>
                      <ConsentBar yes={a.yes} no={a.no} compact />
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Contatos mais frequentes */}
          <Card title="Contatos com mais ligações" sub="Top 5 do período">
            <HBars rows={S.contacts.map(([id, n]) => ({ key: id, label: nameOf(id), value: n, color, right: `${n} · ${pct(n, S.total)}%` }))} />
          </Card>
        </>
      )}
    </div>
  );
};

export default CallDashboard;
