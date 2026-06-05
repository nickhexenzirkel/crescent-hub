// ═══════════════════════════════════════════════════════════
// UNIKO FATURAMENTO — Background Service Worker
// Automação 100% headless via fetch — sem abrir nenhuma aba
// ═══════════════════════════════════════════════════════════

const BASE = 'https://app.7beneficiosgestao.com.br';

/* ── String helpers ───────────────────────────────────────── */

const normStr = (s) =>
  String(s || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();

const stripNoise = (s) =>
  normStr(s)
    .replace(/^\d+\s*[-–—]\s*/, '')
    .replace(/\s*[-–—]?\s*MUNIC[IÍ]PIO\s+D[EO]\b.*$/, '')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s+/g, ' ').trim();

const stripSecPrefix = (s) =>
  s.replace(/^SECRETARIA\s+(MUNICIPAL\s+)?(DE|DA|DO|DOS|DAS)\s+/, '')
   .replace(/^SECRETARIA\s+(MUNICIPAL\s+)?/, '').trim();

const fsClean = (s) =>
  s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();

function buildFileName(secNome, setor) {
  const sec  = fsClean(stripSecPrefix(stripNoise(secNome)));
  const setS = fsClean(stripNoise(setor));
  let base = setS ? `trans_${sec}_${setS}` : `trans_${sec}`;
  if (base.length > 75) base = base.slice(0, 75).trim();
  return `${base}.pdf`;
}

/* ── Fetch helpers ────────────────────────────────────────── */

// Todas as requisições carregam os cookies da sessão automaticamente
const bf = (url, opts = {}) =>
  fetch(url, { credentials: 'include', ...opts });

async function getHtml(url) {
  const r = await bf(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.text();
}

// Resolve href relativo para URL absoluta
const absUrl = (href, base = BASE) =>
  href ? new URL(href, base).href : '';

// Extrai CSRF token do HTML (Rails meta tag ou input hidden)
function extractCsrf(html) {
  const m = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i)
         || html.match(/name="authenticity_token"[^>]*value="([^"]+)"/i);
  return m?.[1] || '';
}

/* ── Login ────────────────────────────────────────────────── */

async function fetchLogin(username, password) {
  const loginHtml = await getHtml(`${BASE}/sessions/new`);
  const csrf = extractCsrf(loginHtml);

  const res = await bf(`${BASE}/sessions`, {
    method:   'POST',
    redirect: 'follow',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      authenticity_token: csrf,
      'user[login]':      username,
      'user[password]':   password,
    }),
  });

  // Se ainda está em /sessions após o POST, login falhou
  return !res.url.includes('/sessions');
}

/* ── ArrayBuffer → base64 ────────────────────────────────── */

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/* ── Gravação na página (File System Access via conteúdo) ─── */

const pendingSaves = {};
let saveCounter = 0;

function saveToFolder(callerTabId, filename, base64, subfolder = '') {
  return new Promise((resolve) => {
    const id = ++saveCounter;
    pendingSaves[id] = resolve;
    chrome.tabs.sendMessage(callerTabId, {
      type: 'FAT_SAVE_FILE', id, filename, base64, subfolder,
    }).catch(() => {});
    setTimeout(() => {
      if (pendingSaves[id]) { delete pendingSaves[id]; resolve({ ok: false, error: 'timeout' }); }
    }, 30000);
  });
}

/* ── Log ──────────────────────────────────────────────────── */

const mkLog = (callerTabId) => async (text, type = 'normal') => {
  const entry = { text: `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`, type };
  try { await chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: entry }); } catch {}
};

/* ── Encontra organização via fetch ──────────────────────── */

async function fetchFindOrg(orgName, sampleCliente, log) {
  const html = await getHtml(`${BASE}/organizations`);

  // Extrai mapa nome → UUID das linhas da tabela com regex leve
  const orgMap = {};
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const uuidM = row[1].match(/organizations\/([a-f0-9-]{36})/);
    if (!uuidM) continue;
    const name = row[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (name) orgMap[name] = uuidM[1];
  }

  await log(`${Object.keys(orgMap).length} organizações carregadas.`);

  const parts    = String(sampleCliente || '').split(' - ');
  const munFull  = parts[parts.length - 1]?.trim() || '';
  const city     = parts[1]?.trim() || '';
  const stripCode = (s) => normStr(s).replace(/^\d+\s*[-–—]?\s*/, '').trim();

  const rawTerms = orgName?.trim() ? [orgName] : [munFull, city].filter(Boolean);
  const terms = [...new Set(
    rawTerms.flatMap(t => [normStr(t), stripCode(t)]).filter(Boolean),
  )];

  for (const [name, uuid] of Object.entries(orgMap)) {
    const n = normStr(name), core = stripCode(name);
    if (terms.some(t =>
      n === t || n.includes(t) ||
      (core && core.includes(t)) ||
      (t.length > 3 && t.includes(core) && core.length > 3)
    )) return { orgUUID: uuid, foundOrgName: name };
  }

  const tried = orgName?.trim() || munFull;
  const words  = stripCode(tried).split(' ').filter(w => w.length > 3);
  const near   = Object.keys(orgMap).filter(n => words.some(w => normStr(n).includes(w))).slice(0, 5);
  await log(`Organização "${tried}" não encontrada. Verifique o nome exato.`, 'error');
  if (near.length) await log(`Nomes parecidos: ${near.join(' | ')}`, 'error');
  return null;
}

/* ── Baixa PDF de Relatório de Consumo ──────────────────── */

async function fetchReportPdf(orgUUID, { clienteStr, setor, startDate, endDate, category }) {
  const base = new URLSearchParams({
    category, status: 'authorized',
    starting_date: startDate, ending_date: endDate,
  });

  // Página inicial: descobre opções do select de cliente
  const html1 = await getHtml(`${BASE}/organizations/${orgUUID}/transactions_report?${base}`);
  const opts  = [...html1.matchAll(/<option[^>]+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi)]
    .map(m => ({ value: m[1], text: m[2].trim() }));

  const p       = String(clienteStr).split(' - ');
  const secNome = p[2]?.trim() || clienteStr;
  const match   = opts.find(o => normStr(o.text).includes(normStr(secNome)));
  if (!match?.value) return null;

  // Se tem setor, descobre division_id
  let divisionId = '';
  if (setor) {
    const p2   = new URLSearchParams({ ...Object.fromEntries(base), client_id: match.value });
    const html2 = await getHtml(`${BASE}/organizations/${orgUUID}/transactions_report?${p2}`);
    const divOpts = [...html2.matchAll(/<option[^>]+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi)]
      .map(m => ({ value: m[1], text: m[2].trim() }));
    const dm = divOpts.find(o => o.value && normStr(o.text).includes(normStr(setor)));
    if (dm?.value) divisionId = dm.value;
  }

  // Página final com todos os filtros
  const all = new URLSearchParams({
    client_id: match.value, provider_id: '', division_id: divisionId,
    category, product_id: '', status: 'authorized',
    starting_date: startDate, ending_date: endDate, license_plate: '',
  });
  const finalHtml = await getHtml(`${BASE}/organizations/${orgUUID}/transactions_report?${all}`);

  if (!finalHtml.includes('Extrair Relatório')) return null;

  // Extrai href do link "Extrair Relatório"
  const linkM = finalHtml.match(/href="([^"]+)"[^>]*>\s*Extrair Relat[oó]rio/i)
             || finalHtml.match(/Extrair Relat[oó]rio[\s\S]{0,200}?href="([^"]+)"/i);
  if (!linkM?.[1]) return null;

  const pdfUrl = absUrl(linkM[1]);
  const pdfRes = await bf(pdfUrl);
  if (!pdfRes.ok) return null;
  const ct = pdfRes.headers.get('content-type') || '';
  if (ct.includes('html')) return null;

  return bufToBase64(await pdfRes.arrayBuffer());
}

/* ── Baixa PDF de Ordem de Serviço ──────────────────────── */

async function fetchOsPdf(orgUUID, osId) {
  const params = new URLSearchParams({
    order_id: osId, vehicle_id: '', provider_id: '', client_id: '',
    inserted_at_range: '', updated_at_range: '', service_type: '',
    repair_type: '', status: '', item_name: '',
  });
  const html = await getHtml(`${BASE}/organizations/${orgUUID}/orders?${params}`);

  const hrefM = html.match(/class="buttons"[\s\S]{0,300}?href="([^"]+\.pdf[^"]*)"/i)
             || html.match(/href="([^"]+(?:\.pdf|\/download|\/print|relatorio|report)[^"]*)"/i);
  if (!hrefM?.[1]) return null;

  const pdfRes = await bf(absUrl(hrefM[1]));
  if (!pdfRes.ok) return null;

  return bufToBase64(await pdfRes.arrayBuffer());
}

/* ── Automação RC ─────────────────────────────────────────── */

async function runConsumoDownload(data, callerTabId) {
  const { username, password, startDate, endDate, category, downloadItems, orgName } = data;
  const log = mkLog(callerTabId);

  try {
    await log('Fazendo login...');
    if (!await fetchLogin(username, password)) {
      await log('Login falhou. Verifique usuário e senha.', 'error');
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {});
      return;
    }
    await log('Login realizado.', 'ok');

    await log('Carregando organizações...');
    const org = await fetchFindOrg(orgName, downloadItems[0]?.clienteStr, log);
    if (!org) { chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {}); return; }

    const { orgUUID, foundOrgName } = org;
    await log(`Organização: ${foundOrgName}`, 'ok');

    let downloaded = 0;
    for (const item of downloadItems) {
      const p       = String(item.clienteStr).split(' - ');
      const secNome = p[2]?.trim() || item.clienteStr;
      const label   = item.setor ? `${secNome} / ${item.setor}` : secNome;
      const folder  = fsClean(`${secNome}${item.setor ? ` - ${item.setor}` : ''}`);
      const fileName = buildFileName(secNome, item.setor);

      await log(`Processando: ${label}...`);
      try {
        const b64 = await fetchReportPdf(orgUUID, { ...item, startDate, endDate, category });
        if (!b64) { await log(`Sem resultados para: ${label}`, 'normal'); continue; }
        const res = await saveToFolder(callerTabId, fileName, b64, folder);
        if (res?.ok) { downloaded++; await log(`✓ ${fileName}`, 'ok'); }
        else await log(`Falha ao salvar "${fileName}": ${res?.error || 'erro'}`, 'error');
      } catch (err) {
        await log(`Erro em "${label}": ${err.message}`, 'error');
      }
    }

    await log(`Concluído! ${downloaded}/${downloadItems.length} RC(s) processado(s).`, 'ok');
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_DONE', total: downloaded }).catch(() => {});

  } catch (err) {
    try { chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: { text: `Erro inesperado: ${err.message}`, type: 'error' } }).catch(() => {}); } catch {}
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: err.message }).catch(() => {});
  }
}

/* ── Automação OS ─────────────────────────────────────────── */

async function runOrdensDownload(data, callerTabId) {
  const { username, password, orgName, items } = data;
  const log = mkLog(callerTabId);

  try {
    await log('Fazendo login...');
    if (!await fetchLogin(username, password)) {
      await log('Login falhou. Verifique usuário e senha.', 'error');
      chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {});
      return;
    }
    await log('Login realizado.', 'ok');

    await log('Carregando organizações...');
    const org = await fetchFindOrg(orgName, items[0]?.cliente, log);
    if (!org) { chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR' }).catch(() => {}); return; }

    const { orgUUID, foundOrgName } = org;
    await log(`Organização: ${foundOrgName}`, 'ok');

    let downloaded = 0;
    for (const { osId, cliente, setor } of items) {
      const sec    = String(cliente).split(' - ')[2]?.trim() || String(cliente).trim();
      const folder = fsClean(`${sec}${setor ? ` - ${setor}` : ''}`);
      const fileName = `os_${fsClean(String(osId))}.pdf`;
      const label  = `OS ${osId} — ${sec}${setor ? ` / ${setor}` : ''}`;

      await log(`Processando: ${label}...`);
      try {
        const b64 = await fetchOsPdf(orgUUID, osId);
        if (!b64) { await log(`OS não encontrada ou sem PDF: ${osId}`, 'error'); continue; }
        const res = await saveToFolder(callerTabId, fileName, b64, folder);
        if (res?.ok) { downloaded++; await log(`✓ ${folder}/${fileName}`, 'ok'); }
        else await log(`Falha ao salvar "${fileName}": ${res?.error || 'erro'}`, 'error');
      } catch (err) {
        await log(`Erro em "${label}": ${err.message}`, 'error');
      }
    }

    await log(`Concluído! ${downloaded}/${items.length} OS processada(s).`, 'ok');
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_DONE', total: downloaded }).catch(() => {});

  } catch (err) {
    try { chrome.tabs.sendMessage(callerTabId, { type: 'FAT_LOG', log: { text: `Erro inesperado: ${err.message}`, type: 'error' } }).catch(() => {}); } catch {}
    chrome.tabs.sendMessage(callerTabId, { type: 'FAT_ERROR', message: err.message }).catch(() => {});
  }
}

/* ── Listener de mensagens ────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'UNIKO_FAT_START') {
    const callerTabId = sender.tab?.id;
    if (callerTabId) runConsumoDownload(message.data, callerTabId);
  }
  if (message.type === 'UNIKO_FAT_START_OS') {
    const callerTabId = sender.tab?.id;
    if (callerTabId) runOrdensDownload(message.data, callerTabId);
  }
  if (message.type === 'UNIKO_FAT_SAVE_RESULT') {
    const resolve = pendingSaves[message.id];
    if (resolve) { delete pendingSaves[message.id]; resolve(message); }
  }
});
