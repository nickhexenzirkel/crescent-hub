import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { T } from '../../contexts/theme';
import rubricaUrl from '../../assets/assinatura-evando.png';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ─── Ícone inline ─── */
const I = (p) => (
  <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

const uid = () => Math.random().toString(36).slice(2, 10);

/* hex "#1A2B3C" → {r,g,b} em 0..1 para pdf-lib */
const hexToRgb01 = (hex) => {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return { r: ((n>>16)&255)/255, g: ((n>>8)&255)/255, b: (n&255)/255 };
};

/* Mapeia alguns caracteres fora do WinAnsi para equivalentes seguros */
const sanitizeWinAnsi = (s) => (s || '')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .replace(new RegExp(String.fromCharCode(160),'g'), ' ');

const SIG_STORE = 'oficina_assinaturas_salvas';
const loadSavedSigs = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SIG_STORE) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
};
const persistSavedSigs = (list) => {
  try { localStorage.setItem(SIG_STORE, JSON.stringify(list)); } catch { /* ignora */ }
};

const COLORS = ['#111111', '#1A6FB5', '#C04050', '#1A9C70', '#C4872A', '#8B5FE8', '#ffffff'];

/* ════════════════════════════════════════════════════════════════
   Canvas de uma página (render via pdf.js)
════════════════════════════════════════════════════════════════ */
const PdfCanvas = ({ pdf, index, scale }) => {
  const ref = useRef();
  useEffect(() => {
    let task;
    (async () => {
      try {
        const page = await pdf.getPage(index + 1);
        const dpr  = window.devicePixelRatio || 1;
        const vp   = page.getViewport({ scale: scale * dpr });
        const cv   = ref.current;
        if (!cv) return;
        cv.width  = vp.width;
        cv.height = vp.height;
        cv.style.width  = (vp.width / dpr) + 'px';
        cv.style.height = (vp.height / dpr) + 'px';
        task = page.render({ canvasContext: cv.getContext('2d'), viewport: vp });
        await task.promise;
      } catch { /* render cancelado */ }
    })();
    return () => { try { task && task.cancel(); } catch { /* ok */ } };
  }, [pdf, index, scale]);
  return <canvas ref={ref} style={{ display:'block' }}/>;
};

/* ════════════════════════════════════════════════════════════════
   Modal de Assinatura (Desenhar / Upload + salvas)
════════════════════════════════════════════════════════════════ */
const SignatureModal = ({ onClose, onUse }) => {
  const [mode, setMode]   = useState('desenhar');
  const [drawn, setDrawn] = useState(null);
  // a rúbrica padrão (ASSINATURA EV. JR) sempre encabeça a lista
  const [saved, setSaved] = useState(() => {
    const list = loadSavedSigs().filter(s => s.id !== 'default-ev');
    return [{ id:'default-ev', name:'ASSINATURA EV. JR', dataUrl: rubricaUrl }, ...list];
  });
  const [repeat, setRepeat] = useState(false);
  const canvasRef = useRef();
  const drawing   = useRef(false);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e) => { drawing.current = true; const c=canvasRef.current.getContext('2d'); const {x,y}=pos(e); c.beginPath(); c.moveTo(x,y); };
  const draw  = (e) => {
    if (!drawing.current) return;
    const c = canvasRef.current.getContext('2d');
    const {x,y} = pos(e);
    c.lineWidth = 2.4; c.lineCap='round'; c.strokeStyle = '#10367e';
    c.lineTo(x,y); c.stroke();
  };
  const end = () => { drawing.current = false; setDrawn(canvasRef.current.toDataURL('image/png')); };
  const clearDraw = () => { const cv=canvasRef.current; cv.getContext('2d').clearRect(0,0,cv.width,cv.height); setDrawn(null); };

  const onUpload = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setDrawn(r.result);
    r.readAsDataURL(file);
  };

  const saveToList = (dataUrl) => {
    const item = { id: uid(), name: 'Assinatura ' + new Date().toLocaleDateString('pt-BR'), dataUrl };
    const next = [item, ...saved.filter(s => s.id !== 'default-ev')];
    setSaved([saved.find(s=>s.id==='default-ev'), ...next].filter(Boolean));
    persistSavedSigs(next);
  };
  const removeSaved = (id) => {
    const next = saved.filter(s => s.id !== id && s.id !== 'default-ev');
    setSaved([saved.find(s=>s.id==='default-ev'), ...next].filter(Boolean));
    persistSavedSigs(next);
  };

  const useDrawn = () => {
    if (!drawn) return;
    saveToList(drawn);
    onUse(drawn, repeat);
  };

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(10,16,30,.55)',backdropFilter:'blur(3px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.surface,borderRadius:16,width:'100%',maxWidth:540,boxShadow:'0 20px 60px rgba(0,0,0,.4)',border:`1px solid ${T.border}`,overflow:'hidden'}}>
        <div style={{padding:'18px 22px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:T.gold}}><I size={20}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I></span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:T.text}}>Assinatura</div>
            <div style={{fontSize:12.5,color:T.textT}}>Desenhe ou faça upload de uma imagem</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:T.textD,fontSize:20,lineHeight:1}}>×</button>
        </div>

        <div style={{padding:'18px 22px'}}>
          {/* tabs */}
          <div style={{display:'flex',gap:18,borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
            {[['desenhar','✏️ Desenhar'],['upload','🖼️ Upload de Imagem']].map(([id,label]) => (
              <button key={id} onClick={()=>setMode(id)}
                style={{background:'none',border:'none',cursor:'pointer',padding:'4px 2px 10px',fontSize:13.5,
                  fontWeight: mode===id?700:500, color: mode===id?T.gold:T.textT,
                  borderBottom: mode===id?`2px solid ${T.gold}`:'2px solid transparent',marginBottom:-1,fontFamily:'var(--font-body)'}}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'desenhar' ? (
            <div>
              <div style={{border:`2px dashed ${T.gold}88`,borderRadius:12,background:'#fff'}}>
                <canvas ref={canvasRef} width={480} height={150}
                  onPointerDown={start} onPointerMove={draw} onPointerUp={end} onPointerLeave={end}
                  style={{width:'100%',height:150,touchAction:'none',cursor:'crosshair',display:'block'}}/>
              </div>
              <div style={{fontSize:11.5,color:T.textD,marginTop:8}}>Desenhe sua assinatura no quadro acima.</div>
            </div>
          ) : (
            <div>
              <label style={{display:'block',border:`2px dashed ${T.border}`,borderRadius:12,padding:'24px',textAlign:'center',cursor:'pointer',background:T.surfaceSub||'transparent'}}>
                <input type="file" accept="image/png,image/jpeg" style={{display:'none'}}
                  onChange={e=>onUpload(e.target.files[0])}/>
                {drawn
                  ? <img src={drawn} alt="prévia" style={{maxHeight:110,maxWidth:'100%',objectFit:'contain'}}/>
                  : <div style={{color:T.textT,fontSize:13.5}}>⬆️ Clique para enviar uma imagem PNG/JPG</div>}
              </label>
              <div style={{fontSize:11.5,color:T.textD,marginTop:8}}>Dica: use uma imagem PNG com fundo transparente para melhor resultado.</div>
            </div>
          )}

          {/* salvas */}
          <div style={{marginTop:18}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:8}}>Assinaturas Salvas</div>
            {saved.length === 0 && <div style={{fontSize:12.5,color:T.textD}}>Nenhuma assinatura salva ainda.</div>}
            {saved.map(s => (
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:`1px solid ${T.border}`,borderRadius:9,marginBottom:6,background:'#fff'}}>
                <img src={s.dataUrl} alt={s.name} style={{height:26,maxWidth:120,objectFit:'contain'}}/>
                <span style={{flex:1,fontSize:12.5,color:T.text}}>{s.name}</span>
                <button onClick={()=>onUse(s.dataUrl, repeat)}
                  style={{background:T.gold,color:'#fff',border:'none',borderRadius:7,padding:'5px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Usar</button>
                {s.id !== 'default-ev' && (
                  <button onClick={()=>removeSaved(s.id)} title="Excluir"
                    style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:15}}>🗑</button>
                )}
              </div>
            ))}
          </div>

          <label style={{display:'flex',alignItems:'center',gap:8,marginTop:14,fontSize:13,color:T.textS,cursor:'pointer'}}>
            <input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/>
            Repetir em todas as páginas
          </label>
        </div>

        <div style={{padding:'14px 22px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{background:'none',border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 18px',fontSize:13.5,color:T.textS,cursor:'pointer',fontFamily:'var(--font-body)'}}>Cancelar</button>
          {mode==='desenhar' && <button onClick={clearDraw} style={{background:'none',border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 18px',fontSize:13.5,color:T.danger,cursor:'pointer',fontFamily:'var(--font-body)'}}>Limpar</button>}
          <button onClick={useDrawn} disabled={!drawn}
            style={{background:drawn?T.gold:'transparent',color:drawn?'#fff':T.textD,border:drawn?'none':`1px solid ${T.border}`,borderRadius:9,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:drawn?'pointer':'not-allowed',fontFamily:'var(--font-body)'}}>Usar Assinatura</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   EDITOR DE PDF
════════════════════════════════════════════════════════════════ */
export const PdfEditor = () => {
  const [fileName, setFileName] = useState('');
  const [pdf, setPdf]       = useState(null);
  const [pages, setPages]   = useState([]);          // [{w,h}] em pontos
  const [scale, setScale]   = useState(1.3);
  const [annos, setAnnos]   = useState([]);
  const [selId, setSelId]   = useState(null);
  const [tool, setTool]     = useState('select');     // select | text
  const [activePage, setActivePage] = useState(0);
  const [sigOpen, setSigOpen] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [canUndo, setCanUndo] = useState(false);

  const srcRef    = useRef(null);   // Uint8Array original
  const scaleRef  = useRef(scale);
  const annosRef  = useRef(annos);
  const histRef   = useRef([]);     // snapshots p/ desfazer
  const dragRef   = useRef(null);
  const fileInput = useRef();
  const imgInput  = useRef();

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { annosRef.current = annos; }, [annos]);

  const pushHistory = useCallback(() => {
    histRef.current.push(JSON.stringify(annosRef.current));
    if (histRef.current.length > 50) histRef.current.shift();
    setCanUndo(true);
  }, []);
  const undo = () => {
    const prev = histRef.current.pop();
    if (prev != null) { setAnnos(JSON.parse(prev)); setSelId(null); }
    setCanUndo(histRef.current.length > 0);
  };
  const deleteAnno = useCallback((id) => {
    pushHistory();
    setAnnos(p => p.filter(a => a.id !== id));
    setSelId(null);
  }, [pushHistory]);

  const sel = annos.find(a => a.id === selId) || null;

  /* ── abrir PDF ── */
  const openFile = async (file) => {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const ab  = await file.arrayBuffer();
      const src = new Uint8Array(ab);
      srcRef.current = src;
      const doc = await pdfjsLib.getDocument({ data: src.slice() }).promise;
      const pgs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        pgs.push({ w: vp.width, h: vp.height });
      }
      setPdf(doc); setPages(pgs); setFileName(file.name);
      setAnnos([]); setSelId(null); histRef.current = []; setCanUndo(false); setActivePage(0);
    } catch (e) {
      setError('Não foi possível abrir o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── adicionar anotações ── */
  const addText = (pageIdx, xPt, yPt) => {
    pushHistory();
    const id = uid();
    setAnnos(p => [...p, { id, page: pageIdx, type:'text', x:xPt, y:yPt, w:200, text:'Texto', fontSize:14, color:'#111111' }]);
    setSelId(id); setTool('select');
  };
  const addImageAnno = (dataUrl, type, repeat=false) => {
    const img = new Image();
    img.onload = () => {
      pushHistory();
      const aspect = img.width / img.height;
      const targetPages = repeat ? pages.map((_,i)=>i) : [activePage];
      const newOnes = targetPages.map(pi => {
        const pg = pages[pi];
        const w = Math.min(180, pg.w * 0.4);
        const h = w / aspect;
        return { id: uid(), page: pi, type, x:(pg.w-w)/2, y:(pg.h-h)/2, w, h, src:dataUrl };
      });
      setAnnos(p => [...p, ...newOnes]);
      if (!repeat) setSelId(newOnes[0].id);
    };
    img.src = dataUrl;
  };

  const onPageClick = (pageIdx, e) => {
    setActivePage(pageIdx);
    if (tool === 'text') {
      const r = e.currentTarget.getBoundingClientRect();
      addText(pageIdx, (e.clientX - r.left)/scale, (e.clientY - r.top)/scale);
    } else {
      setSelId(null);
    }
  };

  const updateAnno = (id, patch) => setAnnos(p => p.map(a => a.id===id ? {...a, ...patch} : a));

  /* ── drag / resize ── */
  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current; if (!d) return;
      const s = scaleRef.current;
      const dx = (e.clientX - d.sx)/s, dy = (e.clientY - d.sy)/s;
      setAnnos(prev => prev.map(a => {
        if (a.id !== d.id) return a;
        if (d.mode === 'move')   return { ...a, x: d.ox+dx, y: d.oy+dy };
        if (d.mode === 'resizeW')return { ...a, w: Math.max(40, d.ow+dx) };
        if (d.mode === 'resizeI'){ const w=Math.max(24,d.ow+dx); return { ...a, w, h: w/d.aspect }; }
        return a;
      }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  const startDrag = (e, a, mode) => {
    e.stopPropagation();
    setSelId(a.id); pushHistory();
    dragRef.current = { id:a.id, mode, sx:e.clientX, sy:e.clientY, ox:a.x, oy:a.y, ow:a.w, oh:a.h, aspect:(a.w/(a.h||1)) };
  };

  /* ── salvar (achata via pdf-lib) ── */
  const salvar = async () => {
    if (!srcRef.current) return;
    setBusy(true); setError('');
    try {
      const doc  = await PDFDocument.load(srcRef.current.slice());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const docPages = doc.getPages();

      // cache de imagens embutidas por dataUrl
      const imgCache = {};
      const embed = async (dataUrl) => {
        if (imgCache[dataUrl]) return imgCache[dataUrl];
        const isPng = dataUrl.startsWith('data:image/png');
        const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
        const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        imgCache[dataUrl] = img; return img;
      };

      for (const a of annos) {
        const pg = docPages[a.page]; if (!pg) continue;
        const H = pg.getHeight();
        if (a.type === 'text') {
          const { r, g, b } = hexToRgb01(a.color);
          const fs = a.fontSize;
          const lh = fs * 1.18;
          const lines = sanitizeWinAnsi(a.text).split('\n');
          lines.forEach((line, k) => {
            const yTop = a.y + fs + k*lh;          // baseline a partir do topo
            try {
              pg.drawText(line, { x:a.x, y:H - yTop, size:fs, font, color:rgb(r,g,b) });
            } catch { /* caractere não suportado — ignora a linha */ }
          });
        } else {
          const img = await embed(a.src);
          pg.drawImage(img, { x:a.x, y:H - a.y - a.h, width:a.w, height:a.h });
        }
      }

      const out  = await doc.save();
      const blob = new Blob([out], { type:'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const el   = document.createElement('a');
      el.href = url; el.download = (fileName.replace(/\.pdf$/i,'') || 'documento') + '_editado.pdf';
      document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      setError('Erro ao salvar: ' + (e?.message || 'desconhecido'));
    } finally { setBusy(false); }
  };

  /* delete por teclado */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) {
        const a = annosRef.current.find(x => x.id === selId);
        if (a && !(a.type === 'text' && document.activeElement?.tagName === 'TEXTAREA')) {
          e.preventDefault(); deleteAnno(selId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, deleteAnno]);

  /* ── sem arquivo: tela de abertura ── */
  if (!pdf) {
    return (
      <div style={{maxWidth:560}}>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:24}}>
          Carregue um PDF para editar em tempo real: adicione texto, imagens e assinaturas, mova e redimensione, e baixe o resultado.
        </p>
        <input ref={fileInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>openFile(e.target.files[0])}/>
        <div onClick={()=>fileInput.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault(); openFile(e.dataTransfer.files[0]);}}
          style={{border:`2px dashed ${T.border}`,borderRadius:14,padding:'48px 32px',textAlign:'center',cursor:'pointer',background:T.surface}}>
          {busy ? <div style={{color:T.textS}}>Abrindo...</div> : (
            <>
              <div style={{fontSize:34,marginBottom:10}}>📄</div>
              <div style={{fontSize:15,fontWeight:500,color:T.text,marginBottom:6}}>Solte o PDF aqui ou clique para selecionar</div>
              <div style={{fontSize:13,color:T.textT}}>Formato aceito: <strong style={{color:T.textS}}>.pdf</strong></div>
            </>
          )}
        </div>
        {error && <div style={{marginTop:16,padding:'12px 16px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>{error}</div>}
      </div>
    );
  }

  /* ── editor ── */
  const tbBtn = (active) => ({
    display:'inline-flex',alignItems:'center',gap:7,padding:'8px 13px',borderRadius:9,
    border:`1px solid ${active?T.gold:T.border}`, background: active?T.goldGl:'transparent',
    color: active?T.gold:T.textS, fontSize:13,fontWeight: active?600:500,cursor:'pointer',
    fontFamily:'var(--font-body)',transition:'all .14s',whiteSpace:'nowrap',
  });

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'10px 12px',marginBottom:14,position:'sticky',top:0,zIndex:50}}>
        <button style={{...tbBtn(false)}} onClick={()=>fileInput.current?.click()}>
          <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></I> Abrir PDF
        </button>
        <input ref={fileInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>openFile(e.target.files[0])}/>
        <button style={{...tbBtn(false),background:T.gold,color:'#fff',border:'none'}} onClick={salvar} disabled={busy}>
          <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>
          {busy ? 'Salvando...' : 'Salvar como...'}
        </button>

        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>

        <button style={tbBtn(tool==='text')} onClick={()=>setTool(tool==='text'?'select':'text')}>
          <I><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></I> Texto
        </button>
        <button style={tbBtn(false)} onClick={()=>imgInput.current?.click()}>
          <I><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></I> Imagem
        </button>
        <input ref={imgInput} type="file" accept="image/png,image/jpeg" style={{display:'none'}}
          onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=()=>addImageAnno(r.result,'image'); r.readAsDataURL(f); } e.target.value=''; }}/>
        <button style={tbBtn(false)} onClick={()=>setSigOpen(true)}>
          <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I> Assinatura
        </button>

        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>

        <button style={tbBtn(false)} onClick={undo} disabled={!canUndo}>
          <I><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></I> Desfazer
        </button>
        <button style={{...tbBtn(false),color:T.danger,borderColor:`${T.danger}55`}} onClick={()=>{ pushHistory(); setAnnos([]); setSelId(null); }}>
          <I><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></I> Excluir tudo
        </button>

        <div style={{flex:1}}/>

        {/* zoom */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button style={{...tbBtn(false),padding:'7px 11px'}} onClick={()=>setScale(s=>Math.max(0.5,+(s-0.1).toFixed(2)))}>−</button>
          <span style={{fontSize:13,color:T.textS,minWidth:46,textAlign:'center'}}>{Math.round(scale*100)}%</span>
          <button style={{...tbBtn(false),padding:'7px 11px'}} onClick={()=>setScale(s=>Math.min(3,+(s+0.1).toFixed(2)))}>+</button>
        </div>
      </div>

      {error && <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>{error}</div>}

      <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
        {/* Miniaturas */}
        <div style={{width:120,flexShrink:0,maxHeight:'72vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:8,paddingRight:4}}>
          {pages.map((p,i)=>(
            <div key={i} onClick={()=>{ setActivePage(i); document.getElementById('pdfpg-'+i)?.scrollIntoView({behavior:'smooth',block:'start'}); }}
              style={{cursor:'pointer',border:`2px solid ${activePage===i?T.gold:T.border}`,borderRadius:8,overflow:'hidden',background:'#fff',position:'relative'}}>
              <PdfCanvas pdf={pdf} index={i} scale={0.16}/>
              <div style={{position:'absolute',bottom:2,right:4,fontSize:10,color:T.textT,background:'rgba(255,255,255,.8)',borderRadius:4,padding:'0 4px'}}>{i+1}</div>
            </div>
          ))}
        </div>

        {/* Páginas */}
        <div style={{flex:1,maxHeight:'72vh',overflow:'auto',background:T.page,borderRadius:12,padding:'16px',border:`1px solid ${T.border}`}}>
          {pages.map((p,i)=>(
            <div key={i} id={'pdfpg-'+i} style={{margin:'0 auto 18px',width:p.w*scale,boxShadow:'0 4px 18px rgba(0,0,0,.14)'}}>
              <div style={{position:'relative',width:p.w*scale,height:p.h*scale}}>
                <PdfCanvas pdf={pdf} index={i} scale={scale}/>
                {/* camada de edição */}
                <div onClick={(e)=>onPageClick(i,e)}
                  style={{position:'absolute',inset:0,cursor: tool==='text'?'text':'default'}}>
                  {annos.filter(a=>a.page===i).map(a => {
                    const selected = a.id===selId;
                    if (a.type === 'text') {
                      return (
                        <div key={a.id} style={{position:'absolute',left:a.x*scale,top:a.y*scale,width:a.w*scale}}
                          onClick={e=>{e.stopPropagation(); setSelId(a.id);}}>
                          {selected && (
                            <div onPointerDown={e=>startDrag(e,a,'move')}
                              style={{position:'absolute',top:-16,left:0,height:14,padding:'0 6px',background:T.gold,color:'#fff',fontSize:10,borderRadius:'4px 4px 0 0',cursor:'move',display:'flex',alignItems:'center',gap:4,userSelect:'none'}}>
                              ✛ mover
                            </div>
                          )}
                          <textarea value={a.text}
                            onFocus={()=>{ setSelId(a.id); pushHistory(); }}
                            onChange={e=>{ updateAnno(a.id,{text:e.target.value}); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                            spellCheck={false}
                            style={{width:'100%',resize:'none',overflow:'hidden',border: selected?`1px solid ${T.gold}`:'1px solid transparent',
                              outline:'none',background:'transparent',padding:0,margin:0,lineHeight:1.18,
                              fontFamily:'Helvetica, Arial, sans-serif',fontSize:a.fontSize*scale,color:a.color,
                              boxShadow: selected?`0 0 0 2px ${T.gold}22`:'none'}}/>
                          {selected && (
                            <div onPointerDown={e=>startDrag(e,a,'resizeW')}
                              style={{position:'absolute',right:-5,top:'50%',width:10,height:10,marginTop:-5,background:'#fff',border:`2px solid ${T.gold}`,borderRadius:'50%',cursor:'ew-resize'}}/>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={a.id} onClick={e=>{e.stopPropagation(); setSelId(a.id);}}
                        onPointerDown={e=>startDrag(e,a,'move')}
                        style={{position:'absolute',left:a.x*scale,top:a.y*scale,width:a.w*scale,height:a.h*scale,
                          cursor:'move',outline:selected?`1.5px solid ${T.gold}`:'1px dashed rgba(0,0,0,.15)'}}>
                        <img src={a.src} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}}/>
                        {selected && (
                          <div onPointerDown={e=>startDrag(e,a,'resizeI')}
                            style={{position:'absolute',right:-6,bottom:-6,width:12,height:12,background:'#fff',border:`2px solid ${T.gold}`,borderRadius:'50%',cursor:'nwse-resize'}}/>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Propriedades */}
        <div style={{width:190,flexShrink:0}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:12}}>Propriedades</div>
            {!sel && <div style={{fontSize:12.5,color:T.textD,lineHeight:1.6}}>Selecione um elemento para editar, ou use a barra para adicionar texto, imagem e assinatura.</div>}
            {sel && sel.type==='text' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <div style={{fontSize:11.5,color:T.textT,marginBottom:6}}>Tamanho da fonte: {sel.fontSize}px</div>
                  <input type="range" min="8" max="48" value={sel.fontSize}
                    onChange={e=>updateAnno(sel.id,{fontSize:+e.target.value})} style={{width:'100%'}}/>
                </div>
                <div>
                  <div style={{fontSize:11.5,color:T.textT,marginBottom:6}}>Cor</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {COLORS.map(c=>(
                      <button key={c} onClick={()=>updateAnno(sel.id,{color:c})}
                        style={{width:22,height:22,borderRadius:6,background:c,cursor:'pointer',
                          border: sel.color===c?`2px solid ${T.gold}`:`1px solid ${T.border}`}}/>
                    ))}
                  </div>
                </div>
                <button onClick={()=>deleteAnno(sel.id)} style={{background:'none',border:`1px solid ${T.danger}55`,color:T.danger,borderRadius:8,padding:'8px',fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>Excluir elemento</button>
              </div>
            )}
            {sel && sel.type!=='text' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{fontSize:12.5,color:T.textS}}>{sel.type==='signature'?'Assinatura':'Imagem'} selecionada. Arraste para mover e use a alça para redimensionar.</div>
                <button onClick={()=>deleteAnno(sel.id)} style={{background:'none',border:`1px solid ${T.danger}55`,color:T.danger,borderRadius:8,padding:'8px',fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>Excluir elemento</button>
              </div>
            )}
          </div>
          <div style={{fontSize:11.5,color:T.textD,marginTop:10,lineHeight:1.5,padding:'0 4px'}}>
            {fileName} · {pages.length} página{pages.length!==1?'s':''}
          </div>
        </div>
      </div>

      {sigOpen && (
        <SignatureModal
          onClose={()=>setSigOpen(false)}
          onUse={(dataUrl, repeat)=>{ addImageAnno(dataUrl,'signature',repeat); setSigOpen(false); }}
        />
      )}
    </div>
  );
};
