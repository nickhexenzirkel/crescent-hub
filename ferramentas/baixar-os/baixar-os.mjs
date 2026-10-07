// Baixar Ordens de Serviço da Wowlet — roda no SEU PC (a Wowlet pede captcha,
// que o servidor não passa). Uso:  node baixar-os.mjs "planilha.xlsx" [pasta-de-saida]
// Abre o Chrome: você faz login (e o captcha) UMA vez; o resto é automático.
// Saída: <pasta>/<Secretaria>/<Setor>/OS_<id>.pdf   (ordens já baixadas são puladas)
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://app.7beneficiosgestao.com.br';
const planilha = process.argv[2];
const saida = path.resolve(process.argv[3] || 'Ordens de Servico');
if (!planilha) { console.log('Uso: node baixar-os.mjs "planilha.xlsx" [pasta-de-saida]'); process.exit(1); }

const log = (m) => console.log(`${new Date().toLocaleTimeString('pt-BR')}  ${m}`);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const pasta = (s) => String(s || 'Sem nome').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Sem nome';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── planilha (colunas pelo nome) ──
const wbk = XLSX.readFile(planilha);
const rows = XLSX.utils.sheet_to_json(wbk.Sheets[wbk.SheetNames[0]], { defval: '' });
const chave = (r, ini) => Object.keys(r).find((k) => norm(k).toLowerCase().startsWith(ini));
const itens = []; const vistos = new Set();
for (const r of rows) {
  const os = String(r[chave(r, 'id da ordem')] ?? '').trim();
  if (!os || vistos.has(os)) continue;
  vistos.add(os);
  itens.push({
    os,
    credenciado: String(r[chave(r, 'credenciado')] ?? '').trim(),
    setor: String(r[chave(r, 'setor')] ?? '').trim(),
    secretaria: String(r[chave(r, 'cliente')] ?? '').trim(),
  });
}
log(`${itens.length} ordem(ns) na planilha.`);
const grupos = new Map();
for (const it of itens) { if (!grupos.has(it.credenciado)) grupos.set(it.credenciado, []); grupos.get(it.credenciado).push(it); }

const ctx = await chromium.launchPersistentContext(path.resolve('perfil-chrome'), {
  channel: 'chrome', headless: false, acceptDownloads: true, viewport: null, args: ['--start-maximized'],
});
const page = ctx.pages()[0] || await ctx.newPage();
page.setDefaultTimeout(30000);
const cdp = await ctx.newCDPSession(page);

const logado = () => !/\/sessions/.test(new URL(page.url()).pathname);

async function garantirLogin() {
  await page.goto(`${BASE}/sessions/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (logado()) { log('Já logado.'); return; }
  log('>>> FAÇA O LOGIN na janela do Chrome (resolva o captcha e clique em Acessar). Aguardando até 5 min…');
  for (let i = 0; i < 100 && !logado(); i++) {
    await page.waitForTimeout(3000);
    if (i % 5 === 4) log(`…ainda esperando o login (página: ${page.url()})`);
  }
  if (!logado()) throw new Error('Login não concluído a tempo.');
  log(`Login feito (página: ${page.url()}).`);
}

/** Sempre começa pela lista de credenciados (/providers). */
async function voltarAoAdmin() {
  await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (await page.getByRole('searchbox').first().isVisible({ timeout: 5000 }).catch(() => false)) return;
  const textos = await page.getByRole('link').allInnerTexts().catch(() => []);
  log(`Não vejo a lista de credenciados em /providers (página: ${page.url()}). Links: ${textos.map((t) => t.trim()).filter(Boolean).slice(0, 25).join(' | ')}`);
  const sair = page.getByRole('link', { name: /voltar|sair d|encerrar|retornar|painel admin/i }).first();
  if (await sair.count()) { log('Clicando em ' + (await sair.innerText()).trim()); await sair.click(); await page.waitForLoadState('domcontentloaded'); }
  await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' });
  if (!(await page.getByRole('searchbox').first().isVisible({ timeout: 5000 }).catch(() => false))) throw new Error('Não consegui abrir a lista de credenciados (veja a lista de links acima).');
}

async function acessarCredenciado(nome) {
  const alvo = norm(nome);
  const termos = [...new Set([nome, nome.split(' - ')[0].trim(), nome.trim().split(/\s+/)[0]])].filter(Boolean);
  for (const termo of termos) {
    log(`Credenciados → pesquisando "${termo}"…`);
    await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' });
    let campo = page.getByRole('searchbox').first();
    if (!(await campo.isVisible().catch(() => false))) {
      for (const i of [2, 3]) await page.getByLabel('').nth(i).click({ timeout: 2000 }).catch(() => {});
      campo = page.getByRole('searchbox').first();
    }
    await campo.fill(termo);
    await page.getByRole('button', { name: 'Buscar' }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const linhas = page.getByRole('row').filter({ hasText: new RegExp(esc(termo), 'i') });
    const n = await linhas.count();
    log(`${n} linha(s) para "${termo}".`);
    let achada = null;
    for (let i = 0; i < n; i++) {
      if (norm(await linhas.nth(i).innerText().catch(() => '')).includes(alvo)) { achada = linhas.nth(i); break; }
    }
    if (!achada && n === 1) achada = linhas.first();
    if (!achada) continue;
    let acessar = achada.getByRole('link', { name: 'Acessar' }).first();
    if (!(await acessar.count())) {
      await achada.getByRole('cell').first().click().catch(() => {});
      acessar = achada.getByRole('link', { name: 'Acessar' }).first();
    }
    if (!(await acessar.count())) continue;
    log('Clicando em Acessar…');
    await acessar.click();
    await page.waitForLoadState('domcontentloaded');
    return;
  }
  throw new Error(`Credenciado não encontrado: ${nome}`);
}

async function baixar(it, destino) {
  log(`OS ${it.os}: /provider_orders → buscando…`);
  await page.goto(`${BASE}/provider_orders`, { waitUntil: 'domcontentloaded' });
  const campo = page.locator('input[name="order_id"]');
  await campo.waitFor();
  await campo.fill(it.os);
  await page.getByRole('button', { name: 'Buscar' }).first().click();
  const link = page.getByRole('link', { name: it.os }).first();
  await link.waitFor({ timeout: 20000 }).catch(() => { throw new Error('ordem não encontrada nesse credenciado'); });
  log(`OS ${it.os}: abrindo a ordem…`);
  await link.click();
  await page.getByText(/Ordem de Serviço:/).first().waitFor();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  log(`OS ${it.os}: imprimindo em PDF (Ctrl+P)…`);
  const { data } = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(data, 'base64'));
  log(`OS ${it.os}: salvo → ${path.relative(saida, destino)}`);
}

const falhas = [];
let ok = 0;
try {
  await garantirLogin();
  for (const [cred, lista] of grupos) {
    log(`── Credenciado: ${cred} (${lista.length} ordem(ns))`);
    const caminho = (it) => path.join(saida, pasta(it.secretaria), pasta(it.setor), `OS_${it.os}.pdf`);
    const faltam = lista.filter((it) => !fs.existsSync(caminho(it)));
    ok += lista.length - faltam.length;
    if (!faltam.length) { log('Todas já baixadas, pulando.'); continue; }
    try { await voltarAoAdmin(); await acessarCredenciado(cred); }
    catch (e) { log('ERRO: ' + e.message); faltam.forEach((it) => falhas.push(`${it.os} | ${cred} | ${e.message}`)); continue; }
    for (const it of faltam) {
      try { await baixar(it, caminho(it)); ok++; }
      catch (e) { log(`OS ${it.os}: FALHOU — ${e.message}`); falhas.push(`${it.os} | ${cred} | ${e.message}`); }
    }
  }
} finally {
  if (falhas.length) { fs.mkdirSync(saida, { recursive: true }); fs.writeFileSync(path.join(saida, 'ORDENS_NAO_BAIXADAS.txt'), falhas.join('\n')); }
  log(`Fim: ${ok} baixada(s), ${falhas.length} falha(s). Pasta: ${saida}`);
  await ctx.close();
}
