import React, { useState, useEffect } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sidebar, TopBar, canSeeTab, NAV } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabLeitorXML } from './tabs/TabLeitorXML';
import { TabPdfEditor, TabPdfOrganizar, TabPdfMesclar, TabCartaCorrecao } from './tabs/TabOficinaEstelar';
import { TabAssinatura } from './tabs/TabAssinatura';
import { TabOficioEmissao } from './tabs/TabOficioEmissao';
import { TabEmpenho } from './tabs/TabEmpenho';
import { TabHistoricoAssinatura } from './tabs/TabHistoricoAssinatura';
import { refletirAbaNaUrl } from './rotaFerramenta';

// 'xml'/'assinatura' têm gate PRÓPRIO (admin OU CPF liberado) — ver canSeeTab em Sidebar.jsx.
// 'carta' e 'oficio-emissao' são liberadas pra todos (07/10/2026).
const GATED_TABS = new Set(['xml', 'assinatura']);
const ADMIN_TABS = new Set(['historico-assinatura']);

// Abas que certos CARGOS não podem ver, mesmo sem recorte de abas configurado no Gerenciar
// Permissões (07/10/2026: Carta de Correção e Ofício de Emissão foram liberadas pra todos,
// menos Comercial e Pós Venda). Admin/moderador nunca são afetados.
const TABS_BLOQUEADAS_POR_CARGO = {
  'carta':          ['comercial', 'pos venda'],
  'oficio-emissao': ['comercial', 'pos venda'],
  'empenho':        ['comercial', 'pos venda'],
};
const nomeCargo = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// `restrictedTabs`: cargo em "modo restrito" (Dashboard RH → Gerenciar
// Permissões) recortando quais abas da Oficina Estelar um cargo específico
// enxerga — ex: cargo "Comercial" só vendo Editor/Organizar/Mesclar PDF.
// undefined/[] = sem restrição, comportamento de sempre.
const FaturamentoPortal = ({ onBack, authUser, initialTab, restrictedTabs, cargoNames = [] }) => {
  const isMobile = useIsMobile();
  const isAdmin = authUser?.role === 'admin';
  // "Início" não entra numa restrição de cargo — pra quem é restrito, a
  // home vira a 1ª aba liberada.
  const homeTab = restrictedTabs?.length ? restrictedTabs[0] : 'inicio';
  const cargosNorm = (authUser?.role === 'admin' || authUser?.role === 'moderador') ? [] : cargoNames.map(nomeCargo);
  const hiddenTabs = Object.entries(TABS_BLOQUEADAS_POR_CARGO)
    .filter(([, cargos]) => cargosNorm.some(c => cargos.some(b => c.includes(b))))
    .map(([id]) => id);
  const allowedTab = (id) => {
    if (hiddenTabs.includes(id)) return false;
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
      case 'oficio-emissao': return <TabOficioEmissao/>;
      case 'empenho':        return <TabEmpenho/>;
      case 'inicio':
      default:            return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser} hidden={hiddenTabs}/>;
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
      <Sidebar tab={tab} setTab={safeSetTab} onBack={sair} isAdmin={isAdmin} authUser={authUser} only={restrictedTabs} hidden={hiddenTabs}/>
      <div style={{
        flex:1,
        minWidth:0, // sem isso a tabela larga estica a coluna além do fundo (faixa branca)
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
