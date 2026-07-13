// src/modules/conexao-setorial/index.jsx
// Conexão Setorial — quadro Kanban (estilo Trello) do time do Financeiro.
// Substitui o antigo chat estilo WhatsApp. Real e compartilhado (Supabase +
// realtime), com arrastar-e-soltar, prazos, responsáveis, etiquetas, checklists,
// comentários e notificação desktop + som. Estética Uniko (rosa/roxo). Admin-only
// (o gate fica no App.jsx). Precisa rodar supabase_conexao_setorial_trello.sql.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { T } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SERVER_URL, supabase as sb, getAuthUser } from '../../contexts/user';
import { notifyDesktop, ensureNotifyPermission } from '../../utils/desktopNotify';

// ─── Constantes ───────────────────────────────────────────────────────────────
const UNIKO_GRAD = 'linear-gradient(135deg,#E0559A 0%,#A24CE0 100%)';

const LABELS = [
  { id: 'urgente',     name: 'Urgente',     color: '#E0345A' },
  { id: 'faturamento', name: 'Faturamento', color: '#2560C4' },
  { id: 'financeiro',  name: 'Financeiro',  color: '#16A085' },
  { id: 'cobranca',    name: 'Cobrança',    color: '#C0392B' },
  { id: 'rh',          name: 'RH',          color: '#E67E22' },
  { id: 'ti',          name: 'TI',          color: '#8E44AD' },
  { id: 'suporte',     name: 'Suporte',     color: '#27AE60' },
  { id: 'aguardando',  name: 'Aguardando',  color: '#7F8C8D' },
];
const LABEL_BY_ID = Object.fromEntries(LABELS.map(l => [l.id, l]));

const PRIORITIES = [
  { id: 'baixa',   name: 'Baixa',   color: '#7F8C8D' },
  { id: 'media',   name: 'Média',   color: '#2560C4' },
  { id: 'alta',    name: 'Alta',    color: '#E67E22' },
  { id: 'urgente', name: 'Urgente', color: '#E0345A' },
];
const PRIO_BY_ID = Object.fromEntries(PRIORITIES.map(p => [p.id, p]));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const nowIso = () => new Date().toISOString();

const initials = (name) => (name || '?').trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
const avatarColor = (name) => {
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 52%)`;
};

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

// ─── Componente ───────────────────────────────────────────────────────────────
export default function ConexaoSetorial({ onBack, authUser }) {
  const isMobile = useIsMobile();
  const me = authUser?.name || getAuthUser()?.name || 'Colaborador';

  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);        // nomes dos colegas (responsáveis)
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
  const [filterAssignee, setFilterAssignee] = useState(null);
  const [filterLabel, setFilterLabel] = useState(null);

  // notificações
  const [notifOn, setNotifOn] = useState(() => localStorage.getItem('cs_notif') !== '0');
  const [toast, setToast] = useState(null);

  // drag & drop
  const [drag, setDrag] = useState(null);           // { cardId, fromList }
  const [dragOver, setDragOver] = useState(null);    // { listId, index }

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
    const [{ data: ls }, { data: cs }] = await Promise.all([
      sb.from('conexao_lists').select('*').order('position', { ascending: true }),
      sb.from('conexao_cards').select('*').order('position', { ascending: true }),
    ]);
    const listsArr = ls || [], cardsArr = cs || [];
    setLists(listsArr); setCards(cardsArr); setLoading(false);

    // diff p/ notificar (pula na 1ª carga)
    const me2 = meRef.current;
    const prev = prevCardsRef.current;
    if (!firstLoadRef.current && prev) {
      for (const c of cardsArr) {
        const p = prev[c.id];
        const meIn = (c.assignees || []).includes(me2);
        const meWas = p ? (p.assignees || []).includes(me2) : false;
        if (meIn && !meWas) fireNotif('📌 Novo card pra você', c.title);
        const nc = (c.comments || []).length, pc = p ? (p.comments || []).length : nc;
        if (nc > pc && (meIn || c.created_by === me2)) {
          const last = c.comments[nc - 1];
          if (last && last.author !== me2) fireNotif('💬 ' + last.author, `${c.title}: ${last.text}`);
        }
      }
    }
    prevCardsRef.current = Object.fromEntries(cardsArr.map(c => [c.id, c]));
    firstLoadRef.current = false;
  }, [fireNotif]);

  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 300);
  }, [load]);

  // ── Boot: carrega, realtime, poll, colegas ──────────────────
  useEffect(() => {
    load();
    const ch = sb.channel('conexao-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conexao_cards' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conexao_lists' }, scheduleReload)
      .subscribe();
    const poll = setInterval(load, 20000);
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
    return () => { sb.removeChannel(ch); clearInterval(poll); clearTimeout(reloadTimer.current); };
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
        fireNotif(state === 'over' ? '⏰ Card atrasado' : '⏳ Card vencendo em 24h', c.title);
      }
    };
    const id = setInterval(scan, 60000);
    const t = setTimeout(scan, 4000);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [fireNotif]);

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

  // append seguro em jsonb (relê a linha p/ não perder edição concorrente)
  const appendComment = async (id, text) => {
    const t = text.trim(); if (!t) return;
    const { data } = await sb.from('conexao_cards').select('comments').eq('id', id).single();
    const comments = [...(data?.comments || []), { id: uid(), author: me, text: t, at: nowIso() }];
    await patchCard(id, { comments });
  };

  const addList = async (title) => {
    const t = title.trim(); if (!t) return;
    const pos = lists.length ? Math.max(...lists.map(l => l.position)) + 1000 : 1000;
    await sb.from('conexao_lists').insert({ title: t, position: pos });
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

  // ── Filtro ──────────────────────────────────────────────────
  const passesFilter = (c) => {
    if (filterText && !(`${c.title} ${c.description}`.toLowerCase().includes(filterText.toLowerCase()))) return false;
    if (filterAssignee && !(c.assignees || []).includes(filterAssignee)) return false;
    if (filterLabel && !(c.labels || []).includes(filterLabel)) return false;
    return true;
  };
  const filterActive = filterText || filterAssignee || filterLabel;

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

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.page, color: T.text, fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes csPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes csToast{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
        .cs-scroll::-webkit-scrollbar{height:10px;width:10px}
        .cs-card{transition:transform .12s, box-shadow .12s, border-color .12s}
        .cs-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(120,60,180,.18)}
        .cs-btn{cursor:pointer;border:none;font-family:inherit;transition:filter .15s, background .15s}
        .cs-btn:hover{filter:brightness(1.08)}
        .cs-ghost:hover{background:${T.itemHover || 'rgba(120,60,180,.08)'}}
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 14px' : '14px 22px', borderBottom: `1px solid ${brd}`, background: T.topbarBg || T.surface, backdropFilter: 'blur(12px)', flexWrap: 'wrap' }}>
        <button className="cs-btn cs-ghost" onClick={onBack} style={{ background: 'transparent', color: T.text, fontSize: 20, width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center' }}>←</button>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: UNIKO_GRAD, display: 'grid', placeItems: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(160,60,190,.4)' }}>🗂️</div>
        <div style={{ marginRight: 'auto' }}>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 16 : 19, fontFamily: 'var(--font-brand)', background: UNIKO_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '.01em' }}>Conexão Setorial</div>
          <div style={{ fontSize: 11.5, color: T.textT, fontWeight: 600 }}>Quadro do Financeiro · {cards.length} cards · {lists.length} colunas</div>
        </div>
        <button className="cs-btn" onClick={() => setShowFilters(s => !s)} title="Filtros"
          style={{ background: filterActive ? UNIKO_GRAD : (T.surfaceSub || colBg), color: filterActive ? '#fff' : T.text, borderRadius: 12, padding: '8px 14px', fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', border: `1px solid ${brd}` }}>
          🔍 {filterActive ? 'Filtrando' : 'Filtrar'}
        </button>
        <button className="cs-btn" onClick={toggleNotif} title="Notificações desktop + som"
          style={{ background: notifOn ? UNIKO_GRAD : (T.surfaceSub || colBg), color: notifOn ? '#fff' : T.textT, borderRadius: 12, padding: '8px 12px', fontWeight: 700, fontSize: 14, border: `1px solid ${brd}` }}>
          {notifOn ? '🔔' : '🔕'}
        </button>
      </div>

      {/* ── Barra de filtros ── */}
      {showFilters && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '10px 22px', borderBottom: `1px solid ${brd}`, background: T.surface, animation: 'csPop .2s ease' }}>
          <input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Buscar título/descrição…"
            style={{ flex: '1 1 220px', minWidth: 160, padding: '9px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13, outline: 'none' }} />
          <select value={filterAssignee || ''} onChange={e => setFilterAssignee(e.target.value || null)}
            style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13 }}>
            <option value="">Todos responsáveis</option>
            {people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LABELS.map(l => (
              <button key={l.id} className="cs-btn" onClick={() => setFilterLabel(filterLabel === l.id ? null : l.id)}
                style={{ background: filterLabel === l.id ? l.color : `${l.color}22`, color: filterLabel === l.id ? '#fff' : l.color, borderRadius: 20, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, border: `1px solid ${l.color}55` }}>{l.name}</button>
            ))}
          </div>
          {filterActive && <button className="cs-btn cs-ghost" onClick={() => { setFilterText(''); setFilterAssignee(null); setFilterLabel(null); }} style={{ background: 'transparent', color: T.textT, fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8 }}>Limpar ✕</button>}
        </div>
      )}

      {/* ── Board ── */}
      <div className="cs-scroll" style={{ flex: 1, display: 'flex', gap: 16, padding: 18, overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start' }}>
        {loading ? (
          <div style={{ margin: 'auto', color: T.textT, fontWeight: 600 }}>Carregando quadro…</div>
        ) : (
          <>
            {lists.map(list => {
              const listCards = cards.filter(c => c.list_id === list.id && passesFilter(c)).sort((a, b) => a.position - b.position);
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
                    <button className="cs-btn cs-ghost" onClick={() => deleteList(list.id)} title="Excluir coluna" style={{ background: 'transparent', color: T.textT, borderRadius: 8, width: 26, height: 26 }}>✕</button>
                  </div>

                  {/* Cards */}
                  <div className="cs-scroll" style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 8px', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 8 }}>
                    {listCards.map((c, idx) => {
                      const di = dueInfo(c.due_date);
                      const done = (c.checklist || []).filter(i => i.done).length;
                      const total = (c.checklist || []).length;
                      const prio = c.priority ? PRIO_BY_ID[c.priority] : null;
                      const showLine = dragOver && dragOver.listId === list.id && dragOver.index === idx;
                      return (
                        <React.Fragment key={c.id}>
                          {showLine && <div style={{ height: 3, borderRadius: 3, background: '#A24CE0', margin: '-3px 2px 0' }} />}
                          <div className="cs-card" draggable
                            onDragStart={() => setDrag({ cardId: c.id, fromList: list.id })}
                            onDragEnd={() => { setDrag(null); setDragOver(null); }}
                            onDragOver={e => { if (drag) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const before = e.clientY < r.top + r.height / 2; const index = before ? idx : idx + 1; if (!dragOver || dragOver.listId !== list.id || dragOver.index !== index) setDragOver({ listId: list.id, index }); } }}
                            onClick={() => setSelectedId(c.id)}
                            style={{ background: cardBg, borderRadius: 12, border: `1px solid ${brd}`, borderLeft: prio ? `4px solid ${prio.color}` : `1px solid ${brd}`, padding: '10px 12px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
                            {(c.labels || []).length > 0 && (
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
                                {(c.labels || []).map(id => LABEL_BY_ID[id] && (
                                  <span key={id} style={{ background: LABEL_BY_ID[id].color, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>{LABEL_BY_ID[id].name}</span>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: T.text }}>{c.title}</div>
                            {(di || total > 0 || (c.comments || []).length > 0 || (c.assignees || []).length > 0) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                                {di && <span style={{ fontSize: 11, fontWeight: 700, color: di.color, background: `${di.color}1e`, borderRadius: 6, padding: '2px 7px' }}>⏰ {di.label}</span>}
                                {total > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: done === total ? '#27AE60' : T.textT }}>☑ {done}/{total}</span>}
                                {(c.comments || []).length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: T.textT }}>💬 {(c.comments || []).length}</span>}
                                <div style={{ marginLeft: 'auto', display: 'flex' }}>
                                  {(c.assignees || []).slice(0, 3).map((n, i) => (
                                    <div key={n} title={n} style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor(n), color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', marginLeft: i ? -7 : 0, border: `2px solid ${cardBg}` }}>{initials(n)}</div>
                                  ))}
                                  {(c.assignees || []).length > 3 && <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.textT, color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', marginLeft: -7, border: `2px solid ${cardBg}` }}>+{(c.assignees || []).length - 3}</div>}
                                </div>
                              </div>
                            )}
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
                      <button className="cs-btn cs-ghost" onClick={() => { setComposerList(list.id); setComposerText(''); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: T.textT, borderRadius: 10, padding: '9px 11px', fontWeight: 700, fontSize: 13 }}>＋ Adicionar card</button>
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
                <button className="cs-btn" onClick={() => setAddingList(true)} style={{ width: '100%', background: T.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', color: T.text, borderRadius: 16, padding: '13px', fontWeight: 700, fontSize: 13.5, border: `1px dashed ${brd}` }}>＋ Nova coluna</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Toast de notificação ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 60, background: cardBg, border: `1px solid ${brd}`, borderLeft: '4px solid #A24CE0', borderRadius: 14, padding: '12px 16px', boxShadow: '0 12px 34px rgba(120,60,180,.28)', maxWidth: 320, animation: 'csToast .3s ease' }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: T.text }}>{toast.title}</div>
          <div style={{ fontSize: 12.5, color: T.textS, marginTop: 2 }}>{toast.message}</div>
        </div>
      )}

      {/* ── Modal do card ── */}
      {selectedCard && (
        <CardModal card={selectedCard} me={me} people={people} onClose={() => setSelectedId(null)}
          lists={lists} onPatch={patchCard} onDelete={deleteCard} onComment={appendComment} isMobile={isMobile} />
      )}
    </div>
  );
}

// Seção rotulada dentro do modal (escopo de módulo p/ não recriar componente a cada render).
const Section = ({ title, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: T.textT, marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

// ─── Modal de detalhes do card ─────────────────────────────────────────────────
function CardModal({ card, me, people, onClose, lists, onPatch, onDelete, onComment, isMobile }) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description || '');
  const [comment, setComment] = useState('');
  const [checkText, setCheckText] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  useEffect(() => { setTitle(card.title); }, [card.id]); // eslint-disable-line
  useEffect(() => { setDesc(card.description || ''); }, [card.id]); // eslint-disable-line

  const brd = T.border || 'rgba(0,0,0,0.08)';
  const surf = T.surface || '#fff';
  const sub = T.surfaceSub || (T.dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)');

  const labels = card.labels || [];
  const assignees = card.assignees || [];
  const checklist = card.checklist || [];
  const comments = card.comments || [];
  const doneCount = checklist.filter(i => i.done).length;

  const toggleLabel = (id) => onPatch(card.id, { labels: labels.includes(id) ? labels.filter(x => x !== id) : [...labels, id] });
  const setPriority = (id) => onPatch(card.id, { priority: card.priority === id ? null : id });
  const toggleAssignee = (n) => onPatch(card.id, { assignees: assignees.includes(n) ? assignees.filter(x => x !== n) : [...assignees, n] });
  const addCheck = () => { const t = checkText.trim(); if (!t) return; onPatch(card.id, { checklist: [...checklist, { id: uid(), text: t, done: false }] }); setCheckText(''); };
  const toggleCheck = (id) => onPatch(card.id, { checklist: checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  const delCheck = (id) => onPatch(card.id, { checklist: checklist.filter(i => i.id !== id) });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,8,30,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} className="cs-scroll" style={{ width: isMobile ? '100%' : 640, maxWidth: '100%', maxHeight: isMobile ? '100%' : '90vh', overflowY: 'auto', background: surf, color: T.text, borderRadius: isMobile ? 0 : 18, border: `1px solid ${brd}`, boxShadow: '0 30px 80px rgba(80,20,120,.4)', animation: 'csPop .2s ease' }}>
        {/* Faixa Uniko */}
        <div style={{ height: 6, background: UNIKO_GRAD }} />
        <div style={{ padding: isMobile ? 18 : 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && title !== card.title && onPatch(card.id, { title: title.trim() })}
              style={{ flex: 1, fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-brand)', color: T.text, background: 'transparent', border: 'none', outline: 'none', borderBottom: `2px solid transparent` }} />
            <button className="cs-btn cs-ghost" onClick={onClose} style={{ background: sub, color: T.text, borderRadius: 10, width: 34, height: 34, fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: T.textT, marginTop: 4, marginBottom: 20 }}>
            em <b style={{ color: T.textS }}>{lists.find(l => l.id === card.list_id)?.title || '—'}</b> · criado por {card.created_by || '—'}
          </div>

          {/* Mover / Prazo / Prioridade */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, marginBottom: 5 }}>COLUNA</div>
              <select value={card.list_id} onChange={e => onPatch(card.id, { list_id: e.target.value })} style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13, fontWeight: 600 }}>
                {lists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, marginBottom: 5 }}>PRAZO</div>
              <input type="datetime-local" value={toLocalInput(card.due_date)} onChange={e => onPatch(card.id, { due_date: fromLocalInput(e.target.value) })}
                style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13 }} />
            </div>
          </div>

          {/* Prioridade */}
          <Section title="Prioridade">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {PRIORITIES.map(p => (
                <button key={p.id} className="cs-btn" onClick={() => setPriority(p.id)}
                  style={{ background: card.priority === p.id ? p.color : `${p.color}1e`, color: card.priority === p.id ? '#fff' : p.color, borderRadius: 9, padding: '7px 13px', fontWeight: 700, fontSize: 12.5, border: `1px solid ${p.color}55` }}>{p.name}</button>
              ))}
            </div>
          </Section>

          {/* Etiquetas */}
          <Section title="Etiquetas">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {LABELS.map(l => (
                <button key={l.id} className="cs-btn" onClick={() => toggleLabel(l.id)}
                  style={{ background: labels.includes(l.id) ? l.color : `${l.color}1e`, color: labels.includes(l.id) ? '#fff' : l.color, borderRadius: 9, padding: '7px 13px', fontWeight: 700, fontSize: 12.5, border: `1px solid ${l.color}55` }}>
                  {labels.includes(l.id) ? '✓ ' : ''}{l.name}
                </button>
              ))}
            </div>
          </Section>

          {/* Responsáveis */}
          <Section title="Responsáveis">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {assignees.map(n => (
                <span key={n} onClick={() => toggleAssignee(n)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: sub, borderRadius: 20, padding: '4px 10px 4px 4px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(n), color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{initials(n)}</span>
                  {n} <span style={{ color: T.textT }}>✕</span>
                </span>
              ))}
              <button className="cs-btn" onClick={() => setShowAssign(s => !s)} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 20, padding: '6px 13px', fontWeight: 700, fontSize: 12.5 }}>＋ Atribuir</button>
            </div>
            {showAssign && (
              <div className="cs-scroll" style={{ marginTop: 10, maxHeight: 190, overflowY: 'auto', border: `1px solid ${brd}`, borderRadius: 10, background: T.page }}>
                {people.filter(p => !assignees.includes(p)).map(p => (
                  <div key={p} onClick={() => { toggleAssignee(p); }} className="cs-ghost" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor(p), color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{initials(p)}</span>{p}
                  </div>
                ))}
                {people.filter(p => !assignees.includes(p)).length === 0 && <div style={{ padding: 12, color: T.textT, fontSize: 12 }}>Todos já atribuídos.</div>}
              </div>
            )}
          </Section>

          {/* Descrição */}
          <Section title="Descrição">
            <textarea value={desc} onChange={e => setDesc(e.target.value)} onBlur={() => desc !== (card.description || '') && onPatch(card.id, { description: desc })}
              placeholder="Detalhes da tarefa…" rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13.5, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </Section>

          {/* Checklist */}
          <Section title={`Checklist${checklist.length ? ` · ${doneCount}/${checklist.length}` : ''}`}>
            {checklist.length > 0 && (
              <div style={{ height: 6, borderRadius: 4, background: sub, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%`, background: UNIKO_GRAD, transition: 'width .3s' }} />
              </div>
            )}
            {checklist.map(i => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
                <input type="checkbox" checked={i.done} onChange={() => toggleCheck(i.id)} style={{ width: 17, height: 17, accentColor: '#A24CE0', cursor: 'pointer' }} />
                <span style={{ flex: 1, fontSize: 13.5, textDecoration: i.done ? 'line-through' : 'none', color: i.done ? T.textT : T.text }}>{i.text}</span>
                <button className="cs-btn cs-ghost" onClick={() => delCheck(i.id)} style={{ background: 'transparent', color: T.textT, borderRadius: 6, width: 24, height: 24, fontSize: 12 }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={checkText} onChange={e => setCheckText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheck()} placeholder="Adicionar item…"
                style={{ flex: 1, padding: '8px 11px', borderRadius: 9, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13, outline: 'none' }} />
              <button className="cs-btn" onClick={addCheck} style={{ background: sub, color: T.text, borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>＋</button>
            </div>
          </Section>

          {/* Comentários */}
          <Section title={`Comentários${comments.length ? ` · ${comments.length}` : ''}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {comments.map(cm => (
                <div key={cm.id} style={{ display: 'flex', gap: 9 }}>
                  <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: avatarColor(cm.author), color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{initials(cm.author)}</div>
                  <div style={{ flex: 1, background: sub, borderRadius: 12, padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{cm.author} <span style={{ color: T.textT, fontWeight: 500 }}>· {new Date(cm.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                    <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.45 }}>{cm.text}</div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <div style={{ fontSize: 12.5, color: T.textT }}>Sem comentários ainda.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { onComment(card.id, comment); setComment(''); } }}
                placeholder={`Comentar como ${me.split(' ')[0]}…`} style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid ${brd}`, background: T.page, color: T.text, fontSize: 13, outline: 'none' }} />
              <button className="cs-btn" onClick={() => { if (comment.trim()) { onComment(card.id, comment); setComment(''); } }} style={{ background: UNIKO_GRAD, color: '#fff', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13 }}>Enviar</button>
            </div>
          </Section>

          {/* Excluir */}
          <div style={{ borderTop: `1px solid ${brd}`, paddingTop: 14, marginTop: 4 }}>
            <button className="cs-btn" onClick={() => onDelete(card.id)} style={{ background: '#E0345A18', color: '#E0345A', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, border: '1px solid #E0345A44' }}>🗑 Excluir card</button>
          </div>
        </div>
      </div>
    </div>
  );
}
