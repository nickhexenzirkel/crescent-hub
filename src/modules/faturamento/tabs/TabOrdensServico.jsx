import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { T } from '../../../contexts/theme';
import { StellarHero } from '../StellarHero';
import { StarDivider } from '../../../shared/components';

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
      resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
    } catch (err) { reject(err); }
  };
  reader.readAsArrayBuffer(file);
});

const detectClienteCol = (headers) => {
  const h = headers.map(norm);
  const idx = h.findIndex(c => c === 'cliente');
  if (idx >= 0) return idx;
  return h.findIndex(col => ['secretaria','orgao','setor','departamento'].some(t => col.includes(t)));
};

const detectOSCol = (headers) => {
  const h = headers.map(norm);
  let idx = h.findIndex(c => c.includes('id') && c.includes('ordem'));
  if (idx >= 0) return idx;
  idx = h.findIndex(c => c === 'id');
  if (idx >= 0) return idx;
  return h.findIndex(c => c.includes('ordem') || c.includes('order') || c === 'os' || c === 'o.s' || c.includes('pedido'));
};

const extractSecretaria = (s) => {
  const parts = String(s).split(' - ');
  return parts.length >= 3 ? parts[2].trim() : String(s).trim();
};

const folderOf = (o) => `${o.secretaria}${o.setor ? ` - ${o.setor}` : ''}`;

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

const FolderIcon = ({ color, small }) => (
  <svg width={small?14:16} height={small?14:16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
  </svg>
);
const FileIcon = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
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
export const TabOrdensServico = () => {
  const [mainFile,   setMainFile]   = useState(null);
  const [rows,       setRows]       = useState([]);
  const [headers,    setHeaders]    = useState([]);
  const [cliIdx,     setCliIdx]     = useState(-1);
  const [osIdx,      setOsIdx]      = useState(-1);
  const [osRows,     setOsRows]     = useState([]);
  const [cliMap,     setCliMap]     = useState(new Map());
  const [selected,   setSelected]   = useState(new Set());

  const [auxFile,    setAuxFile]    = useState(null);
  const [setorByOs,  setSetorByOs]  = useState(new Map());

  const [orgName,    setOrgName]    = useState('');
  const [credUser,   setCredUser]   = useState('');
  const [credPass,   setCredPass]   = useState('');
  const [showPass,   setShowPass]   = useState(false);

  const [log,     setLog]     = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);

  const collectedRef = useRef(new Map());

  const addLog = (text, type = 'normal') =>
    setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type }]);

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
              zip.folder(folder).file(filename, bytes);
            });
          });
          const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'Uniko_OrdensServico.zip'; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          addLog(`ZIP baixado com ${collected.size} pasta${collected.size!==1?'s':''}.`, 'ok');
        }
        setRunning(false); setDone(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const buildOsRows = (allRows, ci, oi, setorMap = setorByOs) => {
    if (ci < 0 || oi < 0) { setOsRows([]); setSelected(new Set()); return; }
    const map = new Map(); const out = []; const seen = new Set();
    allRows.slice(1).forEach(r => {
      const cliente = String(r[ci] || '').trim();
      const osId    = String(r[oi] || '').trim();
      if (!cliente || !osId) return;
      const secretaria = extractSecretaria(cliente);
      const key = `${secretaria}::${osId}`;
      if (seen.has(key)) return; seen.add(key);
      if (!map.has(secretaria)) map.set(secretaria, cliente);
      out.push({ osId, cliente, secretaria, setor: setorMap.get(osId) || '' });
    });
    setCliMap(map);
    setOsRows(out);
    setSelected(new Set(out.map(o => `${folderOf(o)}::${o.osId}`)));
  };

  const buildSetorMap = async (f) => {
    setAuxFile(f);
    try {
      const allRows = await readXLSX(f);
      if (!allRows.length) return;
      const hdrs     = allRows[0].map(h => String(h));
      const setorIdx = hdrs.map(norm).findIndex(h => h === 'setor' || h.includes('setor'));
      const osColIdx = detectOSCol(hdrs);
      if (setorIdx < 0 || osColIdx < 0) return;
      const map = new Map();
      allRows.slice(1).forEach(r => {
        const osId  = String(r[osColIdx] || '').trim();
        const setor = String(r[setorIdx] || '').trim();
        if (osId && setor) map.set(osId, setor);
      });
      setSetorByOs(map);
      if (cliIdx >= 0 && osIdx >= 0) buildOsRows(rows, cliIdx, osIdx, map);
    } catch { /* ignore */ }
  };

  const loadMainFile = async (f) => {
    setMainFile(f);
    setRows([]); setHeaders([]); setCliIdx(-1); setOsIdx(-1);
    setOsRows([]); setSelected(new Set()); setCliMap(new Map());
    try {
      const allRows   = await readXLSX(f);
      const headerRow = allRows[0].map(c => String(c));
      setHeaders(headerRow);
      setRows(allRows);
      const ci = detectClienteCol(headerRow);
      const oi = detectOSCol(headerRow);
      setCliIdx(ci); setOsIdx(oi);
      if (ci >= 0 && oi >= 0) buildOsRows(allRows, ci, oi);
      const firstRaw = String(allRows[1]?.[ci] || '').trim();
      if (firstRaw) { const p = firstRaw.split(' - '); setOrgName(p[p.length - 1]?.trim() || ''); }
    } catch { addLog('Erro ao ler o arquivo XLSX.', 'error'); }
  };

  const grouped = React.useMemo(() => {
    const m = new Map();
    osRows.forEach(o => { const f = folderOf(o); if (!m.has(f)) m.set(f, []); m.get(f).push(o); });
    return [...m.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [osRows]);

  const toggleOs        = (folder, osId) => setSelected(prev => { const n = new Set(prev); const k = `${folder}::${osId}`; n.has(k) ? n.delete(k) : n.add(k); return n; });
  const folderOsList    = (folder) => osRows.filter(o => folderOf(o) === folder);
  const allFolderSel    = (folder) => folderOsList(folder).every(o => selected.has(`${folder}::${o.osId}`));
  const someFolderSel   = (folder) => folderOsList(folder).some(o => selected.has(`${folder}::${o.osId}`));
  const toggleFolderAll = (folder) => setSelected(prev => {
    const n = new Set(prev); const list = folderOsList(folder);
    const all = list.every(o => n.has(`${folder}::${o.osId}`));
    list.forEach(o => all ? n.delete(`${folder}::${o.osId}`) : n.add(`${folder}::${o.osId}`));
    return n;
  });

  const buildItems = () => osRows
    .filter(o => selected.has(`${folderOf(o)}::${o.osId}`))
    .map(o => ({ osId: o.osId, cliente: cliMap.get(o.secretaria) || o.cliente, setor: o.setor }));

  const selectedCount = selected.size;

  /* ── Dispara extensão ── */
  const startDownload = async () => {
    const items = buildItems();
    if (!items.length || !credUser || !credPass) return;

    const extFound = await checkExtension();
    if (!extFound) {
      setLog([{ text: 'Extensão "Uniko Faturamento" não encontrada. Instale no Chrome/Opera e recarregue.', type: 'error' }]);
      return;
    }

    collectedRef.current = new Map();
    setRunning(true); setDone(false);
    setLog([{ text: `[${new Date().toLocaleTimeString('pt-BR')}] Iniciando automação em background (${items.length} OS)...`, type: 'info' }]);

    window.postMessage({
      type: 'UNIKO_FAT_START_OS',
      data: { username: credUser, password: credPass, orgName: orgName.trim(), useFolder: true, items },
    }, '*');
  };

  const step1Done = !!mainFile && osRows.length > 0;
  const step2Done = step1Done && selectedCount > 0 && !!orgName.trim();
  const step3Done = step2Done && !!credUser && !!credPass;

  return (
    <div>
      <StellarHero compact
        eyebrow="Automação · 7Benefícios"
        title="Ordens de Serviço"
        subtitle="Baixa o PDF de cada OS em modo headless, organizado por secretaria."
        icon={(
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        )}
      />

      {/* ── Step 1 ── */}
      <Section n={1} title="Envie os relatórios" sub="A coluna ID é detectada automaticamente." done={step1Done}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:T.textS,marginBottom:8}}>
              Relatório de retenção de tributos <span style={{color:T.danger,fontWeight:700}}>*</span>
            </div>
            {!mainFile
              ? <DropZoneXLSX onFile={loadMainFile} label="Relatório de retenção (.xlsx)"/>
              : <FileChip file={mainFile} onRemove={()=>{setMainFile(null);setOsRows([]);setSelected(new Set());setRows([]);setAuxFile(null);setSetorByOs(new Map());}}/>
            }
            {mainFile && osRows.length > 0 && (
              <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,padding:'6px 10px',
                background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{fontSize:12,color:T.textS}}>{osRows.length} OS · col. <strong style={{color:T.text}}>{headers[osIdx]||'ID'}</strong></span>
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
                  <FileChip file={auxFile} onRemove={()=>{setAuxFile(null);setSetorByOs(new Map());if(cliIdx>=0&&osIdx>=0)buildOsRows(rows,cliIdx,osIdx,new Map());}}/>
                  {setorByOs.size > 0 && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,padding:'6px 10px',
                      background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{fontSize:12,color:T.textS}}>{setorByOs.size} OS com setor</span>
                    </div>
                  )}
                </div>
              )
            }
          </div>
        </div>
      </Section>

      {/* ── Step 2 ── */}
      {step1Done && (
        <Section n={2} title="Selecione as Ordens de Serviço" sub="Confira em qual pasta cada OS será salva." done={step2Done}>
          <div style={{display:'grid',gridTemplateColumns:'1.35fr 1fr',gap:24}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textS}}>{selectedCount}/{osRows.length} OS · {grouped.length} pasta{grouped.length!==1?'s':''}</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setSelected(new Set(osRows.map(o=>`${folderOf(o)}::${o.osId}`)))}
                    style={{fontSize:12,color:T.gold,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Todos</button>
                  <button onClick={()=>setSelected(new Set())}
                    style={{fontSize:12,color:T.textT,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Nenhum</button>
                </div>
              </div>
              <div style={{maxHeight:340,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10,background:T.surface}}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',
                  borderBottom:`1px solid ${T.divider}`,background:T.goldGl}}>
                  <FolderIcon color={T.gold}/>
                  <span style={{fontSize:13,fontWeight:700,color:T.text}}>Uniko — Ordens de Serviço</span>
                </div>
                {grouped.map(([folder, list]) => (
                  <div key={folder} style={{borderBottom:`1px solid ${T.divider}`}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px 8px 26px',cursor:'pointer',
                      background:T.goldGl+'66',borderLeft:`2px solid ${T.gold}55`}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                      onMouseLeave={e=>e.currentTarget.style.background=T.goldGl+'66'}>
                      <input type="checkbox" checked={allFolderSel(folder)}
                        ref={el=>{ if(el) el.indeterminate = !allFolderSel(folder) && someFolderSel(folder); }}
                        onChange={()=>toggleFolderAll(folder)}
                        style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                      <FolderIcon color={T.gold} small/>
                      <span style={{fontSize:12.5,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{folder}</span>
                      <span style={{marginLeft:'auto',fontSize:11,color:T.textT,flexShrink:0}}>{list.length} OS</span>
                    </label>
                    {list.map(o => (
                      <label key={o.osId} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 14px 6px 52px',cursor:'pointer',transition:'background .1s'}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <input type="checkbox" checked={selected.has(`${folder}::${o.osId}`)} onChange={()=>toggleOs(folder,o.osId)}
                          style={{accentColor:T.gold,width:13,height:13,cursor:'pointer'}}/>
                        <FileIcon color={T.textD}/>
                        <span style={{fontSize:12,color:T.textS,fontFamily:'monospace'}}>os_{o.osId}.pdf</span>
                      </label>
                    ))}
                  </div>
                ))}
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
        </Section>
      )}

      {/* ── Step 3 ── */}
      {step2Done && (
        <Section n={3} title="Credenciais e download" sub="Usadas apenas para esta automação — não ficam salvas." done={done}>
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
                ? <><div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Baixando {selectedCount} OS...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Baixar {selectedCount} OS</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ZIP baixado!
              </div>
            )}
          </div>
          <Log lines={log}/>
        </Section>
      )}
    </div>
  );
};
