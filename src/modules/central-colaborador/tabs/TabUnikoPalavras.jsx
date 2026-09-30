// src/modules/central-colaborador/tabs/TabUnikoPalavras.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO PALAVRAS — Blefe de palavras (o clássico "Ghost"), online, com salas e chat.
//
// COMO SE JOGA: cada um tem 2 VIDAS. Na sua vez você acrescenta UMA letra ao
// fragmento que está na mesa (C → CA → CAS...), pensando numa palavra que
// comece assim. Duas formas de perder uma vida:
//   • COMPLETAR uma palavra (4+ letras) — "CASA" fecha, quem pôs o A perdeu;
//   • ser pego BLEFANDO: na sua vez você pode DUVIDAR de quem jogou antes. Ele
//     tem que dizer a palavra que tinha em mente. Se ela existir e começar
//     com o fragmento, quem duvidou perde a vida; senão, perde quem blefou.
// Demorar demais também custa uma vida. Sobrou um → ganhou.
//
// DICIONÁRIO: pt.wiktionary.org (API pública, CORS liberado) — vale a página que
// tiver seção {{-pt-}}. Se a consulta falhar (rede), a dúvida cai a favor de quem
// respondeu, e completar-palavra simplesmente não é detectado (nunca pune sem ter
// certeza).
//
// SINCRONIA: mesma arquitetura já testada do Uniko Stop —
//   • ESTADO na tabela uniko_palavras_state (postgres_changes + poll), carimbado
//     com `ts` pra descartar resposta atrasada;
//   • PRESENCE única (quem está em qual sala), canal recriado ao trocar de sala;
//   • jogadas/dúvida/resposta/chat vão por BROADCAST até o HOST, que é o único
//     que escreve o estado. Host = quem criou a sala; se sair, o mais antigo.
// Ver supabase_uniko_palavras.sql.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';

const MASCOTE = '/uniko-palavras.png';
const VIDAS = 2;
const MIN_LEN = 4;              // palavra COMPLETA com 4+ letras faz perder vida
const TURN_MS = 30_000;         // tempo pra jogar uma letra
const DUVIDA_MS = 25_000;       // tempo de quem foi duvidado pra dizer a palavra
const PAUSA_MS = 6_000;         // banner do que aconteceu antes da próxima rodada
const ROOM_TTL_MS = 20 * 60_000;
const MIN_PLAYERS = 2;

const P = { azul: '#2F7BFF', ciano: '#22D3EE', roxo: '#7C3AED', verde: '#10B981', vermelho: '#EF4444', amarelo: '#F59E0B' };
/* Cor de cada jogador (pela ordem da partida) — dá pra ver quem pôs cada letra. */
const CORES = ['#2F7BFF', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#F97316', '#14B8A6', '#EF4444'];

const CSS = `
@keyframes upFloat { 0%,100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-2.2%); } }
@keyframes upPop { 0% { transform: translate(-50%,-50%) scale(.2) rotate(-20deg); opacity: 0; } 65% { transform: translate(-50%,-50%) scale(1.18); } 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
@keyframes upPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,.65); } 50% { box-shadow: 0 0 0 9px rgba(34,211,238,0); } }
@keyframes upShake { 0%,100% { transform: translate(-50%,-50%) rotate(0); } 20% { transform: translate(-50%,-50%) rotate(-6deg); } 40% { transform: translate(-50%,-50%) rotate(6deg); } 60% { transform: translate(-50%,-50%) rotate(-4deg); } 80% { transform: translate(-50%,-50%) rotate(4deg); } }
@keyframes upFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes upSpin { to { transform: rotate(360deg); } }
.up-mascote { animation: upFloat 3.2s ease-in-out infinite; }
.up-mascote.up-treme { animation: upShake .6s ease-in-out infinite; }
.up-letra { animation: upPop .35s cubic-bezier(.2,1.4,.4,1) both; }
.up-vez { animation: upPulse 1.3s ease-out infinite; }
.up-fade { animation: upFade .3s ease both; }
.up-btn { transition: transform .12s ease, filter .12s ease; }
.up-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.07); }
.up-btn:not(:disabled):active { transform: scale(.97); }
.up-scroll { scrollbar-width: thin; }
.up-wrap { display: flex; gap: 12px; flex: 1; min-height: 0; }
.up-main { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.up-side { width: 290px; flex-shrink: 0; min-height: 0; }
@media (max-width: 860px) {
  .up-wrap { flex-direction: column; overflow-y: auto; }
  .up-main { overflow: visible; flex: none; }
  .up-side { width: 100%; height: 300px; flex-shrink: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .up-mascote, .up-letra, .up-vez, .up-fade { animation: none !important; }
}
`;

/* ── util ─────────────────────────────────────────────────────────────────── */
const myName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
const PHOTO_SRC_KEY = 'up_photo_src';   // mesma foto escolhida no Uniko Paint
const myPhotoSrc = () => { try { return localStorage.getItem(PHOTO_SRC_KEY) || '/UNIKO_NEW.png'; } catch { return '/UNIKO_NEW.png'; } };
const semTabela = (e) => !!e && (e.code === 'PGRST205' || e.code === '42P01'
  || /Could not find the table|does not exist|schema cache/i.test(e.message || ''));
const primeiro = (n) => String(n || '').split(' ')[0];
/* Sem acento/caixa: o fragmento na mesa é só a-z ("açúcar" começa com "acu"). */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z]/g, '');
const normLetra = (s) => { const n = norm(s); return n.length === 1 ? n : ''; };
const fragmentoDe = (s) => (s?.letras || []).map(x => x.l).join('');

/* ── Som (WebAudio, sem arquivo no bundle) ── */
let _ac = null;
const beep = (freq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0) => {
  try {
    if (!_ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) _ac = new AC(); }
    const c = _ac; if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
  } catch { /* sem áudio: o jogo funciona igual */ }
};
const SFX = {
  letra:  () => beep(660 + Math.random() * 200, 0.09, 'triangle', 0.11),
  duvida: () => { beep(520, 0.12, 'square', 0.1); beep(390, 0.2, 'square', 0.1, 0.12); },
  perde:  () => [440, 330, 220].forEach((f, i) => beep(f, 0.18, 'sawtooth', 0.09, i * 0.1)),
  vitoria: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'triangle', 0.12, i * 0.1)),
  vez:    () => { beep(880, 0.08, 'sine', 0.1); beep(1175, 0.12, 'sine', 0.1, 0.08); },
};

/* ── Dicionário (pt.wiktionary.org) ──────────────────────────────────────────
   true = existe em português · false = não existe · null = não deu pra saber. */
const _dic = new Map();
const ehPalavra = async (w) => {
  const k = String(w || '').toLowerCase().trim();
  if (!k) return false;
  if (_dic.has(k)) return _dic.get(k);
  try {
    const url = 'https://pt.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main'
      + `&format=json&origin=*&titles=${encodeURIComponent(k)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
    const j = await r.json();
    const pg = Object.values(j?.query?.pages || {})[0];
    let v = false;
    if (pg && pg.missing === undefined) v = /\{\{-pt-\}\}/.test(pg.revisions?.[0]?.slots?.main?.['*'] || '');
    _dic.set(k, v);
    return v;
  } catch { return null; }
};

/* ── motor puro (só o HOST usa, mas não depende de React) ── */
const proxVivo = (s, de) => {
  const ord = s.ordem || [];
  const i = ord.indexOf(de);
  for (let k = 1; k <= ord.length; k++) {
    const n = ord[(i + k + ord.length) % ord.length];
    if ((s.vidas?.[n] || 0) > 0) return n;
  }
  return de;
};
const perderVida = (s, quem, texto, palavra) => {
  const vidas = { ...s.vidas, [quem]: Math.max(0, (s.vidas?.[quem] || 0) - 1) };
  const vivos = (s.ordem || []).filter(n => vidas[n] > 0);
  const evento = { quem, texto, palavra: palavra || null, ts: Date.now(), eliminado: vidas[quem] === 0 };
  if (vivos.length <= 1) return { ...s, vidas, evento, phase: 'fim', vencedor: vivos[0] || null, endsAt: null, duvida: null };
  const starter = vidas[quem] > 0 ? quem : proxVivo({ ...s, vidas }, quem);
  return { ...s, vidas, evento, phase: 'pausa', starter, endsAt: Date.now() + PAUSA_MS, duvida: null };
};

/* ═══════════════════════════════════════════════════════════════════════════
   ARENA — mascote no CENTRO, letras da palavra e jogadores ao redor
   ═══════════════════════════════════════════════════════════════════════════ */
const Coracoes = ({ n, total = VIDAS }) => (
  <span style={{ fontSize: 'clamp(11px, 3cqw, 17px)', letterSpacing: 1, lineHeight: 1 }}>
    {Array.from({ length: total }).map((_, i) => (
      <span key={i} style={{ color: i < n ? '#FF4D6D' : 'rgba(255,255,255,.22)', textShadow: i < n ? '0 0 8px rgba(255,77,109,.7)' : 'none' }}>♥</span>
    ))}
  </span>
);

const Arena = ({ seats, letras, ordem, vez, alvo, treme, centro }) => {
  const corDe = (n) => CORES[Math.max(0, ordem.indexOf(n)) % CORES.length];
  const passo = 360 / Math.max(letras.length, 10);
  return (
    <div style={{ position: 'relative', width: 'min(100%, 640px, 66vh)', aspectRatio: '1 / 1', margin: '0 auto', containerType: 'inline-size',
      borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 50% 50%, #12225a 0%, #0a1238 46%, #050818 100%)',
      boxShadow: '0 12px 44px rgba(47,123,255,.28), inset 0 0 0 2px rgba(34,211,238,.25)' }}>
      {/* anéis neon decorativos */}
      <div style={{ position: 'absolute', inset: '17%', borderRadius: '50%', border: '1.5px dashed rgba(34,211,238,.28)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '9%', borderRadius: '50%', border: '1px solid rgba(47,123,255,.22)', pointerEvents: 'none' }} />

      {/* MASCOTE no centro */}
      <img src={MASCOTE} alt="" draggable={false} className={`up-mascote${treme ? ' up-treme' : ''}`}
        style={{ position: 'absolute', left: '50%', top: '50%', width: '27%', height: '27%', objectFit: 'contain',
          transform: 'translate(-50%,-50%)', filter: 'drop-shadow(0 0 14px rgba(34,211,238,.55))', pointerEvents: 'none', userSelect: 'none' }} />

      {/* LETRAS formando a palavra ao redor do mascote */}
      {letras.map((x, i) => {
        const a = (-90 + i * passo) * Math.PI / 180;
        return (
          <div key={`${i}_${x.l}`} className="up-letra" title={primeiro(x.by)}
            style={{ position: 'absolute', left: `${50 + 24.5 * Math.cos(a)}%`, top: `${50 + 24.5 * Math.sin(a)}%`,
              width: '8.4%', aspectRatio: '1', transform: 'translate(-50%,-50%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: corDe(x.by), color: '#fff', fontFamily: 'var(--font-brand)', fontWeight: 900, fontSize: '5.4cqw',
              border: '2px solid rgba(255,255,255,.85)', boxShadow: `0 0 12px ${corDe(x.by)}aa` }}>
            {x.l.toUpperCase()}
          </div>
        );
      })}

      {centro}

      {/* JOGADORES ao redor */}
      {seats.map((p, i) => {
        const a = (-90 + i * (360 / seats.length)) * Math.PI / 180;
        const minhaVez = vez === p.name, ehAlvo = alvo === p.name;
        return (
          <div key={p.name} style={{ position: 'absolute', left: `${50 + 40 * Math.cos(a)}%`, top: `${50 + 40 * Math.sin(a)}%`,
            transform: 'translate(-50%,-50%)', width: '19%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            opacity: p.out ? 0.38 : 1, filter: p.out ? 'grayscale(1)' : 'none' }}>
            <img src={p.photo || '/UNIKO_NEW.png'} alt="" className={minhaVez ? 'up-vez' : ''}
              style={{ width: '46%', aspectRatio: '1', borderRadius: '50%', objectFit: 'cover', background: '#1b2a63',
                border: `2.5px solid ${ehAlvo ? P.vermelho : minhaVez ? P.ciano : corDe(p.name)}`,
                boxShadow: minhaVez ? `0 0 14px ${P.ciano}` : ehAlvo ? `0 0 14px ${P.vermelho}` : 'none' }} />
            <div style={{ fontSize: 'clamp(9px, 2.6cqw, 13px)', fontWeight: 800, color: '#fff', maxWidth: '100%', textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,.8)' }}>
              {primeiro(p.name)}{p.ausente ? ' 💤' : ''}
            </div>
            {p.vidas != null && (p.out ? <span style={{ fontSize: 'clamp(10px, 2.6cqw, 13px)' }}>💀</span> : <Coracoes n={p.vidas} />)}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT da sala — por broadcast (efêmero, igual ao do Uniko Stop)
   ═══════════════════════════════════════════════════════════════════════════ */
const ChatSala = ({ mensagens, texto, setTexto, onEnviar, name, cardBg }) => {
  const listaRef = useRef(null);
  useEffect(() => { const el = listaRef.current; if (el) el.scrollTop = el.scrollHeight; }, [mensagens]);
  return (
    <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sh,
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, letterSpacing: '.08em', padding: '11px 11px 8px', flexShrink: 0 }}>💬 CHAT</div>
      <div ref={listaRef} className="up-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 11px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {mensagens.length === 0 && (
          <div style={{ fontSize: 12, color: T.textD, textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
            Ninguém falou nada ainda.<br />Manda um oi! 👋
          </div>
        )}
        {mensagens.map(m => (
          <div key={m.id} className="up-fade" style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <img src={m.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: m.name === name ? P.azul : T.textT }}>{primeiro(m.name)}</div>
              <div style={{ fontSize: 12.5, color: T.text, wordBreak: 'break-word', lineHeight: 1.4 }}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: 11, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <input value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnviar(); } }}
          maxLength={200} placeholder="Escreva algo..."
          style={{ flex: 1, minWidth: 0, padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`,
            background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 12.5, outline: 'none', fontFamily: 'var(--font-body)' }} />
        <button className="up-btn" onClick={onEnviar} disabled={!texto.trim()} title="Enviar"
          style={{ padding: '8px 13px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 12.5,
            cursor: texto.trim() ? 'pointer' : 'not-allowed', background: texto.trim() ? `linear-gradient(135deg, ${P.azul}, ${P.ciano})` : T.textD }}>➤</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SALA
   ═══════════════════════════════════════════════════════════════════════════ */
const Sala = ({ roomId, name, photo, players, onLeave }) => {
  const [state, setState] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [letra, setLetra] = useState('');
  const [palavra, setPalavra] = useState('');
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatTexto, setChatTexto] = useState('');
  const [confirmSair, setConfirmSair] = useState(false);
  const cardBg = T.surface || '#fff';

  const stateRef = useRef(null);
  const hostRef = useRef(false);
  const chanRef = useRef(null);
  const lockRef = useRef(false);
  const ultFase = useRef(null);
  const ultVez = useRef(null);

  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost = host === name;
  useEffect(() => { hostRef.current = isHost; }, [isHost]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  /* ── Estado (descarta o que chega atrasado, igual ao Stop) ── */
  const aplicaEstado = useCallback((st) => {
    if (!st) return;
    const atual = stateRef.current;
    if (atual?.ts && st.ts && st.ts < atual.ts) return;
    stateRef.current = st;
    setState(st);
  }, []);
  const pushState = useCallback(async (next) => {
    const carimbado = { ...next, ts: Date.now() };
    aplicaEstado(carimbado);
    try {
      await supabase.from('uniko_palavras_state')
        .update({ state: carimbado, updated_at: new Date().toISOString() }).eq('id', roomId);
    } catch (e) { console.error('[uniko-palavras] pushState:', e); }
  }, [roomId, aplicaEstado]);

  useEffect(() => {
    let vivo = true;
    const load = async () => {
      const { data } = await supabase.from('uniko_palavras_state').select('state').eq('id', roomId).maybeSingle();
      if (vivo) aplicaEstado(data?.state);
    };
    load();
    const ch = supabase.channel(`uniko-palavras-state-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_palavras_state', filter: `id=eq.${roomId}` },
        ({ new: row }) => aplicaEstado(row?.state))
      .subscribe();
    const poll = setInterval(load, 4000);
    return () => { vivo = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId, aplicaEstado]);

  /* ── Motor: só o HOST processa jogada/dúvida/resposta ── */
  const processar = async (ev, p) => {
    const s = stateRef.current;
    if (!s || lockRef.current) return;

    if (ev === 'jogada') {
      if (s.phase !== 'jogando' || s.vez !== p.name || p.pos !== (s.letras || []).length) return;   // pos = idempotência do reenvio
      const l = normLetra(p.letra); if (!l) return;
      const letras = [...(s.letras || []), { l, by: p.name }];
      const frag = letras.map(x => x.l).join('');
      if (frag.length >= MIN_LEN) {
        lockRef.current = true;
        let ok; try { ok = await ehPalavra(frag); } finally { lockRef.current = false; }
        if (stateRef.current?.ts !== s.ts) return;
        if (ok === true) {
          pushState(perderVida({ ...s, letras }, p.name, `${primeiro(p.name)} completou a palavra "${frag.toUpperCase()}"`, frag));
          return;
        }
      }
      pushState({ ...s, letras, vez: proxVivo(s, p.name), endsAt: Date.now() + TURN_MS });
    }

    if (ev === 'duvidar') {
      if (s.phase !== 'jogando' || s.vez !== p.name || !(s.letras || []).length) return;
      const alvo = s.letras[s.letras.length - 1].by;
      if (alvo === p.name) return;
      pushState({ ...s, phase: 'duvida', duvida: { por: p.name, alvo }, endsAt: Date.now() + DUVIDA_MS });
    }

    if (ev === 'resposta') {
      if (s.phase !== 'duvida' || s.duvida?.alvo !== p.name) return;
      const raw = String(p.palavra || '').trim().toLowerCase().replace(/[^a-zà-ú]/g, '');
      const frag = fragmentoDe(s), n = norm(raw);
      const { por, alvo } = s.duvida;
      let valida = false;
      if (n.startsWith(frag) && n.length > frag.length) {
        lockRef.current = true;
        let ok; try { ok = await ehPalavra(raw); } finally { lockRef.current = false; }
        if (stateRef.current?.ts !== s.ts) return;
        valida = ok !== false;                       // sem rede → benefício da dúvida pra quem respondeu
      }
      if (valida) pushState(perderVida(s, por, `${primeiro(por)} duvidou, mas ${primeiro(alvo)} tinha "${raw.toUpperCase()}" em mente!`, raw));
      else pushState(perderVida(s, alvo, `${primeiro(alvo)} foi pego blefando${raw ? ` — "${raw.toUpperCase()}" não vale` : ''}!`, raw));
    }
  };

  /* Ações do jogador: o host aplica direto; os outros mandam ao host por broadcast
     (que é best-effort — reenvia até o estado andar, e o host descarta duplicata). */
  const enviar = (ev, payload, andou) => {
    if (hostRef.current) { processar(ev, payload); return; }
    let tent = 0;
    const tenta = () => {
      chanRef.current?.send({ type: 'broadcast', event: ev, payload });
      if (++tent < 4) setTimeout(() => { if (!andou(stateRef.current)) tenta(); }, 1500);
    };
    tenta();
  };
  const jogarLetra = () => {
    const s = stateRef.current; const l = normLetra(letra);
    if (!s || s.phase !== 'jogando' || s.vez !== name || !l) return;
    const pos = (s.letras || []).length;
    SFX.letra(); setLetra('');
    enviar('jogada', { name, letra: l, pos }, (x) => (x?.letras || []).length !== pos || x?.phase !== 'jogando');
  };
  const duvidar = () => {
    const s = stateRef.current;
    if (!s || s.phase !== 'jogando' || s.vez !== name || !(s.letras || []).length) return;
    SFX.duvida();
    enviar('duvidar', { name }, (x) => x?.phase !== 'jogando');
  };
  const responder = () => {
    const s = stateRef.current; const w = palavra.trim();
    if (!s || s.phase !== 'duvida' || s.duvida?.alvo !== name || !w) return;
    setPalavra('');
    enviar('resposta', { name, palavra: w }, (x) => x?.phase !== 'duvida');
  };

  /* Relógio do host: estourou o tempo → perde vida / próxima rodada. */
  useEffect(() => {
    if (!isHost) return;
    const t = setInterval(() => {
      const s = stateRef.current;
      if (!s || !s.endsAt || Date.now() < s.endsAt || lockRef.current) return;
      if (s.phase === 'jogando') {
        pushState(perderVida(s, s.vez, `${primeiro(s.vez)} demorou demais e perdeu a vez`));
      } else if (s.phase === 'duvida') {
        pushState(perderVida(s, s.duvida.alvo, `${primeiro(s.duvida.alvo)} não respondeu à dúvida de ${primeiro(s.duvida.por)}`));
      } else if (s.phase === 'pausa') {
        pushState({ ...s, phase: 'jogando', letras: [], vez: s.starter, evento: null, round: (s.round || 1) + 1, endsAt: Date.now() + TURN_MS });
      }
    }, 400);
    return () => clearInterval(t);
  }, [isHost, pushState]);

  const comecar = () => {
    const s = stateRef.current; if (!s) return;
    const ordem = players.map(p => p.name).sort(() => Math.random() - 0.5);
    if (ordem.length < MIN_PLAYERS) return;
    const vidas = {}; ordem.forEach(n => { vidas[n] = VIDAS; });
    pushState({ ...s, phase: 'jogando', ordem, vidas, letras: [], vez: ordem[0], round: 1, evento: null,
      duvida: null, vencedor: null, endsAt: Date.now() + TURN_MS });
  };
  const voltarLobby = () => {
    const s = stateRef.current; if (!s) return;
    pushState({ nome: s.nome, criador: s.criador, phase: 'lobby' });
  };

  /* ── Canal da sala (jogadas até o host + chat) ── */
  useEffect(() => {
    const ch = supabase.channel(`uniko-palavras-room-${roomId}`);
    chanRef.current = ch;
    ['jogada', 'duvidar', 'resposta'].forEach(ev => {
      ch.on('broadcast', { event: ev }, ({ payload }) => { if (hostRef.current && payload?.name) processar(ev, payload); });
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (!payload?.id || !payload?.text || payload.name === name) return;
      setChatMsgs(l => [...l.slice(-79), payload]);
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, name]);

  const enviarChat = () => {
    const t = chatTexto.trim(); if (!t) return;
    const msg = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, photo, text: t.slice(0, 200) };
    setChatMsgs(l => [...l.slice(-79), msg]);        // o broadcast não volta pra mim
    chanRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChatTexto('');
  };

  /* ── Sons por transição ── */
  const fase = state?.phase;
  useEffect(() => {
    if (fase === ultFase.current) return;
    if (fase === 'pausa') SFX.perde();
    if (fase === 'fim') SFX.vitoria();
    if (fase === 'duvida') SFX.duvida();
    ultFase.current = fase;
  }, [fase]);
  useEffect(() => {
    if (fase === 'jogando' && state?.vez === name && ultVez.current !== `${state.round}_${(state.letras || []).length}`) SFX.vez();
    ultVez.current = fase === 'jogando' ? `${state?.round}_${(state?.letras || []).length}` : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, state?.vez, state?.letras?.length, state?.round]);

  /* ── derivados ── */
  const noLobby = !state || state.phase === 'lobby';
  const ordem = state?.ordem || [];
  const letras = state?.letras || [];
  const frag = fragmentoDe(state);
  const secs = state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;
  const minhaVez = fase === 'jogando' && state?.vez === name;
  const souAlvo = fase === 'duvida' && state?.duvida?.alvo === name;
  const fotoDe = (n) => players.find(p => p.name === n)?.photo || null;
  const seats = noLobby
    ? players.map(p => ({ name: p.name, photo: p.photo }))
    : ordem.map(n => ({ name: n, photo: fotoDe(n), vidas: state?.vidas?.[n] ?? 0, out: (state?.vidas?.[n] ?? 0) <= 0,
      ausente: !players.some(p => p.name === n) }));

  const btnBase = { border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', color: '#fff', padding: '11px 20px' };
  const inputCss = { padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${P.azul}66`, background: T.surfaceInput || 'rgba(0,0,0,.03)',
    color: T.text, fontSize: 16, fontWeight: 700, outline: 'none', fontFamily: 'var(--font-body)' };

  /* Painel de baixo (o que fazer agora) */
  const painel = () => {
    if (noLobby) return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: T.textT, lineHeight: 1.6, marginBottom: 12 }}>
          Cada um tem <b style={{ color: T.text }}>{VIDAS} vidas</b>. Acrescente uma letra por vez formando uma palavra —
          quem <b style={{ color: T.text }}>completar</b> uma palavra ({MIN_LEN}+ letras) perde uma vida, e quem for pego{' '}
          <b style={{ color: T.text }}>blefando</b> também. Na sua vez, você pode <b style={{ color: T.text }}>duvidar</b> de quem jogou antes!
        </div>
        {isHost ? (
          <button className="up-btn" onClick={comecar} disabled={players.length < MIN_PLAYERS}
            style={{ ...btnBase, background: players.length < MIN_PLAYERS ? T.textD : `linear-gradient(135deg, ${P.azul}, ${P.ciano})`,
              cursor: players.length < MIN_PLAYERS ? 'not-allowed' : 'pointer', fontSize: 15, padding: '13px 28px' }}>
            {players.length < MIN_PLAYERS ? `Esperando jogadores (${players.length}/${MIN_PLAYERS})` : `Começar partida (${players.length} jogadores)`}
          </button>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textT }}>Aguardando {primeiro(host)} começar a partida...</div>
        )}
      </div>
    );

    if (fase === 'fim') return (
      <div style={{ textAlign: 'center' }} className="up-fade">
        <div style={{ fontSize: 34 }}>🏆</div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 21, fontWeight: 800, color: T.text }}>
          {state.vencedor ? `${primeiro(state.vencedor)} venceu!` : 'Fim de jogo'}
        </div>
        {state.evento?.texto && <div style={{ fontSize: 13, color: T.textT, margin: '6px 0 12px' }}>{state.evento.texto}</div>}
        {isHost
          ? <button className="up-btn" onClick={voltarLobby} style={{ ...btnBase, background: `linear-gradient(135deg, ${P.azul}, ${P.ciano})` }}>Jogar de novo</button>
          : <div style={{ fontSize: 12.5, color: T.textT }}>Aguardando {primeiro(host)} reiniciar...</div>}
      </div>
    );

    if (fase === 'pausa') return (
      <div className="up-fade" style={{ textAlign: 'center', padding: '4px 0' }}>
        <div style={{ fontSize: 28 }}>{state.evento?.eliminado ? '💀' : '💔'}</div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text }}>{state.evento?.texto}</div>
        <div style={{ fontSize: 12.5, color: P.vermelho, fontWeight: 800, marginTop: 4 }}>
          {primeiro(state.evento?.quem)} perdeu uma vida{state.evento?.eliminado ? ' e está fora!' : '!'}
        </div>
        <div style={{ fontSize: 12, color: T.textT, marginTop: 6 }}>Próxima rodada em {secs}s — começa {primeiro(state.starter)}</div>
      </div>
    );

    if (fase === 'duvida') {
      const { por, alvo } = state.duvida || {};
      return (
        <div className="up-fade" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text }}>
            🤨 {primeiro(por)} duvidou de {primeiro(alvo)}!
          </div>
          <div style={{ fontSize: 12.5, color: T.textT, margin: '5px 0 10px' }}>
            {souAlvo ? <>Diga a palavra que você tinha em mente — ela tem que começar com <b style={{ color: T.text, letterSpacing: 2 }}>{frag.toUpperCase()}</b> ({secs}s)</>
              : <>{primeiro(alvo)} precisa dizer uma palavra que comece com <b style={{ color: T.text, letterSpacing: 2 }}>{frag.toUpperCase()}</b> ({secs}s)</>}
          </div>
          {souAlvo && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <input autoFocus value={palavra} onChange={e => setPalavra(e.target.value)} maxLength={30}
                onKeyDown={e => e.key === 'Enter' && responder()} placeholder={`${frag.toUpperCase()}...`}
                style={{ ...inputCss, width: 'min(60%, 240px)' }} />
              <button className="up-btn" onClick={responder} disabled={!palavra.trim()}
                style={{ ...btnBase, background: palavra.trim() ? `linear-gradient(135deg, ${P.verde}, ${P.ciano})` : T.textD }}>Enviar</button>
            </div>
          )}
        </div>
      );
    }

    // jogando
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, letterSpacing: '.08em' }}>PALAVRA NA MESA</div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 26, fontWeight: 900, letterSpacing: 6, color: T.text, minHeight: 34 }}>
          {frag ? frag.toUpperCase() : '—'}
        </div>
        {minhaVez ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: P.azul, margin: '2px 0 9px' }}>Sua vez! ({secs}s)</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <input autoFocus value={letra} onChange={e => setLetra(e.target.value.slice(-1))} maxLength={1}
                onKeyDown={e => e.key === 'Enter' && jogarLetra()} placeholder="A"
                style={{ ...inputCss, width: 64, textAlign: 'center', fontSize: 22, textTransform: 'uppercase' }} />
              <button className="up-btn" onClick={jogarLetra} disabled={!normLetra(letra)}
                style={{ ...btnBase, background: normLetra(letra) ? `linear-gradient(135deg, ${P.azul}, ${P.ciano})` : T.textD, cursor: normLetra(letra) ? 'pointer' : 'not-allowed' }}>
                Jogar letra
              </button>
              <button className="up-btn" onClick={duvidar} disabled={!letras.length}
                title={letras.length ? `Duvidar de ${primeiro(letras[letras.length - 1]?.by)}` : 'Ainda não há letra pra duvidar'}
                style={{ ...btnBase, background: letras.length ? `linear-gradient(135deg, ${P.vermelho}, ${P.amarelo})` : T.textD, cursor: letras.length ? 'pointer' : 'not-allowed' }}>
                🤨 Duvidar
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textT, marginTop: 4 }}>
            Vez de <b style={{ color: T.text }}>{primeiro(state.vez)}</b> ({secs}s)
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <style>{CSS}</style>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderRadius: 14, padding: '10px 14px',
        background: `linear-gradient(120deg, ${P.azul}, ${P.roxo})`, boxShadow: '0 6px 20px rgba(47,123,255,.25)' }}>
        <img src={MASCOTE} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state?.nome || 'Uniko Palavras'}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.85)' }}>
            {players.length} na sala{!noLobby && state?.round ? ` · rodada ${state.round}` : ''}
          </div>
        </div>
        {confirmSair ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Sair da sala?</span>
            <button className="up-btn" onClick={onLeave} style={{ ...btnBase, padding: '6px 12px', fontSize: 12, background: P.vermelho }}>Sair</button>
            <button className="up-btn" onClick={() => setConfirmSair(false)} style={{ ...btnBase, padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,.22)' }}>Ficar</button>
          </div>
        ) : (
          <button className="up-btn" onClick={() => (noLobby || fase === 'fim' ? onLeave() : setConfirmSair(true))}
            style={{ ...btnBase, padding: '7px 14px', fontSize: 12.5, background: 'rgba(255,255,255,.2)' }}>← Sair</button>
        )}
      </div>

      <div className="up-wrap">
        <div className="up-main up-scroll">
          <Arena seats={seats} letras={letras} ordem={ordem} vez={fase === 'jogando' ? state?.vez : null}
            alvo={fase === 'duvida' ? state?.duvida?.alvo : null} treme={fase === 'duvida' || fase === 'pausa'} />
          <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, boxShadow: T.sh, flexShrink: 0 }}>
            {!state ? <div style={{ textAlign: 'center', fontSize: 13, color: T.textT }}>Carregando sala...</div> : painel()}
          </div>
        </div>
        <div className="up-side">
          <ChatSala mensagens={chatMsgs} texto={chatTexto} setTexto={setChatTexto} onEnviar={enviarChat} name={name} cardBg={cardBg} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY (lista de salas)
   ═══════════════════════════════════════════════════════════════════════════ */
const Lobby = ({ name, porSala, onEnter }) => {
  const [rooms, setRooms] = useState(null);
  const [erroSala, setErroSala] = useState('');
  const [criando, setCriando] = useState(false);
  const [nomeSala, setNomeSala] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const cardBg = T.surface || '#fff';
  const isAdmin = getAuthUser()?.role === 'admin';

  const load = useCallback(async () => {
    let data, error;
    try {
      ({ data, error } = await supabase.from('uniko_palavras_state').select('id, state, updated_at').order('updated_at', { ascending: false }));
    } catch (e) { error = e; }
    if (error) {
      console.error('[uniko-palavras] lobby:', error.message || error);
      setErroSala(semTabela(error) ? 'Falta rodar supabase_uniko_palavras.sql no Supabase.' : 'Não deu pra carregar as salas. Tentando de novo...');
      return;
    }
    setErroSala('');
    setRooms(data || []);
    const velhas = (data || []).filter(r => !(porSala[r.id]?.length) && Date.now() - new Date(r.updated_at).getTime() > ROOM_TTL_MS);
    if (velhas.length) {
      await supabase.from('uniko_palavras_state').delete().in('id', velhas.map(r => r.id));
      setRooms(rs => (rs || []).filter(r => !velhas.some(v => v.id === r.id)));
    }
  }, [porSala]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase.channel('uniko-palavras-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_palavras_state' }, load).subscribe();
    const poll = setInterval(load, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [load]);

  const criarSala = async () => {
    const nome = nomeSala.trim() || `Sala do ${primeiro(name)}`;
    const id = Math.random().toString(36).slice(2, 8);
    const { error } = await supabase.from('uniko_palavras_state').insert({ id, state: { phase: 'lobby', nome, criador: name } });
    if (error) { setErroSala('Não deu pra criar a sala.'); console.error('[uniko-palavras] criar:', error); return; }
    onEnter(id);
  };
  const excluir = async (id) => {
    setConfirmDel(null);
    await supabase.from('uniko_palavras_state').delete().eq('id', id);
    setRooms(rs => (rs || []).filter(r => r.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflowY: 'auto' }} className="up-scroll">
      <style>{CSS}</style>
      <div style={{ borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0,
        background: `linear-gradient(120deg, ${P.azul} 0%, ${P.roxo} 70%, ${P.ciano} 130%)`, boxShadow: '0 8px 26px rgba(47,123,255,.28)' }}>
        <img src={MASCOTE} alt="" style={{ width: 70, height: 70, objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.35))' }} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: '#fff' }}>Uniko Palavras</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.88)' }}>Forme a palavra letra por letra — não seja quem completa, e cuidado com os blefes!</div>
        </div>
        <button className="up-btn" onClick={() => setCriando(v => !v)}
          style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: '#fff', color: P.azul, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,.18)' }}>
          + Criar sala
        </button>
      </div>

      {criando && (
        <div className="up-fade" style={{ background: cardBg, border: `1px solid ${P.azul}55`, borderRadius: 14, padding: 16, boxShadow: T.sh, display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <input value={nomeSala} onChange={e => setNomeSala(e.target.value)} maxLength={28} onKeyDown={e => e.key === 'Enter' && criarSala()}
            placeholder={`Sala do ${primeiro(name)}`}
            style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }} />
          <button className="up-btn" onClick={criarSala}
            style={{ padding: '9px 18px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: `linear-gradient(135deg, ${P.azul}, ${P.ciano})` }}>Criar e entrar</button>
        </div>
      )}

      {erroSala && <div style={{ fontSize: 12.5, color: P.vermelho, fontWeight: 700 }}>{erroSala}</div>}
      {rooms === null && !erroSala && <div style={{ fontSize: 13, color: T.textT }}>Carregando salas...</div>}
      {rooms?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: T.textT, fontSize: 13.5 }}>
          <img src={MASCOTE} alt="" style={{ width: 120, opacity: .9 }} /><br />
          Nenhuma sala aberta. Crie a primeira e chame a turma!
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {(rooms || []).map(r => {
          const gente = porSala[r.id] || [];
          const emJogo = r.state?.phase === 'jogando' || r.state?.phase === 'duvida' || r.state?.phase === 'pausa';
          return (
            <div key={r.id} style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, boxShadow: T.sh, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: T.text }}>{r.state?.nome || 'Sala'}</div>
              <div style={{ fontSize: 12, color: T.textT }}>
                {gente.length} jogando agora · {emJogo ? '🎮 em partida' : '🕓 no lobby'}
              </div>
              <div style={{ display: 'flex', gap: 4, minHeight: 26 }}>
                {gente.slice(0, 6).map(p => <img key={p.name} src={p.photo || '/UNIKO_NEW.png'} alt="" title={p.name} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />)}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="up-btn" onClick={() => onEnter(r.id)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: `linear-gradient(135deg, ${P.azul}, ${P.ciano})` }}>Entrar</button>
                {(isAdmin || r.state?.criador === name) && (confirmDel === r.id
                  ? <button className="up-btn" onClick={() => excluir(r.id)} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: P.vermelho, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Confirmar</button>
                  : <button className="up-btn" onClick={() => setConfirmDel(r.id)} title="Excluir sala" style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textT, fontSize: 12, cursor: 'pointer' }}>🗑</button>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ — presence global (quem está em qual sala) + lobby/sala
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoPalavras = () => {
  const name = useMemo(() => myName(), []);
  const [photo] = useState(() => myPhotoSrc());
  const [room, setRoom] = useState(null);
  const [todos, setTodos] = useState([]);
  const [sqlMissing, setSqlMissing] = useState(false);
  const lobbyChan = useRef(null);
  const [entrouEm, setEntrouEm] = useState(() => Date.now());
  const jaMontou = useRef(false);
  useEffect(() => {
    if (!jaMontou.current) { jaMontou.current = true; return; }
    setEntrouEm(Date.now());
  }, [room]);

  useEffect(() => {
    supabase.from('uniko_palavras_state').select('id').limit(1).then(({ error }) => { if (semTabela(error)) setSqlMissing(true); });
  }, []);

  const refreshPresence = useCallback(() => {
    const ch = lobbyChan.current; if (!ch) return;
    const list = Object.values(ch.presenceState()).map(arr => arr[arr.length - 1]).filter(Boolean)
      .map(p => ({ name: p.name, photo: p.photo, room: p.room, entrouEm: p.entrouEm }));
    const seen = new Set();
    setTodos(list.filter(p => p?.name && (seen.has(p.name) ? false : (seen.add(p.name), true))));
  }, []);

  /* Canal RECRIADO ao mudar de sala: `track()` repetido não propaga (visto no Paint). */
  useEffect(() => {
    const ch = supabase.channel('uniko-palavras-presence', { config: { presence: { key: name } } });
    lobbyChan.current = ch;
    ch.on('presence', { event: 'sync' }, refreshPresence)
      .on('presence', { event: 'join' }, refreshPresence)
      .on('presence', { event: 'leave' }, refreshPresence);
    ch.subscribe(async (st) => {
      if (st !== 'SUBSCRIBED') return;
      const r = await ch.track({ name, photo, room, entrouEm });
      if (r !== 'ok') console.error('[uniko-palavras] presence track falhou:', r);
      refreshPresence();
    });
    const t = setInterval(refreshPresence, 2000);
    return () => { clearInterval(t); supabase.removeChannel(ch); lobbyChan.current = null; };
  }, [name, photo, room, entrouEm, refreshPresence]);

  const porSala = useMemo(() => {
    const m = {};
    todos.forEach(p => { if (p.room) (m[p.room] = m[p.room] || []).push(p); });
    return m;
  }, [todos]);
  const naSala = useMemo(() => {
    const l = porSala[room] || [];
    return l.some(p => p.name === name) ? l : [{ name, photo, room, entrouEm }, ...l];
  }, [porSala, room, name, photo, entrouEm]);

  if (sqlMissing) return (
    <div style={{ maxWidth: 620, margin: '40px auto', background: T.surface || '#fff', border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <img src={MASCOTE} alt="" style={{ width: 110 }} />
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, margin: '8px 0' }}>Falta rodar a migração</div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Uniko Palavras precisa da tabela dele. Rode <b style={{ color: T.text }}>supabase_uniko_palavras.sql</b> no
        SQL Editor do Supabase e recarregue esta página.
      </div>
    </div>
  );

  return room
    ? <Sala roomId={room} name={name} photo={photo} players={naSala} onLeave={() => setRoom(null)} />
    : <Lobby name={name} porSala={porSala} onEnter={setRoom} />;
};

export { TabUnikoPalavras };
export default TabUnikoPalavras;
