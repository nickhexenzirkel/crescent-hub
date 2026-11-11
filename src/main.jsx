import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { iniciarDiagnosticoPerf } from './shared/diagnosticoPerfCore'
import { iniciarSiteImagens } from './shared/siteImagens'
import { iniciarVisibilidade } from './shared/visibilidade'

const CHUNK_RELOAD_KEY = 'ch_vite_preload_recovery';
window.addEventListener('vite:preloadError', (event) => {
  const recurso = String(event.payload?.message || event.payload || 'chunk');
  const agora = Date.now();
  let ultimaTentativa;
  try {
    ultimaTentativa = JSON.parse(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 'null');
    if (ultimaTentativa?.recurso === recurso && agora - ultimaTentativa.timestamp < 60_000) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ recurso, timestamp: agora }));
  } catch (error) {
    console.warn('Não foi possível registrar a recuperação do módulo atualizado.', error);
    return;
  }
  event.preventDefault();
  window.location.reload();
});

// Antes do React montar: reaplica os interruptores do diagnóstico salvos no
// navegador, senão a tela pisca com os efeitos ligados e a primeira medição
// sai contaminada. Sem diagnóstico ligado, isso é um no-op.
iniciarDiagnosticoPerf()
// Imagens trocadas pelo admin (Dashboard RH → Imagens do Site): precisa estar ativo ANTES do React montar.
iniciarSiteImagens()
iniciarVisibilidade()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
