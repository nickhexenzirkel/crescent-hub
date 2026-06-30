// src/shared/CaptureUnikoWidget.jsx
// Widget "Capture o Uniko" — encontro estilo Pokémon GO que vive DENTRO do card do
// Portal do Colaborador (TabInicio), não numa tela no meio. Estados:
//   • idle      → mostra o `placeholder` (card "EM BREVE/aguardando" do TabInicio)
//   • available → encontro: cenário temático (pixels/morcegos/castelo), Uniko grande e a
//                 bolinha UNIKO_CAPTURAR que o usuário ARRASTA e ARREMESSA pra cima.
//   • caught    → mostra QUEM capturou e o HORÁRIO.
// Duas tentativas: na 1ª ele pode escapar; na 2ª a captura é garantida.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuthUser } from '../contexts/user';
import {
  getUniko, isWithinWindow, isCaptureDone, markCaptureDone,
  saveCaptureToCollection, emitCaptureState, getCaptureResult, setCaptureResult,
} from './captureUniko';

const BALL_IMG = '/UNIKO_CAPTURAR.png';

const SPAWN_MIN = 6000;     // 6s
const SPAWN_MAX = 45000;    // 45s
const ESCAPE_CHANCE = 0.6;  // chance de escapar na 1ª tentativa (2ª é garantida)
const rand = (a, b) => a + Math.random() * (b - a);

const fmtWhen = (iso) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

/* ── Cenário de pixels: morcegos, castelo e partículas (temáticos) ── */
const PixelBat = ({ color, style }) => (
  <svg width="22" height="14" viewBox="0 0 11 7" shapeRendering="crispEdges" style={style} aria-hidden="true">
    <rect x="0" y="2" width="1" height="1" fill={color}/><rect x="1" y="1" width="1" height="2" fill={color}/>
    <rect x="2" y="2" width="1" height="2" fill={color}/><rect x="3" y="3" width="1" height="1" fill={color}/>
    <rect x="4" y="2" width="3" height="3" fill={color}/><rect x="5" y="1" width="1" height="1" fill={color}/>
    <rect x="7" y="3" width="1" height="1" fill={color}/><rect x="8" y="2" width="1" height="2" fill={color}/>
    <rect x="9" y="1" width="1" height="2" fill={color}/><rect x="10" y="2" width="1" height="1" fill={color}/>
  </svg>
);

const PixelCastle = ({ color, glow }) => (
  <svg width="100%" height="64" viewBox="0 0 64 24" preserveAspectRatio="xMidYMax meet" shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.9 }} aria-hidden="true">
    <g fill={color}>
      <rect x="4" y="8" width="8" height="16"/><rect x="4" y="6" width="2" height="2"/><rect x="8" y="6" width="2" height="2"/>
      <rect x="52" y="8" width="8" height="16"/><rect x="52" y="6" width="2" height="2"/><rect x="56" y="6" width="2" height="2"/>
      <rect x="12" y="12" width="40" height="12"/><rect x="14" y="10" width="3" height="2"/><rect x="20" y="10" width="3" height="2"/><rect x="26" y="10" width="3" height="2"/><rect x="35" y="10" width="3" height="2"/><rect x="41" y="10" width="3" height="2"/><rect x="47" y="10" width="3" height="2"/>
      <rect x="28" y="4" width="8" height="20"/><rect x="28" y="2" width="2" height="2"/><rect x="34" y="2" width="2" height="2"/>
    </g>
    <rect x="30" y="8" width="2" height="3" fill={glow}/><rect x="6" y="12" width="2" height="2" fill={glow}/><rect x="54" y="12" width="2" height="2" fill={glow}/>
  </svg>
);

const CaptureUnikoWidget = ({ cfg, placeholder = null }) => {
  const uniko = getUniko(cfg?.unikoId);
  const th = uniko.theme;

  const [available, setAvailable] = useState(false);
  const [result, setResult]       = useState(() => (cfg ? getCaptureResult(cfg) : null)); // {player, at} | null
  const [attempts, setAttempts]   = useState(0);
  const [phase, setPhase]         = useState('idle'); // idle | aiming | thrown | escaped | caught
  const [off, setOff]             = useState({ x: 0, y: 0 });
  const [throwing, setThrowing]   = useState(false);

  const sceneRef = useRef(null);
  const unikoRef = useRef(null);
  const dragRef  = useRef(null);
  const offRef = useRef(off); offRef.current = off;
  const attemptsRef = useRef(0); attemptsRef.current = attempts;

  const captured = phase === 'caught' || !!result;

  /* ── Surgimento aleatório dentro da janela ── */
  useEffect(() => {
    if (!cfg || isCaptureDone(cfg)) return;
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
  }, [cfg]);

  /* ── Avisa o assistente quando está disponível (heartbeat) ── */
  useEffect(() => {
    if (available && phase !== 'caught') emitCaptureState({ available: true, uniko });
    return () => emitCaptureState({ available: false, uniko: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  /* ── Arrastar a bolinha e soltar pra cima no Uniko ── */
  const onPointerDown = useCallback((e) => {
    if (phase === 'thrown' || phase === 'caught') return;
    e.preventDefault();
    const sc = sceneRef.current?.getBoundingClientRect();
    if (!sc) return;
    dragRef.current = { baseX: sc.left + sc.width / 2, baseY: sc.bottom - 44, active: true };
    setThrowing(false);
    setPhase('aiming');
  }, [phase]);

  useEffect(() => {
    const move = (cx, cy) => {
      const d = dragRef.current; if (!d?.active) return;
      setOff({ x: cx - d.baseX, y: cy - d.baseY });
    };
    const onMove  = (e) => move(e.clientX, e.clientY);
    const onTMove = (e) => { if (e.touches[0]) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } };
    const onUp = () => {
      const d = dragRef.current; if (!d?.active) return;
      dragRef.current.active = false;
      if (offRef.current.y < -24) throwBall(d);
      else { setThrowing(true); setPhase('idle'); setOff({ x: 0, y: 0 }); }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTMove);
      document.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const throwBall = (d) => {
    const ur = unikoRef.current?.getBoundingClientRect();
    setPhase('thrown');
    setThrowing(true);
    if (ur) setOff({ x: (ur.left + ur.width / 2) - d.baseX, y: (ur.top + ur.height / 2) - d.baseY });
    setTimeout(resolveAttempt, 440);
  };

  const resolveAttempt = () => {
    const n = attemptsRef.current + 1;
    setAttempts(n);
    const escaped = n === 1 && Math.random() < ESCAPE_CHANCE;
    if (escaped) {
      setPhase('escaped');
      setTimeout(() => { setThrowing(true); setOff({ x: 0, y: 0 }); setPhase('idle'); }, 1100);
    } else {
      const res = { player: getAuthUser()?.name || 'Você', at: new Date().toISOString() };
      setPhase('caught');
      setResult(res);
      markCaptureDone(cfg);
      setCaptureResult(cfg, res);
      saveCaptureToCollection(uniko);
      emitCaptureState({ available: false, uniko, captured: true });
    }
  };

  /* ════════ RENDER ════════ */

  // CAPTURADO — mostra quem capturou e quando
  if (captured) {
    return (
      <div className="home-card" style={{ position: 'relative', minHeight: 118, borderRadius: 16, overflow: 'hidden', marginBottom: 14, padding: 3, background: `conic-gradient(${th.border.join(',')})` }}>
        <style>{`@keyframes cuCaught{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>
        <div style={{ borderRadius: 13, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', minHeight: 112 }}>
          <img src={uniko.img} alt={uniko.name} style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 16px ${th.accent})`, animation: 'cuCaught .6s ease-out' }}/>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.12em', color: th.glow }}>✓ CAPTURADO</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-brand)', letterSpacing: '.02em', lineHeight: 1.1 }}>{uniko.name}</div>
            <div style={{ fontSize: 12, color: th.ink, marginTop: 4 }}>
              Capturado por <strong style={{ color: '#fff' }}>{result?.player || 'Você'}</strong>
              {result?.at && <> · {fmtWhen(result.at)}</>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DISPONÍVEL — encontro inline (card expandido)
  if (available) {
    const ballTransform = `translate(calc(-50% + ${off.x}px), ${off.y}px) scale(${phase === 'thrown' ? 0.42 : 1})`;
    const ballTransition = throwing
      ? (phase === 'thrown' ? 'transform .44s cubic-bezier(.5,-0.2,.7,.6), opacity .3s' : 'transform .3s cubic-bezier(.34,1.56,.64,1)')
      : 'none';
    return (
      <div className="home-card" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 14, padding: 3, background: th.deep, boxShadow: `0 10px 34px ${th.accent}44` }}>
        <style>{`
          @property --cuAng{syntax:'<angle>';initial-value:0deg;inherits:false}
          @keyframes cuBorder{to{--cuAng:360deg}}
          @keyframes cuIdle{0%,100%{transform:translateX(-50%) translateY(0) rotate(-1deg)}50%{transform:translateX(-50%) translateY(-9px) rotate(1deg)}}
          @keyframes cuDodge{0%{transform:translateX(-50%)}25%{transform:translateX(-50%) translate(-44px,-6px) scale(.92)}55%{transform:translateX(-50%) translate(40px,6px) scale(.95)}100%{transform:translateX(-50%)}}
          @keyframes cuCaughtA{0%{transform:translateX(-50%) scale(1)}30%{transform:translateX(-50%) scale(1.16) rotate(4deg)}100%{transform:translateX(-50%) scale(1.05)}}
          @keyframes cuBatFly{from{transform:translateX(-30px)}to{transform:translateX(520px)}}
          @keyframes cuPixUp{0%{transform:translateY(16px);opacity:0}20%{opacity:1}100%{transform:translateY(-90px);opacity:0}}
          @keyframes cuRing{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
          @keyframes cuPulse{0%,100%{opacity:.5}50%{opacity:1}}
        `}</style>
        {/* borda cônica girando (moldura mascarada) */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, padding: 3, background: `conic-gradient(from var(--cuAng), ${th.border.join(',')})`, animation: 'cuBorder 4s linear infinite', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }}/>

        <div ref={sceneRef} style={{ position: 'relative', borderRadius: 13, overflow: 'hidden', background: th.scene, height: 300, touchAction: 'none' }}>
          {/* título */}
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', color: th.glow, textShadow: `0 0 10px ${th.accent}`, animation: 'cuPulse 1.6s ease-in-out infinite' }}>★ CAPTURE O UNIKO ★</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2, fontFamily: 'var(--font-brand)', letterSpacing: '.03em', textShadow: `0 2px 12px ${th.accent2}` }}>{uniko.name}</div>
          </div>

          {/* partículas */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: 46, left: `${(i * 8 + 5) % 96}%`, width: 4, height: 4, background: th.pixel, opacity: .7, boxShadow: `0 0 6px ${th.glow}`, animation: `cuPixUp ${rand(3.5, 7).toFixed(2)}s linear ${(i * 0.4).toFixed(2)}s infinite` }}/>
          ))}
          {/* morcegos */}
          {[{ t: 56, d: 7, dl: 0 }, { t: 92, d: 9, dl: 1.5 }, { t: 74, d: 6, dl: 3 }].map((b, i) => (
            <div key={i} style={{ position: 'absolute', top: b.t, left: -30, animation: `cuBatFly ${b.d}s linear ${b.dl}s infinite`, opacity: .85 }}>
              <PixelBat color={th.bat} style={{ filter: `drop-shadow(0 0 3px ${th.accent})` }}/>
            </div>
          ))}
          {/* castelo */}
          <PixelCastle color={th.castle} glow={th.glow}/>

          {/* anel de mira */}
          <div style={{ position: 'absolute', left: '50%', top: 138, width: 110, height: 110, border: `3px solid ${th.glow}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cuRing 2s ease-out infinite', pointerEvents: 'none' }}/>

          {/* O UNIKO grande */}
          <img ref={unikoRef} src={uniko.img} alt={uniko.name} draggable="false"
            style={{ position: 'absolute', left: '50%', top: 78, transform: 'translateX(-50%)', width: 130, height: 130, objectFit: 'contain', zIndex: 3, filter: `drop-shadow(0 0 22px ${th.accent}) drop-shadow(0 8px 16px rgba(0,0,0,.6))`, animation: phase === 'escaped' ? 'cuDodge .9s ease-in-out' : 'cuIdle 3.5s ease-in-out infinite' }}/>

          {/* mensagem de escape */}
          {phase === 'escaped' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 64, textAlign: 'center', zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#ffd9a0', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,180,80,.4)' }}>Escapou! Tente de novo 💢</div>
            </div>
          )}

          {/* HUD inferior */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 84, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, color: th.ink, opacity: .9, marginBottom: 5 }}>{phase === 'thrown' ? '...' : 'Arraste e arremesse pra cima! ☝️'}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[0, 1].map(i => (
                <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < attempts ? '#6b7280' : th.glow, boxShadow: i < attempts ? 'none' : `0 0 8px ${th.glow}` }}/>
              ))}
            </div>
          </div>

          {/* A BOLINHA (UNIKO_CAPTURAR) */}
          {phase !== 'escaped' && (
            <img src={BALL_IMG} alt="Capturar" draggable="false"
              onMouseDown={onPointerDown} onTouchStart={onPointerDown}
              style={{ position: 'absolute', left: '50%', bottom: 14, width: 58, height: 58, zIndex: 8, cursor: phase === 'thrown' ? 'default' : 'grab', objectFit: 'contain', transform: ballTransform, transition: ballTransition, opacity: phase === 'thrown' ? 0.85 : 1, touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', filter: `drop-shadow(0 6px 14px ${th.accent}aa)` }}/>
          )}
        </div>
      </div>
    );
  }

  // IDLE — card "aguardando" (placeholder do TabInicio)
  return placeholder;
};

export default CaptureUnikoWidget;
