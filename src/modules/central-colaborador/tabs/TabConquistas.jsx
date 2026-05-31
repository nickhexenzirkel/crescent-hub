import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, SERVER_URL, getAuthUser, fetchPhotoByName } from '../../../contexts/user';
import { Card, StarDivider, SHead, AvatarCircle } from '../../../shared/components';

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
        style={{ width:80, height:80, objectFit:'contain' }}/>
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
        fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() }).then(r => r.json()).catch(() => ({ employees:[] })),
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
          <AvatarCircle name={viewing.name} photo={photos[viewing.name]} size={52} fontSize={18}/>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:T.text }}>Troféus Conquistados</div>
            <div style={{ fontSize:13, color:T.textT, marginTop:2 }}>
              {viewing.name} · {empTrophies.length} troféu{empTrophies.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {empTrophies.length === 0 ? (
          <Card style={{ padding:'40px', textAlign:'center' }} elevated>
            <div style={{ fontSize:36, marginBottom:12 }}>🏆</div>
            <div style={{ fontSize:14, color:T.textT }}>Nenhum troféu ainda</div>
          </Card>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14 }}>
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
            <span style={{ fontSize:12 }}>🏆</span>
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
                <span style={{ fontSize:16 }}>🏆</span>
                <span style={{ fontSize:15, fontWeight:700, color:T.text }}>Top 3 Ranking</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {[1,0,2].map(idx => {
                  const emp = top3[idx];
                  if (!emp) return <div key={idx}/>;
                  const medals = ['🥇','🥈','🥉'];
                  const isFirst = idx === 0;
                  return (
                    <div key={emp.name} style={{ textAlign:'center', padding:'16px 8px',
                      borderRadius:14, background: isFirst ? T.goldGl : 'transparent',
                      border:`1px solid ${isFirst ? T.goldLine+'44' : 'transparent'}` }}>
                      <div style={{ fontSize:22, marginBottom:8 }}>{medals[idx]}</div>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
                        <AvatarCircle name={emp.name} photo={photos[emp.name]} size={isFirst?52:44} fontSize={isFirst?18:15}/>
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:T.text, lineHeight:1.3,
                        overflow:'hidden', textOverflow:'ellipsis',
                        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                        {emp.name}
                      </div>
                      <div style={{ fontSize:11, color:T.gold, fontWeight:700, marginTop:4 }}>
                        🏆 {emp.count}
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

          {/* Employee grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
            {filtered.map((emp, i) => {
              const rank = rankingAll.findIndex(e => e.name === emp.name) + 1;
              const isMe = emp.name === USER.name;
              return (
                <div key={emp.id || emp.name} style={{
                  borderRadius:16, border:`1.5px solid ${isMe ? T.goldLine+'55' : T.border}`,
                  background: isMe ? T.goldGl : (T.dark ? T.surface : '#fff'),
                  padding:'20px 16px', position:'relative',
                }}>
                  {/* Rank badge */}
                  <div style={{ position:'absolute', top:10, right:12,
                    width:24, height:24, borderRadius:'50%', fontSize:11, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: rank===1?'#D89030':rank===2?'#8A9BB0':rank===3?'#B07040':T.surfaceSub||'rgba(0,0,0,0.07)',
                    color: rank<=3?'white':T.textD }}>
                    {rank<=3 ? ['🥇','🥈','🥉'][rank-1] : rank}
                  </div>

                  <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                    <AvatarCircle name={emp.name} photo={photos[emp.name]} size={58} fontSize={20}/>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.35, marginBottom:3,
                      overflow:'hidden', textOverflow:'ellipsis',
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                      {emp.name}
                    </div>
                    <div style={{ fontSize:11, color:T.textT, marginBottom:10,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {emp.cargo || emp.role || 'Colaborador'}
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.gold, marginBottom:12 }}>
                      🏆 {emp.count} troféu{emp.count !== 1 ? 's' : ''}
                    </div>
                    <button onClick={() => setViewing(emp)}
                      style={{ width:'100%', padding:'8px', borderRadius:9,
                        border:`1.5px solid ${T.goldLine}44`,
                        background: T.goldGl, color:T.gold, fontWeight:600,
                        fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                      <span style={{ fontSize:13 }}>🏆</span> Ver Conquistas
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
