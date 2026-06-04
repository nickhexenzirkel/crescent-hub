import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { T } from '../../../contexts/theme';
import { SERVER_URL } from '../../../contexts/user';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const CURRENT_YEAR = new Date().getFullYear();
const ANOS = Array.from({length:5}, (_, i) => CURRENT_YEAR - i);

/* ── Helpers ─────────────────────────────────────────────── */
const readXLSX = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      resolve(rows);
    } catch (err) { reject(err); }
  };
  reader.readAsArrayBuffer(file);
});

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

const detectSecretariaCol = (headers) => {
  const h = headers.map(norm);
  // Prioridade: coluna "Cliente" (formato: "30 - CIDADE - SECRETARIA - MUNICIPIO")
  const clienteIdx = h.findIndex(c => c === 'cliente');
  if (clienteIdx >= 0) return clienteIdx;
  // Fallback: outros termos comuns
  const terms = ['secretaria','orgao','orgão','setor','departamento'];
  return h.findIndex(col => terms.some(t => col.includes(t)));
};

// Extrai nome da secretaria do padrão: "30 - CIDADE - SECRETARIA - MUNICIPIO DE X"
const extractSecretaria = (clienteStr) => {
  const parts = String(clienteStr).split(' - ');
  if (parts.length >= 3) return parts[2].trim();
  return String(clienteStr).trim();
};

/* ── Drop Zone ────────────────────────────────────────────── */
const DropZoneXLSX = ({ onFile, label, accept = '.xlsx,.xls' }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handle = useCallback((files) => {
    const f = files.find(f => /\.(xlsx|xls)$/i.test(f.name));
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle([...e.dataTransfer.files]); }}
      style={{
        border:`2px dashed ${drag ? T.gold : T.border}`,
        borderRadius:12,padding:'28px 24px',textAlign:'center',cursor:'pointer',
        background:drag ? T.goldGl : T.surface,transition:'all .18s',
      }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:10}}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
      <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:4}}>{label}</div>
      <div style={{fontSize:12,color:T.textT}}>Aceita .xlsx e .xls</div>
      <input ref={inputRef} type="file" accept={accept} style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) handle([e.target.files[0]]); }}/>
    </div>
  );
};

/* ── Section header ───────────────────────────────────────── */
const Section = ({n, title, done, children}) => (
  <div style={{marginBottom:28}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
      <div style={{width:28,height:28,borderRadius:'50%',
        background:done?T.gold:T.goldGl,border:`2px solid ${done?T.gold:T.gold+'44'}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:12,fontWeight:700,color:done?'#fff':T.gold,flexShrink:0,
        transition:'all .2s'}}>
        {done
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          : n}
      </div>
      <span style={{fontSize:15,fontWeight:600,color:T.text}}>{title}</span>
    </div>
    <div style={{paddingLeft:40}}>{children}</div>
  </div>
);

/* ── Log area ─────────────────────────────────────────────── */
const Log = ({lines}) => {
  const ref = useRef();
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{
      background:'#0D1117',borderRadius:10,padding:'16px',height:220,
      overflowY:'auto',fontFamily:'monospace',fontSize:12.5,lineHeight:1.7,
      border:`1px solid ${T.border}`,
    }}>
      {lines.length === 0
        ? <span style={{color:'#4A5568'}}>// aguardando início...</span>
        : lines.map((l,i) => (
          <div key={i} style={{color: l.type==='error'?'#FC8181':l.type==='ok'?'#68D391':l.type==='info'?'#90CDF4':'#CBD5E0'}}>
            {l.text}
          </div>
        ))}
    </div>
  );
};

/* ── Main Tab ─────────────────────────────────────────────── */
export const TabRelatorioConsumo = () => {
  const [mainFile, setMainFile]       = useState(null);
  const [auxAbFile, setAuxAbFile]     = useState(null);
  const [auxManFile, setAuxManFile]   = useState(null);
  const [temSetor, setTemSetor]       = useState(false);
  const [rows, setRows]               = useState([]);
  const [headers, setHeaders]         = useState([]);
  const [colIdx, setColIdx]           = useState(-1);
  const [secretarias, setSecretarias] = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [mes, setMes]                 = useState(new Date().getMonth());
  const [ano, setAno]                 = useState(CURRENT_YEAR);
  const [outputPath, setOutputPath]   = useState('');
  const [log, setLog]                 = useState([]);
  const [running, setRunning]         = useState(false);
  const [done, setDone]               = useState(false);

  const addLog = (text, type='normal') => setLog(prev => [...prev, {text, type}]);

  const loadMainFile = async (f) => {
    setMainFile(f);
    setRows([]); setHeaders([]); setColIdx(-1); setSecretarias([]); setSelected(new Set());
    try {
      const allRows = await readXLSX(f);
      if (!allRows.length) return;
      const headerRow = allRows[0].map(c => String(c));
      setHeaders(headerRow);
      setRows(allRows);
      const auto = detectSecretariaCol(headerRow);
      if (auto >= 0) {
        setColIdx(auto);
        buildSecretarias(allRows, auto, headerRow);
      }
    } catch { addLog('Erro ao ler o arquivo XLSX.', 'error'); }
  };

  const buildSecretarias = (allRows, ci, hdrs) => {
    const isCliente = norm(hdrs?.[ci] || '') === 'cliente';
    const vals = allRows.slice(1)
      .map(r => {
        const raw = String(r[ci] || '').trim();
        return isCliente ? extractSecretaria(raw) : raw;
      })
      .filter(Boolean);
    const unique = [...new Set(vals)].sort();
    setSecretarias(unique);
    setSelected(new Set(unique));
  };

  const toggleSelect = (s) => setSelected(prev => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const startDownload = async () => {
    if (!mainFile || !selected.size) return;
    setRunning(true);
    setDone(false);
    setLog([]);
    addLog(`[${new Date().toLocaleTimeString('pt-BR')}] Iniciando download...`, 'info');
    addLog(`Mês de referência: ${MESES[mes]}/${ano}`, 'normal');
    addLog(`Secretarias selecionadas: ${selected.size}`, 'normal');
    if (outputPath) addLog(`Pasta de saída: ${outputPath}`, 'normal');
    addLog('Conectando ao servidor...', 'normal');

    try {
      const form = new FormData();
      form.append('mainFile', mainFile);
      if (temSetor && auxAbFile) form.append('auxAbFile', auxAbFile);
      if (temSetor && auxManFile) form.append('auxManFile', auxManFile);
      form.append('mes', String(mes + 1));
      form.append('ano', String(ano));
      form.append('secretarias', JSON.stringify([...selected]));
      form.append('outputPath', outputPath);

      const res = await fetch(`${SERVER_URL}/api/faturamento/consumo/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ch_token')}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addLog(`Erro do servidor: ${err.message || res.statusText}`, 'error');
        setRunning(false); return;
      }

      const { jobId } = await res.json();
      addLog(`Job criado: ${jobId}`, 'info');
      addLog('Download em andamento...', 'normal');

      const poll = setInterval(async () => {
        try {
          const s = await fetch(`${SERVER_URL}/api/faturamento/consumo/status/${jobId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('ch_token')}` },
          }).then(r => r.json());

          if (s.logs?.length) {
            s.logs.forEach(l => addLog(l.text, l.type || 'normal'));
          }
          if (s.status === 'done') {
            clearInterval(poll);
            addLog(`[${new Date().toLocaleTimeString('pt-BR')}] Concluído! ${s.total || ''} arquivo(s) baixado(s).`, 'ok');
            setRunning(false); setDone(true);
          }
          if (s.status === 'error') {
            clearInterval(poll);
            addLog(s.message || 'Erro durante o download.', 'error');
            setRunning(false);
          }
        } catch { clearInterval(poll); addLog('Perda de conexão com o servidor.','error'); setRunning(false); }
      }, 2000);

    } catch (err) {
      addLog(`Servidor não encontrado em ${SERVER_URL}. Verifique se o servidor está ativo.`, 'error');
      setRunning(false);
    }
  };

  const step1Done = !!mainFile;
  const step2Done = step1Done && secretarias.length > 0 && selected.size > 0;
  const step3Done = step2Done;

  return (
    <div>
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:6}}>Relatório de Consumo</h2>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.6}}>
          Baixa automaticamente os PDFs de Relatório de Consumo do sistema 7Benefícios para cada secretaria.
        </p>
      </div>

      {/* Step 1 — Upload */}
      <Section n={1} title="Envie o Relatório de Retenção de Tributos" done={step1Done}>
        {!mainFile
          ? <DropZoneXLSX onFile={loadMainFile} label="Relatório de retenção de tributos (.xlsx)"/>
          : (
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:12}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500,color:T.text}}>{mainFile.name}</div>
                <div style={{fontSize:12,color:T.textT}}>{secretarias.length} secretaria{secretarias.length!==1?'s':''} identificada{secretarias.length!==1?'s':''}</div>
              </div>
              <button onClick={()=>{setMainFile(null);setRows([]);setHeaders([]);setColIdx(-1);setSecretarias([]);setSelected(new Set());}}
                style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:12,fontFamily:'var(--font-body)'}}>Remover</button>
            </div>
          )}

        {/* Coluna de secretaria */}
        {mainFile && headers.length > 0 && (
          <div style={{marginTop:14,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <span style={{fontSize:13,color:T.textS}}>Coluna de secretaria:</span>
            <select
              value={colIdx}
              onChange={e => { const ci = Number(e.target.value); setColIdx(ci); if(ci>=0) buildSecretarias(rows, ci, headers); }}
              style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
              <option value={-1}>Selecionar coluna...</option>
              {headers.map((h,i) => <option key={i} value={i}>{h || `Coluna ${i+1}`}</option>)}
            </select>
          </div>
        )}

        {/* Tem setor? */}
        {mainFile && (
          <div style={{marginTop:16,display:'flex',alignItems:'center',gap:10}}>
            <input type="checkbox" id="temSetor" checked={temSetor} onChange={e=>setTemSetor(e.target.checked)}
              style={{width:16,height:16,cursor:'pointer',accentColor:T.gold}}/>
            <label htmlFor="temSetor" style={{fontSize:13,color:T.textS,cursor:'pointer'}}>
              Incluir setores (abastecimento / manutenção)
            </label>
          </div>
        )}

        {/* Arquivos auxiliares */}
        {mainFile && temSetor && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:16}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:8}}>Relatório auxiliar de abastecimento</div>
              {!auxAbFile
                ? <DropZoneXLSX onFile={setAuxAbFile} label="Auxiliar abastecimento"/>
                : (
                  <div style={{padding:'10px 14px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10,display:'flex',alignItems:'center',gap:8}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{fontSize:13,color:T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{auxAbFile.name}</span>
                    <button onClick={()=>setAuxAbFile(null)} style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:11,fontFamily:'var(--font-body)'}}>✕</button>
                  </div>
                )}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:8}}>Relatório auxiliar de manutenção</div>
              {!auxManFile
                ? <DropZoneXLSX onFile={setAuxManFile} label="Auxiliar manutenção"/>
                : (
                  <div style={{padding:'10px 14px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10,display:'flex',alignItems:'center',gap:8}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{fontSize:13,color:T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{auxManFile.name}</span>
                    <button onClick={()=>setAuxManFile(null)} style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:11,fontFamily:'var(--font-body)'}}>✕</button>
                  </div>
                )}
            </div>
          </div>
        )}
      </Section>

      {/* Step 2 — Secretarias + Config */}
      {step1Done && secretarias.length > 0 && (
        <Section n={2} title="Selecione as secretarias e configure o período" done={step3Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
            {/* Secretarias */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textS}}>{selected.size}/{secretarias.length} selecionadas</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setSelected(new Set(secretarias))}
                    style={{fontSize:12,color:T.gold,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',padding:'2px 6px'}}>Todas</button>
                  <button onClick={()=>setSelected(new Set())}
                    style={{fontSize:12,color:T.textT,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',padding:'2px 6px'}}>Nenhuma</button>
                </div>
              </div>
              <div style={{maxHeight:220,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10,background:T.surface}}>
                {secretarias.map(s => (
                  <label key={s} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <input type="checkbox" checked={selected.has(s)} onChange={()=>toggleSelect(s)}
                      style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                    <span style={{fontSize:13,color:T.text}}>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Config */}
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Mês de referência</label>
                <select value={mes} onChange={e=>setMes(Number(e.target.value))}
                  style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
                  {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Ano</label>
                <select value={ano} onChange={e=>setAno(Number(e.target.value))}
                  style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
                  {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Pasta de destino <span style={{fontWeight:400,color:T.textD}}>(opcional)</span></label>
                <input
                  value={outputPath} onChange={e=>setOutputPath(e.target.value)}
                  placeholder="Ex: C:\Relatórios\Consumo"
                  style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Step 3 — Start */}
      {step2Done && (
        <Section n={3} title="Iniciar download automático" done={done}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20,flexWrap:'wrap'}}>
            <button
              onClick={startDownload}
              disabled={running}
              style={{
                display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,
                border:'none',background:running?T.textD:T.gold,color:'#fff',
                fontSize:15,fontWeight:700,cursor:running?'not-allowed':'pointer',
                fontFamily:'var(--font-body)',transition:'all .15s',
                boxShadow:running?'none':`0 4px 16px ${T.gold}44`,
              }}>
              {running
                ? <><div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Baixando...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Iniciar Download</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Download concluído!
              </div>
            )}
          </div>
          <Log lines={log}/>
        </Section>
      )}
    </div>
  );
};
