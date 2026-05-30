import React, { useState, useEffect, useRef } from 'react';
import { T, FONTS, applyTheme } from './contexts/theme';
import { SERVER_URL, supabase as _supabase, loadUserPhoto } from './contexts/user';
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
  const [userPhoto, setUserPhoto] = useState(null);

  // Verifica token salvo ao carregar o app
  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (!token) { setAuthChecked(true); return; }
    fetch(`${SERVER_URL}/api/auth/me`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) { setAuthUser(d.user); ss('modules'); loadUserPhoto().then(p => { if (p) setUserPhoto(p); }); }
        else localStorage.removeItem('ch_token');
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = (user) => {
    setAuthUser(user);
    ss('modules');
    loadUserPhoto().then(p => { if (p) setUserPhoto(p); });
  };

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
  const seenNotifIds  = useRef(new Set());
  const firedTodayRef = useRef(new Set());

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

  /* Chime ascendente C5→E5→G5→C6, dura ~3 segundos */
  const playReminder = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [
        { freq: 523.25, start: 0.0,  dur: 1.1 },
        { freq: 659.25, start: 0.5,  dur: 1.1 },
        { freq: 783.99, start: 1.0,  dur: 1.2 },
        { freq: 1046.5, start: 1.6,  dur: 1.4 },
      ].forEach(({ freq, start, dur }) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(0.55, ctx.currentTime + start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur);
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
        if (n.type === 'aviso_urgente') playAlarm(); else playReminder();
      })
      .subscribe();
    return () => _supabase.removeChannel(channel);
  }, [authUser]);

  // ── Verificador de horário: dispara lembretes agendados ──
  useEffect(() => {
    if (!authUser) return;

    const check = async () => {
      const now   = new Date();
      const hhmm  = now.toTimeString().slice(0, 5);   // "HH:MM"
      const today = now.toISOString().slice(0, 10);   // "YYYY-MM-DD"
      const dow   = now.getDay();                      // 0=dom … 6=sab
      const dom   = now.getDate();                     // dia do mês

      const { data: reminders } = await _supabase
        .from('reminders')
        .select('*')
        .eq('active', true)
        .eq('created_by', authUser.name);

      if (!reminders?.length) return;

      for (const r of reminders) {
        if (!r.time || r.time.slice(0, 5) !== hhmm) continue;

        let due = false;
        switch (r.repeat) {
          case 'daily':   due = true; break;
          case 'weekly':  due = r.date ? new Date(r.date + 'T00:00:00').getDay() === dow : true; break;
          case 'monthly': due = r.date ? parseInt(r.date.split('-')[2]) === dom : true; break;
          default:        due = !r.date || r.date === today; break; // 'never'
        }
        if (!due) continue;

        const fireKey = `${r.id}_${today}_${hhmm}`;
        if (firedTodayRef.current.has(fireKey)) continue;
        firedTodayRef.current.add(fireKey);

        await _supabase.from('notifications').insert({
          type:       r.type === 'alexa' ? 'lembrete' : (r.type || 'lembrete'),
          title:      r.title  || 'Lembrete',
          message:    r.message || r.title || 'Você tem um lembrete!',
          active:     true,
          created_at: new Date().toISOString(),
        });
      }
    };

    check(); // verifica ao logar (caso tenha acabado de chegar no horário)
    const id = setInterval(check, 30000); // verifica a cada 30 segundos
    return () => clearInterval(id);
  }, [authUser]);

  const urgentNotif   = notifQueue.find(n => n.type === 'aviso_urgente');
  const lembreteNotif = !urgentNotif && notifQueue.find(n => n.type === 'lembrete' || n.type === 'alexa');
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
          {screen==='modules'     && <ModuleSelector onSelect={handleModuleSelect} authUser={authUser} onLogout={handleLogout} userPhoto={userPhoto}/>}
          {screen==='colaborador' && <Portal         onBack={()=>ss('modules')} onGoAlexa={()=>ss('alexa')} userPhoto={userPhoto} onPhotoChange={p=>setUserPhoto(p)}/>}
          {screen==='ponto'       && authUser?.role==='admin' && <PontoEletronico onBack={()=>ss('modules')} isAdmin={true}/>}
          {screen==='dashboard'   && authUser?.role==='admin' && <DashboardRH onBack={()=>ss('modules')} adminName={authUser.name}/>}
          {screen==='alexa'       && <CentralAlexa     onBack={()=>ss('modules')} userPhoto={userPhoto}/>}
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
            <style>{`
              @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
              @keyframes bluePulse{
                0%  {border-color:#1A6FB5;box-shadow:0 8px 30px rgba(26,111,181,0.35)}
                33% {border-color:#2196F3;box-shadow:0 8px 30px rgba(33,150,243,0.45)}
                66% {border-color:#0D47A1;box-shadow:0 8px 30px rgba(13,71,161,0.45)}
                100%{border-color:#1A6FB5;box-shadow:0 8px 30px rgba(26,111,181,0.35)}
              }
            `}</style>
            <img src="/Uniko.png" alt="Uniko" style={{width:64,height:64,objectFit:'contain',flexShrink:0,filter:'drop-shadow(0 4px 12px rgba(26,111,181,0.4))'}}/>
            <div style={{background:'white',borderRadius:16,padding:'14px 16px',maxWidth:300,border:'2px solid #1A6FB5',animation:'bluePulse 1.8s ease-in-out infinite'}}>
              <div style={{fontSize:10,color:'#1A6FB5',fontWeight:700,marginBottom:5,letterSpacing:'.06em'}}>UNIKO</div>
              <div style={{fontSize:13,color:'#333',lineHeight:1.5,marginBottom:10}}>
                Ei, você precisa lembrar de: <strong>{lembreteNotif.message}</strong>
              </div>
              <button onClick={()=>dismissNotif(lembreteNotif.id)}
                style={{padding:'5px 16px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#1A6FB5,#2196F3)',color:'white',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-body)'}}>
                Ok
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
