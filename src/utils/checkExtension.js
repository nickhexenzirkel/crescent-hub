/**
 * Verifica se a extensão Uniko Faturamento está instalada e responsiva.
 *
 * O PING agora passa pelo background service worker:
 *   PING → content script → background → FAT_PONG de volta
 *
 * Retorna { status, version } — status:
 *   true      — extensão ok
 *   'reload'  — contexto morto, precisa F5
 *   false     — extensão não encontrada (timeout)
 */
export const checkExtensionInfo = () => new Promise(resolve => {
  const timer = setTimeout(() => {
    window.removeEventListener('message', h);
    resolve({ status: false, version: null });
  }, 3000);

  const h = (e) => {
    const t = e.data?.type;
    if (t === 'FAT_PONG') {
      clearTimeout(timer);
      window.removeEventListener('message', h);
      resolve({ status: true, version: e.data?.version || null }); // sem version = extensão antiga (anterior ao aviso de atualização)
    }
    // FAT_ERROR durante o ping = contexto invalidado
    if (t === 'FAT_ERROR' && e.data?.message?.includes('desconectada')) {
      clearTimeout(timer);
      window.removeEventListener('message', h);
      resolve({ status: 'reload', version: null });
    }
  };

  window.addEventListener('message', h);
  window.postMessage({ type: 'UNIKO_FAT_PING' }, '*');
});

/** Compatível com quem só quer saber o status (true | 'reload' | false). */
export const checkExtension = async () => (await checkExtensionInfo()).status;

/** Versão mais nova da extensão = a do manifest deste mesmo deploy (o zip baixável é gerado do mesmo commit). */
export const LATEST_EXTENSION_VERSION = typeof __EXT_VERSION__ !== 'undefined' ? __EXT_VERSION__ : null;

/** true se `instalada` é mais antiga que `ultima`. Sem versão instalada (extensão antiga) conta como desatualizada. */
export const extensaoDesatualizada = (instalada, ultima = LATEST_EXTENSION_VERSION) => {
  if (!ultima) return false;
  if (!instalada) return true;
  const a = String(instalada).split('.').map(Number), b = String(ultima).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
};
