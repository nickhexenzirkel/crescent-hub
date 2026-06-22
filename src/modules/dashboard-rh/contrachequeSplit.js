/* ════════════════════════════════════════════════════════════════
   SPLIT AUTOMÁTICO DE CONTRACHEQUES
   Recebe um PDF com vários contracheques (até 2 por página, empilhados
   verticalmente) e devolve um PDF de UMA PÁGINA por colaborador,
   recortando apenas a região do contracheque daquela pessoa — para que
   nunca vaze o contracheque de outro funcionário no mesmo arquivo.

   Identificação: lê nome (matrícula + nome) e CPF de cada recibo.
   O corte é feito pela posição do cabeçalho "Recibo de Pagamento".
════════════════════════════════════════════════════════════════ */
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MES_RE = /(Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+de\s+(\d{4})/i;
const CPF_RE = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
/* item "000013 ALAN MATOS PAIXAO": matrícula (5–6 díg.) + nome no mesmo item */
const MATRIC_RE = /^\s*\d{5,6}\s+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú.'\s]{2,60})\s*$/;

/* normaliza para comparação tolerante (sem acento, maiúsculo, espaço único) */
export const normName = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const onlyDigits = (s) => (s || '').replace(/\D/g, '');

/* agrupa itens de texto em linhas pela coordenada y (origem inferior-esquerda) */
const buildLines = (items) => {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) {
      last.items.push(it); last.y = (last.y + it.y) / 2;
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  return lines.map(l => ({
    y: l.y,
    text: l.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(),
  }));
};

/* extrai nome / cpf / competência de um conjunto de itens (uma região) */
const extractInfo = (items) => {
  const lines = buildLines(items);
  const full = lines.map(l => l.text).join('  ');
  /* o nome vem no mesmo item de texto da matrícula */
  let name = '';
  for (const it of items) {
    const m = it.str.match(MATRIC_RE);
    if (m) { name = m[1].replace(/\s+/g, ' ').trim(); break; }
  }
  const cpf = (full.match(CPF_RE) || [''])[0];
  let competencia = '';
  const mm = full.match(MES_RE);
  if (mm) {
    const mes = MESES.find(x => normName(x) === normName(mm[1])) || mm[1];
    competencia = `${mes}/${mm[2]}`;
  }
  return { name, cpf, competencia };
};

/* ─── Principal ─── */
export async function splitContrachequesPDF(file) {
  const buf = await file.arrayBuffer();
  const srcBytes = new Uint8Array(buf);

  const doc = await pdfjsLib.getDocument({ data: srcBytes.slice() }).promise;
  const pdfDoc = await PDFDocument.load(srcBytes);

  const slips = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const pageH = vp.height;
    const pageW = vp.width;
    const tc = await page.getTextContent();
    const items = tc.items
      .filter(it => it.str && it.str.trim())
      .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));

    /* posições (y) dos cabeçalhos "Recibo" — uma por contracheque */
    const heads = [];
    for (const it of items) {
      if (!/Recibo/i.test(it.str)) continue;
      if (heads.some(h => Math.abs(h - it.y) <= 5)) continue;
      heads.push(it.y);
    }
    heads.sort((a, b) => b - a); // de cima (maior y) para baixo

    if (heads.length === 0) continue;

    const GAP = 18; // folga acima do cabeçalho ao cortar
    for (let i = 0; i < heads.length; i++) {
      const top    = i === 0 ? pageH : Math.min(pageH, heads[i] + GAP);
      const bottom = i === heads.length - 1 ? 0 : Math.min(pageH, heads[i + 1] + GAP);
      const regionItems = items.filter(it => it.y > bottom + 0.5 && it.y <= top + 0.5);
      const info = extractInfo(regionItems);

      /* recorta a região da página num PDF de 1 página */
      const out = await PDFDocument.create();
      const [embedded] = await out.embedPages(
        [pdfDoc.getPage(p - 1)],
        [{ left: 0, bottom, right: pageW, top }],
      );
      const np = out.addPage([pageW, top - bottom]);
      np.drawPage(embedded, { x: 0, y: 0, width: pageW, height: top - bottom });
      const bytes = await out.save();

      slips.push({
        page: p,
        ...info,
        bytes,
        previewText: buildLines(regionItems).map(l => l.text).join('\n'),
      });
    }
  }
  await doc.destroy();
  return slips;
}
