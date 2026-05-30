import React, { useState, useEffect, useRef } from 'react';
import { T, FONTS, applyTheme } from './contexts/theme';
import { SERVER_URL, supabase as _supabase } from './contexts/user';
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

  // ── Sistema de notificações em tempo real ────────────────
  const [notifQueue, setNotifQueue] = useState([]);
  const [okInput, setOkInput]       = useState('');
  const seenNotifIds = useRef(new Set());

  const playBell = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach(d => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.25, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 1.4);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 1.4);
      });
    } catch {}
  };

  const playAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7, 1.05, 1.4].forEach((d, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square'; o.frequency.value = i % 2 === 0 ? 880 : 660;
        g.gain.setValueAtTime(0.15, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.3);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3);
      });
    } catch {}
  };

  useEffect(() => {
    if (!authUser) return;
    const channel = _supabase
      .channel('uniko-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, ({ new: n }) => {
        if (!n?.active || seenNotifIds.current.has(n.id)) return;
        seenNotifIds.current.add(n.id);
        setNotifQueue(q => [...q, n]);
        if (n.type === 'aviso_urgente') playAlarm(); else playBell();
      })
      .subscribe();
    return () => _supabase.removeChannel(channel);
  }, [authUser]);

  const urgentNotif   = notifQueue.find(n => n.type === 'aviso_urgente');
  const lembreteNotif = !urgentNotif && notifQueue.find(n => n.type === 'lembrete');
  const dismissNotif  = (id) => { setNotifQueue(q => q.filter(n => n.id !== id)); setOkInput(''); };

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

        {/* ── Aviso Urgente — tela cheia ── */}
        {authUser && urgentNotif && (
          <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'}}>
            <div style={{background:'white',borderRadius:20,padding:'48px 40px',maxWidth:500,width:'90%',textAlign:'center',boxShadow:'0 20px 80px rgba(192,64,80,0.5)',border:'2px solid rgba(192,64,80,0.25)'}}>
              <div style={{fontSize:48,marginBottom:16}}>🚨</div>
              <div style={{fontSize:22,fontWeight:700,color:'#C04050',marginBottom:12,fontFamily:'var(--font-brand)',letterSpacing:'.02em'}}>{urgentNotif.title||'Aviso Urgente'}</div>
              <div style={{fontSize:15,color:'#333',marginBottom:36,lineHeight:1.6}}>{urgentNotif.message}</div>
              <div style={{fontSize:12,color:'#999',marginBottom:10}}>Digite <strong style={{color:'#C04050'}}>Ok</strong> e pressione Enter para fechar</div>
              <input autoFocus value={okInput} onChange={e=>setOkInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&okInput.trim().toLowerCase()==='ok') dismissNotif(urgentNotif.id);}}
                placeholder="Ok"
                style={{width:'100%',padding:'11px 14px',borderRadius:10,border:'2px solid rgba(192,64,80,0.35)',fontSize:15,outline:'none',textAlign:'center',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
            </div>
          </div>
        )}

        {/* ── Lembrete — bolha Uniko canto inferior esquerdo ── */}
        {authUser && lembreteNotif && (
          <div style={{position:'fixed',bottom:24,left:24,zIndex:9998,display:'flex',alignItems:'flex-end',gap:10,animation:'slideUp .35s ease'}}>
            <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div style={{width:50,height:50,borderRadius:'50%',background:'linear-gradient(135deg,#D89030,#F0A840)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,boxShadow:'0 4px 16px rgba(216,144,48,0.5)'}}>
              🎵
            </div>
            <div style={{background:'white',borderRadius:16,padding:'14px 16px',boxShadow:'0 8px 30px rgba(0,0,0,0.15)',border:'1.5px solid rgba(216,144,48,0.3)',maxWidth:300}}>
              <div style={{fontSize:10,color:'#D89030',fontWeight:700,marginBottom:5,letterSpacing:'.06em'}}>UNIKO</div>
              <div style={{fontSize:13,color:'#333',lineHeight:1.5,marginBottom:10}}>
                Ei, você precisa lembrar de: <strong>{lembreteNotif.message}</strong>
              </div>
              <button onClick={()=>dismissNotif(lembreteNotif.id)}
                style={{padding:'5px 16px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#D89030,#F0A840)',color:'white',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                Ok
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
