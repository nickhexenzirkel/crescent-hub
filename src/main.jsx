import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { iniciarDiagnosticoPerf } from './shared/diagnosticoPerfCore'

// Antes do React montar: reaplica os interruptores do diagnóstico salvos no
// navegador, senão a tela pisca com os efeitos ligados e a primeira medição
// sai contaminada. Sem diagnóstico ligado, isso é um no-op.
iniciarDiagnosticoPerf()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
