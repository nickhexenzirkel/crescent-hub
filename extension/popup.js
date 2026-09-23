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

// Abre numa ABA (não pede aqui no popup) — o Chrome não mostra o prompt de
// permissão direito numa janela de popup de extensão (fecha rápido demais /
// contexto efêmero demais), costuma devolver "Permission denied" na hora,
// mesmo sem o usuário ter clicado em nada. Ver permissoes.html/js.
micBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('permissoes.html') });
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
