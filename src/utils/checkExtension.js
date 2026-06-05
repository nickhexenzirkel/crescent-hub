/**
 * Verifica se a extensão Uniko Faturamento está instalada E com o
 * background service worker vivo.
 *
 * Retorna:
 *   true        — tudo ok
 *   'reload'    — extensão instalada mas contexto morto (recarregue a página)
 *   false       — extensão não encontrada
 */
export const checkExtension = () => new Promise(resolve => {
  const timer = setTimeout(() => {
    window.removeEventListener('message', h);
    resolve(false);
  }, 3000);

  const h = (e) => {
    const t = e.data?.type;
    if (t === 'FAT_BG_OK') {
      clearTimeout(timer);
      window.removeEventListener('message', h);
      resolve(true);
    }
    if (t === 'FAT_BG_FAIL') {
      clearTimeout(timer);
      window.removeEventListener('message', h);
      resolve('reload');
    }
  };

  window.addEventListener('message', h);
  window.postMessage({ type: 'UNIKO_FAT_PING' }, '*');
});
