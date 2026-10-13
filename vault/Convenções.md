---
title: Convenções
---
# Convenções do código

## Repositórios
- **crescent-hub** (front, React + Vite): `C:\Users\finan\Videos\crescent-hub`. Publica na **Vercel**; o cliente usa `www.centraluniko.com.br` (ver [[operacao-manutencao]]).
- **crescent-hub-server** (Node/Express): `C:\Users\finan\Videos\crescent-hub-server`. Roda na **VPS Hostinger** via PM2; deploy = `git pull` + `pm2 restart` (ver [[hostinger-vps-deploy]]).

## Front
- Módulos em `src/modules/<nome>/`; peças compartilhadas em `src/shared/`.
- Tema: `import { T } from '../../contexts/theme'` — usar `T.text`, `T.gold`, `T.surface`, `T.border`... nunca cores fixas para fundo/texto.
- Estilo: objetos `style={{...}}` inline (não há Tailwind). Fonte: `var(--font-body)`.
- Mobile: `useIsMobile()` de `src/hooks/useIsMobile`.
- Menu de módulos (desktop): `src/shared/MenuLayoutNovo.jsx` (módulos + widgets na coluna direita). Aba Início do Portal: `src/modules/central-colaborador/tabs/TabInicio.jsx`.
- Dashboard RH: `src/modules/dashboard-rh/index.jsx` (lista `TABS` no começo do render; cada aba é um componente).
- Textos para o usuário em pt-BR.

## Banco (Supabase)
- Projeto **principal** (Portal) e projeto **dedicado** (Safer / WhatsApp / Call) — ver [[uniko-safer-7beneficios]].
- Todo SQL novo vai num arquivo `supabase_<assunto>.sql` na raiz, **idempotente** (`if not exists`, `drop policy if exists`...). Avisar o dono qual projeto roda.
- O servidor usa a chave **anon** no projeto principal e **service_role** no projeto dedicado.

## Commits
- Mensagem em português, descrevendo o efeito pro usuário. Co-Authored-By no final.

## Armadilhas já vistas
- `Edit` falha quando o arquivo está com CRLF e o texto tem várias linhas — usar trecho de uma linha só.
- Python não está instalado na máquina; usar Node para scripts.
- Dados de teste: usar sempre IDs não cacheados (ver [[unikowave-pot-provider]]).
