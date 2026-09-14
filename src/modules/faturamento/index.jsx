import React, { useState } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sidebar, TopBar, canSeeTab, NAV } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabLeitorXML } from './tabs/TabLeitorXML';
import { TabOficinaEstelar, TabCartaCorrecao } from './tabs/TabOficinaEstelar';
import { TabAssinatura } from './tabs/TabAssinatura';
import { TabHistoricoAssinatura } from './tabs/TabHistoricoAssinatura';
import { ferramentaDaUrl, voltarDaFerramenta } from './rotaFerramenta';

// 'xml'/'carta'/'assinatura' têm gate PRÓPRIO (admin OU CPF liberado) — ver canSeeTab em Sidebar.jsx
const GATED_TABS = new Set(['xml', 'carta', 'assinatura']);
const ADMIN_TABS = new Set(['historico-assinatura']);

const FaturamentoPortal = ({ onBack, authUser, initialTab }) => {
  const isMobile = useIsMobile();
  const isAdmin = authUser?.role === 'admin';
  /* initialTab: atalho do seletor de módulos. Passa pelas mesmas travas do
     safeSetTab — um atalho guardado não abre aba que a pessoa não pode ver. */
  const [tab, setTab] = useState(() => {
    const t = initialTab;
    if (!t || !NAV.some(n => n.id === t)) return 'inicio';
    if (GATED_TABS.has(t)) return canSeeTab(t, authUser, isAdmin) ? t : 'inicio';
    if (ADMIN_TABS.has(t) && !isAdmin) return 'inicio';
    return t;
  });

  useState(() => {
    const saved = localStorage.getItem('ch_theme') || 'blue';
    applyTheme(saved);
  });

  /* "Sair" normalmente é só o onBack do App (que é o Voltar do navegador). A
     exceção é ter uma ferramenta de PDF aberta: ela tem entrada própria no
     histórico (ver rotaFerramenta.js), então um Voltar só cairia na escolha de
     ferramenta em vez de sair do módulo — aí são dois de uma vez.
     BUG real corrigido (set/2026): isso era `window.history.go(-2)`, que
     assume uma profundidade FIXA de histórico — funcionava só se a pilha
     tivesse exatamente aquele formato. Chegar na Ferramenta de Edição por um
     atalho favoritado (ou qualquer navegação com uma pilha mais rasa/funda do
     que o esperado) fazia o "-2" ultrapassar a tela de módulos e cair numa
     entrada sem `screen` — o App tratava isso como sessão perdida e mandava
     pra tela de login, mesmo com o token continuando válido. Fix: em vez de
     "pula 2 de uma vez", desfaz a entrada da ferramenta (1 passo de verdade)
     e só DEPOIS de esse passo realmente acontecer (espera o popstate dele)
     sai do módulo (mais 1 passo) — sempre 2 passos RELATIVOS a onde a pessoa
     está agora, nunca 2 posições absolutas que podem não existir. */
  const sair = () => {
    if (!ferramentaDaUrl()) { onBack(); return; }
    const aposFecharFerramenta = () => {
      window.removeEventListener('popstate', aposFecharFerramenta);
      onBack();
    };
    window.addEventListener('popstate', aposFecharFerramenta);
    voltarDaFerramenta();
  };

  const safeSetTab = (id) => {
    if (GATED_TABS.has(id)) { if (!canSeeTab(id, authUser, isAdmin)) return; }
    else if (ADMIN_TABS.has(id) && !isAdmin) return;
    /* Sair da Ferramenta de Edição pela sidebar tem que desfazer a entrada da
       ferramenta aberta, senão ela fica órfã no histórico: a URL anunciaria uma
       ferramenta que não está mais na tela, e o "Sair" gastaria um clique
       voltando pra ela. */
    if (id !== 'oficina' && ferramentaDaUrl()) voltarDaFerramenta();
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
      case 'oficina':     return <TabOficinaEstelar/>;
      case 'carta':       return <TabCartaCorrecao/>;
      default:            return <TabInicio setTab={safeSetTab} isAdmin={isAdmin} authUser={authUser}/>;
    }
  };

  const hasTopBar = tab !== 'inicio';
  const padded    = tab !== 'inicio';

  return (
    <div style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={safeSetTab} onBack={sair} isAdmin={isAdmin} authUser={authUser}/>
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
