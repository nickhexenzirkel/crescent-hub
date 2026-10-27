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
  playtime / compras / colecao / feedback / rank_mes / manual. É o que deixa o admin
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
- O administrador pode criar missões por vitórias no Uniko Palavras e definir meta e
  recompensa na Prisma Store. Ao atingir a meta, os Prismas configurados são creditados
  automaticamente, uma vez por período. Se o vencedor for administrador, a vitória da
  missão vai para o colaborador comum que permaneceu por mais tempo na partida.
- Paint só conta nas fases `drawing` e `reveal`; Stop conta nas fases de rodada ativa,
  nunca no lobby nem depois do fim. Falhas ao gravar/consultar playtime são registradas
  no console; a Prisma Store avisa quando não consegue calcular o progresso.

Relacionado: [[mercado-estelar]], [[uniko-paint]], [[unikowave-speed-multiplayer]],
[[uniko-assistant]] (a mensagem proativa de maratona agora é montada a partir da missão,
não mais escrita na mão com 20/40 min do Wave).
