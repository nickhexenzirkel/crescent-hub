import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../contexts/theme';
import { supabase, SERVER_URL, getAuthUser } from '../../contexts/user';
import {
  DEFAULT_MISSIONS, loadMissionDefs, saveMissionDefs, loadMissionProgress, snapshotMissionBaseline,
  MISSION_METRICS, METRIC_META, MISSION_PERIODS, PLAYTIME_GAMES, GAME_LABEL,
} from '../../shared/prismaMissions';
import { Logo, AvatarCircle } from '../../shared/components';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  getAllUnikos, getUniko, saveCaptureToCollection, addToMyUnikoCollection,
  syncCollectionFromServer, fetchCapturesFor, loadCustomUnikos,
} from '../../shared/captureUniko';

/* ═══════════════════════════════════════════════════════════════════════════
   MERCADO ESTELAR — parte VISUAL (protótipo front-end).
   Estado fica em localStorage (me_state_v1). Sem backend/Supabase por enquanto.
   Dois tipos de Prisma:
     • Prisma Comum   → prêmios colecionáveis / cosméticos
     • Prisma Premium → prêmios grandes
   Recursos: Loja (prêmio destaque + grade, esgota ao comprar, busca e filtros),
   Missões, Carteira (saldo + enviar + trocar), Check-in diário e Histórico.
═══════════════════════════════════════════════════════════════════════════ */

// Cores fixas dos prismas (independem do tema para manter a identidade)
const COMUM   = { color: '#27C6DE', glow: 'rgba(39,198,222,0.18)', name: 'Prisma Comum' };
// Premium agora é ARCO-ÍRIS; a cor sólida (violeta) é só fallback p/ bordas/sombras
const PREMIUM = { color: '#9B6BFF', glow: 'rgba(155,107,255,0.20)', name: 'Prisma Premium' };
const RAINBOW = 'linear-gradient(100deg,#ff5e5e 0%,#ffa63d 17%,#ffe14d 34%,#5ed16a 51%,#4aa3ff 68%,#9b6bff 85%,#ff5ec4 100%)';

// Estilo de TEXTO: premium = arco-íris recortado no texto; comum = cor sólida
const prismText = (type) => type === 'premium'
  ? { background: RAINBOW, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
  : { color: COMUM.color };

// Interiores escuros (para destacar o prisma) por tipo
const DARK_PREMIUM = '#191328';
const DARK_COMUM   = '#0c1a1f';
// Borda ARCO-ÍRIS com interior escuro (respeita border-radius via duplo background)
const rainbowBorder = (radius, dark = DARK_PREMIUM) => ({
  border: '2px solid transparent', borderRadius: radius,
  background: `linear-gradient(${dark},${dark}) padding-box, ${RAINBOW} border-box`,
});
// Estilo de botão "comprar/resgatar": premium = borda arco-íris + fundo escuro;
// comum = preenchimento ciano; esgotado = cinza
const buyBtn = (type, sold, radius) => sold
  ? { background: T.surfaceSub || 'rgba(0,0,0,0.06)', color: T.textT, border: 'none', borderRadius: radius }
  : type === 'premium'
    ? { ...rainbowBorder(radius), color: '#fff' }
    : { background: `linear-gradient(135deg,${COMUM.color},${COMUM.color}bb)`, color: '#fff', border: 'none', borderRadius: radius };

// Taxa de troca: quantos Comuns valem 1 Premium
const EXCHANGE_RATE = 10;

// ── CHECK-IN: ciclo de 5 dias (SEGUNDA A SEXTA), ganhos que INTERCALAM a moeda ──
// O dia do ciclo vem do "streak" (dias ÚTEIS seguidos). Errar 1 dia útil zera → volta ao dia 1.
// Sábado/domingo não contam pra sequência nem pro ciclo (não tem check-in nesses dias).
//
// BUG CORRIGIDO (jul/2026, 1ª rodada): a versão anterior (70/90/120/160/200) somava 390
// Premium + 250 Comum JÁ NUMA ÚNICA SEMANA — ou seja, o teto MENSAL (MONTHLY_CAP: 300/200)
// era batido inteiro na primeira semana do mês, e o check-in ficava dando ZERO nas semanas
// seguintes até o mês virar.
//
// BUG CORRIGIDO (jul/2026, 2ª rodada): a redução pra 12/8/12/8/12 foi longe demais pro
// outro lado — o objetivo é que fazer check-in TODO dia útil do mês (4 semanas = 20 dias,
// 12 "premium" + 8 "comum" no ciclo) feche exatamente no teto mensal (300/200) no fim do
// mês. Com 12/8/12/8/12, 4 semanas davam só 144 Premium + 64 Comum — bem menos que o teto,
// então NINGUÉM alcançava os 300/200 mesmo com frequência perfeita o mês inteiro.
// A proporção 3 dias "premium" : 2 dias "comum" por ciclo já bate exatamente com a
// proporção do teto (300:200 = 3:2), então um valor ÚNICO por dia fecha a conta:
// 12 dias-premium × 25 = 300 · 8 dias-comum × 25 = 200 (considerando 4 ciclos de 5 dias
// úteis = 1 mês). Meses com mais de 20 dias úteis simplesmente batem o teto um pouco antes
// do fim (capRemaining já trata isso, dando 0 no que exceder).
const CHECKIN_CYCLE = [
  { amount: 25, cur: 'premium' }, // dia 1 (segunda)
  { amount: 25, cur: 'comum'   }, // dia 2 (terça)
  { amount: 25, cur: 'premium' }, // dia 3 (quarta)
  { amount: 25, cur: 'comum'   }, // dia 4 (quinta)
  { amount: 25, cur: 'premium' }, // dia 5 (sexta)
];
// Teto MENSAL de ganho do check-in por moeda (mesmo intercalando)
const MONTHLY_CAP = { premium: 300, comum: 200 };
const cycleReward = (streak) => CHECKIN_CYCLE[((streak - 1) % CHECKIN_CYCLE.length + CHECKIN_CYCLE.length) % CHECKIN_CYCLE.length];
// NÃO são os dias da semana de verdade — são a posição 1-5 dentro da SEQUÊNCIA
// (streak) de cada pessoa, que pode começar em qualquer dia útil (não só segunda).
// Rotular como "Segunda/Terça/..." era enganoso: quem começou a sequência numa
// quarta via a posição 1 chamada "Segunda", mesmo tendo resgatado numa quarta de
// verdade. "Dia 1..5" reflete o que o sistema realmente conta.
const WEEKDAY_LABELS = ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5'];

const isWeekend = (d) => { const wd = d.getDay(); return wd === 0 || wd === 6; };
// Dia útil anterior a `d` (pula sábado/domingo) — usado tanto pra saber se hoje é dia
// de check-in quanto pra contar a sequência sem que o fim de semana aparente "falta".
const prevWeekday = (d) => { const p = new Date(d); do { p.setDate(p.getDate() - 1); } while (isWeekend(p)); return p; };

// Quantos dias ÚTEIS seguidos (contando hoje) terá o próximo check-in.
// Anda pra trás só por dias de SEMANA (fins de semana nunca contam como "falta");
// se o dia útil anterior não tem check-in, a sequência recomeça em 1.
const computeStreak = (checkins) => {
  const set = new Set(checkins || []);
  let streak = 1; let d = prevWeekday(new Date());
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d = prevWeekday(d); }
  return streak;
};

const MONTH_NAMES =['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad2 = (n) => String(n).padStart(2, '0');

// BUG CORRIGIDO: essa chave era FIXA (global), sem o nome do usuário — em
// qualquer máquina/navegador usado por mais de uma pessoa (ou ao trocar de
// conta no mesmo navegador), o cache local de UM colaborador vazava pro
// próximo que logasse ali. Como o "conflito local x nuvem" (ver hidratação
// abaixo) confia em quem tem o `updatedAt` mais recente, o cache errado
// (de outra pessoa, geralmente mais "vazio") podia parecer mais novo e
// SOBRESCREVER o progresso real do colaborador (prismas do check-in,
// missões resgatadas) ao recarregar a página. Agora a chave inclui o nome.
const storageUserTag = () => { try { return getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };
const STORAGE_KEY = () => `me_state_v2_${storageUserTag()}`;

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

const COLABORADORES = [
  'Alan Matos', 'Brenda Késia', 'Cleanderson Pereira', 'Gleydson Marques',
  'Guilherme Alves', 'Karina Barbosa', 'Mara Almeida', 'Maria Renata', 'Mikael Araújo',
];

// Busca a lista completa de colaboradores no backend (mesma fonte da aba Colegas)
const fetchTeamNames = async () => {
  try {
    const r = await fetch(`${SERVER_URL}/api/team`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('ch_token') || ''}` } });
    if (!r.ok) { console.error('[prisma-store] /api/team respondeu', r.status); return null; }
    const d = await r.json();
    const names = (d.employees || []).filter(e => e.active !== false).map(e => e.name).filter(Boolean);
    if (names.length) return names;
    console.error('[prisma-store] /api/team voltou sem colaboradores:', d);
  } catch (e) { console.error('[prisma-store] falha ao buscar /api/team:', e); }
  return null;
};

// Hook: TODOS os colaboradores (backend + carteiras já existentes + fallback fixo)
const useAllPlayers = () => {
  const [list, setList] = useState(COLABORADORES);
  useEffect(() => {
    let alive = true;
    (async () => {
      // COLABORADORES é um array antigo com nomes CURTOS (ex.: "Alan Matos", "Brenda
      // Késia"), de antes da API /api/team existir. Antes ele era SEMPRE somado com o
      // time real (que tem os nomes completos e atuais, ex.: "Alan Matos Paixão") —
      // como são strings diferentes pra mesma pessoa, ela aparecia 2x na lista. Agora
      // COLABORADORES só entra se a busca no time real falhar de verdade (fallback).
      const team = await fetchTeamNames();
      const out = new Set(team && team.length ? team : COLABORADORES);
      try { const { data } = await supabase.from('mercado_state').select('player'); (data || []).forEach(r => r.player && out.add(r.player)); } catch {}
      if (alive) setList([...out].filter(Boolean).sort((a, b) => a.localeCompare(b)));
    })();
    return () => { alive = false; };
  }, []);
  return list;
};

// Credita prismas na carteira de OUTRO usuário + registra no histórico dele.
// BUG CORRIGIDO (jul/2026): fazia select-soma-regrava do `data` inteiro — se o
// destinatário tivesse a Prisma Store aberta (ela regravava o `data` inteiro por
// cima, às cegas, a cada 400ms), esse crédito podia ser apagado junto com
// check-in/missões dele. Agora usa a RPC `mercado_credit` (incremento atômico,
// só de comum/premium — ver supabase_mercado_credit_atomico.sql).
const creditPlayer = async (player, cur, amount, descr) => {
  await supabase.rpc('mercado_credit', { p_player: player, p_comum: cur === 'comum' ? amount : 0, p_premium: cur === 'premium' ? amount : 0 });
  await supabase.from('mercado_history').insert({ player, kind: 'envio', descr, [cur]: amount });
};

const RARITY_COLOR = {
  'Comum':    '#7A92A8',
  'Raro':     '#2E8DD4',
  'Épico':    '#9B6FE8',
  'Lendário': '#F5B63A',
};

const DEFAULT_STATE = {
  comum: 0,
  premium: 0,
  checkins: [],
  collection: [],
  // Controle do teto mensal do check-in (reinicia a cada mês)
  capMonth: '',
  earned: { premium: 0, comum: 0 },
  // Carimbo da última alteração FEITA pelo usuário (resolve conflito local x Supabase)
  updatedAt: 0,
  // Data de expiração dos prêmios deste mês (YYYY-MM-DD) — global, definida pelo admin
  expiresAt: '',
  // Catálogo de prêmios reais. Regra de moeda: Comum/Raro = Prisma Comum;
  // Épico/Lendário = Prisma Premium (os mais caros).
  items: [
    { id: 'p_pix200',  name: 'PIX de R$ 200',                  desc: 'Transferência PIX de R$ 200,00 direto na sua conta.',              price: 950, cur: 'premium', stock: 2, rarity: 'Lendário', emoji: '💸', featured: true },
    { id: 'p_smart',   name: 'Smartwatch',                     desc: 'Relógio inteligente com monitor de atividades e notificações.',     price: 900, cur: 'premium', stock: 1, rarity: 'Lendário', emoji: '⌚' },
    { id: 'p_vr',      name: 'Óculos VR Box 2.0',              desc: 'Óculos de realidade virtual VR Box 2.0 para o celular.',           price: 850, cur: 'premium', stock: 1, rarity: 'Lendário', emoji: '🥽' },
    { id: 'p_pix100',  name: 'PIX de R$ 100',                  desc: 'Transferência PIX de R$ 100,00 direto na sua conta.',              price: 520, cur: 'premium', stock: 3, rarity: 'Épico',    emoji: '💵' },
    { id: 'p_uber',    name: 'Recarga Uber R$ 100',            desc: 'Crédito de R$ 100,00 na sua conta Uber.',                          price: 510, cur: 'premium', stock: 2, rarity: 'Épico',    emoji: '🚗' },
    { id: 'p_cea',     name: 'Cartão Presente C&A',            desc: 'Cartão presente C&A para compras nas lojas e no app.',             price: 500, cur: 'premium', stock: 2, rarity: 'Épico',    emoji: '🛍️' },
    { id: 'p_center',  name: '2 Ingressos Centerplex',         desc: 'Par de ingressos de cinema na rede Centerplex.',                   price: 620, cur: 'comum',   stock: 5, rarity: 'Raro',     emoji: '🎬' },
    { id: 'p_casapiu', name: 'Cartão Presente Casa Piu',       desc: 'Cartão presente Casa Piu para sua casa.',                          price: 700, cur: 'comum',   stock: 1, rarity: 'Raro',     emoji: '🏠' },
    { id: 'p_mochila', name: 'Mochila Casual',                 desc: 'Mochila casual resistente para o dia a dia.',                      price: 560, cur: 'comum',   stock: 2, rarity: 'Raro',     emoji: '🎒' },
    { id: 'p_recarga', name: 'Recarga de Celular R$ 50',       desc: 'Recarga de R$ 50,00 para a operadora que você escolher.',          price: 300, cur: 'comum',   stock: 3, rarity: 'Comum',    emoji: '📱' },
    { id: 'p_fone',    name: 'Fone QKZ AK6 Intra-auricular',   desc: 'Fone de ouvido intra-auricular QKZ AK6 com cabo.',                 price: 280, cur: 'comum',   stock: 5, rarity: 'Comum',    emoji: '🎧' },
    { id: 'p_body',    name: 'Body Splash WePink',             desc: 'Body splash WePink — perfumaria.',                                 price: 260, cur: 'comum',   stock: 3, rarity: 'Comum',    emoji: '🧴' },
  ],
  // DESAFIOS — aqui ficam só os REGISTROS DE RESGATE do usuário ({ id, claimed,
  // claimedAt }). A definição da missão (título/meta/recompensa) é GLOBAL e vem
  // da tabela mercado_missions (ver missionDefs abaixo): guardar a definição
  // dentro do save de cada pessoa fazia com que mudar o valor de uma missão no
  // admin não chegasse a quem já tinha um save antigo.
  missions: [],
  // Baseline de reset das missões acumulativas (admin "Zerar missões"): { [id]: { v, d } }.
  // O progresso ao vivo (Voz ativa/Maratona) conta só o que vier DEPOIS deste ponto.
  missionBaseline: {},
  history: [
    { id: 'h0', kind: 'checkin', desc: 'Check-in diário', premium: 50, date: '2026-06-20' },
  ],
};

// Só o que é DO USUÁRIO numa missão: se resgatou e quando. O resto (título,
// meta, recompensa) é global e mora em mercado_missions.
const claimRecords = (arr) => (Array.isArray(arr) ? arr : [])
  .filter(m => m && m.id)
  .map(m => ({ id: m.id, claimed: !!m.claimed, claimedAt: m.claimedAt || '' }));

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY());
    if (raw) {
      const s = JSON.parse(raw);
      // Catálogo de itens: o admin gerencia (adiciona/edita/remove), então o save
      // é a fonte da verdade; só cai no DEFAULT na 1ª vez (sem itens salvos).
      const items = Array.isArray(s.items) && s.items.length ? s.items : DEFAULT_STATE.items;
      // Missões: fica só o resgate. Saves antigos guardavam a definição inteira
      // junto — descartada aqui, senão uma missão apagada/reajustada no admin
      // continuaria ressuscitando a partir do cache local.
      const missions = claimRecords(s.missions);
      // Migra saves antigos (que tinham só lastCheckin) para a lista de check-ins
      const checkins = Array.isArray(s.checkins) ? s.checkins : (s.lastCheckin ? [s.lastCheckin] : []);
      return { ...DEFAULT_STATE, ...s, checkins, items, missions };
    }
  } catch {}
  return DEFAULT_STATE;
};

// ─── Ícone do Prisma (arte em public/) ─────────────────────────────────────
const PRISM_SRC = { comum: '/PrismaComum.png', premium: '/PrismaPremium.png' };
const PrismIcon = ({ type = 'comum', size = 22 }) => {
  const c = type === 'premium' ? PREMIUM.color : COMUM.color;
  return (
    <img src={PRISM_SRC[type] || PRISM_SRC.comum} alt={type === 'premium' ? 'Prisma Premium' : 'Prisma Comum'}
      width={size} height={size}
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', filter: `drop-shadow(0 1px 4px ${c}66)` }} />
  );
};

// ─── Ícones SVG (herdam a cor via currentColor) ────────────────────────────
const Svg = ({ size = 16, children, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>{children}</svg>
);
const IcoCart    = (p) => <Svg {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></Svg>;
const IcoTrophy  = (p) => <Svg {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" /><path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3" /></Svg>;
const IcoTarget  = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></Svg>;
const IcoGem     = (p) => <Svg {...p}><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M8 3l-2 6 6 12 6-12-2-6" /></Svg>;
const IcoCalendar= (p) => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Svg>;
const IcoReceipt = (p) => <Svg {...p}><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /></Svg>;
const IcoShield  = (p) => <Svg {...p}><path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" /></Svg>;
const IcoGift    = (p) => <Svg {...p}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></Svg>;
const IcoCheck   = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12" /></Svg>;
const IcoClock   = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></Svg>;
const IcoStar    = (p) => <Svg {...p} fill="currentColor" stroke="none"><path d="M12 2l2.6 6.6L22 9.3l-5 4.6 1.4 7.1L12 17.8 5.6 21l1.4-7.1-5-4.6 7.4-.7z" /></Svg>;
const IcoSend    = (p) => <Svg {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Svg>;
const IcoSwap    = (p) => <Svg {...p}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></Svg>;
const IcoSearch  = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
const IcoLock    = (p) => <Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></Svg>;
const IcoPlus    = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
const IcoTrash   = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></Svg>;

const PrismChip = ({ type, amount }) => {
  const prem = type === 'premium';
  const base = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', fontWeight: 800, fontSize: 14, color: '#fff' };
  const style = prem
    ? { ...base, ...rainbowBorder(999) }
    : { ...base, borderRadius: 999, border: `2px solid ${COMUM.color}`, background: DARK_COMUM };
  return (
    <span style={style}>
      <PrismIcon type={type} size={22} />{fmt(amount)}
    </span>
  );
};

// ── Mapeamento estado ↔ Supabase ──
// BUG CORRIGIDO (jul/2026): USER_SLICE incluía comum/premium — como ela alimenta
// os saves "às cegas" (debounced + persistNow, que regravam o `data` inteiro por
// cima do que estiver no banco), qualquer crédito feito por FORA dessa aba (Capture
// o Uniko, presente do RH, admin) no meio do caminho era apagado no save seguinte.
// comum/premium agora são creditados só via mercado_credit (RPC atômica, ver
// supabase_mercado_credit_atomico.sql) e NUNCA fazem parte do save genérico — o
// banco é a única fonte de verdade pra eles, ver `applyCredit`/hidratação abaixo.
const USER_SLICE = (s) => ({ checkins: s.checkins || [], capMonth: s.capMonth || '', earned: s.earned || { premium: 0, comum: 0 }, collection: s.collection || [], missions: claimRecords(s.missions), missionBaseline: s.missionBaseline || {}, updatedAt: s.updatedAt || 0 });
// Linha "fake" da tabela mercado_state usada só pra guardar config GLOBAL (ex.: expiração)
const CONFIG_PLAYER = '__mercado_config__';
const itemToRow = (it, idx) => ({ id: it.id, name: it.name, descr: it.desc || '', price: it.price, cur: it.cur, stock: it.stock, rarity: it.rarity, emoji: it.emoji || '🎁', featured: !!it.featured, images: prizeImages(it), sort: idx, uniko_id: it.unikoId || null, updated_at: new Date().toISOString() });
const itemFromRow = (r) => ({ id: r.id, name: r.name, desc: r.descr || '', price: r.price, cur: r.cur, stock: r.stock, rarity: r.rarity, emoji: r.emoji || '🎁', featured: !!r.featured, images: Array.isArray(r.images) ? r.images : [], unikoId: r.uniko_id || null });
const histFromRow = (r) => ({ id: r.id, kind: r.kind, desc: r.descr, comum: r.comum, premium: r.premium, date: (r.created_at || '').slice(0, 10) });

const MercadoEstelar = ({ onBack, authUser, userPhoto }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('loja');
  const [state, setState] = useState(loadState);
  const [toast, setToast] = useState('');
  const [loaded, setLoaded] = useState(false); // já hidratou do Supabase?
  // Definições das missões (GLOBAIS, tabela mercado_missions) — o admin edita em
  // Administrador → Missões. Começa nos padrões pra a aba nunca abrir vazia.
  const [missionDefs, setMissionDefs] = useState(() => DEFAULT_MISSIONS.map(m => ({ ...m, active: true })));

  const cardBg = T.surface;
  const userName = authUser?.name || 'Colaborador';
  const isAdmin = authUser?.role === 'admin';

  // Cache local (pintura instantânea / offline)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY(), JSON.stringify(state)); } catch {}
  }, [state]);

  // ── Hidrata do Supabase (catálogo + estado do usuário + histórico) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let { data: rows } = await supabase.from('mercado_items').select('*').order('sort');
        let items;
        if (rows && rows.length) items = rows.map(itemFromRow);
        else { items = DEFAULT_STATE.items; await supabase.from('mercado_items').upsert(DEFAULT_STATE.items.map(itemToRow)); }

        // Config GLOBAL (data de expiração dos prêmios deste mês)
        const { data: cfgRow } = await supabase.from('mercado_state').select('data').eq('player', CONFIG_PLAYER).maybeSingle();
        const expiresAt = cfgRow?.data?.expiresAt || '';

        const { data: st } = await supabase.from('mercado_state').select('data').eq('player', userName).maybeSingle();
        let user = st?.data && Object.keys(st.data).length ? st.data : null;
        if (!user) { user = { ...USER_SLICE(DEFAULT_STATE), comum: 0, premium: 0 }; await supabase.from('mercado_state').upsert({ player: userName, data: user, updated_at: new Date().toISOString() }); }

        const { data: hist } = await supabase.from('mercado_history').select('*').eq('player', userName).order('created_at', { ascending: false }).limit(120);
        if (!alive) return;

        // Resolve conflito local x nuvem: se o progresso LOCAL é mais recente (ex.: o save foi
        // perdido por sair da página antes do upsert), mantém o local e reenvia pro Supabase.
        // comum/premium NUNCA vêm do local — são creditados só via RPC atômica (mercado_credit),
        // então o banco é sempre a fonte de verdade pra eles, independente de quem "ganhou" aqui.
        const local = loadState();
        const localNewer = (local.updatedAt || 0) > (user.updatedAt || 0);
        const chosen = localNewer ? local : user;
        const missions = claimRecords(chosen.missions);
        setState(s => ({ ...DEFAULT_STATE, ...chosen, comum: user.comum || 0, premium: user.premium || 0, missions, items, history: (hist || []).map(histFromRow), expiresAt }));
        if (localNewer) { try { await supabase.rpc('mercado_patch_state', { p_player: userName, p_patch: USER_SLICE(local) }); } catch {} }
      } catch {}
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  // ── Definições das missões (tabela global mercado_missions) ──
  useEffect(() => {
    let alive = true;
    loadMissionDefs().then(defs => { if (alive && defs?.length) setMissionDefs(defs); });
    return () => { alive = false; };
  }, []);

  // ── Unikos à venda: são itens normais do catálogo (item.unikoId setado) — só
  // precisamos saber quais o usuário JÁ possui (capture_uniko_captures), pra
  // desabilitar "Comprar" e mostrar "Já possui" nesses itens específicos ──
  const [ownedUnikoIds, setOwnedUnikoIds] = useState(new Set());
  useEffect(() => {
    let alive = true;
    (async () => {
      const [rows] = await Promise.all([fetchCapturesFor(userName), loadCustomUnikos()]);
      if (!alive) return;
      setOwnedUnikoIds(new Set(rows.map(r => r.uniko_id)));
    })();
    return () => { alive = false; };
  }, [userName]);

  // Persiste o "resto" do estado (check-in/coleção/desafios, SEM comum/premium —
  // ver USER_SLICE) — debounced, 400ms depois da última mudança. Usa a RPC
  // `mercado_patch_state` (MERGE no banco, `data || patch`) em vez de upsert direto:
  // como o patch nunca contém comum/premium, esse save nunca pode apagar um
  // crédito atômico (mercado_credit) que tenha acontecido no meio do caminho —
  // ver supabase_mercado_credit_atomico.sql. Loga erro em vez de engolir
  // silenciosamente (RLS, rede etc.) — antes não tinha como saber; o progresso
  // "sumia" sem deixar rastro nenhum no console.
  useEffect(() => {
    if (!loaded) return;
    const patch = USER_SLICE(state);
    const t = setTimeout(() => {
      supabase.rpc('mercado_patch_state', { p_player: userName, p_patch: patch })
        .then(({ error }) => { if (error) console.error('[prisma-store] falha ao salvar estado (debounced):', error); });
    }, 400);
    return () => clearTimeout(t);
  }, [loaded, state.updatedAt, state.checkins, state.capMonth, state.earned, state.collection, state.missions]); // eslint-disable-line

  // Salva IMEDIATAMENTE (sem esperar o debounce de 400ms) — usado só por ações
  // que mudam check-in/missão/coleção na hora: se a pessoa atualizar a página
  // logo em seguida, não corre o risco de perder o resgate por causa do atraso.
  // comum/premium são creditados à parte, via applyCredit (RPC atômica) — nunca
  // fazem parte desse patch.
  const persistNow = (nextState) => {
    supabase.rpc('mercado_patch_state', { p_player: userName, p_patch: USER_SLICE(nextState) })
      .then(({ error }) => { if (error) console.error('[prisma-store] falha ao salvar estado (imediato):', error); });
  };

  // Credita comum/premium de forma ATÔMICA (RPC mercado_credit) — nunca toca no
  // resto do `data`, então nunca apaga check-in/missão/coleção de uma escrita
  // concorrente (Capture o Uniko, presente do RH, admin), e vice-versa.
  const applyCredit = (deltaComum, deltaPremium) => {
    supabase.rpc('mercado_credit', { p_player: userName, p_comum: deltaComum || 0, p_premium: deltaPremium || 0 })
      .then(({ error }) => { if (error) console.error('[prisma-store] falha ao creditar prisma:', error); });
  };

  // Persiste o catálogo (upsert dos itens + remove os apagados)
  const prevItemIds = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await supabase.from('mercado_items').upsert(state.items.map(itemToRow));
        const ids = state.items.map(i => i.id);
        if (prevItemIds.current) { const removed = prevItemIds.current.filter(id => !ids.includes(id)); if (removed.length) await supabase.from('mercado_items').delete().in('id', removed); }
        prevItemIds.current = ids;
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [loaded, state.items]); // eslint-disable-line

  // ── Tracking REAL das missões: progresso ao vivo a partir de dados do Supabase/histórico ──
  // (minutos jogados, compras, coleção, ranking da Alexa e feedback — ver a métrica
  // de cada missão em prismaMissions.js).
  const [liveProg, setLiveProg] = useState({});
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    (async () => {
      const purchases = (state.history || []).filter(h => h.kind === 'compra' || h.kind === 'compra_uniko').length;
      const prog = await loadMissionProgress({ userName, cpf: authUser?.cpf, purchases, baseline: state.missionBaseline, missions: missionDefs });
      if (alive) setLiveProg(prog);
    })();
    return () => { alive = false; };
  }, [loaded, state.history, userName, state.missionBaseline, missionDefs]); // eslint-disable-line

  // Missões com progresso AO VIVO + resgate que REINICIA por período (diária=por dia,
  // mensal=por mês, única=pra sempre). claimedAt guarda quando foi resgatada.
  const missionsLive = (() => {
    const td = todayStr(), mo = td.slice(0, 7);
    const recs = new Map((state.missions || []).map(x => [x.id, x]));
    const stillClaimed = (def, rec) => {
      if (!rec?.claimed) return false;
      if (def.period === 'dia') return rec.claimedAt === td;
      if (def.period === 'mes') return (rec.claimedAt || '').slice(0, 7) === mo;
      return true; // única
    };
    return missionDefs.filter(m => m.active !== false).map(def => ({
      ...def,
      progress: liveProg[def.id] || 0,
      claimed: stillClaimed(def, recs.get(def.id)),
    }));
  })();

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  const addHistory = async (entry) => {
    setState(s => ({ ...s, history: [{ id: 'h' + Date.now(), date: todayStr(), ...entry }, ...s.history] }));
    // Antes disparava o insert sem aguardar nem checar erro — uma falha (RLS, coluna
    // errada etc.) sumia em silêncio e a compra "funcionava" pro usuário mas nunca
    // aparecia pro admin em Transações. Agora aguarda e loga se der erro de verdade.
    const { error } = await supabase.from('mercado_history').insert({ player: userName, kind: entry.kind, descr: entry.desc, comum: entry.comum ?? null, premium: entry.premium ?? null });
    if (error) console.error('[mercado-estelar] addHistory falhou:', error);
  };

  // Prêmios expiram na data definida pelo admin (compara YYYY-MM-DD)
  const prizesExpired = !!state.expiresAt && todayStr() > state.expiresAt;

  // ── Compra na loja — prêmio físico OU Uniko (item.unikoId setado), mesma lista, mesmo
  // botão. Prêmio físico: baixa estoque, some da carteira, entra na Coleção da loja.
  // Uniko: some da carteira, entra na Coleção da loja (igual um prêmio) E ganha
  // ownership de verdade (capture_uniko_captures), reaproveitando o mesmo caminho
  // de uma captura — assim aparece tanto aqui quanto na Coleção de Unikos do
  // Portal. O estoque agora é configurável pelo admin (edição limitada) — baixa
  // igual a um prêmio físico, além da checagem de "já possui" (não pode comprar
  // o mesmo Uniko duas vezes mesmo se ainda tiver estoque). ──
  const buyItem = async (item) => {
    const isUniko = !!item.unikoId;
    if (isUniko) {
      if (ownedUnikoIds.has(item.unikoId)) { flash('Você já tem esse Uniko na sua Coleção!'); return; }
      if (item.stock <= 0) { flash('Esse Uniko esgotou.'); return; }
    } else {
      if (item.stock <= 0) return;
      if (prizesExpired) { flash('Os prêmios deste mês já expiraram.'); return; }
    }
    const bal = state[item.cur];
    if (bal < item.price) { flash(`Saldo de ${item.cur === 'premium' ? PREMIUM.name : COMUM.name} insuficiente`); return; }
    setState(s => {
      const ex = (s.collection || []).find(c => c.id === item.id);
      const collection = ex
        ? s.collection.map(c => c.id === item.id ? { ...c, qty: c.qty + 1, date: todayStr() } : c)
        : [{ id: item.id, name: item.name, emoji: item.emoji, images: prizeImages(item), rarity: item.rarity, cur: item.cur, qty: 1, date: todayStr() }, ...(s.collection || [])];
      return {
        ...s,
        [item.cur]: s[item.cur] - item.price,
        items: s.items.map(i => i.id === item.id ? { ...i, stock: i.stock - 1 } : i),
        collection,
        updatedAt: Date.now(),
      };
    });
    applyCredit(item.cur === 'comum' ? -item.price : 0, item.cur === 'premium' ? -item.price : 0);
    addHistory({ kind: isUniko ? 'compra_uniko' : 'compra', desc: `Comprou “${item.name}”`, [item.cur]: -item.price });
    flash(`Você resgatou: ${item.name}`);
    if (isUniko) {
      setOwnedUnikoIds(prev => new Set([...prev, item.unikoId]));
      const uniko = getUniko(item.unikoId);
      await saveCaptureToCollection(uniko);
      addToMyUnikoCollection(uniko);
      syncCollectionFromServer();
    }
  };

  // ── Check-in (streak + ciclo de 5 dias úteis + teto mensal por moeda) ──
  const today = todayStr();
  const monthKey = today.slice(0, 7);
  const todayIsWeekend = isWeekend(new Date());
  const canCheckin = !todayIsWeekend && !(state.checkins || []).includes(today);
  const streak = computeStreak(state.checkins);                 // dia do ciclo que o check-in de hoje terá
  const nextReward = cycleReward(streak);
  // Ganhos do check-in já obtidos neste mês (reinicia quando o mês muda)
  const earned = state.capMonth === monthKey ? (state.earned || { premium: 0, comum: 0 }) : { premium: 0, comum: 0 };
  const capRemaining = { premium: Math.max(0, MONTHLY_CAP.premium - earned.premium), comum: Math.max(0, MONTHLY_CAP.comum - earned.comum) };

  const doCheckin = () => {
    if (!canCheckin) return;
    const cur = nextReward.cur;
    const give = Math.min(nextReward.amount, capRemaining[cur]); // respeita o teto mensal
    let nextSnapshot = null;
    setState(s => {
      const base = s.capMonth === monthKey ? (s.earned || { premium: 0, comum: 0 }) : { premium: 0, comum: 0 };
      const next = {
        ...s,
        [cur]: s[cur] + give,
        checkins: [...(s.checkins || []), today],
        capMonth: monthKey,
        earned: { ...base, [cur]: base[cur] + give },
        updatedAt: Date.now(),
      };
      nextSnapshot = next;
      return next;
    });
    if (nextSnapshot) persistNow(nextSnapshot);
    if (give > 0) { applyCredit(cur === 'comum' ? give : 0, cur === 'premium' ? give : 0); addHistory({ kind: 'checkin', desc: `Check-in · dia ${streak} de sequência`, [cur]: give }); }
    const label = cur === 'premium' ? PREMIUM.name : COMUM.name;
    flash(give > 0 ? `Check-in feito! +${give} ${label} (dia ${streak})` : `Check-in feito! Teto mensal de ${label} já atingido.`);
  };

  // ── Missões ──
  const claimMission = (m) => {
    if (m.progress < m.goal || m.claimed) return;
    let nextSnapshot = null;
    setState(s => {
      // Upsert do registro: uma missão criada agora pelo admin ainda não tem
      // linha no save da pessoa — sem o upsert, o resgate não era gravado e o
      // botão voltava pra "Resgatar" no próximo carregamento.
      const recs = s.missions || [];
      const rec = { id: m.id, claimed: true, claimedAt: today };
      const missions = recs.some(x => x.id === m.id)
        ? recs.map(x => x.id === m.id ? { ...x, ...rec } : x)
        : [...recs, rec];
      const next = {
        ...s, comum: s.comum + (m.comum || 0), premium: s.premium + (m.premium || 0),
        missions,
        updatedAt: Date.now(),
      };
      nextSnapshot = next;
      return next;
    });
    if (nextSnapshot) persistNow(nextSnapshot);
    applyCredit(m.comum || 0, m.premium || 0);
    addHistory({ kind: 'missao', desc: `Missão: ${m.title}`, ...(m.comum ? { comum: m.comum } : {}), ...(m.premium ? { premium: m.premium } : {}) });
    flash(`Recompensa da missão resgatada: ${m.title}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ── Topbar ── */}
      <div style={{ height: 56, background: T.topbarBg || cardBg, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12, position: 'sticky', top: 0, zIndex: 200, boxShadow: `0 1px 20px ${T.goldLine}22` }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 13, fontFamily: 'var(--font-body)', padding: '4px 8px', borderRadius: 7 }}
          onMouseEnter={e => e.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,0.04)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Módulos
        </button>
        <div style={{ width: 1, height: 20, background: T.border }} />
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
        {!isMobile && <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: 'var(--font-brand)', letterSpacing: '.04em' }}>Prisma Store</span>}
        <div style={{ flex: 1 }} />
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <PrismChip type="comum" amount={state.comum} />
            <PrismChip type="premium" amount={state.premium} />
          </div>
        )}
        {/* Perfil do usuário */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 10px 4px 4px', borderRadius: 999, background: T.goldGl, border: `1px solid ${T.goldLine}44` }}>
          <AvatarCircle name={userName} photo={userPhoto} size={30} fontSize={11} />
          {!isMobile && <span style={{ fontSize: 13, fontWeight: 600, color: T.text, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>}
        </div>
        {!isMobile && <Logo size={26} />}
      </div>

      {/* ── Tabs (botões em pílula) ── */}
      <div style={{ display: 'flex', gap: 9, padding: isMobile ? '14px 12px 4px' : '18px 24px 4px', maxWidth: 1240, margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
        {[
          { id: 'loja',      label: 'Loja',      Icon: IcoCart },
          { id: 'colecao',   label: 'Coleção',   Icon: IcoTrophy },
          { id: 'missoes',   label: 'Missões',   Icon: IcoTarget },
          { id: 'carteira',  label: 'Carteira',  Icon: IcoGem },
          { id: 'checkin',   label: 'Check-in',  Icon: IcoCalendar },
          { id: 'historico', label: 'Histórico', Icon: IcoReceipt },
          ...(isAdmin ? [{ id: 'admin', label: 'Administrador', Icon: IcoShield }] : []),
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              onMouseEnter={e => { if (!on) e.currentTarget.style.borderColor = T.goldLine + '88'; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.borderColor = T.border; }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px',
                borderRadius: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
                fontSize: 14, fontWeight: on ? 700 : 600,
                border: `1.5px solid ${on ? 'transparent' : T.border}`,
                background: on ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : (T.surfaceSub || 'rgba(0,0,0,0.04)'),
                color: on ? '#fff' : T.textS,
                boxShadow: on ? `0 5px 16px ${T.goldLine}55` : '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all .15s',
              }}>
              <t.Icon size={16} />{t.label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, maxWidth: 1240, margin: '0 auto', width: '100%', padding: isMobile ? '12px' : '12px 24px 20px' }}>
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <PrismChip type="comum" amount={state.comum} />
            <PrismChip type="premium" amount={state.premium} />
          </div>
        )}

        {tab === 'loja'      && <Loja items={state.items} balances={state} onBuy={buyItem} ownedUnikoIds={ownedUnikoIds} expiresAt={state.expiresAt} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'colecao'   && <Colecao collection={state.collection || []} items={state.items} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'missoes'   && <Missoes missions={missionsLive} onClaim={claimMission} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'carteira'  && <Carteira state={state} setState={setState} addHistory={addHistory} flash={flash} isMobile={isMobile} cardBg={cardBg} me={userName} applyCredit={applyCredit} />}
        {tab === 'checkin'   && <Checkin canCheckin={canCheckin} todayIsWeekend={todayIsWeekend} onCheckin={doCheckin} checkins={state.checkins || []} streak={streak} nextReward={nextReward} earned={earned} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'historico' && <Historico history={state.history} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'admin' && isAdmin && <Admin items={state.items} expiresAt={state.expiresAt} setState={setState} flash={flash} isMobile={isMobile} cardBg={cardBg} player={userName} missionDefs={missionDefs} setMissionDefs={setMissionDefs} />}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: T.text, color: T.surface, padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', animation: 'meToast .3s ease' }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes meToast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
};

// ─── Contagem regressiva até o fim do mês (renovação dos prêmios) ──────────
const MonthCountdown = ({ expiresAt }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const d = new Date();
  // Se o admin definiu uma data de expiração, conta até ela (fim do dia); senão, até o fim do mês.
  const end = expiresAt
    ? new Date(expiresAt + 'T23:59:59').getTime()
    : new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
  const diff = Math.max(0, end - now);
  const expired = now > end;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const Unit = ({ v, l }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 34 }}>
      <span style={{ fontSize: 17, fontWeight: 800, color: T.gold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pad2(v)}</span>
      <span style={{ fontSize: 9, color: T.textT, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{l}</span>
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: expired ? 'rgba(192,64,80,0.10)' : T.goldGl, border: `1px solid ${expired ? 'rgba(192,64,80,0.35)' : T.goldLine + '44'}`, borderRadius: 14, padding: '9px 16px', marginBottom: 10 }}>
      <span style={{ display: 'inline-flex', color: expired ? '#C04050' : T.gold }}><IcoClock size={22} /></span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Prêmios deste mês</div>
        <div style={{ fontSize: 11, color: T.textT }}>{expired ? 'Os prêmios expiraram — aguarde a próxima leva!' : (expiresAt ? 'Disponíveis só até o cronômetro zerar — aproveite!' : 'Renovam quando o cronômetro zerar — aproveite antes que esgotem!')}</div>
      </div>
      {!expired && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Unit v={days} l="dias" /><Sep /><Unit v={hours} l="hrs" /><Sep /><Unit v={mins} l="min" /><Sep /><Unit v={secs} l="seg" />
        </div>
      )}
    </div>
  );
};
const Sep = () => <span style={{ fontSize: 16, fontWeight: 800, color: T.textD, alignSelf: 'flex-start', marginTop: -1 }}>:</span>;

// ── Imagens dos prêmios: 1ª é a CAPA; demais são adicionais (galeria) ──
const prizeImages = (item) => Array.isArray(item?.images) ? item.images.filter(Boolean) : [];

// Mídia do prêmio: mostra a foto (idx); fit "cover" recorta, "contain" mostra inteira (tamanho real)
const PrizeMedia = ({ item, idx = 0, h = 120, emojiSize = 44, radius = 12, sold = false, fit = 'cover', style }) => {
  const imgs = prizeImages(item);
  const src = imgs[idx] != null ? imgs[idx] : imgs[0];
  return (
    <div style={{ width: '100%', height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius, overflow: 'hidden', ...style }}>
      {src
        ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block', filter: sold ? 'grayscale(1)' : 'none' }} />
        : <span style={{ fontSize: emojiSize, lineHeight: 1, filter: sold ? 'grayscale(1)' : 'none' }}>{item.emoji}</span>}
    </div>
  );
};

// Redimensiona uma imagem escolhida do PC e SOBE pro Supabase Storage (bucket
// 'mercado-fotos'), devolvendo a URL pública — em vez de virar dataURL embutido
// no banco. BUG CORRIGIDO (jul/2026): as fotos dos prêmios eram guardadas como
// base64 direto na coluna `images` de `mercado_items` — o catálogo inteiro
// (todas as fotos de todos os prêmios) tinha que baixar por completo, como
// texto dentro do JSON, ANTES de qualquer imagem aparecer na tela, e sem
// cache de imagem nenhum (o navegador não cacheia texto de JSON como cacheia
// uma <img src>). Isso deixava a Loja lenta pra carregar na primeira vez.
// Precisa rodar supabase_fotos_storage.sql antes (cria o bucket + políticas).
const fileToStorageUrl = (file, maxDim = 900, quality = 0.85) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = async () => {
      try {
        const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(async (blob) => {
          if (!blob) { rej(new Error('toBlob falhou')); return; }
          const path = `prizes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const { error } = await supabase.storage.from('mercado-fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (error) { rej(error); return; }
          const { data } = supabase.storage.from('mercado-fotos').getPublicUrl(path);
          res(data.publicUrl);
        }, 'image/jpeg', quality);
      } catch (e) { rej(e); }
    };
    img.onerror = rej; img.src = fr.result;
  };
  fr.onerror = rej; fr.readAsDataURL(file);
});

// ═══════════════════════════════════════════════ LOJA ═══════════════════════
const Loja = ({ items, balances, onBuy, ownedUnikoIds, expiresAt, isMobile, cardBg }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | premium | comum
  const [viewId, setViewId] = useState(null);  // item em tela cheia (lightbox)
  const viewItem = viewId ? items.find(i => i.id === viewId) : null;
  const isOwned = (item) => !!item.unikoId && ownedUnikoIds.has(item.unikoId);

  // Ordem é a que o ADMIN definiu (arrastar/mover na aba Administrador → Prêmios) — os
  // Unikos à venda ficam misturados na mesma lista, sem seção separada. `filter`/`query`
  // só reduzem a lista, sem reordenar (Array.filter preserva a ordem).
  const filtered = items
    .filter(i => filter === 'all' || i.cur === filter)
    .filter(i => !query.trim() || (i.name + ' ' + i.desc).toLowerCase().includes(query.trim().toLowerCase()));

  // Maior prêmio em destaque (fixo em todas as páginas) + o resto paginado por página
  // (era 7 = ~2 linhas de 4; +8 = mais 2 linhas de 4, total ~4 linhas por página)
  const featured = filtered[0] || null;
  const rest = filtered.slice(1);
  const PAGE = 15;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rest.length / PAGE));
  const pageSafe = page % pageCount;
  const pagedRest = rest.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);
  useEffect(() => { setPage(0); }, [query, filter]);

  const FILTERS = [
    { id: 'all',     label: 'Todos',   icon: null },
    { id: 'premium', label: 'Premium', icon: 'premium' },
    { id: 'comum',   label: 'Comum',   icon: 'comum' },
  ];

  return (
    <div>
      <SectionHead title="Loja de Recompensas" sub="Troque seus prismas por prêmios e colecionáveis. Itens esgotam ao serem comprados." />

      {/* Contagem regressiva — até a data de expiração definida pelo admin (ou fim do mês) */}
      <MonthCountdown expiresAt={expiresAt} />

      {/* Busca + filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 320px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar prêmio..."
            style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {FILTERS.map(f => {
            const on = filter === f.id;
            const c = f.icon === 'premium' ? PREMIUM.color : f.icon === 'comum' ? COMUM.color : T.gold;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 999,
                border: `1.5px solid ${on ? c : T.border}`, cursor: 'pointer', fontFamily: 'var(--font-body)',
                fontSize: 13, fontWeight: on ? 700 : 500, background: on ? c + '18' : 'transparent', color: on ? c : T.textS,
              }}>
                {f.icon && <PrismIcon type={f.icon} size={14} />}{f.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textT }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: T.textD }}><IcoSearch size={38} /></div>
          Nenhum prêmio encontrado.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: 14, alignItems: 'stretch' }}>
          {/* DESTAQUE — primeiro item na ordem definida pelo admin */}
          {featured && <FeaturedCard item={featured} afford={balances[featured.cur] >= featured.price} owned={isOwned(featured)} onBuy={onBuy} onView={setViewId} cardBg={cardBg} />}

          {/* Grade dos demais (6 por página) + botão de próxima página */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, alignContent: 'start' }}>
            {pagedRest.map(item => (
              <ItemCard key={item.id} item={item} afford={balances[item.cur] >= item.price} owned={isOwned(item)} onBuy={onBuy} onView={setViewId} cardBg={cardBg} />
            ))}
            {rest.length > PAGE && (
              <button onClick={() => setPage(p => (p + 1) % pageCount)} title="Ver outros prêmios"
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                style={{ ...rainbowBorder(16), cursor: 'pointer', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 16px', fontFamily: 'var(--font-body)', textAlign: 'center', transition: 'transform .18s ease' }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '.02em', lineHeight: 1.4, ...prismText('premium') }}>CLIQUE PARA VER OUTROS PRÊMIOS</span>
                <span style={{ fontSize: 52, lineHeight: 1, fontWeight: 900, ...prismText('premium') }}>➜</span>
                <span style={{ fontSize: 11, color: T.textT, fontWeight: 600 }}>Página {pageSafe + 1} de {pageCount}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lightbox — prêmio em tela cheia */}
      {viewItem && (
        <ItemLightbox item={viewItem} afford={balances[viewItem.cur] >= viewItem.price} owned={isOwned(viewItem)} onBuy={onBuy} onClose={() => setViewId(null)} cardBg={cardBg} />
      )}
    </div>
  );
};

// Visualização em tela cheia do prêmio (card central + fundo desfocado)
const ItemLightbox = ({ item, afford, owned, onBuy, onClose, cardBg }) => {
  const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
  const sold = item.stock <= 0;
  const blocked = sold || owned;
  const rc = RARITY_COLOR[item.rarity] || T.textT;
  const imgs = prizeImages(item);
  const [imgIdx, setImgIdx] = useState(0);
  const total = Math.max(1, imgs.length);
  const go = (d) => setImgIdx(i => (i + d + total) % total);
  const arrowBtn = (side) => ({
    position: 'absolute', top: '50%', [side]: 10, transform: 'translateY(-50%)', zIndex: 4,
    width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(0,0,0,0.35)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'rgba(8,8,16,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      animation: 'meFade .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: 460, background: cardBg, borderRadius: 22,
        border: `1.5px solid ${rc}55`, boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 60px ${rc}33`,
        overflow: 'hidden', animation: 'mePop .25s cubic-bezier(.16,1,.3,1)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${rc}30, transparent 55%)`, pointerEvents: 'none' }} />
        {/* Fechar */}
        <button onClick={onClose} aria-label="Fechar" style={{
          position: 'absolute', top: 12, right: 12, zIndex: 3, width: 34, height: 34, borderRadius: '50%',
          border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 18, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        {/* Badge raridade */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 5, background: rc, color: '#fff', fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {item.rarity}
        </div>

        {/* Foto expandida + galeria (setas pra trocar de imagem) */}
        <div style={{ padding: '48px 18px 14px', position: 'relative' }}>
          {imgs.length > 0
            ? <PrizeMedia item={item} idx={imgIdx} h={360} radius={16} sold={blocked} fit="contain" style={{ background: 'rgba(0,0,0,0.18)' }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ fontSize: 150, lineHeight: 1, filter: blocked ? 'grayscale(1)' : `drop-shadow(0 14px 40px ${rc}66)` }}>{item.emoji}</span></div>}
          {imgs.length > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Anterior" style={arrowBtn('left')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={() => go(1)} aria-label="Próxima" style={arrowBtn('right')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                {imgs.map((_, i) => (
                  <span key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 18 : 8, height: 8, borderRadius: 999, background: i === imgIdx ? rc : T.border, cursor: 'pointer', transition: 'all .15s' }} />
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 28px 28px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text, lineHeight: 1.15 }}>{item.name}</div>
            <span style={{ fontSize: 12.5, color: sold ? '#C04050' : T.textT, fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>
              {owned ? 'Você já tem' : sold ? 'Esgotado' : `${item.stock} disponíve${item.stock > 1 ? 'is' : 'l'} para resgate`}
            </span>
          </div>
          <div style={{ fontSize: 14, color: T.textT, lineHeight: 1.6, marginBottom: 22 }}>{item.desc}</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 26 }}>
              <PrismIcon type={item.cur} size={36} /><span style={prismText(item.cur)}>{fmt(item.price)}</span>
            </span>
            <button disabled={blocked || !afford} onClick={() => onBuy(item)} style={{
              padding: '13px 30px', cursor: (blocked || !afford) ? 'not-allowed' : 'pointer', ...buyBtn(item.cur, blocked, 12),
              fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-body)',
              opacity: (!blocked && !afford) ? 0.5 : 1, boxShadow: blocked ? 'none' : `0 6px 22px ${cfg.color}55`,
            }}>
              {owned ? 'Já possui' : sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes meFade{from{opacity:0}to{opacity:1}}@keyframes mePop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
};

// Card grande de destaque (maior prêmio)
const FeaturedCard = ({ item, afford, owned, onBuy, onView, cardBg }) => {
  const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
  const sold = item.stock <= 0;
  const blocked = sold || owned;
  const rc = RARITY_COLOR[item.rarity] || T.textT;
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = `0 18px 48px ${rc}3a`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 10px 36px ${rc}22`; }}
      style={{
      background: cardBg, border: `1.5px solid ${rc}55`, borderRadius: 20, overflow: 'hidden',
      position: 'relative', opacity: blocked ? 0.65 : 1, display: 'flex', flexDirection: 'column',
      boxShadow: `0 10px 36px ${rc}22`, transition: 'transform .2s ease, box-shadow .2s ease',
    }}>
      {/* Brilho temático no topo */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${rc}26, transparent 60%)`, pointerEvents: 'none' }} />
      {/* Badge destaque */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: rc, color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, letterSpacing: '.04em', zIndex: 2 }}>
        ⭐ DESTAQUE
      </div>

      <div onClick={() => onView?.(item.id)} title="Ampliar" style={{ flex: 1, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 12px 2px', position: 'relative', cursor: 'zoom-in' }}>
        <PrizeMedia item={item} h="100%" emojiSize={88} radius={14} sold={blocked} style={{ width: '100%', filter: blocked ? 'none' : `drop-shadow(0 10px 30px ${rc}40)` }} />
      </div>

      <div style={{ padding: '0 18px 16px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: rc, textTransform: 'uppercase', letterSpacing: '.08em' }}>{item.rarity}</span>
          <span style={{ fontSize: 11.5, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>
            {owned ? 'Você já tem' : sold ? 'Esgotado' : `${item.stock} p/ resgate`}
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4, lineHeight: 1.2 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.45, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 20 }}>
            <PrismIcon type={item.cur} size={28} /><span style={prismText(item.cur)}>{fmt(item.price)}</span>
          </span>
          <button disabled={blocked || !afford} onClick={() => onBuy(item)} style={{
            padding: '10px 22px', cursor: (blocked || !afford) ? 'not-allowed' : 'pointer', ...buyBtn(item.cur, blocked, 11),
            fontWeight: 800, fontSize: 14.5, fontFamily: 'var(--font-body)',
            opacity: (!blocked && !afford) ? 0.5 : 1, boxShadow: blocked ? 'none' : `0 6px 20px ${cfg.color}44`,
          }}>
            {owned ? 'Já possui' : sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
          </button>
        </div>
      </div>

      {sold && !owned && <SoldRibbon />}
    </div>
  );
};

// Card pequeno (grade)
const ItemCard = ({ item, afford, owned, onBuy, onView, cardBg }) => {
  const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
  const sold = item.stock <= 0;
  const blocked = sold || owned;
  const rc = RARITY_COLOR[item.rarity] || T.textT;
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = `0 14px 32px ${rc}33`; e.currentTarget.style.zIndex = 2; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = T.sh; e.currentTarget.style.zIndex = 1; }}
      style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', position: 'relative', opacity: blocked ? 0.62 : 1, display: 'flex', flexDirection: 'column', boxShadow: T.sh, transition: 'transform .18s ease, box-shadow .18s ease' }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${rc},transparent)` }} />
      <div onClick={() => onView?.(item.id)} title="Ampliar" style={{ padding: '9px 9px 3px', cursor: 'zoom-in' }}>
        <PrizeMedia item={item} h={84} emojiSize={40} radius={10} sold={blocked} />
      </div>
      <div style={{ padding: '0 13px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.rarity}</span>
          <span style={{ fontSize: 10, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>{owned ? 'Você já tem' : sold ? 'Esgotado' : `${item.stock} disp.`}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.name}</div>
        <div style={{ fontSize: 11.5, color: T.textT, lineHeight: 1.4, marginBottom: 9, flex: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 14 }}>
            <PrismIcon type={item.cur} size={22} /><span style={prismText(item.cur)}>{fmt(item.price)}</span>
          </span>
          <button disabled={blocked || !afford} onClick={() => onBuy(item)} style={{
            padding: '6px 12px', cursor: (blocked || !afford) ? 'not-allowed' : 'pointer', ...buyBtn(item.cur, blocked, 8),
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-body)', opacity: (!blocked && !afford) ? 0.5 : 1,
          }}>
            {owned ? 'Já possui' : sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
          </button>
        </div>
      </div>
      {sold && !owned && <SoldRibbon />}
    </div>
  );
};

const SoldRibbon = () => (
  <div style={{ position: 'absolute', top: 16, right: -32, transform: 'rotate(38deg)', background: '#C04050', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 40px', letterSpacing: '.1em' }}>
    ESGOTADO
  </div>
);

// ═══════════════════════════════════════════════ COLEÇÃO ════════════════════
const RARITY_ORDER = ['Lendário', 'Épico', 'Raro', 'Comum'];

const Colecao = ({ collection, items = [], isMobile, cardBg }) => {
  const [q, setQ] = useState('');
  const [rar, setRar] = useState('all');
  const [cur, setCur] = useState('all');
  const [viewId, setViewId] = useState(null);

  // Une os resgatados (owned) com os do catálogo ainda NÃO adquiridos (locked)
  const owned = new Set(collection.map(c => c.id));
  const ownedList = collection.map(c => ({ ...c, locked: false }));
  const lockedList = items.filter(i => !owned.has(i.id))
    .map(i => ({ id: i.id, name: i.name, emoji: i.emoji, images: prizeImages(i), rarity: i.rarity, cur: i.cur, price: i.price, locked: true }));
  const all = [...ownedList, ...lockedList];
  const viewItem = viewId ? all.find(c => c.id === viewId) : null;

  const totalItens = collection.reduce((a, c) => a + c.qty, 0);
  const filtered = all
    .filter(c => rar === 'all' || c.rarity === rar)
    .filter(c => cur === 'all' || c.cur === cur)
    .filter(c => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));

  const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };
  const chip = (on, c) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999,
    border: `1.5px solid ${on ? c : T.border}`, cursor: 'pointer', fontFamily: 'var(--font-body)',
    fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? c + '18' : 'transparent', color: on ? c : T.textS,
  });

  return (
    <div>
      <SectionHead title="Minha Coleção" sub={`${collection.length} de ${all.length} prêmios desbloqueados${totalItens ? ` · ${totalItens} resgatado(s) no total` : ''}.`} />

      {all.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textT }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: T.textD }}><IcoTrophy size={42} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textS }}>Nenhum prêmio disponível</div>
        </div>
      ) : (
        <>
          {/* Busca */}
          <div style={{ position: 'relative', maxWidth: isMobile ? '100%' : 340, marginBottom: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar prêmio..." style={{ ...fieldStyle, width: '100%', paddingLeft: 34 }} />
          </div>

          {/* Filtros: raridade */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
            <button onClick={() => setRar('all')} style={chip(rar === 'all', T.gold)}>Todas raridades</button>
            {RARITY_ORDER.map(r => <button key={r} onClick={() => setRar(r)} style={chip(rar === r, RARITY_COLOR[r])}>{r}</button>)}
          </div>

          {/* Filtros: tipo de prisma usado */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setCur('all')} style={chip(cur === 'all', T.gold)}>Todos os prismas</button>
            <button onClick={() => setCur('comum')} style={chip(cur === 'comum', COMUM.color)}><PrismIcon type="comum" size={15} />Comprado c/ Comum</button>
            <button onClick={() => setCur('premium')} style={chip(cur === 'premium', PREMIUM.color)}><PrismIcon type="premium" size={15} />Comprado c/ Premium</button>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: T.textT }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: T.textD }}><IcoSearch size={34} /></div>
              Nenhum prêmio encontrado para o filtro.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(205px,1fr))', gap: 16 }}>
              {filtered.map(c => {
                const rc = RARITY_COLOR[c.rarity] || T.textT;
                const locked = c.locked;
                return (
                  <div key={c.id} style={{ background: cardBg, border: `1px solid ${locked ? T.border : rc + '44'}`, borderRadius: 16, overflow: 'hidden', position: 'relative', boxShadow: T.sh, display: 'flex', flexDirection: 'column', opacity: locked ? 0.78 : 1 }}>
                    <div style={{ height: 3, background: locked ? T.border : `linear-gradient(90deg,transparent,${rc},transparent)` }} />
                    {!locked && c.qty > 1 && (
                      <span style={{ position: 'absolute', top: 11, right: 11, zIndex: 2, background: rc, color: '#fff', fontSize: 11.5, fontWeight: 800, padding: '2px 10px', borderRadius: 999, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>×{c.qty}</span>
                    )}
                    {locked && (
                      <span style={{ position: 'absolute', top: 11, right: 11, zIndex: 2, background: T.textD, color: cardBg, padding: '4px', borderRadius: 8, display: 'inline-flex' }}><IcoLock size={13} /></span>
                    )}
                    <div onClick={() => setViewId(c.id)} title="Ampliar" style={{ padding: '18px 14px 6px', cursor: 'zoom-in', filter: locked ? 'grayscale(1) brightness(0.85)' : 'none' }}>
                      <PrizeMedia item={c} h={96} emojiSize={60} radius={11} />
                    </div>
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: locked ? T.textT : rc, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{c.rarity}</span>
                      <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text, marginBottom: 7, lineHeight: 1.2 }}>{c.name}</div>
                      {locked ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 'auto' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 14 }}>
                            <PrismIcon type={c.cur} size={18} /><span style={prismText(c.cur)}>{fmt(c.price)}</span>
                          </span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.04em' }}>Falta adquirir</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto' }}>
                          <PrismIcon type={c.cur} size={18} />
                          <span style={{ fontSize: 11.5, color: T.textT }}>Resgatado em {c.date}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Lightbox da coleção */}
      {viewItem && <CollectionLightbox item={viewItem} onClose={() => setViewId(null)} cardBg={cardBg} />}
    </div>
  );
};

// Visualização em tela cheia de um prêmio da coleção
const CollectionLightbox = ({ item, onClose, cardBg }) => {
  const rc = RARITY_COLOR[item.rarity] || T.textT;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'rgba(8,8,16,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', animation: 'meFade .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: 440, background: cardBg, borderRadius: 22,
        border: `1.5px solid ${rc}55`, boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 60px ${rc}33`, overflow: 'hidden', animation: 'mePop .25s cubic-bezier(.16,1,.3,1)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${rc}30, transparent 55%)`, pointerEvents: 'none' }} />
        <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 5, background: rc, color: '#fff', fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, letterSpacing: '.04em', textTransform: 'uppercase' }}>{item.rarity}</div>

        <div style={{ padding: '48px 18px 14px', position: 'relative', filter: item.locked ? 'grayscale(1) brightness(0.85)' : 'none' }}>
          {prizeImages(item).length > 0
            ? <PrizeMedia item={item} h={240} radius={16} style={{ boxShadow: `0 14px 40px ${rc}55` }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ fontSize: 150, lineHeight: 1, filter: `drop-shadow(0 14px 40px ${rc}66)` }}>{item.emoji}</span></div>}
          {item.locked && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))' }}><IcoLock size={56} /></div>}
        </div>
        <div style={{ padding: '0 28px 28px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text, lineHeight: 1.15 }}>{item.name}</div>
            {!item.locked && item.qty > 1 && <span style={{ fontSize: 14, fontWeight: 800, color: rc }}>×{item.qty}</span>}
          </div>
          {item.locked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: T.textT }}>
              <span>Ainda não adquirido · custa</span>
              <PrismIcon type={item.cur} size={20} /><span style={{ fontWeight: 800, ...prismText(item.cur) }}>{fmt(item.price)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: T.textT }}>
              <PrismIcon type={item.cur} size={20} />
              Resgatado com {item.cur === 'premium' ? 'Prisma Premium' : 'Prisma Comum'} · em {item.date}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════ MISSÕES ════════════════════
const PERIOD_META = {
  dia:   { label: 'Diário',  color: '#27C6DE' },
  mes:   { label: 'Mensal',  color: '#9B6FE8' },
  unica: { label: 'Única',   color: '#F5B63A' },
};
const Missoes = ({ missions, onClaim, isMobile, cardBg }) => {
  const [filter, setFilter] = useState('all'); // all | dia | mes | unica
  const FILTERS = [
    { id: 'all', label: 'Todas' }, { id: 'dia', label: 'Diário' },
    { id: 'mes', label: 'Mensal' }, { id: 'unica', label: 'Única' },
  ];
  const shown = filter === 'all' ? missions : missions.filter(m => m.period === filter);
  return (
  <div>
    <SectionHead title="Desafios" sub="Complete desafios diários, mensais e únicos para farmar prismas." />
    {/* Filtro por período */}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {FILTERS.map(f => {
        const on = filter === f.id;
        const c = f.id === 'all' ? T.gold : (PERIOD_META[f.id]?.color || T.gold);
        return (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: on ? 700 : 600, fontFamily: 'var(--font-body)',
            border: `1.5px solid ${on ? 'transparent' : T.border}`,
            background: on ? c : (T.surfaceSub || 'rgba(0,0,0,0.04)'),
            color: on ? '#fff' : T.textS,
          }}>{f.label}</button>
        );
      })}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
      {shown.map(m => {
        const maint = !!m.maintenance;
        const done = !maint && m.progress >= m.goal;
        const claimable = done && !m.claimed;
        const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
        const pm = PERIOD_META[m.period] || PERIOD_META.dia;
        return (
          <div key={m.id} style={{ background: cardBg, border: `1px solid ${claimable ? T.goldLine + '66' : T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh, opacity: maint ? 0.6 : m.claimed ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{m.title}</div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: pm.color, background: pm.color + '22', border: `1px solid ${pm.color}55`, padding: '1px 7px', borderRadius: 999 }}>{pm.label}</span>
                </div>
                <div style={{ fontSize: 12.5, color: T.textT, marginTop: 2 }}>{m.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!!m.comum && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: COMUM.color }}><PrismIcon type="comum" size={18} />{m.comum}</span>}
                {!!m.premium && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700 }}><PrismIcon type="premium" size={18} /><span style={prismText('premium')}>{m.premium}</span></span>}
              </div>
            </div>

            {/* Barra de progresso */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: done ? `linear-gradient(90deg,${T.gold},${T.goldL || T.gold})` : T.goldV || T.gold, transition: 'width .3s' }} />
              </div>
              <span style={{ fontSize: 11.5, color: T.textT, fontWeight: 600, flexShrink: 0 }}>{fmt(m.progress)}/{fmt(m.goal)}</span>
            </div>

            <button
              disabled={!claimable}
              onClick={() => claimable && onClaim(m)}
              style={{
                width: '100%', padding: '10px', borderRadius: 9,
                border: claimable ? 'none' : `1px solid ${T.border}`,
                cursor: claimable ? 'pointer' : (m.claimed ? 'default' : 'not-allowed'),
                background: claimable ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : (T.surfaceSub || 'rgba(0,0,0,0.05)'),
                color: claimable ? '#fff' : T.textD,
                fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              {maint ? '🔧 Em manutenção' : m.claimed ? '✓ Resgatado' : done ? '✨ Resgatar' : 'Em andamento'}
            </button>
          </div>
        );
      })}
    </div>
  </div>
  );
};

// ═══════════════════════════════════════════ CARTEIRA ═══════════════════════
const Carteira = ({ state, setState, addHistory, flash, isMobile, cardBg, me, applyCredit }) => {
  const [sendTo, setSendTo] = useState('');
  const [sendQuery, setSendQuery] = useState('');
  const [openList, setOpenList] = useState(false);
  const sendCur = 'comum'; // apenas Prisma Comum pode ser transferido
  const [sendAmt, setSendAmt] = useState('');
  const [exAmt, setExAmt] = useState('');
  const people = useAllPlayers().filter(p => p !== me); // não enviar pra si mesmo

  const matches = people.filter(c => c.toLowerCase().includes(sendQuery.trim().toLowerCase()));

  const send = () => {
    if (!sendTo || !people.includes(sendTo)) { flash('Selecione um destinatário da lista'); return; }
    const amt = parseInt(sendAmt, 10);
    if (!amt || amt <= 0) { flash('Informe uma quantidade válida'); return; }
    if (state[sendCur] < amt) { flash('Saldo insuficiente'); return; }
    setState(s => ({ ...s, [sendCur]: s[sendCur] - amt, updatedAt: Date.now() }));
    applyCredit(sendCur === 'comum' ? -amt : 0, sendCur === 'premium' ? -amt : 0);
    addHistory({ kind: 'envio', desc: `Enviou para ${sendTo}`, [sendCur]: -amt });
    creditPlayer(sendTo, sendCur, amt, `Recebido de ${me || 'um colega'}`); // credita o destinatário no Supabase
    flash(`Enviou ${fmt(amt)} ${sendCur === 'premium' ? 'Premium' : 'Comuns'} para ${sendTo}`);
    setSendAmt(''); setSendTo(''); setSendQuery('');
  };

  const exPremium = Math.floor((parseInt(exAmt, 10) || 0) / EXCHANGE_RATE);
  const exchange = () => {
    const spend = (parseInt(exAmt, 10) || 0);
    const got = Math.floor(spend / EXCHANGE_RATE);
    if (got <= 0) { flash(`Mínimo ${EXCHANGE_RATE} Comuns para 1 Premium`); return; }
    const cost = got * EXCHANGE_RATE;
    if (state.comum < cost) { flash('Saldo de Comuns insuficiente'); return; }
    setState(s => ({ ...s, comum: s.comum - cost, premium: s.premium + got, updatedAt: Date.now() }));
    applyCredit(-cost, got);
    addHistory({ kind: 'troca', desc: `Trocou ${fmt(cost)} Comuns por ${got} Premium`, comum: -cost, premium: got });
    flash(`Você obteve ${got} Prisma Premium`);
    setExAmt('');
  };

  const fieldStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div>
      <SectionHead title="Carteira de Prismas" sub="Veja seus saldos, envie prismas para colegas e troque Comuns por Premium." />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[{ k: 'comum', cfg: COMUM, hint: 'Prêmios colecionáveis e cosméticos' }, { k: 'premium', cfg: PREMIUM, hint: 'Prêmios grandes e exclusivos' }].map(({ k, cfg, hint }) => (
          <div key={k} style={{ background: cardBg, border: `1px solid ${cfg.color}33`, borderRadius: 14, padding: '14px 18px', position: 'relative', overflow: 'hidden', boxShadow: T.sh }}>
            <div style={{ position: 'absolute', top: -28, right: -18, opacity: 0.16 }}><PrismIcon type={k} size={120} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <PrismIcon type={k} size={30} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{cfg.name}</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, ...prismText(k) }}>{fmt(state[k])}</div>
            <div style={{ fontSize: 11, color: T.textT, marginTop: 5 }}>{hint}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        {/* Enviar prismas */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: T.sh }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 700, color: T.text, marginBottom: 2 }}><span style={{ color: COMUM.color }}><IcoSend size={17} /></span>Enviar Prismas</div>
          <div style={{ fontSize: 12, color: T.textT, marginBottom: 12 }}>Transfira prismas para outro colaborador.</div>

          <label style={lbl}>Destinatário</label>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 13, pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={sendQuery}
              onChange={e => { setSendQuery(e.target.value); setSendTo(''); setOpenList(true); }}
              onFocus={() => setOpenList(true)}
              onBlur={() => setTimeout(() => setOpenList(false), 150)}
              placeholder="Digite o nome do colaborador..."
              style={{ ...fieldStyle, paddingLeft: 34 }} />
            {sendTo && !openList && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 12, top: 12 }}><polyline points="20 6 9 17 4 12" /></svg>
            )}
            {openList && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30, background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.shL || '0 8px 24px rgba(0,0,0,0.18)', maxHeight: 210, overflowY: 'auto' }}>
                {matches.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: T.textT }}>Nenhum colaborador encontrado</div>
                ) : matches.map(c => (
                  <div key={c} onMouseDown={() => { setSendTo(c); setSendQuery(c); setOpenList(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', fontSize: 13.5, color: T.text }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <AvatarCircle name={c} size={24} fontSize={9} />{c}
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={lbl}>Tipo de prisma</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${COMUM.color}`, background: COMUM.glow, color: COMUM.color, fontWeight: 700, fontSize: 13 }}>
            <PrismIcon type="comum" size={15} />Prisma Comum
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: T.textT }}>Premium não pode ser enviado</span>
          </div>

          <label style={lbl}>Quantidade</label>
          <input type="number" min="1" value={sendAmt} onChange={e => setSendAmt(e.target.value)} placeholder="0" style={{ ...fieldStyle, marginBottom: 12 }} />

          <button onClick={send} style={primaryBtn(sendCur === 'premium' ? PREMIUM.color : COMUM.color)}>Enviar</button>
        </div>

        {/* Trocar Comum → Premium */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: T.sh }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 700, color: T.text, marginBottom: 2 }}><span style={{ color: T.gold }}><IcoSwap size={17} /></span>Trocar por Premium</div>
          <div style={{ fontSize: 12, color: T.textT, marginBottom: 12 }}>
            Converta Prismas Comuns em Premium. Taxa: <strong style={{ color: T.text }}>{EXCHANGE_RATE} Comuns = 1 Premium</strong>.
          </div>

          <label style={lbl}>Comuns a gastar</label>
          <input type="number" min="0" step={EXCHANGE_RATE} value={exAmt} onChange={e => setExAmt(e.target.value)} placeholder="0" style={{ ...fieldStyle, marginBottom: 12 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '11px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,0.02)', marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: COMUM.color, fontWeight: 700 }}>
              <PrismIcon type="comum" size={26} />{fmt((parseInt(exAmt, 10) || 0))}
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 18 }}>
              <PrismIcon type="premium" size={28} /><span style={prismText('premium')}>{exPremium}</span>
            </span>
          </div>

          <button onClick={exchange} style={{ ...primaryBtn(PREMIUM.color), ...rainbowBorder(10), color: '#fff' }}>Trocar agora</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════ CHECK-IN ═══════════════════════
const Checkin = ({ canCheckin, todayIsWeekend, onCheckin, checkins, streak, nextReward, earned, isMobile, cardBg }) => {
  // Posição do dia de hoje dentro do ciclo de 5 (0-based)
  const todayIdx = ((streak - 1) % CHECKIN_CYCLE.length + CHECKIN_CYCLE.length) % CHECKIN_CYCLE.length;
  const cap = MONTHLY_CAP;
  const capBar = (cur) => {
    const e = Math.min(earned[cur], cap[cur]); const pct = Math.round((e / cap[cur]) * 100);
    return { e, pct };
  };
  const alreadyDoneToday = !canCheckin && !todayIsWeekend;

  return (
    <div>
      <SectionHead title="Check-in Diário" sub="Em dias úteis: os ganhos crescem a cada dia da sequência e a moeda intercala. Faltou um dia útil (sem contar fim de semana)? A sequência volta pro dia 1. Sábado e domingo não contam (nem quebram a sequência) — sua sequência pode começar em qualquer dia útil, não só segunda." />

      {/* Banner do dia + resgatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '11px 18px', marginBottom: 12, boxShadow: T.sh, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 0%, ${T.goldGl}, transparent 55%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', color: canCheckin ? T.gold : todayIsWeekend ? T.textT : '#16a34a' }}>
          {canCheckin ? <IcoGift size={30} /> : todayIsWeekend ? <IcoCalendar size={30} /> : <IcoCheck size={30} />}
        </div>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
            {canCheckin ? `Dia ${streak} de sequência — recompensa pronta!`
              : todayIsWeekend ? 'Fim de semana — sem check-in hoje'
              : `Você já resgatou hoje (dia ${streak - 1})`}
          </div>
          <div style={{ fontSize: 12, color: T.textT, marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canCheckin ? 'Recompensa de hoje:'
              : todayIsWeekend ? 'Sua sequência continua intacta — volte na segunda. Próxima:'
              : 'Volte amanhã para manter a sequência. Próxima:'}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800 }}>
              <PrismIcon type={nextReward.cur} size={nextReward.cur === 'premium' ? 18 : 14} />
              <span style={prismText(nextReward.cur)}>+{nextReward.amount}</span>
            </span>
          </div>
        </div>
        <button disabled={!canCheckin} onClick={onCheckin} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none', cursor: canCheckin ? 'pointer' : 'not-allowed', position: 'relative',
          background: canCheckin ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : T.surfaceSub || 'rgba(0,0,0,0.06)',
          color: canCheckin ? '#fff' : T.textT, fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)',
          boxShadow: canCheckin ? `0 6px 22px ${T.goldLine}55` : 'none',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}>
          {canCheckin ? <><IcoStar size={16} />Resgatar</> : alreadyDoneToday ? <><IcoCheck size={16} />Resgatado</> : <><IcoCalendar size={16} />Fim de semana</>}
        </button>
      </div>

      {/* Ciclo de 5 dias (seg-sex) */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? '14px 12px' : '16px 18px', boxShadow: T.sh, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Sequência de 5 dias úteis</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: isMobile ? 6 : 11 }}>
          {CHECKIN_CYCLE.map((r, i) => {
            const dayNum = i + 1;
            const isNext = i === todayIdx && canCheckin;
            const done = i < todayIdx || (i === todayIdx && !canCheckin);
            const prem = r.cur === 'premium';
            const pc = prem ? PREMIUM : COMUM;
            const med = isMobile ? 50 : 58;
            let bg = T.surfaceSub || 'rgba(0,0,0,0.025)', bd = T.border;
            if (isNext) { bg = T.goldGl; bd = T.goldLine; }
            else if (done) { bg = 'rgba(34,197,94,0.08)'; bd = 'rgba(34,197,94,0.4)'; }
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div onClick={isNext ? onCheckin : undefined}
                  title={`Dia ${dayNum} · +${r.amount} ${prem ? 'Premium' : 'Comuns'}`}
                  style={{
                    position: 'relative', width: '100%', borderRadius: 13, border: `1.5px solid ${bd}`, background: bg,
                    padding: '12px 4px 16px', display: 'flex', justifyContent: 'center',
                    cursor: isNext ? 'pointer' : 'default', boxShadow: isNext ? `0 5px 14px ${T.goldLine}33` : 'none', transition: 'transform .15s',
                  }}
                  onMouseEnter={e => { if (isNext) e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                  <div style={{
                    position: 'relative', width: med, height: med,
                    ...(prem ? rainbowBorder('50%') : { borderRadius: '50%', border: `2px solid ${pc.color}`, background: DARK_COMUM }),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: prem ? '0 3px 12px rgba(155,107,255,0.45)' : `0 3px 10px ${pc.color}55`,
                  }}>
                    <PrismIcon type={r.cur} size={32} />
                    <span style={{
                      position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
                      background: prem ? RAINBOW : pc.color, color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '1px 7px',
                      borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', textShadow: '0 1px 1px rgba(0,0,0,0.3)',
                    }}>+{r.amount}</span>
                  </div>
                  {done && (
                    <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                  {isNext && <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: '#e23b3b', boxShadow: `0 0 0 3px ${bg}` }} />}
                </div>
                <span style={{ fontSize: 11.5, fontWeight: isNext ? 800 : 600, color: isNext ? T.gold : T.textT }}>{WEEKDAY_LABELS[i] || `Dia ${dayNum}`}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tetos mensais */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? '14px 12px' : '16px 18px', boxShadow: T.sh }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Limite mensal do check-in</div>
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>Mesmo intercalando, o ganho via check-in é limitado por mês.</div>
        {['premium', 'comum'].map(cur => {
          const { e, pct } = capBar(cur);
          const prem = cur === 'premium';
          return (
            <div key={cur} style={{ marginBottom: cur === 'premium' ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <PrismIcon type={cur} size={prem ? 18 : 14} />
                <span style={{ fontSize: 12.5, fontWeight: 700, ...prismText(cur) }}>{prem ? PREMIUM.name : COMUM.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: T.textT }}>{fmt(e)} / {fmt(cap[cur])}</span>
              </div>
              <div style={{ height: 9, borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: prem ? RAINBOW : `linear-gradient(90deg,${COMUM.color},${COMUM.color}aa)`, transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════ HISTÓRICO ══════════════════════
const KIND_META = {
  compra:       { Icon: IcoCart,    label: 'Compra' },
  compra_uniko: { Icon: IcoCart,    label: 'Compra de Uniko' },
  checkin:      { Icon: IcoCalendar,label: 'Check-in' },
  envio:        { Icon: IcoSend,    label: 'Envio' },
  troca:        { Icon: IcoSwap,    label: 'Troca' },
  missao:       { Icon: IcoTarget,  label: 'Missão' },
  captura:      { Icon: IcoTarget,  label: 'Capture o Uniko' },
  presente:     { Icon: IcoGift,    label: 'Presente (RH)' },
  admin:        { Icon: IcoShield,  label: 'Administrador' },
};

const Historico = ({ history, isMobile, cardBg }) => {
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');

  const filtered = history.filter(h =>
    (!q.trim() || (h.desc || '').toLowerCase().includes(q.trim().toLowerCase())) &&
    (!date || h.date === date)
  );

  const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div>
      <SectionHead title="Histórico de Transações" sub="Todas as suas movimentações de prismas." />

      {/* Busca por pessoa + filtro por data */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 320px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar por nome ou descrição..."
            style={{ ...fieldStyle, width: '100%', paddingLeft: 34 }} />
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer', colorScheme: T.page && /^#0|^#1/.test(T.page) ? 'dark' : 'light' }} />
        {(q || date) && (
          <button onClick={() => { setQ(''); setDate(''); }} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' }}>
            Limpar
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textT }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: T.textD }}><IcoReceipt size={40} /></div>
          Nenhuma transação ainda.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: T.textT }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: T.textD }}><IcoSearch size={34} /></div>
          Nenhuma transação encontrada para o filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(h => {
            const meta = KIND_META[h.kind] || { Icon: IcoReceipt, label: h.kind };
            const MIcon = meta.Icon;
            return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '13px 18px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MIcon size={19} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.desc}</div>
                <div style={{ fontSize: 11.5, color: T.textT }}>{meta.label} · {h.date}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                {['comum', 'premium'].map(cur => h[cur] != null && (
                  <span key={cur} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700 }}>
                    <span style={h[cur] >= 0 ? { color: '#16a34a' } : (cur === 'premium' ? prismText('premium') : { color: COMUM.color })}>{h[cur] >= 0 ? '+' : ''}{fmt(h[cur])}</span>
                    <PrismIcon type={cur} size={18} />
                  </span>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Gerenciador de imagens do prêmio: 1ª é a CAPA; demais são adicionais (galeria).
// Permite anexar por URL ou enviar do PC, remover, e definir qual é a capa.
const ImageManager = ({ images = [], onChange, cardBg }) => {
  const [url, setUrl] = useState('');
  const fieldStyle = { flex: 1, padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box', minWidth: 0 };
  const addUrl = () => { const u = url.trim(); if (/^https?:\/\//i.test(u) || u.startsWith('data:')) { onChange([...(images || []), u]); setUrl(''); } };
  const onFile = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const url = await fileToStorageUrl(f); onChange([...(images || []), url]); } catch (err) { console.error('[prisma-store] upload de foto falhou:', err); } e.target.value = ''; };
  const remove = (i) => onChange(images.filter((_, k) => k !== i));
  const makeCover = (i) => { const arr = [...images]; const [x] = arr.splice(i, 1); arr.unshift(x); onChange(arr); };
  return (
    <div>
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === 0 ? T.gold : T.border}` }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: T.gold, color: '#fff', fontSize: 8.5, fontWeight: 800, textAlign: 'center', letterSpacing: '.04em' }}>CAPA</span>}
              {i !== 0 && <button onClick={() => makeCover(i)} title="Definir como capa" style={{ position: 'absolute', bottom: 2, left: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.55)', color: '#ffd34d', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>★</button>}
              <button onClick={() => remove(i)} title="Remover" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} placeholder="Cole a URL de uma imagem..." style={fieldStyle} />
        <button onClick={addUrl} style={{ padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}bb)`, color: '#fff', fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>Anexar</button>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 600, color: T.textS, cursor: 'pointer' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: `1.5px dashed ${T.border}` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Enviar do computador
        </span>
        <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      </label>
    </div>
  );
};

// Editor completo de um prêmio existente (título, descrição, preço, raridade,
// moeda, estoque e fotos) — aplica só ao clicar em SALVAR.
const ItemEditor = ({ item, onSave, onCancel, flash, cardBg }) => {
  const [d, setD] = useState({ name: item.name, desc: item.desc || '', rarity: item.rarity, cur: item.cur, price: String(item.price), stock: String(item.stock), images: prizeImages(item) });
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const fieldStyle = { width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: cardBg, color: T.text, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };
  const save = () => {
    const price = parseInt(d.price, 10), stock = parseInt(d.stock, 10);
    if (!d.name.trim()) { flash('Informe o nome do prêmio'); return; }
    if (!price || price <= 0) { flash('Informe um preço válido'); return; }
    if (isNaN(stock) || stock < 0) { flash('Informe a quantidade disponível'); return; }
    onSave({ name: d.name.trim(), desc: d.desc.trim(), rarity: d.rarity, cur: d.cur, price, stock, images: d.images });
  };
  return (
    <div style={{ padding: '12px', borderTop: `1px dashed ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={lbl}>Título</label>
        <input value={d.name} onChange={e => set('name', e.target.value)} style={fieldStyle} />
      </div>
      <div>
        <label style={lbl}>Descrição</label>
        <textarea value={d.desc} onChange={e => set('desc', e.target.value)} rows={2} style={{ ...fieldStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Raridade</label>
          <select value={d.rarity} onChange={e => set('rarity', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            {RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Pago com</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ k: 'comum', label: 'Comum' }, { k: 'premium', label: 'Premium' }].map(({ k, label }) => (
              <button key={k} onClick={() => set('cur', k)} style={{
                flex: 1, padding: '8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
                border: `1.5px solid ${d.cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.border}`, fontWeight: 600, fontSize: 12.5,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: d.cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) + '18' : 'transparent', color: d.cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.textS,
              }}><PrismIcon type={k} size={14} />{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Preço (prismas)</label>
          <input type="number" min="1" value={d.price} onChange={e => set('price', e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Qtd. disponível</label>
          <input type="number" min="0" value={d.stock} onChange={e => set('stock', e.target.value)} style={fieldStyle} />
        </div>
      </div>
      <div>
        <label style={lbl}>Fotos <span style={{ textTransform: 'none', fontWeight: 500, color: T.textT }}>(1ª = capa)</span></label>
        <ImageManager images={d.images} onChange={imgs => set('images', imgs)} cardBg={cardBg} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={save} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}bb)`, color: '#fff', fontWeight: 800, fontSize: 13.5, fontFamily: 'var(--font-body)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
          Salvar
        </button>
        <button onClick={onCancel} style={{ padding: '11px 16px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════ ADMINISTRADOR ══════════════════
const Admin = ({ items, expiresAt, setState, flash, isMobile, cardBg, player, missionDefs, setMissionDefs }) => {
  const blank = { name: '', desc: '', emoji: '🎁', rarity: 'Épico', cur: 'comum', price: '', stock: '', images: [] };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null); // item com editor aberto
  const [sub, setSub] = useState('premios');  // premios | missoes | transacoes
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Adicionar um Uniko à loja (mesma lista dos prêmios, não uma seção separada) ──
  const [isUnikoMode, setIsUnikoMode] = useState(false);
  const [unikoPickId, setUnikoPickId] = useState('');
  useEffect(() => { loadCustomUnikos(); }, []); // garante que os Unikos da Oficina já estejam no cache
  const listedUnikoIds = new Set(items.filter(i => i.unikoId).map(i => i.unikoId));
  const availableUnikos = getAllUnikos().filter(u => !listedUnikoIds.has(u.id));

  const fieldStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  const addItem = () => {
    const price = parseInt(form.price, 10);
    if (!price || price <= 0) { flash('Informe um preço válido'); return; }

    if (isUnikoMode) {
      const uniko = availableUnikos.find(u => u.id === unikoPickId);
      if (!uniko) { flash('Escolha um Uniko'); return; }
      const stock = parseInt(form.stock, 10);
      if (isNaN(stock) || stock < 0) { flash('Informe a quantidade disponível'); return; }
      const item = {
        id: 'uniko_' + uniko.id, name: uniko.name, desc: uniko.tagline || '', emoji: '🧬',
        rarity: form.rarity || 'Raro', cur: 'comum', price, stock, images: [uniko.img], unikoId: uniko.id,
      };
      setState(s => ({ ...s, items: [...s.items, item] }));
      setForm(blank); setUnikoPickId(''); setIsUnikoMode(false);
      flash(`Uniko "${uniko.name}" adicionado à loja`);
      return;
    }

    const stock = parseInt(form.stock, 10);
    if (!form.name.trim()) { flash('Informe o nome do prêmio'); return; }
    if (isNaN(stock) || stock < 0) { flash('Informe a quantidade disponível'); return; }
    const item = { id: 'i' + Date.now(), name: form.name.trim(), desc: form.desc.trim(), emoji: form.emoji || '🎁', rarity: form.rarity, cur: form.cur, price, stock, images: form.images || [] };
    setState(s => ({ ...s, items: [...s.items, item] }));
    setForm(blank);
    flash(`Prêmio "${item.name}" adicionado`);
  };

  const patchItem = (id, patch) => setState(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const removeItem = (id) => setState(s => ({ ...s, items: s.items.filter(i => i.id !== id) }));
  // Reordenar manualmente: troca de posição com o vizinho (o "sort" salvo é sempre o
  // índice atual no array — ver itemToRow — então só mexer na ordem do array já basta).
  const moveItem = (id, dir) => setState(s => {
    const idx = s.items.findIndex(i => i.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= s.items.length) return s;
    const arr = [...s.items];
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    return { ...s, items: arr };
  });

  // Expiração GLOBAL dos prêmios (vale pra todos os colaboradores) → linha de config no Supabase
  const setExpiry = (date) => {
    setState(s => ({ ...s, expiresAt: date }));
    try { supabase.from('mercado_state').upsert({ player: CONFIG_PLAYER, data: { expiresAt: date }, updated_at: new Date().toISOString() }); } catch {}
  };

  return (
    <div>
      <SectionHead title="Administrador" sub="Gerencie os prêmios da loja e controle as transações dos colaboradores." />

      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ id: 'premios', label: 'Prêmios', Icon: IcoGift }, { id: 'missoes', label: 'Missões', Icon: IcoTarget }, { id: 'transacoes', label: 'Transações', Icon: IcoReceipt }].map(t => {
          const on = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: on ? 700 : 600,
              border: `1.5px solid ${on ? 'transparent' : T.border}`, background: on ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : (T.surfaceSub || 'rgba(0,0,0,0.04)'),
              color: on ? '#fff' : T.textS,
            }}><t.Icon size={15} />{t.label}</button>
          );
        })}
      </div>

      {sub === 'transacoes' ? <AdminTransacoes flash={flash} isMobile={isMobile} cardBg={cardBg} adminName={player} ownSetState={setState} missionDefs={missionDefs} />
        : sub === 'missoes' ? <AdminMissoes missions={missionDefs} setMissions={setMissionDefs} flash={flash} isMobile={isMobile} cardBg={cardBg} />
        : (
      <>
      {/* Duração / expiração dos prêmios deste mês (global) */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px 20px', boxShadow: T.sh, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
          <span style={{ fontSize: 17 }}>🗓️</span>Duração dos prêmios deste mês
        </div>
        <div style={{ fontSize: 13, color: T.textT, marginBottom: 12, lineHeight: 1.5 }}>
          Defina até quando os prêmios ficam disponíveis. Depois dessa data eles expiram e ninguém mais consegue resgatar (vale para todos os colaboradores).
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>Expira em</label>
            <input type="date" value={expiresAt || ''} onChange={e => setExpiry(e.target.value)} style={{ ...fieldStyle, width: isMobile ? '100%' : 210, cursor: 'pointer' }} />
          </div>
          {expiresAt && (
            <button onClick={() => { setExpiry(''); flash('Prêmios sem data de expiração'); }} style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600 }}>Sem expiração</button>
          )}
        </div>
        {expiresAt && (() => {
          const exp = new Date(expiresAt + 'T23:59:59');
          const days = Math.ceil((exp - new Date()) / 86400000);
          const past = days < 0;
          return <div style={{ fontSize: 12.5, color: past ? '#C04050' : T.textT, marginTop: 10 }}>
            {past ? 'Os prêmios já expiraram.' : <>Expira em <b style={{ color: T.text }}>{new Date(expiresAt + 'T00:00:00').toLocaleDateString('pt-BR')}</b>{days >= 0 && <> · faltam <b style={{ color: T.text }}>{days}</b> dia{days === 1 ? '' : 's'}</>}</>}
          </div>;
        })()}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Cadastrar novo prêmio */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}><span style={{ color: T.gold }}><IcoPlus size={17} /></span>Novo item da loja</div>

          {/* Prêmio físico vs Uniko — Unikos entram na MESMA lista, não numa seção à parte */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[{ k: false, label: '🎁 Prêmio físico' }, { k: true, label: '🧬 Uniko' }].map(({ k, label }) => (
              <button key={String(k)} onClick={() => setIsUnikoMode(k)} style={{
                flex: 1, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
                border: `1.5px solid ${isUnikoMode === k ? T.gold : T.border}`, fontWeight: 700, fontSize: 12.5,
                background: isUnikoMode === k ? T.goldGl : 'transparent', color: isUnikoMode === k ? T.gold : T.textS,
              }}>{label}</button>
            ))}
          </div>

          {isUnikoMode ? (
            <>
              <label style={lbl}>Escolha o Uniko</label>
              <select value={unikoPickId} onChange={e => setUnikoPickId(e.target.value)} style={{ ...fieldStyle, marginBottom: 12, cursor: 'pointer' }}>
                <option value="">Selecione...</option>
                {availableUnikos.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {unikoPickId && (() => {
                const u = availableUnikos.find(x => x.id === unikoPickId);
                if (!u) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 10px', borderRadius: 10, background: T.surfaceSub || 'rgba(0,0,0,0.02)' }}>
                    <img src={u.img} alt={u.name} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: T.textT }}>{u.tagline}</div>
                  </div>
                );
              })()}
              {availableUnikos.length === 0 && <div style={{ fontSize: 12, color: T.textT, marginBottom: 12 }}>Todos os Unikos já estão na loja.</div>}
            </>
          ) : (
            <>
              <label style={lbl}>Nome do prêmio</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Vale-Presente R$100" style={{ ...fieldStyle, marginBottom: 12 }} />

              <label style={lbl}>Descrição</label>
              <textarea value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Descrição do prêmio" rows={2} style={{ ...fieldStyle, marginBottom: 12, resize: 'vertical' }} />

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 80 }}>
                  <label style={lbl}>Ícone</label>
                  <input value={form.emoji} onChange={e => set('emoji', e.target.value)} placeholder="🎁" style={{ ...fieldStyle, textAlign: 'center', fontSize: 20 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Raridade</label>
                  <select value={form.rarity} onChange={e => set('rarity', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
                    {RARITY_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <label style={lbl}>Fotos do prêmio <span style={{ textTransform: 'none', fontWeight: 500, color: T.textT }}>(1ª = capa)</span></label>
              <div style={{ marginBottom: 12 }}>
                <ImageManager images={form.images} onChange={imgs => set('images', imgs)} cardBg={cardBg} />
              </div>

              <label style={lbl}>Pago com</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[{ k: 'comum', label: 'Comum' }, { k: 'premium', label: 'Premium' }].map(({ k, label }) => (
                  <button key={k} onClick={() => set('cur', k)} style={{
                    flex: 1, padding: '8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
                    border: `1.5px solid ${form.cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.border}`, fontWeight: 600, fontSize: 13,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: form.cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) + '18' : 'transparent', color: form.cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.textS,
                  }}><PrismIcon type={k} size={15} />{label}</button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Preço ({isUnikoMode ? 'Prisma Comum' : 'prismas'})</label>
              <input type="number" min="1" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Qtd. disponível</label>
              <input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" style={fieldStyle} />
            </div>
          </div>

          <button onClick={addItem} style={primaryBtn(T.gold)}>{isUnikoMode ? 'Adicionar Uniko à loja' : 'Adicionar prêmio'}</button>
        </div>

        {/* Itens existentes (prêmios + Unikos, mesma lista) */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Itens da loja ({items.length})</div>
          <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>Use as setas ↑↓ pra reordenar — é a ordem exata que os colaboradores veem na Loja (o primeiro vira o destaque).</div>
          {items.length === 0 ? (
            <div style={{ color: T.textT, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Nenhum item cadastrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((i, idx) => {
                const rc = RARITY_COLOR[i.rarity] || T.textT;
                const nImgs = prizeImages(i).length;
                const open = editId === i.id;
                return (
                  <div key={i.id} style={{ borderRadius: 11, border: `1px solid ${open ? T.goldLine + '88' : T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.015)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                      {/* Mover pra cima/baixo (reordenação manual) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveItem(i.id, -1)} disabled={idx === 0} title="Mover pra cima" style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: idx === 0 ? T.textD : T.textS, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? .4 : 1, padding: 0 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button onClick={() => moveItem(i.id, 1)} disabled={idx === items.length - 1} title="Mover pra baixo" style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: idx === items.length - 1 ? T.textD : T.textS, cursor: idx === items.length - 1 ? 'default' : 'pointer', opacity: idx === items.length - 1 ? .4 : 1, padding: 0 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                      </div>
                      <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 9, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: cardBg, border: `1px solid ${T.border}` }}>
                        <PrizeMedia item={i} h={46} emojiSize={24} radius={0} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          {i.unikoId
                            ? <span style={{ fontSize: 10, fontWeight: 700, color: T.gold, textTransform: 'uppercase' }}>🧬 Uniko</span>
                            : <span style={{ fontSize: 10, fontWeight: 700, color: rc, textTransform: 'uppercase' }}>{i.rarity}</span>}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, ...prismText(i.cur) }}><PrismIcon type={i.cur} size={13} />{fmt(i.price)}</span>
                          <span style={{ fontSize: 10.5, color: T.textT }}>· {i.stock} em estoque{!i.unikoId && <> · {nImgs} foto{nImgs === 1 ? '' : 's'}</>}</span>
                        </div>
                      </div>
                      <button onClick={() => setEditId(open ? null : i.id)} title="Editar" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${open ? T.gold : T.border}`, background: open ? T.goldGl : 'transparent', color: open ? T.gold : T.textS, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        {open ? 'Fechar' : 'Editar'}
                      </button>
                      <button onClick={() => removeItem(i.id)} title="Remover" style={{ display: 'inline-flex', padding: 8, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: '#C04050', cursor: 'pointer' }}><IcoTrash size={15} /></button>
                    </div>
                    {open && (
                      <ItemEditor item={i} flash={flash} cardBg={cardBg}
                        onCancel={() => setEditId(null)}
                        onSave={(patch) => { patchItem(i.id, patch); setEditId(null); flash(`"${patch.name}" atualizado`); }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════ ADMIN → MISSÕES ════════════════
   Gerencia a DEFINIÇÃO das missões (tabela global mercado_missions): título,
   descrição, período, o que é medido, a meta e a recompensa. Antes isso era
   uma constante no código — mudar o valor de uma missão exigia deploy.

   A parte que NÃO fica aqui é o progresso/resgate de cada pessoa: isso continua
   no save do colaborador (mercado_state) e é calculado ao vivo pela métrica.
   Por isso EDITAR uma missão é seguro — quem já resgatou continua marcado como
   resgatado no período atual; só APAGAR faz o registro virar órfão (inofensivo).
   ═══════════════════════════════════════════════════════════════════════════ */
const MISSION_GAME_OPTIONS = [{ id: 'any', label: 'Qualquer jogo' }, ...PLAYTIME_GAMES];

// Frase curta explicando o que a missão mede — é o que o admin lê pra conferir
// se configurou o que queria, sem precisar saber o nome interno da métrica.
const missionRule = (m) => {
  const per = m.period === 'dia' ? 'por dia' : m.period === 'mes' ? 'no mês' : 'no total';
  switch (m.metric) {
    case 'playtime': return `${m.goal} min em ${m.game === 'any' ? 'qualquer jogo' : (GAME_LABEL[m.game] || m.game)} ${per}`;
    case 'compras':  return `${m.goal} compra${m.goal === 1 ? '' : 's'} na loja`;
    case 'colecao':  return `${m.goal} Uniko${m.goal === 1 ? '' : 's'} na Coleção`;
    case 'feedback': return `${m.goal} feedback${m.goal === 1 ? '' : 's'} ${per}`;
    case 'rank_mes': return `Top ${m.param || 1} de músicas do mês passado`;
    default:         return 'Sem medição automática';
  }
};

const MissionEditor = ({ mission, onSave, onCancel, flash, cardBg }) => {
  const [d, setD] = useState(() => ({
    title: mission.title || '', desc: mission.desc || '', period: mission.period || 'dia',
    metric: mission.metric || 'manual', game: mission.game || 'any', param: String(mission.param ?? 1),
    goal: String(mission.goal ?? 1), comum: String(mission.comum ?? 0), premium: String(mission.premium ?? 0),
    maintenance: !!mission.maintenance, active: mission.active !== false,
  }));
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const meta = METRIC_META[d.metric] || METRIC_META.manual;
  const fieldStyle = { width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: cardBg, color: T.text, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  const save = () => {
    const goal = parseInt(d.goal, 10);
    const comum = parseInt(d.comum, 10) || 0, premium = parseInt(d.premium, 10) || 0;
    if (!d.title.trim()) { flash('Informe o título da missão'); return; }
    if (!goal || goal <= 0) { flash('A meta precisa ser maior que zero'); return; }
    if (comum <= 0 && premium <= 0) { flash('A missão precisa dar pelo menos um prisma'); return; }
    onSave({
      title: d.title.trim(), desc: d.desc.trim(), period: d.period, metric: d.metric,
      game: meta.game ? d.game : 'any', param: meta.param ? (parseInt(d.param, 10) || 1) : 0,
      goal, comum, premium, maintenance: d.maintenance, active: d.active,
    });
  };

  const Toggle = ({ on, onClick, label, hint, color }) => (
    <button onClick={onClick} style={{
      flex: 1, textAlign: 'left', padding: '9px 11px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
      border: `1.5px solid ${on ? color : T.border}`, background: on ? color + '18' : 'transparent',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? color : T.textS }}>{on ? '● ' : '○ '}{label}</div>
      <div style={{ fontSize: 10.5, color: T.textT, marginTop: 1 }}>{hint}</div>
    </button>
  );

  return (
    <div style={{ padding: 12, borderTop: `1px dashed ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={lbl}>Título</label>
        <input value={d.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Maratona Uniko Paint" style={fieldStyle} />
      </div>
      <div>
        <label style={lbl}>Descrição <span style={{ textTransform: 'none', fontWeight: 500, color: T.textT }}>(é o que o colaborador lê no card)</span></label>
        <textarea value={d.desc} onChange={e => set('desc', e.target.value)} rows={2} placeholder="Ex: Jogue 15 minutos no Uniko Paint" style={{ ...fieldStyle, resize: 'vertical' }} />
      </div>

      <div>
        <label style={lbl}>Período</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {MISSION_PERIODS.map(p => {
            const on = d.period === p.id; const c = PERIOD_META[p.id]?.color || T.gold;
            return (
              <button key={p.id} onClick={() => set('period', p.id)} style={{
                flex: 1, padding: '8px 6px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
                border: `1.5px solid ${on ? c : T.border}`, background: on ? c + '18' : 'transparent', color: on ? c : T.textS,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.label}</div>
                <div style={{ fontSize: 10, color: T.textT }}>{p.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={lbl}>O que é medido</label>
        <select value={d.metric} onChange={e => set('metric', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
          {MISSION_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <div style={{ fontSize: 11.5, color: T.textT, marginTop: 5, lineHeight: 1.45 }}>{meta.hint}</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {meta.game && (
          <div style={{ flex: 1 }}>
            <label style={lbl}>Jogo</label>
            <select value={d.game} onChange={e => set('game', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
              {MISSION_GAME_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
        )}
        {meta.param && (
          <div style={{ flex: 1 }}>
            <label style={lbl}>{meta.param}</label>
            <input type="number" min="1" value={d.param} onChange={e => set('param', e.target.value)} style={fieldStyle} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <label style={lbl}>Meta ({meta.unit})</label>
          <input type="number" min="1" value={d.goal} onChange={e => set('goal', e.target.value)} style={fieldStyle} />
        </div>
      </div>

      <div>
        <label style={lbl}>Recompensa</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{ k: 'comum', label: 'Prisma Comum' }, { k: 'premium', label: 'Prisma Premium' }].map(({ k, label }) => (
            <div key={k} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: T.textT, marginBottom: 4 }}><PrismIcon type={k} size={14} />{label}</div>
              <input type="number" min="0" value={d[k]} onChange={e => set(k, e.target.value)} style={fieldStyle} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: T.textT, marginTop: 5 }}>Pode dar as duas moedas na mesma missão. Deixe 0 na que não usar.</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Toggle on={d.active} color="#16a34a" label={d.active ? 'Ativa' : 'Desativada'}
          hint={d.active ? 'Aparece pros colaboradores' : 'Escondida da aba Missões'}
          onClick={() => set('active', !d.active)} />
        <Toggle on={d.maintenance} color="#E8A020" label="Em manutenção"
          hint="Aparece cinza e não pode ser resgatada"
          onClick={() => set('maintenance', !d.maintenance)} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={save} style={{ flex: 1, padding: 11, borderRadius: 9, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}bb)`, color: '#fff', fontWeight: 800, fontSize: 13.5, fontFamily: 'var(--font-body)' }}>Salvar missão</button>
        <button onClick={onCancel} style={{ padding: '11px 16px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
};

const NEW_MISSION = { id: '', title: '', desc: '', period: 'dia', metric: 'playtime', game: 'wave', param: 1, goal: 15, comum: 100, premium: 0, maintenance: false, active: true };

const AdminMissoes = ({ missions, setMissions, flash, isMobile, cardBg }) => {
  const [editId, setEditId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Grava a lista inteira no Supabase. `removed` = ids que saíram (a tabela é a
  // fonte da verdade, então o que sumiu da lista precisa ser DELETADO lá também,
  // senão volta no próximo carregamento).
  const commit = async (next, removed = []) => {
    setMissions(next);
    setSaving(true);
    try { await saveMissionDefs(next, removed); }
    catch (e) { console.error('[prisma-store] falha ao salvar missões:', e); flash('Não consegui salvar no servidor — veja o console'); }
    setSaving(false);
  };

  const addMission = (data) => {
    const id = 'm' + Date.now().toString(36);
    commit([...missions, { ...data, id, progress: 0, claimed: false }]);
    setCreating(false);
    flash(`Missão "${data.title}" criada`);
  };
  const patchMission = (id, patch) => commit(missions.map(m => m.id === id ? { ...m, ...patch } : m));
  const removeMission = (m) => {
    if (!window.confirm(`Apagar a missão "${m.title}"? Ela some da aba Missões de todos os colaboradores.`)) return;
    commit(missions.filter(x => x.id !== m.id), [m.id]);
    flash('Missão apagada');
  };
  const moveMission = (id, dir) => {
    const idx = missions.findIndex(m => m.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= missions.length) return;
    const arr = [...missions];
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    commit(arr);
  };

  const totalComum = missions.filter(m => m.active !== false && !m.maintenance).reduce((a, m) => a + (m.comum || 0), 0);
  const totalPremium = missions.filter(m => m.active !== false && !m.maintenance).reduce((a, m) => a + (m.premium || 0), 0);

  return (
    <div>
      {/* Aviso de terreno preparado — as missões por minuto jogado já leem dados reais */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px 20px', boxShadow: T.sh, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}><span style={{ fontSize: 17 }}>🎯</span>Gerenciar missões</div>
        <div style={{ fontSize: 13, color: T.textT, lineHeight: 1.55 }}>
          Cada missão escolhe <b style={{ color: T.text }}>o que é medido</b>, a <b style={{ color: T.text }}>meta</b> e a <b style={{ color: T.text }}>recompensa</b> — vale pra todos os colaboradores na hora.
          O tempo de partida já é registrado em <b style={{ color: T.text }}>{PLAYTIME_GAMES.map(g => g.label).join(', ')}</b>, então dá pra criar missões de minutos jogados em qualquer um deles.
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: T.textT }}>
          <span>{missions.filter(m => m.active !== false).length} ativa{missions.filter(m => m.active !== false).length === 1 ? '' : 's'} de {missions.length}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Máx. por rodada: <PrismIcon type="comum" size={14} /><b style={{ color: COMUM.color }}>{fmt(totalComum)}</b></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PrismIcon type="premium" size={14} /><b style={prismText('premium')}>{fmt(totalPremium)}</b></span>
          {saving && <span style={{ color: T.gold, fontWeight: 700 }}>salvando...</span>}
        </div>
      </div>

      {/* Nova missão */}
      <div style={{ background: cardBg, border: `1px solid ${creating ? T.goldLine + '88' : T.border}`, borderRadius: 16, boxShadow: T.sh, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => { setCreating(c => !c); setEditId(null); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', background: 'transparent',
          border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: T.text,
        }}>
          <span style={{ color: T.gold }}><IcoPlus size={17} /></span>{creating ? 'Cancelar nova missão' : 'Criar nova missão'}
        </button>
        {creating && <MissionEditor mission={NEW_MISSION} flash={flash} cardBg={cardBg} onCancel={() => setCreating(false)} onSave={addMission} />}
      </div>

      {/* Lista */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Missões cadastradas ({missions.length})</div>
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>Use as setas ↑↓ pra reordenar — é a ordem exata da aba Missões dos colaboradores.</div>
        {missions.length === 0 ? (
          <div style={{ color: T.textT, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Nenhuma missão cadastrada.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missions.map((m, idx) => {
              const open = editId === m.id;
              const pm = PERIOD_META[m.period] || PERIOD_META.dia;
              const off = m.active === false;
              return (
                <div key={m.id} style={{ borderRadius: 11, border: `1px solid ${open ? T.goldLine + '88' : T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.015)', overflow: 'hidden', opacity: off ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => moveMission(m.id, -1)} disabled={idx === 0} title="Mover pra cima" style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: idx === 0 ? T.textD : T.textS, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? .4 : 1, padding: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button onClick={() => moveMission(m.id, 1)} disabled={idx === missions.length - 1} title="Mover pra baixo" style={{ width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: idx === missions.length - 1 ? T.textD : T.textS, cursor: idx === missions.length - 1 ? 'default' : 'pointer', opacity: idx === missions.length - 1 ? .4 : 1, padding: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.title}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: pm.color, background: pm.color + '22', border: `1px solid ${pm.color}55`, padding: '1px 7px', borderRadius: 999 }}>{pm.label}</span>
                        {m.maintenance && <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#E8A020' }}>🔧 manutenção</span>}
                        {off && <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: T.textD }}>desativada</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>{missionRule(m)}{m.desc ? ` · "${m.desc}"` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {!!m.comum && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700, color: COMUM.color }}><PrismIcon type="comum" size={14} />{m.comum}</span>}
                      {!!m.premium && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12.5, fontWeight: 700 }}><PrismIcon type="premium" size={14} /><span style={prismText('premium')}>{m.premium}</span></span>}
                    </div>
                    <button onClick={() => patchMission(m.id, { active: off })} title={off ? 'Ativar' : 'Desativar'} style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: off ? '#16a34a' : T.textS, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0 }}>{off ? 'Ativar' : 'Pausar'}</button>
                    <button onClick={() => { setEditId(open ? null : m.id); setCreating(false); }} title="Editar" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${open ? T.gold : T.border}`, background: open ? T.goldGl : 'transparent', color: open ? T.gold : T.textS, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      {open ? 'Fechar' : 'Editar'}
                    </button>
                    <button onClick={() => removeMission(m)} title="Apagar" style={{ display: 'inline-flex', padding: 8, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: '#C04050', cursor: 'pointer', flexShrink: 0 }}><IcoTrash size={15} /></button>
                  </div>
                  {open && (
                    <MissionEditor mission={m} flash={flash} cardBg={cardBg}
                      onCancel={() => setEditId(null)}
                      onSave={(patch) => { patchMission(m.id, patch); setEditId(null); flash(`"${patch.title}" atualizada`); }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Controle de transações: vê o histórico de todos e transfere prismas
const AdminTransacoes = ({ flash, isMobile, cardBg, adminName, ownSetState, missionDefs }) => {
  const [hist, setHist] = useState([]);
  const [wallets, setWallets] = useState([]); // [{player, comum, premium}]
  const [busy, setBusy] = useState(true);
  const [to, setTo] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [openTo, setOpenTo] = useState(false);
  const [cur, setCur] = useState('premium');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [dir, setDir] = useState('add'); // add | remove (de um colaborador específico)
  const [bulkCur, setBulkCur] = useState('premium');
  const [bulkAmt, setBulkAmt] = useState('');
  const [kindFilter, setKindFilter] = useState('all'); // all | compra | compra_uniko | checkin | ...
  const [playerQuery, setPlayerQuery] = useState(''); // busca por colaborador nas Transações de todos
  const allPlayers = useAllPlayers();

  const load = async () => {
    setBusy(true);
    try {
      const { data: h } = await supabase.from('mercado_history').select('*').order('created_at', { ascending: false }).limit(200);
      setHist((h || []).map(histFromRow).map((r, idx) => ({ ...r, _p: (h[idx] || {}).player })));
      const { data: ws } = await supabase.from('mercado_state').select('player,data');
      setWallets((ws || []).filter(w => w.player !== CONFIG_PLAYER).map(w => ({ player: w.player, comum: w.data?.comum || 0, premium: w.data?.premium || 0 })).sort((a, b) => a.player.localeCompare(b.player)));
    } catch {}
    setBusy(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  // Lista de destinatários: TODOS os colaboradores + carteiras existentes
  const players = [...new Set([...allPlayers, ...wallets.map(w => w.player)])].sort((a, b) => a.localeCompare(b));
  const toMatches = players.filter(p => p.toLowerCase().includes(toQuery.trim().toLowerCase()));

  const transfer = async () => {
    const amt = parseInt(amount, 10);
    if (!to) { flash('Escolha o destinatário'); return; }
    if (!amt || amt <= 0) { flash('Informe um valor válido'); return; }
    try {
      // Lê só pra saber o delta REAL a logar no histórico (retirada não passa de 0) —
      // a gravação em si é atômica (mercado_credit), não depende dessa leitura.
      const { data: row } = await supabase.from('mercado_state').select('data').eq('player', to).maybeSingle();
      const cur0 = row?.data?.[cur] || 0;
      const remove = dir === 'remove';
      const delta = remove ? -Math.min(amt, cur0) : amt;
      const { error } = await supabase.rpc('mercado_credit', { p_player: to, p_comum: cur === 'comum' ? delta : 0, p_premium: cur === 'premium' ? delta : 0 });
      if (error) throw error;
      await supabase.from('mercado_history').insert({ player: to, kind: 'admin', descr: note.trim() || (remove ? 'Retirada do administrador' : 'Transferência do administrador'), [cur]: delta });
      // Se mexeu na própria carteira, reflete no estado local
      if (to === adminName && ownSetState) ownSetState(s => ({ ...s, [cur]: Math.max(0, (s[cur] || 0) + delta) }));
      const label = cur === 'premium' ? PREMIUM.name : COMUM.name;
      flash(`${delta >= 0 ? '+' : ''}${delta} ${label} → ${to}`);
      setAmount(''); setNote(''); setTo(''); setToQuery('');
      load();
    } catch { flash('Falha na operação'); }
  };

  // Aplica uma mutação na carteira de TODOS os colaboradores que têm carteira (preserva o resto do estado).
  const bulkApply = async (mutate, descr, histEntry) => {
    setBusy(true);
    // 1) Aplica PRIMEIRO no próprio admin, com updatedAt novo. Tem que vir antes do loop (e fora
    //    do try/catch dele) p/ NUNCA ser pulado se uma gravação em massa falhar; o updatedAt novo
    //    garante que o estado resetado vença o cache local/nuvem antigo na próxima hidratação.
    if (ownSetState) ownSetState(s => ({ ...s, ...mutate(s, { comum: s.comum, premium: s.premium, player: adminName }), updatedAt: Date.now() }));
    let failures = 0;
    // 2) Aplica em cada colaborador — um erro num não pode abortar os demais (try/catch por item).
    for (const w of wallets) {
      if (w.player === CONFIG_PLAYER) continue; // nunca mexer na linha de config global
      try {
        const { data: row } = await supabase.from('mercado_state').select('data').eq('player', w.player).maybeSingle();
        const base = row?.data && Object.keys(row.data).length ? row.data : USER_SLICE(DEFAULT_STATE);
        const data = { ...base, ...mutate(base, w), updatedAt: Date.now() };
        await supabase.from('mercado_state').upsert({ player: w.player, data, updated_at: new Date().toISOString() });
        const entry = histEntry(w);
        if (entry && Object.keys(entry).length) await supabase.from('mercado_history').insert({ player: w.player, kind: 'admin', descr, ...entry });
      } catch { failures++; }
    }
    load();
    setBusy(false);
    if (failures) flash(`Concluído, mas ${failures} carteira(s) falharam`);
  };

  const bulkRemove = async () => {
    const amt = parseInt(bulkAmt, 10);
    if (!amt || amt <= 0) { flash('Informe um valor válido'); return; }
    const label = bulkCur === 'premium' ? PREMIUM.name : COMUM.name;
    if (!window.confirm(`Retirar ${amt} ${label} de TODOS os ${wallets.length} colaboradores? Esta ação não pode ser desfeita.`)) return;
    await bulkApply(
      (base) => ({ [bulkCur]: Math.max(0, (base[bulkCur] || 0) - amt) }),
      `Retirada do administrador (−${amt} ${label})`,
      (w) => { const taken = Math.min(amt, w[bulkCur] || 0); return taken > 0 ? { [bulkCur]: -taken } : {}; },
    );
    flash(`Retirado ${amt} ${label} de todos`);
    setBulkAmt('');
  };

  const bulkZero = async () => {
    if (!window.confirm(`ZERAR os prismas (Comum e Premium) de TODOS os ${wallets.length} colaboradores? Esta ação não pode ser desfeita.`)) return;
    await bulkApply(
      () => ({ comum: 0, premium: 0 }),
      'Prismas zerados pelo administrador',
      (w) => { const e = {}; if ((w.comum || 0) > 0) e.comum = -(w.comum || 0); if ((w.premium || 0) > 0) e.premium = -(w.premium || 0); return e; },
    );
    flash('Prismas de todos zerados');
  };

  const bulkResetCheckin = async () => {
    if (!window.confirm(`Resetar o CHECK-IN de TODOS os ${wallets.length} colaboradores? Zera a sequência e o teto mensal — todos poderão fazer check-in de novo.`)) return;
    await bulkApply(
      () => ({ checkins: [], capMonth: '', earned: { premium: 0, comum: 0 } }),
      'Check-in resetado pelo administrador',
      () => ({}),
    );
    flash('Check-in de todos resetado');
  };

  const bulkResetMissions = async () => {
    if (!window.confirm(`Resetar as MISSÕES de TODOS os ${wallets.length} colaboradores? Zera o progresso (Voz ativa/Maratona voltam a 0) e todas voltam a poder ser resgatadas.`)) return;
    // Snapshot do baseline (valor BRUTO atual de feedbacks do mês / minutos de hoje) por jogador,
    // incluindo o admin → o progresso ao vivo passa a contar só o que vier DEPOIS do reset.
    const players = [...wallets.map(w => w.player), adminName];
    let baselines = {};
    try { baselines = await snapshotMissionBaseline({ players, missions: missionDefs }); } catch {}
    await bulkApply(
      (base, w) => ({
        missions: [],   // apaga os resgates → todas voltam a poder ser resgatadas
        missionBaseline: { ...(base?.missionBaseline || {}), ...(baselines[(w?.player || '').trim()] || {}) },
      }),
      'Missões resetadas pelo administrador',
      () => ({}),
    );
    flash('Missões de todos resetadas');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Adicionar / Retirar prismas de um colaborador */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 12 }}><span style={{ color: T.gold }}><IcoSend size={16} /></span>{dir === 'remove' ? 'Retirar prismas' : 'Adicionar prismas'}</div>
        {/* Direção */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ k: 'add', label: '＋ Adicionar', c: '#16a34a' }, { k: 'remove', label: '－ Retirar', c: '#C04050' }].map(({ k, label, c }) => {
            const on = dir === k;
            return (
              <button key={k} onClick={() => setDir(k)} style={{
                flex: 1, padding: '8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: on ? 700 : 600, fontSize: 13,
                border: `1.5px solid ${on ? c : T.border}`, background: on ? c + '18' : 'transparent', color: on ? c : T.textS,
              }}>{label}</button>
            );
          })}
        </div>
        <label style={lbl}>{dir === 'remove' ? 'De quem retirar' : 'Para'}</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 13, pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={toQuery}
            onChange={e => { setToQuery(e.target.value); setTo(''); setOpenTo(true); }}
            onFocus={() => setOpenTo(true)} onBlur={() => setTimeout(() => setOpenTo(false), 150)}
            placeholder="Pesquisar colaborador..." style={{ ...adminField, paddingLeft: 34 }} />
          {to && !openTo && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 12, top: 12 }}><polyline points="20 6 9 17 4 12" /></svg>}
          {openTo && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30, background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.shL || '0 8px 24px rgba(0,0,0,0.18)', maxHeight: 220, overflowY: 'auto' }}>
              {toMatches.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: T.textT }}>Nenhum colaborador encontrado</div>
                : toMatches.map(p => (
                  <div key={p} onMouseDown={() => { setTo(p); setToQuery(p); setOpenTo(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', fontSize: 13.5, color: T.text }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surfaceSub || 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <AvatarCircle name={p} size={24} fontSize={9} />{p}
                  </div>
                ))}
            </div>
          )}
        </div>
        <label style={lbl}>Moeda</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[{ k: 'comum', label: 'Comum' }, { k: 'premium', label: 'Premium' }].map(({ k, label }) => (
            <button key={k} onClick={() => setCur(k)} style={{
              flex: 1, padding: '8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.border}`, fontWeight: 600, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) + '18' : 'transparent', color: cur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.textS,
            }}><PrismIcon type={k} size={15} />{label}</button>
          ))}
        </div>
        <label style={lbl}>Quantidade</label>
        <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ ...adminField, marginBottom: 12 }} />
        <label style={lbl}>Observação (opcional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={dir === 'remove' ? 'Ex: estorno / ajuste' : 'Ex: bônus de desempenho'} style={{ ...adminField, marginBottom: 16 }} />
        <button onClick={transfer} disabled={busy} style={dir === 'remove'
          ? { width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer', background: '#C04050', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)' }
          : primaryBtn(T.gold)}>{dir === 'remove' ? 'Retirar' : 'Adicionar'}</button>

        {/* Saldos atuais */}
        <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>Saldos ({wallets.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
          {wallets.length === 0 ? <div style={{ fontSize: 12, color: T.textT }}>Nenhuma carteira ainda.</div> : wallets.map(w => (
            <div key={w.player} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 0, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.player}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: COMUM.color }}><PrismIcon type="comum" size={13} />{fmt(w.comum)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700 }}><PrismIcon type="premium" size={15} /><span style={prismText('premium')}>{fmt(w.premium)}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Ações em massa (retirar / zerar prismas de todos) */}
      <div style={{ background: cardBg, border: `1px solid #C0405040`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: '#C04050', marginBottom: 4 }}>⚠️ Ações em massa</div>
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>Afeta a carteira de <b>todos</b> os colaboradores. Não pode ser desfeito.</div>

        <label style={lbl}>Retirar de todos</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[{ k: 'comum', label: 'Comum' }, { k: 'premium', label: 'Premium' }].map(({ k, label }) => (
            <button key={k} onClick={() => setBulkCur(k)} style={{
              flex: 1, padding: '8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${bulkCur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.border}`, fontWeight: 600, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: bulkCur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) + '18' : 'transparent', color: bulkCur === k ? (k === 'premium' ? PREMIUM.color : COMUM.color) : T.textS,
            }}><PrismIcon type={k} size={15} />{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input type="number" min="1" value={bulkAmt} onChange={e => setBulkAmt(e.target.value)} placeholder="Quantidade" style={{ ...adminField, flex: 1 }} />
          <button onClick={bulkRemove} disabled={busy} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer', background: '#C04050', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)', flexShrink: 0 }}>Retirar</button>
        </div>

        <button onClick={bulkZero} disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1.5px solid #C04050', cursor: busy ? 'wait' : 'pointer', background: 'transparent', color: '#C04050', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-body)' }}>
          Zerar prismas de TODOS
        </button>

        <div style={{ height: 1, background: T.border, margin: '14px 0 12px' }} />
        <label style={lbl}>Resetar progresso de todos</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={bulkResetCheckin} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${T.border}`, cursor: busy ? 'wait' : 'pointer', background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)' }}>↺ Check-in</button>
          <button onClick={bulkResetMissions} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${T.border}`, cursor: busy ? 'wait' : 'pointer', background: 'transparent', color: T.textS, fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font-body)' }}>↺ Missões</button>
        </div>
      </div>
      </div>

      {/* Histórico de todos */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Transações de todos</div>
          <button onClick={load} title="Atualizar" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>Atualizar
          </button>
        </div>
        {/* Busca por colaborador — filtra a lista pra ver só o histórico de uma pessoa
            (tudo que ela ganhou, gastou e resgatou), combinando com o filtro de tipo abaixo */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} placeholder="Buscar colaborador nas transações..."
            style={{ ...adminField, paddingLeft: 34, paddingRight: playerQuery ? 34 : 12 }} />
          {playerQuery && (
            <button onClick={() => setPlayerQuery('')} aria-label="Limpar busca" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: T.surfaceSub || 'rgba(0,0,0,0.06)', color: T.textT, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          )}
        </div>
        {/* Filtro por tipo — deixa fácil isolar só "Compra" (prêmio da loja) ou "Compra de Uniko" */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[{ id: 'all', label: 'Todos' }, ...Object.entries(KIND_META).map(([id, m]) => ({ id, label: m.label }))].map(f => {
            const on = kindFilter === f.id;
            return (
              <button key={f.id} onClick={() => setKindFilter(f.id)} style={{
                padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${on ? T.gold : T.border}`, cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: on ? 700 : 500,
                background: on ? T.goldGl : 'transparent', color: on ? T.gold : T.textS,
              }}>{f.label}</button>
            );
          })}
        </div>
        {(() => {
          const q = playerQuery.trim().toLowerCase();
          const nameFiltered = q ? hist.filter(h => (h._p || '').toLowerCase().includes(q)) : hist;
          const histFiltered = kindFilter === 'all' ? nameFiltered : nameFiltered.filter(h => h.kind === kindFilter);
          // Resumo do que a pessoa buscada ganhou/gastou no total (soma dos deltas positivos e
          // negativos de cada moeda) — dá pra ver o saldo movimentado sem contar linha por linha.
          const summary = q ? histFiltered.reduce((acc, h) => {
            for (const c of ['comum', 'premium']) {
              if (h[c] == null) continue;
              if (h[c] >= 0) acc[c].ganho += h[c]; else acc[c].gasto += -h[c];
            }
            return acc;
          }, { comum: { ganho: 0, gasto: 0 }, premium: { ganho: 0, gasto: 0 } }) : null;
          return busy ? <div style={{ fontSize: 13, color: T.textT, padding: '16px 0', textAlign: 'center' }}>Carregando…</div>
          : histFiltered.length === 0 ? <div style={{ fontSize: 13, color: T.textT, padding: '16px 0', textAlign: 'center' }}>Nenhuma transação encontrada.</div>
            : (
              <div>
                {summary && (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '9px 13px', borderRadius: 10, background: T.goldGl, border: `1px solid ${T.goldLine}44`, marginBottom: 10, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: T.text }}>{histFiltered.length} transaç{histFiltered.length === 1 ? 'ão' : 'ões'}</span>
                    {['comum', 'premium'].map(c => (
                      <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <PrismIcon type={c} size={14} />
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>+{fmt(summary[c].ganho)}</span>
                        <span style={{ color: T.textD }}>/</span>
                        <span style={{ color: '#C04050', fontWeight: 700 }}>−{fmt(summary[c].gasto)}</span>
                      </span>
                    ))}
                  </div>
                )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
                {histFiltered.map(h => {
                  const meta = KIND_META[h.kind] || { Icon: IcoReceipt, label: h.kind };
                  const MIcon = meta.Icon;
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.015)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MIcon size={15} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h._p}</div>
                        <div style={{ fontSize: 11.5, color: T.textT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.desc} · {h.date}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        {['comum', 'premium'].map(c => h[c] != null && (
                          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700 }}>
                            <span style={h[c] >= 0 ? { color: '#16a34a' } : (c === 'premium' ? prismText('premium') : { color: COMUM.color })}>{h[c] >= 0 ? '+' : ''}{fmt(h[c])}</span>
                            <PrismIcon type={c} size={15} />
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            );
        })()}
      </div>
    </div>
  );
};
const adminField = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

// ─── helpers de UI ──────────────────────────────────────────────────────────
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textD, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 };
const primaryBtn = (color) => ({ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${color},${color}bb)`, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)' });

const SectionHead = ({ title, sub }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: '-.01em' }}>{title}</div>
    {sub && <div style={{ fontSize: 12.5, color: T.textT, marginTop: 2 }}>{sub}</div>}
  </div>
);

export default MercadoEstelar;
