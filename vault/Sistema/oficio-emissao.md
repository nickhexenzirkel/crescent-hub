---
name: oficio-emissao
description: Aba "Ofício de Emissão" na Oficina Estelar — porte da Solicitação de Pagamento do Uniko Detetive (Electron), 2 modelos (Eusébio e Juazeiro do Piauí)
metadata:
  type: project
---

Criada em 07/out/2026: aba `oficio-emissao` (Oficina Estelar, id interno faturamento). Lógica em `src/modules/faturamento/oficioEmissao.js` (leitura da NFS-e com pdfjs + geração de PDF com pdf-lib/fontkit), UI em `tabs/TabOficioEmissao.jsx`. Porte de `C:\Users\finan\Videos\uniko detetive` (`src/main/core/solicitacao.ts`, `oficio.ts`, `extenso.ts`, `faturamento.ts`, `parsing.ts`).

Dois modelos: **Eusébio** (o ofício atual do Uniko Detetive: contrato nº + objeto) e **Juazeiro do Piauí** (Requerimento de Pagamento, do .docx `MODELO DE REQUERIMENTO DE PAGAMENTO- PIAUI.docx`: secretaria, tipo de faturamento, período, vencimento; campos variáveis em vermelho como no modelo, com toggle). Piauí reproduz coordenadas/cores do PDF que o Word gera (extraídas com pymupdf).

**IR retido no modelo Juazeiro do Piauí:** o parágrafo do pagamento informa o número da nota fiscal, o valor bruto, as retenções de IR (1,20%, 4,80% e 0,24%, cada uma com seu valor), o valor líquido e o período. Os impostos são extraídos separadamente da discriminação da NFS-e; sem linhas de IR nem indicação explícita de dispensa, a frase das retenções é omitida.

**Why:** o time fazia esses ofícios à mão/no app Electron; agora roda no navegador.

**How to apply:** liberada pra TODOS (07/out/2026, junto com a Carta de Correção); gate removido de Sidebar/index/TabInicio. Assinante dos dois modelos = Cleanderson Pereira Batista (rúbrica `assets/assinatura-cleanderson.png`, CPF 605.487.433-04 no Piauí; constante `SIGNATARIO`). Armadilha: pdf-lib MEDE com kerning mas DESENHA sem — medir letra por letra (`larg()`), senão espaços colam. Corrigi typos do docx (CNPJ 13.858.769, "Torrre"→"Torre"). Veja [[oficina-estelar-modulo]].

**Leitura de Empenho (07/out/2026):** aba `empenho` na Oficina Estelar, mesmo acesso do Ofício (todos, menos cargos Comercial e Pós Venda — `TABS_BLOQUEADAS_POR_CARGO` em faturamento/index.jsx). Porte de `empenho.ts`/`empenho-leitura.ts`/`excel.ts` do Uniko Detetive: `faturamento/empenho.js` + `tabs/TabEmpenho.jsx`. PDF sem texto vai pra OCR (tesseract.js, idioma `public/tessdata/por.traineddata`; worker/core do Tesseract vêm do CDN jsdelivr → precisa de internet). Planilha com `exceljs` (import dinâmico). Cargo é bloqueado pelo NOME (Comercial/Pós Venda).
