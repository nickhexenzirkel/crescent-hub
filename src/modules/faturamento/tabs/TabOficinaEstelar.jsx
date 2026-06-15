import { useState, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';

/* ─── Ícone inline ─── */
const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

/* ─── Sub-abas ─── */
const SUBTABS = [
  {
    id: 'carta',
    label: 'Carta de Correção',
    icon: <I><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></I>,
  },
  {
    id: 'assinatura',
    label: 'Assinatura Automática',
    icon: <I><path d="M20 19.5v.5a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h9"/><polyline points="13 8 16 5 21 10 18 13"/><line x1="8" y1="17" x2="12" y2="17"/><line x1="8" y1="13" x2="10" y2="13"/></I>,
  },
  {
    id: 'oficio',
    label: 'Ofício',
    icon: <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></I>,
  },
  {
    id: 'editor-pdf',
    label: 'Editor de PDF',
    icon: <I><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="14" r="2"/><path d="M20 20l-3-3"/></I>,
  },
];

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

const DropZone = ({ label, accept, onFile, file }) => {
  const ref = useRef();
  return (
    <div
      onClick={() => ref.current?.click()}
      style={{
        border:`2px dashed ${file ? T.gold : T.border}`,
        borderRadius:13,padding:'28px 20px',textAlign:'center',
        cursor:'pointer',background:file?`${T.gold}08`:T.surfaceSub||'transparent',
        transition:'all .15s',
      }}
    >
      <input ref={ref} type="file" accept={accept} style={{display:'none'}}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}/>
      {file ? (
        <>
          <div style={{fontSize:22,marginBottom:6}}>📄</div>
          <div style={{fontSize:13.5,fontWeight:600,color:T.text}}>{file.name}</div>
          <div style={{fontSize:12,color:T.textD,marginTop:3}}>{(file.size/1024).toFixed(1)} KB · clique para trocar</div>
        </>
      ) : (
        <>
          <div style={{fontSize:22,marginBottom:6}}>⬆️</div>
          <div style={{fontSize:13.5,fontWeight:500,color:T.textS}}>{label}</div>
          <div style={{fontSize:12,color:T.textD,marginTop:4}}>Clique para selecionar</div>
        </>
      )}
    </div>
  );
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
   2. ASSINATURA AUTOMÁTICA
════════════════════════════════════════════════════════════════ */
const TabAssinatura = () => {
  const [pdf, setPdf] = useState(null);
  const [form, setForm] = useState({ nome:'', cargo:'', matricula:'', pagina:'1', posX:'', posY:'' });
  const set = (k, v) => setForm(p => ({...p, [k]:v}));

  return (
    <div style={{maxWidth:680}}>
      <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:28}}>
        Carregue um PDF e configure os dados do assinante. A assinatura será inserida automaticamente na posição indicada.
      </p>

      <Field label="Arquivo PDF">
        <DropZone label="Arraste ou selecione o PDF para assinar" accept=".pdf" file={pdf} onFile={setPdf}/>
      </Field>

      <StarDivider my={22}/>
      <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Dados do Assinante</div>

      <Field label="Nome Completo">
        <input style={inputStyle} placeholder="Nome do assinante" value={form.nome}
          onChange={e => set('nome', e.target.value)}/>
      </Field>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Field label="Cargo / Função">
          <input style={inputStyle} placeholder="Ex: Diretor de Faturamento" value={form.cargo}
            onChange={e => set('cargo', e.target.value)}/>
        </Field>
        <Field label="Matrícula">
          <input style={inputStyle} placeholder="Ex: 123456" value={form.matricula}
            onChange={e => set('matricula', e.target.value)}/>
        </Field>
      </div>

      <StarDivider my={22}/>
      <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Posição no Documento</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <Field label="Página">
          <input style={inputStyle} type="number" min="1" placeholder="1" value={form.pagina}
            onChange={e => set('pagina', e.target.value)}/>
        </Field>
        <Field label="Posição X (mm)" hint="Da borda esquerda">
          <input style={inputStyle} type="number" placeholder="20" value={form.posX}
            onChange={e => set('posX', e.target.value)}/>
        </Field>
        <Field label="Posição Y (mm)" hint="Da borda inferior">
          <input style={inputStyle} type="number" placeholder="25" value={form.posY}
            onChange={e => set('posY', e.target.value)}/>
        </Field>
      </div>

      <StarDivider my={24}/>

      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <button style={btnPrimary} onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <I><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I>
          Aplicar Assinatura e Baixar
        </button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   3. OFÍCIO
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
   4. EDITOR DE PDF
════════════════════════════════════════════════════════════════ */
const TabEditorPDF = () => {
  const [pdf, setPdf] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const handleFile = (f) => {
    setPdf(f);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(f));
  };

  return (
    <div>
      {!pdf ? (
        <div style={{maxWidth:560}}>
          <p style={{fontSize:14,color:T.textS,lineHeight:1.65,marginTop:0,marginBottom:28}}>
            Carregue um PDF para visualizar e editar diretamente no navegador. Você poderá adicionar texto, anotações e reorganizar páginas.
          </p>
          <DropZone label="Selecione um PDF para editar" accept=".pdf" file={null} onFile={handleFile}/>
        </div>
      ) : (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>{pdf.name}</div>
              <div style={{fontSize:12,color:T.textD}}>{(pdf.size/1024).toFixed(1)} KB</div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button
                onClick={() => { setPdf(null); if(pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }}
                style={{
                  background:'none',border:`1px solid ${T.border}`,borderRadius:8,
                  padding:'7px 14px',fontSize:13,color:T.textS,cursor:'pointer',
                  fontFamily:'var(--font-body)',transition:'background .14s',
                }}
                onMouseEnter={e=>e.currentTarget.style.background=T.surfaceSub||'rgba(0,0,0,0.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}
              >
                Trocar arquivo
              </button>
              <button style={{...btnPrimary,padding:'7px 16px',fontSize:13}}
                onMouseEnter={e=>e.currentTarget.style.opacity='.85'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                <I><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></I>
                Baixar
              </button>
            </div>
          </div>
          <div style={{borderRadius:12,overflow:'hidden',border:`1px solid ${T.border}`,boxShadow:'0 4px 18px rgba(0,0,0,.08)'}}>
            <iframe
              src={pdfUrl}
              title="Editor de PDF"
              style={{width:'100%',height:'72vh',border:'none',display:'block'}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════════════ */
export const TabOficinaEstelar = () => {
  const [sub, setSub] = useState('carta');
  const current = SUBTABS.find(s => s.id === sub);

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      <StellarHero
        compact
        eyebrow="Ferramentas Estelares"
        title={current.label}
        subtitle="Ferramentas de edição documental — correções, assinaturas, ofícios e PDFs."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
      />

      {/* Barra de sub-abas */}
      <div style={{
        display:'flex',gap:4,
        background:T.surface,border:`1px solid ${T.border}`,
        borderRadius:13,padding:5,marginBottom:32,
        width:'fit-content',
      }}>
        {SUBTABS.map(s => {
          const a = sub === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              style={{
                display:'flex',alignItems:'center',gap:7,
                padding:'8px 16px',borderRadius:9,border:'none',
                background: a ? T.goldGl : 'transparent',
                color: a ? T.gold : T.textS,
                fontSize:13.5,fontWeight: a ? 600 : 400,
                cursor:'pointer',fontFamily:'var(--font-body)',
                transition:'all .14s',
                outline: a ? `1px solid rgba(212,168,75,0.22)` : '1px solid transparent',
              }}
              onMouseEnter={e => { if(!a) e.currentTarget.style.background = T.surfaceSub||'rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { if(!a) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{color: a ? T.gold : T.textT}}>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      <StarDivider my={0} style={{marginBottom:28}}/>

      {/* Conteúdo da sub-aba */}
      <div style={{marginTop:24}}>
        {sub === 'carta'      && <TabCarta/>}
        {sub === 'assinatura' && <TabAssinatura/>}
        {sub === 'oficio'     && <TabOficio/>}
        {sub === 'editor-pdf' && <TabEditorPDF/>}
      </div>
    </div>
  );
};
