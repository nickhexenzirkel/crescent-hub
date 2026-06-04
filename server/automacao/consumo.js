import { chromium } from 'playwright';
import { login, selecionarOrganizacao, downloadRelatorioConsumo } from './7beneficios.js';

/**
 * Executa o download dos Relatórios de Consumo para cada secretaria.
 * Chama `emit(event)` com eventos { type, ... } conforme o progresso.
 *
 * Eventos emitidos:
 *   { type: 'log',  level: 'info'|'ok'|'error'|'normal', text: string }
 *   { type: 'pdf',  folder: string, filename: string, base64: string }
 *   { type: 'done', total: number }
 *   { type: 'error', text: string }
 */
export async function executarDownloadConsumo(params, emit) {
  const { username, password, startDate, endDate, category, downloadItems, orgName } = params;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  try {
    emit({ type: 'log', level: 'info', text: 'Iniciando navegador headless...' });
    await login(page, username, password);
    emit({ type: 'log', level: 'ok', text: 'Login realizado.' });

    await selecionarOrganizacao(page, orgName);
    emit({ type: 'log', level: 'info', text: `Organização selecionada: ${orgName}` });

    let total = 0;
    for (const item of downloadItems) {
      const label = item.setor ? `${item.clienteStr} — ${item.setor}` : item.clienteStr;
      const folder = item.setor
        ? `${extractSecretaria(item.clienteStr)} - ${item.setor}`
        : extractSecretaria(item.clienteStr);

      emit({ type: 'log', level: 'normal', text: `Baixando RC: ${label}...` });
      try {
        const buf = await downloadRelatorioConsumo(page, { ...item, startDate, endDate, category });
        const filename = `trans_${folder}.pdf`;
        emit({ type: 'pdf', folder, filename, base64: buf.toString('base64') });
        emit({ type: 'log', level: 'ok', text: `  ✓ ${filename}` });
        total++;
      } catch (err) {
        emit({ type: 'log', level: 'error', text: `  ✗ Erro em "${label}": ${err.message}` });
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
