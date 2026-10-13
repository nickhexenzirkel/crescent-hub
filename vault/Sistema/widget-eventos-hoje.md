---
name: widget-eventos-hoje
description: Card "Eventos de hoje" abaixo do card de boas-vindas — no menu de módulos e na aba Início do Portal; só aparece com evento no dia
metadata:
  type: project
---

Dois lugares: widget `WidgetEventosHoje` em `src/shared/MenuLayoutNovo.jsx` (hook `useEventosHoje` em `menuWidgets.js`) e card na aba Início (`TabInicio.jsx`). Lê `calendar_events` do dia (fuso local). Some sozinho sem evento; não entra no modo Tamanho.
