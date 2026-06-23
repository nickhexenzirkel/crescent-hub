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

// Recompensa do check-in por DIA do mês (varia para dar graça ao calendário):
//  • dias múltiplos de 7 (semana completa) → bônus maior
//  • dias múltiplos de 5 → bônus médio
//  • demais → base
const dailyReward = (day) => {
  if (day % 7 === 0) return { comum: 150, premium: 2 };
  if (day % 5 === 0) return { comum: 200, premium: 1 };
  return { comum: 120, premium: day % 2 === 0 ? 1 : 0 };
};

const MONTH_NAMES =['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pad2 = (n) => String(n).padStart(2, '0');

const STORAGE_KEY = 'me_state_v1';

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
  premium: 6,
  checkins: [],
  collection: [],
  // Catálogo do mês: 6 prêmios → 1 Lendário, 3 Épicos, 1 Raro, 1 Comum
  items: [
    { id: 'i1', name: 'Day-off Surpresa',        desc: 'Um dia inteiro de folga para usar quando quiser — sem descontar do banco de horas.', price: 5,   cur: 'premium', stock: 3,  rarity: 'Lendário', emoji: '🏖️', featured: true },
    { id: 'i2', name: 'Vale-Presente R$100',     desc: 'Cartão presente para usar nas lojas parceiras do programa.',                          price: 4,   cur: 'premium', stock: 5,  rarity: 'Épico',    emoji: '🎁' },
    { id: 'i3', name: 'Caneca Uniko Holográfica',desc: 'Caneca colecionável edição estelar, com acabamento holográfico exclusivo.',          price: 600, cur: 'comum',   stock: 12, rarity: 'Épico',    emoji: '☕' },
    { id: 'i4', name: 'Pelúcia do Dodoco',       desc: 'Mascote de pelúcia colecionável do Uniko Wave.',                                      price: 3,   cur: 'premium', stock: 2,  rarity: 'Épico',    emoji: '🧸' },
    { id: 'i5', name: 'Camiseta Uniko',          desc: 'Camiseta oficial da equipe, tecido premium.',                                         price: 800, cur: 'comum',   stock: 6,  rarity: 'Raro',     emoji: '👕' },
    { id: 'i6', name: 'Adesivos do Cat-Bot',     desc: 'Cartela de stickers exclusivos do Cat-Bot.',                                          price: 150, cur: 'comum',   stock: 30, rarity: 'Comum',    emoji: '✨' },
  ],
  missions: [
    { id: 'm1', title: 'Constância',     desc: 'Faça check-in por 3 dias',           progress: 2,    goal: 3,    comum: 100, premium: 0, claimed: false },
    { id: 'm2', title: 'Primeira compra',desc: 'Resgate qualquer item na loja',      progress: 0,    goal: 1,    comum: 0,   premium: 1, claimed: false },
    { id: 'm3', title: 'Ritmista',       desc: 'Jogue 5 músicas no Uniko Wave',      progress: 3,    goal: 5,    comum: 150, premium: 0, claimed: false },
    { id: 'm4', title: 'Generosidade',   desc: 'Envie prismas para um colega',       progress: 1,    goal: 1,    comum: 80,  premium: 0, claimed: false },
    { id: 'm5', title: 'Colecionador',   desc: 'Acumule 2.000 Prismas Comuns',       progress: 1480, goal: 2000, comum: 0,   premium: 2, claimed: false },
  ],
  history: [
    { id: 'h0', kind: 'checkin', desc: 'Check-in diário', comum: 120, premium: 1, date: '2026-06-20' },
  ],
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // Catálogo de itens = sempre o DEFAULT (fonte da verdade), preservando só o
      // estoque já consumido. Assim trocar o catálogo do mês não deixa item velho.
      const items = DEFAULT_STATE.items.map(def => {
        const saved = (s.items || []).find(x => x.id === def.id);
        return saved ? { ...def, stock: saved.stock } : def;
      });
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
        : [{ id: item.id, name: item.name, emoji: item.emoji, rarity: item.rarity, cur: item.cur, qty: 1, date: todayStr() }, ...(s.collection || [])];
      return {
        ...s,
        [item.cur]: s[item.cur] - item.price,
        items: s.items.map(i => i.id === item.id ? { ...i, stock: i.stock - 1 } : i),
        collection,
      };
    });
    addHistory({ kind: 'compra', desc: `Comprou “${item.name}”`, [item.cur]: -item.price });
    flash(`🎉 Você resgatou: ${item.name}`);
  };

  // ── Check-in ──
  const today = todayStr();
  const canCheckin = !(state.checkins || []).includes(today);
  const doCheckin = () => {
    if (!canCheckin) return;
    const r = dailyReward(new Date().getDate());
    setState(s => ({ ...s, comum: s.comum + r.comum, premium: s.premium + r.premium, checkins: [...(s.checkins || []), today] }));
    addHistory({ kind: 'checkin', desc: 'Check-in diário', ...(r.comum ? { comum: r.comum } : {}), ...(r.premium ? { premium: r.premium } : {}) });
    flash(`✅ Check-in feito! +${r.comum} Comuns${r.premium ? ` e +${r.premium} Premium` : ''}`);
  };

  // ── Missões ──
  const claimMission = (m) => {
    if (m.progress < m.goal || m.claimed) return;
    setState(s => ({
      ...s, comum: s.comum + (m.comum || 0), premium: s.premium + (m.premium || 0),
      missions: s.missions.map(x => x.id === m.id ? { ...x, claimed: true } : x),
    }));
    addHistory({ kind: 'missao', desc: `Missão: ${m.title}`, ...(m.comum ? { comum: m.comum } : {}), ...(m.premium ? { premium: m.premium } : {}) });
    flash(`🏅 Recompensa da missão resgatada: ${m.title}`);
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
          { id: 'loja',      label: 'Loja',      icon: '🛒' },
          { id: 'colecao',   label: 'Coleção',   icon: '🏆' },
          { id: 'missoes',   label: 'Missões',   icon: '🎯' },
          { id: 'carteira',  label: 'Carteira',  icon: '💎' },
          { id: 'checkin',   label: 'Check-in',  icon: '📅' },
          { id: 'historico', label: 'Histórico', icon: '🧾' },
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
              <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
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
        {tab === 'colecao'   && <Colecao collection={state.collection || []} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'missoes'   && <Missoes missions={state.missions} onClaim={claimMission} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'carteira'  && <Carteira state={state} setState={setState} addHistory={addHistory} flash={flash} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'checkin'   && <Checkin canCheckin={canCheckin} onCheckin={doCheckin} checkins={state.checkins || []} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'historico' && <Historico history={state.history} isMobile={isMobile} cardBg={cardBg} />}
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
      <span style={{ fontSize: 22 }}>⏳</span>
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
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
          Nenhum prêmio encontrado.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 14, alignItems: 'stretch' }}>
          {/* DESTAQUE — maior prêmio */}
          {featured && <FeaturedCard item={featured} afford={balances[featured.cur] >= featured.price} onBuy={onBuy} onView={setViewId} cardBg={cardBg} />}

          {/* Grade dos demais */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(165px,1fr))', gap: 12, alignContent: 'start' }}>
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

        {/* Foto expandida */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 24px 20px', position: 'relative' }}>
          <div style={{ fontSize: 150, lineHeight: 1, filter: sold ? 'grayscale(1)' : `drop-shadow(0 14px 40px ${rc}66)` }}>{item.emoji}</div>
        </div>

        <div style={{ padding: '0 28px 28px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text, lineHeight: 1.15 }}>{item.name}</div>
            <span style={{ fontSize: 12.5, color: sold ? '#C04050' : T.textT, fontWeight: 700, flexShrink: 0, marginLeft: 10 }}>
              {sold ? 'Esgotado' : `${item.stock} restante${item.stock > 1 ? 's' : ''}`}
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
    <div style={{
      background: cardBg, border: `1.5px solid ${rc}55`, borderRadius: 20, overflow: 'hidden',
      position: 'relative', opacity: sold ? 0.65 : 1, display: 'flex', flexDirection: 'column',
      boxShadow: `0 10px 36px ${rc}22`, minHeight: 300,
    }}>
      {/* Brilho temático no topo */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${rc}26, transparent 60%)`, pointerEvents: 'none' }} />
      {/* Badge destaque */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: rc, color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, letterSpacing: '.04em', zIndex: 2 }}>
        ⭐ DESTAQUE
      </div>

      <div onClick={() => onView?.(item.id)} title="Ampliar" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '34px 20px 8px', position: 'relative', cursor: 'zoom-in' }}>
        <div style={{ fontSize: 72, lineHeight: 1, filter: sold ? 'grayscale(1)' : `drop-shadow(0 8px 24px ${rc}55)`, transition: 'transform .18s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>{item.emoji}</div>
      </div>

      <div style={{ padding: '0 20px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: rc, textTransform: 'uppercase', letterSpacing: '.08em' }}>{item.rarity}</span>
          <span style={{ fontSize: 11.5, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>
            {sold ? 'Esgotado' : `${item.stock} restante${item.stock > 1 ? 's' : ''}`}
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
    <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', position: 'relative', opacity: sold ? 0.62 : 1, display: 'flex', flexDirection: 'column', boxShadow: T.sh }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${rc},transparent)` }} />
      <div onClick={() => onView?.(item.id)} title="Ampliar" style={{ fontSize: 34, textAlign: 'center', padding: '12px 0 4px', filter: sold ? 'grayscale(1)' : 'none', cursor: 'zoom-in' }}>{item.emoji}</div>
      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.rarity}</span>
          <span style={{ fontSize: 10.5, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>{sold ? 'Esgotado' : `${item.stock}x`}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 3, lineHeight: 1.2 }}>{item.name}</div>
        <div style={{ fontSize: 11.5, color: T.textT, lineHeight: 1.4, marginBottom: 10, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
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

const Colecao = ({ collection, isMobile, cardBg }) => {
  const [q, setQ] = useState('');
  const [rar, setRar] = useState('all');
  const [cur, setCur] = useState('all');
  const [viewId, setViewId] = useState(null);
  const viewItem = viewId ? collection.find(c => c.id === viewId) : null;

  const totalItens = collection.reduce((a, c) => a + c.qty, 0);
  const filtered = collection
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
      <SectionHead title="Minha Coleção" sub={collection.length ? `Você já resgatou ${totalItens} prêmio(s) · ${collection.length} tipo(s) diferente(s).` : 'Os prêmios que você resgatar aparecem aqui.'} />

      {collection.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.textT }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textS }}>Sua coleção está vazia</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Resgate prêmios na Loja para começar a colecionar.</div>
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
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              Nenhum prêmio encontrado para o filtro.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
              {filtered.map(c => {
                const rc = RARITY_COLOR[c.rarity] || T.textT;
                return (
                  <div key={c.id} style={{ background: cardBg, border: `1px solid ${rc}44`, borderRadius: 16, overflow: 'hidden', position: 'relative', boxShadow: T.sh, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${rc},transparent)` }} />
                    {c.qty > 1 && (
                      <span style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: rc, color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 999, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>×{c.qty}</span>
                    )}
                    <div onClick={() => setViewId(c.id)} title="Ampliar" style={{ fontSize: 50, textAlign: 'center', padding: '20px 0 8px', filter: `drop-shadow(0 6px 16px ${rc}44)`, cursor: 'zoom-in' }}>{c.emoji}</div>
                    <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{c.rarity}</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6, lineHeight: 1.2 }}>{c.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 'auto' }}>
                        <PrismIcon type={c.cur} size={16} />
                        <span style={{ fontSize: 11, color: T.textT }}>Resgatado em {c.date}</span>
                      </div>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 24px 20px', position: 'relative' }}>
          <div style={{ fontSize: 150, lineHeight: 1, filter: `drop-shadow(0 14px 40px ${rc}66)` }}>{item.emoji}</div>
        </div>
        <div style={{ padding: '0 28px 28px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.text, lineHeight: 1.15 }}>{item.name}</div>
            {item.qty > 1 && <span style={{ fontSize: 14, fontWeight: 800, color: rc }}>×{item.qty}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: T.textT }}>
            <PrismIcon type={item.cur} size={20} />
            Resgatado com {item.cur === 'premium' ? 'Prisma Premium' : 'Prisma Comum'} · em {item.date}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════ MISSÕES ════════════════════
const Missoes = ({ missions, onClaim, isMobile, cardBg }) => (
  <div>
    <SectionHead title="Missões Disponíveis" sub="Complete desafios e resgate prismas de recompensa." />
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
      {missions.map(m => {
        const done = m.progress >= m.goal;
        const pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
        return (
          <div key={m.id} style={{ background: cardBg, border: `1px solid ${done && !m.claimed ? T.goldLine + '66' : T.border}`, borderRadius: 16, padding: '18px 20px', boxShadow: T.sh, opacity: m.claimed ? 0.7 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{m.title}</div>
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
            }}>
              {m.claimed ? 'Resgatado ✓' : done ? '🎁 Resgatar recompensa' : 'Em progresso'}
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
    flash(`💸 Enviou ${fmt(amt)} ${sendCur === 'premium' ? 'Premium' : 'Comuns'} para ${sendTo}`);
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
    flash(`✨ Você obteve ${got} Prisma Premium`);
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
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, marginBottom: 2 }}>💸 Enviar Prismas</div>
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
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, marginBottom: 2 }}>🔄 Trocar por Premium</div>
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
const Checkin = ({ canCheckin, onCheckin, checkins, isMobile, cardBg }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();       // 0-based
  const todayDay = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const claimed = new Set(checkins);
  const todayR = dailyReward(todayDay);

  return (
    <div>
      <SectionHead title="Check-in Diário" sub="Resgate prismas grátis todo dia. Veja o calendário do mês com o que vem por aí." />

      {/* Banner do dia + resgatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '11px 18px', marginBottom: 12, boxShadow: T.sh, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 0%, ${T.goldGl}, transparent 55%)`, pointerEvents: 'none' }} />
        <div style={{ fontSize: 30, position: 'relative' }}>{canCheckin ? '🎁' : '✅'}</div>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
            {canCheckin ? 'Sua recompensa de hoje está pronta!' : 'Você já resgatou hoje'}
          </div>
          <div style={{ fontSize: 12, color: T.textT, marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Recompensa de hoje:
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: COMUM.color, fontWeight: 700 }}><PrismIcon type="comum" size={14} />+{todayR.comum}</span>
            {!!todayR.premium && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}><PrismIcon type="premium" size={18} /><span style={prismText('premium')}>+{todayR.premium}</span></span>}
          </div>
        </div>
        <button disabled={!canCheckin} onClick={onCheckin} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none', cursor: canCheckin ? 'pointer' : 'not-allowed', position: 'relative',
          background: canCheckin ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : T.surfaceSub || 'rgba(0,0,0,0.06)',
          color: canCheckin ? '#fff' : T.textT, fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)',
          boxShadow: canCheckin ? `0 6px 22px ${T.goldLine}55` : 'none',
        }}>
          {canCheckin ? '🌟 Resgatar' : 'Resgatado ✓'}
        </button>
      </div>

      {/* Calendário do mês — cards com prisma destacado no centro */}
      <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: isMobile ? '12px' : '14px 18px', boxShadow: T.sh }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10, textTransform: 'capitalize' }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(5,1fr)' : 'repeat(10,1fr)', gap: isMobile ? 6 : 8 }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
            const isClaimed = claimed.has(dateStr);
            const isToday = d === todayDay;
            const isPast = d < todayDay;
            const r = dailyReward(d);
            const showPremium = r.premium > 0;
            const pc = showPremium ? PREMIUM : COMUM;
            const qty = showPremium ? r.premium : r.comum;
            const med = isMobile ? 46 : 50;

            let bg = T.surfaceSub || 'rgba(0,0,0,0.025)', bd = T.border;
            if (isToday && canCheckin) { bg = T.goldGl; bd = T.goldLine; }
            else if (isClaimed) { bg = 'rgba(34,197,94,0.08)'; bd = 'rgba(34,197,94,0.4)'; }
            const dim = isPast && !isClaimed;

            return (
              <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  onClick={isToday && canCheckin ? onCheckin : undefined}
                  title={`${d}º dia · +${r.comum} Comuns${r.premium ? ` e +${r.premium} Premium` : ''}`}
                  style={{
                    position: 'relative', width: '100%', borderRadius: 11, border: `1.5px solid ${bd}`, background: bg,
                    padding: '8px 3px 11px', display: 'flex', justifyContent: 'center',
                    opacity: dim ? 0.45 : 1, cursor: isToday && canCheckin ? 'pointer' : 'default',
                    boxShadow: isToday && canCheckin ? `0 5px 14px ${T.goldLine}33` : 'none', transition: 'transform .15s',
                  }}
                  onMouseEnter={e => { if (isToday && canCheckin) e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                  {/* Medalhão: borda colorida + interior escuro para destacar o prisma */}
                  <div style={{
                    position: 'relative', width: med, height: med,
                    ...(showPremium ? rainbowBorder('50%') : { borderRadius: '50%', border: `2px solid ${pc.color}`, background: DARK_COMUM }),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: showPremium ? '0 3px 12px rgba(155,107,255,0.45)' : `0 3px 10px ${pc.color}55`,
                    filter: isClaimed ? 'grayscale(0.4)' : 'none',
                  }}>
                    <PrismIcon type={showPremium ? 'premium' : 'comum'} size={28} />
                    {/* badge ×N */}
                    <span style={{
                      position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
                      background: showPremium ? RAINBOW : pc.color, color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 6px',
                      borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', textShadow: '0 1px 1px rgba(0,0,0,0.3)',
                    }}>×{fmt(qty)}</span>
                  </div>

                  {/* Check de resgatado */}
                  {isClaimed && (
                    <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                  {/* Ponto vermelho de "disponível hoje" */}
                  {isToday && canCheckin && (
                    <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: '#e23b3b', boxShadow: `0 0 0 3px ${bg}` }} />
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? T.gold : T.textT }}>{d}º</span>
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 11, color: T.textT }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#16a34a' }} /> Resgatado</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e23b3b' }} /> Disponível hoje</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><PrismIcon type="comum" size={12} /> / <PrismIcon type="premium" size={12} /> Recompensa do dia</span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════ HISTÓRICO ══════════════════════
const KIND_META = {
  compra:  { icon: '🛒', label: 'Compra' },
  checkin: { icon: '📅', label: 'Check-in' },
  envio:   { icon: '💸', label: 'Envio' },
  troca:   { icon: '🔄', label: 'Troca' },
  missao:  { icon: '🏅', label: 'Missão' },
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
          <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
          Nenhuma transação ainda.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: T.textT }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          Nenhuma transação encontrada para o filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(h => {
            const meta = KIND_META[h.kind] || { icon: '•', label: h.kind };
            return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '13px 18px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.goldGl, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{meta.icon}</div>
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
