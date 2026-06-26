// src/shared/UnikoAssistant.jsx
// Assistente robô UNIKO — fixo no canto inferior esquerdo, flutua de leve, pisca, e ao
// falar/interagir expande um pouco e mostra um balão de fala. Responde sobre as funções do
// sistema (FAQ curada — ver answerQuery, o ÚNICO ponto a trocar por IA depois), cria lembretes
// de verdade (tabela reminders) e voca os avisos/lembretes que chegam (prop `notif`).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../contexts/theme';
import { supabase as _supabase } from '../contexts/user';

/* ──────────────────────────────────────────────────────────────────────────
   BASE DE CONHECIMENTO (FAQ curada). Cada item: gatilhos (palavras-chave) + resposta.
   answerQuery() pontua por nº de gatilhos batidos e devolve a melhor resposta. Este é o
   ÚNICO ponto que troca por IA real depois (basta answerQuery virar um fetch ao servidor).
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
    a: 'Oi! Eu sou o UNIKO 🤖. Posso explicar as funções do sistema (Prisma Store, Uniko Wave, Ponto, Alexa...), criar lembretes ("me lembre de X às HH:MM"), e te avisar de prismas recebidos, avisos do RH, eventos e do progresso das suas missões.' },
];

// Detecta intenção de criar lembrete e extrai mensagem + horário (HH:MM). Retorna null se não for.
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

/* Carinha do UNIKO com piscar (3 frames sobrepostos). */
const UnikoFace = ({ size }) => {
  const img = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
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
  const [pop, setPop] = useState(false);            // pulso de "expandir ao falar"
  const [messages, setMessages] = useState([
    { from: 'uniko', text: 'Oi! Eu sou o UNIKO 🤖. Pergunte sobre o sistema ou peça um lembrete ("me lembre de X às HH:MM").' },
  ]);
  const [input, setInput] = useState('');
  const bubbleTimer = useRef(null);
  const popTimer = useRef(null);
  const listRef = useRef(null);

  // "Falar": expande de leve (pop) e mostra o balão. dismissable = balão de aviso (com Ok).
  const say = useCallback((text, dismissable = false) => {
    setPop(true);
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPop(false), 650);
    setBubble({ text, dismissable });
    clearTimeout(bubbleTimer.current);
    if (!dismissable) {
      const ms = Math.min(12000, 4000 + text.length * 60);
      bubbleTimer.current = setTimeout(() => setBubble(null), ms);
    }
  }, []);

  // Voca avisos/lembretes que chegam pelo App (prop notif). Mantém o balão até o "Ok".
  const lastNotifId = useRef(null);
  useEffect(() => {
    if (!notif || notif.id === lastNotifId.current) return;
    lastNotifId.current = notif.id;
    const txt = notif.title && notif.title !== 'Lembrete'
      ? `${notif.title}: ${notif.message}`
      : `Ei, lembra de: ${notif.message}`;
    say(txt, true);
    if (open) setOpen(false);
  }, [notif, say, open]);

  // Rola o chat pro fim quando chega mensagem nova
  useEffect(() => { if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, open]);

  useEffect(() => () => { clearTimeout(bubbleTimer.current); clearTimeout(popTimer.current); }, []);

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
    let reply;
    if (rem) {
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
    setMessages(m => [...m, { from: 'uniko', text: reply }]);
    setPop(true); clearTimeout(popTimer.current); popTimer.current = setTimeout(() => setPop(false), 650);
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
        body.uw-active .uniko-assistant{display:none!important}
      `}</style>

      {/* ── Robô (flutua sempre; expande de leve ao falar) ── */}
      <div style={{ animation: 'uaFloat 5s ease-in-out infinite', pointerEvents: 'auto' }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Falar com o UNIKO"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'block',
            transform: pop ? 'scale(1.16)' : 'scale(1)', transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)',
            filter: `drop-shadow(0 8px 22px ${T.goldLine || accent}55)`,
          }}>
          <UnikoFace size={72} />
        </button>
      </div>

      {/* ── Balão de fala (avisos/lembretes e respostas com painel fechado) ── */}
      {bubble && !open && (
        <div style={{ pointerEvents: 'auto', position: 'absolute', left: 84, bottom: 8, maxWidth: 290, animation: 'uaPop .3s ease' }}>
          <div style={{ background: panelBg, color: T.text || '#222', border: `2px solid ${accent}`, borderRadius: '14px 14px 14px 4px', padding: '11px 14px', boxShadow: T.shL || '0 8px 26px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: '.07em', marginBottom: 4 }}>UNIKO</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{bubble.text}</div>
            {bubble.dismissable && (
              <button onClick={() => { setBubble(null); if (notif && onDismissNotif) onDismissNotif(notif.id); }}
                style={{ marginTop: 9, padding: '5px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${accent},${T.goldLine || accent})`, color: '#3a2a05', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Ok
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Painel de chat ── */}
      {open && (
        <div style={{ pointerEvents: 'auto', position: 'absolute', left: 0, bottom: 88, width: 'min(340px, calc(100vw - 36px))', height: 440, maxHeight: 'calc(100vh - 130px)', background: panelBg, border: `1px solid ${T.border || 'rgba(0,0,0,.1)'}`, borderRadius: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'uaPop .25s ease' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${T.border || 'rgba(0,0,0,.08)'}`, background: `linear-gradient(135deg,${accent}22,transparent)` }}>
            <div style={{ width: 30, height: 30, position: 'relative', flexShrink: 0 }}><UnikoFace size={30} /></div>
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
                {m.text}
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
