import React, { useState, useEffect } from 'react';
import { T } from '../../contexts/theme';
import { SERVER_URL, supabase as _supabase, getAuthUser } from '../../contexts/user';
import { StarDivider, Card, Btn, Tag, SHead, Moon, Logo, UnikoIcon } from '../../shared/components';

const AdminLoginModal = ({onSuccess, onCancel}) => {
  const [pw, setPw]     = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr]   = useState('');
  const [shake, setShake] = useState(false);
  const ADMIN_PW = 'ColumbinaCleyNick50';
  // Dark mode detection
  const isDark   = !!T.page;
  const modalBg  = isDark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.97)');
  const inputBg  = isDark ? (T.surfaceSub||'rgba(255,255,255,0.06)') : (T.surface||'white');
  const tryLogin = () => {
    if (pw === ADMIN_PW) { onSuccess(); }
    else {
      setErr('Senha incorreta. Apenas administradores têm acesso.');
      setShake(true); setTimeout(()=>setShake(false), 500);
    }
  };
  return(
    <div onClick={onCancel} style={{position:'fixed',inset:0,zIndex:2000,
      background:'rgba(6,10,20,0.65)',backdropFilter:'blur(18px)',
      WebkitBackdropFilter:'blur(18px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:modalBg,
        backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',
        border:`1px solid ${T.border}`,borderRadius:22,
        padding:'36px 40px',width:400,maxWidth:'90vw',
        boxShadow:'0 32px 80px rgba(0,0,0,0.38)',
        transition:'transform .08s ease'}}>
        {/* Shield icon */}
        <div style={{width:56,height:56,borderRadius:16,
          background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,
          display:'flex',alignItems:'center',justifyContent:'center',
          margin:'0 auto 20px',boxShadow:`0 8px 24px ${T.goldLine}55`}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontFamily:'var(--font-brand)',fontSize:20,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Acesso Restrito</div>
          <div style={{fontSize:13,color:T.textT,marginTop:4}}>Área exclusiva para administradores do sistema</div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Senha de Administrador</label>
          <div style={{position:'relative'}}>
            <input type={show?'text':'password'} value={pw}
              onChange={e=>{setPw(e.target.value);setErr('');}}
              onKeyDown={e=>e.key==='Enter'&&tryLogin()}
              autoFocus
              placeholder="Digite a senha..."
              style={{width:'100%',padding:'11px 42px 11px 14px',border:`2px solid ${err?T.danger||'#C04050':pw?T.goldLine+'88':T.border}`,borderRadius:10,fontFamily:'var(--font-body)',fontSize:14,color:T.text,background:inputBg,outline:'none',transition:'border-color .15s',boxSizing:'border-box'}}/>
            <button onClick={()=>setShow(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.textD,fontSize:16,lineHeight:1,padding:0}}>
              {show?'🙈':'👁'}
            </button>
          </div>
          {err&&<div style={{marginTop:7,fontSize:12,color:'#C04050',display:'flex',alignItems:'center',gap:5}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {err}
          </div>}
        </div>
        <button onClick={tryLogin} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:14,fontWeight:700,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',boxShadow:`0 4px 16px ${T.goldLine}55`,transition:'transform .1s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='none'}>
          Entrar no Dashboard RH
        </button>
        <button onClick={onCancel} style={{width:'100%',marginTop:10,padding:'10px',borderRadius:10,border:`1px solid ${T.border}`,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,color:T.textS,background:isDark?T.surfaceSub||'rgba(255,255,255,0.04)':'transparent'}}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   DASHBOARD RH — PAINEL ADMINISTRATIVO
══════════════════════════════════════════════════ */
const ADMIN_PW = 'ColumbinaCleyNick50';
const DashboardRH = ({onBack, adminName='Administrador'}) => {
  // Dark mode detection (same pattern as PontoEletronico)
  const isDark   = !!T.page;
  const cardBg   = isDark ? T.surface : (T.surfaceW||'rgba(255,255,255,0.85)');
  const headerBg = isDark ? `${T.surface}ee` : (T.surfaceW||'rgba(255,255,255,0.82)');
  const tabsBg   = isDark ? `${T.surface}cc` : (T.surfaceW||'rgba(255,255,255,0.75)');
  const [tab, setTab]         = useState('funcionarios');
  const [users, setUsers]     = useState([]);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser]         = useState({name:'',email:'',role:'colaborador',dept:'',pw:'',pw2:''});
  const [newUserErr, setNewUserErr]   = useState('');
  const [editProfile, setEditProfile] = useState(null);
  const [trophyTarget, setTrophyTarget] = useState(null);
  const [trophyType, setTrophyType]   = useState('ouro');
  const [trophyMsg, setTrophyMsg]     = useState('');
  const [trophyHistory, setTrophyHistory] = useState([]);
  const [bancoHoras,    setBancoHoras]    = useState([]);
  const [bancoLoading,  setBancoLoading]  = useState(false);
  const [bancoAcaoId,   setBancoAcaoId]   = useState(null);

  const loadBancoHoras = async () => {
    setBancoLoading(true);
    const { data } = await _supabase.from('banco_horas')
      .select('*').order('created_at', { ascending: false });
    setBancoHoras(data || []);
    setBancoLoading(false);
  };

  const atualizarStatus = async (id, status) => {
    setBancoAcaoId(id);
    await _supabase.from('banco_horas').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    await loadBancoHoras();
    setBancoAcaoId(null);
  };
  const [changePw, setChangePw] = useState({old:'',new1:'',new2:''});
  const [changePwMsg, setChangePwMsg] = useState('');

  // ── Spotify API ──────────────────────────────────────────
  const [spotifyClientId, setSpotifyClientId] = useState(() => localStorage.getItem('spotify_client_id') || '');
  const [spotifySecret, setSpotifySecret]     = useState(() => localStorage.getItem('spotify_client_secret') || '');
  const [spotifyMsg, setSpotifyMsg]           = useState('');
  const [spotifySaving, setSpotifySaving]     = useState(false);
  const [spotifyServerStatus, setSpotifyServerStatus] = useState(null); // null | {client_id, has_client_secret, has_refresh_token}

  const loadSpotifyServerStatus = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/spotify/credentials`, { headers: authHeader() });
      if (r.ok) setSpotifyServerStatus(await r.json());
    } catch {}
  };

  useEffect(() => { if (tab === 'spotify') loadSpotifyServerStatus(); }, [tab]);

  const saveSpotifyCreds = async () => {
    if (!spotifyClientId.trim() || !spotifySecret.trim()) { setSpotifyMsg('⚠️ Preencha ambos os campos'); return; }
    setSpotifySaving(true); setSpotifyMsg('');
    localStorage.setItem('spotify_client_id', spotifyClientId.trim());
    localStorage.setItem('spotify_client_secret', spotifySecret.trim());
    try {
      const r = await fetch(`${SERVER_URL}/api/spotify/credentials`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ client_id: spotifyClientId.trim(), client_secret: spotifySecret.trim() }),
      });
      if (r.ok) {
        setSpotifyMsg('✅ Credenciais salvas! Agora autentique a conta clicando no botão abaixo.');
        await loadSpotifyServerStatus();
      } else {
        const d = await r.json().catch(() => ({}));
        setSpotifyMsg(`⚠️ ${d.error || 'Erro ao salvar no servidor'}`);
      }
    } catch { setSpotifyMsg('⚠️ Servidor offline — credenciais salvas apenas localmente.'); }
    setSpotifySaving(false);
  };

  // ── Funcionários (real, conectado ao servidor) ───────────
  const [empList, setEmpList]         = useState([]);
  const [empLoading, setEmpLoading]   = useState(false);
  const [empModal, setEmpModal]       = useState(null); // null | 'new' | {employee}
  const [empForm, setEmpForm]         = useState({name:'',cpf:'',role:'employee'});
  const [empFormErr, setEmpFormErr]   = useState('');
  const [empSaving, setEmpSaving]     = useState(false);
  const [pwModal, setPwModal]         = useState(null); // null | employee
  const [pwVal, setPwVal]             = useState('');
  const [pwMsg, setPwMsg]             = useState('');

  const authHeader = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('ch_token')||''}` });

  const loadEmployees = async () => {
    setEmpLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() });
      const d = await r.json();
      setEmpList(d.employees || []);
    } catch { /* servidor offline */ }
    setEmpLoading(false);
  };

  const saveEmployee = async () => {
    const cpfClean = empForm.cpf.replace(/\D/g,'');
    if(!empForm.name.trim()){ setEmpFormErr('Nome obrigatório'); return; }
    if(cpfClean.length!==11){ setEmpFormErr('CPF deve ter 11 dígitos'); return; }
    setEmpSaving(true); setEmpFormErr('');
    try {
      const isEdit = empModal && empModal !== 'new';
      const url  = isEdit ? `${SERVER_URL}/api/employees/${empModal.id}` : `${SERVER_URL}/api/employees`;
      const meth = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method:meth, headers: authHeader(), body: JSON.stringify({ name:empForm.name.trim(), cpf:cpfClean, role:empForm.role }) });
      const d = await r.json();
      if(!r.ok){ setEmpFormErr(d.error||'Erro ao salvar'); setEmpSaving(false); return; }
      await loadEmployees();
      setEmpModal(null); setEmpForm({name:'',cpf:'',role:'employee'});
    } catch { setEmpFormErr('Erro de conexão'); }
    setEmpSaving(false);
  };

  const toggleActive = async (emp) => {
    await fetch(`${SERVER_URL}/api/employees/${emp.id}`, { method:'PUT', headers: authHeader(), body: JSON.stringify({ active: !emp.active }) });
    await loadEmployees();
  };

  const resetPassword = async () => {
    if(!pwVal.trim()){ setPwMsg('Digite a nova senha'); return; }
    const r = await fetch(`${SERVER_URL}/api/employees/${pwModal.id}/password`, { method:'PUT', headers: authHeader(), body: JSON.stringify({ password: pwVal }) });
    const d = await r.json();
    if(r.ok){ setPwMsg('✅ Senha redefinida!'); setTimeout(()=>{ setPwModal(null); setPwVal(''); setPwMsg(''); }, 1500); }
    else setPwMsg(d.error||'Erro');
  };

  const maskCpfDisp = (v) => v; // já vem mascarado do servidor

  useEffect(()=>{ if(tab==='funcionarios') loadEmployees(); }, [tab]);
  useEffect(()=>{ if(tab==='banco') loadBancoHoras(); }, [tab]);

  // ── Gerenciar Usuários — perfil completo ─────────────────
  const [gerList, setGerList]         = useState([]);
  const [gerLoading, setGerLoading]   = useState(false);
  const [gerModal, setGerModal]       = useState(null); // null | employee
  const [gerForm, setGerForm]         = useState({});
  const [gerSaving, setGerSaving]     = useState(false);
  const [gerMsg, setGerMsg]           = useState('');

  const loadGerList = async () => {
    setGerLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() });
      const d = await r.json();
      setGerList(d.employees || []);
    } catch {}
    setGerLoading(false);
  };

  const openGerModal = async (emp) => {
    setGerMsg('');
    try {
      const r = await fetch(`${SERVER_URL}/api/employees/${emp.id}`, { headers: authHeader() });
      const d = await r.json();
      setGerForm(d.employee || emp);
    } catch { setGerForm(emp); }
    setGerModal(emp);
  };

  const saveGerProfile = async () => {
    setGerSaving(true); setGerMsg('');
    const r = await fetch(`${SERVER_URL}/api/employees/${gerModal.id}/profile`, {
      method: 'PUT', headers: authHeader(),
      body: JSON.stringify(gerForm),
    });
    const d = await r.json();
    if (r.ok) { setGerMsg('✅ Perfil salvo!'); await loadGerList(); setTimeout(()=>setGerMsg(''),2000); }
    else setGerMsg('⚠️ ' + (d.error||'Erro ao salvar'));
    setGerSaving(false);
  };

  useEffect(()=>{ if(tab==='gerenciar') loadGerList(); }, [tab]);

  // ── Calendário ────────────────────────────────────────────
  const [calEvents, setCalEvents]     = useState([]);
  const [calLoading, setCalLoading]   = useState(false);
  const [calModal, setCalModal]       = useState(null); // null | 'new' | event
  const [calForm, setCalForm]         = useState({title:'',event_date:'',event_time:'Dia todo',type:'Evento',description:''});
  const [calSaving, setCalSaving]     = useState(false);
  const [calMsg, setCalMsg]           = useState('');

  const loadCalEvents = async () => {
    setCalLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/events`);
      const d = await r.json();
      setCalEvents(d.events || []);
    } catch {}
    setCalLoading(false);
  };

  const saveCalEvent = async () => {
    if (!calForm.title || !calForm.event_date) { setCalMsg('⚠️ Título e data obrigatórios'); return; }
    setCalSaving(true); setCalMsg('');
    const isEdit = calModal && calModal !== 'new';
    const url  = isEdit ? `${SERVER_URL}/api/events/${calModal.id}` : `${SERVER_URL}/api/events`;
    const meth = isEdit ? 'PUT' : 'POST';
    const r = await fetch(url, { method:meth, headers: authHeader(), body: JSON.stringify(calForm) });
    const d = await r.json();
    if (r.ok) { await loadCalEvents(); setCalModal(null); setCalForm({title:'',event_date:'',event_time:'Dia todo',type:'Evento',description:''}); }
    else setCalMsg('⚠️ ' + (d.error||'Erro'));
    setCalSaving(false);
  };

  const deleteCalEvent = async (id) => {
    if (!window.confirm('Remover este evento?')) return;
    await fetch(`${SERVER_URL}/api/events/${id}`, { method:'DELETE', headers: authHeader() });
    await loadCalEvents();
  };

  useEffect(()=>{ if(tab==='calendario') loadCalEvents(); }, [tab]);

  // ── Comunicados ─────────────────────────────────────────
  const [comunicados,    setComunicados]   = useState([]);
  const [comLoading,     setComLoading]    = useState(false);
  const [comForm,        setComForm]       = useState({title:'',body:'',cat:'RH',urgent:false});
  const [comSaving,      setComSaving]     = useState(false);
  const [comMsg,         setComMsg]        = useState('');

  const loadComunicados = async () => {
    setComLoading(true);
    const r = await fetch(`${SERVER_URL}/api/comunicados`, { headers: authHeader() });
    const d = await r.json();
    setComunicados(d.comunicados || []);
    setComLoading(false);
  };

  const publishComunicado = async () => {
    if (!comForm.title.trim()) { setComMsg('Título obrigatório'); return; }
    setComSaving(true); setComMsg('');
    const r = await fetch(`${SERVER_URL}/api/comunicados`, {
      method: 'POST', headers: authHeader(),
      body: JSON.stringify(comForm),
    });
    const d = await r.json();
    if (r.ok) { setComMsg('✅ Comunicado publicado!'); setComForm({title:'',body:'',cat:'RH',urgent:false}); await loadComunicados(); }
    else setComMsg('❌ ' + (d.error || 'Erro'));
    setComSaving(false);
    setTimeout(() => setComMsg(''), 4000);
  };

  const deleteComunicado = async (id) => {
    if (!window.confirm('Remover este comunicado?')) return;
    await fetch(`${SERVER_URL}/api/comunicados/${id}`, { method: 'DELETE', headers: authHeader() });
    await loadComunicados();
  };

  useEffect(() => { if (tab === 'comunicados') loadComunicados(); }, [tab]);

  // ── Lembretes & Alexa programada ────────────────────────
  const [lembretes, setLembretes]       = useState([]);
  const [lembLoading, setLembLoading]   = useState(false);
  const [lembModal, setLembModal]       = useState(null);
  const [lembForm, setLembForm]         = useState({title:'',message:'',time:'',date:'',type:'lembrete',repeat:'never',active:true,fanfare:false,sound:'fanfarra'});
  const [lembSaving, setLembSaving]     = useState(false);
  const [lembMsg, setLembMsg]           = useState('');
  const [alexaStatus, setAlexaStatus]   = useState(null);
  const [testingAlexa, setTestingAlexa] = useState(false);

  const loadLembretes = async () => {
    setLembLoading(true);
    try {
      const { data } = await _supabase.from('reminders').select('*').order('created_at', { ascending: false });
      setLembretes(data || []);
    } catch {}
    setLembLoading(false);
  };

  const saveLembrete = async () => {
    if(!lembForm.title.trim()) { setLembMsg('Título obrigatório'); return; }
    setLembSaving(true); setLembMsg('');
    const auth = getAuthUser();
    try {
      const isEdit = lembModal && lembModal !== 'new';
      const payload = { ...lembForm, created_by: auth?.name || 'Admin', updated_at: new Date().toISOString() };
      if (isEdit) {
        const { error } = await _supabase.from('reminders').update(payload).eq('id', lembModal.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await _supabase.from('reminders').insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
      }
      await loadLembretes();
      setLembModal(null);
      setLembForm({title:'',message:'',time:'',date:'',type:'lembrete',repeat:'never',active:true,fanfare:false,sound:'fanfarra'});
    } catch (e) { setLembMsg('Erro ao salvar: ' + e.message); }
    setLembSaving(false);
  };

  const deleteLembrete = async (id) => {
    if (!window.confirm('Remover este lembrete?')) return;
    await _supabase.from('reminders').delete().eq('id', id);
    await loadLembretes();
  };

  const toggleLembrete = async (id, active) => {
    await _supabase.from('reminders').update({ active: !active }).eq('id', id);
    await loadLembretes();
  };

  useEffect(()=>{ if(tab==='lembretes') { loadLembretes(); checkAlexaStatus(); } }, [tab]);

  const checkAlexaStatus = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/alexa/status`);
      const d = await r.json();
      setAlexaStatus(d);
    } catch { setAlexaStatus({ ok: false, configured: false }); }
  };

  const testAlexa = async () => {
    if (!lembForm.message && !lembForm.title) { setLembMsg('Preencha o título ou mensagem para testar'); return; }
    setTestingAlexa(true); setLembMsg('');
    const r = await fetch(`${SERVER_URL}/api/alexa/speak`, {
      method: 'POST', headers: authHeader(),
      body: JSON.stringify({ text: lembForm.message || lembForm.title }),
    });
    const d = await r.json();
    setLembMsg(r.ok ? '✅ Alexa anunciou com sucesso!' : `❌ ${d.error}`);
    setTestingAlexa(false);
    setTimeout(() => setLembMsg(''), 4000);
  };

  const sendNow = async () => {
    if (!lembForm.message && !lembForm.title) { setLembMsg('Preencha o título ou mensagem'); return; }
    setLembSaving(true); setLembMsg('');
    try {
      const endpoint = lembForm.type === 'alexa' ? '/api/alexa/speak' : '/api/notifications';
      const body = lembForm.type === 'alexa'
        ? { text: lembForm.message || lembForm.title }
        : { type: lembForm.type, title: lembForm.title, message: lembForm.message || lembForm.title };
      const r = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify(body),
      });
      const d = await r.json();
      setLembMsg(r.ok ? '✅ Enviado com sucesso!' : `❌ ${d.error || 'Erro'}`);
      setTimeout(() => setLembMsg(''), 4000);
    } catch { setLembMsg('❌ Erro de conexão'); }
    setLembSaving(false);
  };

  const genPw = () => {
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    return Array.from({length:10},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  };

  const saveNewUser = () => {
    if(!newUser.name.trim()){setNewUserErr('Nome obrigatório');return;}
    if(!newUser.email.includes('@')){setNewUserErr('E-mail inválido');return;}
    if(!newUser.pw){setNewUserErr('Defina uma senha');return;}
    if(newUser.pw!==newUser.pw2){setNewUserErr('As senhas não coincidem');return;}
    setUsers(prev=>[...prev,{id:Date.now(),...newUser,status:'ativo',lastLogin:'—'}]);
    setNewUser({name:'',email:'',role:'colaborador',dept:'',pw:'',pw2:''});
    setShowNewUser(false); setNewUserErr('');
  };

  const sendTrophy = () => {
    if(!trophyTarget||!trophyMsg.trim()) return;
    setTrophyHistory(prev=>[{id:Date.now(),to:trophyTarget,type:trophyType,msg:trophyMsg,date:new Date().toLocaleDateString('pt-BR'),from:adminName},...prev]);
    setTrophyTarget(null); setTrophyMsg('');
  };

  const tabSt = v=>({
    display:'flex',alignItems:'center',gap:8,padding:'10px 16px',borderRadius:10,
    cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,
    fontWeight:tab===v?600:400,textAlign:'left',border:'none',
    background:tab===v?`${T.gold}18`:'transparent',
    color:tab===v?T.gold:T.textS,
    transition:'all .15s',width:'100%',
  });

  const TABS=[
    {id:'funcionarios',   label:'Funcionários',      icon:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></>},
    {id:'gerenciar',      label:'Gerenciar Usuários', icon:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>},
    {id:'banco',          label:'Banco Extra',        icon:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/><line x1="19" y1="5" x2="22" y2="5"/><line x1="22" y1="3" x2="22" y2="7"/></>},
    {id:'calendario',     label:'Calendário',         icon:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>},
    {id:'comunicados',    label:'Comunicados',         icon:<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>},
    {id:'lembretes',      label:'Lembretes & Alexa',  icon:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>},
    {id:'perfis',         label:'Perfis',             icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>},
    {id:'trofeus',        label:'Troféus',            icon:<><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>},
    {id:'config',         label:'Configurações',      icon:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>},
    {id:'spotify',        label:'API do Spotify',     icon:<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>},
  ];

  return(
    <div style={{minHeight:'100vh',background:'transparent',fontFamily:'var(--font-body)',display:'flex',flexDirection:'column',position:'relative'}}>
      <style>{`
        @keyframes hdrBlob1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(28px,-8px) scale(1.15)} 66%{transform:translate(-12px,10px) scale(0.92)} }
        @keyframes hdrBlob2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-22px,12px) scale(1.08)} 80%{transform:translate(16px,-6px) scale(0.9)} }
        @keyframes hdrBlob3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(18px,14px) scale(1.12)} }
      `}</style>
      {/* Topbar */}
      <div style={{height:56,background:T.topbarBg||cardBg,backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 24px',gap:12,position:'sticky',top:0,zIndex:200,boxShadow:`0 1px 20px ${T.goldLine}22`}}>
        <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:T.textS,fontSize:13,fontFamily:'var(--font-body)',padding:'4px 8px',borderRadius:7,transition:'background .1s'}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
          onMouseLeave={e=>e.currentTarget.style.background='none'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Módulos
        </button>
        <div style={{width:1,height:20,background:T.border}}/>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style={{fontSize:14,fontWeight:700,color:T.text,fontFamily:'var(--font-brand)',letterSpacing:'.04em'}}>Dashboard RH</span>
        <Tag color={T.gold}>Admin</Tag>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 12px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
          <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white'}}>
            {adminName.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.text}}>{adminName}</div>
            <div style={{fontSize:10,color:T.gold,fontWeight:500}}>Administrador</div>
          </div>
        </div>
        <Logo size={28}/>
      </div>

      {/* Body: sidebar + content */}
      <div style={{display:'flex',flex:1,maxWidth:1400,margin:'0 auto',width:'100%',padding:'24px 24px',gap:20,alignItems:'flex-start'}}>
              {/* Sidebar com identidade visual Uniko */}
        <div style={{width:220,flexShrink:0,display:'flex',flexDirection:'column',gap:0,
          background:tabsBg,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',
          border:`1px solid ${T.border}`,borderRadius:16,overflow:'hidden',
          boxShadow:`0 4px 24px rgba(0,0,0,0.08)`,position:'relative',alignSelf:'flex-start',
          minHeight:500}}>

          {/* Blobs decorativos no sidebar header */}
          <div style={{position:'relative',overflow:'hidden',padding:'18px 16px 14px',
            borderBottom:`1px solid ${T.border}`,
            background:`linear-gradient(135deg,${T.goldGl},transparent)`}}>
            <div style={{position:'absolute',width:70,height:70,borderRadius:'50%',background:T.gold,filter:'blur(22px)',opacity:0.18,top:'-15px',left:'10%',animation:'hdrBlob1 6s ease-in-out infinite'}}/>
            <div style={{position:'absolute',width:50,height:50,borderRadius:'50%',background:T.goldL||T.gold,filter:'blur(16px)',opacity:0.15,top:'5px',left:'65%',animation:'hdrBlob2 8s ease-in-out infinite'}}/>
            {/* Logo + nome */}
            <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',gap:10}}>
              <UnikoIcon size={30}/>
              <div>
                <div style={{fontFamily:'var(--font-brand)',fontSize:12,fontWeight:700,color:T.text,letterSpacing:'.08em'}}>UNIKO</div>
                <div style={{fontSize:10,color:T.gold,fontWeight:600,letterSpacing:'.05em'}}>Dashboard RH</div>
              </div>
            </div>
          </div>

          {/* Admin badge */}
          <div style={{padding:'10px 14px 4px',borderBottom:`1px solid ${T.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
              <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                {adminName.split(' ').map(n=>n[0]).slice(0,2).join('')}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{adminName}</div>
                <div style={{fontSize:10,color:T.gold,fontWeight:500}}>Administrador</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{padding:'10px 10px',display:'flex',flexDirection:'column',gap:2}}>
            <div style={{fontSize:9,fontWeight:700,color:T.textD,textTransform:'uppercase',letterSpacing:'.12em',padding:'0 6px 6px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>Menu</div>
            {TABS.map(({id,label,icon})=>(
              <button key={id} onClick={()=>setTab(id)} style={{
                display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:9,
                cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,
                fontWeight:tab===id?600:400,textAlign:'left',border:'none',width:'100%',
                background:tab===id?T.goldGl:'transparent',
                color:tab===id?T.gold:T.textS,
                transition:'all .15s',
              }}
                onMouseEnter={e=>{if(tab!==id)e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.03)';}}
                onMouseLeave={e=>{if(tab!==id)e.currentTarget.style.background='transparent';}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{flexShrink:0,color:tab===id?T.gold:T.textD}}>{icon}</svg>
                {label}
                {tab===id&&<div style={{marginLeft:'auto',width:4,height:16,borderRadius:2,background:T.gold}}/>}
              </button>
            ))}
          </div>

          {/* Bottom warning */}
          <div style={{marginTop:'auto',padding:'12px',borderTop:`1px solid ${T.border}`}}>
            <div style={{padding:'9px 11px',borderRadius:9,background:T.goldGl,border:`1px solid ${T.goldLine}33`}}>
              <div style={{fontSize:9,color:T.gold,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>⚠ Área Restrita</div>
              <div style={{fontSize:10,color:T.textT,lineHeight:1.4}}>Ações registradas no log do sistema.</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:16}}>

          {/* ── TAB: FUNCIONÁRIOS (real, Supabase) ── */}
          {tab==='funcionarios'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Funcionários</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>{empList.length} cadastrados · {empList.filter(e=>e.role==='admin').length} admins · {empList.filter(e=>!e.active).length} inativos</div>
                </div>
                <button onClick={()=>{ setEmpForm({name:'',cpf:'',role:'employee'}); setEmpFormErr(''); setEmpModal('new'); }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  + Novo Funcionário
                </button>
              </div>

              {/* Table */}
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                {/* Head */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 80px 80px 120px',gap:0,padding:'10px 20px',borderBottom:`1px solid ${T.border}`,background:`${T.gold}08`}}>
                  {['Nome','CPF','Cargo','Status','Ações'].map(h=>(
                    <div key={h} style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</div>
                  ))}
                </div>
                {empLoading
                  ? <div style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>
                      Carregando...
                    </div>
                  : empList.length===0
                    ? <div style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:13}}>Nenhum funcionário cadastrado ainda.</div>
                    : empList.map((emp,i)=>(
                        <div key={emp.id} style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 80px 80px 120px',gap:0,padding:'12px 20px',borderTop:i===0?'none':`1px solid ${T.border}`,alignItems:'center',opacity:emp.active?1:0.55,transition:'opacity .15s'}}>
                          {/* Nome */}
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white',flexShrink:0}}>
                              {emp.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:600,color:T.text}}>{emp.name}</div>
                              <div style={{fontSize:10,color:T.textT}}>desde {new Date(emp.created_at).toLocaleDateString('pt-BR')}</div>
                            </div>
                          </div>
                          {/* CPF */}
                          <div style={{fontSize:12,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</div>
                          {/* Role */}
                          <div>
                            <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,
                              background:emp.role==='admin'?`${T.gold}18`:'rgba(0,0,0,0.04)',
                              color:emp.role==='admin'?T.gold:T.textS}}>
                              {emp.role==='admin'?'Admin':'Func.'}
                            </span>
                          </div>
                          {/* Status */}
                          <div>
                            <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,
                              background:emp.active?'rgba(34,197,94,0.1)':'rgba(192,64,80,0.08)',
                              color:emp.active?'#16a34a':'#C04050'}}>
                              {emp.active?'Ativo':'Inativo'}
                            </span>
                          </div>
                          {/* Ações */}
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={()=>{ setEmpForm({name:emp.name,cpf:emp.cpf,role:emp.role}); setEmpFormErr(''); setEmpModal(emp); }}
                              title="Editar"
                              style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={()=>{ setPwVal(''); setPwMsg(''); setPwModal(emp); }}
                              title="Redefinir senha"
                              style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            </button>
                            <button onClick={()=>toggleActive(emp)}
                              title={emp.active?'Desativar':'Ativar'}
                              style={{width:28,height:28,borderRadius:7,border:`1px solid ${emp.active?'rgba(192,64,80,0.3)':T.border}`,background:emp.active?'rgba(192,64,80,0.06)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:emp.active?'#C04050':T.textS,outline:'none'}}>
                              {emp.active
                                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              }
                            </button>
                          </div>
                        </div>
                      ))
                }
              </div>

              {/* Modal novo/editar */}
              {empModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:400,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:20}}>
                      {empModal==='new'?'Novo Funcionário':'Editar Funcionário'}
                    </div>
                    {/* Nome */}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>Nome completo</div>
                      <input value={empForm.name} onChange={e=>setEmpForm(f=>({...f,name:e.target.value}))}
                        placeholder="Ex: Maria da Silva"
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                    </div>
                    {/* CPF */}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>CPF</div>
                      <input value={empForm.cpf} onChange={e=>setEmpForm(f=>({...f,cpf:e.target.value}))}
                        placeholder="000.000.000-00"
                        disabled={empModal!=='new'}
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:empModal==='new'?(T.surface||'white'):`${T.border}44`,fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',cursor:empModal==='new'?'text':'not-allowed'}}/>
                      {empModal==='new'&&<div style={{fontSize:11,color:T.textD,marginTop:4}}>💡 Senha inicial = CPF (somente números)</div>}
                    </div>
                    {/* Cargo */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>Cargo</div>
                      <select value={empForm.role} onChange={e=>setEmpForm(f=>({...f,role:e.target.value}))}
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                        <option value="employee">Funcionário</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    {empFormErr&&<div style={{fontSize:12,color:'#C04050',marginBottom:12,padding:'7px 12px',borderRadius:7,background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)'}}>⚠️ {empFormErr}</div>}
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>{setEmpModal(null);setEmpFormErr('');}}
                        style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                        Cancelar
                      </button>
                      <button onClick={saveEmployee} disabled={empSaving}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:empSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {empSaving?'Salvando...':'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal redefinir senha */}
              {pwModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:360,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:6}}>Redefinir Senha</div>
                    <div style={{fontSize:13,color:T.textS,marginBottom:20}}>{pwModal.name}</div>
                    <input value={pwVal} onChange={e=>setPwVal(e.target.value)}
                      placeholder="Nova senha"
                      style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',marginBottom:14}}/>
                    <div style={{fontSize:11,color:T.textD,marginBottom:16}}>💡 Para usar o CPF como senha, digite somente os 11 números.</div>
                    {pwMsg&&<div style={{fontSize:12,color:pwMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12}}>{pwMsg}</div>}
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setPwModal(null)}
                        style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                        Cancelar
                      </button>
                      <button onClick={resetPassword}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        Redefinir
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: GERENCIAR USUÁRIOS — perfil completo ── */}
          {tab==='gerenciar'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Gerenciar Usuários</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Clique em um colaborador para editar o perfil completo</div>
                </div>
                <button onClick={loadGerList} style={{padding:'8px 16px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>↻ Atualizar</button>
              </div>
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1fr 80px 100px',padding:'10px 20px',borderBottom:`1px solid ${T.border}`,background:`${T.gold}08`}}>
                  {['Nome','CPF','Cargo','Status','Editar'].map(h=>(
                    <div key={h} style={{fontSize:11,fontWeight:700,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em'}}>{h}</div>
                  ))}
                </div>
                {gerLoading
                  ? <div style={{padding:32,textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>Carregando...
                    </div>
                  : gerList.map((emp,i)=>(
                      <div key={emp.id} style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1fr 80px 100px',padding:'11px 20px',borderTop:i===0?'none':`1px solid ${T.border}`,alignItems:'center',opacity:emp.active?1:0.55}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}bb)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                            {emp.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                          </div>
                          <div style={{fontSize:13,fontWeight:500,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.name}</div>
                        </div>
                        <div style={{fontSize:11,color:T.textS,fontFamily:'monospace'}}>{emp.cpf}</div>
                        <div style={{fontSize:12,color:T.textT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.cargo||'—'}</div>
                        <div><span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:emp.active?'rgba(34,197,94,0.1)':'rgba(192,64,80,0.08)',color:emp.active?'#16a34a':'#C04050'}}>{emp.active?'Ativo':'Inativo'}</span></div>
                        <button onClick={()=>openGerModal(emp)}
                          style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                          ✏️ Editar
                        </button>
                      </div>
                    ))
                }
              </div>
              {/* Modal edição perfil completo */}
              {gerModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:20}}>
                  <div style={{background:cardBg,borderRadius:20,padding:32,width:'100%',maxWidth:620,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                      <div>
                        <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text}}>Editar Perfil</div>
                        <div style={{fontSize:13,color:T.textS}}>{gerModal.name}</div>
                      </div>
                      <button onClick={()=>setGerModal(null)} style={{border:'none',background:'transparent',cursor:'pointer',fontSize:20,color:T.textD,outline:'none'}}>×</button>
                    </div>
                    {/* Campos organizados em seções */}
                    {[
                      { title:'Dados Pessoais', fields:[
                        {label:'Nome completo',key:'name',type:'text'},
                        {label:'CPF',key:'cpf',type:'text',disabled:true},
                        {label:'RG',key:'rg',type:'text'},
                        {label:'Data de Nascimento',key:'birth_date',type:'text',placeholder:'DD/MM/AAAA'},
                        {label:'E-mail',key:'email',type:'email'},
                        {label:'Telefone',key:'phone',type:'text',placeholder:'(85) 99999-9999'},
                      ]},
                      { title:'Endereço', fields:[
                        {label:'Rua / Logradouro',key:'street',type:'text'},
                        {label:'Bairro',key:'district',type:'text'},
                        {label:'Cidade',key:'city',type:'text'},
                        {label:'Estado',key:'state',type:'text'},
                        {label:'CEP',key:'cep',type:'text'},
                      ]},
                      { title:'Dados Profissionais', fields:[
                        {label:'Cargo',key:'cargo',type:'text'},
                        {label:'Categoria',key:'category',type:'text',placeholder:'CLT, PJ...'},
                        {label:'Data de Admissão',key:'admission',type:'text',placeholder:'DD/MM/AAAA'},
                        {label:'Nº de Dependentes',key:'dependents',type:'number'},
                        {label:'Cargo / Perfil',key:'role',type:'select',options:[{v:'employee',l:'Funcionário'},{v:'admin',l:'Administrador'}]},
                      ]},
                      { title:'Remuneração', fields:[
                        {label:'Salário Base (R$)',key:'salary',type:'number'},
                        {label:'1K Service (R$)',key:'vt',type:'number'},
                        {label:'Motivo do reajuste (ex: Promoção)',key:'salary_event',type:'text',placeholder:'Ex: Reajuste anual, Promoção...'},
                        {label:'Desconto INSS (R$)',key:'inss',type:'number'},
                      ]},
                    ].map(sec=>(
                      <div key={sec.title} style={{marginBottom:20}}>
                        <div style={{fontSize:11,fontWeight:700,color:T.gold,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:12}}>{sec.title}</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                          {sec.fields.map(f=>(
                            <div key={f.key}>
                              <div style={{fontSize:11,fontWeight:600,color:T.textS,marginBottom:4}}>{f.label}</div>
                              {f.type==='select'
                                ? <select value={gerForm[f.key]||''} onChange={e=>setGerForm(p=>({...p,[f.key]:e.target.value}))}
                                    style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:12,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                                    {f.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                                  </select>
                                : <input type={f.type||'text'} value={gerForm[f.key]||''} disabled={f.disabled}
                                    placeholder={f.placeholder||''}
                                    onChange={e=>setGerForm(p=>({...p,[f.key]:f.type==='number'?Number(e.target.value):e.target.value}))}
                                    style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.border}`,background:f.disabled?(T.border+'44'):(T.surface||'white'),fontSize:12,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',cursor:f.disabled?'not-allowed':'text'}}/>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {gerMsg&&<div style={{fontSize:12,color:gerMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12,padding:'7px 12px',borderRadius:7,background:gerMsg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)'}}>{gerMsg}</div>}
                    <div style={{display:'flex',gap:10,marginTop:4}}>
                      <button onClick={()=>setGerModal(null)} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                      <button onClick={saveGerProfile} disabled={gerSaving}
                        style={{flex:2,padding:'11px',borderRadius:10,border:'none',cursor:gerSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {gerSaving?'Salvando...':'Salvar Perfil'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: CALENDÁRIO ── */}
          {tab==='calendario'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Calendário de Eventos</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Eventos criados aqui aparecem para todos os colaboradores</div>
                </div>
                <button onClick={()=>{ setCalForm({title:'',event_date:'',event_time:'Dia todo',type:'Evento',description:''}); setCalMsg(''); setCalModal('new'); }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  + Novo Evento
                </button>
              </div>
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                {calLoading
                  ? <div style={{padding:32,textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>Carregando...
                    </div>
                  : calEvents.length===0
                    ? <div style={{padding:40,textAlign:'center',color:T.textT,fontSize:13}}>
                        Nenhum evento cadastrado. Clique em <strong>+ Novo Evento</strong> para adicionar.
                      </div>
                    : calEvents.map((ev,i)=>{
                        const typeColor = {Feriado:T.blue,Reunião:T.purple,Confraternização:(T.pink||'#E91E8C'),Evento:T.gold,Outro:T.teal};
                        const color = typeColor[ev.type]||T.gold;
                        const d = new Date(ev.event_date+'T12:00:00');
                        return(
                          <div key={ev.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 20px',borderTop:i===0?'none':`1px solid ${T.border}`}}>
                            <div style={{width:44,textAlign:'center',flexShrink:0}}>
                              <div style={{fontSize:18,fontWeight:700,color:T.text}}>{d.getDate()}</div>
                              <div style={{fontSize:9,color:T.textD,textTransform:'uppercase'}}>{d.toLocaleString('pt-BR',{month:'short'})}</div>
                            </div>
                            <div style={{width:3,height:36,borderRadius:2,background:color,flexShrink:0}}/>
                            <div style={{flex:1}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                                <Tag color={color}>{ev.type}</Tag>
                                <span style={{fontSize:11,color:T.textD}}>◷ {ev.event_time}</span>
                              </div>
                              <div style={{fontSize:14,fontWeight:500,color:T.text}}>{ev.title}</div>
                              {ev.description&&<div style={{fontSize:12,color:T.textT,marginTop:2}}>{ev.description}</div>}
                            </div>
                            <div style={{display:'flex',gap:6,flexShrink:0}}>
                              <button onClick={()=>{ setCalForm({title:ev.title,event_date:ev.event_date,event_time:ev.event_time,type:ev.type,description:ev.description||''}); setCalMsg(''); setCalModal(ev); }}
                                style={{width:30,height:30,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none',fontSize:14}}>✏️</button>
                              <button onClick={()=>deleteCalEvent(ev.id)}
                                style={{width:30,height:30,borderRadius:7,border:'1px solid rgba(192,64,80,0.3)',background:'rgba(192,64,80,0.05)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#C04050',outline:'none',fontSize:14}}>🗑</button>
                            </div>
                          </div>
                        );
                      })
                }
              </div>
              {/* Modal criar/editar evento */}
              {calModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:20}}>
                      {calModal==='new'?'Novo Evento':'Editar Evento'}
                    </div>
                    {[
                      {label:'Título do evento',key:'title',type:'text',placeholder:'Ex: Reunião trimestral'},
                      {label:'Data',key:'event_date',type:'date'},
                      {label:'Horário',key:'event_time',type:'text',placeholder:'Ex: 14:00 ou Dia todo'},
                    ].map(f=>(
                      <div key={f.key} style={{marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>{f.label}</div>
                        <input type={f.type} value={calForm[f.key]||''} placeholder={f.placeholder||''}
                          onChange={e=>setCalForm(p=>({...p,[f.key]:e.target.value}))}
                          style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                      </div>
                    ))}
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Tipo</div>
                      <select value={calForm.type} onChange={e=>setCalForm(p=>({...p,type:e.target.value}))}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                        {['Feriado','Reunião','Confraternização','Evento','Outro'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Descrição (opcional)</div>
                      <textarea value={calForm.description||''} onChange={e=>setCalForm(p=>({...p,description:e.target.value}))}
                        placeholder="Detalhes do evento..."
                        rows={2}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',resize:'vertical',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                    </div>
                    {calMsg&&<div style={{fontSize:12,color:'#C04050',marginBottom:12}}>{calMsg}</div>}
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setCalModal(null)} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                      <button onClick={saveCalEvent} disabled={calSaving}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:calSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {calSaving?'Salvando...':'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: BANCO DE HORAS ── */}
          {tab==='banco'&&(()=>{
            const fmtH = h => { if(!h||h<=0) return '0h'; const hh=Math.floor(h); const mm=Math.round((h-hh)*60); return mm>0?`${hh}h${mm.toString().padStart(2,'0')}`:`${hh}h`; };
            const fmtD = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('pt-BR') : '—';
            const BRL  = v => 'R$ '+(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
            const pendentes  = bancoHoras.filter(b=>b.status==='pendente');
            const aprovados  = bancoHoras.filter(b=>b.status==='aprovado');
            const rejeitados = bancoHoras.filter(b=>b.status==='rejeitado');
            const totalHorasAprov = aprovados.reduce((a,b)=>a+Number(b.horas_calculadas||0),0);
            const totalValorAprov = aprovados.reduce((a,b)=>a+Number(b.valor_total||0),0);
            return (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Banco de Horas</div>
                    <div style={{fontSize:13,color:T.textS,marginTop:2}}>Registros enviados pelos colaboradores · {bancoHoras.length} no total</div>
                  </div>
                  <Moon size={24} color={T.goldL} opacity={0.35} float/>
                </div>

                {/* cards de resumo */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                  {[
                    {l:'Pendentes',   v:pendentes.length,  c:'#D89030'},
                    {l:'Aprovados',   v:aprovados.length,  c:'#1A9C70'},
                    {l:'Rejeitados',  v:rejeitados.length, c:'#C04050'},
                    {l:'Horas aprovadas', v:fmtH(totalHorasAprov), c:T.blue||'#2A6FB5'},
                  ].map(({l,v,c})=>(
                    <Card key={l} style={{padding:'16px 20px'}} elevated>
                      <div style={{fontSize:26,fontWeight:700,color:c}}>{v}</div>
                      <div style={{fontSize:12,color:T.textT,marginTop:3}}>{l}</div>
                      {l==='Aprovados'&&totalValorAprov>0&&<div style={{fontSize:11,color:'#1A9C70',marginTop:2,fontWeight:600}}>{BRL(totalValorAprov)}</div>}
                    </Card>
                  ))}
                </div>

                {/* tabela */}
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                  {bancoLoading
                    ? <div style={{textAlign:'center',padding:48,color:T.textT}}>Carregando...</div>
                    : bancoHoras.length===0
                      ? <div style={{textAlign:'center',padding:48,color:T.textT,fontSize:13}}>Nenhum registro ainda.</div>
                      : <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)',minWidth:900}}>
                            <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                              {['Colaborador','Data','Descrição','Horário','Horas','Cálculo','Valor','Status','Ações'].map(h=>(
                                <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px',whiteSpace:'nowrap'}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {bancoHoras.map(b=>{
                                const ss = b.status==='pendente'
                                  ? {bg:'rgba(216,144,48,0.15)',c:'#D89030'}
                                  : b.status==='aprovado'
                                    ? {bg:'rgba(26,156,112,0.12)',c:'#1A9C70'}
                                    : {bg:'rgba(192,64,80,0.12)',c:'#C04050'};
                                const emAcao = bancoAcaoId===b.id;
                                return (
                                  <tr key={b.id} style={{borderTop:`1px solid ${T.border}`}}>
                                    <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:T.text,whiteSpace:'nowrap'}}>{b.created_by}</td>
                                    <td style={{padding:'11px 14px',fontSize:12,color:T.textS,whiteSpace:'nowrap'}}>{fmtD(b.data)}</td>
                                    <td style={{padding:'11px 14px',fontSize:12,color:T.text,maxWidth:200}}>
                                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.descricao}</div>
                                    </td>
                                    <td style={{padding:'11px 14px',fontSize:12,color:T.textS,whiteSpace:'nowrap'}}>{b.hora_inicio} → {b.hora_fim}</td>
                                    <td style={{padding:'11px 14px',whiteSpace:'nowrap'}}>
                                      <div style={{fontSize:13,fontWeight:600,color:T.text}}>{fmtH(Number(b.total_horas))}</div>
                                      {b.feriado_domingo&&<span style={{fontSize:10,fontWeight:600,color:'#D89030',background:'rgba(216,144,48,0.12)',borderRadius:4,padding:'1px 5px'}}>Feriado/Dom</span>}
                                    </td>
                                    <td style={{padding:'11px 14px',whiteSpace:'nowrap'}}>
                                      <div style={{fontSize:13,fontWeight:700,color:b.feriado_domingo?'#D89030':T.text}}>{fmtH(Number(b.horas_calculadas))}</div>
                                      {b.feriado_domingo&&<div style={{fontSize:10,color:T.textD}}>×2 no banco</div>}
                                    </td>
                                    <td style={{padding:'11px 14px',fontSize:13,fontWeight:700,color:'#1A9C70',whiteSpace:'nowrap'}}>
                                      {b.valor_total>0 ? BRL(b.valor_total) : <span style={{color:T.textD,fontWeight:400,fontSize:12}}>—</span>}
                                    </td>
                                    <td style={{padding:'11px 14px'}}>
                                      <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:ss.bg,color:ss.c,textTransform:'capitalize',whiteSpace:'nowrap'}}>{b.status}</span>
                                    </td>
                                    <td style={{padding:'11px 14px'}}>
                                      {b.status==='pendente'
                                        ? <div style={{display:'flex',gap:5}}>
                                            <button onClick={()=>atualizarStatus(b.id,'aprovado')} disabled={emAcao}
                                              style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(26,156,112,0.3)',background:'rgba(26,156,112,0.10)',color:'#1A9C70',cursor:emAcao?'wait':'pointer',fontSize:11,outline:'none',fontWeight:600}}>
                                              {emAcao?'...':'Aprovar'}
                                            </button>
                                            <button onClick={()=>atualizarStatus(b.id,'rejeitado')} disabled={emAcao}
                                              style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(192,64,80,0.3)',background:'rgba(192,64,80,0.08)',color:'#C04050',cursor:emAcao?'wait':'pointer',fontSize:11,outline:'none'}}>
                                              {emAcao?'...':'Recusar'}
                                            </button>
                                          </div>
                                        : <span style={{fontSize:11,color:T.textD}}>—</span>
                                      }
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                  }
                </Card>
              </div>
            );
          })()}


          {/* ── TAB: COMUNICADOS ── */}
          {tab==='comunicados'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Comunicados</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Publique avisos que aparecem no portal do colaborador em tempo real</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>Novo Comunicado</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Título</div>
                  <input value={comForm.title} onChange={e=>setComForm(p=>({...p,title:e.target.value}))} placeholder="Ex: Atualização de benefícios..."
                    style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Corpo do comunicado</div>
                  <textarea value={comForm.body} onChange={e=>setComForm(p=>({...p,body:e.target.value}))} rows={4} placeholder="Texto completo do comunicado..."
                    style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,fontSize:13,color:T.text,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'flex-end',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Categoria</div>
                    <select value={comForm.cat} onChange={e=>setComForm(p=>({...p,cat:e.target.value}))}
                      style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                      {['RH','Benefícios','Política','Compliance','Geral'].map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{padding:'9px 16px',borderRadius:8,border:`1.5px solid ${comForm.urgent?'rgba(192,64,80,0.5)':T.border}`,background:comForm.urgent?'rgba(192,64,80,0.06)':'transparent',cursor:'pointer',fontSize:13,color:comForm.urgent?'#C04050':T.textS,fontFamily:'var(--font-body)',fontWeight:comForm.urgent?700:400,userSelect:'none'}}
                    onClick={()=>setComForm(p=>({...p,urgent:!p.urgent}))}>
                    🚨 {comForm.urgent?'Urgente':'Marcar urgente'}
                  </div>
                </div>
                {comMsg&&<div style={{fontSize:12,color:comMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:10,padding:'7px 12px',borderRadius:7,background:comMsg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)'}}>{comMsg}</div>}
                <button onClick={publishComunicado} disabled={comSaving||!comForm.title.trim()}
                  style={{padding:'10px 24px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',opacity:comForm.title.trim()?1:0.5}}>
                  {comSaving?'Publicando...':'Publicar agora'}
                </button>
              </Card>
              <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text}}>Comunicados publicados</div>
                  <button onClick={loadComunicados} style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>↻</button>
                </div>
                {comLoading
                  ? <div style={{padding:32,textAlign:'center',color:T.textT,fontSize:13}}>Carregando...</div>
                  : comunicados.length===0
                    ? <div style={{padding:40,textAlign:'center',color:T.textT,fontSize:13}}>Nenhum comunicado publicado ainda.</div>
                    : comunicados.map(c=>(
                        <div key={c.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 20px',borderBottom:`1px solid ${T.border}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            {c.urgent&&<span style={{fontSize:10,fontWeight:700,color:'#C04050',background:'rgba(192,64,80,0.08)',padding:'1px 7px',borderRadius:4,marginRight:6}}>🚨 URGENTE</span>}
                            <span style={{fontSize:11,color:T.gold,fontWeight:600,background:T.goldGl,padding:'1px 7px',borderRadius:4}}>{c.cat}</span>
                            <div style={{fontSize:14,fontWeight:600,color:T.text,marginTop:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                            <div style={{fontSize:12,color:T.textT,marginTop:2}}>{new Date(c.created_at).toLocaleString('pt-BR')}</div>
                          </div>
                          <button onClick={()=>deleteComunicado(c.id)} title="Remover"
                            style={{width:28,height:28,borderRadius:7,border:'1px solid rgba(192,64,80,0.25)',background:'rgba(192,64,80,0.05)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#C04050',outline:'none',flexShrink:0}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        </div>
                      ))
                }
              </Card>
            </div>
          )}

          {/* ── TAB: LEMBRETES & ALEXA PROGRAMADA ── */}
          {tab==='lembretes'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Lembretes & Alexa Programada</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Programe o que a Alexa vai falar e quando — aparece para todos os colaboradores</div>
                </div>
                <button onClick={()=>{ setLembForm({title:'',message:'',time:'',date:'',type:'lembrete',repeat:'never',active:true,fanfare:false,sound:'fanfarra'}); setLembMsg(''); setLembModal('new'); }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  + Novo Lembrete
                </button>
              </div>

              {/* Tipo legend */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[
                  {type:'lembrete',label:'Lembrete geral',color:T.blue},
                  {type:'alexa',label:'Alexa fala',color:T.gold},
                  {type:'reuniao',label:'Reunião',color:T.purple||'#7060C8'},
                  {type:'aviso',label:'Aviso RH',color:'#E91E8C'},
                ].map(({type,label,color})=>(
                  <div key={type} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,background:`${color}11`,border:`1px solid ${color}33`,fontSize:11,color}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:color}}/>
                    {label}
                  </div>
                ))}
              </div>

              {/* List */}
              <div style={{borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.sh,overflow:'hidden'}}>
                {lembLoading
                  ? <div style={{padding:32,textAlign:'center',color:T.textT,fontSize:13}}>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',margin:'0 auto 8px'}}/>Carregando...
                    </div>
                  : lembretes.length===0
                    ? <div style={{padding:'40px',textAlign:'center',color:T.textT,fontSize:13}}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.textT} strokeWidth="1.2" strokeLinecap="round" style={{margin:'0 auto 10px',display:'block'}}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                        Nenhum lembrete criado ainda.
                      </div>
                    : lembretes.map((l,i)=>{
                        const typeColor = {lembrete:T.blue,alexa:T.gold,reuniao:T.purple||'#7060C8',aviso:'#E91E8C'};
                        const color = typeColor[l.type]||T.gold;
                        const typeLabel = {lembrete:'Lembrete',alexa:'Alexa fala',reuniao:'Reunião',aviso:'Aviso RH'};
                        return(
                          <div key={l.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderTop:i===0?'none':`1px solid ${T.border}`,opacity:l.active?1:0.5}}>
                            {/* Color bar */}
                            <div style={{width:3,height:44,borderRadius:2,background:color,flexShrink:0}}/>
                            {/* Info */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                                <span style={{fontSize:11,fontWeight:600,padding:'1px 7px',borderRadius:4,background:`${color}18`,color}}>{typeLabel[l.type]||l.type}</span>
                                {l.repeat!=='never'&&<span style={{fontSize:10,color:T.textD}}>↻ {l.repeat==='daily'?'Diário':l.repeat==='weekly'?'Semanal':'Mensal'}</span>}
                                {!l.active&&<span style={{fontSize:10,color:T.textD}}>Pausado</span>}
                              </div>
                              <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                              {l.message&&<div style={{fontSize:12,color:T.textT,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.message}</div>}
                            </div>
                            {/* Time */}
                            <div style={{flexShrink:0,textAlign:'right'}}>
                              {l.date&&<div style={{fontSize:12,color:T.textS,fontWeight:500}}>{new Date(l.date+'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                              {l.time&&<div style={{fontSize:13,fontWeight:700,color:T.gold}}>{l.time}</div>}
                              <div style={{fontSize:10,color:T.textD,marginTop:2}}>por {l.created_by}</div>
                            </div>
                            {/* Actions */}
                            <div style={{display:'flex',gap:5,flexShrink:0}}>
                              <button onClick={()=>toggleLembrete(l.id,l.active)}
                                title={l.active?'Pausar':'Ativar'}
                                style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                                {l.active
                                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                }
                              </button>
                              <button onClick={()=>{ setLembForm({title:l.title,message:l.message||'',time:l.time||'',date:l.date||'',type:l.type||'lembrete',repeat:l.repeat||'never',active:l.active,fanfare:!!l.fanfare,sound:l.sound||'fanfarra'}); setLembMsg(''); setLembModal(l); }}
                                title="Editar"
                                style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T.textS,outline:'none'}}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={()=>deleteLembrete(l.id)}
                                title="Remover"
                                style={{width:28,height:28,borderRadius:7,border:'1px solid rgba(192,64,80,0.3)',background:'rgba(192,64,80,0.05)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#C04050',outline:'none'}}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })
                }
              </div>

              {/* Modal */}
              {lembModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:440,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:20}}>
                      {lembModal==='new'?'Novo Lembrete':'Editar Lembrete'}
                    </div>

                    {/* Alexa status */}
                    {alexaStatus&&(
                      <div style={{marginBottom:16,padding:'8px 12px',borderRadius:8,fontSize:11,
                        background:alexaStatus.ok?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)',
                        border:`1px solid ${alexaStatus.ok?'rgba(34,197,94,0.25)':'rgba(192,64,80,0.2)'}`,
                        color:alexaStatus.ok?'#16a34a':'#C04050',display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:alexaStatus.ok?'#16a34a':'#C04050',flexShrink:0}}/>
                        {alexaStatus.ok ? 'Alexa conectada — anúncio será reproduzido no Echo Dot' : alexaStatus.configured ? 'Alexa configurada mas offline' : 'Alexa não configurada — adicione AMAZON_EMAIL e AMAZON_PASSWORD no Render'}
                      </div>
                    )}

                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Tipo</div>
                      <div style={{display:'flex',gap:6}}>
                        {[{v:'alexa',l:'🎙 Alexa Fala'},{v:'aviso_urgente',l:'🚨 Aviso Urgente'},{v:'lembrete',l:'🔔 Lembrete'}].map(({v,l})=>(
                          <button key={v} onClick={()=>setLembForm(p=>({...p,type:v}))}
                            style={{flex:1,padding:'7px 4px',borderRadius:8,border:`1.5px solid ${lembForm.type===v?T.gold:T.border}`,background:lembForm.type===v?T.goldGl:'transparent',fontSize:11,fontWeight:lembForm.type===v?700:400,color:lembForm.type===v?T.gold:T.textS,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)'}}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {[
                      {label:'Título',key:'title',placeholder:'Ex: Reunião de equipe'},
                      {label:'Mensagem / O que a Alexa vai falar',key:'message',placeholder:'Ex: Atenção equipe, reunião em 10 minutos!'},
                    ].map(f=>(
                      <div key={f.key} style={{marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>{f.label}</div>
                        <input value={lembForm[f.key]||''} onChange={e=>setLembForm(p=>({...p,[f.key]:e.target.value}))}
                          placeholder={f.placeholder}
                          style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                      </div>
                    ))}

                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Data</div>
                        <input type="date" value={lembForm.date||''} onChange={e=>setLembForm(p=>({...p,date:e.target.value}))}
                          style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                      </div>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Horário</div>
                        <input type="time" value={lembForm.time||''} onChange={e=>setLembForm(p=>({...p,time:e.target.value}))}
                          style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                      </div>
                    </div>

                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:4}}>Repetição</div>
                      <select value={lembForm.repeat||'never'} onChange={e=>setLembForm(p=>({...p,repeat:e.target.value}))}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                        <option value="never">Sem repetição</option>
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>

                    {/* Descrição do tipo */}
                    <div style={{marginBottom:16,padding:'10px 14px',borderRadius:10,background:T.surfaceSub||'rgba(0,0,0,0.03)',border:`1px solid ${T.border}`,fontSize:12,color:T.textS,lineHeight:1.5}}>
                      {lembForm.type==='alexa'       && '🎙 A Alexa vai falar a mensagem no Echo Dot. Pode enviar agora ou programar um horário.'}
                      {lembForm.type==='aviso_urgente'&& '🚨 Aparece como tela cheia para todos os colaboradores. Eles só conseguem fechar digitando "Ok". Pode enviar agora ou programar.'}
                      {lembForm.type==='lembrete'    && '🔔 O Uniko aparece no canto inferior esquerdo com a mensagem. O colaborador fecha clicando em Ok.'}
                    </div>

                    {lembMsg&&<div style={{fontSize:12,color:lembMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12,padding:'7px 12px',borderRadius:7,background:lembMsg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)'}}>{lembMsg}</div>}
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <button onClick={()=>setLembModal(null)} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                      {lembForm.type==='alexa'&&(
                        <button onClick={testAlexa} disabled={testingAlexa}
                          title="Testa na Alexa agora sem salvar"
                          style={{padding:'11px 14px',borderRadius:10,border:`1px solid ${T.goldLine}55`,cursor:testingAlexa?'wait':'pointer',background:T.goldGl,color:T.gold,fontSize:13,fontFamily:'var(--font-body)',outline:'none',fontWeight:600}}>
                          {testingAlexa?'...':'▶ Testar'}
                        </button>
                      )}
                      {lembForm.type==='lembrete'&&(
                        <button onClick={sendNow} disabled={lembSaving}
                          title="Dispara a bolha do Uniko agora para testar"
                          style={{padding:'11px 14px',borderRadius:10,border:`1px solid ${T.goldLine}55`,cursor:'pointer',background:T.goldGl,color:T.gold,fontSize:13,fontFamily:'var(--font-body)',outline:'none',fontWeight:600}}>
                          📲 Testar
                        </button>
                      )}
                      {(lembForm.type==='alexa'||lembForm.type==='aviso_urgente')&&(
                        <button onClick={sendNow} disabled={lembSaving}
                          style={{padding:'11px 16px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#C04050,#E05565)',color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                          ⚡ Enviar agora
                        </button>
                      )}
                      <button onClick={saveLembrete} disabled={lembSaving}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:lembSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                        {lembSaving?'Salvando...':'Salvar programado'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: PERFIS ── */}
          {tab==='perfis'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Dados Pessoais</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Somente administradores podem editar informações dos colaboradores</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                {users.filter(u=>u.role==='colaborador').map(u=>(
                  <Card key={u.id} style={{padding:'18px 20px',cursor:'pointer'}} elevated
                    onClick={()=>setEditProfile(editProfile?.id===u.id?null:u)}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                      <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#1E70B5,#0f4a80)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                        {u.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:T.text}}>{u.name}</div>
                        <div style={{fontSize:11,color:T.textT}}>{u.dept||'Sem departamento'}</div>
                      </div>
                    </div>
                    <div style={{fontSize:12,color:T.textS}}>{u.email}</div>
                    <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:5,background:u.status==='ativo'?'rgba(26,156,112,0.12)':'rgba(0,0,0,0.06)',color:u.status==='ativo'?'#1A9C70':T.textD}}>{u.status==='ativo'?'Ativo':'Inativo'}</span>
                      <span style={{fontSize:11,color:T.gold,fontWeight:600}}>✏ Editar</span>
                    </div>
                  </Card>
                ))}
              </div>
              {editProfile&&(
                <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:`1.5px solid ${T.goldLine}44`}} elevated>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Editando: {editProfile.name}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
                    {[['name','Nome completo'],['email','E-mail'],['dept','Departamento'],['cargo','Cargo'],['admissao','Data de Admissão'],['telefone','Telefone']].map(([k,l])=>(
                      <div key={k}>
                        <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>{l}</label>
                        <input defaultValue={editProfile[k]||''}
                          style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',boxSizing:'border-box'}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={{padding:'9px 20px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,background:'linear-gradient(135deg,#1A9C70,#0f7a56)',color:'white'}}>Salvar Alterações</button>
                    <button onClick={()=>setEditProfile(null)} style={{padding:'9px 16px',borderRadius:9,border:`1px solid ${T.border}`,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,color:T.textS,background:'transparent'}}>Cancelar</button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── TAB: CENTRAL ALEXA — removida, funcionalidade unificada em Lembretes & Alexa ── */}
          {tab==='alexa'&&(()=>{
            const [alexaMsgs, setAlexaMsgs] = React.useState([
              {id:1,title:'Reunião de Equipe',msg:'Atenção! Reunião de equipe hoje às 14h na sala de conferências.',dest:'todos',status:'enviado',date:'23/05/2026',hora:'09:15'},
              {id:2,title:'Lembrete Ponto',msg:'Colaboradores, não esqueçam de bater o ponto ao sair.',dest:'todos',status:'enviado',date:'22/05/2026',hora:'17:45'},
              {id:3,title:'Manutenção do Sistema',msg:'O sistema ficará em manutenção hoje à noite entre 22h e 23h.',dest:'admins',status:'agendado',date:'26/05/2026',hora:'19:00'},
            ]);
            const [newAlexa, setNewAlexa] = React.useState({title:'',msg:'',dest:'todos',hora:'agora'});
            const [sending, setSending]   = React.useState(false);
            const [sent, setSent]         = React.useState(false);
            const sendAlexa = () => {
              if(!newAlexa.title||!newAlexa.msg) return;
              setSending(true);
              setTimeout(()=>{
                setAlexaMsgs(prev=>[{id:Date.now(),title:newAlexa.title,msg:newAlexa.msg,dest:newAlexa.dest,status:'enviado',date:new Date().toLocaleDateString('pt-BR'),hora:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})},...prev]);
                setNewAlexa({title:'',msg:'',dest:'todos',hora:'agora'});
                setSending(false); setSent(true);
                setTimeout(()=>setSent(false),3000);
              },1600);
            };
            return(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Central Alexa</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Anuncie comunicados para os colaboradores via alto-falante</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:8,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:'#1A9C70',animation:'blobGrad 1.5s ease infinite'}}/>
                    <span style={{fontSize:11,fontWeight:600,color:'#1A9C70'}}>Alexa Online</span>
                  </div>
                  <Moon size={24} color={T.goldL} opacity={0.35} float/>
                </div>
              </div>

              {/* Compose */}
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  Novo Comunicado
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Título do Comunicado</label>
                    <input value={newAlexa.title} onChange={e=>setNewAlexa(p=>({...p,title:e.target.value}))}
                      placeholder="Ex: Reunião de Equipe, Aviso de Sistema..."
                      style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Destinatário</label>
                    <select value={newAlexa.dest} onChange={e=>setNewAlexa(p=>({...p,dest:e.target.value}))}
                      style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',cursor:'pointer'}}>
                      <option value="todos">📢 Todos os colaboradores</option>
                      <option value="financeiro">💼 Departamento Financeiro</option>
                      <option value="comercial">🤝 Departamento Comercial</option>
                      <option value="operacoes">⚙️ Operações</option>
                      <option value="admins">🛡 Somente Administradores</option>
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>Mensagem do Comunicado</label>
                  <textarea value={newAlexa.msg} onChange={e=>setNewAlexa(p=>({...p,msg:e.target.value}))} rows={4}
                    placeholder="Digite a mensagem que será anunciada pela Alexa para os colaboradores..."
                    style={{width:'100%',padding:'10px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                  <div style={{textAlign:'right',fontSize:11,color:T.textD,marginTop:4}}>{newAlexa.msg.length}/300 caracteres</div>
                </div>
                {/* Preview */}
                {newAlexa.msg&&(
                  <div style={{padding:'12px 16px',borderRadius:10,background:T.goldGl,border:`1px solid ${T.goldLine}44`,marginBottom:14,display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </div>
                    <div>
                      <div style={{fontSize:10,fontWeight:600,color:T.gold,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>Prévia do Anúncio</div>
                      <div style={{fontSize:13,color:T.text,lineHeight:1.5}}>"{newAlexa.msg}"</div>
                    </div>
                  </div>
                )}
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <button onClick={sendAlexa} disabled={!newAlexa.title||!newAlexa.msg||sending}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'10px 24px',borderRadius:10,border:'none',cursor:newAlexa.title&&newAlexa.msg&&!sending?'pointer':'not-allowed',fontFamily:'var(--font-body)',fontSize:13,fontWeight:700,background:sending?T.surfaceSub:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:sending?T.textS:'white',boxShadow:sending?'none':`0 4px 14px ${T.goldLine}55`,opacity:newAlexa.title&&newAlexa.msg?1:0.5,transition:'all .2s'}}>
                    {sending?(
                      <><div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${T.gold}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}/> Enviando...</>
                    ):(
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Anunciar pela Alexa</>
                    )}
                  </button>
                  {sent&&<div style={{fontSize:12,color:'#1A9C70',display:'flex',alignItems:'center',gap:5}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Comunicado enviado com sucesso!
                  </div>}
                </div>
              </Card>

              {/* Histórico */}
              <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,${T.goldGl},transparent)`}}>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text}}>Histórico de Comunicados</div>
                  <span style={{fontSize:11,color:T.textT}}>{alexaMsgs.length} anúncio{alexaMsgs.length!==1?'s':''}</span>
                </div>
                {alexaMsgs.length===0
                  ? <div style={{padding:'40px',textAlign:'center',color:T.textT}}>Nenhum comunicado enviado ainda</div>
                  : <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                      <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                        {['Título','Mensagem','Destinatário','Status','Data / Hora'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:10,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'9px 14px'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {alexaMsgs.map(a=>(
                          <tr key={a.id} style={{borderTop:`1px solid ${T.border}`}}>
                            <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:T.text}}>{a.title}</td>
                            <td style={{padding:'11px 14px',fontSize:12,color:T.textS,maxWidth:260}}>{a.msg}</td>
                            <td style={{padding:'11px 14px'}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:T.goldGl,color:T.gold}}>{a.dest==='todos'?'📢 Todos':a.dest==='admins'?'🛡 Admins':`💼 ${a.dest}`}</span>
                            </td>
                            <td style={{padding:'11px 14px'}}>
                              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:a.status==='enviado'?'rgba(26,156,112,0.12)':'rgba(216,144,48,0.15)',color:a.status==='enviado'?'#1A9C70':'#D89030'}}>{a.status==='enviado'?'✓ Enviado':'⏱ Agendado'}</span>
                            </td>
                            <td style={{padding:'11px 14px',fontSize:12,color:T.textT,whiteSpace:'nowrap'}}>{a.date} às {a.hora}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </Card>
            </div>
            );
          })()}
          {tab==='trofeus'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Troféus & Reconhecimento</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Envie troféus de Ouro e Platina para reconhecer colaboradores destacados</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              {/* Enviar troféu */}
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>Enviar Troféu</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Colaborador</label>
                    <select value={trophyTarget||''} onChange={e=>setTrophyTarget(e.target.value||null)}
                      style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',cursor:'pointer'}}>
                      <option value="">Selecione o colaborador...</option>
                      {users.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Tipo de Troféu</label>
                    <div style={{display:'flex',gap:8}}>
                      {[['ouro','🥇 Ouro','#D89030'],['platina','💎 Platina','#5B8DB8']].map(([v,l,c])=>(
                        <button key={v} onClick={()=>setTrophyType(v)}
                          style={{flex:1,padding:'9px',borderRadius:9,cursor:'pointer',outline:'none',fontFamily:'var(--font-body)',fontSize:13,fontWeight:trophyType===v?700:500,background:trophyType===v?`${c}18`:(T.surfaceSub||'rgba(0,0,0,0.03)'),color:trophyType===v?c:T.textS,border:`2px solid ${trophyType===v?c+'66':T.border}`,transition:'all .15s'}}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:7}}>Mensagem de Reconhecimento</label>
                  <textarea value={trophyMsg} onChange={e=>setTrophyMsg(e.target.value)} rows={3}
                    placeholder="Descreva o motivo do reconhecimento..."
                    style={{width:'100%',padding:'10px 12px',border:`1.5px solid ${T.border}`,borderRadius:9,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                </div>
                <button onClick={sendTrophy} disabled={!trophyTarget||!trophyMsg.trim()}
                  style={{padding:'10px 24px',borderRadius:9,border:'none',cursor:trophyTarget&&trophyMsg.trim()?'pointer':'not-allowed',fontFamily:'var(--font-body)',fontSize:13,fontWeight:700,background:trophyType==='ouro'?'linear-gradient(135deg,#D89030,#b06820)':'linear-gradient(135deg,#5B8DB8,#3a6a90)',color:'white',opacity:trophyTarget&&trophyMsg.trim()?1:0.5}}>
                  {trophyType==='ouro'?'🥇':'💎'} Enviar Troféu
                </button>
              </Card>
              {/* Histórico */}
              <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,fontFamily:'var(--font-brand)',fontSize:14,fontWeight:700,color:T.text}}>Histórico de Troféus</div>
                {trophyHistory.length===0
                  ? <div style={{padding:'40px',textAlign:'center',color:T.textT}}>Nenhum troféu enviado ainda</div>
                  : <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)'}}>
                      <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.02)'}}>
                        {['Colaborador','Tipo','Mensagem','Data','Enviado por'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'9px 16px'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {trophyHistory.map(t=>(
                          <tr key={t.id} style={{borderTop:`1px solid ${T.border}`}}>
                            <td style={{padding:'11px 16px',fontSize:14,fontWeight:600,color:T.text}}>{t.to}</td>
                            <td style={{padding:'11px 16px'}}>
                              <span style={{fontSize:13,fontWeight:700,color:t.type==='ouro'?'#D89030':'#5B8DB8'}}>{t.type==='ouro'?'🥇 Ouro':'💎 Platina'}</span>
                            </td>
                            <td style={{padding:'11px 16px',fontSize:12,color:T.textS,maxWidth:220}}>{t.msg}</td>
                            <td style={{padding:'11px 16px',fontSize:12,color:T.textT}}>{t.date}</td>
                            <td style={{padding:'11px 16px',fontSize:12,color:T.textT}}>{t.from}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </Card>
            </div>
          )}

          {/* ── TAB: CONFIGURAÇÕES ── */}
          {tab==='config'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Configurações do Sistema</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Gerencie as configurações administrativas</div>
                </div>
                <Moon size={24} color={T.goldL} opacity={0.35} float/>
              </div>
              {/* Alterar senha */}
              <Card style={{padding:'22px 26px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:`1.5px solid ${T.border}`}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Alterar Senha do Dashboard RH
                </div>
                <div style={{fontSize:12,color:T.textT,marginBottom:16}}>Funcionalidade visual — integração com banco de dados em breve</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                  {[['old','Senha atual'],['new1','Nova senha'],['new2','Confirmar nova']].map(([k,l])=>(
                    <div key={k}>
                      <label style={{fontSize:11,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:5}}>{l}</label>
                      <input type="password" value={changePw[k]} onChange={e=>setChangePw(p=>({...p,[k]:e.target.value}))}
                        style={{width:'100%',padding:'8px 12px',border:`1.5px solid ${T.border}`,borderRadius:8,fontFamily:'var(--font-body)',fontSize:13,color:T.text,background:T.surface,outline:'none',boxSizing:'border-box'}}/>
                    </div>
                  ))}
                </div>
                {changePwMsg&&<div style={{fontSize:12,color:'#1A9C70',marginBottom:10}}>✓ {changePwMsg}</div>}
                <button onClick={()=>{if(changePw.old===ADMIN_PW&&changePw.new1===changePw.new2&&changePw.new1.length>=6){setChangePwMsg('Senha atualizada com sucesso (visual).');}else{setChangePwMsg('Erro: verifique os campos.');}}}
                  style={{padding:'9px 20px',borderRadius:9,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white'}}>
                  Atualizar Senha
                </button>
              </Card>
              {/* Info */}
              <Card style={{padding:'20px 24px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}>Sobre o Sistema</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  {[['Sistema','Uniko'],['Versão','1.0 — Visual Preview'],['Empresa','7SERV GESTÃO BENEFÍCIOS'],['Módulos','Portal Colaborador · Ponto Eletrônico · Dashboard RH'],['Backend','Previsto — em desenvolvimento'],['Desenvolvido por','Nicolas Andrade']].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:10,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600,marginBottom:3}}>{l}</div>
                      <div style={{fontSize:13,color:T.textS}}>{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── TAB: API DO SPOTIFY ── */}
          {tab==='spotify'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>API do Spotify</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Credenciais OAuth para reprodução de música na Central Alexa</div>
                </div>
                <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#1DB954,#158a3e)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(29,185,84,0.35)'}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
              </div>

              {/* Info */}
              <div style={{padding:'14px 18px',borderRadius:11,background:'rgba(29,185,84,0.07)',border:'1px solid rgba(29,185,84,0.22)',display:'flex',gap:12,alignItems:'flex-start'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div style={{fontSize:12,color:T.textS,lineHeight:1.6}}>
                  Para trocar a conta do Spotify vinculada à Central Alexa, gere novas credenciais no
                  {' '}<strong style={{color:T.text}}>Spotify for Developers</strong>{' '}
                  (developer.spotify.com/dashboard) e cole o <strong style={{color:T.text}}>Client ID</strong> e o{' '}
                  <strong style={{color:T.text}}>Client Secret</strong> abaixo.
                </div>
              </div>

              {/* Form */}
              <Card style={{padding:'26px 28px',background:cardBg,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',border:`1.5px solid ${T.border}`}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:15,fontWeight:700,color:T.text,marginBottom:20,display:'flex',alignItems:'center',gap:9}}>
                  <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#1DB954,#158a3e)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  Credenciais do App Spotify
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:16,marginBottom:20}}>
                  {/* Client ID */}
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em',display:'block',marginBottom:6}}>Client ID</label>
                    <input
                      value={spotifyClientId}
                      onChange={e=>{ setSpotifyClientId(e.target.value); setSpotifyMsg(''); }}
                      placeholder="Ex: 4a8f1b2c3d4e5f6a7b8c9d0e1f2a3b4c"
                      spellCheck={false}
                      style={{width:'100%',padding:'11px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'monospace',letterSpacing:'.04em'}}/>
                    <div style={{fontSize:11,color:T.textD,marginTop:4}}>Encontre em: Dashboard → seu app → Settings → Client ID</div>
                  </div>

                  {/* Client Secret */}
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,textTransform:'uppercase',letterSpacing:'.08em',display:'block',marginBottom:6}}>Client Secret</label>
                    <input
                      type="password"
                      value={spotifySecret}
                      onChange={e=>{ setSpotifySecret(e.target.value); setSpotifyMsg(''); }}
                      placeholder="••••••••••••••••••••••••••••••••"
                      style={{width:'100%',padding:'11px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'monospace'}}/>
                    <div style={{fontSize:11,color:T.textD,marginTop:4}}>Encontre em: Dashboard → seu app → Settings → View client secret</div>
                  </div>
                </div>

                {/* Status do servidor */}
                {spotifyServerStatus && (
                  <div style={{padding:'10px 14px',borderRadius:9,marginBottom:16,
                    background: spotifyServerStatus.has_refresh_token ? 'rgba(29,185,84,0.07)' : 'rgba(216,144,48,0.08)',
                    border: `1px solid ${spotifyServerStatus.has_refresh_token ? 'rgba(29,185,84,0.2)' : 'rgba(216,144,48,0.25)'}`,
                    display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,
                      background: spotifyServerStatus.has_refresh_token ? '#1DB954' : '#D89030'}}/>
                    <div style={{fontSize:12,fontWeight:500,
                      color: spotifyServerStatus.has_refresh_token ? '#1DB954' : '#D89030'}}>
                      {spotifyServerStatus.has_refresh_token
                        ? `Servidor autenticado · Client ID: ${spotifyServerStatus.client_id}`
                        : spotifyServerStatus.client_id
                          ? `Credenciais no servidor · ${spotifyServerStatus.client_id} — ainda não autenticado`
                          : 'Servidor sem credenciais — salve abaixo'}
                    </div>
                  </div>
                )}

                {spotifyMsg&&(
                  <div style={{padding:'9px 14px',borderRadius:9,marginBottom:14,fontSize:12,
                    background:spotifyMsg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)',
                    border:`1px solid ${spotifyMsg.startsWith('✅')?'rgba(34,197,94,0.25)':'rgba(192,64,80,0.2)'}`,
                    color:spotifyMsg.startsWith('✅')?'#16a34a':'#C04050'}}>
                    {spotifyMsg}
                  </div>
                )}

                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  <button onClick={()=>{ setSpotifyClientId(''); setSpotifySecret(''); localStorage.removeItem('spotify_client_id'); localStorage.removeItem('spotify_client_secret'); setSpotifyMsg(''); }}
                    style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                    Limpar
                  </button>
                  <button onClick={saveSpotifyCreds} disabled={spotifySaving}
                    style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:spotifySaving?'wait':'pointer',background:'linear-gradient(135deg,#1DB954,#158a3e)',color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',outline:'none',boxShadow:'0 4px 14px rgba(29,185,84,0.35)',transition:'opacity .15s',opacity:spotifySaving?0.7:1}}>
                    {spotifySaving ? 'Salvando...' : '💾 Salvar Credenciais'}
                  </button>
                </div>

                {/* Botão de autenticação — aparece quando há credenciais no servidor mas não tem refresh token */}
                {spotifyServerStatus?.client_id && (
                  <div style={{marginTop:14,padding:'14px 16px',borderRadius:10,border:`1.5px solid ${spotifyServerStatus.has_refresh_token ? 'rgba(29,185,84,0.25)' : 'rgba(29,185,84,0.5)'}`,background:spotifyServerStatus.has_refresh_token?'rgba(29,185,84,0.04)':'rgba(29,185,84,0.06)'}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:8}}>
                      {spotifyServerStatus.has_refresh_token ? '✅ Conta autenticada — para trocar de conta:' : '⚠️ Credenciais salvas mas conta não autenticada ainda:'}
                    </div>
                    <a href={`${SERVER_URL}/login`} target="_blank" rel="noopener noreferrer"
                      style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:9,background:'#1DB954',color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',textDecoration:'none',boxShadow:'0 3px 12px rgba(29,185,84,0.4)'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      {spotifyServerStatus.has_refresh_token ? 'Autenticar nova conta Spotify' : 'Autenticar conta Spotify'}
                    </a>
                    <div style={{fontSize:11,color:T.textD,marginTop:8}}>Abre o login do Spotify no servidor. Após autorizar, volte aqui.</div>
                  </div>
                )}
              </Card>

              {/* Dica de uso */}
              <Card style={{padding:'18px 22px',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                <div style={{fontFamily:'var(--font-brand)',fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Como criar um app no Spotify for Developers</div>
                <div style={{display:'flex',flexDirection:'column',gap:9}}>
                  {[
                    'Acesse developer.spotify.com/dashboard e faça login com a nova conta Spotify.',
                    'Clique em "Create app". Dê um nome (ex: "Uniko Alexa") e defina o Redirect URI como http://localhost:3001/callback.',
                    'Após criar, abra o app e vá em Settings para copiar o Client ID e Client Secret.',
                    'Cole os valores nos campos acima e salve.',
                  ].map((step, i) => (
                    <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                      <div style={{width:20,height:20,borderRadius:6,background:'linear-gradient(135deg,#1DB954,#158a3e)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0,marginTop:1}}>{i+1}</div>
                      <div style={{fontSize:12,color:T.textS,lineHeight:1.5}}>{step}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};


/* ── MODAL DE CONFIGURAÇÕES ── */

export default DashboardRH;
