// src/shared/CaptureUnikoWidget.jsx
// Widget "Capture o Uniko" — encontro estilo Pokémon GO. Agora é GLOBAL: montado uma vez
// no App, aparece como um card FLUTUANTE em qualquer lugar do sistema (Portal, Central
// Alexa, Editor...) e NÃO some ao navegar. Toca um SOM de alerta ao surgir.
// MECÂNICA: arraste o assistente UNIKO (canto) e solte em cima do Uniko pra arremessar.
// • O admin escolhe quantos colaboradores capturam por evento (1 a 5, campo maxWinners
//   do cfg — padrão 3 se não vier definido); as N primeiras tentativas bem-sucedidas
//   ganham; da próxima em diante o evento já está esgotado — lock por slot no Supabase.
// • Quem captura ganha os Prismas do Uniko (uniko.reward) e o Uniko vai pra coleção.
// • Uma tentativa só — captura sempre na primeira.
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getAuthUser } from '../contexts/user';
import { notifyDesktop } from '../utils/desktopNotify';
import VampireScene from './vampireScene';
import OceanScene from './oceanScene';
import CosmosScene from './cosmosScene';
import SakuraScene from './sakuraScene';
import FairyScene from './fairyScene';
import OliviaScene from './oliviaScene';
import {
  getUniko, isSpawned, spawnMoment, isCaptureDone, markCaptureDone,
  saveCaptureToCollection, emitCaptureState, emitCaptureSlotBusy, getCaptureResult, setCaptureResult,
  getCaptureReward, WINNER_PANEL_MS, fetchCaptureWinners, claimCapture, awardPrismas, addToMyUnikoCollection,
  registerCaptureTarget, onCaptureThrow, clearCaptureLocal, clearCaptureDone, isWithinWindow, subscribeCaptureWinner, syncCollectionFromServer,
  loadCustomUnikos, loadRewardOverrides, nowMs, ensureServerClock, maxWinnersFor, captureEventId,
} from './captureUniko';

// Captura sempre na 1ª (e única) tentativa de arremesso — sem chance de escapar.

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
  const [winners, setWinners]     = useState([]); // até maxWinners: [{player, at, comum, premium, unikoId, unikoName}]
  const [phase, setPhase]         = useState('idle'); // idle | thrown | error | caught
  const [checked, setChecked]     = useState(false);
  const [nowTs, setNowTs]         = useState(Date.now());
  const [, forceRefresh]          = useState(0);

  // Garante que os Unikos da Oficina estejam carregados ANTES de precisar deles aqui —
  // App.jsx já carrega no login, mas se o admin criar um Uniko novo e "Spawnar agora"
  // na sequência, uma aba já aberta no Portal pode ainda estar com o cache velho
  // (getUniko cairia no Vampire-Robot por engano). Recarrega ao montar e força um
  // re-render pra `getUniko` (que roda a cada render, sem estado próprio) already achar.
  useEffect(() => {
    loadCustomUnikos().then(() => forceRefresh(n => n + 1));
    loadRewardOverrides().then(() => forceRefresh(n => n + 1));
  }, []);

  // Até maxWinners (o admin escolhe, 1 a 5, padrão 3) pessoas capturam o mesmo evento —
  // cada uma vê o PRÓPRIO resultado; quem ainda não capturou continua vendo o encontro
  // disponível até esgotarem as vagas.
  const maxWinners = maxWinnersFor(cfg);
  const me      = getAuthUser()?.name;
  const myWin   = winners.find(w => w.player === me) || null;
  const isFull  = winners.length >= maxWinners;
  const latestWinner = winners.length ? winners[winners.length - 1] : null;
  const panelWinner  = myWin || latestWinner; // só define o TEMPO de exibição do painel (30 min)

  // Painel "resgatado"/"esgotado" fica visível por 30 min após a última captura; depois volta ao placeholder.
  const winnerAt = panelWinner?.at ? Date.parse(panelWinner.at) : null;
  const winnerActive = winnerAt != null && !Number.isNaN(winnerAt) && (nowTs - winnerAt < WINNER_PANEL_MS);
  const winnerMine = !!myWin;

  const sceneRef = useRef(null);
  const unikoRef = useRef(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const resolvingRef = useRef(false);
  const resolveAttemptRef = useRef(null); // sempre a versão mais recente de resolveAttempt (ver onCaptureThrow abaixo)
  const revealArmedRef = useRef(null);   // evento cujo instante de spawn já foi conferido com o relógio do servidor

  /* ── ZERA o estado quando começa um evento NOVO ─────────────────────────────
       Este componente é montado UMA vez no App e nunca desmonta — só recebe um
       `cfg` novo por realtime. Sem este reset, o estado do evento anterior ficava
       grudado e o Uniko seguinte era impossível de pegar sem F5:
       • `phase` continuava 'caught' pra quem já tinha capturado → o effect de
         "ficar disponível" abaixo é pulado inteiro (`phase !== 'caught'`), então
         não tocava o som, não avisava o assistente (emitCaptureState) e, o pior,
         não registrava o alvo (registerCaptureTarget) — soltar o assistente em
         cima do card não fazia nada. O handler de arremesso também barrava tudo
         em `phaseRef.current !== 'idle'`.
       • `winners` do evento velho ainda apontava myWin/isFull até o fetch novo
         responder.
       O eventId muda a cada spawn (é derivado do startAt, e o "Spawnar agora" do
       Dashboard grava startAt = agora), então isso dispara uma vez por evento. ── */
  const eventId = captureEventId(cfg);
  useEffect(() => {
    setPhase('idle');
    resolvingRef.current = false;
    revealArmedRef.current = null;
    setWinners([]);
    setAvailable(false);
    setChecked(false); // o fetch de vencedores logo abaixo devolve pra true
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
      if (ws === undefined) {                 // erro de rede → confia no cache local
        const cached = getCaptureResult(cfg);
        if (cached) setWinners(Array.isArray(cached) ? cached : [cached]); // compat com o formato antigo (1 vencedor só)
        setChecked(true); return;
      }
      setWinners(ws);
      setCaptureResult(cfg, ws);
      const meNow = getAuthUser()?.name;
      /* O SERVIDOR manda. Se ainda há vaga e eu não sou um dos vencedores, a
         marca local de "esse evento já era" tem que CAIR — senão o card fica
         mudo mostrando "1 de 3 vagas usadas" sem deixar ninguém capturar.
         Isso acontecia de verdade: a marca é gravada quando as vagas fecham,
         mas se o admin AUMENTASSE o número de vagas do mesmo evento (o id é
         derivado do startAt, então continua o mesmo), ou se uma tentativa
         antiga tivesse marcado sem gravar nada no banco, ela ficava presa —
         só era limpa quando o servidor voltava com ZERO vencedores.
         Limpar aqui, ANTES do `setChecked(true)`, é o que faz o efeito de
         disponibilidade logo abaixo reavaliar já sem a marca. */
      if (ws.length >= maxWinners || ws.some(w => w.player === meNow)) markCaptureDone(cfg);
      else if (ws.length === 0) clearCaptureLocal(cfg);
      else clearCaptureDone(cfg);
      setChecked(true);
    })();
    return () => { alive = false; };
  }, [cfg, maxWinners]);

  /* ── Surgimento SINCRONIZADO: todos veem no mesmo momento (spawnAt do config) ──
       Continua disponível pra quem ainda não capturou até as 5 vagas acabarem. ── */
  useEffect(() => {
    if (!cfg || !checked || isFull || myWin || isCaptureDone(cfg)) return;
    let alive = true, revealT;

    // Ainda não chegou o spawnAt → agenda a revelação pro instante exato (o mesmo
    // pra todo mundo, via nowMs()) e, chegando perto, já mede o relógio contra o
    // servidor pra não pagar o round-trip na hora H.
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
      /* CONFERE O RELÓGIO COM O SERVIDOR ANTES DE REVELAR — e, por tabela, antes de
         disparar a notificação no desktop (que sai da transição pra `available`).
         `nowMs()` só é confiável se o desvio foi medido há pouco: num PC com a hora
         adiantada (ou onde a medição do login falhou/ficou velha), o cliente achava
         que o Uniko já tinha surgido e avisava ANTES de ele aparecer de verdade pra
         todo mundo. Uma medição por evento; se ela disser que ainda não é hora, o
         encontro volta a ficar agendado pro instante certo. */
      if (revealArmedRef.current !== eventId) {
        await ensureServerClock();
        if (!alive) return;
        revealArmedRef.current = eventId;  // marca mesmo se a medição falhar: relógio não pode travar o evento
        if (!isSpawned(cfg)) { setAvailable(false); agendarRevelacao(); return; }
      }
      setAvailable(true);
    };

    evaluate();
    const tick = setInterval(evaluate, 3000);
    // Aba em segundo plano tem os timers estrangulados pelo navegador (~1x/min):
    // ao voltar pra aba, reavalia na hora em vez de esperar o próximo tick.
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

  /* ── Avisa no DESKTOP quando o Uniko surge (transição false→true só) — mesmo
       caminho dos lembretes/avisos do RH (extensão Cat-bot → fallback Web Notifications
       API). Id estável (uniko-cfg) evita notificação duplicada entre abas abertas. ── */
  const notifiedSpawnRef = useRef(null);
  useEffect(() => {
    if (!available || !cfg) { notifiedSpawnRef.current = null; return; }
    // Trava de segurança: o aviso NUNCA sai antes do instante do spawn (nem fora da
    // janela do evento). `available` já respeita isso, mas esta é a garantia de que
    // nenhum caminho futuro consiga avisar antes do Uniko existir pra todo mundo.
    if (!isSpawned(cfg)) return;
    const spawnKey = `${cfg.unikoId}-${cfg.startAt || ''}`;
    if (notifiedSpawnRef.current === spawnKey) return;
    notifiedSpawnRef.current = spawnKey;
    notifyDesktop({
      id: `capture-uniko-${spawnKey}`,
      type: 'lembrete',
      title: '.✧. Um Uniko selvagem apareceu! .✧.',
      message: `${uniko.name} está no Portal do Colaborador, na aba Início — corre lá antes que as vagas acabem! 🐱`,
    });
  }, [available, cfg, uniko]);

  /* ── Alguém (um dos até 5) capturou? → acumula na lista; quando fecha as 5 vagas,
       some pra quem ainda não capturou. Realtime (quase instantâneo, requer
       supabase_capture_uniko_realtime.sql) + poll de 4s como fallback caso o
       realtime não esteja habilitado no projeto Supabase. ── */
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

  /* ── Quando as 5 vagas se esgotam (por qualquer via acima) → some pra quem
       ainda não capturou e avisa o assistente que acabou o encontro. ── */
  useEffect(() => {
    if (cfg && isFull && !myWin) {
      markCaptureDone(cfg);
      setAvailable(false);
      emitCaptureState({ available: false, uniko: null, captured: true });
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

  /* Enquanto o painel de vencedores está na tela, um tique lento mantém o
     texto em dia — é ele que decide entre "ainda dá tempo" e "o encontro
     acabou" (o resto do widget só re-renderiza quando algo mais muda). */
  useEffect(() => {
    if (!winnerActive) return;
    const id = setInterval(() => setNowTs(Date.now()), 15000);
    return () => clearInterval(id);
  }, [winnerActive]);

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

  // UMA tentativa só — captura sempre na primeira (sem chance de escapar).
  const resolveAttempt = async () => {
    resolvingRef.current = true;
    // Recarrega os Unikos da Oficina E os overrides de recompensa dos fixos
    // (Vampire-Robot/Sereia) AGORA (não confia no cache carregado só no mount)
    // e resolve o `uniko` DE NOVO a partir dele — sem isso, um admin editando a
    // recompensa (ex.: comum/premium) DEPOIS que alguém já tinha a aba aberta
    // fazia essa pessoa creditar o valor VELHO na hora de capturar, enquanto
    // quem abriu a aba depois da edição pegava o valor certo (bug real: Uniko
    // Natureza editado pra 10/2, dois jogadores com aba aberta desde antes
    // ainda creditaram o valor antigo, 50/50 — e de novo com a Sereia editada
    // na Dashboard: quem já estava com o Portal aberto desde antes da edição
    // ainda creditou 100/100 em vez do valor novo).
    await Promise.all([loadCustomUnikos(), loadRewardOverrides()]);
    const freshUniko = getUniko(cfg?.unikoId);
    const { won, alreadyMine, isFull: full, rejected, winner, winners: fullList, networkError } = await claimCapture(cfg, freshUniko);
    if (networkError || rejected) {
      // erro de verdade, ou recusa com vaga ainda sobrando (ver claimCapture)
      // — NÃO marca como feito; deixa tentar de novo em vez de fingir sucesso
      // sem nada gravado (era isso que travava o card com vaga livre).
      setPhase('error');
      setTimeout(() => { setPhase('idle'); resolvingRef.current = false; }, 1800);
      return;
    }
    const me = getAuthUser()?.name || 'Você';
    markCaptureDone(cfg);
    setPhase('caught');
    setAvailable(false);
    if (won) {
      const reward = getCaptureReward(freshUniko);
      awardPrismas(me, reward.comum, reward.premium);
      addToMyUnikoCollection(freshUniko);             // otimista: já aparece na Coleção local na hora
      await saveCaptureToCollection(freshUniko);       // grava no servidor (agora loga erro se falhar)
      syncCollectionFromServer();                     // reconcilia com o servidor (fire-and-forget)
      setWinners(prev => {
        if (prev.some(p => p.player === me)) return prev;
        const next = [...prev, winner].slice(0, maxWinners);
        setCaptureResult(cfg, next);
        return next;
      });
      emitCaptureState({ available: false, uniko: freshUniko, captured: true });
    } else if (!alreadyMine && full && fullList?.length) {
      // esgotado (5/5) — mostra a lista completa de quem conseguiu
      setWinners(fullList);
      setCaptureResult(cfg, fullList);
      emitCaptureState({ available: false, uniko: null, captured: true });
    } else {
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

  // Painel "Você resgatou!" — só pra quem capturou (fica 30 min)
  if (winnerActive && myWin && !available) {
    return wrap(
        <div style={{ pointerEvents: 'auto', width: '100%', borderRadius: 18, padding: 3, background: `conic-gradient(${th.border.join(',')})`, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cuToastIn .4s ease' }}>
          <style>{`@keyframes cuToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ borderRadius: 15, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px' }}>
            <img src={uniko.img} alt={uniko.name} style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 16px ${th.accent})` }}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', color: th.glow, textShadow: `0 0 10px ${th.accent}` }}>★ UNIKO RESGATADO ★</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-brand)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Você resgatou!
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 7 }}>
                <span style={{ fontSize: 11.5, color: th.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={th.ink} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>
                  {fmtWhen(myWin.at)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(39,198,222,.18)', border: '1px solid rgba(39,198,222,.5)', borderRadius: 999, padding: '2px 9px' }}><img src="/PrismaComum.png" alt="" onError={e=>{e.target.style.display='none';}} style={{ width: 14, height: 14 }}/>+{myWin.comum || 0}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(155,107,255,.2)', border: '1px solid rgba(155,107,255,.55)', borderRadius: 999, padding: '2px 9px' }}><img src="/PrismaPremium.png" alt="" onError={e=>{e.target.style.display='none';}} style={{ width: 14, height: 14 }}/>+{myWin.premium || 0}</span>
              </div>
            </div>
          </div>
        </div>
    );
  }

  /* Sobrar vaga NESTE painel quer dizer que o encontro fechou antes de todas
     serem usadas — e o painel fica 30 min no ar depois disso. Era daí que vinha
     o "1 de 3 vagas usadas" que parecia contraditório: a conta dizia que
     sobrava vaga, mas o evento já tinha acabado e ninguém podia mais pegar.
     `encontroAberto` separa os dois casos pro texto nunca mentir. */
  const encontroAberto = isWithinWindow(cfg, nowTs);
  const sobrando = Math.max(0, maxWinners - winners.length);

  // Painel "não fui eu" — dispara sempre que winnerActive (o mesmo sinal que emitCaptureSlotBusy
  // usa lá no TabInicio pra reservar o espaço do card). Antes só cobria o caso "esgotado" (3/3);
  // se alguém capturasse 1 ou 2 vagas sem fechar todas, ninguém mais via NADA aqui (nem esse
  // painel, nem o "Não há nada aqui, por enquanto..." do TabInicio, que só reaparece quando o
  // card "não está ocupado") — o espaço ficava vazio/colapsado até winnerActive expirar (30 min).
  if (winnerActive && !myWin && !available) {
    return wrap(
        <div style={{ pointerEvents: 'auto', width: '100%', borderRadius: 18, padding: 3, background: `conic-gradient(${th.border.join(',')})`, boxShadow: `0 18px 50px ${th.accent}66`, animation: 'cuToastIn .4s ease' }}>
          <style>{`@keyframes cuToastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ borderRadius: 15, background: th.scene, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px' }}>
            <img src={uniko.img} alt={uniko.name} style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, opacity: .5, filter: 'grayscale(.6)' }}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* "1 de 3 vagas usadas" sozinho era contraditório (relato do
                  usuário): sobrava vaga na conta e ninguém conseguia pegar.
                  Sobrar vaga aqui só acontece quando o ENCONTRO ACABOU (a
                  janela do evento fechou, ou o admin desligou) — as vagas que
                  faltam simplesmente não vão ser usadas. Agora o painel diz
                  isso com todas as letras em vez de deixar a conta no ar. */}
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', color: th.glow, textShadow: `0 0 10px ${th.accent}` }}>
                {isFull ? '★ TODAS AS VAGAS FORAM USADAS ★' : encontroAberto ? '★ ALGUÉM JÁ CAPTUROU ★' : '★ O ENCONTRO ACABOU ★'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-brand)', marginTop: 1 }}>
                {isFull
                  ? `${winners.length} de ${maxWinners} vagas usadas`
                  : `${winners.length} de ${maxWinners} ${maxWinners === 1 ? 'vaga foi usada' : 'vagas foram usadas'}`}
              </div>
              {!isFull && (
                <div style={{ fontSize: 11.5, color: th.ink, marginTop: 4 }}>
                  {encontroAberto
                    ? `Ainda ${sobrando === 1 ? 'sobra 1 vaga' : `sobram ${sobrando} vagas`} — o encontro continua!`
                    : `${sobrando === 1 ? 'A outra vaga ficou' : `As outras ${sobrando} vagas ficaram`} sem dono — o tempo do evento terminou.`}
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
            : th.sceneType === 'cosmos' ? <CosmosScene />
            : th.sceneType === 'sakura' ? <SakuraScene />
            : th.sceneType === 'fairy' ? <FairyScene />
            : th.sceneType === 'olivia' ? <OliviaScene />
            : null /* Unikos sem cenário artesanal (comuns/Oficina) usam só o fundo (th.scene) */}

          <div style={{ position: 'absolute', left: '50%', top: 138, width: 116, height: 116, border: `3px solid ${th.glow}`, borderRadius: '50%', transform: 'translate(-50%,-50%) scale(.4)', animation: 'cuRing 2s ease-out infinite', pointerEvents: 'none', zIndex: 2 }}/>

          <img ref={unikoRef} src={uniko.img} alt={uniko.name} draggable="false"
            style={{ position: 'absolute', left: '50%', top: 76, transform: 'translateX(-50%)', width: 132, height: 132, objectFit: 'contain', zIndex: 3, filter: `drop-shadow(0 0 22px ${th.accent}) drop-shadow(0 8px 16px rgba(0,0,0,.6))`, animation: phase === 'error' ? 'cuDodge .9s ease-in-out' : phase === 'thrown' ? 'cuHit .5s ease-in-out' : 'cuIdle 3.5s ease-in-out infinite' }}/>

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
        </div>
      </div>
  );
};

export default CaptureUnikoWidget;
