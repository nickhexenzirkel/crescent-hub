import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { T } from '../../../contexts/theme';
import { SERVER_URL } from '../../../contexts/user';

/* ── Helpers ─────────────────────────────────────────── */
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const readXLSX = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      resolve(rows);
    } catch (err) { reject(err); }
  };
  reader.readAsArrayBuffer(file);
});

const detectClienteCol = (headers) => {
  const h = headers.map(norm);
  const clienteIdx = h.findIndex(c => c === 'cliente');
  if (clienteIdx >= 0) return clienteIdx;
  const terms = ['secretaria', 'orgao', 'orgão', 'setor', 'departamento'];
  return h.findIndex(col => terms.some(t => col.includes(t)));
};

// "30 - JAGUARETAMA - SECRETARIA DOS ESPORTES - MUNICIPIO DE X" → "SECRETARIA DOS ESPORTES"
const extractSecretaria = (clienteStr) => {
  const parts = String(clienteStr).split(' - ');
  return parts.length >= 3 ? parts[2].trim() : clienteStr.trim();
};

// "DD/MM/YYYY" from <input type="date"> "YYYY-MM-DD"
const dateToBR = (d) => {
  if (!d) return '';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
};

// Detect category from filename
const detectCategory = (filename) => {
  const n = filename.toLowerCase();
  if (n.includes('combustivel') || n.includes('abastec')) return 'fuel';
  if (n.includes('manutencao') || n.includes('manutenção')) return 'service';
  return '';
};

/* ── Drop Zone XLSX ───────────────────────────────────── */
const DropZoneXLSX = ({ onFile, label }) => {
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
      style={{border:`2px dashed ${drag?T.gold:T.border}`,borderRadius:12,padding:'28px 24px',
        textAlign:'center',cursor:'pointer',background:drag?T.goldGl:T.surface,transition:'all .18s'}}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:10}}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
      <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:4}}>{label}</div>
      <div style={{fontSize:12,color:T.textT}}>Aceita .xlsx e .xls</div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) handle([e.target.files[0]]); }}/>
    </div>
  );
};

/* ── Section header ───────────────────────────────────── */
const Section = ({ n, title, done, children }) => (
  <div style={{marginBottom:28}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
      <div style={{width:28,height:28,borderRadius:'50%',
        background:done?T.gold:T.goldGl,border:`2px solid ${done?T.gold:T.gold+'44'}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:12,fontWeight:700,color:done?'#fff':T.gold,flexShrink:0,transition:'all .2s'}}>
        {done
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          : n}
      </div>
      <span style={{fontSize:15,fontWeight:600,color:T.text}}>{title}</span>
    </div>
    <div style={{paddingLeft:40}}>{children}</div>
  </div>
);

/* ── Log terminal ─────────────────────────────────────── */
const Log = ({ lines }) => {
  const ref = useRef();
  React.useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{background:'#0D1117',borderRadius:10,padding:'16px',height:240,
      overflowY:'auto',fontFamily:'monospace',fontSize:12.5,lineHeight:1.7,border:`1px solid ${T.border}`}}>
      {lines.length === 0
        ? <span style={{color:'#4A5568'}}>// aguardando início...</span>
        : lines.map((l, i) => (
          <div key={i} style={{color:l.type==='error'?'#FC8181':l.type==='ok'?'#68D391':l.type==='info'?'#90CDF4':'#CBD5E0'}}>
            {l.text}
          </div>
        ))}
    </div>
  );
};

/* ── Main Tab ─────────────────────────────────────────── */
export const TabRelatorioConsumo = () => {
  const [mainFile,     setMainFile]     = useState(null);
  const [rows,         setRows]         = useState([]);
  const [headers,      setHeaders]      = useState([]);
  const [colIdx,       setColIdx]       = useState(-1);
  const [clienteMap,   setClienteMap]   = useState(new Map()); // secName → full cliente string
  const [secretarias,  setSecretarias]  = useState([]);
  const [selected,     setSelected]     = useState(new Set());
  const [category,     setCategory]     = useState('fuel');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [outputPath,   setOutputPath]   = useState('');
  const [credUser,     setCredUser]     = useState('');
  const [credPass,     setCredPass]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [log,          setLog]          = useState([]);
  const [running,      setRunning]      = useState(false);
  const [done,         setDone]         = useState(false);

  const buildSecretarias = (allRows, ci, hdrs) => {
    const isCliente = norm(hdrs?.[ci] || '') === 'cliente';
    const map = new Map(); // secName → full string
    allRows.slice(1).forEach(r => {
      const raw = String(r[ci] || '').trim();
      if (!raw) return;
      const name = isCliente ? extractSecretaria(raw) : raw;
      if (!map.has(name)) map.set(name, raw);
    });
    const unique = [...map.keys()].sort();
    setClienteMap(map);
    setSecretarias(unique);
    setSelected(new Set(unique));
  };

  const loadMainFile = async (f) => {
    setMainFile(f);
    setRows([]); setHeaders([]); setColIdx(-1);
    setSecretarias([]); setSelected(new Set()); setClienteMap(new Map());
    // Auto-detect category from filename
    const cat = detectCategory(f.name);
    if (cat) setCategory(cat);
    try {
      const allRows   = await readXLSX(f);
      const headerRow = allRows[0].map(c => String(c));
      setHeaders(headerRow);
      setRows(allRows);
      const auto = detectClienteCol(headerRow);
      if (auto >= 0) { setColIdx(auto); buildSecretarias(allRows, auto, headerRow); }
    } catch { setLog([{ text: 'Erro ao ler o arquivo XLSX.', type: 'error' }]); }
  };

  const toggleSelect = (s) => setSelected(prev => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const startDownload = async () => {
    if (!mainFile || !selected.size || !credUser || !credPass || !startDate || !endDate) return;
    setRunning(true); setDone(false);
    setLog([{ text: `[${new Date().toLocaleTimeString('pt-BR')}] Iniciando...`, type: 'info' }]);

    try {
      const form = new FormData();
      form.append('mainFile', mainFile);
      form.append('username',       credUser);
      form.append('password',       credPass);
      form.append('startDate',      dateToBR(startDate));
      form.append('endDate',        dateToBR(endDate));
      form.append('category',       category);
      form.append('outputPath',     outputPath);
      // Send full cliente strings for the selected secretarias
      const clienteStrings = [...selected].map(name => clienteMap.get(name) || name);
      form.append('clienteStrings', JSON.stringify(clienteStrings));

      const res = await fetch(`${SERVER_URL}/api/faturamento/consumo/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ch_token')}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLog(l => [...l, { text: `Erro: ${err.error || res.statusText}`, type: 'error' }]);
        setRunning(false); return;
      }

      const { jobId } = await res.json();

      const poll = setInterval(async () => {
        try {
          const s = await fetch(`${SERVER_URL}/api/faturamento/consumo/status/${jobId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('ch_token')}` },
          }).then(r => r.json());

          // Replace log entirely (server keeps full log)
          if (s.logs?.length) setLog(s.logs);

          if (s.status === 'done') {
            clearInterval(poll); setRunning(false); setDone(true);
          }
          if (s.status === 'error') {
            clearInterval(poll); setRunning(false);
          }
        } catch {
          clearInterval(poll);
          setLog(l => [...l, { text: 'Conexão com servidor perdida.', type: 'error' }]);
          setRunning(false);
        }
      }, 2000);

    } catch {
      setLog(l => [...l, { text: `Servidor não encontrado em ${SERVER_URL}.`, type: 'error' }]);
      setRunning(false);
    }
  };

  const step1Done = !!mainFile && secretarias.length > 0;
  const step2Done = step1Done && !!startDate && !!endDate && selected.size > 0;
  const step3Done = step2Done && !!credUser && !!credPass;

  return (
    <div>
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:6}}>Relatório de Consumo</h2>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.6}}>
          Baixa automaticamente os PDFs de Relatório de Consumo do sistema 7Benefícios para cada secretaria.
        </p>
      </div>

      {/* ── Step 1 — Arquivo + categoria ── */}
      <Section n={1} title="Envie o Relatório de Retenção de Tributos" done={step1Done}>
        {!mainFile ? (
          <DropZoneXLSX onFile={loadMainFile} label="Relatório de retenção (.xlsx)"/>
        ) : (
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',
            background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:12}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500,color:T.text}}>{mainFile.name}</div>
              <div style={{fontSize:12,color:T.textT}}>{secretarias.length} secretaria{secretarias.length!==1?'s':''} identificada{secretarias.length!==1?'s':''}</div>
            </div>
            <button onClick={()=>{setMainFile(null);setSecretarias([]);setSelected(new Set());}}
              style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:12,fontFamily:'var(--font-body)'}}>
              Remover
            </button>
          </div>
        )}

        {/* Coluna + categoria */}
        {mainFile && headers.length > 0 && (
          <div style={{display:'flex',alignItems:'center',gap:16,marginTop:14,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:T.textS}}>Coluna:</span>
              <select value={colIdx} onChange={e=>{const ci=Number(e.target.value);setColIdx(ci);if(ci>=0)buildSecretarias(rows,ci,headers);}}
                style={{padding:'6px 10px',borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',cursor:'pointer',outline:'none'}}>
                <option value={-1}>Selecionar...</option>
                {headers.map((h,i)=><option key={i} value={i}>{h||`Col ${i+1}`}</option>)}
              </select>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:T.textS}}>Categoria:</span>
              <div style={{display:'flex',gap:6}}>
                {[{v:'fuel',l:'Abastecimento'},{v:'service',l:'Manutenção'}].map(({v,l})=>(
                  <button key={v} onClick={()=>setCategory(v)}
                    style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${category===v?T.gold:T.border}`,
                      background:category===v?T.goldGl:'transparent',color:category===v?T.gold:T.textS,
                      fontSize:13,fontWeight:category===v?600:400,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .15s'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Step 2 — Secretarias + período + pasta ── */}
      {step1Done && (
        <Section n={2} title="Selecione as secretarias e configure o período" done={step2Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Lista */}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textS}}>{selected.size}/{secretarias.length} selecionadas</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setSelected(new Set(secretarias))}
                    style={{fontSize:12,color:T.gold,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Todas</button>
                  <button onClick={()=>setSelected(new Set())}
                    style={{fontSize:12,color:T.textT,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Nenhuma</button>
                </div>
              </div>
              <div style={{maxHeight:220,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10,background:T.surface}}>
                {secretarias.map(s=>(
                  <label key={s} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',
                    cursor:'pointer',borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
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
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Data inicial</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Data final</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>
                  Pasta de destino <span style={{fontWeight:400,color:T.textD}}>(opcional)</span>
                </label>
                <input value={outputPath} onChange={e=>setOutputPath(e.target.value)}
                  placeholder="Ex: C:\Relatórios\Consumo"
                  style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Step 3 — Credenciais + iniciar ── */}
      {step2Done && (
        <Section n={3} title="Credenciais do 7Benefícios e download" done={done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Usuário 7Benefícios</label>
              <input value={credUser} onChange={e=>setCredUser(e.target.value)}
                placeholder="Nome de usuário"
                style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Senha</label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} value={credPass} onChange={e=>setCredPass(e.target.value)}
                  placeholder="Senha"
                  style={{width:'100%',padding:'9px 36px 9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
                <button onClick={()=>setShowPass(p=>!p)}
                  style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.textT,padding:2}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20,flexWrap:'wrap'}}>
            <button onClick={startDownload} disabled={running||!step3Done}
              style={{display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,
                border:'none',background:(running||!step3Done)?T.textD:T.gold,color:'#fff',
                fontSize:15,fontWeight:700,cursor:(running||!step3Done)?'not-allowed':'pointer',
                fontFamily:'var(--font-body)',transition:'all .15s',
                boxShadow:(running||!step3Done)?'none':`0 4px 16px ${T.gold}44`}}>
              {running
                ? <><div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Baixando...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Iniciar Download</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Concluído!
              </div>
            )}
          </div>
          <Log lines={log}/>
        </Section>
      )}
    </div>
  );
};
