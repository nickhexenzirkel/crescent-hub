// src/modules/central-colaborador/tabs/TabUnikoPaint.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO PAINT — desenho e adivinhação em tempo real (estilo Gartic), sala única
// global. EM DESENVOLVIMENTO: só admins veem a aba (filtro em Sidebar.jsx).
//
// COMO SINCRONIZA (dois canais, de propósito):
//   • BROADCAST (efêmero, não toca no banco): traços, chat/palpites e o "sync"
//     do desenho pra quem entra no meio. Um traço a cada frame viraria milhares
//     de INSERTs por partida — broadcast é o transporte certo.
//   • TABELA uniko_paint_state (postgres_changes): fase, rodada, quem desenha,
//     placar. Precisa sobreviver a F5 e a quem chega depois. Ver
//     supabase_uniko_paint.sql.
//   • PRESENCE: quem está online agora, com a foto de perfil de cada um.
//
// QUEM MANDA: não há servidor de jogo. O "host" é eleito de forma determinística
// (menor nome entre os presentes, todos chegam à mesma conclusão) e é o único
// que escreve as transições de fase e o placar. Se ele fechar a aba, o próximo
// assume sozinho na eleição seguinte.
//
// LIMITAÇÃO CONHECIDA (aceitável no MVP interno): a palavra vai no estado só em
// base64, então dá pra trapacear pelo devtools. Esconder de verdade exigiria uma
// RPC no Postgres que só entrega a palavra pro desenhista. Vale fazer se o jogo
// sair do modo admin-only.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER, saveUserPhoto } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos } from '../../../shared/captureUniko';
import { getSkinVariations, hasAssistantSkin } from '../../../shared/assistantSkin';

const ROOM = 'global';
const ROUND_MS  = 80_000;   // tempo pra desenhar
const REVEAL_MS = 5_000;    // tela de "a palavra era..."
const MIN_PLAYERS = 2;

/* Palavras — mistura de coisas do dia a dia, do universo Uniko e da empresa.
   Fáceis de desenhar de propósito: nada abstrato. */
const WORDS = [
  // Universo Uniko / empresa
  'uniko', 'crachá', 'holerite', 'ponto eletrônico', 'café da manhã', 'reunião',
  'home office', 'notebook', 'crescent', 'alexa', 'fone de ouvido', 'planilha',
  'impressora', 'grampeador', 'cafeteira', 'sala de reunião', 'headset', 'mouse',
  // Objetos
  'guarda-chuva', 'óculos', 'relógio', 'chave', 'tesoura', 'escada', 'martelo',
  'bicicleta', 'foguete', 'guitarra', 'violão', 'câmera', 'celular', 'geladeira',
  'ventilador', 'abajur', 'mochila', 'chinelo', 'panela', 'vassoura', 'balde',
  // Animais
  'gato', 'cachorro', 'pinguim', 'elefante', 'girafa', 'tubarão', 'polvo',
  'borboleta', 'caracol', 'dinossauro', 'coruja', 'tartaruga', 'abelha', 'sapo',
  // Comida
  'pizza', 'brigadeiro', 'açaí', 'coxinha', 'pastel', 'churrasco', 'sorvete',
  'melancia', 'pipoca', 'hambúrguer', 'sushi', 'bolo de aniversário', 'feijoada',
  // Lugares / natureza
  'praia', 'montanha', 'cachoeira', 'arco-íris', 'vulcão', 'ilha', 'floresta',
  'castelo', 'farol', 'ponte', 'igreja', 'estádio',
  // Ações / cenas
  'chuva', 'aniversário', 'futebol', 'dormindo', 'correndo', 'nadando',
  'carnaval', 'festa junina', 'natal', 'praia de férias', 'engarrafamento',
];

/* Paleta de desenho — tons vivos que funcionam em tema claro e escuro. */
const COLORS = ['#1A1A2E', '#E63946', '#F77F00', '#FCBF49', '#2A9D8F', '#2E8DD4',
  '#6B3FC8', '#E060A0', '#8B5E34', '#A8DADC', '#40916C', '#FFFFFF'];
const SIZES = [3, 7, 14, 26];

/* base64 com acento (btoa puro quebra em "coração"). */
const enc = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return ''; } };
const dec = (s) => { try { return decodeURIComponent(escape(atob(s || ''))); } catch { return ''; } };

/* Compara palpite com a palavra ignorando acento, caixa e espaço extra. */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, ' ').trim();

const myName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
const myPhoto = () => {
  try {
    const a = getAuthUser();
    return localStorage.getItem(a?.cpf ? `uniko_photo_${a.cpf}` : `uniko_photo_${USER.name}`)
      || localStorage.getItem('uniko_photo') || '/UNIKO_NEW.png';
  } catch { return '/UNIKO_NEW.png'; }
};

/* Máscara da palavra pra quem adivinha: "gato" -> "_ _ _ _" (espaços preservados). */
const maskWord = (w) => (w || '').split('').map(c => (c === ' ' ? '  ' : '_')).join(' ');

const Svg = ({ children, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...p}>{children}</svg>
);
const IcoBrush = (p) => <Svg {...p}><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z"/></Svg>;
const IcoEraser = (p) => <Svg {...p}><path d="M20 20H7L3 16a2 2 0 010-3l9-9a2 2 0 013 0l6 6a2 2 0 010 3l-7 7"/></Svg>;
const IcoTrash = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></Svg>;
const IcoUndo  = (p) => <Svg {...p}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></Svg>;
const IcoSend  = (p) => <Svg {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Svg>;
const IcoCrown = (p) => <Svg {...p}><path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/></Svg>;
const IcoCheck = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>;

const TabUnikoPaint = () => {
  const name = useMemo(() => myName(), []);
  const [state, setState]     = useState(null);     // estado da partida (tabela)
  const [players, setPlayers] = useState([]);       // presence: [{name, photo}]
  const [chat, setChat]       = useState([]);       // [{id, name, text, kind}]
  const [guess, setGuess]     = useState('');
  const [now, setNow]         = useState(() => Date.now());
  const [sqlMissing, setSqlMissing] = useState(false);
  const [picker, setPicker]   = useState(false);    // modal do seletor de foto
  const [photo, setPhoto]     = useState(() => myPhoto());

  // ferramentas
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize]   = useState(SIZES[1]);
  const [erasing, setErasing] = useState(false);

  const canvasRef = useRef(null);
  const chanRef   = useRef(null);
  const strokes   = useRef([]);        // [{points:[{x,y}], color, size, erase}] — normalizado 0..1
  const cur       = useRef(null);      // traço em andamento
  const pending   = useRef([]);        // segmentos a enviar (batch)
  const chatEndRef = useRef(null);
  // Espelhos do estado pros handlers do canal: eles são registrados uma vez só e
  // enxergariam valores velhos da closure. Declarados AQUI, antes de qualquer uso.
  const isDrawerRef = useRef(false);
  const stateRef    = useRef(null);
  const hostRef     = useRef(false);

  /* ── Canvas (definido cedo: o motor da partida e os handlers do canal usam) ──
     Os traços vivem em `strokes` (ref) em coordenadas normalizadas 0..1, e o
     canvas tem resolução FIXA 1000x625 escalada por CSS — assim o desenho sai
     idêntico em qualquer tela e o resize não precisa redesenhar nada. ── */
  const applySeg = (seg) => {
    if (seg.start) strokes.current.push({ points: [seg.p], color: seg.color, size: seg.size, erase: seg.erase });
    else strokes.current[strokes.current.length - 1]?.points.push(seg.p);
  };

  const redraw = () => {
    const cv = canvasRef.current; if (!cv) return;
    const cx = cv.getContext('2d');
    const { width: w, height: h } = cv;
    cx.clearRect(0, 0, w, h);
    cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, w, h);
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (const s of strokes.current) {
      if (!s?.points?.length) continue;
      cx.strokeStyle = s.erase ? '#FFFFFF' : s.color;
      cx.lineWidth = s.size * (w / 1000);   // espessura relativa ao canvas fixo
      cx.beginPath();
      cx.moveTo(s.points[0].x * w, s.points[0].y * h);
      for (let i = 1; i < s.points.length; i++) cx.lineTo(s.points[i].x * w, s.points[i].y * h);
      if (s.points.length === 1) cx.lineTo(s.points[0].x * w + 0.1, s.points[0].y * h); // ponto isolado
      cx.stroke();
    }
  };

  const isDrawer = state?.phase === 'drawing' && state?.drawer === name;
  const word     = useMemo(() => dec(state?.wordEnc), [state?.wordEnc]);
  // Host = menor nome entre os presentes. Determinístico: todo cliente elege o mesmo.
  const host     = useMemo(() => players.map(p => p.name).sort((a, b) => a.localeCompare(b))[0], [players]);
  const isHost   = host === name;
  const iHit     = !!state?.hits?.includes(name);
  const secsLeft = state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;

  // Mantém os espelhos em dia pros handlers do canal (ver comentário na declaração).
  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { hostRef.current = isHost; }, [isHost]);

  /* ── Estado da partida: leitura + realtime ───────────────────────────── */
  const pushState = useCallback(async (next) => {
    try {
      await supabase.from('uniko_paint_state')
        .update({ state: next, updated_at: new Date().toISOString() })
        .eq('id', ROOM);
      setState(next); // otimista: não espera o realtime voltar
    } catch (e) { console.error('[uniko-paint] pushState:', e); }
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from('uniko_paint_state').select('state').eq('id', ROOM).maybeSingle();
      if (!alive) return;
      // 42P01 = tabela não existe → a migração não foi rodada.
      if (error?.code === '42P01' || /uniko_paint_state/.test(error?.message || '')) { setSqlMissing(true); return; }
      setState(data?.state || { phase: 'lobby', round: 0, scores: {} });
    };
    load();
    const ch = supabase.channel('uniko-paint-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_paint_state', filter: `id=eq.${ROOM}` },
        ({ new: row }) => { if (row?.state) setState(row.state); })
      .subscribe();
    // Fallback: se o realtime não estiver habilitado, ainda assim sincroniza.
    const poll = setInterval(load, 4000);
    return () => { alive = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  /* ── Relógio local (só pra UI do cronômetro) ─────────────────────────── */
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  /* ── Chat / palpites ─────────────────────────────────────────────────── */
  const addChat = (m) => setChat(c => [...c.slice(-60), { id: Math.random().toString(36).slice(2), ...m }]);

  // Cada cliente decide sozinho se o palpite acertou (todos têm a palavra).
  // O HOST é quem grava o ponto — assim ninguém pontua a si mesmo.
  const onGuessMsg = (p) => {
    const s = stateRef.current;
    const w = dec(s?.wordEnc);
    const acertou = s?.phase === 'drawing' && w && norm(p.text) === norm(w)
      && p.name !== s.drawer && !s.hits?.includes(p.name);

    if (acertou) {
      addChat({ name: p.name, text: 'acertou a palavra!', kind: 'hit' });
      if (hostRef.current) registerHit(p.name);
      return;
    }
    // Quem já acertou fala num canal à parte pra não entregar a resposta.
    addChat({ name: p.name, text: p.text, kind: s?.hits?.includes(p.name) ? 'muted' : 'chat' });
  };

  const registerHit = (who) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'drawing' || s.hits?.includes(who)) return;
    const hits = [...(s.hits || []), who];
    // Quem acerta primeiro leva mais. Desenhista ganha por cada acerto.
    const pts = Math.max(40, 100 - (hits.length - 1) * 15);
    const scores = { ...(s.scores || {}) };
    scores[who] = (scores[who] || 0) + pts;
    scores[s.drawer] = (scores[s.drawer] || 0) + 30;
    const faltam = players.filter(p => p.name !== s.drawer).length - hits.length;
    // Todos acertaram → encerra a rodada na hora.
    pushState(faltam <= 0
      ? { ...s, hits, scores, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) }
      : { ...s, hits, scores });
  };

  const sendGuess = () => {
    const text = guess.trim();
    if (!text) return;
    setGuess('');
    if (isDrawer) { addChat({ name, text: 'você está desenhando! 🤫', kind: 'sys' }); return; }
    chanRef.current?.send({ type: 'broadcast', event: 'guess', payload: { name, text } });
    onGuessMsg({ name, text }); // eco local imediato
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat]);

  /* ── Motor da partida (só o host escreve) ────────────────────────────── */
  const startRound = (queue, scores, round) => {
    const drawer = queue[0];
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    chanRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
    strokes.current = []; redraw();
    pushState({
      phase: 'drawing', round, drawer, wordEnc: enc(w),
      endsAt: Date.now() + ROUND_MS, hits: [], scores, queue, totalRounds: null,
    });
  };

  const startGame = () => {
    const ordem = [...players.map(p => p.name)].sort(() => Math.random() - 0.5);
    startRound(ordem, {}, 1);
  };

  // Host cuida das transições de tempo.
  useEffect(() => {
    if (!isHost || !state || sqlMissing) return;
    const t = setInterval(() => {
      const s = stateRef.current;
      if (!s?.endsAt || Date.now() < s.endsAt) return;
      if (s.phase === 'drawing') {
        pushState({ ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) });
      } else if (s.phase === 'reveal') {
        const queue = (s.queue || []).slice(1);
        if (!queue.length) pushState({ ...s, phase: 'over', endsAt: null });
        else startRound(queue, s.scores || {}, (s.round || 1) + 1);
      }
    }, 400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.endsAt, sqlMissing]);

  // Canvas em resolução fixa 1000x625 e escalado por CSS: o desenho fica igual
  // pra todo mundo independente do tamanho da janela, e não precisa redesenhar
  // no resize.
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    cv.width = 1000; cv.height = 625; redraw();
    // Só na montagem: `redraw` lê tudo de refs, não precisa entrar nas deps.
  }, []);

  const posOf = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
             y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const flush = useCallback(() => {
    if (!pending.current.length) return;
    chanRef.current?.send({ type: 'broadcast', event: 'stroke', payload: { from: name, segs: pending.current } });
    pending.current = [];
  }, [name]);
  // Traços saem em lote a cada 60ms — um send por pixel entupiria o canal.
  useEffect(() => { const t = setInterval(flush, 60); return () => clearInterval(t); }, [flush]);

  const down = (e) => {
    if (!isDrawer) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = posOf(e);
    const seg = { start: true, p, color, size, erase: erasing };
    cur.current = true; applySeg(seg); pending.current.push(seg); redraw();
  };
  const move = (e) => {
    if (!isDrawer || !cur.current) return;
    const seg = { start: false, p: posOf(e) };
    applySeg(seg); pending.current.push(seg); redraw();
  };
  const up = () => { if (cur.current) { cur.current = null; flush(); } };

  const doClear = () => {
    if (!isDrawer) return;
    strokes.current = []; redraw();
    chanRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
  };
  const doUndo = () => {
    if (!isDrawer) return;
    strokes.current.pop(); redraw();
    chanRef.current?.send({ type: 'broadcast', event: 'undo', payload: {} });
  };

  /* ── Canal de tempo real: presence + broadcast ───────────────────────────
     Declarado DEPOIS de applySeg/redraw/onGuessMsg de propósito: os handlers
     abaixo usam essas funções, e em JS `const` não sobe (TDZ). ── */
  useEffect(() => {
    const ch = supabase.channel('uniko-paint-room', { config: { presence: { key: name } } });
    chanRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      const list = Object.values(st).flat().map(p => ({ name: p.name, photo: p.photo }));
      // dedup por nome (mesma pessoa em duas abas conta uma vez)
      const seen = new Set();
      setPlayers(list.filter(p => (seen.has(p.name) ? false : (seen.add(p.name), true))));
    });

    ch.on('broadcast', { event: 'stroke' }, ({ payload }) => {
      if (payload?.from === name) return;            // meus traços já estão na tela
      (payload?.segs || []).forEach(applySeg);
      redraw();
    });
    ch.on('broadcast', { event: 'clear' }, () => { strokes.current = []; redraw(); });
    ch.on('broadcast', { event: 'undo' }, () => { strokes.current.pop(); redraw(); });
    // Quem entra no meio pede o desenho; só o desenhista responde.
    ch.on('broadcast', { event: 'sync-req' }, () => {
      if (!isDrawerRef.current) return;
      ch.send({ type: 'broadcast', event: 'sync-all', payload: { strokes: strokes.current } });
    });
    ch.on('broadcast', { event: 'sync-all' }, ({ payload }) => {
      if (isDrawerRef.current) return;
      strokes.current = payload?.strokes || []; redraw();
    });
    ch.on('broadcast', { event: 'guess' }, ({ payload }) => onGuessMsg(payload));

    ch.subscribe(async (st) => {
      if (st !== 'SUBSCRIBED') return;
      await ch.track({ name, photo: myPhoto() });
      ch.send({ type: 'broadcast', event: 'sync-req', payload: { from: name } });
    });
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  /* ── Seletor de foto: Unikos capturados + suas variações ─────────────── */
  const [owned, setOwned] = useState(() => getCapturedCollection());
  useEffect(() => { syncCollectionFromServer().then(l => Array.isArray(l) && setOwned(l)); }, []);

  const myUnikos = useMemo(() => {
    const ids = new Set(owned.map(o => o.id));
    const base = [{ id: 'default', name: 'UNIKO', img: '/UNIKO_NEW.png' }];
    const fixos = Object.values(CAPTURE_UNIKOS).filter(u => ids.has(u.id))
      .map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    const custom = (getCustomUnikos() || []).filter(u => ids.has(u.id))
      .map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    return [...base, ...fixos, ...custom];
  }, [owned]);

  const choosePhoto = (img) => {
    // Mesmo caminho da aba Coleção: normaliza em 300x300 e salva como foto do Portal.
    const im = new Image(); im.crossOrigin = 'anonymous';
    const done = (val) => {
      saveUserPhoto(val);
      try { const a = getAuthUser(); localStorage.setItem(a?.cpf ? `uniko_photo_${a.cpf}` : `uniko_photo_${USER.name}`, val); }
      catch { /* localStorage cheio/bloqueado: a foto ainda vale nesta sessão */ }
      setPhoto(val); setPicker(false);
      chanRef.current?.track({ name, photo: val });   // reflete na hora pros outros
    };
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 300;
        c.getContext('2d').drawImage(im, 0, 0, 300, 300);
        done(c.toDataURL('image/png'));
      } catch { done(img); }
    };
    im.onerror = () => done(img);
    im.src = img;
  };

  /* ── UI ──────────────────────────────────────────────────────────────── */
  const cardBg = T.surface || '#fff';
  const ranked = useMemo(() => {
    const sc = state?.scores || {};
    return [...players].map(p => ({ ...p, pts: sc[p.name] || 0 })).sort((a, b) => b.pts - a.pts);
  }, [players, state?.scores]);

  if (sqlMissing) return (
    <div style={{ maxWidth: 620, margin: '40px auto', background: cardBg, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <img src="/UNIKO_NEW.png" alt="" style={{ width: 84, height: 84, objectFit: 'contain', marginBottom: 12 }} />
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8 }}>
        Falta rodar a migração
      </div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Uniko Paint precisa da tabela <code>uniko_paint_state</code>. Rode o arquivo{' '}
        <b style={{ color: T.text }}>supabase_uniko_paint.sql</b> no SQL Editor do Supabase e recarregue esta página.
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      {/* ── Cabeçalho ── */}
      <div style={{ borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
        background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldL} 55%, ${T.goldV || T.goldL} 100%)`,
        boxShadow: `0 8px 26px ${T.goldGl || 'rgba(0,0,0,.12)'}`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .18, pointerEvents: 'none',
          background: 'radial-gradient(circle at 12% 20%, #fff 0%, transparent 45%), radial-gradient(circle at 88% 80%, #fff 0%, transparent 40%)' }} />
        <img src="/UNIKO_NEW.png" alt="" style={{ width: 42, height: 42, objectFit: 'contain', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.3))' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '.01em' }}>
            Uniko Paint
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.85)' }}>
            Desenhe e adivinhe com a galera — em tempo real
          </div>
        </div>
        <div style={{ padding: '4px 11px', borderRadius: 999, background: 'rgba(0,0,0,.22)', color: '#fff',
          fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em' }}>EM DESENVOLVIMENTO</div>
        <button onClick={() => setPicker(true)} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', cursor: 'pointer' }}>
          <img src={photo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Meu Uniko</span>
        </button>
      </div>

      {/* ── Corpo: jogadores | canvas | chat ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '190px 1fr 260px', gap: 14, minHeight: 0 }}>

        {/* Jogadores + placar */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12,
          overflowY: 'auto', boxShadow: T.sh }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginBottom: 10 }}>
            JOGADORES ({players.length})
          </div>
          {ranked.map((p, i) => {
            const desenhando = state?.phase === 'drawing' && state?.drawer === p.name;
            const acertou = state?.hits?.includes(p.name);
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 9,
                background: desenhando ? `${T.gold}14` : 'transparent', marginBottom: 2 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={p.photo || '/UNIKO_NEW.png'} alt=""
                    style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover',
                      border: `2px solid ${desenhando ? T.gold : acertou ? '#28a060' : 'transparent'}`, background: T.surfaceSub }} />
                  {i === 0 && (state?.scores?.[p.name] > 0) && (
                    <div style={{ position: 'absolute', top: -6, right: -4, color: '#F0B429' }}><IcoCrown size={13} /></div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: p.name === name ? 800 : 600, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name.split(' ')[0]}{p.name === name && ' (você)'}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textT, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {p.pts} pts
                    {desenhando && <span style={{ color: T.gold, fontWeight: 700 }}>• desenhando</span>}
                    {acertou && <span style={{ color: '#28a060', fontWeight: 700 }}>• acertou</span>}
                    {p.name === host && <span title="Host da partida" style={{ opacity: .6 }}>• host</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvas + estado da rodada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {/* Barra da rodada */}
          <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 14px',
            display: 'flex', alignItems: 'center', gap: 12, boxShadow: T.sh, flexShrink: 0 }}>
            {state?.phase === 'drawing' ? (
              <>
                <div style={{ fontSize: 12, color: T.textT }}>Rodada {state.round}</div>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800,
                  color: T.text, letterSpacing: isDrawer ? '.02em' : '.22em' }}>
                  {isDrawer ? word : maskWord(word)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 999,
                  background: secsLeft <= 10 ? '#E6394622' : T.surfaceSub,
                  color: secsLeft <= 10 ? '#E63946' : T.text, fontWeight: 800, fontSize: 13.5, minWidth: 54, justifyContent: 'center' }}>
                  {secsLeft}s
                </div>
              </>
            ) : (
              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: T.textT, fontWeight: 600 }}>
                {state?.phase === 'reveal' ? <>A palavra era <b style={{ color: T.gold }}>{state.lastWord}</b></>
                  : state?.phase === 'over' ? 'Fim de jogo!'
                  : `Aguardando jogadores (mínimo ${MIN_PLAYERS})`}
              </div>
            )}
          </div>

          {/* Área do desenho */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${T.border}`, boxShadow: T.sh, background: '#fff' }}>
            <canvas ref={canvasRef}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
              style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none',
                cursor: isDrawer ? 'crosshair' : 'default' }} />

            {/* Overlays de lobby / reveal / fim */}
            {state?.phase !== 'drawing' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 22,
                background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(2px)' }}>
                <img src="/UNIKO_NEW.png" alt="" style={{ width: 74, height: 74, objectFit: 'contain' }} />
                {state?.phase === 'over' ? (
                  <>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text }}>
                      🏆 {ranked[0]?.name?.split(' ')[0] || '—'} venceu!
                    </div>
                    <div style={{ fontSize: 13, color: T.textT }}>
                      {ranked.slice(0, 3).map((p, i) => `${i + 1}º ${p.name.split(' ')[0]} — ${p.pts} pts`).join('   ·   ')}
                    </div>
                  </>
                ) : state?.phase === 'reveal' ? (
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: T.text }}>
                    A palavra era <span style={{ color: T.gold }}>{state.lastWord}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800, color: T.text }}>
                      Sala do Uniko Paint
                    </div>
                    <div style={{ fontSize: 13, color: T.textT, maxWidth: 380, lineHeight: 1.55 }}>
                      {players.length < MIN_PLAYERS
                        ? `Chame mais gente! Precisa de pelo menos ${MIN_PLAYERS} jogadores pra começar.`
                        : 'Todo mundo desenha uma vez. Quem adivinha primeiro ganha mais pontos.'}
                    </div>
                  </>
                )}
                {(state?.phase === 'lobby' || state?.phase === 'over') && (
                  isHost ? (
                    <button onClick={startGame} disabled={players.length < MIN_PLAYERS}
                      style={{ padding: '11px 26px', borderRadius: 999, border: 'none',
                        background: players.length < MIN_PLAYERS ? T.textD : `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
                        color: '#fff', fontSize: 14, fontWeight: 800, cursor: players.length < MIN_PLAYERS ? 'not-allowed' : 'pointer',
                        boxShadow: players.length < MIN_PLAYERS ? 'none' : `0 6px 18px ${T.goldGl}` }}>
                      {state?.phase === 'over' ? 'Jogar de novo' : 'Começar partida'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: T.textT, fontStyle: 'italic' }}>
                      Esperando {host?.split(' ')[0] || 'o host'} começar a partida...
                    </div>
                  )
                )}
              </div>
            )}

            {/* Aviso pra quem não desenha */}
            {state?.phase === 'drawing' && !isDrawer && (
              <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                padding: '4px 12px', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#fff',
                fontSize: 11.5, fontWeight: 700, pointerEvents: 'none' }}>
                {iHit ? '✓ você acertou!' : `${state.drawer?.split(' ')[0]} está desenhando`}
              </div>
            )}
          </div>

          {/* Ferramentas (só o desenhista) */}
          {isDrawer && (
            <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: T.sh, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => { setColor(c); setErasing(false); }} title={c}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: color === c && !erasing ? `2.5px solid ${T.text}` : `1px solid ${T.border}`,
                      transform: color === c && !erasing ? 'scale(1.15)' : 'none', transition: 'transform .12s' }} />
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: T.border }} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {SIZES.map(s => (
                  <button key={s} onClick={() => setSize(s)} title={`${s}px`}
                    style={{ width: 26, height: 26, borderRadius: 8, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      border: size === s ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
                      background: size === s ? `${T.gold}12` : 'transparent' }}>
                    <div style={{ width: Math.min(s, 16), height: Math.min(s, 16), borderRadius: '50%', background: T.text }} />
                  </button>
                ))}
              </div>
              <div style={{ width: 1, height: 20, background: T.border }} />
              <button onClick={() => setErasing(e => !e)} title="Borracha"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                  border: erasing ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
                  background: erasing ? `${T.gold}12` : 'transparent', color: T.text, fontSize: 12, fontWeight: 600 }}>
                <IcoEraser size={14} />Borracha
              </button>
              <button onClick={doUndo} title="Desfazer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 12, fontWeight: 600 }}>
                <IcoUndo size={14} />Desfazer
              </button>
              <button onClick={doClear} title="Limpar tudo"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid #E6394640', background: '#E6394610', color: '#E63946', fontSize: 12, fontWeight: 600 }}>
                <IcoTrash size={14} />Limpar
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.textT }}>
                <IcoBrush size={13} /> você está desenhando
              </div>
            </div>
          )}
        </div>

        {/* Chat / palpites */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, display: 'flex',
          flexDirection: 'column', minHeight: 0, boxShadow: T.sh }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 800,
            color: T.textT, letterSpacing: '.08em' }}>PALPITES</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {!chat.length && (
              <div style={{ fontSize: 12, color: T.textD, textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
                Escreva seu palpite aqui.<br />Quem acerta primeiro leva mais pontos!
              </div>
            )}
            {chat.map(m => (
              <div key={m.id} style={{ fontSize: 12.5, lineHeight: 1.45,
                color: m.kind === 'hit' ? '#28a060' : m.kind === 'sys' ? T.textT : T.text,
                fontStyle: m.kind === 'sys' ? 'italic' : 'normal',
                background: m.kind === 'hit' ? '#28a06012' : 'transparent',
                borderRadius: m.kind === 'hit' ? 7 : 0, padding: m.kind === 'hit' ? '4px 7px' : 0,
                opacity: m.kind === 'muted' ? .5 : 1 }}>
                {m.kind === 'hit' && <IcoCheck size={12} />}{' '}
                <b style={{ fontWeight: 700 }}>{m.name.split(' ')[0]}</b>{' '}
                <span>{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: 9, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 6 }}>
            <input value={guess} onChange={e => setGuess(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendGuess()}
              placeholder={isDrawer ? 'Você está desenhando...' : iHit ? 'Você acertou!' : 'Seu palpite...'}
              disabled={isDrawer}
              style={{ flex: 1, minWidth: 0, padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`,
                background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 12.5,
                fontFamily: 'var(--font-body)', outline: 'none' }} />
            <button onClick={sendGuess} disabled={isDrawer}
              style={{ width: 34, borderRadius: 9, border: 'none', cursor: isDrawer ? 'not-allowed' : 'pointer',
                background: isDrawer ? T.textD : `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoSend size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: escolher meu Uniko (capturados + variações) ── */}
      {picker && (
        <div onClick={() => setPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,6,24,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: cardBg, borderRadius: 18, border: `1px solid ${T.border}`, padding: 22,
              maxWidth: 680, width: '100%', maxHeight: '84vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.4)' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              Escolha seu Uniko
            </div>
            <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 18, lineHeight: 1.5 }}>
              Vale pro Uniko Paint <b>e</b> como sua foto de perfil no Portal. Só aparecem os Unikos que você já capturou —
              cada um tem suas variações.
            </div>
            {myUnikos.map(u => {
              const vars = hasAssistantSkin(u.id) ? getSkinVariations(u.id) : [];
              const opts = vars.length ? vars : [{ label: 'Normal', img: u.img }];
              return (
                <div key={u.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={u.img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />{u.name}
                  </div>
                  <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    {opts.map(v => (
                      <button key={v.img} onClick={() => choosePhoto(v.img)} title={v.label}
                        style={{ width: 78, padding: 7, borderRadius: 12, cursor: 'pointer', background: T.surfaceSub || 'rgba(0,0,0,.03)',
                          border: photo === v.img ? `2px solid ${T.gold}` : `1px solid ${T.border}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <img src={v.img} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                        <span style={{ fontSize: 9.5, color: T.textT, fontWeight: 600, textAlign: 'center',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {myUnikos.length <= 1 && (
              <div style={{ fontSize: 12.5, color: T.textT, background: T.surfaceSub || 'rgba(0,0,0,.03)',
                padding: 12, borderRadius: 10, lineHeight: 1.5 }}>
                Você ainda não capturou nenhum Uniko. Fique de olho no Portal durante os eventos do RH —
                os Unikos que você pegar aparecem aqui.
              </div>
            )}
            <button onClick={() => setPicker(false)}
              style={{ marginTop: 6, width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`,
                background: 'transparent', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { TabUnikoPaint };
export default TabUnikoPaint;
