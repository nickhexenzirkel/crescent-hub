// Ponte entre o Uniko (página React) e o serviço da extensão.
// Repassa mensagens NOTASMAIL_* nos dois sentidos.

// Página → extensão (somente comandos do app).
window.addEventListener('message', (event) => {
  // Só aceita mensagem da própria página: nem de iframe embutido, nem de outra
  // origem. A extensão entrega PDFs do e-mail do usuário, então não pode
  // obedecer a script de terceiros.
  if (event.source !== window || event.origin !== window.location.origin) return;
  const type = event.data?.type;
  if (type !== 'NOTASMAIL_PING' && type !== 'NOTASMAIL_START' && type !== 'NOTASMAIL_CANCEL') return;
  try {
    chrome.runtime.sendMessage(event.data).catch(() => {
      window.postMessage({ type: 'NOTASMAIL_ERROR', message: 'Extensão desconectada — recarregue a página (F5) e tente de novo.' }, window.location.origin);
    });
  } catch {
    window.postMessage({ type: 'NOTASMAIL_ERROR', message: 'Extensão desconectada — recarregue a página (F5).' }, window.location.origin);
  }
});

// Extensão → página.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type?.startsWith('NOTASMAIL_')) window.postMessage(message, window.location.origin);
});
