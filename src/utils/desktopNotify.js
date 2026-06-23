/**
 * Notificações no DESKTOP do usuário.
 *
 * Dois caminhos, nessa ordem:
 *  1. Extensão Uniko Cat-bot → chrome.notifications (pop-up do sistema, fica fixo,
 *     clique foca a aba). A extensão confirma com UNIKO_NOTIFY_OK quando mostra.
 *  2. Fallback Web Notifications API do próprio navegador, usado quando a extensão
 *     não confirma em ~800ms (não recarregada / não instalada).
 *
 * IMPORTANTE: o Chrome só exibe o pedido de permissão de notificação em resposta a
 * um GESTO do usuário (clique/tecla). Por isso `ensureNotifyPermission()` deve ser
 * chamada a partir de um evento de interação.
 */

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission() {
  return notifySupported() ? Notification.permission : 'unsupported';
}

// Pede permissão de notificação ao navegador. Chame dentro de um gesto do usuário.
export function ensureNotifyPermission() {
  try {
    if (notifySupported() && Notification.permission === 'default') {
      return Notification.requestPermission();
    }
  } catch {}
  return Promise.resolve(notifyPermission());
}

// Fallback: mostra a notificação direto pelo navegador (precisa de permissão concedida).
export function webNotify(n) {
  try {
    if (!notifySupported() || Notification.permission !== 'granted') return false;
    const isUrgent = n?.type === 'aviso_urgente';
    const base = n?.title || (isUrgent ? 'Aviso Urgente' : 'Lembrete');
    const title = isUrgent ? `🚨 ${base}` : `.𖥔 . ${base} .𖥔 .`;
    new Notification(title, { body: n?.message || '', requireInteraction: true, icon: '/UnikoCatbotQuadrado.png' });
    return true;
  } catch { return false; }
}

// Mostra o aviso no desktop: tenta a extensão; se não confirmar em 800ms, usa o navegador.
export function notifyDesktop(n) {
  const notif = {
    id:      String(n?.id ?? ''),
    type:    n?.type || 'lembrete',
    title:   n?.title || '',
    message: n?.message || '',
  };
  let acked = false;
  const onAck = (e) => {
    if (e.data?.type === 'UNIKO_NOTIFY_OK') { acked = true; window.removeEventListener('message', onAck); }
  };
  window.addEventListener('message', onAck);
  try { window.postMessage({ type: 'UNIKO_NOTIFY_SHOW', notif }, '*'); } catch {}
  setTimeout(() => {
    window.removeEventListener('message', onAck);
    if (!acked) webNotify(notif); // extensão não respondeu → usa o navegador
  }, 800);
}
