import React, { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { USER, SERVER_URL, supabase, getAuthUser } from '../../../contexts/user';
import { Card, Btn, StarDivider, SHead } from '../../../shared/components';

// Campos da tabela colaborador_info (familiares + saúde) — precisam casar com o SQL.
const EXTRA_KEYS = ['familiar1_nome','familiar1_cel','familiar1_parentesco','familiar2_nome','familiar2_cel','familiar2_parentesco','doencas','alergias'];
const emptyExtra = () => EXTRA_KEYS.reduce((o, k) => (o[k] = '', o), {});

const TabDados = ({ onProfileSaved }) => {
  const cpfDigits = (getAuthUser()?.cpf || '').replace(/\D/g, '');
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [extra,   setExtra]   = useState(emptyExtra()); // familiares + saúde (Supabase)
  const [form, setForm] = useState({
    birth:    USER.birth    || '',
    rg:       USER.rg       || '',
    email:    USER.email    || '',
    phone:    USER.phone    || '',
    street:   USER.street   || '',
    district: USER.district || '',
    cep:      USER.cep      || '',
    city:     USER.city     || '',
    state:    USER.state    || '',
  });

  // Carrega as informações extras (familiares/saúde) do colaborador.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!cpfDigits) return;
      try {
        const { data } = await supabase.from('colaborador_info').select('*').eq('cpf', cpfDigits).maybeSingle();
        if (alive && data) setExtra(prev => { const n = { ...prev }; for (const k of EXTRA_KEYS) n[k] = data[k] || ''; return n; });
      } catch {}
    })();
    return () => { alive = false; };
  }, [cpfDigits]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const token = localStorage.getItem('ch_token');
      // No servidor a coluna do nascimento é `birth_date` (o form usa `birth`).
      const { birth, ...rest } = form;
      const r = await fetch(`${SERVER_URL}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...rest, birth_date: birth }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg('Erro: ' + (d.error || 'Tente novamente')); setSaving(false); return; }
      USER.birth    = form.birth;
      USER.rg       = form.rg;
      USER.email    = form.email;
      USER.phone    = form.phone;
      USER.street   = form.street;
      USER.district = form.district;
      USER.cep      = form.cep;
      USER.city     = form.city;
      USER.state    = form.state;
      // Familiares + saúde vão pro Supabase (não passam pelo backend de perfil).
      if (cpfDigits) {
        try {
          await supabase.from('colaborador_info').upsert(
            { cpf: cpfDigits, nome: USER.name, ...extra, updated_at: new Date().toISOString(), updated_by: USER.name },
            { onConflict: 'cpf' }
          );
        } catch {}
      }
      setMsg('✅ Dados atualizados com sucesso!');
      setEditing(false);
      onProfileSaved?.();
    } catch { setMsg('Erro de conexão'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const inp = (label, key) => (
    <div key={key} style={{marginBottom:20,flex:'1 1 40%',minWidth:150}}>
      <div style={{fontSize:12,color:T.textD,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6,fontWeight:500}}>{label}</div>
      {editing
        ? <input value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
            style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.gold}66`,background:'transparent',
              fontSize:14,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>
        : <div style={{fontSize:15,color:form[key]?T.text:T.textD,fontStyle:form[key]?'normal':'italic',
            paddingBottom:9,borderBottom:`1px solid ${T.divider}`}}>{form[key]||'Não informado'}</div>
      }
    </div>
  );

  const readOnly = (label, value) => (
    <div key={label} style={{marginBottom:20,flex:'1 1 40%',minWidth:150}}>
      <div style={{fontSize:12,color:T.textD,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6,fontWeight:500}}>{label}</div>
      <div style={{fontSize:15,color:value?T.text:T.textD,fontStyle:value?'normal':'italic',
        paddingBottom:9,borderBottom:`1px solid ${T.divider}`}}>{value||'Não informado'}</div>
    </div>
  );

  // Input pros campos extras (familiares/saúde), guardados no state `extra`.
  const inpExtra = (label, key, opts = {}) => (
    <div key={key} style={{marginBottom:20,flex:opts.full?'1 1 100%':'1 1 40%',minWidth:150}}>
      <div style={{fontSize:12,color:T.textD,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6,fontWeight:500}}>{label}</div>
      {editing
        ? (opts.area
            ? <textarea value={extra[key]||''} onChange={e=>setExtra(p=>({...p,[key]:e.target.value}))} placeholder={opts.placeholder||''} rows={3}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.gold}66`,background:'transparent',
                  fontSize:14,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box',resize:'vertical'}}/>
            : <input value={extra[key]||''} onChange={e=>setExtra(p=>({...p,[key]:e.target.value}))} placeholder={opts.placeholder||''}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:`1.5px solid ${T.gold}66`,background:'transparent',
                  fontSize:14,color:T.text,outline:'none',fontFamily:'var(--font-body)',boxSizing:'border-box'}}/>)
        : <div style={{fontSize:15,color:extra[key]?T.text:T.textD,fontStyle:extra[key]?'normal':'italic',
            paddingBottom:9,borderBottom:`1px solid ${T.divider}`,whiteSpace:opts.area?'pre-wrap':'normal'}}>{extra[key]||'Não informado'}</div>
      }
    </div>
  );

  return (
    <div className="fi" style={{fontFamily:'var(--font-body)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <SHead sub="Informações pessoais e documentos">Seus Dados</SHead>
        <div style={{display:'flex',gap:8,marginTop:4}}>
          {editing
            ? <>
                <Btn v="secondary" onClick={()=>{setEditing(false);setMsg('');}}>Cancelar</Btn>
                <Btn onClick={save} disabled={saving}>{saving?'Salvando...':'Salvar'}</Btn>
              </>
            : <Btn v="secondary" onClick={()=>setEditing(true)}>✏ Editar Dados</Btn>
          }
        </div>
      </div>
      {msg && <div style={{fontSize:13,color:msg.startsWith('✅')?'#16a34a':'#C04050',marginBottom:12,padding:'8px 14px',borderRadius:8,background:msg.startsWith('✅')?'rgba(34,197,94,0.08)':'rgba(192,64,80,0.06)',border:`1px solid ${msg.startsWith('✅')?'rgba(34,197,94,0.25)':'rgba(192,64,80,0.2)'}`}}>{msg}</div>}

      {/* Informações Pessoais — somente leitura */}
      <Card style={{padding:'26px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:4,height:18,borderRadius:2,background:`linear-gradient(180deg,${T.blue},${T.blue}55)`}}/>
          <span style={{fontSize:18,fontWeight:600,color:T.text}}>Informações Pessoais</span>
          {editing
            ? <span style={{marginLeft:8,fontSize:11,color:T.gold}}>nascimento e RG editáveis</span>
            : <span style={{marginLeft:8,fontSize:11,color:T.textD,background:T.surfaceSub,padding:'2px 8px',borderRadius:4}}>Nome e CPF pelo RH</span>}
        </div>
        <StarDivider my={0}/>
        <div style={{marginTop:18,display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
          {readOnly('Nome Completo', USER.name)}
          {inp('Data de Nascimento', 'birth')}
          {readOnly('CPF', USER.cpf)}
          {inp('RG', 'rg')}
        </div>
      </Card>

      {/* Contato — editável */}
      <Card style={{padding:'26px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:4,height:18,borderRadius:2,background:`linear-gradient(180deg,${T.teal},${T.teal}55)`}}/>
          <span style={{fontSize:18,fontWeight:600,color:T.text}}>Contato</span>
          {editing && <span style={{marginLeft:8,fontSize:11,color:T.gold}}>editável</span>}
        </div>
        <StarDivider my={0}/>
        <div style={{marginTop:18,display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
          {inp('E-mail', 'email')}
          {inp('Telefone', 'phone')}
        </div>
      </Card>

      {/* Endereço — editável */}
      <Card style={{padding:'26px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:4,height:18,borderRadius:2,background:`linear-gradient(180deg,${T.gold},${T.gold}55)`}}/>
          <span style={{fontSize:18,fontWeight:600,color:T.text}}>Endereço</span>
          {editing && <span style={{marginLeft:8,fontSize:11,color:T.gold}}>editável</span>}
        </div>
        <StarDivider my={0}/>
        <div style={{marginTop:18,display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
          {inp('Logradouro', 'street')}
          {inp('Bairro', 'district')}
          {inp('CEP', 'cep')}
          {inp('Cidade', 'city')}
          {inp('Estado', 'state')}
        </div>
      </Card>

      {/* Contato de Familiares — editável pelo próprio colaborador */}
      <Card style={{padding:'26px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:4,height:18,borderRadius:2,background:`linear-gradient(180deg,${T.pink||'#E0697A'},${(T.pink||'#E0697A')}55)`}}/>
          <span style={{fontSize:18,fontWeight:600,color:T.text}}>Contato de Familiares</span>
          {editing && <span style={{marginLeft:8,fontSize:11,color:T.gold}}>editável</span>}
        </div>
        <StarDivider my={0}/>
        <div style={{marginTop:18}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textD,letterSpacing:'.05em',marginBottom:2}}>FAMILIAR 1</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
            {inpExtra('Nome', 'familiar1_nome')}
            {inpExtra('Celular', 'familiar1_cel', { placeholder:'(85) 99999-9999' })}
            {inpExtra('Grau de parentesco', 'familiar1_parentesco', { placeholder:'Ex: Mãe, Cônjuge...' })}
          </div>
          <div style={{fontSize:12,fontWeight:700,color:T.textD,letterSpacing:'.05em',margin:'6px 0 2px'}}>FAMILIAR 2</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
            {inpExtra('Nome', 'familiar2_nome')}
            {inpExtra('Celular', 'familiar2_cel', { placeholder:'(85) 99999-9999' })}
            {inpExtra('Grau de parentesco', 'familiar2_parentesco', { placeholder:'Ex: Pai, Irmão(ã)...' })}
          </div>
        </div>
      </Card>

      {/* Saúde — editável pelo próprio colaborador */}
      <Card style={{padding:'26px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <div style={{width:4,height:18,borderRadius:2,background:`linear-gradient(180deg,#C04050,#C0405055)`}}/>
          <span style={{fontSize:18,fontWeight:600,color:T.text}}>Saúde</span>
          {editing && <span style={{marginLeft:8,fontSize:11,color:T.gold}}>editável</span>}
        </div>
        <StarDivider my={0}/>
        <div style={{marginTop:18,display:'flex',flexWrap:'wrap',gap:'0 32px'}}>
          {inpExtra('Doenças', 'doencas', { full:true, area:true, placeholder:'Doenças / condições de saúde relevantes (opcional)' })}
          {inpExtra('Alergias', 'alergias', { full:true, area:true, placeholder:'Alergias a medicamentos, alimentos, etc. (opcional)' })}
        </div>
      </Card>
    </div>
  );
};

export { TabDados };
