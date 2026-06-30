// src/shared/UnikoAssistant.jsx
// Assistente robô UNIKO — fixo no canto inferior esquerdo, flutua de leve, pisca, e ao
// falar/interagir expande um pouco e mostra um balão de fala COM ANIMAÇÃO DE DIGITAÇÃO.
// A imagem (sprite) troca conforme a interação: alarme/lembrete, atenção (RH), alexa, wave,
// prisma comum/premium. A cada 10s solta uma DICA aleatória do sistema (com o sprite do tema).
// Responde via FAQ curada (answerQuery — ÚNICO ponto a trocar por IA depois) e cria lembretes
// reais (tabela reminders). Voca os avisos/lembretes que chegam (prop `notif`).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../contexts/theme';
import { supabase as _supabase, SERVER_URL } from '../contexts/user';
import { loadMissionProgress } from './prismaMissions';
import { onCaptureState, getCaptureTargetRect, emitCaptureThrow } from './captureUniko';
import { getAssistantSkin, getActiveAssistantSkinId, onAssistantSkinChange } from './assistantSkin';

/* ──────────────────────────────────────────────────────────────────────────
   BASE DE CONHECIMENTO (FAQ curada). answerQuery() pontua por gatilhos batidos.
   É o ÚNICO ponto que troca por IA real depois (vira um fetch ao servidor).
   ────────────────────────────────────────────────────────────────────────── */
// Keywords sem acento (o faqMatch tira acento da pergunta). Frases (com espaço) pesam 2; palavra 1.
const KB = [
  // ── UNIKO WAVE ──
  { k: ['como conseguir personag', 'conseguir personag', 'consigo personag', 'como pego personag', 'desbloquear personag', 'ganhar personag', 'novo personag', 'personag', 'mascote', 'gacha', 'audicao', 'desejo', 'banner', 'pity'],
    a: 'Personagens e mascotes vêm da AUDIÇÃO (o gacha) do Uniko Wave: cada desejo custa 100 GW e libera personagens. A chance sobe a cada desejo sem ganhar (pity), chegando perto de 99% lá pelo 32º. Você junta GW jogando músicas.' },
  { k: ['o que e gw', 'ganhar gw', 'conseguir gw', 'como ganho gw', 'moeda do uniko'],
    a: 'GW é a moeda da Audição (gacha) do Uniko Wave — 100 GW por desejo. Você acumula GW jogando e mandando bem nas músicas.' },
  { k: ['como jog', 'jogar uniko', 'como funciona o uniko', 'o que e uniko wave', 'notas no ritmo', 'combo'],
    a: 'No Uniko Wave você acerta as notas no tempo da música pra fazer pontos e combo (PERFECT vale mais que GOOD). Escolha a música na Biblioteca e a dificuldade, e mande ver no ritmo!' },
  { k: ['guerra estelar', 'muse dash', 'modo de luta', 'darkcatbot', 'dark catbot', 'derrotar o boss', 'modo boss', 'finisher'],
    a: 'Guerra Estelar é o modo estilo Muse Dash: sua personagem corre e você aperta W (linha do ar) e S (chão) no ritmo pra acertar os minions e derrotar o Dark CatBot. No fim vem o finisher pra dar o golpe final.' },
  { k: ['mizuki', 'lady venebra', 'venebra', 'personagem da guerra', 'escolher personagem da guerra'],
    a: 'Na Guerra Estelar você joga como Mizuki ou Lady Venebra — escolha antes da partida, na seção Personagem da tela de preview. A Lady Venebra é a vampira da realeza, com o finisher EXPLOSÃO DE MAGIA SANGUÍNEA.' },
  { k: ['dificuldade', 'facil', 'dificil', 'nightmare', 'nivel de dificuldade'],
    a: 'Antes de jogar você escolhe a dificuldade, do Fácil ao Nightmare — quanto mais difícil, mais notas e mais pontos.' },
  { k: ['ranking do uniko', 'placar do uniko', 'melhor pontuacao', 'recorde', 'top do uniko wave'],
    a: 'O Uniko Wave tem ranking (geral e por dificuldade): sua melhor pontuação de cada música/dificuldade entra no placar com seu nick e personagem.' },
  { k: ['biblioteca', 'escolher musica', 'qual musica jogar', 'adicionar musica no jogo'],
    a: 'As músicas do Uniko Wave ficam na BIBLIOTECA. Tem seções fixas pra todos ("Jogue pela primeira vez!" e "Descubra novas músicas") além das que você adiciona.' },
  { k: ['travando', 'travado', 'lento', ' lag', 'lagando', 'qualidade grafica', 'fps', 'engasgando'],
    a: 'Se o jogo travar, abra as Configurações do Uniko Wave e baixe a Qualidade Gráfica (Ultra Leve ou Baixo) — reduz efeitos e melhora o FPS em máquinas mais fracas.' },
  // ── PRISMA STORE ──
  { k: ['ganhar prisma', 'conseguir prisma', 'como ganho prisma', 'como conseguir prisma', 'mais prisma', 'juntar prisma'],
    a: 'Você ganha prismas no CHECK-IN diário e completando MISSÕES (Maratona Uniko Wave, Voz ativa, Presença Impecável, Top do mês de música, 1ª/2ª compra). Comum é mais fácil; Premium é o raro.' },
  { k: ['prisma comum', 'prisma premium', 'diferenca de prisma', 'tipos de prisma', 'duas moedas'],
    a: 'São duas moedas: Prisma Comum (mais fácil de juntar) e Prisma Premium (raro e mais valioso, pros prêmios Épico/Lendário).' },
  { k: ['check-in', 'checkin', 'check in', 'sequencia', 'streak', 'dia do check'],
    a: 'O check-in é um ciclo de 7 dias com prismas crescentes que alternam as moedas (dia 1: 50 Premium; 2: 80 Comum; 3: 100 Premium; 4: 50 Comum; 5: 90 Premium; 6: 120 Comum; 7: 150 Premium). Faltou um dia, volta pro dia 1. Tem teto mensal (300 Premium / 200 Comum).' },
  { k: ['missao', 'missoes', 'desafio', 'maratona', 'voz ativa', 'presenca impecavel', 'completar missao'],
    a: 'Missões dão prismas: Maratona Uniko Wave (20 min/dia = 100 Comum; 40 min/dia = 10 Premium), Voz ativa (1 feedback no mês = 30 Premium), Presença Impecável (presença 100% sem ocorrências = 100 Premium), Top 1/2/3 de quem mais coloca música (100/70/50 Premium) e 1ª/2ª compra (200/400 Comum).' },
  { k: ['resgatar premio', 'comprar premio', 'loja', 'trocar prisma', 'premios', 'pix', 'recompensa'],
    a: 'Na Loja da Prisma Store você troca prismas por prêmios reais (PIX, eletrônicos, vouchers...). Comum/Raro custam Prisma Comum; Épico/Lendário custam Prisma Premium. Alguns prêmios têm data de expiração.' },
  { k: ['transferir prisma', 'enviar prisma', 'dar prisma', 'mandar prisma'],
    a: 'Dá pra transferir Prisma Comum pra um colega na Prisma Store. O admin também pode adicionar, retirar ou zerar prismas.' },
  // ── PORTAL / RH ──
  { k: ['ponto eletronico', 'banco de horas', 'minhas horas', 'saldo de horas', 'marcacao', 'bater ponto'],
    a: 'O Ponto Eletrônico controla suas marcações, banco de horas e justificativas. No Portal do Colaborador você vê seu Banco de Horas (logo abaixo de Seus Dados).' },
  { k: ['justificativa', 'justificar falta', 'abonar', 'atestado'],
    a: 'Justificativas de ponto (faltas/atrasos) são tratadas no Ponto Eletrônico — fale com o RH pra registrar.' },
  { k: ['contracheque', 'holerite', 'financeiro', 'salario', 'pagamento', 'demonstrativo'],
    a: 'Seus contracheques ficam na aba Financeiro do Portal do Colaborador.' },
  { k: ['feedback', 'sugestao', 'reclamacao', 'opiniao', 'dar feedback'],
    a: 'Dê um feedback na aba Feedback do Portal pra registrar opinião/sugestão — isso completa a missão Voz ativa e dá prismas.' },
  { k: ['evento', 'eventos', 'agenda', 'calendario'],
    a: 'Os eventos da empresa ficam na aba Eventos do Portal. Eu te aviso quando um evento novo é adicionado.' },
  { k: ['comunicado', 'aviso da empresa', 'noticia', 'aviso do rh'],
    a: 'Comunicados do RH aparecem na aba Comunicados do Portal — e os avisos urgentes aparecem em tela cheia. Eu também aviso aqui em tempo real.' },
  { k: ['conquista', 'conquistas', 'trofeu', 'badge', 'medalha'],
    a: 'Suas conquistas ficam na aba Conquistas do Portal do Colaborador.' },
  { k: ['colega', 'colegas', 'quem trabalha', 'lista de funcionarios'],
    a: 'A aba Colegas do Portal mostra a lista de colegas da empresa.' },
  // ── CENTRAL ALEXA ──
  { k: ['tocar musica', 'colocar musica', 'central alexa', 'alexa', 'spotify', 'echo', 'pedir musica', 'botar musica'],
    a: 'Na Central Alexa você coloca música pra tocar no Echo via Spotify, com clipe do YouTube. Tem fila e votação pra pular. Quem mais coloca música no mês entra no Top (vale missão de prismas).' },
  { k: ['maquina do tempo', 'dj do mes', 'quem colocou musica', 'top do mes de musica'],
    a: 'A Máquina do Tempo (Central Alexa) mostra as estatísticas e o ranking dos DJs — quem mais colocou música no mês.' },
  { k: ['festival'],
    a: 'O Festival é um modo da Central Alexa que toca a música no Echo com uma mini janela de videoclipe.' },
  // ── DIVERSOS ──
  { k: ['my uniko', 'dodoco', 'mascote dodoco', 'bichinho', 'cuidar do mascote'],
    a: 'No My Uniko você cuida do mascote Dodoco — fome, energia e sono. Mantenha ele feliz!' },
  { k: ['games', 'jogos arcade', 'ranking geral', 'jogos do portal'],
    a: 'Na aba Games do Portal tem jogos arcade com um Ranking Geral que soma seus pontos.' },
  { k: ['lembrete', 'lembrar', 'lembre', 'agendar', 'alarme', 'apagar lembrete', 'deletar lembrete', 'remover lembrete', 'meus lembretes'],
    a: 'Posso criar lembretes pra você — diga "me lembre de bater o ponto às 14:30". Para ver, editar ou apagar seus lembretes (inclusive todos), use o módulo Meus Lembretes no Portal. Por aqui eu só crio lembretes novos.' },
  { k: ['foto de perfil', 'mudar foto', 'trocar foto', 'imagem de perfil', 'alterar foto'],
    a: 'Pra trocar sua foto de perfil: no Portal do Colaborador, aba Início, clique na sua foto/avatar pra abrir o editor — escolha a imagem em "Trocar imagem", ajuste o recorte e salve. Também dá pra usar um skin do Dodoco como foto no My Uniko.' },
  { k: ['tema', 'cor do site', 'aparencia', 'modo escuro', 'modo claro', 'tema escuro', 'tema claro'],
    a: 'Dá pra trocar o tema/visual pelo botão flutuante de tema. Tem modos claro e escuro.' },
  { k: ['o que e o sistema', 'o que e o uniko hub', 'o que da pra fazer', 'para que serve', 'quais modulos', 'modulos'],
    a: 'O Uniko HUB é o portal interno da empresa: Portal do Colaborador (RH, jogos, eventos), Prisma Store (recompensas), Uniko Wave (jogo de ritmo), Central Alexa (música), Ponto Eletrônico, Oficina Estelar e Conexão Setorial.' },
  { k: ['ajuda', 'o que voce faz', 'oi', 'ola', 'help', 'funcoes', 'o que voce pode fazer'],
    a: 'Oi! Eu sou o UNIKO 🤖. Posso explicar as funções do sistema (Prisma Store, Uniko Wave, Ponto, Alexa...), criar lembretes ("me lembre de X às HH:MM"), e te avisar de prismas recebidos, avisos do RH, eventos e do progresso das missões.' },
];

// Dicas rotativas (a cada 10s) — cada uma com a CHAVE do sprite (resolvida pela skin ativa).
const TIPS = [
  { text: 'Dica: jogue Uniko Wave todo dia pra completar a Maratona e ganhar prismas! 🎮', sprite: 'WAVE' },
  { text: 'Dica: a aba Audição do Uniko Wave é o gacha — gire pra liberar personagens! 🎰', sprite: 'WAVE' },
  { text: 'Dica: faça check-in todos os dias pra manter a sequência e ganhar prismas Premium! ✨', sprite: 'PRISMAP' },
  { text: 'Dica: prismas Premium valem os prêmios mais raros da Prisma Store! 💎', sprite: 'PRISMAP' },
  { text: 'Dica: troque seus prismas por prêmios reais lá na Prisma Store! 🎁', sprite: 'PRISMAC' },
  { text: 'Dica: coloque música na Central Alexa e dispute o Top do mês! 🎵', sprite: 'ALEXA' },
  { text: 'Dica: dê um feedback no sistema pra completar a missão Voz ativa! 💬', sprite: 'ATENCAO' },
  { text: 'Dica: me peça lembretes! Tipo "me lembre de bater o ponto às 14:30". ⏰', sprite: 'ALARME' },
];

// CHAVE do sprite do aviso/lembrete que chega pelo App (resolvida pela skin ativa).
function notifSprite(n) {
  const t = n?.type, title = (n?.title || '').toLowerCase();
  if (t === 'alexa') return 'ALEXA';
  if (t === 'aviso_urgente' || /aviso|aten|urgente|important/.test(title)) return 'ATENCAO';
  return 'ALARME'; // lembrete / alarme
}

// Detecta intenção de criar lembrete e extrai mensagem + horário (HH:MM). null se não for.
function parseReminder(raw) {
  // Só CRIAÇÃO de lembrete (imperativo): "me lembre/lembra de...", "lembre-me...",
  // "lembrar de...", "lembrete: ...". Perguntas sobre lembretes (apagar/ver/quais/como/consigo)
  // NÃO caem aqui — vão pra resposta registrada/FAQ/IA.
  const isCreate = /\bme\s+lembr|\blembr[ae]\s+(?:de|que|pra|para)\b|\blembr[ea]-me\b|\blembrar\s+(?:de|que)\b|\blembrete\s*[:\-]/i.test(raw);
  if (!isCreate) return null;
  if (/^\s*(como|quais|qual|o que|posso|consigo|d[áa]\s+pra|onde|quando|por\s*que|porque)\b/i.test(raw)) return null;
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

const FAQ_FALLBACK = 'Ainda não sei responder isso 😅. Posso ajudar com: Prisma Store, missões, check-in, Uniko Wave, Ponto, Central Alexa, feedback e lembretes. Tente perguntar sobre um deles!';

// Normaliza a pergunta numa chave (MESMA do servidor/dashboard) — pra casar com a uniko_qa_cache.
const qkeyOf = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

// FAQ por palavra-chave: ignora ACENTO (q e keywords normalizados) e dá mais peso a FRASES
// (gatilho com espaço pesa 2, palavra solta pesa 1) → a entrada mais específica vence.
function faqMatch(raw) {
  const q = qkeyOf(raw);
  let best = null, bestScore = 0;
  for (const item of KB) {
    let score = 0;
    for (const kw of item.k) { const k = qkeyOf(kw); if (k && q.includes(k)) score += k.includes(' ') ? 2 : 1; }
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore > 0 ? best.a : null;
}

// IA (fallback quando a FAQ não sabe): chama o endpoint do SERVIDOR (a chave fica SÓ lá).
// Se o servidor não tiver chave/endpoint, devolve vazio e o cliente usa o FAQ_FALLBACK.
async function askAI(question) {
  try {
    const r = await fetch(`${SERVER_URL}/api/uniko/ask`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const a = (d?.answer || '').trim();
    return a || null;
  } catch { return null; }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ── Posição arrastável (estilo AssistiveTouch) ──
   Guarda o canto sup-esquerdo do robô em px; persiste por usuário no localStorage.
   icon/margin variam por SKIN (o Vampire-Robot é maior e mais afastado da borda). */
const POS_KEY = 'uniko_assistant_pos';
const DRAG_THRESHOLD = 5;      // px pra considerar arraste (e não toque/clique)

const clampPos = (p, icon = 84, margin = 12) => {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    x: Math.max(margin, Math.min(w - icon - margin, p.x)),
    y: Math.max(margin, Math.min(h - icon - margin, p.y)),
  };
};
const loadPos = (icon = 84, margin = 12) => {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return clampPos(p, icon, margin);
  } catch {}
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return { x: margin + 6, y: h - icon - margin - 6 }; // default: canto inferior esquerdo
};
const savePos = (p) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {} };

/* Texto que aparece "sendo digitado" rapidamente (efeito máquina de escrever).
   onStart/onDone marcam quando o UNIKO está "falando" (pra mexer a boca). */
const Typer = ({ text, speed = 16, onTick, onStart, onDone }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) { onDone && onDone(); return; }
    onStart && onStart();
    let i = 0;
    const id = setInterval(() => {
      i++; setN(i); onTick && onTick();
      if (i >= text.length) { clearInterval(id); onDone && onDone(); }
    }, speed);
    return () => { clearInterval(id); onDone && onDone(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);
  return <>{text ? text.slice(0, n) : ''}</>;
};

/* Carinha do UNIKO (skin-aware). Com `src` → sprite fixo. Sem `src`: se `talking` → boca
   mexendo (se a skin tiver frames de boca), senão carinha normal piscando (3 frames). */
const UnikoFace = ({ size, src, talking, skin }) => {
  const img = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
  const fallback = skin.blink.open;
  if (src) {
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <img src={src} alt="Uniko" onError={e => { e.target.onerror = null; e.target.src = fallback; }} style={{ ...img, animation: 'uaSpritePop .3s ease' }} />
      </div>
    );
  }
  if (talking && skin.mouth) {
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <img src={skin.mouth.open} alt="" aria-hidden="true" style={img} />
        <img src={skin.mouth.half} alt="" aria-hidden="true" style={{ ...img, animation: 'uaTalkMid .42s linear infinite' }} />
        <img src={skin.mouth.closed} alt="Uniko" onError={e => { e.target.onerror = null; e.target.src = fallback; }} style={{ ...img, animation: 'uaTalkTop .42s linear infinite' }} />
      </div>
    );
  }
  if (talking) { // skin sem frames de boca → mostra a base
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <img src={fallback} alt="Uniko" style={img} />
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <img src={skin.blink.closed} alt="" aria-hidden="true" style={img} />
      <img src={skin.blink.mid} alt="" aria-hidden="true" style={{ ...img, animation: 'uaBlinkMid 3s linear infinite' }} />
      <img src={skin.blink.open} alt="Uniko" onError={e => { e.target.onerror = null; e.target.src = fallback; }} style={{ ...img, animation: 'uaBlinkTop 3s linear infinite' }} />
    </div>
  );
};

const UnikoAssistant = ({ authUser, notif, onDismissNotif, inPortal = false }) => {
  const [open, setOpen] = useState(false);          // painel de chat aberto?
  const [skinId, setSkinId] = useState(getActiveAssistantSkinId); // skin do assistente (default | uniko capturado)
  const skin = getAssistantSkin(skinId);
  const IMG = skin.sprites;                          // sprites resolvidos pela skin ativa
  const imgRef = useRef(IMG); imgRef.current = IMG;  // versão sempre atual p/ closures de effects
  const ICON = skin.iconSize || 84;                  // tamanho do robô (varia por skin)
  const MARGIN = skin.edgeMargin ?? 12;              // distância das bordas (varia por skin)
  const iconRef = useRef(ICON); iconRef.current = ICON;
  const marginRef = useRef(MARGIN); marginRef.current = MARGIN;
  const [captureAlert, setCaptureAlert] = useState(null); // Uniko disponível pra capturar (só no Portal)
  const [bubble, setBubble] = useState(null);       // { text, dismissable } | null
  const [sprite, setSprite] = useState(null);       // imagem atual (null = carinha normal)
  const [talking, setTalking] = useState(false);    // está "digitando"/falando? → boca mexe
  const [messages, setMessages] = useState([
    { from: 'uniko', text: 'Oi! Eu sou o UNIKO 🤖. Pergunte sobre o sistema ou peça um lembrete ("me lembre de X às HH:MM").' },
  ]);
  const [input, setInput] = useState('');
  const [overrides, setOverrides] = useState({}); // perguntas registradas pelo admin (in_faq) → resposta
  const [pos, setPos] = useState(() => loadPos(getAssistantSkin(getActiveAssistantSkinId()).iconSize || 84, getAssistantSkin(getActiveAssistantSkinId()).edgeMargin ?? 12)); // canto sup-esq do robô (px) — arrastável
  const [dragging, setDragging] = useState(false);  // arrastando? (desliga transição p/ seguir o dedo)
  const [hovered, setHovered] = useState(false);    // mouse em cima? → expande suavemente
  const bubbleTimer = useRef(null);
  const listRef = useRef(null);
  const dragRef = useRef(null);   // { sx, sy, ox, oy, moved } enquanto arrasta
  const openRef = useRef(open);   openRef.current = open;
  const inPortalRef = useRef(inPortal); inPortalRef.current = inPortal;
  const captureRef = useRef(captureAlert); captureRef.current = captureAlert;
  const bubbleRef = useRef(bubble); bubbleRef.current = bubble;
  const posRef = useRef(pos);     posRef.current = pos;

  // Carrega as respostas REGISTRADAS pelo admin (uniko_qa_cache, in_faq=true). Elas VENCEM a FAQ
  // curada — senão palavras-chave da FAQ (ex.: "banco de horas") sombreariam a resposta registrada.
  useEffect(() => {
    if (!authUser) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await _supabase.from('uniko_qa_cache').select('qkey,answer').eq('in_faq', true);
        if (!alive) return;
        const map = {};
        for (const r of (data || [])) if (r.qkey && r.answer) map[r.qkey] = r.answer;
        setOverrides(map);
      } catch {}
    })();
    return () => { alive = false; };
  }, [authUser]);

  const scrollDown = useCallback(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, []);

  // "Falar": troca o sprite e mostra o balão (com digitação). O robô fica EXPANDIDO
  // enquanto o balão estiver visível (o scale é derivado de `bubble` no render).
  // dismissable = balão de aviso/lembrete (fica até o "Ok"); senão some sozinho.
  const say = useCallback((text, { sprite: sp = null, dismissable = false, onOk = null } = {}) => {
    setSprite(sp);
    setBubble({ text, dismissable, onOk });
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
    say(txt, { sprite: imgRef.current[notifSprite(notif)], dismissable: true, onOk: () => onDismissNotif && onDismissNotif(notif.id) });
    if (openRef.current) setOpen(false);
  }, [notif, say]);

  // Skin do assistente pode mudar (quando o usuário "usa como assistente" um Uniko capturado).
  useEffect(() => onAssistantSkinChange((id) => setSkinId(id || 'default')), []);

  // ── CAPTURE O UNIKO: avisa SÓ quando está no Portal do Colaborador e há um Uniko disponível.
  // Ouve o estado emitido pelo widget (captureUniko pub/sub). Heartbeat + sprite + fala.
  const lastCaptureId = useRef(null);
  useEffect(() => {
    const off = onCaptureState((s) => {
      if (s?.captured) {            // capturou! parabeniza e limpa o alerta
        setCaptureAlert(null);
        say(`Boa! Você capturou o ${s.uniko?.name || 'Uniko'} e ganhou 100 Prismas Comuns + 100 Premium! Ele já está na sua Coleção. 🎉`, { sprite: imgRef.current.CAPTURE, dismissable: true });
        return;
      }
      // alerta GLOBAL: avisa em qualquer tela quando há um Uniko disponível
      setCaptureAlert(s?.available ? s.uniko : null);
    });
    return off;
  }, [say]);

  // Ao surgir um Uniko disponível, fala "Capture o Uniko!" uma vez (heartbeat é contínuo).
  useEffect(() => {
    if (captureAlert && captureAlert.id !== lastCaptureId.current) {
      lastCaptureId.current = captureAlert.id;
      say(`Tem um ${captureAlert.name} pra capturar — Capture o Uniko! ✨`, { sprite: imgRef.current.CAPTURE, dismissable: true });
    }
    if (!captureAlert) lastCaptureId.current = null;
  }, [captureAlert, say]);

  // DICAS rotativas a cada 30s (só com o painel fechado e sem aviso pendente esperando "Ok").
  useEffect(() => {
    if (!authUser) return;
    const id = setInterval(() => {
      if (openRef.current) return;
      if (bubbleRef.current?.dismissable) return;
      if (captureRef.current) return; // não interrompe o alerta de captura
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      say(tip.text, { sprite: imgRef.current[tip.sprite] });
    }, 30000);
    return () => clearInterval(id);
  }, [authUser, say]);

  // ── PROATIVO 1: prismas recebidos de outra pessoa (transferência/envio) ──
  // mercado_history do usuário com kind 'envio' (player→player) ou 'admin' (admin→você) e
  // valor POSITIVO (ignora retiradas). 1ª passada só marca o que já existe (não reavisa antigos).
  useEffect(() => {
    if (!authUser?.name) return;
    let alive = true; const seen = new Set(); let first = true;
    const poll = async () => {
      let data;
      try {
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        ({ data } = await _supabase.from('mercado_history')
          .select('id,kind,comum,premium,created_at')
          .eq('player', authUser.name).in('kind', ['envio', 'admin'])
          .gte('created_at', since).order('created_at', { ascending: true }));
      } catch { return; }
      if (!alive) return;
      for (const r of (data || [])) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        if (first) continue;
        const premium = r.premium || 0, comum = r.comum || 0;
        if (premium <= 0 && comum <= 0) continue;
        const isPrem = premium > 0, amt = isPrem ? premium : comum;
        say(`Você recebeu ${amt} ${isPrem ? 'Prisma Premium' : 'Prisma Comum'}! 🎉`,
          { sprite: isPrem ? imgRef.current.PRISMAP : imgRef.current.PRISMAC, dismissable: true });
      }
      first = false;
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [authUser, say]);

  // ── PROATIVO 2: novos eventos na agenda (calendar_events) — dedup por id ──
  useEffect(() => {
    if (!authUser) return;
    let alive = true; const seen = new Set(); let first = true;
    const poll = async () => {
      let data;
      try { ({ data } = await _supabase.from('calendar_events').select('id,title,event_date')); }
      catch { return; }
      if (!alive) return;
      const rows = data || [];
      if (first) { rows.forEach(r => seen.add(r.id)); first = false; return; }
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const when = r.event_date ? ` (${String(r.event_date).split('-').reverse().join('/')})` : '';
        say(`Novo evento na agenda: ${r.title}${when}! 📅`, { sprite: imgRef.current.ATENCAO });
      }
    };
    poll();
    const id = setInterval(poll, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [authUser, say]);

  // ── PROATIVO 3: relembra o progresso da Maratona Uniko Wave (só quando há progresso) ──
  useEffect(() => {
    if (!authUser?.name) return;
    let alive = true; let last = '';
    const check = async () => {
      if (openRef.current || bubbleRef.current) return; // não interrompe chat/balão ativo
      let baseline = {};
      try {
        const { data: row } = await _supabase.from('mercado_state').select('data').eq('player', authUser.name).maybeSingle();
        baseline = row?.data?.missionBaseline || {};
      } catch {}
      if (!alive) return;
      let prog;
      try { prog = await loadMissionProgress({ userName: authUser.name, cpf: authUser?.cpf, baseline }); }
      catch { return; }
      if (!alive) return;
      const m20 = prog.c_uniko20 || 0, m40 = prog.c_uniko40 || 0;
      let msg = '';
      if (m20 > 0 && m20 < 20) msg = `Você já jogou ${m20}/20 min no Uniko Wave hoje — falta pouco pra Maratona (100 Prismas Comuns)! 🎮`;
      else if (m20 >= 20 && m40 > 0 && m40 < 40) msg = `Mandou bem! ${m40}/40 min hoje — jogue mais um pouco pra fechar a Maratona de 40 min (10 Prismas Premium)! 🎮`;
      if (msg && msg !== last) { last = msg; say(msg, { sprite: imgRef.current.WAVE }); }
    };
    const t = setTimeout(check, 45000);
    const id = setInterval(check, 300000); // a cada 5 min
    return () => { alive = false; clearTimeout(t); clearInterval(id); };
  }, [authUser, say]);

  useEffect(() => { if (open) scrollDown(); }, [messages, open, scrollDown]);
  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  // ── ARRASTAR o robô (estilo AssistiveTouch) — mouse + toque. Distingue toque de arraste:
  //    sem mover além do limiar → abre/fecha o chat; arrastou → reposiciona e gruda na borda. ──
  const startDrag = useCallback((cx, cy) => {
    dragRef.current = { sx: cx, sy: cy, ox: posRef.current.x, oy: posRef.current.y, moved: false };
    setDragging(true);
  }, []);
  useEffect(() => {
    const moveTo = (cx, cy) => {
      const d = dragRef.current; if (!d) return;
      const dx = cx - d.sx, dy = cy - d.sy;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true;
      setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }, iconRef.current, marginRef.current));
    };
    const onMouseMove = (e) => moveTo(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (!dragRef.current || !e.touches[0]) return;
      e.preventDefault(); // não rola a página enquanto arrasta o robô
      moveTo(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (!d) return;
      if (!d.moved) { setOpen(o => !o); return; } // foi um toque/clique → abre o chat

      // ── ARREMESSO: soltou o assistente em cima do Uniko do widget? → captura ──
      const icon = iconRef.current, margin = marginRef.current;
      if (captureRef.current) {
        const rect = getCaptureTargetRect();
        const cx = posRef.current.x + icon / 2, cy = posRef.current.y + icon / 2;
        const M = 46; // margem de tolerância (mira generosa)
        if (rect && cx > rect.left - M && cx < rect.right + M && cy > rect.top - M && cy < rect.bottom + M) {
          emitCaptureThrow();
          // voa até o alvo e volta pra borda (sensação de arremesso)
          const dock = { x: (posRef.current.x + icon / 2) < window.innerWidth / 2 ? margin : window.innerWidth - icon - margin, y: posRef.current.y };
          setPos(clampPos({ x: rect.left + rect.width / 2 - icon / 2, y: rect.top + rect.height / 2 - icon / 2 }, icon, margin));
          setTimeout(() => { setPos(dock); savePos(dock); }, 420);
          return;
        }
      }

      // Arrastou: gruda na borda lateral mais próxima (vertical fica livre) e persiste.
      setPos(p => {
        const w = window.innerWidth;
        const snapX = (p.x + icon / 2) < w / 2 ? margin : w - icon - margin;
        const np = { x: snapX, y: p.y };
        savePos(np);
        return np;
      });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
    };
  }, []);
  // Re-encaixa na tela quando o tamanho do robô muda (troca de skin: ex. Vampire-Robot é maior).
  useEffect(() => { setPos(p => clampPos(p, ICON, MARGIN)); }, [ICON, MARGIN]);
  // Mantém o robô dentro da tela quando a janela muda de tamanho.
  useEffect(() => {
    const onResize = () => setPos(p => clampPos(p, iconRef.current, marginRef.current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

    // Carinha normal (sem sprite especial) → ao responder, a BOCA mexe enquanto digita.
    setSprite(null);

    // 1) Lembrete? (tratado localmente, sem IA)
    const rem = parseReminder(text);
    if (rem) {
      let reply;
      if (!rem.time) reply = 'Claro! Só me diga o horário também, ex.: "me lembre disso às 14:30". ⏰';
      else if (!rem.message) reply = 'Beleza! E do que você quer que eu te lembre às ' + rem.time + '?';
      else {
        const ok = await createReminder(rem.message, rem.time);
        reply = ok
          ? `Prontinho! Vou te lembrar de "${rem.message}" às ${rem.time}. ⏰`
          : 'Ops, não consegui salvar o lembrete agora. Tenta de novo?';
      }
      setMessages(m => [...m, { from: 'uniko', text: reply }]);
      return;
    }

    // 2) Resposta REGISTRADA pelo admin (override) vence a FAQ curada
    const ov = overrides[qkeyOf(text)];
    if (ov) { setMessages(m => [...m, { from: 'uniko', text: ov }]); return; }

    // 3) FAQ curada (grátis/instantânea)
    const faq = faqMatch(text);
    if (faq) { setMessages(m => [...m, { from: 'uniko', text: faq }]); return; }

    // 4) Não bateu na FAQ → IA (com placeholder "pensando"; se falhar, usa o fallback)
    setMessages(m => [...m, { from: 'uniko', text: '…', pending: true }]);
    const ai = await askAI(text);
    const reply = ai || FAQ_FALLBACK;
    setMessages(m => {
      const c = m.slice();
      for (let i = c.length - 1; i >= 0; i--) { if (c[i].pending) { c[i] = { from: 'uniko', text: reply }; break; } }
      return c;
    });
  };

  if (!authUser) return null;

  const accent = T.gold || '#E8B84B';
  const panelBg = T.surface || '#fff';

  // Skin vampire → borda do balão e label em vermelho-sangue (em vez do azul padrão)
  const isVampSkin = skinId !== 'default';
  const bubbleConic = isVampSkin
    ? '#7a0010,#c41e3a,#ff2d4c,#8a0014,#ff4a63,#c41e3a,#7a0010'
    : '#1A6FB5,#2196F3,#0D47A1,#4FC3F7,#1565C0,#00B0FF,#1A6FB5';
  const bubbleLabelColor = isVampSkin ? '#ff3a4e' : '#2196F3';

  // Onde o robô está → decide pra que lado o balão/painel abrem (pra não sair da tela).
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const onLeft = (pos.x + ICON / 2) < vw / 2;
  const onTop  = (pos.y + ICON / 2) < vh / 2;

  return (
    <div className="uniko-assistant" style={{ position: 'fixed', left: pos.x, top: pos.y, width: ICON, height: ICON, zIndex: 9990, pointerEvents: 'none', transition: dragging ? 'none' : 'left .28s cubic-bezier(.22,1,.36,1), top .28s cubic-bezier(.22,1,.36,1)' }}>
      <style>{`
        @keyframes uaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes uaBlinkTop{0%,90%{opacity:1}90.6%,99%{opacity:0}99.4%,100%{opacity:1}}
        @keyframes uaBlinkMid{0%,93.8%{opacity:1}94.2%,96%{opacity:0}96.4%,100%{opacity:1}}
        @keyframes uaPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes uaSpritePop{from{opacity:.3;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
        @keyframes uaTalkTop{0%,20%{opacity:1}20.01%,80%{opacity:0}80.01%,100%{opacity:1}}
        @keyframes uaTalkMid{0%,20%{opacity:0}20.01%,40%{opacity:1}40.01%,60%{opacity:0}60.01%,80%{opacity:1}80.01%,100%{opacity:0}}
        /* Borda do balão = gradiente cônico de tons de AZUL girando ao redor */
        @property --uaAng{syntax:'<angle>';initial-value:0deg;inherits:false}
        .ua-bubble{position:relative}
        .ua-bubble::before{
          content:'';position:absolute;inset:-2px;border-radius:inherit;z-index:-1;
          background:conic-gradient(from var(--uaAng),${bubbleConic});
          animation:uaBorderSpin 3s linear infinite;
        }
        @keyframes uaBorderSpin{to{--uaAng:360deg}}
        @keyframes uaHeartbeat{0%,100%{transform:scale(1)}15%{transform:scale(1.28)}30%{transform:scale(1.02)}45%{transform:scale(1.22)}60%{transform:scale(1)}}
        body.uw-active .uniko-assistant{display:none!important}
      `}</style>

      {/* ── Robô: flutua, fica EXPANDIDO com balão, ARRASTÁVEL (clique abre, arraste move) ── */}
      <div style={{ animation: dragging ? 'none' : captureAlert && !open ? 'uaHeartbeat .85s ease-in-out infinite' : 'uaFloat 5s ease-in-out infinite', pointerEvents: 'auto' }}>
        <button
          onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
          onTouchStart={(e) => { if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title="Arraste pra mover · Toque pra falar com o UNIKO"
          style={{
            border: 'none', background: 'transparent', cursor: dragging ? 'grabbing' : 'grab', padding: 0, display: 'block',
            touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none',
            transform: `scale(${dragging ? 1 : (bubble && !open) ? 1.18 : hovered ? 1.12 : 1})`, transformOrigin: 'bottom left',
            transition: 'transform .35s cubic-bezier(.34,1.56,.64,1), filter .35s ease',
            filter: `drop-shadow(0 8px 22px ${T.goldLine || accent}${hovered && !dragging ? '99' : '55'})`,
          }}>
          <UnikoFace size={ICON} src={captureAlert && !open ? IMG.CAPTURE : sprite} talking={talking} skin={skin} />
        </button>
      </div>

      {/* ── Balão de fala (dicas/avisos/respostas com painel fechado) — DIGITANDO ── */}
      {bubble && !open && (
        <div style={{ pointerEvents: 'auto', position: 'absolute', ...(onLeft ? { left: ICON + 30 } : { right: ICON + 30 }), ...(onTop ? { top: 16 } : { bottom: 16 }), width: `min(300px, calc(100vw - ${ICON + 78}px))`, animation: 'uaPop .3s ease' }}>
          <div className="ua-bubble" style={{ background: panelBg, color: T.text || '#222', borderRadius: onLeft ? '16px 16px 16px 5px' : '16px 16px 5px 16px', padding: '13px 17px', boxShadow: T.shL || '0 10px 30px rgba(0,0,0,0.20)' }}>
            <div style={{ fontSize: 10, color: bubbleLabelColor, fontWeight: 800, letterSpacing: '.07em', marginBottom: 6 }}>UNIKO</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}><Typer text={bubble.text} onStart={() => setTalking(true)} onDone={() => setTalking(false)} /></div>
            {bubble.dismissable && (
              <button onClick={() => { const ok = bubble.onOk; setBubble(null); setSprite(null); ok && ok(); }}
                style={{ marginTop: 9, padding: '5px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${accent},${T.goldLine || accent})`, color: '#3a2a05', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Ok
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Painel de chat ── */}
      {open && (
        <div style={{ pointerEvents: 'auto', position: 'absolute', ...(onLeft ? { left: 0 } : { right: 0 }), ...(onTop ? { top: ICON + 22 } : { bottom: ICON + 22 }), width: 'min(360px, calc(100vw - 36px))', height: 440, maxHeight: 'calc(100vh - 160px)', background: panelBg, border: `1px solid ${T.border || 'rgba(0,0,0,.1)'}`, borderRadius: 18, boxShadow: '0 18px 60px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'uaPop .25s ease' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${T.border || 'rgba(0,0,0,.08)'}`, background: `linear-gradient(135deg,${accent}22,transparent)` }}>
            <div style={{ width: 30, height: 30, position: 'relative', flexShrink: 0 }}><UnikoFace size={30} src={sprite} talking={talking} skin={skin} /></div>
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
                {m.from === 'uniko' && i === messages.length - 1 ? <Typer text={m.text} onTick={scrollDown} onStart={() => setTalking(true)} onDone={() => setTalking(false)} /> : m.text}
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
