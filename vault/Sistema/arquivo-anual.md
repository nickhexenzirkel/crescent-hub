---
name: arquivo-anual
description: Uniko WhatsApp e Uniko Call — Arquivo anual (.ukarq) criptografado: baixar o ano, excluir do Supabase e importar de volta
metadata:
  type: project
---

Botão **Arquivo anual** (Uniko WhatsApp: Mais opções; Uniko Call: botão no cabeçalho) e também na aba [[armazenamento-supabase]]. Componente: `src/shared/ArquivoAnual.jsx`. Servidor: `crescent-hub-server/unikoArchive.js` (rotas `/api/archive/*`).

- Arquivo `.ukarq` em quadros AES-256-GCM (chave `UNIKO_SECURITY_BACKUP_KEY`, a mesma dos backups `.ukbak`), com mídia/áudio embutidos; só o servidor lê.
- Excluir um ano só libera depois de BAIXAR o arquivo daquele ano (vale 12h, fica na memória do servidor; reiniciar o PM2 zera) e só apaga até o maior id exportado.
- Importar não duplica (mensagens por `wa_message_id`; ligações por `protocolo`).
- Ano = fuso de Brasília.
- SQL: `supabase_uniko_archive.sql` (projeto dedicado). Testado com banco falso e depois em produção pelo dono (funcionou).
**Why:** não estourar o limite do Supabase. **How to apply:** para liberar espaço: baixar → guardar o arquivo em 2 lugares → excluir.
