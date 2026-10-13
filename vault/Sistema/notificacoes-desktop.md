---
name: notificacoes-desktop
description: Como funcionam as notificações (lembretes/avisos RH) e o pop-up desktop via extensão Cat-bot
metadata: 
  type: project
---

**Sistema de notificações vive no `src/App.jsx`** (raiz, ativo enquanto `authUser` existe), dois disparadores:
1. Realtime do Supabase na tabela `notifications` (INSERT) → avisos do Dashboard RH (`aviso_urgente`, `lembrete`, `alexa`).
2. `check()` a cada 30s lê a tabela `reminders` (type `personal`) e dispara lembretes pessoais no horário (prefixo `__urgent__` na message = urgente). Lembretes pessoais NÃO entram em `notifications` (evita vazar para outros via realtime); avisos do RH entram → broadcast.

Ambos empurram para `notifQueue` (popup in-site: urgente = tela cheia, lembrete = canto) e tocam som.

**Pop-up no DESKTOP via extensão Cat-bot** (adicionado 2026-06-08): `App.jsx` tem `notifyDesktop(n)` que faz `window.postMessage({type:'UNIKO_NOTIFY_SHOW', notif})`. Fluxo: página → `extension/content-script.js` (prefixo `UNIKO_NOTIFY_` em ALLOWED_PREFIXES, encaminho silencioso) → `extension/background.js` `showDesktopNotification()` → `chrome.notifications.create` (id estável `uniko-<id>` evita duplicar entre abas; urgente = requireInteraction; clique foca a aba). Requer permissão `notifications` no manifest (extensão v1.1.0) — **usuário precisa recarregar a extensão**.

**Limitação:** só dispara com alguma aba do Crescent Hub aberta (mesmo em 2º plano). Para notificar com o Hub fechado, a extensão precisaria pollar o Supabase sozinha (não implementado). Ver [[unikowave-architecture]] para o padrão de mensagens da extensão.

**Permissão (Chrome exige gesto):** `src/utils/desktopNotify.js` tem `notifyDesktop` (extensão→fallback web), `webNotify` e `ensureNotifyPermission` (chamar em clique/tecla). App.jsx pede a permissão no 1º gesto após login; o painel Lembretes tem botão "Ativar notificações / Testar no desktop".

**Capture o Uniko também dispara (jul/2026):** `CaptureUnikoWidget.jsx` chama `notifyDesktop` quando um Uniko fica disponível pra captura (`available` false→true), mesmo caminho/API descrita acima. Ver [[oficina-de-uniko]] pra detalhe do id estável/dedup entre abas.

**Regressão achada 15/set/2026 — quebrou tudo isso na migração pra Hostinger:** `extension/manifest.json` (`content_scripts.matches`/`host_permissions`) só tinha `crescent-hub.vercel.app`, nunca foi atualizado quando o front-end migrou pra `centraluniko.com.br`. Resultado: content-script não injeta no domínio atual → nada de `postMessage`, `checkExtension()` sempre dá "Extensão inativa", notificações desktop E automação do Faturamento paravam de funcionar silenciosamente. Corrigido (manifest v1.1.7→1.1.8 com o domínio novo) — mas usuário precisa reinstalar/recarregar a extensão pro Chrome pegar o manifest novo. Ver [[unikowave-pot-provider]] pro caso que expôs isso (mesma causa afetava os cookies do YouTube do Uniko Wave).

**Distribuição da extensão:** `public/uniko-catbot.zip` é o pacote para download (servido em `/uniko-catbot.zip`), contém a pasta `uniko-catbot/` com manifest+js+icon. **REGERAR o zip SEMPRE que mexer em `extension/`** com `npm run zip:ext` (= `scripts/zip-extension.ps1`, Compress-Archive). `src/shared/ExtensionPrompt.jsx` é o banner "Ação necessária" (usa `checkExtension`) com download + passo a passo + botão "Já instalei / Verificar" (confirma em verde quando ativa), montado em App.jsx quando `authUser`. O painel Lembretes também tem um indicador "Extensão ativa/inativa" (`verificarExtensao` → `checkExtension`).
