import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { textoContemValor } from './valorPesquisa';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 40;
const EMAILS_POR_LOTE = 10;
let workerOcr;

async function obterWorkerOcr() {
  if (!workerOcr) {
    const { createWorker } = await import('tesseract.js');
    workerOcr = await createWorker('por', 1, { langPath: '/tessdata', gzip: false });
  }
  return workerOcr;
}

async function ocrPagina(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a leitura OCR do PDF.');
  await page.render({ canvasContext: context, viewport }).promise;
  const worker = await obterWorkerOcr();
  const { data } = await worker.recognize(canvas);
  return data.text || '';
}

async function pdfContemValor(blob, centavos, onOcr) {
  if (blob.size > MAX_PDF_BYTES) throw new Error('O PDF excede o limite de 25 MB para pesquisa.');
  const documento = await pdfjsLib.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    isEvalSupported: false,
  }).promise;
  try {
    const paginas = Math.min(documento.numPages, MAX_PDF_PAGES);
    for (let numero = 1; numero <= paginas; numero++) {
      const pagina = await documento.getPage(numero);
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items.map(item => item.str || '').join(' ');
      if (textoContemValor(texto, centavos)) return { encontrou: true, paginasLimitadas: false };
      if (texto.trim().length < 20) {
        onOcr();
        if (textoContemValor(await ocrPagina(pagina), centavos)) return { encontrou: true, paginasLimitadas: false };
      }
    }
    return { encontrou: false, paginasLimitadas: documento.numPages > MAX_PDF_PAGES };
  } finally {
    await documento.destroy();
  }
}

export async function pesquisarValorEmPdfs({
  consulta,
  pageToken = '',
  centavos,
  listarMensagens,
  obterAnexo,
  aoProgredir,
  continuar,
}) {
  const pagina = await listarMensagens(consulta, pageToken, true);
  const token = pagina.nextPageToken || '';
  let mensagensAnalisadas = 0;
  let pdfsAnalisados = 0;
  let ocrUsado = 0;
  let falhas = 0;
  let paginasLimitadas = 0;
  const encontradas = [];
  const mensagensComPdf = pagina.messages.filter(mensagem => (mensagem.attachments || []).some(anexo =>
    anexo.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(anexo.filename || ''),
  ));
  for (const mensagem of mensagensComPdf.slice(0, EMAILS_POR_LOTE)) {
    if (!continuar()) break;
    mensagensAnalisadas++;
    let encontrouNaMensagem = false;
    const anexosPdf = (mensagem.attachments || []).filter(anexo =>
      anexo.mimeType?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(anexo.filename || ''),
    );

    for (const anexo of anexosPdf) {
      if (!continuar()) break;
      try {
        if (anexo.size > MAX_PDF_BYTES) {
          paginasLimitadas++;
          aoProgredir({ mensagensAnalisadas, pdfsAnalisados, ocrUsado, falhas, paginasLimitadas });
          continue;
        }
        const { blob } = await obterAnexo(mensagem.id, anexo);
        pdfsAnalisados++;
        if (blob.size > MAX_PDF_BYTES) {
          paginasLimitadas++;
          continue;
        }
        const leitura = await pdfContemValor(blob, centavos, () => { ocrUsado++; });
        if (leitura.paginasLimitadas) paginasLimitadas++;
        if (leitura.encontrou) {
          encontrouNaMensagem = true;
          break;
        }
      } catch (error) {
        if (error.status === 429 || error.retryAfter) throw error;
        falhas++;
      }
      aoProgredir({ mensagensAnalisadas, pdfsAnalisados, ocrUsado, falhas, paginasLimitadas });
    }
    if (encontrouNaMensagem) encontradas.push(mensagem);
    aoProgredir({ mensagensAnalisadas, pdfsAnalisados, ocrUsado, falhas, paginasLimitadas });
  }

  return {
    messages: encontradas,
    nextPageToken: token,
    mensagensAnalisadas,
    pdfsAnalisados,
    ocrUsado,
    falhas,
    paginasLimitadas,
  };
}
