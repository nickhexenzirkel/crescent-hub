import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { lerNota, normalize, formatarReais } from './oficioEmissao';

const CABECALHOS = {
  nota: ['NOTA', 'NF', 'NOTA FISCAL', 'NUMERO DA NOTA', 'NUMERO DA NOTA FISCAL', 'NUMERO DA NF'],
  secretaria: ['SETOR', 'SECRETARIA', 'SECRETARIA SETOR', 'SETOR SECRETARIA'],
  municipio: ['MUNICIPIO', 'CIDADE', 'MUNICIPIO CLIENTE'],
  bruto: ['VALOR BRUTO', 'VALOR FATURADO', 'VALOR DOCUMENTO'],
  liquido: ['VALOR C RET', 'VALOR COM RETENCAO', 'VALOR LIQUIDO', 'VALOR LIQUIDO A RECEBER'],
  periodoInicio: ['INICIO', 'DATA INICIAL', 'DATA INICIO'],
  periodoFim: ['FINAL', 'DATA FINAL', 'DATA FIM'],
};

const chave = (valor) => normalize(textoCelula(valor))
  .replace(/[^A-Z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function textoCelula(valor) {
  if (valor == null) return '';
  if (valor instanceof Date) return valor.toLocaleDateString('pt-BR');
  if (typeof valor === 'object') {
    if ('text' in valor) return String(valor.text ?? '');
    if ('result' in valor) return textoCelula(valor.result);
    if (Array.isArray(valor.richText)) return valor.richText.map((parte) => parte.text || '').join('');
  }
  return String(valor).trim();
}

function valorNumerico(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const texto = textoCelula(valor).replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (!texto) return null;
  const numero = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function numeroNota(valor) {
  const texto = textoCelula(valor);
  if (typeof valor === 'number' && Number.isFinite(valor)) return String(Math.trunc(valor));
  const inteiro = /^\s*0*(\d+)(?:[.,]0+)?\s*$/.exec(texto);
  if (inteiro) return inteiro[1];
  const digitos = texto.replace(/\D/g, '');
  return digitos.replace(/^0+(?=\d)/, '');
}

function municipioLimpo(valor) {
  return textoCelula(valor)
    .replace(/^\s*\d+\s*-\s*/, '')
    .replace(/^MUNIC[IÍ]PIO\s+DE\s+/i, '')
    .trim();
}

function acharCabecalho(ws) {
  const limite = Math.min(ws.rowCount || 20, 20);
  for (let linha = 1; linha <= limite; linha++) {
    const colunas = {};
    ws.getRow(linha).eachCell({ includeEmpty: false }, (cell, coluna) => {
      const titulo = chave(cell.value);
      for (const [campo, aliases] of Object.entries(CABECALHOS)) {
        if (!colunas[campo] && aliases.includes(titulo)) colunas[campo] = coluna;
      }
    });
    if (colunas.nota) return { linha, colunas };
  }
  return null;
}

async function lerPlanilha(file) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  for (const ws of wb.worksheets) {
    const cabecalho = acharCabecalho(ws);
    if (!cabecalho) continue;

    const linhas = [];
    for (let n = cabecalho.linha + 1; n <= ws.rowCount; n++) {
      const row = ws.getRow(n);
      const numero = numeroNota(row.getCell(cabecalho.colunas.nota).value);
      if (!numero) continue;

      const valor = (campo) => cabecalho.colunas[campo]
        ? row.getCell(cabecalho.colunas[campo]).value
        : null;
      linhas.push({
        numero,
        secretaria: textoCelula(valor('secretaria')),
        municipio: municipioLimpo(valor('municipio')),
        valorBruto: valorNumerico(valor('bruto')),
        valorLiquido: valorNumerico(valor('liquido')),
        periodoInicio: textoCelula(valor('periodoInicio')),
        periodoFim: textoCelula(valor('periodoFim')),
        aba: ws.name,
        linhaPlanilha: n,
      });
    }

    if (linhas.length) return linhas;
  }

  throw new Error('Não encontrei uma aba com coluna de nota fiscal e linhas preenchidas.');
}

function mesmoNumero(a, b) {
  return String(a || '').replace(/^0+/, '') === String(b || '').replace(/^0+/, '');
}

function obterNumeroArquivo(nome) {
  const m = /^(?:NF(?:S?E)?)[ _-]{0,4}(\d{3,9})/i.exec(nome.trim());
  return m ? m[1].replace(/^0+/, '') : null;
}

function compararValores(linha, nota) {
  const divergencias = [];
  if (linha.valorBruto != null && nota.valorBruto != null &&
      Math.abs(linha.valorBruto - nota.valorBruto) > 0.02) {
    divergencias.push(`Valor bruto: planilha R$ ${formatarReais(linha.valorBruto)}; PDF R$ ${formatarReais(nota.valorBruto)}.`);
  }
  if (linha.valorLiquido != null && nota.valorLiquido != null &&
      Math.abs(linha.valorLiquido - nota.valorLiquido) > 0.02) {
    divergencias.push(`Valor líquido: planilha R$ ${formatarReais(linha.valorLiquido)}; PDF R$ ${formatarReais(nota.valorLiquido)}.`);
  }
  return divergencias;
}

export async function analisarLoteRecibos(planilha, arquivosPdf, aoProgredir = () => {}) {
  if (!planilha) throw new Error('Selecione a planilha de faturamento.');
  const linhas = await lerPlanilha(planilha);
  const documentos = [];

  for (let i = 0; i < arquivosPdf.length; i++) {
    const arquivo = arquivosPdf[i];
    aoProgredir(i + 1, arquivosPdf.length, arquivo.name);
    try {
      const dados = await lerNota(arquivo);
      documentos.push({
        arquivo: arquivo.name,
        numero: dados.numero || obterNumeroArquivo(arquivo.name),
        status: dados.status,
        valorBruto: dados.valorBruto,
        valorLiquido: dados.valorLiquido,
        secretaria: dados.secretaria || '',
        problemas: dados.problemas || [],
      });
    } catch (erro) {
      documentos.push({
        arquivo: arquivo.name,
        numero: obterNumeroArquivo(arquivo.name),
        status: 'erro',
        valorBruto: null,
        valorLiquido: null,
        secretaria: '',
        problemas: [erro instanceof Error ? erro.message : String(erro)],
      });
    }
  }

  const ocorrencias = new Map();
  for (const linha of linhas) ocorrencias.set(linha.numero, (ocorrencias.get(linha.numero) || 0) + 1);

  const resultado = linhas.map((linha) => {
    const correspondencias = documentos.filter((doc) =>
      doc.numero && mesmoNumero(doc.numero, linha.numero));
    const pdf = correspondencias.length === 1 ? correspondencias[0] : null;
    const divergencias = pdf && pdf.status !== 'erro'
      ? compararValores(linha, pdf)
      : [];
    const valoresComparaveis = pdf && (
      (linha.valorBruto != null && pdf.valorBruto != null) ||
      (linha.valorLiquido != null && pdf.valorLiquido != null)
    );
    const problemas = [];
    if (ocorrencias.get(linha.numero) > 1) problemas.push('Número de nota repetido na planilha.');
    if (correspondencias.length > 1) problemas.push('Mais de um PDF corresponde a esta nota.');
    if (pdf?.status === 'erro' || pdf?.status === 'nao_e_nota') {
      problemas.push(...pdf.problemas);
    }

    return {
      ...linha,
      pdf: pdf?.arquivo || null,
      pdfStatus: correspondencias.length > 1
        ? 'ambigua'
        : pdf?.status === 'ok' || pdf?.status === 'incompleto'
          ? divergencias.length ? 'divergente' : valoresComparaveis ? 'conferida' : 'nao_validada'
          : pdf ? 'nao_validada' : 'sem_pdf',
      divergencias,
      problemas,
    };
  });
  const pdfsSemCorrespondencia = documentos
    .filter((documento) => !linhas.some((linha) =>
      documento.numero && mesmoNumero(documento.numero, linha.numero)))
    .map((documento) => documento.arquivo);
  return { linhas: resultado, pdfsSemCorrespondencia };
}

function sanitizarNome(valor) {
  return String(valor || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function quebrarTexto(font, texto, tamanho, largura) {
  const palavras = String(texto || 'Não informado').split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(candidata, tamanho) <= largura || !atual) {
      atual = candidata;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function desenharCampo(page, font, titulo, valor, y) {
  const x = 54;
  const largura = 487;
  page.drawText(titulo, { x, y, size: 10, font: font.bold, color: rgb(0.35, 0.38, 0.43) });
  const linhas = quebrarTexto(font.normal, valor || 'Não informado', 12, largura);
  linhas.forEach((linha, i) => {
    page.drawText(linha, { x, y: y - 18 - i * 16, size: 12, font: font.normal, color: rgb(0.12, 0.14, 0.18) });
  });
  return y - 34 - Math.max(0, linhas.length - 1) * 16;
}

async function gerarPdfInterno(linha, dataGeracao) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Conferência interna - NF ${linha.numero}`);
  doc.setAuthor('Oficina Estelar - Uniko');
  doc.setSubject('Documento interno de conferência; não comprova pagamento.');
  const font = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const page = doc.addPage([595.28, 841.89]);
  const largura = 595.28;
  const margem = 40;
  page.drawRectangle({
    x: margem, y: 742, width: largura - margem * 2, height: 58,
    color: rgb(0.94, 0.95, 0.97),
  });
  page.drawText('DOCUMENTO INTERNO DE CONFERÊNCIA', {
    x: 54, y: 777, size: 16, font: font.bold, color: rgb(0.12, 0.18, 0.26),
  });
  page.drawText('NÃO OFICIAL — NÃO COMPROVA PAGAMENTO', {
    x: 54, y: 757, size: 11, font: font.bold, color: rgb(0.72, 0.16, 0.18),
  });
  page.drawText('Dados extraídos da planilha e da nota fiscal fornecida.', {
    x: 54, y: 714, size: 10, font: font.normal, color: rgb(0.35, 0.38, 0.43),
  });

  let y = 676;
  y = desenharCampo(page, font, 'NOTA FISCAL', linha.numero, y);
  y = desenharCampo(page, font, 'MUNICÍPIO', linha.municipio, y);
  y = desenharCampo(page, font, 'SECRETARIA / SETOR', linha.secretaria, y);
  y = desenharCampo(page, font, 'VALOR BRUTO NA PLANILHA', linha.valorBruto == null ? '' : `R$ ${formatarReais(linha.valorBruto)}`, y);
  y = desenharCampo(page, font, 'VALOR LÍQUIDO / COM RETENÇÃO NA PLANILHA', linha.valorLiquido == null ? '' : `R$ ${formatarReais(linha.valorLiquido)}`, y);
  y = desenharCampo(page, font, 'PERÍODO', [linha.periodoInicio, linha.periodoFim].filter(Boolean).join(' a '), y);
  y = desenharCampo(page, font, 'PDF DA NOTA FISCAL', linha.pdf || 'Não anexado; nenhum dado foi validado contra PDF.', y);
  y = desenharCampo(page, font, 'RESULTADO DA CONFERÊNCIA DO PDF', linha.divergencias.length
    ? linha.divergencias.join(' ')
    : linha.pdfStatus === 'conferida'
      ? 'Número da nota e valores comparáveis conferidos com o PDF anexado.'
      : 'Não foi possível validar os dados com um PDF único correspondente.', y);

  const aviso = 'Este documento foi gerado localmente para conferência. Não é recibo oficial, não confirma recebimento de valores e não substitui comprovante emitido pela Omie ou pela instituição financeira.';
  const avisoLinhas = quebrarTexto(font.bold, aviso, 10, largura - margem * 2 - 28);
  const avisoAltura = 18 + avisoLinhas.length * 14;
  const avisoY = Math.max(80, y - avisoAltura - 8);
  page.drawRectangle({
    x: margem, y: avisoY, width: largura - margem * 2, height: avisoAltura,
    color: rgb(1, 0.95, 0.88),
    borderColor: rgb(0.82, 0.54, 0.18),
    borderWidth: 1,
  });
  avisoLinhas.forEach((texto, i) => {
    page.drawText(texto, {
      x: margem + 14, y: avisoY + avisoAltura - 20 - i * 14,
      size: 10, font: font.bold, color: rgb(0.42, 0.25, 0.08),
    });
  });
  page.drawText(`Gerado em ${dataGeracao}`, {
    x: margem, y: 42, size: 9, font: font.normal, color: rgb(0.45, 0.47, 0.5),
  });
  return doc.save();
}

export async function gerarPacoteConferencia(linhas) {
  if (!linhas.length) throw new Error('Não há notas conferidas para gerar os documentos internos.');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const agora = new Date();
  const data = agora.toLocaleString('pt-BR');
  const nomesUsados = new Set();
  for (const linha of linhas) {
    const pdf = await gerarPdfInterno(linha, data);
    const base = `Conferencia_NF_${sanitizarNome(linha.numero)}`;
    let nome = `${base}.pdf`;
    if (nomesUsados.has(nome)) nome = `${base}_linha_${linha.linhaPlanilha}.pdf`;
    nomesUsados.add(nome);
    zip.file(nome, pdf);
  }
  return zip.generateAsync({ type: 'blob' });
}
