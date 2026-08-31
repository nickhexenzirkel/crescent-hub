import React, { useState, useEffect, useRef } from 'react';
import { T, applyTheme } from '../../contexts/theme';
import { USER, SERVER_URL, getAuthUser, isProfileComplete as checkProfileComplete, shrinkPhoto } from '../../contexts/user';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NAV_FOR } from './Sidebar';
import { SettingsModal } from '../../shared/SettingsModal';
import { Sidebar, TopBar } from './Sidebar';
import { TabInicio } from './tabs/TabInicio';
import { TabFinanceiro } from './tabs/TabFinanceiro';
import { TabDados } from './tabs/TabDados';
import { TabHoras } from './tabs/TabHoras';
import { TabMeuPonto } from './tabs/TabMeuPonto';
import { TabFeedback } from './tabs/TabFeedback';
import { TabEventos } from './tabs/TabEventos';
import { TabComunicados } from './tabs/TabComunicados';
import { TabMyDoko } from './tabs/TabMyDoko';
import { TabColegas } from './tabs/TabColegas';
import { TabUnikoWave } from './tabs/TabUnikoWave';
import { TabUnikoPaint } from './tabs/TabUnikoPaint';
import { TabQuizMM } from './tabs/TabQuizMM';
import { TabUnikoStop } from './tabs/TabUnikoStop';
import { TabUnikoFaster } from './tabs/TabUnikoFaster';
import { TabUnikoSuspect } from './tabs/TabUnikoSuspect';
import CentralLembretes from '../central-lembretes';
import { syncCollectionFromServer } from '../../shared/captureUniko';
import { GAME_JOIN_EVENT, readPendingJoin, GAME_TAB } from '../../shared/gameInvites';

/* Tela das abas de ponto pra quem foi desligado — o cálculo parou, não há mais
   banco de horas nem falta pra mostrar. */
const DesligadoAviso = ({data}) => (
  <div style={{maxWidth:520,margin:'40px auto',padding:'30px 28px',borderRadius:16,
    background:T.surface||'rgba(255,255,255,0.85)',border:`1px solid ${T.border}`,textAlign:'center'}}>
    <div style={{fontSize:34,marginBottom:10}}>📄</div>
    <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,marginBottom:8}}>
      Registro de ponto encerrado
    </div>
    <div style={{fontSize:13.5,color:T.textT,lineHeight:1.6}}>
      Seu vínculo foi encerrado{data?` em ${data.split('-').reverse().join('/')}`:''}, então o banco de horas e as
      faltas não são mais contabilizados. Para consultar o histórico ou tirar
      qualquer dúvida, fale com o RH.
    </div>
  </div>
);

const Portal = ({onBack, onGoAlexa, userPhoto, onPhotoChange}) => {
  const isMobile = useIsMobile();
  const [tab,st]=useState('inicio');
  const [activeTheme,setActiveTheme]=useState(()=>{ const s=localStorage.getItem('ch_theme')||'blue'; applyTheme(s); return s; });
  const [showSettings,setShowSettings]=useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  // Desligado pelo RH (Dashboard RH → Gerenciar Usuários → Desligamento): o ponto
  // para de contabilizar, então as abas de Banco de Horas e Ponto Eletrônico saem
  // do Portal. Ver supabase_desligamento.sql.
  const [desligado, setDesligado] = useState({ off:false, data:'' });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
    // Marca o body quando está no Uniko Wave (esconde a nav inferior e o botão de confetti)
    document.body.classList.toggle('uw-active', tab === 'unikowave');
    return () => document.body.classList.remove('uw-active');
  }, [tab]);

  // Convite de jogo aceito → abre a aba do jogo (Uniko Paint / Stop). Checa ao montar
  // (caso o convite tenha sido aceito de fora do Portal) e escuta o evento. Ver gameInvites.js.
  useEffect(() => {
    const j = readPendingJoin('paint') || readPendingJoin('stop');
    if (j?.game && GAME_TAB[j.game]) st(GAME_TAB[j.game]);
    const h = (e) => { const g = e?.detail?.game; if (g && GAME_TAB[g]) st(GAME_TAB[g]); };
    window.addEventListener(GAME_JOIN_EVENT, h);
    return () => window.removeEventListener(GAME_JOIN_EVENT, h);
  }, []);

  // Tela cheia (celular) — aplica no app inteiro; iOS Safari pode não suportar.
  const toggleFullscreenApp = () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      } else {
        const el = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      }
    } catch {}
  };

  // Onboarding — exibido enquanto o usuário não tiver foto de perfil
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      const _a = getAuthUser();
      const pk = _a?.cpf ? `uniko_photo_${_a.cpf}` : 'uniko_photo';
      return !(userPhoto || localStorage.getItem(pk));
    } catch { return false; }
  });
  const [onbStep,  setOnbStep]  = useState(0);
  const [onbPhoto, setOnbPhoto] = useState(null);
  const onbFileRef = useRef(null);

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
        USER.desligado = !!p.desligado;
        if (p.desligado) setDesligado({ off:true, data:(p.desligamento_data||'').slice(0,10) });
      }
    })
    .catch(() => {})
    .finally(() => { setProfileReady(true); setProfileComplete(checkProfileComplete()); });
  }, []);

  // Carrega a config do "Capture o Uniko" (evento do RH) ao abrir o Portal
  // Sincroniza a coleção com o servidor (reflete reset do admin / outros devices)
  useEffect(() => { syncCollectionFromServer(); }, []);

  const handleTheme=(key)=>{applyTheme(key);setActiveTheme(key);localStorage.setItem('ch_theme',key);};
  const handleProfileSaved = () => setProfileComplete(checkProfileComplete());
  const onbSavePhoto = (photo) => {
    try {
      const _a = getAuthUser();
      const pk = _a?.cpf ? `uniko_photo_${_a.cpf}` : 'uniko_photo';
      localStorage.setItem(pk, photo);
      if (onPhotoChange) onPhotoChange(photo);
    } catch {}
  };
  const render=()=>{
    if(tab==='inicio')     return <TabInicio setTab={st} onGoAlexa={onGoAlexa} activeTheme={activeTheme} userPhoto={userPhoto} onPhotoChange={onPhotoChange} profileComplete={profileComplete}/>;
    if(tab==='financeiro') return <TabFinanceiro/>;
    if(tab==='dados')      return <TabDados onProfileSaved={handleProfileSaved}/>;
    // Desligado não vê (nem justifica) ponto: o cálculo dele parou na data do
    // desligamento. As abas somem da navegação, mas a guarda fica aqui também
    // porque dá pra cair na aba por estado antigo/atalho.
    if((tab==='horas'||tab==='ponto') && desligado.off) return <DesligadoAviso data={desligado.data}/>;
    if(tab==='horas')      return <TabHoras/>;
    if(tab==='ponto')      return <TabMeuPonto/>;
    if(tab==='lembretes')  return <CentralLembretes authUser={{name: USER.name}} onBack={()=>st('inicio')}/>;
    if(tab==='feedback')   return <TabFeedback/>;
    if(tab==='colegas')    return <TabColegas/>;
    if(tab==='eventos')    return <TabEventos/>;
    if(tab==='comunicados') return <TabComunicados/>;
    if(tab==='uniko')       return <TabMyDoko onPhotoChange={onPhotoChange}/>;
    if(tab==='unikowave')   return <TabUnikoWave/>;
    if(tab==='unikopaint')  return <TabUnikoPaint/>;
    if(tab==='quizmm')      return <TabQuizMM/>;
    if(tab==='unikostop')   return <TabUnikoStop/>;
    if(tab==='unikofaster') return <TabUnikoFaster/>;
    if(tab==='unikosuspect') return <TabUnikoSuspect/>;
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
      <Sidebar tab={tab} setTab={st} onBack={onBack} activeTheme={activeTheme} onTheme={handleTheme} onOpenSettings={()=>setShowSettings(true)} userPhoto={userPhoto} profileComplete={profileComplete} collapsed={tab==='unikowave'} desligado={desligado.off}/>
      <div className="portal-conteudo" style={{marginLeft:isMobile?0:(tab==='unikowave'?76:252),flex:1,display:'flex',flexDirection:'column',minHeight:'100vh',transition:'margin-left .22s ease'}}>
        {tab!=='unikowave' && <TopBar tab={tab} onBack={()=>st('inicio')}/>}
        {/* `flex:'1 1 auto'` no Uniko Paint — medido no navegador, não é firula:
            `flex:1` embute `flex-basis:0%`, e porcentagem só resolve contra pai de
            altura DEFINIDA. O pai aqui tem `minHeight:'100vh'` (mínima, não
            definida), então o basis cai pra "content" e este container passa a ser
            dimensionado PELO CONTEÚDO — ignorando o `height:calc()` logo abaixo.
            Efeito: o chat do jogo enchia e esticava a página inteira (medido:
            container ia de 668px pra 1348px com 60 mensagens, e a lista nunca
            rolava). Com `basis:auto` o `height` vira a base e a altura se mantém.
            Só pro Paint pra não mexer no layout das outras abas. */}
        <div className="portal-area" style={{flex: (tab==='unikopaint'||tab==='unikostop'||tab==='unikofaster') ? '1 1 auto' : 1,
          padding: tab==='unikowave' ? 0 : (isMobile?'16px':'28px 34px'),
          overflowY: (tab==='unikowave'||tab==='unikopaint'||tab==='unikostop'||tab==='unikofaster') ? 'hidden' : 'auto',
          minHeight: (tab==='unikopaint'||tab==='unikostop'||tab==='unikofaster') ? 0 : undefined,
          paddingBottom: tab==='unikowave' ? 0 : (isMobile?'76px':'28px'),
          height: tab==='unikowave' ? '100vh' : ((!isMobile&&tab==='inicio')?'100vh':(!isMobile?'calc(100vh - 52px)':undefined))}}>
          {render()}
        </div>
      </div>

      {/* ── Uniko Wave (celular): botões flutuantes de sair + tela cheia ── */}
      {isMobile && tab==='unikowave' && (
        <div style={{position:'fixed',top:6,left:6,zIndex:100000,display:'flex',gap:6}}>
          <button onClick={()=>st('inicio')} title="Sair do jogo"
            style={{width:34,height:34,borderRadius:9,border:'1px solid rgba(255,255,255,.25)',
              background:'rgba(0,0,0,.5)',color:'#fff',fontSize:16,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'}}>←</button>
          <button onClick={toggleFullscreenApp} title="Tela cheia"
            style={{width:34,height:34,borderRadius:9,border:'1px solid rgba(255,255,255,.25)',
              background:'rgba(0,0,0,.5)',color:'#fff',fontSize:15,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'}}>⛶</button>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      {isMobile && tab!=='unikowave' && (
        <div className="portal-mobilenav" style={{position:'fixed',bottom:0,left:0,right:0,zIndex:300,
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
            {NAV_FOR(getAuthUser()?.role==='admin', desligado.off).map(n=>{
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

      {/* ── Onboarding — aparece enquanto não há foto de perfil ── */}
      {showOnboarding&&(
        <div style={{position:'fixed',inset:0,zIndex:5000,
          background:'rgba(0,0,0,.90)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          padding:16,fontFamily:'var(--font-body)'}}>
          <div style={{background:T.surface,borderRadius:24,width:'100%',maxWidth:540,
            maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',
            position:'relative',boxShadow:'0 32px 80px rgba(0,0,0,.55)',border:`1px solid ${T.border}`}}>

            {/* Pular */}
            <button onClick={()=>setShowOnboarding(false)}
              style={{position:'absolute',top:16,right:16,zIndex:1,background:'transparent',
                border:'none',cursor:'pointer',color:T.textT,fontSize:12,
                padding:'4px 10px',borderRadius:8,fontFamily:'var(--font-body)'}}>
              Pular ×
            </button>

            {/* Conteúdo scrollável */}
            <div style={{flex:1,overflowY:'auto',padding:'36px 40px 24px'}}>

              {/* ── PASSO 0 — PERFIL ── */}
              {onbStep===0&&(
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:6}}>
                    Bem-vindo(a), {USER.short}! 👋
                  </div>
                  <div style={{fontSize:13,color:T.textT,marginBottom:28}}>
                    Adicione sua foto para personalizar o perfil
                  </div>
                  {/* Círculo de foto */}
                  <div onClick={()=>onbFileRef.current?.click()}
                    style={{width:128,height:128,borderRadius:'50%',margin:'0 auto 16px',
                      cursor:'pointer',overflow:'hidden',flexShrink:0,
                      border:`3px dashed ${onbPhoto?T.gold:T.border}`,
                      background:onbPhoto?undefined:(T.surfaceSub||'rgba(0,0,0,.06)'),
                      backgroundImage:onbPhoto?`url(${onbPhoto})`:undefined,
                      backgroundSize:'cover',backgroundPosition:'center',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      transition:'border-color .2s'}}>
                    {!onbPhoto&&(
                      <div style={{color:T.textD,textAlign:'center'}}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        <div style={{fontSize:10,marginTop:5}}>Adicionar foto</div>
                      </div>
                    )}
                  </div>
                  <input ref={onbFileRef} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{
                      const f=e.target.files?.[0]; if(!f) return;
                      const r=new FileReader();
                      // shrinkPhoto ANTES de guardar: o dataURL cru de uma foto de celular
                      // tem vários MB e ia inteiro pro localStorage (era esta a origem da
                      // chave uniko_photo_<cpf> de 4,7MB que estourava a cota do navegador).
                      r.onload=ev=>shrinkPhoto(ev.target.result).then(setOnbPhoto);
                      r.readAsDataURL(f);
                    }}/>
                  <button onClick={()=>onbFileRef.current?.click()}
                    style={{padding:'9px 24px',borderRadius:10,marginBottom:28,
                      border:`1.5px solid ${T.gold}55`,background:T.goldGl,
                      color:T.gold,cursor:'pointer',fontSize:13,fontWeight:600,
                      fontFamily:'var(--font-body)'}}>
                    {onbPhoto?'↑ Trocar foto':'↑ Escolher foto'}
                  </button>
                  <div style={{background:T.surfaceSub||'rgba(0,0,0,.04)',borderRadius:12,
                    padding:'14px 18px',textAlign:'left',border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:5}}>
                      💡 Complete seu perfil
                    </div>
                    <div style={{fontSize:12,color:T.textS,lineHeight:1.6}}>
                      Acesse <strong>Meus Dados</strong> na barra lateral para preencher
                      e-mail, telefone e endereço — isso desbloqueia todas as funcionalidades
                      do sistema.
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASSO 1 — CENTRAL ALEXA ── */}
              {onbStep===1&&(
                <div>
                  <div style={{textAlign:'center',marginBottom:28}}>
                    <div style={{width:72,height:72,borderRadius:20,margin:'0 auto 16px',
                      background:`${T.gold}18`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                        stroke={T.gold} strokeWidth="1.7" strokeLinecap="round">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:4}}>
                      Central Alexa
                    </div>
                    <div style={{fontSize:13,color:T.textT}}>
                      O player de música com personalidade da empresa
                    </div>
                  </div>
                  {[
                    {e:'🎧',t:'Fila colaborativa',
                      d:'Todos os colaboradores podem pedir músicas — todos ouvem juntos em tempo real.'},
                    {e:'🎭',t:'Mascotes Uniko reativos',
                      d:'Cada gênero musical ativa um Uniko diferente na tela — KPop, Rock, MPB, Gospel, Sertanejo e mais.'},
                    {e:'🎛️',t:'Equalizador & controles',
                      d:'Ajuste de volume, equalizador personalizado, histórico e biblioteca completa de músicas.'},
                    {e:'🌟',t:'Festival de músicas',
                      d:'Evento especial onde cada colaborador escolhe sua trilha sonora favorita para tocar.'},
                  ].map(({e,t,d},i,arr)=>(
                    <div key={t} style={{display:'flex',gap:14,padding:'13px 0',
                      borderBottom:i<arr.length-1?`1px solid ${T.border}`:'none'}}>
                      <div style={{fontSize:22,flexShrink:0,width:32,textAlign:'center',marginTop:1}}>{e}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{t}</div>
                        <div style={{fontSize:12,color:T.textS,lineHeight:1.55}}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PASSO 2 — MY UNIKO ── */}
              {onbStep===2&&(
                <div>
                  <div style={{textAlign:'center',marginBottom:28}}>
                    <div style={{width:72,height:72,borderRadius:20,margin:'0 auto 16px',
                      background:`${T.gold}18`,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:38}}>🐾</div>
                    <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:4}}>
                      My Uniko
                    </div>
                    <div style={{fontSize:13,color:T.textT}}>
                      Seu companheiro virtual com personalidade própria
                    </div>
                  </div>
                  {[
                    {e:'💬',t:'Conversas temáticas',
                      d:'Cada Uniko tem diálogos exclusivos sobre seu gênero musical — KPop, Rock, MPB, Gospel e mais.'},
                    {e:'📈',t:'Sistema de níveis',
                      d:'Ganhe XP interagindo com seu Uniko e desbloqueie novos personagens da coleção.'},
                    {e:'🎴',t:'Coleção de mascotes',
                      d:'5 Dokos sempre disponíveis + 9 Unikos temáticos desbloqueáveis conforme você sobe de nível.'},
                    {e:'❤️',t:'Cuide do seu Uniko',
                      d:'Alimente, faça carinho e coloque para dormir. Seu Uniko tem fome, energia e sono!'},
                    {e:'💡',t:'Dicas musicais',
                      d:'Curiosidades e recomendações de artistas do gênero do Uniko ativo, direto na tela.'},
                  ].map(({e,t,d},i,arr)=>(
                    <div key={t} style={{display:'flex',gap:14,padding:'13px 0',
                      borderBottom:i<arr.length-1?`1px solid ${T.border}`:'none'}}>
                      <div style={{fontSize:22,flexShrink:0,width:32,textAlign:'center',marginTop:1}}>{e}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{t}</div>
                        <div style={{fontSize:12,color:T.textS,lineHeight:1.55}}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PASSO 3 — MAIS RECURSOS ── */}
              {onbStep===3&&(
                <div>
                  <div style={{textAlign:'center',marginBottom:28}}>
                    <div style={{width:72,height:72,borderRadius:20,margin:'0 auto 16px',
                      background:`${T.gold}18`,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:36}}>✨</div>
                    <div style={{fontSize:20,fontWeight:700,color:T.text,marginBottom:4}}>
                      Tudo no mesmo lugar
                    </div>
                    <div style={{fontSize:13,color:T.textT}}>
                      Recursos pensados para o seu dia a dia
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {[
                      {e:'📋',t:'Feed',
                        d:'Publicações e novidades internas da empresa em um feed integrado.'},
                      {e:'💰',t:'Financeiro',
                        d:'Salário líquido, benefícios e histórico de pagamentos sempre à mão.'},
                      {e:'🔔',t:'Lembretes',
                        d:'Lembretes pessoais e anotações coloridas organizadas por categoria.'},
                      {e:'👥',t:'Colegas',
                        d:'Veja o Uniko e o status dos seus colegas de trabalho em tempo real.'},
                    ].map(({e,t,d})=>(
                      <div key={t} style={{padding:'14px 16px',borderRadius:12,
                        background:T.surfaceSub||'rgba(0,0,0,.04)',border:`1px solid ${T.border}`}}>
                        <div style={{fontSize:26,marginBottom:8}}>{e}</div>
                        <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>{t}</div>
                        <div style={{fontSize:11,color:T.textS,lineHeight:1.55}}>{d}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* ── Navegação ── */}
            <div style={{padding:'16px 40px 24px',borderTop:`1px solid ${T.border}`,
              display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              {/* Dots clicáveis */}
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} onClick={()=>setOnbStep(i)}
                    style={{width:i===onbStep?22:8,height:8,borderRadius:99,cursor:'pointer',
                      background:i===onbStep?T.gold:`${T.gold}40`,transition:'all .25s ease'}}/>
                ))}
              </div>
              {/* Botões */}
              <div style={{display:'flex',gap:8}}>
                {onbStep>0&&(
                  <button onClick={()=>setOnbStep(s=>s-1)}
                    style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${T.border}`,
                      background:'transparent',color:T.textS,cursor:'pointer',
                      fontSize:13,fontFamily:'var(--font-body)'}}>
                    ← Anterior
                  </button>
                )}
                {onbStep<3?(
                  <button onClick={()=>{
                    if(onbStep===0&&onbPhoto) onbSavePhoto(onbPhoto);
                    setOnbStep(s=>s+1);
                  }} style={{padding:'9px 24px',borderRadius:10,border:'none',cursor:'pointer',
                    background:`linear-gradient(135deg,${T.gold},${T.gold}cc)`,
                    color:'#fff',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)'}}>
                    Próximo →
                  </button>
                ):(
                  <button onClick={()=>{
                    if(onbPhoto) onbSavePhoto(onbPhoto);
                    setShowOnboarding(false);
                  }} style={{padding:'9px 24px',borderRadius:10,border:'none',cursor:'pointer',
                    background:`linear-gradient(135deg,${T.gold},${T.gold}cc)`,
                    color:'#fff',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)'}}>
                    Começar! 🚀
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export { Portal };
