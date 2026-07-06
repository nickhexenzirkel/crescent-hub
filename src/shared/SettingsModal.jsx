import React, { useState } from 'react';
import { T, THEMES } from '../contexts/theme';
import { SERVER_URL, getAuthUser } from '../contexts/user';

const ThemeGrid = ({activeTheme,onTheme}) => (
  <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',gap:'0 18px'}}>
    {/* Modo Claro */}
    <div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
          letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>MODO CLARO</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {['blue','purple','pink','red','green','orange'].map(key=>{
          const th=THEMES[key]; const isActive=activeTheme===key;
          return(<div key={key} onClick={()=>onTheme(key)}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
              borderRadius:11,cursor:'pointer',
              background:isActive?`${th.goldGl}`:'rgba(0,0,0,0.03)',
              border:`1.5px solid ${isActive?th.goldLine+'66':'rgba(0,0,0,0.06)'}`,
              transition:'all .18s'}}>
            <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
              background:`linear-gradient(135deg,${th.goldV},${th.goldL},${th.gold})`,
              boxShadow:isActive?`0 0 0 2px white,0 0 0 3.5px ${th.goldL}`:
                `0 2px 6px ${th.gold}44`}}/>
            <div style={{flex:1,fontFamily:'var(--font-body)',fontSize:13,
              fontWeight:isActive?500:400,color:isActive?th.gold:'#0D1B2E'}}>{th.name}</div>
            {isActive&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 8L7 11L12 5.5" stroke={th.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>}
          </div>);
        })}
      </div>
    </div>
    {/* Divider */}
    <div style={{background:'rgba(0,0,0,0.08)',borderRadius:1}}/>
    {/* Modo Escuro */}
    <div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.7" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
        <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
          letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>MODO ESCURO</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {['blueDark','purpleDark','pinkDark','redDark','greenDark','orangeDark'].map(key=>{
          const th=THEMES[key]; const isActive=activeTheme===key;
          return(<div key={key} onClick={()=>onTheme(key)}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
              borderRadius:11,cursor:'pointer',
              background:isActive?`${th.goldGl}`:'rgba(0,0,0,0.03)',
              border:`1.5px solid ${isActive?th.goldLine+'66':'rgba(0,0,0,0.06)'}`,
              transition:'all .18s'}}>
            <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
              background:`linear-gradient(135deg,${th.page},${th.gold}88,${th.goldL})`,
              boxShadow:isActive?`0 0 0 2px white,0 0 0 3.5px ${th.goldL}`:
                `0 2px 6px ${th.gold}55`,
              border:`1px solid ${th.goldLine}44`}}/>
            <div style={{flex:1,fontFamily:'var(--font-body)',fontSize:13,
              fontWeight:isActive?500:400,color:isActive?th.gold:'#0D1B2E'}}>{th.name}</div>
            {isActive&&<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 8L7 11L12 5.5" stroke={th.gold} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>}
          </div>);
        })}
      </div>
    </div>
  </div>
);

const AccountPanel = () => {
  const auth = getAuthUser() || {};
  const cpfFmt = auth.cpf
    ? String(auth.cpf).replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : '—';

  const [cur,  setCur]  = useState('');
  const [nw,   setNw]   = useState('');
  const [nw2,  setNw2]  = useState('');
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState(null); // {type:'ok'|'err', text}

  const inputStyle = {
    width:'100%',padding:'10px 13px',borderRadius:9,boxSizing:'border-box',
    border:'1.5px solid rgba(0,0,0,0.10)',background:'rgba(0,0,0,0.02)',
    fontFamily:'var(--font-body)',fontSize:13,color:'#0D1B2E',outline:'none',
  };
  const labelStyle = {fontSize:11,fontWeight:600,color:'#7A92A8',textTransform:'uppercase',
    letterSpacing:'.07em',display:'block',marginBottom:5};

  const submit = async () => {
    setMsg(null);
    if (!cur)              { setMsg({type:'err',text:'Digite sua senha atual.'}); return; }
    if (nw.length < 6)     { setMsg({type:'err',text:'A nova senha precisa ter ao menos 6 caracteres.'}); return; }
    if (nw !== nw2)        { setMsg({type:'err',text:'A confirmação não corresponde à nova senha.'}); return; }
    if (nw === cur)        { setMsg({type:'err',text:'A nova senha deve ser diferente da atual.'}); return; }
    setBusy(true);
    try {
      const token = localStorage.getItem('ch_token');
      const r = await fetch(`${SERVER_URL}/api/auth/change-password`, {
        method:'PUT',
        headers:{'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{})},
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
      });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { setMsg({type:'err',text:d.error||'Não foi possível alterar a senha.'}); setBusy(false); return; }
      setMsg({type:'ok',text:'Senha alterada com sucesso!'});
      setCur(''); setNw(''); setNw2('');
    } catch {
      setMsg({type:'err',text:'Servidor offline. Tente novamente mais tarde.'});
    }
    setBusy(false);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      {/* Identificação */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,
        padding:'14px 16px',borderRadius:12,background:'rgba(0,0,0,0.03)',
        border:'1px solid rgba(0,0,0,0.06)'}}>
        <div>
          <div style={labelStyle}>Nome</div>
          <div style={{fontSize:13,color:'#0D1B2E',fontWeight:500}}>{auth.name||'—'}</div>
        </div>
        <div>
          <div style={labelStyle}>CPF</div>
          <div style={{fontSize:13,color:'#0D1B2E',fontWeight:500}}>{cpfFmt}</div>
        </div>
      </div>

      {/* Troca de senha */}
      <div>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:12}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A92A8" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span style={{fontFamily:'var(--font-body)',fontSize:11,color:'#7A92A8',
            letterSpacing:'.09em',textTransform:'uppercase',fontWeight:600}}>Alterar senha</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={labelStyle}>Senha atual</label>
            <input type="password" value={cur} onChange={e=>{setCur(e.target.value);setMsg(null);}}
              placeholder="••••••••" style={inputStyle}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={labelStyle}>Nova senha</label>
              <input type="password" value={nw} onChange={e=>{setNw(e.target.value);setMsg(null);}}
                placeholder="Mín. 6 caracteres" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Confirmar nova</label>
              <input type="password" value={nw2} onChange={e=>{setNw2(e.target.value);setMsg(null);}}
                onKeyDown={e=>{ if(e.key==='Enter') submit(); }}
                placeholder="Repita a nova senha" style={inputStyle}/>
            </div>
          </div>
        </div>

        {msg && (
          <div style={{marginTop:12,fontSize:12.5,fontWeight:500,
            color: msg.type==='ok' ? '#1A9C70' : '#C04050'}}>
            {msg.type==='ok' ? '✓ ' : '⚠ '}{msg.text}
          </div>
        )}

        <button onClick={submit} disabled={busy}
          style={{marginTop:16,padding:'11px 22px',borderRadius:10,border:'none',
            cursor:busy?'wait':'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:700,
            background:`linear-gradient(135deg,${T.gold},${T.goldL||T.gold}cc)`,color:'white',
            boxShadow:`0 4px 14px ${T.goldLine||T.gold}44`,
            display:'inline-flex',alignItems:'center',gap:8}}>
          {busy && <span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block'}}/>}
          {busy ? 'Salvando...' : 'Atualizar senha'}
        </button>
      </div>
    </div>
  );
};

const SettingsModal = ({activeTheme,onTheme,onClose}) => {
  const [pane, setPane] = useState('theme'); // 'theme' (principal) | 'account'

  const Tab = ({id,label,icon}) => {
    const active = pane===id;
    return (
      <button onClick={()=>setPane(id)}
        style={{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 16px',
          borderRadius:10,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',
          fontSize:13,fontWeight:active?700:500,
          color:active?T.gold:'#7A92A8',
          background:active?(T.goldGl||'rgba(0,0,0,0.05)'):'transparent',
          transition:'all .15s'}}>
        {icon}{label}
      </button>
    );
  };

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:1000,
      background:'rgba(10,20,40,0.35)',backdropFilter:'blur(14px)',
      WebkitBackdropFilter:'blur(14px)',
      display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'rgba(255,255,255,0.96)',backdropFilter:'blur(24px)',
        border:'1px solid rgba(255,255,255,0.85)',borderRadius:22,
        padding:'28px',width:660,maxWidth:'90vw',
        boxShadow:'0 24px 64px rgba(0,0,0,0.20)',position:'relative'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div>
            <div style={{fontFamily:'var(--font-brand)',fontSize:17,fontWeight:700,color:'#0D1B2E'}}>Configurações</div>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,color:'#7A92A8',marginTop:2}}>
              {pane==='theme' ? 'Personalize o visual do sistema' : 'Gerencie os dados e a senha da sua conta'}
            </div>
          </div>
          <button onClick={onClose} style={{background:'rgba(0,0,0,0.06)',border:'none',
            borderRadius:'50%',width:32,height:32,cursor:'pointer',fontSize:16,
            color:'#3A5068',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>

        {/* Abas */}
        <div style={{display:'flex',gap:6,marginBottom:20,padding:4,borderRadius:13,
          background:'rgba(0,0,0,0.04)',width:'fit-content'}}>
          <Tab id="theme" label="Tema"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C22 6.012 17.5 2 12 2z"/></svg>}/>
          <Tab id="account" label="Conta"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}/>
        </div>

        {pane==='theme'
          ? <ThemeGrid activeTheme={activeTheme} onTheme={onTheme}/>
          : <AccountPanel/>}

        <div style={{marginTop:18,fontFamily:'var(--font-body)',fontSize:11,
          color:'#9AA8B8',textAlign:'center'}}>Clique fora para fechar</div>
      </div>
    </div>
  );
};

export { SettingsModal };
