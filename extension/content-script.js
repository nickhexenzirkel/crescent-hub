// Roda nas páginas do Crescent Hub
// Faz a ponte entre o app React e o background service worker

// Página → Background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const { type } = event.data || {};
  if (!type?.startsWith('UNIKO_FAT_')) return;

  if (type === 'UNIKO_FAT_PING') {
    // Responde direto sem passar pelo background
    window.postMessage({ type: 'FAT_PONG' }, '*');
    return;
  }

  chrome.runtime.sendMessage(event.data).catch(() => {});
});

// Background → Página
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type?.startsWith('FAT_')) {
    window.postMessage(message, '*');
  }
});
