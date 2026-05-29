import React, { useState, useEffect } from 'react';
import { T, FONTS, applyTheme } from './contexts/theme';
import { SERVER_URL } from './contexts/user';
import { LavaLamp } from './shared/components';
import { LandingPage } from './shared/LandingPage';
import { LoginScreen } from './shared/LoginScreen';
import { ModuleSelector } from './shared/ModuleSelector';
import { Portal } from './modules/central-colaborador';
import PontoEletronico from './modules/ponto-eletronico';
import DashboardRH from './modules/dashboard-rh';
import CentralAlexa from './modules/central-alexa';

export default function CrescentHub() {
  const [screen, ss]       = useState('landing');
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Verifica token salvo ao carregar o app
  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (!token) { setAuthChecked(true); return; }
    fetch(`${SERVER_URL}/api/auth/me`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) { setAuthUser(d.user); ss('modules'); }
        else localStorage.removeItem('ch_token');
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = (user) => { setAuthUser(user); ss('modules'); };

  const handleLogout = () => {
    localStorage.removeItem('ch_token');
    setAuthUser(null);
    ss('login');
  };

  const handleModuleSelect = (id) => {
    const adminOnly = ['dashboard','ponto'];
    if (adminOnly.includes(id) && authUser?.role !== 'admin') return;
    ss(id);
  };

  if (!authChecked) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.page||'#F0F6FC'}}>
      <div style={{width:32,height:32,borderRadius:'50%',border:`3px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <>
      <style>{FONTS}</style>
      <div style={{minHeight:'100vh',background:T.page,color:T.text,fontFamily:'var(--font-body)',position:'relative'}}>
        <LavaLamp/>
        <div style={{position:'relative',zIndex:1,minHeight:'100vh'}}>
          {screen==='landing'     && <LandingPage    onStart={()=>ss('login')}/>}
          {screen==='login'       && <LoginScreen    onLogin={handleLogin}/>}
          {screen==='modules'     && <ModuleSelector onSelect={handleModuleSelect} authUser={authUser} onLogout={handleLogout}/>}
          {screen==='colaborador' && <Portal         onBack={()=>ss('modules')}/>}
          {screen==='ponto'       && authUser?.role==='admin' && <PontoEletronico onBack={()=>ss('modules')} isAdmin={true}/>}
          {screen==='dashboard'   && authUser?.role==='admin' && <DashboardRH onBack={()=>ss('modules')} adminName={authUser.name}/>}
          {screen==='alexa'       && <CentralAlexa  onBack={()=>ss('modules')}/>}
        </div>
      </div>
    </>
  );
}
