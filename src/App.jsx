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
import FaturamentoPortal from './modules/faturamento';
import ConexaoSetorial from './modules/conexao-setorial';
import MercadoEstelar from './modules/mercado-estelar';
import LobbyEstelar from './modules/lobby-estelar';
import { notifyDesktop, ensureNotifyPermission } from './utils/desktopNotify';
import { useIsMobile } from './hooks/useIsMobile';
import UnikoAssistant from './shared/UnikoAssistant';
import CaptureUnikoWidget from './shared/CaptureUnikoWidget';
import { loadCaptureConfig, CONFIG_KEY, loadCustomUnikos, syncServerClock } from './shared/captureUniko';

export default function CrescentHub() {
  const [screen, ss]       = useState('landing');
  const [authUser, setAuthUser] = useState(null);
  const [captureCfg, setCaptureCfg] = useState(null); // "Capture o Uniko" — global
  const [authChecked, setAuthChecked] = useState(false);
  const [userPhoto, setUserPhoto] = useState(null);
  const isMobile = useIsMobile();
  // Config do "Capture o Uniko" — o aviso (som + assistente) é GLOBAL; o card só no Portal.
  // Atualiza em tempo real (realtime + poll) pra o spawn chegar a todos ~ao mesmo tempo.
  useEffect(() => {
    if (!authUser) return;
    let alive = true;
    const refresh = () => loadCaptureConfig().then(c => {
      if (!alive) return;
      const next = c?.enabled ? c : null;
      setCaptureCfg(prev => (JSON.stringify(prev || null) === JSON.stringify(next) ? prev : next));
    });
    refresh();
    const ch = _supabase.channel('capture-cfg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${CONFIG_KEY}` }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 5000); // fallback caso realtime não esteja habilitado
    return () => { alive = false; clearInterval(poll); try { _supabase.removeChannel(ch); } catch {} };
  }, [authUser]);
  // Unikos criados na Oficina (Dashboard RH) — carrega o roster + skins de assistente
  // uma vez no login, pra getUniko/getAssistantSkin já encontrarem os customizados.
  useEffect(() => { if (authUser) loadCustomUnikos(); }, [authUser]);
  // Sincroniza o relógio com o servidor (offset salvo em memória) — sem isso, o spawn do
  // Capture o Uniko aparece em instantes ligeiramente diferentes em cada PC conforme o
  // quanto o relógio local está errado. Reforça de novo a cada 10min (deriva pouca coisa).
  useEffect(() => {
    if (!authUser) return;
    syncServerClock();
    const id = setInterval(syncServerClock, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [authUser]);
  // Verifica token salvo ao carregar o app
  useEffect(() => {
    const token = localStorage.getItem('ch_token');
    if (!token) {
      // Semeia o estado inicial — garante que voltar ao início funcione
      window.history.replaceState({ screen: 'landing' }, '');
      setAuthChecked(true);
      return;
    }
    fetch(`${SERVER_URL}/api/auth/me`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) {
          setAuthUser(d.user);
          ss('modules');
          window.history.replaceState({ screen: 'modules' }, '');
          loadUserPhoto().then(p => { if (p) setUserPhoto(p); });
        } else {
          localStorage.removeItem('ch_token');
          window.history.replaceState({ screen: 'landing' }, '');
        }
      })
      .catch(() => { window.history.replaceState({ screen: 'landing' }, ''); })
      .finally(() => setAuthChecked(true));
  }, []);

  // ── Navegação com histórico do navegador ─────────────────
  // push: nova entrada (permite voltar). replace: troca sem acumular.
  const navPush    = (s) => { window.history.pushState({ screen: s }, '', '#' + s); ss(s); };
  const navReplace = (s) => { window.history.replaceState({ screen: s }, '', '#' + s); ss(s); };
  const handleGoBack = () => { window.history.back(); };

  useEffect(() => {
    const onPop = (e) => {
      const s = e.state?.screen;
      if (s) ss(s);
      // state nulo = entrada anterior ao site (sem estado) → vai para o início
      else ss('landing');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleLogin = (user) => {
    setAuthUser(user);
    navReplace('modules');
    loadUserPhoto().then(p => { if (p) setUserPhoto(p); });
  };

  const handleLogout = () => {
    localStorage.removeItem('ch_token');
    setAuthUser(null);
    navReplace('login');
  };

  const handleModuleSelect = (id) => {
    // Conexão Setorial é liberada pra todo mundo — não entra na lista abaixo.
    const adminOnly = ['dashboard','ponto','lobby-estelar'];
    if (adminOnly.includes(id) && authUser?.role !== 'admin') return;
    navPush(id);
  };

  // ── Sistema de notificações em tempo real ────────────────
  const [notifQueue, setNotifQueue] = useState([]);
  const [okInput, setOkInput]       = useState('');
  const seenNotifIds  = useRef(new Set());
  const firedTodayRef = useRef(new Set());

  const withCtx = (fn) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const run = () => { try { fn(ctx); } catch {} };
      ctx.state === 'suspended' ? ctx.resume().then(run).catch(() => {}) : run();
    } catch {}
  };

  const playBell = () => withCtx(ctx => {
    [0, 0.18, 0.36].forEach(d => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 1.4);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 1.4);
    });
  });

  /* Chime ascendente C5→E5→G5→C6, dura ~3 segundos */
  const playReminder = () => withCtx(ctx => {
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
  });

  const playAlarm = () => withCtx(ctx => {
    [0, 0.35, 0.7, 1.05, 1.4].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'square'; o.frequency.value = i % 2 === 0 ? 880 : 660;
      g.gain.setValueAtTime(0.15, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.3);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.3);
    });
  });

  // notifyDesktop/ensureNotifyPermission vêm de utils/desktopNotify (extensão + fallback web).

  // Pede a permissão de notificação no PRIMEIRO gesto do usuário (o Chrome exige um
  // clique/tecla para exibir o prompt). Garante que o fallback do navegador funcione.
  useEffect(() => {
    if (!authUser) return;
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    const ask = () => { ensureNotifyPermission().finally(cleanup); };
    const cleanup = () => {
      window.removeEventListener('pointerdown', ask);
      window.removeEventListener('keydown', ask);
    };
    window.addEventListener('pointerdown', ask, { once: true });
    window.addEventListener('keydown', ask, { once: true });
    return cleanup;
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    // Processa um aviso recebido (in-site + som + notificação no desktop).
    const handleNotif = (n) => {
      if (!n?.active || seenNotifIds.current.has(n.id)) return;
      seenNotifIds.current.add(n.id);
      setNotifQueue(q => [...q, n]);
      if (n.type === 'aviso_urgente') playAlarm(); else playReminder();
      notifyDesktop(n); // pop-up no desktop (avisos do RH: urgente e lembrete geral)
    };

    const channel = _supabase
      .channel('uniko-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, ({ new: n }) => handleNotif(n))
      .subscribe();

    // Fallback por polling: garante a entrega dos avisos do RH mesmo se o realtime
    // perder um evento (reconexão / aba suspensa em 2º plano). Dedup via seenNotifIds.
    let baseline = true; // 1ª passada só marca o que já existe (não reexibe avisos antigos)
    const pollNotifs = async () => {
      const since = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      const { data } = await _supabase
        .from('notifications')
        .select('*')
        .eq('active', true)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      for (const n of (data || [])) {
        if (seenNotifIds.current.has(n.id)) continue;
        if (baseline) { seenNotifIds.current.add(n.id); continue; }
        handleNotif(n);
      }
      baseline = false;
    };
    pollNotifs();
    const pollId = setInterval(pollNotifs, 25000);

    return () => { _supabase.removeChannel(channel); clearInterval(pollId); };
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
        // Apenas lembretes pessoais são gerenciados pelo cliente.
        // alexa, lembrete e aviso_urgente são responsabilidade do cron do servidor.
        if (r.type !== 'personal') continue;
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

        // __urgent__ prefix indica aviso_urgente salvo como 'lembrete' por limitação do check constraint
        const isUrgent  = r.message?.startsWith('__urgent__');
        const cleanMsg  = isUrgent ? r.message.slice('__urgent__'.length) : r.message;
        const notifType = isUrgent ? 'aviso_urgente' : 'lembrete';

        const payload = {
          type:       notifType,
          title:      r.title  || (isUrgent ? 'Aviso Urgente' : 'Lembrete'),
          message:    cleanMsg  || r.title || (isUrgent ? 'Você tem um aviso urgente!' : 'Você tem um lembrete!'),
          active:     true,
          created_at: new Date().toISOString(),
        };

        // Lembretes pessoais (type='personal') só disparam localmente — sem inserir
        // na tabela notifications, para não vazar o aviso para outros usuários via realtime.
        // Lembretes do DashboardRH (lembrete/alexa/urgente) inserem no banco → broadcast.
        let notifObj;
        if (r.type === 'personal') {
          notifObj = { ...payload, id: fireKey };
        } else {
          const { data: inserted } = await _supabase
            .from('notifications').insert(payload).select('id').single();
          notifObj = { ...payload, id: inserted?.id ?? fireKey };
        }

        // Marca como visto para o canal realtime não duplicar (broadcast)
        seenNotifIds.current.add(notifObj.id);

        // Dispara popup e som diretamente, sem esperar o realtime
        setNotifQueue(q => [...q, notifObj]);
        if (isUrgent) playAlarm(); else playReminder();
        notifyDesktop(notifObj); // pop-up no desktop via extensão (lembretes pessoais)
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
      <style>{`body.uw-active .floating-theme-btn{display:none!important}`}</style>
      <div style={{minHeight:'100vh',background:T.page,color:T.text,fontFamily:'var(--font-body)',position:'relative'}}>
        <LavaLamp/>
        <div style={{position:'relative',zIndex:1,minHeight:'100vh'}}>
          {screen==='landing'     && <LandingPage    onStart={()=>navPush('login')}/>}
          {screen==='login'       && <LoginScreen    onLogin={handleLogin}/>}
          {screen==='modules'     && <ModuleSelector onSelect={handleModuleSelect} authUser={authUser} onLogout={handleLogout} userPhoto={userPhoto}/>}
          {screen==='colaborador' && <Portal         onBack={handleGoBack} onGoAlexa={()=>navPush('alexa')} userPhoto={userPhoto} onPhotoChange={p=>setUserPhoto(p)}/>}
          {screen==='ponto'       && authUser?.role==='admin' && <PontoEletronico onBack={handleGoBack} isAdmin={true}/>}
          {screen==='dashboard'   && authUser?.role==='admin' && <DashboardRH onBack={handleGoBack} adminName={authUser.name}/>}
          {screen==='alexa'       && <CentralAlexa        onBack={handleGoBack} userPhoto={userPhoto}/>}
          {screen==='faturamento' && <FaturamentoPortal onBack={handleGoBack} authUser={authUser}/>}
          {screen==='conexao-setorial' && <ConexaoSetorial onBack={handleGoBack} authUser={authUser}/>}
          {screen==='mercado-estelar' && <MercadoEstelar onBack={handleGoBack} authUser={authUser} userPhoto={userPhoto}/>}
          {screen==='lobby-estelar' && authUser?.role==='admin' && <LobbyEstelar onBack={handleGoBack} authUser={authUser}/>}
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

        {/* ── Assistente UNIKO — robô fixo no canto inferior esquerdo (voca os lembretes/avisos) ──
             Escondido no Lobby Estelar: lá o "assistente" de cada um já aparece dentro do
             cenário como avatar, não faz sentido o robô de dicas flutuando por cima também. */}
        {screen!=='lobby-estelar' && <UnikoAssistant authUser={authUser} notif={lembreteNotif} onDismissNotif={dismissNotif} inPortal={screen==='colaborador'} />}

        {/* ── Capture o Uniko — widget GLOBAL (aparece em qualquer tela, com som) ── */}
        {authUser && captureCfg && <CaptureUnikoWidget cfg={captureCfg} inPortal={screen==='colaborador'} />}
      </div>
    </>
  );
}
