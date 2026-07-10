import React, { useState } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sidebar, TopBar, canSeeTab } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabLeitorXML } from './tabs/TabLeitorXML';
import { TabRelatorioConsumo } from './tabs/TabRelatorioConsumo';
import { TabOrdensServico } from './tabs/TabOrdensServico';
import { TabUnikoPDF } from './tabs/TabUnikoPDF';
import { TabLaboratorioEstelar } from './tabs/TabLaboratorioEstelar';
import { TabOficinaEstelar, TabCartaCorrecao, TabOficioEmissao } from './tabs/TabOficinaEstelar';
import { TabAssinatura } from './tabs/TabAssinatura';
import { TabHistoricoAssinatura } from './tabs/TabHistoricoAssinatura';

// 'xml'/'carta'/'assinatura' têm gate PRÓPRIO (admin OU CPF liberado) — ver canSeeTab em Sidebar.jsx
const GATED_TABS = new Set(['xml', 'carta', 'assinatura']);
const ADMIN_TABS = new Set(['consumo', 'ordens', 'uniko-pdf', 'laboratorio', 'oficio', 'historico-assinatura']);

const FaturamentoPortal = ({ onBack, authUser }) => {
  const isMobile = useIsMobile();
  const isAdmin = authUser?.role === 'admin';
  const [tab, setTab] = useState('inicio');

  useState(() => {
    const saved = localStorage.getItem('ch_theme') || 'blue';
    applyTheme(saved);
  });

  const safeSetTab = (id) => {
    if (GATED_TABS.has(id)) { if (!canSeeTab(id, authUser, isAdmin)) return; }
    else if (ADMIN_TABS.has(id) && !isAdmin) return;
    setTab(id);
  };

  const renderTab = () => {
    if (GATED_TABS.has(tab) && !canSeeTab(tab, authUser, isAdmin)) return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser}/>;
    if (ADMIN_TABS.has(tab) && !isAdmin) return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser}/>;
    switch (tab) {
      case 'inicio':  return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser}/>;
      case 'xml':     return <TabLeitorXML/>;
      case 'assinatura': return <TabAssinatura/>;
      case 'historico-assinatura': return <TabHistoricoAssinatura/>;
      case 'consumo': return <TabRelatorioConsumo/>;
      case 'ordens':    return <TabOrdensServico/>;
      case 'uniko-pdf':   return <TabUnikoPDF/>;
      case 'laboratorio': return <TabLaboratorioEstelar/>;
      case 'oficina':     return <TabOficinaEstelar/>;
      case 'carta':       return <TabCartaCorrecao/>;
      case 'oficio':      return <TabOficioEmissao/>;
      default:            return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser}/>;
    }
  };

  const hasTopBar = tab !== 'inicio';
  const padded    = tab !== 'inicio';

  return (
    <div style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={safeSetTab} onBack={onBack} isAdmin={isAdmin} authUser={authUser}/>
      <div style={{
        flex:1,
        marginLeft: isMobile ? 0 : 252,
        display:'flex',flexDirection:'column',
        minHeight:'100vh',
      }}>
        <TopBar tab={tab} onBack={() => safeSetTab('inicio')}/>
        <div style={{
          flex:1,
          overflowY:'auto',
          padding: padded ? '32px 40px 48px' : 0,
        }}>
          {renderTab()}
        </div>
      </div>
    </div>
  );
};

export default FaturamentoPortal;
