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
};

export const getAssistantSkin = (id) => ASSISTANT_SKINS[id] || ASSISTANT_SKINS.default;

export function getSkinVariations(id) {
  const s = ASSISTANT_SKINS[id];
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
