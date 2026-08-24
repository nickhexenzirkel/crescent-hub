import { useState, useCallback, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { T } from '../../contexts/theme';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ══════════════════════════════════════════════════════════════════
   MESCLAR PDF — cada PDF inteiro vira UM cartão (mostrando só a 1ª
   página como capa, estilo iLovePDF), não um cartão por página. Arrasta
   os cartões pra reordenar os ARQUIVOS; cada um entra no resultado final
   com todas as suas páginas, na ordem interna original. Usa pdf-lib (já
   dependência do PdfEditor) pra copiar as páginas, e pdfjs-dist só pra
   gerar a miniatura da capa.
══════════════════════════════════════════════════════════════════ */

const uid = () => Math.random().toString(36).slice(2, 10);
const THUMB_SCALE = 0.5;

async function renderThumb(page) {
  const vp = page.getViewport({ scale: THUMB_SCALE });
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.floor(vp.width));
  cv.height = Math.max(1, Math.floor(vp.height));
  const ctx = cv.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return cv.toDataURL('image/jpeg', 0.78);
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
          Pode soltar vários de uma vez — cada um vira um cartão, na ordem que você quiser
        </div>
      )}
      <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={e => { if (e.target.files.length) handle([...e.target.files]); e.target.value = ''; }} />
    </div>
  );
};

export const PdfMerge = () => {
  const [files, setFiles] = useState([]); // {id, name, pageCount, thumb}
  const docsRef = useRef({}); // fileId -> PDFDocument (pdf-lib), usado só na hora de mesclar
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const dragIndexRef = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const addFiles = async (newFiles) => {
    setLoading(true); setError('');
    try {
      // Em PARALELO (era um `for await`, que lia um arquivo por vez e fazia
      // parecer travado ao soltar vários de uma vez). `Promise.all` preserva a
      // ordem do array, então a lista sai na ordem em que a pessoa escolheu —
      // o append em série de antes também dependia disso.
      const lidos = await Promise.all(Array.from(newFiles).map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const fileId = uid();
        const libDoc = await PDFDocument.load(bytes.slice());
        const jsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        try {
          const thumb = await renderThumb(await jsDoc.getPage(1));
          return { doc: libDoc, entry: { id: fileId, name: file.name, pageCount: libDoc.getPageCount(), thumb } };
        } finally {
          // A miniatura já foi gerada — o documento do pdf.js seria só peso
          // parado na memória (um PDF grande custa dezenas de MB). Sem isso,
          // juntar muitos arquivos ia enchendo a memória e engasgando tudo.
          try { await jsDoc.destroy(); } catch { /* já liberado */ }
        }
      }));
      for (const { doc, entry } of lidos) docsRef.current[entry.id] = doc;
      setFiles(prev => [...prev, ...lidos.map(l => l.entry)]);   // um setState só, não um por arquivo
    } catch (e) {
      setError('Não consegui ler um dos PDFs: ' + (e?.message || 'erro desconhecido'));
    }
    setLoading(false);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    delete docsRef.current[id];
  };
  const clearAll = () => { setFiles([]); docsRef.current = {}; setError(''); };

  const onDropCard = (i) => (e) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    setOverIndex(null);
    if (from == null || from === i) return;
    setFiles(prev => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
  };

  const downloadMerged = async () => {
    if (!files.length) return;
    setMerging(true); setError('');
    try {
      const out = await PDFDocument.create();
      for (const f of files) {
        const src = docsRef.current[f.id];
        const copiedPages = await out.copyPages(src, src.getPageIndices());
        copiedPages.forEach(p => out.addPage(p));
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

  const totalPages = files.reduce((s, f) => s + f.pageCount, 0);

  return (
    <div>
      {files.length === 0 ? (
        <DropZone onFiles={addFiles} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 14px', background: T.goldGl, border: `1px solid ${T.gold}22`, borderRadius: 10, fontSize: 13, color: T.textS }}>
              <strong style={{ color: T.text }}>{files.length}</strong> PDF{files.length !== 1 ? 's' : ''}
              <span style={{ color: T.textT, marginLeft: 6 }}>· {totalPages} página{totalPages !== 1 ? 's' : ''} no total</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={clearAll}
              style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Limpar
            </button>
            <button onClick={downloadMerged} disabled={merging || files.length < 2}
              title={files.length < 2 ? 'Adicione pelo menos 2 PDFs pra mesclar' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 10, border: 'none',
                background: T.gold, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: merging ? 'wait' : files.length < 2 ? 'not-allowed' : 'pointer',
                opacity: files.length < 2 ? 0.5 : 1, fontFamily: 'var(--font-body)' }}>
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
            Arraste os cartões pra reordenar os PDFs. Cada um entra inteiro (todas as páginas) na ordem mostrada. Clique no ✕ pra remover um PDF.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 14 }}>
            {files.map((f, i) => (
              <div key={f.id}
                draggable
                onDragStart={() => { dragIndexRef.current = i; }}
                onDragOver={e => { e.preventDefault(); setOverIndex(i); }}
                onDragLeave={() => setOverIndex(o => (o === i ? null : o))}
                onDrop={onDropCard(i)}
                onDragEnd={() => { dragIndexRef.current = null; setOverIndex(null); }}
                style={{
                  position: 'relative', cursor: 'grab', borderRadius: 10, overflow: 'hidden',
                  border: overIndex === i ? `2px solid ${T.gold}` : `1px solid ${T.border}`,
                  background: T.surface, boxShadow: T.sh, transition: 'border-color .12s',
                }}>
                <img src={f.thumb} alt={f.name} style={{ width: '100%', display: 'block' }} />
                <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>
                  {i + 1}
                </div>
                <div style={{ position: 'absolute', bottom: 30, right: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 6 }}>
                  {f.pageCount} pág.
                </div>
                <button onClick={() => removeFile(f.id)} title="Remover PDF"
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
                <div style={{ padding: '5px 8px', fontSize: 10.5, color: T.textT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>
                  {f.name}
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
