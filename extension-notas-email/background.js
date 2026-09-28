// Serviço da extensão "Uniko — Notas por e-mail".
// Recebe do Uniko a lista de notas que faltam, abre o Gmail de cada conta em uma
// aba de segundo plano, manda buscar e repassa ao Uniko cada PDF achado.
// Reaproveita a sessão que você já tem aberta — a extensão nunca vê senha.

const VERSAO = chrome.runtime.getManifest().version;
const LIMITE_NOTAS = 600;
const jobs = new Map(); // jobId -> { origem, cancelado, abas:Set }

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const paraUniko = (job, msg) =>
  chrome.tabs.sendMessage(job.origem, msg).catch(() => {
    /* a aba do Uniko foi fechada — encerra o trabalho */
    job.cancelado = true;
  });

const log = (job, jobId, texto) => paraUniko(job, { type: 'NOTASMAIL_LOG', jobId, texto });

// O Gmail abre numa JANELA própria e visível (não numa aba escondida): o Chrome
// desacelera muito as abas em segundo plano e a busca levava ~40 s por nota
// (medido); numa janela visível ela roda em velocidade normal.
async function abrirGmail(conta) {
  const janela = await chrome.windows.create({
    url: `https://mail.google.com/mail/u/${conta}/`,
    type: 'popup', width: 1100, height: 800, focused: true,
  });
  const tab = janela.tabs[0];
  const fim = Date.now() + 45000;
  while (Date.now() < fim) {
    await esperar(1500);
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'NOTASMAIL_G_PING' });
      if (r?.ok) return { tab, janelaId: janela.id, email: r.email };
    } catch {
      /* content script ainda não carregou (ou a conta redirecionou para o login) */
    }
  }
  await chrome.windows.remove(janela.id).catch(() => {});
  return null;
}

async function executar(jobId, job, numeros, contas) {
  const totalBuscas = numeros.length * contas.length;
  let feitasAntes = 0;
  const encontrados = new Set();
  let arquivos = 0;

  for (const conta of contas) {
    if (job.cancelado) break;
    await log(job, jobId, `Abrindo o Gmail da conta /u/${conta}/ …`);
    const aberta = await abrirGmail(conta);
    if (!aberta) {
      await log(job, jobId, `Conta /u/${conta}/ não respondeu (não está logada?) — pulei.`);
      feitasAntes += numeros.length;
      continue;
    }
    job.abas.add(aberta.tab.id);
    await log(job, jobId, `Procurando ${numeros.length} nota(s) em ${aberta.email || 'conta ' + conta} — deixe a janela do Gmail aberta e visível até terminar.`);
    try {
      const r = await chrome.tabs.sendMessage(aberta.tab.id, {
        type: 'NOTASMAIL_G_BUSCAR', jobId, conta, numeros, base: feitasAntes, totalGeral: totalBuscas,
      });
      if (r?.erro) await log(job, jobId, `Conta /u/${conta}/: ${r.erro}`);
      (r?.encontrados || []).forEach((n) => encontrados.add(n));
      arquivos += r?.arquivos || 0;
    } catch (e) {
      await log(job, jobId, `Conta /u/${conta}/: ${e?.message || 'falha na busca'}`);
    }
    feitasAntes += numeros.length;
    await chrome.windows.remove(aberta.janelaId).catch(() => {});
    job.abas.delete(aberta.tab.id);
  }

  await paraUniko(job, {
    type: 'NOTASMAIL_DONE', jobId, cancelado: job.cancelado,
    arquivos, encontrados: [...encontrados],
    semResultado: numeros.filter((n) => !encontrados.has(String(n).replace(/^0+/, ''))),
  });
  jobs.delete(jobId);
}

function validar(msg) {
  const itens = Array.isArray(msg.numeros) ? msg.numeros : [];
  const numeros = [...new Set(itens.map((n) => String(n).trim()))];
  // Só números de nota: a página não pode mandar a extensão buscar texto livre no e-mail.
  if (!numeros.length || numeros.length > LIMITE_NOTAS || !numeros.every((n) => /^\d{3,9}$/.test(n)))
    return { erro: 'Lista de notas inválida.' };
  const contas = [...new Set((Array.isArray(msg.contas) ? msg.contas : [1]).map(Number))];
  if (!contas.length || contas.length > 5 || !contas.every((c) => Number.isInteger(c) && c >= 0 && c <= 9))
    return { erro: 'Contas do Gmail inválidas (use números de 0 a 9, como em mail.google.com/mail/u/2/).' };
  if (typeof msg.jobId !== 'string' || msg.jobId.length > 60) return { erro: 'Trabalho inválido.' };
  return { numeros, contas };
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg?.type?.startsWith('NOTASMAIL_')) return;
  const tabId = sender.tab?.id;
  if (tabId == null) return;
  const doGmail = (sender.tab.url || '').startsWith('https://mail.google.com/');

  // ── vindo do Gmail (repassa ao Uniko) ──
  if (doGmail) {
    const job = jobs.get(msg.jobId);
    if (!job || !job.abas.has(tabId)) return;
    if (msg.type === 'NOTASMAIL_G_ARQUIVO')
      paraUniko(job, {
        type: 'NOTASMAIL_ARQUIVO', jobId: msg.jobId, conta: msg.conta, email: msg.email,
        numeros: msg.numeros, nome: msg.nome, assunto: msg.assunto, dataEmail: msg.dataEmail, base64: msg.base64,
      });
    else if (msg.type === 'NOTASMAIL_G_PROGRESSO')
      paraUniko(job, { type: 'NOTASMAIL_PROGRESSO', jobId: msg.jobId, conta: msg.conta, feitos: msg.feitos, total: msg.total });
    else if (msg.type === 'NOTASMAIL_G_LOG') log(job, msg.jobId, msg.texto);
    return;
  }

  // ── vindo do Uniko (ponte) ──
  if (msg.type === 'NOTASMAIL_PING') {
    chrome.tabs.sendMessage(tabId, { type: 'NOTASMAIL_PONG', versao: VERSAO }).catch(() => {});
  } else if (msg.type === 'NOTASMAIL_START') {
    const v = validar(msg);
    if (v.erro) {
      chrome.tabs.sendMessage(tabId, { type: 'NOTASMAIL_ERROR', jobId: msg.jobId, message: v.erro }).catch(() => {});
      return;
    }
    if (jobs.size) {
      chrome.tabs.sendMessage(tabId, { type: 'NOTASMAIL_ERROR', jobId: msg.jobId, message: 'Já existe uma busca em andamento.' }).catch(() => {});
      return;
    }
    const job = { origem: tabId, cancelado: false, abas: new Set() };
    jobs.set(msg.jobId, job);
    executar(msg.jobId, job, v.numeros, v.contas).catch((e) => {
      paraUniko(job, { type: 'NOTASMAIL_ERROR', jobId: msg.jobId, message: e?.message || 'Falha inesperada.' });
      jobs.delete(msg.jobId);
    });
  } else if (msg.type === 'NOTASMAIL_CANCEL') {
    const job = jobs.get(msg.jobId);
    if (job && job.origem === tabId) {
      job.cancelado = true;
      for (const t of job.abas) chrome.tabs.sendMessage(t, { type: 'NOTASMAIL_G_CANCELAR', jobId: msg.jobId }).catch(() => {});
    }
  }
});
