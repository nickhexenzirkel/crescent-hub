// src/modules/central-colaborador/tabs/TabUnikoGym.jsx
// UNIKO GYM — estilo GymRats: transforma treino em competição saudável entre
// colegas. Check-in de treino (foto), feed "Para Você" (estilo TikTok,
// scrollável/arrastável), reações, comentários, chat do grupo pra combinar
// treinos e ranking por frequência. Liberado pra TODOS (não é admin-only).
// Sem servidor próprio: tudo via Supabase (tabelas uniko_gym_* — rodar
// supabase_uniko_gym.sql) + bucket de fotos `uniko-gym-fotos`.
import { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { USER, getAuthUser, supabase, fetchPhotoByName } from '../../../contexts/user';

const ENERGIA = '#FF6B35', FOGO = '#F43F5E', ROXO = '#7C3AED';
const EG = 'rgba(255,107,53,.35)';

const myName = () => { try { return getAuthUser()?.name || USER.name || 'Colaborador'; } catch { return 'Colaborador'; } };

// Reações: 3 emoji + o próprio Uniko "aprovando" (toque de marca).
const REACOES = [
  { id: 'forca',  emoji: '💪', label: 'Força!' },
  { id: 'fogo',   emoji: '🔥', label: 'Treino insano' },
  { id: 'palmas', emoji: '👏', label: 'Aplausos' },
  { id: 'uniko',  img: '/UNIKO_NEW.png', label: 'Uniko aprova' },
];

const tempoRelativo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

const GYM_CSS = `
@keyframes gymPop  { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
@keyframes gymFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes gymFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.gym-pop  { animation: gymPop .35s cubic-bezier(.2,1.6,.4,1) both; }
.gym-fade { animation: gymFade .3s ease both; }
.gym-float { animation: gymFloat 2.4s ease-in-out infinite; }
.gym-btn { transition: transform .12s, filter .12s; }
.gym-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
.gym-btn:active:not(:disabled) { transform: scale(.94); }
.gym-feed { scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
.gym-feed::-webkit-scrollbar { display: none; }
.gym-card { scroll-snap-align: start; scroll-snap-stop: always; }
.gym-scroll { scrollbar-width: thin; scrollbar-color: ${ENERGIA}99 rgba(128,128,128,.14); }
.gym-scroll::-webkit-scrollbar { width: 8px; }
.gym-scroll::-webkit-scrollbar-thumb { background: ${ENERGIA}99; border-radius: 99px; }
`;

const TabUnikoGym = () => {
  const name = myName();
  const cardBg = T.surface || '#fff';
  const [subTab, setSubTab] = useState('paravoce'); // paravoce | checkin | chat | ranking

  // ── Fotos de perfil (cache compartilhado por todas as sub-abas) ──
  const [photos, setPhotos] = useState({});
  const photosRef = useRef({});
  useEffect(() => { photosRef.current = photos; }, [photos]);
  const ensurePhotos = useCallback(async (nomes) => {
    const faltam = [...new Set(nomes)].filter(n => n && !(n in photosRef.current));
    if (!faltam.length) return;
    const pairs = await Promise.all(faltam.map(async n => [n, await fetchPhotoByName(n).catch(() => null)]));
    setPhotos(prev => { const next = { ...prev }; pairs.forEach(([n, p]) => { next[n] = p || null; }); return next; });
  }, []);

  /* ═══════════════════ FEED "PARA VOCÊ" ═══════════════════ */
  const [feed, setFeed] = useState(null);           // null = carregando
  const [reacoes, setReacoes] = useState({});        // checkinId -> {counts:{emoji:n}, mine:emoji|null}
  const [comentCount, setComentCount] = useState({}); // checkinId -> n

  const loadFeed = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_gym_checkins').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { setFeed([]); return; }
    const posts = data || [];
    setFeed(posts);
    ensurePhotos(posts.map(p => p.player));
    const ids = posts.map(p => p.id);
    if (!ids.length) return;
    const [reacRes, comRes] = await Promise.all([
      supabase.from('uniko_gym_reactions').select('checkin_id,player,emoji').in('checkin_id', ids),
      supabase.from('uniko_gym_comments').select('checkin_id').in('checkin_id', ids),
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
    const ch = supabase.channel('uniko-gym-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_gym_checkins' }, ({ new: row }) => {
        setFeed(prev => (prev && prev.some(p => p.id === row.id)) ? prev : [row, ...(prev || [])]);
        ensurePhotos([row.player]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_gym_comments' }, ({ new: row }) => {
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

  const toggleReacao = async (checkinId, emoji) => {
    const cur = reacoes[checkinId] || { counts: {}, mine: null };
    const jaEssa = cur.mine === emoji;
    setReacoes(prev => {
      const atual = prev[checkinId] || { counts: {}, mine: null };
      const counts = { ...atual.counts };
      if (atual.mine) counts[atual.mine] = Math.max(0, (counts[atual.mine] || 1) - 1);
      if (!jaEssa) counts[emoji] = (counts[emoji] || 0) + 1;
      return { ...prev, [checkinId]: { counts, mine: jaEssa ? null : emoji } };
    });
    try {
      if (jaEssa) await supabase.from('uniko_gym_reactions').delete().eq('checkin_id', checkinId).eq('player', name);
      else await supabase.from('uniko_gym_reactions').upsert({ checkin_id: checkinId, player: name, emoji }, { onConflict: 'checkin_id,player' });
    } catch (e) { console.error('[uniko-gym] reação:', e); }
  };

  // ── Comentários (drawer por post) ──
  const [comentAberto, setComentAberto] = useState(null);
  const [comentLista, setComentLista] = useState([]);
  const [comentLoading, setComentLoading] = useState(false);
  const [comentTexto, setComentTexto] = useState('');

  const abrirComentarios = async (post) => {
    setComentAberto(post); setComentLista([]); setComentLoading(true); setComentTexto('');
    const { data } = await supabase.from('uniko_gym_comments').select('*').eq('checkin_id', post.id).order('created_at', { ascending: true });
    setComentLista(data || []);
    ensurePhotos((data || []).map(c => c.player));
    setComentLoading(false);
  };
  const enviarComentario = async () => {
    const texto = comentTexto.trim();
    if (!texto || !comentAberto) return;
    setComentTexto('');
    const { data, error } = await supabase.from('uniko_gym_comments').insert({ checkin_id: comentAberto.id, player: name, texto }).select().single();
    if (!error && data) {
      setComentLista(prev => [...prev, data]);
      setComentCount(prev => ({ ...prev, [comentAberto.id]: (prev[comentAberto.id] || 0) + 1 }));
    }
  };

  /* ═══════════════════ CHECK-IN (postar treino) ═══════════════════ */
  const [ckFile, setCkFile] = useState(null);
  const [ckPreview, setCkPreview] = useState(null);
  const [ckCaption, setCkCaption] = useState('');
  const [ckSaving, setCkSaving] = useState(false);
  const [ckMsg, setCkMsg] = useState('');
  const ckFileRef = useRef(null);

  const escolherFoto = (f) => {
    setCkFile(f || null); setCkMsg('');
    if (!f) { setCkPreview(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => setCkPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const postarCheckin = async () => {
    if (!ckFile) { setCkMsg('⚠️ Escolha uma foto do treino pra comprovar!'); return; }
    setCkSaving(true); setCkMsg('');
    try {
      const ext = (ckFile.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('uniko-gym-fotos').upload(path, ckFile, { contentType: ckFile.type || undefined, upsert: false });
      if (upErr) throw new Error('Falha ao enviar a foto: ' + upErr.message);
      const { data: pub } = supabase.storage.from('uniko-gym-fotos').getPublicUrl(path);
      const { error } = await supabase.from('uniko_gym_checkins').insert({ player: name, photo_url: pub.publicUrl, caption: ckCaption.trim() || null });
      if (error) throw new Error(error.message);
      setCkMsg('✅ Check-in postado! Bora treinar mais 💪');
      setCkFile(null); setCkPreview(null); setCkCaption('');
      if (ckFileRef.current) ckFileRef.current.value = '';
      await loadFeed();
      setTimeout(() => { setCkMsg(''); setSubTab('paravoce'); }, 1300);
    } catch (e) { setCkMsg('❌ ' + (e.message || 'Erro ao postar')); }
    setCkSaving(false);
  };

  /* ═══════════════════ CHAT DO GRUPO ═══════════════════ */
  const [chat, setChat] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('uniko_gym_chat').select('*').order('created_at', { ascending: false }).limit(80);
      const msgs = (data || []).slice().reverse();
      setChat(msgs);
      ensurePhotos(msgs.map(m => m.player));
    })();
    const ch = supabase.channel('uniko-gym-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_gym_chat' }, ({ new: row }) => {
        setChat(prev => (prev && prev.some(m => m.id === row.id)) ? prev : [...(prev || []).slice(-150), row]);
        ensurePhotos([row.player]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (subTab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat, subTab]);

  const enviarChat = async () => {
    const texto = chatMsg.trim(); if (!texto) return;
    setChatMsg('');
    try { await supabase.from('uniko_gym_chat').insert({ player: name, texto }); }
    catch (e) { console.error('[uniko-gym] chat:', e); }
  };

  /* ═══════════════════ RANKING ═══════════════════ */
  const [ranking, setRanking] = useState(null); // null = carregando
  const [rankPeriodo, setRankPeriodo] = useState('mes'); // mes | total

  const loadRanking = useCallback(async () => {
    // Pagina de verdade (o Supabase corta em 1000/request — mesma lição do bug
    // do "mês sumia" na Máquina do Tempo: sem paginar, dados recentes somem).
    const PAGE = 1000; let from = 0; const rows = [];
    for (;;) {
      const { data, error } = await supabase.from('uniko_gym_checkins').select('player,created_at').range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      rows.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const total = {}, mes = {};
    rows.forEach(r => {
      total[r.player] = (total[r.player] || 0) + 1;
      if ((r.created_at || '').slice(0, 7) === curMonth) mes[r.player] = (mes[r.player] || 0) + 1;
    });
    setRanking({ total, mes });
    ensurePhotos(Object.keys(total));
  }, [ensurePhotos]);

  useEffect(() => {
    if (subTab !== 'ranking' || ranking) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRanking();
  }, [subTab, ranking, loadRanking]);

  /* ═══════════════════ UI ═══════════════════ */
  const SUBNAV = [
    { id: 'paravoce', label: 'Para Você', emoji: '🏋️' },
    { id: 'checkin',  label: 'Check-in',  emoji: '📸' },
    { id: 'chat',     label: 'Chat',      emoji: '💬' },
    { id: 'ranking',  label: 'Ranking',   emoji: '🏆' },
  ];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', fontFamily: 'var(--font-body)' }}>
      <style>{GYM_CSS}</style>

      {/* Cabeçalho */}
      <div style={{ borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
        background: `linear-gradient(120deg, ${ENERGIA} 0%, ${FOGO} 65%, ${ROXO} 130%)`, boxShadow: `0 8px 26px ${EG}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .16, pointerEvents: 'none',
          background: 'radial-gradient(circle at 10% 20%, #fff 0%, transparent 45%)' }} />
        <div className="gym-float" style={{ width: 58, height: 58, borderRadius: 16, flexShrink: 0, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.2)' }}>
          <img src="/UNIKO_NEW.png" alt="" style={{ width: '76%', height: '76%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: '#fff' }}>Uniko Gym 💪</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.9)' }}>Transforme o treino numa competição saudável com a galera!</div>
        </div>
      </div>

      {/* Sub-navegação */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SUBNAV.map(s => {
          const sel = subTab === s.id;
          return (
            <button key={s.id} className="gym-btn" onClick={() => setSubTab(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                border: `1.5px solid ${sel ? ENERGIA : T.border}`, background: sel ? `${ENERGIA}16` : (T.surfaceSub || 'rgba(0,0,0,.03)'),
                color: sel ? ENERGIA : T.textS }}>
              <span>{s.emoji}</span>{s.label}
            </button>
          );
        })}
      </div>

      {/* ── PARA VOCÊ (feed estilo TikTok) ── */}
      {subTab === 'paravoce' && (
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          {feed === null ? (
            <div style={{ textAlign: 'center', padding: 60, color: T.textT, fontSize: 13 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${ENERGIA}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
              Carregando o feed...
            </div>
          ) : feed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🏋️</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>Ainda ninguém postou um treino</div>
              <div style={{ fontSize: 13, color: T.textT, marginBottom: 16 }}>Seja o primeiro a fazer check-in! 💪</div>
              <button className="gym-btn" onClick={() => setSubTab('checkin')}
                style={{ padding: '10px 22px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: `0 6px 18px ${EG}` }}>📸 Fazer check-in</button>
            </div>
          ) : (
            <div className="gym-feed" style={{ height: 'min(74vh, 780px)', overflowY: 'auto', borderRadius: 18, border: `1px solid ${T.border}`, boxShadow: T.sh }}>
              {feed.map(post => {
                const r = reacoes[post.id] || { counts: {}, mine: null };
                const totalReacoes = Object.values(r.counts).reduce((a, b) => a + b, 0);
                return (
                  <div key={post.id} className="gym-card" style={{ position: 'relative', height: '100%', minHeight: '100%', background: '#111' }}>
                    <img src={post.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.15) 0%, transparent 30%, transparent 55%, rgba(0,0,0,.85) 100%)' }} />

                    {/* Autor + legenda (canto inferior esquerdo) */}
                    <div style={{ position: 'absolute', left: 16, right: 74, bottom: 18, color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                        <img src={photos[post.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{post.player.split(' ').slice(0, 2).join(' ')}</div>
                          <div style={{ fontSize: 11, opacity: .85 }}>{tempoRelativo(post.created_at)}</div>
                        </div>
                      </div>
                      {post.caption && <div style={{ fontSize: 13, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{post.caption}</div>}
                    </div>

                    {/* Barra de ações (direita, estilo TikTok) */}
                    <div style={{ position: 'absolute', right: 10, bottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      {REACOES.map(rc => {
                        const ativo = r.mine === (rc.emoji || rc.id);
                        const emojiKey = rc.emoji || rc.id;
                        const n = r.counts[emojiKey] || 0;
                        return (
                          <button key={rc.id} className="gym-btn" onClick={() => toggleReacao(post.id, emojiKey)} title={rc.label}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                            <div className={ativo ? 'gym-pop' : undefined} key={ativo ? `${post.id}-${rc.id}-on` : `${post.id}-${rc.id}-off`}
                              style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
                                background: ativo ? 'rgba(255,107,53,.9)' : 'rgba(0,0,0,.35)', boxShadow: ativo ? `0 0 0 2px #fff` : 'none' }}>
                              {rc.img ? <img src={rc.img} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} /> : rc.emoji}
                            </div>
                            {n > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{n}</span>}
                          </button>
                        );
                      })}
                      <button className="gym-btn" onClick={() => abrirComentarios(post)} title="Comentários"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: 'rgba(0,0,0,.35)' }}>💬</div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{comentCount[post.id] || 0}</span>
                      </button>
                      {totalReacoes > 0 && <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.7)' }}>{totalReacoes} reação{totalReacoes !== 1 ? 'ões' : ''}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ textAlign: 'center', fontSize: 11, color: T.textT, marginTop: 10 }}>Arraste pra cima ↑ pra ver o próximo treino</div>
        </div>
      )}

      {/* ── CHECK-IN (postar treino) ── */}
      {subTab === 'checkin' && (
        <div className="gym-fade" style={{ maxWidth: 460, margin: '0 auto', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22, boxShadow: T.sh }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 4 }}>Registrar treino 📸</div>
          <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16, lineHeight: 1.5 }}>Manda uma foto comprovando que você treinou — ela entra no feed "Para Você" e conta ponto no ranking!</div>

          <input ref={ckFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => escolherFoto(e.target.files?.[0] || null)} />
          {ckPreview ? (
            <div onClick={() => ckFileRef.current?.click()} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', marginBottom: 14, aspectRatio: '4/5', background: '#111' }}>
              <img src={ckPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '5px 11px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 700 }}>Trocar foto</div>
            </div>
          ) : (
            <button className="gym-btn" onClick={() => ckFileRef.current?.click()}
              style={{ width: '100%', aspectRatio: '4/5', borderRadius: 14, border: `2px dashed ${ENERGIA}66`, background: `${ENERGIA}0a`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
              <div style={{ fontSize: 38 }}>📷</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ENERGIA }}>Escolher foto do treino</div>
            </button>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 5 }}>Legenda (opcional)</div>
            <textarea value={ckCaption} onChange={e => setCkCaption(e.target.value)} placeholder="Como foi o treino hoje?" rows={3} maxLength={220}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface || '#fff', fontSize: 13,
                color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
          </div>

          {ckMsg && <div style={{ fontSize: 12.5, marginBottom: 12, padding: '8px 13px', borderRadius: 8,
            color: ckMsg.startsWith('✅') ? '#16a34a' : '#C04050', background: ckMsg.startsWith('✅') ? 'rgba(34,197,94,.08)' : 'rgba(192,64,80,.06)' }}>{ckMsg}</div>}

          <button className="gym-btn" onClick={postarCheckin} disabled={ckSaving || !ckFile}
            style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14,
              cursor: (ckSaving || !ckFile) ? 'not-allowed' : 'pointer', opacity: (ckSaving || !ckFile) ? .55 : 1,
              background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: (ckSaving || !ckFile) ? 'none' : `0 6px 18px ${EG}` }}>
            {ckSaving ? 'Postando...' : '🔥 Postar check-in'}
          </button>
        </div>
      )}

      {/* ── CHAT DO GRUPO ── */}
      {subTab === 'chat' && (
        <div className="gym-fade" style={{ maxWidth: 620, margin: '0 auto', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16,
          boxShadow: T.sh, display: 'flex', flexDirection: 'column', height: 'min(66vh, 640px)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 13, fontWeight: 800, color: T.text }}>💬 Chat do grupo — combine seus treinos</div>
          <div className="gym-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {chat === null ? (
              <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Carregando chat...</div>
            ) : chat.length === 0 ? (
              <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Nenhuma mensagem ainda. Chama a galera pra treinar! 💪</div>
            ) : chat.map(m => {
              const eu = m.player === name;
              return (
                <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: eu ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  <img src={photos[m.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                  <div style={{ maxWidth: '72%' }}>
                    {!eu && <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textT, marginBottom: 2 }}>{m.player.split(' ')[0]}</div>}
                    <div style={{ padding: '8px 12px', borderRadius: eu ? '14px 3px 14px 14px' : '3px 14px 14px 14px', fontSize: 13, lineHeight: 1.4,
                      background: eu ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.04)'),
                      color: eu ? '#fff' : T.text }}>{m.texto}</div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${T.border}` }}>
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChat()}
              placeholder="Escreva uma mensagem..." maxLength={300}
              style={{ flex: 1, padding: '10px 13px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.surface || '#fff', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
            <button className="gym-btn" onClick={enviarChat} disabled={!chatMsg.trim()}
              style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: chatMsg.trim() ? 'pointer' : 'default',
                background: chatMsg.trim() ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.06)'), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: chatMsg.trim() ? 1 : .5 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── RANKING ── */}
      {subTab === 'ranking' && (
        <div className="gym-fade" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
            {[['mes', 'Este mês'], ['total', 'Todos os tempos']].map(([id, label]) => {
              const sel = rankPeriodo === id;
              return (
                <button key={id} className="gym-btn" onClick={() => setRankPeriodo(id)}
                  style={{ padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                    border: `1.5px solid ${sel ? ENERGIA : T.border}`, background: sel ? `${ENERGIA}16` : 'transparent', color: sel ? ENERGIA : T.textS }}>{label}</button>
              );
            })}
          </div>

          {ranking === null ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando ranking...</div>
          ) : (() => {
            const mapa = rankPeriodo === 'mes' ? ranking.mes : ranking.total;
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
                {/* Destaque do topo — "Atleta do mês/geral" */}
                <div style={{ background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, borderRadius: 16, padding: '18px 20px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 14, boxShadow: `0 8px 24px ${EG}`, color: '#fff' }}>
                  <img src={photos[lider[0]] || '/UNIKO_NEW.png'} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', opacity: .9 }}>🏆 {rankPeriodo === 'mes' ? 'ATLETA DO MÊS' : 'MAIOR RATO DE ACADEMIA'}</div>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800 }}>{lider[0].split(' ').slice(0, 2).join(' ')}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{lider[1]}<span style={{ fontSize: 11, fontWeight: 600, opacity: .85 }}> treinos</span></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lista.map(([player, n], i) => (
                    <div key={player} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12,
                      background: cardBg, border: `1px solid ${T.border}` }}>
                      <div style={{ width: 26, textAlign: 'center', fontSize: i < 3 ? 18 : 13, fontWeight: 800, color: T.textT, flexShrink: 0 }}>{medalha[i] || i + 1}</div>
                      <img src={photos[player] || '/UNIKO_NEW.png'} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: ENERGIA, background: `${ENERGIA}12`, borderRadius: 7, padding: '3px 10px', flexShrink: 0 }}>{n} treino{n !== 1 ? 's' : ''}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── MODAL: comentários ── */}
      {comentAberto && (
        <div onClick={() => setComentAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(10,6,10,.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
          <div onClick={e => e.stopPropagation()} className="gym-pop" style={{ background: cardBg, borderRadius: '20px 20px 0 0', border: `1px solid ${T.border}`,
            width: '100%', maxWidth: 480, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>💬 Comentários</div>
              <button onClick={() => setComentAberto(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="gym-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                style={{ flex: 1, padding: '10px 13px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.surface || '#fff', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
              <button className="gym-btn" onClick={enviarComentario} disabled={!comentTexto.trim()}
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

export { TabUnikoGym };
export default TabUnikoGym;
