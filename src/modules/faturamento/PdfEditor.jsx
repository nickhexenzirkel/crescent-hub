import { useState, useRef, useEffect, useCallback, useMemo, useReducer, memo } from 'react';
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
// `measureText` força o navegador a preparar a fonte e não é barato. Como é
// chamado no RENDER de cada texto (via scaleXFor), durante um arraste isso
// virava dezenas de medições por quadro — sempre com os MESMOS argumentos.
// Cache simples: a largura de um texto numa fonte nunca muda.
const _measureCache = new Map();
const measureW = (str, fs, serif, bold, italic) => {
  const chave = `${fs}|${serif?1:0}${bold?1:0}${italic?1:0}|${str || ''}`;
  const hit = _measureCache.get(chave);
  if (hit !== undefined) return hit;
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  _measureCtx.font = `${italic?'italic ':''}${bold?'700 ':''}${fs}px ${cssFamily(serif)}`;
  const w = _measureCtx.measureText(str || '').width || 1;
  if (_measureCache.size > 5000) _measureCache.clear();   // teto de memória
  _measureCache.set(chave, w);
  return w;
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
// Constante: usar `[]` inline criaria um array novo a cada render de página.
const EMPTY_ARR = [];

const WHITE_BG = { hex:'#ffffff', r:255, g:255, b:255 };
const SAMPLE_SCALE = 1.5;
const RENDER_QUALITY = 2;   // superamostragem do canvas → letras mais nítidas

/* Cache em memória (persiste o trabalho ao trocar de aba / sair e voltar,
   enquanto o app não for recarregado) */
const editorCache = { src:null, pages:null, annos:null, fileName:'', scale:1.3,
  poolId:0, origPages:null, extracted:null, bgDone:null };

/* ════════════════════════════════════════════════════════════════
   Miniaturas — cache + fila global
   Um PDF de 300 páginas tem 300 miniaturas. Renderizar todas de uma vez (um
   <canvas> vivo por página, como era antes) trava a aba por dezenas de
   segundos e segura centenas de MB de memória de vídeo. Agora cada miniatura:
     1) só é pedida quando entra (ou está quase entrando) na tela;
     2) passa por uma fila que desenha no máximo 2 páginas por vez;
     3) vira um JPEG (data URL) guardado em cache — reordenar/arrastar depois
        é só trocar um <img> de lugar, sem re-renderizar nada.
════════════════════════════════════════════════════════════════ */
const THUMB_W   = 170;   // largura do JPEG da miniatura
const THUMB_MAX = 700;   // teto do cache (JPEG pequeno: poucos MB no total)
const thumbCache = new Map();   // `${poolId}:${ref}` → dataURL
let _poolSeq = 0;
const _thumbQ = [];
let _thumbRunning = 0;

const _drawThumb = async (job) => {
  const page = await job.pdf.getPage(job.ref + 1);
  const base = page.getViewport({ scale: 1 });
  const vp   = page.getViewport({ scale: THUMB_W / base.width });
  const cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.round(vp.width));
  cv.height = Math.max(1, Math.round(vp.height));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);  // JPEG não tem transparência
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const url = cv.toDataURL('image/jpeg', 0.72);
  cv.width = cv.height = 0;   // devolve a memória do canvas na hora
  if (thumbCache.size >= THUMB_MAX) thumbCache.delete(thumbCache.keys().next().value);
  thumbCache.set(job.key, url);
  return url;
};

const _pumpThumbs = () => {
  while (_thumbRunning < 2 && _thumbQ.length) {
    // LIFO: o último pedido é o que o usuário está olhando AGORA (ele rolou
    // até lá). Atender por ordem de chegada deixaria a tela em branco enquanto
    // a fila desenha páginas que já saíram de vista.
    const job = _thumbQ.pop();
    if (job.cancelled) { job.resolve(null); continue; }
    _thumbRunning++;
    _drawThumb(job).then(job.resolve, () => job.resolve(null))
      .then(() => { _thumbRunning--; _pumpThumbs(); });
  }
};

const requestThumb = (pdf, poolId, ref) => {
  const key = poolId + ':' + ref;
  const hit = thumbCache.get(key);
  if (hit) return { promise: Promise.resolve(hit), cancel: () => {} };
  const job = { pdf, ref, key, cancelled: false, resolve: null };
  const promise = new Promise(res => { job.resolve = res; });
  _thumbQ.push(job);
  _pumpThumbs();
  return { promise, cancel: () => { job.cancelled = true; } };
};

const limparThumbs = (poolId) => {
  const pre = poolId + ':';
  for (const k of [...thumbCache.keys()]) if (k.startsWith(pre)) thumbCache.delete(k);
};

/* Só monta/renderiza o que está (ou está perto de estar) na tela.
   UM observer por (container, margem) em vez de um por elemento: num PDF de
   centenas de páginas seriam centenas de IntersectionObserver vivos ao mesmo
   tempo, cada um com seu próprio custo de bookkeeping. */
const _ioPorRoot = new WeakMap();   // elemento que rola → Map<margem, entrada>
let _ioDaJanela = null;             // idem, pra quando o root é a viewport

const _getIO = (root, rootMargin) => {
  let porMargem;
  if (root) {
    porMargem = _ioPorRoot.get(root);
    if (!porMargem) { porMargem = new Map(); _ioPorRoot.set(root, porMargem); }
  } else {
    porMargem = _ioDaJanela || (_ioDaJanela = new Map());
  }
  let entrada = porMargem.get(rootMargin);
  if (!entrada) {
    const cbs = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const cb = cbs.get(e.target);
        if (cb) cb(e.isIntersecting);
      }
    }, { root: root || null, rootMargin });
    entrada = { io, cbs };
    porMargem.set(rootMargin, entrada);
  }
  return entrada;
};

const useInView = (root, rootMargin = '600px 0px') => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') { setInView(true); return; }
    const { io, cbs } = _getIO(root, rootMargin);
    cbs.set(el, setInView);
    io.observe(el);
    return () => { cbs.delete(el); io.unobserve(el); };
  }, [root, rootMargin]);
  return [ref, inView];
};

/* Cor dominante (= fundo) dentro de um retângulo de uma ImageData.
   Os pixels de fundo superam os do texto, então a moda é a cor do fundo. */
const dominantColor = (img, x0, y0, x1, y1) => {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(img.width, Math.ceil(x1)); y1 = Math.min(img.height, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return WHITE_BG;
  // AMOSTRAGEM em vez de varrer pixel a pixel: isto roda pra CADA trecho de
  // texto do PDF ao abrir, e era o que mais pesava na abertura de documentos
  // grandes. Como só queremos a cor que MAIS aparece (o fundo), olhar 1 pixel
  // a cada 2 em cada eixo já dá o mesmo resultado com ~1/4 do trabalho — o
  // fundo domina a região por larga margem, não é um empate apertado.
  const passo = (x1-x0) * (y1-y0) > 4000 ? 2 : 1;
  const counts = new Map();
  for (let y = y0; y < y1; y += passo) {
    let base = (y*img.width + x0) * 4;
    const salto = 4 * passo;
    for (let x = x0; x < x1; x += passo, base += salto) {
      const key = (img.data[base] << 16) | (img.data[base+1] << 8) | img.data[base+2];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  let best = -1, bk = 0xFFFFFF;
  for (const [k, v] of counts) if (v > best) { best = v; bk = k; }
  const r = (bk>>16)&255, g = (bk>>8)&255, b = bk&255;
  return { hex: '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''), r, g, b };
};

/* Dimensões de todas as páginas (a partir de `from`). É o mínimo necessário
   pra montar o editor — e o único trabalho feito na ABERTURA do arquivo.
   Em blocos, porque 1 `await` por página num PDF grande é tempo jogado fora. */
const readPageSizes = async (doc, from = 0) => {
  const out = [];
  const BLOCO = 16;
  for (let i = from; i < doc.numPages; i += BLOCO) {
    const fim = Math.min(doc.numPages, i + BLOCO);
    const lote = [];
    for (let j = i; j < fim; j++) lote.push(doc.getPage(j + 1));
    for (const page of await Promise.all(lote)) {
      const vp = page.getViewport({ scale: 1 });
      out.push({ w: vp.width, h: vp.height });
    }
  }
  return out;
};

/* Trechos de texto de UMA página (posição, tamanho, estilo).
   Não rasteriza nada: é só o `getTextContent`, rápido mesmo em página cheia.
   A cor de fundo atrás de cada trecho fica pra `bgForAnnos`, que só roda
   quando o usuário realmente mexe no texto daquela página. */
const extractTextOfPage = async (doc, ref, pageId) => {
  const page = await doc.getPage(ref + 1);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = [];
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
    items.push({
      id: uid(), pageId, type:'text', isOriginal:true,
      x: tr[4], top, fs, asc, desc, w: it.width, serif:false, bold, italic,
      str, orig: str, color:'#111111', bg: null,
    });
  }
  return items;
};

/* Fila da extração de texto: no máximo 2 páginas por vez, LIFO (a última
   pedida é a que o usuário acabou de trazer pra tela). */
const pumpExtract = (st) => {
  while (st.rodando < 2 && st.fila.length) {
    const pg = st.fila.pop();
    const doc = st.doc();
    if (!doc) { st.fila.length = 0; return; }
    st.rodando++;
    extractTextOfPage(doc, pg.ref, pg.id)
      .then(items => st.pronto(pg, items), () => st.falhou(pg))
      .then(() => { st.rodando--; pumpExtract(st); });
  }
};

/* Cor de fundo local de cada trecho de uma página (uma rasterização só). */
const bgForAnnos = async (doc, ref, lista) => {
  const mapa = new Map();
  if (!lista.length) return mapa;
  const page = await doc.getPage(ref + 1);
  const img = await renderSample(page);
  for (const a of lista) {
    mapa.set(a.id, img
      ? dominantColor(img, a.x*SAMPLE_SCALE, a.top*SAMPLE_SCALE, (a.x+a.w)*SAMPLE_SCALE, (a.top+a.fs*1.3)*SAMPLE_SCALE)
      : WHITE_BG);
  }
  return mapa;
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
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    // Zera o canvas: sem isso o navegador segura a memória de vídeo de UMA
    // amostra por página do documento até o coletor passar — num PDF grande
    // isso vira centenas de MB e faz o editor inteiro engasgar.
    cv.width = cv.height = 0;
    return img;
  } catch { return null; }
};

/* ════════════════════════════════════════════════════════════════
   Canvas de uma página (render via pdf.js)
════════════════════════════════════════════════════════════════ */
/* `memo`: sem isso, QUALQUER mexida numa anotação re-renderizava o canvas de
   TODAS as páginas. O `useEffect` até não re-rodava (as deps não mudam), mas o
   React refazia o VDOM de todas elas a cada quadro do arraste — desperdício
   que crescia com o número de páginas. As props aqui são todas primitivas
   (fora `pdf`, que é estável), então a comparação rasa do memo basta. */
const PdfCanvas = memo(({ pdf, index, scale, quality = 1 }) => {
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
});

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
   Miniatura de página (JPEG em cache, desenhada só quando entra na tela)
════════════════════════════════════════════════════════════════ */
const PageThumb = memo(({ pdf, poolId, pageRef, ratio, root, rootMargin = '400px 0px' }) => {
  const [holder, inView] = useInView(root, rootMargin);
  const key = poolId + ':' + pageRef;
  const [, redesenhar] = useReducer(x => x + 1, 0);
  const url = thumbCache.get(key) || null;
  useEffect(() => {
    if (!inView || !pdf || thumbCache.has(key)) return;
    let vivo = true;
    const job = requestThumb(pdf, poolId, pageRef);
    job.promise.then(() => { if (vivo) redesenhar(); });
    return () => { vivo = false; job.cancel(); };
  }, [pdf, poolId, pageRef, key, inView]);
  return (
    <div ref={holder} style={{width:'100%',aspectRatio:String(ratio || 0.707),background:'#fff',
      display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
      {url
        ? <img src={url} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>
        : <div style={{width:'100%',height:'100%',background:'linear-gradient(100deg,#f2f2f2 30%,#e8e8e8 50%,#f2f2f2 70%)',
            backgroundSize:'220% 100%',animation:'pdfShimmer 1.1s linear infinite'}}/>}
    </div>
  );
});

/* Uma página do editor: só monta o canvas + a camada de anotações quando está
   perto da tela. Fora dali fica um espaço vazio do tamanho certo — a rolagem
   continua idêntica, mas o navegador não segura 300 canvases em pé. */
const PageSlot = ({ pg, scale, root, onSeen, render }) => {
  const [holder, inView] = useInView(root, '900px 0px');
  useEffect(() => { if (inView) onSeen(pg); }, [inView, pg, onSeen]);
  return (
    <div ref={holder} id={'pdfpg-' + pg.id}
      style={{margin:'0 auto 18px',width:pg.w*scale,height:pg.h*scale,
        boxShadow:'0 4px 18px rgba(0,0,0,.14)',background:'#fff'}}>
      {inView ? render() : null}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   Pré-visualização grande de uma página
════════════════════════════════════════════════════════════════ */
const PagePreviewModal = ({ pdf, pages, idx, onIdx, onClose }) => {
  const [box, setBox] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const r = () => setBox({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') onIdx(Math.min(pages.length - 1, idx + 1));
      else if (e.key === 'ArrowLeft')  onIdx(Math.max(0, idx - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [idx, pages.length, onIdx, onClose]);

  const pg = pages[idx];
  if (!pg) return null;
  const s = Math.max(0.1, Math.min((box.w * 0.78) / pg.w, (box.h * 0.8) / pg.h));
  const nav = (d) => (e) => { e.stopPropagation(); onIdx(clamp(idx + d, 0, pages.length - 1)); };
  const navBtn = {width:38,height:38,borderRadius:'50%',border:'none',background:'rgba(255,255,255,.9)',
    color:'#222',fontSize:17,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0};

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(10,12,18,.82)',
      display:'flex',alignItems:'center',justifyContent:'center',gap:14,padding:20,backdropFilter:'blur(3px)'}}>
      <button style={{...navBtn,visibility:idx>0?'visible':'hidden'}} onClick={nav(-1)}>‹</button>
      <div onClick={e=>e.stopPropagation()} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
        <div style={{boxShadow:'0 10px 40px rgba(0,0,0,.5)',background:'#fff',lineHeight:0}}>
          <PdfCanvas pdf={pdf} index={pg.ref} scale={s} quality={1}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,color:'#fff',fontSize:13}}>
          <span>Página {idx + 1} de {pages.length}</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.14)',border:'1px solid rgba(255,255,255,.25)',
            color:'#fff',borderRadius:8,padding:'6px 14px',fontSize:12.5,cursor:'pointer',fontFamily:'var(--font-body)'}}>Fechar (Esc)</button>
        </div>
      </div>
      <button style={{...navBtn,visibility:idx<pages.length-1?'visible':'hidden'}} onClick={nav(1)}>›</button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   ORGANIZAR PÁGINAS
   Grade de miniaturas: arrastar pra mover, clicar pra selecionar (Shift = faixa),
   excluir em lote e ampliar qualquer página antes de decidir.
   Nada aqui reescreve o PDF — só mexe na ORDEM em memória; o arquivo só é
   remontado na hora de salvar. Por isso mover/excluir é instantâneo mesmo com
   centenas de páginas.
════════════════════════════════════════════════════════════════ */
const ORG_ICONS = {
  lupa: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  lixo: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
};

const OrgCard = memo(({ pg, idx, pdf, poolId, root, selected, dropSide, busy,
  onPick, onPreview, onDelete, onNudge, onDragStart, onDragOver, onDrop, onDragEnd, total }) => (
  <div
    draggable={!busy}
    onClick={(e) => onPick(idx, e)}
    onDoubleClick={() => onPreview(idx)}
    onDragStart={(e) => onDragStart(idx, e)}
    onDragOver={(e) => onDragOver(idx, e)}
    onDrop={(e) => onDrop(idx, e)}
    onDragEnd={onDragEnd}
    style={{position:'relative',borderRadius:10,padding:4,cursor:busy?'default':'grab',
      border:`2px solid ${selected ? T.gold : T.border}`,
      background:selected ? T.goldGl : T.surface,
      boxShadow:selected ? `0 0 0 3px ${T.gold}22` : 'none',
      transition:'border-color .12s, box-shadow .12s'}}>
    {dropSide && (
      <div style={{position:'absolute',top:-2,bottom:-2,[dropSide === 'antes' ? 'left' : 'right']:-5,
        width:3,borderRadius:2,background:T.gold,boxShadow:`0 0 8px ${T.gold}`}}/>
    )}
    <div style={{borderRadius:6,overflow:'hidden',background:'#fff',pointerEvents:'none'}}>
      <PageThumb pdf={pdf} poolId={poolId} pageRef={pg.ref} ratio={pg.w / pg.h} root={root}/>
    </div>
    {/* nº da posição */}
    <div style={{position:'absolute',left:8,bottom:8,minWidth:22,height:19,padding:'0 6px',borderRadius:6,
      background:selected ? T.gold : 'rgba(20,20,25,.72)',color:'#fff',fontSize:11,fontWeight:700,
      display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>{idx + 1}</div>
    {/* ações */}
    <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4}}>
      <button title="Ampliar" onClick={(e)=>{ e.stopPropagation(); onPreview(idx); }}
        style={{width:24,height:24,borderRadius:6,border:'none',background:'rgba(255,255,255,.92)',
          color:T.textS,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,
          boxShadow:'0 1px 4px rgba(0,0,0,.18)'}}><I size={13}>{ORG_ICONS.lupa}</I></button>
      <button title="Excluir página" onClick={(e)=>{ e.stopPropagation(); onDelete(idx); }} disabled={busy}
        style={{width:24,height:24,borderRadius:6,border:'none',background:'rgba(255,255,255,.92)',
          color:T.danger,cursor:busy?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,
          boxShadow:'0 1px 4px rgba(0,0,0,.18)'}}><I size={13}>{ORG_ICONS.lixo}</I></button>
    </div>
    {/* mover uma casa (alternativa ao arraste) */}
    <div style={{position:'absolute',right:8,bottom:8,display:'flex',gap:4}}>
      <button title="Mover para trás" disabled={idx === 0} onClick={(e)=>{ e.stopPropagation(); onNudge(idx, -1); }}
        style={{width:22,height:19,borderRadius:5,border:'none',background:idx===0?'rgba(255,255,255,.5)':'rgba(255,255,255,.92)',
          color:idx===0?T.textD:T.textS,fontSize:11,cursor:idx===0?'default':'pointer',padding:0,lineHeight:1,
          boxShadow:'0 1px 4px rgba(0,0,0,.18)'}}>◀</button>
      <button title="Mover para frente" disabled={idx === total - 1} onClick={(e)=>{ e.stopPropagation(); onNudge(idx, 1); }}
        style={{width:22,height:19,borderRadius:5,border:'none',background:idx===total-1?'rgba(255,255,255,.5)':'rgba(255,255,255,.92)',
          color:idx===total-1?T.textD:T.textS,fontSize:11,cursor:idx===total-1?'default':'pointer',padding:0,lineHeight:1,
          boxShadow:'0 1px 4px rgba(0,0,0,.18)'}}>▶</button>
    </div>
  </div>
));

const PageOrganizer = ({ pdf, poolId, pages, busy, onMove, onDelete, onRestore, podeRestaurar, onClose, onPreview }) => {
  const [selRaw, setSel] = useState(() => new Set());
  const [drop, setDrop] = useState(null);        // { idx, lado }
  const dragRef  = useRef(null);                 // { ids:[], idx }
  const ancoraRef = useRef(0);                   // pra seleção com Shift
  const [wrap, setWrap] = useState(null);

  // páginas excluídas somem da seleção sozinhas (derivado, não guardado)
  const sel = useMemo(() => {
    if (!selRaw.size) return selRaw;
    const vivos = new Set(pages.map(p => p.id));
    const next = new Set([...selRaw].filter(id => vivos.has(id)));
    return next.size === selRaw.size ? selRaw : next;
  }, [selRaw, pages]);

  /* `drop` também num ref: o `soltar` precisa do destino atual sem virar uma
     função nova a cada dragover (o que re-renderizaria a grade inteira). */
  const dropRef = useRef(null);
  const marcarDrop = (d) => { dropRef.current = d; setDrop(d); };

  const idsSelecionados = useCallback((idx) => {
    const pg = pages[idx];
    return sel.has(pg.id) && sel.size > 1 ? pages.filter(p => sel.has(p.id)).map(p => p.id) : [pg.id];
  }, [pages, sel]);

  const pick = useCallback((idx, e) => {
    const pg = pages[idx];
    setSel(prev => {
      const next = new Set(prev);
      if (e.shiftKey) {
        const [a, b] = [ancoraRef.current, idx].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) next.add(pages[i].id);
        return next;
      }
      ancoraRef.current = idx;
      if (next.has(pg.id)) next.delete(pg.id); else next.add(pg.id);
      return next;
    });
  }, [pages]);

  const onDragStart = useCallback((idx, e) => {
    dragRef.current = { ids: idsSelecionados(idx), idx };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* ok */ }
  }, [idsSelecionados]);

  const onDragOver = useCallback((idx, e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const lado = (e.clientX - r.left) < r.width / 2 ? 'antes' : 'depois';
    const atual = dropRef.current;
    if (atual && atual.idx === idx && atual.lado === lado) return;   // nada mudou
    marcarDrop({ idx, lado });
  }, []);

  const soltar = useCallback((idx, e) => {
    e.preventDefault();
    const d = dragRef.current; const alvo = dropRef.current;
    dragRef.current = null; marcarDrop(null);
    if (!d) return;
    const lado = alvo && alvo.idx === idx ? alvo.lado : 'antes';
    onMove(d.ids, lado === 'antes' ? idx : idx + 1);
  }, [onMove]);

  const encerrar = useCallback(() => { dragRef.current = null; marcarDrop(null); }, []);

  const nudge = useCallback((idx, dir) => {
    const destino = dir < 0 ? idx - 1 : idx + 2;   // "pra depois do vizinho da frente"
    onMove([pages[idx].id], destino);
  }, [pages, onMove]);

  const apagarUm = useCallback((idx) => { onDelete([pages[idx].id]); }, [pages, onDelete]);

  const excluirSelecao = () => {
    if (!sel.size) return;
    onDelete([...sel]);
    setSel(new Set());
  };

  // Delete apaga a seleção enquanto o organizador está aberto
  useEffect(() => {
    const k = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (document.activeElement && document.activeElement.isContentEditable) return;
      if (!sel.size) return;
      e.preventDefault(); excluirSelecao();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const btn = (extra) => ({display:'inline-flex',alignItems:'center',gap:7,padding:'8px 13px',borderRadius:9,
    border:`1px solid ${T.border}`,background:'transparent',color:T.textS,fontSize:13,fontWeight:500,
    cursor:'pointer',fontFamily:'var(--font-body)',whiteSpace:'nowrap',...extra});

  return (
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:12}}>
        <span style={{fontSize:13.5,fontWeight:700,color:T.text}}>
          {pages.length} página{pages.length !== 1 ? 's' : ''}
        </span>
        {sel.size > 0 && <span style={{fontSize:12.5,color:T.gold,fontWeight:600}}>· {sel.size} selecionada{sel.size !== 1 ? 's' : ''}</span>}
        <div style={{flex:1}}/>
        <button style={btn()} onClick={() => setSel(new Set(pages.map(p => p.id)))}>Selecionar tudo</button>
        <button style={btn()} onClick={() => setSel(new Set())} disabled={!sel.size}>Limpar seleção</button>
        <button style={btn({color:T.danger,borderColor:`${T.danger}55`,opacity:sel.size?1:.45})}
          onClick={excluirSelecao} disabled={!sel.size || busy}>
          <I size={14}>{ORG_ICONS.lixo}</I> Excluir selecionadas
        </button>
        <button style={btn({opacity:podeRestaurar?1:.45})} onClick={onRestore} disabled={!podeRestaurar || busy}>
          <I size={14}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></I> Restaurar ordem
        </button>
        <button style={btn({background:T.gold,color:'#fff',border:'none',fontWeight:700})} onClick={onClose}>
          <I size={14}><polyline points="20 6 9 17 4 12"/></I> Concluir
        </button>
      </div>

      <div style={{fontSize:12.5,color:T.textT,marginBottom:10}}>
        Arraste as páginas pra reordenar · clique pra selecionar (Shift = intervalo) · duplo clique ou a <strong style={{color:T.textS}}>lupa</strong> amplia · Delete exclui a seleção.
      </div>

      <div ref={setWrap} onDragLeave={() => marcarDrop(null)}
        style={{maxHeight:'70vh',overflowY:'auto',background:T.page,border:`1px solid ${T.border}`,
          borderRadius:12,padding:14,display:'grid',gap:12,
          gridTemplateColumns:'repeat(auto-fill, minmax(148px, 1fr))',alignContent:'start'}}>
        {pages.map((pg, i) => (
          <OrgCard key={pg.id} pg={pg} idx={i} total={pages.length} pdf={pdf} poolId={poolId} root={wrap}
            busy={busy} selected={sel.has(pg.id)}
            dropSide={drop && drop.idx === i ? drop.lado : null}
            onPick={pick} onPreview={onPreview} onDelete={apagarUm}
            onNudge={nudge} onDragStart={onDragStart} onDragOver={onDragOver}
            onDrop={soltar} onDragEnd={encerrar}/>
        ))}
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
  /* `pages` é a ORDEM ATUAL do documento: [{ id, ref, w, h }].
     `ref` = índice da página dentro do PDF de origem (srcRef), `id` = chave
     estável usada pelas anotações. Mover/excluir página mexe só neste array —
     o PDF só é remontado na hora de salvar. */
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
  const [orgOpen, setOrgOpen] = useState(false);      // modo "Organizar páginas"
  const [previewIdx, setPreviewIdx] = useState(null); // pré-visualização grande
  const [scroller, setScroller] = useState(null);     // container que rola as páginas
  const [railEl, setRailEl] = useState(null);         // container das miniaturas laterais
  const [poolId, setPoolId] = useState(0);           // identidade do pool (pro cache de miniaturas)
  const [origPages, setOrigPages] = useState([]);    // ordem original (pra restaurar)

  const srcRef    = useRef(null);
  const scaleRef  = useRef(scale);
  const annosRef  = useRef(annos);
  const pagesRef  = useRef(pages);
  const pdfRef    = useRef(null);
  const poolRef   = useRef(0);            // identidade do "pool" de páginas de origem
  const extraidoRef = useRef(new Set());  // pageIds com texto já extraído
  const fundoRef  = useRef(new Set());    // pageIds com fundo já amostrado
  const histRef   = useRef([]);
  const dragRef   = useRef(null);
  const drawRef   = useRef(null);
  const [drawBox, setDrawBox] = useState(null); // preview do whiteout sendo arrastado
  const dragPageRef = useRef(null); // id da miniatura sendo arrastada (reordenar páginas)
  const [overPageIdx, setOverPageIdx] = useState(null);
  const editedFocus = useRef(false);
  const fileInput = useRef();
  const addInput  = useRef();
  const imgInput  = useRef();

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { annosRef.current = annos; }, [annos]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { pdfRef.current = pdf; }, [pdf]);
  useEffect(() => { if (onDoc) onDoc(!!pdf); }, [pdf, onDoc]);

  /* Histórico guarda ORDEM + anotações: assim "Desfazer" também volta uma
     página excluída ou movida por engano. */
  const pushHistory = useCallback(() => {
    histRef.current.push(JSON.stringify({ pages: pagesRef.current, annos: annosRef.current }));
    if (histRef.current.length > 60) histRef.current.shift();
    setCanUndo(true);
  }, []);
  const undo = () => {
    const prev = histRef.current.pop();
    if (prev != null) {
      try {
        const snap = JSON.parse(prev);
        const as = snap.annos || [];
        setAnnos(as); setPages(snap.pages || []);
        // páginas que voltaram sem texto precisam ser extraídas de novo
        const comTexto = new Set(as.filter(a => a.isOriginal).map(a => a.pageId));
        extraidoRef.current = new Set([...extraidoRef.current].filter(id => comTexto.has(id)));
        fundoRef.current    = new Set([...fundoRef.current].filter(id => comTexto.has(id)));
      } catch { /* snapshot inválido */ }
      setSelId(null); setFocusId(null);
    }
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
        poolRef.current = editorCache.poolId || ++_poolSeq;
        setPoolId(poolRef.current);
        setOrigPages(editorCache.origPages || editorCache.pages || []);
        extraidoRef.current = new Set(editorCache.extracted || []);
        fundoRef.current    = new Set(editorCache.bgDone || []);
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
      editorCache.poolId = poolRef.current;
      editorCache.origPages = origPages;
      editorCache.extracted = [...extraidoRef.current];
      editorCache.bgDone = [...fundoRef.current];
    }
  }, [pages, annos, fileName, scale, origPages]);

  /* ── extração de texto SOB DEMANDA ────────────────────────────────────────
     Abrir um PDF de 200 páginas não pode custar 200 rasterizações. A abertura
     só lê as dimensões; o texto de cada página é extraído quando ela chega
     perto da tela (`PageSlot` avisa), no máximo 2 páginas por vez. */
  const extQ = useRef({
    fila: [], rodando: 0,
    doc: () => pdfRef.current,
    pronto: (pg, items) => {
      if (!items.length) return;
      if (!pagesRef.current.some(p => p.id === pg.id)) return;   // página excluída no meio
      setAnnos(prev => prev.some(a => a.pageId === pg.id) ? prev : [...prev, ...items]);
    },
    falhou: (pg) => { extraidoRef.current.delete(pg.id); },
  });

  const garantirTexto = useCallback((pg) => {
    if (!pg || extraidoRef.current.has(pg.id)) return;
    extraidoRef.current.add(pg.id);
    extQ.current.fila.push(pg);
    pumpExtract(extQ.current);
  }, []);

  /* Cor de fundo atrás dos textos de uma página — uma rasterização, feita só
     quando o usuário vai de fato mexer no texto dela (é o que cobre o texto
     original ao salvar). */
  const garantirFundo = useCallback(async (pg) => {
    if (!pg || fundoRef.current.has(pg.id) || !pdfRef.current) return;
    // texto ainda não extraído → não marca como feito, tenta de novo depois
    const lista = annosRef.current.filter(a => a.pageId === pg.id && a.isOriginal && !a.bg);
    if (!lista.length) return;
    fundoRef.current.add(pg.id);
    try {
      const mapa = await bgForAnnos(pdfRef.current, pg.ref, lista);
      setAnnos(prev => prev.map(a => mapa.has(a.id) ? { ...a, bg: mapa.get(a.id) } : a));
    } catch { fundoRef.current.delete(pg.id); }
  }, []);

  /* ── abrir PDF ── */
  const openFile = async (file) => {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const ab  = await file.arrayBuffer();
      const src = new Uint8Array(ab);
      const doc = await pdfjsLib.getDocument({ data: src.slice() }).promise;
      const dims = await readPageSizes(doc);
      const pgs = dims.map((d, i) => ({ id: uid(), ref: i, w: d.w, h: d.h }));
      limparThumbs(poolRef.current);
      srcRef.current = src;
      poolRef.current = ++_poolSeq;
      setPoolId(poolRef.current);
      setOrigPages(pgs);
      extraidoRef.current = new Set(); fundoRef.current = new Set();
      extQ.current.fila.length = 0;
      setPdf(doc); setPages(pgs); setFileName(file.name);
      setAnnos([]); setSelId(null); setFocusId(null);
      histRef.current = []; setCanUndo(false); setActivePage(0);
      setOrgOpen(false); setPreviewIdx(null);
    } catch (e) {
      setError('Não foi possível abrir o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── excluir todas as páginas (fecha o documento atual) ── */
  const deleteAllPages = useCallback(() => {
    if (!srcRef.current) return;
    if (!window.confirm('Excluir todas as páginas? O documento atual será fechado.')) return;
    limparThumbs(poolRef.current);
    srcRef.current = null;
    editorCache.src = null; editorCache.pages = null; editorCache.annos = null; editorCache.fileName = '';
    editorCache.origPages = null; editorCache.extracted = null; editorCache.bgDone = null;
    setOrigPages([]); extraidoRef.current = new Set(); fundoRef.current = new Set();
    extQ.current.fila.length = 0;
    setPdf(null); setPages([]); setAnnos([]); setFileName('');
    setSelId(null); setFocusId(null); setOrgOpen(false); setPreviewIdx(null);
    histRef.current = []; setCanUndo(false); setActivePage(0);
  }, []);

  /* ── operações de página (instantâneas: mexem só na ordem em memória) ── */
  const removerPaginas = useCallback((ids) => {
    const alvo = new Set(Array.isArray(ids) ? ids : [ids]);
    if (!alvo.size) return;
    const atual = pagesRef.current;
    if (alvo.size >= atual.length) { deleteAllPages(); return; }
    pushHistory();
    const restante = atual.filter(p => !alvo.has(p.id));
    setPages(restante);
    setAnnos(prev => prev.filter(a => !alvo.has(a.pageId)));
    setSelId(null); setFocusId(null);
    setActivePage(ap => clamp(ap, 0, restante.length - 1));
    setPreviewIdx(pi => (pi == null ? pi : clamp(pi, 0, restante.length - 1)));
  }, [pushHistory, deleteAllPages]);

  /* Move um bloco de páginas para a posição `destino` da lista ATUAL.
     As anotações não precisam de remapeamento: elas apontam pro `id` da
     página, então acompanham a mudança de graça. */
  const moverPaginas = useCallback((ids, destino) => {
    const alvo = new Set(ids);
    const atual = pagesRef.current;
    const bloco = atual.filter(p => alvo.has(p.id));
    if (!bloco.length) return;
    const restante = atual.filter(p => !alvo.has(p.id));
    const antes = atual.slice(0, clamp(destino, 0, atual.length)).filter(p => alvo.has(p.id)).length;
    const pos = clamp(destino - antes, 0, restante.length);
    const novo = [...restante.slice(0, pos), ...bloco, ...restante.slice(pos)];
    if (novo.every((p, i) => p === atual[i])) return;   // nada mudou de lugar
    pushHistory();
    setPages(novo);
    setActivePage(novo.findIndex(p => p.id === bloco[0].id));
    setSelId(null); setFocusId(null);
  }, [pushHistory]);

  const restaurarOrdem = useCallback(() => {
    const orig = origPages;
    if (!orig.length) return;
    pushHistory();
    setPages(orig);
    // páginas que voltaram (tinham sido excluídas) precisam de extração de novo
    const comTexto = new Set(annosRef.current.filter(a => a.isOriginal).map(a => a.pageId));
    extraidoRef.current = new Set([...extraidoRef.current].filter(id => comTexto.has(id)));
    fundoRef.current    = new Set([...fundoRef.current].filter(id => comTexto.has(id)));
    setSelId(null); setFocusId(null); setActivePage(0);
  }, [pushHistory, origPages]);

  const ordemMudou = pages.length !== origPages.length
    || pages.some((p, i) => p.id !== origPages[i]?.id);

  /* ── adicionar outro PDF (anexa as páginas ao documento atual) ── */
  const addPdf = async (file) => {
    if (!file) return;
    if (!srcRef.current) { openFile(file); return; }
    setError(''); setBusy(true);
    try {
      const ab = await file.arrayBuffer();
      const A = await PDFDocument.load(srcRef.current.slice(), { ignoreEncryption: true });
      const B = await PDFDocument.load(new Uint8Array(ab), { ignoreEncryption: true });
      const antes = A.getPageCount();
      const copied = await A.copyPages(B, B.getPageIndices());
      copied.forEach(pg => A.addPage(pg));
      const merged = new Uint8Array(await A.save());
      const doc = await pdfjsLib.getDocument({ data: merged.slice() }).promise;
      // As páginas novas entram no FIM do pool de origem, então todo `ref` que
      // já existia continua apontando pra mesma página: a ordem montada pelo
      // usuário e as anotações ficam de pé, e as miniaturas em cache valem.
      const dims = await readPageSizes(doc, antes);
      const novas = dims.map((d, i) => ({ id: uid(), ref: antes + i, w: d.w, h: d.h }));
      srcRef.current = merged;
      pushHistory();
      setPdf(doc);
      setPages(p => [...p, ...novas]);
      setOrigPages(o => [...o, ...novas]);
    } catch (e) {
      setError('Não foi possível adicionar o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── adicionar elementos ── */
  const addText = (pageId, xPt, topPt) => {
    pushHistory();
    const id = uid(), fs = 14;
    setAnnos(p => [...p, { id, pageId, type:'text', isOriginal:false,
      x:xPt, top:topPt, fs, asc:fs*0.8, desc:fs*0.2, w:120, serif:false, bold:false, italic:false,
      str:'Novo texto', orig:undefined, color:'#111111' }]);
    setSelId(id); setTool('select');
  };
  const addWhiteout = useCallback((pageId, xPt, topPt) => {
    pushHistory();
    const id = uid();
    setAnnos(p => [...p, { id, pageId, type:'whiteout', x:xPt-60, top:topPt-20, w:120, h:40 }]);
    setSelId(id); setTool('select');
  }, [pushHistory]);
  // Cria o whiteout já com a área exata que o usuário arrastou (em vez de um
  // tamanho fixo pra depois mover/redimensionar).
  const addWhiteoutRect = useCallback((pageId, xPt, topPt, wPt, hPt) => {
    pushHistory();
    const id = uid();
    setAnnos(p => [...p, { id, pageId, type:'whiteout', x:xPt, top:topPt, w:wPt, h:hPt }]);
    setSelId(id); setTool('select');
  }, [pushHistory]);
  const addImageAnno = (dataUrl, type, repeat=false) => {
    const img = new Image();
    img.onload = () => {
      const base = pages[clamp(activePage, 0, pages.length-1)];
      if (!base) return;
      pushHistory();
      const aspect = img.width / img.height;
      const targets = repeat ? pages.map(p => p.id) : [base.id];
      // mesma posição/tamanho em todas (assinatura sincronizada entre páginas)
      const w = Math.min(180, base.w*0.4); const h = w/aspect;
      const x = (base.w - w)/2, top = (base.h - h)/2;
      const group = repeat ? uid() : null;
      const created = targets.map(pid => ({ id: uid(), pageId: pid, type, x, top, w, h, src:dataUrl, group }));
      setAnnos(p => [...p, ...created]);
      setSelId(created[0].id);
    };
    img.src = dataUrl;
  };

  const onPageClick = (pg, idx, e) => {
    setActivePage(idx);
    if (tool === 'text') {
      garantirFundo(pg);
      const r = e.currentTarget.getBoundingClientRect();
      addText(pg.id, (e.clientX-r.left)/scale, (e.clientY-r.top)/scale);
    } else if (tool !== 'whiteout') {
      // whiteout agora é feito por arraste (ver onPagePointerDown) — não por clique
      setSelId(null);
    }
  };

  // Whiteout: arrasta pra desenhar a área exata que quer cobrir de branco.
  const onPagePointerDown = (pg, idx, e) => {
    if (tool !== 'whiteout') return;
    e.preventDefault();
    setActivePage(idx);
    const r = e.currentTarget.getBoundingClientRect();
    drawRef.current = { pageId: pg.id, rect:r, sx:e.clientX, sy:e.clientY };
    setDrawBox({ pageId: pg.id, x:(e.clientX-r.left)/scale, top:(e.clientY-r.top)/scale, w:0, h:0 });
  };

  const updateAnno = (id, patch) => setAnnos(p => p.map(a => a.id===id ? {...a, ...patch} : a));

  /* Agrupa as anotações por página UMA vez por mudança, em vez de rodar um
     `annos.filter()` por página a cada render: com N páginas e M anotações
     era O(N×M) por quadro do arraste, e num PDF de muitas páginas isso pesava
     sozinho. Aqui vira O(M). */
  const annosPorPagina = useMemo(() => {
    const m = new Map();
    for (const a of annos) {
      const lista = m.get(a.pageId);
      if (lista) lista.push(a); else m.set(a.pageId, [a]);
    }
    return m;
  }, [annos]);

  /* ── drag / resize ──────────────────────────────────────────────────────
     O `pointermove` dispara MUITAS vezes por quadro (mouse/caneta modernos
     mandam 120–1000 eventos/s). Antes cada evento fazia um setState, ou seja
     um `annos.map()` novo + re-render do editor inteiro por evento — era a
     causa principal da sensação de travado. Agora o evento só ANOTA a última
     posição e um requestAnimationFrame aplica UMA vez por quadro: o trabalho
     cai pra ~60 atualizações/s no máximo, sincronizado com a tela. */
  const rafRef = useRef(0);
  const lastPtRef = useRef(null);
  useEffect(() => {
    const aplicar = () => {
      rafRef.current = 0;
      const e = lastPtRef.current; if (!e) return;
      const d = dragRef.current;
      if (d) {
        const s = scaleRef.current;
        const dx = (e.clientX-d.sx)/s, dy = (e.clientY-d.sy)/s;
        setAnnos(prev => {
          let mudou = false;
          const out = prev.map(a => {
            const match = d.group ? a.group === d.group : a.id === d.id;
            if (!match) return a;
            let novo = a;
            if (d.mode === 'move')     novo = { ...a, x:d.ox+dx, top:d.oy+dy };
            else if (d.mode === 'resizeI')  { const w=Math.max(24,d.ow+dx); novo = { ...a, w, h:w/d.aspect }; }
            else if (d.mode === 'resizeWH') novo = { ...a, w:Math.max(24,d.ow+dx), h:Math.max(16,d.oh+dy) };
            if (novo !== a) mudou = true;
            return novo;
          });
          return mudou ? out : prev;   // nada mudou → não re-renderiza
        });
        return;
      }
      const w = drawRef.current; if (!w) return;
      const s = scaleRef.current;
      const x0 = (w.sx-w.rect.left)/s, y0 = (w.sy-w.rect.top)/s;
      const x1 = (e.clientX-w.rect.left)/s, y1 = (e.clientY-w.rect.top)/s;
      setDrawBox({ pageId:w.pageId, x:Math.min(x0,x1), top:Math.min(y0,y1), w:Math.abs(x1-x0), h:Math.abs(y1-y0) });
    };
    const move = (e) => {
      if (!dragRef.current && !drawRef.current) return;   // nem arrastando nem desenhando: ignora
      // Guarda só o que interessa (o evento nativo é reciclado pelo navegador).
      lastPtRef.current = { clientX:e.clientX, clientY:e.clientY };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(aplicar);
    };
    const up = (e) => {
      // Aplica o último movimento pendente ANTES de encerrar — senão o quadro
      // agendado rodaria depois com dragRef já nulo e a peça "voltaria" um
      // fio pra posição do quadro anterior.
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current); rafRef.current = 0;
        if (dragRef.current || drawRef.current) aplicar();
      }
      if (dragRef.current) { dragRef.current = null; return; }
      const w = drawRef.current; if (!w) return;
      drawRef.current = null;
      setDrawBox(null);
      const s = scaleRef.current;
      const x0 = (w.sx-w.rect.left)/s, y0 = (w.sy-w.rect.top)/s;
      const x1 = (e.clientX-w.rect.left)/s, y1 = (e.clientY-w.rect.top)/s;
      const wid = Math.abs(x1-x0), hei = Math.abs(y1-y0);
      // Arraste pequeno demais (praticamente um clique) → caixa padrão centrada ali
      if (wid < 6 || hei < 6) addWhiteout(w.pageId, x0, y0);
      else addWhiteoutRect(w.pageId, Math.min(x0,x1), Math.min(y0,y1), wid, hei);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    };
  }, [addWhiteout, addWhiteoutRect]);

  const startDrag = (e, a, mode) => {
    e.stopPropagation(); e.preventDefault();
    setSelId(a.id); pushHistory();
    dragRef.current = { id:a.id, group:a.group||null, mode, sx:e.clientX, sy:e.clientY, ox:a.x, oy:a.top, ow:a.w, oh:a.h, aspect:(a.w/(a.h||1)) };
  };

  /* ── salvar ──────────────────────────────────────────────────────────────
     É AQUI que a ordem das páginas vira arquivo: enquanto o usuário organiza,
     nada é reescrito. Se a ordem não mudou, o documento original é usado
     direto (preserva tudo que o pdf-lib não copia). */
  const salvar = async () => {
    if (!srcRef.current || !pages.length) return;
    setBusy(true); setError('');
    try {
      const origem = await PDFDocument.load(srcRef.current.slice(), { ignoreEncryption: true });
      const ordem = pages.map(p => p.ref);
      const intacto = ordem.length === origem.getPageCount() && ordem.every((r, i) => r === i);
      let doc = origem;
      if (!intacto) {
        doc = await PDFDocument.create();
        const copiadas = await doc.copyPages(origem, ordem);
        copiadas.forEach(pg => doc.addPage(pg));
      }
      const docPages = doc.getPages();

      // Fundos ainda não amostrados de textos que foram alterados (são eles que
      // cobrem o texto original). Normalmente já vieram do foco na edição.
      const bgExtra = new Map();
      for (const pg of pages) {
        const faltando = annos.filter(a => a.pageId===pg.id && a.type==='text' && a.isOriginal && a.str!==a.orig && !a.bg);
        if (!faltando.length) continue;
        try {
          const mapa = await bgForAnnos(pdf, pg.ref, faltando);
          mapa.forEach((v, k) => bgExtra.set(k, v));
        } catch { /* sem amostra: cai no branco */ }
      }

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

      for (let i = 0; i < pages.length; i++) {
        const page = docPages[i]; if (!page) continue;
        const H = page.getHeight();

        for (const a of (annosPorPagina.get(pages[i].id) || EMPTY_ARR)) {
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
            const bg = a.bg || bgExtra.get(a.id) || WHITE_BG;
            page.drawRectangle({ x:a.x-1, y:H-a.top-a.fs*1.28, width:a.w+2, height:a.fs*1.45, color:rgb(bg.r/255, bg.g/255, bg.b/255) });
          }
          const text = sanitizeWinAnsi(a.str);
          if (!text) continue;

          const variantKey = (a.serif?'t':'h')+(a.bold?'b':'')+(a.italic?'i':'');
          const font = await getFont(a.serif, a.bold, a.italic);
          const fontKey = getFontKey(i, page, variantKey, font);
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
      if (e.key === 'Delete' && selId && !orgOpen) {
        const a = annosRef.current.find(x=>x.id===selId);
        const editing = document.activeElement && document.activeElement.isContentEditable;
        if (a && !(a.type==='text' && editing)) { e.preventDefault(); deleteAnno(selId); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, orgOpen, deleteAnno]);

  /* ── sem arquivo ── */
  if (!pdf) {
    return (
      <div style={{maxWidth:560}}>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:24}}>
          Carregue um PDF para editar o texto existente — clique sobre qualquer texto e altere, mantendo a mesma posição e estilo. Também é possível organizar as páginas (mover e excluir), adicionar texto, imagens e assinaturas.
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
      <style>{'@keyframes pdfShimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}'}</style>

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
        <button style={tbBtn(orgOpen)} onClick={()=>{ setOrgOpen(o=>!o); setSelId(null); setFocusId(null); }}>
          <I><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></I>
          Organizar páginas
        </button>
        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>
        <button style={tbBtn(tool==='text')} onClick={()=>{ setOrgOpen(false); setTool(tool==='text'?'select':'text'); }}>
          <I><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></I> Editar Texto
        </button>
        <button style={tbBtn(tool==='whiteout')} onClick={()=>{ setOrgOpen(false); setTool(tool==='whiteout'?'select':'whiteout'); }}>
          <I><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="7" y1="12" x2="17" y2="12"/></I> Whiteout
        </button>
        <button style={tbBtn(false)} onClick={()=>{ setOrgOpen(false); imgInput.current?.click(); }}>
          <I><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></I> Imagem
        </button>
        <input ref={imgInput} type="file" accept="image/png,image/jpeg" style={{display:'none'}}
          onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=()=>addImageAnno(r.result,'image'); r.readAsDataURL(f);} e.target.value=''; }}/>
        <button style={tbBtn(false)} onClick={()=>{ setOrgOpen(false); setSigOpen(true); }}>
          <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I> Assinatura
        </button>
        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>
        <button style={tbBtn(false)} onClick={undo} disabled={!canUndo}>
          <I><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></I> Desfazer
        </button>
        <button style={{...tbBtn(false),color:T.danger,borderColor:`${T.danger}55`}} onClick={deleteAllPages} disabled={busy}>
          <I><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></I> Excluir todas as páginas
        </button>
        <div style={{flex:1}}/>
        {!orgOpen && (
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <button style={{...tbBtn(false),padding:'7px 11px'}} onClick={()=>setScale(s=>Math.max(0.5,+(s-0.1).toFixed(2)))}>−</button>
            <span style={{fontSize:13,color:T.textS,minWidth:46,textAlign:'center'}}>{Math.round(scale*100)}%</span>
            <button style={{...tbBtn(false),padding:'7px 11px'}} onClick={()=>setScale(s=>Math.min(3,+(s+0.1).toFixed(2)))}>+</button>
          </div>
        )}
      </div>

      {error && <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>{error}</div>}

      {!orgOpen && tool==='text' && <div style={{marginBottom:10,fontSize:12.5,color:T.textT}}>Clique sobre um texto do PDF para editá-lo, ou clique numa área vazia para adicionar texto novo.</div>}
      {!orgOpen && tool==='whiteout' && <div style={{marginBottom:10,fontSize:12.5,color:T.textT}}>Arraste sobre a área que quer cobrir de branco (ou só clique pra inserir uma caixa padrão).</div>}

      {orgOpen ? (
        <PageOrganizer
          pdf={pdf} poolId={poolId} pages={pages} busy={busy}
          onMove={moverPaginas} onDelete={removerPaginas}
          onRestore={restaurarOrdem} podeRestaurar={ordemMudou}
          onPreview={setPreviewIdx}
          onClose={()=>setOrgOpen(false)}/>
      ) : (
      <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
        {/* Miniaturas */}
        <div style={{width:126,flexShrink:0,display:'flex',flexDirection:'column'}}>
          <div style={{fontSize:10,color:T.textD,marginBottom:6,lineHeight:1.4}}>Arraste pra reordenar</div>
          <div ref={setRailEl} style={{maxHeight:'68vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:8,paddingRight:4}}
            onDragLeave={()=>setOverPageIdx(null)}>
          {pages.map((pg,i)=>(
            <div key={pg.id}
              draggable={!busy}
              onClick={()=>{ setActivePage(i); document.getElementById('pdfpg-'+pg.id)?.scrollIntoView({behavior:'smooth',block:'start'}); }}
              onDragStart={e=>{ dragPageRef.current = pg.id; e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={e=>{ e.preventDefault(); if (dragPageRef.current !== null) setOverPageIdx(i); }}
              onDrop={e=>{
                e.preventDefault();
                const from = dragPageRef.current;
                dragPageRef.current = null; setOverPageIdx(null);
                if (from === null || from === pg.id) return;
                // metade de baixo da miniatura = soltar DEPOIS dela (senão não
                // dava pra mandar uma página pro fim do documento)
                const r = e.currentTarget.getBoundingClientRect();
                moverPaginas([from], (e.clientY - r.top) > r.height/2 ? i+1 : i);
              }}
              onDragEnd={()=>{ dragPageRef.current = null; setOverPageIdx(null); }}
              style={{cursor:busy?'default':'grab',border:`2px solid ${overPageIdx===i||activePage===i?T.gold:T.border}`,borderRadius:8,overflow:'hidden',background:'#fff',position:'relative',transition:'border-color .12s'}}>
              <PageThumb pdf={pdf} poolId={poolId} pageRef={pg.ref} ratio={pg.w/pg.h} root={railEl} rootMargin="600px 0px"/>
              <div style={{position:'absolute',bottom:2,right:4,fontSize:10,color:T.textT,background:'rgba(255,255,255,.8)',borderRadius:4,padding:'0 4px'}}>{i+1}</div>
              <button title="Ampliar" onClick={e=>{ e.stopPropagation(); setPreviewIdx(i); }}
                style={{position:'absolute',top:2,left:2,width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,.85)',border:`1px solid ${T.border}`,borderRadius:5,color:T.textS,cursor:'pointer',padding:0}}>
                <I size={11}>{ORG_ICONS.lupa}</I></button>
              <button title="Excluir página" onClick={e=>{ e.stopPropagation(); removerPaginas([pg.id]); }} disabled={busy}
                style={{position:'absolute',top:2,right:2,width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,.85)',border:`1px solid ${T.border}`,borderRadius:5,color:T.danger,cursor:busy?'default':'pointer',padding:0}}>
                <I size={11}>{ORG_ICONS.lixo}</I></button>
            </div>
          ))}
          </div>
          <button onClick={()=>setOrgOpen(true)}
            style={{marginTop:8,padding:'7px 8px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',
              color:T.textS,fontSize:11.5,cursor:'pointer',fontFamily:'var(--font-body)'}}>Organizar páginas</button>
        </div>

        {/* Páginas */}
        <div ref={setScroller} style={{flex:1,maxHeight:'72vh',overflow:'auto',background:T.page,borderRadius:12,padding:'16px',border:`1px solid ${T.border}`}}>
          {pages.map((pg,i)=>(
            <PageSlot key={pg.id} pg={pg} scale={scale} root={scroller} onSeen={garantirTexto} render={()=>(
              <div style={{position:'relative',width:pg.w*scale,height:pg.h*scale}}>
                <PdfCanvas pdf={pdf} index={pg.ref} scale={scale} quality={RENDER_QUALITY}/>
                <div onClick={(e)=>onPageClick(pg,i,e)} onPointerDown={(e)=>onPagePointerDown(pg,i,e)} style={{position:'absolute',inset:0,cursor:tool==='text'?'text':tool==='whiteout'?'crosshair':'default'}}>
                  {drawBox && drawBox.pageId===pg.id && (
                    <div style={{position:'absolute',left:drawBox.x*scale,top:drawBox.top*scale,width:drawBox.w*scale,height:drawBox.h*scale,background:'rgba(255,255,255,.65)',outline:`1.5px dashed ${T.gold}`,zIndex:7,pointerEvents:'none'}}/>
                  )}
                  {(annosPorPagina.get(pg.id) || EMPTY_ARR).map(a => {
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
                            onFocus={()=>{ setFocusId(a.id); setSelId(a.id); editedFocus.current=false; garantirFundo(pg); }}
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
            )}/>
          ))}
        </div>

        {/* Propriedades */}
        <div style={{width:194,flexShrink:0}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:12}}>Propriedades</div>
            {!sel && <div style={{fontSize:12.5,color:T.textD,lineHeight:1.6}}>Clique sobre um texto do PDF para editá-lo. Use a barra para organizar páginas ou adicionar texto, imagem e assinatura.</div>}
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
      )}

      {previewIdx != null && (
        <PagePreviewModal pdf={pdf} pages={pages} idx={clamp(previewIdx,0,pages.length-1)}
          onIdx={setPreviewIdx} onClose={()=>setPreviewIdx(null)}/>
      )}
      {sigOpen && <SignatureModal onClose={()=>setSigOpen(false)} onUse={(dataUrl, repeat)=>{ addImageAnno(dataUrl,'signature',repeat); setSigOpen(false); }}/>}
    </div>
  );
};
