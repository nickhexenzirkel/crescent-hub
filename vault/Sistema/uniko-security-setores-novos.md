---
name: uniko-security-setores-novos
description: "Uniko Security (hoje \"Uniko WhatsApp\", Cloud API via Dualhook) — setores Contratual e Suporte Técnico conectados em 02/out/2026; pendência: nomes dos contatos do Suporte Técnico (agenda não chegou)"
metadata:
  type: project
---

**Não confundir com o Uniko Safer** ([[uniko-safer-7beneficios]]): o Uniko Security (`src/modules/uniko-security/`, servidor `crescent-hub-server/whatsappCloudApi.js`) usa a **WhatsApp Cloud API oficial via Dualhook** (Coexistence), sem robô de navegador e sem QR Code. O usuário chamou de "uniko security (whatsapp)"; o nome exibido hoje é "Uniko WhatsApp". Na 1ª tentativa implementei multi-sessão no Safer por engano — foi revertida (commits de revert em ambos os repos).

**Estado em 02/out/2026 (sexta):**
- 4 setores no `UNIKO_SECURITY_SECTORS` do `.env` da VPS (JSON numa linha só, via `node -e` por categoria — `sed` com placeholder deu problema): faturamento (chave padrão `UNIKO_SECURITY_DUALHOOK_API_KEY`), financeiro, contratual (WABA 236586426206074 / phone 236466172880881) e suporte_tecnico (WABA 978014345105429 / phone 1212596548592782). Cada setor = um `phone_number_id`; o servidor decide a aba por ele.
- Aba "Suporte Operacional" do front virou **Suporte Técnico** (`id: suporte_tecnico`) — commit `7acea1a` no crescent-hub.
- Webhook no Dualhook: `https://api.centraluniko.com.br/api/security/webhook`, verify token = `UNIKO_SECURITY_WEBHOOK_VERIFY_TOKEN` do `.env`.
- Mensagens dos dois setores novos já chegam nas abas.

**PENDÊNCIA (usuário volta segunda, 05/out/2026, pra ver):** vários contatos mostram só o número. Nome vem de (1) nome de perfil que a própria pessoa tem no WhatsApp, (2) agenda do celular via evento `smb_app_state_sync`, que o WhatsApp manda **uma vez só, na conexão**, e fica em `uniko_security_known_names`. Contratual/Faturamento/Financeiro têm agenda; o **Suporte Técnico não** — consulta filtrada pelo phone_number_id dele em `uniko_security_webhook_raw` não devolveu nenhuma linha de `smb_app_state_sync`. Em 02/out o usuário **reconectou o número do Suporte Técnico em Coexistence e aceitou compartilhar histórico + contatos**; falta confirmar se a agenda chegou (consulta de `webhook_raw` com `like '%1212596548592782%'` e `like '%smb_app_state_sync%'`, e `select category,count(*) from uniko_security_known_names group by category`). Se não chegou: checar se o Phone Number ID mudou na reconexão (atualizar `.env`) e/ou oferecer renomear em lote (lista número→nome) ou pelo editar contato (`name_manual`).

**Segurança:** o usuário colou o `.env` inteiro e as chaves `dh_live_` no chat; recomendei trocar a service key do Supabase do Safer, `JWT_SECRET`, Groq e as chaves do Dualhook, e apagar `.env.bak*` na VPS. Não confirmado se foi feito.
