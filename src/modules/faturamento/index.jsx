import React, { useState, useEffect } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sidebar, TopBar, canSeeTab, NAV } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabLeitorXML } from './tabs/TabLeitorXML';
import { TabPdfEditor, TabPdfOrganizar, TabPdfMesclar, TabCartaCorrecao } from './tabs/TabOficinaEstelar';
import { TabAssinatura } from './tabs/TabAssinatura';
import { TabHistoricoAssinatura } from './tabs/TabHistoricoAssinatura';
import { refletirAbaNaUrl } from './rotaFerramenta';

// 'xml'/'carta'/'assinatura' têm gate PRÓPRIO (admin OU CPF liberado) — ver canSeeTab em Sidebar.jsx
const GATED_TABS = new Set(['xml', 'carta', 'assinatura']);
const ADMIN_TABS = new Set(['historico-assinatura']);

// `restrictedTabs`: cargo em "modo restrito" (Dashboard RH → Gerenciar
// Permissões) recortando quais abas da Oficina Estelar um cargo específico
// enxerga — ex: cargo "Comercial" só vendo Editor/Organizar/Mesclar PDF.
// undefined/[] = sem restrição, comportamento de sempre.
const FaturamentoPortal = ({ onBack, authUser, initialTab, restrictedTabs }) => {
  const isMobile = useIsMobile();
  const isAdmin = authUser?.role === 'admin';
  // "Início" não entra numa restrição de cargo — pra quem é restrito, a
  // home vira a 1ª aba liberada.
  const homeTab = restrictedTabs?.length ? restrictedTabs[0] : 'inicio';
  const allowedTab = (id) => {
    if (restrictedTabs?.length && !restrictedTabs.includes(id)) return false;
    if (GATED_TABS.has(id)) return canSeeTab(id, authUser, isAdmin);
    if (ADMIN_TABS.has(id) && !isAdmin) return false;
    return true;
  };
  /* initialTab: atalho do seletor de módulos. Passa pelas mesmas travas do
     safeSetTab — um atalho guardado não abre aba que a pessoa não pode ver. */
  const [tab, setTab] = useState(() => {
    const t = initialTab;
    if (!t || !NAV.some(n => n.id === t) || !allowedTab(t)) return homeTab;
    return t;
  });

  useState(() => {
    const saved = localStorage.getItem('ch_theme') || 'blue';
    applyTheme(saved);
  });

  /* Mantém a URL fiel à aba atual — é o que dá pra favoritar o Editor/
     Organizar/Mesclar de PDF no navegador e abrir direto neles depois (ver
     rotaFerramenta.js e o boot em App.jsx). Usa replaceState (não empilha
     histórico), então "Sair" continua sendo só o onBack normal do App: não
     tem mais entrada extra de ferramenta pra desfazer antes — cada aba do
     módulo é uma trocada de estado local, igual sempre foi pras outras
     (Início, Controle de Notas...). */
  useEffect(() => { refletirAbaNaUrl(tab); }, [tab]);

  const sair = onBack;

  const safeSetTab = (id) => {
    if (!allowedTab(id)) return;
    setTab(id);
  };

  /* Extraído do switch pra poder ser reusado tanto na renderização normal
     quanto no fallback (aba bloqueada cai na homeTab, que pra cargo restrito
     não é sempre 'inicio' — ver homeTab acima). */
  const componentFor = (id) => {
    switch (id) {
      case 'xml':     return <TabLeitorXML/>;
      case 'assinatura': return <TabAssinatura/>;
      case 'historico-assinatura': return <TabHistoricoAssinatura/>;
      case 'pdf-editor':    return <TabPdfEditor/>;
      case 'pdf-organizar': return <TabPdfOrganizar/>;
      case 'pdf-mesclar':   return <TabPdfMesclar/>;
      case 'carta':       return <TabCartaCorrecao/>;
      case 'inicio':
      default:            return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser}/>;
    }
  };

  const renderTab = () => {
    if (!allowedTab(tab)) return componentFor(homeTab);
    return componentFor(tab);
  };

  const hasTopBar = tab !== homeTab;
  const padded    = tab !== homeTab;

  return (
    <div style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={safeSetTab} onBack={sair} isAdmin={isAdmin} authUser={authUser} only={restrictedTabs}/>
      <div style={{
        flex:1,
        marginLeft: isMobile ? 0 : 252,
        display:'flex',flexDirection:'column',
        minHeight:'100vh',
      }}>
        <TopBar tab={tab} homeTab={homeTab} onBack={() => safeSetTab(homeTab)}/>
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
