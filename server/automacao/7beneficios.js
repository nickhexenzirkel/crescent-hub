/**
 * Funções base de automação do 7Benefícios via Playwright.
 * Ajuste os seletores conforme o seu script antigo.
 */

const BASE_URL = 'https://app.7beneficios.com.br'; // ajuste se necessário

export async function login(page, username, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="username"], input[type="text"]', username);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await page.waitForNavigation({ waitUntil: 'networkidle' });
}

export async function selecionarOrganizacao(page, orgName) {
  // Navega até a aba Organizações e seleciona a org pelo nome exato
  await page.click('a:has-text("Organizações"), [href*="organizacoes"]');
  await page.waitForSelector('table, .org-list');
  await page.click(`text="${orgName}"`);
  await page.waitForLoadState('networkidle');
}

/**
 * Baixa um Relatório de Consumo (transações) para uma secretaria/setor.
 * Retorna o conteúdo do PDF como Buffer.
 */
export async function downloadRelatorioConsumo(page, { clienteStr, setor, startDate, endDate, category }) {
  // Navega até Relatórios > Consumo (ou Transações)
  await page.click('a:has-text("Relatórios"), a:has-text("Transações")');
  await page.waitForSelector('.relatorio-form, form');

  // Seleciona o cliente/secretaria
  const clienteInput = page.locator('input[placeholder*="cliente"], input[placeholder*="secretaria"], select[name="cliente"]');
  await clienteInput.fill(clienteStr);
  await page.click(`text="${clienteStr}"`).catch(() => {});

  // Setor (se houver)
  if (setor) {
    const setorInput = page.locator('input[placeholder*="setor"], select[name="setor"]');
    await setorInput.fill(setor).catch(() => {});
    await page.click(`text="${setor}"`).catch(() => {});
  }

  // Datas
  await page.fill('input[name="dataInicio"], input[placeholder*="início"]', startDate);
  await page.fill('input[name="dataFim"], input[placeholder*="fim"]', endDate);

  // Categoria (combustível ou manutenção)
  if (category === 'fuel') {
    await page.click('label:has-text("Combustível"), option:has-text("Combustível")').catch(() => {});
  } else {
    await page.click('label:has-text("Manutenção"), option:has-text("Manutenção")').catch(() => {});
  }

  // Gera o relatório e aguarda o PDF
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Gerar"), button:has-text("Baixar"), button:has-text("Download")'),
  ]);

  const buffer = Buffer.from(await (await download.createReadStream()).read());
  return buffer;
}

/**
 * Baixa o PDF de uma Ordem de Serviço pelo ID.
 * Retorna o conteúdo do PDF como Buffer.
 */
export async function downloadOrdemServico(page, { osId, cliente, setor }) {
  // Navega até Ordens de Serviço
  await page.click('a:has-text("Ordens de Serviço"), a:has-text("OS")');
  await page.waitForSelector('.os-search, input[placeholder*="OS"], input[placeholder*="ordem"]');

  // Busca pelo ID da OS
  await page.fill('input[placeholder*="OS"], input[name="osId"], input[placeholder*="ID"]', String(osId));
  await page.click('button:has-text("Buscar"), button[type="submit"]');
  await page.waitForSelector(`text="${osId}"`);

  // Clica na OS encontrada
  await page.click(`tr:has-text("${osId}") button:has-text("PDF"), tr:has-text("${osId}") a:has-text("Baixar")`);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(`tr:has-text("${osId}") button:has-text("PDF"), tr:has-text("${osId}") a:has-text("Baixar")`).catch(() => {}),
  ]);

  const buffer = Buffer.from(await (await download.createReadStream()).read());
  return buffer;
}
