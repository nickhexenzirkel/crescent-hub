---
name: cargo-restricao-por-aba
description: Cargo pode restringir ABAS dentro de um módulo real (não só módulos inteiros) — caso do cargo Comercial
metadata:
  type: project
---

Cargo "Comercial" (Dashboard RH → Gerenciar Permissões) não é mais um módulo próprio. Foi revertido (24/set/2026) depois que o usuário rejeitou o módulo standalone construído inicialmente ("Não gostei desse jeito..."). Agora ele recorta ABAS dentro dos módulos de verdade:
- Portal do Colaborador (`colaborador`): só Seus Dados, Financeiro, Meus Lembretes, Eventos, Feedback.
- Oficina Estelar (`faturamento`): só Editor de PDF, Organizar PDF, Mesclar PDF.
- Informações Adicionais e Portal dos Credenciados: módulo inteiro, sem recorte.
- Novo módulo placeholder "Prestações de Contas (em breve)" (id `prestacao-contas`) substitui o antigo módulo Comercial no `ModuleSelector`/`modulesCatalog`.

**Why:** o usuário quer que cargos "comuns" (como vendedor comercial) enxerguem o Portal do Colaborador DE VERDADE, só que cortado — não uma cópia/replica dele num módulo separado.

**How to apply:**
- Infra: coluna `tab_restrictions` (jsonb) em `uniko_cargos` — `supabase_uniko_cargos_tab_restrict.sql`. Formato `{ moduleId: [tabIds] }`; ausente/vazio = módulo inteiro liberado.
- `cargoPermissions.js`: `loadCargoModulesForEmployeeId` agora também retorna `tabRestrictions` (união entre todos os cargos do funcionário); `updateCargoTabRestrictions(cargoId, obj)` grava.
- `central-colaborador/index.jsx` e `faturamento/index.jsx`: prop `restrictedTabs`; `homeTab` vira a 1ª aba liberada (porque "Início" nunca entra na lista — não dá pra marcar ela); toda navegação (Sidebar `only=`, menu mobile, atalhos, TopBar `onBack`) é travada nessa lista.
- `GerenciarPermissoesTab.jsx`: UI de checkboxes por módulo aparece só depois de marcar o módulo, usando `MODULE_TABS_CATALOG` (`shared/modulesCatalog.js`) — mantido manualmente em sincronia com o `NAV`/`NAV_FOR` de cada Sidebar de módulo.
- Só afeta quem NÃO é admin/moderador (cargo é sempre aditivo).
- Pendência: o admin precisa reconfigurar o cargo "Comercial" no Dashboard RH depois do deploy — trocar módulo `comercial` (removido) por `colaborador`+abas, `faturamento`+abas, `info-adicional`, `7-beneficios`, `prestacao-contas`.

Relacionado: [[module-selector-orbita]]
