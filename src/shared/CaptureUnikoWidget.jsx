// src/shared/CaptureUnikoWidget.jsx
// Widget "Capture o Uniko" — encontro dentro do card do Portal (TabInicio).
// MECÂNICA: o Uniko grande aparece no widget; o usuário ARRASTA O ASSISTENTE UNIKO
// (canto da tela) e SOLTA em cima do Uniko pra arremessar e capturar (estilo Pokémon GO).
// • SÓ UM colaborador captura por evento (lock global no Supabase).
// • Quem captura ganha 100 Prismas Comuns + 100 Prismas Premium (mostrado no widget).
// • O Uniko capturado vai pra coleção do My Uniko.
// • Duas tentativas: na 1ª ele pode escapar; na 2ª a captura é garantida.
import React, { useState, useEffect, useRef } from 'react';
import { getAuthUser } from '../contexts/user';
import {
  getUniko, isWithinWindow, isCaptureDone, markCaptureDone,
  saveCaptureToCollection, emitCaptureState, getCaptureResult, setCaptureResult,
  CAPTURE_REWARD, fetchCaptureWinner, claimCapture, awardPrismas, addToMyUnikoCollection,
  registerCaptureTarget, onCaptureThrow, clearCaptureLocal,
} from './captureUniko';

const SPAWN_MIN = 6000;     // 6s
const SPAWN_MAX = 45000;    // 45s
const ESCAPE_CHANCE = 0.6;  // chance de escapar na 1ª tentativa (2ª é garantida)
const rand = (a, b) => a + Math.random() * (b - a);

const fmtWhen = (iso) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

/* ── Cenário de pixels ── */
// Morcego de pixel com asas separadas (pra "bater" via animação de cada asa).
const PixelBat = ({ color, size = 1 }) => (
  <svg width={26 * size} height={16 * size} viewBox="0 0 13 8" shapeRendering="crispEdges" aria-hidden="true" style={{ overflow: 'visible' }}>
    {/* corpo + cabeça */}
    <g fill={color}>
      <rect x="5" y="2" width="3" height="4"/><rect x="6" y="1" width="1" height="1"/>
    </g>
    {/* asa esquerda (gira no canto interno) */}
    <g fill={color} className="cuWingL" style={{ transformBox: 'fill-box', transformOrigin: '100% 50%' }}>
      <rect x="0" y="2" width="1" height="2"/><rect x="1" y="1" width="1" height="3"/>
      <rect x="2" y="2" width="1" height="3"/><rect x="3" y="3" width="1" height="2"/><rect x="4" y="2" width="1" height="3"/>
    </g>
    {/* asa direita */}
    <g fill={color} className="cuWingR" style={{ transformBox: 'fill-box', transformOrigin: '0% 50%' }}>
      <rect x="8" y="2" width="1" height="3"/><rect x="9" y="3" width="1" height="2"/>
      <rect x="10" y="2" width="1" height="3"/><rect x="11" y="1" width="1" height="3"/><rect x="12" y="2" width="1" height="2"/>
    </g>
  </svg>
);
// Castelo GRANDE no canto superior direito do widget.
const PixelCastle = ({ color, glow }) => (
  <svg width="190" height="150" viewBox="0 0 38 30" shapeRendering="crispEdges" style={{ position: 'absolute', top: 0, right: 0, opacity: 0.92 }} aria-hidden="true">
    <g fill={color}>
      {/* torre direita alta (na borda) */}
      <rect x="28" y="2" width="9" height="28"/><rect x="28" y="0" width="2" height="2"/><rect x="32" y="0" width="2" height="2"/><rect x="36" y="0" width="2" height="2"/>
      {/* corpo central */}
      <rect x="14" y="9" width="16" height="21"/><rect x="14" y="7" width="2" height="2"/><rect x="18" y="7" width="2" height="2"/><rect x="22" y="7" width="2" height="2"/><rect x="26" y="7" width="2" height="2"/>
      {/* torre esquerda menor */}
      <rect x="6" y="14" width="8" height="16"/><rect x="6" y="12" width="2" height="2"/><rect x="10" y="12" width="2" height="2"/>
      {/* torre fininha extra */}
      <rect x="0" y="18" width="6" height="12"/><rect x="0" y="16" width="2" height="2"/><rect x="4" y="16" width="2" height="2"/>
    </g>
    {/* janelas acesas (glow) */}
    <rect x="31" y="6" width="2" height="3" fill={glow}/><rect x="31" y="13" width="2" height="3" fill={glow}/>
    <rect x="20" y="13" width="2" height="3" fill={glow}/><rect x="20" y="20" width="2" height="3" fill={glow}/>
    <rect x="9" y="18" width="2" height="2" fill={glow}/><rect x="2" y="22" width="2" height="2" fill={glow}/>
  </svg>
);
// Lua de sangue no fundo do cenário.
const BloodMoon = ({ color, glow }) => (
  <div style={{ position: 'absolute', top: 16, left: '14%', width: 78, height: 78, borderRadius: '50%', zIndex: 0,
    background: `radial-gradient(circle at 38% 34%, ${glow} 0%, ${color} 46%, #4a060e 100%)`,
    boxShadow: `0 0 36px 8px ${color}aa, inset -6px -6px 18px rgba(0,0,0,.55)` }} aria-hidden="true">
    {/* crateras */}
    <span style={{ position: 'absolute', top: '30%', left: '54%', width: 12, height: 12, borderRadius: '50%', background: 'rgba(0,0,0,.18)' }}/>
    <span style={{ position: 'absolute', top: '58%', left: '32%', width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,.16)' }}/>
    <span style={{ position: 'absolute', top: '20%', left: '24%', width: 8, height: 8, borderRadius: '50%', background: 'rgba(0,0,0,.14)' }}/>
  </div>
);

const CaptureUnikoWidget = ({ cfg, placeholder = null }) => {
  const uniko = getUniko(cfg?.unikoId);
  const th = uniko.theme;

  const [available, setAvailable] = useState(false);
  const [result, setResult]       = useState(() => (cfg ? getCaptureResult(cfg) : null)); // {player,at,comum,premium,mine}
  const [attempts, setAttempts]   = useState(0);
  const [phase, setPhase]         = useState('idle'); // idle | thrown | escaped | caught
  const [checked, setChecked]     = useState(false);

  const sceneRef = useRef(null);
  const unikoRef = useRef(null);
  const attemptsRef = useRef(0); attemptsRef.current = attempts;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const resolvingRef = useRef(false);

  const captured = phase === 'caught' || !!result;

  /* ── Já capturado globalmente? (1 por evento) — SERVIDOR é a fonte da verdade,
     pra um reset do admin refletir aqui (limpa o cache local). ── */
  useEffect(() => {
    let alive = true;
    if (!cfg) { setChecked(true); return; }
    (async () => {
      const w = await fetchCaptureWinner(cfg);
      if (!alive) return;
      if (w === undefined) {                 // erro de rede → confia no cache local
        const cached = getCaptureResult(cfg);
        if (cached) setResult(cached);
        setChecked(true); return;
      }
      if (w) {                               // alguém capturou (eu ou outro)
        const me = getAuthUser()?.name;
        const res = { player: w.player, at: w.at, comum: w.comum, premium: w.premium, mine: w.player === me };
        setResult(res); setCaptureResult(cfg, res); markCaptureDone(cfg);
      } else {                               // sem vencedor (ou resetado) → libera
        setResult(null); clearCaptureLocal(cfg);
      }
      setChecked(true);
    })();
    return () => { alive = false; };
  }, [cfg]);

  /* ── Surgimento aleatório dentro da janela ── */
  useEffect(() => {
    if (!cfg || !checked || result || isCaptureDone(cfg)) return;
    let spawnT, scheduled = false;
    const schedule = () => {
      if (scheduled || isCaptureDone(cfg) || !isWithinWindow(cfg)) return;
      scheduled = true;
      spawnT = setTimeout(() => {
        if (isCaptureDone(cfg) || !isWithinWindow(cfg)) { scheduled = false; return; }
        setAvailable(true);
      }, rand(SPAWN_MIN, SPAWN_MAX));
    };
    schedule();
    const tick = setInterval(() => {
      if (isCaptureDone(cfg)) return;
      if (isWithinWindow(cfg)) schedule();
      else setAvailable(false);
    }, 20000);
    return () => { clearTimeout(spawnT); clearInterval(tick); };
  }, [cfg, checked, result]);

  /* ── Registra o ALVO e avisa o assistente quando está disponível ── */
  useEffect(() => {
    if (available && phase !== 'caught') {
      emitCaptureState({ available: true, uniko });
      registerCaptureTarget(() => unikoRef.current?.getBoundingClientRect() || sceneRef.current?.getBoundingClientRect() || null);
    }
    return () => { emitCaptureState({ available: false, uniko: null }); registerCaptureTarget(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  /* ── Recebe o ARREMESSO do assistente (solto em cima do Uniko) ── */
  useEffect(() => {
    const off = onCaptureThrow(() => {
      if (phaseRef.current !== 'idle' || resolvingRef.current) return;
      setPhase('thrown');
      setTimeout(resolveAttempt, 520);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveAttempt = async () => {
    resolvingRef.current = true;
    const n = attemptsRef.current + 1;
    setAttempts(n);
    const escaped = n === 1 && Math.random() < ESCAPE_CHANCE;
    if (escaped) {
      setPhase('escaped');
      setTimeout(() => { setPhase('idle'); resolvingRef.current = false; }, 1200);
      return;
    }
    // tenta capturar de fato — lock global (só 1 vence)
    const { won, winner } = await claimCapture(cfg, uniko);
    const me = getAuthUser()?.name || 'Você';
    markCaptureDone(cfg);
    if (won) {
      awardPrismas(me, CAPTURE_REWARD.comum, CAPTURE_REWARD.premium);
      addToMyUnikoCollection(uniko);
      saveCaptureToCollection(uniko);
      const res = { player: me, at: new Date().toISOString(), comum: CAPTURE_REWARD.comum, premium: CAPTURE_REWARD.premium, mine: true };
      setResult(res); setCaptureResult(cfg, res);
      emitCaptureState({ available: false, uniko, captured: true });
    } else {
      const res = { player: winner?.player || '—', at: winner?.at, comum: winner?.comum || 0, premium: winner?.premium || 0, mine: false };
      setResult(res); setCaptureResult(cfg, res);
      emitCaptureState({ available: false, uniko: null });
    }
    setPhase('caught');
    resolvingRef.current = false;
  };

  /* ════════ RENDER ════════ */
  if (!checked) return placeholder;

  // CAPTURADO — mostra quem capturou, quando e quantos prismas ganhou
  if (captured) {
    const r = result || {};
    return (
      <div className="home-card" style={{ position: 'relative', minHeight: 118, borderRadius: 16, overflow: 'hidden', marginBottom: 14, padding: 3, background: `conic-gradient(${th.border.join(',')})` }}>
        <style>{`@keyframes cuCaught{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>
        <div style={{ borderRadius: 13, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', minHeight: 112 }}>
          <img src={uniko.img} alt={uniko.name} style={{ width: 76, height: 76, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 16px ${th.accent})`, animation: 'cuCaught .6s ease-out' }}/>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', color: th.glow }}>✓ CAPTURADO</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-brand)', letterSpacing: '.02em', lineHeight: 1.1 }}>{uniko.name}</div>
            <div style={{ fontSize: 12, color: th.ink, marginTop: 3 }}>
              {r.mine ? 'Você capturou' : <>Capturado por <strong style={{ color: '#fff' }}>{r.player}</strong></>}
              {r.at && <> · {fmtWhen(r.at)}</>}
            </div>
            {(r.comum > 0 || r.premium > 0) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(39,198,222,.18)', border: '1px solid rgba(39,198,222,.5)', borderRadius: 999, padding: '3px 10px' }}>
                  <img src="/PrismaComum.png" alt="" onError={e=>{e.target.style.display='none';}} style={{ width: 16, height: 16, objectFit: 'contain' }}/>+{r.comum} Comum
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(155,107,255,.2)', border: '1px solid rgba(155,107,255,.55)', borderRadius: 999, padding: '3px 10px' }}>
                  <img src="/PrismaPremium.png" alt="" onError={e=>{e.target.style.display='none';}} style={{ width: 16, height: 16, objectFit: 'contain' }}/>+{r.premium} Premium
                </span>
              </div>
            )}
            {r.mine && <div style={{ fontSize: 10.5, color: th.glow, marginTop: 6 }}>Disponível na coleção do My Uniko 🐾</div>}
          </div>
        </div>
      </div>
    );
  }

  // DISPONÍVEL — encontro (arraste o assistente até aqui)
  if (available) {
    return (
      <div className="home-card" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 14, padding: 3, background: th.deep, boxShadow: `0 10px 34px ${th.accent}44` }}>
        <style>{`
          @property --cuAng{syntax:'<angle>';initial-value:0deg;inherits:false}
          @keyframes cuBorder{to{--cuAng:360deg}}
          @keyframes cuIdle{0%,100%{transform:translateX(-50%) translateY(0) rotate(-1deg)}50%{transform:translateX(-50%) translateY(-9px) rotate(1deg)}}
          @keyframes cuDodge{0%{transform:translateX(-50%)}25%{transform:translateX(-50%) translate(-46px,-6px) scale(.92)}55%{transform:translateX(-50%) translate(42px,6px) scale(.95)}100%{transform:translateX(-50%)}}
          @keyframes cuHit{0%,100%{transform:translateX(-50%)}20%{transform:translateX(-50%) translateX(-8px) scale(1.06)}40%{transform:translateX(-50%) translateX(8px) scale(.96)}60%{transform:translateX(-50%) translateX(-5px)}80%{transform:translateX(-50%) translateX(5px)}}
          @keyframes cuPixUp{0%{transform:translateY(16px);opacity:0}20%{opacity:1}100%{transform:translateY(-90px);opacity:0}}
          @keyframes cuRing{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
          @keyframes cuPulse{0%,100%{opacity:.5}50%{opacity:1}}
          /* morcegos voando nas diagonais (direções variadas) */
          @keyframes cuFly0{from{transform:translate(-40px,46px)}to{transform:translate(440px,-140px)}}
          @keyframes cuFly1{from{transform:translate(-40px,-24px)}to{transform:translate(460px,156px)}}
          @keyframes cuFly2{from{transform:translate(460px,20px)}to{transform:translate(-60px,-130px)}}
          @keyframes cuFly3{from{transform:translate(470px,96px)}to{transform:translate(-60px,-40px)}}
          /* bater de asas */
          @keyframes cuFlap{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.18)}}
          .cuWingL,.cuWingR{animation:cuFlap .26s ease-in-out infinite}
        `}</style>
        {/* borda cônica girando */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, padding: 3, background: `conic-gradient(from var(--cuAng), ${th.border.join(',')})`, animation: 'cuBorder 4s linear infinite', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }}/>

        <div ref={sceneRef} style={{ position: 'relative', borderRadius: 13, overflow: 'hidden', background: th.scene, height: 300 }}>
          {/* título */}
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', color: th.glow, textShadow: `0 0 10px ${th.accent}`, animation: 'cuPulse 1.6s ease-in-out infinite' }}>★ CAPTURE O UNIKO ★</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2, fontFamily: 'var(--font-brand)', letterSpacing: '.03em', textShadow: `0 2px 12px ${th.accent2}` }}>{uniko.name}</div>
          </div>

          {/* lua de sangue + castelo grande (canto sup. direito) */}
          <BloodMoon color={th.moon || th.accent} glow={th.moonGlow || th.glow}/>
          <PixelCastle color={th.castle} glow={th.glow}/>

          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: 40, left: `${(i * 8 + 5) % 96}%`, width: 4, height: 4, background: th.pixel, opacity: .7, boxShadow: `0 0 6px ${th.glow}`, animation: `cuPixUp ${rand(3.5, 7).toFixed(2)}s linear ${(i * 0.4).toFixed(2)}s infinite`, zIndex: 1 }}/>
          ))}
          {/* morcegos voando nas diagonais batendo as asas */}
          {[{ fly: 0, d: 8, dl: 0, s: 1.1 }, { fly: 1, d: 10, dl: 1.2, s: .85 }, { fly: 2, d: 7, dl: 2.4, s: 1 }, { fly: 3, d: 9, dl: 3.6, s: .7 }, { fly: 0, d: 11, dl: 5, s: .9 }].map((b, i) => (
            <div key={i} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, animation: `cuFly${b.fly} ${b.d}s linear ${b.dl}s infinite` }}>
              <div style={{ filter: `drop-shadow(0 0 3px ${th.accent})` }}><PixelBat color={th.bat} size={b.s}/></div>
            </div>
          ))}

          {/* anel de mira */}
          <div style={{ position: 'absolute', left: '50%', top: 138, width: 116, height: 116, border: `3px solid ${th.glow}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cuRing 2s ease-out infinite', pointerEvents: 'none' }}/>

          {/* O UNIKO grande (alvo do arremesso) */}
          <img ref={unikoRef} src={uniko.img} alt={uniko.name} draggable="false"
            style={{ position: 'absolute', left: '50%', top: 76, transform: 'translateX(-50%)', width: 132, height: 132, objectFit: 'contain', zIndex: 3, filter: `drop-shadow(0 0 22px ${th.accent}) drop-shadow(0 8px 16px rgba(0,0,0,.6))`, animation: phase === 'escaped' ? 'cuDodge .9s ease-in-out' : phase === 'thrown' ? 'cuHit .5s ease-in-out' : 'cuIdle 3.5s ease-in-out infinite' }}/>

          {phase === 'escaped' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#ffd9a0', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,180,80,.4)' }}>Escapou! Joga o UNIKO de novo 💢</div>
            </div>
          )}

          {/* HUD inferior */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11.5, color: '#fff', fontWeight: 700, marginBottom: 6, textShadow: `0 1px 8px ${th.accent2}` }}>
              {phase === 'thrown' ? '...' : '🤖 Arraste o assistente UNIKO até aqui e solte!'}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[0, 1].map(i => (
                <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < attempts ? '#6b7280' : th.glow, boxShadow: i < attempts ? 'none' : `0 0 8px ${th.glow}` }}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IDLE — placeholder do TabInicio
  return placeholder;
};

export default CaptureUnikoWidget;
