/* ══════════════════════════════════════════════════════════════════════════
   OFÍCIO DE EMISSÃO — lógica (leitura da NFS-e + geração dos PDFs)
   Porte, pro navegador, da "Solicitação de Pagamento" do app Uniko Detetive
   (Electron). Da nota saem só três coisas: o NÚMERO da NFS-e, o VALOR BRUTO
   (reembolso ± desconto do cliente) e o PERÍODO faturado. Dois modelos:

     • eusebio — o ofício atual do Uniko Detetive (papel timbrado 7SERV,
                 rúbrica, texto com contrato e objeto);
     • piaui   — "Requerimento de Pagamento" (Juazeiro do Piauí), reproduzido do
                 .docx de modelo: mesmas coordenadas, cores e corpos de fonte.

   Medidas em pontos, origem no canto inferior esquerdo (convenção do pdf-lib).
   Fontes: o app Electron usava as do Windows (Times, Calibri, Arial); no
   navegador não há fonte do sistema, então vão as 14 padrão do PDF com
   métricas equivalentes (Times = Times New Roman, Helvetica = Arial) e a
   Open Sans Bold, que viaja junto (só pro "BENEFÍCIOS" do cabeçalho).
══════════════════════════════════════════════════════════════════════════ */
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import logoUrl from '../../assets/oficio-logo.png';
import rubricaUrl from '../../assets/assinatura-cleanderson.png';
import openSansUrl from '../../assets/OpenSans-Bold.ttf?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* Quem assina os dois modelos (a rúbrica é a mesma da Assinatura Automática). */
export const SIGNATARIO = { nome: 'Cleanderson Pereira Batista', cpf: '605.487.433-04' };

/* ─── Texto ─── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const REAIS = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatarReais = (n) => REAIS.format(n);

export const normalize = (s) => (s ? s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toUpperCase() : '');

/* ═══ Valor por extenso (porte de extenso.ts) ═══ */
const UNIDADES = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const DEZENAS = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const CENTENAS = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
const ESCALAS = [['',''],['mil','mil'],['milhão','milhões'],['bilhão','bilhões'],['trilhão','trilhões']];

const grupo = (n) => {
  if (n === 100) return 'cem';
  const partes = [];
  const c = Math.floor(n / 100), resto = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (resto < 20) { if (resto) partes.push(UNIDADES[resto]); }
  else { const d = Math.floor(resto / 10), u = resto % 10; partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]); }
  return partes.join(' e ');
};

export const inteiroPorExtenso = (valor) => {
  if (valor === 0) return 'zero';
  const grupos = [];
  let resto = Math.trunc(valor), escala = 0;
  while (resto > 0) { grupos.unshift({ n: resto % 1000, escala }); resto = Math.floor(resto / 1000); escala++; }
  const partes = grupos.filter((g) => g.n !== 0).map((g) => {
    const [singular, plural] = ESCALAS[g.escala] || ['', ''];
    if (!singular) return grupo(g.n);
    const nome = g.n === 1 ? singular : plural;
    return g.escala === 1 && g.n === 1 ? nome : `${grupo(g.n)} ${nome}`;
  });
  if (partes.length === 1) return partes[0];
  const ultimo = grupos.filter((g) => g.n !== 0).at(-1);
  const sep = ultimo.escala === 0 && (ultimo.n < 100 || ultimo.n % 100 === 0) ? ' e ' : ', ';
  return partes.slice(0, -1).join(', ') + sep + partes.at(-1);
};

/** "Trinta e seis mil, quatrocentos e trinta e dois reais e setenta e cinco centavos" */
export const reaisPorExtenso = (valor) => {
  const total = Math.round(Math.abs(valor) * 100);
  const inteiros = Math.floor(total / 100), centavos = total % 100;
  const partes = [];
  if (inteiros > 0) {
    const prep = inteiros >= 1_000_000 && inteiros % 1_000_000 === 0 ? 'de ' : '';
    partes.push(`${inteiroPorExtenso(inteiros)} ${prep}${inteiros === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) partes.push('zero reais');
  const t = partes.join(' e ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* ═══ Leitura da NFS-e (porte de parsing.ts + faturamento.ts, só o que o ofício usa) ═══ */
export const parseMoedaBr = (s) => {
  if (!s) return null;
  const n = Number(s.trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const parseDataBr = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
};

const isNotaFiscalPdf = (texto) => normalize(texto).includes('NFS-E');

const extractNfNumber = (text) => {
  let m = /NUMERO\s+DA\s+NFS-E[\s\S]{0,220}?(\d{3,9})\s+\d{2}\/\d{2}\/\d{4}/.exec(normalize(text));
  if (m) return m[1];
  m = /ELETR[ÔO]NICA\s*-\s*NFS-e\s+(\d{3,8})/i.exec(text);
  if (m) return m[1];
  m = /N[uú]mero\s+da\s*\n?\s*NFS-e\s*\n?\s*(\d{3,8})/i.exec(text);
  return m ? m[1] : null;
};

const extractPeriod = (text) => {
  const m = /PERIODO\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*A\s*(\d{2}\/\d{2}\/\d{4})/.exec(normalize(text));
  return m ? [m[1], m[2]] : null;
};
const periodoAbreviado = (norm) => {
  const m = /PERIODO\s*:?\s*(\d{2}\/\d{2})\s*A\s*(\d{2}\/\d{2})\/(\d{4})/.exec(norm);
  return m ? [`${m[1]}/${m[3]}`, `${m[2]}/${m[3]}`] : null;
};
const extractPeriodFallback = (text) => {
  const m = /Compet[êe]ncia\s+(\d{2})\/(\d{4})/i.exec(text);
  if (!m) return null;
  const mes = Number(m[1]), ano = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  const ultimo = new Date(ano, mes, 0).getDate();
  const mm = String(mes).padStart(2, '0');
  return [`01/${mm}/${ano}`, `${String(ultimo).padStart(2, '0')}/${mm}/${ano}`];
};

/** MANUTENÇÃO / ABASTECIMENTO — mesmo critério do Uniko Detetive. */
const extractTipo = (text, filename = '') => {
  const norm = normalize(text);
  const m = /REEMBOLSO\s+DE\s+SERVICOS\s+DE\s+(MANUT|ABAST)\w*/.exec(norm);
  if (m) return m[1] === 'MANUT' ? 'MANUTENÇÃO' : 'ABASTECIMENTO';
  const f = /TOTAL\s+DA\s+FATURA\s+DE\s+CONSUMO\s+DE\s+(COMBUSTIVEIS|SERVICOS\s+DE\s+MANUT\w*)/.exec(norm);
  if (f) return f[1].startsWith('COMBUSTIVEIS') ? 'ABASTECIMENTO' : 'MANUTENÇÃO';
  const fb = norm + ' ' + normalize(filename);
  const nM = (fb.match(/MANUTENCAO/g) || []).length, nA = (fb.match(/ABASTECIMENTO/g) || []).length;
  if (nM && !nA) return 'MANUTENÇÃO';
  if (nA && !nM) return 'ABASTECIMENTO';
  if (nM && nA) return nM >= nA ? 'MANUTENÇÃO' : 'ABASTECIMENTO';
  return null;
};

/* IR retido: só serve de confirmação pra dizer que "sem linha de desconto" é zero. */
const ALIQUOTAS = { peca: [1.2, 5.85], servico: [4.8, 9.45], abast: [0.24, 1.24] };
const ORDEM = ['peca', 'servico', 'abast'];
const extrairIr = (norm) => {
  const linhas = [...norm.matchAll(/NAO OPT(?:ANTE)?\.?\s+DO SIMPLES NACIONAL\s+([\d,]+)\s*%\s*=\s*R\$\s*([\d.,]+)/g)]
    .map((m) => ({ aliquota: parseMoedaBr(m[1]), valor: parseMoedaBr(m[2]) }));
  const dispensado = /DISPENSADOS DA RETENCAO DO IMPOSTO/.test(norm);
  if (!linhas.length) return dispensado ? 0 : null;
  const out = { peca: null, servico: null, abast: null };
  const sem = [];
  linhas.forEach((l, i) => {
    const nat = ORDEM.find((k) => l.aliquota !== null && ALIQUOTAS[k].includes(l.aliquota));
    if (nat && out[nat] === null) out[nat] = l.valor; else sem.push({ i, valor: l.valor });
  });
  if (linhas.length === ORDEM.length) for (const { i, valor } of sem) { const nat = ORDEM[i]; if (nat && out[nat] === null) out[nat] = valor; }
  for (const k of ORDEM) if (out[k] === null) out[k] = 0;
  return out.peca + out.servico + out.abast;
};

const TOTAL = /REEMBOLSO\s+DE\s+SERVICOS\s+DE|TOTAL\s+DA\s+FATURA\s+DE\s+CONSUMO/;
const DATA = /\d{2}\/\d{2}(?:\/\d{4})?/;

const extrairDesconto = (norm, reembolso, somaIr, liquido) => {
  const mDesc = /DESCONTO\s+DO\s+CLIENTE\s*:?\s*(-?[\d,]+)\s*%\s*\(\s*R\$\s*([\d.,]+)\s*\)/.exec(norm);
  if (mDesc) {
    const pct = parseMoedaBr(mDesc[1]), valor = parseMoedaBr(mDesc[2]);
    return valor === null ? null : (pct !== null && pct < 0 ? -1 : 1) * valor;
  }
  const mTaxa = /(?:DESCONTO\s+)?TAXA\s+ADMINISTRATIVA\s*:?\s*(-?)\s*R\$\s*([\d.,]+)/.exec(norm);
  if (mTaxa) { const v = parseMoedaBr(mTaxa[2]); if (v !== null) return (mTaxa[1] === '-' ? -1 : 1) * v; }
  if (reembolso !== null && somaIr !== null && liquido !== null && Math.abs(reembolso - somaIr - liquido) < 0.02) return 0;
  return null;
};

/** Reconstrói as quebras de linha a partir do Y de cada fragmento (pdf.js entrega pedaços soltos). */
const itemsParaTexto = (items) => {
  let out = '', lastY = null;
  for (const it of items) {
    const y = it.transform?.[5];
    if (lastY !== null && typeof y === 'number' && Math.abs(y - lastY) > 2) out += '\n';
    out += it.str ?? '';
    if (it.hasEOL) { out += '\n'; lastY = null; } else if (typeof y === 'number') lastY = y;
  }
  return out;
};

/** O que a nota não trouxe e o modelo escolhido precisa (lista vazia = pode gerar). */
export const faltaNoModelo = (nota, modelo) => {
  const f = [];
  if (modelo === 'piaui') {
    if (nota.valorLiquido == null) f.push('Não achei o VALOR LÍQUIDO A RECEBER DO CLIENTE na nota.');
    if (!nota.periodo) f.push('Não achei o período faturado.');
  } else {
    if (nota.valorBruto == null) f.push('Não achei o valor bruto na discriminação.');
    if (!nota.mesReferencia) f.push('Não achei o período faturado, então não sei o mês.');
  }
  return f;
};

/** "SECRETARIA MUNICIPAL DE SAUDE - ..." → o que vem depois do "DE" (o modelo já traz "À SECRETARIA MUNICIPAL DE"). */
const limparSecretaria = (s) => {
  if (!s) return '';
  let t = s.replace(/\s+/g, ' ').trim().replace(/[-–\s]+$/, '');
  t = t.replace(/^(SECRETARIA\s+MUNICIPAL\s+DE|SECRETARIA\s+DE|SEC\.?\s*MUN\.?\s*DE)\s+/i, '');
  return t.trim();
};

/**
 * Lê uma NFS-e (File/ArrayBuffer) e devolve o que o ofício precisa.
 * status: 'ok' | 'incompleto' | 'nao_e_nota'
 */
export const lerNota = async (arquivo) => {
  const bytes = arquivo instanceof ArrayBuffer ? arquivo : await arquivo.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const texto = itemsParaTexto((await page.getTextContent()).items);
    const nome = arquivo.name || '';
    if (!isNotaFiscalPdf(texto)) return { status: 'nao_e_nota', problemas: ['O PDF não é uma NFS-e.'] };

    const norm = normalize(texto);
    const periodo = extractPeriod(texto) ?? periodoAbreviado(norm) ?? extractPeriodFallback(texto);
    const numero = extractNfNumber(texto);

    let secretaria = null;
    const mSec = new RegExp(`PERIODO\\s*:?\\s*${DATA.source}\\s*A\\s*${DATA.source}\\s*-?\\s*([\\s\\S]*?)(?:${TOTAL.source})`).exec(norm);
    if (mSec) { const l = mSec[1].replace(/\s+/g, ' ').trim().replace(/^-\s*/, ''); if (l) secretaria = l; }

    const mReemb = new RegExp(`(?:${TOTAL.source})[^:]*:?\\s*R\\$\\s*([\\d.,]+)`).exec(norm);
    const reembolso = mReemb ? parseMoedaBr(mReemb[1]) : null;
    const mLiq = /VALOR\s+LIQUIDO\s+A\s+RECEBER\s+DO\s+CLIENTE\s*:?\s*R\$\s*([\d.,]+)/.exec(norm);
    const liquido = mLiq ? parseMoedaBr(mLiq[1]) : null;
    const desconto = extrairDesconto(norm, reembolso, extrairIr(norm), liquido);
    const valorBruto = reembolso === null ? null : Math.round((reembolso + (desconto ?? 0)) * 100) / 100;

    const ini = parseDataBr(periodo?.[0]);
    const mesReferencia = ini ? `${MESES[ini.getMonth()]} de ${ini.getFullYear()}` : null;

    // O que falta além do número depende do modelo (ver `faltaNoModelo`): o Eusébio usa o VALOR BRUTO e
    // o mês; o Juazeiro do Piauí usa o VALOR LÍQUIDO A RECEBER DO CLIENTE e o período.
    const problemas = numero ? [] : ['Não achei o número da NFS-e no PDF.'];

    return {
      status: problemas.length ? 'incompleto' : 'ok', problemas,
      numero, periodo, mesReferencia, valorBruto, valorLiquido: liquido,
      tipo: extractTipo(texto, nome),
      secretaria: limparSecretaria(secretaria),
    };
  } finally { await doc.destroy(); }
};

/* ═══ Geração dos PDFs ═══ */
const cacheBin = {};
const baixar = async (url) => (cacheBin[url] ??= fetch(url).then((r) => r.arrayBuffer()));

const PRETO = rgb(0, 0, 0), BRANCO = rgb(1, 1, 1);

/**
 * Largura SEM kerning. O pdf-lib mede com os pares de kerning da fonte (ex.: "TÃ"), mas o drawText
 * desenha sem eles — medir com o kerning deixa as palavras mais largas na página do que no cálculo
 * (espaços colados, ")" encostando na letra). Somar letra por letra bate com o que é desenhado.
 */
const larg = (font, texto, size) => { let w = 0; for (const ch of texto) w += font.widthOfTextAtSize(ch, size); return w; };

/** Troca caracteres que a fonte padrão do PDF não codifica (WinAnsi) por "?", em vez de estourar. */
const seguro = (font, texto) => {
  const set = (font.__set ??= new Set(font.getCharacterSet()));
  return [...texto].map((ch) => (set.has(ch.codePointAt(0)) ? ch : ch === ' ' ? ' ' : '?')).join('');
};

/** Tokeniza segmentos [{t, f, c}] em palavras (uma palavra pode cruzar segmentos: ")" + ","). */
const palavrasDe = (segs, size) => {
  const palavras = [];
  let atual = null;
  for (const s of segs) {
    for (const parte of s.t.split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) { if (atual) { palavras.push(atual); atual = null; } continue; }
      const t = seguro(s.f, parte);
      atual ??= { partes: [], w: 0 };
      atual.partes.push({ t, f: s.f, c: s.c });
      atual.w += larg(s.f, t, size);
    }
  }
  if (atual) palavras.push(atual);
  return palavras;
};

/** O Word comprime os espaços antes de passar a palavra pra linha seguinte — sem isso as quebras divergem do modelo. */
const COMPRESSAO_MINIMA = 0.75;

/**
 * Parágrafo justificado. `y` é a linha de base da 1ª linha (coord. pdf-lib).
 * `indente` afasta só a 1ª linha. Devolve a linha de base da última linha.
 */
const paragrafo = (page, segs, { x, y, largura, entrelinha, size, indente = 0, espaco, justificar = true }) => {
  const palavras = palavrasDe(segs, size);
  const esp = espaco ?? segs[0].f.widthOfTextAtSize(' ', size);
  const linhas = [];
  let cur = [], soma = 0;
  const larguraDaLinha = () => largura - (linhas.length === 0 ? indente : 0);
  const cabe = (s, n) => (n < 2 ? s <= larguraDaLinha() : (larguraDaLinha() - s) / (n - 1) >= esp * COMPRESSAO_MINIMA);
  for (const p of palavras) {
    if (cur.length && !cabe(soma + p.w, cur.length + 1)) { linhas.push({ palavras: cur, soma, larg: larguraDaLinha() }); cur = [p]; soma = p.w; }
    else { cur.push(p); soma += p.w; }
  }
  if (cur.length) linhas.push({ palavras: cur, soma, larg: larguraDaLinha() });

  linhas.forEach((ln, i) => {
    const ultima = i === linhas.length - 1;
    const gap = justificar && !ultima && ln.palavras.length > 1 ? (ln.larg - ln.soma) / (ln.palavras.length - 1) : esp;
    let px = x + (i === 0 ? indente : 0);
    const py = y - i * entrelinha;
    for (const p of ln.palavras) {
      for (const parte of p.partes) {
        page.drawText(parte.t, { x: px, y: py, size, font: parte.f, color: parte.c });
        px += larg(parte.f, parte.t, size);
      }
      px += gap;
    }
  });
  return y - (linhas.length - 1) * entrelinha;
};

/** Texto numa linha só, comprimido horizontalmente ("escalar texto" do Word) — escala 1 = normal. */
const linhaEscalada = (page, texto, x, y, escala, font, size, cor = PRETO) => {
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(escala, 0, 0, 1, 0, 0));
  page.drawText(seguro(font, texto), { x: x / escala, y, size, font, color: cor });
  page.pushOperators(popGraphicsState());
};

/** Escreve a linha com a largura EXATA `alvo` (escala horizontal sobre a fonte de reserva). */
const linhaAjustada = (page, texto, x, y, alvo, font, size, cor) => {
  const t = seguro(font, texto);
  const natural = larg(font, t, size);
  linhaEscalada(page, t, x, y, alvo / natural, font, size, cor);
};

const abrirDoc = async (titulo) => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(titulo);
  doc.setAuthor('7SERV GESTÃO DE BENEFÍCIOS LTDA');
  doc.setCreator('Uniko — Oficina Estelar');
  doc.setProducer('Uniko — Oficina Estelar');
  const f = {
    times: await doc.embedFont(StandardFonts.TimesRoman),
    helv: await doc.embedFont(StandardFonts.Helvetica),
    helvB: await doc.embedFont(StandardFonts.HelveticaBold),
    openSans: await doc.embedFont(await baixar(openSansUrl), { subset: true }),
  };
  const logo = await doc.embedPng(await baixar(logoUrl));
  return { doc, f, logo };
};

/* ─── Modelo EUSÉBIO (ofício atual do Uniko Detetive) ─── */
const AZUL = rgb(0x13 / 255, 0x47 / 255, 0x5b / 255);
const VERDE = rgb(0x07 / 255, 0x85 / 255, 0x6a / 255);

export const gerarEusebio = async ({ mesReferencia, numeroNota, valorBruto, contrato, objeto }) => {
  const { doc, f, logo } = await abrirDoc(`Ofício - Solicitação de pagamento - NF ${numeroNota}`);
  const rubrica = await doc.embedPng(await baixar(rubricaUrl));
  const p = doc.addPage([595.4, 841.8]);
  const CORPO = { x: 36, largura: 523.6, primeiraLinha: 528.92, entrelinha: 20.7, size: 12 };

  // Marca d'água, cabeçalho (faixa azul + quadrado verde + logo) e rodapé.
  p.drawImage(logo, { x: 189.6, y: 28.2, width: 573.05, height: 386.95 });
  p.drawRectangle({ x: 0.6, y: 766.8, width: 593.4, height: 74.4, color: AZUL });
  p.drawRectangle({ x: 46.8, y: 725.4, width: 96.6, height: 115.8, color: VERDE });
  p.drawImage(logo, { x: 24.6, y: 736.2, width: 139.8, height: 100.2 });
  p.drawText('BENEFÍCIOS', { x: 363.52, y: 789.6, size: 36, font: f.openSans, color: BRANCO });
  p.drawRectangle({ x: 0.6, y: -0.62, width: 593.4, height: 49.2, color: AZUL });
  const RODAPE = [
    'Rua/Street: Av. Washington Soares, Nº 3663 – Edson Queiroz – Sala/Living Room: 1416 – Torre II – CEP/ZIP Code: 60.811 - 341 –',
    'Cidade/City: Fortaleza – Estado/State: Ceará - Brazil – Fone/Phone: +55 (85) 99277-2566 – contato@7servbeneficios.com.br',
  ];
  RODAPE.forEach((l, i) => {
    // A Calibri do modelo é mais estreita que a Helvetica: encolhe só o que passar da página.
    const w = larg(f.helv, seguro(f.helv, l), 10);
    const alvo = Math.min(w, 566);
    linhaAjustada(p, l, 299.3 - alvo / 2, i === 0 ? 28.425 : 15.225, alvo, f.helv, 10, BRANCO);
  });

  // Rúbrica e bloco de identificação.
  const rw = 160.8, rh = rw * (rubrica.height / rubrica.width);
  p.drawImage(rubrica, { x: 36.6, y: 214.32, width: rw, height: rh });
  [[SIGNATARIO.nome, 202.65, 0.7931], ['7SERV GESTÃO DE BENEFÍCIOS LTDA', 186.85, 0.7931], ['CNPJ nº 13.858.769/0001-97', 170.85, 0.82759]]
    .forEach(([t, y, esc]) => linhaEscalada(p, t, 36, y, esc, f.helvB, 12));

  p.drawText(seguro(f.times, `Assunto: Solicitação de pagamento referente ao mês de ${mesReferencia}.`), { x: CORPO.x, y: 643.75, size: CORPO.size, font: f.times, color: PRETO });
  p.drawText('Prezados(as) Senhores(as),', { x: CORPO.x, y: 586.35, size: CORPO.size, font: f.times, color: PRETO });

  const texto =
    'A empresa 7SERV GESTÃO DE BENEFÍCIOS LTDA, inscrita sob o CNPJ nº 13.858.769/0001-97, ' +
    `contratada por meio do Contrato nº ${contrato}, cujo objeto é ${objeto}, vem ` +
    `respeitosamente solicitar a regularização do pagamento referente ao mês de ${mesReferencia} ` +
    `( N.F ${numeroNota} ), no valor de R$ ${formatarReais(valorBruto)} (${reaisPorExtenso(valorBruto)}.)`;
  paragrafo(p, [{ t: texto, f: f.times, c: PRETO }], { x: CORPO.x, y: CORPO.primeiraLinha, largura: CORPO.largura, entrelinha: CORPO.entrelinha, size: CORPO.size });
  return doc.save();
};

/* ─── Modelo JUAZEIRO DO PIAUÍ (Requerimento de Pagamento) ─── */
const PAG_PIAUI = [595.6, 842];
const topo = (yTopo) => PAG_PIAUI[1] - yTopo; // coordenada "de cima pra baixo" (a do PDF do Word) → pdf-lib

/** "26/08 a 02/09/2026" a partir do par de datas da nota ("dd/mm/aaaa"). */
export const periodoCurto = (periodo) => {
  const a = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(periodo?.[0] || ''), b = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(periodo?.[1] || '');
  if (!a || !b) return periodo ? `${periodo[0]} a ${periodo[1]}` : '';
  return a[3] === b[3] ? `${a[1]}/${a[2]} a ${b[1]}/${b[2]}/${b[3]}` : `${a[0]} a ${b[0]}`;
};

export const TIPOS_PIAUI = ['Abastecimento', 'Manutenção (peças)', 'Abastecimento/ Manutenção (peças)'];
export const tipoPadraoPiaui = (tipo) => (tipo === 'MANUTENÇÃO' ? 'Manutenção (peças)' : tipo === 'ABASTECIMENTO' ? 'Abastecimento' : TIPOS_PIAUI[2]);

/** "2026-09-30" (campo de data) → "30/09/2026". */
export const dataBr = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

export const gerarPiaui = async ({ numeroNota, secretaria, valorLiquido, tipo, periodo, vencimento, comRubrica = false }) => {
  const { doc, f, logo } = await abrirDoc(`Requerimento de Pagamento - NF ${numeroNota}`);
  const p = doc.addPage(PAG_PIAUI);
  const VAR = PRETO; // tudo em preto (no arquivo de modelo os campos variáveis vêm em vermelho; aqui não)
  const X = 77.8, LARGURA = 461, SIZE = 12;

  // Cabeçalho: faixa verde, quadrado azul-petróleo e logotipo (coordenadas do PDF do modelo).
  p.drawRectangle({ x: -3, y: topo(90.2), width: 598.5, height: 74.4, color: VERDE });
  p.drawRectangle({ x: 17.9, y: topo(126.7), width: 96.5, height: 115.8, color: AZUL });
  p.drawImage(logo, { x: -12.6, y: topo(101.6), width: 139.8, height: 100.2 });
  p.drawText('BENEFÍCIOS', { x: 270.9 + f.openSans.widthOfTextAtSize('     ', 36), y: topo(62.8), size: 36, font: f.openSans, color: BRANCO });

  // Rodapé: faixa verde e as duas linhas (a Tahoma do modelo, encaixada na largura original).
  p.drawRectangle({ x: 1.5, y: topo(806), width: 593.4, height: 49.2, color: VERDE });
  linhaAjustada(p, 'Rua/Street: Av. Washington Soares, Nº 3663 – Edson Queiroz – Sala/Living Room: 1416 - Torre II – CEP/ZIP Code: 60.811 - 341 –', 9.8, topo(776.6), 582, f.helv, 10, BRANCO);
  linhaAjustada(p, 'Cidade/City: Fortaleza – Estado/State: Ceará - Brazil – Fone/Phone: +55 (85) 9.9132.8518 – contato@7servbeneficios.com.br', 23.6, topo(789), 556, f.helv, 10, BRANCO);

  // Título centralizado entre as margens.
  const titulo = 'REQUERIMENTO DE PAGAMENTO';
  p.drawText(titulo, { x: X + (LARGURA - larg(f.helvB, titulo, SIZE)) / 2, y: topo(188.5), size: SIZE, font: f.helvB, color: PRETO });

  const B = (t, c = PRETO) => ({ t, f: f.helvB, c }), R = (t, c = PRETO) => ({ t, f: f.helv, c });
  const linha = (segs, yTopo, opts = {}) => paragrafo(p, segs, { x: X, y: topo(yTopo), largura: LARGURA, entrelinha: 13.8, size: SIZE, ...opts });

  linha([B('FORNECEDOR: '), R('7SERV GESTÃO DE BENEFÍCIOS LTDA.')], 271.3);
  linha([B('CNPJ: '), R('13.858.769/0001-97')], 298.9);
  linha([B('ENDEREÇO: '), R('Av. Washington Soares, nº 3663, Sala 1416 – Torre 2, Bairro Edson Queiroz, Fortaleza/CE.')], 326.5);
  linha([B('CONTATO: '), R('financeiro@7beneficios.com.br')], 367.9);

  // Sem prefixo: a linha é exatamente o que foi digitado (ex.: "À SECRETARIA MUNICIPAL DE SAÚDE - FUNDO ...").
  // Nome comprido quebra em mais linhas (sem justificar, é título): tudo que vem abaixo desce o mesmo tanto,
  // pra nunca ficar um texto por cima do outro.
  const fimSecretaria = linha([B(secretaria.trim(), VAR)], 423.1, { indente: 37.3, justificar: false });
  const extra = topo(423.1) - fimSecretaria; // pontos que a secretaria ocupou além da 1ª linha

  const extenso = reaisPorExtenso(valorLiquido).replace(/,\s*/g, ' ').toUpperCase();
  linha([
    R('Vimos pelo presente solicitar a V. Sas., o pagamento do valor de '),
    B('R$ '), B(`${formatarReais(valorLiquido)} `, VAR), B(`(${extenso}`, VAR), B(')'),
    R(', CNPJ 13.858.769/0001-97, referente ao faturamento de '), R(tipo, VAR),
    R(' do período de '), B(periodoCurto(periodo), VAR), R('.'),
  ], 450.7 + extra, { indente: 37.3 });

  linha([R('Vencimento em: '), B(`${vencimento}.`, VAR)], 519.7 + extra, { indente: 37.3 });

  if (comRubrica) {
    const rubrica = await doc.embedPng(await baixar(rubricaUrl));
    const rw = 160.8, rh = rw * (rubrica.height / rubrica.width);
    p.drawImage(rubrica, { x: 77.8, y: topo(592 + extra) + 2, width: rw, height: rh });
  }
  linha([B('7SERV GESTÃO DE BENEFÍCIOS LTDA')], 602.5 + extra);
  linha([B(SIGNATARIO.nome.toUpperCase())], 616.3 + extra);
  linha([B(`CPF Nº ${SIGNATARIO.cpf}`)], 630.2 + extra);
  return doc.save();
};
