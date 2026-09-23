// Pede a permissão de microfone numa ABA de verdade (não no popup — Chrome
// não mostra o prompt de permissão direito numa janela de popup de extensão,
// costuma devolver "Permission denied" na hora, mesmo sem o usuário ter
// clicado em nada). Uma vez concedida aqui, o Chrome lembra pra origem
// chrome-extension://<id> inteira — o offscreen document usado na gravação
// de verdade (ver offscreen.js) passa a conseguir pedir o microfone sozinho,
// sem precisar mostrar prompt nenhum.
const btn = document.getElementById('btn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.textContent = 'Pedindo permissão…';
  status.className = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    status.textContent = '✓ Microfone autorizado! Pode fechar esta aba.';
    status.className = 'ok';
    btn.style.display = 'none';
  } catch (e) {
    status.textContent = `Falhou: ${e.name} — ${e.message}`;
    status.className = 'erro';
    btn.disabled = false;
  }
});
