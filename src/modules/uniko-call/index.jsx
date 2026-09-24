// src/modules/uniko-call/index.jsx
// Uniko Call — chamadas do WhatsApp Web gravadas pela extensão Cat-Bot
// (extension/offscreen.js) e transcritas pelo servidor (Groq Whisper, ver
// crescent-hub-server/uniko-call.js). Mesmo espírito visual do Uniko
// Security (lista de contatos + "chat"), simplificado: sem etiquetas nem
// auditoria na v1 — cada "mensagem" do chat é uma chamada inteira já
// transcrita, não uma troca de texto em tempo real.
import { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';
import { supabase } from './callSupabase';
import { useIsMobile } from '../../hooks/useIsMobile';

// Recorta um trecho em volta da 1ª ocorrência do termo (mesmo padrão do
// Uniko Security) — a transcrição de uma chamada pode ser longa, mostrar
// só o pedaço relevante é bem mais útil que o começo dela sempre.
const snippetAround = (text, q, radius = 42) => {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, 90);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
};
const highlightMatch = (text, q, T) => {
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

const initials = (name) => (name || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
const formatTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const formatDayLabel = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); };
const dayKey = (iso) => iso.slice(0, 10);
const durationLabel = (startedAt, endedAt) => {
  if (!endedAt) return '';
  const ms = new Date(endedAt) - new Date(startedAt);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const min = Math.floor(ms / 60000), sec = Math.round((ms % 60000) / 1000);
  return `${min}:${String(sec).padStart(2, '0')}`;
};

const IcoBack = () => (<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>);
const IcoSearch = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
const IcoTrash = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>);
const IcoClose = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
const IcoEdit = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>);
const IcoPhone = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.902.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.908.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>);
const IcoPlay = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>);
const IcoPause = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);

// Player customizado — o <audio controls> nativo tinha um bug visual real
// (barra preenchida pulando pro final em vez de acompanhar o segundo atual,
// achado ao vivo 24/set/2026) além de ficar feio/inconsistente entre
// navegadores. Aqui o <audio> fica escondido só como "motor" e a barra é
// desenhada e calculada por nós a partir de currentTime/duration — sem
// depender de como cada navegador renderiza o controle nativo.
const fmtDuration = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const AudioPlayer = ({ src }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onLoaded = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('durationchange', onLoaded);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('durationchange', onLoaded);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * duration;
    setCurrentTime(el.currentTime);
  };

  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 8px', borderRadius: 30, background: T.surfaceSub || 'rgba(0,0,0,0.05)', border: `1px solid ${T.border}`, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
      <button onClick={togglePlay} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: T.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, paddingLeft: playing ? 0 : 2 }}>
        {playing ? <IcoPause /> : <IcoPlay />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={seek} style={{ height: 6, borderRadius: 3, background: T.border, cursor: 'pointer', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 3, background: T.gold, transition: 'width .1s linear' }} />
          <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: T.gold, boxShadow: '0 1px 3px rgba(0,0,0,.4)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5, color: T.textT, fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmtDuration(currentTime)}</span>
          <span>{fmtDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
};
const IcoRefresh = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 11-2.1-9.4L23 10" /></svg>);

const btnStyle = (variant) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)', border: '1px solid transparent', whiteSpace: 'nowrap' };
  if (variant === 'primary') return { ...base, background: T.gold, color: '#fff' };
  if (variant === 'danger') return { ...base, background: 'transparent', color: T.danger, border: `1px solid ${T.dangerGl ? T.danger + '55' : T.border}` };
  return { ...base, background: T.surfaceSub || 'rgba(0,0,0,0.04)', color: T.textS, border: `1px solid ${T.border}` };
};

const CONTACTS_POLL_MS = 25000;
const CALLS_POLL_MS = 10000; // mais rápido que o Security — transcrição pode terminar minutos depois da chamada

const UnikoCall = ({ onBack }) => {
  const isMobile = useIsMobile();
  const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [renameModal, setRenameModal] = useState(null); // {id, name}
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const chatScrollRef = useRef(null);
  const [messageResults, setMessageResults] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const messageSearchTimer = useRef(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const flash = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2800); };

  const loadContacts = async () => {
    const { data, error } = await supabase.from('uniko_call_contacts').select('*').order('last_call_at', { ascending: false, nullsFirst: false });
    if (error) { flash('Erro ao carregar contatos: ' + error.message); setLoadingContacts(false); return; }
    setContacts(data || []);
    setLoadingContacts(false);
  };
  useEffect(() => { loadContacts(); }, []);
  useEffect(() => { const t = setInterval(loadContacts, CONTACTS_POLL_MS); return () => clearInterval(t); }, []);

  const loadCalls = async (contactId, { silent = false } = {}) => {
    if (!silent) setLoadingCalls(true);
    const { data, error } = await supabase.from('uniko_call_recordings').select('*').eq('contact_id', contactId).order('started_at');
    if (error) { if (!silent) { flash('Erro ao carregar chamadas: ' + error.message); setLoadingCalls(false); } return; }
    setCalls(data || []);
    if (!silent) setLoadingCalls(false);
  };
  const selectContact = (id) => { setSelectedContactId(id); loadCalls(id); };
  useEffect(() => {
    if (!selectedContactId) return;
    const t = setInterval(() => loadCalls(selectedContactId, { silent: true }), CALLS_POLL_MS);
    return () => clearInterval(t);
  }, [selectedContactId]);
  useEffect(() => { const el = chatScrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [calls]);

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  // Busca global nas TRANSCRIÇÕES das chamadas (estilo Uniko Security) —
  // roda com texto (2+ letras) e/ou com filtro de data marcado, mesmo sem
  // texto nenhum (dá pra só filtrar por período e ver tudo que rolou nele).
  useEffect(() => {
    clearTimeout(messageSearchTimer.current);
    const q = search.trim();
    if (q.length < 2 && !dateFrom && !dateTo) { setMessageResults([]); setSearchingMessages(false); return; }
    messageSearchTimer.current = setTimeout(async () => {
      setSearchingMessages(true);
      let query = supabase.from('uniko_call_recordings')
        .select('id, contact_id, started_at, transcript')
        .order('started_at', { ascending: false })
        .limit(80);
      if (q.length >= 2) query = query.ilike('transcript', `%${q}%`);
      if (dateFrom) query = query.gte('started_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('started_at', `${dateTo}T23:59:59`);
      const { data, error } = await query;
      setSearchingMessages(false);
      setMessageResults(error ? [] : (data || []).filter(r => r.transcript));
    }, 350);
    return () => clearTimeout(messageSearchTimer.current);
  }, [search, dateFrom, dateTo]);

  const openMessageResult = (contactId) => {
    setSelectedContactId(contactId);
    loadCalls(contactId);
  };

  // Filtro de data também vale pra conversa já aberta — não só pra busca.
  const visibleCalls = calls.filter(c => {
    if (dateFrom && c.started_at < `${dateFrom}T00:00:00`) return false;
    if (dateTo && c.started_at > `${dateTo}T23:59:59`) return false;
    return true;
  });

  const saveRename = async () => {
    if (!renameModal) return;
    const name = renameModal.name.trim();
    if (!name) { flash('Informe um nome.'); return; }
    const { error } = await supabase.from('uniko_call_contacts').update({ name, name_manual: true }).eq('id', renameModal.id);
    if (error) { flash('Erro: ' + error.message); return; }
    setRenameModal(null);
    flash('Contato renomeado.');
    await loadContacts();
  };

  const deleteContact = async (contact) => {
    if (!window.confirm(`Excluir "${contact.name}" e todas as chamadas gravadas dele? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('uniko_call_contacts').delete().eq('id', contact.id);
    if (error) { flash('Erro: ' + error.message); return; }
    if (selectedContactId === contact.id) setSelectedContactId(null);
    flash('Contato excluído.');
    await loadContacts();
  };

  const deleteCall = async (call) => {
    if (!window.confirm('Excluir essa chamada gravada? Essa ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('uniko_call_recordings').delete().eq('id', call.id);
    if (error) { flash('Erro: ' + error.message); return; }
    await loadCalls(selectedContactId);
  };

  const filteredContacts = contacts.filter(c => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()));

  const statusLabel = (call) => {
    if (call.status === 'processing') return 'Transcrevendo…';
    if (call.status === 'error') return `Falha na transcrição${call.error ? `: ${call.error}` : ''}`;
    return null;
  };

  const renderCalls = () => {
    if (loadingCalls) return <div style={{ padding: 40, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando…</div>;
    if (visibleCalls.length === 0) {
      return (
        <div style={{ margin: '40px 24px', padding: 28, textAlign: 'center', color: T.textT, fontSize: 13, background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          {calls.length === 0 ? 'Nenhuma chamada gravada ainda com esse contato.' : 'Nenhuma chamada nesse período.'}
        </div>
      );
    }
    let lastDay = null;
    return visibleCalls.map((call) => {
      const key = dayKey(call.started_at);
      const divider = key !== lastDay;
      lastDay = key;
      const dur = durationLabel(call.started_at, call.ended_at);
      const status = statusLabel(call);
      const dividerStyle = { alignSelf: 'center', textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.textT, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '4px 14px', margin: '16px auto 8px', width: 'fit-content' };
      const noConsent = call.consent_given === false;
      return (
        <div key={call.id}>
          {divider && <div style={dividerStyle}>{formatDayLabel(call.started_at)}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%', alignItems: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: noConsent ? (T.dangerGl || 'rgba(224,83,61,0.08)') : T.surface, color: T.text,
                border: `1px solid ${noConsent ? T.danger : T.border}`, borderBottomLeftRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: T.gold, marginBottom: 6, flexWrap: 'wrap' }}>
                  <IcoPhone /> Chamada{dur ? ` · ${dur}` : ''}
                  <span style={{ color: T.textT, fontWeight: 600 }}>· Protocolo #{call.protocol}</span>
                </div>
                {noConsent ? (
                  <>
                    <div style={{ color: T.danger, fontWeight: 800, fontSize: 12.5, marginBottom: 4 }}>❌ Aviso prévio de ligação não dito</div>
                    <span style={{ color: T.danger }}>Por questões de segurança e proteção de dados, como não foi feito o aviso prévio, não houve o registro da ligação.</span>
                  </>
                ) : (
                  <>
                    {call.consent_given === true && (
                      <div style={{ color: T.green || '#3ba55c', fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>✅ Aviso prévio de ligação dito</div>
                    )}
                    {call.audio_url && (
                      <AudioPlayer src={call.audio_url} />
                    )}
                    {status
                      ? <span style={{ color: call.status === 'error' ? T.danger : T.textT, fontStyle: 'italic' }}>{status}</span>
                      : (call.transcript || <span style={{ color: T.textT, fontStyle: 'italic' }}>(sem fala reconhecida)</span>)}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 4px 0' }}>
                <span style={{ fontSize: 10.5, color: T.textT }}>{formatTime(call.started_at)}</span>
                <button onClick={() => deleteCall(call)} title="Excluir chamada" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex', padding: 0 }}><IcoTrash /></button>
              </div>
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
      <div style={{ height: 56, flexShrink: 0, background: T.topbarBg || (T.dark ? `${T.surface}ee` : 'rgba(245,250,255,0.75)'),
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, position: 'sticky', top: 0, zIndex: 200 }}>
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: T.surfaceSub || 'rgba(0,0,0,0.04)',
            border: `1px solid ${T.border}`, borderRadius: 9, cursor: 'pointer', color: T.textS, outline: 'none', fontFamily: 'var(--font-body)', fontSize: 13 }}>
          <IcoBack /> Módulos
        </button>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text }}>Uniko Call</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {mobileShowList && (
          <div style={{ width: isMobile ? '100%' : 320, flexShrink: 0, background: T.surface, borderRight: isMobile ? 'none' : `1px solid ${T.border}`,
            display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Chamadas</div>
              <button title="Atualizar agora" onClick={loadContacts} style={{ ...btnStyle('secondary'), padding: '7px 9px' }}><IcoRefresh /></button>
            </div>
            <div style={{ padding: '0 16px 10px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textT }}><IcoSearch /></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou transcrição"
                  style={{ width: '100%', padding: '9px 12px 9px 30px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined}
                  style={{ flex: 1, minWidth: 0, padding: '7px 8px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11.5, outline: 'none', fontFamily: 'var(--font-body)' }} />
                <span style={{ fontSize: 11, color: T.textT, flexShrink: 0 }}>até</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined}
                  style={{ flex: 1, minWidth: 0, padding: '7px 8px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11.5, outline: 'none', fontFamily: 'var(--font-body)' }} />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }} title="Limpar período" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex', padding: 4, flexShrink: 0 }}><IcoClose /></button>
                )}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 10px 18px' }}>
              {loadingContacts ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando…</div>
              ) : filteredContacts.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: T.textT, fontSize: 13 }}>
                  {contacts.length === 0 ? 'Nenhuma chamada gravada ainda. Assim que uma chamada do WhatsApp Web terminar, o contato aparece aqui sozinho.' : 'Nenhum contato encontrado.'}
                </div>
              ) : filteredContacts.map(c => {
                const active = c.id === selectedContactId;
                return (
                  <div key={c.id} onClick={() => selectContact(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
                      background: active ? (T.goldGl || T.surfaceSub) : 'transparent' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: active ? T.gold : (T.surfaceSub || '#eceef0'), color: active ? '#fff' : T.textT,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(c.name) || '?'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      {c.last_call_at && <div style={{ fontSize: 11.5, color: T.textT }}>Última chamada: {formatTime(c.last_call_at)}</div>}
                    </div>
                  </div>
                );
              })}

              {(search.trim().length >= 2 || dateFrom || dateTo) && (searchingMessages || messageResults.length > 0) && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <div style={{ padding: '0 10px 6px', fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Transcrições{searchingMessages ? '…' : ''}
                  </div>
                  {messageResults.map(r => {
                    const rc = contacts.find(c => c.id === r.contact_id);
                    const q = search.trim();
                    return (
                      <div key={r.id} onClick={() => openMessageResult(r.contact_id)}
                        style={{ padding: '8px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2 }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rc?.name || 'Contato removido'}</div>
                          <div style={{ fontSize: 10.5, color: T.textT, flexShrink: 0 }}>{formatDayLabel(r.started_at)}</div>
                        </div>
                        <div style={{ fontSize: 12, color: T.textT, marginTop: 2 }}>{q ? highlightMatch(snippetAround(r.transcript, q), q, T) : (r.transcript.length > 90 ? `${r.transcript.slice(0, 90)}…` : r.transcript)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {mobileShowChat && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!selectedContact ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textT, fontSize: 13.5, textAlign: 'center', padding: 24 }}>
                Selecione um contato pra ver as chamadas gravadas.
              </div>
            ) : (
              <>
                <div style={{ height: 64, flexShrink: 0, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px' }}>
                  {isMobile && (
                    <button onClick={() => setSelectedContactId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textT, display: 'flex' }}><IcoBack /></button>
                  )}
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(selectedContact.name) || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedContact.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setRenameModal({ id: selectedContact.id, name: selectedContact.name })} style={btnStyle('secondary')}><IcoEdit /> Renomear</button>
                    <button onClick={() => deleteContact(selectedContact)} style={btnStyle('danger')}><IcoTrash /></button>
                  </div>
                </div>
                <div ref={chatScrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '16px' : '20px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {renderCalls()}
                </div>
                <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: `1px solid ${T.border}`, background: T.surface,
                  textAlign: 'center', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: T.textT }}>
                  ARQUIVO DE CHAMADAS · SÓ LEITURA
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {renameModal && (
        <div onClick={() => setRenameModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 360, maxWidth: '100%', boxShadow: T.shL }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Renomear contato</div>
            <input autoFocus value={renameModal.name} onChange={e => setRenameModal(m => ({ ...m, name: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setRenameModal(null)} style={btnStyle('secondary')}>Cancelar</button>
              <button onClick={saveRename} style={btnStyle('primary')}>Salvar</button>
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

export default UnikoCall;
