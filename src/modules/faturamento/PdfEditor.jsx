import { useState, useRef, useEffect, useCallback } from 'react';
import {
  PDFDocument, StandardFonts, rgb,
  pushGraphicsState, popGraphicsState, beginText, endText, showText,
  setFontAndSize, setFillingRgbColor, setTextMatrix,
} from 'pdf-lib';
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
const NBSP = String.fromCharCode(160);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const hexToRgb01 = (hex) => {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return { r: ((n>>16)&255)/255, g: ((n>>8)&255)/255, b: (n&255)/255 };
};

const sanitizeWinAnsi = (s) => (s || '')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .split(NBSP).join(' ');

const cssFamily = (serif) => serif
  ? 'Georgia, "Times New Roman", serif'
  : 'Arial, Helvetica, sans-serif';

/* mede largura de texto (px) numa fonte — usado para corrigir a largura (scaleX) */
let _measureCtx = null;
const measureW = (str, fs, serif, bold, italic) => {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  _measureCtx.font = `${italic?'italic ':''}${bold?'700 ':''}${fs}px ${cssFamily(serif)}`;
  return _measureCtx.measureText(str || '').width || 1;
};
/* fator de escala horizontal para o texto da camada bater com a largura original */
const scaleXFor = (a) => {
  if (!a.isOriginal || !a.orig) return 1;
  return clamp(a.w / measureW(a.orig, a.fs, a.serif, a.bold, a.italic), 0.25, 4);
};

const SIG_STORE = 'oficina_assinaturas_salvas';
const loadSavedSigs = () => {
  try { const r = JSON.parse(localStorage.getItem(SIG_STORE) || '[]'); return Array.isArray(r)?r:[]; }
  catch { return []; }
};
const persistSavedSigs = (l) => { try { localStorage.setItem(SIG_STORE, JSON.stringify(l)); } catch { /* ignora */ } };

const COLORS = ['#111111', '#1A6FB5', '#C04050', '#1A9C70', '#C4872A', '#8B5FE8', '#ffffff'];

const WHITE_BG = { hex:'#ffffff', r:255, g:255, b:255 };
const SAMPLE_SCALE = 1.5;
const RENDER_QUALITY = 2;   // superamostragem do canvas → letras mais nítidas

/* Cache em memória (persiste o trabalho ao trocar de aba / sair e voltar,
   enquanto o app não for recarregado) */
const editorCache = { src:null, pages:null, annos:null, fileName:'', scale:1.3 };

/* Cor dominante (= fundo) dentro de um retângulo de uma ImageData.
   Os pixels de fundo superam os do texto, então a moda é a cor do fundo. */
const dominantColor = (img, x0, y0, x1, y1) => {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(img.width, Math.ceil(x1)); y1 = Math.min(img.height, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return WHITE_BG;
  const counts = new Map();
  for (let y = y0; y < y1; y++) {
    let base = (y*img.width + x0) * 4;
    for (let x = x0; x < x1; x++, base += 4) {
      const key = (img.data[base] << 16) | (img.data[base+1] << 8) | img.data[base+2];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  let best = -1, bk = 0xFFFFFF;
  for (const [k, v] of counts) if (v > best) { best = v; bk = k; }
  const r = (bk>>16)&255, g = (bk>>8)&255, b = bk&255;
  return { hex: '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''), r, g, b };
};

/* Carrega um PDF (bytes) e extrai páginas + trechos de texto com posição,
   tamanho, estilo e cor de fundo local. Usado ao abrir e ao adicionar PDF. */
const extractFrom = async (src) => {
  const doc = await pdfjsLib.getDocument({ data: src.slice() }).promise;
  const pgs = [], items = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    pgs.push({ w: vp.width, h: vp.height });
    const sample = await renderSample(page);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const str = it.str;
      if (!str || !str.trim()) continue;
      const tr = it.transform;
      const fs = Math.hypot(tr[2], tr[3]) || it.height || 12;
      const style = (tc.styles && tc.styles[it.fontName]) || {};
      const asc = (style.ascent != null ? style.ascent : 0.8) * fs;
      const desc = (style.descent != null ? Math.abs(style.descent) : 0.2) * fs;
      const top = vp.height - tr[5] - asc;
      const bold = /bold|black|heavy|semibold/i.test(it.fontName || '');
      const italic = /italic|oblique/i.test(it.fontName || '');
      const bg = sample
        ? dominantColor(sample, tr[4]*SAMPLE_SCALE, top*SAMPLE_SCALE, (tr[4]+it.width)*SAMPLE_SCALE, (top+fs*1.3)*SAMPLE_SCALE)
        : WHITE_BG;
      items.push({
        id: uid(), page: i-1, type:'text', isOriginal:true,
        x: tr[4], top, fs, asc, desc, w: it.width, serif:false, bold, italic, str, orig: str, color:'#111111', bg,
      });
    }
  }
  return { doc, pgs, items };
};

/* Renderiza a página numa ImageData (para amostrar o fundo atrás de cada texto) */
const renderSample = async (page) => {
  try {
    const vp = page.getViewport({ scale: SAMPLE_SCALE });
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.floor(vp.width));
    cv.height = Math.max(1, Math.floor(vp.height));
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return ctx.getImageData(0, 0, cv.width, cv.height);
  } catch { return null; }
};

/* ════════════════════════════════════════════════════════════════
   Canvas de uma página (render via pdf.js)
════════════════════════════════════════════════════════════════ */
const PdfCanvas = ({ pdf, index, scale, quality = 1 }) => {
  const ref = useRef();
  useEffect(() => {
    let task;
    (async () => {
      try {
        const page = await pdf.getPage(index + 1);
        const dpr  = (window.devicePixelRatio || 1) * (quality || 1);
        const vp   = page.getViewport({ scale: scale * dpr });
        const cv   = ref.current;
        if (!cv) return;
        cv.width = vp.width; cv.height = vp.height;
        cv.style.width = (vp.width/dpr)+'px'; cv.style.height = (vp.height/dpr)+'px';
        task = page.render({ canvasContext: cv.getContext('2d'), viewport: vp });
        await task.promise;
      } catch { /* cancelado */ }
    })();
    return () => { try { task && task.cancel(); } catch { /* ok */ } };
  }, [pdf, index, scale, quality]);
  return <canvas ref={ref} style={{ display:'block' }}/>;
};

/* ════════════════════════════════════════════════════════════════
   Texto editável (sincroniza o DOM sem resetar o cursor ao digitar)
════════════════════════════════════════════════════════════════ */
const EditableText = ({ value, style, onFocus, onClickSel, onInput }) => {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  });
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning spellCheck={false}
      onFocus={onFocus} onClick={onClickSel}
      onInput={e=>onInput(e.currentTarget.textContent)} style={style}/>
  );
};

/* ════════════════════════════════════════════════════════════════
   Modal de Assinatura
════════════════════════════════════════════════════════════════ */
const SignatureModal = ({ onClose, onUse }) => {
  const [mode, setMode]   = useState('desenhar');
  const [drawn, setDrawn] = useState(null);
  const [saved, setSaved] = useState(() => {
    const list = loadSavedSigs().filter(s => s.id !== 'default-ev');
    return [{ id:'default-ev', name:'ASSINATURA EV. JR', dataUrl: rubricaUrl }, ...list];
  });
  const [repeat, setRepeat] = useState(false);
  const canvasRef = useRef();
  const drawing   = useRef(false);

  const pos = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; };
  const start = (e) => { drawing.current = true; const c=canvasRef.current.getContext('2d'); const {x,y}=pos(e); c.beginPath(); c.moveTo(x,y); };
  const draw  = (e) => { if (!drawing.current) return; const c=canvasRef.current.getContext('2d'); const {x,y}=pos(e); c.lineWidth=2.4; c.lineCap='round'; c.strokeStyle='#10367e'; c.lineTo(x,y); c.stroke(); };
  const end   = () => { drawing.current=false; setDrawn(canvasRef.current.toDataURL('image/png')); };
  const clearDraw = () => { const cv=canvasRef.current; cv.getContext('2d').clearRect(0,0,cv.width,cv.height); setDrawn(null); };
  const onUpload = (file) => { if(!file) return; const r=new FileReader(); r.onload=()=>setDrawn(r.result); r.readAsDataURL(file); };

  const saveToList = (dataUrl) => {
    const item = { id: uid(), name:'Assinatura '+new Date().toLocaleDateString('pt-BR'), dataUrl };
    const def = saved.find(s=>s.id==='default-ev');
    const next = [item, ...saved.filter(s=>s.id!=='default-ev')];
    setSaved([def, ...next].filter(Boolean)); persistSavedSigs(next);
  };
  const removeSaved = (id) => {
    const def = saved.find(s=>s.id==='default-ev');
    const next = saved.filter(s=>s.id!==id && s.id!=='default-ev');
    setSaved([def, ...next].filter(Boolean)); persistSavedSigs(next);
  };
  const useDrawn = () => { if(!drawn) return; saveToList(drawn); onUse(drawn, repeat); };

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
          <div style={{display:'flex',gap:18,borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
            {[['desenhar','✏️ Desenhar'],['upload','🖼️ Upload de Imagem']].map(([id,label]) => (
              <button key={id} onClick={()=>setMode(id)}
                style={{background:'none',border:'none',cursor:'pointer',padding:'4px 2px 10px',fontSize:13.5,fontWeight:mode===id?700:500,color:mode===id?T.gold:T.textT,borderBottom:mode===id?`2px solid ${T.gold}`:'2px solid transparent',marginBottom:-1,fontFamily:'var(--font-body)'}}>{label}</button>
            ))}
          </div>
          {mode==='desenhar' ? (
            <div>
              <div style={{border:`2px dashed ${T.gold}88`,borderRadius:12,background:'#fff'}}>
                <canvas ref={canvasRef} width={480} height={150} onPointerDown={start} onPointerMove={draw} onPointerUp={end} onPointerLeave={end}
                  style={{width:'100%',height:150,touchAction:'none',cursor:'crosshair',display:'block'}}/>
              </div>
              <div style={{fontSize:11.5,color:T.textD,marginTop:8}}>Desenhe sua assinatura no quadro acima.</div>
            </div>
          ) : (
            <div>
              <label style={{display:'block',border:`2px dashed ${T.border}`,borderRadius:12,padding:'24px',textAlign:'center',cursor:'pointer',background:T.surfaceSub||'transparent'}}>
                <input type="file" accept="image/png,image/jpeg" style={{display:'none'}} onChange={e=>onUpload(e.target.files[0])}/>
                {drawn ? <img src={drawn} alt="prévia" style={{maxHeight:110,maxWidth:'100%',objectFit:'contain'}}/> : <div style={{color:T.textT,fontSize:13.5}}>⬆️ Clique para enviar uma imagem PNG/JPG</div>}
              </label>
              <div style={{fontSize:11.5,color:T.textD,marginTop:8}}>Dica: use uma imagem PNG com fundo transparente.</div>
            </div>
          )}
          <div style={{marginTop:18}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:8}}>Assinaturas Salvas</div>
            {saved.map(s => (
              <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:`1px solid ${T.border}`,borderRadius:9,marginBottom:6,background:'#fff'}}>
                <img src={s.dataUrl} alt={s.name} style={{height:26,maxWidth:120,objectFit:'contain'}}/>
                <span style={{flex:1,fontSize:12.5,color:T.text}}>{s.name}</span>
                <button onClick={()=>onUse(s.dataUrl, repeat)} style={{background:T.gold,color:'#fff',border:'none',borderRadius:7,padding:'5px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Usar</button>
                {s.id!=='default-ev' && <button onClick={()=>removeSaved(s.id)} title="Excluir" style={{background:'none',border:'none',cursor:'pointer',color:T.danger,fontSize:15}}>🗑</button>}
              </div>
            ))}
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,marginTop:14,fontSize:13,color:T.textS,cursor:'pointer'}}>
            <input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> Repetir em todas as páginas
          </label>
        </div>
        <div style={{padding:'14px 22px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{background:'none',border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 18px',fontSize:13.5,color:T.textS,cursor:'pointer',fontFamily:'var(--font-body)'}}>Cancelar</button>
          {mode==='desenhar' && <button onClick={clearDraw} style={{background:'none',border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 18px',fontSize:13.5,color:T.danger,cursor:'pointer',fontFamily:'var(--font-body)'}}>Limpar</button>}
          <button onClick={useDrawn} disabled={!drawn} style={{background:drawn?T.gold:'transparent',color:drawn?'#fff':T.textD,border:drawn?'none':`1px solid ${T.border}`,borderRadius:9,padding:'9px 18px',fontSize:13.5,fontWeight:600,cursor:drawn?'pointer':'not-allowed',fontFamily:'var(--font-body)'}}>Usar Assinatura</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   EDITOR DE PDF
════════════════════════════════════════════════════════════════ */
export const PdfEditor = ({ onDoc }) => {
  const [fileName, setFileName] = useState('');
  const [pdf, setPdf]       = useState(null);
  const [pages, setPages]   = useState([]);
  const [scale, setScale]   = useState(1.3);
  const [annos, setAnnos]   = useState([]);
  const [selId, setSelId]   = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [tool, setTool]     = useState('select');
  const [activePage, setActivePage] = useState(0);
  const [sigOpen, setSigOpen] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [canUndo, setCanUndo] = useState(false);

  const srcRef    = useRef(null);
  const scaleRef  = useRef(scale);
  const annosRef  = useRef(annos);
  const histRef   = useRef([]);
  const dragRef   = useRef(null);
  const editedFocus = useRef(false);
  const fileInput = useRef();
  const addInput  = useRef();
  const imgInput  = useRef();

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { annosRef.current = annos; }, [annos]);
  useEffect(() => { if (onDoc) onDoc(!!pdf); }, [pdf, onDoc]);

  const pushHistory = useCallback(() => {
    histRef.current.push(JSON.stringify(annosRef.current));
    if (histRef.current.length > 60) histRef.current.shift();
    setCanUndo(true);
  }, []);
  const undo = () => {
    const prev = histRef.current.pop();
    if (prev != null) { setAnnos(JSON.parse(prev)); setSelId(null); setFocusId(null); }
    setCanUndo(histRef.current.length > 0);
  };
  const deleteAnno = useCallback((id) => {
    pushHistory();
    setAnnos(p => {
      const target = p.find(a => a.id === id);
      const grp = target?.group || null;
      return p.flatMap(a => {
        const match = grp ? a.group === grp : a.id === id;
        if (!match) return [a];
        return (a.type==='text' && a.isOriginal) ? [{...a, str:''}] : [];
      });
    });
    setSelId(null);
  }, [pushHistory]);

  const sel = annos.find(a => a.id === selId) || null;

  /* restaura o trabalho do cache ao montar (trocar de aba / sair e voltar) */
  useEffect(() => {
    if (!editorCache.src) return;
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: editorCache.src.slice() }).promise;
        srcRef.current = editorCache.src;
        setPdf(doc); setPages(editorCache.pages || []); setAnnos(editorCache.annos || []);
        setFileName(editorCache.fileName || ''); setScale(editorCache.scale || 1.3);
      } catch { /* cache inválido */ }
    })();
  }, []);

  /* salva o trabalho no cache sempre que mudar */
  useEffect(() => {
    if (srcRef.current) {
      editorCache.src = srcRef.current;
      editorCache.pages = pages; editorCache.annos = annos;
      editorCache.fileName = fileName; editorCache.scale = scale;
    }
  }, [pages, annos, fileName, scale]);

  /* ── abrir PDF + extrair texto existente ── */
  const openFile = async (file) => {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const ab  = await file.arrayBuffer();
      const src = new Uint8Array(ab);
      const { doc, pgs, items } = await extractFrom(src, 0);
      srcRef.current = src;
      setPdf(doc); setPages(pgs); setFileName(file.name);
      setAnnos(items); setSelId(null); setFocusId(null);
      histRef.current = []; setCanUndo(false); setActivePage(0);
    } catch (e) {
      setError('Não foi possível abrir o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── adicionar outro PDF (anexa as páginas ao documento atual) ── */
  const addPdf = async (file) => {
    if (!file) return;
    if (!srcRef.current) { openFile(file); return; }
    setError(''); setBusy(true);
    try {
      const ab = await file.arrayBuffer();
      const A = await PDFDocument.load(srcRef.current.slice());
      const B = await PDFDocument.load(new Uint8Array(ab));
      const copied = await A.copyPages(B, B.getPageIndices());
      copied.forEach(pg => A.addPage(pg));
      const merged = new Uint8Array(await A.save());
      const oldCount = pages.length;
      const { doc, pgs, items } = await extractFrom(merged, 0);
      srcRef.current = merged;
      pushHistory();
      setPdf(doc); setPages(pgs);
      setAnnos(prev => [...prev, ...items.filter(it => it.page >= oldCount)]);
    } catch (e) {
      setError('Não foi possível adicionar o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── adicionar elementos ── */
  const addText = (pageIdx, xPt, topPt) => {
    pushHistory();
    const id = uid(), fs = 14;
    setAnnos(p => [...p, { id, page:pageIdx, type:'text', isOriginal:false,
      x:xPt, top:topPt, fs, asc:fs*0.8, desc:fs*0.2, w:120, serif:false, bold:false, italic:false,
      str:'Novo texto', orig:undefined, color:'#111111' }]);
    setSelId(id); setTool('select');
  };
  const addWhiteout = (pageIdx, xPt, topPt) => {
    pushHistory();
    const id = uid();
    setAnnos(p => [...p, { id, page:pageIdx, type:'whiteout', x:xPt-60, top:topPt-20, w:120, h:40 }]);
    setSelId(id); setTool('select');
  };
  const addImageAnno = (dataUrl, type, repeat=false) => {
    const img = new Image();
    img.onload = () => {
      pushHistory();
      const aspect = img.width / img.height;
      const targets = repeat ? pages.map((_,i)=>i) : [activePage];
      // mesma posição/tamanho em todas (assinatura sincronizada entre páginas)
      const base = pages[activePage];
      const w = Math.min(180, base.w*0.4); const h = w/aspect;
      const x = (base.w - w)/2, top = (base.h - h)/2;
      const group = repeat ? uid() : null;
      const created = targets.map(pi => ({ id: uid(), page: pi, type, x, top, w, h, src:dataUrl, group }));
      setAnnos(p => [...p, ...created]);
      setSelId(created[0].id);
    };
    img.src = dataUrl;
  };

  const onPageClick = (pageIdx, e) => {
    setActivePage(pageIdx);
    if (tool === 'text') {
      const r = e.currentTarget.getBoundingClientRect();
      addText(pageIdx, (e.clientX-r.left)/scale, (e.clientY-r.top)/scale);
    } else if (tool === 'whiteout') {
      const r = e.currentTarget.getBoundingClientRect();
      addWhiteout(pageIdx, (e.clientX-r.left)/scale, (e.clientY-r.top)/scale);
    } else { setSelId(null); }
  };

  const updateAnno = (id, patch) => setAnnos(p => p.map(a => a.id===id ? {...a, ...patch} : a));

  /* ── drag / resize ── */
  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current; if (!d) return;
      const s = scaleRef.current;
      const dx = (e.clientX-d.sx)/s, dy = (e.clientY-d.sy)/s;
      setAnnos(prev => prev.map(a => {
        const match = d.group ? a.group === d.group : a.id === d.id;
        if (!match) return a;
        if (d.mode === 'move')    return { ...a, x:d.ox+dx, top:d.oy+dy };
        if (d.mode === 'resizeI') { const w=Math.max(24,d.ow+dx); return { ...a, w, h:w/d.aspect }; }
        if (d.mode === 'resizeWH') { return { ...a, w:Math.max(24,d.ow+dx), h:Math.max(16,d.oh+dy) }; }
        return a;
      }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  const startDrag = (e, a, mode) => {
    e.stopPropagation(); e.preventDefault();
    setSelId(a.id); pushHistory();
    dragRef.current = { id:a.id, group:a.group||null, mode, sx:e.clientX, sy:e.clientY, ox:a.x, oy:a.top, ow:a.w, oh:a.h, aspect:(a.w/(a.h||1)) };
  };

  /* ── salvar ── */
  const salvar = async () => {
    if (!srcRef.current) return;
    setBusy(true); setError('');
    try {
      const doc = await PDFDocument.load(srcRef.current.slice());
      const docPages = doc.getPages();
      const fontByVariant = {};
      const getFont = async (serif, bold, italic) => {
        const key = (serif?'t':'h')+(bold?'b':'')+(italic?'i':'');
        if (fontByVariant[key]) return fontByVariant[key];
        let std;
        if (serif) std = bold&&italic?StandardFonts.TimesRomanBoldItalic:bold?StandardFonts.TimesRomanBold:italic?StandardFonts.TimesRomanItalic:StandardFonts.TimesRoman;
        else       std = bold&&italic?StandardFonts.HelveticaBoldOblique:bold?StandardFonts.HelveticaBold:italic?StandardFonts.HelveticaOblique:StandardFonts.Helvetica;
        const f = await doc.embedFont(std); fontByVariant[key] = f; return f;
      };
      const fontKeyCache = {};
      const getFontKey = (pageIdx, page, variantKey, font) => {
        const ck = pageIdx+'_'+variantKey;
        if (fontKeyCache[ck]) return fontKeyCache[ck];
        const k = page.node.newFontDictionary(font.name, font.ref);
        fontKeyCache[ck] = k; return k;
      };
      const imgCache = {};
      const embed = async (dataUrl) => {
        if (imgCache[dataUrl]) return imgCache[dataUrl];
        // funciona tanto com data URL base64 quanto com URL de arquivo (asset importado)
        const buf = await fetch(dataUrl).then(r => r.arrayBuffer());
        const bytes = new Uint8Array(buf);
        const isPng = dataUrl.startsWith('data:') ? dataUrl.startsWith('data:image/png') : /\.png(\?|$)/i.test(dataUrl);
        const im = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        imgCache[dataUrl] = im; return im;
      };

      for (const a of annos) {
        const page = docPages[a.page]; if (!page) continue;
        const H = page.getHeight();

        if (a.type === 'whiteout') {
          page.drawRectangle({ x:a.x, y:H-a.top-a.h, width:a.w, height:a.h, color:rgb(1,1,1) });
          continue;
        }
        if (a.type !== 'text') {
          const im = await embed(a.src);
          page.drawImage(im, { x:a.x, y:H-a.top-a.h, width:a.w, height:a.h });
          continue;
        }

        const changed = !a.isOriginal || a.str !== a.orig;
        if (!changed) continue;

        // cobre o texto original com a cor de fundo LOCAL (atrás do texto)
        if (a.isOriginal) {
          const bg = a.bg || WHITE_BG;
          page.drawRectangle({ x:a.x-1, y:H-a.top-a.fs*1.28, width:a.w+2, height:a.fs*1.45, color:rgb(bg.r/255, bg.g/255, bg.b/255) });
        }
        const text = sanitizeWinAnsi(a.str);
        if (!text) continue;

        const variantKey = (a.serif?'t':'h')+(a.bold?'b':'')+(a.italic?'i':'');
        const font = await getFont(a.serif, a.bold, a.italic);
        const fontKey = getFontKey(a.page, page, variantKey, font);
        const { r, g, b } = hexToRgb01(a.color);

        // escala horizontal: reproduz a densidade do texto original
        let sx = 1;
        if (a.isOriginal && a.orig) {
          const ow = font.widthOfTextAtSize(sanitizeWinAnsi(a.orig), a.fs) || 1;
          sx = clamp(a.w / ow, 0.25, 4);
        }
        const lh = a.fs * 1.18;
        const lines = text.split('\n');
        lines.forEach((line, k) => {
          const yBase = H - (a.top + a.asc) - k*lh;
          let enc; try { enc = font.encodeText(line); } catch { return; }
          page.pushOperators(
            pushGraphicsState(), beginText(),
            setFillingRgbColor(r, g, b),
            setFontAndSize(fontKey, a.fs),
            setTextMatrix(sx, 0, 0, 1, a.x, yBase),
            showText(enc),
            endText(), popGraphicsState(),
          );
        });
      }

      const out = await doc.save();
      const blob = new Blob([out], { type:'application/pdf' });
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url; el.download = (fileName.replace(/\.pdf$/i,'') || 'documento') + '_editado.pdf';
      document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      setError('Erro ao salvar: ' + (e?.message || 'desconhecido'));
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Delete' && selId) {
        const a = annosRef.current.find(x=>x.id===selId);
        const editing = document.activeElement && document.activeElement.isContentEditable;
        if (a && !(a.type==='text' && editing)) { e.preventDefault(); deleteAnno(selId); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, deleteAnno]);

  /* ── sem arquivo ── */
  if (!pdf) {
    return (
      <div style={{maxWidth:560}}>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:24}}>
          Carregue um PDF para editar o texto existente — clique sobre qualquer texto e altere, mantendo a mesma posição e estilo. Também é possível adicionar texto, imagens e assinaturas.
        </p>
        <input ref={fileInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>openFile(e.target.files[0])}/>
        <div onClick={()=>fileInput.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); openFile(e.dataTransfer.files[0]);}}
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
    border:`1px solid ${active?T.gold:T.border}`, background:active?T.goldGl:'transparent',
    color:active?T.gold:T.textS, fontSize:13,fontWeight:active?600:500,cursor:'pointer',
    fontFamily:'var(--font-body)',transition:'all .14s',whiteSpace:'nowrap',
  });

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'10px 12px',marginBottom:14,position:'sticky',top:0,zIndex:50}}>
        <button style={tbBtn(false)} onClick={()=>fileInput.current?.click()}>
          <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></I> Abrir PDF
        </button>
        <input ref={fileInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{ openFile(e.target.files[0]); e.target.value=''; }}/>
        <button style={tbBtn(false)} onClick={()=>addInput.current?.click()} disabled={busy}>
          <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></I> Adicionar PDF
        </button>
        <input ref={addInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{ addPdf(e.target.files[0]); e.target.value=''; }}/>
        <button style={{...tbBtn(false),background:T.gold,color:'#fff',border:'none'}} onClick={salvar} disabled={busy}>
          <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>
          {busy ? 'Salvando...' : 'Salvar como...'}
        </button>
        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>
        <button style={tbBtn(tool==='text')} onClick={()=>setTool(tool==='text'?'select':'text')}>
          <I><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></I> Editar Texto
        </button>
        <button style={tbBtn(tool==='whiteout')} onClick={()=>setTool(tool==='whiteout'?'select':'whiteout')}>
          <I><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/></I> Whiteout
        </button>
        <button style={tbBtn(false)} onClick={()=>imgInput.current?.click()}>
          <I><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></I> Imagem
        </button>
        <input ref={imgInput} type="file" accept="image/png,image/jpeg" style={{display:'none'}}
          onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=()=>addImageAnno(r.result,'image'); r.readAsDataURL(f);} e.target.value=''; }}/>
        <button style={tbBtn(false)} onClick={()=>setSigOpen(true)}>
          <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I> Assinatura
        </button>
        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>
        <button style={tbBtn(false)} onClick={undo} disabled={!canUndo}>
          <I><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></I> Desfazer
        </button>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button style={{...tbBtn(false),padding:'7px 11px'}} onClick={()=>setScale(s=>Math.max(0.5,+(s-0.1).toFixed(2)))}>−</button>
          <span style={{fontSize:13,color:T.textS,minWidth:46,textAlign:'center'}}>{Math.round(scale*100)}%</span>
          <button style={{...tbBtn(false),padding:'7px 11px'}} onClick={()=>setScale(s=>Math.min(3,+(s+0.1).toFixed(2)))}>+</button>
        </div>
      </div>

      {error && <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>{error}</div>}

      {tool==='text' && <div style={{marginBottom:10,fontSize:12.5,color:T.textT}}>Clique sobre um texto do PDF para editá-lo, ou clique numa área vazia para adicionar texto novo.</div>}
      {tool==='whiteout' && <div style={{marginBottom:10,fontSize:12.5,color:T.textT}}>Clique no PDF para inserir uma caixa branca. Arraste para mover e use a alça para redimensionar.</div>}

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
                <PdfCanvas pdf={pdf} index={i} scale={scale} quality={RENDER_QUALITY}/>
                <div onClick={(e)=>onPageClick(i,e)} style={{position:'absolute',inset:0,cursor:tool==='text'?'text':tool==='whiteout'?'crosshair':'default'}}>
                  {annos.filter(a=>a.page===i).map(a => {
                    const selected = a.id===selId;
                    if (a.type === 'text') {
                      const visible = focusId===a.id || a.str!==a.orig || !a.isOriginal;
                      const k = scaleXFor(a);
                      return (
                        <div key={a.id}>
                          {selected && (
                            <div style={{position:'absolute',left:a.x*scale,top:a.top*scale-17,display:'flex',gap:2,zIndex:6}}>
                              <div onPointerDown={e=>startDrag(e,a,'move')} title="Mover"
                                style={{height:16,padding:'0 6px',background:T.gold,color:'#fff',fontSize:9.5,borderRadius:'4px 0 0 0',cursor:'move',display:'flex',alignItems:'center',userSelect:'none',whiteSpace:'nowrap'}}>✛ mover</div>
                              <div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); deleteAnno(a.id);}} title="Excluir"
                                style={{height:16,width:20,background:T.danger,color:'#fff',fontSize:10,borderRadius:'0 4px 0 0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>🗑</div>
                            </div>
                          )}
                          <EditableText
                            value={a.str}
                            onFocus={()=>{ setFocusId(a.id); setSelId(a.id); editedFocus.current=false; }}
                            onClickSel={e=>{ e.stopPropagation(); setSelId(a.id); }}
                            onInput={(txt)=>{ if(!editedFocus.current){ pushHistory(); editedFocus.current=true; } updateAnno(a.id,{str:txt}); }}
                            style={{
                              position:'absolute', left:a.x*scale, top:a.top*scale,
                              display:'inline-block', whiteSpace:'pre', minWidth:4,
                              transform:`scaleX(${k})`, transformOrigin:'0 0',
                              fontSize:a.fs*scale, lineHeight:1, fontFamily:cssFamily(a.serif),
                              fontWeight:a.bold?700:400, fontStyle:a.italic?'italic':'normal',
                              color: visible?a.color:'transparent',
                              background: visible && a.isOriginal ? (a.bg?.hex || '#fff') : 'transparent',
                              caretColor:a.color, outline:'none',
                              boxShadow: selected?`0 0 0 1px ${T.gold}`:'none',
                            }}/>
                        </div>
                      );
                    }
                    if (a.type === 'whiteout') {
                      return (
                        <div key={a.id} onClick={e=>{e.stopPropagation(); setSelId(a.id);}} onPointerDown={e=>startDrag(e,a,'move')}
                          style={{position:'absolute',left:a.x*scale,top:a.top*scale,width:a.w*scale,height:a.h*scale,cursor:'move',background:'#ffffff',outline:selected?`1.5px solid ${T.gold}`:'1px dashed rgba(0,0,0,.18)',zIndex:selected?5:4}}>
                          {selected && (
                            <div style={{position:'absolute',left:0,top:-17,display:'flex',gap:2,zIndex:6}}>
                              <div onPointerDown={e=>startDrag(e,a,'move')} title="Mover"
                                style={{height:16,padding:'0 6px',background:T.gold,color:'#fff',fontSize:9.5,borderRadius:'4px 0 0 0',cursor:'move',display:'flex',alignItems:'center',userSelect:'none',whiteSpace:'nowrap'}}>✛ mover</div>
                              <div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); deleteAnno(a.id);}} title="Excluir"
                                style={{height:16,width:20,background:T.danger,color:'#fff',fontSize:10,borderRadius:'0 4px 0 0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>🗑</div>
                            </div>
                          )}
                          {selected && <div onPointerDown={e=>{e.stopPropagation(); e.preventDefault(); startDrag(e,a,'resizeWH');}} style={{position:'absolute',right:-6,bottom:-6,width:12,height:12,background:'#fff',border:`2px solid ${T.gold}`,borderRadius:'50%',cursor:'nwse-resize'}}/>}
                        </div>
                      );
                    }
                    return (
                      <div key={a.id} onClick={e=>{e.stopPropagation(); setSelId(a.id);}} onPointerDown={e=>startDrag(e,a,'move')}
                        style={{position:'absolute',left:a.x*scale,top:a.top*scale,width:a.w*scale,height:a.h*scale,cursor:'move',outline:selected?`1.5px solid ${T.gold}`:'1px dashed rgba(0,0,0,.15)'}}>
                        <img src={a.src} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'}}/>
                        {selected && (
                          <div style={{position:'absolute',left:0,top:-17,display:'flex',gap:2,zIndex:6}}>
                            <div onPointerDown={e=>startDrag(e,a,'move')} title="Mover"
                              style={{height:16,padding:'0 6px',background:T.gold,color:'#fff',fontSize:9.5,borderRadius:'4px 0 0 0',cursor:'move',display:'flex',alignItems:'center',userSelect:'none',whiteSpace:'nowrap'}}>✛ mover</div>
                            <div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); deleteAnno(a.id);}} title="Excluir"
                              style={{height:16,width:20,background:T.danger,color:'#fff',fontSize:10,borderRadius:'0 4px 0 0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>🗑</div>
                          </div>
                        )}
                        {selected && <div onPointerDown={e=>startDrag(e,a,'resizeI')} style={{position:'absolute',right:-6,bottom:-6,width:12,height:12,background:'#fff',border:`2px solid ${T.gold}`,borderRadius:'50%',cursor:'nwse-resize'}}/>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Propriedades */}
        <div style={{width:194,flexShrink:0}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:12}}>Propriedades</div>
            {!sel && <div style={{fontSize:12.5,color:T.textD,lineHeight:1.6}}>Clique sobre um texto do PDF para editá-lo. Use a barra para adicionar texto, imagem ou assinatura.</div>}
            {sel && sel.type==='text' && (
              <div style={{display:'flex',flexDirection:'column',gap:13}}>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{pushHistory(); updateAnno(sel.id,{bold:!sel.bold});}} style={{flex:1,padding:'7px',borderRadius:7,border:`1px solid ${sel.bold?T.gold:T.border}`,background:sel.bold?T.goldGl:'transparent',color:sel.bold?T.gold:T.textS,fontWeight:800,cursor:'pointer'}}>B</button>
                  <button onClick={()=>{pushHistory(); updateAnno(sel.id,{italic:!sel.italic});}} style={{flex:1,padding:'7px',borderRadius:7,border:`1px solid ${sel.italic?T.gold:T.border}`,background:sel.italic?T.goldGl:'transparent',color:sel.italic?T.gold:T.textS,fontStyle:'italic',cursor:'pointer'}}>I</button>
                  <button onClick={()=>{pushHistory(); updateAnno(sel.id,{serif:!sel.serif});}} title="Serifada / sem serifa" style={{flex:1.6,padding:'7px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.textS,cursor:'pointer',fontSize:12}}>{sel.serif?'Serif':'Sans'}</button>
                </div>
                <div>
                  <div style={{fontSize:11.5,color:T.textT,marginBottom:6}}>Tamanho: {sel.fs.toFixed(0)}px</div>
                  <input type="range" min="6" max="48" step="1" value={Math.round(sel.fs)} onChange={e=>updateAnno(sel.id,{fs:+e.target.value})} style={{width:'100%'}}/>
                </div>
                <div>
                  <div style={{fontSize:11.5,color:T.textT,marginBottom:6}}>Cor</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {COLORS.map(c=>(
                      <button key={c} onClick={()=>updateAnno(sel.id,{color:c})} style={{width:22,height:22,borderRadius:6,background:c,cursor:'pointer',border:sel.color===c?`2px solid ${T.gold}`:`1px solid ${T.border}`}}/>
                    ))}
                  </div>
                </div>
                <button onClick={()=>deleteAnno(sel.id)} style={{background:'none',border:`1px solid ${T.danger}55`,color:T.danger,borderRadius:8,padding:'8px',fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>{sel.isOriginal?'Apagar este texto':'Excluir elemento'}</button>
              </div>
            )}
            {sel && sel.type!=='text' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{fontSize:12.5,color:T.textS}}>{sel.type==='signature'?'Assinatura':sel.type==='whiteout'?'Caixa branca (Whiteout)':'Imagem'} selecionada. Arraste para mover e use a alça para redimensionar.</div>
                <button onClick={()=>deleteAnno(sel.id)} style={{background:'none',border:`1px solid ${T.danger}55`,color:T.danger,borderRadius:8,padding:'8px',fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>Excluir elemento</button>
              </div>
            )}
          </div>
          <div style={{fontSize:11.5,color:T.textD,marginTop:10,lineHeight:1.5,padding:'0 4px'}}>{fileName} · {pages.length} página{pages.length!==1?'s':''}</div>
        </div>
      </div>

      {sigOpen && <SignatureModal onClose={()=>setSigOpen(false)} onUse={(dataUrl, repeat)=>{ addImageAnno(dataUrl,'signature',repeat); setSigOpen(false); }}/>}
    </div>
  );
};
