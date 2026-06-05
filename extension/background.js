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

/* ── Nome do arquivo: trans_SECRETARIA_SETOR ──────────────── */
// Remove código inicial ("30 - ") e qualquer trecho de município
const stripNoise = (s) =>
  normStr(s)
    .replace(/^\d+\s*[-–—]\s*/, '')                          // "30 - "
    .replace(/\s*[-–—]?\s*MUNIC[IÍ]PIO\s+D[EO]\b.*$/, '')    // "- MUNICIPIO DE ..." até o fim
    .replace(/\s*[-–—]\s*/g, ' ')                            // hífens soltos
    .replace(/\s+/g, ' ')
    .trim();

// Remove prefixos "SECRETARIA (MUNICIPAL) DE/DA/DO/DOS/DAS"
const stripSecPrefix = (s) =>
  s.replace(/^SECRETARIA\s+(MUNICIPAL\s+)?(DE|DA|DO|DOS|DAS)\s+/, '')
   .replace(/^SECRETARIA\s+(MUNICIPAL\s+)?/, '')
   .trim();

// Remove caracteres inválidos em nomes de arquivo (Windows/macOS/Linux)
const fsClean = (s) =>
  s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();

// Monta "trans_SECRETARIA_SETOR" limitado a 75 caracteres (sem extensão)
function buildFileName(secNome, setor) {
  const sec  = fsClean(stripSecPrefix(stripNoise(secNome)));
  const setS = fsClean(stripNoise(setor));
  let base = setS ? `trans_${sec}_${setS}` : `trans_${sec}`;
  if (base.length > 75) base = base.slice(0, 75).trim();
  return `${base}.pdf`;
}

/* ── Gravação de arquivo na pasta escolhida (File System Access) ─ */
// A pasta vive na página; o background envia os bytes e aguarda confirmação.
const pendingSaves = {};
let saveCounter = 0;

function saveToFolder(callerTabId, filename, base64, subfolder = '') {
  return new Promise((resolve) => {
    const id = ++saveCounter;
    pendingSaves[id] = resolve;
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_SAVE_FILE', id, filename, base64, subfolder }).catch(() => {});
    setTimeout(() => {
      if (pendingSaves[id]) { delete pendingSaves[id]; resolve({ ok: false, error: 'timeout' }); }
    }, 30000);
  });
}

// Busca o PDF dentro da aba do 7Benefícios (usa os cookies da sessão) → base64
async function fetchPdfBase64(tabId, url) {
  return exec(tabId, async (href) => {
    try {
      const res = await fetch(href, { credentials: 'same-origin' });
      const ct  = res.headers.get('content-type') || '';
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return { ok: true, b64: btoa(binary), ct, size: bytes.length };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }, [url]);
}

// Espera uma aba terminar de carregar.
// Resolve com true se carregou, false se estourou o tempo (nunca rejeita,
// para não derrubar a automação por uma página lenta).
function waitForLoad(tabId, timeout = 45000) {
  return new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeout);
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') done(true);
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

// Cria a função de log que envia cada linha para a página
const mkLog = (callerTabId) => async (text, type = 'normal') => {
  const entry = { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type };
  try { await chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: entry }); } catch {}
};

// Faz login no 7Benefícios. Retorna true se logou com sucesso.
async function doLogin(tabId, username, password) {
  await exec(tabId, (user, pass) => {
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
  const url = await exec(tabId, () => window.location.href);
  return !url.includes('sessions');
}

// Carrega a lista de organizações e encontra a UUID pelo nome informado
// (ou pelo cliente de exemplo do XLSX). Retorna { orgUUID, foundOrgName } ou null.
async function findOrg(tabId, orgName, sampleCliente, log) {
  await goto(tabId, `${BASE}/organizations`);
  await sleep(2000);

  const orgMap = await exec(tabId, async () => {
    const map = {};
    let lastCount = 0, noChange = 0;
    while (noChange < 3) {
      document.querySelectorAll('table tbody tr').forEach(row => {
        const name = [...row.querySelectorAll('td')]
          .map(td => td.textContent.trim()).filter(Boolean)
          .join(' ').replace(/\s+/g, ' ').trim();
        const uuid = [...row.querySelectorAll('a[href]')]
          .map(a => a.getAttribute('href').match(/organizations\/([a-f0-9-]{36})/)?.[1])
          .find(Boolean);
        if (name && uuid) map[name] = uuid;
      });
      const count = Object.keys(map).length;
      if (count === lastCount) noChange++; else { noChange = 0; lastCount = count; }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 900));
    }
    return map;
  });

  await log(`${Object.keys(orgMap).length} organizações carregadas.`);

  const parts   = String(sampleCliente || '').split(' - ');
  const munFull = parts[parts.length - 1]?.trim() || '';
  const city    = parts[1]?.trim() || '';
  const stripCode = (s) => normStr(s).replace(/^\d+\s*[-–—]?\s*/, '').trim();

  const rawTerms = orgName?.trim() ? [orgName] : [munFull, city].filter(Boolean);
  const searchTerms = [...new Set(
    rawTerms.flatMap(t => [normStr(t), stripCode(t)]).filter(Boolean)
  )];

  for (const [name, uuid] of Object.entries(orgMap)) {
    const n = normStr(name), core = stripCode(name);
    const hit = searchTerms.some(t =>
      n === t || n.includes(t) ||
      (core && core.includes(t)) ||
      (t.length > 3 && t.includes(core) && core.length > 3)
    );
    if (hit) return { orgUUID: uuid, foundOrgName: name };
  }

  const tried = orgName?.trim() || munFull;
  const words = stripCode(tried).split(' ').filter(w => w.length > 3);
  const near = Object.keys(orgMap)
    .filter(name => words.some(w => normStr(name).includes(w))).slice(0, 5);
  await log(`Organização "${tried}" não encontrada na lista. Verifique o nome exato na aba Organizações do 7Benefícios.`, 'error');
  if (near.length) await log(`Nomes parecidos lidos: ${near.join(' | ')}`, 'error');
  else await log(`Exemplos lidos: ${Object.keys(orgMap).slice(0, 3).join(' | ')}`, 'error');
  return null;
}

async function runConsumoDownload(data, callerTabId) {
  const { username, password, startDate, endDate, category, downloadItems, orgName, useFolder } = data;
  const log = mkLog(callerTabId);
  let tabId = null;

  try {
    // ── Abre tab do 7Benefícios e faz login ──
    await log('Abrindo 7Benefícios...');
    const tab = await chrome.tabs.create({ url: `${BASE}/sessions/new`, active: false });
    tabId = tab.id;
    await waitForLoad(tabId);

    await log('Fazendo login...');
    if (!await doLogin(tabId, username, password)) {
      await log('Login falhou. Verifique usuário e senha.', 'error');
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: 'Login falhou' }).catch(() => {});
      chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    await log('Login realizado.', 'ok');

    // ── Encontra a organização ──
    await log('Carregando organizações...');
    const org = await findOrg(tabId, orgName, downloadItems[0]?.clienteStr, log);
    if (!org) {
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {});
      chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    const { orgUUID, foundOrgName } = org;
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

        const fileName = buildFileName(secNome, setor);

        // ── Caminho A: pasta escolhida (File System Access) ──
        // Busca o PDF como blob na própria aba e grava na pasta via página.
        let savedViaFolder = false;
        if (useFolder) {
          const href = await exec(tabId, () => {
            const a = [...document.querySelectorAll('a')]
              .find(a => a.textContent.trim().includes('Extrair Relatório'));
            return a ? a.href : '';
          });

          if (href) {
            const pdf = await fetchPdfBase64(tabId, href);
            const looksLikePdf = pdf?.ok && pdf.b64 &&
              (pdf.ct.includes('pdf') || pdf.ct.includes('octet-stream')) &&
              !pdf.ct.includes('html');
            if (looksLikePdf) {
              const res = await saveToFolder(callerTabId, fileName, pdf.b64);
              if (res?.ok) {
                savedViaFolder = true;
                downloaded++;
                await log(`✓ Salvo: ${fileName}`, 'ok');
              } else {
                await log(`Falha ao gravar "${fileName}" na pasta: ${res?.error || 'erro'}. Tentando Downloads...`, 'error');
              }
            } else {
              await log(`Não consegui baixar o PDF de "${label}" como arquivo (${pdf?.error || pdf?.ct || 'desconhecido'}). Tentando Downloads...`, 'error');
            }
          }
        }

        if (savedViaFolder) continue;

        // ── Caminho B (fallback): clique → download automático em Downloads ──
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
        await log(`✓ Baixado (Downloads): ${label}`, 'ok');

      } catch (err) {
        await log(`Erro em "${label}": ${err.message}`, 'error');
      }
    }

    // ── Concluído ──
    const destino = useFolder ? 'pasta "Uniko - Relatórios de Consumo"' : 'pasta Downloads';
    await log(`Concluído! ${downloaded}/${downloadItems.length} PDF(s) salvo(s) na ${destino}.`, 'ok');
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_DONE', total: downloaded }).catch(() => {});

    setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 3000);

  } catch (err) {
    try { await chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: { text: `Erro inesperado: ${err.message}`, type: 'error' } }); } catch {}
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: err.message }).catch(() => {});
    if (tabId) setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 2000);
  }
}

/* ── Automação: Ordens de Serviço ────────────────────────── */
// items: [{ osId, cliente, setor }] — uma OS por download, agrupadas por
// secretaria em subpastas. Sem período: busca por order_id e baixa o PDF.
async function runOrdensDownload(data, callerTabId) {
  const { username, password, orgName, useFolder, items } = data;
  const log = mkLog(callerTabId);
  let tabId = null;

  try {
    await log('Abrindo 7Benefícios...');
    const tab = await chrome.tabs.create({ url: `${BASE}/sessions/new`, active: false });
    tabId = tab.id;
    await waitForLoad(tabId);

    await log('Fazendo login...');
    if (!await doLogin(tabId, username, password)) {
      await log('Login falhou. Verifique usuário e senha.', 'error');
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: 'Login falhou' }).catch(() => {});
      chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    await log('Login realizado.', 'ok');

    await log('Carregando organizações...');
    const org = await findOrg(tabId, orgName, items[0]?.cliente, log);
    if (!org) {
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {});
      chrome.tabs.remove(tabId).catch(() => {});
      return;
    }
    const { orgUUID, foundOrgName } = org;
    await log(`Organização: ${foundOrgName}`, 'ok');

    let downloaded = 0;

    for (const { osId, cliente, setor } of items) {
      const sec      = String(cliente).split(' - ')[2]?.trim() || String(cliente).trim();
      const folder   = fsClean(`${sec}${setor ? ` - ${setor}` : ''}`);
      const fileName = `os_${fsClean(String(osId))}.pdf`;
      const label    = `OS ${osId} — ${sec}${setor ? ` / ${setor}` : ''}`;

      await log(`Processando: ${label}...`);

      try {
        const params = new URLSearchParams({
          order_id: osId, vehicle_id: '', provider_id: '', client_id: '',
          inserted_at_range: '', updated_at_range: '', service_type: '',
          repair_type: '', status: '', item_name: '',
        });
        await goto(tabId, `${BASE}/organizations/${orgUUID}/orders?${params}`);
        await sleep(1500);

        // Procura o link de download do PDF da OS
        const href = await exec(tabId, () => {
          const inBtns = document.querySelector('.buttons a[href]');
          if (inBtns) return inBtns.href;
          const a = [...document.querySelectorAll('a[href]')]
            .find(a => /\.pdf($|\?)|\/download|\/print|relatorio|report/i.test(a.href));
          return a ? a.href : '';
        });

        if (!href) {
          await log(`OS não encontrada ou sem PDF: ${osId}`, 'error');
          continue;
        }

        // ── Caminho A: pasta escolhida ──
        if (useFolder) {
          const pdf = await fetchPdfBase64(tabId, href);
          const looksLikePdf = pdf?.ok && pdf.b64 &&
            (pdf.ct.includes('pdf') || pdf.ct.includes('octet-stream')) &&
            !pdf.ct.includes('html');
          if (looksLikePdf) {
            const res = await saveToFolder(callerTabId, fileName, pdf.b64, folder);
            if (res?.ok) {
              downloaded++;
              await log(`✓ Salvo: ${folder}/${fileName}`, 'ok');
              continue;
            }
            await log(`Falha ao gravar "${fileName}": ${res?.error || 'erro'}. Tentando Downloads...`, 'error');
          } else {
            await log(`Não consegui baixar o PDF da OS ${osId} (${pdf?.error || pdf?.ct || '?'}). Tentando Downloads...`, 'error');
          }
        }

        // ── Caminho B (fallback): clique → Downloads ──
        const popupListener = (newTab) => {
          if (newTab.openerTabId === tabId) {
            setTimeout(() => chrome.tabs.remove(newTab.id).catch(() => {}), 3000);
            chrome.tabs.onCreated.removeListener(popupListener);
          }
        };
        chrome.tabs.onCreated.addListener(popupListener);
        await exec(tabId, () => {
          const b = document.querySelector('.buttons a[href]')
                 || document.querySelector('.buttons')
                 || [...document.querySelectorAll('a')].find(a => /\.pdf/i.test(a.href));
          b?.click();
        });
        await sleep(2500);
        chrome.tabs.onCreated.removeListener(popupListener);
        downloaded++;
        await log(`✓ Baixado (Downloads): ${label}`, 'ok');

      } catch (err) {
        await log(`Erro em "${label}": ${err.message}`, 'error');
      }
    }

    const destino = useFolder ? 'pasta "Uniko - Ordens de Serviço"' : 'pasta Downloads';
    await log(`Concluído! ${downloaded}/${items.length} OS salva(s) na ${destino}.`, 'ok');
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
  if (message.type === 'UNIKO_FAT_START_OS') {
    const callerTabId = sender.tab?.id;
    if (callerTabId) runOrdensDownload(message.data, callerTabId);
  }
  // Resposta da página após gravar (ou falhar ao gravar) um arquivo na pasta
  if (message.type === 'UNIKO_FAT_SAVE_RESULT') {
    const resolve = pendingSaves[message.id];
    if (resolve) { delete pendingSaves[message.id]; resolve(message); }
  }
});
