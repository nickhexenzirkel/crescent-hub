import { useState, useRef } from 'react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';

/* ── Helpers ──────────────────────────────────────────────── */

// Extrai o número inicial do nome do arquivo (ex: "1 - Nota Fiscal.pdf" → 1)
const fileOrder = (name) => {
  const m = name.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
};

// Remove extensão
const stem = (name) => name.replace(/\.[^.]+$/, '');

// Gera download de um Blob
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/* ── Drop Zone ZIP ────────────────────────────────────────── */
const DropZoneZip = ({ onFile }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = (files) => {
    const f = [...files].find(f => /\.zip$/i.test(f.name));
    if (f) onFile(f);
  };
  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      style={{
        border:`2px dashed ${drag ? T.gold : T.border}`, borderRadius:14,
        padding:'32px 24px', textAlign:'center', cursor:'pointer',
        background:drag ? T.goldGl : T.surface, transition:'all .18s',
      }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
        stroke={drag ? T.gold : T.textD} strokeWidth="1.5" strokeLinecap="round"
        strokeLinejoin="round" style={{marginBottom:10}}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <div style={{fontSize:14,fontWeight:500,color:T.text,marginBottom:4}}>
        Arraste ou clique para selecionar o arquivo ZIP
      </div>
      <div style={{fontSize:12,color:T.textT}}>Aceita apenas .zip</div>
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

/* ── Log terminal ─────────────────────────────────────────── */
const Log = ({ lines }) => {
  const ref = useRef();
  if (!lines.length) return null;
  return (
    <div ref={ref}
      style={{background:'#0D1117',borderRadius:10,padding:'14px 16px',maxHeight:220,
        overflowY:'auto',fontFamily:'monospace',fontSize:12.5,lineHeight:1.7,
        border:`1px solid ${T.border}`,marginTop:18}}>
      {lines.map((l, i) => (
        <div key={i} style={{color:l.type==='error'?'#FC8181':l.type==='ok'?'#68D391':l.type==='info'?'#90CDF4':'#CBD5E0'}}>
          {l.text}
        </div>
      ))}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   MODO 1 — COMPILADOR
   ZIP de entrada: pastas com PDFs numerados (1-4).
   Saída: ZIP com um PDF mesclado por pasta.
──────────────────────────────────────────────────────────── */
const ModoCompilador = () => {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState([]); // [{ folder, files[] }]
  const [log,     setLog]     = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const zipRef = useRef(null);

  const addLog = (text, type = 'normal') =>
    setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type }]);

  const loadZip = async (f) => {
    setFile(f); setPreview([]); setLog([]); setDone(false);
    try {
      const zip = await JSZip.loadAsync(f);
      zipRef.current = zip;

      // Agrupa arquivos por pasta de primeiro nível
      const folders = new Map();
      zip.forEach((path, entry) => {
        if (entry.dir) return;
        if (!/\.pdf$/i.test(path)) return;
        const parts = path.split('/');
        const folder = parts.length > 1 ? parts[0] : '(raiz)';
        const fname  = parts[parts.length - 1];
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder).push(fname);
      });

      // Ordena arquivos dentro de cada pasta
      const sorted = [...folders.entries()].map(([folder, files]) => ({
        folder,
        files: [...files].sort((a, b) => fileOrder(a) - fileOrder(b)),
      })).sort((a, b) => a.folder.localeCompare(b.folder));

      setPreview(sorted);
    } catch {
      addLog('Erro ao ler o ZIP. Verifique se o arquivo está correto.', 'error');
    }
  };

  const compile = async () => {
    if (!preview.length || !zipRef.current) return;
    setRunning(true); setDone(false);
    setLog([]);
    addLog('Iniciando compilação...', 'info');

    const outZip = new JSZip();
    let total = 0;

    for (const { folder, files } of preview) {
      addLog(`Compilando: ${folder} (${files.length} PDF${files.length !== 1 ? 's' : ''})...`);
      try {
        const merged = await PDFDocument.create();

        for (const fname of files) {
          const path = folder === '(raiz)' ? fname : `${folder}/${fname}`;
          const bytes = await zipRef.current.file(path)?.async('arraybuffer');
          if (!bytes) { addLog(`  ⚠ Não encontrado: ${fname}`, 'error'); continue; }
          try {
            const doc  = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const idxs = doc.getPageIndices();
            const pages = await merged.copyPages(doc, idxs);
            pages.forEach(p => merged.addPage(p));
          } catch {
            addLog(`  ⚠ Falha ao processar: ${fname}`, 'error');
          }
        }

        const pdfBytes = await merged.save();
        outZip.file(`${folder}.pdf`, pdfBytes);
        total++;
        addLog(`  ✓ ${folder}.pdf`, 'ok');
      } catch (err) {
        addLog(`  Erro em "${folder}": ${err.message}`, 'error');
      }
    }

    addLog(`Gerando ZIP de saída...`, 'info');
    const blob = await outZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, 'Uniko_Compilado.zip');
    addLog(`Concluído! ${total} PDF${total !== 1 ? 's' : ''} compilado${total !== 1 ? 's' : ''} e baixados.`, 'ok');
    setRunning(false); setDone(true);
  };

  const LABELS = ['Nota Fiscal', 'Transações', 'Relatório de Retenção', 'Ordem de Serviço'];

  return (
    <div>
      {/* Upload */}
      {!file
        ? <DropZoneZip onFile={loadZip}/>
        : <FileChip name={file.name} onRemove={() => { setFile(null); setPreview([]); setLog([]); setDone(false); zipRef.current = null; }}/>
      }

      {/* Legenda */}
      {!file && (
        <div style={{marginTop:16,padding:'14px 16px',background:T.goldGl,border:`1px solid ${T.gold}22`,borderRadius:12}}>
          <div style={{fontSize:12.5,fontWeight:600,color:T.text,marginBottom:8}}>Estrutura esperada do ZIP:</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {LABELS.map((l, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:22,height:22,borderRadius:6,background:T.goldGl,border:`1px solid ${T.gold}44`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:11,fontWeight:700,color:T.gold,flexShrink:0}}>{i+1}</div>
                <span style={{fontSize:12.5,color:T.textS}}>{l}{i === 3 ? <span style={{color:T.textT}}> (manutenção)</span> : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pré-visualização */}
      {preview.length > 0 && (
        <div style={{marginTop:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600,color:T.textS}}>
              {preview.length} pasta{preview.length !== 1 ? 's' : ''} detectada{preview.length !== 1 ? 's' : ''}
            </span>
            <span style={{fontSize:12,color:T.textT}}>
              {preview.reduce((s, f) => s + f.files.length, 0)} PDFs no total
            </span>
          </div>

          <div style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:'hidden',background:T.surface}}>
            {preview.map(({ folder, files }, fi) => (
              <div key={folder} style={{borderBottom: fi < preview.length-1 ? `1px solid ${T.divider}` : 'none'}}>
                {/* Cabeçalho da pasta */}
                <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 16px',background:T.goldGl+'66'}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                  <span style={{fontSize:13,fontWeight:600,color:T.text,flex:1}}>{folder}</span>
                  <span style={{fontSize:11,color:T.textT,flexShrink:0}}>→ {stem(folder)}.pdf</span>
                </div>
                {/* Arquivos */}
                {files.map((fname, i) => (
                  <div key={fname} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 16px 6px 38px',
                    borderTop:`1px solid ${T.divider}`}}>
                    <div style={{width:18,height:18,borderRadius:5,background:T.goldGl,border:`1px solid ${T.gold}33`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:10,fontWeight:700,color:T.gold,flexShrink:0}}>{i + 1}</div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{fontSize:12,color:T.textS}}>{fname}</span>
                    {i < files.length - 1 && <span style={{marginLeft:'auto',fontSize:11,color:T.textT,flexShrink:0}}>↓</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Botão */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginTop:18}}>
            <button onClick={compile} disabled={running}
              style={{display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,
                border:'none',background:running?T.textD:T.gold,color:'#fff',
                fontSize:15,fontWeight:700,cursor:running?'not-allowed':'pointer',
                fontFamily:'var(--font-body)',transition:'all .15s',
                boxShadow:running?'none':`0 4px 16px ${T.gold}44`}}>
              {running
                ? <><div style={{width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Compilando...</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Compilar e baixar ZIP</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ZIP baixado!
              </div>
            )}
          </div>
        </div>
      )}

      <Log lines={log}/>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   MODO 2 — ORGANIZADOR
   ZIP de entrada: PDFs soltos.
   Saída: ZIP onde cada PDF está dentro de uma pasta com o
          mesmo nome do PDF (sem extensão).
──────────────────────────────────────────────────────────── */
const ModoOrganizador = () => {
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState([]); // [{ pdfName, folder }]
  const [log,     setLog]     = useState([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const zipRef = useRef(null);

  const addLog = (text, type = 'normal') =>
    setLog(prev => [...prev, { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type }]);

  const loadZip = async (f) => {
    setFile(f); setPreview([]); setLog([]); setDone(false);
    try {
      const zip = await JSZip.loadAsync(f);
      zipRef.current = zip;

      const pdfs = [];
      zip.forEach((path, entry) => {
        if (entry.dir || !/\.pdf$/i.test(path)) return;
        // Usa apenas o nome do arquivo (ignora subpastas existentes no ZIP)
        const fname  = path.split('/').pop();
        const folder = stem(fname);
        pdfs.push({ path, pdfName: fname, folder });
      });

      pdfs.sort((a, b) => a.pdfName.localeCompare(b.pdfName));
      setPreview(pdfs);
    } catch {
      addLog('Erro ao ler o ZIP. Verifique se o arquivo está correto.', 'error');
    }
  };

  const organize = async () => {
    if (!preview.length || !zipRef.current) return;
    setRunning(true); setDone(false);
    setLog([]);
    addLog('Iniciando organização...', 'info');

    const outZip = new JSZip();

    for (const { path, pdfName, folder } of preview) {
      try {
        const bytes = await zipRef.current.file(path)?.async('arraybuffer');
        if (!bytes) { addLog(`⚠ Não encontrado: ${pdfName}`, 'error'); continue; }
        outZip.file(`${folder}/${pdfName}`, bytes);
        addLog(`✓ ${folder}/${pdfName}`, 'ok');
      } catch (err) {
        addLog(`Erro em "${pdfName}": ${err.message}`, 'error');
      }
    }

    addLog('Gerando ZIP de saída...', 'info');
    const blob = await outZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, 'Uniko_Organizado.zip');
    addLog(`Concluído! ${preview.length} PDF${preview.length !== 1 ? 's' : ''} organizados.`, 'ok');
    setRunning(false); setDone(true);
  };

  return (
    <div>
      {/* Upload */}
      {!file
        ? <DropZoneZip onFile={loadZip}/>
        : <FileChip name={file.name} onRemove={() => { setFile(null); setPreview([]); setLog([]); setDone(false); zipRef.current = null; }}/>
      }

      {/* Pré-visualização */}
      {preview.length > 0 && (
        <div style={{marginTop:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600,color:T.textS}}>
              {preview.length} PDF{preview.length !== 1 ? 's' : ''} detectado{preview.length !== 1 ? 's' : ''}
            </span>
            <span style={{fontSize:12,color:T.textT}}>Cada PDF → sua própria pasta</span>
          </div>

          <div style={{border:`1px solid ${T.border}`,borderRadius:12,overflow:'hidden',background:T.surface,maxHeight:320,overflowY:'auto'}}>
            {/* Raiz fictícia */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',
              background:T.goldGl,borderBottom:`1px solid ${T.divider}`}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
              <span style={{fontSize:13,fontWeight:700,color:T.text}}>Uniko_Organizado.zip</span>
            </div>

            {preview.map(({ pdfName, folder }, fi) => (
              <div key={pdfName} style={{borderBottom: fi < preview.length-1 ? `1px solid ${T.divider}` : 'none'}}>
                {/* Pasta */}
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 16px 7px 28px',
                  background:T.goldGl+'55',borderBottom:`1px solid ${T.divider}`}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  </svg>
                  <span style={{fontSize:12,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{folder}</span>
                </div>
                {/* Arquivo */}
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 16px 6px 48px'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span style={{fontSize:12,color:T.textS,fontFamily:'monospace'}}>{pdfName}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Botão */}
          <div style={{display:'flex',alignItems:'center',gap:14,marginTop:18}}>
            <button onClick={organize} disabled={running}
              style={{display:'flex',alignItems:'center',gap:10,padding:'12px 28px',borderRadius:12,
                border:'none',background:running?T.textD:T.gold,color:'#fff',
                fontSize:15,fontWeight:700,cursor:running?'not-allowed':'pointer',
                fontFamily:'var(--font-body)',transition:'all .15s',
                boxShadow:running?'none':`0 4px 16px ${T.gold}44`}}>
              {running
                ? <><div style={{width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',animation:'spin .7s linear infinite'}}/> Organizando...</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Organizar e baixar ZIP</>}
            </button>
            {done && (
              <div style={{display:'flex',alignItems:'center',gap:8,color:'#1A9C70',fontSize:14,fontWeight:500}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A9C70" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ZIP baixado!
              </div>
            )}
          </div>
        </div>
      )}

      <Log lines={log}/>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   MAIN TAB — Uniko PDF
──────────────────────────────────────────────────────────── */
const MODOS = [
  {
    id: 'compilador',
    label: 'Compilador',
    desc: 'Mescla os PDFs de cada pasta em ordem em um único arquivo por secretaria.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    id: 'organizador',
    label: 'Organizador',
    desc: 'Cria uma pasta para cada PDF presente no ZIP, com o mesmo nome do arquivo.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
];

export const TabUnikoPDF = () => {
  const [modo, setModo] = useState('compilador');

  return (
    <div>
      <StellarHero compact
        eyebrow="Processamento de PDF"
        title="Uniko PDF"
        subtitle="Compile e organize PDFs a partir de arquivos ZIP de forma automática."
        icon={(
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M9 13h6M9 17h4"/>
          </svg>
        )}
      />

      {/* Seletor de modo */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:22}}>
        {MODOS.map(m => {
          const active = modo === m.id;
          return (
            <button key={m.id} onClick={() => setModo(m.id)} style={{
              display:'flex',alignItems:'flex-start',gap:14,padding:'18px 20px',
              borderRadius:16,border:`1.5px solid ${active ? T.gold : T.border}`,
              background:active ? T.goldGl : T.surface,
              cursor:'pointer',textAlign:'left',fontFamily:'var(--font-body)',
              transition:'all .18s',boxShadow:active ? `0 0 0 3px ${T.gold}18` : T.sh,
              outline:'none',
            }}>
              <div style={{width:42,height:42,borderRadius:12,flexShrink:0,
                background:active?T.gold:T.goldGl,
                border:`1px solid ${active?T.gold:T.gold+'33'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                color:active?'#fff':T.gold,transition:'all .18s'}}>
                {m.icon}
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:active?T.gold:T.text,marginBottom:4}}>{m.label}</div>
                <div style={{fontSize:12.5,color:T.textS,lineHeight:1.5}}>{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <StarDivider my={0} dim/>
      <div style={{marginTop:18}}>
        {modo === 'compilador' ? <ModoCompilador/> : <ModoOrganizador/>}
      </div>
    </div>
  );
};
