import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { T } from '../../../contexts/theme';
import { StellarHero } from '../StellarHero';
import { StarDivider } from '../../../shared/components';
// Verifica se a extensão Uniko Faturamento está instalada no navegador
const checkExtension = () => new Promise(resolve => {
  const timer = setTimeout(() => { window.removeEventListener('message', h); resolve(false); }, 1500);
  const h = (e) => { if (e.data?.type === 'FAT_PONG') { clearTimeout(timer); window.removeEventListener('message', h); resolve(true); } };
  window.addEventListener('message', h);
  window.postMessage({ type: 'UNIKO_FAT_PING' }, '*');
});

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
  const idx = h.findIndex(c => c === 'cliente');
  if (idx >= 0) return idx;
  const terms = ['secretaria', 'orgao', 'orgão', 'setor', 'departamento'];
  return h.findIndex(col => terms.some(t => col.includes(t)));
};

// "30 - JAGUARETAMA - SECRETARIA DOS ESPORTES - MUNICIPIO DE X" → "SECRETARIA DOS ESPORTES"
const extractSecretaria = (s) => {
  const parts = String(s).split(' - ');
  return parts.length >= 3 ? parts[2].trim() : String(s).trim();
};

const detectCategory = (filename) => {
  const n = filename.toLowerCase();
  if (n.includes('combustivel') || n.includes('abastec')) return 'fuel';
  if (n.includes('manutencao') || n.includes('manutenção')) return 'service';
  return '';
};

const dateToBR = (d) => {
  if (!d) return '';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
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

/* ── Section panel (card por etapa) ───────────────────── */
const Section = ({ n, title, sub, done, children }) => (
  <div style={{
    background:T.surface, border:`1px solid ${done?T.gold+'55':T.border}`, borderRadius:18,
    boxShadow:T.sh, padding:'22px 26px', marginBottom:18, transition:'border-color .25s',
  }}>
    <div style={{display:'flex',alignItems:'center',gap:13}}>
      <div style={{width:30,height:30,borderRadius:'50%',
        background:done?T.gold:T.goldGl,border:`2px solid ${done?T.gold:T.gold+'44'}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:13,fontWeight:700,color:done?'#fff':T.gold,flexShrink:0,
        boxShadow:done?`0 0 0 4px ${T.gold}1a`:'none',transition:'all .25s'}}>
        {done
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          : n}
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
  // Arquivo principal
  const [mainFile,    setMainFile]    = useState(null);
  const [rows,        setRows]        = useState([]);
  const [headers,     setHeaders]     = useState([]);
  const [colIdx,      setColIdx]      = useState(-1);
  const [clienteMap,  setClienteMap]  = useState(new Map()); // secName → full cliente string
  const [secretarias, setSecretarias] = useState([]);
  const [selected,    setSelected]    = useState(new Set());
  const [category,    setCategory]    = useState('fuel');

  // Setor
  const [auxFile,    setAuxFile]    = useState(null);
  const [setorMap,   setSetorMap]   = useState(new Map()); // secName → string[]
  const [selSetores, setSelSetores] = useState(new Set()); // "sec::setor"

  // Config
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [orgName,    setOrgName]    = useState('');

  // Pasta de destino (File System Access)
  const [folderName, setFolderName] = useState('');
  const dirHandleRef = useRef(null);  // pasta escolhida pelo usuário
  const subDirRef    = useRef(null);  // subpasta "Uniko - Relatórios de Consumo"
  const usedNamesRef = useRef(new Set()); // evita sobrescrever nomes repetidos
  const fsSupported  = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const [credUser,   setCredUser]   = useState('');
  const [credPass,   setCredPass]   = useState('');
  const [showPass,   setShowPass]   = useState(false);

  // Execução
  const [log,     setLog]     = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);

  /* ── Build secretaria list from main file ── */
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

  /* ── Build setor map from auxiliary file ── */
  const buildSetorMap = async (f) => {
    setAuxFile(f);
    try {
      const allRows = await readXLSX(f);
      if (!allRows.length) return;
      const hdrs      = allRows[0].map(h => norm(String(h)));
      const cliIdx    = hdrs.findIndex(h => h === 'cliente');
      const setorIdx  = hdrs.findIndex(h => h === 'setor');
      if (cliIdx < 0 || setorIdx < 0) return;

      const map = new Map(); // secName → Set<setor>
      allRows.slice(1).forEach(r => {
        const cli   = String(r[cliIdx] || '').trim();
        const setor = String(r[setorIdx] || '').trim();
        if (!cli || !setor) return;
        const sec = extractSecretaria(cli);
        if (!map.has(sec)) map.set(sec, new Set());
        map.get(sec).add(setor);
      });

      // Convert Sets to sorted arrays
      const final = new Map([...map.entries()].map(([k, v]) => [k, [...v].sort()]));
      setSetorMap(final);

      // Pre-select all
      const allKeys = new Set();
      final.forEach((setores, sec) => setores.forEach(s => allKeys.add(`${sec}::${s}`)));
      setSelSetores(allKeys);
    } catch { /* ignore */ }
  };

  /* ── Main file load ── */
  const loadMainFile = async (f) => {
    setMainFile(f);
    setRows([]); setHeaders([]); setColIdx(-1);
    setSecretarias([]); setSelected(new Set()); setClienteMap(new Map());
    const cat = detectCategory(f.name);
    if (cat) setCategory(cat);
    try {
      const allRows   = await readXLSX(f);
      const headerRow = allRows[0].map(c => String(c));
      setHeaders(headerRow);
      setRows(allRows);
      const auto = detectClienteCol(headerRow);
      if (auto >= 0) {
        setColIdx(auto);
        buildSecretarias(allRows, auto, headerRow);
        // Pré-preenche o nome da organização com o último segmento do primeiro cliente
        const firstRaw = String(allRows[1]?.[auto] || '').trim();
        if (firstRaw) {
          const p = firstRaw.split(' - ');
          setOrgName(p[p.length - 1]?.trim() || '');
        }
      }
    } catch { setLog([{ text: 'Erro ao ler o arquivo XLSX.', type: 'error' }]); }
  };

  const toggleSelect = (s) => setSelected(prev => {
    const next = new Set(prev); next.has(s) ? next.delete(s) : next.add(s); return next;
  });

  /* ── Setor checkbox helpers ── */
  const secSetores = (sec) => setorMap.get(sec) || [];
  const allSecSel  = (sec) => secSetores(sec).every(s => selSetores.has(`${sec}::${s}`));
  const someSecSel = (sec) => secSetores(sec).some(s => selSetores.has(`${sec}::${s}`));

  const toggleSetor = (sec, setor) => setSelSetores(prev => {
    const next = new Set(prev);
    const key = `${sec}::${setor}`;
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleSecAll = (sec) => setSelSetores(prev => {
    const next = new Set(prev);
    const setores = secSetores(sec);
    const all = setores.every(s => next.has(`${sec}::${s}`));
    setores.forEach(s => all ? next.delete(`${sec}::${s}`) : next.add(`${sec}::${s}`));
    return next;
  });

  /* ── temSetor: verdadeiro quando o auxiliar foi carregado com setores ── */
  const temSetor = !!auxFile && setorMap.size > 0;

  /* ── Count selected items ── */
  const selectedCount = temSetor && setorMap.size > 0
    ? selSetores.size
    : selected.size;

  const totalCount = temSetor && setorMap.size > 0
    ? [...setorMap.values()].reduce((s, v) => s + v.length, 0)
    : secretarias.length;

  /* ── Build download items for submission ── */
  const buildDownloadItems = () => {
    if (temSetor && setorMap.size > 0) {
      return [...selSetores].map(key => {
        const sep  = key.indexOf('::');
        const sec  = key.slice(0, sep);
        const setor = key.slice(sep + 2);
        return { clienteStr: clienteMap.get(sec) || sec, setor };
      });
    }
    return [...selected].map(name => ({ clienteStr: clienteMap.get(name) || name, setor: '' }));
  };

  /* ── Pasta de destino ── */
  const pickFolder = async () => {
    if (!fsSupported) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      dirHandleRef.current = handle;
      subDirRef.current = null;
      setFolderName(handle.name);
    } catch { /* usuário cancelou */ }
  };

  // Garante permissão e cria/abre a subpasta "Uniko - Relatórios de Consumo"
  const ensureSubDir = async () => {
    const handle = dirHandleRef.current;
    if (!handle) return null;
    if (handle.queryPermission) {
      let perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && handle.requestPermission) {
        perm = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return null;
    }
    const sub = await handle.getDirectoryHandle('Uniko - Relatórios de Consumo', { create: true });
    subDirRef.current = sub;
    usedNamesRef.current = new Set();
    return sub;
  };

  // base64 → Uint8Array
  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  // Grava o PDF na subpasta (cria subpastas aninhadas), evitando sobrescrever
  const savePdfToFolder = async (filename, base64, subfolder = '') => {
    let dir = subDirRef.current;
    if (!dir) throw new Error('pasta não selecionada');
    for (const part of String(subfolder).split('/').map(s => s.trim()).filter(Boolean)) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    let name = filename;
    const key = (n) => `${subfolder}/${n}`;
    if (usedNamesRef.current.has(key(name))) {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext  = dot > 0 ? name.slice(dot) : '';
      let i = 2;
      while (usedNamesRef.current.has(key(`${stem} (${i})${ext}`))) i++;
      name = `${stem} (${i})${ext}`;
    }
    usedNamesRef.current.add(key(name));
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(b64ToBytes(base64));
    await writable.close();
  };

  /* ── Recebe eventos da extensão ── */
  React.useEffect(() => {
    const handler = async (e) => {
      const { type, log: l } = e.data || {};
      if (!type?.startsWith('FAT_')) return;
      if (type === 'FAT_LOG' && l)  setLog(prev => [...prev, l]);
      if (type === 'FAT_DONE')      { setRunning(false); setDone(true); }
      if (type === 'FAT_ERROR')     { setRunning(false); }
      if (type === 'FAT_SAVE_FILE') {
        const { id, filename, base64, subfolder } = e.data;
        try {
          await savePdfToFolder(filename, base64, subfolder || '');
          window.postMessage({ type: 'UNIKO_FAT_SAVE_RESULT', id, ok: true }, '*');
        } catch (err) {
          window.postMessage({ type: 'UNIKO_FAT_SAVE_RESULT', id, ok: false, error: String(err?.message || err) }, '*');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  /* ── Start automation ── */
  const startDownload = async () => {
    const items = buildDownloadItems();
    if (!items.length || !credUser || !credPass || !startDate || !endDate) return;

    const extFound = await checkExtension();
    if (!extFound) {
      setLog([{ text: 'Extensão "Uniko Faturamento" não encontrada. Instale a extensão no Chrome/Opera e recarregue a página.', type: 'error' }]);
      return;
    }

    // Prepara a pasta de destino (se escolhida)
    let useFolder = false;
    if (dirHandleRef.current) {
      try {
        const sub = await ensureSubDir();
        if (!sub) {
          setLog([{ text: 'Permissão da pasta negada. Escolha a pasta novamente.', type: 'error' }]);
          return;
        }
        useFolder = true;
      } catch (err) {
        setLog([{ text: `Erro ao preparar a pasta de destino: ${err?.message || err}`, type: 'error' }]);
        return;
      }
    }

    setRunning(true); setDone(false);
    setLog([{
      text: `[${new Date().toLocaleTimeString('pt-BR')}] Iniciando automação via extensão...${useFolder ? ` Salvando em "${folderName}/Uniko - Relatórios de Consumo".` : ' Salvando na pasta Downloads.'}`,
      type: 'info',
    }]);

    window.postMessage({
      type: 'UNIKO_FAT_START',
      data: {
        username:      credUser,
        password:      credPass,
        startDate:     dateToBR(startDate),
        endDate:       dateToBR(endDate),
        category,
        downloadItems: items,
        orgName:       orgName.trim(),
        useFolder,
      },
    }, '*');
  };

  const step1Done = !!mainFile && secretarias.length > 0;
  const step2Done = step1Done && !!startDate && !!endDate && selectedCount > 0;
  const step3Done = step2Done && !!credUser && !!credPass;

  return (
    <div>
      <StellarHero compact
        eyebrow="Automação · 7Benefícios"
        title="Relatório de Consumo"
        subtitle="Baixa os PDFs de Relatório de Consumo de cada secretaria, direto na pasta que você escolher."
        icon={(
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        )}
      />


      {/* ── Step 1 — Arquivos ── */}
      <Section n={1} title="Envie os relatórios" sub="As secretarias são detectadas automaticamente. O relatório por organização é opcional." done={step1Done}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>

          {/* Principal */}
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:T.textS,marginBottom:8}}>
              Relatório de retenção de tributos <span style={{color:T.danger,fontWeight:700}}>*</span>
            </div>
            {!mainFile
              ? <DropZoneXLSX onFile={loadMainFile} label="Relatório de retenção (.xlsx)"/>
              : <FileChip file={mainFile} onRemove={()=>{setMainFile(null);setSecretarias([]);setSelected(new Set());setRows([]);setSetorMap(new Map());setAuxFile(null);}}/>
            }
            {mainFile && headers.length > 0 && (
              <div style={{marginTop:10}}>
                {colIdx >= 0 ? (
                  <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 10px',
                    background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{fontSize:12,color:T.textS}}>{secretarias.length} secretaria{secretarias.length!==1?'s':''} · coluna <strong style={{color:T.text}}>{headers[colIdx]||'Cliente'}</strong></span>
                  </div>
                ) : (
                  <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 10px',
                    background:T.dangerGl||'rgba(192,64,80,.08)',border:`1px solid ${T.danger}33`,borderRadius:8}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.danger} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style={{fontSize:12,color:T.textS}}>Coluna <strong>Cliente</strong> não encontrada.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auxiliar por organização (setor) */}
          <div>
            <div style={{marginBottom:8}}>
              <span style={{fontSize:12.5,fontWeight:600,color:T.textS}}>Relatório por organização — setores</span>
              <span style={{fontSize:12,color:T.textT}}> — opcional</span>
            </div>
            <div style={{fontSize:11.5,color:T.textT,marginBottom:8,lineHeight:1.5}}>
              Se o cliente tiver setores, importe para que as pastas sejam criadas com o nome correto (ex: SAÚDE - ATENÇÃO BÁSICA).
            </div>
            {!auxFile
              ? <DropZoneXLSX onFile={buildSetorMap} label="Selecionar relatório por organização (opcional)..."/>
              : (
                <div>
                  <FileChip file={auxFile} onRemove={()=>{setAuxFile(null);setSetorMap(new Map());setSelSetores(new Set());}}/>
                  {setorMap.size > 0 && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,padding:'6px 10px',
                      background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{fontSize:12,color:T.textS}}>
                        {[...setorMap.values()].reduce((s,v)=>s+v.length,0)} setor{[...setorMap.values()].reduce((s,v)=>s+v.length,0)!==1?'es':''} em {setorMap.size} secretaria{setorMap.size!==1?'s':''}
                      </span>
                    </div>
                  )}
                </div>
              )
            }

            {/* Categoria — movida para cá, ao lado do auxiliar */}
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

      {/* ── Step 2 — Lista de seleção + período + pasta ── */}
      {step1Done && (
        <Section n={2} title="Selecione e configure o período" sub="Marque as secretarias, defina o período e a pasta de destino." done={step2Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

            {/* Lista */}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textS}}>{selectedCount}/{totalCount} selecionado{selectedCount!==1?'s':''}</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{
                    if(temSetor&&setorMap.size>0){const all=new Set();setorMap.forEach((ss,sec)=>ss.forEach(s=>all.add(`${sec}::${s}`)));setSelSetores(all);}
                    else setSelected(new Set(secretarias));
                  }} style={{fontSize:12,color:T.gold,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Todos</button>
                  <button onClick={()=>{if(temSetor&&setorMap.size>0)setSelSetores(new Set());else setSelected(new Set());}}
                    style={{fontSize:12,color:T.textT,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Nenhum</button>
                </div>
              </div>

              <div style={{maxHeight:260,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10,background:T.surface}}>
                {temSetor && setorMap.size > 0 ? (
                  /* Vista agrupada: secretaria > setores */
                  [...setorMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([sec, setores]) => (
                    <div key={sec} style={{borderBottom:`1px solid ${T.divider}`}}>
                      {/* Cabeçalho da secretaria */}
                      <label style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',
                        cursor:'pointer',background:T.goldGl+'88'}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                        onMouseLeave={e=>e.currentTarget.style.background=T.goldGl+'88'}>
                        <input type="checkbox"
                          checked={allSecSel(sec)}
                          ref={el=>{ if(el) el.indeterminate = !allSecSel(sec) && someSecSel(sec); }}
                          onChange={()=>toggleSecAll(sec)}
                          style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>{sec}</span>
                        <span style={{marginLeft:'auto',fontSize:11,color:T.textT}}>{setores.length} setor{setores.length!==1?'es':''}</span>
                      </label>
                      {/* Setores */}
                      {setores.map(setor => (
                        <label key={setor} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 14px 7px 36px',
                          cursor:'pointer',transition:'background .1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <input type="checkbox"
                            checked={selSetores.has(`${sec}::${setor}`)}
                            onChange={()=>toggleSetor(sec,setor)}
                            style={{accentColor:T.gold,width:14,height:14,cursor:'pointer'}}/>
                          <span style={{fontSize:12,color:T.textS}}>{setor}</span>
                        </label>
                      ))}
                    </div>
                  ))
                ) : (
                  /* Vista plana: só secretarias */
                  secretarias.map(s=>(
                    <label key={s} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',
                      cursor:'pointer',borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
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
                  Nome da organização no 7Benefícios
                  <span style={{fontWeight:400,color:T.textD}}> (exatamente como aparece na aba Organizações)</span>
                </label>
                <input value={orgName} onChange={e=>setOrgName(e.target.value)}
                  placeholder="Ex: 30 - MUNICÍPIO DE JAGUARETAMA"
                  style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${orgName?T.gold:T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
                <div style={{fontSize:11,color:T.textT,marginTop:4}}>
                  Vá na aba Organizações do 7Benefícios e copie o nome exato da linha da sua organização.
                </div>
              </div>

              {/* Pasta de destino */}
              <div>
                <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>
                  Pasta de destino
                  <span style={{fontWeight:400,color:T.textD}}> (opcional)</span>
                </label>
                {!fsSupported ? (
                  <div style={{fontSize:12,color:T.textT,padding:'9px 10px',border:`1px solid ${T.border}`,borderRadius:9,background:T.surface}}>
                    Seu navegador não permite escolher a pasta. Os PDFs serão salvos em Downloads.
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <button onClick={pickFolder}
                      style={{display:'flex',alignItems:'center',gap:8,padding:'9px 14px',borderRadius:9,
                        border:`1px solid ${folderName?T.gold:T.border}`,background:folderName?T.goldGl:T.surface,
                        color:folderName?T.gold:T.textS,fontSize:13,fontWeight:500,cursor:'pointer',
                        fontFamily:'var(--font-body)',transition:'all .15s',whiteSpace:'nowrap'}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                      </svg>
                      {folderName ? 'Trocar pasta' : 'Escolher pasta'}
                    </button>
                    {folderName && (
                      <span style={{fontSize:12,color:T.textS,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {folderName}/<strong style={{color:T.text}}>Uniko - Relatórios de Consumo</strong>
                      </span>
                    )}
                  </div>
                )}
                <div style={{fontSize:11,color:T.textT,marginTop:4}}>
                  Os arquivos são salvos como <code>trans_SECRETARIA_SETOR.pdf</code>. Sem escolher pasta, vão para Downloads.
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Step 3 — Credenciais + iniciar ── */}
      {step2Done && (
        <Section n={3} title="Credenciais do 7Benefícios e download" sub="Usadas apenas para esta automação — não ficam salvas." done={done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Usuário</label>
              <input value={credUser} onChange={e=>setCredUser(e.target.value)} placeholder="Nome de usuário"
                style={{width:'100%',padding:'9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{fontSize:13,fontWeight:600,color:T.textS,display:'block',marginBottom:6}}>Senha</label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} value={credPass} onChange={e=>setCredPass(e.target.value)} placeholder="Senha"
                  style={{width:'100%',padding:'9px 36px 9px 10px',borderRadius:9,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
                <button onClick={()=>setShowPass(p=>!p)}
                  style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.textT}}>
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
                ? <><div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Baixando {selectedCount} PDF{selectedCount!==1?'s':''}...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Baixar {selectedCount} PDF{selectedCount!==1?'s':''}</>}
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
