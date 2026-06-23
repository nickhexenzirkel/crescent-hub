import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { Logo } from '../../shared/components';
import { useIsMobile } from '../../hooks/useIsMobile';

/* ═══════════════════════════════════════════════════════════════════════════
   MERCADO ESTELAR — parte VISUAL (protótipo front-end).
   Estado fica em localStorage (me_state_v1). Sem backend/Supabase por enquanto.
   Dois tipos de Prisma:
     • Prisma Comum   → prêmios colecionáveis / cosméticos
     • Prisma Premium → prêmios grandes
   Recursos: Loja (esgota ao comprar), Carteira (saldo + enviar + trocar),
   Check-in diário e Histórico de transações.
═══════════════════════════════════════════════════════════════════════════ */

// Cores fixas dos prismas (independem do tema para manter a identidade)
const COMUM   = { color: '#27C6DE', glow: 'rgba(39,198,222,0.18)', name: 'Prisma Comum' };
const PREMIUM = { color: '#F5B63A', glow: 'rgba(245,182,58,0.20)', name: 'Prisma Premium' };

// Taxa de troca: quantos Comuns valem 1 Premium
const EXCHANGE_RATE = 500;
// Recompensa diária do check-in
const CHECKIN_COMUM = 120;
const CHECKIN_PREMIUM = 1;

const STORAGE_KEY = 'me_state_v1';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

const COLABORADORES = [
  'Alan Matos', 'Brenda Késia', 'Cleanderson Pereira', 'Gleydson Marques',
  'Guilherme Alves', 'Karina Barbosa', 'Mara Almeida', 'Maria Renata', 'Mikael Araújo',
];

const DEFAULT_STATE = {
  comum: 1480,
  premium: 6,
  lastCheckin: null,
  items: [
    { id: 'i1', name: 'Day-off Surpresa',        desc: 'Um dia de folga para usar quando quiser', price: 5,    cur: 'premium', stock: 3, rarity: 'Lendário',   emoji: '🏖️' },
    { id: 'i2', name: 'Vale-Presente R$100',      desc: 'Cartão presente para lojas parceiras',    price: 4,    cur: 'premium', stock: 5, rarity: 'Épico',      emoji: '🎁' },
    { id: 'i3', name: 'Almoço por conta da casa',  desc: 'Voucher de almoço no restaurante',        price: 2,    cur: 'premium', stock: 8, rarity: 'Raro',       emoji: '🍽️' },
    { id: 'i4', name: 'Caneca Uniko Holográfica',  desc: 'Caneca colecionável edição estelar',      price: 600,  cur: 'comum',   stock: 12, rarity: 'Épico',     emoji: '☕' },
    { id: 'i5', name: 'Adesivos do Cat-Bot',       desc: 'Cartela de stickers exclusivos',          price: 150,  cur: 'comum',   stock: 30, rarity: 'Comum',     emoji: '✨' },
    { id: 'i6', name: 'Avatar Animado Raro',       desc: 'Skin animada para o seu perfil',          price: 350,  cur: 'comum',   stock: 1,  rarity: 'Lendário',  emoji: '🌟' },
    { id: 'i7', name: 'Camiseta Uniko',            desc: 'Camiseta oficial da equipe',              price: 800,  cur: 'comum',   stock: 6,  rarity: 'Raro',      emoji: '👕' },
    { id: 'i8', name: 'Pelúcia do Dodoco',         desc: 'Mascote de pelúcia colecionável',         price: 3,    cur: 'premium', stock: 2,  rarity: 'Lendário',  emoji: '🧸' },
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
      // Mescla itens novos do default que ainda não existem no save
      const ids = new Set((s.items || []).map(i => i.id));
      const merged = [...(s.items || []), ...DEFAULT_STATE.items.filter(i => !ids.has(i.id))];
      return { ...DEFAULT_STATE, ...s, items: merged };
    }
  } catch {}
  return DEFAULT_STATE;
};

const RARITY_COLOR = {
  'Comum':    '#7A92A8',
  'Raro':     '#2E8DD4',
  'Épico':    '#9B6FE8',
  'Lendário': '#F5B63A',
};

// ─── Ícone do Prisma (cristal/diamante) ───────────────────────────────────
const PrismIcon = ({ type = 'comum', size = 22 }) => {
  const c = type === 'premium' ? PREMIUM.color : COMUM.color;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ filter: `drop-shadow(0 1px 4px ${c}66)` }}>
      <path d="M12 2 L20 8 L12 22 L4 8 Z" fill={c} opacity="0.92" />
      <path d="M12 2 L20 8 L12 22 Z" fill="#fff" opacity="0.18" />
      <path d="M4 8 H20" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
      <path d="M12 2 L8.5 8 L12 22 L15.5 8 Z" stroke="#fff" strokeWidth="0.6" opacity="0.35" fill="none" />
    </svg>
  );
};

const PrismChip = ({ type, amount, big }) => {
  const cfg = type === 'premium' ? PREMIUM : COMUM;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: big ? '8px 16px' : '4px 11px', borderRadius: 999,
      background: cfg.glow, border: `1px solid ${cfg.color}44`,
      color: cfg.color, fontWeight: 700, fontSize: big ? 18 : 13,
    }}>
      <PrismIcon type={type} size={big ? 22 : 16} />
      {fmt(amount)}
    </span>
  );
};

const MercadoEstelar = ({ onBack, authUser }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('loja');
  const [state, setState] = useState(loadState);
  const [toast, setToast] = useState('');

  const cardBg = T.surface;

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
    setState(s => ({
      ...s,
      [item.cur]: s[item.cur] - item.price,
      items: s.items.map(i => i.id === item.id ? { ...i, stock: i.stock - 1 } : i),
    }));
    addHistory({ kind: 'compra', desc: `Comprou “${item.name}”`, [item.cur]: -item.price });
    flash(`🎉 Você resgatou: ${item.name}`);
  };

  // ── Check-in ──
  const canCheckin = state.lastCheckin !== todayStr();
  const doCheckin = () => {
    if (!canCheckin) return;
    setState(s => ({ ...s, comum: s.comum + CHECKIN_COMUM, premium: s.premium + CHECKIN_PREMIUM, lastCheckin: todayStr() }));
    addHistory({ kind: 'checkin', desc: 'Check-in diário', comum: CHECKIN_COMUM, premium: CHECKIN_PREMIUM });
    flash(`✅ Check-in feito! +${CHECKIN_COMUM} Comuns e +${CHECKIN_PREMIUM} Premium`);
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
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: 'var(--font-brand)', letterSpacing: '.04em' }}>Mercado Estelar</span>
        <div style={{ flex: 1 }} />
        {/* Saldos no topo */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <PrismChip type="comum" amount={state.comum} />
            <PrismChip type="premium" amount={state.premium} />
          </div>
        )}
        <Logo size={26} />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, padding: isMobile ? '12px 12px 0' : '16px 24px 0', maxWidth: 1200, margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
        {[
          { id: 'loja',     label: 'Loja',      icon: '🛒' },
          { id: 'carteira', label: 'Carteira',  icon: '💎' },
          { id: 'checkin',  label: 'Check-in',  icon: '📅' },
          { id: 'historico',label: 'Histórico', icon: '🧾' },
        ].map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
              borderRadius: '12px 12px 0 0', border: `1px solid ${on ? T.goldLine + '55' : 'transparent'}`,
              borderBottom: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
              fontSize: 14, fontWeight: on ? 700 : 500,
              background: on ? cardBg : 'transparent', color: on ? T.gold : T.textT,
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: isMobile ? '12px' : '20px 24px 40px' }}>
        {/* Saldo (mobile, e como header de carteira) */}
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <PrismChip type="comum" amount={state.comum} />
            <PrismChip type="premium" amount={state.premium} />
          </div>
        )}

        {tab === 'loja'      && <Loja items={state.items} balances={state} onBuy={buyItem} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'carteira'  && <Carteira state={state} setState={setState} addHistory={addHistory} flash={flash} isMobile={isMobile} cardBg={cardBg} />}
        {tab === 'checkin'   && <Checkin canCheckin={canCheckin} onCheckin={doCheckin} lastCheckin={state.lastCheckin} cardBg={cardBg} />}
        {tab === 'historico' && <Historico history={state.history} cardBg={cardBg} />}
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

// ═══════════════════════════════════════════════ LOJA ═══════════════════════
const Loja = ({ items, balances, onBuy, isMobile, cardBg }) => (
  <div>
    <SectionHead title="Loja de Recompensas" sub="Troque seus prismas por prêmios e colecionáveis. Itens esgotam ao serem comprados." />
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
      {items.map(item => {
        const cfg = item.cur === 'premium' ? PREMIUM : COMUM;
        const sold = item.stock <= 0;
        const afford = balances[item.cur] >= item.price;
        const rc = RARITY_COLOR[item.rarity] || T.textT;
        return (
          <div key={item.id} style={{
            background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden',
            position: 'relative', opacity: sold ? 0.62 : 1, display: 'flex', flexDirection: 'column',
            boxShadow: T.sh,
          }}>
            {/* Faixa de raridade */}
            <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${rc},transparent)` }} />
            {/* Emoji / arte */}
            <div style={{ fontSize: 46, textAlign: 'center', padding: '20px 0 8px', filter: sold ? 'grayscale(1)' : 'none' }}>
              {item.emoji}
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '.06em' }}>{item.rarity}</span>
                <span style={{ fontSize: 11, color: sold ? '#C04050' : T.textT, fontWeight: 600 }}>
                  {sold ? 'Esgotado' : `${item.stock} restante${item.stock > 1 ? 's' : ''}`}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.45, marginBottom: 14, flex: 1 }}>{item.desc}</div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: cfg.color, fontWeight: 700, fontSize: 15 }}>
                  <PrismIcon type={item.cur} size={18} />{fmt(item.price)}
                </span>
                <button disabled={sold || !afford} onClick={() => onBuy(item)} style={{
                  padding: '8px 16px', borderRadius: 9, border: 'none',
                  cursor: (sold || !afford) ? 'not-allowed' : 'pointer',
                  background: sold ? T.surfaceSub || 'rgba(0,0,0,0.06)' : `linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
                  color: sold ? T.textT : '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-body)',
                  opacity: (!sold && !afford) ? 0.5 : 1,
                }}>
                  {sold ? 'Esgotado' : afford ? 'Resgatar' : 'Sem saldo'}
                </button>
              </div>
            </div>
            {sold && (
              <div style={{ position: 'absolute', top: 14, right: -30, transform: 'rotate(38deg)', background: '#C04050', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 36px', letterSpacing: '.1em' }}>
                ESGOTADO
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ═══════════════════════════════════════════ CARTEIRA ═══════════════════════
const Carteira = ({ state, setState, addHistory, flash, isMobile, cardBg }) => {
  const [sendTo, setSendTo] = useState(COLABORADORES[0]);
  const [sendCur, setSendCur] = useState('comum');
  const [sendAmt, setSendAmt] = useState('');
  const [exAmt, setExAmt] = useState('');

  const send = () => {
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

      {/* Cards de saldo grandes */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 22 }}>
        {[{ k: 'comum', cfg: COMUM, hint: 'Prêmios colecionáveis e cosméticos' }, { k: 'premium', cfg: PREMIUM, hint: 'Prêmios grandes e exclusivos' }].map(({ k, cfg, hint }) => (
          <div key={k} style={{ background: cardBg, border: `1px solid ${cfg.color}33`, borderRadius: 16, padding: '22px 24px', position: 'relative', overflow: 'hidden', boxShadow: T.sh }}>
            <div style={{ position: 'absolute', top: -30, right: -20, opacity: 0.12 }}><PrismIcon type={k} size={130} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <PrismIcon type={k} size={28} />
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{cfg.name}</span>
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{fmt(state[k])}</div>
            <div style={{ fontSize: 12, color: T.textT, marginTop: 8 }}>{hint}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        {/* Enviar prismas */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '22px 24px', boxShadow: T.sh }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>💸 Enviar Prismas</div>
          <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16 }}>Transfira prismas para outro colaborador.</div>

          <label style={lbl}>Destinatário</label>
          <select value={sendTo} onChange={e => setSendTo(e.target.value)} style={{ ...fieldStyle, marginBottom: 12, cursor: 'pointer' }}>
            {COLABORADORES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={lbl}>Tipo de prisma</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[{ k: 'comum', cfg: COMUM }, { k: 'premium', cfg: PREMIUM }].map(({ k, cfg }) => (
              <button key={k} onClick={() => setSendCur(k)} style={{
                flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
                border: `1.5px solid ${sendCur === k ? cfg.color : T.border}`, fontWeight: 600, fontSize: 13,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: sendCur === k ? cfg.glow : 'transparent', color: sendCur === k ? cfg.color : T.textS,
              }}>
                <PrismIcon type={k} size={15} />{k === 'premium' ? 'Premium' : 'Comum'}
              </button>
            ))}
          </div>

          <label style={lbl}>Quantidade</label>
          <input type="number" min="1" value={sendAmt} onChange={e => setSendAmt(e.target.value)} placeholder="0" style={{ ...fieldStyle, marginBottom: 16 }} />

          <button onClick={send} style={primaryBtn(sendCur === 'premium' ? PREMIUM.color : COMUM.color)}>Enviar</button>
        </div>

        {/* Trocar Comum → Premium */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '22px 24px', boxShadow: T.sh }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>🔄 Trocar por Premium</div>
          <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16 }}>
            Converta Prismas Comuns em Premium. Taxa: <strong style={{ color: T.text }}>{EXCHANGE_RATE} Comuns = 1 Premium</strong>.
          </div>

          <label style={lbl}>Comuns a gastar</label>
          <input type="number" min="0" step={EXCHANGE_RATE} value={exAmt} onChange={e => setExAmt(e.target.value)} placeholder="0" style={{ ...fieldStyle, marginBottom: 14 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '14px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,0.02)', marginBottom: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: COMUM.color, fontWeight: 700 }}>
              <PrismIcon type="comum" size={20} />{fmt((parseInt(exAmt, 10) || 0))}
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: PREMIUM.color, fontWeight: 800, fontSize: 18 }}>
              <PrismIcon type="premium" size={22} />{exPremium}
            </span>
          </div>

          <button onClick={exchange} style={primaryBtn(PREMIUM.color)}>Trocar agora</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════ CHECK-IN ═══════════════════════
const Checkin = ({ canCheckin, onCheckin, lastCheckin, cardBg }) => (
  <div>
    <SectionHead title="Check-in Diário" sub="Volte todo dia para resgatar prismas grátis!" />
    <div style={{ maxWidth: 520, margin: '0 auto', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 20, padding: '36px 32px', textAlign: 'center', boxShadow: T.sh, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${T.goldGl}, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ fontSize: 56, marginBottom: 6 }}>{canCheckin ? '🎁' : '✅'}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>
        {canCheckin ? 'Sua recompensa de hoje está pronta!' : 'Você já resgatou hoje'}
      </div>
      <div style={{ fontSize: 13.5, color: T.textT, marginBottom: 24 }}>
        {canCheckin ? 'Resgate seus prismas diários abaixo.' : 'Volte amanhã para mais prismas grátis.'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 26 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 22px', borderRadius: 14, background: COMUM.glow, border: `1px solid ${COMUM.color}44` }}>
          <PrismIcon type="comum" size={30} />
          <span style={{ fontSize: 18, fontWeight: 800, color: COMUM.color }}>+{CHECKIN_COMUM}</span>
          <span style={{ fontSize: 11, color: T.textT }}>Comuns</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 22px', borderRadius: 14, background: PREMIUM.glow, border: `1px solid ${PREMIUM.color}44` }}>
          <PrismIcon type="premium" size={30} />
          <span style={{ fontSize: 18, fontWeight: 800, color: PREMIUM.color }}>+{CHECKIN_PREMIUM}</span>
          <span style={{ fontSize: 11, color: T.textT }}>Premium</span>
        </div>
      </div>

      <button disabled={!canCheckin} onClick={onCheckin} style={{
        padding: '13px 40px', borderRadius: 12, border: 'none', cursor: canCheckin ? 'pointer' : 'not-allowed',
        background: canCheckin ? `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)` : T.surfaceSub || 'rgba(0,0,0,0.06)',
        color: canCheckin ? '#fff' : T.textT, fontWeight: 800, fontSize: 15, fontFamily: 'var(--font-body)',
        boxShadow: canCheckin ? `0 6px 22px ${T.goldLine}55` : 'none', position: 'relative',
      }}>
        {canCheckin ? '🌟 Resgatar agora' : 'Resgatado ✓'}
      </button>
      {lastCheckin && <div style={{ fontSize: 11, color: T.textD, marginTop: 14, position: 'relative' }}>Último check-in: {lastCheckin}</div>}
    </div>
  </div>
);

// ═══════════════════════════════════════════ HISTÓRICO ══════════════════════
const KIND_META = {
  compra:  { icon: '🛒', label: 'Compra' },
  checkin: { icon: '📅', label: 'Check-in' },
  envio:   { icon: '💸', label: 'Envio' },
  troca:   { icon: '🔄', label: 'Troca' },
};

const Historico = ({ history, cardBg }) => (
  <div>
    <SectionHead title="Histórico de Transações" sub="Todas as suas movimentações de prismas." />
    {history.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '60px 0', color: T.textT }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
        Nenhuma transação ainda.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.map(h => {
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
                  <span key={cur} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: h[cur] >= 0 ? '#16a34a' : (cur === 'premium' ? PREMIUM.color : COMUM.color) }}>
                    {h[cur] >= 0 ? '+' : ''}{fmt(h[cur])}<PrismIcon type={cur} size={14} />
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

// ─── helpers de UI ──────────────────────────────────────────────────────────
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textD, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 };
const primaryBtn = (color) => ({ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,${color},${color}bb)`, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-body)' });

const SectionHead = ({ title, sub }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-.01em' }}>{title}</div>
    {sub && <div style={{ fontSize: 14, color: T.textT, marginTop: 4 }}>{sub}</div>}
  </div>
);

export default MercadoEstelar;
