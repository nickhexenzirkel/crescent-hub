---
name: uniko-safer-etiquetas-auditoria
description: "Uniko Safer — decisões de produto: etiquetas personalizadas compartilhadas, e registro de auditoria só pro admin"
metadata: 
  type: project
---

Implementado 22/set/2026, depois da importação automática (ver [[uniko-safer-whatsapp-automacao]]) já estar funcionando.

**Etiquetas personalizadas** (nome + cor, paleta fixa): decisão do usuário — **compartilhadas entre os setores** (Faturamento/Financeiro/futuramente outros), não uma lista por setor, e **um contato pode ter várias etiquetas** ao mesmo tempo. Schema: tabela `uniko_safer_tags` + coluna `tag_ids` (array) em `uniko_safer_contacts` — SQL em `supabase_uniko_safer_tags.sql`. Dá pra marcar etiqueta de duas formas: modal de editar contato, ou clique direito num contato na barra lateral (menu rápido).

**Registro de auditoria**: expande o log de acesso que já existia (`uniko_safer_access_log`, só "visualizou") pra cobrir editar/excluir/sincronizar também. **Só o ADMINISTRADOR vê essa tela** (não moderador) — decisão explícita do usuário, diferente do resto do módulo que é admin+moderador. RLS reforça isso no banco (`current_role_uniko() = 'admin'` só no SELECT; moderador continua podendo INSERT, ou seja continua gerando log das próprias ações). SQL em `supabase_uniko_safer_auditoria.sql`.

**Pendência mencionada pelo usuário, ainda não implementada:** planeja adicionar um 3º setor, "Suporte Técnico" (junto com Faturamento/Financeiro), cada um com **seu próprio número de WhatsApp real**. Já expliquei a arquitetura necessária (múltiplas sessões Playwright na VPS, uma por setor, cada uma com seu próprio QR Code) mas o usuário pediu pra fazer isso depois — não mexer nisso até ele pedir explicitamente. Importante: a sessão do WhatsApp fica salva NO SERVIDOR (VPS), não no navegador de quem escaneia — qualquer pessoa, de qualquer computador, consegue disparar a importação depois que alguém escaneou o QR daquele setor uma vez com o celular certo.
