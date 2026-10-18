---
name: contracheque-gerado-pdf
description: Contracheque "Gerado pelo Uniko" (Dashboard RH → Contracheques) — como o PDF é gerado e o bug do recorte lateral (18/out/2026)
metadata:
  type: project
---

`ContrachequeGeradoUniko.jsx` monta o `ReciboPagamento.jsx` (760px de largura, réplica do modelo do contador) e gera o PDF com html2canvas + jsPDF, anexando na tabela/bucket `contracheques`.

**Bug (18/out/2026):** os PDFs saíam CORTADOS na direita (sem Competência, Provento, Desconto, totais, bases). Causa: o html2canvas capturava a prévia ainda dentro do painel da tela (mais estreito que o recibo, com `overflow-x:auto`) e cortava o que passava da borda visível. **Correção:** `gerarEAnexar` clona o recibo pra um suporte `position:fixed` no `<body>` na largura exata (`PAGE_W`), espera 60ms (`setTimeout`, não `rAF`, que congela em aba de fundo) e captura a cópia. Também: o rodapé de bases somava 800px (passava do papel) → agora 760px; a linha de banco somava 720 → 760; textos de célula quebram linha em vez de virar "…".

PDFs já gerados antes continuam cortados — precisam ser gerados de novo.
