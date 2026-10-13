---
name: acoes-administrativas
description: Pedidos de Ajuste que não mexem em código — esconder/mostrar/renomear módulos e abas (todos ou só algumas pessoas) e tirar um Uniko capturado de alguém; com desfazer
metadata:
  type: project
---

Código: `crescent-hub-server/agent/acoes.js` (interpretar/executar/desfazer), chamado pelo `runner.js` ANTES do modo de código. O modelo só entende o pedido (escolhe ação e ids a partir de listas curtas de candidatos tiradas do catálogo atual do repo: `ModuleSelector.jsx` e `NAV` do `Sidebar.jsx`, Unikos de `captureUniko.js`, pessoas da tabela `employees`); quem executa é código validado. Ids/pessoas inventados são recusados; ambiguidade ("qual Nicolas?") vira pergunta (status falhou com a dúvida).

**Ações:** `esconder`/`mostrar` (módulo ou aba; para todos ou lista de nomes), `renomear`, `remover_uniko` (apaga de `capture_uniko_captures` da pessoa). Protegidos que nunca escondem: módulo `colaborador` e `dashboard`, aba `inicio`. "Tirar o Uniko Detetive do Nicolas" = ABA (Detetive não é capturável) → esconder pra ele; "Uniko Sereia" é capturável → remover da coleção (decisão por catálogo).

**Aplicação no site:** tabela `uniko_visibilidade` (tipo modulo|aba, item_id, nome, oculto_todos, ocultar_para[]) lida por `src/shared/visibilidade.js` (cache local + a cada 3 min/ao voltar pra aba): `ModuleSelector.jsx` filtra/renomeia cards; `NAV_FOR` (Sidebar.jsx) filtra/renomeia abas do Portal. Escondido não é bloqueio de acesso (só some do menu). Aba Dashboard RH → "Módulos e Abas" lista e remove regras.

**Fluxo:** com "Publicar direto" marcado aplica na hora (status feito, `acao.undo` guardado → botão Desfazer); desmarcado fica em_revisao ("Vou fazer: …") e o botão vira **Aplicar**. SQL: `supabase_visibilidade.sql` (também cria a coluna `acao jsonb` em `uniko_pedidos_ajuste`). Testado com banco/modelo falsos (e catálogo REAL do repo).
