import React, { useState, useMemo, useEffect } from 'react';
import { T, onThemeChange } from '../contexts/theme';
import { bolhaGradiente, comAlfa, paletaDeBolhas } from './bolhas';
import logoNicolas from '../assets/LogoTipoNicolas.png';

/* ══════════════════════════════════════════════════════════════════════════
   LAVA LAMP — o fundo animado que aparece em todas as telas

   A REGRA: o fundo do tema é que manda. No tema claro a tela é
   predominantemente branca; no escuro, bem escura. As bolhas são um detalhe
   que passeia pelos cantos e pelo meio — não um banho de cor por cima de
   tudo. Duas tentativas anteriores erraram justamente nisso:

   • bolhas de 58-70vw (mais de 1000px cada numa tela de 1920) cobriam a tela
     inteira. Agora vão de 15 a 26vw, ancoradas nos quatro cantos, nas bordas
     de cima e de baixo, e três soltas no miolo;
   • um "banho" em degradê diagonal com as cores do tema pintava o fundo
     inteiro antes mesmo de qualquer bolha. Saiu: a base é a cor chapada do
     tema (T.blobBase) e nada mais.

   As cores vêm de paletaDeBolhas (shared/bolhas.js), que escolhe só os tons
   que contrastam com o fundo no sentido certo — mais escuros que a base nos
   temas claros, mais claros nos escuros — e ainda cria degraus intermediários
   misturando as cores vizinhas do tema.

   Nada aqui usa `filter: blur()`: a queda suave vem pronta no degradê. Ver o
   comentário em shared/bolhas.js pro porquê (era o que travava o app).
══════════════════════════════════════════════════════════════════════════ */
const LAVA_ANIMS = ['mlA','mlB','mlC','mlD','mlE','mlF'];

/* DOIS GRUPOS, não nove bolhas soltas. Espalhadas pela tela elas liam como
   "planetas" — cada uma redondinha e separada da outra. Agrupadas e com
   sobreposição pesada dentro de cada grupo, as cores se somam nas
   interseções e o que aparece é uma massa de cor com variação interna, que é
   o efeito de lava lamp de verdade.

   Composição em diagonal: um grupo no canto superior esquerdo, outro no
   inferior direito. A faixa do meio fica limpa de propósito — é onde moram o
   mascote e a órbita dos módulos.

   cx/cy são o CENTRO da bolha (% da tela); a posição sai por calc, porque
   translate(-50%) não dá: o transform é da animação. */
const LAVA_BLOBS = [
  // grupo 1 — canto superior esquerdo
  { cx:4,  cy:4,  w:34, dur:17 },
  { cx:23, cy:13, w:28, dur:21 },
  { cx:10, cy:27, w:26, dur:14, reverso:true },
  // grupo 2 — canto inferior direito
  { cx:96, cy:95, w:32, dur:19 },
  { cx:78, cy:100, w:28, dur:15, reverso:true },
  { cx:90, cy:72, w:25, dur:23 },
];

/* ── Estrelas do fundo ─────────────────────────────────────────────────────
   Mesma estrela de quatro pontas do StarDivider (✦), espalhadas pela página
   e piscando paradas, cada uma no seu ritmo. Posições, tamanhos e tempos são
   sorteados uma vez por carga — nenhuma carga fica igual à outra, mas elas
   não se mexem depois, só acendem e apagam.

   O que anima é opacity e scale — as duas propriedades que o compositor
   resolve sem repintar —, e cada estrela tem 15px no máximo. Nada de
   will-change aqui: seriam 52 camadas de GPU por um efeito que não precisa
   de nenhuma. Se algum dia pesar, o diagnóstico (Ctrl+Alt+P) mostra na
   linha "animando". */
const ESTRELAS = (() => {
  const r = (a, b) => a + Math.random() * (b - a);

  /* A densidade NÃO é uniforme. Sorteio uniforme joga estrela demais no miolo
     da tela, que é justamente onde moram o conteúdo e — no Seletor — o anel
     de módulos: as estrelas brigavam com os botões em vez de compor o fundo.

     Aqui cada candidata é aceita com uma chance que cresce com o CUBO da
     distância até o centro (distância elíptica, pra valer igual numa tela
     larga e numa estreita). No meio sobra pouca coisa — o suficiente pra não
     virar um buraco visível —, na borda entram todas, e os cantos, que antes
     ficavam vazios, enchem.

     Medido em 400 cargas, de 52 estrelas: sobre o anel de módulos caem 12
     (eram 25 com sorteio uniforme) e 40 vão pro resto da tela (eram 23). */
  const chance = (x, y) => {
    const d = Math.hypot((x - 50) / 50, (y - 50) / 50);  // 0 no centro, 1 na borda
    return Math.min(1, 0.05 + 0.95 * d * d * d);
  };

  const fora = [];
  for (let tentativa = 0; fora.length < 52 && tentativa < 9000; tentativa++) {
    const x = r(2, 98), y = r(2, 98);
    if (Math.random() > chance(x, y)) continue;          // caiu perto do meio: descarta
    fora.push({
      x, y,
      tam: r(7, 15),          // px
      dur: r(2.6, 6.4),       // s de um ciclo de brilho
      delay: -r(0, 6.4),      // negativo: já começam espalhadas no ciclo
      brilho: r(0.35, 1),     // teto de opacidade — dá profundidade ao campo
    });
  }
  return fora;
})();

const CampoDeEstrelas = () => {
  // Clara sobre fundo escuro, dourada sobre fundo claro.
  const cor = T.dark ? '#FFFFFF' : (T.goldV || T.gold);
  return (
    <div className="bg-estrelas" style={{position:'absolute',inset:0,pointerEvents:'none'}} aria-hidden="true">
      <style>{`@keyframes ulPisca{0%,100%{opacity:.12;transform:scale(.8)}50%{opacity:1;transform:scale(1.12)}}`}</style>
      {ESTRELAS.map((e, i) => (
        <svg key={i} width={e.tam} height={e.tam} viewBox="0 0 14 14"
          style={{position:'absolute', left:`${e.x}%`, top:`${e.y}%`, opacity:e.brilho,
            animation:`ulPisca ${e.dur}s ease-in-out infinite`, animationDelay:`${e.delay}s`}}>
          <path d="M7 1 L7.8 5.4 L12 7 L7.8 8.6 L7 13 L6.2 8.6 L2 7 L6.2 5.4 Z" fill={cor}/>
        </svg>
      ))}
    </div>
  );
};

const LavaLamp = () => {
  /* T é um objeto mutável e este componente vive no App, fora da tela que
     troca o tema — sem ouvir o aviso, ficaria com as cores antigas (era por
     isso que o Seletor de Módulos precisava tapar o fundo). */
  const [, redesenha] = useState(0);
  useEffect(() => onThemeChange(() => redesenha(n => n + 1)), []);

  /* Sorteado uma vez por carga: qual animação cada bolha segue e com que
     atraso entra — assim duas cargas seguidas nunca ficam idênticas. As
     cores são lidas a cada render, pra acompanharem a troca de tema. */
  const bolhas = useMemo(() => LAVA_BLOBS.map((b, i) => ({
    ...b,
    anim: LAVA_ANIMS[i % LAVA_ANIMS.length],
    delay: -Math.random() * b.dur,
  })), []);

  const tons = paletaDeBolhas(T);
  const cor = (i) => tons[(i * 3) % tons.length];   // passo 3: vizinhas nunca repetem o tom

  // A classe "lava-lamp" é o que o diagnóstico de performance (Ctrl+Alt+P,
  // tecla 2) usa pra apagar o fundo e medir quanto ele custa.
  return (
    <div className="lava-lamp" style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
      <style>{`
        @keyframes mlA{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(7vw,-5vw) scale(1.18)}66%{transform:translate(-6vw,5vw) scale(.86)}}
        @keyframes mlB{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-8vw,4vw) scale(1.14)}80%{transform:translate(5vw,-4vw) scale(.88)}}
        @keyframes mlC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6vw,6vw) scale(1.22)}}
        @keyframes mlD{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-6vw,-5vw) scale(1.2)}70%{transform:translate(5vw,4vw) scale(.84)}}
        @keyframes mlE{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(4vw,4vw) scale(1.12)}55%{transform:translate(-5vw,-3vw) scale(.9)}80%{transform:translate(3vw,-4vw) scale(1.08)}}
        @keyframes mlF{0%,100%{transform:translate(0,0) scale(1.02)}45%{transform:translate(-4vw,6vw) scale(.88)}75%{transform:translate(7vw,-4vw) scale(1.16)}}
      `}</style>
      {/* Base: a cor chapada do tema, e só. É ela que faz a tela ser branca no
          tema claro e bem escura no escuro. */}
      <div style={{position:'absolute',inset:0,background:T.blobBase}}/>
      {bolhas.map((b,i)=>(
        <div key={i} className="lava-bolha" style={{position:'absolute',
          width:`${b.w}vw`, height:`${b.w}vw`, borderRadius:'50%',
          left:`calc(${b.cx}% - ${b.w/2}vw)`, top:`calc(${b.cy}% - ${b.w/2}vw)`,
          background:bolhaGradiente(cor(i)),
          /* Sem mix-blend-mode aqui, de propósito. Ele deixava a mistura mais
             intensa, mas foi medido como o maior custo de desenho que sobrou
             (Ctrl+Alt+P): blend obriga o compositor a reler o que está atrás
             de cada camada, e eram 6 delas cobrindo ~28% da tela.

             A mistura continua acontecendo por transparência pura. Sobre um
             fundo escuro ela até CLAREIA sozinha: com as cores do Azul
             Nebula, o cruzamento de duas bolhas dá luminância 55 contra 32 e
             44 das bolhas isoladas. Nos temas claros vale o inverso — as duas
             camadas somam opacidade e o cruzamento escurece. */
          willChange:'transform',
          animation:`${b.anim} ${b.dur}s ease-in-out infinite${b.reverso?' reverse':''}`,
          animationDelay:`${b.delay}s`}}/>
      ))}
      {/* Véu: mantém o fundo do tema predominante e o texto legível por cima.
          Baixou de 3/4 pra 3/5 junto com o pico das bolhas: elas ficaram mais
          difusas, e sem aliviar o véu na mesma medida sumiriam de novo. */}
      <div style={{position:'absolute',inset:0,background:comAlfa(T.blobVeil, 0.6)}}/>
      {/* Estrelas por último: brilham por cima do véu, senão ele as apagaria. */}
      <CampoDeEstrelas/>
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
