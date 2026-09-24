const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const micBtn = document.getElementById('micBtn');
const micOk = document.getElementById('micOk');
const toggleBtn = document.getElementById('toggleBtn');
const recordingNotice = document.getElementById('recordingNotice');

// Mostra "Microfone autorizado, ativo" em vez do botão quando a permissão já
// foi concedida antes (ver permissoes.html) — sem isso o botão "Autorizar
// microfone" fica lá pra sempre, sem nenhum jeito de saber se já tinha sido
// autorizado ou não (dava a impressão de que nunca funcionou).
async function refreshMicStatus() {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    const granted = status.state === 'granted';
    micOk.style.display = granted ? 'flex' : 'none';
    micBtn.style.display = granted ? 'none' : 'block';
    status.onchange = refreshMicStatus;
  } catch {
    // Permissions API sem suporte a 'microphone' nesse Chrome — mantém o
    // botão sempre visível (comportamento de antes), sem quebrar a tela.
  }
}
refreshMicStatus();

function render(state, msg) {
  const recording = state === 'recording';
  const aguardando = state === 'aguardando';
  dot.className = 'dot' + (recording ? ' recording' : aguardando ? ' aguardando' : '');
  statusText.textContent =
    msg || (recording ? 'Gravando chamada…' : aguardando ? 'Chamada detectada — clique pra gravar' : 'Sem gravação ativa');
  toggleBtn.textContent = recording ? 'Parar gravação' : 'Iniciar gravação manual';
  toggleBtn.className = recording ? 'danger' : 'primary';
  recordingNotice.className = 'recordingNotice' + (recording ? ' show' : '');
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
    console.log('[uniko-call] popup: streamId obtido:', streamId);
    // Pergunta o nome pra TODAS as abas do WhatsApp Web abertas, não só a
    // "aba ativa" — achado ao vivo 24/set/2026: mesmo com a ligação em
    // andamento na aba certa, a "aba ativa" na hora do clique às vezes é
    // outra coisa (ex.: o Picture-in-Picture do WhatsApp cria uma janela
    // própria quando a chamada some da aba principal — o usuário relatou
    // exatamente isso). tabCapture continua pegando o áudio da aba ativa
    // normalmente (é assim que o Chrome exige); só a PERGUNTA do nome vira
    // uma varredura, ficando com a primeira aba que responder de verdade.
    let contactName = null;
    let contentScriptStale = false;
    try {
      const waTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
      console.log('[uniko-call] popup: abas do WhatsApp Web encontradas:', waTabs.map(t => t.id));
      for (const t of waTabs) {
        try {
          const r = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_CALL_QUERY_CONTACT' });
          console.log(`[uniko-call] popup: aba ${t.id} respondeu contactName:`, JSON.stringify(r?.contactName));
          if (r?.contactName) { contactName = r.contactName; break; }
        } catch (e) {
          console.warn(`[uniko-call] popup: aba ${t.id} não respondeu:`, e.message);
        }
      }
      if (!contactName && waTabs.length) contentScriptStale = true;
    } catch (e) {
      console.error('[uniko-call] popup: falha ao varrer abas do WhatsApp Web:', e.message);
    }
    console.log('[uniko-call] popup: mandando UNIKO_CALL_START_WITH_STREAM pro background... contactName=', JSON.stringify(contactName));
    await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_START_WITH_STREAM', streamId, contactName });
    console.log('[uniko-call] popup: mensagem enviada, background confirmou recebimento.');
    render('recording', contentScriptStale ? 'Gravando (sem nome — dá um F5 na aba do WhatsApp)' : null);
  } catch (e) {
    render('idle', `Falhou: ${e.message}`);
  }
});
