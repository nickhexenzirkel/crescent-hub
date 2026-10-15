---
title: Controle de Clientes
---
# Controle de Clientes (Oficina Estelar)

Aba `controle-clientes` do módulo faturamento. A pessoa cadastra (ou importa de .xlsx) a carteira dela: comercial, cliente, categoria, período, setor (SIM/NÃO), método (MIA/MISA/MANUAL) e observação.

- 7 modelos (inclui "Uma linha por período sequencial": lista plana na ordem do dia de faturamento, sem agrupar por cliente, separador a cada dia): Clássico, Agrupado por comercial, Colorido por categoria, Compacto P&B, Uma linha por período (cliente repetido por categoria/período, com célula mesclada) e Uma linha por cliente (tudo junto: ABAST/MANUT · MENSAL/SEGUNDA).
- Linhas ordenadas por período (segunda→sexta, decendial, quinzenal, mensal, solicitação); horizontal com lista grande (>16 linhas) divide em 2 tabelas lado a lado pra letra não ficar minúscula (só HTML/impressão; xlsx continua 1 tabela).
- Cores: tema (principal sincroniza cabeçalho/linhas/zebra/título + fonte do título, do cabeçalho e zebra) e cor por comercial, salvos em localStorage (ctrlcli.tema, ctrlcli.cores). Margem A4 de 5mm (4mm no compacto).
- Linhas grossas entre as linhas: DESLIGADO por padrão (checkbox em "Cores do modelo", tema.linhasGrossas); ligado vale pra todas as linhas.
- SEMPRE 1 página: xlsx com fitToHeight=1; HTML encolhe o conteúdo até caber na folha A4 (script em montarHtml).
- Orientação horizontal/vertical vale para o .xlsx (pageSetup) e para o botão Imprimir.
- Mesmo HTML (`montarHtml`) alimenta a pré-visualização (iframe) e a impressão (`@page size: A4 <orientação>`).
- Dados só em localStorage (`ctrlcli.*`) — sem SQL, sem servidor. Liberada para todos.
- Código: `src/modules/faturamento/controleClientes.js` + `tabs/TabControleClientes.jsx`.
