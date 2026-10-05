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
  // Botão de encerrar/desligar só existe na tela enquanto a chamada está em
  // andamento — é o sinal mais confiável de "chamada ativa" no WhatsApp Web.
  // "Desligar" confirmado ao vivo 24/set/2026 (inspecionei uma chamada real)
  // — a Meta trocou o texto de "Encerrar chamada" em algum momento; mantém
  // os textos antigos também, de graça, caso outra versão/idioma ainda use.
  const selectors = [
    '[aria-label*="Desligar" i]',
    '[aria-label*="Encerrar chamada" i]',
    '[aria-label*="End call" i]',
    '[aria-label*="Recusar chamada" i]', // ainda tocando, mas indica UI de chamada na tela
    '[data-testid="voip-container-audio-call"]', // widget da ligação em si — presente sempre que há uma chamada ativa, redundante de propósito
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// Nome do contato: PRIORIZA o nome de quem está NA LIGAÇÃO (widget da
// própria chamada, seletor estável achado ao vivo 24/set/2026 inspecionando
// o DOM durante uma chamada real: data-testid="voip-call-participant-info-name"
// — atributo interno do WhatsApp, não classe CSS ofuscada, bem mais confiável
// que ler o cabeçalho da conversa aberta) — antes o nome vinha da CONVERSA
// aberta na tela, que podia ser uma pessoa DIFERENTE de quem estava
// ligando (ex: ligação toca enquanto outra conversa está aberta), fazendo
// tudo cair em "Contato desconhecido" e misturar chamadas de gente
// diferente no mesmo contato. Cabeçalho da conversa some como último
// recurso, se por algum motivo o widget da ligação não for encontrado.
function currentContactName() {
  const callName = document.querySelector('[data-testid="voip-call-participant-info-name"]');
  if (callName?.textContent?.trim()) return callName.textContent.trim();
  const header = document.querySelector('header [role="button"] span[dir="auto"], header span[dir="auto"][title]');
  return header?.getAttribute('title') || header?.textContent?.trim() || null;
}

function checkCallState() {
  // Extensão recarregada: este script virou órfão — para o poll em vez de estourar erro a cada 2s.
  if (!chrome.runtime?.id) { clearInterval(pollTimer); return; }
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

/* ── Aviso prévio: ponte entre o popup e o script wa-mic-inject.js (que roda na página) ── */
const CALL_SERVER_URL = 'https://api.centraluniko.com.br';
let avisoSeq = 0;

function micCall(type, extra = {}, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const id = ++avisoSeq;
    const onMsg = (e) => {
      if (e.source !== window || e.data?.source !== 'uniko-mic' || e.data.id !== id) return;
      if (e.data.type === 'PLAY_ENDED') return; // só o PLAYED resolve
      window.removeEventListener('message', onMsg); clearTimeout(t); resolve(e.data);
    };
    const t = setTimeout(() => { window.removeEventListener('message', onMsg); resolve(null); }, timeoutMs);
    window.addEventListener('message', onMsg);
    window.postMessage({ target: 'uniko-mic', type, id, ...extra }, '*');
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UNIKO_AVISO_PING') {
    micCall('PING').then((r) => sendResponse({ injected: !!r, active: !!r?.active }));
    return true;
  }
  if (message.type === 'UNIKO_AVISO_PLAY') {
    (async () => {
      try {
        const res = await fetch(`${CALL_SERVER_URL}/api/uniko-call/aviso-audio`, { headers: { Authorization: 'Bearer uniko-call-rec' } });
        if (!res.ok) throw new Error('servidor respondeu ' + res.status);
        const buf = await res.arrayBuffer();
        const r = await micCall('PLAY', { buf }, 8000);
        if (!r) return sendResponse({ ok: false, error: 'O script do microfone não respondeu. Dê F5 no WhatsApp Web e tente de novo.' });
        sendResponse({ ok: !!r.ok, seconds: r.seconds, error: r.error });
      } catch (e) {
        sendResponse({ ok: false, error: 'Não consegui buscar o áudio do aviso: ' + e.message });
      }
    })();
    return true;
  }
});
