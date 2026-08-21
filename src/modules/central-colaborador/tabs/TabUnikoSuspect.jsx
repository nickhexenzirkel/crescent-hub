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
import { T } from '../../../contexts/theme';
import { supabase, getAuthUser, USER, saveUserPhoto } from '../../../contexts/user';
import { CAPTURE_UNIKOS, getCapturedCollection, syncCollectionFromServer, getCustomUnikos } from '../../../shared/captureUniko';
import { getSkinVariations, hasAssistantSkin } from '../../../shared/assistantSkin';

/* ── Paleta casa de praia ── */
const AGUA = '#0EA5B7', CEU = '#5FC9E8', AREIA = '#F2C879';
const IMPOSTOR_COR = '#DC2626', TRIPULANTE_COR = '#0EA5B7';
const AG = 'rgba(14,165,183,.35)';

const MIN_PLAYERS = 2;                 // temporário (testando) — subir de novo antes do lançamento
const ROOM_TTL_MS = 20 * 60 * 1000;    // sala vazia parada há 20min = lixo

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
const MAPA_IMG = '/uniko-suspect-mapa.png';
const MAP_W = 1672, MAP_H = 941;

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
const normalizeTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const TASK_TYPE_BY_LABEL = {
  'limpar geladeira': 'geladeira',
  'remendar flaminga': 'flamingo',
  'coloque os chocolates no bolso': 'chocolates',
  'lavar louca': 'louca',
  'consertar energia': 'energia',
  'concertar energia': 'energia',   // erro de digitação comum ("concertar" em vez de "consertar") — aceita os dois
  'fazer churrasco': 'churrasco',
};
const taskTypeFor = (label) => TASK_TYPE_BY_LABEL[normalizeTxt(label)] || 'generica';
const TASK_PROXIMIDADE = 75;   // distância (px do mapa) pra aparecer o prompt "Pressione E"

/* ── Matar (ago/2026) — só o Impostor, com recarga entre mortes. ── */
const KILL_PROXIMIDADE = 90;      // distância (px do mapa) pra aparecer o botão de Matar
const KILL_COOLDOWN_MS = 25000;   // tempo de recarga entre mortes, por impostor
const MORTE_ANIM_MS = 3200;       // duração da animação de morte na tela da vítima
const CORPO_PROXIMIDADE = 90;     // distância (px do mapa) pra aparecer o botão de Reportar

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
const LUZ_RAIO = { tripulante: 10, impostor: 16, fantasma: 60 };   // fantasma enxerga praticamente tudo
const lightGradientBg = (xPct, yPct, raio) => `radial-gradient(circle at ${xPct}% ${yPct}%,
  transparent 0%, transparent ${raio}%,
  rgba(4,8,16,.32) ${raio + 10}%,
  rgba(3,6,12,.62) ${raio + 22}%,
  rgba(2,4,9,.85) ${raio + 38}%,
  rgba(1,2,6,.97) ${raio + 58}%)`;

/* ── Movimento livre em tempo real ── */
const PLAYER_R = 36;              // "raio" do boneco em pixels do mapa (clamp nas bordas)
const MOVE_SPEED = 200;           // pixels do mapa por segundo (reduzido a pedido do usuário — era 300)
const POS_SEND_MS = 90;           // intervalo mínimo entre broadcasts de posição
const KEY_DIR = {                 // WASD + setas → direção
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
};
// Hash determinístico (mesma técnica do hintOrder do Stop) — spawn consistente
// sem precisar sincronizar nada: todo cliente calcula o mesmo ponto pro mesmo nome.
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
// Todo mundo nasce perto da sala de estar (centro da casa na arte), espalhado por hash do nome.
const SPAWN_RECT = { x: 640, y: 330, w: 260, h: 150 };   // cabe folgado dentro da zona 'sala'
const spawnFor = (playerName) => {
  const h = hashStr(playerName || '?');
  const x = SPAWN_RECT.x + (h % SPAWN_RECT.w);
  const y = SPAWN_RECT.y + ((h >> 8) % SPAWN_RECT.h);
  return { x, y };
};

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
@keyframes susWalk  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5%); } }
@keyframes susTwinkle { 0%,100% { transform: scale(1); opacity: .92; } 50% { transform: scale(1.18); opacity: 1; } }
@keyframes susEmergPulse { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 6px #DC2626) drop-shadow(0 0 14px #DC262699); }
  50% { transform: scale(1.22); filter: drop-shadow(0 0 12px #DC2626) drop-shadow(0 0 26px #DC2626cc); } }
/* ── Animação de morte (tela cheia da vítima): recuo do impostor, disparo
   do laser e a vítima levando o tiro (flash branco → treme → apaga/vira
   fantasma). Tempos batem com MORTE_ANIM_MS. */
@keyframes susDeathBeam { 0%,35% { transform: translateY(-50%) scaleX(0); opacity: 0; }
  40% { transform: translateY(-50%) scaleX(1); opacity: 1; } 70%,100% { transform: translateY(-50%) scaleX(1); opacity: .8; } }
@keyframes susDeathRecoil { 0%,38% { transform: translateX(0) scale(1); } 42% { transform: translateX(-10px) scale(1.06); } 60%,100% { transform: translateX(0) scale(1); } }
@keyframes susDeathVictim { 0%,38% { filter: brightness(1) grayscale(0); transform: translateX(0) rotate(0); }
  42% { filter: brightness(3.2) grayscale(0); transform: translateX(10px); }
  50% { filter: brightness(1.3) grayscale(.5); transform: translateX(-8px) rotate(-5deg); }
  100% { filter: brightness(.85) grayscale(1); transform: translateX(0) rotate(-9deg) translateY(8px); opacity: .5; } }
@keyframes susDeathText { 0%,32% { opacity: 0; transform: scale(.6) translateY(10px); }
  46% { opacity: 1; transform: scale(1.1) translateY(0); } 60%,100% { opacity: 1; transform: scale(1) translateY(0); } }
.sus-fade   { animation: susFade .35s ease both; }
.sus-pop    { animation: susPop .3s cubic-bezier(.2,1.4,.4,1) both; }
.sus-reveal { animation: susReveal .55s cubic-bezier(.2,1.4,.4,1) both; }
.sus-float  { animation: susFloat 2.6s ease-in-out infinite; }
.sus-walk   { animation: susWalk .45s ease-in-out infinite; }
.sus-twinkle { animation: susTwinkle 1.6s ease-in-out infinite; }
.sus-emerg  { animation: susEmergPulse 1.1s ease-in-out infinite; }
.sus-death-beam   { animation: susDeathBeam 1.6s cubic-bezier(.2,.9,.3,1) both; }
.sus-death-recoil { animation: susDeathRecoil 1.6s ease both; }
.sus-death-victim { animation: susDeathVictim 1.6s ease both; }
.sus-death-text   { animation: susDeathText 1.6s ease both; }
.sus-btn { transition: transform .12s, filter .12s; }
.sus-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
.sus-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .sus-fade,.sus-pop,.sus-reveal,.sus-float,.sus-walk,.sus-twinkle,.sus-emerg,
  .sus-death-beam,.sus-death-recoil,.sus-death-victim,.sus-death-text { animation: none !important; } }
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
const TAREFA_DISPONIVEL_IMG = '/uniko-suspect-tarefa-disponivel.png';
const TAREFA_CONCLUIDA_IMG = '/uniko-suspect-tarefa-concluida.png';
const INICIAR_REUNIAO_IMG = '/uniko-suspect-iniciar-reuniao.png';
const BOTAO_MATAR_IMG = '/uniko-suspect-botao-matar.png';
const BOTAO_REPORTAR_IMG = '/uniko-suspect-botao-reportar.png';
const CORPO_IMG = '/uniko-suspect-uniko-morto.png';   // cadáver no chão onde o impostor matou

/* ── Tela de morte (ago/2026): só a VÍTIMA vê — o impostor "atira" um laser
   nela. Full-screen preto, texto "Você foi morto!" com glow (inspirado na
   referência que o usuário mandou) + os dois Unikos com o feixe entre eles. */
const MORTE_IMG = '/uniko-suspect-voce-foi-morto.png';
const MorteOverlay = ({ matadorFoto, vitimaFoto }) => (
  // `position:absolute` (não `fixed`) preenchendo o `gameWrapRef` (que agora
  // tem `position:relative`) — cobre a TELA DO JOGO inteira (cabeçalho + mapa),
  // tanto no modo normal quanto em tela cheia, sem depender do viewport do
  // navegador (que ficava só cobrindo uma parte quando havia layout por cima).
  <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: '#000', borderRadius: 16,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5vh', overflow: 'hidden' }}>
    <img src={MORTE_IMG} alt="Você foi morto!" className="sus-death-text"
      style={{ width: 'min(80vw, 560px)', filter: 'drop-shadow(0 0 24px rgba(220,38,38,.55))' }} />
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10vw', width: '100%', maxWidth: 760 }}>
      <img src={matadorFoto || '/UNIKO_NEW.png'} alt="" className="sus-death-recoil"
        style={{ width: '18vw', maxWidth: 120, minWidth: 70, aspectRatio: '1/1', borderRadius: '50%', objectFit: 'cover',
          border: '3px solid #DC2626', boxShadow: '0 0 26px rgba(220,38,38,.65)', zIndex: 2, background: '#111' }} />
      <div className="sus-death-beam" style={{ position: 'absolute', left: '24%', right: '24%', top: '50%', height: 8,
        transformOrigin: 'left center', background: 'linear-gradient(90deg, #DC2626, #fff 50%, #DC2626)',
        boxShadow: '0 0 18px 4px #DC2626, 0 0 40px 12px rgba(220,38,38,.6)', borderRadius: 999, zIndex: 1 }} />
      <img src={vitimaFoto || '/UNIKO_NEW.png'} alt="" className="sus-death-victim"
        style={{ width: '18vw', maxWidth: 120, minWidth: 70, aspectRatio: '1/1', borderRadius: '50%', objectFit: 'cover',
          border: '3px solid #666', zIndex: 2, background: '#111' }} />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MINI-JOGOS DE TAREFA — um por tipo (ver taskTypeFor). Cada um recebe
   `onComplete` e chama quando o jogador termina; visual simples (emoji +
   CSS), no mesmo espírito "clique/segurar" combinado com o time (ver
   decisão de design registrada em memória: tarefas são cliques simples,
   não mini-jogos complexos — mas cada uma tem uma mecânica própria pra não
   ficar todas iguais).
   ═══════════════════════════════════════════════════════════════════════════ */
const taskBtnCss = { border: 'none', background: 'none', cursor: 'pointer', padding: 0 };

// Cada 💩/🍫/rasgo agora exige MAIS DE UM clique (`ALVO_CLIQUES`) antes de
// sumir — só um clique ficava instantâneo demais (pedido do usuário: as
// tarefas estavam rápidas demais). O número de itens também aumentou.
const TaskGeladeira = ({ onComplete }) => {
  const POS = [[14, 20], [37, 16], [60, 20], [83, 24], [22, 60], [45, 66], [68, 60], [88, 68]];
  const ALVO_CLIQUES = 3;
  const [cliques, setCliques] = useState(() => POS.map(() => 0));
  const restam = cliques.map((c, i) => i).filter(i => cliques[i] < ALVO_CLIQUES);
  useEffect(() => { if (restam.length === 0) onComplete(); }, [restam.length, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique VÁRIAS vezes em cada 💩 pra tirar da geladeira!</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, background: 'linear-gradient(180deg,#EAF6FF,#D6ECFB)', border: `2px solid ${T.border}`, overflow: 'hidden' }}>
        {[1, 2].map(i => <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 33}%`, height: 2, background: 'rgba(0,0,0,.12)' }} />)}
        {restam.map(i => (
          <button key={i} style={{ ...taskBtnCss, position: 'absolute', left: `${POS[i][0]}%`, top: `${POS[i][1]}%`, transform: 'translate(-50%,-50%)',
            fontSize: 30, opacity: 1 - (cliques[i] / ALVO_CLIQUES) * .5 }}
            onClick={() => setCliques(c => c.map((v, j) => j === i ? v + 1 : v))} aria-label="Remover">💩</button>
        ))}
      </div>
    </div>
  );
};

const TaskFlamingo = ({ onComplete }) => {
  const POS = [[26, 26], [62, 22], [82, 42], [36, 64], [66, 68], [50, 40]];
  const ALVO_CLIQUES = 3;
  const [cliques, setCliques] = useState(() => POS.map(() => 0));
  const done = cliques.every(c => c >= ALVO_CLIQUES);
  useEffect(() => { if (done) onComplete(); }, [done, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique VÁRIAS vezes em cada rasgo (❌) pra remendar a boia!</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, background: 'linear-gradient(180deg,#E6FBFF,#C9F1FB)', border: `2px solid ${T.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 92 }}>🦩</div>
        {POS.map((pos, i) => {
          const ok = cliques[i] >= ALVO_CLIQUES;
          return (
            <button key={i} disabled={ok} style={{ ...taskBtnCss, position: 'absolute', left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%,-50%)', fontSize: 26, cursor: ok ? 'default' : 'pointer' }}
              onClick={() => setCliques(c => c.map((v, j) => j === i ? v + 1 : v))}>{ok ? '🩹' : '❌'}</button>
          );
        })}
      </div>
    </div>
  );
};

const TaskChocolates = ({ onComplete }) => {
  const POS = [[12, 22], [32, 18], [52, 22], [72, 18], [90, 24], [20, 58], [42, 62], [64, 58], [84, 62]];
  const ALVO_CLIQUES = 3;
  const [cliques, setCliques] = useState(() => POS.map(() => 0));
  const restam = cliques.map((c, i) => i).filter(i => cliques[i] < ALVO_CLIQUES);
  const pegos = POS.length - restam.length;
  useEffect(() => { if (restam.length === 0) onComplete(); }, [restam.length, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique VÁRIAS vezes em cada 🍫 pra guardar no bolso! ({pegos}/{POS.length})</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, background: 'linear-gradient(180deg,#F8F0E3,#EFDFC4)', border: `2px solid ${T.border}`, overflow: 'hidden' }}>
        {restam.map(i => (
          <button key={i} style={{ ...taskBtnCss, position: 'absolute', left: `${POS[i][0]}%`, top: `${POS[i][1]}%`, transform: 'translate(-50%,-50%)',
            fontSize: 28, opacity: 1 - (cliques[i] / ALVO_CLIQUES) * .5 }}
            onClick={() => setCliques(c => c.map((v, j) => j === i ? v + 1 : v))} aria-label="Pegar">🍫</button>
        ))}
        <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 26 }}>👖</div>
      </div>
    </div>
  );
};

const TaskLouca = ({ onComplete }) => {
  const N = 4, ALVO = 9;
  const [cliques, setCliques] = useState(() => Array(N).fill(0));
  const done = cliques.every(c => c >= ALVO);
  useEffect(() => { if (done) onComplete(); }, [done, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique bastante em cada peça pra esfregar até brilhar!</div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', padding: '10px 0' }}>
        {Array.from({ length: N }).map((_, i) => {
          const p = Math.min(1, cliques[i] / ALVO);
          return (
            <button key={i} disabled={p >= 1} style={{ ...taskBtnCss, cursor: p >= 1 ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
              onClick={() => setCliques(c => c.map((v, j) => j === i ? v + 1 : v))}>
              <div style={{ fontSize: 44, filter: `grayscale(${1 - p}) sepia(${(1 - p) * .6})`, transition: 'filter .15s' }}>{i % 2 === 0 ? '🍽️' : '🥤'}</div>
              <div style={{ width: 52, height: 6, borderRadius: 999, background: 'rgba(0,0,0,.12)', overflow: 'hidden' }}>
                <div style={{ width: `${p * 100}%`, height: '100%', background: p >= 1 ? '#16A34A' : AGUA, transition: 'width .15s' }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FIOS = [{ cor: '#DC2626', nome: 'vermelho' }, { cor: '#2563EB', nome: 'azul' }, { cor: '#EAB308', nome: 'amarelo' },
  { cor: '#16A34A', nome: 'verde' }, { cor: '#A855F7', nome: 'roxo' }];
const TaskEnergia = ({ onComplete }) => {
  const [direita] = useState(() => [...FIOS].sort(() => Math.random() - 0.5));
  const [ligados, setLigados] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => { if (ligados.length === FIOS.length) onComplete(); }, [ligados, onComplete]);
  const clicarEsquerda = (cor) => { if (!ligados.includes(cor)) setSelecionado(cor); };
  const clicarDireita = (cor) => {
    if (!selecionado) return;
    if (selecionado === cor) { setLigados(l => [...l, cor]); setSelecionado(null); }
    else { setErro(cor); setTimeout(() => setErro(null), 350); setSelecionado(null); }
  };
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique num fio à esquerda e depois no encaixe da MESMA cor à direita!</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FIOS.map(f => (
            <button key={f.cor} disabled={ligados.includes(f.cor)} style={{ ...taskBtnCss, cursor: ligados.includes(f.cor) ? 'default' : 'pointer',
              width: 46, height: 22, borderRadius: 999, background: f.cor, opacity: ligados.includes(f.cor) ? .35 : 1,
              boxShadow: selecionado === f.cor ? `0 0 0 3px ${f.cor}55` : 'none' }} onClick={() => clicarEsquerda(f.cor)} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {direita.map(f => (
            <button key={f.cor} disabled={ligados.includes(f.cor)} style={{ ...taskBtnCss, cursor: ligados.includes(f.cor) ? 'default' : 'pointer',
              width: 46, height: 22, borderRadius: 999, border: `3px solid ${erro === f.cor ? '#DC2626' : f.cor}`, background: ligados.includes(f.cor) ? f.cor : 'transparent' }}
              onClick={() => clicarDireita(f.cor)} />
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 20 }}>{ligados.length === FIOS.length ? '💡' : '🔌'}</div>
    </div>
  );
};

const TaskChurrasco = ({ onComplete }) => {
  const ALVO_HITS = 6;
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [hits, setHits] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const posRef = useRef(0);
  const zona = [46, 58];   // faixa bem mais estreita que antes — precisa de mira
  useEffect(() => {
    let raf;
    const vel = 1.2 + hits * 0.22;
    const tick = () => {
      posRef.current += vel * dir;
      if (posRef.current >= 100) { posRef.current = 100; setDir(-1); }
      if (posRef.current <= 0) { posRef.current = 0; setDir(1); }
      setPos(posRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dir, hits]);
  useEffect(() => { if (hits >= ALVO_HITS) onComplete(); }, [hits, onComplete]);
  const virar = () => {
    const noPonto = posRef.current >= zona[0] && posRef.current <= zona[1];
    if (noPonto) { setHits(h => h + 1); setFeedback('🔥 boa!'); } else { setFeedback('quase...'); }
    setTimeout(() => setFeedback(null), 500);
  };
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique em "Virar!" quando o 🍖 estiver na faixa verde! ({hits}/{ALVO_HITS})</div>
      <div style={{ position: 'relative', height: 26, borderRadius: 999, background: 'rgba(0,0,0,.1)', margin: '0 6px 14px' }}>
        <div style={{ position: 'absolute', left: `${zona[0]}%`, width: `${zona[1] - zona[0]}%`, top: 0, bottom: 0, background: 'rgba(22,163,74,.45)', borderRadius: 999 }} />
        <div style={{ position: 'absolute', left: `${pos}%`, top: '50%', transform: 'translate(-50%,-50%)', fontSize: 24 }}>🍖</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <button className="sus-btn" onClick={virar} style={{ padding: '9px 22px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          background: `linear-gradient(135deg, #F97316, #DC2626)`, boxShadow: '0 6px 16px rgba(220,38,38,.35)' }}>🔥 Virar!</button>
        {feedback && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: feedback.startsWith('🔥') ? '#16A34A' : T.textT }}>{feedback}</div>}
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

const TASK_MINIGAMES = { geladeira: TaskGeladeira, flamingo: TaskFlamingo, chocolates: TaskChocolates, louca: TaskLouca, energia: TaskEnergia, churrasco: TaskChurrasco, generica: TaskGenerica };

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

const ReuniaoEmergencia = ({ reuniao, players, name, papeis, mensagens, chatTexto, setChatTexto, onEnviarChat, onVotar, onRetirarVoto, onIniciarVotacao }) => {
  // `Date.now()` só pode ser chamado dentro do efeito (impuro) — o render lê
  // só o estado `agora`, que o efeito atualiza 2x/s (regra do React Compiler).
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setAgora(Date.now()), 500); return () => clearInterval(iv); }, []);
  const chatBoxRef = useRef(null);
  useEffect(() => { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }, [mensagens]);

  const duracao = reuniao.fase === 'resultado' ? REUNIAO_RESULTADO_MS : REUNIAO_FASE_MS;
  const restante = Math.max(0, Math.ceil((duracao - (agora - reuniao.faseIniciadaEm)) / 1000));
  const meuVoto = reuniao.votos?.[name];
  const jaVotei = meuVoto !== undefined;
  const votantes = new Set(Object.keys(reuniao.votos || {}));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 640, margin: '0 auto', padding: '4px 4px 10px' }}>
      <div className="sus-pop" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30 }}>🚨</div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: '#DC2626' }}>
          Reunião de emergência — chamada por {reuniao.chamadaPor.split(' ')[0]}
        </div>
        <div style={{ fontSize: 13, color: T.textT, marginTop: 2 }}>
          {reuniao.fase === 'chat' && `Conversem! ${restante}s pra votação começar.`}
          {reuniao.fase === 'votacao' && `Votem em quem acham que é o Impostor. ${restante}s restantes.`}
          {reuniao.fase === 'resultado' && (reuniao.resultado?.vencedor ? 'Fim de jogo!' : `Retomando o jogo em ${restante}s...`)}
        </div>
      </div>

      {reuniao.fase !== 'resultado' && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface || '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={chatBoxRef} style={{ height: 220, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mensagens.length === 0 && <div style={{ fontSize: 12, color: T.textD, textAlign: 'center', marginTop: 20 }}>Ninguém falou nada ainda...</div>}
            {mensagens.map(m => (
              <div key={m.id} style={{ fontSize: 12.5, color: T.text }}>
                <b style={{ color: m.autor === name ? AGUA : T.textT }}>{m.autor.split(' ')[0]}:</b> {m.texto}
              </div>
            ))}
          </div>
          {reuniao.fase === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={chatTexto} onChange={e => setChatTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onEnviarChat(); }}
                  maxLength={240} placeholder="Escreva algo suspeito..."
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surfaceInput || 'rgba(0,0,0,.025)', color: T.text, fontSize: 13 }} />
                <button className="sus-btn" onClick={onEnviarChat} disabled={!chatTexto.trim()}
                  style={{ padding: '9px 16px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: chatTexto.trim() ? 'pointer' : 'not-allowed',
                    background: chatTexto.trim() ? `linear-gradient(135deg, ${AGUA}, ${CEU})` : T.textD }}>Enviar</button>
              </div>
              <button className="sus-btn" onClick={onIniciarVotacao}
                style={{ padding: '9px 12px', borderRadius: 9, border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${IMPOSTOR_COR}, #FF7A85)`, boxShadow: `0 6px 16px ${IMPOSTOR_COR}44` }}>
                🗳️ Vamos votar
              </button>
            </div>
          )}
        </div>
      )}

      {reuniao.fase === 'votacao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11.5, color: T.textT, textAlign: 'center' }}>Dá pra trocar de voto quantas vezes quiser até a votação fechar.</div>
          {players.map(p => {
            const votosNele = Object.entries(reuniao.votos || {}).filter(([, alvo]) => alvo === p.name).map(([quem]) => quem);
            return (
              <button key={p.name} className="sus-btn" onClick={() => onVotar(p.name)}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '9px 12px', borderRadius: 11, textAlign: 'left', cursor: 'pointer',
                  border: `1.5px solid ${meuVoto === p.name ? IMPOSTOR_COR : T.border}`, background: meuVoto === p.name ? `${IMPOSTOR_COR}14` : (T.surface || '#fff') }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={p.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text }}>{p.name}</span>
                  {votosNele.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: IMPOSTOR_COR }}>{votosNele.length} voto{votosNele.length > 1 ? 's' : ''}</span>}
                  {votantes.has(p.name) && <span title="Já votou" style={{ fontSize: 13 }}>✅</span>}
                </div>
                {votosNele.length > 0 && (
                  <div style={{ fontSize: 11, color: T.textT, paddingLeft: 40 }}>votos de: {votosNele.map(v => v.split(' ')[0]).join(', ')}</div>
                )}
              </button>
            );
          })}
          <button className="sus-btn" onClick={() => onVotar(null)}
            style={{ padding: '9px 12px', borderRadius: 11, border: `1.5px dashed ${T.border}`, background: 'transparent',
              color: T.textS, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {meuVoto === null ? '✅ ' : ''}Pular votação
          </button>
          {jaVotei && (
            <button className="sus-btn" onClick={onRetirarVoto}
              style={{ padding: '8px 12px', borderRadius: 11, border: 'none', background: 'transparent',
                color: T.textD, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
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
        <div className="sus-float" style={{ width: 62, height: 62, borderRadius: 16, flexShrink: 0, position: 'relative',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
          boxShadow: '0 6px 18px rgba(0,0,0,.2)' }}>🕵️</div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 22, fontWeight: 800, color: '#fff' }}>Uniko Suspect</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.9)' }}>Tripulantes x Impostor — casa de praia 🏖️</div>
        </div>
        <div style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.3)',
          fontSize: 10.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>🔒 EM DEV</div>
        <button className="sus-btn" onClick={onAbrirPicker} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.2)', cursor: 'pointer', flexShrink: 0 }}>
          <img src={photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>Meu Uniko</span>
        </button>
        <button className="sus-btn" onClick={() => setCriando(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, border: 'none',
            background: '#fff', color: AGUA, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,.18)' }}>
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
            {[1, 2].map(n => (
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
            const podeExcluir = st.criador === name; // dentro deste tab, todo mundo que vê já é admin
            return (
              <div key={r.id} className="sus-fade" style={{ background: cardBg, borderRadius: 14, padding: 14, border: `1.5px solid ${T.border}`,
                boxShadow: T.sh, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, background: `${AGUA}18`, border: `1px solid ${AGUA}33` }}>🕵️</div>
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
                          <img key={p.name} src={p.photo || '/UNIKO_NEW.png'} alt="" title={p.name}
                            style={{ width: 27, height: 27, borderRadius: '50%', objectFit: 'cover', background: T.surfaceSub, border: `2px solid ${cardBg}`, marginLeft: i ? -8 : 0 }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11.5, color: T.textT }}>{gente.length === 1 ? `${gente[0].name.split(' ')[0]} está aqui` : `${gente.length} jogadores`}</span>
                    </>
                  ) : <span style={{ fontSize: 11.5, color: T.textD }}>Vazia — seja o primeiro</span>}
                </div>
                <button className="sus-btn" onClick={() => onEnter(r.id)}
                  style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${AGUA}, ${CEU})`, boxShadow: `0 4px 14px ${AG}` }}>Entrar</button>
                {confirmDel === r.id && (
                  <div className="sus-pop" style={{ position: 'absolute', inset: 0, borderRadius: 14, zIndex: 2, background: 'rgba(255,255,255,.97)',
                    border: '1px solid #E6394655', padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E' }}>Excluir esta sala?</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="sus-btn" onClick={() => excluir(r.id)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#E63946', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
                      <button className="sus-btn" onClick={() => setConfirmDel(null)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: 'transparent', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
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
              Ainda em construção — mas já dá pra testar o lobby e o sorteio de papéis!
            </div>
            <div style={{ fontSize: 12.5, color: T.textT }}>Use o botão <b style={{ color: AGUA }}>Criar sala</b> ali em cima 👆 (mínimo {MIN_PLAYERS} jogadores pra começar)</div>
          </div>
        ) : null}
      </div>
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

  // `pushState` sobe cedo (várias funções abaixo dependem dele — tarefas,
  // reunião de emergência etc.) pra evitar "usado antes de declarado".
  const aplicaEstado = useCallback((st) => {
    if (!st) return;
    const atual = stateRef.current;
    if (atual?.ts && st.ts && st.ts < atual.ts) return;
    stateRef.current = st; setState(st);
  }, []);
  const pushState = useCallback(async (next) => {
    const carimbado = { ...next, ts: Date.now() };
    aplicaEstado(carimbado);
    try { await supabase.from('uniko_suspect_state').update({ state: carimbado, updated_at: new Date().toISOString() }).eq('id', roomId); }
    catch (e) { console.error('[uniko-suspect] pushState:', e); }
  }, [roomId, aplicaEstado]);

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
  const meuPapelRef = useRef(null);
  const souFantasmaRef = useRef(false);
  const vitimaProximaRef = useRef(null);
  const matarRef = useRef(null);
  const morteAnimRef = useRef(null);
  const corpoProximoRef = useRef(null);
  const reportarRef = useRef(null);

  /* ── Tela cheia: mesmo padrão do botão "tela cheia" do Portal
     (central-colaborador/index.jsx) — só que aplicado no BLOCO DO JOGO
     (cabeçalho + mapa), não na página inteira. */
  const gameWrapRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [emergMsg, setEmergMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.from('uniko_suspect_map').select('tasks, emergency_x, emergency_y').eq('id', 1).maybeSingle();
        if (!vivo) return;
        setMapaTarefas(Array.isArray(data?.tasks) ? data.tasks : []);
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
  const tarefaAbertaRef = useRef(null);
  useEffect(() => { tarefaAbertaRef.current = tarefaAberta; }, [tarefaAberta]);
  const minhasFeitas = useMemo(() => new Set(state?.tasksDone?.[name] || []), [state?.tasksDone, name]);
  const tarefaProxima = useMemo(() => {
    // Fantasma "só faz tarefa" — continua interagindo com elas mesmo com
    // reunião rolando (os vivos ficam congelados na reunião, ele não).
    if (state?.phase !== 'jogando' || (state?.reuniao && !state?.fantasmas?.includes(name))) return null;
    let melhor = null, melhorD = Infinity;
    for (const t of mapaTarefas) {
      if (minhasFeitas.has(t.id)) continue;
      const d = Math.hypot(t.x - myPos.x, t.y - myPos.y);
      if (d < TASK_PROXIMIDADE && d < melhorD) { melhor = t; melhorD = d; }
    }
    return melhor;
  }, [mapaTarefas, minhasFeitas, myPos, state?.phase, state?.reuniao, state?.fantasmas, name]);
  const tarefaProximaRef = useRef(null);
  useEffect(() => { tarefaProximaRef.current = tarefaProxima; }, [tarefaProxima]);
  const marcarTarefaFeita = (taskId) => {
    const s = stateRef.current || {};
    const done = { ...(s.tasksDone || {}) };
    done[name] = [...new Set([...(done[name] || []), taskId])];
    pushState({ ...s, tasksDone: done });
  };

  /* ── Matar (ago/2026) — só o Impostor, perto de alguém vivo, com recarga.
     Reusa o MESMO mecanismo de fantasma da expulsão (entra em `fantasmas`),
     e checa vitória igual à reunião: todo tripulante fora = impostor vence. */
  const [agoraTick, setAgoraTick] = useState(() => Date.now());   // `Date.now()` só no efeito (regra do React Compiler)
  useEffect(() => { const iv = setInterval(() => setAgoraTick(Date.now()), 500); return () => clearInterval(iv); }, []);
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
    const cd = state?.killCooldowns?.[name] || 0;
    if (agoraTick - cd < KILL_COOLDOWN_MS) return null;
    let melhor = null, melhorD = Infinity;
    for (const p of players) {
      if (p.name === name || state?.papeis?.[p.name] === 'impostor' || state?.fantasmas?.includes(p.name)) continue;
      const pos = positions[p.name]; if (!pos) continue;
      const d = Math.hypot(pos.x - myPos.x, pos.y - myPos.y);
      if (d < KILL_PROXIMIDADE && d < melhorD) { melhor = { ...p, x: pos.x, y: pos.y }; melhorD = d; }
    }
    return melhor;
  }, [state?.phase, state?.reuniao, state?.papeis, state?.fantasmas, state?.killCooldowns, agoraTick, players, positions, myPos, name]);
  useEffect(() => { vitimaProximaRef.current = vitimaProxima; }, [vitimaProxima]);

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
    const s = stateRef.current;
    if (!s || s.phase !== 'jogando' || s.reuniao) return;
    if (s.papeis?.[name] !== 'impostor' || (s.fantasmas || []).includes(name)) return;
    if ((s.fantasmas || []).includes(vitima.name) || s.papeis?.[vitima.name] === 'impostor') return;
    if (Date.now() - (s.killCooldowns?.[name] || 0) < KILL_COOLDOWN_MS) return;
    const fantasmas = [...new Set([...(s.fantasmas || []), vitima.name])];
    const nomesPapeis = Object.keys(s.papeis || {});
    const impostoresVivos = nomesPapeis.filter(n => s.papeis[n] === 'impostor' && !fantasmas.includes(n));
    const tripulantesVivos = nomesPapeis.filter(n => s.papeis[n] === 'tripulante' && !fantasmas.includes(n));
    let vencedor = null;
    if (impostoresVivos.length === 0) vencedor = 'tripulante';
    else if (tripulantesVivos.length === 0) vencedor = 'impostor';
    const corpos = [...(s.corpos || []), { id: uid(), x: vitima.x, y: vitima.y, vitima: vitima.name, matador: name }];
    pushState({ ...s, fantasmas, vencedor, corpos, killCooldowns: { ...(s.killCooldowns || {}), [name]: Date.now() },
      ultimaMorte: { vitima: vitima.name, matador: name, ts: Date.now() } });
  };
  useEffect(() => { matarRef.current = matar; });

  // Reportar corpo: some da lista de corpos E já chama a reunião de emergência.
  const reportar = (corpoId) => {
    const s = stateRef.current;
    if (!s || s.phase !== 'jogando' || s.reuniao || s.vencedor || (s.fantasmas || []).includes(name)) return;
    const corpos = (s.corpos || []).filter(c => c.id !== corpoId);
    pushState({ ...s, corpos, reuniao: { id: uid(), chamadaPor: name, fase: 'chat', faseIniciadaEm: Date.now(), votos: {} } });
  };
  useEffect(() => { reportarRef.current = reportar; });

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
    pushState({ ...s, reuniao: { id: uid(), chamadaPor: name, fase: 'chat', faseIniciadaEm: Date.now(), votos: {} } });
  };
  const enviarChat = () => {
    const texto = chatTexto.trim();
    if (!texto || stateRef.current?.reuniao?.fase !== 'chat') return;
    chanRef.current?.send({ type: 'broadcast', event: 'reuniao-chat', payload: { id: uid(), autor: name, texto: texto.slice(0, 240) } });
    setChatTexto('');
  };
  // Voto pode ser trocado à vontade enquanto a votação estiver rolando —
  // clicar em outra pessoa troca, "Retirar meu voto" apaga a chave inteira
  // (pedido do usuário: dá pra mudar de ideia até a votação fechar).
  const votar = (alvo) => {
    const s = stateRef.current; const rr = s?.reuniao;
    if (!rr || rr.fase !== 'votacao' || (s.fantasmas || []).includes(name)) return;   // fantasma só faz tarefa, não vota
    pushState({ ...s, reuniao: { ...rr, votos: { ...(rr.votos || {}), [name]: alvo } } });
  };
  const retirarVoto = () => {
    const s = stateRef.current; const rr = s?.reuniao;
    if (!rr || rr.fase !== 'votacao' || rr.votos?.[name] === undefined) return;
    const votos = { ...(rr.votos || {}) };
    delete votos[name];
    pushState({ ...s, reuniao: { ...rr, votos } });
  };
  // Botão "Vamos votar" (qualquer jogador pode apertar) — pula o resto do
  // cronômetro de chat e já abre a votação, sem esperar os 60s completos.
  const iniciarVotacao = () => {
    const s = stateRef.current; const rr = s?.reuniao;
    if (!rr || rr.fase !== 'chat' || (s.fantasmas || []).includes(name)) return;
    pushState({ ...s, reuniao: { ...rr, fase: 'votacao', faseIniciadaEm: Date.now() } });
  };

  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost = host === name;
  useEffect(() => { hostRef.current = isHost; }, [isHost]);

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
        const fantasmasAtuais = s.fantasmas || [];
        const vivos = playersRef.current.filter(p => !fantasmasAtuais.includes(p.name));
        const todosVotaram = vivos.length > 0 && vivos.every(p => rr.votos?.[p.name] !== undefined);
        if (decorrido < REUNIAO_FASE_MS && !todosVotaram) return;   // ainda esperando

        const contagem = {};
        Object.values(rr.votos || {}).forEach(alvo => { if (alvo) contagem[alvo] = (contagem[alvo] || 0) + 1; });
        let expulso = null, max = 0, empatados = 0;
        Object.entries(contagem).forEach(([nome, qtd]) => {
          if (qtd > max) { max = qtd; expulso = nome; empatados = 1; }
          else if (qtd === max) { empatados++; }
        });
        const empate = max > 0 && empatados > 1;
        const expulsoFinal = empate ? null : expulso;

        // Expulso vira fantasma — checa condição de vitória (todo impostor
        // fora = tripulantes vencem; todo tripulante fora = impostor vence).
        const novosFantasmas = expulsoFinal ? [...new Set([...fantasmasAtuais, expulsoFinal])] : fantasmasAtuais;
        const nomesPapeis = Object.keys(s.papeis || {});
        const impostoresVivos = nomesPapeis.filter(n => s.papeis[n] === 'impostor' && !novosFantasmas.includes(n));
        const tripulantesVivos = nomesPapeis.filter(n => s.papeis[n] === 'tripulante' && !novosFantasmas.includes(n));
        let vencedor = null;
        if (impostoresVivos.length === 0) vencedor = 'tripulante';
        else if (tripulantesVivos.length === 0) vencedor = 'impostor';

        pushState({ ...s, fantasmas: novosFantasmas, vencedor,
          reuniao: { ...rr, fase: 'resultado', faseIniciadaEm: Date.now(), resultado: { expulso: expulsoFinal, empate, vencedor } } });
      } else if (rr.fase === 'resultado' && decorrido >= REUNIAO_RESULTADO_MS) {
        pushState(s.vencedor ? { ...s, phase: 'over', reuniao: null } : { ...s, reuniao: null });
      }
    };
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [isHost, state?.reuniao?.id, state?.reuniao?.fase, pushState]);

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
    ch.on('broadcast', { event: 'pronto' }, ({ payload }) => {
      if (!hostRef.current) return;
      const s = stateRef.current; if (!s) return;
      const p = { ...(s.prontos || {}) }; p[payload.name] = true;
      pushState({ ...s, prontos: p });
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload?.name || payload.name === name) return;
      setPositions(prev => ({ ...prev, [payload.name]: { x: payload.x, y: payload.y, moving: !!payload.moving } }));
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
      if (stateRef.current?.phase !== 'jogando') return;
      ch.send({ type: 'broadcast', event: 'pos', payload: { name, x: myPosRef.current.x, y: myPosRef.current.y, moving: isMovingRef.current } });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /* Motor: quando todos os presentes marcaram "pronto" na revelação, o HOST avança pro jogo. */
  useEffect(() => {
    if (!isHost || !state || state.phase !== 'sorteando') return;
    const presentes = playersRef.current.map(p => p.name);
    const prontos = Object.keys(state.prontos || {}).filter(n => presentes.includes(n));
    if (presentes.length && prontos.length >= presentes.length) pushState({ ...state, phase: 'jogando' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state, players]);

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
      const travado = !!morteAnimRef.current || tarefaAbertaRef.current || (reuniaoAtivaRef.current && !souFantasmaRef.current);
      if (k === 'e') {
        // Interagir com a tarefa mais próxima (estrela azul dentro do alcance).
        if (!travado && tarefaProximaRef.current) { pressedRef.current.clear(); setTarefaAberta(tarefaProximaRef.current); }
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
      if (k === 'escape' && tarefaAbertaRef.current) { setTarefaAberta(null); e.preventDefault(); return; }
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
        const raio = souFantasmaRef.current ? LUZ_RAIO.fantasma : LUZ_RAIO[meuPapelRef.current === 'impostor' ? 'impostor' : 'tripulante'];
        lightRef.current.style.background = lightGradientBg(nx / MAP_W * 100, ny / MAP_H * 100, raio);
      }
    };
    pintarVisual(myPosRef.current.x, myPosRef.current.y);

    lastTsRef.current = performance.now();
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);   // clamp: aba em 2º plano não "teleporta"
      lastTsRef.current = ts;
      if (morteAnimRef.current || tarefaAbertaRef.current || (reuniaoAtivaRef.current && !souFantasmaRef.current)) {
        // Animação de morte, mini-jogo de tarefa aberto, ou reunião rolando
        // e eu não sou fantasma — congela o boneco (some com o bob também).
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
  }, [state?.phase, name]);

  const sortearEComecar = () => {
    if (!state || players.length < MIN_PLAYERS) return;
    const nomes = players.map(p => p.name).sort(() => Math.random() - 0.5);
    const qtd = Math.max(1, Math.min(state.impostoresQtd || 1, nomes.length - 2));
    const papeis = {};
    nomes.forEach((n, i) => { papeis[n] = i < qtd ? 'impostor' : 'tripulante'; });
    pushState({ ...state, phase: 'sorteando', round: (state.round || 0) + 1, papeis, prontos: {}, fantasmas: [], vencedor: null, tasksDone: {}, reuniao: null, corpos: [], killCooldowns: {}, ultimaMorte: null });
  };
  const marcarPronto = () => {
    if (!state || state.phase !== 'sorteando') return;
    if (state.prontos?.[name]) return;
    chanRef.current?.send({ type: 'broadcast', event: 'pronto', payload: { name } });
    if (isHost) { const p = { ...(state.prontos || {}) }; p[name] = true; pushState({ ...state, prontos: p }); }
  };
  const encerrar = () => { if (isHost && state) pushState({ ...state, phase: 'over' }); };

  const meuPapel = state?.papeis?.[name];
  useEffect(() => { meuPapelRef.current = meuPapel; }, [meuPapel]);
  // Fantasma (ago/2026): quem foi expulso na reunião. Atravessa parede, só
  // faz tarefa, e só ELE enxerga todo mundo (vivos continuam sem ver fantasmas).
  const souFantasma = !!state?.fantasmas?.includes(name);
  useEffect(() => { souFantasmaRef.current = souFantasma; }, [souFantasma]);
  const jaPronto = !!state?.prontos?.[name];
  const nProntos = Object.keys(state?.prontos || {}).filter(n => players.some(p => p.name === n)).length;

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
        <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🕵️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state?.nome || 'Sala'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)' }}>{players.length} jogador{players.length !== 1 ? 'es' : ''} · {host ? `host: ${host.split(' ')[0]}` : '...'}</div>
        </div>
        <button className="sus-btn" onClick={onAbrirPicker} title="Escolher meu Uniko"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 5px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.2)', cursor: 'pointer', flexShrink: 0 }}>
          <img src={photo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff' }}>Meu Uniko</span>
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
                      {state.vencedor === 'impostor' ? 'Os tripulantes foram todos expulsos.' : 'O impostor foi expulso da casa.'}
                    </div>
                    {state?.papeis && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 }}>
                        {Object.entries(state.papeis).map(([n, papel]) => (
                          <span key={n} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                            background: papel === 'impostor' ? `${IMPOSTOR_COR}18` : `${TRIPULANTE_COR}18`,
                            color: papel === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
                            {papel === 'impostor' ? '🔪' : '🏖️'} {n.split(' ')[0]}
                          </span>
                        ))}
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
            <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>Jogadores ({players.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {players.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 5px', borderRadius: 999, background: T.surfaceSub || 'rgba(0,0,0,.03)', border: `1px solid ${T.border}` }}>
                    <img src={p.photo || '/UNIKO_NEW.png'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
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
                  {state?.phase === 'over' ? '🔄 Sortear de novo' : '🎲 Sortear papéis e começar'}
                </button>
              ) : (
                <div style={{ textAlign: 'center', fontSize: 12.5, color: T.textT, padding: '8px 0' }}>Aguardando o host começar...</div>
              )}
            </div>

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

        {/* ── REVELAÇÃO DE PAPEL ── */}
        {state?.phase === 'sorteando' && (
          <div className="sus-reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 10px', textAlign: 'center' }}>
            <div className="sus-float" style={{ fontSize: 64 }}>{meuPapel === 'impostor' ? '🔪' : '🏖️'}</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 26, fontWeight: 800, color: meuPapel === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
              {meuPapel === 'impostor' ? 'Você é o IMPOSTOR!' : 'Você é Tripulante'}
            </div>
            <div style={{ fontSize: 13, color: T.textT, maxWidth: 340, lineHeight: 1.5 }}>
              {meuPapel === 'impostor'
                ? 'Finja fazer tarefas, sabote a casa de praia e elimine os tripulantes sem ser pego. (Tarefas/matar chegam nas próximas fases)'
                : 'Complete suas tarefas pela casa e desconfie de quem agir estranho. (Tarefas chegam na próxima fase)'}
            </div>
            {jaPronto ? (
              <div style={{ fontSize: 12.5, color: T.textT }}>Esperando os outros... ({nProntos}/{players.length})</div>
            ) : (
              <button className="sus-btn" onClick={marcarPronto}
                style={{ padding: '12px 28px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${AGUA}, ${CEU})`, boxShadow: `0 6px 18px ${AG}` }}>Entendi, tô pronto!</button>
            )}
          </div>
        )}

        {/* ── MAPA (Fase 3): casa de praia, movimento livre em WASD/setas ── */}
        {state?.phase === 'jogando' && (
          <div ref={gameWrapRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0,
            background: isFullscreen ? (T.page || '#0B1620') : 'transparent', padding: isFullscreen ? 14 : 0,
            alignItems: isFullscreen ? 'center' : 'stretch', justifyContent: isFullscreen ? 'center' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, width: '100%', maxWidth: isFullscreen ? 1400 : 'none' }}>
              <div style={{ padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800,
                background: meuPapel === 'impostor' ? `${IMPOSTOR_COR}14` : `${TRIPULANTE_COR}14`,
                border: `1px solid ${meuPapel === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR}44`,
                color: meuPapel === 'impostor' ? IMPOSTOR_COR : TRIPULANTE_COR }}>
                {meuPapel === 'impostor' ? 'Você é o Impostor 🔪' : 'Você é Tripulante 🏖️'}
              </div>
              {mapaTarefas.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800,
                  background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', color: '#2563EB' }}>
                  <StarIcon size={13} color="#2563EB" /> {minhasFeitas.size}/{mapaTarefas.length} tarefas
                </div>
              )}
              <div style={{ fontSize: 11.5, color: T.textT }}>Use <b>WASD</b> ou as <b>setas</b> pra andar · <b>E</b> pra interagir</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="sus-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: `1px solid ${T.border}`,
                    background: 'transparent', color: T.textS, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isFullscreen
                      ? <><path d="M8 3v3a2 2 0 01-2 2H3"/><path d="M21 8h-3a2 2 0 01-2-2V3"/><path d="M3 16h3a2 2 0 012 2v3"/><path d="M16 21v-3a2 2 0 012-2h3"/></>
                      : <><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/></>}
                  </svg>
                  {isFullscreen ? 'Sair' : 'Tela cheia'}
                </button>
                {isHost && (
                  <button className="sus-btn" onClick={encerrar}
                    style={{ padding: '6px 14px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                    Encerrar partida
                  </button>
                )}
              </div>
            </div>

            {state?.reuniao && !souFantasma ? (
              // Fantasma NÃO entra na reunião — ele "só faz tarefa", então
              // continua livre no mapa enquanto os vivos estão reunidos.
              <ReuniaoEmergencia reuniao={state.reuniao} players={players.filter(p => !state?.fantasmas?.includes(p.name))} name={name} papeis={state.papeis}
                mensagens={reuniaoMensagens} chatTexto={chatTexto} setChatTexto={setChatTexto}
                onEnviarChat={enviarChat} onVotar={votar} onRetirarVoto={retirarVoto} onIniciarVotacao={iniciarVotacao} />
            ) : (
            <>
            {/* Viewport (o que a tela mostra): janela pequena, com zoom — não o mapa inteiro.
                Por baixo, o "mundo" (a arte da casa, ZOOM_FACTOR× maior que a janela) desliza
                via transform pra manter o MEU boneco sempre centralizado (câmera clampada nas
                bordas do mapa). Filhos do mundo (imagem + bonecos + luz) continuam em % de
                MAP_W/MAP_H, então a matemática de posição não muda — só ganhou essa "janela"
                por cima. Em tela cheia, o tamanho passa a ser ditado pela ALTURA disponível
                (86vh) em vez da largura — ocupa bem mais espaço numa tela grande. */}
            <div style={isFullscreen
              ? { position: 'relative', height: '86vh', maxWidth: '97vw', aspectRatio: `${ZOOM_W} / ${ZOOM_H}`,
                  borderRadius: 16, overflow: 'hidden', border: `2px solid ${T.border}`, boxShadow: T.sh, background: '#0B3D45' }
              : { position: 'relative', width: '100%', maxWidth: 1180, margin: '0 auto', aspectRatio: `${ZOOM_W} / ${ZOOM_H}`,
                  borderRadius: 16, overflow: 'hidden', border: `2px solid ${T.border}`, boxShadow: T.sh, background: '#0B3D45' }}>
              <div ref={worldRef} style={{ position: 'absolute', left: 0, top: 0, width: `${ZOOM_FACTOR * 100}%`, height: `${ZOOM_FACTOR * 100}%`,
                transform: `translate(${-(camX / MAP_W) * 100}%, ${-(camY / MAP_H) * 100}%)` }}>
                <img src={MAPA_IMG} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill', userSelect: 'none', pointerEvents: 'none' }} />

                {/* Tarefas — placa "disponível" ou "concluída" (já feita POR MIM — cada
                    jogador só vê a própria placa mudar, ver marcarTarefaFeita). Clicar
                    também abre (equivalente à tecla E), sem exigir estar perto. */}
                {mapaTarefas.map(t => {
                  const feita = minhasFeitas.has(t.id);
                  return (
                    <button key={t.id} onClick={() => setTarefaAberta(t)}
                      style={{ ...taskBtnCss, position: 'absolute', left: `${t.x / MAP_W * 100}%`, top: `${t.y / MAP_H * 100}%`,
                        transform: 'translate(-50%,-50%)', zIndex: 1, cursor: 'pointer' }} title={t.label}>
                      <img src={feita ? TAREFA_CONCLUIDA_IMG : TAREFA_DISPONIVEL_IMG} alt={t.label} className={feita ? undefined : 'sus-twinkle'}
                        style={{ width: '13vw', maxWidth: 132, minWidth: 78, display: 'block', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.6))' }} />
                    </button>
                  );
                })}

                {/* Botão de emergência — placa "Iniciar Reunião", brilho pulsante. Fantasma não chama reunião. */}
                {mapaEmergencia && !souFantasma && (
                  <button onClick={chamarReuniao} title="Iniciar Reunião"
                    style={{ ...taskBtnCss, position: 'absolute', left: `${mapaEmergencia.x / MAP_W * 100}%`, top: `${mapaEmergencia.y / MAP_H * 100}%`,
                      transform: 'translate(-50%,-50%)', zIndex: 1, cursor: 'pointer' }}>
                    <img src={INICIAR_REUNIAO_IMG} alt="Iniciar Reunião" className="sus-emerg"
                      style={{ width: '19vw', maxWidth: 200, minWidth: 118, display: 'block' }} />
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
                    <img src={CORPO_IMG} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.6))' }} />
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
                      <img src={p.photo || '/UNIKO_NEW.png'} alt="" className={andando ? 'sus-walk' : undefined}
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
                <div ref={lightRef} style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
                  background: lightGradientBg(myPosAtual.x / MAP_W * 100, myPosAtual.y / MAP_H * 100, souFantasma ? LUZ_RAIO.fantasma : LUZ_RAIO[meuPapel === 'impostor' ? 'impostor' : 'tripulante']) }} />
              </div>

              {/* Matar/Reportar — botões GRANDES fixos no canto inferior direito da
                  tela do jogo (pedido do usuário), acima da luz/mapa (zIndex 6). */}
              {(vitimaProxima || corpoProximo) && (
                <div style={{ position: 'absolute', right: '3%', bottom: '3%', zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                  {vitimaProxima && (
                    <button className="sus-btn sus-pop" onClick={() => matar(vitimaProxima)} style={{ ...taskBtnCss, cursor: 'pointer' }} title={`Matar ${vitimaProxima.name}`}>
                      <img src={BOTAO_MATAR_IMG} alt={`Matar ${vitimaProxima.name}`}
                        style={{ width: 'clamp(88px, 14vw, 160px)', display: 'block', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.6))' }} />
                    </button>
                  )}
                  {corpoProximo && (
                    <button className="sus-btn sus-pop" onClick={() => reportar(corpoProximo.id)} style={{ ...taskBtnCss, cursor: 'pointer' }} title="Reportar corpo">
                      <img src={BOTAO_REPORTAR_IMG} alt="Reportar corpo"
                        style={{ width: 'clamp(88px, 14vw, 160px)', display: 'block', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.6))' }} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {tarefaProxima && !tarefaAberta && (
              <div className="sus-pop" style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff',
                background: 'rgba(37,99,235,.92)', borderRadius: 999, padding: '7px 16px', margin: '0 auto', width: 'fit-content' }}>
                Pressione <b>E</b> — {tarefaProxima.label}
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 11, color: T.textT }}>
              🚧 Sabotagem chega numa próxima fase — por enquanto é andar pela casa, fazer as tarefas, matar (só o Impostor), reportar corpos e chamar reunião de emergência quando desconfiar de alguém.
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
                onComplete={() => { marcarTarefaFeita(tarefaAberta.id); setTarefaAberta(null); }} />
            )}

            {morteAnim && (
              <MorteOverlay matadorFoto={players.find(p => p.name === morteAnim.matador)?.photo} vitimaFoto={photo} />
            )}
          </div>
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
     aqui também vale nos outros jogos e como foto de perfil do Portal. ── */
  const [owned, setOwned] = useState(() => getCapturedCollection());
  useEffect(() => { syncCollectionFromServer().then(l => Array.isArray(l) && setOwned(l)); }, []);
  const myUnikos = useMemo(() => {
    const ids = new Set(owned.map(o => o.id));
    const base = [{ id: 'default', name: 'UNIKO', img: '/UNIKO_NEW.png' }];
    const fixos = Object.values(CAPTURE_UNIKOS).filter(u => ids.has(u.id)).map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    const custom = (getCustomUnikos() || []).filter(u => ids.has(u.id)).map(u => ({ id: u.id, name: u.shortName || u.name, img: u.img }));
    return [...base, ...fixos, ...custom];
  }, [owned]);
  const choosePhoto = (img) => {
    try { localStorage.setItem(PHOTO_SRC_KEY, img); } catch { /* sem localStorage */ }
    setPhoto(img);            // presence reanuncia sozinho no effect de [photo]
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
    <div style={{ maxWidth: 620, margin: '40px auto', background: cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: T.sh }}>
      <div style={{ width: 76, height: 76, borderRadius: 20, margin: '0 auto 14px', background: `linear-gradient(135deg, ${AGUA}, ${CEU})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🕵️</div>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 8 }}>Falta rodar a migração</div>
      <div style={{ fontSize: 13.5, color: T.textT, lineHeight: 1.6 }}>
        O Uniko Suspect precisa da tabela dele. Rode <b style={{ color: T.text }}>supabase_uniko_suspect.sql</b> no SQL Editor do Supabase e recarregue.
      </div>
    </div>
  );

  return (
    <>
      {room
        ? <Sala roomId={room} name={name} photo={photo} players={naSala} onLeave={() => setRoom(null)} onAbrirPicker={() => setPicker(true)} />
        : <Lobby name={name} photo={photo} porSala={porSala} onEnter={setRoom} onAbrirPicker={() => setPicker(true)} />}

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
                Esse vai ser o seu boneco no Uniko Suspect (e também sua foto de perfil no Portal). Só aparecem os Unikos que você já capturou.
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
                        <img src={u.img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />{u.name}
                      </div>
                      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                        {opts.map(v => (
                          <button key={v.img} onClick={() => choosePhoto(v.img)} title={v.label}
                            style={{ width: 78, padding: 7, borderRadius: 12, cursor: 'pointer', background: T.surfaceSub || 'rgba(0,0,0,.03)',
                              border: photo === v.img ? `2px solid ${AGUA}` : `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <img src={v.img} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
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
    </>
  );
};

// Exportados pra Dashboard RH → aba "Uniko Suspect" (UnikoSuspectMapTab.jsx)
// reusar o MESMO mapa/dimensões no editor, sem duplicar constantes.
export { TabUnikoSuspect, MAPA_IMG, MAP_W, MAP_H };
export default TabUnikoSuspect;
