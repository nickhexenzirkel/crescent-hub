import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, getAuthUser } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';
import dokoTecnico    from '../../../assets/DodocoTecnico.jpg';
import dokoCozinheiro from '../../../assets/DodocoCozinheiro.jpg';
import dokoMedico     from '../../../assets/DodocoMedico.jpg';
import dokoAmbiental  from '../../../assets/DodocoAmbientalista.jpg';
import dokoContador   from '../../../assets/DodocoContador.jpg';

/* ── Constantes ──────────────────────────────────────────────────────── */
const SKINS = { tecnico:dokoTecnico, cozinheiro:dokoCozinheiro, medico:dokoMedico, ambiental:dokoAmbiental, contador:dokoContador };
const _auth    = getAuthUser();
const DOKO_KEY = _auth?.cpf ? `uniko_doko_${_auth.cpf}` : 'uniko_doko';
const PHOTO_KEY   = _auth?.cpf ? `uniko_photo_${_auth.cpf}`        : 'uniko_photo';
const PHPOS_KEY   = _auth?.cpf ? `uniko_photo_pos_${_auth.cpf}`    : 'uniko_photo_pos';
const PHSCALE_KEY = _auth?.cpf ? `uniko_photo_scale_${_auth.cpf}`  : 'uniko_photo_scale';
const BANNER_KEY  = _auth?.cpf ? `uniko_banner_${_auth.cpf}`       : 'uniko_banner';

const barCol = v => v >= 60 ? '#28A870' : v >= 30 ? '#E8A020' : '#C04050';
const fmtTime = t => { if (!t) return ''; const [h,m]=t.split(':'); return `${parseInt(h)}:${m}`; };
const fmtDS   = d => { if (!d) return ''; return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}); };
const loadLS  = (k,fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };

/* ── Presets de banner ──────────────────────────────────────────────── */
const PRESETS = {
  azul_estelar: {
    id:'azul_estelar', name:'Azul Estelar', emoji:'🌌',
    bg:'linear-gradient(135deg,#07111E 0%,#0B1C38 40%,#101E3C 70%,#152840 100%)',
    b1:`#2A6DB550`,b2:`#D4A84322`,b3:`#5A3CB440`,
    planet:'neptune', stars:true, shooting:true,
  },
  rosa_nebula: {
    id:'rosa_nebula', name:'Rosa Nebula', emoji:'🌸',
    bg:'linear-gradient(135deg,#150620 0%,#260A2E 40%,#350D3E 70%,#1A0824 100%)',
    b1:`#D040A855`,b2:`#FF6B9D28`,b3:`#7B1A8B40`,
    planet:'venus', stars:true, shooting:true,
  },
  dourado: {
    id:'dourado', name:'Dourado Imperial', emoji:'👑',
    bg:'linear-gradient(135deg,#171000 0%,#291A00 40%,#362200 70%,#1E1400 100%)',
    b1:`#D4A84352`,b2:`#F5C84224`,b3:`#8B650038`,
    planet:'saturn', stars:true, shooting:false,
  },
  verde: {
    id:'verde', name:'Verde Esmeralda', emoji:'🌿',
    bg:'linear-gradient(135deg,#041610 0%,#08261A 40%,#0C2E1E 70%,#062018 100%)',
    b1:`#28A87050`,b2:`#52CC8824`,b3:`#1A6A4038`,
    planet:'earth', stars:true, shooting:false,
  },
};

/* ── Planetas SVG ─────────────────────────────────────────────────── */
const PlanetNeptune = () => (
  <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
    <defs>
      <radialGradient id="np_g" cx="38%" cy="34%" r="65%">
        <stop offset="0%" stopColor="#6AAEF5"/><stop offset="55%" stopColor="#1A50A8"/><stop offset="100%" stopColor="#0D3070"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="44" fill="rgba(30,80,200,0.07)"/>
    <ellipse cx="50" cy="57" rx="44" ry="11" stroke="rgba(100,160,255,0.25)" strokeWidth="3" fill="none"/>
    <circle cx="50" cy="50" r="27" fill="url(#np_g)"/>
    <circle cx="37" cy="41" r="8" fill="rgba(120,180,255,0.22)"/>
    <ellipse cx="50" cy="57" rx="44" ry="11" stroke="rgba(100,160,255,0.12)" strokeWidth="2" fill="none" strokeDasharray="76,56"/>
  </svg>
);

const PlanetVenus = () => (
  <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
    <defs>
      <radialGradient id="vg" cx="40%" cy="36%" r="62%">
        <stop offset="0%" stopColor="#FFE4F0"/><stop offset="45%" stopColor="#ECA0C8"/><stop offset="100%" stopColor="#B04888"/>
      </radialGradient>
      <radialGradient id="va" cx="50%" cy="50%" r="50%">
        <stop offset="55%" stopColor="transparent"/><stop offset="82%" stopColor="rgba(255,150,200,0.14)"/><stop offset="100%" stopColor="rgba(240,100,170,0.32)"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="44" fill="url(#va)"/>
    <circle cx="50" cy="50" r="27" fill="url(#vg)"/>
    <circle cx="37" cy="39" r="9" fill="rgba(255,240,248,0.22)"/>
    <ellipse cx="54" cy="58" rx="8" ry="5" fill="rgba(200,100,150,0.18)" transform="rotate(15 54 58)"/>
  </svg>
);

const PlanetSaturn = () => (
  <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
    <defs>
      <radialGradient id="sg" cx="38%" cy="33%" r="64%">
        <stop offset="0%" stopColor="#F7D880"/><stop offset="50%" stopColor="#C89020"/><stop offset="100%" stopColor="#7A4E00"/>
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="56" rx="47" ry="13" stroke="rgba(210,168,60,0.32)" strokeWidth="5" fill="none"/>
    <circle cx="50" cy="50" r="26" fill="url(#sg)"/>
    <circle cx="37" cy="42" r="8" fill="rgba(255,230,120,0.20)"/>
    <ellipse cx="50" cy="56" rx="47" ry="13" stroke="rgba(210,168,60,0.18)" strokeWidth="3.5" fill="none" strokeDasharray="65,44"/>
  </svg>
);

const PlanetEarth = () => (
  <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
    <defs>
      <radialGradient id="eg" cx="38%" cy="34%" r="65%">
        <stop offset="0%" stopColor="#58C0F0"/><stop offset="50%" stopColor="#1A78B8"/><stop offset="100%" stopColor="#0A3A6A"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="44" fill="rgba(30,120,160,0.07)"/>
    <circle cx="50" cy="50" r="27" fill="url(#eg)"/>
    <ellipse cx="42" cy="44" rx="10" ry="6" fill="rgba(40,168,112,0.55)" transform="rotate(-15 42 44)"/>
    <ellipse cx="59" cy="55" rx="7" ry="4.5" fill="rgba(40,168,112,0.45)" transform="rotate(12 59 55)"/>
    <ellipse cx="38" cy="57" rx="5" ry="3" fill="rgba(40,168,112,0.30)" transform="rotate(-5 38 57)"/>
    <circle cx="37" cy="37" r="7" fill="rgba(180,225,255,0.20)"/>
  </svg>
);

const PLANET_MAP = { neptune:<PlanetNeptune/>, venus:<PlanetVenus/>, saturn:<PlanetSaturn/>, earth:<PlanetEarth/> };

const STARS_POS = [
  {x:'8%',y:'20%',r:2.4,d:'0s'},{x:'19%',y:'12%',r:1.6,d:'1.1s'},{x:'33%',y:'30%',r:2.2,d:'0.5s'},
  {x:'48%',y:'14%',r:1.5,d:'1.8s'},{x:'57%',y:'32%',r:1.8,d:'0.3s'},{x:'13%',y:'65%',r:1.4,d:'2.3s'},
  {x:'41%',y:'70%',r:1.7,d:'0.9s'},{x:'67%',y:'22%',r:1.2,d:'1.6s'},
];
const SHOOT_POS = [{x:'18%',y:'18%',delay:'3s'},{x:'52%',y:'8%',delay:'6.5s'},{x:'35%',y:'28%',delay:'10s'}];

/* ── Componente principal ────────────────────────────────────────── */
const TabInicio = ({ setTab, onGoAlexa }) => {
  const [sv,   setSv]   = useState(false);
  const [lembs,  setLembs]   = useState([]);
  const [evts,   setEvts]    = useState([]);
  const [comuns, setComuns]  = useState([]);
  const [uniko,  setUniko]   = useState(() => loadLS(DOKO_KEY, {}));
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying,  setIsPlaying]  = useState(false);

  const [photo,      setPhoto]      = useState(() => localStorage.getItem(PHOTO_KEY) || null);
  const [photoPos,   setPhotoPos]   = useState(() => loadLS(PHPOS_KEY,   { x:50, y:50 }));
  const [photoScale, setPhotoScale] = useState(() => loadLS(PHSCALE_KEY, 100));
  const [preset,     setPreset]     = useState(() => localStorage.getItem(BANNER_KEY) || 'azul_estelar');

  const [showPhoto,  setShowPhoto]  = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [tmpPhoto,   setTmpPhoto]   = useState(null);
  const [tmpPos,     setTmpPos]     = useState({ x:50, y:50 });
  const [tmpScale,   setTmpScale]   = useState(100);
  const [tmpPreset,  setTmpPreset]  = useState(preset);

  const fileRef = useRef(null);

  const now   = new Date();
  const hour  = now.getHours();
  const today = now.toISOString().slice(0, 10);
  const hhmm  = now.toTimeString().slice(0, 5);
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayFmt = now.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });

  const P = PRESETS[preset] || PRESETS.azul_estelar;

  /* ── Fetch ── */
  useEffect(() => {
    _supabase.from('reminders').select('*').eq('active',true).eq('created_by',USER.name)
      .then(({data}) => setLembs(data||[]));
    _supabase.from('calendar_events').select('*').order('event_date',{ascending:true})
      .then(({data}) => setEvts(data||[]));
    _supabase.from('comunicados').select('*').eq('active',true)
      .order('created_at',{ascending:false}).limit(3)
      .then(({data}) => setComuns(data||[]));
    setUniko(loadLS(DOKO_KEY, {}));

    // Now playing
    _supabase.from('player_state').select('*').eq('id',1).single()
      .then(async ({data}) => {
        if (!data) return;
        setIsPlaying(!!data.is_playing);
        if (data.current_song_id) {
          const {data:song} = await _supabase.from('queue').select('*').eq('id',data.current_song_id).single();
          if (song) setNowPlaying(song);
        }
      });
  }, []);

  /* ── Derived ── */
  const upcoming = lembs
    .filter(r => {
      if (!r.time) return false;
      if (r.repeat !== 'never') return true;
      if (!r.date || r.date > today) return true;
      return r.date === today && r.time >= hhmm;
    })
    .sort((a,b) => {
      const aH = r => r.repeat!=='never' || !r.date || r.date===today;
      if (aH(a)!==aH(b)) return aH(a)?-1:1;
      return (a.date||'').localeCompare(b.date||'')||a.time.localeCompare(b.time);
    }).slice(0,4);

  const todayEvts = evts.filter(e => e.event_date === today);

  const { fome=75, energia=70, sono=70, dormindo=false, skin='tecnico' } = uniko;
  const avg = (fome+energia)/2;
  const uS = dormindo ? {l:'Dormindo',c:'#8B6FD4',e:'😴',s:'Recuperando sono...'}
    : (fome<25&&energia<25) ? {l:'Cansado!',c:'#C04050',e:'😓',s:'Precisa de cuidados!'}
    : avg>=70 ? {l:'Feliz',c:'#28A870',e:'😊',s:'Pronto para interagir!'}
    : avg>=35 ? {l:'Neutro',c:'#E8A020',e:'😐',s:'Precisa de atenção'}
    : {l:'Triste',c:'#C04050',e:'😢',s:'Cuide dele agora!'};

  /* ── Helpers de UI ── */
  const BtnVer = ({tab,label='Ver →',onClick}) => (
    <button onClick={onClick||(()=>setTab(tab))} style={{
      background:T.goldGl,border:`1px solid ${T.gold}33`,color:T.gold,
      cursor:'pointer',fontSize:11,padding:'3px 10px',borderRadius:6,
      fontFamily:'var(--font-body)',fontWeight:600,outline:'none',flexShrink:0,
    }}>{label}</button>
  );

  const EmptyW = ({icon,text,sub}) => (
    <div style={{textAlign:'center',padding:'16px 0',color:T.textT}}>
      <div style={{opacity:.4,marginBottom:6,display:'flex',justifyContent:'center'}}>{icon}</div>
      <div style={{fontSize:12}}>{text}</div>
      {sub&&<div style={{fontSize:11,marginTop:2,opacity:.65}}>{sub}</div>}
    </div>
  );

  const IcoSVG = ({d,size=13,stroke=T.textT}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  );

  /* ── Avatar style ── */
  const avatarStyle = photo ? {
    backgroundImage:`url(${photo})`,
    backgroundSize:`${photoScale}%`,
    backgroundPosition:`${photoPos.x}% ${photoPos.y}%`,
    backgroundRepeat:'no-repeat',
  } : {};

  /* ── Handlers de foto ── */
  const openPhotoModal = () => {
    setTmpPhoto(photo); setTmpPos({...photoPos}); setTmpScale(photoScale);
    setShowPhoto(true);
  };
  const onFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setTmpPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };
  const savePhoto = () => {
    if (tmpPhoto) { localStorage.setItem(PHOTO_KEY, tmpPhoto); setPhoto(tmpPhoto); }
    localStorage.setItem(PHPOS_KEY,   JSON.stringify(tmpPos));
    localStorage.setItem(PHSCALE_KEY, JSON.stringify(tmpScale));
    setPhotoPos(tmpPos); setPhotoScale(tmpScale);
    setShowPhoto(false);
  };

  /* ── Handlers de banner ── */
  const openBannerModal = () => { setTmpPreset(preset); setShowBanner(true); };
  const saveBanner = () => { localStorage.setItem(BANNER_KEY, tmpPreset); setPreset(tmpPreset); setShowBanner(false); };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <style>{`
        @keyframes hb1{0%,100%{transform:translate(0,0)scale(1)}40%{transform:translate(28px,-18px)scale(1.08)}70%{transform:translate(-14px,22px)scale(.96)}}
        @keyframes hb2{0%,100%{transform:translate(0,0)scale(1)}35%{transform:translate(-26px,18px)scale(1.05)}65%{transform:translate(18px,-26px)scale(1.10)}}
        @keyframes hb3{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(12px,14px)scale(1.06)}}
        @keyframes twinkle{0%,100%{opacity:.22;transform:scale(1)}50%{opacity:.92;transform:scale(1.35)}}
        @keyframes moonP{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes shoot{0%,88%{opacity:0;transform:rotate(-42deg)translateY(0)}89%{opacity:.85}94%{opacity:.55}100%{opacity:0;transform:rotate(-42deg)translateY(130px)}}
        @keyframes nowPulse{0%,100%{box-shadow:0 0 0 0 rgba(212,168,67,.18)}50%{box-shadow:0 0 0 5px rgba(212,168,67,.06)}}
      `}</style>

      {/* ══ HERO ════════════════════════════════════════════════════ */}
      <div style={{borderRadius:22,overflow:'hidden',marginBottom:14,height:196,position:'relative',background:P.bg,boxShadow:'0 10px 48px rgba(4,8,20,.55)'}}>

        {/* blobs */}
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',width:300,height:300,borderRadius:'50%',top:-90,left:-55,background:`radial-gradient(circle,${P.b1} 0%,transparent 68%)`,filter:'blur(30px)',animation:'hb1 9s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:250,height:250,borderRadius:'50%',bottom:-65,right:175,background:`radial-gradient(circle,${P.b2} 0%,transparent 68%)`,filter:'blur(26px)',animation:'hb2 12s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:190,height:190,borderRadius:'50%',top:8,left:'44%',background:`radial-gradient(circle,${P.b3} 0%,transparent 68%)`,filter:'blur(24px)',animation:'hb3 7s ease-in-out infinite'}}/>
        </div>

        {/* estrelas */}
        {P.stars && STARS_POS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.x,top:s.y,width:s.r*2,height:s.r*2,borderRadius:'50%',background:'rgba(255,255,255,0.88)',pointerEvents:'none',animation:`twinkle ${2.2+i*.32}s ease-in-out infinite`,animationDelay:s.d}}/>
        ))}

        {/* estrelas cadentes */}
        {P.shooting && SHOOT_POS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.x,top:s.y,width:1.5,height:55,background:'linear-gradient(to bottom,transparent 0%,rgba(255,255,255,0.78) 30%,rgba(255,255,255,0.28) 75%,transparent 100%)',borderRadius:1,pointerEvents:'none',animation:`shoot 9s ${s.delay} linear infinite`}}/>
        ))}

        {/* planeta */}
        <div style={{position:'absolute',right:24,top:'50%',transform:'translateY(-50%)',animation:'moonP 5s ease-in-out infinite',pointerEvents:'none',opacity:.9}}>
          {PLANET_MAP[P.planet]}
        </div>

        {/* botão editar banner */}
        <button onClick={openBannerModal} title="Editar banner" style={{
          position:'absolute',top:12,right:12,width:30,height:30,borderRadius:8,
          background:'rgba(255,255,255,0.10)',border:'1px solid rgba(255,255,255,0.18)',
          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          color:'rgba(255,255,255,0.7)',zIndex:2,outline:'none',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>

        {/* conteúdo */}
        <div style={{position:'relative',zIndex:1,padding:'26px 30px',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            {/* avatar clicável */}
            <div onClick={openPhotoModal} title="Editar foto" style={{
              width:68,height:68,borderRadius:'50%',flexShrink:0,cursor:'pointer',
              background: photo ? undefined : 'rgba(255,255,255,0.92)',
              ...avatarStyle,
              display: photo ? 'block' : 'flex',
              alignItems:'center',justifyContent:'center',
              fontSize:22,fontWeight:700,color:T.blue,
              border:'2.5px solid rgba(255,255,255,0.45)',
              boxShadow:'0 0 0 5px rgba(255,255,255,0.08),0 0 0 10px rgba(255,255,255,0.04),0 6px 24px rgba(0,0,0,0.30)',
              position:'relative',overflow:'hidden',
            }}>
              {!photo && USER.avatar}
              {/* edit overlay */}
              <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(0,0,0,0.30)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity .18s'}}
                onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.42)',letterSpacing:'.10em',textTransform:'uppercase',marginBottom:4}}>{greeting}</div>
              <div style={{fontSize:27,fontWeight:700,color:'#fff',lineHeight:1,marginBottom:5,letterSpacing:'-.01em'}}>{USER.short}!</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.40)',textTransform:'capitalize'}}>{todayFmt}</div>
            </div>
          </div>
          <StarDivider my={0} dim/>
        </div>
      </div>

      {/* ══ TIRA: SALÁRIO · TROFÉUS · NOW PLAYING ════════════════════ */}
      <div style={{display:'grid',gridTemplateColumns:isPlaying&&nowPlaying?'1fr 1fr 1.4fr':'1fr 1fr',gap:12,marginBottom:14}}>

        {/* Salário */}
        <Card style={{padding:'14px 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:'rgba(40,168,112,.10)',border:'1px solid rgba(40,168,112,.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'#28A870',fontWeight:700,fontSize:16}}>$</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:T.textT}}>Último Salário</div>
              <div style={{fontSize:17,fontWeight:700,color:T.text,marginTop:2}}>{sv?`R$ ${USER.salary.toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'R$ ••••,••'}</div>
            </div>
            <button onClick={()=>setSv(!sv)} style={{background:'none',border:'none',cursor:'pointer',color:sv?T.gold:T.textD,padding:3,flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                {sv?<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>:<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></>}
              </svg>
            </button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5,marginTop:8}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#28A870'}}/>
            <span style={{fontSize:11,color:'#28A870'}}>Pagamento em dia</span>
          </div>
        </Card>

        {/* Troféus */}
        <Card style={{padding:'14px 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:T.goldGl,border:`1px solid ${T.gold}22`,display:'flex',alignItems:'center',justifyContent:'center',color:T.gold}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:T.textT}}>Troféus</div>
              <div style={{fontSize:17,fontWeight:700,color:T.text,marginTop:2}}>{USER.trophies.length}</div>
            </div>
            <BtnVer tab="conquistas" label="Ver"/>
          </div>
          <div style={{display:'flex',gap:4,marginTop:8,minHeight:18}}>
            {USER.trophies.length>0 ? USER.trophies.slice(0,5).map((t,i)=><span key={i} style={{fontSize:14}}>{t.icon}</span>)
              : <span style={{fontSize:11,color:T.textT}}>Nenhum troféu ainda</span>}
          </div>
        </Card>

        {/* Now playing */}
        {isPlaying && nowPlaying && (
          <Card style={{padding:'14px 18px',animation:'nowPulse 2.5s ease-in-out infinite'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {nowPlaying.album_art
                ? <img src={nowPlaying.album_art} alt="" style={{width:38,height:38,borderRadius:8,objectFit:'cover',flexShrink:0}}/>
                : <div style={{width:38,height:38,borderRadius:8,background:T.goldGl,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🎵</div>
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:T.gold,fontWeight:600,letterSpacing:'.06em',marginBottom:2}}>▶ TOCANDO</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nowPlaying.title}</div>
                <div style={{fontSize:11,color:T.textT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nowPlaying.artist}</div>
              </div>
              {onGoAlexa && <BtnVer onClick={onGoAlexa} label="Abrir"/>}
            </div>
          </Card>
        )}
      </div>

      {/* ══ ACESSO RÁPIDO: ALEXA (se nada tocando) ═══════════════════ */}
      {(!isPlaying || !nowPlaying) && onGoAlexa && (
        <div onClick={onGoAlexa} style={{
          display:'flex',alignItems:'center',gap:14,padding:'13px 18px',marginBottom:14,
          background:T.goldGl,border:`1px solid ${T.gold}33`,borderRadius:14,cursor:'pointer',
          transition:'opacity .15s',
        }}
          onMouseEnter={e=>e.currentTarget.style.opacity='.8'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <div style={{width:36,height:36,borderRadius:10,background:`${T.gold}22`,border:`1px solid ${T.gold}33`,display:'flex',alignItems:'center',justifyContent:'center',color:T.gold,flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>Central Alexa</div>
            <div style={{fontSize:11,color:T.textT}}>Festival · Música · Biblioteca</div>
          </div>
          <span style={{fontSize:13,color:T.gold}}>→</span>
        </div>
      )}

      {/* ══ WIDGETS (2×2 compactos) ══════════════════════════════════ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:8}}>

        {/* My Uniko */}
        <Card style={{padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>My Uniko</span>
            <BtnVer tab="uniko"/>
          </div>
          <div style={{display:'flex',gap:11,alignItems:'center',marginBottom:12}}>
            <div style={{width:48,height:48,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`2px solid ${uS.c}55`,boxShadow:`0 0 0 4px ${uS.c}18`}}>
              <img src={SKINS[skin]||SKINS.tecnico} alt="Uniko" style={{width:'100%',height:'100%',objectFit:'cover',filter:dormindo?'brightness(.7) saturate(.5)':'none',transition:'filter .4s'}}/>
            </div>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                <span style={{fontSize:15}}>{uS.e}</span>
                <span style={{fontSize:12,fontWeight:700,color:uS.c}}>{uS.l}</span>
              </div>
              <div style={{fontSize:10.5,color:T.textT}}>{uS.s}</div>
            </div>
          </div>
          <StarDivider my={8} dim/>
          {[{l:'Fome',v:fome},{l:'Energia',v:energia},{l:'Sono',v:sono}].map(({l,v})=>(
            <div key={l} style={{marginBottom:7}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:10.5,color:T.textS}}>{l}</span>
                <span style={{fontSize:10.5,fontWeight:700,color:barCol(v)}}>{Math.round(v)}%</span>
              </div>
              <div style={{height:4,background:'rgba(0,0,0,0.07)',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${v}%`,borderRadius:999,background:`linear-gradient(90deg,${barCol(v)},${barCol(v)}88)`,transition:'width .4s ease'}}/>
              </div>
            </div>
          ))}
        </Card>

        {/* Eventos Hoje */}
        <Card style={{padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>Eventos Hoje</span>
            <BtnVer tab="eventos"/>
          </div>
          {todayEvts.length===0
            ? <EmptyW icon={<IcoSVG size={28} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>} text="Nenhum evento hoje" sub="Aproveite o dia!"/>
            : todayEvts.slice(0,3).map(ev=>(
              <div key={ev.id} style={{display:'flex',gap:10,padding:'8px 10px',borderRadius:9,marginBottom:7,background:T.surface,border:`1px solid ${T.border}`}}>
                <div style={{width:32,height:32,borderRadius:7,background:T.goldGl,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <IcoSVG size={12} stroke={T.gold} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.title}</div>
                  <div style={{fontSize:10.5,color:T.textT,marginTop:1}}>{ev.event_time?`◷ ${fmtTime(ev.event_time)}`:'Dia todo'}</div>
                </div>
              </div>
            ))
          }
        </Card>

        {/* Próximos Lembretes */}
        <Card style={{padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>Lembretes</span>
            <BtnVer tab="lembretes"/>
          </div>
          {upcoming.length===0
            ? <EmptyW icon={<IcoSVG size={28} d={<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>}/>} text="Nenhum lembrete próximo" sub="Crie em Meus Lembretes"/>
            : upcoming.map((r,i)=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,paddingTop:i===0?0:8,paddingBottom:i<upcoming.length-1?8:0,borderBottom:i<upcoming.length-1?`1px solid ${T.border}`:'none'}}>
                <div style={{background:T.goldGl,border:`1px solid ${T.gold}28`,borderRadius:7,padding:'4px 8px',flexShrink:0,minWidth:42,textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.gold,lineHeight:1}}>{fmtTime(r.time)}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</div>
                  <div style={{fontSize:10,color:T.textT,marginTop:1}}>
                    {r.repeat!=='never' ? ({daily:'Diário',weekly:'Semanal',monthly:'Mensal'}[r.repeat]||r.repeat)
                      : r.date&&r.date!==today ? fmtDS(r.date) : 'Hoje'}
                  </div>
                </div>
              </div>
            ))
          }
        </Card>

        {/* Avisos RH */}
        <Card style={{padding:'16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>Avisos do RH</span>
            <BtnVer tab="comunicados"/>
          </div>
          {comuns.length===0
            ? <EmptyW icon={<IcoSVG size={28} d={<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>}/>} text="Nenhum aviso recente"/>
            : comuns.slice(0,3).map((c,i)=>(
              <div key={c.id} style={{padding:'8px 10px',borderRadius:9,marginBottom:i<comuns.length-1?7:0,background:c.urgent?'rgba(192,64,80,.05)':T.surface,border:`1px solid ${c.urgent?'rgba(192,64,80,.22)':T.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:c.body?2:0}}>
                  {c.urgent&&<span style={{fontSize:11}}>🚨</span>}
                  <div style={{fontSize:12,fontWeight:600,color:c.urgent?'#C04050':T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                  <span style={{fontSize:10,color:T.textT,flexShrink:0}}>{new Date(c.created_at).toLocaleDateString('pt-BR',{day:'numeric',month:'short'})}</span>
                </div>
                {c.body&&<div style={{fontSize:11,color:T.textS,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.body}</div>}
              </div>
            ))
          }
        </Card>

      </div>

      {/* ══ MODAL: EDITAR FOTO ════════════════════════════════════════ */}
      {showPhoto && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,backdropFilter:'blur(6px)'}}>
          <div style={{background:T.surface,borderRadius:20,padding:28,width:360,boxShadow:'0 20px 60px rgba(0,0,0,.35)',border:`1px solid ${T.border}`}}>
            <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:20}}>Editar Foto de Perfil</div>

            {/* preview */}
            <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
              <div style={{
                width:100,height:100,borderRadius:'50%',overflow:'hidden',cursor:'pointer',
                background:tmpPhoto?undefined:'rgba(0,0,0,0.08)',
                backgroundImage:tmpPhoto?`url(${tmpPhoto})`:undefined,
                backgroundSize:`${tmpScale}%`,
                backgroundPosition:`${tmpPos.x}% ${tmpPos.y}%`,
                backgroundRepeat:'no-repeat',
                border:`3px solid ${T.gold}44`,
                display:tmpPhoto?'block':'flex',alignItems:'center',justifyContent:'center',
                fontSize:32,color:T.textD,
              }} onClick={()=>fileRef.current?.click()}>
                {!tmpPhoto && '📷'}
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{display:'none'}}/>
            <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'9px',borderRadius:9,border:`1.5px dashed ${T.border}`,background:'transparent',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)',marginBottom:16}}>
              {tmpPhoto ? '↑ Trocar imagem' : '↑ Escolher imagem'}
            </button>

            {tmpPhoto && (<>
              {[{label:'Posição horizontal',key:'x',min:0,max:100},{label:'Posição vertical',key:'y',min:0,max:100}].map(sl=>(
                <div key={sl.key} style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:T.textS,marginBottom:4}}>{sl.label}</div>
                  <input type="range" min={sl.min} max={sl.max} value={tmpPos[sl.key]}
                    onChange={e=>setTmpPos(p=>({...p,[sl.key]:Number(e.target.value)}))}
                    style={{width:'100%',accentColor:T.gold}}/>
                </div>
              ))}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:T.textS,marginBottom:4}}>Zoom ({tmpScale}%)</div>
                <input type="range" min={100} max={220} value={tmpScale}
                  onChange={e=>setTmpScale(Number(e.target.value))}
                  style={{width:'100%',accentColor:T.gold}}/>
              </div>
            </>)}

            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowPhoto(false)} style={{flex:1,padding:'10px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)'}}>Cancelar</button>
              <button onClick={savePhoto} style={{flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.gold}cc)`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)'}}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: EDITAR BANNER ══════════════════════════════════════ */}
      {showBanner && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,backdropFilter:'blur(6px)'}}>
          <div style={{background:T.surface,borderRadius:20,padding:28,width:400,boxShadow:'0 20px 60px rgba(0,0,0,.35)',border:`1px solid ${T.border}`}}>
            <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>Tema do Banner</div>
            <div style={{fontSize:13,color:T.textT,marginBottom:20}}>Escolha o visual do seu painel</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {Object.values(PRESETS).map(p=>(
                <div key={p.id} onClick={()=>setTmpPreset(p.id)} style={{
                  borderRadius:14,overflow:'hidden',cursor:'pointer',
                  border:`2.5px solid ${tmpPreset===p.id?T.gold:'transparent'}`,
                  transition:'border-color .15s',
                  boxShadow:tmpPreset===p.id?`0 0 0 2px ${T.gold}44`:'none',
                }}>
                  {/* mini preview */}
                  <div style={{height:64,background:p.bg,position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',width:80,height:80,borderRadius:'50%',top:-20,left:-20,background:`radial-gradient(circle,${p.b1} 0%,transparent 70%)`,filter:'blur(12px)'}}/>
                    <div style={{position:'absolute',width:60,height:60,borderRadius:'50%',bottom:-15,right:30,background:`radial-gradient(circle,${p.b2} 0%,transparent 70%)`,filter:'blur(10px)'}}/>
                    <div style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',opacity:.8,transform:'translateY(-50%) scale(0.38)',transformOrigin:'right center'}}>
                      {PLANET_MAP[p.planet]}
                    </div>
                  </div>
                  <div style={{padding:'8px 10px',background:T.page}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text}}>{p.emoji} {p.name}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowBanner(false)} style={{flex:1,padding:'10px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)'}}>Cancelar</button>
              <button onClick={saveBanner} style={{flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.gold}cc)`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)'}}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export { TabInicio };
