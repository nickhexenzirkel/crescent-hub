---
name: configuracoes-desempenho
description: "Aba Desempenho em Configurações: perfis gráficos e interruptores de efeitos (FPS)"
metadata:
  type: project
---

Configurações (`src/shared/SettingsModal.jsx`) ganhou a aba **Desempenho**: 4 perfis (Máxima, Equilibrado, Desempenho, Mínimo) + 8 interruptores. Reaproveita os flags do diagnóstico de performance (`diagnosticoPerfCore.js`, classes `pd-*` no `<body>`, regras em `index.css`), então o HUD Ctrl+Alt+P e a aba mexem no MESMO estado (localStorage `perf_diag_flags`, por aparelho).

Novos flags: `cenarios30` (cenários canvas Cosmos/Sakura/Fadas/Olivia pulam 1 frame sim/1 não) e `semCenarios` (congela). Os 4 cenários chamam `pularFrameCenario()` no início de cada `frame`. Cenários CSS (oceano/vampiro) obedecem a `semAnim`.

**How to apply:** novo efeito pesado → criar flag em `FLAGS_PADRAO`/`aplicarFlags`, regra CSS e linha em `OPCOES_GRAFICAS`/`PERFIS_DESEMPENHO`.
