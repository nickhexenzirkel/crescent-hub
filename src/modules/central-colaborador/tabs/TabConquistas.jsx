import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, SERVER_URL, getAuthUser, fetchPhotoByName } from '../../../contexts/user';
import { Card, StarDivider, SHead, AvatarCircle } from '../../../shared/components';

const TrophyIco = ({size=16, stroke='currentColor'}) => (
  <Ico size={size} stroke={stroke} d={<><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>}/>
);
const MEDAL_COLORS = ['#D89030','#8A9BB0','#B07040'];

const RANK_CFG = [
  // 1º - Estelar
  { bg:'linear-gradient(135deg,#2a1800 0%,#4a2e00 55%,#1a0e00 100%)', border:'#D89030', text:'#ffe8c0', count:'#F4C55A', medalBg:'linear-gradient(135deg,#D89030,#F4C55A)', ring:'#D89030' },
  // 2º - Nebula
  { bg:'linear-gradient(135deg,#1a0f3a 0%,#2a1f5a 55%,#1f152e 100%)', border:'#4A9FE8', text:'#e8d8ff', count:'#4A9FE8', medalBg:'linear-gradient(135deg,#8A9BB0,#b8c8d8)', ring:'#4A9FE8' },
  // 3º - Supernova
  { bg:'linear-gradient(135deg,#1e0c40 0%,#2d1654 45%,#0d0520 100%)', border:'#9B6FE8', text:'#f0e8ff', count:'#D89030', medalBg:'linear-gradient(135deg,#B07040,#d4904a)', ring:'#9B6FE8' },
];

const RankBg = ({ idx }) => {
  const s = { position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' };
  if (idx === 0) return (
    // Estelar
    <svg viewBox="0 0 200 220" preserveAspectRatio="xMidYMid slice" style={s}>
      <defs>
        <radialGradient id="rk-est-gl" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#D89030" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#D89030" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="80" rx="75" ry="70" fill="url(#rk-est-gl)"/>
      <path d="M100,15 L106,42 L128,22 L114,46 L142,46 L118,62 L138,88 L108,74 L108,108 L100,82 L92,108 L92,74 L62,88 L82,62 L58,46 L86,46 L72,22 L94,42 Z" fill="#D89030" opacity="0.07"/>
      <circle cx="28" cy="28" r="2" fill="#F4C55A" opacity="0.55"/>
      <circle cx="168" cy="22" r="1.5" fill="#F4C55A" opacity="0.5"/>
      <circle cx="182" cy="80" r="1" fill="#D89030" opacity="0.65"/>
      <circle cx="18" cy="135" r="1.5" fill="#F4C55A" opacity="0.4"/>
      <circle cx="178" cy="172" r="2" fill="#D89030" opacity="0.5"/>
      <circle cx="42" cy="192" r="1" fill="#F4C55A" opacity="0.55"/>
      <circle cx="155" cy="150" r="1" fill="#D89030" opacity="0.4"/>
      <path d="M155,52 L157.2,58 L163,60 L157.2,62 L155,68 L152.8,62 L147,60 L152.8,58 Z" fill="#F4C55A" opacity="0.55"/>
      <path d="M38,72 L39.8,76.5 L44,78 L39.8,79.5 L38,84 L36.2,79.5 L32,78 L36.2,76.5 Z" fill="#D89030" opacity="0.5"/>
      <path d="M170,120 L171.5,124 L175,125.5 L171.5,127 L170,131 L168.5,127 L165,125.5 L168.5,124 Z" fill="#F4C55A" opacity="0.4"/>
      <circle cx="32" cy="28" r="11" fill="#E8C050" opacity="0.22"/>
      <circle cx="38" cy="24" r="9" fill="#060200" opacity="0.9"/>
      <path d="M100,195 Q128,178 134,152 Q140,126 122,106 Q104,86 82,98" fill="none" stroke="#D89030" strokeWidth="1.2" opacity="0.18" strokeLinecap="round"/>
    </svg>
  );
  if (idx === 1) return (
    // Nebula
    <svg viewBox="0 0 200 220" preserveAspectRatio="xMidYMid slice" style={s}>
      <defs>
        <radialGradient id="rk-nb-o1" cx="35%" cy="38%" r="45%">
          <stop offset="0%" stopColor="#4A9FE8" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#4A9FE8" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="rk-nb-o2" cx="68%" cy="62%" r="40%">
          <stop offset="0%" stopColor="#E87FC5" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#E87FC5" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="70" cy="84" rx="65" ry="65" fill="url(#rk-nb-o1)"/>
      <ellipse cx="136" cy="136" rx="55" ry="55" fill="url(#rk-nb-o2)"/>
      <circle cx="24" cy="18" r="1.5" fill="#C8D8F0" opacity="0.8"/>
      <circle cx="82" cy="8" r="1" fill="#E8E0FF" opacity="0.7"/>
      <circle cx="172" cy="14" r="1.5" fill="#C8D8F0" opacity="0.6"/>
      <circle cx="188" cy="52" r="1" fill="#E8E0FF" opacity="0.55"/>
      <circle cx="8" cy="92" r="1.5" fill="#C8D8F0" opacity="0.5"/>
      <circle cx="192" cy="132" r="1" fill="#E8E0FF" opacity="0.6"/>
      <circle cx="28" cy="188" r="1.5" fill="#C8D8F0" opacity="0.4"/>
      <circle cx="172" cy="202" r="1" fill="#E8E0FF" opacity="0.5"/>
      <circle cx="145" cy="52" r="1" fill="#C8D8F0" opacity="0.5"/>
      <circle cx="58" cy="172" r="1.5" fill="#E8E0FF" opacity="0.45"/>
      <path d="M100,195 Q132,175 142,145 Q152,115 130,88 Q108,62 78,72 Q48,82 54,114" fill="none" stroke="#4A9FE8" strokeWidth="1.2" opacity="0.28" strokeLinecap="round"/>
      <path d="M58,28 Q36,62 48,96 Q60,130 94,142 Q128,154 145,122" fill="none" stroke="#E87FC5" strokeWidth="1" opacity="0.22" strokeLinecap="round"/>
      <path d="M158,38 L159.8,43.5 L165,45.5 L159.8,47.5 L158,53 L156.2,47.5 L151,45.5 L156.2,43.5 Z" fill="#C8D8F0" opacity="0.5"/>
      <path d="M28,142 L29.5,146 L33.5,147.5 L29.5,149 L28,153 L26.5,149 L22.5,147.5 L26.5,146 Z" fill="#E87FC5" opacity="0.45"/>
    </svg>
  );
  return (
    // Supernova
    <svg viewBox="0 0 200 220" preserveAspectRatio="xMidYMid slice" style={s}>
      <defs>
        <radialGradient id="rk-sn-gl" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#9B6FE8" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#9B6FE8" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="rk-sn-tr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D89030" stopOpacity="0"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0.85"/>
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="50" rx="90" ry="80" fill="url(#rk-sn-gl)"/>
      <circle cx="18" cy="22" r="1.5" fill="#D89030" opacity="0.9"/>
      <circle cx="42" cy="10" r="1" fill="#fff" opacity="0.7"/>
      <circle cx="162" cy="18" r="1.5" fill="#9B6FE8" opacity="0.8"/>
      <circle cx="185" cy="42" r="1" fill="#4A9FE8" opacity="0.7"/>
      <circle cx="172" cy="82" r="2" fill="#D89030" opacity="0.6"/>
      <circle cx="8" cy="105" r="1.5" fill="#9B6FE8" opacity="0.5"/>
      <circle cx="192" cy="145" r="1" fill="#fff" opacity="0.6"/>
      <circle cx="22" cy="182" r="1.5" fill="#4A9FE8" opacity="0.5"/>
      <circle cx="178" cy="198" r="1" fill="#D89030" opacity="0.7"/>
      <circle cx="55" cy="155" r="1" fill="#fff" opacity="0.4"/>
      <circle cx="145" cy="170" r="1.5" fill="#4A9FE8" opacity="0.5"/>
      <line x1="28" y1="33" x2="126" y2="96" stroke="url(#rk-sn-tr)" strokeWidth="1.5" opacity="0.75"/>
      <line x1="30" y1="31" x2="128" y2="94" stroke="url(#rk-sn-tr)" strokeWidth="0.5" opacity="0.35"/>
      <circle cx="126" cy="96" r="2.5" fill="#fff" opacity="0.9"/>
      <circle cx="168" cy="32" r="12" fill="#C8B0F0" opacity="0.25"/>
      <circle cx="175" cy="28" r="9.5" fill="#050012" opacity="0.95"/>
      <ellipse cx="100" cy="118" rx="60" ry="20" fill="none" stroke="#9B6FE8" strokeWidth="0.8" opacity="0.22" strokeDasharray="5 3"/>
    </svg>
  );
};

const TROPHY_TYPES = [
  { id:'nebula',    label:'Troféu Nebula',    img:'/TroféuNebula.png',    color:'#4A9FE8' },
  { id:'estelar',   label:'Troféu Estelar',   img:'/TroféuEstelar.png',   color:'#D89030' },
  { id:'supernova', label:'Troféu Supernova', img:'/TroféuSupernova.png', color:'#9B6FE8' },
];

const Ico = ({ d, size=16, stroke='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const TrophyCard = ({ trophy, highlighted, onClick }) => {
  const def = TROPHY_TYPES.find(x => x.id === trophy.type) || TROPHY_TYPES[0];
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        borderRadius:14, border:`2px solid ${(highlighted||hov) ? T.goldLine+'88' : T.border}`,
        background: highlighted ? T.goldGl : (T.dark ? T.surface : '#fff'),
        padding:'20px 16px', cursor: onClick ? 'pointer' : 'default',
        display:'flex', flexDirection:'column', alignItems:'center', gap:10,
        transition:'all .15s', boxShadow: hov ? T.shM : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}>
      <img src={def.img} alt={def.label}
        onError={e => { e.target.onerror=null; e.target.style.opacity='0'; }}
        style={{ width:110, height:110, objectFit:'contain' }}/>
      <div style={{ textAlign:'center', width:'100%' }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {trophy.description}
        </div>
        <div style={{ fontSize:11, color:T.textT, marginBottom:3 }}>
          {trophy.created_at ? new Date(trophy.created_at).toLocaleDateString('pt-BR') : '—'}
        </div>
        <div style={{ fontSize:11, color:T.textS }}>De: {trophy.from_name}</div>
        {onClick && (
          <div style={{ fontSize:11, color:T.gold, marginTop:6, fontWeight:500 }}>
            Clique para ver detalhes →
          </div>
        )}
      </div>
    </div>
  );
};

const TabConquistas = () => {
  const [myTrophies,  setMyTrophies]  = useState([]);
  const [allTrophies, setAllTrophies] = useState({});   // name → array
  const [employees,   setEmployees]   = useState([]);
  const [photos,      setPhotos]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [viewing,     setViewing]     = useState(null); // employee being viewed
  const [detail,      setDetail]      = useState(null); // single trophy detail modal
  const [myRank,      setMyRank]      = useState(null);

  const authHeader = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('ch_token')||''}` });

  useEffect(() => {
    const load = async () => {
      const [empRes, trophyRes] = await Promise.all([
        fetch(`${SERVER_URL}/api/team`, { headers: authHeader() }).then(r => r.json()).catch(() => ({ employees:[] })),
        _supabase.from('trophies').select('*').order('created_at', { ascending:false }),
      ]);

      const emps = (empRes.employees || []).filter(e => e.active !== false);
      setEmployees(emps);

      const all = trophyRes.data || [];
      // group by to_name
      const grouped = {};
      all.forEach(t => { (grouped[t.to_name] = grouped[t.to_name] || []).push(t); });
      setAllTrophies(grouped);
      setMyTrophies(grouped[USER.name] || []);

      // ranking position
      const sorted = Object.entries(grouped).sort((a,b) => b[1].length - a[1].length);
      const rank = sorted.findIndex(([n]) => n === USER.name);
      setMyRank(rank >= 0 ? rank + 1 : null);

      // load photos for top employees (all)
      const names = emps.map(e => e.name);
      const photoArr = await Promise.all(names.map(async n => [n, await fetchPhotoByName(n)]));
      setPhotos(Object.fromEntries(photoArr.filter(([,p]) => p)));

      setLoading(false);
    };
    load();
  }, []);

  // ranking global: todos que têm troféus + funcionários sem troféus
  const rankingAll = employees
    .map(e => ({ ...e, count: (allTrophies[e.name] || []).length }))
    .sort((a, b) => b.count - a.count);

  const top3    = rankingAll.slice(0, 3);
  const filtered = rankingAll.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  /* ── DETAIL MODAL ─────────────────────────────────────────── */
  if (detail) {
    const def = TROPHY_TYPES.find(x => x.id === detail.type) || TROPHY_TYPES[0];
    return (
      <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)',
        backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center',
        padding:20 }} onClick={() => setDetail(null)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: T.dark ? T.surface : '#fff', borderRadius:20, padding:'32px',
          maxWidth:400, width:'100%', boxShadow:'0 24px 64px rgba(0,0,0,0.30)',
          border:`1px solid ${T.border}`, textAlign:'center',
        }}>
          <img src={def.img} alt={def.label}
            onError={e => { e.target.onerror=null; e.target.style.opacity='0'; }}
            style={{ width:100, height:100, objectFit:'contain', marginBottom:16 }}/>
          <div style={{ fontSize:17, fontWeight:700, color:T.text, marginBottom:6 }}>{detail.description}</div>
          <div style={{ fontSize:12, color:def.color, fontWeight:600, marginBottom:12 }}>{def.label}</div>
          {detail.message && (
            <div style={{ fontSize:13, color:T.textS, lineHeight:1.6, fontStyle:'italic',
              marginBottom:12, padding:'10px 14px', background:T.goldGl, borderRadius:10,
              border:`1px solid ${T.goldLine}22` }}>
              "{detail.message}"
            </div>
          )}
          <div style={{ fontSize:12, color:T.textT }}>
            De <strong style={{ color:T.text }}>{detail.from_name}</strong> · {detail.created_at ? new Date(detail.created_at).toLocaleDateString('pt-BR') : '—'}
          </div>
          <button onClick={() => setDetail(null)} style={{
            marginTop:20, padding:'9px 28px', borderRadius:9, border:`1px solid ${T.border}`,
            background:'transparent', cursor:'pointer', fontFamily:'var(--font-body)',
            fontSize:13, color:T.textS }}>Fechar</button>
        </div>
      </div>
    );
  }

  /* ── VIEWING EMPLOYEE'S TROPHIES ──────────────────────────── */
  if (viewing) {
    const empTrophies = allTrophies[viewing.name] || [];
    return (
      <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
        <button onClick={() => setViewing(null)}
          style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
            cursor:'pointer', color:T.textS, fontSize:13, padding:'0 0 18px',
            fontFamily:'var(--font-body)' }}>
          <Ico size={14} d={<polyline points="15 18 9 12 15 6"/>}/> Voltar para Conquistas
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:22 }}>
          <AvatarCircle name={viewing.name} photo={photos[viewing.name]} size={52} fontSize={18} style={{ boxShadow:`0 0 0 4px rgba(0,0,0,0.10)` }}/>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:T.text }}>Troféus Conquistados</div>
            <div style={{ fontSize:13, color:T.textT, marginTop:2 }}>
              {viewing.name} · {empTrophies.length} troféu{empTrophies.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {empTrophies.length === 0 ? (
          <Card style={{ padding:'40px', textAlign:'center' }} elevated>
            <div style={{ marginBottom:14, display:'flex', justifyContent:'center' }}><TrophyIco size={44} stroke={T.textD}/></div>
            <div style={{ fontSize:14, color:T.textT }}>Nenhum troféu ainda</div>
          </Card>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
            {empTrophies.map((t, i) => (
              <TrophyCard key={i} trophy={t} highlighted={i===0} onClick={() => setDetail(t)}/>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── MAIN VIEW ────────────────────────────────────────────── */
  return (
    <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
        <SHead sub="Troféus e reconhecimentos da equipe">Conquistas</SHead>
        {myRank && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
            borderRadius:8, background:T.goldGl, border:`1px solid ${T.goldLine}33`, marginTop:4 }}>
            <span style={{ fontSize:12, color:T.textS }}>Sua posição:</span>
            <span style={{ fontSize:12, fontWeight:700, color:T.gold }}>#{myRank}</span>
            <TrophyIco size={13} stroke={T.gold}/>
            <span style={{ fontSize:12, fontWeight:700, color:T.gold }}>{myTrophies.length}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:T.textT }}>
          <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${T.gold}`,
            borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 12px' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Carregando conquistas...
        </div>
      ) : (
        <>
          {/* Top 3 Ranking */}
          {top3.length > 0 && (
            <Card style={{ padding:'22px 24px', marginBottom:18,
              background:`linear-gradient(135deg,${T.goldGl},${T.dark?T.surface:'#fff'} 70%)`,
              border:`1px solid ${T.goldLine}33` }} elevated>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <TrophyIco size={17} stroke={T.gold}/>
                <span style={{ fontSize:15, fontWeight:700, color:T.text }}>Top 3 Ranking</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {[0,1,2].map(idx => {
                  const emp = top3[idx];
                  if (!emp) return <div key={idx}/>;
                  const cfg = RANK_CFG[idx];
                  const isFirst = idx === 0;
                  return (
                    <div key={emp.name} style={{ textAlign:'center', padding:'16px 8px',
                      borderRadius:14, background: cfg.bg,
                      border:`1px solid ${cfg.border}44`,
                      position:'relative', overflow:'hidden' }}>
                      <RankBg idx={idx}/>
                      <div style={{ position:'relative', zIndex:1 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background: cfg.medalBg,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          margin:'0 auto 8px', fontSize:13, fontWeight:700, color:'white',
                          boxShadow:'0 2px 8px rgba(0,0,0,0.4)' }}>
                          {idx+1}
                        </div>
                        <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
                          <AvatarCircle name={emp.name} photo={photos[emp.name]} size={isFirst?52:44} fontSize={isFirst?18:15} style={{ boxShadow:`0 0 0 ${isFirst?4:3}px ${cfg.ring}66` }}/>
                        </div>
                        <div style={{ fontSize:12, fontWeight:600, color:cfg.text, lineHeight:1.3,
                          overflow:'hidden', textOverflow:'ellipsis',
                          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                          {emp.name}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontSize:11, color:cfg.count, fontWeight:700, marginTop:4 }}>
                          <TrophyIco size={12} stroke={cfg.count}/> {emp.count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Search */}
          <div style={{ position:'relative', marginBottom:14 }}>
            <Ico size={14} stroke={T.textD} d={<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}
              style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              style={{ width:'100%', paddingLeft:38, paddingRight:14, paddingTop:10, paddingBottom:10,
                border:`1.5px solid ${T.border}`, borderRadius:11, fontFamily:'var(--font-body)',
                fontSize:13, color:T.text,
                background: T.dark ? 'rgba(255,255,255,0.05)' : '#fff',
                outline:'none', boxSizing:'border-box' }}/>
          </div>

          {/* Employee grid — máximo 5 colunas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14 }}>
            {filtered.map((emp, i) => {
              const rank = rankingAll.findIndex(e => e.name === emp.name) + 1;
              const isMe = emp.name === USER.name;
              return (
                <div key={emp.id || emp.name} style={{
                  borderRadius:18, border:`1.5px solid ${isMe ? T.goldLine+'55' : T.border}`,
                  background: isMe ? T.goldGl : (T.dark ? T.surface : '#fff'),
                  padding:'26px 18px 20px', position:'relative',
                }}>
                  {/* Rank badge */}
                  <div style={{ position:'absolute', top:12, right:14,
                    width:28, height:28, borderRadius:'50%', fontSize:12, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: rank===1?'#D89030':rank===2?'#8A9BB0':rank===3?'#B07040':T.surfaceSub||'rgba(0,0,0,0.07)',
                    color: rank<=3?'white':T.textD }}>
                    {rank}
                  </div>

                  <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                    <AvatarCircle name={emp.name} photo={photos[emp.name]} size={76} fontSize={24} style={{ boxShadow:`0 0 0 4px rgba(0,0,0,0.10)` }}/>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:T.text, lineHeight:1.35, marginBottom:4,
                      overflow:'hidden', textOverflow:'ellipsis',
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                      {emp.name}
                    </div>
                    <div style={{ fontSize:12, color:T.textT, marginBottom:12,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {emp.cargo || emp.role || 'Colaborador'}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:14, fontWeight:700, color:T.gold, marginBottom:14 }}>
                      <TrophyIco size={14} stroke={T.gold}/> {emp.count} troféu{emp.count !== 1 ? 's' : ''}
                    </div>
                    <button onClick={() => setViewing(emp)}
                      style={{ width:'100%', padding:'10px', borderRadius:10,
                        border:`1.5px solid ${T.goldLine}44`,
                        background: T.goldGl, color:T.gold, fontWeight:600,
                        fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                      <TrophyIco size={14} stroke={T.gold}/> Ver Conquistas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export { TabConquistas };
