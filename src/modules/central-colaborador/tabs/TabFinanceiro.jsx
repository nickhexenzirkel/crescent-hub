// src/modules/central-colaborador/tabs/TabFinanceiro.jsx
// "Financeiro" (visão do COLABORADOR), no mesmo modelo visual do Banco de Horas e do
// Ponto Eletrônico (tabs/portalKit):
//  • Cabeçalho com o salário líquido (bruto, 1K Service, descontos) e o botão de
//    mostrar/ocultar valores — oculto por padrão; o olho vale pra TODOS os valores da aba.
//  • Seus dados de contrato (categoria, cargo, admissão + tempo de casa, dependentes...).
//  • Composição do salário: barra proporcional + linhas de proventos/descontos e o
//    valor-hora (mesma base do Banco de Horas: bruto + 1K ÷ 240).
//  • Contracheques enviados pelo RH, com busca, filtro por ano e prévia do arquivo.
//  • Evolução salarial: gráfico + linha do tempo dos reajustes.
import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { USER, SERVER_URL, supabase as _supabase } from '../../../contexts/user';
import { useIsMobile } from '../../../hooks/useIsMobile';
import {
  Ico, G, mix, alpha, tone, Pill, PortalKitStyles, PortalHero, HeroStat, HeroChip, HeroAside,
  SectionCard, SearchField, SelectField, ListRow, MetaLine, Dot, Tile, Spinner, Empty,
} from './portalKit';

/* ── helpers ──────────────────────────────────────────────────── */
const BRL = v => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const fmtDate = iso => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; } };

const I = {
  eye:     <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff:  <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></>,
  wallet:  <><path d="M20 7.5V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h13a2 2 0 002-2v-1.5" /><path d="M21.5 9.5H16a2.5 2.5 0 000 5h5.5z" /><circle cx="16.3" cy="12" r=".6" /></>,
  user:    <><circle cx="12" cy="8" r="4" /><path d="M4 20.5c0-4 3.6-7 8-7s8 3 8 7" /></>,
  badge:   <><rect x="3" y="5" width="18" height="15" rx="2.5" /><circle cx="9" cy="11.5" r="2.2" /><path d="M5.8 17c.5-1.5 1.7-2.3 3.2-2.3s2.7.8 3.2 2.3M14.5 10h3.5M14.5 13.5h3.5M9 2.5v2.5M15 2.5v2.5" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5a2 2 0 012-2h3a2 2 0 012 2V7M3 12.5h18" /></>,
  users:   <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18.5 14.3c1.8.8 3 2.9 3 5.7" /></>,
  download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  layers:  <><polygon points="12 2.5 21.5 7.5 12 12.5 2.5 7.5 12 2.5" /><polyline points="2.5 12 12 17 21.5 12" /><polyline points="2.5 16.5 12 21.5 21.5 16.5" /></>,
  percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
};

// Competência é texto livre no RH ("Janeiro/2025", "01/2025", "2025-01"...). Tenta extrair
// mês/ano pra ordenar e agrupar; se não conseguir, fica só o texto.
const parseCompetencia = (txt) => {
  const s = norm(txt);
  let m = /(\d{4})[-/.](\d{1,2})/.exec(s);
  if (m) return { y: +m[1], m: +m[2] };
  m = /(\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return { y: +m[2], m: +m[1] };
  const ano = /(\d{4})/.exec(s);
  const idx = MESES.findIndex(n => s.includes(norm(n)) || s.includes(norm(n).slice(0, 3)));
  if (ano && idx >= 0) return { y: +ano[1], m: idx + 1 };
  if (ano) return { y: +ano[1], m: 0 };
  return null;
};

// Admissão vem como DD/MM/AAAA (ou ISO). Devolve "3 anos e 2 meses".
const tempoDeCasa = (adm) => {
  if (!adm || adm === '—') return null;
  let d = null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(adm.trim());
  if (br) d = new Date(+br[3], +br[2] - 1, +br[1]);
  else if (/^\d{4}-\d{2}-\d{2}/.test(adm)) d = new Date(adm.slice(0, 10) + 'T12:00:00');
  if (!d || isNaN(d)) return null;
  const hoje = new Date();
  let meses = (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth());
  if (hoje.getDate() < d.getDate()) meses--;
  if (meses < 0) return null;
  const a = Math.floor(meses / 12), mm = meses % 12;
  if (!a && !mm) return 'menos de 1 mês';
  return [a && `${a} ano${a > 1 ? 's' : ''}`, mm && `${mm} ${mm > 1 ? 'meses' : 'mês'}`].filter(Boolean).join(' e ');
};

const extDoArquivo = url => { const m = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(url || ''); return m ? m[1].toLowerCase() : ''; };

/* ── componente principal ──────────────────────────────────────── */
const TabFinanceiro = () => {
  const isMobile = useIsMobile();
  const [histLoading, setHistLoading] = useState(true);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [contracheques, setContracheques] = useState([]);
  const [chLoading, setChLoading] = useState(true);
  const [salVisible, setSalVisible] = useState(false);
  const [chBusca, setChBusca] = useState('');
  const [chAno, setChAno] = useState('todos');
  const [chOrdem, setChOrdem] = useState('desc');
  const [chAberto, setChAberto] = useState(null);

  /* cálculos: Salário Bruto + 1K Service - INSS = Líquido */
  const salario        = USER.salary || 0;
  const gross1k        = USER.salary_1k || 0;
  const inss           = USER.inss      || 0;
  const totalBruto     = salario + gross1k;
  const totalDescontos = inss;
  const liquido        = totalBruto - totalDescontos;
  const valorHora      = totalBruto > 0 ? totalBruto / 240 : 0; // mesma base do Banco de Horas

  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (token) {
      fetch(`${SERVER_URL}/api/auth/salary-history`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { history: [] })
        .then(d => setSalaryHistory(d.history || []))
        .catch(() => {})
        .finally(() => setHistLoading(false));
    } else setHistLoading(false);

    // O bucket é privado agora (ver supabase_seguranca_contracheques_link_assinado.sql)
    // — file_url guardado no banco não abre mais direto. Troca por um link
    // assinado (expira em 10 min) na hora de exibir. Registros antigos sem
    // storage_path (enviados antes desta correção) caem de volta pro file_url
    // salvo, que continua existindo na tabela mesmo sem funcionar mais —
    // aparecerão como "arquivo indisponível" até o RH reenviar.
    _supabase.from('contracheques').select('*')
      .eq('employee_name', USER.name)
      .order('competencia', { ascending: false })
      .then(async ({ data }) => {
        const rows = data || [];
        const comLink = await Promise.all(rows.map(async (ch) => {
          if (!ch.storage_path) return ch;
          try {
            const { data: signed } = await _supabase.storage.from('contracheques').createSignedUrl(ch.storage_path, 600);
            return signed?.signedUrl ? { ...ch, file_url: signed.signedUrl } : ch;
          } catch { return ch; }
        }));
        setContracheques(comLink);
      })
      .catch(() => {})
      .finally(() => setChLoading(false));
  }, []);

  // valor ou máscara, conforme o olho
  const R$ = (v, sinal = '') => (salVisible ? `${sinal}R$ ${BRL(v)}` : `${sinal}R$ ••••,••`);

  // ── contracheques: ordena pela competência (texto livre) e filtra ──
  const chs = contracheques.map((ch, i) => {
    const p = parseCompetencia(ch.competencia || ch.month);
    return { ch, i, p, key: p ? p.y * 100 + p.m : 0, quando: ch.created_at || ch.attached_at || '' };
  });
  chs.sort((a, b) => (b.key - a.key) || (b.quando > a.quando ? 1 : b.quando < a.quando ? -1 : 0));
  const maisRecente = chs[0]?.ch;
  if (chOrdem === 'asc') chs.reverse();
  const anosCh = [...new Set(chs.map(c => c.p?.y).filter(Boolean))].sort((a, b) => b - a);
  const cq = norm(chBusca.trim());
  const chFiltrados = chs.filter(c => {
    if (chAno !== 'todos' && String(c.p?.y) !== chAno) return false;
    if (!cq) return true;
    return norm(`${c.ch.competencia || ''} ${c.p?.m ? MESES[c.p.m - 1] : ''} ${c.p?.y || ''} ${fmtDate(c.quando)}`).includes(cq);
  });

  // ── evolução salarial ──
  const hist = salaryHistory.map(s => ({ ...s, salary: Number(s.salary) || 0 }));
  const primeiro = hist[0], ultimo = hist[hist.length - 1];
  const crescimento = primeiro && ultimo && primeiro.salary > 0 ? (ultimo.salary / primeiro.salary - 1) * 100 : null;

  const casa = tempoDeCasa(USER.admission);
  const pctDe = v => (totalBruto > 0 ? Math.round(v / totalBruto * 1000) / 10 : 0);

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <PortalKitStyles />
      <style>{`
        .fin-info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .fin-comp{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:28px;align-items:start}
        .fin-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        @container (max-width: 980px){ .fin-comp{grid-template-columns:minmax(0,1fr)} .fin-kpis{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @container (max-width: 760px){ .fin-info{grid-template-columns:repeat(2,minmax(0,1fr))} }
        @container (max-width: 420px){ .fin-info,.fin-kpis{grid-template-columns:minmax(0,1fr)} }
      `}</style>

      {/* ── CABEÇALHO: salário líquido ── */}
      <PortalHero isMobile={isMobile} icon={I.wallet} kicker="FINANCEIRO" title="Seu salário," accent="sem mistério"
        subtitle="Entenda como o seu líquido é calculado, baixe seus contracheques e acompanhe a sua evolução."
        card={{
          icon: G.money, label: 'SALÁRIO LÍQUIDO', value: R$(liquido),
          note: salVisible ? 'valor final a receber' : 'toque em “Mostrar valores” para ver',
          stats: <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
              <HeroStat icon={G.upCircle} color="#3DDC97" label="Bruto" value={R$(salario)} />
              <HeroStat icon={G.trend} color="#7CC0FF" label="1K Service" value={R$(gross1k, '+ ')} />
            </div>
            <HeroChip icon={G.downCircle}>Descontos: {R$(totalDescontos, '− ')}</HeroChip>
          </>,
          aside: <HeroAside icon={G.fileText} label="Contracheques" value={chLoading ? '—' : contracheques.length} />,
        }}
        action={{ label: salVisible ? 'Ocultar valores' : 'Mostrar valores', icon: salVisible ? I.eyeOff : I.eye, onClick: () => setSalVisible(v => !v) }} />

      {/* ── SEUS DADOS DE CONTRATO ── */}
      <SectionCard isMobile={isMobile} icon={I.badge} title="Informações do colaborador" subtitle="Os dados do seu contrato usados na folha.">
        <div className="fin-info">
          {[
            [I.user, 'Nome', USER.name],
            [I.layers, 'Categoria', USER.category],
            [I.briefcase, 'Cargo', USER.cargo],
            [G.calendar, 'Admissão', USER.admission, casa && `${casa} de casa`],
            [I.users, 'Dependentes', USER.dependents],
            [G.clock, 'Hora/Mês', USER.horasMes],
          ].map(([icon, label, valor, nota]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 14, background: T.surfaceSub, border: `1px solid ${T.border}`, minWidth: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tone('brand').bg, color: tone('brand').color }}>
                <Ico d={icon} size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textT, letterSpacing: '.05em', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginTop: 2, overflowWrap: 'anywhere' }}>{valor === 0 ? '0' : (valor || '—')}</div>
                {nota && <div style={{ fontSize: 12, color: T.textS, marginTop: 1 }}>{nota}</div>}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── COMPOSIÇÃO DO SALÁRIO ── */}
      <SectionCard isMobile={isMobile} icon={I.layers} title="Composição do salário" subtitle="De onde vem o seu líquido, provento por provento."
        tools={
          <button onClick={() => setSalVisible(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.surfaceInput || T.surfaceSub, color: T.text, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            <Ico d={salVisible ? I.eyeOff : I.eye} size={17} />{salVisible ? 'Ocultar valores' : 'Mostrar valores'}
          </button>
        }>
        <div className="fin-comp">
          <div style={{ minWidth: 0 }}>
            {/* barra proporcional */}
            <div style={{ display: 'flex', height: 16, borderRadius: 99, overflow: 'hidden', background: T.border, marginBottom: 8 }}>
              {totalBruto > 0 && <>
                <div title="Líquido" style={{ width: `${Math.max(0, liquido) / totalBruto * 100}%`, background: `linear-gradient(90deg, ${T.blue}, ${T.blueL})` }} />
                <div title="Descontos" style={{ width: `${totalDescontos / totalBruto * 100}%`, background: tone('neg').color }} />
              </>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: T.textS, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.blueL }} />Você recebe {pctDe(liquido)}% do bruto</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: tone('neg').color }} />Descontos {pctDe(totalDescontos)}%</span>
            </div>

            {/* linhas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { t: tone('pos'), icon: G.arrowUp, label: 'Salário bruto', nota: 'provento', v: salario, sinal: '+ ', pct: pctDe(salario) },
                { t: tone('info'), icon: G.trend, label: '1K Service', nota: 'provento', v: gross1k, sinal: '+ ', pct: pctDe(gross1k) },
                { t: tone('neg'), icon: G.arrowDown, label: 'INSS', nota: 'desconto', v: inss, sinal: '− ', pct: pctDe(inss) },
              ].map(l => (
                <div key={l.label} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, background: T.surfaceSub, border: `1px solid ${T.border}`, boxShadow: `inset 4px 0 0 ${l.t.color}` }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: l.t.bg, color: l.t.color }}>
                    <Ico d={l.icon} size={17} sw={2.4} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{l.label}</div>
                    <div style={{ fontSize: 12, color: T.textT }}>{l.nota} · {l.pct}% do bruto</div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: l.t.color, whiteSpace: 'nowrap' }}>{R$(l.v, l.sinal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* total + fórmula + valor-hora */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '20px 22px',
              background: `linear-gradient(135deg, ${mix(T.blue, '#070618', T.dark ? 0.55 : 0.35)}, ${T.blue})`,
              boxShadow: `0 10px 28px ${alpha(T.blue, 0.28)}`,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(255,255,255,.75)' }}>SALÁRIO LÍQUIDO</div>
              <div style={{ fontSize: isMobile ? 30 : 36, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginTop: 4 }}>{R$(liquido)}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', marginTop: 2 }}>valor final a receber</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', fontSize: 12.5, color: '#fff', fontWeight: 600 }}>
                <span>{R$(salario)}</span><span style={{ opacity: .6 }}>+</span><span>{R$(gross1k)}</span>
                {totalDescontos > 0 && <><span style={{ opacity: .6 }}>−</span><span style={{ color: '#FFB3BE' }}>{R$(totalDescontos)}</span></>}
                <span style={{ opacity: .6 }}>=</span><strong>{R$(liquido)}</strong>
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 14, background: T.surfaceSub, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textS, fontWeight: 600 }}>
                <Ico d={G.clock} size={15} stroke={T.textS} />Valor da sua hora
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 10 }}>
                {[['Normal', valorHora, T.text], ['Extra 150%', valorHora * 1.5, tone('pos').color], ['Feriado 200%', valorHora * 2, tone('warn').color]].map(([l, v, c]) => (
                  <div key={l} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: T.textT }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c, whiteSpace: 'nowrap' }}>{salVisible ? `R$ ${BRL(v)}` : 'R$ ••,••'}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: T.textT, marginTop: 10, lineHeight: 1.5 }}>
                Bruto + 1K Service ÷ 240h — a mesma base usada pra calcular suas horas extras no Banco de Horas.
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── CONTRACHEQUES ── */}
      <SectionCard isMobile={isMobile} icon={G.fileText} title="Contracheques"
        subtitle={contracheques.length ? `Documentos enviados pelo RH · ${contracheques.length} no total` : 'Documentos enviados pelo RH.'}
        barCols="minmax(0,1.6fr) repeat(2,minmax(0,1fr))"
        bar={contracheques.length > 0 && <>
          <SearchField value={chBusca} onChange={setChBusca} placeholder="Buscar mês, ano, data de envio..." />
          <SelectField value={chAno} onChange={setChAno} icon={G.calendar} options={[['todos', 'Todos os anos'], ...anosCh.map(a => [String(a), String(a)])]} />
          <SelectField value={chOrdem} onChange={setChOrdem} icon={I.layers} options={[['desc', 'Mais recentes'], ['asc', 'Mais antigos']]} />
        </>}>
        {chLoading ? <Spinner label="Carregando contracheques..." />
          : contracheques.length === 0 ? <Empty icon={G.fileText} title="Nenhum contracheque disponível" hint="O RH disponibiliza mensalmente." />
          : chFiltrados.length === 0 ? <Empty icon={G.search} title="Nenhum contracheque com esses filtros." />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {chFiltrados.map(c => (
                <ContrachequeRow key={c.ch.id || c.i} c={c} isMobile={isMobile} recente={c.ch === maisRecente}
                  open={chAberto === (c.ch.id || c.i)} onToggle={() => setChAberto(a => (a === (c.ch.id || c.i) ? null : (c.ch.id || c.i)))} />
              ))}
            </div>
          )}
      </SectionCard>

      {/* ── EVOLUÇÃO SALARIAL ── */}
      <SectionCard isMobile={isMobile} icon={G.trend} title="Evolução salarial" subtitle="Seus reajustes ao longo do tempo.">
        {histLoading ? <Spinner label="Carregando histórico..." />
          : hist.length === 0 ? <Empty icon={G.trend} title="Nenhum histórico registrado ainda" hint="O RH registra automaticamente ao atualizar o salário." />
          : (
            <>
              <div className="fin-kpis" style={{ marginBottom: 18 }}>
                {[
                  [G.calendar, 'Primeiro registro', R$(primeiro.salary), primeiro.date],
                  [G.money, 'Salário atual', R$(ultimo.salary), ultimo.date],
                  [I.percent, 'Crescimento', crescimento != null ? `${crescimento >= 0 ? '+' : ''}${crescimento.toFixed(1).replace('.', ',')}%` : '—', 'desde o primeiro registro', crescimento > 0 ? tone('pos').color : null],
                  [G.list, 'Registros', hist.length, `${Math.max(0, hist.length - 1)} alteraç${hist.length - 1 === 1 ? 'ão' : 'ões'}`],
                ].map(([icon, label, valor, nota, cor]) => (
                  <div key={label} style={{ padding: '14px 16px', borderRadius: 14, background: T.surfaceSub, border: `1px solid ${T.border}`, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textS, fontWeight: 600 }}><Ico d={icon} size={15} stroke={T.textS} />{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: cor || T.text, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
                    {nota && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>{nota}</div>}
                  </div>
                ))}
              </div>

              <div style={{ padding: isMobile ? '14px 8px 8px' : '18px 18px 12px', borderRadius: 16, background: T.surfaceSub, border: `1px solid ${T.border}`, marginBottom: 18 }}>
                <SalaryChart data={hist} visivel={salVisible} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...hist].reverse().map((s, i, arr) => {
                  const anterior = arr[i + 1];
                  const diff = anterior ? s.salary - anterior.salary : null;
                  const ano = (/(\d{4})/.exec(s.date || '') || [])[1];
                  return (
                    <ListRow key={i} isMobile={isMobile}
                      accent={i === 0 ? tone('pos').color : T.border}
                      tile={<Tile isMobile={isMobile}>
                        {ano
                          ? <span style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800 }}>{ano}</span>
                          : <Ico d={G.trend} size={isMobile ? 24 : 30} stroke="#fff" sw={2} />}
                      </Tile>}
                      title={s.event || 'Alteração salarial'}
                      meta={<MetaLine isMobile={isMobile} icon={G.calendar}>
                        <span>{s.date || '—'}</span>
                        {i === 0 && <><Dot /><span>salário vigente</span></>}
                      </MetaLine>}
                      middle={
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{R$(s.salary)}</span>
                          {diff != null && diff !== 0 && (
                            <span style={{ fontSize: 12.5, color: T.textT }}>{diff > 0 ? '+' : '−'} {salVisible ? `R$ ${BRL(Math.abs(diff))}` : 'R$ ••••'} em relação ao anterior</span>
                          )}
                        </div>
                      }
                      status={s.pct
                        ? <Pill t={tone('pos')} icon={G.arrowUp} size="sm" style={{ justifySelf: 'end' }}>{s.pct}</Pill>
                        : <Pill t={tone('muted')} size="sm" style={{ justifySelf: 'end' }}>{i === arr.length - 1 ? 'Início' : '—'}</Pill>} />
                  );
                })}
              </div>
            </>
          )}
      </SectionCard>
    </div>
  );
};

/* ── Linha de contracheque ─────────────────────────────────────── */
const ContrachequeRow = ({ c, isMobile, recente, open, onToggle }) => {
  const { ch, p } = c;
  const url = ch.file_url;
  const ext = extDoArquivo(url);
  const img = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const titulo = p && p.m ? `${cap(MESES[p.m - 1])} de ${p.y}` : (ch.competencia || ch.month || `Competência ${c.i + 1}`);

  const acaoBtn = (href, icon, title, t, download) => (
    <a href={href} target="_blank" rel="noreferrer" download={download || undefined} title={title} onClick={e => e.stopPropagation()}
      style={{ width: isMobile ? 40 : 36, height: isMobile ? 40 : 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.color, textDecoration: 'none', flexShrink: 0 }}>
      <Ico d={icon} size={16} sw={2} />
    </a>
  );

  return (
    <ListRow isMobile={isMobile} open={open} onToggle={onToggle} accent={recente ? tone('pos').color : alpha(T.blue, 0.55)}
      tile={<Tile isMobile={isMobile}>
        {p && p.m
          ? <>
              <span style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800, lineHeight: 1, textTransform: 'uppercase' }}>{MESES[p.m - 1].slice(0, 3)}</span>
              <span style={{ fontSize: isMobile ? 10 : 11.5, fontWeight: 700, opacity: .85, marginTop: 4 }}>{p.y}</span>
            </>
          : <Ico d={G.fileText} size={isMobile ? 24 : 32} stroke="#fff" sw={2} />}
      </Tile>}
      title={`Contracheque · ${titulo}`}
      meta={<>
        <MetaLine isMobile={isMobile} icon={G.calendar}>
          <span>Competência {ch.competencia || '—'}</span>
        </MetaLine>
        <MetaLine isMobile={isMobile} icon={I.download}>
          <span>Anexado em {fmtDate(ch.created_at || ch.attached_at)}</span>
          {recente && <Pill t={tone('pos')} size="sm">mais recente</Pill>}
        </MetaLine>
      </>}
      middle={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <Pill t={tone('brand')} icon={G.fileText}>{ext ? ext.toUpperCase() : 'Arquivo'}</Pill>
          <span style={{ fontSize: 12.5, color: T.textT }}>{url ? 'Toque para ver a prévia' : 'Arquivo indisponível'}</span>
        </div>
      }
      status={url
        ? <div style={{ display: 'flex', gap: 8, justifySelf: 'end' }}>
            {acaoBtn(url, I.eye, 'Visualizar', tone('info'))}
            {acaoBtn(url, I.download, 'Baixar', tone('pos'), true)}
          </div>
        : <Pill t={tone('muted')} size="sm" style={{ justifySelf: 'end' }}>sem arquivo</Pill>}>
      {url ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {img
            ? <img src={url} alt={titulo} style={{ maxWidth: '100%', maxHeight: 640, borderRadius: 12, border: `1px solid ${T.border}`, alignSelf: 'flex-start' }} />
            : <iframe title={titulo} src={url} style={{ width: '100%', height: isMobile ? 420 : 620, border: `1px solid ${T.border}`, borderRadius: 12, background: '#fff' }} />}
          <div style={{ fontSize: 12, color: T.textT }}>
            Não carregou? <a href={url} target="_blank" rel="noreferrer" style={{ color: tone('brand').color, fontWeight: 600 }}>Abrir em outra aba</a>
          </div>
        </div>
      ) : <div>O RH não anexou o arquivo deste contracheque.</div>}
    </ListRow>
  );
};

/* ── Gráfico de evolução (responsivo; valores seguem o olho) ─────── */
const SalaryChart = ({ data, visivel }) => {
  // Mede a largura real do espaço: o SVG é desenhado em pixels 1:1, então o texto
  // fica do mesmo tamanho em qualquer tela (esticar um viewBox fixo deixava gigante/minúsculo).
  const boxRef = useRef(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!data || data.length < 2) return (
    <div style={{ textAlign: 'center', padding: '28px 0', color: T.textT, fontSize: 12.5 }}>O gráfico aparece com ao menos 2 registros.</div>
  );
  const cor = T.dark ? mix(T.blueL, '#FFFFFF', 0.2) : T.blue;
  const maxS = Math.max(...data.map(d => d.salary));
  const minS = Math.min(...data.map(d => d.salary));
  const H = 230, padL = 52, padR = 36, padT = 44, padB = 30;
  const xStep = (W - padL - padR) / Math.max(data.length - 1, 1);
  const yRange = maxS - minS || 1;
  const pts = data.map((d, i) => ({ x: padL + i * xStep, y: padT + (1 - (d.salary - minS) / yRange) * (H - padT - padB), ...d }));
  const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${H - padB} ` + pts.map(p => `L${p.x},${p.y}`).join(' ') + ` L${pts[pts.length - 1].x},${H - padB} Z`;
  const k = v => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(v)));
  return (
    <div ref={boxRef} style={{ width: '100%' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f, i) => {
          const y = padT + f * (H - padT - padB);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={T.border} strokeWidth="1" strokeDasharray="4 4" />
              <text x={padL - 8} y={y + 4} fontSize="11" fill={T.textT} textAnchor="end" fontFamily="var(--font-body)">{visivel ? k(maxS - f * yRange) : '••'}</text>
            </g>
          );
        })}
        <path d={area} fill="url(#finGrad)" />
        <polyline points={poly} fill="none" stroke={cor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill={T.surface} stroke={cor} strokeWidth="3" />
            <text x={p.x} y={H - 8} fontSize="11" fill={T.textS} textAnchor="middle" fontFamily="var(--font-body)">{p.date}</text>
            <text x={p.x} y={p.y - 14} fontSize="11.5" fill={T.text} fontWeight="700" textAnchor="middle" fontFamily="var(--font-body)">
              {visivel ? `R$ ${k(p.salary)}` : 'R$ ••'}
            </text>
            {p.pct && <text x={p.x} y={p.y - 28} fontSize="10.5" fontWeight="700" fill={tone('pos').color} textAnchor="middle" fontFamily="var(--font-body)">{p.pct}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
};

export { TabFinanceiro };
