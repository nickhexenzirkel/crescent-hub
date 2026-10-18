// Modo sazonal (Dashboard RH → Painéis): 'nenhum' | 'halloween' | 'natal' —
// liga os temas temporários (ver contexts/theme.js) e os efeitos flutuantes
// (ver EfeitoSazonal.jsx) pra TODOS, em todos os temas. Mesmo padrão de
// paineisConfig.js/contrachequeModo.js: tabela `settings`, cache + evento,
// sem prop-drilling. 'nenhum' é o padrão.
import { useState, useEffect } from 'react';
import { supabase } from '../contexts/user';

export const MODO_SAZONAL_KEY = 'modo_sazonal';
const EVENTO = 'uniko-modo-sazonal';
const PADRAO = 'nenhum';
const VALIDOS = ['nenhum', 'halloween', 'natal'];

let cache = null; // null = ainda não carregou

const parseModo = (value) => {
  try { const v = typeof value === 'string' ? JSON.parse(value) : value; return VALIDOS.includes(v) ? v : PADRAO; }
  catch { return PADRAO; }
};

const publicar = (modo) => { cache = modo; try { window.dispatchEvent(new CustomEvent(EVENTO)); } catch { /* ignora */ } };

export async function loadModoSazonal() {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', MODO_SAZONAL_KEY).maybeSingle();
    publicar(data?.value ? parseModo(data.value) : PADRAO);
  } catch { if (cache === null) publicar(PADRAO); }
  return cache;
}

export async function saveModoSazonal(modo) {
  const v = VALIDOS.includes(modo) ? modo : PADRAO;
  const { error } = await supabase.from('settings').upsert({ key: MODO_SAZONAL_KEY, value: JSON.stringify(v) }, { onConflict: 'key' });
  if (error) throw error;
  publicar(v);
}

export const useModoSazonal = () => {
  const [modo, setModo] = useState(cache || PADRAO);
  useEffect(() => {
    let vivo = true;
    const sync = () => { if (vivo && cache) setModo(cache); };
    window.addEventListener(EVENTO, sync);
    loadModoSazonal();
    return () => { vivo = false; window.removeEventListener(EVENTO, sync); };
  }, []);
  return modo;
};
