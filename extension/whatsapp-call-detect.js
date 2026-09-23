// Roda em web.whatsapp.com — detecta chamada de voz/vídeo ativa e avisa o
// background pra começar/parar a gravação (ver offscreen.js pela captura de
// verdade). Detecção por HEURÍSTICA de texto/aria-label (não por classe CSS
// — o WhatsApp Web ofusca nomes de classe e muda com frequência; atributos
// de acessibilidade em português são mais estáveis, mas ainda assim podem
// quebrar se a Meta mudar o texto — se isso acontecer, o botão manual no
// popup da extensão (Iniciar/Parar gravação) continua funcionando como
// reserva, independente dessa detecção automática).
//
// IMPORTANTE (aviso legal): a gravação SÓ deve rodar com aviso claro de que
// a ligação está sendo gravada — esse aviso é responsabilidade de quem usa
// a extensão (falar no início da ligação), não é algo que este script força
// sozinho. O ícone da extensão muda (ver background.js) enquanto grava, como
// indicador visual extra.

let callActive = false;
let pollTimer = null;

function findEndCallButton() {
  // Botão de "Encerrar chamada" só existe na tela enquanto a chamada está
  // em andamento — é o sinal mais confiável de "chamada ativa" no WhatsApp Web.
  const selectors = [
    '[aria-label*="Encerrar chamada" i]',
    '[aria-label*="End call" i]',
    '[aria-label*="Recusar chamada" i]', // ainda tocando, mas indica UI de chamada na tela
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// Nome do contato: tenta pegar do cabeçalho da conversa aberta (mesma
// pessoa que está ligando/recebendo, na esmagadora maioria dos casos).
function currentContactName() {
  const header = document.querySelector('header [role="button"] span[dir="auto"], header span[dir="auto"][title]');
  return header?.getAttribute('title') || header?.textContent?.trim() || null;
}

function checkCallState() {
  const active = !!findEndCallButton();
  if (active === callActive) return;
  callActive = active;
  if (active) {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_DETECTED_START', contactName: currentContactName() }).catch(() => {});
  } else {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_DETECTED_STOP' }).catch(() => {});
  }
}

// Poll simples (2s) em vez de MutationObserver — a UI de chamada do WhatsApp
// Web troca de estrutura inteira quando abre/fecha (observer teria que ser
// re-anexado toda hora de qualquer forma); 2s é rápido o bastante sem gastar CPU à toa.
pollTimer = setInterval(checkCallState, 2000);

// Gatilho MANUAL (popup da extensão) também precisa do nome do contato —
// pergunta pra essa aba em vez de duplicar a lógica.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UNIKO_CALL_QUERY_CONTACT') {
    sendResponse({ contactName: currentContactName() });
  }
});
