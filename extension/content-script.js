// Roda nas páginas do Crescent Hub
// Faz a ponte entre o app React e o background service worker

const sendMsg = (data, onError) => {
  try {
    chrome.runtime.sendMessage(data)
      .then(() => {})
      .catch(onError);
  } catch (e) {
    onError(e);
  }
};

// Página → Background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const { type } = event.data || {};
  if (!type?.startsWith('UNIKO_FAT_')) return;

  if (type === 'UNIKO_FAT_PING') {
    window.postMessage({ type: 'FAT_PONG' }, '*');
    sendMsg(
      { type: 'UNIKO_FAT_PING_BG' },
      () => window.postMessage({ type: 'FAT_BG_FAIL' }, '*'),
    );
    return;
  }

  sendMsg(event.data, (err) => {
    window.postMessage({
      type: 'FAT_ERROR',
      message: 'Extensão desconectada — recarregue a página (F5) e tente novamente.',
    }, '*');
  });
});

// Background → Página
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type?.startsWith('FAT_')) {
    window.postMessage(message, '*');
  }
});
