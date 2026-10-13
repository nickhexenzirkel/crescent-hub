---
name: armazenamento-supabase
description: Aba Dashboard RH → Armazenamento Supabase (só admin) mostra uso de banco/Storage dos dois projetos, por módulo
metadata:
  type: project
---

`src/modules/dashboard-rh/ArmazenamentoTab.jsx`; servidor `crescent-hub-server/storageReport.js` (`/api/storage/report`). Função SQL `uniko_storage_report()` (`supabase_storage_report.sql`) nos DOIS projetos; no principal também `supabase_storage_report_principal.sql` (grant pra anon, porque o servidor usa a chave anon lá). Plano Free/Pro escolhido na tela (guardado no navegador; o dono paga Pro). Atalhos para [[arquivo-anual]].
