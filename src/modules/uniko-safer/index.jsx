// src/modules/uniko-safer/index.jsx
// Uniko Safer — organizador de conversas exportadas do WhatsApp: cadastro de
// contatos, importação manual (ou em massa) de .txt/.zip exportados e
// histórico por contato, virando um visualizador estilo WhatsApp.
// Importação automática (22/set/2026): um servidor Playwright dedicado na
// VPS (`crescent-hub-server/whatsappSafer.js`) mantém uma sessão logada no
// WhatsApp Web e faz a exportação sozinho, contato por contato — este
// arquivo só dispara o job, acompanha o progresso e importa cada arquivo
// pronto pelo MESMO caminho (`importOneFile`) do import manual/em massa.
import { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';
import { getAuthUser, SERVER_URL } from '../../contexts/user';
import { supabase } from './saferSupabase';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  parseWhatsappTxt, parseWhatsappMessages, hashMessage,
  sniffFileType, readChatText, deriveContactNameFromFilename, sanitizeStorageName,
} from './parseWhatsapp';

const MESSAGE_UPSERT_CHUNK = 500;

const BUCKET = 'uniko-safer';

const initials = (name) => (name || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
const formatTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const formatDayLabel = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); };
const formatDateShort = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); };
const dayKey = (iso) => iso.slice(0, 10);

// Recorta um trecho em volta da primeira ocorrência do termo (pra não jogar
// a mensagem inteira na lista de resultados, igual a busca global do
// WhatsApp mostra só o pedaço relevante).
const snippetAround = (text, q, radius = 42) => {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, 90);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
};

const highlightMatch = (text, q) => {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: T.goldGl, color: T.gold, borderRadius: 3, padding: '0 1px' }}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
};

const IcoBack = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
);
const IcoPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
const IcoTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
);
const IcoEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
);
const IcoImport = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
const IcoClose = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const IcoCheck = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const IcoWarn = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="8" x2="12" y2="13" /><circle cx="12" cy="16.3" r="0.9" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="9" /></svg>
);
const IcoDots = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
);
const IcoAuto = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
);
const IcoSelect = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
);
const IcoSort = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h6M3 12h4M3 17h2" /><path d="M17 4v16M17 4l4 4M17 4l-4 4" /></svg>
);
const IcoTag = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 12.3L12.7 20.2a2 2 0 01-2.8 0l-6-6a2 2 0 010-2.8l7.9-7.9A2 2 0 0113.3 3H19a2 2 0 012 2v5.7a2 2 0 01-.4 1.6z" /><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" /></svg>
);

// Dois setores usando o mesmo Uniko Safer, cada um com seus próprios
// contatos — abas dentro do módulo (não módulos separados no seletor
// principal). Contato antigo sem categoria (coluna nova) cai em
// 'faturamento' por padrão — era o que já estava sincronizado.
const CATEGORIES = [
  { id: 'faturamento', label: 'Faturamento' },
  { id: 'financeiro', label: 'Financeiro' },
];

// Paleta curada pras etiquetas — em vez de um seletor de cor livre, mantém
// visual consistente com o resto do Portal.
const TAG_COLORS = ['#d4a017', '#e0533d', '#3ba55c', '#4a90d9', '#9b59b6', '#e8935a', '#5bb8a8', '#c65da0'];

const btnStyle = (variant) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', border: '1px solid transparent', whiteSpace: 'nowrap' };
  if (variant === 'primary') return { ...base, background: T.gold, color: '#fff' };
  if (variant === 'danger') return { ...base, background: 'transparent', color: T.danger, border: `1px solid ${T.dangerGl ? T.danger + '55' : T.border}` };
  return { ...base, background: T.surfaceSub || 'rgba(0,0,0,0.04)', color: T.textS, border: `1px solid ${T.border}` };
};

const UnikoSafer = ({ onBack }) => {
  const isMobile = useIsMobile();
  const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [activeCategory, setActiveCategory] = useState('faturamento');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('asc'); // 'asc' (A→Z) | 'desc' (Z→A)
  const [tags, setTags] = useState([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [tagContextMenu, setTagContextMenu] = useState(null); // {contactId, x, y}
  const [messageResults, setMessageResults] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const messageSearchTimer = useRef(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [currentChatMessages, setCurrentChatMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [contactModal, setContactModal] = useState(null); // {mode, id, name, phone, notes}
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState('choose'); // 'choose' (confirma + escolhe setor) | 'drop' (solta os arquivos)
  const [bulkCategory, setBulkCategory] = useState('faturamento');
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrentFile, setBulkCurrentFile] = useState(null);
  const [bulkLog, setBulkLog] = useState([]);
  const [importingContact, setImportingContact] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);

  // ── Importação automática via WhatsApp Web (servidor Playwright na VPS) ──
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoStep, setAutoStep] = useState('connect'); // 'connect' | 'choose' | 'running'
  const [autoCategory, setAutoCategory] = useState('faturamento');
  const [autoPauseSeconds, setAutoPauseSeconds] = useState(8);
  const [autoConnectMsg, setAutoConnectMsg] = useState('');
  const [autoQrImage, setAutoQrImage] = useState(null);
  const [autoJobId, setAutoJobId] = useState(null);
  const [autoLog, setAutoLog] = useState([]);
  const [autoJobStatus, setAutoJobStatus] = useState('running'); // status do job no servidor
  const [autoStopping, setAutoStopping] = useState(false);
  const autoProcessedIdx = useRef(new Set());

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    const { data: contactRows, error } = await supabase.from('uniko_safer_contacts').select('*').order('name');
    if (error) { flash('Erro ao carregar contatos: ' + error.message); setLoadingContacts(false); return; }
    setContacts(contactRows || []);
    setLoadingContacts(false);
  };

  const loadTags = async () => {
    const { data, error } = await supabase.from('uniko_safer_tags').select('*').order('name');
    if (!error) setTags(data || []);
  };

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const { error } = await supabase.from('uniko_safer_tags').insert({ name, color: newTagColor });
    if (error) { flash('Erro ao criar etiqueta: ' + error.message); return; }
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    await loadTags();
  };

  const deleteTag = async (tagId) => {
    if (!window.confirm('Excluir essa etiqueta? Ela some de todos os contatos que a usam.')) return;
    await supabase.from('uniko_safer_tags').delete().eq('id', tagId);
    // Tira a referência de quem usava — o array não tem foreign key (Postgres
    // não suporta FK em array), então a limpeza é feita aqui.
    const affected = contacts.filter(c => (c.tag_ids || []).includes(tagId));
    await Promise.all(affected.map(c =>
      supabase.from('uniko_safer_contacts').update({ tag_ids: c.tag_ids.filter(id => id !== tagId) }).eq('id', c.id)
    ));
    await Promise.all([loadTags(), loadContacts()]);
  };

  const toggleContactTag = (tagId) => {
    setContactModal(m => {
      const has = (m.tag_ids || []).includes(tagId);
      return { ...m, tag_ids: has ? m.tag_ids.filter(id => id !== tagId) : [...(m.tag_ids || []), tagId] };
    });
  };

  // Atalho do menu de clique direito — muda a etiqueta na hora, sem abrir o
  // modal inteiro de editar contato. Atualiza local primeiro (otimista) pra
  // o menu responder na hora; se o Supabase falhar, recarrega pra corrigir.
  const toggleContactTagDirect = async (contact, tagId) => {
    const has = (contact.tag_ids || []).includes(tagId);
    const nextTagIds = has ? contact.tag_ids.filter(id => id !== tagId) : [...(contact.tag_ids || []), tagId];
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, tag_ids: nextTagIds } : c));
    const { error } = await supabase.from('uniko_safer_contacts').update({ tag_ids: nextTagIds }).eq('id', contact.id);
    if (error) { flash('Erro: ' + error.message); await loadContacts(); }
  };

  useEffect(() => { loadContacts(); loadTags(); }, []);

  // Fecha o menu de clique direito com Escape.
  useEffect(() => {
    if (!tagContextMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setTagContextMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tagContextMenu]);

  // Busca global de mensagens (estilo WhatsApp): além de filtrar a lista de
  // contatos por nome/número (client-side, já carregado), o mesmo campo
  // também vasculha o CONTEÚDO das conversas no banco — com debounce pra não
  // disparar uma consulta a cada tecla.
  useEffect(() => {
    clearTimeout(messageSearchTimer.current);
    const q = search.trim();
    if (q.length < 2) { setMessageResults([]); setSearchingMessages(false); return; }
    messageSearchTimer.current = setTimeout(async () => {
      setSearchingMessages(true);
      const { data, error } = await supabase.from('uniko_safer_messages')
        .select('id, contact_id, sent_at, sender, text')
        .ilike('text', `%${q}%`)
        .order('sent_at', { ascending: false })
        .limit(80);
      setSearchingMessages(false);
      setMessageResults(error ? [] : (data || []));
    }, 350);
    return () => clearTimeout(messageSearchTimer.current);
  }, [search]);

  // Best-effort, nunca trava a tela: se o log falhar (rede, tabela ainda não
  // criada), a conversa abre normal do mesmo jeito — a auditoria é extra,
  // não um bloqueio de acesso (isso já é papel da RLS).
  const logAcessoConversa = (contactId) => {
    try {
      const auth = getAuthUser();
      const contactName = contacts.find(c => c.id === contactId)?.name || null;
      supabase.from('uniko_safer_access_log').insert({
        contact_id: contactId,
        contact_name: contactName,
        viewer_name: auth?.name || null,
        viewer_role: auth?.role || null,
      }).then(() => {}, () => {});
    } catch {}
  };

  const loadChatMessages = async (contactId) => {
    setLoadingChat(true);
    logAcessoConversa(contactId);
    const { data, error } = await supabase.from('uniko_safer_messages').select('sent_at, sender, text').eq('contact_id', contactId).order('sent_at');
    if (error) { flash('Erro ao carregar mensagens: ' + error.message); setLoadingChat(false); return; }
    setCurrentChatMessages((data || []).map(r => ({ timestamp: r.sent_at, sender: r.sender, text: r.text })));
    setLoadingChat(false);
  };

  const selectContact = (id) => {
    setSelectedContactId(id);
    setChatSearchOpen(false);
    setChatSearchTerm('');
    loadChatMessages(id);
  };

  // Resultado da busca global de mensagens: seleciona o contato (mesmo que
  // esteja fora da categoria ativa — o resultado só apareceu porque a
  // mensagem bateu) e já abre a busca dentro da conversa, com o mesmo termo,
  // igual clicar num resultado de busca do WhatsApp.
  const openMessageResult = (contactId) => {
    setSelectedContactId(contactId);
    loadChatMessages(contactId);
    setChatSearchOpen(true);
    setChatSearchTerm(search);
  };

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  const switchCategory = (cat) => {
    setActiveCategory(cat);
    // Sai da conversa aberta se ela não for da categoria pra onde acabou de
    // trocar — senão a tela de chat ficava mostrando alguém que sumiu da
    // lista ao lado.
    if (selectedContact && selectedContact.category !== cat) setSelectedContactId(null);
  };

  // ── Contato: criar/editar/excluir ──────────────────────────────────────
  const openContactModal = (mode) => {
    if (mode === 'edit' && selectedContact) {
      setContactModal({ mode, id: selectedContact.id, name: selectedContact.name, phone: selectedContact.phone_number || '', notes: selectedContact.notes || '', category: selectedContact.category || 'faturamento', tag_ids: selectedContact.tag_ids || [] });
    } else {
      setContactModal({ mode: 'create', id: null, name: '', phone: '', notes: '', category: activeCategory, tag_ids: [] });
    }
  };

  const saveContact = async () => {
    if (!contactModal) return;
    const name = contactModal.name.trim();
    if (!name) { flash('Informe o nome do contato.'); return; }
    const payload = { name, phone_number: contactModal.phone.trim() || null, notes: contactModal.notes.trim() || null, category: contactModal.category, tag_ids: contactModal.tag_ids || [] };
    if (contactModal.mode === 'edit') {
      const { error } = await supabase.from('uniko_safer_contacts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', contactModal.id);
      if (error) { flash('Erro: ' + error.message); return; }
      flash('Contato atualizado.');
    } else {
      const { data, error } = await supabase.from('uniko_safer_contacts').insert(payload).select().single();
      if (error) { flash('Erro: ' + error.message); return; }
      flash('Contato criado.');
      setContactModal(null);
      await loadContacts();
      selectContact(data.id);
      return;
    }
    setContactModal(null);
    await loadContacts();
  };

  const removeContactStorage = async (contactId) => {
    const { data: files } = await supabase.storage.from(BUCKET).list(String(contactId), { limit: 1000 });
    if (files?.length) await supabase.storage.from(BUCKET).remove(files.map(f => `${contactId}/${f.name}`));
  };

  const deleteContact = async (contact) => {
    if (!window.confirm(`Excluir "${contact.name}" e todo o histórico de exportações associado? Essa ação não pode ser desfeita.`)) return;
    await removeContactStorage(contact.id);
    const { error } = await supabase.from('uniko_safer_contacts').delete().eq('id', contact.id);
    if (error) { flash('Erro: ' + error.message); return; }
    if (selectedContactId === contact.id) setSelectedContactId(null);
    flash('Contato excluído.');
    await loadContacts();
  };

  // ── Modo seleção (excluir vários contatos) ──────────────────────────────
  const toggleSelectionMode = () => { setSelectionMode(v => !v); setSelectedIds(new Set()); };
  const toggleSelected = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filteredContacts = contacts.filter(c => {
    if ((c.category || 'faturamento') !== activeCategory) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone_number || '').toLowerCase().includes(q);
  }).sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  // Resultados da busca global de mensagens, restritos à categoria ativa —
  // o limite já veio maior do servidor (ver useEffect acima) pra sobrar
  // resultado suficiente depois desse filtro.
  const visibleMessageResults = search.trim().length >= 2
    ? messageResults.filter(r => {
        const c = contacts.find(x => x.id === r.contact_id);
        return c && (c.category || 'faturamento') === activeCategory;
      }).slice(0, 20)
    : [];
  const selectAllVisible = () => setSelectedIds(new Set(filteredContacts.map(c => c.id)));
  const deselectAll = () => setSelectedIds(new Set());
  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Excluir ${ids.length} contato${ids.length > 1 ? 's' : ''} selecionado${ids.length > 1 ? 's' : ''} e todo o histórico associado? Essa ação não pode ser desfeita.`)) return;
    for (const id of ids) await removeContactStorage(id);
    const { error } = await supabase.from('uniko_safer_contacts').delete().in('id', ids);
    if (error) { flash('Erro: ' + error.message); return; }
    if (selectedContactId && ids.includes(selectedContactId)) setSelectedContactId(null);
    flash(`${ids.length} contato${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''}.`);
    setSelectionMode(false); setSelectedIds(new Set());
    await loadContacts();
  };

  // ── Importação ───────────────────────────────────────────────────────
  // Exportação do WhatsApp é sempre CUMULATIVA (o histórico inteiro de novo
  // a cada vez) — em vez de gravar esse snapshot todo de novo, cada mensagem
  // vira upsert com hash único por contato: o que já existe é ignorado, só
  // entra o que é de fato novo. É isso que faz reimportar toda semana não
  // duplicar o espaço usado (ver conversa sobre o volume de anos de dados).
  const upsertNewMessages = async (contactId, messages) => {
    let newCount = 0;
    for (let i = 0; i < messages.length; i += MESSAGE_UPSERT_CHUNK) {
      const chunk = messages.slice(i, i + MESSAGE_UPSERT_CHUNK);
      const rows = await Promise.all(chunk.map(async m => ({
        contact_id: contactId, sent_at: m.timestamp, sender: m.sender, text: m.text,
        message_hash: await hashMessage(m.timestamp, m.sender, m.text),
      })));
      const { data, error } = await supabase.from('uniko_safer_messages')
        .upsert(rows, { onConflict: 'contact_id,message_hash', ignoreDuplicates: true })
        .select('id');
      if (error) throw new Error(error.message);
      newCount += data?.length || 0;
    }
    return newCount;
  };

  // 504/timeout do Storage do Supabase são passageiros (visto ao vivo: 1 em
  // 21 arquivos numa importação automática) — vale tentar de novo antes de
  // desistir. Erro que não parece transitório (ex: permissão, duplicado)
  // falha na hora, sem ficar tentando à toa.
  const uploadWithRetry = async (path, file, options, attempts = 3) => {
    for (let i = 0; i < attempts; i++) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, options);
      if (!error) return;
      const transient = /50\d|timeout|network|fetch failed/i.test(error.message || '');
      if (!transient || i === attempts - 1) throw new Error(error.message);
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  };

  const importFileForContact = async (contactId, file) => {
    const fileType = await sniffFileType(file);
    if (fileType === 'other') throw new Error('Formato não suportado (use .txt ou .zip com chat.txt).');

    const storagePath = `${contactId}/${Date.now()}_${sanitizeStorageName(file.name)}`;
    await uploadWithRetry(storagePath, file, { contentType: fileType === 'zip' ? 'application/zip' : 'text/plain', upsert: false });

    let messages = [];
    let summary = { messageCount: null, dateRangeStart: null, dateRangeEnd: null };
    const content = await readChatText(file, fileType);
    if (content) { summary = parseWhatsappTxt(content); messages = parseWhatsappMessages(content); }

    const newMessageCount = messages.length ? await upsertNewMessages(contactId, messages) : 0;

    const { data, error } = await supabase.from('uniko_safer_exports').insert({
      contact_id: contactId, original_filename: file.name, storage_path: storagePath, file_type: fileType,
      file_size: file.size, message_count: summary.messageCount, new_message_count: newMessageCount,
      date_range_start: summary.dateRangeStart, date_range_end: summary.dateRangeEnd,
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  };

  const handleImportFiles = async (fileList) => {
    if (!selectedContactId || !fileList?.length) return;
    setImportingContact(true);
    let importedCount = 0; const skipped = [];
    for (const file of Array.from(fileList)) {
      try { await importFileForContact(selectedContactId, file); importedCount += 1; }
      catch (err) { skipped.push({ filename: file.name, reason: err.message }); }
    }
    setImportingContact(false);
    if (importedCount) flash(`${importedCount} arquivo${importedCount > 1 ? 's' : ''} importado${importedCount > 1 ? 's' : ''}.`);
    if (skipped.length) flash(`${skipped.length} arquivo(s) não importado(s): ${skipped[0].reason}`);
    await loadChatMessages(selectedContactId);
    await loadContacts();
  };

  // Acha (ou cria) o contato pelo nome dentro do setor dado e importa o
  // arquivo — usado tanto pelo bulk import manual (arrastar/soltar) quanto
  // pela importação automática via WhatsApp Web, pra não duplicar essa
  // lógica em dois lugares.
  const importOneFile = async (file, contactName, category, byNameMap) => {
    const key = contactName.toLowerCase();
    let contact = byNameMap.get(key);
    let createdContact = false;
    if (!contact) {
      const { data, error } = await supabase.from('uniko_safer_contacts').insert({ name: contactName, category }).select().single();
      if (error) throw new Error(error.message);
      contact = data; createdContact = true; byNameMap.set(key, contact);
    }
    const record = await importFileForContact(contact.id, file);
    const mc = record.new_message_count ?? 0;
    return { createdContact, message: `${mc} mensagem${mc === 1 ? '' : 's'} nova${mc === 1 ? '' : 's'}.` };
  };

  const handleBulkFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => /\.(zip|txt)$/i.test(f.name));
    if (!files.length) { flash('Solte arquivos .zip ou .txt exportados do WhatsApp.'); return; }
    setBulkBusy(true);
    setBulkLog([]);
    setBulkTotal(files.length);
    setBulkCurrentFile(null);
    // Casa só com contatos do setor escolhido no passo anterior do modal —
    // nomes iguais em Faturamento e Financeiro são pessoas/números
    // diferentes, não a mesma conversa.
    const byName = new Map(contacts.filter(c => c.category === bulkCategory).map(c => [c.name.toLowerCase(), c]));
    const results = [];
    for (const file of files) {
      const contactName = deriveContactNameFromFilename(file.name);
      setBulkCurrentFile(contactName);
      let result;
      try {
        const { createdContact, message } = await importOneFile(file, contactName, bulkCategory, byName);
        result = { filename: file.name, contactName, createdContact, status: 'imported', message };
      } catch (err) {
        result = { filename: file.name, contactName, createdContact: false, status: 'error', message: err.message };
      }
      results.push(result);
      // Atualiza o log a CADA arquivo (não só no final) — é o que alimenta a
      // tela de progresso, pra acompanhar em tempo real quem já foi.
      setBulkLog(prev => [...prev, result]);
    }
    setBulkCurrentFile(null);
    setBulkBusy(false);
    const importedCount = results.filter(r => r.status === 'imported').length;
    flash(`${importedCount} arquivo${importedCount === 1 ? '' : 's'} importado${importedCount === 1 ? '' : 's'}${results.length - importedCount > 0 ? `, ${results.length - importedCount} com erro.` : '.'}`);
    await loadContacts();
    if (selectedContactId) await loadChatMessages(selectedContactId);
  };

  // ── Importação automática via WhatsApp Web ─────────────────────────────
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` });

  const checkWaStatus = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/safer/whatsapp/status`, { headers: authHeaders() });
      const data = await res.json();
      if (data.loggedIn) { setAutoQrImage(null); setAutoStep('choose'); return true; }
      if (data.needsQr) { setAutoQrImage(data.qrImageBase64); setAutoConnectMsg('Escaneie o QR Code com o celular do WhatsApp do setor.'); return false; }
      setAutoConnectMsg(data.message || 'Carregando WhatsApp Web…');
      return false;
    } catch {
      setAutoConnectMsg('Não foi possível falar com o servidor. Tente de novo em instantes.');
      return false;
    }
  };

  const openAutoModal = () => {
    setAutoStep('connect'); setAutoQrImage(null);
    setAutoConnectMsg('Verificando sessão do WhatsApp Web…');
    setAutoCategory(activeCategory); setAutoLog([]); setAutoJobId(null); setAutoStopping(false);
    autoProcessedIdx.current = new Set();
    setAutoModalOpen(true);
    checkWaStatus();
  };

  // Enquanto não conecta, sonda a cada 3s (dá tempo do usuário escanear o QR Code).
  useEffect(() => {
    if (!autoModalOpen || autoStep !== 'connect') return;
    const t = setInterval(async () => { if (await checkWaStatus()) clearInterval(t); }, 3000);
    return () => clearInterval(t);
  }, [autoModalOpen, autoStep]);

  const startAutoImport = async () => {
    setAutoStep('running'); setAutoLog([]); setAutoJobStatus('running');
    autoProcessedIdx.current = new Set();
    try {
      const res = await fetch(`${SERVER_URL}/api/safer/whatsapp/import/start`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pauseSeconds: autoPauseSeconds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar a importação automática.');
      console.log('[uniko-safer-auto] job iniciado:', data.jobId); // pra buscar o debug-shot depois, se precisar
      setAutoJobId(data.jobId);
    } catch (err) {
      flash(`Erro: ${err.message}`);
      setAutoStep('choose');
    }
  };

  // Faz o polling do job: acompanha o log e, a cada contato pronto, busca o
  // arquivo exportado e importa pelo MESMO caminho do bulk manual.
  useEffect(() => {
    if (!autoJobId || autoStep !== 'running') return;
    let cancelled = false;
    let finished = false;
    let lastLogCount = -1;
    let lastStatus = null;
    const byName = new Map(contacts.filter(c => c.category === autoCategory).map(c => [c.name.toLowerCase(), c]));

    const poll = async () => {
      if (finished) return;
      let data;
      try {
        const res = await fetch(`${SERVER_URL}/api/safer/whatsapp/import/status/${autoJobId}`, { headers: authHeaders() });
        data = await res.json();
      } catch { return; }
      if (cancelled || !data) return;
      // Só re-renderiza quando o log/status realmente mudou — fazia
      // setState (e reflow da tela toda) a cada 2s mesmo sem novidade
      // nenhuma, e isso já tinha derrubado o FPS em outro módulo antes
      // (ver commit do Trello removendo backdrop-filter dos modais).
      const logs = data.logs || [];
      if (logs.length !== lastLogCount) { lastLogCount = logs.length; setAutoLog(logs); }
      if (data.status !== lastStatus) { lastStatus = data.status; setAutoJobStatus(data.status); }

      const readyEntries = (data.logs || []).filter(l => l.status === 'ready' && !autoProcessedIdx.current.has(l.fileIndex));
      for (const entry of readyEntries) {
        autoProcessedIdx.current.add(entry.fileIndex);
        try {
          const fileRes = await fetch(`${SERVER_URL}/api/safer/whatsapp/import/${autoJobId}/file/${entry.fileIndex}`, { headers: authHeaders() });
          if (!fileRes.ok) throw new Error('Falha ao baixar o arquivo exportado.');
          const blob = await fileRes.blob();
          const disp = fileRes.headers.get('Content-Disposition') || '';
          const filename = disp.match(/filename="([^"]+)"/)?.[1] ? decodeURIComponent(disp.match(/filename="([^"]+)"/)[1]) : `${entry.contactName}.zip`;
          const file = new File([blob], filename, { type: blob.type });
          await importOneFile(file, entry.contactName, autoCategory, byName);
        } catch (err) {
          setAutoLog(prev => [...prev, { contactName: entry.contactName, status: 'error', message: `Falha ao importar: ${err.message}` }]);
        }
      }
      if (data.status === 'done' || data.status === 'error') {
        finished = true;
        clearInterval(t);
        await loadContacts();
        if (selectedContactId) await loadChatMessages(selectedContactId);
      }
    };

    poll();
    const t = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(t); };
  }, [autoJobId, autoStep, autoCategory]);

  const stopAutoImport = async () => {
    if (!autoJobId) return;
    setAutoStopping(true);
    try { await fetch(`${SERVER_URL}/api/safer/whatsapp/import/stop/${autoJobId}`, { method: 'POST', headers: authHeaders() }); } catch {}
  };

  const closeAutoModal = () => {
    setAutoModalOpen(false); setAutoJobId(null); setAutoLog([]); setAutoStep('connect'); setAutoStopping(false);
  };

  // ── Render: mensagens do chat ────────────────────────────────────────
  const term = chatSearchTerm.trim().toLowerCase();
  const visibleMessages = term ? currentChatMessages.filter(m => m.text.toLowerCase().includes(term)) : currentChatMessages;

  const renderChat = () => {
    if (loadingChat) return <div style={{ padding: 40, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando conversa…</div>;
    if (currentChatMessages.length === 0) {
      return (
        <div style={{ margin: '40px 24px', padding: 28, textAlign: 'center', color: T.textT, fontSize: 13, background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhuma conversa importada ainda pra esse contato. Use "Importar conversa" pra adicionar um arquivo .txt ou .zip exportado do WhatsApp.
        </div>
      );
    }
    if (term && visibleMessages.length === 0) {
      return <div style={{ alignSelf: 'center', textAlign: 'center', color: T.textT, fontSize: 12.5, padding: '20px 0' }}>Nenhuma mensagem encontrada.</div>;
    }
    let lastDay = null;
    return visibleMessages.map((m, i) => {
      const key = dayKey(m.timestamp);
      const divider = key !== lastDay;
      lastDay = key;
      if (m.sender === null) {
        return (
          <div key={i}>
            {divider && <div style={dividerStyle}>{formatDayLabel(m.timestamp)}</div>}
            <div style={{ alignSelf: 'center', textAlign: 'center', fontSize: 11.5, color: T.textT, padding: '6px 14px', maxWidth: '70%', margin: '0 auto' }}>{m.text}</div>
          </div>
        );
      }
      const fromMe = m.sender === 'Você' || m.sender === 'You';
      return (
        <div key={i}>
          {divider && <div style={dividerStyle}>{formatDayLabel(m.timestamp)}</div>}
          {/* Linha de largura total + justifyContent (em vez de só alignSelf no
              item) — garante que a mensagem encoste na margem de verdade,
              não fique "flutuando" perto do meio quando a coluna de mensagens
              é bem larga. */}
          <div style={{ display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start', width: '100%', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '68%', alignItems: fromMe ? 'flex-end' : 'flex-start' }}>
              {!fromMe && <div style={{ fontSize: 11, fontWeight: 700, color: T.green || T.gold, margin: '0 4px 3px' }}>{m.sender}</div>}
              <div style={{ padding: '8px 12px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: fromMe ? (T.green || T.gold) : T.surface, color: fromMe ? '#fff' : T.text,
                border: fromMe ? 'none' : `1px solid ${T.border}`,
                borderBottomRightRadius: fromMe ? 4 : 16, borderBottomLeftRadius: fromMe ? 16 : 4 }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10.5, color: T.textT, margin: '3px 4px 0' }}>{formatTime(m.timestamp)}</div>
            </div>
          </div>
        </div>
      );
    });
  };
  const dividerStyle = { alignSelf: 'center', textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.textT, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '4px 14px', margin: '16px auto 8px', width: 'fit-content' };

  const mobileShowList = !isMobile || !selectedContactId;
  const mobileShowChat = !isMobile || !!selectedContactId;

  return (
    <div style={{ height: '100vh', background: T.page, fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'),
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, position: 'sticky', top: 0, zIndex: 200 }}>
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: T.surfaceSub || 'rgba(0,0,0,0.04)',
            border: `1px solid ${T.border}`, borderRadius: 9, cursor: 'pointer', color: T.textS, outline: 'none', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          <IcoBack /> Módulos
        </button>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text }}>Uniko Safer</div>
      </div>

      {/* Corpo: sidebar + conversa */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {mobileShowList && (
          <div style={{ width: isMobile ? '100%' : 320, flexShrink: 0, background: T.surface, borderRight: isMobile ? 'none' : `1px solid ${T.border}`,
            display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Contatos</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button title="Mais opções" onClick={() => setMoreMenuOpen(true)} style={{ ...btnStyle('secondary'), padding: '7px 9px' }}><IcoDots /></button>
                <button title="Novo contato" onClick={() => openContactModal('create')} style={{ ...btnStyle('primary'), padding: '7px 9px' }}><IcoPlus /></button>
              </div>
            </div>

            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
              {CATEGORIES.map(cat => {
                const sel = activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => switchCategory(cat.id)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                      border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS }}>
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '0 16px 10px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textT }}><IcoSearch /></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, número ou mensagem"
                  style={{ width: '100%', padding: '9px 12px 9px 30px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }} />
              </div>
            </div>

            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6 }}>
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} title="Ordenar por nome" style={{ ...btnStyle('secondary'), padding: '7px 10px' }}>
                <IcoSort /> {sortDir === 'asc' ? 'A—Z' : 'Z—A'}
              </button>
              <button onClick={() => setTagPickerOpen(true)} title="Etiquetas personalizadas" style={{ ...btnStyle('secondary'), padding: '7px 10px' }}>
                <IcoTag /> Etiquetas
              </button>
            </div>

            {selectionMode && (
              <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 12, color: T.textT, fontWeight: 600 }}>{selectedIds.size} selecionado{selectedIds.size === 1 ? '' : 's'}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={selectAllVisible} style={btnStyle('secondary')}>Todos</button>
                  <button onClick={deselectAll} style={btnStyle('secondary')}>Nenhum</button>
                  <button onClick={deleteSelected} disabled={!selectedIds.size} style={{ ...btnStyle('danger'), opacity: selectedIds.size ? 1 : 0.45, cursor: selectedIds.size ? 'pointer' : 'default' }}>Excluir</button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 10px 18px' }}>
              {loadingContacts ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando…</div>
              ) : filteredContacts.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: T.textT, fontSize: 13 }}>
                  {contacts.length === 0 ? 'Nenhum contato ainda. Crie o primeiro com o botão +.' : 'Nenhum contato encontrado.'}
                </div>
              ) : filteredContacts.map(c => {
                const active = c.id === selectedContactId;
                const checked = selectedIds.has(c.id);
                return (
                  <div key={c.id} onClick={() => selectionMode ? toggleSelected(c.id) : selectContact(c.id)}
                    onContextMenu={e => { e.preventDefault(); setTagContextMenu({ contactId: c.id, x: e.clientX, y: e.clientY }); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
                      background: (active || checked) ? (T.goldGl || T.surfaceSub) : 'transparent' }}>
                    {selectionMode && <input type="checkbox" checked={checked} onChange={() => toggleSelected(c.id)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, flexShrink: 0, accentColor: T.gold }} />}
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: active ? T.gold : (T.surfaceSub || '#eceef0'), color: active ? '#fff' : T.textT,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(c.name) || '?'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      {c.phone_number && <div style={{ fontSize: 12, color: T.textT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.phone_number}</div>}
                      {(c.tag_ids || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {c.tag_ids.map(tid => {
                            const tag = tags.find(t => t.id === tid);
                            if (!tag) return null;
                            return (
                              <span key={tid} style={{ fontSize: 10, fontWeight: 700, color: tag.color, background: `${tag.color}22`, borderRadius: 20, padding: '1px 7px' }}>{tag.name}</span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Busca global de mensagens — igual ao WhatsApp: mostra em qual
                  conversa e onde o termo apareceu, clicar já abre lá dentro
                  filtrado. Só dentro da categoria ativa. */}
              {search.trim().length >= 2 && (searchingMessages || visibleMessageResults.length > 0) && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <div style={{ padding: '0 10px 6px', fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Mensagens{searchingMessages ? '…' : ''}
                  </div>
                  {visibleMessageResults.map(r => {
                    const rc = contacts.find(x => x.id === r.contact_id);
                    return (
                      <div key={r.id} onClick={() => openMessageResult(r.contact_id)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.surfaceSub || '#eceef0', color: T.textT,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(rc?.name) || '?'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rc?.name || 'Contato removido'}</div>
                            <div style={{ fontSize: 10.5, color: T.textT, flexShrink: 0 }}>{formatDateShort(r.sent_at)}</div>
                          </div>
                          <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.sender && <span style={{ fontWeight: 600 }}>{r.sender}: </span>}
                            {highlightMatch(snippetAround(r.text, search.trim()), search.trim())}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conversa */}
        {mobileShowChat && (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedContact ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: T.textT, maxWidth: 420, margin: '0 auto', padding: '40px 24px' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>Escolha um contato</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>Selecione um contato na lista pra ver o histórico de conversa, ou crie um novo com o botão +.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: isMobile ? '14px 16px' : '20px 28px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {isMobile && (
                      <button onClick={() => setSelectedContactId(null)} style={{ ...btnStyle('secondary'), padding: '7px 9px', flexShrink: 0 }}><IcoBack /></button>
                    )}
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: T.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{initials(selectedContact.name) || '?'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{selectedContact.name}</div>
                      {selectedContact.phone_number && <div style={{ fontSize: 12.5, color: T.textT }}>{selectedContact.phone_number}</div>}
                      {selectedContact.notes && <div style={{ marginTop: 4, fontSize: 12, color: T.textT, maxWidth: 420, whiteSpace: 'pre-wrap' }}>{selectedContact.notes}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => setChatSearchOpen(v => !v)} style={btnStyle('secondary')}><IcoSearch /> Buscar</button>
                    <button onClick={() => openContactModal('edit')} style={btnStyle('secondary')}><IcoEdit /> Editar</button>
                    <button onClick={() => deleteContact(selectedContact)} style={btnStyle('danger')}><IcoTrash /></button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={importingContact} style={{ ...btnStyle('primary'), opacity: importingContact ? 0.6 : 1 }}>
                      <IcoImport /> {importingContact ? 'Importando…' : 'Importar conversa'}
                    </button>
                    <input ref={fileInputRef} type="file" accept=".zip,.txt" multiple style={{ display: 'none' }}
                      onChange={e => { handleImportFiles(e.target.files); e.target.value = ''; }} />
                  </div>
                </div>

                {chatSearchOpen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
                    <input autoFocus value={chatSearchTerm} onChange={e => setChatSearchTerm(e.target.value)} placeholder="Buscar na conversa"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }} />
                    {term && <span style={{ fontSize: 11.5, color: T.textT, flexShrink: 0 }}>{visibleMessages.length} resultado{visibleMessages.length === 1 ? '' : 's'}</span>}
                    <button onClick={() => { setChatSearchOpen(false); setChatSearchTerm(''); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoClose /></button>
                  </div>
                )}

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '16px' : '20px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderChat()}
                </div>

                {/* Ocupa o lugar de "digite uma mensagem" do WhatsApp de propósito —
                    deixa claro que isso é só um histórico, não dá pra responder daqui. */}
                <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${T.border}`, background: T.surface,
                  textAlign: 'center', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: T.textT }}>
                  VISUALIZAÇÃO DE HISTÓRICO DE CONVERSA
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal: criar/editar contato */}
      {contactModal && (
        <div onClick={() => setContactModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 380, maxWidth: '100%', boxShadow: T.shL }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>{contactModal.mode === 'edit' ? 'Editar contato' : 'Novo contato'}</div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '0 0 6px' }}>Setor</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {CATEGORIES.map(cat => {
                const sel = contactModal.category === cat.id;
                return (
                  <button key={cat.id} onClick={() => setContactModal(m => ({ ...m, category: cat.id }))}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                      border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS }}>
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '10px 0 6px' }}>Nome</label>
            <input autoFocus value={contactModal.name} onChange={e => setContactModal(m => ({ ...m, name: e.target.value }))}
              style={inputStyle} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '10px 0 6px' }}>Telefone</label>
            <input value={contactModal.phone} onChange={e => setContactModal(m => ({ ...m, phone: e.target.value }))} placeholder="(85) 9xxxx-xxxx"
              style={inputStyle} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '10px 0 6px' }}>Notas</label>
            <textarea value={contactModal.notes} onChange={e => setContactModal(m => ({ ...m, notes: e.target.value }))} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '10px 0 6px' }}>Etiquetas</label>
            {tags.length === 0 ? (
              <div style={{ fontSize: 11.5, color: T.textT }}>Nenhuma etiqueta criada ainda — use o botão "Etiquetas" na lista de contatos.</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tags.map(tag => {
                  const sel = (contactModal.tag_ids || []).includes(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleContactTag(tag.id)}
                      style={{ fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)',
                        border: `1.5px solid ${sel ? tag.color : T.border}`, background: sel ? `${tag.color}22` : 'transparent', color: sel ? tag.color : T.textS }}>
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setContactModal(null)} style={btnStyle('secondary')}>Cancelar</button>
              <button onClick={saveContact} style={btnStyle('primary')}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: gerenciar etiquetas personalizadas (criar/excluir) */}
      {tagPickerOpen && (
        <div onClick={() => setTagPickerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 380, maxWidth: '100%', boxShadow: T.shL }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Etiquetas</div>
              <button onClick={() => setTagPickerOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT }}><IcoClose /></button>
            </div>

            {tags.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                {tags.map(tag => (
                  <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{tag.name}</span>
                    <button onClick={() => deleteTag(tag.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.danger, display: 'flex' }}><IcoTrash /></button>
                  </div>
                ))}
              </div>
            )}

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, marginBottom: 6 }}>Nova etiqueta</label>
            <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ex: Urgente"
              style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {TAG_COLORS.map(color => (
                <button key={color} onClick={() => setNewTagColor(color)}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: color, cursor: 'pointer',
                    border: newTagColor === color ? `2.5px solid ${T.text}` : '2.5px solid transparent' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={createTag} disabled={!newTagName.trim()} style={{ ...btnStyle('primary'), opacity: newTagName.trim() ? 1 : 0.5 }}>Criar etiqueta</button>
            </div>
          </div>
        </div>
      )}

      {/* Menu de clique direito num contato: marcar/desmarcar etiquetas na hora */}
      {tagContextMenu && (() => {
        const contact = contacts.find(c => c.id === tagContextMenu.contactId);
        if (!contact) return null;
        const left = Math.min(tagContextMenu.x, window.innerWidth - 240);
        const top = Math.min(tagContextMenu.y, window.innerHeight - 60 - tags.length * 36);
        return (
          <>
            <div onClick={() => setTagContextMenu(null)} onContextMenu={e => { e.preventDefault(); setTagContextMenu(null); }}
              style={{ position: 'fixed', inset: 0, zIndex: 550 }} />
            <div style={{ position: 'fixed', top, left, zIndex: 551, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
              boxShadow: T.shL, padding: 6, minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, padding: '6px 8px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Etiquetas de {contact.name}
              </div>
              {tags.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textT, padding: '4px 8px 8px' }}>Nenhuma etiqueta criada ainda.</div>
              ) : tags.map(tag => {
                const sel = (contact.tag_ids || []).includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleContactTagDirect(contact, tag.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
                      background: sel ? `${tag.color}18` : 'transparent', border: 'none', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: T.text, flex: 1 }}>{tag.name}</span>
                    {sel && <span style={{ color: tag.color, fontWeight: 900 }}>✓</span>}
                  </button>
                );
              })}
              <div style={{ height: 1, background: T.border, margin: '6px 0' }} />
              <button onClick={() => { setTagContextMenu(null); setTagPickerOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px', borderRadius: 6, cursor: 'pointer',
                  background: 'transparent', border: 'none', textAlign: 'left', color: T.gold, fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
                <IcoPlus /> Nova etiqueta
              </button>
            </div>
          </>
        );
      })()}

      {/* Menu "Mais opções": 3 cards grandes, cada um abre uma função em tela cheia */}
      {moreMenuOpen && (
        <div onClick={() => setMoreMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 420, maxWidth: '100%', boxShadow: T.shL }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Mais opções</div>
              <button onClick={() => setMoreMenuOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT }}><IcoClose /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <IcoImport />, title: 'Importar vários', desc: 'Arraste vários arquivos .zip/.txt de uma vez', onClick: () => { setMoreMenuOpen(false); setBulkLog([]); setBulkStep('choose'); setBulkCategory(activeCategory); setBulkModalOpen(true); } },
                { icon: <IcoAuto />, title: 'Importação automática', desc: 'O robô entra no WhatsApp Web e importa sozinho', onClick: () => { setMoreMenuOpen(false); openAutoModal(); } },
                { icon: <IcoSelect />, title: 'Selecionar contatos', desc: 'Marque vários contatos pra excluir de uma vez', onClick: () => { setMoreMenuOpen(false); toggleSelectionMode(); } },
              ].map(card => (
                <button key={card.title} onClick={card.onClick}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${T.border}`, background: T.page, fontFamily: 'var(--font-body)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{card.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{card.title}</div>
                    <div style={{ fontSize: 12, color: T.textT, marginTop: 2 }}>{card.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tela cheia: importar vários (arrastar/soltar, deriva contato do nome do arquivo) */}
      {bulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: T.page, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'), borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
            <button onClick={() => !bulkBusy && setBulkModalOpen(false)} disabled={bulkBusy}
              style={{ background: 'transparent', border: 'none', cursor: bulkBusy ? 'default' : 'pointer', color: T.textT, display: 'flex', opacity: bulkBusy ? 0.4 : 1 }}>
              <IcoClose />
            </button>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Importar vários arquivos</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px 20px' }}>
          <div style={{ width: '100%', maxWidth: 460 }}>
            {bulkStep === 'choose' ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>Adicionar mais conversas?</div>
                <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16, lineHeight: 1.5 }}>
                  Escolha pra qual setor vão as conversas que você vai importar agora. Vale pra todos os arquivos que você soltar em seguida.
                </div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, marginBottom: 6 }}>Setor</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                  {CATEGORIES.map(cat => {
                    const sel = bulkCategory === cat.id;
                    return (
                      <button key={cat.id} onClick={() => setBulkCategory(cat.id)}
                        style={{ flex: 1, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                          border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS }}>
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setBulkModalOpen(false)} style={btnStyle('secondary')}>Cancelar</button>
                  <button onClick={() => setBulkStep('drop')} style={btnStyle('primary')}>Continuar</button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setBulkStep('choose')} disabled={bulkBusy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: bulkBusy ? 'default' : 'pointer',
                    color: T.textT, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', padding: 0, opacity: bulkBusy ? 0.5 : 1, marginBottom: 10 }}>
                  <IcoBack /> {CATEGORIES.find(c => c.id === bulkCategory)?.label}
                </button>

                {bulkBusy ? (
                  // Tela de progresso — some a área de soltar arquivo enquanto
                  // processa, pra dar pra acompanhar contato por contato em
                  // vez de só um "Importando…" parado.
                  <div style={{ padding: '10px 2px 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Importando conversas…</span>
                      <span style={{ fontSize: 11.5, color: T.textT, fontWeight: 700 }}>{bulkLog.length}/{bulkTotal}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: T.page, overflow: 'hidden', marginBottom: 12, border: `1px solid ${T.border}` }}>
                      <div style={{ height: '100%', width: `${bulkTotal ? Math.min(100, (bulkLog.length / bulkTotal) * 100) : 0}%`, background: T.gold, transition: 'width .25s ease' }} />
                    </div>
                    {bulkCurrentFile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textT }}>
                        <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${T.border}`, borderTopColor: T.gold, flexShrink: 0, animation: 'saferBulkSpin .7s linear infinite' }} />
                        Processando <strong style={{ color: T.text }}>{bulkCurrentFile}</strong>…
                      </div>
                    )}
                    <style>{`@keyframes saferBulkSpin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: T.textT, marginBottom: 12, lineHeight: 1.5 }}>
                      O nome do contato é identificado pelo nome do arquivo (ex: "Conversa do WhatsApp com João.zip"). Se o contato ainda não existir no setor <strong>{CATEGORIES.find(c => c.id === bulkCategory)?.label}</strong>, ele é criado automaticamente.
                    </div>
                    <div
                      onDragOver={e => { e.preventDefault(); setBulkDragOver(true); }}
                      onDragLeave={() => setBulkDragOver(false)}
                      onDrop={e => { e.preventDefault(); setBulkDragOver(false); handleBulkFiles(e.dataTransfer?.files); }}
                      onClick={() => bulkInputRef.current?.click()}
                      style={{ padding: '26px 16px', border: `1.5px dashed ${bulkDragOver ? T.gold : T.border}`, borderRadius: 12,
                        background: bulkDragOver ? T.goldGl : T.page, color: bulkDragOver ? T.gold : T.textT, fontSize: 12.5, lineHeight: 1.5,
                        textAlign: 'center', cursor: 'pointer' }}>
                      Arraste os arquivos .zip/.txt aqui, ou clique pra escolher
                    </div>
                  </>
                )}
                <input ref={bulkInputRef} type="file" accept=".zip,.txt" multiple style={{ display: 'none' }}
                  onChange={e => { handleBulkFiles(e.target.files); e.target.value = ''; }} />

                {bulkLog.length > 0 && (
                  <div style={{ marginTop: 14, maxHeight: 220, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10, background: T.page, fontSize: 12 }}>
                    {bulkLog.map((r, i) => (
                      <div key={i} style={{ padding: '7px 10px', borderBottom: i < bulkLog.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: T.text, flexShrink: 0 }}>{r.filename} → {r.contactName}{r.createdContact ? ' (novo)' : ''}</span>
                        <span style={{ color: r.status === 'imported' ? (T.green || T.gold) : T.danger, textAlign: 'right' }}>{r.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Tela cheia: importação automática via WhatsApp Web */}
      {autoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: T.page, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'), borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
            {autoStep !== 'running' ? (
              <button onClick={closeAutoModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoClose /></button>
            ) : <div style={{ width: 15 }} />}
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Importação automática</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px 20px' }}>
          <div style={{ width: '100%', maxWidth: 460 }}>
            {autoStep === 'connect' && (
              <>
                <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16, lineHeight: 1.5 }}>{autoConnectMsg}</div>
                {autoQrImage ? (
                  <div style={{ textAlign: 'center' }}>
                    <img src={`data:image/png;base64,${autoQrImage}`} alt="QR Code do WhatsApp Web" style={{ width: 220, height: 220, borderRadius: 10, border: `1px solid ${T.border}` }} />
                    <div style={{ fontSize: 11.5, color: T.textT, marginTop: 10 }}>No celular do WhatsApp do setor: Configurações → Aparelhos conectados → Conectar um aparelho.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, fontSize: 12.5, color: T.textT, justifyContent: 'center', padding: '20px 0' }}>
                    <span style={{ width: 44, height: 44, borderRadius: '50%', border: `4px solid ${T.border}`, borderTopColor: T.gold, flexShrink: 0, animation: 'saferBulkSpin .8s linear infinite' }} />
                    Verificando…
                    <style>{`@keyframes saferBulkSpin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
              </>
            )}

            {autoStep === 'choose' && (
              <>
                <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16, lineHeight: 1.5 }}>
                  WhatsApp Web conectado. Escolha o setor e o intervalo entre cada contato (evita disparar detecção de automação no WhatsApp) e inicie a importação — ela percorre todos os contatos da barra lateral, exporta e importa sozinha.
                </div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, marginBottom: 6 }}>Setor</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {CATEGORIES.map(cat => {
                    const sel = autoCategory === cat.id;
                    return (
                      <button key={cat.id} onClick={() => setAutoCategory(cat.id)}
                        style={{ flex: 1, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                          border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS }}>
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, marginBottom: 6 }}>Pausa entre contatos (segundos)</label>
                <input type="number" min={5} value={autoPauseSeconds} onChange={e => setAutoPauseSeconds(Math.max(5, Number(e.target.value) || 5))}
                  style={{ ...inputStyle, marginBottom: 20 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={closeAutoModal} style={btnStyle('secondary')}>Cancelar</button>
                  <button onClick={startAutoImport} style={btnStyle('primary')}>Iniciar importação automática</button>
                </div>
              </>
            )}

            {autoStep === 'running' && (() => {
              const isDone = autoJobStatus === 'done';
              const isError = autoJobStatus === 'error';
              const okColor = T.green || T.gold;
              const successCount = autoLog.filter(l => l.status === 'ready').length;
              const errorCount = autoLog.filter(l => l.status === 'error').length;
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0 20px' }}>
                    {autoJobStatus === 'running' ? (
                      <span style={{ width: 52, height: 52, borderRadius: '50%', border: `4px solid ${T.border}`, borderTopColor: T.gold, flexShrink: 0, animation: 'saferBulkSpin .8s linear infinite' }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isDone ? `${okColor}22` : `${T.danger}22`, color: isDone ? okColor : T.danger }}>
                        {isDone ? <IcoCheck /> : <IcoWarn />}
                      </div>
                    )}
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, marginTop: 14 }}>
                      {isDone ? 'Concluído' : isError ? 'Encerrado com erro' : 'Importando pelo WhatsApp Web…'}
                    </div>
                    {(isDone || isError) && (successCount > 0 || errorCount > 0) && (
                      <div style={{ fontSize: 12, color: T.textT, marginTop: 4 }}>
                        {successCount} exportada{successCount === 1 ? '' : 's'}{errorCount > 0 ? ` · ${errorCount} com erro` : ''}
                      </div>
                    )}
                  </div>
                  <style>{`@keyframes saferBulkSpin { to { transform: rotate(360deg); } }`}</style>
                  {autoLog.length > 0 && (
                    <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 10, background: T.page, fontSize: 12, marginBottom: 14 }}>
                      {autoLog.map((r, i) => {
                        const rowColor = r.status === 'ready' ? okColor : r.status === 'error' ? T.danger : T.textT;
                        return (
                          <div key={i} style={{ padding: '7px 10px', borderBottom: i < autoLog.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: rowColor, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: T.text, flexShrink: 0 }}>{r.contactName || '—'}</span>
                            <span style={{ color: rowColor, textAlign: 'right', marginLeft: 'auto' }}>{r.message}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {autoJobStatus === 'running' ? (
                      <button onClick={stopAutoImport} disabled={autoStopping} style={{ ...btnStyle('danger'), opacity: autoStopping ? 0.6 : 1 }}>{autoStopping ? 'Parando…' : 'Parar'}</button>
                    ) : (
                      <button onClick={closeAutoModal} style={btnStyle('primary')}>Fechar</button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: T.text, color: T.surface, padding: '12px 22px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', maxWidth: '90vw', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
};

export { UnikoSafer };
export default UnikoSafer;
