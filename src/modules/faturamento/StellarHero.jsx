import { T } from '../../contexts/theme';
import { StarDivider, Moon } from '../../shared/components';

/* Estrelas decorativas (posições fixas) */
const STARS = [
  {x:'22%',y:'24%',r:1.7,d:'0.3s'},{x:'30%',y:'70%',r:1.3,d:'1.7s'},
  {x:'40%',y:'36%',r:1.9,d:'0.9s'},{x:'47%',y:'80%',r:1.2,d:'2.2s'},
  {x:'55%',y:'18%',r:1.6,d:'0.5s'},{x:'61%',y:'58%',r:1.4,d:'1.1s'},
  {x:'68%',y:'30%',r:1.8,d:'1.8s'},{x:'74%',y:'72%',r:1.3,d:'0.2s'},
  {x:'80%',y:'46%',r:1.5,d:'2.4s'},{x:'35%',y:'14%',r:1.4,d:'1.4s'},
];

/* ════════════════════════════════════════════════════════════════
   STELLAR HERO — banner cósmico (blobs + estrelas + lua)
   Estética estelar/lunar do Portal do Colaborador.
═══════════════════════════════════════════════════════════════════ */
export const StellarHero = ({ icon, eyebrow, title, subtitle, compact = false }) => {
  const h = compact ? 158 : 204;
  return (
    <div style={{
      borderRadius:22, overflow:'hidden', position:'relative', height:h,
      background:'linear-gradient(135deg,#07111E,#0B1C38,#101E3C,#152840)',
      boxShadow:'0 10px 44px rgba(4,8,20,.45)',
      marginBottom: compact ? 22 : 26,
    }}>
      <style>{`
        @keyframes fhb1{0%,100%{transform:translate(0,0)scale(1)}40%{transform:translate(28px,-18px)scale(1.08)}70%{transform:translate(-14px,22px)scale(.96)}}
        @keyframes fhb2{0%,100%{transform:translate(0,0)scale(1)}35%{transform:translate(-26px,18px)scale(1.05)}65%{transform:translate(18px,-26px)scale(1.10)}}
        @keyframes fhb3{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(12px,14px)scale(1.06)}}
        @keyframes ftw{0%,100%{opacity:.20;transform:scale(1)}50%{opacity:.92;transform:scale(1.35)}}
        @keyframes fshoot{0%,38%{opacity:0;transform:translate(0,0)}43%{opacity:1;transform:translate(8px,8px)}70%{opacity:.4;transform:translate(78px,78px)}77%,100%{opacity:0;transform:translate(104px,104px)}}
      `}</style>

      {/* blobs */}
      <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
        <div style={{position:'absolute',width:300,height:300,borderRadius:'50%',top:-95,left:-55,
          background:`radial-gradient(circle,${T.goldV}55 0%,transparent 68%)`,filter:'blur(30px)',animation:'fhb1 9s ease-in-out infinite'}}/>
        <div style={{position:'absolute',width:240,height:240,borderRadius:'50%',bottom:-70,right:130,
          background:`radial-gradient(circle,${T.gold}44 0%,transparent 68%)`,filter:'blur(26px)',animation:'fhb2 12s ease-in-out infinite'}}/>
        <div style={{position:'absolute',width:180,height:180,borderRadius:'50%',top:6,left:'46%',
          background:`radial-gradient(circle,${T.goldLine}40 0%,transparent 68%)`,filter:'blur(24px)',animation:'fhb3 7s ease-in-out infinite'}}/>
      </div>

      {/* estrelas */}
      {STARS.map((s,i)=>(
        <div key={i} style={{position:'absolute',left:s.x,top:s.y,width:s.r*2,height:s.r*2,borderRadius:'50%',
          background:'rgba(255,255,255,.85)',pointerEvents:'none',animation:`ftw ${2.2+i*.3}s ease-in-out infinite`,animationDelay:s.d}}/>
      ))}

      {/* estrela cadente */}
      <div style={{position:'absolute',left:'20%',top:'18%',pointerEvents:'none',animation:'fshoot 6s -1.5s linear infinite'}}>
        <div style={{width:54,height:1.5,background:'linear-gradient(to right,transparent,rgba(255,255,255,.85),transparent)',borderRadius:2,transform:'rotate(45deg)'}}/>
      </div>

      {/* lua */}
      <div style={{position:'absolute',right:30,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
        <Moon size={compact?54:74} color={T.goldV} opacity={0.62} float/>
      </div>

      {/* conteúdo */}
      <div style={{position:'relative',zIndex:1,padding: compact?'0 30px':'0 34px',height:'100%',
        display:'flex',flexDirection:'column',justifyContent:'center'}}>
        {eyebrow && (
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:compact?8:12}}>
            {icon && (
              <div style={{width:compact?34:40,height:compact?34:40,borderRadius:11,
                background:'rgba(255,255,255,.09)',border:'1px solid rgba(255,255,255,.16)',
                display:'flex',alignItems:'center',justifyContent:'center'}}>
                {icon}
              </div>
            )}
            <span style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.55)',
              letterSpacing:'.12em',textTransform:'uppercase'}}>{eyebrow}</span>
          </div>
        )}
        <h1 style={{fontSize:compact?24:32,fontWeight:700,color:'#fff',lineHeight:1.15,
          letterSpacing:'-.01em',margin:0,marginBottom:subtitle?6:0,maxWidth:560}}>{title}</h1>
        {subtitle && (
          <p style={{fontSize:compact?13:15,color:'rgba(255,255,255,.62)',lineHeight:1.55,margin:0,maxWidth:540}}>
            {subtitle}
          </p>
        )}
        <div style={{maxWidth:compact?320:420}}><StarDivider my={compact?8:12} dim/></div>
      </div>
    </div>
  );
};
