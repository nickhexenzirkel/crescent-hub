// Dashboard RH → aba Contracheques: troca entre os dois jeitos de gerar o
// documento — 'manual' (admin anexa o PDF que o contador já fez, do jeito
// que sempre funcionou) ou 'uniko' (o próprio sistema monta o PDF, ainda em
// construção — ver vault/Sistema/contracheques.md quando essa parte nascer).
// Mesmo padrão do paineisConfig.js/visitanteConfig.js: tabela `settings`,
// cache + evento, sem prop-drilling. 'manual' é o padrão — nada muda pra
// quem nunca abrir esta troca.
import { useState, useEffect } from 'react';
import { supabase } from '../contexts/user';

export const CONTRACHEQUE_MODO_KEY = 'contracheque_modo';
const EVENTO = 'uniko-contracheque-modo';
const PADRAO = 'manual';

let cache = null; // null = ainda não carregou

const publicar = (modo) => { cache = modo; try { window.dispatchEvent(new CustomEvent(EVENTO)); } catch { /* ignora */ } };

// `value` pode voltar já como objeto/string nativa (coluna jsonb) ou como
// texto JSON — mesma defesa usada em paineisConfig.js/visitanteConfig.js.
const parseModo = (value) => {
  try { const v = typeof value === 'string' ? JSON.parse(value) : value; return v === 'uniko' ? 'uniko' : PADRAO; }
  catch { return PADRAO; }
};

export async function loadContrachequeModo() {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', CONTRACHEQUE_MODO_KEY).maybeSingle();
    publicar(data?.value ? parseModo(data.value) : PADRAO);
  } catch { if (cache === null) publicar(PADRAO); }
  return cache;
}

export async function saveContrachequeModo(modo) {
  const v = modo === 'uniko' ? 'uniko' : 'manual';
  const { error } = await supabase.from('settings').upsert({ key: CONTRACHEQUE_MODO_KEY, value: JSON.stringify(v) }, { onConflict: 'key' });
  if (error) throw error;
  publicar(v);
}

export const useContrachequeModo = () => {
  const [modo, setModo] = useState(cache || PADRAO);
  useEffect(() => {
    let vivo = true;
    const sync = () => { if (vivo && cache) setModo(cache); };
    window.addEventListener(EVENTO, sync);
    loadContrachequeModo();
    return () => { vivo = false; window.removeEventListener(EVENTO, sync); };
  }, []);
  return modo;
};
