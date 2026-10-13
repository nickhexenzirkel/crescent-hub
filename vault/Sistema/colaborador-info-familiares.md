---
name: colaborador-info-familiares
description: Informações pessoais estendidas (familiares + saúde) e a aba Informações Pessoais do RH
metadata: 
  type: project
---

**Contato de Familiares + Saúde** (ago/2026): novos dados pessoais estendidos guardados no Supabase, tabela **`colaborador_info`** (PK `cpf` 11 dígitos): familiar1/2 (nome, cel, parentesco), `doencas`, `alergias`, `updated_by`. **Rodar `supabase_colaborador_info.sql`.** Não passa pelo backend de perfil (que é o repo externo da VPS `api.centraluniko.com.br`) — grava direto via chave anônima, RLS permissivo.

- **Colaborador** preenche na aba **"Seus Dados"** (`central-colaborador/tabs/TabDados.jsx`): 2 cards novos (Contato de Familiares, Saúde), no mesmo toggle Editar/Salvar; upsert por `cpf` de `getAuthUser().cpf`.
- **RH** vê/edita na nova aba **"Informações Pessoais"** (`tab==='infopessoal'` no `dashboard-rh/index.jsx`), liberada pra **Admin e Moderador** (está em `MODERADOR_TABS`). Master-detail: lista buscável (de `/api/employees`) + painel com todas as seções. Perfil **core** (nome, cpf, rg, nascimento, email, telefone, endereço, cargo...) salva no backend via `PUT /api/employees/:id/profile` (mesmo endpoint da aba "Gerenciar Usuários"); familiares/saúde vão pro Supabase. Badge 👪 na lista = tem extra preenchido. Helpers `loadIpExtras`/`openIp`/`saveIp`.

Relacionado: [[ponto-eletronico-persistencia]].
