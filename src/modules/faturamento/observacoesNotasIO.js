/* ── Leitura de arquivos para as Observações de notas ─────────────────────
   Parte que mexe com arquivos: planilha (xlsx), ZIPs e PDFs. O núcleo que
   decide categoria/período está em observacoesNotas.js (funções puras).

   A biblioteca de PDF entra como parâmetro (`pdfjsLib`): no navegador vem do
   pdfjs-dist com o worker do Vite; nos testes em Node vem da build "legacy".
   Tudo roda no navegador — nenhum arquivo é enviado a servidor. */

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { lerPlanilhaFinancas, numerosDoNomeDeArquivo } from './observacoesNotas.js';

/** Maior linha/coluna com dado de verdade: `!ref` de planilhas do Excel às vezes
 *  declara milhares de colunas vazias e trava a leitura (ver analise.ts do portal). */
const rangeReal = (ws) => {
  let maxR = 0;
  let maxC = 0;
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    const c = XLSX.utils.decode_cell(k);
    if (c.r > maxR) maxR = c.r;
    if (c.c > maxC) maxC = c.c;
  }
  return { s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } };
};

/** Lê a planilha de Finanças (Contas a Receber) → notas { numero, cnpj, cliente… }. */
export const lerArquivoPlanilha = async (file) => {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: false,
    range: rangeReal(ws),
  });
  return lerPlanilhaFinancas(linhas);
};

/** Texto das duas primeiras páginas (a descrição da nota fica na primeira). */
export const textoDoPdf = async (pdfjsLib, bytes) => {
  const doc = await pdfjsLib.getDocument({ data: bytes, useSystemFonts: true, verbosity: 0 }).promise;
  try {
    let t = '';
    for (let p = 1; p <= Math.min(doc.numPages, 2); p++) {
      const pg = await doc.getPage(p);
      const c = await pg.getTextContent();
      t += c.items.map((i) => i.str).join(' ') + '\n';
    }
    return t;
  } finally {
    await doc.destroy();
  }
};

const nomeBase = (caminho) => String(caminho).split(/[\\/]/).pop();

/**
 * Lê os PDFs de notas dentro de ZIPs e PDFs soltos. Só abre os PDFs cujo nome
 * traz o número de uma nota que a planilha pede (os ZIPs do OneDrive trazem
 * centenas de relatórios e certidões que não interessam).
 *
 * `cache` (Map) guarda o que já foi lido — soltar mais um ZIP depois só
 * processa o que é novo. Devolve { novos, ignorados, erros }.
 */
export const lerArquivos = async (pdfjsLib, arquivos, numerosNecessarios, cache, onProgresso) => {
  const precisa = new Set([...numerosNecessarios].map((n) => String(n).replace(/^0+/, '')));
  const tarefas = [];
  const erros = [];
  let ignorados = 0;

  for (const arq of arquivos) {
    const nome = arq.name || 'arquivo';
    try {
      if (/\.zip$/i.test(nome)) {
        const zip = await JSZip.loadAsync(await arq.arrayBuffer());
        for (const e of Object.values(zip.files)) {
          if (e.dir || !/\.pdf$/i.test(e.name)) continue;
          const numeros = numerosDoNomeDeArquivo(nomeBase(e.name));
          if (!numeros.some((n) => precisa.has(n))) {
            ignorados++;
            continue;
          }
          const chave = `${nome}::${e.name}`;
          if (cache.has(chave)) continue;
          tarefas.push({ chave, nome: nomeBase(e.name), caminho: `${nome} › ${e.name}`, bytes: () => e.async('uint8array') });
        }
      } else if (/\.pdf$/i.test(nome)) {
        const numeros = numerosDoNomeDeArquivo(nome);
        if (!numeros.some((n) => precisa.has(n))) {
          ignorados++;
          continue;
        }
        const chave = `${nome}::${arq.size ?? ''}`;
        if (cache.has(chave)) continue;
        tarefas.push({ chave, nome, caminho: nome, bytes: async () => new Uint8Array(await arq.arrayBuffer()) });
      }
    } catch (e) {
      erros.push(`${nome}: ${e?.message || 'não foi possível abrir'}`);
    }
  }

  let feitos = 0;
  let prox = 0;
  const trabalhador = async () => {
    while (prox < tarefas.length) {
      const t = tarefas[prox++];
      try {
        const texto = await textoDoPdf(pdfjsLib, await t.bytes());
        cache.set(t.chave, { nome: t.nome, caminho: t.caminho, texto });
      } catch (e) {
        erros.push(`${t.nome}: ${e?.message || 'PDF ilegível'}`);
      }
      feitos++;
      onProgresso?.({ feitos, total: tarefas.length, arquivo: t.nome });
    }
  };
  onProgresso?.({ feitos: 0, total: tarefas.length, arquivo: '' });
  await Promise.all(Array.from({ length: Math.min(4, tarefas.length) }, trabalhador));
  return { novos: tarefas.length, ignorados, erros };
};
