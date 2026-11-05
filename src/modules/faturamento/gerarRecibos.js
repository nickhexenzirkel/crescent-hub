import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { lerNota, normalize, formatarReais, reaisPorExtenso } from './oficioEmissao';
import { formatarObservacao } from './observacoesNotas';

const CABECALHOS = {
  nota: ['NOTA', 'NF', 'NOTA FISCAL', 'NUMERO DA NOTA', 'NUMERO DA NOTA FISCAL', 'NUMERO DA NF'],
  secretaria: ['SETOR', 'SECRETARIA', 'SECRETARIA SETOR', 'SETOR SECRETARIA'],
  municipio: ['MUNICIPIO', 'CIDADE', 'MUNICIPIO CLIENTE'],
  bruto: ['VALOR BRUTO', 'VALOR FATURADO', 'VALOR DOCUMENTO'],
  liquido: ['VALOR LIQUIDO', 'VALOR LIQUIDO DA NFSE', 'VALOR LIQUIDO A RECEBER', 'VALOR C RET', 'VALOR COM RETENCAO'],
  periodoInicio: ['INICIO', 'DATA INICIAL', 'DATA INICIO'],
  periodoFim: ['FINAL', 'DATA FINAL', 'DATA FIM'],
  categoria: ['CATEGORIA', 'CATEGORIA FINANCEIRA'],
  observacao: ['OBSERVACAO', 'OBSERVACOES', 'DESCRICAO'],
  ordemServico: ['ORDEM DE SERVICO', 'OS', 'NUMERO DA OS'],
  documento: ['DOCUMENTO', 'RPS'],
  parcela: ['PARCELA'],
  cnpjPagador: ['CNPJ', 'CNPJ CLIENTE', 'CNPJ TOMADOR'],
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
  return texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function acharCabecalho(ws) {
  for (let linha = 1; linha <= Math.min(ws.rowCount || 20, 20); linha++) {
    const titulos = {};
    ws.getRow(linha).eachCell({ includeEmpty: false }, (cell, coluna) => {
      const titulo = chave(cell.value);
      if (titulo) titulos[titulo] = coluna;
    });
    const colunas = {};
    for (const [campo, aliases] of Object.entries(CABECALHOS)) {
      const titulo = aliases.find((alias) => titulos[alias]);
      if (titulo) colunas[campo] = titulos[titulo];
    }
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
    for (let numeroLinha = cabecalho.linha + 1; numeroLinha <= ws.rowCount; numeroLinha++) {
      const row = ws.getRow(numeroLinha);
      const numero = numeroNota(row.getCell(cabecalho.colunas.nota).value);
      if (!numero) continue;
      const valor = (campo) => cabecalho.colunas[campo]
        ? row.getCell(cabecalho.colunas[campo]).value
        : null;
      linhas.push({
        numero,
        municipio: textoCelula(valor('municipio')).replace(/^\s*\d+\s*-\s*/, '').replace(/^MUNIC[IÍ]PIO\s+DE\s+/i, '').trim(),
        secretaria: textoCelula(valor('secretaria')),
        valorBruto: valorNumerico(valor('bruto')),
        valorLiquido: valorNumerico(valor('liquido')),
        periodoInicio: textoCelula(valor('periodoInicio')),
        periodoFim: textoCelula(valor('periodoFim')),
        categoria: textoCelula(valor('categoria')),
        observacao: textoCelula(valor('observacao')),
        ordemServico: textoCelula(valor('ordemServico')),
        documento: textoCelula(valor('documento')),
        parcela: textoCelula(valor('parcela')),
        cnpjPagador: textoCelula(valor('cnpjPagador')),
        linhaPlanilha: numeroLinha,
      });
    }
    if (linhas.length) return linhas;
  }
  throw new Error('Não encontrei uma aba com coluna de nota fiscal e linhas preenchidas.');
}

const mesmoNumero = (a, b) => String(a || '').replace(/^0+/, '') === String(b || '').replace(/^0+/, '');

function obterNumeroArquivo(nome) {
  const correspondencia = /^(?:NF(?:S?E)?)[ _-]{0,4}(\d{3,9})/i.exec(nome.trim());
  return correspondencia ? correspondencia[1].replace(/^0+/, '') : null;
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
        valorLiquidoNfse: dados.valorLiquidoNfse,
        tipo: dados.tipo,
        periodo: dados.periodo,
        problemas: dados.problemas || [],
      });
    } catch (erro) {
      documentos.push({
        arquivo: arquivo.name,
        numero: obterNumeroArquivo(arquivo.name),
        status: 'erro',
        valorBruto: null,
        valorLiquidoNfse: null,
        tipo: null,
        periodo: null,
        problemas: [erro instanceof Error ? erro.message : String(erro)],
      });
    }
  }

  const ocorrencias = new Map();
  for (const linha of linhas) ocorrencias.set(linha.numero, (ocorrencias.get(linha.numero) || 0) + 1);
  const resultado = linhas.map((linha) => {
    const correspondencias = documentos.filter((doc) => doc.numero && mesmoNumero(doc.numero, linha.numero));
    const pdf = correspondencias.length === 1 ? correspondencias[0] : null;
    const divergencias = [];
    if (pdf && pdf.status !== 'erro') {
      if (linha.valorBruto != null && pdf.valorBruto != null && Math.abs(linha.valorBruto - pdf.valorBruto) > 0.02) {
        divergencias.push(`Valor bruto diferente: planilha R$ ${formatarReais(linha.valorBruto)}; NFS-e R$ ${formatarReais(pdf.valorBruto)}.`);
      }
      if (linha.valorLiquido != null && pdf.valorLiquidoNfse != null && Math.abs(linha.valorLiquido - pdf.valorLiquidoNfse) > 0.02) {
        divergencias.push(`Valor líquido diferente: planilha R$ ${formatarReais(linha.valorLiquido)}; NFS-e R$ ${formatarReais(pdf.valorLiquidoNfse)}.`);
      }
    }
    const problemas = [];
    if (ocorrencias.get(linha.numero) > 1) problemas.push('Número de nota repetido na planilha.');
    if (correspondencias.length > 1) problemas.push('Mais de um PDF corresponde a esta nota.');
    if (pdf?.status === 'erro' || pdf?.status === 'nao_e_nota') problemas.push(...pdf.problemas);
    return {
      ...linha,
      pdf: pdf?.arquivo || null,
      tipo: pdf?.tipo || '',
      periodoPdf: pdf?.periodo
        ? { ini: partesDataPeriodo(pdf.periodo[0]), fim: partesDataPeriodo(pdf.periodo[1]) }
        : null,
      valorLiquidoRecibo: pdf?.valorLiquidoNfse ?? linha.valorLiquido,
      origemValorRecibo: pdf?.valorLiquidoNfse != null ? 'NFS-e' : 'Planilha',
      statusPdf: !pdf ? 'sem_pdf' : correspondencias.length > 1 ? 'ambiguo' : pdf.status,
      divergencias,
      problemas,
    };
  });
  const pdfsSemCorrespondencia = documentos
    .filter((documento) => !linhas.some((linha) => documento.numero && mesmoNumero(documento.numero, linha.numero)))
    .map((documento) => documento.arquivo);
  return { linhas: resultado, pdfsSemCorrespondencia };
}

function quebrarTexto(font, texto, tamanho, largura) {
  const palavras = String(texto || '—').split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(candidata, tamanho) <= largura || !atual) atual = candidata;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function desenharTexto(page, font, texto, x, y, tamanho, largura, color, entrelinha = tamanho * 1.35) {
  const linhas = quebrarTexto(font, texto, tamanho, largura);
  linhas.forEach((linha, indice) => page.drawText(linha, {
    x, y: y - indice * entrelinha, size: tamanho, font, color,
  }));
  return y - linhas.length * entrelinha;
}

function desenharCampo(page, font, x, y, largura, rotulo, valor) {
  page.drawRectangle({
    x, y: y - 34, width: largura, height: 34,
    borderColor: rgb(0.75, 0.78, 0.76), borderWidth: 0.6,
  });
  page.drawText(rotulo, { x: x + 5, y: y - 12, size: 7, font: font.bold, color: rgb(0.25, 0.29, 0.26) });
  desenharTexto(page, font.normal, valor || '—', x + 5, y - 25, 8, largura - 10, rgb(0.12, 0.14, 0.12), 9);
}

function dataPorExtenso(data) {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}

function partesDataPeriodo(valor) {
  const match = /^(\d{1,2})[/. -](\d{1,2})(?:[/. -](\d{2,4}))?$/.exec(String(valor || '').trim());
  if (!match) return null;
  const ano = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : null;
  return {
    d: match[1].padStart(2, '0'),
    m: match[2].padStart(2, '0'),
    a: ano,
  };
}

function obterObservacaoRecibo(linha, periodoPdf) {
  const categoriaTexto = normalize(linha.categoria || linha.tipo || '');
  const categoria = categoriaTexto.startsWith('MANUT')
    ? 'MANUTENCAO'
    : categoriaTexto.startsWith('ABAST')
      ? 'ABASTECIMENTO'
      : '';
  const inicio = partesDataPeriodo(linha.periodoInicio) || periodoPdf?.ini;
  const fim = partesDataPeriodo(linha.periodoFim) || periodoPdf?.fim;

  const anoFim = fim?.a || inicio?.a;
  if (categoria && inicio && fim && anoFim) {
    const periodo = {
      ini: { ...inicio, a: inicio.a || anoFim },
      fim: { ...fim, a: anoFim },
    };
    return formatarObservacao(categoria, periodo);
  }

  const observacaoExistente = String(linha.observacao || '').trim();
  return /^(MANUTENCAO|ABASTECIMENTO), FAT\./i.test(observacaoExistente)
    ? observacaoExistente.toLocaleUpperCase('pt-BR')
    : '';
}

async function gerarPdfRecibo(linha, data, horario) {
  if (!linha.municipio) throw new Error(`Informe o município da nota ${linha.numero} na planilha.`);
  if (!Number.isFinite(linha.valorLiquidoRecibo)) throw new Error(`Informe o valor líquido da nota ${linha.numero} na planilha ou anexe a NFS-e.`);
  const observacao = obterObservacaoRecibo(linha, linha.periodoPdf);
  if (!observacao) {
    throw new Error(`Não consegui montar a observação no padrão "CATEGORIA, FAT. DD/MM A DD/MM/AAAA" para a nota ${linha.numero}. Confira a categoria e o período na planilha ou anexe o PDF da NFS-e.`);
  }
  const doc = await PDFDocument.create();
  doc.setTitle(`Recibo de Pagamento - NFS-e ${linha.numero}`);
  doc.setAuthor('7 SERV Gestão de Benefícios Ltda.');
  doc.setSubject('Recibo de pagamento para conferência e assinatura.');
  const font = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const page = doc.addPage([595.28, 841.89]);
  const ink = rgb(0.12, 0.14, 0.12);
  const muted = rgb(0.28, 0.31, 0.29);
  const green = rgb(110 / 255, 196 / 255, 0);
  const lightGreen = rgb(230 / 255, 255 / 255, 197 / 255);
  const white = rgb(1, 1, 1);
  const left = 31;
  const contentWidth = 533;
  const center = (value, y, size, selectedFont = font.normal, color = ink) => {
    page.drawText(value, {
      x: (595.28 - selectedFont.widthOfTextAtSize(value, size)) / 2,
      y, size, font: selectedFont, color,
    });
  };
  const valor = formatarReais(linha.valorLiquidoRecibo);
  const porExtenso = reaisPorExtenso(linha.valorLiquidoRecibo);
  const pagador = `MUNICÍPIO DE ${linha.municipio}`.toLocaleUpperCase('pt-BR');

  center('7 SERV GESTAO DE BENEFICIOS LTDA', 801, 12, font.bold);
  center('https://7serv.me/', 788, 8);
  center('CNPJ: 13.858.769/0001-97', 769, 8);
  center('Inscrição Municipal: 951862', 757, 8);
  center('AV WASHINGTON SOARES, 3663 - SALA 1416 - TORRE 2 - EDSON QUEIROZ', 740, 7);
  center('Fortaleza - CE - CEP: 60811-341', 729, 7);
  center('Telefone: (85) 992988851', 718, 7);
  center('Recibo de Pagamento', 682, 16, font.bold);

  const declaracao = `Declaro ter recebido de ${pagador}${linha.cnpjPagador ? ` CNPJ ${linha.cnpjPagador}` : ''} o valor de R$ ${valor} (${porExtenso}) referente a:`;
  desenharTexto(page, font.normal, declaracao, left, 650, 9, contentWidth, ink, 12);

  const colWidths = [150, 150, 150, 83];
  const colXs = [left, left + 150, left + 300, left + 450];
  const fields = [
    ['Nota Fiscal', linha.numero],
    ['Ordem de Serviço', linha.ordemServico],
    ['Documento', linha.documento],
    ['Parcela', linha.parcela],
  ];
  fields.forEach(([title, value], i) => desenharCampo(page, font, colXs[i], 626, colWidths[i], title, value));

  page.drawText('Categoria', { x: left, y: 574, size: 8, font: font.bold, color: muted });
  desenharTexto(page, font.normal, linha.categoria || 'Receita de Intermediação Financeira', left, 558, 9, contentWidth, ink, 11);
  page.drawText('Observação', { x: left, y: 534, size: 8, font: font.bold, color: muted });
  desenharTexto(page, font.normal, observacao, left, 518, 9, contentWidth, ink, 11);

  const tableX = left;
  const widths = [57, 82, 72, 60, 60, 202];
  const labels = ['Data', 'Valor Pago R$', 'Desconto R$', 'Juros R$', 'Multa R$', 'Observação'];
  const rowY = 452;
  const headerH = 17;
  let x = tableX;
  page.drawText('Relação de Pagamentos Reconhecidos', {
    x: tableX, y: 475, size: 11, font: font.bold, color: green,
  });
  page.drawRectangle({ x: tableX, y: rowY, width: contentWidth, height: headerH, color: green });
  labels.forEach((label, index) => {
    page.drawText(label, { x: x + 4, y: rowY + 5, size: 6.7, font: font.bold, color: white });
    x += widths[index];
  });
  const rowBottom = rowY - 12;
  page.drawRectangle({ x: tableX, y: rowBottom, width: contentWidth, height: 12, borderColor: rgb(0.78, 0.8, 0.78), borderWidth: 0.6 });
  const values = [data.toLocaleDateString('pt-BR'), valor, '0,00', '0,00', '0,00', `NFS-e nº ${linha.numero}`];
  x = tableX;
  values.forEach((value, index) => {
    desenharTexto(page, font.normal, value, x + 4, rowBottom + 6, 7, widths[index] - 8, ink, 8);
    x += widths[index];
  });
  const totalY = rowBottom - 13;
  page.drawRectangle({ x: tableX, y: totalY, width: contentWidth, height: 13, color: lightGreen, borderColor: rgb(0.78, 0.8, 0.78), borderWidth: 0.6 });
  const totals = ['Totais (1)', valor, '0,00', '0,00', '0,00', ''];
  x = tableX;
  totals.forEach((value, index) => {
    if (value) desenharTexto(page, font.bold, value, x + 4, totalY + 6, 7, widths[index] - 8, ink, 8);
    x += widths[index];
  });

  page.drawText('Por ser verdade, firmo o presente.', { x: left, y: 375, size: 9, font: font.normal, color: ink });
  page.drawText(`Fortaleza (CE), ${dataPorExtenso(data)}.`, { x: left, y: 346, size: 9, font: font.normal, color: ink });
  page.drawText('______________________________', { x: left, y: 304, size: 10, font: font.normal, color: ink });
  page.drawText('______________________________', { x: 286, y: 304, size: 10, font: font.normal, color: ink });
  page.drawText('Nome Legível', { x: left, y: 290, size: 8, font: font.normal, color: muted });
  page.drawText('Assinatura', { x: 286, y: 290, size: 8, font: font.normal, color: muted });
  page.drawText(`Gerado em ${data.toLocaleDateString('pt-BR')} às ${horario} por 7SERV`, {
    x: left, y: 43, size: 7, font: font.normal, color: muted,
  });
  page.drawText('Página 1 de 1', { x: 260, y: 31, size: 7, font: font.normal, color: muted });
  return doc.save();
}

export async function gerarPacoteRecibos(linhas) {
  if (!linhas.length) throw new Error('Não há notas para gerar recibos.');
  const zip = new JSZip();
  const agora = new Date();
  const nomesUsados = new Set();
  for (const linha of linhas) {
    const pdf = await gerarPdfRecibo(linha, agora, agora.toLocaleTimeString('pt-BR'));
    const base = `Recibo_7SERV_NF_${String(linha.numero).replace(/[\\/:*?"<>|]+/g, '-')}`;
    let nome = `${base}.pdf`;
    if (nomesUsados.has(nome)) nome = `${base}_linha_${linha.linhaPlanilha}.pdf`;
    nomesUsados.add(nome);
    zip.file(nome, pdf);
  }
  return zip.generateAsync({ type: 'blob' });
}
