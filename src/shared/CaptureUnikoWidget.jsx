// src/shared/CaptureUnikoWidget.jsx
// Widget "Capture o Uniko" — encontro estilo Pokémon GO dentro do Portal do Colaborador.
// • Surge ALEATORIAMENTE dentro da janela definida pelo RH (sorteia um momento ao entrar).
// • Borda cônica animada + cenário interno 100% temático do Uniko (pixels roxos, morcegos
//   de pixel, castelo de pixel, para o Vampire-Robot).
// • O usuário ARRASTA a bolinha UNIKO_CAPTURAR e a ARREMESSA pra cima no Uniko grande.
// • Duas tentativas: na 1ª ele pode escapar; na 2ª a captura é garantida.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getUniko, isWithinWindow, isCaptureDone, markCaptureDone,
  saveCaptureToCollection, emitCaptureState,
} from './captureUniko';

const BALL_IMG = '/UNIKO_CAPTURAR.png';

// Surgimento aleatório dentro da janela: espera um tempo após o usuário entrar no Portal.
const SPAWN_MIN = 6000;    // 6s
const SPAWN_MAX = 45000;   // 45s
const RETRY_COOLDOWN = 90000; // se o usuário fechar sem capturar, volta depois de ~90s
const ESCAPE_CHANCE = 0.6;  // chance de escapar na 1ª tentativa (2ª é garantida)
const rand = (a, b) => a + Math.random() * (b - a);

/* ── Cenário de pixels: morcegos voando, castelo e partículas (temáticos) ── */
const PixelBat = ({ color, style }) => (
  <svg width="22" height="14" viewBox="0 0 11 7" shapeRendering="crispEdges" style={style} aria-hidden="true">
    {/* asa esq */}<rect x="0" y="2" width="1" height="1" fill={color}/><rect x="1" y="1" width="1" height="2" fill={color}/>
    <rect x="2" y="2" width="1" height="2" fill={color}/><rect x="3" y="3" width="1" height="1" fill={color}/>
    {/* corpo */}<rect x="4" y="2" width="3" height="3" fill={color}/><rect x="5" y="1" width="1" height="1" fill={color}/>
    {/* asa dir */}<rect x="7" y="3" width="1" height="1" fill={color}/><rect x="8" y="2" width="1" height="2" fill={color}/>
    <rect x="9" y="1" width="1" height="2" fill={color}/><rect x="10" y="2" width="1" height="1" fill={color}/>
  </svg>
);

const PixelCastle = ({ color, glow }) => (
  <svg width="100%" height="80" viewBox="0 0 64 24" preserveAspectRatio="xMidYMax meet" shapeRendering="crispEdges" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.9 }} aria-hidden="true">
    <g fill={color}>
      {/* torres laterais com ameias */}
      <rect x="4" y="8" width="8" height="16"/><rect x="4" y="6" width="2" height="2"/><rect x="8" y="6" width="2" height="2"/>
      <rect x="52" y="8" width="8" height="16"/><rect x="52" y="6" width="2" height="2"/><rect x="56" y="6" width="2" height="2"/>
      {/* muralha central */}
      <rect x="12" y="12" width="40" height="12"/><rect x="14" y="10" width="3" height="2"/><rect x="20" y="10" width="3" height="2"/><rect x="26" y="10" width="3" height="2"/><rect x="35" y="10" width="3" height="2"/><rect x="41" y="10" width="3" height="2"/><rect x="47" y="10" width="3" height="2"/>
      {/* torre central alta */}
      <rect x="28" y="4" width="8" height="20"/><rect x="28" y="2" width="2" height="2"/><rect x="34" y="2" width="2" height="2"/>
    </g>
    {/* janelas acesas */}
    <rect x="30" y="8" width="2" height="3" fill={glow}/><rect x="6" y="12" width="2" height="2" fill={glow}/><rect x="54" y="12" width="2" height="2" fill={glow}/>
  </svg>
);

const CaptureUnikoWidget = ({ cfg }) => {
  const uniko = getUniko(cfg?.unikoId);
  const th = uniko.theme;

  const [visible, setVisible]   = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase]       = useState('idle'); // idle | aiming | thrown | escaped | caught
  const [off, setOff]           = useState({ x: 0, y: 0 });
  const [throwing, setThrowing] = useState(false);   // liga transição (snap/arremesso)

  const sceneRef = useRef(null);
  const unikoRef = useRef(null);
  const dragRef  = useRef(null);   // { baseX, baseY, active }
  const attemptsRef = useRef(0); attemptsRef.current = attempts;
  const offRef = useRef(off); offRef.current = off;

  /* ── Surgimento aleatório dentro da janela ── */
  useEffect(() => {
    if (!cfg) return;
    let spawnT, scheduled = false;
    const schedule = () => {
      if (scheduled || isCaptureDone(cfg) || !isWithinWindow(cfg)) return;
      scheduled = true;
      spawnT = setTimeout(() => {
        if (isCaptureDone(cfg) || !isWithinWindow(cfg)) { scheduled = false; return; }
        setVisible(true);
      }, rand(SPAWN_MIN, SPAWN_MAX));
    };
    schedule();
    // re-checa periodicamente: cobre quem entrou no Portal ANTES da janela abrir,
    // e some quando a janela termina.
    const tick = setInterval(() => {
      if (isCaptureDone(cfg)) return;
      if (isWithinWindow(cfg)) schedule();
      else { setVisible(false); emitCaptureState({ available: false, uniko: null }); }
    }, 20000);
    return () => { clearTimeout(spawnT); clearInterval(tick); };
  }, [cfg]);

  /* ── Avisa o assistente quando está disponível / resolvido ── */
  useEffect(() => {
    if (visible && phase !== 'caught') emitCaptureState({ available: true, uniko });
    return () => emitCaptureState({ available: false, uniko: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* ── Arremesso: arrastar a bolinha e soltar pra cima no Uniko ── */
  const onPointerDown = useCallback((e) => {
    if (phase === 'thrown' || phase === 'caught') return;
    e.preventDefault();
    const sc = sceneRef.current?.getBoundingClientRect();
    if (!sc) return;
    // centro da posição de repouso da bolinha (base, embaixo no meio)
    const baseX = sc.left + sc.width / 2;
    const baseY = sc.bottom - 52;
    dragRef.current = { baseX, baseY, active: true };
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
      // arremesso = puxou pra cima além do limiar; senão volta pra base
      if (offRef.current.y < -30) { throwBall(d); }
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
    if (ur) {
      const tx = (ur.left + ur.width / 2) - d.baseX;
      const ty = (ur.top + ur.height / 2) - d.baseY;
      setOff({ x: tx, y: ty });
    }
    // resolve após a bolinha "chegar" no Uniko
    setTimeout(resolveAttempt, 460);
  };

  const resolveAttempt = () => {
    const n = attemptsRef.current + 1;
    setAttempts(n);
    const escaped = n === 1 && Math.random() < ESCAPE_CHANCE;
    if (escaped) {
      setPhase('escaped');
      // bolinha some e volta pra base pra 2ª tentativa
      setTimeout(() => { setThrowing(true); setOff({ x: 0, y: 0 }); setPhase('idle'); }, 1100);
    } else {
      setPhase('caught');
      markCaptureDone(cfg);
      saveCaptureToCollection(uniko);
      emitCaptureState({ available: false, uniko, captured: true });
      setTimeout(() => setVisible(false), 2800);
    }
  };

  const close = () => {
    setVisible(false);
    emitCaptureState({ available: false, uniko: null });
    // se não capturou ainda, volta a aparecer depois de um tempo
    if (!isCaptureDone(cfg) && isWithinWindow(cfg)) {
      setTimeout(() => { if (isWithinWindow(cfg) && !isCaptureDone(cfg)) setVisible(true); }, RETRY_COOLDOWN);
    }
  };

  if (!visible) return null;

  const ballTransform = `translate(calc(-50% + ${off.x}px), ${off.y}px) scale(${phase === 'thrown' ? 0.42 : 1})`;
  const ballTransition = throwing
    ? (phase === 'thrown' ? 'transform .46s cubic-bezier(.5,-0.2,.7,.6), opacity .3s' : 'transform .3s cubic-bezier(.34,1.56,.64,1)')
    : 'none';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9985, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: 16 }}>
      <style>{`
        @property --cuAng{syntax:'<angle>';initial-value:0deg;inherits:false}
        @keyframes cuBorder{to{--cuAng:360deg}}
        @keyframes cuIn{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes cuFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes cuIdle{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-10px) rotate(1deg)}}
        @keyframes cuDodge{0%{transform:translate(0,0)}25%{transform:translate(-46px,-8px) scale(.92)}55%{transform:translate(40px,6px) scale(.95)}100%{transform:translate(0,0)}}
        @keyframes cuCaught{0%{transform:scale(1)}30%{transform:scale(1.18) rotate(4deg)}60%{transform:scale(.9) rotate(-3deg)}100%{transform:scale(1.05)}}
        @keyframes cuBatFly{from{transform:translateX(-30px)}to{transform:translateX(360px)}}
        @keyframes cuPixUp{0%{transform:translateY(20px);opacity:0}20%{opacity:1}100%{transform:translateY(-120px);opacity:0}}
        @keyframes cuRing{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}
        @keyframes cuShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
        @keyframes cuPulse{0%,100%{opacity:.5}50%{opacity:1}}
      `}</style>

      {/* ── Card do encontro (borda cônica animada temática) ── */}
      <div style={{
        pointerEvents: 'auto', position: 'relative', width: 'min(420px, 92vw)',
        borderRadius: 24, padding: 4, animation: 'cuIn .5s cubic-bezier(.22,1,.36,1)',
        background: th.deep,
        boxShadow: `0 24px 70px ${th.accent}66, 0 0 0 1px ${th.deep}`,
      }}>
        {/* borda cônica que gira (camada mascarada só na moldura) */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, padding: 4, background: `conic-gradient(from var(--cuAng), ${th.border.join(',')})`, animation: 'cuBorder 4s linear infinite', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }}/>

        {/* ── Cenário interno ── */}
        <div ref={sceneRef} style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: th.scene, height: 480, maxHeight: '80vh', touchAction: 'none' }}>

          {/* botão fechar */}
          <button onClick={close} title="Fechar" style={{ position: 'absolute', top: 10, right: 10, zIndex: 6, width: 30, height: 30, borderRadius: 9, border: `1px solid ${th.accent}55`, background: 'rgba(0,0,0,.35)', color: th.ink, fontSize: 17, lineHeight: 1, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>×</button>

          {/* título */}
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', color: th.glow, textShadow: `0 0 10px ${th.accent}`, animation: 'cuPulse 1.6s ease-in-out infinite' }}>★ CAPTURE O UNIKO ★</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginTop: 3, fontFamily: 'var(--font-brand)', letterSpacing: '.03em', textShadow: `0 2px 12px ${th.accent2}` }}>{uniko.name}</div>
            <div style={{ fontSize: 10.5, color: th.ink, opacity: .8 }}>{uniko.tagline}</div>
          </div>

          {/* partículas de pixel subindo */}
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: 60, left: `${(i * 7 + 5) % 96}%`, width: 4, height: 4, background: th.pixel, opacity: .7, boxShadow: `0 0 6px ${th.glow}`, animation: `cuPixUp ${rand(3.5, 7).toFixed(2)}s linear ${(i * 0.4).toFixed(2)}s infinite` }}/>
          ))}

          {/* morcegos de pixel voando */}
          {[{ t: 72, d: 7, dl: 0 }, { t: 120, d: 9, dl: 1.5 }, { t: 96, d: 6, dl: 3 }, { t: 150, d: 8, dl: 0.8 }].map((b, i) => (
            <div key={i} style={{ position: 'absolute', top: b.t, left: -30, animation: `cuBatFly ${b.d}s linear ${b.dl}s infinite`, opacity: .85 }}>
              <PixelBat color={th.bat} style={{ filter: `drop-shadow(0 0 3px ${th.accent})` }}/>
            </div>
          ))}

          {/* castelo de pixel no fundo */}
          <PixelCastle color={th.castle} glow={th.glow}/>

          {/* anel de mira sob o Uniko */}
          {phase !== 'caught' && (
            <>
              <div style={{ position: 'absolute', left: '50%', top: 215, width: 130, height: 130, border: `3px solid ${th.glow}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cuRing 2s ease-out infinite', pointerEvents: 'none' }}/>
              <div style={{ position: 'absolute', left: '50%', top: 215, width: 130, height: 130, border: `3px solid ${th.accent}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cuRing 2s ease-out 1s infinite', pointerEvents: 'none' }}/>
            </>
          )}

          {/* O UNIKO grande */}
          <img
            ref={unikoRef}
            src={uniko.img}
            alt={uniko.name}
            draggable="false"
            style={{
              position: 'absolute', left: '50%', top: 150, transform: 'translateX(-50%)',
              width: 170, height: 170, objectFit: 'contain', zIndex: 3,
              filter: `drop-shadow(0 0 24px ${th.accent}) drop-shadow(0 8px 18px rgba(0,0,0,.6))`,
              animation: phase === 'escaped' ? 'cuDodge .9s ease-in-out' : phase === 'caught' ? 'cuCaught .8s ease-out forwards' : 'cuIdle 3.5s ease-in-out infinite',
            }}
          />

          {/* mensagens de estado */}
          {phase === 'escaped' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center', zIndex: 7, animation: 'cuShake .4s', pointerEvents: 'none' }}>
              <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#ffd9a0', fontWeight: 800, fontSize: 14, border: '1px solid rgba(255,180,80,.4)' }}>Ele escapou! Tente de novo 💢</div>
            </div>
          )}
          {phase === 'caught' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40, zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ padding: '10px 22px', borderRadius: 14, background: `linear-gradient(135deg,${th.accent2},${th.accent})`, color: '#fff', fontWeight: 900, fontSize: 18, boxShadow: `0 8px 30px ${th.accent}aa`, fontFamily: 'var(--font-brand)', letterSpacing: '.03em' }}>Gotcha! Capturado! 🎉</div>
              <div style={{ marginTop: 8, fontSize: 12, color: th.ink }}>{uniko.name} entrou na sua coleção.</div>
            </div>
          )}

          {/* HUD inferior: tentativas + instrução */}
          {phase !== 'caught' && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
              <div style={{ fontSize: 11, color: th.ink, opacity: .9, marginBottom: 5 }}>
                {phase === 'thrown' ? '...' : 'Arraste e arremesse pra cima! ☝️'}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {[0, 1].map(i => (
                  <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < attempts ? '#6b7280' : th.glow, boxShadow: i < attempts ? 'none' : `0 0 8px ${th.glow}` }}/>
                ))}
              </div>
            </div>
          )}

          {/* A BOLINHA (UNIKO_CAPTURAR) — arrastável */}
          {phase !== 'caught' && phase !== 'escaped' && (
            <img
              src={BALL_IMG}
              alt="Capturar"
              draggable="false"
              onMouseDown={onPointerDown}
              onTouchStart={onPointerDown}
              style={{
                position: 'absolute', left: '50%', bottom: 18, width: 68, height: 68, zIndex: 8,
                cursor: phase === 'thrown' ? 'default' : 'grab', objectFit: 'contain',
                transform: ballTransform, transition: ballTransition,
                opacity: phase === 'thrown' ? 0.85 : 1,
                touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none',
                filter: `drop-shadow(0 6px 14px ${th.accent}aa)`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptureUnikoWidget;
