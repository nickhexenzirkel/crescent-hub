/* ── Observação por nota fiscal, lida do PDF ──────────────────────────────
   Recebe a planilha de Contas a Receber (Finanças), procura o PDF de cada nota
   numa pasta do OneDrive e devolve, por nota, a observação no formato
     "MANUTENCAO, FAT. 02/05 A 02/06/2026"
   A categoria e o período vêm do corpo da própria nota fiscal:
     "REEMBOLSO DE SERVICOS DE MANUT: R$ ..."   → MANUTENCAO
     "REEMBOLSO DE SERVICOS DE ABAST..."        → ABASTECIMENTO
     "PERIODO: 01/09/2026 a 15/09/2026 - SECRETARIA ..."  → período de faturamento

   Este arquivo só tem funções PURAS (sem React, sem pdf.js) para poder ser
   testado fora do navegador. A leitura do PDF e da pasta fica em
   observacoesNotasIO.js. */

// Texto sem acento, maiúsculo, com espaços colapsados — o PDF pode vir com
// quebras de linha e acentos soltos no meio do texto.
export const normalizarTexto = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

/**
 * Categoria. Duas redações no corpo da nota:
 *   2026:  "REEMBOLSO DE SERVICOS DE MANUT: R$ ..."
 *   2024:  "REEMBOLSO DE OPERACAO FINANCEIRA - PERIODO: ... - SEC. X ABASTECIMENTO: R$ ..."
 * null = não achou (ou apareceram as duas — ambíguo, melhor não chutar).
 */
export const extrairCategoria = (textoNorm) => {
  const trecho = textoNorm.match(/REEMBOLSO DE SERVICOS? DE ([A-Z]+)/);
  const palavra = trecho?.[1] || '';
  if (/^MANUT/.test(palavra)) return 'MANUTENCAO';
  if (/^ABAST/.test(palavra)) return 'ABASTECIMENTO';
  const rotuloM = /MANUTENCAO ?: ?R\$/.test(textoNorm) || /SERVICOS? DE MANUT/.test(textoNorm);
  const rotuloA = /ABASTECIMENTO ?: ?R\$/.test(textoNorm) || /SERVICOS? DE ABAST/.test(textoNorm);
  if (rotuloM && !rotuloA) return 'MANUTENCAO';
  if (rotuloA && !rotuloM) return 'ABASTECIMENTO';
  return null;
};

/**
 * Período de faturamento: "PERIODO: 01/09/2026 A 15/09/2026" ou, nas notas de
 * 2024, com o início SEM ano: "PERIODO: 16/06 A 23/06/2024" (usa o ano do fim).
 */
export const extrairPeriodo = (textoNorm) => {
  const m = textoNorm.match(
    /PERIODO:? ?(\d{2})\/(\d{2})(?:\/(\d{4}))? ?A ?(\d{2})\/(\d{2})\/(\d{4})/,
  );
  if (m)
    return {
      ini: { d: m[1], m: m[2], a: m[3] || m[6] },
      fim: { d: m[4], m: m[5], a: m[6] },
    };
  // Nota de UM dia só: "PERIODO: 30/12/2024 (AS 21H05)" — início = fim.
  const u = textoNorm.match(/PERIODO:? ?(\d{2})\/(\d{2})\/(\d{4})/);
  if (!u) return null;
  return {
    ini: { d: u[1], m: u[2], a: u[3] },
    fim: { d: u[1], m: u[2], a: u[3] },
  };
};

/** "MANUTENCAO, FAT. 02/05 A 02/06/2026" (sem ano no início se for o mesmo ano). */
export const formatarObservacao = (categoria, periodo) => {
  if (!categoria || !periodo) return '';
  const { ini, fim } = periodo;
  if (ini.d === fim.d && ini.m === fim.m && ini.a === fim.a)
    return `${categoria}, FAT. ${fim.d}/${fim.m}/${fim.a}`;
  const inicio =
    ini.a === fim.a ? `${ini.d}/${ini.m}` : `${ini.d}/${ini.m}/${ini.a}`;
  return `${categoria}, FAT. ${inicio} A ${fim.d}/${fim.m}/${fim.a}`;
};

/** O texto do PDF cita esse CNPJ (com ou sem pontuação)? */
export const textoTemCnpj = (texto, cnpj) => {
  const d = soDigitos(cnpj);
  if (d.length < 11) return false;
  return soDigitos(texto).includes(d);
};

/** O número da nota aparece no texto como número inteiro (com zeros à esquerda)? */
export const textoTemNumero = (textoNorm, numero) => {
  const n = String(numero).replace(/^0+/, '');
  if (!n) return false;
  return new RegExp(`(?<!\\d)0*${n}(?!\\d)`).test(textoNorm);
};

/**
 * Lê o corpo de UMA nota. `esperado` = { numero, cnpj } da linha da planilha:
 * o mesmo número existe em municípios diferentes, então o PDF só vale se citar
 * o CNPJ do cliente e o número da nota.
 * Retorna { ok, motivo, categoria, periodo, observacao }.
 */
export const lerNotaDoTexto = (texto, esperado) => {
  const norm = normalizarTexto(texto);
  if (norm.length < 40)
    return { ok: false, motivo: 'PDF sem texto (imagem escaneada)' };
  if (esperado?.cnpj && !textoTemCnpj(texto, esperado.cnpj))
    return { ok: false, motivo: 'PDF de outro cliente (CNPJ não confere)' };
  if (esperado?.numero && !textoTemNumero(norm, esperado.numero))
    return { ok: false, motivo: 'PDF de outra nota (número não confere)' };
  const categoria = extrairCategoria(norm);
  const periodo = extrairPeriodo(norm);
  if (!categoria)
    return { ok: false, motivo: 'Categoria não encontrada no corpo da nota' };
  if (!periodo)
    return { ok: false, motivo: 'Período não encontrado no corpo da nota' };
  return {
    ok: true,
    categoria,
    periodo,
    observacao: formatarObservacao(categoria, periodo),
  };
};

/* ── Planilha de Contas a Receber (Finanças) ───────────────────────────── */

const norm = (s) => normalizarTexto(s).replace(/[^A-Z0-9]/g, '');

/** Acha o cabeçalho e devolve as linhas { numero, cliente, cnpj, projeto, valor }. */
export const lerPlanilhaFinancas = (linhas) => {
  const idxHeader = linhas.findIndex((r) =>
    (r || []).some((c) => norm(c).startsWith('NOTAFISCAL')),
  );
  if (idxHeader < 0)
    throw new Error(
      'Não achei a coluna "Nota Fiscal / Cupom Fiscal" na planilha.',
    );
  const h = linhas[idxHeader].map(norm);
  const col = (...trechos) =>
    h.findIndex((c) => trechos.every((t) => c.includes(t)));
  const iNota = col('NOTAFISCAL');
  const iCnpj = col('CNPJ');
  const iCliente = col('NOMEFANTASIA');
  const iProjeto = col('PROJETO');
  const iValor = col('VALORARECEBER');
  const iObs = col('OBSERVACAO');
  const iEmissao = col('DATADEEMISSAO');
  const notas = [];
  for (let i = idxHeader + 1; i < linhas.length; i++) {
    const r = linhas[i] || [];
    const numero = String(r[iNota] ?? '').trim();
    if (!/^\d+$/.test(numero)) continue; // rodapé, total, linha em branco
    notas.push({
      numero,
      cliente: String(r[iCliente] ?? '').trim(),
      cnpj: String(r[iCnpj] ?? '').trim(),
      projeto: String(r[iProjeto] ?? '').trim(),
      valor: iValor >= 0 ? r[iValor] : '',
      emissao: iEmissao >= 0 ? r[iEmissao] : '',
      obsAtual: iObs >= 0 ? String(r[iObs] ?? '').trim() : '',
    });
  }
  return notas;
};

/* ── Índice dos PDFs da pasta ──────────────────────────────────────────── */

/** Números de nota que o NOME do arquivo sugere ("NF 21721 - ADM.pdf" → 21721). */
export const numerosDoNomeDeArquivo = (nome) => {
  const base = String(nome).replace(/\.pdf$/i, '');
  if (!/(^|[^A-Za-z])(NFES?|NFSE|NOTA|NF)(?![A-Za-z])/i.test(base)) return [];
  return [...base.matchAll(/(?<!\d)0*(\d{3,9})(?!\d)/g)].map((m) => m[1]);
};

/**
 * Monta o índice número → [{ nome, caminho, handle }] a partir da lista de
 * arquivos da pasta. `arquivos` = [{ nome, caminho, handle }].
 */
export const indexarPdfsPorNumero = (arquivos) => {
  const idx = new Map();
  for (const a of arquivos) {
    for (const n of numerosDoNomeDeArquivo(a.nome)) {
      const l = idx.get(n);
      if (l) l.push(a);
      else idx.set(n, [a]);
    }
  }
  return idx;
};

/* ── Relatório final ───────────────────────────────────────────────────── */

/**
 * Cruza as notas da planilha com os PDFs já lidos.
 * `pdfs` = [{ nome, caminho, texto }]. Cada nota só aceita um PDF que cite o
 * MESMO número e o MESMO CNPJ de cliente (o número repete entre municípios).
 * Devolve { linhas, resumo }; cada linha tem `situacao`:
 *   'lida' | 'sem-pdf' | 'outro-cliente' | 'sem-dados'
 */
export const montarRelatorio = (notas, pdfs) => {
  const idx = indexarPdfsPorNumero(pdfs);
  const linhas = [];
  const resumo = { total: notas.length, lidas: 0, semPdf: 0, outroCliente: 0, semDados: 0 };
  for (const n of notas) {
    const cands = idx.get(String(n.numero).replace(/^0+/, '')) ?? [];
    let achou = null;
    let motivo = '';
    let tipo = 'sem-pdf';
    for (const c of cands) {
      const r = lerNotaDoTexto(c.texto, { numero: n.numero, cnpj: n.cnpj });
      if (r.ok) {
        achou = { r, c };
        break;
      }
      motivo = r.motivo;
      tipo = /outro cliente/.test(r.motivo) ? 'outro-cliente' : 'sem-dados';
    }
    if (achou) {
      resumo.lidas++;
      linhas.push({
        ...n,
        observacao: achou.r.observacao,
        situacao: 'lida',
        detalhe: 'Lida do PDF',
        arquivo: achou.c.caminho,
      });
    } else {
      if (tipo === 'sem-pdf') resumo.semPdf++;
      else if (tipo === 'outro-cliente') resumo.outroCliente++;
      else resumo.semDados++;
      linhas.push({
        ...n,
        observacao: '',
        situacao: tipo,
        detalhe: tipo === 'sem-pdf' ? 'PDF não encontrado nos arquivos anexados' : motivo,
        arquivo: '',
      });
    }
  }
  return { linhas, resumo };
};
