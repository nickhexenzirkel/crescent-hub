---
name: games-ranking-geral
description: Ranking geral da aba Games — soma de pontos normalizados dos 4 jogos arcade no Supabase
metadata: 
  type: project
---

A aba Games (`src/modules/central-colaborador/tabs/TabGames.jsx`) tem um **Ranking Geral** entre colaboradores: soma de **pontos normalizados** dos 4 jogos arcade (run, meteor, invaders, flap — NÃO inclui o Uniko Wave, que tem ranking próprio).

- **Tabela Supabase `games_scores`** PK `(player, game)`, guarda o recorde bruto de cada jogo. **Rodar `supabase_games_scores.sql`** no SQL Editor (RLS permissiva como o `uniko_scores`). Sem rodar, o ranking aparece vazio (erros engolidos por try/catch).
- Os recordes continuam salvos em `localStorage` (`ug_run`/`ug_meteor`/`ug_invaders`/`ug_flap`) por `saveBest`. `syncBestsToSupabase()` espelha os locais → Supabase (só sobe se for MAIOR) ao abrir a aba e ao FECHAR um jogo (`closeGame`). Sem login (nome = 'Colaborador') não grava.
- **Normalização:** `POINTS_REF = {run:300, meteor:1500, invaders:3000, flap:30}`; `gamePoints = round(score/REF*1000)`. Ajustar esses refs recalibra o peso de cada jogo. Total do jogador = soma dos 4.
- Identidade do jogador = `getAuthUser()?.name || USER.name` (mesma do ranking [[unikowave-architecture]] do Uniko Wave). Painel mostra "Sua pontuação" + quebra por jogo e top 10 com medalhas, destacando a linha do próprio jogador.
