import React, { useState } from 'react';
import { T } from '../contexts/theme';
import logoNicolas from '../assets/LogoTipoNicolas.png';

const LavaLamp = () => (
  <div style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
    <div style={{position:'absolute',inset:0,background:T.blobBase}}/>
    <div style={{position:'absolute',width:780,height:780,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b1} 0%,transparent 65%)`,
      top:'-180px',left:'-160px',filter:'blur(85px)',animation:'blob1 11s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:680,height:680,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b2} 0%,transparent 65%)`,
      top:'0%',right:'-140px',filter:'blur(80px)',animation:'blob2 13s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:600,height:600,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b3} 0%,transparent 62%)`,
      bottom:'-80px',left:'20%',filter:'blur(72px)',animation:'blob3 10s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:540,height:540,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b4} 0%,transparent 65%)`,
      bottom:'15%',right:'5%',filter:'blur(78px)',animation:'blob4 12s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:460,height:460,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b5} 0%,transparent 62%)`,
      top:'35%',left:'38%',filter:'blur(65px)',animation:'blob5 14s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:420,height:420,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b6} 0%,transparent 65%)`,
      top:'52%',left:'1%',filter:'blur(70px)',animation:'blob2 10s ease-in-out infinite 2s'}}/>
    <div style={{position:'absolute',width:380,height:380,borderRadius:'50%',
      background:`radial-gradient(circle,${T.b7} 0%,transparent 65%)`,
      bottom:'5%',right:'30%',filter:'blur(68px)',animation:'blob1 9s ease-in-out infinite 3s'}}/>
    <div style={{position:'absolute',inset:0,background:T.blobVeil}}/>
  </div>
)
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

/* Logo principal da marca — troca com o tema via T.unikoSrc */
const BrandLogo = ({size=120}) => (
  <img src={T.unikoSrc || '/Uniko.png'} alt="Uniko"
    onError={e => { e.target.onerror = null; e.target.src = '/Uniko.png'; }}
    style={{
      width:size, height:size,
      objectFit:'contain',
      display:'block',
      flexShrink:0,
      filter:`drop-shadow(0 6px 24px ${T.goldLine}44)`,
    }}/>
);

/* Ícone quadrado — UnikoQuadrado.png em /public (topbars, sidebars, favicon) */
const UnikoIcon = ({size=32, rounded=true}) => (
  <img src="/UnikoQuadrado.png" alt="Uniko"
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
const Card = ({children,style,onClick,elevated}) => (
  <div onClick={onClick} style={{
    background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,
    boxShadow:elevated?T.shM:T.sh,position:'relative',overflow:'hidden',
    cursor:onClick?'pointer':'default',
    transition:'all .22s cubic-bezier(.16,1,.3,1)',fontFamily:'var(--font-body)',
    ...style}}
    onMouseEnter={onClick?e=>{e.currentTarget.style.boxShadow=T.shL;e.currentTarget.style.transform='translateY(-3px)';}:undefined}
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
