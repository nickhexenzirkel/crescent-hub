---
name: module-selector-orbita
description: "Tela de seleção de módulos (ModuleSelector.jsx) — mobile em lista, desktop em órbita elíptica ao redor do mascote"
metadata: 
  type: project
---

A tela pós-login (`src/shared/ModuleSelector.jsx`) foi redesenhada (set/2026) seguindo dois mockups enviados pelo usuário à risca: no celular é uma **lista vertical** (ícone + título + subtítulo + seta); no desktop é uma **órbita** — o mascote Uniko no centro, 3 anéis elípticos decorativos, e os módulos em bolhas circulares distribuídas igualmente ao redor (ângulo = `-90 + (360/N)*i`, N=nº de módulos visíveis, projetado numa elipse RX=44%/RY=35% do container).

9º módulo "Informações Adicionais" (Instalar App + Sobre o Uniko em abas, [[info-adicional-modulo]]) foi acrescentado no fim de `ORBIT_DEFAULT` — os botões flutuantes que existiam antes por cima da tela toda foram removidos.

**Duas ordens padrão diferentes coexistem** (só valem antes da pessoa reordenar manualmente):
- `allMods` (array base) = ordem "natural" da lista mobile: Portal do Colaborador primeiro.
- `ORBIT_DEFAULT` (dentro do componente) = sequência em relógio a partir do topo pra bater com o mockup desktop: Central Alexa no topo, Portal do Colaborador fica na posição upper-left (última do relógio).

Assim que o usuário usa "Mover módulos" (arrastar pra reordenar, botão do meio no card de perfil) e uma ordem fica salva em `localStorage` (chave por CPF/nome, ver `loadModuleOrder`/`saveModuleOrder`), as DUAS visões (lista mobile e órbita desktop) passam a seguir essa MESMA ordem escolhida — o `ORBIT_DEFAULT` só serve de fallback pra quem nunca mexeu.

Mesmo padrão de chave client-only por conta usado em outros lugares do app: `algumPrefixo_ + (cpf || name || 'anon').toLowerCase()`.
