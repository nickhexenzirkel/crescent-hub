// src/shared/CaptureUnikoWidget.jsx
// Widget "Capture o Uniko" — encontro estilo Pokémon GO. Agora é GLOBAL: montado uma vez
// no App, aparece como um card FLUTUANTE em qualquer lugar do sistema (Portal, Central
// Alexa, Editor...) e NÃO some ao navegar. Toca um SOM de alerta ao surgir.
// MECÂNICA: arraste o assistente UNIKO (canto) e solte em cima do Uniko pra arremessar.
// • SÓ UM colaborador captura por evento (lock global no Supabase).
// • Quem captura ganha os Prismas do Uniko (uniko.reward) e o Uniko vai pra coleção.
// • Duas tentativas: na 1ª ele pode escapar; na 2ª a captura é garantida.
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAuthUser } from '../contexts/user';
import VampireScene from './vampireScene';
import OceanScene from './oceanScene';
import {
  getUniko, isWithinWindow, isSpawned, spawnMoment, isCaptureDone, markCaptureDone,
  saveCaptureToCollection, emitCaptureState, emitCaptureSlotBusy, getCaptureResult, setCaptureResult,
  getCaptureReward, WINNER_PANEL_MS, fetchCaptureWinner, claimCapture, awardPrismas, addToMyUnikoCollection,
  registerCaptureTarget, onCaptureThrow, clearCaptureLocal, subscribeCaptureWinner, syncCollectionFromServer,
  loadCustomUnikos, nowMs, syncServerClock,
} from './captureUniko';

const ESCAPE_CHANCE = 0.6;  // chance de escapar na 1ª tentativa (2ª é garantida)

const fmtWhen = (iso) => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

/* ── Som de alerta (Web Audio — sem asset): dois bipes ascendentes ── */
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


const CaptureUnikoWidget = ({ cfg, inPortal = false }) => {
  const uniko = getUniko(cfg?.unikoId);
  const th = uniko.theme;

  const [available, setAvailable] = useState(false);
  const [result, setResult]       = useState(null); // vencedor: {player, at, comum, premium}
  const [attempts, setAttempts]   = useState(0);
  const [phase, setPhase]         = useState('idle'); // idle | thrown | escaped | error | caught
  const [checked, setChecked]     = useState(false);
  const [nowTs, setNowTs]         = useState(Date.now());
  const [, forceRefresh]          = useState(0);

  // Garante que os Unikos da Oficina estejam carregados ANTES de precisar deles aqui —
  // App.jsx já carrega no login, mas se o admin criar um Uniko novo e "Spawnar agora"
  // na sequência, uma aba já aberta no Portal pode ainda estar com o cache velho
  // (getUniko cairia no Vampire-Robot por engano). Recarrega ao montar e força um
  // re-render pra `getUniko` (que roda a cada render, sem estado próprio) already achar.
  useEffect(() => { loadCustomUnikos().then(() => forceRefresh(n => n + 1)); }, []);

  // Painel "resgatado" fica visível por 30 min após a captura; depois volta ao placeholder.
  const winnerAt = result?.at ? Date.parse(result.at) : null;
  const winnerActive = winnerAt != null && !Number.isNaN(winnerAt) && (nowTs - winnerAt < WINNER_PANEL_MS);
  const winnerMine = !!result?.player && result.player === getAuthUser()?.name;

  const sceneRef = useRef(null);
  const unikoRef = useRef(null);
  const attemptsRef = useRef(0); attemptsRef.current = attempts;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const resolvingRef = useRef(false);
  const resolveAttemptRef = useRef(null); // sempre a versão mais recente de resolveAttempt (ver onCaptureThrow abaixo)

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
      const w = await fetchCaptureWinner(cfg);
      if (!alive) return;
      if (w === undefined) {                 // erro de rede → confia no cache local
        if (getCaptureResult(cfg)) setResult(getCaptureResult(cfg));
        setChecked(true); return;
      }
      if (w) { setResult(w); setCaptureResult(cfg, w); markCaptureDone(cfg); }
      else  { setResult(null); clearCaptureLocal(cfg); }
      setChecked(true);
    })();
    return () => { alive = false; };
  }, [cfg]);

  /* ── Surgimento SINCRONIZADO: todos veem no mesmo momento (spawnAt do config) ── */
  useEffect(() => {
    if (!cfg || !checked || result || isCaptureDone(cfg)) return;
    let revealT;
    const evaluate = () => {
      if (isCaptureDone(cfg)) { setAvailable(false); return; }
      if (isSpawned(cfg))     { setAvailable(true);  return; }
      setAvailable(false);
      // ainda não chegou o spawnAt → agenda a revelação exata (mesmo instante p/ todos,
      // usando o relógio corrigido pelo servidor — nowMs() — em vez do Date.now() cru,
      // que pode estar alguns segundos errado dependendo do PC)
      const sp = spawnMoment(cfg);
      if (sp != null && nowMs() < sp && isWithinWindow(cfg)) {
        clearTimeout(revealT);
        revealT = setTimeout(evaluate, Math.max(0, sp - nowMs()) + 40);
      }
    };
    evaluate();
    const tick = setInterval(evaluate, 3000);
    return () => { clearTimeout(revealT); clearInterval(tick); };
  }, [cfg, checked, result]);

  /* ── Alguém capturou? → some pra TODOS ao mesmo tempo. Realtime (quase instantâneo,
       requer supabase_capture_uniko_realtime.sql) + poll de 4s como fallback caso o
       realtime não esteja habilitado no projeto Supabase. ── */
  useEffect(() => {
    if (!cfg || result || !available) return;
    const onWinner = (w) => {
      markCaptureDone(cfg); setCaptureResult(cfg, w); setAvailable(false);
      setResult(w);                                        // mostra o painel de resgatado (30 min)
      emitCaptureState({ available: false, uniko: null, captured: true });
    };
    const unsub = subscribeCaptureWinner(cfg, onWinner);
    const id = setInterval(async () => {
      const w = await fetchCaptureWinner(cfg);
      if (!w) return;
      onWinner(w);
    }, 4000);
    return () => { unsub(); clearInterval(id); };
  }, [available, cfg, result]); // eslint-disable-line

  /* ── Expira o painel de "resgatado" após 30 min → volta ao placeholder ── */
  useEffect(() => {
    if (winnerAt == null || Number.isNaN(winnerAt)) return;
    const remaining = winnerAt + WINNER_PANEL_MS - Date.now();
    if (remaining <= 0) { setNowTs(Date.now()); return; }
    const t = setTimeout(() => setNowTs(Date.now()), remaining + 250);
    return () => clearTimeout(t);
  }, [winnerAt]);

  /* ── Avisa o Portal se o slot está ocupado (encontro OU painel de resgatado) ── */
  useEffect(() => { emitCaptureSlotBusy(available || winnerActive); }, [available, winnerActive]);

  /* ── Alvo do encontro: o slot #capture-uniko-slot no Portal (Início). Reencontra ao
       navegar entre abas; se não existir (outra aba/tela), não renderiza nada visual. ── */
  const [slotEl, setSlotEl] = useState(null);
  useEffect(() => {
    const active = inPortal && (available || winnerActive);
    if (!active) { setSlotEl(null); return; }
    const find = () => setSlotEl(document.getElementById('capture-uniko-slot'));
    find();
    const id = setInterval(find, 800);
    return () => clearInterval(id);
  }, [inPortal, available, winnerActive]);

  /* ── Ao ficar DISPONÍVEL: toca o som, avisa o assistente e registra o alvo ──
       `uniko` entra nas deps (além de `available`) pra não ficar preso num Uniko velho
       se o cache da Oficina ainda não tinha carregado no momento do spawn — sem isso o
       assistente anunciava/mostrava o Uniko errado (mesma família do bug do resolveAttempt). ── */
  useEffect(() => {
    if (available && phase !== 'caught') {
      playCaptureAlert();
      emitCaptureState({ available: true, uniko });
      registerCaptureTarget(() => unikoRef.current?.getBoundingClientRect() || sceneRef.current?.getBoundingClientRect() || null);
    }
    return () => { emitCaptureState({ available: false, uniko: null }); registerCaptureTarget(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, uniko]);

  /* ── Recebe o ARREMESSO do assistente ── */
  useEffect(() => {
    const off = onCaptureThrow(() => {
      if (phaseRef.current !== 'idle' || resolvingRef.current) return;
      setPhase('thrown');
      // Chama sempre a versão MAIS RECENTE (via ref) — este effect só roda uma vez (deps
      // vazias) e, sem o ref, ficaria preso na closure do 1º render pra sempre. Isso é
      // o bug real da captura indo pro Uniko errado: `uniko` (e portanto `resolveAttempt`)
      // no 1º render ainda é o fallback Vampire-Robot, antes do cache da Oficina carregar
      // (loadCustomUnikos é assíncrono) — sem o ref, TODA captura usava esse uniko velho.
      setTimeout(() => resolveAttemptRef.current(), 520);
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
    const { won, winner, networkError } = await claimCapture(cfg, uniko);
    if (networkError) {
      // erro de verdade (não é "alguém já pegou") — NÃO marca como feito nem gasta a
      // tentativa; deixa tentar de novo em vez de fingir sucesso sem nada gravado.
      setAttempts(n - 1);
      setPhase('error');
      setTimeout(() => { setPhase('idle'); resolvingRef.current = false; }, 1800);
      return;
    }
    const me = getAuthUser()?.name || 'Você';
    markCaptureDone(cfg);
    setPhase('caught');
    setAvailable(false);
    if (won) {
      const reward = getCaptureReward(uniko);
      awardPrismas(me, reward.comum, reward.premium);
      addToMyUnikoCollection(uniko);                 // otimista: já aparece na Coleção local na hora
      await saveCaptureToCollection(uniko);           // grava no servidor (agora loga erro se falhar)
      syncCollectionFromServer();                     // reconcilia com o servidor (fire-and-forget)
      const res = { player: me, at: new Date().toISOString(), comum: reward.comum, premium: reward.premium };
      setResult(res); setCaptureResult(cfg, res);
      emitCaptureState({ available: false, uniko, captured: true });
    } else {
      const res = { player: winner?.player || '—', at: winner?.at || new Date().toISOString(), comum: winner?.comum || 0, premium: winner?.premium || 0 };
      setResult(res); setCaptureResult(cfg, res);
      emitCaptureState({ available: false, uniko: null, captured: true });
    }
    resolvingRef.current = false;
  };
  resolveAttemptRef.current = resolveAttempt; // atualiza a CADA render, pra fechar sobre o `uniko` atual

  /* ════════ RENDER ════════ */

  // O encontro é injetado no widget #capture-uniko-slot do Portal (Início), NÃO flutua.
  // O aviso (som + assistente) é global e acontece nos effects acima, em qualquer tela.
  if (!inPortal || !slotEl) return null;
  const wrap = (node) => createPortal(
    <div className="capture-uniko-slot-inner" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <style>{`body.uw-active .capture-uniko-slot-inner{display:none!important}`}</style>
      {node}
    </div>, slotEl);

  // Painel de "resgatado" — quem pegou, quando e quantas prismas (fica 30 min)
  if (winnerActive && result && !available) {
    return wrap(
        <div style={{ pointerEvents: 'auto', width: '100%', borderRadius: 18, padding: 3, background: `conic-gradient(${th.border.join(',')})`, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cuToastIn .4s ease' }}>
          <style>{`@keyframes cuToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ borderRadius: 15, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px' }}>
            <img src={uniko.img} alt={uniko.name} style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 16px ${th.accent})` }}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', color: th.glow, textShadow: `0 0 10px ${th.accent}` }}>★ UNIKO RESGATADO ★</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-brand)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {winnerMine ? 'Você resgatou!' : result.player}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
                <span style={{ fontSize: 11.5, color: th.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={th.ink} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>
                  {fmtWhen(result.at)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(39,198,222,.18)', border: '1px solid rgba(39,198,222,.5)', borderRadius: 999, padding: '2px 9px' }}><img src="/PrismaComum.png" alt="" onError={e=>{e.target.style.display='none';}} style={{ width: 14, height: 14 }}/>+{result.comum || 0}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(155,107,255,.2)', border: '1px solid rgba(155,107,255,.55)', borderRadius: 999, padding: '2px 9px' }}><img src="/PrismaPremium.png" alt="" onError={e=>{e.target.style.display='none';}} style={{ width: 14, height: 14 }}/>+{result.premium || 0}</span>
              </div>
            </div>
          </div>
        </div>
    );
  }

  if (!checked || !available) return null;

  // DISPONÍVEL — encontro dentro do widget (arraste o assistente até aqui) — ocupa a área toda
  return wrap(
      <div style={{ pointerEvents: 'auto', position: 'relative', width: '100%', borderRadius: 18, padding: 3, background: th.deep, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cuToastIn .4s ease' }}>
        <style>{`
          @property --cuAng{syntax:'<angle>';initial-value:0deg;inherits:false}
          @keyframes cuBorder{to{--cuAng:360deg}}
          @keyframes cuToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
          @keyframes cuIdle{0%,100%{transform:translateX(-50%) translateY(0) rotate(-1deg)}50%{transform:translateX(-50%) translateY(-9px) rotate(1deg)}}
          @keyframes cuDodge{0%{transform:translateX(-50%)}25%{transform:translateX(-50%) translate(-46px,-6px) scale(.92)}55%{transform:translateX(-50%) translate(42px,6px) scale(.95)}100%{transform:translateX(-50%)}}
          @keyframes cuHit{0%,100%{transform:translateX(-50%)}20%{transform:translateX(-50%) translateX(-8px) scale(1.06)}40%{transform:translateX(-50%) translateX(8px) scale(.96)}60%{transform:translateX(-50%) translateX(-5px)}80%{transform:translateX(-50%) translateX(5px)}}
          @keyframes cuRing{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
          @keyframes cuPulse{0%,100%{opacity:.5}50%{opacity:1}}
        `}</style>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 18, padding: 3, background: `conic-gradient(from var(--cuAng), ${th.border.join(',')})`, animation: 'cuBorder 4s linear infinite', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', pointerEvents: 'none' }}/>

        <div ref={sceneRef} style={{ position: 'relative', borderRadius: 15, overflow: 'hidden', background: th.scene, height: 300 }}>
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', color: th.glow, textShadow: `0 0 10px ${th.accent}`, animation: 'cuPulse 1.6s ease-in-out infinite' }}>★ CAPTURE O UNIKO ★</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2, fontFamily: 'var(--font-brand)', letterSpacing: '.03em', textShadow: `0 2px 12px ${th.accent2}` }}>{uniko.shortName || uniko.name}</div>
          </div>

          {/* Cenário (igual ao card da Central Alexa) — escolhido pelo tema do Uniko */}
          {th.sceneType === 'ocean' ? <OceanScene jellies={4} fish={5} bubbles={8} whales={false} dolphins={false} />
            : th.sceneType === 'vampire' ? <VampireScene bats={6} />
            : null /* Unikos sem cenário artesanal (comuns/Oficina) usam só o fundo (th.scene) */}

          <div style={{ position: 'absolute', left: '50%', top: 138, width: 116, height: 116, border: `3px solid ${th.glow}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cuRing 2s ease-out infinite', pointerEvents: 'none', zIndex: 2 }}/>

          <img ref={unikoRef} src={uniko.img} alt={uniko.name} draggable="false"
            style={{ position: 'absolute', left: '50%', top: 76, transform: 'translateX(-50%)', width: 132, height: 132, objectFit: 'contain', zIndex: 3, filter: `drop-shadow(0 0 22px ${th.accent}) drop-shadow(0 8px 16px rgba(0,0,0,.6))`, animation: (phase === 'escaped' || phase === 'error') ? 'cuDodge .9s ease-in-out' : phase === 'thrown' ? 'cuHit .5s ease-in-out' : 'cuIdle 3.5s ease-in-out infinite' }}/>

          {phase === 'escaped' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#ffd9a0', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,180,80,.4)' }}>Escapou! Joga o UNIKO de novo</div>
            </div>
          )}
          {phase === 'error' && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 12, background: 'rgba(0,0,0,.55)', color: '#ffb0b0', fontWeight: 800, fontSize: 13, border: '1px solid rgba(255,80,80,.4)' }}>Erro de conexão — tenta de novo</div>
            </div>
          )}

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ fontSize: 11.5, color: '#fff', fontWeight: 700, marginBottom: 6, textShadow: `0 1px 8px ${th.accent2}` }}>
              {phase === 'thrown' ? '...' : 'Arraste o assistente UNIKO até aqui e solte!'}
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
};

export default CaptureUnikoWidget;
