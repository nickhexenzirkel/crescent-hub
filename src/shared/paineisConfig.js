// Painéis e cards do Uniko que o admin liga/desliga pra TODO MUNDO (Dashboard RH
// → aba Painéis). Fica na tabela `settings` (key `paineis_config`, JSON string
// { ocultos: { idDoPainel: true } }). Nada configurado = tudo ligado. Isto é
// por cima do recorte de cargo: o cargo esconde pra um grupo, aqui esconde pra todos.
import { useState, useEffect } from 'react';
import { supabase } from '../contexts/user';

export const PAINEIS_KEY = 'paineis_config';
const EVENTO = 'uniko-paineis';

// Catálogo — a ordem é a da tela de configuração.
export const PAINEIS = [
  { grupo: 'Menu de módulos', itens: [
    { id: 'perfil',    label: 'Perfil e relógio',  desc: 'Card de boas-vindas com a foto, o relógio e os atalhos' },
    { id: 'eventos',   label: 'Eventos de hoje',   desc: 'Aparece só nos dias em que há evento na agenda' },
    { id: 'tarefas',   label: 'Tarefas de hoje',   desc: 'Saudação e checklist do dia (Minhas Tarefas)' },
    { id: 'caixa',     label: 'Caixa de entrada',  desc: 'Avisos, convites, horas lançadas e prismas recebidos' },
    { id: 'checkin',   label: 'Check-in',          desc: 'Check-in diário da Prisma Store' },
    { id: 'horas',     label: 'Banco de Horas',    desc: 'Saldo de horas extras e ponto' },
    { id: 'ponto',     label: 'Ponto Eletrônico',  desc: 'Últimas marcações do ponto' },
    { id: 'avisos',    label: 'Comunicados',       desc: 'Último comunicado e quantos estão sem ler' },
    { id: 'missoes',   label: 'Missões',           desc: 'Missões em andamento com barra de progresso' },
    { id: 'novidades', label: 'Novidades',         desc: 'Cartões que giram com as novidades do Uniko' },
  ] },
  { grupo: 'Em todo o sistema', itens: [
    { id: 'assistente', label: 'Assistente UNIKO', desc: 'Robô flutuante no canto da tela (FAQ, lembretes, avisos)' },
  ] },
];

let cache = null;                       // { idDoPainel: true } — null = ainda não carregou

const parse = (value) => {
  try {
    const cfg = typeof value === 'string' ? JSON.parse(value) : value;
    return cfg && typeof cfg.ocultos === 'object' && cfg.ocultos ? cfg.ocultos : {};
  } catch { return {}; }
};

const publicar = (ocultos) => {
  cache = ocultos;
  try { window.dispatchEvent(new CustomEvent(EVENTO)); } catch { /* ignora */ }
};

export async function loadPaineis() {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', PAINEIS_KEY).maybeSingle();
    publicar(data?.value ? parse(data.value) : {});
  } catch { if (cache === null) publicar({}); }
  return cache;
}

export async function savePaineis(ocultos) {
  const limpo = Object.fromEntries(Object.entries(ocultos).filter(([, v]) => v));
  const { error } = await supabase.from('settings').upsert(
    { key: PAINEIS_KEY, value: JSON.stringify({ ocultos: limpo, updatedAt: Date.now() }) },
    { onConflict: 'key' },
  );
  if (error) throw error;
  publicar(limpo);
}

/* { idDoPainel: true } dos painéis DESLIGADOS. {} enquanto carrega — melhor mostrar
   o painel por um instante do que piscar tudo escondido. */
export const usePaineisOcultos = () => {
  const [ocultos, setOcultos] = useState(cache || {});
  useEffect(() => {
    let vivo = true;
    const sync = () => { if (vivo && cache) setOcultos(cache); };
    window.addEventListener(EVENTO, sync);
    loadPaineis();
    return () => { vivo = false; window.removeEventListener(EVENTO, sync); };
  }, []);
  return ocultos;
};
