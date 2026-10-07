/* ══════════════════════════════════════════════════════════════════════════
   LEITURA DE EMPENHO — lógica (porte da "Leitura de empenho" do Uniko Detetive)
   Lê Notas de Empenho em PDF e devolve, por arquivo: secretaria/unidade
   orçamentária, nº do empenho e valor empenhado. PDFs sem camada de texto
   (empenho digitalizado/fotografado) passam por OCR (Tesseract, idioma
   "por" servido em /tessdata). Gera também a planilha .xlsx.
   Porte de empenho.ts + empenho-leitura.ts + gerarPlanilhaEmpenhos (excel.ts).
══════════════════════════════════════════════════════════════════════════ */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { itemsParaTexto, normalize, parseMoedaBr } from './oficioEmissao';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ─── Leitura dos campos (texto já normalizado: sem acento, maiúsculo) ─── */
export const isNotaEmpenho = (texto) => normalize(texto).includes('NOTA DE EMPENHO');

/** O número também vem no nome do arquivo e, ao contrário do OCR, o nome não erra dígito. */
const numeroDoArquivo = (nome) => /(\d{5,10})/.exec(nome)?.[1] ?? null;
const numeroDoTexto = (norm) => /NOTA\s+DE\s+EMPENHO\s+(\d+)/.exec(norm)?.[1] ?? null;

/** "Unidade orçamentária........ 05 02. Fundo de Desenv.da Educ. Básica-FUNDEB" (o OCR às vezes lê o 1º ponto como vírgula). */
const unidadeOrcamentaria = (norm) => {
  const m = /UNIDADE\s+OR[CÇ]AMENT[AÁ]RIA[.,\s]+([^\n]+)/.exec(norm);
  const v = m?.[1]?.trim().replace(/\s+/g, ' ');
  return v || null;
};

/** "Func.programática 12 365 0017 2.030 Manutenção..." — descarta o código numérico; a descrição pode quebrar pra linha seguinte. */
const funcaoProgramatica = (norm) => {
  const m = /FUNC\.?\s*PROGRAMATICA\s+(?:[\d.]+\s+)+([A-Z][^\n]*)\n([^\n]+)/.exec(norm);
  return m ? `${m[1].trim()} ${m[2].trim()}`.replace(/\s+/g, ' ').trim() : null;
};

const secretariaDe = (norm) => {
  const partes = [unidadeOrcamentaria(norm), funcaoProgramatica(norm)].filter(Boolean);
  return partes.length ? partes.join('\n') : null;
};

/** Quadro "DEMONSTRATIVO DA DOTAÇÃO": Saldo anterior | Valor empenhado | Saldo disponível — o do meio. */
const valorEmpenhado = (norm) => {
  const m = /SALDO\s+ANTERIOR\s+VALOR\s+EMPENHADO[^\n]*\n\s*[\d.,]+\s+([\d.,]+)/.exec(norm);
  return m ? parseMoedaBr(m[1]) : null;
};

export const dadosDoEmpenho = (texto, nomeArquivo) => {
  const norm = normalize(texto);
  return {
    numero: numeroDoArquivo(nomeArquivo) ?? numeroDoTexto(norm),
    secretaria: secretariaDe(norm),
    valorEmpenhado: valorEmpenhado(norm),
  };
};

export const problemasDoEmpenho = (d) => {
  const p = [];
  if (!d.numero) p.push('Não achei o número do empenho.');
  if (!d.secretaria) p.push('Não achei a secretaria/unidade orçamentária.');
  if (d.valorEmpenhado === null) p.push('Não achei o valor empenhado.');
  return p;
};

/* ─── OCR (só quando a página não tem texto) ─── */
let workerOcr = null;
const obterWorkerOcr = async () => {
  if (!workerOcr) {
    const { createWorker } = await import('tesseract.js');
    // O idioma é servido do próprio site (/tessdata) — não depende de baixar nada de terceiros.
    workerOcr = await createWorker('por', 1, { langPath: '/tessdata', gzip: false });
  }
  return workerOcr;
};
/** Libera o Tesseract (chame ao terminar um lote). */
export const encerrarOcr = async () => {
  if (workerOcr) { const w = workerOcr; workerOcr = null; await w.terminate(); }
};

const ocrDaPagina = async (page) => {
  const viewport = page.getViewport({ scale: 3 }); // ~216 DPI: o bastante pro Tesseract ler o formulário
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const w = await obterWorkerOcr();
  const { data } = await w.recognize(canvas);
  return data.text;
};

/**
 * Lê uma Nota de Empenho (File). Devolve { arquivo, numero, secretaria, valorEmpenhado, status, problemas, ocr }.
 * status: 'lido' | 'incompleto' | 'nao_e_empenho'
 */
export const lerEmpenho = async (arquivo, { aoUsarOcr } = {}) => {
  const bytes = await arquivo.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    let texto = itemsParaTexto((await page.getTextContent()).items);
    let ocr = false;
    // Sem nada na camada de texto a página é imagem (empenho digitalizado/fotografado): vai pro OCR.
    if (texto.trim().length < 20) { aoUsarOcr?.(); texto = await ocrDaPagina(page); ocr = true; }

    const base = { arquivo: arquivo.name, ocr };
    if (!isNotaEmpenho(texto)) {
      return { ...base, numero: null, secretaria: null, valorEmpenhado: null, status: 'nao_e_empenho', problemas: ['O PDF não é uma Nota de Empenho.'] };
    }
    const d = dadosDoEmpenho(texto, arquivo.name);
    const problemas = problemasDoEmpenho(d);
    return { ...base, ...d, status: problemas.length ? 'incompleto' : 'lido', problemas };
  } finally { await doc.destroy(); }
};

/* ─── Planilha ─── */
const BORDA = Object.fromEntries(['top', 'left', 'bottom', 'right'].map((k) => [k, { style: 'thin', color: { argb: 'FFD9D9D9' } }]));

/** Gera o .xlsx dos empenhos (mesmo layout do Uniko Detetive) e devolve um Blob. */
export const gerarPlanilhaEmpenhos = async (linhas) => {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Uniko — Oficina Estelar';
  wb.created = new Date();
  const ws = wb.addWorksheet('Empenhos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'SECRETARIA / UNIDADE ORÇAMENTÁRIA', key: 'secretaria', width: 60 },
    { header: 'Nº DO EMPENHO', key: 'numero', width: 15 },
    { header: 'VALOR EMPENHADO (R$)', key: 'valor', width: 19 },
    { header: 'ARQUIVO', key: 'arquivo', width: 42 },
  ];
  const cab = ws.getRow(1);
  cab.height = 22;
  cab.eachCell((c) => {
    c.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = BORDA;
  });
  for (const l of linhas) {
    const naoE = l.status === 'nao_e_empenho';
    const valores = [l.secretaria, Number(l.numero) || l.numero, l.valorEmpenhado, l.arquivo];
    const row = ws.addRow(valores.map((v) => (v === null || v === undefined ? '' : v)));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = BORDA;
      cell.font = { name: 'Arial', size: 11 };
      cell.alignment = { horizontal: col === 1 || col === 4 ? 'left' : 'center', vertical: 'middle', wrapText: col === 1 };
      if (col === 3) cell.numFmt = '#,##0.00';
      // Campo que não deu pra ler num empenho de verdade = amarelo ("confira na mão").
      const vazio = valores[col - 1] === null || valores[col - 1] === undefined;
      if (vazio && !naoE) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
    });
  }
  ws.autoFilter = { from: 'A1', to: `D${linhas.length + 1}` };
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
