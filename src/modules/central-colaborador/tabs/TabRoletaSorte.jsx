// src/modules/central-colaborador/tabs/TabRoletaSorte.jsx
// "Roleta da Sorte" — roleta de prêmios ao vivo. Só o admin monta a lista de
// participantes (número ou nome, tudo é só um rótulo em texto) e aperta
// "Girar"; todo mundo que estiver com essa aba aberta, em QUALQUER
// computador, vê a MESMA roleta girando ao mesmo tempo — sem nenhum controle,
// só assistindo (ver src/shared/roletaSorte.js pra como a sincronização
// funciona: relógio compartilhado, sem frame nenhum viajando pela rede).
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { T } from '../../../contexts/theme';
import { SERVER_URL, getAuthUser } from '../../../contexts/user';
import { useIsMobile } from '../../../hooks/useIsMobile';
import {
  loadRoletaConfig, saveRoletaConfig, subscribeRoletaConfig,
  restAngleOf, buildSpin, spinProgress, nowMs, ensureServerClock,
  ROLETA_DURATION_MS,
} from '../../../shared/roletaSorte';

const segColor = (i, n) => {
  const hue = Math.round((i * 360) / Math.max(n, 1));
  const light = i % 2 === 0 ? 55 : 45;
  return `hsl(${hue} 72% ${light}%)`;
};

// Curva de desaceleração: rápida no início, freando bem devagar no fim
// (easeOutQuart) + um leve chacoalhão que decai até 0 exatamente em t=1 —
// imita os pinos de uma roleta física raspando antes de parar de vez, sem
// desviar o ângulo final de pouso (o formato garante f(0)=0 e f(1)=1 sempre).
const wheelEase = (t) => 1 - Math.pow(1 - t, 4);
const wobbleDeg = (t) => Math.pow(1 - t, 3) * 7 * Math.sin(t * 50);

const RingLights = ({ n, size, speedS, gold }) => (
  <>
    {Array.from({ length: n }).map((_, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      const R = size / 2 - 4;
      const x = size / 2 + R * Math.cos(a);
      const y = size / 2 + R * Math.sin(a);
      return (
        <div key={i} style={{
          position: 'absolute', left: x - 4, top: y - 4, width: 8, height: 8, borderRadius: '50%',
          background: i % 2 === 0 ? gold : '#fff', boxShadow: `0 0 7px 2px ${gold}aa`,
          animation: `roletaBulb ${speedS}s ease-in-out infinite`, animationDelay: `${(i / n) * speedS}s`,
        }}/>
      );
    })}
  </>
);

const WheelIcon = ({ size = 20, color = 'currentColor', strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="2.1" fill={color} stroke="none"/>
    <path d="M12 3v4.3M12 16.7V21M3 12h4.3M16.7 12H21M5.64 5.64l3.04 3.04M15.32 15.32l3.04 3.04M18.36 5.64l-3.04 3.04M8.68 15.32l-3.04 3.04"/>
  </svg>
);

const labelStyleFor = (n) => {
  if (n <= 6)  return { width: 112, fontSize: 15 };
  if (n <= 10) return { width: 88,  fontSize: 13 };
  if (n <= 16) return { width: 66,  fontSize: 11 };
  return { width: 52, fontSize: 9.5 };
};

const Wheel = ({ entries, angle, phase, size, gold }) => {
  const n = Math.max(entries.length, 1);
  const segWidth = 360 / n;
  const { width: labelW, fontSize: labelFs } = labelStyleFor(n);
  const gradient = entries.length
    ? `conic-gradient(from 0deg, ${entries.map((e, i) => `${segColor(i, n)} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`).join(', ')})`
    : `repeating-conic-gradient(${gold}22 0deg 12deg, transparent 12deg 24deg)`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <RingLights n={size > 300 ? 30 : 22} size={size + 22} speedS={phase === 'spinning' ? 0.55 : 2.1} gold={gold}/>

      {/* Disco giratório */}
      <div style={{
        position: 'absolute', inset: 16, borderRadius: '50%', overflow: 'hidden',
        transform: `rotate(${angle}deg)`, background: gradient,
        border: '4px solid rgba(255,255,255,.55)',
        boxShadow: phase === 'spinning'
          ? `0 0 46px 10px ${gold}55, inset 0 0 30px rgba(0,0,0,.25)`
          : `0 8px 30px rgba(0,0,0,.3), inset 0 0 24px rgba(0,0,0,.2)`,
        transition: 'box-shadow .4s ease',
      }}>
        {/* Linhas divisórias entre os gomos */}
        {entries.map((e, i) => (
          <div key={`div-${e.id}`} style={{ position: 'absolute', inset: 0, transform: `rotate(${i * segWidth}deg)` }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1.5, height: '50%',
              background: 'rgba(255,255,255,.4)', transform: 'translateX(-50%)' }}/>
          </div>
        ))}
        {/* Rótulos radiais */}
        {entries.map((e, i) => {
          const mid = i * segWidth + segWidth / 2;
          return (
            <div key={`lbl-${e.id}`} style={{ position: 'absolute', inset: 0, transform: `rotate(${mid}deg)` }}>
              <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)',
                width: labelW, textAlign: 'center', pointerEvents: 'none' }}>
                <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', color: '#fff', fontSize: labelFs, fontWeight: 800,
                  fontFamily: 'var(--font-body)', textShadow: '0 1px 3px rgba(0,0,0,.55)' }}>{e.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ponteiro fixo, sempre no topo */}
      <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', zIndex: 5,
        filter: 'drop-shadow(0 3px 7px rgba(0,0,0,.45))', animation: 'roletaPointer 1.6s ease-in-out infinite' }}>
        <div style={{ width: 0, height: 0, margin: '0 auto',
          borderLeft: '13px solid transparent', borderRight: '13px solid transparent', borderTop: `24px solid ${gold}` }}/>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: gold, margin: '-3px auto 0',
          border: '2px solid #fff' }}/>
      </div>

      {/* Miolo fixo */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: size > 300 ? 66 : 52, height: size > 300 ? 66 : 52, borderRadius: '50%', zIndex: 4,
        background: `radial-gradient(circle at 35% 30%, #fff8, ${gold} 55%, ${gold}dd)`,
        border: '3px solid rgba(255,255,255,.6)', boxShadow: '0 4px 18px rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'roletaHubShine 2.4s ease-in-out infinite' }}>
        <WheelIcon size={size > 300 ? 32 : 26} color="#fff" strokeWidth={1.6}/>
      </div>
    </div>
  );
};

// Fundo do palco: campo de estrelas piscando + umas estrelas cadentes cruzando
// de vez em quando, pra roleta parecer um sorteio "de verdade" num palco.
const Starfield = () => {
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 100,
    size: 1 + Math.random() * 2.6, big: Math.random() < 0.14,
    dur: 1.6 + Math.random() * 3, delay: Math.random() * 4,
  })), []);
  const shooters = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
    id: i, top: 6 + Math.random() * 40, left: 55 + Math.random() * 35,
    dur: 5 + i * 2.4, delay: i * 3.1 + Math.random() * 2,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {stars.map(s => (
        <div key={s.id} style={{ position: 'absolute', left: `${s.left}%`, top: `${s.top}%`,
          width: s.big ? s.size * 2.1 : s.size, height: s.big ? s.size * 2.1 : s.size, borderRadius: '50%',
          background: '#fff', boxShadow: s.big ? '0 0 7px 2px rgba(255,255,255,.9)' : '0 0 3px 1px rgba(255,255,255,.55)',
          animation: `roletaTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }}/>
      ))}
      {shooters.map(s => (
        <div key={s.id} style={{ position: 'absolute', top: `${s.top}%`, left: `${s.left}%`, width: 90, height: 2,
          borderRadius: 2, background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0))',
          transform: 'rotate(-32deg)', opacity: 0,
          animation: `roletaShoot ${s.dur}s ease-in ${s.delay}s infinite` }}/>
      ))}
    </div>
  );
};

const Confetti = ({ seed }) => {
  const pieces = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i, left: Math.random() * 100, hue: Math.round(Math.random() * 360),
    delay: Math.random() * 0.5, dur: 2.4 + Math.random() * 1.6, rot: Math.round(Math.random() * 500),
    size: 6 + Math.round(Math.random() * 7),
  })), [seed]);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 20 }}>
      {pieces.map(p => (
        <div key={p.id} style={{ position: 'absolute', left: `${p.left}%`, top: -20, width: p.size, height: p.size * 0.5,
          background: `hsl(${p.hue} 85% 60%)`, borderRadius: 2,
          animation: `roletaConfetti ${p.dur}s ease-in ${p.delay}s forwards`,
          transform: `rotate(${p.rot}deg)` }}/>
      ))}
    </div>
  );
};

const TabRoletaSorte = () => {
  const isMobile = useIsMobile();
  const isAdmin = getAuthUser()?.role === 'admin';

  const [entries, setEntries] = useState([]);
  const [spin, setSpin] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [angle, setAngle] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | spinning | done
  const [showConfetti, setShowConfetti] = useState(false);
  const revealedRef = useRef(null);
  const rafRef = useRef(null);

  // Admin — formulário de participantes
  const [newLabel, setNewLabel] = useState('');
  const [team, setTeam] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // ── Carga inicial + tempo real ────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureServerClock();
      const cfg = await loadRoletaConfig();
      if (!alive) return;
      setEntries(cfg?.entries || []);
      setSpin(cfg?.spin || null);
      setLoaded(true);
    })();
    const unsub = subscribeRoletaConfig((cfg) => {
      setEntries(cfg?.entries || []);
      setSpin(cfg?.spin || null);
    });
    // Poll de segurança — cobre o raro caso do realtime cair; settings é leve.
    const poll = setInterval(async () => {
      const cfg = await loadRoletaConfig();
      if (!alive || !cfg) return;
      setEntries(cfg.entries || []);
      setSpin(prev => (cfg.spin?.id !== prev?.id ? (cfg.spin || null) : prev));
    }, 25000);
    return () => { alive = false; unsub(); clearInterval(poll); };
  }, []);

  // ── Animação do giro — cada cliente calcula sozinho o ângulo do instante
  // atual a partir do relógio sincronizado; ninguém depende de frame alheio. ──
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!spin) { setAngle(0); setPhase('idle'); return; }
    const t0 = Date.parse(spin.startedAt);
    const dur = spin.durationMs || ROLETA_DURATION_MS;
    const base = spin.baseAngle || 0;
    const delta = spin.finalAngle - base;
    const tick = () => {
      const t = Math.min(Math.max((nowMs() - t0) / dur, 0), 1);
      if (t < 1) {
        setAngle(base + delta * wheelEase(t) + wobbleDeg(t));
        setPhase('spinning');
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setAngle(spin.finalAngle);
        setPhase('done');
        if (revealedRef.current !== spin.id) {
          revealedRef.current = spin.id;
          setShowConfetti(true);
        }
      }
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [spin?.id, spin?.startedAt]);

  useEffect(() => {
    if (!showConfetti) return;
    const id = setTimeout(() => setShowConfetti(false), 4200);
    return () => clearTimeout(id);
  }, [showConfetti]);

  const winnerLabel = phase === 'done' && spin ? spin.entries?.[spin.winnerIndex]?.label : null;
  const spinning = phase === 'spinning';

  // ── Ações do admin ──────────────────────────────────────────────────
  const persist = async (nextEntries) => {
    const before = entries;
    setEntries(nextEntries); // otimista
    setBusy(true);
    try { await saveRoletaConfig({ entries: nextEntries, spin }); }
    catch (e) { setEntries(before); flash('❌ ' + (e.message || 'Erro ao salvar')); }
    setBusy(false);
  };
  const addEntry = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (entries.some(e => e.label.toLowerCase() === label.toLowerCase())) { flash('⚠️ Já tem esse nome/número na roleta'); return; }
    persist([...entries, { id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, label }]);
    setNewLabel('');
  };
  const removeEntry = (id) => persist(entries.filter(e => e.id !== id));
  const addAllColleagues = async () => {
    setBusy(true);
    try {
      let list = team;
      if (!list) {
        const r = await fetch(`${SERVER_URL}/api/team`, { headers: { Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` } });
        const d = await r.json();
        list = (d.employees || []).filter(e => e.active !== false).map(e => e.name);
        setTeam(list);
      }
      const have = new Set(entries.map(e => e.label.toLowerCase()));
      const novos = list.filter(n => !have.has(n.toLowerCase())).map(n => ({ id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${Math.random().toString(36).slice(2, 4)}`, label: n }));
      if (!novos.length) { flash('ℹ️ Todos os colegas já estão na roleta'); setBusy(false); return; }
      await persist([...entries, ...novos]);
      flash(`✅ ${novos.length} colega(s) adicionado(s)`);
    } catch (e) { flash('❌ ' + (e.message || 'Erro ao buscar a equipe')); }
    setBusy(false);
  };
  const doSpin = async () => {
    if (entries.length < 2 || busy) return;
    if (spin && spinProgress(spin) < 1) { flash('⚠️ A roleta já está girando'); return; }
    setBusy(true);
    try {
      await ensureServerClock();
      const rest = restAngleOf({ spin });
      const s = buildSpin(entries, rest);
      setSpin(s); // otimista — todo mundo (inclusive este PC) já começa a girar na hora
      await saveRoletaConfig({ entries, spin: s });
    } catch (e) { flash('❌ ' + (e.message || 'Erro ao girar')); }
    setBusy(false);
  };
  const doReset = async () => {
    if (!window.confirm('Limpar o resultado e parar a roleta na estaca zero?')) return;
    setBusy(true);
    setSpin(null);
    try { await saveRoletaConfig({ entries, spin: null }); }
    catch (e) { flash('❌ ' + (e.message || 'Erro ao limpar')); }
    setBusy(false);
  };

  const wheelSize = isMobile ? 300 : 560;
  const inpSt = { flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 11, border: `1.5px solid ${T.border}`,
    background: T.surfaceSub || 'rgba(0,0,0,.04)', fontSize: 13, color: T.text, fontFamily: 'var(--font-body)',
    outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{`
        @keyframes roletaBulb { 0%,100%{opacity:.25;transform:scale(.7)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes roletaPointer { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(4px)} }
        @keyframes roletaHubShine { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.4)} }
        @keyframes roletaConfetti { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(420px) rotate(640deg);opacity:0} }
        @keyframes roletaWinnerPop { 0%{transform:scale(.6);opacity:0} 65%{transform:scale(1.08);opacity:1} 100%{transform:scale(1)} }
        @keyframes roletaTwinkle { 0%,100%{opacity:.15;transform:scale(.6)} 50%{opacity:1;transform:scale(1)} }
        @keyframes roletaShoot {
          0%{transform:translate(0,0) rotate(-32deg);opacity:0}
          4%{opacity:1} 14%{opacity:0}
          100%{transform:translate(-320px,200px) rotate(-32deg);opacity:0}
        }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '.02em' }}>Roleta da Sorte</div>
        <div style={{ fontSize: 13, color: T.textT, marginTop: 3 }}>
          {isAdmin
            ? 'Monte a roleta e gire — todo mundo no Portal acompanha ao vivo, no mesmo instante.'
            : 'Sorteio ao vivo do RH. Fique de olho: quando alguém girar, a roleta se move sozinha aqui também.'}
        </div>
      </div>

      {/* Palco da roleta — fundo cósmico escuro (de propósito fixo, não segue o
          tema claro/escuro do resto do Portal) pra as estrelas brilharem. */}
      <div style={{ position: 'relative', borderRadius: 24, padding: isMobile ? '32px 12px' : '48px 20px',
        background: 'radial-gradient(120% 90% at 50% 0%, #182849 0%, #0e1730 45%, #060a18 100%)',
        border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, overflow: 'hidden' }}>
        <Starfield/>
        {!loaded ? (
          <div style={{ position: 'relative', zIndex: 1, width: wheelSize, height: wheelSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid ${T.gold}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }}/>
          </div>
        ) : (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Wheel entries={entries} angle={angle} phase={phase} size={wheelSize} gold={T.gold}/>
          </div>
        )}

        {showConfetti && <Confetti seed={spin?.id}/>}

        {loaded && entries.length === 0 && (
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-brand)', letterSpacing: '.01em' }}>
              Aguardando o RH montar a roleta…
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 5 }}>
              Assim que alguém adicionar participantes, ela aparece aqui.
            </div>
          </div>
        )}

        {winnerLabel && (
          <div style={{ position: 'relative', zIndex: 1, animation: 'roletaWinnerPop .5s cubic-bezier(.2,1.4,.4,1)', textAlign: 'center',
            padding: '14px 28px', borderRadius: 16, background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`,
            boxShadow: `0 10px 30px ${T.goldLine || T.gold}55`, color: '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .85 }}>🎉 Ganhou a roleta</div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-brand)', marginTop: 2 }}>{winnerLabel}</div>
          </div>
        )}
        {spinning && (
          <div style={{ position: 'relative', zIndex: 1, fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)' }}>Girando… 🎲</div>
        )}
      </div>

      {/* Painel do admin */}
      {isAdmin && (
        <div style={{ marginTop: 18, padding: '20px 22px', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}`,
          boxShadow: T.shM, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 700, color: T.text }}>⚙️ Configurar a roleta</div>
            <div style={{ fontSize: 12, color: T.textS, marginTop: 3 }}>Adicione números, nomes de colaboradores ou qualquer rótulo — cada um vira um gomo da roleta.</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addEntry(); }}
              placeholder="Ex.: 42, ou o nome de alguém..." style={inpSt}/>
            <button onClick={addEntry} disabled={busy || !newLabel.trim()}
              style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: '#fff', fontWeight: 700,
                fontSize: 13, fontFamily: 'var(--font-body)', opacity: (busy || !newLabel.trim()) ? .6 : 1 }}>
              + Adicionar
            </button>
            <button onClick={addAllColleagues} disabled={busy}
              style={{ padding: '10px 16px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${T.border}`,
                background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)', opacity: busy ? .6 : 1 }}>
              + Todos os colegas
            </button>
          </div>

          {entries.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {entries.map((e, i) => (
                <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 11px',
                  borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#fff', background: segColor(i, entries.length) }}>
                  {e.label}
                  <button onClick={() => removeEntry(e.id)} title="Remover"
                    style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.25)',
                      color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <button onClick={doSpin} disabled={busy || entries.length < 2 || spinning}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 26px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, color: '#fff', fontWeight: 800,
                fontSize: 14.5, fontFamily: 'var(--font-body)', boxShadow: `0 4px 16px ${T.goldLine || T.gold}44`,
                opacity: (busy || entries.length < 2 || spinning) ? .55 : 1 }}>
              <WheelIcon size={18} color="#fff" strokeWidth={2}/>
              Girar a roleta!
            </button>
            <button onClick={doReset} disabled={busy || !spin}
              style={{ padding: '10px 16px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${T.danger || '#C04050'}55`,
                background: 'transparent', color: T.danger || '#C04050', fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)',
                opacity: (busy || !spin) ? .5 : 1 }}>
              Limpar resultado
            </button>
            {entries.length < 2 && <span style={{ fontSize: 12, color: T.textT }}>Adicione pelo menos 2 participantes pra poder girar.</span>}
            {msg && <span style={{ fontSize: 13, color: msg.startsWith('✅') || msg.startsWith('ℹ️') ? (T.success || '#3a9') : '#C04050', fontWeight: 600 }}>{msg}</span>}
          </div>

          <div style={{ fontSize: 11, color: T.textT, lineHeight: 1.6 }}>
            ℹ️ O giro aparece na hora pra todo mundo no Portal, mesmo quem estiver com a aba aberta em outro computador. Editar a lista não mexe num giro já em andamento — só vale pro próximo.
          </div>
        </div>
      )}
    </div>
  );
};

export { TabRoletaSorte };
