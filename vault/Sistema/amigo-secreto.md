---
name: amigo-secreto
description: Módulo temporário Amigo Secreto 2026: consulta compartilhada da planilha de sugestões, com importação exclusiva para administrador
metadata:
  type: project
---

# Amigo Secreto

Módulo temporário no seletor de módulos. Colaboradores podem consultar e pesquisar a lista; somente administrador vê o controle de importação XLSX. A etiqueta “Temporário” é visual e não remove o módulo ou os dados automaticamente.

## Planilha

O administrador carrega um arquivo `.xlsx`, confere a quantidade e os primeiros nomes e confirma a publicação. O conteúdo publicado substitui a lista anterior em uma única operação. O parser identifica os cabeçalhos do formulário de 2026 e ignora o carimbo de data/hora.

Campos exibidos: nome, presentes desejados, gostos pessoais, cores favoritas, tamanho de roupa e tamanho de calçado. A tabela é responsiva, com pesquisa pelos dados publicados. O botão **Exportar PDF** baixa os participantes exibidos (respeitando a busca atual) em cartões organizados em grade, com quebra de texto e paginação. O cabeçalho do PDF usa o símbolo da marca 7 Benefícios, fundo branco e detalhes geométricos em azul e ciano.

## Supabase

Os dados ficam na linha singleton `amigo_secreto_2026` do projeto Supabase principal. Para habilitar leitura e publicação, executar `supabase_amigo_secreto_2026.sql` no projeto principal depois de `supabase_seguranca_auth_helper.sql`.

RLS exige `esta_logado()` para leitura e `current_role_uniko() = 'admin'` para inserção/atualização. A segurança não depende da visibilidade do botão na interface.

## Código

- Módulo e parser: `src/modules/amigo-secreto/`
- Geração do PDF: `src/modules/amigo-secreto/pdf.js`
- Cadastro e tag do seletor: `src/shared/ModuleSelector.jsx`
- Layout desktop: `src/shared/MenuLayoutNovo.jsx`
- Rota: `src/App.jsx`
