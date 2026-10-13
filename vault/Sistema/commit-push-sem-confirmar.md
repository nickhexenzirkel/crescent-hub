---
name: commit-push-sem-confirmar
description: Preferência do usuário — pode fazer git commit e push sem pedir autorização
metadata: 
  type: feedback
---

Quando o usuário pedir para fazer commit e push (ou já tiver pedido na conversa), **execute direto, sem pedir confirmação**.

**Why:** ele afirmou explicitamente "pode dar commit e push, não precisa da minha autorização" (2026-06-23).

**How to apply:** ao concluir uma mudança e o usuário pedir commit/push, rode `git add` dos arquivos relevantes + `git commit` + `git push` em sequência. Continuar excluindo arquivos não relacionados que já estavam untracked (ex.: PNGs soltos no repo) a menos que ele peça para incluí-los.
