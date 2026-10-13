---
name: agente-ia
description: Agente de IA independente (servidor) que resolve Pedidos de Ajuste sozinho: edita código numa branch, confere o build e abre pull request pro admin aprovar
metadata:
  type: project
---

Código: `crescent-hub-server/agent/` (guard.js trilhos, tools.js ferramentas, llm.js modelo, github.js PR, runner.js execução, index.js rotas+fila). Interface: aba **Dashboard RH → Pedidos de Ajuste** (`PedidosAjusteTab.jsx`).

**Como funciona:** pedido (pendente) → agente clona/atualiza o repo na VPS → branch `ia/pedido-<id>-…` → modelo usa ferramentas (search/read/replace/create/finish) → `npx vite build` precisa passar (se falhar, o erro volta pro modelo corrigir até 2x) → commit "Uniko IA" → push → **pull request**. O admin vê na aba e **Aprova** (squash merge → Vercel publica) ou **Recusa** (fecha o PR; pedido volta como *reaberto* com o comentário pro agente tentar de novo). Nada vai pra `main` sem aprovação.

**Modelo:** Groq — o agente DESCOBRE sozinho um modelo disponível na conta (GET /models, preferência: gpt-oss-120b, kimi-k2, llama-3.3-70b…) porque a Groq aposenta modelos (o 70b deu "does not exist" em out/2026); `AGENT_MODEL` força um específico. Mesma `GROQ_API_KEY` do assistente — gratuito, sem cartão). Limite de tokens/minuto do plano gratuito: o agente espera e tenta de novo (429). Qualidade menor que Claude: serve pra mudanças PEQUENAS. Dá pra trocar de provedor criando outro em `llm.js` (mesma assinatura `chat({messages,tools})`) e `AGENT_PROVIDER`.

**Trilhos (guard.js):** só escreve em `src/modules|shared|components|hooks` e `vault/Sistema`; bloqueado: ponto/RH, contracheques e Gerenciar* do dashboard-rh (o resto do dashboard-rh, como ordem das abas, o agente pode editar — pedido do dono 13/out), login/permissões/cargos/tokens, Uniko WhatsApp/Call/Safer, `.env`; recusa conteúdo que pareça chave; máx. 8 arquivos e 400 linhas por pedido; máx. 30 passos; 1 pedido por vez.

**Configuração (.env da VPS):** `GROQ_API_KEY` (já tem), `GITHUB_TOKEN` (fine-grained PAT só do repo, Contents + Pull requests read/write), `AGENT_REPO=nickhexenzirkel/crescent-hub`, opcional `AGENT_AUTO=1` (fila automática a cada 3 min), `AGENT_MODEL`, `AGENT_WORKDIR`. A VPS precisa de `git` e `npm`.
**SQL:** `supabase_pedidos_ajuste.sql` + `supabase_pedidos_ajuste_agente.sql` (projeto principal).
**Testado:** com modelo e GitHub falsos num repositório git local (guard, build falho→conserto, PR, main intacta). NÃO testado: Groq real e GitHub real — o primeiro pedido de verdade é o teste.

**Ao vivo:** o runner grava o log no banco a cada ~1,5s (coluna agente_log) com linhas em português (🔎 procurando, 📖 lendo arquivo, ✏️ EDITANDO arquivo + antes/depois, 🔨 build); a aba mostra "Agora: …" e o console rolando enquanto o status é em_andamento.

**Publicação direta (13/out):** o pedido tem a opção "Publicar direto" (coluna `auto_publicar`, padrão marcado na tela; `AGENT_AUTOPUBLISH=1` liga para todos). Com ela, depois do build passar o agente faz o squash merge sozinho (a Vercel publica em ~1 min) e guarda `merge_sha`. Botão **Desfazer** (rota `/api/agent/undo/:id`) cria um commit de reversão na main. Sem a opção, fluxo de aprovação + botão de prévia da Vercel. Todo usuário com o site aberto vê o aviso "O Uniko foi atualizado — Atualizar agora" (`src/shared/AtualizacaoDisponivel.jsx`, checa o index.html a cada 90s).
