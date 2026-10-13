---
name: supabase-jwt-secret-principal
description: Projeto Supabase PRINCIPAL (iqsufx…) tinha o ch_jwt_secret como placeholder até 05/out/2026 — tudo com RLS por login voltava vazio; como diagnosticar
metadata:
  type: project
---

Em 05/out/2026 descobrimos que `private.app_secrets.ch_jwt_secret` do projeto principal (iqsufx…) ainda era o placeholder `<COLE_AQUI_O_JWT_SECRET_DO_BACKEND>` (length 35), então `jwt_claims()` devolvia null e qualquer tabela com RLS `esta_logado()`/`current_name()` respondia vazia (sintoma: fotos de perfil sumidas no ranking do Uniko FIT, 401 no POST de profile_photos). O usuário colou o JWT_SECRET da VPS via UPDATE no SQL Editor e resolveu.

**Why:** o helper `supabase_seguranca_auth_helper.sql` precisa do segredo real; sem ele nega tudo (fail-closed). O projeto do Safer (npfggg…) é outro banco, com segredo próprio.

**How to apply:** se "dados sumiram / 401" depois de RLS, rode no console `rpc/jwt_claims` com o header `x-ch-auth` (null = segredo errado) e `select length(value) from private.app_secrets`. Nunca commitar o segredo. Relacionado: [[uniko-fit]].
