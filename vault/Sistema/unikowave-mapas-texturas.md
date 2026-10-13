---
name: unikowave-mapas-texturas
description: "Dashboard RH → Oficina Uniko Wave ganhou a sub-aba \"Mapas & Texturas\" (cenário de fundo imagem/vídeo + esteira, minions, boss); PRECISA rodar supabase_uniko_wave_cenarios.sql"
metadata: 
  type: project
---

Em 22/07/2026: o admin passou a montar o visual do Uniko Wave pela tela, sem deploy.
Antes esteira/minions/boss eram arquivos fixos em `public/unikowave/images/` com o
caminho escrito no código do jogo.

**PRECISA rodar `supabase_uniko_wave_cenarios.sql`** (cria `uniko_wave_scenes` + o
bucket público `uniko-wave-scenes`, 80MB por causa do fundo em vídeo).

Como funciona:
- Um **cenário** = pacote visual: fundo (imagem OU vídeo) + texturas da Guerra Estelar
  (esteira, minion terrestre + versão rindo, minion voador asa ↑/↓, minion grande, boss,
  boss derrotado). Campo vazio mantém a arte original — dá pra trocar só a esteira.
- `mode`: `classic` (Teclado Estelar) / `wargame` (Guerra Estelar) / `both`. O fundo vale
  nos dois modos; as texturas só na Guerra Estelar.
- **Qual vale**: `active` = PUBLICADO — aparece no seletor **"Mapa"** da tela de preview do
  jogo, e QUEM JOGA escolhe. Podem ser vários publicados ao mesmo tempo. A escolha fica em
  `localStorage` separada por modo (`dw_scene_classic` / `dw_scene_wargame`); quem nunca
  escolheu joga com o primeiro publicado do modo (ordem `sort`, setas ↑↓ no admin, badge
  PADRÃO). O seletor sempre oferece **"Original"** (o visual que vem com o jogo) — por isso
  `WG_TEX_ORIG`/`WG_BELT_ORIG` guardam as texturas de fábrica: sem elas não haveria pra
  onde voltar. Cenário novo nasce DESPUBLICADO.
- Ponte igual à das personagens da Oficina: `TabUnikoWave` busca a tabela e escreve em
  `localStorage['dw_wave_scenes']` ANTES de montar o iframe (mesma origem); o jogo lê no load.
  Quem já está com o jogo aberto só pega na próxima entrada.
- O fundo é uma camada DOM `#sceneBgWrap` (fixed, z-index 0, atrás do `#gameWrap`), igual
  ao `#videoBgWrap` do clipe do YouTube. Com ela ativa o canvas fica transparente — reusa o
  branch `bgMode==='video'` do `drawBackground`. O escurecimento é camada semitransparente,
  NÃO CSS filter (filter em cima de `<video>` mata a composição por hardware).
- O **minion grande** (evento de combo 50) antes era o minion terrestre ampliado 2.6×; agora
  usa arte própria se o admin subir uma (`WG_MINION_BIG`).

Relacionado: [[unikowave-architecture]], [[oficina-de-uniko]], [[missoes-gerenciaveis]].
