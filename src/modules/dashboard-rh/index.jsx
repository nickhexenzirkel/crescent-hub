import React, { useState, useEffect, useId } from 'react';
import { T } from '../../contexts/theme';
import { SERVER_URL, supabase as _supabase, getAuthUser } from '../../contexts/user';
import { StarDivider, Card, Btn, Tag, SHead, Moon, Logo, UnikoIcon } from '../../shared/components';
import { splitContrachequesPDF, normName, onlyDigits } from './contrachequeSplit';
import UnikoQATab from './UnikoQATab';
import {
  loadCaptureConfig, saveCaptureConfig, CAPTURE_UNIKOS, resetCaptures, getCaptureReward,
  getUniko, loadCustomUnikos, saveCustomUniko, deleteCustomUniko, deriveUnikoTheme, getCustomUnikoRaw, pickSpawnAt,
  giftUnikoToPlayer, themeWithScene, loadRewardOverrides, saveRewardOverride,
  loadUnikoBgVideos, saveUnikoBgVideo, getUnikoBgVideo,
} from '../../shared/captureUniko';
import { loadMensagemEspecial, saveMensagemEspecial, MSG_ESPECIAL_FALLBACK } from '../../shared/mensagemEspecial';

// Gera um trecho seguro para chave de storage do Supabase (sem acentos/ç nem
// caracteres especiais — só [a-zA-Z0-9_-]). Sem isso, meses como "Março" geram
// chaves inválidas e o upload retorna 400 (Bad Request).
const safeKeyPart = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos (ç → c)
  .replace(/[\\/]/g, '-')
  .replace(/\s+/g, '_')
  .replace(/[^a-zA-Z0-9_-]/g, '');

// Mensagem padrão que a Alexa anuncia quando o Uniko spawna no Portal (o servidor
// faz o anúncio de verdade, vendo o spawnAt gravado em settings.capture_uniko_config —
// ver checkCaptureUnikoSpawn no crescent-hub-server). Editável na tela de evento/spawn.
const DEFAULT_CAPTURE_ALEXA_MSG = 'Atenção a todos, verifiquem o portal do colaborador! Tem uma surpresa por lá.';

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

// Slot de upload de UM frame da Oficina de Uniko — mostra o preview (ou um "+" vazio),
// deixa anexar/trocar/remover. Só o frame "principal" é obrigatório; os outros ficam
// em branco à vontade (o Uniko cai no frame principal pra essa ação).
const FrameUploadSlot = ({ label, hint, value, onFile, onClear, required }) => {
  const inputId = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 100 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textD, textAlign: 'center' }}>
        {label}{required && <span style={{ color: '#C04050' }}> *</span>}
      </div>
      <label htmlFor={inputId} style={{
        width: 84, height: 84, borderRadius: 14, border: `2px dashed ${T.border}`, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        background: value ? 'rgba(0,0,0,.15)' : 'transparent',
      }}>
        {value
          ? <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span style={{ fontSize: 22, color: T.textT, opacity: .6 }}>+</span>}
      </label>
      <input id={inputId} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; onFile(f); e.target.value = ''; }} />
      {value && <button onClick={onClear} style={{ fontSize: 10, color: '#C04050', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>remover</button>}
      <div style={{ fontSize: 9.5, color: T.textT, textAlign: 'center', lineHeight: 1.3 }}>{hint}</div>
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
  const inputBg  = isDark ? (T.surfaceSub||'rgba(255,255,255,0.06)') : (T.surface||'white');
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

  const delBancoHoras = async (id) => {
    if (!window.confirm('Excluir este registro permanentemente?')) return;
    await _supabase.from('banco_horas').delete().eq('id', id);
    await loadBancoHoras();
  };

  // ── Lançamento manual de horas pelo RH (para outro colaborador) ──
  const BANCO_FORM0 = {
    colaborador: '', data: new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}),
    descricao: '', hora_inicio: '', hora_fim: '', feriado_domingo: false,
    valor_hora: '', status: 'aprovado',
  };
  // filtros da aba Banco Extra
  const BANCO_FILTROS0 = { texto:'', status:'', ordem:'recentes' };
  const [bancoFiltros, setBancoFiltros] = useState(BANCO_FILTROS0);

  // seleção múltipla na tabela do Banco Extra
  const [bancoSel, setBancoSel] = useState([]);   // ids selecionados
  const [bancoLote, setBancoLote] = useState(false);
  const toggleBancoSel = (id) => setBancoSel(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

  // descrições longas: clicar na célula abre/fecha o texto inteiro
  const [bancoDescAberta, setBancoDescAberta] = useState([]);
  const toggleBancoDesc = (id) => setBancoDescAberta(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

  const aprovarSelecionados = async () => {
    if (bancoSel.length === 0) return;
    setBancoLote(true);
    await _supabase.from('banco_horas')
      .update({ status:'aprovado', updated_at:new Date().toISOString() })
      .in('id', bancoSel);
    setBancoSel([]);
    await loadBancoHoras();
    setBancoLote(false);
  };

  const [bancoModal, setBancoModal] = useState(false);
  const [bancoForm,  setBancoForm]  = useState(BANCO_FORM0);
  const [bancoSaving,setBancoSaving]= useState(false);
  const [bancoMsg,   setBancoMsg]   = useState('');

  const abrirBancoModal = () => {
    if (empList.length === 0) loadEmployees();
    setBancoForm(BANCO_FORM0); setBancoMsg(''); setBancoModal(true);
  };

  const lancarBancoHoras = async () => {
    const f = bancoForm;
    if (!f.colaborador)               { setBancoMsg('Selecione o colaborador'); return; }
    if (!f.descricao.trim())          { setBancoMsg('Informe a descrição / observação'); return; }
    if (!f.hora_inicio || !f.hora_fim){ setBancoMsg('Informe hora início e hora fim'); return; }
    const [h1,m1] = f.hora_inicio.split(':').map(Number);
    const [h2,m2] = f.hora_fim.split(':').map(Number);
    const total = Math.max(0, ((h2*60+m2) - (h1*60+m1)) / 60);
    if (total <= 0) { setBancoMsg('Hora fim deve ser maior que hora início'); return; }
    setBancoSaving(true); setBancoMsg('');
    const mult = f.feriado_domingo ? 2.0 : 1.5;
    const vH   = bancoValorHora > 0 ? bancoValorHora : null;
    const { error } = await _supabase.from('banco_horas').insert({
      created_by:       f.colaborador,
      data:             f.data,
      descricao:        f.descricao,
      hora_inicio:      f.hora_inicio,
      hora_fim:         f.hora_fim,
      total_horas:      total,
      feriado_domingo:  f.feriado_domingo,
      horas_calculadas: total * (f.feriado_domingo ? 2 : 1),
      valor_hora:       vH,
      valor_total:      vH ? total * vH * mult : null,
      status:           f.status,
    });
    setBancoSaving(false);
    if (error) { setBancoMsg('Erro: ' + error.message); return; }
    setBancoModal(false);
    await loadBancoHoras();
  };

  const [empSearch, setEmpSearch] = useState('');
  const [gerSearch, setGerSearch] = useState('');
  const [changePw, setChangePw] = useState({old:'',new1:'',new2:''});
  const [changePwMsg, setChangePwMsg] = useState('');

  // ── Spotify API ──────────────────────────────────────────
  const [spotifyClientId, setSpotifyClientId] = useState(() => localStorage.getItem('spotify_client_id') || '');
  const [spotifySecret, setSpotifySecret]     = useState(() => localStorage.getItem('spotify_client_secret') || '');
  const [spotifyMsg, setSpotifyMsg]           = useState('');
  const [spotifySaving, setSpotifySaving]     = useState(false);
  const [spotifyServerStatus, setSpotifyServerStatus] = useState(null); // null | {client_id, has_client_secret, has_refresh_token}

  // ── Feedback ──────────────────────────────────────────────
  const [fbList,      setFbList]      = useState([]);
  const [fbLoading,   setFbLoading]   = useState(false);
  const [fbCatFilter, setFbCatFilter] = useState('Todos');
  const [fbReadFilter,setFbReadFilter]= useState('Todos');
  const [fbExpanded,  setFbExpanded]  = useState(null);

  // ── Contracheques ─────────────────────────────────────────
  const [chList,       setChList]       = useState([]);
  const [chLoading,    setChLoading]    = useState(false);
  const [chForm,       setChForm]       = useState({ employee_name: '', competencia: '' });
  const [chFile,       setChFile]       = useState(null);
  const [chFileName,   setChFileName]   = useState('');
  const [chSaving,     setChSaving]     = useState(false);
  const [chMsg,        setChMsg]        = useState('');
  const [chEmpFilter,  setChEmpFilter]  = useState('');
  // ── Importação em lote (PDF com vários contracheques) ──
  const [chBatchFile,    setChBatchFile]    = useState(null);
  const [chBatchParsing, setChBatchParsing] = useState(false);
  const [chBatchSlips,   setChBatchSlips]   = useState(null); // null = nada analisado
  const [chBatchMsg,     setChBatchMsg]     = useState('');
  const [chBatchSending, setChBatchSending] = useState(false);
  const [chBatchDone,    setChBatchDone]    = useState(0);

  const loadSpotifyServerStatus = async () => {
    try {
      const r = await fetch(`${SERVER_URL}/api/spotify/credentials`, { headers: authHeader() });
      if (r.ok) setSpotifyServerStatus(await r.json());
    } catch {}
  };

  useEffect(() => { if (tab === 'spotify') loadSpotifyServerStatus(); }, [tab]);

  // ── Logs do servidor (PM2, VPS) ───────────────────────────
  const [logsData,    setLogsData]    = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr,     setLogsErr]     = useState('');
  const [logsStream,  setLogsStream]  = useState('error'); // 'error' | 'out'
  const [logsAuto,    setLogsAuto]    = useState(false);

  const loadLogs = async () => {
    setLogsLoading(true); setLogsErr('');
    try {
      const r = await fetch(`${SERVER_URL}/api/logs?lines=300`, { headers: authHeader() });
      const d = await r.json();
      if (r.ok) setLogsData(d);
      else setLogsErr(d.error || 'Erro ao buscar logs');
    } catch { setLogsErr('Servidor offline ou inacessível.'); }
    setLogsLoading(false);
  };

  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab]);
  useEffect(() => {
    if (tab !== 'logs' || !logsAuto) return;
    const id = setInterval(loadLogs, 5000);
    return () => clearInterval(id);
  }, [tab, logsAuto]);

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
  const [empForm, setEmpForm]         = useState({name:'',cpf:'',cargo:'',role:'employee'});
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
      const r = await fetch(url, { method:meth, headers: authHeader(), body: JSON.stringify({ name:empForm.name.trim(), cpf:cpfClean, cargo:empForm.cargo.trim(), role:empForm.role }) });
      const d = await r.json();
      if(!r.ok){ setEmpFormErr(d.error||'Erro ao salvar'); setEmpSaving(false); return; }
      await loadEmployees();
      setEmpModal(null); setEmpForm({name:'',cpf:'',cargo:'',role:'employee'});
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
  useEffect(()=>{ if(tab==='banco'){ loadBancoHoras(); if(empList.length===0) loadEmployees(); } }, [tab]); // eslint-disable-line

  // Lançamento manual — valor/hora sugerido = (salário base + 1K Service) ÷ 240
  const bancoEmp        = empList.find(e => e.name === bancoForm.colaborador);
  const bancoSalario    = Number(bancoEmp?.salary || 0) + Number(bancoEmp?.salary_1k || 0);
  const bancoValorHoraS = bancoSalario > 0 ? bancoSalario / 240 : 0;
  const bancoValorHora  = bancoForm.valor_hora !== '' ? (Number(String(bancoForm.valor_hora).replace(',', '.')) || 0) : bancoValorHoraS;
  // Trofeus e Capture o Uniko tambem precisam da lista de colaboradores (empList),
  // mas ninguem carrega ela se o admin nunca abriu a aba "Funcionarios" antes --
  // sem isso os selects dessas abas ficavam sempre vazios.
  useEffect(()=>{ if((tab==='trofeus'||tab==='capture') && empList.length===0) loadEmployees(); }, [tab]); // eslint-disable-line

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

  // ── Capture o Uniko (evento) ────────────────────────────
  // datetime-local <-> ISO. O input usa horário LOCAL; guardamos ISO no settings.
  const isoToLocal = (iso) => { if(!iso) return ''; const d=new Date(iso); if(isNaN(d)) return ''; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const localToIso = (loc) => { if(!loc) return ''; const d=new Date(loc); return isNaN(d)?'':d.toISOString(); };
  const [capCfg, setCapCfg]       = useState({ enabled:false, startAt:'', endAt:'', unikoId:'vampire-robot', maxWinners:3, alexaMessage:DEFAULT_CAPTURE_ALEXA_MSG });
  const [capMsg, setCapMsg]       = useState('');
  const [capSaving, setCapSaving] = useState(false);
  // Sub-aba da tab "Capture o Uniko": evento/spawn vs. Oficina de Uniko (criação) vs. Enviar
  const [captureSubTab, setCaptureSubTab] = useState('evento');

  // ── Enviar Uniko direto pra um colaborador (fora do sorteio do evento) ──
  const [giftTarget, setGiftTarget]   = useState('');
  const [giftUnikoId, setGiftUnikoId] = useState('vampire-robot');
  const [giftComum, setGiftComum]     = useState(100);
  const [giftPremium, setGiftPremium] = useState(100);
  const [giftSending, setGiftSending] = useState(false);
  const [giftMsg, setGiftMsg]         = useState('');
  const pickGiftUniko = (u) => { setGiftUnikoId(u.id); const rw = getCaptureReward(u); setGiftComum(rw.comum); setGiftPremium(rw.premium); };
  const sendUnikoGift = async () => {
    if (!giftTarget || giftSending) return;
    setGiftSending(true); setGiftMsg('');
    const u = getUniko(giftUnikoId);
    const res = await giftUnikoToPlayer(giftTarget, u, Number(giftComum) || 0, Number(giftPremium) || 0);
    setGiftSending(false);
    setGiftMsg(res.ok
      ? `✅ ${u.name} enviado pra ${giftTarget}!${res.alreadyHadUniko ? ' (já tinha o Uniko — só creditou os prismas)' : ''}`
      : '❌ Falha ao enviar — confira o console e tenta de novo.');
  };

  const loadCapCfg = async () => {
    const c = await loadCaptureConfig();
    if (c) setCapCfg({ enabled:!!c.enabled, startAt:isoToLocal(c.startAt), endAt:isoToLocal(c.endAt), unikoId:c.unikoId||'vampire-robot', maxWinners:c.maxWinners||3, alexaMessage:c.alexaMessage||DEFAULT_CAPTURE_ALEXA_MSG });
  };
  const saveCapCfg = async () => {
    if (capCfg.enabled && (!capCfg.startAt || !capCfg.endAt)) { setCapMsg('⚠️ Defina início e fim da janela'); return; }
    if (capCfg.enabled && localToIso(capCfg.endAt) <= localToIso(capCfg.startAt)) { setCapMsg('⚠️ O fim deve ser depois do início'); return; }
    setCapSaving(true); setCapMsg('');
    try {
      const startIso = localToIso(capCfg.startAt), endIso = localToIso(capCfg.endAt);
      // Momento DENTRO da janela, fixado agora → todos veem surgir no mesmo instante.
      // Não é uniforme: janela curta pesa a chance pro início, janela longa pesa pro
      // meio/fim (evita o azar de spawnar 5min depois de uma janela de horas).
      let spawnAt = startIso;
      if (capCfg.enabled && startIso && endIso) {
        spawnAt = pickSpawnAt(startIso, endIso);
      }
      await saveCaptureConfig({ enabled:capCfg.enabled, startAt:startIso, endAt:endIso, spawnAt, unikoId:capCfg.unikoId, maxWinners:Number(capCfg.maxWinners)||3, alexaMessage:capCfg.alexaMessage||DEFAULT_CAPTURE_ALEXA_MSG });
      setCapMsg('✅ Configuração salva!');
    } catch(e) { setCapMsg('❌ ' + (e.message||'Erro ao salvar')); }
    setCapSaving(false);
    setTimeout(()=>setCapMsg(''), 4000);
  };
  // Spawna AGORA: abre uma janela imediata (agora → +30min) com o uniko selecionado,
  // gerando um evento novo. O widget faz o Uniko surgir em segundos para quem está no Portal
  // — e o servidor (checkCaptureUnikoSpawn) faz a Alexa anunciar assim que o spawnAt chegar.
  const spawnNow = async () => {
    setCapSaving(true); setCapMsg('');
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 60 * 1000);      // janela de 30 min
      const spawnAt = new Date(now.getTime() + 6 * 1000);        // +6s: dá tempo de todos receberem e revelarem juntos
      const cfg = { enabled:true, startAt:now.toISOString(), endAt:end.toISOString(), spawnAt:spawnAt.toISOString(), unikoId:capCfg.unikoId || 'vampire-robot', maxWinners:Number(capCfg.maxWinners)||3, alexaMessage:capCfg.alexaMessage||DEFAULT_CAPTURE_ALEXA_MSG };
      await saveCaptureConfig(cfg);
      setCapCfg({ enabled:true, startAt:isoToLocal(cfg.startAt), endAt:isoToLocal(cfg.endAt), unikoId:cfg.unikoId, maxWinners:cfg.maxWinners, alexaMessage:cfg.alexaMessage });
      setCapMsg('✅ Uniko liberado! Vai surgir em segundos para quem estiver no Portal (e a Alexa avisa).');
    } catch (e) { setCapMsg('❌ ' + (e.message || 'Erro ao spawnar')); }
    setCapSaving(false);
    setTimeout(() => setCapMsg(''), 6000);
  };
  useEffect(() => { if (tab === 'capture') loadCapCfg(); }, [tab]);

  // ── Oficina de Uniko (criar Unikos personalizados, fora do roster fixo) ──
  const [oficinaLib, setOficinaLib]         = useState([]); // biblioteca (Unikos já criados)
  const [oficinaForm, setOficinaForm]       = useState({ name: '', tagline: '', accent: '#6C5CE7', rewardComum: 100, rewardPremium: 100, iconSize: 84 });
  const [oficinaFrames, setOficinaFrames]   = useState({ main: null, notif: null, alert: null, closed: null, capture: null, prismaComum: null, prismaPremium: null, alexa: null, wave: null, scene: null });
  const [oficinaSaving, setOficinaSaving]   = useState(false);
  const [oficinaMsg, setOficinaMsg]         = useState('');
  const [oficinaBlinkPreview, setOficinaBlinkPreview] = useState(false); // alterna aberto/fechado no preview
  const [oficinaEditingId, setOficinaEditingId] = useState(null); // null = criando novo; id = editando um já existente

  const loadOficinaLib = async () => { const list = await loadCustomUnikos(); setOficinaLib(list); };
  useEffect(() => { if (tab === 'capture') loadOficinaLib(); }, [tab]);

  // ── Editar prismas dos Unikos FIXOS do roster (vampire-robot, uniko-sereia) ──
  // CAPTURE_UNIKOS[id].reward é mutado em memória por loadRewardOverrides/saveRewardOverride
  // (ver captureUniko.js) — o tick força re-render pra pegar o valor atualizado.
  const [rewardTick, setRewardTick] = useState(0);
  const [rewardEdit, setRewardEdit] = useState({}); // id -> {comum, premium} (rascunho em edição)
  const [rewardSaving, setRewardSaving] = useState(null);
  useEffect(() => { if (tab === 'capture') loadRewardOverrides().then(() => setRewardTick(t => t + 1)); }, [tab]);
  // Vídeo de fundo por Uniko (aplica em memória; tick força re-render).
  const [bgVidUploading, setBgVidUploading] = useState(null); // uniko_id em upload
  const [bgVidMsg, setBgVidMsg] = useState('');
  useEffect(() => { if (tab === 'capture') loadUnikoBgVideos().then(() => setRewardTick(t => t + 1)); }, [tab]);
  const subirBgVideo = async (unikoId, file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { setBgVidMsg('Escolha um arquivo de vídeo.'); setTimeout(()=>setBgVidMsg(''),4000); return; }
    if (file.size > 80 * 1024 * 1024) { setBgVidMsg('Vídeo maior que 80MB.'); setTimeout(()=>setBgVidMsg(''),4000); return; }
    setBgVidUploading(unikoId); setBgVidMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${unikoId}-${Date.now()}-${rand}.${ext}`;
      const { error } = await _supabase.storage.from('uniko-videos').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = _supabase.storage.from('uniko-videos').getPublicUrl(path);
      await saveUnikoBgVideo(unikoId, data.publicUrl);
      setRewardTick(t => t + 1);
    } catch (e) { setBgVidMsg('Erro ao enviar: ' + (e.message || '')); setTimeout(()=>setBgVidMsg(''),5000); }
    setBgVidUploading(null);
  };
  const removerBgVideo = async (unikoId) => {
    setBgVidUploading(unikoId);
    try { await saveUnikoBgVideo(unikoId, ''); setRewardTick(t => t + 1); }
    catch (e) { setBgVidMsg('Erro ao remover: ' + (e.message || '')); setTimeout(()=>setBgVidMsg(''),5000); }
    setBgVidUploading(null);
  };

  // ── Oficina Uniko Wave: cria personagens pro jogo (roster/gacha/Guerra Estelar) ──
  const OW_SLOTS = [
    { k:'splash', label:'Splash art', req:true },
    { k:'passo1', label:'Passo 1', req:true }, { k:'passo2', label:'Passo 2' },
    { k:'passo3', label:'Passo 3' }, { k:'passo4', label:'Passo 4' }, { k:'passo5', label:'Passo 5 (opcional)' },
    { k:'atacar', label:'Atacar', req:true }, { k:'pular', label:'Pular', req:true }, { k:'segurar', label:'Segurar', req:true },
  ];
  const [owLista, setOwLista]     = useState([]);
  const [owForm, setOwForm]       = useState({ name:'', desc:'', color:'#ff00cc' });
  const [owImgs, setOwImgs]       = useState({}); // slot -> url
  const [owUploading, setOwUploading] = useState(null); // slot em upload
  const [owSaving, setOwSaving]   = useState(false);
  const [owMsg, setOwMsg]         = useState('');
  const owLoad = async () => {
    const { data } = await _supabase.from('uniko_wave_chars').select('*').order('created_at', { ascending:false });
    setOwLista(data || []);
  };
  useEffect(() => { if (tab === 'oficina-wave') owLoad(); }, [tab]);
  const owUpload = async (slot, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setOwMsg('Só imagens (PNG de preferência).'); setTimeout(()=>setOwMsg(''),4000); return; }
    if (file.size > 12 * 1024 * 1024) { setOwMsg('Imagem maior que 12MB.'); setTimeout(()=>setOwMsg(''),4000); return; }
    setOwUploading(slot); setOwMsg('');
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g,'') || 'png';
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${slot}-${Date.now()}-${rand}.${ext}`;
      const { error } = await _supabase.storage.from('uniko-wave-chars').upload(path, file, { contentType:file.type, upsert:false });
      if (error) throw error;
      const { data } = _supabase.storage.from('uniko-wave-chars').getPublicUrl(path);
      setOwImgs(m => ({ ...m, [slot]: data.publicUrl }));
    } catch (e) { setOwMsg('Erro ao enviar: ' + (e.message||'')); setTimeout(()=>setOwMsg(''),5000); }
    setOwUploading(null);
  };
  const owReset = () => { setOwForm({ name:'', desc:'', color:'#ff00cc' }); setOwImgs({}); };
  const owSalvar = async () => {
    if (!owForm.name.trim()) { setOwMsg('Dá um nome pra personagem.'); return; }
    const faltando = OW_SLOTS.filter(s => s.req && !owImgs[s.k]);
    if (faltando.length) { setOwMsg('Faltam imagens: ' + faltando.map(s=>s.label).join(', ')); return; }
    setOwSaving(true); setOwMsg('');
    try {
      const slug = (owForm.name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'oficina');
      const id = `${slug}-${Math.random().toString(36).slice(2,6)}`;
      const run_urls = ['passo1','passo2','passo3','passo4','passo5'].map(k=>owImgs[k]).filter(Boolean);
      const { error } = await _supabase.from('uniko_wave_chars').insert({
        id, name: owForm.name.trim(), desc: owForm.desc.trim() || null, color: owForm.color,
        splash_url: owImgs.splash, run_urls,
        atk_url: owImgs.atacar, jump_url: owImgs.pular, hold_url: owImgs.segurar,
        created_by: adminName || null,
      });
      if (error) throw error;
      owReset(); setOwMsg('Personagem criada! Já entra no gacha do Uniko Wave.');
      await owLoad();
    } catch (e) { setOwMsg('Erro ao salvar: ' + (e.message||'')); }
    setOwSaving(false);
    setTimeout(() => setOwMsg(''), 5000);
  };
  const owExcluir = async (c) => {
    if (!window.confirm(`Excluir a personagem "${c.name}" do Uniko Wave?`)) return;
    try { await _supabase.from('uniko_wave_chars').delete().eq('id', c.id); await owLoad(); }
    catch (e) { setOwMsg('Erro ao excluir: ' + (e.message||'')); setTimeout(()=>setOwMsg(''),5000); }
  };
  const salvarReward = async (id) => {
    const draft = rewardEdit[id];
    if (!draft) return;
    setRewardSaving(id);
    try {
      await saveRewardOverride(id, draft.comum, draft.premium);
      setRewardTick(t => t + 1);
      setRewardEdit(e => { const next = { ...e }; delete next[id]; return next; });
    } finally { setRewardSaving(null); }
  };
  // Preview piscando — só pra dar uma ideia de como fica animado (aberto/fechado a cada 2s).
  useEffect(() => { const id = setInterval(() => setOficinaBlinkPreview(v => !v), 2000); return () => clearInterval(id); }, []);

  // ── Máquina do Tempo: capa + vídeo da Mensagem Especial (Central Alexa) ──
  const [msgEsp, setMsgEsp]           = useState(MSG_ESPECIAL_FALLBACK);
  const [msgEspLoaded, setMsgEspLoaded] = useState(false);
  const [msgEspUploading, setMsgEspUploading] = useState(null); // 'cover' | 'video' | null
  const [msgEspSaving, setMsgEspSaving] = useState(false);
  const [msgEspMsg, setMsgEspMsg]     = useState('');
  useEffect(() => {
    if (tab === 'maquina' && !msgEspLoaded) loadMensagemEspecial().then(c => { setMsgEsp(c); setMsgEspLoaded(true); });
  }, [tab, msgEspLoaded]);
  // Sobe o arquivo (imagem OU vídeo) pro bucket 'mensagem-especial' e guarda a
  // URL no estado (só persiste de verdade no "Salvar"). Nome com timestamp +
  // aleatório pra o navegador/CDN nunca servir cache velho ao trocar a mídia.
  const msgEspUpload = async (kind, file) => {
    if (!file) return;
    const isVideo = kind === 'video';
    if (isVideo && !file.type.startsWith('video/')) { setMsgEspMsg('Escolha um arquivo de vídeo.'); return; }
    if (!isVideo && !file.type.startsWith('image/')) { setMsgEspMsg('Escolha um arquivo de imagem.'); return; }
    const LIMITE_MB = isVideo ? 80 : 12;
    if (file.size > LIMITE_MB * 1024 * 1024) { setMsgEspMsg(`Arquivo maior que ${LIMITE_MB}MB.`); return; }
    setMsgEspUploading(kind); setMsgEspMsg('');
    try {
      const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'png')).toLowerCase().replace(/[^a-z0-9]/g, '') || (isVideo ? 'mp4' : 'png');
      const rand = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${kind}-${Date.now()}-${rand}.${ext}`;
      const { error } = await _supabase.storage.from('mensagem-especial').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = _supabase.storage.from('mensagem-especial').getPublicUrl(path);
      setMsgEsp(m => ({ ...m, [isVideo ? 'videoUrl' : 'coverUrl']: data.publicUrl }));
    } catch (e) {
      setMsgEspMsg('Erro ao enviar: ' + (e.message || 'tente de novo'));
    }
    setMsgEspUploading(null);
  };
  const salvarMsgEsp = async () => {
    setMsgEspSaving(true); setMsgEspMsg('');
    try { await saveMensagemEspecial(msgEsp); setMsgEspMsg('Salvo! Já vale na Central Alexa.'); }
    catch (e) { setMsgEspMsg('Erro ao salvar: ' + (e.message || '')); }
    setMsgEspSaving(false);
    setTimeout(() => setMsgEspMsg(''), 4000);
  };

  // Lê um arquivo de imagem, redimensiona (máx. `maxSize`px no lado maior, mantém
  // transparência), SOBE pro Supabase Storage (bucket 'uniko-fotos') e devolve a
  // URL pública — mesma ideia do canvas 300x300 já usado pra foto de perfil. Era
  // 320 por padrão, mas algumas telas (ex.: card "Uniko x Alexa" com
  // SIZE_MULT_BY_SKIN) renderizam o frame principal bem maior que isso — 320px
  // upscalado ficava borrado/pixelado. Subiu pra 640 (mesmo valor já usado pro
  // cenário).
  // BUG CORRIGIDO (jul/2026): os 10 frames de cada Uniko personalizado eram
  // guardados como PNG base64 direto nas colunas de `custom_unikos` — a tabela
  // inteira (~26 Unikos) tinha que baixar por completo, como texto dentro do
  // JSON, ANTES de qualquer imagem aparecer (Capture o Uniko, Central Alexa,
  // Coleção...), sem cache de imagem nenhum. Agora vira upload real, com URL.
  // Precisa rodar supabase_fotos_storage.sql antes (cria o bucket + políticas).
  const frameFromFile = (file, maxSize = 640, key = 'frame') => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          let { width, height } = img;
          if (width >= height) { if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; } }
          else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
          const c = document.createElement('canvas'); c.width = width; c.height = height;
          c.getContext('2d').drawImage(img, 0, 0, width, height);
          c.toBlob(async (blob) => {
            if (!blob) { reject(new Error('toBlob falhou')); return; }
            const path = `custom/${key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
            const { error } = await _supabase.storage.from('uniko-fotos').upload(path, blob, { contentType: 'image/png', upsert: false });
            if (error) { reject(error); return; }
            const { data } = _supabase.storage.from('uniko-fotos').getPublicUrl(path);
            resolve(data.publicUrl);
          }, 'image/png');
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const handleFrameFile = async (key, file) => {
    if (!file) return;
    try { setOficinaFrames(f => ({ ...f, [key]: null })); const url = await frameFromFile(file, 640, key); setOficinaFrames(f => ({ ...f, [key]: url })); }
    catch (e) { console.error('[oficina-de-uniko] upload de frame falhou:', e); setOficinaMsg('❌ Não consegui subir essa imagem'); }
  };
  // Cenário: OPCIONAL. Se anexado, vira o fundo do Uniko no Capture o Uniko em vez da
  // cor gradiente padrão. Sem anexar nada, continua só a cor (nada muda).
  const handleSceneFile = async (file) => {
    if (!file) return;
    try { setOficinaFrames(f => ({ ...f, scene: null })); const url = await frameFromFile(file, 640, 'scene'); setOficinaFrames(f => ({ ...f, scene: url })); }
    catch (e) { console.error('[oficina-de-uniko] upload de cenário falhou:', e); setOficinaMsg('❌ Não consegui subir essa imagem'); }
  };
  const resetOficinaForm = () => {
    setOficinaEditingId(null);
    setOficinaForm({ name: '', tagline: '', accent: '#6C5CE7', rewardComum: 100, rewardPremium: 100, iconSize: 84 });
    setOficinaFrames({ main: null, notif: null, alert: null, closed: null, capture: null, prismaComum: null, prismaPremium: null, alexa: null, wave: null, scene: null });
  };
  // Carrega um Uniko já criado de volta no formulário — os frames vêm exatamente como
  // foram salvos (sem cair no principal), pra não "perder" um frame vazio ao reeditar.
  const editOficina = (id) => {
    const row = getCustomUnikoRaw(id);
    if (!row) return;
    setOficinaEditingId(id);
    setOficinaForm({
      name: row.name, tagline: row.tagline || '', accent: row.accent,
      rewardComum: row.reward_comum, rewardPremium: row.reward_premium, iconSize: row.icon_size || 84,
    });
    setOficinaFrames({
      main: row.img_main, notif: row.img_notif, alert: row.img_alert, closed: row.img_closed, capture: row.img_capture,
      prismaComum: row.img_prisma_comum, prismaPremium: row.img_prisma_premium, alexa: row.img_alexa, wave: row.img_wave,
      scene: row.img_scene,
    });
    setOficinaMsg('');
  };
  const saveOficina = async () => {
    if (!oficinaForm.name.trim()) { setOficinaMsg('⚠️ Dê um nome pro Uniko'); return; }
    if (!oficinaFrames.main) { setOficinaMsg('⚠️ O frame principal (estático) é obrigatório'); return; }
    setOficinaSaving(true); setOficinaMsg('');
    try {
      const raw = oficinaEditingId ? getCustomUnikoRaw(oficinaEditingId) : null;
      await saveCustomUniko({
        id: oficinaEditingId || undefined,
        name: oficinaForm.name.trim(), tagline: oficinaForm.tagline.trim(), accent: oficinaForm.accent,
        rewardComum: Number(oficinaForm.rewardComum) || 0, rewardPremium: Number(oficinaForm.rewardPremium) || 0,
        iconSize: Number(oficinaForm.iconSize) || 84,
        imgMain: oficinaFrames.main, imgNotif: oficinaFrames.notif, imgAlert: oficinaFrames.alert,
        imgClosed: oficinaFrames.closed, imgCapture: oficinaFrames.capture,
        imgPrismaComum: oficinaFrames.prismaComum, imgPrismaPremium: oficinaFrames.prismaPremium,
        imgAlexa: oficinaFrames.alexa, imgWave: oficinaFrames.wave,
        imgScene: oficinaFrames.scene,
        createdBy: raw?.created_by || getAuthUser()?.name, // edição mantém o criador original
      });
      setOficinaMsg(oficinaEditingId ? '✅ Alterações salvas!' : '✅ Uniko adicionado à Biblioteca!');
      resetOficinaForm();
      await loadOficinaLib();
    } catch (e) { setOficinaMsg('❌ ' + (e.message || 'Erro ao salvar')); }
    setOficinaSaving(false);
    setTimeout(() => setOficinaMsg(''), 5000);
  };
  const removeOficina = async (id, name) => {
    if (!window.confirm(`Remover "${name}" da Biblioteca? Isso não afeta quem já capturou esse Uniko antes.`)) return;
    try {
      await deleteCustomUniko(id); await loadOficinaLib();
      if (capCfg.unikoId === id) setCapCfg(c => ({ ...c, unikoId: 'vampire-robot' }));
      if (oficinaEditingId === id) resetOficinaForm();
    }
    catch (e) { setOficinaMsg('❌ ' + (e.message || 'Erro ao remover')); }
  };

  // ── Reset da coleção "Capture o Uniko" ──
  const [resetPlayer, setResetPlayer] = useState('');
  const [resetMsg, setResetMsg]       = useState('');
  const [resetting, setResetting]     = useState(false);
  const doReset = async (all) => {
    const who = all ? 'TODOS os usuários' : `"${resetPlayer.trim()}"`;
    if (!all && !resetPlayer.trim()) { setResetMsg('⚠️ Selecione o colaborador'); return; }
    if (!window.confirm(`Resetar a coleção do Capture o Uniko de ${who}? Eles poderão capturar novamente. Esta ação não pode ser desfeita.`)) return;
    setResetting(true); setResetMsg('');
    try {
      await resetCaptures(all ? {} : { player: resetPlayer.trim() });
      setResetMsg(`✅ Coleção resetada de ${who}.`);
      if (!all) setResetPlayer('');
    } catch (e) { setResetMsg('❌ ' + (e.message || 'Erro ao resetar')); }
    setResetting(false);
    setTimeout(() => setResetMsg(''), 6000);
  };

  // ── Lembretes & Alexa programada ────────────────────────
  const [lembretes, setLembretes]       = useState([]);
  const [lembLoading, setLembLoading]   = useState(false);
  const [lembModal, setLembModal]       = useState(null);
  const [lembForm, setLembForm]         = useState({title:'',message:'',time:'',date:'',type:'lembrete',repeat:'never',active:true,fanfare:false,sound:'fanfarra'});
  const [lembSaving, setLembSaving]     = useState(false);
  const [lembMsg, setLembMsg]           = useState('');
  const [alexaStatus, setAlexaStatus]   = useState(null);
  const [testingAlexa, setTestingAlexa] = useState(false);
  const [alexaCookieModal, setAlexaCookieModal] = useState(false);
  const [alexaCookieText, setAlexaCookieText]   = useState('');
  const [alexaCookieMsg, setAlexaCookieMsg]     = useState('');
  const [alexaCookieSaving, setAlexaCookieSaving] = useState(false);

  const loadLembretes = async () => {
    setLembLoading(true);
    try {
      const { data } = await _supabase.from('reminders')
        .select('*').neq('type', 'personal').order('created_at', { ascending: false });
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
      const { fanfare: _f, sound: _s, ...lembData } = lembForm;
      // aviso_urgente não é permitido no type check constraint da tabela reminders.
      // Guardamos como 'lembrete' com prefixo __urgent__ na mensagem para o scheduler identificar.
      const storedType    = lembData.type === 'aviso_urgente' ? 'lembrete' : lembData.type;
      const storedMessage = lembData.type === 'aviso_urgente' ? '__urgent__' + (lembData.message || '') : lembData.message;
      const payload = { ...lembData, type: storedType, message: storedMessage, created_by: auth?.name || 'Admin', updated_at: new Date().toISOString() };
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

  // Cola o JSON gerado pelo setup-alexa.js direto no Supabase via servidor —
  // evita ter que entrar no VPS/editar .env toda vez que o token expira.
  const updateAlexaCookies = async () => {
    const text = alexaCookieText.trim();
    if (!text) { setAlexaCookieMsg('Cole o JSON gerado pelo setup-alexa.js'); return; }
    setAlexaCookieSaving(true); setAlexaCookieMsg('');
    try {
      const r = await fetch(`${SERVER_URL}/api/alexa/update-registration`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify({ data: text }),
      });
      const d = await r.json();
      if (!r.ok) { setAlexaCookieMsg(`❌ ${d.error}`); setAlexaCookieSaving(false); return; }
      setAlexaCookieMsg('✅ Cookies salvos! Verificando conexão...');
      setAlexaCookieText('');
      // Dá um tempo pro servidor reconectar antes de checar o status de novo.
      setTimeout(async () => { await checkAlexaStatus(); }, 3000);
      setTimeout(() => { setAlexaCookieModal(false); setAlexaCookieMsg(''); }, 3500);
    } catch (e) { setAlexaCookieMsg(`❌ ${e.message}`); }
    setAlexaCookieSaving(false);
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

  // ── Feedback: funções ─────────────────────────────────────
  const loadFeedbacks = async () => {
    setFbLoading(true);
    const { data } = await _supabase.from('feedbacks').select('*').order('created_at', { ascending: false });
    setFbList(data || []);
    setFbLoading(false);
  };

  const markFbRead = async (id, current) => {
    await _supabase.from('feedbacks').update({ read: !current }).eq('id', id);
    setFbList(prev => prev.map(f => f.id === id ? { ...f, read: !current } : f));
  };

  const deleteFb = async (id) => {
    if (!window.confirm('Remover este feedback permanentemente?')) return;
    await _supabase.from('feedbacks').delete().eq('id', id);
    setFbList(prev => prev.filter(f => f.id !== id));
  };

  useEffect(() => { if (tab === 'feedback') loadFeedbacks(); }, [tab]);

  // ── Solicitações de justificativa do ponto (do colaborador) ──
  const [solics, setSolics]       = useState([]);
  const [solicLoading, setSolicLoading] = useState(false);
  const [solicFilter, setSolicFilter]   = useState('pendente'); // pendente | todos
  const loadSolics = async () => {
    setSolicLoading(true);
    const { data } = await _supabase.from('ponto_solicitacoes').select('*').order('created_at', { ascending: false });
    setSolics(data || []);
    setSolicLoading(false);
  };
  const setSolicStatus = async (id, status) => {
    await _supabase.from('ponto_solicitacoes').update({ status }).eq('id', id);
    setSolics(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };
  // ACEITAR: abona o dia no ponto (cria a justificativa) e marca resolvido → a hora
  // negativa some no banco do colaborador e a solicitação some pra ele.
  const aceitarSolic = async (s) => {
    const dia = s.data_ref;
    const pid = s.ponto_cpf || s.cpf;
    if (!dia || !pid) { setSolicStatus(s.id, 'resolvido'); return; }
    try {
      await _supabase.from('ponto_justificativas').upsert({
        cpf: pid, data: dia, texto: s.titulo + (s.descricao ? ' — ' + s.descricao : ''),
        abonado: true, autor: adminName, updated_at: new Date().toISOString(),
      }, { onConflict: 'cpf,data' });
    } catch {}
    await _supabase.from('ponto_solicitacoes').update({ status: 'resolvido' }).eq('id', s.id);
    setSolics(prev => prev.map(x => x.id === s.id ? { ...x, status: 'resolvido' } : x));
  };
  const delSolic = async (id) => {
    if (!window.confirm('Excluir esta solicitação?')) return;
    await _supabase.from('ponto_solicitacoes').delete().eq('id', id);
    setSolics(prev => prev.filter(s => s.id !== id));
  };
  useEffect(() => { if (tab === 'justificativas') loadSolics(); }, [tab]);

  // ── Vínculo Portal ↔ Ponto (PIS) ──
  const [vincFuncs, setVincFuncs] = useState([]);   // ponto_funcionarios (nome + PIS)
  const [vincMap, setVincMap]     = useState({});    // portal_cpf → ponto_id
  const [vincLoading, setVincLoading] = useState(false);
  const [vincSearch, setVincSearch]   = useState('');
  const loadVinculo = async () => {
    setVincLoading(true);
    try {
      if (empList.length === 0) await loadEmployees();
      const [{ data: funcs }, { data: vinc }] = await Promise.all([
        _supabase.from('ponto_funcionarios').select('cpf,nome,excluido'),
        _supabase.from('ponto_vinculo').select('portal_cpf,ponto_id'),
      ]);
      setVincFuncs((funcs || []).filter(f => !f.excluido && f.cpf));
      const m = {}; (vinc || []).forEach(v => { m[v.portal_cpf] = v.ponto_id; });
      setVincMap(m);
    } catch {}
    setVincLoading(false);
  };
  const saveVinculo = async (emp, pontoId) => {
    const portal_cpf = (emp.cpf || '').replace(/\D/g, '');
    if (!portal_cpf) return;
    if (!pontoId) {
      await _supabase.from('ponto_vinculo').delete().eq('portal_cpf', portal_cpf);
      setVincMap(prev => { const n = { ...prev }; delete n[portal_cpf]; return n; });
      return;
    }
    const nome = vincFuncs.find(f => f.cpf === pontoId)?.nome || '';
    await _supabase.from('ponto_vinculo').upsert({ portal_cpf, ponto_id: pontoId, ponto_nome: nome, updated_at: new Date().toISOString() }, { onConflict: 'portal_cpf' });
    setVincMap(prev => ({ ...prev, [portal_cpf]: pontoId }));
  };
  useEffect(() => { if (tab === 'vinculo') loadVinculo(); }, [tab]);

  // ── Contracheques: funções ────────────────────────────────
  const loadContracheques = async () => {
    setChLoading(true);
    const { data } = await _supabase.from('contracheques').select('*').order('created_at', { ascending: false });
    setChList(data || []);
    setChLoading(false);
  };

  const uploadContracheque = async () => {
    if (!chForm.employee_name || !chForm.competencia || !chFile) {
      setChMsg('⚠️ Selecione o funcionário, competência e o arquivo PDF');
      setTimeout(() => setChMsg(''), 4000);
      return;
    }
    setChSaving(true); setChMsg('');
    try {
      const safeName = safeKeyPart(chForm.employee_name);
      const safeComp = safeKeyPart(chForm.competencia);
      const filePath = `${safeName}/${safeComp}_${Date.now()}.pdf`;

      const { error: upErr } = await _supabase.storage
        .from('contracheques')
        .upload(filePath, chFile, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw new Error('Erro no upload: ' + upErr.message);

      const { data: urlData } = _supabase.storage.from('contracheques').getPublicUrl(filePath);

      const { error: insErr } = await _supabase.from('contracheques').insert({
        employee_name: chForm.employee_name,
        competencia:   chForm.competencia,
        file_url:      urlData.publicUrl,
        created_at:    new Date().toISOString(),
      });
      if (insErr) throw new Error('Erro ao salvar: ' + insErr.message);

      setChMsg('✅ Contracheque anexado com sucesso!');
      setChForm({ employee_name: '', competencia: '' });
      setChFile(null); setChFileName('');
      await loadContracheques();
    } catch (e) { setChMsg('❌ ' + (e.message || 'Tente novamente')); }
    setChSaving(false);
    setTimeout(() => setChMsg(''), 6000);
  };

  const deleteContracheque = async (id) => {
    if (!window.confirm('Remover este contracheque permanentemente?')) return;
    await _supabase.from('contracheques').delete().eq('id', id);
    await loadContracheques();
  };

  /* ── Importação em lote: tenta casar cada recibo com um funcionário ── */
  const matchEmployee = (slip, emps) => {
    const cpf = onlyDigits(slip.cpf);
    if (cpf) {
      const byCpf = emps.find(e => onlyDigits(e.cpf) === cpf);
      if (byCpf) return byCpf;
    }
    const nm = normName(slip.name);
    if (nm) {
      const exact = emps.find(e => normName(e.name) === nm);
      if (exact) return exact;
      // tolera nome parcial (um contém o outro)
      const part = emps.find(e => {
        const en = normName(e.name);
        return en && (en.includes(nm) || nm.includes(en));
      });
      if (part) return part;
    }
    return null;
  };

  const parseBatch = async (file) => {
    setChBatchParsing(true); setChBatchMsg(''); setChBatchSlips(null); setChBatchDone(0);
    try {
      // garante a lista de funcionários (não depende do estado, que é assíncrono)
      let emps = empList;
      if (emps.length === 0) {
        try {
          const r = await fetch(`${SERVER_URL}/api/employees`, { headers: authHeader() });
          emps = (await r.json()).employees || [];
          setEmpList(emps);
        } catch { emps = []; }
      }
      const slips = await splitContrachequesPDF(file);
      if (!slips.length) { setChBatchMsg('❌ Nenhum contracheque detectado no PDF.'); setChBatchParsing(false); return; }
      const rows = slips.map((s, i) => {
        const emp = matchEmployee(s, emps);
        return {
          id: i,
          page: s.page,
          detectedName: s.name || '(nome não lido)',
          cpf: s.cpf || '',
          competencia: s.competencia || '',
          bytes: s.bytes,
          employee_name: emp ? emp.name : '',   // vazio = precisa escolher manualmente
          auto: !!emp,
          status: 'pending',
        };
      });
      setChBatchSlips(rows);
    } catch (e) {
      setChBatchMsg('❌ Erro ao analisar o PDF: ' + (e.message || e));
    }
    setChBatchParsing(false);
  };

  const setBatchRow = (id, patch) =>
    setChBatchSlips(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));

  const sendBatch = async () => {
    const rows = (chBatchSlips || []).filter(r => r.employee_name && r.competencia);
    if (!rows.length) { setChBatchMsg('⚠️ Nenhum contracheque pronto para envio (verifique funcionário e competência).'); return; }
    setChBatchSending(true); setChBatchMsg(''); setChBatchDone(0);
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        setBatchRow(r.id, { status: 'sending' });
        const safeName = safeKeyPart(r.employee_name);
        const safeComp = safeKeyPart(r.competencia);
        const filePath = `${safeName}/${safeComp}_${Date.now()}_${r.id}.pdf`;
        const blob = new Blob([r.bytes], { type: 'application/pdf' });
        const { error: upErr } = await _supabase.storage
          .from('contracheques')
          .upload(filePath, blob, { contentType: 'application/pdf', upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = _supabase.storage.from('contracheques').getPublicUrl(filePath);
        const { error: insErr } = await _supabase.from('contracheques').insert({
          employee_name: r.employee_name,
          competencia:   r.competencia,
          file_url:      urlData.publicUrl,
          created_at:    new Date().toISOString(),
        });
        if (insErr) throw new Error(insErr.message);
        ok++; setBatchRow(r.id, { status: 'done' });
      } catch (e) {
        fail++; setBatchRow(r.id, { status: 'error', errMsg: e.message });
      }
      setChBatchDone(d => d + 1);
    }
    setChBatchMsg(`✅ ${ok} enviado(s)${fail ? ` · ❌ ${fail} com erro` : ''}.`);
    setChBatchSending(false);
    await loadContracheques();
  };

  const resetBatch = () => {
    setChBatchFile(null); setChBatchSlips(null); setChBatchMsg(''); setChBatchDone(0);
  };

  useEffect(() => {
    if (tab === 'contracheques') {
      loadContracheques();
      if (empList.length === 0) loadEmployees();
    }
  }, [tab]);

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
    {id:'contracheques',  label:'Contracheques',      icon:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></>},
    {id:'feedback',       label:'Feedback',           icon:<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></>},
    {id:'banco',          label:'Banco Extra',        icon:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/><line x1="19" y1="5" x2="22" y2="5"/><line x1="22" y1="3" x2="22" y2="7"/></>},
    {id:'justificativas', label:'Justificativas Ponto', icon:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></>},
    {id:'vinculo',        label:'Vínculo Ponto',       icon:<><path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 6"/><path d="M14 11a5 5 0 00-7.07 0L5.5 12.4a5 5 0 007.07 7.07L14 18"/></>},
    {id:'calendario',     label:'Calendário',         icon:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>},
    {id:'comunicados',    label:'Comunicados',         icon:<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>},
    {id:'uniko_ia',       label:'Perguntas do UNIKO',  icon:<><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8z"/></>},
    {id:'lembretes',      label:'Lembretes & Alexa',  icon:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>},
    {id:'maquina',        label:'Máquina do Tempo',   icon:<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 15.5"/></>},
    {id:'capture',        label:'Capture o Uniko',     icon:<><circle cx="11" cy="11" r="8"/><line x1="11" y1="3" x2="11" y2="19"/><line x1="3" y1="11" x2="19" y2="11"/><circle cx="11" cy="11" r="2.5" fill="currentColor"/></>},
    {id:'oficina-wave',   label:'Oficina Uniko Wave',  icon:<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>},
    {id:'perfis',         label:'Perfis',             icon:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>},
    {id:'trofeus',        label:'Troféus',            icon:<><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>},
    {id:'config',         label:'Configurações',      icon:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>},
    {id:'spotify',        label:'API do Spotify',     icon:<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>},
    {id:'logs',           label:'Logs do Servidor',   icon:<><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>},
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
                <button onClick={()=>{ setEmpForm({name:'',cpf:'',cargo:'',role:'employee'}); setEmpFormErr(''); setEmpModal('new'); }}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  + Novo Funcionário
                </button>
              </div>

              {/* Busca */}
              <div style={{position:'relative'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={empSearch} onChange={e=>setEmpSearch(e.target.value)}
                  placeholder="Buscar por nome ou CPF..."
                  style={{width:'100%',padding:'10px 14px 10px 36px',borderRadius:11,border:`1.5px solid ${T.border}`,background:cardBg,fontSize:13,color:T.text,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
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
                  : empList.filter(e=>e.name.toLowerCase().includes(empSearch.toLowerCase())||e.cpf.includes(empSearch)).length===0
                    ? <div style={{padding:'32px',textAlign:'center',color:T.textT,fontSize:13}}>Nenhum resultado encontrado.</div>
                    : empList.filter(e=>e.name.toLowerCase().includes(empSearch.toLowerCase())||e.cpf.includes(empSearch)).map((emp,i)=>(
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
                          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                            {emp.cargo&&<span style={{fontSize:11,color:T.textS,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.cargo}</span>}
                            <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:5,
                              background:emp.role==='admin'?`${T.gold}18`:'rgba(0,0,0,0.04)',
                              color:emp.role==='admin'?T.gold:T.textD}}>
                              {emp.role==='admin'?'Admin':'Colaborador'}
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
                            <button onClick={()=>{ setEmpForm({name:emp.name,cpf:emp.cpf,cargo:emp.cargo||'',role:emp.role}); setEmpFormErr(''); setEmpModal(emp); }}
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
                    {/* Cargo real */}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>Cargo / Função</div>
                      <input value={empForm.cargo} onChange={e=>setEmpForm(f=>({...f,cargo:e.target.value}))}
                        list="cargo-suggestions" placeholder="Ex: Auxiliar Administrativo"
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                      <datalist id="cargo-suggestions">
                        <option value="Auxiliar Administrativo"/>
                        <option value="Auxiliar Financeiro"/>
                        <option value="Assistente Administrativo"/>
                        <option value="Analista Financeiro"/>
                        <option value="Suporte Técnico / Telemetria"/>
                        <option value="Suporte Técnico"/>
                        <option value="MEI"/>
                      </datalist>
                    </div>
                    {/* Nível de acesso ao sistema */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.textS,marginBottom:5}}>Nível de Acesso</div>
                      <select value={empForm.role} onChange={e=>setEmpForm(f=>({...f,role:e.target.value}))}
                        style={{width:'100%',padding:'10px 14px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',fontFamily:'var(--font-body)'}}>
                        <option value="employee">Colaborador (acesso ao portal)</option>
                        <option value="admin">Administrador (dashboard RH + ponto)</option>
                      </select>
                      <div style={{fontSize:11,color:T.textD,marginTop:4}}>⚠️ Somente Administrador acessa o dashboard RH e o ponto eletrônico.</div>
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
              {/* Busca */}
              <div style={{position:'relative'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={gerSearch} onChange={e=>setGerSearch(e.target.value)}
                  placeholder="Buscar por nome ou CPF..."
                  style={{width:'100%',padding:'10px 14px 10px 36px',borderRadius:11,border:`1.5px solid ${T.border}`,background:cardBg,fontSize:13,color:T.text,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
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
                  : gerList.filter(e=>e.name.toLowerCase().includes(gerSearch.toLowerCase())||(e.cpf||'').includes(gerSearch)).map((emp,i)=>(
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
            const F  = bancoFiltros;
            const setF = (k,v)=>setBancoFiltros(p=>({...p,[k]:v}));

            // ── aplica os filtros ──
            const q = F.texto.trim().toLowerCase();
            const lista = bancoHoras.filter(b=>{
              if(q && !`${b.created_by||''} ${b.descricao||''}`.toLowerCase().includes(q)) return false;
              if(F.status && b.status!==F.status) return false;
              return true;
            }).sort((a,b)=>{
              if(F.ordem==='az') return (a.created_by||'').localeCompare(b.created_by||'','pt-BR');
              if(F.ordem==='za') return (b.created_by||'').localeCompare(a.created_by||'','pt-BR');
              return 0; // 'recentes' — já vem ordenado por created_at desc do banco
            });
            const filtrosAtivos = F.texto!=='' || F.status!=='' || F.ordem!=='recentes';

            // ── seleção ──
            const selRows   = lista.filter(b=>bancoSel.includes(b.id));
            const selPend   = selRows.filter(b=>b.status!=='aprovado');
            // aprovado = já pago, então não entra no total a pagar
            const selValor  = selPend.reduce((a,b)=>a+Number(b.valor_total||0),0);
            const selHoras  = selPend.reduce((a,b)=>a+Number(b.horas_calculadas||0),0);
            const selNomes  = [...new Set(selPend.map(b=>b.created_by).filter(Boolean))];
            const todosSel  = lista.length>0 && lista.every(b=>bancoSel.includes(b.id));
            const toggleTodos = () => setBancoSel(todosSel ? [] : lista.map(b=>b.id));

            const pendentes  = lista.filter(b=>b.status==='pendente');
            const aprovados  = lista.filter(b=>b.status==='aprovado');
            const rejeitados = lista.filter(b=>b.status==='rejeitado');
            const totalHorasAprov = aprovados.reduce((a,b)=>a+Number(b.horas_calculadas||0),0);
            const totalValorAprov = aprovados.reduce((a,b)=>a+Number(b.valor_total||0),0);
            const totalValorPend  = pendentes.reduce((a,b)=>a+Number(b.valor_total||0),0);
            return (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Banco de Horas</div>
                    <div style={{fontSize:13,color:T.textS,marginTop:2}}>Registros enviados pelos colaboradores · {bancoHoras.length} no total</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <button onClick={abrirBancoModal}
                      style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.blue},${T.blueL})`,color:'#fff',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Lançar horas
                    </button>
                    <Moon size={24} color={T.goldL} opacity={0.35} float/>
                  </div>
                </div>

                {/* cards de resumo */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
                  {[
                    {k:'pend', l:'Pendentes',   v:pendentes.length,  c:'#D89030', sub:totalValorPend>0?BRL(totalValorPend):null},
                    {k:'apro', l:'Aprovados',   v:aprovados.length,  c:'#1A9C70', sub:totalValorAprov>0?`${BRL(totalValorAprov)} pagos`:null},
                    {k:'reje', l:'Rejeitados',  v:rejeitados.length, c:'#C04050'},
                    {k:'horas',l:'Horas aprovadas', v:fmtH(totalHorasAprov), c:T.blue||'#2A6FB5'},
                    {k:'pagar',l:'Falta pagar', v:BRL(totalValorPend), c:totalValorPend>0?'#D89030':'#1A9C70', sub:'Soma dos pendentes', small:true},
                  ].map(({k,l,v,c,sub,small})=>(
                    <Card key={k} style={{padding:'16px 20px'}} elevated>
                      <div style={{fontSize:small?21:26,fontWeight:700,color:c}}>{v}</div>
                      <div style={{fontSize:12,color:T.textT,marginTop:3}}>{l}</div>
                      {sub&&<div style={{fontSize:11,color:small?T.textD:c,marginTop:2,fontWeight:small?400:600}}>{sub}</div>}
                    </Card>
                  ))}
                </div>

                {/* ── RESUMO DA SELEÇÃO ── */}
                {selRows.length>0&&(
                  <Card style={{padding:'14px 20px',border:'1px solid rgba(78,143,168,0.35)',background:'rgba(78,143,168,0.07)'}} elevated>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:22,flexWrap:'wrap'}}>
                        <div>
                          <div style={{fontSize:11,color:T.textD,marginBottom:2}}>Selecionados</div>
                          <div style={{fontSize:19,fontWeight:700,color:T.text}}>{selRows.length}</div>
                          {selRows.length-selPend.length>0&&(
                            <div style={{fontSize:10.5,color:'#1A9C70',marginTop:1}}>{selRows.length-selPend.length} já pago{selRows.length-selPend.length===1?'':'s'}</div>
                          )}
                        </div>
                        <div>
                          <div style={{fontSize:11,color:T.textD,marginBottom:2}}>Horas a pagar</div>
                          <div style={{fontSize:19,fontWeight:700,color:T.blue||'#2A6FB5'}}>{fmtH(selHoras)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:T.textD,marginBottom:2}}>
                            Total a pagar{selNomes.length===1?` — ${selNomes[0]}`:selNomes.length>1?` — ${selNomes.length} pessoas`:''}
                          </div>
                          <div style={{fontSize:22,fontWeight:700,color:'#1A9C70'}}>{BRL(selValor)}</div>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <button onClick={()=>setBancoSel([])}
                          style={{padding:'8px 14px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:12.5,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                          Limpar seleção
                        </button>
                        <button onClick={aprovarSelecionados} disabled={bancoLote||selPend.length===0}
                          style={{display:'inline-flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:9,border:'none',cursor:(bancoLote||selPend.length===0)?'not-allowed':'pointer',background:selPend.length===0?'rgba(0,0,0,0.10)':'linear-gradient(135deg,#1A9C70,#28BA88)',color:selPend.length===0?T.textD:'#fff',fontWeight:700,fontSize:12.5,fontFamily:'var(--font-body)',outline:'none'}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {bancoLote ? 'Aprovando...' : selPend.length===0 ? 'Já aprovados' : `Aprovar ${selPend.length} selecionado${selPend.length===1?'':'s'}`}
                        </button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* ── FILTROS ── */}
                {(()=>{
                  const inSt = {padding:'7px 10px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:12.5,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)',width:'100%'};
                  const lbSt = {fontSize:10.5,fontWeight:600,color:T.textD,letterSpacing:'.05em',textTransform:'uppercase',marginBottom:4};
                  return (
                    <Card style={{padding:'16px 20px',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                          <span style={{fontSize:13,fontWeight:600,color:T.text}}>Filtros</span>
                          <span style={{fontSize:11.5,color:T.textT}}>{lista.length} de {bancoHoras.length} registro{bancoHoras.length===1?'':'s'}</span>
                        </div>
                        {filtrosAtivos&&(
                          <button onClick={()=>setBancoFiltros(BANCO_FILTROS0)}
                            style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:11.5,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Limpar filtros
                          </button>
                        )}
                      </div>

                      <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 1fr',gap:10}}>
                        <div>
                          <div style={lbSt}>Buscar (colaborador ou descrição)</div>
                          <input value={F.texto} onChange={e=>setF('texto',e.target.value)} placeholder="Ex: plantão, relatório, Maria..." style={inSt}/>
                        </div>
                        <div>
                          <div style={lbSt}>Status</div>
                          <select value={F.status} onChange={e=>setF('status',e.target.value)} style={inSt}>
                            <option value="">Todos</option>
                            <option value="pendente">Pendente</option>
                            <option value="aprovado">Aprovado</option>
                            <option value="rejeitado">Rejeitado</option>
                          </select>
                        </div>
                        <div>
                          <div style={lbSt}>Ordenar por</div>
                          <select value={F.ordem} onChange={e=>setF('ordem',e.target.value)} style={inSt}>
                            <option value="recentes">Mais recentes</option>
                            <option value="az">Colaborador A → Z</option>
                            <option value="za">Colaborador Z → A</option>
                          </select>
                        </div>
                      </div>
                    </Card>
                  );
                })()}

                {/* tabela */}
                <Card style={{padding:0,overflow:'hidden',background:cardBg,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)'}} elevated>
                  {bancoLoading
                    ? <div style={{textAlign:'center',padding:48,color:T.textT}}>Carregando...</div>
                    : lista.length===0
                      ? <div style={{textAlign:'center',padding:48,color:T.textT,fontSize:13}}>
                          {bancoHoras.length===0 ? 'Nenhum registro ainda.' : 'Nenhum registro corresponde aos filtros.'}
                        </div>
                      : <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'var(--font-body)',minWidth:900}}>
                            <thead><tr style={{background:T.surfaceSub||'rgba(0,0,0,0.025)'}}>
                              <th style={{padding:'10px 0 10px 14px',width:34}}>
                                <div onClick={toggleTodos} title={todosSel?'Desmarcar todos':'Selecionar todos'}
                                  style={{width:17,height:17,borderRadius:'50%',border:`2px solid ${todosSel?(T.blue||'#2A6FB5'):T.border}`,background:todosSel?(T.blue||'#2A6FB5'):'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                  {todosSel&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                              </th>
                              {['Colaborador','Data','Descrição','Horário','Horas','Cálculo','Valor','Status','Ações'].map(h=>(
                                <th key={h} style={{textAlign:'left',fontSize:11,color:T.textD,fontWeight:600,letterSpacing:'.07em',textTransform:'uppercase',padding:'10px 14px',whiteSpace:'nowrap'}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {lista.map(b=>{
                                const ss = b.status==='pendente'
                                  ? {bg:'rgba(216,144,48,0.15)',c:'#D89030'}
                                  : b.status==='aprovado'
                                    ? {bg:'rgba(26,156,112,0.12)',c:'#1A9C70'}
                                    : {bg:'rgba(192,64,80,0.12)',c:'#C04050'};
                                const emAcao = bancoAcaoId===b.id;
                                const sel = bancoSel.includes(b.id);
                                return (
                                  <tr key={b.id} style={{borderTop:`1px solid ${T.border}`,background:sel?'rgba(78,143,168,0.07)':'transparent'}}>
                                    <td style={{padding:'11px 0 11px 14px',width:34}}>
                                      <div onClick={()=>toggleBancoSel(b.id)}
                                        style={{width:17,height:17,borderRadius:'50%',border:`2px solid ${sel?(T.blue||'#2A6FB5'):T.border}`,background:sel?(T.blue||'#2A6FB5'):'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                                        {sel&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                      </div>
                                    </td>
                                    <td style={{padding:'11px 14px',fontSize:13,fontWeight:600,color:T.text,whiteSpace:'nowrap'}}>{b.created_by}</td>
                                    <td style={{padding:'11px 14px',fontSize:12,color:T.textS,whiteSpace:'nowrap'}}>{fmtD(b.data)}</td>
                                    {(()=>{
                                      const aberta = bancoDescAberta.includes(b.id);
                                      const longa  = (b.descricao||'').length > 34;
                                      return (
                                        <td onClick={()=>longa&&toggleBancoDesc(b.id)}
                                          title={longa ? (aberta?'Clique para recolher':'Clique para ver a descrição completa') : undefined}
                                          style={{padding:'11px 14px',fontSize:12,color:T.text,maxWidth:aberta?360:200,cursor:longa?'pointer':'default',verticalAlign:'top'}}>
                                          <div style={aberta
                                            ? {whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:1.5}
                                            : {overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                            {b.descricao}
                                          </div>
                                          {longa&&(
                                            <div style={{fontSize:10.5,color:T.blue||'#2A6FB5',marginTop:3,fontWeight:600}}>
                                              {aberta?'ver menos':'ver mais'}
                                            </div>
                                          )}
                                        </td>
                                      );
                                    })()}
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
                                      <div style={{display:'flex',gap:5,alignItems:'center'}}>
                                        {b.status==='pendente'&&<>
                                          <button onClick={()=>atualizarStatus(b.id,'aprovado')} disabled={emAcao}
                                            style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(26,156,112,0.3)',background:'rgba(26,156,112,0.10)',color:'#1A9C70',cursor:emAcao?'wait':'pointer',fontSize:11,outline:'none',fontWeight:600}}>
                                            {emAcao?'...':'Aprovar'}
                                          </button>
                                          <button onClick={()=>atualizarStatus(b.id,'rejeitado')} disabled={emAcao}
                                            style={{padding:'4px 10px',borderRadius:6,border:'1px solid rgba(192,64,80,0.3)',background:'rgba(192,64,80,0.08)',color:'#C04050',cursor:emAcao?'wait':'pointer',fontSize:11,outline:'none'}}>
                                            {emAcao?'...':'Recusar'}
                                          </button>
                                        </>}
                                        <button onClick={()=>delBancoHoras(b.id)} title="Excluir"
                                          style={{width:26,height:26,borderRadius:6,border:'1px solid rgba(192,64,80,0.25)',background:'rgba(192,64,80,0.06)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#C04050',outline:'none',flexShrink:0}}>
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                  }
                </Card>

                {/* ── MODAL: lançar horas para outro colaborador ── */}
                {bancoModal&&(()=>{
                  const f = bancoForm;
                  const set = (k,v) => setBancoForm(p=>({...p,[k]:v}));
                  const inputSt = {width:'100%',padding:'9px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'};
                  const labelSt = {fontSize:12,fontWeight:600,color:T.textS,marginBottom:4};
                  const h1m1 = (f.hora_inicio||'').split(':').map(Number);
                  const h2m2 = (f.hora_fim||'').split(':').map(Number);
                  const pvTotal = (f.hora_inicio&&f.hora_fim) ? Math.max(0,((h2m2[0]*60+h2m2[1])-(h1m1[0]*60+h1m1[1]))/60) : 0;
                  const pvCalc  = pvTotal * (f.feriado_domingo?2:1);
                  const pvMult  = f.feriado_domingo?2.0:1.5;
                  const pvValor = bancoValorHora>0 ? pvTotal*bancoValorHora*pvMult : null;
                  return (
                    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                      <div style={{background:T.surface||'white',borderRadius:20,padding:32,width:480,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`,maxHeight:'90vh',overflowY:'auto'}}>
                        <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:4}}>Lançar Horas Extras</div>
                        <div style={{fontSize:12,color:T.textT,marginBottom:18}}>Registro feito pelo RH em nome de outro colaborador</div>

                        <div style={{marginBottom:12}}>
                          <div style={labelSt}>Colaborador *</div>
                          <select value={f.colaborador} onChange={e=>set('colaborador',e.target.value)} style={inputSt}>
                            <option value="">Selecione...</option>
                            {empList.filter(e=>e.active!==false).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>(
                              <option key={e.id} value={e.name}>{e.name}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{marginBottom:12}}>
                          <div style={labelSt}>Data</div>
                          <input type="date" value={f.data} onChange={e=>set('data',e.target.value)} style={inputSt}/>
                        </div>

                        <div style={{marginBottom:12}}>
                          <div style={labelSt}>Descrição / observação *</div>
                          <input value={f.descricao} onChange={e=>set('descricao',e.target.value)}
                            placeholder="Ex: Plantão, reunião extra, ajuste retroativo..." style={inputSt}/>
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                          <div>
                            <div style={labelSt}>Hora início *</div>
                            <input type="time" value={f.hora_inicio} onChange={e=>set('hora_inicio',e.target.value)} style={inputSt}/>
                          </div>
                          <div>
                            <div style={labelSt}>Hora fim *</div>
                            <input type="time" value={f.hora_fim} onChange={e=>set('hora_fim',e.target.value)} style={inputSt}/>
                          </div>
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                          <div>
                            <div style={labelSt}>Valor da hora (R$)</div>
                            <input value={f.valor_hora} onChange={e=>set('valor_hora',e.target.value)}
                              placeholder={bancoValorHoraS>0?bancoValorHoraS.toFixed(2).replace('.',','):'Sem salário cadastrado'} style={inputSt}/>
                            <div style={{fontSize:10.5,color:T.textD,marginTop:3}}>
                              {bancoValorHoraS>0
                                ? `Sugerido pelo salário: ${BRL(bancoValorHoraS)} — edite para sobrescrever`
                                : 'Salário não configurado — informe o valor manualmente'}
                            </div>
                          </div>
                          <div>
                            <div style={labelSt}>Status</div>
                            <select value={f.status} onChange={e=>set('status',e.target.value)} style={inputSt}>
                              <option value="aprovado">Aprovado</option>
                              <option value="pendente">Pendente</option>
                            </select>
                          </div>
                        </div>

                        {/* Toggle Feriado/Domingo */}
                        <div onClick={()=>set('feriado_domingo',!f.feriado_domingo)}
                          style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,background:'rgba(216,144,48,0.08)',border:'1px solid rgba(216,144,48,0.22)',marginBottom:16,cursor:'pointer'}}>
                          <div style={{width:38,height:22,borderRadius:11,flexShrink:0,background:f.feriado_domingo?'#D89030':'rgba(0,0,0,0.15)',position:'relative',transition:'background .2s'}}>
                            <div style={{position:'absolute',top:3,width:16,height:16,borderRadius:'50%',background:'white',transition:'left .2s',left:f.feriado_domingo?19:3,boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
                          </div>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:'#D89030'}}>Feriado / Domingo</div>
                            <div style={{fontSize:11,color:T.textS}}>Horas contadas em dobro no banco (×2) e pagas a 200%</div>
                          </div>
                        </div>

                        {/* Prévia do cálculo */}
                        {pvTotal>0&&(
                          <div style={{padding:'14px 16px',borderRadius:10,background:'rgba(78,143,168,0.08)',border:'1px solid rgba(78,143,168,0.22)',marginBottom:16}}>
                            <div style={{fontSize:11,fontWeight:700,color:T.blue||'#2A6FB5',marginBottom:10,textTransform:'uppercase',letterSpacing:'.06em'}}>Estimativa do cálculo</div>
                            {bancoValorHora>0&&(
                              <div style={{fontSize:12.5,color:T.text,marginBottom:12,padding:'8px 10px',background:'rgba(26,156,112,0.07)',borderRadius:7,border:'1px solid rgba(26,156,112,0.18)',fontFamily:'monospace',lineHeight:1.7}}>
                                {f.hora_inicio} — {f.hora_fim} = <strong>{pvTotal.toFixed(2)}h</strong> × <strong>{BRL(bancoValorHora)}</strong> × <strong style={{color:f.feriado_domingo?'#D89030':T.blue}}>{f.feriado_domingo?'200% (base + 100%)':'150% (base + 50%)'}</strong> = <strong style={{color:'#1A9C70',fontSize:14}}>{BRL(pvValor)}</strong>
                              </div>
                            )}
                            <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
                              <div>
                                <div style={{fontSize:11,color:T.textD,marginBottom:2}}>Horas trabalhadas</div>
                                <div style={{fontSize:18,fontWeight:700,color:T.text}}>{fmtH(pvTotal)}</div>
                              </div>
                              <div>
                                <div style={{fontSize:11,color:T.textD,marginBottom:2}}>No banco {f.feriado_domingo?'(×2)':'(×1)'}</div>
                                <div style={{fontSize:18,fontWeight:700,color:f.feriado_domingo?'#D89030':T.text}}>{fmtH(pvCalc)}</div>
                              </div>
                              {pvValor!==null&&(
                                <div>
                                  <div style={{fontSize:11,color:T.textD,marginBottom:2}}>Valor a receber</div>
                                  <div style={{fontSize:18,fontWeight:700,color:'#1A9C70'}}>{BRL(pvValor)}</div>
                                </div>
                              )}
                            </div>
                            {bancoValorHora<=0&&(
                              <div style={{fontSize:11,color:T.textD,marginTop:8,opacity:.7}}>Sem valor de hora — o registro entra só como horas no banco.</div>
                            )}
                          </div>
                        )}

                        {bancoMsg&&<div style={{fontSize:12,color:'#C04050',marginBottom:10,padding:'7px 12px',borderRadius:7,background:'rgba(192,64,80,0.06)'}}>{bancoMsg}</div>}
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>setBancoModal(false)}
                            style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                          <button onClick={lancarBancoHoras} disabled={bancoSaving}
                            style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:bancoSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.blue},${T.blueL})`,color:'white',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',outline:'none'}}>
                            {bancoSaving?'Lançando...':'Lançar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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

          {/* ── TAB: PERGUNTAS DO UNIKO (cache/aprendizado da IA) ── */}
          {tab==='uniko_ia'&&<UnikoQATab cardBg={cardBg}/>}

          {/* ── TAB: JUSTIFICATIVAS DE PONTO (solicitações do colaborador) ── */}
          {tab==='justificativas'&&(()=>{
            const list = solics.filter(s => solicFilter==='todos' ? true : (s.status||'pendente')==='pendente');
            const pend = solics.filter(s => (s.status||'pendente')==='pendente').length;
            return (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Justificativas de Ponto</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Solicitações dos colaboradores · {pend} pendente{pend===1?'':'s'}</div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  {[['pendente','Pendentes'],['todos','Todas']].map(([k,l])=>(
                    <button key={k} onClick={()=>setSolicFilter(k)}
                      style={{padding:'7px 14px',borderRadius:9,cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'var(--font-body)',
                        border:`1px solid ${solicFilter===k?T.gold:T.border}`,background:solicFilter===k?T.goldGl:'transparent',color:solicFilter===k?T.gold:T.textS}}>{l}</button>
                  ))}
                </div>
              </div>

              {solicLoading ? (
                <div style={{padding:48,textAlign:'center',color:T.textT}}>Carregando...</div>
              ) : list.length===0 ? (
                <div style={{padding:'40px 0',textAlign:'center',color:T.textT,fontSize:13}}>Nenhuma solicitação {solicFilter==='pendente'?'pendente':''}.</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {list.map(s=>{
                    const pendente=(s.status||'pendente')==='pendente';
                    return (
                    <div key={s.id} style={{padding:'16px 20px',borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:200}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:3}}>
                            <span style={{fontSize:15,fontWeight:700,color:T.text}}>{s.titulo}</span>
                            <span style={{fontSize:10.5,fontWeight:700,borderRadius:5,padding:'1px 8px',color:pendente?'#D89030':'#1A9C70',background:pendente?'rgba(216,144,48,0.14)':'rgba(26,156,112,0.12)'}}>{pendente?'Pendente':'Resolvido'}</span>
                          </div>
                          <div style={{fontSize:12.5,color:T.textS,marginBottom:2}}>
                            <strong style={{color:T.text}}>{s.nome||s.cpf}</strong>
                            {s.data_ref&&<> · dia {(()=>{try{return new Date(s.data_ref+'T00:00:00').toLocaleDateString('pt-BR');}catch{return s.data_ref;}})()}</>}
                            {s.created_at&&<> · enviado {new Date(s.created_at).toLocaleDateString('pt-BR')}</>}
                          </div>
                          {s.descricao&&<div style={{fontSize:13,color:T.textS,lineHeight:1.5,marginTop:4}}>{s.descricao}</div>}
                          {s.file_url&&(
                            <a href={s.file_url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12.5,fontWeight:600,color:T.gold,marginTop:8,textDecoration:'none',padding:'6px 12px',borderRadius:8,background:T.goldGl,border:`1px solid ${T.goldLine}44`}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                              {s.file_name||'Ver anexo'}
                            </a>
                          )}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                          {pendente
                            ? <button onClick={()=>aceitarSolic(s)} title="Abona o dia no ponto e zera a hora negativa" style={{padding:'8px 14px',borderRadius:9,border:'none',cursor:'pointer',background:'#1A9C70',color:'#fff',fontWeight:700,fontSize:12.5,fontFamily:'var(--font-body)'}}>Aceitar e abonar</button>
                            : <button onClick={()=>setSolicStatus(s.id,'pendente')} style={{padding:'8px 14px',borderRadius:9,border:`1px solid ${T.border}`,cursor:'pointer',background:'transparent',color:T.textS,fontWeight:600,fontSize:12.5,fontFamily:'var(--font-body)'}}>Reabrir</button>}
                          <button onClick={()=>delSolic(s.id)} style={{padding:'7px 14px',borderRadius:9,border:'1px solid rgba(192,64,80,0.25)',cursor:'pointer',background:'rgba(192,64,80,0.06)',color:'#C04050',fontWeight:600,fontSize:12,fontFamily:'var(--font-body)'}}>Excluir</button>
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              )}
              <div style={{fontSize:11,color:T.textT,lineHeight:1.6}}>
                ℹ️ “Aceitar e abonar” já zera o saldo daquele dia automaticamente (cria a justificativa no ponto). O dia precisa estar preenchido na solicitação e o colaborador precisa estar vinculado (aba Vínculo Ponto).
              </div>
            </div>
          );})()}

          {/* ── TAB: VÍNCULO PONTO (Portal ↔ PIS) ── */}
          {tab==='vinculo'&&(()=>{
            const q = vincSearch.trim().toLowerCase();
            const emps = empList.filter(e => !q || (e.name||'').toLowerCase().includes(q));
            return (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Vínculo Ponto</div>
                <div style={{fontSize:13,color:T.textS,marginTop:2}}>Ligue cada colaborador do Portal ao seu registro no ponto (o AFD usa PIS/PASEP, não CPF). Sem o vínculo, o colaborador não vê o próprio banco de horas.</div>
              </div>

              <div style={{padding:'14px 18px',borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <input value={vincSearch} onChange={e=>setVincSearch(e.target.value)} placeholder="Buscar colaborador..."
                  style={{width:'100%',maxWidth:320,padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',marginBottom:12,boxSizing:'border-box'}}/>
                {vincLoading ? <div style={{padding:32,textAlign:'center',color:T.textT}}>Carregando...</div> : emps.length===0 ? (
                  <div style={{padding:'28px 0',textAlign:'center',color:T.textT,fontSize:13}}>Nenhum colaborador.</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {emps.map(e=>{
                      const pcpf=(e.cpf||'').replace(/\D/g,'');
                      const sel=vincMap[pcpf]||'';
                      return (
                        <div key={e.id||pcpf} style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:'10px 14px',background:'rgba(0,0,0,0.02)',border:`1px solid ${T.border}`,borderRadius:10}}>
                          <div style={{flex:1,minWidth:160}}>
                            <div style={{fontSize:14,fontWeight:600,color:T.text}}>{e.name}</div>
                            <div style={{fontSize:11,color:T.textT}}>CPF {e.cpf||'—'}{sel?'':' · sem vínculo'}</div>
                          </div>
                          <select value={sel} onChange={ev=>saveVinculo(e, ev.target.value)}
                            style={{minWidth:240,padding:'8px 10px',borderRadius:9,border:`1px solid ${sel?'#1A9C70':T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)'}}>
                            <option value="">— selecionar registro do ponto —</option>
                            {vincFuncs.slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).map(f=>(
                              <option key={f.cpf} value={f.cpf}>{f.nome||'(sem nome)'} · {f.cpf}</option>
                            ))}
                          </select>
                          {sel && <span style={{fontSize:11,fontWeight:700,color:'#1A9C70',background:'rgba(26,156,112,0.12)',borderRadius:6,padding:'3px 9px'}}>✓ vinculado</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );})()}

          {/* ── TAB: MÁQUINA DO TEMPO (mensagem especial da Central Alexa) ── */}
          {tab==='maquina'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14,maxWidth:720}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:800,color:T.text,marginBottom:4}}>Mensagem Especial</div>
                <div style={{fontSize:12.5,color:T.textS,lineHeight:1.5}}>
                  A capa e o vídeo que aparecem no card <b>“Mensagem Especial!”</b> da Máquina do Tempo (Central Alexa). O vídeo toca automático quando alguém abre o card; ao terminar, mostra a capa.
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                {/* CAPA */}
                <div style={{padding:16,borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{fontSize:13,fontWeight:800,color:T.text}}>Capa (imagem)</div>
                  <div style={{borderRadius:10,overflow:'hidden',background:isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.04)',aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {msgEsp.coverUrl
                      ? <img src={msgEsp.coverUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : <span style={{fontSize:30,opacity:.4}}>🖼️</span>}
                  </div>
                  <label style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,padding:'9px 14px',borderRadius:9,cursor:msgEspUploading?'wait':'pointer',
                    background:isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.05)',color:T.text,fontWeight:700,fontSize:12.5,border:`1px solid ${T.border}`}}>
                    {msgEspUploading==='cover' ? 'Enviando…' : 'Trocar capa'}
                    <input type="file" accept="image/*" disabled={!!msgEspUploading} style={{display:'none'}}
                      onChange={e=>{ msgEspUpload('cover', e.target.files?.[0]); e.target.value=''; }}/>
                  </label>
                </div>

                {/* VÍDEO */}
                <div style={{padding:16,borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{fontSize:13,fontWeight:800,color:T.text}}>Vídeo</div>
                  <div style={{borderRadius:10,overflow:'hidden',background:'#000',aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {msgEsp.videoUrl
                      ? <video src={msgEsp.videoUrl} muted autoPlay loop playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : <span style={{fontSize:30,opacity:.4}}>🎬</span>}
                  </div>
                  <label style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,padding:'9px 14px',borderRadius:9,cursor:msgEspUploading?'wait':'pointer',
                    background:isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.05)',color:T.text,fontWeight:700,fontSize:12.5,border:`1px solid ${T.border}`}}>
                    {msgEspUploading==='video' ? 'Enviando…' : 'Trocar vídeo'}
                    <input type="file" accept="video/*" disabled={!!msgEspUploading} style={{display:'none'}}
                      onChange={e=>{ msgEspUpload('video', e.target.files?.[0]); e.target.value=''; }}/>
                  </label>
                </div>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                <button onClick={salvarMsgEsp} disabled={msgEspSaving||!!msgEspUploading}
                  style={{padding:'11px 26px',borderRadius:10,border:'none',cursor:(msgEspSaving||msgEspUploading)?'default':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'#fff',fontWeight:700,fontSize:14,fontFamily:'var(--font-body)',opacity:(msgEspSaving||msgEspUploading)?.6:1,boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                  {msgEspSaving?'Salvando…':'Salvar'}
                </button>
                {msgEspMsg && <div style={{fontSize:12.5,fontWeight:600,color:msgEspMsg.startsWith('Erro')?'#C04050':T.gold}}>{msgEspMsg}</div>}
              </div>
              <div style={{fontSize:11.5,color:T.textT}}>
                Imagem até 12MB · vídeo até 80MB. O vídeo fica <b>mutado, em autoplay e loop</b> no fundo — mande em boa qualidade.
              </div>
            </div>
          )}

          {/* ── TAB: OFICINA UNIKO WAVE (personagens do jogo) ── */}
          {tab==='oficina-wave'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14,maxWidth:860}}>
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:800,color:T.text,marginBottom:4}}>Oficina Uniko Wave</div>
                <div style={{fontSize:12.5,color:T.textS,lineHeight:1.5}}>
                  Crie personagens pro <b>Uniko Wave</b>. Elas entram no gacha da <b>Audição</b> (jogadores conquistam com GW) e valem nos dois modos — ritmo e Guerra Estelar. Só imagens PNG (fundo transparente) + nome, descrição e cor.
                </div>
              </div>

              {/* Formulário */}
              <div style={{padding:18,borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div style={{flex:'1 1 200px'}}>
                    <label style={{fontSize:11,fontWeight:700,color:T.textD,display:'block',marginBottom:5}}>Nome</label>
                    <input value={owForm.name} onChange={e=>setOwForm(f=>({...f,name:e.target.value}))} placeholder="Ex.: Estela"
                      style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:inputBg,color:T.text,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:T.textD,display:'block',marginBottom:5}}>Cor</label>
                    <input type="color" value={owForm.color} onChange={e=>setOwForm(f=>({...f,color:e.target.value}))}
                      style={{width:54,height:38,borderRadius:9,border:`1px solid ${T.border}`,background:inputBg,cursor:'pointer'}}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:T.textD,display:'block',marginBottom:5}}>Descrição</label>
                  <input value={owForm.desc} onChange={e=>setOwForm(f=>({...f,desc:e.target.value}))} placeholder="Ex.: Guerreira das estrelas. Finisher: Chuva Estelar."
                    style={{width:'100%',padding:'9px 12px',borderRadius:9,border:`1px solid ${T.border}`,background:inputBg,color:T.text,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:10}}>
                  {OW_SLOTS.map(s=>{
                    const url = owImgs[s.k]; const carregando = owUploading===s.k;
                    return (
                    <div key={s.k} style={{display:'flex',flexDirection:'column',gap:6}}>
                      <div style={{fontSize:11,fontWeight:700,color:s.req?T.text:T.textT}}>{s.label}{s.req&&<span style={{color:'#C04050'}}> *</span>}</div>
                      <label style={{display:'block',aspectRatio:'1',borderRadius:10,cursor:carregando?'wait':'pointer',overflow:'hidden',
                        border:`1.5px ${url?'solid':'dashed'} ${url?'#22C55E':T.border}`,background:isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.03)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                        {url ? <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                             : <span style={{fontSize:11,color:T.textT}}>{carregando?'Enviando…':'+ imagem'}</span>}
                        <input type="file" accept="image/*" disabled={!!owUploading} style={{display:'none'}}
                          onChange={e=>{ owUpload(s.k, e.target.files?.[0]); e.target.value=''; }}/>
                      </label>
                    </div>
                    );
                  })}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={owSalvar} disabled={owSaving||!!owUploading}
                    style={{padding:'11px 26px',borderRadius:10,border:'none',cursor:(owSaving||owUploading)?'default':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'#fff',fontWeight:700,fontSize:14,fontFamily:'var(--font-body)',opacity:(owSaving||owUploading)?.6:1,boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                    {owSaving?'Salvando…':'Criar personagem'}
                  </button>
                  <button onClick={owReset} disabled={owSaving} style={{padding:'11px 16px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',color:T.textS,cursor:'pointer',fontWeight:600,fontSize:13}}>Limpar</button>
                  {owMsg && <div style={{fontSize:12.5,fontWeight:600,color:owMsg.startsWith('Erro')||owMsg.startsWith('Falta')||owMsg.startsWith('Dá')||owMsg.startsWith('Só')?'#C04050':T.gold}}>{owMsg}</div>}
                </div>
              </div>

              {/* Lista de personagens criadas */}
              <div style={{padding:16,borderRadius:13,background:cardBg,border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:12}}>Personagens criadas{owLista.length?` · ${owLista.length}`:''}</div>
                {owLista.length===0 ? (
                  <div style={{fontSize:12.5,color:T.textT,padding:'12px 0'}}>Nenhuma personagem criada ainda.</div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12}}>
                    {owLista.map(c=>(
                      <div key={c.id} style={{borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden',background:isDark?'rgba(255,255,255,.03)':'rgba(0,0,0,.02)'}}>
                        <div style={{aspectRatio:'1',background:`radial-gradient(ellipse at 50% 25%, ${c.color||'#ff00cc'}33, transparent 70%)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {c.splash_url ? <img src={c.splash_url} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/> : <span style={{fontSize:26,opacity:.4}}>🎭</span>}
                        </div>
                        <div style={{padding:'8px 10px'}}>
                          <div style={{fontSize:13,fontWeight:700,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                          <div style={{fontSize:11,color:T.textT,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.desc||'—'}</div>
                          <button onClick={()=>owExcluir(c)} style={{marginTop:8,width:'100%',padding:'6px',borderRadius:8,border:`1px solid rgba(192,64,80,.3)`,background:'rgba(192,64,80,.08)',color:'#C04050',cursor:'pointer',fontWeight:700,fontSize:11}}>Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{fontSize:11.5,color:T.textT}}>
                Dica: use PNG com fundo transparente. Passo 1 é a pose base/andando; passos 2-5 fazem o ciclo de caminhada na Guerra Estelar. A cor define os efeitos de magia dela.
              </div>
            </div>
          )}

          {/* ── TAB: CAPTURE O UNIKO (evento) ── */}
          {tab==='capture'&&(()=>{
            const uni = getUniko(capCfg.unikoId);
            return (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Capture o Uniko</div>
                <div style={{fontSize:13,color:T.textS,marginTop:2}}>
                  {captureSubTab==='evento'
                    ? 'Defina a janela em que um Uniko pode surgir aleatoriamente no Portal do Colaborador para os funcionários capturarem.'
                    : captureSubTab==='oficina'
                    ? 'Crie Unikos personalizados, fora do roster fixo, pra disponibilizar no evento.'
                    : 'Dê um Uniko + prismas direto pra um colaborador específico, sem depender do sorteio do evento.'}
                </div>
              </div>

              {/* Sub-abas: evento/spawn vs. Oficina de Uniko vs. Enviar */}
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[
                  {id:'evento',  label:'⚡ Evento & Spawn'},
                  {id:'oficina', label:'🛠️ Oficina de Uniko'},
                  {id:'enviar',  label:'🎁 Enviar Uniko'},
                ].map(v=>{
                  const on = captureSubTab===v.id;
                  return (
                    <button key={v.id} onClick={()=>setCaptureSubTab(v.id)}
                      style={{padding:'9px 18px',borderRadius:999,cursor:'pointer',fontFamily:'var(--font-body)',
                        fontSize:13,fontWeight:700,letterSpacing:'.01em',transition:'all .15s',
                        border:`1.5px solid ${on?T.gold:T.border}`,
                        background:on?(T.goldGl||`${T.gold}22`):'transparent',color:on?T.gold:T.textS}}>
                      {v.label}
                    </button>
                  );
                })}
              </div>

              {/* Card de configuração */}
              {captureSubTab==='evento' && (<>

              <div style={{padding:'20px 22px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',flexDirection:'column',gap:18}}>

                {/* Ativar */}
                <label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <span onClick={()=>setCapCfg(c=>({...c,enabled:!c.enabled}))} style={{position:'relative',width:46,height:26,borderRadius:99,background:capCfg.enabled?T.gold:T.border,transition:'background .2s',flexShrink:0}}>
                    <span style={{position:'absolute',top:3,left:capCfg.enabled?23:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.3)'}}/>
                  </span>
                  <span>
                    <div style={{fontSize:14,fontWeight:600,color:T.text}}>Evento ativo</div>
                    <div style={{fontSize:12,color:T.textT}}>Quando ligado, o Uniko pode surgir dentro da janela abaixo.</div>
                  </span>
                </label>

                {/* Janela */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Início da janela</label>
                    <input type="datetime-local" value={capCfg.startAt} onChange={e=>setCapCfg(c=>({...c,startAt:e.target.value}))}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Fim da janela</label>
                    <input type="datetime-local" value={capCfg.endAt} onChange={e=>setCapCfg(c=>({...c,endAt:e.target.value}))}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                </div>

                {/* Vagas — quantas pessoas conseguem capturar esse Uniko */}
                <div style={{maxWidth:260}}>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Vagas (quantas pessoas conseguem pegar)</label>
                  <div style={{display:'flex',gap:8}}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>setCapCfg(c=>({...c,maxWinners:n}))}
                        style={{flex:1,padding:'9px 0',borderRadius:9,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:14,fontWeight:700,
                          border:`1.5px solid ${Number(capCfg.maxWinners)===n?T.gold:T.border}`,
                          background:Number(capCfg.maxWinners)===n?(T.goldGl||`${T.gold}22`):'transparent',
                          color:Number(capCfg.maxWinners)===n?T.gold:T.textS,transition:'all .15s'}}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:T.textT,marginTop:6}}>{capCfg.maxWinners===1?'Só a 1ª pessoa a arrastar até o Uniko consegue capturar.':`As ${capCfg.maxWinners} primeiras pessoas que conseguirem capturar ganham.`}</div>
                </div>

                {/* Escolha do Uniko */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:8}}>Uniko disponível</label>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {[...Object.values(CAPTURE_UNIKOS),...oficinaLib].map(u=>{
                      const rw = getCaptureReward(u);
                      // Prismas editáveis só pros Unikos FIXOS "lendários" (vampire-robot,
                      // uniko-sereia) — os da Oficina já têm o próprio campo de prismas
                      // no formulário de criação/edição deles.
                      const editavel = u.id==='vampire-robot' || u.id==='uniko-sereia';
                      const draft = rewardEdit[u.id];
                      return (
                      <div key={u.id} onClick={()=>setCapCfg(c=>({...c,unikoId:u.id}))}
                        style={{display:'flex',flexDirection:'column',gap:8,padding:'10px 14px',borderRadius:12,cursor:'pointer',textAlign:'left',
                          border:`2px solid ${capCfg.unikoId===u.id?u.theme.accent:T.border}`,
                          background:capCfg.unikoId===u.id?`${u.theme.accent}18`:'transparent',transition:'all .15s'}}>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          <img src={u.img} alt={u.name} style={{width:46,height:46,objectFit:'contain',filter:`drop-shadow(0 2px 8px ${u.theme.accent}88)`}}/>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:T.text}}>{u.name}</div>
                            {!draft && <div style={{fontSize:10,fontWeight:700,color:u.theme.accent,marginTop:2}}>{rw.comum} comuns · {rw.premium} premium</div>}
                          </div>
                        </div>
                        {editavel && (
                          <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <input type="number" min={0} value={draft?draft.comum:rw.comum}
                              onChange={e=>setRewardEdit(x=>({...x,[u.id]:{comum:e.target.value,premium:draft?draft.premium:rw.premium}}))}
                              style={{width:62,padding:'5px 6px',borderRadius:7,border:`1px solid ${T.border}`,background:T.surface||'#fff',color:T.text,fontSize:11,fontFamily:'var(--font-body)'}}/>
                            <span style={{fontSize:10,color:T.textT}}>comuns</span>
                            <input type="number" min={0} value={draft?draft.premium:rw.premium}
                              onChange={e=>setRewardEdit(x=>({...x,[u.id]:{comum:draft?draft.comum:rw.comum,premium:e.target.value}}))}
                              style={{width:62,padding:'5px 6px',borderRadius:7,border:`1px solid ${T.border}`,background:T.surface||'#fff',color:T.text,fontSize:11,fontFamily:'var(--font-body)'}}/>
                            <span style={{fontSize:10,color:T.textT}}>premium</span>
                            {draft && (
                              <button onClick={()=>salvarReward(u.id)} disabled={rewardSaving===u.id}
                                style={{padding:'5px 10px',borderRadius:7,border:'none',cursor:rewardSaving===u.id?'default':'pointer',background:u.theme.accent,color:'#fff',fontWeight:700,fontSize:10,fontFamily:'var(--font-body)',opacity:rewardSaving===u.id?.6:1}}>
                                {rewardSaving===u.id?'Salvando…':'Salvar'}
                              </button>
                            )}
                          </div>
                        )}
                        {/* Vídeo de fundo (Central Alexa) — pra QUALQUER Uniko */}
                        {(() => {
                          const temVideo = !!getUnikoBgVideo(u.id);
                          const carregando = bgVidUploading===u.id;
                          return (
                          <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                            <span style={{fontSize:10,fontWeight:700,color:T.textT}}>Vídeo de fundo:</span>
                            <label style={{padding:'5px 10px',borderRadius:7,cursor:carregando?'wait':'pointer',background:temVideo?`${u.theme.accent}22`:(isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.05)'),color:temVideo?u.theme.accent:T.textS,fontWeight:700,fontSize:10,border:`1px solid ${T.border}`}}>
                              {carregando?'Enviando…':temVideo?'Trocar':'Escolher'}
                              <input type="file" accept="video/*" disabled={carregando} style={{display:'none'}}
                                onChange={e=>{ subirBgVideo(u.id, e.target.files?.[0]); e.target.value=''; }}/>
                            </label>
                            {temVideo && !carregando && (
                              <button onClick={()=>removerBgVideo(u.id)}
                                style={{padding:'5px 8px',borderRadius:7,border:`1px solid rgba(192,64,80,.3)`,background:'rgba(192,64,80,.08)',color:'#C04050',cursor:'pointer',fontWeight:700,fontSize:10}}>Remover</button>
                            )}
                          </div>
                          );
                        })()}
                      </div>
                      );
                    })}
                    {bgVidMsg && <div style={{fontSize:11,fontWeight:600,color:'#C04050',width:'100%'}}>{bgVidMsg}</div>}
                  </div>
                </div>

                {/* Anúncio na Alexa */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Mensagem que a Alexa anuncia ao spawnar</label>
                  <textarea value={capCfg.alexaMessage} onChange={e=>setCapCfg(c=>({...c,alexaMessage:e.target.value}))} rows={2}
                    placeholder={DEFAULT_CAPTURE_ALEXA_MSG}
                    style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box',resize:'vertical'}}/>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:6}}>
                    <div style={{fontSize:11,color:T.textT}}>Falada no Echo assim que o Uniko surgir de verdade no Portal.</div>
                    {capCfg.alexaMessage!==DEFAULT_CAPTURE_ALEXA_MSG&&(
                      <button onClick={()=>setCapCfg(c=>({...c,alexaMessage:DEFAULT_CAPTURE_ALEXA_MSG}))}
                        style={{fontSize:11,fontWeight:600,color:T.gold,background:'none',border:'none',cursor:'pointer',padding:0}}>
                        Restaurar padrão
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview do tema */}
                <div style={{borderRadius:14,padding:3,background:`conic-gradient(${uni.theme.border.join(',')})`}}>
                  <div style={{borderRadius:12,background:uni.theme.scene,padding:'18px 16px',display:'flex',alignItems:'center',gap:14}}>
                    <img src={uni.img} alt="" style={{width:70,height:70,objectFit:'contain',filter:`drop-shadow(0 0 14px ${uni.theme.accent})`}}/>
                    <div>
                      <div style={{fontSize:11,fontWeight:800,letterSpacing:'.16em',color:uni.theme.glow}}>★ CAPTURE O UNIKO ★</div>
                      <div style={{fontSize:16,fontWeight:900,color:'#fff',fontFamily:'var(--font-brand)'}}>{uni.name}</div>
                      <div style={{fontSize:11,color:uni.theme.ink,opacity:.85}}>{uni.tagline}</div>
                    </div>
                  </div>
                </div>

                {/* Salvar + Spawnar agora */}
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={saveCapCfg} disabled={capSaving}
                    style={{padding:'11px 26px',borderRadius:10,border:'none',cursor:capSaving?'default':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'#fff',fontWeight:700,fontSize:14,fontFamily:'var(--font-body)',opacity:capSaving?.6:1,boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                    {capSaving?'Salvando...':'Salvar configuração'}
                  </button>
                  <button onClick={spawnNow} disabled={capSaving}
                    title={`Libera o ${uni.name} agora para todos que estiverem no Portal (surge em segundos).`}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'11px 22px',borderRadius:10,border:`2px solid ${uni.theme.accent}`,cursor:capSaving?'default':'pointer',background:`${uni.theme.accent}22`,color:uni.theme.accent,fontWeight:800,fontSize:14,fontFamily:'var(--font-body)',opacity:capSaving?.6:1}}>
                    <span style={{fontSize:15}}>⚡</span> Spawnar agora
                  </button>
                  {capMsg&&<span style={{fontSize:13,color:capMsg.startsWith('✅')?(T.success||'#3a9'):'#C04050',fontWeight:600}}>{capMsg}</span>}
                </div>

                <div style={{fontSize:11,color:T.textT,lineHeight:1.6,borderTop:`1px solid ${T.border}`,paddingTop:12}}>
                  ℹ️ Dentro da janela, o widget surge num momento aleatório para cada colaborador que estiver no Portal. O assistente UNIKO avisa (com heartbeat) quando o Portal está aberto. A captura é sempre na 1ª tentativa (arrastou, pegou) e vale para {capCfg.maxWinners===1?'a 1ª pessoa que conseguir':`as ${capCfg.maxWinners} primeiras pessoas que conseguirem`}.
                </div>
              </div>
              </>)}

              {/* Oficina de Uniko — criar Unikos personalizados */}
              {captureSubTab==='oficina' && (<>
              <div style={{padding:'20px 22px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',flexDirection:'column',gap:18}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:16,fontWeight:700,color:T.text}}>🛠️ Oficina de Uniko</div>
                    <div style={{fontSize:12,color:T.textS,marginTop:3}}>Crie um Uniko novo anexando as imagens dele. Só o frame <b>principal</b> é obrigatório — os que faltarem usam o principal no lugar (fica um ícone parado, sem animação, se você quiser assim).</div>
                  </div>
                  {oficinaEditingId && (
                    <div style={{padding:'6px 12px',borderRadius:999,background:`${oficinaForm.accent}22`,border:`1px solid ${oficinaForm.accent}55`,color:oficinaForm.accent,fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>
                      ✏️ Editando "{oficinaForm.name || oficinaEditingId}"
                    </div>
                  )}
                </div>

                {/* Nome / tagline */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Nome do Uniko</label>
                    <input value={oficinaForm.name} onChange={e=>setOficinaForm(f=>({...f,name:e.target.value}))} placeholder="Ex.: Uniko Fênix"
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Frase (tagline)</label>
                    <input value={oficinaForm.tagline} onChange={e=>setOficinaForm(f=>({...f,tagline:e.target.value}))} placeholder="Ex.: Renasce das cinzas"
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                </div>

                {/* Cor + recompensa */}
                <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'end'}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Cor principal</label>
                    <input type="color" value={oficinaForm.accent} onChange={e=>setOficinaForm(f=>({...f,accent:e.target.value}))}
                      style={{width:52,height:40,border:`1px solid ${T.border}`,borderRadius:8,cursor:'pointer',padding:2,background:'transparent'}}/>
                  </div>
                  <div style={{width:150}}>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Recompensa comum</label>
                    <input type="number" min="0" value={oficinaForm.rewardComum} onChange={e=>setOficinaForm(f=>({...f,rewardComum:e.target.value}))}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{width:150}}>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Recompensa premium</label>
                    <input type="number" min="0" value={oficinaForm.rewardPremium} onChange={e=>setOficinaForm(f=>({...f,rewardPremium:e.target.value}))}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{width:220}}>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Tamanho do assistente ({oficinaForm.iconSize}px)</label>
                    <input type="range" min="50" max="160" step="2" value={oficinaForm.iconSize}
                      onChange={e=>setOficinaForm(f=>({...f,iconSize:e.target.value}))}
                      style={{width:'100%',accentColor:oficinaForm.accent,cursor:'pointer'}}/>
                  </div>
                </div>

                {/* Frames */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:10}}>Frames</label>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                    <FrameUploadSlot label="Principal" required hint="Rosto parado — base de tudo" value={oficinaFrames.main}
                      onFile={f=>handleFrameFile('main',f)} onClear={()=>setOficinaFrames(fr=>({...fr,main:null}))}/>
                    <FrameUploadSlot label="Notificação" hint="Lembretes e avisos gerais" value={oficinaFrames.notif}
                      onFile={f=>handleFrameFile('notif',f)} onClear={()=>setOficinaFrames(fr=>({...fr,notif:null}))}/>
                    <FrameUploadSlot label="Aviso" hint="Avisos importantes do RH" value={oficinaFrames.alert}
                      onFile={f=>handleFrameFile('alert',f)} onClear={()=>setOficinaFrames(fr=>({...fr,alert:null}))}/>
                    <FrameUploadSlot label="Olhos fechados" hint="Frame de piscar" value={oficinaFrames.closed}
                      onFile={f=>handleFrameFile('closed',f)} onClear={()=>setOficinaFrames(fr=>({...fr,closed:null}))}/>
                    <FrameUploadSlot label="Capturar" hint="Quando alguém captura" value={oficinaFrames.capture}
                      onFile={f=>handleFrameFile('capture',f)} onClear={()=>setOficinaFrames(fr=>({...fr,capture:null}))}/>
                    <FrameUploadSlot label="Prisma Comum" hint="Ganhou Prisma comum" value={oficinaFrames.prismaComum}
                      onFile={f=>handleFrameFile('prismaComum',f)} onClear={()=>setOficinaFrames(fr=>({...fr,prismaComum:null}))}/>
                    <FrameUploadSlot label="Prisma Premium" hint="Ganhou Prisma premium" value={oficinaFrames.prismaPremium}
                      onFile={f=>handleFrameFile('prismaPremium',f)} onClear={()=>setOficinaFrames(fr=>({...fr,prismaPremium:null}))}/>
                    <FrameUploadSlot label="Alexa" hint="Avisos da Central Alexa" value={oficinaFrames.alexa}
                      onFile={f=>handleFrameFile('alexa',f)} onClear={()=>setOficinaFrames(fr=>({...fr,alexa:null}))}/>
                    <FrameUploadSlot label="Uniko Wave" hint="Avisos do Uniko Wave" value={oficinaFrames.wave}
                      onFile={f=>handleFrameFile('wave',f)} onClear={()=>setOficinaFrames(fr=>({...fr,wave:null}))}/>
                  </div>
                </div>

                {/* Cenário — OPCIONAL. Sem anexar nada, fica só a cor gradiente (como sempre foi). */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Cenário personalizado (opcional)</label>
                  <div style={{fontSize:11,color:T.textT,marginBottom:10}}>Se anexar uma imagem, ela aparece como fundo quando o Uniko spawnar no Capture o Uniko, em vez da cor gradiente.</div>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <label style={{width:160,height:90,borderRadius:12,border:`2px dashed ${T.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',background:oficinaFrames.scene?'rgba(0,0,0,.15)':'transparent',flexShrink:0}}>
                      {oficinaFrames.scene
                        ? <img src={oficinaFrames.scene} alt="Cenário" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : <span style={{fontSize:22,color:T.textT,opacity:.6}}>+</span>}
                      <input type="file" accept="image/*" style={{display:'none'}}
                        onChange={e=>{ const f=e.target.files?.[0]; handleSceneFile(f); e.target.value=''; }}/>
                    </label>
                    {oficinaFrames.scene && (
                      <button onClick={()=>setOficinaFrames(fr=>({...fr,scene:null}))}
                        style={{fontSize:11,color:'#C04050',background:'none',border:'none',cursor:'pointer',padding:0}}>remover cenário</button>
                    )}
                  </div>
                </div>

                {/* Teste — prévia ao vivo de como fica cada ação */}
                {oficinaFrames.main && (()=>{ const pt = themeWithScene(deriveUnikoTheme(oficinaForm.accent), oficinaFrames.scene); return (
                  <div style={{borderRadius:14,padding:3,background:`conic-gradient(${pt.border.join(',')})`}}>
                    <div style={{borderRadius:12,background:pt.scene,padding:'16px',display:'flex',flexDirection:'column',gap:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:14}}>
                        <img src={(oficinaBlinkPreview && oficinaFrames.closed) ? oficinaFrames.closed : oficinaFrames.main} alt=""
                          style={{width:Math.min(100,Math.max(40,Number(oficinaForm.iconSize)||84)),height:Math.min(100,Math.max(40,Number(oficinaForm.iconSize)||84)),objectFit:'contain',filter:`drop-shadow(0 0 12px ${pt.accent})`,transition:'width .2s,height .2s'}}/>
                        <div>
                          <div style={{fontSize:11,fontWeight:800,letterSpacing:'.14em',color:pt.glow}}>TESTE — PRÉVIA AO VIVO (tamanho real: {oficinaForm.iconSize}px)</div>
                          <div style={{fontSize:16,fontWeight:900,color:'#fff',fontFamily:'var(--font-brand)'}}>{oficinaForm.name||'Nome do Uniko'}</div>
                          <div style={{fontSize:11,color:pt.ink,opacity:.85}}>{oficinaForm.tagline||'Pisca sozinho a cada 2s'}</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                        {[{k:'notif',label:'Notificação'},{k:'alert',label:'Aviso'},{k:'capture',label:'Capturar'},{k:'prismaComum',label:'Prisma Comum'},{k:'prismaPremium',label:'Prisma Premium'},{k:'alexa',label:'Alexa'},{k:'wave',label:'Uniko Wave'}].map(({k,label})=>(
                          <div key={k} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                            <img src={oficinaFrames[k]||oficinaFrames.main} alt={label} style={{width:42,height:42,objectFit:'contain',borderRadius:8,background:'rgba(0,0,0,.25)',padding:4}}/>
                            <span style={{fontSize:9.5,color:'rgba(255,255,255,.75)'}}>{label}{!oficinaFrames[k]&&' (padrão)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );})()}

                {/* Salvar */}
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={saveOficina} disabled={oficinaSaving}
                    style={{padding:'11px 26px',borderRadius:10,border:'none',cursor:oficinaSaving?'default':'pointer',background:`linear-gradient(135deg,${oficinaForm.accent},${oficinaForm.accent}cc)`,color:'#fff',fontWeight:700,fontSize:14,fontFamily:'var(--font-body)',opacity:oficinaSaving?.6:1}}>
                    {oficinaSaving?'Salvando...':(oficinaEditingId?'💾 Salvar alterações':'+ Adicionar à Biblioteca')}
                  </button>
                  <button onClick={resetOficinaForm}
                    style={{padding:'11px 18px',borderRadius:10,border:`1px solid ${T.border}`,cursor:'pointer',background:'transparent',color:T.textS,fontWeight:600,fontSize:13,fontFamily:'var(--font-body)'}}>
                    {oficinaEditingId?'Cancelar edição':'Limpar'}
                  </button>
                  {oficinaMsg&&<span style={{fontSize:13,color:oficinaMsg.startsWith('✅')?(T.success||'#3a9'):'#C04050',fontWeight:600}}>{oficinaMsg}</span>}
                </div>

                {/* Biblioteca de Unikos */}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>Biblioteca de Unikos ({oficinaLib.length})</div>
                  {oficinaLib.length===0
                    ? <div style={{fontSize:12,color:T.textT}}>Nenhum Uniko criado ainda. Preencha o formulário acima pra adicionar o primeiro.</div>
                    : (
                    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                      {oficinaLib.map(u=>{ const raw = getCustomUnikoRaw(u.id); return (
                        <div key={u.id} style={{width:148,borderRadius:12,border:oficinaEditingId===u.id?`1.5px solid ${u.theme.accent}`:`1.5px solid ${u.theme.accent}55`,background:`${u.theme.accent}0d`,padding:'12px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                          <img src={u.img} alt={u.name} style={{width:54,height:54,objectFit:'contain',filter:`drop-shadow(0 2px 8px ${u.theme.accent}88)`}}/>
                          <div style={{fontSize:12,fontWeight:700,color:T.text,textAlign:'center'}}>{u.name}</div>
                          <div style={{fontSize:10,color:T.textT,textAlign:'center',lineHeight:1.3}}>{u.tagline}</div>
                          <div style={{fontSize:10,fontWeight:700,color:u.theme.accent}}>{u.reward.comum}·{u.reward.premium} · {raw?.icon_size||84}px</div>
                          <div style={{display:'flex',gap:10,marginTop:2}}>
                            <button onClick={()=>editOficina(u.id)}
                              style={{fontSize:10,color:u.theme.accent,background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:700}}>Editar</button>
                            <button onClick={()=>removeOficina(u.id,u.name)}
                              style={{fontSize:10,color:'#C04050',background:'none',border:'none',cursor:'pointer',padding:0}}>Remover</button>
                          </div>
                        </div>
                      );})}
                    </div>
                    )}
                </div>
              </div>
              </>)}

              {/* Enviar Uniko direto pra um colaborador (fora do sorteio) */}
              {captureSubTab==='enviar' && (()=>{
                const gu = getUniko(giftUnikoId);
                return (
              <div style={{padding:'20px 22px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',flexDirection:'column',gap:18}}>

                {/* Colaborador */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Colaborador</label>
                  <select value={giftTarget} onChange={e=>setGiftTarget(e.target.value)}
                    style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box',cursor:'pointer'}}>
                    <option value="">Selecione o colaborador...</option>
                    {empList.filter(e=>e.active!==false).sort((a,b)=>a.name.localeCompare(b.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>

                {/* Escolha do Uniko */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:8}}>Uniko a enviar</label>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {[...Object.values(CAPTURE_UNIKOS),...oficinaLib].map(u=>{
                      const rw = getCaptureReward(u);
                      return (
                      <button key={u.id} onClick={()=>pickGiftUniko(u)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,cursor:'pointer',textAlign:'left',
                          border:`2px solid ${giftUnikoId===u.id?u.theme.accent:T.border}`,
                          background:giftUnikoId===u.id?`${u.theme.accent}18`:'transparent',transition:'all .15s'}}>
                        <img src={u.img} alt={u.name} style={{width:46,height:46,objectFit:'contain',filter:`drop-shadow(0 2px 8px ${u.theme.accent}88)`}}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:T.text}}>{u.name}</div>
                          <div style={{fontSize:10,fontWeight:700,color:u.theme.accent,marginTop:2}}>{rw.comum} comuns · {rw.premium} premium (padrão)</div>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prismas (editável, pré-preenchido com o padrão do Uniko escolhido) */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Prismas Comuns</label>
                    <input type="number" min={0} value={giftComum} onChange={e=>setGiftComum(e.target.value)}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:T.textD,display:'block',marginBottom:6}}>Prismas Premium</label>
                    <input type="number" min={0} value={giftPremium} onChange={e=>setGiftPremium(e.target.value)}
                      style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
                  </div>
                </div>

                {/* Preview do tema */}
                <div style={{borderRadius:14,padding:3,background:`conic-gradient(${gu.theme.border.join(',')})`}}>
                  <div style={{borderRadius:12,background:gu.theme.scene,padding:'18px 16px',display:'flex',alignItems:'center',gap:14}}>
                    <img src={gu.img} alt="" style={{width:70,height:70,objectFit:'contain',filter:`drop-shadow(0 0 14px ${gu.theme.accent})`}}/>
                    <div>
                      <div style={{fontSize:11,fontWeight:800,letterSpacing:'.16em',color:gu.theme.glow}}>★ PRESENTE ★</div>
                      <div style={{fontSize:16,fontWeight:900,color:'#fff',fontFamily:'var(--font-brand)'}}>{gu.name}</div>
                      <div style={{fontSize:11,color:gu.theme.ink,opacity:.85}}>{gu.tagline}</div>
                      <div style={{fontSize:11,color:gu.theme.ink,opacity:.7,marginTop:2}}>{giftTarget?`Vai pra ${giftTarget} a coleção + a carteira`:'Escolha o colaborador acima'}</div>
                    </div>
                  </div>
                </div>

                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={sendUnikoGift} disabled={!giftTarget||giftSending}
                    style={{padding:'11px 26px',borderRadius:10,border:'none',cursor:(!giftTarget||giftSending)?'default':'pointer',background:`linear-gradient(135deg,${gu.theme.accent},${gu.theme.accent}cc)`,color:'#fff',fontWeight:700,fontSize:14,fontFamily:'var(--font-body)',opacity:(!giftTarget||giftSending)?.6:1,boxShadow:`0 3px 12px ${gu.theme.accent}44`}}>
                    {giftSending?'Enviando...':'🎁 Enviar Uniko'}
                  </button>
                  {giftMsg&&<span style={{fontSize:13,color:giftMsg.startsWith('✅')?(T.success||'#3a9'):'#C04050',fontWeight:600}}>{giftMsg}</span>}
                </div>

                <div style={{fontSize:11,color:T.textT,lineHeight:1.6,borderTop:`1px solid ${T.border}`,paddingTop:12}}>
                  ℹ️ Isso credita o Uniko na Coleção/My Uniko do colaborador e os prismas na carteira dele, exatamente como uma captura de verdade — mas sem precisar esperar o sorteio do evento.
                </div>
              </div>
                );
              })()}

              {/* Resetar coleção */}
              {captureSubTab==='evento' && (<>
              <div style={{padding:'20px 22px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM}}>
                <div style={{fontFamily:'var(--font-brand)',fontSize:16,fontWeight:700,color:T.text,marginBottom:3}}>Resetar coleção</div>
                <div style={{fontSize:12,color:T.textS,marginBottom:16}}>Apaga os Unikos capturados e libera o evento para nova captura. Use para começar um novo Capture o Uniko.</div>

                {/* Um usuário */}
                <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
                  <select value={resetPlayer} onChange={e=>setResetPlayer(e.target.value)}
                    style={{flex:1,minWidth:220,padding:'10px 12px',borderRadius:10,border:`1px solid ${T.border}`,background:isDark?(T.surfaceSub||'rgba(255,255,255,0.06)'):'#fff',color:T.text,fontSize:13,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box',cursor:'pointer'}}>
                    <option value="">Selecione o colaborador...</option>
                    {empList.filter(e=>e.active!==false).sort((a,b)=>a.name.localeCompare(b.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                  <button onClick={()=>doReset(false)} disabled={resetting}
                    style={{padding:'10px 18px',borderRadius:10,border:`1px solid ${T.danger||'#C04050'}55`,cursor:resetting?'default':'pointer',background:'transparent',color:T.danger||'#C04050',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',opacity:resetting?.6:1}}>
                    Resetar deste usuário
                  </button>
                </div>

                {/* Todos */}
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={()=>doReset(true)} disabled={resetting}
                    style={{padding:'10px 20px',borderRadius:10,border:'none',cursor:resetting?'default':'pointer',background:`linear-gradient(135deg,${T.danger||'#C04050'},#8b2030)`,color:'#fff',fontWeight:700,fontSize:13,fontFamily:'var(--font-body)',opacity:resetting?.6:1}}>
                    {resetting?'Resetando...':'⚠️ Resetar de TODOS os usuários'}
                  </button>
                  {resetMsg&&<span style={{fontSize:13,color:resetMsg.startsWith('✅')?(T.success||'#3a9'):'#C04050',fontWeight:600}}>{resetMsg}</span>}
                </div>
              </div>
              </>)}

            </div>
          );})()}

          {/* ── TAB: LEMBRETES & ALEXA PROGRAMADA ── */}
          {tab==='lembretes'&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text}}>Lembretes & Alexa Programada</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Programe o que a Alexa vai falar e quando — aparece para todos os colaboradores</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {alexaStatus&&(
                    <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,fontSize:11,
                      background:alexaStatus.ok?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)',
                      border:`1px solid ${alexaStatus.ok?'rgba(34,197,94,0.25)':'rgba(192,64,80,0.2)'}`,
                      color:alexaStatus.ok?'#16a34a':'#C04050'}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:alexaStatus.ok?'#16a34a':'#C04050',flexShrink:0}}/>
                      {alexaStatus.ok ? 'Alexa conectada' : 'Alexa offline'}
                    </div>
                  )}
                  <button onClick={()=>{ setAlexaCookieText(''); setAlexaCookieMsg(''); setAlexaCookieModal(true); }}
                    title="Cole aqui o JSON gerado pelo setup-alexa.js quando a Alexa cair/expirar"
                    style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,border:`1.5px solid ${T.border}`,cursor:'pointer',background:'transparent',color:T.textS,fontWeight:600,fontSize:12.5,fontFamily:'var(--font-body)'}}>
                    🔑 Atualizar cookies da Alexa
                  </button>
                  <button onClick={()=>{ setLembForm({title:'',message:'',time:'',date:'',type:'lembrete',repeat:'never',active:true,fanfare:false,sound:'fanfarra'}); setLembMsg(''); setLembModal('new'); }}
                    style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',cursor:'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',boxShadow:`0 3px 12px ${T.goldLine}44`}}>
                    + Novo Lembrete
                  </button>
                </div>
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
                        const isUrgent     = l.message?.startsWith('__urgent__');
                        const displayType  = isUrgent ? 'aviso_urgente' : l.type;
                        const displayMsg   = isUrgent ? l.message.slice('__urgent__'.length) : l.message;
                        const typeColor = {lembrete:T.blue,alexa:T.gold,reuniao:T.purple||'#7060C8',aviso:'#E91E8C',aviso_urgente:'#C04050'};
                        const color = typeColor[displayType]||T.gold;
                        const typeLabel = {lembrete:'Lembrete',alexa:'Alexa fala',reuniao:'Reunião',aviso:'Aviso RH',aviso_urgente:'Aviso Urgente'};
                        return(
                          <div key={l.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderTop:i===0?'none':`1px solid ${T.border}`,opacity:l.active?1:0.5}}>
                            {/* Color bar */}
                            <div style={{width:3,height:44,borderRadius:2,background:color,flexShrink:0}}/>
                            {/* Info */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                                <span style={{fontSize:11,fontWeight:600,padding:'1px 7px',borderRadius:4,background:`${color}18`,color}}>{typeLabel[displayType]||displayType}</span>
                                {l.repeat!=='never'&&<span style={{fontSize:10,color:T.textD}}>↻ {l.repeat==='daily'?'Diário':l.repeat==='weekly'?'Semanal':'Mensal'}</span>}
                                {!l.active&&<span style={{fontSize:10,color:T.textD}}>Pausado</span>}
                              </div>
                              <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                              {displayMsg&&<div style={{fontSize:12,color:T.textT,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayMsg}</div>}
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
                              <button onClick={()=>{ setLembForm({title:l.title,message:displayMsg||'',time:l.time||'',date:l.date||'',type:displayType||'lembrete',repeat:l.repeat||'never',active:l.active,fanfare:false,sound:'fanfarra'}); setLembMsg(''); setLembModal(l); }}
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

              {/* Modal: atualizar cookies da Alexa */}
              {alexaCookieModal&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
                  <div style={{background:cardBg,borderRadius:18,padding:32,width:520,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
                    <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:T.text,marginBottom:8}}>🔑 Atualizar cookies da Alexa</div>
                    <div style={{fontSize:12.5,color:T.textS,marginBottom:16,lineHeight:1.6}}>
                      Quando a Alexa cair (token expirado), rode <code style={{background:T.surfaceSub||'rgba(0,0,0,0.04)',padding:'1px 5px',borderRadius:4}}>node setup-alexa.js</code> no seu PC,
                      faça login com a conta Amazon e cole aqui o JSON que aparecer no terminal. Reconecta na hora, sem precisar mexer no VPS.
                    </div>
                    <textarea value={alexaCookieText} onChange={e=>setAlexaCookieText(e.target.value)} rows={8}
                      placeholder='Cole aqui o JSON completo, ex: {"loginCookie":"...","refreshToken":"...",...}'
                      style={{width:'100%',padding:'10px 12px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.surface||'white',fontSize:12,color:T.text,outline:'none',resize:'vertical',fontFamily:'monospace',boxSizing:'border-box',marginBottom:12}}/>
                    {alexaCookieMsg&&<div style={{fontSize:12,color:alexaCookieMsg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12,padding:'7px 12px',borderRadius:7,background:alexaCookieMsg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)'}}>{alexaCookieMsg}</div>}
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>setAlexaCookieModal(false)} style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${T.border}`,background:'transparent',cursor:'pointer',fontSize:13,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>Cancelar</button>
                      <button onClick={updateAlexaCookies} disabled={alexaCookieSaving||!alexaCookieText.trim()}
                        style={{flex:1,padding:'11px',borderRadius:10,border:'none',cursor:alexaCookieSaving?'wait':'pointer',background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',fontWeight:600,fontSize:13,fontFamily:'var(--font-body)',outline:'none',opacity:alexaCookieText.trim()?1:0.5}}>
                        {alexaCookieSaving?'Salvando...':'Salvar e reconectar'}
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
                      {empList.filter(e=>e.active!==false).sort((a,b)=>a.name.localeCompare(b.name)).map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
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

          {/* ── TAB: LOGS DO SERVIDOR (PM2 na VPS) ── */}
          {tab==='logs'&&(() => {
            const list = logsData ? (logsStream==='error' ? logsData.error : logsData.out) : [];
            const fmtUptime = (ms) => {
              if (!ms) return '—';
              const s = Math.floor((Date.now()-ms)/1000);
              const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
              return h>0 ? `${h}h ${m}m` : `${m}m`;
            };
            const fmtMem = (bytes) => bytes ? `${(bytes/1024/1024).toFixed(0)} MB` : '—';
            return (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Header */}
              <div style={{padding:'14px 20px',borderRadius:13,background:cardBg,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${T.border}`,boxShadow:T.shM,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)',fontSize:18,fontWeight:700,color:T.text,letterSpacing:'.04em'}}>Logs do Servidor</div>
                  <div style={{fontSize:13,color:T.textS,marginTop:2}}>Saída do PM2 na VPS (crescent-hub-server)</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:T.textS,cursor:'pointer'}}>
                    <input type="checkbox" checked={logsAuto} onChange={e=>setLogsAuto(e.target.checked)} />
                    Auto-atualizar (5s)
                  </label>
                  <button onClick={loadLogs} disabled={logsLoading}
                    style={{padding:'9px 16px',borderRadius:9,border:`1px solid ${T.border}`,background:'transparent',cursor:logsLoading?'wait':'pointer',fontSize:12,fontWeight:600,color:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                    {logsLoading ? 'Atualizando...' : '↻ Atualizar'}
                  </button>
                </div>
              </div>

              {logsErr&&(
                <div style={{padding:'10px 14px',borderRadius:9,background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.2)',fontSize:12,color:'#C04050'}}>
                  ⚠️ {logsErr}
                </div>
              )}

              {logsData&&(
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {[
                    {label:'Status', value: logsData.status, color: logsData.status==='online' ? '#1DB954' : '#C04050'},
                    {label:'PID', value: logsData.pid},
                    {label:'Uptime', value: fmtUptime(logsData.uptime)},
                    {label:'Restarts', value: logsData.restarts},
                    {label:'Memória', value: fmtMem(logsData.memory)},
                    {label:'CPU', value: logsData.cpu!=null ? `${logsData.cpu}%` : '—'},
                  ].map(({label,value,color})=>(
                    <div key={label} style={{flex:'1 1 120px',padding:'10px 14px',borderRadius:10,background:cardBg,border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:10,color:T.textD,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>{label}</div>
                      <div style={{fontSize:14,fontWeight:700,color:color||T.text}}>{value ?? '—'}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Filtro de stream */}
              <div style={{display:'flex',gap:6}}>
                {[{id:'error',label:`Erros${logsData?` (${logsData.error.length})`:''}`},{id:'out',label:`Saída${logsData?` (${logsData.out.length})`:''}`}].map(s=>(
                  <button key={s.id} onClick={()=>setLogsStream(s.id)}
                    style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${logsStream===s.id?T.gold:T.border}`,background:logsStream===s.id?T.goldGl:'transparent',cursor:'pointer',fontSize:12,fontWeight:600,color:logsStream===s.id?T.gold:T.textS,fontFamily:'var(--font-body)',outline:'none'}}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Console */}
              <div style={{borderRadius:13,background:'#0D1117',border:`1px solid ${T.border}`,boxShadow:T.shM,overflow:'hidden'}}>
                <div style={{maxHeight:520,overflowY:'auto',padding:'14px 16px',fontFamily:'monospace',fontSize:12,lineHeight:1.6}}>
                  {list.length===0&&!logsLoading&&(
                    <div style={{color:'#6E7681'}}>{logsData ? 'Sem linhas nesse stream.' : 'Carregando logs…'}</div>
                  )}
                  {list.map((l,i)=>(
                    <div key={i} style={{color: l.stream==='error' ? '#F85149' : '#C9D1D9', whiteSpace:'pre-wrap',wordBreak:'break-all'}}>
                      {l.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            );
          })()}

          {/* ── TAB: FEEDBACK ── */}
          {tab === 'feedback' && (() => {
            const FB_CAT_COLOR = {
              'Sugestão':          '#2A82D2',
              'Elogio':            '#28A870',
              'Crítica':           '#D89030',
              'Reportar Problema': '#C04050',
            };
            const FB_CAT_ICON = {
              'Sugestão':'💡','Elogio':'⭐','Crítica':'📝','Reportar Problema':'🔧',
            };
            const cats = ['Todos','Sugestão','Elogio','Crítica','Reportar Problema'];
            const unread = fbList.filter(f => !f.read).length;

            const filtered = fbList.filter(f => {
              const catOk  = fbCatFilter  === 'Todos' || f.category === fbCatFilter;
              const readOk = fbReadFilter === 'Todos' || (fbReadFilter === 'Não lidos' ? !f.read : f.read);
              return catOk && readOk;
            });

            return (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                {/* Header */}
                <div style={{ padding:'14px 20px', borderRadius:13, background:cardBg, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:`1px solid ${T.border}`, boxShadow:T.shM, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-brand)', fontSize:18, fontWeight:700, color:T.text, letterSpacing:'.04em', display:'flex', alignItems:'center', gap:10 }}>
                      Feedback dos Colaboradores
                      {unread > 0 && (
                        <span style={{ fontSize:11, fontWeight:700, background:'#C04050', color:'white', borderRadius:20, padding:'2px 9px' }}>{unread} novo{unread > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:T.textS, marginTop:2 }}>{fbList.length} recebido{fbList.length !== 1 ? 's' : ''} · {unread} não lido{unread !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={loadFeedbacks} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9, border:`1px solid ${T.border}`, background:'transparent', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:12, color:T.textS }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    Atualizar
                  </button>
                </div>

                {/* Filtros */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  {/* por categoria */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {cats.map(c => (
                      <button key={c} onClick={() => setFbCatFilter(c)}
                        style={{ padding:'6px 14px', borderRadius:8, border:`1.5px solid ${fbCatFilter===c ? (FB_CAT_COLOR[c]||T.goldLine)+'88' : T.border}`, background: fbCatFilter===c ? `${FB_CAT_COLOR[c]||T.gold}12` : 'transparent', color: fbCatFilter===c ? (FB_CAT_COLOR[c]||T.gold) : T.textS, fontFamily:'var(--font-body)', fontSize:12, fontWeight:fbCatFilter===c?600:400, cursor:'pointer', transition:'all .15s', outline:'none' }}>
                        {c !== 'Todos' && <span style={{ marginRight:4 }}>{FB_CAT_ICON[c]}</span>}{c}
                      </button>
                    ))}
                  </div>
                  <div style={{ width:1, height:20, background:T.border, margin:'0 4px' }}/>
                  {/* por leitura */}
                  {['Todos','Não lidos','Lidos'].map(r => (
                    <button key={r} onClick={() => setFbReadFilter(r)}
                      style={{ padding:'6px 14px', borderRadius:8, border:`1.5px solid ${fbReadFilter===r ? T.goldLine+'88' : T.border}`, background: fbReadFilter===r ? T.goldGl : 'transparent', color: fbReadFilter===r ? T.gold : T.textS, fontFamily:'var(--font-body)', fontSize:12, fontWeight:fbReadFilter===r?600:400, cursor:'pointer', transition:'all .15s', outline:'none' }}>
                      {r}
                    </button>
                  ))}
                </div>

                {/* Lista */}
                {fbLoading ? (
                  <div style={{ textAlign:'center', padding:'40px 0', color:T.textT }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${T.gold}`, borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 10px' }}/>
                    Carregando feedbacks...
                  </div>
                ) : filtered.length === 0 ? (
                  <Card style={{ padding:'40px', textAlign:'center', background:cardBg }} elevated>
                    <div style={{ fontSize:32, marginBottom:10 }}>💬</div>
                    <div style={{ fontSize:14, color:T.textT }}>Nenhum feedback encontrado</div>
                    <div style={{ fontSize:12, color:T.textD, marginTop:4 }}>Ajuste os filtros ou aguarde novas mensagens</div>
                  </Card>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {filtered.map(fb => {
                      const col     = FB_CAT_COLOR[fb.category] || T.gold;
                      const icon    = FB_CAT_ICON[fb.category]  || '💬';
                      const isOpen  = fbExpanded === fb.id;
                      const isAnon  = fb.anonymous || !fb.employee_name;
                      return (
                        <div key={fb.id} style={{ borderRadius:13, border:`1px solid ${fb.read ? T.border : col+'55'}`, background: fb.read ? cardBg : `${col}06`, overflow:'hidden', transition:'border-color .15s' }}>
                          {/* Cabeçalho do card */}
                          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer' }}
                            onClick={() => setFbExpanded(isOpen ? null : fb.id)}>
                            {/* ícone categoria */}
                            <div style={{ width:40, height:40, borderRadius:10, background:`${col}15`, border:`1px solid ${col}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                              {icon}
                            </div>
                            {/* info */}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <span style={{ fontSize:12, fontWeight:700, color:col, background:`${col}12`, border:`1px solid ${col}22`, borderRadius:6, padding:'1px 8px' }}>{fb.category}</span>
                                {!fb.read && <span style={{ fontSize:10, fontWeight:700, background:'#C04050', color:'white', borderRadius:6, padding:'1px 7px' }}>NOVO</span>}
                                {isAnon && (
                                  <span style={{ fontSize:10, color:T.textD, display:'flex', alignItems:'center', gap:3 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></svg>
                                    Anônimo
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:13, fontWeight:600, color:T.text, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace: isOpen ? 'normal' : 'nowrap' }}>
                                {isAnon ? 'Colaborador Anônimo' : fb.employee_name}
                              </div>
                              <div style={{ fontSize:11, color:T.textT, marginTop:1 }}>
                                {fb.created_at ? new Date(fb.created_at).toLocaleString('pt-BR') : '—'}
                              </div>
                            </div>
                            {/* chevron */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0, transition:'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </div>

                          {/* Mensagem expandida */}
                          {isOpen && (
                            <div style={{ borderTop:`1px solid ${T.border}`, padding:'16px 18px 18px' }}>
                              <div style={{ fontSize:14, color:T.text, lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:16 }}>
                                {fb.message}
                              </div>
                              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                                <button onClick={() => markFbRead(fb.id, fb.read)}
                                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:`1px solid ${fb.read ? T.border : 'rgba(40,168,112,0.3)'}`, background: fb.read ? 'transparent' : 'rgba(40,168,112,0.08)', color: fb.read ? T.textS : '#28A870', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:12, fontWeight:600 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  {fb.read ? 'Marcar como não lido' : 'Marcar como lido'}
                                </button>
                                <button onClick={() => deleteFb(fb.id)}
                                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:'1px solid rgba(192,64,80,0.25)', background:'rgba(192,64,80,0.07)', color:'#C04050', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:12, fontWeight:600 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                                  Remover
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── TAB: CONTRACHEQUES ── */}
          {tab === 'contracheques' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Header */}
              <div style={{ padding:'14px 20px', borderRadius:13, background:cardBg, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:`1px solid ${T.border}`, boxShadow:T.shM, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-brand)', fontSize:18, fontWeight:700, color:T.text, letterSpacing:'.04em' }}>Contracheques</div>
                  <div style={{ fontSize:13, color:T.textS, marginTop:2 }}>
                    {chList.length} documento{chList.length !== 1 ? 's' : ''} · Envie PDFs de pagamento para cada colaborador
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:10, background:T.goldGl, border:`1px solid ${T.goldLine}44` }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span style={{ fontSize:12, fontWeight:600, color:T.gold }}>Supabase Storage</span>
                </div>
              </div>

              {/* Form: anexar novo */}
              <Card style={{ padding:'24px 26px', background:cardBg, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' }} elevated>
                <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:4 }}>Anexar Novo Contracheque</div>
                <div style={{ fontSize:13, color:T.textT, marginBottom:18 }}>Selecione o funcionário, informe a competência e faça upload do PDF.</div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  {/* Funcionário */}
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:T.textD, textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Funcionário</label>
                    <select value={chForm.employee_name}
                      onChange={e => setChForm(f => ({ ...f, employee_name: e.target.value }))}
                      style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${chForm.employee_name ? T.goldLine+'88' : T.border}`, borderRadius:10, fontFamily:'var(--font-body)', fontSize:13, color:T.text, background: isDark ? T.surface : '#ffffff', outline:'none', cursor:'pointer', colorScheme: isDark ? 'dark' : 'light' }}>
                      <option value="">Selecione o funcionário...</option>
                      {empList.filter(e => e.active !== false).sort((a,b) => a.name.localeCompare(b.name)).map(e => (
                        <option key={e.id} value={e.name}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Competência */}
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:T.textD, textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Competência</label>
                    <input
                      value={chForm.competencia}
                      onChange={e => setChForm(f => ({ ...f, competencia: e.target.value }))}
                      placeholder="Ex: Janeiro/2025"
                      style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${chForm.competencia ? T.goldLine+'88' : T.border}`, borderRadius:10, fontFamily:'var(--font-body)', fontSize:13, color:T.text, background:isDark ? (T.surfaceSub||'rgba(255,255,255,0.06)') : (T.surface||'white'), outline:'none', boxSizing:'border-box' }}/>
                  </div>
                </div>

                {/* File picker */}
                <div style={{ marginBottom:18 }}>
                  <label style={{ fontSize:11, fontWeight:600, color:T.textD, textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Arquivo PDF</label>
                  <label style={{
                    display:'flex', alignItems:'center', gap:12, padding:'14px 18px',
                    border:`2px dashed ${chFile ? T.goldLine : T.border}`,
                    borderRadius:12, cursor:'pointer',
                    background: chFile ? T.goldGl : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                    transition:'all .15s',
                  }}>
                    <input type="file" accept="application/pdf" style={{ display:'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setChFile(f); setChFileName(f.name); }
                        e.target.value = '';
                      }}/>
                    <div style={{ width:38, height:38, borderRadius:10, background: chFile ? T.goldGl : (T.surfaceSub||'rgba(0,0,0,0.04)'), border:`1px solid ${chFile ? T.goldLine+'44' : T.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chFile ? T.gold : T.textD} strokeWidth="1.8" strokeLinecap="round">
                        {chFile
                          ? <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></>
                          : <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>}
                      </svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color: chFile ? T.text : T.textD, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {chFileName || 'Clique para selecionar o PDF'}
                      </div>
                      <div style={{ fontSize:11, color:T.textT, marginTop:2 }}>
                        {chFile ? `${(chFile.size/1024/1024).toFixed(2)} MB` : 'Apenas arquivos .pdf'}
                      </div>
                    </div>
                    {chFile && (
                      <button type="button"
                        onClick={e => { e.preventDefault(); setChFile(null); setChFileName(''); }}
                        style={{ background:'none', border:'none', cursor:'pointer', color:T.textD, padding:4, borderRadius:6, flexShrink:0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </label>
                </div>

                {/* Mensagem */}
                {chMsg && (
                  <div style={{ padding:'10px 14px', borderRadius:9, marginBottom:14, fontSize:12,
                    background: chMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)',
                    border:`1px solid ${chMsg.startsWith('✅') ? 'rgba(34,197,94,0.25)' : 'rgba(192,64,80,0.20)'}`,
                    color: chMsg.startsWith('✅') ? '#16a34a' : '#C04050' }}>
                    {chMsg}
                  </div>
                )}

                <button onClick={uploadContracheque} disabled={chSaving}
                  style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', cursor: chSaving ? 'wait' : 'pointer', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:'white', fontWeight:700, fontSize:14, fontFamily:'var(--font-body)', boxShadow:`0 4px 16px ${T.goldLine}44`, transition:'opacity .15s', opacity: chSaving ? 0.7 : 1 }}>
                  {chSaving ? 'Enviando...' : '📎 Anexar Contracheque'}
                </button>
              </Card>

              {/* ── Importação automática em lote ── */}
              <Card style={{ padding:'24px 26px', background:cardBg, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' }} elevated>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:16, fontWeight:700, color:T.text }}>Importação Automática em Lote</span>
                  <span style={{ fontSize:10, fontWeight:700, color:T.gold, background:T.goldGl, border:`1px solid ${T.goldLine}44`, padding:'2px 7px', borderRadius:6, letterSpacing:'.04em' }}>NOVO</span>
                </div>
                <div style={{ fontSize:13, color:T.textT, marginBottom:18, lineHeight:1.5 }}>
                  Envie <strong>um único PDF com todos os contracheques</strong>. O sistema separa o recibo de cada colaborador (mesmo quando há dois na mesma página), identifica a pessoa pelo CPF/nome e anexa automaticamente para que cada um veja apenas o seu.
                </div>

                {/* dropzone */}
                {!chBatchSlips && (
                  <label style={{
                    display:'flex', alignItems:'center', gap:12, padding:'14px 18px',
                    border:`2px dashed ${chBatchFile ? T.goldLine : T.border}`, borderRadius:12, cursor: chBatchParsing ? 'wait' : 'pointer',
                    background: chBatchFile ? T.goldGl : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                  }}>
                    <input type="file" accept="application/pdf" disabled={chBatchParsing} style={{ display:'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) { setChBatchFile(f); parseBatch(f); }
                      }}/>
                    <div style={{ width:38, height:38, borderRadius:10, background:T.surfaceSub||'rgba(0,0,0,0.04)', border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color: chBatchParsing ? T.gold : T.textD }}>
                        {chBatchParsing ? 'Analisando o PDF...' : (chBatchFile ? chBatchFile.name : 'Clique para selecionar o PDF com todos os contracheques')}
                      </div>
                      <div style={{ fontSize:11, color:T.textT, marginTop:2 }}>Separação e identificação automáticas</div>
                    </div>
                  </label>
                )}

                {/* mensagem */}
                {chBatchMsg && (
                  <div style={{ padding:'10px 14px', borderRadius:9, marginTop:14, fontSize:12,
                    background: chBatchMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(192,64,80,0.06)',
                    border:`1px solid ${chBatchMsg.startsWith('✅') ? 'rgba(34,197,94,0.25)' : 'rgba(192,64,80,0.20)'}`,
                    color: chBatchMsg.startsWith('✅') ? '#16a34a' : '#C04050' }}>
                    {chBatchMsg}
                  </div>
                )}

                {/* prévia / revisão */}
                {chBatchSlips && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                      <div style={{ fontSize:13, color:T.textS }}>
                        <strong style={{ color:T.text }}>{chBatchSlips.length}</strong> contracheque(s) detectado(s) ·{' '}
                        <span style={{ color:'#16a34a', fontWeight:600 }}>{chBatchSlips.filter(r => r.auto && r.employee_name).length} identificados</span>
                        {chBatchSlips.filter(r => !r.employee_name).length > 0 &&
                          <span style={{ color:'#C04050', fontWeight:600 }}> · {chBatchSlips.filter(r => !r.employee_name).length} pendente(s)</span>}
                      </div>
                      <button onClick={resetBatch} disabled={chBatchSending}
                        style={{ fontSize:12, color:T.textD, background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'5px 12px', cursor: chBatchSending ? 'not-allowed' : 'pointer' }}>
                        Trocar arquivo
                      </button>
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {chBatchSlips.map(r => {
                        const stColor = r.status==='done' ? '#16a34a' : r.status==='error' ? '#C04050' : r.status==='sending' ? T.gold : T.textD;
                        return (
                          <div key={r.id} style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 26px', gap:10, alignItems:'center', padding:'10px 12px', borderRadius:10, border:`1px solid ${r.employee_name ? T.border : 'rgba(192,64,80,0.35)'}`, background: r.employee_name ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') : 'rgba(192,64,80,0.04)' }}>
                            <div style={{ minWidth:0 }}>
                              <label style={{ fontSize:10, fontWeight:600, color:T.textD, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:3 }}>Funcionário {r.auto && r.employee_name && <span style={{ color:'#16a34a' }}>· auto</span>}</label>
                              <select value={r.employee_name} disabled={chBatchSending}
                                onChange={e => setBatchRow(r.id, { employee_name: e.target.value, auto: false })}
                                style={{ width:'100%', padding:'7px 9px', border:`1.5px solid ${r.employee_name ? T.border : 'rgba(192,64,80,0.4)'}`, borderRadius:8, fontSize:12.5, color:T.text, background: isDark ? T.surface : '#fff', outline:'none', cursor:'pointer', colorScheme: isDark ? 'dark' : 'light' }}>
                                <option value="">⚠ Selecione…</option>
                                {empList.filter(e => e.active !== false).sort((a,b)=>a.name.localeCompare(b.name)).map(e => (
                                  <option key={e.id} value={e.name}>{e.name}</option>
                                ))}
                              </select>
                              <div style={{ fontSize:10.5, color:T.textT, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                pág. {r.page} · lido: {r.detectedName}{r.cpf ? ` · CPF ${r.cpf}` : ''}
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize:10, fontWeight:600, color:T.textD, textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:3 }}>Competência</label>
                              <input value={r.competencia} disabled={chBatchSending}
                                onChange={e => setBatchRow(r.id, { competencia: e.target.value })}
                                placeholder="Ex: Maio/2026"
                                style={{ width:'100%', padding:'7px 9px', border:`1.5px solid ${r.competencia ? T.border : 'rgba(192,64,80,0.4)'}`, borderRadius:8, fontSize:12.5, color:T.text, background: isDark ? (T.surfaceSub||'rgba(255,255,255,0.06)') : '#fff', outline:'none', boxSizing:'border-box' }}/>
                            </div>
                            <div title={r.errMsg || r.status} style={{ display:'flex', alignItems:'center', justifyContent:'center', color:stColor }}>
                              {r.status==='done' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                : r.status==='error' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                : r.status==='sending' ? <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${T.gold}`, borderTopColor:'transparent', animation:'spin .7s linear infinite' }}/>
                                : <span style={{ width:7, height:7, borderRadius:'50%', background: r.employee_name ? '#16a34a' : '#C04050' }}/>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!chBatchSlips.some(r => r.status === 'done') ? (
                      <button onClick={sendBatch} disabled={chBatchSending || chBatchSlips.every(r => !r.employee_name || !r.competencia)}
                        style={{ width:'100%', marginTop:16, padding:'12px', borderRadius:10, border:'none', cursor: chBatchSending ? 'wait' : 'pointer', background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`, color:'white', fontWeight:700, fontSize:14, fontFamily:'var(--font-body)', boxShadow:`0 4px 16px ${T.goldLine}44`, opacity: chBatchSending ? 0.75 : 1 }}>
                        {chBatchSending ? `Enviando… (${chBatchDone}/${chBatchSlips.filter(r => r.employee_name && r.competencia).length})` : `📎 Anexar ${chBatchSlips.filter(r => r.employee_name && r.competencia).length} contracheque(s)`}
                      </button>
                    ) : (
                      <button onClick={resetBatch} disabled={chBatchSending}
                        style={{ width:'100%', marginTop:16, padding:'12px', borderRadius:10, border:`1.5px solid ${T.goldLine}`, cursor:'pointer', background:T.goldGl, color:T.gold, fontWeight:700, fontSize:14, fontFamily:'var(--font-body)' }}>
                        ➕ Adicionar contracheque de outro mês
                      </button>
                    )}
                  </div>
                )}
              </Card>

              {/* Lista de contracheques */}
              <Card style={{ padding:'24px 26px', background:cardBg, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' }} elevated>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:T.text }}>Contracheques Enviados</div>
                    <div style={{ fontSize:13, color:T.textT, marginTop:2 }}>Todos os documentos anexados</div>
                  </div>
                  {/* Filtro por funcionário */}
                  <div style={{ position:'relative' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="2" strokeLinecap="round" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      value={chEmpFilter}
                      onChange={e => setChEmpFilter(e.target.value)}
                      placeholder="Filtrar por funcionário..."
                      style={{ paddingLeft:30, paddingRight:12, paddingTop:8, paddingBottom:8, border:`1.5px solid ${T.border}`, borderRadius:9, fontFamily:'var(--font-body)', fontSize:12, color:T.text, background:isDark?(T.surfaceSub||'rgba(255,255,255,0.05)'):(T.surface||'white'), outline:'none', width:200 }}/>
                  </div>
                </div>

                {chLoading ? (
                  <div style={{ textAlign:'center', padding:'32px 0', color:T.textT }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${T.gold}`, borderTopColor:'transparent', animation:'spin .7s linear infinite', margin:'0 auto 10px' }}/>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    Carregando contracheques...
                  </div>
                ) : chList.filter(c => !chEmpFilter || c.employee_name?.toLowerCase().includes(chEmpFilter.toLowerCase())).length === 0 ? (
                  <div style={{ textAlign:'center', padding:'36px 0', color:T.textT }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textD} strokeWidth="1.4" strokeLinecap="round" style={{ margin:'0 auto 12px', display:'block' }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div style={{ fontSize:14, fontWeight:500 }}>{chEmpFilter ? 'Nenhum resultado para o filtro' : 'Nenhum contracheque cadastrado ainda'}</div>
                    <div style={{ fontSize:12, marginTop:4, opacity:.6 }}>Use o formulário acima para anexar</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {chList
                      .filter(c => !chEmpFilter || c.employee_name?.toLowerCase().includes(chEmpFilter.toLowerCase()))
                      .map((ch, i) => (
                        <div key={ch.id || i} style={{
                          display:'flex', alignItems:'center', gap:14, padding:'14px 18px',
                          background: isDark ? (T.surfaceSub||'rgba(255,255,255,0.03)') : (T.surface||'rgba(0,0,0,0.015)'),
                          border:`1px solid ${T.border}`, borderRadius:12, transition:'border-color .15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = `${T.goldLine}55`}
                          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                          {/* Ícone PDF */}
                          <div style={{ width:40, height:40, borderRadius:10, background:T.goldGl, border:`1px solid ${T.goldLine}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          </div>
                          {/* Info */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {ch.employee_name}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:3 }}>
                              <span style={{ fontSize:12, fontWeight:500, color:T.gold, background:T.goldGl, border:`1px solid ${T.goldLine}33`, borderRadius:6, padding:'1px 8px' }}>
                                {ch.competencia}
                              </span>
                              <span style={{ fontSize:11, color:T.textT }}>
                                {ch.created_at ? new Date(ch.created_at).toLocaleDateString('pt-BR') : '—'}
                              </span>
                            </div>
                          </div>
                          {/* Ações */}
                          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                            {ch.file_url && (
                              <a href={ch.file_url} target="_blank" rel="noreferrer" title="Visualizar PDF"
                                style={{ width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(42,109,181,0.10)', border:`1px solid rgba(42,109,181,0.25)`, color:'#2A6DB5', textDecoration:'none', transition:'background .14s' }}
                                onMouseEnter={e => e.currentTarget.style.background='rgba(42,109,181,0.20)'}
                                onMouseLeave={e => e.currentTarget.style.background='rgba(42,109,181,0.10)'}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                              </a>
                            )}
                            {ch.file_url && (
                              <a href={ch.file_url} download title="Baixar PDF"
                                style={{ width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(40,168,112,0.10)', border:'1px solid rgba(40,168,112,0.25)', color:'#28A870', textDecoration:'none', transition:'background .14s' }}
                                onMouseEnter={e => e.currentTarget.style.background='rgba(40,168,112,0.20)'}
                                onMouseLeave={e => e.currentTarget.style.background='rgba(40,168,112,0.10)'}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                              </a>
                            )}
                            <button title="Remover" onClick={() => deleteContracheque(ch.id)}
                              style={{ width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(192,64,80,0.08)', border:'1px solid rgba(192,64,80,0.22)', color:'#C04050', cursor:'pointer', transition:'background .14s' }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(192,64,80,0.18)'}
                              onMouseLeave={e => e.currentTarget.style.background='rgba(192,64,80,0.08)'}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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
