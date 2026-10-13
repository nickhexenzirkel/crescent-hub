---
name: contagem-ferias
description: "Contagem regressiva de férias na aba Início do Portal — só pra um grupo seleto de 14 pessoas, cada uma vendo só a própria data"
metadata: 
  type: project
---

**Contagem de Férias** (jul/2026) — card "CONTAGEM DE FÉRIAS" na aba Início do Portal do Colaborador (`src/modules/central-colaborador/tabs/TabInicio.jsx`), logo abaixo do HERO. Mostra a data-limite de férias + quantos meses/dias faltam (cálculo de calendário via `monthsDaysUntil`, não só divisão de dias por 30).

**Só aparece pra um grupo seleto de 14 pessoas** — lista fixa em `src/shared/vacationDeadlines.js` (`VACATION_DEADLINES`, array de `{name, date}`). Cada pessoa vê SÓ a própria data (`getMyVacationDeadline(USER.name)`), comparando por nome normalizado (maiúsculas, sem acento, espaços colapsados via `normName`) — funciona mesmo se o nome no token JWT (`USER.name`) tiver acento/capitalização diferente da lista.

**Lista atual (datas DD/MM/AAAA convertidas pra YYYY-MM-DD internamente):**
Cleanderson Pereira Batista (18/09/2026), Guilherme Alves Marquies (10/01/2027), Marcos Roberto Torres Filho (10/01/2027), Joao Herbert de Oliveira Sa (31/01/2027), Victor Gabriel Ferreira de Paula (01/04/2027), Nicolas Andrade Barboza (01/07/2027), Alan Matos Paixao (01/07/2027), Maria Renata Vieira Camargo (31/08/2027), Rondiney Lourenco da Costa (01/09/2027), Gleydson da Silva Marques (19/09/2027), Mikael Araujo Silva (05/01/2028), Brenda Kesia Pereira Lima Viana (08/02/2028), Karina Maria Barbosa da Silva (08/02/2028), Mara de Sousa Almeida (08/02/2028).

**Pra adicionar/editar gente na lista:** só mexer no array `VACATION_DEADLINES` em `src/shared/vacationDeadlines.js` (name em qualquer case/acento, date em `YYYY-MM-DD`). Não tem UI de admin pra isso — é hardcoded de propósito (lista pequena e fixa, não pediu pra ser editável).

**Limitação conhecida:** é filtragem client-side (a lista inteira vai no bundle JS pra todo mundo, só a UI esconde o card de quem não está nela) — não é um segredo protegido no servidor. Se algum dia isso precisar ser mais privado (dado sensível de RH), teria que mover pra uma tabela Supabase com RLS por usuário.
