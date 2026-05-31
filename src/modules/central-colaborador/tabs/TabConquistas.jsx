import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase } from '../../../contexts/user';
import { Card, StarDivider, SHead } from '../../../shared/components';

const TROPHY_TYPES = [
  { id:'nebula',    label:'Troféu Nebula',    img:'/TrofeuNebula.png',    color:'#4A9FE8' },
  { id:'estelar',   label:'Troféu Estelar',   img:'/TrofeuEstelar.png',   color:'#D89030' },
  { id:'supernova', label:'Troféu Supernova', img:'/TrofeuSupernova.png', color:'#C04050' },
];

const TabConquistas = () => {
  const [trophies, setTrophies] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [ranking,  setRanking]  = useState([]);

  useEffect(() => {
    const load = async () => {
      const [mine, all] = await Promise.all([
        _supabase.from('trophies').select('*').eq('to_name', USER.name).order('created_at', { ascending:false }),
        _supabase.from('trophies').select('to_name'),
      ]);
      setTrophies(mine.data || []);

      /* ranking por total de troféus */
      const counts = {};
      (all.data || []).forEach(t => { counts[t.to_name] = (counts[t.to_name] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
      setRanking(sorted);
      setLoading(false);
    };
    load();
  }, []);

  const byType = (id) => trophies.filter(t => t.type === id);

  return (
    <div className="fi" style={{ fontFamily:'var(--font-body)' }}>
      <SHead sub="Seus troféus e ranking da equipe">Conquistas</SHead>

      {/* Meus troféus */}
      <Card style={{ padding:'26px 28px', marginBottom:16,
        background:`linear-gradient(160deg,${T.goldGl},${T.surface||'transparent'} 60%)` }} elevated>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{ fontSize:20 }}>🏆</span>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:T.text }}>Meus Troféus</div>
            <div style={{ fontSize:12, color:T.textT, marginTop:1 }}>{trophies.length} troféu{trophies.length !== 1 ? 's' : ''} recebidos</div>
          </div>
        </div>
        <StarDivider my={12}/>

        {loading ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:T.textT }}>
            <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${T.gold}`,
              borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 8px' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Carregando...
          </div>
        ) : trophies.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:T.textT, fontSize:14 }}>
            Você ainda não recebeu nenhum troféu.<br/>
            <span style={{ fontSize:12, opacity:.7 }}>Troféus são dados pelo RH ou por colegas na aba Colegas.</span>
          </div>
        ) : (
          <>
            {/* Resumo por tipo */}
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              {TROPHY_TYPES.map(def => {
                const count = byType(def.id).length;
                if (!count) return null;
                return (
                  <div key={def.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                    borderRadius:12, background:`${def.color}10`, border:`1px solid ${def.color}22` }}>
                    <img src={def.img} alt={def.label}
                      onError={e => { e.target.onerror=null; e.target.style.display='none'; }}
                      style={{ width:36, height:36, objectFit:'contain' }}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:def.color }}>{count}×</div>
                      <div style={{ fontSize:11, color:T.textT }}>{def.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lista detalhada */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {trophies.map((t, i) => {
                const def = TROPHY_TYPES.find(x => x.id === t.type) || TROPHY_TYPES[0];
                return (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:14,
                    padding:'12px 14px', borderRadius:12,
                    background:`${def.color}06`, border:`1px solid ${def.color}20` }}>
                    <img src={def.img} alt={def.label}
                      onError={e => { e.target.onerror=null; e.target.style.display='none'; }}
                      style={{ width:38, height:38, objectFit:'contain', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:def.color }}>{def.label}</div>
                      <div style={{ fontSize:12, color:T.text, marginTop:3, lineHeight:1.5 }}>{t.description || t.msg || '—'}</div>
                      {t.message && <div style={{ fontSize:11, color:T.textS, marginTop:3, fontStyle:'italic' }}>"{t.message}"</div>}
                      <div style={{ fontSize:11, color:T.textD, marginTop:4 }}>
                        de {t.from_name || t.from} · {t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : (t.date||'—')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Ranking */}
      <Card style={{ padding:'26px 28px' }} elevated>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{ fontSize:20 }}>👑</span>
          <div style={{ fontSize:17, fontWeight:700, color:T.text }}>Ranking da Equipe</div>
        </div>
        <StarDivider my={12}/>
        {ranking.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:T.textT, fontSize:13 }}>
            O ranking será construído conforme os troféus forem distribuídos.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {ranking.map(([name, count], i) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'10px 14px', borderRadius:11,
                background: name === USER.name ? T.goldGl : (T.dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                border:`1px solid ${name === USER.name ? T.goldLine+'44' : T.border}` }}>
                <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex',
                  alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700,
                  background: i === 0 ? '#D89030' : i === 1 ? '#8A9BB0' : i === 2 ? '#B07040' : T.surfaceSub||'rgba(0,0,0,0.06)',
                  color: i < 3 ? 'white' : T.textD }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <div style={{ flex:1, fontSize:13, fontWeight: name === USER.name ? 700 : 500, color:T.text }}>
                  {name}{name === USER.name && <span style={{ marginLeft:6, fontSize:11, color:T.gold }}>(você)</span>}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:T.gold }}>
                  {count} 🏆
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export { TabConquistas };
