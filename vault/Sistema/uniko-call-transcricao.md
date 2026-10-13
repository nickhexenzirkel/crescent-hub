---
name: uniko-call-transcricao
description: Uniko Call — transcrição migrou pra OpenAI (gpt-4o-transcribe) com fallback Groq; calibração de áudio no popup; decisões de LGPD
metadata:
  type: project
---

Em 05/out/2026 o Groq (whisper-large-v3) trocava/errava palavras; o usuário assinou a OpenAI. `crescent-hub-server/uniko-call.js` usa `OPENAI_API_KEY` (+ `OPENAI_TRANSCRIBE_MODEL`, padrão gpt-4o-transcribe) e cai pro Groq se falhar; `TRANSCRIBE_PROVIDER=groq|openai` força. PRECISA colocar OPENAI_API_KEY no `.env` da VPS + `pm2 restart crescent-hub-server --update-env`.

**Why:** aviso prévio de gravação é detectado na transcrição; erro do modelo apaga a gravação (decisão do usuário: MANTER assim, sem revisão por admin — risco LGPD discutido). Falsos negativos vinham de áudio ruim/silencioso (AudioContext suspenso — corrigido) e modelo.

**How to apply:** popup da extensão (v1.4.x) tem calibração: medidores ao vivo, teste com VAD + transcrição ao vivo (endpoint `/api/uniko-call/test`, não salva nada) e player do áudio. Fim da chamada no WhatsApp NÃO para a gravação (só o botão). Estado da gravação sobrevive ao service worker dormir (recorderExists). Opera GX: fallback em janela popup quando não há chrome.offscreen. Veja [[extensao-download-atualizada]]. Nunca guardar chaves de API em arquivos/commits.

**Tocar aviso (05/out/2026, extensão v1.5.0):** botão no popup toca o aviso prévio (texto fixo, TTS OpenAI gpt-4o-mini-tts voz coral, guardado em crescent-hub-server/public/aviso-previo.mp3 — substituir o arquivo pra trocar a voz; apagar pra regenerar) misturado ao MICROFONE da ligação via script MAIN `wa-mic-inject.js` (intercepta getUserMedia; PRECISA F5 no WhatsApp antes da ligação) e à gravação. Extensão manda `avisoPlayed=true` no upload → servidor considera consentimento garantido (aviso tocado OU detectado na fala). Teste real com ligação ainda pendente. Transcrição de ligações agora passa por ffmpeg (silenceremove+dynaudnorm → flac 16k) e filtro de frases fantasma.
