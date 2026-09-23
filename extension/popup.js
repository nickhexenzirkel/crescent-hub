const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const micBtn = document.getElementById('micBtn');
const toggleBtn = document.getElementById('toggleBtn');

function render(state) {
  const recording = state === 'recording';
  dot.className = 'dot' + (recording ? ' recording' : '');
  statusText.textContent = recording ? 'Gravando chamada…' : 'Sem gravação ativa';
  toggleBtn.textContent = recording ? 'Parar gravação' : 'Iniciar gravação manual';
  toggleBtn.className = recording ? 'danger' : 'primary';
}

chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' }).then((res) => render(res?.state || 'idle')).catch(() => render('idle'));

// Pede a permissão de microfone numa página VISÍVEL (o offscreen document
// não consegue mostrar esse prompt) — só precisa ser feito uma vez; depois
// disso o Chrome lembra a permissão pra essa extensão.
micBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    micBtn.textContent = '✓ Microfone autorizado';
  } catch (e) {
    micBtn.textContent = 'Permissão negada — tente de novo';
  }
});

toggleBtn.addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'UNIKO_CALL_GET_STATE' });
  if (res?.state === 'recording') {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_MANUAL_STOP' });
    render('idle');
  } else {
    chrome.runtime.sendMessage({ type: 'UNIKO_CALL_MANUAL_START' });
    render('recording');
  }
});
