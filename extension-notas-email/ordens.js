// "Baixar Ordens de Serviço" da Wowlet — conduz o fluxo que antes era feito à mão:
// login → Credenciados → nome fantasia → opção → Buscar → linha → Acessar →
// /provider_orders → ID → abrir a ordem → imprimir em PDF (Ctrl+P) → logout → próximo.
// Usa a sessão da Wowlet que o próprio Chrome já tem (sem captcha, sem senha).
// Cliques/leitura da página: wowlet.js. Teclas reais e impressão: chrome.debugger.

const BASE = 'https://app.7beneficiosgestao.com.br';
const LIMITE = 400;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const jobs = new Map(); // jobId -> { origem, cancelado, tabId, janelaId }

export const validarOrdens = (msg) => {
  const itens = Array.isArray(msg.itens) ? msg.itens : [];
  if (!itens.length || itens.length > LIMITE) return { erro: `Lista de ordens inválida (1 a ${LIMITE}).` };
  const vistos = new Set();
  const limpos = [];
  for (const it of itens) {
    const os = String(it?.os ?? '').trim();
    const credenciado = String(it?.credenciado ?? '').trim();
    if (!/^[0-9a-f]{6,12}$/i.test(os)) return { erro: `ID de ordem inválido: ${os.slice(0, 20)}` };
    if (credenciado.length < 3 || credenciado.length > 150 || /[\u0000-\u001f]/.test(credenciado)) return { erro: 'Nome de credenciado inválido.' };
    if (vistos.has(os)) continue;
    vistos.add(os);
    limpos.push({ os, credenciado });
  }
  if (typeof msg.jobId !== 'string' || msg.jobId.length > 60) return { erro: 'Trabalho inválido.' };
  return { itens: limpos };
};

const dbg = (tabId, method, params) => chrome.debugger.sendCommand({ tabId }, method, params);

async function cmd(job, msg, { tentativas = 25 } = {}) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    if (job.cancelado) throw new Error('Cancelado.');
    try { return await chrome.tabs.sendMessage(job.tabId, msg); }
    catch (e) { ultimo = e; await esperar(600); } // página ainda carregando / trocando
  }
  throw new Error(`A página da Wowlet não respondeu (${ultimo?.message || 'sem resposta'}).`);
}

/** Espera a aba terminar de carregar e o script da Wowlet responder. */
async function pronto(job, ms = 30000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (job.cancelado) throw new Error('Cancelado.');
    const tab = await chrome.tabs.get(job.tabId).catch(() => null);
    if (!tab) throw new Error('A janela da Wowlet foi fechada.');
    if (tab.status === 'complete') {
      try { if ((await chrome.tabs.sendMessage(job.tabId, { type: 'WOW_PING' }))?.ok) return; } catch { /* ainda sem script */ }
    }
    await esperar(400);
  }
  throw new Error('A página da Wowlet demorou demais para carregar.');
}

async function ir(job, caminho) {
  await chrome.tabs.update(job.tabId, { url: `${BASE}${caminho}` });
  await esperar(900);
  await pronto(job);
}

/** Depois de um clique que troca de página. */
async function aposClique(job) {
  await esperar(1500);
  await pronto(job);
}

async function digitar(job, texto) {
  for (const c of texto) {
    await dbg(job.tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', key: c, text: c, unmodifiedText: c });
    await dbg(job.tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key: c });
    await esperar(110);
  }
}

/** Garante que está logado (se não, espera a pessoa entrar na janela — captcha incluso). */
async function garantirLogin(job, log) {
  await ir(job, '/providers');
  let est = await cmd(job, { type: 'WOW_ESTADO' });
  if (est.logado) return est;
  await log('>>> Entre na Wowlet na janela que abriu (login e captcha). Aguardo até 5 minutos…');
  await chrome.windows.update(job.janelaId, { focused: true }).catch(() => {});
  const fim = Date.now() + 5 * 60 * 1000;
  while (Date.now() < fim) {
    await esperar(3000);
    est = await cmd(job, { type: 'WOW_ESTADO' }, { tentativas: 3 }).catch(() => ({ logado: false }));
    if (est.logado) { await log('Login feito.'); await ir(job, '/providers'); return cmd(job, { type: 'WOW_ESTADO' }); }
  }
  throw new Error('Login na Wowlet não concluído a tempo.');
}

async function sairDoCredenciado(job, log) {
  await log('Clicando em Logout…');
  const r = await cmd(job, { type: 'WOW_LOGOUT' });
  if (!r.ok) throw new Error(r.erro);
  await aposClique(job);
  await log('Saí do credenciado.');
}

async function abrirListaCredenciados(job, log) {
  await ir(job, '/providers');
  let est = await cmd(job, { type: 'WOW_ESTADO' });
  if (!est.logado) est = await garantirLogin(job, log);
  if (!est.temAcessar && est.temLogoutImp) {
    await log('Ainda dentro de um credenciado — saindo antes…');
    await sairDoCredenciado(job, log);
    await ir(job, '/providers');
    est = await cmd(job, { type: 'WOW_ESTADO' });
  }
  if (!est.temAcessar) throw new Error('Não consegui abrir a lista de credenciados (/providers).');
}

async function acessarCredenciado(job, nome, log) {
  const alvo = nome;
  const pal = nome.trim().split(/\s+/);
  const termos = [...new Set([pal[0].length >= 3 ? pal[0] : pal.slice(0, 2).join(' '), nome.split(' - ')[0].trim(), nome.trim()])].filter(Boolean);
  for (const termo of termos) {
    await log(`Credenciados → pesquisando "${termo}"…`);
    await abrirListaCredenciados(job, log);
    await esperar(1200);
    await log('Clicando em Razão Social e Nome Fantasia…');
    const campos = await cmd(job, { type: 'WOW_CLICAR_CAMPOS' });
    if (!campos.ok) throw new Error(`${campos.erro} Campos visíveis: ${(campos.campos || []).join(', ')}`);
    await log(`Campo escolhido por ${campos.via}; foco em ${campos.foco}.`);
    await esperar(900);
    await log(`Digitando "${termo}" devagar…`);
    await digitar(job, termo);
    await esperar(2000);
    const op = await cmd(job, { type: 'WOW_OPCOES', termo });
    await log(`Opções que apareceram (${op.textos.length}): ${op.textos.join(' | ') || 'nenhuma'}`);
    let idx = op.textos.findIndex((t) => { const a = norm(t); return a && (a.includes(norm(alvo)) || norm(alvo).includes(a)); });
    if (idx < 0 && op.textos.length) idx = 0;
    if (idx >= 0) {
      await log(`Clicando na opção "${op.textos[idx]}"…`);
      await cmd(job, { type: 'WOW_CLICAR_OPCAO', termo, idx });
      await esperar(1500);
    }
    await log('Clicando em Buscar…');
    const b = await cmd(job, { type: 'WOW_BUSCAR' });
    if (!b.ok) throw new Error(b.erro);
    await aposClique(job);
    await esperar(1500);
    let linhas = [];
    for (let t = 0; t < 8 && !linhas.length; t++) {
      linhas = (await cmd(job, { type: 'WOW_LINHAS', termo, alvo }, { tentativas: 6 })).linhas || [];
      if (!linhas.length) await esperar(1500);
    }
    await log(`${linhas.length} linha(s) para "${termo}".`);
    const linha = linhas.find((l) => l.exata) || (linhas.length === 1 ? linhas[0] : null);
    if (!linha) continue;
    await log('Clicando na linha do credenciado e em Acessar…');
    const a = await cmd(job, { type: 'WOW_ACESSAR', termo, i: linha.i });
    if (!a.ok) { await log(`(aviso) ${a.erro}`); continue; }
    await aposClique(job);
    return;
  }
  throw new Error(`Credenciado não encontrado: ${nome}`);
}

async function baixarOrdem(job, os, log) {
  await log(`OS ${os}: abrindo /provider_orders…`);
  await ir(job, '/provider_orders');
  await log(`OS ${os}: preenchendo o ID e clicando em Buscar…`);
  const b = await cmd(job, { type: 'WOW_BUSCAR_OS', os });
  if (!b.ok) throw new Error(b.erro);
  await aposClique(job);
  let aberta = false;
  for (let t = 0; t < 12 && !aberta; t++) {
    const r = await cmd(job, { type: 'WOW_ABRIR_ORDEM', os }, { tentativas: 6 });
    if (r.ok) aberta = true; else await esperar(1500);
  }
  if (!aberta) throw new Error('Ordem não encontrada nesse credenciado.');
  await log(`OS ${os}: abrindo a ordem…`);
  await aposClique(job);
  for (let t = 0; t < 20; t++) {
    const est = await cmd(job, { type: 'WOW_ESTADO' }, { tentativas: 6 });
    if (est.temOrdem) break;
    if (t === 19) throw new Error('A página da ordem não carregou.');
    await esperar(1000);
  }
  await esperar(1500);
  await log(`OS ${os}: imprimindo em PDF (Ctrl+P)…`);
  let data = null;
  for (let t = 1; t <= 3 && !data; t++) {
    try { ({ data } = await dbg(job.tabId, 'Page.printToPDF', { printBackground: true, preferCSSPageSize: true })); }
    catch (e) {
      await log(`OS ${os}: impressão falhou (tentativa ${t}/3): ${String(e.message).slice(0, 80)}`);
      await esperar(3000);
    }
  }
  if (!data) throw new Error('o Chrome não conseguiu imprimir a página');
  return data;
}

export async function executarOrdens(jobId, job, itens, paraUniko) {
  const log = (texto) => paraUniko(job, { type: 'NOTASMAIL_OS_LOG', jobId, texto });
  const estado = (os, est, msg = '') => paraUniko(job, { type: 'NOTASMAIL_OS_ITEM', jobId, os, estado: est, msg });
  const janela = await chrome.windows.create({ url: 'about:blank', type: 'popup', width: 1200, height: 850, focused: true });
  job.janelaId = janela.id;
  job.tabId = janela.tabs[0].id;
  let ok = 0;
  const falhas = [];
  try {
    await chrome.debugger.attach({ tabId: job.tabId }, '1.3');
    await log(`Iniciando: ${itens.length} ordem(ns). Deixe a janela da Wowlet aberta até terminar.`);
    await garantirLogin(job, log);

    const grupos = new Map();
    itens.forEach((it) => { if (!grupos.has(it.credenciado)) grupos.set(it.credenciado, []); grupos.get(it.credenciado).push(it); });

    for (const [cred, lista] of grupos) {
      if (job.cancelado) break;
      await log(`── Credenciado: ${cred} (${lista.length} ordem(ns))`);
      try { await acessarCredenciado(job, cred, log); }
      catch (e) {
        if (job.cancelado) break;
        await log(`ERRO: ${e.message}`);
        for (const it of lista) { falhas.push({ os: it.os, credenciado: cred, erro: e.message }); await estado(it.os, 'erro', e.message); }
        continue;
      }
      for (const it of lista) {
        if (job.cancelado) break;
        await estado(it.os, 'baixando');
        try {
          const base64 = await baixarOrdem(job, it.os, log);
          ok++;
          await paraUniko(job, { type: 'NOTASMAIL_OS_ARQUIVO', jobId, os: it.os, base64 });
          await estado(it.os, 'ok');
        } catch (e) {
          if (job.cancelado) break;
          await log(`OS ${it.os}: FALHOU — ${e.message}`);
          falhas.push({ os: it.os, credenciado: cred, erro: e.message });
          await estado(it.os, 'erro', e.message);
          if (/janela da Wowlet foi fechada/.test(e.message)) throw e;
        }
      }
      try { await sairDoCredenciado(job, log); } catch (e) { if (!job.cancelado) await log(`Aviso no logout: ${e.message}`); }
    }
    await log(job.cancelado ? 'Cancelado.' : 'Concluído.');
  } finally {
    await chrome.debugger.detach({ tabId: job.tabId }).catch(() => {});
    await chrome.windows.remove(job.janelaId).catch(() => {});
    await paraUniko(job, { type: 'NOTASMAIL_OS_DONE', jobId, cancelado: job.cancelado, ok, falhas });
    jobs.delete(jobId);
  }
}

export function iniciarOrdens(msg, tabId, paraUniko, erro) {
  const v = validarOrdens(msg);
  if (v.erro) return erro(v.erro);
  if (jobs.size) return erro('Já existe um download de ordens em andamento.');
  const job = { origem: tabId, cancelado: false, tabId: null, janelaId: null };
  jobs.set(msg.jobId, job);
  executarOrdens(msg.jobId, job, v.itens, paraUniko).catch((e) => {
    paraUniko(job, { type: 'NOTASMAIL_ERROR', jobId: msg.jobId, message: e?.message || 'Falha inesperada.' });
    jobs.delete(msg.jobId);
  });
}

export function cancelarOrdens(msg, tabId) {
  const job = jobs.get(msg.jobId);
  if (job && job.origem === tabId) job.cancelado = true;
}
