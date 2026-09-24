// src/modules/uniko-security/index.jsx
// Uniko Security — mesma ideia do Uniko Safer (organizador de conversas do
// WhatsApp por contato, com etiquetas, busca e auditoria), mas alimentado
// pela WhatsApp Cloud API OFICIAL (número em modo Coexistence: app do
// celular + API ao mesmo tempo) em vez do robô Playwright no WhatsApp Web.
// Por isso este módulo não tem NENHUMA tela de importação/robô — as
// mensagens chegam sozinhas via webhook (ver
// crescent-hub-server/whatsappCloudApi.js) e este arquivo só lê/organiza o
// que já está no Supabase. Admin-only de verdade (nem moderador) — ver
// gating em App.jsx/ModuleSelector.jsx.
import { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';
import { getAuthUser, SERVER_URL } from '../../contexts/user';
import { supabase } from './securitySupabase';
import { useIsMobile } from '../../hooks/useIsMobile';

const initials = (name) => (name || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
const formatTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const formatDayLabel = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); };
const formatDateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const dayKey = (iso) => iso.slice(0, 10);

// Recorta um trecho em volta da primeira ocorrência do termo, igual a busca
// global do WhatsApp mostra só o pedaço relevante da mensagem.
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

const IcoBack = () => (<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>);
const IcoSearch = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
const IcoTrash = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>);
const IcoEdit = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>);
const IcoClose = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
const IcoDots = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>);
const IcoSelect = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>);
const IcoSort = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h6M3 12h4M3 17h2" /><path d="M17 4v16M17 4l4 4M17 4l-4 4" /></svg>);
const IcoTag = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 12.3L12.7 20.2a2 2 0 01-2.8 0l-6-6a2 2 0 010-2.8l7.9-7.9A2 2 0 0113.3 3H19a2 2 0 012 2v5.7a2 2 0 01-.4 1.6z" /><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" /></svg>);
const IcoAudit = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a2 2 0 012 2v1h1a1 1 0 011 1v13a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h1V5a2 2 0 012-2z" /><path d="M9 3a2 2 0 002 2h2a2 2 0 002-2" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></svg>);
const IcoRefresh = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 11-2.1-9.4L23 10" /></svg>);
const IcoShieldDown = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v6M9 11l3 3 3-3" /></svg>);
const IcoUpload = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>);
const IcoHistory = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>);
const IcoDownload = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>);

const TAG_COLORS = ['#d4a017', '#e0533d', '#3ba55c', '#4a90d9', '#9b59b6', '#e8935a', '#5bb8a8', '#c65da0'];

// Um setor = um número/conexão Dualhook diferente (ver UNIKO_SECURITY_SECTORS
// em whatsappCloudApi.js). Acrescente aqui quando conectar um setor novo —
// precisa bater com o `category` configurado no servidor.
const CATEGORIES = [
  { id: 'faturamento', label: 'Faturamento' },
  { id: 'financeiro', label: 'Financeiro' },
];

const AUDIT_ACTIONS = [
  { id: 'all', label: 'Tudo' },
  { id: 'view', label: 'Visualizações', color: '#4a90d9' },
  { id: 'edit', label: 'Edições', color: '#e8935a' },
  { id: 'delete', label: 'Exclusões', color: '#e0533d' },
];
const auditActionLabel = (action) => ({ view: 'Visualizou', edit: 'Editou', delete: 'Excluiu' }[action] || action);
const auditActionColor = (action) => AUDIT_ACTIONS.find(a => a.id === action)?.color || '#888';

const btnStyle = (variant) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', border: '1px solid transparent', whiteSpace: 'nowrap' };
  if (variant === 'primary') return { ...base, background: T.gold, color: '#fff' };
  if (variant === 'danger') return { ...base, background: 'transparent', color: T.danger, border: `1px solid ${T.dangerGl ? T.danger + '55' : T.border}` };
  return { ...base, background: T.surfaceSub || 'rgba(0,0,0,0.04)', color: T.textS, border: `1px solid ${T.border}` };
};

// Enquanto o módulo estiver aberto: barra lateral se atualiza sozinha a cada
// 25s (pega contato/ordem novos) e a conversa aberta a cada 8s (pega
// mensagem nova) — não é WebSocket/Realtime de propósito (a política de RLS
// deste módulo depende de um cabeçalho HTTP próprio, x-ch-auth, que o canal
// Realtime do Supabase não carrega da mesma forma; polling simples evita
// essa incerteza e usa o MESMO caminho, já comprovado, das leituras normais).
const CONTACTS_POLL_MS = 25000;
const CHAT_POLL_MS = 8000;

const UnikoSecurity = ({ onBack }) => {
  const isMobile = useIsMobile();
  const authUser = getAuthUser();
  const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  const [contacts, setContacts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('faturamento');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('recent'); // 'recent' | 'asc' | 'desc'
  const [tags, setTags] = useState([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [tagContextMenu, setTagContextMenu] = useState(null); // {contactId, x, y}
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('all');
  const [messageResults, setMessageResults] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const messageSearchTimer = useRef(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [currentChatMessages, setCurrentChatMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [contactModal, setContactModal] = useState(null); // {id, name, notes, tag_ids}
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const chatScrollRef = useRef(null);

  // ── Backup criptografado (.ukbak) — gerar (tudo ou 1 contato), importar/ler
  // e histórico dos automáticos mensais. Ver unikoSecurityBackup.js no servidor.
  // progressModal: { title, pct (0-100 ou null p/ indeterminado), sublabel }
  const [progressModal, setProgressModal] = useState(null);
  const [importedBackup, setImportedBackup] = useState(null); // { data, viewingContactId }
  const [autoBackupsOpen, setAutoBackupsOpen] = useState(false);
  const [autoBackups, setAutoBackups] = useState([]);
  const [autoBackupsLoading, setAutoBackupsLoading] = useState(false);
  const importFileRef = useRef(null);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` });

  const downloadBlobDirect = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const fmtMB = (bytes) => `${(bytes / 1e6).toFixed(1)}MB`;

  // Lê a resposta em pedaços (em vez de só res.blob()) pra dar pra mostrar
  // progresso de download de verdade — usa Content-Length quando o servidor
  // manda; sem ele, mostra só os MB baixados (barra indeterminada).
  const readResponseWithProgress = async (res, onProgress) => {
    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(received, total);
    }
    return new Blob(chunks);
  };

  const generateBackup = async (scope, contactId, label) => {
    setProgressModal({ title: scope === 'all' ? 'Gerando backup completo…' : 'Gerando backup da conversa…', pct: null, sublabel: 'Preparando…' });
    try {
      const startRes = await fetch(`${SERVER_URL}/api/security/backup/start`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, contactId }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'falha ao iniciar');
      const { jobId } = startData;

      let status = 'running';
      while (status === 'running') {
        await new Promise(r => setTimeout(r, 1000));
        const stRes = await fetch(`${SERVER_URL}/api/security/backup/status/${jobId}`, { headers: authHeaders() });
        const st = await stRes.json();
        status = st.status;
        if (status === 'error') throw new Error(st.error || 'falha ao gerar');
        const p = st.progress;
        setProgressModal({
          title: scope === 'all' ? 'Gerando backup completo…' : 'Gerando backup da conversa…',
          pct: p?.total ? (p.done / p.total) * 100 : null,
          sublabel: p?.total ? `${p.done} de ${p.total} contato${p.total === 1 ? '' : 's'} processado${p.total === 1 ? '' : 's'}` : 'Preparando…',
        });
      }

      setProgressModal({ title: 'Baixando arquivo…', pct: 0, sublabel: '' });
      const dlRes = await fetch(`${SERVER_URL}/api/security/backup/download/${jobId}`, { headers: authHeaders() });
      if (!dlRes.ok) throw new Error('falha ao baixar o backup pronto');
      const blob = await readResponseWithProgress(dlRes, (received, total) => {
        setProgressModal({ title: 'Baixando arquivo…', pct: total ? (received / total) * 100 : null, sublabel: total ? `${fmtMB(received)} de ${fmtMB(total)}` : fmtMB(received) });
      });
      downloadBlobDirect(blob, `uniko-security-backup-${label}-${new Date().toISOString().slice(0, 10)}.ukbak`);
      flash('Backup baixado — arquivo só abre aqui no Uniko Security.');
    } catch (e) {
      flash('Erro no backup: ' + e.message);
    } finally {
      setProgressModal(null);
    }
  };

  // Upload com progresso de verdade precisa de XMLHttpRequest — fetch não
  // expõe evento de progresso de ENVIO (só de download), e um backup
  // completo com mídia pode ser grande o bastante pra isso importar de
  // verdade (achado ao vivo 24/set/2026).
  const uploadWithProgress = (url, form, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('ch_token') || ''}`);
    xhr.upload.onprogress = (e) => onProgress({ phase: 'upload', loaded: e.loaded, total: e.lengthComputable ? e.total : 0 });
    xhr.onprogress = (e) => onProgress({ phase: 'download', loaded: e.loaded, total: e.lengthComputable ? e.total : 0 });
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { return reject(new Error('Resposta inválida do servidor')); }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Falha de rede'));
    xhr.send(form);
  });

  const handleImportBackupFile = async (file) => {
    if (!file) return;
    setProgressModal({ title: 'Enviando arquivo…', pct: 0, sublabel: fmtMB(file.size) });
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await uploadWithProgress(`${SERVER_URL}/api/security/backup/decrypt`, form, ({ phase, loaded, total }) => {
        if (phase === 'upload') {
          const done = total > 0 && loaded >= total;
          setProgressModal({ title: done ? 'Decifrando…' : 'Enviando arquivo…', pct: done ? null : (total ? (loaded / total) * 100 : null), sublabel: total ? `${fmtMB(loaded)} de ${fmtMB(total)}` : '' });
        } else {
          setProgressModal({ title: 'Recebendo resultado…', pct: total ? (loaded / total) * 100 : null, sublabel: total ? `${fmtMB(loaded)} de ${fmtMB(total)}` : fmtMB(loaded) });
        }
      });
      setImportedBackup({ data, viewingContactId: data.contacts?.[0]?.id ?? null });
      setMoreMenuOpen(false);
    } catch (e) {
      flash('Erro ao importar: ' + e.message);
    } finally {
      setProgressModal(null);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const openAutoBackups = async () => {
    setMoreMenuOpen(false);
    setAutoBackupsOpen(true);
    setAutoBackupsLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/security/backup/auto/list`, { headers: authHeaders() });
      const data = await res.json();
      setAutoBackups(res.ok ? data : []);
    } catch { setAutoBackups([]); }
    setAutoBackupsLoading(false);
  };

  const downloadAutoBackup = async (row) => {
    setProgressModal({ title: 'Baixando arquivo…', pct: 0, sublabel: '' });
    try {
      const res = await fetch(`${SERVER_URL}/api/security/backup/auto/${row.id}/download`, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error || 'falha ao baixar');
      const blob = await readResponseWithProgress(res, (received, total) => {
        setProgressModal({ title: 'Baixando arquivo…', pct: total ? (received / total) * 100 : null, sublabel: total ? `${fmtMB(received)} de ${fmtMB(total)}` : fmtMB(received) });
      });
      downloadBlobDirect(blob, row.path);
    } catch (e) { flash('Erro: ' + e.message); } finally { setProgressModal(null); }
  };

  const loadContacts = async () => {
    const { data, error } = await supabase.from('uniko_security_contacts').select('*').order('name');
    if (error) { flash('Erro ao carregar contatos: ' + error.message); setLoadingContacts(false); return; }
    setContacts(data || []);
    setLoadingContacts(false);
  };

  const switchCategory = (cat) => {
    setActiveCategory(cat);
    // Sai da conversa aberta se ela não for do setor pra onde acabou de
    // trocar — senão a tela de chat ficava mostrando alguém que sumiu da
    // lista ao lado.
    const sel = contacts.find(c => c.id === selectedContactId);
    if (sel && (sel.category || 'faturamento') !== cat) setSelectedContactId(null);
  };

  const loadTags = async () => {
    const { data, error } = await supabase.from('uniko_security_tags').select('*').order('name');
    if (!error) setTags(data || []);
  };

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const { error } = await supabase.from('uniko_security_tags').insert({ name, color: newTagColor });
    if (error) { flash('Erro ao criar etiqueta: ' + error.message); return; }
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    await loadTags();
  };

  const deleteTag = async (tagId) => {
    if (!window.confirm('Excluir essa etiqueta? Ela some de todos os contatos que a usam.')) return;
    await supabase.from('uniko_security_tags').delete().eq('id', tagId);
    const affected = contacts.filter(c => (c.tag_ids || []).includes(tagId));
    await Promise.all(affected.map(c =>
      supabase.from('uniko_security_contacts').update({ tag_ids: c.tag_ids.filter(id => id !== tagId) }).eq('id', c.id)
    ));
    await Promise.all([loadTags(), loadContacts()]);
  };

  const toggleContactTag = (tagId) => {
    setContactModal(m => {
      const has = (m.tag_ids || []).includes(tagId);
      return { ...m, tag_ids: has ? m.tag_ids.filter(id => id !== tagId) : [...(m.tag_ids || []), tagId] };
    });
  };

  const toggleContactTagDirect = async (contact, tagId) => {
    const has = (contact.tag_ids || []).includes(tagId);
    const nextTagIds = has ? contact.tag_ids.filter(id => id !== tagId) : [...(contact.tag_ids || []), tagId];
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, tag_ids: nextTagIds } : c));
    const { error } = await supabase.from('uniko_security_contacts').update({ tag_ids: nextTagIds }).eq('id', contact.id);
    if (error) { flash('Erro: ' + error.message); await loadContacts(); }
  };

  useEffect(() => { loadContacts(); loadTags(); }, []);

  // Barra lateral se atualiza sozinha (ver CONTACTS_POLL_MS acima) — pega
  // contato novo (primeira mensagem de alguém nunca visto) e reordena por
  // atividade mais recente, sem precisar de ação manual.
  useEffect(() => {
    const t = setInterval(loadContacts, CONTACTS_POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!tagContextMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setTagContextMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tagContextMenu]);

  // Busca global de mensagens (estilo WhatsApp) — debounce pra não disparar
  // uma consulta a cada tecla.
  useEffect(() => {
    clearTimeout(messageSearchTimer.current);
    const q = search.trim();
    if (q.length < 2) { setMessageResults([]); setSearchingMessages(false); return; }
    messageSearchTimer.current = setTimeout(async () => {
      setSearchingMessages(true);
      const { data, error } = await supabase.from('uniko_security_messages')
        .select('id, contact_id, sent_at, direction, text')
        .ilike('text', `%${q}%`)
        .order('sent_at', { ascending: false })
        .limit(80);
      setSearchingMessages(false);
      setMessageResults(error ? [] : (data || []));
    }, 350);
    return () => clearTimeout(messageSearchTimer.current);
  }, [search]);

  // Best-effort, nunca trava a tela — auditoria é extra, não bloqueio (isso
  // já é papel da RLS). action: 'view'|'edit'|'delete'.
  const logSecurityAction = (action, { contactId = null, contactName = null, details = null } = {}) => {
    try {
      supabase.from('uniko_security_access_log').insert({
        contact_id: contactId, contact_name: contactName,
        viewer_name: authUser?.name || null, viewer_role: authUser?.role || null,
        action, details,
      }).then(() => {}, () => {});
    } catch {}
  };

  // Busca as ÚLTIMAS mensagens (ordem decrescente + limite), depois inverte
  // pra ordem cronológica. Achado ao vivo (24/set/2026, contato com 1615
  // mensagens): pedir em ordem CRESCENTE sem limite deixava o corte de
  // linhas do Supabase cair nas mais ANTIGAS sobrarem e as mais NOVAS (as
  // de hoje) ficarem de fora — a conversa parecia "travada", nunca mostrando
  // mensagem nova nenhuma, mesmo já salva certinha no banco.
  const CHAT_MESSAGES_LIMIT = 500;
  const loadChatMessages = async (contactId, { silent = false } = {}) => {
    if (!silent) setLoadingChat(true);
    const { data, error } = await supabase.from('uniko_security_messages')
      .select('sent_at, direction, text, msg_type, media_url').eq('contact_id', contactId)
      .order('sent_at', { ascending: false }).limit(CHAT_MESSAGES_LIMIT);
    if (error) { if (!silent) { flash('Erro ao carregar mensagens: ' + error.message); setLoadingChat(false); } return; }
    setCurrentChatMessages((data || []).reverse().map(r => ({ timestamp: r.sent_at, direction: r.direction, text: r.text, msgType: r.msg_type, mediaUrl: r.media_url })));
    if (!silent) setLoadingChat(false);
  };

  // Só desce sozinho quando o usuário já está perto do final — senão o
  // poll de fundo (a cada CHAT_POLL_MS) arrancava a rolagem de volta pro
  // fim toda vez que chegava mensagem nova, mesmo com a pessoa lendo
  // mensagens antigas lá em cima (bug relatado 24/set/2026).
  const nearBottomRef = useRef(true);
  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const selectContact = (id) => {
    setSelectedContactId(id);
    setChatSearchOpen(false);
    setChatSearchTerm('');
    nearBottomRef.current = true; // toda conversa nova abre já no final
    loadChatMessages(id);
    logSecurityAction('view', { contactId: id, contactName: contacts.find(c => c.id === id)?.name || null });
  };

  // Conversa aberta se atualiza sozinha (ver CHAT_POLL_MS) — silenciosa (sem
  // spinner) pra não piscar a tela a cada ciclo.
  useEffect(() => {
    if (!selectedContactId) return;
    const t = setInterval(() => loadChatMessages(selectedContactId, { silent: true }), CHAT_POLL_MS);
    return () => clearInterval(t);
  }, [selectedContactId]);

  // Abre a conversa já na mensagem mais recente, igual ao WhatsApp de
  // verdade, em vez de começar do topo — mas só refaz isso sozinho se o
  // usuário já estava perto do final (ver nearBottomRef acima).
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [currentChatMessages]);

  const openMessageResult = (contactId) => {
    setSelectedContactId(contactId);
    loadChatMessages(contactId);
    setChatSearchOpen(true);
    setChatSearchTerm(search);
  };

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  const loadAuditLog = async () => {
    setAuditLoading(true);
    const { data, error } = await supabase.from('uniko_security_access_log').select('*').order('viewed_at', { ascending: false }).limit(300);
    if (error) { flash('Erro ao carregar auditoria: ' + error.message); setAuditLoading(false); return; }
    setAuditLog(data || []);
    setAuditLoading(false);
  };
  const openAuditLog = () => { setAuditFilter('all'); setAuditModalOpen(true); loadAuditLog(); };

  const openContactModal = () => {
    if (!selectedContact) return;
    setContactModal({ id: selectedContact.id, name: selectedContact.name, notes: selectedContact.notes || '', tag_ids: selectedContact.tag_ids || [] });
  };

  const saveContact = async () => {
    if (!contactModal) return;
    const name = contactModal.name.trim();
    if (!name) { flash('Informe o nome do contato.'); return; }
    const before = contacts.find(c => c.id === contactModal.id);
    // name_manual: a partir daqui o webhook para de sobrescrever o nome com
    // o nome de perfil do WhatsApp (ver whatsappCloudApi.js).
    const payload = { name, name_manual: true, notes: contactModal.notes.trim() || null, tag_ids: contactModal.tag_ids || [] };
    const { error } = await supabase.from('uniko_security_contacts').update(payload).eq('id', contactModal.id);
    if (error) { flash('Erro: ' + error.message); return; }
    const changes = [];
    if (before && before.name !== payload.name) changes.push(`nome: "${before.name}" → "${payload.name}"`);
    logSecurityAction('edit', { contactId: contactModal.id, contactName: payload.name, details: changes.length ? changes.join('; ') : 'Notas/etiquetas atualizadas' });
    flash('Contato atualizado.');
    setContactModal(null);
    await loadContacts();
  };

  const deleteContact = async (contact) => {
    if (!window.confirm(`Excluir "${contact.name}" e todo o histórico de mensagens associado? Essa ação não pode ser desfeita.`)) return;
    logSecurityAction('delete', { contactId: contact.id, contactName: contact.name });
    const { error } = await supabase.from('uniko_security_contacts').delete().eq('id', contact.id);
    if (error) { flash('Erro: ' + error.message); return; }
    if (selectedContactId === contact.id) setSelectedContactId(null);
    flash('Contato excluído.');
    await loadContacts();
  };

  const toggleSelectionMode = () => { setSelectionMode(v => !v); setSelectedIds(new Set()); };
  const toggleSelected = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filteredContacts = contacts.filter(c => {
    if ((c.category || 'faturamento') !== activeCategory) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.wa_id || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortMode === 'asc') return a.name.localeCompare(b.name);
    if (sortMode === 'desc') return b.name.localeCompare(a.name);
    if (!a.last_message_at && !b.last_message_at) return a.name.localeCompare(b.name);
    if (!a.last_message_at) return 1;
    if (!b.last_message_at) return -1;
    return b.last_message_at.localeCompare(a.last_message_at);
  });
  // Resultado de busca de mensagem só conta se o contato dono dela for do
  // setor ativo (a busca em si roda em uniko_security_messages, sem coluna
  // de setor própria — cruza com a lista de contatos já carregada).
  const visibleMessageResults = search.trim().length >= 2
    ? messageResults.filter(r => (contacts.find(c => c.id === r.contact_id)?.category || 'faturamento') === activeCategory).slice(0, 20)
    : [];
  const selectAllVisible = () => setSelectedIds(new Set(filteredContacts.map(c => c.id)));
  const deselectAll = () => setSelectedIds(new Set());
  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Excluir ${ids.length} contato${ids.length > 1 ? 's' : ''} selecionado${ids.length > 1 ? 's' : ''} e todo o histórico associado? Essa ação não pode ser desfeita.`)) return;
    ids.forEach(id => {
      const c = contacts.find(x => x.id === id);
      logSecurityAction('delete', { contactId: id, contactName: c?.name || null, details: 'Exclusão em massa' });
    });
    const { error } = await supabase.from('uniko_security_contacts').delete().in('id', ids);
    if (error) { flash('Erro: ' + error.message); return; }
    if (selectedContactId && ids.includes(selectedContactId)) setSelectedContactId(null);
    flash(`${ids.length} contato${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''}.`);
    setSelectionMode(false); setSelectedIds(new Set());
    await loadContacts();
  };

  // ── Render: mensagens do chat ────────────────────────────────────────
  const term = chatSearchTerm.trim().toLowerCase();
  const visibleMessages = term ? currentChatMessages.filter(m => m.text.toLowerCase().includes(term)) : currentChatMessages;
  const dividerStyle = { alignSelf: 'center', textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.textT, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '4px 14px', margin: '16px auto 8px', width: 'fit-content' };

  const renderChat = () => {
    if (loadingChat) return <div style={{ padding: 40, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando conversa…</div>;
    if (currentChatMessages.length === 0) {
      return (
        <div style={{ margin: '40px 24px', padding: 28, textAlign: 'center', color: T.textT, fontSize: 13, background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhuma mensagem chegou ainda pra esse contato.
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
      const fromMe = m.direction === 'out';
      return (
        <div key={i}>
          {divider && <div style={dividerStyle}>{formatDayLabel(m.timestamp)}</div>}
          <div style={{ display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start', width: '100%', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '68%', alignItems: fromMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ padding: m.msgType === 'image' && m.mediaUrl ? 4 : '8px 12px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: fromMe ? (T.green || T.gold) : T.surface, color: fromMe ? '#fff' : T.text,
                border: fromMe ? 'none' : `1px solid ${T.border}`,
                borderBottomRightRadius: fromMe ? 4 : 16, borderBottomLeftRadius: fromMe ? 16 : 4 }}>
                {m.msgType === 'image' && m.mediaUrl ? (
                  <>
                    <img src={m.mediaUrl} alt="" style={{ display: 'block', maxWidth: 280, maxHeight: 320, borderRadius: 12, cursor: 'pointer' }}
                      onClick={() => window.open(m.mediaUrl, '_blank', 'noopener')} />
                    {m.text && m.text !== '[imagem]' && <div style={{ padding: '6px 6px 2px' }}>{m.text}</div>}
                  </>
                ) : m.msgType === 'audio' && m.mediaUrl ? (
                  <audio controls src={m.mediaUrl} style={{ maxWidth: 260 }} />
                ) : (
                  m.text
                )}
              </div>
              <div style={{ fontSize: 10.5, color: T.textT, margin: '3px 4px 0' }}>{formatTime(m.timestamp)}</div>
            </div>
          </div>
        </div>
      );
    });
  };

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
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text }}>Uniko Security</div>
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
                <button title="Atualizar agora" onClick={loadContacts} style={{ ...btnStyle('secondary'), padding: '7px 9px' }}><IcoRefresh /></button>
                <button title="Mais opções" onClick={() => setMoreMenuOpen(true)} style={{ ...btnStyle('secondary'), padding: '7px 9px' }}><IcoDots /></button>
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
              <button onClick={() => setSortMode(m => m === 'recent' ? 'asc' : m === 'asc' ? 'desc' : 'recent')} title="Ordenar contatos" style={{ ...btnStyle('secondary'), padding: '7px 10px' }}>
                <IcoSort /> {sortMode === 'recent' ? 'Recentes' : sortMode === 'asc' ? 'A—Z' : 'Z—A'}
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
                  {contacts.filter(c => (c.category || 'faturamento') === activeCategory).length === 0
                    ? 'Nenhuma conversa chegou ainda nesse setor. Assim que alguém mandar mensagem pro número, o contato aparece aqui sozinho.'
                    : 'Nenhum contato encontrado.'}
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
                      {c.wa_id && <div style={{ fontSize: 12, color: T.textT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>+{c.wa_id}</div>}
                      {(c.tag_ids || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {c.tag_ids.map(tid => {
                            const tag = tags.find(t => t.id === tid);
                            if (!tag) return null;
                            return <span key={tid} style={{ fontSize: 10, fontWeight: 700, color: tag.color, background: `${tag.color}22`, borderRadius: 20, padding: '1px 7px' }}>{tag.name}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {search.trim().length >= 2 && (searchingMessages || visibleMessageResults.length > 0) && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <div style={{ padding: '0 10px 6px', fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Mensagens{searchingMessages ? '…' : ''}
                  </div>
                  {visibleMessageResults.map(r => {
                    const rc = contacts.find(x => x.id === r.contact_id);
                    return (
                      <div key={r.id} onClick={() => openMessageResult(r.contact_id)}
                        style={{ padding: '8px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2 }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{rc?.name || 'Contato removido'}</div>
                        <div style={{ fontSize: 12, color: T.textT, marginTop: 2 }}>{highlightMatch(snippetAround(r.text, search.trim()), search.trim())}</div>
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
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!selectedContact ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textT, fontSize: 13.5, textAlign: 'center', padding: 24 }}>
                Selecione um contato pra ver a conversa.
              </div>
            ) : (
              <>
                <div style={{ height: 64, flexShrink: 0, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}>
                  {isMobile && (
                    <button onClick={() => setSelectedContactId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoBack /></button>
                  )}
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(selectedContact.name) || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedContact.name}</div>
                    {selectedContact.wa_id && <div style={{ fontSize: 11.5, color: T.textT }}>+{selectedContact.wa_id}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setChatSearchOpen(v => !v)} style={btnStyle('secondary')}><IcoSearch /> Buscar</button>
                    <button title="Baixar backup desta conversa" onClick={() => generateBackup('contact', selectedContact.id, selectedContact.name.replace(/[^a-z0-9]+/gi, '-'))} style={btnStyle('secondary')}><IcoShieldDown /></button>
                    <button onClick={openContactModal} style={btnStyle('secondary')}><IcoEdit /> Editar</button>
                    <button onClick={() => deleteContact(selectedContact)} style={btnStyle('danger')}><IcoTrash /></button>
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

                <div ref={chatScrollRef} onScroll={handleChatScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '16px' : '20px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderChat()}
                </div>

                {/* Sem campo de "digite uma mensagem" de propósito — este
                    módulo é um arquivo de conversas, não um cliente de
                    WhatsApp; responder continua sendo feito no app do
                    celular (modo Coexistence), que ecoa de volta pra cá. */}
                <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${T.border}`, background: T.surface,
                  textAlign: 'center', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: T.textT }}>
                  ARQUIVO DE CONVERSA · SÓ LEITURA
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal: editar contato (nome/notas/etiquetas — sem criar, contato só existe depois da 1ª mensagem) */}
      {contactModal && (
        <div onClick={() => setContactModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 380, maxWidth: '100%', boxShadow: T.shL }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Editar contato</div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '0 0 6px' }}>Nome</label>
            <input autoFocus value={contactModal.name} onChange={e => setContactModal(m => ({ ...m, name: e.target.value }))} style={inputStyle} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textT, margin: '10px 0 6px' }}>Notas</label>
            <textarea value={contactModal.notes} onChange={e => setContactModal(m => ({ ...m, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
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

      {/* Modal: gerenciar etiquetas personalizadas */}
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
            <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Ex: Urgente" style={{ ...inputStyle, marginBottom: 10 }} />
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
            <div style={{ position: 'fixed', top, left, zIndex: 551, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.shL, padding: 6, minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, padding: '6px 8px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Etiquetas de {contact.name}</div>
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
                Nova etiqueta
              </button>
            </div>
          </>
        );
      })()}

      {/* Menu "Mais opções" */}
      {moreMenuOpen && (
        <div onClick={() => setMoreMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 420, maxWidth: '100%', boxShadow: T.shL }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Mais opções</div>
              <button onClick={() => setMoreMenuOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT }}><IcoClose /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <IcoSelect />, title: 'Selecionar contatos', desc: 'Marque vários contatos pra excluir de uma vez', onClick: () => { setMoreMenuOpen(false); toggleSelectionMode(); } },
                { icon: <IcoAudit />, title: 'Registro de auditoria', desc: 'Quem viu, editou ou excluiu cada conversa', onClick: () => { setMoreMenuOpen(false); openAuditLog(); } },
                { icon: <IcoShieldDown />, title: 'Backup completo', desc: 'Baixa todas as conversas (texto + mídia) num arquivo criptografado', onClick: () => { setMoreMenuOpen(false); generateBackup('all', null, 'completo'); } },
                { icon: <IcoUpload />, title: 'Importar backup', desc: 'Abre um .ukbak baixado antes — só o Uniko Security sabe ler', onClick: () => importFileRef.current?.click() },
                { icon: <IcoHistory />, title: 'Backups automáticos', desc: 'Histórico dos backups mensais gerados sozinhos (últimos 12)', onClick: openAutoBackups },
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

      {/* Tela cheia: registro de auditoria */}
      {auditModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: T.page, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'), borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
            <button onClick={() => setAuditModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoClose /></button>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Registro de auditoria</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '28px 20px' }}>
            <div style={{ width: '100%', maxWidth: 720 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {AUDIT_ACTIONS.map(a => {
                  const sel = auditFilter === a.id;
                  return (
                    <button key={a.id} onClick={() => setAuditFilter(a.id)}
                      style={{ padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                        border: `1.5px solid ${sel ? T.gold : T.border}`, background: sel ? T.goldGl : 'transparent', color: sel ? T.gold : T.textS }}>
                      {a.label}
                    </button>
                  );
                })}
                <button onClick={loadAuditLog} title="Atualizar" style={{ ...btnStyle('secondary'), padding: '7px 10px', marginLeft: 'auto' }}>↻</button>
              </div>
              {auditLoading ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando…</div>
              ) : (() => {
                const rows = auditFilter === 'all' ? auditLog : auditLog.filter(r => r.action === auditFilter);
                if (rows.length === 0) return <div style={{ padding: '24px 0', textAlign: 'center', color: T.textT, fontSize: 13 }}>Nada registrado ainda.</div>;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rows.map(r => (
                      <div key={r.id} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: auditActionColor(r.action), background: `${auditActionColor(r.action)}22`, borderRadius: 20, padding: '2px 9px' }}>
                            {auditActionLabel(r.action)}
                          </span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{r.contact_name || 'Contato removido'}</span>
                          <span style={{ fontSize: 11.5, color: T.textT, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{formatDateTime(r.viewed_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.textT, marginTop: 4 }}>{r.viewer_name || 'Alguém'}{r.viewer_role ? ` (${r.viewer_role})` : ''}</div>
                        {r.details && <div style={{ fontSize: 12, color: T.textT, marginTop: 4, fontStyle: 'italic' }}>{r.details}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Input escondido — "Importar backup" no menu "Mais opções" só clica nele. */}
      <input ref={importFileRef} type="file" accept=".ukbak" style={{ display: 'none' }}
        onChange={e => handleImportBackupFile(e.target.files?.[0])} />

      {/* Tela cheia: histórico dos backups automáticos mensais */}
      {autoBackupsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: T.page, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'), borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
            <button onClick={() => setAutoBackupsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoClose /></button>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Backups automáticos</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '28px 20px' }}>
            <div style={{ width: '100%', maxWidth: 640 }}>
              {autoBackupsLoading ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando…</div>
              ) : autoBackups.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: T.textT, fontSize: 13 }}>Nenhum backup automático gerado ainda — o primeiro roda no dia 1 do próximo mês, às 3h.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {autoBackups.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{b.path}</div>
                        <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>{formatDateTime(b.created_at)} · {(b.size_bytes / 1024 / 1024).toFixed(1)} MB</div>
                      </div>
                      <button onClick={() => downloadAutoBackup(b)} style={btnStyle('secondary')}><IcoDownload /> Baixar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tela cheia: backup importado (.ukbak decifrado) — leitura, mesmo espírito do "ARQUIVO DE CONVERSA · SÓ LEITURA" */}
      {importedBackup && (() => {
        const ib = importedBackup.data;
        const contact = ib.contacts.find(c => c.id === importedBackup.viewingContactId);
        let lastDay = null;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: T.page, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'), borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
              <button onClick={() => setImportedBackup(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoClose /></button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Backup importado</div>
                <div style={{ fontSize: 11, color: T.textT }}>Gerado em {formatDateTime(ib.generatedAt)} · {ib.scope === 'all' ? 'todas as conversas' : '1 conversa'}</div>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: 280, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.border}`, overflowY: 'auto', padding: '10px' }}>
                {ib.contacts.map(c => (
                  <div key={c.id} onClick={() => setImportedBackup(b => ({ ...b, viewingContactId: c.id }))}
                    style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, background: c.id === importedBackup.viewingContactId ? (T.goldGl || T.surfaceSub) : 'transparent' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>{c.messages.length} mensage{c.messages.length === 1 ? 'm' : 'ns'}</div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isMobile ? '16px' : '20px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {!contact ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textT, fontSize: 13.5 }}>Selecione um contato.</div>
                ) : contact.messages.length === 0 ? (
                  <div style={{ margin: '40px 24px', padding: 28, textAlign: 'center', color: T.textT, fontSize: 13, background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16 }}>Nenhuma mensagem.</div>
                ) : contact.messages.map((m, i) => {
                  const key = dayKey(m.sentAt);
                  const divider = key !== lastDay;
                  lastDay = key;
                  const fromMe = m.direction === 'out';
                  return (
                    <div key={i}>
                      {divider && <div style={dividerStyle}>{formatDayLabel(m.sentAt)}</div>}
                      <div style={{ display: 'flex', justifyContent: fromMe ? 'flex-end' : 'flex-start', width: '100%', marginTop: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '68%', alignItems: fromMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{ padding: m.msgType === 'image' && m.mediaBase64 ? 4 : '8px 12px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            background: fromMe ? (T.green || T.gold) : T.surface, color: fromMe ? '#fff' : T.text,
                            border: fromMe ? 'none' : `1px solid ${T.border}`,
                            borderBottomRightRadius: fromMe ? 4 : 16, borderBottomLeftRadius: fromMe ? 16 : 4 }}>
                            {m.msgType === 'image' && m.mediaBase64 ? (
                              <>
                                <img src={`data:${m.mediaMime || 'image/jpeg'};base64,${m.mediaBase64}`} alt="" style={{ display: 'block', maxWidth: 280, maxHeight: 320, borderRadius: 12 }} />
                                {m.text && m.text !== '[imagem]' && <div style={{ padding: '6px 6px 2px' }}>{m.text}</div>}
                              </>
                            ) : m.msgType === 'audio' && m.mediaBase64 ? (
                              <audio controls src={`data:${m.mediaMime || 'audio/ogg'};base64,${m.mediaBase64}`} style={{ maxWidth: 260 }} />
                            ) : m.text}
                          </div>
                          <div style={{ fontSize: 10.5, color: T.textT, margin: '3px 4px 0' }}>{formatTime(m.sentAt)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {progressModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: T.surface, borderRadius: 18, padding: '26px 26px 22px', width: 340, maxWidth: '100%', boxShadow: T.shL, textAlign: 'center' }}>
            <style>{`
              @keyframes progressIndeterminate { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
            `}</style>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 4 }}>{progressModal.title}</div>
            <div style={{ fontSize: 12, color: T.textT, marginBottom: 16, minHeight: 16 }}>{progressModal.sublabel}</div>
            <div style={{ height: 8, borderRadius: 6, background: T.surfaceSub || 'rgba(0,0,0,0.06)', overflow: 'hidden', position: 'relative' }}>
              {progressModal.pct == null ? (
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 6, background: T.gold, animation: 'progressIndeterminate 1.1s ease-in-out infinite' }} />
              ) : (
                <div style={{ height: '100%', borderRadius: 6, background: T.gold, width: `${Math.min(100, Math.max(2, progressModal.pct))}%`, transition: 'width .2s ease' }} />
              )}
            </div>
            {progressModal.pct != null && (
              <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, marginTop: 8 }}>{Math.round(progressModal.pct)}%</div>
            )}
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

export default UnikoSecurity;
