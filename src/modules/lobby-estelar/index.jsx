import { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { supabase, getAuthUser } from '../../contexts/user';
import { getActiveAssistantSkinId, getAssistantSkin, onAssistantSkinChange } from '../../shared/assistantSkin';

/* ══════════════════════════════════════════════════════════════════
   LOBBY ESTELAR — espaço social estilo Habbo Hotel (bem simples): um
   cenário fixo onde cada colaborador online aparece como o Uniko que
   usa como assistente, com o nome em cima, anda pro lado clicando no
   chão, e pode abrir o chat pra falar (aparece um balão em cima dele).

   Presença/posição/balão moram numa linha por jogador na tabela
   lobby_presence (ver supabase_lobby_estelar.sql) — sincroniza via
   Supabase Realtime (postgres_changes) + poll de reforço, mesmo padrão
   já usado no resto do app. Sem tabela de "quem tá online" separada:
   uma linha sem heartbeat recente é só filtrada no cliente (STALE_MS).

   Só admin vê por enquanto (gate em App.jsx/ModuleSelector). Futuro:
   mais cenários — deixei SCENES como um mapa pra isso ser só adicionar
   uma entrada nova, sem mexer no resto.
══════════════════════════════════════════════════════════════════ */

const SCENES = {
  hangar: { bg: '/lobby-estelar/hangar.png', floorBottomPct: 12, minX: 6, maxX: 94 },
};
const DEFAULT_SCENE = 'hangar';

const HEARTBEAT_MS = 8000;
const STALE_MS      = 22000;
const BUBBLE_MS     = 6000;
const WALK_TRANSITION_S = 1.1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const LobbyEstelar = ({ onBack, authUser }) => {
  const player = authUser?.name || getAuthUser()?.name || 'Anônimo';
  const scene  = DEFAULT_SCENE;
  const sceneCfg = SCENES[scene];

  const [skinId, setSkinId] = useState(getActiveAssistantSkinId());
  const [players, setPlayers] = useState([]);
  const [myX, setMyX] = useState(50);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [, setTick] = useState(0);

  const sceneRef = useRef(null);
  const myXRef = useRef(myX);
  const skinIdRef = useRef(skinId);
  useEffect(() => { myXRef.current = myX; }, [myX]);
  useEffect(() => { skinIdRef.current = skinId; }, [skinId]);

  useEffect(() => onAssistantSkinChange(setSkinId), []);

  const upsertMe = useCallback(async (patch = {}) => {
    try {
      await supabase.from('lobby_presence').upsert({
        player, scene, skin_id: skinIdRef.current, x: myXRef.current,
        updated_at: new Date().toISOString(), ...patch,
      }, { onConflict: 'player' });
    } catch { /* rede instável — próximo heartbeat tenta de novo */ }
  }, [player, scene]);

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('lobby_presence').select('*').eq('scene', scene);
    if (data) setPlayers(data);
  }, [scene]);

  // Entra no lobby + heartbeat + poll de reforço + realtime + expira balões (tick)
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
  }, [scene]);

  // Mudou a skin do assistente enquanto estava no lobby → avisa os outros
  useEffect(() => { upsertMe({ skin_id: skinId }); }, [skinId, upsertMe]);

  const walkTo = (clientX) => {
    const el = sceneRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = clamp(((clientX - r.left) / r.width) * 100, sceneCfg.minX, sceneCfg.maxX);
    setMyX(pct);
    upsertMe({ x: pct });
  };

  const sendMessage = () => {
    const text = chatText.trim().slice(0, 140);
    if (!text) return;
    upsertMe({ message: text, message_at: new Date().toISOString() });
    setChatText(''); setChatOpen(false);
  };

  const isFresh = (row) => row && (Date.now() - new Date(row.updated_at).getTime()) < STALE_MS;
  const bubbleOf = (row) => row?.message_at && (Date.now() - new Date(row.message_at).getTime()) < BUBBLE_MS ? row.message : null;

  const myRow = players.find(p => p.player === player);
  const others = players.filter(p => p.player !== player && isFresh(p));

  const avatars = [
    { player, x: myX, skin_id: skinId, message: bubbleOf(myRow), isMe: true },
    ...others.map(p => ({ player: p.player, x: p.x, skin_id: p.skin_id, message: bubbleOf(p), isMe: false })),
  ];

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4ade80' }}>{others.length + 1} no lobby</span>
        </div>
      </div>

      {/* Cenário */}
      <div ref={sceneRef} onClick={e => walkTo(e.clientX)}
        style={{ position: 'relative', flex: 1, backgroundImage: `url(${sceneCfg.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', overflow: 'hidden' }}>
        <style>{`
          @keyframes lobbyIdleBob { 0%,100% { transform: translate(-50%,0) } 50% { transform: translate(-50%,-5px) } }
          @keyframes lobbyBubbleIn { from { opacity:0; transform: translate(-50%,4px) scale(.9) } to { opacity:1; transform: translate(-50%,0) scale(1) } }
        `}</style>

        {avatars.map(a => {
          const skin = getAssistantSkin(a.skin_id);
          const sprite = skin?.blink?.open || '/UNIKO_NEW.png';
          const iconSize = 76;
          return (
            <div key={a.player}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: `${a.x}%`, bottom: `${sceneCfg.floorBottomPct}%`,
                transform: 'translate(-50%,0)', transition: `left ${WALK_TRANSITION_S}s ease`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, cursor: 'default',
              }}>
              {a.message && (
                <div style={{
                  marginBottom: 6, maxWidth: 180, padding: '7px 12px', borderRadius: 14, borderBottomLeftRadius: 4,
                  background: '#fff', color: '#1a1a2e', fontSize: 12.5, lineHeight: 1.4, boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                  animation: 'lobbyBubbleIn .18s ease', wordBreak: 'break-word', textAlign: 'center',
                }}>
                  {a.message}
                </div>
              )}
              <div style={{
                fontSize: 11.5, fontWeight: 700, color: a.isMe ? '#ffd76a' : '#fff', marginBottom: 3,
                textShadow: '0 1px 4px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', padding: '1px 8px',
                borderRadius: 8, background: 'rgba(0,0,0,0.35)',
              }}>
                {a.player}{a.isMe ? ' (você)' : ''}
              </div>
              <div style={{ width: iconSize, height: iconSize, animation: 'lobbyIdleBob 2.6s ease-in-out infinite', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.5))' }}>
                <img src={sprite} alt={a.player} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            </div>
          );
        })}

        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textShadow: '0 1px 4px rgba(0,0,0,0.7)', pointerEvents: 'none' }}>
          Clique no chão pra andar
        </div>
      </div>

      {/* Chat */}
      <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
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
