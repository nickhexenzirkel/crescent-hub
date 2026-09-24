// src/modules/comercial/index.jsx
// Comercial — recorte do Portal do Colaborador pro time comercial: só as
// abas Seus Dados, Financeiro, Eventos, Feedback e Portal dos Credenciados,
// mais uma aba nova (Prestação de Contas, ainda "em breve"). Reaproveita o
// MESMO Sidebar/TopBar e os MESMOS componentes de aba do Portal (não são
// cópias) — só filtra quais abas aparecem (ver `only`/`extraNav` em
// Sidebar.jsx). De propósito, NÃO tem aba "Início": é por isso que os
// widgets globais de Capture o Uniko/Capture o Número (gated por
// `inPortal={screen==='colaborador'}` em App.jsx) nunca aparecem aqui — o
// slot deles só existe na Início do Portal normal.
import { useState } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SettingsModal } from '../../shared/SettingsModal';
import { Sidebar, TopBar, I } from '../central-colaborador/Sidebar';
import { TabDados } from '../central-colaborador/tabs/TabDados';
import { TabFinanceiro } from '../central-colaborador/tabs/TabFinanceiro';
import { TabEventos } from '../central-colaborador/tabs/TabEventos';
import { TabFeedback } from '../central-colaborador/tabs/TabFeedback';
import Beneficios7 from '../beneficios-7';

const ONLY = ['dados', 'financeiro', 'eventos', 'feedback'];

const EXTRA_NAV = [
  { id: 'credenciados', label: 'Portal dos Credenciados', icon: <I><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M7.5 14h3" /></I> },
  { id: 'prestacao', label: 'Prestação de Contas', icon: <I><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></I> },
];

const EXTRA_LABELS = { credenciados: 'Portal dos Credenciados', prestacao: 'Prestação de Contas' };

const PrestacaoContasEmBreve = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', padding: 24 }}>
    <div style={{ textAlign: 'center', maxWidth: 360 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px', background: T.goldGl, color: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
      </div>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8 }}>Prestação de Contas</div>
      <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: T.gold, background: T.goldGl, borderRadius: 999, padding: '4px 12px', marginBottom: 12 }}>EM BREVE</div>
      <div style={{ fontSize: 13.5, color: T.textS, lineHeight: 1.6 }}>Essa aba ainda está sendo construída — em breve dá pra acompanhar por aqui.</div>
    </div>
  </div>
);

const Comercial = ({ onBack, userPhoto }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('dados');
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('ch_theme') || 'blue');
  const [showSettings, setShowSettings] = useState(false);

  const handleTheme = (key) => { applyTheme(key); setActiveTheme(key); localStorage.setItem('ch_theme', key); };

  const render = () => {
    if (tab === 'dados') return <TabDados onProfileSaved={() => {}} />;
    if (tab === 'financeiro') return <TabFinanceiro />;
    if (tab === 'eventos') return <TabEventos />;
    if (tab === 'feedback') return <TabFeedback />;
    if (tab === 'prestacao') return <PrestacaoContasEmBreve />;
    return null;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.page, fontFamily: 'var(--font-body)' }}>
      {!isMobile && (
        <Sidebar tab={tab} setTab={setTab} onBack={onBack} activeTheme={activeTheme} onTheme={handleTheme}
          onOpenSettings={() => setShowSettings(true)} userPhoto={userPhoto} profileComplete={true}
          collapsed={false} desligado={false} only={ONLY} extraNav={EXTRA_NAV} brandLabel="Comercial" />
      )}
      <div style={{ marginLeft: isMobile ? 0 : 280, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {tab !== 'credenciados' && <TopBar tab={tab} onBack={onBack} rootLabel="Comercial" extraLabels={EXTRA_LABELS} />}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.surfaceSub || 'rgba(0,0,0,0.04)', border: `1px solid ${T.border}`, borderRadius: 9, cursor: 'pointer', color: T.textS, padding: '7px 12px', fontFamily: 'var(--font-body)', fontSize: 13 }}>← Módulos</button>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 700, color: T.text }}>Comercial</div>
          </div>
        )}
        {isMobile && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto' }}>
            {[{ id: 'dados', label: 'Seus Dados' }, { id: 'financeiro', label: 'Financeiro' }, { id: 'eventos', label: 'Eventos' }, { id: 'feedback', label: 'Feedback' }, ...EXTRA_NAV].map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                  border: `1.5px solid ${tab === n.id ? T.gold : T.border}`, background: tab === n.id ? T.goldGl : 'transparent', color: tab === n.id ? T.gold : T.textS }}>
                {n.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1, padding: isMobile ? '16px' : '28px 34px', overflowY: 'auto' }}>
          {render()}
        </div>
      </div>
      <Beneficios7 active={tab === 'credenciados'} onBack={() => setTab('dados')} />
      {showSettings && <SettingsModal activeTheme={activeTheme} onTheme={handleTheme} onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default Comercial;
export { Comercial };
