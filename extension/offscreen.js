// Offscreen document — só existe pra ter acesso a DOM/Web Audio/MediaRecorder,
// que o service worker do background NÃO tem. Faz a captura de verdade:
// áudio da aba do WhatsApp Web (chrome.tabCapture, via streamId que o
// background já pegou) + microfone do colaborador, mixados num só arquivo.
//
// Sem chave de usuário logado aqui (é extensão, não a página React) — o
// upload pro servidor usa um token fixo compartilhado, mesmo padrão do
// UNIKO_YT_AUTO_COOKIES em background.js.
const CALL_SERVER = 'https://api.centraluniko.com.br';
const CALL_UPLOAD_TOKEN = 'uniko-call-rec';

let audioContext = null;
let recorder = null;
let chunks = [];
let tabStream = null;
let micStream = null;
let meta = { contactName: null, startedAt: null };

async function startCapture(streamId, contactName) {
  if (recorder && recorder.state === 'recording') return; // já gravando, ignora start duplicado
  meta = { contactName: contactName || null, startedAt: new Date().toISOString() };
  chunks = [];

  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  });
  // getUserMedia com mic — se o usuário nunca autorizou microfone pra essa
  // extensão antes, isso falha silenciosamente aqui (offscreen document não
  // consegue mostrar o prompt de permissão, precisa ter sido autorizado
  // antes numa página visível — ver popup.html, que pede a permissão na
  // primeira vez que o colaborador abre o popup).
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioContext = new AudioContext();
  const dest = audioContext.createMediaStreamDestination();
  audioContext.createMediaStreamSource(tabStream).connect(dest);
  audioContext.createMediaStreamSource(micStream).connect(dest);

  // chrome.tabCapture "rouba" o áudio da aba pro nosso stream — sem isso o
  // colaborador ficaria SURDO durante a ligação. Reconecta de volta pros
  // alto-falantes normais.
  audioContext.createMediaStreamSource(tabStream).connect(audioContext.destination);

  recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = uploadRecording;
  recorder.start();
  chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'recording' }).catch(() => {});
}

function stopCapture() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  [tabStream, micStream].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
  audioContext?.close();
  audioContext = null; tabStream = null; micStream = null;
}

async function uploadRecording() {
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: 'audio/webm' });
  chunks = [];
  try {
    const form = new FormData();
    form.append('audio', blob, 'call.webm');
    form.append('contactName', meta.contactName || '');
    form.append('startedAt', meta.startedAt || new Date().toISOString());
    form.append('endedAt', new Date().toISOString());
    const res = await fetch(`${CALL_SERVER}/api/uniko-call/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CALL_UPLOAD_TOKEN}` },
      body: form,
    });
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: res.ok ? 'uploaded' : 'upload_error' }).catch(() => {});
  } catch (e) {
    console.error('[uniko-call] falha no upload:', e.message);
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'upload_error' }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UNIKO_CALL_START') startCapture(message.streamId, message.contactName).catch((e) => {
    console.error('[uniko-call] falha ao iniciar captura:', e.message);
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'capture_error', error: e.message }).catch(() => {});
  });
  if (message.type === 'UNIKO_CALL_STOP') stopCapture();
});
