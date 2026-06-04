// ═══════════════════════════════════════════════════════════
// UNIKO FATURAMENTO — Background Service Worker
// Automação do sistema 7Benefícios via Chrome Extension API
// ═══════════════════════════════════════════════════════════

const BASE = 'https://app.7beneficiosgestao.com.br';

/* ── Helpers ─────────────────────────────────────────────── */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const normStr = (s) =>
  String(s || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();

// Espera uma aba terminar de carregar
function waitForLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timeout aguardando página carregar'));
    }, timeout);

    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Navega para uma URL e aguarda carregar
async function goto(tabId, url) {
  const p = waitForLoad(tabId);
  await chrome.tabs.update(tabId, { url });
  await p;
}

// Executa uma função na aba e retorna o resultado
async function exec(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return results[0]?.result;
}

/* ── Automação principal ─────────────────────────────────── */

async function runConsumoDownload(data, callerTabId) {
  const { username, password, startDate, endDate, category, downloadItems, orgName } = data;
  const logs = [];

  const log = async (text, type = 'normal') => {
    const entry = { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type };
    logs.push(entry);
    try { await chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: entry }); } catch {}
  };

  let tabId = null;

  try {
    // ── Abre tab do 7Benefícios ──
    await log('Abrindo 7Benefícios...');
    const tab = await chrome.tabs.create({ url: `${BASE}/sessions/new`, active: true });
    tabId = tab.id;
    await waitForLoad(tabId);

    // ── Login ──
    await log('Fazendo login...');
    await exec(tabId, (user, pass) => {
      // Preenche os campos pelo texto do label ou pelo tipo do input
      const inputs = [...document.querySelectorAll('input')];
      const userField = inputs.find(i =>
        i.type === 'text' || i.type === 'email' || i.name?.toLowerCase().includes('login') ||
        i.name?.toLowerCase().includes('user') || i.id?.toLowerCase().includes('user') ||
        i.placeholder?.toLowerCase().includes('usuário') || i.placeholder?.toLowerCase().includes('usuario')
      ) || inputs.find(i => i.type !== 'password' && i.type !== 'hidden' && i.type !== 'submit');
      const passField = inputs.find(i => i.type === 'password');

      if (userField) { userField.value = user; userField.dispatchEvent(new Event('input', { bubbles: true })); userField.dispatchEvent(new Event('change', { bubbles: true })); }
      if (passField) { passField.value = pass; passField.dispatchEvent(new Event('input', { bubbles: true })); passField.dispatchEvent(new Event('change', { bubbles: true })); }

      const btn = document.querySelector('button[type="submit"], input[type="submit"]')
                || document.querySelector('button');
      btn?.click();
    }, [username, password]);

    await waitForLoad(tabId);
    await sleep(1000);

    const urlAfterLogin = await exec(tabId, () => window.location.href);
    if (urlAfterLogin.includes('sessions/new') || urlAfterLogin.includes('sessions')) {
      await log('Login falhou. Verifique usuário e senha.', 'error');
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: 'Login falhou' }).catch(() => {});
      chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    await log('Login realizado.', 'ok');

    // ── Carrega lista de organizações (scroll infinito) ──
    await log('Carregando organizações...');
    await goto(tabId, `${BASE}/organizations`);
    await sleep(2000);

    const orgMap = await exec(tabId, async () => {
      const map = {};
      let lastCount = 0;
      let noChange = 0;

      while (noChange < 3) {
        document.querySelectorAll('table tbody tr').forEach(row => {
          // Junta o texto de todas as células da linha — assim o nome é
          // capturado mesmo que o número e o nome estejam em colunas separadas
          const name = [...row.querySelectorAll('td')]
            .map(td => td.textContent.trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          const uuid = [...row.querySelectorAll('a[href]')]
            .map(a => a.getAttribute('href').match(/organizations\/([a-f0-9-]{36})/)?.[1])
            .find(Boolean);
          if (name && uuid) map[name] = uuid;
        });

        const count = Object.keys(map).length;
        if (count === lastCount) noChange++;
        else { noChange = 0; lastCount = count; }

        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 900));
      }
      return map;
    });

    await log(`${Object.keys(orgMap).length} organizações carregadas.`);

    // ── Encontra UUID da organização ──
    // Estratégia 1: usa o nome exato informado pelo usuário
    // Estratégia 2: fallback automático pelo cliente do XLSX
    const exCliente = downloadItems[0]?.clienteStr || '';
    const parts     = exCliente.split(' - ');
    const munFull   = parts[parts.length - 1]?.trim() || '';
    const city      = parts[1]?.trim() || '';

    // "core" = texto normalizado sem o código numérico inicial (ex.: "30 - ")
    const stripCode = (s) => normStr(s).replace(/^\d+\s*[-–—]?\s*/, '').trim();

    const rawTerms = orgName?.trim() ? [orgName] : [munFull, city].filter(Boolean);
    const searchTerms = [...new Set(
      rawTerms.flatMap(t => [normStr(t), stripCode(t)]).filter(Boolean)
    )];

    let orgUUID = null, foundOrgName = '';
    for (const [name, uuid] of Object.entries(orgMap)) {
      const n    = normStr(name);
      const core = stripCode(name);
      const hit = searchTerms.some(t =>
        n === t || n.includes(t) ||           // nome contém o termo
        (core && core.includes(t)) ||          // nome sem código contém o termo
        (t.length > 3 && t.includes(core) && core.length > 3) // termo contém o nome sem código
      );
      if (hit) { orgUUID = uuid; foundOrgName = name; break; }
    }

    if (!orgUUID) {
      const tried = orgName?.trim() || munFull;
      // Mostra nomes parecidos (qualquer palavra do termo em comum) para diagnóstico
      const words = stripCode(tried).split(' ').filter(w => w.length > 3);
      const near = Object.keys(orgMap)
        .filter(name => words.some(w => normStr(name).includes(w)))
        .slice(0, 5);
      await log(`Organização "${tried}" não encontrada na lista. Verifique o nome exato na aba Organizações do 7Benefícios.`, 'error');
      if (near.length) await log(`Nomes parecidos lidos: ${near.join(' | ')}`, 'error');
      else await log(`Exemplos lidos: ${Object.keys(orgMap).slice(0, 3).join(' | ')}`, 'error');
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {});
      chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    await log(`Organização: ${foundOrgName}`, 'ok');

    // ── Processa cada secretaria/setor ──
    let downloaded = 0;

    for (const { clienteStr, setor } of downloadItems) {
      const p       = String(clienteStr).split(' - ');
      const secNome = p[2]?.trim() || clienteStr;
      const label   = setor ? `${secNome} / ${setor}` : secNome;

      await log(`Processando: ${label}...`);

      try {
        // Navega para a página de relatórios com datas e categoria
        const baseParams = new URLSearchParams({
          category, status: 'authorized',
          starting_date: startDate, ending_date: endDate,
        });
        await goto(tabId, `${BASE}/organizations/${orgUUID}/transactions_report?${baseParams}`);
        await sleep(1500);

        // Lê opções do dropdown de cliente
        const clientOpts = await exec(tabId, () => {
          const sel = document.querySelector('.select select') || document.querySelector('select');
          return sel ? [...sel.options].map(o => ({ value: o.value, text: o.text.trim() })) : [];
        });

        const nSec  = normStr(secNome);
        const match = clientOpts.find(o => normStr(o.text).includes(nSec));

        if (!match?.value) {
          await log(`Secretaria não encontrada no sistema: ${secNome}`, 'error');
          continue;
        }

        // Seleciona cliente
        await exec(tabId, (val) => {
          const sel = document.querySelector('.select select') || document.querySelector('select');
          if (sel) { sel.value = val; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        }, [match.value]);
        await sleep(700);

        // Seleciona setor (se houver)
        let divisionId = '';
        if (setor) {
          const divOpts = await exec(tabId, () => {
            const sel = document.querySelector('select[name="division_id"]');
            return sel ? [...sel.options].map(o => ({ value: o.value, text: o.text.trim() })) : [];
          });
          const nSetor  = normStr(setor);
          const divMatch = divOpts.find(o => o.value && normStr(o.text).includes(nSetor));
          if (divMatch?.value) {
            await exec(tabId, (val) => {
              const sel = document.querySelector('select[name="division_id"]');
              if (sel) { sel.value = val; sel.dispatchEvent(new Event('change', { bubbles: true })); }
            }, [divMatch.value]);
            divisionId = divMatch.value;
            await sleep(400);
          }
        }

        // Navega para URL final com todos os filtros
        const allParams = new URLSearchParams({
          client_id: match.value, provider_id: '',
          division_id: divisionId, category, product_id: '',
          status: 'authorized',
          starting_date: startDate, ending_date: endDate,
          license_plate: '',
        });
        await goto(tabId, `${BASE}/organizations/${orgUUID}/transactions_report?${allParams}`);
        await sleep(1500);

        // Verifica se há dados e clica em "Extrair Relatório"
        const hasBtn = await exec(tabId, () =>
          [...document.querySelectorAll('a')].some(a => a.textContent.trim().includes('Extrair Relatório'))
        );

        if (!hasBtn) {
          await log(`Sem resultados para: ${label}`, 'normal');
          continue;
        }

        // Fecha popups que abrirem (o PDF baixa automaticamente no Downloads)
        const popupListener = (newTab) => {
          if (newTab.openerTabId === tabId) {
            setTimeout(() => chrome.tabs.remove(newTab.id).catch(() => {}), 3000);
            chrome.tabs.onCreated.removeListener(popupListener);
          }
        };
        chrome.tabs.onCreated.addListener(popupListener);

        await exec(tabId, () => {
          const btn = [...document.querySelectorAll('a')]
            .find(a => a.textContent.trim().includes('Extrair Relatório'));
          btn?.click();
        });

        await sleep(2500);
        chrome.tabs.onCreated.removeListener(popupListener);

        downloaded++;
        await log(`✓ Baixado: ${label}`, 'ok');

      } catch (err) {
        await log(`Erro em "${label}": ${err.message}`, 'error');
      }
    }

    // ── Concluído ──
    await log(`Concluído! ${downloaded}/${downloadItems.length} PDF(s) salvo(s) na pasta Downloads.`, 'ok');
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_DONE', total: downloaded }).catch(() => {});

    setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 3000);

  } catch (err) {
    try { await chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: { text: `Erro inesperado: ${err.message}`, type: 'error' } }); } catch {}
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: err.message }).catch(() => {});
    if (tabId) setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 2000);
  }
}

/* ── Listener de mensagens ───────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'UNIKO_FAT_START') {
    const callerTabId = sender.tab?.id;
    if (callerTabId) runConsumoDownload(message.data, callerTabId);
  }
});
