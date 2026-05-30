import React, { useState, useEffect, useRef } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { USER, SERVER_URL, getAuthUser } from '../../contexts/user';
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
import CentralLembretes from '../central-lembretes';

const Portal = ({onBack, onGoAlexa}) => {
  const [tab,st]=useState('inicio');
  const [activeTheme,setActiveTheme]=useState(()=>{ const s=localStorage.getItem('ch_theme')||'blue'; applyTheme(s); return s; });
  const [showSettings,setShowSettings]=useState(false);
  const [profileReady, setProfileReady] = useState(false);
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
    .finally(() => setProfileReady(true));
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
  const render=()=>{
    if(tab==='inicio')     return <TabInicio setTab={st} onGoAlexa={onGoAlexa} activeTheme={activeTheme}/>;
    if(tab==='financeiro') return <TabFinanceiro/>;
    if(tab==='dados')      return <TabDados/>;
    if(tab==='horas')      return <TabHoras/>;
    if(tab==='lembretes')  return <CentralLembretes authUser={{name: USER.name}} onBack={()=>st('inicio')}/>;
    if(tab==='feedback')   return <TabFeedback/>;
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
  return(
    <div key={activeTheme} style={{display:'flex',minHeight:'100vh',background:T.page,fontFamily:'var(--font-body)'}}>
      <Sidebar tab={tab} setTab={st} onBack={onBack} activeTheme={activeTheme} onTheme={handleTheme} onOpenSettings={()=>setShowSettings(true)}/>
      <div style={{marginLeft:252,flex:1,display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <TopBar tab={tab} onBack={()=>st('inicio')}/>
        <div style={{flex:1,padding:'28px 34px',overflowY:'auto',
          height:tab==='inicio'?'100vh':'calc(100vh - 52px)'}}>
          {render()}
        </div>
      </div>
      {showSettings && (
        <SettingsModal activeTheme={activeTheme}
          onTheme={(k)=>{handleTheme(k);}}
          onClose={()=>setShowSettings(false)}/>
      )}
    </div>
  );
};

export { Portal };
