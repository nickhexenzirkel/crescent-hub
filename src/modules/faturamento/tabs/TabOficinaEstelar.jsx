import { useState, useEffect } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { PdfEditor } from '../PdfEditor';
import rubricaUrl from '../../../assets/assinatura-evando.png';

const HERO_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

const Label = ({ children }) => (
  <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6}}>
    {children}
  </div>
);

const Field = ({ label, children, hint, grid }) => (
  <div style={{marginBottom:14, ...(grid && {display:'grid',gridTemplateColumns:grid,gap:10})}}>
    {label && !grid && <Label>{label}</Label>}
    {children}
    {hint && <div style={{fontSize:11,color:T.textD,marginTop:4}}>{hint}</div>}
  </div>
);

const inp = {
  width:'100%',background:T.surface,border:`1px solid ${T.border}`,
  borderRadius:8,padding:'8px 11px',fontSize:13,color:T.text,
  fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box',
};
const txa = { ...inp, minHeight:88, resize:'vertical', lineHeight:1.6 };
const btnGold = {
  display:'inline-flex',alignItems:'center',gap:8,
  background:T.gold,color:'#fff',border:'none',borderRadius:10,
  padding:'10px 22px',fontSize:14,fontWeight:600,cursor:'pointer',
  fontFamily:'var(--font-body)',boxShadow:`0 2px 10px ${T.gold}44`,
};

/* ════════════════════════════════════════════════════════════════
   CARTA DE CORREÇÃO
════════════════════════════════════════════════════════════════ */
const SIG_STORE   = 'oficina_assinaturas_salvas';
const MONTHS_PT   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const chunk       = (arr,n) => Array.from({length:Math.ceil(arr.length/n)},(_,i)=>arr.slice(i*n,i*n+n));
const fmtBr       = iso => iso ? iso.split('-').reverse().join('/') : '__/__/____';
const loadSigs    = () => { try { const r=JSON.parse(localStorage.getItem(SIG_STORE)||'[]'); return Array.isArray(r)?r:[]; } catch { return []; } };

const CODIGOS = [
  {code:'01',label:'Razão Social'},     {code:'02',label:'Endereço'},
  {code:'03',label:'Bairro'},           {code:'04',label:'Município'},
  {code:'05',label:'Estado'},           {code:'06',label:'CEP'},
  {code:'07',label:'CNPJ'},             {code:'08',label:'I. Estadual'},
  {code:'09',label:'I. Municipal'},     {code:'10',label:'Telefone'},
  {code:'11',label:'Fax'},              {code:'12',label:'Data de Emissão'},
  {code:'13',label:'Quantidade'},       {code:'14',label:'Descrição'},
  {code:'15',label:'Unidade'},          {code:'16',label:'Preço Unitário'},
  {code:'17',label:'Preço Total'},      {code:'18',label:'Desconto / Abatimento'},
  {code:'19',label:'Acréscimos Financeiros'},{code:'20',label:'Total da Nota'},
  {code:'21',label:'Base de Cálculo ICMS'},{code:'22',label:'Alíquota do ICMS'},
  {code:'23',label:'Valor do ICMS'},    {code:'24',label:'Valor do IPI'},
  {code:'25',label:'Transportador'},    {code:'26',label:'End. do Transportador'},
  {code:'27',label:'Município do Transp.'},{code:'28',label:'Estado do Transp.'},
  {code:'29',label:'Placa do Veículo'}, {code:'30',label:'UF do Veículo'},
  {code:'31',label:'CNPJ do Transp.'},  {code:'32',label:'Frete por Conta'},
  {code:'33',label:'Qtd. de Volumes'},  {code:'34',label:'Espécie dos Volumes'},
  {code:'35',label:'Número dos Volumes'},{code:'36',label:'Peso dos Volumes'},
  {code:'999',label:'Outras Irregularidades'},
];

/* ── Documento em branco (preview) ── */
const thS = {border:'1px solid #666',padding:'3px 5px',background:'#d4d4d4',fontWeight:'bold',fontSize:8.5,textAlign:'center'};
const tdS = {border:'1px solid #bbb',padding:'2px 5px',fontSize:8.5,verticalAlign:'top'};

const CartaDoc = ({ form }) => {
  const dataFmt = `${form.cidade?form.cidade+', ':''}${String(form.dia).padStart(2,'0')} de ${MONTHS_PT[Number(form.mes)]} de ${form.ano}`;
  const sel     = [...form.codigos].sort((a,b)=>(Number(a)||999)-(Number(b)||999));
  const rows    = chunk(CODIGOS, 2);

  const pair = (c, highlight) => {
    if (!c) return [<td key="ec" style={tdS}/>, <td key="el" style={tdS}/>];
    const on = highlight.includes(c.code);
    return [
      <td key={c.code+'n'} style={{...tdS,textAlign:'center',background:on?'#1a1a1a':'transparent',color:on?'#fff':'#111',fontWeight:on?700:400}}>{c.code}</td>,
      <td key={c.code+'l'} style={{...tdS,background:on?'#e8e8e8':'transparent',fontWeight:on?600:400}}>{c.label}</td>,
    ];
  };

  return (
    <div style={{background:'#fff',padding:'26px 30px',fontSize:9.5,fontFamily:'Arial,Helvetica,sans-serif',color:'#111',lineHeight:1.6,minWidth:520}}>

      {/* Cabeçalho da empresa */}
      <div style={{textAlign:'center',borderBottom:'2px solid #222',paddingBottom:8,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'.05em'}}>
          {form.emitNome || 'RAZÃO SOCIAL DA EMPRESA'}
        </div>
        {form.emitEndereco && <div style={{fontSize:9}}>{form.emitEndereco}</div>}
        <div style={{fontSize:9,marginTop:2}}>
          {form.emitCNPJ && <span>CNPJ: <strong>{form.emitCNPJ}</strong></span>}
          {form.emitCNPJ && form.emitIE && <span> &nbsp;|&nbsp; </span>}
          {form.emitIE   && <span>I.E.: <strong>{form.emitIE}</strong></span>}
        </div>
      </div>

      {/* Título */}
      <div style={{textAlign:'center',fontSize:12,fontWeight:'bold',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:12}}>
        Carta de Correção
      </div>

      {/* Data */}
      <div style={{textAlign:'right',marginBottom:10}}>{dataFmt}</div>

      {/* Destinatário */}
      <div style={{marginBottom:10}}>
        <strong>Ao Ilmo. Sr.:</strong><br/>
        {form.destNome || '__________________________________________________'}<br/>
        {form.destCNPJ && <span>CNPJ: {form.destCNPJ}</span>}
      </div>

      {/* Referência NF */}
      <div style={{borderTop:'1px solid #888',borderBottom:'1px solid #888',padding:'5px 0',marginBottom:10}}>
        <strong>Referente à Nota Fiscal:</strong>&nbsp;
        Número: <strong>{form.nfNumero||'______'}</strong>&nbsp;&nbsp;
        Série: <strong>{form.nfSerie||'__'}</strong>&nbsp;&nbsp;
        Data de Emissão: <strong>{fmtBr(form.nfDataEmissao)}</strong>
      </div>

      {/* Corpo */}
      <div style={{marginBottom:10,textAlign:'justify'}}>
        Em face do que determina a legislação fiscal vigente, vimos pela presente comunicar-lhe que
        a Nota Fiscal em referência contém a(s) irregularidade(s) que abaixo apontamos, e que
        solicitamos as devidas providências.
      </div>

      {/* Tabela de 36 + 999 */}
      <table style={{width:'100%',borderCollapse:'collapse',marginBottom:10}}>
        <thead>
          <tr>
            <th style={{...thS,width:'7%'}}>Cód.</th>
            <th style={{...thS,width:'43%',textAlign:'left'}}>Especificação</th>
            <th style={{...thS,width:'7%'}}>Cód.</th>
            <th style={{...thS,width:'43%',textAlign:'left'}}>Especificação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i) => (
            <tr key={i}>
              {pair(row[0], form.codigos)}
              {pair(row[1], form.codigos)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Códigos selecionados */}
      <div style={{marginBottom:8}}>
        <strong>CÓDIGO(S) COM IRREGULARIDADE(S):</strong>&nbsp;
        {sel.length ? sel.join(', ') : '___'}
      </div>

      {/* Retificação */}
      <div style={{marginBottom:14}}>
        <div style={{fontWeight:'bold',marginBottom:3}}>RETIFICAÇÕES A SEREM CONSIDERADAS:</div>
        <div style={{border:'1px solid #bbb',padding:'5px 7px',minHeight:44,whiteSpace:'pre-wrap',fontSize:9.5}}>
          {form.retificacao}
        </div>
      </div>

      {/* Encerramento */}
      <div style={{marginBottom:26,textAlign:'justify'}}>
        Para evitar qualquer sanção fiscal, solicitamos acusarem o recebimento desta.
      </div>

      {/* Assinatura */}
      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <div style={{textAlign:'center',minWidth:230}}>
          {form.sigSrc && (
            <img src={form.sigSrc} alt="Assinatura"
              style={{height:46,maxWidth:200,objectFit:'contain',display:'block',margin:'0 auto 3px'}}/>
          )}
          <div style={{borderTop:'1px solid #555',paddingTop:4,marginTop:form.sigSrc?0:26}}>
            <div style={{fontWeight:'bold'}}>{form.emitNome||'Razão Social'}</div>
            {form.emitEndereco && <div style={{fontSize:8.5}}>{form.emitEndereco}</div>}
            {form.emitCNPJ    && <div style={{fontSize:8.5}}>CNPJ: {form.emitCNPJ}</div>}
            {form.emitIE      && <div style={{fontSize:8.5}}>I.E.: {form.emitIE}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Formulário + Preview ── */
const TabCarta = () => {
  const hoje = new Date();
  const [form, setForm] = useState({
    emitNome:'', emitEndereco:'', emitCNPJ:'', emitIE:'',
    destNome:'', destCNPJ:'',
    nfNumero:'', nfSerie:'', nfDataEmissao:'',
    cidade:'',
    dia:  String(hoje.getDate()),
    mes:  String(hoje.getMonth()),
    ano:  String(hoje.getFullYear()),
    codigos:[], retificacao:'', sigSrc:null,
  });

  const savedSigs = useState(() => [
    {id:'default-ev', name:'ASSINATURA EV. JR', dataUrl:rubricaUrl},
    ...loadSigs(),
  ])[0];

  const allSigOpts = [{id:'__none__', name:'Sem assinatura', dataUrl:null}, ...savedSigs];

  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const toggleCode = code => setForm(p=>({
    ...p, codigos: p.codigos.includes(code) ? p.codigos.filter(c=>c!==code) : [...p.codigos, code],
  }));

  const sec = title => (
    <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',textTransform:'uppercase',
      borderBottom:`1px solid ${T.border}`,paddingBottom:7,marginTop:22,marginBottom:14}}>
      {title}
    </div>
  );

  const radioSig = (s) => {
    const active = form.sigSrc === s.dataUrl;
    return (
      <div key={s.id} onClick={()=>set('sigSrc', s.dataUrl)}
        style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:9,cursor:'pointer',
          border:`1px solid ${active?T.gold:T.border}`,background:active?`${T.gold}12`:'transparent',transition:'all .12s',marginBottom:6}}>
        <div style={{width:13,height:13,borderRadius:'50%',flexShrink:0,
          border:`1.5px solid ${active?T.gold:'#aaa'}`,background:active?T.gold:'transparent',transition:'all .12s'}}/>
        {s.dataUrl
          ? <img src={s.dataUrl} alt={s.name} style={{height:22,maxWidth:90,objectFit:'contain'}}/>
          : <span style={{fontSize:12,color:T.textD,fontStyle:'italic'}}>Nenhuma</span>}
        <span style={{fontSize:11.5,color:active?T.gold:T.textS,fontWeight:active?600:400}}>{s.name}</span>
      </div>
    );
  };

  return (
    <div>
      {/* CSS de impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #carta-preview-wrap, #carta-preview-wrap * { visibility: visible !important; }
          #carta-preview-wrap {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; background: #fff !important;
            padding: 0 !important; margin: 0 !important;
          }
        }
      `}</style>

      <div style={{display:'grid',gridTemplateColumns:'330px 1fr',gap:28,alignItems:'start'}}>

        {/* ──────────── FORMULÁRIO ──────────── */}
        <div style={{paddingBottom:40}}>

          {sec('Dados do Emitente')}
          <Field label="Razão Social">
            <input style={inp} placeholder="Nome da empresa" value={form.emitNome} onChange={e=>set('emitNome',e.target.value)}/>
          </Field>
          <Field label="Endereço">
            <input style={inp} placeholder="Rua, nº, bairro, cidade – UF" value={form.emitEndereco} onChange={e=>set('emitEndereco',e.target.value)}/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            <div>
              <Label>CNPJ</Label>
              <input style={inp} placeholder="00.000.000/0000-00" value={form.emitCNPJ} onChange={e=>set('emitCNPJ',e.target.value)}/>
            </div>
            <div>
              <Label>I. Estadual</Label>
              <input style={inp} placeholder="000000000" value={form.emitIE} onChange={e=>set('emitIE',e.target.value)}/>
            </div>
          </div>

          {sec('Data da Carta')}
          <Field label="Cidade">
            <input style={inp} placeholder="Ex: Eusébio" value={form.cidade} onChange={e=>set('cidade',e.target.value)}/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1.2fr',gap:10,marginBottom:14}}>
            <div><Label>Dia</Label><input style={inp} type="number" min="1" max="31" value={form.dia} onChange={e=>set('dia',e.target.value)}/></div>
            <div>
              <Label>Mês</Label>
              <select style={{...inp,appearance:'none'}} value={form.mes} onChange={e=>set('mes',e.target.value)}>
                {MONTHS_PT.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div><Label>Ano</Label><input style={inp} value={form.ano} onChange={e=>set('ano',e.target.value)}/></div>
          </div>

          {sec('Destinatário')}
          <Field label="Razão Social">
            <input style={inp} placeholder="Nome do destinatário" value={form.destNome} onChange={e=>set('destNome',e.target.value)}/>
          </Field>
          <Field label="CNPJ">
            <input style={inp} placeholder="00.000.000/0000-00" value={form.destCNPJ} onChange={e=>set('destCNPJ',e.target.value)}/>
          </Field>

          {sec('Nota Fiscal')}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:14}}>
            <div><Label>Número</Label><input style={inp} placeholder="000001" value={form.nfNumero} onChange={e=>set('nfNumero',e.target.value)}/></div>
            <div><Label>Série</Label><input style={inp} placeholder="1" value={form.nfSerie} onChange={e=>set('nfSerie',e.target.value)}/></div>
          </div>
          <Field label="Data de Emissão">
            <input style={inp} type="date" value={form.nfDataEmissao} onChange={e=>set('nfDataEmissao',e.target.value)}/>
          </Field>

          {sec('Irregularidades — marque os itens a corrigir')}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:16}}>
            {CODIGOS.map(c=>{
              const on = form.codigos.includes(c.code);
              return (
                <div key={c.code} onClick={()=>toggleCode(c.code)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'5px 7px',borderRadius:7,cursor:'pointer',userSelect:'none',
                    border:`1px solid ${on?T.gold:T.border}`,background:on?`${T.gold}16`:'transparent',transition:'all .11s'}}>
                  <div style={{width:13,height:13,borderRadius:3,flexShrink:0,transition:'all .11s',
                    border:`1.5px solid ${on?T.gold:'#aaa'}`,background:on?T.gold:'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {on && <svg width="8" height="8" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{fontSize:10.5,lineHeight:1.3,color:on?T.gold:T.textS,fontWeight:on?600:400}}>
                    <strong>{c.code}</strong> {c.label}
                  </span>
                </div>
              );
            })}
          </div>

          <Field label="Retificações a serem consideradas" hint="Descreva o que deve ser corrigido (mín. 15 caracteres).">
            <textarea style={txa}
              placeholder="Ex: Onde se lê 'Serviços de limpeza urbana', leia-se 'Serviços de manutenção predial'."
              value={form.retificacao} onChange={e=>set('retificacao',e.target.value)}/>
          </Field>

          {sec('Assinatura automática')}
          {allSigOpts.map(radioSig)}

          <div style={{marginTop:22}}>
            <button style={btnGold} onClick={()=>window.print()}
              onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <I><path d="M6 9V2h12l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><polyline points="14 2 14 8 20 8"/></I>
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {/* ──────────── PREVIEW ──────────── */}
        <div style={{position:'sticky',top:6,alignSelf:'start'}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',
            textTransform:'uppercase',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Pré-visualização em tempo real
          </div>
          <div id="carta-preview-wrap"
            style={{background:'#e8e8e8',borderRadius:12,border:`1px solid ${T.border}`,
              padding:10,maxHeight:'82vh',overflow:'auto',boxShadow:'0 4px 20px rgba(0,0,0,.1)'}}>
            <CartaDoc form={form}/>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   OFÍCIO DE EMISSÃO (inalterado)
════════════════════════════════════════════════════════════════ */
const Censored = ({ children }) => (
  <div style={{position:'relative'}}>
    <div style={{filter:'blur(7px)',pointerEvents:'none',userSelect:'none',opacity:.85}} aria-hidden="true">{children}</div>
    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 22px',background:T.surface,
        border:`1px solid ${T.border}`,borderRadius:999,boxShadow:T.sh,fontSize:14,fontWeight:600,color:T.textS}}>
        <span style={{color:T.gold}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </span>
        Em desenvolvimento
      </div>
    </div>
  </div>
);

const OFICIO_MODELS = [{ id: 'eusebio', label: 'Ofício de Eusébio' }];

const inputStyle = {
  width:'100%',background:T.surface,border:`1px solid ${T.border}`,
  borderRadius:9,padding:'10px 13px',fontSize:14,color:T.text,
  fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box',
};
const textareaStyle = { ...inputStyle, minHeight:110, resize:'vertical', lineHeight:1.6 };
const btnPrimary = {
  display:'inline-flex',alignItems:'center',gap:8,
  background:T.gold,color:'#fff',border:'none',borderRadius:10,
  padding:'10px 22px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-body)',
  boxShadow:`0 2px 10px ${T.gold}44`,
};

const FieldO = ({ label, children, hint }) => (
  <div style={{marginBottom:20}}>
    {label && <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6}}>{label}</div>}
    {children}
    {hint && <div style={{fontSize:11.5,color:T.textD,marginTop:5}}>{hint}</div>}
  </div>
);

const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const OficioEusebio = () => {
  const hoje = new Date();
  const [form, setForm] = useState({
    numero:'', ano:String(hoje.getFullYear()), dia:String(hoje.getDate()), mes:String(hoje.getMonth()),
    destinatarioCargo:'', destinatarioNome:'', assunto:'', corpo:'', remetentNome:'', remetenteCargo:'', remetenteSec:'',
  });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const dataFmt = `Eusébio, ${form.dia} de ${MONTH_NAMES[Number(form.mes)]} de ${form.ano}`;
  const IOf = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{p.children}</svg>;

  return (
    <div style={{maxWidth:760,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Identificação</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <FieldO label="Nº do Ofício"><input style={inputStyle} placeholder="001" value={form.numero} onChange={e=>set('numero',e.target.value)}/></FieldO>
          <FieldO label="Ano"><input style={inputStyle} placeholder="2026" value={form.ano} onChange={e=>set('ano',e.target.value)}/></FieldO>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:16}}>
          <FieldO label="Dia"><input style={inputStyle} type="number" min="1" max="31" value={form.dia} onChange={e=>set('dia',e.target.value)}/></FieldO>
          <FieldO label="Mês">
            <select style={{...inputStyle,appearance:'none'}} value={form.mes} onChange={e=>set('mes',e.target.value)}>
              {MONTH_NAMES.map((m,i)=><option key={i} value={i}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
          </FieldO>
        </div>
        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Destinatário</div>
        <FieldO label="Cargo / Título"><input style={inputStyle} placeholder="Ex: Ilmo. Sr. Secretário Municipal de Saúde" value={form.destinatarioCargo} onChange={e=>set('destinatarioCargo',e.target.value)}/></FieldO>
        <FieldO label="Nome"><input style={inputStyle} placeholder="Nome do destinatário" value={form.destinatarioNome} onChange={e=>set('destinatarioNome',e.target.value)}/></FieldO>
        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Conteúdo</div>
        <FieldO label="Assunto"><input style={inputStyle} placeholder="Assunto do ofício" value={form.assunto} onChange={e=>set('assunto',e.target.value)}/></FieldO>
        <FieldO label="Corpo do Texto"><textarea style={{...textareaStyle,minHeight:130}} placeholder="Texto principal do ofício..." value={form.corpo} onChange={e=>set('corpo',e.target.value)}/></FieldO>
        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Remetente</div>
        <FieldO label="Nome do Assinante"><input style={inputStyle} placeholder="Nome completo" value={form.remetentNome} onChange={e=>set('remetentNome',e.target.value)}/></FieldO>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <FieldO label="Cargo"><input style={inputStyle} placeholder="Ex: Coordenador de Faturamento" value={form.remetenteCargo} onChange={e=>set('remetenteCargo',e.target.value)}/></FieldO>
          <FieldO label="Secretaria"><input style={inputStyle} placeholder="Ex: SEMUS" value={form.remetenteSec} onChange={e=>set('remetenteSec',e.target.value)}/></FieldO>
        </div>
        <StarDivider my={20}/>
        <button style={btnPrimary} onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <IOf><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></IOf>
          Gerar Ofício (PDF)
        </button>
      </div>
      <div style={{position:'sticky',top:0,alignSelf:'start'}}>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:12}}>Pré-visualização</div>
        <div style={{background:'#fff',borderRadius:12,border:`1px solid ${T.border}`,padding:'32px 28px',fontSize:12,color:'#111',fontFamily:'Times New Roman, serif',lineHeight:1.75,minHeight:540,boxShadow:'0 4px 18px rgba(0,0,0,.08)'}}>
          <div style={{textAlign:'center',marginBottom:20,fontSize:13,fontWeight:'bold'}}>PREFEITURA MUNICIPAL DE EUSÉBIO</div>
          <div style={{textAlign:'right',marginBottom:16,fontSize:11.5,color:'#444'}}>{dataFmt}</div>
          <div style={{marginBottom:16,fontSize:11.5}}><strong>Ofício nº {form.numero||'___'}/{form.ano}</strong></div>
          {(form.destinatarioCargo||form.destinatarioNome)&&(
            <div style={{marginBottom:16,fontSize:11.5}}>
              <div>{form.destinatarioCargo||'Cargo do Destinatário'}</div>
              <div><strong>{form.destinatarioNome||'Nome do Destinatário'}</strong></div>
            </div>
          )}
          {form.assunto&&<div style={{marginBottom:16,fontSize:11.5}}><strong>Assunto:</strong> {form.assunto}</div>}
          <div style={{marginBottom:24,fontSize:11.5,textAlign:'justify',whiteSpace:'pre-wrap'}}>
            {form.corpo||'O corpo do ofício será exibido aqui conforme você preenche os campos ao lado.'}
          </div>
          <div style={{marginTop:40,fontSize:11.5}}>
            <div style={{borderTop:'1px solid #999',width:180,marginBottom:4}}/>
            <div><strong>{form.remetentNome||'Nome do Assinante'}</strong></div>
            {form.remetenteCargo&&<div>{form.remetenteCargo}</div>}
            {form.remetenteSec&&<div>{form.remetenteSec}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const TabOficio = () => {
  const [modelo, setModelo] = useState('eusebio');
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:28}}>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.06em',textTransform:'uppercase',flexShrink:0}}>Modelo</div>
        <select value={modelo} onChange={e=>setModelo(e.target.value)}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:'9px 14px',fontSize:14,color:T.text,fontFamily:'var(--font-body)',outline:'none',cursor:'pointer',minWidth:220}}>
          {OFICIO_MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      {modelo==='eusebio'&&<OficioEusebio/>}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════════ */
export const TabOficinaEstelar = () => {
  const [hasDoc, setHasDoc] = useState(false);
  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {!hasDoc && (
        <StellarHero compact eyebrow="Ferramentas Estelares" title="Editor de PDF"
          subtitle="Edite o texto existente do PDF, adicione textos, imagens e assinaturas." icon={HERO_ICON}/>
      )}
      <PdfEditor onDoc={setHasDoc}/>
    </div>
  );
};

export const TabCartaCorrecao = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas Estelares" title="Carta de Correção"
      subtitle="Preencha os campos e acompanhe a carta sendo montada em tempo real." icon={HERO_ICON}/>
    <TabCarta/>
  </div>
);

export const TabOficioEmissao = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas Estelares" title="Ofício de Emissão"
      subtitle="Gere ofícios a partir de modelos prontos." icon={HERO_ICON}/>
    <Censored><TabOficio/></Censored>
  </div>
);
