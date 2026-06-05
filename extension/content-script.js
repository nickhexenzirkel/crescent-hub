// Roda nas páginas do Crescent Hub
// Faz a ponte entre o app React e o background service worker

// Página → Background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const { type } = event.data || {};
  if (!type?.startsWith('UNIKO_FAT_')) return;

  if (type === 'UNIKO_FAT_PING') {
    // Responde direto e verifica se o background ainda está vivo
    window.postMessage({ type: 'FAT_PONG' }, '*');
    chrome.runtime.sendMessage({ type: 'UNIKO_FAT_PING_BG' })
      .then(() => window.postMessage({ type: 'FAT_BG_OK' }, '*'))
      .catch(() => window.postMessage({ type: 'FAT_BG_FAIL' }, '*'));
    return;
  }

  chrome.runtime.sendMessage(event.data).catch((err) => {
    // Encaminha o erro para o app — impede loading eterno
    window.postMessage({
      type: 'FAT_ERROR',
      message: err?.message?.includes('context invalidated')
        ? 'Extensão desconectada — recarregue a página (F5) e tente novamente.'
        : String(err?.message || err),
    }, '*');
  });
});

// Background → Página
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type?.startsWith('FAT_')) {
    window.postMessage(message, '*');
  }
});
