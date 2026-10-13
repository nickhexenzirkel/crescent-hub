---
name: atualizacoes-mural
description: "Mural de Atualizações emitido pelo RH — moldura em tela cheia pra todos, com som e desktop"
metadata: 
  type: project
---

**Atualizações** (ago/2026): Admin/Moderador emite uma novidade no **Dashboard RH → aba "Atualizações"** (`tab==='atualizacoes'`, está em `MODERADOR_TABS`). Escreve **título** (fonte grande, maiúscula) + **descrição** (menor), em preto, sobre o painel BRANCO da moldura `public/atualizacoes.png`. Ao **Emitir**, insere na tabela **`atualizacoes`** (Supabase) → **rodar `supabase_atualizacoes.sql`** (tabela + RLS permissivo + realtime).

- **Todos os computadores logados** recebem via realtime (INSERT) — assinatura em `src/App.jsx` (com poll de fallback de 25s, mesmo padrão da tabela `notifications`) → mostra **overlay em tela cheia** (`AtualizacaoOverlay`), toca `playReminder()` e dispara `notifyDesktop` (extensão/desktop). Estado `atualAtiva`/`seenAtualIds`.
- Componente compartilhado **`src/shared/atualizacao.jsx`**: `ATUAL_IMG='/atualizacoes.png'`, `AtualizacaoFrame` (posiciona o texto sobre o painel branco via % do PNG 1672×941: insets left/right 20%, top 27.5%, bottom 12%) e `AtualizacaoOverlay`. A MESMA `AtualizacaoFrame` é o editor no dashboard (inputs transparentes por cima).
- Histórico das últimas 20 na própria aba, com botão Remover (delete). O `autor` = nome do RH.

Relacionado: [[notificacoes-desktop]] (som + pop-up desktop), [[colaborador-info-familiares]] (outras abas RH recentes).
