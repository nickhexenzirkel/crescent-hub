/* ═══════════════════════════════════════════════════════════════
   CONTROLE DE CLIENTES — dados, 4 modelos visuais e geradores.
   O MESMO documento HTML alimenta a pré-visualização e a impressão
   (horizontal/vertical via @page); a planilha .xlsx sai do ExcelJS
   com a orientação gravada na configuração de página.
═══════════════════════════════════════════════════════════════ */

export const METODOS = ['MIA', 'MISA', 'MANUAL', 'MISA / MIA', 'MIA / MANUAL'];
export const CATEGORIAS = ['ABAST', 'MANUT', 'ABAST/MANUT'];
export const PERIODOS = [
  'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA',
  'SEMANAL', 'QUINZENAL', 'DECENDIAL', 'MENSAL',
];

export const MODELOS = [
  { id: 'classico', titulo: 'Clássico', sub: 'Cabeçalho azul-marinho e linhas alternadas. Direto ao ponto.', cor: '#1F3A5F' },
  { id: 'agrupado', titulo: 'Agrupado por comercial', sub: 'Uma faixa colorida por comercial, com os clientes dele logo abaixo.', cor: '#0E8FA8' },
  { id: 'colorido', titulo: 'Colorido por categoria', sub: 'Abastecimento, manutenção e os dois juntos com cores diferentes.', cor: '#E08A1E' },
  { id: 'compacto', titulo: 'Compacto P&B', sub: 'Preto e branco, bordas finas e letra menor. Gasta pouca tinta.', cor: '#222222' },
  { id: 'porperiodo', titulo: 'Uma linha por período', sub: 'Cada cliente ganha uma linha para cada categoria/período (ex.: Eusébio abast. mensal e manut. segunda-feira).', cor: '#0B5D6B' },
  { id: 'sequencial', titulo: 'Uma linha por período sequencial', sub: 'Segue a ordem do dia de faturamento: segunda, terça... decendial, quinzenal, mensal. Cada cliente aparece no seu dia.', cor: '#B45309' },
  { id: 'porcliente', titulo: 'Uma linha por cliente', sub: 'O cliente aparece uma vez só, com tudo junto: ABAST/MANUT · MENSAL/SEGUNDA-FEIRA.', cor: '#6A2C70' },
];

export const linhaVazia = () => ({
  id: Math.random().toString(36).slice(2, 10),
  comercial: '', cliente: '', categoria: 'ABAST', periodo: '', setor: 'NÃO', metodo: 'MIA', obs: '',
});

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const up = (s) => String(s ?? '').trim().toUpperCase();

/* Tipo da categoria: define a cor nos modelos coloridos. */
export const tipoCategoria = (cat) => {
  const c = norm(cat);
  const ab = c.includes('abast'); const ma = c.includes('manut');
  if (ab && ma) return 'ambos';
  if (ab) return 'abast';
  if (ma) return 'manut';
  return 'outro';
};

const COR_CAT = {
  abast: { bg: '#FDE7C8', fg: '#8A4B00', argb: 'FFFDE7C8', fgArgb: 'FF8A4B00' },
  manut: { bg: '#D6E8FB', fg: '#124B8A', argb: 'FFD6E8FB', fgArgb: 'FF124B8A' },
  ambos: { bg: '#E6DCF8', fg: '#52318F', argb: 'FFE6DCF8', fgArgb: 'FF52318F' },
  outro: { bg: '#E7E9ED', fg: '#444444', argb: 'FFE7E9ED', fgArgb: 'FF444444' },
};

/* Cores das faixas por comercial (modelo agrupado), em ciclo. */
const CORES_GRUPO = [
  { hex: '#0E8FA8', argb: 'FF0E8FA8' }, { hex: '#C0307A', argb: 'FFC0307A' },
  { hex: '#5B60D0', argb: 'FF5B60D0' }, { hex: '#2E8B57', argb: 'FF2E8B57' },
  { hex: '#D9822B', argb: 'FFD9822B' }, { hex: '#7A4FB5', argb: 'FF7A4FB5' },
];

/* Agrupa mantendo a ordem em que cada comercial apareceu. */
export const agruparPorComercial = (rows) => {
  const mapa = new Map();
  for (const r of rows) {
    const k = up(r.comercial) || 'SEM COMERCIAL';
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(r);
  }
  return [...mapa.entries()].map(([nome, itens]) => ({ nome, itens }));
};

/* Cor escolhida pra um comercial: fundo + texto branco ou escuro conforme o brilho. */
export const corTexto = (hex) => {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#1b2430';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1b2430' : '#ffffff';
};
const estiloCor = (hex) => (hex ? `;background:${hex};color:${corTexto(hex)}` : '');

/* ─── Tema escolhido pela pessoa ───────────────────────────────────
   principal: sincroniza cabeçalho, linhas de separação, bordas, linhas alternadas e título.
   titulo / zebra / cabTexto: ajustes finos por cima da principal. Sem nada escolhido, vale a cor de fábrica do modelo. */
const misturaBranco = (hex, t) => {
  const h = hex.slice(1);
  return '#' + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - t) + 255 * t).toString(16).padStart(2, '0')).join('');
};
export const resolverTema = (modelo, tema = {}) => {
  const o = {};
  if (modelo !== 'compacto' && tema.principal) {
    o.head = tema.principal; o.headFg = corTexto(tema.principal); o.titulo = tema.principal;
    o.zebra = misturaBranco(tema.principal, 0.9); o.borda = misturaBranco(tema.principal, 0.72);
  }
  if (tema.titulo) o.titulo = tema.titulo;
  if (tema.zebra) o.zebra = tema.zebra;
  if (modelo !== 'compacto' && tema.cabTexto) o.headFg = tema.cabTexto;
  return o;
};
const SELETOR_ZEBRA = {
  classico: 'tbody tr:nth-child(even) td', porcliente: 'tbody tr:nth-child(even) td', colorido: 'tbody tr:nth-child(even) td',
  agrupado: 'tbody tr.it:nth-child(even) td', porperiodo: 'tr.odd td', sequencial: 'tr.odd td',
};
const cssTema = (modelo, o) => {
  let c = '';
  if (o.titulo) c += `h1{color:${o.titulo}}`;
  if (o.head) c += `th{background:${o.head};color:${o.headFg};border-color:${o.head}}tr.ini td{border-top-color:${o.head}}`;
  else if (o.headFg) c += `th{color:${o.headFg}}`;
  if (o.borda) c += `td{border-color:${o.borda}}`;
  if (o.zebra && SELETOR_ZEBRA[modelo]) c += `${SELETOR_ZEBRA[modelo]}{background:${o.zebra}}`;
  return c;
};

/* Linha de separação na cor do modelo: '' (nenhuma, padrão), 'fina' ou 'grossa'. linhasGrossas é o nome antigo da opção. */
const separador = (tema) => tema.separador || (tema.linhasGrossas ? 'grossa' : '');

/* ─── Largura das colunas pelo tamanho do conteúdo ─────────────────
   Cada coluna ganha o espaço do texto mais longo dela (com um teto pras colunas de texto livre, que quebram linha),
   nunca menos que o título. O que sobra da folha é repartido na mesma proporção. */
const GET_COL = {
  COMERCIAL: (r) => up(r.comercial), CLIENTE: (r) => up(r.cliente), CATEGORIA: (r) => up(r.categoria),
  'PERÍODO': (r) => up(r.periodo), SETOR: () => 'SIM', 'MÉTODO': (r) => up(r.metodo), 'OBSERVAÇÃO': (r) => String(r.obs || ''),
};
const CAP_COL = { CLIENTE: 38, 'OBSERVAÇÃO': 40, 'PERÍODO': 22, CATEGORIA: 16, 'MÉTODO': 14, COMERCIAL: 16 };
const caracteresColuna = (nome, dados, capObs) => {
  const cap = nome === 'OBSERVAÇÃO' && capObs ? capObs : (CAP_COL[nome] || 99);
  const max = dados.reduce((m, r) => Math.max(m, GET_COL[nome](r).length), 0);
  const negrito = nome === 'COMERCIAL' || nome === 'MÉTODO' ? 1.12 : 1;
  return Math.max(nome.length * 1.15, Math.min(max, cap) * negrito) + 2.5;
};

export const linhasValidas = (rows) => rows.filter((r) => (r.cliente || '').trim());

/* Ordem de prioridade das linhas: pelo período (segunda → ... → solicitação). Período fora da lista vai pro fim.
   'TERÇA E SEXTA' vale pelo primeiro dia que aparece na prioridade. Ordenação estável: empate mantém a ordem digitada. */
const PRIORIDADE_PERIODO = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'decen', 'quinzen', 'mensal', 'solicit'];
export const pesoPeriodo = (p) => {
  const t = norm(p);
  const i = PRIORIDADE_PERIODO.map((k) => (t.includes(k) ? PRIORIDADE_PERIODO.indexOf(k) : 99));
  return Math.min(...i);
};
export const ordenarPorPeriodo = (rows) => rows
  .map((r, i) => ({ r, i, w: pesoPeriodo(r.periodo) }))
  .sort((a, b) => a.w - b.w || a.i - b.i)
  .map((x) => x.r);
/* Comercial na ordem em que foram digitados; dentro de cada um, por período. */
const gruposComercial = (validas) => agruparPorComercial(validas).map((g) => ({ ...g, itens: ordenarPorPeriodo(g.itens) }));

const partes = (s) => String(s ?? '').split('/').map((x) => x.trim()).filter(Boolean);
const unicos = (a) => [...new Set(a)];

/* Linha com 'ABAST/MANUT' + 'MENSAL/SEGUNDA-FEIRA' vira uma linha por par; só separa quando as contagens batem. */
export const expandir = (rows) => rows.flatMap((r) => {
  const c = partes(r.categoria); const p = partes(r.periodo);
  if (c.length > 1 && c.length === p.length) return c.map((cat, i) => ({ ...r, categoria: up(cat), periodo: up(p[i]) }));
  return [r];
});

export const agruparPorCliente = (rows) => {
  const mapa = new Map();
  for (const r of rows) {
    const k = up(r.comercial) + '|' + up(r.cliente);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(r);
  }
  return [...mapa.values()].map((itens) => ({ itens }));
};

/* Uma linha por cliente: categorias, períodos, métodos e observações viram listas separadas por '/'. */
export const consolidar = (rows) => agruparPorCliente(expandir(rows)).map(({ itens }) => ({
  ...itens[0],
  categoria: unicos(itens.map((r) => up(r.categoria)).filter(Boolean)).join('/'),
  periodo: unicos(itens.map((r) => up(r.periodo)).filter(Boolean)).join('/'),
  setor: itens.some((r) => up(r.setor).startsWith('S')) ? 'SIM' : 'NÃO',
  metodo: unicos(itens.flatMap((r) => partes(up(r.metodo)))).join(' / '),
  obs: unicos(itens.map((r) => String(r.obs || '').trim()).filter(Boolean)).join(' | '),
}));

/* ─── Importar planilha existente (.xlsx/.csv) ─────────────────── */
export const importarPlanilha = async (file) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const m = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let h = m.findIndex((r) => r.some((c) => norm(c) === 'comercial') && r.some((c) => /municipio|cliente/.test(norm(c))));
  let titulo = '';
  if (h < 0) h = 0;
  else if (m[0] && String(m[0][0] || '').trim() && h > 0) titulo = String(m[0][0]).trim();
  const cab = (m[h] || []).map(norm);
  const col = (re, padrao) => { const i = cab.findIndex((c) => re.test(c)); return i >= 0 ? i : padrao; };
  const ix = {
    comercial: col(/^comercial/, 0), cliente: col(/municipio|cliente|nome/, 1), categoria: col(/categoria/, 2),
    periodo: col(/periodo/, 3), setor: col(/^setor/, 4), metodo: col(/metodo/, 5), obs: col(/observ/, 6),
  };
  const rows = [];
  for (const r of m.slice(h + 1)) {
    const cliente = String(r[ix.cliente] ?? '').trim();
    if (!cliente) continue;
    const setor = up(r[ix.setor]);
    rows.push({
      ...linhaVazia(),
      comercial: up(r[ix.comercial]), cliente: cliente.toUpperCase(), categoria: up(r[ix.categoria]),
      periodo: up(r[ix.periodo]), setor: setor.startsWith('S') ? 'SIM' : 'NÃO',
      metodo: up(r[ix.metodo]) || 'MIA', obs: String(r[ix.obs] ?? '').trim().toUpperCase(),
    });
  }
  return { rows, titulo };
};

/* ─── HTML (pré-visualização + impressão) ───────────────────────── */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS_BASE = `
*{box-sizing:border-box}
body{margin:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1b2430}
h1{margin:0 0 18px;text-align:center;letter-spacing:.04em}
.sub{text-align:center;color:#6b7280;font-size:11px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{display:table-header-group}
tr{page-break-inside:avoid}
td,th{padding:4px 7px;vertical-align:middle;word-wrap:break-word;overflow-wrap:anywhere}
td.c,th.c{text-align:center}
.tag{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:700;font-size:.92em}
@media screen{ body{background:#e5e7eb;padding:16px} .folha{background:#fff;margin:0 auto;box-shadow:0 4px 22px rgba(0,0,0,.18)} }
@media print{ body{-webkit-print-color-adjust:exact;print-color-adjust:exact} }
`;

const CSS_MODELO = {
  classico: `
h1{font-size:30px;font-weight:900;letter-spacing:.06em;border-bottom:3px solid currentColor;padding-bottom:6px;color:#1F3A5F}
th{background:#1F3A5F;color:#fff;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #1F3A5F}
td{font-size:11.5px;border:1px solid #C9D2DF}
tbody tr:nth-child(even) td{background:#EEF2F8}
.tag.sim{background:#D8F0DF;color:#1E6B36}.tag.nao{background:#F6DADA;color:#9B2B2B}
`,
  agrupado: `
h1{font-size:30px;font-weight:900;letter-spacing:.06em;border-bottom:3px solid currentColor;padding-bottom:6px;color:#17324D}
th{background:#17324D;color:#fff;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #17324D}
td{font-size:11.5px;border:1px solid #D5DBE4}
tr.grp td{color:#fff;font-weight:800;font-size:12.5px;letter-spacing:.06em;border:none;padding:8px 10px}
tr.grp td span{font-weight:500;opacity:.85;margin-left:8px;font-size:11px}
tbody tr.it:nth-child(even) td{background:#F5F7FA}
.tag.sim{background:#D8F0DF;color:#1E6B36}.tag.nao{background:#F6DADA;color:#9B2B2B}
`,
  colorido: `
h1{font-size:30px;font-weight:900;letter-spacing:.06em;border-bottom:3px solid currentColor;padding-bottom:6px;color:#3a2a14}
th{background:#3a2a14;color:#fff;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #3a2a14}
td{font-size:11.5px;border:1px solid #E1D8CA}
.leg{display:flex;gap:14px;justify-content:center;margin:0 0 12px;font-size:11px;flex-wrap:wrap}
.leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.tag.sim{background:#D8F0DF;color:#1E6B36}.tag.nao{background:#F6DADA;color:#9B2B2B}
`,
  porperiodo: `
h1{font-size:30px;font-weight:900;letter-spacing:.06em;border-bottom:3px solid currentColor;padding-bottom:6px;color:#0B5D6B}
th{background:#0B5D6B;color:#fff;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #0B5D6B}
td{font-size:11.5px;border:1px solid #C5DADF}
tr.ini td{border-top:2px solid #0B5D6B}
tr.odd td{background:#EAF4F6}
.tag.sim{background:#D8F0DF;color:#1E6B36}.tag.nao{background:#F6DADA;color:#9B2B2B}
`,
  sequencial: `
h1{font-size:30px;font-weight:900;letter-spacing:.06em;border-bottom:3px solid currentColor;padding-bottom:6px;color:#B45309}
th{background:#B45309;color:#fff;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #B45309}
td{font-size:11.5px;border:1px solid #EBD9C4}
tr.ini td{border-top:2px solid #B45309}
tr.odd td{background:#FDF3E6}
.tag.sim{background:#D8F0DF;color:#1E6B36}.tag.nao{background:#F6DADA;color:#9B2B2B}
`,
  porcliente: `
h1{font-size:30px;font-weight:900;letter-spacing:.06em;border-bottom:3px solid currentColor;padding-bottom:6px;color:#6A2C70}
th{background:#6A2C70;color:#fff;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;border:1px solid #6A2C70}
td{font-size:11.5px;border:1px solid #DCCBDD}
tbody tr:nth-child(even) td{background:#F6EEF7}
.tag.sim{background:#D8F0DF;color:#1E6B36}.tag.nao{background:#F6DADA;color:#9B2B2B}
`,
  compacto: `
h1{font-size:24px;font-weight:900;border-bottom:3px solid #000;padding-bottom:4px;color:#000;text-align:left}
.sub{text-align:left;margin-bottom:8px}
th{background:#fff;color:#000;font-size:10.5px;text-transform:uppercase;border:1px solid #000;border-bottom:2px solid #000}
td{font-size:10.5px;padding:3px 6px;border:1px solid #777}
.tag{padding:0;border-radius:0;font-weight:700}
`,
};

export const montarHtml = ({ modelo, rows, titulo, orientacao, cores = {}, tema = {} }) => {
  const validas = linhasValidas(rows);
  const lista = ordenarPorPeriodo(validas);
  const agrupado = modelo === 'agrupado';
  const porPeriodo = modelo === 'porperiodo';
  const dados = porPeriodo ? expandir(lista) : modelo === 'porcliente' ? consolidar(lista) : lista;
  const cols = agrupado
    ? [['CLIENTE', 27], ['CATEGORIA', 13], ['PERÍODO', 17], ['SETOR', 8], ['MÉTODO', 11], ['OBSERVAÇÃO', 24]]
    : modelo === 'porcliente'
      ? [['COMERCIAL', 10], ['CLIENTE', 22], ['CATEGORIA', 13], ['PERÍODO', 20], ['SETOR', 6], ['MÉTODO', 10], ['OBSERVAÇÃO', 19]]
      : [['COMERCIAL', 11], ['CLIENTE', 24], ['CATEGORIA', 11], ['PERÍODO', 14], ['SETOR', 7], ['MÉTODO', 10], ['OBSERVAÇÃO', 23]];
  /* Duas colunas: larguras fixas de sempre. Tabela única: sem colgroup, a própria tabela dimensiona pelo conteúdo (table-layout:auto). */
  /* Horizontal em tabela única: a tabela ocupa a folha toda. Colunas curtas ficam do tamanho do texto (px) e
     Cliente/Observação (sem largura) dividem o resto. No vertical a tabela é só do tamanho do conteúdo. */
  const colgroupHtml = (duas) => {
    if (duas) return `<colgroup>${cols.map(([, w]) => `<col style="width:${w}%">`).join('')}</colgroup>`;
    if (orientacao !== 'landscape') return '';
    // larguras proporcionais ao texto de cada coluna: a sobra da folha se reparte igual, sem inflar só a Observação
    const w = cols.map(([nome]) => caracteresColuna(nome, dados, 36));
    const soma = w.reduce((a, b) => a + b, 0);
    return `<colgroup>${w.map((x) => `<col style="width:${(x / soma * 100).toFixed(2)}%">`).join('')}</colgroup>`;
  };
  const thead = `<thead><tr>${cols.map(([n]) => `<th class="${['SETOR', 'MÉTODO', 'CATEGORIA'].includes(n) ? 'c' : ''}">${n}</th>`).join('')}</tr></thead>`;

  /* ini: 'sem' = linha de continuação de um cliente (comercial/cliente já saíram na linha de cima, via rowspan). */
  const celulas = (r, comCom, rowspan) => {
    const t = tipoCategoria(r.categoria);
    const catStyle = modelo === 'colorido' ? ` style="background:${COR_CAT[t].bg};color:${COR_CAT[t].fg};font-weight:700"` : '';
    const sim = up(r.setor).startsWith('S');
    const rs = rowspan ? ` rowspan="${rowspan}"` : '';
    const ini = comCom === 'sem' ? ''
      : (comCom ? `<td${rs} style="font-weight:700${estiloCor(cores[up(r.comercial)])}">${esc(up(r.comercial))}</td>` : '')
        + `<td${rs}${rowspan ? ' style="font-weight:600"' : ''}>${esc(up(r.cliente))}</td>`;
    return ini
      + `<td class="c"${catStyle}>${esc(up(r.categoria))}</td>`
      + `<td class="c">${esc(up(r.periodo))}</td>`
      + `<td class="c"><span class="tag ${sim ? 'sim' : 'nao'}">${sim ? 'SIM' : 'NÃO'}</span></td>`
      + `<td class="c" style="font-weight:700">${esc(up(r.metodo))}</td>`
      + `<td>${esc(r.obs)}</td>`;
  };

  const blocos = []; // cada bloco é um pedaço que não pode ser cortado ao meio (linha, cliente ou comercial)
  if (agrupado) {
    gruposComercial(validas).forEach((g, i) => {
      const cor = cores[g.nome] || CORES_GRUPO[i % CORES_GRUPO.length].hex;
      let b = `<tr class="grp"><td colspan="6" style="background:${cor}">${esc(g.nome)}<span>${g.itens.length} ${g.itens.length === 1 ? 'cliente' : 'clientes'}</span></td></tr>`;
      for (const r of g.itens) b += `<tr class="it">${celulas(r, false)}</tr>`;
      blocos.push(b);
    });
  } else if (porPeriodo) {
    agruparPorCliente(dados).forEach((g, gi) => {
      let b = '';
      g.itens.forEach((r, i) => {
        b += `<tr class="${i === 0 ? 'ini ' : ''}${gi % 2 ? 'odd' : ''}">${i === 0 ? celulas(r, true, g.itens.length) : celulas(r, 'sem')}</tr>`;
      });
      blocos.push(b);
    });
  } else {
    let ant = null; let gi = -1;
    for (const r of dados) {
      const w = pesoPeriodo(r.periodo); const novo = modelo === 'sequencial' && w !== ant;
      if (novo) gi++; ant = w;
      const cl = modelo === 'sequencial' && blocos.length % 2 ? 'odd' : '';
      blocos.push(`<tr${cl ? ` class="${cl.trim()}"` : ''}>${celulas(r, true)}</tr>`);
    }
  }
  const tabela = (bl) => `<table>${colgroupHtml(duas)}${thead}<tbody>${bl.join('')}</tbody></table>`;
  const totalTr = blocos.reduce((n, b) => n + (b.match(/<tr/g) || []).length, 0);
  /* Horizontal com lista grande: duas tabelas lado a lado. A folha deitada é larga e baixa; numa coluna só a letra
     precisava encolher demais pra caber a lista inteira na altura. */
  const duas = orientacao === 'landscape' && totalTr > 16 && !tema.colunaUnica;
  let tabelas;
  if (!dados.length) {
    tabelas = tabela([`<tr><td colspan="${cols.length}" style="text-align:center;color:#888;padding:28px">Adicione clientes para ver o documento aqui.</td></tr>`]);
  } else if (duas) {
    const a = []; const b = []; let n = 0;
    for (const bl of blocos) { (n < totalTr / 2 ? a : b).push(bl); n += (bl.match(/<tr/g) || []).length; }
    tabelas = `<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:1;min-width:0">${tabela(a)}</div>${b.length ? `<div style="flex:1;min-width:0">${tabela(b)}</div>` : ''}</div>`;
  } else {
    tabelas = tabela(blocos);
  }

  const legenda = modelo === 'colorido'
    ? `<div class="leg"><span><i style="background:${COR_CAT.abast.bg}"></i>Abastecimento</span><span><i style="background:${COR_CAT.manut.bg}"></i>Manutenção</span><span><i style="background:${COR_CAT.ambos.bg}"></i>Abast. + Manut.</span></div>`
    : '';
  const land = orientacao === 'landscape';
  const mm = modelo === 'compacto' ? 4 : 5; // margem da folha A4 (mm): bem junto da borda pra sobrar espaço pro texto
  const pagW = land ? 297 : 210; const pagH = land ? 210 : 297;
  const px = (v) => Math.round(v * 3.7795);
  const availW = px(pagW - 2 * mm); const availH = px(pagH - 2 * mm) - 6;

  /* UMA PÁGINA SÓ: o conteúdo é encolhido até caber inteiro numa folha A4 (na tela e na impressão). */
  const script = `(function(){
var AW=${availW},AH=Math.floor(${availH}*0.95),PW=${px(pagW)};
var wrap=document.getElementById('wrap'),fit=document.getElementById('fit');
function ajusta(){
  var s=${duas ? 1 : 1.6};fit.style.transform='none';fit.style.width=(AW/s)+'px';
  var h=fit.offsetHeight;
  while(h*s>AH&&s>0.25){s-=0.01;fit.style.width=(AW/s)+'px';h=fit.offsetHeight;}
  fit.style.transformOrigin='0 0';fit.style.transform='scale('+s+')';
  wrap.style.height=Math.min(AH,Math.ceil(h*s))+'px';
}
function zoomTela(){document.body.style.zoom=Math.min(1,window.innerWidth/(PW+32));}
window.addEventListener('beforeprint',function(){document.body.style.zoom=1;ajusta()});
window.addEventListener('afterprint',zoomTela);
window.addEventListener('resize',zoomTela);
ajusta();zoomTela();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ajusta);
window.addEventListener('load',ajusta);
})()`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo || 'Controle de Clientes')}</title>
<style>@page{size:A4 ${orientacao};margin:${mm}mm}${CSS_BASE}${CSS_MODELO[modelo] || ''}${cssTema(modelo, resolverTema(modelo, tema))}${separador(tema) ? `tbody td{border-top:${separador(tema) === 'grossa' ? 2 : 1}px solid ${resolverTema(modelo, tema).head || (MODELOS.find((m) => m.id === modelo) || {}).cor || '#000'}}` : ''}
#wrap{width:${availW}px;overflow:hidden}
${duas ? '' : orientacao === 'landscape' ? 'table{table-layout:fixed;width:100%}td,th{padding:0 8px;line-height:1.05}td{font-size:14.5px}th{font-size:13.5px}.tag{padding:0 8px;line-height:1.05;vertical-align:middle}thead th{height:30px;vertical-align:middle}tbody tr{height:20px}tbody td{height:20px;padding-top:0;padding-bottom:0;vertical-align:middle}.tag{display:inline-block;vertical-align:middle}td.c,th,td:nth-child(-n+2){white-space:nowrap}' : 'table{table-layout:auto;width:auto;margin:0 auto}td,th{padding:2px 8px;overflow-wrap:normal;word-break:normal}td.c,th.c,th{white-space:nowrap}'}
@media screen{.folha{width:${px(pagW)}px;height:${px(pagH)}px;padding:${px(mm)}px;overflow:hidden}}
@media print{.folha{width:${availW}px;height:auto;padding:0;box-shadow:none}html,body{background:#fff;padding:0;margin:0}}</style></head>
<body><div class="folha"><div id="wrap"><div id="fit"><h1>${esc((titulo || 'CONTROLE DE CLIENTES').toUpperCase())}</h1>
${legenda}
${tabelas}</div></div></div>
<script>${script}</script>
</body></html>`;
};

/* ─── Planilha (.xlsx) ──────────────────────────────────────────── */
const BORDA = (argb) => ({ top: { style: 'thin', color: { argb } }, left: { style: 'thin', color: { argb } }, bottom: { style: 'thin', color: { argb } }, right: { style: 'thin', color: { argb } } });

const ESTILO_XLSX = {
  classico: { head: 'FF1F3A5F', headFg: 'FFFFFFFF', zebra: 'FFEEF2F8', borda: 'FFC9D2DF', titulo: 'FF1F3A5F', fonte: 11 },
  agrupado: { head: 'FF17324D', headFg: 'FFFFFFFF', zebra: 'FFF5F7FA', borda: 'FFD5DBE4', titulo: 'FF17324D', fonte: 11 },
  colorido: { head: 'FF3A2A14', headFg: 'FFFFFFFF', zebra: null, borda: 'FFE1D8CA', titulo: 'FF3A2A14', fonte: 11 },
  porperiodo: { head: 'FF0B5D6B', headFg: 'FFFFFFFF', zebra: 'FFEAF4F6', borda: 'FFC5DADF', titulo: 'FF0B5D6B', fonte: 11 },
  porcliente: { head: 'FF6A2C70', headFg: 'FFFFFFFF', zebra: 'FFF6EEF7', borda: 'FFDCCBDD', titulo: 'FF6A2C70', fonte: 11 },
  sequencial: { head: 'FFB45309', headFg: 'FFFFFFFF', zebra: 'FFFDF3E6', borda: 'FFEBD9C4', titulo: 'FFB45309', fonte: 11 },
  compacto: { head: 'FFFFFFFF', headFg: 'FF000000', zebra: null, borda: 'FF777777', titulo: 'FF000000', fonte: 10 },
};

export const gerarXlsx = async ({ modelo, rows, titulo, orientacao, cores = {}, tema = {} }) => {
  const { default: ExcelJS } = await import('exceljs');
  const validas = linhasValidas(rows);
  const lista = ordenarPorPeriodo(validas);
  const ov = resolverTema(modelo, tema);
  const ar = (h) => 'FF' + h.slice(1).toUpperCase();
  const e = { ...(ESTILO_XLSX[modelo] || ESTILO_XLSX.classico) };
  if (ov.head) e.head = ar(ov.head);
  if (ov.headFg) e.headFg = ar(ov.headFg);
  if (ov.zebra) e.zebra = ar(ov.zebra);
  if (ov.borda) e.borda = ar(ov.borda);
  if (ov.titulo) e.titulo = ar(ov.titulo);
  const agrupado = modelo === 'agrupado';
  const porPeriodo = modelo === 'porperiodo';
  const dados = porPeriodo ? expandir(lista) : modelo === 'porcliente' ? consolidar(lista) : lista;
  const cols = agrupado
    ? [['CLIENTE', 36], ['CATEGORIA', 15], ['PERÍODO', 20], ['SETOR', 9], ['MÉTODO', 13], ['OBSERVAÇÃO', 42]]
    : modelo === 'porcliente'
      ? [['COMERCIAL', 15], ['CLIENTE', 36], ['CATEGORIA', 18], ['PERÍODO', 32], ['SETOR', 9], ['MÉTODO', 15], ['OBSERVAÇÃO', 38]]
      : [['COMERCIAL', 15], ['CLIENTE', 36], ['CATEGORIA', 15], ['PERÍODO', 20], ['SETOR', 9], ['MÉTODO', 13], ['OBSERVAÇÃO', 42]];
  const n = cols.length;
  cols.forEach((c) => { c[1] = Math.round(caracteresColuna(c[0], dados, 0) * 1.1); });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Controle de Clientes', {
    pageSetup: {
      paperSize: 9, orientation: orientacao, fitToPage: true, fitToWidth: 1, fitToHeight: 1, // sempre 1 página só
      horizontalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.35, header: 0.1, footer: 0.15 },
    },
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  ws.columns = cols.map(([, w]) => ({ width: w }));

  ws.mergeCells(1, 1, 1, n);
  const t = ws.getCell(1, 1);
  t.value = (titulo || 'CONTROLE DE CLIENTES').toUpperCase();
  t.font = { bold: true, size: modelo === 'compacto' ? 20 : 28, color: { argb: modelo === 'compacto' || tema.titulo ? e.titulo : e.headFg } };
  if (modelo !== 'compacto') t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.head } };
  t.alignment = { horizontal: modelo === 'compacto' ? 'left' : 'center', vertical: 'middle' };
  ws.getRow(1).height = 46;

  ws.getRow(2).height = 16; // respiro entre o título e o cabeçalho

  const hr = ws.getRow(3);
  hr.height = 22;
  cols.forEach(([nome], i) => {
    const c = hr.getCell(i + 1);
    c.value = nome;
    c.font = { bold: true, size: e.fonte, color: { argb: e.headFg } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.head } };
    c.alignment = { horizontal: ['CATEGORIA', 'PERÍODO', 'SETOR', 'MÉTODO'].includes(nome) ? 'center' : 'left', vertical: 'middle' };
    c.border = modelo === 'compacto'
      ? { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'medium' } }
      : BORDA(e.head);
  });
  ws.pageSetup.printTitlesRow = '3:3';

  const alturaPara = (vals) => {
    let linhas = 1;
    vals.forEach((v, i) => { linhas = Math.max(linhas, Math.ceil(String(v || '').length / (cols[i][1] * 0.95))); });
    return Math.max(modelo === 'compacto' ? 16 : 20, linhas * (modelo === 'compacto' ? 13 : 15) + 4);
  };

  const escreverLinha = (r, par) => {
    const vals = agrupado
      ? [up(r.cliente), up(r.categoria), up(r.periodo), up(r.setor).startsWith('S') ? 'SIM' : 'NÃO', up(r.metodo), r.obs]
      : [up(r.comercial), up(r.cliente), up(r.categoria), up(r.periodo), up(r.setor).startsWith('S') ? 'SIM' : 'NÃO', up(r.metodo), r.obs];
    const row = ws.addRow(vals);
    row.height = alturaPara(vals);
    const off = agrupado ? 0 : 1;
    row.eachCell({ includeEmpty: true }, (c, ci) => {
      const nome = cols[ci - 1][0];
      c.font = { size: e.fonte, bold: nome === 'COMERCIAL' || nome === 'MÉTODO' };
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: ['CATEGORIA', 'PERÍODO', 'SETOR', 'MÉTODO'].includes(nome) ? 'center' : 'left' };
      c.border = BORDA(e.borda);
      if (e.zebra && par) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.zebra } };
    });
    if (separador(tema)) {
      const topo = { style: separador(tema) === 'grossa' ? 'medium' : 'thin', color: { argb: modelo === 'compacto' ? 'FF000000' : e.head } };
      row.eachCell({ includeEmpty: true }, (c) => { c.border = { ...c.border, top: topo }; });
    }
    const corCom = !agrupado && cores[up(r.comercial)];
    if (corCom) {
      const cc = row.getCell(1);
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + corCom.slice(1).toUpperCase() } };
      cc.font = { size: e.fonte, bold: true, color: { argb: corTexto(corCom) === '#ffffff' ? 'FFFFFFFF' : 'FF1B2430' } };
    }
    const setorCel = row.getCell(4 + off);
    const sim = vals[3 + off] === 'SIM';
    if (modelo !== 'compacto') {
      setorCel.font = { size: e.fonte, bold: true, color: { argb: sim ? 'FF1E6B36' : 'FF9B2B2B' } };
      setorCel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sim ? 'FFD8F0DF' : 'FFF6DADA' } };
    } else {
      setorCel.font = { size: e.fonte, bold: true };
    }
    if (modelo === 'colorido') {
      const cor = COR_CAT[tipoCategoria(r.categoria)];
      const cc = row.getCell(2 + off);
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor.argb } };
      cc.font = { size: e.fonte, bold: true, color: { argb: cor.fgArgb } };
    }
  };

  if (agrupado) {
    gruposComercial(validas).forEach((g, gi) => {
      const cor = cores[g.nome] ? 'FF' + cores[g.nome].slice(1).toUpperCase() : CORES_GRUPO[gi % CORES_GRUPO.length].argb;
      const row = ws.addRow([`${g.nome}  ·  ${g.itens.length} ${g.itens.length === 1 ? 'cliente' : 'clientes'}`]);
      ws.mergeCells(row.number, 1, row.number, n);
      row.height = 24;
      const c = row.getCell(1);
      c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
      c.alignment = { vertical: 'middle', indent: 1 };
      g.itens.forEach((r, i) => escreverLinha(r, i % 2 === 1));
    });
  } else if (porPeriodo) {
    // cliente com várias linhas: comercial e cliente viram células mescladas na vertical
    agruparPorCliente(dados).forEach((g, gi) => {
      const ini = ws.rowCount + 1;
      g.itens.forEach((r) => escreverLinha(r, gi % 2 === 1));
      const fim = ws.rowCount;
      for (let r = ini + 1; r <= fim; r++) { ws.getCell(r, 1).value = null; ws.getCell(r, 2).value = null; }
      if (fim > ini) { ws.mergeCells(ini, 1, fim, 1); ws.mergeCells(ini, 2, fim, 2); }
      for (const c of [1, 2]) ws.getCell(ini, c).alignment = { vertical: 'middle', wrapText: true };
      for (let c = 1; c <= n; c++) ws.getCell(ini, c).border = { ...BORDA(e.borda), top: { style: 'medium', color: { argb: e.head } } };
    });
  } else {
    let ant = null; let gi = -1;
    dados.forEach((r, i) => {
      const w = pesoPeriodo(r.periodo); const novo = modelo === 'sequencial' && w !== ant;
      if (novo) gi++; ant = w;
      escreverLinha(r, i % 2 === 1);
    });
  }

  ws.headerFooter.oddFooter = '&L&8Uniko · Controle de Clientes&R&8Página &P de &N';
  return wb.xlsx.writeBuffer();
};
