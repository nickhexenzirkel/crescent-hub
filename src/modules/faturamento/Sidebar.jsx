import React, { useState } from 'react';
import { T } from '../../contexts/theme';
import { StarDivider } from '../../shared/components';
import { useIsMobile } from '../../hooks/useIsMobile';

const I = (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

// Algumas abas, além dos admins, são liberadas por CPF pra colaboradores específicos
// (pedido em 27/05/2026 pro Controle de Notas; jul/2026 Carta de Correção/Assinatura
// Automática liberadas pro CPF 084.543.603-10). Admin continua vendo tudo normalmente.
const TAB_CPF_WHITELIST = {
  xml: ['09538288327', '09027334358', '07526901329', '08454360310'],
  carta: ['08454360310'],
  assinatura: ['08454360310'],
};
const cpfDigits = (c) => (c || '').replace(/\D/g, '');
const canSeeTab = (tabId, authUser, isAdmin) => isAdmin || (TAB_CPF_WHITELIST[tabId] || []).includes(cpfDigits(authUser?.cpf));
// Mantido pra compatibilidade com quem já importa canSeeXml diretamente
const canSeeXml = (authUser, isAdmin) => canSeeTab('xml', authUser, isAdmin);

const NAV = [
  {
    id: 'inicio',
    label: 'Início',
    icon: <I><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-5H9v5H4a1 1 0 01-1-1z"/></I>,
  },
  {
    id: 'xml',
    label: 'Controle de Notas',
    tabGate: true,
    icon: <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="19" x2="13" y2="19"/></I>,
  },
  {
    id: 'assinatura',
    label: 'Assinatura Automática',
    tabGate: true,
    icon: <I><path d="M20 19.5v.5a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h9"/><polyline points="13 8 16 5 21 10 18 13"/><line x1="8" y1="17" x2="12" y2="17"/><line x1="8" y1="13" x2="10" y2="13"/></I>,
  },
  {
    id: 'historico-assinatura',
    label: 'Histórico de Assinatura',
    adminOnly: true,
    icon: <I><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></I>,
  },
  {
    id: 'consumo',
    label: 'Relatório de Consumo',
    adminOnly: true,
    icon: <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>,
  },
  {
    id: 'ordens',
    label: 'Ordens de Serviço',
    adminOnly: true,
    icon: <I><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></I>,
  },
  {
    id: 'uniko-pdf',
    label: 'Compilador',
    adminOnly: true,
    icon: <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></I>,
  },
  {
    id: 'laboratorio',
    label: 'Laboratório Estelar',
    adminOnly: true,
    icon: <I><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></I>,
  },
  {
    id: 'oficina',
    label: 'Ferramenta de Edição',
    icon: <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I>,
  },
  {
    id: 'carta',
    label: 'Carta de Correção',
    tabGate: true,
    icon: <I><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></I>,
  },
  {
    id: 'oficio',
    label: 'Ofício de Emissão',
    adminOnly: true,
    icon: <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></I>,
  },
];

const Sidebar = ({ tab, setTab, onBack, isAdmin, authUser }) => {
  const isMobile = useIsMobile();
  const [hov, sh] = useState(null);
  if (isMobile) return null;
  const visibleNav = NAV.filter(n => n.tabGate ? canSeeTab(n.id, authUser, isAdmin) : (!n.adminOnly || isAdmin));

  return (
    <div style={{
      width: 252, minHeight: '100vh',
      background: T.sidebarBg, borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
      fontFamily: 'var(--font-body)',
    }}>
      {/* Brand */}
      <div style={{padding:'18px 16px 12px',position:'relative',overflow:'hidden',borderBottom:`1px solid rgba(42,130,210,0.10)`}}>
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',width:110,height:110,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb1} 0%,transparent 70%)`,
            top:'-30px',left:'-20px',filter:'blur(22px)',animation:'brandBlob1 6s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:95,height:95,borderRadius:'50%',
            background:`radial-gradient(circle,${T.sb2} 0%,transparent 70%)`,
            top:'-10px',right:'-10px',filter:'blur(18px)',animation:'brandBlob2 8s ease-in-out infinite'}}/>
        </div>
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:13,marginBottom:12}}>
          <div style={{position:'relative',flexShrink:0,width:58,height:58}}>
            <div style={{position:'absolute',inset:'-8px',borderRadius:'50%',
              background:`radial-gradient(circle,${T.lb} 0%,${T.lb2} 55%,transparent 80%)`,
              filter:'blur(10px)',animation:'brandBlob1 12s ease-in-out infinite',zIndex:0,pointerEvents:'none'}}/>
            <div style={{position:'absolute',inset:0,zIndex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <img src="/UNIKO_NEW.png" alt="Uniko" style={{width:52,height:52,objectFit:'contain',display:'block'}}/>
            </div>
          </div>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:15.5,fontWeight:700,color:T.text,letterSpacing:'.05em'}}>Oficina Estelar</div>
          </div>
        </div>
        <StarDivider my={0}/>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:'8px 12px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
        <div style={{fontSize:11.5,color:T.textD,letterSpacing:'.09em',textTransform:'uppercase',padding:'2px 8px 10px',fontWeight:600}}>NAVEGAÇÃO</div>
        {visibleNav.map(n => {
          const a = tab === n.id;
          const cs = !!n.comingSoon;
          return (
            <div key={n.id}
              onClick={() => !cs && setTab(n.id)}
              onMouseEnter={() => sh(n.id)}
              onMouseLeave={() => sh(null)}
              style={{
                display:'flex',alignItems:'center',gap:11,padding:'11px 13px',
                borderRadius:10,cursor:cs?'default':'pointer',
                background:a?T.goldGl:hov===n.id&&!cs?(T.surfaceSub||'rgba(0,0,0,0.03)'):'transparent',
                border:a?`1px solid rgba(212,168,75,0.22)`:'1px solid transparent',
                color:a?T.gold:cs?T.textD:hov===n.id?T.text:T.textS,
                opacity:cs?0.65:1,
                transition:'all .14s',
              }}>
              <span style={{color:a?T.gold:cs?T.textD:hov===n.id?T.textS:T.textT,fontSize:18,minWidth:22,textAlign:'center'}}>{n.icon}</span>
              <span style={{fontSize:15,fontWeight:a?600:400,flex:1}}>{n.label}</span>
              {cs && <span style={{fontSize:9.5,fontWeight:700,color:'#8B5FE8',background:'rgba(139,95,232,0.12)',padding:'2px 7px',borderRadius:8,letterSpacing:'.04em',flexShrink:0}}>EM BREVE</span>}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{padding:'10px 12px 18px'}}>
        <StarDivider my={0}/>
        <div
          onClick={onBack}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(192,64,80,0.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          style={{display:'flex',alignItems:'center',gap:8,padding:'9px 13px',borderRadius:9,cursor:'pointer',color:T.danger,fontSize:14,fontWeight:500,marginTop:8,transition:'background .14s'}}>
          ← Sair
        </div>
      </div>
    </div>
  );
};

const TopBar = ({ tab, onBack }) => {
  const isMobile = useIsMobile();
  const nm = { inicio:'Início', xml:'Controle de Notas', assinatura:'Assinatura Automática', 'historico-assinatura':'Histórico de Assinatura', consumo:'Relatório de Consumo', ordens:'Ordens de Serviço', 'uniko-pdf':'Compilador', laboratorio:'Laboratório Estelar', oficina:'Ferramenta de Edição', carta:'Carta de Correção', oficio:'Ofício de Emissão' };
  if (tab === 'inicio') return null;
  return (
    <div style={{
      height:52,display:'flex',alignItems:'center',
      gap:isMobile?8:12,padding:isMobile?'0 14px':'0 30px',
      background:T.topbarBg,backdropFilter:'blur(12px)',
      borderBottom:`1px solid ${T.border}`,flexShrink:0,
      fontFamily:'var(--font-body)',position:'relative',zIndex:300,
    }}>
      <button onClick={onBack}
        onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        style={{display:'flex',alignItems:'center',gap:7,background:'none',border:'none',cursor:'pointer',color:T.textS,fontFamily:'var(--font-body)',fontSize:14,padding:'4px 9px',borderRadius:7,transition:'background .14s'}}>
        ← Voltar
      </button>
      <div style={{width:1,height:16,background:T.divider}}/>
      <div style={{fontSize:14,color:T.textT,flex:1}}>
        Oficina Estelar
        <span style={{color:T.textD,margin:'0 5px'}}>›</span>
        <strong style={{color:T.text,fontWeight:500}}>{nm[tab]||tab}</strong>
      </div>
    </div>
  );
};

export { I, NAV, Sidebar, TopBar, canSeeXml, canSeeTab };
