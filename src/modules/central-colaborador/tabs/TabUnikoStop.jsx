// src/modules/central-colaborador/tabs/TabUnikoStop.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO STOP! — Stop/Adedonha online (estilo stopots), com salas.
//
// COMO É A RODADA: sorteia uma letra → todo mundo preenche as categorias →
// alguém aperta STOP (ou o tempo acaba) → todos veem as respostas e podem
// CONTESTAR as dos outros → pontuação → próxima rodada.
//
// PONTUAÇÃO (a clássica do jogo):
//   10 = ninguém mais escreveu isso    5 = alguém escreveu igual
//    0 = vazio, não começa com a letra, ou a maioria contestou
//
// A validação é por CONTESTAÇÃO, não por voto em tudo: votar em cada resposta de
// cada categoria seria interminável com 8 pessoas. Aqui vale o que foi escrito,
// a menos que a maioria diga que não vale — que é como se joga na mesa.
//
// SINCRONIA: mesma arquitetura já testada do Uniko Paint —
//   • ESTADO da partida na tabela uniko_stop_state (postgres_changes + poll),
//     carimbado com `ts` pra descartar resposta atrasada que rebobina a rodada;
//   • PRESENCE única (quem está em qual sala), canal recriado ao trocar de sala
//     porque `track()` repetido NÃO propaga;
//   • o que é efêmero (respostas, STOP, contestações) vai por BROADCAST;
//   • host = quem criou a sala; se sair, o mais antigo assume.
// Ver supabase_uniko_stop.sql.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';

const GLOBAL_ROOM = 'global';
const ROUND_MS   = 120_000;   // teto da rodada se ninguém der STOP
const STOP_MS    = 8_000;     // depois do STOP, quem ficou pra trás tem isto
const VALIDA_MS  = 22_000;    // janela pra contestar
const RESULT_MS  = 9_000;     // tela de pontos
const MIN_PLAYERS = 2;
const ROOM_TTL_MS = 20 * 60_000;
const LAP_OPTIONS = [3, 5, 8, 10];
const DEFAULT_LAPS = 5;
/* Sem K/W/X/Y/Z: em português quase não há palavra comum com elas e a rodada
   vira 0 pra todo mundo, o que não tem graça. */
const LETRAS = 'ABCDEFGHIJLMNOPQRSTUV'.split('');

/* Categorias — o criador escolhe quais entram na sala. */
const CATEGORIAS = [
  { id: 'nome',      nome: 'Nome',            emoji: '🙋' },
  { id: 'lugar',     nome: 'Lugar',           emoji: '📍' },
  { id: 'objeto',    nome: 'Objeto',          emoji: '📦' },
  { id: 'cor',       nome: 'Cor',             emoji: '🎨' },
  { id: 'animal',    nome: 'Animal',          emoji: '🐾' },
  { id: 'comida',    nome: 'Comida',          emoji: '🍕' },
  { id: 'filme',     nome: 'Filme/Série',     emoji: '🎬' },
  { id: 'marca',     nome: 'Marca',           emoji: '™️' },
  { id: 'profissao', nome: 'Profissão',       emoji: '💼' },
  { id: 'fruta',     nome: 'Fruta',           emoji: '🍎' },
  { id: 'pais',      nome: 'País',            emoji: '🌎' },
  { id: 'carro',     nome: 'Carro',           emoji: '🚗' },
  { id: 'sogra',     nome: 'Minha sogra é...', emoji: '😅' },
  { id: 'famoso',    nome: 'Famoso',          emoji: '⭐' },
  { id: 'parte',     nome: 'Parte do corpo',  emoji: '🦴' },
  { id: 'banda',     nome: 'Banda/Cantor',    emoji: '🎵' },
];
const CATS_PADRAO = ['nome', 'lugar', 'objeto', 'cor', 'animal', 'comida', 'filme', 'sogra'];
const catById = (id) => CATEGORIAS.find(c => c.id === id) || { id, nome: id, emoji: '❓' };

/* Paleta própria (mesma ideia do Paint: o jogo tem identidade, o resto do app
   segue o tema). Textos usam T.text — cor viva em texto quebra no tema escuro. */
const US = { roxo: '#7C3AED', roxoL: '#A78BFA', verde: '#10B981', amarelo: '#F59E0B',
  vermelho: '#EF4444', azul: '#3B82F6', ink: '#1A1A2E' };
const A = US.roxo, A2 = US.roxoL, AG = 'rgba(124,58,237,.28)';

const STOP_CSS = `
@keyframes usPop { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes usFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes usPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes usShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
@keyframes usLetra { 0% { transform: scale(.3) rotate(-25deg); opacity: 0; } 60% { transform: scale(1.2) rotate(6deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes usSpin { to { transform: rotate(360deg); } }
.us-pop { animation: usPop .3s cubic-bezier(.2,1.4,.4,1) both; }
.us-fade { animation: usFade .35s ease both; }
.us-pulse { animation: usPulse 1.6s ease-in-out infinite; }
.us-urgent { animation: usShake .5s ease-in-out infinite; }
.us-letra { animation: usLetra .55s cubic-bezier(.2,1.5,.4,1) both; }
.us-btn { transition: transform .12s, box-shadow .12s, filter .12s; }
.us-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
.us-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
.us-card { transition: transform .16s, box-shadow .16s, border-color .16s; }
.us-card:hover { transform: translateY(-3px); }
.us-scroll { scrollbar-width: thin; scrollbar-color: ${US.roxo}99 rgba(128,128,128,.14); }
.us-scroll::-webkit-scrollbar { width: 9px; }
.us-scroll::-webkit-scrollbar-track { background: rgba(128,128,128,.14); border-radius: 99px; margin: 4px 0; }
.us-scroll::-webkit-scrollbar-thumb { background: ${US.roxo}99; border-radius: 99px; border: 2px solid transparent; background-clip: content-box; }
.us-sembarra { scrollbar-width: none; -ms-overflow-style: none; }
.us-sembarra::-webkit-scrollbar { width: 0; display: none; }
.us-halo { position: relative; }
.us-halo::before {
  content: ''; position: absolute; inset: -14%; border-radius: 50%; z-index: -1;
  background: conic-gradient(${US.roxo}, ${US.azul}, ${US.verde}, ${US.amarelo}, ${US.roxo});
  filter: blur(18px); opacity: .38; animation: usSpin 9s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .us-pulse, .us-urgent, .us-halo::before, .us-letra { animation: none !important; }
}
`;

const Svg = ({ children, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...p}>{children}</svg>
);
const IcoPlus  = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
const IcoUsers = (p) => <Svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></Svg>;
const IcoExit  = (p) => <Svg {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const IcoTrash = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></Svg>;
const IcoCrown = (p) => <Svg {...p}><path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/></Svg>;
const IcoX     = (p) => <Svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const IcoCheck = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>;

/* ── Som (mesmo esquema do Paint: WebAudio, sem arquivo no bundle) ── */
let _ac = null;
const audioCtx = () => {
  if (!_ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) _ac = new AC(); }
  if (_ac?.state === 'suspended') _ac.resume().catch(() => {});
  return _ac;
};
const beep = (freq, dur = 0.12, type = 'sine', vol = 0.14, delay = 0) => {
  try {
    const c = audioCtx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.03);
  } catch { /* sem áudio: o jogo funciona igual */ }
};
const SFX = {
  letra:  () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.18, 'triangle', 0.12, i * 0.07)),
  stop:   () => { beep(880, 0.1, 'square', 0.14); beep(660, 0.1, 'square', 0.14, 0.09); beep(440, 0.22, 'square', 0.14, 0.18); },
  tick:   () => beep(1000, 0.045, 'square', 0.05),
  pontos: () => [659, 784, 988].forEach((f, i) => beep(f, 0.16, 'sine', 0.12, i * 0.07)),
  vitoria: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.24, 'triangle', 0.13, i * 0.12)),
  entrou: () => beep(660, 0.07, 'sine', 0.07),
};
const SOUND_KEY = 'us_sound';

const myName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
const PHOTO_SRC_KEY = 'up_photo_src';   // mesma foto escolhida no Uniko Paint
const myPhotoSrc = () => {
  try { return localStorage.getItem(PHOTO_SRC_KEY) || '/UNIKO_NEW.png'; }
  catch { return '/UNIKO_NEW.png'; }
};
const semTabela = (e) => !!e && (e.code === 'PGRST205' || e.code === '42P01'
  || /Could not find the table|does not exist|schema cache/i.test(e.message || ''));

/* Compara ignorando acento/caixa — "Ácaro" e "acaro" são a mesma resposta. */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, ' ').trim();
/* Vale? Precisa começar com a letra sorteada e ter ao menos 2 letras.
   ("A" sozinho não é resposta; e a comparação ignora acento, então "Índia"
   conta pra letra I.) */
const valeResposta = (txt, letra) => {
  const n = norm(txt);
  return n.length >= 2 && n[0] === norm(letra);
};

/* ═══════════════════════════════════════════════════════════════════════════
   RANKING (lobby)
   ═══════════════════════════════════════════════════════════════════════════ */
const RankingStop = ({ name, cardBg }) => {
  const [linhas, setLinhas] = useState(null);
  const [faltaSql, setFaltaSql] = useState(false);
  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      const { data, error } = await supabase.from('uniko_stop_ranking')
        .select('player, pontos, partidas, vitorias').order('pontos', { ascending: false }).limit(20);
      if (!vivo) return;
      if (semTabela(error)) { setFaltaSql(true); return; }
      if (error) { console.error('[uniko-stop] ranking:', error.message); return; }
      setLinhas(data || []);
    };
    carregar();
    const t = setInterval(carregar, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  const medalha = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`);
  return (
    <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14,
      boxShadow: T.sh, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11, flexShrink: 0 }}>
        <span style={{ fontSize: 17 }}>🏆</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.textT, letterSpacing: '.07em' }}>RANKING GERAL</span>
      </div>
      {faltaSql ? (
        <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.5 }}>
          Falta rodar <b style={{ color: T.text }}>supabase_uniko_stop.sql</b>.
        </div>
      ) : linhas === null ? <div style={{ fontSize: 12, color: T.textD }}>Carregando...</div>
        : !linhas.length ? (
        <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.5 }}>
          Ninguém pontuou ainda. Jogue uma partida e apareça aqui!
        </div>
      ) : (
        <div className="us-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {linhas.map((l, i) => {
            const eu = l.player === name;
            return (
              <div key={l.player} className="us-fade" style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 8px', borderRadius: 9, background: eu ? `${A}12` : 'transparent',
                border: eu ? `1px solid ${A}44` : '1px solid transparent' }}>
                <span style={{ fontSize: i < 3 ? 15 : 11, fontWeight: 800, color: i < 3 ? T.text : T.textD,
                  width: 22, textAlign: 'center', flexShrink: 0 }}>{medalha(i)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: eu ? 800 : 700, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.player.split(' ')[0]}{eu && ' (você)'}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textT }}>
                    {l.partidas} {l.partidas === 1 ? 'partida' : 'partidas'}{l.vitorias > 0 && ` · ${l.vitorias} 🏅`}
                  </div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: A, flexShrink: 0 }}>{l.pontos}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY
   ═══════════════════════════════════════════════════════════════════════════ */
const Lobby = ({ name, porSala, onEnter }) => {
  const [rooms, setRooms] = useState([]);
  const [criando, setCriando] = useState(false);
  const [nomeSala, setNomeSala] = useState('');
  const [cats, setCats] = useState(CATS_PADRAO);
  const [erro, setErro] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const cardBg = T.surface || '#fff';
  const isAdmin = getAuthUser()?.role === 'admin';

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_stop_state')
      .select('id, state, updated_at').order('updated_at', { ascending: false });
    if (error) { console.error('[uniko-stop] lobby:', error.message); return; }
    setRooms(data || []);
    const velhas = (data || []).filter(r =>
      r.id !== GLOBAL_ROOM && !(porSala[r.id]?.length) &&
      Date.now() - new Date(r.updated_at).getTime() > ROOM_TTL_MS);
    if (velhas.length) {
      await supabase.from('uniko_stop_state').delete().in('id', velhas.map(r => r.id));
      setRooms(rs => rs.filter(r => !velhas.some(v => v.id === r.id)));
    }
  }, [porSala]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase.channel('uniko-stop-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_stop_state' }, load)
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [load]);

  const toggleCat = (id) => setCats(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));

  const criarSala = async () => {
    if (cats.length < 3) { setErro('Escolha pelo menos 3 categorias.'); return; }
    if (cats.length > 10) { setErro('No máximo 10 categorias — senão a rodada não acaba nunca.'); return; }
    const nome = nomeSala.trim() || `Sala do ${name.split(' ')[0]}`;
    const id = Math.random().toString(36).slice(2, 8);
    setErro('');
    const { error } = await supabase.from('uniko_stop_state').insert({
      id, state: { phase: 'lobby', round: 0, scores: {}, nome, cats, criador: name },
    });
    if (error) { setErro('Não deu pra criar a sala.'); console.error('[uniko-stop] criar:', error); return; }
    onEnter(id);
  };
  const excluir = async (id) => {
    setConfirmDel(null);
    await supabase.from('uniko_stop_state').delete().eq('id', id);
    setRooms(rs => rs.filter(r => r.id !== id));
  };
  const podeExcluir = (r) => r.id !== GLOBAL_ROOM && (isAdmin || r.state?.criador === name);

  const inputCss = {
    width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`,
    background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13,
    fontFamily: 'var(--font-body)', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <style>{STOP_CSS}</style>
      {/* Cabeçalho */}
      <div style={{ borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        background: `linear-gradient(120deg, ${US.roxo} 0%, ${US.azul} 55%, ${US.verde} 120%)`,
        boxShadow: `0 8px 26px ${AG}`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .18, pointerEvents: 'none',
          background: 'radial-gradient(circle at 10% 20%, #fff 0%, transparent 45%), radial-gradient(circle at 90% 80%, #fff 0%, transparent 40%)' }} />
        <div className="us-halo" style={{ width: 62, height: 62, borderRadius: 16, flexShrink: 0, position: 'relative',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-brand)', fontSize: 26, fontWeight: 800, color: US.roxo,
          boxShadow: '0 6px 18px rgba(0,0,0,.25)' }}>
          S!
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: '#fff' }}>Uniko Stop!</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>
            Sorteia a letra, todo mundo escreve, quem terminar grita STOP!
          </div>
        </div>
        <button className="us-btn" onClick={() => setCriando(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, border: 'none',
            background: '#fff', color: US.roxo, fontSize: 13, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(0,0,0,.18)', position: 'relative' }}>
          <IcoPlus size={15} />Criar sala
        </button>
      </div>

      {/* Criar sala */}
      {criando && (
        <div className="us-fade" style={{ background: cardBg, border: `1px solid ${A}55`, borderRadius: 14,
          padding: 16, boxShadow: T.sh, flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 11 }}>Nova sala</div>
          <input value={nomeSala} onChange={e => setNomeSala(e.target.value)} maxLength={28}
            onKeyDown={e => e.key === 'Enter' && criarSala()}
            placeholder={`Sala do ${name.split(' ')[0]}`} style={{ ...inputCss, marginBottom: 12 }} />
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em', marginBottom: 7 }}>
            CATEGORIAS ({cats.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {CATEGORIAS.map(c => {
              const on = cats.includes(c.id);
              return (
                <button key={c.id} className="us-btn" onClick={() => toggleCat(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 999,
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all .12s',
                    border: on ? `2px solid ${A}` : `1px solid ${T.border}`,
                    background: on ? `${A}18` : 'transparent', color: T.text }}>
                  <span>{c.emoji}</span>{c.nome}
                </button>
              );
            })}
          </div>
          {erro && <div style={{ fontSize: 12, color: '#E63946', marginBottom: 8 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="us-btn" onClick={criarSala}
              style={{ padding: '10px 22px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
                cursor: 'pointer', background: `linear-gradient(135deg, ${A}, ${A2})`, boxShadow: `0 5px 16px ${AG}` }}>
              Criar e entrar
            </button>
            <button className="us-btn" onClick={() => setCriando(false)}
              style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'transparent',
                color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Salas + ranking */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 268px',
        gridTemplateRows: 'minmax(0, 1fr)', gap: 12, minHeight: 0 }}>
        <div className="us-sembarra" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginBottom: 10 }}>
            SALAS ({rooms.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 340px))',
            justifyContent: 'start', gap: 12 }}>
            {rooms.map(r => {
              const st = r.state || {};
              const gente = porSala[r.id] || [];
              const fixa = r.id === GLOBAL_ROOM;
              const jogando = st.phase && st.phase !== 'lobby' && st.phase !== 'over';
              const cs = st.cats || CATS_PADRAO;
              return (
                <div key={r.id} className="us-card us-fade" style={{ background: cardBg, borderRadius: 14, padding: 14,
                  border: `1.5px solid ${fixa ? `${A}55` : T.border}`, boxShadow: T.sh, display: 'flex',
                  flexDirection: 'column', gap: 10, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-brand)',
                      fontSize: 17, fontWeight: 800, color: A, background: `${A}18`, border: `1px solid ${A}33` }}>S!</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {st.nome || (fixa ? 'Sala Geral' : 'Sala')}
                      </div>
                      <div style={{ fontSize: 11, color: T.textT, marginTop: 2, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cs.length} categorias: {cs.slice(0, 3).map(c => catById(c).nome).join(', ')}{cs.length > 3 && '...'}
                      </div>
                    </div>
                    {jogando && (
                      <div style={{ padding: '3px 8px', borderRadius: 999, background: '#10B98118', color: US.verde,
                        fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>EM JOGO</div>
                    )}
                    {podeExcluir(r) && (
                      <button className="us-btn" onClick={() => setConfirmDel(r.id)} title="Excluir sala"
                        style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`,
                          background: 'transparent', color: T.textT, cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IcoTrash size={13} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 30 }}>
                    {gente.length ? (
                      <>
                        <div style={{ display: 'flex' }}>
                          {gente.slice(0, 6).map((p, i) => (
                            <img key={p.name} src={p.photo || '/UNIKO_NEW.png'} alt="" title={p.name}
                              style={{ width: 27, height: 27, borderRadius: '50%', objectFit: 'cover',
                                background: T.surfaceSub, border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11.5, color: T.textT }}>
                          {gente.length === 1 ? `${gente[0].name.split(' ')[0]} está aqui` : `${gente.length} jogadores`}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 11.5, color: T.textD, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <IcoUsers size={13} />Vazia — seja o primeiro
                      </span>
                    )}
                  </div>
                  <button className="us-btn" onClick={() => { SFX.entrou(); onEnter(r.id); }}
                    style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', color: '#fff',
                      fontSize: 13, fontWeight: 800, cursor: 'pointer',
                      background: `linear-gradient(135deg, ${A}, ${A2})`, boxShadow: `0 4px 14px ${AG}` }}>
                    Entrar
                  </button>
                  {confirmDel === r.id && (
                    <div className="us-pop" style={{ position: 'absolute', inset: 0, borderRadius: 14, zIndex: 2,
                      background: 'rgba(255,255,255,.97)', border: '1px solid #E6394655', padding: 14,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E' }}>Excluir esta sala?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="us-btn" onClick={() => excluir(r.id)} style={{ padding: '7px 16px', borderRadius: 8,
                          border: 'none', background: '#E63946', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                        <button className="us-btn" onClick={() => setConfirmDel(null)} style={{ padding: '7px 16px', borderRadius: 8,
                          border: '1px solid #d1d5db', background: 'transparent', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!rooms.length && (
            <div style={{ textAlign: 'center', padding: 40, color: T.textD, fontSize: 13 }}>Carregando salas...</div>
          )}
        </div>
        <RankingStop name={name} cardBg={cardBg} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SALA — a partida
   ═══════════════════════════════════════════════════════════════════════════ */
const Sala = ({ roomId, name, players, onLeave }) => {
  const [state, setState] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [laps, setLaps] = useState(DEFAULT_LAPS);
  const [minhas, setMinhas] = useState({});      // o que EU escrevi nesta rodada
  const [somOn, setSomOn] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; } });
  const somRef = useRef(somOn);
  useEffect(() => { somRef.current = somOn; try { localStorage.setItem(SOUND_KEY, somOn ? '1' : '0'); } catch { /* sem localStorage */ } }, [somOn]);
  const sfx = useCallback((k) => { if (somRef.current) SFX[k]?.(); }, []);

  const chanRef = useRef(null);
  const stateRef = useRef(null);
  const hostRef = useRef(false);
  const playersRef = useRef([]);
  const minhasRef = useRef({});
  const ultFase = useRef(null);
  const ultTick = useRef(0);
  const cardBg = T.surface || '#fff';

  const cats = useMemo(() => state?.cats || CATS_PADRAO, [state?.cats]);
  /* HOST: quem criou manda; se não está, o mais antigo. (Ordem alfabética fazia
     o host trocar sozinho quando alguém entrava — bug já vivido no Paint.) */
  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) =>
      (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost = host === name;
  const secsLeft = state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { hostRef.current = isHost; }, [isHost]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { minhasRef.current = minhas; }, [minhas]);

  /* ── Estado (mesma proteção do Paint: descarta o que chega atrasado) ── */
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
      await supabase.from('uniko_stop_state')
        .update({ state: carimbado, updated_at: new Date().toISOString() }).eq('id', roomId);
    } catch (e) { console.error('[uniko-stop] pushState:', e); }
  }, [roomId, aplicaEstado]);

  useEffect(() => {
    let vivo = true;
    const load = async () => {
      const { data } = await supabase.from('uniko_stop_state').select('state').eq('id', roomId).maybeSingle();
      if (!vivo) return;
      aplicaEstado(data?.state);
    };
    load();
    const ch = supabase.channel(`uniko-stop-state-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_stop_state', filter: `id=eq.${roomId}` },
        ({ new: row }) => aplicaEstado(row?.state))
      .subscribe();
    const poll = setInterval(load, 4000);
    return () => { vivo = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId, aplicaEstado]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  /* ── Sons por transição de fase ── */
  useEffect(() => {
    const f = state?.phase;
    if (f === ultFase.current) return;
    // Rodada nova: limpa o formulário. Roda uma vez por transição de fase (o
    // `ultFase` garante), não é cascata de render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f === 'jogando') { sfx('letra'); setMinhas({}); }
    if (f === 'parando') sfx('stop');
    if (f === 'resultado') sfx('pontos');
    if (f === 'over') sfx('vitoria');
    ultFase.current = f;
  }, [state?.phase, sfx]);

  useEffect(() => {
    if (state?.phase !== 'jogando' || secsLeft > 5 || secsLeft <= 0) return;
    if (ultTick.current === secsLeft) return;
    ultTick.current = secsLeft;
    sfx('tick');
  }, [secsLeft, state?.phase, sfx]);

  /* ── Enviar minhas respostas (no STOP ou no fim do tempo) ── */
  const enviarRespostas = useCallback(() => {
    chanRef.current?.send({ type: 'broadcast', event: 'respostas', payload: { name, respostas: minhasRef.current } });
  }, [name]);

  const darStop = () => {
    const s = stateRef.current;
    if (!s || s.phase !== 'jogando') return;
    chanRef.current?.send({ type: 'broadcast', event: 'stop', payload: { name } });
    enviarRespostas();
    // Quem apertou STOP encerra a rodada; os outros têm STOP_MS pra mandar o que
    // já tinham escrito (senão perderiam tudo por causa da latência).
    pushState({ ...s, phase: 'parando', stopPor: name, endsAt: Date.now() + STOP_MS });
  };

  /* ── Motor (só o host escreve) ── */
  const novaRodada = (round, scores, usadas) => {
    const livres = LETRAS.filter(l => !usadas.includes(l));
    const pool = livres.length ? livres : LETRAS;     // acabou o alfabeto → recomeça
    const letra = pool[Math.floor(Math.random() * pool.length)];
    const base = stateRef.current || {};
    pushState({
      ...base, phase: 'jogando', round, letra, endsAt: Date.now() + ROUND_MS,
      scores, usadas: [...usadas, letra], respostas: {}, contest: {}, stopPor: null,
    });
  };
  const comecar = () => {
    if (!state) return;
    pushState({ ...state, totalRounds: laps, scores: {}, usadas: [], round: 0 });
    setTimeout(() => novaRodada(1, {}, []), 60);
  };

  const salvarRanking = (s) => {
    if (!s || s.rankSalvo) return;
    const scores = s.scores || {};
    const nomes = Object.keys(scores);
    if (!nomes.length) return;
    const campeao = nomes.reduce((a, b) => (scores[b] > scores[a] ? b : a), nomes[0]);
    nomes.forEach(quem => {
      supabase.rpc('uniko_stop_add_score', {
        p_player: quem, p_pontos: scores[quem] || 0, p_venceu: quem === campeao,
      }).then(({ error }) => { if (error) console.error('[uniko-stop] ranking:', error.message); });
    });
  };

  /* Pontuação clássica: 10 se ninguém repetiu, 5 se repetiu, 0 se não vale ou a
     maioria contestou. */
  const apurar = (s) => {
    const resp = s.respostas || {};
    const contest = s.contest || {};
    const quem = Object.keys(resp);
    const votantes = Math.max(playersRef.current.length, 1);
    const pontos = {};
    const detalhe = {};
    quem.forEach(p => { pontos[p] = 0; detalhe[p] = {}; });
    cats.forEach(cat => {
      // quantos escreveram a MESMA coisa nesta categoria
      const cont = {};
      quem.forEach(p => {
        const v = norm(resp[p]?.[cat]);
        if (v && valeResposta(resp[p]?.[cat], s.letra)) cont[v] = (cont[v] || 0) + 1;
      });
      quem.forEach(p => {
        const txt = resp[p]?.[cat];
        const v = norm(txt);
        const chave = `${p}|${cat}`;
        const contra = Object.keys(contest[chave] || {}).length;
        let pts = 0, motivo;
        if (!v) motivo = 'vazio';
        else if (!valeResposta(txt, s.letra)) motivo = `não começa com ${s.letra}`;
        else if (contra > votantes / 2) motivo = 'contestada';
        else if (cont[v] > 1) { pts = 5; motivo = 'repetida'; }
        else { pts = 10; motivo = 'única'; }
        pontos[p] += pts;
        detalhe[p][cat] = { txt: txt || '', pts, motivo };
      });
    });
    return { pontos, detalhe };
  };

  useEffect(() => {
    if (!isHost || !state) return;
    const t = setInterval(() => {
      const s = stateRef.current;
      if (!s?.endsAt || Date.now() < s.endsAt) return;
      if (s.phase === 'jogando') {
        // Tempo acabou sem STOP — todo mundo manda o que tem.
        enviarRespostas();
        pushState({ ...s, phase: 'parando', stopPor: null, endsAt: Date.now() + STOP_MS });
      } else if (s.phase === 'parando') {
        pushState({ ...s, phase: 'validando', endsAt: Date.now() + VALIDA_MS });
      } else if (s.phase === 'validando') {
        const { pontos, detalhe } = apurar(s);
        const scores = { ...(s.scores || {}) };
        Object.entries(pontos).forEach(([p, v]) => { scores[p] = (scores[p] || 0) + v; });
        pushState({ ...s, phase: 'resultado', scores, ganhos: pontos, detalhe, endsAt: Date.now() + RESULT_MS });
      } else if (s.phase === 'resultado') {
        if ((s.round || 1) >= (s.totalRounds || 1)) {
          salvarRanking(s);
          pushState({ ...s, phase: 'over', endsAt: null, rankSalvo: true });
        } else {
          novaRodada((s.round || 1) + 1, s.scores || {}, s.usadas || []);
        }
      }
    }, 400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.endsAt, players]);

  /* ── Canal da sala ── */
  useEffect(() => {
    const ch = supabase.channel(`uniko-stop-room-${roomId}`);
    chanRef.current = ch;
    ch.on('broadcast', { event: 'stop' }, ({ payload }) => {
      if (payload?.name === name) return;
      enviarRespostas();          // alguém parou: manda o que eu tinha
      sfx('stop');
    });
    ch.on('broadcast', { event: 'respostas' }, ({ payload }) => {
      if (!hostRef.current) return;         // só o host junta
      const s = stateRef.current; if (!s) return;
      pushState({ ...s, respostas: { ...(s.respostas || {}), [payload.name]: payload.respostas || {} } });
    });
    ch.on('broadcast', { event: 'contest' }, ({ payload }) => {
      if (!hostRef.current) return;
      const s = stateRef.current; if (!s) return;
      const chave = payload.chave;
      const atual = s.contest || {};
      const desse = { ...(atual[chave] || {}) };
      if (payload.tirar) delete desse[payload.de]; else desse[payload.de] = true;
      pushState({ ...s, contest: { ...atual, [chave]: desse } });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, name]);

  const contestar = (alvo, cat) => {
    const chave = `${alvo}|${cat}`;
    const jaContestei = !!(state?.contest?.[chave]?.[name]);
    chanRef.current?.send({ type: 'broadcast', event: 'contest', payload: { chave, de: name, tirar: jaContestei } });
    if (isHost) {                    // host aplica direto (não manda pra si mesmo)
      const s = stateRef.current;
      const atual = s.contest || {};
      const desse = { ...(atual[chave] || {}) };
      if (jaContestei) delete desse[name]; else desse[name] = true;
      pushState({ ...s, contest: { ...atual, [chave]: desse } });
    }
  };

  const ranked = useMemo(() => {
    const sc = state?.scores || {};
    return [...players].map(p => ({ ...p, pts: sc[p.name] || 0 })).sort((a, b) => b.pts - a.pts);
  }, [players, state?.scores]);
  const noLobby = !state || state.phase === 'lobby' || state.phase === 'over';
  const jogando = state?.phase === 'jogando';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <style>{STOP_CSS}</style>

      {/* Cabeçalho */}
      <div style={{ borderRadius: 16, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 13,
        background: `linear-gradient(120deg, ${US.roxo} 0%, ${US.azul} 55%, ${US.verde} 120%)`,
        boxShadow: `0 8px 26px ${AG}`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .16, pointerEvents: 'none',
          background: 'radial-gradient(circle at 10% 20%, #fff 0%, transparent 45%)' }} />
        <div style={{ width: 46, height: 46, borderRadius: 12, background: '#fff', flexShrink: 0, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-brand)',
          fontSize: 19, fontWeight: 800, color: US.roxo }}>S!</div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {state?.nome || (roomId === GLOBAL_ROOM ? 'Sala Geral' : 'Sala')}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)' }}>
            {players.length} {players.length === 1 ? 'jogador' : 'jogadores'}
            {state?.round > 0 && ` · rodada ${state.round}${state.totalRounds ? `/${state.totalRounds}` : ''}`}
          </div>
        </div>
        {/* Letra da rodada, bem grande */}
        {state?.letra && state.phase !== 'lobby' && state.phase !== 'over' && (
          <div key={state.letra + state.round} className="us-letra" style={{ position: 'relative', width: 54, height: 54,
            borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-brand)', fontSize: 30, fontWeight: 800, color: US.roxo,
            boxShadow: '0 6px 20px rgba(0,0,0,.3)' }}>
            {state.letra}
          </div>
        )}
        {jogando && (
          <div className={secsLeft <= 10 ? 'us-urgent' : undefined}
            style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(0,0,0,.28)', color: '#fff',
              fontWeight: 800, fontSize: 16, position: 'relative', minWidth: 62, textAlign: 'center' }}>
            {secsLeft}s
          </div>
        )}
        <button className="us-btn" onClick={() => setSomOn(v => !v)} title={somOn ? 'Desligar sons' : 'Ligar sons'}
          style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,.35)',
            background: 'rgba(255,255,255,.16)', color: '#fff', cursor: 'pointer', fontSize: 14, position: 'relative' }}>
          {somOn ? '🔊' : '🔇'}
        </button>
        <button className="us-btn" onClick={onLeave}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.22)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', position: 'relative' }}>
          <IcoExit size={14} />Sair
        </button>
      </div>

      {/* Corpo */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '216px 1fr',
        gridTemplateRows: 'minmax(0, 1fr)', gap: 12, minHeight: 0, overflow: 'hidden' }}>
        {/* Jogadores */}
        <div className="us-scroll" style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14,
          padding: 11, height: '100%', minHeight: 0, overflowY: 'auto', boxShadow: T.sh }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginBottom: 9 }}>
            JOGADORES ({players.length})
          </div>
          {ranked.map((p, i) => {
            const mandou = !!state?.respostas?.[p.name];
            const ganho = state?.ganhos?.[p.name];
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 7px',
                borderRadius: 10, marginBottom: 3, background: p.name === state?.stopPor ? `${US.vermelho}12` : 'transparent' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={p.photo || '/UNIKO_NEW.png'} alt=""
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub,
                      border: `2.5px solid ${p.name === state?.stopPor ? US.vermelho : mandou && state?.phase === 'parando' ? US.verde : 'transparent'}` }} />
                  {i === 0 && p.pts > 0 && (
                    <div style={{ position: 'absolute', top: -7, right: -5, color: '#F0B429' }}><IcoCrown size={16} /></div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: p.name === name ? 800 : 700, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
                    {p.name.split(' ')[0]}{p.name === name && ' (você)'}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textT, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <b style={{ color: T.text }}>{p.pts}</b> pts
                    {ganho > 0 && state?.phase === 'resultado' && (
                      <span className="us-pop" style={{ color: US.verde, fontWeight: 800 }}>+{ganho}</span>
                    )}
                    {p.name === state?.stopPor && <span style={{ color: US.vermelho, fontWeight: 700 }}>• STOP!</span>}
                    {p.name === host && <span style={{ opacity: .6 }}>• host</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Área principal */}
        <div className="us-scroll" style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14,
          padding: 16, height: '100%', minHeight: 0, overflowY: 'auto', boxShadow: T.sh }}>

          {/* LOBBY / FIM */}
          {noLobby && (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              {state?.phase === 'over' ? (
                <>
                  <div style={{ fontSize: 44 }}>🏆</div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 24, fontWeight: 800, color: T.text, marginTop: 6 }}>
                    {ranked[0]?.name?.split(' ')[0] || '—'} venceu!
                  </div>
                  <div style={{ fontSize: 13, color: T.textT, marginTop: 8 }}>
                    {ranked.slice(0, 3).map((p, i) => `${i + 1}º ${p.name.split(' ')[0]} — ${p.pts} pts`).join('   ·   ')}
                  </div>
                </>
              ) : (
                <>
                  <div className="us-halo" style={{ width: 74, height: 74, borderRadius: 20, margin: '0 auto',
                    background: `linear-gradient(135deg, ${A}, ${A2})`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontFamily: 'var(--font-brand)', fontSize: 32, fontWeight: 800, color: '#fff' }}>
                    S!
                  </div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800, color: T.text, marginTop: 12 }}>
                    {state?.nome || 'Sala'}
                  </div>
                </>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', margin: '14px 0' }}>
                {cats.map(c => (
                  <span key={c} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: `${A}12`, border: `1px solid ${A}33`, color: T.text }}>
                    {catById(c).emoji} {catById(c).nome}
                  </span>
                ))}
              </div>
              {isHost ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: T.textT, fontWeight: 600 }}>Rodadas:</span>
                    {LAP_OPTIONS.map(n => (
                      <button key={n} className="us-btn" onClick={() => setLaps(n)}
                        style={{ minWidth: 34, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5,
                          fontWeight: 700, border: laps === n ? `1.5px solid ${A}` : `1px solid ${T.border}`,
                          background: laps === n ? `${A}14` : 'transparent', color: laps === n ? A : T.text }}>{n}</button>
                    ))}
                  </div>
                  <button className="us-btn" onClick={comecar} disabled={players.length < MIN_PLAYERS || !state}
                    style={{ padding: '12px 30px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
                      cursor: (players.length < MIN_PLAYERS || !state) ? 'not-allowed' : 'pointer',
                      background: (players.length < MIN_PLAYERS || !state) ? T.textD : `linear-gradient(135deg, ${A}, ${A2})`,
                      boxShadow: (players.length < MIN_PLAYERS || !state) ? 'none' : `0 6px 18px ${AG}` }}>
                    {!state ? 'Carregando...' : state.phase === 'over' ? 'Jogar de novo' : 'Começar partida'}
                  </button>
                  {players.length < MIN_PLAYERS && (
                    <div style={{ fontSize: 12, color: T.textT, marginTop: 10 }}>
                      Chame mais gente! Precisa de pelo menos {MIN_PLAYERS} jogadores.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: T.textT, fontStyle: 'italic' }}>
                  Esperando {host?.split(' ')[0] || 'o host'} começar...
                </div>
              )}
            </div>
          )}

          {/* JOGANDO / PARANDO — o formulário */}
          {(jogando || state?.phase === 'parando') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: T.textT }}>
                  Palavras com <b style={{ color: A, fontSize: 16 }}>{state.letra}</b>
                </div>
                <div style={{ flex: 1 }} />
                {jogando ? (
                  <button className="us-btn us-pulse" onClick={darStop}
                    style={{ padding: '12px 34px', borderRadius: 999, border: 'none', color: '#fff',
                      fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, cursor: 'pointer',
                      background: `linear-gradient(135deg, ${US.vermelho}, #FF7A85)`,
                      boxShadow: `0 6px 20px ${US.vermelho}66`, letterSpacing: '.06em' }}>
                    STOP!
                  </button>
                ) : (
                  <div className="us-pop" style={{ padding: '8px 16px', borderRadius: 999, background: `${US.vermelho}18`,
                    color: US.vermelho, fontWeight: 800, fontSize: 14 }}>
                    ✋ {state.stopPor ? `${state.stopPor.split(' ')[0]} parou!` : 'Tempo esgotado!'} — enviando...
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {cats.map(c => {
                  const cat = catById(c);
                  const v = minhas[c] || '';
                  const ok = v && valeResposta(v, state.letra);
                  const ruim = v && !ok;
                  return (
                    <div key={c}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textT, display: 'flex',
                        alignItems: 'center', gap: 5, marginBottom: 4 }}>
                        <span>{cat.emoji}</span>{cat.nome}
                      </label>
                      <input value={v} disabled={!jogando}
                        onChange={e => setMinhas(m => ({ ...m, [c]: e.target.value }))}
                        placeholder={`${state.letra}...`} maxLength={40}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 9, fontSize: 14,
                          fontFamily: 'var(--font-body)', outline: 'none', color: T.text,
                          background: T.surfaceInput || 'rgba(0,0,0,.025)',
                          border: `1.5px solid ${ruim ? US.vermelho : ok ? US.verde : T.border}` }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: T.textD, marginTop: 12, textAlign: 'center' }}>
                10 pts se ninguém repetir · 5 se repetir · 0 se não começar com {state.letra}
              </div>
            </>
          )}

          {/* VALIDANDO — contestação */}
          {state?.phase === 'validando' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text }}>
                  Alguma resposta não vale?
                </div>
                <div style={{ fontSize: 12, color: T.textT, marginTop: 4 }}>
                  Clique no ✗ pra contestar. Se a maioria contestar, a resposta zera. ({secsLeft}s)
                </div>
              </div>
              {cats.map(c => {
                const cat = catById(c);
                return (
                  <div key={c} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.textT, marginBottom: 5,
                      display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>{cat.emoji}</span>{cat.nome}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(state.respostas || {}).map(([quem, r]) => {
                        const txt = r?.[c];
                        if (!txt) return null;
                        const chave = `${quem}|${c}`;
                        const contra = Object.keys(state.contest?.[chave] || {}).length;
                        const euContestei = !!state.contest?.[chave]?.[name];
                        const invalida = !valeResposta(txt, state.letra);
                        return (
                          <div key={quem} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                            borderRadius: 999, fontSize: 12.5,
                            background: invalida ? `${US.vermelho}10` : contra ? `${US.amarelo}14` : T.surfaceSub || 'rgba(0,0,0,.03)',
                            border: `1px solid ${invalida ? `${US.vermelho}44` : contra ? `${US.amarelo}66` : T.border}`,
                            textDecoration: invalida ? 'line-through' : 'none', opacity: invalida ? .6 : 1 }}>
                            <b style={{ color: T.text }}>{txt}</b>
                            <span style={{ color: T.textT, fontSize: 11 }}>{quem.split(' ')[0]}</span>
                            {contra > 0 && (
                              <span style={{ color: US.amarelo, fontWeight: 800, fontSize: 11 }}>{contra}✗</span>
                            )}
                            {quem !== name && !invalida && (
                              <button className="us-btn" onClick={() => contestar(quem, c)}
                                title={euContestei ? 'Tirar contestação' : 'Contestar'}
                                style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  border: `1px solid ${euContestei ? US.vermelho : T.border}`,
                                  background: euContestei ? US.vermelho : 'transparent',
                                  color: euContestei ? '#fff' : T.textT }}>
                                {euContestei ? <IcoCheck size={11} /> : <IcoX size={11} />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!Object.values(state.respostas || {}).some(r => r?.[c]) && (
                        <span style={{ fontSize: 12, color: T.textD, fontStyle: 'italic' }}>ninguém respondeu</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* RESULTADO */}
          {state?.phase === 'resultado' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text }}>
                  Pontos da rodada {state.round}
                </div>
                <div style={{ fontSize: 12, color: T.textT }}>letra {state.letra} · próxima em {secsLeft}s</div>
              </div>
              {Object.entries(state.detalhe || {}).map(([quem, cs]) => (
                <div key={quem} className="us-fade" style={{ marginBottom: 10, padding: 10, borderRadius: 10,
                  background: quem === name ? `${A}0d` : 'transparent', border: `1px solid ${quem === name ? `${A}33` : T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <b style={{ fontSize: 13.5, color: T.text }}>{quem.split(' ')[0]}</b>
                    <span style={{ fontSize: 13, fontWeight: 800, color: US.verde }}>+{state.ganhos?.[quem] || 0}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {cats.map(c => {
                      const d = cs[c];
                      if (!d) return null;
                      const cor = d.pts === 10 ? US.verde : d.pts === 5 ? US.amarelo : US.vermelho;
                      return (
                        <span key={c} title={`${catById(c).nome}: ${d.motivo}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7,
                            fontSize: 11.5, background: `${cor}12`, border: `1px solid ${cor}44`, color: T.text }}>
                          <span style={{ opacity: .7 }}>{catById(c).emoji}</span>
                          {d.txt || <i style={{ color: T.textD }}>—</i>}
                          <b style={{ color: cor }}>{d.pts}</b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ — presence global (quem está em qual sala) + lobby/sala
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoStop = () => {
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
    supabase.from('uniko_stop_state').select('id').limit(1).then(({ error }) => {
      if (semTabela(error)) setSqlMissing(true);
    });
  }, []);

  const refreshPresence = useCallback(() => {
    const ch = lobbyChan.current; if (!ch) return;
    const list = Object.values(ch.presenceState())
      .map(arr => arr[arr.length - 1]).filter(Boolean)
      .map(p => ({ name: p.name, photo: p.photo, room: p.room, entrouEm: p.entrouEm }));
    const seen = new Set();
    setTodos(list.filter(p => p?.name && (seen.has(p.name) ? false : (seen.add(p.name), true))));
  }, []);

  /* Canal RECRIADO quando muda sala/foto: `track()` repetido não propaga (medido
     no Uniko Paint — o valor velho fica no presenceState dos outros). */
  useEffect(() => {
    const ch = supabase.channel('uniko-stop-presence', { config: { presence: { key: name } } });
    lobbyChan.current = ch;
    ch.on('presence', { event: 'sync' }, refreshPresence)
      .on('presence', { event: 'join' }, refreshPresence)
      .on('presence', { event: 'leave' }, refreshPresence);
    ch.subscribe(async (st) => {
      if (st !== 'SUBSCRIBED') return;
      const r = await ch.track({ name, photo, room, entrouEm });
      if (r !== 'ok') console.error('[uniko-stop] presence track falhou:', r);
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
  // Eu SEMPRE estou na minha sala — não espero o eco da presence pra saber disso.
  const naSala = useMemo(() => {
    const l = porSala[room] || [];
    return l.some(p => p.name === name) ? l : [{ name, photo, room, entrouEm }, ...l];
  }, [porSala, room, name, photo, entrouEm]);

  const cardBg = T.surface || '#fff';
  if (sqlMissing) return (
    <div style={{ maxWidth: 620, margin: '40px auto', background: cardBg, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <div style={{ width: 76, height: 76, borderRadius: 20, margin: '0 auto 14px',
        background: `linear-gradient(135deg, ${A}, ${A2})`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'var(--font-brand)', fontSize: 34, fontWeight: 800, color: '#fff' }}>S!</div>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8 }}>
        Falta rodar a migração
      </div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Uniko Stop! precisa das tabelas dele. Rode <b style={{ color: T.text }}>supabase_uniko_stop.sql</b> no
        SQL Editor do Supabase e recarregue esta página.
      </div>
    </div>
  );

  return room
    ? <Sala roomId={room} name={name} players={naSala} onLeave={() => setRoom(null)} />
    : <Lobby name={name} porSala={porSala} onEnter={setRoom} />;
};

export { TabUnikoStop };
export default TabUnikoStop;
