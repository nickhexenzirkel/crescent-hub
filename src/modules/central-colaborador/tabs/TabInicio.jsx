import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, supabase as _supabase, getAuthUser } from '../../../contexts/user';
import { Card, StarDivider } from '../../../shared/components';
import dokoTecnico    from '../../../assets/DodocoTecnico.jpg';
import dokoCozinheiro from '../../../assets/DodocoCozinheiro.jpg';
import dokoMedico     from '../../../assets/DodocoMedico.jpg';
import dokoAmbiental  from '../../../assets/DodocoAmbientalista.jpg';
import dokoContador   from '../../../assets/DodocoContador.jpg';

const SKINS = { tecnico: dokoTecnico, cozinheiro: dokoCozinheiro, medico: dokoMedico, ambiental: dokoAmbiental, contador: dokoContador };

const DOKO_KEY = (() => {
  try { const a = getAuthUser(); return a?.cpf ? `uniko_doko_${a.cpf}` : 'uniko_doko'; }
  catch { return 'uniko_doko'; }
})();

const barCol = v => v >= 60 ? '#28A870' : v >= 30 ? '#E8A020' : '#C04050';

const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':'); return `${parseInt(h)}:${m}`; };

const fmtDateShort = d => {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const STARS = [
  { x: '8%',  y: '18%', r: 2.2, delay: '0s'   },
  { x: '22%', y: '12%', r: 1.6, delay: '1.1s'  },
  { x: '38%', y: '28%', r: 2.5, delay: '0.5s'  },
  { x: '52%', y: '14%', r: 1.4, delay: '1.8s'  },
  { x: '64%', y: '34%', r: 1.9, delay: '0.3s'  },
  { x: '15%', y: '65%', r: 1.3, delay: '2.2s'  },
  { x: '42%', y: '72%', r: 1.7, delay: '0.8s'  },
  { x: '70%', y: '58%', r: 1.1, delay: '1.5s'  },
];

const TabInicio = ({ setTab }) => {
  const [sv,   ssv]  = useState(false);
  const [lembs, setLembs]   = useState([]);
  const [evts,  setEvts]    = useState([]);
  const [comuns, setComuns] = useState([]);
  const [uniko, setUniko]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(DOKO_KEY) || '{}'); } catch { return {}; }
  });

  const now   = new Date();
  const hour  = now.getHours();
  const today = now.toISOString().slice(0, 10);
  const hhmm  = now.toTimeString().slice(0, 5);

  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayFmt = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    _supabase.from('reminders').select('*')
      .eq('active', true).eq('created_by', USER.name)
      .then(({ data }) => setLembs(data || []));

    _supabase.from('calendar_events').select('*')
      .order('event_date', { ascending: true })
      .then(({ data }) => setEvts(data || []));

    _supabase.from('comunicados').select('*')
      .eq('active', true).order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setComuns(data || []));

    // Atualiza dados do My Uniko ao abrir
    setUniko(() => { try { return JSON.parse(localStorage.getItem(DOKO_KEY) || '{}'); } catch { return {}; } });
  }, []);

  // Próximos lembretes (hoje com hora futura, ou com data futura, ou recorrentes)
  const upcoming = lembs
    .filter(r => {
      if (!r.time) return false;
      if (r.repeat !== 'never') return true;
      if (!r.date || r.date > today) return true;
      return r.date === today && r.time >= hhmm;
    })
    .sort((a, b) => {
      const aHoje = (a.repeat !== 'never' || !a.date || a.date === today);
      const bHoje = (b.repeat !== 'never' || !b.date || b.date === today);
      if (aHoje !== bHoje) return aHoje ? -1 : 1;
      return (a.date || '').localeCompare(b.date || '') || a.time.localeCompare(b.time);
    })
    .slice(0, 4);

  // Eventos de hoje
  const todayEvts = evts.filter(e => e.event_date === today);

  // My Uniko
  const { fome = 75, energia = 70, sono = 70, dormindo = false, skin = 'tecnico' } = uniko;
  const avg = (fome + energia) / 2;
  const uStatus = dormindo
    ? { label: 'Dormindo',  color: '#8B6FD4', emoji: '😴', sub: 'Recuperando sono...' }
    : (fome < 25 && energia < 25)
    ? { label: 'Cansado!',  color: '#C04050', emoji: '😓', sub: 'Precisa de cuidados!' }
    : avg >= 70
    ? { label: 'Feliz',     color: '#28A870', emoji: '😊', sub: 'Pronto para interagir!' }
    : avg >= 35
    ? { label: 'Neutro',    color: '#E8A020', emoji: '😐', sub: 'Precisa de atenção' }
    : { label: 'Triste',    color: '#C04050', emoji: '😢', sub: 'Cuide dele agora!' };

  const BtnVer = ({ tab, label = 'Ver →' }) => (
    <button onClick={() => setTab(tab)} style={{
      background: T.goldGl, border: `1px solid ${T.gold}33`, color: T.gold,
      cursor: 'pointer', fontSize: 11, padding: '3px 10px', borderRadius: 6,
      fontFamily: 'var(--font-body)', fontWeight: 600, outline: 'none',
    }}>{label}</button>
  );

  const EmptyState = ({ icon, text, sub }) => (
    <div style={{ textAlign: 'center', padding: '20px 0', color: T.textT }}>
      <div style={{ opacity: .45, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 3, opacity: .7 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="fi" style={{ fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes hb1{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(28px,-18px) scale(1.08)}70%{transform:translate(-14px,22px) scale(.96)}}
        @keyframes hb2{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(-26px,18px) scale(1.05)}65%{transform:translate(18px,-26px) scale(1.10)}}
        @keyframes hb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(12px,14px) scale(1.06)}}
        @keyframes moonPulse{0%,100%{opacity:.75}50%{opacity:1}}
        @keyframes twinkle{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.95;transform:scale(1.3)}}
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 22, overflow: 'hidden', marginBottom: 20, height: 190, position: 'relative',
        background: 'linear-gradient(135deg,#08121F 0%,#0C1D38 38%,#111E3A 65%,#162844 100%)',
        boxShadow: '0 10px 50px rgba(6,14,30,.55)',
      }}>
        {/* blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', top: -100, left: -60,
            background: `radial-gradient(circle,${T.blue}50 0%,transparent 68%)`, filter: 'blur(32px)',
            animation: 'hb1 10s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bottom: -70, right: 180,
            background: `radial-gradient(circle,${T.gold}28 0%,transparent 68%)`, filter: 'blur(28px)',
            animation: 'hb2 13s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', top: 10, left: '42%',
            background: 'radial-gradient(circle,rgba(90,60,180,.40) 0%,transparent 68%)', filter: 'blur(26px)',
            animation: 'hb3 8s ease-in-out infinite' }}/>
        </div>

        {/* estrelas */}
        {STARS.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', left: s.x, top: s.y,
            width: s.r * 2, height: s.r * 2, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)', pointerEvents: 'none',
            animation: `twinkle ${2.2 + i * 0.35}s ease-in-out infinite`, animationDelay: s.delay,
          }}/>
        ))}

        {/* lua */}
        <div style={{
          position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
          animation: 'moonPulse 5s ease-in-out infinite', pointerEvents: 'none',
        }}>
          <svg width="115" height="115" viewBox="0 0 100 100" fill="none">
            <defs>
              <radialGradient id="mg" cx="38%" cy="38%" r="62%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.16)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#mg)"/>
            <path d="M73 50A28 28 0 1 1 45 22A21 21 0 0 0 73 50Z"
              fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2"/>
            <circle cx="36" cy="33" r="2.8" fill="rgba(255,255,255,0.15)"/>
            <circle cx="43" cy="45" r="1.8" fill="rgba(255,255,255,0.10)"/>
            <circle cx="28" cy="50" r="1.3" fill="rgba(255,255,255,0.09)"/>
            <circle cx="50" cy="38" r="1.1" fill="rgba(255,255,255,0.08)"/>
          </svg>
        </div>

        {/* conteúdo */}
        <div style={{ position: 'relative', zIndex: 1, padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.93)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 22, fontWeight: 700, color: T.blue,
              border: '2.5px solid rgba(255,255,255,0.45)',
              boxShadow: `0 0 0 5px rgba(255,255,255,0.08), 0 0 0 10px rgba(255,255,255,0.04), 0 8px 28px rgba(0,0,0,0.3)`,
            }}>
              {USER.avatar}
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', letterSpacing: '.10em', textTransform: 'uppercase', marginBottom: 5 }}>
                {greeting}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 6, letterSpacing: '-.01em' }}>
                {USER.short}!
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.42)', textTransform: 'capitalize', letterSpacing: '.01em' }}>
                {todayFmt}
              </div>
            </div>
          </div>
          <StarDivider my={0} dim/>
        </div>
      </div>

      {/* ── GRADE PRINCIPAL ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* My Uniko */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>My Uniko</div>
            <BtnVer tab="uniko"/>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              border: `2.5px solid ${uStatus.color}55`,
              boxShadow: `0 0 0 4px ${uStatus.color}18, 0 4px 14px ${uStatus.color}22`,
            }}>
              <img src={SKINS[skin] || SKINS.tecnico} alt="Uniko"
                style={{ width: '100%', height: '100%', objectFit: 'cover',
                  filter: dormindo ? 'brightness(.75) saturate(.6)' : 'none', transition: 'filter .4s' }}/>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>{uStatus.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: uStatus.color }}>{uStatus.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.textT }}>{uStatus.sub}</div>
            </div>
          </div>
          <StarDivider my={10} dim/>
          {[{ l: 'Fome', v: fome }, { l: 'Energia', v: energia }, { l: 'Sono', v: sono }].map(({ l, v }) => (
            <div key={l} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: T.textS }}>{l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: barCol(v) }}>{Math.round(v)}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${v}%`, borderRadius: 999, transition: 'width .4s ease',
                  background: `linear-gradient(90deg,${barCol(v)},${barCol(v)}88)`,
                  boxShadow: `0 0 6px ${barCol(v)}55` }}/>
              </div>
            </div>
          ))}
        </Card>

        {/* Eventos Hoje */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Eventos Hoje</div>
            <BtnVer tab="eventos"/>
          </div>
          {todayEvts.length === 0 ? (
            <EmptyState
              icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.3" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              text="Nenhum evento hoje" sub="Aproveite o dia livre!"
            />
          ) : todayEvts.map(ev => (
            <div key={ev.id} style={{
              display: 'flex', gap: 11, padding: '10px 12px', borderRadius: 10, marginBottom: 8,
              background: T.surface, border: `1px solid ${T.border}`, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: T.goldGl, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.gold}22`,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: T.textT, marginTop: 2 }}>
                  {ev.event_time ? `◷ ${fmtTime(ev.event_time)}` : 'Dia todo'}
                </div>
                {ev.description && <div style={{ fontSize: 11, color: T.textS, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description}</div>}
              </div>
            </div>
          ))}
        </Card>

        {/* Próximos Lembretes */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Próximos Lembretes</div>
            <BtnVer tab="lembretes"/>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.3" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
              text="Nenhum lembrete próximo" sub="Crie um em Meus Lembretes"
            />
          ) : upcoming.map((r, i) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, paddingTop: i === 0 ? 0 : 10,
              paddingBottom: i < upcoming.length - 1 ? 10 : 0,
              borderBottom: i < upcoming.length - 1 ? `1px solid ${T.border}` : 'none',
            }}>
              <div style={{
                background: T.goldGl, border: `1px solid ${T.gold}28`, borderRadius: 9,
                padding: '5px 9px', flexShrink: 0, minWidth: 46, textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, lineHeight: 1 }}>{fmtTime(r.time)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: T.textT, marginTop: 1 }}>
                  {r.repeat !== 'never'
                    ? ({ daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' }[r.repeat] || r.repeat)
                    : r.date && r.date !== today ? fmtDateShort(r.date) : 'Hoje'}
                </div>
              </div>
            </div>
          ))}
        </Card>

        {/* Últimos Avisos */}
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Avisos do RH</div>
            <BtnVer tab="comunicados"/>
          </div>
          {comuns.length === 0 ? (
            <EmptyState
              icon={<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.3" strokeLinecap="round"><path d="M22 17H2a3 3 0 000 6h20"/><path d="M2 12v5"/><path d="M22 12v5"/><path d="M12 3v9"/><path d="M6 6l6-3 6 3"/></svg>}
              text="Nenhum comunicado recente"
            />
          ) : comuns.map((c, i) => (
            <div key={c.id} style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: i < comuns.length - 1 ? 8 : 0,
              background: c.urgent ? 'rgba(192,64,80,0.05)' : T.surface,
              border: `1px solid ${c.urgent ? 'rgba(192,64,80,0.22)' : T.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: c.body ? 3 : 0 }}>
                {c.urgent && <span style={{ fontSize: 12 }}>🚨</span>}
                <div style={{ fontSize: 13, fontWeight: 600, color: c.urgent ? '#C04050' : T.text, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <span style={{ fontSize: 10, color: T.textT, flexShrink: 0 }}>
                  {new Date(c.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {c.body && <div style={{ fontSize: 11.5, color: T.textS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>}
            </div>
          ))}
        </Card>
      </div>

      {/* ── LINHA INFERIOR: SALÁRIO + TROFÉUS ──────────────────────── */}
      <StarDivider my={6} dim/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>

        {/* Salário */}
        <Card style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'rgba(40,168,112,0.10)', border: '1px solid rgba(40,168,112,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#28A870', fontWeight: 700, fontSize: 18,
            }}>$</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.textT, marginBottom: 3 }}>Último Salário</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '-.01em' }}>
                {sv ? `R$ ${USER.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••,••'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28A870' }}/>
                <span style={{ fontSize: 11, color: '#28A870' }}>Pagamento em dia</span>
              </div>
            </div>
            <button onClick={() => ssv(!sv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sv ? T.gold : T.textD, padding: 4, flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                {sv
                  ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></>}
              </svg>
            </button>
          </div>
        </Card>

        {/* Troféus */}
        <Card style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: T.goldGl, border: `1px solid ${T.gold}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.textT, marginBottom: 3 }}>Troféus</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{USER.trophies.length}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, minHeight: 20 }}>
                {USER.trophies.length > 0
                  ? USER.trophies.slice(0, 5).map((t, i) => <span key={i} style={{ fontSize: 15 }}>{t.icon}</span>)
                  : <span style={{ fontSize: 11, color: T.textT }}>Nenhum troféu ainda</span>}
              </div>
            </div>
            <BtnVer tab="conquistas" label="Ver"/>
          </div>
        </Card>

      </div>
    </div>
  );
};

export { TabInicio };
