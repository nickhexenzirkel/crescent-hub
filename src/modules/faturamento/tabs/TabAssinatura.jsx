import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import rubricaUrl from '../../../assets/assinatura-evando.png';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ─── Ícone inline ─── */
const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

const btnPrimary = {
  display:'inline-flex',alignItems:'center',gap:8,
  background:T.gold,color:'#fff',border:'none',
  borderRadius:10,padding:'12px 26px',fontSize:14.5,fontWeight:600,
  cursor:'pointer',fontFamily:'var(--font-body)',
  boxShadow:`0 2px 10px ${T.gold}44`,transition:'opacity .14s',
};

/* ════════════════════════════════════════════════════════════════
   ÂNCORA E POSIÇÃO DA RÚBRICA
   A assinatura entra sempre na linha logo ACIMA do nome da empresa
   "7SERV GESTÃO DE BENEFICIOS LTDA / 13858769000197" (bloco do
   "Responsável pela Ordem de Compra/Serviço"). Como esse bloco muda
   de altura conforme o documento, a posição é detectada pelo texto
   via pdf.js — não é coordenada fixa.
════════════════════════════════════════════════════════════════ */
const ANCHOR = {
  nameRegex: /7SERV\s+GEST/i,   // nome da empresa (linha abaixo da assinatura)
  cnpjDigits: '13858769000197', // fallback caso o nome não seja encontrado
};
const SIG = {
  width: 150,        // largura da rúbrica em pontos PDF
  gapAboveName: 2,   // folga entre o topo do nome e a base da rúbrica
};

/* Localiza a âncora (ocorrência mais baixa) percorrendo as páginas.
   Retorna { pageIndex, x, y, w, h } em coordenadas PDF (origem inferior-esquerda). */
const findAnchor = async (bytes) => {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  let best = null;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const isName = ANCHOR.nameRegex.test(it.str);
      const isCnpj = it.str.replace(/\D/g, '').includes(ANCHOR.cnpjDigits);
      if (!isName && !isCnpj) continue;
      const [,,,, e, f] = it.transform;
      const cand = { pageIndex: p - 1, x: e, y: f, w: it.width, h: it.height, isName };
      // prioriza o NOME; entre iguais, a ocorrência mais baixa na página (menor y)
      if (!best
        || (cand.isName && !best.isName)
        || (cand.isName === best.isName && f < best.y)) {
        best = cand;
      }
    }
  }
  await doc.destroy();
  return best;
};

/* ─── DropZone para o PDF ─── */
const PdfDropZone = ({ onFile, file }) => {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const handle = useCallback((files) => {
    const pdf = [...files].find(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdf) onFile(pdf);
  }, [onFile]);
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle([...e.dataTransfer.files]); }}
      style={{
        border:`2px dashed ${drag || file ? T.gold : T.border}`,
        borderRadius:14,padding:'40px 32px',textAlign:'center',cursor:'pointer',
        background: drag || file ? T.goldGl : T.surface, transition:'all .18s',
      }}
    >
      <input ref={ref} type="file" accept=".pdf" style={{display:'none'}}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value=''; }}/>
      {file ? (
        <>
          <div style={{fontSize:32,marginBottom:8}}>📄</div>
          <div style={{fontSize:15,fontWeight:600,color:T.text}}>{file.name}</div>
          <div style={{fontSize:12.5,color:T.textD,marginTop:4}}>
            {(file.size/1024).toFixed(1)} KB · clique ou arraste outro para trocar
          </div>
        </>
      ) : (
        <>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke={drag ? T.gold : T.textD} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            style={{marginBottom:12}}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          <div style={{fontSize:15,fontWeight:500,color:T.text,marginBottom:6}}>
            Solte o PDF aqui ou clique para selecionar
          </div>
          <div style={{fontSize:13,color:T.textT}}>
            Formato aceito: <strong style={{color:T.textS}}>.pdf</strong>
          </div>
        </>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   ASSINATURA AUTOMÁTICA
   O usuário solta o PDF → o sistema localiza a linha acima do nome
   da empresa e aplica a rúbrica → devolve o PDF assinado.
════════════════════════════════════════════════════════════════ */
export const TabAssinatura = () => {
  const [pdf, setPdf]   = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone]   = useState('');

  const assinar = async () => {
    setError(''); setDone('');
    if (!pdf) { setError('Selecione um arquivo PDF para assinar.'); return; }

    setBusy(true);
    try {
      const buf = await pdf.arrayBuffer();
      // pdf.js consome o buffer no worker — usa uma cópia para cada lib
      const anchor = await findAnchor(new Uint8Array(buf.slice(0)));
      if (!anchor) {
        setError('Não encontrei o local da assinatura neste PDF (linha do nome "7SERV GESTÃO DE BENEFICIOS LTDA"). Confira se é o documento correto.');
        setBusy(false);
        return;
      }

      const pdfDoc  = await PDFDocument.load(buf);
      const sigBytes = await fetch(rubricaUrl).then(r => r.arrayBuffer());
      const sigImg  = await pdfDoc.embedPng(sigBytes);

      const sigW = SIG.width;
      const sigH = sigW * (sigImg.height / sigImg.width);

      const page = pdfDoc.getPages()[anchor.pageIndex];
      const centerX = anchor.x + anchor.w / 2;
      page.drawImage(sigImg, {
        x: centerX - sigW / 2,
        y: anchor.y + anchor.h + SIG.gapAboveName, // logo acima do nome
        width: sigW,
        height: sigH,
      });

      const out  = await pdfDoc.save();
      const blob = new Blob([out], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = pdf.name.replace(/\.pdf$/i, '') + '_assinado.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone('PDF assinado e baixado com sucesso.');
    } catch (e) {
      setError('Não foi possível assinar o PDF: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      <StellarHero
        compact
        eyebrow="Documentos · PDF"
        title="Assinatura Automática"
        subtitle="Carregue um PDF e o sistema aplica a rúbrica automaticamente na linha da assinatura, devolvendo o documento assinado para download."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 19.5v.5a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h9"/>
            <polyline points="13 8 16 5 21 10 18 13"/><line x1="8" y1="17" x2="12" y2="17"/><line x1="8" y1="13" x2="10" y2="13"/>
          </svg>
        )}
      />

      <div style={{maxWidth:700}}>
        {/* Rúbrica usada */}
        <div style={{
          display:'flex',alignItems:'center',gap:16,
          background:T.surface,border:`1px solid ${T.border}`,
          borderRadius:13,padding:'16px 18px',marginBottom:24,
        }}>
          <div style={{
            width:150,height:46,borderRadius:9,flexShrink:0,
            border:`1px solid ${T.border}`,background:'#fff',
            display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
          }}>
            <img src={rubricaUrl} alt="Rúbrica" style={{maxWidth:'92%',maxHeight:'82%',objectFit:'contain'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>Rúbrica da assinatura</div>
            <div style={{fontSize:12.5,color:T.textT,marginTop:3}}>
              Esta assinatura é aplicada automaticamente na linha acima de <strong style={{color:T.textS}}>7SERV GESTÃO DE BENEFICIOS LTDA</strong>.
            </div>
          </div>
        </div>

        <StarDivider my={24}/>

        {/* Upload do PDF */}
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:14}}>
          Documento para assinar
        </div>
        <PdfDropZone file={pdf} onFile={(f) => { setPdf(f); setDone(''); setError(''); }}/>

        {error && (
          <div style={{marginTop:18,padding:'12px 16px',background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',borderRadius:10,fontSize:13.5,color:T.danger}}>
            {error}
          </div>
        )}
        {done && (
          <div style={{marginTop:18,padding:'12px 16px',background:'rgba(26,156,112,0.08)',border:'1px solid rgba(26,156,112,0.25)',borderRadius:10,fontSize:13.5,color:'#1A9C70'}}>
            ✓ {done}
          </div>
        )}

        <StarDivider my={24}/>

        <button
          onClick={assinar}
          disabled={busy || !pdf}
          style={{
            ...btnPrimary,
            background: (busy || !pdf) ? 'transparent' : T.gold,
            color:      (busy || !pdf) ? T.textD : '#fff',
            boxShadow:  (busy || !pdf) ? 'none' : btnPrimary.boxShadow,
            border:     (busy || !pdf) ? `1px solid ${T.border}` : 'none',
            cursor:     (busy || !pdf) ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e=>{ if(!(busy||!pdf)) e.currentTarget.style.opacity='.85'; }}
          onMouseLeave={e=>{ e.currentTarget.style.opacity='1'; }}>
          {busy ? (
            <>
              <div style={{width:15,height:15,borderRadius:'50%',border:'2px solid currentColor',borderTopColor:'transparent',animation:'spin .7s linear infinite'}}/>
              Assinando...
            </>
          ) : (
            <>
              <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I>
              Assinar e Baixar PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
};
