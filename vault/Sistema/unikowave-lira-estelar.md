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

**Tablatura e acordes (out/2026):** músicas também podem vir como tablatura (`tab` em `SONGS`, `parseTab`): cada letra é uma tecla, letras coladas = **acorde** (o jogador toca as notas em qualquer ordem; só avança quando todas foram tocadas) e cada `-` é 1 unidade de pausa (`unit` ms) usada só no "Ouvir". Cada música vira `steps = [{c:[células], w}]`. Primeira por tablatura: **Columbina Lullaby** (230 passos, 57 acordes, nível Difícil).

**Guia de ordem (out/2026):** `desenharOrdem()` mostra (1) selo numerado 1·2·3·4 nas próximas notas (dourado = a da vez), (2) faixa "ORDEM" acima da barra de progresso com as próximas ~10 jogadas (letras; acorde = `S+H`), e (3) quando a mesma nota (ou acorde) se repete em passos seguidos, pílula **"2x/3x"** embaixo da nota — conta o que falta e vai diminuindo. Tablatura aceita `_` além de `-` como pausa. Columbina Lullaby foi trocada pela 2ª versão (226 passos).

**Config "Erro sem som" (out/2026):** botão no topo da Lira (`#lrMudo`, localStorage `dw_lira_mudo_erro`, padrão ligado). Ligado: nota errada só treme em vermelho, sem `pluck` nem `sfxErro`, pra não atrapalhar a melodia. Só vale no modo guiado.

**Dois modos (out/2026):** seletor no topo (`modo`, localStorage `dw_lira_modo`). **Maestro** = o guiado de sempre. **Frenesi Estelar** = estrelas caem do céu (canvas `#lrFall` sobre a grade, `fzLoop`) e chegam na nota no tempo da música (tempo vindo de `stepMs`: `w*unit` nas tablaturas, `ms` nas demais; velocidade de queda igual pra todas). Janelas: PERFEITO ±90ms, BOM ±200ms, depois ERROU; toque sem nota perto = "toque fora" (respeita a config Erro sem som). Pontos com bônus de combo, estrelas por (perfeitos + 0,6·bons)/total (≥90% 3★, ≥70% 2★), melhor guardado como `<id>_f` em `dw_lira_best`. Botão COMEÇAR (2,2s de preparo); antes dele dá pra treinar nas notas. Cor da estrela por linha: dourada (aguda), rosa (média), roxa (grave).
