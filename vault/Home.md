---
title: Uniko — Cérebro
---
# Uniko — Cérebro

Manual do sistema Uniko. É lido pela IA (Claude Code) **antes** de mexer em qualquer coisa, e por você no Obsidian.
Abra a pasta `vault/` como um cofre (vault) no Obsidian.

## Comece aqui
- [[Regras da IA]] — o que pode e o que NÃO pode ser mexido
- [[Convenções]] — como o código e a interface são feitos
- [[Como pedir ajustes]] — o fluxo de pedidos sem precisar de API paga

## Módulos e projetos
- [[acoes-administrativas]] — pedidos que escondem/renomeiam módulos e abas ou tiram um Uniko de alguém (sem código)
- [[imagens-do-site]] — troca imagens do Uniko pela tela (Dashboard RH), valendo pra todos sem deploy
- [[agente-ia]] — agente independente que resolve Pedidos de Ajuste (branch + build + pull request)
- [[arquivo-anual]] — Arquivo anual (.ukarq) do WhatsApp e Call: baixar o ano, excluir e importar
- [[armazenamento-supabase]] — aba do Dashboard RH com o uso do Supabase
- [[widget-eventos-hoje]] — card Eventos de hoje abaixo do bom dia
- [[alexa-token-persistencia]] — Como o token da Alexa é gerado, onde vive e por que se auto-renova agora (crescent-hub-server)
- [[atualizacoes-mural]] — Mural de Atualizações emitido pelo RH — moldura em tela cheia pra todos, com som e desktop
- [[baixar-ordens-servico]] — Oficina Estelar (admin) "Baixar Ordens de Serviço" — extensão Uniko Notas por e-mail v1.4.x baixa PDFs da Wowlet no Chrome logado; por que NÃO é servidor
- [[capture-o-numero]] — Capture o Número — 2º evento de captura (sorteio de números 1-100), paralelo ao Capture o Uniko; Coleção do Portal virou 2 sub-abas
- [[capture-o-uniko]] — Capture o Uniko — evento tipo Pokémon GO no Portal: widget temático que surge na janela do RH, arremesso da bolinha, aviso do assistente
- [[cargo-restricao-por-aba]] — Cargo pode restringir ABAS dentro de um módulo real (não só módulos inteiros) — caso do cargo Comercial
- [[central-alexa-biblioteca-local]] — Aba "Biblioteca Local" na Central Alexa — MP3s próprios na fila do Festival, tocados no Echo via SSML (não Spotify); precisa rodar SQL + deploy no crescent-hub-server (VPS)
- [[central-alexa-festival]] — Como o Festival da Central Alexa toca música (Spotify no Echo) e a mini janela de videoclipe do YouTube
- [[central-alexa-maquina-tempo]] — Máquina do Tempo da Central Alexa — visões (geral/mês/DJs/Semaninha) e agregação no servidor
- [[colaborador-info-familiares]] — Informações pessoais estendidas (familiares + saúde) e a aba Informações Pessoais do RH
- [[conexao-setorial-salas]] — Conexão Setorial virou multi-sala com senha; PRECISA rodar supabase_conexao_setorial_salas.sql
- [[conexao-setorial-trello]] — Conexão Setorial virou um quadro Kanban (Trello) do Financeiro no lugar do chat WhatsApp; precisa rodar supabase_conexao_setorial_trello.sql
- [[contagem-ferias]] — Contagem regressiva de férias na aba Início do Portal — só pra um grupo seleto de 14 pessoas, cada uma vendo só a própria data
- [[desligamento-colaborador]] — Desligamento na aba Gerenciar Usuários — tira o colaborador do ponto/portal e opção separada de bloquear o acesso; precisa de SQL + deploy na VPS
- [[fairy-scene]] — Cenário jardim encantado (Uniko Rainha das Fadas) no card + fundo da Central Alexa; e a piscada de 10s só dela
- [[game-invites]] — Convites de jogo (Uniko Paint/Stop) — lista de amigos, notificação e navegação direta
- [[games-ranking-geral]] — Ranking geral da aba Games — soma de pontos normalizados dos 4 jogos arcade no Supabase
- [[hostinger-vps-deploy]] — crescent-hub-server migrou do Render pra uma VPS da Hostinger, rodando via PM2 — acesso, deploy e como ver logs
- [[info-adicional-modulo]] — Módulo "Informações Adicionais" — antigos botões flutuantes Instalar App / Sobre o Uniko, agora em duas abas dentro de um módulo normal
- [[mercado-estelar]] — Prisma Store (ex-Mercado Estelar) — loja de recompensas (prismas), check-in, desafios; Supabase + cache local
- [[missoes-gerenciaveis]] — Missões da Prisma Store viraram dados editáveis pelo admin + tempo jogado agora é medido em Wave/Speed/Stop/Paint; PRECISA rodar supabase_uniko_missoes.sql
- [[modo-sazonal]] — Modo Sazonal (Dashboard RH → Painéis) — temas temporários + efeitos: Halloween, Natal, Páscoa, Carnaval e São João
- [[moderador-permissoes-server]] — Permissões do cargo moderador no Dashboard RH — o gate precisa existir no CLIENTE e no SERVIDOR
- [[module-selector-orbita]] — Tela de seleção de módulos (ModuleSelector.jsx) — mobile em lista, desktop em órbita elíptica ao redor do mascote
- [[notificacoes-desktop]] — Como funcionam as notificações (lembretes/avisos RH) e o pop-up desktop via extensão Cat-bot
- [[oficina-de-uniko]] — Oficina de Uniko — criar Unikos personalizados (fora do código) no Dashboard RH, aba Capture o Uniko
- [[oficina-estelar-modulo]] — Modulo "Oficina Estelar" (id interno faturamento) — assinatura automatica de PDF e historico
- [[oficio-emissao]] — Aba "Ofício de Emissão" na Oficina Estelar — porte da Solicitação de Pagamento do Uniko Detetive (Electron), 2 modelos (Eusébio e Juazeiro do Piauí)
- [[contracheque-gerado-pdf]] — Contracheque "Gerado pelo Uniko": como o PDF é gerado e o bug do recorte lateral (corrigido 18/out/2026)
- [[controle-clientes]] — Aba "Controle de Clientes" na Oficina Estelar: carteira (comercial/cliente/categoria/período/setor/método) em 4 modelos de planilha, impressão horizontal/vertical
- [[lista-tarefas]] — Aba "Lista de Tarefas" em Minhas Tarefas (ex-Meus Lembretes; abas: Lista de Tarefas, Lembretes, Anotações): checklist diário, gráficos dia/mês/ano por pessoa e cronograma de faturamento vindo do Controle de Clientes
- [[operacao-manutencao]] — Estado operacional/manutenção do crescent-hub — o que roda sozinho e o que pede atenção manual (VPS, tokens, Spotify, yt-dlp)
- [[ponto-eletronico-persistencia]] — Como o módulo Ponto Eletrônico persiste banco de horas/justificativas no Supabase e qual SQL rodar
- [[ponto-justificativa-modal]] — Modal grande de justificativa no módulo admin do Ponto (mostra motivo + anexo do colaborador)
- [[prestacao-contas]] — Módulo Prestações de Contas (comercial lança gastos com comprovante) + aba no Dashboard RH; PRECISA rodar supabase_prestacao_contas.sql
- [[roleta-da-sorte]] — Nova aba "Roleta da Sorte" no Portal do Colaborador — roleta de prêmios ao vivo, sincronizada em tempo real entre todos os PCs
- [[sakura-scene]] — Cenário animado de floresta de sakura (Uniko Kitsune) no card e fundo da Central Alexa; detecção por palavra-chave
- [[supabase-jwt-secret-principal]] — Projeto Supabase PRINCIPAL (iqsufx…) tinha o ch_jwt_secret como placeholder até 05/out/2026 — tudo com RLS por login voltava vazio; como diagnosticar
- [[uniko-assistant]] — Assistente robô UNIKO — carinha flutuante global no canto inferior esquerdo (FAQ, lembretes, avisos)
- [[uniko-call-atendente-setor]] — Uniko Call — ligações agora têm atendente e setor (login CPF+senha no popup da extensão) e a tela tem abas Contatos/Atendentes/Setores
- [[uniko-call-transcricao]] — Uniko Call — transcrição migrou pra OpenAI (gpt-4o-transcribe) com fallback Groq; calibração de áudio no popup; decisões de LGPD
- [[uniko-call-transcricao-so-aviso]] — Uniko Call 08/out/2026 — transcrição das ligações do financeiro (Karina/Rian) saía só com o aviso; rota aviso-audio restaurada; fix fe1d605 PRECISA deploy e reteste
- [[uniko-camera]] — Nova aba Uniko Camera no Portal do Colaborador — câmera estilo MacBook/Photo Booth com filtros, papel de parede e galeria privada; PRECISA rodar supabase_uniko_camera.sql
- [[uniko-fit]] — Uniko FIT — estilo GymRats, layout mobile-first com header/footer position:fixed (3 abas centralizadas + barra de 5 ações); LIBERADO pra todo mundo
- [[uniko-paint]] — Uniko Paint — jogo de desenho/adivinhação em tempo real no Portal (admin-only, em dev); precisa rodar supabase_uniko_paint.sql
- [[uniko-palavras]] — Uniko Palavras — jogo de blefe de palavras (Ghost) no Portal, mascote gato-polvo no centro, letras ao redor; PRECISA rodar supabase_uniko_palavras.sql
- [[uniko-safer-7beneficios]] — Módulos Uniko Safer (WhatsApp) e 7 Benefícios (iframe) — arquitetura, pendências e decisão de Supabase separado
- [[uniko-safer-etiquetas-auditoria]] — Uniko Safer — decisões de produto: etiquetas personalizadas compartilhadas, e registro de auditoria só pro admin
- [[uniko-safer-sync-periodica]] — Uniko Safer — sincronização automática periódica (incremental) e barra lateral ordenada por mensagem recente
- [[uniko-safer-whatsapp-automacao]] — Importação automática do Uniko Safer via WhatsApp Web (Playwright na VPS) — arquitetura e pendência de teste real
- [[uniko-security-setores-novos]] — Uniko Security (hoje "Uniko WhatsApp", Cloud API via Dualhook) — setores Contratual e Suporte Técnico conectados em 02/out/2026; pendência: nomes dos contatos do Suporte Técnico (agenda não chegou)
- [[uniko-sereia]] — Uniko Sereia — 3º Uniko capturável, skin do assistente, e generalização do tema (vampire vs sereia) na Central Alexa/Capture o Uniko
- [[uniko-stop]] — Uniko Stop (Stop/Adedanha em tempo real) — bugs de respostas sumindo e letras repetindo, e como foram resolvidos
- [[uniko-suspect]] — Uniko Suspect — novo jogo estilo Among Us, em construção, admin-only por enquanto
- [[unikowave-architecture]] — Como o jogo Uniko Wave funciona — onde fica o código, servidores e o problema do yt-dlp
- [[unikowave-cloud-save]] — Uniko Wave — save por CONTA (personagens/carteira/perfil) no Supabase, não mais só localStorage
- [[unikowave-gacha-audicao]] — Uniko Wave — aba Audição (gacha estilo Genshin) para conquistar personagens com GW
- [[unikowave-guerra-estelar]] — Uniko Wave — modo Guerra Estelar (estilo Muse Dash) com Mizuki
- [[unikowave-lira-estelar]] — Uniko Wave — modo Lira Estelar (lira do Genshin): lobby grande, Maestro e Frenesi (21 notas ou 4 botões, 3 dificuldades), músicas por tablatura (também pelo Dashboard RH; precisa SQL supabase_uniko_wave_lira.sql)
- [[unikowave-mapas-texturas]] — Dashboard RH → Oficina Uniko Wave ganhou a sub-aba "Mapas & Texturas" (cenário de fundo imagem/vídeo + esteira, minions, boss); PRECISA rodar supabase_uniko_wave_cenarios.sql
- [[unikowave-mobile]] — Uniko Wave no celular — detecção mobile, jogo mais fácil e toque/layout responsivo
- [[unikowave-note-generation]] — Como o mapa de notas do Uniko Wave é gerado (RNG semeado, densidade, padrões)
- [[unikowave-pot-provider]] — POT provider do yt-dlp agora roda LOCAL na VPS (PM2 bgutil-pot:4416); o do Render dormia e nunca funcionou de verdade
- [[unikowave-skins]] — Uniko Wave — skins: visual alternativo pra personagem já existente, compradas com GW direto (sem gacha); PRECISA rodar supabase_uniko_wave_skins.sql
- [[unikowave-speed-multiplayer]] — Uniko Speed (jogo de corrida em src/modules/central-colaborador/tabs/TabUnikoFaster.jsx) ganhou multiplayer com salas; PRECISA rodar supabase_uniko_speed.sql
- [[unikowave-temp-unlock-all]] — Flag TEMP_UNLOCK_ALL do Uniko Wave — agora FALSE (personagens vêm do gacha Audição)
- [[unikowave-video-audio-release]] — Uniko Wave — modo Com Clipe mudo na 1ª jogada de uma faixa (unMute pré-onReady descartado); fix _audioReleasePending

## Referências
- [[whatsapp-financeiro-chamadas-armazenamento]] — Chamadas de celular não tocavam nos PCs vinculados do WhatsApp Business do financeiro — causa real era armazenamento cheio do celular principal (08/out/2026)

## Como trabalhar (preferências)
- [[commit-push-sem-confirmar]] — Preferência do usuário — pode fazer git commit e push sem pedir autorização
- [[extensao-download-atualizada]] — Botão "Baixar extensão" (Meus Lembretes + ExtensionPrompt) deve sempre entregar a extensão atual; zip regenerado por hook pre-commit
- [[feedback-idioma-portugues]] — Usuário quer que eu sempre responda em português, mesmo em respostas de texto livre (não só em código/commits)

