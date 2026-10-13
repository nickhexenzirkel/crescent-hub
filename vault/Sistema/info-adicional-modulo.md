---
name: info-adicional-modulo
description: "Módulo \"Informações Adicionais\" — antigos botões flutuantes Instalar App / Sobre o Uniko, agora em duas abas dentro de um módulo normal"
metadata: 
  type: project
---

Antes existiam dois botões flutuantes soltos por cima de QUALQUER tela de módulos (📲 Instalar Aplicativo e 🌌 Sobre o Uniko/O Viajante, ambos em `src/shared/`). Set/2026: viraram um módulo normal — `src/modules/info-adicional/index.jsx` — acessível como qualquer outro (lista no mobile, bolha na órbita do desktop, ver [[module-selector-orbita]]), com duas abas internas reunindo o mesmo conteúdo de antes (tutorial de instalação passo a passo, minissérie narrada da origem do Uniko).

Os arquivos antigos (`UnikoOrigin.jsx`, `InstalarAppGuide.jsx`) foram excluídos — não existe mais botão flutuante nenhum na tela de módulos.
