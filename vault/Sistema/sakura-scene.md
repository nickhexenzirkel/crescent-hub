---
name: sakura-scene
description: Cenário animado de floresta de sakura (Uniko Kitsune) no card e fundo da Central Alexa; detecção por palavra-chave
metadata: 
  type: project
---

Cenário animado **floresta de sakura** pro Uniko **Kitsune** (jul/2026), no molde do [[unikowave-architecture]]/cosmosScene: `src/shared/sakuraScene.jsx` é UM componente canvas com prop `fixed` que serve o card (`fixed=false`) e o fundo de página inteira (`fixed=true`, redimensiona via ResizeObserver). Tem cerejeiras em flor, pétalas caindo + acumuladas no chão, grama rosa, cachoeirinha caindo no rio, névoas e torii.

- **Composição pensada pra tela cheia da Central Alexa:** o centro é coberto pelos painéis da UI, então **torii e cachoeira ficam no canto esquerdo** (única faixa visível junto com a direita); árvores preenchem o centro/direita.
- **Ligado igual aos outros cenários** (ver [[central-alexa-festival]]/Sereia/Destruidora): `CaptureUnikoWidget.jsx` (sceneType 'sakura'), card + fundo da Central Alexa (`CentralSakura`, gate por `getUniko(songSkin)?.theme?.sceneType==='sakura'`).
- **Detecção do Uniko:** o Kitsune é da Oficina (id `kitsune-s4n2`, sufixo aleatório). Em `captureUniko.js`, além do mapa fixo `CUSTOM_SCENE_BY_ID`, há `CUSTOM_SCENE_BY_KEYWORD` (regex `/kitsune|raposa|sakura|cerejeira/` no nome/id) → `sceneType='sakura'`. Ver [[oficina-de-uniko.md]].
