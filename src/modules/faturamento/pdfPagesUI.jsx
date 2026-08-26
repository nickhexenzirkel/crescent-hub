/* ════════════════════════════════════════════════════════════════
   Componentes compartilhados pelas ferramentas de página de PDF:
   página renderizada, miniatura, pré-visualização e a grade de organização.
════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback, useMemo, useReducer, memo } from 'react';
import { T } from '../../contexts/theme';
import { clamp, thumbCache, requestThumb, useInView } from './pdfPages';

/* ─── Ícone inline ─── */
export const I = (p) => (
  <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

export const IconeLupa = (p) => (
  <I size={p.size}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></I>
);
export const IconeLixo = (p) => (
  <I size={p.size}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></I>
);

/* ════════════════════════════════════════════════════════════════
   Canvas de uma página (render via pdf.js)
════════════════════════════════════════════════════════════════ */
/* `memo`: sem isso, QUALQUER mexida numa anotação re-renderizava o canvas de
   TODAS as páginas. O `useEffect` até não re-rodava (as deps não mudam), mas o
   React refazia o VDOM de todas elas a cada quadro do arraste — desperdício
   que crescia com o número de páginas. As props aqui são todas primitivas
   (fora `pdf`, que é estável), então a comparação rasa do memo basta. */
export const PdfCanvas = memo(({ pdf, index, scale, quality = 1 }) => {
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
   Miniatura de página (JPEG em cache, desenhada só quando entra na tela)
════════════════════════════════════════════════════════════════ */
export const PageThumb = memo(({ pdf, poolId, pageRef, ratio, root, rootMargin = '400px 0px' }) => {
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

/* ════════════════════════════════════════════════════════════════
   Pré-visualização grande de uma página
════════════════════════════════════════════════════════════════ */
export const PagePreviewModal = ({ pdf, pages, idx, onIdx, onClose }) => {
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
export const OrgCard = memo(({ pg, idx, pdf, poolId, root, selected, dropSide, busy,
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
          boxShadow:'0 1px 4px rgba(0,0,0,.18)'}}><IconeLupa size={13}/></button>
      <button title="Excluir página" onClick={(e)=>{ e.stopPropagation(); onDelete(idx); }} disabled={busy}
        style={{width:24,height:24,borderRadius:6,border:'none',background:'rgba(255,255,255,.92)',
          color:T.danger,cursor:busy?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,
          boxShadow:'0 1px 4px rgba(0,0,0,.18)'}}><IconeLixo size={13}/></button>
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

export const PageOrganizer = ({ pdf, poolId, pages, busy, onMove, onDelete, onRestore, podeRestaurar, onPreview }) => {
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
          <IconeLixo size={14}/> Excluir selecionadas
        </button>
        <button style={btn({opacity:podeRestaurar?1:.45})} onClick={onRestore} disabled={!podeRestaurar || busy}>
          <I size={14}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></I> Restaurar ordem
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
