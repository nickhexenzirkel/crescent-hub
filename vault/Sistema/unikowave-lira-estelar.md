---
name: unikowave-lira-estelar
description: Uniko Wave — modo Lira Estelar (estilo lira do Genshin): 21 notas, círculo dourado guia a próxima nota
metadata:
  type: project
---

Terceiro modo do Uniko Wave, **independente de música do YouTube**. Entra pelo painel "Jogar" do menu (card **LIRA ESTELAR**, chama `abrirLira()`), não pela tela de preview/`selectMode`.

- Código todo em `public/unikowave/lira.js` (autocontido: injeta CSS e DOM `#liraScr`; carregado por `<script src="lira.js">` no fim do `index.html`). Expõe `abrirLira()`/`fecharLira()`.
- 3 linhas × 7 notas (do-re-mi-fa-sol-la-si), teclas Q-U / A-J / Z-M como na lira do jogo. Índice da nota = `linha*7 + grau` (linha 0 = aguda, 2 = grave). Som sintetizado em WebAudio (`pluck`, com eco leve), não usa mp3.
- **Guiado**: músicas em `SONGS` (string de graus: `+n` aguda, `n` média, `-n` grave). Espera o jogador (sem timing): círculo dourado pulsante + anel que encolhe na nota da vez, e pontilhado na seguinte. Errou = vibra vermelho, conta erro, zera sequência. Fim = estrelas pela precisão (≥95% 3★, ≥80% 2★), melhor resultado em localStorage `dw_lira_best`. Botão "Ouvir a música" toca a demo. **Livre** = só tocar.
- Teclas: listener em captura com `stopImmediatePropagation` enquanto aberto, pra não disparar lanes do jogo. Ao abrir pausa a música do menu; ao fechar volta.
- Nova música: só acrescentar em `SONGS`. Sem SQL, sem deploy na VPS (só front/Vercel).
