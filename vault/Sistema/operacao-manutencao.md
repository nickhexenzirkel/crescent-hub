---
name: operacao-manutencao
description: "Estado operacional/manutenção do crescent-hub — o que roda sozinho e o que pede atenção manual (VPS, tokens, Spotify, yt-dlp)"
metadata: 
  type: project
---

**jul/2026** — o usuário fez uma leva grande de atualizações e planejou parar de assinar o Claude Code, então deixamos o sistema o mais "autossuficiente" possível. Estado operacional:

**Roda sozinho (não precisa mexer):**
- **Cliente** — **CORREÇÃO 15/set/2026 (eu tinha diagnosticado errado antes, mais tarde no mesmo dia):** o site de verdade que todo mundo usa é **`www.centraluniko.com.br`, e continua 100% na VERCEL** (confirmado: header `Server: Vercel`, deploy fresco a cada push, serve `public/` normal — inclusive `/unikowave/index.html`, um arquivo de ~700KB). O usuário mencionou ter "migrado pra Hostinger", mas na prática **`centraluniko.com.br` SEM o `www` é só uma página "Parked Domain" da Hostinger — nunca serviu o app, nem a home**. Eu tinha testado esse domínio sem www mais cedo no mesmo dia, vi HTTP 200 + content-type text/html e concluí (ERRADO) que era o app rodando na Hostinger com um bug de fallback de SPA — na real nem tinha lido o corpo da resposta, era a página parada da Hostinger o tempo todo. Usuário pediu pra eu configurar o domínio sem www redirecionando pro www — **ação pendente, precisa ser feita no painel da Hostinger (Domínios → Redirecionamento), não tenho acesso a esse painel.**
- **Consequência prática:** o "fix" que apliquei antes dessa correção (servir `uniko-catbot.zip` pelo `crescent-hub-server`/`api.centraluniko.com.br` em vez do `public/` do cliente) resolvia um problema que só existia no domínio parado, sem uso real — mas não tem problema mantido, o zip funciona dos dois jeitos agora. **Lição: sempre inspecionar o CORPO da resposta (não só status/content-type) antes de concluir "está servindo isso", principalmente comparando www vs sem-www — podem ser hosts totalmente diferentes.**
- **yt-dlp** — o `crescent-hub-server` baixa a versão mais nova do yt-dlp **a cada restart** (curl do latest release, ver index.js ~linha 63). Um **cron semanal** (`0 5 * * 0 pm2 restart crescent-hub-server`) mantém isso fresco sem intervenção (o YouTube muda e quebra o yt-dlp velho; restart resolve).
- **VPS blindada** (feito jul/2026): `pm2-logrotate` (max 20M, retain 10 — impede disco encher e derrubar o servidor, que foi a causa de um "offline" anterior) + `pm2 startup`/`pm2 save` (reergue após reboot). VPS é Hostinger (~R$70/mês), ver [[hostinger-vps-deploy]].

**Pede atenção manual eventual (o usuário JÁ SABE fazer):**
- **Spotify cota** — o app está em Development Mode (limite de 20 usuários; NÃO qualifica pro Extended Quota Mode). Se bater a cota e levar ban temporário: só esperar o tempo OU trocar a conta Spotify. Não tem fix de código.
- **Alexa token / "offline"** — renovado pelo próprio usuário via Dashboard RH (comando que injeta os cookies pra reconectar a Alexa e deixá-la online). Ver [[alexa-token-persistencia]].
- **Deploy do servidor** — manual: `ssh root@187.127.27.98` → `cd /root/crescent-hub-server && git pull && pm2 restart crescent-hub-server`. Cliente não precisa (Vercel).

**Decisão consciente que NÃO foi feita:** migração de identidade por nome → ID estável (CPF/user_id). Recomendei NÃO fazer: mexe em ~10 tabelas (coleção/carteira/pontos/ponto/Kanban), risco de perder dados dos colaboradores, e o sistema por nome FUNCIONA (nomes batem entre login JWT e as tabelas — o "bug do presente" era cache, não mismatch de nome). Só reabrir isso se aparecer um mismatch real de nome.
