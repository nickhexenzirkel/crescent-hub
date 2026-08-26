/* ════════════════════════════════════════════════════════════════
   ORGANIZAR PDF — ferramenta própria (irmã do Editor de PDF e do Mesclar)
   Abre um PDF, mostra todas as páginas em miniatura e deixa mover, excluir e
   ampliar antes de salvar na nova ordem.

   O arquivo NÃO é reescrito a cada mexida: `pages` guarda só a ordem
   ([{ id, ref }], onde `ref` é a página no PDF de origem) e o PDF é remontado
   uma única vez, no "Salvar como...". É isso que faz mover/excluir ser
   instantâneo mesmo com centenas de páginas.
════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { T } from '../../contexts/theme';
import { uid, clamp, loadPdfDoc, readPageSizes, reordenarPaginas, limparThumbs, novoPoolId } from './pdfPages';
import { I, PageOrganizer, PagePreviewModal } from './pdfPagesUI';

/* Mantém o trabalho ao trocar de aba e voltar (enquanto o app não recarrega) */
const orgCache = { src:null, pages:null, origPages:null, fileName:'', poolId:0 };

export const PdfOrganizer = ({ onDoc }) => {
  const [fileName, setFileName]   = useState('');
  const [pdf, setPdf]             = useState(null);
  const [pages, setPages]         = useState([]);      // [{ id, ref, w, h }]
  const [origPages, setOrigPages] = useState([]);      // ordem de quando abriu
  const [poolId, setPoolId]       = useState(0);
  const [previewIdx, setPreviewIdx] = useState(null);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [canUndo, setCanUndo]     = useState(false);
  const [salvo, setSalvo]         = useState(false);

  const srcRef   = useRef(null);
  const pagesRef = useRef(pages);
  const poolRef  = useRef(0);
  const histRef  = useRef([]);
  const fileInput = useRef();
  const addInput  = useRef();

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { if (onDoc) onDoc(!!pdf); }, [pdf, onDoc]);

  /* restaura / guarda o trabalho no cache de memória */
  useEffect(() => {
    if (!orgCache.src) return;
    (async () => {
      try {
        const doc = await loadPdfDoc(orgCache.src.slice());
        srcRef.current = orgCache.src;
        poolRef.current = orgCache.poolId || novoPoolId();
        setPoolId(poolRef.current);
        setPdf(doc);
        setPages(orgCache.pages || []);
        setOrigPages(orgCache.origPages || orgCache.pages || []);
        setFileName(orgCache.fileName || '');
      } catch { /* cache inválido */ }
    })();
  }, []);

  useEffect(() => {
    if (!srcRef.current) return;
    orgCache.src = srcRef.current;
    orgCache.pages = pages; orgCache.origPages = origPages;
    orgCache.fileName = fileName; orgCache.poolId = poolRef.current;
  }, [pages, origPages, fileName]);

  const pushHistory = useCallback(() => {
    histRef.current.push(JSON.stringify(pagesRef.current));
    if (histRef.current.length > 60) histRef.current.shift();
    setCanUndo(true);
  }, []);

  const undo = () => {
    const prev = histRef.current.pop();
    if (prev != null) { try { setPages(JSON.parse(prev)); } catch { /* ignora */ } }
    setCanUndo(histRef.current.length > 0);
    setSalvo(false);
  };

  /* ── abrir ── */
  const abrir = async (file) => {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const src = new Uint8Array(await file.arrayBuffer());
      const doc = await loadPdfDoc(src.slice());
      // abertura rápida: só as dimensões de cada página (nada é rasterizado
      // aqui — as miniaturas são desenhadas conforme aparecem na tela)
      const dims = await readPageSizes(doc);
      const pgs = dims.map((d, i) => ({ id: uid(), ref: i, w: d.w, h: d.h }));
      limparThumbs(poolRef.current);
      srcRef.current = src;
      poolRef.current = novoPoolId();
      setPoolId(poolRef.current);
      setPdf(doc); setPages(pgs); setOrigPages(pgs); setFileName(file.name);
      histRef.current = []; setCanUndo(false);
      setPreviewIdx(null); setSalvo(false);
    } catch (e) {
      setError('Não foi possível abrir o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── adicionar outro PDF (páginas entram no fim) ── */
  const adicionar = async (file) => {
    if (!file) return;
    if (!srcRef.current) { abrir(file); return; }
    setError(''); setBusy(true);
    try {
      const A = await PDFDocument.load(srcRef.current.slice(), { ignoreEncryption: true });
      const B = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true });
      const antes = A.getPageCount();
      const copiadas = await A.copyPages(B, B.getPageIndices());
      copiadas.forEach(pg => A.addPage(pg));
      const merged = new Uint8Array(await A.save());
      const doc = await loadPdfDoc(merged.slice());
      // as novas vão pro FIM do documento de origem, então os `ref` que já
      // existiam continuam válidos: a ordem montada até aqui não se mexe
      const dims = await readPageSizes(doc, antes);
      const novas = dims.map((d, i) => ({ id: uid(), ref: antes + i, w: d.w, h: d.h }));
      srcRef.current = merged;
      pushHistory();
      setPdf(doc);
      setPages(p => [...p, ...novas]);
      setOrigPages(o => [...o, ...novas]);
      setSalvo(false);
    } catch (e) {
      setError('Não foi possível adicionar o PDF: ' + (e?.message || 'erro'));
    } finally { setBusy(false); }
  };

  /* ── mover / excluir / restaurar ── */
  const mover = useCallback((ids, destino) => {
    const atual = pagesRef.current;
    const novo = reordenarPaginas(atual, ids, destino);
    if (novo === atual) return;
    pushHistory();
    setPages(novo); setSalvo(false);
  }, [pushHistory]);

  const excluir = useCallback((ids) => {
    const alvo = new Set(Array.isArray(ids) ? ids : [ids]);
    if (!alvo.size) return;
    const atual = pagesRef.current;
    const restante = atual.filter(p => !alvo.has(p.id));
    if (!restante.length) { setError('O documento precisa ficar com pelo menos uma página.'); return; }
    setError('');
    pushHistory();
    setPages(restante);
    setPreviewIdx(pi => (pi == null ? pi : clamp(pi, 0, restante.length - 1)));
    setSalvo(false);
  }, [pushHistory]);

  const restaurar = useCallback(() => {
    if (!origPages.length) return;
    pushHistory();
    setPages(origPages); setSalvo(false);
  }, [pushHistory, origPages]);

  const ordemMudou = pages.length !== origPages.length
    || pages.some((p, i) => p.id !== origPages[i]?.id);

  const fechar = () => {
    if (!srcRef.current) return;
    if (!window.confirm('Fechar o documento? A organização feita será perdida.')) return;
    limparThumbs(poolRef.current);
    srcRef.current = null;
    orgCache.src = null; orgCache.pages = null; orgCache.origPages = null; orgCache.fileName = '';
    setPdf(null); setPages([]); setOrigPages([]); setFileName('');
    histRef.current = []; setCanUndo(false); setPreviewIdx(null); setSalvo(false); setError('');
  };

  /* ── salvar: aqui, sim, o PDF é remontado na ordem montada ── */
  const salvar = async () => {
    if (!srcRef.current || !pages.length) return;
    setBusy(true); setError('');
    try {
      const origem = await PDFDocument.load(srcRef.current.slice(), { ignoreEncryption: true });
      const ordem = pages.map(p => p.ref);
      const intacto = ordem.length === origem.getPageCount() && ordem.every((r, i) => r === i);
      let doc = origem;
      if (!intacto) {
        // documento novo com as páginas copiadas na ordem escolhida
        doc = await PDFDocument.create();
        const copiadas = await doc.copyPages(origem, ordem);
        copiadas.forEach(pg => doc.addPage(pg));
      }
      const out = await doc.save();
      const url = URL.createObjectURL(new Blob([out], { type:'application/pdf' }));
      const el = document.createElement('a');
      el.href = url; el.download = (fileName.replace(/\.pdf$/i,'') || 'documento') + '_organizado.pdf';
      document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
      setSalvo(true);
    } catch (e) {
      setError('Erro ao salvar: ' + (e?.message || 'desconhecido'));
    } finally { setBusy(false); }
  };

  /* ── sem arquivo ── */
  if (!pdf) {
    return (
      <div style={{maxWidth:560}}>
        <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:24}}>
          Carregue um PDF para reorganizar as páginas — arraste pra mudar a ordem, exclua o que não precisa e amplie qualquer página pra conferir antes de salvar.
        </p>
        <input ref={fileInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{ abrir(e.target.files[0]); e.target.value=''; }}/>
        <div onClick={()=>fileInput.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); abrir(e.dataTransfer.files[0]);}}
          style={{border:`2px dashed ${T.border}`,borderRadius:14,padding:'48px 32px',textAlign:'center',cursor:'pointer',background:T.surface}}>
          {busy ? <div style={{color:T.textS}}>Abrindo...</div> : (
            <>
              <div style={{fontSize:34,marginBottom:10}}>🗂️</div>
              <div style={{fontSize:15,fontWeight:500,color:T.text,marginBottom:6}}>Solte o PDF aqui ou clique para selecionar</div>
              <div style={{fontSize:13,color:T.textT}}>Formato aceito: <strong style={{color:T.textS}}>.pdf</strong></div>
            </>
          )}
        </div>
        {error && <div style={{marginTop:16,padding:'12px 16px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>{error}</div>}
      </div>
    );
  }

  /* ── organizando ── */
  const tbBtn = (extra) => ({
    display:'inline-flex',alignItems:'center',gap:7,padding:'8px 13px',borderRadius:9,
    border:`1px solid ${T.border}`,background:'transparent',color:T.textS,fontSize:13,fontWeight:500,
    cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .14s',whiteSpace:'nowrap',...extra,
  });

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {/* Toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:'10px 12px',marginBottom:14,position:'sticky',top:0,zIndex:50}}>
        <button style={tbBtn()} onClick={()=>fileInput.current?.click()} disabled={busy}>
          <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></I> Abrir PDF
        </button>
        <input ref={fileInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{ abrir(e.target.files[0]); e.target.value=''; }}/>
        <button style={tbBtn()} onClick={()=>addInput.current?.click()} disabled={busy}>
          <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></I> Adicionar PDF
        </button>
        <input ref={addInput} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{ adicionar(e.target.files[0]); e.target.value=''; }}/>
        <button style={tbBtn({background:T.gold,color:'#fff',border:'none',fontWeight:700})} onClick={salvar} disabled={busy}>
          <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>
          {busy ? 'Salvando...' : 'Salvar como...'}
        </button>
        <div style={{width:1,height:22,background:T.divider,margin:'0 2px'}}/>
        <button style={tbBtn()} onClick={undo} disabled={!canUndo}>
          <I><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></I> Desfazer
        </button>
        <button style={tbBtn({color:T.danger,borderColor:`${T.danger}55`})} onClick={fechar} disabled={busy}>
          <I><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></I> Fechar documento
        </button>
        <div style={{flex:1}}/>
        {salvo && (
          <div style={{display:'flex',alignItems:'center',gap:7,color:'#1A9C70',fontSize:13,fontWeight:600}}>
            <I size={15}><polyline points="20 6 9 17 4 12"/></I> PDF baixado!
          </div>
        )}
        <div style={{fontSize:12,color:T.textD,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fileName}</div>
      </div>

      {error && <div style={{marginBottom:12,padding:'10px 14px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>{error}</div>}

      <PageOrganizer
        pdf={pdf} poolId={poolId} pages={pages} busy={busy}
        onMove={mover} onDelete={excluir}
        onRestore={restaurar} podeRestaurar={ordemMudou}
        onPreview={setPreviewIdx}/>

      {previewIdx != null && (
        <PagePreviewModal pdf={pdf} pages={pages} idx={clamp(previewIdx,0,pages.length-1)}
          onIdx={setPreviewIdx} onClose={()=>setPreviewIdx(null)}/>
      )}
    </div>
  );
};
