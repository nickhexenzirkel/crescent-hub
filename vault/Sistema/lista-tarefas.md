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
- Dias do mês: **decendial 1, 11 e 21; quinzenal 1 e 16; mensal 1** (caindo em sábado/domingo, passa para a segunda seguinte). Só "solicitação" fica numa lista recolhida, fora da contagem.

## Dados (sem SQL novo, tabela `settings`)
- `lista_tarefas:<nome>` → `{ tarefas:[{id,titulo,freq,dias,data,criada,removida}], feitas:{ 'AAAA-MM-DD': {t:[ids], c:[chaves de cliente]} } }`
- `cronograma_faturamento:<nome>` → `{ atualizado, desde, itens }`. `desde` = 1º envio; dias antes dele não contam como "não feitos".
- Remover tarefa só põe `removida` (histórico dos gráficos preservado).
- O ranking da equipe soma só tarefas pessoais (sem o cronograma de cada um).

## Layout (atualizado)
- Gráficos, porcentagens e ranking da equipe **só aparecem** no botão de gráfico (ícone de barras) do cabeçalho do dia, numa janela com fundo desfocado. A tela principal mostra só o checklist.
- Desktop em 2 colunas (checklist do dia | nova tarefa + cadastradas); as listas rolam por dentro, a página não cresce. Mobile empilha.

## Widget no menu de módulos
- `WidgetTarefas` em `src/shared/MenuLayoutNovo.jsx` (hook `useTarefasHoje` em `menuWidgets.js`): saudação por horário, "Você tem N tarefas disponíveis para hoje", até 3 pendentes marcáveis direto no cartão, selo vermelho com a contagem; clicar abre Minhas Tarefas (Portal, aba `lembretes`).
- Aparece só no menu de **computador** (o menu do celular é lista de módulos, sem widgets). O admin liga/desliga em Dashboard RH → Painéis ("Tarefas de hoje"); some também se o cargo não tem a aba `lembretes`.

## Acúmulo de tarefas e dias úteis (lib `listaTarefas.js`)
- Cada cliente do cronograma gera **ocorrências** (cliente + data de vencimento). Vencimento que cai em sábado, domingo ou **feriado nacional** (fixos + carnaval, sexta santa e corpus christi calculados pela Páscoa; sem feriados estaduais/municipais) passa para o próximo dia útil.
- Ocorrência não feita **continua valendo** e aparece sozinha em "hoje" com a etiqueta "Acumulada · venceu …". Prazo em dias úteis após o vencimento (`PRAZO_UTEIS`): semanal 1, decendial 5, quinzenal 7, mensal 10. Vencimentos anteriores ao 1º envio do cronograma (`desde`) não acumulam.
- Estatística: conclui dentro ou depois do vencimento, conta como **feita no dia do vencimento**; dentro do prazo e sem marcar **não conta** como não feita; passou do prazo vira não feita.
- Marcação guardada como `k@AAAA-MM-DD` em `feitas[dia].c` (marcas antigas só com `k` valem para o próprio dia).
- A tela acompanha a virada do dia sozinha (se estava em "hoje").
