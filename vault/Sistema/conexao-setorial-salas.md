---
name: conexao-setorial-salas
description: Conexão Setorial virou multi-sala com senha; PRECISA rodar supabase_conexao_setorial_salas.sql
metadata: 
  type: project
---

A Conexão Setorial deixou de ser um único quadro e passou a ter **salas**: cada sala é um quadro Kanban próprio, protegido por senha. Sem sala escolhida, o módulo abre um lobby (`SalasLobby.jsx`); ao entrar, carrega só as colunas/cards daquela sala.

- Tabela `conexao_rooms` + coluna `conexao_lists.room_id`. **Rodar `supabase_conexao_setorial_salas.sql`** (depois do `_trello.sql`).
- A migração adota o quadro existente como a sala "Financeiro", sem senha.
- Só admin cria sala, define/remove senha e exclui.
- Senha guardada como hash SHA-256; validação no **cliente**. Como a tabela é legível pela chave anon, isso organiza acesso entre colegas mas **não** é barreira real — se um dia precisar valer de verdade, mover a validação para o crescent-hub-server com RLS fechada.
- Sala destravada fica liberada até fechar a aba (`sessionStorage`).

**jul/2026 — acesso ao MÓDULO liberado pra todo mundo** (antes era admin + uma lista fixa de CPFs, `CONEXAO_SETORIAL_CPFS`). `podeConexaoSetorial()` em `src/contexts/user.js` virou sempre `true` — os 3 pontos que gateavam (`ModuleSelector.jsx` filtro + `App.jsx` `handleModuleSelect` + gate de render) continuam chamando a função, só ela que mudou, pra não precisar tocar nos 3 de novo se um dia quiserem restringir de volta. **Criar/excluir sala continua admin-only** (`isAdmin` passado pro `SalasLobby`) — só a entrada no módulo em si foi aberta.

Ver [[conexao-setorial-trello]].
