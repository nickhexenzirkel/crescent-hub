---
name: prestacao-contas
description: Módulo Prestações de Contas (comercial lança gastos com comprovante) + aba no Dashboard RH; PRECISA rodar supabase_prestacao_contas.sql
metadata:
  type: project
---

Módulo `prestacao-contas` (antes "Em breve") virou funcional em 05/out/2026: o comercial lança gasto (valor, data, categoria, motivo, descrição, 1-6 anexos obrigatórios — foto/PDF), vê KPIs, rosca por categoria, barras de 6 meses e histórico filtrável. Dashboard RH → aba "Prestações de Contas" mostra todos os funcionários de cargos cujo NOME contém "comercial" (loadCargos/loadCargoMembros), com ranking por comercial e filtro por pessoa.

**Why:** pedido do usuário; ver [[cargo-restricao-por-aba]] (cargo Comercial recorta o Portal e libera este módulo).

**How to apply:** código em src/modules/prestacao-contas (api.js, Painel.jsx compartilhado, index.jsx) e dashboard-rh/PrestacoesContasTab.jsx. Tabela `prestacoes_contas` (RLS por current_cpf()/is_admin_ou_moderador()) + bucket PRIVADO `prestacao-anexos` (URL assinada 10min): rodar `supabase_prestacao_contas.sql`. Acesso ao módulo continua via cargo (`cargoModules.has('prestacao-contas')`) ou admin — o cargo Comercial precisa ter esse módulo marcado.
