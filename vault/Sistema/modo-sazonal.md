---
name: modo-sazonal
description: Modo Sazonal (Dashboard RH → Painéis) — temas temporários + efeitos flutuantes: Halloween, Natal, Páscoa, Carnaval e São João
metadata:
  type: project
---

Um seletor no **Dashboard RH → Painéis → Modo Sazonal** (`nenhum | halloween | natal | pascoa | carnaval | saojoao`), salvo na tabela `settings` (chave `modo_sazonal`), vale pra todo mundo. Ligado, faz duas coisas:
- o **tema** correspondente aparece no seletor de tema (coluna SAZONAL do `SettingsModal`) e vira o padrão uma vez por período, por navegador (`uniko_sazonal_tema_aplicado`);
- **efeitos flutuantes** na tela (`shared/EfeitoSazonal.jsx`), só no menu de módulos, Central Alexa, aba Início do Portal e Prisma Store (`TELAS_PERMITIDAS`).

Arquivos: `shared/modoSazonal.js` (valores válidos, `MODOS_SAZONAIS`), `contexts/theme.js` (paletas, ficam o ano todo), `shared/EfeitoSazonal.jsx` (Halloween e Natal, com imagens do dono em `public/`), **`shared/EfeitosSazonaisFesta.jsx`** (Páscoa, Carnaval e São João — tudo em SVG/CSS, sem imagem nova).

**Páscoa/Carnaval/São João (out/2026):** Páscoa = ameixa escura + rosa; ovos decorados, cenouras, coelhinho pulando pelo rodapé, borboletas e pétalas caindo. Carnaval = roxo + amarelo-confete; serpentinas penduradas, confete, máscaras, fogos. São João = marrom de fogueira + amarelo-milho; fogueira com faíscas, 2 varais de bandeirinhas, balões subindo, milho, fogos. Mesmas regras de sempre: só `transform`/`opacity` nos keyframes (nada de `filter:blur()` animado), `pointer-events:none`, cenário de fundo em zIndex 0 e só o que sobrevoa em zIndex 5. Pra um próximo tema: paleta em `THEMES`, id em `MODOS_SAZONAIS`, componente de efeito, ramo em `EfeitoSazonal`, botão em `PaineisTab`, emoji em `EMOJI_SAZONAL` (`SettingsModal`).
