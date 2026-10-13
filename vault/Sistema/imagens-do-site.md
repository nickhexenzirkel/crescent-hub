---
name: imagens-do-site
description: Dashboard RH → Imagens do Site (admin): troca o mascote/logo/cards do Uniko por outra imagem, valendo pra todos sem deploy
metadata:
  type: project
---

Tela `src/modules/dashboard-rh/ImagensSiteTab.jsx`; lógica `src/shared/siteImagens.js` + núcleo testável `siteImagensCore.js`. Tabela `uniko_site_imagens` (path → url) e bucket público `site-imagens` no Supabase PRINCIPAL (`supabase_site_imagens.sql`).

**Como funciona:** `iniciarSiteImagens()` (main.jsx, antes do React) instala ganchos em `<img>` (setAttribute/`src`): se o src é um caminho do mapa (ex.: `/UNIKO_NEW.png`), troca pela URL nova ANTES de baixar a original; mapa vem do cache local e é atualizado a cada 3 min / ao voltar pra aba. `?__orig=1` na URL nunca é trocado (usado no painel pra mostrar a original). Imagem enviada é reduzida (máx. 1400px, PNG ou WebP se >3MB; GIF vai como está).

**Limites:** só imagens em `/public` (as importadas de `src/assets` ganham hash no build e não têm caminho estável); não cobre `background-image` em CSS; PWA/ícone do app não mudam. Regra do banco é aberta como as outras tabelas do projeto principal (a tela só aparece pra admin).
