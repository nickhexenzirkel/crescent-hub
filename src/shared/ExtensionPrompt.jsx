import React, { useState, useEffect } from 'react';
import { checkExtension } from '../utils/checkExtension';

/**
 * Banner "Ação necessária" que aparece ao abrir o site quando a extensão
 * Uniko Cat-Bot não está instalada (ou precisa recarregar). Oferece o download
 * do .zip e o passo a passo de instalação no navegador.
 */
const STEPS = [
  <>Baixe e <b>extraia</b> (descompacte) o arquivo <code>uniko-catbot.zip</code> — vai virar uma pasta <b>uniko-catbot</b>.</>,
  <>Abra <b>chrome://extensions</b> no navegador (no Edge use <b>edge://extensions</b>).</>,
  <>Ative o <b>Modo do desenvolvedor</b> (interruptor no canto superior direito).</>,
  <>Clique em <b>Carregar sem compactação</b> (“Load unpacked”).</>,
  <>Selecione a pasta <b>uniko-catbot</b> que você extraiu.</>,
  <>Volte aqui e clique em <b>Já instalei</b> (ou aperte F5). Pronto! 🐱</>,
];

export const ExtensionPrompt = () => {
  const [status, setStatus]   = useState('checking'); // checking | ok | missing | reload
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen]       = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const run = async () => {
    setRechecking(true);
    const r = await checkExtension();
    setStatus(r === true ? 'ok' : r === 'reload' ? 'reload' : 'missing');
    setRechecking(false);
  };

  useEffect(() => { run(); }, []);

  if (dismissed || status === 'checking' || status === 'ok') return null;

  const isReload = status === 'reload';
  const C = { warn:'#B25A00', warnBg:'#FFF7EC', warnBd:'rgba(178,90,0,0.3)', gold:'#C8960A' };

  return (
    <div style={{
      position:'fixed', top:14, left:'50%', transform:'translateX(-50%)',
      width:'min(720px, 94vw)', zIndex:9000, fontFamily:'var(--font-body)',
      background:C.warnBg, border:`1.5px solid ${C.warnBd}`, borderRadius:16,
      boxShadow:'0 12px 40px rgba(0,0,0,0.18)', overflow:'hidden',
    }}>
      {/* ── Linha principal ── */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px' }}>
        <div style={{ fontSize:24, lineHeight:1 }}>⚠️</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.warn, letterSpacing:'.01em' }}>
            Ação necessária — {isReload ? 'recarregue a extensão' : 'instale a extensão Uniko Cat-Bot'}
          </div>
          <div style={{ fontSize:12.5, color:'#7a5a2a', marginTop:2 }}>
            {isReload
              ? 'A extensão precisa ser reativada. Aperte F5 ou clique em “Já instalei”.'
              : 'Necessária para notificações no desktop e para o módulo Faturamento.'}
          </div>
        </div>
        {!isReload && (
          <a href="/uniko-catbot.zip" download="uniko-catbot.zip"
            style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:7, padding:'10px 16px',
              borderRadius:11, background:`linear-gradient(135deg, ${C.gold}, ${C.warn})`, color:'#fff',
              fontWeight:700, fontSize:13, textDecoration:'none', boxShadow:`0 3px 12px ${C.warn}44` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar extensão
          </a>
        )}
        <button onClick={() => setDismissed(true)} title="Fechar"
          style={{ flexShrink:0, width:30, height:30, borderRadius:8, border:'none', background:'transparent',
            cursor:'pointer', color:'#9a7a4a', fontSize:18, lineHeight:1 }}>✕</button>
      </div>

      {/* ── Toggle de instruções ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px 12px', flexWrap:'wrap' }}>
        {!isReload && (
          <button onClick={() => setOpen(o => !o)}
            style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9,
              border:`1px solid ${C.warnBd}`, background:'transparent', cursor:'pointer', color:C.warn, fontSize:12.5, fontWeight:600 }}>
            <span style={{ display:'inline-block', transform:open?'rotate(90deg)':'none', transition:'transform .15s' }}>▶</span>
            {open ? 'Ocultar passo a passo' : 'Como instalar (passo a passo)'}
          </button>
        )}
        <button onClick={run} disabled={rechecking}
          style={{ padding:'7px 12px', borderRadius:9, border:`1px solid ${C.warnBd}`, background:'#fff',
            cursor:rechecking?'wait':'pointer', color:C.warn, fontSize:12.5, fontWeight:700 }}>
          {rechecking ? 'Verificando…' : 'Já instalei / Verificar'}
        </button>
      </div>

      {/* ── Passo a passo ── */}
      {open && !isReload && (
        <div style={{ padding:'4px 18px 18px', borderTop:`1px dashed ${C.warnBd}` }}>
          <ol style={{ margin:'12px 0 0', paddingLeft:22, color:'#5a4424', fontSize:13, lineHeight:1.7 }}>
            {STEPS.map((s, i) => <li key={i} style={{ marginBottom:6 }}>{s}</li>)}
          </ol>
          <div style={{ marginTop:12, fontSize:11.5, color:'#9a7a4a', background:'#fff', border:`1px solid ${C.warnBd}`, borderRadius:9, padding:'8px 12px' }}>
            Funciona no <b>Chrome</b>, <b>Edge</b>, <b>Opera</b> e <b>Brave</b>. Mantenha a pasta extraída no computador — se você apagá-la, a extensão para de funcionar.
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtensionPrompt;
