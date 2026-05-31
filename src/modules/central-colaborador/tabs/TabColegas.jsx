import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, SERVER_URL, getAuthUser, fetchPhotoByName } from '../../../contexts/user';
import { Card, StarDivider, SHead, AvatarCircle } from '../../../shared/components';
import dokoTecnico    from '../../../assets/DodocoTecnico.jpg';
import dokoCozinheiro from '../../../assets/DodocoCozinheiro.jpg';
import dokoMedico     from '../../../assets/DodocoMedico.jpg';
import dokoAmbiental  from '../../../assets/DodocoAmbientalista.jpg';
import dokoContador   from '../../../assets/DodocoContador.jpg';

const DOKO_IMG = { tecnico:dokoTecnico, cozinheiro:dokoCozinheiro, medico:dokoMedico, ambiental:dokoAmbiental, contador:dokoContador };
const DOKO_LABEL = { tecnico:'Técnico', cozinheiro:'Cozinheiro', medico:'Médico', ambiental:'Ambientalista', contador:'Contador' };

const TROPHY_TYPES = [
  { id:'nebula',    label:'Troféu Nebula',    img:'/TrofeuNebula.png',    color:'#4A9FE8', adminOnly:false },
  { id:'estelar',   label:'Troféu Estelar',   img:'/TrofeuEstelar.png',   color:'#D89030', adminOnly:true  },
  { id:'supernova', label:'Troféu Supernova', img:'/TrofeuSupernova.png', color:'#C04050', adminOnly:true  },
];

const Ico = ({ d, size=16, stroke='currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const StatBar = ({ label, value=0, color }) => (
  <div style={{ marginBottom:8 }}>
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
      <span style={{ fontSize:11, color:T.textT }}>{label}</span>
      <span style={{ fontSize:11, fontWeight:600, color }}>{value}%</span>
    </div>
    <div style={{ height:5, borderRadius:99, background:T.border, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${value}%`, borderRadius:99, background:color, transition:'width .4s' }}/>
    </div>
  </div>
);

const TabColegas = () => {
  const auth     = getAuthUser();
  const isAdmin  = auth?.role === 'admin';

  const [employees,   setEmployees]  = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [photos,      setPhotos]     = useState({});
  const [trophies,    setTrophies]   = useState({});
  const [dokoStates,  setDokoStates] = useState({});
  const [selected,    setSelected]   = useState(null);
  const [search,      setSearch]     = useState('');

  /* gift state */
  const [showGift,    setShowGift]   = useState(false);
  const [giftType,    setGiftType]   = useState('nebula');
  const [giftDesc,    setGiftDesc]   = useState('');
  const [giftMsg,     setGiftMsg]    = useState('');
  const [gifting,     setGifting]    = useState(false);
  const [giftResult,  setGiftResult] = useState('');
  const [monthlyUsed, setMonthly]    = useState(0);

  const authHeader = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('ch_token')||''}` });

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() });
      const d = await r.json();
      const list = (d.employees || []).filter(e => e.active !== false && e.name !== USER.name);
      setEmployees(list);

      const names = list.map(e => e.name);
      if (!names.length) { setLoading(false); return; }

      const [photoRes, trophyRes, dokoRes] = await Promise.all([
        Promise.all(names.map(async n => [n, await fetchPhotoByName(n)])),
        _supabase.from('trophies').select('*').in('to_name', names).order('created_at', { ascending:false }),
        _supabase.from('doko_states').select('*').in('employee_name', names),
      ]);

      setPhotos(Object.fromEntries(photoRes.filter(([,p]) => p)));

      const tmap = {};
      (trophyRes.data || []).forEach(t => { (tmap[t.to_name] = tmap[t.to_name] || []).push(t); });
      setTrophies(tmap);

      const dmap = {};
      (dokoRes.data || []).forEach(d => { dmap[d.employee_name] = d; });
      setDokoStates(dmap);
    } catch {}
    setLoading(false);
  };

  const checkMonthly = async () => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const { data } = await _supabase.from('trophies').select('id')
      .eq('from_name', USER.name).eq('type', 'nebula').gte('created_at', start.toISOString());
    setMonthly((data||[]).length);
  };

  const openGift = async () => {
    setGiftType(isAdmin ? 'nebula' : 'nebula');
    setGiftDesc(''); setGiftMsg(''); setGiftResult('');
    await checkMonthly();
    setShowGift(true);
  };

  const sendTrophy = async () => {
    if (!giftDesc.trim()) { setGiftResult('⚠️ A descrição é obrigatória.'); return; }
    if (!isAdmin && giftType === 'nebula' && monthlyUsed >= 3) {
      setGiftResult('⚠️ Você já usou seus 3 Troféus Nebula deste mês.'); return;
    }
    setGifting(true); setGiftResult('');
    try {
      const { error } = await _supabase.from('trophies').insert({
        from_name: USER.name, to_name: selected.name,
        type: giftType, description: giftDesc.trim(),
        message: giftMsg.trim() || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setGiftResult('✅ Troféu presenteado com sucesso!');
      if (giftType === 'nebula') setMonthly(m => m + 1);
      setTrophies(prev => ({
        ...prev,
        [selected.name]: [
          { from_name:USER.name, to_name:selected.name, type:giftType, description:giftDesc, message:giftMsg, created_at:new Date().toISOString() },
          ...(prev[selected.name] || []),
        ],
      }));
      setGiftDesc(''); setGiftMsg('');
    } catch (e) { setGiftResult('❌ Erro: ' + (e.message || 'tente novamente')); }
    setGifting(false);
  };

  useEffect(() => { load(); }, []);

  const availTrophies = TROPHY_TYPES.filter(t => isAdmin || !t.adminOnly);
  const remaining = Math.max(0, 3 - monthlyUsed);

  /* ── PROFILE VIEW ─────────────────────────────────────────── */
  if (selected) {
    const emp    = selected;
    const photo  = photos[emp.name];
    const emTrophy = trophies[emp.name] || [];
    const doko   = dokoStates[emp.name];
    const skin   = doko?.skin || 'tecnico';

    return (
      <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
        {/* Back */}
        <button onClick={() => { setSelected(null); setShowGift(false); }}
          style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
            cursor:'pointer', color:T.textS, fontSize:13, fontFamily:'var(--font-body)',
            padding:'0 0 18px', marginBottom:0 }}>
          <Ico size={14} d={<polyline points="15 18 9 12 15 6"/>}/> Voltar para Colegas
        </button>

        {/* Header card */}
        <Card style={{ padding:'24px 26px', marginBottom:14 }} elevated>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <AvatarCircle name={emp.name} photo={photo} size={72} fontSize={24}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:20, fontWeight:700, color:T.text }}>{emp.name}</div>
              <div style={{ fontSize:13, color:T.textT, marginTop:3 }}>{emp.cargo || emp.role || 'Colaborador'}</div>
              {emp.admission && <div style={{ fontSize:12, color:T.textD, marginTop:4 }}>Admissão: {emp.admission}</div>}
            </div>
            {!showGift && (
              <button onClick={openGift} style={{
                display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
                borderRadius:11, border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                color:'white', fontWeight:700, fontSize:13, fontFamily:'var(--font-body)',
                boxShadow:`0 4px 16px ${T.goldLine}44`,
              }}>
                🏆 Presentear Troféu
              </button>
            )}
          </div>
        </Card>

        {/* Gift panel */}
        {showGift && (
          <Card style={{ padding:'24px 26px', marginBottom:14, border:`1.5px solid ${T.goldLine}44` }} elevated>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:T.text }}>Presentear Troféu</div>
              <button onClick={() => setShowGift(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:T.textD, padding:4 }}>
                <Ico size={16} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}/>
              </button>
            </div>

            {/* Limite mensal */}
            {!isAdmin && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                borderRadius:10, marginBottom:16,
                background: remaining === 0 ? 'rgba(192,64,80,0.07)' : T.goldGl,
                border:`1px solid ${remaining === 0 ? 'rgba(192,64,80,0.25)' : T.goldLine+'33'}` }}>
                <span style={{ fontSize:16 }}>{remaining === 0 ? '🚫' : '🎁'}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color: remaining === 0 ? '#C04050' : T.gold }}>
                    {remaining === 0 ? 'Limite mensal atingido' : `${remaining} de 3 Troféus Nebula disponíveis`}
                  </div>
                  <div style={{ fontSize:11, color:T.textT, marginTop:1 }}>Renova no início do próximo mês</div>
                </div>
              </div>
            )}

            {/* Seleção de troféu */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:T.textD, textTransform:'uppercase',
                letterSpacing:'.07em', display:'block', marginBottom:10 }}>Troféu</label>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {availTrophies.map(t => {
                  const active = giftType === t.id;
                  const disabled = !isAdmin && t.id === 'nebula' && remaining === 0;
                  return (
                    <button key={t.id} onClick={() => !disabled && setGiftType(t.id)}
                      disabled={disabled}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                        padding:'14px 18px', borderRadius:13, cursor: disabled ? 'not-allowed' : 'pointer',
                        border:`2px solid ${active ? t.color+'88' : T.border}`,
                        background: active ? `${t.color}10` : 'transparent',
                        opacity: disabled ? 0.4 : 1, transition:'all .15s', outline:'none' }}>
                      <img src={t.img} alt={t.label}
                        onError={e => { e.target.onerror=null; e.target.style.display='none'; }}
                        style={{ width:56, height:56, objectFit:'contain' }}/>
                      <span style={{ fontSize:11, fontWeight: active ? 700 : 500,
                        color: active ? t.color : T.textS }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Descrição obrigatória */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:T.textD, textTransform:'uppercase',
                letterSpacing:'.07em', display:'block', marginBottom:7 }}>
                Motivo <span style={{ color:'#C04050' }}>*</span>
              </label>
              <textarea value={giftDesc} onChange={e => { setGiftDesc(e.target.value); setGiftResult(''); }}
                placeholder="Por que você está presenteando este troféu?"
                rows={3}
                style={{ width:'100%', background: T.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border:`1.5px solid ${T.border}`, borderRadius:10, padding:'12px',
                  color:T.text, fontFamily:'var(--font-body)', fontSize:13,
                  outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box',
                  transition:'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = T.goldLine}
                onBlur={e  => e.target.style.borderColor = T.border}/>
            </div>

            {/* Mensagem opcional */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:T.textD, textTransform:'uppercase',
                letterSpacing:'.07em', display:'block', marginBottom:7 }}>
                Mensagem adicional <span style={{ color:T.textD, fontWeight:400 }}>(opcional)</span>
              </label>
              <textarea value={giftMsg} onChange={e => setGiftMsg(e.target.value)}
                placeholder="Uma mensagem especial para o colega..."
                rows={2}
                style={{ width:'100%', background: T.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border:`1.5px solid ${T.border}`, borderRadius:10, padding:'12px',
                  color:T.text, fontFamily:'var(--font-body)', fontSize:13,
                  outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box',
                  transition:'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = T.goldLine}
                onBlur={e  => e.target.style.borderColor = T.border}/>
            </div>

            {giftResult && (
              <div style={{ padding:'9px 14px', borderRadius:9, marginBottom:12, fontSize:12,
                background: giftResult.startsWith('✅') ? 'rgba(40,168,112,0.08)' : 'rgba(192,64,80,0.06)',
                border:`1px solid ${giftResult.startsWith('✅') ? 'rgba(40,168,112,0.25)' : 'rgba(192,64,80,0.22)'}`,
                color: giftResult.startsWith('✅') ? '#28A870' : '#C04050' }}>
                {giftResult}
              </div>
            )}

            <button onClick={sendTrophy}
              disabled={gifting || !giftDesc.trim() || (!isAdmin && giftType==='nebula' && remaining===0)}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'none',
                cursor: (gifting || !giftDesc.trim()) ? 'not-allowed' : 'pointer',
                background: (gifting || !giftDesc.trim())
                  ? T.border
                  : `linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                color: (gifting || !giftDesc.trim()) ? T.textD : 'white',
                fontWeight:700, fontSize:14, fontFamily:'var(--font-body)', transition:'all .15s',
                boxShadow: (!gifting && giftDesc.trim()) ? `0 4px 16px ${T.goldLine}44` : 'none' }}>
              {gifting ? 'Enviando...' : '🏆 Enviar Troféu'}
            </button>
          </Card>
        )}

        {/* Troféus recebidos */}
        <Card style={{ padding:'24px 26px', marginBottom:14 }} elevated>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:18 }}>🏆</span>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Troféus Recebidos</div>
              <div style={{ fontSize:12, color:T.textT, marginTop:1 }}>{emTrophy.length} troféu{emTrophy.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <StarDivider my={10}/>
          {emTrophy.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:T.textT, fontSize:13 }}>
              Nenhum troféu ainda.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {emTrophy.map((t, i) => {
                const def = TROPHY_TYPES.find(x => x.id === t.type) || TROPHY_TYPES[0];
                return (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:14,
                    padding:'12px 14px', borderRadius:12,
                    background:`${def.color}08`, border:`1px solid ${def.color}22` }}>
                    <img src={def.img} alt={def.label}
                      onError={e => { e.target.onerror=null; e.target.style.display='none'; }}
                      style={{ width:40, height:40, objectFit:'contain', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:def.color }}>{def.label}</div>
                      <div style={{ fontSize:12, color:T.text, marginTop:3, lineHeight:1.5 }}>{t.description}</div>
                      {t.message && <div style={{ fontSize:11, color:T.textS, marginTop:3, fontStyle:'italic' }}>"{t.message}"</div>}
                      <div style={{ fontSize:11, color:T.textD, marginTop:4, display:'flex', gap:6 }}>
                        <span>de {t.from_name}</span>
                        <span>·</span>
                        <span>{t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* My Uniko */}
        <Card style={{ padding:'24px 26px' }} elevated>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:18 }}>🐾</span>
            <div style={{ fontSize:15, fontWeight:700, color:T.text }}>My Uniko</div>
          </div>
          <StarDivider my={10}/>
          {!doko ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:T.textT, fontSize:13 }}>
              {emp.name.split(' ')[0]} ainda não configurou o My Uniko.
            </div>
          ) : (
            <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <img src={DOKO_IMG[skin] || DOKO_IMG.tecnico} alt="Uniko"
                  style={{ width:90, height:90, borderRadius:16, objectFit:'cover',
                    border:`2px solid ${T.border}`, boxShadow:T.sh }}/>
                {doko.dormindo && (
                  <div style={{ position:'absolute', top:-6, right:-6, fontSize:16 }}>😴</div>
                )}
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:12 }}>
                  {DOKO_LABEL[skin] || skin}
                  {doko.dormindo && <span style={{ marginLeft:8, fontSize:11, color:T.textT }}>· Dormindo</span>}
                </div>
                <StatBar label="Fome"    value={doko.fome    ?? 0} color="#E05030"/>
                <StatBar label="Energia" value={doko.energia ?? 0} color="#2A82D2"/>
                <StatBar label="Sono"    value={doko.sono    ?? 0} color="#8B5FE8"/>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* ── LIST VIEW ────────────────────────────────────────────── */
  const filtered = employees.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
      <SHead sub="Veja os perfis e presenteie troféus">Colegas</SHead>

      {/* Search + refresh */}
      <div style={{ display:'flex', gap:10, marginBottom:18, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <Ico size={14} stroke={T.textD} d={<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}
            style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar colega..."
            style={{ width:'100%', paddingLeft:34, paddingRight:12, paddingTop:9, paddingBottom:9,
              border:`1.5px solid ${T.border}`, borderRadius:10, fontFamily:'var(--font-body)',
              fontSize:13, color:T.text, background: T.dark ? 'rgba(255,255,255,0.05)' : T.surface||'#fff',
              outline:'none', boxSizing:'border-box' }}/>
        </div>
        <button onClick={load} style={{ padding:'9px 14px', borderRadius:10, border:`1px solid ${T.border}`,
          background:'transparent', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:12,
          color:T.textS, display:'flex', alignItems:'center', gap:6 }}>
          <Ico size={13} d={<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>}/>
          Atualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:T.textT }}>
          <div style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${T.gold}`,
            borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 12px' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Carregando colegas...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:T.textT }}>
          <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
          <div style={{ fontSize:14 }}>{search ? 'Nenhum colega encontrado' : 'Nenhum colega cadastrado'}</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
          {filtered.map(emp => {
            const photo   = photos[emp.name];
            const empTrop = trophies[emp.name] || [];
            const doko    = dokoStates[emp.name];
            return (
              <div key={emp.id || emp.name}
                onClick={() => openProfile(emp)}
                style={{ padding:'20px 16px', borderRadius:16, border:`1px solid ${T.border}`,
                  background: T.dark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.85)'),
                  cursor:'pointer', transition:'all .15s', textAlign:'center' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${T.goldLine}55`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = T.shM; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                {/* Avatar */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:12, position:'relative' }}>
                  <AvatarCircle name={emp.name} photo={photo} size={64} fontSize={22}/>
                  {doko?.dormindo && (
                    <span style={{ position:'absolute', bottom:0, right:'calc(50% - 40px)', fontSize:14 }}>😴</span>
                  )}
                </div>
                {/* Nome */}
                <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:3,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</div>
                <div style={{ fontSize:11, color:T.textT, marginBottom:10,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {emp.cargo || emp.role || 'Colaborador'}
                </div>
                {/* Troféus */}
                {empTrop.length > 0 && (
                  <div style={{ display:'flex', justifyContent:'center', gap:4, flexWrap:'wrap' }}>
                    {['nebula','estelar','supernova'].map(type => {
                      const count = empTrop.filter(t => t.type === type).length;
                      if (!count) return null;
                      const def = TROPHY_TYPES.find(x => x.id === type);
                      return (
                        <span key={type} style={{ display:'flex', alignItems:'center', gap:3,
                          fontSize:10, fontWeight:600, color:def.color,
                          background:`${def.color}12`, border:`1px solid ${def.color}25`,
                          borderRadius:6, padding:'2px 7px' }}>
                          <img src={def.img} alt="" onError={e=>{e.target.style.display='none'}}
                            style={{ width:12, height:12, objectFit:'contain' }}/>{count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { TabColegas };
