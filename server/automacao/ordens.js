import { chromium } from 'playwright';
import { login, selecionarOrganizacao, downloadOrdemServico } from './7beneficios.js';

/**
 * Executa o download das Ordens de Serviço.
 * Mesma interface de emissão de eventos que consumo.js.
 */
export async function executarDownloadOrdens(params, emit) {
  const { username, password, orgName, items } = params;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  try {
    emit({ type: 'log', level: 'info', text: 'Iniciando navegador headless (OS)...' });
    await login(page, username, password);
    emit({ type: 'log', level: 'ok', text: 'Login realizado.' });

    await selecionarOrganizacao(page, orgName);
    emit({ type: 'log', level: 'info', text: `Organização: ${orgName}` });

    let total = 0;
    for (const item of items) {
      const secretaria = extractSecretaria(item.cliente);
      const folder = item.setor ? `${secretaria} - ${item.setor}` : secretaria;

      emit({ type: 'log', level: 'normal', text: `Baixando OS #${item.osId} — ${folder}...` });
      try {
        const buf = await downloadOrdemServico(page, item);
        const filename = `os_${item.osId}.pdf`;
        emit({ type: 'pdf', folder, filename, base64: buf.toString('base64') });
        emit({ type: 'log', level: 'ok', text: `  ✓ ${filename}` });
        total++;
      } catch (err) {
        emit({ type: 'log', level: 'error', text: `  ✗ OS #${item.osId}: ${err.message}` });
      }
    }

    emit({ type: 'done', total });
  } catch (err) {
    emit({ type: 'error', text: `Erro geral: ${err.message}` });
  } finally {
    await browser.close();
  }
}

function extractSecretaria(clienteStr) {
  const parts = String(clienteStr).split(' - ');
  return parts.length >= 3 ? parts[2].trim() : String(clienteStr).trim();
}
