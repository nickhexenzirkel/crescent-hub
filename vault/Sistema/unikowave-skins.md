---
name: unikowave-skins
description: "Uniko Wave — skins: visual alternativo pra personagem já existente, compradas com GW direto (sem gacha)"
metadata:
  type: project
---

Implementado em 2026-10-18, expandido no mesmo dia (cobertura completa de poses + tab geral). **Skin ≠ personagem nova** (isso já existe, ver [[unikowave-architecture]] / Oficina > Personagens). Skin é só uma troca de visual pra um personagem que a pessoa **já tem desbloqueado** — não entra no gacha, não tem stats/habilidade próprios.

**Admin:** Dashboard RH → Oficina Uniko Wave → aba **Skins** (`OficinaWaveSkinsTab.jsx`, 3ª opção de `owSub` junto de Personagens/Mapas). Escolhe o personagem (lista fixa `PERSONAGENS_BASE` com os 12 ids do jogo + as personagens criadas na própria Oficina), dá título/descrição/preço em GW e sobe as **MESMAS poses de uma personagem da Oficina** (`SKIN_SLOTS` = `OW_SLOTS`): splash, passo1-5, atacar, pular, segurar. Virou obrigatório porque 1 imagem só não é suficiente — ela precisa cobrir todos os estados de ânimo do ritmo E os frames da Guerra Estelar, senão a skin "quebra" visualmente em vários momentos do jogo.

**Dados:** tabela `uniko_wave_skins` (`supabase_uniko_wave_skins.sql`, migration idempotente com `alter table add column if not exists` — quem já rodou a 1ª versão precisa rodar de novo). Colunas: `id` (slug), `char_id`, `titulo`, `descricao`, `splash_url`, `run_urls` (jsonb, passo1-5), `atk_url`, `jump_url`, `hold_url`, `gw_price`. `imagem_url` é campo legado da 1ª versão (só 1 imagem) — mantido como fallback de `splash_url` pras skins antigas não quebrarem.

**Compra:** direta com GW (não é Audição/gacha) — `buySkin(id)` em `index.html` debita da mesma carteira (`dw_wallet`) e já equipa. Possuídas ficam em `dw_skins_owned` (array de ids), equipada por personagem em `dw_skin_selected` (`{charId: skinId}`) — ambas sincronizadas na conta como o resto do save (ver [[unikowave-cloud-save]]).

**Como o visual troca em tudo — DOIS helpers, um por modo:**
- `getEffectiveChar(id)` (modo RITMO): pega `CHARACTERS[id]` e, se tiver skin equipada+possuída, monta `imgs` a partir de splash/atacar/pular/segurar (mesmo mapeamento de `injectCustomChars`: splash cobre wave/dormindo/tranquilo; atacar/pular/segurar cobrem animado/surpreso/raiva). Usado por `applyCharacter()`, `setDodoco()`, tela de resultado, `renderCharThumbs`, `renderCharSpotlight`.
- `getEffectiveWgFrames(key)` (Guerra Estelar): mesma ideia sobre `WG_CHAR_FRAMES[key]` — `run_urls` vira a corrida, atacar/pular/segurar cobrem atk/jump/hold*. `key` é a chave de `WG_CHAR_FRAMES` (ex. `mizuki`/`icydoll`), mapeada pro `char_id` real via o mesmo dicionário histórico (`mizuki:'linnea', icydoll:'icy'`). Usado em `wgApplyChar()` — ÚNICO ponto de entrada dos sprites da Guerra Estelar, então um patch só já cobre tudo.
- **Nunca ler `CHARACTERS[id]` ou `WG_CHAR_FRAMES[key]` direto** num lugar novo que renderize personagem — sempre pelos helpers, senão ignora a skin equipada.
- **Cuidado de ordem no arquivo:** o bloco inteiro de infraestrutura de skins (`CUSTOM_WAVE_SKINS`, `loadSkinsOwned/Selected`, `equippedSkinFor`, `getEffectiveWgFrames` etc.) fica ANTES de `function wgApplyChar` no `index.html`, de propósito — `wgApplyChar(wgChar)` já é chamado na carga inicial do script (antes de `CHARACTERS` até existir), então se esse bloco ficasse depois (como as outras infra de Oficina/cloud-save ficam), estourava "Cannot access before initialization" e quebrava o jogo pra todo mundo no boot. Se for tocar nessa área, mantenha a ordem.

**Hidratação:** mesmo padrão dos personagens/cenários da Oficina — `TabUnikoWave.jsx` busca `uniko_wave_skins` e grava em `localStorage['dw_custom_skins']` ANTES do iframe montar; o jogo lê isso em `CUSTOM_WAVE_SKINS`/`SKINS_BY_CHAR`.

**UI no jogo — dois lugares:**
- Fileira de miniaturas (`#cspotSkins`, `renderCharSkins`) dentro do painel PERSONAGENS — só as skins do personagem em foco, só aparece se ele tiver skin e estiver desbloqueado.
- **Painel SKINS** (`#panelSkinsAll`, `renderSkinsAllPanel`) — vitrine geral com TODAS as skins de TODOS os personagens num grid só, acessível pelo menu lateral (botão "SKINS") e pelo "Mais" no mobile. Pensado pra quem quer navegar/comprar sem entrar em Personagens primeiro.
