// Visitante (Dashboard RH → "Configurar Visitante"): quais módulos e abas um
// visitante sem login/cadastro consegue entrar e ver (ver shared/visitante.js
// pra identidade — isto aqui é só o CATÁLOGO e a configuração, compartilhada
// por TODOS os visitantes). Fica na tabela `settings` (key `visitante_config`),
// mesmo padrão do paineisConfig.js (cache + evento, sem prop-drilling).
// Nada configurado ainda = os `padrao` abaixo, que reproduzem exatamente o
// comportamento fixo que o modo visitante já tinha antes desta tela existir
// (ver commit "Modo visitante: acesso sem login, só no front", 17/10/2026).
import { useState, useEffect } from 'react';
import { supabase } from '../contexts/user';

export const VISITANTE_CONFIG_KEY = 'visitante_config';
const EVENTO = 'uniko-visitante-config';

// Módulos que NUNCA entram aqui, mesmo pro admin configurar — dado real de
// RH, financeiro ou vigilância (pedido explícito do dono, 17/10/2026: ficam
// bloqueados sem exceção, nem aparecem na tela de configuração).
export const MODULOS_BLOQUEADOS = ['dashboard', 'ponto', 'uniko-safer', 'uniko-security', 'uniko-call', '7-beneficios', 'prestacao-contas'];

// Catálogo — cada módulo configurável, as abas de dentro dele (quando tem) e
// sub-seções (abas de dentro de uma aba, caso de Minhas Tarefas → Uniko Call).
// `padrao` é o estado inicial, antes de qualquer admin abrir esta tela.
export const CATALOGO = [
  {
    modulo: 'colaborador', label: 'Portal do Colaborador', padrao: true,
    abas: [
      { id: 'inicio',        label: 'Início',            padrao: true },
      { id: 'lembretes',     label: 'Minhas Tarefas',    padrao: true },
      { id: 'comunicados',   label: 'Comunicados',       padrao: true },
      { id: 'eventos',       label: 'Eventos',           padrao: true },
      { id: 'colegas',       label: 'Colegas',           padrao: true },
      { id: 'feedback',      label: 'Feedback',          padrao: true },
      { id: 'unikosuspect',  label: 'Uniko Detetive',    padrao: true },
      { id: 'unikowave',     label: 'Uniko Wave',        padrao: true },
      { id: 'unikopaint',    label: 'Uniko Paint',       padrao: true },
      { id: 'unikocamera',   label: 'Uniko Camera',      padrao: true },
      { id: 'unikostop',     label: 'Uniko Stop!',       padrao: true },
      { id: 'unikopalavras', label: 'Uniko Palavras',    padrao: true },
      { id: 'unikofaster',   label: 'Uniko Speed',       padrao: true },
      { id: 'dados',         label: 'Seus Dados',        padrao: false },
      { id: 'financeiro',    label: 'Financeiro',        padrao: false },
      { id: 'horas',         label: 'Banco de Horas',    padrao: false },
      { id: 'ponto',         label: 'Ponto Eletrônico',  padrao: false },
      { id: 'uniko',         label: 'Coleção',           padrao: false },
      { id: 'roleta',        label: 'Roleta da Sorte',   padrao: false },
      { id: 'quizmm',        label: 'Quiz do M&M',       padrao: false },
    ],
    subsecoes: [
      { chave: 'lembretes', label: 'Dentro de "Minhas Tarefas"', abas: [
        { id: 'tarefas',    label: 'Lista de Tarefas', padrao: true },
        { id: 'lembretes',  label: 'Lembretes',        padrao: true },
        { id: 'anotacoes',  label: 'Anotações',        padrao: true },
        { id: 'unikocall',  label: 'Uniko Call',       padrao: false },
      ] },
    ],
  },
  {
    modulo: 'alexa', label: 'Central Alexa', padrao: true,
    abas: [
      { id: 'festival', label: 'Festival',            padrao: true },
      { id: 'playlist', label: 'Playlist',            padrao: true },
      { id: 'maquina',  label: 'Máquina do Tempo',    padrao: true },
      { id: 'alexa',    label: 'Alexa (assistente)',  padrao: true },
    ],
  },
  {
    modulo: 'faturamento', label: 'Oficina Estelar', padrao: true,
    abas: [
      { id: 'pdf-editor',           label: 'Editor de PDF',              padrao: true },
      { id: 'pdf-organizar',        label: 'Organizar PDF',              padrao: true },
      { id: 'pdf-mesclar',          label: 'Mesclar PDF',                padrao: true },
      { id: 'xml',                  label: 'Controle de Notas',          padrao: false },
      { id: 'assinatura',           label: 'Assinatura Automática',      padrao: false },
      { id: 'historico-assinatura', label: 'Histórico de Assinatura',    padrao: false },
      { id: 'carta',                label: 'Carta de Correção',          padrao: false },
      { id: 'oficio-emissao',       label: 'Ofício de Emissão',          padrao: false },
      { id: 'empenho',              label: 'Empenho',                    padrao: false },
      { id: 'baixar-os',            label: 'Baixar Ordens de Serviço',   padrao: false },
      { id: 'controle-clientes',    label: 'Controle de Clientes',       padrao: false },
    ],
  },
  {
    modulo: 'mercado-estelar', label: 'Prisma Store', padrao: true,
    abas: [
      { id: 'loja',      label: 'Loja',       padrao: true },
      { id: 'colecao',   label: 'Coleção',    padrao: true },
      { id: 'missoes',   label: 'Missões',    padrao: true },
      { id: 'carteira',  label: 'Carteira',   padrao: true },
      { id: 'checkin',   label: 'Check-in',   padrao: true },
      { id: 'historico', label: 'Histórico',  padrao: true },
    ],
    acoes: [
      { id: 'comprar',       label: 'Comprar / resgatar item da loja',       padrao: false },
      { id: 'resgatarMissao', label: 'Resgatar recompensa de missão',        padrao: false },
      { id: 'fazerCheckin',  label: 'Fazer check-in diário',                 padrao: false },
    ],
  },
  {
    modulo: 'conexao-setorial', label: 'Trello (Conexão Setorial)', padrao: false,
    abas: [],
  },
  {
    modulo: 'uniko-fit', label: 'Uniko FIT', padrao: true,
    abas: [
      { id: 'paravoce',  label: 'Para Você',  padrao: true },
      { id: 'treinos',   label: 'Treinos',    padrao: true },
      { id: 'batepapo',  label: 'Bate-papo',  padrao: true },
      { id: 'buscar',    label: 'Buscar',     padrao: true },
      { id: 'meuperfil', label: 'Meu Perfil', padrao: true },
    ],
  },
  {
    modulo: 'info-adicional', label: 'Informações Adicionais', padrao: true,
    abas: [
      { id: 'instalar', label: 'Instalar App',   padrao: true },
      { id: 'sobre',    label: 'Sobre o Uniko',  padrao: true },
    ],
  },
];

export const MODULOS_CONFIGURAVEIS = CATALOGO.map(s => s.modulo);

const clone = (o) => JSON.parse(JSON.stringify(o));

function defaultsFromCatalogo() {
  const modulos = {}, abas = {}, acoesMercado = {};
  CATALOGO.forEach(sec => {
    modulos[sec.modulo] = !!sec.padrao;
    if (sec.abas?.length) abas[sec.modulo] = sec.abas.filter(a => a.padrao).map(a => a.id);
    (sec.subsecoes || []).forEach(sub => { abas[sub.chave] = sub.abas.filter(a => a.padrao).map(a => a.id); });
    (sec.acoes || []).forEach(a => { acoesMercado[a.id] = !!a.padrao; });
  });
  return { modulos, abas, acoesMercado };
}
const DEFAULTS = defaultsFromCatalogo();

function parseValue(value) {
  try {
    const cfg = typeof value === 'string' ? JSON.parse(value) : value;
    if (!cfg || typeof cfg !== 'object') return clone(DEFAULTS);
    return {
      modulos: { ...DEFAULTS.modulos, ...(cfg.modulos || {}) },
      abas: { ...DEFAULTS.abas, ...(cfg.abas || {}) },
      acoesMercado: { ...DEFAULTS.acoesMercado, ...(cfg.acoesMercado || {}) },
    };
  } catch { return clone(DEFAULTS); }
}

let cache = null; // null = ainda não carregou

const publicar = (cfg) => { cache = cfg; try { window.dispatchEvent(new CustomEvent(EVENTO)); } catch { /* ignora */ } };

export async function loadVisitanteConfig() {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', VISITANTE_CONFIG_KEY).maybeSingle();
    publicar(data?.value ? parseValue(data.value) : clone(DEFAULTS));
  } catch { if (cache === null) publicar(clone(DEFAULTS)); }
  return cache;
}

export async function saveVisitanteConfig(cfg) {
  const { error } = await supabase.from('settings').upsert(
    { key: VISITANTE_CONFIG_KEY, value: JSON.stringify(cfg) },
    { onConflict: 'key' },
  );
  if (error) throw error;
  publicar(cfg);
}

/* Config atual (cache || padrões, nunca null) — qualquer módulo chama direto,
   sem precisar receber nada por prop. */
export const useVisitanteConfig = () => {
  const [cfg, setCfg] = useState(cache || DEFAULTS);
  useEffect(() => {
    let vivo = true;
    const sync = () => { if (vivo && cache) setCfg(cache); };
    window.addEventListener(EVENTO, sync);
    loadVisitanteConfig();
    return () => { vivo = false; window.removeEventListener(EVENTO, sync); };
  }, []);
  return cfg;
};

// Abas liberadas pro visitante numa chave do catálogo (módulo, ou subseção
// como 'lembretes'). [] explícito (admin desligou tudo) é respeitado — só cai
// no padrão quando a chave nunca existiu na config salva.
export const abasVisitante = (cfg, chave) => cfg?.abas?.[chave] ?? DEFAULTS.abas[chave] ?? [];
export const moduloLiberadoVisitante = (cfg, moduloId) => !!cfg?.modulos?.[moduloId];
export const acaoLiberadaVisitante = (cfg, acaoId) => !!cfg?.acoesMercado?.[acaoId];
