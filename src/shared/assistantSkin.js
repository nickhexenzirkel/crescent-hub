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
    edgeMargin: 12,  // distância das bordas da tela
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
    iconSize: 116,   // maior que o padrão (a arte tem mais detalhes/asas)
    edgeMargin: 26,  // afastado um pouco mais da borda
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

// Lista as VARIAÇÕES visuais de uma skin (carinhas/sprites) — usada na Coleção pra
// mostrar as "fotos" do Uniko (normal, piscando, alarme, alexa, etc.). Dedupe por imagem.
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

const userTag = () => { try { return getAuthUser()?.cpf || getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };
const KEY    = () => `uniko_assistant_skin_${userTag()}`;
const EV     = 'uniko-assistant-skin:changed';

// Chave no Supabase para a skin de um usuário (pelo nome normalizado)
const remoteKey = (name) => `user_skin_${(name || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

// Persiste a skin no Supabase (fire-and-forget) para todos os clientes verem
function syncSkinRemote(name, id) {
  const k = remoteKey(name);
  if (!k || k === 'user_skin_') return;
  supabase.from('settings')
    .upsert({ key: k, value: id || 'default' }, { onConflict: 'key' })
    .then(() => {}).catch(() => {});
}

export function getActiveAssistantSkinId() {
  const id = localStorage.getItem(KEY()) || 'default';
  // Sincroniza com Supabase uma vez por sessão se a skin for especial
  if (id !== 'default') {
    const tag = userTag();
    const syncFlagKey = `skin_remote_synced_${tag}`;
    if (!sessionStorage.getItem(syncFlagKey)) {
      sessionStorage.setItem(syncFlagKey, '1');
      syncSkinRemote(tag, id);
    }
  }
  return id;
}

export function setActiveAssistantSkin(id) {
  try { localStorage.setItem(KEY(), id || 'default'); } catch {}
  try { window.dispatchEvent(new CustomEvent(EV, { detail: id || 'default' })); } catch {}
  // Persiste no Supabase para que outros usuários vejam a skin correta
  const tag = userTag();
  if (tag && tag !== 'anon') {
    sessionStorage.setItem(`skin_remote_synced_${tag}`, '1');
    syncSkinRemote(tag, id || 'default');
  }
}

export function onAssistantSkinChange(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(EV, h);
  return () => window.removeEventListener(EV, h);
}

// Busca no Supabase a skin ativa de outro usuário (por nome)
export async function getRemoteSkinFor(name) {
  if (!name) return 'default';
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', remoteKey(name))
      .maybeSingle();
    return data?.value || 'default';
  } catch { return 'default'; }
}
