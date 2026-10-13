---
name: uniko-safer-sync-periodica
description: Uniko Safer — sincronização automática periódica (incremental) e barra lateral ordenada por mensagem recente
metadata: 
  type: project
---

Implementado 22/set/2026, depois da importação automática via WhatsApp Web ([[uniko-safer-whatsapp-automacao]]) já estar em produção.

**Sincronização automática periódica**: toggle na tela de "Importação automática" que, quando ativado, roda um ciclo a cada N minutos (configurável) SÓ enquanto a aba do Uniko Safer estiver aberta em algum navegador — não é um processo autônomo no servidor. Cada ciclo chama `/api/safer/whatsapp/import/start` com `onlyChanged: true`, que no backend (`whatsappSafer.js`, `lastActivitySnapshot` Map em memória) só reexporta contatos cuja linha na barra lateral do WhatsApp Web mudou desde a última checagem.

**Bug corrigido no mesmo dia**: ativar o toggle pela primeira vez forçava reexportar TODOS os contatos de uma vez (porque o snapshot come vazio no servidor e o código tratava isso como "primeira sincronização"). Corrigido com uma rota nova `/api/safer/whatsapp/sync/baseline` — só marca o estado atual como "já visto" sem exportar nada; o frontend chama ela ao ligar o toggle, e a primeira checagem real só acontece no próximo intervalo. Esse mesmo bug também explicava um erro 500 pontual visto no console numa busca global (`uniko_safer_messages` ilike) — provável sobrecarga momentânea do Supabase por causa da reexportação em massa acidental, não um problema de permissão/RLS.

**Barra lateral ordenada por mensagem recente**: nova coluna `last_message_at` em `uniko_safer_contacts` (SQL: `supabase_uniko_safer_ultima_mensagem.sql`, PRECISA RODAR), atualizada a cada importação (manual, em massa, automática ou pela sincronização periódica) com a data da mensagem mais nova do arquivo importado — nunca "agora", e nunca anda pra trás (reimportar um export mais antigo não rebaixa um contato mais ativo). O botão de ordenar na barra lateral virou um ciclo de 3 modos: **Recentes** (padrão — mensagem mais nova primeiro, estilo WhatsApp) → A—Z → Z—A. Como a sincronização periódica já chama `loadContacts()` ao terminar, a lista se reordena sozinha quando chega mensagem nova, sem precisar recarregar a página.
