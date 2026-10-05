const $ = (id) => document.getElementById(id);
const dot = $('dot'), statusText = $('statusText'), micBtn = $('micBtn'), micOk = $('micOk');
const toggleBtn = $('toggleBtn'), recordingNotice = $('recordingNotice');
const avisoBtn = $('avisoBtn'), avisoStatus = $('avisoStatus'), avisoProg = $('avisoProg'), avisoProgBar = $('avisoProgBar');
const micFill = $('micFill'), tabFill = $('tabFill'), micChk = $('micChk'), tabChk = $('tabChk');

// "Microfone autorizado" no rodapé em vez do botão quando a permissão já foi concedida
// (a autorização é pedida numa ABA — permissoes.html — porque o popup fecha rápido demais pro prompt).
async function refreshMicStatus() {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    const granted = status.state === 'granted';
    micOk.style.display = granted ? 'inline-flex' : 'none';
    micBtn.style.display = granted ? 'none' : 'block';
    status.onchange = refreshMicStatus;
  } catch { micBtn.style.display = 'block'; }
}
refreshMicStatus();
micBtn.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('permissoes.html') }));

/* ── Estado da gravação ─────────────────────────────────────────────────── */
function render(state, msg) {
  const recording = state === 'recording';
  const aguardando = state === 'aguardando';
  dot.className = 'dot' + (recording ? ' recording' : aguardando ? ' aguardando' : '');
  statusText.textContent = msg || (recording ? 'Gravando chamada…' : aguardando ? 'Chamada detectada' : 'Sem gravação ativa');
  statusText.title = statusText.textContent;
  statusText.dataset.state = state; statusText.dataset.msg = msg || '';
  toggleBtn.textContent = recording ? '⏹ Parar gravação' : '⏺ Iniciar gravação manual';
  toggleBtn.className = (recording ? 'danger' : 'primary') + (!recording && avisoState.phase === 'ended' ? ' ready' : '');
  recordingNotice.style.display = recording ? 'block' : 'none';
}

chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' })
  .then((res) => render(res?.state || 'idle', res?.state !== 'recording' ? res?.error : null))
  .catch(() => render('idle'));

// IMPORTANTE: chrome.tabCapture.getMediaStreamId() só funciona chamado AQUI, direto na resposta ao
// clique (gesto do usuário). Sem `targetTabId`: captura a aba ATIVA — o WhatsApp Web precisa estar em primeiro plano.
async function getStreamIdWithRetry() {
  try { return await chrome.tabCapture.getMediaStreamId(); }
  catch (e) {
    if (!/active stream/i.test(e.message || '')) throw e;
    // Sobrou uma captura presa (gravador antigo): fecha e tenta de novo, no mesmo clique.
    await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_RESET' }).catch(() => {});
    await new Promise(r => setTimeout(r, 700));
    return await chrome.tabCapture.getMediaStreamId();
  }
}

toggleBtn.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' });
  if (res?.state === 'recording') {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_MANUAL_STOP' });
    render('idle');
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('web.whatsapp.com')) { render('idle', 'Abra o WhatsApp Web nesta aba.'); return; }
    const streamId = await getStreamIdWithRetry();
    // Nome do contato: pergunta pra TODAS as abas do WhatsApp Web (a "ativa" pode ser outra, ex.: Picture-in-Picture);
    // se o content script estiver órfão (extensão recarregada sem F5), reinjeta e pergunta de novo.
    let contactName = null, contentScriptStale = false;
    try {
      const waTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
      for (const t of waTabs) {
        try {
          const r = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_CALL_QUERY_CONTACT' });
          if (r?.contactName) { contactName = r.contactName; break; }
        } catch {
          try {
            await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['whatsapp-call-detect.js'] });
            const r2 = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_CALL_QUERY_CONTACT' });
            if (r2?.contactName) { contactName = r2.contactName; break; }
          } catch { /* sem resposta nessa aba */ }
        }
      }
      if (!contactName && waTabs.length) contentScriptStale = true;
    } catch { /* segue sem nome */ }
    await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_START_WITH_STREAM', streamId, contactName });
    // Confirma o estado REAL: espera a gravação subir ou o erro aparecer.
    render('aguardando', 'Iniciando gravação…');
    let real = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 400));
      real = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).catch(() => null);
      if (real?.state === 'recording' || real?.error) break;
    }
    if (real?.state === 'recording') render('recording', contentScriptStale ? 'Gravando (sem nome — F5 no WhatsApp)' : null);
    else render('idle', real?.error || 'A gravação não iniciou. Tente de novo.');
  } catch (e) { render('idle', `Falhou: ${e.message}`); }
});

/* ── Aviso prévio ────────────────────────────────────────────────────────
   O áudio do aviso (voz sintética no servidor) entra no MICROFONE da ligação (wa-mic-inject.js).
   O estado (tocando / concluído) fica em chrome.storage.session pra sobreviver ao popup fechar. */
let avisoState = { phase: 'idle' };
let avisoTimer = null;
const setAviso = (cls, msg) => { avisoStatus.className = 'line ' + cls; avisoStatus.textContent = msg; };

function renderAviso() {
  clearInterval(avisoTimer);
  const a = avisoState;
  if (a.phase === 'playing' && a.at && a.seconds) {
    const tick = () => {
      const elapsed = (Date.now() - a.at) / 1000;
      if (elapsed >= a.seconds + 0.5) { clearInterval(avisoTimer); avisoState = { ...a, phase: 'ended' }; renderAviso(); return; }
      avisoProg.className = 'prog show';
      avisoProgBar.style.width = Math.min(100, (elapsed / a.seconds) * 100) + '%';
      setAviso('', `🔊 Tocando o aviso… ${Math.max(0, Math.ceil(a.seconds - elapsed))}s`);
      avisoBtn.disabled = true;
    };
    tick(); avisoTimer = setInterval(tick, 250);
    return;
  }
  avisoBtn.disabled = false;
  avisoProg.className = 'prog';
  if (a.phase === 'ended' && Date.now() - (a.at || 0) < 10 * 60 * 1000) {
    setAviso('ok', '✅ Aviso concluído — agora clique em “Iniciar gravação”.');
    avisoBtn.textContent = '🔔 Tocar aviso novamente';
  } else {
    avisoBtn.textContent = '🔔 Tocar aviso na ligação';
    refreshAvisoReadiness();
  }
  render(statusText.dataset.state || 'idle', statusText.dataset.msg || null);
}

async function waTabs() { return chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }); }

async function refreshAvisoReadiness() {
  const tabs = await waTabs();
  if (!tabs.length) { setAviso('bad', 'Abra o WhatsApp Web.'); return; }
  for (const t of tabs) {
    try {
      const r = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_AVISO_PING' });
      if (r?.injected) { setAviso(r.active ? 'ok' : '', r.active ? '✅ Ligação com microfone ativo — pode tocar.' : 'Pronto. Toque quando atender a ligação.'); return; }
    } catch { /* tenta a próxima aba */ }
  }
  setAviso('bad', 'Dê F5 no WhatsApp Web (extensão atualizada) e abra o popup de novo.');
}

chrome.storage.session?.get('unikoAviso').then(({ unikoAviso }) => { avisoState = unikoAviso || { phase: 'idle' }; renderAviso(); }).catch(() => renderAviso());
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'session' && ch.unikoAviso) { avisoState = ch.unikoAviso.newValue || { phase: 'idle' }; renderAviso(); }
});

avisoBtn.addEventListener('click', async () => {
  avisoBtn.disabled = true; setAviso('', 'Preparando o aviso…');
  try {
    const tabs = await waTabs();
    if (!tabs.length) throw new Error('Abra o WhatsApp Web.');
    let last = null;
    for (const t of tabs) {
      try { last = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_AVISO_PLAY' }); if (last?.ok) break; }
      catch { last = { ok: false, error: 'Dê F5 no WhatsApp Web e tente de novo.' }; }
    }
    if (!last?.ok) { setAviso('bad', '❌ ' + (last?.error || 'Não foi possível tocar o aviso.')); avisoBtn.disabled = false; }
    // Em caso de sucesso, o content script já avisou o background (estado "tocando" → "concluído").
  } catch (e) { setAviso('bad', '❌ ' + e.message); avisoBtn.disabled = false; }
});

/* ── Medidores + teste de áudio/transcrição ──────────────────────────────── */
const setBar = (fill, v) => { const pct = Math.min(100, Math.round(Math.sqrt(v) * 100)); fill.style.width = pct + '%'; fill.classList.toggle('low', pct < 8); };

let localMic = null; // medidor local do microfone (só quando ocioso)
async function startLocalMicMeter() {
  if (localMic) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(512);
    localMic = { stream, ctx, raf: 0, heard: false };
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
      const level = m / 128;
      setBar(micFill, level);
      if (level > 0.05 && !localMic.heard) { localMic.heard = true; micChk.textContent = '✅'; }
      localMic.raf = requestAnimationFrame(loop);
    };
    loop();
  } catch { micChk.textContent = '❌'; }
}
function stopLocalMicMeter() {
  if (!localMic) return;
  cancelAnimationFrame(localMic.raf);
  localMic.stream.getTracks().forEach(t => t.stop());
  localMic.ctx.close().catch(() => {});
  localMic = null;
}

chrome.runtime.onMessage.addListener((m) => {
  if (m.type === 'UNIKO_CALL_LEVELS') {
    stopLocalMicMeter(); // o gravador já mede o mic
    setBar(micFill, m.mic); setBar(tabFill, m.tab);
    micChk.textContent = m.peakMic > 0.05 ? '✅' : '…';
    tabChk.textContent = m.peakTab > 0.02 ? '✅' : '…';
  }
});

// Medidor local só quando ocioso; resultado do último teste se o popup fechou durante a finalização.
chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).then((res) => {
  if (res?.state !== 'recording' && res?.state !== 'testing') startLocalMicMeter();
}).catch(() => startLocalMicMeter());
window.addEventListener('unload', stopLocalMicMeter);

/* ── Últimos atendimentos (histórico local deste navegador) ──────────────── */
const histEl = $('hist');
function fmtQuando(ts) {
  const d = new Date(ts);
  const hoje = new Date(); const ontem = new Date(Date.now() - 86400000);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoje.toDateString()) return `hoje ${hm}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem ${hm}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hm;
}
function fmtDur(a, b) {
  if (!b) return '';
  const m = Math.max(1, Math.round((b - a) / 60000));
  return ` · ${m} min`;
}
function renderHist(list) {
  const items = (list || []).slice(0, 3);
  if (!items.length) { histEl.innerHTML = '<span class="none">Nenhum atendimento gravado ainda.</span>'; return; }
  histEl.textContent = '';
  for (const it of items) {
    const row = document.createElement('div'); row.className = 'row';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = it.name; n.title = it.name;
    const w = document.createElement('span'); w.className = 'w'; w.textContent = fmtQuando(it.at) + fmtDur(it.at, it.endedAt);
    row.append(n, w); histEl.append(row);
  }
}
chrome.storage.local.get('unikoCallHistory').then(({ unikoCallHistory }) => renderHist(unikoCallHistory)).catch(() => {});
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.unikoCallHistory) renderHist(ch.unikoCallHistory.newValue); });
