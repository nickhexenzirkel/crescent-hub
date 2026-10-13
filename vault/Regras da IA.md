---
title: Regras da IA
---
# Regras da IA

Quem lê isto: o Claude Code (ou qualquer IA) antes de alterar o Uniko.

## Pode mexer sem pedir confirmação extra
- Interface: tamanhos, espaçamentos, cores (sempre via tema `T`), textos, rótulos, ícones, ordem de elementos.
- Responsividade (mobile/desktop) e polimento visual.
- Correções pequenas e localizadas de bug visual.

## Pode mexer, mas mostrando o que mudou
- Lógica de módulos (jogos, Central Alexa, Uniko Wave, etc.).
- Novas abas e novos widgets.
- Novos arquivos SQL (`supabase_*.sql`) — sempre idempotentes.

## NÃO mexer sem o dono pedir explicitamente
- Login, tokens, permissões, cargos, RLS e qualquer coisa de segurança.
- Ponto Eletrônico, banco de horas, contracheques, dados pessoais e de RH.
- Chaves, `.env`, segredos. Nunca copiar segredo para o código, para notas ou para commits.
- Apagar dados, tabelas ou arquivos do Supabase.
- Deploy e comandos na VPS (quem roda é o dono).

## Sempre
- Responder e escrever textos da interface em **português do Brasil**.
- Rodar `npx vite build` antes de dar o trabalho como pronto.
- Dizer o que NÃO foi testado (ex.: tela não aberta no navegador).
- Se a mudança exige rodar SQL ou deploy na VPS, avisar claramente.
- Commit e push direto são permitidos (ver [[commit-push-sem-confirmar]]).
