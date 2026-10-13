---
name: alexa-token-persistencia
description: "Como o token da Alexa é gerado, onde vive e por que se auto-renova agora (crescent-hub-server)"
metadata: 
  type: project
---

A integração Alexa (TTS/anúncios no Echo) fica no **outro repo** `C:\Users\finan\Videos\crescent-hub-server` (não no `crescent-hub`). Usa o pacote `alexa-remote2` v8. **Atenção:** este texto descreve a época em que o servidor rodava no Render (`crescent-hub-server.onrender.com`) — em jul/2026 migrou pra uma VPS da Hostinger com PM2, ver [[hostinger-vps-deploy]] pra acesso/deploy/logs atuais. A lógica de renovação de token abaixo (Supabase `settings`) continua igual, só o host mudou.

**Gerar token manualmente:** `cd C:\Users\finan\Videos\crescent-hub-server && node setup-alexa.js` → abre proxy em http://localhost:3456 → login Amazon (`amazon.com.br`/pt-BR pra evitar bloqueio de atividade incomum) → imprime JSON pra colar na env var `ALEXA_REGISTRATION_DATA` do Render. Força IPv4 (IPv6 dava ETIMEDOUT). Timeout 10 min.

**Por que precisava re-logar:** o `index.js` carregava o token só da env var (estática). O `alexa-remote2` renova o cookie sozinho via `refreshToken`/`macDms` e entrega o novo registro pelo evento `alexa.on('cookie')`, mas o código antigo NÃO escutava esse evento — o token renovado só vivia na RAM e era perdido em todo restart do Render (deploy/crash/spin-down), voltando ao token velho da env var até vencer.

**Fix (jun/2026):** `initAlexa()` em `index.js` agora é async e persiste o registro na tabela Supabase `settings` (key `alexa_registration_data`), espelhando o padrão do `spotify_refresh_token`. `alexa.on('cookie')` faz upsert do `alexa.cookieData` a cada renovação; `cookieRefreshInterval` = 4 dias força renovação periódica.

**Bug 1 (jul/2026):** `AMAZON_EMAIL`/`AMAZON_PASSWORD` (configurados no Render) só eram passados pro `alexa-remote2` quando NÃO havia `reg` salvo no Supabase — ou seja, nunca, depois do 1º setup. Se a renovação automática falhasse, caía direto no login manual por navegador mesmo com credenciais disponíveis. Fix: credenciais sempre entram na config como fallback, e o log de erro agora mostra o motivo detalhado (`err.message`).

**Bug 2 (jul/2026, o mais importante — causava "atualizei o token e continua expirado"):** `loadAlexaReg()` sempre PRIORIZAVA o valor salvo no Supabase e só lia `ALEXA_REGISTRATION_DATA` como semente na 1ª vez (quando o Supabase estava vazio). Depois disso, colar um token novo na env var do Render não tinha efeito NENHUM — o código nem chegava a ler o valor novo. Fix: agora guarda o último valor da env var já processado numa chave separada (`alexa_registration_data_env_seed`); se a env var mudar (token novo colado à mão), isso é detectado e o novo token substitui o do Supabase, mesmo que o do Supabase pareça "mais recente" (auto-renovado). Tem migração pra não sobrescrever um token bom por engano no 1º boot de quem já tinha reg salvo antes desse fix.

Ambos os fixes ainda não eliminam 100% a necessidade de re-login manual — se a Amazon bloquear por "atividade incomum" vinda do IP do Render, o login automático (headless, via `generateAlexaCookie` com email/senha) também esbarra no mesmo bloqueio e cai no fluxo do navegador de qualquer jeito.

Ver [[unikowave-architecture]] (descreve os servidores; o crescent-hub-server também serve o jogo).

**Bug 3 (ago/2026 — a causa real do "tenho que logar de novo toda hora"): `/auth/register` recusando o refresh.** Diagnosticado reproduzindo o `initAlexa()` local com o reg do Supabase. A cadeia de renovação do `alexa-cookie2` 5.0.3 é: (1) `POST api.amazon.com.br/auth/token` troca refreshToken→accessToken — **OK**; (2) `POST www.amazon.com.br/ap/exchangetoken/cookies` pega cookies novos — **OK**; (3) `POST api.amazon.com.br/auth/register` **re-registra o "device"** e a Amazon responde `InvalidToken` / `"Auth time of the token is expired."` — um access token derivado de refresh não tem autenticação recente o bastante pra registrar dispositivo. Falhando o passo 3, o `alexa-remote2` cai no fluxo de login por navegador mesmo com o registration data 100% válido. **Fix: subir `alexa-remote2` 8.0.4→8.1.1 (puxa `alexa-cookie2` 5.0.3→5.0.6)** — a 5.0.6 introduziu `finishCookieRefresh()`, que PULA o re-registro no refresh e só atualiza cookies locais + csrf (a lib até ganhou o teste `refresh-skips-app-registration.test.js`). Testado: init OK e `getDevices` lista "Escritório Echo Spot". Commit `6373aa8` no crescent-hub-server (o repo versiona `node_modules`, então o deploy é só `git pull` + `pm2 restart`, sem npm install).

**Como diagnosticar rápido sem SSH:** `GET https://api.centraluniko.com.br/api/alexa/status` (sem auth) → `{"ok":false}` = Alexa caída. Pra saber se o token em si morreu, basta bater `POST api.amazon.com.br/auth/token` com o `refreshToken` do Supabase: se voltar `access_token`, o token está vivo e o problema é outro (foi exatamente esse o caso aqui). O `updated_at` da tabela `settings` NÃO é atualizado no upsert — usar o campo `tokenDate` de dentro do JSON pra saber a idade real do registro.

**Por que estar logado na Amazon no navegador NÃO ajuda o `setup-alexa.js`:** o `alexa-cookie2` sobe um proxy MITM em `localhost:3456` e reescreve o domínio dos cookies (`cookieDomainRewrite` → `localhost`), então os cookies de `.amazon.com.br` do navegador nunca são enviados pro proxy. Além disso o fluxo gera um `deviceId`+PKCE novos e registra um dispositivo NOVO na conta. Ou seja: o login manual sempre pede senha, por design — o caminho certo é nunca precisar dele (renovação automática funcionando).

**Endpoint pra trocar o token sem SSH:** `POST /api/alexa/update-registration` (admin) salva o JSON no Supabase e chama `initAlexa()` na hora, sem reiniciar o processo.

**CONFIRMADO em produção (2026-08-28):** deploy do `6373aa8` na VPS feito e a Alexa voltou — sem nenhum re-login manual.
