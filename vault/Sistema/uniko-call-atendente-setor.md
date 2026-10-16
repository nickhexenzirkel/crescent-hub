---
name: uniko-call-atendente-setor
description: Uniko Call — ligações agora têm atendente e setor (login CPF+senha no popup da extensão) e a tela tem abas Contatos/Atendentes/Setores
metadata:
  type: project
---

Em 07/out/2026: extensão v1.7.0 tem card de login no popup (CPF+senha do Portal → token de 30 dias, escopo `uniko-call`, guardado em `chrome.storage.local.unikoAttendant`; senha nunca salva). `offscreen.js` pede o token ao background (`UNIKO_CALL_GET_ATTENDANT_TOKEN`) e manda como `attendantToken` no upload. Servidor (`crescent-hub-server/uniko-call.js`, 3º arg `deps` vindo do index.js): rotas `/api/uniko-call/login` e `/whoami`; grava `attendant_id/attendant_name/sectors` NA HORA da ligação (retrato; setores vêm da tag `colegas_setores` da tabela settings do Portal, mesma de TabColegas). Sem login a gravação NÃO é recusada — fica "Sem atendente identificado".

**Why:** usuário queria ver ligações organizadas por atendente e setor; escolheu login no popup (mais confiável que seleção de nome) e abas na tela.

**How to apply:** PRECISA rodar `supabase_uniko_call_atendente.sql` (projeto Safer) + deploy na VPS (git pull + pm2 restart) + atendentes reinstalarem a extensão (zip da Vercel) e logarem. Lista de setores duplicada em `src/modules/uniko-call/index.jsx` (SETORES) — atualizar junto com TabColegas. Veja [[uniko-call-transcricao]].

**Minhas ligações (16/out/2026):** aba "Uniko Call" em Minhas Tarefas (central-lembretes/MinhasLigacoes.jsx) é espelho só de leitura: lê as mesmas tabelas/áudio, sem copiar nada. Privacidade pelo RLS (attendant_id = id do token) — PRECISA rodar supabase_uniko_call_minhas.sql.
