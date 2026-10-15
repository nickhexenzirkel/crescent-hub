---
title: Controle de Clientes
---
# Controle de Clientes (Oficina Estelar)

Aba `controle-clientes` do módulo faturamento. A pessoa cadastra (ou importa de .xlsx) a carteira dela: comercial, cliente, categoria, período, setor (SIM/NÃO), método (MIA/MISA/MANUAL) e observação.

- 4 modelos: Clássico, Agrupado por comercial, Colorido por categoria, Compacto P&B.
- Orientação horizontal/vertical vale para o .xlsx (pageSetup) e para o botão Imprimir.
- Mesmo HTML (`montarHtml`) alimenta a pré-visualização (iframe) e a impressão (`@page size: A4 <orientação>`).
- Dados só em localStorage (`ctrlcli.*`) — sem SQL, sem servidor. Liberada para todos.
- Código: `src/modules/faturamento/controleClientes.js` + `tabs/TabControleClientes.jsx`.
