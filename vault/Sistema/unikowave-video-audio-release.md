---
name: unikowave-video-audio-release
description: Uniko Wave — modo Com Clipe mudo na 1ª jogada de uma faixa (unMute pré-onReady descartado); fix _audioReleasePending
metadata: 
  type: project
---

**Bug (jul/2026): modo "Com Clipe" rodava a partida SEM MÚSICA na 1ª jogada de uma faixa** (nos dois modos, Teclado Estelar e Guerra Estelar), no desktop. Na 2ª jogada da mesma música funcionava — parecia intermitente.

**Causa:** em `public/unikowave/index.html`, `_beginVideoBg` sonda o vídeo local do servidor (`/api/ytdl/status`) por até 4s antes de cair pro embed do YouTube. Na 1ª jogada o download (yt-dlp no VPS) leva ~10-15s → sondagem roda os 4s inteiros → o `YT.Player` de áudio/relógio (`_startVideoClockPlayer`) só nasce DEPOIS do "GO" da contagem (~3,3s). O `unMute()/playVideo()` mandado no GO (e no `_releaseVideoIfGoAlreadyPassed`) chegava num player que ainda não tinha dado `onReady` — **a API do YouTube descarta comandos pré-ready** — e o player (criado com `mute:1` no desktop) ficava mudo pra sempre. O watchdog de buffering liberava a partida quando o player atingia PLAYING (mudo) → jogo rodava em silêncio.

**Fix (commit 6e6b3b9, CONFIRMADO pelo usuário em produção — música nova tocou normal na 1ª jogada):** flag `_audioReleasePending` + helper `_applyAudioRelease(p, seek)`. O GO (`runCountdown`, se `bgMode==='video'`) e o `_releaseVideoIfGoAlreadyPassed` marcam a flag ALÉM de tentar liberar na hora; o `onReady` do clock player reaplica (unMute+setVolume+seekTo(songTime)+play) se a flag estiver de pé, e o primeiro `PLAYING` reaplica (sem seek) e limpa a flag. Resetada no início da partida e em `hideVideoBg`. Caminho do vídeo local (wrapper de `<video>`) nunca teve o problema — os métodos funcionam a qualquer momento.

**Ruído de console conhecido (inofensivo), não confundir com bug:**
- `lrclib.net ... blocked by CORS policy` — busca de LETRAS da Central Alexa (`central-alexa/index.jsx` ~linha 1368), serviço externo falhando/bloqueando; não afeta nada do jogo.
- `Failed to execute 'postMessage' on 'DOMWindow': target origin does not match` — bug conhecido do widget do YouTube em iframes; já mitigado pelo watchdog de buffering (`_armBufferWatchdog` sonda `getPlayerState()` como plano B dos eventos).

Diagnóstico útil: os endpoints do VPS estavam saudáveis (`POST /api/ytdl/download` → downloading → ready em ~30s; `GET /api/ytdl/serve/<id>` → HTTP 206 com byte-range) — o problema era só o timing client-side.

Relacionado: [[unikowave-architecture]], [[unikowave-mobile]] (regra do `click` pra unlock iOS; no celular `skipLocalCheck` pula a sondagem e o player nasce desmutado no gesto — por isso o celular não tinha ESTE bug).
