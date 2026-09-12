import React from 'react';
import { T } from '../contexts/theme';

/* ══════════════════════════════════════════════════════════════════════════
   LAYOUT NOVO DO MENU DE MÓDULOS — o palco alternativo à órbita

   ESTE ARQUIVO É UM RASCUNHO DE PROPÓSITO. O desenho de verdade ainda vai ser
   descrito; até lá isto é só um palco que funciona (clicar abre o módulo) pra
   o interruptor do Dashboard RH ter os dois lados pra comparar.

   Quem manda no que aparece aqui continua sendo o ModuleSelector: a lista de
   módulos já chega ordenada, com os atalhos do Portal misturados e com a cor
   escolhida pela pessoa. Este componente só DESENHA — nada de estado, nada de
   localStorage. É assim que a órbita e o layout novo dividem as mesmas
   preferências sem duplicar uma linha.
══════════════════════════════════════════════════════════════════════════ */
const MenuLayoutNovo = ({ mods, onSelect, getModuleColor }) => {
  const [hov, setHov] = React.useState(null);

  return (
    <div style={{flex:'1 1 0', minHeight:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:18, width:'100%', overflow:'auto'}}>

      <div style={{display:'flex', alignItems:'center', gap:9, padding:'7px 15px', borderRadius:11,
        background:T.goldGl, border:`1px dashed ${T.goldLine}66`, color:T.textS,
        fontSize:12.5, fontFamily:'var(--font-body)'}}>
        <span style={{color:T.gold, fontWeight:700}}>◈</span>
        Layout novo — rascunho. O desenho definitivo ainda vai ser feito; a órbita segue guardada em Configurações.
      </div>

      <div style={{display:'grid', gap:16, width:'100%', maxWidth:1120,
        gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))'}}>
        {mods.map(m => {
          const { color, bg } = getModuleColor(m);
          const aceso = hov === m.id;
          return (
            <button key={m.id}
              onClick={()=>onSelect(m.atalho ? 'colaborador' : m.id, m.tab)}
              onMouseEnter={()=>setHov(m.id)} onMouseLeave={()=>setHov(null)}
              style={{display:'flex', alignItems:'center', gap:15, textAlign:'left',
                padding:'17px 19px', borderRadius:18, cursor:'pointer',
                background:T.surface, border:`1.5px solid ${aceso ? color+'77' : T.border}`,
                boxShadow:aceso ? T.shL : T.sh, fontFamily:'var(--font-body)',
                transform:aceso ? 'translateY(-2px)' : 'none',
                transition:'transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s, border-color .18s'}}>
              <div style={{width:52, height:52, borderRadius:15, background:bg, color,
                border:`1px solid ${color}22`, display:'flex', alignItems:'center',
                justifyContent:'center', flexShrink:0}}>
                {React.cloneElement(m.icon, {width:25, height:25})}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15.5, fontWeight:700, color:T.text}}>{m.label}</div>
                <div style={{fontSize:12, color:T.textT, marginTop:2,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { MenuLayoutNovo };
