---
name: fairy-scene
description: Cenário jardim encantado (Uniko Rainha das Fadas) no card + fundo da Central Alexa; e a piscada de 10s só dela
metadata: 
  type: project
---

Cenário animado **jardim encantado** pro Uniko **Rainha das Fadas** (`rainha-das-fadas-7sxg`, accent `#e6a9e6`) — jul/2026. Mesmo molde do [[sakura-scene]]/cosmosScene: `src/shared/fairyScene.jsx` é UM componente canvas com prop `fixed` (card `false` + tela cheia `true`). Tem sol brilhando com raios, árvores grandes, rio serpenteando, jardim de flores coloridas (várias pequenas + flores GRANDES), grama, **fadinhas coloridas voando** (halo+asas+rastro, Lissajous ao redor de âncoras) e **brilhos** cintilando.

- **Composição pra tela cheia:** sol (canto esq.), árvores grandes e flores grandes ficam nas **laterais** (faixa visível; o centro fica atrás dos painéis da Central Alexa).
- **Ligado** igual aos outros (ver [[central-alexa-festival]]): `CaptureUnikoWidget.jsx` (sceneType 'fairy'), card + fundo da Central Alexa (`CentralFairy`, gate `getUniko(songSkin)?.theme?.sceneType==='fairy'`). Detecção em `captureUniko.js` via `CUSTOM_SCENE_BY_KEYWORD` (regex `/fada|fadas|fairy|rainha das fadas/`).

**Piscada especial (só a Rainha das Fadas):** ela **segura o olho fechado por ~10s** a cada ciclo. Dois lugares, gate só nela:
- Mascote do card: `src/modules/central-alexa/UnikoMascot.jsx` — o blink loop usa uma sequência própria (`closed` por 10000ms) quando `uni?.theme?.sceneType==='fairy'`.
- Assistente flutuante: `src/shared/UnikoAssistant.jsx` (`UnikoFace`) — keyframes `uaBlinkTopFairy`/`uaBlinkMidFairy` de 15s (esconde as camadas open+mid ~31%–98% → revela a base `closed` por ~10s) quando o id/nome da skin casa `/fada|fairy/`. Qualquer outra skin mantém a piscada rápida de 3s. **Requer que a Rainha das Fadas tenha um frame de olho-fechado (`img_closed`) na Oficina** — senão o `closed` cai no frame principal e o hold não aparece.
