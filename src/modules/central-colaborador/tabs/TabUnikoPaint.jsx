// src/modules/central-colaborador/tabs/TabUnikoPaint.jsx
// ═══════════════════════════════════════════════════════════════════════════
// UNIKO PAINT — desenho e adivinhação em tempo real (estilo Gartic).
//
// ESTRUTURA: LOBBY (lista de salas) → SALA (a partida). Cada sala é uma linha da
// tabela uniko_paint_state, e o `id` é o código dela. A sala 'global' é a "Sala
// Geral": fixa, sempre no lobby, nunca apagada — assim nunca há lobby vazio.
//
// COMO SINCRONIZA (três canais, cada um pro que serve):
//   • PRESENCE DO LOBBY (canal único, todo mundo sempre nele): cada pessoa
//     publica { name, photo, room }. É daí que o lobby sabe quem está em qual
//     sala SEM precisar assinar o canal de todas elas.
//   • BROADCAST DA SALA (efêmero, não toca no banco): traços, formas, balde,
//     chat e o "sync" do desenho pra quem entra no meio. Um traço a cada frame
//     viraria milhares de INSERTs por partida.
//   • TABELA uniko_paint_state (postgres_changes): fase, rodada, quem desenha,
//     placar, votos. Precisa sobreviver a F5 e a quem chega depois.
//     Ver supabase_uniko_paint.sql + supabase_uniko_paint_salas.sql.
//
// QUEM MANDA: não há servidor de jogo. O "host" de cada sala é eleito de forma
// determinística (menor nome entre os presentes; todos chegam à mesma conclusão)
// e é o único que escreve transições de fase e placar. Se ele sai, o próximo
// assume na eleição seguinte.
//
// CANVAS: as ações (traço/balde/forma) vivem em `acts` (ref) normalizadas 0..1 e
// são rasterizadas num canvas BASE offscreen de 1000px com altura ajustada à
// proporção do card; o visível é um blit do base (+ preview da forma em arraste).
// Desenhar é incremental — replay completo
// só em desfazer/limpar/sync. Isso existe por causa do BALDE: flood fill é pixel
// a pixel, e refazer todos os fills a cada segmento de traço travaria o jogo.
//
// LIMITAÇÃO CONHECIDA: a palavra vai no estado só em base64, então dá pra
// trapacear pelo devtools. Esconder de verdade exigiria uma RPC no Postgres
// entregando a palavra só pro desenhista.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos } from '../../../shared/captureUniko';
import { getSkinVariations, hasAssistantSkin } from '../../../shared/assistantSkin';
import { useGamePlaytime } from '../../../hooks/useGamePlaytime';
import { ConvidarButton } from '../../../shared/FriendsInvite';
import { readPendingJoin, clearPendingJoin, GAME_JOIN_EVENT } from '../../../shared/gameInvites';
import { recordUnikoGamesWin } from '../../../shared/prismaMissions';
import GameAdminBanner from './GameAdminBanner';

const ROUND_MS  = 80_000;   // tempo pra desenhar
const REVEAL_MS = 5_000;    // tela de "a palavra era..."
const MIN_PLAYERS = 2;
const MAX_BOTS = 5;
const BOT_OPTIONS = [1, 2, 3, 4, 5];
/* Denúncia de desenho: fração dos jogadores (excluindo o desenhista) que precisa
   denunciar pra encerrar a rodada na hora. 0.5 = maioria (metade ou mais). */
const REPORT_THRESHOLD = 0.5;
/* Expulsar jogador: fração dos OUTROS jogadores (todos menos o alvo) que precisa
   votar pra expulsar alguém da sala. 0.6 = maioria folgada, pra não expulsar à toa. */
const KICK_THRESHOLD = 0.6;
// `array.sort(() => Math.random() - .5)` NÃO embaralha de verdade (o
// comparador não é transitivo, então o resultado sai enviesado pelo sort do
// motor — mais forte ainda em arrays pequenos). Fisher-Yates é o shuffle
// sem viés de verdade (mesmo bug corrigido no Uniko Suspect, ver memória).
const embaralhar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const LAP_OPTIONS = [1, 2, 3, 5, 8];
const DEFAULT_LAPS = 3;
const CW = 1000, CH = 625;  // buffer base; a altura acompanha a proporção visível do card
const GLOBAL_ROOM = 'global';
/* Mascote oficial do Uniko Paint (gato-robô de boina, respingado de tinta). */
const MASCOTE = '/uniko-paint.png';

/* ── CELULAR E TABLET ───────────────────────────────────────────────────────
   Três perguntas diferentes, três flags — juntar tudo num "isMobile" é o que faz
   tablet virar celular gigante (ou computador de dedo grosso):

   • `compacto` — é tela de DEDO (ou janela estreita)? Manda nos alvos de toque e
     em colocar a sala em tela cheia. Vale pra celular E tablet.
   • `empilhado` — cabe o layout de 3 colunas? Ele precisa de largura E altura:
     iPad deitado (1180×820) cabe folgado; iPad EM PÉ não (sobrariam ~320px pro
     desenho entre as duas barras laterais), e celular deitado tem largura de
     sobra mas 430px de altura. Quando não cabe, empilha.
   • `pequeno` — é tela de CELULAR mesmo (menor lado < 500)? Só isso encolhe
     fonte, mascote e rótulo de botão. Num tablet há espaço: encolher lá só
     deixaria tudo pequeno à toa.

   `paisagem` entra porque o desenho é 16:10: deitado ele fica bem maior, em pé
   a largura da tela é o teto do tamanho dele.

   `zoomOut`: no desktop o Portal roda com `zoom:0.8` (ver central-colaborador/
   index.jsx) pra não ficar gigante em tela grande — só que isso NÃO encolhe
   window.innerWidth/innerHeight (são do viewport de verdade, o zoom só afeta
   o layout de dentro dele). Sem compensar, este hook lia a tela como 20%
   menor do que o espaço que o conteúdo zoomado realmente tem pra usar, e
   podia cair num breakpoint errado. Dividindo por 0.8 (mesmo fator do
   wrapper) alinha com o `calc(100vh / 0.8)` que ele já usa lá. Só entra no
   desktop — no celular o Portal nunca aplica esse zoom. */
const ZOOM_PORTAL = 0.8; // mesmo valor do zoom do Portal (index.jsx) — mudou lá, muda aqui também
const useTela = (zoomOut) => {
  const ler = () => {
    const L = (zoomOut ? window.innerWidth / ZOOM_PORTAL : window.innerWidth),
          A = (zoomOut ? window.innerHeight / ZOOM_PORTAL : window.innerHeight);
    const dedo = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const paisagem = L > A;
    const compacto = dedo || L < 820;
    const lobbyDenso = zoomOut && (L < 1160 || A < 850);
    const lobbyEscala90 = zoomOut && !lobbyDenso && A < 930;
    return {
      compacto, paisagem,
      pequeno: Math.min(L, A) < 500,
      empilhado: compacto && !(paisagem && L >= 900 && A >= 620),
      lobbyDenso, lobbyEscala90,
      lobbyLargo: L / A > 1.6,
    };
  };
  const [t, setT] = useState(ler);
  useEffect(() => {
    // Só troca o estado quando algo MUDA de verdade: `resize` dispara a cada
    // pixel (e a cada abrir de teclado no iOS) e re-renderizar o jogo à toa
    // durante um traço custa caro.
    const fn = () => setT(p => {
      const n = ler();
      return (n.compacto === p.compacto && n.paisagem === p.paisagem
        && n.pequeno === p.pequeno && n.empilhado === p.empilhado
        && n.lobbyDenso === p.lobbyDenso && n.lobbyEscala90 === p.lobbyEscala90
        && n.lobbyLargo === p.lobbyLargo) ? p : n;
    });
    fn(); // `zoomOut` pode ter mudado sem nenhum resize (ex.: trocou de aba) — recalcula na hora
    window.addEventListener('resize', fn);
    window.addEventListener('orientationchange', fn);
    return () => { window.removeEventListener('resize', fn); window.removeEventListener('orientationchange', fn); };
  }, [zoomOut]);
  return t;
};

/* Altura (e deslocamento) real da área visível no celular. Quando o teclado
   abre, o iOS NÃO encolhe a janela (innerHeight continua o mesmo): ele só
   encolhe a visualViewport. Sem `h` a barra de palpite ficava embaixo do
   teclado.
   `top` cobre um bug à parte do Safari: ao focar o campo de palpite, ele
   ainda tenta ROLAR O DOCUMENTO (mesmo esse card sendo position:fixed) pra
   "trazer o campo pra vista" — isso desalinha o card (que fica preso no topo
   da LAYOUT viewport) da área que está de fato visível na tela (a VISUAL
   viewport, que passa a começar mais abaixo), cortando o topo do jogo ou
   deixando tudo com aparência quebrada/deslocada. `visualViewport.offsetTop`
   é exatamente essa diferença — aplicando ela como `top` o card acompanha
   pra onde a tela visível realmente foi. */
const useAlturaVisivel = (ativo, zoomOut) => {
  // visualViewport também é do viewport de VERDADE (não encolhe com o `zoom`
  // do Portal) — mesma compensação do useTela acima, senão a tela cheia do
  // celular-compacto sobrava ~20% curta quando essa aba roda com zoom.
  const ler = () => { const vv = window.visualViewport;
    return vv ? { h: zoomOut ? vv.height / ZOOM_PORTAL : vv.height, top: zoomOut ? vv.offsetTop / ZOOM_PORTAL : vv.offsetTop } : { h: null, top: 0 }; };
  const [v, setV] = useState(ler);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!ativo || !vv) return undefined;
    const fn = () => setV(ler());
    fn();
    vv.addEventListener('resize', fn);
    vv.addEventListener('scroll', fn);
    return () => { vv.removeEventListener('resize', fn); vv.removeEventListener('scroll', fn); };
  }, [ativo, zoomOut]);
  return ativo ? v : { h: null, top: 0 };
};

/* ── PALETA ─────────────────────────────────────────────────────────────────
   O Uniko Paint tem identidade PRÓPRIA, tirada do mascote (neon das orelhas e
   olhos + os respingos de tinta), em vez de herdar o azul/cinza do tema do
   Portal — o resto do app segue o tema normalmente, só o jogo é colorido.
   Textos continuam usando T.text/T.textT pra ficarem legíveis em qualquer tema. */
const UP = {
  pink:   '#FF3BA7',
  purple: '#A83BFF',
  cyan:   '#22CFFF',
  lime:   '#7DE83B',
  yellow: '#FFC93B',
  orange: '#FF8A3B',
  red:    '#FF4D5E',
  ink:    '#1A1A2E',
};
const ROOM_BLUE = '#1765F5';
const ROOM_TEXT = '#173B73';
const ROOM_MUTED = '#64748B';
const ROOM_BORDER = '#D5E1F0';
const ROOM_SUB = '#F3F7FC';
const ROOM_SHADOW = '0 4px 14px rgba(12, 48, 110, .12)';
/* Preto ou branco por cima desta cor? Amarelo/lima/ciano pedem texto escuro;
   rosa/roxo/vermelho pedem branco. Sem isso o texto do botão some no fundo.
   (As cores vivas NUNCA são usadas como cor de TEXTO: várias têm contraste <3:1
   sobre branco, e o Portal ainda tem temas escuros — texto usa sempre T.text.) */
const luminancia = (h) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Escolhe entre branco e escuro o que der MAIOR contraste — sem limiar chutado:
// com limiar fixo o laranja caía em texto branco e dava 2.35:1 (ilegível).
const textoSobre = (hex) => {
  const l = luminancia(hex);
  const comBranco = 1.05 / (l + 0.05);
  const comEscuro = (l + 0.05) / (luminancia(UP.ink) + 0.05);
  return comBranco >= comEscuro ? '#FFFFFF' : UP.ink;
};

const A   = UP.pink;                        // destaque principal
const A2  = UP.purple;                      // destaque secundário
const A3  = UP.cyan;                        // terceiro tom (gradientes)
const AG  = 'rgba(255,59,167,.28)';         // brilho/sombra colorida
const RAINBOW = `linear-gradient(115deg, ${UP.pink} 0%, ${UP.purple} 24%, ${UP.cyan} 48%, ${UP.lime} 68%, ${UP.yellow} 85%, ${UP.orange} 100%)`;

/* ── RESPINGOS DE TINTA ─────────────────────────────────────────────────────
   Decoração pura (aria-hidden, sem eventos). Cada respingo é um blob orgânico
   + pingos soltos ao redor, como os do mascote. As posições são fixas e não
   aleatórias: assim não "pulam" a cada render. */
const SPLAT_PATHS = [
  'M52 8c11-2 20 7 21 17s10 13 12 24-6 21-16 25-13 14-24 13-18-9-27-14S6 62 5 51s7-17 11-26S41 10 52 8z',
  'M46 6c13 0 18 12 26 19s16 12 15 25-13 17-22 22-11 18-23 16S24 74 15 66 2 45 7 33s10-13 17-19S33 6 46 6z',
  'M50 4c9 6 8 16 15 23s19 8 20 20-11 16-15 26-4 20-16 22-19-9-29-14S6 66 6 54s5-16 9-25S41-2 50 4z',
];
const Splat = ({ x, y, size = 60, cor, rot = 0, op = 0.14, forma = 0, pingos = true, style, className }) => (
  <svg aria-hidden className={className} viewBox="0 0 92 92" width={size} height={size}
    style={{ position: 'absolute', left: x, top: y, opacity: op, pointerEvents: 'none',
      transform: `rotate(${rot}deg)`, zIndex: 0, ...style }}>
    <path d={SPLAT_PATHS[forma % SPLAT_PATHS.length]} fill={cor} />
    {pingos && <>
      <circle cx="82" cy="20" r="5" fill={cor} />
      <circle cx="14" cy="78" r="3.5" fill={cor} />
      <circle cx="88" cy="62" r="2.6" fill={cor} />
      <circle cx="24" cy="10" r="2.2" fill={cor} />
    </>}
  </svg>
);
/* Chuva de respingos de fundo — posições fixas, uma cor por respingo. */
const SPLATS_HEADER = [
  { x: '3%',  y: '-18%', size: 74, forma: 0, rot: 12,  op: 0.2 },
  { x: '22%', y: '52%',  size: 46, forma: 1, rot: 140, op: 0.16 },
  { x: '46%', y: '-26%', size: 58, forma: 2, rot: 205, op: 0.14 },
  { x: '68%', y: '46%',  size: 40, forma: 0, rot: 78,  op: 0.18 },
  { x: '86%', y: '-14%', size: 62, forma: 1, rot: 250, op: 0.15 },
];
const RoomBackdrop = () => (
  <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
    backgroundColor: ROOM_BLUE,
    backgroundImage: "linear-gradient(rgba(6, 18, 45, .08), rgba(6, 18, 45, .08)), url('/uniko-paint-background-neon.png')",
    backgroundPosition: 'center top', backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }} />
);
/* Sala sem ninguém e parada há mais de 20min é lixo — o lobby faz a faxina. */
const ROOM_TTL_MS = 20 * 60_000;

/* ── TEMAS ─────────────────────────────────────────────────────────────────── */
/* Cada tema tem ~45 palavras de propósito: uma partida de 5 jogadores × 3 voltas
   são 15 rodadas, e com os 2 pulos por rodada o pior caso consome até 45. Com os
   ~20 de antes o baralho ESGOTAVA no meio e as palavras começavam a repetir. */
const THEMES = [
  { id: 'escritorio', nome: 'Escritório', emoji: '💼', words: [
    'headset', 'fone de ouvido', 'teclado', 'notebook', 'gelágua', 'mesa', 'café',
    'geladeira', 'crachá', 'impressora', 'grampeador', 'cafeteira', 'mouse',
    'cadeira de escritório', 'reunião', 'holerite', 'ponto eletrônico', 'monitor',
    'clipe de papel', 'post-it', 'ar-condicionado', 'garrafa térmica',
    'caneta', 'lápis', 'borracha', 'régua', 'caderno', 'agenda', 'calculadora',
    'grampo', 'pasta', 'armário', 'lixeira', 'telefone', 'crachá de visitante',
    'quadro branco', 'projetor', 'apresentação', 'planilha', 'e-mail', 'senha',
    'cabo de rede', 'tomada', 'estagiário', 'chefe', 'café expresso', 'bebedouro',
    'copo descartável', 'elevador', 'escritório vazio'] },
  { id: 'comida', nome: 'Comida', emoji: '🍕', words: [
    'pizza', 'brigadeiro', 'açaí', 'coxinha', 'pastel', 'churrasco', 'sorvete',
    'melancia', 'pipoca', 'hambúrguer', 'sushi', 'bolo de aniversário', 'feijoada',
    'pão de queijo', 'cachorro-quente', 'tapioca', 'ovo frito', 'espaguete',
    'cupcake', 'abacaxi', 'banana', 'churros',
    'batata frita', 'sanduíche', 'lasanha', 'panqueca', 'donut', 'pudim',
    'milkshake', 'refrigerante', 'suco de laranja', 'cerveja', 'vinho', 'queijo',
    'pão francês', 'bolacha', 'chocolate', 'sorvete de casquinha', 'morango',
    'uva', 'maçã', 'cenoura', 'brócolis', 'arroz e feijão', 'salada', 'sopa',
    'churrasquinho', 'pizza de calabresa', 'mandioca', 'pamonha', 'canjica'] },
  { id: 'restaurante', nome: 'Restaurante', emoji: '🍽️', words: [
    'garçom', 'garçonete', 'cardápio', 'mesa reservada', 'guardanapo', 'taça de vinho',
    'garrafa de vinho', 'saca-rolhas', 'toalha de mesa', 'vela na mesa', 'cesta de pão',
    'prato do dia', 'prato de entrada', 'prato principal', 'sobremesa', 'chef de cozinha',
    'cozinha do restaurante', 'fogão industrial', 'panela grande', 'avental',
    'touca de cozinheiro', 'comanda', 'conta do restaurante', 'gorjeta',
    'maquininha de cartão', 'buffet', 'rodízio de carnes', 'fila de espera',
    'mesa de terraço', 'cadeirinha de bebê', 'música ao vivo', 'sommelier', 'molho',
    'saleiro e pimenteiro', 'palito de dente', 'bandeja de garçom',
    'carrinho de sobremesas', 'geladeira de bebidas', 'máquina de café expresso',
    'delivery', 'motoboy', 'embalagem para viagem', 'placa de reservado'] },
  { id: 'animais', nome: 'Animais', emoji: '🐾', words: [
    'gato', 'cachorro', 'pinguim', 'elefante', 'girafa', 'tubarão', 'polvo',
    'borboleta', 'caracol', 'dinossauro', 'coruja', 'tartaruga', 'abelha', 'sapo',
    'cavalo', 'macaco', 'leão', 'cobra', 'peixe', 'aranha', 'preguiça', 'tucano',
    'zebra', 'urso', 'panda', 'coelho', 'rato', 'porco', 'vaca', 'galinha',
    'pato', 'ovelha', 'cabra', 'camelo', 'canguru', 'golfinho', 'baleia',
    'estrela-do-mar', 'caranguejo', 'formiga', 'joaninha', 'mosquito', 'morcego',
    'papagaio', 'pavão', 'flamingo', 'jacaré', 'lagarto', 'esquilo', 'raposa',
    'lobo', 'tigre', 'hipopótamo', 'rinoceronte'] },
  { id: 'filmes', nome: 'Filmes e Séries', emoji: '🎬', words: [
    'titanic', 'homem-aranha', 'batman', 'star wars', 'harry potter', 'rei leão',
    'procurando nemo', 'jurassic park', 'toy story', 'shrek', 'frozen', 'matrix',
    'pantera negra', 'minions', 'e.t.', 'king kong', 'chaves', 'os vingadores',
    'de volta para o futuro', 'a bela e a fera',
    'homem de ferro', 'superman', 'mulher-maravilha', 'hulk', 'thor', 'coringa',
    'darth vader', 'yoda', 'r2-d2', 'gollum', 'senhor dos anéis', 'piratas do caribe',
    'tubarão', 'os incríveis', 'up altas aventuras', 'wall-e', 'ratatouille',
    'divertida mente', 'moana', 'cinderela', 'branca de neve', 'pinóquio',
    'stranger things', 'game of thrones', 'the office', 'friends', 'round 6',
    'homem-formiga', 'capitão américa', 'velozes e furiosos'] },
  { id: 'esportes', nome: 'Esportes', emoji: '⚽', words: [
    'futebol', 'basquete', 'vôlei', 'natação', 'tênis', 'skate', 'surfe', 'boxe',
    'ciclismo', 'corrida', 'judô', 'golfe', 'patins', 'medalha', 'troféu',
    'apito', 'cartão vermelho', 'gol', 'academia', 'halteres',
    'bola de futebol', 'chuteira', 'goleiro', 'pênalti', 'juiz', 'torcida',
    'estádio', 'cesta de basquete', 'raquete', 'rede', 'piscina', 'maratona',
    'tênis de corrida', 'capacete', 'bicicleta', 'skatista', 'prancha de surfe',
    'luva de boxe', 'ringue', 'tatame', 'faixa preta', 'arco e flecha',
    'ginástica', 'trave', 'salto em distância', 'vôlei de praia', 'pebolim',
    'ping-pong', 'boliche', 'xadrez', 'pódio', 'cronômetro'] },
  { id: 'musica', nome: 'Música', emoji: '🎵', words: [
    'guitarra', 'violão', 'bateria', 'piano', 'microfone', 'pandeiro', 'flauta',
    'saxofone', 'caixa de som', 'fone de ouvido', 'disco de vinil', 'karaokê',
    'show', 'partitura', 'triângulo', 'cavaquinho', 'sanfona', 'tambor', 'dj',
    'baixo', 'teclado musical', 'harpa', 'violino', 'trompete', 'gaita',
    'ukulele', 'berimbau', 'agogô', 'chocalho', 'maracas', 'xilofone',
    'nota musical', 'clave de sol', 'metrônomo', 'amplificador', 'palheta',
    'cantor', 'banda', 'orquestra', 'maestro', 'coral', 'palco', 'holofote',
    'radio', 'walkman', 'caixa de música', 'apito', 'batuque', 'roda de samba',
    'guitarra elétrica'] },
  { id: 'natureza', nome: 'Natureza', emoji: '🌳', words: [
    'praia', 'montanha', 'cachoeira', 'arco-íris', 'vulcão', 'ilha', 'floresta',
    'chuva', 'sol', 'lua', 'estrela', 'nuvem', 'árvore', 'flor', 'cacto',
    'deserto', 'rio', 'neve', 'furacão', 'girassol', 'folha', 'pôr do sol',
    'trovão', 'relâmpago', 'tempestade', 'nevoeiro', 'orvalho', 'geada',
    'lago', 'lagoa', 'caverna', 'penhasco', 'vale', 'colina', 'campo',
    'bambu', 'palmeira', 'coqueiro', 'pinheiro', 'rosa', 'margarida', 'tulipa',
    'cogumelo', 'trevo de quatro folhas', 'semente', 'raiz', 'tronco',
    'cometa', 'planeta', 'eclipse', 'aurora boreal', 'oceano', 'onda'] },
  { id: 'tecnologia', nome: 'Tecnologia', emoji: '💻', words: [
    'celular', 'notebook', 'robô', 'satélite', 'foguete', 'drone', 'wi-fi',
    'câmera', 'pen drive', 'carregador', 'controle de videogame', 'realidade virtual',
    'antena', 'bateria', 'tablet', 'smartwatch', 'nuvem', 'senha', 'código de barras',
    'mouse', 'teclado', 'monitor', 'impressora', 'fone bluetooth', 'caixa de som',
    'roteador', 'cabo usb', 'disquete', 'cd', 'hd externo', 'chip', 'placa-mãe',
    'ventoinha', 'joystick', 'fliperama', 'realidade aumentada', 'inteligência artificial',
    'qr code', 'gps', 'radar', 'telescópio', 'microscópio', 'calculadora',
    'lâmpada led', 'painel solar', 'carro elétrico', 'foguete espacial',
    'estação espacial', 'astronauta', 'alienígena'] },
  { id: 'brasil', nome: 'Brasil', emoji: '🇧🇷', words: [
    'carnaval', 'festa junina', 'cristo redentor', 'pão de açúcar', 'samba',
    'capoeira', 'chinelo', 'praia de copacabana', 'boi-bumbá', 'caipirinha',
    'churrasco', 'bandeira do brasil', 'tucano', 'amazônia', 'futebol',
    'cataratas do iguaçu', 'feijoada', 'jangada',
    'pelé', 'garrincha', 'maracanã', 'escola de samba', 'bateria de escola',
    'fantasia de carnaval', 'quadrilha', 'fogueira', 'balão', 'pipa',
    'peteca', 'bumba meu boi', 'frevo', 'forró', 'sanfona', 'baião',
    'açaí', 'guaraná', 'pão de queijo', 'brigadeiro', 'coxinha', 'tapioca',
    'onça-pintada', 'arara', 'mico-leão-dourado', 'boto cor-de-rosa', 'saci',
    'curupira', 'iara', 'lobisomem', 'mula sem cabeça', 'pantanal', 'sertão',
    'favela', 'lençóis maranhenses'] },
  { id: 'objetos', nome: 'Objetos', emoji: '📦', words: [
    'tesoura', 'martelo', 'chave', 'guarda-chuva', 'óculos', 'relógio', 'mochila',
    'escada', 'vassoura', 'balde', 'lâmpada', 'espelho', 'cadeado', 'chaveiro',
    'caneta', 'lápis', 'borracha', 'régua', 'apontador', 'grampeador', 'clipe',
    'livro', 'jornal', 'revista', 'carta', 'envelope', 'selo', 'caixa', 'presente',
    'balão', 'vela', 'isqueiro', 'fósforo', 'lanterna', 'pilha', 'corda', 'prego',
    'parafuso', 'chave de fenda', 'serrote', 'alicate', 'fita métrica', 'pincel',
    'rolo de tinta', 'lata de tinta', 'agulha', 'linha de costura', 'botão',
    'zíper', 'cinto', 'carteira', 'mala', 'garrafa', 'copo', 'funil', 'peneira',
    'ampulheta', 'binóculo', 'lupa', 'bússola', 'termômetro', 'guarda-sol'] },
  { id: 'verbos', nome: 'Verbos', emoji: '🏃', words: [
    'correr', 'pular', 'dormir', 'comer', 'beber', 'chorar', 'rir', 'gritar',
    'cantar', 'dançar', 'nadar', 'voar', 'cair', 'escalar', 'cavar', 'empurrar',
    'puxar', 'carregar', 'jogar', 'chutar', 'pescar', 'cozinhar', 'lavar',
    'varrer', 'pintar', 'desenhar', 'escrever', 'ler', 'estudar', 'trabalhar',
    'dirigir', 'pedalar', 'caminhar', 'sentar', 'levantar', 'abraçar', 'beijar',
    'apontar', 'aplaudir', 'assobiar', 'espirrar', 'bocejar', 'acordar',
    'tomar banho', 'escovar os dentes', 'pentear o cabelo', 'vestir', 'costurar',
    'martelar', 'serrar', 'regar', 'plantar', 'colher', 'varrer o chão',
    'tirar foto', 'telefonar', 'esperar', 'procurar', 'esconder', 'fugir',
    'perseguir', 'derrubar', 'quebrar', 'consertar', 'medir', 'pesar'] },
  { id: 'casa', nome: 'Casa', emoji: '🏠', words: [
    'geladeira', 'sofá', 'chuveiro', 'vassoura', 'panela', 'abajur', 'ventilador',
    'escada', 'chave', 'guarda-chuva', 'espelho', 'relógio', 'travesseiro',
    'balde', 'tesoura', 'martelo', 'lâmpada', 'porta', 'janela', 'tapete',
    'máquina de lavar', 'micro-ondas',
    'cama', 'cobertor', 'cadeira', 'mesa de jantar', 'televisão', 'controle remoto',
    'fogão', 'pia', 'torneira', 'vaso sanitário', 'papel higiênico', 'escova de dente',
    'sabonete', 'toalha', 'cortina', 'quadro na parede', 'vaso de planta',
    'churrasqueira', 'varal', 'ferro de passar', 'aspirador', 'rodo', 'esponja',
    'garfo', 'faca', 'colher', 'prato', 'copo', 'xícara', 'chaleira', 'liquidificador',
    'guarda-roupa', 'cabide', 'gaveta', 'campainha', 'caixa de correio'] },
  { id: 'profissoes', nome: 'Profissões', emoji: '👷', words: [
    'médico', 'professor', 'bombeiro', 'policial', 'cozinheiro', 'pintor',
    'mecânico', 'dentista', 'enfermeiro', 'advogado', 'juiz', 'padeiro',
    'açougueiro', 'cabeleireiro', 'barbeiro', 'costureira', 'pedreiro',
    'eletricista', 'encanador', 'jardineiro', 'agricultor', 'pescador',
    'piloto', 'aeromoça', 'motorista', 'carteiro', 'garçom', 'faxineiro',
    'porteiro', 'segurança', 'astronauta', 'cientista', 'engenheiro',
    'arquiteto', 'veterinário', 'farmacêutico', 'contador', 'jornalista',
    'fotógrafo', 'ator', 'cantor', 'dançarino', 'palhaço', 'mágico',
    'escritor', 'músico', 'chef de cozinha', 'sorveteiro', 'salva-vidas',
    'caminhoneiro', 'costureiro', 'vendedor', 'caixa de supermercado', 'juiz de futebol'] },
  { id: 'hospital', nome: 'Hospital', emoji: '🏥', words: [
    'médico', 'enfermeiro', 'estetoscópio', 'seringa', 'termômetro', 'ambulância',
    'maca', 'cadeira de rodas', 'muleta', 'gesso', 'band-aid', 'esparadrapo',
    'algodão', 'curativo', 'soro', 'agulha', 'vacina', 'comprimido', 'remédio',
    'xarope', 'raio-x', 'coração', 'pulmão', 'esqueleto', 'cérebro', 'dentista',
    'aparelho de pressão', 'máscara cirúrgica', 'luva', 'jaleco', 'touca cirúrgica',
    'bisturi', 'pinça', 'tesoura cirúrgica', 'microscópio', 'ambulatório',
    'pronto-socorro', 'sala de cirurgia', 'leito', 'soro na veia', 'oxigênio',
    'cilindro de oxigênio', 'monitor cardíaco', 'desfibrilador', 'prontuário',
    'receita médica', 'farmácia', 'plano de saúde', 'recepção', 'sala de espera',
    'pediatra', 'cirurgião', 'paramédico', 'psicólogo', 'fisioterapeuta', 'dente'] },
  { id: 'transporte', nome: 'Transporte', emoji: '🚗', words: [
    'carro', 'ônibus', 'avião', 'trem', 'metrô', 'bicicleta', 'moto',
    'caminhão', 'barco', 'navio', 'helicóptero', 'foguete', 'submarino',
    'balão de ar quente', 'patinete', 'skate', 'carroça', 'charrete',
    'táxi', 'ambulância', 'carro de bombeiro', 'viatura', 'trator',
    'escavadeira', 'guindaste', 'empilhadeira', 'van', 'micro-ônibus',
    'bonde', 'teleférico', 'jet ski', 'lancha', 'canoa', 'caiaque',
    'jangada', 'balsa', 'monociclo', 'triciclo', 'carrinho de mão',
    'carrinho de bebê', 'patins', 'trenó', 'carro de corrida', 'kart',
    'caravana', 'motorhome', 'dirigível', 'planador', 'asa-delta', 'paraquedas'] },
  { id: 'roupas', nome: 'Roupas e Acessórios', emoji: '👕', words: [
    'camiseta', 'calça', 'vestido', 'saia', 'shorts', 'blusa', 'casaco',
    'jaqueta', 'moletom', 'terno', 'gravata', 'cachecol', 'luva', 'gorro',
    'boné', 'chapéu', 'óculos de sol', 'cinto', 'meia', 'sapato', 'tênis',
    'sandália', 'chinelo', 'bota', 'salto alto', 'sutiã', 'cueca',
    'calcinha', 'pijama', 'roupão', 'biquíni', 'sunga', 'maiô', 'avental',
    'lenço', 'bolsa', 'mochila', 'carteira', 'relógio de pulso', 'anel',
    'colar', 'brinco', 'pulseira', 'coroa', 'tiara', 'guarda-chuva',
    'colete', 'jaleco', 'fantasia', 'máscara', 'capa de chuva', 'mala de viagem'] },
  { id: 'corpo', nome: 'Corpo Humano', emoji: '🧍', words: [
    'cabeça', 'olho', 'nariz', 'boca', 'orelha', 'sobrancelha', 'cabelo',
    'dente', 'língua', 'lábio', 'queixo', 'bochecha', 'pescoço', 'ombro',
    'braço', 'cotovelo', 'mão', 'dedo', 'unha', 'punho', 'peito', 'barriga',
    'umbigo', 'costas', 'perna', 'joelho', 'pé', 'calcanhar', 'tornozelo',
    'coração', 'cérebro', 'pulmão', 'estômago', 'osso', 'esqueleto',
    'músculo', 'veia', 'sangue', 'coluna', 'costela', 'crânio', 'bigode',
    'barba', 'cílios', 'sardas', 'covinha', 'rosto', 'sorriso', 'lágrima', 'pele'] },
  { id: 'escola', nome: 'Escola', emoji: '🏫', words: [
    'lousa', 'giz', 'apagador', 'caderno', 'lápis', 'caneta', 'borracha',
    'apontador', 'régua', 'mochila', 'estojo', 'cola', 'tesoura', 'globo',
    'mapa', 'livro', 'dicionário', 'prova', 'boletim', 'nota', 'recreio',
    'merenda', 'professora', 'aluno', 'diretor', 'carteira escolar',
    'sala de aula', 'biblioteca', 'quadra', 'refeitório', 'bandeira',
    'esquadro', 'compasso', 'transferidor', 'calculadora', 'mochila de rodinha',
    'cadeira', 'lancheira', 'formatura', 'diploma', 'crachá', 'sirene',
    'quadro de avisos', 'giz de cera', 'tinta guache', 'pincel', 'origami',
    'ábaco', 'microscópio', 'experiência'] },
  { id: 'viagem', nome: 'Viagem e Lugares', emoji: '✈️', words: [
    'torre eiffel', 'estátua da liberdade', 'pirâmide', 'coliseu',
    'torre de pisa', 'muralha da china', 'cristo redentor', 'praia',
    'hotel', 'aeroporto', 'passaporte', 'mala', 'mapa-múndi', 'bússola',
    'câmera fotográfica', 'barraca', 'acampamento', 'farol', 'ponte',
    'castelo', 'igreja', 'mesquita', 'templo', 'museu', 'zoológico',
    'parque de diversões', 'roda-gigante', 'montanha-russa', 'carrossel',
    'praça', 'estádio', 'shopping', 'restaurante', 'cinema', 'teatro',
    'biblioteca', 'estação de trem', 'porto', 'deserto', 'oásis', 'iglu',
    'cabana', 'arranha-céu', 'fazenda', 'moinho', 'catedral', 'ruínas',
    'ilha tropical', 'vulcão', 'geleira'] },
  { id: 'fantasia', nome: 'Fantasia e Mitologia', emoji: '🐉', words: [
    'dragão', 'unicórnio', 'fada', 'bruxa', 'mago', 'fantasma', 'vampiro',
    'lobisomem', 'zumbi', 'múmia', 'esqueleto', 'gênio da lâmpada', 'sereia',
    'ogro', 'troll', 'duende', 'anão', 'elfo', 'gnomo', 'centauro',
    'minotauro', 'medusa', 'ciclope', 'fênix', 'grifo', 'pégaso', 'kraken',
    'cavaleiro', 'princesa', 'rei', 'rainha', 'castelo', 'espada', 'escudo',
    'varinha mágica', 'poção', 'caldeirão', 'bola de cristal', 'tapete voador',
    'super-herói', 'capa', 'robô gigante', 'monstro', 'alienígena', 'disco voador',
    'saci', 'curupira', 'iara', 'boitatá', 'papai noel'] },
  { id: 'games', nome: 'Games e Internet', emoji: '🎮', words: [
    'controle de videogame', 'joystick', 'fliperama', 'mouse', 'teclado',
    'headset', 'live', 'streamer', 'avatar', 'skin', 'fone gamer', 'cadeira gamer',
    'emoji', 'curtida', 'seguidor', 'hashtag', 'selfie', 'meme', 'gif',
    'vídeo viral', 'stories', 'notificação', 'wi-fi', 'download', 'senha',
    'e-mail', 'arroba', 'bloqueado', 'carrinho de compras', 'código qr',
    'joguinho da cobrinha', 'campo minado', 'paciência', 'xadrez online',
    'battle royale', 'chefe final', 'vida extra', 'moeda do jogo', 'checkpoint',
    'game over', 'nível', 'ranking', 'troféu', 'conquista', 'pixel', 'console',
    'cartucho', 'controle sem fio', 'realidade virtual', 'nuvem'] },
  { id: 'emocoes', nome: 'Emoções e Expressões', emoji: '😄', words: [
    'feliz', 'triste', 'bravo', 'com medo', 'surpreso', 'apaixonado',
    'entediado', 'cansado', 'com sono', 'com fome', 'com frio', 'com calor',
    'com raiva', 'chorando', 'rindo', 'gargalhando', 'chateado', 'nervoso',
    'animado', 'assustado', 'envergonhado', 'confuso', 'orgulhoso', 'ciumento',
    'com ciúme', 'tímido', 'corajoso', 'preguiçoso', 'curioso', 'saudade',
    'coração partido', 'apaixonar-se', 'beijo', 'abraço', 'aperto de mão',
    'joia', 'polegar pra cima', 'aplausos', 'careta', 'piscadinha', 'bocejo',
    'espirro', 'soluço', 'arrepio', 'suspiro', 'sorriso', 'lágrima', 'gargalhada',
    'susto', 'alívio'] },
  { id: 'clima', nome: 'Clima e Estações', emoji: '⛅', words: [
    'sol', 'chuva', 'nuvem', 'trovão', 'relâmpago', 'arco-íris', 'neve',
    'granizo', 'nevoeiro', 'vento', 'furacão', 'tornado', 'tempestade',
    'guarda-chuva', 'guarda-sol', 'boneco de neve', 'floco de neve',
    'poça d\'água', 'ventania', 'geada', 'orvalho', 'seca', 'enchente',
    'primavera', 'verão', 'outono', 'inverno', 'termômetro', 'cata-vento',
    'biruta', 'raio de sol', 'céu estrelado', 'lua cheia', 'eclipse',
    'aurora boreal', 'maré', 'onda de calor', 'friagem', 'chuva de granizo',
    'garoa', 'temporal', 'pé de vento', 'sombra', 'mormaço', 'brisa',
    'nublado', 'ensolarado', 'chuvisco', 'clima', 'estação'] },
  { id: 'fazenda', nome: 'Fazenda', emoji: '🚜', words: [
    'fazenda', 'trator', 'celeiro', 'vaca', 'porco', 'galinha', 'cavalo', 'ovelha',
    'cabra', 'pato', 'ganso', 'coelho', 'fazendeiro', 'espantalho', 'silo', 'curral',
    'feno', 'milharal', 'plantação', 'arado', 'charrete', 'moinho de vento', 'cerca',
    'chiqueiro', 'galinheiro', 'estábulo', 'colheita', 'semente', 'regador', 'enxada',
    'foice', 'pá', 'carroça de feno', 'cachorro de fazenda', 'gato do celeiro', 'burro',
    'pônei', 'touro', 'bezerro', 'pintinho', 'ninho de galinha', 'ovo', 'leite',
    'queijo', 'manteiga', 'mel', 'colmeia', 'abelha', 'borboleta', 'minhoca'] },
  { id: 'espaco', nome: 'Espaço', emoji: '🚀', words: [
    'foguete', 'astronauta', 'nave espacial', 'planeta', 'lua', 'sol', 'estrela',
    'cometa', 'meteoro', 'buraco negro', 'via láctea', 'saturno', 'marte', 'terra',
    'satélite', 'telescópio', 'capacete espacial', 'alienígena', 'disco voador',
    'base lunar', 'estação espacial', 'traje espacial', 'painel de controle',
    'lançamento', 'contagem regressiva', 'órbita', 'constelação', 'nebulosa',
    'asteroide', 'sonda espacial', 'robô explorador', 'bandeira na lua',
    'pegada na lua', 'sistema solar', 'cratera', 'anel de saturno', 'cauda de cometa',
    'aurora boreal', 'eclipse solar', 'eclipse lunar', 'supernova', 'galáxia',
    'universo', 'ovni', 'marciano', 'antena parabólica', 'painel solar', 'módulo lunar',
    'gravidade zero', 'estrela cadente'] },
  /* Nomes de PERSONAGEM, não os acessórios deles (ago/2026): a lista era
     genérica ("teia de aranha", "capa", "escudo") e ninguém adivinhava o
     herói — quem desenhava o Homem-Aranha via "teia de aranha" na tela.
     Mesmo estilo do tema Filmes e Séries logo acima: minúsculo, como se
     fala. */
  { id: 'superherois', nome: 'Super-heróis', emoji: '🦸', words: [
    'homem-aranha', 'batman', 'super-homem', 'mulher-maravilha', 'homem de ferro',
    'capitão américa', 'hulk', 'thor', 'viúva negra', 'gavião arqueiro',
    'pantera negra', 'capitã marvel', 'doutor estranho', 'homem-formiga', 'vespa',
    'feiticeira escarlate', 'visão', 'flash', 'aquaman', 'lanterna verde',
    'ciborgue', 'shazam', 'robin', 'batgirl', 'super-girl',
    'wolverine', 'deadpool', 'tempestade', 'ciclope', 'fera',
    'noturno', 'vampira', 'mística', 'magneto', 'professor xavier',
    'demolidor', 'justiceiro', 'motoqueiro fantasma', 'homem de areia',
    'senhor fantástico', 'mulher invisível', 'tocha humana', 'coisa',
    'surfista prateado', 'groot', 'rocket raccoon', 'gamora', 'senhor das estrelas',
    'coringa', 'arlequina', 'mulher-gato', 'pinguim', 'charada', 'duas-caras', 'bane',
    'duende verde', 'doutor octopus', 'venom', 'thanos', 'loki', 'ultron',
    'doutor destino', 'mulher-hulk', 'falcão', 'soldado invernal', 'chapolin colorado'] },
  { id: 'praia', nome: 'Praia e Mar', emoji: '🏖️', words: [
    'guarda-sol', 'castelo de areia', 'concha', 'caranguejo', 'água de coco', 'picolé',
    'prancha de surfe', 'boia', 'onda', 'chinelo', 'óculos escuros', 'canga',
    'cadeira de praia', 'barraca', 'vôlei de praia', 'frescobol', 'quiosque', 'milho verde',
    'protetor solar', 'bronzeado', 'queimadura de sol', 'salva-vidas', 'gaivota',
    'estrela-do-mar', 'pegada na areia', 'pôr do sol', 'coqueiro', 'areia', 'maré',
    'isopor', 'mate gelado', 'biscoito de polvilho', 'pipa', 'jangada', 'farol', 'duna',
    'piscina natural', 'mergulho', 'snorkel', 'pé de vento', 'toalha', 'sandália', 'sunga',
    'maiô', 'polvo', 'tubarão', 'baleia', 'golfinho', 'água-viva', 'cavalo-marinho',
    'coral', 'anêmona', 'tartaruga marinha', 'arraia', 'enguia', 'siri', 'camarão', 'lula',
    'ostra', 'pérola', 'submarino', 'escafandro', 'navio naufragado', 'baú do tesouro',
    'âncora', 'rede de pesca', 'anzol', 'bolha', 'alga', 'recife', 'peixe-palhaço',
    'baiacu', 'peixe-espada', 'ouriço', 'foca', 'leão-marinho', 'pinguim', 'iceberg',
    'sereia', 'tridente', 'periscópio', 'sonar', 'plâncton', 'krill', 'moreia',
    'caranguejo-aranha', 'fosso oceânico'] },
  { id: 'festajunina', nome: 'Festa Junina', emoji: '🎉', words: [
    'fogueira', 'bandeirinha', 'quadrilha', 'chapéu de palha', 'pescaria',
    'pé de moleque', 'paçoca', 'canjica', 'pamonha', 'curau', 'quentão',
    'maçã do amor', 'algodão-doce', 'pipoca', 'milho cozido', 'bolo de fubá',
    'arraiá', 'sanfona', 'triângulo', 'zabumba', 'forró', 'casamento caipira',
    'noiva caipira', 'noivo caipira', 'padre', 'delegado', 'correio elegante',
    'barraca de tiro ao alvo', 'argola', 'boca do palhaço', 'cadeia',
    'fogos de artifício', 'balão', 'espantalho', 'vestido de chita',
    'trança', 'sardinha pintada', 'dente pintado', 'bigode pintado',
    'mastro', 'fita colorida', 'quermesse', 'boi-bumbá'] },
  { id: 'natal', nome: 'Natal', emoji: '🎄', words: [
    'árvore de natal', 'papai noel', 'rena', 'trenó', 'presente', 'laço',
    'meia de natal', 'guirlanda', 'sino', 'pisca-pisca', 'estrela do topo',
    'bola de natal', 'boneco de neve', 'floco de neve', 'lareira', 'vela',
    'panetone', 'chester', 'ceia', 'amigo secreto', 'cartão de natal',
    'presépio', 'anjo', 'ovelha', 'manjedoura', 'rei mago', 'camelo',
    'duende', 'oficina do papai noel', 'chaminé', 'saco de presentes',
    'biscoito de gengibre', 'bengala doce', 'azevinho', 'coroa de flores',
    'neve', 'lua cheia', 'canção de natal', 'coral', 'espírito natalino',
    'papel de presente', 'fita', 'etiqueta'] },
  { id: 'terror', nome: 'Terror', emoji: '👻', words: [
    'fantasma', 'vampiro', 'lobisomem', 'múmia', 'zumbi', 'bruxa', 'caldeirão',
    'vassoura', 'gato preto', 'morcego', 'aranha', 'teia de aranha', 'caveira',
    'esqueleto', 'lápide', 'cemitério', 'castelo assombrado', 'porta rangendo',
    'corrente', 'abóbora', 'vela derretida', 'espelho quebrado', 'sótão',
    'porão', 'grito', 'sombra', 'olho na fechadura', 'boneca assustadora',
    'palhaço assustador', 'máscara', 'motosserra', 'lua cheia', 'névoa',
    'coruja', 'corvo', 'cruz', 'alho', 'estaca', 'caixão', 'sarcófago',
    'poção', 'livro de feitiços', 'bola de cristal', 'tabuleiro ouija'] },
  { id: 'construcao', nome: 'Construção', emoji: '🔨', words: [
    'martelo', 'prego', 'parafuso', 'chave de fenda', 'chave inglesa', 'alicate',
    'serrote', 'furadeira', 'trena', 'nível', 'esquadro', 'lixa', 'espátula',
    'pincel', 'rolo de pintura', 'lata de tinta', 'escada', 'andaime',
    'capacete', 'colete refletivo', 'luva', 'óculos de proteção', 'bota',
    'carrinho de mão', 'pá', 'enxada', 'picareta', 'betoneira', 'cimento',
    'areia', 'tijolo', 'telha', 'viga', 'coluna', 'planta baixa', 'trado',
    'guindaste', 'retroescavadeira', 'trator', 'britadeira', 'cone de trânsito',
    'fita zebrada', 'obra', 'placa de obra', 'caixa de ferramentas'] },
  /* Disney: SO nome de personagem ou título de filme — nada de objeto
     genérico ('Orelhas do Mickey', 'Maçã Envenenada'): dá pra desenhar, mas
     ninguém acerta a frase exata e a rodada trava. Personagem só entra se
     for nome de todo mundo (Simba, Elsa, Woody); secundário tipo Doc Hudson
     já saiu pelo mesmo motivo. */
  { id: 'disney', nome: 'Filmes da Disney', emoji: '🏰', words: [
    'Branca de Neve e os Sete Anões', 'Pinóquio', 'Dumbo', 'Bambi', 'Cinderela',
    'Alice no País das Maravilhas', 'Peter Pan', 'A Dama e o Vagabundo',
    'A Bela Adormecida', '101 Dálmatas', 'Mogli o Menino Lobo', 'Aristogatas', 'Robin Hood',
    'Bernardo e Bianca', 'Oliver e sua Turma', 'A Pequena Sereia', 'A Bela e a Fera',
    'Aladdin', 'O Rei Leão', 'Pocahontas', 'O Corcunda de Notre Dame', 'Hércules', 'Mulan',
    'Tarzan', 'Fantasia', 'A Nova Onda do Imperador', 'Atlantis', 'Lilo & Stitch',
    'Irmão Urso', 'Bolt', 'A Princesa e o Sapo', 'Enrolados', 'Detona Ralph', 'Frozen',
    'Operação Big Hero', 'Zootopia', 'Moana', 'Ralph vs. Internet', 'Frozen 2',
    'Raya e o Último Dragão', 'Encanto', 'Wish', 'Toy Story', 'Vida de Inseto',
    'Monstros S.A.', 'Procurando Nemo', 'Os Incríveis', 'Carros', 'Ratatouille', 'Wall-E',
    'Up Altas Aventuras', 'Valente', 'Divertida Mente', 'O Bom Dinossauro',
    'Procurando Dory', 'Viva a Vida é uma Festa', 'Dois Irmãos', 'Soul', 'Luca',
    'Red Crescer é uma Fera', 'Elementos', 'Piratas do Caribe', 'Mary Poppins',
    'O Livro da Selva', 'Mickey Mouse', 'Minnie', 'Pato Donald', 'Pateta', 'Pluto', 'Simba',
    'Timão', 'Pumba', 'Elsa', 'Anna', 'Olaf', 'Ariel', 'Branca de Neve', 'Bela', 'Fera',
    'Jasmine', 'Gênio', 'Rapunzel', 'Maui', 'Stitch', 'Woody', 'Buzz Lightyear', 'Nemo',
    'Dory', 'Sulley', 'Mike Wazowski', 'Remy', 'Sininho', 'Capitão Gancho',
    'Cruella de Vil', 'Relâmpago McQueen', 'Baloo', 'Alegria', 'Tristeza'] },
  { id: 'cagonas', nome: 'Cagonas do Presídio', emoji: '🦩', words: [
    'Coca da Mãezinha', 'Flaminga', 'She Knows', 'Quarto Monange', 'Piscina',
    'Perucas', 'Festa dos Signos', 'Carnaval', 'Cagonas do Presídio', 'Festa Maluca',
    'Praia do Presídio', 'Trisal', 'Mãezinha', 'Flaminga de peruca', 'Coca na piscina',
    'Carnaval das Cagonas', 'Festa na Praia do Presídio', 'Trisal no Quarto Monange',
    'Cagona de peruca', 'Piscina do Presídio', 'Festa dos Signos no Presídio',
    'She Knows no Carnaval', 'Casa monstro', 'Bananinha da Kill', 'Beats',
    'Cocô na Geladeira', 'Bunda da Abner', 'Quarto dos Héteros', 'Sunga Branca do João',
    'Língua Azul', 'Lucas Guedes'] },
  /* Nome de artista de verdade (cantores), metade internacional metade
     brasileiro — mesmo estilo do tema Disney (nome próprio com maiúscula),
     não instrumento/objeto (isso já é o tema Música). */
  { id: 'artistas', nome: 'Artistas', emoji: '🎤', words: [
    'Taylor Swift', 'Sabrina Carpenter', 'The Weeknd', 'Beyoncé', 'Rihanna',
    'Ariana Grande', 'Billie Eilish', 'Dua Lipa', 'Bruno Mars', 'Ed Sheeran',
    'Justin Bieber', 'Katy Perry', 'Lady Gaga', 'Madonna', 'Michael Jackson',
    'Adele', 'Shakira', 'Selena Gomez', 'Miley Cyrus', 'Olivia Rodrigo',
    'Harry Styles', 'Drake', 'Post Malone', 'Doja Cat', 'Freddie Mercury', 'Lana Del Rey',
    'Anitta', 'Marina Sena', 'Gal Costa', 'Pabllo Vittar', 'Ivete Sangalo',
    'Ludmilla', 'Wesley Safadão', 'Gusttavo Lima', 'Marília Mendonça', 'Caetano Veloso',
    'Gilberto Gil', 'Roberto Carlos', 'Elis Regina', 'Zeca Pagodinho', 'Claudia Leitte',
    'Pedro Sampaio', 'Xuxa', 'Sandy', 'Luísa Sonza', 'Iza',
    'Preta Gil', 'Maria Bethânia', 'Rita Lee', 'Tim Maia'] },
];
const GERAL = { id: 'geral', nome: 'Geral', emoji: '🎲', words: [...new Set(THEMES.flatMap(t => t.words))] };
const ALL_THEMES = [GERAL, ...THEMES];
const themeById = (id) => ALL_THEMES.find(t => t.id === id) || GERAL;
/* Cada tema tem sua cor de tinta — o lobby fica colorido e dá pra reconhecer a
   sala pela cor antes de ler o nome. Escolhidas à mão (e não por hash do id):
   o hash amontoava 4 temas na mesma cor e deixava outras sem uso. Aqui elas
   combinam com o assunto — comida laranja, natureza verde, Brasil amarelo. */
const COR_TEMA = {
  geral: UP.pink,     escritorio: UP.cyan,  comida:  UP.orange, animais: UP.lime,
  filmes: UP.purple,  esportes: UP.red,     musica:  UP.pink,   natureza: UP.lime,
  tecnologia: UP.cyan, brasil: UP.yellow,   casa:    UP.orange,
  objetos: UP.purple, verbos: UP.red,
  profissoes: UP.cyan, transporte: UP.red,  roupas: UP.purple,  corpo: UP.pink,
  escola: UP.yellow,   viagem: UP.lime,     fantasia: UP.purple, games: UP.cyan,
  emocoes: UP.orange,  clima: UP.yellow,    hospital: UP.red,
  fazenda: UP.lime,    espaco: UP.cyan,      superherois: UP.red,
  praia: UP.cyan, festajunina: UP.yellow, natal: UP.red,
  terror: UP.purple, construcao: UP.yellow, disney: UP.purple,
  cagonas: UP.orange, restaurante: UP.red, artistas: UP.pink,
};
const corDoTema = (id) => COR_TEMA[id] || UP.pink;

/* Paleta de desenho: as cores do mascote + o básico que todo desenho precisa
   (preto pra contorno, marrom, branco pra corrigir) + tons extras pra dar mais
   variedade (claros/escuros, pele, extras vivos). */
const COLORS = [
  UP.ink, '#4A4A5A', '#7A7A8C', '#C4C4CE', '#FFFFFF',
  UP.red, '#8B1E2D', UP.orange, '#FF8FB1', UP.pink,
  UP.yellow, '#FFD9A0', '#F1C27D', '#8B5E34', '#5A3A1A',
  UP.lime, '#0FA36B', '#1E7A5A', UP.cyan, '#1E5FA8',
  UP.purple, '#3B1E6E',
];
const SIZES = [3, 8, 16, 30];
const TOOLS = [
  { id: 'brush',  nome: 'Pincel' },
  { id: 'line',   nome: 'Linha',    shape: true },
  { id: 'rect',   nome: 'Quadrado', shape: true },
  { id: 'circle', nome: 'Círculo',  shape: true },
  { id: 'tri',    nome: 'Triângulo', shape: true },
  { id: 'hex',    nome: 'Hexágono',  shape: true },
  { id: 'star',   nome: 'Estrela',   shape: true },
  { id: 'heart',  nome: 'Coração',   shape: true },
  { id: 'fill',   nome: 'Balde' },
  { id: 'eraser', nome: 'Borracha' },
];

/* base64 com acento (btoa puro quebra em "coração"). */
const enc = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return ''; } };
const dec = (s) => { try { return decodeURIComponent(escape(atob(s || ''))); } catch { return ''; } };
/* Compara palpite com a palavra ignorando acento, caixa e espaço extra. */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, ' ').trim();
/* Pra "quase lá": ignora TAMBÉM hífen e pontuação, colando tudo. É o que faz
   "boto cor de rosa" bater com "boto cor-de-rosa" — a pessoa sabe a resposta,
   só escreveu com outra pontuação. */
const normFolgado = (s) => norm(s).replace(/[^a-z0-9]/g, '');

const criarBotsDaSala = (jogadores, quantidade = 0) => {
  const total = Math.min(MAX_BOTS, Math.max(0, Number(quantidade) || 0));
  const nomes = new Set(jogadores.map(jogador => jogador.name));
  return Array.from({ length: total }, (_, i) => {
    const base = `Bot Uniko ${i + 1}`;
    let name = base, sufixo = 2;
    while (nomes.has(name)) name = `${base} (${sufixo++})`;
    nomes.add(name);
    return { id: `uniko-paint-bot-${i + 1}`, name, photo: '/UNIKO_NEW.png', isBot: true, isAdmin: false };
  });
};

const desenhoDoBot = (word) => {
  const n = norm(word).replace(/[^a-z0-9]+/g, ' ').trim();
  const has = (pattern) => new RegExp(`(?:^|\\s)(?:${pattern.source})(?=$|\\s)`).test(n);
  const azul = '#2864A8', tinta = '#172235', rosa = '#FF8FB1';
  const a = (t, x1, y1, x2, y2, c = azul, f = false, w = 9) => ({
    t, a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, c, f, w,
  });
  const l = (x1, y1, x2, y2, c = azul, w = 9) => a('l', x1, y1, x2, y2, c, false, w);
  const s = (pts, c = azul, w = 8) => ({
    t: 's', pts: pts.map(([x, y]) => ({ x, y })), c, w,
  });
  const r = (x1, y1, x2, y2, c = azul, f = false) => a('r', x1, y1, x2, y2, c, f);
  const c = (x1, y1, x2, y2, color = azul, f = false, w = 8) => a('c', x1, y1, x2, y2, color, f, w);
  const tri = (x1, y1, x2, y2, color = azul, f = false) => a('tri', x1, y1, x2, y2, color, f);

  if (has(/mickey|minnie/)) return [
    c(.36, .34, .64, .64, '#20232B', true), c(.23, .2, .4, .38, '#20232B', true),
    c(.6, .2, .77, .38, '#20232B', true), c(.42, .43, .46, .48, '#FFFFFF', true, 2),
    c(.54, .43, .58, .48, '#FFFFFF', true, 2), c(.46, .52, .54, .59, '#FF8FB1', true, 2),
    l(.43, .68, .39, .82, '#E85D75', 7), l(.57, .68, .61, .82, '#E85D75', 7),
  ];
  if (has(/elsa|frozen|olaf|boneco de neve/)) return [
    c(.36, .18, .64, .42, '#F1C27D', true), c(.4, .08, .62, .28, '#69D8F5', true),
    c(.34, .41, .66, .76, '#8D5BD6', true), tri(.33, .42, .67, .57, '#69D8F5', true),
    c(.42, .28, .46, .33, tinta, true, 2), c(.54, .28, .58, .33, tinta, true, 2),
    s([[.43, .37], [.5, .4], [.57, .37]], '#E85D75', 4),
    s([[.72, .24], [.78, .16], [.84, .24], [.78, .32], [.72, .24]], '#69D8F5', 5),
  ];
  if (has(/simba|leao/)) return [
    c(.24, .2, .76, .72, '#C77A32', true), c(.33, .31, .67, .65, '#F1C27D', true),
    c(.25, .26, .38, .39, '#F1C27D', true), c(.62, .26, .75, .39, '#F1C27D', true),
    c(.4, .42, .45, .48, tinta, true, 2), c(.55, .42, .6, .48, tinta, true, 2),
    c(.46, .52, .54, .59, '#3F2B26', true, 2), l(.5, .59, .5, .64, tinta, 4),
    s([[.4, .57], [.32, .55]], tinta, 3), s([[.6, .57], [.68, .55]], tinta, 3),
    l(.38, .68, .32, .82, '#C77A32', 9), l(.62, .68, .68, .82, '#C77A32', 9),
  ];
  if (has(/ariel|sereia/)) return [
    c(.38, .19, .62, .43, '#F1C27D', true), s([[.42, .4], [.36, .52], [.4, .64]], '#E85D75', 9),
    s([[.58, .4], [.64, .52], [.6, .64]], '#E85D75', 9), c(.34, .59, .66, .75, '#8D5BD6', true),
    tri(.35, .68, .49, .85, '#49B675', true), tri(.51, .68, .65, .85, '#49B675', true),
    c(.44, .29, .47, .33, tinta, true, 2), c(.53, .29, .56, .33, tinta, true, 2),
    s([[.45, .37], [.5, .4], [.55, .37]], '#E85D75', 4),
  ];
  if (has(/wall.?e|robo|robot/)) return [
    r(.31, .27, .69, .65, '#FFD65A', true), r(.36, .33, .64, .49, '#172235', true),
    c(.4, .37, .49, .46, '#69D8F5', true), c(.52, .37, .61, .46, '#69D8F5', true),
    l(.39, .65, .34, .79, '#8999AA', 9), l(.61, .65, .66, .79, '#8999AA', 9),
    l(.5, .27, .5, .16, '#8999AA', 5), c(.47, .1, .53, .16, '#E85D75', true),
    r(.38, .54, .62, .6, '#F2B84B', true),
  ];
  if (has(/homem aranha|spider man|aranha/)) return [
    c(.34, .18, .66, .52, '#E63946', true), s([[.36, .25], [.5, .34], [.64, .25]], '#172235', 4),
    s([[.34, .35], [.5, .43], [.66, .35]], '#172235', 4), s([[.39, .48], [.5, .4], [.61, .48]], '#172235', 4),
    tri(.34, .48, .66, .81, '#2864A8', true), l(.37, .52, .21, .68, '#E63946', 9),
    l(.63, .52, .79, .68, '#E63946', 9), l(.43, .78, .39, .88, tinta, 9),
    l(.57, .78, .61, .88, tinta, 9),
  ];
  if (has(/harry potter|feiticeir[oa]|mago/)) return [
    c(.37, .25, .63, .51, '#F1C27D', true), tri(.32, .14, .68, .33, '#5B3A92', true),
    c(.4, .34, .48, .42, '#D8E5F4', false, 4), c(.52, .34, .6, .42, '#D8E5F4', false, 4),
    l(.48, .38, .52, .38, tinta, 3), c(.45, .29, .47, .31, tinta, true, 1),
    c(.53, .29, .55, .31, tinta, true, 1), tri(.35, .49, .65, .82, '#5B3A92', true),
    l(.7, .45, .84, .24, '#8B4F38', 5), c(.81, .18, .86, .23, '#FFD65A', true, 2),
    s([[.75, .16], [.78, .11], [.81, .16]], '#69D8F5', 4),
  ];
  if (has(/jurassic|dinossauro|tiranossauro|t.?rex/)) return [
    s([[.23, .72], [.32, .59], [.31, .45], [.39, .31], [.5, .25], [.62, .31],
      [.66, .43], [.75, .48], [.83, .57], [.72, .64], [.61, .59], [.55, .75],
      [.43, .76], [.4, .63], [.32, .74], [.23, .72]], '#49B675', 9),
    c(.61, .33, .65, .38, tinta, true, 2), tri(.7, .51, .75, .58, '#FFFFFF', true),
    tri(.64, .55, .7, .62, '#FFFFFF', true), l(.46, .71, .42, .84, '#28664A', 8),
    l(.56, .71, .6, .84, '#28664A', 8), s([[.23, .72], [.14, .68], [.1, .61]], '#28664A', 8),
  ];
  if (has(/titanic/)) return [
    s([[.16, .55], [.84, .55], [.72, .72], [.3, .72], [.16, .55]], '#243247', 8),
    r(.39, .37, .61, .55, '#F5D9A8', true), l(.5, .25, .5, .56, '#8B4F38', 5),
    tri(.28, .31, .48, .53, '#FFFFFF', true), c(.64, .11, .83, .3, '#D8E5F4', true),
    s([[.16, .79], [.3, .75], [.44, .79], [.58, .75], [.72, .79], [.84, .75]], '#45B8E8', 7),
  ];
  if (has(/up altas aventuras|balao|baloes/)) return [
    r(.39, .52, .67, .78, '#D36A50', true), tri(.38, .48, .68, .56, '#8B4F38', true),
    c(.29, .13, .43, .29, '#E85D75', true), c(.44, .08, .58, .25, '#45B8E8', true),
    c(.59, .15, .73, .31, '#FFD65A', true), c(.4, .28, .43, .32, '#FFFFFF', true, 1),
    l(.36, .29, .49, .53, '#8999AA', 2), l(.51, .25, .53, .53, '#8999AA', 2),
    l(.66, .31, .59, .53, '#8999AA', 2),
    c(.38, .59, .45, .66, '#69D8F5', true), c(.52, .61, .59, .68, '#69D8F5', true),
  ];
  if (has(/star wars|darth vader/)) return [
    c(.29, .17, .71, .68, '#20232B', true), tri(.3, .2, .5, .49, '#20232B', true),
    tri(.5, .2, .7, .49, '#20232B', true), r(.36, .39, .64, .5, '#FFFFFF', true),
    r(.4, .55, .6, .61, '#D8E5F4', true), tri(.36, .66, .64, .86, '#20232B', true),
    l(.24, .45, .17, .77, '#E85D75', 7), l(.18, .75, .23, .75, '#E85D75', 4),
  ];
  if (has(/bob esponja|esponja/)) return [
    r(.3, .24, .7, .65, '#FFD65A', true), c(.36, .32, .4, .36, '#E8A72F', true, 1),
    c(.59, .29, .63, .34, '#E8A72F', true, 1), c(.42, .37, .49, .48, '#FFFFFF', true),
    c(.52, .37, .59, .48, '#FFFFFF', true), c(.45, .4, .48, .45, tinta, true, 2),
    c(.53, .4, .56, .45, tinta, true, 2), s([[.42, .53], [.5, .58], [.58, .53]], '#E85D75', 4),
    r(.34, .65, .66, .76, '#8D5BD6', true), l(.39, .76, .36, .84, tinta, 6),
    l(.61, .76, .64, .84, tinta, 6),
  ];
  if (has(/elefante/)) return [
    c(.28, .33, .71, .7, '#8999AA', true), c(.23, .28, .5, .61, '#AAB8C8', true),
    l(.57, .48, .64, .62, '#8999AA', 15), s([[.64, .62], [.68, .69], [.66, .76], [.61, .78]], '#8999AA', 13),
    tri(.56, .53, .65, .66, '#FFFFFF', true), c(.43, .4, .48, .45, tinta, true, 2),
    l(.34, .67, .32, .82, '#8999AA', 11), l(.62, .67, .64, .82, '#8999AA', 11),
    s([[.21, .5], [.15, .55], [.2, .61]], '#8999AA', 5),
  ];
  if (has(/girafa/)) return [
    r(.43, .37, .57, .72, '#F2B84B', true), c(.38, .22, .62, .43, '#F2B84B', true),
    l(.44, .29, .41, .18, '#9A5B38', 4), c(.39, .13, .43, .18, '#9A5B38', true, 2),
    l(.56, .29, .59, .18, '#9A5B38', 4), c(.57, .13, .61, .18, '#9A5B38', true, 2),
    c(.44, .29, .47, .33, tinta, true, 2), c(.54, .29, .57, .33, tinta, true, 2),
    c(.46, .45, .5, .49, '#9A5B38', true), c(.52, .55, .56, .59, '#9A5B38', true),
    c(.42, .65, .46, .69, '#9A5B38', true), l(.44, .7, .42, .84, '#9A5B38', 7),
    l(.56, .7, .58, .84, '#9A5B38', 7),
  ];
  if (has(/borboleta/)) return [
    c(.22, .25, .48, .53, '#8D5BD6', true), c(.52, .25, .78, .53, '#E85D75', true),
    c(.28, .5, .47, .73, '#45B8E8', true), c(.53, .5, .72, .73, '#FFD65A', true),
    r(.47, .35, .53, .67, tinta, true), s([[.49, .36], [.41, .23], [.36, .22]], tinta, 4),
    s([[.51, .36], [.59, .23], [.64, .22]], tinta, 4),
    c(.32, .35, .38, .41, '#FFFFFF', true, 1), c(.62, .35, .68, .41, '#FFFFFF', true, 1),
  ];
  if (has(/tartaruga/)) return [
    c(.27, .33, .73, .68, '#49B675', true), c(.33, .31, .67, .64, '#70AD63', true),
    s([[.35, .43], [.5, .33], [.65, .43], [.62, .57], [.5, .63], [.38, .56], [.35, .43]], '#28664A', 5),
    l(.37, .61, .32, .75, '#49B675', 9), l(.63, .61, .68, .75, '#49B675', 9),
    c(.67, .4, .72, .45, tinta, true, 2), tri(.24, .45, .32, .55, '#49B675', true),
  ];
  if (has(/cobra|serpente/)) return [
    s([[.25, .72], [.39, .72], [.45, .64], [.34, .58], [.32, .48], [.45, .43], [.58, .48], [.58, .34], [.68, .29]], '#49B675', 19),
    c(.62, .23, .75, .36, '#49B675', true), c(.7, .27, .73, .3, tinta, true, 2),
    l(.73, .34, .8, .4, '#E85D75', 4), l(.73, .34, .8, .33, '#E85D75', 3),
  ];
  if (has(/flor/)) return [
    l(.5, .46, .5, .82, '#49B675', 9), c(.37, .23, .49, .39, '#FF8FB1', true),
    c(.51, .23, .63, .39, '#FF8FB1', true), c(.33, .36, .47, .5, '#FF8FB1', true),
    c(.53, .36, .67, .5, '#FF8FB1', true), c(.43, .37, .57, .51, '#FFD65A', true),
    s([[.49, .62], [.39, .55], [.35, .59]], '#49B675', 6),
    s([[.51, .67], [.61, .59], [.65, .62]], '#49B675', 6),
  ];
  if (has(/foguete|astronauta|nave espacial|ovni/)) return [
    s([[.5, .16], [.65, .37], [.62, .66], [.5, .78], [.38, .66], [.35, .37], [.5, .16]], '#D8E5F4', 9),
    tri(.36, .55, .23, .76, '#E85D75', true), tri(.64, .55, .77, .76, '#E85D75', true),
    c(.43, .35, .57, .49, '#45B8E8', true), l(.43, .68, .39, .83, '#FF8B45', 8),
    l(.5, .72, .5, .88, '#FFD65A', 8), l(.57, .68, .61, .83, '#FF8B45', 8),
    c(.18, .2, .23, .25, '#FFD65A', true, 1), c(.78, .27, .83, .32, '#8D5BD6', true, 1),
  ];
  if (has(/aviao|helicoptero/)) return [
    s([[.18, .53], [.42, .48], [.48, .2], [.55, .2], [.59, .47], [.82, .42], [.86, .49], [.6, .57], [.56, .72], [.51, .72], [.44, .59], [.2, .6], [.18, .53]], '#45B8E8', 8),
    l(.31, .51, .5, .53, '#FFFFFF', 3), l(.57, .52, .76, .48, '#FFFFFF', 3),
    c(.28, .24, .34, .3, '#D8E5F4', true, 1), c(.72, .68, .78, .74, '#D8E5F4', true, 1),
  ];
  if (has(/bicicleta/)) return [
    c(.2, .52, .42, .74, '#45B8E8', false, 8), c(.58, .52, .8, .74, '#45B8E8', false, 8),
    l(.31, .63, .48, .4, '#E85D75', 7), l(.48, .4, .68, .63, '#E85D75', 7),
    l(.31, .63, .68, .63, '#E85D75', 7), l(.42, .39, .53, .39, tinta, 5),
    l(.66, .39, .75, .39, tinta, 5), l(.68, .63, .76, .39, '#E85D75', 6),
  ];
  if (has(/trem/)) return [
    r(.29, .27, .71, .68, '#45B8E8', true), r(.36, .34, .49, .48, '#D8F3FF', true),
    r(.53, .34, .66, .48, '#D8F3FF', true), r(.43, .55, .57, .68, '#FFB84D', true),
    c(.34, .63, .43, .72, tinta, true), c(.57, .63, .66, .72, tinta, true),
    l(.24, .76, .76, .76, '#8999AA', 5), l(.35, .2, .35, .27, '#8999AA', 5),
    c(.31, .12, .39, .2, '#8999AA', true),
  ];
  if (has(/navio|barco/)) return [
    s([[.2, .55], [.8, .55], [.68, .75], [.32, .75], [.2, .55]], '#45B8E8', 8),
    r(.42, .36, .58, .55, '#F5D9A8', true), tri(.33, .28, .48, .49, '#FFFFFF', true),
    l(.5, .22, .5, .57, '#8B4F38', 6), s([[.22, .8], [.34, .84], [.46, .8], [.58, .84], [.7, .8], [.82, .84]], '#45B8E8', 6),
    c(.72, .19, .82, .29, '#FFD65A', true),
  ];
  if (has(/tenis de corrida/)) return [
    s([[.18, .57], [.29, .51], [.42, .53], [.51, .44], [.67, .44], [.75, .53], [.84, .56],
      [.81, .66], [.23, .66], [.18, .57]], '#45B8E8', 8),
    l(.24, .67, .81, .67, '#F2B84B', 7), l(.48, .51, .61, .51, '#FFFFFF', 3),
  ];
  if (has(/basquete/)) return [
    c(.3, .23, .7, .67, '#F28C28', true), s([[.31, .45], [.44, .42], [.5, .47], [.56, .42], [.69, .45]], tinta, 5),
    s([[.5, .24], [.45, .36], [.45, .52], [.5, .66]], tinta, 5),
    s([[.31, .51], [.42, .55], [.48, .64]], tinta, 5),
    s([[.69, .51], [.58, .55], [.52, .64]], tinta, 5),
  ];
  if (has(/tenis|volei/)) return [
    c(.24, .26, .62, .64, '#FFD65A', true), l(.36, .59, .66, .75, '#9A5B38', 13),
    l(.3, .35, .57, .55, '#FFFFFF', 3), l(.36, .3, .52, .6, '#FFFFFF', 3),
    l(.24, .46, .59, .46, '#FFFFFF', 3), c(.65, .71, .72, .78, '#E85D75', true, 2),
  ];
  if (has(/estrela do mar/)) return [
    a('star', .22, .18, .78, .78, '#FF8B45', true),
    c(.17, .24, .22, .29, '#69D8F5', true, 1), c(.77, .62, .82, .67, '#69D8F5', true, 1),
    s([[.3, .77], [.43, .81], [.57, .79], [.7, .83]], '#45B8E8', 5),
  ];
  if (has(/praia|oceano|mar|rio|cachoeira/)) return [
    c(.7, .18, .82, .3, '#FFD65A', true),
    s([[.16, .55], [.29, .49], [.42, .55], [.55, .49], [.68, .55], [.82, .49]], '#45B8E8', 10),
    s([[.16, .67], [.29, .61], [.42, .67], [.55, .61], [.68, .67], [.82, .61]], '#2864A8', 9),
    s([[.15, .78], [.28, .72], [.41, .78], [.54, .72], [.67, .78], [.81, .72]], '#F2B84B', 8),
    tri(.21, .29, .36, .48, '#49B675', true), l(.28, .42, .28, .61, '#9A5B38', 7),
  ];
  if (/^she knows(?: no carnaval)?$/.test(n)) return [
    c(.28, .29, .62, .7, '#F1C27D', true), c(.28, .2, .58, .48, '#5B392B', true),
    c(.39, .42, .43, .47, tinta, true, 2), c(.52, .42, .56, .47, tinta, true, 2),
    s([[.42, .58], [.49, .62], [.56, .58]], '#9A453E', 4),
    c(.66, .12, .83, .31, '#FFD65A', true), l(.7, .31, .7, .39, '#F2B84B', 4),
    l(.79, .31, .79, .39, '#F2B84B', 4), l(.69, .4, .8, .4, '#F2B84B', 4),
    s([[.61, .26], [.65, .23], [.67, .26]], '#69D8F5', 3),
    ...(has(/carnaval/) ? [c(.17, .2, .22, .25, '#E85D75', true), c(.79, .55, .84, .6, '#49B675', true)] : []),
  ];
  if (/^sunga branca do joao$/.test(n)) return [
    s([[.3, .2], [.7, .2], [.66, .43], [.61, .78], [.53, .78], [.5, .53],
      [.47, .78], [.39, .78], [.34, .43], [.3, .2]], '#D8E5F4', 8),
    r(.31, .21, .69, .36, '#FFFFFF', true), l(.34, .38, .66, .38, '#8999AA', 3),
    l(.5, .38, .5, .55, '#8999AA', 3), l(.4, .3, .6, .3, '#D8E5F4', 2),
  ];
  if (/^coca (?:da maezinha|na piscina)$/.test(n)) return [
    ...(has(/piscina/) ? [
      r(.16, .52, .84, .81, '#45B8E8', true),
      s([[.18, .64], [.32, .59], [.46, .64], [.6, .59], [.82, .64]], '#D8F3FF', 4),
    ] : []),
    r(.39, .24, .61, .7, '#E85D75', true), r(.41, .18, .59, .25, '#8999AA', true),
    r(.41, .69, .59, .75, '#8999AA', true), l(.4, .37, .6, .37, '#FFFFFF', 3),
    c(.46, .43, .54, .51, '#FFFFFF', false, 3),
    ...(has(/maezinha/) ? [c(.47, .44, .53, .5, '#E85D75', true, 2)] : []),
  ];
  if (/^flaminga(?: de peruca)?$/.test(n)) return [
    c(.28, .48, .63, .76, '#FF8FB1', true),
    s([[.54, .58], [.55, .42], [.6, .32], [.68, .29], [.72, .34]], '#E85D75', 10),
    c(.61, .2, .72, .33, '#FF8FB1', true), tri(.69, .27, .83, .34, '#FFD65A', true),
    l(.41, .72, .39, .9, '#E85D75', 4), l(.55, .72, .58, .9, '#E85D75', 4),
    l(.34, .9, .44, .9, '#8999AA', 3), l(.54, .9, .63, .9, '#8999AA', 3),
    ...(has(/peruca/) ? [s([[.56, .23], [.59, .14], [.64, .19], [.68, .12], [.73, .2]], '#5B392B', 5)] : []),
  ];
  if (/^piscina(?: do presidio)?$/.test(n)) return [
    r(.16, .3, .84, .78, '#45B8E8', false), r(.2, .36, .8, .74, '#69D8F5', true),
    s([[.22, .48], [.35, .43], [.48, .48], [.61, .43], [.78, .48]], '#FFFFFF', 4),
    s([[.22, .62], [.35, .57], [.48, .62], [.61, .57], [.78, .62]], '#45B8E8', 4),
    l(.74, .28, .74, .62, '#8999AA', 4), l(.82, .28, .82, .62, '#8999AA', 4),
    ...(has(/presidio/) ? [l(.28, .36, .28, .74, '#26384D', 4), l(.36, .36, .36, .74, '#26384D', 4)] : []),
  ];
  if (/^(?:festa dos signos(?: no presidio)?|festa maluca|carnaval|carnaval das cagonas|festa na praia do presidio)$/.test(n)) return [
    a('star', .2, .18, .38, .36, '#FFD65A', true), a('star', .62, .15, .81, .34, '#69D8F5', true),
    c(.35, .32, .65, .63, '#8D5BD6', true), c(.42, .39, .58, .55, '#FFD65A', true),
    l(.27, .71, .35, .62, '#E85D75', 5), l(.74, .7, .67, .61, '#49B675', 5),
    c(.16, .44, .2, .48, '#E85D75', true), c(.8, .46, .84, .5, '#49B675', true),
    ...(has(/signos/) ? [a('star', .42, .4, .49, .47, '#8D5BD6', true), a('star', .52, .51, .59, .58, '#8D5BD6', true)] : []),
    ...(has(/praia/) ? [s([[.18, .82], [.35, .77], [.52, .82], [.69, .77], [.82, .82]], '#45B8E8', 5)] : []),
    ...(has(/presidio/) ? [l(.26, .2, .26, .4, '#26384D', 3), l(.34, .2, .34, .4, '#26384D', 3)] : []),
  ];
  if (/^cagonas do presidio$/.test(n)) return [
    r(.2, .18, .8, .82, '#26384D', false), l(.32, .2, .32, .8, '#8999AA', 6),
    l(.45, .2, .45, .8, '#8999AA', 6), l(.58, .2, .58, .8, '#8999AA', 6),
    l(.71, .2, .71, .8, '#8999AA', 6), c(.36, .32, .55, .52, '#FF8FB1', true),
    s([[.51, .42], [.61, .37], [.67, .4]], '#FFD65A', 5),
  ];
  if (/^trisal(?: no quarto monange)?$/.test(n)) return [
    c(.23, .25, .42, .45, '#45B8E8', true), c(.4, .18, .6, .4, '#E85D75', true),
    c(.58, .25, .77, .45, '#8D5BD6', true),
    s([[.18, .74], [.2, .58], [.3, .5], [.4, .58], [.42, .74]], '#45B8E8', 8),
    s([[.39, .72], [.41, .53], [.5, .45], [.59, .53], [.61, .72]], '#E85D75', 8),
    s([[.58, .74], [.6, .58], [.7, .5], [.8, .58], [.82, .74]], '#8D5BD6', 8),
    ...(has(/quarto/) ? [r(.16, .76, .84, .84, '#8999AA', true), l(.2, .84, .2, .9, '#8999AA', 3), l(.8, .84, .8, .9, '#8999AA', 3)] : []),
  ];
  if (/^maezinha$/.test(n)) return [
    c(.38, .2, .62, .46, '#F1C27D', true), c(.32, .41, .68, .76, '#E85D75', true),
    c(.44, .29, .47, .33, tinta, true, 2), c(.53, .29, .56, .33, tinta, true, 2),
    s([[.44, .37], [.5, .4], [.56, .37]], '#9A453E', 3),
    c(.18, .22, .25, .29, '#FF8FB1', true), c(.75, .22, .82, .29, '#FFD65A', true),
  ];
  if (/^cagona de peruca$/.test(n)) return [
    c(.25, .16, .75, .72, '#5B392B', true), c(.35, .37, .65, .76, '#F1C27D', true),
    s([[.25, .49], [.23, .36], [.3, .25], [.39, .28], [.44, .17], [.5, .25],
      [.56, .17], [.61, .28], [.7, .25], [.77, .36], [.75, .49]], '#8B4F38', 9),
    s([[.31, .45], [.35, .37], [.4, .4], [.45, .34], [.5, .4], [.55, .34],
      [.6, .4], [.65, .37], [.69, .45]], '#D9A441', 5),
    r(.42, .75, .58, .84, '#8999AA', true), l(.34, .84, .66, .84, '#8999AA', 5),
  ];
  if (/^bananinha da kill$/.test(n)) return [
    s([[.28, .3], [.36, .24], [.47, .28], [.58, .37], [.69, .5], [.72, .63],
      [.65, .72], [.54, .7], [.43, .62], [.34, .49], [.28, .3]], '#FFD65A', 12),
    l(.28, .3, .25, .24, '#8B4F38', 4), l(.68, .65, .74, .7, '#8B4F38', 4),
    s([[.37, .37], [.45, .43], [.53, .52], [.61, .61]], '#F2B84B', 3),
  ];
  if (/^beats$/.test(n)) return [
    s([[.23, .55], [.23, .36], [.31, .22], [.5, .16], [.69, .22], [.77, .36], [.77, .55]], '#E85D75', 11),
    r(.18, .48, .32, .7, '#20232B', true), r(.68, .48, .82, .7, '#20232B', true),
    c(.2, .5, .3, .66, '#E85D75', true), c(.7, .5, .8, .66, '#E85D75', true),
    l(.34, .78, .66, .78, '#8999AA', 4),
  ];
  if (/^coco na geladeira$/.test(n)) return [
    r(.29, .16, .71, .84, '#D8E5F4', true), r(.32, .2, .68, .47, '#FFFFFF', true),
    r(.32, .5, .68, .8, '#FFFFFF', true), l(.32, .48, .68, .48, '#8999AA', 3),
    l(.62, .3, .62, .4, '#8999AA', 3), l(.62, .59, .62, .71, '#8999AA', 3),
    s([[.25, .3], [.18, .25], [.14, .3], [.18, .35]], '#49B675', 4),
    s([[.76, .59], [.83, .54], [.87, .59], [.83, .64]], '#49B675', 4),
  ];
  if (/^bunda da abner$/.test(n)) return [
    s([[.3, .24], [.7, .24], [.66, .44], [.61, .78], [.53, .78], [.5, .55],
      [.47, .78], [.39, .78], [.34, .44], [.3, .24]], '#45B8E8', 8),
    r(.31, .24, .69, .38, '#D8E5F4', true), l(.34, .4, .66, .4, '#8999AA', 3),
    l(.5, .4, .5, .55, '#8999AA', 3), c(.47, .44, .53, .5, '#FFD65A', true, 2),
  ];
  if (/^lucas guedes$/.test(n)) return [
    c(.37, .16, .63, .43, '#F1C27D', true), c(.31, .38, .69, .79, '#45B8E8', true),
    c(.42, .27, .45, .31, tinta, true, 2), c(.55, .27, .58, .31, tinta, true, 2),
    s([[.44, .35], [.5, .38], [.56, .35]], '#9A453E', 3),
    r(.44, .49, .56, .62, '#FFD65A', true), l(.5, .51, .5, .6, tinta, 2),
  ];
  if (/^lingua azul$/.test(n)) return [
    c(.24, .31, .76, .68, '#8E2545', true), s([[.35, .52], [.38, .64], [.46, .71], [.5, .72], [.54, .71], [.62, .64], [.65, .52]], '#45B8E8', 12),
    l(.5, .65, .5, .72, '#2864A8', 3),
  ];
  if (/^perucas?$/.test(n)) return [
    c(.25, .16, .75, .72, '#5B392B', true), c(.35, .37, .65, .76, '#F1C27D', true),
    s([[.25, .49], [.23, .36], [.3, .25], [.39, .28], [.44, .17], [.5, .25],
      [.56, .17], [.61, .28], [.7, .25], [.77, .36], [.75, .49]], '#8B4F38', 9),
    s([[.31, .45], [.35, .37], [.4, .4], [.45, .34], [.5, .4], [.55, .34],
      [.6, .4], [.65, .37], [.69, .45]], '#D9A441', 5),
    l(.37, .54, .63, .54, '#8B4F38', 4), r(.42, .75, .58, .84, '#8999AA', true),
    l(.34, .84, .66, .84, '#8999AA', 5),
  ];
  if (has(/camisa|camiseta|vestido|calca|saia|sapato|tenis|chapeu|bone|oculos|meia|gravata|jaqueta|casaco|short|uniforme/)) return [
    s([[.4, .25], [.32, .29], [.21, .37], [.29, .49], [.36, .43], [.36, .76],
      [.64, .76], [.64, .43], [.71, .49], [.79, .37], [.68, .29], [.6, .25],
      [.56, .31], [.5, .34], [.44, .31], [.4, .25]], '#45B8E8', 9),
    l(.38, .56, .62, .56, '#FFFFFF', 4), c(.48, .39, .52, .43, '#FFD65A', true, 2),
  ];
  if (has(/labio|labios/)) return [
    s([[.2, .5], [.3, .42], [.4, .43], [.5, .49], [.6, .43], [.7, .42], [.8, .5],
      [.7, .59], [.6, .6], [.5, .56], [.4, .6], [.3, .59], [.2, .5]], '#B83258', 8),
    s([[.2, .5], [.3, .42], [.4, .43], [.5, .49], [.6, .43], [.7, .42], [.8, .5]], '#F06281', 6),
    s([[.2, .5], [.3, .59], [.4, .6], [.5, .56], [.6, .6], [.7, .59], [.8, .5]], '#E85D75', 7),
    l(.3, .5, .7, .5, '#8E2545', 4), l(.4, .55, .49, .56, '#FFFFFF', 2),
  ];
  if (has(/olho|cilios|sobrancelha/)) return [
    s([[.18, .5], [.3, .36], [.5, .29], [.7, .36], [.82, .5], [.7, .64], [.5, .71], [.3, .64], [.18, .5]], '#D8E5F4', 6),
    c(.38, .36, .62, .64, '#45B8E8', true), c(.44, .41, .56, .59, tinta, true),
    ...(has(/sobrancelha/) ? [s([[.28, .29], [.4, .24], [.5, .26], [.6, .24], [.72, .29]], '#8B4F38', 6)] : []),
    ...(has(/cilios/) ? [l(.3, .4, .25, .34, tinta, 3), l(.4, .33, .38, .26, tinta, 3), l(.6, .33, .62, .26, tinta, 3), l(.7, .4, .75, .34, tinta, 3)] : []),
  ];
  if (has(/nariz/)) return [
    s([[.5, .2], [.48, .42], [.38, .6], [.42, .67], [.5, .69], [.58, .67], [.62, .6]], '#F1C27D', 10),
    l(.41, .64, .47, .66, '#9A453E', 3), l(.53, .66, .59, .64, '#9A453E', 3),
  ];
  if (has(/orelha/)) return [
    c(.29, .18, .71, .82, '#F1C27D', true), c(.4, .31, .61, .69, '#E88D78', false, 6),
    s([[.51, .38], [.46, .47], [.54, .53], [.47, .61]], '#9A453E', 4),
  ];
  if (has(/dente/)) return [
    r(.31, .2, .69, .57, '#FFFFFF', true), c(.33, .47, .48, .78, '#FFFFFF', true),
    c(.52, .47, .67, .78, '#FFFFFF', true), l(.5, .22, .5, .58, '#D8E5F4', 3),
    l(.36, .55, .64, .55, '#D8E5F4', 3),
  ];
  if (has(/lingua/)) return [
    c(.24, .31, .76, .68, '#8E2545', true), s([[.35, .52], [.38, .64], [.46, .71], [.5, .72], [.54, .71], [.62, .64], [.65, .52]], '#F06281', 12),
    l(.5, .65, .5, .72, '#B83258', 3),
  ];
  if (has(/boca|sorriso/)) return [
    c(.24, .34, .76, .68, '#8E2545', true),
    s([[.3, .48], [.4, .43], [.5, .46], [.6, .43], [.7, .48], [.66, .58], [.57, .62], [.5, .63], [.43, .62], [.34, .58], [.3, .48]], '#E85D75', 6),
    r(.37, .46, .63, .53, '#FFFFFF', true), l(.5, .46, .5, .53, '#D8E5F4', 2),
  ];
  if (has(/lagrima/)) return [
    c(.27, .22, .73, .78, '#F1C27D', true),
    c(.38, .42, .43, .48, tinta, true, 2), c(.57, .42, .62, .48, tinta, true, 2),
    s([[.42, .63], [.5, .59], [.58, .63]], '#9A453E', 4),
    s([[.63, .48], [.67, .55], [.65, .62], [.61, .55], [.63, .48]], '#45B8E8', 4),
  ];
  if (has(/cabeca|rosto|pele|cabelo|bigode|barba|sardas|covinha|queixo|bochecha/)) return [
    c(.29, .17, .71, .8, '#F1C27D', true),
    ...(has(/cabelo|cabeca/) ? [s([[.3, .43], [.29, .28], [.38, .18], [.5, .14], [.62, .18], [.71, .28], [.7, .43]], '#5B392B', 10)] : []),
    c(.39, .4, .44, .46, tinta, true, 2), c(.56, .4, .61, .46, tinta, true, 2),
    s([[.5, .44], [.48, .53], [.52, .55]], '#9A453E', 3),
    ...(has(/bigode/) ? [s([[.38, .55], [.43, .52], [.49, .57], [.51, .57], [.57, .52], [.62, .55]], '#5B392B', 7)] : []),
    ...(has(/barba/) ? [s([[.35, .56], [.37, .69], [.43, .76], [.5, .79], [.57, .76], [.63, .69], [.65, .56]], '#5B392B', 8)] : []),
    ...(has(/bochecha/) ? [c(.32, .51, .42, .59, '#FF8FB1', true, 2), c(.58, .51, .68, .59, '#FF8FB1', true, 2)] : []),
    ...(has(/sardas/) ? [c(.35, .51, .38, .54, '#8B4F38', true, 1), c(.41, .55, .44, .58, '#8B4F38', true, 1), c(.59, .55, .62, .58, '#8B4F38', true, 1), c(.65, .51, .68, .54, '#8B4F38', true, 1)] : []),
    ...(has(/covinha/) ? [c(.34, .56, .38, .6, '#9A453E', true, 1), c(.62, .56, .66, .6, '#9A453E', true, 1)] : []),
    ...(has(/queixo/) ? [l(.45, .7, .55, .7, '#9A453E', 3)] : []),
    ...(has(/cabelo/) ? [s([[.4, .29], [.43, .23], [.47, .28], [.52, .22], [.57, .28], [.61, .24]], '#8B4F38', 4)] : []),
    s([[.42, .62], [.5, .66], [.58, .62]], '#9A453E', 4),
  ];
  if (has(/pescoco/)) return [
    r(.39, .22, .61, .58, '#F1C27D', true), s([[.27, .45], [.35, .38], [.42, .41], [.5, .5], [.58, .41], [.65, .38], [.73, .45], [.68, .8], [.32, .8], [.27, .45]], '#45B8E8', 9),
    l(.45, .34, .45, .53, '#D99245', 3), l(.55, .34, .55, .53, '#D99245', 3),
  ];
  if (has(/ombro|braco|cotovelo|punho|musculo/)) return [
    s([[.31, .2], [.5, .2], [.55, .4], [.45, .52], [.68, .68], [.65, .82]], '#F1C27D', 18),
    ...(has(/ombro/) ? [c(.24, .18, .47, .43, '#F1C27D', true)] : []),
    ...(has(/cotovelo/) ? [c(.42, .43, .55, .56, '#D99245', true), c(.46, .46, .52, .52, '#F1C27D', true)] : []),
    ...(has(/punho/) ? [l(.58, .67, .74, .67, '#45B8E8', 7)] : []),
    ...(has(/musculo/) ? [c(.37, .34, .53, .5, '#E88D78', true), s([[.37, .38], [.42, .31], [.49, .34], [.53, .42]], '#B95C4B', 4)] : []),
    l(.63, .8, .68, .85, '#9A453E', 4),
  ];
  if (has(/mao|dedo|unha/)) return [
    c(.33, .43, .67, .82, '#F1C27D', true),
    l(.37, .49, .34, .2, '#F1C27D', 12), l(.45, .44, .44, .15, '#F1C27D', 12),
    l(.55, .44, .56, .15, '#F1C27D', 12), l(.63, .49, .66, .23, '#F1C27D', 12),
    ...(has(/dedo|unha/) ? [c(.42, .12, .46, .18, '#FF8FB1', true, 1)] : []),
    ...(has(/unha/) ? [c(.54, .12, .58, .18, '#FF8FB1', true, 1)] : []),
    l(.33, .55, .24, .44, '#F1C27D', 11), c(.47, .55, .53, .61, '#D99245', true, 2),
  ];
  if (has(/peito|barriga|umbigo|costas|corpo/)) return [
    s([[.38, .16], [.62, .16], [.73, .32], [.68, .45], [.64, .84], [.36, .84], [.32, .45], [.27, .32], [.38, .16]], '#F1C27D', 10),
    ...(has(/peito/) ? [c(.39, .34, .45, .4, '#E88D78', true), c(.55, .34, .61, .4, '#E88D78', true)] : []),
    ...(has(/barriga|umbigo/) ? [c(.47, .51, .53, .57, '#9A453E', true, 2)] : []),
    ...(has(/costas/) ? [l(.5, .25, .5, .73, '#9A453E', 4), c(.45, .39, .49, .43, '#D99245', true, 1), c(.51, .56, .55, .6, '#D99245', true, 1)] : []),
    ...(has(/corpo/) ? [l(.38, .83, .34, .94, '#2864A8', 8), l(.62, .83, .66, .94, '#2864A8', 8)] : []),
  ];
  if (has(/perna|joelho|pe|calcanhar|tornozelo/)) return [
    s([[.4, .14], [.6, .14], [.59, .47], [.54, .61], [.75, .75], [.72, .84], [.43, .83], [.38, .65], [.45, .48], [.4, .14]], '#F1C27D', 12),
    ...(has(/joelho/) ? [c(.43, .43, .58, .58, '#D99245', true), c(.47, .46, .54, .54, '#F1C27D', true)] : []),
    ...(has(/tornozelo|calcanhar/) ? [c(.43, .67, .53, .76, '#D99245', true)] : []),
    ...(has(/pe|calcanhar/) ? [s([[.51, .73], [.69, .74], [.78, .81], [.75, .87], [.48, .86]], '#F1C27D', 9)] : []),
  ];
  if (has(/coracao/)) return [
    s([[.5, .78], [.25, .54], [.22, .4], [.29, .29], [.4, .29], [.5, .4],
      [.6, .29], [.71, .29], [.78, .4], [.75, .54], [.5, .78]], '#E63946', 10),
    l(.5, .4, .5, .63, '#8E1B2B', 4), l(.35, .48, .45, .54, '#8E1B2B', 4),
  ];
  if (has(/cerebro/)) return [
    c(.25, .31, .52, .65, '#F5A7B8', true), c(.45, .25, .75, .58, '#F5A7B8', true),
    c(.32, .23, .51, .46, '#F5A7B8', true), c(.49, .48, .68, .73, '#F5A7B8', true),
    s([[.5, .27], [.48, .41], [.52, .51], [.48, .62]], '#B95C72', 4),
  ];
  if (has(/pulmao/)) return [
    r(.46, .18, .54, .45, '#8999AA', true), c(.25, .34, .48, .75, '#E85D75', true),
    c(.52, .34, .75, .75, '#E85D75', true), l(.5, .38, .38, .52, '#B83258', 5),
    l(.5, .38, .62, .52, '#B83258', 5), l(.38, .52, .38, .65, '#B83258', 4),
    l(.62, .52, .62, .65, '#B83258', 4),
  ];
  if (has(/estomago/)) return [
    s([[.43, .18], [.48, .33], [.59, .35], [.69, .45], [.68, .57], [.59, .64],
      [.58, .76], [.45, .81], [.34, .74], [.34, .6], [.4, .52], [.37, .42], [.43, .18]], '#E88D78', 11),
    l(.45, .31, .45, .43, '#B95C4B', 4), c(.49, .53, .55, .59, '#F1C27D', true, 2),
  ];
  if (has(/veia/)) return [
    l(.5, .82, .5, .18, '#45B8E8', 9), l(.5, .58, .31, .4, '#45B8E8', 7),
    l(.5, .45, .68, .28, '#45B8E8', 7), l(.31, .4, .26, .26, '#45B8E8', 5),
    l(.68, .28, .75, .16, '#45B8E8', 5), c(.45, .12, .55, .22, '#E63946', true, 2),
  ];
  if (has(/sangue/)) return [
    s([[.5, .12], [.38, .33], [.29, .49], [.3, .62], [.38, .74], [.5, .79],
      [.62, .74], [.7, .62], [.71, .49], [.62, .33], [.5, .12]], '#E63946', 10),
    c(.39, .46, .46, .53, '#FF8B8B', true, 2),
  ];
  if (has(/osso|esqueleto|coluna|costela|cranio/)) {
    if (has(/cranio/)) return [
      c(.28, .18, .72, .68, '#F5D9A8', true), c(.37, .38, .45, .47, tinta, true),
      c(.55, .38, .63, .47, tinta, true), tri(.45, .48, .55, .58, '#8999AA', true),
      r(.39, .62, .61, .72, '#F5D9A8', true), l(.45, .63, .45, .71, '#8999AA', 2),
      l(.55, .63, .55, .71, '#8999AA', 2),
    ];
    if (has(/coluna/)) return [
      l(.5, .14, .5, .84, '#8999AA', 5),
      ...[.2, .31, .42, .53, .64, .75].map(y => c(.41, y, .59, y + .09, '#F5D9A8', true)),
    ];
    if (has(/costela/)) return [
      l(.5, .18, .5, .82, '#8999AA', 6),
      ...[.28, .39, .5, .61, .72].flatMap(y => [
        s([[.5, y], [.4, y - .06], [.31, y], [.35, y + .07]], '#F5D9A8', 5),
        s([[.5, y], [.6, y - .06], [.69, y], [.65, y + .07]], '#F5D9A8', 5),
      ]),
    ];
    if (has(/esqueleto/)) return [
      c(.42, .12, .58, .29, '#F5D9A8', true), c(.45, .17, .47, .19, tinta, true, 1),
      c(.53, .17, .55, .19, tinta, true, 1), l(.5, .29, .5, .66, '#F5D9A8', 7),
      s([[.5, .36], [.34, .43], [.27, .55]], '#F5D9A8', 6), s([[.5, .36], [.66, .43], [.73, .55]], '#F5D9A8', 6),
      s([[.5, .66], [.39, .79], [.35, .9]], '#F5D9A8', 7), s([[.5, .66], [.61, .79], [.65, .9]], '#F5D9A8', 7),
      l(.42, .42, .58, .42, '#8999AA', 3), l(.42, .49, .58, .49, '#8999AA', 3),
      l(.42, .56, .58, .56, '#8999AA', 3),
    ];
    return [
      l(.34, .35, .66, .65, '#F5D9A8', 11), c(.22, .22, .4, .4, '#F5D9A8', true),
      c(.6, .6, .78, .78, '#F5D9A8', true), c(.28, .28, .33, .33, '#8999AA', true, 2),
      c(.67, .67, .72, .72, '#8999AA', true, 2),
    ];
  }
  if (has(/triste|tristeza|chorando|feliz|alegria|raiva|bravo|medo|surpres[oa]|amor|saudade|ansioso|calma|emocao/)) return [
    c(.28, .22, .72, .68, '#FFD65A', true),
    s([[.37, .42], [.42, .38], [.47, .42]], tinta, 5),
    s([[.53, .42], [.58, .38], [.63, .42]], tinta, 5),
    has(/triste|chorando|medo/)
      ? s([[.39, .61], [.45, .56], [.5, .55], [.55, .56], [.61, .61]], '#E85D75', 5)
      : s([[.39, .54], [.45, .61], [.5, .63], [.55, .61], [.61, .54]], '#E85D75', 5),
    has(/chorando/) && c(.38, .48, .42, .55, '#45B8E8', true, 2),
  ].filter(Boolean);
  if (has(/controle|videogame|gamepad|console|minecraft|mario|sonic|fortnite|game/)) return [
    c(.24, .36, .76, .68, '#20232B', true), c(.29, .4, .44, .55, '#8999AA', true, 2),
    l(.33, .47, .4, .47, '#172235', 5), l(.365, .435, .365, .505, '#172235', 5),
    c(.57, .44, .61, .48, '#E85D75', true), c(.66, .51, .7, .55, '#45B8E8', true),
    l(.3, .65, .25, .78, '#20232B', 8), l(.7, .65, .75, .78, '#20232B', 8),
  ];
  if (has(/cachorro quente|hot dog/)) return [
    c(.24, .35, .76, .65, '#E8B96A', true), c(.28, .42, .72, .58, '#A83E32', true),
    s([[.31, .46], [.42, .43], [.53, .47], [.66, .44]], '#FFD65A', 5),
  ];
  if (has(/coelho|lebre/)) return [
    c(.32, .36, .68, .72, '#F5D9A8', true), c(.35, .12, .47, .43, '#F5D9A8', true),
    c(.53, .12, .65, .43, '#F5D9A8', true), c(.39, .21, .44, .37, rosa, true, 2),
    c(.56, .21, .61, .37, rosa, true, 2), c(.4, .47, .45, .52, tinta, true, 2),
    c(.55, .47, .6, .52, tinta, true, 2), c(.46, .55, .54, .62, rosa, true, 2),
    l(.5, .62, .5, .66, tinta, 3), c(.36, .67, .42, .73, '#FFFFFF', true, 2),
    c(.58, .67, .64, .73, '#FFFFFF', true, 2),
  ];
  if (has(/vaca|boi|touro/)) return [
    c(.28, .27, .72, .73, '#FFFFFF', true), c(.35, .34, .44, .45, '#172235', true),
    c(.58, .52, .66, .62, '#172235', true), tri(.33, .25, .42, .38, '#F1C27D', true),
    tri(.58, .25, .67, .38, '#F1C27D', true), c(.39, .47, .61, .64, '#FF8FB1', true),
    c(.45, .53, .49, .58, tinta, true, 2), c(.53, .53, .57, .58, tinta, true, 2),
    l(.36, .7, .33, .82, '#FFFFFF', 8), l(.64, .7, .67, .82, '#FFFFFF', 8),
  ];
  if (has(/porco|leitao/)) return [
    c(.27, .27, .73, .72, '#FF8FB1', true), tri(.32, .24, .45, .42, '#E85D75', true),
    tri(.55, .24, .68, .42, '#E85D75', true), c(.4, .43, .6, .59, '#F1A2B0', true),
    c(.44, .48, .48, .54, '#A83D54', true, 2), c(.52, .48, .56, .54, '#A83D54', true, 2),
    c(.38, .38, .42, .43, tinta, true, 2), c(.58, .38, .62, .43, tinta, true, 2),
    s([[.67, .64], [.76, .59], [.78, .65], [.73, .69]], '#E85D75', 5),
  ];
  if (has(/cachorro|lobo|raposa/)) return [
    c(.28, .3, .7, .7, n.includes('raposa') ? '#E97835' : '#C69A6B', true),
    tri(.28, .29, .39, .53, '#8B5E34', true), tri(.61, .29, .72, .53, '#8B5E34', true),
    c(.37, .4, .42, .46, tinta, true, 2), c(.58, .4, .63, .46, tinta, true, 2),
    c(.4, .49, .6, .64, '#F5D9A8', true), c(.46, .5, .54, .57, tinta, true, 2),
    s([[.5, .57], [.47, .62], [.43, .62]], tinta, 3), s([[.5, .57], [.53, .62], [.57, .62]], tinta, 3),
    l(.39, .7, .36, .82, '#8B5E34', 8), l(.61, .7, .64, .82, '#8B5E34', 8),
  ];
  if (has(/cavalo|zebra|burro/)) return [
    c(.28, .34, .68, .68, n.includes('zebra') ? '#FFFFFF' : '#9A5B38', true),
    c(.55, .22, .76, .48, n.includes('zebra') ? '#FFFFFF' : '#9A5B38', true),
    s([[.59, .25], [.56, .12], [.62, .2], [.68, .11], [.69, .23]], tinta, 5),
    c(.69, .31, .73, .36, tinta, true, 2), l(.38, .65, .34, .82, '#5C3A2D', 8),
    l(.57, .65, .61, .82, '#5C3A2D', 8), s([[.31, .42], [.2, .37], [.18, .45]], '#5C3A2D', 6),
    ...(n.includes('zebra') ? [l(.34, .38, .43, .56, tinta, 5), l(.47, .36, .56, .57, tinta, 5)] : []),
  ];
  if (has(/macaco/)) return [
    c(.3, .26, .7, .68, '#9A5B38', true), c(.37, .39, .63, .63, '#F1C27D', true),
    c(.4, .44, .45, .49, tinta, true, 2), c(.55, .44, .6, .49, tinta, true, 2),
    c(.46, .52, .54, .58, '#8B4F38', true, 2), l(.34, .66, .3, .82, '#9A5B38', 8),
    l(.66, .66, .7, .82, '#9A5B38', 8), s([[.67, .7], [.79, .7], [.82, .61], [.75, .57]], '#9A5B38', 7),
    l(.38, .3, .35, .18, '#9A5B38', 6), l(.62, .3, .65, .18, '#9A5B38', 6),
  ];
  if (has(/gato|tigre|panda|urso|hamster/)) return [
    c(.3, .29, .7, .68, n.includes('panda') ? '#FFFFFF' : '#FFB84D', true),
    tri(.3, .27, .42, .46, '#FF8B45', true), tri(.58, .27, .7, .46, '#FF8B45', true),
    c(.39, .4, .44, .46, tinta, true, 2), c(.56, .4, .61, .46, tinta, true, 2),
    c(.45, .49, .55, .57, rosa, true, 2), l(.5, .57, .5, .61, tinta, 3),
    s([[.45, .57], [.39, .6], [.35, .58]], tinta, 2), s([[.55, .57], [.61, .6], [.65, .58]], tinta, 2),
    l(.4, .68, .37, .8, '#FF8B45', 8), l(.6, .68, .63, .8, '#FF8B45', 8),
  ];
  if (has(/pizza/)) return [
    tri(.27, .25, .75, .78, '#F2B84B', true), s([[.31, .34], [.43, .39], [.56, .35], [.69, .4]], '#D94E45', 12),
    c(.4, .43, .48, .51, '#49B675', true, 2), c(.56, .47, .64, .55, '#E85D75', true, 2),
    c(.45, .61, .54, .7, '#E85D75', true, 2), s([[.27, .25], [.42, .31], [.58, .29], [.75, .25]], '#DDA347', 8),
  ];
  if (has(/sorvete|casquinha/)) return [
    tri(.37, .48, .63, .82, '#C98945', true), c(.33, .24, .67, .56, '#FF8FB1', true),
    c(.4, .18, .6, .43, '#FFD65A', true), c(.45, .27, .49, .31, '#E85D75', true, 2),
    c(.54, .34, .58, .38, '#8D5BD6', true, 2), l(.5, .18, .5, .11, '#8D5BD6', 3),
  ];
  if (has(/bolo|torta/)) return [
    r(.28, .46, .72, .76, '#F2B84B', true), s([[.28, .47], [.37, .53], [.45, .47], [.54, .53], [.63, .47], [.72, .52]], '#FF8FB1', 9),
    r(.28, .46, .72, .55, '#FF8FB1', true), l(.39, .4, .39, .26, '#E85D75', 5),
    l(.5, .4, .5, .22, '#45B8E8', 5), l(.61, .4, .61, .26, '#49B675', 5),
    s([[.37, .76], [.37, .83], [.63, .83], [.63, .76]], '#DDA347', 6),
  ];
  if (has(/hamburguer|sanduiche/)) return [
    c(.28, .28, .72, .55, '#F2B84B', true), r(.27, .45, .73, .53, '#49B675', true),
    r(.27, .52, .73, .62, '#8B4F38', true), r(.29, .61, .71, .67, '#F5D46A', true),
    c(.29, .62, .71, .79, '#D99245', true), c(.37, .34, .42, .38, '#FFF3D1', true, 2),
    c(.5, .31, .55, .35, '#FFF3D1', true, 2), c(.59, .35, .64, .39, '#FFF3D1', true, 2),
  ];
  if (has(/gato|cachorro|cavalo|coelho|urso|leao|tigre|raposa|vaca|porco|ovelha|macaco|elefante|girafa|panda|lobo|rato|hamster|abelha|arara|avestruz|baleia|barata|beija flor|borboleta|cabra|camaleao|camelo|capivara|caranguejo|cervo|coruja|crocodilo|esquilo|foca|formiga|galinha|hipopotamo|jacare|morcego|onca|pato|peixe|pinguim|sapo|tartaruga|tubarao|zebra|animal/)) {
    const peixe = has(/peixe|baleia|golfinho|tubarao|nemo/);
    if (peixe) return [
      c(.29, .34, .69, .65, '#45B8E8', true), tri(.17, .37, .36, .62, '#FF8B45', true),
      tri(.41, .26, .55, .39, '#45B8E8', true), c(.57, .41, .62, .46, tinta, true, 2),
      s([[.43, .46], [.49, .42], [.54, .46], [.49, .51], [.43, .46]], '#FFFFFF', 4),
      c(.75, .22, .8, .27, '#69D8F5', true, 1), c(.82, .33, .87, .38, '#69D8F5', true, 1),
      s([[.37, .66], [.42, .73], [.48, .67]], '#2864A8', 4),
    ];
    const passaro = has(/passaro|pato|galinha|aguia|pinguim|arara|papagaio/);
    if (passaro) return [
      c(.3, .32, .68, .68, '#FFD65A', true), c(.37, .4, .61, .66, '#FFB84D', true),
      tri(.65, .43, .83, .53, '#FF8B45', true), c(.53, .4, .58, .45, tinta, true, 2),
      s([[.37, .49], [.45, .42], [.54, .5], [.45, .59], [.37, .49]], '#E85D75', 7),
      l(.45, .67, .42, .77, '#9A5B38', 4), l(.55, .67, .58, .77, '#9A5B38', 4),
    ];
    return [
      c(.28, .45, .7, .75, '#45B8E8', true), c(.22, .24, .52, .55, '#FFB84D', true),
      tri(.22, .27, .35, .45, '#FF8B45', true), tri(.4, .25, .53, .43, '#FF8B45', true),
      c(.31, .35, .36, .41, tinta, true, 2), c(.42, .35, .47, .41, tinta, true, 2),
      c(.34, .42, .45, .51, rosa, true, 2), l(.39, .5, .39, .54, tinta, 4),
      s([[.31, .48], [.23, .46]], tinta, 3), s([[.44, .48], [.52, .46]], tinta, 3),
      l(.35, .72, .31, .83), l(.59, .72, .63, .83), s([[.65, .61], [.75, .57], [.78, .5]], '#FF8B45', 7),
    ];
  }
  if (has(/casa|predio|escola|castelo|hospital|igreja|apartamento|quarto|cozinha|banheiro|edificio|construcao/)) return [
    r(.29, .43, .71, .79, '#F5D9A8', true), tri(.22, .42, .78, .5, '#D94E45', true),
    l(.22, .42, .5, .2, '#9B453E', 11), l(.5, .2, .78, .42, '#9B453E', 11),
    r(.44, .59, .56, .79, '#9A5B38', true), c(.52, .67, .54, .69, '#FFD65A', true, 1),
    r(.33, .5, .42, .59, '#69D8F5', true), r(.58, .5, .67, .59, '#69D8F5', true),
    l(.375, .5, .375, .59, '#FFFFFF', 3), l(.33, .545, .42, .545, '#FFFFFF', 3),
    l(.625, .5, .625, .59, '#FFFFFF', 3), l(.58, .545, .67, .545, '#FFFFFF', 3),
    r(.62, .25, .69, .42, '#7F8C9C', true), c(.76, .15, .87, .26, '#FFD65A', true),
  ];
  if (has(/arvore|flor|planta|natureza|floresta|bosque|montanha|vulcao|rio|oceano|mar|fazenda|campo|folha/)) return [
    r(.46, .53, .54, .79, '#9A5B38', true), c(.31, .31, .69, .63, '#49B675', true),
    c(.22, .4, .47, .66, '#63CF87', true), c(.53, .39, .78, .66, '#63CF87', true),
    c(.72, .17, .85, .3, '#FFD65A', true), l(.2, .8, .8, .8, '#49B675', 6),
    c(.37, .25, .43, .31, '#FF8FB1', true), c(.57, .31, .63, .37, '#FF8FB1', true),
  ];
  if (has(/sol|lua|estrela|planeta|cometa|espaco|galaxia|meteoro|buraco negro/)) return [
    c(.31, .24, .69, .62, has(/lua/) ? '#D8E5F4' : '#FFD65A', true),
    s([[.47, .17], [.5, .08]], '#FFB84D', 6), s([[.73, .35], [.84, .32]], '#FFB84D', 6),
    s([[.26, .38], [.16, .35]], '#FFB84D', 6), s([[.48, .7], [.5, .8]], '#FFB84D', 6),
    c(.68, .2, .73, .25, '#FFFFFF', true, 1), c(.75, .55, .8, .6, '#FFFFFF', true, 1),
    c(.18, .2, .24, .26, '#8D5BD6', true, 2), c(.78, .72, .84, .78, '#45B8E8', true, 2),
    s([[.38, .44], [.42, .48], [.46, .44]], tinta, 4), s([[.54, .44], [.58, .48], [.62, .44]], tinta, 4),
  ];
  if (has(/retroescavadeira|retro escavadeira|escavadeira|pa carregadeira|trator|bulldozer/)) return [
    r(.22, .61, .69, .77, '#26384D', true), c(.32, .65, .42, .75, '#8999AA', true),
    c(.49, .65, .59, .75, '#8999AA', true), c(.32, .68, .38, .74, '#26384D', true),
    c(.52, .68, .58, .74, '#26384D', true),
    r(.34, .47, .62, .64, '#F2B84B', true), r(.42, .3, .57, .49, '#FFD65A', true),
    r(.45, .33, .54, .43, '#69D8F5', true), l(.41, .5, .29, .38, '#F2B84B', 11),
    l(.29, .38, .2, .45, '#F2B84B', 9), l(.2, .45, .16, .55, '#26384D', 8),
    s([[.13, .53], [.2, .57], [.24, .52]], '#26384D', 7),
    l(.59, .49, .73, .37, '#F2B84B', 11), l(.73, .37, .82, .43, '#F2B84B', 9),
    l(.82, .43, .86, .54, '#26384D', 8),
    s([[.82, .53], [.9, .53], [.88, .61], [.82, .6]], '#26384D', 7),
  ];
  if (has(/onibus|caminhao|ambulancia|van/)) return [
    r(.18, .31, .82, .66, '#45B8E8', true), r(.24, .38, .39, .51, '#D8F3FF', true),
    r(.42, .38, .57, .51, '#D8F3FF', true), r(.6, .38, .75, .51, '#D8F3FF', true),
    r(.41, .55, .57, .66, '#FFB84D', true), c(.27, .61, .4, .74, tinta, true),
    c(.61, .61, .74, .74, tinta, true), c(.3, .64, .37, .71, '#D8E5F4', true, 2),
    c(.64, .64, .71, .71, '#D8E5F4', true, 2), l(.18, .75, .82, .75, '#8999AA', 5),
  ];
  if (has(/moto/)) return [
    c(.22, .56, .42, .76, tinta, false, 8), c(.59, .56, .79, .76, tinta, false, 8),
    l(.32, .66, .48, .47, '#E85D75', 8), l(.48, .47, .68, .66, '#E85D75', 8),
    l(.32, .66, .68, .66, '#E85D75', 8), c(.42, .35, .58, .51, '#45B8E8', true),
    l(.48, .38, .43, .29, tinta, 6), l(.43, .29, .55, .29, tinta, 5),
  ];
  if (has(/carro|bicicleta|aviao|trem|moto|veiculo|taxi/)) return [
    r(.19, .45, .81, .65, '#45B8E8', true), tri(.32, .3, .67, .48, '#69D8F5', true),
    l(.34, .46, .42, .33, '#FFFFFF', 5), l(.64, .46, .58, .33, '#FFFFFF', 5),
    r(.25, .5, .75, .55, '#2864A8', true), c(.28, .59, .43, .74, tinta, true),
    c(.57, .59, .72, .74, tinta, true), c(.32, .63, .39, .7, '#D8E5F4', true, 2),
    c(.61, .63, .68, .7, '#D8E5F4', true, 2),
  ];
  if (has(/pizza|bolo|torta|hamburguer|sanduiche|sorvete|banana|maca|laranja|abacaxi|comida|arroz|feijao|macarrao|sushi|brigadeiro|biscoito|bolacha|pao|cafe|chocolate|restaurante|prato|doce|fruta|queijo|ovo|pipoca/)) return [
    c(.24, .36, .76, .72, '#45B8E8', false, 10), c(.35, .45, .65, .66, '#FFB84D', true),
    c(.39, .49, .45, .55, '#E85D75', true, 2), c(.54, .55, .6, .61, '#49B675', true, 2),
    l(.32, .34, .68, .34, '#FFFFFF', 5), c(.48, .28, .52, .32, '#FFFFFF', true, 2),
  ];
  if (has(/bola|futebol|basquete|tenis|volei|esporte|natacao|corrida|golfe|surf|skate|patins/)) return [
    c(.29, .23, .71, .66, '#FFD65A', true), s([[.5, .23], [.42, .4], [.5, .49], [.58, .4], [.5, .23]], '#FFFFFF', 5),
    s([[.42, .4], [.31, .38]], '#FFFFFF', 5), s([[.58, .4], [.69, .38]], '#FFFFFF', 5),
    s([[.5, .49], [.44, .64]], '#FFFFFF', 5), s([[.5, .49], [.56, .64]], '#FFFFFF', 5),
    l(.21, .76, .79, .76, '#49B675', 6),
  ];
  if (has(/guitarra|violao|musica|microfone|piano|bateria|tambor|flauta|saxofone|violino|instrumento|cantor|banda|nota musical/)) return [
    c(.34, .48, .57, .72, '#FF8B45', true), c(.43, .53, .54, .64, '#F2B84B', true),
    l(.51, .53, .7, .24, '#8B4F38', 10), l(.65, .27, .77, .15, '#8B4F38', 9),
    l(.49, .5, .69, .21, '#FFFFFF', 2), l(.54, .54, .74, .25, '#FFFFFF', 2),
    c(.42, .56, .46, .6, tinta, true, 1), c(.49, .62, .53, .66, tinta, true, 1),
  ];
  if (has(/chave de fenda|screwdriver/)) return [
    c(.4, .11, .6, .35, '#E85D75', true), r(.44, .23, .56, .36, '#FF8B45', true),
    l(.5, .35, .5, .79, '#8999AA', 8), l(.46, .79, .54, .79, tinta, 4),
    l(.44, .17, .56, .17, '#FFFFFF', 3),
  ];
  if (has(/quadro de avisos/)) return [
    r(.17, .18, .83, .72, '#8B5E34', true), r(.22, .23, .78, .67, '#C98945', true),
    r(.29, .3, .46, .52, '#FFF3D1', true), r(.54, .29, .7, .48, '#D8F3FF', true),
    r(.48, .51, .66, .62, '#FF8FB1', true), c(.35, .28, .39, .32, '#E85D75', true, 1),
    c(.62, .27, .66, .31, '#45B8E8', true, 1),
  ];
  if (has(/apagador/)) return [
    r(.25, .31, .75, .61, '#D9A15F', true), r(.29, .52, .71, .65, '#26384D', true),
    l(.34, .39, .66, .39, '#F5D9A8', 3), l(.38, .45, .62, .45, '#F5D9A8', 3),
  ];
  if (has(/lousa|quadro negro/)) return [
    r(.15, .16, .85, .72, '#8B5E34', true), r(.2, .2, .8, .66, '#27634A', true),
    l(.31, .34, .58, .34, '#FFFFFF', 5), l(.31, .45, .67, .45, '#FFFFFF', 5),
    l(.31, .56, .52, .56, '#FFFFFF', 5), r(.38, .72, .62, .78, '#8B5E34', true),
  ];
  if (has(/giz de cera/)) return [
    r(.38, .2, .62, .76, '#FFD65A', true), tri(.38, .2, .62, .33, '#F5D9A8', true),
    l(.4, .38, .6, .38, '#E85D75', 4), l(.4, .46, .6, .46, '#45B8E8', 4),
    l(.4, .54, .6, .54, '#49B675', 4),
  ];
  if (has(/giz/)) return [
    r(.2, .25, .8, .7, '#27634A', true), r(.2, .25, .8, .7, '#8B5E34', false),
    l(.34, .47, .66, .35, '#FFFFFF', 8), c(.27, .55, .33, .61, '#F5D9A8', true, 1),
  ];
  if (has(/borracha/)) return [
    r(.27, .36, .73, .64, '#FF8FB1', true), r(.51, .36, .73, .64, '#FFFFFF', true),
    l(.51, .37, .51, .63, '#E85D75', 3), l(.33, .43, .46, .43, '#F5D9A8', 3),
  ];
  if (has(/apontador/)) return [
    r(.3, .34, .7, .66, '#45B8E8', true), c(.45, .39, .6, .55, tinta, true),
    l(.4, .4, .61, .54, '#D8E5F4', 4), r(.43, .57, .57, .62, '#8999AA', true),
  ];
  if (has(/compasso/)) return [
    c(.42, .2, .58, .34, '#8999AA', true), l(.46, .31, .29, .78, '#45B8E8', 8),
    l(.54, .31, .71, .78, '#E85D75', 8), c(.25, .74, .33, .82, tinta, true, 2),
    tri(.68, .75, .74, .82, tinta, true),
  ];
  if (has(/esquadro/)) return [
    tri(.24, .24, .76, .76, '#45B8E8', false), tri(.38, .39, .62, .63, '#FFFFFF', true),
    l(.24, .76, .76, .76, '#172235', 4), l(.24, .24, .24, .76, '#172235', 4),
  ];
  if (has(/celular|telefone|computador|notebook|tablet|camera|tecnologia|internet|mouse|teclado|monitor|televisao|robo|robot|impressora|fone/)) return [
    r(.3, .22, .7, .67, tinta, true), r(.33, .25, .67, .61, '#69D8F5', true),
    c(.47, .63, .53, .69, '#D8E5F4', true, 2), r(.23, .7, .77, .76, '#9AA9BC', true),
    l(.39, .34, .61, .34, '#FFFFFF', 4), l(.39, .43, .57, .43, '#FFFFFF', 4),
    l(.39, .52, .54, .52, '#FFFFFF', 4),
  ];
  if (has(/livro|caderno|escola|lapis|caneta|mochila|quadro negro|tesoura|regua|apontador|professor|aluno/)) return [
    r(.27, .23, .73, .76, '#E85D75', true), l(.34, .26, .34, .73, '#FFFFFF', 5),
    l(.41, .36, .65, .36, '#FFFFFF', 5), l(.41, .46, .65, .46, '#FFFFFF', 5),
    l(.41, .56, .62, .56, '#FFFFFF', 5), l(.41, .66, .59, .66, '#FFFFFF', 5),
    l(.27, .28, .73, .28, '#B23E58', 4),
  ];
  if (has(/professor|medico|policial|bombeiro|chef|cozinheiro|artista|cantor|jogador|personagem|dentista|enfermeiro|veterinario|padeiro|engenheiro|advogado|cabeleireiro|policia|profissao|ator|atriz/)) return [
    c(.38, .19, .62, .43, '#F1C27D', true), c(.42, .27, .46, .32, tinta, true, 2),
    c(.54, .27, .58, .32, tinta, true, 2), s([[.44, .37], [.5, .4], [.56, .37]], '#9A453E', 4),
    c(.34, .42, .66, .73, '#45B8E8', true), l(.36, .49, .22, .65, '#F1C27D', 9),
    l(.64, .49, .78, .65, '#F1C27D', 9), l(.43, .71, .39, .83, tinta, 8),
    l(.57, .71, .61, .83, tinta, 8), c(.36, .14, .64, .3, '#8B4F38', true),
    tri(.42, .43, .58, .62, '#FFD65A', true),
  ];
  if (has(/arco.?iris|chuva|nuvem|tempestade|neve|clima|vento|furacao|tornado|raio|relampago|neblina/)) return [
    c(.29, .29, .52, .52, '#FFFFFF', true), c(.42, .22, .68, .51, '#FFFFFF', true),
    c(.52, .31, .75, .53, '#FFFFFF', true), l(.34, .56, .29, .67, '#45B8E8', 7),
    l(.49, .56, .44, .67, '#45B8E8', 7), l(.64, .56, .59, .67, '#45B8E8', 7),
    s([[.24, .75], [.38, .69], [.52, .75], [.66, .69], [.8, .75]], '#8D5BD6', 9),
  ];
  if (has(/coroa|princesa|rei|rainha|magia|feiticeir[oa]|bruxa|fantasia|dragao|unicornio|fada|elfo|varinha|pocao|vampiro/)) return [
    c(.37, .24, .63, .5, '#F1C27D', true), tri(.32, .2, .68, .43, '#FFD65A', true),
    c(.43, .34, .47, .39, tinta, true, 2), c(.53, .34, .57, .39, tinta, true, 2),
    c(.34, .48, .66, .77, '#8D5BD6', true), l(.35, .53, .2, .7, '#F1C27D', 8),
    l(.65, .53, .8, .7, '#F1C27D', 8), c(.76, .62, .86, .72, '#69D8F5', false, 6),
    s([[.25, .24], [.28, .17], [.31, .24]], '#69D8F5', 5),
  ];
  return [
    c(.32, .25, .68, .61, '#45B8E8', true), c(.39, .36, .44, .42, tinta, true, 2),
    c(.56, .36, .61, .42, tinta, true, 2), s([[.41, .5], [.5, .56], [.59, .5]], '#E85D75', 5),
    l(.41, .65, .32, .8, '#FF8B45', 8), l(.59, .65, .68, .8, '#FF8B45', 8),
    c(.17, .18, .24, .25, '#FFD65A', true, 2), c(.76, .73, .83, .8, '#8D5BD6', true, 2),
  ];
};

/* Distância de edição (Levenshtein) — quantas letras faltam pra ser igual.
   Usada só pra dizer "quase!", nunca pra dar o ponto: acerto continua exato. */
const distancia = (a, b) => {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const nova = [i];
    for (let j = 1; j <= b.length; j++) {
      nova[j] = Math.min(
        linha[j] + 1,                                   // remoção
        nova[j - 1] + 1,                                // inserção
        linha[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // troca
      );
    }
    linha = nova;
  }
  return linha[b.length];
};

const mesmasLetras = (a, b) => [...a].sort().join('') === [...b].sort().join('');

/* "Quase lá" = a pessoa SABE a palavra e errou a ESCRITA. Não é "chegou perto".
   A diferença importa: dizer "quase" pra quem chutou OUTRA palavra entrega a
   resposta — bastaria chutar até o jogo dizer "quase" e você saberia que a
   palavra é parecida com aquela. Por isso não dá pra usar distância de edição
   pura: "rato" fica a 1 letra de "gato", mas é outra palavra.
   A saída é atrelar a tolerância ao TAMANHO da palavra: quanto mais longa,
   menor a chance de uma diferença de uma letra ser outra palavra de verdade.
   Só conta como quase: */
const quaseLa = (palpite, alvo) => {
  const p = normFolgado(palpite), a = normFolgado(alvo);
  if (!p || !a || p.length < 3) return false;
  // 1) mesma palavra, só pontuação/acento diferente
  //    "boto cor de rosa" ≈ "boto cor-de-rosa"
  if (p === a) return true;
  // 2) plural/singular
  if (p === `${a}s` || a === `${p}s` || p === `${a}es` || a === `${p}es`) return true;
  // 3) letras trocadas de lugar (dedo escorregou): MESMAS letras, ordem diferente
  //    "geladeria" ≈ "geladeira" — e "rato" NÃO tem as mesmas letras de "gato"
  if (p.length === a.length && mesmasLetras(p, a) && distancia(p, a) <= 2) return true;
  // 4) uma letra a mais ou a menos ("geladera" ≈ "geladeira") — inserção/remoção
  if (Math.abs(p.length - a.length) === 1 && distancia(p, a) === 1) return true;
  /* 5) uma letra ERRADA ("bicicreta" ≈ "bicicleta"). Este é o caso perigoso —
     é o que transforma "rato" em "gato" —, então só vale de 6 letras em
     diante: numa palavra desse tamanho, uma única troca é dedo errado quase
     sempre, não outro palpite. Abaixo disso continua fora (com 4 letras,
     "rato" e "gato" são palavras diferentes de verdade). */
  if (p.length === a.length && a.length >= 6 && distancia(p, a) === 1) return true;
  /* 6) palavra bem comprida (12+ letras, o caso de quase todo nome composto:
     "homemaranha", "motoqueirofantasma"): aí tolera DOIS erros de escrita de
     qualquer tipo. Duas palavras diferentes desse tamanho praticamente nunca
     ficam a 2 letras uma da outra. */
  if (a.length >= 12 && distancia(p, a) <= 2) return true;
  return false;
};

// Nome exibido DENTRO do jogo. Por padrão é o nome do login, mas a pessoa pode
// personalizar no editor de perfil (guardado em up_name). Vazio = volta ao login.
const NAME_KEY = 'up_name';
const authName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
const myName = () => {
  try { const saved = (localStorage.getItem(NAME_KEY) || '').trim(); if (saved) return saved; } catch { /* sem localStorage */ }
  return authName();
};
/* ── Foto que trafega na PRESENCE ───────────────────────────────────────────
   NUNCA mandar a foto de perfil aqui: ela é um data URL de PNG 300x300 (~100-200KB
   em base64) e o payload da presence não aguenta — o track é rejeitado em SILÊNCIO,
   e o efeito é cruel: cada um enxerga só a si mesmo, ninguém vê ninguém, e a partida
   nunca começa por "falta de jogadores". Aqui trafega só a URL da imagem (~30 bytes);
   é a MESMA arte, só não convertida. Essa chave é do JOGO — a foto de perfil do
   Portal não tem nada a ver com ela (ver `choosePhoto`). */
const PHOTO_SRC_KEY = 'up_photo_src';
const myPhotoSrc = () => {
  try { return localStorage.getItem(PHOTO_SRC_KEY) || '/UNIKO_NEW.png'; }
  catch { return '/UNIKO_NEW.png'; }
};

/* ── DICAS (estilo Gartic) ──────────────────────────────────────────────────
   Letras vão sendo reveladas com o tempo, e o desenhista pode soltar extras no
   botão. Quais letras: ordem embaralhada com semente = a própria palavra, então
   TODO cliente revela exatamente as mesmas — sem sincronizar nada. */
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ── QUEM É VOCÊ: a CONTA, não o aparelho ───────────────────────────────────
   O apelido (`up_name`) e o Uniko (`up_photo_src`) moram no localStorage, que é
   POR APARELHO. Quem abrisse o jogo no computador e no celular ao mesmo tempo
   com apelidos diferentes entrava como DUAS pessoas: dois lugares na lista, duas
   vezes na fila de desenhar, dois placares — reportado como bug pelo usuário.
   A presence passou a ser chaveada pela CONTA, então ela ocupa uma vaga só,
   venha de quantos aparelhos vier.

   O id é um HASH do CPF, não o CPF: a chave da presence viaja pro canal e fica
   visível pra todos os jogadores — CPF de colaborador não passeia por aí. */
const idDaConta = () => {
  try {
    const a = getAuthUser();
    const bruto = String(a?.cpf || a?.email || a?.id || '').trim();
    if (bruto) return `c${hashStr(bruto.toLowerCase())}`;
  } catch { /* sem token */ }
  return `anon:${myName()}`;   // sem login identificável, cai no nome mesmo
};
/* Identifica esta ABA/aparelho dentro da conta: é como eu sei qual das entradas
   da minha conta é a minha. Sem isso eu poderia "adotar" o meu próprio nome de
   volta e ficar em pingue-pongue com o outro aparelho. */
const CONEXAO = Math.random().toString(36).slice(2);
/* Uma conta pode ter VÁRIAS entradas na mesma key da presence (uma por
   aparelho/aba). Qual delas vale precisa ser decidido IGUAL em todos os
   clientes, senão cada um vê a pessoa numa sala diferente: 1º quem está dentro
   de uma sala (o celular jogando ganha do computador parado no lobby), 2º o
   menor nome — critério bobo, mas determinístico e estável. */
const escolherEntrada = (entradas) => {
  const vivas = (entradas || []).filter(e => e && e.name);
  if (!vivas.length) return null;
  const dentro = vivas.filter(e => e.room);
  return (dentro.length ? dentro : vivas)
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))[0];
};
/* Só LETRA/NÚMERO vira lacuna. Espaço separa palavras e pontuação (hífen,
   apóstrofo) aparece como está — revelar um hífen como "dica" não ajuda
   ninguém, e mostrá-lo entrega de graça que a palavra é hifenizada. */
const ehLetra = (c) => /[a-z0-9]/i.test((c || '').normalize('NFD').replace(/\p{Diacritic}/gu, ''));
const hintOrder = (w) => {
  const idx = [...w].map((c, i) => ({ c, i })).filter(x => ehLetra(x.c)).map(x => x.i);
  let seed = hashStr(w) || 1;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
};
const contaLetras = (w) => [...(w || '')].filter(ehLetra).length;
const maxHints = (w) => Math.max(1, Math.floor(contaLetras(w) * 0.5));
const autoHints = (w, frac) => Math.min(frac >= 0.9 ? 3 : frac >= 0.75 ? 2 : frac >= 0.5 ? 1 : 0, maxHints(w));
/* Devolve a máscara AGRUPADA POR PALAVRA: [['p','_','_'], ['n','_','_','_']].
   Antes era uma string só com espaços no meio — e o HTML COLAPSA espaços
   repetidos, então "procurando nemo" saía como um bloco único de underlines e
   ninguém via que eram duas palavras. Agora cada palavra vira um grupo e a UI
   separa com espaçamento de verdade. */
const maskParts = (w, revelar = 0) => {
  const abrir = new Set(hintOrder(w).slice(0, revelar));
  const grupos = [];
  let atual = [];
  [...(w || '')].forEach((c, i) => {
    if (c === ' ') { if (atual.length) grupos.push(atual); atual = []; return; }
    atual.push(ehLetra(c) ? (abrir.has(i) ? c : '_') : c);   // hífen etc. aparecem
  });
  if (atual.length) grupos.push(atual);
  return grupos;
};

/* ── SOM ────────────────────────────────────────────────────────────────────
   Sintetizado na hora com WebAudio (oscilador + envelope) em vez de arquivos:
   são bipes curtos, e assim não entra nenhum asset de áudio no bundle nem
   depende de rede. O AudioContext nasce suspenso até um gesto do usuário — o
   clique de "Entrar na sala" já serve de destravador. */
let _ac = null;
const audioCtx = () => {
  if (!_ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) _ac = new AC(); }
  if (_ac?.state === 'suspended') _ac.resume().catch(() => {});
  return _ac;
};
const beep = (freq, dur = 0.12, type = 'sine', vol = 0.14, delay = 0) => {
  try {
    const c = audioCtx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);          // ataque curto
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);    // decaimento
    o.start(t); o.stop(t + dur + 0.03);
  } catch { /* aba sem áudio / autoplay bloqueado: o jogo funciona igual */ }
};
const SFX = {
  vez:    () => [523, 659, 784].forEach((f, i) => beep(f, 0.2, 'triangle', 0.12, i * 0.09)),   // dó-mi-sol
  minhaVez: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'triangle', 0.14, i * 0.08)),
  acerto: () => { beep(880, 0.1, 'sine', 0.12); beep(1175, 0.15, 'sine', 0.12, 0.08); },
  euAcertei: () => [784, 988, 1319].forEach((f, i) => beep(f, 0.17, 'sine', 0.15, i * 0.07)),
  tick:   () => beep(1000, 0.045, 'square', 0.05),
  pulou:  () => { beep(520, 0.09, 'triangle', 0.1); beep(392, 0.14, 'triangle', 0.1, 0.07); },
  quase:  () => { beep(700, 0.07, 'sine', 0.09); beep(840, 0.09, 'sine', 0.09, 0.06); },  // "tá quente!"
  fimRodada: () => [440, 330].forEach((f, i) => beep(f, 0.24, 'triangle', 0.1, i * 0.13)),
  vitoria: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.24, 'triangle', 0.13, i * 0.12)),
  entrou: () => beep(660, 0.07, 'sine', 0.07),
  clique: () => beep(520, 0.05, 'sine', 0.05),
};
const SOUND_KEY = 'up_sound';

/* Animações — o arco-íris do glow é o mesmo das orelhas/olhos do mascote. */
const PAINT_CSS = `
@keyframes upFloat { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(2deg); } }
@keyframes upGlow {
  0%,100% { filter: drop-shadow(0 3px 10px rgba(0,0,0,.35)) drop-shadow(0 0 12px #ff3ba766); }
  33%     { filter: drop-shadow(0 3px 10px rgba(0,0,0,.35)) drop-shadow(0 0 14px #3bd7ff77); }
  66%     { filter: drop-shadow(0 3px 10px rgba(0,0,0,.35)) drop-shadow(0 0 14px #7dff3b66); }
}
@keyframes upSpin { to { transform: rotate(360deg); } }
.up-mascote { animation: upFloat 4.5s ease-in-out infinite, upGlow 6s ease-in-out infinite; }
.up-mascote-big { animation: upFloat 5s ease-in-out infinite, upGlow 7s ease-in-out infinite; }
/* Halo cônico girando atrás do mascote. */
.up-halo::before {
  content: ''; position: absolute; inset: -18%; border-radius: 50%; z-index: -1;
  background: conic-gradient(#ff3ba7, #ffb03b, #7dff3b, #3bd7ff, #a83bff, #ff3ba7);
  filter: blur(17px); opacity: .32; animation: upSpin 9s linear infinite;
}
/* Tela "é a vez de fulano" */
@keyframes upTurnIn  { 0% { opacity: 0; transform: scale(.8); } 60% { transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
@keyframes upTurnOut { to { opacity: 0; transform: scale(1.1); } }
@keyframes upAvatarIn { 0% { transform: scale(.4) rotate(-14deg); opacity: 0; } 70% { transform: scale(1.08) rotate(4deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes upRing { 0% { transform: scale(.9); opacity: .8; } 100% { transform: scale(1.5); opacity: 0; } }
@keyframes upResultIn { 0% { opacity: 0; transform: translateY(14px) scale(.96); } 100% { opacity: 1; transform: none; } }
@keyframes upResultTitle { 0% { opacity: 0; transform: scale(.55) rotate(-5deg); } 72% { transform: scale(1.08) rotate(1deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes upSplatIn { 0% { opacity: 0; transform: scale(.25) rotate(-25deg); } 70% { opacity: .2; transform: scale(1.08) rotate(8deg); } 100% { opacity: .16; transform: scale(1) rotate(0); } }
@keyframes upTurnShine { 0% { transform: translateX(-120%) rotate(18deg); } 100% { transform: translateX(120%) rotate(18deg); } }
.up-turn   { animation: upTurnIn .45s cubic-bezier(.2,1.3,.4,1) both; }
.up-turn-out { animation: upTurnOut .35s ease-in both; }
.up-avatar { animation: upAvatarIn .55s cubic-bezier(.2,1.4,.4,1) both; }
.up-ring   { position: absolute; inset: -6px; border-radius: 50%; border: 3px solid currentColor; animation: upRing 1.6s ease-out infinite; }
.up-ring2  { animation-delay: .55s; }
.up-result { animation: upResultIn .5s cubic-bezier(.2,.8,.2,1) both; }
.up-result-title { animation: upResultTitle .62s cubic-bezier(.2,1.3,.4,1) both; }
.up-result-splat { animation: upSplatIn .7s cubic-bezier(.2,1,.3,1) both; }
.up-turn-title { animation: upResultTitle .58s cubic-bezier(.2,1.3,.4,1) .08s both; }
.up-overlay-title {
  display: inline-flex; align-items: center; justify-content: center;
  padding: .42em .95em; border: 1px solid rgba(255,255,255,.78); border-radius: 999px;
  background: linear-gradient(120deg, ${UP.pink}, ${UP.purple} 56%, ${UP.cyan});
  color: #fff; text-shadow: 0 2px 10px rgba(20,25,60,.3);
  box-shadow: 0 8px 24px rgba(168,59,255,.24), inset 0 1px 0 rgba(255,255,255,.28);
  letter-spacing: .03em; -webkit-text-stroke: 0;
}
.up-turn-title {
  background: rgba(24,33,49,.3);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.up-turn-shine { position: absolute; inset: -40% auto -40% -35%; width: 30%; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
  animation: upTurnShine 1.4s ease-in-out .2s both; }
/* Barra de rolagem visível nos palpites. A global do app é de 4px com trilho
   transparente — some no card do chat, e sem enxergar a barra parece que nada
   rola. Aqui ela tem 9px, trilho marcado e polegar rosa da paleta. */
.up-scroll { scrollbar-width: thin; scrollbar-color: ${UP.pink}99 rgba(128,128,128,.14); }
.up-scroll::-webkit-scrollbar { width: 9px; }
.up-scroll::-webkit-scrollbar-track { background: rgba(128,128,128,.14); border-radius: 99px; margin: 4px 0; }
.up-scroll::-webkit-scrollbar-thumb { background: ${UP.pink}99; border-radius: 99px; border: 2px solid transparent; background-clip: content-box; }
.up-scroll::-webkit-scrollbar-thumb:hover { background: ${UP.pink}; border: 2px solid transparent; background-clip: content-box; }
/* Rola, mas SEM barra à vista — pro lobby, onde nunca haverá muitas salas e a
   barra só polui. O overflow fica: se um dia passarem da tela, ainda dá pra
   chegar nelas pela roda do mouse, em vez de ficarem inalcançáveis. */
.up-sembarra { scrollbar-width: none; -ms-overflow-style: none; }
.up-sembarra::-webkit-scrollbar { width: 0; height: 0; display: none; }
/* Cabeçalho: os respingos (svg) ficam no fundo, todo o resto por cima.
   A regra up-hd-center é exceção: precisa continuar absolute pra ficar
   centralizada na barra INTEIRA (e não no espaço que sobra entre nome e botões).
   ATENÇÃO: nada de crase aqui dentro — isto é um template literal, e uma crase
   solta FECHA a string, truncando o CSS e jogando o resto pro parser do JS. */
.up-hd > svg { z-index: 0; }
.up-hd > *:not(svg):not(.up-hd-center) { position: relative; z-index: 1; }
.up-hd-center {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 1; pointer-events: none; text-align: center; max-width: 46%;
}
/* Entradas suaves */
@keyframes upFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes upPop    { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
@keyframes upChatIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
@keyframes upPulse  { 0%,100% { transform: scale(1); } 50% { transform: scale(1.09); } }
@keyframes upShake  { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
.up-fade  { animation: upFadeUp .35s ease both; }
.up-pop   { animation: upPop .3s cubic-bezier(.2,1.4,.4,1) both; }
.up-chat  { animation: upChatIn .22s ease both; }
.up-card  { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
.up-card:hover { transform: translateY(-3px); }
.up-btn   { transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; }
.up-btn:hover:not(:disabled)  { transform: translateY(-1px); filter: brightness(1.06); }
.up-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
.up-create-room-button:focus-visible {
  outline: 3px solid #fff; outline-offset: -5px; box-shadow: 0 0 0 4px rgba(168,59,255,.9);
}
.up-urgent { animation: upShake .5s ease-in-out infinite; }
.up-drawing-badge { animation: upPulse 2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .up-mascote, .up-mascote-big, .up-halo::before, .up-ring, .up-urgent, .up-drawing-badge,
  .up-result, .up-result-title, .up-result-splat, .up-turn-title, .up-turn-shine { animation: none !important; }
}
`;

const PORTAL_ROOM_CSS = `
body.up-active .portal-area {
  background-color: #1765F5;
  background-image: linear-gradient(rgba(6, 18, 45, .08), rgba(6, 18, 45, .08)),
    url('/uniko-paint-background-neon.png');
  background-position: center top;
  background-size: cover;
  background-repeat: no-repeat;
}
body.up-room-active .portal-topbar,
body.up-room-active .portal-mobilenav { display: none !important; }
body.up-room-active .portal-area {
  height: calc(100vh / 0.8) !important;
  padding: 0 !important;
  overflow: hidden !important;
}
@media (max-width: 767px), (max-height: 520px) and (pointer: coarse) {
  body.up-room-active .portal-area { height: 100vh !important; }
}
`;

/* Mascote com brilho. `halo` liga o anel cônico girando atrás. */
const Mascote = ({ size = 42, halo = false, big = false, style }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, zIndex: 0, ...style }}
    className={halo ? 'up-halo' : undefined}>
    <img src={MASCOTE} alt="Uniko Paint" className={big ? 'up-mascote-big' : 'up-mascote'}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
  </div>
);

const Svg = ({ children, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...p}>{children}</svg>
);
const IcoBrush  = (p) => <Svg {...p}><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z"/></Svg>;
const IcoEraser = (p) => <Svg {...p}><path d="M20 20H7L3 16a2 2 0 010-3l9-9a2 2 0 013 0l6 6a2 2 0 010 3l-7 7"/></Svg>;
const IcoFill   = (p) => <Svg {...p}><path d="M19 11l-8-8-8.5 8.5a2 2 0 000 2.8L8 20l11-9z"/><path d="M5 2l3 3"/><path d="M21.5 15s1.5 2 1.5 3a1.5 1.5 0 11-3 0c0-1 1.5-3 1.5-3z"/></Svg>;
const IcoLine   = (p) => <Svg {...p}><line x1="4" y1="20" x2="20" y2="4"/></Svg>;
const IcoRect   = (p) => <Svg {...p}><rect x="4" y="5" width="16" height="14" rx="1.5"/></Svg>;
const IcoCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5"/></Svg>;
const IcoTri    = (p) => <Svg {...p}><path d="M12 4L21 19H3z"/></Svg>;
const IcoHex    = (p) => <Svg {...p}><path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z"/></Svg>;
const IcoStar   = (p) => <Svg {...p}><polygon points="12 3 14.6 9.1 21 9.6 16 13.8 17.6 20 12 16.5 6.4 20 8 13.8 3 9.6 9.4 9.1 12 3"/></Svg>;
const IcoHeart  = (p) => <Svg {...p}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></Svg>;
const IcoTrash  = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></Svg>;
const IcoUndo   = (p) => <Svg {...p}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></Svg>;
const IcoSend   = (p) => <Svg {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Svg>;
const IcoCrown  = (p) => <Svg {...p}><path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/></Svg>;
const IcoCheck  = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>;
const IcoBulb   = (p) => <Svg {...p}><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></Svg>;
const IcoSkip   = (p) => <Svg {...p}><path d="M3 12a9 9 0 019-9 9 9 0 016.4 2.7L21 8"/><polyline points="21 3 21 8 16 8"/><path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.4-2.7L3 16"/><polyline points="3 21 3 16 8 16"/></Svg>;
const IcoExit   = (p) => <Svg {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const IcoPlus   = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
const IcoUsers  = (p) => <Svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></Svg>;
const IcoSom    = (p) => <Svg {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M19 5a9 9 0 010 14"/></Svg>;
const IcoMudo   = (p) => <Svg {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></Svg>;
const IcoFlag   = (p) => <Svg {...p}><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></Svg>;
const IcoEdit   = (p) => <Svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></Svg>;
const ICON_OF = { brush: IcoBrush, eraser: IcoEraser, fill: IcoFill, line: IcoLine, rect: IcoRect, circle: IcoCircle, tri: IcoTri, hex: IcoHex, star: IcoStar, heart: IcoHeart };

/* Pontos (em px do canvas) das formas poligonais dentro da bbox do arraste.
   Independem da direção do arraste (usa min/max) — mesma lógica pra preview e commit. */
const shapePoints = (kind, x1, y1, x2, y2) => {
  const left = Math.min(x1, x2), right = Math.max(x1, x2);
  const top = Math.min(y1, y2), bot = Math.max(y1, y2);
  const mx = (left + right) / 2, my = (top + bot) / 2;
  const rx = (right - left) / 2, ry = (bot - top) / 2;
  if (kind === 'tri') return [[mx, top], [left, bot], [right, bot]];
  if (kind === 'hex') {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([mx + rx * Math.cos(a), my + ry * Math.sin(a)]); }
    return pts;
  }
  if (kind === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 === 0 ? 1 : 0.42; pts.push([mx + rx * r * Math.cos(a), my + ry * r * Math.sin(a)]); }
    return pts;
  }
  if (kind === 'heart') {
    // Curva paramétrica clássica do coração, aproximada por muitos pontos (o
    // desenho usa lineTo+closePath, então basta densidade). y invertido pra a
    // ponta ficar embaixo no canvas; depois normaliza pra caber na bbox.
    const raw = [];
    const N = 48;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      raw.push([hx, -hy]);
    }
    const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (right - left) / (maxX - minX || 1), sy = (bot - top) / (maxY - minY || 1);
    return raw.map(([x, y]) => [left + (x - minX) * sx, top + (y - minY) * sy]);
  }
  return [];
};

/* ── Balde de tinta ─────────────────────────────────────────────────────────
   Flood fill scanline com tolerância. A tolerância existe por causa do
   antialiasing: sem ela o balde para nas bordas suaves do traço e deixa uma
   auréola branca em volta. */
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const floodFill = (cx, px, py, hex, width, height) => {
  const x0 = Math.round(px), y0 = Math.round(py);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;
  const img = cx.getImageData(0, 0, width, height);
  const d = img.data;
  const at = (x, y) => (y * width + x) * 4;
  const s = at(x0, y0);
  const tr = d[s], tg = d[s + 1], tb = d[s + 2];
  const [nr, ng, nb] = hexToRgb(hex);
  if (tr === nr && tg === ng && tb === nb) return;      // já é dessa cor
  const TOL = 60 * 60 * 3;                              // distância² máxima
  const casa = (x, y) => {
    const i = at(x, y);
    const dr = d[i] - tr, dg = d[i + 1] - tg, db = d[i + 2] - tb;
    return dr * dr + dg * dg + db * db <= TOL;
  };
  const visto = new Uint8Array(width * height);
  const stack = [[x0, y0]];
  while (stack.length) {
    const [sx, sy] = stack.pop();
    if (visto[sy * width + sx] || !casa(sx, sy)) continue;
    let x = sx;
    while (x > 0 && casa(x - 1, sy) && !visto[sy * width + (x - 1)]) x--;   // corre pra esquerda
    let acima = false, abaixo = false;
    for (; x < width && casa(x, sy) && !visto[sy * width + x]; x++) {
      visto[sy * width + x] = 1;
      const i = at(x, sy);
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
      // Empilha só a PRIMEIRA célula de cada corrida vizinha (senão a pilha explode)
      if (sy > 0) {
        const ok = casa(x, sy - 1) && !visto[(sy - 1) * width + x];
        if (ok && !acima) stack.push([x, sy - 1]);
        acima = ok;
      }
      if (sy < height - 1) {
        const ok = casa(x, sy + 1) && !visto[(sy + 1) * width + x];
        if (ok && !abaixo) stack.push([x, sy + 1]);
        abaixo = ok;
      }
    }
  }
  cx.putImageData(img, 0, 0);
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY — lista as salas, quem está em cada uma, e deixa criar sala nova.
   ═══════════════════════════════════════════════════════════════════════════ */
/* Tabela não existe (migração não rodada)? O PostgREST responde PGRST205
   ("Could not find the table"), não o 42P01 do Postgres cru — verificado contra
   a API real. Aceita os dois porque o 42P01 aparece em RPC/SQL direto. */
const semTabela = (erro) => !!erro && (erro.code === 'PGRST205' || erro.code === '42P01'
  || /Could not find the table|does not exist/i.test(erro.message || ''));

/* ── Ranking geral (lobby) ──────────────────────────────────────────────────
   Soma dos pontos de todas as partidas. Ver supabase_uniko_paint_ranking.sql. */
const RankingGeral = ({ name, maxAltura, compacto }) => {
  const [linhas, setLinhas] = useState(null);   // null = carregando
  const [faltaSql, setFaltaSql] = useState(false);

  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      const { data, error } = await supabase.from('uniko_paint_ranking')
        .select('player, pontos, partidas, vitorias').order('pontos', { ascending: false }).limit(20);
      if (!vivo) return;
      // Tabela ausente: o PostgREST devolve PGRST205 ("Could not find the table"),
      // NÃO o 42P01 do Postgres cru — conferido contra a API real. Com o código
      // errado o aviso nunca aparecia e a tela ficava "Carregando..." pra sempre.
      if (semTabela(error)) { setFaltaSql(true); return; }
      if (error) { console.error('[uniko-paint] ranking:', error.message); return; }
      setLinhas(data || []);
    };
    carregar();
    const t = setInterval(carregar, 15000);     // atualiza quando partidas terminam
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const medalha = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`);

  return (
    <div style={{ background: T.dark ? 'rgba(20,10,52,.76)' : 'rgba(255,255,255,.78)',
      border: '1px solid rgba(91,220,255,.68)', borderRadius: 16, padding: compacto ? 14 : 18,
      backdropFilter: 'blur(16px) saturate(1.3)', WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
      boxShadow: '0 0 18px rgba(34,207,255,.25), 0 0 32px rgba(168,59,255,.2), inset 0 0 20px rgba(34,207,255,.08)',
      display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden',
      maxHeight: maxAltura }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: compacto ? 9 : 14, flexShrink: 0 }}>
        <span style={{ fontSize: compacto ? 19 : 21 }}>🏆</span>
        <span style={{ fontSize: compacto ? 13 : 15, fontWeight: 800, color: T.textS, letterSpacing: '.07em' }}>RANKING GERAL</span>
      </div>
      {faltaSql ? (
        <div style={{ fontSize: 14, color: T.textS, lineHeight: 1.5 }}>
          Falta rodar <b style={{ color: T.text }}>supabase_uniko_paint_ranking.sql</b> no Supabase.
        </div>
      ) : linhas === null ? (
        <div style={{ fontSize: 14, color: T.textS }}>Carregando...</div>
      ) : !linhas.length ? (
        <div style={{ fontSize: 14, color: T.textS, lineHeight: 1.5 }}>
          Ninguém pontuou ainda. Jogue uma partida e apareça aqui!
        </div>
      ) : (
        <div className="up-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {linhas.map((l, i) => {
            const eu = l.player === name || l.player === authName();
            return (
              <div key={l.player} className="up-fade" style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: compacto ? '7px 8px' : '10px 9px', borderRadius: 10, background: eu ? `${A}18` : 'transparent',
                border: eu ? `1px solid ${A}44` : '1px solid transparent' }}>
                <span style={{ fontSize: compacto ? (i < 3 ? 16 : 12) : (i < 3 ? 18 : 14), fontWeight: 800,
                  color: i < 3 ? T.text : T.textS,
                  width: 28, textAlign: 'center', flexShrink: 0 }}>{medalha(i)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: compacto ? 14 : 15, fontWeight: eu ? 800 : 700, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.player.split(' ')[0]}{eu && ' (você)'}
                  </div>
                  <div style={{ fontSize: compacto ? 11.5 : 12.5, color: T.textS }}>
                    {l.partidas} {l.partidas === 1 ? 'partida' : 'partidas'}
                    {l.vitorias > 0 && ` · ${l.vitorias} 🏅`}
                  </div>
                </div>
                <span style={{ fontSize: compacto ? 14 : 16, fontWeight: 900, color: A, flexShrink: 0 }}>{l.pontos}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Lobby = ({ name, photo, porSala, onEnter, onAbrirPicker, zoomOut }) => {
  const [rooms, setRooms] = useState([]);
  const [carregou, setCarregou] = useState(false);   // 1ª busca de salas concluída
  const [criando, setCriando] = useState(false);
  const [nomeSala, setNomeSala] = useState('');
  const [temaSala, setTemaSala] = useState('geral');
  const [erro, setErro] = useState('');
  const [confirmarEx, setConfirmarEx] = useState(null);  // id da sala a excluir
  const { compacto, empilhado, pequeno, lobbyDenso, lobbyLargo, lobbyEscala90 } = useTela(zoomOut);
  const escalaLobby = lobbyEscala90 && lobbyLargo ? 0.9 : 1;
  const dimensaoLobby = `${100 / escalaLobby}%`;
  const cardBg = T.surface || '#fff';
  const glassSurface = T.dark ? 'rgba(20,10,52,.76)' : 'rgba(255,255,255,.78)';
  const isAdmin = getAuthUser()?.role === 'admin';

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_paint_state')
      .select('id, state, updated_at').order('updated_at', { ascending: false });
    if (error) { console.error('[uniko-paint] lobby:', error); return; }
    // A antiga "Sala Geral" fixa (id='global') foi removida: some da lista e, se
    // estiver vazia, é apagada do banco (não recriamos mais — o app pede pra criar sala).
    const semGlobal = (data || []).filter(r => r.id !== GLOBAL_ROOM);
    setRooms(semGlobal);
    setCarregou(true);
    if ((data || []).some(r => r.id === GLOBAL_ROOM) && !(porSala[GLOBAL_ROOM]?.length)) {
      supabase.from('uniko_paint_state').delete().eq('id', GLOBAL_ROOM).then(() => {}, () => {});
    }
    // Faxina: sala criada por alguém, vazia e parada há muito tempo vira lixo.
    const velhas = semGlobal.filter(r =>
      !(porSala[r.id]?.length) &&
      Date.now() - new Date(r.updated_at).getTime() > ROOM_TTL_MS);
    if (velhas.length) {
      await supabase.from('uniko_paint_state').delete().in('id', velhas.map(r => r.id));
      setRooms(rs => rs.filter(r => !velhas.some(v => v.id === r.id)));
    }
  }, [porSala]);

  useEffect(() => {
    // `load` é async: o setRooms só roda depois do await, nunca síncrono no
    // effect — o compiler não distingue e acusa cascata de render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = supabase.channel('uniko-paint-lobby-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_paint_state' }, load)
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [load]);

  const criarSala = async () => {
    const nome = nomeSala.trim() || `Sala do ${name.split(' ')[0]}`;
    const id = Math.random().toString(36).slice(2, 8);
    setErro('');
    const { error } = await supabase.from('uniko_paint_state').insert({
      id, state: { phase: 'lobby', round: 0, scores: {}, nome, themeId: temaSala, criador: name, botsEnabled: false, botsCount: 2, bots: [] },
    });
    if (error) { setErro('Não deu pra criar a sala. Tente de novo.'); console.error('[uniko-paint] criar:', error); return; }
    onEnter(id);
  };

  // Excluir sala: só quem criou (ou admin), e nunca a Sala Geral.
  const excluirSala = async (id) => {
    setConfirmarEx(null);
    const { error } = await supabase.from('uniko_paint_state').delete().eq('id', id);
    if (error) { setErro('Não deu pra excluir a sala.'); console.error('[uniko-paint] excluir:', error); return; }
    setRooms(rs => rs.filter(r => r.id !== id));
  };
  const podeExcluir = (r) => r.id !== GLOBAL_ROOM && (isAdmin || r.state?.criador === name);

  return (
    <div className="up-sembarra" style={{ display: 'flex', flexDirection: 'column',
      gap: compacto ? 10 : lobbyDenso ? 10 : 14,
      width: dimensaoLobby, height: dimensaoLobby, minHeight: 0, flexShrink: 0,
      transform: escalaLobby < 1 ? `scale(${escalaLobby})` : undefined,
      transformOrigin: 'top left',
      /* No celular o lobby rola por conta própria: a área do Portal fica com
         overflow hidden (por causa da sala, que é tela cheia) e sem isso os
         cards de sala mais abaixo ficavam inalcançáveis. */
      overflowY: compacto ? 'auto' : undefined, WebkitOverflowScrolling: 'touch' }}>
      <style>{PAINT_CSS}</style>
      {/* Espaço para deixar o mascote e o título integrados ao fundo livres acima do perfil. */}
      <div aria-hidden style={{ height: pequeno ? 'clamp(190px, 45vw, 250px)'
        : empilhado ? 'clamp(240px, 30vw, 300px)'
          : escalaLobby < 1 ? 'clamp(200px, 16vw, 220px)'
          : lobbyDenso
        ? (lobbyLargo ? 'clamp(190px, 16.5vw, 225px)' : 'clamp(220px, 20vw, 270px)')
            : 'clamp(300px, 23vw, 330px)',
        flexShrink: 0 }} />

      {/* Perfil e ações em uma faixa compacta, logo abaixo da arte. */}
      <div style={{ display: 'grid', gridTemplateColumns: empilhado ? '1fr' : 'minmax(0, 1fr) auto',
        alignItems: 'center', gap: compacto ? 9 : 12,
        padding: compacto ? '10px 12px' : lobbyDenso ? '8px 12px' : '12px 16px',
        background: glassSurface, border: '1px solid rgba(91,220,255,.72)', borderRadius: 15,
        backdropFilter: 'blur(16px) saturate(1.3)', WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
        boxShadow: '0 0 18px rgba(34,207,255,.28), 0 0 30px rgba(168,59,255,.2), inset 0 0 20px rgba(34,207,255,.08)',
        flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img src={photo} alt={`Foto de ${name}`}
            style={{ width: pequeno ? 46 : lobbyDenso ? 46 : 54, height: pequeno ? 46 : lobbyDenso ? 46 : 54,
              borderRadius: '50%', objectFit: 'cover',
              background: '#fff', border: `3px solid ${A}`, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: lobbyDenso ? 9 : 10, fontWeight: 800, color: T.textS, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Seu perfil no jogo
            </div>
            <div style={{ fontSize: pequeno ? 16 : lobbyDenso ? 16 : 18, fontWeight: 800, color: T.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{name}</div>
          </div>
          <button onClick={onAbrirPicker} aria-label="Editar perfil"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: pequeno ? '9px 10px' : lobbyDenso ? '8px 11px' : '10px 14px',
              borderRadius: 11, border: 'none',
              background: `linear-gradient(135deg, ${A}, ${A2})`, color: '#fff', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0 }}>
            <IcoEdit size={16} />{pequeno ? 'Editar' : 'Editar perfil'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: pequeno ? 'stretch' : 'flex-end',
          gap: 8, gridColumn: empilhado ? 1 : 2, gridRow: empilhado ? 2 : 1 }}>
          <ConvidarButton game="paint" roomId={null} accent={A}
            style={{ flex: pequeno ? 1 : undefined, justifyContent: 'center',
              padding: lobbyDenso ? '8px 11px' : '10px 14px', minHeight: lobbyDenso ? 36 : 42 }} />
          <button onClick={() => setCriando(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: lobbyDenso ? '8px 12px' : '10px 15px', minHeight: lobbyDenso ? 36 : 42,
                borderRadius: 999, border: 'none', flex: pequeno ? 1 : undefined,
                background: '#fff', color: A, fontSize: lobbyDenso ? 12 : 13, fontWeight: 800, cursor: 'pointer',
              touchAction: 'manipulation', boxShadow: '0 3px 12px rgba(0,0,0,.14)' }}>
            <IcoPlus size={17} />Criar sala
          </button>
        </div>
      </div>

      {/* Criar sala */}
      {criando && (
        <div style={{ background: glassSurface, border: `1px solid ${A}99`, borderRadius: 14, padding: 16,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: `0 0 18px ${A}44, 0 0 30px rgba(34,207,255,.16)`, flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 11 }}>Nova sala</div>
          <input value={nomeSala} onChange={e => setNomeSala(e.target.value)} maxLength={28}
            onKeyDown={e => e.key === 'Enter' && criarSala()}
            placeholder={`Sala do ${name.split(' ')[0]}`}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`, marginBottom: 12,
              background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }} />
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.05em', marginBottom: 7 }}>TEMA DA SALA</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {ALL_THEMES.map(t => {
              const c = corDoTema(t.id);          // a mesma cor que a sala terá no lobby
              const on = temaSala === t.id;
              return (
                <button key={t.id} className="up-btn" onClick={() => setTemaSala(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, transition: 'all .12s',
                    border: on ? `2px solid ${c}` : `1px solid ${c}44`,
                    background: on ? `${c}22` : 'transparent', color: T.text }}>
                  <span>{t.emoji}</span>{t.nome}
                </button>
              );
            })}
          </div>
          {erro && <div style={{ fontSize: 12, color: '#E63946', marginBottom: 8 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={criarSala}
              style={{ padding: '10px 22px', borderRadius: 999, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
                cursor: 'pointer', background: `linear-gradient(135deg, ${A}, ${A2})`, boxShadow: `0 5px 16px ${AG}` }}>
              Criar e entrar
            </button>
            <button onClick={() => setCriando(false)}
              style={{ padding: '10px 18px', borderRadius: 999, border: `1px solid ${T.border}`, background: 'transparent',
                color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Salas + ranking lado a lado. minmax(0,1fr) na linha pelo mesmo motivo de
          sempre: sem isso a linha cresce com o conteúdo e estica a página. */}
      <div style={{ flex: empilhado ? undefined : 1, display: 'grid',
        marginTop: lobbyDenso && lobbyLargo ? -8 : 0,
        gridTemplateColumns: empilhado ? '1fr' : lobbyDenso ? '1fr 300px' : '1fr 336px',
        /* Empilhado, as duas caixas viram linhas de altura livre e quem rola é o
           lobby inteiro — travar a altura aqui espremia a lista de salas. */
        gridTemplateRows: empilhado ? 'auto auto' : 'minmax(0, 1fr)', gap: 12, minHeight: 0 }}>
      {/* Lista de salas — sem barra de rolagem (não vai ter sala demais), mas
          ainda rolável pela roda se um dia passar da tela. */}
      <div className="up-sembarra" style={{ display: 'flex', flexDirection: 'column',
        overflowY: empilhado ? 'visible' : 'auto', minHeight: 0, position: 'relative' }}>
        {/* respingos coloridos bem sutis no fundo da lista */}
        <Splat x="-3%"  y="14%" size={190} cor={UP.cyan}   rot={18}  op={0.05} forma={1} />
        <Splat x="72%"  y="52%" size={230} cor={UP.pink}   rot={200} op={0.045} forma={2} />
        <Splat x="34%"  y="78%" size={160} cor={UP.yellow} rot={95}  op={0.05} forma={0} />
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.textS, letterSpacing: '.08em', marginBottom: 10,
          position: 'relative', zIndex: 1 }}>
          SALAS ({rooms.length})
        </div>
        {/* `minmax(280px, 360px)` e não `1fr`: com 1fr os cards ESTICAM pra ocupar
            a linha toda, então em tela grande (ou com poucas salas) cada card
            virava um bloco enorme, enquanto em tela menor ficava compacto — era
            a mesma tela parecendo dois layouts diferentes. Teto de 360px + o
            grid alinhado à esquerda mantém o card sempre do mesmo tamanho. */}
        <div style={{ display: 'grid',
          gridTemplateColumns: pequeno ? '1fr' : lobbyDenso
            ? 'repeat(auto-fill, minmax(240px, 320px))' : 'repeat(auto-fill, minmax(280px, 360px))',
          justifyContent: 'start', gap: lobbyDenso ? 10 : 14, position: 'relative', zIndex: 1 }}>
          {rooms.map(r => {
            const st = r.state || {};
            const tema = themeById(st.themeId);
            const gente = porSala[r.id] || [];
            const fixa = r.id === GLOBAL_ROOM;
            const jogando = st.phase === 'drawing' || st.phase === 'reveal';
            const cor = corDoTema(st.themeId);   // cada tema tem sua cor de tinta
            const brilhoCard = `0 0 18px ${cor}55, 0 0 34px ${cor}2b, inset 0 0 22px ${cor}12`;
            return (
              <div key={r.id} className="up-card up-fade"
                style={{ background: `linear-gradient(180deg, ${cor}30 0%, ${glassSurface} 72%)`,
                  border: `1px solid ${cor}bb`, borderRadius: 18,
                  padding: lobbyDenso ? 14 : compacto ? 16 : 20, boxShadow: brilhoCard,
                  backdropFilter: 'blur(16px) saturate(1.3)', WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
                  display: 'flex', flexDirection: 'column', gap: 14,
                  position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = cor; e.currentTarget.style.boxShadow = `0 0 24px ${cor}88, 0 0 40px ${cor}44, inset 0 0 24px ${cor}20`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${cor}bb`; e.currentTarget.style.boxShadow = brilhoCard; }}>
                {/* respingo da cor do tema, no canto */}
                <Splat y="-22px" size={100} cor={cor} rot={34} op={0.13} forma={r.id.charCodeAt(0) % 3}
                  style={{ left: 'auto', right: '-16px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  position: 'relative', zIndex: 1, minHeight: 28 }}>
                  <div style={{ padding: '5px 10px', borderRadius: 999, background: `${cor}28`, color: T.text,
                    fontSize: lobbyDenso ? 10 : 11, fontWeight: 800, letterSpacing: '.04em' }}>
                    {tema.nome.toLocaleUpperCase('pt-BR')}
                  </div>
                  {jogando && (
                    <div style={{ padding: '3px 8px', borderRadius: 999, background: '#28a06018', color: '#28a060',
                      fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>EM JOGO</div>
                  )}
                  {podeExcluir(r) && (
                    <button onClick={() => setConfirmarEx(r.id)} title="Excluir esta sala"
                      style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, cursor: 'pointer', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#E63946'; e.currentTarget.style.borderColor = '#E6394655'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = T.textS; e.currentTarget.style.borderColor = T.border; }}>
                      <IcoTrash size={13} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  gap: 7, position: 'relative', zIndex: 1, flex: 1, justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ width: pequeno ? 82 : lobbyDenso ? 82 : 96,
                    height: pequeno ? 82 : lobbyDenso ? 82 : 96, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: pequeno ? 48 : lobbyDenso ? 50 : 56, background: `linear-gradient(145deg, ${cor}40, ${cor}20)`,
                    border: `3px solid ${cor}bb`, boxShadow: `0 5px 18px ${cor}30, inset 0 0 0 5px ${cardBg}` }}>
                    <span role="img" aria-label={tema.nome}>{tema.emoji}</span>
                  </div>
                  <div style={{ width: '100%', fontSize: pequeno ? 19 : lobbyDenso ? 19 : 21, fontWeight: 800, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                    {st.nome || (fixa ? 'Sala Geral' : 'Sala')}
                  </div>
                  {fixa && <div style={{ fontSize: 11, color: T.textS }}>Sala fixa</div>}
                </div>

                {/* Quem está na sala */}
                <div style={{ display: 'flex', alignItems: 'center', gap: lobbyDenso ? 9 : 12,
                  minHeight: lobbyDenso ? 42 : 48, position: 'relative', zIndex: 1,
                  padding: lobbyDenso ? '7px 9px' : '9px 11px', borderRadius: 12,
                  background: `${cor}1c`, border: `1px solid ${cor}35` }}>
                  {gente.length ? (
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexShrink: 0 }}>
                        {gente.slice(0, 5).map((p, i) => (
                          <img key={p.name} src={p.photo || '/UNIKO_NEW.png'} alt="" title={p.name}
                            style={{ width: lobbyDenso ? 34 : 38, height: lobbyDenso ? 34 : 38,
                              borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub,
                              border: `2px solid ${cardBg}`, marginLeft: i ? -10 : 0 }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text, marginLeft: 10, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gente.length === 1 ? gente[0].name.split(' ')[0] : 'Pessoas na sala'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: T.textS, display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
                      <IcoUsers size={17} />Seja o primeiro a entrar
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, color: cor }}>
                    <IcoUsers size={17} />
                    <span style={{ fontSize: 16, fontWeight: 900 }}>{gente.length}</span>
                  </div>
                </div>

                <button className="up-btn" onClick={() => { SFX.entrou(); onEnter(r.id); }}
                  style={{ width: '100%', padding: compacto ? '16px' : '15px', borderRadius: 13, border: 'none', color: textoSobre(cor),
                    fontSize: pequeno ? 16 : lobbyDenso ? 15 : 17, fontWeight: 900, letterSpacing: '.02em', cursor: 'pointer', position: 'relative', zIndex: 1,
                    touchAction: 'manipulation',
                    background: `linear-gradient(135deg, ${cor}, ${cor}dd)`, boxShadow: `0 5px 16px ${cor}55` }}>
                  Jogar nesta sala
                </button>

                {/* Confirmação de exclusão — cobre o próprio card */}
                {confirmarEx === r.id && (
                  <div className="up-pop" style={{ position: 'absolute', inset: 0, borderRadius: 14, zIndex: 2,
                    background: 'rgba(255,255,255,.97)', border: '1px solid #E6394655', padding: 14,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E' }}>Excluir esta sala?</div>
                    <div style={{ fontSize: 11.5, color: '#6b7280', lineHeight: 1.45 }}>
                      {gente.length
                        ? `Tem ${gente.length} ${gente.length === 1 ? 'pessoa jogando' : 'pessoas jogando'} aí dentro agora!`
                        : 'A sala some pra todo mundo. Não dá pra desfazer.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="up-btn" onClick={() => excluirSala(r.id)}
                        style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#E63946',
                          color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                      <button className="up-btn" onClick={() => setConfirmarEx(null)}
                        style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent',
                          color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!rooms.length && (carregou ? (
          <div className="up-card up-fade"
            style={{ position: 'relative', flex: 1, minHeight: empilhado ? 230 : 0, width: '100%',
              marginTop: 0, overflow: 'hidden', borderRadius: 18,
              border: '1px solid rgba(91,220,255,.72)', background: 'rgba(12,5,45,.82)',
              boxShadow: '0 0 18px rgba(34,207,255,.25), 0 0 32px rgba(168,59,255,.2)' }}>
            <div style={{ position: 'absolute', inset: 0, containerType: 'size' }}>
              <img src="/uniko-paint-create-room.png" alt=""
                style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', objectPosition: 'center top', pointerEvents: 'none' }} />
              <button type="button" className="up-create-room-button" onClick={() => setCriando(true)}
                aria-label="Criar sala"
                style={{ position: 'absolute', left: '36.3cqw', top: '20.5cqw', width: '27.4cqw', height: '6.25cqw',
                  padding: 0, border: 0, borderRadius: 999, background: 'transparent',
                  cursor: 'pointer', touchAction: 'manipulation' }} />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 12,
            color: T.textD, fontSize: 12 }}>
            Carregando salas...
          </div>
        ))}
      </div>

      <RankingGeral name={name} compacto={lobbyDenso}
        maxAltura={empilhado ? (pequeno ? 320 : 420) : undefined} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SALA — a partida em si.
   ═══════════════════════════════════════════════════════════════════════════ */
const Sala = ({ roomId, name, photo, players, onLeave, onAbrirPicker, zoomOut }) => {
  const [state, setState] = useState(null);
  const bots = useMemo(() => {
    if (['drawing', 'reveal'].includes(state?.phase)) return state?.bots || [];
    return state?.botsEnabled ? criarBotsDaSala(players, state?.botsCount ?? 2) : [];
  }, [players, state?.phase, state?.bots, state?.botsEnabled, state?.botsCount]);
  const participantes = useMemo(() => [...players, ...bots], [players, bots]);
  useGamePlaytime('paint', state?.phase === 'drawing' || state?.phase === 'reveal');
  const [chat, setChat]   = useState([]);
  const [guess, setGuess] = useState('');
  const [now, setNow]     = useState(() => Date.now());
  const [laps, setLaps]   = useState(DEFAULT_LAPS);
  const [vez, setVez]     = useState(null);   // overlay "é a vez de fulano"
  const [confirmPular, setConfirmPular] = useState(false);
  const [kickVotes, setKickVotes] = useState({});   // { alvo: [nomes que votaram] } — expulsar
  const kickVotesRef = useRef({});
  const [somOn, setSomOn] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; } });
  const somRef = useRef(somOn);
  useEffect(() => { somRef.current = somOn; try { localStorage.setItem(SOUND_KEY, somOn ? '1' : '0'); } catch { /* sem localStorage */ } }, [somOn]);
  const sfx = useCallback((k) => { if (somRef.current) SFX[k]?.(); }, []);

  const [tool, setTool]     = useState('brush');
  const [color, setColor]   = useState(COLORS[0]);
  const [size, setSize]     = useState(SIZES[1]);
  const [filled, setFilled] = useState(false);

  /* ── Celular ───────────────────────────────────────────────────────────
     A sala no celular vira TELA CHEIA e os painéis laterais (jogadores, menu)
     viram gavetas — não cabem três colunas em 390px sem espremer o desenho,
     que é o que a pessoa veio fazer. */
  const { compacto, empilhado, pequeno, paisagem } = useTela(zoomOut);
  const { h: alturaVis, top: topoVis } = useAlturaVisivel(compacto, zoomOut);
  const [chatAberto, setChatAberto]   = useState(true);
  const [chatAba, setChatAba]         = useState('respostas');
  const [sheetJog, setSheetJog]       = useState(false);   // gaveta "Jogadores"
  const [menuMob, setMenuMob]         = useState(false);   // gaveta "⋯"
  const [sheetFerr, setSheetFerr]     = useState(false);   // gaveta "Ferramentas"
  const [sheetTam, setSheetTam]       = useState(false);   // gaveta "Espessura"

  const canvasRef = useRef(null);
  const baseRef   = useRef(null);   // canvas offscreen com o desenho commitado
  const canvasSizeRef = useRef({ width: CW, height: CH });
  const canvasResizeRef = useRef(null);
  const chanRef   = useRef(null);
  const acts      = useRef([]);     // ações commitadas (normalizadas 0..1)
  const drag      = useRef(null);
  const pending   = useRef([]);     // segmentos a enviar (batch)
  const chatEndRef = useRef(null);
  const registrosEndRef = useRef(null);
  const isDrawerRef = useRef(false);
  const stateRef    = useRef(null);
  const hostRef     = useRef(false);
  const desenhoBotRef = useRef({ key: null, enviados: 0 });
  // players TAMBÉM precisa de espelho: registerHit roda a partir do handler do
  // canal, que é registrado uma vez só e enxergaria a lista VAZIA do 1º render.
  const playersRef  = useRef([]);

  /* ── Canvas ──────────────────────────────────────────────────────────── */
  const ctxBase = () => {
    const { width, height } = canvasSizeRef.current;
    if (!baseRef.current) {
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, width, height);
      baseRef.current = c;
    }
    return baseRef.current.getContext('2d', { willReadFrequently: true });
  };
  const drawAct = (cx, a) => {
    const { width, height } = canvasSizeRef.current;
    const px = (p) => [p.x * width, p.y * height];
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.strokeStyle = a.c; cx.fillStyle = a.c; cx.lineWidth = a.w || 1;
    if (a.t === 's') {
      if (!a.pts?.length) return;
      cx.strokeStyle = a.e ? '#FFFFFF' : a.c;
      cx.beginPath(); cx.moveTo(...px(a.pts[0]));
      for (let i = 1; i < a.pts.length; i++) cx.lineTo(...px(a.pts[i]));
      if (a.pts.length === 1) cx.lineTo(a.pts[0].x * width + 0.1, a.pts[0].y * height);
      cx.stroke();
    } else if (a.t === 'l') {
      cx.beginPath(); cx.moveTo(...px(a.a)); cx.lineTo(...px(a.b)); cx.stroke();
    } else if (a.t === 'r') {
      const [x1, y1] = px(a.a), [x2, y2] = px(a.b);
      cx.beginPath(); cx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      a.f ? cx.fill() : cx.stroke();
    } else if (a.t === 'c') {
      const [x1, y1] = px(a.a), [x2, y2] = px(a.b);
      cx.beginPath();
      cx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      a.f ? cx.fill() : cx.stroke();
    } else if (a.t === 'tri' || a.t === 'hex' || a.t === 'star' || a.t === 'heart') {
      const [x1, y1] = px(a.a), [x2, y2] = px(a.b);
      const pts = shapePoints(a.t, x1, y1, x2, y2);
      cx.beginPath();
      pts.forEach(([X, Y], i) => (i ? cx.lineTo(X, Y) : cx.moveTo(X, Y)));
      cx.closePath();
      a.f ? cx.fill() : cx.stroke();
    } else if (a.t === 'f') {
      floodFill(cx, a.p.x * width, a.p.y * height, a.c, width, height);
    }
  };
  const blit = (preview) => {
    const cv = canvasRef.current; if (!cv || !baseRef.current) return;
    const { width, height } = canvasSizeRef.current;
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, width, height);
    cx.drawImage(baseRef.current, 0, 0);
    if (preview) drawAct(cx, preview);
  };
  const commit = (a) => { acts.current.push(a); drawAct(ctxBase(), a); blit(); };
  const replay = () => {
    const cx = ctxBase();
    const { width, height } = canvasSizeRef.current;
    cx.clearRect(0, 0, width, height);
    cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, width, height);
    for (const a of acts.current) drawAct(cx, a);
    blit();
  };
  const clearAll = () => { acts.current = []; replay(); };
  // Traço em andamento: aplica só o segmento novo no base (incremental).
  const applySeg = (seg) => {
    const cx = ctxBase();
    if (seg.start) {
      acts.current.push({ t: 's', pts: [seg.p], c: seg.c, w: seg.w, e: seg.e });
    } else {
      const a = acts.current[acts.current.length - 1];
      if (a?.t !== 's') return;
      const prev = a.pts[a.pts.length - 1];
      a.pts.push(seg.p);
      const { width, height } = canvasSizeRef.current;
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.strokeStyle = a.e ? '#FFFFFF' : a.c; cx.lineWidth = a.w;
      cx.beginPath(); cx.moveTo(prev.x * width, prev.y * height); cx.lineTo(seg.p.x * width, seg.p.y * height); cx.stroke();
    }
    blit();
  };

  const isDrawer = state?.phase === 'drawing' && state?.drawer === name;
  const word     = useMemo(() => dec(state?.wordEnc), [state?.wordEnc]);
  /* HOST — quem criou a sala manda; se ele não está, o mais antigo na sala.
     Era `sort()[0]` (menor nome alfabético), o que fazia o host TROCAR SOZINHO
     no meio da partida: você é host, entra o "Alan", e ele rouba o comando só
     por vir antes no alfabeto. Como o host é quem toca o relógio e grava o
     placar, isso trocava o dono da partida no meio do jogo.
     `entrouEm` (relógio de quem entrou) é só desempate — relógios de máquinas
     diferentes divergem, então não dá pra confiar nele como critério principal;
     o nome fecha o empate pra decisão ser igual em todos os clientes. */
  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) =>
      (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost   = host === name;
  const iHit     = !!state?.hits?.includes(name);
  const secsLeft = state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;
  const frac     = state?.phase === 'drawing' ? 1 - (secsLeft / (ROUND_MS / 1000)) : 0;
  const revelar  = state?.phase === 'drawing'
    ? Math.min(maxHints(word), autoHints(word, frac) + (state?.hints || 0)) : 0;

  // Tique-taque nos 5s finais — um bipe por segundo, sem repetir no mesmo.
  useEffect(() => {
    if (state?.phase !== 'drawing' || secsLeft > 5 || secsLeft <= 0) return;
    if (ultTick.current === secsLeft) return;
    ultTick.current = secsLeft;
    sfx('tick');
  }, [secsLeft, state?.phase, sfx]);

  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);
  // Rede de segurança: `aplicaEstado` já mantém o stateRef em dia de forma
  // síncrona (é o caminho de TODA mudança de estado). Isto só cobre o caso de
  // alguém setar `state` por fora dele no futuro.
  useEffect(() => { if (state) stateRef.current = state; }, [state]);
  useEffect(() => { hostRef.current = isHost; }, [isHost]);
  useEffect(() => { playersRef.current = participantes; }, [participantes]);

  /* ── Estado da sala ──────────────────────────────────────────────────────
     Todo estado carrega um `ts` (relógio da própria partida) e passa por
     `aplicaEstado`, que faz duas coisas essenciais:

     1. DESCARTA ESTADO VELHO. O poll de 4s e o realtime podem entregar uma
        resposta que saiu do banco ANTES da última mudança — e aplicar isso
        rebobinava a partida pra rodada anterior. Foi o que fez "TABLET" não
        acertar "tablet": o palpite era comparado com a palavra da rodada
        PASSADA, que o poll tinha acabado de restaurar por baixo dos panos. É
        também o que fazia o tema piscar e voltar.
     2. Atualiza o `stateRef` NA HORA. O ref alimentava-se por useEffect, ou
        seja, só depois do render — e é ele que o acerto consulta. ── */
  const aplicaEstado = useCallback((st) => {
    if (!st) return;
    const atual = stateRef.current;
    // Só descarta quando dá pra ter CERTEZA de que é atrasado — ou seja, quando
    // os dois lados têm `ts`. Estado sem carimbo (sala recém-criada, ou alguém
    // ainda com o bundle antigo no ar durante um deploy) passa: ignorá-lo
    // dessincronizaria a partida, que é pior do que o que estamos evitando.
    if (atual?.ts && st.ts && st.ts < atual.ts) return;
    stateRef.current = st;                                  // síncrono, antes do render
    setState(st);
  }, []);

  const pushState = useCallback(async (next) => {
    // `ts` MONOTÔNICO: nunca menor que o do estado atual. Com só Date.now(), um host cujo relógio
    // esteja atrás do anterior (celular x PC, ou troca de host no meio da partida) gerava estados
    // com ts menor — que `aplicaEstado` de TODOS descarta como "velho" — e a partida congelava.
    const carimbado = { ...next, ts: Math.max(Date.now(), (stateRef.current?.ts || 0) + 1) };
    aplicaEstado(carimbado);            // otimista: já vale localmente
    try {
      const { error } = await supabase.from('uniko_paint_state')
        .update({ state: carimbado, updated_at: new Date().toISOString() }).eq('id', roomId);
      if (error) console.error('[uniko-paint] pushState:', error.message);
    } catch (e) { console.error('[uniko-paint] pushState:', e); }
  }, [roomId, aplicaEstado]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('uniko_paint_state').select('state').eq('id', roomId).maybeSingle();
      if (!alive) return;
      aplicaEstado(data?.state);
    };
    load();
    const ch = supabase.channel(`uniko-paint-state-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uniko_paint_state', filter: `id=eq.${roomId}` },
        ({ new: row }) => aplicaEstado(row?.state))
      .subscribe();
    const poll = setInterval(load, 4000);
    return () => { alive = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId, aplicaEstado]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  /* ── Sons + tela "é a vez de fulano" ─────────────────────────────────────
     Tudo detectado LOCALMENTE por transição de estado — nada disso precisa
     trafegar, cada cliente percebe a mudança e reage. ── */
  const ultRodada = useRef(null);
  const ultAcertos = useRef(0);
  const ultFase = useRef(null);
  const ultTick = useRef(0);

  // Rodada nova → mostra de quem é a vez, com o Uniko da pessoa bem grande.
  useEffect(() => {
    if (state?.phase !== 'drawing') return;
    const chave = `${state.round}|${state.drawer}`;
    if (ultRodada.current === chave) return;
    ultRodada.current = chave;
    const p = participantes.find(x => x.name === state.drawer);
    const euQueDesenho = state.drawer === name;
    setVez({ nome: state.drawer, photo: p?.photo || (euQueDesenho ? photo : null), eu: euQueDesenho });
    sfx(euQueDesenho ? 'minhaVez' : 'vez');
    const t = setTimeout(() => setVez(null), 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, state?.round, state?.drawer]);

  // Acertos, fim de rodada e vitória.
  useEffect(() => {
    const n = state?.hits?.length || 0;
    if (n > ultAcertos.current) {
      const novo = state.hits[n - 1];
      sfx(novo === name ? 'euAcertei' : 'acerto');
    }
    ultAcertos.current = n;
  }, [state?.hits, name, sfx]);

  useEffect(() => {
    const f = state?.phase;
    if (f !== ultFase.current) {
      if (f === 'reveal') {
        sfx('fimRodada');
        if (state?.denunciada) {
          addChat({ name: 'UNIKO', text: `🚩 desenho denunciado pela galera — ${state.drawer?.split(' ')[0] || 'o desenhista'} não pontuou nesta rodada`, kind: 'sys' });
        }
      }
      if (f === 'over') sfx('vitoria');
      if (f === 'lobby') { ultRodada.current = null; ultAcertos.current = 0; }
      ultFase.current = f;
    }
  }, [state?.phase, sfx]);

  /* ── Chat / palpites ─────────────────────────────────────────────────── */
  const addChat = (m) => setChat(c => [...c.slice(-60), { id: Math.random().toString(36).slice(2), ...m }]);
  const onGuessMsg = (p) => {
    const s = stateRef.current;
    const w = dec(s?.wordEnc);
    const rolando = s?.phase === 'drawing' && w && p.name !== s.drawer && !s.hits?.includes(p.name);
    const acertou = rolando && norm(p.text) === norm(w);
    if (acertou) {
      addChat({ name: p.name, text: 'acertou a palavra!', kind: 'hit' });
      if (hostRef.current) registerHit(p.name);
      return;
    }
    const perto = rolando && quaseLa(p.text, w);
    const meu = p.name === name;
    // "Quase lá" alheio: ESCONDE o texto do palpite dos OUTROS. Um erro de
    // digitação de quem está quase certo (ex.: "coraçao" em vez de "coração")
    // entregaria a palavra pra quem lê o chat. Mostra só um aviso sem o texto.
    if (perto && !meu) {
      addChat({ name: p.name, text: 'está quase lá! 🔥', kind: 'quase-oculto' });
      return;
    }
    addChat({ name: p.name, text: p.text, kind: s?.hits?.includes(p.name) ? 'muted' : 'chat' });
    // "Quase lá!" pro PRÓPRIO palpiteiro: dica privada pra ele revisar a escrita.
    if (perto && meu) {
      addChat({ name: 'UNIKO', text: 'quase lá! 🔥 confira a escrita', kind: 'quase' });
      sfx('quase');
    }
  };
  const registerHit = (who) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'drawing' || s.hits?.includes(who)) return;
    const hits = [...(s.hits || []), who];
    const pts = Math.max(40, 100 - (hits.length - 1) * 15);
    const scores = { ...(s.scores || {}) };
    scores[who] = (scores[who] || 0) + pts;
    scores[s.drawer] = (scores[s.drawer] || 0) + 30;
    // Guarda quanto o desenhista ganhou NESTA rodada — se o desenho acabar
    // denunciado depois, é essa marca que diz quanto estornar (ver registerReport).
    const drawerRoundPts = (s.drawerRoundPts || 0) + 30;
    // playersRef, NUNCA `players`: esta função roda a partir do handler do canal
    // (closure do 1º render, lista vazia) → `faltam` dava -1 e a rodada encerrava
    // no PRIMEIRO acerto, sem os outros terem chance de pontuar.
    // Conta direto quem AINDA não acertou entre os jogadores presentes AGORA —
    // não faz total-menos-hits.length: se alguém acerta e sai da sala antes do
    // fim da rodada, ele some do total (playersRef encolhe) mas continuava em
    // `hits`, então a subtração ficava 1 a menos e a rodada pulava faltando UM
    // acertar de verdade.
    const faltam = playersRef.current.filter(p => p.name !== s.drawer && !hits.includes(p.name)).length;
    pushState(faltam <= 0
      ? { ...s, hits, scores, drawerRoundPts, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) }
      : { ...s, hits, scores, drawerRoundPts });
  };
  const sendGuess = () => {
    const text = guess.trim();
    if (!text) return;
    setGuess('');
    if (isDrawer) { addChat({ name, text: 'você está desenhando! 🤫', kind: 'sys' }); return; }
    chanRef.current?.send({ type: 'broadcast', event: 'guess', payload: { name, text } });
    onGuessMsg({ name, text });
  };
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest' });
    registrosEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [chat, chatAberto, chatAba]);

  /* ── Denunciar desenho ────────────────────────────────────────────────
     Qualquer um que NÃO seja o desenhista pode denunciar (desenho impróprio,
     fora do tema, rabisco de propósito etc). Quando os votos batem
     REPORT_THRESHOLD dos jogadores possíveis (todos menos o desenhista), a
     rodada encerra na hora — igual "Pular vez" — e o desenhista NÃO fica com
     os pontos que já tinha ganho NESTA rodada (estornados via drawerRoundPts).
     Só o HOST escreve o estado, mesmo caminho de registerHit: quem denuncia
     manda um broadcast, e cada cliente decide localmente se já bateu o
     percentual — sem isso duas denúncias quase simultâneas poderiam ler o
     mesmo estado velho e a segunda "sumir". */
  const registerReport = (who) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'drawing' || who === s.drawer || s.reports?.includes(who)) return;
    const reports = [...(s.reports || []), who];
    // playersRef, não `players` — mesmo motivo do faltam em registerHit.
    const total = playersRef.current.filter(p => !p.isBot && p.name !== s.drawer).length;
    const bateuOsVotos = total > 0 && (reports.length / total) >= REPORT_THRESHOLD;
    if (bateuOsVotos) {
      const scores = { ...(s.scores || {}) };
      scores[s.drawer] = (scores[s.drawer] || 0) - (s.drawerRoundPts || 0);   // estorna
      pushState({
        ...s, reports, scores, drawerRoundPts: 0,
        phase: 'reveal', endsAt: Date.now() + REVEAL_MS,
        lastWord: dec(s.wordEnc), denunciada: true,
      });
    } else {
      pushState({ ...s, reports });
    }
  };
  const onReportMsg = (p) => {
    addChat({ name: p.name, text: 'denunciou o desenho 🚩', kind: 'sys' });
    if (hostRef.current) registerReport(p.name);
  };
  const jaDenunciei    = !!state?.reports?.includes(name);
  const totalVotantes  = Math.max(0, players.filter(p => p.name !== state?.drawer).length);
  const podeDenunciar  = !isDrawer && state?.phase === 'drawing' && !jaDenunciei;
  const denunciarDesenho = () => {
    if (!podeDenunciar) return;
    chanRef.current?.send({ type: 'broadcast', event: 'report', payload: { name } });
    sfx('pulou');
    onReportMsg({ name });
  };

  /* ── Expulsar jogador (votação democrática) ───────────────────────────────
     Cada voto é um broadcast {alvo, votante} — todo cliente conta local pra
     UI/chat responder na hora. MAS o broadcast é efêmero (sem garantia de
     entrega): se o PRÓPRIO alvo perder um voto por instabilidade de rede,
     a contagem dele local nunca bate o threshold e ele nunca sai — os
     outros veem "foi expulso" no chat, mas a pessoa continua na sala e
     parece "voltar sozinha" (bug relatado pelo usuário). Fix: só o HOST
     decide de verdade e grava em `state.expulsoAtual` (persistido, com
     poll de segurança de 4s — bem mais confiável que broadcast solto); o
     alvo sai reagindo a ESSE estado, não à própria contagem local. O
     broadcast continua valendo como caminho rápido quando tudo funciona. */
  const onKickMsg = (p) => {
    if (!p?.alvo || !p?.votante) return;
    const nomes = new Set(playersRef.current.filter(pl => !pl.isBot).map(pl => pl.name));
    const votos = { ...kickVotesRef.current };
    // Só conta votos de quem AINDA está na sala (descarta voto de quem já saiu).
    let lista = (votos[p.alvo] || []).filter(n => nomes.has(n));
    if (p.remover) {
      lista = lista.filter(n => n !== p.votante);                 // retira o voto
    } else if (nomes.has(p.votante) && !lista.includes(p.votante)) {
      lista.push(p.votante);                                      // adiciona o voto
    }
    votos[p.alvo] = lista;
    kickVotesRef.current = votos;
    setKickVotes(votos);
    // Elegíveis = todos os presentes menos o alvo (o alvo não vota em si).
    const elegiveis = playersRef.current.filter(pl => !pl.isBot && pl.name !== p.alvo).length;
    const bateu = !p.remover && elegiveis > 0 && (lista.length / elegiveis) >= KICK_THRESHOLD;
    if (bateu) {
      addChat({ name: p.alvo, text: 'foi expulso da sala por votação 🚪', kind: 'sys' });
      // limpa os votos desse alvo (a partida continua pros demais)
      const limpo = { ...kickVotesRef.current }; delete limpo[p.alvo];
      kickVotesRef.current = limpo; setKickVotes(limpo);
      if (p.alvo === name) { sfx('pulou'); onLeave?.(); }          // caminho rápido (melhor esforço)
      if (hostRef.current) {                                       // caminho CONFIÁVEL (persistido)
        const s = stateRef.current || {};
        pushState({ ...s, expulsoAtual: { alvo: p.alvo, ts: Date.now() } });
      }
    } else if (p.remover) {
      addChat({ name: p.votante, text: `retirou o voto de expulsar ${p.alvo.split(' ')[0]}`, kind: 'sys' });
    } else {
      addChat({ name: p.votante, text: `votou para expulsar ${p.alvo.split(' ')[0]} (${lista.length}/${Math.ceil(elegiveis * KICK_THRESHOLD)}) 🚪`, kind: 'sys' });
    }
  };
  // O alvo sai assim que vê `expulsoAtual` apontar pro próprio nome — reage
  // ao estado PERSISTIDO (confiável), não ao broadcast (pode ter se perdido).
  const expulsoVistoRef = useRef(null);
  useEffect(() => {
    const alvo = state?.expulsoAtual;
    if (!alvo || alvo.alvo !== name || expulsoVistoRef.current === alvo.ts) return;
    expulsoVistoRef.current = alvo.ts;
    sfx('pulou');
    onLeave?.();
  }, [state?.expulsoAtual, name, onLeave, sfx]);
  // HOST limpa o aviso alguns segundos depois — tempo suficiente pro poll de
  // 4s ter entregado pra todo mundo, mas sem deixar `expulsoAtual` "preso"
  // pra sempre (senão a pessoa seria barrada de novo ao tentar voltar depois).
  useEffect(() => {
    if (!isHost || !state?.expulsoAtual?.ts) return;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s?.expulsoAtual) pushState({ ...s, expulsoAtual: null });
    }, 6000);
    return () => clearTimeout(t);
  }, [isHost, state?.expulsoAtual?.ts, pushState]);
  // Vota OU retira o voto (toggle): se eu já votei nesse alvo, o clique retira.
  const votarExpulsar = (alvo) => {
    if (!alvo || alvo === name) return;
    const jaVotei = !!kickVotesRef.current[alvo]?.includes(name);
    const payload = { alvo, votante: name, remover: jaVotei };
    chanRef.current?.send({ type: 'broadcast', event: 'kickvote', payload });
    onKickMsg(payload);
  };

  /* ── Motor da partida (só o host escreve) ────────────────────────────── */
  const startRound = (queue, scores, round, totalRounds, usadas, themeId, nome, elenco, matchId = null) => {
    const base = stateRef.current || {};
    // O TEMA NUNCA PODE SE PERDER. Antes este objeto era montado do ZERO, sem o
    // estado anterior: bastava `themeId` chegar undefined (ex.: host aperta
    // "Começar" antes do state da sala carregar) pra sala ficar sem tema — o
    // cabeçalho trocava sozinho pra "Geral" e as palavras (inclusive as do botão
    // Pular) passavam a vir do baralho errado. Uma vez perdido, nunca voltava,
    // porque cada rodada repassava o undefined pra seguinte.
    const tema = themeId || base.themeId || GERAL.id;
    const drawer = queue[0];
    const pool0 = themeById(tema).words;
    const livres = pool0.filter(w => !usadas.includes(w));
    const pool = livres.length ? livres : pool0;   // acabou o baralho → recomeça
    const w = pool[Math.floor(Math.random() * pool.length)];
    // Histórico de palavras recentes da SALA — persiste ENTRE partidas (fica no
    // estado). Semeia o baralho da próxima partida (ver startGame) pra não cair
    // sempre nas mesmas palavras; palavras novas, que nunca entraram aqui, saem
    // primeiro. Cap = ~60% do baralho: sobra espaço pra rotacionar sem travar.
    const capRec = Math.min(90, Math.max(20, Math.round(pool0.length * 0.6)));
    const recentes = [...(base.recentes || []).filter(x => x !== w), w].slice(-capRec);
    chanRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
    clearAll();
    pushState({
      ...base,                                     // preserva nome/criador/tema
      nome: nome || base.nome,
      themeId: tema,
      phase: 'drawing', round, drawer, wordEnc: enc(w),
      endsAt: Date.now() + ROUND_MS, hits: [], scores, queue, totalRounds,
      usadas: [...usadas, w],
      recentes,
      hints: 0,
      reports: [], drawerRoundPts: 0,   // zera denúncias e pontos ganhos NESTA rodada
      pulada: false, denunciada: false, // o spread acima traria a marca da rodada anterior
      winMatchId: matchId || base.winMatchId || null,
      winRecorded: false,
      // quem já estava quando a partida começou (+ quem entrou depois e já foi
      // encaixado na fila) — sem isso não dá pra saber quem é "novo"
      elenco: elenco || [...new Set(queue)],
    });
  };
  /* Fim de partida → soma os pontos no ranking geral (só o host grava).
     `rankSalvo` no estado evita somar duas vezes: o motor roda num intervalo e
     o host pode trocar no meio, então sem essa marca a mesma partida entraria
     de novo a cada tick. A soma acontece no Postgres (RPC atômica) porque duas
     salas terminando juntas se sobrescreveriam num update lido-e-escrito aqui. */
  const salvarRanking = (s) => {
    if (!s || s.rankSalvo) return;
    const scores = s.scores || {};
    const nomes = Object.keys(scores).filter(n => !s.bots?.some(bot => bot.name === n));
    if (!nomes.length) return;
    const campeao = nomes.reduce((a, b) => (scores[b] > scores[a] ? b : a), nomes[0]);
    // O ranking é por CONTA: trocar de apelido não pode zerar/dividir os pontos.
    // O placar da partida usa o apelido; aqui traduz de volta pro nome da conta.
    const contaDe = (apelido) => players.find(p => p.name === apelido)?.conta || apelido;
    nomes.forEach((quem) => {
      supabase.rpc('uniko_paint_add_score', {
        p_player: contaDe(quem), p_pontos: scores[quem] || 0, p_venceu: quem === campeao,
      }).then(({ error }) => { if (error) console.error('[uniko-paint] ranking:', error.message); });
    });
  };

  useEffect(() => {
    if (!isHost || !['drawing', 'reveal'].includes(state?.phase) || state?.adminManaged) return;
    const adminsPresentes = players.filter(player => player.isAdmin);
    if (!adminsPresentes.length) return;
    const current = stateRef.current;
    if (!current || current.adminManaged) return;
    const admins = Object.fromEntries(adminsPresentes.map(player => [player.name, true]));
    pushState({ ...current, adminManaged: true, admins: { ...current.admins, ...admins } });
  }, [isHost, players, state?.phase, state?.adminManaged, pushState]);

  useEffect(() => {
    if (!isHost || state?.phase !== 'over' || !state.adminManaged || state.winRecorded) return;
    let alive = true;
    let saving = false;
    const recordWin = async () => {
      if (saving) return;
      saving = true;
      try {
        const current = stateRef.current;
        if (!current?.winMatchId) {
          await pushState({ ...current, winMatchId: crypto.randomUUID() });
          return;
        }
        const placements = Object.entries(current.scores || {})
          .filter(([name]) => !current.bots?.some(bot => bot.name === name))
          .map(([name, score], order) => ({ name, score: Number(score) || 0, order }))
          .sort((a, b) => b.score - a.score || a.order - b.order)
          .map(({ name }) => ({
            name: playersRef.current.find((player) => player.name === name)?.conta || name,
            isAdmin: !!current.admins?.[name],
          }));
        const registrada = await recordUnikoGamesWin({ game: 'paint', matchId: current.winMatchId,
          adminManaged: current.adminManaged === true, placements });
        if (!registrada) return;
        if (!alive) return;
        const latest = stateRef.current;
        if (latest?.phase === 'over' && latest.winMatchId === current.winMatchId && !latest.winRecorded) {
          await pushState({ ...latest, winRecorded: true });
        }
      } catch (e) {
        console.error('[uniko-paint] falha ao registrar vitória na Prisma Store:', e);
      } finally {
        saving = false;
      }
    };
    recordWin();
    const retry = setInterval(recordWin, 15_000);
    return () => { alive = false; clearInterval(retry); };
  }, [isHost, state?.phase, state?.winMatchId, state?.winRecorded, state?.adminManaged, roomId, pushState]);

  const startGame = () => {
    if (!state) return;                 // sem o state da sala não há tema — ver startRound
    const botsDaPartida = state.botsEnabled ? criarBotsDaSala(players, state.botsCount ?? 2) : [];
    const participantesDaPartida = [...players, ...botsDaPartida];
    const ordem = embaralhar(participantesDaPartida.map(p => p.name));
    const queue = Array.from({ length: laps }, () => ordem).flat();
    const winMatchId = crypto.randomUUID();
    const admins = Object.fromEntries(players.map(p => [p.name, !!p.isAdmin]));
    aplicaEstado({ ...state, bots: botsDaPartida, admins, adminManaged: players.some(player => player.isAdmin),
      winMatchId, winRecorded: false });
    // Semeia o baralho da partida com as palavras RECENTES da sala (as das últimas
    // partidas) já marcadas como usadas → elas ficam pro fim e as palavras novas/menos
    // vistas saem primeiro. Assim "tema Geral de novo" não repete as mesmas de sempre.
    const pool0 = themeById(state.themeId).words;
    const recSeed = (state.recentes || []).filter(w => pool0.includes(w));
    startRound(queue, {}, 1, queue.length, recSeed, state.themeId, state.nome, ordem, winMatchId);
  };

  useEffect(() => {
    if (!isHost || state?.phase !== 'drawing') return;
    const chaveRodada = `${state.winMatchId || ''}:${state.round}:${state.drawer}`;
    const desenhistaBot = playersRef.current.find(p => p.isBot && p.name === state.drawer);
    if (!desenhistaBot) return;
    if (desenhoBotRef.current.key !== chaveRodada) desenhoBotRef.current = { key: chaveRodada, enviados: 0 };
    const acoes = desenhoDoBot(dec(state.wordEnc));
    const inicio = desenhoBotRef.current.enviados;
    const timers = acoes.slice(inicio).map((act, i) => setTimeout(() => {
      const atual = stateRef.current;
      if (!hostRef.current || atual?.phase !== 'drawing' || atual.round !== state.round
        || atual.drawer !== state.drawer || atual.winMatchId !== state.winMatchId) return;
      commit(act);
      chanRef.current?.send({ type: 'broadcast', event: 'act', payload: { from: name, act } });
      desenhoBotRef.current.enviados = inicio + i + 1;
    }, 350 + i * 520));
    return () => timers.forEach(clearTimeout);
  // `commit` usa refs do canvas; depender da função recriada reinicia a animação de cada traço.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round, state?.drawer, state?.winMatchId, state?.wordEnc,
      name]);

  useEffect(() => {
    if (!isHost || state?.phase !== 'drawing') return;
    const botsDaRodada = playersRef.current.filter(bot => bot.isBot && bot.name !== state.drawer);
    if (!botsDaRodada.length) return;
    const palavra = dec(state.wordEnc);
    const temaPalavras = themeById(state.themeId).words;
    const erradosUsados = new Set();
    const timers = [];
    const tentarPalpite = (bot, text) => {
      const atual = stateRef.current;
      if (!hostRef.current || atual?.phase !== 'drawing' || atual.round !== state.round
        || atual.drawer === bot.name || atual.winMatchId !== state.winMatchId || atual.hits?.includes(bot.name)) return;
      chanRef.current?.send({ type: 'broadcast', event: 'guess', payload: { name: bot.name, text } });
      onGuessMsg({ name: bot.name, text });
    };
    botsDaRodada.forEach((bot, i) => {
      let errado = '';
      for (let tentativas = 0; tentativas < 12 && !errado; tentativas++) {
        const candidato = temaPalavras[Math.floor(Math.random() * temaPalavras.length)];
        if (norm(candidato) !== norm(palavra) && !quaseLa(candidato, palavra) && !erradosUsados.has(norm(candidato))) {
          errado = candidato;
          erradosUsados.add(norm(candidato));
        }
      }
      if (errado) timers.push(setTimeout(() => tentarPalpite(bot, errado), 2_500 + i * 1_300));
      // Espera as duas dicas automáticas do meio da rodada; com cinco bots, escala até 72s.
      timers.push(setTimeout(() => tentarPalpite(bot, palavra), 60_000 + i * 3_000));
    });
    return () => timers.forEach(clearTimeout);
  // O handler lê o estado atual por refs; recriar este efeito cancelaria os palpites agendados.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.round, state?.drawer, state?.winMatchId, state?.wordEnc,
    state?.themeId, name]);

  useEffect(() => {
    if (!isHost || state?.phase !== 'drawing'
      || !playersRef.current.some(bot => bot.isBot && bot.name === state.drawer)) return;
    const timers = [10_000, 20_000, 30_000].map(delay => setTimeout(() => {
      const atual = stateRef.current;
      const palavra = dec(atual?.wordEnc);
      if (!hostRef.current || atual?.phase !== 'drawing' || atual.round !== state.round
        || atual.drawer !== state.drawer || atual.winMatchId !== state.winMatchId
        || (atual.hints || 0) >= maxHints(palavra)) return;
      pushState({ ...atual, hints: (atual.hints || 0) + 1 });
    }, delay));
    return () => timers.forEach(clearTimeout);
  }, [isHost, state?.phase, state?.round, state?.drawer, state?.winMatchId, state?.wordEnc, pushState]);

  useEffect(() => {
    if (!isHost || !state) return;
    const t = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      // Desenhista sumiu (saiu/fechou) → não deixa a rodada morrer no relógio.
      if (s.phase === 'drawing' && s.drawer && !participantes.some(p => p.name === s.drawer)) {
        pushState({ ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) });
        return;
      }
      if (!s.endsAt || Date.now() < s.endsAt) return;
      if (s.phase === 'drawing') {
        pushState({ ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) });
      } else if (s.phase === 'reveal') {
        // (a transição pra 'over' já grava o ranking — ver salvarRanking)
        // NÃO filtra a fila inteira por quem está "presente agora": uma piscada
        // de conexão (wifi, celular em segundo plano, resync da presence) nesse
        // instante bastava pra sumir com TODAS as vagas futuras da pessoa —
        // mesmo ela continuando a jogar normalmente o resto da partida, porque
        // como já estava no `elenco` nunca era readicionada. Quem realmente saiu
        // já é tratado na entrada de cima ("Desenhista sumiu") quando a vez dele
        // chegar de verdade: a rodada é pulada na hora, sem gastar as próximas.
        const restante = (s.queue || []).slice(1);
        // ACOLHE quem entrou depois do início: sem isso quem chega no meio
        // nunca é sorteado pra desenhar, porque a fila só era montada no começo.
        const elenco = s.elenco || [...new Set(s.queue || [])];
        const novos = participantes.map(p => p.name).filter(n => !elenco.includes(n));
        // NOVOS NA FRENTE, não no fim: a fila tem uma entrada por jogador POR
        // VOLTA (5 pessoas × 3 voltas = 15 rodadas), então quem entrasse no fim
        // só desenharia lá pela rodada 15 — e como as pessoas vão saindo antes
        // disso, a vez dele simplesmente nunca chegava. Na frente, ele desenha
        // já na próxima rodada.
        const queue = [...novos, ...restante];
        if (!queue.length) { salvarRanking(s); pushState({ ...s, phase: 'over', endsAt: null, rankSalvo: true }); }
        else startRound(queue, s.scores || {}, (s.round || 1) + 1,
          (s.totalRounds || 0) + novos.length, s.usadas || [], s.themeId, s.nome,
          [...elenco, ...novos]);
      }
    }, 400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.endsAt, participantes]);

  /* ── Desenho ─────────────────────────────────────────────────────────── */
  const posOf = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
             y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const flush = useCallback(() => {
    if (!pending.current.length) return;
    chanRef.current?.send({ type: 'broadcast', event: 'stroke', payload: { from: name, segs: pending.current } });
    pending.current = [];
  }, [name]);
  // Traços saem em lote a cada 60ms — um send por ponto entope o canal.
  useEffect(() => { const t = setInterval(flush, 60); return () => clearInterval(t); }, [flush]);

  const shapeAct = (a, b) => ({
    // line/rect/circle mantêm os tipos curtos; as novas formas usam o próprio id.
    t: tool === 'line' ? 'l' : tool === 'rect' ? 'r' : tool === 'circle' ? 'c' : tool,
    a, b, c: color, w: size, f: filled && tool !== 'line',
  });
  const sendAct = (a) => {
    commit(a);
    chanRef.current?.send({ type: 'broadcast', event: 'act', payload: { from: name, act: a } });
  };
  /* UM DEDO POR VEZ. No celular, encostar a palma (ou o outro polegar) dispara
     um pointerdown NOVO no meio do traço: sem isto, o segundo toque começava
     outro traço e os pontos dos dois dedos entravam no mesmo segmento, riscando
     o desenho de lado a lado. Guardamos o pointerId do dedo que está desenhando
     e ignoramos todo o resto até ele soltar. */
  const down = (e) => {
    if (!isDrawer || drag.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = posOf(e);
    if (tool === 'fill') { sendAct({ t: 'f', p, c: color }); return; }
    if (TOOLS.find(x => x.id === tool)?.shape) { drag.current = { a: p, b: p, id: e.pointerId }; return; }
    const seg = { start: true, p, c: color, w: size, e: tool === 'eraser' };
    drag.current = { free: true, id: e.pointerId };
    applySeg(seg); pending.current.push(seg);
  };
  const move = (e) => {
    if (!isDrawer || !drag.current || drag.current.id !== e.pointerId) return;
    const p = posOf(e);
    if (drag.current.free) {
      const seg = { start: false, p };
      applySeg(seg); pending.current.push(seg);
    } else {
      drag.current.b = p;
      blit(shapeAct(drag.current.a, p));    // preview sem commitar
    }
  };
  const up = (e) => {
    const d = drag.current;
    if (!d) return;
    if (e && d.id !== e.pointerId) return;   // soltou OUTRO dedo, não o que desenha
    drag.current = null;
    if (d.free) { flush(); return; }
    sendAct(shapeAct(d.a, d.b));
  };
  const doClear = () => { if (!isDrawer) return; clearAll(); chanRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} }); };
  const doUndo  = () => { if (!isDrawer) return; acts.current.pop(); replay(); chanRef.current?.send({ type: 'broadcast', event: 'undo', payload: {} }); };
  const darDica = () => {
    const s = stateRef.current;
    if (!isDrawer || !s || revelar >= maxHints(word)) return;
    pushState({ ...s, hints: (s.hints || 0) + 1 });
  };

  /* ── Pular a VEZ ─────────────────────────────────────────────────────────
     Abre mão de desenhar: a rodada encerra na hora e passa pro próximo da fila.
     Quem pula não desenha e não pontua (o desenhista só ganharia pelos acertos,
     que não vão existir). Regra: NÃO dá pra pular depois que alguém já acertou —
     isso apagaria os pontos de quem acertou.
     Quem escreve aqui é o DESENHISTA, não o host — mesmo caminho do "Dar dica",
     já que a rodada é dele. O host cuida de avançar a fila normalmente, como faz
     quando o tempo acaba. */
  const podePular = isDrawer && state?.phase === 'drawing' && !(state?.hits?.length);
  const pularVez = () => {
    const s = stateRef.current;
    if (!isDrawer || !s || s.phase !== 'drawing' || s.hits?.length) return;
    chanRef.current?.send({ type: 'broadcast', event: 'pulou', payload: { name } });
    addChat({ name, text: 'passou a vez ⏭', kind: 'sys' });
    sfx('pulou');
    setConfirmPular(false);
    // Vira 'reveal' — o host avança pro próximo daí, igual ao fim do tempo.
    pushState({
      ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS,
      lastWord: dec(s.wordEnc), pulada: true,
    });
  };

  /* ── Canal da sala (depois das funções que os handlers usam — TDZ) ───── */
  useEffect(() => {
    const ch = supabase.channel(`uniko-paint-room-${roomId}`);
    chanRef.current = ch;
    ch.on('broadcast', { event: 'stroke' }, ({ payload }) => {
      if (payload?.from === name) return;      // meus traços já estão na tela
      (payload?.segs || []).forEach(applySeg);
    });
    ch.on('broadcast', { event: 'act' }, ({ payload }) => {
      if (payload?.from === name) return;
      commit(payload.act);
    });
    ch.on('broadcast', { event: 'clear' }, () => clearAll());
    ch.on('broadcast', { event: 'undo' }, () => { acts.current.pop(); replay(); });
    ch.on('broadcast', { event: 'sync-req' }, () => {
      const current = stateRef.current;
      const botDrawing = hostRef.current && current?.bots?.some(p => p.name === current.drawer);
      if (!isDrawerRef.current && !botDrawing) return;        // o host também mantém o desenho automático dos bots
      ch.send({ type: 'broadcast', event: 'sync-all', payload: { acts: acts.current } });
    });
    ch.on('broadcast', { event: 'sync-all' }, ({ payload }) => {
      if (isDrawerRef.current) return;
      acts.current = payload?.acts || []; replay();
    });
    ch.on('broadcast', { event: 'guess' }, ({ payload }) => onGuessMsg(payload));
    ch.on('broadcast', { event: 'report' }, ({ payload }) => onReportMsg(payload));
    ch.on('broadcast', { event: 'kickvote' }, ({ payload }) => onKickMsg(payload));
    ch.on('broadcast', { event: 'pulou' }, ({ payload }) => {
      if (payload?.name === name) return;         // quem pulou já viu o aviso
      addChat({ name: payload.name, text: 'passou a vez ⏭', kind: 'sys' });
      sfx('pulou');
    });
    ch.subscribe((st) => {
      if (st !== 'SUBSCRIBED') return;
      ch.send({ type: 'broadcast', event: 'sync-req', payload: { from: name } });
    });
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, name]);

  /* O buffer interno acompanha a proporção do card visível para o papel ocupar
     toda a área sem deformar o desenho. O ref callback também reinicializa o
     canvas quando a árvore muda no celular, sem desmontar a partida. */
  const attachCanvas = useCallback((cv) => {
    canvasResizeRef.current?.();
    canvasResizeRef.current = null;
    canvasRef.current = cv;
    if (!cv) return;
    const ajustarCanvas = () => {
      const rect = cv.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const width = CW;
      const height = Math.max(1, Math.round(width * rect.height / rect.width));
      const tamanho = canvasSizeRef.current;
      if (tamanho.width === width && tamanho.height === height && cv.width === width && cv.height === height) return;
      canvasSizeRef.current = { width, height };
      cv.width = width; cv.height = height;
      if (baseRef.current) {
        baseRef.current.width = width;
        baseRef.current.height = height;
      }
      replay();
    };
    ajustarCanvas();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(ajustarCanvas);
      observer.observe(cv);
      canvasResizeRef.current = () => observer.disconnect();
    } else {
      window.addEventListener('resize', ajustarCanvas);
      canvasResizeRef.current = () => window.removeEventListener('resize', ajustarCanvas);
    }
    // O callback usa refs estáveis, então a closure do primeiro render é suficiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── UI ──────────────────────────────────────────────────────────────── */
  const darkRoom = !!T.dark;
  const cardBg = darkRoom ? '#1E293B' : '#fff';
  const roomText = darkRoom ? '#F1F5F9' : ROOM_TEXT;
  const roomMuted = darkRoom ? '#B7C4D8' : ROOM_MUTED;
  const roomBorder = darkRoom ? '#46546A' : ROOM_BORDER;
  const roomSub = darkRoom ? '#29384F' : ROOM_SUB;
  const roomInput = darkRoom ? '#172235' : ROOM_SUB;
  const roomShadow = darkRoom ? '0 5px 18px rgba(0,0,0,.32)' : ROOM_SHADOW;
  const roomAccent = darkRoom ? '#8DB8FF' : ROOM_BLUE;
  const tintaSobrePapel = roomText;
  const tintaSecundariaSobrePapel = roomMuted;
  const ranked = useMemo(() => {
    const sc = state?.scores || {};
    return [...participantes].map(p => ({ ...p, pts: sc[p.name] || 0 })).sort((a, b) => b.pts - a.pts);
  }, [participantes, state?.scores]);
  const temaAtual = themeById(state?.themeId);
  const noLobby = !state || state.phase === 'lobby' || state.phase === 'over';
  const jogadoresDaRodada = participantes.filter(p => p.name !== state?.drawer);
  const todosAcertaram = state?.phase === 'reveal' && jogadoresDaRodada.length > 0
    && jogadoresDaRodada.every(p => state.hits?.includes(p.name));
  const semAcertos = state?.phase === 'reveal' && !state.hits?.length
    && !state.pulada && !state.denunciada;

  /* Botão de ferramenta. No celular vai SÓ o ícone (o nome fica no title): o
     rótulo embaixo obriga o botão a ter 54px de largura, e aí as 10 ferramentas
     não cabem na tela — sem o texto o alvo de toque fica maior, não menor. */
  const btnTool = (t) => {
    const Ico = ICON_OF[t.id];
    const on = tool === t.id;
    return (
      <button key={t.id} onClick={() => setTool(t.id)} title={t.nome} aria-label={t.nome}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          width: compacto ? undefined : 54, height: compacto ? 42 : undefined, minWidth: compacto ? 42 : undefined,
          padding: compacto ? 0 : '8px 4px',
          borderRadius: 10, cursor: 'pointer', transition: 'all .12s', touchAction: 'manipulation',
          border: on ? `2px solid ${A}` : `1px solid ${roomBorder}`,
          background: on ? `${A}18` : roomSub,
          color: on ? A : roomText, transform: (on && !compacto) ? 'translateY(-1px)' : 'none' }}>
        <Ico size={compacto ? 21 : 20} />
        {!compacto && <span style={{ fontSize: 9.5, fontWeight: 700 }}>{t.nome}</span>}
      </button>
    );
  };

  /* ═══ PEDAÇOS DA TELA ═════════════════════════════════════════════════════
     Os mesmos blocos, montados de dois jeitos: três colunas no computador e
     empilhado no celular. Ficam em variáveis (e não duplicados nos dois
     layouts) pra não nascer "a versão mobile que esqueceram de atualizar". */

  /* Jogadores em coluna — barra lateral no computador, gaveta no celular. */
  const listaJogadores = ranked.map((p, i) => {
    const desenhando = state?.phase === 'drawing' && state?.drawer === p.name;
    const acertou = state?.hits?.includes(p.name);
    return (
      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 11,
        background: desenhando ? `${A}14` : 'transparent', marginBottom: 3 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={p.photo || '/UNIKO_NEW.png'} alt=""
            style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover',
              border: `2.5px solid ${desenhando ? A : acertou ? '#28a060' : 'transparent'}`,
              background: roomSub, boxShadow: desenhando ? `0 0 0 3px ${A}22` : 'none' }} />
          {i === 0 && (state?.scores?.[p.name] > 0) && (
            <div style={{ position: 'absolute', top: -7, right: -5, color: '#F0B429' }}><IcoCrown size={16} /></div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: p.name === name ? 800 : 700, color: roomText,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
            {p.isBot ? `🤖 ${p.name.replace('Bot Uniko ', 'Bot ')}` : p.name.split(' ')[0]}{p.name === name && ' (você)'}
          </div>
          <div style={{ fontSize: 11.5, color: roomMuted, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <b style={{ color: roomText, fontWeight: 700 }}>{p.pts}</b> pts
            {desenhando && <span style={{ color: A, fontWeight: 700 }}>• desenhando</span>}
            {acertou && <span style={{ color: '#28a060', fontWeight: 700 }}>• acertou</span>}
            {p.isBot && <span>• automático</span>}
            {p.name === host && <span title="Host da partida" style={{ opacity: .6 }}>• host</span>}
          </div>
        </div>
        {/* Expulsar (voto democrático) — só pra outros jogadores */}
        {!p.isBot && p.name !== name && players.length >= 3 && (() => {
          const votos = kickVotes[p.name] || [];
          const eleg  = Math.max(1, players.filter(pl => pl.name !== p.name).length);
          const alvo  = Math.ceil(eleg * KICK_THRESHOLD);
          const votei = votos.includes(name);
          return (
            <button onClick={() => votarExpulsar(p.name)}
              title={votei ? `Clique para RETIRAR seu voto de expulsar ${p.name.split(' ')[0]}` : `Votar para expulsar ${p.name.split(' ')[0]} da sala`}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
                padding: compacto ? '9px 11px' : '4px 7px', borderRadius: 8,
                border: `1px solid ${votei ? '#E63946' : votos.length ? '#E6394655' : roomBorder}`,
                background: votei ? '#E6394622' : votos.length ? '#E6394610' : 'transparent',
                color: votei ? '#E63946' : roomMuted, cursor: 'pointer', touchAction: 'manipulation',
                fontSize: compacto ? 13 : 11, fontWeight: 700, lineHeight: 1 }}>
              {votei ? '↩' : '🚪'}{votos.length > 0 ? <span>{votos.length}/{alvo}</span> : null}
            </button>
          );
        })()}
      </div>
    );
  });

  /* Faixa horizontal de jogadores — o que sobra da barra lateral no celular.
     Um toque abre a gaveta com a lista inteira (é lá que ficam os votos de
     expulsar, que não cabem num chip de 100px). */
  const stripJogadores = (
    <div className="up-sembarra" onClick={() => setSheetJog(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 7, overflowX: 'auto', flexShrink: 0,
        padding: '0 2px', cursor: 'pointer' }}>
      {ranked.map((p, i) => {
        const desenhando = state?.phase === 'drawing' && state?.drawer === p.name;
        const acertou = state?.hits?.includes(p.name);
        return (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '4px 10px 4px 4px', borderRadius: 999,
            background: desenhando ? `${A}1e` : acertou ? '#28a06014' : roomSub,
            border: `1px solid ${desenhando ? A : acertou ? '#28a06055' : roomBorder}` }}>
            <img src={p.photo || '/UNIKO_NEW.png'} alt=""
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: roomSub }} />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: roomText, maxWidth: 76,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(i === 0 && state?.scores?.[p.name] > 0) ? '👑 ' : ''}{p.isBot ? `🤖 ${p.name.replace('Bot Uniko ', 'Bot ')}` : p.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700,
                color: desenhando ? A : acertou ? '#28a060' : roomMuted }}>
                {desenhando ? 'desenhando' : acertou ? 'acertou' : `${p.pts} pts`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* A palavra (ou os tracinhos) — mesmo miolo nos dois layouts. */
  const palavraDaRodada = isDrawer ? <span style={{ letterSpacing: '.02em' }}>{word}</span> : (
    <>
      {/* Cada palavra é um bloco à parte, com um gap BEM maior entre
          blocos do que o letterSpacing usado DENTRO de cada palavra —
          é essa diferença de espaçamento que deixa claro onde tem um
          espaço de verdade (ex.: "café da manhã" vira 3 blocos bem
          separados, não uma sequência única de traços). Um <span> só
          com espaço normal não bastaria: o HTML colapsa espaços
          repetidos e as palavras virariam um bloco só. */}
      <span style={{ display: 'flex', alignItems: 'baseline', gap: compacto ? 12 : 20, flexWrap: 'wrap' }}>
        {maskParts(word, revelar).map((g, i) => (
          <span key={i} style={{ letterSpacing: '.18em', whiteSpace: 'nowrap' }}>{g.join(' ')}</span>
        ))}
      </span>
      <span style={{ fontSize: 11, color: roomMuted, fontWeight: 600, letterSpacing: 0 }}>
        ({contaLetras(word)} letras
        {maskParts(word).length > 1 ? `, ${maskParts(word).length} palavras` : ''})
      </span>
    </>
  );

  /* Ações da rodada: dica/pular (quem desenha) e denunciar (quem adivinha).
     `soIcone` é pra barra de ferramentas do celular, onde o rótulo não cabe. */
  const btnDica = (soIcone) => isDrawer && (
    <button className="up-btn" onClick={darDica} disabled={revelar >= maxHints(word)} title="Revelar uma letra"
      aria-label="Dar dica"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0,
        height: compacto ? 44 : undefined, minWidth: soIcone ? 44 : undefined,
        padding: soIcone ? 0 : (compacto ? '8px 13px' : '6px 12px'), borderRadius: soIcone ? 11 : 999,
        border: `1px solid ${revelar >= maxHints(word) ? roomBorder : A}`,
        cursor: revelar >= maxHints(word) ? 'not-allowed' : 'pointer', touchAction: 'manipulation',
        background: revelar >= maxHints(word) ? 'transparent' : `${A}14`,
        color: revelar >= maxHints(word) ? roomMuted : A, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <IcoBulb size={soIcone ? 18 : 13} />{soIcone ? null : (pequeno ? 'Dica' : 'Dar dica')}
    </button>
  );
  const btnPular = (soIcone) => isDrawer && (
    /* Dois cliques de propósito: pular custa a vez INTEIRA (não
       desenha e não pontua), então um clique sem querer seria caro. */
    <button className="up-btn" onClick={() => (confirmPular ? pularVez() : setConfirmPular(true))}
      disabled={!podePular} onBlur={() => setConfirmPular(false)} aria-label="Pular a vez"
      title={state?.hits?.length ? 'Alguém já acertou — não dá mais pra pular'
        : 'Passar a vez pro próximo (você não desenha nem pontua nesta rodada)'}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0,
        height: compacto ? 44 : undefined, minWidth: (soIcone && !confirmPular) ? 44 : undefined,
        padding: (soIcone && !confirmPular) ? 0 : (compacto ? '8px 13px' : '6px 12px'),
        borderRadius: soIcone ? 11 : 999,
        border: `1px solid ${!podePular ? roomBorder : confirmPular ? UP.red : UP.orange}`,
        cursor: podePular ? 'pointer' : 'not-allowed', touchAction: 'manipulation',
        background: !podePular ? 'transparent' : confirmPular ? `${UP.red}18` : `${UP.orange}14`,
        color: !podePular ? roomMuted : confirmPular ? UP.red : UP.orange,
        fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <IcoSkip size={soIcone ? 18 : 13} />
      {confirmPular ? 'Confirmar?' : (soIcone ? null : (pequeno ? 'Pular' : 'Pular vez'))}
    </button>
  );
  const btnDenunciar = !isDrawer && (
    <button className="up-btn" onClick={denunciarDesenho} disabled={!podeDenunciar}
      title={jaDenunciei ? 'Você já denunciou este desenho'
        : 'Denunciar desenho impróprio ou fora do tema — com votos suficientes, a rodada encerra e quem desenhou não pontua'}
      style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        padding: compacto ? '8px 13px' : '6px 12px', borderRadius: 999,
        border: `1px solid ${jaDenunciei ? roomBorder : UP.red}`,
        cursor: podeDenunciar ? 'pointer' : 'not-allowed', touchAction: 'manipulation',
        background: jaDenunciei ? 'transparent' : `${UP.red}14`,
        color: jaDenunciei ? roomMuted : UP.red, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <IcoFlag size={13} />{jaDenunciei ? 'Denunciado' : 'Denunciar'}
      {totalVotantes > 0 && ` (${state?.reports?.length || 0}/${totalVotantes})`}
    </button>
  );
  const relogio = (
    <div className={secsLeft <= 5 ? 'up-urgent' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 999,
        background: secsLeft <= 10 ? '#E6394622' : roomSub, transition: 'background .3s, color .3s',
        color: secsLeft <= 10 ? '#E63946' : roomText, fontWeight: 800, fontSize: 13.5,
        minWidth: pequeno ? 44 : 54, justifyContent: 'center', flexShrink: 0 }}>
      {secsLeft}s
    </div>
  );

  /* Quando o layout é empilhado, dica/pular moram na BARRA DE FERRAMENTAS (que
     só quem desenha vê) — assim a barra de status cabe numa linha só e sobra
     altura pro desenho. Nos 3 colunas elas ficam aqui mesmo. */
  const acoesNaStatus = empilhado ? btnDenunciar : <>{btnDica()}{btnPular()}{btnDenunciar}</>;

  /* Barra de status. Só quebra em duas linhas no CELULAR — num tablet cabe tudo
     numa linha, e quebrar lá era gastar altura à toa. */
  const barraStatus = (
    <div style={{ background: cardBg, border: `1px solid ${roomBorder}`, borderRadius: compacto ? 10 : 12,
      padding: compacto ? '7px 9px' : '9px 14px', display: 'flex', alignItems: 'center',
      gap: compacto ? 8 : 12, flexWrap: pequeno ? 'wrap' : 'nowrap', boxShadow: roomShadow, flexShrink: 0 }}>
      {state?.phase === 'drawing' ? (
        <>
          <div style={{ fontSize: 12, color: roomMuted, whiteSpace: 'nowrap' }}>
            {pequeno ? `${state.round}${state.totalRounds ? `/${state.totalRounds}` : ''}`
                     : `Rodada ${state.round}${state.totalRounds ? ` de ${state.totalRounds}` : ''}`}
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-brand)', fontSize: pequeno ? 17 : 20,
            fontWeight: 800, color: roomText, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            {palavraDaRodada}
          </div>
          {relogio}
          {acoesNaStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', flexShrink: 0,
              flexBasis: pequeno ? '100%' : 'auto', justifyContent: pequeno ? 'center' : 'flex-end' }}>
              {acoesNaStatus}
            </div>
          )}
        </>
      ) : (
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: roomMuted, fontWeight: 600 }}>
          {state?.phase === 'reveal' ? <>A palavra era <b style={{ color: A }}>{state.lastWord}</b>
            {state.denunciada && <span style={{ color: UP.red, fontWeight: 700 }}> · 🚩 denunciado</span>}</>
            : state?.phase === 'over' ? 'Fim de jogo!'
            : `Aguardando jogadores (mínimo ${MIN_PLAYERS})`}
        </div>
      )}
    </div>
  );

  /* O canvas e tudo que aparece por cima dele. */
  const areaCanvas = (extra) => (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: compacto ? 10 : 14, overflow: 'hidden',
      border: `1px solid ${roomBorder}`, boxShadow: roomShadow,
      /* O papel branco ocupa todo o card. Os pontos dos traços são normalizados
         pela caixa visível em posOf(), então desenho local e remoto acompanham
         o tamanho integral da área. */
      background: roomSub,
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...extra }}>
      <canvas ref={attachCanvas}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
        style={{ width: '100%', height: '100%', display: 'block',
          background: '#fff', touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none',
          WebkitTouchCallout: 'none',
          cursor: isDrawer ? (tool === 'fill' ? 'cell' : 'crosshair') : 'default' }} />

      {state?.phase !== 'drawing' && (
        <div className="up-scroll up-result" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: compacto ? 9 : 12, textAlign: 'center',
          padding: compacto ? 14 : 20, overflowY: 'auto',
          background: darkRoom ? 'rgba(24,33,49,.95)' : 'rgba(255,255,255,.9)' }}>
          {SPLATS_HEADER.map((s, i) => <Splat key={i} {...s}
            cor={[UP.cyan, UP.yellow, UP.pink, UP.lime, UP.purple][i]}
            className="up-result-splat" style={{ animationDelay: `${i * 0.1}s` }} />)}
          <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: compacto ? 9 : 12 }}>
          <Mascote size={pequeno ? 72 : 112} halo big />
          {state?.phase === 'over' ? (
            <>
              <div className="up-overlay-title up-result-title" style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 23 : 30,
                fontWeight: 900 }}>
                FIM DE JOGO!
              </div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 18 : 21, fontWeight: 800, color: tintaSobrePapel }}>
                🏆 {ranked[0]?.name?.split(' ')[0] || '—'} venceu!
              </div>
              <div style={{ fontSize: 13, color: tintaSecundariaSobrePapel }}>
                {ranked.slice(0, 3).map((p, i) => `${i + 1}º ${p.name.split(' ')[0]} — ${p.pts} pts`).join('   ·   ')}
              </div>
            </>
          ) : state?.phase === 'reveal' ? (
            <div style={{ textAlign: 'center' }}>
              <div className="up-overlay-title up-result-title" style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 22 : 29,
                fontWeight: 900, marginBottom: 8 }}>
                {todosAcertaram ? 'OBRA DE ARTE!' : semAcertos ? 'TEMPO ESGOTADO!' :
                  state.pulada ? 'PASSOU A VEZ!' : state.denunciada ? 'RODADA ENCERRADA!' : 'FIM DA RODADA!'}
              </div>
              {todosAcertaram && (
                <div style={{ fontSize: 14, color: tintaSecundariaSobrePapel, fontWeight: 700, marginBottom: 8 }}>
                  Todos acertaram a resposta!
                </div>
              )}
              {state.pulada && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#A64B00', marginBottom: 5 }}>
                  ⏭ {state.drawer?.split(' ')[0]} passou a vez
                </div>
              )}
              {state.denunciada && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#B42332', marginBottom: 5 }}>
                  🚩 desenho denunciado — {state.drawer?.split(' ')[0]} não pontuou nesta rodada
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 18 : 21, fontWeight: 800, color: tintaSobrePapel }}>
                A palavra era <span style={{ color: roomAccent }}>{state.lastWord}</span>
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 17 : 19, fontWeight: 800, color: tintaSobrePapel }}>
              {state?.nome || 'Sala'}
            </div>
          )}

          {/* O tema é o da sala, definido na criação — não se vota. */}
          {noLobby && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999,
              background: roomSub, border: `1px solid ${roomBorder}` }}>
              <span style={{ fontSize: 16 }}>{temaAtual.emoji}</span>
              <span style={{ fontSize: 12.5, color: tintaSobrePapel, fontWeight: 700 }}>Tema: {temaAtual.nome}</span>
            </div>
          )}

          {noLobby && (
            isHost ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px',
                    borderRadius: 10, border: `1px solid ${state?.botsEnabled ? roomAccent : roomBorder}`,
                    background: state?.botsEnabled ? `${roomAccent}14` : 'transparent',
                    color: tintaSobrePapel, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!state?.botsEnabled}
                      onChange={(e) => pushState({ ...state, botsEnabled: e.target.checked, botsCount: state.botsCount ?? 2 })}
                      style={{ width: 16, height: 16, accentColor: roomAccent, cursor: 'pointer' }} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Adicionar bots</span>
                  </label>
                  {state?.botsEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11.5, color: tintaSecundariaSobrePapel }}>Quantidade:</span>
                      {BOT_OPTIONS.map(total => (
                        <button key={total} onClick={() => pushState({ ...state, botsCount: total })}
                          aria-pressed={(state.botsCount ?? 2) === total}
                          style={{ minWidth: 29, padding: '5px 8px', borderRadius: 8, cursor: 'pointer',
                            border: (state.botsCount ?? 2) === total ? `1.5px solid ${roomAccent}` : `1px solid ${roomBorder}`,
                            background: (state.botsCount ?? 2) === total ? `${roomAccent}18` : 'transparent',
                            color: (state.botsCount ?? 2) === total ? roomAccent : tintaSobrePapel,
                            fontSize: 12, fontWeight: 800, touchAction: 'manipulation' }}>
                          {total}
                        </button>
                      ))}
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: tintaSecundariaSobrePapel, fontWeight: 600 }}>Cada um desenha</span>
                  {LAP_OPTIONS.map(n => (
                    <button key={n} onClick={() => setLaps(n)}
                      style={{ minWidth: compacto ? 38 : 30, padding: compacto ? '8px 10px' : '5px 9px', borderRadius: 8,
                        cursor: 'pointer', fontSize: 12.5, fontWeight: 700, touchAction: 'manipulation',
                        border: laps === n ? `1.5px solid ${roomAccent}` : `1px solid ${roomBorder}`,
                        background: laps === n ? (darkRoom ? '#294976' : '#EAF2FF') : 'transparent',
                        color: laps === n ? roomAccent : tintaSobrePapel }}>
                      {n}×
                    </button>
                  ))}
                  <span style={{ fontSize: 11.5, color: tintaSecundariaSobrePapel }}>
                    = {laps * Math.max(participantes.length, 1)} rodadas
                    {' '}(~{Math.round(laps * Math.max(participantes.length, 1) * (ROUND_MS + REVEAL_MS) / 60000)} min)
                  </span>
                </div>
                {/* `!state` também trava: começar antes do state da sala
                    carregar deixava a partida SEM TEMA (ver startRound). */}
                <button className="up-btn" onClick={startGame} disabled={participantes.length < MIN_PLAYERS || !state}
                  style={{ padding: compacto ? '13px 30px' : '11px 26px', borderRadius: 999, border: 'none',
                    background: (participantes.length < MIN_PLAYERS || !state) ? '#94A3B8' : 'linear-gradient(135deg, #287BFA, #104FCB)',
                    color: '#fff', fontSize: compacto ? 15 : 14, fontWeight: 800, touchAction: 'manipulation',
                    cursor: (participantes.length < MIN_PLAYERS || !state) ? 'not-allowed' : 'pointer',
                    boxShadow: (participantes.length < MIN_PLAYERS || !state) ? 'none' : `0 6px 18px ${AG}` }}>
                  {!state ? 'Carregando sala...' : state.phase === 'over' ? 'Jogar de novo' : 'Começar partida'}
                </button>
                {participantes.length < MIN_PLAYERS && (
                  <div style={{ fontSize: 12, color: tintaSecundariaSobrePapel }}>
                    {state?.botsEnabled
                      ? 'O jogo precisa de pelo menos 1 participante humano para iniciar.'
                      : `Chame mais gente ou ative os bots. São necessários ${MIN_PLAYERS} jogadores.`}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: tintaSecundariaSobrePapel, fontStyle: 'italic' }}>
                Esperando {host?.split(' ')[0] || 'o host'} começar a partida...
              </div>
            )
          )}
          </div>
        </div>
      )}

      {state?.phase === 'drawing' && !isDrawer && (
        <div className="up-drawing-badge" style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 12px', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#fff',
          fontSize: 11.5, fontWeight: 700, pointerEvents: 'none' }}>
          {iHit ? '✓ você acertou!' : `${state.drawer?.split(' ')[0]} está desenhando`}
        </div>
      )}

      {/* CELULAR em pé: o desenho é 16:10, então a largura da tela é o teto do
          tamanho dele — deitado cabe quase o dobro. Num tablet em pé já sobra
          espaço, então o aviso não aparece. */}
      {pequeno && !paisagem && state?.phase === 'drawing' && isDrawer && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          padding: '5px 12px', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#fff',
          fontSize: 11, fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          📱↻ Vire o celular pra desenhar maior
        </div>
      )}

      {/* ── "Agora é a vez de fulano" — Uniko grande + nome ── */}
      {vez && (
        <div className="up-turn" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: pequeno ? 10 : 16,
          pointerEvents: 'none', overflow: 'hidden', background: `linear-gradient(160deg, ${A}f2, ${A2}ee 60%, ${A3}f2)` }}>
          <div className="up-turn-shine" />
          {SPLATS_HEADER.map((s, i) => <Splat key={i} {...s}
            cor={[UP.cyan, UP.yellow, UP.lime, UP.orange, '#fff'][i]}
            className="up-result-splat" style={{ animationDelay: `${i * 0.1}s` }} />)}
          <div style={{ position: 'absolute', inset: 0, opacity: .2, zIndex: 0,
            background: 'radial-gradient(circle at 20% 25%, #fff 0%, transparent 40%), radial-gradient(circle at 80% 75%, #fff 0%, transparent 38%)' }} />
          <div className="up-overlay-title up-turn-title" style={{ zIndex: 1, fontFamily: 'var(--font-brand)', fontSize: pequeno ? 20 : 26,
            fontWeight: 900 }}>
            NOVA RODADA!
          </div>
          {/* Avatar gigante com anéis pulsando */}
          <div className="up-avatar" style={{ position: 'relative', zIndex: 1, color: '#fff' }}>
            <div className="up-ring" />
            <div className="up-ring up-ring2" />
            <img src={vez.photo || MASCOTE} alt=""
              style={{ width: pequeno ? 86 : 132, height: pequeno ? 86 : 132, borderRadius: '50%', objectFit: 'cover',
                border: '5px solid rgba(255,255,255,.95)', background: '#fff',
                boxShadow: '0 14px 44px rgba(0,0,0,.4)' }} />
          </div>
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontSize: pequeno ? 11.5 : 13, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.14em',
              textTransform: 'uppercase', marginBottom: 5 }}>
              {vez.eu ? 'Sua vez de desenhar!' : 'Agora é a vez de'}
            </div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 27 : 38, fontWeight: 800, color: '#fff',
              textShadow: '0 4px 20px rgba(0,0,0,.35)', lineHeight: 1.1 }}>
              {vez.eu ? name.split(' ')[0] : vez.nome.split(' ')[0]}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.9)', marginTop: 8 }}>
              {vez.eu ? 'Capriche — a galera tá esperando 🎨' : 'Adivinhe a palavra no chat!'}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Ferramentas ────────────────────────────────────────────────────────
     Duas barras diferentes, e não uma só "responsiva": a completa (computador
     e tablet deitado) mostra tudo aberto; a COMPACTA (empilhado) mostra uma
     linha de ações + as cores, e joga ferramentas/espessura em gavetas. A barra
     completa no celular ocupava ~220px de ALTURA — mais do que o próprio
     desenho, que é a queixa de "a barra está tampando a tela de pintar". */
  const paletaCores = (dim) => (
    <div className="up-sembarra" style={{ display: 'grid', gap: 5, flexShrink: 0, overflowX: 'auto',
      ...(compacto ? { gridTemplateRows: 'repeat(2, auto)', gridAutoFlow: 'column', gridAutoColumns: dim }
                   : { gridTemplateColumns: 'repeat(6, 1fr)' }) }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => { setColor(c); if (tool === 'eraser') setTool('brush'); }} title={c}
          style={{ width: compacto ? 28 : 26, height: compacto ? 28 : 26, borderRadius: '50%', background: c,
            cursor: 'pointer', transition: 'transform .12s', touchAction: 'manipulation',
            border: color === c ? `3px solid ${A}` : `1px solid ${roomBorder}`,
            transform: color === c ? 'scale(1.12)' : 'none' }} />
      ))}
    </div>
  );
  const btnPreencher = (tool === 'rect' || tool === 'circle' || tool === 'tri' || tool === 'hex' || tool === 'star' || tool === 'heart') && (
    <button onClick={() => setFilled(f => !f)} title="Preencher a forma"
      style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        height: compacto ? 44 : undefined, padding: compacto ? '0 11px' : '9px 12px', borderRadius: 11,
        cursor: 'pointer', touchAction: 'manipulation',
        border: filled ? `2px solid ${A}` : `1px solid ${roomBorder}`,
        background: filled ? `${A}14` : 'transparent', color: filled ? A : roomText, fontSize: 12, fontWeight: 700 }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid currentColor',
        background: filled ? 'currentColor' : 'transparent' }} />
      {filled ? 'Cheio' : 'Vazado'}
    </button>
  );
  const btnDesfazer = (
    <button onClick={doUndo} title="Desfazer" aria-label="Desfazer"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        flexShrink: 0, width: compacto ? 44 : 54, height: compacto ? 44 : undefined,
        padding: compacto ? 0 : '8px 4px', borderRadius: 11, cursor: 'pointer', touchAction: 'manipulation',
        border: `1px solid ${roomBorder}`, background: 'transparent', color: roomText }}>
      <IcoUndo size={20} />{!compacto && <span style={{ fontSize: 9.5, fontWeight: 700 }}>Desfazer</span>}
    </button>
  );
  const btnLimpar = (
    <button onClick={doClear} title="Limpar tudo" aria-label="Limpar tudo"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        flexShrink: 0, width: compacto ? 44 : 54, height: compacto ? 44 : undefined,
        padding: compacto ? 0 : '8px 4px', borderRadius: 11, cursor: 'pointer', touchAction: 'manipulation',
        border: '1px solid #E6394640', background: '#E6394610', color: '#E63946' }}>
      <IcoTrash size={20} />{!compacto && <span style={{ fontSize: 9.5, fontWeight: 700 }}>Limpar</span>}
    </button>
  );
  const bolinhaTamanho = (s, cor) => (
    <div style={{ width: Math.min(s, 22), height: Math.min(s, 22), borderRadius: '50%', background: cor || roomText }} />
  );
  const grupoTamanhos = (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
      {SIZES.map(s => (
        <button key={s} onClick={() => setSize(s)} title={`${s}px`}
          style={{ width: compacto ? 44 : 38, height: compacto ? 44 : 38, borderRadius: 9, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', flexShrink: 0,
            border: size === s ? `2px solid ${A}` : `1px solid ${roomBorder}`,
            background: size === s ? `${A}14` : 'transparent' }}>
          {bolinhaTamanho(s)}
        </button>
      ))}
    </div>
  );
  const divisor = <div style={{ width: 1, height: 40, background: roomBorder, flexShrink: 0 }} />;

  const barraCompleta = (
    <div className="up-sembarra" style={{ background: cardBg, border: `1px solid ${roomBorder}`,
      borderRadius: compacto ? 10 : 12, padding: compacto ? '8px 10px' : '9px 12px', boxShadow: roomShadow, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: compacto ? 8 : 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{TOOLS.map(btnTool)}</div>
      {divisor}
      {paletaCores('minmax(0, 1fr)')}
      {divisor}
      {grupoTamanhos}
      {btnPreencher}
      {divisor}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>{btnDesfazer}{btnLimpar}</div>
    </div>
  );

  /* Ferramenta e espessura viram BOTÃO + gaveta: as 10 ferramentas em grade
     (2 fileiras) mais as 4 espessuras custavam ~130px de altura fixa. */
  const FerrAtual = ICON_OF[tool] || ICON_OF.brush;
  const btnGaveta = (onClick, titulo, miolo) => (
    <button className="up-btn" onClick={onClick} title={titulo} aria-label={titulo}
      style={{ height: 44, minWidth: 52, padding: '0 8px', borderRadius: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, touchAction: 'manipulation',
        border: `1px solid ${A}`, background: `${A}12`, color: A, cursor: 'pointer' }}>
      {miolo}<span style={{ fontSize: 9, opacity: .8 }}>▾</span>
    </button>
  );
  const barraCompacta = (
    /* EM PÉ empilha (ações em cima, cores embaixo); DEITADO tudo numa faixa só
       que rola de lado — deitado sobra largura e falta altura, e cada linha a
       mais da barra sai direto do tamanho do desenho. */
    <div className="up-sembarra" style={{ background: cardBg, border: `1px solid ${roomBorder}`, borderRadius: 11,
      padding: 7, boxShadow: roomShadow, flexShrink: 0, display: 'flex', gap: 6,
      flexDirection: paisagem ? 'row' : 'column',
      alignItems: paisagem ? 'center' : 'stretch',
      overflowX: paisagem ? 'auto' : 'visible' }}>
      <div className="up-sembarra" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        overflowX: paisagem ? 'visible' : 'auto' }}>
        {btnGaveta(() => setSheetFerr(true), 'Ferramenta', <FerrAtual size={21} />)}
        {btnGaveta(() => setSheetTam(true), 'Espessura', bolinhaTamanho(size, A))}
        {btnPreencher}
        {!paisagem && <div style={{ flex: 1, minWidth: 2 }} />}
        {btnDica(true)}
        {btnPular(true)}
        {btnDesfazer}
        {btnLimpar}
      </div>
      {paletaCores(28)}
    </div>
  );
  const barraFerramentas = isDrawer && (empilhado ? barraCompacta : barraCompleta);

  const respostas = chat.filter(m => m.kind !== 'sys');
  const registros = chat.filter(m => m.kind === 'sys');
  const renderMensagens = (mensagens, fim, ehRegistro) => (
    <div className="up-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {!mensagens.length && (
        <div style={{ fontSize: 12, color: roomMuted, textAlign: 'center', margin: 'auto 0', lineHeight: 1.5 }}>
          {ehRegistro ? 'Os acontecimentos da sala aparecerão aqui.' : 'Escreva seu palpite aqui. Quem acerta primeiro leva mais pontos!'}
        </div>
      )}
      {mensagens.map(m => {
        const quase = m.kind === 'quase' || m.kind === 'quase-oculto';
        const destaque = m.kind === 'hit' || quase;
        return (
          <div key={m.id} className="up-chat" style={{ fontSize: 12.5, lineHeight: 1.45,
            color: m.kind === 'hit' ? (darkRoom ? '#63D995' : '#21834F')
              : quase ? (darkRoom ? '#FFC078' : '#A64B00') : roomText,
            fontStyle: ehRegistro ? 'italic' : 'normal', fontWeight: quase ? 700 : 400,
            background: m.kind === 'hit' ? (darkRoom ? '#153B2B' : '#28a06012')
              : quase ? `${UP.orange}14` : ehRegistro ? roomSub : 'transparent',
            border: quase ? `1px solid ${UP.orange}66` : ehRegistro ? `1px solid ${roomBorder}` : 'none',
            borderRadius: destaque || ehRegistro ? 7 : 0,
            padding: destaque || ehRegistro ? '5px 7px' : 0,
            opacity: m.kind === 'muted' ? .5 : 1 }}>
            {m.kind === 'hit' && <IcoCheck size={12} />}{' '}
            {ehRegistro ? <span aria-hidden style={{ color: roomAccent, marginRight: 4 }}>●</span> : null}
            {m.kind !== 'quase' && <b style={{ fontWeight: 700 }}>{m.name.split(' ')[0]}</b>}{' '}
            <span>{m.text}</span>
          </div>
        );
      })}
      <div ref={fim} />
    </div>
  );
  const entradaPalpite = (
    <div style={{ padding: 9, borderTop: `1px solid ${roomBorder}`, display: 'flex', gap: 6, flexShrink: 0 }}>
      <input value={guess} onChange={e => setGuess(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendGuess()}
        placeholder={isDrawer ? 'Você está desenhando...' : iHit ? 'Você acertou!' : 'Seu palpite...'}
        disabled={isDrawer}
        enterKeyHint="send" autoComplete="off" autoCorrect="off"
        style={{ flex: 1, minWidth: 0, padding: compacto ? '10px 11px' : '8px 11px', borderRadius: 9,
          border: `1px solid ${roomBorder}`, background: roomInput, color: roomText,
          fontSize: compacto ? 16 : 12.5, fontFamily: 'var(--font-body)', outline: 'none' }} />
      <button onClick={sendGuess} disabled={isDrawer} aria-label="Enviar palpite"
        style={{ width: compacto ? 44 : 34, borderRadius: 9, border: 'none', touchAction: 'manipulation',
          cursor: isDrawer ? 'not-allowed' : 'pointer',
          background: isDrawer ? '#94A3B8' : `linear-gradient(135deg, ${roomAccent}, ${darkRoom ? '#3979E8' : '#104FCB'})`,
          color: darkRoom && !isDrawer ? '#10213A' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IcoSend size={15} />
      </button>
    </div>
  );
  const painelChat = (
    <div style={{ background: cardBg, border: `1px solid ${roomBorder}`, borderRadius: compacto ? 10 : 14,
      height: '100%', minHeight: 0, overflow: 'hidden', boxShadow: roomShadow }}>
      {compacto ? (
        <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '7px 10px', borderBottom: `1px solid ${roomBorder}`, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['respostas', 'registros'].map(aba => (
                <button key={aba} onClick={() => setChatAba(aba)}
                  style={{ border: `1px solid ${chatAba === aba ? roomAccent : roomBorder}`,
                    borderRadius: 999, padding: '5px 10px', background: chatAba === aba ? roomAccent : cardBg,
                    color: chatAba === aba ? (darkRoom ? '#10213A' : '#fff') : roomText, fontSize: 11, fontWeight: 800,
                    letterSpacing: '.05em', cursor: 'pointer', touchAction: 'manipulation' }}>
                  {aba.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setChatAberto(false)} title="Esconder chat"
              style={{ border: 'none', background: 'transparent', color: roomMuted, fontSize: 17,
                cursor: 'pointer', padding: '0 4px', lineHeight: 1, touchAction: 'manipulation' }}>▾</button>
          </div>
          {chatAba === 'respostas'
            ? <>{renderMensagens(respostas, chatEndRef, false)}{entradaPalpite}</>
            : renderMensagens(registros, registrosEndRef, true)}
        </div>
      ) : (
        <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: '1.2fr 1fr' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${roomBorder}` }}>
            <div style={{ padding: '9px 12px', borderBottom: `1px solid ${roomBorder}`, color: roomAccent,
              fontSize: 11, fontWeight: 800, letterSpacing: '.08em', flexShrink: 0 }}>RESPOSTAS</div>
            {renderMensagens(respostas, chatEndRef, false)}
            {entradaPalpite}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '9px 12px', borderBottom: `1px solid ${roomBorder}`, color: roomAccent,
              fontSize: 11, fontWeight: 800, letterSpacing: '.08em', flexShrink: 0 }}>REGISTROS</div>
            {renderMensagens(registros, registrosEndRef, true)}
          </div>
        </div>
      )}
    </div>
  );

  /* ═══ OS DOIS CORPOS ══════════════════════════════════════════════════════ */

  /* EMPILHADO (celular, e tablet em pé). Em pé, com os palpites abertos, a caixa
     do desenho tem exatamente a proporção do papel (16:10) e TODA a sobra vai
     pro chat — dividindo a altura no meio, metade do que sobrava pro canvas
     virava moldura vazia, porque a largura da tela já é o teto do desenho. */
  const corpoEmpilhado = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: paisagem ? 'row' : 'column',
      gap: 6, padding: 6, position: 'relative', zIndex: 1 }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!paisagem && stripJogadores}
        {barraStatus}
        {areaCanvas((!paisagem && chatAberto)
          ? { flex: '0 1 auto', width: '100%', aspectRatio: `${CW} / ${CH}` }
          : undefined)}
        {barraFerramentas}
      </div>
      {chatAberto && (
        <div style={{
          /* Deitado o chat vira uma coluna estreita ao lado. EM PÉ ele fica com
             toda a sobra de altura: o desenho é 16:10 e já está no teto da
             largura da tela, então altura extra viraria só moldura vazia em
             volta do papel — melhor virar palpite na tela. */
          ...(paisagem
            ? { width: pequeno ? 188 : 240, flexShrink: 0, minHeight: 0 }
            : { flex: '1 1 0', minHeight: pequeno ? 90 : 120 }) }}>
          {painelChat}
        </div>
      )}
    </div>
  );

  /* Computador e tablet deitado: jogadores à esquerda; desenho e chat empilhados à direita. */
  const corpoTresColunas = (
    <div style={{ flex: 1, display: 'grid',
      gridTemplateColumns: `${compacto ? 190 : 216}px minmax(0, 1fr)`,
      gridTemplateRows: 'minmax(0, 1fr)', gap: compacto ? 8 : 12, minHeight: 0, overflow: 'hidden',
      padding: compacto ? 6 : 0, position: 'relative', zIndex: 1 }}>
      {/* Jogadores — mesma trava de altura do chat (sala cheia rolava o card) */}
      <div className="up-scroll" style={{ background: cardBg, border: `1px solid ${roomBorder}`, borderRadius: 14,
        padding: 11, height: '100%', minHeight: 0, overflowY: 'auto', boxShadow: roomShadow }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: roomAccent, letterSpacing: '.08em', marginBottom: 9 }}>
          JOGADORES ({participantes.length})
        </div>
        {listaJogadores}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: compacto ? 8 : 9, minWidth: 0, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: compacto ? 8 : 9, flex: 1, minHeight: 0 }}>
          {barraStatus}
          {areaCanvas()}
          {barraFerramentas}
        </div>
        {chatAberto && <div style={{ flex: compacto ? '0 0 205px' : '0 0 clamp(150px, 20vh, 180px)', minHeight: 140 }}>{painelChat}</div>}
      </div>
    </div>
  );

  /* Gaveta genérica (celular/tablet): sobe de baixo, fecha no toque fora. Num
     tablet ela não vai de ponta a ponta — 1180px de largura de gaveta pra
     escolher um pincel ficaria ridículo. */
  const gaveta = (aberta, fechar, titulo, conteudo) => aberta && (
    <div onClick={fechar}
      style={{ position: 'fixed', inset: 0, zIndex: 4100, background: 'rgba(10,6,24,.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="up-scroll"
        style={{ width: '100%', maxWidth: pequeno ? undefined : 560, maxHeight: '72vh', overflowY: 'auto',
          background: cardBg, border: `1px solid ${roomBorder}`, borderRadius: '18px 18px 0 0', padding: 14,
          paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: roomAccent, letterSpacing: '.08em' }}>{titulo}</div>
          <button onClick={fechar} aria-label="Fechar"
            style={{ border: 'none', background: 'transparent', color: roomMuted, fontSize: 24,
              lineHeight: 1, cursor: 'pointer', touchAction: 'manipulation', padding: '0 6px' }}>×</button>
        </div>
        {conteudo}
      </div>
    </div>
  );

  /* ═══ CELULAR E TABLET ════════════════════════════════════════════════════
     A sala ocupa a TELA INTEIRA (position:fixed). O Portal reserva 52px de topo
     e 76px embaixo pra barra de navegação; com o cabeçalho do jogo sobravam uns
     200px de altura pro desenho — deitado, menos. Cobrindo a tela, o canvas
     fica com todo o espaço, e o botão Sair devolve o Portal. */
  if (compacto) {
    const btnCabecalho = (props, filho) => (
      <button className="up-btn" {...props}
        style={{ width: pequeno ? 34 : 40, height: pequeno ? 34 : 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation',
          fontSize: pequeno ? 15 : 17,
          border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff',
          cursor: 'pointer', ...(props.style || {}) }}>{filho}</button>
    );
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: '#1765F5', isolation: 'isolate', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        /* `alturaVis` = visualViewport: com o teclado aberto o iOS não encolhe a
           janela, só a área visível — sem isso o campo de palpite ficava atrás
           do teclado. Fallback em dvh (a barra do Chrome do Android some/volta).
           `top: topoVis` reposiciona o card se o Safari rolar o documento ao
           focar o campo (ver comentário em useAlturaVisivel) — sem isso a tela
           "cortava"/desalinhava ao abrir o teclado pra digitar o palpite. */
        top: topoVis || 0,
        height: alturaVis || '100dvh',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
        overscrollBehavior: 'none' }}>
        <RoomBackdrop />
        <style>{PAINT_CSS}</style>

        {/* Cabeçalho enxuto */}
        <div className="up-hd" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
          padding: pequeno ? '6px 8px' : '8px 12px', paddingTop: 'max(6px, env(safe-area-inset-top))',
          background: `radial-gradient(circle at 12% 18%, rgba(255,255,255,.28) 0%, transparent 46%), ${RAINBOW}`,
          position: 'relative', zIndex: 1, overflow: 'hidden' }}>
          <Mascote size={pequeno ? 30 : 40} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: pequeno ? 14 : 17, fontWeight: 800, color: '#fff',
              lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state?.nome || (roomId === GLOBAL_ROOM ? 'Sala Geral' : 'Sala')}
            </div>
            <div style={{ fontSize: pequeno ? 10.5 : 12, color: 'rgba(255,255,255,.85)', fontWeight: 700,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {temaAtual.emoji} {temaAtual.nome}
            </div>
          </div>
          {/* Nos 3 colunas a lista de jogadores já está na tela — o botão só
              existe quando ela virou faixa/gaveta. */}
          {empilhado && btnCabecalho({ onClick: () => setSheetJog(true), title: 'Jogadores' },
            <>👥<span style={{ fontSize: 11, fontWeight: 800, marginLeft: 2 }}>{participantes.length}</span></>)}
          {!chatAberto && btnCabecalho({ onClick: () => setChatAberto(true), title: 'Mostrar palpites' }, '💬')}
          {btnCabecalho({ onClick: () => setMenuMob(true), title: 'Mais opções' }, '⋯')}
          {btnCabecalho({ onClick: onLeave, title: 'Sair da partida',
            style: { background: 'rgba(0,0,0,.25)' } }, <IcoExit size={15} />)}
        </div>

        {empilhado ? corpoEmpilhado : corpoTresColunas}

        {/* Gaveta: jogadores (com os votos de expulsar) */}
        {gaveta(sheetJog, () => setSheetJog(false), `JOGADORES (${participantes.length})`, listaJogadores)}

        {/* Gaveta: ferramentas */}
        {gaveta(sheetFerr, () => setSheetFerr(false), 'FERRAMENTA', (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
            {TOOLS.map(t => {
              const Ico = ICON_OF[t.id];
              const on = tool === t.id;
              return (
                <button key={t.id} onClick={() => { setTool(t.id); setSheetFerr(false); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 5, height: 66, borderRadius: 12, cursor: 'pointer', touchAction: 'manipulation',
                    border: on ? `2px solid ${A}` : `1px solid ${roomBorder}`,
                    background: on ? `${A}18` : roomSub, color: on ? A : roomText }}>
                  <Ico size={22} />
                  <span style={{ fontSize: 10.5, fontWeight: 700 }}>{t.nome}</span>
                </button>
              );
            })}
          </div>
        ))}

        {/* Gaveta: espessura */}
        {gaveta(sheetTam, () => setSheetTam(false), 'ESPESSURA', (
          <div style={{ display: 'flex', gap: 8 }}>
            {SIZES.map(s => (
              <button key={s} onClick={() => { setSize(s); setSheetTam(false); }}
                style={{ flex: 1, height: 66, borderRadius: 12, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation',
                  border: size === s ? `2px solid ${A}` : `1px solid ${roomBorder}`,
                  background: size === s ? `${A}14` : roomSub }}>
                <div style={{ width: Math.min(s, 30), height: Math.min(s, 30), borderRadius: '50%',
                  background: size === s ? A : roomText }} />
              </button>
            ))}
          </div>
        ))}

        {/* Gaveta: mais opções (som, Uniko, convidar) */}
        {gaveta(menuMob, () => setMenuMob(false), 'OPÇÕES', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button onClick={() => { setSomOn(v => !v); if (!somOn) SFX.clique(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12,
                border: `1px solid ${roomBorder}`, background: cardBg, color: roomText,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation' }}>
              {somOn ? <IcoSom size={17} /> : <IcoMudo size={17} />}
              {somOn ? 'Sons ligados' : 'Sons desligados'}
            </button>
            <button onClick={() => { setMenuMob(false); onAbrirPicker(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12,
                border: `1px solid ${roomBorder}`, background: cardBg, color: roomText,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation' }}>
              <img src={photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
              Meu Uniko
            </button>
            <ConvidarButton game="paint" roomId={roomId} roomName={state?.nome} accent={A}
              style={{ width: '100%', justifyContent: 'center', padding: '13px 14px', borderRadius: 12, fontSize: 14,
                background: `${A}12`, color: A, border: `1px solid ${A}55`, boxShadow: 'none' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden',
      position: 'relative', isolation: 'isolate', background: ROOM_BLUE, padding: 'clamp(12px, 1.8vw, 28px)',
      boxSizing: 'border-box' }}>
      <RoomBackdrop />
      <style>{PAINT_CSS}</style>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12,
        width: '100%', maxWidth: 1600, maxHeight: 960, height: '100%', minHeight: 0, margin: 'auto' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <GameAdminBanner visible={players.some(player => player.isAdmin)} />
        </div>
      {/* Cabeçalho */}
      <div className="up-hd" style={{ borderRadius: 16, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13,
        // brilho embutido no próprio background (evita uma camada só pra isso)
        background: `radial-gradient(circle at 12% 18%, rgba(255,255,255,.28) 0%, transparent 46%),
                     radial-gradient(circle at 88% 82%, rgba(255,255,255,.2) 0%, transparent 42%), ${RAINBOW}`,
        boxShadow: `0 8px 26px ${AG}`,
        position: 'relative', zIndex: 1, overflow: 'hidden', flexShrink: 0 }}>
        {/* respingos de tinta por cima do arco-íris (ficam no fundo via .up-hd) */}
        {SPLATS_HEADER.map((s, i) => <Splat key={i} {...s} cor="#fff" />)}
        <Mascote size={68} />
        {/* Nome da sala NÃO cresce (o spacer abaixo é que empurra os botões): com
            flex:1 ele se esticava por baixo do tema e, com nome longo, o texto
            invadia o centro. O teto de 24% garante que não encoste. */}
        <div style={{ minWidth: 0, maxWidth: '24%' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {state?.nome || (roomId === GLOBAL_ROOM ? 'Sala Geral' : 'Sala')}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Sala · {participantes.length} {participantes.length === 1 ? 'jogador' : 'jogadores'}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 8 }} />{/* empurra os botões pra direita */}

        {/* TEMA em destaque, centralizado na barra inteira */}
        <div className="up-hd-center">
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.28em',
            color: 'rgba(255,255,255,.85)', textShadow: '0 1px 6px rgba(0,0,0,.3)' }}>
            TEMA
          </div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 30, fontWeight: 800, lineHeight: 1.1,
            color: '#fff', letterSpacing: '.03em', textTransform: 'uppercase',
            textShadow: '0 3px 14px rgba(0,0,0,.4), 0 1px 3px rgba(0,0,0,.3)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {temaAtual.emoji} {temaAtual.nome}
          </div>
        </div>
        <button className="up-btn" onClick={() => { setSomOn(v => !v); if (!somOn) SFX.clique(); }}
          title={somOn ? 'Desligar sons' : 'Ligar sons'}
          style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', cursor: 'pointer' }}>
          {somOn ? <IcoSom size={16} /> : <IcoMudo size={16} />}
        </button>
        <button className="up-btn" onClick={onAbrirPicker} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', cursor: 'pointer' }}>
          <img src={photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Meu Uniko</span>
        </button>
        <ConvidarButton game="paint" roomId={roomId} roomName={state?.nome} accent={A}
          style={{ padding: '8px 14px', fontSize: 12, background: 'rgba(255,255,255,.16)', color: '#fff', border: '1px solid rgba(255,255,255,.35)', boxShadow: 'none' }} />
        <button className="up-btn" onClick={onLeave} title="Sair da partida"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.22)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <IcoExit size={14} />Sair
        </button>
      </div>

        {corpoTresColunas}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ — mantém a presence global (quem está em qual sala) e alterna
   lobby ⇄ sala.
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoPaint = ({ zoomOut }) => {
  const { compacto, pequeno } = useTela(zoomOut);
  const [name, setName]   = useState(() => myName());
  const isAdmin = getAuthUser()?.role === 'admin';
  const [photo, setPhoto] = useState(() => myPhotoSrc());   // URL — não o data URL!
  const [room, setRoom]   = useState(null);       // null = lobby
  useEffect(() => {
    document.body.classList.toggle('up-room-active', !!room);
    return () => document.body.classList.remove('up-room-active');
  }, [room]);
  const [todos, setTodos] = useState([]);         // [{name, photo, room}]
  const [sqlMissing, setSqlMissing] = useState(false);
  // NÃO abre sozinho: `up_name`/`up_photo_src` (e o "já vi") são por APARELHO
  // (ver comentário acima de `idDaConta`), então um celular novo achava que era
  // a primeira vez — mesmo a CONTA já tendo tudo editado noutro aparelho. O
  // apelido/foto do jogo já caem de volta pro nome da conta sozinhos (`myName`);
  // quem quiser personalizar abre pelo botão "Editar perfil" quando quiser.
  const [picker, setPicker] = useState(false);
  const [busca, setBusca]     = useState('');     // filtro do editor de perfil
  const [nomeEdit, setNomeEdit] = useState(name); // nome sendo editado no editor
  const lobbyChan = useRef(null);
  /* Quando entrei NESTA sala — desempata quem é o host. Renova ao trocar de sala
     (é uma entrada nova), mas NÃO ao trocar de Uniko: como a troca de foto
     recria o canal, sem esse cuidado a pessoa "acabaria de chegar" a cada troca
     de Uniko e perderia a antiguidade (e o host junto). */
  const [entrouEm, setEntrouEm] = useState(() => Date.now());
  const jaMontou = useRef(false);
  useEffect(() => {
    // Na montagem o valor do useState já serve; recarimbar aqui só causaria um
    // render extra e recriaria o canal de presence à toa.
    if (!jaMontou.current) { jaMontou.current = true; return; }
    setEntrouEm(Date.now());
  }, [room]);

  // Migração rodada?
  useEffect(() => {
    supabase.from('uniko_paint_state').select('id').limit(1).then(({ error }) => {
      if (semTabela(error)) setSqlMissing(true);
    });
  }, []);

  // Convite aceito → entra direto na sala do convite (se veio com sala). Ver gameInvites.js.
  useEffect(() => {
    const entrar = () => { const j = readPendingJoin('paint'); if (j?.room) { clearPendingJoin(); setRoom(j.room); } };
    entrar();
    const h = (e) => { if (!e?.detail || e.detail.game === 'paint') entrar(); };
    window.addEventListener(GAME_JOIN_EVENT, h);
    return () => window.removeEventListener(GAME_JOIN_EVENT, h);
  }, []);

  /* ── Presence ÚNICA pra todo o jogo ──────────────────────────────────────
     Cada um publica { name, photo, room }; é daí que o lobby sabe quem está em
     cada sala sem assinar o canal de todas.

     POR QUE O CANAL É RECRIADO A CADA MUDANÇA (e não um track() novo):
     `track()` repetido no mesmo canal NÃO atualiza os outros — medido: o valor
     velho continua no presenceState deles, e untrack()+track() cria uma SEGUNDA
     entrada sem remover a primeira. Efeito: você entra numa sala e todo mundo
     continua te vendo no lobby; a lista da sala fica errada pros outros e só um
     F5 conserta — porque o F5 recria o canal, que é o que fazemos aqui de
     propósito. Trocar de sala/Uniko é raro, então reconectar sai barato. ── */
  // Relê o estado do canal. `presenceState()` é LOCAL (o SDK mantém o mapa em
  // memória), então chamar isso não vai à rede.
  const refreshPresence = useCallback(() => {
    const ch = lobbyChan.current; if (!ch) return;
    const estado = ch.presenceState();
    const list = Object.entries(estado).map(([key, arr]) => {
      const e = escolherEntrada(arr);
      return e ? { id: e.id || key, name: e.name, conta: e.conta, photo: e.photo, room: e.room, entrouEm: e.entrouEm, isAdmin: !!e.isAdmin } : null;
    }).filter(Boolean);
    setTodos(list);

    /* CONVERGÊNCIA DO NOME: se a minha conta está aberta em outro aparelho com
       outro apelido, os dois precisam usar o MESMO nome — o placar, a fila de
       desenhar e o "é a sua vez" são todos por nome, então nomes diferentes
       fariam o celular desenhar enquanto o computador acha que não é ele.
       Adoto o nome do outro aparelho só quando ele é MENOR: assim os dois
       caminham pro mesmo (o mínimo) e ninguém fica trocando de nome pra sempre. */
    const minhas = (estado[idDaConta()] || []).filter(e => e && e.conn !== CONEXAO && e.name);
    const outro = escolherEntrada(minhas);
    if (outro && String(outro.name).localeCompare(name) < 0) setName(outro.name);
  }, [name]);   // `name` entra nas deps por causa da comparação acima

  useEffect(() => {
    const ch = supabase.channel('uniko-paint-presence', { config: { presence: { key: idDaConta() } } });
    lobbyChan.current = ch;
    // Os TRÊS eventos, não só o 'sync': sozinho ele não dispara de forma confiável
    // quando OUTRA pessoa entra/sai.
    ch.on('presence', { event: 'sync' },  refreshPresence)
      .on('presence', { event: 'join' },  refreshPresence)
      .on('presence', { event: 'leave' }, refreshPresence);
    ch.subscribe(async (st) => {
      if (st !== 'SUBSCRIBED') return;
      // Se o track falhar, ninguém enxerga ninguém — então isso PRECISA aparecer
      // no console em vez de sumir calado (foi assim que o payload gigante da
      // foto passou despercebido).
      const r = await ch.track({ id: idDaConta(), conn: CONEXAO, name, conta: authName(), photo, room, entrouEm, isAdmin: getAuthUser()?.role === 'admin' });
      if (r !== 'ok') console.error('[uniko-paint] presence track falhou:', r);
      refreshPresence();
    });
    // Rede de segurança: se algum evento se perder, conserta em ≤2s (sem rede).
    const t = setInterval(refreshPresence, 2000);
    return () => { clearInterval(t); supabase.removeChannel(ch); lobbyChan.current = null; };
  }, [name, photo, room, entrouEm, refreshPresence]);

  // Agrupa por sala — o lobby e a sala consomem isso.
  const porSala = useMemo(() => {
    const m = {};
    todos.forEach(p => { if (p.room) (m[p.room] = m[p.room] || []).push(p); });
    return m;
  }, [todos]);

  // Eu SEMPRE estou na minha sala — não espero o eco da presence pra saber disso.
  // Sem isto, entre o entrar e o presence sync chegar (uns instantes), a lista vem
  // vazia, o host é eleito como `undefined` e a sala mostra "esperando o host..."
  // pro próprio dono da sala, sem botão de começar.
  const naSala = useMemo(() => {
    const l = porSala[room] || [];
    const eu = idDaConta();
    return l.some(p => p.id === eu || p.name === name) ? l : [{ id: eu, name, photo, room, isAdmin }, ...l];
  }, [porSala, room, name, photo, isAdmin]);

  /* ── Seletor de foto (compartilhado por lobby e sala) ────────────────── */
  const [owned, setOwned] = useState(() => getCapturedCollection());
  useEffect(() => { syncCollectionFromServer().then(l => Array.isArray(l) && setOwned(l)); }, []);
  const myUnikos = useMemo(() => {
    const ids = new Set(owned.map(o => o.id));
    const base = [{ id: 'default', name: 'UNIKO', img: '/UNIKO_NEW.png' }];
    const fixos = Object.values(CAPTURE_UNIKOS).filter(u => ids.has(u.id))
      .map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    const custom = (getCustomUnikos() || []).filter(u => ids.has(u.id))
      .map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    return [...base, ...fixos, ...custom];
  }, [owned]);
  // Escolher um Uniko troca SÓ o boneco do jogo (chave `up_photo_src`, também
  // lida pelo Stop e pelo Detetive). A foto de perfil do Portal NÃO é mexida —
  // ela só muda em "Seus Dados" ou na aba Coleção, onde a pessoa pede isso de
  // propósito. Já foi assim (chamava `saveUserPhoto` aqui) e foi reportado como
  // bug: entrar num jogo trocava a foto do colaborador no Portal inteiro.
  const choosePhoto = (img) => {
    try { localStorage.setItem(PHOTO_SRC_KEY, img); } catch { /* sem localStorage */ }
    setPhoto(img);          // presence reanuncia sozinho no effect de [photo]
    // NÃO fecha o editor: a pessoa ainda pode ajustar o nome e salvar.
  };

  const abrirPicker = () => { setNomeEdit(name); setBusca(''); setPicker(true); };
  // Fecha o editor: grava o nome do jogo (se preenchido). Só altera o nome fora
  // de uma sala, pra não trocar a identidade no meio de uma partida (placar/host
  // são por nome).
  const fecharPerfil = () => {
    if (!room) {
      const novo = (nomeEdit || '').trim();
      try {
        if (novo && novo !== authName()) localStorage.setItem(NAME_KEY, novo);
        else localStorage.removeItem(NAME_KEY);
      } catch { /* sem localStorage */ }
      setName(novo || authName());
    }
    setPicker(false);
  };

  const cardBg = T.surface || '#fff';

  if (sqlMissing) return (
    <div style={{ maxWidth: 620, margin: '40px auto', background: cardBg, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <style>{PAINT_CSS}</style>
      <Mascote size={120} style={{ margin: '0 auto 12px' }} />
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8 }}>
        Falta rodar a migração
      </div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Uniko Paint precisa da tabela <code>uniko_paint_state</code>. Rode{' '}
        <b style={{ color: T.text }}>supabase_uniko_paint.sql</b> e depois{' '}
        <b style={{ color: T.text }}>supabase_uniko_paint_salas.sql</b> no SQL Editor do Supabase, e recarregue.
      </div>
    </div>
  );

  return (
    <>
      <style>{PORTAL_ROOM_CSS}</style>
      {room
        ? <Sala roomId={room} name={name} photo={photo} players={naSala}
            onLeave={() => setRoom(null)} onAbrirPicker={abrirPicker} zoomOut={zoomOut} />
        : <Lobby name={name} photo={photo} porSala={porSala}
            onEnter={setRoom} onAbrirPicker={abrirPicker} zoomOut={zoomOut} />}

      {picker && (() => {
        const termo = busca.trim().toLowerCase();
        const filtrados = !termo ? myUnikos : myUnikos.filter(u => {
          if (u.name.toLowerCase().includes(termo)) return true;
          const vs = hasAssistantSkin(u.id) ? getSkinVariations(u.id) : [];
          return vs.some(v => (v.label || '').toLowerCase().includes(termo));
        });
        return (
        <div onClick={fecharPerfil}
          style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(10,6,24,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: pequeno ? 10 : 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: cardBg, borderRadius: 18, border: `1px solid ${T.border}`, padding: pequeno ? 14 : 22,
              maxWidth: 720, width: '100%', maxHeight: compacto ? '92dvh' : '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,.4)' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              Editar perfil
            </div>
            <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 16, lineHeight: 1.5 }}>
              Escolha o Uniko e o nome que vão aparecer <b>dentro do jogo</b>. O Uniko também vira sua foto de perfil no Portal.
            </div>

            {/* Prévia do perfil + nome editável */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14,
              background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}`, marginBottom: 14, flexShrink: 0 }}>
              <img src={photo} alt="" style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: `3px solid ${A}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Nome no jogo</div>
                <input value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} disabled={!!room} maxLength={24}
                  placeholder={authName()}
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${T.border}`,
                    background: room ? (T.border + '33') : (T.surface || '#fff'), color: T.text, fontSize: 14, fontWeight: 700,
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', cursor: room ? 'not-allowed' : 'text' }} />
                {room && <div style={{ fontSize: 10.5, color: T.textD, marginTop: 3 }}>Saia da sala para mudar o nome.</div>}
              </div>
            </div>

            {/* Busca */}
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔎 Buscar Uniko pelo nome..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`,
                background: T.surface || '#fff', color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-body)', marginBottom: 12, flexShrink: 0 }} />

            {/* Coleção (lista rolável) */}
            <div className="up-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
              {filtrados.map(u => {
                const vars = hasAssistantSkin(u.id) ? getSkinVariations(u.id) : [];
                const opts = vars.length ? vars : [{ label: 'Normal', img: u.img }];
                return (
                  <div key={u.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8,
                      display: 'flex', alignItems: 'center', gap: 6 }}>
                      <img src={u.img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />{u.name}
                    </div>
                    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                      {opts.map(v => (
                        <button key={v.img} onClick={() => choosePhoto(v.img)} title={v.label}
                          style={{ width: 78, padding: 7, borderRadius: 12, cursor: 'pointer', background: T.surfaceSub || 'rgba(0,0,0,.03)',
                            border: photo === v.img ? `2px solid ${A}` : `1px solid ${T.border}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <img src={v.img} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                          <span style={{ fontSize: 9.5, color: T.textT, fontWeight: 600, textAlign: 'center',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {myUnikos.length <= 1 && (
                <div style={{ fontSize: 12.5, color: T.textT, background: T.surfaceSub || 'rgba(0,0,0,.03)',
                  padding: 12, borderRadius: 10, lineHeight: 1.5 }}>
                  Você ainda não capturou nenhum Uniko. Fique de olho no Portal durante os eventos do RH —
                  os Unikos que você pegar aparecem aqui.
                </div>
              )}
              {myUnikos.length > 1 && filtrados.length === 0 && (
                <div style={{ fontSize: 12.5, color: T.textT, textAlign: 'center', padding: '18px 0' }}>Nenhum Uniko encontrado para “{busca}”.</div>
              )}
            </div>

            <button onClick={fecharPerfil}
              style={{ marginTop: 14, width: '100%', padding: compacto ? '14px' : '12px', borderRadius: 11, border: 'none',
                flexShrink: 0, touchAction: 'manipulation',
                background: `linear-gradient(135deg, ${A}, ${A2})`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 6px 18px ${AG}` }}>
              Salvar perfil
            </button>
          </div>
        </div>
        );
      })()}
    </>
  );
};

export { TabUnikoPaint };
export default TabUnikoPaint;
