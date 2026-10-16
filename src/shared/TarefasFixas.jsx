import React, { useState, useRef, useEffect } from 'react';
import { T } from '../contexts/theme';
import { useTarefasHoje, useTarefasFixadas } from './menuWidgets';

/* "Tarefas de hoje" fixa na tela, em qualquer módulo. Liga/desliga pelo alfinete
   do widget no menu (ou pelo X daqui). Arrasta pelo cabeçalho, redimensiona pelo
   canto inferior direito e minimiza pra uma bolinha com o contador. */
const COR = '#30B0C7';
const linha = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };

const CHAVE_GEO = 'uniko_tarefas_fixas_geo';
const LIM = { wMin:200, wMax:520, hMin:90 };
const lerGeo = () => {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE_GEO));
    if (g && isFinite(g.x) && isFinite(g.y) && isFinite(g.w) && isFinite(g.h)) return g;
  } catch {}
  return null;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Mantém o card dentro da janela (a tela pode ter ficado menor desde a última vez).
const ajustar = (g) => {
  const w = clamp(g.w, LIM.wMin, Math.max(LIM.wMin, Math.min(LIM.wMax, window.innerWidth - 8)));
  const h = clamp(g.h, LIM.hMin, Math.max(LIM.hMin, window.innerHeight - 8));
  return { w, h, x: clamp(g.x, 4, Math.max(4, window.innerWidth - w - 4)), y: clamp(g.y, 4, Math.max(4, window.innerHeight - h - 4)) };
};

export default function TarefasFixas({ authUser }) {
  const [fixada, alternar] = useTarefasFixadas();
  if (!fixada || !authUser?.name) return null;
  return <Painel authUser={authUser} desafixar={() => alternar(false)} />;
}

function Painel({ authUser, desafixar }) {
  const t = useTarefasHoje(authUser);
  const [min, setMin] = useState(() => { try { return localStorage.getItem('uniko_tarefas_fixas_min') === '1'; } catch { return false; } });
  const [geo, setGeo] = useState(() => ajustar(lerGeo() || { w:260, h:200, x:window.innerWidth - 274, y:window.innerHeight - 290 }));
  const geoRef = useRef(geo); geoRef.current = geo;
  const trocar = () => setMin((m) => { try { localStorage.setItem('uniko_tarefas_fixas_min', m ? '0' : '1'); } catch {} return !m; });
  const pend = t.itens.filter((x) => !x.feita);
  const n = pend.length;

  useEffect(() => {
    const re = () => setGeo((g) => ajustar(g));
    window.addEventListener('resize', re);
    return () => window.removeEventListener('resize', re);
  }, []);

  // Arrasta pelo cabeçalho (modo 'mover') ou pelo canto inferior direito (modo 'tamanho').
  const iniciar = (modo) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY, g0 = geoRef.current;
    const mexe = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      setGeo(ajustar(modo === 'mover' ? { ...g0, x:g0.x + dx, y:g0.y + dy } : { ...g0, w:g0.w + dx, h:g0.h + dy }));
    };
    const solta = () => {
      window.removeEventListener('pointermove', mexe); window.removeEventListener('pointerup', solta);
      try { localStorage.setItem(CHAVE_GEO, JSON.stringify(geoRef.current)); } catch {}
    };
    window.addEventListener('pointermove', mexe); window.addEventListener('pointerup', solta);
  };

  if (min) return (
    <button onClick={trocar} title="Abrir tarefas de hoje" style={{ position:'fixed', left:geo.x + geo.w - 64, top:geo.y, zIndex:9000, width:64, padding:'8px 0 6px', borderRadius:16, border:'none', cursor:'pointer',
      background:COR, color:'#fff', fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', gap:3, boxShadow:'0 6px 20px rgba(0,0,0,.25)' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><polyline points="9 13 11.2 15.2 15.2 10.8"/>
      </svg>
      <span style={{ fontSize:11, fontWeight:700, lineHeight:1 }}>Tarefas</span>
    </button>
  );
  return (
    <div style={{ position:'fixed', left:geo.x, top:geo.y, width:geo.w, height:geo.h, zIndex:9000, display:'flex', flexDirection:'column',
      borderRadius:16, padding:'10px 12px', boxSizing:'border-box', background:T.surface || '#fff', border:`1px solid ${T.border}`, boxShadow:'0 10px 30px rgba(0,0,0,.22)' }}>
      <div onPointerDown={iniciar('mover')} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, cursor:'grab', touchAction:'none', userSelect:'none' }}>
        <span style={{ width:8, height:8, borderRadius:4, background:COR, flexShrink:0 }}/>
        <span style={{ flex:1, fontSize:13, fontWeight:700, color:T.text, ...linha }}>
          Tarefas de hoje{!t.carregando && n > 0 ? ` · ${n}` : ''}
        </span>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={trocar} title="Minimizar" style={{ border:'none', background:'none', cursor:'pointer', color:T.textT, fontSize:16, lineHeight:1 }}>–</button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={desafixar} title="Desafixar" style={{ border:'none', background:'none', cursor:'pointer', color:T.textT, fontSize:14, lineHeight:1 }}>✕</button>
      </div>
      <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
        {t.carregando ? <div style={{ fontSize:12, color:T.textT }}>Carregando…</div>
          : !n ? <div style={{ fontSize:12, color:T.textS }}>{t.total ? 'Tudo feito hoje! 🎉' : 'Nada para hoje'}</div>
          : (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {pend.map((it) => (
                <div key={it.tipo + it.id} onClick={() => t.marcar(it)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:10, cursor:'pointer',
                    border:`1px solid ${T.border}`, background:T.surfaceSub || 'transparent' }}>
                  <span style={{ width:14, height:14, borderRadius:4, flexShrink:0, border:`2px solid ${COR}` }}/>
                  <span style={{ fontSize:12, color:T.text, fontWeight:600, ...linha }}>{it.titulo}</span>
                </div>
              ))}
            </div>
          )}
      </div>
      <div onPointerDown={iniciar('tamanho')} title="Arraste para redimensionar"
        style={{ position:'absolute', right:2, bottom:2, width:18, height:18, cursor:'nwse-resize', touchAction:'none',
          background:`linear-gradient(135deg, transparent 55%, ${T.textT || '#999'} 55%, ${T.textT || '#999'} 62%, transparent 62%, transparent 75%, ${T.textT || '#999'} 75%, ${T.textT || '#999'} 82%, transparent 82%)` }}/>
    </div>
  );
}
