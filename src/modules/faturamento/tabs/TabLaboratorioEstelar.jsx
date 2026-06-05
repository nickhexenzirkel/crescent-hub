import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { T } from '../../../contexts/theme';
import { StellarHero } from '../StellarHero';
import { StarDivider } from '../../../shared/components';

import { checkExtension } from '../../../utils/checkExtension';
import { useCredenciais } from '../../../hooks/useCredenciais';
import { CredenciaisPanel } from '../CredenciaisPanel';
import { CatbotStatus } from '../CatbotStatus';
import { saveFile, loadFile, deleteFile } from '../../../utils/fileStorage';

const KEY_MAIN = 'lab_main';
const KEY_AUX  = 'lab_aux';
const KEY_NF   = 'lab_nf';
const KEY_RR   = 'lab_rr';

/* ── Helpers ── */
const norm = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const readXLSX = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
    } catch (err) { reject(err); }
  };
  reader.readAsArrayBuffer(file);
});

const detectClienteCol = (headers) => {
  const h = headers.map(s => norm(String(s)));
  const idx = h.findIndex(c => c === 'cliente');
  if (idx >= 0) return idx;
  return h.findIndex(col => ['secretaria','orgao','setor','departamento'].some(t => col.includes(t)));
};

const detectOSCol = (headers) => {
  const h = headers.map(s => norm(String(s)));
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

const dateToBR = (d) => {
  if (!d) return '';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
};

const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/* Match PDF filename stem to best folder name */
const matchToFolder = (pdfStem, folders) => {
  const pn = norm(pdfStem);
  for (const f of folders) { if (norm(f) === pn) return f; }
  for (const f of folders) { const fn = norm(f); if (pn.includes(fn) || fn.includes(pn)) return f; }
  const pWords = pn.split(' ').filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const f of folders) {
    const fWords = norm(f).split(' ').filter(w => w.length > 2);
    if (!fWords.length) continue;
    const overlap = fWords.filter(w => pWords.includes(w)).length;
    const score = overlap / Math.max(fWords.length, pWords.length);
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore >= 0.4 ? best : null;
};

/* ── Drop zone XLSX ── */
const DropZoneXLSX = ({ onFile, label }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = useCallback((files) => {
    const f = [...files].find(f => /\.(xlsx|xls)$/i.test(f.name));
    if (f) onFile(f);
  }, [onFile]);
  return (
    <div onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      style={{border:`2px dashed ${drag?T.gold:T.border}`,borderRadius:12,padding:'22px 20px',
        textAlign:'center',cursor:'pointer',background:drag?T.goldGl:T.surface,transition:'all .18s'}}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:8}}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <div style={{fontSize:13,fontWeight:500,color:T.text,marginBottom:3}}>{label}</div>
      <div style={{fontSize:11,color:T.textT}}>Aceita .xlsx e .xls</div>
      <input ref={ref} type="file" accept=".xlsx,.xls" style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) handle(e.target.files); }}/>
    </div>
  );
};

/* ── Drop zone ZIP ── */
const DropZoneZip = ({ onFile, label }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = (files) => {
    const f = [...files].find(f => /\.zip$/i.test(f.name));
    if (f) onFile(f);
  };
  return (
    <div onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      style={{border:`2px dashed ${drag?T.gold:T.border}`,borderRadius:12,padding:'22px 20px',
        textAlign:'center',cursor:'pointer',background:drag?T.goldGl:T.surface,transition:'all .18s'}}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={drag?T.gold:T.textD}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:8}}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <div style={{fontSize:13,fontWeight:500,color:T.text,marginBottom:3}}>{label}</div>
      <div style={{fontSize:11,color:T.textT}}>Aceita .zip</div>
      <input ref={ref} type="file" accept=".zip" style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) handle(e.target.files); }}/>
    </div>
  );
};

const FileChip = ({ name, onRemove }) => (
  <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',
    background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10}}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
    <span style={{fontSize:13,fontWeight:500,color:T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
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
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{background:'#0D1117',borderRadius:10,padding:'16px',height:240,
      overflowY:'auto',fontFamily:'monospace',fontSize:12.5,lineHeight:1.7,border:`1px solid ${T.border}`}}>
      {lines.length === 0
        ? <span style={{color:'#4A5568'}}>// aguardando início...</span>
        : lines.map((l, i) => (
          <div key={i} style={{color:l.type==='error'?'#FC8181':l.type==='ok'?'#68D391':l.type==='info'?'#90CDF4':'#CBD5E0'}}>{l.text}</div>
        ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN TAB
═══════════════════════════════════════════════════════════ */
export const TabLaboratorioEstelar = () => {
  /* ── XLSX state ── */
  const [mainFile, setMainFile]     = useState(null);
  const [rows, setRows]             = useState([]);
  const [headers, setHeaders]       = useState([]);
  const [colIdx, setColIdx]         = useState(-1);
  const [osColIdx, setOsColIdx]     = useState(-1);
  const [clienteMap, setClienteMap] = useState(new Map());
  const [secretarias, setSecretarias] = useState([]);
  const [selected, setSelected]     = useState(new Set());
  const [category, setCategory]     = useState('fuel');
  const [auxFile, setAuxFile]       = useState(null);
  const [setorMap, setSetorMap]     = useState(new Map());
  const [selSetores, setSelSetores] = useState(new Set());

  /* ── Config ── */
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [orgName, setOrgName]     = useState('');
  const creds = useCredenciais();
  const { credUser, credPass } = creds;

  /* ── ZIP inputs ── */
  const [nfFile, setNfFile] = useState(null);
  const [rrFile, setRrFile] = useState(null);
  const nfZipRef = useRef(null);
  const rrZipRef = useRef(null);

  /* ── Runtime ── */
  const [log, setLog]         = useState([]);
  const [phase, setPhase]     = useState('idle'); // idle | rc | os | building | done
  const [finalBlob, setFinalBlob] = useState(null);

  const addLog = (text, type = 'normal') =>
    setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type }]);

  useEffect(() => {
    loadFile(KEY_MAIN).then(f => { if (f) loadMainFile(f); }).catch(() => {});
    loadFile(KEY_AUX).then(f  => { if (f) buildSetorMap(f); }).catch(() => {});
    loadFile(KEY_NF).then(f   => { if (f) loadNfZip(f); }).catch(() => {});
    loadFile(KEY_RR).then(f   => { if (f) loadRrZip(f); }).catch(() => {});
  }, []);

  /* ── XLSX helpers ── */
  const buildSecretarias = (allRows, ci, hdrs) => {
    const isCliente = norm(hdrs?.[ci] || '') === 'cliente';
    const map = new Map();
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

  const buildSetorMap = async (f) => {
    setAuxFile(f);
    saveFile(KEY_AUX, f).catch(() => {});
    try {
      const allRows = await readXLSX(f);
      if (!allRows.length) return;
      const hdrs = allRows[0].map(h => norm(String(h)));
      const cliIdx = hdrs.findIndex(h => h === 'cliente');
      const stIdx  = hdrs.findIndex(h => h === 'setor');
      if (cliIdx < 0 || stIdx < 0) return;
      const map = new Map();
      allRows.slice(1).forEach(r => {
        const cli   = String(r[cliIdx] || '').trim();
        const setor = String(r[stIdx]  || '').trim();
        if (!cli || !setor) return;
        const sec = extractSecretaria(cli);
        if (!map.has(sec)) map.set(sec, new Set());
        map.get(sec).add(setor);
      });
      const final = new Map([...map.entries()].map(([k, v]) => [k, [...v].sort()]));
      setSetorMap(final);
      const allKeys = new Set();
      final.forEach((setores, sec) => setores.forEach(s => allKeys.add(`${sec}::${s}`)));
      setSelSetores(allKeys);
    } catch { /* ignore */ }
  };

  const loadMainFile = async (f) => {
    setMainFile(f);
    saveFile(KEY_MAIN, f).catch(() => {});
    setRows([]); setHeaders([]); setColIdx(-1); setOsColIdx(-1);
    setSecretarias([]); setSelected(new Set()); setClienteMap(new Map());
    // Detecção inicial pelo nome (fallback)
    const fn = f.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (fn.includes('manutenc')) setCategory('service');
    else if (fn.includes('abastec') || fn.includes('combustiv')) setCategory('fuel');
    try {
      const allRows = await readXLSX(f);
      const hdrs = allRows[0].map(c => String(c));
      setHeaders(hdrs);
      setRows(allRows);
      // Detecção pelo conteúdo da planilha (sobrescreve nome do arquivo)
      const normHdrs = hdrs.map(h => norm(String(h)));
      if (normHdrs.some(h => h.includes('abastecimento'))) setCategory('fuel');
      else if (normHdrs.some(h => h.includes('manutenc') || h.includes('pecas'))) setCategory('service');
      const ci = detectClienteCol(hdrs);
      const oi = detectOSCol(hdrs);
      setColIdx(ci); setOsColIdx(oi);
      if (ci >= 0) {
        buildSecretarias(allRows, ci, hdrs);
        const firstRaw = String(allRows[1]?.[ci] || '').trim();
        if (firstRaw) {
          const p = firstRaw.split(' - ');
          setOrgName(p[p.length - 1]?.trim() || '');
        }
      }
    } catch { addLog('Erro ao ler o arquivo XLSX.', 'error'); }
  };

  const temSetor = !!auxFile && setorMap.size > 0;

  /* ── Selection helpers ── */
  const toggleSelect  = (s) => setSelected(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const secSetores    = (sec) => setorMap.get(sec) || [];
  const allSecSel     = (sec) => secSetores(sec).every(s => selSetores.has(`${sec}::${s}`));
  const someSecSel    = (sec) => secSetores(sec).some(s  => selSetores.has(`${sec}::${s}`));
  const toggleSetor   = (sec, setor) => setSelSetores(prev => { const n = new Set(prev); const k = `${sec}::${setor}`; n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleSecAll  = (sec) => setSelSetores(prev => {
    const n = new Set(prev); const ss = secSetores(sec);
    const all = ss.every(s => n.has(`${sec}::${s}`));
    ss.forEach(s => all ? n.delete(`${sec}::${s}`) : n.add(`${sec}::${s}`));
    return n;
  });

  const selectedCount = temSetor ? selSetores.size : selected.size;
  const totalCount    = temSetor ? [...setorMap.values()].reduce((s, v) => s + v.length, 0) : secretarias.length;

  /* ── Derived folder list (what the extension will use as subfolder names) ── */
  const getFolders = () => {
    if (temSetor && setorMap.size > 0) {
      return [...selSetores].map(key => {
        const sep   = key.indexOf('::');
        const sec   = key.slice(0, sep);
        const setor = key.slice(sep + 2);
        return setor ? `${sec} - ${setor}` : sec;
      }).sort();
    }
    return [...selected].sort();
  };

  /* ── RC download items ── */
  const buildRCItems = () => {
    if (temSetor && setorMap.size > 0) {
      return [...selSetores].map(key => {
        const sep = key.indexOf('::');
        return { clienteStr: clienteMap.get(key.slice(0, sep)) || key.slice(0, sep), setor: key.slice(sep + 2) };
      });
    }
    return [...selected].map(name => ({ clienteStr: clienteMap.get(name) || name, setor: '' }));
  };

  /* ── OS download items (manutenção only) ── */
  const buildOSItems = (currentRows, ci, oi, currentClienteMap, currentTemSetor, currentSelSetores, currentSelected) => {
    if (oi < 0 || ci < 0) return [];
    const items = []; const seen = new Set();
    currentRows.slice(1).forEach(r => {
      const cliente = String(r[ci] || '').trim();
      const osId    = String(r[oi] || '').trim();
      if (!cliente || !osId) return;
      const secretaria = extractSecretaria(cliente);
      const key = `${secretaria}::${osId}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (currentTemSetor) {
        const hasAny = [...currentSelSetores].some(k => k.startsWith(secretaria + '::'));
        if (!hasAny) return;
        const setor = [...currentSelSetores].find(k => k.startsWith(secretaria + '::'))?.slice(secretaria.length + 2) || '';
        items.push({ osId, cliente: currentClienteMap.get(secretaria) || cliente, setor });
      } else {
        if (!currentSelected.has(secretaria)) return;
        items.push({ osId, cliente: currentClienteMap.get(secretaria) || cliente, setor: '' });
      }
    });
    return items;
  };

  /* ── ZIP loading ── */
  const loadNfZip = async (f) => {
    setNfFile(f);
    saveFile(KEY_NF, f).catch(() => {});
    try { nfZipRef.current = await JSZip.loadAsync(f); }
    catch { addLog('Erro ao ler ZIP de Notas Fiscais.', 'error'); }
  };

  const loadRrZip = async (f) => {
    setRrFile(f);
    saveFile(KEY_RR, f).catch(() => {});
    try { rrZipRef.current = await JSZip.loadAsync(f); }
    catch { addLog('Erro ao ler ZIP de Retenção.', 'error'); }
  };

  /* ── In-memory PDF collection ── */
  const collectedRCRef = useRef(new Map()); // folder → [{filename, base64}]
  const collectedOSRef = useRef(new Map());
  const phaseRef       = useRef('idle');

  /* ── Extension event listener ── */
  useEffect(() => {
    const handler = (e) => {
      const { type, log: l } = e.data || {};
      if (!type?.startsWith('FAT_')) return;
      if (type === 'FAT_LOG' && l)  setLog(prev => [...prev, l]);
      if (type === 'FAT_ERROR')     { phaseRef.current = 'idle'; setPhase('idle'); }
      if (type === 'FAT_SAVE_FILE') {
        const { id, filename, base64, subfolder } = e.data;
        const folder = subfolder ? subfolder.split('/')[0] : filename.replace(/\.[^.]+$/, '');
        const store  = phaseRef.current === 'rc' ? collectedRCRef.current : collectedOSRef.current;
        if (!store.has(folder)) store.set(folder, []);
        store.get(folder).push({ filename, base64 });
        window.postMessage({ type: 'UNIKO_FAT_SAVE_RESULT', id, ok: true }, '*');
      }
      if (type === 'FAT_DONE') {
        if (phaseRef.current === 'rc') {
          if (phaseRef._cat === 'service') {
            const items = phaseRef._osItems;
            if (items?.length) {
              phaseRef.current = 'os';
              setPhase('os');
              setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString('pt-BR')}] Iniciando ${items.length} OS...`, type: 'info' }]);
              window.postMessage({ type: 'UNIKO_FAT_START_OS', data: { username: phaseRef._user, password: phaseRef._pass, orgName: phaseRef._org, useFolder: true, items } }, '*');
            } else { runBuildZip(); }
          } else { runBuildZip(); }
        } else if (phaseRef.current === 'os') {
          runBuildZip();
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const runBuildZip = () => {
    buildZip(collectedRCRef.current, collectedOSRef.current, phaseRef._folders, phaseRef._cat);
  };

  /* ── Build ZIP final ── */
  const buildZip = async (collectedRC, collectedOS, folders, cat) => {
    setPhase('building');
    addLog(`Organizando ${folders.length} pasta${folders.length!==1?'s':''}...`, 'info');

    const nfEntries = [], rrEntries = [];
    if (nfZipRef.current) nfZipRef.current.forEach((path, e) => { if (!e.dir && /\.pdf$/i.test(path)) nfEntries.push({ path, stem: path.split('/').pop().replace(/\.[^.]+$/, '') }); });
    if (rrZipRef.current) rrZipRef.current.forEach((path, e) => { if (!e.dir && /\.pdf$/i.test(path)) rrEntries.push({ path, stem: path.split('/').pop().replace(/\.[^.]+$/, '') }); });

    const outZip = new JSZip();
    const secDir = outZip.folder('Uniko Secretarias');
    const nfDir  = outZip.folder('Uniko Notas Fiscais');
    let assembled = 0;

    for (const folder of folders) {
      const docSlots = [];

      /* 1 — Nota Fiscal */
      const nfMatch = matchToFolder(folder, nfEntries.map(e => e.stem));
      if (nfMatch) {
        const bytes = await nfZipRef.current.file(nfEntries.find(e => e.stem === nfMatch).path)?.async('arraybuffer');
        if (bytes) docSlots.push({ label: '1 - Nota Fiscal', bytes });
      } else {
        setLog(prev => [...prev, { text: `  ⚠ NF não encontrada: ${folder}`, type: 'error' }]);
      }

      /* 2 — Relatório de Consumo */
      const extraRcFiles = [];
      for (const { filename, base64 } of (collectedRC.get(folder) || [])) {
        const bytes = b64ToBytes(base64).buffer;
        if (/\.pdf$/i.test(filename)) {
          docSlots.push({ label: '2 - Relatorio de Consumo', bytes });
        } else {
          const ext = filename.slice(filename.lastIndexOf('.')) || '';
          extraRcFiles.push({ name: `2 - Relatorio de Consumo - ${folder}${ext}`, bytes });
        }
      }
      if (!collectedRC.has(folder)) setLog(prev => [...prev, { text: `  ⚠ RC não encontrado: ${folder}`, type: 'error' }]);

      /* 3 — Retenção de Tributos */
      const rrMatch = matchToFolder(folder, rrEntries.map(e => e.stem));
      if (rrMatch) {
        const bytes = await rrZipRef.current.file(rrEntries.find(e => e.stem === rrMatch).path)?.async('arraybuffer');
        if (bytes) docSlots.push({ label: '3 - Relatorio de Retencao', bytes });
      } else {
        setLog(prev => [...prev, { text: `  ⚠ RR não encontrado: ${folder}`, type: 'error' }]);
      }

      /* 4 — Ordem de Serviço */
      if (cat === 'service') {
        for (const { base64 } of (collectedOS.get(folder) || [])) {
          docSlots.push({ label: '4 - Ordem de Servico', bytes: b64ToBytes(base64).buffer });
        }
        if (!collectedOS.has(folder)) setLog(prev => [...prev, { text: `  ⚠ OS não encontrada: ${folder}`, type: 'error' }]);
      }

      if (!docSlots.length) continue;

      const folderDir = secDir.folder(folder);
      for (const { label, bytes } of docSlots) folderDir.file(`${label} - ${folder}.pdf`, bytes);
      for (const { name, bytes } of extraRcFiles) folderDir.file(name, bytes);

      try {
        const merged = await PDFDocument.create();
        let pageCount = 0;
        for (const { label, bytes } of docSlots) {
          try {
            const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => merged.addPage(p));
            pageCount += pages.length;
          } catch (loadErr) {
            setLog(prev => [...prev, { text: `  ⚠ Falha ao ler "${label}" (${folder}): ${loadErr.message}`, type: 'error' }]);
          }
        }
        if (pageCount === 0) {
          setLog(prev => [...prev, { text: `  ✗ "${folder}" — sem páginas válidas, PDF ignorado`, type: 'error' }]);
        } else {
          const nfNumber = nfMatch ? (nfMatch.match(/\d+/)?.[0] || '') : '';
          const nfFileName = nfNumber ? `NF ${nfNumber} - ${folder}.pdf` : `${folder}.pdf`;
          nfDir.file(nfFileName, await merged.save());
          assembled++;
          setLog(prev => [...prev, { text: `  ✓ ${nfFileName}`, type: 'ok' }]);
        }
      } catch (err) {
        setLog(prev => [...prev, { text: `  Erro ao mesclar "${folder}": ${err.message}`, type: 'error' }]);
      }
    }

    addLog('Gerando ZIP final...', 'info');
    const blob = await outZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    setFinalBlob(blob);
    setPhase('done');
    addLog(`Concluído! ${assembled} secretaria${assembled!==1?'s':''} organizadas.`, 'ok');
  };

  /* ── Start automation ── */
  const startDownload = async () => {
    const extStatus = await checkExtension();
    if (extStatus === 'reload') {
      setLog([{ text: 'Extensão desconectada após atualização — recarregue a página (F5) e tente novamente.', type: 'error' }]);
      return;
    }
    if (!extStatus) {
      setLog([{ text: 'Extensão "Uniko Faturamento" não encontrada. Instale no Chrome/Opera e recarregue.', type: 'error' }]);
      return;
    }

    collectedRCRef.current = new Map();
    collectedOSRef.current = new Map();
    setLog([]);
    setFinalBlob(null);
    phaseRef.current  = 'rc';
    phaseRef._cat     = category;
    phaseRef._user    = credUser;
    phaseRef._pass    = credPass;
    phaseRef._org     = orgName.trim();
    phaseRef._folders = getFolders();
    phaseRef._osItems = buildOSItems(rows, colIdx, osColIdx, clienteMap, temSetor, selSetores, selected);
    setPhase('rc');
    addLog(`Iniciando automação em background (${selectedCount} item${selectedCount!==1?'s':''})...`, 'info');

    window.postMessage({
      type: 'UNIKO_FAT_START',
      data: {
        username: credUser, password: credPass,
        startDate: dateToBR(startDate), endDate: dateToBR(endDate),
        category, downloadItems: buildRCItems(), orgName: orgName.trim(),
        useFolder: true,
      },
    }, '*');
  };

  const downloadZip = () => {
    if (!finalBlob) return;
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Uniko_Laboratorio_Estelar.zip'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  /* ── Step gating ── */
  const step1Done = !!mainFile && secretarias.length > 0;
  const step2Done = step1Done && !!startDate && !!endDate && selectedCount > 0;
  const step3Done = step2Done && !!nfFile && !!rrFile;
  const step4Done = step3Done && !!credUser && !!credPass;
  const running   = phase === 'rc' || phase === 'os' || phase === 'building';

  return (
    <div>
      <StellarHero compact
        eyebrow="Automação completa · 7Benefícios"
        title="Laboratório Estelar"
        subtitle="Baixa RC e OS automaticamente, organiza com NF e RR e gera um ZIP completo por secretaria."
        icon={(
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        )}
      />

      {/* ── Step 1 — XLSX ── */}
      <Section n={1} title="Relatório de tributos" sub="Detecta secretarias e IDs de OS (para manutenção)." done={step1Done}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:T.textS,marginBottom:8}}>
              Relatório principal <span style={{color:T.danger,fontWeight:700}}>*</span>
            </div>
            {!mainFile
              ? <DropZoneXLSX onFile={loadMainFile} label="Relatório de retenção (.xlsx)"/>
              : <FileChip name={mainFile.name} onRemove={() => { setMainFile(null); setSecretarias([]); setSelected(new Set()); setRows([]); setSetorMap(new Map()); setAuxFile(null); setSelSetores(new Set()); deleteFile(KEY_MAIN).catch(()=>{}); deleteFile(KEY_AUX).catch(()=>{}); }}/>
            }
            {mainFile && secretarias.length > 0 && (
              <div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,padding:'6px 10px',
                background:'rgba(26,156,112,.10)',border:'1px solid rgba(26,156,112,.28)',borderRadius:8}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{fontSize:12,color:T.textS}}>
                  {temSetor ? totalCount : secretarias.length} {temSetor ? 'setor' : 'secretaria'}{(temSetor ? totalCount : secretarias.length) !== 1 ? 's' : ''} · col. <strong style={{color:T.text}}>{headers[colIdx]||'Cliente'}</strong>
                  {osColIdx >= 0 && <span style={{color:T.textT}}> · OS: <strong style={{color:T.text}}>{headers[osColIdx]||'ID'}</strong></span>}
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
              ? <DropZoneXLSX onFile={buildSetorMap} label="Relatório por organização (opcional)..."/>
              : <FileChip name={auxFile.name} onRemove={() => { setAuxFile(null); setSetorMap(new Map()); setSelSetores(new Set()); deleteFile(KEY_AUX).catch(()=>{}); }}/>
            }
            {mainFile && (
              <div style={{marginTop:14,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:12.5,color:T.textS}}>Categoria:</span>
                <div style={{display:'flex',gap:6}}>
                  {[{v:'fuel',l:'Abastecimento'},{v:'service',l:'Manutenção'}].map(({v,l}) => (
                    <button key={v} onClick={() => setCategory(v)}
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

      {/* ── Step 2 — Período + seleção ── */}
      {step1Done && (
        <Section n={2} title="Período e secretarias" sub="Selecione o intervalo e as secretarias a processar." done={step2Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Lista */}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:T.textS}}>{selectedCount}/{totalCount} selecionado{selectedCount!==1?'s':''}</span>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => {
                    if (temSetor) { const all = new Set(); setorMap.forEach((ss,sec)=>ss.forEach(s=>all.add(`${sec}::${s}`))); setSelSetores(all); }
                    else setSelected(new Set(secretarias));
                  }} style={{fontSize:12,color:T.gold,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Todos</button>
                  <button onClick={() => { if(temSetor) setSelSetores(new Set()); else setSelected(new Set()); }}
                    style={{fontSize:12,color:T.textT,background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Nenhum</button>
                </div>
              </div>
              <div style={{maxHeight:220,overflowY:'auto',border:`1px solid ${T.border}`,borderRadius:10,background:T.surface}}>
                {temSetor && setorMap.size > 0 ? (
                  [...setorMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([sec, setores]) => (
                    <div key={sec} style={{borderBottom:`1px solid ${T.divider}`}}>
                      <label style={{display:'flex',alignItems:'center',gap:9,padding:'9px 14px',cursor:'pointer',background:T.goldGl+'88'}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                        onMouseLeave={e=>e.currentTarget.style.background=T.goldGl+'88'}>
                        <input type="checkbox" checked={allSecSel(sec)}
                          ref={el=>{ if(el) el.indeterminate = !allSecSel(sec) && someSecSel(sec); }}
                          onChange={() => toggleSecAll(sec)}
                          style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>{sec}</span>
                        <span style={{marginLeft:'auto',fontSize:11,color:T.textT}}>{setores.length} setor{setores.length!==1?'es':''}</span>
                      </label>
                      {setores.map(setor => (
                        <label key={setor} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 14px 7px 36px',cursor:'pointer',transition:'background .1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <input type="checkbox" checked={selSetores.has(`${sec}::${setor}`)} onChange={() => toggleSetor(sec, setor)}
                            style={{accentColor:T.gold,width:14,height:14,cursor:'pointer'}}/>
                          <span style={{fontSize:12,color:T.textS}}>{setor}</span>
                        </label>
                      ))}
                    </div>
                  ))
                ) : (
                  secretarias.map(s => (
                    <label key={s} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${T.divider}`,transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.goldGl}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <input type="checkbox" checked={selected.has(s)} onChange={() => toggleSelect(s)}
                        style={{accentColor:T.gold,width:15,height:15,cursor:'pointer'}}/>
                      <span style={{fontSize:13,color:T.text}}>{s}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Datas + orgName */}
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

      {/* ── Step 3 — ZIPs de NF e RR ── */}
      {step2Done && (
        <Section n={3} title="ZIPs de Notas Fiscais e Retenção" sub="Envie os dois ZIPs com os PDFs para cruzamento." done={step3Done}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <div style={{fontSize:12.5,fontWeight:600,color:T.textS,marginBottom:8}}>
                ZIP — Notas Fiscais <span style={{color:T.danger,fontWeight:700}}>*</span>
              </div>
              {!nfFile
                ? <DropZoneZip onFile={loadNfZip} label="ZIP com PDFs de Nota Fiscal"/>
                : <FileChip name={nfFile.name} onRemove={() => { setNfFile(null); nfZipRef.current = null; deleteFile(KEY_NF).catch(()=>{}); }}/>
              }
            </div>
            <div>
              <div style={{fontSize:12.5,fontWeight:600,color:T.textS,marginBottom:8}}>
                ZIP — Retenção de Tributos <span style={{color:T.danger,fontWeight:700}}>*</span>
              </div>
              {!rrFile
                ? <DropZoneZip onFile={loadRrZip} label="ZIP com PDFs de Retenção"/>
                : <FileChip name={rrFile.name} onRemove={() => { setRrFile(null); rrZipRef.current = null; deleteFile(KEY_RR).catch(()=>{}); }}/>
              }
            </div>
          </div>
          <div style={{marginTop:12,padding:'10px 14px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:10}}>
            <span style={{fontSize:12,color:T.textS}}>
              Os PDFs são associados às secretarias pelo nome do arquivo. Nomeie os PDFs com o nome da secretaria para melhor correspondência.
            </span>
          </div>
        </Section>
      )}

      {/* ── Step 4 — Credenciais + processar ── */}
      {step3Done && (
        <Section n={4} title="Credenciais e processamento" sub="As credenciais ficam salvas no navegador." done={phase === 'done'}>

          <div style={{marginBottom:20}}>
            <CredenciaisPanel {...creds}/>
          </div>

          {/* Estrutura do ZIP (preview estático) */}
          {phase === 'idle' && (
            <div style={{marginBottom:20,padding:'14px 16px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:12}}>
              <div style={{fontSize:12.5,fontWeight:600,color:T.text,marginBottom:10}}>ZIP gerado:</div>
              <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:12,color:T.textS,fontFamily:'monospace',marginBottom:4}}>📁 Uniko Secretarias/</div>
                  <div style={{fontSize:12,color:T.textT,fontFamily:'monospace',paddingLeft:14}}>📁 SECRETARIA/</div>
                  {['1 - Nota Fiscal','2 - Relatorio de Consumo','3 - Relatorio de Retencao',
                    ...(category==='service'?['4 - Ordem de Servico']:[])]
                    .map((l,i) => <div key={i} style={{fontSize:11.5,color:T.textT,fontFamily:'monospace',paddingLeft:28}}>📄 {l}.pdf</div>)}
                </div>
                <div>
                  <div style={{fontSize:12,color:T.textS,fontFamily:'monospace',marginBottom:4}}>📁 Uniko Notas Fiscais/</div>
                  <div style={{fontSize:11.5,color:T.textT,fontFamily:'monospace',paddingLeft:14}}>📄 SECRETARIA.pdf</div>
                  <div style={{fontSize:11,color:T.textD,fontFamily:'monospace',paddingLeft:14,marginTop:2}}>(todos mesclados em ordem)</div>
                </div>
              </div>
            </div>
          )}

          {/* Indicador de fase */}
          {running && (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',
              background:'rgba(90,160,255,0.08)',border:'1px solid rgba(90,160,255,0.2)',borderRadius:10,marginBottom:16}}>
              <div style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(90,160,255,.4)',borderTopColor:'#90CDF4',animation:'spin .7s linear infinite',flexShrink:0}}/>
              <span style={{fontSize:13,color:'#90CDF4',fontWeight:500}}>
                {phase === 'rc'       && 'Baixando Relatórios de Consumo...'}
                {phase === 'os'       && 'Baixando Ordens de Serviço...'}
                {phase === 'building' && 'Montando ZIP final...'}
              </span>
            </div>
          )}

          {/* Botões */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20,flexWrap:'wrap'}}>
            <button onClick={startDownload} disabled={running || !step4Done || phase === 'done'}
              style={{display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,border:'none',
                background:(running||!step4Done||phase==='done')?T.textD:T.gold,color:'#fff',
                fontSize:15,fontWeight:700,cursor:(running||!step4Done||phase==='done')?'not-allowed':'pointer',
                fontFamily:'var(--font-body)',transition:'all .15s',
                boxShadow:(running||!step4Done||phase==='done')?'none':`0 4px 16px ${T.gold}44`}}>
              {running
                ? <><div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Processando...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Iniciar processamento</>}
            </button>

            {phase === 'done' && (
              <button onClick={downloadZip}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,
                  border:'1.5px solid #1A9C70',background:'rgba(26,156,112,.10)',color:'#1A9C70',
                  fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .15s'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Baixar ZIP final
              </button>
            )}

            {phase === 'done' && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Concluído!
              </div>
            )}
          </div>

          <CatbotStatus
            phase={phase === 'idle' ? 'idle' : phase}
            doneText={log.filter(l => l.type === 'ok').length
              ? `${log.filter(l => l.type === 'ok').length} secretaria${log.filter(l => l.type === 'ok').length !== 1 ? 's' : ''} organizadas! ZIP pronto.`
              : undefined}
          />
          <Log lines={log}/>
        </Section>
      )}
    </div>
  );
};
