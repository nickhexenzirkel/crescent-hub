import React, { useState } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sidebar, TopBar } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabLeitorXML } from './tabs/TabLeitorXML';
import { TabRelatorioConsumo } from './tabs/TabRelatorioConsumo';
import { TabOrdensServico } from './tabs/TabOrdensServico';

const FaturamentoPortal = ({ onBack }) => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('inicio');

  useState(() => {
    const saved = localStorage.getItem('ch_theme') || 'blue';
    applyTheme(saved);
  });

  const renderTab = () => {
    switch (tab) {
      case 'inicio':  return <TabInicio setTab={setTab}/>;
      case 'xml':     return <TabLeitorXML/>;
      case 'consumo': return <TabRelatorioConsumo/>;
      case 'ordens':  return <TabOrdensServico/>;
      default:        return <TabInicio setTab={setTab}/>;
    }
  };

  const hasTopBar = tab !== 'inicio';
  const padded    = tab !== 'inicio';

  return (
    <div style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={setTab} onBack={onBack}/>
      <div style={{
        flex:1,
        marginLeft: isMobile ? 0 : 252,
        display:'flex',flexDirection:'column',
        minHeight:'100vh',
      }}>
        <TopBar tab={tab} onBack={() => setTab('inicio')}/>
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
