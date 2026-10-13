---
name: roleta-da-sorte
description: "Nova aba \"Roleta da Sorte\" no Portal do Colaborador — roleta de prêmios ao vivo, sincronizada em tempo real entre todos os PCs"
metadata: 
  type: project
---

Aba "Roleta da Sorte" (id `roleta`) logo abaixo de "Coleção" na sidebar do Portal do Colaborador — só o admin configura a lista de participantes (números e/ou nomes, tudo é só texto livre) e aperta "Girar"; todo mundo que estiver com a aba aberta em QUALQUER computador vê a MESMA roleta girando ao mesmo tempo, sem interação nenhuma além de assistir.

Arquivos: `src/shared/roletaSorte.js` (config/spin em `settings.roleta_sorte_config`, realtime via Supabase) + `src/modules/central-colaborador/tabs/TabRoletaSorte.jsx` (wheel em CSS conic-gradient, luzes perseguindo o aro, confete, ponteiro fixo).

**Sincronização real-time**: não viaja nenhum frame pela rede — reaproveita `nowMs()`/`ensureServerClock()` de [[unikowave-note-generation]]'s vizinho `captureUniko.js` (relógio sincronizado com o servidor). O giro grava um instante ABSOLUTO (`spin.startedAt`) + duração fixa (7.2s) + ângulo final calculado na hora do clique (vencedor sorteado ali, ângulo pra ele ficar sob o ponteiro fixo no topo); cada cliente calcula sozinho, a cada `requestAnimationFrame`, o ângulo daquele instante usando uma easing própria (`wheelEase` + `wobbleDeg`) — quem entra no meio do giro cai na posição certa sozinho, quem entra depois já vê parado no resultado.

**Por quê**: settings já estava na publication `supabase_realtime` (herdado do Capture o Uniko/Número) — não precisou de SQL novo.

**Gate de admin**: só na UI (`getAuthUser()?.role==='admin'`), mesmo padrão client-side já usado em outras abas do Portal (TabColegas, TabUnikoStop, TabQuizMM) — não é uma trava de servidor.

**Roleta maior + fundo cósmico (15/set)**: disco 400→560px desktop (300px mobile); palco ganhou fundo escuro com estrelas piscando (`Starfield`) + estrelas cadentes; "Aguardando o RH montar a roleta..." saiu de dentro do disco (ficava espremido) e virou título abaixo da roleta. 🎡 trocado por SVG próprio (`WheelIcon`, exportado do arquivo da aba) — pedido explícito de não usar emoji aqui.

**Botão "Avisar todo mundo" (16/set)**: admin manda um toast EFÊMERO (Supabase Realtime *Broadcast*, não `postgres_changes` — não grava nada no banco, não precisa de SQL/tabela) pra quem estiver com o Portal aberto, com botão que leva direto pra aba (`notifyRoletaPing`/`subscribeRoletaPing` em `roletaSorte.js`). O toast é renderizado GLOBALMENTE em `central-colaborador/index.jsx` (não dentro da própria aba), porque precisa aparecer não importa em qual aba a pessoa esteja — ignora se ela já está na roleta. **Pedido explícito: SEM notificação de desktop aqui** — só o toast dentro do app.

**Histórico de Ganhadores com foto (18/set)**: painel novo AO LADO da roleta (empilha embaixo no mobile) mostrando quem já ganhou — foto grande do último ganhador em destaque + lista completa abaixo, ambos clicáveis pra abrir a foto em lightbox de tela cheia. Cada giro do admin já entra automaticamente no histórico (`history` — array dentro do MESMO `roleta_sorte_config` em `settings`, mais recente primeiro, capado em 60); a foto em si é opcional e só o admin consegue anexar/trocar (botão "Adicionar foto"/"Trocar foto"), mas fica visível pra TODO MUNDO (bucket público `roleta-sorte` no Storage, mesmo padrão do Uniko Camera). **PRECISA rodar `supabase_roleta_sorte_fotos.sql`** (só cria o bucket + policies — o histórico em si não precisou de tabela nova, reaproveitou o JSON existente).
