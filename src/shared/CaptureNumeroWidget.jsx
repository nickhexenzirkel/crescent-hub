// src/shared/CaptureNumeroWidget.jsx
// Widget "Capture o Número" — mesmo mecanismo do CaptureUnikoWidget.jsx (arremesso
// do assistente, até 5 vagas por evento), só que SEM tema/cenário por número (cartão
// dourado fixo, "número da sorte") e SEM recompensa em Prismas por enquanto — só
// grava a captura na coleção. GLOBAL: montado uma vez no App, o card em si só
// aparece no slot #capture-numero-slot (Portal → Início).
// MECÂNICA: arraste o assistente UNIKO (canto) e solte em cima do número pra arremessar.
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAuthUser } from '../contexts/user';
import { notifyDesktop } from '../utils/desktopNotify';
import ConstellationPuzzle from './ConstellationPuzzle';
import {
  isSpawned, spawnMoment, isCaptureDone, markCaptureDone,
  saveCaptureToCollection, emitCaptureNumeroState, emitCaptureNumeroSlotBusy, getCaptureResult, setCaptureResult,
  WINNER_PANEL_MS, fetchCaptureWinners, claimCapture, addToMyNumeroCollection, fetchCapturesFor,
  registerCaptureNumeroTarget, onCaptureNumeroThrow, clearCaptureLocal, clearCaptureDone, isWithinWindow, subscribeCaptureWinner,
  syncNumeroCollectionFromServer, nowMs, ensureServerClock, maxWinnersFor, captureEventId, numeroValueForSlot,
} from './captureNumero';

// A partir da 2ª captura JÁ FEITA (ou seja, na 3ª tentativa em diante), a pessoa
// precisa resolver a constelação antes de poder capturar de novo — dá mais chance
// pra quem ainda não ganhou nada. Pedido explícito do usuário.
const PUZZLE_AFTER_CAPTURES = 2;

// Cartão dourado fixo — "número da sorte" não tem tema por item (ao contrário do
// Uniko, que tem cor/cenário próprios por personagem).
const GOLD = {
  accent: '#ffb020', accent2: '#c97a00', glow: '#ffd873', deep: '#1a1206', ink: '#fff3d6',
  border: ['#7a4e00', '#c97a00', '#ffb020', '#ffe08a', '#c97a00', '#7a4e00'],
  scene: 'radial-gradient(120% 90% at 50% 0%, #3a2408 0%, #1a1206 45%, #0b0704 100%)',
};

// Captura sempre na 1ª (e única) tentativa de arremesso — sem chance de escapar.

const fmtWhen = (iso) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

/* ── Som de alerta (Web Audio — sem asset): dois bipes ascendentes, igual o do Uniko ── */
let _audioCtx = null;
function playCaptureAlert() {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [[783.99, 0], [1046.5, 0.16], [1318.5, 0.32]].forEach(([freq, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.22, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.17);
      o.start(now + t); o.stop(now + t + 0.18);
    });
  } catch {}
}

const CaptureNumeroWidget = ({ cfg, inPortal = false }) => {
  const [available, setAvailable] = useState(false);
  const [winners, setWinners]     = useState([]); // até maxWinners: [{player, at, numeroValue}]
  // Modo "aleatório por vaga" (cfg.slotNumeroValues): cada vaga tem o seu número — o
  // que está na tela é o da PRÓXIMA vaga livre. Nos outros modos é sempre cfg.numeroValue.
  const perSlot = Array.isArray(cfg?.slotNumeroValues) && cfg.slotNumeroValues.length > 1;
  const numeroValue = numeroValueForSlot(cfg, winners.length);
  const th = GOLD;
  const [phase, setPhase]         = useState('idle'); // idle | thrown | error | caught
  const [checked, setChecked]     = useState(false);
  const [nowTs, setNowTs]         = useState(Date.now());
  // Desbloqueio por tarefa: quem já capturou PUZZLE_AFTER_CAPTURES+ números precisa
  // ligar a constelação antes de poder tentar de novo (ver efeitos mais abaixo).
  const [priorCount, setPriorCount]     = useState(null); // null = ainda não checou
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  const maxWinners = maxWinnersFor(cfg);
  const me      = getAuthUser()?.name;
  const myWin   = winners.find(w => w.player === me) || null;
  const isFull  = winners.length >= maxWinners;
  const latestWinner = winners.length ? winners[winners.length - 1] : null;
  const panelWinner  = myWin || latestWinner; // só define o TEMPO de exibição do painel (30 min)

  const winnerAt = panelWinner?.at ? Date.parse(panelWinner.at) : null;
  const winnerActive = winnerAt != null && !Number.isNaN(winnerAt) && (nowTs - winnerAt < WINNER_PANEL_MS);
  const winnerMine = !!myWin;
  const mustSolvePuzzle = (priorCount ?? 0) >= PUZZLE_AFTER_CAPTURES && !puzzleSolved;

  const sceneRef = useRef(null);
  const numeroRef = useRef(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const resolvingRef = useRef(false);
  const resolveAttemptRef = useRef(null);
  const revealArmedRef = useRef(null);

  /* ── ZERA o estado quando começa um evento NOVO (mesmo raciocínio do Uniko:
       este componente nunca desmonta, só recebe um `cfg` novo por realtime). ── */
  const eventId = captureEventId(cfg);
  useEffect(() => {
    setPhase('idle');
    resolvingRef.current = false;
    revealArmedRef.current = null;
    setWinners([]);
    setAvailable(false);
    setChecked(false);
    setPriorCount(null);
    setPuzzleSolved(false);
  }, [eventId]);

  /* ── Desbloqueia o áudio no 1º clique (autoplay policy do navegador) ── */
  useEffect(() => {
    const unlock = () => { try { _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (_audioCtx.state === 'suspended') _audioCtx.resume(); } catch {} };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  /* ── Já capturado globalmente? (SERVIDOR é a fonte da verdade) ── */
  useEffect(() => {
    let alive = true;
    if (!cfg) { setChecked(true); return; }
    (async () => {
      const ws = await fetchCaptureWinners(cfg);
      if (!alive) return;
      if (ws === undefined) {
        const cached = getCaptureResult(cfg);
        if (cached) setWinners(Array.isArray(cached) ? cached : [cached]);
        setChecked(true); return;
      }
      setWinners(ws);
      setCaptureResult(cfg, ws);
      const meNow = getAuthUser()?.name;
      if (ws.length >= maxWinners || ws.some(w => w.player === meNow)) markCaptureDone(cfg);
      else if (ws.length === 0) clearCaptureLocal(cfg);
      else clearCaptureDone(cfg);
      setChecked(true);
    })();
    return () => { alive = false; };
  }, [cfg, maxWinners]);

  /* ── Surgimento SINCRONIZADO: todos veem no mesmo momento (spawnAt do config) ── */
  useEffect(() => {
    if (!cfg || !checked || isFull || myWin || isCaptureDone(cfg)) return;
    let alive = true, revealT;

    const agendarRevelacao = () => {
      const sp = spawnMoment(cfg);
      if (sp == null) return;
      const falta = sp - nowMs();
      if (falta <= 0) return;
      if (falta < 30000) ensureServerClock();
      clearTimeout(revealT);
      revealT = setTimeout(evaluate, falta + 40);
    };

    const evaluate = async () => {
      if (!alive) return;
      if (isCaptureDone(cfg)) { setAvailable(false); return; }
      if (!isSpawned(cfg))    { setAvailable(false); agendarRevelacao(); return; }
      if (revealArmedRef.current !== eventId) {
        await ensureServerClock();
        if (!alive) return;
        revealArmedRef.current = eventId;
        if (!isSpawned(cfg)) { setAvailable(false); agendarRevelacao(); return; }
      }
      setAvailable(true);
    };

    evaluate();
    const tick = setInterval(evaluate, 3000);
    const acordar = () => { if (document.visibilityState === 'visible') evaluate(); };
    document.addEventListener('visibilitychange', acordar);
    window.addEventListener('focus', acordar);
    return () => {
      alive = false;
      clearTimeout(revealT); clearInterval(tick);
      document.removeEventListener('visibilitychange', acordar);
      window.removeEventListener('focus', acordar);
    };
  }, [cfg, checked, isFull, myWin, eventId]);

  /* ── Avisa no DESKTOP quando o número surge (transição false→true só) ── */
  const notifiedSpawnRef = useRef(null);
  useEffect(() => {
    if (!available || !cfg) { notifiedSpawnRef.current = null; return; }
    if (!isSpawned(cfg)) return;
    const spawnKey = `${numeroValue}-${cfg.startAt || ''}`;
    if (notifiedSpawnRef.current === spawnKey) return;
    notifiedSpawnRef.current = spawnKey;
    notifyDesktop({
      id: `capture-numero-${spawnKey}`,
      type: 'lembrete',
      title: '.✧. Um número da sorte apareceu! .✧.',
      message: 'Está no Portal do Colaborador, na aba Início — corre lá antes que as vagas acabem! Só revela qual número é depois que você capturar. 🎰',
    });
  }, [available, cfg, numeroValue]);

  /* ── Alguém capturou? → acumula na lista; quando fecha as vagas, some pra
       quem ainda não capturou. Realtime + poll de 4s como fallback. ── */
  useEffect(() => {
    if (!cfg || isFull || myWin || !available) return;
    const addWinner = (w) => {
      setWinners(prev => {
        if (prev.some(p => p.player === w.player)) return prev;
        const next = [...prev, w].slice(0, maxWinners);
        setCaptureResult(cfg, next);
        return next;
      });
    };
    const unsub = subscribeCaptureWinner(cfg, addWinner);
    const id = setInterval(async () => {
      const ws = await fetchCaptureWinners(cfg);
      if (!ws || !ws.length) return;
      setWinners(prev => {
        const map = new Map(prev.map(p => [p.player, p]));
        for (const w of ws) map.set(w.player, w);
        const merged = Array.from(map.values());
        setCaptureResult(cfg, merged);
        return merged;
      });
    }, 4000);
    return () => { unsub(); clearInterval(id); };
  }, [available, cfg, isFull, myWin, maxWinners]);

  /* ── Quando as vagas se esgotam → some pra quem ainda não capturou. ── */
  useEffect(() => {
    if (cfg && isFull && !myWin) {
      markCaptureDone(cfg);
      setAvailable(false);
      emitCaptureNumeroState({ available: false, numeroValue: null, captured: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFull]);

  /* ── Expira o painel de "resgatado" após 30 min → volta ao placeholder ── */
  useEffect(() => {
    if (winnerAt == null || Number.isNaN(winnerAt)) return;
    const remaining = winnerAt + WINNER_PANEL_MS - Date.now();
    if (remaining <= 0) { setNowTs(Date.now()); return; }
    const t = setTimeout(() => setNowTs(Date.now()), remaining + 250);
    return () => clearTimeout(t);
  }, [winnerAt]);

  useEffect(() => {
    if (!winnerActive) return;
    const id = setInterval(() => setNowTs(Date.now()), 15000);
    return () => clearInterval(id);
  }, [winnerActive]);

  /* ── Avisa o Portal se o slot está ocupado (encontro OU painel de resgatado) ── */
  useEffect(() => { emitCaptureNumeroSlotBusy(available || winnerActive); }, [available, winnerActive]);

  /* ── Alvo do encontro: o slot #capture-numero-slot no Portal (Início). ── */
  const [slotEl, setSlotEl] = useState(null);
  useEffect(() => {
    const active = inPortal && (available || winnerActive);
    if (!active) { setSlotEl(null); return; }
    const find = () => setSlotEl(document.getElementById('capture-numero-slot'));
    find();
    const id = setInterval(find, 800);
    return () => clearInterval(id);
  }, [inPortal, available, winnerActive]);

  /* ── Ao ficar DISPONÍVEL: toca o som e avisa o assistente (independe da tarefa —
       quem está travado também precisa saber que "tem algo lá", só não pode
       arremessar ainda). ── */
  useEffect(() => {
    if (available && phase !== 'caught') {
      playCaptureAlert();
      emitCaptureNumeroState({ available: true, numeroValue });
    }
    return () => { emitCaptureNumeroState({ available: false, numeroValue: null }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, numeroValue]);

  /* ── Checa quantas vezes essa pessoa JÁ capturou número (pra saber se precisa
       da tarefa de desbloqueio) — uma vez por evento, quando fica disponível. ── */
  useEffect(() => {
    if (!available) return;
    let alive = true;
    const me2 = getAuthUser()?.name;
    if (!me2) { setPriorCount(0); return; }
    fetchCapturesFor(me2).then(rows => { if (alive) setPriorCount(rows.length); });
    return () => { alive = false; };
  }, [available, eventId]);

  /* ── Alvo do arremesso: SÓ registra enquanto não estiver travado pela tarefa —
       sem alvo registrado, o arrasto do assistente não conta como arremesso (ver
       UnikoAssistant.jsx), então quem precisa resolver o puzzle não consegue
       capturar por acidente antes de terminar. ── */
  useEffect(() => {
    if (available && phase !== 'caught' && !mustSolvePuzzle) {
      registerCaptureNumeroTarget(() => numeroRef.current?.getBoundingClientRect() || sceneRef.current?.getBoundingClientRect() || null);
    } else {
      registerCaptureNumeroTarget(null);
    }
    return () => registerCaptureNumeroTarget(null);
  }, [available, phase, mustSolvePuzzle]);

  /* ── Recebe o ARREMESSO do assistente — captura na hora, sem confirmação extra
       (pedido explícito: soltar na área já vale, sem botão a mais). ── */
  useEffect(() => {
    const off = onCaptureNumeroThrow(() => {
      if (phaseRef.current !== 'idle' || resolvingRef.current) return;
      setPhase('thrown');
      setTimeout(() => resolveAttemptRef.current(), 520);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UMA tentativa só — captura sempre na primeira (sem chance de escapar).
  const resolveAttempt = async () => {
    resolvingRef.current = true;
    const freshValue = numeroValueForSlot(cfg, winners.length); // o mesmo que está na tela
    const { won, alreadyMine, isFull: full, rejected, winner, winners: fullList, networkError } = await claimCapture(cfg, freshValue);
    if (networkError || rejected) {
      setPhase('error');
      setTimeout(() => { setPhase('idle'); resolvingRef.current = false; }, 1800);
      return;
    }
    const me2 = getAuthUser()?.name || 'Você';
    markCaptureDone(cfg);
    setPhase('caught');
    setAvailable(false);
    if (won) {
      addToMyNumeroCollection(freshValue);             // otimista: já aparece na Coleção local na hora
      await saveCaptureToCollection(freshValue);        // grava no servidor
      syncNumeroCollectionFromServer();                // reconcilia com o servidor (fire-and-forget)
      setWinners(prev => {
        if (prev.some(p => p.player === me2)) return prev;
        const next = [...prev, winner].slice(0, maxWinners);
        setCaptureResult(cfg, next);
        return next;
      });
      emitCaptureNumeroState({ available: false, numeroValue: freshValue, captured: true });
    } else if (!alreadyMine && full && fullList?.length) {
      setWinners(fullList);
      setCaptureResult(cfg, fullList);
      emitCaptureNumeroState({ available: false, numeroValue: null, captured: true });
    } else {
      emitCaptureNumeroState({ available: false, numeroValue: null, captured: true });
    }
    resolvingRef.current = false;
  };
  resolveAttemptRef.current = resolveAttempt;

  /* ════════ RENDER ════════ */

  if (!inPortal || !slotEl) return null;
  const wrap = (node) => createPortal(
    <div className="capture-numero-slot-inner" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <style>{`body.uw-active .capture-numero-slot-inner{display:none!important}`}</style>
      {node}
    </div>, slotEl);

  // Painel "Você resgatou!" — só pra quem capturou (fica 30 min)
  if (winnerActive && myWin && !available) {
    const myValue = myWin.numeroValue ?? numeroValue;
    return wrap(
        <div style={{ pointerEvents: 'auto', width: '100%', borderRadius: 18, padding: 3, background: `conic-gradient(${th.border.join(',')})`, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cnToastIn .4s ease' }}>
          <style>{`@keyframes cnToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ borderRadius: 15, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 30%, ${th.glow}, ${th.accent2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: '#3a2400', fontFamily: 'var(--font-brand)', boxShadow: `0 0 16px ${th.accent}` }}>{myValue}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', color: th.glow, textShadow: `0 0 10px ${th.accent}` }}>★ NÚMERO RESGATADO ★</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-brand)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {perSlot ? `Você resgatou o número ${myValue}!` : 'Você resgatou!'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
                <span style={{ fontSize: 11.5, color: th.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={th.ink} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>
                  {fmtWhen(myWin.at)}
                </span>
              </div>
            </div>
          </div>
        </div>
    );
  }

  const encontroAberto = isWithinWindow(cfg, nowTs);
  const sobrando = Math.max(0, maxWinners - winners.length);

  // Painel "não fui eu" — mesmo raciocínio do widget do Uniko.
  if (winnerActive && !myWin && !available) {
    return wrap(
        <div style={{ pointerEvents: 'auto', width: '100%', borderRadius: 18, padding: 3, background: `conic-gradient(${th.border.join(',')})`, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cnToastIn .4s ease' }}>
          <style>{`@keyframes cnToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ borderRadius: 15, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font-brand)' }}>🎰</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', color: th.glow, textShadow: `0 0 10px ${th.accent}` }}>
                {isFull ? '★ TODAS AS VAGAS FORAM USADAS ★' : encontroAberto ? '★ ALGUÉM JÁ CAPTUROU ★' : '★ O SORTEIO ACABOU ★'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-brand)', marginTop: 1 }}>
                {isFull
                  ? `${winners.length} de ${maxWinners} vagas usadas`
                  : `${winners.length} de ${maxWinners} ${maxWinners === 1 ? 'vaga foi usada' : 'vagas foram usadas'}`}
              </div>
              {!isFull && (
                <div style={{ fontSize: 11.5, color: th.ink, marginTop: 4 }}>
                  {encontroAberto
                    ? `Ainda ${sobrando === 1 ? 'sobra 1 vaga' : `sobram ${sobrando} vagas`} — o sorteio continua!`
                    : `${sobrando === 1 ? 'A outra vaga ficou' : `As outras ${sobrando} vagas ficaram`} sem dono — o sorteio foi encerrado.`}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: th.ink, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isFull ? '' : 'Capturou: '}{winners.map(w => w.player).join(', ')}
              </div>
            </div>
          </div>
        </div>
    );
  }

  if (!checked || !available) return null;

  // DISPONÍVEL — encontro dentro do widget (arraste o assistente até aqui)
  return wrap(
      <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', borderRadius: 18, padding: 3, background: th.deep, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cnToastIn .4s ease' }}>
        <style>{`
          @property --cnAng{syntax:'<angle>';initial-value:0deg;inherits:false}
          @keyframes cnBorder{to{--cnAng:360deg}}
          @keyframes cnToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
          @keyframes cnIdle{0%,100%{transform:translateX(-50%) translateY(0) rotate(-2deg)}50%{transform:translateX(-50%) translateY(-9px) rotate(2deg)}}
          @keyframes cnDodge{0%{transform:translateX(-50%)}25%{transform:translateX(-50%) translate(-46px,-6px) scale(.92)}55%{transform:translateX(-50%) translate(42px,6px) scale(.95)}100%{transform:translateX(-50%)}}
          @keyframes cnHit{0%,100%{transform:translateX(-50%)}20%{transform:translateX(-50%) translateX(-8px) scale(1.06)}40%{transform:translateX(-50%) translateX(8px) scale(.96)}60%{transform:translateX(-50%) translateX(-5px)}80%{transform:translateX(-50%) translateX(5px)}}
          @keyframes cnRing{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
          @keyframes cnPulse{0%,100%{opacity:.5}50%{opacity:1}}
        `}</style>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 18, padding: 3, background: `conic-gradient(from var(--cnAng), ${th.border.join(',')})`, animation: 'cnBorder 4s linear infinite', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }}/>

        <div ref={sceneRef} style={{ position: 'relative', borderRadius: 15, overflow: 'hidden', background: th.scene, height: 300 }}>
          {mustSolvePuzzle ? (
            <>
              <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none', padding: '0 14px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', color: th.glow, textShadow: `0 0 10px ${th.accent}`, animation: 'cnPulse 1.6s ease-in-out infinite' }}>★ DESBLOQUEIE PRA CAPTURAR ★</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginTop: 3, fontFamily: 'var(--font-brand)', textShadow: `0 2px 12px ${th.accent2}` }}>Ligue as estrelas: da menor até a maior</div>
                <div style={{ fontSize: 10.5, color: th.ink, marginTop: 2 }}>Você já capturou {priorCount}x — dá uma chance pros outros primeiro! ✨</div>
              </div>
              <div style={{ position: 'absolute', inset: '62px 18px 16px' }}>
                <ConstellationPuzzle accent={th.glow} onSolved={() => setPuzzleSolved(true)} />
              </div>
            </>
          ) : (
          <>
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', color: th.glow, textShadow: `0 0 10px ${th.accent}`, animation: 'cnPulse 1.6s ease-in-out infinite' }}>★ CAPTURE O NÚMERO ★</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2, fontFamily: 'var(--font-brand)', letterSpacing: '.03em', textShadow: `0 2px 12px ${th.accent2}` }}>Número da sorte</div>
            {perSlot && (
              <div style={{ fontSize: 10.5, fontWeight: 700, color: th.ink, marginTop: 2, textShadow: `0 1px 8px ${th.accent2}` }}>
                Vaga {Math.min(winners.length + 1, maxWinners)} de {maxWinners} · cada vaga traz um número diferente
              </div>
            )}
          </div>

          <div style={{ position: 'absolute', left: '50%', top: 138, width: 116, height: 116, border: `3px solid ${th.glow}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cnRing 2s ease-out infinite', pointerEvents: 'none', zIndex: 2 }}/>

          <div ref={numeroRef}
            style={{ position: 'absolute', left: '50%', top: 76, transform: 'translateX(-50%)', width: 132, height: 132, borderRadius: '50%', zIndex: 3,
              background: `radial-gradient(circle at 35% 30%, ${th.glow}, ${th.accent} 55%, ${th.accent2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 52, fontWeight: 900, color: '#3a2400', fontFamily: 'var(--font-brand)',
              boxShadow: `0 0 22px ${th.accent}, 0 8px 16px rgba(0,0,0,.6), inset 0 3px 0 rgba(255,255,255,.4)`,
              animation: phase === 'error' ? 'cnDodge .9s ease-in-out' : phase === 'thrown' ? 'cnHit .5s ease-in-out' : 'cnIdle 3.5s ease-in-out infinite' }}>
            ?
          </div>

          {phase === 'error' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#ffb0b0', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,80,80,.4)' }}>Erro de conexão — tenta de novo</div>
            </div>
          )}

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11.5, color: '#fff', fontWeight: 700, textShadow: `0 1px 8px ${th.accent2}` }}>
              {phase === 'thrown' ? '...' : 'Arraste o assistente UNIKO até aqui e solte!'}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
  );
};

export default CaptureNumeroWidget;
