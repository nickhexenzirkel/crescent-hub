---
name: moderador-permissoes-server
description: Permissões do cargo moderador no Dashboard RH — o gate precisa existir no CLIENTE e no SERVIDOR
metadata: 
  type: project
---

**Lição importante (ago/2026):** liberar uma aba pro moderador no cliente (`MODERADOR_TABS` em `crescent-hub/src/modules/dashboard-rh/index.jsx`) NÃO basta — as chamadas de API por trás também precisam aceitar `role==='moderador'`, senão o servidor devolve 403 e a tela fica com listas vazias / erros silenciosos. Foi exatamente esse o bug reportado pela Mara da Silva (moderadora): a aba **Informações Pessoais** abria, mas a lista de colaboradores vinha vazia, porque `/api/employees*` (servidor, repo separado **`crescent-hub-server`**, clone local em `C:\Users\finan\Videos\crescent-hub-server`) só tinha o middleware `requireAdmin`.

**Fix (`crescent-hub-server/index.js`):** novo middleware `requireAdminOrModerador` (aceita `role==='admin'` OU `'moderador'`), aplicado às 8 rotas de funcionários: `GET/POST /api/employees`, `GET/PUT/PUT(senha) /api/employees/:id`, `GET/POST /api/employees/:id/salary-history`, `PUT /api/employees/:id/profile`. Isso cobre as abas **Funcionários, Gerenciar Usuários e Informações Pessoais** (todas em `MODERADOR_TABS`, todas dependem dessas rotas).

**Blindagem contra escalonamento de privilégio (junto no mesmo fix):** como o cliente não esconde NADA do moderador dentro dessas abas (mesmo dropdown de cargo, mesmo botão de redefinir senha que o admin vê — `isModerador` só filtra QUAIS abas aparecem, não o conteúdo dentro delas), o servidor agora barra: moderador não pode setar `role:'admin'` em ninguém (nem promover a si mesmo), e não pode editar/redefinir senha/mexer no salário de quem **já é** admin (`employeeIsAdmin(id)` checa antes). Moderador continua livre pra gerenciar colaboradores e outros moderadores.

**Deploy:** commitado e enviado pro GitHub (`crescent-hub-server`, commit `f91a81c`), mas **ainda precisa ser implantado na VPS** — eu não tenho acesso SSH. Passos (ver [[hostinger-vps-deploy]]): `ssh root@187.127.27.98` → `cd <pasta-do-crescent-hub-server>` → `git pull` → `pm2 restart crescent-hub-server`. Sem isso rodar, o bug da Mara continua acontecendo em produção mesmo com o código já corrigido no GitHub.

**Pra próxima vez que abrir mais permissão pro moderador:** sempre checar as DUAS pontas — `MODERADOR_TABS` no cliente E os middlewares das rotas de API que aquela aba consome no `crescent-hub-server`.
