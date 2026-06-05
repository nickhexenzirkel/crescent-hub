import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { T } from '../../../contexts/theme';
import { StellarHero } from '../StellarHero';
import { StarDivider } from '../../../shared/components';
import { checkExtension } from '../../../utils/checkExtension';
import { useCredenciais } from '../../../hooks/useCredenciais';
import { CredenciaisPanel } from '../CredenciaisPanel';
import { CatbotStatus } from '../CatbotStatus';
import { saveFile, loadFile, deleteFile } from '../../../utils/fileStorage';

const KEY_MAIN = 'rc_main';
const KEY_AUX  = 'rc_aux';

/* ── Helpers ─────────────────────────────────────────── */
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const readXLSX = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
    } catch (err) { reject(err); }
  };
  reader.readAsArrayBuffer(file);
});

const detectClienteCol = (headers) => {
  const h = headers.map(norm);
  const idx = h.findIndex(c => c === 'cliente');
  if (idx >= 0) return idx;
  return h.findIndex(col => ['secretaria','orgao','orgão','setor','departamento'].some(t => col.includes(t)));
};

const extractSecretaria = (s) => {
  const parts = String(s).split(' - ');
  return parts.length >= 3 ? parts[2].trim() : String(s).trim();
};

const dateToBR = (d) => {
  if (!d) return '';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
};

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/* ── Drop Zone ────────────────────────────────────────── */
const DropZoneXLSX = ({ onFile, label }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const handle = useCallback((files) => {
    const f = files.find(f => /\.(xlsx|xls)$/i.test(f.name));
    if (f) onFile(f);
  }, [onFile]);
  return (
    <div onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle([...e.dataTransfer.files]); }}
      style={{border:`2px dashed ${drag?T.gold:T.border}`,borderRadius:12,padding:'22px 20px',
        textAlign:'center',cursor:'pointer',background:drag?T.goldGl:T.surface,transition:'all .18s'}}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:8}}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
      <div style={{fontSize:13,fontWeight:500,color:T.text,marginBottom:3}}>{label}</div>
      <div style={{fontSize:11,color:T.textT}}>Aceita .xlsx e .xls</div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) handle([e.target.files[0]]); }}/>
    </div>
  );
};

const FileChip = ({ file, onRemove }) => (
  <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',
    background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10}}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
    <span style={{fontSize:13,fontWeight:500,color:T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</span>
    <button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:12,fontFamily:'var(--font-body)',flexShrink:0}}>Remover</button>
  </div>
);

const Section = ({ n, title, sub, done, children }) => (
  <div style={{background:T.surface,border:`1px solid ${done?T.gold+'55':T.border}`,borderRadius:18,
    boxShadow:T.sh,padding:'22px 26px',marginBottom:18,transition:'border-color .25s'}}>
    <div style={{display:'flex',alignItems:'center',gap:13}}>
      <div style={{width:30,height:30,borderRadius:'50%',background:done?T.gold:T.goldGl,
        border:`2px solid ${done?T.gold:T.gold+'44'}`,display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:13,fontWeight:700,color:done?'#fff':T.gold,flexShrink:0,
        boxShadow:done?`0 0 0 4px ${T.gold}1a`:'none',transition:'all .25s'}}>
        {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : n}
      </div>
      <div>
        <div style={{fontSize:16,fontWeight:600,color:T.text,lineHeight:1.2}}>{title}</div>
        {sub && <div style={{fontSize:12.5,color:T.textT,marginTop:2}}>{sub}</div>}
      </div>
    </div>
    <StarDivider my={14} dim/>
    <div>{children}</div>
  </div>
);

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
  const [mainFile,    setMainFile]    = useState(null);
  const [rows,        setRows]        = useState([]);
  const [headers,     setHeaders]     = useState([]);
  const [colIdx,      setColIdx]      = useState(-1);
  const [clienteMap,  setClienteMap]  = useState(new Map());
  const [secretarias, setSecretarias] = useState([]);
  const [selected,    setSelected]    = useState(new Set());
  const [category,    setCategory]    = useState('fuel');

  const [auxFile,    setAuxFile]    = useState(null);
  const [setorMap,   setSetorMap]   = useState(new Map());
  const [selSetores, setSelSetores] = useState(new Set());

  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [orgName,    setOrgName]    = useState('');

  const creds = useCredenciais();
  const { credUser, credPass } = creds;

  const [log,     setLog]     = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);

  // PDFs capturados em memória: folder → [base64]
  const collectedRef = useRef(new Map());

  const addLog = (text, type = 'normal') =>
    setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type }]);

  // Restaura arquivos salvos ao montar
  React.useEffect(() => {
    loadFile(KEY_MAIN).then(f => { if (f) loadMainFile(f); }).catch(() => {});
    loadFile(KEY_AUX).then(f  => { if (f) buildSetorMap(f); }).catch(() => {});
  }, []);

  /* ── Escuta eventos da extensão ── */
  React.useEffect(() => {
    const handler = async (e) => {
      const { type, log: l } = e.data || {};
      if (!type?.startsWith('FAT_')) return;
      if (type === 'FAT_LOG' && l)  setLog(prev => [...prev, l]);
      if (type === 'FAT_ERROR')     { setRunning(false); }
      if (type === 'FAT_SAVE_FILE') {
        const { id, filename, base64, subfolder } = e.data;
        const folder = subfolder ? subfolder.split('/')[0] : filename.replace(/\.[^.]+$/, '');
        if (!collectedRef.current.has(folder)) collectedRef.current.set(folder, []);
        collectedRef.current.get(folder).push({ filename, base64 });
        window.postMessage({ type: 'UNIKO_FAT_SAVE_RESULT', id, ok: true }, '*');
      }
      if (type === 'FAT_DONE') {
        const collected = collectedRef.current;
        if (collected.size > 0) {
          addLog('Montando ZIP...', 'info');
          const zip = new JSZip();
          collected.forEach((list, folder) => {
            list.forEach(({ filename, base64 }) => {
              const bin = atob(base64); const bytes = new Uint8Array(bin.length);
              for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
              zip.file(filename, bytes);
            });
          });
          const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'Uniko_Consumo.zip'; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          addLog(`ZIP baixado com ${collected.size} pasta${collected.size!==1?'s':''}.`, 'ok');
        }
        setRunning(false); setDone(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  /* ── Build secretaria list ── */
  const buildSecretarias = (allRows, ci, hdrs) => {
    const isCliente = norm(hdrs?.[ci] || '') === 'cliente';
    const map = new Map();
    allRows.slice(1).forEach(r => {
      const raw  = String(r[ci] || '').trim();
      if (!raw) return;
      const name = isCliente ? extractSecretaria(raw) : raw;
      if (!map.has(name)) map.set(name, raw);
    });
    const unique = [...map.keys()].sort();
    setClienteMap(map);
    setSecretarias(unique);
    setSelected(new Set(unique));
  };

  const buildSetorMap = async (f) => {
    setAuxFile(f);
    saveFile(KEY_AUX, f).catch(() => {});
    try {
      const allRows = await readXLSX(f);
      if (!allRows.length) return;
      const hdrs    = allRows[0].map(h => norm(String(h)));
      const cliIdx  = hdrs.findIndex(h => h === 'cliente');
      const setorIdx = hdrs.findIndex(h => h === 'setor');
      if (cliIdx < 0 || setorIdx < 0) return;
      const map = new Map();
      allRows.slice(1).forEach(r => {
        const cli   = String(r[cliIdx] || '').trim();
        const setor = String(r[setorIdx] || '').trim();
        if (!cli || !setor) return;
        const sec = extractSecretaria(cli);
        if (!map.has(sec)) map.set(sec, new Set());
        map.get(sec).add(setor);
      });
      const final = new Map([...map.entries()].map(([k, v]) => [k, [...v].sort()]));
      setSetorMap(final);
      const allKeys = new Set();
      final.forEach((ss, sec) => ss.forEach(s => allKeys.add(`${sec}::${s}`)));
      setSelSetores(allKeys);
    } catch { /* ignore */ }
  };

  const loadMainFile = async (f) => {
    setMainFile(f);
    saveFile(KEY_MAIN, f).catch(() => {});
    setRows([]); setHeaders([]); setColIdx(-1);
    setSecretarias([]); setSelected(new Set()); setClienteMap(new Map());
    const fn = f.name.toLowerCase();
    if (fn.includes('combustivel') || fn.includes('abastec')) setCategory('fuel');
    else if (fn.includes('manutenc')) setCategory('service');
    try {
      const allRows   = await readXLSX(f);
      const headerRow = allRows[0].map(c => String(c));
      setHeaders(headerRow);
      setRows(allRows);
      const auto = detectClienteCol(headerRow);
      if (auto >= 0) {
        setColIdx(auto);
        buildSecretarias(allRows, auto, headerRow);
        const firstRaw = String(allRows[1]?.[auto] || '').trim();
        if (firstRaw) { const p = firstRaw.split(' - '); setOrgName(p[p.length - 1]?.trim() || ''); }
      }
    } catch { addLog('Erro ao ler o arquivo XLSX.', 'error'); }
  };

  const toggleSelect = (s) => setSelected(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const temSetor = !!auxFile && setorMap.size > 0;
  const secSetores   = (sec) => setorMap.get(sec) || [];
  const allSecSel    = (sec) => secSetores(sec).every(s => selSetores.has(`${sec}::${s}`));
  const someSecSel   = (sec) => secSetores(sec).some(s  => selSetores.has(`${sec}::${s}`));
  const toggleSetor  = (sec, setor) => setSelSetores(prev => { const n = new Set(prev); const k = `${sec}::${setor}`; n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleSecAll = (sec) => setSelSetores(prev => {
    const n = new Set(prev); const ss = secSetores(sec);
    const all = ss.every(s => n.has(`${sec}::${s}`));
    ss.forEach(s => all ? n.delete(`${sec}::${s}`) : n.add(`${sec}::${s}`));
    return n;
  });

  const selectedCount = temSetor ? selSetores.size : selected.size;
  const totalCount    = temSetor ? [...setorMap.values()].reduce((s,v) => s+v.length, 0) : secretarias.length;

  const buildDownloadItems = () => {
    if (temSetor && setorMap.size > 0) {
      return [...selSetores].map(key => {
        const sep = key.indexOf('::');
        return { clienteStr: clienteMap.get(key.slice(0,sep)) || key.slice(0,sep), setor: key.slice(sep+2) };
      });
    }
    return [...selected].map(name => ({ clienteStr: clienteMap.get(name) || name, setor: '' }));
  };

  /* ── Dispara extensão ── */
  const startDownload = async () => {
    const items = buildDownloadItems();
    if (!items.length || !credUser || !credPass || !startDate || !endDate) return;

    const extStatus = await checkExtension();
    if (extStatus === 'reload') {
      setLog([{ text: 'Extensão desconectada após atualização — recarregue a página (F5) e tente novamente.', type: 'error' }]);
      return;
    }
    if (!extStatus) {
      setLog([{ text: 'Extensão "Uniko Faturamento" não encontrada. Instale no Chrome/Opera e recarregue.', type: 'error' }]);
      return;
    }

    collectedRef.current = new Map();
    setRunning(true); setDone(false);
    setLog([{ text: `[${new Date().toLocaleTimeString('pt-BR')}] Iniciando automação em background...`, type: 'info' }]);

    window.postMessage({
      type: 'UNIKO_FAT_START',
      data: {
        username: credUser, password: credPass,
        startDate: dateToBR(startDate), endDate: dateToBR(endDate),
        category, downloadItems: items, orgName: orgName.trim(),
        useFolder: true,
      },
    }, '*');
  };

  const step1Done = !!mainFile && secretarias.length > 0;
  const step2Done = step1Done && !!startDate && !!endDate && selectedCount > 0;
  const step3Done  = step2Done && !!credUser && !!credPass;
  const catPhase   = running ? 'rc' : done ? 'done' : log.some(l => l.type === 'error') ? 'error' : 'idle';

  return (
    <div>
      <StellarHero compact
        eyebrow="Automação · 7Benefícios"
        title="Relatório de Consumo"
        subtitle="Baixa os PDFs de Relatório de Consumo de cada secretaria em modo headless, sem janela visível."
        icon={(
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        )}
      />

      {/* ── Step 1 ── */}
      <Section n={1} title="Envie os relatórios" sub="As secretarias são detectadas automaticamente." done={step1Done}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:T.textS,marginBottom:8}}>
              Relatório de retenção de tributos <span style={{color:T.danger,fontWeight:700}}>*</span>
            </div>
            {!mainFile
              ? <DropZoneXLSX onFile={loadMainFile} label="Relatório de retenção (.xlsx)"/>
              : <FileChip file={mainFile} onRemove={()=>{setMainFile(null);setSecretarias([]);setSelected(new Set());setRows([]);setSetorMap(new Map());setAuxFile(null);deleteFile(KEY_MAIN).catch(()=>{});deleteFile(KEY_AUX).catch(()=>{}); }}/>
            }
            {mainFile && headers.length > 0 && colIdx >= 0 && (
              <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,padding:'6px 10px',
                background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{fontSize:12,color:T.textS}}>
                  {temSetor ? totalCount : secretarias.length} {temSetor?'setor':'secretaria'}{(temSetor?totalCount:secretarias.length)!==1?'s':''} · col. <strong style={{color:T.text}}>{headers[colIdx]||'Cliente'}</strong>
                </span>
              </div>
            )}
          </div>
          <div>
            <div style={{marginBottom:8}}>
              <span style={{fontSize:12.5,fontWeight:600,color:T.textS}}>Relatório por organização — setores</span>
              <span style={{fontSize:12,color:T.textT}}> — opcional</span>
            </div>
            {!auxFile
              ? <DropZoneXLSX onFile={buildSetorMap} label="Selecionar relatório por organização (opcional)..."/>
              : (
                <div>
                  <FileChip file={auxFile} onRemove={()=>{setAuxFile(null);setSetorMap(new Map());setSelSetores(new Set());deleteFile(KEY_AUX).catch(()=>{});}}/>
                  {setorMap.size > 0 && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,padding:'6px 10px',
                      background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{fontSize:12,color:T.textS}}>
                        {[...setorMap.values()].reduce((s,v)=>s+v.length,0)} setores em {setorMap.size} secretaria{setorMap.size!==1?'s':''}
                      </span>
                    </div>
                  )}
                </div>
              )
            }
            {mainFile && (
              <div style={{marginTop:16,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12.5,color:T.textS}}>Categoria:</span>
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
            )}
          </div>
        </div>
      </Section>

      {/* ── Step 2 ── */}
      {step1Done && (
        <Section n={2} title="Selecione e configure o período" sub="Marque as secretarias e defina o período." done={step2Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textS}}>{selectedCount}/{totalCount} selecionado{selectedCount!==1?'s':''}</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{
                    if(temSetor){const all=new Set();setorMap.forEach((ss,sec)=>ss.forEach(s=>all.add(`${sec}::${s}`)));setSelSetores(all);}
                    else setSelected(new Set(secretarias));
                  }} style={{fontSize:12,color:T.gold,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Todos</button>
                  <button onClick={()=>{if(temSetor)setSelSetores(new Set());else setSelected(new Set());}}
                    style={{fontSize:12,color:T.textT,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Nenhum</button>
                </div>
              </div>
              <div style={{maxHeight:260,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10,background:T.surface}}>
                {temSetor && setorMap.size > 0 ? (
                  [...setorMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([sec, setores]) => (
                    <div key={sec} style={{borderBottom:`1px solid ${T.divider}`}}>
                      <label style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer',background:T.goldGl+'88'}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                        onMouseLeave={e=>e.currentTarget.style.background=T.goldGl+'88'}>
                        <input type="checkbox" checked={allSecSel(sec)}
                          ref={el=>{ if(el) el.indeterminate = !allSecSel(sec) && someSecSel(sec); }}
                          onChange={()=>toggleSecAll(sec)}
                          style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>{sec}</span>
                        <span style={{marginLeft:'auto',fontSize:11,color:T.textT}}>{setores.length} setor{setores.length!==1?'es':''}</span>
                      </label>
                      {setores.map(setor => (
                        <label key={setor} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 14px 7px 36px',cursor:'pointer',transition:'background .1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <input type="checkbox" checked={selSetores.has(`${sec}::${setor}`)} onChange={()=>toggleSetor(sec,setor)}
                            style={{accentColor:T.gold,width:14,height:14,cursor:'pointer'}}/>
                          <span style={{fontSize:12,color:T.textS}}>{setor}</span>
                        </label>
                      ))}
                    </div>
                  ))
                ) : (
                  secretarias.map(s=>(
                    <label key={s} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <input type="checkbox" checked={selected.has(s)} onChange={()=>toggleSelect(s)}
                        style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                      <span style={{fontSize:13,color:T.text}}>{s}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
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
                  Nome da organização no 7Benefícios
                </label>
                <input value={orgName} onChange={e=>setOrgName(e.target.value)}
                  placeholder="Ex: 30 - MUNICÍPIO DE JAGUARETAMA"
                  style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${orgName?T.gold:T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Step 3 ── */}
      {step2Done && (
        <Section n={3} title="Credenciais e download" sub="As credenciais ficam salvas no navegador." done={done}>
          <div style={{marginBottom:16}}>
            <CredenciaisPanel {...creds}/>
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
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Baixar {selectedCount} PDF{selectedCount!==1?'s':''}</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ZIP baixado!
              </div>
            )}
          </div>
          <CatbotStatus phase={catPhase}/>
          <Log lines={log}/>
        </Section>
      )}
    </div>
  );
};
