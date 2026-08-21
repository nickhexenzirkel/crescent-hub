// src/shared/assistantSkin.js
// Skins do ASSISTENTE flutuante. O padrão é o UNIKO; ao capturar e "usar como assistente"
// um Uniko da coleção, o robô do canto vira aquele Uniko (mesmos comportamentos: piscar,
// dicas, avisos...). Cada skin mapeia seus sprites (piscar/boca/humor). Persiste por usuário.
import { getAuthUser, supabase } from '../contexts/user';

const enc = encodeURI; // alguns nomes têm acento (ATENÇÃO)

export const ASSISTANT_SKINS = {
  default: {
    id: 'default',
    name: 'UNIKO',
    accent: '#2196F3',
    iconSize: 84,    // tamanho do robô no canto (px)
    edgeMargin: 18,  // distância das bordas da tela (um pouco mais folgado — não fica embaixo da barra de rolagem)
    blink: { open: '/UNIKO_NEW.png', mid: '/UNIKO_PISCA_FRAME_2.png', closed: '/UNIKO_PISCA.png' },
    mouth: { closed: '/UNIKO_NEW.png', half: enc('/UNIKO_FRAME_BOCA_MEIO ABERTA.png'), open: enc('/UNIKO_FRAME_BOCA ABERTA.png') },
    sprites: {
      ALARME:  enc('/UNIKO_ALARME.png'),
      ATENCAO: enc('/UNIKO_ATENÇÃO.png'),
      ALEXA:   enc('/UNIKO_ALEXA.png'),
      WAVE:    enc('/UNIKO_WAVESIGN.png'),
      PRISMAC: enc('/UNIKO_PRISMACOMUM.png'),
      PRISMAP: enc('/UNIKO_PRISMAPREMIUM.png'),
      CAPTURE: enc('/UNIKO_CAPTURAR.png'),
    },
  },
  'uniko-comum': {
    id: 'uniko-comum',
    name: 'UNIKO Comum',
    accent: '#2196F3',
    iconSize: 84,
    edgeMargin: 18,
    blink: { open: '/UNIKO_NEW.png', mid: '/UNIKO_PISCA_FRAME_2.png', closed: '/UNIKO_PISCA.png' },
    mouth: { closed: '/UNIKO_NEW.png', half: enc('/UNIKO_FRAME_BOCA_MEIO ABERTA.png'), open: enc('/UNIKO_FRAME_BOCA ABERTA.png') },
    sprites: {
      ALARME:  enc('/UNIKO_ALARME.png'),
      ATENCAO: enc('/UNIKO_ATENÇÃO.png'),
      ALEXA:   enc('/UNIKO_ALEXA.png'),
      WAVE:    enc('/UNIKO_WAVESIGN.png'),
      PRISMAC: enc('/UNIKO_PRISMACOMUM.png'),
      PRISMAP: enc('/UNIKO_PRISMAPREMIUM.png'),
      CAPTURE: enc('/UNIKO_CAPTURAR.png'),
    },
  },
  'vampire-robot': {
    id: 'vampire-robot',
    name: 'Uniko Vampire-Robot',
    accent: '#c41e3a',
    iconSize: 116,
    edgeMargin: 30,
    blink: { open: '/UNIKO_VAMPROBOT.png', mid: '/UNIKO_VAMPROBOT_PISCAFRAME2.png', closed: '/UNIKO_VAMPROBOT_PISCAFRAME3.png' },
    mouth: null,
    sprites: {
      ALARME:  '/UNIKO_VAMPROBOT_ALARME.png',
      ATENCAO: enc('/UNIKO_VAMPROBOT_ATENÇÃO.png'),
      ALEXA:   '/UNIKO_VAMPROBOT_ALEXA.png',
      WAVE:    enc('/UNIKO_VAMPROBOT_ATENÇÃO.png'),
      PRISMAC: '/UNIKO_VAMPROBOT_PRISMACOMUM.png',
      PRISMAP: '/UNIKO_VAMPROBOT_PRISMAPREMIUM.png',
      CAPTURE: '/UNIKO_VAMPROBOT_CAPTURAR.png',
    },
  },
  'uniko-sereia': {
    id: 'uniko-sereia',
    name: 'Uniko Sereia',
    accent: '#2dd4bf',
    iconSize: 92,
    edgeMargin: 18,
    // Só 2 frames de arte (aberto/fechado) — o "mid" reusa o aberto (pisca rápido em vez de 3 estágios).
    blink: { open: '/uniko_sereia.png', mid: '/uniko_sereia.png', closed: '/uniko_sereia_olhosfechados.png' },
    // Enquanto fala (respondendo pergunta), alterna pro sprite "cantando".
    mouth: { closed: '/uniko_sereia.png', half: '/uniko_sereia_cantando.png', open: '/uniko_sereia_cantando.png' },
    // Sem arte própria por categoria (alarme/atenção/alexa/wave/prisma) → todo AVISO usa o
    // sininho de notificação; `tipSprite` (abaixo) cobre as DICAS com o coração.
    sprites: {
      ALARME:  enc('/uniko_sereia_notificação.png'),
      ATENCAO: enc('/uniko_sereia_notificação.png'),
      ALEXA:   enc('/uniko_sereia_notificação.png'),
      WAVE:    enc('/uniko_sereia_notificação.png'),
      PRISMAC: enc('/uniko_sereia_notificação.png'),
      PRISMAP: enc('/uniko_sereia_notificação.png'),
      CAPTURE: enc('/uniko_sereia_notificação.png'),
    },
    // Override usado pelas DICAS rotativas (TIPS) do UnikoAssistant — se ausente, cada skin
    // usa o ícone da própria categoria (comportamento padrão do UNIKO clássico/Vampire-Robot).
    tipSprite: enc('/uniko_sereia_coração.png'),
  },
};

// Skins da OFICINA DE UNIKO (criadas pelo admin, fora do código) — populadas em runtime
// por captureUniko.js (loadCustomUnikos), que lê a tabela custom_unikos do Supabase.
let _customSkins = {};
export function registerCustomSkin(id, skin) { _customSkins[id] = skin; }

export const getAssistantSkin = (id) => ASSISTANT_SKINS[id] || _customSkins[id] || ASSISTANT_SKINS.default;
// Existe skin de assistente pra esse id (fixa OU da Oficina)? Usado pra decidir se mostra
// o botão "Usar como assistente" — checar só `ASSISTANT_SKINS[id]` (como antes) ignorava
// os Unikos custom, que ficam num cache separado (_customSkins).
export const hasAssistantSkin = (id) => !!(ASSISTANT_SKINS[id] || _customSkins[id]);

export function getSkinVariations(id) {
  const s = ASSISTANT_SKINS[id] || _customSkins[id];
  if (!s) return [];
  const out = [];
  const push = (label, img) => { if (img && !out.some(o => o.img === img)) out.push({ label, img }); };
  push('Normal', s.blink.open);
  push('Piscando', s.blink.mid);
  push('Olhos fechados', s.blink.closed);
  if (s.mouth) push('Falando', s.mouth.open);
  push('Alarme', s.sprites.ALARME);
  push('Atenção', s.sprites.ATENCAO);
  push('Alexa', s.sprites.ALEXA);
  push('Uniko Wave', s.sprites.WAVE);
  push('Prisma Comum', s.sprites.PRISMAC);
  push('Prisma Premium', s.sprites.PRISMAP);
  push('Capturar', s.sprites.CAPTURE);
  if (s.tipSprite) push('Dica', s.tipSprite);
  return out;
}

// Chave canônica para a skin remota de um usuário (usado em index.jsx e TabMyDoko.jsx)
export const skinRemoteKey = (name) =>
  `user_skin_${(name || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

const userTag = () => { try { return getAuthUser()?.cpf || getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };
const KEY = () => `uniko_assistant_skin_${userTag()}`;
const EV  = 'uniko-assistant-skin:changed';

export function getActiveAssistantSkinId() {
  try { return localStorage.getItem(KEY()) || 'default'; } catch { return 'default'; }
}

// Só aplica local (localStorage + evento) — usado ao RECEBER a skin do banco, pra não
// disparar um novo upsert em cima do que acabou de chegar (loop bobo entre dispositivos).
function applyLocalSkin(id) {
  const val = id || 'default';
  try { if (localStorage.getItem(KEY()) === val) return; } catch {}
  try { localStorage.setItem(KEY(), val); } catch {}
  try { window.dispatchEvent(new CustomEvent(EV, { detail: val })); } catch {}
}

export function setActiveAssistantSkin(id) {
  const val = id || 'default';
  try { localStorage.setItem(KEY(), val); } catch {}
  try { window.dispatchEvent(new CustomEvent(EV, { detail: val })); } catch {}
  // Sincroniza com o banco pra qualquer outro dispositivo logado com o mesmo usuário
  // (celular/computador) receber a troca em tempo real — ver initAssistantSkinSync().
  try {
    const name = getAuthUser()?.name;
    if (name) supabase.from('settings').upsert({ key: skinRemoteKey(name), value: val }, { onConflict: 'key' }).then(() => {}, () => {});
  } catch {}
}

export function onAssistantSkinChange(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(EV, h);
  return () => window.removeEventListener(EV, h);
}

// Puxa a skin ativa do usuário do banco (se houver) e assina mudanças em tempo real — pra
// o Uniko escolhido em UM dispositivo (ex: celular) aparecer sozinho no outro (ex: computador),
// sem precisar reabrir o app. Chamado uma vez por sessão logada (ver App.jsx).
export function initAssistantSkinSync() {
  const name = getAuthUser()?.name;
  if (!name) return () => {};
  const key = skinRemoteKey(name);

  (async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
      if (data?.value) applyLocalSkin(data.value);
    } catch {}
  })();

  const channel = supabase.channel(`assistant-skin-${key}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${key}` }, (payload) => {
      const val = payload.new?.value;
      if (val) applyLocalSkin(val);
    })
    .subscribe();

  return () => { try { supabase.removeChannel(channel); } catch {} };
}

/* ── Tamanho do assistente ativo — QUALQUER usuário pode aumentar/diminuir o robô
   flutuante (Coleção → card "Assistente ativo"). Multiplicador local por usuário (não
   sincroniza entre dispositivos, igual à posição/dock), aplicado em cima do iconSize/
   edgeMargin da skin (fixo ou da Oficina) — não mexe no tamanho "de fábrica" do Uniko,
   só na preferência pessoal de exibição. ── */
export const ASSISTANT_SCALE_MIN = 0.6;
export const ASSISTANT_SCALE_MAX = 1.8;
export const ASSISTANT_SCALE_STEP = 0.1;
const SCALE_KEY = () => `uniko_assistant_scale_${userTag()}`;
const SCALE_EV  = 'uniko-assistant-scale:changed';

export function getAssistantScale() {
  try {
    const v = parseFloat(localStorage.getItem(SCALE_KEY()));
    if (!Number.isNaN(v) && v >= ASSISTANT_SCALE_MIN && v <= ASSISTANT_SCALE_MAX) return v;
  } catch {}
  return 1;
}

export function setAssistantScale(v) {
  const clamped = Math.max(ASSISTANT_SCALE_MIN, Math.min(ASSISTANT_SCALE_MAX, Math.round(v * 10) / 10));
  try { localStorage.setItem(SCALE_KEY(), String(clamped)); } catch {}
  try { window.dispatchEvent(new CustomEvent(SCALE_EV, { detail: clamped })); } catch {}
  return clamped;
}

export function onAssistantScaleChange(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(SCALE_EV, h);
  return () => window.removeEventListener(SCALE_EV, h);
}
