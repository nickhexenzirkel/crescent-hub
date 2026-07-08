import { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { T } from '../../contexts/theme';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ══════════════════════════════════════════════════════════════════
   MESCLAR PDF — organiza as páginas de vários PDFs (arrastar pra
   reordenar, estilo iLovePDF) e junta tudo num único arquivo baixado.
   Usa pdf-lib (já uma dependência do PdfEditor) pra copiar as páginas
   na ordem final, e pdfjs-dist só pra gerar as miniaturas.
══════════════════════════════════════════════════════════════════ */

const uid = () => Math.random().toString(36).slice(2, 10);
const THUMB_SCALE = 0.35;

async function renderThumb(page) {
  const vp = page.getViewport({ scale: THUMB_SCALE });
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.floor(vp.width));
  cv.height = Math.max(1, Math.floor(vp.height));
  const ctx = cv.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return cv.toDataURL('image/jpeg', 0.72);
}

const DropZone = ({ onFiles, small }) => {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const handle = useCallback((files) => {
    const pdfs = [...files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length) onFiles(pdfs);
  }, [onFiles]);
  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle([...e.dataTransfer.files]); }}
      style={{
        border: `2px dashed ${drag ? T.gold : T.border}`,
        borderRadius: 14, padding: small ? '18px 20px' : '40px 32px', textAlign: 'center', cursor: 'pointer',
        background: drag ? T.goldGl : T.surface, transition: 'all .18s',
      }}>
      <svg width={small ? 24 : 40} height={small ? 24 : 40} viewBox="0 0 24 24" fill="none"
        stroke={drag ? T.gold : T.textD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ marginBottom: small ? 6 : 12 }}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <div style={{ fontSize: small ? 13 : 15, fontWeight: 500, color: T.text, marginBottom: small ? 2 : 6 }}>
        {small ? 'Adicionar mais PDFs' : 'Solte os PDFs aqui ou clique para selecionar'}
      </div>
      {!small && (
        <div style={{ fontSize: 13, color: T.textT }}>
          Pode soltar vários de uma vez — as páginas de todos entram na lista, na ordem que você quiser
        </div>
      )}
      <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={e => { if (e.target.files.length) handle([...e.target.files]); e.target.value = ''; }} />
    </div>
  );
};

export const PdfMerge = () => {
  const [pages, setPages] = useState([]); // {id, fileId, fileName, pageIndex, thumb}
  const docsRef = useRef({}); // fileId -> PDFDocument (pdf-lib), usado só na hora de mesclar
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const dragIndexRef = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const addFiles = async (files) => {
    setLoading(true); setError('');
    try {
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const fileId = uid();
        docsRef.current[fileId] = await PDFDocument.load(bytes.slice());
        const jsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        const newPages = [];
        for (let i = 1; i <= jsDoc.numPages; i++) {
          const page = await jsDoc.getPage(i);
          const thumb = await renderThumb(page);
          newPages.push({ id: uid(), fileId, fileName: file.name, pageIndex: i - 1, thumb });
        }
        setPages(prev => [...prev, ...newPages]);
      }
    } catch (e) {
      setError('Não consegui ler um dos PDFs: ' + (e?.message || 'erro desconhecido'));
    }
    setLoading(false);
  };

  const removePage = (id) => setPages(prev => prev.filter(p => p.id !== id));
  const clearAll = () => { setPages([]); docsRef.current = {}; setError(''); };

  const onDropPage = (i) => (e) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    setOverIndex(null);
    if (from == null || from === i) return;
    setPages(prev => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
  };

  const downloadMerged = async () => {
    if (!pages.length) return;
    setMerging(true); setError('');
    try {
      const out = await PDFDocument.create();
      for (const p of pages) {
        const src = docsRef.current[p.fileId];
        const [copied] = await out.copyPages(src, [p.pageIndex]);
        out.addPage(copied);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdf-mesclado_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Erro ao mesclar: ' + (e?.message || 'erro desconhecido'));
    }
    setMerging(false);
  };

  const fileCount = new Set(pages.map(p => p.fileId)).size;

  return (
    <div>
      {pages.length === 0 ? (
        <DropZone onFiles={addFiles} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 14px', background: T.goldGl, border: `1px solid ${T.gold}22`, borderRadius: 10, fontSize: 13, color: T.textS }}>
              <strong style={{ color: T.text }}>{pages.length}</strong> página{pages.length !== 1 ? 's' : ''}
              <span style={{ color: T.textT, marginLeft: 6 }}>· {fileCount} arquivo{fileCount !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={clearAll}
              style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Limpar
            </button>
            <button onClick={downloadMerged} disabled={merging}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 10, border: 'none',
                background: T.gold, color: '#fff', fontSize: 14, fontWeight: 600, cursor: merging ? 'wait' : 'pointer', fontFamily: 'var(--font-body)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {merging ? 'Mesclando...' : 'Baixar PDF mesclado'}
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <DropZone onFiles={addFiles} small />
          </div>

          <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10 }}>
            Arraste as páginas pra reordenar. Clique no ✕ pra remover uma página.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 14 }}>
            {pages.map((p, i) => (
              <div key={p.id}
                draggable
                onDragStart={() => { dragIndexRef.current = i; }}
                onDragOver={e => { e.preventDefault(); setOverIndex(i); }}
                onDragLeave={() => setOverIndex(o => (o === i ? null : o))}
                onDrop={onDropPage(i)}
                onDragEnd={() => { dragIndexRef.current = null; setOverIndex(null); }}
                style={{
                  position: 'relative', cursor: 'grab', borderRadius: 10, overflow: 'hidden',
                  border: overIndex === i ? `2px solid ${T.gold}` : `1px solid ${T.border}`,
                  background: T.surface, boxShadow: T.sh, transition: 'border-color .12s',
                }}>
                <img src={p.thumb} alt={`Página ${i + 1}`} style={{ width: '100%', display: 'block' }} />
                <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>
                  {i + 1}
                </div>
                <button onClick={() => removePage(p.id)} title="Remover página"
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
                <div style={{ padding: '5px 8px', fontSize: 10.5, color: T.textT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.fileName}>
                  {p.fileName}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: T.goldGl, borderRadius: 10, marginTop: 16, fontSize: 14, color: T.textS }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${T.gold}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }} />
          Processando PDF...
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(192,64,80,0.06)', border: '1px solid rgba(192,64,80,0.2)', borderRadius: 10, padding: '12px 16px', marginTop: 16, fontSize: 13, color: T.danger }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default PdfMerge;
