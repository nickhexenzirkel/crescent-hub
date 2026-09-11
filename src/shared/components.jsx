import React, { useState, useMemo, useEffect } from 'react';
import { T, onThemeChange } from '../contexts/theme';
import { bolhaGradiente, comAlfa, paletaDeBolhas } from './bolhas';
import logoNicolas from '../assets/LogoTipoNicolas.png';

/* ══════════════════════════════════════════════════════════════════════════
   LAVA LAMP — o fundo animado que aparece em todas as telas

   Foi refeito em set/2026 espelhando o fundo do Festival da Central Alexa,
   que é o que ficou bonito: mais bolhas (10 contra 8), tamanhos bem
   diferentes entre si, e não só círculos — entram faixas largas e achatadas
   e uma coluna alta, que é o que dá a sensação de massa se movendo em vez de
   sete bolas do mesmo tamanho passeando.

   Duas coisas que faziam ele quase não aparecer no Seletor de Módulos:
   • o Seletor pintava `background: T.page` OPACO por cima — o lava lamp
     ficava lá atrás, rodando pra ninguém (ver ModuleSelector);
   • o véu de cima (T.blobVeil, alfa .58) lavava o que sobrava. Agora ele
     entra com metade da força, o suficiente pra manter texto legível.

   Sobre cor: o tema traz 7 tons de bolha, e repetir 7 em 10 bolhas deixava o
   fundo monótono. paletaDeBolhas (shared/bolhas.js) estica isso pra 14,
   misturando cada cor com a vizinha — mais variedade sem sair do tema.

   Nada aqui usa `filter: blur()`: a queda suave vem pronta no degradê. Ver
   o comentário em shared/bolhas.js pro porquê (era o que travava o app).
══════════════════════════════════════════════════════════════════════════ */
const LAVA_ANIMS = ['mlA','mlB','mlC','mlD','mlE','mlF'];

/* Geometria copiada do Festival da Central Alexa. w/h em vw (a coluna usa vh
   na altura); pos é onde a bolha se ancora. */
const LAVA_BLOBS = [
  { w:'58vw', h:'58vw', pos:{ top:'-18vw', left:'-12vw'  }, dur:14 },
  { w:'50vw', h:'50vw', pos:{ top:'-12vw', right:'-8vw'  }, dur:17 },
  { w:'48vw', h:'48vw', pos:{ bottom:'-12vw', left:'-8vw' }, dur:12 },
  { w:'44vw', h:'44vw', pos:{ bottom:'-8vw', right:'-6vw' }, dur:15 },
  { w:'38vw', h:'38vw', pos:{ top:'30%',   left:'31%'    }, dur:11 },
  { w:'70vw', h:'30vw', pos:{ top:'-5vw',  left:'10%'    }, dur:19, forma:'ellipse' },
  { w:'70vw', h:'30vw', pos:{ bottom:'-5vw', left:'5%'   }, dur:16, forma:'ellipse' },
  { w:'28vw', h:'80vh', pos:{ top:'5%',    left:'38%'    }, dur:22, forma:'ellipse' },
  { w:'36vw', h:'36vw', pos:{ top:'20%',   right:'5%'    }, dur:13, reverso:true },
  { w:'32vw', h:'32vw', pos:{ top:'40%',   left:'2%'     }, dur:18, reverso:true },
];

const LavaLamp = () => {
  /* T é um objeto mutável e este componente vive no App, fora da tela que
     troca o tema — sem ouvir o aviso, ele continuaria com as cores antigas
     (era por isso que o Seletor de Módulos precisava tapar o fundo). */
  const [, redesenha] = useState(0);
  useEffect(() => onThemeChange(() => redesenha(n => n + 1)), []);

  /* Sorteado uma vez por carga: qual tom cada bolha pega, qual animação segue
     e com que atraso entra. Só as posições/tempos — as cores são lidas a cada
     render, pra acompanharem a troca de tema. */
  const bolhas = useMemo(() => {
    const r = (a,b) => a + Math.random()*(b-a);
    return LAVA_BLOBS.map((b,i) => ({
      ...b,
      tom: i,
      anim: LAVA_ANIMS[i % LAVA_ANIMS.length],
      delay: -r(0, b.dur),
    }));
  }, []);

  const tons = paletaDeBolhas(T);
  const cor = (i) => tons[(i * 3) % tons.length];   // passo 3: vizinhas nunca repetem o tom

  /* Base: em vez de uma cor chapada, um banho em diagonal com vários tons do
     tema (é o que a Central Alexa faz). Sozinho ele já dá profundidade
     mesmo antes de qualquer bolha entrar em quadro. */
  const banho = `linear-gradient(135deg, ${comAlfa(cor(0),.42)}, ${comAlfa(cor(4),.3)}, `
              + `${comAlfa(cor(7),.34)}, ${comAlfa(cor(2),.26)}, ${comAlfa(cor(9),.3)})`;

  // A classe "lava-lamp" é o que o diagnóstico de performance (Ctrl+Alt+P,
  // tecla 2) usa pra apagar o fundo e medir quanto ele custa.
  return (
    <div className="lava-lamp" style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
      <style>{`
        @keyframes mlA{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(13vw,-10vw) scale(1.28)}66%{transform:translate(-11vw,9vw) scale(.8)}}
        @keyframes mlB{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-15vw,8vw) scale(1.22)}80%{transform:translate(10vw,-7vw) scale(.84)}}
        @keyframes mlC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(11vw,12vw) scale(1.32)}}
        @keyframes mlD{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-12vw,-9vw) scale(1.3)}70%{transform:translate(9vw,7vw) scale(.78)}}
        @keyframes mlE{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(8vw,6vw) scale(1.15)}55%{transform:translate(-9vw,-5vw) scale(.88)}80%{transform:translate(5vw,-8vw) scale(1.1)}}
        @keyframes mlF{0%,100%{transform:translate(0,0) scale(1.04)}45%{transform:translate(-7vw,10vw) scale(.82)}75%{transform:translate(12vw,-6vw) scale(1.24)}}
      `}</style>
      <div style={{position:'absolute',inset:0,background:T.blobBase}}/>
      <div style={{position:'absolute',inset:0,background:banho}}/>
      {bolhas.map((b,i)=>(
        <div key={i} style={{position:'absolute',
          width:b.w, height:b.h, borderRadius:'50%', ...b.pos,
          background:bolhaGradiente(cor(b.tom), b.forma || 'circle'),
          willChange:'transform',
          animation:`${b.anim} ${b.dur}s ease-in-out infinite${b.reverso?' reverse':''}`,
          animationDelay:`${b.delay}s`}}/>
      ))}
      {/* Véu: segura o contraste do texto por cima, mas com metade da força de
          antes — no ajuste anterior ele apagava as bolhas quase por completo. */}
      <div style={{position:'absolute',inset:0,background:comAlfa(T.blobVeil, 0.5)}}/>
    </div>
  );
};

const Moon = ({size=32, color=T.goldL, opacity=0.45, float=false}) => (
  <svg width={size} height={size} viewBox="0 0 32 32"
    style={{opacity, flexShrink:0, animation:float?'moonFloat 4s ease-in-out infinite':undefined}}>
    <defs>
      <filter id="moonGlow">
        <feGaussianBlur stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* crescent via two circles */}
    <path d="M20 5 A13 13 0 1 0 20 27 A9 9 0 1 1 20 5 Z"
      fill={color} filter="url(#moonGlow)"/>
    {/* inner highlight */}
    <path d="M21 8 A9 9 0 1 0 21 24 A6 6 0 1 1 21 8 Z"
      fill="white" opacity="0.18"/>
  </svg>
);

/* ══════════════════════════════════════════
   STAR DIVIDER — linha dourada + estrela
   (estilo da imagem enviada)
══════════════════════════════════════════ */
const StarDivider = ({my=8, width='100%', dim=false}) => {
  /* T.goldLine é hex (#RRGGBB) — sufixo hex de opacidade é válido */
  const lc = T.goldLine + (dim ? '44' : '88');
  const sc = T.goldV    + (dim ? '77' : 'BB');
  /* transparent compatível: versão rgba do goldLine com alpha=0 */
  const lt = T.goldLine + '00';
  return (
    <div style={{
      display:'flex', alignItems:'center',
      padding:`${my}px 0`, width,
      boxSizing:'border-box',
    }}>
      <div style={{
        flex:1, minWidth:8, height:1,
        background:`linear-gradient(to right, ${lt} 0%, ${lc} 100%)`,
      }}/>
      <svg width="10" height="10" viewBox="0 0 14 14"
        style={{flexShrink:0, margin:'0 7px',
          animation:'starPulse 2.5s ease-in-out infinite'}}>
        <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z"
          fill={sc}/>
      </svg>
      <div style={{
        flex:1, minWidth:8, height:1,
        background:`linear-gradient(to left, ${lt} 0%, ${lc} 100%)`,
      }}/>
    </div>
  );
};

/* Logo de crédito — LogoTipoNicolas (rodapé "Criado por Nicolas Andrade") */
const Logo = ({size=64}) => (
  <img src={logoNicolas} alt="Nicolas Andrade"
    style={{
      width:size, height:size,
      objectFit:'contain',
      display:'block',
      flexShrink:0,
    }}/>
);

/* Logo principal da marca — Uniko único (UNIKO_NEW), sem variação por tema */
const BrandLogo = ({size=120}) => (
  <img src={T.unikoSrc || '/UNIKO_NEW.png'} alt="Uniko"
    onError={e => { e.target.onerror = null; e.target.src = '/UNIKO_NEW.png'; }}
    style={{
      width:size, height:size,
      objectFit:'contain',
      display:'block',
      flexShrink:0,
      filter:`drop-shadow(0 6px 24px ${T.goldLine}44)`,
    }}/>
);

/* Ícone quadrado — UNIKO_FRENTE_FRONTAL.png em /public (topbars, sidebars, favicon) */
const UnikoIcon = ({size=32, rounded=true}) => (
  <img src="/UNIKO_FRENTE_FRONTAL.png" alt="Uniko"
    style={{
      width:size, height:size,
      objectFit:'cover',
      display:'block',
      flexShrink:0,
      borderRadius: rounded ? Math.round(size * 0.22) : 0,
    }}/>
);

/* ══════════════════════════════════════════
   ATOMS
══════════════════════════════════════════ */
const Card = ({children,style,onClick,elevated,className}) => (
  <div onClick={onClick} className={className} style={{
    background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,
    boxShadow:elevated?T.shM:T.sh,position:'relative',overflow:'hidden',
    cursor:onClick?'pointer':'default',
    transition:'all .22s cubic-bezier(.16,1,.3,1)',fontFamily:'var(--font-body)',
    ...style}}
    onMouseEnter={onClick?e=>{e.currentTarget.style.boxShadow=T.shL;e.currentTarget.style.transform='translateY(-4px) scale(1.02)';}:undefined}
    onMouseLeave={onClick?e=>{e.currentTarget.style.boxShadow=elevated?T.shM:T.sh;e.currentTarget.style.transform='none';}:undefined}>
    {children}
  </div>
);

const Tag = ({children,color=T.gold,bg}) => (
  <span style={{background:bg||`${color}12`,color,border:`1px solid ${color}28`,
    borderRadius:7,padding:'4px 11px',fontSize:12.5,fontWeight:500,
    fontFamily:'var(--font-body)',letterSpacing:'.01em'}}>{children}</span>
);

const Btn = ({children,onClick,v='ghost',icon,full,style:s,disabled}) => {
  const V={
    primary:{background:`linear-gradient(135deg,${T.gold},${T.blueL})`,
      color:'#fff',border:'none',boxShadow:`0 4px 18px rgba(14,80,180,0.32)`},
    secondary:{background:T.surface,color:T.gold,
      border:`1.5px solid ${T.gold}99`,boxShadow:T.sh},
    ghost:{background:T.goldGl,color:T.gold,
      border:`1px solid rgba(30,111,181,0.18)`},
    ghostGray:{background:'rgba(0,0,0,0.04)',color:T.textS,
      border:`1px solid ${T.border}`},
    blue:{background:`linear-gradient(135deg,${T.blue},${T.blueL})`,
      color:'#fff',border:'none',boxShadow:`0 4px 18px rgba(78,143,168,0.28)`},
    danger:{background:T.dangerGl,color:T.danger,
      border:`1px solid rgba(192,64,80,0.18)`},
  };
  return(
    <button onClick={onClick} disabled={disabled} style={{
      display:'inline-flex',alignItems:'center',gap:8,padding:'10px 20px',
      borderRadius:10,cursor:disabled?'not-allowed':'pointer',
      fontFamily:'var(--font-body)',fontSize:14,fontWeight:500,
      outline:'none',transition:'all .18s',fontSize:15,
      width:full?'100%':'auto',justifyContent:full?'center':'flex-start',
      opacity:disabled?.45:1,...V[v],...s}}>
      {icon&&<span style={{fontSize:16}}>{icon}</span>}{children}
    </button>
  );
};

const Inp = ({label,value,onChange,type='text',placeholder,icon,autoFocus,style:s}) => {
  const [f,sf]=useState(false);
  return(
    <div style={{marginBottom:16}}>
      {label&&<div style={{color:T.textS,fontSize:14,fontWeight:500,marginBottom:7,
        fontFamily:'var(--font-body)'}}>{label}</div>}
      <div style={{position:'relative'}}>
        {icon&&<span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',
          color:f?T.gold:T.textD,fontSize:15,transition:'color .15s',userSelect:'none'}}>{icon}</span>}
        <input autoFocus={autoFocus} type={type} value={value}
          onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          onFocus={()=>sf(true)} onBlur={()=>sf(false)}
          style={{width:'100%',background:f?T.inputFocus:(T.surfaceInput||'rgba(0,0,0,0.025)'),
            border:`1.5px solid ${f?T.gold+'88':T.border}`,borderRadius:10,
            padding:`12px ${icon?'14px':'14px'} 12px ${icon?'42px':'14px'}`,
            color:T.text,fontFamily:'var(--font-body)',fontSize:16,outline:'none',
            transition:'all .18s',
            boxShadow:f?`0 0 0 3px rgba(30,111,181,0.10)`:'none',...s}}/>
      </div>
    </div>
  );
};

const SHead = ({children,sub}) => (
  <div style={{marginBottom:28}}>
    <div style={{fontFamily:'var(--font-body)',fontSize:24,fontWeight:700,
      color:T.text,letterSpacing:'-.01em',lineHeight:1.2}}>{children}</div>
    {sub&&<div style={{fontFamily:'var(--font-body)',fontSize:16,color:T.textT,marginTop:6}}>{sub}</div>}
    <StarDivider my={14}/>
  </div>
);


const AvatarCircle = ({ name='?', photo=null, size=38, fontSize=13, rounded='50%', style={} }) => {
  const initials = name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
  return (
    <div style={{
      width:size, height:size, borderRadius:rounded, flexShrink:0, overflow:'hidden',
      backgroundColor: photo ? undefined : T.gold,
      backgroundImage: photo ? `url(${photo})` : `linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,
      backgroundSize:'cover', backgroundPosition:'center',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize, fontWeight:700, color:'#fff',
      ...style,
    }}>
      {!photo && initials}
    </div>
  );
};

export { LavaLamp, Moon, StarDivider, Logo, BrandLogo, UnikoIcon, Card, Tag, Btn, Inp, SHead, AvatarCircle };
