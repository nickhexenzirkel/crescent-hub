---
name: unikowave-temp-unlock-all
description: Flag TEMP_UNLOCK_ALL do Uniko Wave — agora FALSE (personagens vêm do gacha Audição)
metadata:
  type: project
---

`const TEMP_UNLOCK_ALL` em `public/unikowave/index.html` (logo antes de `let selectedChar`). Faz `isUnlocked()` retornar sempre true e afeta o init de `selectedChar`.

**Estado atual (2026-06-16): `false`** — desligado porque os personagens agora são conquistados pelo gacha [[unikowave-gacha-audicao]] (Audição). Só Dodoco (alwaysUnlocked) + os ganhos em `dw_unlocked` ficam disponíveis. Mudar para `true` de novo libera todos (útil só para debug). Histórico: ficou `true` de 2026-06-08 até 2026-06-16. Ver [[unikowave-architecture]].
