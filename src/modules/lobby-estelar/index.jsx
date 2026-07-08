import { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { supabase, getAuthUser } from '../../contexts/user';
import { getActiveAssistantSkinId, getAssistantSkin, onAssistantSkinChange } from '../../shared/assistantSkin';

/* ══════════════════════════════════════════════════════════════════
   LOBBY ESTELAR — espaço social estilo Habbo Hotel (bem simples): um
   cenário fixo onde cada colaborador online aparece como o Uniko que
   usa como assistente, com o nome (primeiro + segundo) em cima, anda
   pelo chão com WASD/setas/mouse, e pode abrir o chat (;/T/Enter) pra
   falar — aparece um balão em cima dele + entra no histórico (canto
   superior esquerdo).

   Presença/posição/balão moram numa linha por jogador na tabela
   lobby_presence (ver supabase_lobby_estelar.sql) — sincroniza via
   Supabase Realtime (postgres_changes) + poll de reforço, mesmo padrão
   já usado no resto do app. Sem tabela de "quem tá online" separada:
   uma linha sem heartbeat recente é só filtrada no cliente (STALE_MS).

   Só admin vê por enquanto (gate em App.jsx/ModuleSelector). O
   assistente flutuante (dicas/perguntas) é escondido nessa tela pelo
   App.jsx enquanto screen==='lobby-estelar'.

   Chão: área retangular (x 0-100%, y 0-100%) desenhada por cima do
   cenário — SCENES fica como mapa pra facilitar adicionar mais
   cenários no futuro sem mexer no resto do componente.
══════════════════════════════════════════════════════════════════ */

const SCENES = {
  // Faixa do chão cinza metálico dessa arte específica: começa logo abaixo do
  // emblema circular e vai até a borda de baixo da imagem.
  // exitRight/exitLeft: atravessar aquela borda lateral leva pro cenário indicado.
  hangar: { bg: '/lobby-estelar/hangar.png', floorBottomPct: 2, floorHeightPct: 38, minX: 10, maxX: 90, exitRight: 'laboratorio' },
  laboratorio: { bg: '/lobby-estelar/laboratorio.png', floorBottomPct: 2, floorHeightPct: 36, minX: 6, maxX: 94, exitLeft: 'hangar', exitRight: 'biolab' },
  biolab: { bg: '/lobby-estelar/biolab.png', floorBottomPct: 2, floorHeightPct: 40, minX: 8, maxX: 92, exitLeft: 'laboratorio', exitRight: 'izakaya' },
  izakaya: { bg: '/lobby-estelar/izakaya.png', floorBottomPct: 2, floorHeightPct: 38, minX: 10, maxX: 90, exitLeft: 'biolab' },
};
const DEFAULT_SCENE = 'hangar';

const HEARTBEAT_MS   = 8000;
const STALE_MS       = 22000;
const BUBBLE_MS      = 7000;
const MOVE_TRANSITION_S = 0.12;
const BROADCAST_MS   = 150;   // throttle do envio de posição pro servidor
const SPEED_PCT_S    = 32;    // velocidade de andar (% da área por segundo)
const ICON_SIZE      = 132;
const CHAT_LOG_MAX   = 30;
const ENTRY_MARGIN   = 3;    // onde aparece do outro lado da porta (distância da borda)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shortName = (n) => (n || '').trim().split(/\s+/).slice(0, 2).join(' ');
const isTypingTarget = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

// Portal espiral — marca visualmente onde o cenário atual dá acesso a outro
// (side: 'left' ou 'right'). Puramente decorativo — quem decide a travessia
// de verdade é a checagem de x/exitLeft/exitRight no loop de movimento/clique.
// Camadas (estilo "Abismo Espiral"): fundo escuro + 2 braços em conic-gradient
// girando em direções/velocidades opostas (dá profundidade) + anéis
// concêntricos "respirando" pra dentro/fora + núcleo pulsante no centro.
const Portal = ({ side }) => (
  <div style={{
    position: 'absolute', [side]: '1.5%', bottom: '4%', width: 100, height: 230,
    zIndex: 12, pointerEvents: 'none', borderRadius: '50%', overflow: 'hidden',
    background: '#070311',
    boxShadow: '0 0 60px 18px rgba(124,58,237,0.55), 0 0 110px 40px rgba(34,211,238,0.22), inset 0 0 40px 12px rgba(0,0,0,0.85)',
  }}>
    <div style={{
      position: 'absolute', inset: '-45%', borderRadius: '50%',
      background: 'repeating-conic-gradient(from 0deg, rgba(168,85,247,0.95) 0deg 8deg, transparent 8deg 46deg, rgba(34,211,238,0.75) 46deg 54deg, transparent 54deg 92deg)',
      animation: 'lobbyPortalSpin 2.4s linear infinite', filter: 'blur(1px)',
      maskImage: 'radial-gradient(circle, black 55%, transparent 100%)', WebkitMaskImage: 'radial-gradient(circle, black 55%, transparent 100%)',
    }} />
    <div style={{
      position: 'absolute', inset: '5%', borderRadius: '50%',
      background: 'repeating-conic-gradient(from 45deg, rgba(255,255,255,0.55) 0deg 4deg, transparent 4deg 40deg)',
      animation: 'lobbyPortalSpin 1.1s linear infinite reverse', filter: 'blur(0.5px)',
      maskImage: 'radial-gradient(circle, black 45%, transparent 88%)', WebkitMaskImage: 'radial-gradient(circle, black 45%, transparent 88%)',
    }} />
    <div style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      background: 'repeating-radial-gradient(circle at 50% 50%, rgba(168,85,247,0.4) 0, rgba(168,85,247,0.4) 2px, transparent 2px, transparent 13px)',
      animation: 'lobbyPortalPulse 1.7s ease-in-out infinite',
    }} />
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: '24%', height: '13%',
      transform: 'translate(-50%,-50%)', borderRadius: '50%',
      background: 'radial-gradient(circle, #fff, #a855f7 55%, transparent 100%)',
      animation: 'lobbyPortalCore 1.8s ease-in-out infinite', filter: 'blur(2px)',
    }} />
  </div>
);

export const LobbyEstelar = ({ onBack, authUser }) => {
  const player = authUser?.name || getAuthUser()?.name || 'Anônimo';
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const sceneCfg = SCENES[scene];

  const [skinId, setSkinId] = useState(getActiveAssistantSkinId());
  const [players, setPlayers] = useState([]);
  const [pos, setPos] = useState({ x: 50, y: 40 });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [myMsg, setMyMsg] = useState(null); // {text, at} — bolha da MINHA fala, otimista (sem esperar o servidor)
  const [isMoving, setIsMoving] = useState(false); // true enquanto anda (WASD/setas OU indo até o clique) — flutuação mais rápida
  const [, setTick] = useState(0);

  const sceneElRef = useRef(null);
  const posRef = useRef(pos);
  const skinIdRef = useRef(skinId);
  const sceneRef = useRef(scene);
  const chatOpenRef = useRef(chatOpen);
  const keysRef = useRef({});
  const lastBroadcastRef = useRef(0);
  const seenMsgRef = useRef({});
  const clickTargetRef = useRef(null); // {x,y} — destino do clique; anda suave até lá (não teleporta)

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { skinIdRef.current = skinId; }, [skinId]);
  useEffect(() => { sceneRef.current = scene; }, [scene]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => onAssistantSkinChange(setSkinId), []);

  // Lê scene/skin/pos sempre via ref (não fecha sobre o valor do render) — assim
  // não precisa recriar heartbeat/poll/realtime toda vez que troca de cenário.
  const upsertMe = useCallback(async (patch = {}) => {
    try {
      await supabase.from('lobby_presence').upsert({
        player, scene: sceneRef.current, skin_id: skinIdRef.current, x: posRef.current.x, y: posRef.current.y,
        updated_at: new Date().toISOString(), ...patch,
      }, { onConflict: 'player' });
    } catch { /* rede instável — próximo heartbeat/frame tenta de novo */ }
  }, [player]);

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('lobby_presence').select('*').eq('scene', sceneRef.current);
    if (!data) return;
    setPlayers(data);
    // Detecta mensagens NOVAS (message_at mudou) pra alimentar o histórico do chat.
    // Compara por VALOR de tempo (epoch ms), não pela string crua — o Postgres pode
    // devolver o timestamp num formato diferente do que foi enviado (ex.: "Z" vira
    // "+00:00"), então comparar string com string às vezes falhava e duplicava.
    const fresh = [];
    for (const row of data) {
      if (!row.message || !row.message_at) continue;
      const t = new Date(row.message_at).getTime();
      if (seenMsgRef.current[row.player] === t) continue;
      seenMsgRef.current[row.player] = t;
      fresh.push({ id: row.player + '_' + t, player: row.player, message: row.message, at: row.message_at });
    }
    if (fresh.length) {
      fresh.sort((a, b) => new Date(a.at) - new Date(b.at));
      setChatLog(prev => [...prev, ...fresh].slice(-CHAT_LOG_MAX));
    }
  }, []);

  // Entra no lobby + heartbeat + poll de reforço + realtime + tick (expira balões).
  // Roda só UMA VEZ (não em toda troca de cenário — senão apagaria/recriaria a
  // linha de presença a cada passagem de porta); loadPlayers/upsertMe sempre leem
  // o cenário ATUAL via sceneRef.
  useEffect(() => {
    upsertMe();
    loadPlayers();
    const hb   = setInterval(() => upsertMe(), HEARTBEAT_MS);
    const poll = setInterval(loadPlayers, 5000);
    const timr = setInterval(() => setTick(t => t + 1), 1000);
    const sub = supabase.channel('lobby_presence_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_presence' }, loadPlayers)
      .subscribe();
    return () => {
      clearInterval(hb); clearInterval(poll); clearInterval(timr);
      supabase.removeChannel(sub);
      supabase.from('lobby_presence').delete().eq('player', player).then(() => {}, () => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mudou a skin do assistente enquanto estava no lobby → avisa os outros
  useEffect(() => { upsertMe({ skin_id: skinId }); }, [skinId, upsertMe]);

  // Atravessou a borda lateral pra outro cenário: aparece do lado OPOSTO de lá
  // (entrou pela direita → surge perto da borda esquerda do novo cenário, e
  // vice-versa). Atualiza as refs NA HORA (não só via effect) pra loadPlayers/
  // upsertMe já usarem o cenário novo na mesma chamada, sem esperar o re-render.
  const enterScene = useCallback((nextId, side, ny) => {
    const next = SCENES[nextId];
    const sx = side === 'fromRight' ? next.minX + ENTRY_MARGIN : next.maxX - ENTRY_MARGIN;
    sceneRef.current = nextId;
    posRef.current = { x: sx, y: ny };
    setScene(nextId);
    setPos({ x: sx, y: ny });
    setPlayers([]); // some com os avatares do cenário antigo na hora, sem esperar o fetch
    upsertMe({ scene: nextId, x: sx, y: ny });
    loadPlayers();
  }, [upsertMe, loadPlayers]);

  // Mostra o balão/histórico da MINHA fala na hora (sem esperar o vai-e-volta do
  // servidor) — o que dava aquela sensação de atraso ao digitar.
  const sendMessage = useCallback(() => {
    setChatText(curr => {
      const text = curr.trim().slice(0, 140);
      if (text) {
        const at = new Date().toISOString();
        setMyMsg({ text, at });
        seenMsgRef.current[player] = new Date(at).getTime(); // evita duplicar quando o servidor confirmar (mesmo formato do loadPlayers)
        setChatLog(prev => [...prev, { id: player + '_' + at, player, message: text, at }].slice(-CHAT_LOG_MAX));
        upsertMe({ message: text, message_at: at });
      }
      return '';
    });
    setChatOpen(false);
  }, [upsertMe, player]);

  // ── Movimento: WASD / setas (loop contínuo) + clique no chão ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysRef.current[k] = true;
        clickTargetRef.current = null; // teclado interrompe o "andar até o clique"
        e.preventDefault();
      } else if (!chatOpenRef.current && (k === ';' || k === 't' || k === 'enter')) {
        e.preventDefault();
        setChatOpen(true);
      }
    };
    const onKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Loop de movimento (WASD/setas + andar até o clique). Lê o cenário atual via
  // sceneRef (não fecha sobre sceneCfg do render) — assim o efeito só monta UMA
  // VEZ, e continua funcionando certinho depois de atravessar pra outro cenário.
  useEffect(() => {
    // Aplica um passo de movimento (rawX/ny já calculados) — detecta travessia
    // de cenário e faz o broadcast (throttle normal, ou na hora se `force`).
    const stepTo = (rawX, ny, now, force) => {
      const cfg = SCENES[sceneRef.current];
      if (rawX >= cfg.maxX && cfg.exitRight) {
        clickTargetRef.current = null;
        enterScene(cfg.exitRight, 'fromRight', ny);
        return;
      }
      if (rawX <= cfg.minX && cfg.exitLeft) {
        clickTargetRef.current = null;
        enterScene(cfg.exitLeft, 'fromLeft', ny);
        return;
      }
      const nx = clamp(rawX, cfg.minX, cfg.maxX);
      setPos({ x: nx, y: ny });
      posRef.current = { x: nx, y: ny };
      if (force || now - lastBroadcastRef.current > BROADCAST_MS) { lastBroadcastRef.current = now; upsertMe({ x: nx, y: ny }); }
    };

    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const k = keysRef.current;
      let dx = 0, dy = 0;
      if (k.a || k.arrowleft)  dx -= 1;
      if (k.d || k.arrowright) dx += 1;
      // y=0 é a frente (mais perto da câmera) e y=100 o fundo — por isso quem
      // quer ANDAR PRA FRENTE aperta a seta/tecla de BAIXO (aumenta o "bottom"
      // na tela, se aproxima), e PRA TRÁS aperta a de CIMA.
      if (k.s || k.arrowdown)  dy -= 1;
      if (k.w || k.arrowup)    dy += 1;

      let moving = false;
      if (dx || dy) {
        moving = true;
        const len = Math.hypot(dx, dy) || 1;
        const rawX = posRef.current.x + (dx / len) * SPEED_PCT_S * dt;
        const ny = clamp(posRef.current.y + (dy / len) * SPEED_PCT_S * dt, 0, 100);
        stepTo(rawX, ny, now);
      } else if (clickTargetRef.current) {
        // Anda em direção ao alvo do clique na MESMA velocidade do teclado — não
        // teleporta pro ponto clicado, só define pra onde ir.
        const t = clickTargetRef.current;
        const ddx = t.x - posRef.current.x, ddy = t.y - posRef.current.y;
        const dist = Math.hypot(ddx, ddy);
        const step = SPEED_PCT_S * dt;
        if (dist <= step || dist < 0.4) {
          clickTargetRef.current = null;
          stepTo(t.x, t.y, now, true);
        } else {
          moving = true;
          const nx = posRef.current.x + (ddx / dist) * step;
          const ny = posRef.current.y + (ddy / dist) * step;
          stepTo(nx, ny, now);
        }
      }
      setIsMoving(moving);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [upsertMe, enterScene]);

  // Clique no chão: define o DESTINO (x + y, dentro da faixa do chão) — o loop
  // acima anda suavemente até lá, na mesma velocidade do teclado. Clicar além da
  // borda lateral (onde tem exitRight/exitLeft) também funciona: o loop detecta
  // a travessia sozinho quando chega perto, igual andando com o teclado.
  const walkToClick = (e) => {
    const el = sceneElRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const rawX = ((e.clientX - r.left) / r.width) * 100;
    const bandBottomPx = r.height * (sceneCfg.floorBottomPct / 100);
    const bandHeightPx = r.height * (sceneCfg.floorHeightPct / 100);
    const relFromBottom = r.height - (e.clientY - r.top);
    const y = clamp(((relFromBottom - bandBottomPx) / bandHeightPx) * 100, 0, 100);
    const x = clamp(rawX, sceneCfg.minX, sceneCfg.maxX);
    clickTargetRef.current = { x, y };
  };

  const isFresh = (row) => row && (Date.now() - new Date(row.updated_at).getTime()) < STALE_MS;
  const bubbleOf = (row) => row?.message_at && (Date.now() - new Date(row.message_at).getTime()) < BUBBLE_MS ? row.message : null;

  const myRow  = players.find(p => p.player === player);
  const others = players.filter(p => p.player !== player && isFresh(p));
  const myBubble = (myMsg && (Date.now() - new Date(myMsg.at).getTime()) < BUBBLE_MS) ? myMsg.text : bubbleOf(myRow);

  const avatars = [
    { player, x: pos.x, y: pos.y, skin_id: skinId, message: myBubble, isMe: true, moving: isMoving },
    ...others.map(p => ({ player: p.player, x: p.x, y: p.y ?? 40, skin_id: p.skin_id, message: bubbleOf(p), isMe: false, moving: false })),
  ];

  const bottomOf = (y) => sceneCfg.floorBottomPct + (y / 100) * sceneCfg.floorHeightPct;

  return (
    <div style={{ minHeight: '100vh', background: '#05070f', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <div style={{ height: 56, background: 'rgba(8,10,22,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12, position: 'relative', zIndex: 30 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#cfd6ea', fontSize: 13, fontFamily: 'var(--font-body)', padding: '4px 8px', borderRadius: 7 }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Módulos
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-brand)', letterSpacing: '.04em' }}>Lobby Estelar</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>WASD/setas pra andar · ; T Enter pra falar</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4ade80' }}>{others.length + 1} no lobby</span>
        </div>
      </div>

      {/* Cenário */}
      <div ref={sceneElRef} onClick={walkToClick}
        style={{ position: 'relative', flex: 1, backgroundImage: `url(${sceneCfg.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', overflow: 'hidden' }}>
        <style>{`
          @keyframes lobbyIdleBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
          @keyframes lobbyBubbleIn { from { opacity:0; transform: translate(-50%,4px) scale(.9) } to { opacity:1; transform: translate(-50%,0) scale(1) } }
          @keyframes lobbyPortalSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
          @keyframes lobbyPortalPulse { 0%,100% { transform: scale(1); opacity:.65 } 50% { transform: scale(.82); opacity:1 } }
          @keyframes lobbyPortalCore { 0%,100% { opacity:.7; transform: translate(-50%,-50%) scale(.85) } 50% { opacity:1; transform: translate(-50%,-50%) scale(1.2) } }
        `}</style>

        {sceneCfg.exitLeft  && <Portal side="left" />}
        {sceneCfg.exitRight && <Portal side="right" />}

        {avatars.map(a => {
          const skin = getAssistantSkin(a.skin_id);
          const sprite = skin?.blink?.open || '/UNIKO_NEW.png';
          return (
            <div key={a.player}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: `${a.x}%`, bottom: `${bottomOf(a.y)}%`,
                transform: 'translate(-50%,0)', transition: `left ${MOVE_TRANSITION_S}s linear, bottom ${MOVE_TRANSITION_S}s linear`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default',
                zIndex: 20 + Math.round(a.y),
              }}>
              {a.message && (
                <div style={{
                  marginBottom: 8, maxWidth: 260, padding: '11px 18px', borderRadius: 20, borderBottomLeftRadius: 5,
                  background: '#fff', color: '#1a1a2e', fontSize: 15, fontWeight: 500, lineHeight: 1.45, boxShadow: '0 6px 22px rgba(0,0,0,0.4)',
                  animation: 'lobbyBubbleIn .18s ease', wordBreak: 'break-word', textAlign: 'center',
                }}>
                  {a.message}
                </div>
              )}
              <div style={{
                fontSize: 17, fontWeight: 700, color: a.isMe ? '#ffd76a' : '#fff', marginBottom: 5,
                fontFamily: "'Poppins', sans-serif", letterSpacing: '.03em',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', padding: '3px 13px',
                borderRadius: 9, background: 'rgba(0,0,0,0.4)',
              }}>
                {shortName(a.player)}{a.isMe ? ' (você)' : ''}
              </div>
              <div style={{ width: ICON_SIZE, height: ICON_SIZE, animation: `lobbyIdleBob ${a.moving ? '0.45s' : '2.6s'} ease-in-out infinite`, filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.5))' }}>
                <img src={sprite} alt={a.player} draggable={false} onDragStart={e => e.preventDefault()}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', WebkitUserDrag: 'none', pointerEvents: 'none' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Histórico do chat — canto superior esquerdo */}
      <div style={{ position: 'fixed', top: 68, left: 16, zIndex: 35, width: 340, maxHeight: '62vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, padding: chatLog.length ? 16 : 0, borderRadius: 14, background: chatLog.length ? 'rgba(8,10,22,0.78)' : 'transparent', backdropFilter: chatLog.length ? 'blur(16px)' : 'none', border: chatLog.length ? '1px solid rgba(255,255,255,0.12)' : 'none', boxShadow: chatLog.length ? '0 10px 34px rgba(0,0,0,0.35)' : 'none' }}>
        {chatLog.slice().reverse().map(m => (
          <div key={m.id} style={{ fontSize: 15, color: '#e4e8f5', lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700, color: '#ffd76a', fontFamily: "'Poppins', sans-serif" }}>{shortName(m.player)}: </span>
            <span style={{ fontFamily: 'var(--font-body)' }}>{m.message}</span>
          </div>
        ))}
      </div>

      {/* Chat: digitar */}
      <div style={{ position: 'fixed', left: 20, bottom: 20, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        {chatOpen && (
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, background: 'rgba(8,10,22,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
            <input autoFocus value={chatText} onChange={e => setChatText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); if (e.key === 'Escape') setChatOpen(false); }}
              placeholder="Fala algo..." maxLength={140}
              style={{ width: 220, padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13.5, outline: 'none', fontFamily: 'var(--font-body)' }} />
            <button onClick={sendMessage} disabled={!chatText.trim()}
              style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: T.gold, color: '#fff', fontWeight: 600, fontSize: 13, cursor: chatText.trim() ? 'pointer' : 'not-allowed', opacity: chatText.trim() ? 1 : 0.5, fontFamily: 'var(--font-body)' }}>
              Enviar
            </button>
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); setChatOpen(o => !o); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: chatOpen ? 'rgba(255,255,255,0.1)' : T.gold, color: '#fff', fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-body)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
          {chatOpen ? 'Fechar chat' : 'Abrir chat'}
        </button>
      </div>
    </div>
  );
};

export default LobbyEstelar;
