---
name: uniko-palavras
description: Uniko Palavras — jogo de blefe de palavras (Ghost) no Portal, mascote gato-polvo no centro, letras ao redor; PRECISA rodar supabase_uniko_palavras.sql
metadata:
  type: project
---

**Uniko Palavras** (`tabs/TabUnikoPalavras.jsx`, aba `unikopalavras`, liberada pra todos): 2 vidas; cada um acrescenta 1 letra ao fragmento; completar palavra (4+ letras) ou ser pego blefando na DÚVIDA custa 1 vida. Mascote `public/uniko-palavras.png` fica no centro da arena circular, letras (coloridas por jogador) num anel interno e jogadores num anel externo. Chat por broadcast.

Mesma arquitetura do [[uniko-stop]]: tabela `uniko_palavras_state`, host escreve o estado, jogadas vão por broadcast até o host (com `pos` p/ idempotência + reenvio). SEM dicionário (removido a pedido): dúvida (blefe) e botão "Formou palavra" viram VOTAÇÃO da turma (todos menos o acusado), 1 min, maioria decide na hora; sem maioria = ninguém perde e o jogo segue. Com só 2 jogadores o acusador é o único votante.

O tempo jogado é registrado para missões da Prisma Store nas fases `jogando`, `duvida`
e `pausa` (sem contar lobby ou tela final), desde que a aba esteja visível.
Vitórias entram na missão diária **Vitórias Uniko Games**: o prêmio fica pendente na
Prisma Store e só é creditado quando o colaborador clica em **Resgatar vitória** (até
3 resgates por dia). Se o vencedor for admin, a recompensa vai ao próximo colocado
elegível pela ordem de sobrevivência; moderadores podem recebê-la.

**Why:** pedido do usuário (30/set/2026). **How to apply:** PRECISA rodar `supabase_uniko_palavras.sql`; sem ranking/convites; não foi testado em sala real com 2+ pessoas.
