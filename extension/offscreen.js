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
let meta = { contactName: null, startedAt: null, avisoPlayed: false, attendantToken: '' };
let recDest = null; // destino da mistura gravada (aba + microfone) — o aviso também entra aqui

// Log em cada passo (temporário, pra diagnóstico ao vivo 24/set/2026 — nada
// estava chegando no servidor e nem erro nenhum sobrava pra seguir a pista).
console.log('[uniko-call] offscreen.js carregado e ouvindo mensagens.');

async function startCapture(streamId, contactName, avisoRecent = false, attendantToken = '') {
  console.log('[uniko-call] startCapture() chamado — streamId:', streamId, 'contactName:', contactName);
  if (recorder && recorder.state === 'recording') { console.log('[uniko-call] já estava gravando — ignorando start duplicado.'); return; }
  meta = { contactName: contactName || null, startedAt: new Date().toISOString(), avisoPlayed: !!avisoRecent, attendantToken: attendantToken || '' };
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
  // Cancelamento de eco/ruído/ganho automático: sem isso o microfone capta de volta o som
// da aba que sai nos alto-falantes (eco) e a fala fica embolada/baixa pro Whisper.
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  console.log('[uniko-call] micStream OK. Montando AudioContext e MediaRecorder...');

  // 48 kHz = taxa nativa do áudio de ligação (WebRTC/tabCapture): evita reamostragem (que gera chiado/falhas)
  // quando o dispositivo de saída usa outra taxa (ex.: fone Bluetooth). latencyHint 'playback' usa buffers
  // maiores — menos chance de "estalos" quando a página está ocupada.
  audioContext = new AudioContext({ sampleRate: 48000, latencyHint: 'playback' });
  // Sem gesto do usuário nesta página, o AudioContext pode nascer "suspended" e o
  // MediaRecorder grava SILÊNCIO (transcrição vazia -> "aviso prévio não dito").
  await audioContext.resume().catch(() => {});
  console.log('[uniko-call] AudioContext state:', audioContext.state);
  const dest = audioContext.createMediaStreamDestination();
  recDest = dest;
  const tabSrc = audioContext.createMediaStreamSource(tabStream);
  const micSrc = audioContext.createMediaStreamSource(micStream);
  // Somar duas vozes no volume cheio estoura 100% e distorce ("grunhidos" na voz de quem está na linha).
  // Cada fonte entra com ganho 0,8 e um limitador suave segura os picos antes de gravar.
  const tabGain = audioContext.createGain(); tabGain.gain.value = 0.8;
  const micGain = audioContext.createGain(); micGain.gain.value = 0.8;
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.003; limiter.release.value = 0.1;
  tabSrc.connect(tabGain).connect(limiter);
  micSrc.connect(micGain).connect(limiter);
  limiter.connect(dest);
  startLevelMeter(tabSrc, micSrc);

  // chrome.tabCapture "rouba" o áudio da aba pro nosso stream — sem isso o
  // colaborador ficaria SURDO durante a ligação. Reconecta de volta pros
  // alto-falantes normais.
  tabSrc.connect(audioContext.destination); // mesma fonte (não cria uma segunda leitura do stream)

  // Bitrate padrão do Opus no MediaRecorder é baixo (~32kbps) e deixa a fala "metálica" — 128kbps.
  recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
  recorder.ondataavailable = (e) => { console.log('[uniko-call] chunk recebido, bytes:', e.data.size); if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = uploadRecording;
  recorder.start();
  console.log('[uniko-call] MediaRecorder.start() chamado — state agora:', recorder.state);
  chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'recording' }).catch(() => {});
}

// Mede o pico de volume da aba e do microfone durante a gravação e loga ao parar —
// mostra de que lado vem o silêncio, se voltar a acontecer.
let levelTimer = null;
const peaks = { tab: 0, mic: 0 };
function startLevelMeter(tabSrc, micSrc) {
  peaks.tab = 0; peaks.mic = 0;
  const mk = (src) => { const a = audioContext.createAnalyser(); a.fftSize = 512; src.connect(a); return a; };
  const aTab = mk(tabSrc), aMic = mk(micSrc);
  const buf = new Uint8Array(512);
  const peak = (a) => { a.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); return m / 128; };
  clearInterval(levelTimer);
  levelTimer = setInterval(() => {
    const tab = peak(aTab), mic = peak(aMic);
    peaks.tab = Math.max(peaks.tab, tab); peaks.mic = Math.max(peaks.mic, mic);
    // Níveis ao vivo pro popup (medidores) — ignorado se o popup estiver fechado.
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_LEVELS', tab, mic, peakTab: peaks.tab, peakMic: peaks.mic }).catch(() => {});
  }, 200);
}

function stopCapture() {
  clearInterval(levelTimer);
  console.log('[uniko-call] picos de volume — aba:', peaks.tab.toFixed(3), 'microfone:', peaks.mic.toFixed(3), '(0 = mudo)');
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
    form.append('avisoPlayed', meta.avisoPlayed ? 'true' : 'false');
    form.append('endedAt', new Date().toISOString());
    // Quem fez a ligação (login do popup). Sem token a gravação sobe do mesmo jeito, sem atendente.
    const attendantToken = await Promise.race([
      chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_ATTENDANT_TOKEN' }).then((r) => r?.token || '').catch(() => ''),
      new Promise((r) => setTimeout(() => r(''), 3000)),
    ]);
    const tokenFinal = attendantToken || meta.attendantToken || '';
    console.log('[uniko-call] token do atendente no envio:', tokenFinal ? 'presente' : 'AUSENTE (sem login no popup)');
    form.append('attendantToken', tokenFinal);
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
  if (message.type === 'UNIKO_CALL_START') startCapture(message.streamId, message.contactName, !!message.avisoRecent, message.attendantToken || '').catch((e) => {
    console.error('[uniko-call] falha ao iniciar captura:', e.name, e.message);
    // Solta o que já tinha sido aberto (ex.: tab ok mas microfone negado), senão a aba fica "presa".
    [tabStream, micStream].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
    tabStream = null; micStream = null;
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'capture_error', error: e.message }).catch(() => {});
  });
  if (message.type === 'UNIKO_CALL_STOP') stopCapture();
  if (message.type === 'UNIKO_CALL_AVISO_MARK') { meta.avisoPlayed = true; console.log('[uniko-call] aviso prévio marcado como dado nesta gravação.'); }
});

// Avisa o background que o listener já existe (necessário no fallback em janela, ver background.js).
chrome.runtime.sendMessage({ type: 'UNIKO_CALL_RECORDER_READY' }).catch(() => {});
