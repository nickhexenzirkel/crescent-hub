---
title: Lista de Tarefas (Meus Lembretes)
---
# Lista de Tarefas

Aba nova em **Portal → Minhas Tarefas (ex-Meus Lembretes)**, ao lado de Anotações. Código: `src/modules/central-lembretes/ListaTarefas.jsx` e `src/shared/listaTarefas.js`.

## O que faz
- Checklist do dia (navega para dias anteriores e marca/desmarca), tarefas pessoais (todo dia / dias da semana / uma vez só).
- Gráficos de barras **diário (14 dias), mensal (12 meses) e anual**, mais cartões Hoje/Mês/Ano.
- **Cada pessoa vê o próprio**; admin/moderador escolhe qualquer pessoa (somente leitura) e vê o ranking da equipe no mês.
- **Setor Faturamento**: quem está marcado como Faturamento (Portal → Colegas, chave `colegas_setores`) recebe o cronograma do [[controle-clientes]]: a aba Controle de Clientes envia a carteira (1,5 s depois de mexer) e a lista mostra os clientes do dia da semana (segunda a sexta; "TERÇA E SEXTA" vale nos dois dias).
- Períodos sem dia fixo (mensal, quinzenal, decendial, solicitação) ficam numa lista recolhida e **não entram na contagem** — não há regra de dia definida para eles.

## Dados (sem SQL novo, tabela `settings`)
- `lista_tarefas:<nome>` → `{ tarefas:[{id,titulo,freq,dias,data,criada,removida}], feitas:{ 'AAAA-MM-DD': {t:[ids], c:[chaves de cliente]} } }`
- `cronograma_faturamento:<nome>` → `{ atualizado, desde, itens }`. `desde` = 1º envio; dias antes dele não contam como "não feitos".
- Remover tarefa só põe `removida` (histórico dos gráficos preservado).
- O ranking da equipe soma só tarefas pessoais (sem o cronograma de cada um).

## Layout (atualizado)
- Gráficos, porcentagens e ranking da equipe **só aparecem** no botão de gráfico (ícone de barras) do cabeçalho do dia, numa janela com fundo desfocado. A tela principal mostra só o checklist.
- Desktop em 2 colunas (checklist do dia | nova tarefa + cadastradas); as listas rolam por dentro, a página não cresce. Mobile empilha.
