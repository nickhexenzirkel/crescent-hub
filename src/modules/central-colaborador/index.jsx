import React, { useState, useEffect, useRef } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { USER, SERVER_URL, getAuthUser, isProfileComplete as checkProfileComplete } from '../../contexts/user';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NAV } from './Sidebar';
import { SettingsModal } from '../../shared/SettingsModal';
import { Sidebar, TopBar } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabFinanceiro } from './tabs/TabFinanceiro';
import { TabDados } from './tabs/TabDados';
import { TabHoras } from './tabs/TabHoras';
import { TabFeedback } from './tabs/TabFeedback';
import { TabEventos } from './tabs/TabEventos';
import { TabGames } from './tabs/TabGames';
import { TabConquistas } from './tabs/TabConquistas';
import { TabFeed } from './tabs/TabFeed';
import { TabComunicados } from './tabs/TabComunicados';
import { TabMyDoko } from './tabs/TabMyDoko';
import { TabColegas } from './tabs/TabColegas';
import CentralLembretes from '../central-lembretes';

const Portal = ({onBack, onGoAlexa, userPhoto, onPhotoChange}) => {
  const isMobile = useIsMobile();
  const [tab,st]=useState('inicio');
  const [activeTheme,setActiveTheme]=useState(()=>{ const s=localStorage.getItem('ch_theme')||'blue'; applyTheme(s); return s; });
  const [showSettings,setShowSettings]=useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Busca o perfil completo do usuário ao abrir o Portal
  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (!token) { setProfileReady(true); return; }
    fetch(`${SERVER_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (d?.profile) {
        const p = d.profile;
        // Atualiza USER com dados reais do banco
        if (p.name)       { USER.name = p.name; USER.short = p.name.split(' ')[0]; USER.avatar = p.name.split(' ').map(n=>n[0]).slice(0,2).join(''); }
        if (p.cargo)      USER.cargo      = p.cargo;
        if (p.category)   USER.category   = p.category;
        if (p.admission)  USER.admission  = p.admission;
        if (p.cpf)        USER.cpf        = p.cpf;
        if (p.rg)         USER.rg         = p.rg;
        if (p.birth_date) USER.birth      = p.birth_date;
        if (p.email)      USER.email      = p.email;
        if (p.phone)      USER.phone      = p.phone;
        if (p.street)     USER.street     = p.street;
        if (p.district)   USER.district   = p.district;
        if (p.city)       USER.city       = p.city;
        if (p.state)      USER.state      = p.state;
        if (p.cep)        USER.cep        = p.cep;
        if (p.dependents !== undefined) USER.dependents = p.dependents;
        if (p.salary !== undefined) USER.salary    = Number(p.salary) || 0;
        if (p.inss   !== undefined) USER.inss      = Number(p.inss)   || 0;
        /* ir = desconto adicional (ex: INSS sobre 1K Service) — não exibido separado */
        if (p.ir     !== undefined) USER.ir        = Number(p.ir)     || 0;
        /* vt armazena o valor da 1K Service no banco (campo reaproveitado) */
        if (p.vt     !== undefined) USER.salary_1k = Number(p.vt)     || 0;
      }
    })
    .catch(() => {})
    .finally(() => { setProfileReady(true); setProfileComplete(checkProfileComplete()); });
  }, []);

  /* Ticker de fundo para o My Uniko — mantém stats atualizados em outros tabs */
  useEffect(() => {
    const key = (() => { try { const a = getAuthUser(); return a?.cpf ? `uniko_doko_${a.cpf}` : 'uniko_doko'; } catch { return 'uniko_doko'; } })();
    const id = setInterval(() => {
      if (tabRef.current === 'uniko') return; // TabMyDoko cuida quando ativo
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const data = JSON.parse(raw);
        let { fome = 75, energia = 70, sono = 70, dormindo = false } = data;
        if (dormindo) {
          fome = Math.max(0,   fome - 0.008);
          sono = Math.min(100, sono + 2.5);
        } else {
          fome    = Math.max(0, fome    - 0.025);
          energia = Math.max(0, energia - 0.025);
          sono    = Math.max(0, sono    - 0.016);
        }
        localStorage.setItem(key, JSON.stringify({ ...data, fome, energia, sono, lastUpdated: Date.now() }));
      } catch {}
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const handleTheme=(key)=>{applyTheme(key);setActiveTheme(key);localStorage.setItem('ch_theme',key);};
  const handleProfileSaved = () => setProfileComplete(checkProfileComplete());
  const render=()=>{
    if(tab==='inicio')     return <TabInicio setTab={st} onGoAlexa={onGoAlexa} activeTheme={activeTheme} userPhoto={userPhoto} onPhotoChange={onPhotoChange} profileComplete={profileComplete}/>;
    if(tab==='financeiro') return <TabFinanceiro/>;
    if(tab==='dados')      return <TabDados onProfileSaved={handleProfileSaved}/>;
    if(tab==='horas')      return <TabHoras/>;
    if(tab==='lembretes')  return <CentralLembretes authUser={{name: USER.name}} onBack={()=>st('inicio')}/>;
    if(tab==='feedback')   return <TabFeedback/>;
    if(tab==='colegas')    return <TabColegas/>;
    if(tab==='eventos')    return <TabEventos/>;
    if(tab==='games')      return <TabGames/>;
    if(tab==='conquistas') return <TabConquistas/>;
    if(tab==='feed')        return <TabFeed/>;
    if(tab==='comunicados') return <TabComunicados/>;
    if(tab==='uniko')       return <TabMyDoko/>;
    return null;
  };

  // Mostra spinner enquanto carrega o perfil
  if (!profileReady) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.page}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:32,height:32,borderRadius:'50%',border:`3px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 12px'}}/>
        <div style={{fontSize:13,color:T.textT,fontFamily:'var(--font-body)'}}>Carregando seu perfil...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  /* ── Mobile bottom nav items ── */
  const MOBILE_NAV = [
    {id:'inicio',      label:'Início',    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-5H9v5H4a1 1 0 01-1-1z"/></svg>},
    {id:'comunicados', label:'Avisos',    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>},
    {id:'financeiro',  label:'Finanças',  icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v1.5M12 15.5V17M9.5 10.5c0-1.1.9-2 2.5-2s2.5.9 2.5 2-2.5 2-2.5 2-2.5.9-2.5 2 .9 2 2.5 2 2.5-.9 2.5-2"/></svg>},
    {id:'lembretes',   label:'Lembretes', icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></svg>},
    {id:'__menu',      label:'Menu',      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>},
  ];

  return(
    <div key={activeTheme} style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={st} onBack={onBack} activeTheme={activeTheme} onTheme={handleTheme} onOpenSettings={()=>setShowSettings(true)} userPhoto={userPhoto} profileComplete={profileComplete}/>
      <div style={{marginLeft:isMobile?0:252,flex:1,display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <TopBar tab={tab} onBack={()=>st('inicio')}/>
        <div style={{flex:1,padding:isMobile?'16px':'28px 34px',overflowY:'auto',
          paddingBottom:isMobile?'76px':'28px',
          height:(!isMobile&&tab==='inicio')?'100vh':(!isMobile?'calc(100vh - 52px)':undefined)}}>
          {render()}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:300,
          background:T.surface,borderTop:`1px solid ${T.border}`,
          display:'flex',height:60,fontFamily:'var(--font-body)'}}>
          {MOBILE_NAV.map(n=>{
            const active = n.id!=='__menu' && tab===n.id;
            return(
              <button key={n.id}
                onClick={()=> n.id==='__menu' ? setShowMobileMenu(true) : st(n.id)}
                style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                  justifyContent:'center',gap:3,border:'none',background:'none',
                  cursor:'pointer',color:active?T.gold:T.textT,padding:0,outline:'none'}}>
                <span style={{color:active?T.gold:T.textT}}>{n.icon}</span>
                <span style={{fontSize:9,fontWeight:active?700:400,letterSpacing:'.03em'}}>{n.label}</span>
                {active && <span style={{position:'absolute',bottom:0,width:24,height:2,borderRadius:99,background:T.gold}}/>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Mobile menu overlay ── */}
      {isMobile && showMobileMenu && (
        <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={()=>setShowMobileMenu(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)'}}/>
          <div onClick={e=>e.stopPropagation()}
            style={{position:'relative',background:T.surface,borderRadius:'20px 20px 0 0',
              border:`1px solid ${T.border}`,maxHeight:'82vh',overflowY:'auto',
              padding:'12px 16px 32px'}}>
            {/* Handle */}
            <div style={{width:36,height:4,borderRadius:99,background:T.border,margin:'0 auto 16px'}}/>
            <div style={{fontSize:11,color:T.textD,letterSpacing:'.09em',textTransform:'uppercase',
              padding:'0 4px 10px',fontWeight:600}}>Navegação</div>
            {NAV.map(n=>{
              const locked = n.id==='uniko' && !profileComplete;
              return(
                <div key={n.id}
                  onClick={()=>{ if(locked){st('dados');}else{st(n.id);} setShowMobileMenu(false); }}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'13px 12px',
                    borderRadius:10,marginBottom:2,
                    background:tab===n.id?T.goldGl:'transparent',
                    color:tab===n.id?T.gold:T.textS,
                    opacity:locked?0.45:1}}>
                  <span style={{color:tab===n.id?T.gold:T.textT}}>{n.icon}</span>
                  <span style={{fontSize:15,fontWeight:tab===n.id?600:400}}>{n.label}</span>
                  {locked && <span style={{marginLeft:'auto',fontSize:11,color:T.textD}}>🔒</span>}
                </div>
              );
            })}
            <div style={{height:1,background:T.divider,margin:'10px 0'}}/>
            <div onClick={()=>{setShowMobileMenu(false); setTimeout(()=>setShowSettings(true),100);}}
              style={{display:'flex',alignItems:'center',gap:12,padding:'13px 12px',borderRadius:10,cursor:'pointer',
                opacity:profileComplete?1:0.45,color:T.textS}}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/></svg>
              <span style={{fontSize:15}}>Configurações</span>
              {!profileComplete && <span style={{marginLeft:'auto',fontSize:11,color:T.textD}}>🔒</span>}
            </div>
            <div onClick={()=>{setShowMobileMenu(false); onBack();}}
              style={{display:'flex',alignItems:'center',gap:12,padding:'13px 12px',borderRadius:10,cursor:'pointer',color:T.danger}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span style={{fontSize:15,fontWeight:500}}>Sair</span>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal activeTheme={activeTheme}
          onTheme={(k)=>{handleTheme(k);}}
          onClose={()=>setShowSettings(false)}/>
      )}
    </div>
  );
};

export { Portal };
