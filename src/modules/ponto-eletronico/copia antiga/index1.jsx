import React, { useState, useRef } from 'react';
import { T } from '../../contexts/theme';
import { StarDivider, Card, Tag, Moon, Logo } from '../../shared/components';
import { loadPonto, savePontoSnapshot, saveJustificativa, savePontoPresenca, savePontoNegativos } from './pontoDb';

/* ══════════════════════════════════════════════════════════════════
   PONTO ELETRÔNICO — Leitor de AFD (Portaria 671 / 1510)
══════════════════════════════════════════════════════════════════ */
const isWknd_p = d => { const w = new Date(d+'T12:00:00').getDay(); return w===0||w===6; };

// Cores fixas (não dependem do tema, sempre legíveis)
const ECOLS = ['#1E70B5','#5560C8','#0A9BB5','#C06090','#1A9C70','#B87010','#C04050','#2E8DD4'];

/* ════════════════════════════════════════
   EXTRAÇÃO — lê o texto bruto do AFD (Portaria 671 e 1510)
   Devolve só os dados crus: header, nomes, exclusões, marcações e
   a lista linha-a-linha. O cálculo do banco de horas fica em
   buildDashboard, que roda sobre as marcações ACUMULADAS do banco.
════════════════════════════════════════ */
const extractAFD = (raw) => {
  const lines = raw.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length >= 10);

  // Detecta formato pelo primeiro tipo 3 encontrado
  let fmt = '671';
  for (const line of lines) {
    if (line[9] === '3' && line.length >= 20) {
      fmt = line[14] === '-' ? '671' : '1510';
      break;
    }
  }

  let header = null;
  const nameMap  = {};           // cpf11 → name (do tipo 5)
  const excluded = new Set();    // CPFs excluídos (tipo 5 operação E)
  const marks    = [];           // todas as marcações tipo 3
  const rawRecs  = [];           // todos os registros para Linha a Linha

  for (const line of lines) {
    const tipo = line[9];
    const nsr  = line.substring(0, 9);

    /* ── Tipo 1: Cabeçalho ── */
    if (tipo === '1' && line.length > 50) {
      const cnpj  = line.substring(10, 24);
      const bloco = line.substring(36, 200);
      const nm    = bloco.match(/[A-Za-záéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ][A-Za-záéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ\s\.]{3,}/);
      const razao = nm ? nm[0].trim() : cnpj;
      const dts   = [...line.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]);
      const mdl   = line.match(/iD[\w\s\-]+|[A-Z]{2}[A-Za-z][\w\s]{4,18}(?=\s{3,})/);
      header = { cnpj, razao, inicio:dts[0]||'', fim:dts[1]||'', gerado:dts[2]||'', modelo:mdl?mdl[0].trim():'—', fmt };
    }

    /* ── Tipo 3: Marcação de Ponto ── */
    else if (tipo === '3') {
      let date='', time='', cpf='';
      if (fmt === '671' && line.length >= 46) {
        date = line.substring(10, 20);   // YYYY-MM-DD (pos 10-19)
        time = line.substring(21, 26);   // HH:MM (T em pos 20, hora em 21-25)
        const cpfRaw = line.substring(34, 46); // 12 chars: indicador + 11 CPF/PIS
        cpf  = cpfRaw.substring(1);            // 11 dígitos sem o indicador
      } else if (fmt === '1510' && line.length >= 34) {
        const rd = line.substring(10, 18);
        const rt = line.substring(18, 22);
        date = `${rd.slice(0,4)}-${rd.slice(4,6)}-${rd.slice(6,8)}`;
        time = `${rt.slice(0,2)}:${rt.slice(2,4)}`;
        const cpfRaw = line.substring(22, 34);
        cpf  = cpfRaw.substring(1);
      }
      if (date && time && cpf.length >= 10) {
        marks.push({ nsr, date, time, cpf });
        rawRecs.push({ nsr, date, time, cpf, label:'Marcação de Ponto', tipo:'3' });
      }
    }

    /* ── Tipo 4: Ajuste de relógio ── */
    else if (tipo === '4') {
      const date = fmt==='671' ? line.substring(10,20) : '';
      const time = fmt==='671' ? line.substring(21,26) : '';
      rawRecs.push({ nsr, date, time, cpf:'—', label:'Ajuste de Data/Hora', tipo:'4' });
    }

    /* ── Tipo 5: Empregado ── */
    else if (tipo === '5') {
      let op='', cpf='', nome='', date='', time='';
      if (fmt === '671' && line.length >= 47) {
        date = line.substring(10, 20);
        time = line.substring(21, 26);
        op   = line[34];                               // I, A ou E em pos 34
        const cpfRaw = line.substring(35, 47);        // 12 chars com indicador
        cpf  = cpfRaw.substring(1);                   // 11 dígitos
        nome = line.length > 47 ? line.substring(47, Math.min(line.length-4, 99)).trim() : '';
      } else if (fmt === '1510' && line.length >= 37) {
        const rd = line.substring(10, 18), rt = line.substring(18, 22);
        date = `${rd.slice(0,4)}-${rd.slice(4,6)}-${rd.slice(6,8)}`;
        time = `${rt.slice(0,2)}:${rt.slice(2,4)}`;
        op   = line[24];
        const cpfRaw = line.substring(25, 37);
        cpf  = cpfRaw.substring(1);
        nome = line.length > 37 ? line.substring(37, Math.min(line.length-4, 89)).trim() : '';
      }
      if (cpf && nome && op !== 'E') nameMap[cpf] = nome;
      if (cpf && op === 'E')         excluded.add(cpf);
      const opLabel = op==='I' ? 'Inclusão' : op==='A' ? 'Alteração' : op==='E' ? 'Exclusão' : op;
      rawRecs.push({ nsr, date, time, cpf, label:`${opLabel} de Cadastro${nome?' — '+nome:''}`, tipo:'5' });
    }

    /* ── Tipo 2/6/outros ── */
    else if (tipo === '2' || tipo === '6') {
      const date = line.length >= 35 ? line.substring(10,20) : '';
      const time = line.length >= 35 ? line.substring(21,26) : '';
      rawRecs.push({ nsr, date, time, cpf:'—', label: tipo==='2'?'Edição do Empregador':'Evento do Sistema', tipo });
    }
  }

  // Validação de NSR — detecta gaps na sequência (indício de adulteração).
  // Só faz sentido por arquivo: combinar NSR de vários AFDs geraria gaps falsos.
  const nsrList = rawRecs.map(r => parseInt(r.nsr, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
  const nsrGaps = [];
  for (let i=1;i<nsrList.length;i++) {
    if (nsrList[i] - nsrList[i-1] > 1) nsrGaps.push({from:nsrList[i-1], to:nsrList[i], gap:nsrList[i]-nsrList[i-1]-1});
  }

  return { header, nameMap, excluded, marks, rawRecs, nsrGaps };
};

/* ════════════════════════════════════════
   CÁLCULO — monta o dashboard a partir das marcações acumuladas.
   Recebe { marks, nameMap, excluded, header } + config de jornada.
════════════════════════════════════════ */
const buildDashboard = ({ marks, nameMap = {}, excluded = new Set(), header = null }, cfg = {}) => {
  const tolerance        = cfg.tolerance ?? 1;
  const jornada          = cfg.jornada ?? 480;
  const toleranciaAtraso = cfg.toleranciaAtraso ?? 10;
  const justifs          = cfg.justifs ?? {};   // dia justificado (abonado) → saldo zerado

  /* ── Construir mapa de funcionários ── */
  const empMap = {};
  for (const m of marks) {
    if (!empMap[m.cpf]) empMap[m.cpf] = { cpf:m.cpf, marks:[] };
    empMap[m.cpf].marks.push(m);
  }
  for (const [cpf, name] of Object.entries(nameMap)) {
    if (!empMap[cpf]) empMap[cpf] = { cpf, marks:[] };
    empMap[cpf].name = name;
  }

  const employees = Object.values(empMap)
    .filter(e => e.marks.length > 0)
    .sort((a,b) => (a.name||a.cpf).localeCompare(b.name||b.cpf))
    .map((emp, ei) => {
      const name  = emp.name || nameMap[emp.cpf] || '';
      const color = ECOLS[ei % ECOLS.length];
      const byDay = {};
      for (const m of emp.marks) {
        if (!byDay[m.date]) byDay[m.date] = [];
        byDay[m.date].push(m.time);
      }
      const days = Object.entries(byDay).sort(([a],[b])=>a<b?-1:1).map(([date, rawTimes])=>{
        const times = [...rawTimes].sort();
        const pairs=[], issues=[];
        let totalMin=0;
        for (let i=0; i<times.length; i+=2) {
          if (i+1 < times.length) {
            const [eh,em]=times[i].split(':').map(Number);
            const [xh,xm]=times[i+1].split(':').map(Number);
            const diff=(xh*60+xm)-(eh*60+em);
            if (diff<=0)    issues.push(`Marcação duplicada: ${times[i]}`);
            else if(diff<tolerance) issues.push(`Marcação gêmea (${diff}min): ${times[i]} ↔ ${times[i+1]} — auto-ignorada`);
            totalMin += (diff > 0 && diff < tolerance) ? 0 : Math.max(0,diff);
            pairs.push({entry:times[i],exit:times[i+1],min:diff,twin:diff>0&&diff<tolerance});
          } else {
            pairs.push({entry:times[i],exit:null,min:0});
            issues.push(`Marcação sem par às ${times[i]}`);
          }
        }
        if (times.length%2!==0 && !issues.some(x=>x.includes('sem par'))) issues.push('Número ímpar de marcações');
        const wknd      = isWknd_p(date);
        const expected  = wknd ? 0 : jornada;
        const rawBalance = totalMin - expected;
        // Dia JUSTIFICADO (abonado pelo admin) → zera o saldo (tira horas + ou -).
        const jv        = justifs[`${emp.cpf}_${date}`];
        const abonado   = !!(jv && jv.abonado && (jv.text || jv.texto));
        const balance   = abonado ? 0
          : (!wknd && rawBalance < 0 && Math.abs(rawBalance) <= toleranciaAtraso) ? 0
          : rawBalance;
        return { date, times, pairs, totalMin, expected, balance, issues, wknd, abonado };
      });
      let cumBal=0;
      const daysWithCum = days.map(d=>{ cumBal+=d.balance; return {...d,cumBal}; });
      const totMin    = days.reduce((s,d)=>s+d.totalMin,0);
      const totBal    = days.reduce((s,d)=>s+d.balance,0);
      const totIssues = days.reduce((s,d)=>s+d.issues.length,0);
      const sortedDates = emp.marks.map(m=>m.date).sort();
      return { cpf:emp.cpf, name, color, marks:emp.marks, days:daysWithCum, totMin, totBal, totIssues, firstMark:sortedDates[0], lastMark:sortedDates[sortedDates.length-1], excluded:excluded.has(emp.cpf) };
    });

  const excludedEmployees = [...excluded]
    .filter(cpf => !employees.find(e=>e.cpf===cpf))
    .map(cpf => ({ cpf, name:nameMap[cpf]||'', excluded:true }));

  const totalMarks  = employees.reduce((s,e)=>s+e.marks.length,0);
  const totalIssues = employees.reduce((s,e)=>s+e.totIssues,0);
  const allDates    = [...new Set(employees.flatMap(e=>e.days.map(d=>d.date)))].sort();
  const calDates    = [...new Set(marks.map(m=>m.date.substring(0,7)))].sort(); // YYYY-MM

  // Dados do calendário — enriquecidos com status por dia
  const calData = {};
  for (const emp of employees) {
    for (const day of emp.days) {
      if (!calData[day.date]) calData[day.date] = { count:0, hasOdd:false, hasTwins:false };
      calData[day.date].count += day.times.length;
      if (day.issues.some(x => x.includes('ímpar') || x.includes('sem par'))) calData[day.date].hasOdd = true;
      if (day.issues.some(x => x.includes('gêmeas') || x.includes('duplicada'))) calData[day.date].hasTwins = true;
    }
  }

  // Linha a Linha reconstruída das marcações acumuladas (tipo 3)
  const rawRecs = marks.slice()
    .sort((a,b)=> a.date===b.date ? (a.time<b.time?-1:1) : (a.date<b.date?-1:1))
    .map(m=>({ nsr:m.nsr||'', date:m.date, time:m.time, cpf:m.cpf, label:'Marcação de Ponto', tipo:'3' }));

  // Período acumulado (preenche header se não veio do arquivo)
  let hdr = header;
  if (hdr && allDates.length) hdr = { ...hdr, inicio: hdr.inicio || allDates[0], fim: hdr.fim || allDates[allDates.length-1] };

  return { header: hdr, employees, excludedEmployees, totalMarks, totalIssues, allDates, rawRecs, calDates, calData, nameMap };
};

const PontoEletronico = ({onBack, isAdmin=false}) => {
  const [rawData, setRawData] = useState(null);    // {marks, nameMap, excluded, header} acumulado do banco
  const [drag,   setDrag]   = useState(false);
  const [load,   setLoad]   = useState(false);     // processando arquivo
  const [dbLoading, setDbLoading] = useState(true);// carregando do banco ao abrir
  const [syncing,   setSyncing]   = useState(false);// gravando AFD no banco
  const [uploadReport, setUploadReport] = useState(null); // {nsrGaps, total, fileName} do último upload
  const [tab,    setTab]    = useState('usuarios');
  const [selEmp, setSelEmp] = useState(null);   // banco de horas
  const [calIdx, setCalIdx] = useState(0);       // calendar month index
  const [err,       setErr]       = useState('');
  const [tolerance,       setTolerance]       = useState(1);   // minutos — ignora marcações gêmeas abaixo desse limite
  const [jornada,         setJornada]         = useState(480); // minutos — 480 = 8h padrão
  const [toleranciaAtraso,setToleraciaAtraso] = useState(10);  // minutos — atraso dentro desse limite não gera horas negativas
  const [lineSearch,setLineSearch]= useState('');   // busca na Linha a Linha
  const [lineType,  setLineType]  = useState('all');// filtro de tipo na Linha a Linha
  const [lineDate,  setLineDate]  = useState('3dias'); // filtro de data na Linha a Linha
  const [lineStart, setLineStart] = useState('');   // período customizado — início (YYYY-MM-DD)
  const [lineEnd,   setLineEnd]   = useState('');   // período customizado — fim (YYYY-MM-DD)
  const [showConf,  setShowConf]  = useState(false);// painel de configurações
  // Feature 1: Calendar day click
  const [calSelDay, setCalSelDay] = useState(null);
  // Feature 2: Justifications
  const [justifs,   setJustifs]   = useState({});   // key: `${cpf}_${date}` → {text, abonado}
  const [editJust,  setEditJust]  = useState(null);  // {cpf, date} being edited
  const [editText,  setEditText]  = useState('');
  // Feature 3: Banco de Horas filters
  const [bancoFilter,   setBancoFilter]   = useState('todos'); // hoje|ontem|3dias|7dias|30dias|todos|custom
  const [bancoStart,    setBancoStart]    = useState(''); // período customizado — início (YYYY-MM-DD)
  const [bancoEnd,      setBancoEnd]      = useState(''); // período customizado — fim (YYYY-MM-DD)
  const [bancoEmpMode,  setBancoEmpMode]  = useState('all'); // single|all
  const [bancoSearch,   setBancoSearch]   = useState('');       // Fix 1: separate search text
  const [bancoShowFilter,setBancoShowFilter]=useState('all');   // Fix 4: all|negative|justified
  const [calPage,       setCalPage]       = useState(0);        // calendar detail pagination
  const [pageLinha,     setPageLinha]     = useState(0);
  const [pageIssues,    setPageIssues]    = useState(0);
  const [pageBancoAll,  setPageBancoAll]  = useState(0);
  const [pageBancoDays, setPageBancoDays] = useState(0);
  const [calDaySort,    setCalDaySort]    = useState('az');     // az|ok|negative|positive
  const [userSearch,    setUserSearch]    = useState('');       // F1: users tab search
  const [calSearch,     setCalSearch]     = useState('');       // F3: calendar employee search
  const [calFilterEmps, setCalFilterEmps] = useState([]);       // F3: selected CPFs in calendar

  /* ── afd: dashboard recalculado das marcações ACUMULADAS do banco ── */
  const afd = React.useMemo(
    () => rawData ? buildDashboard(rawData, { tolerance, jornada, toleranciaAtraso, justifs }) : null,
    [rawData, tolerance, jornada, toleranciaAtraso, justifs]
  );

  /* Persiste o resumo de presença por funcionário/mês (alimenta a missão "Presença Impecável") */
  React.useEffect(() => {
    if (!afd?.employees?.length) return;
    const t = setTimeout(() => {
      savePontoPresenca(afd.employees).catch(() => {});
      savePontoNegativos(afd.employees).catch(() => {}); // dias negativos pro colaborador
    }, 1200);
    return () => clearTimeout(t);
  }, [afd]);

  /* ── Carrega tudo do banco ao abrir o módulo ── */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await loadPonto();
        if (!alive) return;
        setJustifs(d.justifs);
        if (d.hasData) setRawData({ marks:d.marks, nameMap:d.nameMap, excluded:d.excluded, header:d.header });
      } catch (ex) {
        console.error('Ponto load error:', ex);
        if (alive) setErr('Erro ao carregar dados do banco: ' + ex.message);
      } finally {
        if (alive) setDbLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ── Processar arquivo AFD: extrai, grava no banco (acumula+dedup) e recarrega ── */
  const processFile = (file) => {
    if (!file) return;
    const n = file.name.toLowerCase();
    if (!n.endsWith('.txt') && !n.endsWith('.afd')) { setErr('Formato inválido. Use .txt ou .afd do relógio de ponto.'); return; }
    setErr(''); setLoad(true); setSyncing(true);
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const ext = extractAFD(e.target.result);
        if (!ext.marks.length) { setErr('Nenhuma marcação encontrada. Verifique se é um AFD válido (Portaria 671 ou 1510).'); setLoad(false); setSyncing(false); return; }
        await savePontoSnapshot(ext);
        const d = await loadPonto();
        setJustifs(d.justifs);
        setRawData({ marks:d.marks, nameMap:d.nameMap, excluded:d.excluded, header: ext.header || d.header });
        setUploadReport({ nsrGaps: ext.nsrGaps, total: ext.marks.length, fileName: file.name });
        setTab('usuarios');
        setSelEmp(null);
        setCalIdx(0);
      } catch(ex) { console.error('AFD error:', ex); setErr('Erro ao processar/salvar o arquivo: '+ex.message); }
      setLoad(false); setSyncing(false);
    };
    reader.onerror = () => { setErr('Erro ao ler o arquivo.'); setLoad(false); setSyncing(false); };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const onDrop  = e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]); };
  const onDragO = e => { e.preventDefault(); setDrag(true); };

  /* ── Formatadores ── */
  const fmtMin  = m => { const a=Math.abs(m),h=Math.floor(a/60),mm=a%60; return `${m<0?'-':''}${h}h${mm.toString().padStart(2,'0')}`; };
  const fmtDate = d => { if(!d)return'—'; const[y,mo,dd]=d.split('-'); return `${dd}/${mo}/${y}`; };
  const fmtCPF  = c => c?c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):c;
  const fmtCNPJ = c => c?`${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`:'—';
  const initials = n => { const p=(n||'').trim().split(' ').filter(Boolean); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():(p[0]?.[0]||'?').toUpperCase(); };
  const diaSem  = d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(d+'T12:00:00').getDay()];
  const displayName = (emp) => emp.name || `PIS/CPF: ${emp.cpf}`;
  const tabSt = t => ({ padding:'8px 18px',borderRadius:9,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:tab===t?600:400,background:tab===t?T.goldGl:'transparent',color:tab===t?T.gold:T.textS,border:`1px solid ${tab===t?T.goldLine+'44':'transparent'}`,transition:'all .15s',whiteSpace:'nowrap' });

  /* ── Detecção de modo escuro e fundos adaptativos ── */
  const isDark = !!T.page; // temas escuros definem T.page; temas claros não
  const cardBg   = isDark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.85)');
  const headerBg = isDark ? `${T.surface}ee` : (T.surfaceW||'rgba(255,255,255,0.80)');
  const tabsBg   = isDark ? `${T.surface}cc` : (T.surfaceW||'rgba(255,255,255,0.70)');

  const displayRazao = (r) => {
    if (!r) return 'EMPRESA';
    const u = r.toUpperCase();
    if (u.includes('SERV')&&(u.includes('GESTAO')||u.includes('GESTÃO'))&&u.includes('BENEFICIO')) return '7SERV GESTÃO BENEFÍCIOS';
    return u;
  };
  /* ── Filtro de data da aba "Linha a Linha" (presets + período customizado) ── */
  const matchLineDate = (rDate) => {
    if (!rDate) return true; // registros sem data (ex.: tipo 4) sempre passam
    if (lineDate === 'custom') {
      if (lineStart && rDate < new Date(lineStart+'T00:00:00')) return false;
      if (lineEnd   && rDate > new Date(lineEnd+'T23:59:59'))   return false;
      return true;
    }
    if (lineDate === 'todos') return true;
    const today = new Date(); today.setHours(0,0,0,0);
    const daysAgo = (d) => { const x = new Date(today); x.setDate(x.getDate()-d); return x; };
    if (lineDate === 'hoje')   return rDate >= today;
    if (lineDate === '3dias')  return rDate >= daysAgo(2);
    if (lineDate === '7dias')  return rDate >= daysAgo(6);
    return rDate >= daysAgo(29); // 30dias
  };

  // Reseta páginas quando filtros mudam
  React.useEffect(()=>{ setPageLinha(0); },    [lineSearch, lineDate, lineType, lineStart, lineEnd]);
  React.useEffect(()=>{ setPageBancoDays(0); },[bancoFilter, bancoShowFilter, selEmp, bancoStart, bancoEnd]);
  React.useEffect(()=>{ setPageBancoAll(0); }, [bancoFilter, bancoStart, bancoEnd]);
  React.useEffect(()=>{ setPageIssues(0); },   []);

  /* ── PDF: Comprovante Banco de Horas (filtrado) ── */
  const printBancoFiltrado = (emp, days) => {
    const rows = days.map(day => {
      const jv = justifs[`${emp.cpf}_${day.date}`];
      return `<tr style="border-bottom:1px solid #eee;background:${day.balance<0?'#fff5f5':day.wknd?'#f9f9f9':'white'}">
        <td style="padding:7px 10px">${fmtDate(day.date)}</td><td style="padding:7px 10px;color:#666">${diaSem(day.date)}</td>
        <td style="padding:7px 10px">${day.times.map((t,i)=>`<span style="padding:1px 6px;border-radius:3px;font-size:11px;background:${i%2===0?'#e8f5e9':'#e3f2fd'};color:${i%2===0?'#1A9C70':'#1E70B5'};font-weight:600">${t}</span>`).join(' ')||'—'}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700">${fmtMin(day.totalMin)}</td>
        <td style="padding:7px 10px;text-align:right;color:#666">${day.wknd?'Folga':fmtMin(day.expected)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${day.balance>=0?'#1A9C70':'#C04050'}">${day.balance>=0?'+':''}${fmtMin(day.balance)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${day.cumBal>=0?'#1A9C70':'#C04050'}">${day.cumBal>=0?'+':''}${fmtMin(day.cumBal)}</td>
        <td style="padding:7px 10px;font-size:11px;color:#996600;max-width:160px">${jv?.text||'—'}</td>
      </tr>`;
    }).join('');
    const totMin=days.reduce((s,d)=>s+d.totalMin,0), totBal=days.reduce((s,d)=>s+d.balance,0);
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Banco de Horas — ${emp.name||emp.cpf}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
      h1{font-size:17px;margin-bottom:3px}h2{font-size:13px;font-weight:normal;color:#555;margin-bottom:14px}
      .meta{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:16px;padding:10px 14px;background:#f5f9ff;border-radius:6px;border:1px solid #d0e0f0}
      .meta div{display:flex;flex-direction:column;gap:2px}.meta span{font-size:10px;color:#888;text-transform:uppercase}.meta strong{font-size:13px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}thead tr{background:#1A9C70;color:white}
      thead th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700}
      .tr{background:#f5f9f5;font-weight:700;border-top:2px solid #1A9C70}
      @media print{body{padding:10px}}</style></head><body>
      <h1>Comprovante Banco de Horas</h1>
      <h2>${displayRazao(afd?.header?.razao)} — CNPJ: ${fmtCNPJ(afd?.header?.cnpj)}</h2>
      <div class="meta">
        <div><span>Funcionário</span><strong>${emp.name||'—'}</strong></div>
        <div><span>PIS/CPF</span><strong>${emp.cpf}</strong></div>
        <div><span>Período</span><strong>${days.length>0?fmtDate(days[0].date)+' a '+fmtDate(days[days.length-1].date):'—'}</strong></div>
        <div><span>Total período</span><strong>${fmtMin(totMin)}</strong></div>
        <div><span>Saldo período</span><strong style="color:${totBal>=0?'#1A9C70':'#C04050'}">${totBal>=0?'+':''}${fmtMin(totBal)}</strong></div>
        <div><span>Banco acumulado</span><strong style="color:${emp.totBal>=0?'#1A9C70':'#C04050'}">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</strong></div>
      </div>
      <table><thead><tr><th>Data</th><th>Dia</th><th>Marcações</th><th>Trabalhado</th><th>Esperado</th><th>Saldo</th><th>Banco Acum.</th><th>Observação</th></tr></thead>
      <tbody>${rows}<tr class="tr"><td colspan="3" style="padding:8px 10px">TOTAL</td><td style="padding:8px 10px">${fmtMin(totMin)}</td><td></td><td style="padding:8px 10px;color:${totBal>=0?'#1A9C70':'#C04050'}">${totBal>=0?'+':''}${fmtMin(totBal)}</td><td colspan="2"></td></tr></tbody>
      </table><div style="font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px">Gerado em ${new Date().toLocaleString('pt-BR')} · Uniko</div>
    </body></html>`;
    const w=window.open('','_blank','width=900,height=700'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  };

  /* ── PDF: Comprovante Calendário — dia específico ── */
  const printCalDia = (date, dayEmps) => {
    const rows = dayEmps.map(({emp,day})=>{
      const jv=justifs[`${emp.cpf}_${date}`];
      const marks=day.pairs.map(p=>`${p.entry}${p.exit?' → '+p.exit:' → ?'}`).join('  |  ');
      return `<tr style="border-bottom:1px solid #eee;background:${day.issues.length>0?'#fff5f5':'white'}">
        <td style="padding:7px 10px;font-weight:600">${emp.name||emp.cpf}</td><td style="padding:7px 10px;font-size:11px;color:#666">${emp.cpf}</td>
        <td style="padding:7px 10px">${marks||'—'}</td><td style="padding:7px 10px;text-align:right;font-weight:700">${fmtMin(day.totalMin)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700;color:${day.balance>=0?'#1A9C70':'#C04050'}">${day.balance>=0?'+':''}${fmtMin(day.balance)}</td>
        <td style="padding:7px 10px;font-size:11px;color:${day.issues.length>0?'#C04050':'#1A9C70'}">${day.issues.join('; ')||'✓ OK'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#996600">${jv?.text||'—'}</td>
      </tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Marcações ${fmtDate(date)}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
      h1{font-size:17px;margin-bottom:3px}h2{font-size:13px;font-weight:normal;color:#555;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}thead tr{background:#1A9C70;color:white}
      thead th{padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;font-weight:700}
      @media print{body{padding:10px}}</style></head><body>
      <h1>Marcações do Dia — ${fmtDate(date)} (${diaSem(date)})</h1>
      <h2>${displayRazao(afd?.header?.razao)} · ${dayEmps.length} funcionário${dayEmps.length!==1?'s':''}</h2>
      <table style="margin-top:14px"><thead><tr><th>Funcionário</th><th>PIS/CPF</th><th>Marcações</th><th>Trabalhado</th><th>Saldo</th><th>Inconsistências</th><th>Observação</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div style="font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;margin-top:16px">Gerado em ${new Date().toLocaleString('pt-BR')} · Uniko</div>
    </body></html>`;
    const w=window.open('','_blank','width=900,height=700'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400);
  };

  const getBancoDateRange = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const fmt = d => d.toISOString().slice(0,10);
    if (bancoFilter==='custom')  return {from:bancoStart||'0000-00-00', to:bancoEnd||'9999-99-99'};
    if (bancoFilter==='hoje')   return {from:fmt(today), to:fmt(today)};
    if (bancoFilter==='ontem')  { const d=new Date(today); d.setDate(d.getDate()-1); return {from:fmt(d),to:fmt(d)}; }
    if (bancoFilter==='3dias')  { const d=new Date(today); d.setDate(d.getDate()-2); return {from:fmt(d),to:fmt(today)}; }
    if (bancoFilter==='7dias')  { const d=new Date(today); d.setDate(d.getDate()-6); return {from:fmt(d),to:fmt(today)}; }
    if (bancoFilter==='30dias') { const d=new Date(today); d.setDate(d.getDate()-29);return {from:fmt(d),to:fmt(today)}; }
    return {from:'0000-00-00',to:'9999-99-99'};
  };

  /* ── Salvar justificativa (persiste no banco) ── */
  const saveJustif = async () => {
    if (!editJust) return;
    const { cpf, date } = editJust;
    const key  = `${cpf}_${date}`;
    const text = editText.trim();
    setEditJust(null); setEditText('');
    // Otimista: atualiza a tela já
    setJustifs(prev => {
      const next = { ...prev };
      if (text) next[key] = { ...(next[key]||{}), text, abonado:true };
      else delete next[key];
      return next;
    });
    try {
      const saved = await saveJustificativa({ cpf, date, text });
      setJustifs(prev => {
        const next = { ...prev };
        if (saved) next[key] = saved; else delete next[key];
        return next;
      });
    } catch (ex) {
      console.error('Justificativa save error:', ex);
      setErr('Erro ao salvar justificativa: ' + ex.message);
    }
  };

  /* ── Estilo de cabeçalho de aba (opaco, legível) ── */
  const SecHead = ({title, sub, icon}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'16px 20px',borderRadius:14,
      background:cardBg,
      backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',
      border:`1px solid ${T.border}`,boxShadow:T.shM}}>
      <div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>{title}</div>
        <div style={{fontSize:13,color:T.textS,marginTop:3}}>{sub}</div>
      </div>
      {icon||<Moon size={24} color={T.goldL} opacity={0.35} float/>}
    </div>
  );

  /* ── Imprimir Espelho de Ponto ── */
  const printEspelho = (emp) => {
    const rows = emp.days.map(day => `
      <tr style="border-bottom:1px solid #e0e0e0;background:${day.issues.length>0?'#fff3f3':day.wknd?'#f5f5f5':'white'}">
        <td style="padding:8px 12px;font-weight:500">${fmtDate(day.date)}</td>
        <td style="padding:8px 12px;color:#666">${diaSem(day.date)}</td>
        <td style="padding:8px 12px">
          ${day.times.map((t,i)=>`<span style="display:inline-block;margin:1px;padding:2px 8px;border-radius:4px;font-size:12px;background:${i%2===0?'#e8f5e9':'#e3f2fd'};color:${i%2===0?'#1A9C70':'#1E70B5'};font-weight:600">${t}</span>`).join(' ')}
          ${day.times.length===0?'<span style="color:#aaa;font-size:12px">Sem marcações</span>':''}
        </td>
        <td style="padding:8px 12px;font-weight:700;text-align:right">${fmtMin(day.totalMin)}</td>
        <td style="padding:8px 12px;text-align:right;color:#666">${day.wknd?'Folga':fmtMin(day.expected)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:${day.balance>=0?'#1A9C70':'#C04050'}">${day.balance>0?'+':''}${fmtMin(day.balance)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:${day.cumBal>=0?'#1A9C70':'#C04050'}">${day.cumBal>=0?'+':''}${fmtMin(day.cumBal)}</td>
        <td style="padding:8px 12px;font-size:11px;color:#C04050">${day.issues.join('; ')}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Espelho de Ponto — ${emp.name||emp.cpf}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#222;padding:24px}
      h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;font-weight:normal;color:#555;margin-bottom:16px}
      .meta{display:flex;gap:32px;margin-bottom:20px;padding:12px 16px;background:#f9f9f9;border-radius:6px;border:1px solid #ddd}
      .meta div{display:flex;flex-direction:column;gap:2px}.meta span{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em}.meta strong{font-size:14px}
      table{width:100%;border-collapse:collapse}thead tr{background:#1E70B5;color:white}
      thead th{padding:10px 12px;text-align:left;font-size:11px;letter-spacing:.07em;text-transform:uppercase;font-weight:700}
      .total{background:#1E70B5;color:white;font-weight:700;font-size:14px}
      .footer{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:11px;color:#888}
      @media print{body{padding:12px}.footer{position:fixed;bottom:16px;left:24px;right:24px}}</style>
    </head><body>
      <h1>Espelho de Ponto Eletrônico</h1>
      <h2>${afd?.header?.razao||'Empresa'} — CNPJ: ${fmtCNPJ(afd?.header?.cnpj)}</h2>
      <div class="meta">
        <div><span>Funcionário</span><strong>${emp.name||'—'}</strong></div>
        <div><span>PIS/CPF</span><strong>${emp.cpf}</strong></div>
        <div><span>Período</span><strong>${fmtDate(emp.firstMark)} a ${fmtDate(emp.lastMark)}</strong></div>
        <div><span>Total Trabalhado</span><strong>${fmtMin(emp.totMin)}</strong></div>
        <div><span>Saldo Final</span><strong style="color:${emp.totBal>=0?'#1A9C70':'#C04050'}">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</strong></div>
        <div><span>Jornada Base</span><strong>${fmtMin(jornada)}/dia útil</strong></div>
      </div>
      <table>
        <thead><tr>
          <th>Data</th><th>Dia</th><th>Marcações</th><th style="text-align:right">Trabalhado</th>
          <th style="text-align:right">Esperado</th><th style="text-align:right">Saldo Dia</th>
          <th style="text-align:right">Banco Acum.</th><th>Observações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total">
          <td colspan="3" style="padding:10px 12px">TOTAIS</td>
          <td style="padding:10px 12px;text-align:right">${fmtMin(emp.totMin)}</td>
          <td></td>
          <td style="padding:10px 12px;text-align:right">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</td>
          <td style="padding:10px 12px;text-align:right">${emp.totBal>=0?'+':''}${fmtMin(emp.totBal)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <div class="footer">
        <span>Gerado pelo Uniko em ${new Date().toLocaleString('pt-BR')} | Portaria 671/2021</span>
        <span>___________________________________ Assinatura do Colaborador</span>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
    const w = window.open('','_blank','width=900,height=700');
    w.document.write(html);
    w.document.close();
  };

  /* ════════════════════════════════════════
     CARREGANDO DO BANCO
  ════════════════════════════════════════ */
  if (dbLoading) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,fontFamily:'var(--font-body)',position:'relative',zIndex:1}}>
      <div style={{width:52,height:52,border:`3px solid ${T.goldLine}33`,borderTop:`3px solid ${T.goldLine}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <div style={{fontSize:15,color:T.textS,fontWeight:500}}>Carregando banco de horas...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ════════════════════════════════════════
     TELA DE UPLOAD (primeiro acesso / banco vazio)
  ════════════════════════════════════════ */
  if (!afd) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,position:'relative',zIndex:1,fontFamily:'var(--font-body)'}}>

      {/* Moons decorativas nos cantos */}
      <div style={{position:'absolute',top:24,right:40,opacity:.18,transform:'rotate(30deg)'}}><Moon size={72} color={T.goldL} float/></div>
      <div style={{position:'absolute',bottom:32,left:36,opacity:.12,transform:'rotate(-20deg) scaleX(-1)'}}><Moon size={54} color={T.goldV} float/></div>
      <div style={{position:'absolute',top:'38%',right:28,opacity:.08}}><Moon size={38} color={T.gold}/></div>
      <div style={{position:'absolute',top:'55%',left:24,opacity:.07,transform:'rotate(140deg)'}}><Moon size={30} color={T.goldL}/></div>

      {/* Botão voltar */}
      <div style={{position:'absolute',top:28,left:32}}>
        <button onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'9px 18px',background:T.surfaceSub||'rgba(0,0,0,0.04)',border:`1px solid ${T.border}`,borderRadius:10,cursor:'pointer',color:T.textS,outline:'none',fontFamily:'var(--font-body)',fontSize:14,transition:'all .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.textS}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          Módulos
        </button>
      </div>

      {/* Logo + Título */}
      <div className="fsu" style={{textAlign:'center',marginBottom:28}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
          <Logo size={72}/>
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:11,fontWeight:400,color:T.textD,letterSpacing:'.35em',textTransform:'uppercase',marginBottom:10}}>
          Uniko
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:36,fontWeight:700,color:T.text,letterSpacing:'.06em',lineHeight:1,marginBottom:6}}>
          Ponto Eletrônico
        </div>
        <div style={{fontSize:14,color:T.textT,letterSpacing:'.04em',marginBottom:22}}>
          Leitor de AFD · Portaria 671 / 1510 · Banco de horas salvo no banco de dados
        </div>
        <div style={{width:420,margin:'0 auto'}}><StarDivider my={0}/></div>
      </div>
      <div className="fsu2" onDragOver={onDragO} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
        onClick={()=>document.getElementById('_afd_input_').click()}
        style={{width:'100%',maxWidth:520,border:`2px dashed ${drag?T.goldLine:T.border}`,borderRadius:22,padding:'52px 44px',textAlign:'center',cursor:'pointer',background:drag?T.goldGl:(T.surface||'rgba(255,255,255,0.9)'),boxShadow:drag?`0 0 0 4px ${T.goldLine}22,${T.shM}`:T.sh,transition:'all .22s'}}>
        <input id="_afd_input_" type="file" accept=".txt,.afd" style={{display:'none'}} onChange={e=>processFile(e.target.files[0])}/>
        {load ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
            <div style={{width:48,height:48,border:`3px solid ${T.goldLine}33`,borderTop:`3px solid ${T.goldLine}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
            <div style={{fontSize:16,color:T.textS,fontWeight:500}}>Processando AFD...</div>
          </div>
        ) : (
          <>
            <div style={{width:72,height:72,borderRadius:18,margin:'0 auto 20px',background:drag?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),border:`1.5px solid ${drag?T.goldLine+'66':T.border}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD} strokeWidth="1.4" strokeLinecap="round" style={{transition:'stroke .2s'}}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>
              </svg>
            </div>
            <div style={{fontSize:19,fontWeight:600,color:drag?T.gold:T.text,marginBottom:10}}>{drag?'Solte para processar':'Arraste o arquivo AFD aqui'}</div>
            <div style={{fontSize:14,color:T.textT,lineHeight:1.9}}>ou <span style={{color:T.gold,fontWeight:600}}>clique para selecionar</span><br/><span style={{fontSize:13}}>Arquivo .txt do relógio de ponto (REP-C, REP-A, REP-P) — será salvo no banco e atualizado a cada novo AFD</span></div>
          </>
        )}
      </div>
      {err&&<div style={{marginTop:16,maxWidth:520,width:'100%',padding:'12px 18px',background:'rgba(192,64,80,0.07)',border:'1px solid rgba(192,64,80,0.25)',borderRadius:12,display:'flex',alignItems:'center',gap:10}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{fontSize:13,color:'#C04050'}}>{err}</span>
      </div>}
      {/* Info pills */}
      <div className="fsu3" style={{display:'flex',gap:10,marginTop:24,flexWrap:'wrap',justifyContent:'center'}}>
        {[{d:<polyline points="20 6 9 17 4 12"/>,t:'Portaria 671 e 1510'},{d:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,t:'Salvo no banco de dados'},{d:<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>,t:'Qualquer marca de REP'}].map((it,i)=>(
          <div key={i} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:99,background:T.surface||'rgba(255,255,255,0.9)',border:`1px solid ${T.border}`,boxShadow:T.sh}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.9" strokeLinecap="round">{it.d}</svg>
            <span style={{fontSize:13,color:T.textS}}>{it.t}</span>
          </div>
        ))}
      </div>

      {/* Footer Uniko */}
      <div className="fsu4" style={{position:'absolute',bottom:24,display:'flex',alignItems:'center',gap:10,opacity:.35}}>
        <Logo size={20}/>
        <span style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT}}>
          Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
        </span>
      </div>
    </div>
  );

  /* ════════════════════════════════════════
     DASHBOARD
  ════════════════════════════════════════ */
  const { header, employees, excludedEmployees, totalMarks, totalIssues, allDates, rawRecs, calDates, calData } = afd;
  const curEmp = employees.find(e=>e.cpf===selEmp) || employees[0];

  // ── Tamanhos de página ────────────────────────────────────
  const PG_LINHA      = 50;
  const PG_ISSUES     = 8;
  const PG_BANCO_ALL  = 15;
  const PG_BANCO_DAYS = 30;

  // ── Componente de paginação reutilizável ──────────────────
  const Pager = ({ page, total, pageSize, onPage }) => {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'14px 20px',borderTop:`1px solid ${T.border}`}}>
        <button onClick={()=>onPage(page-1)} disabled={page===0}
          style={{padding:'6px 16px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:page===0?T.textD:T.textS,cursor:page===0?'not-allowed':'pointer',fontSize:12,fontWeight:500,fontFamily:'var(--font-body)',opacity:page===0?0.4:1,outline:'none'}}>
          ← Anterior
        </button>
        <span style={{fontSize:12,color:T.textT,minWidth:100,textAlign:'center'}}>
          Página <strong style={{color:T.text}}>{page+1}</strong> de <strong style={{color:T.text}}>{totalPages}</strong>
          <span style={{color:T.textD,marginLeft:6}}>({total} itens)</span>
        </span>
        <button onClick={()=>onPage(page+1)} disabled={page>=totalPages-1}
          style={{padding:'6px 16px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:page>=totalPages-1?T.textD:T.textS,cursor:page>=totalPages-1?'not-allowed':'pointer',fontSize:12,fontWeight:500,fontFamily:'var(--font-body)',opacity:page>=totalPages-1?0.4:1,outline:'none'}}>
          Próxima →
        </button>
      </div>
    );
  };

  return (
    <div style={{minHeight:'100vh',background:'transparent',fontFamily:'var(--font-body)',position:'relative'}}>
      <style>{`
        @keyframes blobGrad { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes blobGradRed { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes hdrBlob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(28px,-8px) scale(1.15)} 66%{transform:translate(-12px,10px) scale(0.92)} }
        @keyframes hdrBlob2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-22px,12px) scale(1.08)} 80%{transform:translate(16px,-6px) scale(0.9)} }
        @keyframes hdrBlob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,14px) scale(1.12)} }
        .blob-green { background:linear-gradient(270deg,#1A9C70,#2dd4a0,#0f7a56); background-size:200% 200%; animation:blobGrad 3s ease infinite; color:white; }
        .blob-red   { background:linear-gradient(270deg,#C04050,#e8566a,#9a2030); background-size:200% 200%; animation:blobGradRed 3s ease infinite; color:white; }
        .blob-amber { background:linear-gradient(270deg,#D89030,#f0b050,#b06820); background-size:200% 200%; animation:blobGrad 3s ease infinite; color:white; }
        .ponto-dropdown { box-shadow:0 8px 24px rgba(0,0,0,0.18); }
      `}</style>
      <div style={{position:'relative',zIndex:1}}>

      {/* ── TopBar ── */}
      <div style={{height:56,background:T.topbarBg||(isDark?`${T.surface}ee`:'rgba(245,250,255,0.75)'),backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 24px',gap:12,position:'sticky',top:0,zIndex:200,boxShadow:`0 1px 24px ${T.goldLine}11`}}>
        <button onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 14px',background:T.surfaceSub||'rgba(0,0,0,0.04)',border:`1px solid ${T.border}`,borderRadius:9,cursor:'pointer',color:T.textS,outline:'none',fontFamily:'var(--font-body)',fontSize:13,transition:'all .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.textS}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          Módulos
        </button>
        <div style={{width:1,height:22,background:T.border}}/>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Ponto Eletrônico</span>
        {header?.razao&&<><div style={{width:1,height:22,background:T.border}}/><span style={{fontSize:13,color:T.textT,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'.03em'}}>{displayRazao(header.razao)}</span></>}
        {isAdmin&&<Tag color="#C04050" style={{marginLeft:4}}>Modo Admin</Tag>}
        <div style={{flex:1}}/>
        {header?.fmt&&<Tag color={T.green} style={{fontSize:11}}>AFD · Portaria {header.fmt==='671'?'671':'1510'}</Tag>}
        <button onClick={()=>setShowConf(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:showConf?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.04)'),border:`1px solid ${showConf?T.goldLine+'44':T.border}`,borderRadius:9,cursor:'pointer',color:showConf?T.gold:T.textS,outline:'none',fontFamily:'var(--font-body)',fontSize:13,transition:'all .15s'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          Config
        </button>
        <input id="_afd_input_dash_" type="file" accept=".txt,.afd" style={{display:'none'}} onChange={e=>{processFile(e.target.files[0]); e.target.value='';}}/>
        <button disabled={syncing} onClick={()=>document.getElementById('_afd_input_dash_').click()} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 16px',background:T.goldGl,border:`1px solid ${T.goldLine}44`,borderRadius:9,cursor:syncing?'wait':'pointer',color:T.gold,outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:500,opacity:syncing?0.6:1}}
          onMouseEnter={e=>{if(!syncing)e.currentTarget.style.background=`${T.goldLine}20`;}} onMouseLeave={e=>e.currentTarget.style.background=T.goldGl}>
          {syncing
            ? <><div style={{width:13,height:13,border:`2px solid ${T.gold}55`,borderTop:`2px solid ${T.gold}`,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Salvando...</>
            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Atualizar com AFD</>}
        </button>
      </div>

      <div style={{padding:'24px 32px',maxWidth:1400,margin:'0 auto'}}>

        {/* Header da empresa com identidade visual */}
        <div style={{marginBottom:6,padding:'18px 22px',borderRadius:16,
          background:headerBg,
          backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
          border:`1px solid ${T.border}`,boxShadow:T.sh,
          display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:20,fontWeight:700,color:T.text,letterSpacing:'.05em',lineHeight:1,textTransform:'uppercase'}}>
              {displayRazao(header?.razao)}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:18,marginTop:8}}>
              {[
                {l:'CNPJ',       v:fmtCNPJ(header?.cnpj)},
                {l:'Período',    v:`${fmtDate(header?.inicio)} — ${fmtDate(header?.fim)}`},
                {l:'Equipamento',v:header?.modelo||'—'},
                {l:'Formato',    v:`Portaria ${header?.fmt||'671'}`},
              ].map(({l,v})=>(
                <div key={l}>
                  <div style={{fontSize:10,color:T.textD,textTransform:'uppercase',letterSpacing:'.09em',fontWeight:600,marginBottom:2}}>{l}</div>
                  <div style={{fontSize:13,color:T.textS,fontWeight:500}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Moon size={28} color={T.goldL} opacity={0.4} float/>
            <Tag color={T.green}>REP · Portaria 671</Tag>
          </div>
        </div>
        {/* KPIs — apenas na aba Usuários (com divider) */}
        {tab==='usuarios'&&(
        <>
        <StarDivider my={14}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
          {[
            {l:'Funcionários',v:employees.length,sub:`${employees.filter(e=>e.name).length} identificados pelo nome`,c:'#1E70B5',icon:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>},
            {l:'Total de Marcações',v:totalMarks,sub:`${allDates.length} dias com registros`,c:T.gold,icon:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></>},
            {l:'Banco de Horas',v:employees.length>0?fmtMin(employees.reduce((s,e)=>s+e.totBal,0)):'0h00',sub:`saldo total acumulado de todos`,c:'#1A9C70',icon:<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>},
            {l:'Inconsistências',v:totalIssues,sub:totalIssues===0?'Tudo em conformidade':'Requer atenção do RH',c:totalIssues>0?'#C04050':'#1A9C70',icon:totalIssues>0?<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>:<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>},
          ].map(({l,v,sub,c,icon})=>(
            <Card key={l} style={{padding:'18px 20px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
              <div style={{width:40,height:40,borderRadius:10,background:`${c}18`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round">{icon}</svg>
              </div>
              <div style={{fontSize:28,fontWeight:700,color:T.text,lineHeight:1}}>{v}</div>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginTop:4}}>{l}</div>
              <div style={{fontSize:11,color:T.textT,marginTop:3,lineHeight:1.4}}>{sub}</div>
            </Card>
          ))}
        </div>
        </>
        )}

        {/* Divider simples para outras abas */}
        {tab!=='usuarios'&&<div style={{marginBottom:14}}/>}

        {/* Painel de Configurações */}
        {showConf&&(
          <Card style={{padding:'18px 22px',marginBottom:16,border:`1.5px solid ${T.goldLine}44`,background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
            <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Configurações do Cálculo
            </div>
            <div style={{display:'flex',gap:32,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div>
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                  Tolerância de Marcação Gêmea
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:8}}>
                  Marcações dentro deste intervalo são auto-ignoradas no cálculo
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[0,1,2,3,5,10].map(v=>(
                    <button key={v} onClick={()=>setTolerance(v)}
                      style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:tolerance===v?700:400,background:tolerance===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:tolerance===v?T.gold:T.textS,border:`1.5px solid ${tolerance===v?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                      {v===0?'Desligado':`${v} min`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                  Tolerância de Atraso
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:8}}>
                  Atrasos dentro deste limite não geram horas negativas
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[0,5,10,15].map(v=>(
                    <button key={v} onClick={()=>setToleraciaAtraso(v)}
                      style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:toleranciaAtraso===v?700:400,background:toleranciaAtraso===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:toleranciaAtraso===v?T.gold:T.textS,border:`1.5px solid ${toleranciaAtraso===v?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                      {v===0?'Desligado':`${v} min`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:T.textD,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>
                  Jornada Diária
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:8}}>
                  Horas esperadas por dia útil (afeta saldo e banco)
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[[240,'4h · 20h/sem'],[360,'6h · 30h/sem'],[480,'8h · 40h/sem'],[528,'8h48 · 44h/sem'],[540,'9h · 45h/sem']].map(([v,l])=>(
                    <button key={v} onClick={()=>setJornada(v)}
                      style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:jornada===v?700:400,background:jornada===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:jornada===v?T.gold:T.textS,border:`1.5px solid ${jornada===v?T.goldLine+'55':T.border}`,transition:'all .15s'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{fontSize:12,color:T.textT,padding:'10px 16px',borderRadius:10,background:T.surfaceSub||'rgba(0,0,0,0.03)',border:`1px solid ${T.border}`}}>
                <div style={{fontWeight:600,color:T.text,marginBottom:4}}>Configuração atual</div>
                <div>Tolerância gêmea: <strong style={{color:T.gold}}>{tolerance===0?'Desligada':`${tolerance} min`}</strong></div>
                <div>Tolerância atraso: <strong style={{color:T.gold}}>{toleranciaAtraso===0?'Desligada':`${toleranciaAtraso} min`}</strong></div>
                <div>Jornada: <strong style={{color:T.gold}}>{fmtMin(jornada)}/dia</strong></div>
                <div style={{marginTop:4,fontSize:11,color:T.textD}}>⚠ Alterações aplicam no próximo upload</div>
              </div>
            </div>
          </Card>
        )}

        {/* Confirmação do último AFD processado */}
        {uploadReport&&(
          <div style={{padding:'11px 18px',borderRadius:12,background:'rgba(26,156,112,0.08)',border:'1.5px solid rgba(26,156,112,0.30)',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.2" strokeLinecap="round" style={{flexShrink:0}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div style={{flex:1,fontSize:13,color:T.textS}}>
              <strong style={{color:T.text}}>{uploadReport.fileName}</strong> processado — {uploadReport.total} marcação{uploadReport.total!==1?'ões':''} enviada{uploadReport.total!==1?'s':''} ao banco (duplicadas ignoradas). Banco de horas atualizado.
            </div>
            <button onClick={()=>setUploadReport(null)} style={{flexShrink:0,background:'transparent',border:'none',cursor:'pointer',color:T.textD,fontSize:16,lineHeight:1,outline:'none'}}>✕</button>
          </div>
        )}

        {/* Alerta de gaps no NSR (apenas do arquivo recém-enviado) */}
        {uploadReport?.nsrGaps?.length>0&&(
          <div style={{padding:'12px 18px',borderRadius:12,background:'rgba(192,64,80,0.08)',border:'1.5px solid rgba(192,64,80,0.30)',marginBottom:16,display:'flex',alignItems:'flex-start',gap:12}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#C04050',marginBottom:3}}>
                ⚠ Gaps detectados na sequência NSR do arquivo — possível adulteração
              </div>
              <div style={{fontSize:12,color:T.textS}}>
                {uploadReport.nsrGaps.map((g,i)=>`NSR ${g.from}→${g.to} (${g.gap} registro${g.gap>1?'s':''}  ausente${g.gap>1?'s':''})`).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <StarDivider my={16} dim/>
        <div style={{display:'flex',gap:3,marginBottom:18,padding:4,width:'fit-content',
          background:tabsBg,
          backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',
          border:`1px solid ${T.border}`,borderRadius:13,boxShadow:T.sh,flexWrap:'wrap'}}>
          {[
            {id:'usuarios',   label:'Usuários'},
            {id:'banco',      label:'Banco de Horas'},
            {id:'calendario', label:'Calendário'},
            {id:'linhaLinha', label:'Linha a Linha'},
            {id:'issues',     label:`Inconsistências${totalIssues>0?' · '+totalIssues:''}`},
          ].map(({id,label})=>(<button key={id} onClick={()=>setTab(id)} style={tabSt(id)}>{label}</button>))}
        </div>

        {/* ════════════
            TAB: USUÁRIOS
        ════════════ */}
        {tab==='usuarios'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Colaboradores no Relógio" sub="Clique em um colaborador para ver o banco de horas detalhado"/>
            {/* Barra de pesquisa global de usuários */}
            <div style={{position:'relative',maxWidth:380}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={userSearch} onChange={e=>setUserSearch(e.target.value)}
                placeholder="Pesquisar colaborador por nome ou CPF..."
                style={{paddingLeft:32,paddingRight:12,paddingTop:9,paddingBottom:9,border:`1.5px solid ${userSearch?T.goldLine+'88':T.border}`,borderRadius:10,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:cardBg,outline:'none',width:'100%',backdropFilter:'blur(8px)',transition:'border-color .15s'}}/>
              {userSearch&&<button onClick={()=>setUserSearch('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.textD,fontSize:16,lineHeight:1,padding:0}}>×</button>}
            </div>
            <div style={{borderRadius:16,overflow:'hidden'}}>
              <div style={{padding:'14px 22px',position:'relative',overflow:'hidden',background:'#1A9C70',display:'flex',alignItems:'center',gap:8}}>
                <div style={{position:'absolute',width:120,height:120,borderRadius:'50%',background:'#0a5c3a',filter:'blur(28px)',opacity:0.65,top:'-40px',left:'3%',animation:'hdrBlob1 5s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',background:'#2dd4a0',filter:'blur(18px)',opacity:0.6,top:'0px',left:'35%',animation:'hdrBlob2 6s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:100,height:100,borderRadius:'50%',background:'#40e8a0',filter:'blur(24px)',opacity:0.45,top:'-35px',left:'60%',animation:'hdrBlob3 7s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:70,height:70,borderRadius:'50%',background:'#0d9e5e',filter:'blur(16px)',opacity:0.55,top:'5px',left:'85%',animation:'hdrBlob1 8s ease-in-out infinite'}}/>
                <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:8}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  <span style={{fontSize:14,fontWeight:700,color:'white'}}>Nomes Ativos no Relógio</span>
                </div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:'none'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                <thead>
                  <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                    {['Nro','Nome','PIS/CPF','Marcações','Primeira','Última','Total Horas','Saldo Banco'].map(h=>(
                      <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 16px'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(emp=>!userSearch||(emp.name||'').toLowerCase().includes(userSearch.toLowerCase())||emp.cpf.includes(userSearch)).map((emp,i)=>(
                    <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`,transition:'background .12s',cursor:'pointer'}}
                      onClick={()=>{setSelEmp(emp.cpf);setTab('banco');}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textT,fontWeight:500}}>{i+1}.</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',boxShadow:`0 2px 8px ${emp.color}44`}}>{initials(emp.name||emp.cpf)}</div>
                          <div>
                            <div style={{fontSize:14,fontWeight:600,color:emp.name?T.blue:'#C04050'}}>{emp.name||'(sem nome no cadastro)'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</td>
                      <td style={{padding:'12px 16px',fontSize:14,fontWeight:600,color:T.text}}>{emp.marks.length}</td>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textS}}>{fmtDate(emp.firstMark)}</td>
                      <td style={{padding:'12px 16px',fontSize:13,color:T.textS}}>{fmtDate(emp.lastMark)}</td>
                      <td style={{padding:'12px 16px',fontSize:14,fontWeight:600,color:T.text}}>{fmtMin(emp.totMin)}</td>
                      <td style={{padding:'12px 16px'}}>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <button onClick={e=>{e.stopPropagation();setSelEmp(emp.cpf);setBancoEmpMode('single');setTab('banco');}}
                            style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:500,background:T.goldGl,color:T.gold,border:`1px solid ${T.goldLine}44`}}>
                            Ver banco
                          </button>
                          <button onClick={e=>{e.stopPropagation();printEspelho(emp);}}
                            style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:500,background:'rgba(26,156,112,0.10)',color:'#1A9C70',border:'1px solid rgba(26,156,112,0.25)',display:'flex',alignItems:'center',gap:5}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            Espelho
                          </button>
                          <span className={emp.totBal>=0?'blob-green':'blob-red'}
                            style={{padding:'4px 10px',borderRadius:7,fontSize:12,fontWeight:700,minWidth:64,textAlign:'center'}}>
                            {emp.totBal>=0?'+':''}{fmtMin(emp.totBal)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Nomes Excluídos — sem borda do Card, blobs vermelhos mais ricos */}
            {excludedEmployees.length>0&&(
              <div style={{borderRadius:16,overflow:'hidden'}}>
                <div style={{padding:'14px 22px',position:'relative',overflow:'hidden',background:'#C04050',display:'flex',alignItems:'center',gap:8}}>
                  <div style={{position:'absolute',width:110,height:110,borderRadius:'50%',background:'#7a1020',filter:'blur(26px)',opacity:0.65,top:'-35px',left:'4%',animation:'hdrBlob2 5s ease-in-out infinite'}}/>
                  <div style={{position:'absolute',width:75,height:75,borderRadius:'50%',background:'#ff4060',filter:'blur(18px)',opacity:0.55,top:'5px',left:'40%',animation:'hdrBlob1 6.5s ease-in-out infinite'}}/>
                  <div style={{position:'absolute',width:90,height:90,borderRadius:'50%',background:'#e85568',filter:'blur(22px)',opacity:0.5,top:'-30px',left:'65%',animation:'hdrBlob3 7.5s ease-in-out infinite'}}/>
                  <div style={{position:'absolute',width:60,height:60,borderRadius:'50%',background:'#ff8080',filter:'blur(15px)',opacity:0.45,top:'8px',left:'88%',animation:'hdrBlob2 9s ease-in-out infinite'}}/>
                  <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:8}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="18" x2="17" y2="12"/><line x1="17" y1="18" x2="23" y2="12"/></svg>
                    <span style={{fontSize:14,fontWeight:700,color:'white'}}>Nomes Excluídos do Relógio</span>
                  </div>
                </div>
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:'none'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                  <thead>
                    <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                      {['Nro','Nome','PIS/CPF'].map(h=>(
                        <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 16px'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excludedEmployees.map((emp,i)=>(
                      <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`}}>
                        <td style={{padding:'12px 16px',fontSize:13,color:T.textT}}>{i+1}.</td>
                        <td style={{padding:'12px 16px',fontSize:14,color:T.textS}}>{emp.name||'—'}</td>
                        <td style={{padding:'12px 16px',fontSize:13,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{padding:'10px 16px',borderTop:`1px solid ${T.border}`,fontSize:12,color:T.textT}}>
                  * Funcionários com operação de exclusão (E) no arquivo AFD, sem marcações de ponto.
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════
            TAB: BANCO DE HORAS
        ════════════ */}
        {tab==='banco'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Banco de Horas" sub={`Saldo diário vs. jornada de ${fmtMin(jornada)} · subtotais semanais`}/>

            {/* Filtros de período + funcionário + filtrar dias */}
            <Card style={{padding:'16px 20px', overflow:'visible'}} elevated>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {/* Linha 1: Período */}
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',flexShrink:0,width:90}}>Período:</div>
                  {[['hoje','Hoje'],['ontem','Ontem'],['3dias','3 dias'],['7dias','7 dias'],['30dias','30 dias'],['todos','Todos'],['custom','Período']].map(([v,l])=>(
                    <button key={v} onClick={()=>setBancoFilter(v)}
                      style={{padding:'5px 13px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:bancoFilter===v?700:400,background:bancoFilter===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:bancoFilter===v?T.gold:T.textS,border:`1.5px solid ${bancoFilter===v?T.goldLine+'55':T.border}`,transition:'all .12s'}}>
                      {l}
                    </button>
                  ))}
                  {bancoFilter==='custom'&&(
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <input type="date" value={bancoStart} max={bancoEnd||undefined} onChange={e=>setBancoStart(e.target.value)}
                        style={{padding:'5px 8px',border:`1px solid ${T.border}`,borderRadius:7,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none'}}/>
                      <span style={{fontSize:12,color:T.textD}}>até</span>
                      <input type="date" value={bancoEnd} min={bancoStart||undefined} onChange={e=>setBancoEnd(e.target.value)}
                        style={{padding:'5px 8px',border:`1px solid ${T.border}`,borderRadius:7,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none'}}/>
                      {(bancoStart||bancoEnd)&&(
                        <button onClick={()=>{setBancoStart('');setBancoEnd('');}}
                          style={{padding:'5px 8px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,color:T.textD,background:'transparent',border:`1px solid ${T.border}`}}>
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Linha 2: Funcionário + busca */}
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',flexShrink:0,width:90}}>Funcionário:</div>
                  <button onClick={()=>{setBancoEmpMode('all');setBancoSearch('');}}
                    style={{padding:'5px 13px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:bancoEmpMode==='all'?700:400,background:bancoEmpMode==='all'?'rgba(30,112,181,0.12)':(T.surfaceSub||'rgba(0,0,0,0.03)'),color:bancoEmpMode==='all'?'#1E70B5':T.textS,border:`1.5px solid ${bancoEmpMode==='all'?'#1E70B588':T.border}`,transition:'all .12s',flexShrink:0}}>
                    Todos
                  </button>
                  {/* Busca com dropdown — overflow visible para não clipar */}
                  <div style={{position:'relative',flex:1,maxWidth:300,minWidth:160}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',zIndex:2,pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      placeholder="Buscar por nome..."
                      value={bancoSearch}
                      onChange={e=>{setBancoSearch(e.target.value);if(!e.target.value.trim())setBancoEmpMode('all');}}
                      style={{paddingLeft:28,paddingRight:10,paddingTop:6,paddingBottom:6,border:`1.5px solid ${bancoSearch?T.goldLine+'88':T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none',width:'100%',transition:'border-color .15s'}}/>
                    {bancoSearch.trim()&&(()=>{
                      const matches=employees.filter(e=>(e.name||'').toLowerCase().includes(bancoSearch.toLowerCase())||e.cpf.includes(bancoSearch));
                      return(
                        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:T.surface||'white',border:`1.5px solid ${T.goldLine}66`,borderRadius:10,overflow:'hidden',boxShadow:`0 8px 24px rgba(0,0,0,0.14)`,zIndex:9999}}>
                          {matches.length===0
                            ? <div style={{padding:'10px 14px',fontSize:12,color:T.textT}}>Nenhum resultado</div>
                            : matches.map(emp=>(
                              <div key={emp.cpf} onClick={()=>{setBancoEmpMode('single');setSelEmp(emp.cpf);setBancoSearch('');}}
                                style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer',transition:'background .1s'}}
                                onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                <div>
                                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{emp.name||emp.cpf}</div>
                                  <div style={{fontSize:10,color:T.textT}}>{emp.cpf} · {emp.marks.length} marcações</div>
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Mini totalizador do funcionário selecionado */}
                {bancoEmpMode==='single'&&curEmp&&(()=>{
                  const range=getBancoDateRange();
                  const fd=curEmp.days.filter(d=>d.date>=range.from&&d.date<=range.to);
                  const totMin=fd.reduce((s,d)=>s+d.totalMin,0);
                  const totBal=fd.reduce((s,d)=>s+d.balance,0);
                  return(
                    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:`${curEmp.color}0A`,border:`1.5px solid ${curEmp.color}33`,flexWrap:'wrap'}}>
                      <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:`linear-gradient(135deg,${curEmp.color},${curEmp.color}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',boxShadow:`0 3px 10px ${curEmp.color}44`}}>{initials(curEmp.name||curEmp.cpf)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{curEmp.name||curEmp.cpf}</div>
                        <div style={{fontSize:11,color:T.textT}}>{curEmp.cpf} · {curEmp.marks.length} marcações · {curEmp.days.length} dias</div>
                      </div>
                      <div style={{display:'flex',gap:16,alignItems:'center'}}>
                        {[
                          {l:'Trabalhado',v:fmtMin(totMin),c:T.text},
                          {l:'Saldo período',v:(totBal>=0?'+':'')+fmtMin(totBal),c:totBal>=0?'#1A9C70':'#C04050'},
                          {l:'Banco total',v:(curEmp.totBal>=0?'+':'')+fmtMin(curEmp.totBal),c:curEmp.totBal>=0?'#1A9C70':'#C04050'},
                        ].map(({l,v,c})=>(
                          <div key={l} style={{textAlign:'center'}}>
                            <div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                            <div style={{fontSize:10,color:T.textT}}>{l}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={()=>{setBancoEmpMode('all');setBancoSearch('');}}
                        style={{background:'none',border:`1px solid ${curEmp.color}44`,borderRadius:7,cursor:'pointer',color:curEmp.color,fontSize:13,lineHeight:1,padding:'5px 10px',fontWeight:600,outline:'none'}}>×</button>
                    </div>
                  );
                })()}

                {/* Linha 3: Filtrar dias (apenas quando funcionário selecionado) */}
                {bancoEmpMode==='single'&&curEmp&&(
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',paddingTop:2,borderTop:`1px solid ${T.border}`}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',flexShrink:0,width:90}}>Ver dias:</div>
                    {[['all','Todos os dias','#1E70B5'],['negative','Apenas negativos','#C04050'],['justified','Com justificativa',T.gold]].map(([v,l,c])=>(
                      <button key={v} onClick={()=>setBancoShowFilter(v)}
                        style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:bancoShowFilter===v?700:400,background:bancoShowFilter===v?`${c}14`:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:bancoShowFilter===v?c:T.textS,border:`1.5px solid ${bancoShowFilter===v?c+'55':T.border}`,transition:'all .12s'}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:bancoShowFilter===v?c:T.border,flexShrink:0,transition:'background .12s'}}/>
                        {l}
                      </button>
                    ))}
                    {bancoShowFilter==='justified'&&(()=>{
                      const count=Object.entries(justifs).filter(([k,v])=>v?.text&&k.startsWith(curEmp.cpf+'_')).length;
                      return <span style={{fontSize:11,color:T.textT,marginLeft:4}}>{count} justificativa{count!==1?'s':''} encontrada{count!==1?'s':''}</span>;
                    })()}
                  </div>
                )}
              </div>
            </Card>

            {/* ── Visão: TODOS os funcionários ── */}
            {bancoEmpMode==='all'&&(()=>{
              const range = getBancoDateRange();
              return(
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                  <div style={{padding:'14px 20px',background:`linear-gradient(135deg,${T.goldGl},transparent)`,borderBottom:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text}}>Todos os Funcionários — {bancoFilter==='todos'?'Período completo':bancoFilter==='hoje'?'Hoje':bancoFilter==='ontem'?'Ontem':bancoFilter==='3dias'?'Últimos 3 dias':bancoFilter==='7dias'?'Últimos 7 dias':bancoFilter==='30dias'?'Últimos 30 dias':(bancoStart||bancoEnd)?`${bancoStart?fmtDate(bancoStart):'…'} — ${bancoEnd?fmtDate(bancoEnd):'…'}`:'Período completo'}</div>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                    <thead>
                      <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                        {['Funcionário','Marcações no período','Total Horas','Saldo',''].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 16px'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.slice(pageBancoAll*PG_BANCO_ALL,(pageBancoAll+1)*PG_BANCO_ALL).map(emp=>{
                        const filtDays = emp.days.filter(d=>d.date>=range.from&&d.date<=range.to);
                        const tot = filtDays.reduce((s,d)=>s+d.totalMin,0);
                        const bal = filtDays.reduce((s,d)=>s+d.balance,0);
                        const marks = filtDays.reduce((s,d)=>s+d.times.length,0);
                        return(
                          <tr key={emp.cpf}
                            onClick={()=>{setSelEmp(emp.cpf);setBancoEmpMode('single');setBancoSearch('');}}
                            style={{borderTop:`1px solid ${T.border}`,cursor:'pointer',transition:'background .12s'}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.goldGl||'rgba(0,0,0,0.03)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{padding:'12px 16px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:9}}>
                                <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                <div>
                                  <div style={{fontSize:14,fontWeight:600,color:T.text}}>{emp.name||'—'}</div>
                                  <div style={{fontSize:11,color:T.textT}}>{emp.cpf}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{padding:'12px 16px',fontSize:13,color:T.text}}>{marks} marcação{marks!==1?'es':''} em {filtDays.length} dia{filtDays.length!==1?'s':''}</td>
                            <td style={{padding:'12px 16px',fontSize:14,fontWeight:700,color:T.text}}>{fmtMin(tot)}</td>
                            <td style={{padding:'12px 16px'}}>
                              <span style={{fontSize:13,fontWeight:700,color:bal>=0?'#1A9C70':'#C04050',background:bal>=0?'rgba(26,156,112,0.10)':'rgba(192,64,80,0.10)',padding:'3px 10px',borderRadius:6}}>
                                {bal>=0?'+':''}{fmtMin(bal)}
                              </span>
                            </td>
                            <td style={{padding:'12px 16px',textAlign:'right'}}>
                              <span style={{fontSize:11,color:T.gold,fontWeight:600,display:'inline-flex',alignItems:'center',gap:3}}>
                                Ver detalhes
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pager page={pageBancoAll} total={employees.length} pageSize={PG_BANCO_ALL} onPage={p=>{setPageBancoAll(p);window.scrollTo({top:0,behavior:'smooth'});}}/>
                </Card>
              );
            })()}

            {curEmp&&bancoEmpMode==='single'&&(()=>{
              const range = getBancoDateRange();
              const filtDaysRaw = curEmp.days.filter(d=>
                bancoShowFilter==='justified'
                  ? true                              // ignora período, mostra todos com justif
                  : d.date>=range.from&&d.date<=range.to
              );
              const filtDays = filtDaysRaw.filter(d=>{
                if(bancoShowFilter==='negative') return d.balance < 0;
                if(bancoShowFilter==='justified') return !!justifs[`${curEmp.cpf}_${d.date}`]?.text;
                return true;
              });
              return(
              <>
                {/* Tabela diária */}
                {bancoShowFilter==='justified'&&(()=>{
                  const jvEntries=Object.entries(justifs).filter(([k,v])=>v?.text&&k.startsWith(curEmp.cpf+'_')).map(([k,v])=>({date:k.split('_')[1],text:v.text})).sort((a,b)=>a.date.localeCompare(b.date));
                  return jvEntries.length>0?(
                    <Card style={{padding:'14px 18px'}} elevated>
                      <div style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Todas as justificativas · {jvEntries.length}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {jvEntries.map(({date,text})=>(
                          <div key={date} style={{padding:'10px 14px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`,display:'flex',gap:12,alignItems:'flex-start'}}>
                            <div style={{flexShrink:0,minWidth:70}}>
                              <div style={{fontSize:12,fontWeight:700,color:T.gold}}>{fmtDate(date)}</div>
                              <div style={{fontSize:10,color:T.textT}}>{diaSem(date)}</div>
                            </div>
                            <div style={{flex:1,fontSize:13,color:T.text,lineHeight:1.5,borderLeft:`2px solid ${T.goldLine}55`,paddingLeft:12}}>{text}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ):null;
                })()}
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                  <div style={{padding:'14px 22px',borderBottom:`1px solid ${T.border}`,background:`linear-gradient(135deg,${T.goldGl},transparent)`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Detalhamento Diário — Banco de Horas</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{fontSize:12,color:T.textT}}>Jornada base: {fmtMin(jornada)}/dia útil</div>
                      <button onClick={()=>printBancoFiltrado(curEmp,filtDays)}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:12,fontWeight:500,background:'rgba(26,156,112,0.10)',color:'#1A9C70',border:'1px solid rgba(26,156,112,0.25)'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Baixar PDF
                      </button>
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                      <thead>
                        <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                          {['Data','Dia','Marcações','Trabalhado','Esperado','Saldo','Banco Acum.','Justificativa'].map(h=>(
                            <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const rows = [];
                          const pagedDays = filtDays.slice(pageBancoDays*PG_BANCO_DAYS,(pageBancoDays+1)*PG_BANCO_DAYS);
                          pagedDays.forEach((day, i) => {
                            const balColor = day.issues.length>0?'#C04050':day.balance>=0?'#1A9C70':T.gold;
                            const cumColor = day.cumBal>=0?'#1A9C70':'#C04050';
                            rows.push(
                              <tr key={day.date} style={{borderTop:`1px solid ${T.border}`,background:day.wknd?'rgba(85,96,200,0.05)':i%2===0?'transparent':T.surfaceSub||'rgba(0,0,0,0.01)'}}>
                                <td style={{padding:'11px 16px',fontSize:13,fontWeight:500,color:T.text}}>{fmtDate(day.date)}</td>
                                <td style={{padding:'11px 16px'}}>
                                  <span style={{fontSize:11,fontWeight:600,color:day.wknd?'#5560C8':'#1E70B5',background:day.wknd?'rgba(85,96,200,0.10)':'rgba(30,112,181,0.08)',borderRadius:5,padding:'2px 7px'}}>{diaSem(day.date)}</span>
                                </td>
                                <td style={{padding:'11px 16px'}}>
                                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                    {day.times.map((t,ti)=>(
                                      <span key={ti} style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:ti%2===0?'rgba(26,156,112,0.12)':'rgba(30,112,181,0.10)',color:ti%2===0?'#1A9C70':'#1E70B5'}}>{t}</span>
                                    ))}
                                    {day.times.length===0&&<span style={{fontSize:12,color:T.textD}}>—</span>}
                                  </div>
                                </td>
                                <td style={{padding:'11px 14px',fontSize:14,fontWeight:600,color:T.text}}>{fmtMin(day.totalMin)}</td>
                                <td style={{padding:'11px 14px',fontSize:13,color:T.textT}}>{day.wknd?'Folga':fmtMin(day.expected)}</td>
                                <td style={{padding:'11px 14px'}}>
                                  <span style={{fontSize:13,fontWeight:700,color:balColor,background:`${balColor}12`,borderRadius:6,padding:'2px 9px'}}>{day.balance>0?'+':''}{fmtMin(day.balance)}{day.issues.length>0?' ⚠':''}</span>
                                </td>
                                <td style={{padding:'11px 14px'}}>
                                  <span style={{fontSize:14,fontWeight:700,color:cumColor}}>{day.cumBal>=0?'+':''}{fmtMin(day.cumBal)}</span>
                                </td>
                                <td style={{padding:'8px 14px',minWidth:190}}>
                                  {editJust?.cpf===curEmp.cpf&&editJust?.date===day.date ? (
                                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                      <textarea value={editText} onChange={e=>setEditText(e.target.value)} placeholder="Descreva a justificativa..."
                                        style={{width:'100%',minHeight:50,padding:'5px 8px',fontSize:11,fontFamily:'var(--font-body)',borderRadius:7,border:`1.5px solid ${T.goldLine}77`,outline:'none',resize:'vertical',background:T.surface||'white',color:T.text}}/>
                                      <div style={{display:'flex',gap:4}}>
                                        <button onClick={saveJustif} style={{flex:1,padding:'4px 0',borderRadius:6,background:'#1A9C70',color:'white',border:'none',cursor:'pointer',fontSize:11,fontWeight:600}}>Salvar</button>
                                        <button onClick={()=>{setEditJust(null);setEditText('');}} style={{padding:'4px 8px',borderRadius:6,background:T.surfaceSub||'rgba(0,0,0,0.05)',color:T.textS,border:`1px solid ${T.border}`,cursor:'pointer',fontSize:11}}>✕</button>
                                      </div>
                                    </div>
                                  ):(()=>{
                                    const jk=`${curEmp.cpf}_${day.date}`;
                                    const jv=justifs[jk];
                                    return(<div style={{display:'flex',alignItems:'flex-start',gap:5}}>
                                      {jv?.text?<div style={{flex:1,fontSize:11,color:T.textS,padding:'3px 7px',background:`${T.gold}10`,borderRadius:5,border:`1px solid ${T.gold}33`,lineHeight:1.4}}>✓ {jv.text}{jv.autor?<div style={{fontSize:9,color:T.textD,marginTop:2}}>— {jv.autor}</div>:null}</div>:<span style={{fontSize:11,color:T.textD}}>—</span>}
                                      {isAdmin&&<button onClick={()=>{setEditJust({cpf:curEmp.cpf,date:day.date});setEditText(jv?.text||'');}}
                                        style={{flexShrink:0,padding:'3px 8px',borderRadius:5,background:T.goldGl,color:T.gold,border:`1px solid ${T.goldLine}44`,cursor:'pointer',fontSize:10,fontWeight:600,outline:'none'}}>
                                        {jv?.text?'Editar':'Justificar'}
                                      </button>}
                                    </div>);
                                  })()}
                                </td>
                              </tr>
                            );
                          });
                          // Subtotal único de TODOS os dias do filtro (não por semana)
                          const totMinAll = filtDays.reduce((s,d)=>s+d.totalMin,0);
                          const totBalAll = filtDays.reduce((s,d)=>s+d.balance,0);
                          const totExpAll = jornada*filtDays.filter(d=>!d.wknd).length;
                          const lastCum   = filtDays.length?filtDays[filtDays.length-1].cumBal:0;
                          rows.push(
                            <tr key="total-all" style={{background:T.goldGl,borderTop:`2px solid ${T.goldLine}55`,borderBottom:`2px solid ${T.goldLine}55`}}>
                              <td colSpan={3} style={{padding:'9px 14px',fontSize:12.5,fontWeight:800,color:T.gold}}>★ Subtotal — todos os dias ({filtDays.length} dia{filtDays.length!==1?'s':''})</td>
                              <td style={{padding:'9px 14px',fontSize:13,fontWeight:700,color:T.text}}>{fmtMin(totMinAll)}</td>
                              <td style={{padding:'9px 14px',fontSize:13,color:T.textT}}>{fmtMin(totExpAll)}</td>
                              <td style={{padding:'9px 14px',fontSize:13,fontWeight:800,color:totBalAll>=0?'#1A9C70':'#C04050'}}>{totBalAll>=0?'+':''}{fmtMin(totBalAll)}</td>
                              <td style={{padding:'9px 14px',fontSize:13,fontWeight:800,color:lastCum>=0?'#1A9C70':'#C04050'}}>{lastCum>=0?'+':''}{fmtMin(lastCum)}</td>
                              <td/>
                            </tr>
                          );
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <Pager page={pageBancoDays} total={filtDays.length} pageSize={PG_BANCO_DAYS} onPage={p=>{setPageBancoDays(p);window.scrollTo({top:0,behavior:'smooth'});}}/>
                </Card>
              </>
              );
            })()}
          </div>
        )}

        {/* ════════════
            TAB: CALENDÁRIO
        ════════════ */}
        {tab==='calendario'&&(()=>{
          const monthStr = calDates[Math.max(0,Math.min(calIdx,calDates.length-1))];
          if (!monthStr) return <Card style={{padding:40,textAlign:'center'}}><div style={{color:T.textT}}>Sem dados.</div></Card>;
          const [cy,cm] = monthStr.split('-').map(Number);
          const monthLabel = new Date(cy,cm-1,1).toLocaleString('pt-BR',{month:'long',year:'numeric'});
          const firstDay = new Date(cy,cm-1,1).getDay();
          const daysInMonth = new Date(cy,cm,0).getDate();
          const cells = [];
          for (let i=0;i<firstDay;i++) cells.push(null);
          for (let d=1;d<=daysInMonth;d++) cells.push(d);
          while (cells.length%7!==0) cells.push(null);

          return(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <SecHead title="Calendário" sub="Clique em um dia para ver todas as marcações · verde, laranja e vermelho por status"/>
              {/* Filtro de funcionários no calendário */}
              <Card style={{padding:'12px 16px',overflow:'visible'}} elevated>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
                  {/* Busca */}
                  <div style={{position:'relative',flex:'0 0 220px'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',zIndex:1}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input value={calSearch} onChange={e=>setCalSearch(e.target.value)}
                      placeholder="Filtrar por nome..."
                      style={{paddingLeft:27,paddingRight:10,paddingTop:6,paddingBottom:6,border:`1.5px solid ${calSearch?T.goldLine+'88':T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface,outline:'none',width:'100%',transition:'border-color .15s'}}/>
                    {/* Dropdown de seleção */}
                    {calSearch.trim()&&(()=>{
                      const matches=employees.filter(e=>(e.name||'').toLowerCase().includes(calSearch.toLowerCase())||e.cpf.includes(calSearch));
                      return(
                        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:T.surface,border:`1.5px solid ${T.goldLine}66`,borderRadius:9,overflow:'hidden',boxShadow:`0 8px 24px rgba(0,0,0,0.14)`,zIndex:9999}}>
                          {matches.length===0
                            ? <div style={{padding:'8px 12px',fontSize:12,color:T.textT}}>Nenhum resultado</div>
                            : matches.map(emp=>(
                              <div key={emp.cpf} onClick={()=>{
                                setCalFilterEmps(prev=>prev.includes(emp.cpf)?prev:[...prev,emp.cpf]);
                                setCalSearch('');
                              }} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',cursor:'pointer',transition:'background .1s',opacity:calFilterEmps.includes(emp.cpf)?0.4:1}}
                                onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                <div style={{width:22,height:22,borderRadius:6,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                <span style={{fontSize:12,fontWeight:500,color:T.text}}>{emp.name||emp.cpf}</span>
                                {calFilterEmps.includes(emp.cpf)&&<span style={{fontSize:10,color:'#1A9C70',marginLeft:'auto'}}>✓ selecionado</span>}
                              </div>
                            ))
                          }
                        </div>
                      );
                    })()}
                  </div>
                  {/* Chips dos selecionados */}
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,flex:1,alignItems:'center'}}>
                    {calFilterEmps.length===0
                      ? <span style={{fontSize:12,color:T.textT,fontStyle:'italic'}}>Todos os funcionários — clique na busca para filtrar</span>
                      : <>
                        {calFilterEmps.map(cpf=>{
                          const emp=employees.find(e=>e.cpf===cpf);
                          if(!emp) return null;
                          return(
                            <div key={cpf} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:7,background:`${emp.color}14`,border:`1.5px solid ${emp.color}44`}}>
                              <div style={{width:16,height:16,borderRadius:4,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                              <span style={{fontSize:11,fontWeight:600,color:emp.color}}>{emp.name||cpf}</span>
                              <button onClick={()=>setCalFilterEmps(prev=>prev.filter(c=>c!==cpf))} style={{background:'none',border:'none',cursor:'pointer',color:emp.color,fontSize:13,lineHeight:1,padding:0,marginLeft:1}}>×</button>
                            </div>
                          );
                        })}
                        <button onClick={()=>setCalFilterEmps([])} style={{fontSize:11,color:T.textD,background:'none',border:`1px solid ${T.border}`,borderRadius:6,padding:'2px 8px',cursor:'pointer',outline:'none'}}>Limpar</button>
                      </>
                    }
                  </div>
                </div>
              </Card>
              <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                {/* ── Calendário (lado esquerdo) ── */}
                <div style={{flex:'0 0 auto',width:'min(520px,100%)'}}>
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
              <div style={{padding:'14px 22px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,${T.goldGl},transparent)`}}>
                <button onClick={()=>setCalIdx(Math.max(0,calIdx-1))} disabled={calIdx===0}
                  style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:calIdx===0?'not-allowed':'pointer',color:T.textS,display:'flex',alignItems:'center',justifyContent:'center',outline:'none',opacity:calIdx===0?0.3:1}}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </button>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <svg width="10" height="10" viewBox="0 0 14 14" style={{animation:'starPulse 2s ease-in-out infinite'}}>
                    <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z" fill={T.goldV}/>
                  </svg>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:16,fontWeight:700,color:T.text,textTransform:'capitalize',letterSpacing:'.04em'}}>{monthLabel}</div>
                  <svg width="10" height="10" viewBox="0 0 14 14" style={{animation:'starPulse 2s ease-in-out infinite',animationDelay:'.5s'}}>
                    <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z" fill={T.goldV}/>
                  </svg>
                </div>
                <button onClick={()=>setCalIdx(Math.min(calDates.length-1,calIdx+1))} disabled={calIdx===calDates.length-1}
                  style={{width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:calIdx===calDates.length-1?'not-allowed':'pointer',color:T.textS,display:'flex',alignItems:'center',justifyContent:'center',outline:'none',opacity:calIdx===calDates.length-1?0.3:1}}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </button>
              </div>
              {/* Header dias da semana — blob verde */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',position:'relative',overflow:'hidden',background:'#1A9C70'}}>
                <div style={{position:'absolute',width:100,height:100,borderRadius:'50%',background:'#0f7a56',filter:'blur(25px)',opacity:0.5,top:'-40px',left:'15%',animation:'hdrBlob1 5s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',background:'#2dd4a0',filter:'blur(20px)',opacity:0.45,top:'-20px',left:'65%',animation:'hdrBlob2 7s ease-in-out infinite'}}/>
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>(
                  <div key={d} style={{padding:'7px 0',textAlign:'center',fontSize:11,fontWeight:700,color:'white',letterSpacing:'.05em',position:'relative',zIndex:1}}>{d}</div>
                ))}
              </div>
              {/* Grid de dias */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:0}}>
                {cells.map((day,i)=>{
                  if (day===null) return <div key={i} style={{minHeight:80,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.015)'}}/>;
                  const dateStr = `${cy}-${String(cm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const count = calData[dateStr]?.count||0;
                  const hasOdd   = calData[dateStr]?.hasOdd||false;
                  const hasTwins = calData[dateStr]?.hasTwins||false;
                  const wknd = isWknd_p(dateStr);
                  const hasMarks = count>0;
                  const isSelected = calSelDay === dateStr;
                  const cellColor = hasOdd ? '#C04050' : hasTwins ? '#D89030' : hasMarks ? '#1A9C70' : null;
                  // Animated gradient backgrounds for green/red
                  const animBg = hasOdd
                    ? 'linear-gradient(270deg,#C04050,#e06070,#C04050)'
                    : hasTwins
                    ? 'linear-gradient(270deg,#D89030,#f0b050,#D89030)'
                    : hasMarks
                    ? 'linear-gradient(270deg,#1A9C70,#2dd4a0,#1A9C70)'
                    : null;
                  return(
                    <div key={i} onClick={()=>{if(hasMarks){setCalSelDay(isSelected?null:dateStr);setCalPage(0);}}}
                      style={{minHeight:56,borderRight:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,
                        padding:'5px 7px',cursor:hasMarks?'pointer':'default',
                        background: isSelected
                          ? (hasOdd?'rgba(192,64,80,0.18)':hasTwins?'rgba(216,144,48,0.18)':'rgba(26,156,112,0.18)')
                          : (hasOdd?'rgba(192,64,80,0.07)':hasTwins?'rgba(216,144,48,0.07)':hasMarks?(wknd?'rgba(85,96,200,0.07)':'rgba(26,156,112,0.06)'):(wknd?'rgba(85,96,200,0.03)':'transparent')),
                        borderTop: isSelected ? `3px solid ${cellColor||'#ccc'}` : hasOdd?'3px solid #C04050':hasTwins?'3px solid #D89030':hasMarks?'3px solid #1A9C70':'none',
                        outline: isSelected ? `2px solid ${cellColor||'#1A9C70'}` : 'none',
                        transition:'all .15s'}}>
                      <div style={{fontSize:12,fontWeight:hasMarks?700:400,color:isSelected?(cellColor||'#1A9C70'):cellColor||(wknd?'#5560C8':T.textT),marginBottom:4}}>
                        {String(day).padStart(2,'0')}
                      </div>
                      {hasMarks&&(
                        <div>
                          <div style={{
                            fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,display:'inline-block',color:'white',
                            background:animBg,backgroundSize:'200% 200%',
                            animation:hasMarks?'blobGrad 3s ease infinite':'none'}}>
                            {count} {count===1?'batida':'batidas'}
                          </div>
                          {hasOdd&&<div style={{color:'#C04050',fontWeight:700,fontSize:10,marginTop:2}}>⚠ Incompleto</div>}
                          {!hasOdd&&hasTwins&&<div style={{color:'#D89030',fontSize:10,marginTop:2}}>⚡ Gêmea</div>}
                          {!hasOdd&&!hasTwins&&<div style={{color:'#1A9C70',fontSize:10,marginTop:2}}>✓ {Math.floor(count/2)} par{Math.floor(count/2)!==1?'es':''}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legenda */}
            <div style={{padding:'8px 16px',borderTop:`1px solid ${T.border}`,display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}>
              {[{c:'#1A9C70',l:'Completo'},{c:'#D89030',l:'Gêmea'},{c:'#C04050',l:'Incompleto'},{c:'#5560C8',l:'Fim de semana'}].map(({c,l})=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:10,height:3,borderRadius:2,background:c}}/>
                  <span style={{fontSize:10,color:T.textT}}>{l}</span>
                </div>
              ))}
              {!calSelDay&&<span style={{fontSize:10,color:T.textT,marginLeft:'auto',fontStyle:'italic'}}>Clique em um dia para ver detalhes →</span>}
            </div>
          </Card>
                </div>

                {/* ── Detalhe do dia (lado direito) ── */}
                <div style={{flex:1,minWidth:0}}>
                {(()=>{
                  if (!calSelDay) return (
                    <div style={{height:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,color:T.textD,fontSize:13,opacity:0.6}}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 5l7 7-7 7"/></svg>
                      Clique em um dia no calendário
                    </div>
                  );
                  const dayEmpsRaw = employees
                    .filter(emp=>calFilterEmps.length===0||calFilterEmps.includes(emp.cpf))
                    .map(emp=>{
                    const d = emp.days.find(x=>x.date===calSelDay);
                    return d&&d.times.length>0 ? {emp,day:d} : null;
                  }).filter(Boolean);
                  // Ordenação
                  const dayEmps = [...dayEmpsRaw].sort((a,b)=>{
                    if(calDaySort==='az')       return (a.emp.name||a.emp.cpf).localeCompare(b.emp.name||b.emp.cpf);
                    if(calDaySort==='ok')       return a.day.issues.length - b.day.issues.length;
                    if(calDaySort==='negative') return a.day.balance - b.day.balance;
                    if(calDaySort==='positive') return b.day.balance - a.day.balance;
                    return 0;
                  });
                  const PAGE_SIZE = 8;
                  const totalPages = Math.max(1,Math.ceil(dayEmps.length/PAGE_SIZE));
                  const safePage = Math.min(calPage, totalPages-1);
                  const pageEmps = dayEmps.slice(safePage*PAGE_SIZE, (safePage+1)*PAGE_SIZE);
                  return(
                    <Card style={{padding:0,overflow:'hidden',height:'100%'}} elevated>
                      <div style={{padding:'12px 16px',background:`linear-gradient(135deg,${T.goldGl},transparent)`,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div>
                          <div style={{fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>
                            {fmtDate(calSelDay)} — {diaSem(calSelDay)}
                          </div>
                          <div style={{fontSize:11,color:T.textT,marginTop:1}}>{dayEmps.length} funcionário{dayEmps.length!==1?'s':''} com marcações{calFilterEmps.length>0?` · ${calFilterEmps.length} filtrado${calFilterEmps.length>1?'s':''}`:''}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <button onClick={()=>printCalDia(calSelDay,dayEmps)}
                            style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,fontWeight:500,background:'rgba(26,156,112,0.10)',color:'#1A9C70',border:'1px solid rgba(26,156,112,0.25)'}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            PDF
                          </button>
                          <button onClick={()=>setCalSelDay(null)}
                            style={{width:24,height:24,borderRadius:7,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.04)',cursor:'pointer',color:T.textS,display:'flex',alignItems:'center',justifyContent:'center',outline:'none',fontSize:15}}>×</button>
                        </div>
                      </div>
                      {dayEmps.length===0
                        ? <div style={{padding:24,textAlign:'center',color:T.textT,fontSize:13}}>Nenhuma marcação neste dia.</div>
                        : <>
                          {/* Barra de ordenação */}
                          <div style={{padding:'8px 12px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                            <span style={{fontSize:10,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',marginRight:4}}>Ordenar:</span>
                            {[['az','A → Z','#1E70B5'],['ok','Ponto OK','#1A9C70'],['negative','Saldo −','#C04050'],['positive','Saldo +','#1A9C70']].map(([v,l,c])=>(
                              <button key={v} onClick={()=>setCalDaySort(v)}
                                style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,fontWeight:calDaySort===v?700:400,background:calDaySort===v?`${c}18`:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:calDaySort===v?c:T.textS,border:`1.5px solid ${calDaySort===v?c+'55':T.border}`,transition:'all .12s'}}>
                                {l}
                              </button>
                            ))}
                          </div>
                          <div style={{overflowY:'auto',maxHeight:360}}>
                            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                              <thead>
                                <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                                  {['Funcionário','Marcações','Total','Saldo','Observação'].map(h=>(
                                    <th key={h} style={{textAlign:'left',fontSize:10,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'7px 12px',position:'sticky',top:0,background:T.surface}}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pageEmps.map(({emp,day})=>{
                                  const jKey=`${emp.cpf}_${calSelDay}`;
                                  const jv=justifs[jKey];
                                  const hasIssue=day.issues.length>0;
                                  return(
                                  <tr key={emp.cpf} style={{borderTop:`1px solid ${T.border}`,background:hasIssue?'rgba(192,64,80,0.03)':'transparent'}}>
                                    <td style={{padding:'9px 12px'}}>
                                      <div style={{display:'flex',alignItems:'center',gap:7}}>
                                        <div style={{width:26,height:26,borderRadius:7,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                                        <div>
                                          <div style={{fontSize:12,fontWeight:600,color:T.text}}>{emp.name||'—'}</div>
                                          <div style={{fontSize:9,color:T.textT}}>{emp.cpf}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{padding:'9px 12px'}}>
                                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                                        {day.pairs.map((pair,pi)=>(
                                          <div key={pi} style={{display:'flex',alignItems:'center',gap:2}}>
                                            {pi>0&&<span style={{color:T.textD,fontSize:9}}>·</span>}
                                            <span style={{fontSize:11,fontWeight:700,color:'#1A9C70',background:'rgba(26,156,112,0.10)',padding:'1px 5px',borderRadius:4}}>{pair.entry}</span>
                                            {pair.exit&&<><span style={{color:T.textD,fontSize:9}}>→</span><span style={{fontSize:11,fontWeight:700,color:'#1E70B5',background:'rgba(30,112,181,0.10)',padding:'1px 5px',borderRadius:4}}>{pair.exit}</span></>}
                                            {!pair.exit&&<span style={{fontSize:10,color:'#C04050',background:'rgba(192,64,80,0.08)',padding:'1px 5px',borderRadius:4}}>✗</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                    <td style={{padding:'9px 12px',fontSize:12,fontWeight:700,color:T.text,whiteSpace:'nowrap'}}>{fmtMin(day.totalMin)}</td>
                                    <td style={{padding:'9px 12px'}}>
                                      <span style={{fontSize:11,fontWeight:700,color:day.balance>=0?'#1A9C70':'#C04050',background:day.balance>=0?'rgba(26,156,112,0.10)':'rgba(192,64,80,0.10)',padding:'2px 7px',borderRadius:5}}>
                                        {day.balance>=0?'+':''}{fmtMin(day.balance)}
                                      </span>
                                    </td>
                                    <td style={{padding:'9px 12px',maxWidth:160}}>
                                      {jv?.text
                                        ? <div style={{fontSize:11,color:T.textS,background:`${T.gold}10`,border:`1px solid ${T.gold}33`,borderRadius:6,padding:'3px 8px',lineHeight:1.4,display:'flex',gap:5,alignItems:'flex-start'}}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" style={{marginTop:1,flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            {jv.text}
                                          </div>
                                        : <span style={{fontSize:10,color:T.textD}}>—</span>
                                      }
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {totalPages>1&&(
                            <div style={{padding:'8px 12px',borderTop:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                              <button onClick={()=>setCalPage(p=>Math.max(0,p-1))} disabled={safePage===0}
                                style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:safePage===0?'not-allowed':'pointer',color:T.textS,fontSize:11,outline:'none',opacity:safePage===0?0.4:1}}>← Anterior</button>
                              <span style={{fontSize:11,color:T.textT}}>Pág {safePage+1}/{totalPages}</span>
                              <button onClick={()=>setCalPage(p=>Math.min(totalPages-1,p+1))} disabled={safePage===totalPages-1}
                                style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.surfaceSub||'rgba(0,0,0,0.03)',cursor:safePage===totalPages-1?'not-allowed':'pointer',color:T.textS,fontSize:11,outline:'none',opacity:safePage===totalPages-1?0.4:1}}>Próxima →</button>
                            </div>
                          )}
                        </>
                      }
                    </Card>
                  );
                })()}
                </div>
              </div>
            </div>
          );
          })()}

        {/* ════════════
            TAB: LINHA A LINHA
        ════════════ */}
        {tab==='linhaLinha'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Linha a Linha" sub="Auditoria completa de todos os registros do arquivo AFD"/>
          <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
            <div style={{padding:'12px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text,flex:1,minWidth:120}}>Registros do AFD</div>
              {/* Filtro de data */}
              <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                {[['hoje','Hoje'],['3dias','3 dias'],['7dias','7 dias'],['30dias','30 dias'],['todos','Todos'],['custom','Período']].map(([v,l])=>(
                  <button key={v} onClick={()=>setLineDate(v)}
                    style={{padding:'5px 10px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,fontWeight:lineDate===v?700:400,background:lineDate===v?T.goldGl:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:lineDate===v?T.gold:T.textS,border:`1.5px solid ${lineDate===v?T.goldLine+'55':T.border}`,transition:'all .12s'}}>
                    {l}
                  </button>
                ))}
                {lineDate==='custom'&&(
                  <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:2}}>
                    <input type="date" value={lineStart} max={lineEnd||undefined} onChange={e=>setLineStart(e.target.value)}
                      style={{padding:'5px 8px',border:`1px solid ${T.border}`,borderRadius:7,fontFamily:'var(--font-body)',fontSize:11,color:T.text,background:T.surface||'white',outline:'none'}}/>
                    <span style={{fontSize:11,color:T.textD}}>até</span>
                    <input type="date" value={lineEnd} min={lineStart||undefined} onChange={e=>setLineEnd(e.target.value)}
                      style={{padding:'5px 8px',border:`1px solid ${T.border}`,borderRadius:7,fontFamily:'var(--font-body)',fontSize:11,color:T.text,background:T.surface||'white',outline:'none'}}/>
                    {(lineStart||lineEnd)&&(
                      <button onClick={()=>{setLineStart('');setLineEnd('');}}
                        style={{padding:'5px 8px',borderRadius:7,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:11,color:T.textD,background:'transparent',border:`1px solid ${T.border}`}}>
                        Limpar
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Busca */}
              <div style={{position:'relative'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={lineSearch} onChange={e=>setLineSearch(e.target.value)} placeholder="Buscar nome ou CPF..."
                  style={{paddingLeft:28,paddingRight:10,paddingTop:6,paddingBottom:6,border:`1px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none',width:180}}/>
              </div>
              {/* Filtro de tipo */}
              <select value={lineType} onChange={e=>setLineType(e.target.value)}
                style={{padding:'6px 8px',border:`1px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:12,color:T.text,background:T.surface||'white',outline:'none',cursor:'pointer'}}>
                <option value="all">Todos os tipos</option>
                <option value="3">Marcação de Ponto</option>
                <option value="5">Cadastro</option>
                <option value="4">Ajuste de Data/Hora</option>
                <option value="other">Eventos do Sistema</option>
              </select>
              <Tag color={T.blue} style={{fontSize:11}}>{rawRecs.filter(r=>{
                const rDate=r.date?new Date(r.date+'T00:00:00'):null;
                const matchDate=matchLineDate(rDate);
                const empM=r.cpf&&r.cpf!=='—'?employees.find(e=>e.cpf===r.cpf):null;
                const nm=empM?.name||r.nome||'';
                const matchSearch=!lineSearch||(nm.toLowerCase().includes(lineSearch.toLowerCase())||r.cpf?.includes(lineSearch));
                const matchType=lineType==='all'||(lineType==='other'?!['3','4','5'].includes(r.tipo):r.tipo===lineType);
                return matchDate&&matchSearch&&matchType;
              }).length} registros</Tag>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                <thead>
                  <tr style={{background:T.surfaceSub||'rgba(0,0,0,0.03)'}}>
                    {['#','NSR','Data','Hora','PIS/CPF','Nome','Tipo de Registro','Observação'].map(h=>(
                      <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px',whiteSpace:'nowrap',background:T.surface,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(()=>{
                    const allFiltered = rawRecs.filter(rec=>{
                      const rDate2=rec.date?new Date(rec.date+'T00:00:00'):null;
                      const matchDate=matchLineDate(rDate2);
                      const emp=rec.cpf&&rec.cpf!=='—'?employees.find(e=>e.cpf===rec.cpf):null;
                      const nm=emp?.name||rec.nome||'';
                      const matchSearch=!lineSearch||(nm.toLowerCase().includes(lineSearch.toLowerCase())||rec.cpf?.includes(lineSearch));
                      const matchType=lineType==='all'||(lineType==='other'?!['3','4','5'].includes(rec.tipo):rec.tipo===lineType);
                      return matchDate&&matchSearch&&matchType;
                    });
                    return allFiltered.slice(pageLinha*PG_LINHA,(pageLinha+1)*PG_LINHA).map((rec,i)=>{
                    const absIdx = pageLinha*PG_LINHA + i;
                    const emp = rec.cpf&&rec.cpf!=='—' ? employees.find(e=>e.cpf===rec.cpf) : null;
                    const name = emp?.name || (rec.nome||'');
                    const tipoColor = rec.tipo==='3'?'#1A9C70':rec.tipo==='5'?'#1E70B5':rec.tipo==='4'?T.gold:'#9AA8B8';
                    const jvLine = rec.tipo==='3'&&rec.cpf&&rec.cpf!=='—'&&rec.date ? justifs[`${rec.cpf}_${rec.date}`] : null;
                    return(
                      <tr key={i} style={{borderTop:`1px solid ${T.border}`,background:i%2===0?'transparent':(T.surfaceSub||'rgba(0,0,0,0.015)')}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.03)'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'transparent':(T.surfaceSub||'rgba(0,0,0,0.015)')}>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textD,fontWeight:500}}>{absIdx+1}</td>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textT,fontFamily:'monospace'}}>{rec.nsr}</td>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textS}}>{rec.date?fmtDate(rec.date):'—'}</td>
                        <td style={{padding:'9px 14px',fontSize:13,fontWeight:600,color:T.text}}>{rec.time||'—'}</td>
                        <td style={{padding:'9px 14px',fontSize:12,color:T.textS,fontFamily:'monospace'}}>{rec.cpf&&rec.cpf!=='—'?rec.cpf:'—'}</td>
                        <td style={{padding:'9px 14px'}}>
                          {emp?(
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <div style={{width:24,height:24,borderRadius:6,background:`linear-gradient(135deg,${emp.color},${emp.color}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff',flexShrink:0}}>{initials(emp.name||emp.cpf)}</div>
                              <span style={{fontSize:13,fontWeight:500,color:emp.name?T.text:'#C04050'}}>{emp.name||emp.cpf}</span>
                            </div>
                          ):(name?<span style={{fontSize:12,color:T.textS}}>{name}</span>:<span style={{fontSize:11,color:T.textD}}>—</span>)}
                        </td>
                        <td style={{padding:'9px 14px'}}>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:5,background:`${tipoColor}14`,color:tipoColor}}>{rec.label}</span>
                        </td>
                        <td style={{padding:'9px 14px',maxWidth:180}}>
                          {jvLine?.text
                            ? <div style={{fontSize:11,color:T.textS,background:`${T.gold}10`,border:`1px solid ${T.gold}33`,borderRadius:6,padding:'3px 8px',lineHeight:1.4,display:'flex',gap:5,alignItems:'flex-start'}}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" style={{marginTop:2,flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                {jvLine.text}
                              </div>
                            : <span style={{fontSize:10,color:T.textD}}>—</span>
                          }
                        </td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            {(()=>{
              const total=rawRecs.filter(rec=>{
                const rDate=rec.date?new Date(rec.date+'T00:00:00'):null;
                const matchDate=matchLineDate(rDate);
                const emp=rec.cpf&&rec.cpf!=='—'?employees.find(e=>e.cpf===rec.cpf):null;
                const nm=emp?.name||rec.nome||'';
                const matchSearch=!lineSearch||(nm.toLowerCase().includes(lineSearch.toLowerCase())||rec.cpf?.includes(lineSearch));
                const matchType=lineType==='all'||(lineType==='other'?!['3','4','5'].includes(rec.tipo):rec.tipo===lineType);
                return matchDate&&matchSearch&&matchType;
              }).length;
              return <Pager page={pageLinha} total={total} pageSize={PG_LINHA} onPage={p=>{setPageLinha(p);window.scrollTo({top:0,behavior:'smooth'});}}/>;
            })()}
          </Card>
          </div>
        )}

        {/* ════════════
            TAB: INCONSISTÊNCIAS
        ════════════ */}
        {tab==='issues'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <SecHead title="Inconsistências" sub="Marcações irregulares detectadas automaticamente"/>
            {totalIssues===0?(
              <Card style={{padding:'60px',textAlign:'center'}} elevated>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="1.3" strokeLinecap="round" style={{margin:'0 auto 20px',display:'block'}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:10}}>Sem inconsistências detectadas</div>
                <div style={{fontSize:15,color:T.textT}}>Todos os registros de ponto estão em conformidade.</div>
              </Card>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{padding:'16px 20px',borderRadius:14,background:T.surface||'white',border:'2px solid #C04050',boxShadow:`0 4px 16px rgba(192,64,80,0.15)`,display:'flex',alignItems:'center',gap:14}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C04050" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:'#C04050'}}>{totalIssues} inconsistência{totalIssues>1?'s':''} encontrada{totalIssues>1?'s':''}</div>
                    <div style={{fontSize:12,color:T.textS,marginTop:2}}>Verifique os registros abaixo e corrija no sistema de ponto</div>
                  </div>
                </div>
                {(()=>{
                  const empWithIssues = employees.filter(e=>e.totIssues>0);
                  const pagedEmps = empWithIssues.slice(pageIssues*PG_ISSUES,(pageIssues+1)*PG_ISSUES);
                  return(<>
                    {pagedEmps.map(emp=>(
                  <Card key={emp.cpf} style={{padding:'18px 22px'}} elevated>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`linear-gradient(135deg,${emp.color},${emp.color}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff'}}>{initials(emp.name||emp.cpf)}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:emp.name?T.text:'#C04050'}}>{emp.name||emp.cpf}</div>
                        <div style={{fontSize:11,color:T.textT}}>{emp.cpf} · {emp.totIssues} inconsistência{emp.totIssues>1?'s':''}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {emp.days.filter(d=>d.issues.length>0).map(day=>{
                        const jvIss = justifs[`${emp.cpf}_${day.date}`];
                        return(
                        <div key={day.date} style={{borderRadius:10,padding:'12px 16px',background:jvIss?.text?'rgba(212,160,0,0.06)':'rgba(192,64,80,0.06)',border:`1px solid ${jvIss?.text?T.goldLine+'44':'rgba(192,64,80,0.20)'}`}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:13,fontWeight:600,color:T.text}}>{fmtDate(day.date)}</span>
                              <Tag color={T.blue} style={{fontSize:10,padding:'1px 7px'}}>{diaSem(day.date)}</Tag>
                            </div>
                            <span style={{fontSize:12,color:T.textS}}>{fmtMin(day.totalMin)} trabalhadas</span>
                          </div>
                          {day.issues.map((iss,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:'#C04050',marginBottom:i<day.issues.length-1?4:0}}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              {iss}
                            </div>
                          ))}
                          <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:5}}>
                            {day.times.map((t,ti)=>(<span key={ti} style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:5,background:`${T.gold}14`,border:`1px solid ${T.gold}30`,color:T.gold}}>{t}</span>))}
                          </div>
                          {/* Observação/Justificativa */}
                          {jvIss?.text
                            ? <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:`${T.gold}10`,border:`1.5px solid ${T.gold}44`,display:'flex',gap:8,alignItems:'flex-start'}}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" style={{marginTop:1,flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <div>
                                  <div style={{fontSize:10,fontWeight:600,color:T.gold,marginBottom:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Observação do RH</div>
                                  <div style={{fontSize:12,color:T.textS,lineHeight:1.5}}>{jvIss.text}</div>
                                </div>
                              </div>
                            : <div style={{marginTop:8,display:'flex',alignItems:'center',gap:5,fontSize:11,color:T.textD,opacity:0.6}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Sem observação — adicione via Banco de Horas
                              </div>
                          }
                        </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
                    <Pager page={pageIssues} total={empWithIssues.length} pageSize={PG_ISSUES} onPage={p=>{setPageIssues(p);window.scrollTo({top:0,behavior:'smooth'});}}/>
                  </>);
                })()}
              </div>
            )}
          </div>
        )}

      </div>
      </div>
    </div>
  );
};
/* ── fim PontoEletronico ── */

export default PontoEletronico;
