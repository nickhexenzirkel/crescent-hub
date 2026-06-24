import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { Logo, AvatarCircle } from '../../shared/components';
import { useIsMobile } from '../../hooks/useIsMobile';

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
const EXCHANGE_RATE = 500;

// ── CHECK-IN: ciclo de 7 dias, ganhos crescentes que INTERCALAM a moeda ──
// O dia do ciclo vem do "streak" (dias seguidos). Errar 1 dia zera → volta ao dia 1.
// Como os valores crescem, não vale a pena ficar só no dia 1.
const CHECKIN_CYCLE = [
  { amount: 50,  cur: 'premium' }, // dia 1
  { amount: 80,  cur: 'comum'   }, // dia 2
  { amount: 100, cur: 'premium' }, // dia 3
  { amount: 50,  cur: 'comum'   }, // dia 4
  { amount: 90,  cur: 'premium' }, // dia 5
  { amount: 120, cur: 'comum'   }, // dia 6
  { amount: 150, cur: 'premium' }, // dia 7 (bônus de semana)
];
// Teto MENSAL de ganho do check-in por moeda (mesmo intercalando)
const MONTHLY_CAP = { premium: 300, comum: 200 };
const cycleReward = (streak) => CHECKIN_CYCLE[((streak - 1) % CHECKIN_CYCLE.length + CHECKIN_CYCLE.length) % CHECKIN_CYCLE.length];

// Quantos dias seguidos (contando o de hoje) terá o próximo check-in.
// Conta dias anteriores consecutivos presentes na lista; se faltou um, recomeça em 1.
const computeStreak = (checkins) => {
  const set = new Set(checkins || []);
  let streak = 1; const d = new Date(); d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
};

const MONTH_NAMES =['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad2 = (n) => String(n).padStart(2, '0');

const STORAGE_KEY = 'me_state_v2';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

const COLABORADORES = [
  'Alan Matos', 'Brenda Késia', 'Cleanderson Pereira', 'Gleydson Marques',
  'Guilherme Alves', 'Karina Barbosa', 'Mara Almeida', 'Maria Renata', 'Mikael Araújo',
];

const RARITY_COLOR = {
  'Comum':    '#7A92A8',
  'Raro':     '#2E8DD4',
  'Épico':    '#9B6FE8',
  'Lendário': '#F5B63A',
};
const RARITY_RANK = { 'Comum': 0, 'Raro': 1, 'Épico': 2, 'Lendário': 3 };

const DEFAULT_STATE = {
  comum: 1480,
  premium: 320,
  checkins: [],
  collection: [],
  // Controle do teto mensal do check-in (reinicia a cada mês)
  capMonth: '',
  earned: { premium: 0, comum: 0 },
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
  // DESAFIOS (period: 'dia' | 'mes' | 'unica'). Progresso é mockado por enquanto
  // (o acompanhamento real vem com o Supabase).
  missions: [
    { id: 'c_uniko20',  title: 'Maratona Uniko Wave',  desc: 'Jogue Uniko Wave por 20 minutos',                 period: 'dia',   progress: 12,  goal: 20,  comum: 0,   premium: 30,  claimed: false },
    { id: 'c_music10',  title: 'DJ do dia',            desc: 'Peça 10 músicas no Nico Music',                   period: 'dia',   progress: 6,   goal: 10,  comum: 0,   premium: 10,  claimed: false },
    { id: 'c_firstbuy', title: 'Primeira compra',      desc: 'Faça sua primeira compra na Prisma Store',        period: 'unica', progress: 0,   goal: 1,   comum: 150, premium: 0,   claimed: false },
    { id: 'c_ponto',    title: 'Presença impecável',   desc: '100% de presença sem ocorrências no ponto',       period: 'mes',   progress: 1,   goal: 1,   comum: 0,   premium: 80,  claimed: false },
    { id: 'c_feedback', title: 'Voz ativa',            desc: 'Dê um feedback no sistema',                       period: 'mes',   progress: 0,   goal: 1,   comum: 0,   premium: 30,  claimed: false },
    { id: 'c_rank1',    title: '🥇 Top 1 do Nico Music',desc: '1º lugar de quem mais pediu música no mês',       period: 'mes',   progress: 0,   goal: 1,   comum: 0,   premium: 100, claimed: false },
    { id: 'c_rank2',    title: '🥈 Top 2 do Nico Music',desc: '2º lugar de quem mais pediu música no mês',       period: 'mes',   progress: 0,   goal: 1,   comum: 0,   premium: 70,  claimed: false },
    { id: 'c_rank3',    title: '🥉 Top 3 do Nico Music',desc: '3º lugar de quem mais pediu música no mês',       period: 'mes',   progress: 0,   goal: 1,   comum: 0,   premium: 50,  claimed: false },
    { id: 'c_setor',    title: 'Setor nota 90+',       desc: 'Seu setor passou de 90% no chatbot do mês',       period: 'mes',   progress: 1,   goal: 1,   comum: 200, premium: 0,   claimed: false },
  ],
  history: [
    { id: 'h0', kind: 'checkin', desc: 'Check-in diário', premium: 50, date: '2026-06-20' },
  ],
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // Catálogo de itens: o admin gerencia (adiciona/edita/remove), então o save
      // é a fonte da verdade; só cai no DEFAULT na 1ª vez (sem itens salvos).
      const items = Array.isArray(s.items) && s.items.length ? s.items : DEFAULT_STATE.items;
      // Missões: mantém progresso/resgate salvos, adiciona novas do default
      const savedM = new Set((s.missions || []).map(x => x.id));
      const missions = [...(s.missions || []), ...DEFAULT_STATE.missions.filter(x => !savedM.has(x.id))];
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

const MercadoEstelar = ({ onBack, authUser, userPhoto }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('loja');
  const [state, setState] = useState(loadState);
  const [toast, setToast] = useState('');

  const cardBg = T.surface;
  const userName = authUser?.name || 'Colaborador';
  const isAdmin = authUser?.role === 'admin';

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2600); };

  const addHistory = (entry) =>
    setState(s => ({ ...s, history: [{ id: 'h' + Date.now(), date: todayStr(), ...entry }, ...s.history] }));

  // ── Compra na loja ──
  const buyItem = (item) => {
    if (item.stock <= 0) return;
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
      };
    });
    addHistory({ kind: 'compra', desc: `Comprou “${item.name}”`, [item.cur]: -item.price });
    flash(`Você resgatou: ${item.name}`);
  };

  // ── Check-in (streak + ciclo de 7 dias + teto mensal por moeda) ──
  const today = todayStr();
  const monthKey = today.slice(0, 7);
  const canCheckin = !(state.checkins || []).includes(today);
  const streak = computeStreak(state.checkins);                 // dia do ciclo que o check-in de hoje terá
  const nextReward = cycleReward(streak);
  // Ganhos do check-in já obtidos neste mês (reinicia quando o mês muda)
  const earned = state.capMonth === monthKey ? (state.earned || { premium: 0, comum: 0 }) : { premium: 0, comum: 0 };
  const capRemaining = { premium: Math.max(0, MONTHLY_CAP.premium - earned.premium), comum: Math.max(0, MONTHLY_CAP.comum - earned.comum) };

  const doCheckin = () => {
    if (!canCheckin) return;
    const cur = nextReward.cur;
    const give = Math.min(nextReward.amount, capRemaining[cur]); // respeita o teto mensal
    setState(s => {
      const base = s.capMonth === monthKey ? (s.earned || { premium: 0, comum: 0 }) : { premium: 0, comum: 0 };
      return {
        ...s,
        [cur]: s[cur] + give,
        checkins: [...(s.checkins || []), today],
        capMonth: monthKey,
        earned: { ...base, [cur]: base[cur] + give },
      };
    });
    if (give > 0) addHistory({ kind: 'checkin', desc: `Check-in · dia ${streak} de sequência`, [cur]: give });
    const label = cur === 'premium' ? PREMIUM.name : COMUM.name;
    flash(give > 0 ? `Check-in feito! +${give} ${label} (dia ${streak})` : `Check-in feito! Teto mensal de ${label} já atingido.`);
  };

  // ── Missões ──
  const claimMission = (m) => {
    if (m.progress < m.goal || m.claimed) return;
    setState(s => ({
      ...s, comum: s.comum + (m.comum || 0), premium: s.premium + (m.premium || 0),
      missions: s.missions.map(x => x.id === m.id ? { ...x, claimed: true } : x),
    }));
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
        {!isMobile && <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: 'var(--font-brand)', letterSpacing: '.04em' }}>Mercado Estelar</span>}
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
      <div style={{ flex: 1, maxWidth: 1240, margin: '0 auto', width: '100%', padding: isMobile ? '12px' : '20px 24px 40px' }}>
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <PrismChip type="comum" amount={state.comum} />
            <PrismChip type="premium" amount={state.premium} />
          </div>
        )}

        {tab === 'loja'      && <Loja items={state.items} balances={state} onBuy={buyItem} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'colecao'   && <Colecao collection={state.collection || []} items={state.items} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'missoes'   && <Missoes missions={state.missions} onClaim={claimMission} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'carteira'  && <Carteira state={state} setState={setState} addHistory={addHistory} flash={flash} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'checkin'   && <Checkin canCheckin={canCheckin} onCheckin={doCheckin} checkins={state.checkins || []} streak={streak} nextReward={nextReward} earned={earned} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'historico' && <Historico history={state.history} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'admin' && isAdmin && <Admin items={state.items} setState={setState} flash={flash} isMobile={isMobile} cardBg={cardBg} />}
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
const MonthCountdown = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime(); // início do próximo mês
  const diff = Math.max(0, end - now);
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: T.goldGl, border: `1px solid ${T.goldLine}44`, borderRadius: 14, padding: '12px 18px', marginBottom: 14 }}>
      <span style={{ display: 'inline-flex', color: T.gold }}><IcoClock size={24} /></span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Prêmios deste mês</div>
        <div style={{ fontSize: 11.5, color: T.textT }}>Renovam quando o cronômetro zerar — aproveite antes que esgotem!</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Unit v={days} l="dias" /><Sep /><Unit v={hours} l="hrs" /><Sep /><Unit v={mins} l="min" /><Sep /><Unit v={secs} l="seg" />
      </div>
    </div>
  );
};
const Sep = () => <span style={{ fontSize: 16, fontWeight: 800, color: T.textD, alignSelf: 'flex-start', marginTop: -1 }}>:</span>;

// ── Imagens dos prêmios: 1ª é a CAPA; demais são adicionais (galeria) ──
const prizeImages = (item) => Array.isArray(item?.images) ? item.images.filter(Boolean) : [];

// Mídia do prêmio: mostra a foto (idx) com object-fit cover; se não houver, cai no emoji
const PrizeMedia = ({ item, idx = 0, h = 120, emojiSize = 44, radius = 12, sold = false, style }) => {
  const imgs = prizeImages(item);
  const src = imgs[idx] != null ? imgs[idx] : imgs[0];
  return (
    <div style={{ width: '100%', height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius, overflow: 'hidden', ...style }}>
      {src
        ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: sold ? 'grayscale(1)' : 'none' }} />
        : <span style={{ fontSize: emojiSize, lineHeight: 1, filter: sold ? 'grayscale(1)' : 'none' }}>{item.emoji}</span>}
    </div>
  );
};

// Reduz uma imagem escolhida do PC para dataURL leve (cabe no localStorage do protótipo)
const fileToDataUrl = (file, maxDim = 760) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej; img.src = fr.result;
  };
  fr.onerror = rej; fr.readAsDataURL(file);
});

// ═══════════════════════════════════════════════ LOJA ═══════════════════════
const Loja = ({ items, balances, onBuy, isMobile, cardBg }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | premium | comum
  const [viewId, setViewId] = useState(null);  // item em tela cheia (lightbox)
  const viewItem = viewId ? items.find(i => i.id === viewId) : null;

  const filtered = items
    .filter(i => filter === 'all' || i.cur === filter)
    .filter(i => !query.trim() || (i.name + ' ' + i.desc).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]) || (b.price - a.price));

  // Maior prêmio em destaque + o resto na grade
  const featured = filtered[0] || null;
  const rest = filtered.slice(1);

  const FILTERS = [
    { id: 'all',     label: 'Todos',   icon: null },
    { id: 'premium', label: 'Premium', icon: 'premium' },
    { id: 'comum',   label: 'Comum',   icon: 'comum' },
  ];

  return (
    <div>
      <SectionHead title="Loja de Recompensas" sub="Troque seus prismas por prêmios e colecionáveis. Itens esgotam ao serem comprados." />

      {/* Contagem regressiva mensal */}
      <MonthCountdown />

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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 16, alignItems: 'stretch' }}>
          {/* DESTAQUE — maior prêmio */}
          {featured && <FeaturedCard item={featured} afford={balances[featured.cur] >= featured.price} onBuy={onBuy} onView={setViewId} cardBg={cardBg} />}

          {/* Grade dos demais */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, alignContent: 'start' }}>
            {rest.map(item => (
              <ItemCard key={item.id} item={item} afford={balances[item.cur] >= item.price} onBuy={onBuy} onView={setViewId} cardBg={cardBg} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox — prêmio em tela cheia */}
      {viewItem && (
        <ItemLightbox item={viewItem} afford={balances[viewItem.cur] >= viewItem.price} onBuy={onBuy} onClose={() => setViewId(null)} cardBg={cardBg} />
      )}
    </div>
  );
};

// Visualização em tela cheia do prêmio (card central + fundo desfocado)
const ItemLightbox = ({ item, afford, onBuy, onClose, cardBg }) => {
  const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
  const sold = item.stock <= 0;
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
            ? <PrizeMedia item={item} idx={imgIdx} h={260} radius={16} sold={sold} style={{ boxShadow: sold ? 'none' : `0 14px 40px ${rc}55` }} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><span style={{ fontSize: 150, lineHeight: 1, filter: sold ? 'grayscale(1)' : `drop-shadow(0 14px 40px ${rc}66)` }}>{item.emoji}</span></div>}
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
              {sold ? 'Esgotado' : `${item.stock} disponíve${item.stock > 1 ? 'is' : 'l'} para resgate`}
            </span>
          </div>
          <div style={{ fontSize: 14, color: T.textT, lineHeight: 1.6, marginBottom: 22 }}>{item.desc}</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 26 }}>
              <PrismIcon type={item.cur} size={36} /><span style={prismText(item.cur)}>{fmt(item.price)}</span>
            </span>
            <button disabled={sold || !afford} onClick={() => onBuy(item)} style={{
              padding: '13px 30px', cursor: (sold || !afford) ? 'not-allowed' : 'pointer', ...buyBtn(item.cur, sold, 12),
              fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-body)',
              opacity: (!sold && !afford) ? 0.5 : 1, boxShadow: sold ? 'none' : `0 6px 22px ${cfg.color}55`,
            }}>
              {sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes meFade{from{opacity:0}to{opacity:1}}@keyframes mePop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
};

// Card grande de destaque (maior prêmio)
const FeaturedCard = ({ item, afford, onBuy, onView, cardBg }) => {
  const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
  const sold = item.stock <= 0;
  const rc = RARITY_COLOR[item.rarity] || T.textT;
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = `0 18px 48px ${rc}3a`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 10px 36px ${rc}22`; }}
      style={{
      background: cardBg, border: `1.5px solid ${rc}55`, borderRadius: 20, overflow: 'hidden',
      position: 'relative', opacity: sold ? 0.65 : 1, display: 'flex', flexDirection: 'column',
      boxShadow: `0 10px 36px ${rc}22`, minHeight: 300, transition: 'transform .2s ease, box-shadow .2s ease',
    }}>
      {/* Brilho temático no topo */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${rc}26, transparent 60%)`, pointerEvents: 'none' }} />
      {/* Badge destaque */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: rc, color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, letterSpacing: '.04em', zIndex: 2 }}>
        ⭐ DESTAQUE
      </div>

      <div onClick={() => onView?.(item.id)} title="Ampliar" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 18px 4px', position: 'relative', cursor: 'zoom-in' }}>
        <PrizeMedia item={item} h={150} emojiSize={72} radius={14} sold={sold} style={{ filter: sold ? 'none' : `drop-shadow(0 8px 24px ${rc}33)` }} />
      </div>

      <div style={{ padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: rc, textTransform: 'uppercase', letterSpacing: '.08em' }}>{item.rarity}</span>
          <span style={{ fontSize: 11.5, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>
            {sold ? 'Esgotado' : `${item.stock} disponíve${item.stock > 1 ? 'is' : 'l'} para resgate`}
          </span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 5, lineHeight: 1.2 }}>{item.name}</div>
        <div style={{ fontSize: 12.5, color: T.textT, lineHeight: 1.5, marginBottom: 14 }}>{item.desc}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 20 }}>
            <PrismIcon type={item.cur} size={28} /><span style={prismText(item.cur)}>{fmt(item.price)}</span>
          </span>
          <button disabled={sold || !afford} onClick={() => onBuy(item)} style={{
            padding: '10px 22px', cursor: (sold || !afford) ? 'not-allowed' : 'pointer', ...buyBtn(item.cur, sold, 11),
            fontWeight: 800, fontSize: 14.5, fontFamily: 'var(--font-body)',
            opacity: (!sold && !afford) ? 0.5 : 1, boxShadow: sold ? 'none' : `0 6px 20px ${cfg.color}44`,
          }}>
            {sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
          </button>
        </div>
      </div>

      {sold && <SoldRibbon />}
    </div>
  );
};

// Card pequeno (grade)
const ItemCard = ({ item, afford, onBuy, onView, cardBg }) => {
  const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
  const sold = item.stock <= 0;
  const rc = RARITY_COLOR[item.rarity] || T.textT;
  return (
    <div
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = `0 14px 32px ${rc}33`; e.currentTarget.style.zIndex = 2; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = T.sh; e.currentTarget.style.zIndex = 1; }}
      style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', position: 'relative', opacity: sold ? 0.62 : 1, display: 'flex', flexDirection: 'column', boxShadow: T.sh, transition: 'transform .18s ease, box-shadow .18s ease' }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${rc},transparent)` }} />
      <div onClick={() => onView?.(item.id)} title="Ampliar" style={{ padding: '12px 12px 6px', cursor: 'zoom-in' }}>
        <PrizeMedia item={item} h={110} emojiSize={44} radius={11} sold={sold} />
      </div>
      <div style={{ padding: '0 15px 15px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.rarity}</span>
          <span style={{ fontSize: 10.5, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>{sold ? 'Esgotado' : `${item.stock} disponíveis`}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.2 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.45, marginBottom: 12, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 14 }}>
            <PrismIcon type={item.cur} size={22} /><span style={prismText(item.cur)}>{fmt(item.price)}</span>
          </span>
          <button disabled={sold || !afford} onClick={() => onBuy(item)} style={{
            padding: '6px 12px', cursor: (sold || !afford) ? 'not-allowed' : 'pointer', ...buyBtn(item.cur, sold, 8),
            fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-body)', opacity: (!sold && !afford) ? 0.5 : 1,
          }}>
            {sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
          </button>
        </div>
      </div>
      {sold && <SoldRibbon />}
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
const Missoes = ({ missions, onClaim, isMobile, cardBg }) => (
  <div>
    <SectionHead title="Desafios" sub="Complete desafios diários, mensais e únicos para farmar prismas. O progresso será automático quando integrarmos os sistemas." />
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
      {missions.map(m => {
        const done = m.progress >= m.goal;
        const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
        const pm = PERIOD_META[m.period] || PERIOD_META.dia;
        return (
          <div key={m.id} style={{ background: cardBg, border: `1px solid ${done && !m.claimed ? T.goldLine + '66' : T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh, opacity: m.claimed ? 0.7 : 1 }}>
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

            <button disabled={!done || m.claimed} onClick={() => onClaim(m)} style={{
              width: '100%', padding: '10px', borderRadius: 9, border: 'none',
              cursor: (!done || m.claimed) ? 'not-allowed' : 'pointer',
              background: m.claimed ? (T.surfaceSub || 'rgba(0,0,0,0.06)') : done ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : (T.surfaceSub || 'rgba(0,0,0,0.05)'),
              color: m.claimed ? T.textT : done ? '#fff' : T.textD, fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {m.claimed ? <><IcoCheck size={15} />Resgatado</> : done ? <><IcoGift size={15} />Resgatar recompensa</> : 'Em progresso'}
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

// ═══════════════════════════════════════════ CARTEIRA ═══════════════════════
const Carteira = ({ state, setState, addHistory, flash, isMobile, cardBg }) => {
  const [sendTo, setSendTo] = useState('');
  const [sendQuery, setSendQuery] = useState('');
  const [openList, setOpenList] = useState(false);
  const sendCur = 'comum'; // apenas Prisma Comum pode ser transferido
  const [sendAmt, setSendAmt] = useState('');
  const [exAmt, setExAmt] = useState('');

  const matches = COLABORADORES.filter(c => c.toLowerCase().includes(sendQuery.trim().toLowerCase()));

  const send = () => {
    if (!sendTo || !COLABORADORES.includes(sendTo)) { flash('Selecione um destinatário da lista'); return; }
    const amt = parseInt(sendAmt, 10);
    if (!amt || amt <= 0) { flash('Informe uma quantidade válida'); return; }
    if (state[sendCur] < amt) { flash('Saldo insuficiente'); return; }
    setState(s => ({ ...s, [sendCur]: s[sendCur] - amt }));
    addHistory({ kind: 'envio', desc: `Enviou para ${sendTo}`, [sendCur]: -amt });
    flash(`Enviou ${fmt(amt)} ${sendCur === 'premium' ? 'Premium' : 'Comuns'} para ${sendTo}`);
    setSendAmt('');
  };

  const exPremium = Math.floor((parseInt(exAmt, 10) || 0) / EXCHANGE_RATE);
  const exchange = () => {
    const spend = (parseInt(exAmt, 10) || 0);
    const got = Math.floor(spend / EXCHANGE_RATE);
    if (got <= 0) { flash(`Mínimo ${EXCHANGE_RATE} Comuns para 1 Premium`); return; }
    const cost = got * EXCHANGE_RATE;
    if (state.comum < cost) { flash('Saldo de Comuns insuficiente'); return; }
    setState(s => ({ ...s, comum: s.comum - cost, premium: s.premium + got }));
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
const Checkin = ({ canCheckin, onCheckin, checkins, streak, nextReward, earned, isMobile, cardBg }) => {
  // Posição do dia de hoje dentro do ciclo de 7 (0-based)
  const todayIdx = ((streak - 1) % CHECKIN_CYCLE.length + CHECKIN_CYCLE.length) % CHECKIN_CYCLE.length;
  const cap = MONTHLY_CAP;
  const capBar = (cur) => {
    const e = Math.min(earned[cur], cap[cur]); const pct = Math.round((e / cap[cur]) * 100);
    return { e, pct };
  };

  return (
    <div>
      <SectionHead title="Check-in Diário" sub="Entre todo dia: os ganhos crescem ao longo da sequência e a moeda intercala. Faltou um dia? A sequência volta pro dia 1." />

      {/* Banner do dia + resgatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '11px 18px', marginBottom: 12, boxShadow: T.sh, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 0%, ${T.goldGl}, transparent 55%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', color: canCheckin ? T.gold : '#16a34a' }}>{canCheckin ? <IcoGift size={30} /> : <IcoCheck size={30} />}</div>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
            {canCheckin ? `Dia ${streak} de sequência — recompensa pronta!` : `Você já resgatou hoje (dia ${streak - 1})`}
          </div>
          <div style={{ fontSize: 12, color: T.textT, marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canCheckin ? 'Recompensa de hoje:' : 'Volte amanhã para manter a sequência. Próxima:'}
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
          {canCheckin ? <><IcoStar size={16} />Resgatar</> : <><IcoCheck size={16} />Resgatado</>}
        </button>
      </div>

      {/* Ciclo de 7 dias */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? '14px 12px' : '16px 18px', boxShadow: T.sh, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Sequência de 7 dias</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4,1fr)' : 'repeat(7,1fr)', gap: isMobile ? 8 : 11 }}>
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
                <span style={{ fontSize: 11.5, fontWeight: isNext ? 800 : 600, color: isNext ? T.gold : T.textT }}>Dia {dayNum}</span>
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
  compra:  { Icon: IcoCart,    label: 'Compra' },
  checkin: { Icon: IcoCalendar,label: 'Check-in' },
  envio:   { Icon: IcoSend,    label: 'Envio' },
  troca:   { Icon: IcoSwap,    label: 'Troca' },
  missao:  { Icon: IcoTarget,  label: 'Missão' },
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
  const onFile = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const d = await fileToDataUrl(f, 760); onChange([...(images || []), d]); } catch {} e.target.value = ''; };
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
const Admin = ({ items, setState, flash, isMobile, cardBg }) => {
  const blank = { name: '', desc: '', emoji: '🎁', rarity: 'Épico', cur: 'comum', price: '', stock: '', images: [] };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null); // item com editor aberto
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fieldStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.02)', color: T.text, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' };

  const addItem = () => {
    const price = parseInt(form.price, 10);
    const stock = parseInt(form.stock, 10);
    if (!form.name.trim()) { flash('Informe o nome do prêmio'); return; }
    if (!price || price <= 0) { flash('Informe um preço válido'); return; }
    if (isNaN(stock) || stock < 0) { flash('Informe a quantidade disponível'); return; }
    const item = { id: 'i' + Date.now(), name: form.name.trim(), desc: form.desc.trim(), emoji: form.emoji || '🎁', rarity: form.rarity, cur: form.cur, price, stock, images: form.images || [] };
    setState(s => ({ ...s, items: [...s.items, item] }));
    setForm(blank);
    flash(`Prêmio "${item.name}" adicionado`);
  };

  const patchItem = (id, patch) => setState(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const removeItem = (id) => setState(s => ({ ...s, items: s.items.filter(i => i.id !== id) }));

  return (
    <div>
      <SectionHead title="Administrador" sub="Gerencie os prêmios da loja: cadastre novos, defina a quantidade disponível e edite as informações." />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Cadastrar novo prêmio */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}><span style={{ color: T.gold }}><IcoPlus size={17} /></span>Novo prêmio</div>

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

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Preço (prismas)</label>
              <input type="number" min="1" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Qtd. disponível</label>
              <input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" style={fieldStyle} />
            </div>
          </div>

          <button onClick={addItem} style={primaryBtn(T.gold)}>Adicionar prêmio</button>
        </div>

        {/* Prêmios existentes */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>Prêmios cadastrados ({items.length})</div>
          {items.length === 0 ? (
            <div style={{ color: T.textT, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Nenhum prêmio cadastrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(i => {
                const rc = RARITY_COLOR[i.rarity] || T.textT;
                const nImgs = prizeImages(i).length;
                const open = editId === i.id;
                return (
                  <div key={i.id} style={{ borderRadius: 11, border: `1px solid ${open ? T.goldLine + '88' : T.border}`, background: T.surfaceSub || 'rgba(0,0,0,0.015)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                      <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 9, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: cardBg, border: `1px solid ${T.border}` }}>
                        <PrizeMedia item={i} h={46} emojiSize={24} radius={0} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: rc, textTransform: 'uppercase' }}>{i.rarity}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, ...prismText(i.cur) }}><PrismIcon type={i.cur} size={13} />{fmt(i.price)}</span>
                          <span style={{ fontSize: 10.5, color: T.textT }}>· {i.stock} em estoque · {nImgs} foto{nImgs === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      <button onClick={() => setEditId(open ? null : i.id)} title="Editar prêmio" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${open ? T.gold : T.border}`, background: open ? T.goldGl : 'transparent', color: open ? T.gold : T.textS, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}>
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
    </div>
  );
};

// ─── helpers de UI ──────────────────────────────────────────────────────────
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textD, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 };
const primaryBtn = (color) => ({ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${color},${color}bb)`, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)' });

const SectionHead = ({ title, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: '-.01em' }}>{title}</div>
    {sub && <div style={{ fontSize: 13.5, color: T.textT, marginTop: 3 }}>{sub}</div>}
  </div>
);

export default MercadoEstelar;
