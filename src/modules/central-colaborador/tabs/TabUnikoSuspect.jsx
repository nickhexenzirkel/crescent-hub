// src/modules/central-colaborador/tabs/TabUnikoSuspect.jsx
// UNIKO SUSPECT — jogo estilo Among Us (Tripulantes x Impostor). Admin-only
// enquanto constrói (gate em Sidebar.jsx + central-colaborador/index.jsx).
//
// FASE ATUAL: Lobby & salas + sorteio de papéis + mapa jogável (casa de praia,
// movimento livre, paredes/colisão aproximadas, câmera com zoom + iluminação,
// tela cheia). Ainda faltam: tarefas, matar, sabotagem, reuniões/votação,
// condições de vitória. Arquitetura igual aos outros jogos sem servidor
// (Uniko Paint / Uniko Stop): uma linha por sala em `uniko_suspect_state`
// (rodar supabase_uniko_suspect.sql), host eleito no cliente escreve o
// estado, presence pra saber quem está em qual sala.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { THEMES } from '../../../contexts/theme';
import { taskTypeFor } from '../../../shared/unikoDetetiveTarefas';

/* ── Tema LOCAL do Uniko Suspect: escuro, sempre (ago/2026) ──────────────────
   O jogo inteiro usa o `T` daqui, NÃO o `T` global do Portal — clima noturno
   combina com o jogo e nada de branco estoura a tela no meio da partida.
   Ser uma constante LOCAL (e não `applyTheme('blueDark')`) é de propósito: o
   `T` global é um objeto mutável e trocá-lo vazava o escuro pro Portal todo
   depois de sair (bug real que já aconteceu no Uniko FIT — a limpeza do
   unmount roda DEPOIS da próxima tela renderizar, então nada repintava).
   Assim o escuro fica contido aqui e não há o que restaurar na saída. */
const T = { surfaceW: 'rgba(255,255,255,0.97)', ...THEMES.blueDark };
import { supabase, getAuthUser, USER } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos } from '../../../shared/captureUniko';
import { getSkinVariations, hasAssistantSkin } from '../../../shared/assistantSkin';
import { embaralhar, sortearImpostores } from '../../../shared/unikoSuspectSorteio';

/* ── Paleta casa de praia ── */
const AGUA = '#0EA5B7', CEU = '#5FC9E8', AREIA = '#F2C879';
const IMPOSTOR_COR = '#DC2626', TRIPULANTE_COR = '#0EA5B7';
const AG = 'rgba(14,165,183,.35)';

const MIN_PLAYERS = 2;                 // temporário (testando) — subir de novo antes do lançamento
const ROOM_TTL_MS = 20 * 60 * 1000;    // sala vazia parada há 20min = lixo

/* ── Quem ainda está vivo, por time (ago/2026) ──────────────────────────────
   Conta TODO MUNDO que está na sala, não só os nomes que aparecem em
   `papeis`: quem entrou DEPOIS do sorteio fica sem papel, e o HUD já trata
   esse pessoal como Tripulante. Sem isso a partida podia terminar na
   PRIMEIRA morte achando que só existiam os 2 nomes sorteados — era esse o
   bug da sala com 5 pessoas que acabou com um único assassinato. */
/* Quem está VIVO em cada time. Conta só quem RECEBEU PAPEL no sorteio — a
   lista de presença (`players`) entrava aqui antes e qualquer pessoa que
   chegasse na sala DEPOIS do sorteio virava "tripulante vivo" sem papel
   nenhum, segurando o fim da partida (bug real: o último tripulante era
   expulso, virava fantasma e a tela de vitória nunca aparecia). `players`
   continua no parâmetro só pra não mudar a chamada de todo mundo. */
const vivosPorTime = (s) => {
  const papeis = s?.papeis || {};
  const fantasmas = s?.fantasmas || [];
  const vivos = Object.keys(papeis).filter(n => !fantasmas.includes(n));
  return {
    impostores: vivos.filter(n => papeis[n] === 'impostor'),
    tripulantes: vivos.filter(n => papeis[n] !== 'impostor'),
  };
};

/* ── Sabotagem: quem ainda deve conserto (ago/2026) ─────────────────────────
   Só TRIPULANTE VIVO conserta. Fantasma não entra na conta (pedido do
   usuário) — e como os mortos saem da lista, a sabotagem também precisa ser
   reavaliada quando alguém morre ou é expulso: se os que faltavam viraram
   fantasma, quem sobrou já consertou e a luz tem que voltar sozinha, senão a
   partida ficava no escuro até o conserto automático. */
const resolverSabotagem = (s) => {
  if (!s?.sabotagem) return s;
  const feito = s.sabotagem.consertadoPor || [];
  const tripulantesVivos = vivosPorTime(s).tripulantes;
  const completo = tripulantesVivos.length === 0 || tripulantesVivos.every(n => feito.includes(n));
  return completo ? { ...s, sabotagem: null } : s;
};

/* ── Regra de vitória (ago/2026) ────────────────────────────────────────────
   • Tripulantes vencem quando TODOS os impostores estão fora. Com 2+
     impostores, expulsar um NÃO termina o jogo (o outro segue solto).
   • Impostor(es) vencem quando NÃO SOBRA nenhum tripulante vivo.
   A regra era "impostores >= tripulantes" (a do Among Us) e foi trocada a
   pedido do usuário: numa sala de 2 pessoas o jogo acabava sozinho no
   primeiro segundo, com o impostor vencendo sem ter feito nada — e a mesma
   coisa acontecia numa sala de 3 assim que a primeira morte deixava 1x1.
   Agora o impostor precisa fechar a conta matando (ou fazendo expulsarem)
   o último tripulante.
   Retorna null enquanto o jogo continua. */
const decidirVencedor = (s) => {
  if (!s?.papeis || Object.keys(s.papeis).length === 0) return null;   // partida nem sorteada
  const { impostores, tripulantes } = vivosPorTime(s);
  if (impostores.length === 0) return 'tripulante';
  if (tripulantes.length === 0) return 'impostor';
  return null;
};

/* Cômodos da casa (só pra prévia/flavor no lobby da sala — o mapa em si agora é
   a ARTE `MAPA_IMG`, ver abaixo). */
const ROOMS = [
  { id: 'quarto',   nome: 'Quarto',                  emoji: '🛏️' },
  { id: 'banheiro', nome: 'Banheiro',                 emoji: '🚽' },
  { id: 'sala',     nome: 'Sala de Estar',           emoji: '🛋️' },
  { id: 'cozinha',  nome: 'Cozinha',                 emoji: '🍳' },
  { id: 'lavanderia', nome: 'Lavanderia',             emoji: '🧺' },
  { id: 'deposito', nome: 'Depósito',                 emoji: '📦' },
  { id: 'anexo',    nome: 'Anexos (escritório/game)', emoji: '🖥️' },
  { id: 'piscina',  nome: 'Varanda / Piscina',        emoji: '🏊' },
  { id: 'deck',     nome: 'Deck / Ancoradouro',       emoji: '🌅' },
];
const PIADAS = ['🦩 boia de flamingo', '💩 emoji clássico', '🥤 coca-cola da mãezinha'];

/* ── Mapa: a arte da casa de praia (gerada pelo usuário) vira o fundo. As
   UNIDADES DO MAPA são os próprios pixels da imagem (1672×941, 16:9) — cada
   ponto (x,y) de jogador é uma coordenada real da arte, sem conversão nenhuma. */
// `?v=` só muda quando a ARTE do mapa é trocada: o navegador cacheia por nome
// de arquivo e continuaria servindo o mapa velho pra quem já tinha aberto o
// jogo (mesma pegadinha que já deu com a máscara de parede). Ao subir um mapa
// novo, incremente a data aqui.
const MAPA_IMG = '/uniko-suspect-mapa.png?v=20260824';
const MAP_W = 1672, MAP_H = 941;

/* ── Barco do lobby (ago/2026): enquanto a sala tá na fase 'lobby', todo
   mundo entra automaticamente nesse mini-mapa (mesma resolução da arte
   da casa, 1672×941 — dá pra reusar MAP_W/MAP_H direto) com movimento
   livre igual ao jogo de verdade, só que a área andável é o convés do
   barco (aproximado por uma elipse, o barco é meio "olho" sem cantos
   retos). Vira uma "sala de espera" de verdade em vez de só uma lista. */
const BARCO_IMG = '/uniko-suspect-barco.png';
const BARCO_ELIPSE = { cx: 830, cy: 468, rx: 610, ry: 250 };   // convés andável, ajustar se alguém ficar preso/atravessando a amurada
const BARCO_MOVE_SPEED = 235;   // lobby é só espera/bagunça, então corre mais que na partida (era 150)
const BARCO_PLAYER_R = 85;   // bem maior que o boneco do mapa principal (pedido do usuário — só aqui no barco)
const estaNoBarco = (x, y) => {
  const nx = (x - BARCO_ELIPSE.cx) / BARCO_ELIPSE.rx;
  const ny = (y - BARCO_ELIPSE.cy) / BARCO_ELIPSE.ry;
  return nx * nx + ny * ny <= 1;
};

/* ── Paredes (colisão) ─────────────────────────────────────────────────────
   Cada item é um retângulo ANDÁVEL, em FRAÇÃO da imagem (0..1 × 0..1) — dá
   pra ler direto olhando a arte. O jogador só pode ficar num ponto que caia
   dentro de PELO MENOS UM desses retângulos; fora deles é "parede". Os
   corredores (`corredorV`/`corredorH`) são retângulos finos que ligam um
   cômodo ao outro, imitando as portas/aberturas desenhadas.
   Recalibrado (ago/2026) usando a imagem de referência com o contorno andável
   marcado em neon vermelho pelo usuário — mais fiel que a estimativa anterior,
   mas AINDA é uma aproximação por retângulos (a arte é isométrica, não um mapa
   2D reto). Se alguém ficar preso num lugar que devia ser andável, ou
   atravessar uma parede que devia bloquear, é só ajustar o retângulo daquele
   cômodo aqui (nomes descrevem o que cada um representa). */
const WALK_ZONES = [
  { id: 'quarto',     x0: 0.095, y0: 0.06,  x1: 0.33,  y1: 0.305 },
  { id: 'lavanderia', x0: 0.025, y0: 0.33,  x1: 0.25,  y1: 0.475 },
  { id: 'deposito',   x0: 0.015, y0: 0.49,  x1: 0.245, y1: 0.72  },
  { id: 'corredorV',  x0: 0.245, y0: 0.06,  x1: 0.335, y1: 0.72  }, // liga a coluna esquerda à sala
  { id: 'terraco',    x0: 0.325, y0: 0.02,  x1: 0.665, y1: 0.305 }, // deck superior (espreguiçadeiras + boia + geladeira)
  { id: 'cozinha',    x0: 0.655, y0: 0.06,  x1: 0.90,  y1: 0.305 },
  { id: 'sala',       x0: 0.315, y0: 0.28,  x1: 0.665, y1: 0.625 },
  { id: 'varanda',    x0: 0.685, y0: 0.335, x1: 0.94,  y1: 0.635 }, // varanda/piscina externa
  { id: 'corredorH',  x0: 0.37,  y0: 0.60,  x1: 0.665, y1: 0.665 }, // liga a sala à entrada/anexo
  { id: 'anexo',      x0: 0.685, y0: 0.635, x1: 0.905, y1: 0.855 },
  { id: 'entrada',    x0: 0.42,  y0: 0.775, x1: 0.605, y1: 0.975 }, // caminho do "WELCOME"
  { id: 'ancoradouro',x0: 0.895, y0: 0.60,  x1: 0.985, y1: 0.955 },
];
/* ── Máscara de parede (ago/2026) ────────────────────────────────────────
   As zonas retangulares acima resolvem "em que cômodo eu tô", mas dentro de
   cada retângulo (principalmente a `sala`, que é um cômodo grande e aberto)
   tem paredinhas/divisórias desenhadas na própria arte (as molduras penduradas
   entre sala/cozinha, sala/anexo etc.) que os retângulos não modelam — dava
   pra atravessar essas divisórias andando por cima. `uniko-suspect-wallmask.png`
   é um mapa preto-e-branco (branco = parede) do tamanho exato do mapa,
   GERADO a partir do contorno neon que o usuário desenhou em cima da arte
   (photoshop/IA) marcando toda parede/divisória — muito mais fiel que
   qualquer retângulo. `isWalkable` agora exige as DUAS coisas: estar dentro
   de alguma zona andável E não estar em cima de um pixel de parede. */
// `public/*` não ganha hash de build (não é processado pelo Vite) — o navegador
// cacheia a imagem pelo nome do arquivo e continuava servindo a máscara VELHA
// depois de eu corrigir e publicar uma nova (parecia "apaguei a parede e
// continua bloqueando", mas era só cache). Por isso a fonte de verdade agora
// é o Supabase (tabela `uniko_suspect_map`, editada em Dashboard RH → aba
// "Uniko Suspect"): cada "Salvar" no editor sobe um ARQUIVO NOVO no Storage
// (nome com timestamp), então nunca reusa uma URL cacheada — o arquivo
// estático abaixo só entra como fallback pra quem nunca salvou nada por lá.
const WALLMASK_FALLBACK = '/uniko-suspect-wallmask.png';
let _wallMaskData = null, _wallMaskW = 0, _wallMaskH = 0, _wallMaskLoading = false;
function loadWallMask(url) {
  const src = url || WALLMASK_FALLBACK;
  if (_wallMaskLoading) return;
  _wallMaskLoading = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';   // vem do Supabase Storage (outro domínio) — sem isso, getImageData quebra por canvas "manchado"
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);
      _wallMaskData = data; _wallMaskW = img.width; _wallMaskH = img.height;
    } catch (e) { console.error('[uniko-suspect] wallmask:', e); }
    _wallMaskLoading = false;
  };
  img.onerror = () => { _wallMaskLoading = false; };
  img.src = src;
}
async function loadWallMaskFromDB() {
  let url = null;
  try {
    const { data } = await supabase.from('uniko_suspect_map').select('wall_mask_url').eq('id', 1).maybeSingle();
    url = data?.wall_mask_url || null;
  } catch (e) { console.error('[uniko-suspect] uniko_suspect_map:', e); }
  loadWallMask(url);
}
const isWallPixel = (x, y) => {
  if (!_wallMaskData) return false;   // ainda carregando — só a zona retangular vale por enquanto
  const px = Math.max(0, Math.min(_wallMaskW - 1, Math.round(x * _wallMaskW / MAP_W)));
  const py = Math.max(0, Math.min(_wallMaskH - 1, Math.round(y * _wallMaskH / MAP_H)));
  return _wallMaskData[(py * _wallMaskW + px) * 4] > 128;   // canal R: 255 = parede
};
const isWalkable = (x, y) => {
  // Com a máscara carregada, ELA é a fonte de verdade (é o que o usuário pintou
  // à mão, pixel a pixel — muito mais fiel que os retângulos aproximados de
  // WALK_ZONES). Antes, as duas coisas eram exigidas AO MESMO TEMPO, então um
  // pedaço andável na máscara mas fora de algum retângulo aproximado ficava
  // bloqueado "por fantasma" (sem parede vermelha nenhuma ali). Os retângulos
  // agora só valem como fallback enquanto a máscara ainda não carregou.
  if (_wallMaskData) return !isWallPixel(x, y);
  const fx = x / MAP_W, fy = y / MAP_H;
  return WALK_ZONES.some(z => fx >= z.x0 && fx <= z.x1 && fy >= z.y0 && fy <= z.y1);
};

/* ── Tarefas (ago/2026) ───────────────────────────────────────────────────
   Cada tarefa é marcada no editor do Dashboard RH (Dashboard RH → Uniko
   Suspect → modo "Tarefas": tabela uniko_suspect_map, coluna `tasks`,
   [{id,label,x,y}]) — o ADMIN escolhe o NOME livre e a POSIÇÃO na hora de
   marcar. Aqui a gente casa o nome digitado com um MINI-JOGO específico
   (por normalização do texto: sem acento, minúsculo). Um nome que não bata
   com nenhum dos conhecidos cai no mini-jogo genérico ("segurar pra
   concluir") — assim o admin pode marcar tarefas novas no editor sem
   quebrar nada, só sem mini-jogo dedicado ainda (é só adicionar aqui). */
const TASK_PROXIMIDADE = 75;   // distância (px do mapa) pra aparecer o prompt "Pressione E"

/* ── Matar (ago/2026) — só o Impostor, com recarga entre mortes. ── */
const KILL_PROXIMIDADE = 90;      // distância (px do mapa) pra aparecer o botão de Matar
const KILL_COOLDOWN_MS = 25000;   // tempo de recarga entre mortes, por impostor
/* Trégua inicial: como todo mundo nasce EMPILHADO no centro (ver spawnFor),
   sem isso o impostor mataria no primeiro segundo, na frente da sala toda.
   Conta do sorteio, e o mapa só abre REVELACAO_MS depois. */
const KILL_GRACA_INICIAL_MS = 20000;
const MORTE_ANIM_MS = 4000;        // duração da animação de morte na tela da vítima (~4s)
const REVELACAO_MS = 6000;        // quanto tempo a tela de revelação de papel fica antes de ir pro mapa sozinha
const CORPO_PROXIMIDADE = 90;     // distância (px do mapa) pra aparecer o botão de Reportar

/* ── Vórtex e câmeras (ago/2026) — pontos marcados no editor do RH
   (uniko_suspect_map.vortexes / .cameras). Vórtex: só o Impostor, teleporta
   entre os portais. Câmeras: qualquer um, vê as salas ao vivo. ── */
/* ── Som ambiente (ago/2026) ──────────────────────────────────────────────
   Uma trilha de suspense roda o tempo todo (lobby + partida) e é TROCADA pela
   trilha de "luzes apagadas" enquanto a sabotagem de energia estiver ativa,
   voltando ao normal quando consertam.

   Volume baixo de propósito: isto é um portal de trabalho, ninguém quer o
   Uniko Suspect gritando na sala. Também tem botão de mudo, com a escolha
   guardada no localStorage — quem silenciou uma vez não quer ser surpreendido
   na próxima partida.

   `<audio>` cria os elementos UMA vez (fora do React) e faz crossfade por
   volume: recriar o elemento a cada troca cortava o som seco e recomeçava o
   download do arquivo. */
const SOM_AMBIENTE = '/uniko-suspect-ambiente.mp3';
const SOM_LUZES_APAGADAS = '/uniko-suspect-luzes-apagadas.mp3';
const SOM_VOLUME = 0.22;             // baixo — é trilha de fundo, não destaque
const SOM_FADE_MS = 700;
const SOM_MUDO_KEY = 'uniko_suspect_mudo';

const criarTrilha = (src) => {
  const a = new Audio(src);
  a.loop = true;
  a.preload = 'auto';
  a.volume = 0;
  return a;
};

/* Faz o volume caminhar até o alvo em ~SOM_FADE_MS (evita corte seco).
   Devolve o id do intervalo pra quem chamou poder cancelar. */
const fadeVolume = (el, alvo, aoTerminar) => {
  if (!el) return null;
  const passo = (alvo - el.volume) / (SOM_FADE_MS / 50);
  const iv = setInterval(() => {
    const v = el.volume + passo;
    if ((passo >= 0 && v >= alvo) || (passo < 0 && v <= alvo)) {
      el.volume = Math.max(0, Math.min(1, alvo));
      clearInterval(iv);
      aoTerminar?.();
      return;
    }
    el.volume = Math.max(0, Math.min(1, v));
  }, 50);
  return iv;
};

/* ── Efeitos sonoros (ago/2026) ───────────────────────────────────────────
   SINTETIZADOS na hora com a Web Audio API, sem arquivo nenhum: são bipes
   curtos, então gerar sai mais leve que baixar 4 mp3 (e não tem o atraso do
   primeiro play, que numa ação rápida como "matar" estragaria o efeito).

   Um AudioContext só, criado na primeira vez que toca — navegador bloqueia
   criar/retomar sem gesto do usuário, e a essa altura a pessoa já clicou
   bastante. Respeita o mesmo botão de mudo da trilha (ver `efeitosMudos`). */
let _ac = null;
let efeitosMudos = false;
const setEfeitosMudos = (v) => { efeitosMudos = v; };
const audioCtx = () => {
  if (!_ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ac = new AC();
  }
  if (_ac.state === 'suspended') _ac.resume().catch(() => { /* precisa de gesto — tenta na próxima */ });
  return _ac;
};

/* Um "beep" com envelope: sobe rápido e decai, senão estala no fim. */
const beep = (ctx, { tipo = 'sine', de, para, inicio, dur, vol = 0.18 }) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo;
  const t = ctx.currentTime + inicio;
  osc.frequency.setValueAtTime(de, t);
  if (para != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, para), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
};

/* Chiado curto (ruído branco) — usado no impacto da morte. */
const ruido = (ctx, { inicio, dur, vol = 0.14 }) => {
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.value = vol;
  src.connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + inicio);
};

const EFEITOS = {
  // Sugado pra dentro: varre grave→agudo e volta, com um "puf" no fim.
  vortex: (ctx) => {
    beep(ctx, { tipo: 'sawtooth', de: 180, para: 900, inicio: 0, dur: 0.22, vol: 0.13 });
    beep(ctx, { tipo: 'sine', de: 900, para: 140, inicio: 0.18, dur: 0.3, vol: 0.15 });
  },
  // Impacto seco e grave + chiado: curto de propósito, pra dar susto.
  matar: (ctx) => {
    ruido(ctx, { inicio: 0, dur: 0.18, vol: 0.16 });
    beep(ctx, { tipo: 'square', de: 220, para: 45, inicio: 0, dur: 0.34, vol: 0.2 });
  },
  // Dois toques subindo — o "conseguiu" clássico.
  tarefa: (ctx) => {
    beep(ctx, { tipo: 'triangle', de: 660, inicio: 0, dur: 0.12, vol: 0.16 });
    beep(ctx, { tipo: 'triangle', de: 990, inicio: 0.1, dur: 0.2, vol: 0.16 });
  },
  // Acorde grave subindo: anuncia que a partida começou.
  partida: (ctx) => {
    beep(ctx, { tipo: 'sawtooth', de: 110, para: 220, inicio: 0, dur: 0.5, vol: 0.1 });
    beep(ctx, { tipo: 'sine', de: 330, inicio: 0.12, dur: 0.4, vol: 0.12 });
    beep(ctx, { tipo: 'sine', de: 440, inicio: 0.26, dur: 0.45, vol: 0.12 });
  },
};

const tocarEfeito = (nome) => {
  if (efeitosMudos) return;
  try {
    const ctx = audioCtx();
    if (ctx) EFEITOS[nome]?.(ctx);
  } catch { /* sem áudio disponível — o jogo segue normal */ }
};

/* Botões do HUD da partida — mesmo visual pros três (mudo/tela cheia/encerrar) */
/* ── Brilho de tarefa concluída ────────────────────────────────────────────
   12 partículas em círculo + um anel que abre. Os ângulos são FIXOS (nada de
   Math.random no render — regra do React Compiler, e de quebra todo mundo vê
   igual). Fica sobre a placa da tarefa, sem capturar clique. */
const PARTICULAS_OK = Array.from({ length: 12 }, (_, i) => {
  const ang = (i / 12) * Math.PI * 2;
  return { dx: `${Math.cos(ang) * 46}px`, dy: `${Math.sin(ang) * 46}px`, atraso: (i % 4) * 0.05 };
});

const BrilhoTarefa = () => (
  <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 5 }}>
    <div className="sus-anel-ok" style={{ position: 'absolute', left: 0, top: 0, width: 54, height: 54, marginLeft: -27, marginTop: -27,
      borderRadius: '50%', border: '4px solid #6BF7B0', boxShadow: '0 0 18px #6BF7B0aa' }} />
    {PARTICULAS_OK.map((p, i) => (
      <span key={i} className="sus-particula"
        style={{ position: 'absolute', left: 0, top: 0, width: 9, height: 9, borderRadius: '50%',
          background: i % 3 === 0 ? '#FFF6A8' : i % 3 === 1 ? '#6BF7B0' : '#8BE9FF',
          boxShadow: '0 0 10px currentColor', animationDelay: `${p.atraso}s`,
          '--dx': p.dx, '--dy': p.dy }} />
    ))}
  </div>
);

/* ── Portal do vórtex (ago/2026) ───────────────────────────────────────────
   Substitui o emoji 🌀 por um portal desenhado à mão em SVG: halo que
   respira, três anéis elípticos girando (o "funil"), dois braços em espiral
   em sentidos opostos, uma poeira de faíscas orbitando e o núcleo pulsando
   no meio. Todo o movimento é CSS (ver SUS_CSS) — nenhum timer de JS, então
   dá pra ter vários no mapa sem peso nenhum.
   Sem `<defs>`/gradiente de propósito: `url(#id)` obrigaria a um id único por
   portal, e vários com o mesmo id no documento é HTML inválido. Aqui é tudo
   traço com opacidade, que repete à vontade. */
const PortalVortex = ({ size = 52, ativo = false }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
    {/* Halo — a "boca" do portal vazando luz */}
    <circle className="sus-portal-g sus-portal-halo" cx="50" cy="50" r="44" fill="#A855F7" />
    <circle className="sus-portal-g sus-portal-halo" cx="50" cy="50" r="30" fill="#38BDF8" style={{ animationDelay: '-1.2s' }} />

    {/* Funil: anéis elípticos girando — achatados de propósito, é o
        achatamento girando que dá a sensação de profundidade. */}
    <ellipse className="sus-portal-g sus-portal-anel" cx="50" cy="50" rx="42" ry="30"
      fill="none" stroke="#C084FC" strokeWidth="3" opacity=".75" />
    <ellipse className="sus-portal-g sus-portal-anel" cx="50" cy="50" rx="32" ry="21"
      fill="none" stroke="#60A5FA" strokeWidth="2.6" opacity=".8" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
    <ellipse className="sus-portal-g sus-portal-anel" cx="50" cy="50" rx="21" ry="13"
      fill="none" stroke="#22D3EE" strokeWidth="2.2" opacity=".85" style={{ animationDuration: '2.1s' }} />

    {/* Braços em espiral — de fora pra dentro, um em cada sentido */}
    <g className="sus-portal-g sus-portal-braco">
      <path d="M50 6 C76 6 94 24 94 50 C94 70 79 84 60 84 C46 84 35 73 35 59 C35 49 43 41 52 41"
        fill="none" stroke="#E9D5FF" strokeWidth="4.5" strokeLinecap="round" opacity=".9" />
    </g>
    <g className="sus-portal-g sus-portal-braco2">
      <path d="M50 94 C24 94 6 76 6 50 C6 30 21 16 40 16 C54 16 65 27 65 41 C65 51 57 59 48 59"
        fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round" opacity=".85" />
    </g>

    {/* Poeira: faíscas orbitando no sentido contrário */}
    <g className="sus-portal-g sus-portal-poeira">
      <circle cx="50" cy="12" r="2.6" fill="#F5D0FE" />
      <circle cx="86" cy="62" r="2.1" fill="#A5F3FC" />
      <circle cx="20" cy="72" r="2.3" fill="#DDD6FE" />
      <circle cx="24" cy="30" r="1.8" fill="#BAE6FD" />
    </g>

    {/* Núcleo — o buraco pra onde tudo cai */}
    <circle className="sus-portal-g sus-portal-nucleo" cx="50" cy="50" r="11" fill="#2E1065" opacity=".95" />
    <circle className="sus-portal-g sus-portal-nucleo" cx="50" cy="50" r="6" fill="#F0ABFC"
      style={{ animationDelay: '-.55s' }} />

    {/* Anel de "pode entrar": só acende pro Impostor quando ele chega perto */}
    {ativo && (
      <circle className="sus-portal-g sus-portal-halo" cx="50" cy="50" r="47"
        fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="7 9" opacity=".9" />
    )}
  </svg>
);

/* ── Explosão do vórtex (ago/2026) ─────────────────────────────────────────
   Estoura sempre que alguém ENTRA ou SAI de um portal: um anel roxo abrindo
   + 18 partículas roxas/azuis pra todo lado. Ângulos e distâncias fixos
   (nada de Math.random no render — mesma regra do BrilhoTarefa, e assim todo
   mundo na sala vê exatamente a mesma explosão). */
const VORTEX_CORES = ['#A855F7', '#7C3AED', '#38BDF8', '#22D3EE', '#C084FC', '#60A5FA'];
const PARTICULAS_VORTEX = Array.from({ length: 18 }, (_, i) => {
  const ang = (i / 18) * Math.PI * 2;
  const raio = 34 + (i % 3) * 15;
  return {
    dx: `${Math.cos(ang) * raio}px`, dy: `${Math.sin(ang) * raio}px`,
    atraso: (i % 5) * 0.035, cor: VORTEX_CORES[i % VORTEX_CORES.length],
    tam: 7 + (i % 3) * 3,
  };
});

const ExplosaoVortex = ({ x, y }) => (
  // `zIndex` ABAIXO da luz (que é 4) de propósito: quem estiver longe/no
  // escuro não pode ver o clarão e descobrir de graça onde o Impostor saiu.
  <div style={{ position: 'absolute', left: `${x / MAP_W * 100}%`, top: `${y / MAP_H * 100}%`,
    width: 0, height: 0, pointerEvents: 'none', zIndex: 3 }}>
    <div className="sus-vortex-anel" style={{ position: 'absolute', left: 0, top: 0, width: 46, height: 46,
      borderRadius: '50%', border: '5px solid #A855F7', boxShadow: '0 0 22px #A855F7cc, inset 0 0 14px #38BDF8aa' }} />
    <div className="sus-vortex-anel" style={{ position: 'absolute', left: 0, top: 0, width: 46, height: 46,
      borderRadius: '50%', border: '3px solid #38BDF8', boxShadow: '0 0 18px #38BDF8cc', animationDelay: '.09s' }} />
    {PARTICULAS_VORTEX.map((p, i) => (
      <span key={i} className="sus-vortex-part"
        style={{ position: 'absolute', left: 0, top: 0, width: p.tam, height: p.tam, borderRadius: '50%',
          background: p.cor, color: p.cor, boxShadow: '0 0 12px currentColor',
          animationDelay: `${p.atraso}s`, '--dx': p.dx, '--dy': p.dy }} />
    ))}
  </div>
);

/* ── Aviso grande do topo do mapa (ago/2026) ───────────────────────────────
   Antes as dicas ("Pressione E", energia sabotada, vórtex recarregando)
   ficavam EMPILHADAS ABAIXO do mapa: cada uma que aparecia empurrava a tela
   inteira pra cima, então só chegar perto de uma tarefa já dava um solavanco.
   Agora elas flutuam POR CIMA do mapa, no alto e no centro, com a mesma cara
   do cartão de papel do HUD — e como o posicionamento é absoluto, aparecer e
   sumir não mexe mais em nada. */
const AvisoJogo = ({ cor, icone, titulo, sub }) => (
  <div className="sus-pop" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderRadius: 15,
    background: `linear-gradient(135deg, ${cor}f2, ${cor}cc)`, border: '1.5px solid rgba(255,255,255,.45)',
    boxShadow: `0 8px 26px rgba(0,0,0,.55), 0 0 24px ${cor}66`, backdropFilter: 'blur(4px)' }}>
    <div style={{ width: 'clamp(34px, 3vw, 46px)', aspectRatio: '1/1', borderRadius: 12, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(18px, 1.8vw, 25px)',
      background: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.4)' }}>{icone}</div>
    <div style={{ minWidth: 0, textAlign: 'left' }}>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(15px, 1.6vw, 22px)', fontWeight: 800, lineHeight: 1.15, color: '#fff' }}>{titulo}</div>
      {sub && <div style={{ fontSize: 'clamp(11.5px, 1.05vw, 15px)', fontWeight: 600, color: 'rgba(255,255,255,.92)', marginTop: 3, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  </div>
);

const hudBtnCss = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)',
  color: '#8AB0D4', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
};

const VORTEX_PROXIMIDADE = 38;    // bem perto mesmo — tem que estar praticamente em cima do portal
const CAMERA_PROXIMIDADE = 85;
const VORTEX_COOLDOWN_MS = 6000;  // evita ficar pulando sem parar entre dois portais

/* ── Sabotagem de energia (ago/2026) — só o Impostor, sem precisar estar
   perto de nada (a sabotagem é da casa inteira). Enquanto ativa: ninguém
   faz tarefa (nem o próprio Impostor, que já não tinha mesmo) e os
   Tripulantes ficam praticamente no escuro. Conserta sozinha depois de um
   tempo se ninguém for lá resolver, pra não travar a partida pra sempre. */
const SABOTAGEM_COOLDOWN_MS = 50000;   // recarga entre sabotagens (era 40s — subiu a pedido do usuário)
const SABOTAGEM_AUTO_FIX_MS = 60000;

/* ── Câmera com zoom: em vez do mapa inteiro, o jogador vê só uma JANELA
   dele (campo de visão menor), seguindo o próprio boneco. ZOOM_FACTOR=3 →
   a janela mostra 1/3 da largura/altura do mapa (~3x de zoom). */
const ZOOM_FACTOR = 3;
const ZOOM_W = MAP_W / ZOOM_FACTOR, ZOOM_H = MAP_H / ZOOM_FACTOR;

/* ── Iluminação: só enxerga perto do próprio boneco — o resto escurece.
   Raio em % (percentuais de radial-gradient `circle` são sempre resolvidos
   como fração do "farthest-corner", então ficam circulares mesmo num mapa
   retangular). Impostor enxerga um pouco mais longe — vantagem clássica do
   papel no Among Us. */
const LUZ_RAIO = { tripulante: 6, impostor: 16, fantasma: 60, sabotagem: 3 };   // fantasma enxerga praticamente tudo; sabotagem quase apaga a luz do tripulante
// Rampa de escuridão mais fechada e mais escura (pedido do usuário: visão do
// Tripulante mais escura e com raio menor) — os degraus chegam mais perto do
// círculo de luz e a opacidade sobe mais rápido pro preto quase total.
const lightGradientBg = (xPct, yPct, raio) => `radial-gradient(circle at ${xPct}% ${yPct}%,
  transparent 0%, transparent ${raio}%,
  rgba(3,6,12,.45) ${raio + 6}%,
  rgba(2,4,9,.74) ${raio + 14}%,
  rgba(1,3,7,.92) ${raio + 24}%,
  rgba(0,1,4,.99) ${raio + 40}%)`;

/* ── Movimento livre em tempo real ── */
const PLAYER_R = 36;              // "raio" do boneco em pixels do mapa (clamp nas bordas)
const MOVE_SPEED = 118;           // pixels do mapa por segundo (baixou a pedido: 200 → 175 → 140 → 118)
const POS_SEND_MS = 90;           // intervalo mínimo entre broadcasts de posição
const KEY_DIR = {                 // WASD + setas → direção
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
/* Nascimento (ago/2026): TODO MUNDO no MESMO ponto, o centro da sala de
   estar — antes cada um caía num canto diferente (posição sorteada por hash
   do nome) e a partida já começava com o grupo espalhado, sem aquele momento
   "todos juntos" do começo do Among Us. */
const SPAWN_RECT = { x: 640, y: 330, w: 260, h: 150 };   // cabe folgado dentro da zona 'sala'
const SPAWN_CENTRO = { x: SPAWN_RECT.x + SPAWN_RECT.w / 2, y: SPAWN_RECT.y + SPAWN_RECT.h / 2 };
const spawnFor = () => ({ ...SPAWN_CENTRO });

const myName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
const PHOTO_SRC_KEY = 'up_photo_src';   // mesma foto escolhida no Uniko Paint/Stop
const myPhotoSrc = () => {
  try { return localStorage.getItem(PHOTO_SRC_KEY) || '/UNIKO_NEW.png'; }
  catch { return '/UNIKO_NEW.png'; }
};
const semTabela = (e) => !!e && (e.code === 'PGRST205' || e.code === '42P01'
  || /Could not find the table|does not exist|schema cache/i.test(e.message || ''));

const SUS_CSS = `
@keyframes susFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes susPop  { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
@keyframes susReveal { 0% { transform: scale(.4) rotateY(90deg); opacity: 0; } 60% { transform: scale(1.08) rotateY(0deg); } 100% { transform: scale(1); opacity: 1; } }
@keyframes susFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
/* Item de tarefa solto no lugar errado: treme e volta. O transform repete o
   translate(-50%,-50%) do elemento porque a animação SUBSTITUI o transform
   inline enquanto roda — sem isso a coisinha pularia pro canto. */
@keyframes susTremer { 0%,100% { transform: translate(-50%,-50%) rotate(0deg); } 25% { transform: translate(-58%,-50%) rotate(-9deg); } 75% { transform: translate(-42%,-50%) rotate(9deg); } }
@keyframes susWalk  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5%); } }
/* Brilho ao concluir tarefa: cada partícula sobe/abre pro seu lado (o ângulo
   vem de --dx/--dy, definidos inline) enquanto some. */
@keyframes susParticula {
  0%   { transform: translate(-50%,-50%) scale(.3); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1); opacity: 0; }
}
@keyframes susAnelOk {
  0%   { transform: translate(-50%,-50%) scale(.2); opacity: .9; border-width: 4px; }
  100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; border-width: 1px; }
}
.sus-particula { animation: susParticula .85s ease-out forwards; }
.sus-anel-ok   { animation: susAnelOk .7s ease-out forwards; }

/* Seta da sabotagem de energia: fica orbitando o boneco (o giro em si vem do
   rotate que o JS aplica no pai) e "respira" pra fora, chamando atencao no
   escuro. O translateX e o raio da orbita. */
@keyframes susSeta {
  0%,100% { transform: translate(-50%,-50%) translateX(52px) scale(1);    opacity: .88; }
  50%     { transform: translate(-50%,-50%) translateX(72px) scale(1.14); opacity: 1; }
}
.sus-seta { animation: susSeta 1s ease-in-out infinite; }

/* Portal do vórtex: o desenho em si está em PortalVortex (SVG). Aqui só o
   movimento — anéis e braços girando em sentidos opostos, núcleo pulsando.
   transform-box: view-box faz o transform-origin valer o CENTRO DO SVG
   (50% 50% do viewBox), e não o centro da caixa de cada traço: sem isso cada
   braço giraria em torno de si mesmo e o portal ficava tremendo. */
@keyframes susPortalGira    { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
@keyframes susPortalGiraInv { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes susPortalNucleo  { 0%,100% { transform: scale(.82); opacity: .8; } 50% { transform: scale(1.18); opacity: 1; } }
@keyframes susPortalHalo    { 0%,100% { transform: scale(.96); opacity: .25; } 50% { transform: scale(1.14); opacity: .5; } }
.sus-portal-g      { transform-box: view-box; transform-origin: 50% 50%; }
.sus-portal-anel   { animation: susPortalGira 4.2s linear infinite; }
.sus-portal-braco  { animation: susPortalGira 2.6s linear infinite; }
.sus-portal-braco2 { animation: susPortalGiraInv 3.6s linear infinite; }
.sus-portal-poeira { animation: susPortalGiraInv 6s linear infinite; }
.sus-portal-nucleo { animation: susPortalNucleo 1.7s ease-in-out infinite; }
.sus-portal-halo   { animation: susPortalHalo 2.6s ease-in-out infinite; }

/* Vórtex: explosãozinha roxa/azul quando alguém entra ou sai do portal.
   Mesma mecânica do brilho de tarefa (--dx/--dy inline), só que com um anel
   roxo e partículas mais rápidas. */
@keyframes susVortexAnel {
  0%   { transform: translate(-50%,-50%) scale(.2); opacity: .95; border-width: 5px; }
  100% { transform: translate(-50%,-50%) scale(3.1); opacity: 0; border-width: 1px; }
}
@keyframes susVortexParticula {
  0%   { transform: translate(-50%,-50%) scale(.25) rotate(0deg); opacity: 0; }
  18%  { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.9) rotate(220deg); opacity: 0; }
}
.sus-vortex-anel { animation: susVortexAnel .62s ease-out forwards; }
.sus-vortex-part { animation: susVortexParticula .72s cubic-bezier(.15,.8,.3,1) forwards; }

/* Pulsação LENTA e discreta: o "pum-pum" rápido de antes cansava a vista com
   várias placas na tela. A escala mal muda (1 → 1.04) e quem dá vida é a AURA
   (drop-shadow) respirando junto. */
@keyframes susTwinkle { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 5px #6BB8FF66) drop-shadow(0 0 12px #4A9FE833); }
  50% { transform: scale(1.04); filter: drop-shadow(0 0 12px #6BB8FFaa) drop-shadow(0 0 28px #4A9FE866); } }
@keyframes susEmergPulse { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 6px #DC262677) drop-shadow(0 0 16px #DC262633); }
  50% { transform: scale(1.05); filter: drop-shadow(0 0 14px #DC2626bb) drop-shadow(0 0 32px #DC262677); } }
/* ── Animação de morte (tela cheia da vítima, ~4s, bate com MORTE_ANIM_MS):
   o Impostor recua e dispara um laser PELOS OLHOS (duas linhas finas) que
   atravessa até a vítima; no impacto ela EXPLODE (flash + onda de choque)
   e só depois apaga/vira fantasma. Tudo em porcentagem de uma timeline de
   4s — pra mudar a duração total só troca o valor "4s" nas classes .sus-death-*. */
@keyframes susDeathDash {
  /* O Impostor dá 4 investidas: some de um lado, reaparece do outro batendo.
     Cada golpe leva ~22% da linha do tempo. As posições são RELATIVAS ao ponto
     onde ele nasce (esquerda da tela), por isso os translates são grandes. */
  0%      { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
  6%      { transform: translate(0,0) scale(.86) rotate(-8deg); }               /* agacha pra saltar */
  /* golpe 1 — chega pela esquerda */
  12%     { transform: translate(52vw,-4vh) scale(1.12) rotate(14deg); }
  18%     { transform: translate(46vw,-2vh) scale(1) rotate(0deg); }
  /* golpe 2 — por cima */
  24%     { transform: translate(58vw,-16vh) scale(.9) rotate(-20deg); }
  32%     { transform: translate(56vw,-7vh) scale(1.14) rotate(10deg); }
  /* golpe 3 — por baixo */
  40%     { transform: translate(60vw,14vh) scale(.9) rotate(22deg); }
  48%     { transform: translate(57vw,6vh) scale(1.14) rotate(-12deg); }
  /* golpe 4 — pela direita, o mais forte */
  56%     { transform: translate(70vw,2vh) scale(.88) rotate(-26deg); }
  64%     { transform: translate(61vw,0) scale(1.2) rotate(16deg); }
  /* recua e observa */
  76%     { transform: translate(50vw,-3vh) scale(1) rotate(0deg); opacity: 1; }
  100%    { transform: translate(46vw,-3vh) scale(.96) rotate(0deg); opacity: .9; }
}
/* Rastro do salto: um risco que aparece junto de cada investida */
@keyframes susDeathTrail {
  0%,10%   { opacity: 0; transform: translate(-50%,-50%) scaleX(0) rotate(var(--rot,0deg)); }
  14%      { opacity: .9; transform: translate(-50%,-50%) scaleX(1) rotate(var(--rot,0deg)); }
  24%,100% { opacity: 0; transform: translate(-50%,-50%) scaleX(1) rotate(var(--rot,0deg)); }
}
/* Estrelinha/faisca de impacto — uma por golpe, cada uma com seu atraso */
@keyframes susDeathHit {
  0%   { opacity: 0; transform: translate(-50%,-50%) scale(.2) rotate(0deg); }
  25%  { opacity: 1; transform: translate(-50%,-50%) scale(1.25) rotate(25deg); }
  100% { opacity: 0; transform: translate(-50%,-50%) scale(1.9) rotate(60deg); }
}
/* A tela treme a cada pancada */
@keyframes susDeathShake {
  0%,10%,21%,29%,37%,45%,53%,61%,70%,100% { transform: translate(0,0); }
  18%  { transform: translate(-7px, 4px); }
  33%  { transform: translate(6px,-5px); }
  49%  { transform: translate(-6px,-4px); }
  65%  { transform: translate(8px, 5px); }
}
/* Vítima: leva os 4 golpes (cada um joga ela pro lado) e só depois apaga */
@keyframes susDeathVictim {
  0%,14%  { filter: brightness(1) grayscale(0); transform: translate(-50%,-50%) rotate(0) scale(1); }
  19%     { filter: brightness(2.8); transform: translate(calc(-50% + 14px),-50%) rotate(7deg) scale(1.06); }
  24%     { filter: brightness(1); transform: translate(-50%,-50%) rotate(0) scale(1); }
  33%     { filter: brightness(2.8); transform: translate(-50%, calc(-50% + 12px)) rotate(-9deg) scale(1.05); }
  38%     { filter: brightness(1) grayscale(.15); transform: translate(-50%,-50%) rotate(0) scale(1); }
  49%     { filter: brightness(2.8); transform: translate(calc(-50% - 13px),-50%) rotate(10deg) scale(1.05); }
  54%     { filter: brightness(1) grayscale(.3); transform: translate(-50%,-50%) rotate(0) scale(1); }
  65%     { filter: brightness(3.4); transform: translate(-50%, calc(-50% - 10px)) rotate(-14deg) scale(1.1); }
  74%     { filter: brightness(1.1) grayscale(.6); transform: translate(-50%,-50%) rotate(-6deg) scale(.97); }
  100%    { filter: brightness(.8) grayscale(1); transform: translate(-50%, calc(-50% + 10px)) rotate(-12deg) scale(.9); opacity: .45; }
}
@keyframes susDeathText { 0%,10% { opacity: 0; transform: scale(.6) translateY(10px); }
  22% { opacity: 1; transform: scale(1.1) translateY(0); } 34%,100% { opacity: 1; transform: scale(1) translateY(0); } }
.sus-fade   { animation: susFade .35s ease both; }
.sus-pop    { animation: susPop .3s cubic-bezier(.2,1.4,.4,1) both; }
.sus-reveal { animation: susReveal .55s cubic-bezier(.2,1.4,.4,1) both; }
.sus-float  { animation: susFloat 2.6s ease-in-out infinite; }
.sus-walk   { animation: susWalk .45s ease-in-out infinite; }
/* Bem mais lentas que antes (1.6s → 3.4s / 1.1s → 3s): a ideia é "respirar",
   não piscar. */
.sus-twinkle { animation: susTwinkle 3.4s ease-in-out infinite; }
.sus-emerg  { animation: susEmergPulse 3s ease-in-out infinite; }
/* Todas na MESMA linha de tempo de 4s (bate com MORTE_ANIM_MS) — pra mudar a
   duração total basta trocar o "4s" aqui. */
.sus-death-dash   { animation: susDeathDash 4s cubic-bezier(.3,.9,.3,1) both; }
.sus-death-trail  { animation: susDeathTrail 4s ease both; }
.sus-death-hit    { animation: susDeathHit .5s ease-out both; }
.sus-death-shake  { animation: susDeathShake 4s ease both; }
.sus-death-victim { animation: susDeathVictim 4s ease both; }
.sus-death-text   { animation: susDeathText 4s ease both; }
/* ── Lobby do barco (ago/2026): oceano animado ao redor do barco enquanto
   todo mundo espera o host começar. Duas camadas — um brilho que desliza
   bem devagar (a "água" em si) e linhas finas de onda por cima — mais o
   barco balançando suavemente. */
/* Enquanto a partida roda, o Assistente Uniko sai da frente (ele é fixed com
   z-index acima do jogo e ficava flutuando por cima do mapa). */
body.sus-jogando .uniko-assistant { display: none !important; }
/* ── Nada de arrastar imagem (ago/2026) ─────────────────────────────────────
   Dava pra segurar o mapa, um Uniko ou uma placa de tarefa e sair arrastando
   a "cópia fantasma" do navegador pela tela — atrapalhava no meio da partida
   e dava pra soltar a arte em qualquer lugar. user-drag resolve no Chrome/
   Edge/Safari; o Firefox ignora a propriedade, e la quem segura a onda sao o
   draggable={false} de cada imagem e o onDragStart que cancela o arrasto na
   raiz de cada bloco do jogo (dragstart borbulha, entao um handler no topo
   cobre tudo que estiver dentro). */
.sus-root img, .sus-root svg, .sus-root canvas {
  -webkit-user-drag: none;
  user-drag: none;
  -webkit-touch-callout: none;
}
.sus-root img, .sus-root svg, .sus-root kbd, .sus-root button {
  -webkit-user-select: none;
  user-select: none;
}
/* ── Dentro de uma sala o jogo toma a tela inteira (ago/2026) ───────────────
   Assim que a pessoa entra na sala, o Portal em volta sai de cena: barra
   lateral, cabeçalho e o menu de baixo do celular somem, e o conteúdo perde
   a margem/padding que existiam pra caber ao lado deles. Ao sair da sala
   tudo volta sozinho (a classe é removida no efeito que a colocou). */
body.sus-na-sala .portal-sidebar,
body.sus-na-sala .portal-topbar,
body.sus-na-sala .portal-mobilenav { display: none !important; }
body.sus-na-sala .portal-conteudo { margin-left: 0 !important; }
body.sus-na-sala .portal-area {
  height: 100vh !important;
  padding: 0 !important;
  overflow-y: auto;
}
@keyframes susOceanShine { 0% { background-position: 0% 50%, 100% 50%; } 100% { background-position: 200% 50%, -100% 50%; } }
@keyframes susWaveLines { from { background-position: 0 0; } to { background-position: 160px 0; } }
@keyframes susBoatSway { 0%,100% { transform: translateY(0) rotate(-.5deg); } 50% { transform: translateY(5px) rotate(.5deg); } }
.sus-ocean { background:
    radial-gradient(ellipse 45% 55% at 25% 35%, rgba(255,255,255,.20) 0%, transparent 60%),
    radial-gradient(ellipse 40% 50% at 75% 65%, rgba(255,255,255,.14) 0%, transparent 60%),
    linear-gradient(135deg, #073B52 0%, #0B5E7D 40%, #1290B8 70%, #073B52 100%);
  background-size: 200% 200%, 200% 200%, 100% 100%;
  animation: susOceanShine 16s ease-in-out infinite alternate; }
.sus-wave-lines { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay;
  background-image: repeating-linear-gradient(115deg, rgba(255,255,255,.10) 0 2px, transparent 2px 44px);
  animation: susWaveLines 5s linear infinite; }
.sus-boat-sway { animation: susBoatSway 4.5s ease-in-out infinite; }

/* ── Névoa e nuvens do lobby ───────────────────────────────────────────────
   Três camadas atravessando a tela em velocidades diferentes (paralaxe) — é
   o que dá a sensação de neblina de verdade em vez de uma mancha parada.
   Todas com pointer-events:none pra nunca roubarem o clique dos bonecos. */
@keyframes susNevoa1 { from { transform: translateX(-25%); } to { transform: translateX(25%); } }
@keyframes susNevoa2 { from { transform: translateX(20%); } to { transform: translateX(-20%); } }
@keyframes susNuvemPassa { from { transform: translateX(-110%); } to { transform: translateX(110%); } }
/* Camada baixa, densa, colada na água */
.sus-nevoa-baixa { position: absolute; left: -30%; right: -30%; bottom: -6%; height: 46%; pointer-events: none;
  background:
    radial-gradient(ellipse 34% 60% at 18% 60%, rgba(200,225,240,.30) 0%, transparent 70%),
    radial-gradient(ellipse 40% 55% at 52% 70%, rgba(215,235,248,.26) 0%, transparent 72%),
    radial-gradient(ellipse 30% 50% at 84% 62%, rgba(190,215,235,.24) 0%, transparent 70%);
  filter: blur(14px);
  animation: susNevoa1 26s ease-in-out infinite alternate; }
/* Camada alta, mais rala, indo pro outro lado */
.sus-nevoa-alta { position: absolute; left: -25%; right: -25%; top: -4%; height: 42%; pointer-events: none;
  background:
    radial-gradient(ellipse 38% 55% at 30% 40%, rgba(255,255,255,.16) 0%, transparent 72%),
    radial-gradient(ellipse 32% 48% at 72% 34%, rgba(220,235,250,.14) 0%, transparent 72%);
  filter: blur(20px);
  animation: susNevoa2 34s ease-in-out infinite alternate; }
/* Nuvem solta que cruza a tela de ponta a ponta, bem devagar */
.sus-nuvem { position: absolute; pointer-events: none; border-radius: 50%; filter: blur(26px);
  background: radial-gradient(ellipse at center, rgba(226,240,252,.34) 0%, rgba(200,220,238,.14) 45%, transparent 72%); }
.sus-nuvem-a { top: 8%;  width: 46%; height: 26%; animation: susNuvemPassa 48s linear infinite; }
.sus-nuvem-b { top: 34%; width: 60%; height: 30%; animation: susNuvemPassa 72s linear infinite; animation-delay: -24s; opacity: .8; }
.sus-btn { transition: transform .12s, filter .12s; }
.sus-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
.sus-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .sus-fade,.sus-pop,.sus-reveal,.sus-float,.sus-walk,.sus-twinkle,.sus-emerg,
  .sus-death-dash,.sus-death-trail,.sus-death-hit,.sus-death-shake,.sus-death-victim,.sus-death-text,.sus-ocean,.sus-wave-lines,.sus-boat-sway,
  .sus-nevoa-baixa,.sus-nevoa-alta,.sus-nuvem { animation: none !important; } }
`;

/* ── Estrela (SVG) — marcador de tarefa (azul/verde) e do botão de emergência (vermelho) ── */
const StarIcon = ({ size = 22, color = '#3B82F6', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}
    style={{ display: 'block', filter: `drop-shadow(0 1px 3px rgba(0,0,0,.55))` }}>
    <path d="M12 1.5 L15.09 8.76 L23 9.51 L17 14.97 L18.82 22.5 L12 18.4 L5.18 22.5 L7 14.97 L1 9.51 L8.91 8.76 Z"
      fill={color} stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
);

/* ── Placas do mapa (ago/2026, substituem as estrelas SVG por imagens
   prontas fornecidas pelo usuário): tarefa disponível/concluída e o botão
   de iniciar reunião. Os botões de ação (matar/reportar) ficam mais abaixo. */
// `?v=` = data da última troca de arte. O navegador cacheia por NOME de
// arquivo: sem isso quem já abriu o jogo continuaria vendo os botões velhos
// (mesma pegadinha do mapa e da máscara de parede). Ao trocar as imagens de
// novo, incremente a data.
const ARTE_V = '?v=20260825';
// Ícone do Uniko Detetive (substituiu o emoji 🕵️ no cabeçalho)
const UNIKO_DETETIVE_ICONE = '/uniko-detetive-icone.png' + ARTE_V;
const TAREFA_DISPONIVEL_IMG = '/uniko-suspect-tarefa-disponivel.png' + ARTE_V;
const TAREFA_CONCLUIDA_IMG = '/uniko-suspect-tarefa-concluida.png' + ARTE_V;
const INICIAR_REUNIAO_IMG = '/uniko-suspect-iniciar-reuniao.png' + ARTE_V;
const BOTAO_MATAR_IMG = '/uniko-suspect-botao-matar.png' + ARTE_V;
const BOTAO_SABOTAR_IMG = '/uniko-suspect-botao-sabotar.png' + ARTE_V;
const BOTAO_USAR_IMG = '/uniko-suspect-botao-usar.png' + ARTE_V;
const BOTAO_REPORTAR_IMG = '/uniko-suspect-botao-reportar.png';
const CORPO_IMG = '/uniko-suspect-uniko-morto.png';   // cadáver no chão onde o impostor matou

/* ── Tela de morte (ago/2026): só a VÍTIMA vê — o impostor "atira" um laser
   nela. Full-screen preto, texto "Você foi morto!" com glow (inspirado na
   referência que o usuário mandou) + os dois Unikos com o feixe entre eles. */
const MORTE_IMG = '/uniko-suspect-voce-foi-morto.png';
const MorteOverlay = ({ matador, matadorFoto, vitimaFoto }) => (
  // `position:absolute` (não `fixed`) preenchendo o `gameWrapRef` (que tem
  // `position:relative`) — cobre a TELA DO JOGO inteira. A imagem do feixe azul
  // continua sendo o FUNDO (`object-fit:cover`); por cima dela o IMPOSTOR dá 4
  // investidas ao redor da vítima, batendo de ângulos diferentes (esquerda, cima,
  // baixo e direita) até ela cair — no lugar do laser que existia antes.
  <div className="sus-death-shake" style={{ position: 'absolute', inset: 0, zIndex: 300, background: '#000', borderRadius: 16, overflow: 'hidden' }}>
    <img draggable={false} src={MORTE_IMG} alt="Você foi morto!" className="sus-death-text"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />

    {/* Rastros dos saltos — um por investida, cada um no ângulo do golpe */}
    {[
      { top: '46%', rot: '0deg',   atraso: '0.42s' },
      { top: '34%', rot: '38deg',  atraso: '0.94s' },
      { top: '58%', rot: '-34deg', atraso: '1.56s' },
      { top: '48%', rot: '10deg',  atraso: '2.20s' },
    ].map((r, i) => (
      <div key={i} className="sus-death-trail"
        style={{ position: 'absolute', left: '62%', top: r.top, width: '30%', height: 5, zIndex: 1,
          transformOrigin: 'center', borderRadius: 999, animationDelay: r.atraso,
          background: 'linear-gradient(90deg, transparent, #9fe0ff 40%, #fff)',
          boxShadow: '0 0 14px 4px rgba(120,200,255,.8)', '--rot': r.rot }} />
    ))}

    {/* Faíscas de impacto — uma por golpe, em volta da vítima */}
    {[
      { left: '76%', top: '48%', atraso: '0.70s' },
      { left: '83%', top: '38%', atraso: '1.28s' },
      { left: '83%', top: '58%', atraso: '1.90s' },
      { left: '90%', top: '48%', atraso: '2.54s' },
    ].map((h, i) => (
      <div key={i} className="sus-death-hit"
        style={{ position: 'absolute', left: h.left, top: h.top, zIndex: 4, pointerEvents: 'none',
          width: 'min(13vw, 26vh, 130px)', aspectRatio: '1/1', animationDelay: h.atraso,
          background: 'radial-gradient(circle, #fff 0%, #FFE9A8 26%, #FF9E4B 52%, rgba(255,120,40,0) 72%)',
          clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
    ))}

    {/* A VÍTIMA fica parada no lugar de sempre, levando os golpes */}
    <img draggable={false} src={vitimaFoto || '/UNIKO_NEW.png'} alt="" className="sus-death-victim"
      style={{ position: 'absolute', left: '83%', top: '48%',
        width: 'min(15vw, 30vh, 150px)', aspectRatio: '1/1', borderRadius: '50%', objectFit: 'cover', background: '#0a1622',
        border: '4px solid rgba(255,255,255,.9)', boxShadow: '0 0 34px 8px rgba(120,200,255,.85), 0 0 70px 20px rgba(70,150,255,.55)', zIndex: 3 }} />

    {/* O IMPOSTOR nasce à esquerda e circula batendo (susDeathDash) */}
    <img draggable={false} src={matadorFoto || '/UNIKO_NEW.png'} alt="" className="sus-death-dash"
      style={{ position: 'absolute', left: '17%', top: '48%', marginLeft: 'min(-7.5vw,-75px)', marginTop: 'min(-7.5vw,-75px)',
        width: 'min(15vw, 30vh, 150px)', aspectRatio: '1/1', borderRadius: '50%', objectFit: 'cover', background: '#0a1622',
        border: '4px solid #DC2626', boxShadow: '0 0 22px 6px rgba(220,38,38,.65)', zIndex: 5 }} />

    {matador && (
      <div className="sus-pop" style={{ position: 'absolute', left: '50%', bottom: '6%', transform: 'translateX(-50%)', zIndex: 6,
        fontSize: 13, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.55)', borderRadius: 999, padding: '6px 16px', whiteSpace: 'nowrap' }}>
        \U0001F480 {matador} te matou
      </div>
    )}
  </div>
);
/* ═══════════════════════════════════════════════════════════════════════════
   MINI-JOGOS DE TAREFA — um por tipo (ver taskTypeFor). Cada um recebe
   `onComplete` e chama quando o jogador termina; visual simples (emoji +
   CSS), gesto único e óbvio por tarefa. A regra de design mudou em ago/2026
   (pedido do usuário): nada de "clique N vezes na mesma coisinha" — as
   tarefas agora são ARRASTAR algo até um lugar (ver TarefaArrastar), com
   ritmo/precisão só onde o gesto conta uma história (virar a carne no ponto,
   segurar a sauna na faixa, ligar os fios da energia).
   ═══════════════════════════════════════════════════════════════════════════ */
// `position:relative` pro brilho de conclusão (BrilhoTarefa, absolute) se
// ancorar na placa. Sem `overflow:hidden` de propósito: as partículas
// precisam transbordar pra fora da imagem.
const taskBtnCss = { border: 'none', background: 'none', cursor: 'pointer', padding: 0, position: 'relative' };

/* Contagem de recarga por cima do botão (Matar/Sabotar) — o número em pé no
   meio do ícone, como no Among Us. Some sozinha quando chega a zero, e não
   rouba o clique (`pointerEvents:none`) pro botão voltar a funcionar no
   mesmo instante em que o número desaparece. */
const ContagemRecarga = ({ segs }) => {
  if (!segs) return null;
  return (
    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <span style={{ minWidth: '1.9em', padding: '2px 8px', borderRadius: 999, background: 'rgba(8,12,20,.66)',
        border: '1.5px solid rgba(255,255,255,.28)', color: '#fff', textAlign: 'center',
        fontFamily: 'var(--font-brand)', fontSize: 'clamp(15px, 2.1vw, 24px)', fontWeight: 800, lineHeight: 1.25,
        textShadow: '0 2px 6px rgba(0,0,0,.8)' }}>{segs}</span>
    </span>
  );
};

/* ── Concluir tarefa: UMA vez só e à prova de re-render do pai (ago/2026) ──
   `onComplete` chega numa arrow NOVA a cada render do mapa, e o mapa
   re-renderiza sozinho a cada broadcast de posição dos outros jogadores
   (POS_SEND_MS = 90ms). Quem punha `onComplete` nas deps de um efeito com
   `setTimeout` tinha o timer CANCELADO e reagendado antes de disparar — era
   por isso que dava pra terminar a tarefa das estrelas e ela nunca fechar
   (bug relatado pelo usuário). O callback agora mora num ref (o efeito não
   depende mais dele) e a conclusão sai uma vez só, nunca duas. */
const useConcluirTarefa = (done, onComplete, delayMs = 0) => {
  const cbRef = useRef(onComplete);
  useEffect(() => { cbRef.current = onComplete; }, [onComplete]);
  const avisou = useRef(false);
  useEffect(() => {
    if (!done || avisou.current) return undefined;
    avisou.current = true;
    if (!delayMs) { cbRef.current?.(); return undefined; }
    const t = setTimeout(() => cbRef.current?.(), delayMs);
    return () => clearTimeout(t);
  }, [done, delayMs]);
};

/* ── ARRASTAR E SOLTAR (ago/2026) ──────────────────────────────────────────
   As tarefas de "clique 3x em cada coisinha" (geladeira, flaminga,
   chocolates, louça, computador) foram trocadas a pedido do usuário: clicar
   repetido não é gesto de tarefa nenhuma, cansa e não conta história. Todas
   passaram a usar o MESMO gesto — pegar uma coisa e levar até um lugar —,
   que é auto-explicativo (a pessoa entende sem ler) e combina com as que já
   eram assim (esfregar o banheiro, ligar os fios da energia).

   `TarefaArrastar` é o motor comum: recebe os ITENS (o que se pega) e os
   ALVOS (onde se solta) em coordenadas de PORCENTAGEM da caixa, então tudo
   acompanha o tamanho da tela sem conta nenhuma.
   • `item.alvo` = id do alvo certo, ou '*' pra "qualquer um serve".
   • `alvo.capacidade` = quantos itens cabem (o rasgo da boia aceita 1
     remendo; a lixeira aceita o mundo inteiro).
   Usa Pointer Events (não o drag-and-drop do HTML5, que é inerte no toque) e
   `touchAction:'none'` pra arrastar no celular sem rolar a página junto. */
const TarefaArrastar = ({ instrucao, itens, alvos, fundo, decoracao, onComplete }) => {
  const areaRef = useRef(null);
  const [entregas, setEntregas] = useState({});      // id do item -> id do alvo onde ele foi parar
  const [arrasto, setArrasto] = useState(null);      // { id, x, y } — x/y em % da caixa
  const [errou, setErrou] = useState(null);          // id que voltou pro lugar (tremida)

  const entregues = Object.keys(entregas).length;
  const done = entregues === itens.length;
  useConcluirTarefa(done, onComplete);

  const cheio = (alvoId) => {
    const alvo = alvos.find(a => a.id === alvoId);
    if (!alvo?.capacidade) return false;
    return Object.values(entregas).filter(v => v === alvoId).length >= alvo.capacidade;
  };
  const pct = (e) => {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const dentro = (pos, alvo) => Math.abs(pos.x - alvo.x) <= alvo.w / 2 && Math.abs(pos.y - alvo.y) <= alvo.h / 2;
  const alvoSob = (pos, item) => alvos.find(a => dentro(pos, a) && (item.alvo === '*' || item.alvo === a.id) && !cheio(a.id));

  const pegar = (item) => (e) => {
    if (entregas[item.id]) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const pos = pct(e); if (!pos) return;
    setArrasto({ id: item.id, ...pos });
  };
  const mover = (e) => {
    if (!arrasto) return;
    const pos = pct(e); if (!pos) return;
    setArrasto(a => a && { ...a, ...pos });
  };
  const soltar = () => {
    if (!arrasto) return;
    const item = itens.find(i => i.id === arrasto.id);
    const alvo = item && alvoSob(arrasto, item);
    if (alvo) setEntregas(e => ({ ...e, [item.id]: alvo.id }));
    else { setErrou(arrasto.id); setTimeout(() => setErrou(null), 380); }
    setArrasto(null);
  };

  const itemSendoArrastado = arrasto && itens.find(i => i.id === arrasto.id);
  const alvoDestacado = itemSendoArrastado ? alvoSob(arrasto, itemSendoArrastado)?.id : null;

  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>
        {instrucao} <b style={{ color: T.text }}>({entregues}/{itens.length})</b>
      </div>
      <div ref={areaRef} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
        style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden',
          border: `2px solid ${T.border}`, touchAction: 'none', userSelect: 'none', ...fundo }}>
        {decoracao}
        {alvos.map(a => {
          const aceso = alvoDestacado === a.id;
          const ocupado = cheio(a.id);
          return (
            <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: `translate(-50%,-50%) scale(${aceso ? 1.12 : 1})`,
              width: `${a.w}%`, height: `${a.h}%`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              border: a.semMoldura ? 'none' : `2.5px dashed ${aceso ? '#16A34A' : 'rgba(0,0,0,.28)'}`,
              background: a.semMoldura ? 'transparent' : (aceso ? 'rgba(22,163,74,.16)' : 'rgba(255,255,255,.42)'),
              transition: 'transform .12s, background .12s, border-color .12s', pointerEvents: 'none' }}>
              <span style={{ fontSize: a.tamanho || 34, lineHeight: 1 }}>{ocupado && a.emojiCheio ? a.emojiCheio : a.emoji}</span>
              {a.label && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(0,0,0,.55)' }}>{a.label}</span>}
            </div>
          );
        })}
        {itens.map(item => {
          if (entregas[item.id]) return null;
          const sendo = arrasto?.id === item.id;
          const x = sendo ? arrasto.x : item.x, y = sendo ? arrasto.y : item.y;
          return (
            <div key={item.id} onPointerDown={pegar(item)}
              style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, zIndex: sendo ? 5 : 2,
                transform: `translate(-50%,-50%) scale(${sendo ? 1.25 : 1})`, cursor: sendo ? 'grabbing' : 'grab',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, touchAction: 'none',
                filter: sendo ? 'drop-shadow(0 6px 10px rgba(0,0,0,.35))' : 'none',
                transition: sendo ? 'none' : 'transform .12s',
                animation: errou === item.id ? 'susTremer .38s' : 'none' }}>
              <span style={{ fontSize: item.tamanho || 30, lineHeight: 1, pointerEvents: 'none' }}>{item.emoji}</span>
              {item.label && <span style={{ fontSize: 9, color: item.corLabel || 'rgba(0,0,0,.6)', maxWidth: 74, textAlign: 'center', lineHeight: 1.15, pointerEvents: 'none', wordBreak: 'break-all' }}>{item.label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* Cada tarefa abaixo é só uma "planta" do motor acima: onde nascem as coisas,
   pra onde elas vão. As listas ficam em `useMemo` com deps vazias pra manter a
   MESMA referência entre renders (o motor compara itens por id, e recriar tudo
   a cada frame de arrasto seria lixo à toa). */
const TaskGeladeira = ({ onComplete }) => {
  const itens = useMemo(() => [
    { id: 'a', emoji: '💩', x: 16, y: 20, alvo: 'lixo' },
    { id: 'b', emoji: '🥛', x: 40, y: 16, alvo: 'lixo' },
    { id: 'c', emoji: '🥬', x: 64, y: 21, alvo: 'lixo' },
    { id: 'd', emoji: '🐟', x: 86, y: 17, alvo: 'lixo' },
    { id: 'e', emoji: '🧀', x: 22, y: 48, alvo: 'lixo' },
  ], []);
  const alvos = useMemo(() => [{ id: 'lixo', emoji: '🗑️', label: 'LIXO', x: 76, y: 74, w: 34, h: 40, tamanho: 40 }], []);
  return <TarefaArrastar onComplete={onComplete}
    instrucao="Arraste o que estragou até a lixeira!"
    fundo={{ background: 'linear-gradient(180deg,#EAF6FF,#D6ECFB)' }}
    decoracao={[1, 2].map(i => <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 33}%`, height: 2, background: 'rgba(0,0,0,.12)' }} />)}
    itens={itens} alvos={alvos} />;
};

const TaskFlamingo = ({ onComplete }) => {
  // Os remendos ficam na "caixa de costura" embaixo e vão pra QUALQUER rasgo
  // ('*'), um por rasgo (`capacidade: 1`) — que vira 🩹 quando tapado.
  const itens = useMemo(() => [
    { id: 'r1', emoji: '🩹', x: 14, y: 88, alvo: '*', tamanho: 26 },
    { id: 'r2', emoji: '🩹', x: 30, y: 90, alvo: '*', tamanho: 26 },
    { id: 'r3', emoji: '🩹', x: 46, y: 88, alvo: '*', tamanho: 26 },
    { id: 'r4', emoji: '🩹', x: 62, y: 90, alvo: '*', tamanho: 26 },
  ], []);
  const alvos = useMemo(() => [
    { id: 'x1', emoji: '❌', emojiCheio: '🩹', x: 30, y: 26, w: 17, h: 20, capacidade: 1, semMoldura: true, tamanho: 24 },
    { id: 'x2', emoji: '❌', emojiCheio: '🩹', x: 63, y: 22, w: 17, h: 20, capacidade: 1, semMoldura: true, tamanho: 24 },
    { id: 'x3', emoji: '❌', emojiCheio: '🩹', x: 40, y: 55, w: 17, h: 20, capacidade: 1, semMoldura: true, tamanho: 24 },
    { id: 'x4', emoji: '❌', emojiCheio: '🩹', x: 70, y: 52, w: 17, h: 20, capacidade: 1, semMoldura: true, tamanho: 24 },
  ], []);
  return <TarefaArrastar onComplete={onComplete}
    instrucao="Arraste um remendo pra cima de cada rasgo da boia!"
    fundo={{ background: 'linear-gradient(180deg,#E6FBFF,#C9F1FB)' }}
    decoracao={<>
      <div style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%,-50%)', fontSize: 100, opacity: .95 }}>🦩</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '26%', background: 'rgba(255,255,255,.5)', borderTop: '2px dashed rgba(0,0,0,.16)' }} />
      <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 10.5, fontWeight: 800, color: 'rgba(0,0,0,.45)' }}>🧵 caixa de costura</div>
    </>}
    itens={itens} alvos={alvos} />;
};

const TaskChocolates = ({ onComplete }) => {
  const itens = useMemo(() => [
    { id: 'c1', emoji: '🍫', x: 12, y: 20, alvo: 'bolso' },
    { id: 'c2', emoji: '🍫', x: 33, y: 15, alvo: 'bolso' },
    { id: 'c3', emoji: '🍫', x: 54, y: 20, alvo: 'bolso' },
    { id: 'c4', emoji: '🍫', x: 75, y: 14, alvo: 'bolso' },
    { id: 'c5', emoji: '🍫', x: 20, y: 52, alvo: 'bolso' },
    { id: 'c6', emoji: '🍫', x: 44, y: 56, alvo: 'bolso' },
  ], []);
  const alvos = useMemo(() => [{ id: 'bolso', emoji: '👖', label: 'BOLSO', x: 78, y: 72, w: 34, h: 42, tamanho: 40 }], []);
  return <TarefaArrastar onComplete={onComplete}
    instrucao="Arraste cada chocolate pro bolso — sem ninguém ver!"
    fundo={{ background: 'linear-gradient(180deg,#F8F0E3,#EFDFC4)' }}
    itens={itens} alvos={alvos} />;
};

const TaskLouca = ({ onComplete }) => {
  // Aqui cada peça tem SEU lugar (não é '*'): a graça é olhar o desenho do
  // escorredor e levar cada uma pro suporte certo.
  const itens = useMemo(() => [
    { id: 'p1', emoji: '🍽️', x: 13, y: 22, alvo: 'pratos' },
    { id: 'g1', emoji: '🥤', x: 33, y: 17, alvo: 'copos' },
    { id: 't1', emoji: '🍴', x: 52, y: 22, alvo: 'talheres' },
    { id: 'p2', emoji: '🍽️', x: 20, y: 48, alvo: 'pratos' },
    { id: 'g2', emoji: '🥤', x: 41, y: 47, alvo: 'copos' },
  ], []);
  const alvos = useMemo(() => [
    { id: 'pratos',   emoji: '🍽️', label: 'PRATOS',   x: 74, y: 20, w: 30, h: 26 },
    { id: 'copos',    emoji: '🥤', label: 'COPOS',    x: 74, y: 50, w: 30, h: 26 },
    { id: 'talheres', emoji: '🍴', label: 'TALHERES', x: 74, y: 80, w: 30, h: 26 },
  ], []);
  return <TarefaArrastar onComplete={onComplete}
    instrucao="Lave arrastando cada peça pro lugar dela no escorredor!"
    fundo={{ background: 'linear-gradient(180deg,#EAF7F2,#D4EBE4)' }}
    decoracao={<div style={{ position: 'absolute', left: '2%', top: '68%', fontSize: 34, opacity: .9 }}>🚰</div>}
    itens={itens} alvos={alvos} />;
};

const FIOS = [{ cor: '#DC2626', nome: 'vermelho' }, { cor: '#2563EB', nome: 'azul' }, { cor: '#EAB308', nome: 'amarelo' },
  { cor: '#16A34A', nome: 'verde' }, { cor: '#A855F7', nome: 'roxo' }];
// Redesenhada (ago/2026, pedido do usuário: "difícil de entender") — antes
// eram só duas colunas de barrinhas coloridas, sem indicar visualmente o que
// era fio/encaixe. Agora: bolinha = ponta do fio, anel oco = encaixe vazio
// (preenche quando conecta), e uma LINHA DE VERDADE desenhada em SVG liga os
// dois lados quando acerta — o metáfora de "puxar o fio até o encaixe certo"
// fica bem mais óbvia.
const TaskEnergia = ({ onComplete }) => {
  const [direita] = useState(() => embaralhar(FIOS));
  const [ligados, setLigados] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [erro, setErro] = useState(null);
  /* O fio desenhado precisa começar e terminar EXATAMENTE no meio das
     bolinhas. Antes o SVG tinha `viewBox="0 0 320 H"` com `width="100%"`:
     em qualquer tela onde a caixa não coubesse nos 320px, o navegador
     encolhia o desenho inteiro (inclusive na vertical, e ainda centralizava
     a sobra) enquanto as bolinhas continuavam em pixels — os fios saíam
     tortos, ligando o nada a lugar nenhum. Agora a largura real é MEDIDA e o
     SVG desenha em pixel de verdade, sem viewBox e sem escala. */
  const caixaRef = useRef(null);
  const [larg, setLarg] = useState(320);
  useEffect(() => {
    const el = caixaRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLarg(el.clientWidth || 320));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Uma vez basta — e sem depender do `onComplete` (ver useConcluirTarefa).
  const done = ligados.length === FIOS.length;
  useConcluirTarefa(done, onComplete);
  const clicarEsquerda = (cor) => { if (!ligados.includes(cor)) setSelecionado(cor); };
  const clicarDireita = (cor) => {
    if (!selecionado) return;
    if (selecionado === cor) { setLigados(l => [...l, cor]); setSelecionado(null); }
    else { setErro(cor); setTimeout(() => setErro(null), 350); setSelecionado(null); }
  };
  const N = FIOS.length;
  const ROW_H = 44, W = 320;
  const H = ROW_H * N;
  const rowY = (i) => (i + 0.5) * ROW_H;

  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>
        Clique numa <b>bolinha</b> à esquerda e depois no <b>encaixe</b> da MESMA cor à direita, pra puxar o fio até lá!
      </div>
      <div ref={caixaRef} style={{ position: 'relative', height: H, width: '100%', maxWidth: W, margin: '0 auto' }}>
        <svg width={larg} height={H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {ligados.map(cor => {
            const i = FIOS.findIndex(f => f.cor === cor);
            const j = direita.findIndex(f => f.cor === cor);
            // 15px = o centro das bolinhas (30px de largura, coladas na borda).
            return <line key={cor} x1={15} y1={rowY(i)} x2={larg - 15} y2={rowY(j)} stroke={cor} strokeWidth={5} strokeLinecap="round" />;
          })}
        </svg>
        {FIOS.map((f, i) => {
          const feito = ligados.includes(f.cor);
          return (
            <button key={f.cor} disabled={feito} onClick={() => clicarEsquerda(f.cor)} title={f.nome}
              style={{ ...taskBtnCss, position: 'absolute', left: 0, top: rowY(i) - 15, width: 30, height: 30,
                cursor: feito ? 'default' : 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: f.cor, border: '3px solid #fff',
                boxShadow: selecionado === f.cor ? `0 0 0 4px ${f.cor}55, 0 0 12px ${f.cor}` : '0 2px 5px rgba(0,0,0,.35)',
                opacity: feito ? .4 : 1, transition: 'box-shadow .15s' }} />
            </button>
          );
        })}
        {direita.map((f, j) => {
          const feito = ligados.includes(f.cor);
          return (
            <button key={f.cor} disabled={feito} onClick={() => clicarDireita(f.cor)} title={f.nome}
              style={{ ...taskBtnCss, position: 'absolute', right: 0, top: rowY(j) - 15, width: 30, height: 30,
                cursor: feito ? 'default' : 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: feito ? f.cor : T.surface || '#fff',
                border: `3px solid ${erro === f.cor ? '#DC2626' : f.cor}`, boxSizing: 'border-box' }} />
            </button>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: T.textT, marginTop: 8 }}>
        {ligados.length === FIOS.length ? '💡 Energia religada!' : `🔌 ${ligados.length}/${FIOS.length} fios ligados`}
      </div>
    </div>
  );
};

const TaskChurrasco = ({ onComplete }) => {
  const ALVO_HITS = 6;
  const ZONA = [42, 58];          // faixa de acerto (%) — 16% de largura
  const [pos, setPos] = useState(0);
  const [hits, setHits] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const hitsRef = useRef(0);
  useEffect(() => { hitsRef.current = hits; }, [hits]);

  useEffect(() => {
    // BUG QUE ISSO CORRIGE: antes a carne andava um tanto fixo POR QUADRO.
    // Em tela de 144Hz ela ia 2,4x mais rápido que em 60Hz, e a janela de
    // acerto caia de ~166ms pra ~28ms — dava a sensação de "cliquei no verde
    // e não contou". Agora a velocidade é em % POR SEGUNDO, então o jogo fica
    // igual em qualquer monitor.
    let raf, anterior = performance.now();
    const tick = (agora) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);   // trava o passo se a aba congelar
      anterior = agora;
      const vel = 52 + hitsRef.current * 7;                   // %/s (sobe a cada acerto)
      let np = posRef.current + vel * dt * dirRef.current;
      if (np >= 100) { np = 100; dirRef.current = -1; }
      if (np <= 0)   { np = 0;   dirRef.current = 1; }
      posRef.current = np;
      setPos(np);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);   // sem deps: o loop nunca reinicia (antes reiniciava a cada acerto)

  useConcluirTarefa(hits >= ALVO_HITS, onComplete);

  const virar = () => {
    if (hitsRef.current >= ALVO_HITS) return;
    const noPonto = posRef.current >= ZONA[0] && posRef.current <= ZONA[1];
    if (noPonto) { setHits(h => h + 1); setFeedback('🔥 boa!'); }
    else setFeedback('quase...');
    setTimeout(() => setFeedback(null), 500);
  };

  const naZona = pos >= ZONA[0] && pos <= ZONA[1];
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>
        Clique em "Virar!" quando a carne estiver na faixa verde! ({hits}/{ALVO_HITS})
      </div>
      <div style={{ position: 'relative', height: 30, borderRadius: 999, background: 'rgba(0,0,0,.12)', margin: '0 6px 14px' }}>
        <div style={{ position: 'absolute', left: `${ZONA[0]}%`, width: `${ZONA[1] - ZONA[0]}%`, top: 0, bottom: 0,
          background: naZona ? 'rgba(22,163,74,.75)' : 'rgba(22,163,74,.4)', borderRadius: 999, transition: 'background .1s' }} />
        {/* Marcador: barra fina em vez de emoji — o emoji tinha folga lateral
            e a ponta parecia estar no verde quando o centro ainda não estava. */}
        <div style={{ position: 'absolute', left: `${pos}%`, top: -3, bottom: -3, width: 4, transform: 'translateX(-50%)',
          background: naZona ? '#16A34A' : '#111', borderRadius: 2, boxShadow: '0 0 6px rgba(0,0,0,.4)' }} />
        <div style={{ position: 'absolute', left: `${pos}%`, top: '50%', transform: 'translate(-50%,-50%)', fontSize: 22, pointerEvents: 'none' }}>🍖</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <button className="sus-btn" onClick={virar} style={{ padding: '9px 22px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          background: `linear-gradient(135deg, #F97316, #DC2626)`, boxShadow: '0 6px 16px rgba(220,38,38,.35)' }}>🔥 Virar!</button>
        {feedback && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: feedback.includes('boa') ? '#16A34A' : T.textT }}>{feedback}</div>}
      </div>
    </div>
  );
};

const TaskGenerica = ({ onComplete }) => {
  const [p, setP] = useState(0);
  const holdRef = useRef(null);
  const start = () => {
    stop();
    holdRef.current = setInterval(() => setP(v => {
      const nv = Math.min(1, v + 0.012);   // ~3s segurando sem soltar (era ~0,7s)
      if (nv >= 1) { stop(); setTimeout(onComplete, 150); }
      return nv;
    }), 30);
  };
  const stop = () => { if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; } };
  useEffect(() => stop, []);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 14 }}>Segure o botão pra concluir a tarefa.</div>
      <button className="sus-btn" onPointerDown={start} onPointerUp={() => { stop(); setP(0); }} onPointerLeave={() => { stop(); setP(0); }}
        style={{ width: 96, height: 96, borderRadius: '50%', border: `4px solid ${AGUA}`, background: `conic-gradient(${AGUA} ${p * 360}deg, transparent 0)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', touchAction: 'none' }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: T.surface || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✋</div>
      </button>
    </div>
  );
};

/* ── Limpar banheiro: esfregar as manchas até sumirem (arrastar por cima) ── */
const TaskBanheiro = ({ onComplete }) => {
  // Posições fixas (nada de Math.random no render — regra do React Compiler,
  // e de quebra todo mundo vê a mesma coisa).
  const MANCHAS = [{ x: 18, y: 26 }, { x: 62, y: 18 }, { x: 38, y: 58 }, { x: 74, y: 62 }, { x: 12, y: 70 }];
  const ALVO = 6;
  const [esfregado, setEsfregado] = useState(() => Array(MANCHAS.length).fill(0));
  const done = esfregado.every(v => v >= ALVO);
  useConcluirTarefa(done, onComplete);
  // `onPointerEnter` com o botão apertado = arrastar por cima (não precisa
  // clicar em cada uma) — `e.buttons` cobre mouse; no toque o pointerdown já conta.
  const esfregar = (i) => setEsfregado(v => v.map((n, j) => j === i ? Math.min(ALVO, n + 1) : n));
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Passe o dedo (ou o mouse) por cima das manchas até o azulejo brilhar!</div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 300, height: 190, margin: '0 auto', borderRadius: 12, overflow: 'hidden',
        background: 'repeating-linear-gradient(0deg,#E8F4F8 0 24px,#DCEDF4 24px 25px), repeating-linear-gradient(90deg,transparent 0 24px,rgba(0,0,0,.05) 24px 25px)',
        border: `2px solid ${AGUA}44`, touchAction: 'none' }}>
        {MANCHAS.map((m, i) => {
          const p = esfregado[i] / ALVO;
          if (p >= 1) return null;
          return (
            <div key={i} onPointerDown={() => esfregar(i)} onPointerEnter={(e) => { if (e.buttons === 1) esfregar(i); }}
              style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, width: 46, height: 38, borderRadius: '50%', cursor: 'pointer',
                background: 'radial-gradient(circle,#8A7B5C,#6B5C40)', opacity: 1 - p * 0.85, transform: `scale(${1 - p * 0.35})`, transition: 'all .12s' }} />
          );
        })}
      </div>
    </div>
  );
};

/* ── Observar estrelas (REFEITA em ago/2026) ────────────────────────────────
   A versão antiga era "toque nas 5 estrelas na ordem certa" e tinha dois
   defeitos: errar a ordem zerava tudo (e no escuro isso acontecia toda hora)
   e, pior, a conclusão passava por um `setTimeout` que o re-render do mapa
   cancelava — dava pra ligar as cinco e a tarefa NUNCA fechar (o bug que o
   usuário relatou; a raiz virou o `useConcluirTarefa` lá em cima).
   A tarefa nova usa o mesmo gesto do resto do jogo: pegar cada estrela na
   bancada do telescópio e encaixá-la nos pontos vazios do mapa celeste.
   Sem ordem, sem tempo, sem recomeçar do zero — e a conclusão sai pelo motor
   comum (TarefaArrastar), o mesmo das outras cinco tarefas de arrastar. */
const ESTRELAS_ENCAIXES = [
  { id: 'c1', x: 21, y: 30 }, { id: 'c2', x: 40, y: 15 }, { id: 'c3', x: 57, y: 31 },
  { id: 'c4', x: 44, y: 47 }, { id: 'c5', x: 76, y: 52 },
];
const TaskEstrelas = ({ onComplete }) => {
  const itens = useMemo(() => [
    { id: 's1', emoji: '⭐', x: 12, y: 86, alvo: '*', tamanho: 26 },
    { id: 's2', emoji: '⭐', x: 31, y: 89, alvo: '*', tamanho: 26 },
    { id: 's3', emoji: '⭐', x: 50, y: 86, alvo: '*', tamanho: 26 },
    { id: 's4', emoji: '⭐', x: 69, y: 89, alvo: '*', tamanho: 26 },
    { id: 's5', emoji: '⭐', x: 87, y: 86, alvo: '*', tamanho: 26 },
  ], []);
  // Qualquer estrela serve em qualquer encaixe ('*'), um por encaixe.
  const alvos = useMemo(() => ESTRELAS_ENCAIXES.map(e => ({
    // Encaixe vazio = só a moldura tracejada (o '✧' de texto herdava a cor do
    // modal e sumia dentro dela); ao receber a estrela ele vira 🌟.
    ...e, emoji: '', emojiCheio: '🌟', w: 17, h: 20, capacidade: 1, tamanho: 24,
  })), []);
  return <TarefaArrastar onComplete={onComplete}
    instrucao="Arraste cada estrela pro lugar dela no mapa celeste!"
    fundo={{ background: 'radial-gradient(ellipse at 50% 15%, #1E2B54, #070B1A)', border: '2px solid #2B3A6B' }}
    decoracao={<>
      {/* Linhas da constelação: já desenhadas (tracejadas) pra mostrar o
          desenho que os encaixes formam — a pessoa entende de cara que está
          montando uma constelação, não empilhando figurinhas. */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]].map(([a, b], k) => (
          <line key={k} x1={`${ESTRELAS_ENCAIXES[a].x}%`} y1={`${ESTRELAS_ENCAIXES[a].y}%`}
            x2={`${ESTRELAS_ENCAIXES[b].x}%`} y2={`${ESTRELAS_ENCAIXES[b].y}%`}
            stroke={CEU} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" opacity=".5" />
        ))}
      </svg>
      {/* Poeira estelar de fundo — posições fixas de propósito (nada de
          Math.random no render: regra do React Compiler, e assim todo mundo
          vê o mesmo céu). */}
      {[[8, 12], [27, 62], [63, 12], [88, 34], [17, 48], [92, 68], [36, 72], [69, 68]].map(([x, y], i) => (
        <span key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 3, height: 3, borderRadius: '50%',
          background: '#B7C8F2', opacity: .55, boxShadow: '0 0 6px 1px rgba(183,200,242,.5)' }} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '24%', background: 'rgba(255,255,255,.07)', borderTop: '2px dashed rgba(255,255,255,.22)' }} />
      <div style={{ position: 'absolute', left: 10, bottom: 7, fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,.6)' }}>🔭 bancada do telescópio</div>
    </>}
    itens={itens} alvos={alvos} />;
};

/* ── Excluir pastas no computador: selecionar as pastas e mandar pra lixeira ── */
const TaskComputador = ({ onComplete }) => {
  // Arrastar a pasta pra lixeira é o gesto que todo mundo já faz no
  // computador de verdade — bem mais óbvio que "selecione e clique em
  // Excluir", que era o que tinha antes.
  const itens = useMemo(() => [
    { id: 'f1', emoji: '📁', label: 'relatorios_2019',  x: 15, y: 18, alvo: 'lixeira', corLabel: '#C7D6F0' },
    { id: 'f2', emoji: '📁', label: 'backup_antigo',    x: 42, y: 16, alvo: 'lixeira', corLabel: '#C7D6F0' },
    { id: 'f3', emoji: '📁', label: 'fotos_confra',     x: 69, y: 19, alvo: 'lixeira', corLabel: '#C7D6F0' },
    { id: 'f4', emoji: '📁', label: 'temp_download',    x: 15, y: 50, alvo: 'lixeira', corLabel: '#C7D6F0' },
    { id: 'f5', emoji: '📁', label: 'planilha_v7_final', x: 42, y: 48, alvo: 'lixeira', corLabel: '#C7D6F0' },
  ], []);
  const alvos = useMemo(() => [{ id: 'lixeira', emoji: '🗑️', label: 'LIXEIRA', x: 78, y: 74, w: 32, h: 38, tamanho: 38 }], []);
  return <TarefaArrastar onComplete={onComplete}
    instrucao="Arraste as pastas velhas pra lixeira!"
    fundo={{ background: '#0F1626', border: '2px solid #3B4A6B' }}
    decoracao={<div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#1B2740', color: '#9FB4DD', fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FEBC2E' }} />
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C840' }} />
      <span style={{ marginLeft: 6 }}>Meus Documentos</span>
    </div>}
    itens={itens} alvos={alvos} />;
};

/* ── Tomar banho na sauna: segurar a temperatura na faixa boa até encher ── */
const SAUNA_MIN = 52, SAUNA_MAX = 82;   // faixa verde da sauna (ver comentário no efeito)
const TaskSauna = ({ onComplete }) => {
  const [temp, setTemp] = useState(20);       // 0..100
  const [progresso, setProgresso] = useState(0);
  const aquecendoRef = useRef(false);
  // Declarado ANTES do efeito que o lê — o React Compiler reclama de usar
  // variável antes da declaração, mesmo quando só roda depois do mount.
  const tempRef = useRef(temp);
  useEffect(() => { tempRef.current = temp; }, [temp]);
  const done = progresso >= 1;
  useConcluirTarefa(done, onComplete);
  /* A temperatura sobe enquanto segura e cai sozinha ao soltar; só conta
     progresso na faixa ideal — segurar direto passa do ponto.
     Afrouxada (ago/2026): a faixa era estreita (60–80) e o ponteiro voava
     (43%/s subindo), então acertar virava sorte. Agora a faixa é 50% maior,
     o ponteiro anda quase na metade da velocidade e o progresso enche mais
     rápido — dá pra "pilotar" a temperatura em vez de caçar o ponto. */
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => {
      setTemp(v => Math.max(0, Math.min(100, v + (aquecendoRef.current ? 1.5 : -1.1))));
      setProgresso(p => {
        const ok = tempRef.current >= SAUNA_MIN && tempRef.current <= SAUNA_MAX;
        return Math.min(1, p + (ok ? 0.03 : 0));
      });
    }, 60);
    return () => clearInterval(t);
  }, [done]);
  const naFaixa = temp >= SAUNA_MIN && temp <= SAUNA_MAX;
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 12, textAlign: 'center' }}>
        Segure o botão pra jogar água nas pedras. Mantenha a temperatura na <b style={{ color: '#16A34A' }}>faixa verde</b>!
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 280, height: 26, margin: '0 auto 8px', borderRadius: 999, overflow: 'hidden',
        background: 'linear-gradient(90deg,#4FA8D8,#F2C879,#DC2626)', border: '2px solid rgba(0,0,0,.15)' }}>
        {/* faixa ideal — desenhada a partir das MESMAS constantes que contam o progresso */}
        <div style={{ position: 'absolute', left: `${SAUNA_MIN}%`, width: `${SAUNA_MAX - SAUNA_MIN}%`, top: 0, bottom: 0, border: '2px solid #16A34A', borderRadius: 4, background: 'rgba(22,163,74,.18)' }} />
        <div style={{ position: 'absolute', left: `${temp}%`, top: -3, bottom: -3, width: 4, background: '#111', borderRadius: 2, transform: 'translateX(-50%)', transition: 'left .06s linear' }} />
      </div>
      <div style={{ width: '100%', maxWidth: 280, height: 9, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(0,0,0,.12)', overflow: 'hidden' }}>
        <div style={{ width: `${progresso * 100}%`, height: '100%', background: naFaixa ? '#16A34A' : AREIA, transition: 'width .1s' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <button className="sus-btn" onPointerDown={() => { aquecendoRef.current = true; }}
          onPointerUp={() => { aquecendoRef.current = false; }} onPointerLeave={() => { aquecendoRef.current = false; }}
          style={{ padding: '11px 26px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', userSelect: 'none', touchAction: 'none',
            background: 'linear-gradient(135deg,#F97316,#DC2626)', boxShadow: '0 6px 16px rgba(220,38,38,.35)' }}>💧 Jogar água</button>
      </div>
    </div>
  );
};

const TASK_MINIGAMES = { geladeira: TaskGeladeira, flamingo: TaskFlamingo, chocolates: TaskChocolates, louca: TaskLouca, energia: TaskEnergia, churrasco: TaskChurrasco,
  banheiro: TaskBanheiro, estrelas: TaskEstrelas, computador: TaskComputador, sauna: TaskSauna, generica: TaskGenerica };

/* ═══════════════════════════════════════════════════════════════════════════
   VÓRTEX (ago/2026) — escolher pra qual portal ir. Só o Impostor chega aqui.
   ═══════════════════════════════════════════════════════════════════════════ */
const VortexPainel = ({ atual, vortexes, onIr, onFechar }) => {
  const destinos = vortexes.filter(v => v.id !== atual.id);
  return (
    <div onClick={onFechar} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8,4,20,.78)', backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} className="sus-pop" style={{ width: 'min(92%,360px)', background: T.surface || '#fff', borderRadius: 18,
        border: '2px solid rgba(168,85,247,.55)', boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 40px rgba(168,85,247,.25)', padding: 18 }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><PortalVortex size={58} /></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Vórtex — {atual.label}</div>
          <div style={{ fontSize: 12, color: T.textT, marginTop: 3 }}>Escolha pra onde se teletransportar.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 220, overflowY: 'auto' }}>
          {destinos.map(d => (
            <button key={d.id} className="sus-btn" onClick={() => onIr(d)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 11, cursor: 'pointer',
                border: '1.5px solid rgba(168,85,247,.4)', background: 'rgba(168,85,247,.1)', color: T.text, fontSize: 13, fontWeight: 700 }}>
              <PortalVortex size={26} />{d.label}
            </button>
          ))}
        </div>
        <button className="sus-btn" onClick={onFechar}
          style={{ width: '100%', marginTop: 12, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${T.border}`, background: 'transparent',
            color: T.textS, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Cancelar (Esc)</button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CÂMERAS DE SEGURANÇA (ago/2026) — a sala de anexo. Mostra um RECORTE do
   mapa em volta de cada ponto de câmera, com os bonecos AO VIVO por cima
   (as posições já chegam por broadcast, então dá pra flagrar um assassinato
   acontecendo). Passa de uma câmera pra outra com as setas.
   ═══════════════════════════════════════════════════════════════════════════ */
// Mesmo enquadramento que o jogador tem no mapa (ZOOM_FACTOR): a câmera
// mostra um pedaço do tamanho do campo de visão dele, não meio mapa. Estava
// 2.6 (bem mais aberto) e ficava tudo pequeno demais pra reconhecer alguém.
const CAM_ZOOM = ZOOM_FACTOR;
const CamerasPainel = ({ cameras, indice, onTrocar, onFechar, players, positions, myPos, name, mortos, corpos, fantasmas }) => {
  const cam = cameras[indice];
  const vw = MAP_W / CAM_ZOOM, vh = MAP_H / CAM_ZOOM;
  // Janela centrada na câmera, presa nas bordas do mapa
  const vx = Math.max(0, Math.min(MAP_W - vw, cam.x - vw / 2));
  const vy = Math.max(0, Math.min(MAP_H - vh, cam.y - vh / 2));
  const dentro = (x, y) => x >= vx && x <= vx + vw && y >= vy && y <= vy + vh;
  const pct = (v, min, tam) => `${((v - min) / tam) * 100}%`;
  const ir = (d) => onTrocar((indice + d + cameras.length) % cameras.length);

  return (
    <div onClick={onFechar} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,8,6,.85)', backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} className="sus-pop" style={{ width: 'min(94%,520px)', background: '#0A140F', borderRadius: 16,
        border: '2px solid rgba(22,163,74,.5)', boxShadow: '0 20px 60px rgba(0,0,0,.6)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#7DE0A6', fontSize: 12.5, fontWeight: 800 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'susTwinkle 1.2s ease-in-out infinite' }} />
            AO VIVO · {cam.label}
          </div>
          <div style={{ fontSize: 11.5, color: '#4E7D63', fontWeight: 700 }}>{indice + 1}/{cameras.length}</div>
        </div>

        {/* A "telinha" */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${vw} / ${vh}`, borderRadius: 10, overflow: 'hidden', background: '#000',
          border: '1px solid rgba(22,163,74,.3)' }}>
          <img src={MAPA_IMG} alt="" draggable={false} style={{ position: 'absolute', width: `${CAM_ZOOM * 100}%`, height: `${CAM_ZOOM * 100}%`,
            left: `${-(vx / MAP_W) * CAM_ZOOM * 100}%`, top: `${-(vy / MAP_H) * CAM_ZOOM * 100}%`, imageRendering: 'auto' }} />

          {/* Corpos primeiro (ficam por baixo dos vivos) */}
          {corpos.filter(c => dentro(c.x, c.y)).map(c => (
            <div key={`corpo-${c.id}`} style={{ position: 'absolute', left: pct(c.x, vx, vw), top: pct(c.y, vy, vh), transform: 'translate(-50%,-50%)',
              fontSize: 20, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.8))' }}>💀</div>
          ))}

          {/* Bonecos vivos — fantasma não aparece na câmera (ninguém vê fantasma) */}
          {players.filter(p => !mortos.includes(p.name) && !fantasmas.includes(p.name)).map(p => {
            const pos = p.name === name ? myPos : positions[p.name];
            if (!pos || !dentro(pos.x, pos.y)) return null;
            return (
              <div key={p.name} style={{ position: 'absolute', left: pct(pos.x, vx, vw), top: pct(pos.y, vy, vh), transform: 'translate(-50%,-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <img draggable={false} src={p.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover',
                  border: `2px solid ${p.name === name ? '#7DE0A6' : '#fff'}`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.7))' }} />
                <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px #000', whiteSpace: 'nowrap' }}>
                  {p.name.split(' ')[0]}
                </span>
              </div>
            );
          })}

          {/* Chiado de TV, só decorativo */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .1,
            background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,.5) 2px 3px)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <button className="sus-btn" onClick={() => ir(-1)} disabled={cameras.length < 2}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid rgba(22,163,74,.4)', background: 'rgba(22,163,74,.12)',
              color: '#7DE0A6', fontSize: 13, fontWeight: 800, cursor: cameras.length < 2 ? 'not-allowed' : 'pointer', opacity: cameras.length < 2 ? .4 : 1 }}>‹ Anterior</button>
          <button className="sus-btn" onClick={onFechar}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,.18)', background: 'transparent',
              color: '#9FC7B0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Sair (Esc)</button>
          <button className="sus-btn" onClick={() => ir(1)} disabled={cameras.length < 2}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid rgba(22,163,74,.4)', background: 'rgba(22,163,74,.12)',
              color: '#7DE0A6', fontSize: 13, fontWeight: 800, cursor: cameras.length < 2 ? 'not-allowed' : 'pointer', opacity: cameras.length < 2 ? .4 : 1 }}>Próxima ›</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   REUNIÃO DE EMERGÊNCIA (ago/2026) — chat de 60s seguido de votação de 60s
   pra expulsar/acusar alguém de impostor. Fica do lado de fora do módulo de
   tarefas de propósito: fase ('chat'|'votacao'|'resultado') e votos moram no
   `state` compartilhado da sala (mudam pouco — 2 transições + 1 voto por
   pessoa, então o padrão de "sobrescrever o jsonb inteiro" do resto do jogo
   é suficiente); o CHAT em si vai por BROADCAST (mesmo princípio da posição
   no mapa — muda rápido demais e é efêmero, não precisa persistir).
   ═══════════════════════════════════════════════════════════════════════════ */
const REUNIAO_FASE_MS = 60000;
const REUNIAO_RESULTADO_MS = 8000;

const ReuniaoEmergencia = ({ reuniao, players, mortos = [], name, papeis, mensagens, chatTexto, setChatTexto, onEnviarChat, onVotar, onRetirarVoto, onIniciarVotacao }) => {
  // `Date.now()` só pode ser chamado dentro do efeito (impuro) — o render lê
  // só o estado `agora`, que o efeito atualiza 2x/s (regra do React Compiler).
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setAgora(Date.now()), 500); return () => clearInterval(iv); }, []);
  const chatBoxRef = useRef(null);

  /* O chat virou uma GAVETA (ago/2026, layout no espírito do tablet do Among
     Us): fica aberto durante a conversa e se recolhe sozinho quando a votação
     começa, pra a grade de jogadores ocupar a tela. O balãozinho no cabeçalho
     abre/fecha a qualquer momento e mostra quantas mensagens chegaram
     enquanto estava fechado. */
  const [chatAberto, setChatAberto] = useState(true);
  const [faseVista, setFaseVista] = useState(reuniao.fase);
  if (faseVista !== reuniao.fase) {
    setFaseVista(reuniao.fase);
    setChatAberto(reuniao.fase === 'chat');
  }
  const [vistas, setVistas] = useState(mensagens.length);
  if (chatAberto && vistas !== mensagens.length) setVistas(mensagens.length);
  const naoLidas = Math.max(0, mensagens.length - vistas);
  useEffect(() => { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, [mensagens, chatAberto]);

  const duracao = reuniao.fase === 'resultado' ? REUNIAO_RESULTADO_MS : REUNIAO_FASE_MS;
  const restante = Math.max(0, Math.ceil((duracao - (agora - reuniao.faseIniciadaEm)) / 1000));
  const meuVoto = reuniao.votos?.[name];
  const jaVotei = meuVoto !== undefined;
  const votantes = new Set(Object.keys(reuniao.votos || {}));
  const votando = reuniao.fase === 'votacao';
  const pularEscolhido = meuVoto === null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 760, margin: '0 auto', padding: '4px 4px 10px' }}>

      {/* ── Cabeçalho: quem chamou, cronômetro e o botão do chat ─────────── */}
      <div className="sus-pop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 26, lineHeight: 1 }}>🚨</div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: '#DC2626' }}>
            Reunião de emergência — chamada por {reuniao.chamadaPor.split(' ')[0]}
          </div>
          <div style={{ fontSize: 13, color: T.textT, marginTop: 2 }}>
            {reuniao.fase === 'chat' && `Conversem! ${restante}s pra votação começar.`}
            {votando && `Votem em quem acham que é o Impostor. ${restante}s restantes.`}
            {reuniao.fase === 'resultado' && (reuniao.resultado?.vencedor ? 'Fim de jogo!' : `Retomando o jogo em ${restante}s...`)}
          </div>
        </div>
        {reuniao.fase !== 'resultado' && (
          <button className="sus-btn" onClick={() => setChatAberto(a => !a)}
            title={chatAberto ? 'Fechar o chat' : 'Abrir o chat'}
            style={{ position: 'relative', flexShrink: 0, width: 54, height: 54, borderRadius: 14, cursor: 'pointer',
              border: `2px solid ${chatAberto ? AGUA : T.border}`,
              background: chatAberto ? `${AGUA}1f` : (T.surface || '#fff'),
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25 }}>
            💬
            {!chatAberto && naoLidas > 0 && (
              <span className="sus-pop" style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px',
                borderRadius: 999, background: IMPOSTOR_COR, color: '#fff', fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${T.surface || '#fff'}` }}>
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Chat (gaveta) ─────────────────────────────────────────────────── */}
      {reuniao.fase !== 'resultado' && chatAberto && (
        <div className="sus-fade" style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface || '#fff',
          display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={chatBoxRef} style={{ height: votando ? 150 : 220, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mensagens.length === 0 && <div style={{ fontSize: 12, color: T.textD, textAlign: 'center', marginTop: 20 }}>Ninguém falou nada ainda...</div>}
            {mensagens.map(m => (
              <div key={m.id} style={{ fontSize: 12.5, color: T.text }}>
                <b style={{ color: m.autor === name ? AGUA : T.textT }}>{m.autor.split(' ')[0]}:</b> {m.texto}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={chatTexto} onChange={e => setChatTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onEnviarChat(); }}
                maxLength={240} placeholder="Escreva algo suspeito..."
                style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`,
                  background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13 }} />
              <button className="sus-btn" onClick={onEnviarChat} disabled={!chatTexto.trim()}
                style={{ padding: '9px 16px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13,
                  cursor: chatTexto.trim() ? 'pointer' : 'not-allowed',
                  background: chatTexto.trim() ? `linear-gradient(135deg, ${AGUA}, ${CEU})` : T.textD }}>Enviar</button>
            </div>
            {reuniao.fase === 'chat' && (
              <button className="sus-btn" onClick={onIniciarVotacao}
                style={{ padding: '9px 12px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${IMPOSTOR_COR}, #FF7A85)`, boxShadow: `0 6px 16px ${IMPOSTOR_COR}44` }}>
                🗳️ Vamos votar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── VOTAÇÃO — painel em DUAS COLUNAS, no espírito do tablet do Among
          Us: título em cima, um cartão por pessoa lado a lado, e o botão de
          pular grandão no rodapé, ocupando a largura toda. ──────────────── */}
      {votando && (
        <div className="sus-fade" style={{ borderRadius: 18, border: `1.5px solid ${T.border}`, background: T.surfaceSub || 'rgba(0,0,0,.03)',
          padding: 14, boxShadow: T.sh }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text,
            textAlign: 'center', letterSpacing: '.02em', marginBottom: 4 }}>
            Quem é o Impostor?
          </div>
          <div style={{ fontSize: 11.5, color: T.textT, textAlign: 'center', marginBottom: 12 }}>
            Dá pra trocar de voto quantas vezes quiser até a votação fechar.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 9 }}>
            {players.map(p => {
              const votosNele = Object.entries(reuniao.votos || {}).filter(([, alvo]) => alvo === p.name).map(([quem]) => quem);
              const morto = mortos.includes(p.name);
              const escolhido = meuVoto === p.name;
              return (
                <button key={p.name} className="sus-btn" onClick={() => { if (!morto) onVotar(p.name); }}
                  disabled={morto}
                  title={morto ? `${p.name} já foi eliminado` : `Votar em ${p.name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, textAlign: 'left',
                    cursor: morto ? 'not-allowed' : 'pointer', minWidth: 0,
                    border: `2px solid ${morto ? 'rgba(220,38,38,.3)' : (escolhido ? IMPOSTOR_COR : T.border)}`,
                    background: morto ? 'rgba(220,38,38,.06)' : (escolhido ? `${IMPOSTOR_COR}14` : (T.surface || '#fff')),
                    opacity: morto ? .7 : 1 }}>
                  {/* Uniko + X vermelho por cima de quem morreu */}
                  <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
                    <img draggable={false} src={p.photo || '/UNIKO_NEW.png'} alt=""
                      style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', background: '#fff',
                        filter: morto ? 'grayscale(1) brightness(.72)' : 'none' }} />
                    {morto && (
                      <svg viewBox="0 0 24 24" width="46" height="46" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        <line x1="4" y1="4" x2="20" y2="20" stroke="#DC2626" strokeWidth="3.2" strokeLinecap="round" />
                        <line x1="20" y1="4" x2="4" y2="20" stroke="#DC2626" strokeWidth="3.2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: morto ? '#DC2626' : T.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: morto ? 'line-through' : 'none', textDecorationColor: morto ? '#DC2626' : undefined,
                      textDecorationThickness: morto ? '2px' : undefined }}>{p.name}</div>
                    {morto
                      ? <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', marginTop: 1 }}>Eliminado</div>
                      : votosNele.length > 0 && (
                        <div style={{ fontSize: 11, color: T.textT, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {votosNele.map(v => v.split(' ')[0]).join(', ')}
                        </div>
                      )}
                  </div>

                  {/* Contador de votos + selo de "esta pessoa já votou" */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {!morto && votosNele.length > 0 && (
                      <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 999, background: `${IMPOSTOR_COR}1f`,
                        color: IMPOSTOR_COR, fontSize: 12.5, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{votosNele.length}</span>
                    )}
                    {!morto && votantes.has(p.name) && <span title="Já votou" style={{ fontSize: 14 }}>✅</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* PULAR VOTAÇÃO — largura toda e bem alto, igual à barra do tablet */}
          <button className="sus-btn" onClick={() => onVotar(null)}
            style={{ width: '100%', marginTop: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '16px 14px', borderRadius: 14, cursor: 'pointer',
              border: pularEscolhido ? `2px solid ${AGUA}` : `2px dashed ${T.border}`,
              background: pularEscolhido ? `${AGUA}18` : 'transparent',
              color: pularEscolhido ? AGUA : T.textS, fontSize: 15.5, fontWeight: 800, letterSpacing: '.02em' }}>
            <span style={{ fontSize: 21 }}>{pularEscolhido ? '✅' : '⏭️'}</span>
            PULAR VOTAÇÃO
          </button>

          {jaVotei && (
            <button className="sus-btn" onClick={onRetirarVoto}
              style={{ width: '100%', marginTop: 7, padding: '9px 12px', borderRadius: 11, border: 'none', background: 'transparent',
                color: T.textD, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              ↩️ Retirar meu voto
            </button>
          )}
        </div>
      )}

      {reuniao.fase === 'resultado' && (
        <div className="sus-pop" style={{ textAlign: 'center', padding: '18px 10px', borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface || '#fff' }}>
          {!reuniao.resultado?.expulso ? (
            <>
              <div style={{ fontSize: 40 }}>🤷</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text }}>Ninguém foi expulso</div>
              <div style={{ fontSize: 12.5, color: T.textT, marginTop: 4 }}>{reuniao.resultado?.empate ? 'Deu empate na votação.' : 'Não teve maioria pra expulsar ninguém.'}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40 }}>{papeis?.[reuniao.resultado.expulso] === 'impostor' ? '🔪' : '🏖️'}</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text }}>{reuniao.resultado.expulso} foi expulso</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: papeis?.[reuniao.resultado.expulso] === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
                Era {papeis?.[reuniao.resultado.expulso] === 'impostor' ? 'IMPOSTOR! 🎉' : 'Tripulante... 😬'}
              </div>
              <div style={{ fontSize: 11.5, color: T.textT, marginTop: 6 }}>Agora ele é um 👻 fantasma — só consegue fazer tarefas.</div>
            </>
          )}
          {reuniao.resultado?.vencedor && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 32 }}>{reuniao.resultado.vencedor === 'impostor' ? '🔪' : '🏆'}</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800,
                color: reuniao.resultado.vencedor === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
                {reuniao.resultado.vencedor === 'impostor' ? 'O Impostor venceu!' : 'Os Tripulantes venceram!'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TaskModal = ({ task, onClose, onComplete }) => {
  const tipo = taskTypeFor(task.label);
  const Mini = TASK_MINIGAMES[tipo] || TaskGenerica;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,10,16,.72)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="sus-pop" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 380, borderRadius: 16, background: T.surface || '#fff', border: `1px solid ${T.border}`, boxShadow: '0 24px 70px rgba(0,0,0,.5)', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <StarIcon size={18} color="#3B82F6" />
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: T.text, flex: 1 }}>{task.label}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.textT, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Mini onComplete={onComplete} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY — lista de salas + criar sala
   ═══════════════════════════════════════════════════════════════════════════ */
const Lobby = ({ name, photo, porSala, onEnter, onAbrirPicker }) => {
  const [rooms, setRooms] = useState(null);
  const [erroSala, setErroSala] = useState('');
  const [criando, setCriando] = useState(false);
  const [nomeSala, setNomeSala] = useState('');
  const [impostores, setImpostores] = useState(1);
  const [confirmDel, setConfirmDel] = useState(null);
  const cardBg = T.surface || '#fff';

  const load = useCallback(async () => {
    let data, error;
    try {
      ({ data, error } = await supabase.from('uniko_suspect_state')
        .select('id, state, updated_at').order('updated_at', { ascending: false }));
    } catch (e) { error = e; }
    if (error) {
      setErroSala(semTabela(error) ? 'Falta rodar supabase_uniko_suspect.sql no Supabase.' : 'Não deu pra carregar as salas. Tentando de novo...');
      return;
    }
    setErroSala('');
    setRooms(data || []);
    const velhas = (data || []).filter(r => !(porSala[r.id]?.length) && Date.now() - new Date(r.updated_at).getTime() > ROOM_TTL_MS);
    if (velhas.length) {
      await supabase.from('uniko_suspect_state').delete().in('id', velhas.map(r => r.id));
      setRooms(rs => (rs || []).filter(r => !velhas.some(v => v.id === r.id)));
    }
  }, [porSala]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase.channel('uniko-suspect-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_suspect_state' }, load)
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [load]);

  const criarSala = async () => {
    const nome = nomeSala.trim() || `Sala do ${name.split(' ')[0]}`;
    const id = Math.random().toString(36).slice(2, 8);
    setErroSala('');
    const { error } = await supabase.from('uniko_suspect_state').insert({
      id, state: { phase: 'lobby', round: 0, nome, criador: name, impostoresQtd: impostores },
    });
    if (error) { setErroSala('Não deu pra criar a sala. Tente de novo.'); console.error('[uniko-suspect] criar:', error); return; }
    onEnter(id);
  };
  const excluir = async (id) => {
    setConfirmDel(null);
    const { error } = await supabase.from('uniko_suspect_state').delete().eq('id', id);
    if (error) { setErroSala('Não deu pra excluir a sala.'); return; }
    setRooms(rs => (rs || []).filter(r => r.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <style>{SUS_CSS}</style>
      {/* Cabeçalho */}
      <div style={{ borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        background: `linear-gradient(120deg, ${AGUA} 0%, ${CEU} 55%, ${AREIA} 120%)`,
        boxShadow: `0 8px 26px ${AG}`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .16, pointerEvents: 'none',
          background: 'radial-gradient(circle at 10% 20%, #fff 0%, transparent 45%)' }} />
        {/* Vidro escuro no lugar do bloco branco sólido — o branco chapado
            destoava demais agora que o módulo inteiro é escuro. */}
        <div className="sus-float" style={{ width: 62, height: 62, borderRadius: 16, flexShrink: 0, position: 'relative',
          background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
          boxShadow: '0 6px 18px rgba(0,0,0,.3)' }}><img draggable={false} src={UNIKO_DETETIVE_ICONE} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} /></div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: '#fff' }}>Uniko Detetive</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.9)' }}>Tripulantes x Impostor — casa de praia 🏖️</div>
        </div>
        <button className="sus-btn" onClick={onAbrirPicker} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.2)', cursor: 'pointer', flexShrink: 0 }}>
          <img draggable={false} src={photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Meu Uniko</span>
        </button>
        <button className="sus-btn" onClick={() => setCriando(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999,
            background: 'rgba(8,16,30,.85)', color: '#fff', border: '1px solid rgba(255,255,255,.3)',
            fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,.3)' }}>
          + Criar sala
        </button>
      </div>

      {/* Criar sala */}
      {criando && (
        <div className="sus-fade" style={{ background: cardBg, border: `1px solid ${AGUA}55`, borderRadius: 14, padding: 16, boxShadow: T.sh, flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 11 }}>Nova sala</div>
          <input value={nomeSala} onChange={e => setNomeSala(e.target.value)} maxLength={28}
            onKeyDown={e => e.key === 'Enter' && criarSala()} placeholder={`Sala do ${name.split(' ')[0]}`}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surfaceInput || 'rgba(0,0,0,.025)',
              color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />

          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em', marginBottom: 7 }}>IMPOSTORES</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[1, 2, 3].map(n => (
              <button key={n} className="sus-btn" onClick={() => setImpostores(n)}
                style={{ padding: '7px 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700,
                  border: `1.5px solid ${impostores === n ? IMPOSTOR_COR : T.border}`, background: impostores === n ? `${IMPOSTOR_COR}18` : 'transparent',
                  color: impostores === n ? IMPOSTOR_COR : T.textS }}>
                {n} {n === 1 ? 'impostor' : 'impostores'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em', marginBottom: 7 }}>MAPA — Casa de Praia 🏖️</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {ROOMS.map(r => (
              <span key={r.id} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                background: `${AGUA}12`, border: `1px solid ${AGUA}33`, color: T.text }}>{r.emoji} {r.nome}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.textT, marginBottom: 14 }}>Piadas internas confirmadas: {PIADAS.join('  ·  ')}</div>

          {erroSala && <div style={{ fontSize: 12, color: '#C04050', marginBottom: 10 }}>{erroSala}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="sus-btn" onClick={criarSala}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                background: `linear-gradient(135deg, ${AGUA}, ${CEU})`, boxShadow: `0 4px 14px ${AG}` }}>Criar e entrar</button>
            <button className="sus-btn" onClick={() => setCriando(false)}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de salas */}
      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginBottom: 10 }}>SALAS ({(rooms || []).length})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 340px))', justifyContent: 'start', gap: 12 }}>
          {(rooms || []).map(r => {
            const st = r.state || {};
            const gente = porSala[r.id] || [];
            const jogando = st.phase && st.phase !== 'lobby' && st.phase !== 'over';
            /* Partida em andamento = porta fechada (ago/2026). Ninguém NOVO
               entra no meio do jogo — chegar depois do sorteio deixava a
               pessoa sem papel e bagunçava a contagem de vivos. Quem já foi
               sorteado pra ESTA partida continua podendo voltar (um F5 no
               meio do jogo não pode expulsar a pessoa da própria sala). */
            const souDaPartida = !!st.papeis?.[name];
            const portaFechada = !!jogando && !souDaPartida;
            const podeExcluir = st.criador === name; // dentro deste tab, todo mundo que vê já é admin
            return (
              <div key={r.id} className="sus-fade" style={{ background: cardBg, borderRadius: 14, padding: 14, border: `1.5px solid ${T.border}`,
                boxShadow: T.sh, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${AGUA}18`, border: `1px solid ${AGUA}33` }}><img draggable={false} src={UNIKO_DETETIVE_ICONE} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.nome || 'Sala'}</div>
                    <div style={{ fontSize: 11, color: T.textT, marginTop: 2 }}>{st.impostoresQtd || 1} impostor{(st.impostoresQtd || 1) > 1 ? 'es' : ''}</div>
                  </div>
                  {jogando && <div style={{ padding: '3px 8px', borderRadius: 999, background: `${IMPOSTOR_COR}18`, color: IMPOSTOR_COR, fontSize: 9.5, fontWeight: 800 }}>EM JOGO</div>}
                  {podeExcluir && (
                    <button className="sus-btn" onClick={() => setConfirmDel(r.id)} title="Excluir sala"
                      style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.textT, cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 30 }}>
                  {gente.length ? (
                    <>
                      <div style={{ display: 'flex' }}>
                        {gente.slice(0, 6).map((p, i) => (
                          <img draggable={false} key={p.name} src={p.photo || '/UNIKO_NEW.png'} alt="" title={p.name}
                            style={{ width: 27, height: 27, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11.5, color: T.textT }}>{gente.length === 1 ? `${gente[0].name.split(' ')[0]} está aqui` : `${gente.length} jogadores`}</span>
                    </>
                  ) : <span style={{ fontSize: 11.5, color: T.textD }}>Vazia — seja o primeiro</span>}
                </div>
                <button className="sus-btn" onClick={() => { if (!portaFechada) onEnter(r.id); }} disabled={portaFechada}
                  title={portaFechada ? 'A partida já começou — espere a próxima' : undefined}
                  style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
                    cursor: portaFechada ? 'not-allowed' : 'pointer', opacity: portaFechada ? .55 : 1,
                    background: portaFechada ? T.textD : `linear-gradient(135deg, ${AGUA}, ${CEU})`,
                    boxShadow: portaFechada ? 'none' : `0 4px 14px ${AG}` }}>
                  {portaFechada ? '🔒 Partida em andamento' : (jogando && souDaPartida ? 'Voltar pra partida' : 'Entrar')}
                </button>
                {confirmDel === r.id && (
                  <div className="sus-pop" style={{ position: 'absolute', inset: 0, borderRadius: 14, zIndex: 2, background: 'rgba(8,16,30,.97)',
                    border: '1px solid #E6394655', padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Excluir esta sala?</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="sus-btn" onClick={() => excluir(r.id)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#E63946', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                      <button className="sus-btn" onClick={() => setConfirmDel(null)} style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {erroSala ? (
          <div style={{ textAlign: 'center', padding: 30, color: T.textT, fontSize: 13, lineHeight: 1.6 }}>{erroSala}</div>
        ) : rooms === null ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.textD, fontSize: 13 }}>Carregando salas...</div>
        ) : !rooms.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 40 }}>🏖️</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, color: T.text, maxWidth: 380, lineHeight: 1.3 }}>
              Nenhuma sala aberta agora — crie a sua e chame a galera!
            </div>
            <div style={{ fontSize: 12.5, color: T.textT }}>Use o botão <b style={{ color: AGUA }}>Criar sala</b> ali em cima 👆 (mínimo {MIN_PLAYERS} jogadores pra começar)</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   BARCO — a "sala de espera" de verdade: todo mundo anda livre pelo convés
   (WASD, mesmo esquema do jogo) enquanto o host não aperta Iniciar Partida.
   Posição vai só por BROADCAST no canal da sala (evento barco-pos/-req,
   mesmo princípio da posição no mapa principal — efêmera, não persiste).
   ═══════════════════════════════════════════════════════════════════════════ */
const BarcoLobby = ({ name, players, isHost, impostoresQtd, podeIniciar, onEscolherImpostores, onIniciar, myPos, setMyPos, positions, chanRef }) => {
  const pressedRef = useRef(new Set());
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const lastSentRef = useRef(0);
  const myPosRef = useRef(myPos);
  useEffect(() => { myPosRef.current = myPos; }, [myPos]);
  const [isMoving, setIsMoving] = useState(false);
  const isMovingRef = useRef(false);

  useEffect(() => {
    // Reforça o pedido 1s depois — o canal pode ainda não estar com a
    // conexão realtime totalmente estabelecida no primeiro envio (a sala
    // acabou de montar), então o primeiro `send` às vezes se perde.
    chanRef.current?.send({ type: 'broadcast', event: 'barco-pos-req', payload: { name } });
    const reforco = setTimeout(() => chanRef.current?.send({ type: 'broadcast', event: 'barco-pos-req', payload: { name } }), 1000);
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (!KEY_DIR[k]) return;
      pressedRef.current.add(k);
      e.preventDefault();
    };
    const onKeyUp = (e) => { pressedRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    lastTsRef.current = performance.now();
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      let dx = 0, dy = 0;
      pressedRef.current.forEach(k => { const d = KEY_DIR[k]; if (d) { dx += d[0]; dy += d[1]; } });
      const movendo = !!(dx || dy);
      if (movendo !== isMovingRef.current) { isMovingRef.current = movendo; setIsMoving(movendo); }
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        const cur = myPosRef.current;
        let nx = cur.x + (dx / len) * BARCO_MOVE_SPEED * dt;
        let ny = cur.y + (dy / len) * BARCO_MOVE_SPEED * dt;
        // Testa X e Y em separado — desliza na amurada em vez de travar na diagonal.
        if (!estaNoBarco(nx, cur.y)) nx = cur.x;
        if (!estaNoBarco(nx, ny)) ny = cur.y;
        if (nx !== cur.x || ny !== cur.y) {
          myPosRef.current = { x: nx, y: ny };
          setMyPos({ x: nx, y: ny });
          const now = performance.now();
          if (now - lastSentRef.current >= POS_SEND_MS) {
            lastSentRef.current = now;
            chanRef.current?.send({ type: 'broadcast', event: 'barco-pos', payload: { name, x: nx, y: ny } });
          }
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    const teclas = pressedRef.current;
    return () => {
      clearTimeout(reforco);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      teclas.clear();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [chanRef, name, setMyPos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 1180, margin: '0 auto', aspectRatio: `${MAP_W} / ${MAP_H}`,
        borderRadius: 16, overflow: 'hidden', border: `2px solid ${T.border}`, boxShadow: T.sh }} className="sus-ocean">
        <div className="sus-wave-lines" />
        {/* Nuvens ATRÁS do barco (passam ao fundo) */}
        <div className="sus-nuvem sus-nuvem-a" />
        <div className="sus-nuvem sus-nuvem-b" />
        <div className="sus-boat-sway" style={{ position: 'absolute', inset: 0 }}>
          <img src={BARCO_IMG} alt="" draggable={false}
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }} />
          {players.map(p => {
            const eu = p.name === name;
            const pos = eu ? myPos : (positions[p.name] || { x: BARCO_ELIPSE.cx, y: BARCO_ELIPSE.cy });
            return (
              <div key={p.name} style={{ position: 'absolute', left: `${pos.x / MAP_W * 100}%`, top: `${pos.y / MAP_H * 100}%`,
                width: `${(BARCO_PLAYER_R * 1.2 / MAP_W) * 100}%`, transform: 'translate(-50%,-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6%',
                pointerEvents: 'none', transition: eu ? 'none' : 'left .12s linear, top .12s linear', zIndex: eu ? 3 : 2 }}>
                <img draggable={false} src={p.photo || '/UNIKO_NEW.png'} alt="" className={eu && isMoving ? 'sus-walk' : undefined}
                  style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain',
                    filter: eu ? `drop-shadow(0 3px 6px rgba(0,0,0,.5)) drop-shadow(0 0 9px ${AGUA}cc)` : 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' }} />
                <span style={{ fontSize: 'clamp(11px, 1.5vw, 16px)', fontWeight: 800, color: '#1a1320', background: 'rgba(255,255,255,.88)',
                  borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                  {p.name.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Botão do host, DENTRO do barco — fixo no canto inferior. */}
        {/* Névoa NA FRENTE do barco: passar por cima dos bonecos é o que dá a
            sensação de profundidade. Fica abaixo dos controles (zIndex 5) pra
            não embaçar botão nem nome de jogador. */}
        <div className="sus-nevoa-alta" style={{ zIndex: 3 }} />
        <div className="sus-nevoa-baixa" style={{ zIndex: 4 }} />

        {isHost && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', borderRadius: 999, padding: '5px 10px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Impostores:</span>
              {[1, 2, 3].map(n => (
                <button key={n} className="sus-btn" onClick={() => onEscolherImpostores(n)}
                  style={{ padding: '4px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 800,
                    border: `1.5px solid ${impostoresQtd === n ? IMPOSTOR_COR : 'rgba(255,255,255,.4)'}`,
                    background: impostoresQtd === n ? IMPOSTOR_COR : 'transparent', color: '#fff' }}>
                  {n}
                </button>
              ))}
            </div>
            <button className="sus-btn" onClick={onIniciar} disabled={!podeIniciar}
              style={{ padding: '13px 30px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, cursor: podeIniciar ? 'pointer' : 'not-allowed',
                background: podeIniciar ? `linear-gradient(135deg, ${IMPOSTOR_COR}, #FF7A85)` : 'rgba(255,255,255,.25)',
                boxShadow: podeIniciar ? `0 8px 22px ${IMPOSTOR_COR}66` : 'none', opacity: podeIniciar ? 1 : .7 }}>
              🚢 Iniciar Partida
            </button>
            {!podeIniciar && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(0,0,0,.45)', borderRadius: 999, padding: '3px 10px' }}>Precisa de pelo menos {MIN_PLAYERS} jogadores</div>}
          </div>
        )}
        {!isHost && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', zIndex: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', borderRadius: 999, padding: '5px 14px' }}>
              Aguardando o host começar... ({impostoresQtd || 1} impostor{(impostoresQtd || 1) > 1 ? 'es' : ''})
            </span>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: T.textT }}>Use <b>WASD</b> ou as <b>setas</b> pra andar pelo convés enquanto espera.</div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SALA — lobby da partida, sorteio de papéis e placeholder do jogo
   ═══════════════════════════════════════════════════════════════════════════ */
const Sala = ({ roomId, name, photo, players, onLeave, onAbrirPicker }) => {
  const [state, setState] = useState(null);
  const chanRef = useRef(null);
  const stateRef = useRef(null);
  const hostRef = useRef(false);
  const playersRef = useRef([]);
  const cardBg = T.surface || '#fff';

  /* ── Som ambiente: toca no lobby e na partida; troca pela trilha de "luzes
     apagadas" enquanto a sabotagem de energia estiver ativa. ── */
  const [mudo, setMudo] = useState(() => { try { return localStorage.getItem(SOM_MUDO_KEY) === '1'; } catch { return false; } });
  const trilhasRef = useRef(null);
  const fadeRef = useRef({});
  const luzesApagadas = !!state?.sabotagem;

  // Cria as duas trilhas uma vez e derruba tudo ao sair da sala.
  useEffect(() => {
    const t = { normal: criarTrilha(SOM_AMBIENTE), apagado: criarTrilha(SOM_LUZES_APAGADAS) };
    trilhasRef.current = t;
    return () => {
      Object.values(fadeRef.current).forEach(iv => iv && clearInterval(iv));
      for (const el of Object.values(t)) { try { el.pause(); el.src = ''; } catch { /* já solto */ } }
      trilhasRef.current = null;
    };
  }, []);

  // Decide QUAL trilha deve estar tocando e faz o crossfade.
  useEffect(() => {
    const t = trilhasRef.current; if (!t) return;
    const ativa = luzesApagadas ? t.apagado : t.normal;
    const outra = luzesApagadas ? t.normal : t.apagado;

    Object.values(fadeRef.current).forEach(iv => iv && clearInterval(iv));
    fadeRef.current = {};

    if (mudo) {
      fadeRef.current.a = fadeVolume(ativa, 0, () => { try { ativa.pause(); } catch { /* ok */ } });
      fadeRef.current.b = fadeVolume(outra, 0, () => { try { outra.pause(); } catch { /* ok */ } });
      return;
    }
    // `play()` pode ser recusado se o navegador ainda não viu um gesto — sem
    // problema: entrar na sala É um clique, então na prática já está liberado,
    // e se falhar o próximo efeito (ex. começar a partida) tenta de novo.
    ativa.play().catch(() => { /* autoplay bloqueado até a 1ª interação */ });
    fadeRef.current.a = fadeVolume(ativa, SOM_VOLUME);
    fadeRef.current.b = fadeVolume(outra, 0, () => { try { outra.pause(); } catch { /* ok */ } });
  }, [luzesApagadas, mudo]);

  // O mesmo botão de mudo cala trilha E efeitos.
  useEffect(() => { setEfeitosMudos(mudo); }, [mudo]);

  /* Som de "partida começou": dispara na TRANSIÇÃO pra fase de revelação de
     papéis, não no clique do host — assim todo mundo na sala ouve, não só
     quem apertou o botão. O ref guarda a fase anterior pra não tocar de novo
     a cada re-render enquanto a fase continua a mesma. */
  const fasePrevRef = useRef(null);
  useEffect(() => {
    const fase = state?.phase;
    if (fase && fase !== fasePrevRef.current) {
      if (fase === 'sorteando' && fasePrevRef.current !== null) tocarEfeito('partida');
      fasePrevRef.current = fase;
    }
  }, [state?.phase]);

  const alternarMudo = () => setMudo(m => {
    const novo = !m;
    try { localStorage.setItem(SOM_MUDO_KEY, novo ? '1' : '0'); } catch { /* sem localStorage */ }
    return novo;
  });

  // `pushState` sobe cedo (várias funções abaixo dependem dele — tarefas,
  // reunião de emergência etc.) pra evitar "usado antes de declarado".
  const aplicaEstado = useCallback((st) => {
    if (!st) return;
    const atual = stateRef.current;
    if (atual?.ts && st.ts && st.ts < atual.ts) return;
    stateRef.current = st; setState(st);
  }, []);
  /* `ts` é um relógio LÓGICO (estilo Lamport), NÃO a hora do computador.
     Com `Date.now()` puro, bastava UM jogador com o relógio adiantado pra
     travar a partida inteira: o ts dele ficava no futuro e, a partir daí,
     toda gravação dos outros nascia com ts MENOR e era descartada pelo guard
     de `aplicaEstado` — tanto em quem gravou quanto em todo mundo. Era esse
     o bug de "concluí a tarefa e não foi", "não dá pra reportar corpo nem
     chamar reunião" e "o impostor não mata a segunda pessoa": a gravação
     saía, mas ninguém aceitava. Agora cada gravação usa o MAIOR entre agora
     e o último ts conhecido + 1, então o carimbo só anda pra frente, não
     importa o relógio de quem grava. */
  const pushState = useCallback(async (next) => {
    const conhecido = Math.max(stateRef.current?.ts || 0, next?.ts || 0);
    const carimbado = { ...next, ts: Math.max(Date.now(), conhecido + 1) };
    aplicaEstado(carimbado);
    try { await supabase.from('uniko_suspect_state').update({ state: carimbado, updated_at: new Date().toISOString() }).eq('id', roomId); }
    catch (e) { console.error('[uniko-suspect] pushState:', e); }
  }, [roomId, aplicaEstado]);

  /* ── Escrita SEGURA no estado da sala (ago/2026) ────────────────────────
     `pushState` grava o jsonb INTEIRO. Quando dois clientes gravavam quase
     ao mesmo tempo — o que acontece o tempo todo durante a SABOTAGEM, com
     cada tripulante mandando "consertei" e o impostor matando no meio —, o
     último a escrever apagava por cima o que o outro tinha acabado de
     gravar. Era esse o bug do "com a energia sabotada o impostor não
     consegue matar ninguém": a morte ia pro banco e o `consertarEnergia` de
     outra pessoa, montado em cima de um estado ANTIGO, desfazia tudo.
     `mutateState` relê a linha do banco na hora, aplica a mudança em cima do
     estado FRESCO e só então grava (a janela de corrida cai de segundos pra
     poucos milissegundos). `fn` recebe o estado atual e devolve o próximo —
     ou null pra desistir (as travas do jogo são reavaliadas lá dentro, já
     com o estado de verdade). */
  const mutateState = useCallback(async (fn) => {
    let remoto = null;
    try {
      const { data } = await supabase.from('uniko_suspect_state').select('state').eq('id', roomId).maybeSingle();
      remoto = data?.state || null;
    } catch (e) { console.error('[uniko-suspect] mutateState:', e); }
    // O estado local é relido DEPOIS do await, não antes: enquanto a leitura
    // ia e voltava, o realtime pode ter trazido algo mais novo, e comparar
    // com o retrato velho fazia a gravação apagar o que acabou de chegar.
    const local = stateRef.current;
    // Só adota o remoto se ele for de VERDADE mais novo E da mesma partida —
    // uma resposta atrasada (ou de uma rodada anterior) como base fazia as
    // travas do jogo ("já tem reunião", "jogo decidido") barrarem a ação.
    const base = (remoto && (remoto.ts || 0) > (local?.ts || 0) && (remoto.round ?? 0) === (local?.round ?? 0))
      ? remoto : local;
    const proximo = fn(base);
    if (proximo) await pushState(proximo);
  }, [roomId, pushState]);

  /* ── Movimento livre no mapa (Fase 3) ──────────────────────────────────
     Posição NÃO entra no `state` (jsonb persistido) — muda rápido demais e é
     efêmera, então vai só por BROADCAST (mesmo princípio dos traços do Uniko
     Paint). `myPos` é a MINHA posição (autoridade local); `positions` guarda
     a posição recebida de cada outro jogador. */
  const [myPos, setMyPos] = useState(() => spawnFor(name));
  const [positions, setPositions] = useState({});
  const myPosRef = useRef(myPos);
  const pressedRef = useRef(new Set());
  const [isMoving, setIsMoving] = useState(false);   // eu — liga a animação de "andar" (sus-walk) no meu boneco
  const isMovingRef = useRef(false);
  const rafRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastTsRef = useRef(0);
  /* ── Fix de travamento/delay (ago/2026): antes, CADA frame de movimento
     chamava `setMyPos`, forçando o React a re-renderizar a ÁRVORE INTEIRA
     (jogadores + estrelas de tarefa + emergência + luz) a 60fps — pesado
     demais e sentia como "travando". Agora câmera/meu-boneco/luz são
     atualizados DIRETO no DOM (via ref, sem passar pelo React) a cada
     frame — suave de verdade — e `setMyPos`/broadcast de rede só disparam
     no ritmo mais lento de sempre (`POS_SEND_MS`), só pra manter coisas que
     PRECISAM de re-render (prompt de tarefa próxima) atualizadas. Como o
     JSX abaixo lê `myPosRef.current` (nunca desatualizado) em vez do
     estado `myPos`, esses re-renders mais raros nunca "voltam" a posição
     antiga por um instante — sempre pintam a posição real atual. */
  const worldRef = useRef(null);
  const myMarkerRef = useRef(null);
  const lightRef = useRef(null);
  const setaRef = useRef(null);          // seta que aponta pra sala de energia durante a sabotagem
  const energiaAlvoRef = useRef(null);   // { x, y } da tarefa de energia mais perto (null = sem sabotagem)
  const meuPapelRef = useRef(null);
  const souFantasmaRef = useRef(false);
  const sabotagemAtivaRef = useRef(false);
  const vitimaProximaRef = useRef(null);
  const matarRef = useRef(null);
  const morteAnimRef = useRef(null);
  const corpoProximoRef = useRef(null);
  const reportarRef = useRef(null);
  const explodirVortexRef = useRef(null);   // o canal de broadcast monta uma vez só e precisa da versão atual

  /* ── Seta pra sala de energia (ago/2026) ────────────────────────────────
     Com a luz sabotada ninguém achava o painel no escuro. Enquanto a
     sabotagem estiver de pé, quem ainda não consertou vê uma seta girando
     em volta do próprio boneco, apontando EM TEMPO REAL pra tarefa de
     energia mais perto (igual à setinha de sabotagem do Among Us).
     Pintada direto no DOM, junto do resto do visual — o estado do React só
     acompanha o movimento no ritmo lento do broadcast, e a seta ficaria
     "pulando". */
  /* Toda partida NOVA recomeça com o boneco no centro (ver spawnFor) — sem
     isso quem já estava no mapa continuava exatamente de onde tinha parado
     na rodada anterior, enquanto quem acabou de chegar nascia no meio.
     Ajustado durante o render (padrão oficial do React pra "resetar estado
     quando algo muda"), não num efeito com setState solto. */
  const [agoraTick, setAgoraTick] = useState(() => Date.now());   // `Date.now()` só no efeito (regra do React Compiler)
  useEffect(() => { const iv = setInterval(() => setAgoraTick(Date.now()), 500); return () => clearInterval(iv); }, []);
  const [roundVisto, setRoundVisto] = useState(state?.round ?? 0);
  const [killLiberadoEm, setKillLiberadoEm] = useState(0);   // trégua inicial do impostor, no relógio DESTA máquina
  const killLiberadoRef = useRef(0);
  if ((state?.round ?? 0) !== roundVisto) {
    setRoundVisto(state?.round ?? 0);
    setMyPos(spawnFor());   // `myPosRef` (o que o loop de 60fps lê) acompanha no efeito de [myPos]
    /* Zerar as posições DOS OUTROS é o que faltava pra todo mundo realmente
       renascer no centro: `positions` só muda quando chega broadcast, e
       ninguém manda nada enquanto está parado. Então, na partida seguinte,
       cada boneco continuava desenhado onde tinha parado na anterior até a
       pessoa dar o primeiro passo. Com a lista vazia, o desenho cai no
       fallback `spawnFor()` — o centro — até a primeira posição de verdade
       chegar. */
    setPositions({});
    setKillLiberadoEm(agoraTick + KILL_GRACA_INICIAL_MS);   // relógio LOCAL — ver KILL_GRACA_INICIAL_MS
  }
  /* `myPosRef` é a autoridade de verdade: é ele que o loop de 60fps lê, que
     pinta o boneco no DOM e que vai no broadcast — `myPos` (estado do React)
     só acompanha de longe. Sem zerar o REF junto, o `setMyPos(spawnFor())`
     acima não mudava nada na prática e todo mundo reaparecia exatamente onde
     tinha parado na partida anterior (o efeito de `[myPos]` que o comentário
     acima menciona só existe no `BarcoLobby`, nunca existiu aqui). */
  useEffect(() => { myPosRef.current = spawnFor(); }, [roundVisto]);

  const pintarSeta = useCallback(() => {
    const seta = setaRef.current; if (!seta) return;
    const alvo = energiaAlvoRef.current;
    if (!alvo) { seta.style.display = 'none'; return; }
    const { x, y } = myPosRef.current;
    const ang = Math.atan2(alvo.y - y, alvo.x - x) * 180 / Math.PI;
    seta.style.display = 'block';
    seta.style.left = `${x / MAP_W * 100}%`;
    seta.style.top = `${y / MAP_H * 100}%`;
    seta.style.transform = `rotate(${ang}deg)`;
  }, []);

  /* ── Barco do lobby (ago/2026): mesma lógica de posição-por-broadcast do
     mapa principal, só que com coordenadas próprias (dentro da elipse do
     convés) e só ativo na fase 'lobby'. */
  const [myBarcoPos, setMyBarcoPos] = useState(() => ({ x: BARCO_ELIPSE.cx, y: BARCO_ELIPSE.cy }));
  const [barcoPositions, setBarcoPositions] = useState({});
  const myBarcoPosRef = useRef(myBarcoPos);
  useEffect(() => { myBarcoPosRef.current = myBarcoPos; }, [myBarcoPos]);

  /* ── Tela cheia: mesmo padrão do botão "tela cheia" do Portal
     (central-colaborador/index.jsx) — só que aplicado no BLOCO DO JOGO
     (cabeçalho + mapa), não na página inteira. */
  const gameWrapRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Enquanto a partida roda o jogo cobre a janela toda (portal + fixed) —
  // travar o scroll do body evita a página de trás rolando por baixo quando
  // a pessoa arrasta/usa as setas.
  // Vale da REVELAÇÃO em diante: a tela de "você é Impostor/Tripulante" já
  // cobre a janela inteira igual ao mapa (ver o createPortal lá embaixo), e
  // o Assistente Uniko não pode ficar flutuando por cima dela.
  const jogando = state?.phase === 'jogando' || state?.phase === 'sorteando';
  useEffect(() => {
    if (!jogando) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // A classe some com o Assistente Uniko (ver regra em SUS_CSS): ele é
    // `position:fixed` com z-index acima do jogo, então ficava flutuando por
    // cima do mapa e atrapalhando. Some só enquanto a partida roda.
    document.body.classList.add('sus-jogando');
    return () => {
      document.body.style.overflow = anterior;
      document.body.classList.remove('sus-jogando');
    };
  }, [jogando]);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      const el = gameWrapRef.current; if (!el) return;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  };

  useEffect(() => { loadWallMaskFromDB(); }, []);

  /* ── Tarefas + botão de emergência (ago/2026): posições marcadas no editor
     do Dashboard RH (tabela uniko_suspect_map). Carrega uma vez ao entrar
     no mapa — o editor sobe um registro novo, então basta reentrar na sala
     pra ver mudanças (mesmo padrão simples do wallmask). */
  const [mapaTarefas, setMapaTarefas] = useState([]);
  const [mapaEmergencia, setMapaEmergencia] = useState(null);
  const [mapaVortex, setMapaVortex] = useState([]);     // portais do Impostor
  const [mapaCameras, setMapaCameras] = useState([]);   // pontos de vigilância
  const [emergMsg, setEmergMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.from('uniko_suspect_map').select('tasks, emergency_x, emergency_y, vortexes, cameras').eq('id', 1).maybeSingle();
        if (!vivo) return;
        setMapaTarefas(Array.isArray(data?.tasks) ? data.tasks : []);
        setMapaVortex(Array.isArray(data?.vortexes) ? data.vortexes : []);
        setMapaCameras(Array.isArray(data?.cameras) ? data.cameras : []);
        if (data?.emergency_x != null && data?.emergency_y != null) setMapaEmergencia({ x: data.emergency_x, y: data.emergency_y });
      } catch (e) { console.error('[uniko-suspect] mapa tarefas/emergencia:', e); }
    })();
    return () => { vivo = false; };
  }, []);

  /* ── Estado de tarefas concluídas: fica dentro do `state` compartilhado da
     sala (uniko_suspect_state.tasksDone[meuNome] = [taskId,...]) — assim
     sobrevive a um F5. Cada jogador só escreve a PRÓPRIA chave do mapa, e
     só ELE vê a própria estrela virar verde (o "dela" do pedido do usuário):
     tarefas são individuais, cada um faz a sua. */
  const [tarefaAberta, setTarefaAberta] = useState(null);
  const [brilhoTarefa, setBrilhoTarefa] = useState(null);   // id da tarefa com o brilho de conclusão
  const tarefaAbertaRef = useRef(null);
  useEffect(() => { tarefaAbertaRef.current = tarefaAberta; }, [tarefaAberta]);
  const minhasFeitas = useMemo(() => new Set(state?.tasksDone?.[name] || []), [state?.tasksDone, name]);
  const tarefaProxima = useMemo(() => {
    // Impostor não tem tarefa de verdade (só os Tripulantes/fantasmas fazem).
    // Fantasma "só faz tarefa" — continua interagindo com elas mesmo com
    // reunião rolando (os vivos ficam congelados na reunião, ele não).
    if (state?.papeis?.[name] === 'impostor' || state?.vencedor) return null;
    if (state?.phase !== 'jogando' || (state?.reuniao && !state?.fantasmas?.includes(name))) return null;
    let melhor = null, melhorD = Infinity;
    // Fantasma fica FORA da sabotagem (ago/2026, pedido do usuário): ele não
    // conserta, não conta na chamada e não tem as tarefas travadas — segue
    // fazendo as dele normalmente enquanto os vivos correm pra energia.
    const fantasma = !!state?.fantasmas?.includes(name);
    for (const t of mapaTarefas) {
      if (state?.sabotagem && !fantasma) {
        // Sabotagem ativa: SÓ a tarefa de consertar energia libera (ver
        // TaskEnergia/consertarEnergia) — e some assim que EU já consertei
        // nessa sabotagem, mesmo que outros ainda não tenham terminado.
        if (taskTypeFor(t.label) !== 'energia' || state?.sabotagem?.consertadoPor?.includes(name)) continue;
      } else if (minhasFeitas.has(t.id)) continue;
      const d = Math.hypot(t.x - myPos.x, t.y - myPos.y);
      if (d < TASK_PROXIMIDADE && d < melhorD) { melhor = t; melhorD = d; }
    }
    return melhor;
  }, [mapaTarefas, minhasFeitas, myPos, state?.phase, state?.reuniao, state?.fantasmas, state?.papeis, state?.sabotagem, state?.vencedor, name]);
  const tarefaProximaRef = useRef(null);
  useEffect(() => { tarefaProximaRef.current = tarefaProxima; }, [tarefaProxima]);

  /* Sabotagem corta a tarefa que estiver ABERTA na hora ────────────────────
     A regra "só a de energia funciona durante a sabotagem" já valia pra abrir
     uma tarefa nova, mas quem estivesse no meio de um mini-jogo quando a luz
     caiu terminava ele numa boa — dava pra ignorar a sabotagem inteira só
     começando a tarefa antes. Agora, ao ligar a sabotagem, qualquer tarefa
     aberta que NÃO seja a de consertar energia fecha na hora. */
  const sabotagemAtiva = !!state?.sabotagem && !state?.fantasmas?.includes(name);   // fantasma não é afetado pela sabotagem
  useEffect(() => {
    if (!sabotagemAtiva) return;
    const aberta = tarefaAbertaRef.current;
    if (aberta && taskTypeFor(aberta.label) !== 'energia') setTarefaAberta(null);
  }, [sabotagemAtiva]);

  /* ── Vórtex (ago/2026): portais marcados no editor. Só o IMPOSTOR usa —
     chega perto de um, escolhe outro e reaparece lá (as "tubulações" do
     Among Us). Com menos de 2 marcados não há destino, então nem aparece. */
  const [vortexAberto, setVortexAberto] = useState(null);   // vórtex em que estou, null = fechado
  const vortexProximo = useMemo(() => {
    if (state?.papeis?.[name] !== 'impostor' || state?.vencedor) return null;
    if (state?.phase !== 'jogando' || state?.reuniao) return null;
    // Impostor virado fantasma não teleporta mais (o campo antigo `mortos`
    // não existe mais — quem morre/é expulso entra em `fantasmas`).
    if (state?.fantasmas?.includes(name) || mapaVortex.length < 2) return null;
    let melhor = null, melhorD = Infinity;
    for (const v of mapaVortex) {
      const d = Math.hypot(v.x - myPos.x, v.y - myPos.y);
      if (d < VORTEX_PROXIMIDADE && d < melhorD) { melhor = v; melhorD = d; }
    }
    return melhor;
  }, [mapaVortex, myPos, state?.papeis, state?.phase, state?.reuniao, state?.fantasmas, state?.vencedor, name]);
  const vortexProximoRef = useRef(null);
  useEffect(() => { vortexProximoRef.current = vortexProximo; }, [vortexProximo]);

  /* ── Câmeras (ago/2026): qualquer jogador que chegar perto de um ponto de
     câmera abre o painel e vê as outras ao vivo (as posições já chegam por
     broadcast — dá pra flagrar um assassinato acontecendo). ── */
  const [cameraAberta, setCameraAberta] = useState(null);   // índice da câmera sendo vista, null = fechado
  const cameraProxima = useMemo(() => {
    if (state?.vencedor || state?.phase !== 'jogando') return null;
    if (state?.reuniao && !state?.fantasmas?.includes(name)) return null;
    // A SALA DE ANEXO é a câmera #1 (a primeira marcada no editor): é o único
    // lugar de onde se assiste. As outras são só os ângulos que aparecem lá.
    const console_ = mapaCameras[0];
    if (!console_) return null;
    const d = Math.hypot(console_.x - myPos.x, console_.y - myPos.y);
    return d < CAMERA_PROXIMIDADE ? console_ : null;
  }, [mapaCameras, myPos, state?.phase, state?.reuniao, state?.fantasmas, state?.vencedor, name]);
  const cameraProximaRef = useRef(null);
  useEffect(() => { cameraProximaRef.current = cameraProxima; }, [cameraProxima]);
  // Refs dos painéis abertos — o handler de teclado (montado uma vez) precisa
  // ler o valor ATUAL, não o do render em que foi criado.
  const cameraAbertaRef = useRef(null);
  useEffect(() => { cameraAbertaRef.current = cameraAberta; }, [cameraAberta]);
  const vortexAbertoRef = useRef(null);
  useEffect(() => { vortexAbertoRef.current = vortexAberto; }, [vortexAberto]);
  const abrirCamerasRef = useRef(null);
  useEffect(() => {
    abrirCamerasRef.current = () => {
      const atual = cameraProximaRef.current;
      const i = Math.max(0, mapaCameras.findIndex(c => c.id === atual?.id));
      setCameraAberta(i);
    };
  }, [mapaCameras]);
  // Teleporte: leva o boneco pro destino e avisa os outros na hora (a posição
  // é minha autoridade local — mesmo caminho do movimento normal).
  const [vortexCooldownAte, setVortexCooldownAte] = useState(0);
  /* Explosões do vórtex (ago/2026): lista curta de {id,x,y} que se apaga
     sozinha. Vai por BROADCAST pra todo mundo na sala ver o clarão — é o
     único rastro que o portal deixa (quem estiver por perto vê que alguém
     acabou de sumir/aparecer ali). */
  const [vortexFx, setVortexFx] = useState([]);
  const explodirVortex = useCallback((x, y, propagar = true) => {
    const id = uid();
    setVortexFx(l => [...l.slice(-5), { id, x, y }]);
    setTimeout(() => setVortexFx(l => l.filter(f => f.id !== id)), 900);
    if (propagar) { try { chanRef.current?.send({ type: 'broadcast', event: 'vortex-fx', payload: { de: name, x, y } }); } catch { /* canal caiu — só o efeito local */ } }
  }, [name]);
  useEffect(() => { explodirVortexRef.current = explodirVortex; }, [explodirVortex]);
  const teleportar = (destino) => {
    tocarEfeito('vortex');
    const alvo = { x: destino.x, y: destino.y };
    explodirVortex(myPosRef.current.x, myPosRef.current.y);   // saída
    explodirVortex(alvo.x, alvo.y);                            // chegada
    myPosRef.current = alvo;
    setMyPos(alvo);
    setVortexAberto(null);
    setVortexCooldownAte(Date.now() + VORTEX_COOLDOWN_MS);
    try { chanRef.current?.send({ type: 'broadcast', event: 'pos', payload: { name, x: alvo.x, y: alvo.y } }); } catch { /* canal caiu — a próxima posição já corrige */ }
  };
  const marcarTarefaFeita = (taskId) => {
    tocarEfeito('tarefa');
    // Brilho na placa que acabou de ser concluída (some sozinho).
    setBrilhoTarefa(taskId);
    setTimeout(() => setBrilhoTarefa(b => (b === taskId ? null : b)), 900);
    mutateState(s => {
      if (!s) return null;
      const done = { ...(s.tasksDone || {}) };
      done[name] = [...new Set([...(done[name] || []), taskId])];
      // Vitória por tarefas: quando TODOS os Tripulantes (vivos ou fantasma —
      // fantasma continua fazendo tarefa) já concluíram TODAS as tarefas.
      const todosIds = mapaTarefas.map(t => t.id);
      const tripulantes = Object.keys(s.papeis || {}).filter(n => s.papeis[n] === 'tripulante');
      const todasFeitas = todosIds.length > 0 && tripulantes.length > 0
        && tripulantes.every(n => todosIds.every(id => (done[n] || []).includes(id)));
      return { ...s, tasksDone: done, vencedor: todasFeitas ? 'tripulante' : s.vencedor };
    });
  };

  /* ── Matar (ago/2026) — só o Impostor, perto de alguém vivo, com recarga.
     Reusa o MESMO mecanismo de fantasma da expulsão (entra em `fantasmas`),
     e checa vitória igual à reunião: todo tripulante fora = impostor vence. */
  const [morteAnim, setMorteAnim] = useState(null);   // { matador } — só aparece pra quem FOI morto
  useEffect(() => { morteAnimRef.current = morteAnim; }, [morteAnim]);
  useEffect(() => {
    if (!morteAnim) return;
    const t = setTimeout(() => setMorteAnim(null), MORTE_ANIM_MS);
    return () => clearTimeout(t);
  }, [morteAnim]);
  // Detecta que EU fui morto comparando com a última morte vista — ajustado
  // durante o render (padrão oficial pra "reagir a uma mudança"), não num
  // efeito solto com setState síncrono (regra do React Compiler).
  const [ultimaMorteVista, setUltimaMorteVista] = useState(null);
  if (state?.ultimaMorte && state.ultimaMorte.vitima === name && state.ultimaMorte.ts !== ultimaMorteVista) {
    setUltimaMorteVista(state.ultimaMorte.ts);
    setMorteAnim({ matador: state.ultimaMorte.matador });
  }

  const vitimaProxima = useMemo(() => {
    if (state?.phase !== 'jogando' || state?.reuniao) return null;
    if (state?.papeis?.[name] !== 'impostor' || state?.fantasmas?.includes(name)) return null;
    if (agoraTick < killLiberadoEm) return null;   // trégua do começo da partida
    const cd = state?.killCooldowns?.[name] || 0;
    if (agoraTick - cd < KILL_COOLDOWN_MS) return null;
    let melhor = null, melhorD = Infinity;
    for (const p of players) {
      if (p.name === name || state?.papeis?.[p.name] === 'impostor' || state?.fantasmas?.includes(p.name)) continue;
      // Mesmo fallback do desenho do boneco (`spawnFor`): quem ainda não
      // mexeu nunca mandou posição, e sem isso ficava IMORTAL — aparecia no
      // mapa mas o botão de matar nunca acendia em cima dele.
      const pos = positions[p.name] || spawnFor(p.name);
      const d = Math.hypot(pos.x - myPos.x, pos.y - myPos.y);
      if (d < KILL_PROXIMIDADE && d < melhorD) { melhor = { ...p, x: pos.x, y: pos.y }; melhorD = d; }
    }
    return melhor;
  }, [state?.phase, state?.reuniao, state?.papeis, state?.fantasmas, state?.killCooldowns, killLiberadoEm, agoraTick, players, positions, myPos, name]);
  useEffect(() => { vitimaProximaRef.current = vitimaProxima; }, [vitimaProxima]);
  useEffect(() => { killLiberadoRef.current = killLiberadoEm; }, [killLiberadoEm]);

  // Corpo mais próximo (pra qualquer vivo reportar — vira reunião na hora).
  const corpoProximo = useMemo(() => {
    if (state?.phase !== 'jogando' || state?.reuniao || state?.fantasmas?.includes(name)) return null;
    let melhor = null, melhorD = Infinity;
    for (const c of (state?.corpos || [])) {
      const d = Math.hypot(c.x - myPos.x, c.y - myPos.y);
      if (d < CORPO_PROXIMIDADE && d < melhorD) { melhor = c; melhorD = d; }
    }
    return melhor;
  }, [state?.phase, state?.reuniao, state?.corpos, state?.fantasmas, myPos, name]);
  useEffect(() => { corpoProximoRef.current = corpoProximo; }, [corpoProximo]);

  const matar = (vitima) => {
    // Som na hora do clique (a checagem de verdade acontece já com o estado
    // fresco lá dentro; se a morte não valer, o efeito some no meio do jogo
    // e ninguém percebe — melhor que um clique de matar sem resposta).
    tocarEfeito('matar');
    mutateState(s => {
      if (!s || s.phase !== 'jogando' || s.reuniao || s.vencedor) return null;
      if (s.papeis?.[name] !== 'impostor' || (s.fantasmas || []).includes(name)) return null;
      if ((s.fantasmas || []).includes(vitima.name) || s.papeis?.[vitima.name] === 'impostor') return null;
      if (Date.now() < killLiberadoRef.current) return null;   // trégua do começo da partida
      if (Date.now() - (s.killCooldowns?.[name] || 0) < KILL_COOLDOWN_MS) return null;
      const fantasmas = [...new Set([...(s.fantasmas || []), vitima.name])];
      const corpos = [...(s.corpos || []), { id: uid(), x: vitima.x, y: vitima.y, vitima: vitima.name, matador: name }];
      // `resolverSabotagem`: se quem faltava consertar acabou de morrer, a luz
      // volta na hora em vez de ficar apagada até o conserto automático.
      const proximo = resolverSabotagem({ ...s, fantasmas, corpos, killCooldowns: { ...(s.killCooldowns || {}), [name]: Date.now() },
        ultimaMorte: { vitima: vitima.name, matador: name, ts: Date.now() } });
      // Vitória só quando não sobra NENHUM tripulante vivo (ver decidirVencedor).
      return { ...proximo, vencedor: decidirVencedor(proximo) };
    });
  };
  useEffect(() => { matarRef.current = matar; });

  // Reportar corpo: some da lista de corpos E já chama a reunião de emergência.
  const reportar = (corpoId) => {
    mutateState(s => {
      if (!s || s.phase !== 'jogando' || s.reuniao || s.vencedor || (s.fantasmas || []).includes(name)) return null;
      const corpos = (s.corpos || []).filter(c => c.id !== corpoId);
      return { ...s, corpos, reuniao: { id: uid(), chamadaPor: name, fase: 'chat', faseIniciadaEm: Date.now(), votos: {} } };
    });
  };
  useEffect(() => { reportarRef.current = reportar; });

  /* ── Sabotagem de energia (ago/2026) — só o Impostor, de qualquer lugar
     do mapa (não precisa estar perto de nada). Enquanto ativa, ninguém faz
     tarefa e os Tripulantes ficam praticamente no escuro (ver LUZ_RAIO). */
  const sabotarEnergia = () => {
    mutateState(s => {
      if (!s || s.phase !== 'jogando' || s.reuniao || s.vencedor) return null;
      if (s.papeis?.[name] !== 'impostor' || (s.fantasmas || []).includes(name)) return null;
      if (s.sabotagem) return null;   // já tem uma rolando
      if (Date.now() - (s.sabotagemCooldown?.[name] || 0) < SABOTAGEM_COOLDOWN_MS) return null;
      return { ...s, sabotagem: { iniciadaEm: Date.now() }, sabotagemCooldown: { ...(s.sabotagemCooldown || {}), [name]: Date.now() } };
    });
  };
  // Consertar energia (ago/2026, redesenhado): não é mais "segurar um botão
  // em qualquer lugar" — TODO TRIPULANTE VIVO precisa refazer a tarefa de
  // consertar energia (a mesma placa "Consertar energia" do mapa, mesmo
  // durante a sabotagem ela fica liberada — ver tarefaProxima/render). Cada
  // um que termina entra em `sabotagem.consertadoPor`; quando cobre todo
  // mundo, a luz volta ao normal.
  const consertarEnergia = () => {
    mutateState(s => {
      if (!s || !s.sabotagem || s.papeis?.[name] === 'impostor') return null;   // o Impostor não conserta a própria sabotagem
      if ((s.fantasmas || []).includes(name)) return null;                       // fantasma não conserta nem conta (pedido do usuário)
      const consertadoPor = [...new Set([...(s.sabotagem.consertadoPor || []), name])];
      return resolverSabotagem({ ...s, sabotagem: { ...s.sabotagem, consertadoPor } });
    });
  };

  /* ── Reunião de emergência (ago/2026): ver comentário no componente
     ReuniaoEmergencia. `reuniaoAtivaRef` congela o movimento (mesmo mecanismo
     do `tarefaAbertaRef`) enquanto ela estiver rolando. */
  const reuniaoAtivaRef = useRef(false);
  useEffect(() => { reuniaoAtivaRef.current = !!state?.reuniao; }, [state?.reuniao]);
  const [reuniaoMensagens, setReuniaoMensagens] = useState([]);
  const [chatTexto, setChatTexto] = useState('');
  // Zera o chat quando uma reunião NOVA começa — ajustado durante o render
  // (padrão oficial do React pra "resetar estado quando algo muda"), não
  // num efeito à parte (regra do React Compiler: nada de setState síncrono
  // dentro de efeito sem necessidade).
  const [reuniaoIdVisto, setReuniaoIdVisto] = useState(state?.reuniao?.id ?? null);
  if (reuniaoIdVisto !== (state?.reuniao?.id ?? null)) {
    setReuniaoIdVisto(state?.reuniao?.id ?? null);
    setReuniaoMensagens([]);
    setChatTexto('');
  }

  const chamarReuniao = () => {
    const s = stateRef.current;
    if (!s || s.phase !== 'jogando' || s.vencedor || (s.fantasmas || []).includes(name)) return;   // fantasma não chama reunião; jogo já decidido não chama de novo
    if (s.reuniao) { setEmergMsg('🚨 Já tem uma reunião de emergência rolando!'); setTimeout(() => setEmergMsg(''), 2500); return; }
    mutateState(st => {
      if (!st || st.phase !== 'jogando' || st.vencedor || st.reuniao || (st.fantasmas || []).includes(name)) return null;
      return { ...st, reuniao: { id: uid(), chamadaPor: name, fase: 'chat', faseIniciadaEm: Date.now(), votos: {} } };
    });
  };
  const enviarChat = () => {
    const texto = chatTexto.trim();
    // Vale na votação também (ver o campo de texto em ReuniaoEmergencia).
    const faseAtual = stateRef.current?.reuniao?.fase;
    if (!texto || (faseAtual !== 'chat' && faseAtual !== 'votacao')) return;
    chanRef.current?.send({ type: 'broadcast', event: 'reuniao-chat', payload: { id: uid(), autor: name, texto: texto.slice(0, 240) } });
    setChatTexto('');
  };
  // Voto pode ser trocado à vontade enquanto a votação estiver rolando —
  // clicar em outra pessoa troca, "Retirar meu voto" apaga a chave inteira
  // (pedido do usuário: dá pra mudar de ideia até a votação fechar).
  const votar = (alvo) => {
    // `mutateState`: sem isso dois votos quase simultâneos se apagavam
    // (cada cliente gravava o jsonb inteiro por cima do outro).
    mutateState(s => {
      const rr = s?.reuniao;
      if (!rr || rr.fase !== 'votacao' || (s.fantasmas || []).includes(name)) return null;   // fantasma só faz tarefa, não vota
      return { ...s, reuniao: { ...rr, votos: { ...(rr.votos || {}), [name]: alvo } } };
    });
  };
  const retirarVoto = () => {
    mutateState(s => {
      const rr = s?.reuniao;
      if (!rr || rr.fase !== 'votacao' || rr.votos?.[name] === undefined) return null;
      const votos = { ...(rr.votos || {}) };
      delete votos[name];
      return { ...s, reuniao: { ...rr, votos } };
    });
  };
  // Botão "Vamos votar" (qualquer jogador pode apertar) — pula o resto do
  // cronômetro de chat e já abre a votação, sem esperar os 60s completos.
  const iniciarVotacao = () => {
    mutateState(s => {
      const rr = s?.reuniao;
      if (!rr || rr.fase !== 'chat' || (s.fantasmas || []).includes(name)) return null;
      return { ...s, reuniao: { ...rr, fase: 'votacao', faseIniciadaEm: Date.now() } };
    });
  };

  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost = host === name;
  useEffect(() => { hostRef.current = isHost; }, [isHost]);

  /* Apuração da votação — separada do tick porque precisa do estado FRESCO
     do banco (ver mutateState). */
  const apurarVotacao = useCallback(() => mutateState(s => {
    const rr = s?.reuniao;
    if (!rr || rr.fase !== 'votacao') return null;   // outro tick já apurou
    const fantasmasAtuais = s.fantasmas || [];
    const contagem = {};
    Object.values(rr.votos || {}).forEach(alvo => { if (alvo) contagem[alvo] = (contagem[alvo] || 0) + 1; });
    let expulso = null, max = 0, empatados = 0;
    Object.entries(contagem).forEach(([nome, qtd]) => {
      if (qtd > max) { max = qtd; expulso = nome; empatados = 1; }
      else if (qtd === max) { empatados++; }
    });
    const empate = max > 0 && empatados > 1;
    /* MAIORIA de verdade (ago/2026): antes bastava ser o mais votado — com
       5 pessoas, 2 votos já expulsavam alguém. Agora o acusado precisa de
       MAIS DA METADE dos votos dados (os "Pular votação" contam no total,
       então pular protege quem está sendo acusado). Sem maioria, ninguém
       sai da casa. */
    const totalVotos = Object.keys(rr.votos || {}).length;
    const temMaioria = max * 2 > totalVotos;
    const expulsoFinal = (empate || !temMaioria) ? null : expulso;

    // Expulso vira fantasma — e a partida só acaba pelas regras de
    // `decidirVencedor` (com 2+ impostores, tirar um NÃO encerra o jogo).
    const novosFantasmas = expulsoFinal ? [...new Set([...fantasmasAtuais, expulsoFinal])] : fantasmasAtuais;
    const proximo = resolverSabotagem({ ...s, fantasmas: novosFantasmas });
    const vencedor = decidirVencedor(proximo);

    return { ...proximo, vencedor,
      reuniao: { ...rr, fase: 'resultado', faseIniciadaEm: Date.now(), resultado: { expulso: expulsoFinal, empate, vencedor } } };
  }), [mutateState]);

  /* HOST avança as fases da reunião no tempo certo (chat→votação→resultado→
     fecha) — todo mundo lê o `faseIniciadaEm` compartilhado pra mostrar a
     contagem regressiva, mas só o host EMPURRA a transição (mesmo padrão de
     autoridade único usado pra sortear papéis/avançar do lobby). */
  useEffect(() => {
    if (!isHost || !state?.reuniao?.id) return;
    const tick = () => {
      const s = stateRef.current; const rr = s?.reuniao;
      if (!rr) return;
      const decorrido = Date.now() - rr.faseIniciadaEm;
      if (rr.fase === 'chat' && decorrido >= REUNIAO_FASE_MS) {
        pushState({ ...s, reuniao: { ...rr, fase: 'votacao', faseIniciadaEm: Date.now() } });
      } else if (rr.fase === 'votacao') {
        // Fantasmas não votam — só quem ainda tá vivo entra na conta de "todo
        // mundo já votou" (senão a votação nunca pularia sozinha com alguém já morto na sala).
        // Quem vota = tem papel na partida E ainda está na sala: sem o papel
        // seria contar quem chegou depois do sorteio (nunca vota, a votação
        // só terminaria no estouro do relógio); sem a presença seria esperar
        // por quem fechou o navegador no meio.
        const fantasmasPrevia = s.fantasmas || [];
        const presentes = new Set(playersRef.current.map(p => p.name));
        const vivosPrevia = Object.keys(s.papeis || {}).filter(n => !fantasmasPrevia.includes(n) && presentes.has(n));
        const todosVotaramPrevia = vivosPrevia.length > 0 && vivosPrevia.every(n => rr.votos?.[n] !== undefined);
        if (decorrido < REUNIAO_FASE_MS && !todosVotaramPrevia) return;   // ainda esperando
        // A APURAÇÃO em si vai por `mutateState`: é a hora em que um voto
        // recém-dado por outra pessoa ainda pode estar a caminho, e contar
        // uma cédula a menos mudaria quem sai da casa.
        apurarVotacao();
      } else if (rr.fase === 'resultado' && decorrido >= REUNIAO_RESULTADO_MS) {
        pushState(s.vencedor ? { ...s, phase: 'over', reuniao: null } : { ...s, reuniao: null });
      }
    };
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [isHost, state?.reuniao?.id, state?.reuniao?.fase, pushState, apurarVotacao]);


  // HOST conserta a sabotagem de energia sozinho depois de um tempo, se
  // ninguém foi lá resolver — evita travar a partida pra sempre no escuro.
  useEffect(() => {
    if (!isHost || !state?.sabotagem?.iniciadaEm) return;
    // `mutateState` e não `pushState`: este timer estoura no meio do escuro,
    // justamente quando mais gente está gravando estado ao mesmo tempo — com
    // o jsonb montado em cima de um estado velho ele apagaria mortes.
    const t = setTimeout(() => {
      mutateState(s => (s?.sabotagem ? { ...s, sabotagem: null } : null));
    }, SABOTAGEM_AUTO_FIX_MS);
    return () => clearTimeout(t);
  }, [isHost, state?.sabotagem?.iniciadaEm, mutateState]);

  /* HOST fecha a partida quando uma MORTE (não expulsão — essa já tem seu
     próprio fluxo de 8s dentro da reunião) decide o jogo: dá um tempinho
     pra vítima ver a animação antes de estourar a tela de vitória. */
  useEffect(() => {
    if (!isHost || !state?.vencedor || state?.phase !== 'jogando' || state?.reuniao) return;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s?.vencedor && s?.phase === 'jogando' && !s?.reuniao) pushState({ ...s, phase: 'over' });
    }, MORTE_ANIM_MS + 300);
    return () => clearTimeout(t);
  }, [isHost, state?.vencedor, state?.phase, state?.reuniao, pushState]);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { if (state) stateRef.current = state; }, [state]);

  useEffect(() => {
    let vivo = true;
    const load = async () => { const { data } = await supabase.from('uniko_suspect_state').select('state').eq('id', roomId).maybeSingle(); if (vivo) aplicaEstado(data?.state); };
    load();
    const ch = supabase.channel(`uniko-suspect-state-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_suspect_state', filter: `id=eq.${roomId}` }, ({ new: row }) => aplicaEstado(row?.state))
      .subscribe();
    const poll = setInterval(load, 4000);
    return () => { vivo = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId, aplicaEstado]);

  /* Canal de broadcast da sala: "pronto" (revisou o papel) + posição no mapa +
     chat da reunião. `broadcast.self:true` é NECESSÁRIO — por padrão o
     Supabase Realtime NÃO devolve o broadcast pra quem enviou, então sem
     isso o próprio remetente nunca via a própria mensagem de chat aparecer
     (só os outros viam). Os outros handlers (pos/pronto/pos-req) já se
     protegiam contra processar o próprio eco, então ligar isso é seguro. */
  useEffect(() => {
    const ch = supabase.channel(`uniko-suspect-room-${roomId}`, { config: { broadcast: { self: true } } });
    chanRef.current = ch;
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload?.name || payload.name === name) return;
      setPositions(prev => ({ ...prev, [payload.name]: { x: payload.x, y: payload.y, moving: !!payload.moving } }));
    });
    // Explosão do vórtex — puro efeito visual. O canal tem `self:true`, então
    // o próprio eco volta pra mim: como já pintei localmente na hora do
    // teleporte, ignoro o que veio com o meu nome (senão pinta em dobro).
    ch.on('broadcast', { event: 'vortex-fx' }, ({ payload }) => {
      if (!payload || payload.de === name) return;
      if (typeof payload.x !== 'number' || typeof payload.y !== 'number') return;
      explodirVortexRef.current?.(payload.x, payload.y, false);
    });
    // Chat da reunião de emergência — efêmero, não persiste (mesmo princípio da posição).
    ch.on('broadcast', { event: 'reuniao-chat' }, ({ payload }) => {
      if (!payload?.id || !payload?.autor || !payload?.texto) return;
      setReuniaoMensagens(m => [...m, payload].slice(-100));
    });
    // Quem acabou de entrar no mapa pede a posição de todo mundo; cada cliente
    // responde com a PRÓPRIA posição (não tem "host" pra isso — todos sabem a
    // própria posição, ninguém mais sabe a de todos).
    ch.on('broadcast', { event: 'pos-req' }, ({ payload }) => {
      if (payload?.name === name) return;
      // Vale também na REVELAÇÃO: os clientes entram no mapa com alguns
      // décimos de diferença, e quem ainda estava na tela de papel ignorava o
      // pedido — aí a posição dessa pessoa só aparecia pros outros quando ela
      // andasse pela primeira vez.
      const fase = stateRef.current?.phase;
      if (fase !== 'jogando' && fase !== 'sorteando') return;
      ch.send({ type: 'broadcast', event: 'pos', payload: { name, x: myPosRef.current.x, y: myPosRef.current.y, moving: isMovingRef.current } });
    });
    // Posição no BARCO do lobby — mesmo padrão de pos/pos-req acima, só que
    // só faz sentido enquanto a sala ainda tá esperando (fase 'lobby').
    ch.on('broadcast', { event: 'barco-pos' }, ({ payload }) => {
      if (!payload?.name || payload.name === name) return;
      setBarcoPositions(prev => ({ ...prev, [payload.name]: { x: payload.x, y: payload.y } }));
    });
    ch.on('broadcast', { event: 'barco-pos-req' }, ({ payload }) => {
      if (payload?.name === name) return;
      const fase = stateRef.current?.phase;
      if (fase && fase !== 'lobby') return;
      ch.send({ type: 'broadcast', event: 'barco-pos', payload: { name, x: myBarcoPosRef.current.x, y: myBarcoPosRef.current.y } });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /* Motor: a revelação de papel avança pro jogo sozinha depois de um tempo —
     não precisa mais de "Entendi, tô pronto!" de cada um (o lobby já era o
     barco com todo mundo dentro; depois de "Iniciar Partida" já era pra
     começar de vez). O HOST empurra a transição; todo mundo só vê a tela
     de revelação por REVELACAO_MS antes do mapa aparecer. */
  useEffect(() => {
    if (!isHost || state?.phase !== 'sorteando') return;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s?.phase === 'sorteando') pushState({ ...s, phase: 'jogando' });
    }, REVELACAO_MS);
    return () => clearTimeout(t);
  }, [isHost, state?.phase, state?.round, pushState]);

  /* ── Loop de movimento: teclado (WASD/setas) + requestAnimationFrame ──────
     Só roda durante a fase 'jogando'. Move localmente (autoridade própria,
     resposta instantânea) e transmite a posição em lote a cada POS_SEND_MS
     (não a cada frame — senão entope o canal, mesmo motivo do Uniko Paint
     mandar traços em lote a cada 60ms em vez de um send por ponto). */
  useEffect(() => {
    if (state?.phase !== 'jogando') return;
    // Quem acabou de chegar no mapa pede a posição de todo mundo.
    chanRef.current?.send({ type: 'broadcast', event: 'pos-req', payload: { name } });

    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;   // nunca captura teclado de um campo de texto
      // Fantasma ignora o congelamento da reunião — ele "só faz tarefa" mesmo,
      // então continua jogando enquanto os vivos estão reunidos. A animação
      // de morte (na tela da PRÓPRIA vítima) trava tudo, sem exceção.
      // Painel aberto (tarefa, CÂMERAS ou vórtex) trava o boneco: dava pra
      // andar pelo mapa enquanto olhava as câmeras, o que tirava todo o custo
      // de ir até a sala de segurança.
      const travado = !!morteAnimRef.current || tarefaAbertaRef.current
        || cameraAbertaRef.current !== null || !!vortexAbertoRef.current
        || (reuniaoAtivaRef.current && !souFantasmaRef.current);
      if (k === 'e') {
        // Ordem importa: tarefa primeiro (é o uso mais comum do E), depois
        // câmera e por último vórtex — cada um só existe se estiver no alcance.
        if (!travado && tarefaProximaRef.current) { pressedRef.current.clear(); setTarefaAberta(tarefaProximaRef.current); }
        else if (!travado && cameraProximaRef.current) { pressedRef.current.clear(); abrirCamerasRef.current?.(); }
        else if (!travado && vortexProximoRef.current) { pressedRef.current.clear(); setVortexAberto(vortexProximoRef.current); }
        e.preventDefault();
        return;
      }
      if (k === 'f') {
        // Matar a vítima mais próxima (só existe alvo se eu for o Impostor — ver vitimaProxima).
        if (!travado && vitimaProximaRef.current) matarRef.current?.(vitimaProximaRef.current);
        e.preventDefault();
        return;
      }
      if (k === 'r') {
        // Reportar o corpo mais próximo — já chama a reunião de emergência.
        if (!travado && corpoProximoRef.current) reportarRef.current?.(corpoProximoRef.current.id);
        e.preventDefault();
        return;
      }
      if (k === 'escape') {
        if (tarefaAbertaRef.current) { setTarefaAberta(null); e.preventDefault(); return; }
        if (cameraAbertaRef.current !== null) { setCameraAberta(null); e.preventDefault(); return; }
        if (vortexAbertoRef.current) { setVortexAberto(null); e.preventDefault(); return; }
      }
      if (!KEY_DIR[k]) return;
      if (travado) return;   // mini-jogo/reunião/animação de morte — WASD não move o boneco por baixo
      pressedRef.current.add(k);
      e.preventDefault();
    };
    const onKeyUp = (e) => { pressedRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Pinta câmera + meu boneco + luz DIRETO no DOM (sem passar pelo React) —
    // roda a 60fps de verdade, sem o custo de re-renderizar jogadores/tarefas/
    // emergência a cada frame (ver comentário nos refs, acima).
    const pintarVisual = (nx, ny) => {
      const camX = Math.min(MAP_W - ZOOM_W, Math.max(0, nx - ZOOM_W / 2));
      const camY = Math.min(MAP_H - ZOOM_H, Math.max(0, ny - ZOOM_H / 2));
      if (worldRef.current) worldRef.current.style.transform = `translate(${-(camX / MAP_W) * 100}%, ${-(camY / MAP_H) * 100}%)`;
      if (myMarkerRef.current) { myMarkerRef.current.style.left = `${nx / MAP_W * 100}%`; myMarkerRef.current.style.top = `${ny / MAP_H * 100}%`; }
      if (lightRef.current) {
        const raio = souFantasmaRef.current ? LUZ_RAIO.fantasma
          : meuPapelRef.current === 'impostor' ? LUZ_RAIO.impostor
          : sabotagemAtivaRef.current ? LUZ_RAIO.sabotagem : LUZ_RAIO.tripulante;
        lightRef.current.style.background = lightGradientBg(nx / MAP_W * 100, ny / MAP_H * 100, raio);
      }
      pintarSeta();   // a seta da energia segue o boneco no mesmo frame
    };
    pintarVisual(myPosRef.current.x, myPosRef.current.y);

    lastTsRef.current = performance.now();
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);   // clamp: aba em 2º plano não "teleporta"
      lastTsRef.current = ts;
      if (morteAnimRef.current || tarefaAbertaRef.current
          || cameraAbertaRef.current !== null || !!vortexAbertoRef.current
          || (reuniaoAtivaRef.current && !souFantasmaRef.current)) {
        // Animação de morte, mini-jogo aberto, CÂMERAS/VÓRTEX abertos, ou
        // reunião rolando e eu não sou fantasma — congela o boneco (some com
        // o bob também). As câmeras entraram aqui porque dava pra andar pelo
        // mapa enquanto olhava, tirando o custo de ir até a sala de segurança;
        // é ESTA a trava que vale, o handler de tecla sozinho não bastava (com
        // a tecla já segurada o boneco continuava andando).
        if (isMovingRef.current) { isMovingRef.current = false; setIsMoving(false); }
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      let dx = 0, dy = 0;
      pressedRef.current.forEach(k => { const d = KEY_DIR[k]; if (d) { dx += d[0]; dy += d[1]; } });
      // Animação de "andar" (bob pra cima/baixo): liga/desliga só na TRANSIÇÃO
      // (não todo frame) pra não gerar um re-render por frame à toa — quem
      // realmente move (posição muda) já re-renderiza via setMyPos abaixo.
      const movendoAgora = !!(dx || dy);
      if (movendoAgora !== isMovingRef.current) {
        isMovingRef.current = movendoAgora;
        setIsMoving(movendoAgora);
        if (!movendoAgora) {
          // Ao soltar a tecla não há mais `setMyPos` (posição parada), então
          // sem isso os outros clientes nunca saberiam que eu parei de andar.
          // Também sincroniza o estado React (pode estar até POS_SEND_MS
          // desatualizado) — importante pro prompt "Pressione E" ficar exato.
          lastSentRef.current = performance.now();
          setMyPos(myPosRef.current);
          chanRef.current?.send({ type: 'broadcast', event: 'pos', payload: { name, x: myPosRef.current.x, y: myPosRef.current.y, moving: false } });
        }
      }
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        const cur = myPosRef.current;
        // Colisão por PAREDE: testa X e Y em separado (não junto) — assim, ao
        // esbarrar numa parede na diagonal, o boneco continua deslizando pelo
        // eixo livre em vez de travar de vez. Fallback: [0,MAP_W]/[0,MAP_H]
        // como limite absoluto (nunca sai da imagem, mesmo se cair fora de
        // toda zona andável por algum buraco no mapeamento).
        const tryX = Math.min(MAP_W - PLAYER_R, Math.max(PLAYER_R, cur.x + (dx / len) * MOVE_SPEED * dt));
        const tryY = Math.min(MAP_H - PLAYER_R, Math.max(PLAYER_R, cur.y + (dy / len) * MOVE_SPEED * dt));
        // Fantasma atravessa parede — só o limite absoluto do mapa (acima) continua valendo.
        const nx = (souFantasmaRef.current || isWalkable(tryX, cur.y)) ? tryX : cur.x;
        const ny = (souFantasmaRef.current || isWalkable(nx, tryY)) ? tryY : cur.y;
        if (nx !== cur.x || ny !== cur.y) {
          myPosRef.current = { x: nx, y: ny };   // sempre fresco — nunca "um frame atrasado"
          pintarVisual(nx, ny);                   // suave a 60fps, sem re-render do React
          const now = performance.now();
          if (now - lastSentRef.current >= POS_SEND_MS) {
            lastSentRef.current = now;
            setMyPos({ x: nx, y: ny });   // React só precisa saber no ritmo lento (prompt de tarefa etc.)
            chanRef.current?.send({ type: 'broadcast', event: 'pos', payload: { name, x: nx, y: ny, moving: true } });
          }
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    const teclas = pressedRef.current;   // copiado agora — o cleanup não deve ler `.current` de novo
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      teclas.clear();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state?.phase, name, pintarSeta]);

  /* Monta o próximo estado da partida a partir do estado atual da sala. */
  const montarPartida = (state, nomes) => {
    const qtd = Math.max(1, Math.min(state.impostoresQtd || 1, nomes.length - 2));
    /* Quem é impostor NÃO é sorteado no chapéu limpo — é FILA + ANTIGUIDADE
       (ver sortearImpostores). Sorteio honesto inclui repetir, e o usuário
       estava tendo que criar sala nova toda partida por causa disso. Agora
       quem já foi fica fora até todo mundo passar e, entre os elegíveis,
       entra quem está há mais partidas sem pegar o papel (`historicoImpostores`
       guarda a partida da última vez de cada um; quem nunca foi passa na
       frente). O sorteio só resolve empates. */
    const ultimos = state.ultimosImpostores
      || Object.entries(state.papeis || {}).filter(([, p]) => p === 'impostor').map(([n]) => n);
    const rodada = (state.round || 0) + 1;
    const { escolhidos, ciclo, historico } = sortearImpostores(
      nomes, qtd, state.cicloImpostores, ultimos, state.historicoImpostores, rodada);
    const papeis = {};
    nomes.forEach(n => { papeis[n] = escolhidos.includes(n) ? 'impostor' : 'tripulante'; });
    /* A trégua inicial do assassinato NÃO vai carimbada aqui de propósito:
       um `Date.now()` gravado pelo host é o relógio DA MÁQUINA DELE, e o
       impostor compara com o relógio da própria — bastava o host estar
       adiantado pra o botão de matar nunca liberar. Cada impostor marca a
       própria trégua localmente ao entrar no mapa (ver killLiberadoEm). */
    return { ...state, phase: 'sorteando', round: rodada, papeis, ultimosImpostores: escolhidos, cicloImpostores: ciclo, historicoImpostores: historico, prontos: {}, fantasmas: [], vencedor: null, tasksDone: {}, reuniao: null, corpos: [], killCooldowns: {}, ultimaMorte: null, sabotagem: null, sabotagemCooldown: {} };
  };
  /* Vai por `mutateState` (e não `pushState`) de propósito: a FILA do rodízio
     mora no estado da sala, então ela precisa ser lida do banco na hora, já
     fresca. Com o estado local em cache dava pra sortear em cima de uma fila
     velha — e a fila velha é justamente o que faria o mesmo impostor voltar.
     O guard de `sorteando/jogando` também mata o clique duplo no botão, que
     antes gastava duas posições da fila de uma vez. */
  const sortearEComecar = () => {
    if (!state || players.length < MIN_PLAYERS) return;
    const nomes = players.map(p => p.name);
    mutateState(s => {
      const base = s || state;
      if (base.phase === 'sorteando' || base.phase === 'jogando') return null;   // já começou
      return montarPartida(base, nomes);
    });
  };
  const escolherImpostores = (n) => {
    if (!isHost || !state) return;
    pushState({ ...state, impostoresQtd: n });
  };
  const encerrar = () => { if (isHost && state) pushState({ ...state, phase: 'over' }); };

  const meuPapel = state?.papeis?.[name];
  useEffect(() => { meuPapelRef.current = meuPapel; }, [meuPapel]);
  // Fantasma (ago/2026): quem foi expulso na reunião. Atravessa parede, só
  // faz tarefa, e só ELE enxerga todo mundo (vivos continuam sem ver fantasmas).
  const souFantasma = !!state?.fantasmas?.includes(name);
  // Cor do papel usada pelo HUD (fantasma tem a sua, senão some no escuro).
  const papelCor = souFantasma ? '#A78BFA' : meuPapel === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR;
  useEffect(() => { souFantasmaRef.current = souFantasma; }, [souFantasma]);
  useEffect(() => { sabotagemAtivaRef.current = !!state?.sabotagem; }, [state?.sabotagem]);

  /* Alvo da seta de energia: a placa de energia mais perto, enquanto a
     sabotagem estiver de pé e EU ainda não tiver consertado a minha parte.
     O Impostor não vê seta nenhuma (a sabotagem é dele). */
  const energiaAlvo = useMemo(() => {
    if (!state?.sabotagem || meuPapel === 'impostor' || souFantasma) return null;   // fantasma não conserta
    if (state.sabotagem.consertadoPor?.includes(name)) return null;
    let melhor = null, melhorD = Infinity;
    for (const t of mapaTarefas) {
      if (taskTypeFor(t.label) !== 'energia') continue;
      const d = Math.hypot(t.x - myPos.x, t.y - myPos.y);
      if (d < melhorD) { melhor = t; melhorD = d; }
    }
    return melhor;
  }, [state?.sabotagem, meuPapel, souFantasma, mapaTarefas, myPos, name]);
  // Repinta na hora em que a sabotagem começa/termina — o loop de movimento
  // só repinta quando o boneco anda, e parado a seta nunca apareceria.
  useEffect(() => { energiaAlvoRef.current = energiaAlvo; pintarSeta(); }, [energiaAlvo, pintarSeta]);
  // Distância até a energia (pro aviso de baixo) — em "passos" arredondados.
  const energiaDist = energiaAlvo ? Math.round(Math.hypot(energiaAlvo.x - myPos.x, energiaAlvo.y - myPos.y)) : 0;
  const emCooldownSabotagem = agoraTick - (state?.sabotagemCooldown?.[name] || 0) < SABOTAGEM_COOLDOWN_MS;
  /* Recarga em SEGUNDOS pra mostrar em cima dos botões (estilo Among Us) —
     antes o botão só ficava cinza e ninguém sabia quanto faltava. `agoraTick`
     anda de meio em meio segundo, o bastante pra um contador de segundos.
     Matar tem duas esperas e vale a MAIOR: a trégua do começo da partida
     (`killLiberadoEm`, relógio desta máquina) e a recarga entre mortes
     (`killCooldowns[name]`, gravada pelo próprio impostor — mesmo relógio). */
  const segsRestantes = (ms) => Math.max(0, Math.ceil(ms / 1000));
  const killSegs = segsRestantes(Math.max(
    killLiberadoEm - agoraTick,
    KILL_COOLDOWN_MS - (agoraTick - (state?.killCooldowns?.[name] || 0)),
  ));
  const sabotarSegs = segsRestantes(SABOTAGEM_COOLDOWN_MS - (agoraTick - (state?.sabotagemCooldown?.[name] || 0)));
  const mostrarSabotar = meuPapel === 'impostor' && !souFantasma && state?.phase === 'jogando' && !state?.reuniao && !state?.vencedor && !state?.sabotagem;
  // O botão de sabotar agora fica SEMPRE na tela (fixo ao lado do matar) e só
  // muda de estado — `podeSabotar` diz se o clique vale agora.
  const podeSabotar = mostrarSabotar && !emCooldownSabotagem;

  /* ── Botão USAR: um só pra qualquer interação de proximidade ──────────────
     Antes cada coisa tinha seu próprio aviso ("Pressione E — tarefa", botão
     de câmera, botão de vórtex) e a tela virava uma colcha de retalhos. Agora
     é UM botão que muda de alvo, na mesma ordem de prioridade da tecla E:
     tarefa > câmera > vórtex. */
  const alvoUsar = useMemo(() => {
    if (tarefaAberta || cameraAberta !== null || vortexAberto) return null;   // já tem algo aberto
    if (tarefaProxima) return { tipo: 'tarefa', titulo: tarefaProxima.label };
    if (cameraProxima) return { tipo: 'camera', titulo: cameraProxima.label };
    if (vortexProximo) return { tipo: 'vortex', titulo: `Entrar no vórtex — ${vortexProximo.label}` };
    return null;
  }, [tarefaProxima, cameraProxima, vortexProximo, tarefaAberta, cameraAberta, vortexAberto]);

  const usarAlvoProximo = () => {
    // Limpa as teclas seguradas: sem isso, quem abre o painel clicando no
    // botão (em vez do E) fica com o WASD "preso" e sai andando ao fechar.
    pressedRef.current.clear();
    if (tarefaProximaRef.current) { setTarefaAberta(tarefaProximaRef.current); return; }
    if (cameraProximaRef.current) { abrirCamerasRef.current?.(); return; }
    if (vortexProximoRef.current) setVortexAberto(vortexProximoRef.current);
  };
  // Câmera: janela de ZOOM_W×ZOOM_H (campo de visão menor) centrada no MEU boneco,
  // clampada pra nunca mostrar além da borda do mapa. Usa o estado `myPos`
  // (React proíbe ler `ref.current` durante o render — regra do React
  // Compiler) — por isso `setMyPos` no step() é throttled em vez de por
  // frame: entre esses re-renders, quem mantém isso suave a 60fps de
  // verdade é a atualização DIRETO no DOM em `pintarVisual` (ver refs).
  const myPosAtual = myPos;
  const camX = Math.min(MAP_W - ZOOM_W, Math.max(0, myPosAtual.x - ZOOM_W / 2));
  const camY = Math.min(MAP_H - ZOOM_H, Math.max(0, myPosAtual.y - ZOOM_H / 2));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <style>{SUS_CSS}</style>
      {/* Cabeçalho */}
      <div style={{ borderRadius: 16, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 13,
        background: `linear-gradient(120deg, ${AGUA} 0%, ${CEU} 55%, ${AREIA} 120%)`, boxShadow: `0 8px 26px ${AG}`, flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><img draggable={false} src={UNIKO_DETETIVE_ICONE} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state?.nome || 'Sala'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)' }}>{players.length} jogador{players.length !== 1 ? 'es' : ''} · {host ? `host: ${host.split(' ')[0]}` : '...'}</div>
        </div>
        <button className="sus-btn" onClick={onAbrirPicker} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.2)', cursor: 'pointer', flexShrink: 0 }}>
          <img draggable={false} src={photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff' }}>Meu Uniko</span>
        </button>
        {/* Mudo também aqui: a trilha já toca no lobby, então precisa dar pra
            silenciar antes mesmo da partida começar. */}
        <button className="sus-btn" onClick={alternarMudo} title={mudo ? 'Ligar o som' : 'Silenciar'}
          style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.22)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            {mudo
              ? <><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
              : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>}
          </svg>
        </button>
        <button className="sus-btn" onClick={onLeave} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.22)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Sair</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ── LOBBY DA SALA ── */}
        {(!state || state.phase === 'lobby' || state.phase === 'over') && (
          <>
            {state?.phase === 'over' && (
              <div className="sus-pop" style={{ textAlign: 'center', padding: '14px 10px', borderRadius: 16,
                background: state?.vencedor ? (state.vencedor === 'impostor' ? `${IMPOSTOR_COR}14` : `${TRIPULANTE_COR}14`) : 'transparent',
                border: state?.vencedor ? `1.5px solid ${state.vencedor === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR}44` : 'none' }}>
                {state?.vencedor ? (
                  <>
                    <div style={{ fontSize: 44 }}>{state.vencedor === 'impostor' ? '🔪' : '🏆'}</div>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800,
                      color: state.vencedor === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
                      {state.vencedor === 'impostor' ? 'O Impostor venceu!' : 'Os Tripulantes venceram!'}
                    </div>
                    <div style={{ fontSize: 12.5, color: T.textT, marginTop: 4 }}>
                      {state.vencedor === 'impostor'
                        ? 'Sobrou tripulante de menos — não dava mais pra impedir.'
                        : 'O impostor foi expulso da casa.'}
                    </div>
                    {/* Fotos dos vencedores lado a lado — só o time que venceu
                        (se foi o Impostor, aparece só ele; se foram os
                        Tripulantes, aparecem todos eles). */}
                    {state?.papeis && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center', marginTop: 16 }}>
                        {Object.keys(state.papeis).filter(n => state.papeis[n] === state.vencedor).map(n => {
                          const p = players.find(pl => pl.name === n);
                          const cor = state.vencedor === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR;
                          return (
                            <div key={n} className="sus-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                              <img draggable={false} src={p?.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover',
                                background: '#fff', border: `3px solid ${cor}`, boxShadow: `0 0 20px ${cor}77` }} />
                              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{n.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Revelação completa dos papéis (todo mundo, os dois times). */}
                    {state?.papeis && (
                      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: T.textD, marginBottom: 8 }}>TODOS OS PAPÉIS</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                          {Object.entries(state.papeis).map(([n, papel]) => (
                            <span key={n} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                              background: papel === 'impostor' ? `${IMPOSTOR_COR}18` : `${TRIPULANTE_COR}18`,
                              color: papel === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
                              {papel === 'impostor' ? '🔪' : '🏖️'} {n.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 34 }}>🏁</div>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text }}>Partida encerrada</div>
                  </>
                )}
              </div>
            )}
            {state?.phase === 'over' && (
              <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>Jogadores ({players.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {players.map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 5px', borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
                      <img draggable={false} src={p.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{p.name.split(' ')[0]}{p.name === host && ' 👑'}</span>
                    </div>
                  ))}
                </div>
                {players.length < MIN_PLAYERS && (
                  <div style={{ fontSize: 12, color: T.textT, marginBottom: 10 }}>Precisa de pelo menos {MIN_PLAYERS} jogadores pra sortear os papéis.</div>
                )}
                {isHost ? (
                  <button className="sus-btn" onClick={sortearEComecar} disabled={players.length < MIN_PLAYERS}
                    style={{ width: '100%', padding: '12px', borderRadius: 11, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14, cursor: players.length < MIN_PLAYERS ? 'not-allowed' : 'pointer',
                      background: players.length < MIN_PLAYERS ? T.textD : `linear-gradient(135deg, ${IMPOSTOR_COR}, #FF7A85)`, opacity: players.length < MIN_PLAYERS ? .6 : 1,
                      boxShadow: players.length < MIN_PLAYERS ? 'none' : `0 6px 18px ${IMPOSTOR_COR}55` }}>
                    🔄 Sortear de novo
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', fontSize: 12.5, color: T.textT, padding: '8px 0' }}>Aguardando o host começar...</div>
                )}
              </div>
            )}

            {/* ── Fase 'lobby': todo mundo entra direto no barco, andando
                livre pelo convés, esperando o host apertar Iniciar Partida. */}
            {(!state || state.phase === 'lobby') && (
              <BarcoLobby name={name} players={players} isHost={isHost}
                impostoresQtd={state?.impostoresQtd || 1} podeIniciar={players.length >= MIN_PLAYERS}
                onEscolherImpostores={escolherImpostores} onIniciar={sortearEComecar}
                myPos={myBarcoPos} setMyPos={setMyBarcoPos} positions={barcoPositions} chanRef={chanRef} />
            )}

            <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>🗺️ Cômodos da casa</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {ROOMS.map(r => (
                  <span key={r.id} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: `${AGUA}12`, border: `1px solid ${AGUA}33`, color: T.text }}>{r.emoji} {r.nome}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textT }}>Piadas internas: {PIADAS.join('  ·  ')}</div>
            </div>
          </>
        )}

        {/* ── REVELAÇÃO DE PAPEL (ago/2026, redesenhada) ── */}
        {/* Sem botão "tô pronto" — o barco do lobby já reúne todo mundo antes
            de "Iniciar Partida", então a revelação só precisa aparecer e
            seguir sozinha pro mapa depois de REVELACAO_MS (ver o efeito do
            host acima). Estilo pedido pelo usuário: nome do papel grande e
            com brilho + todo mundo que tá na partida enfileirado, o MEU
            Uniko maior/na frente — igual à tela clássica de reveal. */}
        {/* Vai por PORTAL pro <body>, em `position:fixed inset:0`, EXATAMENTE
            como o mapa logo abaixo. Antes ela era um cartão no meio da
            página: aparecia pequena, espremida entre o resto do Portal, e só
            então o jogo estourava em tela cheia — o "pisca" que o usuário
            reclamou. Agora as duas telas têm a mesma moldura e a troca é
            direta. As medidas viraram vh/vw pelo mesmo motivo: a tela é a
            unidade, não o cartão. */}
        {state?.phase === 'sorteando' && createPortal(
          <div className="sus-root" onDragStart={e => e.preventDefault()}
            style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#05070c', overflow: 'hidden' }}>
            <div className="sus-reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 'clamp(14px, 2.6vh, 30px)', padding: 'clamp(16px, 4vh, 48px) 5vw', textAlign: 'center', width: '100%', maxHeight: '100%' }}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(42px, 10vw, 112px)', fontWeight: 800, letterSpacing: '.03em', lineHeight: 1,
                color: meuPapel === 'impostor' ? IMPOSTOR_COR : '#9FE8FF',
                textShadow: meuPapel === 'impostor' ? `0 0 18px ${IMPOSTOR_COR}, 0 0 52px ${IMPOSTOR_COR}99` : `0 0 18px #9FE8FF, 0 0 52px #6FD8FF99` }}>
                {meuPapel === 'impostor' ? 'IMPOSTOR' : 'TRIPULANTE'}
              </div>
              {/* Quantos impostores: contado dos PAPÉIS de verdade, não do
                  `impostoresQtd` escolhido no lobby — o sorteio limita o número
                  em salas pequenas e os dois podiam discordar. */}
              {(() => {
                const nomesImpostores = Object.entries(state?.papeis || {}).filter(([, r]) => r === 'impostor').map(([n]) => n);
                const qtdImp = nomesImpostores.length || (state?.impostoresQtd || 1);
                const souImpostor = meuPapel === 'impostor';
                /* Se EU sou impostor, a fila mostra SÓ o meu time (ago/2026,
                   pedido do usuário): é aqui que um impostor descobre quem é o
                   outro, como no Among Us. Tripulante continua vendo a sala
                   inteira, sem nenhuma pista de quem é quem. */
                const elenco = souImpostor ? players.filter(p => nomesImpostores.includes(p.name)) : players;
                return (
                  <>
                    <div style={{ fontSize: 'clamp(14px, 2vw, 22px)', color: '#fff' }}>
                      {souImpostor
                        ? (qtdImp > 1
                          ? <>Vocês são <b style={{ color: IMPOSTOR_COR }}>{qtdImp}</b> Impostores — estes aqui são do seu time.</>
                          : <>Você é o <b style={{ color: IMPOSTOR_COR }}>único</b> Impostor da casa.</>)
                        : <>Há <b style={{ color: IMPOSTOR_COR }}>{qtdImp}</b> Impostor{qtdImp > 1 ? 'es' : ''} entre nós.</>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(8px, 1.4vw, 18px)', flexWrap: 'wrap', maxWidth: '80vw' }}>
                      {elenco.map(p => {
                        const eu = p.name === name;
                        // Parceiro de crime: moldura vermelha + nome, pra não
                        // restar dúvida de quem é quem na hora do jogo.
                        const parceiro = souImpostor && !eu;
                        return (
                          <div key={p.name} className="sus-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                            transform: eu ? 'scale(1.35) translateY(-6px)' : 'scale(1)', zIndex: eu ? 2 : 1 }}>
                            <img draggable={false} src={p.photo || '/UNIKO_NEW.png'} alt=""
                              style={{ width: 'clamp(52px, 6.5vw, 92px)', aspectRatio: '1/1', borderRadius: '50%', objectFit: 'cover', background: '#fff',
                                border: eu ? `3px solid ${AGUA}` : parceiro ? `3px solid ${IMPOSTOR_COR}` : '2px solid rgba(255,255,255,.4)',
                                boxShadow: eu ? `0 0 22px ${AGUA}aa` : parceiro ? `0 0 22px ${IMPOSTOR_COR}aa` : 'none' }} />
                            {(eu || parceiro) && (
                              <span style={{ fontSize: 'clamp(10px, 1.1vw, 14px)', fontWeight: 800, color: eu ? '#fff' : IMPOSTOR_COR }}>
                                {eu ? 'Você' : p.name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
              <div style={{ fontSize: 'clamp(12.5px, 1.5vw, 19px)', color: 'rgba(255,255,255,.65)', maxWidth: 'min(90vw, 640px)', lineHeight: 1.55 }}>
                {meuPapel === 'impostor'
                  ? 'Finja fazer tarefas, sabote a casa de praia e elimine os tripulantes sem ser pego.'
                  : 'Complete suas tarefas pela casa e desconfie de quem agir estranho.'}
              </div>
            </div>
          </div>, document.body)}

        {/* ── MAPA (Fase 3): casa de praia, movimento livre em WASD/setas ──
            Enquanto a partida roda, o jogo TOMA A JANELA INTEIRA — some a
            sidebar, as abas, tudo. Vai por PORTAL pro <body> (não só
            `position:fixed`) porque fixed dentro de um ancestral com
            transform/filter passa a se ancorar nesse ancestral em vez da
            janela; o portal escapa de qualquer contexto de empilhamento da
            Central do Colaborador. O botão "Tela cheia" continua existindo
            pra esconder também a barra do navegador (Fullscreen API). */}
        {state?.phase === 'jogando' && createPortal(
          <div ref={gameWrapRef} className="sus-root" onDragStart={e => e.preventDefault()}
            style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', flexDirection: 'column', gap: 10,
            background: T.page || '#0B1620', padding: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {/* ── HUD do topo ─────────────────────────────────
                Antes eram 3 chips minúsculos encostados na esquerda. Agora o
                cartão do PAPEL fica grande e CENTRALIZADO (dizendo também o
                que você deve fazer), o progresso de tarefas vem ao lado e os
                botões ficam ancorados na direita, fora do fluxo, pra não
                empurrarem o cartão pro canto. */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, width: '100%', maxWidth: 1400, flexShrink: 0, minHeight: 58 }}>

              <div className="sus-pop" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 20px', borderRadius: 14,
                background: `linear-gradient(135deg, ${papelCor}22, ${papelCor}08)`,
                border: `1.5px solid ${papelCor}66`, boxShadow: `0 6px 22px ${papelCor}30` }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 21, background: `${papelCor}28`, border: `1px solid ${papelCor}55` }}>
                  {souFantasma ? '👻' : meuPapel === 'impostor' ? '🔪' : '🏖️'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 17, fontWeight: 800, lineHeight: 1.1, color: papelCor }}>
                    {souFantasma ? 'Você é um Fantasma' : meuPapel === 'impostor' ? 'Você é o Impostor' : 'Você é Tripulante'}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textS, marginTop: 2, whiteSpace: 'nowrap' }}>
                    {souFantasma
                      ? 'Ninguém te vê — termine as tarefas pra ajudar o time'
                      : meuPapel === 'impostor'
                        ? 'Finja fazer tarefas, sabote e elimine sem ser pego'
                        : 'Complete as tarefas e descubra quem é o impostor'}
                  </div>
                </div>
              </div>

              {mapaTarefas.length > 0 && meuPapel !== 'impostor' && (() => {
                const feitas = minhasFeitas.size, total = mapaTarefas.length;
                const pct = total ? Math.round((feitas / total) * 100) : 0;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 14,
                    background: 'rgba(74,159,232,.12)', border: '1.5px solid rgba(74,159,232,.35)' }}>
                    <StarIcon size={15} color="#6BB8FF" />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#6BB8FF', lineHeight: 1 }}>{feitas}/{total} tarefas</div>
                      <div style={{ width: 78, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.12)', marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#4A9FE8,#6BB8FF)', transition: 'width .25s' }} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 7 }}>
                <button className="sus-btn" onClick={alternarMudo} title={mudo ? 'Ligar o som' : 'Silenciar'} style={hudBtnCss}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    {mudo
                      ? <><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                      : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>}
                  </svg>
                  {mudo ? 'Som' : 'Mudo'}
                </button>
                <button className="sus-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} style={hudBtnCss}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isFullscreen
                      ? <><path d="M8 3v3a2 2 0 01-2 2H3"/><path d="M21 8h-3a2 2 0 01-2-2V3"/><path d="M3 16h3a2 2 0 012 2v3"/><path d="M16 21v-3a2 2 0 012-2h3"/></>
                      : <><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/></>}
                  </svg>
                  {isFullscreen ? 'Sair' : 'Tela cheia'}
                </button>
                {isHost && (
                  <button className="sus-btn" onClick={encerrar} style={{ ...hudBtnCss, color: '#FF8A9B', borderColor: 'rgba(255,138,155,.35)' }}>
                    Encerrar
                  </button>
                )}
              </div>
            </div>

            {state?.reuniao && !souFantasma ? (
              // Fantasma NÃO entra na reunião — ele "só faz tarefa", então
              // continua livre no mapa enquanto os vivos estão reunidos.
              // Manda TODO mundo (inclusive os mortos) + a lista de mortos: a
              // votação mostra os eliminados riscados em vez de sumir com eles,
              // assim dá pra acompanhar quem já caiu.
              <ReuniaoEmergencia reuniao={state.reuniao} players={players} mortos={state?.fantasmas || []} name={name} papeis={state.papeis}
                mensagens={reuniaoMensagens} chatTexto={chatTexto} setChatTexto={setChatTexto}
                onEnviarChat={enviarChat} onVotar={votar} onRetirarVoto={retirarVoto} onIniciarVotacao={iniciarVotacao} />
            ) : (
            <>
            {/* Viewport (o que a tela mostra): janela pequena, com zoom — não o mapa inteiro.
                Por baixo, o "mundo" (a arte da casa, ZOOM_FACTOR× maior que a janela) desliza
                via transform pra manter o MEU boneco sempre centralizado (câmera clampada nas
                bordas do mapa). Filhos do mundo (imagem + bonecos + luz) continuam em % de
                MAP_W/MAP_H, então a matemática de posição não muda — só ganhou essa "janela"
                por cima. O tamanho é ditado pela ALTURA disponível (não pela largura), já
                que o jogo ocupa a janela inteira: 86vh no fullscreen nativo (sem barra do
                navegador) e 74vh dentro da janela, que é o que sobra depois do cabeçalho
                e dos avisos de baixo. */}
            <div style={{ position: 'relative', height: isFullscreen ? '86vh' : '74vh', maxWidth: '97vw',
              aspectRatio: `${ZOOM_W} / ${ZOOM_H}`, borderRadius: 16, overflow: 'hidden',
              border: `2px solid ${T.border}`, boxShadow: T.sh, background: '#0B3D45' }}>
              <div ref={worldRef} style={{ position: 'absolute', left: 0, top: 0, width: `${ZOOM_FACTOR * 100}%`, height: `${ZOOM_FACTOR * 100}%`,
                transform: `translate(${-(camX / MAP_W) * 100}%, ${-(camY / MAP_H) * 100}%)` }}>
                <img src={MAPA_IMG} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill', userSelect: 'none', pointerEvents: 'none' }} />

                {/* Tarefas — placa "disponível" ou "concluída" (já feita POR MIM — cada
                    jogador só vê a própria placa mudar, ver marcarTarefaFeita). Clicar
                    também abre (equivalente à tecla E), sem exigir estar perto.
                    Impostor não vê nenhuma — ele não tem tarefa de verdade. */}
                {meuPapel !== 'impostor' && mapaTarefas.map(t => {
                  // Sabotagem ativa: SÓ a placa de energia libera (pra todo
                  // mundo consertar de novo), o resto fica travado até acabar.
                  const consertandoSabotagem = !!state?.sabotagem && taskTypeFor(t.label) === 'energia';
                  const feita = consertandoSabotagem ? !!state?.sabotagem?.consertadoPor?.includes(name) : minhasFeitas.has(t.id);
                  // Trava TODA tarefa que não seja a de energia enquanto a
                  // sabotagem durar — inclusive as que eu já concluí (antes o
                  // `!feita` deixava as concluídas clicáveis no escuro).
                  const travada = !!state?.sabotagem && !consertandoSabotagem && !souFantasma;   // fantasma segue nas tarefas dele
                  // Só dá pra abrir estando PERTO (mesma regra da tecla E / do
                  // botão Usar). Antes o clique na placa abria a tarefa de
                  // qualquer canto do mapa — dava pra fazer tudo sem sair do
                  // lugar, que era o bug relatado.
                  const naoAlcanca = tarefaProxima?.id !== t.id;
                  return (
                    <button key={t.id} onClick={() => { if (!travada && !naoAlcanca) setTarefaAberta(t); }}
                      style={{ ...taskBtnCss, position: 'absolute', left: `${t.x / MAP_W * 100}%`, top: `${t.y / MAP_H * 100}%`,
                        transform: 'translate(-50%,-50%)', zIndex: 1, cursor: (travada || naoAlcanca) ? 'not-allowed' : 'pointer' }}
                      title={travada ? `${t.label} (energia sabotada!)`
                        : consertandoSabotagem ? `${t.label} — conserte a energia!`
                        : naoAlcanca ? `${t.label} — chegue perto pra fazer` : t.label}>
                      <img draggable={false} src={feita ? TAREFA_CONCLUIDA_IMG : TAREFA_DISPONIVEL_IMG} alt={t.label}
                        className={feita || travada ? undefined : 'sus-twinkle'}
                        style={{ width: '8vw', maxWidth: 82, minWidth: 50, display: 'block', opacity: travada ? .4 : 1,
                          filter: travada ? 'grayscale(1) drop-shadow(0 3px 8px rgba(0,0,0,.6))' : 'drop-shadow(0 3px 8px rgba(0,0,0,.6))' }} />
                      {brilhoTarefa === t.id && <BrilhoTarefa />}
                    </button>
                  );
                })}

                {/* Câmeras: qualquer um enxerga o pontinho no mapa (é mobília
                    da casa, não segredo de papel nenhum). */}
                {mapaCameras.map((c, i) => {
                  // SO a câmera #1 é a SALA DE ANEXO (onde se assiste) — e mesmo ela
                  // só abre estando perto. Antes qualquer pino abria o painel de
                  // qualquer lugar do mapa, o que dispensava ir até a sala.
                  const ehConsole = i === 0;
                  const perto = ehConsole && cameraProxima?.id === c.id;
                  if (!ehConsole) {
                    // Demais pontos: só marcam "aqui tem câmera te vendo".
                    return (
                      <div key={c.id} title={`${c.label} (vigiada pela sala de anexo)`}
                        style={{ position: 'absolute', left: `${c.x / MAP_W * 100}%`, top: `${c.y / MAP_H * 100}%`,
                          transform: 'translate(-50%,-50%)', zIndex: 1, width: 26, height: 26, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, opacity: .75,
                          background: 'rgba(22,163,74,.45)', border: '1.5px solid rgba(255,255,255,.7)', pointerEvents: 'none' }}>
                        📹
                      </div>
                    );
                  }
                  return (
                    <button key={c.id} onClick={() => { if (perto) abrirCamerasRef.current?.(); }}
                      title={perto ? 'Ver as câmeras' : `${c.label} — chegue perto pra assistir`}
                      style={{ ...taskBtnCss, position: 'absolute', left: `${c.x / MAP_W * 100}%`, top: `${c.y / MAP_H * 100}%`,
                        transform: 'translate(-50%,-50%)', zIndex: 1, cursor: perto ? 'pointer' : 'not-allowed',
                        width: 44, height: 44, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                        opacity: perto ? 1 : .45,
                        background: perto ? 'rgba(22,163,74,.9)' : 'rgba(22,163,74,.35)',
                        border: `2px solid ${perto ? '#fff' : 'rgba(255,255,255,.5)'}`,
                        filter: perto ? 'drop-shadow(0 3px 10px rgba(22,163,74,.8))' : 'none',
                        animation: perto ? 'susTwinkle 3.4s ease-in-out infinite' : 'none' }}>
                      📹
                    </button>
                  );
                })}

                {/* Vórtex: TODO MUNDO enxerga os portais (ago/2026) — faz parte
                    da casa, e saber onde eles ficam é justamente o que dá ao
                    tripulante a chance de desconfiar de quem some por ali. Só o
                    IMPOSTOR consegue USAR: pra todos os outros o pino fica
                    apagado e o clique não faz nada.
                    Mesmo pro impostor, só dá pra entrar estando praticamente em
                    cima do portal (VORTEX_PROXIMIDADE) — antes o clique no pino
                    teleportava de qualquer distância. */}
                {mapaVortex.map(v => {
                  const souDono = meuPapel === 'impostor' && !souFantasma;
                  const perto = souDono && vortexProximo?.id === v.id;
                  return (
                    <button key={v.id} onClick={() => { if (perto) setVortexAberto(v); }}
                      title={!souDono ? `${v.label} — só o Impostor consegue usar o vórtex`
                        : perto ? `Entrar no vórtex — ${v.label}` : `${v.label} (chegue mais perto pra entrar)`}
                      style={{ ...taskBtnCss, position: 'absolute', left: `${v.x / MAP_W * 100}%`, top: `${v.y / MAP_H * 100}%`,
                        transform: 'translate(-50%,-50%)', zIndex: 1, cursor: perto ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: perto ? 1 : .5,
                        filter: perto ? 'drop-shadow(0 0 14px rgba(168,85,247,.9))' : 'drop-shadow(0 2px 6px rgba(0,0,0,.5))' }}>
                      <PortalVortex size={perto ? 62 : 52} ativo={perto} />
                    </button>
                  );
                })}

                {/* Clarão roxo/azul de quem entrou ou saiu de um portal. */}
                {vortexFx.map(fx => <ExplosaoVortex key={fx.id} x={fx.x} y={fx.y} />)}

                {/* Botão de emergência — placa "Iniciar Reunião", brilho pulsante. Fantasma não chama reunião. */}
                {mapaEmergencia && !souFantasma && (
                  <button onClick={chamarReuniao} title="Iniciar Reunião"
                    style={{ ...taskBtnCss, position: 'absolute', left: `${mapaEmergencia.x / MAP_W * 100}%`, top: `${mapaEmergencia.y / MAP_H * 100}%`,
                      transform: 'translate(-50%,-50%)', zIndex: 1, cursor: 'pointer' }}>
                    <img draggable={false} src={INICIAR_REUNIAO_IMG} alt="Iniciar Reunião" className="sus-emerg"
                      style={{ width: '15vw', maxWidth: 155, minWidth: 92, display: 'block' }} />
                  </button>
                )}

                {/* Corpos — onde o Impostor matou. Qualquer um pode reportar (vira reunião na hora). */}
                {(state?.corpos || []).map(c => (
                  <div key={c.id} style={{ position: 'absolute', left: `${c.x / MAP_W * 100}%`, top: `${c.y / MAP_H * 100}%`,
                    width: `${(PLAYER_R * 1.1 / MAP_W) * 100}%`, transform: 'translate(-50%,-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6%', pointerEvents: 'none', zIndex: 1 }}>
                    <span style={{ fontSize: 'clamp(10px, 1.3vw, 14px)', fontWeight: 800, color: '#fff', background: 'rgba(139,0,0,.85)',
                      borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                      💀 {c.vitima.split(' ')[0]}
                    </span>
                    <img draggable={false} src={CORPO_IMG} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.6))' }} />
                  </div>
                ))}

                {/* Bonecos — sem borda, só a arte do Uniko de cada um. Fantasma enxerga
                    TODO MUNDO (vivo + fantasma); quem tá vivo NÃO enxerga fantasma nenhum
                    (some do mapa pra eles) — só o próprio fantasma se vê e vê os outros. */}
                {players.filter(p => p.name === name || souFantasma || !state?.fantasmas?.includes(p.name)).map(p => {
                  const eu = p.name === name;
                  const ehFantasma = !!state?.fantasmas?.includes(p.name);
                  const pos = eu ? myPosAtual : (positions[p.name] || spawnFor(p.name));
                  const andando = eu ? isMoving : !!positions[p.name]?.moving;
                  return (
                    <div key={p.name} ref={eu ? myMarkerRef : undefined}
                      style={{ position: 'absolute', left: `${pos.x / MAP_W * 100}%`, top: `${pos.y / MAP_H * 100}%`,
                      width: `${(PLAYER_R * 1.2 / MAP_W) * 100}%`, transform: 'translate(-50%,-50%)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6%', opacity: ehFantasma ? .5 : 1,
                      pointerEvents: 'none', transition: eu ? 'none' : 'left .12s linear, top .12s linear', zIndex: eu ? 3 : 2 }}>
                      <img draggable={false} src={p.photo || '/UNIKO_NEW.png'} alt="" className={andando ? 'sus-walk' : undefined}
                        style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', filter: ehFantasma
                          ? `grayscale(1) brightness(1.3) drop-shadow(0 0 8px #fff8)`
                          : (eu ? `drop-shadow(0 3px 6px rgba(0,0,0,.4)) drop-shadow(0 0 9px ${AGUA}cc)` : 'drop-shadow(0 3px 6px rgba(0,0,0,.4))') }} />
                      <span style={{ fontSize: 'clamp(11px, 1.5vw, 16px)', fontWeight: 800, color: '#1a1320', background: 'rgba(255,255,255,.88)',
                        borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        {ehFantasma ? '👻 ' : ''}{p.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}

                {/* Iluminação: só enxerga BEM perto do próprio boneco, o resto escurece —
                    mas com uma transição mais larga e gradual (a "sombra") entre o
                    círculo de luz e o preto total, em vez de um corte seco: dá pra
                    enxergar o CONTORNO/sombra dos cômodos vizinhos em penumbra antes
                    de sumir de vez, em vez de ir de "visível" pra "preto" de repente.
                    Centrada na MINHA posição — o raio (%) é sempre um círculo de
                    verdade, mesmo o mapa não sendo quadrado (ver LUZ_RAIO). */}
                {/* Seta da energia — orbita o meu boneco apontando pro painel
                    (ver pintarSeta). `zIndex` acima da luz de propósito: ela
                    precisa brilhar JUSTO quando está tudo escuro. */}
                <div ref={setaRef} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0,
                  display: 'none', zIndex: 5, pointerEvents: 'none' }}>
                  <div className="sus-seta" style={{ position: 'absolute', left: 0, top: 0 }}>
                    <svg width="52" height="52" viewBox="0 0 24 24" style={{ display: 'block', filter: 'drop-shadow(0 0 8px #FBBF24) drop-shadow(0 0 18px #F59E0Bcc)' }}>
                      <path d="M3 12h11" stroke="#FDE68A" strokeWidth="3.4" strokeLinecap="round" />
                      <path d="M13 5.5L21 12l-8 6.5z" fill="#FBBF24" stroke="#FFFBEB" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div ref={lightRef} style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
                  background: lightGradientBg(myPosAtual.x / MAP_W * 100, myPosAtual.y / MAP_H * 100,
                    souFantasma ? LUZ_RAIO.fantasma : meuPapel === 'impostor' ? LUZ_RAIO.impostor : (state?.sabotagem ? LUZ_RAIO.sabotagem : LUZ_RAIO.tripulante)) }} />
              </div>

              {/* Mini-mapa redondo — canto superior direito, mostra a casa inteira (não
                  só a janela com zoom) com um pontinho por tarefa (azul pendente / verde
                  já feita POR MIM) + minha posição. Impostor não vê (ele não tem tarefa). */}
              {meuPapel !== 'impostor' && (
                <div style={{ position: 'absolute', top: '3%', right: '3%', zIndex: 6,
                  width: 'clamp(88px, 13vw, 150px)', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden',
                  border: '3px solid rgba(255,255,255,.85)', boxShadow: '0 6px 18px rgba(0,0,0,.6)', background: '#0B3D45' }}>
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img src={MAPA_IMG} alt="" draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: .8, userSelect: 'none', pointerEvents: 'none' }} />
                    {mapaTarefas.map(t => {
                      const feita = minhasFeitas.has(t.id);
                      return (
                        <div key={t.id} style={{ position: 'absolute', left: `${t.x / MAP_W * 100}%`, top: `${t.y / MAP_H * 100}%`,
                          transform: 'translate(-50%,-50%)', width: '6%', aspectRatio: '1/1', borderRadius: '50%',
                          background: feita ? '#22C55E' : '#3B82F6', border: '1px solid #fff',
                          boxShadow: feita ? 'none' : '0 0 5px #3B82F6' }} />
                      );
                    })}
                    {/* Sabotagem: a sala de energia pisca em amarelo no mini-mapa,
                        pra dar a direção geral que a seta aponta de perto. */}
                    {energiaAlvo && (
                      <div className="sus-emerg" style={{ position: 'absolute', left: `${energiaAlvo.x / MAP_W * 100}%`, top: `${energiaAlvo.y / MAP_H * 100}%`,
                        transform: 'translate(-50%,-50%)', width: '13%', aspectRatio: '1/1', borderRadius: '50%',
                        background: '#FBBF24', border: '2px solid #fff', boxShadow: '0 0 10px #FBBF24' }} />
                    )}
                    <div style={{ position: 'absolute', left: `${myPosAtual.x / MAP_W * 100}%`, top: `${myPosAtual.y / MAP_H * 100}%`,
                      transform: 'translate(-50%,-50%)', width: '8%', aspectRatio: '1/1', borderRadius: '50%',
                      background: '#fff', border: `2px solid ${AGUA}`, boxShadow: '0 0 6px #fff' }} />
                  </div>
                </div>
              )}

              {/* ── Botoeira do canto inferior direito ───────────────────
                  Impostor: MATAR e SABOTAR ficam FIXOS lado a lado o tempo
                  todo (antes apareciam/sumiam e a mão nunca sabia onde ir);
                  quando não dá pra usar, só ficam apagados.
                  Todos: USAR aparece quando tem algo perto — tarefa ou câmera
                  pro tripulante, e também o vórtex pro impostor. */}
              <div style={{ position: 'absolute', right: '3%', bottom: '3%', zIndex: 6,
                display: 'flex', alignItems: 'flex-end', gap: 'clamp(8px, 1.4vw, 16px)' }}>

                {/* USAR — só quando há alvo perto */}
                {alvoUsar && (
                  <button className="sus-btn sus-pop" onClick={usarAlvoProximo} title={alvoUsar.titulo}
                    style={{ ...taskBtnCss, cursor: 'pointer' }}>
                    <img draggable={false} src={BOTAO_USAR_IMG} alt={alvoUsar.titulo}
                      style={{ width: 'clamp(66px, 9.7vw, 110px)', display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.55))' }} />
                  </button>
                )}

                {/* REPORTAR — só quando há corpo perto */}
                {corpoProximo && (
                  <button className="sus-btn sus-pop" onClick={() => reportar(corpoProximo.id)} style={{ ...taskBtnCss, cursor: 'pointer' }} title="Reportar corpo">
                    <img draggable={false} src={BOTAO_REPORTAR_IMG} alt="Reportar corpo"
                      style={{ width: 'clamp(66px, 9.7vw, 110px)', display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.55))' }} />
                  </button>
                )}

                {/* SABOTAR + MATAR — fixos, só pro impostor vivo */}
                {meuPapel === 'impostor' && !souFantasma && !state?.vencedor && (
                  <>
                    <button className="sus-btn" onClick={sabotarEnergia} disabled={!podeSabotar}
                      title={sabotarSegs > 0 ? `Sabotagem recarregando (${sabotarSegs}s)` : state?.sabotagem ? 'J\u00e1 tem uma sabotagem rolando' : 'Sabotar energia'}
                      style={{ ...taskBtnCss, cursor: podeSabotar ? 'pointer' : 'not-allowed' }}>
                      <img draggable={false} src={BOTAO_SABOTAR_IMG} alt="Sabotar energia"
                        style={{ width: 'clamp(66px, 9.7vw, 110px)', display: 'block',
                          opacity: podeSabotar ? 1 : .45,
                          filter: podeSabotar ? 'drop-shadow(0 4px 10px rgba(0,0,0,.55))' : 'grayscale(1) drop-shadow(0 3px 8px rgba(0,0,0,.5))' }} />
                      <ContagemRecarga segs={sabotarSegs} />
                    </button>
                    <button className="sus-btn" onClick={() => vitimaProxima && matar(vitimaProxima)} disabled={!vitimaProxima}
                      title={killSegs > 0 ? `Recarregando (${killSegs}s)` : vitimaProxima ? `Matar ${vitimaProxima.name}` : 'Ningu\u00e9m por perto pra matar'}
                      style={{ ...taskBtnCss, cursor: vitimaProxima ? 'pointer' : 'not-allowed' }}>
                      <img draggable={false} src={BOTAO_MATAR_IMG} alt="Matar"
                        style={{ width: 'clamp(66px, 9.7vw, 110px)', display: 'block',
                          opacity: vitimaProxima ? 1 : .45,
                          filter: vitimaProxima ? 'drop-shadow(0 4px 10px rgba(0,0,0,.55))' : 'grayscale(1) drop-shadow(0 3px 8px rgba(0,0,0,.5))' }} />
                      <ContagemRecarga segs={killSegs} />
                    </button>
                  </>
                )}
              </div>

              {/* ── Avisos grandes, no ALTO e no CENTRO do mapa (ver AvisoJogo).
                  `pointerEvents:none` pra não roubar clique do mapa, e a pilha
                  para em 62% da largura pra nunca cobrir o mini-mapa. */}
              <div style={{ position: 'absolute', top: '2.5%', left: '50%', transform: 'translateX(-50%)', zIndex: 7,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none', maxWidth: '62%' }}>
                {!!state?.sabotagem && (() => {
                  const tripulantesVivos = vivosPorTime(state).tripulantes;
                  const consertaram = tripulantesVivos.filter(n => state.sabotagem.consertadoPor?.includes(n)).length;
                  return (
                    <AvisoJogo cor="#D97706" icone="⚡" titulo="Energia sabotada!"
                      sub={souFantasma
                        ? `Fantasma não conserta — quem está vivo resolve (${consertaram}/${tripulantesVivos.length}).`
                        : meuPapel === 'impostor'
                        ? `Ninguém faz tarefa até todo mundo consertar (${consertaram}/${tripulantesVivos.length}).`
                        : energiaAlvo
                          ? `Siga a seta até a sala de energia (${energiaDist} de distância) — ${consertaram}/${tripulantesVivos.length} consertaram.`
                          : `Você já consertou a sua parte — falta o resto (${consertaram}/${tripulantesVivos.length}).`} />
                  );
                })()}
                {alvoUsar && (
                  <AvisoJogo
                    cor={alvoUsar.tipo === 'vortex' ? '#A855F7' : alvoUsar.tipo === 'camera' ? '#16A34A' : '#2563EB'}
                    icone={alvoUsar.tipo === 'vortex' ? <PortalVortex size={28} /> : alvoUsar.tipo === 'camera' ? '📹' : '📋'}
                    titulo={alvoUsar.titulo} sub="Use o botão ou aperte E" />
                )}
                {vortexProximo && agoraTick < vortexCooldownAte && (
                  <AvisoJogo cor="#7C3AED" icone={<PortalVortex size={28} />} titulo="Vórtex recarregando"
                    sub={`Falta ${Math.ceil((vortexCooldownAte - agoraTick) / 1000)}s pra poder usar de novo.`} />
                )}
              </div>
            </div>

            {/* Legenda de controles em "teclas" de verdade — antes era uma
                linha corrida de texto apagado, difícil de ler no meio do jogo. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14, fontSize: 11.5, color: T.textT }}>
              {[['WASD', 'andar'], ['E', 'interagir'], ...(meuPapel === 'impostor' ? [['F', 'matar']] : []), ['R', 'reportar corpo']].map(([tecla, oQue]) => (
                <span key={tecla} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <kbd style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.16)', color: T.text, fontSize: 10.5, fontWeight: 800,
                    fontFamily: 'inherit', lineHeight: 1.4 }}>{tecla}</kbd>
                  {oQue}
                </span>
              ))}
            </div>
            </>
            )}

            {emergMsg && (
              <div className="sus-pop" style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff',
                background: 'rgba(220,38,38,.92)', borderRadius: 999, padding: '7px 16px', margin: '0 auto', width: 'fit-content' }}>
                {emergMsg}
              </div>
            )}

            {tarefaAberta && (
              <TaskModal task={tarefaAberta} onClose={() => setTarefaAberta(null)}
                onComplete={() => {
                  // Durante a sabotagem, a tarefa de energia conserta em vez de
                  // contar como tarefa normal (ver consertarEnergia/tarefaProxima).
                  if (state?.sabotagem && taskTypeFor(tarefaAberta.label) === 'energia') consertarEnergia();
                  else marcarTarefaFeita(tarefaAberta.id);
                  setTarefaAberta(null);
                }} />
            )}

            {vortexAberto && (
              <VortexPainel atual={vortexAberto} vortexes={mapaVortex} onIr={teleportar} onFechar={() => setVortexAberto(null)} />
            )}

            {cameraAberta !== null && mapaCameras[cameraAberta] && (
              <CamerasPainel cameras={mapaCameras} indice={cameraAberta} onTrocar={setCameraAberta} onFechar={() => setCameraAberta(null)}
                players={players} positions={positions} myPos={myPos} name={name}
                mortos={state?.mortos || []} corpos={state?.corpos || []} fantasmas={state?.fantasmas || []} />
            )}

            {morteAnim && (
              <MorteOverlay matador={morteAnim.matador} matadorFoto={players.find(p => p.name === morteAnim.matador)?.photo} vitimaFoto={photo} />
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ — presence global + lobby/sala
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoSuspect = () => {
  const name = useMemo(() => myName(), []);
  const [photo, setPhoto] = useState(() => myPhotoSrc());
  const [room, setRoom] = useState(null);
  const [picker, setPicker] = useState(false);
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState([]);
  const [sqlMissing, setSqlMissing] = useState(false);
  const lobbyChan = useRef(null);
  const [entrouEm, setEntrouEm] = useState(() => Date.now());
  const jaMontou = useRef(false);
  useEffect(() => { if (!jaMontou.current) { jaMontou.current = true; return; } setEntrouEm(Date.now()); }, [room]);

  useEffect(() => {
    supabase.from('uniko_suspect_state').select('id').limit(1).then(({ error }) => { if (semTabela(error)) setSqlMissing(true); });
  }, []);

  /* ── Entrar numa sala = jogo em tela cheia (ago/2026) ───────────────────
     Pedido do usuário: ao clicar em "entrar", o Portal em volta sai de cena.
     Duas coisas acontecem juntas:
     1) a classe `sus-na-sala` esconde barra lateral / cabeçalho / menu do
        celular por CSS (ver SUS_CSS);
     2) o navegador entra em tela cheia de verdade (Fullscreen API). Isso SÓ
        funciona dentro do gesto do clique, por isso o pedido sai daqui, do
        próprio handler do botão, e não de um efeito depois. Se o navegador
        recusar (permissão/iframe), o item 1 já resolve o essencial. */
  useEffect(() => {
    if (!room) return;
    document.body.classList.add('sus-na-sala');
    return () => document.body.classList.remove('sus-na-sala');
  }, [room]);
  const entrarNaSala = (id) => {
    setRoom(id);
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
        pedir?.call(el)?.catch?.(() => { /* navegador recusou — o CSS já cobre */ });
      }
    } catch { /* Fullscreen API indisponível */ }
  };
  const sairDaSala = () => {
    setRoom(null);
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      }
    } catch { /* já saiu */ }
  };

  const refreshPresence = useCallback(() => {
    const ch = lobbyChan.current; if (!ch) return;
    const list = Object.values(ch.presenceState()).map(arr => arr[arr.length - 1]).filter(Boolean)
      .map(p => ({ name: p.name, photo: p.photo, room: p.room, entrouEm: p.entrouEm }));
    const seen = new Set();
    setTodos(list.filter(p => p?.name && (seen.has(p.name) ? false : (seen.add(p.name), true))));
  }, []);

  useEffect(() => {
    const ch = supabase.channel('uniko-suspect-presence', { config: { presence: { key: name } } });
    lobbyChan.current = ch;
    ch.on('presence', { event: 'sync' }, refreshPresence).on('presence', { event: 'join' }, refreshPresence).on('presence', { event: 'leave' }, refreshPresence);
    ch.subscribe(async (st) => {
      if (st !== 'SUBSCRIBED') return;
      const r = await ch.track({ name, photo, room, entrouEm });
      if (r !== 'ok') console.error('[uniko-suspect] presence track falhou:', r);
      refreshPresence();
    });
    const t = setInterval(refreshPresence, 2000);
    return () => { clearInterval(t); supabase.removeChannel(ch); lobbyChan.current = null; };
  }, [name, photo, room, entrouEm, refreshPresence]);

  const porSala = useMemo(() => { const m = {}; todos.forEach(p => { if (p.room) (m[p.room] = m[p.room] || []).push(p); }); return m; }, [todos]);
  const naSala = useMemo(() => { const l = porSala[room] || []; return l.some(p => p.name === name) ? l : [{ name, photo, room, entrouEm }, ...l]; }, [porSala, room, name, photo, entrouEm]);

  /* ── Seletor de Uniko (o "boneco" da pessoa no jogo) — mesma coleção/mecânica
     do Uniko Paint, mesma chave de storage (up_photo_src), então o Uniko escolhido
     aqui também vale nos outros jogos. NÃO mexe na foto de perfil do Portal. ── */
  const [owned, setOwned] = useState(() => getCapturedCollection());
  useEffect(() => { syncCollectionFromServer().then(l => Array.isArray(l) && setOwned(l)); }, []);
  const myUnikos = useMemo(() => {
    const ids = new Set(owned.map(o => o.id));
    const base = [{ id: 'default', name: 'UNIKO', img: '/UNIKO_NEW.png' }];
    const fixos = Object.values(CAPTURE_UNIKOS).filter(u => ids.has(u.id)).map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    const custom = (getCustomUnikos() || []).filter(u => ids.has(u.id)).map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    return [...base, ...fixos, ...custom];
  }, [owned]);
  // Só o boneco do jogo muda aqui — a foto de perfil do Portal fica como está
  // (chamava `saveUserPhoto` antes; era bug, escolher Uniko trocava a foto do
  // colaborador no Portal inteiro).
  const choosePhoto = (img) => {
    try { localStorage.setItem(PHOTO_SRC_KEY, img); } catch { /* sem localStorage */ }
    setPhoto(img);            // presence reanuncia sozinho no effect de [photo]
    setPicker(false);
  };

  const cardBg = T.surface || '#fff';
  if (sqlMissing) return (
    <div style={{ maxWidth: 620, margin: '40px auto', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <div style={{ width: 76, height: 76, borderRadius: 20, margin: '0 auto 14px', background: `linear-gradient(135deg, ${AGUA}, ${CEU})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🕵️</div>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8 }}>Falta rodar a migração</div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Uniko Detetive precisa da tabela dele. Rode <b style={{ color: T.text }}>supabase_uniko_suspect.sql</b> no SQL Editor do Supabase e recarregue.
      </div>
    </div>
  );

  return (
    // Fundo escuro do módulo: sem este contêiner sobraria o fundo CLARO do
    // Portal em volta do conteúdo (a raiz era um fragmento), e a aba ficava
    // metade escura metade clara.
    <div className="sus-root" onDragStart={e => e.preventDefault()}
      style={{ background: T.page, color: T.text, borderRadius: 16, padding: 14, minHeight: '100%', boxSizing: 'border-box' }}>
      {room
        ? <Sala roomId={room} name={name} photo={photo} players={naSala} onLeave={sairDaSala} onAbrirPicker={() => setPicker(true)} />
        : <Lobby name={name} photo={photo} porSala={porSala} onEnter={entrarNaSala} onAbrirPicker={() => setPicker(true)} />}

      {picker && (() => {
        const termo = busca.trim().toLowerCase();
        const filtrados = !termo ? myUnikos : myUnikos.filter(u => {
          if (u.name.toLowerCase().includes(termo)) return true;
          const vs = hasAssistantSkin(u.id) ? getSkinVariations(u.id) : [];
          return vs.some(v => (v.label || '').toLowerCase().includes(termo));
        });
        return (
          <div onClick={() => setPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,6,24,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: cardBg, borderRadius: 18, border: `1px solid ${T.border}`, padding: 22,
              maxWidth: 680, width: '100%', maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.4)' }}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Escolha seu Uniko</div>
              <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 14, lineHeight: 1.5 }}>
                Esse vai ser o seu boneco no Uniko Detetive (e também sua foto de perfil no Portal). Só aparecem os Unikos que você já capturou.
              </div>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔎 Buscar Uniko pelo nome..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface || '#fff',
                  color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', marginBottom: 14, flexShrink: 0 }} />
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {filtrados.map(u => {
                  const vars = hasAssistantSkin(u.id) ? getSkinVariations(u.id) : [];
                  const opts = vars.length ? vars : [{ label: 'Normal', img: u.img }];
                  return (
                    <div key={u.id} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img draggable={false} src={u.img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />{u.name}
                      </div>
                      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                        {opts.map(v => (
                          <button key={v.img} onClick={() => choosePhoto(v.img)} title={v.label}
                            style={{ width: 78, padding: 7, borderRadius: 12, cursor: 'pointer', background: T.surfaceSub || 'rgba(0,0,0,.03)',
                              border: photo === v.img ? `2px solid ${AGUA}` : `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <img draggable={false} src={v.img} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                            <span style={{ fontSize: 9.5, color: T.textT, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{v.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {myUnikos.length <= 1 && (
                  <div style={{ fontSize: 12.5, color: T.textT, background: T.surfaceSub || 'rgba(0,0,0,.03)', padding: 12, borderRadius: 10, lineHeight: 1.5 }}>
                    Você ainda não capturou nenhum Uniko. Fique de olho no Portal durante os eventos do RH — os Unikos que você pegar aparecem aqui.
                  </div>
                )}
                {myUnikos.length > 1 && filtrados.length === 0 && (
                  <div style={{ fontSize: 12.5, color: T.textT, textAlign: 'center', padding: '18px 0' }}>Nenhum Uniko encontrado para "{busca}".</div>
                )}
              </div>
              <button onClick={() => setPicker(false)}
                style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                Fechar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// Exportados pra Dashboard RH → aba "Uniko Suspect" (UnikoSuspectMapTab.jsx)
// reusar o MESMO mapa/dimensões no editor, sem duplicar constantes.
export { TabUnikoSuspect, MAPA_IMG, MAP_W, MAP_H };
export default TabUnikoSuspect;
