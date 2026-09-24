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

// Log em cada passo (temporário, pra diagnóstico ao vivo 24/set/2026 — nada
// estava chegando no servidor e nem erro nenhum sobrava pra seguir a pista).
console.log('[uniko-call] offscreen.js carregado e ouvindo mensagens.');

async function startCapture(streamId, contactName) {
  console.log('[uniko-call] startCapture() chamado — streamId:', streamId, 'contactName:', contactName);
  if (recorder && recorder.state === 'recording') { console.log('[uniko-call] já estava gravando — ignorando start duplicado.'); return; }
  meta = { contactName: contactName || null, startedAt: new Date().toISOString() };
  chunks = [];

  console.log('[uniko-call] pedindo tabStream (getUserMedia tab)...');
  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  });
  console.log('[uniko-call] tabStream OK. Pedindo micStream (getUserMedia mic)...');
  // getUserMedia com mic — se o usuário nunca autorizou microfone pra essa
  // extensão antes, isso falha silenciosamente aqui (offscreen document não
  // consegue mostrar o prompt de permissão, precisa ter sido autorizado
  // antes numa página visível — ver popup.html, que pede a permissão na
  // primeira vez que o colaborador abre o popup).
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log('[uniko-call] micStream OK. Montando AudioContext e MediaRecorder...');

  audioContext = new AudioContext();
  const dest = audioContext.createMediaStreamDestination();
  audioContext.createMediaStreamSource(tabStream).connect(dest);
  audioContext.createMediaStreamSource(micStream).connect(dest);

  // chrome.tabCapture "rouba" o áudio da aba pro nosso stream — sem isso o
  // colaborador ficaria SURDO durante a ligação. Reconecta de volta pros
  // alto-falantes normais.
  audioContext.createMediaStreamSource(tabStream).connect(audioContext.destination);

  recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
  recorder.ondataavailable = (e) => { console.log('[uniko-call] chunk recebido, bytes:', e.data.size); if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = uploadRecording;
  recorder.start();
  console.log('[uniko-call] MediaRecorder.start() chamado — state agora:', recorder.state);
  chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'recording' }).catch(() => {});
}

function stopCapture() {
  console.log('[uniko-call] stopCapture() chamado — recorder existe?', !!recorder, 'state:', recorder?.state);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  [tabStream, micStream].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
  audioContext?.close();
  audioContext = null; tabStream = null; micStream = null;
}

async function uploadRecording() {
  console.log('[uniko-call] uploadRecording() chamado — chunks acumulados:', chunks.length);
  if (!chunks.length) {
    console.warn('[uniko-call] NENHUM chunk gravado — nada pra subir (recorder rodou sem capturar áudio?).');
    // Mesmo sem áudio, PRECISA avisar o background — sem isso o estado
    // ficava preso em "recording" pra sempre (achado ao vivo 24/set/2026),
    // travando toda tentativa de gravar de novo com "Cannot capture a tab
    // with an active stream" (o offscreen document nunca fechava).
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'upload_error', error: 'nenhum áudio capturado' }).catch(() => {});
    return;
  }
  const blob = new Blob(chunks, { type: 'audio/webm' });
  chunks = [];
  console.log('[uniko-call] enviando blob de', blob.size, 'bytes pro servidor...');
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
    console.log('[uniko-call] resposta do upload — status:', res.status, res.ok ? 'OK' : 'FALHOU');
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: res.ok ? 'uploaded' : 'upload_error' }).catch(() => {});
  } catch (e) {
    console.error('[uniko-call] falha no upload:', e.message);
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'upload_error' }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message) => {
  console.log('[uniko-call] offscreen recebeu mensagem:', message.type);
  if (message.type === 'UNIKO_CALL_START') startCapture(message.streamId, message.contactName).catch((e) => {
    console.error('[uniko-call] falha ao iniciar captura:', e.name, e.message);
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'capture_error', error: e.message }).catch(() => {});
  });
  if (message.type === 'UNIKO_CALL_STOP') stopCapture();
});
