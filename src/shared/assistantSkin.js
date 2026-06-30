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
    blink: { open: '/UNIKO_NEW.png', mid: '/UNIKO_PISCA_FRAME_2.png', closed: '/UNIKO_PISCA.png' },
    // frames de boca (falando). Se a skin não tiver, usa só a base.
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
    blink: { open: '/UNIKO_VAMPROBOT.png', mid: '/UNIKO_VAMPROBOT_PISCAFRAME2.png', closed: '/UNIKO_VAMPROBOT_PISCAFRAME3.png' },
    mouth: null, // sem frames de boca → mostra a base ao "falar"
    sprites: {
      ALARME:  '/UNIKO_VAMPROBOT_ALARME.png',
      ATENCAO: enc('/UNIKO_VAMPROBOT_ATENÇÃO.png'),
      ALEXA:   '/UNIKO_VAMPROBOT_ALEXA.png',
      WAVE:    enc('/UNIKO_VAMPROBOT_ATENÇÃO.png'), // sem WAVE próprio → usa ATENÇÃO
      PRISMAC: '/UNIKO_VAMPROBOT_PRISMACOMUM.png',
      PRISMAP: '/UNIKO_VAMPROBOT_PRISMAPREMIUM.png',
      CAPTURE: '/UNIKO_VAMPROBOT_CAPTURAR.png',
    },
  },
};

export const getAssistantSkin = (id) => ASSISTANT_SKINS[id] || ASSISTANT_SKINS.default;

const userTag = () => { try { return getAuthUser()?.cpf || getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };
const KEY = () => `uniko_assistant_skin_${userTag()}`;
const EV = 'uniko-assistant-skin:changed';

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
