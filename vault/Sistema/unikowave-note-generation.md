---
name: unikowave-note-generation
description: "Como o mapa de notas do Uniko Wave é gerado (RNG semeado, densidade, padrões)"
metadata: 
  type: project
---

Geração de notas do Uniko Wave em `public/unikowave/index.html`:

- `generateBeatsFromBPM(bpm,dur)` — modo estimado: cria batidas a partir de blocos de energia aleatórios (calmo/médio/intenso/drop). Inclui colcheias (`sub8`) e rajadas de semicolcheia (`sub4`) nos picos.
- `generateChart(beats,dur,cfg,meta)` — transforma batidas em notas usando bibliotecas de sequências por energia: `RUNS`, `STEPS`, `ADJ_ALTS`, `COMBOS`. Especiais: escadinha (`stairChance`) e dentro/fora (`insideOutChance`). Densidade por dificuldade em `DIFF_CFG`.
- **`minGap` (em `DIFF_CFG`) é o portão MESTRE de legibilidade** = espaçamento mínimo entre notas (segundos) → teto de notas/segundo. No ritmo REAL os onsets vêm densos; o `minGap` afina guardando sempre a PRIMEIRA batida da janela (o ataque), o que mantém o ritmo. Valores atuais: easy 0.50 → nightmare 0.13 (~2 a ~7.7 notas/s). NÃO baixar demais (já causou "parede ilegível"). As sequências especiais usam `seqGap=max(minGap,0.16)` p/ não estourar rajadas.
- **RNG semeado por música:** `mr()` lê `_mapRng`, semeado por `seedMapFor(vid+'|'+dificuldade)` no início de `beginFromPreview` e resetado com `resetMapRng()` após gerar. Mesma música+dificuldade = mesmo mapa (reproduzível/treinável); músicas diferentes = mapas distintos. Sem vídeo (demo) usa Math.random.

**Cuidado:** as funções de geração devem usar `mr()` e NÃO `Math.random()` direto, senão quebram a reprodutibilidade. (Bug histórico: `pickFrom(WALKS)` referenciava `WALKS` inexistente — era pra ser `STEPS` — causava ReferenceError que travava o carregamento.)

**Diagnóstico na tela:** painel de erros togglável pela tecla `` ` `` (crase) — captura `window.error`, `unhandledrejection` e espelha `console.warn/error` (objeto `DIAG`). Necessário porque o jogo roda em iframe e o console fica escondido. Ver [[unikowave-architecture]].
