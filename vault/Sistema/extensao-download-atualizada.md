---
name: extensao-download-atualizada
description: Botão "Baixar extensão" (Meus Lembretes + ExtensionPrompt) deve sempre entregar a extensão atual; zip regenerado por hook pre-commit
metadata:
  type: feedback
---

O usuário quer poder baixar a extensão (Cat-Bot / Uniko Call) **sempre atualizada em tempo real** pelo botão "Baixar extensão" dentro de Meus Lembretes (central-lembretes) e no ExtensionPrompt.

**Why:** o link antigo apontava pra api.centraluniko.com.br/uniko-catbot.zip (cópia velha em crescent-hub-server/public, de 15/set, sem os arquivos do Uniko Call), então quem baixava recebia versão desatualizada.

**How to apply:** links agora são `/uniko-catbot.zip` (Vercel, mesmo repo). `.git/hooks/pre-commit` roda `scripts/zip-extension.ps1` e dá `git add public/uniko-catbot.zip` sempre que `extension/` entra no commit. Se o hook sumir (clone novo), rodar `npm run zip:ext` antes de commitar mudanças em extension/. Não usar a cópia do crescent-hub-server. Veja [[notificacoes-desktop]] e [[central-alexa-festival]] pro contexto da extensão.

**Aviso de atualização (08/out/2026, extensão 1.7.5):** Meus Lembretes compara a versão instalada (FAT_PONG agora traz `version` do manifest) com `__EXT_VERSION__` (vite.config.js lê extension/manifest.json no build/deploy). Desatualizada → banner + botão "Atualizar extensão" + status "Extensão desatualizada". Extensão antiga (sem version no PONG) também é avisada. **Regra: SEMPRE subir a `version` do extension/manifest.json ao mudar a extensão**, senão ninguém é avisado. Só em Meus Lembretes (ExtensionPrompt não é usado em lugar nenhum). Atualização continua manual (sem update_url): baixar zip, extrair por cima, recarregar em chrome://extensions.
