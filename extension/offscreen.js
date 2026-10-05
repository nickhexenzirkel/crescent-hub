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
let meta = { contactName: null, startedAt: null, test: false };

// Log em cada passo (temporário, pra diagnóstico ao vivo 24/set/2026 — nada
// estava chegando no servidor e nem erro nenhum sobrava pra seguir a pista).
console.log('[uniko-call] offscreen.js carregado e ouvindo mensagens.');

async function startCapture(streamId, contactName, test = false) {
  console.log('[uniko-call] startCapture() chamado — streamId:', streamId, 'contactName:', contactName);
  if (recorder && recorder.state === 'recording') { console.log('[uniko-call] já estava gravando — ignorando start duplicado.'); return; }
  meta = { contactName: contactName || null, startedAt: new Date().toISOString(), test };
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

  audioContext = new AudioContext();
  // Sem gesto do usuário nesta página, o AudioContext pode nascer "suspended" e o
  // MediaRecorder grava SILÊNCIO (transcrição vazia -> "aviso prévio não dito").
  await audioContext.resume().catch(() => {});
  console.log('[uniko-call] AudioContext state:', audioContext.state);
  const dest = audioContext.createMediaStreamDestination();
  const tabSrc = audioContext.createMediaStreamSource(tabStream);
  const micSrc = audioContext.createMediaStreamSource(micStream);
  tabSrc.connect(dest);
  micSrc.connect(dest);
  startLevelMeter(tabSrc, micSrc);

  // chrome.tabCapture "rouba" o áudio da aba pro nosso stream — sem isso o
  // colaborador ficaria SURDO durante a ligação. Reconecta de volta pros
  // alto-falantes normais.
  audioContext.createMediaStreamSource(tabStream).connect(audioContext.destination);

  // Bitrate padrão do Opus no MediaRecorder é baixo (~32kbps) e deixa a fala "metálica" — 128kbps.
  recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
  recorder.ondataavailable = (e) => { console.log('[uniko-call] chunk recebido, bytes:', e.data.size); if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = uploadRecording;
  // Em modo teste, fatias de 1s permitem transcrever o que ja foi gravado enquanto a pessoa fala.
  recorder.start();
  if (meta.test) startLiveTranscription(tabSrc, micSrc);
  console.log('[uniko-call] MediaRecorder.start() chamado — state agora:', recorder.state);
  chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'recording' }).catch(() => {});
}

// Mesma regra do servidor (uniko-call.js): >=2 de 3 grupos de conceito. So pra mostrar o resultado
// do teste na hora; a decisao de verdade, em ligacoes reais, continua sendo do servidor.
const CONSENT_GROUPS = [['seguranc'], ['grav'], ['atendiment', 'ligac', 'chamad', 'conversa']];
function hasConsentNotice(text) {
  const norm = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
  return CONSENT_GROUPS.filter(g => g.some(st => norm.includes(st))).length >= 2;
}

// Transcricao "ao vivo" do teste, com deteccao de fala (VAD): captura PCM, separa em
// frases pelo volume e so manda pro servidor o que tem voz. Silencio nunca e transcrito
// (era isso que fazia o Whisper inventar/estender texto quando ninguem falava).
// A 1a palavra e reconhecida ~1s depois de falada, sem esperar fechar nenhum ciclo.
// So no modo teste - nada e salvo no servidor.
const VAD_TH = 0.012;          // RMS minimo pra contar como voz
const VAD_HANG_MS = 800;       // silencio que encerra uma frase
const VAD_PARTIAL_MS = 2500;   // de quanto em quanto tempo atualiza a frase em andamento
let live = null;
let lastLive = null; // sessao de teste que acabou de parar (usada no resultado final)

function startLiveTranscription(tabSrc, micSrc) {
  stopLiveTranscription();
  const sr = audioContext.sampleRate;
  const proc = audioContext.createScriptProcessor(4096, 1, 1);
  const mix = audioContext.createGain();
  tabSrc.connect(mix); micSrc.connect(mix);
  mix.connect(proc);
  const mute = audioContext.createGain(); mute.gain.value = 0;
  proc.connect(mute); mute.connect(audioContext.destination); // precisa estar ligado pra rodar, mudo
  live = { sr, proc, mix, mute, pre: [], utt: [], all: [], inUtt: false, lastSpeech: 0, lastSend: 0,
           busy: false, committed: '', seq: 0, timer: 0, peakRms: 0 };
  proc.onaudioprocess = (e) => {
    const d = new Float32Array(e.inputBuffer.getChannelData(0)); // copia
    let sum = 0; for (let k = 0; k < d.length; k++) sum += d[k] * d[k];
    const rms = Math.sqrt(sum / d.length);
    const now = Date.now();
    if (rms > VAD_TH) {
      live.lastSpeech = now;
      if (!live.inUtt) { live.inUtt = true; live.utt = live.pre.slice(); live.lastSend = 0; }
      live.peakRms = Math.max(live.peakRms, rms);
    }
    if (live.inUtt) { live.utt.push(d); live.all.push(d); }
    else { live.pre.push(d); if (live.pre.length > 2) live.pre.shift(); }
  };
  live.timer = setInterval(liveTick, 300);
}

function stopLiveTranscription() {
  if (!live) return;
  clearInterval(live.timer);
  try { live.proc.onaudioprocess = null; live.proc.disconnect(); live.mix.disconnect(); live.mute.disconnect(); } catch { /* ja desconectado */ }
  live.stopped = true;
}

function framesToWav(frames, sr) {
  const n = frames.reduce((a, f) => a + f.length, 0);
  const ratio = Math.max(1, Math.round(sr / 16000));
  const outRate = Math.round(sr / ratio);
  const outLen = Math.floor(n / ratio);
  const pcm = new Int16Array(outLen);
  let idx = 0, acc = 0, cnt = 0, o = 0;
  for (const f of frames) for (let k = 0; k < f.length; k++) {
    acc += f[k]; cnt++;
    if (cnt === ratio) { const v = Math.max(-1, Math.min(1, acc / ratio)); if (o < outLen) pcm[o++] = v < 0 ? v * 0x8000 : v * 0x7fff; acc = 0; cnt = 0; }
    idx++;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (off, t) => { for (let k = 0; k < t.length; k++) v.setUint8(off + k, t.charCodeAt(k)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

async function transcribeWav(blob) {
  const form = new FormData();
  form.append('audio', blob, 'test.wav');
  const res = await fetch(`${CALL_SERVER}/api/uniko-call/test`, { method: 'POST', headers: { Authorization: `Bearer ${CALL_UPLOAD_TOKEN}` }, body: form });
  return res.ok ? res.json() : { error: `servidor respondeu ${res.status}` };
}

async function liveTick() {
  if (!live || live.busy || !live.inUtt) return;
  const now = Date.now();
  const ended = now - live.lastSpeech > VAD_HANG_MS;
  if (!ended && now - live.lastSend < VAD_PARTIAL_MS) return;
  const frames = live.utt.slice();
  if (!frames.length) return;
  live.busy = true; live.lastSend = now;
  const seq = ++live.seq;
  const lv = live;
  try {
    const data = await transcribeWav(framesToWav(frames, lv.sr));
    const text = (data.text || '').trim();
    if (ended) { if (text) lv.committed = (lv.committed + ' ' + text).trim(); lv.inUtt = false; lv.utt = []; }
    if (!lv.stopped) chrome.runtime.sendMessage({ type: 'UNIKO_CALL_TEST_PARTIAL', seq, committed: lv.committed, current: ended ? '' : text }).catch(() => {});
  } catch { /* proxima rodada tenta de novo */ }
  lv.busy = false;
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
    // Níveis ao vivo pro popup (medidor de calibração) — ignorado se o popup estiver fechado.
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_LEVELS', tab, mic, peakTab: peaks.tab, peakMic: peaks.mic, test: meta.test }).catch(() => {});
  }, 200);
  // Teste de calibração dura no máximo 10s e para sozinho.
  if (meta.test) setTimeout(() => { if (recorder && recorder.state === 'recording') stopCapture(); }, 30000);
}

function stopCapture() {
  clearInterval(levelTimer);
  const finalLive = live; stopLiveTranscription(); lastLive = finalLive; live = null;
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
  if (meta.test) {
    // Modo calibracao: o texto ja foi sendo transcrito AO VIVO (frases fechadas em lv.committed).
    // Aqui so falta a ultima frase, se ainda estava em andamento — no maximo 1 requisicao, com
    // prazo curto, pra o resultado final nunca ficar "Finalizando..." esperando limite de API.
    const lv = lastLive;
    const send = (extra) => chrome.runtime.sendMessage({ type: 'UNIKO_CALL_TEST_RESULT', peakTab: peaks.tab, peakMic: peaks.mic, ...extra }).catch(() => {});
    let text = lv ? lv.committed : '';
    let error = null;
    try {
      const t0 = Date.now();
      while (lv && lv.busy && Date.now() - t0 < 8000) await new Promise(r => setTimeout(r, 200)); // espera o envio em curso
      if (lv && lv.inUtt && lv.utt.length && !lv.busy) {
        const data = await Promise.race([
          transcribeWav(framesToWav(lv.utt, lv.sr)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('a transcricao da ultima frase demorou demais')), 15000)),
        ]);
        if (data.error) error = data.error;
        const last = (data.text || '').trim();
        if (last) text = (text + ' ' + last).trim();
      }
    } catch (e) { error = e.message; }
    const audioB64 = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob); });
    send({ text, consentGiven: hasConsentNotice(text), audioB64, error: text ? null : error });
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'test_done' }).catch(() => {});
    return;
  }
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
  if (message.type === 'UNIKO_CALL_START') startCapture(message.streamId, message.contactName, !!message.test).catch((e) => {
    console.error('[uniko-call] falha ao iniciar captura:', e.name, e.message);
    // Solta o que já tinha sido aberto (ex.: tab ok mas microfone negado), senão a aba fica "presa".
    [tabStream, micStream].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
    tabStream = null; micStream = null;
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_STATE', state: 'capture_error', error: e.message }).catch(() => {});
  });
  if (message.type === 'UNIKO_CALL_STOP') stopCapture();
});

// Avisa o background que o listener já existe (necessário no fallback em janela, ver background.js).
chrome.runtime.sendMessage({ type: 'UNIKO_CALL_RECORDER_READY' }).catch(() => {});
