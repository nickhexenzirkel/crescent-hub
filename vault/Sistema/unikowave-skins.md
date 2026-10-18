---
name: unikowave-skins
description: "Uniko Wave — skins: visual alternativo pra personagem já existente, compradas com GW direto (sem gacha)"
metadata:
  type: project
---

Implementado em 2026-10-18. **Skin ≠ personagem nova** (isso já existe, ver [[unikowave-architecture]] / Oficina > Personagens). Skin é só uma troca de visual (imagem) pra um personagem que a pessoa **já tem desbloqueado** — não entra no gacha, não tem stats/habilidade próprios.

**Admin:** Dashboard RH → Oficina Uniko Wave → aba **Skins** (`OficinaWaveSkinsTab.jsx`, 3ª opção de `owSub` junto de Personagens/Mapas). Escolhe o personagem (lista fixa `PERSONAGENS_BASE` com os 12 ids do jogo + as personagens criadas na própria Oficina), sobe uma imagem, dá título/descrição/preço em GW.

**Dados:** tabela `uniko_wave_skins` (`supabase_uniko_wave_skins.sql`) + bucket `uniko-wave-skins`. Colunas: `id` (slug), `char_id`, `titulo`, `descricao`, `imagem_url`, `gw_price`.

**Compra:** direta com GW (não é Audição/gacha) — `buySkin(id)` em `index.html` debita da mesma carteira (`dw_wallet`) e já equipa. Possuídas ficam em `dw_skins_owned` (array de ids), equipada por personagem em `dw_skin_selected` (`{charId: skinId}`) — ambas sincronizadas na conta como o resto do save (ver [[unikowave-cloud-save]]).

**Como o visual troca em tudo:** `getEffectiveChar(id)` em `index.html` é o ÚNICO lugar que decide o visual — pega `CHARACTERS[id]` e, se tiver skin equipada E possuída, sobrescreve `imgs`/`previewImg` com a imagem da skin. Os 3 pontos que mostram o personagem ativo (`applyCharacter()`, `setDodoco()`, tela de resultado) e os que mostram qualquer personagem no seletor (`renderCharThumbs`, `renderCharSpotlight`) leem por aqui — **nunca `CHARACTERS[id]` direto**. Qualquer novo lugar que renderize um personagem precisa seguir essa regra, senão ignora a skin equipada.

**Hidratação:** mesmo padrão dos personagens/cenários da Oficina — `TabUnikoWave.jsx` busca `uniko_wave_skins` e grava em `localStorage['dw_custom_skins']` ANTES do iframe montar; o jogo lê isso em `CUSTOM_WAVE_SKINS`/`SKINS_BY_CHAR` (não cria `CHARACTERS` novo, só indexa por `char_id`).

**UI no jogo:** fileira de miniaturas (`#cspotSkins`, função `renderCharSkins`) entre a habilidade e o status, no painel de seleção de personagem — só aparece se o personagem tiver skin cadastrada e estiver desbloqueado.
