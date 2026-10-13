---
description: Resolve os Pedidos de Ajuste pendentes do Uniko (fila do Dashboard RH)
---

Resolva os pedidos de ajuste pendentes do Uniko.

1. Leia `vault/Regras da IA.md` e `vault/Convenções.md` (e as notas de `vault/Sistema/` dos módulos envolvidos).
2. Rode `node scripts/pedidos.mjs list` para ver os pendentes e reabertos. Se não houver, avise e pare.
3. Para cada pedido, na ordem:
   - Se tocar em algo proibido pelas Regras da IA (login, permissões, RH/ponto, segredos, apagar dados, deploy), NÃO faça: rode `node scripts/pedidos.mjs skip <id> "motivo"` e avise o dono.
   - Se o pedido for ambíguo e não der para resolver com bom senso, pergunte ao dono antes de mexer.
   - Senão, faça a mudança com o menor impacto possível, rode `npx vite build` e confirme que passa.
   - Dê commit e push (mensagem em português descrevendo o efeito), e marque: `node scripts/pedidos.mjs done <id> "o que foi mudado, em 1-2 frases simples"`.
   - Se foi um pedido REABERTO, leve em conta o comentário do dono.
4. No fim, resuma ao dono o que foi feito, o que foi pulado (e por quê) e se algo exige rodar SQL ou deploy na VPS.
5. Se descobrir algo novo e útil sobre o sistema ao resolver, atualize ou crie a nota correspondente em `vault/Sistema/`.

Responda sempre em português do Brasil.
