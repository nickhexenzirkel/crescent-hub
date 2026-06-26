import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, getAuthUser, saveUserPhoto } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';
import { PRISMA_MISSIONS, loadMissionProgress } from '../../../shared/prismaMissions';
import dokoTecnico    from '../../../assets/DodocoTecnico.jpg';
import dokoCozinheiro from '../../../assets/DodocoCozinheiro.jpg';
import dokoMedico     from '../../../assets/DodocoMedico.jpg';
import dokoAmbiental  from '../../../assets/DodocoAmbientalista.jpg';
import dokoContador   from '../../../assets/DodocoContador.jpg';
import unikoWave      from '../../../assets/UnikoWave.png';
import unikoKpop      from '../../../assets/UnikoKPOP.png';
import unikoMpb       from '../../../assets/UnikoMPB.png';
import unikoRock      from '../../../assets/UnikoRock.png';
import unikoRap       from '../../../assets/UnikoRap.png';
import unikoPop       from '../../../assets/UnikoPop.png';
import unikoCowboy    from '../../../assets/UnikoCowboy.png';
import unikoGospel    from '../../../assets/UnikoGospel.png';
import unikoColumbina from '../../../assets/UnikoColumbina.png';
import { DOKO_KEY }   from './TabMyDoko';

/* ── Helpers ──────────────────────────────────────────────────────── */
const SKINS  = {
  tecnico:dokoTecnico, cozinheiro:dokoCozinheiro, medico:dokoMedico, ambiental:dokoAmbiental, contador:dokoContador,
  wave:unikoWave, kpop:unikoKpop, mpb:unikoMpb, rock:unikoRock, rap:unikoRap,
  pop:unikoPop, cowboy:unikoCowboy, gospel:unikoGospel, columbina:unikoColumbina,
};
const _auth  = getAuthUser();
const PHK    = _auth?.cpf ? `uniko_photo_${_auth.cpf}`      : 'uniko_photo';
const PHPK   = _auth?.cpf ? `uniko_photo_pos_${_auth.cpf}`  : 'uniko_photo_pos';
const PHSK   = _auth?.cpf ? `uniko_photo_scale_${_auth.cpf}`: 'uniko_photo_scale';

const loadLS = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const barCol = v => v >= 60 ? '#28A870' : v >= 30 ? '#E8A020' : '#C04050';
const fmtT   = t => { if (!t) return ''; const [h,m]=t.split(':'); return `${+h}:${m}`; };
const fmtDS  = d => { if (!d) return ''; return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}); };

/* ── Banner por tema (auto-sync) ─────────────────────────────────── */
const TB = {
  blue:       {bg:'linear-gradient(135deg,#07111E,#0B1C38,#101E3C,#152840)', b1:'#2A6DB552',b2:'#D4A84322',b3:'#5A3CB440', p1:'#6AAEF5',p2:'#1A50A8',p3:'#0D3070', rings:true,  spot:false, shooting:true },
  blueDark:   {bg:'linear-gradient(135deg,#030D18,#06152A,#0A1C34,#0E2240)', b1:'#4A9FE855',b2:'#6BB8FF22',b3:'#3030A040', p1:'#6BB8FF',p2:'#2A60C8',p3:'#0A2A78', rings:true,  spot:false, shooting:true },
  purple:     {bg:'linear-gradient(135deg,#0C0818,#180C2C,#1C1038,#100828)', b1:'#8B5FE855',b2:'#5A3CB425',b3:'#3A1A7840', p1:'#C090FF',p2:'#7B40D8',p3:'#4A1A90', rings:false, spot:true,  shooting:true },
  purpleDark: {bg:'linear-gradient(135deg,#080614,#100920,#160C2A,#0C0618)', b1:'#9B6FE858',b2:'#B890FF25',b3:'#4A20A040', p1:'#D0A8FF',p2:'#9B60E8',p3:'#5A2AAA', rings:false, spot:true,  shooting:true },
  pink:       {bg:'linear-gradient(135deg,#150620,#260A2E,#350D3E,#1A0824)', b1:'#D040A855',b2:'#FF6B9D28',b3:'#7B1A8B40', p1:'#FFE4F0',p2:'#ECA0C8',p3:'#B04888', rings:false, spot:false, shooting:true },
  pinkDark:   {bg:'linear-gradient(135deg,#110418,#200824,#2C0A30,#16041E)', b1:'#E860A858',b2:'#FF88C825',b3:'#8B2A8840', p1:'#FFB8E0',p2:'#E860A8',p3:'#9A2070', rings:false, spot:false, shooting:true },
  red:        {bg:'linear-gradient(135deg,#1E0608,#300A0E,#3C0C10,#280810)', b1:'#C0203252',b2:'#FF405025',b3:'#8B101838', p1:'#FF9090',p2:'#D03040',p3:'#8A1020', rings:false, spot:true,  shooting:true },
  green:      {bg:'linear-gradient(135deg,#041610,#08261A,#0C2E1E,#062018)', b1:'#28A87050',b2:'#52CC8824',b3:'#1A6A4038', p1:'#50D898',p2:'#1A9060',p3:'#084430', rings:false, spot:true,  shooting:false},
  greenDark:  {bg:'linear-gradient(135deg,#021008,#061A10,#0A2216,#04180E)', b1:'#28C87858',b2:'#50E89825',b3:'#1A8A5040', p1:'#70E8B0',p2:'#28C878',p3:'#0A6038', rings:false, spot:true,  shooting:false},
  redDark:    {bg:'linear-gradient(135deg,#120404,#1E0608,#28080A,#160405)', b1:'#E8405058',b2:'#FF687825',b3:'#AA201838', p1:'#FFB0B8',p2:'#E84050',p3:'#AA1828', rings:false, spot:true,  shooting:true },
  orange:     {bg:'linear-gradient(135deg,#171000,#291A00,#362200,#1E1400)', b1:'#D4A84352',b2:'#F5C84224',b3:'#8B650038', p1:'#F7D880',p2:'#C89020',p3:'#7A4E00', rings:true,  spot:false, shooting:false},
  orangeDark: {bg:'linear-gradient(135deg,#100A00,#1E1400,#281A00,#160E00)', b1:'#E88820',  b2:'#FFA84025',b3:'#AA6A1038', p1:'#FFB840',p2:'#D88020',p3:'#8A4A00', rings:true,  spot:false, shooting:false},
};
const getBanner = theme => TB[theme] || TB.blue;

/* ── Planeta dinâmico ────────────────────────────────────────────── */
const Planet = ({ p1, p2, p3, rings, spot }) => {
  const id = `pg_${p1.replace('#','')}`;
  return (
    <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
      <defs>
        <radialGradient id={id} cx="38%" cy="34%" r="65%">
          <stop offset="0%" stopColor={p1}/><stop offset="50%" stopColor={p2}/><stop offset="100%" stopColor={p3}/>
        </radialGradient>
        <radialGradient id={`${id}_g`} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="transparent"/><stop offset="85%" stopColor={`${p2}18`}/><stop offset="100%" stopColor={`${p1}30`}/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill={`url(#${id}_g)`}/>
      {rings && <ellipse cx="50" cy="57" rx="47" ry="12" stroke={`${p2}45`} strokeWidth="4.5" fill="none"/>}
      <circle cx="50" cy="50" r="27" fill={`url(#${id})`}/>
      <circle cx="36" cy="40" r="8" fill={`${p1}25`}/>
      {spot && <ellipse cx="59" cy="56" rx="9" ry="5.5" fill={`${p3}60`} transform="rotate(15 59 56)"/>}
      <circle cx="42" cy="34" r="4" fill={`${p1}18`}/>
      {rings && <ellipse cx="50" cy="57" rx="47" ry="12" stroke={`${p2}20`} strokeWidth="3" fill="none" strokeDasharray="68,46"/>}
    </svg>
  );
};

const STARS_POS = [
  {x:'24%',y:'22%',r:1.8,d:'0.3s'},{x:'31%',y:'74%',r:1.4,d:'1.7s'},
  {x:'39%',y:'38%',r:2.0,d:'0.9s'},{x:'45%',y:'84%',r:1.3,d:'2.2s'},
  {x:'52%',y:'14%',r:1.7,d:'0.5s'},{x:'57%',y:'58%',r:1.5,d:'1.1s'},
  {x:'63%',y:'28%',r:1.9,d:'1.8s'},{x:'68%',y:'78%',r:1.4,d:'0.2s'},
  {x:'74%',y:'44%',r:1.6,d:'2.4s'},{x:'79%',y:'16%',r:1.2,d:'0.7s'},
  {x:'36%',y:'16%',r:1.5,d:'1.4s'},{x:'49%',y:'66%',r:1.3,d:'0.6s'},
];
/* Delays negativos = começam no meio da animação ao montar (aparecem imediatamente) */
const SHOOT_POS = [{x:'18%',y:'16%',delay:'-1.5s'},{x:'50%',y:'8%',delay:'-3.2s'},{x:'34%',y:'26%',delay:'-0.8s'}];


/* ══════════════════════════════════════════════════════════════════ */
const TabInicio = ({ setTab, onGoAlexa, activeTheme = 'blue', userPhoto: userPhotoProp, onPhotoChange, profileComplete }) => {
  const [lembs,     setLembs]     = useState([]);
  const [notas,     setNotas]     = useState([]);
  const [prismas,   setPrismas]   = useState({ comum: 0, premium: 0 });
  const [missoes,   setMissoes]   = useState([]); // missões em andamento (mais próximas de concluir)
  const [evts,      setEvts]      = useState([]);
  /* Capture Uniko! (função futura) — posição de spawn aleatória só pro visual por enquanto */
  const [captureSpot] = useState(() => ({ left: 14 + Math.random() * 60, top: 24 + Math.random() * 38 }));
  const [comuns,    setComuns]    = useState([]);
  /* Usa a MESMA DOKO_KEY exportada pelo TabMyDoko — garante chave idêntica */
  const readDoko = () => {
    try {
      const data = JSON.parse(localStorage.getItem(DOKO_KEY) || '{}');
      if (!data.lastUpdated) return data;
      const elapsed = Math.max(0, Date.now() - data.lastUpdated);
      if (elapsed < 5000) return data;
      const ticks = elapsed / 8000;
      let { fome=75, energia=70, sono=70, dormindo=false } = data;
      if (dormindo) {
        fome = Math.max(0,   fome - ticks * 0.008);
        sono = Math.min(100, sono + ticks * 2.5);
      } else {
        fome    = Math.max(0, fome    - ticks * 0.025);
        energia = Math.max(0, energia - ticks * 0.025);
        sono    = Math.max(0, sono    - ticks * 0.016);
      }
      return { ...data, fome, energia, sono };
    } catch { return {}; }
  };
  const [uniko, setUniko] = useState(readDoko);
  const [nowPlay,   setNowPlay]   = useState(null);
  const [isPlay,    setIsPlay]    = useState(false);
  const [photo,     setPhoto]     = useState(() => userPhotoProp || localStorage.getItem(PHK) || null);
  const [photoPos,  setPhotoPos]  = useState(() => loadLS(PHPK,{x:50,y:50}));
  const [photoSc,   setPhotoSc]   = useState(() => loadLS(PHSK, 100));
  const [showPhoto, setShowPhoto] = useState(false);
  const [tmpPhoto,  setTmpPhoto]  = useState(null);
  const [tmpPos,    setTmpPos]    = useState({x:50,y:50});
  const [tmpSc,     setTmpSc]     = useState(100);
  const fileRef     = useRef(null);
  const dragRef     = useRef(null);   // drag state
  const previewRef  = useRef(null);   // preview da foto (wheel não-passivo p/ zoom)
  const imgAspect   = useRef(1);      // naturalHeight/naturalWidth of current photo

  const P    = getBanner(activeTheme);
  const now  = new Date();
  const hour = now.getHours();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const hhmm  = now.toTimeString().slice(0,5);
  const greeting = hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  const todayFmt = now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});

  /* ── Fetch helpers ── */
  const fetchEvts   = () => _supabase.from('calendar_events').select('*').order('event_date',{ascending:true}).then(({data})=>setEvts(data||[]));
  const fetchComuns = () => _supabase.from('comunicados').select('*').eq('active',true).order('created_at',{ascending:false}).limit(3).then(({data})=>setComuns(data||[]));
  const fetchLembs = () =>
    _supabase.from('reminders').select('*').eq('created_by', USER.name).eq('active', true)
      .then(({ data }) =>
        setLembs((data || []).filter(r =>
          (r.type === 'personal' || r.type === 'lembrete') && !String(r.time || '').startsWith('nota:')
        ))
      );
  const fetchNotas = () =>
    _supabase.from('reminders').select('*').eq('created_by', USER.name).eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) =>
        setNotas((data || []).filter(r =>
          (r.type === 'personal' || r.type === 'lembrete') && String(r.time || '').startsWith('nota:')
        ).slice(0, 4))
      );

  /* ── Fetch inicial + realtime ── */
  useEffect(() => {
    // Carteira de prismas do colaborador (Prisma Store → tabela mercado_state)
    _supabase.from('mercado_state').select('data').eq('player', USER.name).maybeSingle()
      .then(({ data }) => { const d = data?.data || {}; setPrismas({ comum: d.comum || 0, premium: d.premium || 0 }); });
    fetchLembs();
    fetchNotas();
    fetchEvts();
    fetchComuns();
    _supabase.from('player_state').select('*').eq('id',1).single()
      .then(async({data})=>{
        if(!data) return;
        setIsPlay(!!data.is_playing);
        if(data.current_song_id){
          const{data:s}=await _supabase.from('queue').select('*').eq('id',data.current_song_id).single();
          if(s) setNowPlay(s);
        }
      });

    const subEvts = _supabase.channel('inicio_evts_rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'calendar_events'}, fetchEvts)
      .subscribe();
    const subComuns = _supabase.channel('inicio_comuns_rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'comunicados'}, fetchComuns)
      .subscribe();
    const subLembs = _supabase.channel('inicio_lembs_rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'reminders'}, () => { fetchLembs(); fetchNotas(); })
      .subscribe();

    return () => {
      _supabase.removeChannel(subEvts);
      _supabase.removeChannel(subComuns);
      _supabase.removeChannel(subLembs);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* ── Uniko stats: atualiza a cada 2s (skin, fome, energia, sono) ── */
  useEffect(() => {
    setUniko(readDoko()); // lê imediatamente no mount
    const id = setInterval(() => setUniko(readDoko()), 2000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* ── Missões em andamento (Prisma Store) EM TEMPO REAL: mostra as mais próximas de concluir ── */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // Baseline de reset do usuário (admin "Zerar missões") p/ o progresso bater com a Prisma Store.
        let baseline = {};
        try {
          const { data: row } = await _supabase.from('mercado_state').select('data').eq('player', USER.name).maybeSingle();
          baseline = row?.data?.missionBaseline || {};
        } catch {}
        const prog = await loadMissionProgress({ userName: USER.name, cpf: getAuthUser?.()?.cpf, baseline });
        if (!alive) return;
        const list = PRISMA_MISSIONS
          .filter(m => !m.maintenance)
          .map(m => ({ ...m, progress: Math.min(m.goal, prog[m.id] || 0) }))
          .filter(m => m.progress > 0 && m.progress < m.goal)        // em andamento (começou e não acabou)
          .sort((a, b) => (b.progress / b.goal) - (a.progress / a.goal)) // mais perto de concluir primeiro
          .slice(0, 3);
        setMissoes(list);
      } catch {}
    };
    load();
    const id = setInterval(load, 25000); // tempo real (revalida a cada 25s)
    return () => { alive = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* ── Derived ── */
  const upcoming = [...lembs]
    .sort((a, b) => {
      const aD = a.date || '9999', bD = b.date || '9999';
      if (aD !== bD) return aD.localeCompare(bD);
      return String(a.time || '').localeCompare(String(b.time || ''));
    })
    .slice(0, 4);
  const todayEvts = evts.filter(e=>e.event_date===today);
  const { fome=75,energia=70,sono=70,dormindo=false,skin='tecnico' } = uniko;
  const avg = (fome+energia)/2;
  const uS  = dormindo?{l:'Dormindo',c:'#8B6FD4',e:'😴',s:'Recuperando sono...'}
    :(fome<25&&energia<25)?{l:'Cansado!',c:'#C04050',e:'😓',s:'Precisa de cuidados!'}
    :avg>=70?{l:'Feliz',c:'#28A870',e:'😊',s:'Pronto para interagir!'}
    :avg>=35?{l:'Neutro',c:'#E8A020',e:'😐',s:'Precisa de atenção'}
    :{l:'Triste',c:'#C04050',e:'😢',s:'Cuide dele agora!'};

  /* ── UI helpers ── */
  const BtnVer = ({tab,label='Ver →',onClick}) => (
    <button onClick={onClick||(()=>setTab(tab))} style={{background:T.goldGl,border:`1px solid ${T.gold}33`,color:T.gold,cursor:'pointer',fontSize:11,padding:'3px 10px',borderRadius:6,fontFamily:'var(--font-body)',fontWeight:600,outline:'none',flexShrink:0}}>{label}</button>
  );
  const EmptyW = ({icon,text,sub}) => (
    <div style={{textAlign:'center',padding:'16px 0',color:T.textT}}>
      <div style={{opacity:.4,marginBottom:6,display:'flex',justifyContent:'center'}}>{icon}</div>
      <div style={{fontSize:12}}>{text}</div>
      {sub&&<div style={{fontSize:11,marginTop:2,opacity:.65}}>{sub}</div>}
    </div>
  );
  const Ico = ({d,size=13,stroke=T.textT}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  );
  const avatarBg = photo ? {
    backgroundImage:`url(${photo})`, backgroundSize:`${photoSc}%`,
    backgroundPosition:`${photoPos.x}% ${photoPos.y}%`, backgroundRepeat:'no-repeat',
  } : {};

  /* ── Photo modal handlers ── */
  const openPhoto = () => { setTmpPhoto(photo); setTmpPos({...photoPos}); setTmpSc(photoSc); setShowPhoto(true); };
  const onFile = e => {
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader(); r.onload=ev=>setTmpPhoto(ev.target.result); r.readAsDataURL(f);
  };
  const savePhoto = () => {
    const applyAndCommit = (cropped) => {
      const defaultPos = {x:50, y:50};
      const defaultSc  = 100;
      setPhoto(cropped);
      saveUserPhoto(cropped);
      if (onPhotoChange) onPhotoChange(cropped);
      localStorage.setItem(PHPK, JSON.stringify(defaultPos));
      localStorage.setItem(PHSK, JSON.stringify(defaultSc));
      setPhotoPos(defaultPos); setPhotoSc(defaultSc);
      setShowPhoto(false);
    };

    if (tmpPhoto) {
      // Aplica zoom/posição via canvas para que todos vejam a mesma versão
      const img = new window.Image();
      img.onload = () => {
        const SIZE = 300;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        const renderedW = SIZE * (tmpSc / 100);
        const renderedH = renderedW * (img.naturalHeight / img.naturalWidth);
        const offsetX   = (tmpPos.x / 100) * (SIZE - renderedW);
        const offsetY   = (tmpPos.y / 100) * (SIZE - renderedH);
        ctx.drawImage(img, offsetX, offsetY, renderedW, renderedH);
        applyAndCommit(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = tmpPhoto;
    } else {
      // Só mudou posição/zoom sem trocar a foto
      localStorage.setItem(PHPK, JSON.stringify(tmpPos));
      localStorage.setItem(PHSK, JSON.stringify(tmpSc));
      setPhotoPos(tmpPos); setPhotoSc(tmpSc); setShowPhoto(false);
    }
  };

  /* Mede aspect ratio ao trocar foto */
  useEffect(() => {
    if (!tmpPhoto) return;
    const img = new window.Image();
    img.onload = () => { imgAspect.current = img.naturalHeight / img.naturalWidth; };
    img.src = tmpPhoto;
  }, [tmpPhoto]);

  /* Listeners de drag no documento enquanto modal está aberto */
  useEffect(() => {
    if (!showPhoto) return;
    const PREVIEW = 180;
    const onMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
      const sc = dragRef.current.sc;
      const spaceX = PREVIEW * (sc / 100 - 1);
      const spaceY = PREVIEW * (sc / 100 * imgAspect.current - 1);
      const nx = spaceX > 0.5 ? dragRef.current.px - (dx / spaceX) * 100 : dragRef.current.px;
      const ny = spaceY > 0.5 ? dragRef.current.py - (dy / spaceY) * 100 : dragRef.current.py;
      setTmpPos({ x: Math.max(0, Math.min(100, nx)), y: Math.max(0, Math.min(100, ny)) });
    };
    const onUp = () => { dragRef.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [showPhoto]);

  /* Zoom por scroll — listener não-passivo p/ poder usar preventDefault
     (o onWheel do React é passivo e dispara o warning do navegador) */
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !showPhoto || !tmpPhoto) return;
    const onWheel = (e) => {
      e.preventDefault();
      setTmpSc(s => Math.max(100, Math.min(300, s + (e.deltaY > 0 ? -8 : 8))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [showPhoto, tmpPhoto]);

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <style>{`
        @keyframes hb1{0%,100%{transform:translate(0,0)scale(1)}40%{transform:translate(28px,-18px)scale(1.08)}70%{transform:translate(-14px,22px)scale(.96)}}
        @keyframes hb2{0%,100%{transform:translate(0,0)scale(1)}35%{transform:translate(-26px,18px)scale(1.05)}65%{transform:translate(18px,-26px)scale(1.10)}}
        @keyframes hb3{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(12px,14px)scale(1.06)}}
        @keyframes twinkle{0%,100%{opacity:.22;transform:scale(1)}50%{opacity:.92;transform:scale(1.35)}}
        @keyframes moonP{0%,100%{opacity:.72}50%{opacity:1}}
        @keyframes shootStar{0%,33%{opacity:0;transform:translate(0,0)}38%{opacity:1;transform:translate(8px,8px)}65%{opacity:0.45;transform:translate(82px,82px)}72%,100%{opacity:0;transform:translate(108px,108px)}}
        @keyframes nowP{0%,100%{box-shadow:0 0 0 0 rgba(212,168,67,.16)}50%{box-shadow:0 0 0 5px rgba(212,168,67,.05)}}
        @keyframes capFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes capPulse{0%,100%{opacity:.55;transform:translate(-50%,-50%)scale(.92)}50%{opacity:1;transform:translate(-50%,-50%)scale(1.12)}}
        @keyframes capBorder{0%,100%{border-color:rgba(155,107,255,.30);box-shadow:0 0 0 0 rgba(155,107,255,.16)}50%{border-color:rgba(155,107,255,.85);box-shadow:0 0 0 4px rgba(155,107,255,.10)}}
        .fi .home-card{transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s ease}
        .fi .home-card:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 16px 40px rgba(0,0,0,.13);z-index:3}
      `}</style>

      {/* ══ HERO ═══════════════════════════════════════════════════ */}
      <div style={{borderRadius:22,overflow:'hidden',marginBottom:14,height:196,position:'relative',background:P.bg,boxShadow:'0 10px 48px rgba(4,8,20,.55)',transition:'background .5s ease'}}>

        {/* blobs */}
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',width:300,height:300,borderRadius:'50%',top:-90,left:-55,background:`radial-gradient(circle,${P.b1} 0%,transparent 68%)`,filter:'blur(30px)',animation:'hb1 9s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:250,height:250,borderRadius:'50%',bottom:-65,right:175,background:`radial-gradient(circle,${P.b2} 0%,transparent 68%)`,filter:'blur(26px)',animation:'hb2 12s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:190,height:190,borderRadius:'50%',top:8,left:'44%',background:`radial-gradient(circle,${P.b3} 0%,transparent 68%)`,filter:'blur(24px)',animation:'hb3 7s ease-in-out infinite'}}/>
        </div>


        {/* estrelas */}
        {STARS_POS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.x,top:s.y,width:s.r*2,height:s.r*2,borderRadius:'50%',background:'rgba(255,255,255,.88)',pointerEvents:'none',animation:`twinkle ${2.2+i*.32}s ease-in-out infinite`,animationDelay:s.d}}/>
        ))}

        {/* estrelas cadentes — wrapper translaciona, filho roda estático */}
        {P.shooting && SHOOT_POS.map((s,i)=>(
          <div key={i} style={{position:'absolute',left:s.x,top:s.y,pointerEvents:'none',animation:`shootStar 5s ${s.delay} linear infinite`}}>
            <div style={{width:58,height:1.5,background:'linear-gradient(to right,transparent,rgba(255,255,255,.88),rgba(255,255,255,.28),transparent)',borderRadius:2,transform:'rotate(45deg)',transformOrigin:'center'}}/>
          </div>
        ))}

        {/* planeta */}
        <div style={{position:'absolute',right:24,top:'50%',transform:'translateY(-50%)',animation:'moonP 5s ease-in-out infinite',pointerEvents:'none'}}>
          <Planet p1={P.p1} p2={P.p2} p3={P.p3} rings={P.rings} spot={P.spot}/>
        </div>

        {/* conteúdo */}
        <div style={{position:'relative',zIndex:1,padding:'26px 30px',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            {/* avatar */}
            <div
              onClick={profileComplete ? openPhoto : () => setTab('dados')}
              title={profileComplete ? 'Editar foto' : 'Preencha seus dados (email, endereço, etc.) para editar a foto'}
              style={{
                width:92,height:92,borderRadius:'50%',flexShrink:0,cursor:'pointer',
                background:photo?undefined:'rgba(255,255,255,.92)',
                ...avatarBg,
                display:photo?'block':'flex', alignItems:'center', justifyContent:'center',
                fontSize:28,fontWeight:700,color:T.blue,
                border:'3px solid rgba(255,255,255,.50)',
                boxShadow:'0 0 0 6px rgba(255,255,255,.10),0 0 0 12px rgba(255,255,255,.04),0 8px 28px rgba(0,0,0,.32)',
                position:'relative',overflow:'hidden',
              }}>
              {!photo && USER.avatar}
              {profileComplete
                ? <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(0,0,0,.28)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity .18s'}}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    <Ico d={<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>} stroke="white" size={14}/>
                  </div>
                : <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(0,0,0,.42)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  </div>
              }
            </div>
            <div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.40)',letterSpacing:'.10em',textTransform:'uppercase',marginBottom:4}}>{greeting}</div>
              <div style={{fontSize:27,fontWeight:700,color:'#fff',lineHeight:1,marginBottom:5,letterSpacing:'-.01em'}}>{USER.short}!</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,.38)',textTransform:'capitalize'}}>{todayFmt}</div>
            </div>
          </div>
          <StarDivider my={0} dim/>
        </div>
      </div>

      {/* ══ TIRA: UNIKO WAVE · MISSÕES · PRISMA STORE · NOW PLAYING ══ */}
      <div style={{display:'grid',gridTemplateColumns:(isPlay&&nowPlay)?'1fr 1fr 1fr 1.4fr':'1fr 1fr 1fr',gap:12,marginBottom:14}}>
        {/* Uniko Wave */}
        <Card className="home-card" style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setTab('unikowave')}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,borderRadius:11,overflow:'hidden',flexShrink:0,boxShadow:'0 4px 14px rgba(155,107,255,.35)'}}>
              <img src={unikoWave} alt="Uniko Wave" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:'#9B6BFF',fontWeight:700,letterSpacing:'.06em'}}>RITMO</div>
              <div style={{fontSize:15,fontWeight:700,color:T.text,lineHeight:1.1}}>Uniko Wave</div>
              <div style={{fontSize:10.5,color:T.textT,marginTop:2}}>Jogue e ganhe prismas</div>
            </div>
            <span style={{width:30,height:30,borderRadius:'50%',background:'rgba(155,107,255,.14)',border:'1px solid rgba(155,107,255,.3)',color:'#9B6BFF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>▶</span>
          </div>
        </Card>

        {/* Missões em andamento (Prisma Store) — tempo real, mais próximas de concluir */}
        <Card className="home-card" style={{padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>Missões em andamento</span>
            <span style={{fontSize:10,color:'#9B6BFF',fontWeight:700,letterSpacing:'.04em'}}>PRISMA</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {missoes.length===0
              ? <div style={{fontSize:11,color:T.textT,textAlign:'center',padding:'10px 0'}}>Nenhuma missão em andamento</div>
              : missoes.map(m=>{
                  const col = m.premium ? '#9B6BFF' : '#27C6DE';
                  const pct = Math.min(100, Math.round((m.progress/m.goal)*100));
                  return (
                    <div key={m.id}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3,gap:8}}>
                        <span style={{fontSize:11.5,fontWeight:500,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title}</span>
                        <span style={{fontSize:10.5,fontWeight:700,color:col,flexShrink:0}}>{m.progress}/{m.goal}</span>
                      </div>
                      <div style={{height:5,background:'rgba(0,0,0,.07)',borderRadius:999,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,borderRadius:999,background:`linear-gradient(90deg,${col},${col}99)`,transition:'width .4s ease'}}/>
                      </div>
                    </div>
                  );
                })}
          </div>
        </Card>

        {/* Prisma Store (carteira) */}
        <Card className="home-card" style={{padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>Prisma Store</span>
            <span style={{fontSize:10.5,color:T.textT}}>Sua carteira</span>
          </div>
          <div style={{display:'flex',gap:9}}>
            {[{k:'comum',src:'/PrismaComum.png',label:'Comum',col:'#27C6DE',v:prismas.comum},
              {k:'premium',src:'/PrismaPremium.png',label:'Premium',col:'#9B6BFF',v:prismas.premium}].map(p=>(
              <div key={p.k} style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:10,background:T.surface,border:`1px solid ${T.border}`}}>
                <img src={p.src} alt={p.label} onError={e=>{e.target.style.display='none';}} style={{width:26,height:26,objectFit:'contain',flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:p.col,lineHeight:1}}>{(p.v||0).toLocaleString('pt-BR')}</div>
                  <div style={{fontSize:9.5,color:T.textT,marginTop:1}}>{p.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {isPlay&&nowPlay&&(
          <Card className="home-card" style={{padding:'14px 18px',animation:'nowP 2.5s ease-in-out infinite'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {nowPlay.album_art
                ?<img src={nowPlay.album_art} alt="" style={{width:38,height:38,borderRadius:8,objectFit:'cover',flexShrink:0}}/>
                :<div style={{width:38,height:38,borderRadius:8,background:T.goldGl,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🎵</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:T.gold,fontWeight:600,letterSpacing:'.06em',marginBottom:2}}>▶ TOCANDO</div>
                <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nowPlay.title}</div>
                <div style={{fontSize:11,color:T.textT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nowPlay.artist}</div>
              </div>
              {onGoAlexa&&<BtnVer onClick={onGoAlexa} label="Abrir"/>}
            </div>
          </Card>
        )}
      </div>

      {/* ══ CAPTURE UNIKO! (função futura — só visual por enquanto) ═════ */}
      <div className="home-card" style={{position:'relative',height:118,borderRadius:16,overflow:'hidden',marginBottom:14,background:T.surface,border:'1.5px solid rgba(155,107,255,.30)',boxShadow:T.sh,animation:'capBorder 2.2s ease-in-out infinite'}}>
        {/* selo "em breve" */}
        <div style={{position:'absolute',top:10,right:12,fontSize:9.5,fontWeight:700,letterSpacing:'.08em',color:'#9B6BFF',background:'rgba(155,107,255,.12)',border:'1px solid rgba(155,107,255,.3)',padding:'3px 9px',borderRadius:999,zIndex:2}}>EM BREVE</div>

        {/* texto */}
        <div style={{position:'absolute',left:20,top:'50%',transform:'translateY(-50%)',zIndex:2,maxWidth:'58%'}}>
          <div style={{fontSize:11,color:'#9B6BFF',fontWeight:700,letterSpacing:'.08em',marginBottom:3}}>✦ MINIGAME</div>
          <div style={{fontSize:19,fontWeight:800,color:T.text,lineHeight:1.05,marginBottom:4}}>Capture o Uniko!</div>
          <div style={{fontSize:11.5,color:T.textT,lineHeight:1.4}}>De vez em quando um Uniko vai aparecer aqui — clique pra capturar e ganhar prismas.</div>
        </div>

        {/* Uniko que vai spawnar (posição aleatória; aqui só fantasma/placeholder) */}
        <div title="Em breve você vai capturar o Uniko aqui!" style={{position:'absolute',left:`${captureSpot.left}%`,top:`${captureSpot.top}%`,zIndex:1,pointerEvents:'none'}}>
          {/* halo do ponto de spawn */}
          <div style={{position:'absolute',left:'50%',top:'50%',width:74,height:74,transform:'translate(-50%,-50%)',borderRadius:'50%',border:'1.5px dashed rgba(192,168,255,.45)',animation:'capPulse 2.6s ease-in-out infinite'}}/>
          <img src={unikoPop} alt="Uniko" style={{position:'relative',width:58,height:58,borderRadius:'50%',objectFit:'cover',opacity:.55,filter:'grayscale(.25) drop-shadow(0 4px 12px rgba(155,107,255,.5))',animation:'capFloat 3.4s ease-in-out infinite'}}/>
        </div>
      </div>

      {/* ══ ACESSO ALEXA (quando não está tocando) ═════════════════ */}
      {(!isPlay||!nowPlay)&&onGoAlexa&&(
        <div onClick={onGoAlexa} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 18px',marginBottom:14,background:T.goldGl,border:`1px solid ${T.gold}33`,borderRadius:14,cursor:'pointer',transition:'opacity .15s'}}
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

      {/* ══ WIDGETS — 4 numa linha (My Uniko · Eventos · Lembretes · Avisos) ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:8,alignItems:'stretch'}}>

        {/* My Uniko */}
        <Card className="home-card" style={{padding:'12px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
            <span style={{fontSize:12.5,fontWeight:600,color:T.text}}>My Uniko</span>
            <BtnVer tab="uniko"/>
          </div>
          <div style={{display:'flex',gap:9,alignItems:'center',marginBottom:9}}>
            <div style={{width:38,height:38,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`2px solid ${uS.c}55`,boxShadow:`0 0 0 3px ${uS.c}18`}}>
              <img src={SKINS[skin]||SKINS.tecnico} alt="Uniko" style={{width:'100%',height:'100%',objectFit:'cover',filter:dormindo?'brightness(.7) saturate(.5)':'none',transition:'filter .4s'}}/>
            </div>
            <div style={{minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                <span style={{fontSize:13}}>{uS.e}</span>
                <span style={{fontSize:11.5,fontWeight:700,color:uS.c}}>{uS.l}</span>
              </div>
              <div style={{fontSize:10,color:T.textT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{uS.s}</div>
            </div>
          </div>
          <StarDivider my={6} dim/>
          {[{l:'Fome',v:fome},{l:'Energia',v:energia},{l:'Sono',v:sono}].map(({l,v})=>(
            <div key={l} style={{marginBottom:5}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                <span style={{fontSize:10,color:T.textS}}>{l}</span>
                <span style={{fontSize:10,fontWeight:700,color:barCol(v)}}>{Math.round(v)}%</span>
              </div>
              <div style={{height:4,background:'rgba(0,0,0,.07)',borderRadius:999,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${v}%`,borderRadius:999,background:`linear-gradient(90deg,${barCol(v)},${barCol(v)}88)`,transition:'width .4s ease'}}/>
              </div>
            </div>
          ))}
        </Card>

        {/* Eventos Hoje */}
        <Card className="home-card" style={{padding:'12px',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
            <span style={{fontSize:12.5,fontWeight:600,color:T.text}}>Eventos Hoje</span>
            <BtnVer tab="eventos"/>
          </div>
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:todayEvts.length===0?'center':'flex-start'}}>
          {todayEvts.length===0
            ?<EmptyW icon={<Ico size={26} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>} text="Nenhum evento hoje" sub="Aproveite o dia!"/>
            :todayEvts.slice(0,3).map(ev=>(
              <div key={ev.id} style={{display:'flex',gap:8,padding:'6px 8px',borderRadius:8,marginBottom:6,background:T.surface,border:`1px solid ${T.border}`}}>
                <div style={{width:26,height:26,borderRadius:6,background:T.goldGl,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Ico size={11} stroke={T.gold} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11.5,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.title}</div>
                  <div style={{fontSize:10,color:T.textT,marginTop:1}}>{ev.event_time?`◷ ${fmtT(ev.event_time)}`:'Dia todo'}</div>
                </div>
              </div>
            ))
          }
          </div>
        </Card>

        {/* Próximos Lembretes */}
        <Card className="home-card" style={{padding:'12px',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
            <span style={{fontSize:12.5,fontWeight:600,color:T.text}}>Lembretes</span>
            <BtnVer tab="lembretes"/>
          </div>
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:upcoming.length===0?'center':'flex-start'}}>
          {upcoming.length===0
            ?<EmptyW icon={<Ico size={26} d={<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>}/>} text="Nenhum lembrete próximo" sub="Crie em Meus Lembretes"/>
            :upcoming.slice(0,3).map((r,i,arr)=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,paddingTop:i===0?0:6,paddingBottom:i<arr.length-1?6:0,borderBottom:i<arr.length-1?`1px solid ${T.border}`:'none'}}>
                <div style={{background:T.goldGl,border:`1px solid ${T.gold}28`,borderRadius:6,padding:'3px 6px',flexShrink:0,minWidth:38,textAlign:'center'}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:T.gold,lineHeight:1}}>{fmtT(r.time)}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11.5,fontWeight:500,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</div>
                  <div style={{fontSize:9.5,color:T.textT,marginTop:1}}>
                    {r.repeat!=='never'?({daily:'Diário',weekly:'Semanal',monthly:'Mensal'}[r.repeat]||r.repeat)
                      :r.date&&r.date!==today?fmtDS(r.date):'Hoje'}
                  </div>
                </div>
              </div>
            ))
          }
          </div>
        </Card>

        {/* Avisos RH */}
        <Card className="home-card" style={{padding:'12px',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
            <span style={{fontSize:12.5,fontWeight:600,color:T.text}}>Avisos do RH</span>
            <BtnVer tab="comunicados"/>
          </div>
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:comuns.length===0?'center':'flex-start'}}>
          {comuns.length===0
            ?<EmptyW icon={<Ico size={26} d={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>}/>} text="Nenhum aviso recente"/>
            :comuns.slice(0,3).map((c,i,arr)=>(
              <div key={c.id} style={{padding:'6px 8px',borderRadius:8,marginBottom:i<arr.length-1?6:0,background:c.urgent?'rgba(192,64,80,.05)':T.surface,border:`1px solid ${c.urgent?'rgba(192,64,80,.22)':T.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:c.body?2:0}}>
                  {c.urgent&&<span style={{fontSize:10}}>🚨</span>}
                  <div style={{fontSize:11.5,fontWeight:600,color:c.urgent?'#C04050':T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                  <span style={{fontSize:9.5,color:T.textT,flexShrink:0}}>{new Date(c.created_at).toLocaleDateString('pt-BR',{day:'numeric',month:'short'})}</span>
                </div>
                {c.body&&<div style={{fontSize:10.5,color:T.textS,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.body}</div>}
              </div>
            ))
          }
          </div>
        </Card>
      </div>

      {/* ══ WIDGET ANOTAÇÕES ═══════════════════════════════════════ */}
      {notas.length > 0 && (
        <Card className="home-card" style={{padding:'16px',marginTop:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:T.text,display:'flex',alignItems:'center',gap:6}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Anotações Recentes
            </span>
            <BtnVer tab="lembretes"/>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {notas.slice(0,3).map(n=>{
              const dotColors={default:'#AAB8C4',amber:'#C8960A',blue:'#2A6FB5',green:'#1A9060',red:'#C02030',purple:'#7040C8'};
              const dot = dotColors[n.time||'default']||'#AAB8C4';
              const bgMap={default:'transparent',amber:'rgba(255,200,50,0.08)',blue:'rgba(50,130,255,0.07)',green:'rgba(40,180,100,0.07)',red:'rgba(200,50,50,0.07)',purple:'rgba(120,70,220,0.08)'};
              const bg  = bgMap[n.time||'default']||'transparent';
              return(
                <div key={n.id} style={{display:'flex',gap:10,padding:'10px 12px',borderRadius:10,background:bg,border:`1px solid ${T.border}`}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0,marginTop:5}}/>
                  <div style={{flex:1,minWidth:0}}>
                    {n.title&&n.title!=='Anotação'&&<div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:2}}>{n.title}</div>}
                    <div style={{fontSize:12,color:T.textS,lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{n.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ══ MODAL: FOTO DE PERFIL ═══════════════════════════════════ */}
      {showPhoto&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.62)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,backdropFilter:'blur(6px)'}}>
          <div style={{background:T.surface,borderRadius:20,padding:28,width:380,boxShadow:'0 20px 60px rgba(0,0,0,.35)',border:`1px solid ${T.border}`}}>
            <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:6}}>Editar Foto de Perfil</div>
            {tmpPhoto&&<div style={{fontSize:11,color:T.textT,marginBottom:18}}>
              Arraste para mover · Scroll para zoom
            </div>}
            {!tmpPhoto&&<div style={{height:10}}/>}

            {/* Preview com drag */}
            <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
              <div
                ref={previewRef}
                onMouseDown={e=>{
                  if (!tmpPhoto) return;
                  e.preventDefault();
                  dragRef.current = { sx:e.clientX, sy:e.clientY, px:tmpPos.x, py:tmpPos.y, sc:tmpSc, moved:false };
                }}
                style={{
                  width:180,height:180,borderRadius:'50%',overflow:'hidden',
                  cursor: tmpPhoto ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
                  background:tmpPhoto?undefined:'rgba(0,0,0,.08)',
                  backgroundImage:tmpPhoto?`url(${tmpPhoto})`:undefined,
                  backgroundSize:`${tmpSc}%`,backgroundPosition:`${tmpPos.x}% ${tmpPos.y}%`,
                  backgroundRepeat:'no-repeat',
                  border:`3px solid ${T.gold}44`,
                  userSelect:'none', WebkitUserSelect:'none',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:40,color:T.textD,
                }}>
                {!tmpPhoto&&(
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.4" strokeLinecap="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{display:'none'}}/>
            <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'9px',borderRadius:9,border:`1.5px dashed ${T.border}`,background:'transparent',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)',marginBottom:16}}>
              {tmpPhoto?'↑ Trocar imagem':'↑ Escolher imagem'}
            </button>

            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowPhoto(false)} style={{flex:1,padding:'10px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)'}}>Cancelar</button>
              <button onClick={savePhoto} style={{flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.gold}cc)`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)'}}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { TabInicio };
