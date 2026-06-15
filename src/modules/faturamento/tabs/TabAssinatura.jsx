import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';

/* ─── Ícone inline ─── */
const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

/* Rúbrica salva (base64 da imagem) no localStorage */
const RUBRICA_KEY = 'faturamento_rubrica';

const loadRubrica = () => {
  try { return localStorage.getItem(RUBRICA_KEY) || ''; }
  catch { return ''; }
};
const saveRubrica = (dataUrl) => {
  try { localStorage.setItem(RUBRICA_KEY, dataUrl); } catch { /* ignora */ }
};

const fileToDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

const btnPrimary = {
  display:'inline-flex',alignItems:'center',gap:8,
  background:T.gold,color:'#fff',border:'none',
  borderRadius:10,padding:'12px 26px',fontSize:14.5,fontWeight:600,
  cursor:'pointer',fontFamily:'var(--font-body)',
  boxShadow:`0 2px 10px ${T.gold}44`,transition:'opacity .14s',
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
   Fluxo do usuário: solta o PDF → o sistema aplica a rúbrica já salva
   → devolve o PDF assinado para download. Só isso.

   ⚠️ A POSIÇÃO da assinatura no documento ainda é provisória (canto
   inferior direito da última página). O Nicolas vai indicar depois
   exatamente onde a rúbrica deve entrar — ajustar em SIG_POS / drawImage.
════════════════════════════════════════════════════════════════ */

// Posição provisória da assinatura (ajustar depois)
const SIG_POS = {
  width: 150,           // largura da rúbrica em pontos PDF
  marginRight: 60,      // distância da borda direita
  marginBottom: 70,     // distância da borda inferior
  lastPageOnly: true,   // assina só a última página
};

export const TabAssinatura = () => {
  const [pdf, setPdf]           = useState(null);
  const [rubrica, setRubrica]   = useState(loadRubrica);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState('');
  const [showConfig, setShowConfig] = useState(() => !loadRubrica());
  const rubricaInputRef = useRef();

  const handleRubricaFile = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setError('A rúbrica precisa ser uma imagem PNG ou JPG (de preferência PNG com fundo transparente).');
      return;
    }
    setError('');
    const dataUrl = await fileToDataURL(file);
    setRubrica(dataUrl);
    saveRubrica(dataUrl);
    setShowConfig(false);
  };

  const clearRubrica = () => {
    setRubrica('');
    saveRubrica('');
    setShowConfig(true);
  };

  const assinar = async () => {
    setError(''); setDone('');
    if (!rubrica) { setError('Nenhuma rúbrica salva. Configure a assinatura primeiro.'); return; }
    if (!pdf)     { setError('Selecione um arquivo PDF para assinar.'); return; }

    setBusy(true);
    try {
      const pdfBytes = await pdf.arrayBuffer();
      const pdfDoc   = await PDFDocument.load(pdfBytes);

      // embute a imagem da rúbrica (PNG ou JPG)
      const isPng = rubrica.startsWith('data:image/png');
      const imgBytes = Uint8Array.from(atob(rubrica.split(',')[1]), c => c.charCodeAt(0));
      const sigImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

      const sigW = SIG_POS.width;
      const sigH = sigW * (sigImg.height / sigImg.width);

      const pages  = pdfDoc.getPages();
      const targets = SIG_POS.lastPageOnly ? [pages[pages.length - 1]] : pages;
      for (const page of targets) {
        const { width } = page.getSize();
        page.drawImage(sigImg, {
          x: width - sigW - SIG_POS.marginRight,
          y: SIG_POS.marginBottom,
          width: sigW,
          height: sigH,
        });
      }

      const out = await pdfDoc.save();
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
        subtitle="Carregue um PDF e o sistema aplica a sua rúbrica salva automaticamente, devolvendo o documento assinado para download."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 19.5v.5a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h9"/>
            <polyline points="13 8 16 5 21 10 18 13"/><line x1="8" y1="17" x2="12" y2="17"/><line x1="8" y1="13" x2="10" y2="13"/>
          </svg>
        )}
      />

      <div style={{maxWidth:700}}>
        {/* Rúbrica salva */}
        <div style={{
          display:'flex',alignItems:'center',gap:16,
          background:T.surface,border:`1px solid ${T.border}`,
          borderRadius:13,padding:'16px 18px',marginBottom:24,
        }}>
          <div style={{
            width:120,height:60,borderRadius:9,flexShrink:0,
            border:`1px solid ${T.border}`,background:'#fff',
            display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
          }}>
            {rubrica
              ? <img src={rubrica} alt="Rúbrica" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
              : <span style={{fontSize:11.5,color:T.textD}}>sem rúbrica</span>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:T.text}}>
              {rubrica ? 'Rúbrica salva' : 'Nenhuma rúbrica salva'}
            </div>
            <div style={{fontSize:12.5,color:T.textT,marginTop:3}}>
              {rubrica
                ? 'Esta assinatura será aplicada automaticamente nos PDFs.'
                : 'Configure uma imagem de assinatura para começar.'}
            </div>
          </div>
          <button
            onClick={() => setShowConfig(s => !s)}
            style={{
              background:'none',border:`1px solid ${T.border}`,borderRadius:8,
              padding:'8px 14px',fontSize:13,color:T.textS,cursor:'pointer',
              fontFamily:'var(--font-body)',transition:'background .14s',whiteSpace:'nowrap',
            }}
            onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
          >
            {rubrica ? 'Alterar' : 'Configurar'}
          </button>
        </div>

        {/* Painel de configuração da rúbrica */}
        {showConfig && (
          <div style={{
            background:T.surfaceSub||'rgba(0,0,0,0.02)',border:`1px solid ${T.border}`,
            borderRadius:13,padding:'18px 20px',marginBottom:24,
          }}>
            <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:12}}>
              Configurar rúbrica
            </div>
            <input ref={rubricaInputRef} type="file" accept="image/png,image/jpeg" style={{display:'none'}}
              onChange={e => handleRubricaFile(e.target.files[0])}/>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <button
                onClick={() => rubricaInputRef.current?.click()}
                style={{...btnPrimary,padding:'9px 18px',fontSize:13.5}}
                onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></I>
                Enviar imagem da rúbrica
              </button>
              {rubrica && (
                <button onClick={clearRubrica}
                  style={{background:'none',border:`1px solid ${T.border}`,borderRadius:8,padding:'9px 14px',fontSize:13,color:T.danger,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                  Remover rúbrica
                </button>
              )}
            </div>
            <div style={{fontSize:11.5,color:T.textD,marginTop:10}}>
              Use uma imagem <strong style={{color:T.textS}}>PNG com fundo transparente</strong> para um resultado limpo. A rúbrica fica salva neste navegador.
            </div>
          </div>
        )}

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
          disabled={busy || !pdf || !rubrica}
          style={{
            ...btnPrimary,
            background: (busy || !pdf || !rubrica) ? 'transparent' : T.gold,
            color:      (busy || !pdf || !rubrica) ? T.textD : '#fff',
            boxShadow:  (busy || !pdf || !rubrica) ? 'none' : btnPrimary.boxShadow,
            border:     (busy || !pdf || !rubrica) ? `1px solid ${T.border}` : 'none',
            cursor:     (busy || !pdf || !rubrica) ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e=>{ if(!(busy||!pdf||!rubrica)) e.currentTarget.style.opacity='.85'; }}
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
