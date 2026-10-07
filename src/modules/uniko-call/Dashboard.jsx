// src/modules/uniko-call/Dashboard.jsx
// Dashboard do Uniko Call — pensado pra ser entendido de primeira, por qualquer pessoa:
// 1) uma frase-resumo + um aviso de "tudo certo / atenção" sobre o aviso prévio de gravação;
// 2) 4 números grandes; 3) quem mais atendeu; 4) por setor; 5) quando as ligações acontecem.
// Recebe as chamadas JÁ filtradas pelo período (filtro de data do painel esquerdo) e só
// agrega; nada é buscado aqui. Gráficos em HTML/SVG puro, cores pelo tema.
import { useState, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { SETORES, SEM_SETOR, setorInfo, callMs, totalLabel, callsLabel } from './callUtils';

const WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const GOOD = '#0ca30c', BAD = '#d03b3b', WARN = '#e0a100'; // status fixos — sempre com ícone + texto
const SERIES = () => (T.dark ? '#3987e5' : '#2a78d6');
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const avgLabel = (ms, n) => { if (!n || !ms) return '—'; const s = Math.round(ms / n / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const initials = (name) => (name || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
const isNoAtt = (name) => name.startsWith('Sem atendente');

/* ── Ícones (traço currentColor) ─────────────────────────────────────────── */
const Ico = ({ size = 20, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true" {...rest}>{children}</svg>
);
const IcoPhone = (p) => <Ico {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.902.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.908.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></Ico>;
const IcoClock = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></Ico>;
const IcoTimer = (p) => <Ico {...p}><path d="M10 2h4M12 14l3-3" /><circle cx="12" cy="14" r="8" /></Ico>;
const IcoShield = (p) => <Ico {...p}><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><polyline points="8.5 12 11 14.5 15.5 9.5" /></Ico>;
const IcoCheckCircle = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16 9.5" /></Ico>;
const IcoXCircle = (p) => <Ico {...p}><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></Ico>;
const IcoAlert = (p) => <Ico {...p}><path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Ico>;

/* ── Peças visuais ───────────────────────────────────────────────────────── */
const cardStyle = () => ({ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: '16px 18px', minWidth: 0 });
const Card = ({ title, sub, children, style }) => (
  <div style={{ ...cardStyle(), ...style }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{title}</div>
    {sub && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    <div style={{ marginTop: 16 }}>{children}</div>
  </div>
);

// Número grande com ícone — a leitura de primeira.
const BigNumber = ({ icon: Icon, label, value, sub, tone }) => (
  <div style={{ ...cardStyle(), padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tone || T.gold, background: tone ? `${tone}1f` : (T.goldGl || T.surfaceSub) }}><Icon size={17} /></span>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.textS || T.text }}>{label}</span>
    </div>
    <div style={{ fontSize: 33, fontWeight: 800, color: tone || T.text, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: T.textT, lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

// Anel de porcentagem (aviso prévio): verde = dito, vermelho = não dito.
const Ring = ({ yes, no, size = 112 }) => {
  const total = yes + no, r = 52, c = 2 * Math.PI * r;
  const yesLen = total ? (yes / total) * c : 0, noLen = total ? (no / total) * c : 0, gap = yes && no ? 4 : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role="img" aria-label={total ? `${pct(yes, total)}% das ligações com aviso prévio dito` : 'sem dados'}>
      <svg width={size} height={size} viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="66" cy="66" r={r} fill="none" stroke={T.surfaceSub || 'rgba(0,0,0,.08)'} strokeWidth="14" />
        {yes > 0 && <circle cx="66" cy="66" r={r} fill="none" stroke={GOOD} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0, yesLen - gap)} ${c}`} />}
        {no > 0 && <circle cx="66" cy="66" r={r} fill="none" stroke={BAD} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0, noLen - gap)} ${c}`} strokeDashoffset={-yesLen} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24.5, fontWeight: 800, color: T.text, lineHeight: 1 }}>{total ? `${pct(yes, total)}%` : '—'}</span>
        <span style={{ fontSize: 11.5, color: T.textT, marginTop: 3 }}>com aviso</span>
      </div>
    </div>
  );
};

// Colunas: a mais alta (pico) ganha destaque e rótulo direto; as outras ficam mais claras.
const ColChart = ({ data, color, height = 160, label, unit = 'ligações' }) => {
  const [hov, setHov] = useState(null);
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d.value));
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div role="img" aria-label={label} style={{ position: 'relative', paddingTop: 22 }}>
      <div style={{ position: 'relative', height, borderBottom: `2px solid ${T.border}`, display: 'flex', alignItems: 'flex-end', gap: n > 31 ? 2 : 5 }}>
        {data.map((d, i) => {
          const isPeak = i === peak && d.value > 0;
          const dim = hov != null ? hov !== i : !isPeak;
          return (
            <div key={d.key ?? i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              style={{ flex: 1, minWidth: 2, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
              {(isPeak && hov == null) && (
                <span style={{ position: 'absolute', left: '50%', bottom: `calc(${(d.value / max) * 100}% + 4px)`, transform: 'translateX(-50%)', fontSize: 11.5, fontWeight: 800, color: T.text }}>{d.value}</span>
              )}
              <div style={{ width: '100%', maxWidth: 30, margin: '0 auto', height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 0,
                background: color, borderRadius: '5px 5px 0 0', opacity: dim ? .4 : 1, transition: 'opacity .12s' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: n > 31 ? 2 : 5, marginTop: 6 }}>
        {data.map((d, i) => {
          const isPeak = i === peak && d.value > 0;
          return (
            <div key={d.key ?? i} style={{ flex: 1, minWidth: 2, textAlign: 'center', fontSize: 11.5, fontWeight: isPeak ? 800 : 500, color: isPeak ? T.text : T.textT, whiteSpace: 'nowrap', height: 15 }}>
              {i % step === 0 || isPeak ? d.label : ''}
            </div>
          );
        })}
      </div>
      {hov != null && (
        <div style={{ position: 'absolute', top: 0, left: `calc(100% * ${(hov + 0.5) / n})`, transform: 'translate(-50%,-6%)', zIndex: 5, pointerEvents: 'none',
          background: T.text, color: T.surface, padding: '6px 11px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
          {data[hov].tip || `${data[hov].label}: ${data[hov].value} ${unit}`}
        </div>
      )}
    </div>
  );
};

const PRESETS = [['Hoje', 0], ['Últimos 7 dias', 6], ['Últimos 30 dias', 29], ['Tudo', null]];
const RANK_TONES = ['#d4a017', '#8a94a3', '#b87333']; // ouro, prata, bronze

const CallDashboard = ({ recs, contacts, dateFrom, dateTo, setDateFrom, setDateTo, totalAll }) => {
  const [sector, setSector] = useState('');

  const applyPreset = (back) => {
    if (back == null) { setDateFrom(''); setDateTo(''); return; }
    const to = new Date(), from = new Date(); from.setDate(from.getDate() - back);
    setDateFrom(dayKey(from)); setDateTo(dayKey(to));
  };
  const activePreset = (() => {
    if (!dateFrom && !dateTo) return 'Tudo';
    if (dateTo !== dayKey(new Date())) return null;
    return PRESETS.find(([, back]) => back != null && (() => { const f = new Date(); f.setDate(f.getDate() - back); return dayKey(f) === dateFrom; })())?.[0] || null;
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
    const days = [];
    if (byDay.size) {
      const keys = [...byDay.keys()].sort();
      const cur = new Date(`${keys[0]}T12:00:00`); const last = new Date(`${keys[keys.length - 1]}T12:00:00`);
      while (cur <= last) { const k = dayKey(cur); days.push({ key: k, value: byDay.get(k) || 0, label: `${k.slice(8)}/${k.slice(5, 7)}`, tip: `${k.slice(8)}/${k.slice(5, 7)}/${k.slice(0, 4)}: ${callsLabel(byDay.get(k) || 0)}` }); cur.setDate(cur.getDate() + 1); }
    }
    return {
      total: list.length, ms, withDur, yes, no, errors, days: days.slice(-60), byHour, byWeek,
      atts: [...byAtt.values()].sort((a, b) => isNoAtt(a.name) - isNoAtt(b.name) || b.calls - a.calls),
      secs: [...bySec.values()].sort((a, b) => (a.id === SEM_SETOR) - (b.id === SEM_SETOR) || b.calls - a.calls),
      contacts: [...byContact.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [recs, sector]);

  const color = SERIES();
  const nameOf = (id) => contacts.find(c => c.id === id)?.name || 'Contato removido';
  const consentTotal = S.yes + S.no;
  const pending = S.total - consentTotal;
  const known = S.atts.filter(a => !isNoAtt(a.name));
  const withoutAtt = S.atts.find(a => isNoAtt(a.name));
  const peakHour = S.byHour.reduce((b, v, i) => (v > S.byHour[b] ? i : b), 0);
  const peakDay = S.byWeek.reduce((b, v, i) => (v > S.byWeek[b] ? i : b), 0);

  const periodText = dateFrom || dateTo ? `de ${dateFrom ? dateFrom.split('-').reverse().join('/') : 'sempre'} até ${dateTo ? dateTo.split('-').reverse().join('/') : 'hoje'}` : 'em todo o histórico';
  const selectStyle = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11.5, fontFamily: 'var(--font-body)', outline: 'none' };

  // Faixa de status do aviso prévio — o que mais importa saber de primeira.
  const banner = !consentTotal ? null
    : S.no === 0 ? { tone: GOOD, icon: IcoCheckCircle, title: 'Tudo certo com o aviso de gravação', text: `Em todas as ${consentTotal} ligações avaliadas o aviso prévio foi dito.` }
    : { tone: BAD, icon: IcoAlert, title: `Atenção: ${S.no} ${S.no === 1 ? 'ligação ficou' : 'ligações ficaram'} sem o aviso prévio`, text: 'Quando o aviso não é dito, a gravação não é registrada, por segurança (proteção de dados).' };

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
      {/* Título + filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 19.5, fontWeight: 800, color: T.text, marginRight: 8 }}>Resumo das ligações</div>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.05)', flexWrap: 'wrap' }}>
          {PRESETS.map(([label, back]) => {
            const on = activePreset === label;
            return <button key={label} onClick={() => applyPreset(back)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-body)', background: on ? T.surface : 'transparent', color: on ? T.gold : T.textT, boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{label}</button>;
          })}
        </div>
        <select value={sector} onChange={e => setSector(e.target.value)} style={selectStyle} aria-label="Filtrar por setor">
          <option value="">Todos os setores</option>
          {Object.entries(SETORES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          <option value={SEM_SETOR}>Sem setor</option>
        </select>
      </div>

      {S.total === 0 ? (
        <div style={{ ...cardStyle(), padding: 40, textAlign: 'center', color: T.textT, fontSize: 12.5, borderStyle: 'dashed' }}>
          {totalAll === 0 ? 'Nenhuma chamada gravada ainda.' : 'Nenhuma chamada nesse período/setor. Tente "Tudo" ou outro período.'}
        </div>
      ) : (
        <>
          {/* Frase-resumo */}
          <div style={{ fontSize: 'clamp(14px, 1.8vw, 16.5px)', lineHeight: 1.5, color: T.textS || T.text }}>
            {sector ? <b style={{ color: setorInfo(sector).cor }}>{setorInfo(sector).label}: </b> : null}
            Foram <b style={{ color: T.text }}>{callsLabel(S.total)}</b> {periodText}
            {S.ms ? <>, somando <b style={{ color: T.text }}>{totalLabel(S.ms)}</b> de conversa</> : null}
            {known.length ? <>, atendidas por <b style={{ color: T.text }}>{known.length} {known.length === 1 ? 'pessoa' : 'pessoas'}</b></> : null}.
          </div>

          {/* Faixa de status do aviso prévio */}
          {banner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, border: `1.5px solid ${banner.tone}`, background: `${banner.tone}14` }}>
              <span style={{ color: banner.tone, display: 'flex' }}><banner.icon size={28} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{banner.title}</div>
                <div style={{ fontSize: 12, color: T.textS || T.text, marginTop: 2, lineHeight: 1.4 }}>{banner.text}</div>
              </div>
            </div>
          )}

          {/* 4 números grandes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <BigNumber icon={IcoPhone} label="Ligações" value={S.total} sub={`feitas por ${known.length || 0} ${known.length === 1 ? 'atendente' : 'atendentes'}`} />
            <BigNumber icon={IcoClock} label="Tempo total" value={S.ms ? totalLabel(S.ms) : '—'} sub="somando todas as ligações" />
            <BigNumber icon={IcoTimer} label="Tempo médio" value={avgLabel(S.ms, S.withDur)} sub="minutos:segundos por ligação" />
            <BigNumber icon={IcoShield} label="Aviso prévio dito" value={consentTotal ? `${pct(S.yes, consentTotal)}%` : '—'}
              tone={consentTotal ? (S.no ? BAD : GOOD) : undefined}
              sub={consentTotal ? `${S.yes} de ${consentTotal} ligações` : 'ainda sem ligações avaliadas'} />
          </div>

          {/* Quem mais atendeu */}
          <Card title="Quem mais atendeu" sub="Cada barra mostra quantas ligações a pessoa fez, comparada com quem mais fez.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {S.atts.map((a, i) => {
                const none = isNoAtt(a.name);
                const top = S.atts.find(x => !isNoAtt(x.name))?.calls || S.atts[0].calls || 1;
                const rankTone = !none && i < 3 ? RANK_TONES[i] : null;
                const consent = a.yes + a.no;
                return (
                  <div key={a.name} style={{ padding: '12px 4px', borderBottom: i < S.atts.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800,
                        background: none ? (T.surfaceSub || '#eceef0') : T.gold, color: none ? T.textT : '#fff', position: 'relative' }}>
                        {none ? '?' : initials(a.name)}
                        {rankTone && <span style={{ position: 'absolute', right: -5, bottom: -5, width: 18, height: 18, borderRadius: '50%', background: rankTone, color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${T.surface}` }}>{i + 1}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.text, whiteSpace: 'nowrap' }}>{callsLabel(a.calls)} <span style={{ color: T.textT, fontWeight: 600, fontSize: 11.5 }}>· {pct(a.calls, S.total)}%</span></span>
                        </div>
                        <div style={{ height: 10, borderRadius: 5, background: T.surfaceSub || 'rgba(0,0,0,.06)', marginTop: 7 }}>
                          <div style={{ width: `${(a.calls / top) * 100}%`, minWidth: 4, height: '100%', borderRadius: 6, background: none ? T.textT : color }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', marginTop: 8, marginLeft: 46, fontSize: 11.5, color: T.textS || T.text }}>
                      {none ? <span style={{ color: T.textT }}>Ligações antigas, ou feitas sem login na extensão.</span> : <>
                        <span>Tempo total: <b>{a.ms ? totalLabel(a.ms) : '—'}</b></span>
                        <span>Média: <b>{avgLabel(a.ms, a.withDur)}</b> por ligação</span>
                      </>}
                      {consent > 0 && (a.no === 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: GOOD, fontWeight: 700 }}><IcoCheckCircle size={16} />Aviso prévio em todas</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: BAD, fontWeight: 700 }}><IcoXCircle size={16} />{a.no} sem aviso prévio</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16 }}>
            {/* Por setor */}
            <Card title="Ligações por setor" sub="Quem está em mais de um setor aparece em cada um deles.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {S.secs.map(s => {
                  const st = setorInfo(s.id);
                  return (
                    <div key={s.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: T.text }}>
                          <span style={{ width: 12, height: 12, borderRadius: 4, background: st.cor, flexShrink: 0 }} />{st.label}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{callsLabel(s.calls)} <span style={{ color: T.textT, fontWeight: 600, fontSize: 11.5 }}>· {pct(s.calls, S.total)}%</span></span>
                      </div>
                      <div style={{ height: 10, borderRadius: 5, background: T.surfaceSub || 'rgba(0,0,0,.06)', marginTop: 6 }}>
                        <div style={{ width: `${pct(s.calls, S.total)}%`, minWidth: 4, height: '100%', borderRadius: 6, background: st.cor }} />
                      </div>
                      {s.ms > 0 && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 4 }}>{totalLabel(s.ms)} de conversa</div>}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Aviso prévio */}
            <Card title="Aviso prévio de gravação" sub="O atendente precisa avisar o cliente que a ligação está sendo gravada.">
              {consentTotal === 0 ? <div style={{ fontSize: 11.5, color: T.textT }}>Ainda não há ligações avaliadas.</div> : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                    <Ring yes={S.yes} no={S.no} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: T.text }}><span style={{ color: GOOD, display: 'flex' }}><IcoCheckCircle size={18} /></span><b style={{ fontSize: 16.5 }}>{S.yes}</b> com aviso dito</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: T.text }}><span style={{ color: BAD, display: 'flex' }}><IcoXCircle size={18} /></span><b style={{ fontSize: 16.5 }}>{S.no}</b> sem aviso</span>
                      {pending > 0 && <span style={{ fontSize: 11.5, color: T.textT }}>{pending} ainda não avaliadas</span>}
                    </div>
                  </div>
                  {S.secs.some(s => s.no > 0) && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textT }}>Setores com ligações sem aviso</div>
                      {S.secs.filter(s => s.no > 0).map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                          <span style={{ fontWeight: 600, color: T.text }}>{setorInfo(s.id).label}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: BAD, fontWeight: 700 }}><IcoXCircle size={14} />{s.no} de {s.yes + s.no}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>

          {/* Quando acontecem */}
          <Card title="Ligações por dia" sub={S.days.length >= 60 ? 'Mostrando os últimos 60 dias do período. A coluna mais alta é o dia mais movimentado.' : 'A coluna mais alta é o dia mais movimentado. Passe o mouse pra ver o valor.'}>
            <ColChart data={S.days} color={color} label="Ligações por dia" height={170} />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16 }}>
            <Card title="Que horas as ligações acontecem" sub={S.byHour[peakHour] ? `Mais movimentado: das ${pad(peakHour)}h às ${pad((peakHour + 1) % 24)}h (${callsLabel(S.byHour[peakHour])}).` : undefined}>
              <ColChart data={S.byHour.map((v, h) => ({ key: h, value: v, label: `${pad(h)}h`, tip: `${pad(h)}h às ${pad((h + 1) % 24)}h: ${callsLabel(v)}` }))} color={color} label="Ligações por hora do dia" height={150} />
            </Card>
            <Card title="Em que dia da semana" sub={S.byWeek[peakDay] ? `Mais movimentado: ${WEEK[peakDay]} (${callsLabel(S.byWeek[peakDay])}).` : undefined}>
              <ColChart data={S.byWeek.map((v, d) => ({ key: d, value: v, label: WEEK_SHORT[d], tip: `${WEEK[d]}: ${callsLabel(v)}` }))} color={color} label="Ligações por dia da semana" height={150} />
            </Card>
          </div>

          {/* Clientes */}
          <Card title="Clientes que mais ligaram" sub="Os 5 contatos com mais ligações no período.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {S.contacts.map(([id, n]) => (
                <div key={id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(id)}</span>
                    <span style={{ fontWeight: 800, color: T.text, whiteSpace: 'nowrap' }}>{callsLabel(n)}</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: T.surfaceSub || 'rgba(0,0,0,.06)', marginTop: 5 }}>
                    <div style={{ width: `${(n / S.contacts[0][1]) * 100}%`, minWidth: 4, height: '100%', borderRadius: 5, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {(S.errors > 0 || withoutAtt) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {withoutAtt && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: T.textS || T.text }}><span style={{ color: WARN, display: 'flex' }}><IcoAlert size={16} /></span>{callsLabel(withoutAtt.calls)} sem atendente identificado (feitas antes do login na extensão, ou com a sessão expirada).</div>}
              {S.errors > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: T.textS || T.text }}><span style={{ color: BAD, display: 'flex' }}><IcoAlert size={16} /></span>{S.errors} {S.errors === 1 ? 'transcrição falhou' : 'transcrições falharam'}.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CallDashboard;
