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
   .replace(/^SECRETARIA\s+(MUNICIPAL\s+)?/, '')
   .replace(/^FUNDO\s+MUNICIPAL\s+(DE|DA|DO|DOS|DAS)\s+/, '')
   .replace(/^FUNDO\s+MUNICIPAL\s+/, '')
   .trim();

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

// Para PDFs: usa cookies em URLs do 7Benefícios, sem credentials em URLs externas (S3 presigned)
const fetchPdf = (url, opts = {}) =>
  fetch(url, { credentials: url.startsWith(BASE) ? 'include' : 'omit', ...opts });

async function getHtml(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await bf(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    return r.text();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Timeout ao carregar: ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Resolve href relativo para URL absoluta
const absUrl = (href, base = BASE) =>
  href ? new URL(href, base).href : '';


/* ── Login ────────────────────────────────────────────────── */

async function fetchLogin(username, password, log) {
  const loginHtml = await getHtml(`${BASE}/sessions/new`);

  // Extrai todos os <input> do formulário com name + type + value
  const inputs = [...loginHtml.matchAll(/<input([^>]*)>/gi)].map(m => {
    const attrs = m[1];
    return {
      name:  attrs.match(/name="([^"]+)"/i)?.[1],
      type:  (attrs.match(/type="([^"]+)"/i)?.[1] || 'text').toLowerCase(),
      value: attrs.match(/value="([^"]*)"/i)?.[1] ?? '',
    };
  }).filter(i => i.name);

  // Detecta action do formulário
  const actionM = loginHtml.match(/<form[^>]+action="([^"]+)"/i);
  const action  = actionM ? new URL(actionM[1], BASE).href : `${BASE}/sessions`;

  // Campo de login = primeiro input visível que não é senha nem submit
  const userField = inputs.find(i =>
    i.type !== 'password' && i.type !== 'hidden' && i.type !== 'submit' && i.type !== 'checkbox'
  )?.name || 'handle';

  // Campo de senha
  const passField = inputs.find(i => i.type === 'password')?.name || 'password';

  await log(`Endpoint: ${action} | ${userField} / ${passField}`, 'info');

  // Monta o body: inclui TODOS os campos hidden (CSRF, tokens extras, etc.)
  // e sobrescreve os campos de login/senha
  const body = new URLSearchParams();
  for (const { name, type, value } of inputs) {
    if (type === 'hidden') body.set(name, value); // captura _csrf_token e quaisquer outros
  }
  body.set(userField, username);
  body.set(passField, password);

  const hiddenNames = inputs.filter(i => i.type === 'hidden').map(i => i.name);
  await log(`Campos hidden incluídos: ${hiddenNames.join(', ') || 'nenhum'}`, 'info');

  const res = await bf(action, {
    method:   'POST',
    redirect: 'follow',
    headers:  {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer':      `${BASE}/sessions/new`,
      'Origin':       BASE,
    },
    body,
  });

  await log(`Resposta login: HTTP ${res.status} → ${res.url}`, 'info');
  return !res.url.includes('/sessions') && res.status < 400;
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

async function fetchReportPdf(orgUUID, { clienteStr, setor, startDate, endDate, category }, log) {
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
  const sn      = normStr(secNome);

  // Bidirecional: opção contém secNome OU secNome contém opção (nomes às vezes abreviados)
  const match = opts.find(o => {
    const ot = normStr(o.text);
    return ot.includes(sn) || sn.includes(ot);
  });

  if (!match?.value) {
    const sample = opts.slice(0, 5).map(o => `"${o.text}"`).join(', ');
    if (log) await log(`RC: cliente "${secNome}" não encontrado no select. Opções disponíveis: ${sample || 'nenhuma'}`, 'error');
    return null;
  }

  // Se tem setor, descobre division_id
  let divisionId = '';
  if (setor) {
    const p2   = new URLSearchParams({ ...Object.fromEntries(base), client_id: match.value });
    const html2 = await getHtml(`${BASE}/organizations/${orgUUID}/transactions_report?${p2}`);
    const divOpts = [...html2.matchAll(/<option[^>]+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi)]
      .map(m => ({ value: m[1], text: m[2].trim() }));
    const dm = divOpts.find(o => o.value && normStr(o.text).includes(normStr(setor)));
    if (dm?.value) {
      divisionId = dm.value;
      if (log) await log(`RC: setor "${setor}" → division_id=${divisionId}`, 'info');
    } else {
      const opts2 = divOpts.slice(0, 8).map(o => `"${o.text}"`).join(', ');
      if (log) await log(`RC: setor "${setor}" não encontrado. Opções de divisão: ${opts2 || 'nenhuma'}`, 'error');
    }
  }

  // Página final com todos os filtros
  const all = new URLSearchParams({
    client_id: match.value, provider_id: '', division_id: divisionId,
    category, product_id: '', status: 'authorized',
    starting_date: startDate, ending_date: endDate, license_plate: '',
  });
  const finalHtml = await getHtml(`${BASE}/organizations/${orgUUID}/transactions_report?${all}`);

  if (!finalHtml.includes('Extrair Relatório')) {
    if (log) await log(`RC: "Extrair Relatório" não encontrado na página — sem transações no período ou cliente sem resultados.`, 'error');
    return null;
  }

  // Extrai href do link PDF "Extrair Relatório" (ícone fa-file-pdf — ignora botão Excel)
  const linkM = finalHtml.match(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]{0,800}?fa-file-pdf[\s\S]{0,400}?Extrair Relat[oó]rio/i)
             || finalHtml.match(/fa-file-pdf[\s\S]{0,400}?href="([^"]+)"[\s\S]{0,400}?Extrair Relat[oó]rio/i)
             || finalHtml.match(/href="([^"]+)"[^>]*>[\s\S]{0,200}?Extrair Relat[oó]rio/i);
  if (!linkM?.[1]) {
    if (log) await log(`RC: link "Extrair Relatório" encontrado no HTML mas href não extraído.`, 'error');
    return null;
  }

  // Loga o link original extraído do HTML para diagnóstico
  if (log) await log(`RC: link extraído = ${linkM[1].slice(0, 200)}`, 'info');

  // Decodifica entidades HTML (&amp; → &) antes de criar a URL — garante que client_id e outros
  // parâmetros embutidos no link sejam reconhecidos corretamente pelo parser de URL
  const pdfUrlObj = new URL(absUrl(unescHtml(linkM[1])));
  pdfUrlObj.searchParams.set('status', 'authorized');
  pdfUrlObj.searchParams.set('category', category);
  pdfUrlObj.searchParams.set('starting_date', startDate);
  pdfUrlObj.searchParams.set('ending_date', endDate);
  const pdfUrl = pdfUrlObj.href;
  const catLabel = category === 'service' ? 'Manutenção' : 'Abastecimento';
  if (log) await log(`RC: URL final = ${pdfUrl.slice(0, 300)}`, 'info');
  const pdfRes = await fetchPdf(pdfUrl);
  if (!pdfRes.ok) {
    if (log) await log(`RC: PDF URL retornou HTTP ${pdfRes.status}: ${pdfUrl}`, 'error');
    return null;
  }
  const ct = pdfRes.headers.get('content-type') || '';
  if (ct.includes('html')) {
    if (log) await log(`RC: resposta é HTML, não PDF (content-type: ${ct}).`, 'error');
    return null;
  }
  const buf = await pdfRes.arrayBuffer();
  const probe = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
  const hasXlsx = probe[0] === 0x50 && probe[1] === 0x4B; // PK = ZIP-based (xlsx, docx…)
  if (isPdfBuf(buf)) return { b64: bufToBase64(buf), ext: 'pdf' };
  if (hasXlsx) {
    if (log) await log(`RC: relatório recebido como planilha XLSX — será salvo como .xlsx.`, 'info');
    return { b64: bufToBase64(buf), ext: 'xlsx' };
  }
  const preview = new TextDecoder('utf-8', { fatal: false }).decode(probe.slice(0, 120)).replace(/\s+/g, ' ').trim();
  if (log) await log(`RC: não é PDF nem XLSX. content-type="${ct}" tamanho=${buf.byteLength}B início="${preview}"`, 'error');
  return null;
}

/* ── Baixa PDF de Ordem de Serviço ──────────────────────── */

const unescHtml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const isPdfBuf = (buf) => {
  const p = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
  return p.some((b, i) => b === 0x25 && p[i+1] === 0x50 && p[i+2] === 0x44 && p[i+3] === 0x46);
};

async function fetchOsPdf(orgUUID, osId, log) {
  // Busca na página de lista filtrada pelo order_id — o PDF está nessa página
  const params = new URLSearchParams({
    order_id: osId, vehicle_id: '', provider_id: '', client_id: '',
    inserted_at_range: '', updated_at_range: '', service_type: '',
    repair_type: '', status: '', item_name: '',
  });
  const listHtml = await getHtml(`${BASE}/organizations/${orgUUID}/orders?${params}`);

  // Procura URL de PDF na página da lista — prioriza ?report=pdf, depois .pdf no path
  const pdfM = listHtml.match(/href="([^"]+[?&]report=pdf[^"]*)"/i)
            || listHtml.match(/class="buttons"[\s\S]{0,400}?href="([^"]+\.pdf[^"]*)"/i)
            || listHtml.match(/href="([^"]+\.pdf[^"]*)"/i)
            || listHtml.match(/data-[a-z-]*="([^"]+[?&]report=pdf[^"]*)"/i)
            || listHtml.match(/"(https?:\/\/[^"]+\.pdf[^"]*)"/i);

  if (!pdfM?.[1]) {
    // Log de todos os hrefs da página para diagnóstico
    const allHrefs = [...listHtml.matchAll(/href="([^"]+)"/gi)].map(m => m[1])
      .filter(h => h.includes('order') || h.includes('pdf') || h.includes('download') || h.includes('attachment'))
      .slice(0, 8);
    if (log) await log(`OS: PDF não encontrado na lista para ${osId}. Links: ${allHrefs.join(' | ') || 'nenhum'}`, 'error');
    return null;
  }

  const pdfUrl = unescHtml(pdfM[1].startsWith('http') ? pdfM[1] : absUrl(pdfM[1]));
  if (log) await log(`OS: URL encontrada: ${pdfUrl.slice(0, 80)}...`, 'info');

  try {
    const pdfRes = await fetchPdf(pdfUrl);
    if (!pdfRes.ok) { if (log) await log(`OS: HTTP ${pdfRes.status} ao baixar PDF`, 'error'); return null; }
    const buf = await pdfRes.arrayBuffer();
    if (isPdfBuf(buf)) return bufToBase64(buf);
    const ct = pdfRes.headers.get('content-type') || '';
    if (log) await log(`OS: arquivo baixado não é PDF (content-type: ${ct})`, 'error');
    return null;
  } catch (e) {
    if (log) await log(`OS: erro ao baixar PDF: ${e.message}`, 'error');
    return null;
  }
}

/* ── Automação RC ─────────────────────────────────────────── */

async function runConsumoDownload(data, callerTabId) {
  const { username, password, startDate, endDate, category, downloadItems, orgName } = data;
  const log = mkLog(callerTabId);

  try {
    await log('Fazendo login...');
    if (!await fetchLogin(username, password, log)) {
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
        const result = await fetchReportPdf(orgUUID, { ...item, startDate, endDate, category }, log);
        if (!result) { await log(`Sem resultados para: ${label}`, 'normal'); continue; }
        const { b64, ext } = result;
        const fileNameExt = fileName.replace(/\.pdf$/, `.${ext}`);
        const res = await saveToFolder(callerTabId, fileNameExt, b64, folder);
        if (res?.ok) { downloaded++; await log(`✓ ${fileNameExt}`, 'ok'); }
        else await log(`Falha ao salvar "${fileNameExt}": ${res?.error || 'erro'}`, 'error');
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
    if (!await fetchLogin(username, password, log)) {
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
        const b64 = await fetchOsPdf(orgUUID, osId, log);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ping de verificação de saúde — responde com PONG para a aba
  if (message.type === 'UNIKO_FAT_PING_BG') {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'FAT_PONG' }).catch(() => {});
    sendResponse({ ok: true });
    return;
  }

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
