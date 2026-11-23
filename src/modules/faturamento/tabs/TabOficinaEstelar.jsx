import { useState } from 'react';
import jsPDF from 'jspdf';
import { T } from '../../../contexts/theme';
import { supabase } from '../../../contexts/user';
import { StellarHero } from '../StellarHero';
import { PdfEditor } from '../PdfEditor';
import { PdfOrganizer } from '../PdfOrganizer';
import { PdfMerge } from '../PdfMerge';
import { logAssinatura } from '../assinaturaDb';
import rubricaUrl from '../../../assets/assinatura-cleanderson.png';
import logo7ServUrl from '../../../assets/logo-7beneficios.png';
import logoTimbradoUrl from '../../../assets/oficio-logo.png';

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
    <div style={{background:'#fff',width:794,minHeight:1123,boxSizing:'border-box',display:'flex',flexDirection:'column',
      fontSize:10,fontFamily:'Arial,Helvetica,sans-serif',color:'#111',lineHeight:1.5}}>

      {/* ── Papel timbrado 7SERV ── */}
      <div style={{height:170,position:'relative',flexShrink:0}}>
        <div style={{position:'absolute',top:20,left:0,right:0,height:99,background:'#07856a'}}/>
        <div style={{position:'absolute',top:15,left:0,width:129,height:154,background:'#13475b'}}/>
        <img src={logoTimbradoUrl} alt="Logo 7SERV" style={{position:'absolute',top:2,left:-17,width:186,height:134,objectFit:'contain'}}/>
        <div style={{position:'absolute',top:50,left:360,color:'#fff',fontSize:48,fontWeight:'bold',letterSpacing:2}}>
          BENEFÍCIOS
        </div>
      </div>

      <div style={{padding:'10px 48px 18px',flex:1}}>
      {logoSrc && logoSrc !== logo7ServUrl && (
        <div style={{textAlign:'center',marginBottom:8}}>
          <img src={logoSrc} alt="Logo da empresa" style={{maxHeight:56,maxWidth:200,objectFit:'contain'}}/>
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

    </div>
  );
};

const carregarImagemPdf = async (src) => {
  if (!src) return null;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar uma imagem do documento.');
  context.drawImage(image, 0, 0);
  return { data: canvas.toDataURL('image/png'), width: image.naturalWidth, height: image.naturalHeight };
};

const gerarCartaPdfVetorial = async (form) => {
  const px = (value) => value * 25.4 / 96;
  const [logoTimbrado, logoEmpresa, assinatura] = await Promise.all([
    carregarImagemPdf(logoTimbradoUrl),
    form.logoSrc && form.logoSrc !== logo7ServUrl ? carregarImagemPdf(form.logoSrc) : null,
    carregarImagemPdf(form.sigSrc),
  ]);
  const rows = [...form.retificacoes];
  while (rows.length < 10) rows.push({ codigo: '', texto: '' });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `Carta de Correção - ${form.empresa || '7SERV'}`, author: '7SERV Gestão de Benefícios LTDA' });
  const pageWidth = 210, bodyX = px(48), bodyWidth = pageWidth - bodyX * 2;
  const black = [17, 17, 17], blue = [26, 111, 181], gray = [232, 232, 232];
  const setFont = (size, bold = false, color = black) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };
  const drawText = (value, x, y, { size = 7.5, bold = false, color = black, align = 'left', maxWidth } = {}) => {
    const text = String(value ?? '');
    if (!text) return;
    setFont(size, bold, color);
    let fittedSize = size;
    while (maxWidth && pdf.getTextWidth(text) > maxWidth && fittedSize > 5.2) {
      fittedSize -= 0.2;
      pdf.setFontSize(fittedSize);
    }
    pdf.text(text, x, y, { align });
  };
  const drawLine = (x1, y1, x2, y2, color = [102, 102, 102], width = 0.2) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(width);
    pdf.line(x1, y1, x2, y2);
  };
  const drawBox = (x, y, width, height, fill = null, border = [153, 153, 153]) => {
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.2);
    if (fill) {
      pdf.setFillColor(...fill);
      pdf.rect(x, y, width, height, 'FD');
    } else {
      pdf.rect(x, y, width, height);
    }
  };
  const fitImage = (image, maxWidth, maxHeight) => {
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    return { width: image.width * ratio, height: image.height * ratio };
  };

  pdf.setFillColor(7, 133, 106);
  pdf.rect(0, px(20), pageWidth, px(99), 'F');
  pdf.setFillColor(19, 71, 91);
  pdf.rect(0, px(15), px(129), px(154), 'F');
  const headerLogoSize = fitImage(logoTimbrado, px(186), px(134));
  pdf.addImage(logoTimbrado.data, 'PNG',
    px(-17) + (px(186) - headerLogoSize.width) / 2,
    px(2) + (px(134) - headerLogoSize.height) / 2,
    headerLogoSize.width, headerLogoSize.height);
  drawText('BENEFÍCIOS', px(360), px(95), { size: 36, bold: true, color: [255, 255, 255] });

  let y = px(180);
  if (logoEmpresa) {
    const logoSize = fitImage(logoEmpresa, px(200), px(56));
    pdf.addImage(logoEmpresa.data, 'PNG', (pageWidth - logoSize.width) / 2, y, logoSize.width, logoSize.height);
    y += logoSize.height + px(8);
  }

  drawText('CARTA DE CORREÇÃO', pageWidth / 2, y + px(14), { size: 10.5, bold: true, align: 'center' });
  y += px(27);

  const cityY = y + px(19);
  drawText('CIDADE', bodyX, cityY, { bold: true });
  drawText(form.cidade || '                    ', bodyX + px(45), cityY, { size: 7.9, bold: true });
  drawLine(bodyX + px(42), y + px(22), bodyX + px(175), y + px(22), [68, 68, 68]);
  drawText(',', bodyX + px(179), cityY);
  drawText('DIA:', bodyX + px(198), cityY, { bold: true });
  const dayX = bodyX + px(224);
  drawBox(dayX, y + px(4), px(27), px(20));
  drawText(String(form.dia).padStart(2, '0'), dayX + px(13.5), cityY, { align: 'center' });
  drawText('/ MÊS:', dayX + px(31), cityY, { bold: true });
  const monthX = dayX + px(70);
  drawBox(monthX, y + px(4), px(27), px(20));
  drawText(String(Number(form.mes) + 1).padStart(2, '0'), monthX + px(13.5), cityY, { align: 'center' });
  drawText('/ ANO:', monthX + px(31), cityY, { bold: true });
  const yearX = monthX + px(68);
  drawBox(yearX, y + px(4), px(36), px(20));
  drawText(form.ano, yearX + px(18), cityY, { align: 'center' });
  y += px(34);

  const drawCompanyRow = (label, value, color = black) => {
    const baseline = y + px(11);
    drawText(label, bodyX, baseline, { bold: true });
    drawText(value, bodyX + px(61), baseline, { bold: true, color, maxWidth: bodyWidth - px(64) });
    drawLine(bodyX + px(58), y + px(13), bodyX + bodyWidth, y + px(13), [68, 68, 68]);
    y += px(25);
  };
  drawCompanyRow('EMPRESA', form.empresa);
  drawCompanyRow('ENDEREÇO', form.endereco);
  drawText(`CNPJ: ${form.cnpj}`, bodyX, y + px(10), { bold: true });
  drawText(`I.E ${form.ie}`, bodyX + px(152), y + px(10), { bold: true });
  y += px(28);

  const nfHeaderHeight = px(18), nfRowHeight = px(33);
  const nfWidths = [bodyWidth * 0.35, bodyWidth * 0.25, bodyWidth * 0.4];
  const nfHeaders = ['DESCRIÇÃO', 'N.F.Nº', 'EMISSÃO'];
  let nfX = bodyX;
  nfWidths.forEach((width, index) => {
    drawBox(nfX, y, width, nfHeaderHeight, gray, [102, 102, 102]);
    drawText(nfHeaders[index], nfX + width / 2, y + px(12), { size: 6.75, bold: true, align: 'center' });
    nfX += width;
  });
  nfX = bodyX;
  nfWidths.forEach((width) => {
    drawBox(nfX, y + nfHeaderHeight, width, nfRowHeight, null, [153, 153, 153]);
    nfX += width;
  });
  const typeY = y + nfHeaderHeight + px(21);
  setFont(7);
  const nossaWidth = pdf.getTextWidth('NOSSA'), suaWidth = pdf.getTextWidth('SUA');
  const circleRadius = px(4.5), labelGap = px(5), choiceGap = px(7);
  const choiceWidth = nossaWidth + suaWidth + labelGap * 2 + choiceGap + circleRadius * 4;
  let choiceX = bodyX + (nfWidths[0] - choiceWidth) / 2;
  drawText('NOSSA', choiceX, typeY, { size: 7 });
  choiceX += nossaWidth + labelGap + circleRadius;
  pdf.setDrawColor(51, 51, 51); pdf.setFillColor(51, 51, 51); pdf.setLineWidth(0.45);
  pdf.circle(choiceX, typeY - px(3), circleRadius, form.nfTipo === 'nossa' ? 'FD' : 'S');
  choiceX += circleRadius + choiceGap;
  drawText('SUA', choiceX, typeY, { size: 7 });
  choiceX += suaWidth + labelGap + circleRadius;
  pdf.circle(choiceX, typeY - px(3), circleRadius, form.nfTipo === 'sua' ? 'FD' : 'S');
  drawText(form.nfNumero, bodyX + nfWidths[0] + nfWidths[1] / 2, typeY, { size: 11.25, bold: true, color: blue, align: 'center' });
  const [emissaoAno = '', emissaoMes = '', emissaoDia = ''] = form.nfDataEmissao ? form.nfDataEmissao.split('-') : [];
  drawText(emissaoDia && emissaoMes && emissaoAno ? `${emissaoDia}/${emissaoMes}/${emissaoAno}` : '',
    bodyX + nfWidths[0] + nfWidths[1] + nfWidths[2] / 2, typeY, { size: 9, bold: true, color: blue, align: 'center' });
  y += nfHeaderHeight + nfRowHeight + px(8);

  const cartaIntro = 'Em face do que determina a legislaçao fiscal vigente, vimos pela presente comunicar-lhe que a Nota Fiscal em referência contém a (s) irregularidade (s) que abaixo apontamos, e que solicitamos as devidas providências.';
  setFont(7.125);
  const introLines = pdf.splitTextToSize(cartaIntro, bodyWidth);
  pdf.text(introLines, bodyX, y + px(9));
  y += introLines.length * px(14) + px(7);

  const codeHeaderHeight = px(18), codeRowHeight = px(17);
  const codeWidths = [bodyWidth * 0.05, bodyWidth * 0.20, bodyWidth * 0.05, bodyWidth * 0.20,
    bodyWidth * 0.05, bodyWidth * 0.20, bodyWidth * 0.05, bodyWidth * 0.20];
  const codeHeaders = ['Cód.', 'Especificações', 'Cód.', 'Especificações', 'Cód.', 'Especificações', 'Cód.', 'Especificações'];
  let codeX = bodyX;
  codeHeaders.forEach((label, index) => {
    drawBox(codeX, y, codeWidths[index], codeHeaderHeight, gray, [102, 102, 102]);
    drawText(label, codeX + (index % 2 ? px(4) : codeWidths[index] / 2), y + px(12),
      { size: 6.75, bold: true, align: index % 2 ? 'left' : 'center', maxWidth: codeWidths[index] - px(2) });
    codeX += codeWidths[index];
  });
  for (let row = 0; row < 12; row++) {
    const values = [COL1[row]?.c, COL1[row]?.l, COL2[row]?.c, COL2[row]?.l,
      COL3[row]?.c, COL3[row]?.l, row === 0 ? '999' : '', row === 0 ? 'Outras' : ''];
    codeX = bodyX;
    values.forEach((value, index) => {
      drawBox(codeX, y + codeHeaderHeight + row * codeRowHeight, codeWidths[index], codeRowHeight, null, [204, 204, 204]);
      drawText(value, codeX + (index % 2 ? px(3) : codeWidths[index] / 2), y + codeHeaderHeight + row * codeRowHeight + px(12),
        { size: 6.75, align: index % 2 ? 'left' : 'center', maxWidth: codeWidths[index] - px(2) });
      codeX += codeWidths[index];
    });
  }
  y += codeHeaderHeight + 12 * codeRowHeight + px(8);

  const retifHeaderHeight = px(29), retifRowHeight = px(17), retifCodeWidth = bodyWidth * 0.14;
  drawBox(bodyX, y, retifCodeWidth, retifHeaderHeight, gray, [102, 102, 102]);
  drawText('Códigos com', bodyX + retifCodeWidth / 2, y + px(11), { size: 6.75, bold: true, align: 'center' });
  drawText('Irregularidades', bodyX + retifCodeWidth / 2, y + px(22), { size: 6.75, bold: true, align: 'center' });
  drawBox(bodyX + retifCodeWidth, y, bodyWidth - retifCodeWidth, retifHeaderHeight, gray, [102, 102, 102]);
  drawText('Retificações a serem consideradas', bodyX + retifCodeWidth + px(4), y + px(18), { size: 6.75, bold: true });
  rows.forEach((row, index) => {
    const rowY = y + retifHeaderHeight + index * retifRowHeight;
    drawBox(bodyX, rowY, retifCodeWidth, retifRowHeight);
    drawBox(bodyX + retifCodeWidth, rowY, bodyWidth - retifCodeWidth, retifRowHeight);
    drawText(row.codigo, bodyX + retifCodeWidth / 2, rowY + px(12), {
      size: row.codigo || row.texto ? 7.875 : 7.125,
      bold: Boolean(row.codigo || row.texto),
      color: row.codigo || row.texto ? blue : black,
      align: 'center',
      maxWidth: retifCodeWidth - px(4),
    });
    drawText(row.texto, bodyX + retifCodeWidth + px(4), rowY + px(12), {
      size: row.codigo || row.texto ? 7.5 : 7.125,
      bold: Boolean(row.codigo || row.texto),
      color: row.codigo || row.texto ? blue : black,
      maxWidth: bodyWidth - retifCodeWidth - px(7),
    });
  });
  y += retifHeaderHeight + rows.length * retifRowHeight + px(10);

  const encerramento = 'Para evitar qualquer sanção fiscal, solicitamos acusarem o recebimento desta, na cópia que a acompanha, devendo a via de V.Sª ficar arquivada com a nota fiscal em questão.';
  setFont(7.125);
  const encerramentoLines = pdf.splitTextToSize(encerramento, bodyWidth);
  pdf.text(encerramentoLines, bodyX, y + px(9));
  y += encerramentoLines.length * px(14) + px(9);

  const sigHeight = assinatura ? fitImage(assinatura, px(200), px(38)).height : 0;
  const sigX = bodyX + bodyWidth - px(220);
  if (assinatura) {
    const sigSize = fitImage(assinatura, px(200), px(38));
    pdf.addImage(assinatura.data, 'PNG', sigX + (px(220) - sigSize.width) / 2, y, sigSize.width, sigSize.height);
  }
  const signatureLineY = y + (assinatura ? sigHeight : px(28));
  drawLine(sigX, signatureLineY, sigX + px(220), signatureLineY);
  drawText('Atenciosamente,', sigX + px(110), signatureLineY + px(14), { size: 7.5, align: 'center' });
  y = signatureLineY + px(24);

  const receiptGap = px(18), receiptWidth = (bodyWidth - receiptGap) / 2;
  const rightX = bodyX + receiptWidth + receiptGap;
  drawText('Acusamos recebimento da 1ª via.', bodyX, y + px(10), { size: 7.5 });
  drawText('LOCAL E DATA', bodyX, y + px(27), { size: 7.5, bold: true });
  drawLine(bodyX, y + px(43), bodyX + receiptWidth * 0.9, y + px(43));
  drawText('ASSINATURA', bodyX, y + px(62), { size: 7.5, bold: true });
  drawLine(bodyX, y + px(78), bodyX + receiptWidth * 0.9, y + px(78));

  drawText('R. Social', rightX, y + px(6), { size: 6.75, color: [85, 85, 85] });
  drawBox(rightX, y + px(9), receiptWidth, px(24));
  drawText(form.empresa || 'Razão Social', rightX + px(7), y + px(25), { size: 8.625, bold: true, maxWidth: receiptWidth - px(14) });
  drawText('Ender.', rightX, y + px(41), { size: 6.75, color: [85, 85, 85] });
  drawBox(rightX, y + px(44), receiptWidth, px(24));
  drawText(form.endereco, rightX + px(7), y + px(60), { size: 7.5, bold: true, color: blue, maxWidth: receiptWidth - px(14) });
  const companyDataY = y + px(87);
  drawText('CNPJ', rightX, companyDataY, { size: 7 });
  const cnpjBoxX = rightX + px(27), cnpjBoxWidth = px(118);
  drawBox(cnpjBoxX, companyDataY - px(11), cnpjBoxWidth, px(17));
  drawText(form.cnpj, cnpjBoxX + px(4), companyDataY, { size: 7.5, bold: true, maxWidth: cnpjBoxWidth - px(8) });
  const ieLabelX = cnpjBoxX + cnpjBoxWidth + px(10);
  setFont(7);
  const ieLabelWidth = pdf.getTextWidth('I.Estadual');
  drawText('I.Estadual', ieLabelX, companyDataY, { size: 7 });
  const ieBoxX = ieLabelX + ieLabelWidth + px(7);
  const ieBoxWidth = rightX + receiptWidth - ieBoxX;
  drawBox(ieBoxX, companyDataY - px(11), ieBoxWidth, px(17));
  drawText(form.ie, ieBoxX + px(4), companyDataY, { size: 7.5, bold: true, maxWidth: ieBoxWidth - px(8) });

  const finalHeight = Math.max(297, y + px(100));
  if (finalHeight > 297) pdf.internal.pageSize.setHeight(finalHeight);
  return pdf;
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
    {id:'default-ev',name:'ASSINATURA CLEANDERSON',dataUrl:rubricaUrl},
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

  // Mantém textos e tabelas vetoriais no PDF; somente as imagens são rasterizadas.
  const downloadCartaPdf = async () => {
    setPdfBusy(true);
    try {
      const pdf = await gerarCartaPdfVetorial(form);
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
   EXPORTS
   Editor/Organizar/Mesclar viraram três abas soltas na sidebar (15/09/2026,
   pedido explícito) — antes moravam dentro de UMA aba "Ferramentas de
   Edição", escolhidas por um cartão nela. Cada uma agora é só um wrapper
   fino (StellarHero + o componente da ferramenta), do jeitinho das outras
   abas do módulo (TabLeitorXML, TabAssinatura...). O endereço próprio de
   cada uma (pra favoritar e abrir direto) mora em rotaFerramenta.js — é o
   módulo (faturamento/index.jsx) que troca a URL a cada aba, não elas. ── */
export const TabPdfEditor = () => {
  const [hasDoc, setHasDoc] = useState(false);
  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {!hasDoc && <StellarHero compact eyebrow="Ferramentas de Edição" title="Editor de PDF"
        subtitle="Edite o texto existente do PDF, adicione textos, imagens e assinaturas." icon={HERO_ICON}/>}
      <PdfEditor onDoc={setHasDoc}/>
    </div>
  );
};

export const TabPdfOrganizar = () => {
  const [hasDoc, setHasDoc] = useState(false);
  return (
    <div style={{fontFamily:'var(--font-body)'}}>
      {!hasDoc && <StellarHero compact eyebrow="Ferramentas de Edição" title="Organizar PDF"
        subtitle="Mova e exclua páginas vendo cada uma antes de salvar." icon={HERO_ICON}/>}
      <PdfOrganizer onDoc={setHasDoc}/>
    </div>
  );
};

export const TabPdfMesclar = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas de Edição" title="Mesclar PDF"
      subtitle="Organize a ordem das páginas e junte tudo num único arquivo." icon={HERO_ICON}/>
    <PdfMerge/>
  </div>
);

export const TabCartaCorrecao = () => (
  <div style={{fontFamily:'var(--font-body)'}}>
    <StellarHero compact eyebrow="Ferramentas Estelares" title="Carta de Correção"
      subtitle="Preencha os campos — o documento é montado em tempo real." icon={HERO_ICON}/>
    <TabCarta/>
  </div>
);

