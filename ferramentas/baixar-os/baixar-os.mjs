// Baixar Ordens de Serviço da Wowlet — roda no SEU PC (a Wowlet pede captcha,
// que o servidor não passa). Uso:  node baixar-os.mjs "planilha.xlsx" [pasta-de-saida]
// Abre o Chrome: você faz login (e o captcha) UMA vez; o resto é automático.
// Saída: <pasta>/<Secretaria>/<Setor>/OS_<id>.pdf   (ordens já baixadas são puladas)
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://app.7beneficiosgestao.com.br';
const planilha = process.argv.slice(2).filter((a) => !a.startsWith('--'))[0];
const args = process.argv.slice(2);
const filtroCred = (args.find((a) => a.startsWith('--credenciado=')) || '').split('=')[1] || '';   // ex: --credenciado=jbc (só testa esse)
const posicionais = args.filter((a) => !a.startsWith('--'));
const saida = path.resolve(posicionais[1] || 'Ordens de Servico');
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
if (filtroCred) {
  const f = norm(filtroCred);
  for (let i = itens.length - 1; i >= 0; i--) if (!norm(itens[i].credenciado).includes(f)) itens.splice(i, 1);
  log(`Filtro --credenciado=${filtroCred}: só esse credenciado.`);
}
log(`${itens.length} ordem(ns) para baixar.`);
const grupos = new Map();
for (const it of itens) { if (!grupos.has(it.credenciado)) grupos.set(it.credenciado, []); grupos.get(it.credenciado).push(it); }

const ctx = await chromium.launchPersistentContext(path.resolve('perfil-chrome'), {
  channel: 'chrome', headless: false, slowMo: 350, acceptDownloads: true, viewport: null, args: ['--start-maximized'],
});
const page = ctx.pages()[0] || await ctx.newPage();
page.setDefaultTimeout(30000);

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

/** Abre a lista de credenciados (/providers). Se ainda estiver dentro de um credenciado, sai primeiro. */
async function voltarAoAdmin() {
  await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (!logado()) { await garantirLogin(); await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' }); }
  if (await page.getByRole('link', { name: 'Acessar' }).first().isVisible({ timeout: 6000 }).catch(() => false)) return;
  log('Parece que ainda estou dentro de um credenciado — saindo (logout)…');
  await sairDoCredenciado();
  await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' });
  if (!logado()) { await garantirLogin(); await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' }); }
  if (!(await page.getByRole('link', { name: 'Acessar' }).first().isVisible({ timeout: 8000 }).catch(() => false))) throw new Error('Não consegui abrir a lista de credenciados (/providers).');
}

/** Clica em Logout (sai do acesso do credenciado). Se o botão estiver num menu, abre o menu antes. */
async function sairDoCredenciado() {
  const achar = () => page.locator('a[href="/impersonations"][data-method="delete"], a[data-to="/impersonations"]').or(page.getByRole('link', { name: /log ?out|sair|desconectar/i })).or(page.getByRole('button', { name: /log ?out|sair|desconectar/i })).first();
  let el = achar();
  if (!(await el.isVisible({ timeout: 2000 }).catch(() => false))) {
    const menus = page.locator('[data-bs-toggle="dropdown"], .dropdown-toggle, [aria-haspopup="true"]');
    const n = await menus.count();
    for (let i = n - 1; i >= 0 && !(await achar().isVisible({ timeout: 500 }).catch(() => false)); i--) {
      await menus.nth(i).click({ timeout: 2000 }).catch(() => {});
    }
    el = achar();
  }
  if (!(await el.isVisible({ timeout: 3000 }).catch(() => false))) {
    // o Logout fica no menu do usuário (link com o nome, ex.: "nicolas2 (c)")
    const menuUsuario = page.getByRole('link', { name: /\([a-z]\)\s*$/i }).first();
    if (await menuUsuario.count()) {
      log('Abrindo o menu do usuário (' + (await menuUsuario.innerText()).trim() + ')…');
      await menuUsuario.click().catch(() => {});
      await page.waitForTimeout(1200);
      el = achar();
    }
  }
  if (!(await el.isVisible({ timeout: 3000 }).catch(() => false))) {
    const links = (await page.getByRole('link').allInnerTexts().catch(() => [])).map((t) => t.trim()).filter(Boolean).slice(0, 30);
    const botoes = (await page.getByRole('button').allInnerTexts().catch(() => [])).map((t) => t.trim()).filter(Boolean).slice(0, 30);
    log(`Não achei o Logout. Página: ${page.url()}
   Links: ${links.join(' | ')}
   Botões: ${botoes.join(' | ')}`);
    throw new Error('Não achei o botão de Logout.');
  }
  log('Clicando em ' + ((await el.innerText().catch(() => 'Logout')).trim() || 'Logout') + '…');
  await el.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  log(`Saí do credenciado (página: ${page.url()}).`);
}

async function acessarCredenciado(nome) {
  const alvo = norm(nome);
  const pal = nome.trim().split(/\s+/);
  // o campo é autocompletar: começa por poucas letras (como "jbc") e depois escolhe a opção certa na lista
  const termos = [...new Set([pal[0].length >= 3 ? pal[0] : pal.slice(0, 2).join(' '), nome.split(' - ')[0].trim(), nome.trim()])].filter(Boolean);
  for (const termo of termos) {
    log(`Credenciados → pesquisando "${termo}"…`);
    await page.goto(`${BASE}/providers`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // gravação: 1º clique = Razão Social, 2º clique = Nome Fantasia (é nele que se digita)
    log('Clicando no campo Razão Social…');
    await page.getByLabel('').nth(2).click({ timeout: 10000 }).catch((e) => log('(aviso) ' + String(e.message).slice(0, 120)));
    await page.waitForTimeout(900);
    log('Clicando no campo Nome Fantasia…');
    await page.getByLabel('').nth(3).click({ timeout: 10000 }).catch((e) => log('(aviso) ' + String(e.message).slice(0, 120)));
    await page.waitForTimeout(900);
    log(`Digitando "${termo}" devagar…`);
    await page.keyboard.press('Control+a');
    await page.keyboard.type(termo, { delay: 110 });
    await page.waitForTimeout(2000);
    // aparecem opções abaixo do campo: clica na que bate com o credenciado
    const opcoes = page.getByRole('option').or(page.locator('ul li:visible, .dropdown-item:visible, [class*="autocomplete"] *:visible, [class*="suggest"] *:visible, [class*="option"]:visible')).filter({ hasText: new RegExp(esc(termo.split(/\s+/)[0]), 'i') });
    const qtd = await opcoes.count();
    const textos = [];
    for (let i = 0; i < Math.min(qtd, 12); i++) textos.push((await opcoes.nth(i).innerText().catch(() => '')).trim().replace(/\s+/g, ' '));
    log(`Opções que apareceram (${qtd}): ${textos.join(' | ') || 'nenhuma'}`);
    let idx = -1;
    for (let i = 0; i < textos.length; i++) {
      const t = norm(textos[i]);
      if (t && (t.includes(alvo) || alvo.includes(t))) { idx = i; break; }
    }
    if (idx < 0 && qtd) idx = 0;
    if (idx >= 0) {
      const opcao = opcoes.nth(idx);
      log('Clicando na opção "' + textos[idx] + '"…');
      await opcao.click().catch((e) => log('(aviso) ' + String(e.message).slice(0, 120)));
      await page.waitForTimeout(1500);
    }
    log('Clicando em Buscar…');
    await page.getByRole('button', { name: 'Buscar' }).first().click();
    log('Esperando a lista carregar…');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const linhas = page.getByRole('row').filter({ hasText: new RegExp(esc(termo), 'i') });
    await linhas.first().waitFor({ timeout: 12000 }).catch(() => {});
    const n = await linhas.count();
    log(`${n} linha(s) para "${termo}".`);
    let achada = null;
    for (let i = 0; i < n; i++) {
      if (norm(await linhas.nth(i).innerText().catch(() => '')).includes(alvo)) { achada = linhas.nth(i); break; }
    }
    if (!achada && n === 1) achada = linhas.first();
    if (!achada) continue;
    log('Clicando na linha do credenciado…');
    await achada.scrollIntoViewIfNeeded().catch(() => {});
    await achada.getByRole('cell').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const acessar = achada.getByRole('link', { name: 'Acessar' }).first();
    if (!(await acessar.count())) continue;
    log('Clicando em Acessar…');
    await acessar.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    await acessar.click();
    await page.waitForTimeout(2000);
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
  await page.bringToFront();
  await page.waitForTimeout(1500);
  let data = null;
  for (let t = 1; t <= 3 && !data; t++) {
    const cdp = await ctx.newCDPSession(page);   // sessão nova a cada impressão (a antiga pode ficar inválida)
    try { ({ data } = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })); }
    catch (e) {
      if (/closed/i.test(e.message)) throw e;
      log(`OS ${it.os}: impressão falhou (tentativa ${t}/3): ${String(e.message).slice(0, 80)} — esperando e tentando de novo…`);
      await page.waitForTimeout(3000);
      if (t === 2) { await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(2000); }
    } finally { await cdp.detach().catch(() => {}); }
  }
  if (!data) throw new Error('o Chrome não conseguiu imprimir a página');
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
      catch (e) {
        log(`OS ${it.os}: FALHOU — ${e.message}`); falhas.push(`${it.os} | ${cred} | ${e.message}`);
        if (/has been closed/i.test(e.message)) { log('A janela do Chrome foi fechada — encerrando.'); throw e; }
      }
    }
    try { await sairDoCredenciado(); } catch (e) { log('Aviso no logout: ' + e.message); }
  }
} finally {
  if (falhas.length) { fs.mkdirSync(saida, { recursive: true }); fs.writeFileSync(path.join(saida, 'ORDENS_NAO_BAIXADAS.txt'), falhas.join('\n')); }
  log(`Fim: ${ok} baixada(s), ${falhas.length} falha(s). Pasta: ${saida}`);
  await ctx.close().catch(() => {});
}
