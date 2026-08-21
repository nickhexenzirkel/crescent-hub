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
const LUZ_RAIO = { tripulante: 10, impostor: 16 };

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
.sus-fade   { animation: susFade .35s ease both; }
.sus-pop    { animation: susPop .3s cubic-bezier(.2,1.4,.4,1) both; }
.sus-reveal { animation: susReveal .55s cubic-bezier(.2,1.4,.4,1) both; }
.sus-float  { animation: susFloat 2.6s ease-in-out infinite; }
.sus-walk   { animation: susWalk .45s ease-in-out infinite; }
.sus-twinkle { animation: susTwinkle 1.6s ease-in-out infinite; }
.sus-emerg  { animation: susEmergPulse 1.1s ease-in-out infinite; }
.sus-btn { transition: transform .12s, filter .12s; }
.sus-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.07); }
.sus-btn:active:not(:disabled) { transform: translateY(1px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .sus-fade,.sus-pop,.sus-reveal,.sus-float,.sus-walk,.sus-twinkle,.sus-emerg { animation: none !important; } }
`;

/* ── Estrela (SVG) — marcador de tarefa (azul/verde) e do botão de emergência (vermelho) ── */
const StarIcon = ({ size = 22, color = '#3B82F6', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}
    style={{ display: 'block', filter: `drop-shadow(0 1px 3px rgba(0,0,0,.55))` }}>
    <path d="M12 1.5 L15.09 8.76 L23 9.51 L17 14.97 L18.82 22.5 L12 18.4 L5.18 22.5 L7 14.97 L1 9.51 L8.91 8.76 Z"
      fill={color} stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" />
  </svg>
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

const TaskGeladeira = ({ onComplete }) => {
  const [restam, setRestam] = useState([0, 1, 2, 3, 4]);
  const POS = [[18, 22], [55, 18], [82, 30], [30, 62], [68, 68]];
  useEffect(() => { if (restam.length === 0) onComplete(); }, [restam, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique nos 💩 pra tirar da geladeira!</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, background: 'linear-gradient(180deg,#EAF6FF,#D6ECFB)', border: `2px solid ${T.border}`, overflow: 'hidden' }}>
        {[1, 2].map(i => <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 33}%`, height: 2, background: 'rgba(0,0,0,.12)' }} />)}
        {restam.map(i => (
          <button key={i} style={{ ...taskBtnCss, position: 'absolute', left: `${POS[i][0]}%`, top: `${POS[i][1]}%`, transform: 'translate(-50%,-50%)', fontSize: 30 }}
            onClick={() => setRestam(r => r.filter(x => x !== i))} aria-label="Remover">💩</button>
        ))}
      </div>
    </div>
  );
};

const TaskFlamingo = ({ onComplete }) => {
  const [remendados, setRemendados] = useState([false, false, false, false]);
  const POS = [[30, 30], [68, 25], [40, 65], [72, 62]];
  useEffect(() => { if (remendados.every(Boolean)) onComplete(); }, [remendados, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique nos rasgos (❌) pra remendar a boia!</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, background: 'linear-gradient(180deg,#E6FBFF,#C9F1FB)', border: `2px solid ${T.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 92 }}>🦩</div>
        {remendados.map((ok, i) => (
          <button key={i} disabled={ok} style={{ ...taskBtnCss, position: 'absolute', left: `${POS[i][0]}%`, top: `${POS[i][1]}%`, transform: 'translate(-50%,-50%)', fontSize: 26, cursor: ok ? 'default' : 'pointer' }}
            onClick={() => setRemendados(r => r.map((v, j) => j === i ? true : v))}>{ok ? '🩹' : '❌'}</button>
        ))}
      </div>
    </div>
  );
};

const TaskChocolates = ({ onComplete }) => {
  const [restam, setRestam] = useState([0, 1, 2, 3, 4, 5]);
  const [bolso, setBolso] = useState(0);
  const POS = [[15, 25], [38, 20], [61, 25], [84, 20], [27, 55], [73, 55]];
  useEffect(() => { if (restam.length === 0) onComplete(); }, [restam, onComplete]);
  return (
    <div>
      <div style={{ fontSize: 12.5, color: T.textT, marginBottom: 10, textAlign: 'center' }}>Clique nos 🍫 pra guardar no bolso! ({bolso}/6)</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, background: 'linear-gradient(180deg,#F8F0E3,#EFDFC4)', border: `2px solid ${T.border}`, overflow: 'hidden' }}>
        {restam.map(i => (
          <button key={i} style={{ ...taskBtnCss, position: 'absolute', left: `${POS[i][0]}%`, top: `${POS[i][1]}%`, transform: 'translate(-50%,-50%)', fontSize: 28 }}
            onClick={() => { setRestam(r => r.filter(x => x !== i)); setBolso(b => b + 1); }} aria-label="Pegar">🍫</button>
        ))}
        <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 26 }}>👖</div>
      </div>
    </div>
  );
};

const TaskLouca = ({ onComplete }) => {
  const N = 3, ALVO = 4;
  const [cliques, setCliques] = useState([0, 0, 0]);
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
              <div style={{ fontSize: 44, filter: `grayscale(${1 - p}) sepia(${(1 - p) * .6})`, transition: 'filter .15s' }}>{i === 2 ? '🥤' : '🍽️'}</div>
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

const FIOS = [{ cor: '#DC2626', nome: 'vermelho' }, { cor: '#2563EB', nome: 'azul' }, { cor: '#EAB308', nome: 'amarelo' }];
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
  const ALVO_HITS = 3;
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [hits, setHits] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const posRef = useRef(0);
  const zona = [42, 62];
  useEffect(() => {
    let raf;
    const vel = 1.1 + hits * 0.35;
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
      const nv = Math.min(1, v + 0.045);
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

  /* ── Movimento livre no mapa (Fase 3) ──────────────────────────────────
     Posição NÃO entra no `state` (jsonb persistido) — muda rápido demais e é
     efêmera, então vai só por BROADCAST (mesmo princípio dos traços do Uniko
     Paint). `myPos` é a MINHA posição (autoridade local); `positions` guarda
     a posição recebida de cada outro jogador. */
  const [myPos, setMyPos] = useState(() => spawnFor(name));
  const [positions, setPositions] = useState({});
  const myPosRef = useRef(myPos);
  useEffect(() => { myPosRef.current = myPos; }, [myPos]);
  const pressedRef = useRef(new Set());
  const [isMoving, setIsMoving] = useState(false);   // eu — liga a animação de "andar" (sus-walk) no meu boneco
  const isMovingRef = useRef(false);
  const rafRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastTsRef = useRef(0);

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
    if (state?.phase !== 'jogando') return null;
    let melhor = null, melhorD = Infinity;
    for (const t of mapaTarefas) {
      if (minhasFeitas.has(t.id)) continue;
      const d = Math.hypot(t.x - myPos.x, t.y - myPos.y);
      if (d < TASK_PROXIMIDADE && d < melhorD) { melhor = t; melhorD = d; }
    }
    return melhor;
  }, [mapaTarefas, minhasFeitas, myPos, state?.phase]);
  const tarefaProximaRef = useRef(null);
  useEffect(() => { tarefaProximaRef.current = tarefaProxima; }, [tarefaProxima]);
  const marcarTarefaFeita = (taskId) => {
    const s = stateRef.current || {};
    const done = { ...(s.tasksDone || {}) };
    done[name] = [...new Set([...(done[name] || []), taskId])];
    pushState({ ...s, tasksDone: done });
  };

  const host = useMemo(() => {
    if (!players.length) return undefined;
    const criador = state?.criador;
    if (criador && players.some(p => p.name === criador)) return criador;
    return [...players].sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0) || a.name.localeCompare(b.name))[0]?.name;
  }, [players, state?.criador]);
  const isHost = host === name;
  useEffect(() => { hostRef.current = isHost; }, [isHost]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { if (state) stateRef.current = state; }, [state]);

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

  /* Canal de broadcast da sala: "pronto" (revisou o papel) + posição no mapa. */
  useEffect(() => {
    const ch = supabase.channel(`uniko-suspect-room-${roomId}`);
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
      if (k === 'e') {
        // Interagir com a tarefa mais próxima (estrela azul dentro do alcance).
        if (!tarefaAbertaRef.current && tarefaProximaRef.current) { pressedRef.current.clear(); setTarefaAberta(tarefaProximaRef.current); }
        e.preventDefault();
        return;
      }
      if (k === 'escape' && tarefaAbertaRef.current) { setTarefaAberta(null); e.preventDefault(); return; }
      if (!KEY_DIR[k]) return;
      if (tarefaAbertaRef.current) return;   // com o mini-jogo aberto, WASD não deve mover o boneco por baixo
      pressedRef.current.add(k);
      e.preventDefault();
    };
    const onKeyUp = (e) => { pressedRef.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    lastTsRef.current = performance.now();
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);   // clamp: aba em 2º plano não "teleporta"
      lastTsRef.current = ts;
      if (tarefaAbertaRef.current) {
        // Mini-jogo de tarefa aberto — congela o boneco (some com o bob de andar também).
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
          lastSentRef.current = performance.now();
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
        const nx = isWalkable(tryX, cur.y) ? tryX : cur.x;
        const ny = isWalkable(nx, tryY) ? tryY : cur.y;
        if (nx !== cur.x || ny !== cur.y) {
          setMyPos({ x: nx, y: ny });
          const now = performance.now();
          if (now - lastSentRef.current >= POS_SEND_MS) {
            lastSentRef.current = now;
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
    pushState({ ...state, phase: 'sorteando', round: (state.round || 0) + 1, papeis, prontos: {} });
  };
  const marcarPronto = () => {
    if (!state || state.phase !== 'sorteando') return;
    if (state.prontos?.[name]) return;
    chanRef.current?.send({ type: 'broadcast', event: 'pronto', payload: { name } });
    if (isHost) { const p = { ...(state.prontos || {}) }; p[name] = true; pushState({ ...state, prontos: p }); }
  };
  const encerrar = () => { if (isHost && state) pushState({ ...state, phase: 'over' }); };

  const meuPapel = state?.papeis?.[name];
  const jaPronto = !!state?.prontos?.[name];
  const nProntos = Object.keys(state?.prontos || {}).filter(n => players.some(p => p.name === n)).length;

  // Câmera: janela de ZOOM_W×ZOOM_H (campo de visão menor) centrada no MEU boneco,
  // clampada pra nunca mostrar além da borda do mapa.
  const camX = Math.min(MAP_W - ZOOM_W, Math.max(0, myPos.x - ZOOM_W / 2));
  const camY = Math.min(MAP_H - ZOOM_H, Math.max(0, myPos.y - ZOOM_H / 2));

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
              <div className="sus-pop" style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 34 }}>🏁</div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: T.text }}>Partida encerrada</div>
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
          <div ref={gameWrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0,
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
              <div style={{ position: 'absolute', left: 0, top: 0, width: `${ZOOM_FACTOR * 100}%`, height: `${ZOOM_FACTOR * 100}%`,
                transform: `translate(${-(camX / MAP_W) * 100}%, ${-(camY / MAP_H) * 100}%)` }}>
                <img src={MAPA_IMG} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill', userSelect: 'none', pointerEvents: 'none' }} />

                {/* Tarefas — estrela azul (pendente) ou verde (já feita POR MIM — cada
                    jogador só vê a própria estrela mudar, ver marcarTarefaFeita). Clicar
                    também abre (equivalente à tecla E), sem exigir estar perto. */}
                {mapaTarefas.map(t => {
                  const feita = minhasFeitas.has(t.id);
                  return (
                    <button key={t.id} onClick={() => setTarefaAberta(t)}
                      style={{ ...taskBtnCss, position: 'absolute', left: `${t.x / MAP_W * 100}%`, top: `${t.y / MAP_H * 100}%`,
                        transform: 'translate(-50%,-50%)', zIndex: 1, cursor: 'pointer' }} title={t.label}>
                      <StarIcon size={22} color={feita ? '#22C55E' : '#3B82F6'} className={feita ? undefined : 'sus-twinkle'} />
                    </button>
                  );
                })}

                {/* Botão de emergência — brilho vermelho pulsante, sempre visível. */}
                {mapaEmergencia && (
                  <button onClick={() => { setEmergMsg('🚧 Reunião de emergência ainda não foi implementada.'); setTimeout(() => setEmergMsg(''), 3000); }}
                    style={{ ...taskBtnCss, position: 'absolute', left: `${mapaEmergencia.x / MAP_W * 100}%`, top: `${mapaEmergencia.y / MAP_H * 100}%`,
                      transform: 'translate(-50%,-50%)', zIndex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <StarIcon size={30} color="#DC2626" className="sus-emerg" />
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', background: 'rgba(220,38,38,.85)', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                      Estrela de Emergência
                    </span>
                  </button>
                )}

                {/* Bonecos — sem borda, só a arte do Uniko de cada um */}
                {players.map(p => {
                  const eu = p.name === name;
                  const pos = eu ? myPos : (positions[p.name] || spawnFor(p.name));
                  const andando = eu ? isMoving : !!positions[p.name]?.moving;
                  return (
                    <div key={p.name} style={{ position: 'absolute', left: `${pos.x / MAP_W * 100}%`, top: `${pos.y / MAP_H * 100}%`,
                      width: `${(PLAYER_R * 1.2 / MAP_W) * 100}%`, transform: 'translate(-50%,-50%)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6%',
                      pointerEvents: 'none', transition: eu ? 'none' : 'left .12s linear, top .12s linear', zIndex: eu ? 3 : 2 }}>
                      <img src={p.photo || '/UNIKO_NEW.png'} alt="" className={andando ? 'sus-walk' : undefined}
                        style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain',
                        filter: eu ? `drop-shadow(0 3px 6px rgba(0,0,0,.4)) drop-shadow(0 0 9px ${AGUA}cc)` : 'drop-shadow(0 3px 6px rgba(0,0,0,.4))' }} />
                      <span style={{ fontSize: 'clamp(11px, 1.5vw, 16px)', fontWeight: 800, color: '#1a1320', background: 'rgba(255,255,255,.88)',
                        borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        {p.name.split(' ')[0]}
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
                <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
                  background: `radial-gradient(circle at ${myPos.x / MAP_W * 100}% ${myPos.y / MAP_H * 100}%,
                    transparent 0%, transparent ${LUZ_RAIO[meuPapel === 'impostor' ? 'impostor' : 'tripulante']}%,
                    rgba(4,8,16,.32) ${LUZ_RAIO[meuPapel === 'impostor' ? 'impostor' : 'tripulante'] + 10}%,
                    rgba(3,6,12,.62) ${LUZ_RAIO[meuPapel === 'impostor' ? 'impostor' : 'tripulante'] + 22}%,
                    rgba(2,4,9,.85) ${LUZ_RAIO[meuPapel === 'impostor' ? 'impostor' : 'tripulante'] + 38}%,
                    rgba(1,2,6,.97) ${LUZ_RAIO[meuPapel === 'impostor' ? 'impostor' : 'tripulante'] + 58}%)` }} />
              </div>
            </div>

            {tarefaProxima && !tarefaAberta && (
              <div className="sus-pop" style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff',
                background: 'rgba(37,99,235,.92)', borderRadius: 999, padding: '7px 16px', margin: '0 auto', width: 'fit-content' }}>
                Pressione <b>E</b> — {tarefaProxima.label}
              </div>
            )}
            {emergMsg && (
              <div className="sus-pop" style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff',
                background: 'rgba(220,38,38,.92)', borderRadius: 999, padding: '7px 16px', margin: '0 auto', width: 'fit-content' }}>
                {emergMsg}
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 11, color: T.textT }}>
              🚧 Matar, sabotagem, reuniões e votação chegam nas próximas fases — por enquanto é andar pela casa e fazer as tarefas.
            </div>

            {tarefaAberta && (
              <TaskModal task={tarefaAberta} onClose={() => setTarefaAberta(null)}
                onComplete={() => { marcarTarefaFeita(tarefaAberta.id); setTarefaAberta(null); }} />
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
