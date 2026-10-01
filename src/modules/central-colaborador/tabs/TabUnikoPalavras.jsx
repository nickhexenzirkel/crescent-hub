// src/modules/central-colaborador/tabs/TabUnikoPalavras.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO PALAVRAS — Blefe de palavras (o clássico "Ghost"), online, com salas e chat.
//
// COMO SE JOGA: cada um tem 2 VIDAS (o host pode pôr até 5). Na sua vez você acrescenta UMA letra ao
// fragmento que está na mesa (C → CA → CAS...), pensando numa palavra que
// comece assim. NÃO há dicionário: quem decide é a TURMA, por votação.
//   • DUVIDAR (só na sua vez): você desconfia de quem jogou a última letra. Ele
//     diz a palavra que tinha em mente e todos (menos ele) votam se ela existe.
//   • FORMOU PALAVRA (qualquer um, a qualquer hora): alguém acha que a última
//     letra COMPLETOU uma palavra. Todos (menos o acusado) votam se formou.
// Em 1 minuto, maioria contra o acusado → ele perde uma vida; maioria a favor
// → perde quem acusou; sem maioria (ninguém votou, empate) → ninguém perde e o
// jogo segue. Demorar 60s pra jogar também custa uma vida. Sobrou um → ganhou.
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
import { nowMs, ensureServerClock } from '../../../shared/captureUniko';
import { getActiveAssistantSkinId, getAssistantSkin } from '../../../shared/assistantSkin';

const MASCOTE = '/uniko-palavras.png';
const CENARIO = "url('/uniko-palavras-cenario.jpg') center / cover no-repeat";
const MASCOTE_BRAVO = '/uniko-palavras-bravo.png';   // com raiva: dúvida, vida perdida, eliminação
const VIDAS = 2;                // padrão; o host escolhe de 1 a MAX_VIDAS no lobby
const MAX_VIDAS = 5;
const NOVA_MS = 7_000;              // a letra recém-jogada fica à mostra por 7s, depois vira "?"
const VER_MS = 5_000;               // quanto tempo as letras ficam à mostra ao espiar
const CHANCES_VER = 2;              // espiadas por jogador, por rodada
const MIN_FORMOU = 3;           // só dá pra chamar "formou palavra" com 3+ letras na mesa
const TURN_MS = 60_000;         // tempo pra jogar uma letra
const DUVIDA_MS = 60_000;       // janela de votação (dúvida / formou palavra)
const DUELO_MS = 300_000;       // só 2 vivos: os DOIS precisam concordar em até 5 minutos
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
.up-fxhost > *:not(.up-fx) { position: relative; z-index: 1; }
.up-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; border-radius: inherit; }
.up-estrela { position: absolute; background: radial-gradient(circle, #fff 0%, #bfe9ff 45%, #6cc7ff 100%);
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); animation: upBrilha 3s ease-in-out infinite; }
@keyframes upBrilha { 0%,100% { opacity: .15; transform: scale(.55) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
.up-bolha { position: absolute; bottom: -8%; border-radius: 50%; border: 1.5px solid rgba(190,235,255,.7);
  background: radial-gradient(circle at 30% 28%, rgba(255,255,255,.75) 0%, rgba(255,255,255,.12) 28%, rgba(120,200,255,.08) 62%, rgba(120,200,255,.22) 100%);
  animation: upSobe linear infinite; }
@keyframes upSobe { 0% { transform: translate(0, 0); opacity: 0; } 8% { opacity: .9; } 50% { transform: translate(14px, -55vh); } 100% { transform: translate(-6px, -115vh); opacity: 0; } }
.up-mascote { animation: upFloat 3.2s ease-in-out infinite; }
.up-mascote.up-treme { animation: upShake .6s ease-in-out infinite; }
.up-mascote.up-pula { animation: upPula .7s ease-in-out 3; }
@keyframes upPula { 0%,100% { transform: translate(-50%,-50%) scale(1); } 30% { transform: translate(-50%,-62%) scale(1.08, .94); } 55% { transform: translate(-50%,-50%) scale(.96, 1.05); } }
.up-balao { animation: upBalao .3s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes upBalao { from { opacity: 0; transform: translate(-50%, 8px) scale(.85); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
.up-letra { animation: upPop .35s cubic-bezier(.2,1.4,.4,1) both; }
.up-fade { animation: upFade .3s ease both; }
.up-btn { transition: transform .12s ease, filter .12s ease; }
.up-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.07); }
.up-btn:not(:disabled):active { transform: scale(.97); }
.up-scroll { scrollbar-width: thin; }
.up-wrap { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; overflow: hidden; }
.up-left { display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow-y: auto; }
.up-right { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.up-chatbox { flex: 1; min-height: 0; }
@media (max-width: 860px) {
  .up-wrap { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .up-left { flex-shrink: 0; overflow: visible; gap: 8px; }
  .up-right { flex: 1 0 auto; min-height: 210px; gap: 8px; }
}
.up-letra2 { animation: upPop2 .35s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes upPop2 { 0% { transform: scale(.2) rotate(-20deg); opacity: 0; } 65% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .up-estrela, .up-bolha, .up-mascote, .up-balao, .up-letra, .up-letra2, .up-fade { animation: none !important; }
}
`;

/* ── util ─────────────────────────────────────────────────────────────────── */
const myName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
/* A foto do jogador aqui é o Uniko ASSISTENTE que ele está usando agora (carinha de olhos
   abertos, igual ao Uniko Stop). Sem skin ativa, cai pro Uniko padrão. */
const myPhotoSrc = () => {
  try { return getAssistantSkin(getActiveAssistantSkinId())?.blink?.open || '/UNIKO_NEW.png'; }
  catch { return '/UNIKO_NEW.png'; }
};
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
/* Ordem da roda: o host abre, depois o pessoal na ordem em que entrou na sala (fixa, nada de sorteio). */
const ordenaJogadores = (players, hostName) => {
  const base = [...players].sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name));
  return [...base.filter(p => p.name === hostName), ...base.filter(p => p.name !== hostName)];
};
/* Jogador SAIU da partida (clicou em Sair ou caiu): some da roda de verdade — ordem, vidas e vez
   passam a contar só quem ficou. Se sobrar um, ele ganha. */
const removerJogador = (s, quem) => {
  const ord = s.ordem || [];
  const i = ord.indexOf(quem);
  if (i < 0) return s;
  const vidasSem = { ...s.vidas, [quem]: 0 };
  const prox = proxVivo({ ...s, vidas: vidasSem }, quem);          // próximo vivo depois dele (na roda antiga)
  const ant = ord[(i - 1 + ord.length) % ord.length];               // quem vinha antes: mantém o giro certo de "quem abre"
  const ordem = ord.filter(n => n !== quem);
  const vidas = { ...s.vidas }; delete vidas[quem];
  const vivos = ordem.filter(n => (vidas[n] || 0) > 0);
  const evento = { quem, texto: `${primeiro(quem)} saiu da partida`, palavra: null, ts: nowMs(), eliminado: false, saiu: true };
  let n = { ...s, ordem, vidas };
  if (s.iniciador === quem) n.iniciador = ant !== quem ? ant : ordem[0];
  if (s.starter === quem) n.starter = prox;
  if (vivos.length <= 1) return { ...n, phase: 'fim', vencedor: vivos[0] || null, evento, endsAt: null, duvida: null };
  if (s.phase === 'duvida' && (s.duvida?.por === quem || s.duvida?.alvo === quem)) {
    n = { ...n, phase: 'jogando', duvida: null, vez: s.vez === quem ? prox : s.vez, endsAt: nowMs() + TURN_MS,
      aviso: `${primeiro(quem)} saiu — a dúvida foi cancelada.` };
  } else if (s.phase === 'jogando' && s.vez === quem) {
    n = { ...n, vez: prox, endsAt: nowMs() + TURN_MS, aviso: `${primeiro(quem)} saiu da partida.` };
  } else if (s.phase === 'jogando') {
    n = { ...n, aviso: `${primeiro(quem)} saiu da partida.` };
  }
  return n;
};
const perderVida = (s, quem, texto, palavra) => {
  const vidas = { ...s.vidas, [quem]: Math.max(0, (s.vidas?.[quem] || 0) - 1) };
  const vivos = (s.ordem || []).filter(n => vidas[n] > 0);
  const evento = { quem, texto, palavra: palavra || null, ts: nowMs(), eliminado: vidas[quem] === 0 };
  if (vivos.length <= 1) return { ...s, vidas, evento, phase: 'fim', vencedor: vivos[0] || null, endsAt: null, duvida: null };
  // Quem abre a próxima rodada NÃO é quem perdeu: o posto de abrir gira no sentido da roda (quem abriu esta → o próximo vivo).
  const starter = proxVivo({ ...s, vidas }, s.iniciador ?? s.ordem?.[0]);
  return { ...s, vidas, evento, phase: 'pausa', starter, endsAt: nowMs() + PAUSA_MS, duvida: null };
};

const blefeAguarda = (d) => d?.tipo === 'blefe' && !d.palavra;

/* Quem vota: vivos, presentes, menos o acusado. */
const contarVotos = (s, presentes) => {
  const d = s.duvida; if (!d) return null;
  const votantes = (s.ordem || []).filter(n => (s.vidas?.[n] || 0) > 0 && (d.duelo || n !== d.alvo) && presentes.includes(n));
  const total = votantes.length;
  const contra = votantes.filter(n => d.votos?.[n] === 'contra').length;
  const favor = votantes.filter(n => d.votos?.[n] === 'favor').length;
  return { total, contra, favor };
};

/* Efeitos do fundo: estrelas de 4 pontas piscando + bolhas subindo. Posições fixas
   (geradas uma vez por um sorteio determinístico) pra não "pular" a cada render. */
const _fx = (() => {
  let x = 7;
  const r = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  return {
    estrelas: Array.from({ length: 34 }, () => ({ l: r() * 100, t: r() * 100, z: 7 + r() * 13, d: r() * 4, dur: 2.2 + r() * 3 })),
    bolhas: Array.from({ length: 22 }, () => ({ l: r() * 100, z: 8 + r() * 28, dur: 9 + r() * 12, d: -r() * 20 })),
  };
})();
const FundoFX = () => (
  <div className="up-fx" aria-hidden="true">
    {_fx.estrelas.map((e, i) => (
      <span key={`e${i}`} className="up-estrela"
        style={{ left: `${e.l}%`, top: `${e.t}%`, width: e.z, height: e.z, animationDuration: `${e.dur}s`, animationDelay: `${e.d}s`,
          filter: 'drop-shadow(0 0 4px rgba(150,220,255,.9))' }} />
    ))}
    {_fx.bolhas.map((b, i) => (
      <span key={`b${i}`} className="up-bolha"
        style={{ left: `${b.l}%`, width: b.z, height: b.z, animationDuration: `${b.dur}s`, animationDelay: `${b.d}s` }} />
    ))}
  </div>
);

/* Corações grandes: o tamanho encolhe conforme a quantidade, pra 5 caberem no cartão do jogador. */
const Coracoes = ({ n, total = VIDAS }) => (
  <span style={{ fontSize: `clamp(16px, ${total <= 2 ? 6 : total === 3 ? 5.2 : total === 4 ? 4.4 : 3.7}vw, ${total <= 2 ? 34 : 28}px)`, letterSpacing: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>
    {Array.from({ length: total }).map((_, i) => (
      <span key={i} style={{ color: i < n ? '#FF4D6D' : 'rgba(255,255,255,.22)', textShadow: i < n ? '0 0 10px rgba(255,77,109,.8)' : 'none' }}>♥</span>
    ))}
  </span>
);

/* ═══════════════════════════════════════════════════════════════════════════
   CARTÕES DA SALA — layout de chat: cartão da VEZ, cartão da PALAVRA, jogadores e chat
   ═══════════════════════════════════════════════════════════════════════════ */
const Avatar = ({ src, size, borda }) => (
  <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', flexShrink: 0 }}>
    <img src={src || '/UNIKO_NEW.png'} alt="" style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover',
      background: '#1b2a63', border: `4px solid ${borda}` }} />
  </div>
);

/* Cartão GRANDE: de quem é a vez (ou quem está sendo julgado), com o Uniko assistente ativo da pessoa. */
const CardVez = ({ titulo, sub, quem, photo, cor, tempo, vidas, total, souEu, fala, humor }) => (
  <div className="up-fade" style={{ borderRadius: 18, padding: 'clamp(8px, 1.6vh, 16px) clamp(10px, 2vw, 18px)', display: 'flex', alignItems: 'center', gap: 'clamp(10px, 2vw, 18px)',
    background: souEu ? 'linear-gradient(135deg, #1d4ed8, #22D3EE)' : `linear-gradient(135deg, ${cor}, #1b2a63)`, color: '#fff',
    boxShadow: `0 8px 30px ${cor}66`, border: '3px solid rgba(255,255,255,.55)', flexShrink: 0 }}>
    {quem ? <Avatar src={photo} size="clamp(58px, 12vh, 104px)" borda="#fff" />
      : <img src={humor === 'bravo' ? MASCOTE_BRAVO : MASCOTE} alt="" style={{ width: 'clamp(58px, 12vh, 104px)', height: 'clamp(58px, 12vh, 104px)', objectFit: 'contain' }} />}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 'clamp(11px, 2.8vw, 14px)', fontWeight: 900, letterSpacing: '.12em', opacity: .9 }}>{titulo}</div>
      {quem && <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(22px, 5vh, 40px)', fontWeight: 900, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {souEu ? 'VOCÊ!' : primeiro(quem)}
      </div>}
      {sub && <div style={{ fontSize: 'clamp(12px, 1.9vh, 16px)', fontWeight: 700, marginTop: 1, lineHeight: 1.3 }}>{sub}</div>}
      {vidas != null && <div style={{ marginTop: 4 }}><Coracoes n={vidas} total={total} /></div>}
      {fala && !sub && <div style={{ marginTop: 4, fontSize: 'clamp(11px, 1.8vh, 14px)', fontWeight: 700, background: 'rgba(255,255,255,.2)', borderRadius: 12, padding: '5px 10px', display: 'inline-block' }}>🐙 {fala}</div>}
    </div>
    {tempo != null && (
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(30px, 6.5vh, 52px)', fontWeight: 900, lineHeight: 1, color: typeof tempo === 'number' && tempo <= 10 ? '#FFE066' : '#fff' }}>{tempo}</div>
        <div style={{ fontSize: 11, fontWeight: 800, opacity: .85 }}>SEGUNDOS</div>
      </div>
    )}
  </div>
);

/* Cartão da PALAVRA: letras grandes (coloridas por quem jogou) + a letra que a última pessoa escolheu. */
const CardPalavra = ({ letras, ordem, mostrar, novaIdx, cardBg }) => {
  const corDe = (n) => CORES[Math.max(0, ordem.indexOf(n)) % CORES.length];
  const ult = letras[letras.length - 1];
  const tile = (x, i, grande) => (
    <div key={`${i}_${x.l}`} className="up-letra2" title={primeiro(x.by)}
      style={{ width: grande ? 'clamp(54px, 10vh, 84px)' : 'clamp(32px, 5.6vh, 48px)', aspectRatio: '1', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: corDe(x.by), color: '#fff', fontFamily: 'var(--font-brand)', fontWeight: 900, fontSize: grande ? 'clamp(30px, 6vh, 48px)' : 'clamp(18px, 3.4vh, 28px)',
        border: '3px solid rgba(255,255,255,.85)', boxShadow: `0 4px 14px ${corDe(x.by)}88` }}>
      {mostrar || i === novaIdx ? x.l.toUpperCase() : '?'}
    </div>
  );
  return (
    <div style={{ background: cardBg, border: `2px solid ${T.border}`, borderRadius: 18, padding: 'clamp(8px, 1.6vh, 14px) clamp(10px, 2vw, 16px)', boxShadow: T.sh, flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: T.textT, letterSpacing: '.12em', marginBottom: 6, textAlign: 'center' }}>PALAVRA NA MESA</div>
      {letras.length === 0 ? (
        <div style={{ textAlign: 'center', fontSize: 'clamp(14px, 2.2vh, 18px)', fontWeight: 800, color: T.textT, padding: '6px 0' }}>Ainda não tem nenhuma letra</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>{letras.map((x, i) => tile(x, i, false))}</div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingLeft: 12, borderLeft: `2px dashed ${T.border}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 900, color: T.textT, letterSpacing: '.08em', textAlign: 'center' }}>ÚLTIMA · {primeiro(ult.by).toUpperCase()}</div>
            {tile(ult, letras.length - 1, true)}
          </div>
        </div>
      )}
    </div>
  );
};

/* Faixa de jogadores: foto do Uniko ativo, nome e vidas. Quem tem a vez fica destacado. */
const FaixaJogadores = ({ seats, ordem, vez, alvo, cardBg }) => {
  const corDe = (n) => CORES[Math.max(0, ordem.indexOf(n)) % CORES.length];
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '8px 12px', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.sh, flexShrink: 0 }} className="up-scroll">
      {seats.map(p => {
        const minha = vez === p.name, ehAlvo = alvo === p.name;
        return (
          <div key={p.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 64, opacity: p.out ? 0.4 : 1, filter: p.out ? 'grayscale(1)' : 'none' }}>
            <img src={p.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: '#1b2a63',
              border: `3.5px solid ${ehAlvo ? P.vermelho : minha ? '#FFB300' : corDe(p.name)}`, boxShadow: minha ? '0 0 12px #FFB300' : ehAlvo ? `0 0 12px ${P.vermelho}` : 'none' }} />
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primeiro(p.name)}{p.ausente ? ' 💤' : ''}</div>
            {p.vidas != null && (p.out ? <span style={{ fontSize: 14 }}>💀</span> : <span style={{ fontSize: 13, color: '#FF4D6D', fontWeight: 900, whiteSpace: 'nowrap' }}>{'♥'.repeat(Math.min(p.vidas, 5))}</span>)}
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
  useEffect(() => { const im = new Image(); im.src = MASCOTE_BRAVO; }, []);
  const [state, setState] = useState(null);
  const [now, setNow] = useState(() => nowMs());
  const [letra, setLetra] = useState('');
  const [palavra, setPalavra] = useState('');
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatTexto, setChatTexto] = useState('');
  const [confirmSair, setConfirmSair] = useState(false);
  const cardBg = T.surface || '#fff';

  const stateRef = useRef(null);
  const hostRef = useRef(false);
  const chanRef = useRef(null);
  const playersRef = useRef([]);
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
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { const t = setInterval(() => setNow(nowMs()), 250); return () => clearInterval(t); }, []);
  // Relógio do SERVIDOR: cada PC tem a sua hora; sem isso a contagem e o fim da vez desencontravam entre jogadores.
  useEffect(() => { ensureServerClock(); const t = setInterval(() => ensureServerClock(), 50_000); return () => clearInterval(t); }, []);

  /* ── Estado (descarta o que chega atrasado, igual ao Stop) ── */
  const aplicaEstado = useCallback((st) => {
    if (!st) return;
    const atual = stateRef.current;
    if (atual?.ts && st.ts && st.ts < atual.ts) return;
    stateRef.current = st;
    setState(st);
  }, []);
  const pushState = useCallback(async (next) => {
    const carimbado = { ...next, ts: nowMs() };
    aplicaEstado(carimbado);
    chanRef.current?.send({ type: 'broadcast', event: 'estado', payload: carimbado });   // caminho rápido: vez/fogo mudam na hora pra todos
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
  /* Fecha a votação: maioria contra → acusado perde; maioria a favor → acusador perde;
     `forcar` (tempo esgotado) sem maioria → ninguém perde e o jogo continua. */
  const resolver = (s, forcar) => {
    const v = contarVotos(s, playersRef.current.map(p => p.name));
    if (!v) return;
    const { por, alvo, tipo, palavra } = s.duvida;
    const w = palavra ? ` "${palavra.toUpperCase()}"` : '';
    const frag = fragmentoDe(s).toUpperCase();
    if (tipo === 'blefe' && !palavra) {
      // O acusado nem disse a palavra: não há o que votar. Se o tempo acabou, está pego blefando.
      if (forcar) pushState(perderVida(s, alvo, `${primeiro(alvo)} não disse a palavra a tempo — foi pego blefando!`, null));
      return;
    }
    if (s.duvida.duelo) {
      // Só dois vivos: vale apenas se os DOIS concordarem (os dois "contra" ou os dois "a favor").
      if (v.total === 2 && v.contra === 2) {
        pushState(perderVida(s, alvo, tipo === 'blefe'
          ? `Os dois concordaram: a palavra${w} não vale — ${primeiro(alvo)} foi pego blefando!`
          : `Os dois concordaram: "${frag}" formou palavra — ${primeiro(alvo)} perdeu!`, palavra));
      } else if (v.total === 2 && v.favor === 2) {
        pushState(perderVida(s, por, tipo === 'blefe'
          ? `Os dois concordaram: a palavra${w} vale — ${primeiro(por)} duvidou errado!`
          : `Os dois concordaram: "${frag}" não formou palavra — ${primeiro(por)} errou a chamada!`, palavra));
      } else if (forcar) {
        // 5 minutos sem acordo: os dois saem e ninguém vence.
        const ordem = s.ordem || [];
        const vidas = { ...s.vidas }; ordem.forEach(n => { vidas[n] = 0; });
        pushState({ ...s, vidas, phase: 'fim', vencedor: null, duvida: null, endsAt: null,
          evento: { quem: null, texto: 'Os dois não chegaram a um acordo em 5 minutos — os dois foram eliminados e ninguém ganhou.', palavra: null, ts: nowMs(), eliminado: true, empate: true } });
      }
      return;
    }
    if (v.total > 0 && v.contra > v.total / 2) {
      pushState(perderVida(s, alvo, tipo === 'blefe'
        ? `${primeiro(alvo)} foi pego blefando — a turma decidiu que${w || ' a palavra'} não vale!`
        : `${primeiro(alvo)} completou a palavra "${frag}" — a turma confirmou!`, palavra));
    } else if (v.total > 0 && v.favor > v.total / 2) {
      pushState(perderVida(s, por, tipo === 'blefe'
        ? `${primeiro(por)} duvidou, mas a turma aceitou${w || ' a palavra'} de ${primeiro(alvo)}!`
        : `${primeiro(por)} chamou palavra, mas "${frag}" não formou nada!`, palavra));
    } else if (forcar || (v.total > 0 && v.contra + v.favor === v.total)) {
      pushState({ ...s, phase: 'jogando', duvida: null, endsAt: nowMs() + TURN_MS,
        aviso: 'Ninguém decidiu a tempo — o jogo continua e ninguém perde vida.' });
    }
  };

  const processar = (ev, p) => {
    const s = stateRef.current;
    if (!s) return;
    const vivo = (n) => (s.vidas?.[n] || 0) > 0;

    if (ev === 'jogada') {
      if (s.phase !== 'jogando' || s.vez !== p.name || p.pos !== (s.letras || []).length) return;   // pos = idempotência do reenvio
      const l = normLetra(p.letra); if (!l) return;
      pushState({ ...s, letras: [...(s.letras || []), { l, by: p.name }], vez: proxVivo(s, p.name), aviso: null, endsAt: nowMs() + TURN_MS });
    }

    if (ev === 'duvidar') {
      if (s.phase !== 'jogando' || s.vez !== p.name || !(s.letras || []).length) return;
      const alvo = s.letras[s.letras.length - 1].by;
      if (alvo === p.name || !(s.ordem || []).includes(alvo)) return;
      const duelo = (s.ordem || []).filter(vivo).length === 2;
      pushState({ ...s, phase: 'duvida', aviso: null, duvida: { tipo: 'blefe', por: p.name, alvo, votos: {}, palavra: null, duelo }, endsAt: nowMs() + (duelo ? DUELO_MS : DUVIDA_MS) });
    }

    if (ev === 'formou') {
      if (s.phase !== 'jogando' || (s.letras || []).length < MIN_FORMOU || !vivo(p.name)) return;
      if (p.pos !== undefined && p.pos !== (s.letras || []).length) return;   // a letra mudou desde o clique: não acusa o autor errado
      const alvo = s.letras[s.letras.length - 1].by;
      if (alvo === p.name || !(s.ordem || []).includes(alvo)) return;
      const duelo = (s.ordem || []).filter(vivo).length === 2;
      pushState({ ...s, phase: 'duvida', aviso: null, duvida: { tipo: 'palavra', por: p.name, alvo, votos: {}, palavra: null, duelo }, endsAt: nowMs() + (duelo ? DUELO_MS : DUVIDA_MS) });
    }

    if (ev === 'saiu') {
      if (!s.phase || s.phase === 'lobby' || s.phase === 'fim' || !(s.ordem || []).includes(p.name)) return;
      pushState(removerJogador(s, p.name));
    }

    if (ev === 'olhar') {             // espiar as letras (contador por jogador, por rodada)
      if ((s.phase !== 'jogando' && s.phase !== 'duvida') || !(s.letras || []).length || !vivo(p.name)) return;
      const usadas = s.olhadas?.[p.name] || 0;
      if (p.n !== usadas || usadas >= CHANCES_VER) return;      // n = idempotência do reenvio
      pushState({ ...s, olhadas: { ...(s.olhadas || {}), [p.name]: usadas + 1 } });
    }

    if (ev === 'resposta') {          // o acusado diz a palavra (só na dúvida de blefe)
      if (s.phase !== 'duvida' || s.duvida?.tipo !== 'blefe' || s.duvida.alvo !== p.name || s.duvida.palavra) return;
      const raw = String(p.palavra || '').trim().toLowerCase().replace(/[^a-zà-ú]/g, '').slice(0, 30);
      if (!raw) return;
      pushState({ ...s, duvida: { ...s.duvida, palavra: raw } });
    }

    if (ev === 'voto') {
      if (s.phase !== 'duvida' || !s.duvida || (p.name === s.duvida.alvo && !s.duvida.duelo) || !vivo(p.name)) return;
      if (p.voto !== 'contra' && p.voto !== 'favor') return;
      if (s.duvida.tipo === 'blefe' && !s.duvida.palavra) return;        // só se vota depois que o acusado diz a palavra
      const nova = { ...s, duvida: { ...s.duvida, votos: { ...(s.duvida.votos || {}), [p.name]: p.voto } } };
      const v = contarVotos(nova, playersRef.current.map(x => x.name));
      if (nova.duvida.duelo) { if (v && v.total === 2 && (v.contra === 2 || v.favor === 2)) resolver(nova, false); else pushState(nova); }
      else if (v && v.total > 0 && (v.contra > v.total / 2 || v.favor > v.total / 2 || v.contra + v.favor === v.total)) resolver(nova, true);
      else pushState(nova);
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
    enviar('resposta', { name, palavra: w }, (x) => !!x?.duvida?.palavra || x?.phase !== 'duvida');
  };
  const [verAte, setVerAte] = useState(0);
  const espiar = () => {
    const s = stateRef.current;
    if (!s || (s.phase !== 'jogando' && s.phase !== 'duvida') || !(s.letras || []).length) return;
    const n = s.olhadas?.[name] || 0;
    if (n >= CHANCES_VER || (s.vidas?.[name] || 0) <= 0) return;
    setVerAte(nowMs() + VER_MS);
    enviar('olhar', { name, n }, (x) => (x?.olhadas?.[name] || 0) > n || (x?.phase !== 'jogando' && x?.phase !== 'duvida'));
  };
  const chamarFormou = () => {
    const s = stateRef.current;
    if (!s || s.phase !== 'jogando' || (s.letras || []).length < MIN_FORMOU) return;
    SFX.duvida();
    enviar('formou', { name, pos: (s.letras || []).length }, (x) => x?.phase !== 'jogando' || (x?.letras || []).length !== (s.letras || []).length);
  };
  const votar = (voto) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'duvida' || (s.duvida?.alvo === name && !s.duvida?.duelo)) return;
    SFX.letra();
    enviar('voto', { name, voto }, (x) => x?.phase !== 'duvida' || x?.duvida?.votos?.[name] === voto);
  };

  /* Relógio do host: estourou o tempo → perde vida / próxima rodada. */
  const ausenteDesde = useRef({});
  useEffect(() => {
    if (!isHost) return;
    const t = setInterval(() => {
      const s = stateRef.current;
      // Quem fechou a aba / caiu e ficou 12s fora da sala (presence) sai da partida também.
      if (s?.phase && s.phase !== 'lobby' && s.phase !== 'fim') {
        const agora = Date.now();
        for (const n of s.ordem || []) {
          if (playersRef.current.some(p => p.name === n)) { delete ausenteDesde.current[n]; continue; }
          if (!ausenteDesde.current[n]) { ausenteDesde.current[n] = agora; continue; }
          if (agora - ausenteDesde.current[n] > 12_000) { delete ausenteDesde.current[n]; pushState(removerJogador(s, n)); return; }
        }
      }
      if (!s || !s.endsAt || nowMs() < s.endsAt) return;
      if (s.phase === 'jogando') {
        pushState(perderVida(s, s.vez, `${primeiro(s.vez)} demorou demais e perdeu a vez`));
      } else if (s.phase === 'duvida') {
        resolver(s, true);
      } else if (s.phase === 'pausa') {
        pushState({ ...s, phase: 'jogando', letras: [], olhadas: {}, vez: s.starter, iniciador: s.starter, evento: null, round: (s.round || 1) + 1, endsAt: nowMs() + TURN_MS });
      }
    }, 400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, pushState]);

  const sair = () => {
    const s = stateRef.current;
    if (s?.phase && s.phase !== 'lobby' && s.phase !== 'fim') {
      if (hostRef.current) processar('saiu', { name });
      else {
        chanRef.current?.send({ type: 'broadcast', event: 'saiu', payload: { name } });
        setTimeout(onLeave, 300);       // dá tempo do aviso sair antes do canal ser fechado
        return;
      }
    }
    onLeave();
  };
  const comecar = () => {
    const s = stateRef.current; if (!s) return;
    const ordem = ordenaJogadores(players, name).map(p => p.name);   // quem aperta Começar (o host) abre; segue a roda
    if (ordem.length < MIN_PLAYERS) return;
    const ini = Math.min(MAX_VIDAS, Math.max(1, s.vidasIni || VIDAS));
    const vidas = {}; ordem.forEach(n => { vidas[n] = ini; });
    pushState({ ...s, phase: 'jogando', ordem, vidas, letras: [], vez: ordem[0], iniciador: ordem[0], round: 1, evento: null,
      duvida: null, aviso: null, olhadas: {}, vencedor: null, endsAt: nowMs() + TURN_MS });
  };
  const escolherVidas = (e) => {
    const n = Number(e.currentTarget.dataset.n);
    const s = stateRef.current;
    if (!s || !hostRef.current || (s.phase && s.phase !== 'lobby')) return;
    pushState({ ...s, vidasIni: n });
  };
  const voltarLobby = () => {
    const s = stateRef.current; if (!s) return;
    pushState({ nome: s.nome, criador: s.criador, vidasIni: s.vidasIni, phase: 'lobby' });
  };

  /* ── Canal da sala (jogadas até o host + chat) ── */
  useEffect(() => {
    const ch = supabase.channel(`uniko-palavras-room-${roomId}`);
    chanRef.current = ch;
    ch.on('broadcast', { event: 'estado' }, ({ payload }) => { if (payload && !hostRef.current) aplicaEstado(payload); });
    ['jogada', 'duvidar', 'formou', 'saiu', 'olhar', 'resposta', 'voto'].forEach(ev => {
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
  const secs = state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;
  const minhaVez = fase === 'jogando' && state?.vez === name;
  const ultimoPor = letras.length ? letras[letras.length - 1].by : null;
  const podeFormou = fase === 'jogando' && letras.length >= MIN_FORMOU && ultimoPor !== name && (state?.vidas?.[name] || 0) > 0;
  const souAlvo = fase === 'duvida' && state?.duvida?.alvo === name;
  const fotoDe = (n) => players.find(p => p.name === n)?.photo || null;
  const vidasIni = Math.min(MAX_VIDAS, Math.max(1, state?.vidasIni || VIDAS));
  const seats = noLobby
    ? ordenaJogadores(players, host).map(p => ({ name: p.name, photo: p.photo }))
    : ordem.map(n => ({ name: n, photo: fotoDe(n), vidas: state?.vidas?.[n] ?? 0, total: vidasIni, out: (state?.vidas?.[n] ?? 0) <= 0,
      ausente: !players.some(p => p.name === n) }));

  const btnBase = { border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', color: '#fff', padding: '11px 20px' };
  /* Letra RECÉM-JOGADA: aparece pra todos por NOVA_MS e depois vira "?" (marca o instante em que
     a letra chegou a ESTE cliente, então relógios diferentes não desencontram o tempo). */
  const [nova, setNova] = useState({ i: -1, ate: 0 });
  const antLen = useRef(null);
  useEffect(() => {
    const n = letras.length;
    if (antLen.current !== null && n > antLen.current) queueMicrotask(() => setNova({ i: n - 1, ate: nowMs() + NOVA_MS }));
    antLen.current = n;
  }, [letras.length]);
  const novaIdx = now < nova.ate ? nova.i : -1;

  /* Letras OCULTAS: só aparecem ao espiar (2x por rodada), no fim da rodada, ou quando
     a votação precisa delas (formou palavra / depois que o acusado disse a palavra). */
  const revelaTudo = fase !== 'jogando' && !(fase === 'duvida' && !(state?.duvida?.tipo === 'palavra' || state?.duvida?.palavra));
  const mostrar = revelaTudo || now < verAte;
  const restantes = CHANCES_VER - (state?.olhadas?.[name] || 0);
  const verSecs = Math.max(0, Math.ceil((verAte - now) / 1000));
  const fragV = letras.map((x, i) => (mostrar || i === novaIdx ? x.l.toUpperCase() : '•')).join(' ');
  const podeEspiar = (fase === 'jogando' || fase === 'duvida') && letras.length > 0 && !revelaTudo && (state?.vidas?.[name] || 0) > 0;
  const botaoEspiar = podeEspiar && (
    <button className="up-btn" onClick={espiar} disabled={restantes <= 0 || mostrar}
      title="Ver todas as letras por alguns segundos (só você vê)"
      style={{ ...btnBase, padding: '7px 14px', fontSize: 12.5, marginBottom: 8,
        background: restantes > 0 ? `linear-gradient(135deg, ${P.ciano}, ${P.azul})` : T.textD, cursor: restantes > 0 && !mostrar ? 'pointer' : 'not-allowed' }}>
      {mostrar ? `👁 Vendo... ${verSecs}s` : `👁 Visualizar letras (${Math.max(0, restantes)})`}
    </button>
  );

  /* ── Mascote fala: só texto no cartão (sem voz) ── */
  const [msg, setMsg] = useState(null);                 // fala pontual {t, until, humor}
  const falar = useCallback((t, ms = 3200, humor = null) => {
    setMsg({ t, until: nowMs() + ms, humor });
  }, []);

  /* Anuncia as transições (nova rodada, letra jogada, dúvida, vida perdida, fim). */
  const ultAnun = useRef(null);
  useEffect(() => {
    if (!state) return;
    const chave = `${fase}|${state.round}|${letras.length}|${state.vez}|${state.evento?.ts || 0}|${state.duvida?.por || ''}|${state.duvida?.tipo || ''}`;
    const ant = ultAnun.current;
    if (chave === ant) return;
    ultAnun.current = chave;
    if (ant === null) return;                       // 1ª leitura (entrei no meio): não anuncia o passado
    const antFase = ant.split('|')[0], antLetras = Number(ant.split('|')[2]);
    const eu1 = (n) => primeiro(n);
    queueMicrotask(() => {
    if (fase === 'jogando') {
      if (letras.length === 0) falar(`Rodada ${state.round}! Quem começa é ${eu1(state.vez)}.`);
      else if (antFase === 'duvida') falar('Ninguém decidiu a tempo. O jogo continua!');
      else if (letras.length > antLetras) falar(`Muito bem! Agora é a vez do ${eu1(state.vez)}.`, 3000, 'feliz');
    } else if (fase === 'duvida' && state.duvida) {
      const d = state.duvida;
      falar(d.duelo ? `${eu1(d.por)} duvidou! Só restam dois: os dois precisam concordar em 5 minutos.` : d.tipo === 'blefe' ? `${eu1(d.por)} duvidou de ${eu1(d.alvo)}! Será que é blefe?` : `${eu1(d.por)} diz que ${eu1(d.alvo)} formou uma palavra!`, 3600, 'bravo');
    } else if (fase === 'pausa' && state.evento) {
      const q = eu1(state.evento.quem);
      falar(state.evento.eliminado ? `${q} eliminado!` : `${q} perdeu uma vida! 💔`, 3200, 'bravo');
    } else if (fase === 'fim') {
      falar(state.vencedor ? `${eu1(state.vencedor)} venceu! Parabéns!` : 'Empate! Ninguém ganhou.', 7000, state.vencedor ? 'feliz' : 'bravo');
    }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, state?.round, letras.length, state?.vez, state?.evento?.ts, state?.duvida?.por, state?.duvida?.tipo]);

  const msgAtiva = msg && now < msg.until ? msg : null;
  const quemPerdeu = primeiro(state?.evento?.quem);
  const falaPadrao = () => {
    if (!state) return null;
    if (noLobby) return players.length < MIN_PLAYERS ? 'Chame mais gente pra jogar comigo!' : `Bora começar? Cada um tem ${vidasIni} ${vidasIni === 1 ? 'vida' : 'vidas'}!`;
    if (fase === 'jogando') return secs <= 10 ? `Faltam ${secs} segundos para ${primeiro(state.vez)} responder...` : `Agora é a vez do ${primeiro(state.vez)}!`;
    if (fase === 'duvida') return `Votem! Faltam ${secs} segundos.`;
    if (fase === 'pausa') return state.evento?.eliminado ? `${quemPerdeu} eliminado! 💀` : `${quemPerdeu} perdeu uma vida! 💔`;
    if (fase === 'fim') return state.vencedor ? `${primeiro(state.vencedor)} venceu!` : 'Empate! Ninguém ganhou.';
    return null;
  };
  const fala = msgAtiva ? msgAtiva.t : falaPadrao();
  const humor = fase === 'duvida' || fase === 'pausa' ? 'bravo' : (msgAtiva?.humor || null);

  const inputCss = { padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${P.azul}66`, background: T.surfaceInput || 'rgba(0,0,0,.03)',
    color: T.text, fontSize: 16, fontWeight: 700, outline: 'none', fontFamily: 'var(--font-body)' };

  /* Painel de baixo (o que fazer agora) */
  const painel = () => {
    if (noLobby) return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: T.textT, lineHeight: 1.6, marginBottom: 12 }}>
          Cada um tem <b style={{ color: T.text }}>{vidasIni} {vidasIni === 1 ? 'vida' : 'vidas'}</b>. Acrescente uma letra por vez formando uma palavra —
          quem <b style={{ color: T.text }}>completar</b> uma palavra (a partir de {MIN_FORMOU} letras) perde uma vida, e quem for pego{' '}
          <b style={{ color: T.text }}>blefando</b> também. Na sua vez, você pode <b style={{ color: T.text }}>duvidar</b> de quem jogou antes.
          As letras ficam <b style={{ color: T.text }}>ocultas</b> — a nova aparece por {NOVA_MS / 1000}s e vira “?”, então decore! Você pode espiar {CHANCES_VER}x por rodada. Não tem dicionário: <b style={{ color: T.text }}>a turma vota</b> (1 minuto, maioria decide)!
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: T.textT }}>Vidas por jogador:</span>
          {Array.from({ length: MAX_VIDAS }, (_, i) => i + 1).map(n => (
            <button key={n} className="up-btn" data-n={n} onClick={escolherVidas} disabled={!isHost}
              title={isHost ? `${n} ${n === 1 ? 'vida' : 'vidas'}` : 'Só o host escolhe'}
              style={{ width: 34, height: 34, borderRadius: 10, border: n === vidasIni ? '2px solid #FF4D6D' : `1px solid ${T.border}`, fontWeight: 900, fontSize: 14,
                cursor: isHost ? 'pointer' : 'default', background: n === vidasIni ? 'rgba(255,77,109,.16)' : 'transparent', color: n === vidasIni ? '#FF4D6D' : T.textT }}>
              {n}
            </button>
          ))}
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
          {state.vencedor ? `${primeiro(state.vencedor)} venceu!` : 'Empate — ninguém ganhou'}
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
      const d = state.duvida || {};
      const v = contarVotos(state, players.map(p => p.name)) || { total: 0, contra: 0, favor: 0 };
      const meuVoto = d.votos?.[name];
      const aguardaPalavra = blefeAguarda(d);
      const podeVotar = !aguardaPalavra && (d.duelo || d.alvo !== name) && (state.vidas?.[name] || 0) > 0;
      const tempo = d.duelo ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs}s`;
      const blefe = d.tipo === 'blefe';
      const destaque = (on, cor) => ({ outline: on ? '3px solid #fff' : 'none', boxShadow: on ? `0 0 0 3px ${cor}` : 'none' });
      return (
        <div className="up-fade" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text }}>
            {blefe ? `🤨 ${primeiro(d.por)} duvidou de ${primeiro(d.alvo)}!` : `🏁 ${primeiro(d.por)} diz que ${primeiro(d.alvo)} formou uma palavra!`}
          </div>
          <div style={{ fontSize: 12.5, color: T.textT, margin: '5px 0 10px', lineHeight: 1.5 }}>
            {blefe
              ? (souAlvo && !d.palavra
                ? <>Diga a palavra que você tinha em mente — ela tem que começar com <b style={{ color: T.text, letterSpacing: 2 }}>{fragV}</b></>
                : d.palavra
                  ? <>{primeiro(d.alvo)} disse: <b style={{ color: T.text, fontSize: 17, letterSpacing: 2 }}>{d.palavra.toUpperCase()}</b></>
                  : <>Esperando {primeiro(d.alvo)} dizer a palavra que começa com <b style={{ color: T.text, letterSpacing: 2 }}>{fragV}</b>...</>)
              : <>A palavra na mesa é <b style={{ color: T.text, fontSize: 17, letterSpacing: 4 }}>{fragV}</b> — isso é uma palavra que existe?</>}
          </div>
          {botaoEspiar}
          {blefe && souAlvo && !d.palavra && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
              <input autoFocus value={palavra} onChange={e => setPalavra(e.target.value)} maxLength={30}
                onKeyDown={e => e.key === 'Enter' && responder()} placeholder={`${fragV}...`}
                style={{ ...inputCss, width: 'min(60%, 240px)' }} />
              <button className="up-btn" onClick={responder} disabled={!palavra.trim()}
                style={{ ...btnBase, background: palavra.trim() ? `linear-gradient(135deg, ${P.verde}, ${P.ciano})` : T.textD }}>Enviar</button>
            </div>
          )}
          {podeVotar ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="up-btn" onClick={() => votar('contra')} style={{ ...btnBase, background: P.vermelho, ...destaque(meuVoto === 'contra', P.vermelho) }}>
                {blefe ? '❌ Não existe' : '✅ Formou palavra'}
              </button>
              <button className="up-btn" onClick={() => votar('favor')} style={{ ...btnBase, background: P.verde, ...destaque(meuVoto === 'favor', P.verde) }}>
                {blefe ? '✅ Existe' : '❌ Não formou'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textT }}>
              {aguardaPalavra ? (souAlvo ? 'Digite a palavra acima e envie. Se o tempo acabar, você perde uma vida!' : `A votação abre quando ${primeiro(d.alvo)} disser a palavra.`)
                : souAlvo && !d.duelo ? 'A turma está votando...' : 'Você está fora — só acompanhe!'}
            </div>
          )}
          <div style={{ fontSize: 12, color: T.textT, marginTop: 10 }}>
            Votos: <b style={{ color: P.vermelho }}>{v.contra}</b> {blefe ? 'não existe' : 'formou'} · <b style={{ color: P.verde }}>{v.favor}</b> {blefe ? 'existe' : 'não formou'}
            {' '}· {v.total} votante{v.total === 1 ? '' : 's'} · {tempo}
          </div>
          <div style={{ fontSize: 11, color: d.duelo ? P.amarelo : T.textD, marginTop: 3, fontWeight: d.duelo ? 700 : 400 }}>{d.duelo ? '⚔️ Só restam dois: os DOIS precisam votar igual. Sem acordo em 5 minutos, os dois são eliminados e ninguém ganha!' : 'Maioria decide na hora. Sem maioria em 1 minuto, ninguém perde vida.'}</div>
        </div>
      );
    }

    // jogando
    return (
      <div style={{ textAlign: 'center' }}>
        {state.aviso && <div className="up-fade" style={{ fontSize: 12.5, color: P.amarelo, fontWeight: 700, margin: '2px 0 6px' }}>{state.aviso}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {botaoEspiar}
          {podeFormou && (
            <button className="up-btn" onClick={chamarFormou} title={`Chamar: ${primeiro(ultimoPor)} formou uma palavra`}
              style={{ ...btnBase, padding: '7px 14px', fontSize: 12.5, marginBottom: 8, background: `linear-gradient(135deg, ${P.roxo}, ${P.azul})` }}>
              🏁 Formou palavra!
            </button>
          )}
        </div>
        {minhaVez ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, margin: '2px 0 10px' }}>Digite UMA letra para continuar a palavra — ou duvide de {primeiro(ultimoPor) || 'quem jogou'}.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <input autoFocus value={letra} onChange={e => setLetra(e.target.value.slice(-1))} maxLength={1}
                onKeyDown={e => e.key === 'Enter' && jogarLetra()} placeholder="A"
                style={{ ...inputCss, width: 84, textAlign: 'center', fontSize: 32, fontWeight: 900, textTransform: 'uppercase' }} />
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
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textT, marginTop: 4 }}>
            Espere <b style={{ color: T.text }}>{primeiro(state.vez)}</b> jogar. Se achar que a palavra já está completa, toque em “Formou palavra!”.
          </div>
        )}
      </div>
    );
  };

  const corVez = (n) => CORES[Math.max(0, ordem.indexOf(n)) % CORES.length];
  const seatDe = (n) => seats.find(x => x.name === n);
  const cartaoVez = (() => {
    if (!state) return null;
    if (fase === 'jogando') {
      const q = state.vez, st = seatDe(q);
      return <CardVez titulo={minhaVez ? 'É A SUA VEZ' : 'É A VEZ DE'} quem={q} photo={st?.photo} cor={corVez(q)} tempo={secs} vidas={st?.vidas} total={vidasIni}
        souEu={minhaVez} fala={fala} humor={humor} sub={minhaVez ? 'Jogue uma letra agora!' : null} />;
    }
    if (fase === 'duvida' && state.duvida) {
      const d = state.duvida, q = d.alvo, st = seatDe(q);
      const tempo = d.duelo ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : secs;
      return <CardVez titulo="VOTAÇÃO — DÚVIDA" quem={q} photo={st?.photo} cor={P.vermelho} tempo={tempo} vidas={st?.vidas} total={vidasIni}
        souEu={souAlvo} fala={fala} humor="bravo"
        sub={d.tipo === 'blefe' ? `${primeiro(d.por)} duvidou da letra de ${primeiro(q)}` : `${primeiro(d.por)} diz que ${primeiro(q)} formou uma palavra`} />;
    }
    if (fase === 'pausa' && state.evento) {
      const q = state.evento.quem, st = seatDe(q);
      return <CardVez titulo={state.evento.eliminado ? 'ELIMINADO' : 'PERDEU UMA VIDA'} quem={q} photo={st?.photo || fotoDe(q)} cor={P.vermelho} humor="bravo" fala={fala} />;
    }
    if (fase === 'fim') return <CardVez titulo="FIM DE JOGO" cor={P.verde} humor="feliz" fala={fala} />;
    return <CardVez titulo="SALA DE ESPERA" cor={P.azul} fala={fala} />;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'hidden', padding: 12, borderRadius: 18, position: 'relative',
      background: `linear-gradient(rgba(2,6,24,.22), rgba(2,6,24,.22)), ${CENARIO}` }} className="up-fxhost">
      <style>{CSS}</style>
      <FundoFX />
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
            <button className="up-btn" onClick={sair} style={{ ...btnBase, padding: '6px 12px', fontSize: 12, background: P.vermelho }}>Sair</button>
            <button className="up-btn" onClick={() => setConfirmSair(false)} style={{ ...btnBase, padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,.22)' }}>Ficar</button>
          </div>
        ) : (
          <button className="up-btn" onClick={() => (noLobby || fase === 'fim' ? sair() : setConfirmSair(true))}
            style={{ ...btnBase, padding: '7px 14px', fontSize: 12.5, background: 'rgba(255,255,255,.2)' }}>← Sair</button>
        )}
      </div>

      <div className="up-wrap">
        <div className="up-left up-scroll">
          {!state ? <div style={{ textAlign: 'center', fontSize: 13, color: T.textT }}>Carregando sala...</div> : (
            <>
              {cartaoVez}
              {(fase === 'jogando' || fase === 'duvida') && <CardPalavra letras={letras} ordem={ordem} mostrar={mostrar} novaIdx={novaIdx} cardBg={cardBg} />}
              <div style={{ background: cardBg, border: `2px solid ${T.border}`, borderRadius: 18, padding: 'clamp(10px, 1.8vh, 16px)', boxShadow: T.sh, flexShrink: 0 }}>{painel()}</div>
            </>
          )}
        </div>
        <div className="up-right">
          {state && <FaixaJogadores seats={seats} ordem={ordem} vez={fase === 'jogando' ? state.vez : null}
            alvo={fase === 'duvida' ? state.duvida?.alvo : null} cardBg={cardBg} />}
          <div className="up-chatbox">
            <ChatSala mensagens={chatMsgs} texto={chatTexto} setTexto={setChatTexto} onEnviar={enviarChat} name={name} cardBg={cardBg} />
          </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0, overflowY: 'auto', padding: 12, borderRadius: 18, position: 'relative',
      background: `linear-gradient(rgba(2,6,24,.35), rgba(2,6,24,.35)), ${CENARIO}` }} className="up-scroll up-fxhost">
      <style>{CSS}</style>
      <FundoFX />
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
