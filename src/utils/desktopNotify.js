/**
 * Notificações no DESKTOP do usuário.
 *
 * Dois caminhos, nessa ordem — NENHUM dos dois exige a extensão instalada,
 * ela é só um reforço quando presente:
 *  1. Extensão Uniko Cat-bot → chrome.notifications (pop-up do sistema, fica fixo,
 *     clique foca a aba). A extensão confirma com UNIKO_NOTIFY_OK quando mostra.
 *  2. Fallback Web Notifications API do próprio navegador (funciona sem extensão
 *     nenhuma, só com a permissão do site concedida), usado quando a extensão
 *     não confirma em ~800ms (não instalada, ou instalada mas falhou — ver
 *     background.js da extensão, corrigido pra não confirmar falso-positivo).
 *
 * IMPORTANTE: o navegador só exibe o pedido de permissão de notificação em
 * resposta a um GESTO do usuário (clique/tecla). Por isso `ensureNotifyPermission()`
 * deve ser chamada a partir de um evento de interação.
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

/**
 * Fallback: mostra a notificação direto pelo navegador (só precisa da
 * permissão concedida — nenhuma extensão envolvida neste caminho).
 *
 * Devolve um relatório detalhado em vez de só true/false: antes, qualquer
 * falha (permissão negada, `new Notification()` lançando exceção, ou o
 * navegador simplesmente nunca exibindo — sem lançar nada) virava um `catch`
 * mudo, e não dava pra saber POR QUE não apareceu (ex.: no Opera, "funciona
 * no Chrome e não no Opera" sem nenhuma pista). Agora:
 *  - erro === null e mostrada === true  → o navegador confirmou a exibição
 *    (evento `onshow` do próprio objeto Notification).
 *  - erro === null e mostrada === false → não deu erro, mas o navegador não
 *    confirmou em 4s — sinal de que o SISTEMA/o navegador está suprimindo a
 *    notificação por fora do que o JS consegue ver (ex.: notificações do
 *    Opera desligadas nas Configurações do Windows, ou "Não perturbe").
 *  - erro !== null → a construção falhou de verdade; a mensagem do erro diz
 *    o motivo (ex.: permissão negada).
 */
export function webNotify(n) {
  return new Promise((resolve) => {
    if (!notifySupported()) {
      resolve({ mostrada: false, erro: 'Notification API não existe neste navegador.' });
      return;
    }
    if (Notification.permission !== 'granted') {
      resolve({ mostrada: false, erro: `Permissão não concedida (está "${Notification.permission}").` });
      return;
    }
    try {
      const isUrgent = n?.type === 'aviso_urgente';
      const base = n?.title || (isUrgent ? 'Aviso Urgente' : 'Lembrete');
      const title = isUrgent ? `🚨 ${base}` : `.𖥔 . ${base} .𖥔 .`;
      const notificacao = new Notification(title, {
        body: n?.message || '',
        requireInteraction: true,
        icon: isUrgent ? encodeURI('/UNIKO_ATENÇÃO.png') : '/UNIKO_ALARME.png',
      });
      let resolvido = false;
      const acabar = (mostrada, erro = null) => {
        if (resolvido) return;
        resolvido = true;
        resolve({ mostrada, erro });
      };
      notificacao.onshow = () => acabar(true);
      notificacao.onerror = () => acabar(false, 'O navegador disparou um erro ao tentar exibir (evento onerror).');
      // Se em 4s nem onshow nem onerror disparou, o navegador não confirmou nada
      // — provável bloqueio do sistema operacional, fora do alcance do JS.
      setTimeout(() => acabar(false, null), 4000);
    } catch (e) {
      resolve({ mostrada: false, erro: e?.message || String(e) });
    }
  });
}

/**
 * Mostra o aviso no desktop: tenta a extensão; se não confirmar em 800ms, usa
 * o navegador (funciona sem a extensão). Devolve um relatório do que
 * aconteceu, útil pra tela mostrar/logar (ver `testarNotificacao` em
 * central-lembretes/index.jsx).
 */
export async function notifyDesktop(n) {
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

  await new Promise((r) => setTimeout(r, 800));
  window.removeEventListener('message', onAck);
  if (acked) return { via: 'extensao', mostrada: true, erro: null };

  const r = await webNotify(notif);
  return { via: 'navegador', ...r };
}
