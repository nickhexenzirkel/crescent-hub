---
name: uniko-stop
description: "Uniko Stop (Stop/Adedanha em tempo real) — bugs de respostas sumindo e letras repetindo, e como foram resolvidos"
metadata: 
  type: project
---

**Uniko Stop** (`src/modules/central-colaborador/tabs/TabUnikoStop.jsx`): Stop/Adedanha em tempo real (mesma arquitetura sem servidor do [[uniko-paint]] — host eleito escreve o estado em `uniko_stop_state`, broadcast pro efêmero). Fases: `sorteando`→`jogando`→`parando`→`validando`→`resultado`→`over`. Letras padrão `LETRAS` (sem K/W/X/Y/Z).

**Fix "respostas somem na votação" (ago/2026):** o broadcast do Supabase é best-effort (pode se perder) e o host validava em `parando + STOP_MS` mesmo sem ter recebido tudo → às vezes as palavras de alguém não apareciam. Dois consertos: (1) **reenvio no não-host** — effect que, enquanto `state.respostas[name]` não aparece no estado sincronizado (host não confirmou) e a fase é `parando`/`validando`, rebroadcasta as respostas a cada 1s; (2) **host fecha a rodada assim que TODOS os presentes têm respostas** (`temTodas`) OU no timeout do STOP (antes esperava sempre o STOP inteiro). `apurar`/`catsComResposta` iteram `s.respostas`, então basta garantir que esteja completo antes de `iniciarValidacao`.

**Fix "letras repetem entre partidas/salas" (ago/2026):** `usadas` zerava a cada `comecar`. Agora: `novaRodada` grava a letra sorteada em `pushRecentLetra` (localStorage `us_recent_letras`, cross-sala, cap 14) E no `recentes` do estado da sala (cross-partida dentro da sala). `comecar` **semeia o `usadas`** com a união (recentes da sala + localStorage do host), cap ~60% das habilitadas → letras recentes ficam pro fim e as menos vistas saem primeiro. Fallback `recomeça` quando o baralho esgota. Mesma ideia do anti-repetição de palavras do [[uniko-paint]].

Vitórias entram na missão diária **Vitórias Uniko Games**: o ranking final por pontos define a colocação; o prêmio fica pendente na Prisma Store e exige resgate manual. Se o primeiro colocado for admin, passa ao próximo não-admin; moderadores podem receber.
