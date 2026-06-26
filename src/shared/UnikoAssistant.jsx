// src/shared/UnikoAssistant.jsx
// Assistente robô UNIKO — fixo no canto inferior esquerdo, flutua de leve, pisca, e ao
// falar/interagir expande um pouco e mostra um balão de fala COM ANIMAÇÃO DE DIGITAÇÃO.
// A imagem (sprite) troca conforme a interação: alarme/lembrete, atenção (RH), alexa, wave,
// prisma comum/premium. A cada 10s solta uma DICA aleatória do sistema (com o sprite do tema).
// Responde via FAQ curada (answerQuery — ÚNICO ponto a trocar por IA depois) e cria lembretes
// reais (tabela reminders). Voca os avisos/lembretes que chegam (prop `notif`).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../contexts/theme';
import { supabase as _supabase } from '../contexts/user';

// Sprites por humor/interação. encodeURI garante a URL certa (UNIKO_ATENÇÃO tem acento).
const IMG = {
  ALARME:  encodeURI('/UNIKO_ALARME.png'),
  ATENCAO: encodeURI('/UNIKO_ATENÇÃO.png'),
  ALEXA:   encodeURI('/UNIKO_ALEXA.png'),
  WAVE:    encodeURI('/UNIKO_WAVESIGN.png'),
  PRISMAC: encodeURI('/UNIKO_PRISMACOMUM.png'),
  PRISMAP: encodeURI('/UNIKO_PRISMAPREMIUM.png'),
};

/* ──────────────────────────────────────────────────────────────────────────
   BASE DE CONHECIMENTO (FAQ curada). answerQuery() pontua por gatilhos batidos.
   É o ÚNICO ponto que troca por IA real depois (vira um fetch ao servidor).
   ────────────────────────────────────────────────────────────────────────── */
const KB = [
  { k: ['prisma', 'loja', 'recompensa', 'premio', 'prêmio', 'resgatar', 'comprar'],
    a: 'Na Prisma Store você troca seus prismas (Comum e Premium) por prêmios reais. Ganha prismas no check-in diário e completando missões. Só admins abrem o módulo.' },
  { k: ['missão', 'missao', 'missões', 'missoes', 'desafio', 'desafios'],
    a: 'As missões dão prismas: Maratona Uniko Wave (jogar X min/dia), Voz ativa (dar feedback), Presença Impecável, Top do mês de música, e as de 1ª/2ª compra. O progresso é em tempo real; quando completa, é só resgatar.' },
  { k: ['check-in', 'checkin', 'check in', 'sequência', 'sequencia', 'streak'],
    a: 'O check-in é um ciclo de 7 dias com prismas crescentes. Se faltar um dia a sequência volta ao dia 1. Tem teto mensal de prismas.' },
  { k: ['uniko wave', 'jogo', 'ritmo', 'jogar', 'guerra estelar'],
    a: 'O Uniko Wave é o jogo de ritmo. Acerte as notas no tempo da música! Tem o modo clássico e o Guerra Estelar (estilo Muse Dash). Jogar acumula tempo pras missões Maratona.' },
  { k: ['gacha', 'audição', 'audicao', 'desejo', 'personagem', 'mascote'],
    a: 'No Uniko Wave, a aba Audição é o gacha: cada desejo custa 100 GW e libera personagens/mascotes. Tem garantia (pity) por volta do 32º desejo.' },
  { k: ['ponto', 'horas', 'banco de horas', 'marcação', 'marcacao', 'justificativa'],
    a: 'O Ponto Eletrônico controla suas marcações, banco de horas e justificativas. As marcações brutas são recalculadas automaticamente.' },
  { k: ['alexa', 'música', 'musica', 'tocar', 'spotify', 'echo'],
    a: 'A Central Alexa toca música no Echo via Spotify e mostra um clipe do YouTube. Quem mais coloca música no mês entra no Top do ranking (vale missão!).' },
  { k: ['feedback', 'voz ativa', 'opinião', 'opiniao', 'sugestão', 'sugestao'],
    a: 'Dê um feedback no sistema pra completar a missão Voz ativa e ganhar prismas. É só registrar sua opinião/sugestão no mês.' },
  { k: ['lembrete', 'lembrar', 'lembre', 'agendar', 'alarme'],
    a: 'Posso criar um lembrete pra você! Diga algo como "me lembre de bater o ponto às 14:30". Você também gerencia tudo no módulo de Lembretes.' },
  { k: ['evento', 'eventos', 'agenda', 'calendário', 'calendario'],
    a: 'Os eventos da empresa aparecem no Portal, na aba Eventos. Eu te aviso quando um novo for adicionado.' },
  { k: ['rh', 'aviso', 'comunicado', 'urgente'],
    a: 'Os avisos do RH chegam por mim em tempo real — os urgentes aparecem em tela cheia e os normais eu falo aqui no balão.' },
  { k: ['tema', 'cor', 'aparência', 'aparencia', 'escuro', 'claro'],
    a: 'Dá pra trocar o tema/visual pelo botão flutuante de tema. Tem modos claro e escuro.' },
  { k: ['ajuda', 'o que você faz', 'o que voce faz', 'oi', 'olá', 'ola', 'ei', 'help', 'funções', 'funcoes'],
    a: 'Oi! Eu sou o UNIKO 🤖. Posso explicar as funções do sistema (Prisma Store, Uniko Wave, Ponto, Alexa...), criar lembretes ("me lembre de X às HH:MM"), e te avisar de prismas, avisos do RH, eventos e do progresso das suas missões.' },
];

// Dicas rotativas (a cada 10s) — cada uma com o SPRITE do tema.
const TIPS = [
  { text: 'Dica: jogue Uniko Wave todo dia pra completar a Maratona e ganhar prismas! 🎮', sprite: IMG.WAVE },
  { text: 'Dica: a aba Audição do Uniko Wave é o gacha — gire pra liberar personagens! 🎰', sprite: IMG.WAVE },
  { text: 'Dica: faça check-in todos os dias pra manter a sequência e ganhar prismas Premium! ✨', sprite: IMG.PRISMAP },
  { text: 'Dica: prismas Premium valem os prêmios mais raros da Prisma Store! 💎', sprite: IMG.PRISMAP },
  { text: 'Dica: troque seus prismas por prêmios reais lá na Prisma Store! 🎁', sprite: IMG.PRISMAC },
  { text: 'Dica: coloque música na Central Alexa e dispute o Top do mês! 🎵', sprite: IMG.ALEXA },
  { text: 'Dica: dê um feedback no sistema pra completar a missão Voz ativa! 💬', sprite: IMG.ATENCAO },
  { text: 'Dica: me peça lembretes! Tipo "me lembre de bater o ponto às 14:30". ⏰', sprite: IMG.ALARME },
];

// Sprite do aviso/lembrete que chega pelo App.
function notifSprite(n) {
  const t = n?.type, title = (n?.title || '').toLowerCase();
  if (t === 'alexa') return IMG.ALEXA;
  if (t === 'aviso_urgente' || /aviso|aten|urgente|important/.test(title)) return IMG.ATENCAO;
  return IMG.ALARME; // lembrete / alarme
}

// Detecta intenção de criar lembrete e extrai mensagem + horário (HH:MM). null se não for.
function parseReminder(raw) {
  if (!/lembr/i.test(raw)) return null;
  let time = null;
  const tm = raw.match(/(\d{1,2})[:hH](\d{2})/) || raw.match(/(\d{1,2})\s*h(?:oras?|rs)?\b/i);
  if (tm) time = tm[2] ? `${String(tm[1]).padStart(2, '0')}:${tm[2]}` : `${String(tm[1]).padStart(2, '0')}:00`;
  const message = raw
    .replace(/^\s*(me\s+)?lembr\w*\s*(de|que|para|pra|:)?\s*/i, '')
    .replace(/\b(às|as)\s+/i, ' ')
    .replace(/\b\d{1,2}[:hH]\d{2}\b/g, '')
    .replace(/\b\d{1,2}\s*h(?:oras?|rs)?\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { time, message };
}

// PONTO DE TROCA PRA IA: hoje é FAQ por palavra-chave; depois vira um fetch ao servidor.
function answerQuery(raw) {
  const q = (raw || '').toLowerCase();
  let best = null, bestScore = 0;
  for (const item of KB) {
    const score = item.k.reduce((s, kw) => s + (q.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (best && bestScore > 0) return best.a;
  return 'Ainda não sei responder isso 😅. Posso ajudar com: Prisma Store, missões, check-in, Uniko Wave, Ponto, Central Alexa, feedback e lembretes. Tente perguntar sobre um deles!';
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const ICON = 84; // tamanho do robô (px)

/* Texto que aparece "sendo digitado" rapidamente (efeito máquina de escrever). */
const Typer = ({ text, speed = 16, onTick }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++; setN(i); onTick && onTick();
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);
  return <>{text ? text.slice(0, n) : ''}</>;
};

/* Carinha do UNIKO. Sem `src` → carinha normal piscando (3 frames). Com `src` → sprite fixo. */
const UnikoFace = ({ size, src }) => {
  const img = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
  if (src) {
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <img src={src} alt="Uniko" onError={e => { e.target.onerror = null; e.target.src = '/UNIKO_NEW.png'; }} style={{ ...img, animation: 'uaSpritePop .3s ease' }} />
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <img src="/UNIKO_PISCA.png" alt="" aria-hidden="true" style={img} />
      <img src="/UNIKO_PISCA_FRAME_2.png" alt="" aria-hidden="true" style={{ ...img, animation: 'uaBlinkMid 3s linear infinite' }} />
      <img src="/UNIKO_NEW.png" alt="Uniko" onError={e => { e.target.onerror = null; e.target.src = '/UNIKO_NEW.png'; }} style={{ ...img, animation: 'uaBlinkTop 3s linear infinite' }} />
    </div>
  );
};

const UnikoAssistant = ({ authUser, notif, onDismissNotif }) => {
  const [open, setOpen] = useState(false);          // painel de chat aberto?
  const [bubble, setBubble] = useState(null);       // { text, dismissable } | null
  const [sprite, setSprite] = useState(null);       // imagem atual (null = carinha normal)
  const [messages, setMessages] = useState([
    { from: 'uniko', text: 'Oi! Eu sou o UNIKO 🤖. Pergunte sobre o sistema ou peça um lembrete ("me lembre de X às HH:MM").' },
  ]);
  const [input, setInput] = useState('');
  const bubbleTimer = useRef(null);
  const listRef = useRef(null);
  const openRef = useRef(open);   openRef.current = open;
  const bubbleRef = useRef(bubble); bubbleRef.current = bubble;

  const scrollDown = useCallback(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, []);

  // "Falar": troca o sprite e mostra o balão (com digitação). O robô fica EXPANDIDO
  // enquanto o balão estiver visível (o scale é derivado de `bubble` no render).
  // dismissable = balão de aviso/lembrete (fica até o "Ok"); senão some sozinho.
  const say = useCallback((text, { sprite: sp = null, dismissable = false } = {}) => {
    setSprite(sp);
    setBubble({ text, dismissable });
    clearTimeout(bubbleTimer.current);
    if (!dismissable) {
      const ms = Math.min(13000, 4500 + text.length * 55);
      bubbleTimer.current = setTimeout(() => { setBubble(null); setSprite(null); }, ms);
    }
  }, []);

  // Voca avisos/lembretes que chegam pelo App (prop notif) com o sprite certo. Fica até o "Ok".
  const lastNotifId = useRef(null);
  useEffect(() => {
    if (!notif || notif.id === lastNotifId.current) return;
    lastNotifId.current = notif.id;
    const txt = notif.title && notif.title !== 'Lembrete'
      ? `${notif.title}: ${notif.message}`
      : `Ei, lembra de: ${notif.message}`;
    say(txt, { sprite: notifSprite(notif), dismissable: true });
    if (openRef.current) setOpen(false);
  }, [notif, say]);

  // DICAS rotativas a cada 10s (só com o painel fechado e sem aviso pendente esperando "Ok").
  useEffect(() => {
    if (!authUser) return;
    const id = setInterval(() => {
      if (openRef.current) return;
      if (bubbleRef.current?.dismissable) return;
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      say(tip.text, { sprite: tip.sprite });
    }, 30000);
    return () => clearInterval(id);
  }, [authUser, say]);

  useEffect(() => { if (open) scrollDown(); }, [messages, open, scrollDown]);
  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  const createReminder = async (message, time) => {
    try {
      await _supabase.from('reminders').insert({
        title: 'Lembrete', message, time: time + ':00', date: todayStr(), repeat: 'never',
        active: true, type: 'personal', created_by: authUser?.name,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      return true;
    } catch { return false; }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages(m => [...m, { from: 'me', text }]);

    const rem = parseReminder(text);
    let reply, sp = null;
    if (rem) {
      sp = IMG.ALARME;
      if (!rem.time) reply = 'Claro! Só me diga o horário também, ex.: "me lembre disso às 14:30". ⏰';
      else if (!rem.message) reply = 'Beleza! E do que você quer que eu te lembre às ' + rem.time + '?';
      else {
        const ok = await createReminder(rem.message, rem.time);
        reply = ok
          ? `Prontinho! Vou te lembrar de "${rem.message}" às ${rem.time}. ⏰`
          : 'Ops, não consegui salvar o lembrete agora. Tenta de novo?';
      }
    } else {
      reply = answerQuery(text);
    }
    if (sp) setSprite(sp);
    // Mensagem do UNIKO entra "digitando" (o Typer anima ao montar).
    setMessages(m => [...m, { from: 'uniko', text: reply }]);
  };

  if (!authUser) return null;

  const accent = T.gold || '#E8B84B';
  const panelBg = T.surface || '#fff';

  return (
    <div className="uniko-assistant" style={{ position: 'fixed', left: 18, bottom: 18, zIndex: 9990, display: 'flex', alignItems: 'flex-end', gap: 10, pointerEvents: 'none' }}>
      <style>{`
        @keyframes uaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes uaBlinkTop{0%,90%{opacity:1}90.6%,99%{opacity:0}99.4%,100%{opacity:1}}
        @keyframes uaBlinkMid{0%,93.8%{opacity:1}94.2%,96%{opacity:0}96.4%,100%{opacity:1}}
        @keyframes uaPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes uaSpritePop{from{opacity:.3;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
        body.uw-active .uniko-assistant{display:none!important}
      `}</style>

      {/* ── Robô (flutua sempre; fica EXPANDIDO enquanto o balão aparece; sprite muda) ── */}
      <div style={{ animation: 'uaFloat 5s ease-in-out infinite', pointerEvents: 'auto' }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Falar com o UNIKO"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'block',
            transform: (bubble && !open) ? 'scale(1.18)' : 'scale(1)', transformOrigin: 'bottom left',
            transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
            filter: `drop-shadow(0 8px 22px ${T.goldLine || accent}55)`,
          }}>
          <UnikoFace size={ICON} src={sprite} />
        </button>
      </div>

      {/* ── Balão de fala (dicas/avisos/respostas com painel fechado) — DIGITANDO ── */}
      {bubble && !open && (
        <div style={{ pointerEvents: 'auto', position: 'absolute', left: ICON + 30, bottom: 16, width: `min(300px, calc(100vw - ${ICON + 78}px))`, animation: 'uaPop .3s ease' }}>
          <div style={{ background: panelBg, color: T.text || '#222', border: `2px solid ${accent}`, borderRadius: '16px 16px 16px 5px', padding: '13px 17px', boxShadow: T.shL || '0 10px 30px rgba(0,0,0,0.20)' }}>
            <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: '.07em', marginBottom: 6 }}>UNIKO</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}><Typer text={bubble.text} /></div>
            {bubble.dismissable && (
              <button onClick={() => { setBubble(null); setSprite(null); if (notif && onDismissNotif) onDismissNotif(notif.id); }}
                style={{ marginTop: 9, padding: '5px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${accent},${T.goldLine || accent})`, color: '#3a2a05', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Ok
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Painel de chat ── */}
      {open && (
        <div style={{ pointerEvents: 'auto', position: 'absolute', left: 0, bottom: ICON + 22, width: 'min(360px, calc(100vw - 36px))', height: 440, maxHeight: 'calc(100vh - 160px)', background: panelBg, border: `1px solid ${T.border || 'rgba(0,0,0,.1)'}`, borderRadius: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'uaPop .25s ease' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${T.border || 'rgba(0,0,0,.08)'}`, background: `linear-gradient(135deg,${accent}22,transparent)` }}>
            <div style={{ width: 30, height: 30, position: 'relative', flexShrink: 0 }}><UnikoFace size={30} src={sprite} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>UNIKO</div>
              <div style={{ fontSize: 10.5, color: T.textT || '#8a8', fontWeight: 600 }}>Assistente do sistema</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS || '#888', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
          </div>
          {/* mensagens */}
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '84%', background: m.from === 'me' ? `linear-gradient(135deg,${accent},${T.goldLine || accent})` : (T.surfaceSub || 'rgba(0,0,0,0.05)'), color: m.from === 'me' ? '#3a2a05' : (T.text || '#222'), borderRadius: m.from === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '8px 12px', fontSize: 13, lineHeight: 1.5 }}>
                {m.from === 'uniko' && i === messages.length - 1 ? <Typer text={m.text} onTick={scrollDown} /> : m.text}
              </div>
            ))}
          </div>
          {/* input */}
          <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${T.border || 'rgba(0,0,0,.08)'}` }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Pergunte ou peça um lembrete..."
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border || 'rgba(0,0,0,.15)'}`, background: T.surfaceSub || 'rgba(0,0,0,0.03)', color: T.text, fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)' }} />
            <button onClick={handleSend} style={{ border: 'none', borderRadius: 10, padding: '0 16px', background: `linear-gradient(135deg,${accent},${T.goldLine || accent})`, color: '#3a2a05', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnikoAssistant;
