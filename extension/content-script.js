// Roda nas páginas do Crescent Hub
// Faz a ponte entre o app React e o background service worker

// Ao carregar, envia cookies do YouTube silenciosamente ao servidor
// Garante que o Render tenha cookies mesmo após restart, sem o usuário precisar clicar
setTimeout(() => {
  try { chrome.runtime.sendMessage({ type: 'UNIKO_YT_AUTO_COOKIES' }).catch(() => {}); } catch {}
}, 1500);

const sendMsg = (data, onError) => {
  try {
    chrome.runtime.sendMessage(data)
      .then(() => {})
      .catch(onError);
  } catch (e) {
    onError(e);
  }
};

const ALLOWED_PREFIXES = ['UNIKO_FAT_', 'UNIKO_YT_', 'UNIKO_NOTIFY_'];

// Página/iframe → Background
window.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (!ALLOWED_PREFIXES.some(p => type?.startsWith(p))) return;

  // Notificações desktop: encaminha sem alarde (não dispara FAT_ERROR se a extensão cair)
  if (type.startsWith('UNIKO_NOTIFY_')) {
    sendMsg(event.data, () => {});
    return;
  }

  if (type === 'UNIKO_FAT_PING') {
    sendMsg(
      { type: 'UNIKO_FAT_PING_BG' },
      () => window.postMessage({
        type: 'FAT_ERROR',
        message: 'Extensão desconectada — recarregue a página (F5) e tente novamente.',
      }, '*'),
    );
    return;
  }

  sendMsg(event.data, () => {
    window.postMessage({
      type: 'FAT_ERROR',
      message: 'Extensão desconectada — recarregue a página (F5) e tente novamente.',
    }, '*');
  });
});

// Background → Página/iframe
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type?.startsWith('FAT_') || message?.type?.startsWith('YT_')) {
    window.postMessage(message, '*');
  }
});
