---
name: central-alexa-festival
description: Como o Festival da Central Alexa toca música (Spotify no Echo) e a mini janela de videoclipe do YouTube
metadata: 
  type: project
---

O módulo **Central Alexa** vive em `src/modules/central-alexa/index.jsx` (~2000+ linhas, um arquivo). A aba **Festival** é uma fila colaborativa de músicas.

**Como toca:** o áudio NÃO sai do servidor pra Alexa. A música toca via **Spotify Connect** — o `crescent-hub-server` manda comandos pra Web API do Spotify (`/me/player`, endpoints `/api/player/*` e `/api/devices`) e o **Echo Spot** (Alexa com telinha) é o alto-falante Spotify Connect. O `alexa-remote2` só faz TTS e `wakeSpotifyViaAlexa()` (textCommand "abrir spotify") pra acordar o Echo e ele aparecer como device. A fila é de faixas do Spotify (`spotify_id`, `uri`). Ver [[alexa-token-persistencia]].

**Por que YouTube não toca no Echo:** YouTube não é provedor nativo da Alexa (BR) e o único "injetar áudio" é SSML `<audio>` (MP3 ≤240s). Logo, áudio do YouTube só sai do navegador/PC, não do Echo.

**Mini janela de videoclipe (jun/2026):** feature SÓ visual. No player "Tocando Agora" há um botão (ícone de vídeo, visível a todos, preferência em `localStorage ch_fest_video`) que liga/desliga uma mini janela flutuante (canto inf. dir.) com o **clipe do YouTube da música atual, MUDO** — o áudio segue no Spotify/Echo. Se não houver clipe (ou o vídeo bloquear embed, erro 101/150) a janela não aparece.
- Componente `FestivalVideoWindow` (mesmo arquivo, escopo de módulo) usa a IFrame Player API do YouTube; `onError` → `onUnavailable()` esconde.
- Resolve o videoId via endpoint do servidor **`GET /api/youtube/clip?track_id=&q=`** (em `crescent-hub-server/index.js`): faz scrape de `youtube.com/results` (regex `"videoId":"(11 chars)"`, header `Cookie: CONSENT=YES+1`), SEM chave de API. Cache 3 camadas igual ao genre (memória + Supabase `settings` key `ytclip:<id>` + dedup); só acertos vão pro Supabase.

**Bug real: adicionar música às vezes pulava a próxima da fila (jul/2026).** Confirmado nos logs do PM2 da VPS (ver [[hostinger-vps-deploy]]): "Love In The Dark" começou a tocar (`advanceQueue` escolheu certo como próxima) e ~1s depois foi substituída por "Into You", que alguém tinha acabado de adicionar naquele instante. Causa: `startPlaying()` (`crescent-hub-server/index.js`) leva 800ms+ (delay fixo pra acordar o device) + chamadas à API do Spotify ANTES de atualizar `player_state` — nesse gap, o endpoint de adicionar música (que decide se toca na hora "se nada estiver tocando") lia `player_state`/`progressCache` ainda apontando pra faixa VELHA, achava a fila vazia, e roubava o play com a música recém-adicionada. Fix: flag `_trackChangeInProgress` (true durante TODA execução de `startPlaying`, então cobre `advanceQueue`/`startAutoPlaylist`/qualquer chamador — todos passam pela mesma função) — o endpoint de adicionar trata isso como "troca legítima em andamento", não "fila vazia", e só enfileira normal.

**Janela de bloqueio pra adicionar música (jul/2026):** `addToQueue` (mesmo arquivo) só deixa adicionar quando a música TOCANDO no momento está entre 0:10 e (duração − 0:10) — bloqueia nos últimos 10s (quase acabando) E nos primeiros 10s da próxima (acabou de trocar), `EDGE_MS = 10000` comparado com `progressMs`/`currentSong.duration_ms`. Existia antes só o bloqueio dos últimos 15s; usuário pediu pra reduzir pra 10s E adicionar o bloqueio simétrico do início. Só vale pra `addToQueue` (adicionar música nova) — `replaceSong` (trocar a música de um slot já pendente seu) não tem essa checagem, é feature diferente (editar pedido já feito, não adicionar um novo).
