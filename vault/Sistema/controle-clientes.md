---
title: Controle de Clientes
---
# Controle de Clientes (Oficina Estelar)

Aba `controle-clientes` do módulo faturamento. A pessoa cadastra (ou importa de .xlsx) a carteira dela: comercial, cliente, categoria, período, setor (SIM/NÃO), método (MIA/MISA/MANUAL) e observação.

- 6 modelos: Clássico, Agrupado por comercial, Colorido por categoria, Compacto P&B, Uma linha por período (cliente repetido por categoria/período, com célula mesclada) e Uma linha por cliente (tudo junto: ABAST/MANUT · MENSAL/SEGUNDA).
- SEMPRE 1 página: xlsx com fitToHeight=1; HTML encolhe o conteúdo até caber na folha A4 (script em montarHtml).
- Orientação horizontal/vertical vale para o .xlsx (pageSetup) e para o botão Imprimir.
- Mesmo HTML (`montarHtml`) alimenta a pré-visualização (iframe) e a impressão (`@page size: A4 <orientação>`).
- Dados só em localStorage (`ctrlcli.*`) — sem SQL, sem servidor. Liberada para todos.
- Código: `src/modules/faturamento/controleClientes.js` + `tabs/TabControleClientes.jsx`.
