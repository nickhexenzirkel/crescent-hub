---
name: uniko-safer-7beneficios
description: "Módulos Uniko Safer (WhatsApp) e 7 Benefícios (iframe) — arquitetura, pendências e decisão de Supabase separado"
metadata: 
  type: project
---

Dois módulos novos replicados de projetos soltos do usuário pra dentro do Uniko (set/2026):

**Uniko Safer** (`src/modules/uniko-safer/`) — portado do app desktop Electron "uniko safer": cadastro de contatos + importação manual de conversas exportadas do WhatsApp (.txt/.zip), visualizador estilo WhatsApp. A automação (abrir WhatsApp Web e exportar sozinho) ficou de fora de propósito — é praquele projeto virar uma integração futura. Módulo admin/moderador (dados de conversas de terceiros externos, não colaboradores).

**7 Benefícios** (`src/modules/beneficios-7/`) — iframe de tela cheia do site já hospedado em `7beneficios.vercel.app`, com botão discreto de voltar. Sem SQL, sem Supabase.

## Uso pretendido do Uniko Safer (importante pra qualquer mudança futura)
Retenção de ~3-4 anos de mensagens, com **exportação semanal automática de todos os contatos** (ainda não implementada — hoje só há import manual pela tela). Isso é um volume de dado bem diferente do resto do Portal (RH, ponto, jogos): cresce sem parar e é dado sensível de terceiros externos.

**Decisão tomada:** Supabase **separado** do projeto principal do Uniko, pra não disputar cota/desempenho com o resto do sistema nem misturar esse tipo de dado sensível com dados de RH. Plano de compute recomendado: **Micro** (suficiente — é um tool admin-only de baixa concorrência, e o trabalho pesado de parsing roda no navegador, não no Postgres). O usuário só vai decidir/pagar isso com o gestor dele — **pendente, sem prazo definido**.

Até lá, o client Supabase do módulo (`src/modules/uniko-safer/saferSupabase.js`) tem fallback automático pro projeto principal — funciona normal contra o projeto compartilhado. Quando o projeto novo existir: colar URL + anon key nesse arquivo (2 constantes vazias esperando) e rodar `supabase_uniko_safer.sql` nesse projeto novo.

## Design anti-duplicação (já implementado)
Exportação do WhatsApp é sempre cumulativa (histórico inteiro de novo a cada vez). Em vez de guardar um snapshot json completo por exportação (que duplicaria a conversa inteira toda semana por anos), as mensagens vão pra uma tabela própria (`uniko_safer_messages`) deduplicadas por hash (`sha256(timestamp|sender|texto)`, calculado no client em `parseWhatsapp.js`/`hashMessage`), com upsert `ON CONFLICT DO NOTHING` — reimportar só grava o que é de fato novo. `uniko_safer_exports` guarda só metadados de auditoria (arquivo, tamanho, contagens).

**Não resolvido ainda:** os arquivos originais (.zip/.txt) continuam sendo guardados no Storage a cada importação, sem limite/retenção — isso ainda duplica espaço de Storage ao longo dos anos (diferente do problema do banco, que já foi resolvido). Se a exportação automática semanal for pra frente, vale revisitar (ex: manter só a última X exportações por contato, ou não guardar o arquivo bruto depois de parseado).

## Atualização (22/set/2026): Supabase dedicado já existe e está em uso
O projeto dedicado (`npfgggoavzzyzcjjachi`, plano Micro) já foi aprovado e `saferSupabase.js` já aponta pra ele — a seção acima ("fallback pro principal", "pendente aprovação") ficou obsoleta.

**Incidente resolvido:** depois da correção de RLS geral (`supabase_seguranca_rls_uniko_safer.sql`, commit `c5759c6`), toda importação no Safer passou a falhar com "new row violates row-level security policy". Causa raiz, em cadeia:
1. `supabase_seguranca_auth_helper.sql` precisa rodar **em CADA projeto Supabase separadamente** (é o que cria `jwt_claims()`/`is_admin_ou_moderador()`) — rodar só no principal não basta, o Safer é outro banco.
2. Mesmo rodando no projeto certo, o segredo (`private.app_secrets.ch_jwt_secret`) ficou com o **placeholder literal** (`<COLE_AQUI_O_JWT_SECRET_DO_BACKEND>`) — o usuário rodou o script sem substituir o valor. `jwt_claims()` falha fechado (devolve `null`) nesse caso, sem erro visível.
3. O valor "real" do JWT nem estava no `.env` da VPS — o servidor rodava no fallback hardcoded do código (`crescent-hub-server/index.js:148`: `process.env.JWT_SECRET || 'crescent_secret'`).

**Diagnóstico usado (útil pra próxima vez que RLS parecer travado sem motivo aparente):** criar uma função SQL temporária `debug_headers()` (`select current_setting('request.headers', true)`) e outra `debug_verify(token text)` que recalcula o HMAC e devolve `{match, secret_len, is_placeholder}` sem expor o segredo — chamar via `fetch(...rpc/...)` no console do navegador já logado. Isolou o problema em 3 chamadas: header chegando? assinatura bate? placeholder ainda lá? Apagar as duas (`drop function`) depois de usar.

**Fix aplicado:** gerado `JWT_SECRET` forte (64 hex, `openssl rand -hex 32`) e colocado no `.env` da VPS (antes não existia a variável) + sincronizado como `ch_jwt_secret` nos DOIS Supabase (principal e Safer) + `pm2 restart`. Efeito colateral esperado e avisado: deslogou todo mundo (token antigo parou de bater).

## Pendências pro usuário
- Nenhuma pendência de setup restante — Supabase dedicado, RLS e JWT_SECRET forte já em produção (22/set/2026).
