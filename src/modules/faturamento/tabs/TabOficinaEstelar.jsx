import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { T } from '../../../contexts/theme';
import { supabase } from '../../../contexts/user';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { PdfEditor } from '../PdfEditor';
import { PdfMerge } from '../PdfMerge';
import { logAssinatura } from '../assinaturaDb';
import rubricaUrl from '../../../assets/assinatura-evando.png';
import logo7ServUrl from '../../../assets/logo-7beneficios.png';

const HERO_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);

const Ico = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{flexShrink:0}}>{p.children}</svg>
);

const inp = {
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
  padding: '8px 11px', fontSize: 13, color: T.text,
  fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box', width: '100%',
};
const btnGold = {
  display:'inline-flex', alignItems:'center', gap:8, background:T.gold, color:'#fff',
  border:'none', borderRadius:10, padding:'10px 22px', fontSize:14, fontWeight:600,
  cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:`0 2px 10px ${T.gold}44`,
};
const Lbl = ({children}) => (
  <div style={{fontSize:11.5,fontWeight:600,color:T.textT,marginBottom:5,letterSpacing:'.04em',textTransform:'uppercase'}}>{children}</div>
);
const Fld = ({label,children,hint,style}) => (
  <div style={{marginBottom:13,...style}}>
    {label&&<Lbl>{label}</Lbl>}
    {children}
    {hint&&<div style={{fontSize:11,color:T.textD,marginTop:4}}>{hint}</div>}
  </div>
);

/* ════════════════════════════════════════════════════════════════
   CARTA DE CORREÇÃO — dados e helpers
════════════════════════════════════════════════════════════════ */
const SIG_STORE = 'oficina_assinaturas_salvas';
const loadSigs  = () => { try { const r=JSON.parse(localStorage.getItem(SIG_STORE)||'[]'); return Array.isArray(r)?r:[]; } catch { return []; } };

/* Códigos exatos do modelo boletimcontabil.com.br */
const COL1 = [
  {c:'1',l:'Razão Social'},   {c:'2',l:'Endereço'},
  {c:'3',l:'Município'},      {c:'4',l:'Estado'},
  {c:'5',l:'CNPJ'},           {c:'6',l:'Inscri. Estadual'},
  {c:'7',l:'Nat. Operação'},  {c:'8',l:'C.F.O.P.'},
  {c:'9',l:'Via Transporte'}, {c:'10',l:'Data Emissão'},
  {c:'11',l:'Data Saída'},    {c:'12',l:'Unid.(produto)'},
];
const COL2 = [
  {c:'13',l:'Qtdade. Produto'},       {c:'14',l:'Descrição'},
  {c:'15',l:'Preço Unitário'},        {c:'16',l:'Valor Total Produto'},
  {c:'17',l:'Classif. Fiscal'},       {c:'18',l:'Alíquota IPI'},
  {c:'19',l:'Valor IPI'},             {c:'20',l:'Base Cálc. IPI'},
  {c:'21',l:'Valor Total da Nota'},   {c:'22',l:'Alíquota ICMS'},
  {c:'23',l:'Valor ICMS'},            {c:'24',l:'Base Cálc. ICMS'},
];
const COL3 = [
  {c:'25',l:'Nome Transp.'},       {c:'26',l:'Ender. Transp.'},
  {c:'27',l:'Isenção IPI'},        {c:'28',l:'Isenção ICMS'},
  {c:'29',l:'Peso Líq./Bruto'},    {c:'30',l:'Espécie'},
  {c:'31',l:'Nota Fiscal Entrada'},{c:'32',l:'Nota Fiscal Saída'},
  {c:'33',l:'End. Corresp.'},      {c:'34',l:'Nº Peças'},
  {c:'35',l:'Nº Nota Fiscal'},     {c:'36',l:'Frete por Conta'},
];

const MONTHS_SEL = ['01','02','03','04','05','06','07','08','09','10','11','12'];

const FILL_COLOR = '#1A6FB5'; /* azul para campos preenchidos */

/* ── Documento (preview fiel ao modelo) ── */
const CartaDoc = ({ form }) => {
  const { cidade, dia, mes, ano, empresa, endereco, cnpj, ie,
          nfTipo, nfNumero, nfDataEmissao, retificacoes, sigSrc, logoSrc } = form;

  /* data de emissão da NF: ISO → partes */
  const [eAno='', eMes='', eDia=''] = nfDataEmissao ? nfDataEmissao.split('-') : [];

  /* garantir sempre 10 linhas na tabela de retificações */
  const rows = [...retificacoes];
  while (rows.length < 10) rows.push({codigo:'', texto:''});

  const TH = {border:'1px solid #666',padding:'2px 4px',background:'#e8e8e8',fontWeight:'bold',fontSize:9,textAlign:'center',whiteSpace:'nowrap'};
  const TD = {border:'1px solid #ccc',padding:'1px 3px',fontSize:9,verticalAlign:'top'};
  const TDc = {...TD,textAlign:'center',width:22};

  return (
    <div style={{background:'#fff',padding:'18px 22px',fontSize:10,fontFamily:'Arial,Helvetica,sans-serif',color:'#111',lineHeight:1.5,minWidth:520}}>

      {/* ── Logo + Título ── */}
      {logoSrc && (
        <div style={{textAlign:'center',marginBottom:8}}>
          <img src={logoSrc} alt="Logo" style={{maxHeight:56,maxWidth:200,objectFit:'contain'}}/>
        </div>
      )}
      <div style={{textAlign:'center',fontWeight:'bold',fontSize:14,marginBottom:13,letterSpacing:'.08em',textDecoration:'underline'}}>
        CARTA DE CORREÇÃO
      </div>

      {/* ── Cidade / Data ── */}
      <div style={{display:'flex',flexWrap:'wrap',alignItems:'baseline',gap:3,marginBottom:7,fontSize:10}}>
        <strong>CIDADE</strong>
        <span style={{borderBottom:'1px solid #444',minWidth:130,display:'inline-block',paddingLeft:4,fontWeight:'bold',fontSize:10.5}}>
          {cidade||'                    '}
        </span>
        <span style={{marginLeft:4}}>,</span>
        <strong style={{marginLeft:8}}>DIA:</strong>
        <span style={{border:'1px solid #999',padding:'0 3px',minWidth:22,textAlign:'center',display:'inline-block'}}>{String(dia).padStart(2,'0')}</span>
        <strong style={{marginLeft:2}}>/ MÊS:</strong>
        <span style={{border:'1px solid #999',padding:'0 3px',minWidth:22,textAlign:'center',display:'inline-block'}}>{String(Number(mes)+1).padStart(2,'0')}</span>
        <strong style={{marginLeft:2}}>/ ANO:</strong>
        <span style={{border:'1px solid #999',padding:'0 3px',minWidth:36,display:'inline-block'}}>{ano}</span>
      </div>

      {/* ── Empresa ── */}
      <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:6}}>
        <strong style={{whiteSpace:'nowrap'}}>EMPRESA</strong>
        <span style={{borderBottom:'1px solid #444',flex:1,display:'block',paddingLeft:4,fontWeight:'bold',fontSize:11.5,minHeight:15}}>
          {empresa}
        </span>
      </div>

      {/* ── Endereço ── */}
      <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:6}}>
        <strong style={{whiteSpace:'nowrap'}}>ENDEREÇO</strong>
        <span style={{borderBottom:'1px solid #444',flex:1,display:'block',paddingLeft:4,fontWeight:'bold',minHeight:15}}>
          {endereco}
        </span>
      </div>

      {/* ── CNPJ / IE ── */}
      <div style={{display:'flex',alignItems:'baseline',gap:24,marginBottom:10}}>
        <span><strong>CNPJ:</strong> <strong style={{fontSize:10.5}}>{cnpj}</strong></span>
        <span><strong>I.E</strong> <strong style={{fontSize:10.5}}>{ie}</strong></span>
      </div>

      {/* ── Tabela NF ── */}
      <table style={{width:'100%',borderCollapse:'collapse',marginBottom:8,border:'1px solid #666'}}>
        <thead>
          <tr>
            <th style={{...TH,width:'35%',borderRight:'1px solid #666'}}>DESCRIÇÃO</th>
            <th style={{...TH,width:'25%',borderRight:'1px solid #666'}}>N.F.Nº</th>
            <th style={{...TH,width:'40%'}}>EMISSÃO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {/* NOSSA / SUA */}
            <td style={{...TD,textAlign:'center',padding:'4px 6px'}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10}}>
                NOSSA&nbsp;
                <span style={{width:9,height:9,borderRadius:'50%',border:'1.5px solid #333',display:'inline-block',
                  background:nfTipo==='nossa'?'#222':'transparent',flexShrink:0}}/>
                &nbsp;SUA&nbsp;
                <span style={{width:9,height:9,borderRadius:'50%',border:'1.5px solid #333',display:'inline-block',
                  background:nfTipo==='sua'?'#222':'transparent',flexShrink:0}}/>
              </span>
            </td>
            {/* NF Número */}
            <td style={{...TD,textAlign:'center',fontWeight:'bold',fontSize:15,color:FILL_COLOR,letterSpacing:'.02em'}}>
              {nfNumero}
            </td>
            {/* Emissão — DIA/MÊS/ANO (ex: 01/01/2026), mesmo tamanho, sem setas */}
            <td style={{...TD,textAlign:'center',fontWeight:'bold',fontSize:12,color:FILL_COLOR}}>
              {eDia&&eMes&&eAno ? `${eDia}/${eMes}/${eAno}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Texto da carta ── */}
      <div style={{marginBottom:8,fontSize:9.5,textAlign:'justify',lineHeight:1.4}}>
        Em face do que determina a legislaçao fiscal vigente, vimos pela presente comunicar-lhe que a Nota Fiscal em referência contém a (s) irregularidade (s) que abaixo apontamos, e que solicitamos as devidas providências.
      </div>

      {/* ── Tabela de 4 colunas de códigos ── */}
      <table style={{width:'100%',borderCollapse:'collapse',marginBottom:8}}>
        <thead>
          <tr>
            <th style={{...TH,width:'5%'}}>Cód.</th><th style={{...TH,width:'20%',textAlign:'left'}}>Especificações</th>
            <th style={{...TH,width:'5%'}}>Cód.</th><th style={{...TH,width:'20%',textAlign:'left'}}>Especificações</th>
            <th style={{...TH,width:'5%'}}>Cód.</th><th style={{...TH,width:'20%',textAlign:'left'}}>Especificações</th>
            <th style={{...TH,width:'5%'}}>Cód.</th><th style={{...TH,width:'20%',textAlign:'left'}}>Especificações</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({length:12},(_,i)=>(
            <tr key={i}>
              <td style={TDc}>{COL1[i]?.c}</td><td style={TD}>{COL1[i]?.l}</td>
              <td style={TDc}>{COL2[i]?.c}</td><td style={TD}>{COL2[i]?.l}</td>
              <td style={TDc}>{COL3[i]?.c}</td><td style={TD}>{COL3[i]?.l}</td>
              <td style={TDc}>{i===0?'999':''}</td><td style={TD}>{i===0?'Outras':''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Tabela de retificações ── */}
      <table style={{width:'100%',borderCollapse:'collapse',marginBottom:10}}>
        <thead>
          <tr>
            <th style={{...TH,width:'14%',lineHeight:1.3,whiteSpace:'normal',padding:'3px 4px'}}>
              Códigos com<br/>Irregularidades
            </th>
            <th style={{...TH,textAlign:'left'}}>Retificações a serem consideradas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>{
            const filled = r.codigo||r.texto;
            return (
              <tr key={i}>
                <td style={{...TDc,fontWeight:filled?700:400,color:filled?FILL_COLOR:'transparent',
                  fontSize:filled?10.5:9.5,padding:'1px 4px',minHeight:18,height:18}}>
                  {r.codigo||' '}
                </td>
                <td style={{...TD,fontWeight:filled?700:400,color:filled?FILL_COLOR:'#111',
                  fontSize:filled?10:9.5,minHeight:18,height:18,padding:'1px 5px'}}>
                  {r.texto||' '}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Parágrafo de encerramento ── */}
      <div style={{marginBottom:12,fontSize:9.5,textAlign:'justify',lineHeight:1.4}}>
        Para evitar qualquer sanção fiscal, solicitamos acusarem o recebimento desta, na cópia que a acompanha, devendo a via de V.Sª ficar arquivada com a nota fiscal em questão.
      </div>

      {/* ── Atenciosamente + Assinatura ── */}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <div style={{textAlign:'center',minWidth:220}}>
          {sigSrc&&<img src={sigSrc} alt="Assinatura" style={{height:38,maxWidth:200,objectFit:'contain',display:'block',margin:'0 auto 3px'}}/>}
          <div style={{borderBottom:'1px solid #666',marginBottom:4,marginTop:sigSrc?0:28}}/>
          <div style={{fontSize:10}}>Atenciosamente,</div>
        </div>
      </div>

      {/* ── Rodapé ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,fontSize:10}}>
        <div>
          <div style={{marginBottom:3}}>Acusamos recebimento da 1ª via.</div>
          <div style={{fontWeight:'bold',marginBottom:18}}>LOCAL E DATA</div>
          <div style={{borderBottom:'1px solid #666',marginBottom:4,width:'90%'}}/>
          <div style={{fontWeight:'bold',marginBottom:22}}>ASSINATURA</div>
          <div style={{borderBottom:'1px solid #666',width:'90%'}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:'#555',marginBottom:1}}>R. Social</div>
          <div style={{fontWeight:'bold',fontSize:11.5,marginBottom:6,border:'1px solid #999',borderRadius:2,padding:'3px 7px',minHeight:15}}>
            {empresa||<span style={{color:'#aaa',fontStyle:'italic',fontWeight:400}}>Razão Social</span>}
          </div>
          <div style={{fontSize:9,color:'#555',marginBottom:1}}>Ender.</div>
          <div style={{fontWeight:'bold',color:FILL_COLOR,fontSize:10,marginBottom:6,border:'1px solid #999',borderRadius:2,padding:'3px 7px',minHeight:15}}>
            {endereco||' '}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,fontSize:10}}>
            <span style={{whiteSpace:'nowrap'}}>CNPJ</span>
            <strong style={{border:'1px solid #999',borderRadius:2,padding:'3px 7px',flex:1,minHeight:15}}>{cnpj||'              '}</strong>
            <span style={{whiteSpace:'nowrap'}}>I.Estadual</span>
            <strong style={{border:'1px solid #999',borderRadius:2,padding:'3px 7px',minWidth:80,minHeight:15}}>{ie||' '}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Formulário + Preview ── */
const TabCarta = () => {
  const hoje = new Date();
  // Dados fixos da 7Serv — vêm sempre preenchidos, mas continuam editáveis no formulário.
  const emptyForm = () => ({
    cidade:'FORTALEZA', dia:String(hoje.getDate()), mes:String(hoje.getMonth()), ano:String(hoje.getFullYear()),
    empresa:'7SERV GESTAO DE BENEFICIOS LTDA',
    endereco:'AV WASHINGTON SOARES, 3663 - EDSON QUEIROZ, CEP 60.811-341',
    cnpj:'13.858.769/0001-97', ie:'0951862-2',
    nfTipo:'nossa', nfNumero:'', nfDataEmissao:'',
    // 2 linhas já prontas (a maioria das cartas tem pelo menos isso) — ainda dá pra
    // adicionar mais ou remover se sobrar linha em branco.
    retificacoes:[{codigo:'',texto:''},{codigo:'',texto:''}],
    sigSrc:rubricaUrl, logoSrc:logo7ServUrl,
  });

  const [form, setForm] = useState(emptyForm);
  const savedSigs = useState(() => [
    {id:'default-ev',name:'ASSINATURA EV. JR',dataUrl:rubricaUrl},
    ...loadSigs(),
  ])[0];

  const set    = (k,v)  => setForm(p=>({...p,[k]:v}));
  const addRow = ()     => setForm(p=>({...p,retificacoes:[...p.retificacoes,{codigo:'',texto:''}]}));
  const rmRow  = (i)    => setForm(p=>({...p,retificacoes:p.retificacoes.filter((_,j)=>j!==i)}));
  const setRow = (i,k,v)=> setForm(p=>({...p,retificacoes:p.retificacoes.map((r,j)=>j===i?{...r,[k]:v}:r)}));

  const sec = (t) => (
    <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.06em',textTransform:'uppercase',
      borderBottom:`1px solid ${T.border}`,paddingBottom:7,marginTop:20,marginBottom:14}}>
      {t}
    </div>
  );

  const [pdfBusy, setPdfBusy] = useState(false);

  // Gera o PDF direto no código (html2canvas + jsPDF) em vez de passar pelo
  // diálogo de impressão do navegador — sem diálogo, não existe cabeçalho/
  // rodapé do Chrome (data, título, "about:blank") pra carimbar em cima do
  // documento, então o problema nem chega a existir.
  const downloadCartaPdf = async () => {
    const src = document.getElementById('carta-doc');
    if (!src) return;
    setPdfBusy(true);
    // O preview fica dentro de um painel com scroll próprio (overflow:auto,
    // maxHeight:84vh — ver abaixo). Se o usuário tivesse rolado esse painel pra
    // baixo antes de clicar em Baixar, o html2canvas capturava a partir da
    // posição de scroll ERRADA (bug conhecido da lib com containers scrolláveis
    // aninhados) — o resultado saía cortado pela metade (só a parte que estava
    // visível). Zera o scroll do painel (E da janela) antes de capturar e
    // restaura depois, pra sempre capturar o documento inteiro do topo.
    const scrollParent = src.closest('[style*="overflow"]') || src.parentElement;
    const prevParentScroll = scrollParent ? scrollParent.scrollTop : 0;
    const prevWinScroll = window.scrollY;
    if (scrollParent) scrollParent.scrollTop = 0;
    window.scrollTo(0, 0);
    try {
      // scale mais alto (era 2) — a fonte pequena do documento (9-10px) ficava
      // borrada/"péssima qualidade" no PDF final. windowWidth/Height + x/y=0
      // força o html2canvas a enxergar o elemento como se estivesse sozinho no
      // topo da página, sem depender do scroll de nenhum ancestral.
      const canvas = await html2canvas(src, {
        scale: 3, useCORS: true, backgroundColor: '#ffffff',
        scrollX: 0, scrollY: 0,
        windowWidth: src.scrollWidth, windowHeight: src.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/png');
      // Página do PDF do tamanho exato do documento (px → mm, 96dpi)
      const wMm = src.offsetWidth * 25.4 / 96, hMm = src.offsetHeight * 25.4 / 96;
      const pdf = new jsPDF({ unit: 'mm', format: [wMm, hMm] });
      pdf.addImage(imgData, 'PNG', 0, 0, wMm, hMm);
      const empresaSlug = (form.empresa || 'documento').trim().slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '-') || 'documento';
      pdf.save(`Carta de Correcao - ${empresaSlug}.pdf`);

      // Guarda o mesmo PDF no Storage e registra no Histórico de Assinatura —
      // deixa o admin ver/baixar depois quem gerou o quê. Não bloqueia o
      // download do usuário se falhar.
      try {
        const blob = pdf.output('blob');
        const path = `carta-correcao/${Date.now()}_${empresaSlug}.pdf`;
        const { error: upErr } = await supabase.storage
          .from('oficina-documentos').upload(path, blob, { contentType: 'application/pdf', upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('oficina-documentos').getPublicUrl(path);
        await logAssinatura({
          arquivo: `Carta de Correção — ${form.empresa || 'sem razão social'}${form.nfNumero ? ' (NF ' + form.nfNumero + ')' : ''}`,
          tipo: 'carta_correcao',
          arquivoUrl: urlData?.publicUrl || null,
        });
      } catch { /* histórico indisponível — não bloqueia o download do usuário */ }
    } catch (e) {
      window.alert('Não foi possível gerar o PDF: ' + (e?.message || 'erro'));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div>

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:26,alignItems:'start'}}>

        {/* ═══════════ FORMULÁRIO ═══════════ */}
        <div style={{paddingBottom:40}}>

          {sec('Dados da Empresa')}
          {/* Logo */}
          <Fld label="Logo da empresa (opcional)">
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <label style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 13px',borderRadius:8,
                border:`1px dashed ${T.border}`,cursor:'pointer',fontSize:12.5,color:T.textS,background:'transparent'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                {form.logoSrc ? 'Trocar logo' : 'Carregar logo'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" style={{display:'none'}}
                  onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=()=>set('logoSrc',r.result);r.readAsDataURL(f);}e.target.value='';}}/>
              </label>
              {form.logoSrc && (
                <>
                  <img src={form.logoSrc} alt="Logo" style={{height:32,maxWidth:100,objectFit:'contain',borderRadius:4,border:`1px solid ${T.border}`,padding:2}}/>
                  <button onClick={()=>set('logoSrc',null)} style={{background:'none',border:'none',cursor:'pointer',color:T.textD,fontSize:18,lineHeight:1}}>×</button>
                </>
              )}
            </div>
          </Fld>
          <Fld label="Empresa (Razão Social)">
            <input style={{...inp,textTransform:'uppercase'}} placeholder="Ex: 7 SERV GESTAO DE BENEFICIOS" value={form.empresa} onChange={e=>set('empresa',e.target.value.toUpperCase())}/>
          </Fld>
          <Fld label="Endereço">
            <input style={{...inp,textTransform:'uppercase'}} placeholder="Rua, nº, bairro, cidade" value={form.endereco} onChange={e=>set('endereco',e.target.value.toUpperCase())}/>
          </Fld>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:13}}>
            <div><Lbl>CNPJ</Lbl><input style={{...inp,textTransform:'uppercase'}} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e=>set('cnpj',e.target.value.toUpperCase())}/></div>
            <div><Lbl>I. Estadual</Lbl><input style={{...inp,textTransform:'uppercase'}} placeholder="000000000" value={form.ie} onChange={e=>set('ie',e.target.value.toUpperCase())}/></div>
          </div>

          {sec('Data da Carta')}
          <Fld label="Cidade">
            <input style={{...inp,textTransform:'uppercase'}} placeholder="Ex: FORTALEZA" value={form.cidade} onChange={e=>set('cidade',e.target.value.toUpperCase())}/>
          </Fld>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1.6fr 1.2fr',gap:10}}>
            <Fld label="Dia">
              <input style={inp} type="number" min="1" max="31" value={form.dia} onChange={e=>set('dia',e.target.value)}/>
            </Fld>
            <Fld label="Mês">
              <select style={{...inp,appearance:'none'}} value={form.mes} onChange={e=>set('mes',e.target.value)}>
                {MONTHS_SEL.map((m,i)=><option key={i} value={i}>{m} — {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}</option>)}
              </select>
            </Fld>
            <Fld label="Ano">
              <input style={inp} value={form.ano} onChange={e=>set('ano',e.target.value)} maxLength={4}/>
            </Fld>
          </div>

          {sec('Nota Fiscal')}
          {/* NOSSA / SUA */}
          <Fld label="Tipo">
            <div style={{display:'flex',gap:10}}>
              {['nossa','sua'].map(t=>(
                <div key={t} onClick={()=>set('nfTipo',t)} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',
                  padding:'8px 14px',borderRadius:9,border:`1px solid ${form.nfTipo===t?T.gold:T.border}`,
                  background:form.nfTipo===t?`${T.gold}14`:'transparent',transition:'all .12s',flex:1,justifyContent:'center'}}>
                  <div style={{width:13,height:13,borderRadius:'50%',flexShrink:0,
                    border:`1.5px solid ${form.nfTipo===t?T.gold:'#aaa'}`,background:form.nfTipo===t?T.gold:'transparent'}}/>
                  <span style={{fontSize:13,fontWeight:form.nfTipo===t?700:400,color:form.nfTipo===t?T.gold:T.textS,textTransform:'uppercase'}}>{t}</span>
                </div>
              ))}
            </div>
          </Fld>
          <Fld label="N.F. Nº">
            <input style={{...inp,textTransform:'uppercase'}} placeholder="Ex: 12421" value={form.nfNumero} onChange={e=>set('nfNumero',e.target.value.toUpperCase())}/>
          </Fld>
          <Fld label="Data de Emissão">
            <input style={inp} type="date" value={form.nfDataEmissao} onChange={e=>set('nfDataEmissao',e.target.value)}/>
          </Fld>

          {sec('Retificações')}
          <div style={{fontSize:12,color:T.textS,marginBottom:12,lineHeight:1.5}}>
            Preencha o código e a correção. Use uma linha por retificação. Linhas preenchidas aparecem em vermelho no documento.
          </div>
          {form.retificacoes.map((r,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'80px 1fr 28px',gap:6,marginBottom:8,alignItems:'center'}}>
              <div>
                {i===0&&<Lbl>Cód.</Lbl>}
                <input style={{...inp,textAlign:'center',fontWeight:600,textTransform:'uppercase'}} placeholder="14" value={r.codigo} onChange={e=>setRow(i,'codigo',e.target.value.toUpperCase())} maxLength={3}/>
              </div>
              <div>
                {i===0&&<Lbl>Retificação</Lbl>}
                <input style={{...inp,textTransform:'uppercase'}} placeholder="Ex: ONDE LÊ: ... LEIA-SE: ..." value={r.texto} onChange={e=>setRow(i,'texto',e.target.value.toUpperCase())}/>
              </div>
              <div style={{paddingTop:i===0?20:0}}>
                {form.retificacoes.length>1&&(
                  <button onClick={()=>rmRow(i)} style={{width:26,height:26,border:`1px solid rgba(192,64,80,.3)`,
                    borderRadius:7,background:'rgba(192,64,80,.06)',cursor:'pointer',color:'#C04050',
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={addRow} style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:T.gold,
            background:'transparent',border:`1px dashed ${T.gold}88`,borderRadius:8,padding:'6px 12px',cursor:'pointer',fontFamily:'var(--font-body)',marginBottom:4}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar linha
          </button>

          {sec('Assinatura')}
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {[{id:'__none__',name:'Sem assinatura',dataUrl:null},...savedSigs].map(s=>{
              const active = form.sigSrc===s.dataUrl;
              return (
                <div key={s.id} onClick={()=>set('sigSrc',s.dataUrl)} style={{display:'flex',alignItems:'center',gap:10,
                  padding:'7px 10px',borderRadius:9,cursor:'pointer',transition:'all .12s',
                  border:`1px solid ${active?T.gold:T.border}`,background:active?`${T.gold}12`:'transparent'}}>
                  <div style={{width:13,height:13,borderRadius:'50%',flexShrink:0,transition:'all .12s',
                    border:`1.5px solid ${active?T.gold:'#aaa'}`,background:active?T.gold:'transparent'}}/>
                  {s.dataUrl
                    ? <img src={s.dataUrl} alt={s.name} style={{height:22,maxWidth:90,objectFit:'contain'}}/>
                    : <span style={{fontSize:12,color:T.textD,fontStyle:'italic'}}>Nenhuma</span>}
                  <span style={{fontSize:11.5,color:active?T.gold:T.textS,fontWeight:active?600:400}}>{s.name}</span>
                </div>
              );
            })}
          </div>

          {/* Botões */}
          <div style={{display:'flex',gap:10,marginTop:24,flexWrap:'wrap'}}>
            <button style={{...btnGold,opacity:pdfBusy?.7:1,cursor:pdfBusy?'default':'pointer'}} onClick={downloadCartaPdf} disabled={pdfBusy}
              onMouseEnter={e=>{if(!pdfBusy)e.currentTarget.style.opacity='.85';}} onMouseLeave={e=>{if(!pdfBusy)e.currentTarget.style.opacity='1';}}>
              <Ico><path d="M6 9V2h12l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><polyline points="14 2 14 8 20 8"/></Ico>
              {pdfBusy ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
            <button onClick={()=>setForm(emptyForm())} style={{display:'inline-flex',alignItems:'center',gap:7,
              background:'transparent',border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 18px',
              fontSize:13,color:T.textS,cursor:'pointer',fontFamily:'var(--font-body)'}}>
              <Ico><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></Ico>
              Limpar formulário
            </button>
          </div>
        </div>

        {/* ═══════════ PREVIEW ═══════════ */}
        <div style={{position:'sticky',top:6,alignSelf:'start'}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textD,letterSpacing:'.07em',
            textTransform:'uppercase',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Pré-visualização em tempo real
          </div>
          <div style={{background:'#ddd',borderRadius:12,border:`1px solid ${T.border}`,padding:8,maxHeight:'84vh',overflow:'auto',boxShadow:'0 4px 20px rgba(0,0,0,.1)'}}>
            <div id="carta-doc">
              <CartaDoc form={form}/>
            </div>
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

const OFICIO_MODELS = [{ id:'eusebio', label:'Ofício de Eusébio' }];
const inputStyle = { width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:'10px 13px',fontSize:14,color:T.text,fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box' };
const textareaStyle = { ...inputStyle, minHeight:110, resize:'vertical', lineHeight:1.6 };
const btnPrimary = { display:'inline-flex',alignItems:'center',gap:8,background:T.gold,color:'#fff',border:'none',borderRadius:10,padding:'10px 22px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:`0 2px 10px ${T.gold}44` };
const MONTH_NAMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const FldO = ({label,children,hint}) => (
  <div style={{marginBottom:20}}>
    {label&&<div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:6}}>{label}</div>}
    {children}
    {hint&&<div style={{fontSize:11.5,color:T.textD,marginTop:5}}>{hint}</div>}
  </div>
);
const IOf = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{p.children}</svg>;

const OficioEusebio = () => {
  const hoje = new Date();
  const [form, setForm] = useState({ numero:'',ano:String(hoje.getFullYear()),dia:String(hoje.getDate()),mes:String(hoje.getMonth()),destinatarioCargo:'',destinatarioNome:'',assunto:'',corpo:'',remetentNome:'',remetenteCargo:'',remetenteSec:'' });
  const set = (k,v)=>setForm(p=>({...p,[k]:v}));
  const dataFmt = `Eusébio, ${form.dia} de ${MONTH_NAMES[Number(form.mes)]} de ${form.ano}`;
  return (
    <div style={{maxWidth:760,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Identificação</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <FldO label="Nº do Ofício"><input style={inputStyle} placeholder="001" value={form.numero} onChange={e=>set('numero',e.target.value)}/></FldO>
          <FldO label="Ano"><input style={inputStyle} placeholder="2026" value={form.ano} onChange={e=>set('ano',e.target.value)}/></FldO>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:16}}>
          <FldO label="Dia"><input style={inputStyle} type="number" min="1" max="31" value={form.dia} onChange={e=>set('dia',e.target.value)}/></FldO>
          <FldO label="Mês"><select style={{...inputStyle,appearance:'none'}} value={form.mes} onChange={e=>set('mes',e.target.value)}>{MONTH_NAMES.map((m,i)=><option key={i} value={i}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}</select></FldO>
        </div>
        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Destinatário</div>
        <FldO label="Cargo / Título"><input style={inputStyle} placeholder="Ex: Ilmo. Sr. Secretário Municipal de Saúde" value={form.destinatarioCargo} onChange={e=>set('destinatarioCargo',e.target.value)}/></FldO>
        <FldO label="Nome"><input style={inputStyle} placeholder="Nome do destinatário" value={form.destinatarioNome} onChange={e=>set('destinatarioNome',e.target.value)}/></FldO>
        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Conteúdo</div>
        <FldO label="Assunto"><input style={inputStyle} placeholder="Assunto do ofício" value={form.assunto} onChange={e=>set('assunto',e.target.value)}/></FldO>
        <FldO label="Corpo do Texto"><textarea style={{...textareaStyle,minHeight:130}} placeholder="Texto principal do ofício..." value={form.corpo} onChange={e=>set('corpo',e.target.value)}/></FldO>
        <StarDivider my={16}/>
        <div style={{fontSize:12,fontWeight:600,color:T.textT,letterSpacing:'.07em',textTransform:'uppercase',marginBottom:16}}>Remetente</div>
        <FldO label="Nome do Assinante"><input style={inputStyle} placeholder="Nome completo" value={form.remetentNome} onChange={e=>set('remetentNome',e.target.value)}/></FldO>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <FldO label="Cargo"><input style={inputStyle} placeholder="Ex: Coordenador" value={form.remetenteCargo} onChange={e=>set('remetenteCargo',e.target.value)}/></FldO>
          <FldO label="Secretaria"><input style={inputStyle} placeholder="Ex: SEMUS" value={form.remetenteSec} onChange={e=>set('remetenteSec',e.target.value)}/></FldO>
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
          {(form.destinatarioCargo||form.destinatarioNome)&&<div style={{marginBottom:16,fontSize:11.5}}><div>{form.destinatarioCargo||'Cargo'}</div><div><strong>{form.destinatarioNome||'Nome'}</strong></div></div>}
          {form.assunto&&<div style={{marginBottom:16,fontSize:11.5}}><strong>Assunto:</strong> {form.assunto}</div>}
          <div style={{marginBottom:24,fontSize:11.5,textAlign:'justify',whiteSpace:'pre-wrap'}}>{form.corpo||'O corpo do ofício será exibido aqui.'}</div>
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
const ToolCard = ({ title, desc, icon, onClick }) => (
  <button onClick={onClick} style={{
    display:'flex', flexDirection:'column', alignItems:'flex-start', gap:12, textAlign:'left',
    padding:'22px 24px', borderRadius:16, border:`1.5px solid ${T.border}`, background:T.surface,
    cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:T.sh, transition:'transform .15s, border-color .15s',
  }}
    onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.gold; e.currentTarget.style.transform='translateY(-2px)'; }}
    onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.transform='none'; }}>
    <div style={{width:44,height:44,borderRadius:12,background:T.goldGl,display:'flex',alignItems:'center',justifyContent:'center',color:T.gold}}>
      {icon}
    </div>
    <div style={{fontSize:16,fontWeight:700,color:T.text}}>{title}</div>
    <div style={{fontSize:13,color:T.textS,lineHeight:1.5}}>{desc}</div>
  </button>
);

const BackLink = ({ onClick }) => (
  <button onClick={onClick} style={{
    display:'flex', alignItems:'center', gap:6, marginBottom:14, padding:'7px 14px', borderRadius:9,
    border:`1px solid ${T.border}`, background:'transparent', color:T.textS, fontSize:12.5, fontWeight:600,
    cursor:'pointer', fontFamily:'var(--font-body)',
  }}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Trocar ferramenta
  </button>
);

export const TabOficinaEstelar = () => {
  const [tool, setTool]     = useState(null); // null (escolha) | 'editor' | 'mesclar'
  const [hasDoc, setHasDoc] = useState(false);

  if (!tool) {
    return (
      <div style={{fontFamily:'var(--font-body)'}}>
        <StellarHero compact eyebrow="Ferramenta de Edição" title="O que você quer fazer?"
          subtitle="Escolha uma ferramenta pra continuar." icon={HERO_ICON}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
          <ToolCard title="Editor de PDF"
            desc="Edite o texto existente do PDF, adicione textos, imagens e assinaturas."
            onClick={()=>{ setHasDoc(false); setTool('editor'); }}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}/>
          <ToolCard title="Mesclar PDF"
            desc="Organize a ordem das páginas arrastando e junte vários PDFs num único arquivo."
            onClick={()=>setTool('mesclar')}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/><path d="M10 8h4M10 12h4M10 16h4"/></svg>}/>
        </div>
      </div>
    );
  }

  if (tool === 'mesclar') {
    return (
      <div style={{fontFamily:'var(--font-body)'}}>
        <BackLink onClick={()=>setTool(null)}/>
        <StellarHero compact eyebrow="Ferramenta de Edição" title="Mesclar PDF"
          subtitle="Organize a ordem das páginas e junte tudo num único arquivo." icon={HERO_ICON}/>
        <PdfMerge/>
      </div>
    );
  }

  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {!hasDoc && <BackLink onClick={()=>setTool(null)}/>}
      {!hasDoc&&<StellarHero compact eyebrow="Ferramenta de Edição" title="Editor de PDF"
        subtitle="Edite o texto existente do PDF, adicione textos, imagens e assinaturas." icon={HERO_ICON}/>}
      <PdfEditor onDoc={setHasDoc}/>
    </div>
  );
};

export const TabCartaCorrecao = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas Estelares" title="Carta de Correção"
      subtitle="Preencha os campos — o documento é montado em tempo real." icon={HERO_ICON}/>
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
