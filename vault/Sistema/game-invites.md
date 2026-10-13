---
name: game-invites
description: "Convites de jogo (Uniko Paint/Stop) — lista de amigos, notificação e navegação direta"
metadata: 
  type: project
---

**Convites de jogo** (ago/2026): dá pra chamar colegas pra jogar Uniko Paint / Uniko Stop. **Rodar `supabase_game_invites.sql`** (tabela `game_invites` + realtime + RLS permissivo).

- **`src/shared/gameInvites.js`**: `sendGameInvites({toNames,game,roomId,roomName})` (insert), `subscribeGameInvites(myName,onInvite)` (realtime SEM filtro no servidor — filtra `to_name` no cliente pra nome com espaço/acento não quebrar; + poll 20s), `fetchColegas()` (`/api/employees`), e a ponte de navegação: `setPendingJoin`/`readPendingJoin('paint'|'stop')`/`clearPendingJoin` (localStorage `uniko_game_join`, expira 2min) + evento `GAME_JOIN_EVENT` + `GAME_TAB`/`GAME_LABEL`.
- **`src/shared/FriendsInvite.jsx`**: `FriendsInvite` (painel: busca + "Convidar" por pessoa + "Convidar todos") e `ConvidarButton` (botão que abre o painel num modal). Usados no cabeçalho do lobby (roomId=null → "vem jogar") e na sala (roomId=atual → entra direto) de AMBOS os jogos.
- **Fluxo do convite:** App.jsx assina os convites do usuário logado → mostra popup no canto inf. direito + `playReminder()` + `notifyDesktop`. Aceitar (`aceitarConvite`) → `setPendingJoin` + `navPush('colaborador')` + dispara `GAME_JOIN_EVENT`. O **Portal** (central-colaborador/index.jsx) escuta o evento E lê o pendingJoin no mount → troca pra aba `unikopaint`/`unikostop`. A **aba do jogo** (root de TabUnikoPaint/Stop) lê o pendingJoin no mount e no evento → `setRoom(roomId)` se veio sala, e `clearPendingJoin`.

**Sala Geral removida também do Uniko Stop** (mesmo padrão do [[uniko-paint]]): lobby filtra/apaga `GLOBAL_ROOM` e, sem salas, mostra "Para jogar, crie uma sala e chame seus amigos para jogar!".
