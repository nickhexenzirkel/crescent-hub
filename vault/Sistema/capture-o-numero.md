---
name: capture-o-numero
description: "Capture o Número — 2º evento de captura (sorteio de números 1-100), paralelo ao Capture o Uniko; Coleção do Portal virou 2 sub-abas"
metadata: 
  type: project
---

**Capture o Número** — novo evento de captura, irmão do [[capture-o-uniko]], criado em set/2026. Mesma mecânica (arremesso do assistente flutuante, até 5 vagas, relógio sincronizado, RPC atômica anti-race), mas pra **números da sorte (1 a 100)** em vez de personagens.

**Decisões explícitas do usuário (não inferidas):**
- É um sistema de loteria/sorteio: o admin escolhe pelo Dashboard RH quais números ficam elegíveis num evento; o número spawna no mesmo lugar do Capture o Uniko (aba Início do Portal); quem capturar ganha um dos números elegíveis (aleatório, respeitando o mecanismo já existente de "1 por vaga" quando há múltiplas vagas).
- Range fixo: 1 a 100.
- **O prêmio/sorteio de verdade (o que ganhar um número dá, como se decide o vencedor final) foi EXPLICITAMENTE DEIXADO PRA DEPOIS** — "Ainda não decidi — só quero a captura/coleção por enquanto". V1 não tem recompensa nenhuma (sem Prismas, sem nada) — só grava a captura.
- A aba "Coleção" (antes só Unikos) virou 2 sub-abas clicáveis: "Coleção de Unikos" (intocada) e "Coleção de Números" (nova).

**Simplificações de escopo do v1 (podem virar pedido futuro se o usuário voltar no assunto):**
1. Sem recompensa/prêmio ao capturar.
2. Sem agenda recorrente (diferente do Uniko, que tem fila de horários — ver v18 do [[capture-o-uniko]]) — admin liga/desliga UM evento de cada vez (toggle + janela + "Spawnar agora").
3. Sem Oficina de Números — catálogo é só 1-100, sem upload de imagem.
4. Números não viram assistente nem foto de perfil (diferente de Uniko, que vira skin).

**Arquivos (paralelos aos do Uniko, deliberadamente SEPARADOS pra rodar em paralelo sem conflito):**
- `supabase_capture_numero.sql` — `capture_numero_captures` (coleção), `capture_numero_event` (lock/vagas do evento), RPC `capture_numero_try`. **Precisa rodar no Supabase.**
- `src/shared/captureNumero.js` — reimporta o que é genérico de `captureUniko.js` (relógio, sorteio de instante, checagem de janela); tudo específico é próprio: `CONFIG_KEY='capture_numero_config'`, `resolveNumeroChoice` (pool de números escolhidos pelo admin, não o roster inteiro 1-100), eventos pub/sub PRÓPRIOS (`capture-numero:state/slot/throw`, não misturam com os do Uniko), target registry próprio, coleção em localStorage `numero_captured_<tag>`.
- `src/shared/CaptureNumeroWidget.jsx` — mesma estrutura de efeitos do `CaptureUnikoWidget.jsx`, mas cartão dourado fixo (sem cenário animado) mostrando o número grande em vez de imagem.
- `src/shared/UnikoAssistant.jsx` — assistente escuta os DOIS sistemas em paralelo (`captureAlert` do Uniko + `numeroAlert` do Número): heartbeat, barreira de card (`captureBarriers()`, generalizado em loop) e detecção de arremesso (`targets` array, generalizado em loop) cobrem os dois ao mesmo tempo.
- `src/modules/central-colaborador/tabs/TabInicio.jsx` — segundo slot `#capture-numero-slot` irmão do `#capture-uniko-slot`, mesmo placeholder "nada aqui" quando ocioso (`capNumeroBusy`).
- `src/App.jsx` — monta `CaptureNumeroWidget` junto do `CaptureUnikoWidget`; config-load + realtime + poll fallback pro `capture_numero_config`, SEM scheduler (v1 não tem agenda).
- `src/modules/central-colaborador/tabs/TabMyDoko.jsx` — virou um wrapper fino: pills "Coleção de Unikos"/"Coleção de Números" no topo, `ColecaoUnikos` (corpo antigo, intocado) e novo `ColecaoNumeros` (grade 1-100, busca, filtro todos/obtidos/faltam, modal de detalhe com data — sem botões de assistente/foto).
- `src/modules/dashboard-rh/index.jsx` — nova aba **"Capture o Número"** (nav id `capture-numero`, não em `MODERADOR_TABS` — só admin): grade 1-100 pra marcar pool elegível, modo (fixo/sortear 1 do pool/sortear 1 por vaga), vagas (1-5), janela início/fim + "Spawnar agora", reset de coleção (por usuário ou todos) — mesmos padrões visuais/UX do Capture o Uniko.

**Verificação:** todo o client-side foi implementado e o `vite build` passa limpo (sem erro de compilação). Eslint mostra só os mesmos padrões de "erro" já presentes em todo o resto do código (catch{} vazio, setState síncrono em effect, refs mutados fora de handler) — são convenção estabelecida no projeto, não bugs novos. **Não testado end-to-end** (sem credenciais de login no ambiente sandbox) — fica por conta do usuário: rodar o SQL, configurar um evento (ex.: spawnar agora com 1-2 números marcados), ir na aba Início do Portal, arrastar o assistente até o card, confirmar que grava na Coleção de Números.

**Bug relatado pelo usuário (16/set/2026) e corrigido:** no modo "cada vaga ganha um número diferente", pessoas capturando quase ao mesmo tempo às vezes ganhavam o MESMO número (mesmo com o pool configurado corretamente). Causa: cada navegador calculava sozinho, no cliente, qual número lhe cabia a partir de `winners.length` local (defasado por realtime/poll) e mandava esse número já pronto pro RPC `capture_numero_try` — a função atribuía vagas atômicas corretas, mas GRAVAVA o número que o cliente já tinha "escolhido" antes, sem conferir contra a vaga real conquistada. Fix: `capture_numero_try` passou a receber a lista INTEIRA de números possíveis (`p_numero_values integer[]`, um por vaga) e agora é ela quem decide o número, indexado pela vaga que o INSERT atômico de fato conquistou. Precisou re-rodar `supabase_capture_numero.sql` (assinatura da função mudou). Ver commit `48ad58e`.

**Mesmo bug também corrigido no Capture o Uniko (16/set/2026, pedido pelo usuário logo em seguida):** `claimCapture` em `captureUniko.js` tinha a MESMA arquitetura (cliente escolhia qual Uniko/recompensa mandar pro RPC a partir de `winners.length` local) — modo "Uniko aleatório por vaga". Mesmo fix: `capture_uniko_try` agora recebe as listas INTEIRAS (Unikos + nomes + recompensas, um item por vaga) e decide tudo indexado pela vaga que o INSERT atômico realmente conquistou. Precisou re-rodar `supabase_capture_uniko_multi.sql`. Ver commit `bfbb48b`.

**Bug 3 — "⚡ Agora" disparava a fila DUAS vezes (16/set/2026, corrigido):** admin soltava um item da fila na mão via "⚡ Agora" e, mais tarde, o AGENDADOR (que roda sozinho em todo navegador aberto) disparava o MESMO item de novo, automaticamente, no horário originalmente configurado — dois sorteios seguidos com o mesmo pool/Uniko. Causa: "⚡ Agora" só criava um config avulso, sem marcar a ocorrência como "consumida" no `capture_*_agenda_state` — o agendador não tinha como saber que aquela ocorrência já tinha rolado. Fix: `spawnEntryNow`/`spawnNumEntryNow` agora chamam `markAgendaDone` (exportada de `captureUniko.js`/`captureNumero.js`) pra a ocorrência que estão antecipando, e removem o item da fila na hora se for "única vez". Ver commit `c14eedd`. **Nota**: no momento da investigação havia 2 entradas "once" órfãs (já expiradas, inofensivas) na fila do Uniko (`capture_uniko_schedule`) — sobra de teste, pode limpar na UI se quiser.

**Bug 4 — spam de notificação desktop (16/set/2026, corrigido):** uma notificação de desktop disparava a CADA vaga preenchida (não 1 por evento). Causa: a chave anti-duplicata do `notifyDesktop` em `CaptureNumeroWidget.jsx` incluía `numeroValue` (que muda a cada captura de qualquer pessoa, no modo "1 diferente por vaga" — passa a mostrar o número da PRÓXIMA vaga livre), então cada captura de outra pessoa parecia um "spawn novo" e reavisava todo mundo. Fix: a chave agora usa só `cfg.startAt` — 1 notificação por evento. Ver commit `63d8ad9`. (Conferido: `CaptureUnikoWidget.jsx` NÃO tem esse bug — a chave lá já usava `cfg.unikoId`, campo estável do config, não um valor recalculado por vaga.)

Relacionado: [[capture-o-uniko]], [[uniko-assistant]], [[roleta-da-sorte]].
