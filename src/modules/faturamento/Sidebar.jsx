import React, { useState } from 'react';
import { T } from '../../contexts/theme';
import { StarDivider } from '../../shared/components';
import { useIsMobile } from '../../hooks/useIsMobile';
import { bolhaGradiente } from '../../shared/bolhas';
/* Cabeçalho da barra — o MESMO componente que o Portal do Colaborador usa. */
import { UnikoBrandArt } from '../../shared/UnikoBrand';

// width/height opcionais: os atalhos do seletor de módulos redimensionam o ícone.
const I = (p) => (
  <svg width={p.width || 18} height={p.height || 18} viewBox="0 0 24 24" fill="none"
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
    id: 'pdf-editor',
    label: 'Editor de PDF',
    icon: <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I>,
  },
  {
    id: 'pdf-organizar',
    label: 'Organizar PDF',
    icon: <I><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></I>,
  },
  {
    id: 'pdf-mesclar',
    label: 'Mesclar PDF',
    icon: <I><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/><path d="M10 8h4M10 12h4M10 16h4"/></I>,
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
    id: 'carta',
    label: 'Carta de Correção',
    tabGate: true,
    icon: <I><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></I>,
  },
];

// `only` (ids a mostrar) — usado pelo cargo em "modo restrito" (Dashboard RH
// → Gerenciar Permissões) pra recortar quais abas da Oficina Estelar um
// cargo específico enxerga (ex: cargo "Comercial" só vendo Editor/Organizar/
// Mesclar PDF). Sem esse prop, comportamento 100% igual a antes.
const Sidebar = ({ tab, setTab, onBack, isAdmin, authUser, only }) => {
  const isMobile = useIsMobile();
  const [hov, sh] = useState(null);
  if (isMobile) return null;
  const visibleNav = NAV.filter(n => n.tabGate ? canSeeTab(n.id, authUser, isAdmin) : (!n.adminOnly || isAdmin))
    .filter(n => !only?.length || only.includes(n.id));

  return (
    <div style={{
      width: 252, minHeight: '100vh',
      background: T.sidebarBg, borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
      fontFamily: 'var(--font-body)',
    }}>
      {/* Brand — mesmo cabeçalho do Portal do Colaborador (pedido em 13/09/2026):
          a marca vem do componente compartilhado shared/UnikoBrand.jsx, e as
          manchas de luz seguem a mesma receita de lá. */}
      <div style={{padding:'18px 16px 12px',position:'relative',overflow:'hidden',
        borderBottom:`1px solid rgba(42,130,210,0.10)`}}>
        {/* Manchas de luz de fundo: degradê radial, SEM filter:blur — blur com
            scale animado é refeito a cada frame (ver shared/bolhas.js). */}
        <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',width:190,height:190,borderRadius:'50%',
            background:bolhaGradiente(T.sb1),top:'-70px',left:'-60px',
            animation:'brandBlob1 6s ease-in-out infinite'}}/>
          <div style={{position:'absolute',width:160,height:160,borderRadius:'50%',
            background:bolhaGradiente(T.sb2),top:'-45px',right:'-45px',
            animation:'brandBlob2 8s ease-in-out infinite'}}/>
        </div>
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',marginBottom:12}}>
          {/* A barra da Oficina é mais estreita que a do Portal (252 contra 280),
              então aqui a marca ocupa a largura disponível em vez do teto fixo
              de 238 de lá. */}
          <div style={{width:'100%'}}>
            <UnikoBrandArt legenda="Oficina Estelar"/>
          </div>
        </div>
        {/* star divider under brand */}
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

// homeTab: pra cargo restrito, a "aba raiz" (sem Voltar) não é sempre
// 'inicio' — vira a 1ª aba liberada. Default mantém o comportamento de sempre.
const TopBar = ({ tab, onBack, homeTab = 'inicio' }) => {
  const isMobile = useIsMobile();
  const nm = { inicio:'Início', xml:'Controle de Notas', assinatura:'Assinatura Automática', 'historico-assinatura':'Histórico de Assinatura', 'pdf-editor':'Editor de PDF', 'pdf-organizar':'Organizar PDF', 'pdf-mesclar':'Mesclar PDF', carta:'Carta de Correção' };
  if (tab === homeTab) return null;
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
