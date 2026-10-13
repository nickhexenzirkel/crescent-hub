---
name: agente-ia
description: Agente de IA independente (servidor) que resolve Pedidos de Ajuste sozinho: edita código numa branch, confere o build e abre pull request pro admin aprovar
metadata:
  type: project
---

Código: `crescent-hub-server/agent/` (guard.js trilhos, tools.js ferramentas, llm.js modelo, github.js PR, runner.js execução, index.js rotas+fila). Interface: aba **Dashboard RH → Pedidos de Ajuste** (`PedidosAjusteTab.jsx`).

**Como funciona:** pedido (pendente) → agente clona/atualiza o repo na VPS → branch `ia/pedido-<id>-…` → modelo usa ferramentas (search/read/replace/create/finish) → `npx vite build` precisa passar (se falhar, o erro volta pro modelo corrigir até 2x) → commit "Uniko IA" → push → **pull request**. O admin vê na aba e **Aprova** (squash merge → Vercel publica) ou **Recusa** (fecha o PR; pedido volta como *reaberto* com o comentário pro agente tentar de novo). Nada vai pra `main` sem aprovação.

**Modelo:** Groq (`llama-3.3-70b-versatile`, mesma `GROQ_API_KEY` do assistente — gratuito, sem cartão). Limite de tokens/minuto do plano gratuito: o agente espera e tenta de novo (429). Qualidade menor que Claude: serve pra mudanças PEQUENAS. Dá pra trocar de provedor criando outro em `llm.js` (mesma assinatura `chat({messages,tools})`) e `AGENT_PROVIDER`.

**Trilhos (guard.js):** só escreve em `src/modules|shared|components|hooks` e `vault/Sistema`; bloqueado: RH/ponto/dashboard-rh, login/permissões/cargos/tokens, Uniko WhatsApp/Call/Safer, `.env`; recusa conteúdo que pareça chave; máx. 8 arquivos e 400 linhas por pedido; máx. 30 passos; 1 pedido por vez.

**Configuração (.env da VPS):** `GROQ_API_KEY` (já tem), `GITHUB_TOKEN` (fine-grained PAT só do repo, Contents + Pull requests read/write), `AGENT_REPO=nickhexenzirkel/crescent-hub`, opcional `AGENT_AUTO=1` (fila automática a cada 3 min), `AGENT_MODEL`, `AGENT_WORKDIR`. A VPS precisa de `git` e `npm`.
**SQL:** `supabase_pedidos_ajuste.sql` + `supabase_pedidos_ajuste_agente.sql` (projeto principal).
**Testado:** com modelo e GitHub falsos num repositório git local (guard, build falho→conserto, PR, main intacta). NÃO testado: Groq real e GitHub real — o primeiro pedido de verdade é o teste.
