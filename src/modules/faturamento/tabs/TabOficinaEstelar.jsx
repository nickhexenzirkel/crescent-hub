import { useState } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { PdfEditor } from '../PdfEditor';

const HERO_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;

/* Censura temporária — embaça o conteúdo de uma aba ainda em desenvolvimento */
const Censored = ({ children }) => (
  <div style={{position:'relative'}}>
    <div style={{filter:'blur(7px)',pointerEvents:'none',userSelect:'none',opacity:.85}} aria-hidden="true">
      {children}
    </div>
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

/* ─── Ícone inline ─── */
const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

/* ─── Modelos de Ofício ─── */
const OFICIO_MODELS = [
  { id: 'eusebio', label: 'Ofício de Eusébio' },
];

/* ════════ helpers visuais ════════ */
const Label = ({ children }) => (
  <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6}}>
    {children}
  </div>
);

const Field = ({ label, children, hint }) => (
  <div style={{marginBottom:20}}>
    {label && <Label>{label}</Label>}
    {children}
    {hint && <div style={{fontSize:11.5,color:T.textD,marginTop:5}}>{hint}</div>}
  </div>
);

const inputStyle = {
  width:'100%',background:T.surface,border:`1px solid ${T.border}`,
  borderRadius:9,padding:'10px 13px',fontSize:14,color:T.text,
  fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box',
  transition:'border-color .15s',
};

const textareaStyle = {
  ...inputStyle,
  minHeight:110,resize:'vertical',lineHeight:1.6,
};

const btnPrimary = {
  display:'inline-flex',alignItems:'center',gap:8,
  background:T.gold,color:'#fff',border:'none',
  borderRadius:10,padding:'10px 22px',fontSize:14,fontWeight:600,
  cursor:'pointer',fontFamily:'var(--font-body)',
  boxShadow:`0 2px 10px ${T.gold}44`,transition:'opacity .14s',
};

/* ════════════════════════════════════════════════════════════════
   1. CARTA DE CORREÇÃO
════════════════════════════════════════════════════════════════ */
const TabCarta = () => {
  const [form, setForm] = useState({
    chave:'', emitente:'', tomador:'', serie:'', numero:'', descricao:'',
  });
  const set = (k, v) => setForm(p => ({...p, [k]:v}));

  return (
    <div style={{maxWidth:680}}>
      <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:28}}>
        Preencha os dados da nota fiscal e descreva a correção. A Carta de Correção Eletrônica (CC-e) substituirá as informações originais da NF-e após validação.
      </p>

      <Field label="Chave de Acesso (44 dígitos)" hint="Disponível no DANFE ou no portal da SEFAZ">
        <input
          style={inputStyle} maxLength={44}
          placeholder="00000000000000000000000000000000000000000000"
          value={form.chave} onChange={e => set('chave', e.target.value)}
        />
      </Field>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Série">
          <input style={inputStyle} placeholder="1" value={form.serie}
            onChange={e => set('serie', e.target.value)}/>
        </Field>
        <Field label="Número da NF-e">
          <input style={inputStyle} placeholder="000001" value={form.numero}
            onChange={e => set('numero', e.target.value)}/>
        </Field>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="CNPJ do Emitente">
          <input style={inputStyle} placeholder="00.000.000/0000-00" value={form.emitente}
            onChange={e => set('emitente', e.target.value)}/>
        </Field>
        <Field label="CPF / CNPJ do Tomador">
          <input style={inputStyle} placeholder="000.000.000-00" value={form.tomador}
            onChange={e => set('tomador', e.target.value)}/>
        </Field>
      </div>

      <Field label="Descrição da Correção" hint="Mínimo de 15 caracteres. Descreva exatamente o que deve ser corrigido.">
        <textarea
          style={textareaStyle}
          placeholder="Ex: Onde se lê 'Serviços de limpeza urbana', leia-se 'Serviços de manutenção predial'."
          value={form.descricao}
          onChange={e => set('descricao', e.target.value)}
        />
      </Field>

      <StarDivider my={24}/>

      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <button style={btnPrimary} onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>
          Gerar Carta de Correção
        </button>
        <span style={{fontSize:12.5,color:T.textD}}>Exporta como arquivo XML / PDF</span>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   2. OFÍCIO DE EMISSÃO
════════════════════════════════════════════════════════════════ */
const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const OficioEusebio = () => {
  const hoje = new Date();
  const [form, setForm] = useState({
    numero: '',
    ano: String(hoje.getFullYear()),
    dia: String(hoje.getDate()),
    mes: String(hoje.getMonth()),
    destinatarioCargo: '',
    destinatarioNome: '',
    assunto: '',
    corpo: '',
    remetentNome: '',
    remetenteCargo: '',
    remetenteSec: '',
  });
  const set = (k, v) => setForm(p => ({...p, [k]:v}));
  const dataFmt = `Eusébio, ${form.dia} de ${MONTH_NAMES[Number(form.mes)]} de ${form.ano}`;

  return (
    <div style={{maxWidth:760,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
      {/* Coluna esquerda: formulário */}
      <div>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Identificação</div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <Field label="Nº do Ofício">
            <input style={inputStyle} placeholder="001" value={form.numero}
              onChange={e => set('numero', e.target.value)}/>
          </Field>
          <Field label="Ano">
            <input style={inputStyle} placeholder="2026" value={form.ano}
              onChange={e => set('ano', e.target.value)}/>
          </Field>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:16}}>
          <Field label="Dia">
            <input style={inputStyle} type="number" min="1" max="31" value={form.dia}
              onChange={e => set('dia', e.target.value)}/>
          </Field>
          <Field label="Mês">
            <select style={{...inputStyle,appearance:'none'}} value={form.mes}
              onChange={e => set('mes', e.target.value)}>
              {MONTH_NAMES.map((m,i) => <option key={i} value={i}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
          </Field>
        </div>

        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Destinatário</div>

        <Field label="Cargo / Título">
          <input style={inputStyle} placeholder="Ex: Ilmo. Sr. Secretário Municipal de Saúde" value={form.destinatarioCargo}
            onChange={e => set('destinatarioCargo', e.target.value)}/>
        </Field>
        <Field label="Nome">
          <input style={inputStyle} placeholder="Nome do destinatário" value={form.destinatarioNome}
            onChange={e => set('destinatarioNome', e.target.value)}/>
        </Field>

        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Conteúdo</div>

        <Field label="Assunto">
          <input style={inputStyle} placeholder="Assunto do ofício" value={form.assunto}
            onChange={e => set('assunto', e.target.value)}/>
        </Field>
        <Field label="Corpo do Texto">
          <textarea style={{...textareaStyle,minHeight:130}} placeholder="Texto principal do ofício..."
            value={form.corpo} onChange={e => set('corpo', e.target.value)}/>
        </Field>

        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Remetente</div>

        <Field label="Nome do Assinante">
          <input style={inputStyle} placeholder="Nome completo" value={form.remetentNome}
            onChange={e => set('remetentNome', e.target.value)}/>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Cargo">
            <input style={inputStyle} placeholder="Ex: Coordenador de Faturamento" value={form.remetenteCargo}
              onChange={e => set('remetenteCargo', e.target.value)}/>
          </Field>
          <Field label="Secretaria">
            <input style={inputStyle} placeholder="Ex: SEMUS" value={form.remetenteSec}
              onChange={e => set('remetenteSec', e.target.value)}/>
          </Field>
        </div>

        <StarDivider my={20}/>
        <button style={btnPrimary} onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>
          Gerar Ofício (PDF)
        </button>
      </div>

      {/* Coluna direita: preview */}
      <div style={{position:'sticky',top:0,alignSelf:'start'}}>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:12}}>Pré-visualização</div>
        <div style={{
          background:'#fff',borderRadius:12,
          border:`1px solid ${T.border}`,
          padding:'32px 28px',
          fontSize:12,color:'#111',fontFamily:'Times New Roman, serif',lineHeight:1.75,
          minHeight:540,boxShadow:'0 4px 18px rgba(0,0,0,.08)',
        }}>
          <div style={{textAlign:'center',marginBottom:20,fontSize:13,fontWeight:'bold'}}>
            PREFEITURA MUNICIPAL DE EUSÉBIO
          </div>
          <div style={{textAlign:'right',marginBottom:16,fontSize:11.5,color:'#444'}}>
            {dataFmt}
          </div>
          <div style={{marginBottom:16,fontSize:11.5}}>
            <strong>Ofício nº {form.numero || '___'}/{form.ano}</strong>
          </div>
          {(form.destinatarioCargo || form.destinatarioNome) && (
            <div style={{marginBottom:16,fontSize:11.5}}>
              <div>{form.destinatarioCargo || 'Cargo do Destinatário'}</div>
              <div><strong>{form.destinatarioNome || 'Nome do Destinatário'}</strong></div>
            </div>
          )}
          {form.assunto && (
            <div style={{marginBottom:16,fontSize:11.5}}>
              <strong>Assunto:</strong> {form.assunto}
            </div>
          )}
          <div style={{marginBottom:24,fontSize:11.5,textAlign:'justify',whiteSpace:'pre-wrap'}}>
            {form.corpo || 'O corpo do ofício será exibido aqui conforme você preenche os campos ao lado.'}
          </div>
          <div style={{marginTop:40,fontSize:11.5}}>
            <div style={{borderTop:'1px solid #999',width:180,marginBottom:4}}/>
            <div><strong>{form.remetentNome || 'Nome do Assinante'}</strong></div>
            {form.remetenteCargo && <div>{form.remetenteCargo}</div>}
            {form.remetenteSec && <div>{form.remetenteSec}</div>}
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
        <select
          value={modelo}
          onChange={e => setModelo(e.target.value)}
          style={{
            background:T.surface,border:`1px solid ${T.border}`,
            borderRadius:9,padding:'9px 14px',fontSize:14,color:T.text,
            fontFamily:'var(--font-body)',outline:'none',cursor:'pointer',
            minWidth:220,
          }}
        >
          {OFICIO_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      {modelo === 'eusebio' && <OficioEusebio/>}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   FERRAMENTAS ESTELARES — Editor de PDF
   (o banner some quando um PDF é carregado, para ver melhor a página)
════════════════════════════════════════════════════════════════ */
export const TabOficinaEstelar = () => {
  const [hasDoc, setHasDoc] = useState(false);
  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {!hasDoc && (
        <StellarHero
          compact
          eyebrow="Ferramentas Estelares"
          title="Editor de PDF"
          subtitle="Edite o texto existente do PDF, adicione textos, imagens e assinaturas."
          icon={HERO_ICON}
        />
      )}
      <PdfEditor onDoc={setHasDoc}/>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   CARTA DE CORREÇÃO (aba própria)
════════════════════════════════════════════════════════════════ */
export const TabCartaCorrecao = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas Estelares" title="Carta de Correção"
      subtitle="Gere a Carta de Correção Eletrônica (CC-e) de uma NF-e." icon={HERO_ICON}/>
    <Censored><TabCarta/></Censored>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   OFÍCIO DE EMISSÃO (aba própria)
════════════════════════════════════════════════════════════════ */
export const TabOficioEmissao = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas Estelares" title="Ofício de Emissão"
      subtitle="Gere ofícios a partir de modelos prontos." icon={HERO_ICON}/>
    <Censored><TabOficio/></Censored>
  </div>
);
