import React, { useState } from 'react';
import { T } from '../contexts/theme';
import { SERVER_URL } from '../contexts/user';
import { BrandLogo, StarDivider, Logo, Btn } from './components';

const LoginScreen = ({onLogin}) => {
  const [cpf,  setCpf]  = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const maskCpf = (v) => {
    const d = v.replace(/\D/g,'').slice(0,11);
    if(d.length<=3) return d;
    if(d.length<=6) return d.replace(/(\d{3})(\d+)/,'$1.$2');
    if(d.length<=9) return d.replace(/(\d{3})(\d{3})(\d+)/,'$1.$2.$3');
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/,'$1.$2.$3-$4');
  };

  const go = async () => {
    const rawCpf = cpf.replace(/\D/g,'');
    if(rawCpf.length !== 11){ setErr('CPF inválido. Digite os 11 dígitos.'); return; }
    if(!pass){ setErr('Digite sua senha.'); return; }
    setErr(''); setLoading(true);
    try {
      const r = await fetch(`${SERVER_URL}/api/auth/login`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ cpf: rawCpf, password: pass }),
      });
      const data = await r.json();
      if(!r.ok){ setErr(data.error || 'Erro ao entrar.'); setLoading(false); return; }
      localStorage.setItem('ch_token', data.token);
      onLogin(data.user);
    } catch {
      setErr('Servidor offline. Verifique se o servidor está rodando.');
      setLoading(false);
    }
  };

  const handleKey = (e) => { if(e.key==='Enter') go(); };

  return(
    <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',position:'relative',zIndex:1}}>
      {/* LEFT */}
      <div className="fsu" style={{display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',padding:64,
        background:'rgba(240,248,255,0.55)',backdropFilter:'blur(12px)',
        borderRight:`1px solid ${T.border}`}}>
        <div style={{marginBottom:32,display:'flex',justifyContent:'center'}}>
          <BrandLogo size={112}/>
        </div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:38,fontWeight:700,
          color:T.text,letterSpacing:'.10em',textAlign:'center',lineHeight:1}}>UNIKO</div>
        <div style={{fontFamily:'var(--font-brand)',fontSize:20,fontWeight:400,
          color:T.gold,letterSpacing:'.28em',marginTop:6,textAlign:'center'}}>HUB</div>
        <div style={{margin:'20px 0 16px',width:'320px'}}><StarDivider/></div>
        <div style={{fontFamily:'var(--font-body)',fontSize:15,color:T.textS,
          textAlign:'center',lineHeight:1.8}}>
          Sistema Integrado de Gestão<br/>de Recursos Humanos
        </div>
      </div>

      {/* RIGHT */}
      <div className="fsu2" style={{display:'flex',alignItems:'center',justifyContent:'center',padding:64}}>
        <div style={{width:'100%',maxWidth:400}}>
          <div style={{marginBottom:36}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:28,fontWeight:600,color:T.text,marginBottom:7}}>
              Entrar no Sistema
            </div>
            <div style={{fontFamily:'var(--font-body)',fontSize:15,color:T.textS}}>
              Use seu CPF e a senha fornecida pelo RH
            </div>
          </div>

          {/* CPF */}
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,color:T.textS,marginBottom:6}}>
              CPF
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',
              borderRadius:11,border:`1.5px solid ${T.border}`,background:T.surface||'white'}}>
              <span style={{fontSize:15}}>🪪</span>
              <input
                value={cpf}
                onChange={e=>setCpf(maskCpf(e.target.value))}
                onKeyDown={handleKey}
                placeholder="000.000.000-00"
                autoFocus
                style={{flex:1,border:'none',outline:'none',background:'transparent',
                  fontSize:15,color:T.text,fontFamily:'var(--font-body)',letterSpacing:'.04em'}}/>
            </div>
          </div>

          {/* Senha */}
          <div style={{marginBottom:16}}>
            <div style={{fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,color:T.textS,marginBottom:6}}>
              Senha
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',
              borderRadius:11,border:`1.5px solid ${T.border}`,background:T.surface||'white'}}>
              <span style={{fontSize:15}}>🔒</span>
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e=>setPass(e.target.value)}
                onKeyDown={handleKey}
                placeholder="••••••••"
                style={{flex:1,border:'none',outline:'none',background:'transparent',
                  fontSize:15,color:T.text,fontFamily:'var(--font-body)'}}/>
              <button onClick={()=>setShowPass(s=>!s)}
                style={{border:'none',background:'transparent',cursor:'pointer',padding:'2px 4px',color:T.textD,fontSize:13,outline:'none'}}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {err&&(
            <div style={{fontFamily:'var(--font-body)',fontSize:13,color:T.danger||'#C04050',
              background:'rgba(192,64,80,0.06)',border:'1px solid rgba(192,64,80,0.20)',
              borderRadius:9,padding:'9px 14px',marginBottom:14}}>⚠️ {err}
            </div>
          )}

          <Btn v="primary" full onClick={go} disabled={loading}
            style={{padding:'14px',fontSize:15,borderRadius:11,justifyContent:'center',marginTop:4}}>
            {loading
              ? <span style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',
                    borderTop:'2px solid #fff',borderRadius:'50%',
                    animation:'spin .7s linear infinite',display:'inline-block'}}/>
                  Entrando...
                </span>
              : 'Entrar'}
          </Btn>

          <div style={{textAlign:'center',marginTop:14}}>
            <span style={{fontFamily:'var(--font-body)',fontSize:13,color:T.textD}}>
              Esqueceu a senha? Fale com o RH
            </span>
          </div>
          <div style={{marginTop:26,width:'100%'}}><StarDivider/></div>
          <div style={{display:'flex',alignItems:'center',gap:11,justifyContent:'center',marginTop:16}}>
            <Logo size={26}/>
            <div style={{fontFamily:'var(--font-body)',fontSize:12,color:T.textT}}>
              Criado por <span style={{fontFamily:'var(--font-brand)',fontSize:12,
                fontWeight:600,color:T.gold}}>Nicolas Andrade</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { LoginScreen };
