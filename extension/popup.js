const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const micBtn = document.getElementById('micBtn');
const micOk = document.getElementById('micOk');
const toggleBtn = document.getElementById('toggleBtn');
const recordingNotice = document.getElementById('recordingNotice');

// Mostra "Microfone autorizado, ativo" em vez do botão quando a permissão já
// foi concedida antes (ver permissoes.html) — sem isso o botão "Autorizar
// microfone" fica lá pra sempre, sem nenhum jeito de saber se já tinha sido
// autorizado ou não (dava a impressão de que nunca funcionou).
async function refreshMicStatus() {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    const granted = status.state === 'granted';
    micOk.style.display = granted ? 'flex' : 'none';
    micBtn.style.display = granted ? 'none' : 'block';
    status.onchange = refreshMicStatus;
  } catch {
    // Permissions API sem suporte a 'microphone' nesse Chrome — mantém o
    // botão sempre visível (comportamento de antes), sem quebrar a tela.
  }
}
refreshMicStatus();

function render(state, msg) {
  const recording = state === 'recording';
  const aguardando = state === 'aguardando';
  dot.className = 'dot' + (recording ? ' recording' : aguardando ? ' aguardando' : '');
  statusText.textContent =
    msg || (recording ? 'Gravando chamada…' : aguardando ? 'Chamada detectada — clique pra gravar' : 'Sem gravação ativa');
  toggleBtn.textContent = recording ? 'Parar gravação' : 'Iniciar gravação manual';
  toggleBtn.className = recording ? 'danger' : 'primary';
  recordingNotice.className = 'recordingNotice' + (recording ? ' show' : '');
}

chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).then((res) => render(res?.state || 'idle', res?.state !== 'recording' ? res?.error : null)).catch(() => render('idle'));

// Abre numa ABA (não pede aqui no popup) — o Chrome não mostra o prompt de
// permissão direito numa janela de popup de extensão (fecha rápido demais /
// contexto efêmero demais), costuma devolver "Permission denied" na hora,
// mesmo sem o usuário ter clicado em nada. Ver permissoes.html/js.
micBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('permissoes.html') });
});

// IMPORTANTE: chrome.tabCapture.getMediaStreamId() só funciona chamado bem
// AQUI, direto na resposta ao clique — é o gesto do usuário que autoriza a
// captura. Se esse pedido acontecer em outro lugar (ex.: no background,
// depois de um "await" no meio do caminho), o Chrome recusa com erro
// silencioso ("falha ao iniciar" no console) — achado ao vivo (23/set/2026).
// Sem `targetTabId`: captura a aba ATIVA — por isso é essencial que o
// WhatsApp Web esteja em primeiro plano quando o usuário clicar aqui.
toggleBtn.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' });
  if (res?.state === 'recording') {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_MANUAL_STOP' });
    render('idle');
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('web.whatsapp.com')) {
      render('idle', 'Abra o WhatsApp Web nesta aba antes de gravar.');
      return;
    }
    let streamId;
    try {
      streamId = await chrome.tabCapture.getMediaStreamId();
    } catch (e) {
      if (!/active stream/i.test(e.message || '')) throw e;
      // Sobrou uma captura presa (gravador antigo): fecha e tenta de novo, no mesmo clique.
      await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_RESET' }).catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      streamId = await chrome.tabCapture.getMediaStreamId();
    }
    console.log('[uniko-call] popup: streamId obtido:', streamId);
    // Pergunta o nome pra TODAS as abas do WhatsApp Web abertas, não só a
    // "aba ativa" — achado ao vivo 24/set/2026: mesmo com a ligação em
    // andamento na aba certa, a "aba ativa" na hora do clique às vezes é
    // outra coisa (ex.: o Picture-in-Picture do WhatsApp cria uma janela
    // própria quando a chamada some da aba principal — o usuário relatou
    // exatamente isso). tabCapture continua pegando o áudio da aba ativa
    // normalmente (é assim que o Chrome exige); só a PERGUNTA do nome vira
    // uma varredura, ficando com a primeira aba que responder de verdade.
    let contactName = null;
    let contentScriptStale = false;
    try {
      const waTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
      console.log('[uniko-call] popup: abas do WhatsApp Web encontradas:', waTabs.map(t => t.id));
      for (const t of waTabs) {
        try {
          const r = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_CALL_QUERY_CONTACT' });
          console.log(`[uniko-call] popup: aba ${t.id} respondeu contactName:`, JSON.stringify(r?.contactName));
          if (r?.contactName) { contactName = r.contactName; break; }
        } catch (e) {
          console.warn(`[uniko-call] popup: aba ${t.id} não respondeu:`, e.message);
          // Content script órfão/ausente (extensão recarregada sem F5 na aba):
          // reinjeta o script e pergunta de novo, sem exigir que o usuário atualize a página.
          try {
            await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['whatsapp-call-detect.js'] });
            const r2 = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_CALL_QUERY_CONTACT' });
            console.log(`[uniko-call] popup: aba ${t.id} respondeu após reinjetar, contactName:`, JSON.stringify(r2?.contactName));
            if (r2?.contactName) { contactName = r2.contactName; break; }
          } catch (e2) {
            console.warn(`[uniko-call] popup: reinjeção na aba ${t.id} falhou:`, e2.message);
          }
        }
      }
      if (!contactName && waTabs.length) contentScriptStale = true;
    } catch (e) {
      console.error('[uniko-call] popup: falha ao varrer abas do WhatsApp Web:', e.message);
    }
    console.log('[uniko-call] popup: mandando UNIKO_CALL_START_WITH_STREAM pro background... contactName=', JSON.stringify(contactName));
    await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_START_WITH_STREAM', streamId, contactName });
    console.log('[uniko-call] popup: mensagem enviada, background confirmou recebimento.');
    // Confirma o estado REAL (não assume que deu certo): espera a gravação subir ou o erro aparecer.
    render('aguardando', 'Iniciando gravação…');
    let real = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 400));
      real = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).catch(() => null);
      if (real?.state === 'recording' || real?.error) break;
    }
    if (real?.state === 'recording') render('recording', contentScriptStale ? 'Gravando (sem nome — dá um F5 na aba do WhatsApp)' : null);
    else render('idle', real?.error || 'A gravação não iniciou. Tente de novo.');
  } catch (e) {
    render('idle', `Falhou: ${e.message}`);
  }
});

/* ── Calibração de áudio ─────────────────────────────────────────────────
   - Microfone: medidor ao vivo local (popup abre o mic) enquanto NÃO há gravação/teste.
   - Durante gravação ou teste, os níveis reais vêm do gravador (UNIKO_CALL_LEVELS).
   - "Testar áudio": grava 10s pelo mesmo caminho da gravação de verdade e manda pra
     uma transcrição de teste (nada é salvo) — mostra o que foi entendido e se o aviso
     prévio seria aceito. */
const micFill = document.getElementById('micFill');
const tabFill = document.getElementById('tabFill');
const micChk = document.getElementById('micChk');
const tabChk = document.getElementById('tabChk');
const calibHint = document.getElementById('calibHint');
const testBtn = document.getElementById('testBtn');
const testResult = document.getElementById('testResult');
const liveText = document.getElementById('liveText');
let testRunning = false;
let liveSeqShown = 0;

const setBar = (fill, v) => { const pct = Math.min(100, Math.round(Math.sqrt(v) * 100)); fill.style.width = pct + '%'; fill.classList.toggle('low', pct < 8); };
const showResult = (cls, html) => { testResult.className = 'testResult show ' + cls; testResult.innerHTML = html; };
const esc = (t) => String(t || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let localMic = null; // { stream, ctx, raf }
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
  } catch {
    micChk.textContent = '❌';
    calibHint.textContent = 'Microfone sem permissão. Clique em "Autorizar microfone" abaixo.';
  }
}
function stopLocalMicMeter() {
  if (!localMic) return;
  cancelAnimationFrame(localMic.raf);
  localMic.stream.getTracks().forEach(t => t.stop());
  localMic.ctx.close().catch(() => {});
  localMic = null;
}

const onPopupMessage = (m) => {
  if (m.type === 'UNIKO_CALL_LEVELS') {
    stopLocalMicMeter(); // o gravador já mede o mic — evita abrir duas vezes
    setBar(micFill, m.mic); setBar(tabFill, m.tab);
    micChk.textContent = m.peakMic > 0.05 ? '✅' : '…';
    tabChk.textContent = m.peakTab > 0.02 ? '✅' : '…';
  }
  if (m.type === 'UNIKO_CALL_TEST_PARTIAL' && testRunning && m.seq >= liveSeqShown) {
    liveSeqShown = m.seq;
    liveText.className = 'testResult show';
    const txt = [m.committed, m.current].filter(Boolean).join(' ');
    liveText.textContent = txt ? `📝 ${txt}` : '🎙️ ouvindo…';
  }
  if (m.type === 'UNIKO_CALL_TEST_RESULT') {
    clearTimeout(finalizeTimer);
    testRunning = false;
    testBtn.disabled = false; testBtn.textContent = 'Testar áudio e transcrição';
    liveText.className = 'testResult';
    render('idle');
    const lines = [];
    lines.push(m.peakMic > 0.05 ? '✅ Microfone captou sua voz.' : '❌ Microfone sem som — confira o microfone selecionado no Windows.');
    lines.push(m.peakTab > 0.02 ? '✅ Áudio da ligação captado.' : '⚠️ Nenhum som da aba/ligação (normal se ninguém falou do outro lado).');
    if (m.error) { showResult('bad', lines.join('<br>') + '<br>❌ Falha na transcrição: ' + esc(m.error)); return; }
    const audioTag = m.audioB64 ? '<audio controls src="data:audio/webm;base64,' + m.audioB64 + '"></audio>' : '';
    lines.push(m.text ? `📝 Entendido: “${esc(m.text)}”` : '❌ Nada foi transcrito (áudio mudo ou muito baixo).');
    lines.push(m.consentGiven ? '✅ O aviso prévio SERIA aceito.' : '❌ O aviso prévio NÃO seria aceito (fale: “Por questões de segurança, essa ligação está sendo gravada”).');
    showResult(m.consentGiven && m.peakMic > 0.05 ? 'ok' : 'bad', lines.join('<br>') + (audioTag ? '<br>🔈 Ouça o que foi gravado:' + audioTag : ''));
  }
};
chrome.runtime.onMessage.addListener(onPopupMessage);

let finalizeTimer = null;
testBtn.addEventListener('click', async () => {
  if (testRunning) {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_MANUAL_STOP' });
    testBtn.disabled = true; testBtn.textContent = 'Finalizando…';
    // Salvaguarda: se o resultado não chegar em 30s, destrava o botão em vez de ficar preso.
    clearTimeout(finalizeTimer);
    finalizeTimer = setTimeout(() => {
      if (!testRunning) return;
      testRunning = false; testBtn.disabled = false; testBtn.textContent = 'Testar áudio e transcrição';
      liveText.className = 'testResult';
      showResult('bad', 'O resultado final demorou demais. Tente de novo em instantes (pode ser limite de uso da OpenAI).');
    }, 30000);
    return;
  }
  const st = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).catch(() => null);
  if (st?.state === 'recording' || st?.state === 'testing') { showResult('bad', 'Há uma gravação em andamento — o medidor acima já mostra os níveis ao vivo.'); return; }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('web.whatsapp.com')) { showResult('bad', 'Abra o WhatsApp Web nesta aba pra testar o áudio da ligação.'); return; }
    let streamId;
    try { streamId = await chrome.tabCapture.getMediaStreamId(); }
    catch (e) {
      if (!/active stream/i.test(e.message || '')) throw e;
      await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_RESET' }).catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      streamId = await chrome.tabCapture.getMediaStreamId();
    }
    stopLocalMicMeter();
    micChk.textContent = ''; tabChk.textContent = '';
    testRunning = true; liveSeqShown = 0;
    testBtn.textContent = 'Parar teste';
    testResult.className = 'testResult';
    liveText.className = 'testResult show'; liveText.textContent = '🎙️ Pode falar — o texto aparece aqui assim que você começar. Fale: “Por questões de segurança, essa ligação está sendo gravada.” O texto aparece aqui ao vivo.';
    await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_START_WITH_STREAM', streamId, contactName: null, test: true });
  } catch (e) {
    testRunning = false;
    testBtn.disabled = false; testBtn.textContent = 'Testar áudio e transcrição';
    showResult('bad', 'Falhou: ' + esc(e.message));
  }
});

// Medidor local do microfone só quando está ocioso.
chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).then((res) => {
  if (res?.state !== 'recording' && res?.state !== 'testing') startLocalMicMeter();
}).catch(() => startLocalMicMeter());
window.addEventListener('unload', stopLocalMicMeter);

// Popup reaberto depois de um teste (ele fecha sozinho quando perde o foco): mostra o resultado guardado.
chrome.storage.session?.get('unikoTestResult').then(({ unikoTestResult: r }) => {
  if (r && Date.now() - r.savedAt < 5 * 60 * 1000 && !testRunning) {
    onPopupMessage(r);
  }
}).catch(() => {});

/* ── Tocar aviso prévio na ligação ─────────────────────────────────────────
   O áudio do aviso (voz sintética guardada no servidor) é misturado ao MICROFONE da ligação
   pelo script wa-mic-inject.js e também à gravação. Só funciona em ligações iniciadas depois
   de o WhatsApp Web ter sido carregado com a extensão atual (F5 antes de atender). */
const avisoBtn = document.getElementById('avisoBtn');
const avisoStatus = document.getElementById('avisoStatus');
const setAviso = (cls, msg) => { avisoStatus.className = 'st ' + cls; avisoStatus.textContent = msg; };

async function waTabs() { return chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }); }

async function refreshAvisoStatus() {
  const tabs = await waTabs();
  if (!tabs.length) { setAviso('bad', 'Abra o WhatsApp Web.'); return; }
  for (const t of tabs) {
    try {
      const r = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_AVISO_PING' });
      if (r?.injected) { setAviso(r.active ? 'ok' : '', r.active ? '✅ Pronto — ligação com microfone ativo.' : 'Pronto. Clique quando atender a ligação.'); return; }
    } catch { /* tenta a próxima aba */ }
  }
  setAviso('bad', 'Dê F5 no WhatsApp Web (a extensão foi atualizada) e abra o popup de novo.');
}
refreshAvisoStatus();

avisoBtn.addEventListener('click', async () => {
  avisoBtn.disabled = true; setAviso('', 'Tocando o aviso…');
  try {
    const tabs = await waTabs();
    if (!tabs.length) throw new Error('Abra o WhatsApp Web.');
    let last = null;
    for (const t of tabs) {
      try {
        const r = await chrome.tabs.sendMessage(t.id, { type: 'UNIKO_AVISO_PLAY' });
        last = r;
        if (r?.ok) break;
      } catch (e) { last = { ok: false, error: 'Dê F5 no WhatsApp Web e tente de novo.' }; }
    }
    if (last?.ok) {
      chrome.runtime.sendMessage({ type: 'UNIKO_CALL_AVISO_PLAYED' }).catch(() => {});
      setAviso('ok', `✅ Aviso tocado${last.seconds ? ` (${Math.round(last.seconds)}s)` : ''}. Será registrado como aviso dado.`);
    } else {
      setAviso('bad', '❌ ' + (last?.error || 'Não foi possível tocar o aviso.'));
    }
  } catch (e) { setAviso('bad', '❌ ' + e.message); }
  avisoBtn.disabled = false;
});
