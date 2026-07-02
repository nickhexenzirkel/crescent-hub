// src/shared/assistantSkin.js
// Skins do ASSISTENTE flutuante. O padrão é o UNIKO; ao capturar e "usar como assistente"
// um Uniko da coleção, o robô do canto vira aquele Uniko (mesmos comportamentos: piscar,
// dicas, avisos...). Cada skin mapeia seus sprites (piscar/boca/humor). Persiste por usuário.
import { getAuthUser } from '../contexts/user';

const enc = encodeURI; // alguns nomes têm acento (ATENÇÃO)

export const ASSISTANT_SKINS = {
  default: {
    id: 'default',
    name: 'UNIKO',
    accent: '#2196F3',
    iconSize: 84,    // tamanho do robô no canto (px)
    edgeMargin: 12,  // distância das bordas da tela
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
    edgeMargin: 12,
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
    edgeMargin: 26,
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
    edgeMargin: 14,
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

export function setActiveAssistantSkin(id) {
  try { localStorage.setItem(KEY(), id || 'default'); } catch {}
  try { window.dispatchEvent(new CustomEvent(EV, { detail: id || 'default' })); } catch {}
}

export function onAssistantSkinChange(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(EV, h);
  return () => window.removeEventListener(EV, h);
}
