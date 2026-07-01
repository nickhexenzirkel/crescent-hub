import React, { useState, useEffect, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, SERVER_URL, getAuthUser, fetchPhotoByName } from '../../../contexts/user';
import { Card, StarDivider, SHead, AvatarCircle, Tag } from '../../../shared/components';
import { fetchCapturesFor, getUniko } from '../../../shared/captureUniko';
import { getAssistantSkin, skinRemoteKey } from '../../../shared/assistantSkin';
import dokoTecnico    from '../../../assets/DodocoTecnico.jpg';
import dokoCozinheiro from '../../../assets/DodocoCozinheiro.jpg';
import dokoMedico     from '../../../assets/DodocoMedico.jpg';
import dokoAmbiental  from '../../../assets/DodocoAmbientalista.jpg';
import dokoContador   from '../../../assets/DodocoContador.jpg';

const DOKO_IMG = { tecnico:dokoTecnico, cozinheiro:dokoCozinheiro, medico:dokoMedico, ambiental:dokoAmbiental, contador:dokoContador };
const DOKO_LABEL = { tecnico:'Técnico', cozinheiro:'Cozinheiro', medico:'Médico', ambiental:'Ambientalista', contador:'Contador' };

// Todo colaborador começa com este UNIKO — não vem de captura, por isso não está em CAPTURE_UNIKOS.
const DEFAULT_UNIKO_CARD = {
  name: 'UNIKO', shortName: 'UNIKO padrão',
  img: '/UNIKO_NEW.png',
  theme: { accent: '#2196F3', scene: 'radial-gradient(120% 90% at 50% 0%, #16294a 0%, #0d1626 45%, #06090f 100%)' },
};

const TROPHY_TYPES = [
  { id:'nebula',    label:'Troféu Nebula',    img:'/TroféuNebula.png',    color:'#4A9FE8', adminOnly:false },
  { id:'estelar',   label:'Troféu Estelar',   img:'/TroféuEstelar.png',   color:'#D89030', adminOnly:true  },
  { id:'supernova', label:'Troféu Supernova', img:'/TroféuSupernova.png', color:'#9B6FE8', adminOnly:true  },
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

/* ── Componente de card de troféu — fora do TabColegas para não recriar a cada render ── */
const TrophyMiniCard = ({ trophy, highlighted }) => {
  const [hov, setHov] = useState(false);
  const def = TROPHY_TYPES.find(x => x.id === trophy.type) || TROPHY_TYPES[0];
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderRadius:13, border:`2px solid ${(highlighted||hov) ? T.goldLine+'88' : T.border}`,
        background: highlighted ? T.goldGl : (T.dark ? T.surface : '#fff'),
        padding:'16px 12px', textAlign:'center',
        transition:'all .15s', transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? T.shM : 'none' }}>
      <img src={def.img} alt={def.label}
        onError={e => { e.target.onerror=null; e.target.style.opacity='0.2'; }}
        style={{ width:70, height:70, objectFit:'contain', marginBottom:8 }}/>
      <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:3,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{trophy.description}</div>
      <div style={{ fontSize:10, color:T.textT, marginBottom:2 }}>
        {trophy.created_at ? new Date(trophy.created_at).toLocaleDateString('pt-BR') : '—'}
      </div>
      <div style={{ fontSize:10, color:T.textS }}>De: {trophy.from_name}</div>
      {trophy.message && (
        <div style={{ fontSize:10, color:T.textD, marginTop:4, fontStyle:'italic',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          "{trophy.message}"
        </div>
      )}
    </div>
  );
};

/* ── Modal de presentear — fora do TabColegas para não recriar a cada keystroke ── */
const GiftModal = ({ show, onClose, selected, photos, isAdmin, availTrophies, remaining,
  giftType, setGiftType, giftDesc, setGiftDesc, giftMsg, setGiftMsg,
  gifting, giftResult, onSend }) => {
  if (!show || !selected) return null;
  const activeDef = TROPHY_TYPES.find(t => t.id === giftType) || TROPHY_TYPES[0];
  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.55)',
      backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center',
      padding:16, fontFamily:'var(--font-body)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.dark ? T.surface : '#fff', borderRadius:20, width:'100%', maxWidth:420,
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.35)',
        border:`1px solid ${T.border}`,
      }}>
        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
          padding:'18px 22px', borderRadius:'20px 20px 0 0',
          display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.22)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🎁</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:700, color:'white' }}>Presentear Troféu</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:1 }}>{activeDef.label}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.18)', border:'none',
            borderRadius:8, width:30, height:30, cursor:'pointer', color:'white',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>×</button>
        </div>

        <div style={{ padding:'20px 22px' }}>
          {/* Presentando para */}
          <div style={{ padding:'12px 14px', borderRadius:12, background:T.goldGl,
            border:`1px solid ${T.goldLine}22`, marginBottom:18 }}>
            <div style={{ fontSize:11, color:T.textD, textTransform:'uppercase',
              letterSpacing:'.07em', fontWeight:600, marginBottom:8 }}>Presenteando para:</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <AvatarCircle name={selected.name} photo={photos[selected.name]} size={38} fontSize={13} style={{ boxShadow:`0 0 0 3px rgba(0,0,0,0.10)` }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{selected.name}</div>
                <div style={{ fontSize:11, color:T.textT }}>{selected.cargo || selected.role || 'Colaborador'}</div>
              </div>
            </div>
          </div>

          {/* Imagem do troféu */}
          <div style={{ borderRadius:14, background: T.dark ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
            padding:'20px', display:'flex', justifyContent:'center', marginBottom:18 }}>
            <img src={activeDef.img} alt={activeDef.label}
              onError={e => { e.target.onerror=null; e.target.style.opacity='0.3'; }}
              style={{ width:110, height:110, objectFit:'contain', transition:'all .2s' }}/>
          </div>

          {/* Seleção de tipo */}
          <div style={{ display:'flex', gap:8, marginBottom:18, justifyContent:'center' }}>
            {availTrophies.map(t => {
              const active   = giftType === t.id;
              const disabled = !isAdmin && t.id === 'nebula' && remaining === 0;
              return (
                <button key={t.id} onClick={() => !disabled && setGiftType(t.id)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                    padding:'8px 12px', borderRadius:10, cursor: disabled?'not-allowed':'pointer',
                    border:`2px solid ${active ? t.color : T.border}`,
                    background: active ? `${t.color}12` : 'transparent',
                    opacity: disabled ? 0.4 : 1, transition:'all .15s', outline:'none' }}>
                  <img src={t.img} alt={t.label}
                    onError={e => { e.target.onerror=null; e.target.style.opacity='0'; }}
                    style={{ width:32, height:32, objectFit:'contain' }}/>
                  <span style={{ fontSize:9, fontWeight: active?700:400,
                    color: active ? t.color : T.textD, textAlign:'center', lineHeight:1.2 }}>
                    {t.label.replace('Troféu ','')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Nome do troféu */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:600, color:T.textS, display:'block', marginBottom:6 }}>
              Nome do Troféu <span style={{ color:'#C04050' }}>*</span>
            </label>
            <input value={giftDesc} onChange={e => setGiftDesc(e.target.value)}
              placeholder="Ex: Melhor do mês, Troféu Inovação..."
              style={{ width:'100%', padding:'10px 13px', border:`1.5px solid ${T.border}`,
                borderRadius:10, fontFamily:'var(--font-body)', fontSize:13, color:T.text,
                background: T.dark ? 'rgba(255,255,255,0.05)' : '#fff',
                outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = T.goldLine}
              onBlur={e  => e.target.style.borderColor = T.border}/>
          </div>

          {/* Mensagem */}
          <div style={{ marginBottom:18 }}>
            <label style={{ fontSize:12, fontWeight:600, color:T.textS, display:'block', marginBottom:6 }}>
              Mensagem Personalizada <span style={{ fontSize:11, color:T.textD, fontWeight:400 }}>(opcional)</span>
            </label>
            <textarea value={giftMsg} onChange={e => setGiftMsg(e.target.value)}
              placeholder="Ex: Parabéns pelo excelente trabalho!"
              rows={3}
              style={{ width:'100%', padding:'10px 13px', border:`1.5px solid ${T.border}`,
                borderRadius:10, fontFamily:'var(--font-body)', fontSize:13, color:T.text,
                background: T.dark ? 'rgba(255,255,255,0.05)' : '#fff',
                outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box',
                transition:'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = T.goldLine}
              onBlur={e  => e.target.style.borderColor = T.border}/>
          </div>

          {/* Troféus disponíveis */}
          {!isAdmin && (
            <div style={{ padding:'12px 14px', borderRadius:11, marginBottom:16,
              background: remaining === 0 ? 'rgba(192,64,80,0.06)' : T.goldGl,
              border:`1px solid ${remaining === 0 ? 'rgba(192,64,80,0.22)' : T.goldLine+'33'}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:600, color: remaining===0 ? '#C04050' : T.textS }}>Troféus disponíveis:</span>
                <span style={{ fontSize:22, fontWeight:800, color: remaining===0 ? '#C04050' : T.gold }}>{remaining}</span>
              </div>
              <div style={{ fontSize:11, color:T.textT, marginTop:3 }}>
                {remaining === 0
                  ? 'Limite mensal atingido. Renova no próximo mês.'
                  : `Você poderá presentear mais ${remaining - 1} troféu(s) após este.`}
              </div>
            </div>
          )}

          {giftResult && (
            <div style={{ padding:'9px 14px', borderRadius:9, marginBottom:14, fontSize:12,
              background: giftResult.startsWith('✅') ? 'rgba(40,168,112,0.08)' : 'rgba(192,64,80,0.06)',
              border:`1px solid ${giftResult.startsWith('✅') ? 'rgba(40,168,112,0.25)' : 'rgba(192,64,80,0.22)'}`,
              color: giftResult.startsWith('✅') ? '#28A870' : '#C04050' }}>
              {giftResult}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose}
              style={{ flex:1, padding:'11px', borderRadius:10, border:`1px solid ${T.border}`,
                background:'transparent', cursor:'pointer', fontFamily:'var(--font-body)',
                fontSize:13, fontWeight:600, color:T.textS }}>
              Cancelar
            </button>
            <button onClick={onSend}
              disabled={gifting || !giftDesc.trim() || (!isAdmin && giftType==='nebula' && remaining===0)}
              style={{ flex:2, padding:'11px', borderRadius:10, border:'none',
                cursor: (gifting||!giftDesc.trim()) ? 'not-allowed' : 'pointer',
                background: (gifting||!giftDesc.trim()) ? T.border : `linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
                color: (gifting||!giftDesc.trim()) ? T.textD : 'white',
                fontWeight:700, fontSize:13, fontFamily:'var(--font-body)', transition:'all .15s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                boxShadow: (!gifting&&giftDesc.trim()) ? `0 4px 16px ${T.goldLine}44` : 'none' }}>
              {gifting ? 'Enviando...' : <><span>🎁</span> Presentear</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TabColegas = () => {
  const auth     = getAuthUser();
  const isAdmin  = auth?.role === 'admin';

  const [employees,   setEmployees]  = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [photos,      setPhotos]     = useState({});
  const [trophies,    setTrophies]   = useState({});
  const [dokoStates,  setDokoStates] = useState({});
  const [activeSkins, setActiveSkins] = useState({}); // { [nome]: skinId } — assistente UNIKO ativo de cada colega
  const [selected,    setSelected]   = useState(null);
  const [colCollection, setColCollection] = useState(null); // coleção de Unikos do colega selecionado
  useEffect(() => {
    if (!selected?.name) { setColCollection(null); return; }
    let alive = true;
    setColCollection(null);
    fetchCapturesFor(selected.name).then(list => { if (alive) setColCollection(list); });
    return () => { alive = false; };
  }, [selected]);
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
      const r = await fetch(`${SERVER_URL}/api/team`, { headers: authHeader() });
      const d = await r.json();
      const list = (d.employees || []).filter(e => e.active !== false && e.name !== USER.name);
      setEmployees(list);

      const names = list.map(e => e.name);
      if (!names.length) { setLoading(false); return; }

      const [photoRes, trophyRes, dokoRes, skinRes] = await Promise.all([
        Promise.all(names.map(async n => [n, await fetchPhotoByName(n)])),
        _supabase.from('trophies').select('*').in('to_name', names).order('created_at', { ascending:false }),
        _supabase.from('doko_states').select('*').in('employee_name', names),
        _supabase.from('settings').select('key,value').in('key', names.map(skinRemoteKey)),
      ]);

      setPhotos(Object.fromEntries(photoRes.filter(([,p]) => p)));

      const tmap = {};
      (trophyRes.data || []).forEach(t => { (tmap[t.to_name] = tmap[t.to_name] || []).push(t); });
      setTrophies(tmap);

      const dmap = {};
      (dokoRes.data || []).forEach(d => { dmap[d.employee_name] = d; });
      setDokoStates(dmap);

      const smap = {};
      (skinRes.data || []).forEach(row => {
        const name = names.find(n => skinRemoteKey(n) === row.key);
        if (name && row.value && row.value !== 'default') smap[name] = row.value;
      });
      setActiveSkins(smap);
    } catch {}
    setLoading(false);
  };

  const checkMonthly = async () => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const { data } = await _supabase.from('trophies').select('id')
      .eq('from_name', USER.name).eq('type', 'nebula').gte('created_at', start.toISOString());
    setMonthly((data||[]).length);
  };

  const openProfile = (emp) => {
    setSelected(emp);
    setShowGift(false);
    setGiftResult('');
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
    const emp      = selected;
    const photo    = photos[emp.name];
    const emTrophy = trophies[emp.name] || [];
    const doko     = dokoStates[emp.name];
    const skin     = doko?.skin || 'tecnico';
    const activeSkinId = activeSkins[emp.name];
    const activeSkin   = activeSkinId ? getAssistantSkin(activeSkinId) : null;

    return (
      <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
        {/* Back */}
        <button onClick={() => { setSelected(null); setShowGift(false); }}
          style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none',
            cursor:'pointer', color:T.textS, fontSize:13, fontFamily:'var(--font-body)',
            padding:'0 0 18px' }}>
          <Ico size={14} d={<polyline points="15 18 9 12 15 6"/>}/> Voltar para Colegas
        </button>

        {/* Header card */}
        <Card style={{ padding:'22px 24px', marginBottom:14,
          border: activeSkin ? `1.5px solid ${activeSkin.accent}55` : undefined,
          boxShadow: activeSkin ? `0 0 0 1px ${activeSkin.accent}22, 0 8px 28px ${activeSkin.accent}22` : undefined }} elevated>
          <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
            <AvatarCircle name={emp.name} photo={photo} size={70} fontSize={24}
              style={{ boxShadow: activeSkin ? `0 0 0 4px ${activeSkin.accent}55` : `0 0 0 4px rgba(0,0,0,0.10)` }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:19, fontWeight:700, color:T.text }}>{emp.name}</div>
                {activeSkin && (
                  <Tag color={activeSkin.accent}>🦇 {activeSkin.name.replace(/^Uniko\s*/i, '')}</Tag>
                )}
              </div>
              <div style={{ fontSize:13, color:T.textT, marginTop:3 }}>{emp.cargo || emp.role || 'Colaborador'}</div>
              {emp.admission && <div style={{ fontSize:11, color:T.textD, marginTop:4 }}>Admissão: {emp.admission}</div>}
            </div>
          </div>
        </Card>

        {/* Coleção de Unikos do colega */}
        <Card style={{ padding:'22px 24px' }} elevated>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <span style={{ fontSize:17 }}>🦇</span>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>Coleção de Unikos</div>
              <div style={{ fontSize:12, color:T.textT, marginTop:1 }}>
                {colCollection == null ? 'Carregando...' : colCollection.length === 0
                  ? 'UNIKO padrão'
                  : `UNIKO padrão + ${colCollection.length} capturado${colCollection.length===1?'':'s'}`}
              </div>
            </div>
          </div>
          <StarDivider my={10}/>
          {colCollection == null ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:T.textT, fontSize:13 }}>Carregando...</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:12 }}>
              {/* Todo colaborador tem o UNIKO padrão desde o início */}
              <div style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${DEFAULT_UNIKO_CARD.theme.accent}55` }}>
                <div style={{ height:100, background:DEFAULT_UNIKO_CARD.theme.scene, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <img src={DEFAULT_UNIKO_CARD.img} alt={DEFAULT_UNIKO_CARD.name} style={{ width:78, height:78, objectFit:'contain', filter:`drop-shadow(0 0 12px ${DEFAULT_UNIKO_CARD.theme.accent})` }}/>
                </div>
                <div style={{ padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color:T.text, lineHeight:1.2 }}>{DEFAULT_UNIKO_CARD.shortName}</div>
                </div>
              </div>
              {colCollection.map((c, i) => {
                const u = getUniko(c.uniko_id);
                return (
                  <div key={i} style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${u.theme.accent}55` }}>
                    <div style={{ height:100, background:u.theme.scene||'#1a0408', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <img src={u.img} alt={c.uniko_name||u.name} style={{ width:78, height:78, objectFit:'contain', filter:`drop-shadow(0 0 12px ${u.theme.accent})` }}/>
                    </div>
                    <div style={{ padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:11.5, fontWeight:700, color:T.text, lineHeight:1.2 }}>{u.shortName || c.uniko_name || u.name}</div>
                    </div>
                  </div>
                );
              })}
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
            const activeSkinId = activeSkins[emp.name];
            const activeSkin   = activeSkinId ? getAssistantSkin(activeSkinId) : null;
            return (
              <div key={emp.id || emp.name}
                onClick={() => openProfile(emp)}
                style={{ padding:'20px 16px', borderRadius:16,
                  border: activeSkin ? `1.5px solid ${activeSkin.accent}66` : `1px solid ${T.border}`,
                  background: T.dark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.85)'),
                  boxShadow: activeSkin ? `0 0 20px ${activeSkin.accent}22` : 'none',
                  cursor:'pointer', transition:'all .15s', textAlign:'center' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = activeSkin ? activeSkin.accent : `${T.goldLine}55`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = T.shM; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = activeSkin ? `${activeSkin.accent}66` : T.border; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = activeSkin ? `0 0 20px ${activeSkin.accent}22` : 'none'; }}>
                {/* Avatar */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:12, position:'relative' }}>
                  <AvatarCircle name={emp.name} photo={photo} size={64} fontSize={22}
                    style={{ boxShadow: activeSkin ? `0 0 0 3px ${activeSkin.accent}66` : `0 0 0 3px rgba(0,0,0,0.10)` }}/>
                  {doko?.dormindo && (
                    <span style={{ position:'absolute', bottom:0, right:'calc(50% - 40px)', fontSize:14 }}>😴</span>
                  )}
                </div>
                {/* Assistente UNIKO ativo */}
                {activeSkin && (
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
                    <Tag color={activeSkin.accent}>🦇 {activeSkin.name.replace(/^Uniko\s*/i, '')}</Tag>
                  </div>
                )}
                {/* Nome */}
                <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:3,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</div>
                <div style={{ fontSize:11, color:T.textT,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {emp.cargo || emp.role || 'Colaborador'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { TabColegas };
