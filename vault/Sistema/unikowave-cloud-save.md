---
name: unikowave-cloud-save
description: "Uniko Wave — save por CONTA (personagens/carteira/perfil) no Supabase, não mais só localStorage"
metadata: 
  type: project
---

Os personagens/mascotes conquistados (e progresso geral) do Uniko Wave agora ficam atrelados à CONTA do usuário e acompanham qualquer dispositivo (antes era só localStorage). Implementado em 2026-06-23.

**Tabela Supabase:** `public.uniko_wave_saves` (PK `player` = nome do auth, coluna `data` jsonb, `updated_at`). Migration: `supabase_uniko_wave_saves.sql` — **precisa ser rodada no SQL Editor** senão não persiste. RLS permissivo (anon), igual a `uniko_scores`.

**Chaves sincronizadas** (`SAVE_KEYS` em `TabUnikoWave.jsx`): `dw_wallet` (GW/GC), `dw_unlocked` (personagens), `dw_char`, `dw_profile`, `dw_wish_pity`.

**Como funciona** (segue a ponte postMessage de [[unikowave-architecture]]; iframe e React compartilham localStorage por mesma origem):
- **Hidratação:** `TabUnikoWave.jsx` busca o save da conta ANTES de montar o iframe (estado `ready`). Se existe na nuvem → limpa o local e aplica (nuvem é a fonte da verdade). Se não existe → usa `dw_cloud_owner` (marca de quem é o local) para decidir: dono == usuário atual → migra o local p/ nuvem; senão → começa limpo (isola contas no mesmo PC).
- **Gravação:** o jogo (`public/unikowave/index.html`) tem `cloudSave()` (debounce 400ms) que faz `parent.postMessage({type:'UNIKO_SAVE_SET', save})`; chamado em `saveWallet`, `saveUnlocked`, `selectChar`, `savePity`, `saveProfile`, `applyProfileEdit`. `TabUnikoWave` recebe e faz upsert (debounce 500ms).

**Admin (NICOLAS):** o seed automático no `saveProfile` (gw 999999 + todos os personagens) dispara `saveWallet/saveUnlocked` → cai na nuvem normalmente. Na 1ª migração, se o cloud dele estiver vazio e o local for de outra conta, ele começa limpo e re-seeda ao digitar NICOLAS no perfil.
