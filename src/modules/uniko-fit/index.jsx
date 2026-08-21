// src/modules/uniko-fit/index.jsx
// UNIKO FIT — estilo GymRats, layout mobile-first (pensado pra tela de iPhone,
// mas funciona em qualquer tamanho dentro de uma coluna estilo "app de celular").
// 3 abas no topo, centralizadas — Para Você (feed unificado de check-ins +
// posts), Bate-Papo (chat global com texto/emoji/imagem/áudio + aviso
// automático de check-in) e Meu Perfil (meus posts + engajamento) — e uma
// barra fixa embaixo com 5 ações: Check-In, Ranking, Postar no Feed (foto OU
// vídeo), Notificações (curtidas/comentários nas minhas fotos) e Amigos.
// Cabeçalho e barra inferior são `position:fixed` de propósito — ficam
// grudados na tela mesmo se o conteúdo rolar ou a pessoa der zoom no celular.
// Por enquanto só ADMIN acessa (módulo em construção).
// Sem servidor próprio: tudo via Supabase (tabela uniko_fit_checkins — coluna
// `kind` distingue 'checkin' de 'post' — e uniko_fit_chat com `tipo`/`media_url`
// — rodar supabase_uniko_fit.sql) + bucket de arquivos `uniko-fit-fotos`.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { T } from '../../contexts/theme';
import { USER, getAuthUser, supabase, fetchPhotoByName } from '../../contexts/user';
import { AvatarCircle } from '../../shared/components';
import { pushSupported, hasActivePushSubscription, ensurePushSubscription } from '../../utils/pushNotify';

const myName = () => { try { return getAuthUser()?.name || USER.name || 'Colaborador'; } catch { return 'Colaborador'; } };

// Ícones das reações e do selo de check-in do feed — SVG em vez de emoji
// (rende igual em qualquer aparelho/fonte, e combina com o resto dos Ico*
// do arquivo). `emoji` continua existindo em REACOES: é o valor GRAVADO no
// banco (coluna uniko_fit_reactions.emoji) — só a exibição virou ícone.
const IcoHeart = <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.1C.4 8.3 2 4.5 5.7 4c2-.3 3.6.7 4.9 2.3C11.9 4.7 13.5 3.7 15.5 4c3.7.5 5.3 4.3 3.7 7.9C21.5 16.4 12 21 12 21z"/></svg>;
const IcoCheckCircle = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 10.8 15.3 16 9.5"/></svg>;
const IcoComment = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const IcoShare = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>;

// Curtir = reagir com coração — só essa opção (a pedido; antes tinha 4:
// força/fogo/palmas/uniko). `REACOES[0]` continua sendo usado pelo
// duplo-toque de curtir na foto (ver `handlePostTap`), e `emoji` continua o
// valor gravado no banco (uniko_fit_reactions.emoji) — reações antigas com
// outro emoji ficam só fora da contagem por tipo, não travam nada.
const REACOES = [
  { id: 'curtir', emoji: '❤️', svg: IcoHeart, label: 'Curtir' },
];

const EMOJIS = ['😀','😂','😍','🔥','💪','👏','🎉','😢','😡','👍','👎','❤️','🙌','😅','🤔','😴','🥳','🏋️','🏃','🍎','💧','⏰','✅','⭐','🤝','😎','🥵','🎯'];

/* ═══════════════════ DESAFIOS — pose diária individual, sem servidor ═══════════════════
   Sem cron/servidor próprio, então a atribuição é 100% DETERMINÍSTICA (mesma
   ideia da "RNG semeada" do Uniko Wave): dado o nome da pessoa + a semana do
   ano, gera um EMBARALHAMENTO seedado da lista de poses e usa o dia da semana
   (segunda=0 ... domingo=6) como índice. Como é um embaralhamento (permutação),
   os 7 dias de uma mesma semana NUNCA repetem pose pra uma mesma pessoa — e
   como a lista tem bem mais que 7 poses, o "não repetir na semana" cai de graça.
   Só falta cuidar da virada domingo→segunda (2 semanas diferentes, poderiam
   coincidir por acaso) — ver o ajuste em `poseDoDia`. Não precisa de tabela
   no banco pras poses FIXAS: qualquer cliente calcula a pose de qualquer
   pessoa em qualquer dia só com o nome e a data — não tem corrida nem
   precisa sincronizar nada. A lista em si, porém, pode crescer com poses
   EXTRAS cadastradas pelo admin (Dashboard RH → aba "Uniko FIT", tabela
   uniko_fit_poses_custom) — ver `posesTodas` no componente. */
// Cada pose tem uma arte de demonstração do próprio Uniko (o mascote faz a
// pose, a pessoa copia). Duas colagens 6 colunas × 3 linhas (`sheet` diz
// qual): 'classicas' (as 16 poses originais) e 'novas' (as 17 de
// musculação) — `sprite:{row,col}` (0-indexado) recorta o quadradinho certo
// via CSS background-position (ver `PoseThumb`), sem precisar de 33
// arquivos soltos. Um admin pode ainda sobrescrever a foto de UMA pose fixa
// específica (Dashboard RH → aba "Uniko FIT") — nesse caso ela ganha um
// `image_url` próprio que tem prioridade sobre o `sprite` (ver `posesTodas`).
const POSE_SHEETS = {
  classicas: '/uniko-fit/poses-uniko-classicas.png', // 1536×1024px
  novas:     '/uniko-fit/poses-uniko.png',           // 1672×941px — 3ª linha só tem 5 poses
};
const POSES = [
  // ── Clássicas (16) ──
  { id: 'lingua-paz',       emoji: '😝✌️', texto: 'Língua de fora + sinal de paz com a mão',        sheet: 'classicas', sprite: { row: 0, col: 0 } },
  { id: 'toalha-suor',      emoji: '😊🧣', texto: 'Sorriso suado com a toalha no pescoço',            sheet: 'classicas', sprite: { row: 0, col: 1 } },
  { id: 'bebendo-agua',     emoji: '💧',   texto: 'Bebendo água de perfil',                           sheet: 'classicas', sprite: { row: 0, col: 2 } },
  { id: 'careta-esforco',   emoji: '😤',   texto: 'Careta de esforço',                                sheet: 'classicas', sprite: { row: 0, col: 3 } },
  { id: 'piscadinha',       emoji: '😉',   texto: 'Piscando pra câmera',                              sheet: 'classicas', sprite: { row: 0, col: 4 } },
  { id: 'joinha-duplo',     emoji: '👍👍', texto: 'Dois joinhas pra câmera',                          sheet: 'classicas', sprite: { row: 0, col: 5 } },
  { id: 'mao-cabeca',       emoji: '🤦',   texto: 'Mão na cabeça — "não aguento mais"',               sheet: 'classicas', sprite: { row: 1, col: 0 } },
  { id: 'apontando-relogio',emoji: '⏱️',   texto: 'Apontando pro relógio — "só mais uma série"',      sheet: 'classicas', sprite: { row: 1, col: 1 } },
  { id: 'cheguei-mochila',  emoji: '🎒',   texto: 'Selfie de "cheguei" com a bolsa/mochila',          sheet: 'classicas', sprite: { row: 1, col: 2 } },
  { id: 'biceps-um-braco',  emoji: '💪',   texto: 'Bíceps de um braço só (o outro segura o celular)', sheet: 'classicas', sprite: { row: 1, col: 3 } },
  { id: 'ofegante-teto',    emoji: '😮‍💨', texto: 'Olhando pro teto, ofegante',                       sheet: 'classicas', sprite: { row: 1, col: 4 } },
  { id: 'coracao-maos',     emoji: '🫶',   texto: 'Fazendo um coração com as mãos',                    sheet: 'classicas', sprite: { row: 1, col: 5 } },
  { id: 'topzeira',         emoji: '🤙',   texto: 'Topzeira / Hang Loose',                             sheet: 'classicas', sprite: { row: 2, col: 0 } },
  { id: 'oculos-cool',      emoji: '😎',   texto: 'Óculos escuros de suor — pose "cool"',              sheet: 'classicas', sprite: { row: 2, col: 1 } },
  { id: 'bico-engracado',   emoji: '😗',   texto: 'Bico / careta engraçada',                           sheet: 'classicas', sprite: { row: 2, col: 2 } },
  { id: 'garrafa-trofeu',   emoji: '🏆',   texto: 'Garrafa de água erguida como troféu',               sheet: 'classicas', sprite: { row: 2, col: 3 } },
  // ── Musculação (17) ──
  { id: 'biceps-duplo',        emoji: '💪💪', texto: 'Bíceps duplo',                                     sheet: 'novas', sprite: { row: 0, col: 0 } },
  { id: 'costas-v-ombro',      emoji: '👀',   texto: 'Costas em V, olhando por cima do ombro',            sheet: 'novas', sprite: { row: 0, col: 1 } },
  { id: 'peito-cintura',       emoji: '🫡',   texto: 'Peito estufado, mãos na cintura',                   sheet: 'novas', sprite: { row: 0, col: 2 } },
  { id: 'perfil-definicao',    emoji: '💯',   texto: 'Perfil de lado mostrando a definição',              sheet: 'novas', sprite: { row: 0, col: 3 } },
  { id: 'halteres-dois-braços',emoji: '🏋️',  texto: 'Segurando halteres nos dois braços',                sheet: 'novas', sprite: { row: 0, col: 4 } },
  { id: 'barra-frente',        emoji: '🏋️‍♂️', texto: 'Segurando a barra/peso na frente do corpo',       sheet: 'novas', sprite: { row: 0, col: 5 } },
  { id: 'abdomen-camiseta',    emoji: '🍫',   texto: 'Abdômen contraído, camiseta/moletom levantado',     sheet: 'novas', sprite: { row: 1, col: 0 } },
  { id: 'panturrilha-ponta',   emoji: '🦵',   texto: 'Panturrilha na ponta dos pés',                      sheet: 'novas', sprite: { row: 1, col: 1 } },
  { id: 'super-heroi',         emoji: '🦸',   texto: 'Pose de super-herói',                               sheet: 'novas', sprite: { row: 1, col: 2 } },
  { id: 'modo-foco',           emoji: '🧘',   texto: 'Encarando o espelho, "modo foco"',                  sheet: 'novas', sprite: { row: 1, col: 3 } },
  { id: 'alongando-braco',     emoji: '🙆',   texto: 'Alongando o braço atrás da cabeça',                 sheet: 'novas', sprite: { row: 1, col: 4 } },
  { id: 'torcao-tronco',       emoji: '🌀',   texto: 'Torção de tronco',                                  sheet: 'novas', sprite: { row: 1, col: 5 } },
  { id: 'luva-treino',         emoji: '🧤',   texto: 'Colocando a luva de treino',                        sheet: 'novas', sprite: { row: 2, col: 0 } },
  { id: 'ajustando-bone',      emoji: '🧢',   texto: 'Ajustando boné/touca',                              sheet: 'novas', sprite: { row: 2, col: 1 } },
  { id: 'faixa-pulso',         emoji: '🎗️',   texto: 'Enrolando a faixa de pulso',                        sheet: 'novas', sprite: { row: 2, col: 2 } },
  { id: 'quadriceps-perna',    emoji: '🦿',   texto: 'Flexionando a perna, mostrando o quadríceps',       sheet: 'novas', sprite: { row: 2, col: 3 } },
  { id: 'selfie-paz',          emoji: '✌️',   texto: 'Selfie final com sinal de paz',                     sheet: 'novas', sprite: { row: 2, col: 4 } },
];
// Grade das colagens (as duas são 6×3) — usada tanto pro corte do sprite quanto pra proporção do quadro.
const POSES_SPRITE_COLS = 6, POSES_SPRITE_ROWS = 3;
// Exportadas pra Dashboard RH → aba "Uniko FIT" (UnikoFitPosesTab.jsx) reusar
// a MESMA lista/grade em vez de manter uma cópia solta que desalinha.
export { POSES, POSE_SHEETS, POSES_SPRITE_COLS, POSES_SPRITE_ROWS };

const _strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// Cor da tag de desafio no feed — "aleatória" mas ESTÁVEL pra mesma pose (hash
// do id, não Math.random(): senão a cor mudaria a cada re-render/scroll).
const TAG_CORES = ['#F43F5E', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#22C55E', '#EAB308', '#06B6D4'];
const corDaTagPose = (poseId) => TAG_CORES[_strHash(poseId || '') % TAG_CORES.length];
const _mulberry32 = (seed) => { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const _seededShuffle = (arr, seed) => {
  const rng = _mulberry32(seed); const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
// Segunda-feira de referência (1/jan/2024 caiu numa segunda) — só serve pra
// contar "quantas semanas se passaram", não precisa ser exato pro calendário.
const _MONDAY_EPOCH = Date.UTC(2024, 0, 1);
const _weekIndexFor = (dateUTC) => Math.floor((Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate()) - _MONDAY_EPOCH) / (7 * 86400000));
const _dowMondayFirst = (dateUTC) => (dateUTC.getUTCDay() + 6) % 7; // 0=segunda … 6=domingo

// `poses` é a lista COMPLETA (fixas do array POSES + extras cadastradas pelo
// admin na aba "Uniko FIT" do RH — ver `posesTodas` no componente). Passar a
// lista de fora deixa a função pura e determinística: mesma pessoa + mesma
// data + mesma lista = sempre a mesma pose, em qualquer cliente.
const poseDoDia = (player, dateUTC = new Date(), poses = POSES) => {
  const week = _weekIndexFor(dateUTC);
  const dow = _dowMondayFirst(dateUTC);
  let shuffled = _seededShuffle(poses, _strHash(`${player}|w${week}`));
  if (dow === 0) {
    // 1º dia da semana: evita coincidir com a última pose da semana anterior
    // (a única costura entre embaralhamentos independentes — o resto da
    // semana já não repete sozinho, por construção do shuffle).
    const prevShuffled = _seededShuffle(poses, _strHash(`${player}|w${week - 1}`));
    const prevLast = prevShuffled[Math.min(6, poses.length - 1)];
    if (shuffled[0].id === prevLast.id) { const j = 1 % shuffled.length; [shuffled[0], shuffled[j]] = [shuffled[j], shuffled[0]]; }
  }
  return shuffled[dow % shuffled.length];
};

const tempoRelativo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};
const horaCurta = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/* ── Ícones ── */
const IcoBack   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>;
const IcoFit    = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="4" height="8" rx="1.3" /><rect x="18" y="8" width="4" height="8" rx="1.3" /><line x1="6" y1="12" x2="18" y2="12" /></svg>;
const IcoCamera = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcoTrophy = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M17 6h2a2 2 0 01-2 4M7 6H5a2 2 0 002 4"/></svg>;
const IcoPost   = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const IcoInfo   = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="11.5"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IcoTarget = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>;
const IcoSend   = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
const IcoSmile  = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
const IcoImg    = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
const IcoMic    = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IcoStop   = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>;
const IcoClose  = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>;
const IcoBell   = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const IcoHeartSm = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.1C.4 8.3 2 4.5 5.7 4c2-.3 3.6.7 4.9 2.3C11.9 4.7 13.5 3.7 15.5 4c3.7.5 5.3 4.3 3.7 7.9C21.5 16.4 12 21 12 21z"/></svg>;
const IcoCommentSm = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const IcoTrash  = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IcoVolOn  = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>;
const IcoVolOff = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
const IcoFlip   = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>;

/* ── Filtros de cor pra foto do check-in — aplicados via CSS `filter` no
   preview e "assados" no canvas na hora de gerar o arquivo final. ── */
const PHOTO_FILTERS = [
  { id: 'normal',  label: 'Normal',  css: 'none' },
  { id: 'pb',      label: 'P&B',     css: 'grayscale(1)' },
  { id: 'sepia',   label: 'Sépia',   css: 'sepia(.8)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(.35) contrast(1.1) brightness(1.05) saturate(1.3)' },
  { id: 'vivido',  label: 'Vívido',  css: 'saturate(1.6) contrast(1.15)' },
  { id: 'frio',    label: 'Frio',    css: 'hue-rotate(-12deg) saturate(1.15) brightness(1.03)' },
  { id: 'quente',  label: 'Quente',  css: 'sepia(.2) saturate(1.35) hue-rotate(-8deg)' },
  { id: 'drama',   label: 'Drama',   css: 'contrast(1.35) brightness(.88) saturate(.85)' },
];

/* ── Câmera do check-in: só dá pra tirar foto na hora (sem galeria), com
   filtro de cor opcional aplicado antes de confirmar. `facing` alterna
   frontal/traseira; a frontal é espelhada no preview (senão parece "ao
   contrário" pra quem está se vendo) mas gravada SEM espelho no arquivo
   final — senão o texto/relógio ao fundo saem invertidos na foto salva. ── */
const CROP_DEFAULT = { x: 0, y: 0, w: 1, h: 1 }; // fração (0..1) da imagem — sem corte por padrão
const CameraCapture = ({ energia, onCapture }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('user');
  const [filterId, setFilterId] = useState('normal');
  const [rawShot, setRawShot] = useState(null); // dataURL cru (sem filtro) — null = câmera ao vivo
  const [erro, setErro] = useState('');
  const filtro = PHOTO_FILTERS.find(f => f.id === filterId) || PHOTO_FILTERS[0];

  // ── Cortar/redimensionar na revisão: arrasta as bordas do quadro pra
  // escolher só uma parte da foto. `crop` é sempre fração (0..1) da imagem
  // NATURAL (não do preview) — funciona mesmo se o preview mostrar a foto
  // com letterbox (câmera não é 4:5 igual o quadro). O quadro de arrastar
  // fica só sobre a ÁREA REAL da imagem (`dispRectPct`), calculada a partir
  // do tamanho natural + `object-fit: contain` — sem isso, arrastar até a
  // borda do preview cortaria fora da imagem de verdade.
  const [crop, setCrop] = useState(CROP_DEFAULT);
  const [imgNatural, setImgNatural] = useState(null); // {w,h} da rawShot
  const boxRef = useRef(null);
  const cropBoxRef = useRef(null);
  const dragRef = useRef(null);

  const dispRectPct = useMemo(() => {
    if (!imgNatural || !boxRef.current) return { left: 0, top: 0, width: 100, height: 100, widthPx: 0 };
    const boxRect = boxRef.current.getBoundingClientRect();
    if (!boxRect.width || !boxRect.height) return { left: 0, top: 0, width: 100, height: 100, widthPx: 0 };
    const scale = Math.min(boxRect.width / imgNatural.w, boxRect.height / imgNatural.h);
    const dispW = imgNatural.w * scale, dispH = imgNatural.h * scale;
    return {
      left: ((boxRect.width - dispW) / 2 / boxRect.width) * 100,
      top: ((boxRect.height - dispH) / 2 / boxRect.height) * 100,
      width: (dispW / boxRect.width) * 100,
      height: (dispH / boxRect.height) * 100,
      widthPx: dispW, // usado só pro tamanho em px dos emojis (`stickers`)
    };
  }, [imgNatural, rawShot]);

  // ── Emoji em cima da foto: cada sticker fica em fração (0..1) da mesma área
  // real da imagem (`dispRectPct`) que o corte usa, então corte e emoji
  // continuam batendo entre si. `size` é fração da LARGURA da imagem (não px
  // fixo) pra ficar proporcional em fotos de resoluções diferentes.
  const [stickers, setStickers] = useState([]); // [{id, emoji, x, y, size}]
  const dispRef = useRef(null);
  const stickerRef = useRef(null);
  const addSticker = (emoji) => setStickers(s => [...s, { id: `${Date.now()}-${Math.random()}`, emoji, x: 0.5, y: 0.5, size: 0.16 }]);
  const removerSticker = (id) => setStickers(s => s.filter(st => st.id !== id));
  const iniciarSticker = (id, kind) => (e) => {
    e.stopPropagation();
    const rect = dispRef.current?.getBoundingClientRect();
    const st = stickers.find(s => s.id === id);
    if (!rect?.width || !st) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickerRef.current = { id, kind, rect, startX: e.clientX, startY: e.clientY, startPos: { x: st.x, y: st.y }, startSize: st.size };
  };
  const moverSticker = (e) => {
    const d = stickerRef.current;
    if (!d) return;
    if (d.kind === 'move') {
      const dx = (e.clientX - d.startX) / d.rect.width;
      const dy = (e.clientY - d.startY) / d.rect.height;
      const x = clamp01(d.startPos.x + dx), y = clamp01(d.startPos.y + dy);
      setStickers(s => s.map(st => st.id === d.id ? { ...st, x, y } : st));
    } else {
      const dx = (e.clientX - d.startX) / d.rect.width;
      const size = Math.min(0.6, Math.max(0.05, d.startSize + dx));
      setStickers(s => s.map(st => st.id === d.id ? { ...st, size } : st));
    }
  };
  const soltarSticker = (e) => { stickerRef.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* já solto */ } };

  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const iniciarDrag = (mode) => (e) => {
    e.stopPropagation();
    const rect = cropBoxRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode, rect, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
  };
  const moverDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    const MIN = 0.15;
    let { x, y, w, h } = d.startCrop;
    if (d.mode === 'move') {
      x = clamp01(x + dx); y = clamp01(y + dy);
      x = Math.min(x, 1 - w); y = Math.min(y, 1 - h);
    } else {
      if (d.mode.includes('w')) { const nx = Math.min(clamp01(x + dx), x + w - MIN); w = x + w - nx; x = nx; }
      if (d.mode.includes('e')) { w = Math.max(MIN, clamp01(x + w + dx) - x); }
      if (d.mode.includes('n')) { const ny = Math.min(clamp01(y + dy), y + h - MIN); h = y + h - ny; y = ny; }
      if (d.mode.includes('s')) { h = Math.max(MIN, clamp01(y + h + dy) - y); }
    }
    setCrop({ x, y, w, h });
  };
  const soltarDrag = (e) => { dragRef.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* já solto */ } };

  const pararCamera = () => { streamRef.current?.getTracks()?.forEach(t => t.stop()); streamRef.current = null; };

  const iniciarCamera = useCallback(async (face) => {
    setErro(''); pararCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
    } catch (e) { console.error('[uniko-fit] câmera:', e); setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador.'); }
  }, []);

  useEffect(() => {
    // `iniciarCamera` é async: o setState só roda depois do await, nunca
    // síncrono no effect — mesmo caso do `loadFeed()` em outros pontos do arquivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!rawShot) iniciarCamera(facing);
    return () => pararCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, rawShot]);

  const tirarFoto = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); } // desfaz o espelho do preview
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setRawShot(canvas.toDataURL('image/jpeg', 1)); // qualidade máxima — é a fonte pro corte/filtro final, perda aqui se acumula
    setCrop(CROP_DEFAULT); setImgNatural(null); setStickers([]);
    pararCamera();
  };

  const confirmar = () => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(crop.x * img.width), sy = Math.round(crop.y * img.height);
      const sw = Math.max(1, Math.round(crop.w * img.width)), sh = Math.max(1, Math.round(crop.h * img.height));
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.filter = filtro.css;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.filter = 'none'; // os emojis não devem levar o filtro de cor da foto
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      stickers.forEach(st => {
        const fontPx = st.size * img.width;
        ctx.font = `${fontPx}px sans-serif`;
        ctx.fillText(st.emoji, st.x * img.width - sx, st.y * img.height - sy);
      });
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `checkin-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, URL.createObjectURL(blob));
      }, 'image/jpeg', 1); // qualidade máxima — sem corte/filtro/emoji, dava pra ser lossless (PNG), mas com eles o canvas precisa reexportar de qualquer jeito
    };
    img.src = rawShot;
  };

  return (
    <div>
      <div ref={boxRef} style={{ position: 'relative', width: '100%', aspectRatio: '4/5', background: '#000', overflow: 'hidden', borderRadius: 14 }}>
        {rawShot
          ? <img src={rawShot} alt="" onLoad={e => setImgNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
              style={{ width: '100%', height: '100%', objectFit: 'contain', filter: filtro.css }} />
          : <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', filter: filtro.css, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} />}
        {erro && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#fff', fontSize: 12.5, background: 'rgba(0,0,0,.65)' }}>{erro}</div>
        )}
        {!rawShot && !erro && (
          <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} className="fit-btn" title="Trocar câmera"
            style={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IcoFlip}</button>
        )}
        {/* Quadro de corte — só aparece na revisão, sobre a área REAL da imagem (dispRectPct) */}
        {rawShot && imgNatural && (
          <div ref={dispRef} style={{ position: 'absolute', left: `${dispRectPct.left}%`, top: `${dispRectPct.top}%`, width: `${dispRectPct.width}%`, height: `${dispRectPct.height}%` }}>
            <div ref={cropBoxRef} onPointerDown={iniciarDrag('move')} onPointerMove={moverDrag} onPointerUp={soltarDrag}
              style={{ position: 'absolute', left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, zIndex: 1,
                boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', border: '2px solid #fff', borderRadius: 4, cursor: 'move', touchAction: 'none' }}>
              {['nw', 'ne', 'sw', 'se'].map(corner => (
                <div key={corner} onPointerDown={iniciarDrag(corner)} onPointerMove={moverDrag} onPointerUp={soltarDrag}
                  style={{ position: 'absolute', width: 18, height: 18, background: '#fff', borderRadius: '50%', border: `2px solid ${energia}`, touchAction: 'none',
                    cursor: (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize',
                    top: corner.includes('n') ? -9 : 'auto', bottom: corner.includes('s') ? -9 : 'auto',
                    left: corner.includes('w') ? -9 : 'auto', right: corner.includes('e') ? -9 : 'auto' }} />
              ))}
            </div>
            {/* Emojis colados na foto — em cima do quadro de corte, sempre clicáveis */}
            {stickers.map(st => (
              <div key={st.id} onPointerDown={iniciarSticker(st.id, 'move')} onPointerMove={moverSticker} onPointerUp={soltarSticker}
                style={{ position: 'absolute', left: `${st.x * 100}%`, top: `${st.y * 100}%`, transform: 'translate(-50%,-50%)',
                  fontSize: dispRectPct.widthPx ? st.size * dispRectPct.widthPx : 28, lineHeight: 1, cursor: 'move', touchAction: 'none', zIndex: 2, userSelect: 'none' }}>
                {st.emoji}
                <button onPointerDown={e => e.stopPropagation()} onClick={() => removerSticker(st.id)} title="Remover emoji"
                  style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                <div onPointerDown={iniciarSticker(st.id, 'resize')} onPointerMove={moverSticker} onPointerUp={soltarSticker} title="Arraste pra redimensionar"
                  style={{ position: 'absolute', bottom: -6, right: -6, width: 14, height: 14, borderRadius: '50%', border: `2px solid ${energia}`, background: '#fff', cursor: 'nwse-resize', touchAction: 'none' }} />
              </div>
            ))}
          </div>
        )}
      </div>
      {rawShot && <div style={{ padding: '6px 2px 0', fontSize: 11, color: 'inherit', opacity: .65, textAlign: 'center' }}>Arraste as bordas do quadro pra cortar, e os emojis pra reposicionar</div>}

      <div style={{ display: 'flex', gap: 7, padding: '11px 2px', overflowX: 'auto' }}>
        {PHOTO_FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilterId(f.id)} className="fit-btn"
            style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
              border: `1.5px solid ${filterId === f.id ? energia : 'transparent'}`, background: filterId === f.id ? `${energia}18` : 'rgba(128,128,128,.12)', color: filterId === f.id ? energia : 'inherit' }}>{f.label}</button>
        ))}
      </div>

      {rawShot && (
        <div style={{ display: 'flex', gap: 7, padding: '0 2px 11px', overflowX: 'auto' }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => addSticker(e)} className="fit-btn" title="Adicionar emoji na foto"
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 17, background: 'rgba(128,128,128,.12)' }}>{e}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {rawShot ? (
          <>
            <button onClick={() => { setRawShot(null); setCrop(CROP_DEFAULT); setImgNatural(null); setStickers([]); }} className="fit-btn"
              style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${energia}55`, background: 'none', color: energia, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↺ Tirar de novo</button>
            <button onClick={confirmar} className="fit-btn"
              style={{ flex: 2, padding: 12, borderRadius: 12, border: 'none', background: energia, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓ Usar essa foto</button>
          </>
        ) : (
          <button onClick={tirarFoto} disabled={!!erro} className="fit-btn"
            style={{ flex: 1, padding: 13, borderRadius: 999, border: 'none', background: erro ? '#999' : energia, color: '#fff', fontWeight: 800, fontSize: 14, cursor: erro ? 'not-allowed' : 'pointer' }}>📸 Tirar foto</button>
        )}
      </div>
    </div>
  );
};
const isVideoUrl = (url) => /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url || '');

/* ── Sheet (folha deslizante de baixo pra cima) — usado pelas 4 ações da barra ── */
const Sheet = ({ title, onBack, onClose, children }) => {
  const cardBg = T.surface || '#fff';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,6,10,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="fit-sheet-in" style={{ background: cardBg, width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -14px 50px rgba(0,0,0,.35)', border: `1px solid ${T.border}`, borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 8px 13px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {onBack && <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textS, padding: 6, display: 'flex' }}>{IcoBack}</button>}
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textS, padding: 8, display: 'flex' }}>{IcoClose}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
};

/* ── Vídeo do feed com autoplay que funciona no celular também ── */
// No mobile, `autoPlay` sozinho costuma falhar: alguns navegadores ignoram o
// atributo `muted` do JSX na primeira renderização (precisa setar via DOM), e
// o autoplay só é permitido de verdade quando o vídeo está VISÍVEL na tela —
// por isso o play/pause aqui é disparado por IntersectionObserver, não pelo
// atributo `autoPlay` (que só dispara uma vez, no mount, e não repete quando
// o card volta a ficar visível depois de rolar pra longe e voltar).
// Começa MUDO de propósito (navegador só autoplay com som depois de um toque
// do usuário — sem isso o vídeo nem tocava) — o botão de alto-falante no card
// dá play com áudio a partir dali (é um toque real, o navegador libera).
const FeedVideo = ({ src, style, muted }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playsInline = true;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play().catch(() => { /* autoplay pode ser recusado até 1ª interação — silencioso */ });
      else el.pause();
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);
  return <video ref={ref} src={src} muted={muted} loop playsInline preload="auto" style={style} />;
};

/* ── Arte de uma pose: as fixas vêm de um recorte da colagem `/uniko-fit/
   poses-uniko.png` (sprite sheet 6×3) via background-position percentual;
   as extras cadastradas pelo admin (aba "Uniko FIT" do RH) já têm a própria
   imagem (`image_url`, um upload avulso). Sem nenhuma das duas, cai pro emoji. ── */
const PoseThumb = ({ pose, size = 56, round = 12 }) => {
  if (pose?.image_url) return <div style={{ width: size, height: size, borderRadius: round, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.12)' }}><img src={pose.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  if (!pose?.sprite) return <div style={{ width: size, height: size, borderRadius: round, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, background: 'rgba(128,128,128,.12)', flexShrink: 0 }}>{pose?.emoji}</div>;
  const { row, col } = pose.sprite;
  return (
    <div style={{ width: size, height: size, borderRadius: round, overflow: 'hidden', flexShrink: 0, background: 'rgba(128,128,128,.12)',
      backgroundImage: `url(${POSE_SHEETS[pose.sheet] || POSE_SHEETS.novas})`, backgroundSize: `${POSES_SPRITE_COLS * 100}% ${POSES_SPRITE_ROWS * 100}%`,
      backgroundPosition: `${col / (POSES_SPRITE_COLS - 1) * 100}% ${row / (POSES_SPRITE_ROWS - 1) * 100}%` }} />
  );
};

/* ── Miniatura de grid (foto ou vídeo) — usada no Amigos e no Meu Perfil ── */
const ThumbCell = ({ it, engaj, onClick, onDelete }) => (
  <div onClick={onClick} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#111', cursor: onClick ? 'pointer' : 'default' }}>
    {isVideoUrl(it.photo_url)
      ? <video src={it.photo_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <img src={it.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    {isVideoUrl(it.photo_url) && (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,.9)" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.5))' }}><polygon points="6 4 20 12 6 20" /></svg>
      </div>
    )}
    {it.kind === 'checkin' && <div style={{ position: 'absolute', top: 3, right: 3, fontSize: 12, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}>✅</div>}
    {onDelete && (
      <button onClick={e => { e.stopPropagation(); onDelete(it); }} className="fit-btn"
        style={{ position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IcoTrash}</button>
    )}
    {engaj && (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '3px 5px', background: 'linear-gradient(0deg, rgba(0,0,0,.78), transparent)', display: 'flex', gap: 7, alignItems: 'center', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9.5, fontWeight: 700 }}>{IcoHeartSm} {engaj.likes || 0}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9.5, fontWeight: 700 }}>{IcoCommentSm} {engaj.comments || 0}</span>
      </div>
    )}
  </div>
);

/* ── Calendário pessoal de check-ins ("Frequência de Treinos") — usado no Meu
   Perfil (os seus) e no perfil de um amigo (Amigos → ver perfil). `items` é
   a lista de posts da pessoa (mesma fonte do ThumbCell: `created_at` +
   `kind`); só dia com `kind==='checkin'` conta como treino. Navega mês a
   mês, sem ir além do mês atual. Dia em UTC — mesmo critério usado no resto
   do módulo (1 check-in por dia, ranking etc.), pra bater com a contagem
   de lá. ── */
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const CheckinCalendar = ({ items, energia, label = 'Treinou' }) => {
  const [cal, setCal] = useState(() => { const d = new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  const diasTreinados = useMemo(() => {
    const set = new Set();
    (items || []).forEach(it => {
      if (it.kind !== 'checkin' || !it.created_at) return;
      const d = new Date(it.created_at);
      if (d.getUTCFullYear() === cal.y && d.getUTCMonth() === cal.m) set.add(d.getUTCDate());
    });
    return set;
  }, [items, cal]);

  const primeiroDiaSemana = (new Date(Date.UTC(cal.y, cal.m, 1)).getUTCDay() + 6) % 7; // 0=segunda
  const totalDias = new Date(Date.UTC(cal.y, cal.m + 1, 0)).getUTCDate();
  const agora = new Date();
  const ehMesAtual = cal.y === agora.getUTCFullYear() && cal.m === agora.getUTCMonth();
  const diaHoje = agora.getUTCDate();

  const irMes = (delta) => setCal(c => { const nm = c.m + delta; const ny = c.y + Math.floor(nm / 12); const mm = ((nm % 12) + 12) % 12; return { y: ny, m: mm }; });

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  return (
    <div style={{ background: T.surfaceSub || 'rgba(0,0,0,.03)', borderRadius: 14, padding: '14px 12px', border: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => irMes(-1)} className="fit-btn" style={{ border: 'none', background: 'none', color: energia, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3, padding: 4 }}>{IcoBack} Anterior</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{MESES_PT[cal.m]}</div>
          <div style={{ fontSize: 11, color: T.textT }}>{cal.y}</div>
        </div>
        <button onClick={() => irMes(1)} disabled={ehMesAtual} className="fit-btn"
          style={{ border: 'none', background: 'none', color: ehMesAtual ? T.textD : energia, cursor: ehMesAtual ? 'default' : 'pointer', opacity: ehMesAtual ? .4 : 1,
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3, padding: 4 }}>
          Seguinte <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 6 }}>
        {DIAS_SEMANA_PT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: T.textT }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
        {celulas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const treinou = diasTreinados.has(d);
          const futuro = ehMesAtual && d > diaHoje;
          return (
            <div key={i} style={{ aspectRatio: '1/1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700,
              background: treinou ? energia : 'rgba(128,128,128,.16)', color: treinou ? '#fff' : (futuro ? T.textD : T.textT), opacity: futuro && !treinou ? .5 : 1 }}>{d}</div>
          );
        })}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${energia}1c`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: energia, flexShrink: 0 }}>{IcoCheckCircle}</div>
        <div style={{ fontSize: 13, color: T.text }}><b style={{ fontSize: 16 }}>{diasTreinados.size}</b> dia{diasTreinados.size !== 1 ? 's' : ''} — {label} {ehMesAtual ? 'esse mês' : `em ${MESES_PT[cal.m].toLowerCase()}`}</div>
      </div>
    </div>
  );
};

const UnikoFit = ({ onBack, authUser, userPhoto }) => {
  const name = myName();
  const userName = authUser?.name || name;
  const cardBg = T.surface || '#fff';
  const [topTab, setTopTab] = useState('paravoce'); // paravoce | batepapo
  const [sheet, setSheet] = useState(null);          // null | checkin | post | ranking | notif | amigos
  // Vídeos do feed começam mudos (autoplay com som é bloqueado sem toque do
  // usuário) — o botão de alto-falante no card muda isso pra TODOS os vídeos
  // de uma vez (não é por vídeo individual, senão a pessoa teria que destocar
  // toda hora ao rolar pro próximo).
  const [feedMuted, setFeedMuted] = useState(true);

  // ── Regras de convivência — tela de boas-vindas na PRIMEIRA vez que a
  // pessoa abre o módulo. Guarda por CONTA (tabela uniko_fit_terms_acceptance,
  // não só localStorage) pra não pedir de novo se trocar de aparelho; o
  // localStorage é só um atalho pra não bater no Supabase toda vez que abrir.
  const termsKeyRef = useRef(`uniko_fit_terms_ok_${(getAuthUser()?.cpf || name).replace(/\W/g, '_')}`);
  const [mostrarTermos, setMostrarTermos] = useState(false);
  const [podeAceitarTermos, setPodeAceitarTermos] = useState(false);
  useEffect(() => {
    let jaAceitou = false;
    try { jaAceitou = localStorage.getItem(termsKeyRef.current) === '1'; } catch { /* localStorage indisponível */ }
    if (jaAceitou) return;
    (async () => {
      try {
        const { data } = await supabase.from('uniko_fit_terms_acceptance').select('player').eq('player', name).maybeSingle();
        if (data) { try { localStorage.setItem(termsKeyRef.current, '1'); } catch { /* ok, só perde o atalho */ } return; }
      } catch { /* sem rede — melhor mostrar de novo do que arriscar não mostrar nunca */ }
      setMostrarTermos(true);
    })();
  }, [name]);
  useEffect(() => {
    if (!mostrarTermos) return;
    setPodeAceitarTermos(false);
    const t = setTimeout(() => setPodeAceitarTermos(true), 10000);
    return () => clearTimeout(t);
  }, [mostrarTermos]);
  const aceitarTermos = async () => {
    setMostrarTermos(false);
    try { localStorage.setItem(termsKeyRef.current, '1'); } catch { /* localStorage indisponível */ }
    try { await supabase.from('uniko_fit_terms_acceptance').upsert({ player: name, accepted_at: new Date().toISOString() }, { onConflict: 'player' }); } catch { /* best-effort — o localStorage já resolveu pra esse aparelho */ }
  };

  // ── Cor fixa do módulo: laranja, SEMPRE — a única exceção é quando o tema
  // ativo já É laranja, aí ela vira azul (senão o módulo some dentro do próprio
  // tema). `T.key` é o id do tema aplicado agora (ver contexts/theme.js). ──
  const isOrangeTheme = T.key === 'orange' || T.key === 'orangeDark';
  const ENERGIA = isOrangeTheme ? '#2A82D2' : '#FF6B35';
  const FOGO    = isOrangeTheme ? '#1A6FB5' : '#F43F5E';
  const EG = isOrangeTheme ? 'rgba(42,130,210,.35)' : 'rgba(255,107,53,.35)';

  const FIT_CSS = `
/* No celular, 100vh conta com a barra de endereço ESCONDIDA — quando ela está
   visível (o normal), a tela útil de verdade é menor, e um card com height
   baseado nesse 100vh "inflado" empurra legenda/botão de comentar pra baixo
   da área visível (por trás da barra fixa de baixo). 100dvh acompanha a barra
   dinamicamente; a declaração de 100vh antes fica como fallback pra navegador
   que não suporta dvh (regra de cascata simples, não precisa de @supports). */
.fit-root { height: 100vh; height: 100dvh; }
@keyframes fitSheetIn { from { transform: translateY(24px); opacity: .4; } to { transform: none; opacity: 1; } }
.fit-sheet-in { animation: fitSheetIn .22s cubic-bezier(.2,1,.4,1) both; }
@keyframes fitPop  { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
@keyframes fitTermFade { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fitPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes fitHeartBurst { 0% { transform: scale(.3); opacity: 0; } 30% { transform: scale(1.15); opacity: 1; } 50% { transform: scale(.95); } 100% { transform: scale(1); opacity: 0; } }
.fit-heart-burst { animation: fitHeartBurst .7s cubic-bezier(.17,.89,.32,1.49) both; }
.fit-pop  { animation: fitPop .35s cubic-bezier(.2,1.6,.4,1) both; }
.fit-btn { transition: transform .12s, filter .12s; -webkit-tap-highlight-color: transparent; }
.fit-btn:hover:not(:disabled) { filter: brightness(1.06); }
.fit-btn:active:not(:disabled) { transform: scale(.94); }
.fit-feed { scroll-snap-type: y mandatory; -webkit-overflow-scrolling: touch; }
.fit-feed::-webkit-scrollbar { display: none; }
.fit-card { scroll-snap-align: start; scroll-snap-stop: always; }
.fit-scroll { scrollbar-width: thin; scrollbar-color: ${ENERGIA}99 rgba(128,128,128,.14); -webkit-overflow-scrolling: touch; }
.fit-scroll::-webkit-scrollbar { width: 6px; }
.fit-scroll::-webkit-scrollbar-thumb { background: ${ENERGIA}99; border-radius: 99px; }
`;

  // ── Fotos de perfil (cache compartilhado por todas as áreas) ──
  const [photos, setPhotos] = useState({});
  const photosRef = useRef({});
  useEffect(() => { photosRef.current = photos; }, [photos]);
  // A SUA foto (nos seus check-ins/comentários/mensagens dentro do Uniko FIT)
  // sempre reflete `userPhoto` — a mesma foto do Portal do Colaborador (prop
  // vinda do App.jsx, já sincronizada de lá com "Seus Dados"). Sem isso, uma
  // troca de foto durante a sessão não aparecia aqui: `ensurePhotos` só busca
  // um nome uma vez e guarda em cache, então ficava presa na foto de quando
  // essa pessoa apareceu pela primeira vez num post/comentário/mensagem.
  useEffect(() => {
    if (userPhoto) setPhotos(prev => (prev[name] === userPhoto ? prev : { ...prev, [name]: userPhoto }));
  }, [userPhoto, name]);
  const ensurePhotos = useCallback(async (nomes) => {
    const faltam = [...new Set(nomes)].filter(n => n && !(n in photosRef.current));
    if (!faltam.length) return;
    const pairs = await Promise.all(faltam.map(async n => [n, await fetchPhotoByName(n).catch(() => null)]));
    setPhotos(prev => { const next = { ...prev }; pairs.forEach(([n, p]) => { next[n] = p || null; }); return next; });
  }, []);

  /* ═══════════════════ FEED "PARA VOCÊ" (check-ins + posts) ═══════════════════ */
  const [feed, setFeed] = useState(null);           // null = carregando
  const [reacoes, setReacoes] = useState({});        // itemId -> {counts:{emoji:n}, mine:emoji|null}
  const [comentCount, setComentCount] = useState({}); // itemId -> n

  const loadFeed = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_fit_checkins').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { setFeed([]); return; }
    const posts = data || [];
    setFeed(posts);
    ensurePhotos(posts.map(p => p.player));
    const ids = posts.map(p => p.id);
    if (!ids.length) return;
    const [reacRes, comRes] = await Promise.all([
      supabase.from('uniko_fit_reactions').select('checkin_id,player,emoji').in('checkin_id', ids),
      supabase.from('uniko_fit_comments').select('checkin_id').in('checkin_id', ids),
    ]);
    const rmap = {};
    (reacRes.data || []).forEach(r => {
      const e = rmap[r.checkin_id] || (rmap[r.checkin_id] = { counts: {}, mine: null });
      e.counts[r.emoji] = (e.counts[r.emoji] || 0) + 1;
      if (r.player === name) e.mine = r.emoji;
    });
    setReacoes(rmap);
    const cmap = {};
    (comRes.data || []).forEach(c => { cmap[c.checkin_id] = (cmap[c.checkin_id] || 0) + 1; });
    setComentCount(cmap);
  }, [ensurePhotos, name]);

  const feedRef = useRef(null);
  useEffect(() => { feedRef.current = feed; }, [feed]);

  useEffect(() => {
    // `loadFeed` é async: o setState só roda depois do await, nunca síncrono
    // no effect — o compiler não distingue e acusa cascata de render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFeed();
    const ch = supabase.channel('uniko-fit-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_checkins' }, ({ new: row }) => {
        setFeed(prev => (prev && prev.some(p => p.id === row.id)) ? prev : [row, ...(prev || [])]);
        ensurePhotos([row.player]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_comments' }, ({ new: row }) => {
        setComentCount(prev => ({ ...prev, [row.checkin_id]: (prev[row.checkin_id] || 0) + 1 }));
      })
      .subscribe();
    // Reações: poll leve de 20s (mais simples que reconciliar delta de UPDATE/DELETE em
    // tempo real — a contagem de "curtidas" não precisa ser instantânea pra ninguém
    // além de quem clicou, que já vê otimista na hora).
    const poll = setInterval(() => { if (feedRef.current?.length) loadFeed(); }, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleReacao = async (itemId, emoji) => {
    const cur = reacoes[itemId] || { counts: {}, mine: null };
    const jaEssa = cur.mine === emoji;
    setReacoes(prev => {
      const atual = prev[itemId] || { counts: {}, mine: null };
      const counts = { ...atual.counts };
      if (atual.mine) counts[atual.mine] = Math.max(0, (counts[atual.mine] || 1) - 1);
      if (!jaEssa) counts[emoji] = (counts[emoji] || 0) + 1;
      return { ...prev, [itemId]: { counts, mine: jaEssa ? null : emoji } };
    });
    try {
      if (jaEssa) await supabase.from('uniko_fit_reactions').delete().eq('checkin_id', itemId).eq('player', name);
      else await supabase.from('uniko_fit_reactions').upsert({ checkin_id: itemId, player: name, emoji }, { onConflict: 'checkin_id,player' });
    } catch (e) { console.error('[uniko-fit] reação:', e); }
  };

  // Compartilhar um post do feed no Bate-Papo — guarda o id do check-in
  // original em `shared_checkin_id` pra o clique no chat levar direto pro
  // post (ver `irParaFeed` e o render de tipo==='compartilhado' no chat).
  const compartilharNoChat = async (post) => {
    try {
      await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'compartilhado', media_url: post.photo_url, shared_checkin_id: post.id });
      setTopTab('batepapo');
    } catch (e) { console.error('[uniko-fit] compartilhar:', e); }
  };

  // Apagar post (só o dono) — RLS já permite delete em uniko_fit_checkins;
  // reações/comentários somem sozinhos (FK ON DELETE CASCADE).
  const apagarPost = async (post) => {
    if (post.player !== name) return;
    if (!window.confirm('Apagar esse post? Essa ação não pode ser desfeita.')) return;
    try {
      await supabase.from('uniko_fit_checkins').delete().eq('id', post.id);
      setFeed(prev => prev ? prev.filter(p => p.id !== post.id) : prev);
      setFullFeed(prev => prev ? prev.filter(p => p.id !== post.id) : prev);
    } catch (e) { console.error('[uniko-fit] apagar post:', e); }
  };

  // Duplo toque numa foto do feed = curtir automaticamente (estilo Instagram/TikTok).
  // Detecção manual (não `onDoubleClick` nativo) pra funcionar igual em toque e mouse.
  const lastTapRef = useRef({ id: null, t: 0 });
  const [heartBurst, setHeartBurst] = useState(null); // id do post com o coração animando
  const handlePostTap = (post) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === post.id && now - last.t < 320) {
      lastTapRef.current = { id: null, t: 0 };
      const cur = reacoes[post.id];
      if (!cur?.mine) toggleReacao(post.id, REACOES[0].emoji);
      setHeartBurst(post.id);
      setTimeout(() => setHeartBurst(h => (h === post.id ? null : h)), 700);
    } else {
      lastTapRef.current = { id: post.id, t: now };
    }
  };

  // ── Ir pro Para Você e mostrar um post específico lá (usado pelo Meu Perfil/Amigos) ──
  const feedItemRefs = useRef({});
  const [highlightPostId, setHighlightPostId] = useState(null);
  const [flashPostId, setFlashPostId] = useState(null);
  const irParaFeed = async (post) => {
    setSheet(null); setDetalhesPlayer(null);
    setTopTab('paravoce');
    const jaTem = feedRef.current?.some(p => p.id === post.id);
    if (!jaTem) {
      const { data } = await supabase.from('uniko_fit_checkins').select('*').eq('id', post.id).single();
      if (data) setFeed(prev => (prev && !prev.some(p => p.id === data.id)) ? [data, ...prev] : prev);
    }
    setHighlightPostId(post.id);
  };
  useEffect(() => {
    if (topTab !== 'paravoce' || !highlightPostId) return;
    const id = highlightPostId;
    const el = feedItemRefs.current[id];
    if (el) {
      el.scrollIntoView({ block: 'start' });
      setFlashPostId(id);
      setHighlightPostId(null);
      setTimeout(() => setFlashPostId(f => (f === id ? null : f)), 1200);
    }
  }, [topTab, highlightPostId, feed]);

  // ── Puxar pra baixo recarrega o feed, estilo TikTok/Instagram ──
  const feedScrollRef = useRef(null);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartYRef = useRef(null);
  const onFeedTouchStart = (e) => {
    pullStartYRef.current = (feedScrollRef.current?.scrollTop || 0) <= 0 ? e.touches[0].clientY : null;
  };
  const onFeedTouchMove = (e) => {
    if (pullStartYRef.current == null || refreshing) return;
    const dy = e.touches[0].clientY - pullStartYRef.current;
    if (dy > 0 && (feedScrollRef.current?.scrollTop || 0) <= 0) setPullY(Math.min(dy * 0.5, 90));
  };
  const onFeedTouchEnd = async () => {
    if (pullY > 58 && !refreshing) {
      setRefreshing(true);
      await loadFeed();
      setRefreshing(false);
    }
    setPullY(0);
    pullStartYRef.current = null;
  };
  const recarregarFeed = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  // ── Comentários (drawer por post) ──
  const [comentAberto, setComentAberto] = useState(null);
  const [comentLista, setComentLista] = useState([]);
  const [comentLoading, setComentLoading] = useState(false);
  const [comentTexto, setComentTexto] = useState('');

  const abrirComentarios = async (post) => {
    setComentAberto(post); setComentLista([]); setComentLoading(true); setComentTexto('');
    const { data } = await supabase.from('uniko_fit_comments').select('*').eq('checkin_id', post.id).order('created_at', { ascending: true });
    setComentLista(data || []);
    ensurePhotos((data || []).map(c => c.player));
    setComentLoading(false);
  };
  const enviarComentario = async () => {
    const texto = comentTexto.trim();
    if (!texto || !comentAberto) return;
    setComentTexto('');
    const { data, error } = await supabase.from('uniko_fit_comments').insert({ checkin_id: comentAberto.id, player: name, texto }).select().single();
    if (!error && data) {
      setComentLista(prev => [...prev, data]);
      setComentCount(prev => ({ ...prev, [comentAberto.id]: (prev[comentAberto.id] || 0) + 1 }));
    }
  };
  // Apaga um comentário — quem comentou OU o dono do post pode apagar.
  const apagarComentario = async (c) => {
    try {
      await supabase.from('uniko_fit_comments').delete().eq('id', c.id);
      setComentLista(prev => prev.filter(x => x.id !== c.id));
      setComentCount(prev => ({ ...prev, [c.checkin_id]: Math.max(0, (prev[c.checkin_id] || 1) - 1) }));
    } catch (e) { console.error('[uniko-fit] apagar comentário:', e); }
  };

  // ── Curtidas (drawer por post — segura o coração pra ver quem curtiu) ──
  const [curtidasAberto, setCurtidasAberto] = useState(null); // post selecionado, null = fechado
  const [curtidasLista, setCurtidasLista] = useState(null);   // null = carregando
  const abrirCurtidas = async (post) => {
    setCurtidasAberto(post); setCurtidasLista(null);
    const { data } = await supabase.from('uniko_fit_reactions').select('*').eq('checkin_id', post.id).order('created_at', { ascending: false });
    setCurtidasLista(data || []);
    ensurePhotos((data || []).map(r => r.player));
  };
  // Segurar o coração ~480ms mostra a lista; um toque curto continua
  // curtindo/descurtindo normal (mesmo `toggleReacao` de sempre) — o timer
  // decide qual das duas ação aconteceu no soltar.
  const heartHoldRef = useRef(null);
  const iniciarSegurarCoracao = (post) => (e) => {
    e.stopPropagation();
    const estado = { fired: false, timer: null };
    estado.timer = setTimeout(() => { estado.fired = true; abrirCurtidas(post); }, 480);
    heartHoldRef.current = estado;
  };
  const soltarCoracao = (post) => (e) => {
    e.stopPropagation();
    const estado = heartHoldRef.current;
    if (!estado) return; // já tratado — pointerup E pointerleave costumam disparar pro mesmo toque
    clearTimeout(estado.timer);
    heartHoldRef.current = null;
    if (!estado.fired) toggleReacao(post.id, REACOES[0].emoji);
  };

  /* ═══════════════════ POSTAR FOTO (Check-In ou Postar no Feed) ═══════════════════ */
  const [postFile, setPostFile] = useState(null);
  const [postPreview, setPostPreview] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  const [postSaving, setPostSaving] = useState(false);
  const [postMsg, setPostMsg] = useState('');
  const postFileRef = useRef(null);

  // Check-in é 1 por dia (dia em UTC, mesmo critério usado pelo ranking/"dias
  // distintos"). `null` = ainda não checou, `true`/`false` = já sabe a resposta.
  const [checkinHojeFeito, setCheckinHojeFeito] = useState(null);
  const [checkinHojeDesafioId, setCheckinHojeDesafioId] = useState(null); // id da pose já cumprida hoje (se teve)
  const [desafioAtivo, setDesafioAtivo] = useState(null); // pose escolhida na aba Desafios pra "levar" pro check-in
  const limitesDeHoje = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    return { start, end };
  };
  const verificarCheckinHoje = useCallback(async () => {
    setCheckinHojeFeito(null);
    const { start, end } = limitesDeHoje();
    const { data } = await supabase.from('uniko_fit_checkins').select('id,desafio_pose_id').eq('player', name).eq('kind', 'checkin').gte('created_at', start).lt('created_at', end).limit(1);
    setCheckinHojeFeito(!!data?.length);
    setCheckinHojeDesafioId(data?.[0]?.desafio_pose_id || null);
  }, [name]);
  /* ═══════════════════ NOTIFICAÇÃO PUSH NO CELULAR (comentário/reação/chat, com o app fechado) ═══════════════════ */
  const [pushBannerOff, setPushBannerOff] = useState(() => { try { return localStorage.getItem('uniko_fit_push_banner_off') === '1'; } catch { return false; } });
  const [pushMsg, setPushMsg] = useState('');
  // null = ainda checando (não decide nada enquanto isso, evita o banner
  // "piscar" antes de saber). NÃO usa `Notification.permission==='granted'`
  // pra isso — o Portal já pede permissão de notificação em geral no 1º
  // toque em QUALQUER lugar do app (ver desktopNotify.js), sem relação com
  // o Web Push do Uniko FIT. Checar só a permissão escondia o botão achando
  // (errado) que já tinha inscrição — bug real, ninguém nunca se inscrevia
  // de verdade. `hasActivePushSubscription` confere a inscrição de verdade.
  const [pushJaInscrito, setPushJaInscrito] = useState(null);
  useEffect(() => { hasActivePushSubscription().then(setPushJaInscrito); }, []);
  const dispensarPushBanner = () => { setPushBannerOff(true); try { localStorage.setItem('uniko_fit_push_banner_off', '1'); } catch { /* localStorage indisponível */ } };
  const ativarPush = async () => {
    setPushMsg('');
    try { await ensurePushSubscription(name); setPushJaInscrito(true); dispensarPushBanner(); setPushMsg('✅ Notificações ativadas!'); }
    catch (e) { setPushMsg('❌ ' + (e.message || 'Erro ao ativar')); }
    setTimeout(() => setPushMsg(''), 6000);
  };
  // O botão fica sempre visível (até ativar ou dispensar) — os motivos de não
  // dar certo (iPhone sem instalar, navegador sem suporte, permissão negada)
  // só se sabe tentando: `ensurePushSubscription` lança um erro claro pra
  // cada caso, mostrado em `pushMsg`.
  const mostrarBannerPush = !pushBannerOff && pushJaInscrito === false;

  const [poseZoom, setPoseZoom] = useState(null); // pose com a foto aberta em tela grande (Desafios), null = fechado
  const [chatImgZoom, setChatImgZoom] = useState(null); // url da foto de check-in aberta em tela grande (Bate-Papo), null = fechado
  const abrirCheckinComDesafio = (pose) => {
    setDesafioAtivo(pose);
    // A pose vira uma TAG colorida no card do feed (ver render do "Para Você"),
    // não mais o texto da legenda — a legenda continua livre pra pessoa escrever
    // o que quiser (ou deixar em branco).
    openSheet('checkin');
  };

  const postIsVideo = !!postFile?.type?.startsWith('video/');
  const escolherFoto = (f) => {
    setPostFile(f || null); setPostMsg('');
    if (!f) { setPostPreview(null); return; }
    if (f.type.startsWith('video/')) { setPostPreview(URL.createObjectURL(f)); return; } // vídeo: prévia via blob URL, sem carregar tudo em base64
    const reader = new FileReader();
    reader.onload = (e) => setPostPreview(e.target.result);
    reader.readAsDataURL(f);
  };
  const limparPost = () => {
    if (postPreview?.startsWith('blob:')) { try { URL.revokeObjectURL(postPreview); } catch { /* já liberado */ } }
    setPostFile(null); setPostPreview(null); setPostCaption(''); setPostMsg(''); setDesafioAtivo(null); if (postFileRef.current) postFileRef.current.value = '';
  };

  // kind: 'checkin' (1 por dia, conta pro ranking + avisa no Bate-Papo) | 'post' (só feed, sem limite)
  const postarFoto = async (kind) => {
    if (!postFile) { setPostMsg(kind === 'post' ? '⚠️ Escolha uma foto ou vídeo pra continuar!' : '⚠️ Escolha uma foto pra continuar!'); return; }
    setPostSaving(true); setPostMsg('');
    try {
      if (kind === 'checkin') {
        // Confere de novo na hora de enviar (evita brecha se o sheet ficou aberto
        // de um dia pro outro, ou de outra aba); o índice único no banco cobre
        // a corrida de "duas abas ao mesmo tempo" (ver catch do 23505 abaixo).
        const { start, end } = limitesDeHoje();
        const { data: jaFez } = await supabase.from('uniko_fit_checkins').select('id').eq('player', name).eq('kind', 'checkin').gte('created_at', start).lt('created_at', end).limit(1);
        if (jaFez?.length) { setCheckinHojeFeito(true); setPostMsg('⚠️ Você já fez o check-in de hoje! Volte amanhã 💪'); setPostSaving(false); return; }
      }
      const ext = (postFile.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('uniko-fit-fotos').upload(path, postFile, { contentType: postFile.type || undefined, upsert: false });
      if (upErr) throw new Error('Falha ao enviar a foto: ' + upErr.message);
      const { data: pub } = supabase.storage.from('uniko-fit-fotos').getPublicUrl(path);
      const { error } = await supabase.from('uniko_fit_checkins').insert({ player: name, photo_url: pub.publicUrl, caption: postCaption.trim() || null, kind, desafio_pose_id: kind === 'checkin' ? (desafioAtivo?.id || null) : null });
      if (error) {
        if (error.code === '23505') { setCheckinHojeFeito(true); throw new Error('Você já fez o check-in de hoje! Volte amanhã 💪'); }
        throw new Error(error.message);
      }
      if (kind === 'checkin') {
        setCheckinHojeFeito(true);
        setCheckinHojeDesafioId(desafioAtivo?.id || null);
        if (desafioAtivo) setDesafiosHistorico(null); // invalida o cache do histórico (aba Desafios)
        // Quando o check-in cumpre o desafio do dia, o aviso no chat mostra
        // qual foi (ver render de `tipo==='checkin'` no Bate-Papo: usa
        // `m.texto` quando presente pra trocar "fez check-in" por "fez o
        // desafio: <texto>").
        try { await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'checkin', media_url: pub.publicUrl, texto: desafioAtivo?.texto || null }); } catch { /* aviso no chat é cortesia, não bloqueia o check-in */ }
      }
      setPostMsg(kind === 'checkin' ? '✅ Check-in registrado! Bora treinar mais 💪' : '✅ Postado no feed!');
      setFullFeed(null); // invalida cache do ranking/detalhes pra refletir o novo item
      await loadFeed();
      setTimeout(() => { limparPost(); setSheet(null); setTopTab('paravoce'); }, 1100);
    } catch (e) { setPostMsg('❌ ' + (e.message || 'Erro ao postar')); }
    setPostSaving(false);
  };

  /* ═══════════════════ BATE-PAPO (texto, emoji, imagem, áudio, avisos de check-in) ═══════════════════ */
  const [chat, setChat] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [gravSeg, setGravSeg] = useState(0);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  const chatEndRef = useRef(null);
  const chatImgRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const gravTimerRef = useRef(null);

  const loadChat = useCallback(async () => {
    const { data } = await supabase.from('uniko_fit_chat').select('*').order('created_at', { ascending: false }).limit(100);
    const msgs = (data || []).slice().reverse();
    setChat(msgs);
    ensurePhotos(msgs.map(m => m.player));
  }, [ensurePhotos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChat();
    const ch = supabase.channel('uniko-fit-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_chat' }, ({ new: row }) => {
        setChat(prev => (prev && prev.some(m => m.id === row.id)) ? prev : [...(prev || []).slice(-200), row]);
        ensurePhotos([row.player]);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (topTab === 'batepapo') chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat, topTab]);
  useEffect(() => () => { clearInterval(gravTimerRef.current); try { mrRef.current?.stream?.getTracks?.().forEach(t => t.stop()); } catch { /* já parado */ } }, []);

  const enviarChatTexto = async () => {
    const texto = chatMsg.trim(); if (!texto) return;
    setChatMsg(''); setEmojiOpen(false);
    try { await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'texto', texto }); }
    catch (e) { console.error('[uniko-fit] chat:', e); }
  };
  const enviarChatImagem = async (file) => {
    if (!file) return;
    setEnviandoMidia(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/chat/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('uniko-fit-fotos').upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('uniko-fit-fotos').getPublicUrl(path);
      await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'imagem', media_url: pub.publicUrl });
    } catch (e) { console.error('[uniko-fit] chat imagem:', e); }
    setEnviandoMidia(false);
    if (chatImgRef.current) chatImgRef.current.value = '';
  };
  const enviarChatAudio = async (blob) => {
    setEnviandoMidia(true);
    try {
      const cpf = (getAuthUser()?.cpf || '').replace(/\D/g, '') || 'anon';
      const path = `${cpf}/chat/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage.from('uniko-fit-fotos').upload(path, blob, { contentType: 'audio/webm' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('uniko-fit-fotos').getPublicUrl(path);
      await supabase.from('uniko_fit_chat').insert({ player: name, tipo: 'audio', media_url: pub.publicUrl });
    } catch (e) { console.error('[uniko-fit] chat áudio:', e); }
    setEnviandoMidia(false);
  };

  // Apagar mensagem própria (texto, imagem ou áudio) do Bate-Papo.
  const apagarChatMsg = async (m) => {
    if (m.player !== name) return;
    try {
      await supabase.from('uniko_fit_chat').delete().eq('id', m.id);
      setChat(prev => prev ? prev.filter(x => x.id !== m.id) : prev);
    } catch (e) { console.error('[uniko-fit] apagar mensagem:', e); }
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 400) await enviarChatAudio(blob);
      };
      mr.start();
      mrRef.current = mr;
      setGravando(true); setGravSeg(0);
      gravTimerRef.current = setInterval(() => setGravSeg(s => s + 1), 1000);
    } catch (e) { console.error('[uniko-fit] mic:', e); alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.'); }
  };
  const pararGravacao = () => {
    mrRef.current?.stop();
    clearInterval(gravTimerRef.current);
    setGravando(false);
  };

  /* ═══════════════════ RANKING & DETALHES (leitura completa e paginada) ═══════════════════ */
  const [fullFeed, setFullFeed] = useState(null); // null = ainda não carregado

  const loadFullFeed = useCallback(async () => {
    // Pagina de verdade (o Supabase corta em 1000/request — mesma lição do bug
    // do "mês sumia" na Máquina do Tempo). Trava de segurança em 6000 linhas
    // pra não sobrecarregar o navegador em instalações muito antigas.
    const PAGE = 1000; let from = 0; const rows = []; let pages = 0;
    for (;;) {
      const { data, error } = await supabase.from('uniko_fit_checkins')
        .select('id,player,kind,photo_url,caption,created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      rows.push(...data);
      pages++;
      if (data.length < PAGE || pages >= 6) break;
      from += PAGE;
    }
    setFullFeed(rows);
    ensurePhotos(rows.map(r => r.player));
  }, [ensurePhotos]);

  const openSheet = (id) => {
    setSheet(id);
    if ((id === 'ranking' || id === 'amigos' || id === 'desafios') && !fullFeed) loadFullFeed();
    if (id === 'checkin' || id === 'desafios') verificarCheckinHoje();
  };

  const [rankPeriodo, setRankPeriodo] = useState('mes'); // mes | total
  const rankingData = useMemo(() => {
    if (!fullFeed) return null;
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Conta DIAS distintos com check-in (não linhas cruas) — assim spammar várias
    // fotos no mesmo dia não infla o ranking. "Checkin diário" é o que conta.
    const diasTotal = {}, diasMes = {};
    fullFeed.forEach(r => {
      if (r.kind !== 'checkin') return;
      const dia = (r.created_at || '').slice(0, 10);
      if (!diasTotal[r.player]) diasTotal[r.player] = new Set();
      diasTotal[r.player].add(dia);
      if (dia.slice(0, 7) === curMonth) {
        if (!diasMes[r.player]) diasMes[r.player] = new Set();
        diasMes[r.player].add(dia);
      }
    });
    const total = {}, mes = {};
    Object.entries(diasTotal).forEach(([p, s]) => { total[p] = s.size; });
    Object.entries(diasMes).forEach(([p, s]) => { mes[p] = s.size; });
    return { total, mes };
  }, [fullFeed]);

  const [detalhesPlayer, setDetalhesPlayer] = useState(null); // nome selecionado (null = lista)
  const detalhesLista = useMemo(() => {
    if (!fullFeed) return null;
    const map = {};
    fullFeed.forEach(r => {
      const e = map[r.player] || (map[r.player] = { player: r.player, dias: new Set(), items: [] });
      if (r.kind === 'checkin') e.dias.add((r.created_at || '').slice(0, 10));
      e.items.push(r);
    });
    return Object.values(map)
      .map(e => ({ player: e.player, checkinCount: e.dias.size, items: e.items }))
      .sort((a, b) => b.checkinCount - a.checkinCount || b.items.length - a.items.length);
  }, [fullFeed]);

  /* ═══════════════════ DESAFIOS — pose de hoje, minha + da galera ═══════════════════ */
  // Poses extras cadastradas pelo admin (Dashboard RH → aba "Uniko FIT",
  // tabela uniko_fit_poses_custom) somam com as fixas do array POSES. Busca
  // uma vez ao abrir o app — a lista raramente muda e todo mundo precisa
  // enxergar a MESMA lista pra `poseDoDia` bater entre clientes.
  const [posesExtras, setPosesExtras] = useState([]);
  // Fotos que sobrescrevem uma pose FIXA específica (mesmo admin, tabela
  // uniko_fit_poses_overrides — chave = id da pose em POSES). Ganha do
  // `sprite` original quando presente (ver `PoseThumb`: `image_url` primeiro).
  const [posesOverrides, setPosesOverrides] = useState({});
  useEffect(() => {
    (async () => {
      const [{ data: extras }, { data: overrides }] = await Promise.all([
        supabase.from('uniko_fit_poses_custom').select('*').eq('ativo', true).order('created_at', { ascending: true }),
        supabase.from('uniko_fit_poses_overrides').select('*'),
      ]);
      setPosesExtras(extras || []);
      const map = {}; (overrides || []).forEach(o => { map[o.pose_id] = o.image_url; });
      setPosesOverrides(map);
    })();
  }, []);
  const posesTodas = useMemo(() => [
    ...POSES.map(p => posesOverrides[p.id] ? { ...p, image_url: posesOverrides[p.id] } : p),
    ...posesExtras,
  ], [posesExtras, posesOverrides]);
  // Pose por id — usado pra achar o TEXTO da pose de um check-in no feed
  // (tag colorida) e no histórico dos Desafios, sem precisar refazer a busca.
  const posesPorId = useMemo(() => Object.fromEntries(posesTodas.map(p => [p.id, p])), [posesTodas]);

  const meuDesafioHoje = useMemo(() => poseDoDia(name, undefined, posesTodas), [name, posesTodas]);
  // "Galera" = todo mundo que já postou/checou-in alguma vez (mesma fonte do
  // Amigos) — cada um com a pose de HOJE calculada na hora, sem precisar de
  // tabela/consulta nova (é só o `poseDoDia` de novo, com outro nome).
  const desafiosGalera = useMemo(() => {
    if (!detalhesLista) return null;
    return detalhesLista.map(p => ({ player: p.player, pose: poseDoDia(p.player, undefined, posesTodas) })).filter(x => x.player !== name);
  }, [detalhesLista, name, posesTodas]);

  // Sub-aba "Histórico" dentro de Desafios: check-ins passados que marcaram
  // algum desafio (desafio_pose_id preenchido). Carrega só quando a pessoa
  // abre essa sub-aba (não pesa o carregamento normal da aba Desafios).
  const [desafioSubTab, setDesafioSubTab] = useState('hoje'); // hoje | historico
  const [desafiosHistorico, setDesafiosHistorico] = useState(null); // null = ainda não carregado
  const carregarHistoricoDesafios = useCallback(async () => {
    const { data } = await supabase.from('uniko_fit_checkins')
      .select('id,photo_url,created_at,desafio_pose_id')
      .eq('player', name).eq('kind', 'checkin').not('desafio_pose_id', 'is', null)
      .order('created_at', { ascending: false }).limit(100);
    setDesafiosHistorico(data || []);
  }, [name]);
  useEffect(() => {
    if (sheet === 'desafios' && desafioSubTab === 'historico' && !desafiosHistorico) carregarHistoricoDesafios();
  }, [sheet, desafioSubTab, desafiosHistorico, carregarHistoricoDesafios]);

  /* ═══════════════════ MEU PERFIL (meus posts + engajamento) ═══════════════════ */
  // Reaproveita o mesmo `fullFeed` paginado do ranking/amigos (carrega uma vez só).
  useEffect(() => {
    if (topTab === 'meuperfil' && !fullFeed) loadFullFeed();
  }, [topTab, fullFeed, loadFullFeed]);

  const meusItens = useMemo(() => fullFeed ? fullFeed.filter(r => r.player === name) : null, [fullFeed, name]);

  const [meuEngaj, setMeuEngaj] = useState({}); // itemId -> {likes, comments}
  useEffect(() => {
    if (!meusItens || !meusItens.length) return;
    const ids = meusItens.map(r => r.id);
    (async () => {
      const [reacRes, comRes] = await Promise.all([
        supabase.from('uniko_fit_reactions').select('checkin_id').in('checkin_id', ids),
        supabase.from('uniko_fit_comments').select('checkin_id').in('checkin_id', ids),
      ]);
      const map = {};
      ids.forEach(id => { map[id] = { likes: 0, comments: 0 }; });
      (reacRes.data || []).forEach(r => { if (map[r.checkin_id]) map[r.checkin_id].likes++; });
      (comRes.data || []).forEach(c => { if (map[c.checkin_id]) map[c.checkin_id].comments++; });
      setMeuEngaj(map);
    })();
  }, [meusItens]);

  const meuResumo = useMemo(() => {
    if (!meusItens) return null;
    const dias = new Set();
    let posts = 0, totalLikes = 0, totalComments = 0;
    meusItens.forEach(it => {
      if (it.kind === 'checkin') dias.add((it.created_at || '').slice(0, 10)); else posts++;
      const e = meuEngaj[it.id];
      if (e) { totalLikes += e.likes; totalComments += e.comments; }
    });
    return { checkinDias: dias.size, posts, totalLikes, totalComments };
  }, [meusItens, meuEngaj]);

  /* ═══════════════════ NOTIFICAÇÕES (curtidas/comentários nas minhas fotos) ═══════════════════ */
  // Guarda o CONJUNTO DE IDs já lidos (não um "timestamp de última vez que
  // abriu"): comparar string ISO do client (`toISOString()`, milissegundo,
  // sufixo "Z") com o `created_at` que volta do Postgres (microssegundo,
  // sufixo "+00:00") é frágil — em notificações muito próximas no tempo a
  // comparação de string pode dar errado e a marcação "não persiste" depois
  // de recarregar. IDs são exatos, sem esse risco.
  const notifReadKeyRef = useRef(`uniko_fit_notif_read_${(getAuthUser()?.cpf || 'anon').replace(/\D/g, '')}`);
  const [notifs, setNotifs] = useState(null); // null = ainda não carregado
  const [notifReadIds, setNotifReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(notifReadKeyRef.current)) || []); } catch { return new Set(); }
  });

  const loadNotifs = useCallback(async () => {
    const { data: meus } = await supabase.from('uniko_fit_checkins').select('id,photo_url').eq('player', name);
    const meusRows = meus || [];
    const fotoDoItem = {}; meusRows.forEach(m => { fotoDoItem[m.id] = m.photo_url; });
    const ids = meusRows.map(m => m.id);
    if (!ids.length) { setNotifs([]); return; }
    const [reacRes, comRes] = await Promise.all([
      supabase.from('uniko_fit_reactions').select('*').in('checkin_id', ids).neq('player', name).order('created_at', { ascending: false }).limit(80),
      supabase.from('uniko_fit_comments').select('*').in('checkin_id', ids).neq('player', name).order('created_at', { ascending: false }).limit(80),
    ]);
    const likes = (reacRes.data || []).map(r => ({ id: `like-${r.id}`, kind: 'like', player: r.player, photo_url: fotoDoItem[r.checkin_id], emoji: r.emoji, created_at: r.created_at }));
    const coms  = (comRes.data || []).map(c => ({ id: `com-${c.id}`, kind: 'comment', player: c.player, photo_url: fotoDoItem[c.checkin_id], texto: c.texto, created_at: c.created_at }));
    const merged = [...likes, ...coms].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
    setNotifs(merged);
    ensurePhotos(merged.map(n => n.player));
  }, [name, ensurePhotos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifs();
    // Tempo real de verdade (mesmo padrão do canal do feed/chat): curtida ou
    // comentário novo em QUALQUER check-in recarrega a lista na hora — antes
    // só o poll de 25s cobria isso, e por não filtrar no canal se é check-in
    // seu (o filtro fica em `loadNotifs`, do lado do servidor) é mais simples
    // só reagir a qualquer INSERT nessas duas tabelas.
    const ch = supabase.channel('uniko-fit-mynotifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_reactions' }, () => loadNotifs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_comments' }, () => loadNotifs())
      .subscribe();
    const poll = setInterval(loadNotifs, 25000); // leve, fallback se o realtime cair
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── "Acordar" quando volta pro app (celular instalado): no iPhone, o iOS
  // suspende JS/rede do app em segundo plano — a conexão de tempo real do
  // chat e os `setInterval` de polling (feed/notificações) ficam pausados e
  // não retomam sozinhos de forma confiável ao voltar. Sem isso, só
  // atualizava fechando e abrindo o app de novo. `visibilitychange` dispara
  // certinho ao voltar pro app mesmo quando timers não disparam; refaz a
  // busca de tudo que é "ao vivo" na hora.
  useEffect(() => {
    const acordar = () => { if (document.visibilityState === 'visible') { loadFeed(); loadChat(); loadNotifs(); } };
    document.addEventListener('visibilitychange', acordar);
    window.addEventListener('focus', acordar);
    return () => { document.removeEventListener('visibilitychange', acordar); window.removeEventListener('focus', acordar); };
  }, [loadFeed, loadChat, loadNotifs]);

  const notifUnreadCount = useMemo(() => (notifs || []).filter(n => !notifReadIds.has(n.id)).length, [notifs, notifReadIds]);
  const abrirNotificacoes = () => setSheet('notif');
  const fecharNotificacoes = () => setSheet(null);
  // Marca como lido ao SAIR da tela de notificações — não ao abrir, pra dar
  // tempo de ver o destaque de "novo" enquanto olha a lista.
  const notifsRef = useRef(notifs);
  useEffect(() => { notifsRef.current = notifs; }, [notifs]);
  const marcarNotifsComoLidas = useCallback(() => {
    const lista = notifsRef.current;
    if (!lista?.length) return;
    setNotifReadIds(prev => {
      const next = new Set(prev);
      lista.forEach(n => next.add(n.id));
      try { localStorage.setItem(notifReadKeyRef.current, JSON.stringify([...next])); } catch { /* localStorage indisponível */ }
      return next;
    });
  }, []);
  // Só o cleanup do effect (roda ao trocar de sheet/desmontar) NÃO é
  // suficiente: um RELOAD da página não passa pelo ciclo de desmontagem do
  // React a tempo — o navegador mata o JS antes da limpeza rodar — então a
  // marcação nunca era salva se a pessoa recarregasse com a tela ainda
  // aberta. `visibilitychange`/`pagehide` disparam de verdade nesse
  // momento (é pra isso que existem), então viram outro gatilho de
  // gravação, além do cleanup e do botão manual (ver `marcarNotifsComoLidas`
  // logo abaixo, no header da sheet).
  useEffect(() => {
    if (sheet !== 'notif') return;
    const onHide = () => { if (document.visibilityState === 'hidden') marcarNotifsComoLidas(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', marcarNotifsComoLidas);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', marcarNotifsComoLidas);
      marcarNotifsComoLidas();
    };
  }, [sheet, marcarNotifsComoLidas]);

  /* ═══════════════════ UI ═══════════════════ */
  // "Desafios" tirado TEMPORARIAMENTE da barra (a pedido) — só escondido, o
  // resto (código da sheet, tabela de histórico, tag no feed, aviso no chat)
  // continua intacto pra religar rapidinho depois, é só voltar essa linha.
  const BOTTOM_BTNS = [
    { id: 'checkin',  label: 'Check-In',       icon: IcoCamera },
    // { id: 'desafios', label: 'Desafios',       icon: IcoTarget },
    { id: 'ranking',  label: 'Ranking',        icon: IcoTrophy },
    { id: 'post',     label: 'Postar no Feed', icon: IcoPost },
    { id: 'notif',    label: 'Notificações',   icon: IcoBell },
    { id: 'amigos',   label: 'Amigos',         icon: IcoInfo },
  ];

  // Cabeçalho (topbar + abas) e barra inferior são `position:fixed` ANCORADOS NA
  // TELA DE VERDADE — não dependem do fluxo/scroll do container. Isso é proposital:
  // no celular, se o conteúdo rolar ou a pessoa der pinch-zoom, um `flexShrink:0`
  // dentro do fluxo normal pode ser arrastado junto; `fixed` garante que as barras
  // fiquem sempre grudadas na tela, entre uma área e outra do Uniko Fit.
  // `env(safe-area-inset-top)` só existe DE VERDADE quando o app roda "instalado"
  // (adicionado à Tela de Início no iPhone) — no Safari normal a barra de
  // endereço já empurra o conteúdo, então isso vira 0px e não muda nada. Sem
  // isso, o topbar nasce embaixo do relógio/notch (some atrás dele) quando
  // instalado — foi exatamente esse o bug reportado.
  const HEADER_H = 'calc(94px + env(safe-area-inset-top, 0px))'; // topbar 50 + abas 44 + notch
  const FOOTER_H = 'calc(60px + env(safe-area-inset-bottom, 0px))';

  return (
    <div className="fit-root" style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: T.page, fontFamily: 'var(--font-body)', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(0,0,0,.08)' }}>
      <style>{FIT_CSS}</style>

      {/* ── Cabeçalho fixo: topbar + abas (Para Você / Bate-Papo / Meu Perfil) ── */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 60,
        paddingTop: 'env(safe-area-inset-top, 0px)', background: T.topbarBg || cardBg }}>
        <div style={{ height: 50, background: T.topbarBg || cardBg, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 10px 0 6px', gap: 6, boxShadow: `0 1px 16px ${ENERGIA}18`, boxSizing: 'border-box' }}>
          <button onClick={onBack} className="fit-btn" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: T.textS, fontSize: 12.5, fontFamily: 'var(--font-body)', padding: '6px 7px', borderRadius: 7 }}>
            {IcoBack} Módulos
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ color: ENERGIA, display: 'flex' }}>{IcoFit}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: 'var(--font-brand)', letterSpacing: '.02em' }}>Uniko FIT</span>
          <div style={{ flex: 1 }} />
          <AvatarCircle name={userName} photo={userPhoto} size={28} fontSize={10} />
        </div>

        {/* Abas centralizadas */}
        <div style={{ height: 44, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, background: cardBg, borderBottom: `1px solid ${T.border}` }}>
          {[['paravoce', 'Para Você'], ['batepapo', 'Bate-Papo'], ['meuperfil', 'Meu Perfil']].map(([id, label]) => {
            const on = topTab === id;
            // Clicar de novo na aba Para Você já ativa recarrega o feed, estilo TikTok.
            return (
              <button key={id} onClick={() => (id === 'paravoce' && on) ? recarregarFeed() : setTopTab(id)} className="fit-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 1px 9px', fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--font-brand)', whiteSpace: 'nowrap',
                  color: on ? ENERGIA : T.textT, borderBottom: on ? `3px solid ${ENERGIA}` : '3px solid transparent' }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Conteúdo (rola independente, entre o cabeçalho e a barra fixos) ── */}
      <div style={{ position: 'absolute', top: HEADER_H, left: 0, right: 0, bottom: FOOTER_H, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Aviso pra ativar notificação push no celular — sticky, aparece em qualquer aba até ativar/dispensar ── */}
        {mostrarBannerPush && (
          <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: `${ENERGIA}14`, borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
            {IcoBell}
            <div style={{ flex: 1, color: T.text, lineHeight: 1.35 }}>Ative pra receber comentário, reação e mensagem do Bate-Papo direto no celular.</div>
            <button onClick={ativarPush} className="fit-btn"
              style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: ENERGIA, color: '#fff', fontWeight: 700, fontSize: 11.5, fontFamily: 'var(--font-body)' }}>Ativar</button>
            <button onClick={dispensarPushBanner} title="Dispensar" style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: T.textT, padding: 4, display: 'flex' }}>{IcoClose}</button>
          </div>
        )}
        {pushMsg && (
          <div style={{ position: 'sticky', top: 0, zIndex: 5, padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, background: pushMsg.startsWith('✅') ? 'rgba(34,197,94,.12)' : 'rgba(192,64,80,.1)', color: pushMsg.startsWith('✅') ? '#16a34a' : '#C04050' }}>{pushMsg}</div>
        )}

        {/* ── PARA VOCÊ (feed unificado: check-ins + posts) ── */}
        {topTab === 'paravoce' && (
          feed === null ? (
            <div style={{ textAlign: 'center', padding: 60, color: T.textT, fontSize: 13 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${ENERGIA}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
              Carregando o feed...
            </div>
          ) : feed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🏋️</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>Ainda ninguém postou nada</div>
              <div style={{ fontSize: 13, color: T.textT, marginBottom: 16 }}>Seja o primeiro a fazer check-in! 💪</div>
              <button className="fit-btn" onClick={() => openSheet('checkin')}
                style={{ padding: '10px 22px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: `0 6px 18px ${EG}` }}>📸 Fazer check-in</button>
            </div>
          ) : (
            <div ref={feedScrollRef} className="fit-feed" onTouchStart={onFeedTouchStart} onTouchMove={onFeedTouchMove} onTouchEnd={onFeedTouchEnd}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
              {(pullY > 0 || refreshing) && (
                <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5, opacity: Math.min((pullY || 40) / 58, 1), transition: refreshing ? 'none' : 'opacity .15s' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: cardBg, boxShadow: '0 2px 10px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${ENERGIA}`, borderTopColor: 'transparent', animation: refreshing ? 'spin .7s linear infinite' : 'none', transform: refreshing ? 'none' : `rotate(${pullY * 3}deg)` }} />
                  </div>
                </div>
              )}
              {feed.map(post => {
                const r = reacoes[post.id] || { counts: {}, mine: null };
                const totalReacoes = Object.values(r.counts).reduce((a, b) => a + b, 0);
                const souDono = post.player === name;
                return (
                  <div key={post.id} ref={el => { if (el) feedItemRefs.current[post.id] = el; }} onClick={() => handlePostTap(post)}
                    className="fit-card" style={{ position: 'relative', width: '100%', height: '100%', background: '#111',
                      boxShadow: flashPostId === post.id ? `inset 0 0 0 3px ${ENERGIA}` : 'none', transition: 'box-shadow .3s' }}>
                    {isVideoUrl(post.photo_url)
                      ? <FeedVideo src={post.photo_url} muted={feedMuted} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <img src={post.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.18) 0%, transparent 26%, transparent 55%, rgba(0,0,0,.85) 100%)' }} />

                    {heartBurst === post.id && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <svg className="fit-heart-burst" width="92" height="92" viewBox="0 0 24 24" fill="#fff" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.45))' }}>
                          <path d="M12 21s-7.5-4.6-10-9.1C.4 8.3 2 4.5 5.7 4c2-.3 3.6.7 4.9 2.3C11.9 4.7 13.5 3.7 15.5 4c3.7.5 5.3 4.3 3.7 7.9C21.5 16.4 12 21 12 21z" />
                        </svg>
                      </div>
                    )}

                    {post.kind === 'checkin' && (
                      <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999,
                        background: `${ENERGIA}E6`, color: '#fff', fontSize: 11, fontWeight: 800 }}>{IcoCheckCircle} Check-in</div>
                    )}

                    {souDono && (
                      <button onClick={e => { e.stopPropagation(); apagarPost(post); }} className="fit-btn" title="Apagar post"
                        style={{ position: 'absolute', top: 12, right: 14, width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(0,0,0,.45)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IcoTrash}</button>
                    )}

                    {isVideoUrl(post.photo_url) && (
                      <button onClick={e => { e.stopPropagation(); setFeedMuted(m => !m); }} className="fit-btn" title={feedMuted ? 'Ativar som' : 'Silenciar'}
                        style={{ position: 'absolute', top: souDono ? 52 : 12, right: 14, width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(0,0,0,.45)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{feedMuted ? IcoVolOff : IcoVolOn}</button>
                    )}

                    <div style={{ position: 'absolute', left: 14, right: 68, bottom: 16, color: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                        <img src={photos[post.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{post.player.split(' ').slice(0, 2).join(' ')}</div>
                          <div style={{ fontSize: 10.5, opacity: .85 }}>{tempoRelativo(post.created_at)}</div>
                        </div>
                      </div>
                      {post.desafio_pose_id && posesPorId[post.desafio_pose_id] && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, marginBottom: 6,
                          background: corDaTagPose(post.desafio_pose_id), color: '#fff', fontSize: 11, fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>
                          {posesPorId[post.desafio_pose_id].texto}
                        </div>
                      )}
                      {post.caption && <div style={{ fontSize: 14.5, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{post.caption}</div>}
                    </div>

                    <div style={{ position: 'absolute', right: 8, top: '62%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13 }}>
                      {REACOES.map(rc => {
                        const ativo = r.mine === (rc.emoji || rc.id);
                        const emojiKey = rc.emoji || rc.id;
                        const n = r.counts[emojiKey] || 0;
                        return (
                          <button key={rc.id} className="fit-btn" title={rc.label} onContextMenu={e => e.preventDefault()}
                            onPointerDown={iniciarSegurarCoracao(post)} onPointerUp={soltarCoracao(post)} onPointerLeave={soltarCoracao(post)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', touchAction: 'manipulation' }}>
                            <div className={ativo ? 'fit-pop' : undefined} key={ativo ? `${post.id}-${rc.id}-on` : `${post.id}-${rc.id}-off`}
                              style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                                background: ativo ? `${ENERGIA}E6` : 'rgba(0,0,0,.35)', boxShadow: ativo ? `0 0 0 2px #fff` : 'none' }}>
                              {rc.img ? <img src={rc.img} alt="" style={{ width: 25, height: 25, objectFit: 'contain' }} /> : rc.svg}
                            </div>
                            {n > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{n}</span>}
                          </button>
                        );
                      })}
                      <button className="fit-btn" onClick={e => { e.stopPropagation(); abrirComentarios(post); }} title="Comentários"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'rgba(0,0,0,.35)' }}>{IcoComment}</div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{comentCount[post.id] || 0}</span>
                      </button>
                      <button className="fit-btn" onClick={e => { e.stopPropagation(); compartilharNoChat(post); }} title="Compartilhar no Bate-Papo"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'rgba(0,0,0,.35)' }}>{IcoShare}</div>
                      </button>
                      {totalReacoes > 0 && <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)' }}>{totalReacoes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── BATE-PAPO (chat global: texto, emoji, imagem, áudio, avisos de check-in) ── */}
        {topTab === 'batepapo' && (
          <>
            <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chat === null ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Carregando chat...</div>
              ) : chat.length === 0 ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Nenhuma mensagem ainda. Chama a galera pra treinar! 💪</div>
              ) : chat.map(m => {
                if (m.tipo === 'checkin') {
                  const souEu = m.player === name;
                  return (
                    <div key={m.id} style={{ alignSelf: 'center', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: '6px 0', maxWidth: 200 }}>
                      {souEu && (
                        <button onClick={() => apagarChatMsg(m)} className="fit-btn" title="Apagar"
                          style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
                            background: T.surfaceSub || 'rgba(0,0,0,.08)', color: T.textD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IcoTrash}</button>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textS, background: T.surfaceSub || 'rgba(0,0,0,.04)', padding: '5px 13px', borderRadius: 999, textAlign: 'center', border: `1px solid ${T.border}` }}>
                        {m.texto
                          ? <>🎯 <b style={{ color: ENERGIA }}>{m.player.split(' ')[0]}</b> fez o desafio: <b>{m.texto}</b> às {horaCurta(m.created_at)}</>
                          : <>✅ <b style={{ color: ENERGIA }}>{m.player.split(' ')[0]}</b> fez check-in às {horaCurta(m.created_at)}</>}
                      </div>
                      {m.media_url && (
                        <img src={m.media_url} alt="" onClick={() => setChatImgZoom(m.media_url)} role="button" aria-label="Ver foto em tela grande"
                          style={{ width: 110, height: 110, borderRadius: 14, objectFit: 'cover', border: `2px solid ${ENERGIA}`, cursor: 'pointer' }} />
                      )}
                    </div>
                  );
                }
                const eu = m.player === name;
                if (m.tipo === 'compartilhado') {
                  const ehVideo = isVideoUrl(m.media_url);
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: eu ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                      <img src={photos[m.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                      <div style={{ maxWidth: '74%' }}>
                        {!eu && <div style={{ fontSize: 10, fontWeight: 700, color: T.textT, marginBottom: 2 }}>{m.player.split(' ')[0]}</div>}
                        <div onClick={() => irParaFeed({ id: m.shared_checkin_id })} role="button" aria-label="Ver post compartilhado"
                          style={{ borderRadius: eu ? '14px 3px 14px 14px' : '3px 14px 14px 14px', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.04)' }}>
                          {m.media_url && (ehVideo
                            ? <FeedVideo src={m.media_url} muted style={{ width: 190, height: 150, objectFit: 'cover', display: 'block' }} />
                            : <img src={m.media_url} alt="" style={{ width: 190, height: 150, objectFit: 'cover', display: 'block' }} />)}
                          <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: T.text }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>
                            {ehVideo ? 'Vídeo compartilhado' : 'Foto compartilhada'}
                          </div>
                        </div>
                      </div>
                      {eu && (
                        <button onClick={() => apagarChatMsg(m)} className="fit-btn" title="Apagar mensagem"
                          style={{ alignSelf: 'center', border: 'none', background: 'none', cursor: 'pointer', color: T.textD, padding: 4, flexShrink: 0, display: 'flex' }}>{IcoTrash}</button>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: eu ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    <img src={photos[m.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                    <div style={{ maxWidth: '74%' }}>
                      {!eu && <div style={{ fontSize: 10, fontWeight: 700, color: T.textT, marginBottom: 2 }}>{m.player.split(' ')[0]}</div>}
                      <div style={{ padding: m.tipo === 'texto' ? '8px 12px' : 5, borderRadius: eu ? '14px 3px 14px 14px' : '3px 14px 14px 14px',
                        background: eu ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.04)'), overflow: 'hidden' }}>
                        {m.tipo === 'texto' && <span style={{ fontSize: 13, lineHeight: 1.4, color: eu ? '#fff' : T.text }}>{m.texto}</span>}
                        {m.tipo === 'imagem' && <img src={m.media_url} alt="" style={{ maxWidth: 190, maxHeight: 240, display: 'block', borderRadius: 10, objectFit: 'cover' }} />}
                        {m.tipo === 'audio' && <audio controls preload="none" src={m.media_url} style={{ width: 210, height: 32 }} />}
                      </div>
                    </div>
                    {eu && (
                      <button onClick={() => apagarChatMsg(m)} className="fit-btn" title="Apagar mensagem"
                        style={{ alignSelf: 'center', border: 'none', background: 'none', cursor: 'pointer', color: T.textD, padding: 4, flexShrink: 0, display: 'flex' }}>{IcoTrash}</button>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Emoji picker */}
            {emojiOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, padding: '10px 12px', borderTop: `1px solid ${T.border}`, background: cardBg, maxHeight: 160, overflowY: 'auto' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setChatMsg(t => t + e)} className="fit-btn" style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }}>{e}</button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderTop: `1px solid ${T.border}`, background: cardBg, flexShrink: 0 }}>
              {gravando ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 999, background: 'rgba(220,50,50,.08)', border: '1.5px solid rgba(220,50,50,.35)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#DC3232', animation: 'fitPulse 1s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, color: '#C82C2C', fontWeight: 700 }}>Gravando... {String(Math.floor(gravSeg / 60)).padStart(2, '0')}:{String(gravSeg % 60).padStart(2, '0')}</span>
                </div>
              ) : (
                <>
                  <button onClick={() => setEmojiOpen(o => !o)} className="fit-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: emojiOpen ? ENERGIA : T.textS, padding: 6, display: 'flex', flexShrink: 0 }}>{IcoSmile}</button>
                  <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onFocus={() => setEmojiOpen(false)} onKeyDown={e => e.key === 'Enter' && enviarChatTexto()}
                    placeholder="Escreva uma mensagem..." maxLength={400} disabled={enviandoMidia}
                    style={{ flex: 1, minWidth: 0, padding: '9px 13px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.page || '#fff', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
                  <input ref={chatImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => enviarChatImagem(e.target.files?.[0] || null)} />
                  <button onClick={() => chatImgRef.current?.click()} disabled={enviandoMidia} className="fit-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textS, padding: 6, display: 'flex', flexShrink: 0, opacity: enviandoMidia ? .5 : 1 }}>{IcoImg}</button>
                </>
              )}
              <button onClick={gravando ? pararGravacao : (chatMsg.trim() ? enviarChatTexto : iniciarGravacao)} disabled={enviandoMidia}
                className="fit-btn" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
                  background: gravando ? '#DC3232' : (chatMsg.trim() ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.06)')),
                  color: gravando ? '#fff' : (chatMsg.trim() ? '#fff' : T.textS),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: enviandoMidia ? .5 : 1 }}>
                {gravando ? IcoStop : (chatMsg.trim() ? IcoSend : IcoMic)}
              </button>
            </div>
          </>
        )}

        {/* ── MEU PERFIL (meus posts + engajamento) ── */}
        {topTab === 'meuperfil' && (
          !meuResumo ? (
            <div style={{ textAlign: 'center', padding: 60, color: T.textT, fontSize: 13 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${ENERGIA}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', margin: '0 auto 10px' }} />
              Carregando seu perfil...
            </div>
          ) : (
            <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 14px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <img src={photos[name] || userPhoto || '/UNIKO_NEW.png'} alt="" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${ENERGIA}` }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{userName}</div>
                  <div style={{ fontSize: 11.5, color: T.textT }}>{meuResumo.checkinDias} check-in{meuResumo.checkinDias !== 1 ? 's' : ''} · {meuResumo.posts} post{meuResumo.posts !== 1 ? 's' : ''} no feed</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                <div style={{ background: `${ENERGIA}12`, border: `1px solid ${ENERGIA}33`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: ENERGIA, display: 'flex', alignItems: 'center', gap: 6 }}>{IcoHeartSm} {meuResumo.totalLikes}</div>
                  <div style={{ fontSize: 11, color: T.textT, marginTop: 2 }}>curtidas no total</div>
                </div>
                <div style={{ background: `${ENERGIA}12`, border: `1px solid ${ENERGIA}33`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: ENERGIA, display: 'flex', alignItems: 'center', gap: 6 }}>{IcoCommentSm} {meuResumo.totalComments}</div>
                  <div style={{ fontSize: 11, color: T.textT, marginTop: 2 }}>comentários no total</div>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textS, marginBottom: 8 }}>Frequência de treinos</div>
                <CheckinCalendar items={meusItens} energia={ENERGIA} label="Você treinou" />
              </div>

              {!meusItens.length ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: T.textT, fontSize: 13 }}>Você ainda não postou nada. Bora fazer seu primeiro check-in! 💪</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textS, marginBottom: 8 }}>Meus posts</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                    {meusItens.map(it => <ThumbCell key={it.id} it={it} engaj={meuEngaj[it.id]} onClick={() => irParaFeed(it)} onDelete={apagarPost} />)}
                  </div>
                </>
              )}
            </div>
          )
        )}
      </div>

      {/* ── Barra inferior fixa: 5 ações (ancorada na tela de verdade, ver comentário do HEADER_H) ── */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 60, display: 'flex', borderTop: `1px solid ${T.border}`, background: cardBg, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {BOTTOM_BTNS.map(b => (
          <button key={b.id} onClick={() => b.id === 'notif' ? abrirNotificacoes() : openSheet(b.id)} className="fit-btn"
            style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 2px 8px', background: 'none', border: 'none', cursor: 'pointer', color: T.textS }}>
            <span style={{ position: 'relative', color: ENERGIA, display: 'flex' }}>
              {b.icon}
              {b.id === 'notif' && notifUnreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -6, minWidth: 15, height: 15, padding: '0 3px', borderRadius: '50%', background: '#DC3232', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${cardBg}` }}>
                  {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-body)' }}>{b.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ SHEETS ══════════════ */}

      {/* ── Check-In / Postar no Feed ── */}
      {(sheet === 'checkin' || sheet === 'post') && (
        <Sheet title={sheet === 'checkin' ? 'Registrar treino 📸' : 'Postar no feed 🖼️'} onClose={() => { setSheet(null); limparPost(); }}>
          {sheet === 'checkin' && checkinHojeFeito === null ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Verificando...</div>
          ) : sheet === 'checkin' && checkinHojeFeito ? (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>Você já fez check-in hoje!</div>
              <div style={{ fontSize: 12.5, color: T.textT, lineHeight: 1.5 }}>O check-in é 1 por dia — volta amanhã pra registrar o próximo treino. Se quiser postar mais fotos hoje, use "Postar no Feed" (não conta ranking, mas fica lá do mesmo jeito 💪).</div>
            </div>
          ) : (
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 14, lineHeight: 1.5 }}>
              {sheet === 'checkin'
                ? 'Manda uma foto comprovando que você treinou — conta ponto no ranking do dia e avisa todo mundo no Bate-Papo! (1 check-in por dia)'
                : 'Compartilhe uma foto ou vídeo no feed "Para Você" — não conta pro ranking de check-in, é só pra galera ver.'}
            </div>

            {sheet === 'checkin' && desafioAtivo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, marginBottom: 14, background: `${ENERGIA}12`, border: `1px solid ${ENERGIA}44` }}>
                <PoseThumb pose={desafioAtivo} size={40} round={9} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.text, lineHeight: 1.4 }}><b style={{ color: ENERGIA }}>Desafio de hoje:</b> {desafioAtivo.texto}</div>
                <button onClick={() => setDesafioAtivo(null)} className="fit-btn" title="Remover desafio" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textD, padding: 4, flexShrink: 0, display: 'flex' }}>{IcoClose}</button>
              </div>
            )}

            {sheet === 'checkin' ? (
              // Check-in só aceita foto tirada na hora pelo próprio Uniko FIT (sem
              // galeria) — pedido explícito, evita gente postando foto velha/de outra
              // pessoa. Tem escolha de filtro de cor antes de confirmar.
              postPreview ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '4/5', background: '#111' }}>
                    <img src={postPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <button className="fit-btn" onClick={() => { setPostFile(null); setPostPreview(null); }}
                    style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: `1.5px solid ${T.border}`, background: 'none', color: T.textS, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>↺ Tirar outra foto</button>
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <CameraCapture energia={ENERGIA} onCapture={(file, url) => { setPostFile(file); setPostPreview(url); }} />
                </div>
              )
            ) : (
              <>
                <input ref={postFileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => escolherFoto(e.target.files?.[0] || null)} />
                {postPreview ? (
                  <div onClick={() => postFileRef.current?.click()} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', marginBottom: 14, aspectRatio: '4/5', background: '#111' }}>
                    {postIsVideo
                      ? <video src={postPreview} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <img src={postPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '5px 11px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>Trocar {postIsVideo ? 'vídeo' : 'foto'}</div>
                  </div>
                ) : (
                  <button className="fit-btn" onClick={() => postFileRef.current?.click()}
                    style={{ width: '100%', aspectRatio: '4/5', borderRadius: 14, border: `2px dashed ${ENERGIA}66`, background: `${ENERGIA}0a`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                    <div style={{ fontSize: 38 }}>📷🎬</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ENERGIA }}>Escolher foto ou vídeo</div>
                  </button>
                )}
              </>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textS, marginBottom: 5 }}>Legenda (opcional)</div>
              <textarea value={postCaption} onChange={e => setPostCaption(e.target.value)} placeholder="Como foi hoje?" rows={3} maxLength={220}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.page || '#fff', fontSize: 13,
                  color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>

            {postMsg && <div style={{ fontSize: 12.5, marginBottom: 12, padding: '8px 13px', borderRadius: 8,
              color: postMsg.startsWith('✅') ? '#16a34a' : '#C04050', background: postMsg.startsWith('✅') ? 'rgba(34,197,94,.08)' : 'rgba(192,64,80,.06)' }}>{postMsg}</div>}

            <button className="fit-btn" onClick={() => postarFoto(sheet)} disabled={postSaving || !postFile}
              style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14,
                cursor: (postSaving || !postFile) ? 'not-allowed' : 'pointer', opacity: (postSaving || !postFile) ? .55 : 1,
                background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, boxShadow: (postSaving || !postFile) ? 'none' : `0 6px 18px ${EG}` }}>
              {postSaving ? 'Enviando...' : (sheet === 'checkin' ? '🔥 Registrar check-in' : '🖼️ Postar no feed')}
            </button>
          </div>
          )}
        </Sheet>
      )}

      {/* ── Desafios: pose diária individual (não repete na semana) ── */}
      {sheet === 'desafios' && (
        <Sheet title="Desafios 🎯" onClose={() => setSheet(null)}>
          <div style={{ padding: '14px 16px 0' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4, justifyContent: 'center' }}>
              {[['hoje', 'Desafio de hoje'], ['historico', 'Histórico']].map(([id, label]) => {
                const sel = desafioSubTab === id;
                return (
                  <button key={id} className="fit-btn" onClick={() => setDesafioSubTab(id)}
                    style={{ padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                      border: `1.5px solid ${sel ? ENERGIA : T.border}`, background: sel ? `${ENERGIA}16` : 'transparent', color: sel ? ENERGIA : T.textS }}>{label}</button>
                );
              })}
            </div>
          </div>

          {desafioSubTab === 'hoje' ? (
            <div style={{ padding: '16px 16px 24px' }}>
              <div style={{ background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, borderRadius: 16, padding: '18px 20px', marginBottom: 18, color: '#fff', boxShadow: `0 8px 24px ${EG}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', opacity: .9, marginBottom: 6 }}>SEU DESAFIO DE HOJE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div onClick={() => setPoseZoom(meuDesafioHoje)} role="button" aria-label="Ver foto do desafio em tela grande"
                    style={{ background: 'rgba(255,255,255,.2)', borderRadius: 14, padding: 4, cursor: 'pointer' }}>
                    <PoseThumb pose={meuDesafioHoje} size={64} round={11} />
                  </div>
                  <div style={{ flex: 1, fontFamily: 'var(--font-brand)', fontSize: 15, fontWeight: 800, lineHeight: 1.35 }}>{meuDesafioHoje.texto}</div>
                </div>
                {checkinHojeFeito && checkinHojeDesafioId === meuDesafioHoje.id ? (
                  <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>✅ Desafio concluído hoje!</div>
                ) : checkinHojeFeito ? (
                  <div style={{ marginTop: 12, fontSize: 11.5, opacity: .9 }}>Você já fez o check-in de hoje sem marcar esse desafio — vale igual, relaxa 💪</div>
                ) : (
                  <button className="fit-btn" onClick={() => abrirCheckinComDesafio(meuDesafioHoje)}
                    style={{ marginTop: 12, width: '100%', padding: 11, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(255,255,255,.22)', color: '#fff', fontWeight: 800, fontSize: 13 }}>📸 Fazer check-in com esse desafio</button>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: T.textT, marginBottom: 12, lineHeight: 1.5 }}>Cada pessoa tem uma pose diferente por dia, e ela nunca se repete na mesma semana. Olha o que a galera tem que fazer hoje:</div>

              {!desafiosGalera ? (
                <div style={{ textAlign: 'center', padding: 30, color: T.textT, fontSize: 13 }}>Carregando...</div>
              ) : desafiosGalera.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: T.textT, fontSize: 13 }}>Ainda não tem mais ninguém pra mostrar aqui.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {desafiosGalera.map(d => (
                    <div key={d.player} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
                      <img src={photos[d.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.player.split(' ').slice(0, 2).join(' ')}</div>
                      <PoseThumb pose={d.pose} size={38} round={9} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px 16px 24px' }}>
              {!desafiosHistorico ? (
                <div style={{ textAlign: 'center', padding: 30, color: T.textT, fontSize: 13 }}>Carregando...</div>
              ) : desafiosHistorico.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
                  <div style={{ fontSize: 13, color: T.textT }}>Você ainda não marcou nenhum desafio num check-in.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {desafiosHistorico.map(h => {
                    const pose = posesPorId[h.desafio_pose_id];
                    return (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
                        {pose ? <PoseThumb pose={pose} size={40} round={9} /> : <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: 'rgba(128,128,128,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>❓</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{pose ? pose.texto : 'Pose removida'}</div>
                          <div style={{ fontSize: 10.5, color: T.textT, marginTop: 2 }}>{new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {horaCurta(h.created_at)}</div>
                        </div>
                        {h.photo_url && (isVideoUrl(h.photo_url)
                          ? <video src={h.photo_url} muted style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          : <img src={h.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Sheet>
      )}

      {/* ── Ranking ── */}
      {sheet === 'ranking' && (
        <Sheet title="Ranking 🏆" onClose={() => setSheet(null)}>
          <div style={{ padding: '16px 16px 24px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {[['mes', 'Este mês'], ['total', 'Todos os tempos']].map(([id, label]) => {
                const sel = rankPeriodo === id;
                return (
                  <button key={id} className="fit-btn" onClick={() => setRankPeriodo(id)}
                    style={{ padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-body)',
                      border: `1.5px solid ${sel ? ENERGIA : T.border}`, background: sel ? `${ENERGIA}16` : 'transparent', color: sel ? ENERGIA : T.textS }}>{label}</button>
                );
              })}
            </div>

            {!rankingData ? (
              <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando ranking...</div>
            ) : (() => {
              const mapa = rankPeriodo === 'mes' ? rankingData.mes : rankingData.total;
              const lista = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
              if (!lista.length) return (
                <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>
                  Ninguém treinou {rankPeriodo === 'mes' ? 'este mês' : 'ainda'}. Bora ser o primeiro! 💪
                </div>
              );
              const medalha = ['🥇', '🥈', '🥉'];
              const lider = lista[0];
              return (
                <>
                  <div style={{ background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, borderRadius: 16, padding: '16px 18px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 8px 24px ${EG}`, color: '#fff' }}>
                    <img src={photos[lider[0]] || '/UNIKO_NEW.png'} alt="" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', opacity: .9 }}>🏆 {rankPeriodo === 'mes' ? 'ATLETA DO MÊS' : 'MAIOR RATO DE ACADEMIA'}</div>
                      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800 }}>{lider[0].split(' ').slice(0, 2).join(' ')}</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{lider[1]}<span style={{ fontSize: 10.5, fontWeight: 600, opacity: .85 }}> dias</span></div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lista.map(([player, n], i) => (
                      <div key={player} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
                        <div style={{ width: 24, textAlign: 'center', fontSize: i < 3 ? 17 : 12.5, fontWeight: 800, color: T.textT, flexShrink: 0 }}>{medalha[i] || i + 1}</div>
                        <img src={photos[player] || '/UNIKO_NEW.png'} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: ENERGIA, background: `${ENERGIA}12`, borderRadius: 7, padding: '3px 9px', flexShrink: 0 }}>{n} dia{n !== 1 ? 's' : ''}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </Sheet>
      )}

      {/* ── Notificações: curtidas e comentários nas minhas fotos ── */}
      {sheet === 'notif' && (
        <Sheet title="Notificações 🔔" onClose={fecharNotificacoes}>
          {!notifs ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando...</div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
              <div style={{ fontSize: 13, color: T.textT }}>Ninguém curtiu ou comentou suas fotos ainda.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifUnreadCount > 0 && (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={marcarNotifsComoLidas} className="fit-btn"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: ENERGIA, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', padding: 4 }}>
                    ✓ Marcar como lida
                  </button>
                </div>
              )}
              {notifs.map(n => {
                const naoLida = !notifReadIds.has(n.id);
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${T.border}`, background: naoLida ? `${ENERGIA}0e` : 'transparent' }}>
                    <img src={photos[n.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.4 }}>
                        <b>{n.player.split(' ').slice(0, 2).join(' ')}</b>{' '}
                        {n.kind === 'like' ? <>curtiu sua foto {n.emoji || '💪'}</> : <>comentou: <span style={{ color: T.textS }}>&ldquo;{(n.texto || '').slice(0, 60)}{(n.texto || '').length > 60 ? '…' : ''}&rdquo;</span></>}
                      </div>
                      <div style={{ fontSize: 10.5, color: T.textT, marginTop: 2 }}>{tempoRelativo(n.created_at)}</div>
                    </div>
                    {n.photo_url && (
                      isVideoUrl(n.photo_url)
                        ? <video src={n.photo_url} muted style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        : <img src={n.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}

      {/* ── Amigos: lista de pessoas + perfil individual ── */}
      {sheet === 'amigos' && (
        <Sheet title={detalhesPlayer ? detalhesPlayer.split(' ').slice(0, 2).join(' ') : 'Amigos 👥'}
          onBack={detalhesPlayer ? () => setDetalhesPlayer(null) : undefined}
          onClose={() => { setSheet(null); setDetalhesPlayer(null); }}>
          {!detalhesLista ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textT, fontSize: 13 }}>Carregando...</div>
          ) : !detalhesPlayer ? (
            <div style={{ padding: '10px 14px 20px' }}>
              <div style={{ fontSize: 12, color: T.textT, marginBottom: 12 }}>{detalhesLista.length} pessoa{detalhesLista.length !== 1 ? 's' : ''} já postaram no Uniko FIT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detalhesLista.map(p => (
                  <div key={p.player} onClick={() => setDetalhesPlayer(p.player)} className="fit-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <img src={photos[p.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.player}</div>
                      <div style={{ fontSize: 11, color: T.textT }}>{p.checkinCount} check-in{p.checkinCount !== 1 ? 's' : ''} · {p.items.length} post{p.items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: -6 }}>
                      {p.items.slice(0, 3).map((it, i) => (
                        isVideoUrl(it.photo_url)
                          ? <video key={it.id} src={it.photo_url} muted style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                          : <img key={it.id} src={it.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (() => {
            const p = detalhesLista.find(x => x.player === detalhesPlayer);
            if (!p) return null;
            return (
              <div style={{ padding: '10px 14px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <img src={photos[p.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${ENERGIA}` }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{p.player}</div>
                    <div style={{ fontSize: 11.5, color: T.textT }}>{p.checkinCount} check-in{p.checkinCount !== 1 ? 's' : ''} · {p.items.length} post{p.items.length !== 1 ? 's' : ''} no total</div>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textS, marginBottom: 8 }}>Frequência de treinos</div>
                  <CheckinCalendar items={p.items} energia={ENERGIA} label={`${p.player.split(' ')[0]} treinou`} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                  {p.items.map(it => <ThumbCell key={it.id} it={it} />)}
                </div>
              </div>
            );
          })()}
        </Sheet>
      )}

      {/* ── Comentários (drawer por post do feed) ── */}
      {comentAberto && (
        <div onClick={() => setComentAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,6,10,.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="fit-pop" style={{ background: cardBg, borderRadius: '20px 20px 0 0', border: `1px solid ${T.border}`,
            width: '100%', maxWidth: 480, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>💬 Comentários</div>
              <button onClick={() => setComentAberto(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comentLoading ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 10 }}>Carregando...</div>
              ) : comentLista.length === 0 ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 10 }}>Seja o primeiro a comentar!</div>
              ) : comentLista.map(c => {
                const podeApagar = c.player === name || comentAberto?.player === name;
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <img src={photos[c.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{c.player.split(' ')[0]} <span style={{ fontWeight: 500, color: T.textD, fontSize: 10.5 }}>· {tempoRelativo(c.created_at)}</span></div>
                      <div style={{ fontSize: 13, color: T.textS, lineHeight: 1.4 }}>{c.texto}</div>
                    </div>
                    {podeApagar && (
                      <button onClick={() => apagarComentario(c)} className="fit-btn" title="Apagar comentário"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textD, padding: 4, flexShrink: 0, display: 'flex' }}>{IcoTrash}</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${T.border}` }}>
              <input value={comentTexto} onChange={e => setComentTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarComentario()}
                placeholder="Escreva um comentário..." maxLength={280}
                style={{ flex: 1, padding: '10px 13px', borderRadius: 999, border: `1.5px solid ${T.border}`, background: T.page || '#fff', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'var(--font-body)' }} />
              <button className="fit-btn" onClick={enviarComentario} disabled={!comentTexto.trim()}
                style={{ padding: '9px 18px', borderRadius: 999, border: 'none', cursor: comentTexto.trim() ? 'pointer' : 'default',
                  background: comentTexto.trim() ? `linear-gradient(135deg, ${ENERGIA}, ${FOGO})` : (T.surfaceSub || 'rgba(0,0,0,.06)'), color: '#fff', fontWeight: 700, fontSize: 12.5,
                  opacity: comentTexto.trim() ? 1 : .5 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Curtidas (drawer por post — segurar o coração) ── */}
      {curtidasAberto && (
        <div onClick={() => setCurtidasAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,6,10,.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="fit-pop" style={{ background: cardBg, borderRadius: '20px 20px 0 0', border: `1px solid ${T.border}`,
            width: '100%', maxWidth: 480, maxHeight: '72vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 40px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>{IcoHeartSm} Curtidas</div>
              <button onClick={() => setCurtidasAberto(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textS, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="fit-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column' }}>
              {curtidasLista === null ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Carregando...</div>
              ) : curtidasLista.length === 0 ? (
                <div style={{ textAlign: 'center', color: T.textT, fontSize: 12.5, marginTop: 20 }}>Ninguém curtiu ainda.</div>
              ) : curtidasLista.map(r => (
                <div key={`${r.player}-${r.checkin_id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
                  <img src={photos[r.player] || '/UNIKO_NEW.png'} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{r.player}</div>
                  <span style={{ color: ENERGIA, display: 'flex' }}>{IcoHeartSm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── Foto do desafio em tela grande (clique no thumb de "SEU DESAFIO DE HOJE") ── */}
      {poseZoom && (
        <div onClick={() => setPoseZoom(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer' }}>
          <button onClick={() => setPoseZoom(null)} aria-label="Fechar"
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          {poseZoom.image_url ? (
            <img src={poseZoom.image_url} alt={poseZoom.texto} onClick={e => e.stopPropagation()}
              style={{ maxWidth: '92%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }} />
          ) : poseZoom.sprite ? (
            <div onClick={e => e.stopPropagation()}
              style={{ width: 'min(88vw, 420px)', height: 'min(88vw, 420px)', borderRadius: 20, boxShadow: '0 12px 40px rgba(0,0,0,.5)',
                backgroundImage: `url(${POSE_SHEETS[poseZoom.sheet] || POSE_SHEETS.novas})`, backgroundSize: `${POSES_SPRITE_COLS * 100}% ${POSES_SPRITE_ROWS * 100}%`,
                backgroundPosition: `${poseZoom.sprite.col / (POSES_SPRITE_COLS - 1) * 100}% ${poseZoom.sprite.row / (POSES_SPRITE_ROWS - 1) * 100}%` }} />
          ) : (
            <div style={{ fontSize: 96 }}>{poseZoom.emoji}</div>
          )}
          <div style={{ marginTop: 16, color: '#fff', fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 700, textAlign: 'center', maxWidth: 340 }}>{poseZoom.emoji ? `${poseZoom.emoji} ` : ''}{poseZoom.texto}</div>
        </div>
      )}
      {/* ── Foto de check-in em tela grande (clique numa foto de aviso no Bate-Papo) ── */}
      {chatImgZoom && (
        <div onClick={() => setChatImgZoom(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer' }}>
          <button onClick={() => setChatImgZoom(null)} aria-label="Fechar"
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          {isVideoUrl(chatImgZoom)
            ? <video src={chatImgZoom} controls autoPlay onClick={e => e.stopPropagation()} style={{ maxWidth: '92%', maxHeight: '80vh', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }} />
            : <img src={chatImgZoom} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '92%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,.5)' }} />}
        </div>
      )}

      {/* ── Boas-vindas + regras de convivência (só na 1ª vez) ── */}
      {mostrarTermos && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,8,14,.72)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="fit-pop" style={{ background: cardBg, borderRadius: 20, maxWidth: 380, width: '100%', maxHeight: '86vh', overflowY: 'auto',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,.4)', border: `1px solid ${T.border}` }}>
            {[
              <div key="emoji" style={{ fontSize: 34, textAlign: 'center', marginBottom: 6 }}>💪</div>,
              <div key="titulo" style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, textAlign: 'center', marginBottom: 10 }}>Bem-vindo(a) ao Uniko FIT!</div>,
              <div key="intro" style={{ fontSize: 13, color: T.textS, lineHeight: 1.5, textAlign: 'center', marginBottom: 16 }}>Antes de continuar, um combinado rápido pra esse espaço ser bom pra todo mundo:</div>,
              <div key="r1" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 10, fontSize: 13, color: T.text, lineHeight: 1.4 }}><span style={{ color: ENERGIA, flexShrink: 0 }}>{IcoCheckCircle}</span>Não compartilhe indevidamente as fotos/vídeos daqui fora do Uniko FIT — nem "de zoeira".</div>,
              <div key="r2" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 10, fontSize: 13, color: T.text, lineHeight: 1.4 }}><span style={{ color: ENERGIA, flexShrink: 0 }}>{IcoCheckCircle}</span>Proibido qualquer tipo de discriminação ou preconceito.</div>,
              <div key="r3" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 10, fontSize: 13, color: T.text, lineHeight: 1.4 }}><span style={{ color: ENERGIA, flexShrink: 0 }}>{IcoCheckCircle}</span>Proibida intolerância religiosa.</div>,
              <div key="r4" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 10, fontSize: 13, color: T.text, lineHeight: 1.4 }}><span style={{ color: ENERGIA, flexShrink: 0 }}>{IcoCheckCircle}</span>Proibido racismo.</div>,
              <div key="fim" style={{ fontSize: 11.5, color: T.textT, textAlign: 'center', marginTop: 14 }}>Descumprir isso pode levar a advertência e remoção do app. Bora treinar com respeito! 🎯</div>,
            ].map((bloco, i) => <div key={bloco.key} style={{ animation: 'fitTermFade .5s ease both', animationDelay: `${i * 0.7}s` }}>{bloco}</div>)}

            <div style={{ marginTop: 20, textAlign: 'center', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {podeAceitarTermos ? (
                <button onClick={aceitarTermos} className="fit-btn fit-pop"
                  style={{ padding: '12px 30px', borderRadius: 999, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${ENERGIA}, ${FOGO})`, color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)' }}>
                  Estou de acordo
                </button>
              ) : (
                <div style={{ fontSize: 11, color: T.textT }}>Lendo...</div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default UnikoFit;
export { UnikoFit };
