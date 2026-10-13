---
title: Como pedir ajustes
---
# Como pedir ajustes

Dois jeitos, os dois **sem custo extra**. Ambos usam a mesma fila: **Dashboard RH → Pedidos de Ajuste**.

## 1. Agente independente (não precisa do Claude Code)
1. Descreva o pedido na aba e clique **Rodar agente** (ou deixe a fila automática ligada).
2. O agente do servidor faz a mudança, confere o build e abre um pull request.
3. Você clica **Ver mudanças** (e confere a prévia da Vercel no PR), depois **Aprovar e publicar** ou **Recusar** com um comentário — ele tenta de novo.
Detalhes e limites: [[agente-ia]].

## 2. Claude Code (para pedidos maiores)
Abra o Claude Code no projeto e rode **/pedidos**: ele lê a fila e este cofre, resolve, e marca como feito.

Em ambos: nada vai pro ar sem você ver. Ver também [[Regras da IA]] e [[Convenções]].
