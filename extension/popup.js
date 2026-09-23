const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const micBtn = document.getElementById('micBtn');
const toggleBtn = document.getElementById('toggleBtn');

function render(state, msg) {
  const recording = state === 'recording';
  const aguardando = state === 'aguardando';
  dot.className = 'dot' + (recording ? ' recording' : aguardando ? ' aguardando' : '');
  statusText.textContent =
    msg || (recording ? 'Gravando chamada…' : aguardando ? 'Chamada detectada — clique pra gravar' : 'Sem gravação ativa');
  toggleBtn.textContent = recording ? 'Parar gravação' : 'Iniciar gravação manual';
  toggleBtn.className = recording ? 'danger' : 'primary';
}

chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).then((res) => render(res?.state || 'idle')).catch(() => render('idle'));

// Abre numa ABA (não pede aqui no popup) — o Chrome não mostra o prompt de
// permissão direito numa janela de popup de extensão (fecha rápido demais /
// contexto efêmero demais), costuma devolver "Permission denied" na hora,
// mesmo sem o usuário ter clicado em nada. Ver permissoes.html/js.
micBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('permissoes.html') });
});

// IMPORTANTE: chrome.tabCapture.getMediaStreamId() só funciona chamado bem
// AQUI, direto na resposta ao clique — é o gesto do usuário que autoriza a
// captura. Se esse pedido acontecer em outro lugar (ex.: no background,
// depois de um "await" no meio do caminho), o Chrome recusa com erro
// silencioso ("falha ao iniciar" no console) — achado ao vivo (23/set/2026).
// Sem `targetTabId`: captura a aba ATIVA — por isso é essencial que o
// WhatsApp Web esteja em primeiro plano quando o usuário clicar aqui.
toggleBtn.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' });
  if (res?.state === 'recording') {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_MANUAL_STOP' });
    render('idle');
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('web.whatsapp.com')) {
      render('idle', 'Abra o WhatsApp Web nesta aba antes de gravar.');
      return;
    }
    const streamId = await chrome.tabCapture.getMediaStreamId();
    let contactName = null;
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'UNIKO_CALL_QUERY_CONTACT' });
      contactName = r?.contactName || null;
    } catch {}
    await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_START_WITH_STREAM', streamId, contactName });
    render('recording');
  } catch (e) {
    render('idle', `Falhou: ${e.message}`);
  }
});
