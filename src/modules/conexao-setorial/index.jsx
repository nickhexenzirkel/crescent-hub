// src/modules/conexao-setorial/index.jsx
// Conexão Setorial — quadro Kanban (estilo Trello) do time do Financeiro.
// Substitui o antigo chat estilo WhatsApp. Real e compartilhado (Supabase +
// realtime), com arrastar-e-soltar, prazos, responsáveis, etiquetas, checklists,
// comentários e notificação desktop + som. Estética Uniko (rosa/roxo). Admin-only
// (o gate fica no App.jsx). Precisa rodar supabase_conexao_setorial_trello.sql.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SERVER_URL, supabase as sb, getAuthUser, fetchPhotoByName } from '../../contexts/user';
import { notifyDesktop, ensureNotifyPermission } from '../../utils/desktopNotify';
import SalasLobby from './SalasLobby';

// ─── Constantes ───────────────────────────────────────────────────────────────
const UNIKO_GRAD = 'linear-gradient(135deg,#E0559A 0%,#A24CE0 100%)';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

// SHA-256 hex da senha da sala. Guardamos só o hash — a senha em si nunca vai
// pro banco. Isso NÃO transforma a sala num cofre (a checagem é no cliente e a
// tabela é legível pela chave anon), só evita expor a senha escrita.
const sha256 = async (txt) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};
// Salas já destravadas nesta sessão (fecha a aba, pede senha de novo).
const UNLOCKED_KEY = 'cs_salas_abertas';
const lidasNaSessao = () => { try { return JSON.parse(sessionStorage.getItem(UNLOCKED_KEY) || '[]'); } catch { return []; } };
const marcarAberta = (id) => {
  const at = [...new Set([...lidasNaSessao(), id])];
  try { sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify(at)); } catch {}
};
const nowIso = () => new Date().toISOString();
// Texto puro a partir do HTML da descrição (pra prévia no card e no filtro).
const stripHtml = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// "há X" curtinho pro histórico.
const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24); if (d < 30) return `há ${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const initials = (name) => (name || '?').trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
const firstName = (name) => (name || '').trim().split(/\s+/)[0] || '—';
const avatarColor = (name) => {
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 52%)`;
};
// Avatar: usa a foto de perfil (Supabase) quando existe, senão iniciais coloridas.
const Avatar = ({ name, photo, size = 24, ring, ml }) => (
  photo
    ? <img src={photo} alt="" title={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: ring ? `2px solid ${ring}` : 'none', marginLeft: ml || 0 }} />
    : <div title={name}
        style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), color: '#fff', fontSize: Math.round(size * 0.4), fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0, border: ring ? `2px solid ${ring}` : 'none', marginLeft: ml || 0 }}>{initials(name)}</div>
);

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); const l = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return l.toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const dueInfo = (iso) => {
  if (!iso) return null;
  const d = new Date(iso), diff = d.getTime() - Date.now();
  const state = diff < 0 ? 'over' : diff < 24 * 3600e3 ? 'soon' : 'ok';
  const color = state === 'over' ? '#E0345A' : state === 'soon' ? '#E67E22' : (T.textT || '#888');
  const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { state, color, label };
};

// Som de alerta curto via WebAudio (sem precisar de arquivo).
let _ac = null;
function playChime() {
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    const now = _ac.currentTime;
    [[784, 0], [1046, 0.11]].forEach(([f, t]) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, now + t);
      g.gain.linearRampToValueAtTime(0.16, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.34);
      o.connect(g); g.connect(_ac.destination);
      o.start(now + t); o.stop(now + t + 0.4);
    });
  } catch {}
}

// ─── Ícones SVG (estilo traço, herdam currentColor) — substituem os emojis ──────
const ICON_PATHS = {
  back:    <><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>,
  board:   <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" /></>,
  search:  <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  bell:    <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  bellOff: <><path d="M18 8a6 6 0 0 0-9.3-5" /><path d="M6 8c0 7-3 9-3 9h13" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /><path d="M3 3l18 18" /></>,
  clock:   <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check:   <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12l3 3 5-6" /></>,
  checkMark: <><path d="M20 6L9 17l-5-5" /></>,
  comment: <><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></>,
  image:   <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>,
  plus:    <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  x:       <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>,
  trash:   <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  upload:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v13" /></>,
  dots:    <><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
  copy:    <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" /></>,
  bold:    <><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></>,
  italic:  <><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4L9 20" /></>,
  edit:    <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
};
const Ic = ({ n, size = 16, sw = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block', ...style }}>{ICON_PATHS[n]}</svg>
);

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ConexaoSetorial({ onBack, authUser }) {
  const isMobile = useIsMobile();
  const me = authUser?.name || getAuthUser()?.name || 'Colaborador';

  const isAdmin = (authUser?.role || getAuthUser()?.role) === 'admin';

  // ── Salas ── cada sala é um quadro próprio; sem sala escolhida, mostra o lobby.
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const room = rooms.find(r => r.id === roomId) || null;

  const loadRooms = useCallback(async () => {
    const { data } = await sb.from('conexao_rooms').select('*').order('position', { ascending: true });
    setRooms(data || []);
    setRoomsLoading(false);
  }, []);

  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);        // nomes dos colegas (responsáveis)
  const [photos, setPhotos] = useState({});        // nome -> foto de perfil (base64/url) ou null
  const [selectedId, setSelectedId] = useState(null); // card aberto no modal

  // composers / edição
  const [composerList, setComposerList] = useState(null);
  const [composerText, setComposerText] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [newListText, setNewListText] = useState('');
  const [editingList, setEditingList] = useState(null);
  const [editListText, setEditListText] = useState('');

  // filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterCreator, setFilterCreator] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // notificações
  const [notifOn, setNotifOn] = useState(() => localStorage.getItem('cs_notif') !== '0');
  const [toast, setToast] = useState(null);

  // drag & drop
  const [drag, setDrag] = useState(null);           // { cardId, fromList }
  const [dragOver, setDragOver] = useState(null);    // { listId, index }

  // menu de contexto (botão direito no card)
  const [ctxMenu, setCtxMenu] = useState(null);      // { cardId, x, y, sub }

  const notifOnRef = useRef(notifOn);
  const meRef = useRef(me);
  const prevCardsRef = useRef(null);
  const firstLoadRef = useRef(true);
  const cardsRef = useRef([]);
  const notifiedDueRef = useRef(new Set());
  const reloadTimer = useRef(null);
  // Mantém os refs em dia (usados dentro de timers/callbacks assíncronos) — em effect,
  // não durante o render (evita "cannot update ref during render").
  useEffect(() => { notifOnRef.current = notifOn; }, [notifOn]);
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  // ── Notificação ─────────────────────────────────────────────
  const fireNotif = useCallback((title, message) => {
    if (!notifOnRef.current) return;
    playChime();
    notifyDesktop({ id: 'cs-' + Date.now(), type: 'lembrete', title, message });
    setToast({ title, message });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // ── Carrega o quadro ────────────────────────────────────────
  const load = useCallback(async () => {
    if (!roomId) return;                       // sem sala aberta não há quadro pra carregar
    const { data: ls } = await sb.from('conexao_lists')
      .select('*').eq('room_id', roomId).order('position', { ascending: true });
    const listsArr = ls || [];
    // só os cards das colunas desta sala
    const ids = listsArr.map(l => l.id);
    const { data: cs } = ids.length
      ? await sb.from('conexao_cards').select('*').in('list_id', ids).order('position', { ascending: true })
      : { data: [] };
    const cardsArr = cs || [];
    setLists(listsArr); setCards(cardsArr); setLoading(false);

    // diff p/ notificar (pula na 1ª carga)
    const me2 = meRef.current;
    const prev = prevCardsRef.current;
    if (!firstLoadRef.current && prev) {
      for (const c of cardsArr) {
        const p = prev[c.id];
        const meIn = (c.assignees || []).includes(me2);
        const meWas = p ? (p.assignees || []).includes(me2) : false;
        if (meIn && !meWas) fireNotif('Novo card pra você', c.title);
        const nc = (c.comments || []).length, pc = p ? (p.comments || []).length : nc;
        if (nc > pc && (meIn || c.created_by === me2)) {
          const last = c.comments[nc - 1];
          if (last && last.author !== me2) fireNotif('Comentário de ' + last.author, `${c.title}: ${last.text}`);
        }
      }
    }
    prevCardsRef.current = Object.fromEntries(cardsArr.map(c => [c.id, c]));
    firstLoadRef.current = false;
  }, [fireNotif, roomId]);

  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 300);
  }, [load]);

  // ── Boot: carrega, realtime, poll, colegas ──────────────────
  // salas + realtime da lista de salas
  useEffect(() => {
    loadRooms();
    const ch = sb.channel('conexao-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conexao_rooms' }, loadRooms)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [loadRooms]);

  // quadro da sala aberta — recarrega do zero quando troca de sala
  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    firstLoadRef.current = true;      // não notifica os cards já existentes ao entrar
    prevCardsRef.current = null;
    load();
    const ch = sb.channel('conexao-board-' + roomId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conexao_cards' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conexao_lists' }, scheduleReload)
      .subscribe();
    const poll = setInterval(load, 20000);
    return () => { sb.removeChannel(ch); clearInterval(poll); clearTimeout(reloadTimer.current); };
  }, [roomId, load, scheduleReload]);

  useEffect(() => {
    // colegas (responsáveis) — endpoint admin
    (async () => {
      try {
        const r = await fetch(`${SERVER_URL}/api/employees`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` },
        });
        const d = await r.json();
        const names = (d.employees || []).map(e => e.name || e.nome).filter(Boolean);
        setPeople([...new Set([me, ...names])].sort((a, b) => a.localeCompare(b)));
      } catch { setPeople([me]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Varredura de prazos (vencendo/atrasado) ─────────────────
  useEffect(() => {
    const scan = () => {
      const me2 = meRef.current;
      for (const c of cardsRef.current) {
        if (!c.due_date) continue;
        if (!(c.assignees || []).includes(me2) && c.created_by !== me2) continue;
        const diff = new Date(c.due_date).getTime() - Date.now();
        const state = diff < 0 ? 'over' : diff < 24 * 3600e3 ? 'soon' : null;
        if (!state) continue;
        const key = c.id + ':' + state;
        if (notifiedDueRef.current.has(key)) continue;
        notifiedDueRef.current.add(key);
        fireNotif(state === 'over' ? 'Card atrasado' : 'Card vencendo em 24h', c.title);
      }
    };
    const id = setInterval(scan, 60000);
    const t = setTimeout(scan, 4000);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [fireNotif]);

  // ── Fotos de perfil dos colegas/criadores ───────────────────
  useEffect(() => {
    const names = [...new Set([...people, ...cards.map(c => c.created_by)])].filter(Boolean);
    const missing = names.filter(n => !(n in photos));
    if (!missing.length) return;
    let alive = true;
    (async () => {
      const entries = await Promise.all(missing.map(async n => [n, await fetchPhotoByName(n)]));
      if (!alive) return;
      setPhotos(p => { const next = { ...p }; for (const [n, url] of entries) next[n] = url; return next; });
    })();
    return () => { alive = false; };
  }, [people, cards, photos]);

  // ── Mutations ───────────────────────────────────────────────
  const patchCard = async (id, patch) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c)); // otimista
    await sb.from('conexao_cards').update({ ...patch, updated_at: nowIso() }).eq('id', id);
    scheduleReload();
  };

  const addCard = async (listId, title) => {
    const t = title.trim(); if (!t) return;
    const inList = cards.filter(c => c.list_id === listId);
    const pos = inList.length ? Math.max(...inList.map(c => c.position)) + 1000 : 1000;
    await sb.from('conexao_cards').insert({ list_id: listId, title: t, position: pos, created_by: me });
    scheduleReload();
  };

  const deleteCard = async (id) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setSelectedId(null);
    await sb.from('conexao_cards').delete().eq('id', id);
    scheduleReload();
  };

  // Histórico de alterações (append seguro no jsonb).
  const logHistory = async (id, text) => {
    const { data } = await sb.from('conexao_cards').select('history').eq('id', id).single();
    const history = [...(data?.history || []), { id: uid(), who: me, text, at: nowIso() }];
    await patchCard(id, { history });
  };
  // Patch + registro no histórico numa tacada só.
  const patchLog = async (id, patch, text) => {
    const { data } = await sb.from('conexao_cards').select('history').eq('id', id).single();
    const history = [...(data?.history || []), { id: uid(), who: me, text, at: nowIso() }];
    await patchCard(id, { ...patch, history });
  };

  const archiveCard = async (id) => {
    await patchLog(id, { archived: true }, 'arquivou o card');
    setSelectedId(null);
  };
  const unarchiveCard = async (id) => {
    await patchLog(id, { archived: false }, 'desarquivou o card');
  };
  // Coluna "Concluído" (por nome, sem depender de acento/maiúscula).
  const doneList = lists.find(l => /conclu/i.test(l.title || ''));
  const completeCard = async (id) => {
    if (!doneList) { setToast({ title: 'Sem coluna "Concluído"', message: 'Crie uma coluna chamada Concluído para usar o atalho.' }); setTimeout(() => setToast(null), 4000); return; }
    const cur = cardsRef.current.find(c => c.id === id);
    if (!cur || cur.list_id === doneList.id) return;
    const inDone = cardsRef.current.filter(c => c.list_id === doneList.id && c.id !== id);
    const pos = inDone.length ? Math.max(...inDone.map(c => c.position)) + 1000 : 1000;
    await patchCard(id, { list_id: doneList.id, position: pos }); // move (não depende da v2)
    logHistory(id, 'concluiu o card');                            // histórico (best-effort)
  };
  const copyCard = async (id) => {
    const src = cardsRef.current.find(c => c.id === id);
    if (!src) return;
    const inList = cardsRef.current.filter(c => c.list_id === src.list_id && !c.archived);
    const pos = inList.length ? Math.max(...inList.map(c => c.position)) + 1000 : 1000;
    await sb.from('conexao_cards').insert({
      list_id: src.list_id, title: (src.title || '') + ' (cópia)', description: src.description || '',
      assignees: src.assignees || [], comments: [], images: [], position: pos, created_by: me,
      history: [{ id: uid(), who: me, text: 'criou (cópia de outro card)', at: nowIso() }],
    });
    scheduleReload();
    setSelectedId(null);
  };

  // append seguro em jsonb (relê a linha p/ não perder edição concorrente)
  const appendComment = async (id, text) => {
    const t = text.trim(); if (!t) return;
    const { data } = await sb.from('conexao_cards').select('comments').eq('id', id).single();
    const comments = [...(data?.comments || []), { id: uid(), author: me, text: t, at: nowIso() }];
    await patchCard(id, { comments });
  };

  // Imagens (Supabase Storage bucket 'conexao') — read-modify-write no jsonb do card.
  const addImages = async (id, imgs) => {
    const { data } = await sb.from('conexao_cards').select('images').eq('id', id).single();
    await patchCard(id, { images: [...(data?.images || []), ...imgs] });
  };
  const removeImage = async (id, img) => {
    const { data } = await sb.from('conexao_cards').select('images').eq('id', id).single();
    await patchCard(id, { images: (data?.images || []).filter(x => x.path !== img.path) });
    try { await sb.storage.from('conexao').remove([img.path]); } catch {}
  };

  // ── Salas: criar / senha / excluir (só admin) ───────────────
  const criarSala = async ({ name, descricao, senha, color }) => {
    const pos = rooms.length ? Math.max(...rooms.map(r => r.position)) + 1000 : 1000;
    const pass_hash = senha ? await sha256(senha) : null;
    await sb.from('conexao_rooms').insert({
      name: name.trim(), descricao: (descricao || '').trim(), color: color || '#A24CE0',
      pass_hash, position: pos, created_by: me,
    });
    await loadRooms();
  };
  const definirSenhaSala = async (id, senha) => {
    const pass_hash = senha ? await sha256(senha) : null;
    await sb.from('conexao_rooms').update({ pass_hash }).eq('id', id);
    await loadRooms();
  };
  const excluirSala = async (id) => {
    const alvo = rooms.find(r => r.id === id);
    if (!window.confirm(`Excluir a sala "${alvo?.name}" e TODAS as colunas e cards dela?\n\nIsso não tem volta.`)) return;
    await sb.from('conexao_rooms').delete().eq('id', id);
    if (roomId === id) setRoomId(null);
    await loadRooms();
  };
  // valida a senha digitada contra o hash guardado
  const abrirSala = async (sala, senha, jaLiberada = false) => {
    if (sala.pass_hash && !jaLiberada) {
      const h = await sha256(senha || '');
      if (h !== sala.pass_hash) return false;
    }
    marcarAberta(sala.id);
    setRoomId(sala.id);
    return true;
  };

  const addList = async (title) => {
    const t = title.trim(); if (!t) return;
    const pos = lists.length ? Math.max(...lists.map(l => l.position)) + 1000 : 1000;
    await sb.from('conexao_lists').insert({ title: t, position: pos, room_id: roomId });
    scheduleReload();
  };
  const renameList = async (id, title) => {
    const t = title.trim(); if (!t) return;
    setLists(prev => prev.map(l => l.id === id ? { ...l, title: t } : l));
    await sb.from('conexao_lists').update({ title: t }).eq('id', id);
  };
  const deleteList = async (id) => {
    if (!window.confirm('Excluir esta coluna e TODOS os cards dela?')) return;
    setLists(prev => prev.filter(l => l.id !== id));
    setCards(prev => prev.filter(c => c.list_id !== id));
    await sb.from('conexao_lists').delete().eq('id', id);
    scheduleReload();
  };

  // ── Drop de card ────────────────────────────────────────────
  const performDrop = async (listId) => {
    const hint = dragOver; const d = drag;
    setDrag(null); setDragOver(null);
    if (!d) return;
    const rendered = cards.filter(c => c.list_id === listId).sort((a, b) => a.position - b.position);
    const without = rendered.filter(c => c.id !== d.cardId);
    let idx = hint && hint.listId === listId ? hint.index : without.length;
    const draggedIdx = rendered.findIndex(c => c.id === d.cardId);
    if (draggedIdx !== -1 && draggedIdx < idx) idx -= 1;
    idx = Math.max(0, Math.min(idx, without.length));
    const prev = without[idx - 1], next = without[idx];
    let pos;
    if (!prev && !next) pos = 1000;
    else if (!prev) pos = next.position - 1000;
    else if (!next) pos = prev.position + 1000;
    else pos = (prev.position + next.position) / 2;
    const cur = cards.find(c => c.id === d.cardId);
    if (cur && cur.list_id === listId && cur.position === pos) return;
    await patchCard(d.cardId, { list_id: listId, position: pos });
  };

  // Move um card pro fim de outra coluna (usado pelo menu de contexto).
  const moveCardToList = async (cardId, listId) => {
    const cur = cardsRef.current.find(c => c.id === cardId);
    if (!cur || cur.list_id === listId) return;
    const inList = cardsRef.current.filter(c => c.list_id === listId);
    const pos = inList.length ? Math.max(...inList.map(c => c.position)) + 1000 : 1000;
    await patchCard(cardId, { list_id: listId, position: pos });
  };

  // ── Filtro ──────────────────────────────────────────────────
  const passesFilter = (c) => {
    if (c.archived) return false;   // arquivados não aparecem no quadro
    if (filterText && !(`${c.title} ${c.description}`.toLowerCase().includes(filterText.toLowerCase()))) return false;
    if (filterCreator && c.created_by !== filterCreator) return false;
    return true;
  };
  const filterActive = filterText || filterCreator;
  const creators = [...new Set(cards.filter(c => !c.archived).map(c => c.created_by).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const archivedCards = cards.filter(c => c.archived).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const archivedCount = archivedCards.length;

  const toggleNotif = async () => {
    const next = !notifOn;
    setNotifOn(next); localStorage.setItem('cs_notif', next ? '1' : '0');
    if (next) { try { await ensureNotifyPermission(); } catch {} playChime(); }
  };

  const selectedCard = cards.find(c => c.id === selectedId) || null;

  // ── Estilos base ────────────────────────────────────────────
  const brd = T.border || 'rgba(0,0,0,0.08)';
  const colBg = T.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const cardBg = T.surface || (T.dark ? '#1a1a2e' : '#fff');

  const shellStyle = { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.page, color: T.text, fontFamily: 'var(--font-body)' };
  const Blobs = (
    <div className="cs-blobs" aria-hidden>
      <div className="cs-blob cs-blob1" />
      <div className="cs-blob cs-blob2" />
      <div className="cs-blob cs-blob3" />
    </div>
  );
  const CS_CSS = `
        @keyframes csPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes csToast{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
        @keyframes csFade{from{opacity:0}to{opacity:1}}
        @keyframes csUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes csSlideIn{from{transform:translateX(100%)}to{transform:none}}
        .cs-scroll::-webkit-scrollbar{height:10px;width:10px}
        .cs-card{transition:transform .14s cubic-bezier(.2,1,.3,1), box-shadow .14s, border-color .14s}
        .cs-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(120,60,180,.2)}
        .cs-card:active{transform:scale(.99)}
        .cs-btn{cursor:pointer;border:none;font-family:inherit;transition:filter .15s, background .15s, transform .12s}
        .cs-btn:hover{filter:brightness(1.08)}
        .cs-btn:active{transform:scale(.96)}
        .cs-ghost:hover{background:${T.itemHover || 'rgba(120,60,180,.08)'}}
        .cs-chip{transition:transform .12s, background .15s}
        .cs-chip:hover{transform:translateY(-1px);filter:brightness(.97)}
        .cs-mi{transition:background .12s}
        .cs-mi:hover{background:${T.itemHover || 'rgba(120,60,180,.08)'}}
        .cs-tb{transition:background .12s, transform .1s}
        .cs-tb:hover{background:${T.itemHover || 'rgba(120,60,180,.1)'}}
        .cs-tb:active{transform:scale(.9)}
        .cs-fade{animation:csUp .22s ease both}
        .cs-desc b,.cs-desc strong{color:${T.text}}
        .cs-desc:hover{background:${T.itemHover || 'rgba(120,60,180,.05)'};border-radius:8px}

        /* ── blobs de fundo: manchas coloridas desfocadas que vagam devagar ── */
        .cs-blobs{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;
          filter:blur(72px);opacity:.5;contain:paint}
        .cs-blob{position:absolute;border-radius:50%;will-change:transform}
        @keyframes csBlobA{0%,100%{transform:translate(0,0) scale(1)}
          33%{transform:translate(9vw,7vh) scale(1.16)}
          66%{transform:translate(-6vw,11vh) scale(.9)}}
        @keyframes csBlobB{0%,100%{transform:translate(0,0) scale(1)}
          40%{transform:translate(-11vw,8vh) scale(1.22)}
          75%{transform:translate(7vw,-6vh) scale(.94)}}
        @keyframes csBlobC{0%,100%{transform:translate(0,0) scale(1.05)}
          50%{transform:translate(8vw,-10vh) scale(.86)}}
        .cs-blob1{width:44vw;height:44vw;top:-12vh;left:-8vw;
          background:radial-gradient(circle,#E0559A,transparent 68%);animation:csBlobA 26s ease-in-out infinite}
        .cs-blob2{width:40vw;height:40vw;top:18vh;right:-10vw;
          background:radial-gradient(circle,#A24CE0,transparent 68%);animation:csBlobB 32s ease-in-out infinite}
        .cs-blob3{width:36vw;height:36vw;bottom:-16vh;left:28vw;
          background:radial-gradient(circle,#5B8DEF,transparent 68%);animation:csBlobC 38s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){ .cs-blob{animation:none !important} }
  `;

  // ── Sem sala aberta: lobby das salas ────────────────────────
  if (!roomId) {
    return (
      <div style={shellStyle}>
        <style>{CS_CSS}</style>
        {Blobs}
        <SalasLobby
          rooms={rooms} loading={roomsLoading} isAdmin={isAdmin} brd={brd} onBack={onBack}
          jaAberta={(id) => lidasNaSessao().includes(id)}
          onEntrar={abrirSala} onCriar={criarSala} onSenha={definirSenhaSala} onExcluir={excluirSala} />
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{CS_CSS}</style>

      {/* fundo animado (atrás de tudo) */}
      {Blobs}

      {/* ── Header ── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 14px' : '14px 22px', borderBottom: `1px solid ${brd}`, background: T.topbarBg || T.surface, backdropFilter: 'blur(12px)', flexWrap: 'wrap' }}>
        {/* voltar = sai da sala e volta pro lobby (não sai do módulo) */}
        <button className="cs-btn cs-ghost" onClick={() => setRoomId(null)} title="Voltar para as salas"
          style={{ background: 'transparent', color: T.text, width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Ic n="back" size={20} /></button>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: room?.color || UNIKO_GRAD, display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(160,60,190,.4)' }}><Ic n="board" size={21} /></div>
        <div style={{ marginRight: 'auto' }}>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 16 : 19, fontFamily: 'var(--font-brand)', background: UNIKO_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '.01em' }}>{room?.name || 'Conexão Setorial'}</div>
          <div style={{ fontSize: 11.5, color: T.textT, fontWeight: 600 }}>{cards.length} cards · {lists.length} colunas</div>
        </div>
        <button className="cs-btn" onClick={() => setShowFilters(s => !s)} title="Filtros"
          style={{ background: filterActive ? UNIKO_GRAD : (T.surfaceSub || colBg), color: filterActive ? '#fff' : T.text, borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', border: `1px solid ${brd}` }}>
          <Ic n="search" size={15} /> {filterActive ? 'Filtrando' : 'Filtrar'}
        </button>
        <button className="cs-btn" onClick={() => setShowArchived(true)} title="Cards arquivados"
          style={{ background: T.surfaceSub || colBg, color: T.text, borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', border: `1px solid ${brd}` }}>
          <Ic n="archive" size={15} /> {!isMobile && 'Arquivados'}
          {archivedCount > 0 && <span style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{archivedCount}</span>}
        </button>
        <button className="cs-btn" onClick={toggleNotif} title="Notificações desktop + som"
          style={{ background: notifOn ? UNIKO_GRAD : (T.surfaceSub || colBg), color: notifOn ? '#fff' : T.textT, borderRadius: 12, padding: '9px 12px', fontWeight: 700, border: `1px solid ${brd}`, display: 'grid', placeItems: 'center' }}>
          <Ic n={notifOn ? 'bell' : 'bellOff'} size={16} />
        </button>
      </div>

      {/* ── Barra de filtros ── */}
      {showFilters && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '10px 22px', borderBottom: `1px solid ${brd}`, background: T.surface, animation: 'csPop .2s ease' }}>
          <input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Buscar título/descrição…"
            style={{ flex: '1 1 220px', minWidth: 160, padding: '9px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13, outline: 'none' }} />
          <select value={filterCreator || ''} onChange={e => setFilterCreator(e.target.value || null)}
            style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13 }}>
            <option value="">Todos os criadores</option>
            {creators.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {filterActive && <button className="cs-btn cs-ghost" onClick={() => { setFilterText(''); setFilterCreator(null); }} style={{ background: 'transparent', color: T.textT, fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8 }}>Limpar ✕</button>}
        </div>
      )}

      {/* ── Board ── */}
      <div className="cs-scroll" style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', gap: 16, padding: 18, overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start' }}>
        {loading ? (
          <div style={{ margin: 'auto', color: T.textT, fontWeight: 600 }}>Carregando quadro…</div>
        ) : (
          <>
            {lists.map(list => {
              const listCards = cards.filter(c => c.list_id === list.id && passesFilter(c)).sort((a, b) => a.position - b.position);
              const isDoneList = /conclu/i.test(list.title || '');
              return (
                <div key={list.id}
                  onDragOver={e => { if (drag) { e.preventDefault(); if (!dragOver || dragOver.listId !== list.id || dragOver.index !== listCards.length) setDragOver({ listId: list.id, index: listCards.length }); } }}
                  onDrop={() => performDrop(list.id)}
                  style={{ flex: '0 0 auto', width: isMobile ? 268 : 300, maxHeight: '100%', display: 'flex', flexDirection: 'column', background: colBg, borderRadius: 16, border: `1px solid ${brd}` }}>
                  {/* Cabeçalho da coluna */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 8px' }}>
                    {editingList === list.id ? (
                      <input autoFocus value={editListText} onChange={e => setEditListText(e.target.value)}
                        onBlur={() => { renameList(list.id, editListText); setEditingList(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') { renameList(list.id, editListText); setEditingList(null); } if (e.key === 'Escape') setEditingList(null); }}
                        style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: `1px solid ${brd}`, background: T.page, color: T.text, fontWeight: 700, fontSize: 14 }} />
                    ) : (
                      <div onClick={() => { setEditingList(list.id); setEditListText(list.title); }} style={{ flex: 1, fontWeight: 800, fontSize: 14.5, cursor: 'text', fontFamily: 'var(--font-brand)' }}>{list.title}</div>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.textT, background: T.surfaceSub || 'rgba(0,0,0,.05)', borderRadius: 20, padding: '2px 9px' }}>{listCards.length}</span>
                    <button className="cs-btn cs-ghost" onClick={() => deleteList(list.id)} title="Excluir coluna" style={{ background: 'transparent', color: T.textT, borderRadius: 8, width: 26, height: 26, display: 'grid', placeItems: 'center' }}><Ic n="x" size={14} /></button>
                  </div>

                  {/* Cards */}
                  <div className="cs-scroll" style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 8px', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 8 }}>
                    {listCards.map((c, idx) => {
                      const imgs = c.images || [];
                      const descPrev = stripHtml(c.description);
                      const showLine = dragOver && dragOver.listId === list.id && dragOver.index === idx;
                      return (
                        <React.Fragment key={c.id}>
                          {showLine && <div style={{ height: 3, borderRadius: 3, background: '#A24CE0', margin: '-3px 2px 0' }} />}
                          <div className="cs-card" draggable
                            onDragStart={() => setDrag({ cardId: c.id, fromList: list.id })}
                            onDragEnd={() => { setDrag(null); setDragOver(null); }}
                            onDragOver={e => { if (drag) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; const index = before ? idx : idx + 1; if (!dragOver || dragOver.listId !== list.id || dragOver.index !== index) setDragOver({ listId: list.id, index }); } }}
                            onClick={() => setSelectedId(c.id)}
                            onContextMenu={e => { e.preventDefault(); setCtxMenu({ cardId: c.id, x: e.clientX, y: e.clientY, sub: false }); }}
                            style={{ position: 'relative', background: cardBg, borderRadius: 14, border: isDoneList ? '2px solid #22C55E' : `1px solid ${brd}`, padding: isDoneList ? '13px 14px' : '14px 15px', cursor: 'pointer', boxShadow: isDoneList ? '0 2px 12px rgba(34,197,94,.18)' : '0 2px 6px rgba(0,0,0,.06)', overflow: 'hidden' }}>
                            {imgs.length > 0 && (
                              <img src={imgs[0].url} alt="" style={{ display: 'block', width: 'calc(100% + 30px)', height: 140, objectFit: 'cover', margin: isDoneList ? '-13px -14px 11px' : '-14px -15px 11px', background: T.surfaceSub }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                              {/* Bolinha de concluir */}
                              <button
                                onClick={e => { e.stopPropagation(); completeCard(c.id); }}
                                title={isDoneList ? 'Concluído' : 'Marcar como concluído'}
                                style={{ flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', border: isDoneList ? 'none' : `2px solid ${T.textT || '#aaa'}`, background: isDoneList ? '#22C55E' : 'transparent', color: '#fff', padding: 0, transition: 'all .15s' }}>
                                {isDoneList && <Ic n="checkMark" size={12} sw={3} />}
                              </button>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: T.text, textDecoration: isDoneList ? 'line-through' : 'none', textDecorationColor: 'rgba(34,197,94,.6)' }}>{c.title}</div>
                                {descPrev && (
                                  <div style={{ fontSize: 13, color: T.textS, marginTop: 6, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{descPrev}</div>
                                )}
                              </div>
                            </div>
                            {/* Rodapé: criador + contadores + responsáveis */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={`Criado por ${c.created_by || '—'}`}>
                                <Avatar name={c.created_by} photo={photos[c.created_by]} size={22} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: T.textT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{firstName(c.created_by)}</span>
                              </div>
                              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
                                {imgs.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: T.textT }}><Ic n="image" size={13} /> {imgs.length}</span>}
                                {(c.comments || []).length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: T.textT }}><Ic n="comment" size={13} /> {(c.comments || []).length}</span>}
                                {(c.assignees || []).length > 0 && (
                                  <div style={{ display: 'flex' }}>
                                    {(c.assignees || []).slice(0, 3).map((n, i) => (
                                      <Avatar key={n} name={n} photo={photos[n]} size={24} ring={cardBg} ml={i ? -8 : 0} />
                                    ))}
                                    {(c.assignees || []).length > 3 && <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.textT, color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', marginLeft: -8, border: `2px solid ${cardBg}` }}>+{(c.assignees || []).length - 3}</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {dragOver && dragOver.listId === list.id && dragOver.index >= listCards.length && <div style={{ height: 3, borderRadius: 3, background: '#A24CE0', margin: '0 2px' }} />}
                  </div>

                  {/* Adicionar card */}
                  <div style={{ padding: '4px 10px 12px' }}>
                    {composerList === list.id ? (
                      <div>
                        <textarea autoFocus value={composerText} onChange={e => setComposerText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(list.id, composerText); setComposerText(''); } if (e.key === 'Escape') { setComposerList(null); setComposerText(''); } }}
                          placeholder="Título do card…" rows={2}
                          style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${brd}`, background: cardBg, color: T.text, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button className="cs-btn" onClick={() => { addCard(list.id, composerText); setComposerText(''); }} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 9, padding: '7px 14px', fontWeight: 700, fontSize: 12.5 }}>Adicionar</button>
                          <button className="cs-btn cs-ghost" onClick={() => { setComposerList(null); setComposerText(''); }} style={{ background: 'transparent', color: T.textT, borderRadius: 9, padding: '7px 10px', fontWeight: 700, fontSize: 12.5 }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button className="cs-btn cs-ghost" onClick={() => { setComposerList(list.id); setComposerText(''); }} style={{ width: '100%', background: 'transparent', color: T.textT, borderRadius: 10, padding: '9px 11px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="plus" size={15} /> Adicionar card</button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Nova coluna */}
            <div style={{ flex: '0 0 auto', width: 268 }}>
              {addingList ? (
                <div style={{ background: colBg, borderRadius: 16, border: `1px solid ${brd}`, padding: 12 }}>
                  <input autoFocus value={newListText} onChange={e => setNewListText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { addList(newListText); setNewListText(''); setAddingList(false); } if (e.key === 'Escape') setAddingList(false); }}
                    placeholder="Nome da coluna…" style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13, outline: 'none' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="cs-btn" onClick={() => { addList(newListText); setNewListText(''); setAddingList(false); }} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 9, padding: '7px 14px', fontWeight: 700, fontSize: 12.5 }}>Criar</button>
                    <button className="cs-btn cs-ghost" onClick={() => setAddingList(false)} style={{ background: 'transparent', color: T.textT, borderRadius: 9, padding: '7px 10px', fontWeight: 700, fontSize: 12.5 }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="cs-btn" onClick={() => setAddingList(true)} style={{ width: '100%', background: T.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', color: T.text, borderRadius: 16, padding: '13px', fontWeight: 700, fontSize: 13.5, border: `1px dashed ${brd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ic n="plus" size={16} /> Nova coluna</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Toast de notificação ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 60, background: cardBg, border: `1px solid ${brd}`, borderLeft: '4px solid #A24CE0', borderRadius: 14, padding: '12px 16px', boxShadow: '0 12px 34px rgba(120,60,180,.28)', maxWidth: 320, animation: 'csToast .3s ease', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ color: '#A24CE0', marginTop: 1 }}><Ic n="bell" size={18} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: T.text }}>{toast.title}</div>
            <div style={{ fontSize: 12.5, color: T.textS, marginTop: 2 }}>{toast.message}</div>
          </div>
        </div>
      )}

      {/* ── Painel de arquivados ── */}
      {showArchived && (
        <div onClick={() => setShowArchived(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,6,20,.55)', backdropFilter: 'blur(3px)', zIndex: 60, display: 'flex', justifyContent: 'flex-end', animation: 'csFade .2s ease' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: isMobile ? '100%' : 420, maxWidth: '100%', height: '100%', background: T.surface, borderLeft: `1px solid ${brd}`, display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.3)', animation: 'csSlideIn .25s cubic-bezier(.2,1,.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: `1px solid ${brd}` }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surfaceSub || colBg, display: 'grid', placeItems: 'center', color: T.text, border: `1px solid ${brd}` }}><Ic n="archive" size={18} /></div>
              <div style={{ marginRight: 'auto' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>Arquivados</div>
                <div style={{ fontSize: 12, color: T.textT, fontWeight: 600 }}>{archivedCount} {archivedCount === 1 ? 'card' : 'cards'}</div>
              </div>
              <button className="cs-btn cs-ghost" onClick={() => setShowArchived(false)} style={{ background: 'transparent', color: T.textT, width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center' }}><Ic n="x" size={18} /></button>
            </div>
            <div className="cs-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {archivedCount === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: T.textT, fontSize: 13, padding: '30px 20px' }}>
                  <div style={{ opacity: .5, marginBottom: 8 }}><Ic n="archive" size={30} /></div>
                  Nenhum card arquivado.
                </div>
              ) : archivedCards.map(c => {
                const list = lists.find(l => l.id === c.list_id);
                const prev = stripHtml(c.description);
                return (
                  <div key={c.id} className="cs-fade" style={{ background: T.page, border: `1px solid ${brd}`, borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: prev ? 4 : 0 }}>{c.title}</div>
                    {prev && <div style={{ fontSize: 12.5, color: T.textS, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prev}</div>}
                    <div style={{ fontSize: 11, color: T.textT, marginTop: 6, fontWeight: 600 }}>{list ? list.title : 'Sem coluna'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="cs-btn" onClick={() => unarchiveCard(c.id)}
                        style={{ flex: 1, background: UNIKO_GRAD, color: '#fff', borderRadius: 9, padding: '8px 10px', fontWeight: 700, fontSize: 12.5, display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
                        <Ic n="history" size={14} /> Restaurar
                      </button>
                      <button className="cs-btn cs-ghost" onClick={() => { if (window.confirm('Excluir este card de vez? Não dá pra desfazer.')) deleteCard(c.id); }}
                        style={{ background: 'transparent', color: '#E0345A', borderRadius: 9, padding: '8px 12px', fontWeight: 700, fontSize: 12.5, border: `1px solid ${brd}`, display: 'grid', placeItems: 'center' }}>
                        <Ic n="trash" size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Menu de contexto (botão direito no card) ── */}
      {ctxMenu && (() => {
        const cCtx = cards.find(c => c.id === ctxMenu.cardId);
        if (!cCtx) return null;
        const miCtx = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, color: T.text, cursor: 'pointer' };
        const outrasListas = lists.filter(l => l.id !== cCtx.list_id);
        const menuLeft = Math.min(ctxMenu.x, window.innerWidth - 216);
        const menuTop = Math.min(ctxMenu.y, window.innerHeight - 200);
        return (
          <>
            <div onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
            <div style={{ position: 'fixed', left: menuLeft, top: menuTop, zIndex: 91, background: cardBg, border: `1px solid ${brd}`, borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.28)', padding: 6, minWidth: 202, animation: 'csPop .14s ease' }}>
              <div style={{ position: 'relative' }}>
                <button className="cs-mi" onClick={() => setCtxMenu(m => ({ ...m, sub: !m.sub }))} style={miCtx}>
                  <Ic n="board" size={15} /> Mover para <span style={{ marginLeft: 'auto', color: T.textT }}>›</span>
                </button>
                {ctxMenu.sub && (
                  <div className="cs-scroll" style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: cardBg, border: `1px solid ${brd}`, borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.28)', padding: 6, minWidth: 172, maxHeight: 240, overflowY: 'auto' }}>
                    {outrasListas.map(l => (
                      <button key={l.id} className="cs-mi" onClick={() => { moveCardToList(cCtx.id, l.id); setCtxMenu(null); }} style={{ ...miCtx, display: 'block' }}>
                        {l.title}
                      </button>
                    ))}
                    {outrasListas.length === 0 && <div style={{ padding: 10, color: T.textT, fontSize: 12 }}>Sem outra coluna.</div>}
                  </div>
                )}
              </div>
              <button className="cs-mi" onClick={() => { archiveCard(cCtx.id); setCtxMenu(null); }} style={miCtx}>
                <Ic n="archive" size={15} /> Arquivar
              </button>
              <div style={{ height: 1, background: brd, margin: '4px 2px' }} />
              <button className="cs-mi" onClick={() => { if (window.confirm('Excluir este card de vez? Não dá pra desfazer.')) deleteCard(cCtx.id); setCtxMenu(null); }} style={{ ...miCtx, color: '#E0345A' }}>
                <Ic n="trash" size={15} /> Excluir
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Modal do card ── */}
      {selectedCard && (
        <CardModal card={selectedCard} me={me} people={people} onClose={() => setSelectedId(null)}
          lists={lists} onPatch={patchCard} onPatchLog={patchLog} onLog={logHistory}
          onDelete={deleteCard} onArchive={archiveCard} onCopy={copyCard} onComment={appendComment}
          onAddImages={addImages} onRemoveImage={removeImage} isMobile={isMobile} />
      )}
    </div>
  );
}

// ─── Modal de detalhes do card (layout horizontal estilo Trello) ───────────────
function CardModal({ card, me, people, onClose, lists, onPatchLog, onDelete, onArchive, onCopy, onComment, onAddImages, onRemoveImage, isMobile }) {
  const [title, setTitle] = useState(card.title);
  const [comment, setComment] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const abrirEdicaoDesc = () => setEditDesc(true);
  const [fontLevel, setFontLevel] = useState(3);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);
  const descRef = useRef(null);

  useEffect(() => { setTitle(card.title); setEditDesc(false); setShowMenu(false); }, [card.id]); // eslint-disable-line

  // Preenche o innerHTML do editor SÓ no instante em que entra no modo de
  // edição (nunca de novo depois disso). O polling/realtime do quadro
  // atualiza `card` a cada poucos segundos (qualquer mudança em QUALQUER
  // card da sala dispara um reload), e amarrar o innerHTML direto no
  // `card.description` ao vivo (via dangerouslySetInnerHTML) reaplicava o
  // valor antigo do banco por cima do que a pessoa estava digitando — o
  // texto "voltava pro começo" e sumia a edição em andamento. Escrevendo o
  // innerHTML imperativamente aqui, uma única vez por sessão de edição, o
  // <div contentEditable> nunca mais é tocado por fora enquanto `editDesc`
  // continuar true — não depende de nenhuma suposição sobre reconciliação
  // do React pra dangerouslySetInnerHTML.
  useEffect(() => {
    if (editDesc && descRef.current) descRef.current.innerHTML = card.description || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDesc]);

  const images = card.images || [];

  // Envia arquivos de imagem pro Supabase Storage (bucket 'conexao') e anexa ao card.
  const handleFiles = async (fileList) => {
    const files = [...(fileList || [])].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    const out = [];
    for (const f of files) {
      try {
        const ext = ((f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'png';
        const path = `${card.id}/${uid()}.${ext}`;
        const { error } = await sb.storage.from('conexao').upload(path, f, { contentType: f.type || 'image/png', upsert: false });
        if (error) throw error;
        const { data } = sb.storage.from('conexao').getPublicUrl(path);
        out.push({ url: data.publicUrl, path, name: f.name || 'imagem' });
      } catch (e) { console.error('[conexao] upload de imagem falhou:', e); }
    }
    if (out.length) await onAddImages(card.id, out);
    setUploading(false);
  };

  // Colar imagem (Ctrl+V) com o card aberto.
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); handleFiles(files); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const brd = T.border || 'rgba(0,0,0,0.08)';
  const surf = T.surface || '#fff';
  const sub = T.surfaceSub || (T.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)');

  const assignees = card.assignees || [];
  const comments = card.comments || [];
  const history = card.history || [];

  const toggleAssignee = (n) => onPatchLog(card.id,
    { assignees: assignees.includes(n) ? assignees.filter(x => x !== n) : [...assignees, n] },
    assignees.includes(n) ? `removeu ${n} dos membros` : `adicionou ${n} aos membros`);

  // Rich text da descrição (negrito/itálico via execCommand; A+/A− muda o tamanho).
  const exec = (cmd, val) => { if (descRef.current) descRef.current.focus(); document.execCommand(cmd, false, val); };
  const changeFont = (delta) => { const lvl = Math.max(1, Math.min(7, fontLevel + delta)); setFontLevel(lvl); exec('fontSize', String(lvl)); };
  const saveDesc = () => {
    const html = descRef.current ? descRef.current.innerHTML : (card.description || '');
    if (html !== (card.description || '')) onPatchLog(card.id, { description: html }, 'alterou a descrição');
    setEditDesc(false);
  };

  // Feed da direita = comentários + histórico juntos, do mais antigo pro mais novo.
  const feed = [
    ...comments.map(c => ({ kind: 'comment', at: c.at, author: c.author, text: c.text, id: 'c' + c.id })),
    ...history.map(h => ({ kind: 'history', at: h.at, author: h.who, text: h.text, id: 'h' + h.id })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  const listTitle = lists.find(l => l.id === card.list_id)?.title || '—';

  const miStyle = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, color: T.text, cursor: 'pointer' };
  const tbStyle = { background: 'transparent', color: T.text, borderRadius: 7, minWidth: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', border: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,8,30,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20, animation: 'csFade .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: isMobile ? '100%' : 950, maxWidth: '100%', maxHeight: isMobile ? '100%' : '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: surf, color: T.text, borderRadius: isMobile ? 0 : 18, border: `1px solid ${brd}`, boxShadow: '0 30px 80px rgba(80,20,120,.4)', animation: 'csPop .24s cubic-bezier(.2,1.25,.35,1)' }}>
        <div style={{ height: 6, background: UNIKO_GRAD, flexShrink: 0 }} />

        {/* HEADER: coluna · três-pontos · fechar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${brd}`, flexShrink: 0 }}>
          <select value={card.list_id} onChange={e => onPatchLog(card.id, { list_id: e.target.value }, `moveu para "${lists.find(l => l.id === e.target.value)?.title || ''}"`)}
            style={{ padding: '7px 11px', borderRadius: 9, border: `1px solid ${brd}`, background: sub, color: T.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', maxWidth: '55%' }}>
            {lists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <button className="cs-btn cs-ghost" title="Mais opções" onClick={() => setShowMenu(s => !s)}
              style={{ background: sub, color: T.text, borderRadius: 10, width: 34, height: 34, display: 'grid', placeItems: 'center' }}><Ic n="dots" size={18} /></button>
            {showMenu && (
              <>
                <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />
                <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 5, background: surf, border: `1px solid ${brd}`, borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.22)', padding: 6, minWidth: 176, animation: 'csPop .16s ease' }}>
                  <button className="cs-mi" onClick={() => { setShowMenu(false); onCopy(card.id); }} style={miStyle}><Ic n="copy" size={15} /> Copiar card</button>
                  <button className="cs-mi" onClick={() => { setShowMenu(false); onArchive(card.id); }} style={miStyle}><Ic n="archive" size={15} /> Arquivar</button>
                  <div style={{ height: 1, background: brd, margin: '4px 2px' }} />
                  <button className="cs-mi" onClick={() => { setShowMenu(false); onDelete(card.id); }} style={{ ...miStyle, color: '#E0345A' }}><Ic n="trash" size={15} /> Excluir</button>
                </div>
              </>
            )}
          </div>
          <button className="cs-btn cs-ghost" onClick={onClose} style={{ background: sub, color: T.text, borderRadius: 10, width: 34, height: 34, display: 'grid', placeItems: 'center' }}><Ic n="x" size={16} /></button>
        </div>

        {/* BODY: 2 colunas (esquerda = detalhes · direita = atividade) */}
        <div className="cs-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* ── ESQUERDA ── */}
          <div style={{ flex: '1.7 1 0', minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? 'none' : `1px solid ${brd}` }}>
            <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && title !== card.title && onPatchLog(card.id, { title: title.trim() }, 'alterou o título')}
              style={{ width: '100%', fontSize: 23, fontWeight: 800, fontFamily: 'var(--font-brand)', color: T.text, background: 'transparent', border: 'none', outline: 'none' }} />
            <div style={{ fontSize: 12, color: T.textT, marginTop: 4, marginBottom: 20 }}>em <b style={{ color: T.textS }}>{listTitle}</b> · criado por {card.created_by || '—'}</div>

            {/* Membros */}
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, marginBottom: 8, letterSpacing: '.04em' }}>MEMBROS</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {assignees.map(n => (
                <span key={n} onClick={() => toggleAssignee(n)} className="cs-chip" style={{ display: 'flex', alignItems: 'center', gap: 6, background: sub, borderRadius: 20, padding: '4px 10px 4px 4px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor(n), color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{initials(n)}</span>
                  {n} <span style={{ color: T.textT, display: 'grid', placeItems: 'center' }}><Ic n="x" size={12} /></span>
                </span>
              ))}
              <button className="cs-btn" onClick={() => setShowAssign(s => !s)} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 20, padding: '7px 14px', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5 }}><Ic n="plus" size={13} /> Membro</button>
            </div>
            {showAssign && (
              <div className="cs-scroll" style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto', border: `1px solid ${brd}`, borderRadius: 10, background: T.page }}>
                {people.filter(p => !assignees.includes(p)).map(p => (
                  <div key={p} onClick={() => toggleAssignee(p)} className="cs-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor(p), color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{initials(p)}</span>{p}
                  </div>
                ))}
                {people.filter(p => !assignees.includes(p)).length === 0 && <div style={{ padding: 12, color: T.textT, fontSize: 12 }}>Todos já são membros.</div>}
              </div>
            )}

            {/* Descrição (rich text, grande) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '24px 0 10px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Descrição</div>
              {!editDesc && <button className="cs-btn cs-ghost" onClick={abrirEdicaoDesc} style={{ background: sub, color: T.text, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Ic n="edit" size={13} /> Editar</button>}
            </div>
            {editDesc ? (
              <div style={{ border: `1px solid ${brd}`, borderRadius: 12, overflow: 'hidden', background: T.page }}>
                <div style={{ display: 'flex', gap: 3, padding: 6, borderBottom: `1px solid ${brd}`, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="cs-tb" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} title="Negrito" style={tbStyle}><Ic n="bold" size={15} /></button>
                  <button className="cs-tb" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} title="Itálico" style={tbStyle}><Ic n="italic" size={15} /></button>
                  <div style={{ width: 1, height: 20, background: brd, margin: '0 5px' }} />
                  <button className="cs-tb" onMouseDown={e => e.preventDefault()} onClick={() => changeFont(-1)} title="Diminuir letra" style={{ ...tbStyle, fontSize: 12, fontWeight: 800 }}>A−</button>
                  <button className="cs-tb" onMouseDown={e => e.preventDefault()} onClick={() => changeFont(1)} title="Aumentar letra" style={{ ...tbStyle, fontSize: 16, fontWeight: 800 }}>A+</button>
                </div>
                <div ref={descRef} contentEditable suppressContentEditableWarning
                  style={{ minHeight: 170, maxHeight: 320, overflowY: 'auto', padding: '14px 16px', fontSize: 15.5, lineHeight: 1.6, color: T.text, outline: 'none', wordBreak: 'break-word' }} />
                <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${brd}` }}>
                  <button className="cs-btn" onClick={saveDesc} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 9, padding: '8px 18px', fontWeight: 700, fontSize: 13 }}>Salvar</button>
                  <button className="cs-btn cs-ghost" onClick={() => setEditDesc(false)} style={{ background: 'transparent', color: T.textT, borderRadius: 9, padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>Cancelar</button>
                </div>
              </div>
            ) : (stripHtml(card.description) ? (
              <div onClick={abrirEdicaoDesc} className="cs-desc" dangerouslySetInnerHTML={{ __html: card.description }}
                style={{ fontSize: 15.5, lineHeight: 1.65, color: T.textS, cursor: 'text', padding: '2px', wordBreak: 'break-word' }} />
            ) : (
              <div onClick={abrirEdicaoDesc} style={{ fontSize: 13.5, color: T.textT, cursor: 'text', padding: '16px', background: T.page, borderRadius: 12, border: `1px dashed ${brd}` }}>Adicione uma descrição mais detalhada…</div>
            ))}

            {/* Imagens */}
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, margin: '24px 0 10px' }}>Imagens{images.length ? ` · ${images.length}` : ''}</div>
            <div
              onDragOver={e => { e.preventDefault(); if (!dragActive) setDragActive(true); }}
              onDragLeave={e => { if (e.currentTarget === e.target) setDragActive(false); }}
              onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragActive ? '#A24CE0' : brd}`, background: dragActive ? 'rgba(162,76,224,.08)' : T.page, borderRadius: 12, padding: '16px 14px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
              <div style={{ color: dragActive ? '#A24CE0' : T.textT, display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Ic n="upload" size={22} /></div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.textS }}>{uploading ? 'Enviando…' : 'Arraste imagens, cole (Ctrl+V) ou clique'}</div>
              <div style={{ fontSize: 11, color: T.textT, marginTop: 2 }}>PNG, JPG, GIF, WEBP</div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
            </div>
            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8, marginTop: 10 }}>
                {images.map(img => (
                  <div key={img.path} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${brd}`, aspectRatio: '1', background: sub }}>
                    <img src={img.url} alt={img.name} onClick={() => setLightbox(img.url)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
                    <button className="cs-btn" onClick={() => onRemoveImage(card.id, img)} title="Remover" style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 8, background: 'rgba(20,8,30,.7)', color: '#fff', display: 'grid', placeItems: 'center' }}><Ic n="x" size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── DIREITA: comentários e atividade (histórico) ── */}
          <div style={{ flex: '1 1 0', minWidth: isMobile ? 0 : 300, padding: isMobile ? 16 : 20, background: T.dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.018)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, marginBottom: 12 }}><Ic n="comment" size={16} /> Comentários e atividade</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { onComment(card.id, comment); setComment(''); } }}
                placeholder={`Comentar como ${me.split(' ')[0]}…`} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: surf, color: T.text, fontSize: 13, outline: 'none' }} />
              <button className="cs-btn" onClick={() => { if (comment.trim()) { onComment(card.id, comment); setComment(''); } }} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 12.5 }}>Enviar</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[...feed].reverse().map(f => (
                <div key={f.id} className="cs-fade" style={{ display: 'flex', gap: 9 }}>
                  <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: avatarColor(f.author), color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{initials(f.author)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {f.kind === 'comment' ? (
                      <div style={{ background: surf, border: `1px solid ${brd}`, borderRadius: 12, padding: '8px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{f.author} <span style={{ color: T.textT, fontWeight: 500 }}>· {timeAgo(f.at)}</span></div>
                        <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{f.text}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: T.textS, paddingTop: 5, lineHeight: 1.4 }}>
                        <b style={{ color: T.text }}>{f.author}</b> {f.text} <span style={{ color: T.textT }}>· {timeAgo(f.at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {feed.length === 0 && <div style={{ fontSize: 12.5, color: T.textT }}>Sem atividade ainda.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox da imagem */}
      {lightbox && (
        <div onClick={e => { e.stopPropagation(); setLightbox(null); }} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(10,4,16,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
        </div>
      )}
    </div>
  );
}
