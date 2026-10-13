---
name: desligamento-colaborador
description: Desligamento na aba Gerenciar Usuários — tira o colaborador do ponto/portal e opção separada de bloquear o acesso; precisa de SQL + deploy na VPS
metadata: 
  type: project
---

Dashboard RH → Gerenciar Usuários ganhou a coluna/botão **Desligar** (31/08/2026), com dois interruptores independentes:

- **Desligado** (+ data e motivo) — para de contabilizar: sai das listas/totais/banco de horas do Ponto Eletrônico, some das abas Banco de Horas e Ponto Eletrônico do Portal, sai de `/api/team` (Colegas) e não alimenta mais presença/dias negativos. Se o RH ligar "mostrar histórico" no painel de config do ponto, o cálculo dele para na data do desligamento.
- **Desabilitar acesso** (`acesso_bloqueado`) — login barrado e sessão aberta derrubada (checagem no `requireAuth` com cache de 30s + poll de 5min no App.jsx).

Ponto: o id no AFD costuma ser PIS/PASEP, então `loadDesligados` (pontoDb.js) resolve por vínculo explícito → CPF → nome, e o match por nome só vale quando é ÚNICO.

**PRECISA rodar `supabase_desligamento.sql`** e dar deploy do crescent-hub-server na VPS (git pull + pm2 restart) — ver [[hostinger-vps-deploy]]. Enquanto a migration não roda, o servidor cai no comportamento antigo (erro 42703 tratado) em vez de quebrar.

Relacionado: [[ponto-eletronico-persistencia]], [[moderador-permissoes-server]].
