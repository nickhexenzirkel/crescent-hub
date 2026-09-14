// src/modules/central-colaborador/tabs/TabMeuPonto.jsx
// "Ponto Eletrônico" (visão do COLABORADOR), no mesmo modelo visual do Banco de Horas:
//  • Cabeçalho com o saldo do banco (positivas/negativas/faltas/abonos) e o botão de
//    solicitar justificativa.
//  • Saldo por mês em cartões (com mini-gráfico diário e comparação com o mês anterior);
//    clicar num mês filtra o calendário e a lista de dias.
//  • Calendário do mês + resumo do período (trabalhadas × previstas, distribuição dos
//    dias, entrada/saída médias).
//  • PONTOS BATIDOS por dia (ponto_marcacoes) com o saldo calculado NO CLIENTE (pontoCalc),
//    filtráveis por mês, dia, situação e busca; cada dia abre a linha do tempo das batidas
//    e, se ficou negativo, o botão "Solicitar justificativa".
//  • Justificativas: solicitações do colaborador (ponto_solicitacoes) + abonos do RH
//    (ponto_justificativas), com filtro por tipo, mês e busca.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase as _supabase } from '../../../contexts/user';
import { computePontoDays, loadColaboradorPonto, PONTO_DEFAULTS } from '../../../shared/pontoCalc';
import { useIsMobile } from '../../../hooks/useIsMobile';
import {
  Ico, G, mix, alpha, tone, Pill, StatusPill, PortalKitStyles, PortalHero, HeroStat, HeroChip, HeroAside,
  SectionCard, SearchField, SelectField, DateField, ListRow, MetaLine, Dot, Tile, RED_GRAD, Spinner, Empty,
} from './portalKit';

// ── formatação ──
const onlyDigits = s => (s || '').replace(/\D/g, '');
const fmtMin = m => { const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60; return `${m < 0 ? '-' : ''}${h}h${mm.toString().padStart(2, '0')}`; };
const fmtSaldo = m => (m > 0 ? '+' : '') + fmtMin(m);
const fmtData = iso => { if (!iso) return '—'; try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return iso; } };
const fmtDataHora = ts => { try { return new Date(ts).toLocaleDateString('pt-BR'); } catch { return ''; } };
const dow = iso => new Date(iso + 'T12:00:00').getDay();
const SEM_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEM_LONGO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesCurto = ym => { const [y, m] = ym.split('-'); return `${MESES[+m - 1].slice(0, 3)}/${y}`; };
const mesLongo = ym => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} de ${y}`; };
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tituloDia = iso => { const [, m, d] = iso.split('-'); return `${SEM_LONGO[dow(iso)]}, ${+d} de ${MESES[+m - 1]}`; };
const toMin = h => { const [a, b] = (h || '0:0').split(':').map(Number); return a * 60 + (b || 0); };
const minToHH = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const todayISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const shiftYm = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const POR_PAGINA = 31;

// ── situação de cada dia (rótulo, tom e prioridade) ──
const situacaoDia = (d, pendente) => {
  if (d.abonado && (d.rawBalance < 0 || d.falta)) return { key: 'abonado', label: 'Abonado', t: tone('info') };
  if (d.falta) return pendente ? { key: 'analise', label: 'Em análise', t: tone('warn') } : { key: 'falta', label: 'Falta', t: tone('neg') };
  if (d.balance < 0) return pendente ? { key: 'analise', label: 'Em análise', t: tone('warn') } : { key: 'negativo', label: 'Negativo', t: tone('neg') };
  if (d.times.length % 2 === 1) return { key: 'incompleto', label: 'Incompleto', t: tone('warn') };
  if (d.wknd) return { key: 'fds', label: 'Fim de semana', t: tone('brand') };
  if (d.balance > 0) return { key: 'positivo', label: 'Positivo', t: tone('pos') };
  return { key: 'ok', label: 'No horário', t: tone('muted') };
};

const SITUACOES = [
  ['todas', 'Todas as situações'],
  ['positivos', 'Com horas positivas'],
  ['negativos', 'Com horas negativas'],
  ['justificar', 'A justificar'],
  ['analise', 'Justificativa em análise'],
  ['faltas', 'Faltas'],
  ['abonados', 'Abonados pelo RH'],
  ['incompletos', 'Batidas incompletas'],
  ['fds', 'Fins de semana'],
];

const TIPOS_JUST = [
  ['todas', 'Todas as justificativas'],
  { grupo: 'Minhas solicitações', itens: [['sol_todas', 'Todas as solicitações'], ['sol_pendente', 'Pendentes'], ['sol_resolvido', 'Resolvidas']] },
  { grupo: 'Registradas pelo RH', itens: [['rh_todas', 'Todas do RH'], ['rh_abonado', 'Abonadas'], ['rh_sem', 'Sem abono']] },
];

const TabMeuPonto = () => {
  const isMobile = useIsMobile();
  const cpf = onlyDigits(getAuthUser()?.cpf || USER.cpf);
  const [marcacoes, setMarcacoes] = useState([]);
  const [justifs, setJustifs]     = useState([]);
  const [solics, setSolics]       = useState([]);
  const [pontoCpf, setPontoCpf]   = useState('');   // id do colaborador no ponto (PIS)
  const [limiteISO, setLimiteISO] = useState('');   // até onde os dados do ponto vão no sistema
  const [loading, setLoading]     = useState(true);

  // filtros dos dias
  const [mes, setMes]           = useState('auto');   // 'auto' = mês mais recente · 'todos' · 'YYYY-MM'
  const [dia, setDia]           = useState('');
  const [situacao, setSituacao] = useState('todas');
  const [busca, setBusca]       = useState('');
  const [ordem, setOrdem]       = useState('desc');
  const [pagina, setPagina]     = useState({ sig: '', n: POR_PAGINA });
  const [aberto, setAberto]     = useState(null);
  const [anoStrip, setAnoStrip] = useState('todos');
  // filtros das justificativas
  const [jBusca, setJBusca] = useState('');
  const [jTipo, setJTipo]   = useState('todas');
  const [jMes, setJMes]     = useState('todos');
  const [jAberto, setJAberto] = useState(null);

  // modal de solicitação
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ titulo: '', descricao: '', data_ref: '' });
  const [file, setFile]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');
  const fileRef = useRef(null);
  const diasRef = useRef(null);
  const justRef = useRef(null);

  const loadSolics = async () => {
    const { data } = await _supabase.from('ponto_solicitacoes').select('*').eq('cpf', cpf).order('created_at', { ascending: false });
    setSolics(data || []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // resolve marcações/justificativas pelo CPF (e por NOME, se o CPF não bater)
        const [pt, sol] = await Promise.all([
          loadColaboradorPonto({ cpf, name: USER.name }),
          cpf ? _supabase.from('ponto_solicitacoes').select('*').eq('cpf', cpf).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        ]);
        if (!alive) return;
        setMarcacoes(pt.marcacoes);
        setJustifs(pt.justifs);
        setPontoCpf(pt.pontoCpf || '');
        setLimiteISO(pt.limiteISO || '');
        setSolics(sol.data || []);
      } catch {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [cpf]);

  // ── cálculo ──
  const days = useMemo(() => {
    // dias justificados (abonados) → zeram no cálculo
    const abonadoDates = new Set(justifs.filter(j => j.texto && j.abonado !== false).map(j => j.data));
    return computePontoDays(marcacoes, abonadoDates, { limiteISO }); // ASC
  }, [marcacoes, justifs, limiteISO]);

  const justifPorDia = useMemo(() => {
    const m = {}; for (const j of justifs) (m[j.data] = m[j.data] || []).push(j); return m;
  }, [justifs]);
  const solicPorDia = useMemo(() => {
    const m = {}; for (const s of solics) if (s.data_ref) (m[s.data_ref] = m[s.data_ref] || []).push(s); return m;
  }, [solics]);
  const temPendente = date => (solicPorDia[date] || []).some(s => (s.status || 'pendente') === 'pendente');
  const temSolic = date => (solicPorDia[date] || []).length > 0;

  const totalSaldo = days.reduce((a, d) => a + d.balance, 0);
  const positivas  = days.reduce((a, d) => (d.balance > 0 ? a + d.balance : a), 0);
  const negativas  = days.reduce((a, d) => (d.balance < 0 ? a + d.balance : a), 0);
  const faltasTot  = days.filter(d => d.falta && !d.abonado).length;
  const abonadosTot = days.filter(d => d.abonado && (d.rawBalance < 0 || d.falta)).length;
  const aJustificar = days.filter(d => d.balance < 0 && !temSolic(d.date)).length;

  // resumo por mês (mais recente primeiro)
  const meses = useMemo(() => {
    const map = {};
    for (const d of days) {
      const ym = d.date.slice(0, 7);
      const m = map[ym] || (map[ym] = { ym, saldo: 0, pos: 0, neg: 0, trab: 0, prev: 0, diasPonto: 0, faltas: 0, abonados: 0, negDias: 0, serie: [] });
      m.saldo += d.balance; m.trab += d.totalMin; m.prev += d.expected;
      if (d.balance > 0) m.pos += d.balance;
      if (d.balance < 0) { m.neg += d.balance; m.negDias++; }
      if (d.times.length) m.diasPonto++;
      if (d.falta && !d.abonado) m.faltas++;
      if (d.abonado && (d.rawBalance < 0 || d.falta)) m.abonados++;
      m.serie.push(d);
    }
    return Object.values(map).sort((a, b) => (a.ym < b.ym ? 1 : -1));
  }, [days]);
  const mesInfo = ym => meses.find(m => m.ym === ym);
  const mesSel = mes === 'auto' ? (meses[0]?.ym || 'todos') : mes;
  const anos = [...new Set(meses.map(m => m.ym.slice(0, 4)))];

  // ── filtro dos dias ──
  const q = busca.trim().toLowerCase();
  const diasFiltrados = days.filter(d => {
    if (dia) { if (d.date !== dia) return false; }
    else if (mesSel !== 'todos' && !d.date.startsWith(mesSel)) return false;
    const pend = temPendente(d.date);
    const sit = situacaoDia(d, pend).key;
    switch (situacao) {
      case 'positivos':   if (!(d.balance > 0)) return false; break;
      case 'negativos':   if (!(d.balance < 0)) return false; break;
      case 'justificar':  if (!(d.balance < 0 && !temSolic(d.date))) return false; break;
      case 'analise':     if (!pend) return false; break;
      case 'faltas':      if (!(d.falta && !d.abonado)) return false; break;
      case 'abonados':    if (sit !== 'abonado') return false; break;
      case 'incompletos': if (!(d.times.length % 2 === 1)) return false; break;
      case 'fds':         if (!d.wknd) return false; break;
      default: break;
    }
    if (!q) return true;
    const alvo = [fmtData(d.date), tituloDia(d.date), d.times.join(' '), situacaoDia(d, pend).label,
      ...(justifPorDia[d.date] || []).map(j => j.texto), ...(solicPorDia[d.date] || []).map(s => s.titulo)].join(' ').toLowerCase();
    return alvo.includes(q);
  });
  if (ordem === 'desc') diasFiltrados.reverse();
  const saldoFiltrado = diasFiltrados.reduce((a, d) => a + d.balance, 0);
  const filtrosAtivos = [
    mesSel !== 'todos' && !dia && { k: 'mes', label: `Mês: ${mesCurto(mesSel)}`, clear: () => setMes('todos') },
    dia && { k: 'dia', label: `Dia: ${fmtData(dia)}`, clear: () => setDia('') },
    situacao !== 'todas' && { k: 'sit', label: SITUACOES.find(s => s[0] === situacao)?.[1], clear: () => setSituacao('todas') },
    q && { k: 'q', label: `“${busca.trim()}”`, clear: () => setBusca('') },
  ].filter(Boolean);
  const limparFiltros = () => { setMes('todos'); setDia(''); setSituacao('todas'); setBusca(''); };

  // paginação: volta pra primeira página sempre que o recorte muda
  const recorte = [mesSel, dia, situacao, busca, ordem].join('|');
  const limite = pagina.sig === recorte ? pagina.n : POR_PAGINA;

  const irParaDia = (date) => {
    setMes(date.slice(0, 7)); setDia(date); setSituacao('todas'); setBusca(''); setAberto(date);
    setTimeout(() => diasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const escolherMes = (ym) => { setMes(ym); setDia(''); };

  // ── justificativas (solicitações + registros do RH) ──
  const itensJust = [
    ...solics.map(s => ({ kind: 'sol', key: 's' + s.id, data: s.data_ref || '', quando: s.created_at || '', s })),
    ...justifs.map((j, i) => ({ kind: 'rh', key: 'j' + (j.cpf || '') + j.data + i, data: j.data, quando: j.data, j })),
  ].sort((a, b) => ((a.data || a.quando.slice(0, 10)) < (b.data || b.quando.slice(0, 10)) ? 1 : -1));
  const mesesJust = [...new Set(itensJust.map(it => (it.data || it.quando || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const jq = jBusca.trim().toLowerCase();
  const justFiltradas = itensJust.filter(it => {
    const st = it.kind === 'sol' ? (it.s.status || 'pendente') : (it.j.abonado !== false ? 'abonado' : 'sem');
    if (jTipo === 'sol_todas' && it.kind !== 'sol') return false;
    if (jTipo === 'sol_pendente' && !(it.kind === 'sol' && st === 'pendente')) return false;
    if (jTipo === 'sol_resolvido' && !(it.kind === 'sol' && st === 'resolvido')) return false;
    if (jTipo === 'rh_todas' && it.kind !== 'rh') return false;
    if (jTipo === 'rh_abonado' && !(it.kind === 'rh' && st === 'abonado')) return false;
    if (jTipo === 'rh_sem' && !(it.kind === 'rh' && st === 'sem')) return false;
    if (jMes !== 'todos' && !(it.data || it.quando || '').startsWith(jMes)) return false;
    if (!jq) return true;
    const alvo = (it.kind === 'sol'
      ? [it.s.titulo, it.s.descricao, it.s.file_name, fmtData(it.data)]
      : [it.j.texto, it.j.autor, it.j.file_name, fmtData(it.data)]).join(' ').toLowerCase();
    return alvo.includes(jq);
  });
  const solPendentes = solics.filter(s => (s.status || 'pendente') === 'pendente').length;

  const openModal = (dataRef = '') => { setForm({ titulo: '', descricao: '', data_ref: dataRef }); setFile(null); setMsg(''); setModal(true); };

  const submitSolic = async () => {
    if (!form.titulo.trim()) { setMsg('Informe um título'); return; }
    setSaving(true); setMsg('');
    try {
      let file_url = null, file_name = null;
      if (file) {
        const ext = (file.name.split('.').pop() || 'dat').replace(/[^a-zA-Z0-9]/g, '');
        const path = `${cpf || 'anon'}/${Date.now()}.${ext}`;
        const { error: upErr } = await _supabase.storage.from('ponto-anexos').upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error('Falha ao enviar o anexo: ' + upErr.message);
        const { data } = _supabase.storage.from('ponto-anexos').getPublicUrl(path);
        file_url = data.publicUrl; file_name = file.name;
      }
      const { error } = await _supabase.from('ponto_solicitacoes').insert({
        cpf, ponto_cpf: pontoCpf || null, nome: USER.name, titulo: form.titulo.trim(), descricao: form.descricao.trim() || null,
        data_ref: form.data_ref || null, file_url, file_name, status: 'pendente',
      });
      if (error) throw new Error(error.message);
      setModal(false);
      await loadSolics();
    } catch (e) { setMsg('❌ ' + (e.message || 'Erro ao enviar')); }
    setSaving(false);
  };

  const semCpf = !cpf && marcacoes.length === 0;
  const primeiroMes = meses.length ? meses[meses.length - 1].ym : '';
  const periodo = mesSel === 'todos' ? null : mesInfo(mesSel);
  const resumoDias = dia ? days.filter(d => d.date === dia) : (mesSel === 'todos' ? days : (periodo?.serie || []));
  const modalDia = form.data_ref ? days.find(d => d.date === form.data_ref) : null;

  const opcoesMes = [['todos', 'Todos os meses'], ...meses.map(m => [m.ym, cap(mesLongo(m.ym))])];

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <PortalKitStyles />
      <style>{`
        .mp-strip{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x proximity}
        .mp-strip::-webkit-scrollbar{height:8px}
        .mp-strip::-webkit-scrollbar-thumb{background:${alpha(T.blue, 0.25)};border-radius:99px}
        .mp-mcard{transition:transform .16s, border-color .16s, background .16s}
        .mp-mcard:hover{transform:translateY(-2px)}
        .mp-cal-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;align-items:start}
        .mp-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .mp-cell{transition:transform .12s, box-shadow .12s}
        .mp-cell:hover{transform:translateY(-1px);box-shadow:0 4px 14px ${alpha(T.blue, 0.18)}}
        @container (max-width: 980px){ .mp-cal-grid{grid-template-columns:minmax(0,1fr)} }
        @container (max-width: 420px){ .mp-kpis{grid-template-columns:minmax(0,1fr)} }
      `}</style>

      {/* ── CABEÇALHO: saldo do banco ── */}
      <PortalHero isMobile={isMobile} icon={G.finger} kicker="PONTO ELETRÔNICO" title="Sua jornada," accent="batida a batida"
        subtitle="Veja suas marcações, acompanhe o saldo de cada mês e justifique os dias que ficaram em aberto."
        card={{
          icon: G.clock, label: 'SALDO DO BANCO', value: loading ? '—' : fmtSaldo(totalSaldo),
          negative: totalSaldo < 0,
          note: loading ? 'carregando...' : (totalSaldo < 0 ? 'saldo devendo' : (primeiroMes ? `desde ${mesCurto(primeiroMes)}` : null)),
          stats: <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
              <HeroStat icon={G.upCircle} color="#3DDC97" label="Positivas" value={fmtMin(positivas)} />
              <HeroStat icon={G.downCircle} color="#FF8A9C" label="Negativas" value={fmtMin(negativas)} />
            </div>
            <HeroChip icon={G.alert}>{faltasTot} falta{faltasTot !== 1 ? 's' : ''} · {abonadosTot} abonado{abonadosTot !== 1 ? 's' : ''}</HeroChip>
          </>,
          aside: <HeroAside icon={G.fileText} label="Dias a justificar" value={aJustificar} />,
        }}
        action={{ label: 'Solicitar justificativa', icon: G.filePlus, onClick: () => openModal('') }} />

      {loading ? (
        <SectionCard isMobile={isMobile} icon={G.clock} title="Seu ponto" subtitle="Buscando suas marcações..."><Spinner label="Carregando seu ponto..." /></SectionCard>
      ) : semCpf ? (
        <SectionCard isMobile={isMobile} icon={G.alert} title="Seu ponto">
          <Empty icon={G.finger} title={<>Preencha seu <strong>CPF</strong> em “Seus Dados” para ver seu ponto.</>} />
        </SectionCard>
      ) : (
        <>
          {/* ── SALDO POR MÊS ── */}
          {meses.length > 0 && (
            <SectionCard isMobile={isMobile} icon={G.trend} title="Saldo por mês"
              subtitle="Escolha um mês para ver o calendário e os dias dele."
              tools={anos.length > 1 && (
                <SelectField value={anoStrip} onChange={setAnoStrip} icon={G.calendar} width={isMobile ? '100%' : 180}
                  options={[['todos', 'Todos os anos'], ...anos.map(a => [a, a])]} />
              )}>
              <div className="mp-strip pk-scroll">
                <MesCard isMobile={isMobile} todos selected={mesSel === 'todos'} onClick={() => escolherMes('todos')}
                  saldo={totalSaldo} dias={days.filter(d => d.times.length).length} faltas={faltasTot} serie={days.slice(-62)} />
                {meses.filter(m => anoStrip === 'todos' || m.ym.startsWith(anoStrip)).map(m => {
                  const ant = mesInfo(shiftYm(m.ym, -1));
                  return (
                    <MesCard key={m.ym} isMobile={isMobile} ym={m.ym} selected={mesSel === m.ym} onClick={() => escolherMes(m.ym)}
                      saldo={m.saldo} dias={m.diasPonto} faltas={m.faltas} serie={m.serie} delta={ant ? m.saldo - ant.saldo : null} />
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ── CALENDÁRIO + RESUMO ── */}
          {meses.length > 0 && (
            <CalendarioResumo isMobile={isMobile} meses={meses} mesSel={mesSel} dia={dia} resumoDias={resumoDias}
              periodoLabel={dia ? tituloDia(dia) : (mesSel === 'todos' ? 'Todo o período' : cap(mesLongo(mesSel)))}
              onMes={escolherMes} onDia={irParaDia} temPendente={temPendente} />
          )}

          {/* ── PONTOS BATIDOS ── */}
          <SectionCard isMobile={isMobile} bodyRef={diasRef} icon={G.finger} title="Pontos batidos"
            subtitle="Cada dia com as batidas, as horas trabalhadas e o saldo."
            barCols="minmax(0,1.5fr) repeat(4,minmax(0,1fr))"
            bar={<>
              <SearchField value={busca} onChange={setBusca} placeholder="Buscar data, horário, justificativa..." />
              <SelectField value={dia ? dia.slice(0, 7) : mesSel} onChange={v => { escolherMes(v); }} icon={G.calendar} options={opcoesMes} />
              <DateField value={dia} onChange={v => { setDia(v); if (v) setMes(v.slice(0, 7)); }} min={days[0]?.date} max={days[days.length - 1]?.date} />
              <SelectField value={situacao} onChange={setSituacao} options={SITUACOES} />
              <SelectField value={ordem} onChange={setOrdem} icon={G.list} options={[['desc', 'Mais recentes'], ['asc', 'Mais antigos']]} />
            </>}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {filtrosAtivos.map(f => (
                  <button key={f.k} onClick={f.clear} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 999, border: `1px solid ${alpha(T.blue, 0.3)}`, background: tone('brand').bg, color: tone('brand').color, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    {f.label}<Ico d={G.x} size={13} sw={2.2} />
                  </button>
                ))}
                {filtrosAtivos.length > 1 && (
                  <button onClick={limparFiltros} style={{ background: 'none', border: 'none', color: T.textS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-body)' }}>Limpar filtros</button>
                )}
              </div>
              <div style={{ fontSize: 13, color: T.textS }}>
                <strong style={{ color: T.text }}>{diasFiltrados.length}</strong> dia{diasFiltrados.length !== 1 ? 's' : ''} · saldo{' '}
                <strong style={{ color: saldoFiltrado < 0 ? tone('neg').color : saldoFiltrado > 0 ? tone('pos').color : T.text }}>{fmtSaldo(saldoFiltrado)}</strong>
              </div>
            </div>

            {days.length === 0 ? (
              <Empty icon={G.finger} title="Nenhuma marcação encontrada para o seu CPF/nome."
                hint="Confira se o RH subiu o AFD e se seu CPF no perfil bate com o do ponto." />
            ) : diasFiltrados.length === 0 ? (
              <Empty icon={G.search} title="Nenhum dia com esses filtros."
                hint={<button onClick={limparFiltros} style={{ marginTop: 6, background: 'none', border: 'none', color: tone('brand').color, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5 }}>Limpar filtros</button>} />
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {diasFiltrados.slice(0, limite).map(d => (
                    <DiaRow key={d.date} d={d} isMobile={isMobile} open={aberto === d.date}
                      onToggle={() => setAberto(a => (a === d.date ? null : d.date))}
                      justifs={justifPorDia[d.date] || []} solics={solicPorDia[d.date] || []}
                      pendente={temPendente(d.date)} onSolicitar={() => openModal(d.date)} />
                  ))}
                </div>
                {diasFiltrados.length > limite && (
                  <div style={{ textAlign: 'center', marginTop: 18 }}>
                    <button onClick={() => setPagina({ sig: recorte, n: limite + POR_PAGINA })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, border: `1px solid ${T.border}`, background: T.surfaceSub, color: T.text, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      Mostrar mais {Math.min(POR_PAGINA, diasFiltrados.length - limite)} dias
                      <span style={{ color: T.textT, fontWeight: 500 }}>({diasFiltrados.length - limite} restantes)</span>
                      <Ico d={G.chevD} size={16} sw={2} />
                    </button>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* ── JUSTIFICATIVAS ── */}
          <SectionCard isMobile={isMobile} bodyRef={justRef} icon={G.shield} title="Justificativas"
            subtitle={solPendentes > 0 ? `Suas solicitações e os abonos do RH · ${solPendentes} em análise` : 'Suas solicitações e os abonos registrados pelo RH.'}
            barCols="minmax(0,1.6fr) repeat(2,minmax(0,1fr))"
            bar={<>
              <SearchField value={jBusca} onChange={setJBusca} placeholder="Buscar título, motivo, anexo..." />
              <SelectField value={jTipo} onChange={setJTipo} options={TIPOS_JUST} />
              <SelectField value={jMes} onChange={setJMes} icon={G.calendar} options={[['todos', 'Todos os meses'], ...mesesJust.map(ym => [ym, cap(mesLongo(ym))])]} />
            </>}>
            {itensJust.length === 0 ? (
              <Empty icon={G.shield} title="Nenhuma justificativa por aqui ainda."
                hint="Quando um dia ficar negativo, abra ele na lista acima e toque em “Solicitar justificativa”." />
            ) : justFiltradas.length === 0 ? (
              <Empty icon={G.search} title="Nenhuma justificativa com esses filtros." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {justFiltradas.map(it => (
                  <JustRow key={it.key} it={it} isMobile={isMobile} dia={it.data ? days.find(d => d.date === it.data) : null}
                    open={jAberto === it.key} onToggle={() => setJAberto(a => (a === it.key ? null : it.key))}
                    onVerDia={it.data ? () => irParaDia(it.data) : null} />
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* ── MODAL: solicitar justificativa ── */}
      {modal && (
        <div onClick={() => !saving && setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface || 'white', borderRadius: 20, padding: isMobile ? 18 : 28, width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>Solicitar justificativa</div>
            <div style={{ fontSize: 12.5, color: T.textS, marginBottom: 18 }}>Explique por que precisa justificar e anexe um comprovante. O RH vai analisar.</div>

            {modalDia && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: T.surfaceSub, border: `1px solid ${T.border}`, marginBottom: 14 }}>
                <Ico d={G.calendar} size={18} stroke={T.textS} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{tituloDia(modalDia.date)}</div>
                  <div style={{ fontSize: 11.5, color: T.textT }}>{modalDia.times.length ? modalDia.times.join(' · ') : 'Nenhuma marcação'}</div>
                </div>
                <Pill t={modalDia.balance < 0 ? tone('neg') : tone('muted')} size="sm">{fmtSaldo(modalDia.balance)}</Pill>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Título *</div>
              <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Atestado médico, consulta..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Dia que está justificando</div>
              <input type="date" value={form.data_ref} onChange={e => setForm(p => ({ ...p, data_ref: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', colorScheme: T.dark ? 'dark' : 'light' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Descrição</div>
              <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descreva o motivo..."
                style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface || 'white', fontSize: 13, color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 4 }}>Anexo (atestado, comprovante...)</div>
              <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: file ? T.text : T.textT, fontFamily: 'var(--font-body)' }}>
                <Ico d={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>} size={15} stroke={T.textS} />
                {file ? file.name : 'Escolher arquivo'}
              </button>
            </div>

            {msg && <div style={{ fontSize: 12, color: '#C04050', marginBottom: 10, padding: '7px 12px', borderRadius: 7, background: 'rgba(192,64,80,0.06)' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(false)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: T.textS, fontFamily: 'var(--font-body)' }}>Cancelar</button>
              <button onClick={submitSolic} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer', background: `linear-gradient(135deg,${T.blue},${T.blueL})`, color: 'white', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)' }}>
                {saving ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Mini-gráfico de barras: saldo de cada dia (acima = positivo, abaixo = negativo) ──
const MiniBarras = ({ serie, w = 190, h = 38 }) => {
  if (!serie.length) return <div style={{ height: h }} />;
  const n = serie.length, bw = w / n, mid = h / 2;
  const cap = Math.min(240, Math.max(45, ...serie.map(d => Math.abs(d.balance))));
  const pos = tone('pos').color, neg = tone('neg').color, inf = tone('info').color;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <line x1="0" y1={mid} x2={w} y2={mid} stroke={T.border} strokeWidth="1" />
      {serie.map((d, i) => {
        const abon = d.abonado && (d.rawBalance < 0 || d.falta);
        const v = abon ? 30 : d.balance;
        if (!v) return null;
        const bh = Math.max(2, Math.min(Math.abs(v), cap) / cap * (mid - 2));
        return <rect key={d.date} x={i * bw + bw * 0.18} width={Math.max(1, bw * 0.64)} rx={Math.min(1.5, bw * 0.3)}
          y={v > 0 ? mid - bh : mid} height={bh} fill={abon ? inf : v > 0 ? pos : neg} opacity={abon ? 0.8 : 0.9} />;
      })}
    </svg>
  );
};

const MesCard = ({ isMobile, ym, todos, selected, onClick, saldo, dias, faltas, serie, delta }) => {
  const sT = saldo < 0 ? tone('neg') : saldo > 0 ? tone('pos') : tone('muted');
  const [y, m] = ym ? ym.split('-') : ['', ''];
  return (
    <button className="mp-mcard" onClick={onClick} aria-pressed={selected} style={{
      flex: `0 0 ${isMobile ? 200 : 228}px`, scrollSnapAlign: 'start', textAlign: 'left', cursor: 'pointer',
      padding: '16px 18px 14px', borderRadius: 16, fontFamily: 'var(--font-body)', boxSizing: 'border-box',
      border: `1.5px solid ${selected ? alpha(T.blueL, 0.85) : T.border}`,
      background: selected ? `linear-gradient(160deg, ${alpha(T.blue, T.dark ? 0.26 : 0.12)}, ${alpha(T.blueL, 0.04)})` : T.surfaceSub,
      boxShadow: selected ? `0 8px 22px ${alpha(T.blue, 0.2)}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{todos ? 'Todo o período' : cap(MESES[+m - 1])}</span>
        <span style={{ fontSize: 12, color: T.textT, fontWeight: 600 }}>{todos ? 'geral' : y}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: sT.color, letterSpacing: '-.02em', margin: '4px 0 8px' }}>{fmtSaldo(saldo)}</div>
      <MiniBarras serie={serie} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, fontSize: 11.5, color: T.textS }}>
        <span>{dias} dia{dias !== 1 ? 's' : ''}{faltas ? ` · ${faltas} falta${faltas !== 1 ? 's' : ''}` : ''}</span>
        {delta != null && delta !== 0 && (
          <span title="Comparado ao mês anterior" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: delta > 0 ? tone('pos').color : tone('neg').color }}>
            <Ico d={delta > 0 ? G.arrowUp : G.arrowDown} size={11} sw={2.6} />{fmtMin(Math.abs(delta))}
          </span>
        )}
      </div>
    </button>
  );
};

const Kpi = ({ icon, label, value, note, color, children }) => (
  <div style={{ padding: '14px 16px', borderRadius: 14, background: T.surfaceSub, border: `1px solid ${T.border}`, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textS, fontWeight: 600 }}>
      <Ico d={icon} size={15} stroke={T.textS} />{label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || T.text, marginTop: 4, letterSpacing: '-.01em' }}>{value}</div>
    {note && <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>{note}</div>}
    {children}
  </div>
);

// ── Calendário do mês + resumo do período selecionado ──
const CalendarioResumo = ({ isMobile, meses, mesSel, dia, resumoDias, periodoLabel, onMes, onDia, temPendente }) => {
  const ymCal = mesSel !== 'todos' ? mesSel : meses[0].ym;
  const idx = meses.findIndex(m => m.ym === ymCal);
  const anterior = meses[idx + 1]?.ym, proximo = idx > 0 ? meses[idx - 1].ym : null;
  const info = meses[idx];
  const mapa = {}; for (const d of (info?.serie || [])) mapa[d.date] = d;
  const [y, m] = ymCal.split('-').map(Number);
  const nDias = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // segunda = 0
  const hoje = todayISO();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: nDias }, (_, i) => `${ymCal}-${String(i + 1).padStart(2, '0')}`)];

  // resumo
  const R = resumoDias;
  const saldo = R.reduce((a, d) => a + d.balance, 0);
  const trab = R.reduce((a, d) => a + d.totalMin, 0);
  const prev = R.reduce((a, d) => a + d.expected, 0);
  const cont = { positivo: 0, ok: 0, negativo: 0, falta: 0, abonado: 0, outros: 0 };
  for (const d of R) {
    const k = situacaoDia(d, false).key;
    if (k in cont) cont[k]++; else cont.outros++;
  }
  const uteisComPonto = R.filter(d => !d.wknd && d.times.length >= 2);
  const media = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const entMed = media(uteisComPonto.map(d => toMin(d.times[0])));
  const saiMed = media(uteisComPonto.map(d => toMin(d.times[d.times.length - 1])));
  const pct = prev > 0 ? Math.min(100, Math.round(trab / prev * 100)) : 0;
  const totalCont = Object.values(cont).reduce((a, b) => a + b, 0) || 1;
  const DIST = [
    ['positivo', 'Positivos', tone('pos').color], ['ok', 'No horário', T.textT], ['negativo', 'Negativos', tone('neg').color],
    ['falta', 'Faltas', mix(tone('neg').color, '#000000', 0.25)], ['abonado', 'Abonados', tone('info').color], ['outros', 'Outros', tone('warn').color],
  ];

  const navBtn = (alvo, icon, label) => (
    <button onClick={() => alvo && onMes(alvo)} disabled={!alvo} title={label} style={{
      width: 44, height: 44, borderRadius: 12, border: `1px solid ${T.border}`, background: T.surfaceInput || T.surfaceSub,
      color: alvo ? T.text : T.textD, cursor: alvo ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}><Ico d={icon} size={18} sw={2} /></button>
  );

  return (
    <SectionCard isMobile={isMobile} icon={G.grid} title={`Calendário · ${cap(mesLongo(ymCal))}`}
      subtitle="Toque em um dia para abrir as batidas dele."
      tools={<div style={{ display: 'flex', gap: 8 }}>
        {navBtn(anterior, G.chevL, 'Mês anterior')}
        {navBtn(proximo, G.chevR, 'Próximo mês')}
      </div>}>
      <div className="mp-cal-grid">
        {/* calendário */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: isMobile ? 4 : 8, marginBottom: 6 }}>
            {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(s => (
              <div key={s} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: isMobile ? 4 : 8 }}>
            {cells.map((iso, i) => {
              if (!iso) return <div key={'v' + i} />;
              const d = mapa[iso];
              const s = d ? situacaoDia(d, temPendente(iso)) : null;
              const sel = dia === iso;
              const dNum = +iso.slice(8);
              return (
                <button key={iso} className={d ? 'mp-cell' : undefined} onClick={() => d && onDia(iso)} disabled={!d}
                  title={d ? `${tituloDia(iso)} · ${s.label} · ${fmtSaldo(d.balance)}` : fmtData(iso)}
                  style={{
                    position: 'relative', height: isMobile ? 46 : 62, borderRadius: isMobile ? 9 : 12, padding: isMobile ? '4px' : '6px 8px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: isMobile ? 'center' : 'flex-start',
                    border: `1.5px solid ${sel ? T.blueL : iso === hoje ? alpha(T.blue, 0.5) : 'transparent'}`,
                    background: d ? s.t.bg : 'transparent', cursor: d ? 'pointer' : 'default', fontFamily: 'var(--font-body)',
                    boxShadow: sel ? `0 0 0 3px ${alpha(T.blueL, 0.25)}` : 'none',
                  }}>
                  <span style={{ fontSize: isMobile ? 12 : 13.5, fontWeight: 700, color: d ? T.text : T.textD }}>{dNum}</span>
                  {d && (isMobile
                    ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.t.color }} />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: s.t.color, whiteSpace: 'nowrap' }}>
                        {s.key === 'abonado' ? 'abon.' : s.key === 'falta' ? 'falta' : fmtSaldo(d.balance)}
                      </span>)}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 14, fontSize: 11.5, color: T.textS }}>
            {[['Positivo', tone('pos')], ['Negativo/falta', tone('neg')], ['Em análise/incompleto', tone('warn')], ['Abonado', tone('info')], ['Fim de semana', tone('brand')]].map(([l, t]) => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* resumo */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Resumo</div>
            <div style={{ fontSize: 12.5, color: T.textS, textAlign: 'right' }}>{periodoLabel}</div>
          </div>
          <div className="mp-kpis">
            <Kpi icon={G.clock} label="Saldo" value={fmtSaldo(saldo)} color={saldo < 0 ? tone('neg').color : saldo > 0 ? tone('pos').color : T.text}
              note={`${R.length} dia${R.length !== 1 ? 's' : ''} no período`} />
            <Kpi icon={G.building} label="Trabalhadas" value={fmtMin(trab)} note={`de ${fmtMin(prev)} previstas`}>
              <div style={{ height: 6, borderRadius: 99, background: T.border, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${T.blue}, ${T.blueL})` }} />
              </div>
            </Kpi>
            <Kpi icon={G.logIn} label="Entrada média" value={entMed != null ? minToHH(entMed) : '—'} note="dias úteis com ponto" />
            <Kpi icon={G.logOut} label="Saída média" value={saiMed != null ? minToHH(saiMed) : '—'} note={`jornada de ${fmtMin(PONTO_DEFAULTS.jornada)}`} />
          </div>

          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: T.surfaceSub, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.textS, fontWeight: 600, marginBottom: 10 }}>Como foram os dias</div>
            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: T.border }}>
              {DIST.map(([k, , c]) => cont[k] ? <div key={k} title={`${cont[k]}`} style={{ width: `${cont[k] / totalCont * 100}%`, background: c }} /> : null)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: '8px 12px', marginTop: 12 }}>
              {DIST.filter(([k]) => cont[k] || k !== 'outros').map(([k, l, c]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: T.textS }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: c, flexShrink: 0 }} />
                  {l}<strong style={{ marginLeft: 'auto', color: T.text }}>{cont[k]}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

// ── Linha do tempo do dia: blocos de trabalho entre as batidas ──
const LinhaDoTempo = ({ times }) => {
  const mins = times.map(toMin);
  const ini = Math.min(6 * 60, Math.floor(Math.min(...mins) / 60) * 60);
  const fim = Math.max(22 * 60, Math.ceil(Math.max(...mins) / 60) * 60);
  const span = fim - ini;
  const pos = v => `${(v - ini) / span * 100}%`;
  const passo = span > 18 * 60 ? 240 : 120;
  const ticks = []; for (let t = ini; t <= fim; t += passo) ticks.push(t);
  const pares = []; for (let i = 0; i + 1 < mins.length; i += 2) pares.push([mins[i], mins[i + 1]]);
  const sobra = mins.length % 2 === 1 ? mins[mins.length - 1] : null;
  return (
    <div style={{ position: 'relative', padding: '22px 0 20px' }}>
      <div style={{ position: 'relative', height: 12, borderRadius: 99, background: T.surfaceInput || T.border, border: `1px solid ${T.border}` }}>
        {pares.map(([a, b], i) => (
          <div key={i} title={`${minToHH(a)} → ${minToHH(b)}`} style={{ position: 'absolute', top: -1, bottom: -1, left: pos(a), width: `calc(${pos(b)} - ${pos(a)})`, borderRadius: 99, background: `linear-gradient(90deg, ${T.blue}, ${T.blueL})`, boxShadow: `0 2px 8px ${alpha(T.blue, 0.35)}` }} />
        ))}
        {mins.map((v, i) => (
          <div key={'l' + i} style={{ position: 'absolute', left: pos(v), top: i % 2 === 0 ? -21 : 'auto', bottom: i % 2 === 0 ? 'auto' : -21, transform: 'translateX(-50%)', fontSize: 10.5, fontWeight: 700, color: v === sobra ? tone('warn').color : T.text, whiteSpace: 'nowrap' }}>
            {minToHH(v)}
          </div>
        ))}
        {sobra != null && <div title="Batida sem par" style={{ position: 'absolute', left: pos(sobra), top: '50%', width: 12, height: 12, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: tone('warn').color, border: `2px solid ${T.surface}` }} />}
      </div>
      <div style={{ position: 'relative', height: 14, marginTop: 24 }}>
        {ticks.map(t => (
          <span key={t} style={{ position: 'absolute', left: pos(t), transform: 'translateX(-50%)', fontSize: 10, color: T.textT }}>{String(t / 60).padStart(2, '0')}h</span>
        ))}
      </div>
    </div>
  );
};

const InfoBox = ({ t, icon, title, children, action }) => (
  <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, background: t.bg, border: `1px solid ${alpha(t.color.startsWith('#') ? t.color : '#888888', 0.25)}` }}>
    <Ico d={icon} size={18} stroke={t.color} style={{ flexShrink: 0, marginTop: 1 }} />
    <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.textS, lineHeight: 1.55 }}>
      {title && <div style={{ fontWeight: 700, color: T.text, marginBottom: 2 }}>{title}</div>}
      {children}
    </div>
    {action}
  </div>
);

const Anexo = ({ url, name }) => (
  <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: tone('brand').color, textDecoration: 'none', maxWidth: '100%' }}>
    <Ico d={G.clip} size={14} />
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Ver anexo'}</span>
  </a>
);

// ── Linha de um dia ──
const DiaRow = ({ d, isMobile, open, onToggle, justifs, solics, pendente, onSolicitar }) => {
  const s = situacaoDia(d, pendente);
  const [, , dd] = d.date.split('-');
  const vermelho = s.key === 'falta' || s.key === 'negativo';
  const sT = d.balance < 0 ? tone('neg') : d.balance > 0 ? tone('pos') : tone('muted');

  const chips = d.times.map((h, i) => (
    <span key={i} style={{ fontSize: isMobile ? 11.5 : 12.5, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: i % 2 === 0 ? tone('pos').bg : tone('info').bg, color: i % 2 === 0 ? tone('pos').color : tone('info').color }}>{h}</span>
  ));

  const middle = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
      {s.key === 'abonado'
        ? <Pill t={tone('info')} icon={G.shield}>Abonado</Pill>
        : <Pill t={sT} icon={d.balance > 0 ? G.arrowUp : d.balance < 0 ? G.arrowDown : null}>{fmtSaldo(d.balance)}</Pill>}
      <span style={{ fontSize: 12.5, color: T.textT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {s.key === 'abonado' ? `era ${fmtSaldo(d.rawBalance)}` : d.times.length >= 2 ? `Entrada ${d.times[0]} · Saída ${d.times[d.times.length - 1]}` : d.falta ? 'Sem nenhuma batida' : d.times.length === 1 ? `Só 1 batida (${d.times[0]})` : ''}
      </span>
    </div>
  );

  return (
    <ListRow isMobile={isMobile} open={open} onToggle={onToggle} accent={s.key === 'ok' ? T.border : s.t.color}
      tile={<Tile isMobile={isMobile} gradient={vermelho ? RED_GRAD : null} shadow={vermelho ? '#C04050' : null}>
        <span style={{ fontSize: isMobile ? 19 : 26, fontWeight: 800, lineHeight: 1 }}>{dd}</span>
        <span style={{ fontSize: isMobile ? 9.5 : 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .9, marginTop: 3 }}>{SEM_CURTO[dow(d.date)]}</span>
      </Tile>}
      title={tituloDia(d.date)}
      meta={<>
        <MetaLine isMobile={isMobile} icon={G.clock}>
          {chips.length ? chips : <span>{d.falta ? 'Nenhuma marcação neste dia útil' : 'Sem marcações'}</span>}
        </MetaLine>
        <MetaLine isMobile={isMobile} icon={G.building}>
          <span>{fmtMin(d.totalMin)} trabalhadas</span><Dot />
          <span>{d.expected ? `jornada ${fmtMin(d.expected)}` : 'sem jornada prevista'}</span>
          {pendente && <Pill t={tone('warn')} size="sm">justificativa enviada</Pill>}
        </MetaLine>
      </>}
      middle={middle}
      status={<StatusPill t={s.t}>{s.label}</StatusPill>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {d.times.length > 0 && <LinhaDoTempo times={d.times} />}

        {d.times.length >= 2 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: Math.floor(d.times.length / 2) }, (_, i) => {
              const a = d.times[i * 2], b = d.times[i * 2 + 1];
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, background: T.surfaceInput || T.surfaceSub, border: `1px solid ${T.border}`, fontSize: 12.5, color: T.text }}>
                  <Ico d={G.logIn} size={14} stroke={tone('pos').color} />{a}
                  <span style={{ color: T.textT }}>→</span>
                  <Ico d={G.logOut} size={14} stroke={tone('info').color} />{b}
                  <strong style={{ color: T.textS, fontWeight: 600 }}>{fmtMin(toMin(b) - toMin(a))}</strong>
                </span>
              );
            })}
          </div>
        )}

        {d.times.length % 2 === 1 && (
          <InfoBox t={tone('warn')} icon={G.alert} title="Batida sem par">
            Tem uma marcação sem a entrada ou a saída correspondente — a última batida não entra no cálculo. Se esqueceu de bater, solicite a correção ao RH.
          </InfoBox>
        )}

        {justifs.map((j, i) => (
          <InfoBox key={i} t={j.abonado !== false ? tone('info') : tone('muted')} icon={G.shield}
            title={j.abonado !== false ? 'Justificado e abonado pelo RH' : 'Justificativa registrada (sem abono)'}>
            {j.texto}{j.autor && <span style={{ color: T.textT }}> — {j.autor}</span>}
            {j.file_url && <div style={{ marginTop: 4 }}><Anexo url={j.file_url} name={j.file_name} /></div>}
          </InfoBox>
        ))}

        {solics.map(sol => {
          const pend = (sol.status || 'pendente') === 'pendente';
          return (
            <InfoBox key={sol.id} t={pend ? tone('warn') : tone('pos')} icon={G.fileText}
              title={`${pend ? 'Solicitação em análise' : 'Solicitação resolvida'}: ${sol.titulo}`}>
              {sol.descricao || <span style={{ color: T.textT }}>Sem descrição.</span>}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                {sol.created_at && <span style={{ fontSize: 11.5, color: T.textT }}>Enviada em {fmtDataHora(sol.created_at)}</span>}
                {sol.file_url && <Anexo url={sol.file_url} name={sol.file_name} />}
              </div>
            </InfoBox>
          );
        })}

        {d.balance < 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, border: `1px dashed ${T.border}` }}>
            <span style={{ fontSize: 12.5, color: T.textS, lineHeight: 1.5 }}>
              {solics.length
                ? 'Você já enviou justificativa para este dia. Pode mandar outra se precisar complementar.'
                : <>Este dia está com <strong style={{ color: tone('neg').color }}>{fmtSaldo(d.balance)}</strong>. Envie um atestado ou comprovante para o RH avaliar o abono.</>}
            </span>
            <button onClick={onSolicitar} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: isMobile ? '100%' : 'auto',
              padding: '10px 18px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
              background: `linear-gradient(135deg, ${T.blue}, ${T.blueL})`, fontFamily: 'var(--font-body)', boxShadow: `0 6px 16px ${alpha(T.blue, 0.3)}`,
            }}>
              <Ico d={G.filePlus} size={16} stroke="#fff" />Solicitar justificativa
            </button>
          </div>
        )}

        {d.falta && !d.abonado && !solics.length && (
          <div style={{ fontSize: 11.5, color: T.textT }}>Dias justificados pelo RH são abonados e deixam de contar como negativos.</div>
        )}
      </div>
    </ListRow>
  );
};

// ── Linha de uma justificativa (solicitação do colaborador ou registro do RH) ──
const JustRow = ({ it, isMobile, dia, open, onToggle, onVerDia }) => {
  const sol = it.kind === 'sol';
  const s = it.s, j = it.j;
  const pend = sol && (s.status || 'pendente') === 'pendente';
  const abon = !sol && j.abonado !== false;
  const st = sol
    ? (pend ? { label: 'Em análise', t: tone('warn') } : { label: 'Resolvida', t: tone('pos') })
    : (abon ? { label: 'Abonado', t: tone('info') } : { label: 'Sem abono', t: tone('muted') });
  const file = sol ? s.file_url : j.file_url;
  const fileName = sol ? s.file_name : j.file_name;
  const texto = sol ? s.descricao : j.texto;

  return (
    <ListRow isMobile={isMobile} open={open} onToggle={onToggle} accent={st.t.color === T.textS ? T.border : st.t.color}
      tile={<Tile isMobile={isMobile}><Ico d={sol ? G.fileText : G.shield} size={isMobile ? 24 : 32} stroke="#fff" sw={2} /></Tile>}
      title={sol ? s.titulo : (abon ? 'Abono registrado pelo RH' : 'Justificativa registrada pelo RH')}
      meta={<>
        <MetaLine isMobile={isMobile} icon={G.calendar}>
          {it.data
            ? <><span>Dia {fmtData(it.data)}</span><Dot /><span>{SEM_LONGO[dow(it.data)]}</span></>
            : <span>Sem dia informado</span>}
        </MetaLine>
        <MetaLine isMobile={isMobile} icon={sol ? G.logOut : G.building}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sol ? (s.created_at ? `Enviada em ${fmtDataHora(s.created_at)}` : 'Enviada por você') : (j.autor ? `Por ${j.autor}` : 'Pelo RH')}
          </span>
          {file && <><Dot /><Ico d={G.clip} size={14} stroke={T.textS} /><span>anexo</span></>}
        </MetaLine>
      </>}
      middle={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0, maxWidth: '100%' }}>
          {dia
            ? <Pill t={dia.rawBalance < 0 ? tone('neg') : tone('muted')} icon={dia.rawBalance < 0 ? G.arrowDown : null} strike={dia.abonado}>{fmtSaldo(dia.rawBalance)}</Pill>
            : <Pill t={tone('muted')}>—</Pill>}
          <span style={{ fontSize: 12.5, color: T.textT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {dia ? (dia.abonado ? 'saldo do dia antes do abono' : 'saldo do dia no ponto') : 'dia fora do período do ponto'}
          </span>
        </div>
      }
      status={<StatusPill t={st.t}>{st.label}</StatusPill>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {texto || <span style={{ color: T.textT }}>Sem descrição.</span>}
        </div>
        {dia && (
          <div style={{ fontSize: 12.5, color: T.textS }}>
            Batidas do dia: {dia.times.length ? dia.times.join(' · ') : 'nenhuma marcação'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {file && <Anexo url={file} name={fileName} />}
          {sol && pend && <span style={{ fontSize: 12, color: T.textT }}>O RH ainda vai analisar esta solicitação.</span>}
          {onVerDia && dia && (
            <button onClick={onVerDia} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: `1px solid ${alpha(T.blue, 0.35)}`, background: tone('brand').bg, color: tone('brand').color, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Ver dia no ponto <Ico d={G.chevR} size={14} sw={2.2} />
            </button>
          )}
        </div>
      </div>
    </ListRow>
  );
};

export { TabMeuPonto };
