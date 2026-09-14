import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase as _supabase } from '../../../contexts/user';
import { computePontoDays, loadColaboradorPonto } from '../../../shared/pontoCalc';
import { useIsMobile } from '../../../hooks/useIsMobile';

const BRL = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Ico = ({ d, size = 14, stroke = 'currentColor', sw = 1.8, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

// Glifos usados no layout (traço estilo feather).
const G = {
  clock:     <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></>,
  calendar:  <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  calPlus:   <><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="13.5" x2="12" y2="18" /><line x1="9.75" y1="15.75" x2="14.25" y2="15.75" /></>,
  building:  <><rect x="4.5" y="3" width="15" height="18" rx="1.5" /><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M10.5 21v-3h3v3" /></>,
  arrowUp:   <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5.5 11.5 12 5 18.5 11.5" /></>,
  arrowDown: <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="5.5 12.5 12 19 18.5 12.5" /></>,
  upCircle:  <><circle cx="12" cy="12" r="9" /><polyline points="8.5 11.5 12 8 15.5 11.5" /><line x1="12" y1="16" x2="12" y2="8.5" /></>,
  downCircle:<><circle cx="12" cy="12" r="9" /><polyline points="8.5 12.5 12 16 15.5 12.5" /><line x1="12" y1="8" x2="12" y2="15.5" /></>,
  money:     <><circle cx="12" cy="12" r="9" /><path d="M14.6 9.3c-.5-.8-1.4-1.3-2.6-1.3-1.5 0-2.5.8-2.5 1.9 0 2.6 5.1 1.4 5.1 4.1 0 1.1-1.1 2-2.6 2-1.2 0-2.2-.5-2.7-1.4M12 6.5V8M12 16v1.5" /></>,
  coins:     <><ellipse cx="9.5" cy="6" rx="6" ry="2.6" /><path d="M3.5 6v5c0 1.4 2.7 2.6 6 2.6M3.5 11v5c0 1.4 2.7 2.6 6 2.6M15.5 6v2.5" /><circle cx="17" cy="16" r="4.2" /><polyline points="17 14.2 17 16 18.2 17" /></>,
  search:    <><circle cx="11" cy="11" r="7" /><line x1="20.5" y1="20.5" x2="16.2" y2="16.2" /></>,
  filter:    <polygon points="21.5 4 2.5 4 10 12.9 10 19 14 21 14 12.9 21.5 4" />,
  chevR:     <polyline points="9 18 15 12 9 6" />,
  chevD:     <polyline points="6 9 12 15 18 9" />,
  trash:     <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" /></>,
};

// Mistura duas cores hex (t = peso de b). Cores fora do formato caem na primeira.
const hexRgb = h => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  let s = m[1]; if (s.length === 3) s = s.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
};
const mix = (a, b, t) => {
  const A = hexRgb(a), B = hexRgb(b);
  if (!A || !B) return a;
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const alpha = (h, a) => { const c = hexRgb(h); return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : h; };

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

// Cores de status: mais vivas nos temas escuros, mais sóbrias nos claros.
const statusStyle = (status) => {
  const d = T.dark;
  const S = {
    pendente:  { label: 'Pendente',  bg: d ? 'rgba(245,176,70,0.14)' : 'rgba(216,144,48,0.13)', color: d ? '#F5B046' : '#B97416' },
    aprovado:  { label: 'Aprovado',  bg: d ? 'rgba(52,211,153,0.13)' : 'rgba(26,156,112,0.11)', color: d ? '#3DDC97' : '#168A62' },
    rejeitado: { label: 'Rejeitado', bg: d ? 'rgba(248,113,133,0.14)' : 'rgba(192,64,80,0.11)', color: d ? '#FF7A8E' : '#C04050' },
    negativa:  { label: 'Ponto',     bg: T.surfaceSub, color: T.textS },
  };
  return S[status] || S.pendente;
};
const POS = () => (T.dark ? { bg: 'rgba(52,211,153,0.13)', color: '#3DDC97' } : { bg: 'rgba(26,156,112,0.11)', color: '#168A62' });
const NEG = () => (T.dark ? { bg: 'rgba(248,113,133,0.14)', color: '#FF7A8E' } : { bg: 'rgba(192,64,80,0.11)', color: '#C04050' });

const FILTROS = [
  { grupo: 'Tipo', itens: [['todos', 'Todos os tipos'], ['extra', 'Horas extras'], ['feriado', 'Feriado / Domingo'], ['negativa', 'Negativas do ponto']] },
  { grupo: 'Status', itens: [['pendente', 'Pendentes'], ['aprovado', 'Aprovados'], ['rejeitado', 'Rejeitados']] },
];

const HeroStat = ({ icon, color, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'rgba(255,255,255,.86)', whiteSpace: 'nowrap' }}>
    <Ico d={icon} size={19} stroke={color} />
    {children}
  </div>
);

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

  // ── Paleta do cabeçalho: tom profundo do tema com brilho nas pontas ──
  const heroBase   = mix(T.blue, '#070618', T.dark ? 0.72 : 0.62);
  const heroMid    = mix(T.blue, '#070618', T.dark ? 0.84 : 0.78);
  const heroGlow   = T.blueL;
  const heroAccent = mix(T.blueL, '#FFFFFF', 0.38);
  const saldoCor   = netPos ? '#FFFFFF' : '#FFB3BE';
  const pontoNeg   = pontoBalanceMin < 0;

  const inputBase = {
    height: 44, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surfaceInput || T.surfaceSub,
    color: T.text, fontFamily: 'var(--font-body)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .bh-row{transition:background .16s, border-color .16s}
        .bh-row:hover{background:${T.itemHover || T.surfaceSub} !important}
        .bh-row:hover .bh-chev{color:${T.text} !important}
        .bh-cta{transition:transform .16s, box-shadow .16s}
        .bh-cta:hover{transform:translateY(-1px);box-shadow:0 12px 30px ${alpha(T.blueL, 0.45)} !important}
        .bh-field:focus-within{border-color:${alpha(T.blue, 0.55)} !important}
        .bh-select option, .bh-select optgroup{background:${T.surface};color:${T.text}}
        .bh-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,560px) auto;align-items:center}
        .bh-head{display:flex;align-items:center;gap:20px}
        .bh-tools{display:flex;gap:12px}
        .bh-search{width:330px}
        .bh-filter{width:230px}
        @container (max-width: 1380px){
          .bh-hero{grid-template-columns:minmax(0,1fr) auto}
          .bh-hero-title{grid-column:1 / -1}
        }
        @container (max-width: 980px){
          .bh-head{flex-direction:column;align-items:stretch}
          .bh-search{flex:1;width:auto}
        }
        @container (max-width: 700px){
          .bh-hero{grid-template-columns:minmax(0,1fr)}
          .bh-hero .bh-cta{width:100%}
          .bh-tools{flex-direction:column}
          .bh-search,.bh-filter{width:100%;flex:none}
        }
      `}</style>

      {/* ── CABEÇALHO (saldo LÍQUIDO: extras − negativas do ponto) ── */}
      <div style={{ containerType: 'inline-size' }}>
      <div className="bh-hero" style={{
        position: 'relative', overflow: 'hidden', borderRadius: 22, marginBottom: 22, boxSizing: 'border-box',
        padding: isMobile ? '22px 18px' : '28px 44px 28px 58px',
        background: `radial-gradient(120% 140% at 0% 110%, ${alpha(heroGlow, 0.42)} 0%, transparent 42%),
                     radial-gradient(90% 120% at 100% -10%, ${alpha(heroGlow, 0.5)} 0%, transparent 38%),
                     linear-gradient(115deg, ${heroBase} 0%, ${heroMid} 52%, ${heroBase} 100%)`,
        border: `1px solid ${alpha(T.blueL, 0.35)}`,
        boxShadow: `0 18px 44px ${alpha(T.blue, T.dark ? 0.22 : 0.2)}`,
        gap: isMobile ? 18 : 28,
      }}>
        {/* ondas decorativas nos cantos inferiores */}
        <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, bottom: 0, width: isMobile ? '70%' : '32%', height: '55%', pointerEvents: 'none' }}>
          <path d="M0 30 C 90 40, 170 80, 260 120 L0 120 Z" fill={alpha(heroGlow, 0.22)} />
          <path d="M0 70 C 70 78, 130 100, 180 120 L0 120 Z" fill={alpha(heroGlow, 0.18)} />
        </svg>
        <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="none"
          style={{ position: 'absolute', right: 0, bottom: 0, width: isMobile ? '60%' : '26%', height: '48%', pointerEvents: 'none' }}>
          <path d="M400 10 C 330 60, 250 100, 140 120 L400 120 Z" fill={alpha(heroGlow, 0.2)} />
        </svg>

        {/* título */}
        <div className="bh-hero-title" style={{ position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 30 }}>
          <div style={{
            width: isMobile ? 64 : 130, height: isMobile ? 64 : 130, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(circle at 50% 40%, ${alpha(heroGlow, 0.28)}, ${alpha(heroGlow, 0.06)} 70%)`,
            border: `1px solid ${alpha(heroAccent, 0.22)}`,
          }}>
            <div style={{
              width: isMobile ? 44 : 84, height: isMobile ? 44 : 84, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: alpha(heroGlow, 0.14), boxShadow: `0 0 34px ${alpha(heroGlow, 0.35)}`,
            }}>
              <Ico d={G.clock} size={isMobile ? 26 : 50} stroke="#FFFFFF" sw={2.2} />
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, letterSpacing: '.06em', color: heroAccent, marginBottom: 4 }}>
              BANCO DE HORAS
            </div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: isMobile ? 23 : 36, fontWeight: 700, color: '#fff', lineHeight: 1.12, letterSpacing: '-.015em' }}>
              Seu tempo, no <span style={{ color: heroAccent, whiteSpace: 'nowrap' }}>seu ritmo</span>
            </div>
            {!isMobile && (
              <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,.72)', marginTop: 10, lineHeight: 1.55, maxWidth: 470 }}>
                Acompanhe suas horas acumuladas, visualize os registros e mantenha seu banco sempre em dia.
              </div>
            )}
          </div>
        </div>

        {/* saldo */}
        <div style={{
          position: 'relative', minWidth: 0, boxSizing: 'border-box',
          borderRadius: 18, padding: isMobile ? '18px 16px' : '20px 28px 20px 32px',
          background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.14)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(heroGlow, 0.3), border: `1px solid ${alpha(heroAccent, 0.25)}` }}>
              <Ico d={G.coins} size={22} stroke="#FFFFFF" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '.04em', color: 'rgba(255,255,255,.9)', marginTop: 3 }}>SALDO ATUAL</div>
              <div style={{ fontSize: isMobile ? 36 : 46, fontWeight: 800, color: saldoCor, letterSpacing: '-.02em', lineHeight: 1.05, marginTop: 4 }}>
                {netPos ? '+' : ''}{fmtMin(netMin)}
              </div>
              {!netPos && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>saldo devendo</div>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? '12px 18px' : '10px 28px', marginTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
                <HeroStat icon={G.upCircle} color="#3DDC97">Extras <strong style={{ color: '#fff', fontWeight: 600 }}>{fmtMin(extraMin)}</strong></HeroStat>
                {pontoBalanceMin !== 0 && (
                  <HeroStat icon={pontoNeg ? G.downCircle : G.clock} color={pontoNeg ? '#FF8A9C' : '#6BB8FF'}>
                    Ponto <strong style={{ color: '#fff', fontWeight: 600 }}>{pontoNeg ? fmtMin(pontoBalanceMin) : '+' + fmtMin(pontoBalanceMin)}</strong>
                  </HeroStat>
                )}
              </div>
              {valorHora > 0 && totalValor > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: heroAccent }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: alpha(heroGlow, 0.35), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico d={G.money} size={15} stroke="#FFFFFF" sw={2} />
                  </span>
                  Extras: {BRL(totalValor)}
                </div>
              )}
            </div>
            {!isMobile && <div style={{ width: 1, alignSelf: 'stretch', minHeight: 40, background: 'rgba(255,255,255,.14)' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Ico d={G.clock} size={21} stroke="rgba(255,255,255,.85)" />
              <div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.7)' }}>Total de registros</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{registros.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ação */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="bh-cta" onClick={openModal} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            height: isMobile ? 50 : 62, padding: '0 26px 0 30px', borderRadius: 999,
            border: `1px solid ${alpha('#FFFFFF', 0.22)}`,
            background: T.dark
              ? `linear-gradient(135deg, ${mix(T.blue, '#0B0A1E', 0.38)}, ${mix(T.blue, '#0B0A1E', 0.1)})`
              : `linear-gradient(135deg, ${T.blue}, ${mix(T.blue, '#FFFFFF', 0.22)})`,
            boxShadow: `0 8px 24px ${alpha(T.blueL, 0.35)}`,
            color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)', outline: 'none', whiteSpace: 'nowrap',
          }}>
            <Ico d={G.calPlus} size={21} stroke="#fff" />
            Registrar Horas
            <Ico d={G.chevR} size={17} stroke="#fff" sw={2.2} />
          </button>
        </div>
      </div>

      </div>

      {/* ── HISTÓRICO ── */}
      <div style={{ containerType: 'inline-size' }}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: T.sh,
        padding: isMobile ? '18px 14px' : '26px 30px 30px', boxSizing: 'border-box',
      }}>
        <div className="bh-head" style={{ marginBottom: 22 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 26 }}>
            <div style={{
              width: isMobile ? 46 : 64, height: isMobile ? 46 : 64, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `radial-gradient(circle at 50% 35%, ${alpha(T.blueL, 0.28)}, ${alpha(T.blue, 0.1)})`,
              color: T.dark ? '#fff' : T.blue,
            }}>
              <Ico d={G.clock} size={isMobile ? 22 : 30} sw={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 19 : 24, fontWeight: 700, color: T.text, letterSpacing: '-.01em' }}>Histórico</div>
              <div style={{ fontSize: isMobile ? 12.5 : 15, color: T.textS, marginTop: 2 }}>
                Aqui você encontra todos os registros de horas do seu banco.
              </div>
            </div>
          </div>

          <div className="bh-tools">
            <label className="bh-field bh-search" style={{ ...inputBase, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', cursor: 'text' }}>
              <Ico d={G.search} size={18} stroke={T.textS} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar no histórico..."
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: 'inherit' }} />
            </label>
            <label className="bh-field bh-filter" style={{ ...inputBase, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Ico d={G.filter} size={17} stroke={T.text} style={{ position: 'absolute', left: 16, pointerEvents: 'none' }} />
              <select className="bh-select" value={filtro} onChange={e => setFiltro(e.target.value)}
                style={{ appearance: 'none', WebkitAppearance: 'none', width: '100%', height: '100%', padding: '0 40px 0 46px', background: 'none', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 500, cursor: 'pointer' }}>
                {FILTROS.map(g => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.itens.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </optgroup>
                ))}
              </select>
              <Ico d={G.chevD} size={17} stroke={T.text} style={{ position: 'absolute', right: 16, pointerEvents: 'none' }} />
            </label>
          </div>
        </div>

        {loading
          ? <div style={{ textAlign: 'center', padding: 48, color: T.textT }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.blue}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
              Carregando...
            </div>
          : filtrados.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px 0', color: T.textT }}>
                <Ico d={G.clock} size={36} stroke={T.textD} sw={1.2} style={{ display: 'block', margin: '0 auto 12px', opacity: .6 }} />
                <div style={{ fontSize: 13 }}>{itens.length === 0 ? 'Nenhuma hora registrada ainda.' : 'Nada encontrado com esse filtro.'}</div>
                {itens.length === 0 && <div style={{ fontSize: 12, marginTop: 4, opacity: .7 }}>Use o botão acima para registrar suas horas extras.</div>}
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtrados.map(it => <HistRow key={it.key} it={it} isMobile={isMobile} open={aberto === it.key}
                  onToggle={() => setAberto(a => (a === it.key ? null : it.key))} onDelete={delRegistro} />)}
              </div>
        }
      </div>
      </div>

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
  const delta = extra ? (rejeitado ? { bg: T.surfaceSub, color: T.textT } : POS()) : NEG();
  const barra = extra ? ss.color : NEG().color;
  const tileBg = extra
    ? `linear-gradient(135deg, ${T.blue}, ${T.blueL})`
    : `linear-gradient(135deg, #B8384C, #E0697A)`;
  const meta = { display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 12.5 : 14, color: T.textS, flexWrap: 'wrap', minWidth: 0 };
  const dot = <span style={{ color: T.textT }}>•</span>;

  const valor = extra && Number(r.valor_total) > 0 ? BRL(Number(r.valor_total)) : null;

  const deltaBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 9, background: delta.bg, color: delta.color, fontSize: 14.5, fontWeight: 700, textDecoration: rejeitado ? 'line-through' : 'none' }}>
        <Ico d={extra ? G.arrowUp : G.arrowDown} size={15} stroke="currentColor" sw={2.4} />
        {extra ? `+ ${fmtHoras(Number(r.horas_calculadas))}` : `- ${fmtMin(Number(it.d.saldo || 0)).replace('-', '')}`}
      </span>
      {valor
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600, color: T.text }}>
            <Ico d={G.money} size={18} stroke={T.textS} />{valor}
          </span>
        : !extra && <span style={{ fontSize: 12.5, color: T.textT }}>Saldo do dia no ponto</span>}
    </div>
  );

  const statusPill = (
    <span style={{ fontSize: 13.5, fontWeight: 700, padding: '6px 15px', borderRadius: 999, background: ss.bg, color: ss.color, whiteSpace: 'nowrap', justifySelf: 'end' }}>
      {ss.label}
    </span>
  );

  return (
    <div className="bh-row" style={{
      borderRadius: 16, border: `1px solid ${T.border}`, background: T.surfaceSub,
      boxShadow: `inset 4px 0 0 ${barra}`, overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <div role="button" tabIndex={0} onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{
          display: 'grid', cursor: 'pointer', outline: 'none', alignItems: 'center',
          gridTemplateColumns: isMobile ? 'auto minmax(0,1fr) auto' : 'auto minmax(0,1fr) 1px minmax(0,1fr) 104px auto',
          columnGap: isMobile ? 12 : 26, rowGap: 12,
          padding: isMobile ? '14px 12px 14px 16px' : '16px 22px 16px 28px',
        }}>
        <div style={{ width: isMobile ? 52 : 72, height: isMobile ? 52 : 72, borderRadius: isMobile ? 12 : 14, background: tileBg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 18px ${alpha(extra ? T.blue : '#C04050', 0.28)}` }}>
          <Ico d={G.clock} size={isMobile ? 26 : 36} stroke="#fff" sw={2.2} />
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 6 }}>
          <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {extra ? r.descricao : 'Horas negativas no ponto'}
          </div>
          <div style={meta}>
            <Ico d={G.calendar} size={16} stroke={T.textS} />
            <span>{fmtData(it.data)}</span>{dot}
            {extra
              ? <span>{hhmm(r.hora_inicio)} → {hhmm(r.hora_fim)}</span>
              : <span style={{ textTransform: 'capitalize' }}>{diaSemana(it.data)}</span>}
          </div>
          {extra && (
            <div style={meta}>
              <Ico d={G.building} size={16} stroke={T.textS} />
              <span>{fmtHoras(Number(r.total_horas))} trabalhadas</span>{dot}
              <span>{fmtHoras(Number(r.horas_calculadas))} no banco</span>
              {r.feriado_domingo && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#D89030', background: 'rgba(216,144,48,0.14)', borderRadius: 6, padding: '2px 7px' }}>Feriado/Dom ×2</span>
              )}
            </div>
          )}
        </div>

        {isMobile
          ? <Ico d={G.chevR} size={18} stroke={T.textS} sw={2} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />
          : <>
              <div style={{ width: 1, height: 62, background: T.border }} />
              {deltaBlock}
              {statusPill}
              <span className="bh-chev" style={{ color: T.textS, display: 'flex', transition: 'color .16s' }}>
                <Ico d={G.chevR} size={20} sw={2} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />
              </span>
            </>}

        {isMobile && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            {deltaBlock}
            {statusPill}
          </div>
        )}
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: isMobile ? '12px 16px 14px' : '14px 28px 16px 126px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, color: T.textS }}>
          {extra ? (
            <>
              {Number(r.valor_hora) > 0 && Number(r.total_horas) > 0
                ? <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>
                    {Number(r.total_horas).toFixed(2)}h × {BRL(Number(r.valor_hora))} × <strong style={{ color: r.feriado_domingo ? '#D89030' : T.blueL }}>{r.feriado_domingo ? '200%' : '150%'}</strong> = <strong style={{ color: POS().color }}>{BRL(Number(r.valor_total))}</strong>
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
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: `1px solid ${alpha('#C04050', 0.3)}`, background: alpha('#C04050', 0.08), color: NEG().color, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-body)', outline: 'none' }}>
                    <Ico d={G.trash} size={13} /> Excluir registro
                  </button>
                )}
              </div>
            </>
          ) : (
            <div>Dias justificados pelo RH são abonados e deixam de contar como negativos.</div>
          )}
        </div>
      )}
    </div>
  );
};

export { TabHoras };
