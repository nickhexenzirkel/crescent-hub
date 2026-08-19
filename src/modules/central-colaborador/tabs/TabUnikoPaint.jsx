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
// são rasterizadas num canvas BASE offscreen 1000x625; o visível é um blit do
// base (+ preview da forma em arraste). Desenhar é incremental — replay completo
// só em desfazer/limpar/sync. Isso existe por causa do BALDE: flood fill é pixel
// a pixel, e refazer todos os fills a cada segmento de traço travaria o jogo.
//
// LIMITAÇÃO CONHECIDA: a palavra vai no estado só em base64, então dá pra
// trapacear pelo devtools. Esconder de verdade exigiria uma RPC no Postgres
// entregando a palavra só pro desenhista.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER, saveUserPhoto } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos } from '../../../shared/captureUniko';
import { getSkinVariations, hasAssistantSkin } from '../../../shared/assistantSkin';
import { useGamePlaytime } from '../../../hooks/useGamePlaytime';

const ROUND_MS  = 80_000;   // tempo pra desenhar
const REVEAL_MS = 5_000;    // tela de "a palavra era..."
const MIN_PLAYERS = 2;
/* Denúncia de desenho: fração dos jogadores (excluindo o desenhista) que precisa
   denunciar pra encerrar a rodada na hora. 0.5 = maioria (metade ou mais). */
const REPORT_THRESHOLD = 0.5;
/* Expulsar jogador: fração dos OUTROS jogadores (todos menos o alvo) que precisa
   votar pra expulsar alguém da sala. 0.6 = maioria folgada, pra não expulsar à toa. */
const KICK_THRESHOLD = 0.6;
const LAP_OPTIONS = [1, 2, 3, 5, 8];
const DEFAULT_LAPS = 3;
const CW = 1000, CH = 625;  // resolução interna do canvas (a tela só escala por CSS)
const GLOBAL_ROOM = 'global';
/* Mascote oficial do Uniko Paint (gato-robô de boina, respingado de tinta). */
const MASCOTE = '/uniko-paint.png';

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
const Splat = ({ x, y, size = 60, cor, rot = 0, op = 0.14, forma = 0, pingos = true, style }) => (
  <svg aria-hidden viewBox="0 0 92 92" width={size} height={size}
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
  emocoes: UP.orange,  clima: UP.yellow,
};
const corDoTema = (id) => COR_TEMA[id] || UP.pink;

/* Paleta de desenho: as cores do mascote + o básico que todo desenho precisa
   (preto pra contorno, marrom, branco pra corrigir). */
const COLORS = [UP.ink, '#7A7A8C', UP.red, UP.orange, UP.yellow, UP.lime,
  UP.cyan, UP.purple, UP.pink, '#8B5E34', '#0FA36B', '#FFFFFF'];
const SIZES = [3, 8, 16, 30];
const TOOLS = [
  { id: 'brush',  nome: 'Pincel' },
  { id: 'line',   nome: 'Linha',    shape: true },
  { id: 'rect',   nome: 'Quadrado', shape: true },
  { id: 'circle', nome: 'Círculo',  shape: true },
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
  // 4) uma letra a mais ou a menos ("geladera" ≈ "geladeira") — inserção/remoção,
  //    nunca TROCA de letra, que é o que faz virar outra palavra
  if (Math.abs(p.length - a.length) === 1 && distancia(p, a) === 1) return true;
  return false;
};

const myName = () => {
  try { const a = getAuthUser(); return String(a?.name || USER?.name || 'Colaborador').trim(); }
  catch { return 'Colaborador'; }
};
/* ── Foto que trafega na PRESENCE ───────────────────────────────────────────
   NUNCA mandar a foto de perfil aqui: ela é um data URL de PNG 300x300 (~100-200KB
   em base64) e o payload da presence não aguenta — o track é rejeitado em SILÊNCIO,
   e o efeito é cruel: cada um enxerga só a si mesmo, ninguém vê ninguém, e a partida
   nunca começa por "falta de jogadores". Aqui trafega só a URL da imagem (~30 bytes);
   é a MESMA arte, só não convertida. A foto de perfil do Portal continua sendo o data
   URL, salva por saveUserPhoto normalmente. */
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
.up-turn   { animation: upTurnIn .45s cubic-bezier(.2,1.3,.4,1) both; }
.up-turn-out { animation: upTurnOut .35s ease-in both; }
.up-avatar { animation: upAvatarIn .55s cubic-bezier(.2,1.4,.4,1) both; }
.up-ring   { position: absolute; inset: -6px; border-radius: 50%; border: 3px solid currentColor; animation: upRing 1.6s ease-out infinite; }
.up-ring2  { animation-delay: .55s; }
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
.up-urgent { animation: upShake .5s ease-in-out infinite; }
.up-drawing-badge { animation: upPulse 2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .up-mascote, .up-mascote-big, .up-halo::before, .up-ring, .up-urgent, .up-drawing-badge { animation: none !important; }
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
const ICON_OF = { brush: IcoBrush, eraser: IcoEraser, fill: IcoFill, line: IcoLine, rect: IcoRect, circle: IcoCircle };

/* ── Balde de tinta ─────────────────────────────────────────────────────────
   Flood fill scanline com tolerância. A tolerância existe por causa do
   antialiasing: sem ela o balde para nas bordas suaves do traço e deixa uma
   auréola branca em volta. */
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const floodFill = (cx, px, py, hex) => {
  const x0 = Math.round(px), y0 = Math.round(py);
  if (x0 < 0 || y0 < 0 || x0 >= CW || y0 >= CH) return;
  const img = cx.getImageData(0, 0, CW, CH);
  const d = img.data;
  const at = (x, y) => (y * CW + x) * 4;
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
  const visto = new Uint8Array(CW * CH);
  const stack = [[x0, y0]];
  while (stack.length) {
    const [sx, sy] = stack.pop();
    if (visto[sy * CW + sx] || !casa(sx, sy)) continue;
    let x = sx;
    while (x > 0 && casa(x - 1, sy) && !visto[sy * CW + (x - 1)]) x--;   // corre pra esquerda
    let acima = false, abaixo = false;
    for (; x < CW && casa(x, sy) && !visto[sy * CW + x]; x++) {
      visto[sy * CW + x] = 1;
      const i = at(x, sy);
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
      // Empilha só a PRIMEIRA célula de cada corrida vizinha (senão a pilha explode)
      if (sy > 0) {
        const ok = casa(x, sy - 1) && !visto[(sy - 1) * CW + x];
        if (ok && !acima) stack.push([x, sy - 1]);
        acima = ok;
      }
      if (sy < CH - 1) {
        const ok = casa(x, sy + 1) && !visto[(sy + 1) * CW + x];
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
const RankingGeral = ({ name, cardBg }) => {
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
    <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14,
      boxShadow: T.sh, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11, flexShrink: 0 }}>
        <span style={{ fontSize: 17 }}>🏆</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.textT, letterSpacing: '.07em' }}>RANKING GERAL</span>
      </div>
      {faltaSql ? (
        <div style={{ fontSize: 12, color: T.textT, lineHeight: 1.5 }}>
          Falta rodar <b style={{ color: T.text }}>supabase_uniko_paint_ranking.sql</b> no Supabase.
        </div>
      ) : linhas === null ? (
        <div style={{ fontSize: 12, color: T.textD }}>Carregando...</div>
      ) : !linhas.length ? (
        <div style={{ fontSize: 12, color: T.textD, lineHeight: 1.5 }}>
          Ninguém pontuou ainda. Jogue uma partida e apareça aqui!
        </div>
      ) : (
        <div className="up-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {linhas.map((l, i) => {
            const eu = l.player === name;
            return (
              <div key={l.player} className="up-fade" style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 8px', borderRadius: 9, background: eu ? `${A}12` : 'transparent',
                border: eu ? `1px solid ${A}44` : '1px solid transparent' }}>
                <span style={{ fontSize: i < 3 ? 15 : 11, fontWeight: 800, color: i < 3 ? T.text : T.textD,
                  width: 22, textAlign: 'center', flexShrink: 0 }}>{medalha(i)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: eu ? 800 : 700, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.player.split(' ')[0]}{eu && ' (você)'}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.textT }}>
                    {l.partidas} {l.partidas === 1 ? 'partida' : 'partidas'}
                    {l.vitorias > 0 && ` · ${l.vitorias} 🏅`}
                  </div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: A, flexShrink: 0 }}>{l.pontos}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Lobby = ({ name, photo, porSala, onEnter, onAbrirPicker }) => {
  const [rooms, setRooms] = useState([]);
  const [criando, setCriando] = useState(false);
  const [nomeSala, setNomeSala] = useState('');
  const [temaSala, setTemaSala] = useState('geral');
  const [erro, setErro] = useState('');
  const [confirmarEx, setConfirmarEx] = useState(null);  // id da sala a excluir
  const cardBg = T.surface || '#fff';
  const isAdmin = getAuthUser()?.role === 'admin';

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('uniko_paint_state')
      .select('id, state, updated_at').order('updated_at', { ascending: false });
    if (error) { console.error('[uniko-paint] lobby:', error); return; }
    setRooms(data || []);
    // Faxina: sala criada por alguém, vazia e parada há muito tempo vira lixo.
    const velhas = (data || []).filter(r =>
      r.id !== GLOBAL_ROOM && !(porSala[r.id]?.length) &&
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
      id, state: { phase: 'lobby', round: 0, scores: {}, nome, themeId: temaSala, criador: name },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <style>{PAINT_CSS}</style>
      {/* Cabeçalho */}
      <div className="up-hd" style={{ borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
        // brilho embutido no próprio background (evita uma camada só pra isso)
        background: `radial-gradient(circle at 12% 18%, rgba(255,255,255,.28) 0%, transparent 46%),
                     radial-gradient(circle at 88% 82%, rgba(255,255,255,.2) 0%, transparent 42%), ${RAINBOW}`,
        boxShadow: `0 8px 26px ${AG}`,
        position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {/* respingos de tinta por cima do arco-íris (ficam no fundo via .up-hd) */}
        {SPLATS_HEADER.map((s, i) => <Splat key={i} {...s} cor="#fff" />)}
        <Mascote size={80} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: '#fff' }}>Uniko Paint</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>Entre numa sala ou crie a sua</div>
        </div>
        <button onClick={onAbrirPicker} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', cursor: 'pointer' }}>
          <img src={photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Meu Uniko</span>
        </button>
        <button onClick={() => setCriando(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, border: 'none',
            background: '#fff', color: A, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,.18)' }}>
          <IcoPlus size={15} />Criar sala
        </button>
      </div>

      {/* Criar sala */}
      {criando && (
        <div style={{ background: cardBg, border: `1px solid ${A}55`, borderRadius: 14, padding: 16,
          boxShadow: T.sh, flexShrink: 0 }}>
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
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 268px',
        gridTemplateRows: 'minmax(0, 1fr)', gap: 12, minHeight: 0 }}>
      {/* Lista de salas — sem barra de rolagem (não vai ter sala demais), mas
          ainda rolável pela roda se um dia passar da tela. */}
      <div className="up-sembarra" style={{ overflowY: 'auto', minHeight: 0, position: 'relative' }}>
        {/* respingos coloridos bem sutis no fundo da lista */}
        <Splat x="-3%"  y="14%" size={190} cor={UP.cyan}   rot={18}  op={0.05} forma={1} />
        <Splat x="72%"  y="52%" size={230} cor={UP.pink}   rot={200} op={0.045} forma={2} />
        <Splat x="34%"  y="78%" size={160} cor={UP.yellow} rot={95}  op={0.05} forma={0} />
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginBottom: 10,
          position: 'relative', zIndex: 1 }}>
          SALAS ({rooms.length})
        </div>
        {/* `minmax(260px, 340px)` e não `1fr`: com 1fr os cards ESTICAM pra ocupar
            a linha toda, então em tela grande (ou com poucas salas) cada card
            virava um bloco enorme, enquanto em tela menor ficava compacto — era
            a mesma tela parecendo dois layouts diferentes. Teto de 340px + o
            grid alinhado à esquerda mantém o card sempre do mesmo tamanho. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 340px))',
          justifyContent: 'start', gap: 12, position: 'relative', zIndex: 1 }}>
          {rooms.map(r => {
            const st = r.state || {};
            const tema = themeById(st.themeId);
            const gente = porSala[r.id] || [];
            const fixa = r.id === GLOBAL_ROOM;
            const jogando = st.phase === 'drawing' || st.phase === 'reveal';
            const cor = corDoTema(st.themeId);   // cada tema tem sua cor de tinta
            return (
              <div key={r.id} className="up-card up-fade"
                style={{ background: cardBg, border: `1.5px solid ${cor}55`, borderRadius: 14,
                  padding: 14, boxShadow: T.sh, display: 'flex', flexDirection: 'column', gap: 10,
                  position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = cor; e.currentTarget.style.boxShadow = `0 10px 26px ${cor}44`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${cor}55`; e.currentTarget.style.boxShadow = T.sh; }}>
                {/* respingo da cor do tema, no canto */}
                <Splat y="-22px" size={78} cor={cor} rot={34} op={0.13} forma={r.id.charCodeAt(0) % 3}
                  style={{ left: 'auto', right: '-16px' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    background: `linear-gradient(135deg, ${cor}2e, ${cor}14)`, border: `1px solid ${cor}33` }}>{tema.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {st.nome || (fixa ? 'Sala Geral' : 'Sala')}
                    </div>
                    {/* bolinha colorida em vez de texto colorido: várias cores da
                        paleta não têm contraste pra texto (e há tema escuro). */}
                    <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0,
                        boxShadow: `0 0 0 2px ${cor}33` }} />
                      <b style={{ color: T.text, fontWeight: 700 }}>{tema.nome}</b>
                      {fixa && <span style={{ color: T.textD }}>· fixa</span>}
                    </div>
                  </div>
                  {jogando && (
                    <div style={{ padding: '3px 8px', borderRadius: 999, background: '#28a06018', color: '#28a060',
                      fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>EM JOGO</div>
                  )}
                  {podeExcluir(r) && (
                    <button onClick={() => setConfirmarEx(r.id)} title="Excluir esta sala"
                      style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${T.border}`, background: 'transparent', color: T.textT, cursor: 'pointer', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#E63946'; e.currentTarget.style.borderColor = '#E6394655'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = T.textT; e.currentTarget.style.borderColor = T.border; }}>
                      <IcoTrash size={13} />
                    </button>
                  )}
                </div>

                {/* Quem está na sala */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 30, position: 'relative', zIndex: 1 }}>
                  {gente.length ? (
                    <>
                      <div style={{ display: 'flex' }}>
                        {gente.slice(0, 6).map((p, i) => (
                          <img key={p.name} src={p.photo || '/UNIKO_NEW.png'} alt="" title={p.name}
                            style={{ width: 27, height: 27, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub,
                              border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11.5, color: T.textT }}>
                        {gente.length === 1 ? `${gente[0].name.split(' ')[0]} está aqui`
                          : `${gente.length} jogadores`}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11.5, color: T.textD, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IcoUsers size={13} />Vazia — seja o primeiro
                    </span>
                  )}
                </div>

                <button className="up-btn" onClick={() => { SFX.entrou(); onEnter(r.id); }}
                  style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', color: textoSobre(cor),
                    fontSize: 13, fontWeight: 800, cursor: 'pointer', position: 'relative', zIndex: 1,
                    background: cor, boxShadow: `0 4px 14px ${cor}55` }}>
                  Entrar
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
        {!rooms.length && (
          <div style={{ textAlign: 'center', padding: 40, color: T.textD, fontSize: 13 }}>
            Carregando salas...
          </div>
        )}
      </div>

      <RankingGeral name={name} cardBg={cardBg} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SALA — a partida em si.
   ═══════════════════════════════════════════════════════════════════════════ */
const Sala = ({ roomId, name, photo, players, onLeave, onAbrirPicker }) => {
  const [state, setState] = useState(null);
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

  const canvasRef = useRef(null);
  const baseRef   = useRef(null);   // canvas offscreen com o desenho commitado
  const chanRef   = useRef(null);
  const acts      = useRef([]);     // ações commitadas (normalizadas 0..1)
  const drag      = useRef(null);
  const pending   = useRef([]);     // segmentos a enviar (batch)
  const chatEndRef = useRef(null);
  const isDrawerRef = useRef(false);
  const stateRef    = useRef(null);
  const hostRef     = useRef(false);
  // players TAMBÉM precisa de espelho: registerHit roda a partir do handler do
  // canal, que é registrado uma vez só e enxergaria a lista VAZIA do 1º render.
  const playersRef  = useRef([]);

  /* ── Canvas ──────────────────────────────────────────────────────────── */
  const ctxBase = () => {
    if (!baseRef.current) {
      const c = document.createElement('canvas'); c.width = CW; c.height = CH;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, CW, CH);
      baseRef.current = c;
    }
    return baseRef.current.getContext('2d', { willReadFrequently: true });
  };
  const drawAct = (cx, a) => {
    const px = (p) => [p.x * CW, p.y * CH];
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.strokeStyle = a.c; cx.fillStyle = a.c; cx.lineWidth = a.w || 1;
    if (a.t === 's') {
      if (!a.pts?.length) return;
      cx.strokeStyle = a.e ? '#FFFFFF' : a.c;
      cx.beginPath(); cx.moveTo(...px(a.pts[0]));
      for (let i = 1; i < a.pts.length; i++) cx.lineTo(...px(a.pts[i]));
      if (a.pts.length === 1) cx.lineTo(a.pts[0].x * CW + 0.1, a.pts[0].y * CH);
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
    } else if (a.t === 'f') {
      floodFill(cx, a.p.x * CW, a.p.y * CH, a.c);
    }
  };
  const blit = (preview) => {
    const cv = canvasRef.current; if (!cv || !baseRef.current) return;
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, CW, CH);
    cx.drawImage(baseRef.current, 0, 0);
    if (preview) drawAct(cx, preview);
  };
  const commit = (a) => { acts.current.push(a); drawAct(ctxBase(), a); blit(); };
  const replay = () => {
    const cx = ctxBase();
    cx.clearRect(0, 0, CW, CH);
    cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, CW, CH);
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
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.strokeStyle = a.e ? '#FFFFFF' : a.c; cx.lineWidth = a.w;
      cx.beginPath(); cx.moveTo(prev.x * CW, prev.y * CH); cx.lineTo(seg.p.x * CW, seg.p.y * CH); cx.stroke();
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
  useEffect(() => { playersRef.current = players; }, [players]);

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
    const carimbado = { ...next, ts: Date.now() };
    aplicaEstado(carimbado);            // otimista: já vale localmente
    try {
      await supabase.from('uniko_paint_state')
        .update({ state: carimbado, updated_at: new Date().toISOString() }).eq('id', roomId);
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
    const p = players.find(x => x.name === state.drawer);
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
    const faltam = playersRef.current.filter(p => p.name !== s.drawer).length - hits.length;
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
  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [chat]);

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
    const total = playersRef.current.filter(p => p.name !== s.drawer).length;
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
     Sem servidor: cada voto é um broadcast {alvo, votante}. Todo cliente conta
     os votos que recebe e, quando batem KICK_THRESHOLD dos OUTROS jogadores, o
     próprio cliente do ALVO sai da sala (onLeave) — os demais só veem o aviso.
     Não precisa de host: todo mundo chega ao mesmo total e só o alvo se remove. */
  const onKickMsg = (p) => {
    if (!p?.alvo || !p?.votante) return;
    const nomes = new Set(playersRef.current.map(pl => pl.name));
    const votos = { ...kickVotesRef.current };
    // Só conta votos de quem AINDA está na sala (descarta voto de quem já saiu).
    const lista = (votos[p.alvo] || []).filter(n => nomes.has(n));
    if (nomes.has(p.votante) && !lista.includes(p.votante)) lista.push(p.votante);
    votos[p.alvo] = lista;
    kickVotesRef.current = votos;
    setKickVotes(votos);
    // Elegíveis = todos os presentes menos o alvo (o alvo não vota em si).
    const elegiveis = playersRef.current.filter(pl => pl.name !== p.alvo).length;
    const bateu = elegiveis > 0 && (lista.length / elegiveis) >= KICK_THRESHOLD;
    if (bateu) {
      addChat({ name: p.alvo, text: 'foi expulso da sala por votação 🚪', kind: 'sys' });
      // limpa os votos desse alvo (a partida continua pros demais)
      const limpo = { ...kickVotesRef.current }; delete limpo[p.alvo];
      kickVotesRef.current = limpo; setKickVotes(limpo);
      if (p.alvo === name) { sfx('pulou'); onLeave?.(); }
    } else {
      addChat({ name: p.votante, text: `votou para expulsar ${p.alvo.split(' ')[0]} (${lista.length}/${Math.ceil(elegiveis * KICK_THRESHOLD)}) 🚪`, kind: 'sys' });
    }
  };
  const votarExpulsar = (alvo) => {
    if (!alvo || alvo === name) return;
    if (kickVotesRef.current[alvo]?.includes(name)) return;   // já votei nesse alvo
    chanRef.current?.send({ type: 'broadcast', event: 'kickvote', payload: { alvo, votante: name } });
    onKickMsg({ alvo, votante: name });
  };

  /* ── Motor da partida (só o host escreve) ────────────────────────────── */
  const startRound = (queue, scores, round, totalRounds, usadas, themeId, nome, elenco) => {
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
    const nomes = Object.keys(scores);
    if (!nomes.length) return;
    const campeao = nomes.reduce((a, b) => (scores[b] > scores[a] ? b : a), nomes[0]);
    nomes.forEach((quem) => {
      supabase.rpc('uniko_paint_add_score', {
        p_player: quem, p_pontos: scores[quem] || 0, p_venceu: quem === campeao,
      }).then(({ error }) => { if (error) console.error('[uniko-paint] ranking:', error.message); });
    });
  };

  const startGame = () => {
    if (!state) return;                 // sem o state da sala não há tema — ver startRound
    const ordem = [...players.map(p => p.name)].sort(() => Math.random() - 0.5);
    const queue = Array.from({ length: laps }, () => ordem).flat();
    // Semeia o baralho da partida com as palavras RECENTES da sala (as das últimas
    // partidas) já marcadas como usadas → elas ficam pro fim e as palavras novas/menos
    // vistas saem primeiro. Assim "tema Geral de novo" não repete as mesmas de sempre.
    const pool0 = themeById(state.themeId).words;
    const recSeed = (state.recentes || []).filter(w => pool0.includes(w));
    startRound(queue, {}, 1, queue.length, recSeed, state.themeId, state.nome, ordem);
  };

  useEffect(() => {
    if (!isHost || !state) return;
    const t = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      // Desenhista sumiu (saiu/fechou) → não deixa a rodada morrer no relógio.
      if (s.phase === 'drawing' && s.drawer && !players.some(p => p.name === s.drawer)) {
        pushState({ ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) });
        return;
      }
      if (!s.endsAt || Date.now() < s.endsAt) return;
      if (s.phase === 'drawing') {
        pushState({ ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, lastWord: dec(s.wordEnc) });
      } else if (s.phase === 'reveal') {
        // (a transição pra 'over' já grava o ranking — ver salvarRanking)
        // Tira da fila quem já saiu da sala...
        const restante = (s.queue || []).slice(1).filter(n => players.some(p => p.name === n));
        // ...e ACOLHE quem entrou depois do início: sem isso quem chega no meio
        // nunca é sorteado pra desenhar, porque a fila só era montada no começo.
        const elenco = s.elenco || [...new Set(s.queue || [])];
        const novos = players.map(p => p.name).filter(n => !elenco.includes(n));
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
  }, [isHost, state?.phase, state?.endsAt, players]);

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
    t: tool === 'line' ? 'l' : tool === 'rect' ? 'r' : 'c',
    a, b, c: color, w: size, f: filled && tool !== 'line',
  });
  const sendAct = (a) => {
    commit(a);
    chanRef.current?.send({ type: 'broadcast', event: 'act', payload: { from: name, act: a } });
  };
  const down = (e) => {
    if (!isDrawer) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = posOf(e);
    if (tool === 'fill') { sendAct({ t: 'f', p, c: color }); return; }
    if (TOOLS.find(x => x.id === tool)?.shape) { drag.current = { a: p, b: p }; return; }
    const seg = { start: true, p, c: color, w: size, e: tool === 'eraser' };
    drag.current = { free: true };
    applySeg(seg); pending.current.push(seg);
  };
  const move = (e) => {
    if (!isDrawer || !drag.current) return;
    const p = posOf(e);
    if (drag.current.free) {
      const seg = { start: false, p };
      applySeg(seg); pending.current.push(seg);
    } else {
      drag.current.b = p;
      blit(shapeAct(drag.current.a, p));    // preview sem commitar
    }
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
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
      if (!isDrawerRef.current) return;        // só o desenhista responde
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

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    cv.width = CW; cv.height = CH;
    ctxBase(); blit();
    // Só na montagem: o canvas tem tamanho fixo e `blit` lê tudo de refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── UI ──────────────────────────────────────────────────────────────── */
  const cardBg = T.surface || '#fff';
  const ranked = useMemo(() => {
    const sc = state?.scores || {};
    return [...players].map(p => ({ ...p, pts: sc[p.name] || 0 })).sort((a, b) => b.pts - a.pts);
  }, [players, state?.scores]);
  const temaAtual = themeById(state?.themeId);
  const noLobby = !state || state.phase === 'lobby' || state.phase === 'over';

  const btnTool = (t) => {
    const Ico = ICON_OF[t.id];
    const on = tool === t.id;
    return (
      <button key={t.id} onClick={() => setTool(t.id)} title={t.nome}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 54, padding: '8px 4px',
          borderRadius: 10, cursor: 'pointer', transition: 'all .12s',
          border: on ? `2px solid ${A}` : `1px solid ${T.border}`,
          background: on ? `${A}18` : (T.surfaceSub || 'rgba(0,0,0,.03)'),
          color: on ? A : T.text, transform: on ? 'translateY(-1px)' : 'none' }}>
        <Ico size={20} />
        <span style={{ fontSize: 9.5, fontWeight: 700 }}>{t.nome}</span>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <style>{PAINT_CSS}</style>
      {/* Cabeçalho */}
      <div className="up-hd" style={{ borderRadius: 16, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13,
        // brilho embutido no próprio background (evita uma camada só pra isso)
        background: `radial-gradient(circle at 12% 18%, rgba(255,255,255,.28) 0%, transparent 46%),
                     radial-gradient(circle at 88% 82%, rgba(255,255,255,.2) 0%, transparent 42%), ${RAINBOW}`,
        boxShadow: `0 8px 26px ${AG}`,
        position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
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
            Sala · {players.length} {players.length === 1 ? 'jogador' : 'jogadores'}
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
        <button className="up-btn" onClick={onLeave} title="Sair da partida"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.22)', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <IcoExit size={14} />Sair
        </button>
      </div>

      {/* Corpo — `gridTemplateRows: minmax(0,1fr)` é obrigatório: sem isso a linha
          do grid é `auto` (= max-content) e CRESCE conforme o chat enche, esticando
          junto o canvas até não dar mais pra desenhar. minHeight:0 nos filhos não
          resolve sozinho; quem manda no tamanho é a linha. */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '216px 1fr 254px',
        gridTemplateRows: 'minmax(0, 1fr)', gap: 12, minHeight: 0, overflow: 'hidden' }}>
        {/* Jogadores — mesma trava de altura do chat (sala cheia rolava o card) */}
        <div className="up-scroll" style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 11,
          height: '100%', minHeight: 0, overflowY: 'auto', boxShadow: T.sh }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.textT, letterSpacing: '.08em', marginBottom: 9 }}>
            JOGADORES ({players.length})
          </div>
          {ranked.map((p, i) => {
            const desenhando = state?.phase === 'drawing' && state?.drawer === p.name;
            const acertou = state?.hits?.includes(p.name);
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 7px', borderRadius: 10,
                background: desenhando ? `${A}14` : 'transparent', marginBottom: 3 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={p.photo || '/UNIKO_NEW.png'} alt=""
                    style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover',
                      border: `2.5px solid ${desenhando ? A : acertou ? '#28a060' : 'transparent'}`,
                      background: T.surfaceSub, boxShadow: desenhando ? `0 0 0 3px ${A}22` : 'none' }} />
                  {i === 0 && (state?.scores?.[p.name] > 0) && (
                    <div style={{ position: 'absolute', top: -7, right: -5, color: '#F0B429' }}><IcoCrown size={16} /></div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: p.name === name ? 800 : 700, color: T.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
                    {p.name.split(' ')[0]}{p.name === name && ' (você)'}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textT, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <b style={{ color: T.text, fontWeight: 700 }}>{p.pts}</b> pts
                    {desenhando && <span style={{ color: A, fontWeight: 700 }}>• desenhando</span>}
                    {acertou && <span style={{ color: '#28a060', fontWeight: 700 }}>• acertou</span>}
                    {p.name === host && <span title="Host da partida" style={{ opacity: .6 }}>• host</span>}
                  </div>
                </div>
                {/* Expulsar (voto democrático) — só pra outros jogadores */}
                {p.name !== name && players.length >= 3 && (() => {
                  const votos = kickVotes[p.name] || [];
                  const eleg  = Math.max(1, players.filter(pl => pl.name !== p.name).length);
                  const alvo  = Math.ceil(eleg * KICK_THRESHOLD);
                  const votei = votos.includes(name);
                  return (
                    <button onClick={() => votarExpulsar(p.name)} disabled={votei}
                      title={votei ? 'Você já votou para expulsar' : `Votar para expulsar ${p.name.split(' ')[0]} da sala`}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '4px 7px', borderRadius: 8,
                        border: `1px solid ${votos.length ? '#E6394655' : T.border}`,
                        background: votos.length ? '#E6394610' : 'transparent',
                        color: votei ? '#E63946' : T.textT, cursor: votei ? 'default' : 'pointer',
                        fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
                      🚪{votos.length > 0 ? <span>{votos.length}/{alvo}</span> : null}
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 14px',
            display: 'flex', alignItems: 'center', gap: 12, boxShadow: T.sh, flexShrink: 0 }}>
            {state?.phase === 'drawing' ? (
              <>
                <div style={{ fontSize: 12, color: T.textT, whiteSpace: 'nowrap' }}>
                  Rodada {state.round}{state.totalRounds ? ` de ${state.totalRounds}` : ''}
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 800,
                  color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                  {isDrawer ? <span style={{ letterSpacing: '.02em' }}>{word}</span> : (
                    <>
                      {/* Cada palavra é um bloco à parte, com um gap BEM maior entre
                          blocos do que o letterSpacing usado DENTRO de cada palavra —
                          é essa diferença de espaçamento que deixa claro onde tem um
                          espaço de verdade (ex.: "café da manhã" vira 3 blocos bem
                          separados, não uma sequência única de traços). Um <span> só
                          com espaço normal não bastaria: o HTML colapsa espaços
                          repetidos e as palavras virariam um bloco só. */}
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
                        {maskParts(word, revelar).map((g, i) => (
                          <span key={i} style={{ letterSpacing: '.18em', whiteSpace: 'nowrap' }}>{g.join(' ')}</span>
                        ))}
                      </span>
                      <span style={{ fontSize: 11, color: T.textD, fontWeight: 600, letterSpacing: 0 }}>
                        ({contaLetras(word)} letras
                        {maskParts(word).length > 1 ? `, ${maskParts(word).length} palavras` : ''})
                      </span>
                    </>
                  )}
                </div>
                {isDrawer && (
                  <button className="up-btn" onClick={darDica} disabled={revelar >= maxHints(word)} title="Revelar uma letra"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
                      border: `1px solid ${revelar >= maxHints(word) ? T.border : A}`,
                      cursor: revelar >= maxHints(word) ? 'not-allowed' : 'pointer',
                      background: revelar >= maxHints(word) ? 'transparent' : `${A}14`,
                      color: revelar >= maxHints(word) ? T.textD : A, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <IcoBulb size={13} />Dar dica
                  </button>
                )}
                {isDrawer && (
                  /* Dois cliques de propósito: pular custa a vez INTEIRA (não
                     desenha e não pontua), então um clique sem querer seria caro. */
                  <button className="up-btn" onClick={() => (confirmPular ? pularVez() : setConfirmPular(true))}
                    disabled={!podePular}
                    onBlur={() => setConfirmPular(false)}
                    title={state?.hits?.length ? 'Alguém já acertou — não dá mais pra pular'
                      : 'Passar a vez pro próximo (você não desenha nem pontua nesta rodada)'}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
                      border: `1px solid ${!podePular ? T.border : confirmPular ? UP.red : UP.orange}`,
                      cursor: podePular ? 'pointer' : 'not-allowed',
                      background: !podePular ? 'transparent' : confirmPular ? `${UP.red}18` : `${UP.orange}14`,
                      color: !podePular ? T.textD : confirmPular ? UP.red : UP.orange,
                      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <IcoSkip size={13} />{confirmPular ? 'Confirmar?' : 'Pular vez'}
                  </button>
                )}
                {!isDrawer && (
                  <button className="up-btn" onClick={denunciarDesenho} disabled={!podeDenunciar}
                    title={jaDenunciei ? 'Você já denunciou este desenho'
                      : 'Denunciar desenho impróprio ou fora do tema — com votos suficientes, a rodada encerra e quem desenhou não pontua'}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
                      border: `1px solid ${jaDenunciei ? T.border : UP.red}`,
                      cursor: podeDenunciar ? 'pointer' : 'not-allowed',
                      background: jaDenunciei ? 'transparent' : `${UP.red}14`,
                      color: jaDenunciei ? T.textD : UP.red, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <IcoFlag size={13} />{jaDenunciei ? 'Denunciado' : 'Denunciar'}
                    {totalVotantes > 0 && ` (${state?.reports?.length || 0}/${totalVotantes})`}
                  </button>
                )}
                <div className={secsLeft <= 5 ? 'up-urgent' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 999,
                    background: secsLeft <= 10 ? '#E6394622' : T.surfaceSub, transition: 'background .3s, color .3s',
                    color: secsLeft <= 10 ? '#E63946' : T.text, fontWeight: 800, fontSize: 13.5, minWidth: 54, justifyContent: 'center' }}>
                  {secsLeft}s
                </div>
              </>
            ) : (
              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: T.textT, fontWeight: 600 }}>
                {state?.phase === 'reveal' ? <>A palavra era <b style={{ color: A }}>{state.lastWord}</b>
                  {state.denunciada && <span style={{ color: UP.red, fontWeight: 700 }}> · 🚩 denunciado</span>}</>
                  : state?.phase === 'over' ? 'Fim de jogo!'
                  : `Aguardando jogadores (mínimo ${MIN_PLAYERS})`}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${T.border}`, boxShadow: T.sh, background: '#fff' }}>
            <canvas ref={canvasRef}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
              style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none',
                cursor: isDrawer ? (tool === 'fill' ? 'cell' : 'crosshair') : 'default' }} />

            {state?.phase !== 'drawing' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 20,
                overflowY: 'auto', background: 'rgba(255,255,255,.9)' }}>
                <Mascote size={112} halo big />
                {state?.phase === 'over' ? (
                  <>
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 21, fontWeight: 800, color: T.text }}>
                      🏆 {ranked[0]?.name?.split(' ')[0] || '—'} venceu!
                    </div>
                    <div style={{ fontSize: 13, color: T.textT }}>
                      {ranked.slice(0, 3).map((p, i) => `${i + 1}º ${p.name.split(' ')[0]} — ${p.pts} pts`).join('   ·   ')}
                    </div>
                  </>
                ) : state?.phase === 'reveal' ? (
                  <div style={{ textAlign: 'center' }}>
                    {state.pulada && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: UP.orange, marginBottom: 5 }}>
                        ⏭ {state.drawer?.split(' ')[0]} passou a vez
                      </div>
                    )}
                    {state.denunciada && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: UP.red, marginBottom: 5 }}>
                        🚩 desenho denunciado — {state.drawer?.split(' ')[0]} não pontuou nesta rodada
                      </div>
                    )}
                    <div style={{ fontFamily: 'var(--font-brand)', fontSize: 21, fontWeight: 800, color: T.text }}>
                      A palavra era <span style={{ color: A }}>{state.lastWord}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text }}>
                    {state?.nome || 'Sala'}
                  </div>
                )}

                {/* O tema é o da sala, definido na criação — não se vota. */}
                {noLobby && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999,
                    background: `${A}12`, border: `1px solid ${A}44` }}>
                    <span style={{ fontSize: 16 }}>{temaAtual.emoji}</span>
                    <span style={{ fontSize: 12.5, color: T.text, fontWeight: 700 }}>Tema: {temaAtual.nome}</span>
                  </div>
                )}

                {noLobby && (
                  isHost ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span style={{ fontSize: 12, color: T.textT, fontWeight: 600 }}>Cada um desenha</span>
                        {LAP_OPTIONS.map(n => (
                          <button key={n} onClick={() => setLaps(n)}
                            style={{ minWidth: 30, padding: '5px 9px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                              border: laps === n ? `1.5px solid ${A}` : `1px solid ${T.border}`,
                              background: laps === n ? `${A}14` : 'transparent', color: laps === n ? A : T.text }}>
                            {n}×
                          </button>
                        ))}
                        <span style={{ fontSize: 11.5, color: T.textD }}>
                          = {laps * Math.max(players.length, 1)} rodadas
                          {' '}(~{Math.round(laps * Math.max(players.length, 1) * (ROUND_MS + REVEAL_MS) / 60000)} min)
                        </span>
                      </div>
                      {/* `!state` também trava: começar antes do state da sala
                          carregar deixava a partida SEM TEMA (ver startRound). */}
                      <button className="up-btn" onClick={startGame} disabled={players.length < MIN_PLAYERS || !state}
                        style={{ padding: '11px 26px', borderRadius: 999, border: 'none',
                          background: (players.length < MIN_PLAYERS || !state) ? T.textD : `linear-gradient(135deg, ${A}, ${A2})`,
                          color: '#fff', fontSize: 14, fontWeight: 800,
                          cursor: (players.length < MIN_PLAYERS || !state) ? 'not-allowed' : 'pointer',
                          boxShadow: (players.length < MIN_PLAYERS || !state) ? 'none' : `0 6px 18px ${AG}` }}>
                        {!state ? 'Carregando sala...' : state.phase === 'over' ? 'Jogar de novo' : 'Começar partida'}
                      </button>
                      {players.length < MIN_PLAYERS && (
                        <div style={{ fontSize: 12, color: T.textT }}>
                          Chame mais gente! Precisa de pelo menos {MIN_PLAYERS} jogadores nesta sala.
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: T.textT, fontStyle: 'italic' }}>
                      Esperando {host?.split(' ')[0] || 'o host'} começar a partida...
                    </div>
                  )
                )}
              </div>
            )}

            {state?.phase === 'drawing' && !isDrawer && (
              <div className="up-drawing-badge" style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                padding: '4px 12px', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#fff',
                fontSize: 11.5, fontWeight: 700, pointerEvents: 'none' }}>
                {iHit ? '✓ você acertou!' : `${state.drawer?.split(' ')[0]} está desenhando`}
              </div>
            )}

            {/* ── "Agora é a vez de fulano" — Uniko grande + nome ── */}
            {vez && (
              <div className="up-turn" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, pointerEvents: 'none',
                background: `linear-gradient(160deg, ${A}f2, ${A2}ee 60%, ${A3}f2)` }}>
                <div style={{ position: 'absolute', inset: 0, opacity: .2,
                  background: 'radial-gradient(circle at 20% 25%, #fff 0%, transparent 40%), radial-gradient(circle at 80% 75%, #fff 0%, transparent 38%)' }} />
                {/* Avatar gigante com anéis pulsando */}
                <div className="up-avatar" style={{ position: 'relative', color: '#fff' }}>
                  <div className="up-ring" />
                  <div className="up-ring up-ring2" />
                  <img src={vez.photo || MASCOTE} alt=""
                    style={{ width: 132, height: 132, borderRadius: '50%', objectFit: 'cover',
                      border: '5px solid rgba(255,255,255,.95)', background: '#fff',
                      boxShadow: '0 14px 44px rgba(0,0,0,.4)' }} />
                </div>
                <div style={{ textAlign: 'center', zIndex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.14em',
                    textTransform: 'uppercase', marginBottom: 5 }}>
                    {vez.eu ? 'Sua vez de desenhar!' : 'Agora é a vez de'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-brand)', fontSize: 38, fontWeight: 800, color: '#fff',
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

          {/* Barra de ferramentas */}
          {isDrawer && (
            <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 12px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: T.sh, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 5 }}>{TOOLS.map(btnTool)}</div>
              <div style={{ width: 1, height: 40, background: T.border }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => { setColor(c); if (tool === 'eraser') setTool('brush'); }} title={c}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', transition: 'transform .12s',
                      border: color === c ? `3px solid ${A}` : `1px solid ${T.border}`,
                      transform: color === c ? 'scale(1.12)' : 'none' }} />
                ))}
              </div>
              <div style={{ width: 1, height: 40, background: T.border }} />
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {SIZES.map(s => (
                  <button key={s} onClick={() => setSize(s)} title={`${s}px`}
                    style={{ width: 38, height: 38, borderRadius: 9, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      border: size === s ? `2px solid ${A}` : `1px solid ${T.border}`,
                      background: size === s ? `${A}14` : 'transparent' }}>
                    <div style={{ width: Math.min(s, 22), height: Math.min(s, 22), borderRadius: '50%', background: T.text }} />
                  </button>
                ))}
              </div>
              {(tool === 'rect' || tool === 'circle') && (
                <>
                  <div style={{ width: 1, height: 40, background: T.border }} />
                  <button onClick={() => setFilled(f => !f)} title="Preencher a forma"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                      border: filled ? `2px solid ${A}` : `1px solid ${T.border}`,
                      background: filled ? `${A}14` : 'transparent', color: filled ? A : T.text, fontSize: 12, fontWeight: 700 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid currentColor',
                      background: filled ? 'currentColor' : 'transparent' }} />
                    {filled ? 'Cheio' : 'Vazado'}
                  </button>
                </>
              )}
              <div style={{ width: 1, height: 40, background: T.border }} />
              <button onClick={doUndo} title="Desfazer"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 54, padding: '8px 4px',
                  borderRadius: 10, cursor: 'pointer', border: `1px solid ${T.border}`, background: 'transparent', color: T.text }}>
                <IcoUndo size={20} /><span style={{ fontSize: 9.5, fontWeight: 700 }}>Desfazer</span>
              </button>
              <button onClick={doClear} title="Limpar tudo"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 54, padding: '8px 4px',
                  borderRadius: 10, cursor: 'pointer', border: '1px solid #E6394640', background: '#E6394610', color: '#E63946' }}>
                <IcoTrash size={20} /><span style={{ fontSize: 9.5, fontWeight: 700 }}>Limpar</span>
              </button>
            </div>
          )}
        </div>

        {/* Chat — `height:100%` + `overflow:hidden` fecham a altura do card no
            tamanho da linha do grid. Sem isso ele ia crescendo junto com o chat
            (e aí a lista nunca "transborda", então a barra de rolagem nunca
            aparecia — o card é que esticava). */}
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, display: 'flex',
          flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', boxShadow: T.sh }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 800,
            color: T.textT, letterSpacing: '.08em', flexShrink: 0 }}>PALPITES</div>
          {/* minHeight:0 + flexShrink nos irmãos: sem isso a lista não encolhe abaixo
              do próprio conteúdo e empurra o card inteiro conforme o chat enche. */}
          <div className="up-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
            padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {!chat.length && (
              <div style={{ fontSize: 12, color: T.textD, textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
                Escreva seu palpite aqui.<br />Quem acerta primeiro leva mais pontos!
              </div>
            )}
            {chat.map(m => (
              <div key={m.id} className="up-chat" style={{ fontSize: 12.5, lineHeight: 1.45,
                color: m.kind === 'hit' ? '#28a060' : (m.kind === 'quase' || m.kind === 'quase-oculto') ? UP.orange
                  : m.kind === 'sys' ? T.textT : T.text,
                fontStyle: m.kind === 'sys' ? 'italic' : 'normal',
                fontWeight: (m.kind === 'quase' || m.kind === 'quase-oculto') ? 700 : 400,
                background: m.kind === 'hit' ? '#28a06012' : (m.kind === 'quase' || m.kind === 'quase-oculto') ? `${UP.orange}14` : 'transparent',
                border: (m.kind === 'quase' || m.kind === 'quase-oculto') ? `1px solid ${UP.orange}44` : 'none',
                borderRadius: (m.kind === 'hit' || m.kind === 'quase' || m.kind === 'quase-oculto') ? 7 : 0,
                padding: (m.kind === 'hit' || m.kind === 'quase' || m.kind === 'quase-oculto') ? '4px 7px' : 0,
                opacity: m.kind === 'muted' ? .5 : 1 }}>
                {m.kind === 'hit' && <IcoCheck size={12} />}{' '}
                {m.kind !== 'quase' && <b style={{ fontWeight: 700 }}>{m.name.split(' ')[0]}</b>}{' '}
                <span>{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: 9, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 6, flexShrink: 0 }}>
            <input value={guess} onChange={e => setGuess(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendGuess()}
              placeholder={isDrawer ? 'Você está desenhando...' : iHit ? 'Você acertou!' : 'Seu palpite...'}
              disabled={isDrawer}
              style={{ flex: 1, minWidth: 0, padding: '8px 11px', borderRadius: 9, border: `1px solid ${T.border}`,
                background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 12.5,
                fontFamily: 'var(--font-body)', outline: 'none' }} />
            <button onClick={sendGuess} disabled={isDrawer}
              style={{ width: 34, borderRadius: 9, border: 'none', cursor: isDrawer ? 'not-allowed' : 'pointer',
                background: isDrawer ? T.textD : `linear-gradient(135deg, ${A}, ${A2})`, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoSend size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   RAIZ — mantém a presence global (quem está em qual sala) e alterna
   lobby ⇄ sala.
   ═══════════════════════════════════════════════════════════════════════════ */
const TabUnikoPaint = () => {
  const name = useMemo(() => myName(), []);
  const [photo, setPhoto] = useState(() => myPhotoSrc());   // URL — não o data URL!
  const [room, setRoom]   = useState(null);       // null = lobby
  const [todos, setTodos] = useState([]);         // [{name, photo, room}]
  const [sqlMissing, setSqlMissing] = useState(false);
  const [picker, setPicker] = useState(false);
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

  /* Tempo jogado (missões da Prisma Store): conta só DENTRO de uma sala — ficar
     olhando o lobby não é jogar. Ver hooks/useGamePlaytime.js. */
  useGamePlaytime('paint', room !== null);

  // Migração rodada?
  useEffect(() => {
    supabase.from('uniko_paint_state').select('id').limit(1).then(({ error }) => {
      if (semTabela(error)) setSqlMissing(true);
    });
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
    // A ÚLTIMA entrada de cada key, nunca a primeira: quando sobra entrada velha
    // (acontece), a primeira é a desatualizada — era ela que a UI mostrava.
    const list = Object.values(ch.presenceState())
      .map(arr => arr[arr.length - 1])
      .filter(Boolean)
      .map(p => ({ name: p.name, photo: p.photo, room: p.room, entrouEm: p.entrouEm }));
    const seen = new Set();
    setTodos(list.filter(p => p?.name && (seen.has(p.name) ? false : (seen.add(p.name), true))));
  }, []);

  useEffect(() => {
    const ch = supabase.channel('uniko-paint-presence', { config: { presence: { key: name } } });
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
      const r = await ch.track({ name, photo, room, entrouEm });
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
    return l.some(p => p.name === name) ? l : [{ name, photo, room }, ...l];
  }, [porSala, room, name, photo]);

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
  // Duas coisas ao escolher um Uniko:
  //  • foto de perfil do Portal = data URL 300x300 (mesmo caminho da aba Coleção);
  //  • foto do jogo/presence = a URL da arte (leve o bastante pra trafegar).
  const choosePhoto = (img) => {
    try { localStorage.setItem(PHOTO_SRC_KEY, img); } catch { /* sem localStorage */ }
    setPhoto(img);          // presence reanuncia sozinho no effect de [photo]
    setPicker(false);
    const im = new Image(); im.crossOrigin = 'anonymous';
    const salvaPerfil = (val) => {
      saveUserPhoto(val);
      try { const a = getAuthUser(); localStorage.setItem(a?.cpf ? `uniko_photo_${a.cpf}` : `uniko_photo_${USER.name}`, val); }
      catch { /* localStorage cheio/bloqueado: a foto ainda vale nesta sessão */ }
    };
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 300;
        c.getContext('2d').drawImage(im, 0, 0, 300, 300);
        salvaPerfil(c.toDataURL('image/png'));
      } catch { salvaPerfil(img); }
    };
    im.onerror = () => salvaPerfil(img);
    im.src = img;
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
      {room
        ? <Sala roomId={room} name={name} photo={photo} players={naSala}
            onLeave={() => setRoom(null)} onAbrirPicker={() => setPicker(true)} />
        : <Lobby name={name} photo={photo} porSala={porSala}
            onEnter={setRoom} onAbrirPicker={() => setPicker(true)} />}

      {picker && (
        <div onClick={() => setPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,6,24,.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: cardBg, borderRadius: 18, border: `1px solid ${T.border}`, padding: 22,
              maxWidth: 680, width: '100%', maxHeight: '84vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.4)' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              Escolha seu Uniko
            </div>
            <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 18, lineHeight: 1.5 }}>
              Vale pro Uniko Paint <b>e</b> como sua foto de perfil no Portal. Só aparecem os Unikos que você já capturou —
              cada um tem suas variações.
            </div>
            {myUnikos.map(u => {
              const vars = hasAssistantSkin(u.id) ? getSkinVariations(u.id) : [];
              const opts = vars.length ? vars : [{ label: 'Normal', img: u.img }];
              return (
                <div key={u.id} style={{ marginBottom: 18 }}>
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
            <button onClick={() => setPicker(false)}
              style={{ marginTop: 6, width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`,
                background: 'transparent', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export { TabUnikoPaint };
export default TabUnikoPaint;
