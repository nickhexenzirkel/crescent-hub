// src/modules/uniko-fit/index.jsx
// UNIKO FIT — estilo GymRats, layout mobile-first (pensado pra tela de iPhone,
// mas funciona em qualquer tamanho dentro de uma coluna estilo "app de celular").
// 2 abas no topo — Para Você (feed unificado de check-ins + posts) e Bate-Papo
// (chat global com texto/emoji/imagem/áudio + aviso automático de check-in) —
// e uma barra fixa embaixo com 4 ações: Check-In, Ranking, Postar no Feed,
// Detalhes. Por enquanto só ADMIN acessa (módulo em construção).
// Sem servidor próprio: tudo via Supabase (tabela uniko_fit_checkins — coluna
// `kind` distingue 'checkin' de 'post' — e uniko_fit_chat com `tipo`/`media_url`
// — rodar supabase_uniko_fit.sql) + bucket de arquivos `uniko-fit-fotos`.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { USER, getAuthUser, supabase, fetchPhotoByName } from '../../contexts/user';
import { AvatarCircle } from '../../shared/components';

const myName = () => { try { return getAuthUser()?.name || USER.name || 'Colaborador'; } catch { return 'Colaborador'; } };

// Reações: 3 emoji + o próprio Uniko "aprovando" (toque de marca).
const REACOES = [
  { id: 'forca',  emoji: '💪', label: 'Força!' },
  { id: 'fogo',   emoji: '🔥', label: 'Treino insano' },
  { id: 'palmas', emoji: '👏', label: 'Aplausos' },
  { id: 'uniko',  img: '/UNIKO_NEW.png', label: 'Uniko aprova' },
];

const EMOJIS = ['😀','😂','😍','🔥','💪','👏','🎉','😢','😡','👍','👎','❤️','🙌','😅','🤔','😴','🥳','🏋️','🏃','🍎','💧','⏰','✅','⭐','🤝','😎','🥵','🎯'];

const tempoRelativo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};
const horaCurta = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/* ── Ícones ── */
const IcoBack   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>;
const IcoFit    = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="4" height="8" rx="1.3" /><rect x="18" y="8" width="4" height="8" rx="1.3" /><line x1="6" y1="12" x2="18" y2="12" /></svg>;
const IcoCamera = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcoTrophy = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M17 6h2a2 2 0 01-2 4M7 6H5a2 2 0 002 4"/></svg>;
const IcoPost   = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const IcoInfo   = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="11.5"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IcoSend   = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
const IcoSmile  = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
const IcoImg    = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
const IcoMic    = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IcoStop   = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>;
const IcoClose  = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>;

/* ── Sheet (folha deslizante de baixo pra cima) — usado pelas 4 ações da barra ── */
const Sheet = ({ title, onBack, onClose, children }) => {
  const cardBg = T.surface || '#fff';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,6,10,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="fit-sheet-in" style={{ background: cardBg, width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -14px 50px rgba(0,0,0,.35)', border: `1px solid ${T.border}`, borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 8px 13px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {onBack && <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textS, padding: 6, display: 'flex' }}>{IcoBack}</button>}
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textS, padding: 8, display: 'flex' }}>{IcoClose}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
};

const UnikoFit = ({ onBack, authUser, userPhoto }) => {
  const name = myName();
  const userName = authUser?.name || name;
  const cardBg = T.surface || '#fff';
  const [topTab, setTopTab] = useState('paravoce'); // paravoce | batepapo
  const [sheet, setSheet] = useState(null);          // null | checkin | post | ranking | detalhes

  // ── Cor fixa do módulo: laranja, SEMPRE — a única exceção é quando o tema
  // ativo já É laranja, aí ela vira azul (senão o módulo some dentro do próprio
  // tema). `T.key` é o id do tema aplicado agora (ver contexts/theme.js). ──
  const isOrangeTheme = T.key === 'orange' || T.key === 'orangeDark';
  const ENERGIA = isOrangeTheme ? '#2A82D2' : '#FF6B35';
  const FOGO    = isOrangeTheme ? '#1A6FB5' : '#F43F5E';
  const EG = isOrangeTheme ? 'rgba(42,130,210,.35)' : 'rgba(255,107,53,.35)';

  const FIT_CSS = `
@keyframes fitSheetIn { from { transform: translateY(24px); opacity: .4; } to { transform: none; opacity: 1; } }
.fit-sheet-in { animation: fitSheetIn .22s cubic-bezier(.2,1,.4,1) both; }
@keyframes fitPop  { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
@keyframes fitPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.fit-pop  { animation: fitPop .35s cubic-bezier(.2,1.6,.4,1) both; }
.fit-btn { transition: transform .12s, filter .12s; -webkit-tap-highlight-color: transparent; }
.fit-btn:hover:not(:disabled) { filter: brightness(1.06); }
.fit-btn:active:not(:disabled) { transform: scale(.94); }
.fit-feed { scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
.fit-feed::-webkit-scrollbar { display: none; }
.fit-card { scroll-snap-align: start; scroll-snap-stop: always; }
.fit-scroll { scrollbar-width: thin; scrollbar-color: ${ENERGIA}99 rgba(128,128,128,.14); -webkit-overflow-scrolling: touch; }
.fit-scroll::-webkit-scrollbar { width: 6px; }
.fit-scroll::-webkit-scrollbar-thumb { background: ${ENERGIA}99; border-radius: 99px; }
`;

  // ── Fotos de perfil (cache compartilhado por todas as áreas) ──
  const [photos, setPhotos] = useState({});
  const photosRef = useRef({});
  useEffect(() => { photosRef.current = photos; }, [photos]);
  const ensurePhotos = useCallback(async (nomes) => {
    const faltam = [...new Set(nomes)].filter(n => n && !(n in photosRef.current));
    if (!faltam.length) return;
    const pairs = await Promise.all(faltam.map(async n => [n, await fetchPhotoByName(n).catch(() => null)]));
    setPhotos(prev => { const next = { ...prev }; pairs.forEach(([n, p]) => { next[n] = p || null; }); return next; });
  }, []);

  /* ═══════════════════ FEED "PARA VOCÊ" (check-ins + posts) ═══════════════════ */
  const [feed, setFeed] = useState(null);           // null = carregando
  const [reacoes, setReacoes] = useState({});        // itemId -> {counts:{emoji:n}, mine:emoji|null}
  const [comentCount, setComentCount] = useState({}); // itemId -> n

  const loadFeed = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_fit_checkins').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { setFeed([]); return; }
    const posts = data || [];
    setFeed(posts);
    ensurePhotos(posts.map(p => p.player));
    const ids = posts.map(p => p.id);
    if (!ids.length) return;
    const [reacRes, comRes] = await Promise.all([
      supabase.from('uniko_fit_reactions').select('checkin_id,player,emoji').in('checkin_id', ids),
      supabase.from('uniko_fit_comments').select('checkin_id').in('checkin_id', ids),
    ]);
    const rmap = {};
    (reacRes.data || []).forEach(r => {
      const e = rmap[r.checkin_id] || (rmap[r.checkin_id] = { counts: {}, mine: null });
      e.counts[r.emoji] = (e.counts[r.emoji] || 0) + 1;
      if (r.player === name) e.mine = r.emoji;
    });
    setReacoes(rmap);
    const cmap = {};
    (comRes.data || []).forEach(c => { cmap[c.checkin_id] = (cmap[c.checkin_id] || 0) + 1; });
    setComentCount(cmap);
  }, [ensurePhotos, name]);

  const feedRef = useRef(null);
  useEffect(() => { feedRef.current = feed; }, [feed]);

  useEffect(() => {
    // `loadFeed` é async: o setState só roda depois do await, nunca síncrono
    // no effect — o compiler não distingue e acusa cascata de render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFeed();
    const ch = supabase.channel('uniko-fit-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_checkins' }, ({ new: row }) => {
        setFeed(prev => (prev && prev.some(p => p.id === row.id)) ? prev : [row, ...(prev || [])]);
        ensurePhotos([row.player]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_comments' }, ({ new: row }) => {
        setComentCount(prev => ({ ...prev, [row.checkin_id]: (prev[row.checkin_id] || 0) + 1 }));
      })
      .subscribe();
    // Reações: poll leve de 20s (mais simples que reconciliar delta de UPDATE/DELETE em
    // tempo real — a contagem de "curtidas" não precisa ser instantânea pra ninguém
    // além de quem clicou, que já vê otimista na hora).
    const poll = setInterval(() => { if (feedRef.current?.length) loadFeed(); }, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleReacao = async (itemId, emoji) => {
    const cur = reacoes[itemId] || { counts: {}, mine: null };
    const jaEssa = cur.mine === emoji;
    setReacoes(prev => {
      const atual = prev[itemId] || { counts: {}, mine: null };
      const counts = { ...atual.counts };
      if (atual.mine) counts[atual.mine] = Math.max(0, (counts[atual.mine] || 1) - 1);
      if (!jaEssa) counts[emoji] = (counts[emoji] || 0) + 1;
      return { ...prev, [itemId]: { counts, mine: jaEssa ? null : emoji } };
    });
    try {
      if (jaEssa) await supabase.from('uniko_fit_reactions').delete().eq('checkin_id', itemId).eq('player', name);
      else await supabase.from('uniko_fit_reactions').upsert({ checkin_id: itemId, player: name, emoji }, { onConflict: 'checkin_id,player' });
    } catch (e) { console.error('[uniko-fit] reação:', e); }
  };

  // ── Comentários (drawer por post) ──
  const [comentAberto, setComentAberto] = useState(null);
  const [comentLista, setComentLista] = useState([]);
  const [comentLoading, setComentLoading] = useState(false);
  const [comentTexto, setComentTexto] = useState('');

  const abrirComentarios = async (post) => {
    setComentAberto(post); setComentLista([]); setComentLoading(true); setComentTexto('');
    const { data } = await supabase.from('uniko_fit_comments').select('*').eq('checkin_id', post.id).order('created_at', { ascending: true });
    setComentLista(data || []);
    ensurePhotos((data || []).map(c => c.player));
    setComentLoading(false);
  };
  const enviarComentario = async () => {
    const texto = comentTexto.trim();
    if (!texto || !comentAberto) return;
    setComentTexto('');
    const { data, error } = await supabase.from('uniko_fit_comments').insert({ checkin_id: comentAberto.id, player: name, texto }).select().single();
    if (!error && data) {
      setComentLista(prev => [...prev, data]);
      setComentCount(prev => ({ ...prev, [comentAberto.id]: (prev[comentAberto.id] || 0) + 1 }));
    }
  };

  /* ═══════════════════ POSTAR FOTO (Check-In ou Postar no Feed) ═══════════════════ */
  const [postFile, setPostFile] = useState(null);
  const [postPreview, setPostPreview] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  const [postSaving, setPostSaving] = useState(false);
  const [postMsg, setPostMsg] = useState('');
  const postFileRef = useRef(null);

  const escolherFoto = (f) => {
    setPostFile(f || null); setPostMsg('');
    if (!f) { setPostPreview(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => setPostPreview(e.target.result);
    reader.readAsDataURL(f);
  };
  const limparPost = () => { setPostFile(null); setPostPreview(null); setPostCaption(''); setPostMsg(''); if (postFileRef.current) postFileRef.current.value = ''; };

  // kind: 'checkin' (conta pro ranking diário + avisa no Bate-Papo) | 'post' (só feed)
  const postarFoto = async (kind) => {
    if (!postFile) { setPostMsg('⚠️ Escolha uma foto pra continuar!'); return; }
    setPostSaving(true); setPostMsg('');
    try {
      const ext = (postFile.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('uniko-fit-fotos').upload(path, postFile, { contentType: postFile.type || undefined, upsert: false });
      if (upErr) throw new Error('Falha ao enviar a foto: ' + upErr.message);
      const { data: pub } = supabase.storage.from('uniko-fit-fotos').getPublicUrl(path);
      const { error } = await supabase.from('uniko_fit_checkins').insert({ player: name, photo_url: pub.publicUrl, caption: postCaption.trim() || null, kind });
      if (error) throw new Error(error.message);
      if (kind === 'checkin') {
        try { await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'checkin', media_url: pub.publicUrl }); } catch { /* aviso no chat é cortesia, não bloqueia o check-in */ }
      }
      setPostMsg(kind === 'checkin' ? '✅ Check-in registrado! Bora treinar mais 💪' : '✅ Postado no feed!');
      setFullFeed(null); // invalida cache do ranking/detalhes pra refletir o novo item
      await loadFeed();
      setTimeout(() => { limparPost(); setSheet(null); setTopTab('paravoce'); }, 1100);
    } catch (e) { setPostMsg('❌ ' + (e.message || 'Erro ao postar')); }
    setPostSaving(false);
  };

  /* ═══════════════════ BATE-PAPO (texto, emoji, imagem, áudio, avisos de check-in) ═══════════════════ */
  const [chat, setChat] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [gravSeg, setGravSeg] = useState(0);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const chatEndRef = useRef(null);
  const chatImgRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const gravTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('uniko_fit_chat').select('*').order('created_at', { ascending: false }).limit(100);
      const msgs = (data || []).slice().reverse();
      setChat(msgs);
      ensurePhotos(msgs.map(m => m.player));
    })();
    const ch = supabase.channel('uniko-fit-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_chat' }, ({ new: row }) => {
        setChat(prev => (prev && prev.some(m => m.id === row.id)) ? prev : [...(prev || []).slice(-200), row]);
        ensurePhotos([row.player]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (topTab === 'batepapo') chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat, topTab]);
  useEffect(() => () => { clearInterval(gravTimerRef.current); try { mrRef.current?.stream?.getTracks?.().forEach(t => t.stop()); } catch { /* já parado */ } }, []);

  const enviarChatTexto = async () => {
    const texto = chatMsg.trim(); if (!texto) return;
    setChatMsg(''); setEmojiOpen(false);
    try { await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'texto', texto }); }
    catch (e) { console.error('[uniko-fit] chat:', e); }
  };
  const enviarChatImagem = async (file) => {
    if (!file) return;
    setEnviandoMidia(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/chat/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('uniko-fit-fotos').upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('uniko-fit-fotos').getPublicUrl(path);
      await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'imagem', media_url: pub.publicUrl });
    } catch (e) { console.error('[uniko-fit] chat imagem:', e); }
    setEnviandoMidia(false);
    if (chatImgRef.current) chatImgRef.current.value = '';
  };
  const enviarChatAudio = async (blob) => {
    setEnviandoMidia(true);
    try {
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/chat/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage.from('uniko-fit-fotos').upload(path, blob, { contentType: 'audio/webm' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('uniko-fit-fotos').getPublicUrl(path);
      await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'audio', media_url: pub.publicUrl });
    } catch (e) { console.error('[uniko-fit] chat áudio:', e); }
    setEnviandoMidia(false);
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 400) await enviarChatAudio(blob);
      };
      mr.start();
      mrRef.current = mr;
      setGravando(true); setGravSeg(0);
      gravTimerRef.current = setInterval(() => setGravSeg(s => s + 1), 1000);
    } catch (e) { console.error('[uniko-fit] mic:', e); alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.'); }
  };
  const pararGravacao = () => {
    mrRef.current?.stop();
    clearInterval(gravTimerRef.current);
    setGravando(false);
  };

  /* ═══════════════════ RANKING & DETALHES (leitura completa e paginada) ═══════════════════ */
  const [fullFeed, setFullFeed] = useState(null); // null = ainda não carregado

  const loadFullFeed = useCallback(async () => {
    // Pagina de verdade (o Supabase corta em 1000/request — mesma lição do bug
    // do "mês sumia" na Máquina do Tempo). Trava de segurança em 6000 linhas
    // pra não sobrecarregar o navegador em instalações muito antigas.
    const PAGE = 1000; let from = 0; const rows = []; let pages = 0;
    for (;;) {
      const { data, error } = await supabase.from('uniko_fit_checkins')
        .select('id,player,kind,photo_url,caption,created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      rows.push(...data);
      pages++;
      if (data.length < PAGE || pages >= 6) break;
      from += PAGE;
    }
    setFullFeed(rows);
    ensurePhotos(rows.map(r => r.player));
  }, [ensurePhotos]);

  const openSheet = (id) => {
    setSheet(id);
    if ((id === 'ranking' || id === 'detalhes') && !fullFeed) loadFullFeed();
  };

  const [rankPeriodo, setRankPeriodo] = useState('mes'); // mes | total
  const rankingData = useMemo(() => {
    if (!fullFeed) return null;
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Conta DIAS distintos com check-in (não linhas cruas) — assim spammar várias
    // fotos no mesmo dia não infla o ranking. "Checkin diário" é o que conta.
    const diasTotal = {}, diasMes = {};
    fullFeed.forEach(r => {
      if (r.kind !== 'checkin') return;
      const dia = (r.created_at || '').slice(0, 10);
      if (!diasTotal[r.player]) diasTotal[r.player] = new Set();
      diasTotal[r.player].add(dia);
      if (dia.slice(0, 7) === curMonth) {
        if (!diasMes[r.player]) diasMes[r.player] = new Set();
        diasMes[r.player].add(dia);
      }
    });
    const total = {}, mes = {};
    Object.entries(diasTotal).forEach(([p, s]) => { total[p] = s.size; });
    Object.entries(diasMes).forEach(([p, s]) => { mes[p] = s.size; });
    return { total, mes };
  }, [fullFeed]);

  const [detalhesPlayer, setDetalhesPlayer] = useState(null); // nome selecionado (null = lista)
  const detalhesLista = useMemo(() => {
    if (!fullFeed) return null;
    const map = {};
    fullFeed.forEach(r => {
      const e = map[r.player] || (map[r.player] = { player: r.player, dias: new Set(), items: [] });
      if (r.kind === 'checkin') e.dias.add((r.created_at || '').slice(0, 10));
      e.items.push(r);
    });
    return Object.values(map)
      .map(e => ({ player: e.player, checkinCount: e.dias.size, items: e.items }))
      .sort((a, b) => b.checkinCount - a.checkinCount || b.items.length - a.items.length);
  }, [fullFeed]);

  /* ═══════════════════ UI ═══════════════════ */
  const BOTTOM_BTNS = [
    { id: 'checkin',  label: 'Check-In',       icon: IcoCamera },
    { id: 'ranking',  label: 'Ranking',        icon: IcoTrophy },
    { id: 'post',     label: 'Postar no Feed', icon: IcoPost },
    { id: 'detalhes', label: 'Detalhes',       icon: IcoInfo },
  ];

  return (
    <div style={{ height: '100vh', width: '100%', maxWidth: 480, margin: '0 auto', background: T.page, fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(0,0,0,.08)' }}>
      <style>{FIT_CSS}</style>

      {/* ── Topbar ── */}
      <div style={{ height: 50, background: T.topbarBg || cardBg, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 10px 0 6px', gap: 6, flexShrink: 0, boxShadow: `0 1px 16px ${ENERGIA}18` }}>
        <button onClick={onBack} className="fit-btn" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 12.5, fontFamily: 'var(--font-body)', padding: '6px 7px', borderRadius: 7 }}>
          {IcoBack} Módulos
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: ENERGIA, display: 'flex' }}>{IcoFit}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: 'var(--font-brand)', letterSpacing: '.02em' }}>Uniko Fit</span>
        <div style={{ flex: 1 }} />
        <AvatarCircle name={userName} photo={userPhoto} size={28} fontSize={10} />
      </div>

      {/* ── Abas superiores: Para Você / Bate-Papo ── */}
      <div style={{ display: 'flex', gap: 22, padding: '9px 16px 0', background: cardBg, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {[['paravoce', 'Para Você'], ['batepapo', 'Bate-Papo']].map(([id, label]) => {
          const on = topTab === id;
          return (
            <button key={id} onClick={() => setTopTab(id)} className="fit-btn"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 1px 10px', fontSize: 14.5, fontWeight: 800, fontFamily: 'var(--font-brand)',
                color: on ? ENERGIA : T.textT, borderBottom: on ? `3px solid ${ENERGIA}` : '3px solid transparent' }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>

        {/* ── PARA VOCÊ (feed unificado: check-ins + posts) ── */}
        {topTab === 'paravoce' && (
          feed === null ? (
            <div style={{ textAlign: 'center', padding: 60, color: T.textT, fontSize: 13 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${ENERGIA}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
              Carregando o feed...
            </div>
          ) : feed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🏋️</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>Ainda ninguém postou nada</div>
              <div style={{ fontSize: 13, color: T.textT, marginBottom: 16 }}>Seja o primeiro a fazer check-in! 💪</div>
              <button className="fit-btn" onClick={() => openSheet('checkin')}
                style={{ padding: '10px 22px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: `0 6px 18px ${EG}` }}>📸 Fazer check-in</button>
            </div>
          ) : (
            <div className="fit-feed" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {feed.map(post => {
                const r = reacoes[post.id] || { counts: {}, mine: null };
                const totalReacoes = Object.values(r.counts).reduce((a, b) => a + b, 0);
                return (
                  <div key={post.id} className="fit-card" style={{ position: 'relative', width: '100%', aspectRatio: '9/14', background: '#111' }}>
                    <img src={post.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.18) 0%, transparent 26%, transparent 55%, rgba(0,0,0,.85) 100%)' }} />

                    {post.kind === 'checkin' && (
                      <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999,
                        background: `${ENERGIA}E6`, color: '#fff', fontSize: 11, fontWeight: 800 }}>✅ Check-in</div>
                    )}

                    <div style={{ position: 'absolute', left: 14, right: 68, bottom: 16, color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                        <img src={photos[post.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{post.player.split(' ').slice(0, 2).join(' ')}</div>
                          <div style={{ fontSize: 10.5, opacity: .85 }}>{tempoRelativo(post.created_at)}</div>
                        </div>
                      </div>
                      {post.caption && <div style={{ fontSize: 12.5, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{post.caption}</div>}
                    </div>

                    <div style={{ position: 'absolute', right: 8, bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11 }}>
                      {REACOES.map(rc => {
                        const ativo = r.mine === (rc.emoji || rc.id);
                        const emojiKey = rc.emoji || rc.id;
                        const n = r.counts[emojiKey] || 0;
                        return (
                          <button key={rc.id} className="fit-btn" onClick={() => toggleReacao(post.id, emojiKey)} title={rc.label}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                            <div className={ativo ? 'fit-pop' : undefined} key={ativo ? `${post.id}-${rc.id}-on` : `${post.id}-${rc.id}-off`}
                              style={{ width: 37, height: 37, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                                background: ativo ? `${ENERGIA}E6` : 'rgba(0,0,0,.35)', boxShadow: ativo ? `0 0 0 2px #fff` : 'none' }}>
                              {rc.img ? <img src={rc.img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : rc.emoji}
                            </div>
                            {n > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{n}</span>}
                          </button>
                        );
                      })}
                      <button className="fit-btn" onClick={() => abrirComentarios(post)} title="Comentários"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ width: 37, height: 37, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'rgba(0,0,0,.35)' }}>💬</div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{comentCount[post.id] || 0}</span>
                      </button>
                      {totalReacoes > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,.7)' }}>{totalReacoes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── BATE-PAPO (chat global: texto, emoji, imagem, áudio, avisos de check-in) ── */}
        {topTab === 'batepapo' && (
          <>
            <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chat === null ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Carregando chat...</div>
              ) : chat.length === 0 ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Nenhuma mensagem ainda. Chama a galera pra treinar! 💪</div>
              ) : chat.map(m => {
                if (m.tipo === 'checkin') {
                  return (
                    <div key={m.id} style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: '6px 0', maxWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textS, background: T.surfaceSub || 'rgba(0,0,0,.04)', padding: '5px 13px', borderRadius: 999, textAlign: 'center', border: `1px solid ${T.border}` }}>
                        ✅ <b style={{ color: ENERGIA }}>{m.player.split(' ')[0]}</b> fez check-in às {horaCurta(m.created_at)}
                      </div>
                      {m.media_url && <img src={m.media_url} alt="" style={{ width: 110, height: 110, borderRadius: 14, objectFit: 'cover', border: `2px solid ${ENERGIA}` }} />}
                    </div>
                  );
                }
                const eu = m.player === name;
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: eu ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    <img src={photos[m.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                    <div style={{ maxWidth: '74%' }}>
                      {!eu && <div style={{ fontSize: 10, fontWeight: 700, color: T.textT, marginBottom: 2 }}>{m.player.split(' ')[0]}</div>}
                      <div style={{ padding: m.tipo === 'texto' ? '8px 12px' : 5, borderRadius: eu ? '14px 3px 14px 14px' : '3px 14px 14px 14px',
                        background: eu ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.04)'), overflow: 'hidden' }}>
                        {m.tipo === 'texto' && <span style={{ fontSize: 13, lineHeight: 1.4, color: eu ? '#fff' : T.text }}>{m.texto}</span>}
                        {m.tipo === 'imagem' && <img src={m.media_url} alt="" style={{ maxWidth: 190, maxHeight: 240, display: 'block', borderRadius: 10, objectFit: 'cover' }} />}
                        {m.tipo === 'audio' && <audio controls preload="none" src={m.media_url} style={{ width: 210, height: 32 }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Emoji picker */}
            {emojiOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, padding: '10px 12px', borderTop: `1px solid ${T.border}`, background: cardBg, maxHeight: 160, overflowY: 'auto' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setChatMsg(t => t + e)} className="fit-btn" style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }}>{e}</button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderTop: `1px solid ${T.border}`, background: cardBg, flexShrink: 0 }}>
              {gravando ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 999, background: 'rgba(220,50,50,.08)', border: '1.5px solid rgba(220,50,50,.35)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#DC3232', animation: 'fitPulse 1s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, color: '#C82C2C', fontWeight: 700 }}>Gravando... {String(Math.floor(gravSeg / 60)).padStart(2, '0')}:{String(gravSeg % 60).padStart(2, '0')}</span>
                </div>
              ) : (
                <>
                  <button onClick={() => setEmojiOpen(o => !o)} className="fit-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: emojiOpen ? ENERGIA : T.textS, padding: 6, display: 'flex', flexShrink: 0 }}>{IcoSmile}</button>
                  <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onFocus={() => setEmojiOpen(false)} onKeyDown={e => e.key === 'Enter' && enviarChatTexto()}
                    placeholder="Escreva uma mensagem..." maxLength={400} disabled={enviandoMidia}
                    style={{ flex: 1, minWidth: 0, padding: '9px 13px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.page || '#fff', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
                  <input ref={chatImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => enviarChatImagem(e.target.files?.[0] || null)} />
                  <button onClick={() => chatImgRef.current?.click()} disabled={enviandoMidia} className="fit-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textS, padding: 6, display: 'flex', flexShrink: 0, opacity: enviandoMidia ? .5 : 1 }}>{IcoImg}</button>
                </>
              )}
              <button onClick={gravando ? pararGravacao : (chatMsg.trim() ? enviarChatTexto : iniciarGravacao)} disabled={enviandoMidia}
                className="fit-btn" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
                  background: gravando ? '#DC3232' : (chatMsg.trim() ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.06)')),
                  color: gravando ? '#fff' : (chatMsg.trim() ? '#fff' : T.textS),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: enviandoMidia ? .5 : 1 }}>
                {gravando ? IcoStop : (chatMsg.trim() ? IcoSend : IcoMic)}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Barra inferior fixa: 4 ações ── */}
      <div style={{ display: 'flex', borderTop: `1px solid ${T.border}`, background: cardBg, flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {BOTTOM_BTNS.map(b => (
          <button key={b.id} onClick={() => openSheet(b.id)} className="fit-btn"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 2px 8px', background: 'none', border: 'none', cursor: 'pointer', color: T.textS }}>
            <span style={{ color: ENERGIA, display: 'flex' }}>{b.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-body)' }}>{b.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ SHEETS ══════════════ */}

      {/* ── Check-In / Postar no Feed ── */}
      {(sheet === 'checkin' || sheet === 'post') && (
        <Sheet title={sheet === 'checkin' ? 'Registrar treino 📸' : 'Postar no feed 🖼️'} onClose={() => { setSheet(null); limparPost(); }}>
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 14, lineHeight: 1.5 }}>
              {sheet === 'checkin'
                ? 'Manda uma foto comprovando que você treinou — conta ponto no ranking do dia e avisa todo mundo no Bate-Papo!'
                : 'Compartilhe uma foto no feed "Para Você" — não conta pro ranking de check-in, é só pra galera ver.'}
            </div>

            <input ref={postFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => escolherFoto(e.target.files?.[0] || null)} />
            {postPreview ? (
              <div onClick={() => postFileRef.current?.click()} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', marginBottom: 14, aspectRatio: '4/5', background: '#111' }}>
                <img src={postPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '5px 11px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 700 }}>Trocar foto</div>
              </div>
            ) : (
              <button className="fit-btn" onClick={() => postFileRef.current?.click()}
                style={{ width: '100%', aspectRatio: '4/5', borderRadius: 14, border: `2px dashed ${ENERGIA}66`, background: `${ENERGIA}0a`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                <div style={{ fontSize: 38 }}>📷</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ENERGIA }}>{sheet === 'checkin' ? 'Escolher foto do treino' : 'Escolher foto'}</div>
              </button>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 5 }}>Legenda (opcional)</div>
              <textarea value={postCaption} onChange={e => setPostCaption(e.target.value)} placeholder="Como foi hoje?" rows={3} maxLength={220}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.page || '#fff', fontSize: 13,
                  color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            {postMsg && <div style={{ fontSize: 12.5, marginBottom: 12, padding: '8px 13px', borderRadius: 8,
              color: postMsg.startsWith('✅') ? '#16a34a' : '#C04050', background: postMsg.startsWith('✅') ? 'rgba(34,197,94,.08)' : 'rgba(192,64,80,.06)' }}>{postMsg}</div>}

            <button className="fit-btn" onClick={() => postarFoto(sheet)} disabled={postSaving || !postFile}
              style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14,
                cursor: (postSaving || !postFile) ? 'not-allowed' : 'pointer', opacity: (postSaving || !postFile) ? .55 : 1,
                background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: (postSaving || !postFile) ? 'none' : `0 6px 18px ${EG}` }}>
              {postSaving ? 'Enviando...' : (sheet === 'checkin' ? '🔥 Registrar check-in' : '🖼️ Postar no feed')}
            </button>
          </div>
        </Sheet>
      )}

      {/* ── Ranking ── */}
      {sheet === 'ranking' && (
        <Sheet title="Ranking 🏆" onClose={() => setSheet(null)}>
          <div style={{ padding: '16px 16px 24px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {[['mes', 'Este mês'], ['total', 'Todos os tempos']].map(([id, label]) => {
                const sel = rankPeriodo === id;
                return (
                  <button key={id} className="fit-btn" onClick={() => setRankPeriodo(id)}
                    style={{ padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                      border: `1.5px solid ${sel ? ENERGIA : T.border}`, background: sel ? `${ENERGIA}16` : 'transparent', color: sel ? ENERGIA : T.textS }}>{label}</button>
                );
              })}
            </div>

            {!rankingData ? (
              <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando ranking...</div>
            ) : (() => {
              const mapa = rankPeriodo === 'mes' ? rankingData.mes : rankingData.total;
              const lista = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
              if (!lista.length) return (
                <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>
                  Ninguém treinou {rankPeriodo === 'mes' ? 'este mês' : 'ainda'}. Bora ser o primeiro! 💪
                </div>
              );
              const medalha = ['🥇', '🥈', '🥉'];
              const lider = lista[0];
              return (
                <>
                  <div style={{ background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, borderRadius: 16, padding: '16px 18px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 8px 24px ${EG}`, color: '#fff' }}>
                    <img src={photos[lider[0]] || '/UNIKO_NEW.png'} alt="" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', opacity: .9 }}>🏆 {rankPeriodo === 'mes' ? 'ATLETA DO MÊS' : 'MAIOR RATO DE ACADEMIA'}</div>
                      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800 }}>{lider[0].split(' ').slice(0, 2).join(' ')}</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{lider[1]}<span style={{ fontSize: 10.5, fontWeight: 600, opacity: .85 }}> dias</span></div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lista.map(([player, n], i) => (
                      <div key={player} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
                        <div style={{ width: 24, textAlign: 'center', fontSize: i < 3 ? 17 : 12.5, fontWeight: 800, color: T.textT, flexShrink: 0 }}>{medalha[i] || i + 1}</div>
                        <img src={photos[player] || '/UNIKO_NEW.png'} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: ENERGIA, background: `${ENERGIA}12`, borderRadius: 7, padding: '3px 9px', flexShrink: 0 }}>{n} dia{n !== 1 ? 's' : ''}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </Sheet>
      )}

      {/* ── Detalhes: lista de pessoas + perfil individual ── */}
      {sheet === 'detalhes' && (
        <Sheet title={detalhesPlayer ? detalhesPlayer.split(' ').slice(0, 2).join(' ') : 'Detalhes 📋'}
          onBack={detalhesPlayer ? () => setDetalhesPlayer(null) : undefined}
          onClose={() => { setSheet(null); setDetalhesPlayer(null); }}>
          {!detalhesLista ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando...</div>
          ) : !detalhesPlayer ? (
            <div style={{ padding: '10px 14px 20px' }}>
              <div style={{ fontSize: 12, color: T.textT, marginBottom: 12 }}>{detalhesLista.length} pessoa{detalhesLista.length !== 1 ? 's' : ''} já postaram no Uniko Fit</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detalhesLista.map(p => (
                  <div key={p.player} onClick={() => setDetalhesPlayer(p.player)} className="fit-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <img src={photos[p.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.player}</div>
                      <div style={{ fontSize: 11, color: T.textT }}>{p.checkinCount} check-in{p.checkinCount !== 1 ? 's' : ''} · {p.items.length} post{p.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: -6 }}>
                      {p.items.slice(0, 3).map((it, i) => (
                        <img key={it.id} src={it.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (() => {
            const p = detalhesLista.find(x => x.player === detalhesPlayer);
            if (!p) return null;
            return (
              <div style={{ padding: '10px 14px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <img src={photos[p.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${ENERGIA}` }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{p.player}</div>
                    <div style={{ fontSize: 11.5, color: T.textT }}>{p.checkinCount} check-in{p.checkinCount !== 1 ? 's' : ''} · {p.items.length} post{p.items.length !== 1 ? 's' : ''} no total</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                  {p.items.map(it => (
                    <div key={it.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#111' }}>
                      <img src={it.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {it.kind === 'checkin' && <div style={{ position: 'absolute', top: 3, right: 3, fontSize: 12, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}>✅</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </Sheet>
      )}

      {/* ── Comentários (drawer por post do feed) ── */}
      {comentAberto && (
        <div onClick={() => setComentAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,6,10,.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="fit-pop" style={{ background: cardBg, borderRadius: '20px 20px 0 0', border: `1px solid ${T.border}`,
            width: '100%', maxWidth: 480, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>💬 Comentários</div>
              <button onClick={() => setComentAberto(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comentLoading ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 10 }}>Carregando...</div>
              ) : comentLista.length === 0 ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 10 }}>Seja o primeiro a comentar!</div>
              ) : comentLista.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 9 }}>
                  <img src={photos[c.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{c.player.split(' ')[0]} <span style={{ fontWeight: 500, color: T.textD, fontSize: 10.5 }}>· {tempoRelativo(c.created_at)}</span></div>
                    <div style={{ fontSize: 13, color: T.textS, lineHeight: 1.4 }}>{c.texto}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${T.border}` }}>
              <input value={comentTexto} onChange={e => setComentTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarComentario()}
                placeholder="Escreva um comentário..." maxLength={280}
                style={{ flex: 1, padding: '10px 13px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.page || '#fff', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
              <button className="fit-btn" onClick={enviarComentario} disabled={!comentTexto.trim()}
                style={{ padding: '9px 18px', borderRadius: 999, border: 'none', cursor: comentTexto.trim() ? 'pointer' : 'default',
                  background: comentTexto.trim() ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.06)'), color: '#fff', fontWeight: 700, fontSize: 12.5,
                  opacity: comentTexto.trim() ? 1 : .5 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default UnikoFit;
export { UnikoFit };
