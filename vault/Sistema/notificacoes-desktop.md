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

**Preferências individuais (nov/2026):** no menu de perfil da tela de módulos existe o botão **Notificações**, também acessível pelo menu de configurações no celular e pelo painel do UNIKO. Cada função pode avisar **Desativadas**, **Só na tela**, **Só no desktop**, **Tela + desktop** ou **Só som da aba**. O seletor controla Atualizações, spawn do Capture o Uniko, spawn do Capture o Número e mensagens do Blog Secreto (Chat Secreto). As preferências ficam no `localStorage` por usuário/navegador (`src/shared/notificationPreferences.js`); não sincronizam entre dispositivos e não exigem SQL. Os eventos de tela são entregues pelo App; push desktop usa `notifyDesktop` e depende da permissão do navegador/extensão.

Os padrões iniciais preservam a via visual principal de cada função: Atualizações = tela + desktop; spawns = desktop; Chat Secreto = tela; faturamento da regional = tela + desktop. No Chat Secreto, push desktop usa texto genérico e não expõe o conteúdo anônimo da mensagem. Notificações de faturamento têm `recipient_id` e só são selecionáveis pelo funcionário destinatário conforme a política RLS; as antigas notificações com destinatário nulo continuam como broadcast. Outros avisos (RH/lembretes, convites e Bate-Papo do Uniko FIT) não são alterados por este seletor.

**Acompanhar Faturamento:** ao abrir o painel, consulta o Gmail imediatamente e atualiza a cada 15 minutos enquanto a tela estiver visível. Isso usa a cota Gmail; não consulta em segundo plano quando o painel está fechado. Na primeira sincronização, mensagens do dia atual também podem gerar aviso para a regional vinculada, mesmo que tenham sido enviadas antes de ativar o acompanhamento. A entrega pendente é recuperada por até 24 horas quando o destinatário entrar no Uniko.

**Deduplicação após recarregar (nov/2026):** IDs de notificações já processadas são guardados no `localStorage` por usuário/navegador (até 500 IDs e 7 dias). No próximo carregamento, o polling de avisos recuperados não repete o popup/som/desktop para IDs tratados antes; avisos novos continuam chegando por realtime ou pelo polling. A chave não sincroniza entre dispositivos. Lembretes pessoais usam o mesmo registro com a chave diária/horária, evitando que um refresh dispare novamente o lembrete no mesmo minuto.
