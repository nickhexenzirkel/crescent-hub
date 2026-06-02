import React, { useState, useMemo } from 'react';
import { T } from '../contexts/theme';
import logoNicolas from '../assets/LogoTipoNicolas.png';

const LavaLamp = () => (
  <div style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
    <div style={{position:'absolute',inset:0,background:T.blobBase}}/>
    <div style={{position:'absolute',width:'210%',height:460,borderRadius:'50%',
      background:`radial-gradient(ellipse 80% 50% at 50% 50%,${T.b1} 0%,transparent 70%)`,
      top:'-180px',left:'-55%',filter:'blur(92px)',animation:'wave1 13s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:'200%',height:420,borderRadius:'50%',
      background:`radial-gradient(ellipse 78% 50% at 50% 50%,${T.b2} 0%,transparent 70%)`,
      top:'8%',left:'-50%',filter:'blur(86px)',animation:'wave2 16s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:'190%',height:400,borderRadius:'50%',
      background:`radial-gradient(ellipse 75% 50% at 50% 50%,${T.b3} 0%,transparent 68%)`,
      top:'28%',left:'-45%',filter:'blur(82px)',animation:'wave3 11s ease-in-out infinite'}}/>
    <div style={{position:'absolute',width:'200%',height:430,borderRadius:'50%',
      background:`radial-gradient(ellipse 78% 50% at 50% 50%,${T.b4} 0%,transparent 70%)`,
      top:'46%',left:'-50%',filter:'blur(88px)',animation:'wave1 14s ease-in-out infinite 2s'}}/>
    <div style={{position:'absolute',width:'190%',height:400,borderRadius:'50%',
      background:`radial-gradient(ellipse 75% 50% at 50% 50%,${T.b5} 0%,transparent 68%)`,
      bottom:'10%',left:'-45%',filter:'blur(80px)',animation:'wave2 12s ease-in-out infinite 1s'}}/>
    <div style={{position:'absolute',width:'210%',height:450,borderRadius:'50%',
      background:`radial-gradient(ellipse 80% 50% at 50% 50%,${T.b6} 0%,transparent 70%)`,
      bottom:'-160px',left:'-55%',filter:'blur(90px)',animation:'wave3 17s ease-in-out infinite 3s'}}/>
    <div style={{position:'absolute',width:'170%',height:370,borderRadius:'50%',
      background:`radial-gradient(ellipse 70% 50% at 50% 50%,${T.b7} 0%,transparent 68%)`,
      top:'63%',left:'-35%',filter:'blur(78px)',animation:'wave1 10s ease-in-out infinite 4s'}}/>
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

const CONFETTI_PALETTES = {
  vozBrasil:     ['#FFE000','#F5C800','#FFDD00','#00A040','#009C3B','#66CC00','#FFFFFF','#FFD700'],
  vozBrasilDark: ['#FFE000','#F5C800','#FFDD00','#00A040','#009C3B','#66CC00','#FFFFFF','#FFD700'],
  orgulho:       ['#FF0000','#FF7700','#FFEE00','#00DD00','#0044FF','#8800FF','#FF00CC','#FF88AA'],
  orgulhoDark:   ['#FF0000','#FF7700','#FFEE00','#00DD00','#0044FF','#8800FF','#FF00CC','#FF88AA'],
};

const Confetti = ({ themeKey }) => {
  const palette = CONFETTI_PALETTES[themeKey];
  const pieces  = useMemo(() => {
    if (!palette) return [];
    return Array.from({ length: 160 }, (_, i) => {
      const isCircle = Math.random() > 0.65;
      const w = 5 + Math.random() * 8;
      return {
        id: i,
        x:        Math.random() * 100,
        delay:    Math.random() * 0.7,
        duration: 1.3 + Math.random() * 1.4,
        w,
        h:        isCircle ? w : 3 + Math.random() * 5,
        color:    palette[Math.floor(Math.random() * palette.length)],
        anim:     Math.random() > 0.5 ? 'confettiL' : 'confettiR',
        radius:   isCircle ? '50%' : '1px',
      };
    });
  }, [themeKey]); // eslint-disable-line

  if (!palette) return null;
  return (
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:9998,overflow:'hidden'}}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:'absolute', left:`${p.x}%`, top:0,
          width:p.w, height:p.h,
          backgroundColor:p.color, borderRadius:p.radius,
          animation:`${p.anim} ${p.duration}s ${p.delay}s ease-in forwards`,
        }}/>
      ))}
    </div>
  );
};

export { LavaLamp, Moon, StarDivider, Logo, BrandLogo, UnikoIcon, Card, Tag, Btn, Inp, SHead, AvatarCircle, Confetti };
