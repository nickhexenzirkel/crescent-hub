// Config da "Mensagem Especial" da Máquina do Tempo (Central Alexa): a capa e o
// vídeo são escolhidos pelo RH no Dashboard e ficam guardados na tabela
// `settings` (key `mensagem_especial_config`, JSON string). A Central Alexa lê
// isso no mount; se não houver nada configurado, cai nos arquivos fixos v2 que
// já existiam em /public (fallback).
import { supabase as _supabase } from '../contexts/user';

export const MENSAGEM_ESPECIAL_KEY = 'mensagem_especial_config';

// Fallback: os arquivos fixos que já vinham hardcoded na Central Alexa.
export const MSG_ESPECIAL_FALLBACK = {
  coverUrl: '/mensagem-especial-capa-v2.png',
  videoUrl: '/mensagem-especial-video-v2.mp4',
};

export async function loadMensagemEspecial() {
  try {
    const { data } = await _supabase.from('settings').select('value').eq('key', MENSAGEM_ESPECIAL_KEY).maybeSingle();
    if (data?.value) {
      const cfg = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return {
        coverUrl: cfg.coverUrl || MSG_ESPECIAL_FALLBACK.coverUrl,
        videoUrl: cfg.videoUrl || MSG_ESPECIAL_FALLBACK.videoUrl,
      };
    }
  } catch {}
  return { ...MSG_ESPECIAL_FALLBACK };
}

export async function saveMensagemEspecial(cfg) {
  await _supabase.from('settings').upsert(
    { key: MENSAGEM_ESPECIAL_KEY, value: JSON.stringify({ ...cfg, updatedAt: Date.now() }) },
    { onConflict: 'key' },
  );
}
