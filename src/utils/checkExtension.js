/**
 * Verifica se a extensão Uniko Faturamento está instalada e responsiva.
 *
 * O PING agora passa pelo background service worker:
 *   PING → content script → background → FAT_PONG de volta
 *
 * Retorna:
 *   true      — extensão ok
 *   'reload'  — contexto morto, precisa F5
 *   false     — extensão não encontrada (timeout)
 */
export const checkExtension = () => new Promise(resolve => {
  const timer = setTimeout(() => {
    window.removeEventListener('message', h);
    resolve(false);
  }, 3000);

  const h = (e) => {
    const t = e.data?.type;
    if (t === 'FAT_PONG') {
      clearTimeout(timer);
      window.removeEventListener('message', h);
      resolve(true);
    }
    // FAT_ERROR durante o ping = contexto invalidado
    if (t === 'FAT_ERROR' && e.data?.message?.includes('desconectada')) {
      clearTimeout(timer);
      window.removeEventListener('message', h);
      resolve('reload');
    }
  };

  window.addEventListener('message', h);
  window.postMessage({ type: 'UNIKO_FAT_PING' }, '*');
});
