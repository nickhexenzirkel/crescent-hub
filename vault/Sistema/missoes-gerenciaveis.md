---
name: missoes-gerenciaveis
description: Missões da Prisma Store viraram dados editáveis pelo admin + tempo jogado agora é medido em Wave/Speed/Stop/Paint/Palavras; PRECISA rodar supabase_uniko_missoes.sql
metadata: 
  type: project
---

Em 22/07/2026 preparei o terreno pra missões baseadas em minutos jogados nos jogos
(Uniko Speed, Stop, Paint) — os VALORES/metas ainda não estão decididos, quem define
é o admin pela tela.

**PRECISA rodar `supabase_uniko_missoes.sql`** antes de subir. Sem ele, o registro de
tempo jogado pode falhar (inclusive o do Uniko Wave, que já funcionava) — a gravação
passou a mandar a coluna `game`, que não existe na tabela antiga. Agora a falha fica no
console e a Prisma Store avisa quando não consegue calcular o progresso.

O que mudou:
- `uniko_playtime` ganhou a coluna `game` (PK vira player+day+game). As linhas antigas
  são do Wave, por isso o default `'wave'`.
- Nova tabela `mercado_missions` = a DEFINIÇÃO das missões (título, descrição, período,
  métrica, meta, recompensa). Antes era a constante `PRISMA_MISSIONS` no código, então
  mudar o valor de uma missão exigia deploy.
- `src/shared/prismaMissions.js` virou orientado a MÉTRICA (`MISSION_METRICS`):
  playtime / game_wins / compras / colecao / feedback / rank_mes / manual. É o que deixa o admin
  criar "Jogue 15 min no Uniko Paint" sem tocar em código.
- O save de cada colaborador (`mercado_state.data.missions`) agora guarda só
  `{id, claimed, claimedAt}` — a definição não é mais copiada pra dentro do save de
  cada pessoa (era isso que fazia mudança de valor não chegar em quem tinha save antigo).
- Prisma Store → Administrador → **Missões**: criar/editar/reordenar/pausar/apagar.
- `src/hooks/useGamePlaytime.js` conta o tempo de partida (só com a aba visível,
  descarrega a cada 60s). Paint/Stop contam dentro da SALA; Speed conta só correndo
  (solo `tela==='correndo'`, multi `phase==='racing'`); Uniko Palavras conta nas fases
  `jogando`, `duvida` e `pausa`; Wave continua mandando o tempo exato de cada partida
  por postMessage.
- Missões de minutos aceitam selecionar vários jogos; os tempos são somados e gravados
  em `mercado_missions.games` (array). Missões antigas continuam usando `game`, que é
  preservado para compatibilidade. Se o SQL atual ainda não foi executado, rode-o
  novamente para adicionar a coluna sem apagar as definições existentes.
- **Vitórias Uniko Games:** a missão diária limita em 3 os resgates por colaborador.
  Cada vitória de Palavras, Stop, Paint ou Speed cria um prêmio pendente na Prisma Store;
  o saldo só muda quando a pessoa clica em **Resgatar vitória**. O administrador configura
  o valor em Prismas na definição da missão. O Uniko Wave fica fora por não ter vencedor.
  Se o primeiro colocado for exatamente `admin`, a recompensa passa ao próximo colocado
  que não seja admin; moderadores continuam elegíveis. O SQL usa registro idempotente e
  RPC transacional para impedir crédito duplicado em clique/retry concorrente.
- Os jogos em sala só marcam a vitória como registrada depois que a RPC confirma o
  lançamento; se ainda não estiver configurada, tentam novamente enquanto o resultado
  permanecer aberto. No Dashboard RH → Monitoramento de Uso há o histórico de vitórias,
  resgate atômico de prêmios pendentes e recuperação manual de vitórias não listadas,
  usando a recompensa vigente da missão e mantendo trilha em `mercado_history`.
  No Uniko Paint, a partida pode usar apelido local; o registro de vitória deve converter
  o nome do placar para o nome da conta antes de salvar, pois a Prisma Store identifica
  a carteira pelo nome oficial do colaborador.
- A migração converte a antiga missão de vitória automática do Palavras para a missão
  genérica, preservando o valor configurado. Se não existir, cria a missão desativada e
  sem recompensa; o admin configura o valor e a ativa em Prisma Store → Administrador →
  Missões.
- Paint só conta tempo nas fases `drawing` e `reveal`; Stop conta nas fases de rodada ativa,
  nunca no lobby nem depois do fim. Falhas ao gravar/consultar playtime são registradas
  no console; a Prisma Store avisa quando não consegue calcular o progresso.
- Paint só conta nas fases `drawing` e `reveal`; Stop conta nas fases de rodada ativa,
  nunca no lobby nem depois do fim. Falhas ao gravar/consultar playtime são registradas
  no console; a Prisma Store avisa quando não consegue calcular o progresso.

Relacionado: [[mercado-estelar]], [[uniko-paint]], [[unikowave-speed-multiplayer]],
[[uniko-assistant]] (a mensagem proativa de maratona agora é montada a partir da missão,
não mais escrita na mão com 20/40 min do Wave).
