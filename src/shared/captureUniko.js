// src/shared/captureUniko.js
// "Capture o Uniko" — núcleo compartilhado entre o Dashboard RH (config), o widget do
// Portal (encontro/captura) e o Assistente UNIKO (aviso por heartbeat).
//
// • Config global fica na tabela `settings` (key = capture_uniko_config), valor JSON:
//     { enabled, startAt(ISO), endAt(ISO), unikoId }
// • A janela define QUANDO o Uniko PODE surgir; o surgimento em si é aleatório dentro dela
//   (cada usuário, ao entrar no Portal durante a janela, "sorteia" o momento — ver o widget).
// • O estado por evento (já capturado?) fica no localStorage por usuário+evento.
// • Pub/sub via window event liga o widget ⇆ assistente sem acoplar os componentes.
import { supabase as _supabase, getAuthUser, SUPABASE_URL, SUPABASE_ANON_KEY } from '../contexts/user';
import { getActiveAssistantSkinId, setActiveAssistantSkin, registerCustomSkin } from './assistantSkin';

/* ── Relógio sincronizado com o SERVIDOR ─────────────────────────────────────
   O spawn é um instante ABSOLUTO (spawnAt) comparado com Date.now() de cada
   cliente — se o relógio do PC estiver alguns segundos errado (comum!), o
   Uniko aparece adiantado ou atrasado NAQUELE computador, mesmo com o config
   chegando via realtime ao mesmo tempo pra todo mundo. `nowMs()` corrige isso
   somando o desvio medido contra o header Date da resposta do Supabase. ── */
let _clockOffsetMs = 0;
let _clockAt = 0;           // quando o desvio foi MEDIDO (relógio local); 0 = nunca mediu
let _clockInFlight = null;  // medição em voo — quem pedir junto divide a mesma
let _clockTryAt = 0;        // última TENTATIVA (mesmo falha), pra não martelar offline
export const nowMs = () => Date.now() + _clockOffsetMs;
/** Há quanto tempo o desvio foi medido (Infinity = nunca). Um offset velho vale
    pouco: o relógio do PC pode ter sido corrigido/atrasado desde então. */
export const serverClockAgeMs = () => (_clockAt ? Date.now() - _clockAt : Infinity);
export async function syncServerClock() {
  try {
    const t0 = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store',   // resposta vinda do cache traria um header Date VELHO
    });
    const t1 = Date.now();
    const serverMs = Date.parse(res.headers.get('date'));
    if (Number.isNaN(serverMs)) return;
    _clockOffsetMs = (serverMs + (t1 - t0) / 2) - t1; // meio do round-trip ≈ instante t1 no servidor
    _clockAt = Date.now();
  } catch { /* sem rede: segue com o desvio que já tinha */ }
}
/** Garante um desvio medido há no máximo `maxAgeMs` — use antes de tomar QUALQUER
    decisão baseada no instante do spawn (revelar o encontro, avisar no desktop).
    Nunca rejeita: se a medição falhar, seguimos com o que houver, porque travar o
    evento por causa do relógio seria pior do que revelar com alguns segundos de erro. */
export function ensureServerClock(maxAgeMs = 60 * 1000) {
  if (serverClockAgeMs() <= maxAgeMs) return Promise.resolve();
  if (_clockInFlight) return _clockInFlight;
  if (Date.now() - _clockTryAt < 10 * 1000) return Promise.resolve();  // falhou faz pouco: segue sem
  _clockTryAt = Date.now();
  _clockInFlight = syncServerClock().finally(() => { _clockInFlight = null; });
  return _clockInFlight;
}

/* ──────────────────────────────────────────────────────────────────────────
   ROSTER — cada Uniko capturável traz sua arte + tema (borda/cenário do widget).
   Pra adicionar outro Uniko depois, basta uma entrada nova aqui.
   ────────────────────────────────────────────────────────────────────────── */
export const CAPTURE_UNIKOS = {
  'vampire-robot': {
    id: 'vampire-robot',
    name: 'Uniko Vampire-Robot',
    shortName: 'Vampire Robot',   // título exibido na coleção
    img: '/UNIKO_VAMPROBOT.png',
    tagline: 'Robô-vampiro cibernético das sombras',
    // Vantagens visuais de ter essa skin (mostradas na Coleção).
    perks: [
      'Assistente flutuante exclusivo — pisca, dá dicas e avisa com a carinha do Vampire-Robot',
      'Foto de perfil temática vermelho-sangue',
      'Visual cibernético-vampírico de coleção',
    ],
    canBeAssistant: true,
    reward: { comum: 100, premium: 100 },
    // Tema: vermelho sangue / carmesim, corpo escuro, estética cibernética + vampírica.
    // Cenário: lua de sangue, castelo grande no canto sup. direito, morcegos voando
    // nas diagonais batendo as asas, partículas carmesim.
    theme: {
      accent:  '#c41e3a',   // carmesim principal
      accent2: '#7a0a18',
      glow:    '#ff3a4a',
      deep:    '#150306',
      ink:     '#ffd0d6',
      // cores que giram na borda cônica animada do widget
      border: ['#3a0510', '#7a0a18', '#c41e3a', '#ff2d4a', '#5c1018', '#a01028', '#3a0510'],
      // fundo do cenário interno
      scene: 'radial-gradient(120% 90% at 50% 0%, #3a0712 0%, #1a0408 45%, #0b0204 100%)',
      castle: '#2a0810',
      bat:    '#1a0306',
      pixel:  '#c41e3a',
      moon:   '#b01020',    // lua de sangue
      moonGlow: '#ff3a4a',
      sceneType: 'vampire',
    },
  },
  'uniko-comum': {
    id: 'uniko-comum',
    name: 'UNIKO Comum',
    shortName: 'UNIKO Comum',   // título exibido na coleção
    img: '/UNIKO_NEW.png',
    tagline: 'O Uniko clássico, sempre por perto',
    perks: [
      'Assistente flutuante clássico do UNIKO',
      'Visual azul original de coleção',
    ],
    canBeAssistant: true,
    reward: { comum: 50, premium: 50 },
    // Tema: azul clássico do UNIKO — versão "comum" (recompensa menor que a Vampire-Robot).
    theme: {
      accent:  '#2196F3',
      accent2: '#0d47a1',
      glow:    '#4fc3f7',
      deep:    '#04101f',
      ink:     '#d6ecff',
      border: ['#0d3a66', '#155a9c', '#2196F3', '#4fc3f7', '#1878c2', '#0d3a66'],
      scene: 'radial-gradient(120% 90% at 50% 0%, #123a63 0%, #0d1626 45%, #06090f 100%)',
      castle: '#123a63',
      bat:    '#0d1626',
      pixel:  '#2196F3',
      moon:   '#4fc3f7',
      moonGlow: '#8fd8ff',
    },
  },
  'uniko-sereia': {
    id: 'uniko-sereia',
    name: 'Uniko Sereia',
    shortName: 'Sereia',   // título exibido na coleção
    img: '/uniko_sereia.png',
    tagline: 'Guardiã encantada dos recifes de coral',
    perks: [
      'Assistente flutuante exclusivo — canta, dá dicas com um coração e avisa com um sininho',
      'Foto de perfil temática de recife de coral',
      'Visual sereia/oceano de coleção',
    ],
    canBeAssistant: true,
    reward: { comum: 100, premium: 100 },
    // Tema: recife de corais colorido, água turquesa, tudo suave e calmo (oposto do
    // Vampire-Robot). Cenário: raios de sol na água, bolhas subindo, água-vivas
    // flutuando, peixinhos coloridos nadando e corais no fundo (ver oceanScene.jsx).
    theme: {
      accent:  '#2dd4bf',   // turquesa principal
      accent2: '#0e8f9e',
      glow:    '#7ee8fa',
      deep:    '#031b24',
      ink:     '#c9fbff',
      // cores que giram na borda cônica animada do widget
      border: ['#0e3b45', '#0e8f9e', '#2dd4bf', '#7ee8fa', '#b28dff', '#ff9ad5', '#0e3b45'],
      // fundo do cenário interno
      scene: 'radial-gradient(120% 90% at 50% 0%, #0c4a52 0%, #062832 45%, #031218 100%)',
      pixel:  '#2dd4bf',
      sceneType: 'ocean', // escolhe o OceanScene em vez do VampireScene padrão
    },
  },
};

export const DEFAULT_UNIKO_ID = 'vampire-robot';
export const getUniko = (id) => CAPTURE_UNIKOS[id] || _customUnikoCache[id] || CAPTURE_UNIKOS[DEFAULT_UNIKO_ID];

/* ══════════════════════════════════════════════════════════════════════════
   OFICINA DE UNIKO — Unikos criados pelo admin (Dashboard RH → Capture o Uniko),
   fora do roster fixo acima. Tabela `custom_unikos` (rodar supabase_custom_unikos.sql).
   Cada um vira: (1) uma entrada aqui no formato do CAPTURE_UNIKOS (pro widget/coleção/
   evento) e (2) uma skin de assistente registrada em assistantSkin.js (pro "usar como
   assistente" funcionar). Só o frame PRINCIPAL é obrigatório — os outros caem nele.
   ══════════════════════════════════════════════════════════════════════════ */
let _customUnikoCache = {}; // id -> objeto no formato de CAPTURE_UNIKOS

// #RRGGBB -> {r,g,b}. Aceita formatos meio tortos sem quebrar (fallback pra roxo).
function _hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return { r: 108, g: 92, b: 231 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const _mix = (a, b, t) => Math.round(a + (b - a) * t);
const _rgbStr = (r, g, b) => `rgb(${r},${g},${b})`;

// Deriva um tema completo (cores da borda/cenário) a partir de UMA cor escolhida pelo
// admin — mesma "forma" do theme dos Unikos fixos, só que gerado em vez de artesanal.
// Sem `sceneType` → o widget usa o cenário neutro (sem castelo de vampiro nem recife).
export function deriveUnikoTheme(accentHex) {
  const { r, g, b } = _hexToRgb(accentHex);
  const dark  = (f) => _rgbStr(_mix(r, 0, f), _mix(g, 0, f), _mix(b, 0, f));   // em direção ao preto
  const light = (f) => _rgbStr(_mix(r, 255, f), _mix(g, 255, f), _mix(b, 255, f)); // em direção ao branco
  const accent = `rgb(${r},${g},${b})`;
  return {
    accent,
    accent2: dark(0.55),
    glow: light(0.35),
    deep: dark(0.85),
    ink: light(0.82),
    border: [dark(0.55), accent, light(0.3), light(0.5), accent, dark(0.55)],
    scene: `radial-gradient(120% 90% at 50% 0%, ${dark(0.55)} 0%, ${dark(0.78)} 45%, ${dark(0.92)} 100%)`,
    pixel: accent,
  };
}

// Se o admin anexou um cenário personalizado (img_scene, opcional), usa ele como fundo
// (com um leve escurecido pra manter o Uniko/texto legíveis por cima) em vez da cor
// gradiente padrão. Sem imagem, `theme` volta do jeito que já era (só a cor).
export function themeWithScene(theme, imgScene) {
  if (!imgScene) return theme;
  return { ...theme, scene: `linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55)), url('${imgScene}') center/cover no-repeat` };
}

const _slugify = (s) => (s || '')
  .toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'uniko';

// Unikos da Oficina que ganharam um cenário ARTESANAL/animado (igual Vampire-Robot/Sereia)
// em vez do neutro genérico — mapa id -> sceneType (ver CaptureUnikoWidget.jsx).
const CUSTOM_SCENE_BY_ID = {
  'destruidora-de-mundos-dh0x': 'cosmos', // planetas trincados, buraco negro, asteroides (cosmosScene.jsx)
};

// Fallback por PALAVRA-CHAVE no nome/id — pra Unikos da Oficina cujo id tem sufixo
// aleatório (ex.: "kitsune-a1b2") que não dá pra fixar no mapa acima. O primeiro
// padrão que casar (no nome OU no id) define o cenário artesanal.
const CUSTOM_SCENE_BY_KEYWORD = [
  { rx: /kitsune|raposa|sakura|cerejeira/i, scene: 'sakura' }, // floresta de sakura (sakuraScene.jsx)
  { rx: /fada|fadas|fairy|rainha das fadas/i, scene: 'fairy' }, // jardim encantado (fairyScene.jsx)
  { rx: /olivia|rodrigo|sour/i, scene: 'olivia' }, // colagem SOUR: borboletas, flores, arco-íris (oliviaScene.jsx)
];
function customSceneTypeFor(row) {
  if (CUSTOM_SCENE_BY_ID[row.id]) return CUSTOM_SCENE_BY_ID[row.id];
  const hay = `${row.name || ''} ${row.id || ''}`;
  for (const { rx, scene } of CUSTOM_SCENE_BY_KEYWORD) if (rx.test(hay)) return scene;
  return null;
}

// Monta a entrada no formato CAPTURE_UNIKOS a partir de uma linha da tabela custom_unikos.
function _buildCustomCaptureUniko(row) {
  const theme = themeWithScene(deriveUnikoTheme(row.accent), row.img_scene);
  const st = customSceneTypeFor(row);
  if (st) theme.sceneType = st;
  return {
    id: row.id, name: row.name, shortName: row.name, img: row.img_main,
    tagline: row.tagline || 'Uniko criado na Oficina',
    perks: ['Uniko personalizado — feito na Oficina de Uniko', 'Assistente flutuante e foto de perfil próprios'],
    canBeAssistant: true,
    reward: { comum: row.reward_comum ?? 100, premium: row.reward_premium ?? 100 },
    theme,
    isCustom: true,
  };
}

// Monta a skin de assistente (blink/mouth/sprites) a partir dos frames — frames que
// faltarem caem no frame principal (fica um ícone parado, sem animação, como pedido).
function _buildCustomSkin(row) {
  const main = row.img_main;
  const iconSize = row.icon_size || 84;
  // Margem da borda escala junto (mesma proporção do Vampire-Robot/Sereia — ~22-26% do
  // ícone), senão um Uniko configurado bem grande ficaria colado na borda da tela.
  const edgeMargin = Math.max(14, Math.round(iconSize * 0.22));
  return {
    id: row.id, name: row.name, accent: row.accent, iconSize, edgeMargin,
    blink: { open: main, mid: main, closed: row.img_closed || main },
    mouth: null, // sem frame de "falando" dedicado — mostra a carinha base enquanto fala
    sprites: {
      ALARME:  row.img_notif || main,
      ATENCAO: row.img_alert || main,
      ALEXA:   row.img_alexa || row.img_notif || main,
      WAVE:    row.img_wave || row.img_notif || main,
      PRISMAC: row.img_prisma_comum || main,
      PRISMAP: row.img_prisma_premium || main,
      CAPTURE: row.img_capture || main,
    },
  };
}

// Carrega TODOS os Unikos da Oficina do Supabase e popula os caches (roster + skins).
// Chamado uma vez no login (App.jsx) e sempre que a Oficina salva/apaga um Uniko.
let _customUnikoRawCache = {}; // linha crua da tabela (todos os frames) — usado pra EDITAR na Oficina
export async function loadCustomUnikos() {
  try {
    const { data, error } = await _supabase.from('custom_unikos').select('*').order('created_at', { ascending: true });
    if (error || !data) return [];
    const next = {}, rawNext = {};
    for (const row of data) { next[row.id] = _buildCustomCaptureUniko(row); rawNext[row.id] = row; }
    _customUnikoCache = next;
    _customUnikoRawCache = rawNext;
    // Skins do assistente ficam num módulo separado (assistantSkin.js) — registra lá.
    for (const row of data) registerCustomSkin(row.id, _buildCustomSkin(row));
    applyBgVideos(); // reaplica os vídeos de fundo (o cache foi reconstruído acima)
    return Object.values(_customUnikoCache);
  } catch { return Object.values(_customUnikoCache); }
}

export const getCustomUnikos = () => Object.values(_customUnikoCache);
// Linha crua (name/tagline/accent/reward_*/icon_size/img_* sem fallback nenhum) — a Oficina
// usa isso pra preencher o formulário de EDIÇÃO exatamente como foi salvo.
export const getCustomUnikoRaw = (id) => _customUnikoRawCache[id] || null;
// Roster completo (fixos + Oficina) — usado pelos seletores/vitrines.
export const getAllUnikos = () => [...Object.values(CAPTURE_UNIKOS), ...Object.values(_customUnikoCache)];

// Cria (sem fields.id) OU edita (com fields.id) um Uniko da Oficina e recarrega o cache.
export async function saveCustomUniko(fields) {
  const id = fields.id || `${_slugify(fields.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const row = {
    id, name: fields.name, tagline: fields.tagline || null, accent: fields.accent || '#6C5CE7',
    reward_comum: fields.rewardComum ?? 100, reward_premium: fields.rewardPremium ?? 100,
    icon_size: fields.iconSize || 84,
    img_main: fields.imgMain, img_notif: fields.imgNotif || null, img_alert: fields.imgAlert || null,
    img_closed: fields.imgClosed || null, img_capture: fields.imgCapture || null,
    img_prisma_comum: fields.imgPrismaComum || null, img_prisma_premium: fields.imgPrismaPremium || null,
    img_alexa: fields.imgAlexa || null, img_wave: fields.imgWave || null,
    img_scene: fields.imgScene || null,
    created_by: fields.createdBy || null,
  };
  const { error } = await _supabase.from('custom_unikos').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  await loadCustomUnikos();
  return id;
}

export async function deleteCustomUniko(id) {
  const { error } = await _supabase.from('custom_unikos').delete().eq('id', id);
  if (error) throw error;
  delete _customUnikoCache[id];
  delete _customUnikoRawCache[id];
}

/* ── Config global (tabela settings) ─────────────────────────────────────── */
export const CONFIG_KEY = 'capture_uniko_config';

export async function loadCaptureConfig() {
  try {
    const { data } = await _supabase.from('settings').select('value').eq('key', CONFIG_KEY).maybeSingle();
    if (data?.value) return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  } catch {}
  return null;
}

export async function saveCaptureConfig(cfg) {
  await _supabase.from('settings').upsert(
    { key: CONFIG_KEY, value: JSON.stringify(cfg) },
    { onConflict: 'key' },
  );
}

/* ── Janela / evento ─────────────────────────────────────────────────────── */
export const captureEventId = (cfg) => (cfg?.startAt ? `evt_${cfg.startAt}` : 'evt_default');

// Escolhe o instante de spawn DENTRO da janela — mas não uniforme de propósito: uma
// janela curta (ex.: 12:10-12:20) pesa a chance pro COMEÇO, já que não sobra muito tempo
// pra esperar; uma janela longa (ex.: 12:00-16:00) pesa pro MEIO/FIM, pra não correr o
// azar de cair nos primeiros minutos de uma janela de horas (era exatamente essa a
// reclamação: "definir 4h e spawnar 5 min depois"). Curva: t = random()^p, onde p > 1
// puxa pro início (janela curta) e p < 1 puxa pro fim (janela longa) — 30min é o ponto
// "neutro" (~uniforme).
export function pickSpawnAt(startIso, endIso, rnd = Math.random) {
  const s = Date.parse(startIso), e = Date.parse(endIso);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return startIso;
  const durationMin = (e - s) / 60000;
  const REF_MIN = 30;
  const p = Math.min(6, Math.max(0.15, REF_MIN / durationMin));
  const t = Math.pow(rnd(), p);
  return new Date(s + t * (e - s)).toISOString();
}

/* ── RNG SEMEADO (pros spawns AGENDADOS) ────────────────────────────────────
   Um evento da fila é promovido pelo primeiro navegador que perceber que a hora
   chegou — e vários podem perceber ao mesmo tempo. Se o instante do spawn fosse
   sorteado com Math.random(), cada um calcularia um horário diferente e o último
   a gravar mudaria o evento pra todo mundo. Semeando pelo id da ocorrência,
   TODOS chegam exatamente no mesmo spawnAt → a gravação vira idempotente. ── */
function _hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function _mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pickSpawnAtSeeded = (startIso, endIso, seed) =>
  pickSpawnAt(startIso, endIso, _mulberry32(_hashStr(String(seed))));

export function isWithinWindow(cfg, now = nowMs()) {
  if (!cfg?.enabled) return false;
  const s = cfg.startAt ? Date.parse(cfg.startAt) : null;
  const e = cfg.endAt ? Date.parse(cfg.endAt) : null;
  if (s != null && !Number.isNaN(s) && now < s) return false;
  if (e != null && !Number.isNaN(e) && now > e) return false;
  return true;
}

// Momento EXATO em que o Uniko surge (compartilhado por todos → aparece pra todos juntos).
// spawnAt é gravado na config; sem ele, cai no início da janela.
export function spawnMoment(cfg) {
  const sp = cfg?.spawnAt ? Date.parse(cfg.spawnAt) : (cfg?.startAt ? Date.parse(cfg.startAt) : null);
  return (sp != null && !Number.isNaN(sp)) ? sp : null;
}
export function isSpawned(cfg, now = nowMs()) {
  if (!isWithinWindow(cfg, now)) return false;
  const sp = spawnMoment(cfg);
  if (sp != null && now < sp) return false;
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   FILA DE SPAWNS AGENDADOS (agenda do Capture o Uniko)
   ──────────────────────────────────────────────────────────────────────────
   O admin monta no Dashboard RH uma LISTA de eventos ("das 10:00 às 11:30 sai
   o Uniko Sereia, todo dia"; "hoje das 15:00 às 15:30 sai o Vampire-Robot,
   só uma vez"). Cada item guarda só o MOLDE — a janela concreta ("ocorrência")
   é calculada na hora, no fuso local.

   Quando a hora de uma ocorrência chega, ela é PROMOVIDA: vira o
   `capture_uniko_config` normal (mesmo formato de sempre). Nada mais no
   sistema precisa saber que veio da fila — widget, assistente e o anúncio da
   Alexa no crescent-hub-server continuam lendo só o config.

   Quem promove? Qualquer navegador logado (ver runCaptureScheduler no App.jsx),
   porque não existe cron no cliente. Pra dois navegadores não brigarem:
   • o spawnAt é sorteado com RNG SEMEADO pela ocorrência → todos calculam o
     MESMO config, então gravar duas vezes dá no mesmo;
   • as ocorrências já promovidas ficam registradas em `capture_uniko_agenda_state`
     → nenhuma ocorrência é disparada duas vezes (nem depois que o evento acaba).

   Item da fila:
     { id, unikoId, mode:'daily'|'once', date:'2026-07-22' (só no 'once'),
       startTime:'10:00', endTime:'11:30', maxWinners, alexaMessage, enabled }
   ══════════════════════════════════════════════════════════════════════════ */
export const SCHEDULE_KEY      = 'capture_uniko_schedule';
export const AGENDA_STATE_KEY  = 'capture_uniko_agenda_state';

// Promove até 1 min ANTES da janela abrir — dá tempo do config chegar via realtime
// em todos os clientes antes do instante do spawn (a revelação em si continua
// presa ao spawnAt, então ninguém vê nada adiantado).
const AGENDA_LEAD_MS = 60 * 1000;

async function _loadSetting(key) {
  try {
    const { data } = await _supabase.from('settings').select('value').eq('key', key).maybeSingle();
    if (data?.value) return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  } catch {}
  return null;
}
const _saveSetting = (key, value) =>
  _supabase.from('settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });

export async function loadCaptureSchedule() {
  const v = await _loadSetting(SCHEDULE_KEY);
  return Array.isArray(v?.entries) ? v.entries : [];
}
export async function saveCaptureSchedule(entries) {
  const { error } = await _saveSetting(SCHEDULE_KEY, { entries });
  if (error) throw error;
}

// 'YYYY-MM-DD' → Date no fuso LOCAL (new Date('2026-07-22') seria UTC e podia cair no dia anterior).
function _localDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
const _hhmm = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  return m ? { h: +m[1], m: +m[2] } : null;
};

// Janela concreta de um item num dia específico. Se o fim for <= o início,
// entende-se que a janela cruza a meia-noite (ex.: 23:00 → 00:30).
function occurrenceOn(entry, dayDate) {
  const s0 = _hhmm(entry.startTime), e0 = _hhmm(entry.endTime);
  if (!dayDate || !s0 || !e0) return null;
  const s = new Date(dayDate); s.setHours(s0.h, s0.m, 0, 0);
  const e = new Date(dayDate); e.setHours(e0.h, e0.m, 0, 0);
  if (e <= s) e.setDate(e.getDate() + 1);
  const startIso = s.toISOString();
  return { key: `${entry.id}@${startIso}`, startMs: s.getTime(), endMs: e.getTime(), startIso, endIso: e.toISOString() };
}

// Ocorrências candidatas em volta de `now` (ontem/hoje/amanhã cobrem janelas que cruzam a meia-noite).
function candidateOccurrences(entry, now) {
  if (entry.mode === 'once') {
    const o = occurrenceOn(entry, _localDate(entry.date));
    return o ? [o] : [];
  }
  const out = [];
  for (const delta of [-1, 0, 1]) {
    const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + delta);
    const o = occurrenceOn(entry, d);
    if (o) out.push(o);
  }
  return out;
}

// A ocorrência ACONTECENDO agora (ou a ponto de abrir), se houver.
export function activeOccurrence(entry, now = nowMs()) {
  return candidateOccurrences(entry, now).find(o => now >= o.startMs - AGENDA_LEAD_MS && now <= o.endMs) || null;
}
// A PRÓXIMA ocorrência (pra UI mostrar "próximo: hoje às 10:00"); null se já passou de vez.
export function nextOccurrence(entry, now = nowMs()) {
  return candidateOccurrences(entry, now).filter(o => o.endMs >= now).sort((a, b) => a.startMs - b.startMs)[0] || null;
}

// Item da fila → config do evento (formato de sempre do capture_uniko_config).
export function cfgFromScheduleEntry(entry, occ) {
  return {
    enabled: true,
    startAt: occ.startIso,
    endAt: occ.endIso,
    spawnAt: pickSpawnAtSeeded(occ.startIso, occ.endIso, occ.key),
    unikoId: entry.unikoId,
    maxWinners: maxWinnersFor(entry),
    ...(entry.alexaMessage ? { alexaMessage: entry.alexaMessage } : {}),
    agendaKey: occ.key, // rastro de qual item da fila gerou este evento
  };
}

/* Ocorrências já disparadas — guardadas no settings pra NENHUM cliente repetir um
   evento que já rolou (nem depois que a janela dele fica "livre" de novo). Mantém
   só as últimas 60: o suficiente pra cobrir semanas de fila diária. */
async function loadAgendaDone() {
  const v = await _loadSetting(AGENDA_STATE_KEY);
  return Array.isArray(v?.done) ? v.done : [];
}
async function markAgendaDone(key) {
  const done = await loadAgendaDone();
  if (done.includes(key)) return;
  await _saveSetting(AGENDA_STATE_KEY, { done: [...done, key].slice(-60) });
}

/* Roda a fila: se alguma ocorrência está na hora e ainda não foi disparada,
   grava o config dela. Devolve o config promovido (ou null se não havia nada).
   `currentCfg` é o config que está no ar agora (pode ser null). */
export async function runCaptureScheduler(currentCfg, now = nowMs()) {
  try {
    const entries = await loadCaptureSchedule();
    if (!entries.length) return null;
    const done = new Set(await loadAgendaDone());

    let best = null;
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      const occ = activeOccurrence(entry, now);
      if (!occ || done.has(occ.key)) continue;
      if (!best || occ.startMs > best.occ.startMs) best = { entry, occ };
    }
    if (!best) return null;

    // Não atropela um evento que ainda está VIVO e começou DEPOIS desta ocorrência
    // (ex.: um "Spawnar agora" manual no meio de uma janela agendada). Quando ele
    // terminar, a ocorrência agendada ainda pega a vez, se a janela dela não tiver
    // acabado — por isso não marcamos como disparada aqui.
    const curStart = currentCfg?.startAt ? Date.parse(currentCfg.startAt) : NaN;
    const curEnd   = currentCfg?.endAt   ? Date.parse(currentCfg.endAt)   : NaN;
    if (currentCfg?.enabled && !Number.isNaN(curStart) && curStart > best.occ.startMs
        && (Number.isNaN(curEnd) || now <= curEnd)) return null;

    const cfg = cfgFromScheduleEntry(best.entry, best.occ);
    await saveCaptureConfig(cfg);
    await markAgendaDone(best.occ.key);
    // 'Única vez' já cumpriu seu papel: sai da fila sozinho pra não poluir a lista.
    if (best.entry.mode === 'once') {
      // relê a fila antes de mexer: se o admin acabou de adicionar outro item, ele não some junto
      try { await saveCaptureSchedule((await loadCaptureSchedule()).filter(e => e.id !== best.entry.id)); } catch {}
    }
    return cfg;
  } catch (e) {
    console.error('[capture-uniko] runCaptureScheduler falhou:', e);
    return null;
  }
}

const userTag = () => { try { return getAuthUser()?.cpf || getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };
const doneKey = (cfg) => `capture_uniko_done_${userTag()}_${captureEventId(cfg)}`;

export function isCaptureDone(cfg) {
  try { return localStorage.getItem(doneKey(cfg)) === '1'; } catch { return false; }
}
export function markCaptureDone(cfg) {
  try { localStorage.setItem(doneKey(cfg), '1'); } catch {}
}

// Resultado da captura (quem capturou + quando) — pra mostrar no widget mesmo após recarregar.
const resultKey = (cfg) => `capture_uniko_result_${userTag()}_${captureEventId(cfg)}`;
export function getCaptureResult(cfg) {
  try { const r = localStorage.getItem(resultKey(cfg)); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function setCaptureResult(cfg, result) {
  try { localStorage.setItem(resultKey(cfg), JSON.stringify(result)); } catch {}
}

/* ── Pub/sub widget ⇆ assistente ─────────────────────────────────────────── */
const STATE_EV = 'capture-uniko:state';
let _lastState = { available: false, uniko: null };

// state: { available: boolean, uniko: object|null, captured?: boolean }
export function emitCaptureState(state) {
  _lastState = state;
  try { window.dispatchEvent(new CustomEvent(STATE_EV, { detail: state })); } catch {}
}
export function onCaptureState(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(STATE_EV, h);
  // entrega o último estado conhecido imediatamente (assistente pode montar depois)
  if (_lastState) cb(_lastState);
  return () => window.removeEventListener(STATE_EV, h);
}

/* ── Slot do widget ocupado? (encontro OU painel de "resgatado" ativo) ──
   O widget é a fonte da verdade; o placeholder "nada aqui" no Portal escuta isto. */
const SLOT_EV = 'capture-uniko:slot';
let _lastSlot = false;
export function emitCaptureSlotBusy(busy) {
  _lastSlot = !!busy;
  try { window.dispatchEvent(new CustomEvent(SLOT_EV, { detail: _lastSlot })); } catch {}
}
export function onCaptureSlotBusy(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(SLOT_EV, h);
  cb(_lastSlot);
  return () => window.removeEventListener(SLOT_EV, h);
}

// Janela de tempo que o painel de "resgatado" fica visível após a captura.
export const WINNER_PANEL_MS = 30 * 60 * 1000; // 30 min

/* ── Coleção de capturas (Supabase, best-effort) ─────────────────────────── */
export async function saveCaptureToCollection(uniko) {
  try {
    const a = getAuthUser();
    if (!a?.name) return;
    // upsert (não insert puro) + onConflict — se por qualquer motivo essa função rodar
    // 2x pro mesmo (player, uniko_id) (ex.: retry de rede, reentrância), não duplica linha
    // na coleção. Precisa da constraint UNIQUE(player, uniko_id) — ver
    // supabase_capture_uniko_captures_unique.sql (também limpa duplicatas já existentes).
    const { error } = await _supabase.from('capture_uniko_captures')
      .upsert({
        player: a.name,
        uniko_id: uniko.id,
        uniko_name: uniko.name,
        captured_at: new Date().toISOString(),
      }, { onConflict: 'player,uniko_id', ignoreDuplicates: true });
    // Não é mais silencioso: se isso falhar (RLS, coluna faltando etc.), o Uniko fica
    // "capturado" (lock em capture_uniko_event) mas não aparece na Coleção — melhor
    // logar pra dar pra investigar do que engolir o erro sem deixar rastro.
    if (error) console.error('[capture-uniko] falha ao salvar na coleção:', error);
  } catch (e) { console.error('[capture-uniko] falha ao salvar na coleção:', e); }
}

/* ── Recompensa padrão — usada quando o Uniko não define a própria (uniko.reward) ── */
export const CAPTURE_REWARD = { comum: 100, premium: 100 };
export const getCaptureReward = (uniko) => ({
  comum: uniko?.reward?.comum ?? CAPTURE_REWARD.comum,
  premium: uniko?.reward?.premium ?? CAPTURE_REWARD.premium,
});

/* ── Override de recompensa (prismas) pros Unikos FIXOS do roster acima
   (vampire-robot, uniko-sereia, uniko-comum) — o valor "de fábrica" fica
   hardcoded em CAPTURE_UNIKOS[id].reward, mas o admin precisa poder mudar
   sem editar código. Tabela `uniko_reward_overrides` (rodar
   supabase_uniko_reward_overrides.sql), uma linha por Uniko. Aplica DIRETO
   em cima do objeto de CAPTURE_UNIKOS (mutação em memória) — como
   getCaptureReward/getUniko/o roster inteiro sempre leem essa MESMA
   referência, nenhum call site existente precisa mudar. Unikos da Oficina
   (custom_unikos) já têm reward_comum/reward_premium próprios — isso aqui
   é só pros fixos, que não têm linha em tabela nenhuma. ── */
export async function loadRewardOverrides() {
  try {
    const { data } = await _supabase.from('uniko_reward_overrides').select('uniko_id,reward_comum,reward_premium');
    for (const r of (data || [])) {
      const base = CAPTURE_UNIKOS[r.uniko_id];
      if (base) base.reward = { comum: r.reward_comum ?? base.reward.comum, premium: r.reward_premium ?? base.reward.premium };
    }
  } catch (e) { console.error('[capture-uniko] loadRewardOverrides falhou:', e); }
}
export async function saveRewardOverride(unikoId, comum, premium) {
  const c = Math.max(0, Number(comum) || 0), p = Math.max(0, Number(premium) || 0);
  await _supabase.from('uniko_reward_overrides').upsert(
    { uniko_id: unikoId, reward_comum: c, reward_premium: p, updated_at: new Date().toISOString() },
    { onConflict: 'uniko_id' }
  );
  const base = CAPTURE_UNIKOS[unikoId];
  if (base) base.reward = { comum: c, premium: p };
}

/* ── Vídeo de fundo por Uniko (Central Alexa) — o admin sobe um vídeo no
   Dashboard e ele vira o fundo (mutado/loop/autoplay) do card do Uniko e do
   cenário quando aquele Uniko é o DJ da música atual, SUBSTITUINDO o cenário
   animado codado. Tabela `uniko_bg_videos` (uniko_id → video_url), vale pros
   fixos E pros da Oficina (chave é só o uniko_id). Aplica `bgVideoUrl` DIRETO
   no objeto do roster em memória (mesma ideia do reward override), pra
   getUniko(id).bgVideoUrl funcionar em qualquer lugar. **Rodar
   supabase_uniko_bg_videos.sql.** ── */
let _bgVideoCache = {}; // uniko_id -> url ('' = sem vídeo)
function applyBgVideos() {
  for (const [id, url] of Object.entries(_bgVideoCache)) {
    if (CAPTURE_UNIKOS[id]) CAPTURE_UNIKOS[id].bgVideoUrl = url || '';
    if (_customUnikoCache[id]) _customUnikoCache[id].bgVideoUrl = url || '';
  }
}
export async function loadUnikoBgVideos() {
  try {
    const { data } = await _supabase.from('uniko_bg_videos').select('uniko_id,video_url');
    _bgVideoCache = {};
    for (const r of (data || [])) _bgVideoCache[r.uniko_id] = r.video_url || '';
    applyBgVideos();
  } catch (e) { console.error('[capture-uniko] loadUnikoBgVideos falhou:', e); }
}
export async function saveUnikoBgVideo(unikoId, url) {
  const v = url || null;
  if (v) {
    await _supabase.from('uniko_bg_videos').upsert(
      { uniko_id: unikoId, video_url: v, updated_at: new Date().toISOString() },
      { onConflict: 'uniko_id' }
    );
  } else {
    await _supabase.from('uniko_bg_videos').delete().eq('uniko_id', unikoId);
  }
  _bgVideoCache[unikoId] = v || '';
  applyBgVideos();
}
export const getUnikoBgVideo = (id) => _bgVideoCache[id] || '';

/* ── Loja de Unikos — preço (Prisma Comum) definido pelo admin pra cada Uniko poder ser
   COMPRADO na Prisma Store (além de capturado no evento). Tabela `uniko_store_prices`,
   uma linha por Uniko; sem linha (ou price nulo/0) = não está à venda. ── */
export async function loadUnikoStorePrices() {
  try {
    const { data } = await _supabase.from('uniko_store_prices').select('uniko_id,price');
    const map = {};
    for (const r of (data || [])) if (r.price > 0) map[r.uniko_id] = r.price;
    return map;
  } catch { return {}; }
}
export async function saveUnikoStorePrice(unikoId, price) {
  const p = Number(price) || 0;
  if (p <= 0) {
    await _supabase.from('uniko_store_prices').delete().eq('uniko_id', unikoId);
    return;
  }
  await _supabase.from('uniko_store_prices').upsert(
    { uniko_id: unikoId, price: p, updated_at: new Date().toISOString() },
    { onConflict: 'uniko_id' }
  );
}

/* ── Conta quantos Unikos o jogador possui — usado pelas missões Colecionador.
   +1 sempre: o UNiko padrão é possuído por todo mundo (mesma conta que a mini-widget
   "Coleção" da Home já usa: padrão + capturados/comprados distintos). ── */
export async function countOwnedUnikos(player) {
  if (!player) return 1;
  const rows = await fetchCapturesFor(player);
  const distinct = new Set(rows.map(r => r.uniko_id));
  return 1 + distinct.size;
}

/* ── Até N capturadores por evento (o admin escolhe N no Dashboard RH, campo
   maxWinners do cfg — padrão 3 se não vier definido, ex.: eventos antigos) ──
   `capture_uniko_event` aceita até 5 linhas por event_id (1 slot cada, ver
   supabase_capture_uniko_multi.sql e supabase_capture_uniko_max_winners.sql —
   o teto de linhas no banco é 5, mas o admin pode configurar de 1 a 5 vagas
   por evento) — as N primeiras pessoas a capturar ganham; da próxima tentativa
   em diante o evento já está esgotado. ─────────────────────────────────────── */
export const CAPTURE_MAX_WINNERS_DEFAULT = 3; // eventos sem maxWinners definido (compatibilidade)
export const CAPTURE_MAX_WINNERS_CAP = 5;     // teto absoluto (limite de slots no banco)
export function maxWinnersFor(cfg) {
  const n = Math.floor(Number(cfg?.maxWinners));
  if (!Number.isFinite(n) || n < 1) return CAPTURE_MAX_WINNERS_DEFAULT;
  return Math.min(n, CAPTURE_MAX_WINNERS_CAP);
}

// Devolve TODOS os vencedores desse evento (0 a maxWinnersFor(cfg)); undefined = erro de rede.
export async function fetchCaptureWinners(cfg) {
  try {
    const { data, error } = await _supabase.from('capture_uniko_event')
      .select('*').eq('event_id', captureEventId(cfg)).order('slot', { ascending: true });
    if (error) return undefined;
    return (data || []).map(row => ({
      player: row.player, unikoId: row.uniko_id, unikoName: row.uniko_name,
      comum: row.comum || 0, premium: row.premium || 0, at: row.captured_at,
    }));
  } catch { return undefined; }
}

// Limpa o estado LOCAL de captura de um evento (usado quando o servidor diz que não há vencedor).
export function clearCaptureLocal(cfg) {
  try { localStorage.removeItem(doneKey(cfg)); localStorage.removeItem(resultKey(cfg)); } catch {}
}

// ── Realtime: avisa TODOS os clientes ~na hora quando ALGUÉM captura (um dos
// até 5 INSERTs em capture_uniko_event), em vez de esperar o próximo poll (até
// 4s de atraso). Dispara uma vez por captura nova — quem chama acumula numa
// lista, não trata como "o" vencedor único. Precisa do
// supabase_capture_uniko_realtime.sql rodado; sem ele, cai só no poll
// (fallback já existente no widget) — não quebra nada, só demora mais.
export function subscribeCaptureWinner(cfg, onWinner) {
  if (!cfg) return () => {};
  let ch;
  try {
    ch = _supabase.channel(`capture-event-${captureEventId(cfg)}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'capture_uniko_event',
        filter: `event_id=eq.${captureEventId(cfg)}`,
      }, (payload) => {
        const row = payload?.new;
        if (!row) return;
        onWinner({ player: row.player, unikoId: row.uniko_id, unikoName: row.uniko_name,
                   comum: row.comum || 0, premium: row.premium || 0, at: row.captured_at });
      })
      .subscribe();
  } catch { return () => {}; }
  return () => { try { _supabase.removeChannel(ch); } catch {} };
}

// Tenta ocupar um dos 5 slots do evento via função atômica no banco
// (capture_uniko_try) — evita a corrida de duas pessoas "ganhando" o mesmo
// slot ao capturar quase ao mesmo tempo (ver supabase_capture_uniko_multi.sql).
export async function claimCapture(cfg, uniko) {
  const me = getAuthUser()?.name || 'Você';
  const reward = getCaptureReward(uniko);
  try {
    const { data, error } = await _supabase.rpc('capture_uniko_try', {
      p_event_id: captureEventId(cfg), p_player: me,
      p_uniko_id: uniko.id, p_uniko_name: uniko.name,
      p_comum: reward.comum, p_premium: reward.premium,
      p_max_winners: maxWinnersFor(cfg),
    });
    if (error) {
      console.error('[capture-uniko] claimCapture (rpc) falhou:', error);
      return { won: false, alreadyMine: false, isFull: false, winner: null, networkError: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.ok) {
      return { won: true, alreadyMine: false, isFull: false,
        winner: { player: me, unikoId: uniko.id, unikoName: uniko.name, comum: reward.comum, premium: reward.premium, at: new Date().toISOString() } };
    }
    if (row?.already_mine) return { won: false, alreadyMine: true, isFull: false, winner: null };
    // esgotado (5/5) — busca a lista pra exibir quem conseguiu
    const winners = await fetchCaptureWinners(cfg);
    return { won: false, alreadyMine: false, isFull: true, winner: null, winners: winners || [] };
  } catch (e) {
    console.error('[capture-uniko] claimCapture lançou exceção:', e);
    return { won: false, alreadyMine: false, isFull: false, winner: null, networkError: true };
  }
}

/* ── Credita os prismas na carteira do vencedor (mercado_state) + histórico ──
   BUG CORRIGIDO (jul/2026): fazia select-soma-regrava do `data` inteiro — se a
   Prisma Store estivesse aberta ao mesmo tempo (ela também regrava o `data`
   inteiro por cima, às cegas, a cada 400ms), o que gravasse por último apagava
   check-in/missões/coleção do outro lado. Agora usa a RPC `mercado_credit`
   (incremento ATÔMICO só de comum/premium, ver supabase_mercado_credit_atomico.sql)
   — nunca mais toca no resto do estado, então não tem mais como um crédito
   apagar o outro. ── */
export async function awardPrismas(player, comum, premium) {
  try {
    const { error } = await _supabase.rpc('mercado_credit', { p_player: player, p_comum: comum || 0, p_premium: premium || 0 });
    if (error) throw error;
    await _supabase.from('mercado_history').insert({ player, kind: 'captura', descr: 'Capture o Uniko', comum, premium });
  } catch (e) { console.error('[capture-uniko] awardPrismas falhou:', e); }
}

/* ── RH Dashboard: envia um Uniko + prismas DIRETO pra um colaborador específico,
   fora do sorteio aleatório do evento (ex.: "dar" o Uniko Sereia pro Kauã com 100
   comuns + 100 premium). Credita a coleção (capture_uniko_captures, mesma tabela
   de quem captura de verdade — aparece na Coleção/My Uniko dele) e a carteira
   (mercado_state), igual a uma captura genuína. ── */
export async function giftUnikoToPlayer(player, uniko, comum, premium) {
  try {
    const already = await fetchCapturesFor(player);
    const hasIt = (already || []).some(c => c.uniko_id === uniko.id);
    if (!hasIt) {
      // upsert+onConflict (não insert puro) — mesma proteção do saveCaptureToCollection:
      // se o admin clicar "Enviar" 2x rápido (ou a checagem `hasIt` perder uma corrida
      // com outra gravação), não duplica linha na coleção do jogador.
      const { error: capErr } = await _supabase.from('capture_uniko_captures')
        .upsert({ player, uniko_id: uniko.id, uniko_name: uniko.name, captured_at: new Date().toISOString() },
          { onConflict: 'player,uniko_id', ignoreDuplicates: true });
      if (capErr) { console.error('[capture-uniko] gift: falha ao salvar na coleção:', capErr); return { ok: false, alreadyHadUniko: false }; }
    }

    const { error: walletErr } = await _supabase.rpc('mercado_credit', { p_player: player, p_comum: comum || 0, p_premium: premium || 0 });
    if (walletErr) { console.error('[capture-uniko] gift: falha ao creditar carteira:', walletErr); return { ok: false, alreadyHadUniko: hasIt }; }

    await _supabase.from('mercado_history').insert({ player, kind: 'presente', descr: `Ganhou o Uniko ${uniko.name} (enviado pelo RH)`, comum, premium });
    return { ok: true, alreadyHadUniko: hasIt };
  } catch (e) {
    console.error('[capture-uniko] gift: exceção:', e);
    return { ok: false, alreadyHadUniko: false };
  }
}

/* ── Coleção do My Uniko (localStorage por usuário) ──────────────────────────
   O uniko capturado vira um "skin" equipável no My Uniko. ─────────────────── */
const COLLECTION_KEY = () => `uniko_captured_${userTag()}`;

/* Espelho em MEMÓRIA da coleção — o localStorage aqui é só cache de conveniência.
   Antes a memória não existia e o localStorage era a única fonte: com o storage do
   navegador CHEIO (QuotaExceededError, visto em produção), o `setItem` estourava no
   meio de syncCollectionFromServer/addToMyUnikoCollection, o evento
   'uniko-collection:changed' nunca era disparado e a Coleção inteira parava de
   atualizar na tela — inclusive um Uniko recém-capturado não aparecia. Agora a
   escrita no storage é best-effort: se não couber, a coleção segue certa em memória
   e a UI é avisada do mesmo jeito. */
let _collectionMem = { key: '', list: null };

export function getCapturedCollection() {
  const key = COLLECTION_KEY();
  if (_collectionMem.key === key && _collectionMem.list) return _collectionMem.list;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

// Fonte única de escrita da coleção: memória (sempre) + localStorage (se couber) + evento (sempre).
function setCapturedCollection(list) {
  const key = COLLECTION_KEY();
  _collectionMem = { key, list };
  try { localStorage.setItem(key, JSON.stringify(list)); }
  catch (e) { console.warn('[capture-uniko] coleção não coube no localStorage (cache do navegador cheio) — seguindo só em memória:', e?.name || e); }
  try { window.dispatchEvent(new CustomEvent('uniko-collection:changed')); } catch {}
}
// Busca a coleção de capturas de um colega (Supabase) — pra Colegas mostrar a coleção dele.
export async function fetchCapturesFor(player) {
  try {
    const { data } = await _supabase.from('capture_uniko_captures')
      .select('uniko_id,uniko_name,captured_at').eq('player', player).order('captured_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

// Sem `img`: quem desenha a coleção resolve a arte na hora com getUniko(c.id) (a img
// gravada aqui era ignorada de propósito — ver TabInicio — porque podia ter congelado
// o fallback errado). Guardar a URL à toa só engordava o cache.
export function addToMyUnikoCollection(uniko) {
  try {
    const list = getCapturedCollection();
    if (list.some(u => u.id === uniko.id)) return;
    setCapturedCollection([...list, { id: uniko.id, name: uniko.name, at: new Date().toISOString() }]);
  } catch {}
}

// Sincroniza a coleção LOCAL com o servidor (fonte da verdade). Usada ao abrir o Portal:
// se o admin resetou (apagou no Supabase), a coleção local some também. Reconcilia o
// assistente: se a skin ativa não é mais possuída, volta ao UNIKO padrão.
export async function syncCollectionFromServer() {
  try {
    const a = getAuthUser();
    if (!a?.name) return getCapturedCollection();
    // ADMIN tem TODA a coleção liberada — todos os Unikos (fixos + Oficina) contam
    // como "possuídos", sem precisar capturar/ganhar. Pega o roster inteiro em vez
    // das capturas do servidor (getAllUnikos já inclui os da Oficina carregados).
    if (a.role === 'admin') {
      const list = getAllUnikos().map(u => ({ id: u.id, name: u.name, at: new Date().toISOString() }));
      setCapturedCollection(list);
      return list; // admin não sofre o "revert do assistente" abaixo (tem tudo)
    }
    const rows = await fetchCapturesFor(a.name);
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      if (seen.has(r.uniko_id)) continue;
      seen.add(r.uniko_id);
      const u = getUniko(r.uniko_id);
      list.push({ id: r.uniko_id, name: r.uniko_name || u.name, at: r.captured_at });
    }
    setCapturedCollection(list);
    const active = getActiveAssistantSkinId();
    if (active && active !== 'default' && !list.some(x => x.id === active)) setActiveAssistantSkin('default');
    return list;
  } catch (e) {
    // Antes engolia o erro em silêncio — se essa sync falhar (rede, RLS, etc.), a
    // coleção local fica travada no que já estava em cache (podendo ficar bem
    // desatualizada em relação ao servidor) sem nenhum rastro pra investigar.
    console.error('[capture-uniko] syncCollectionFromServer falhou:', e);
    return getCapturedCollection();
  }
}

// ADMIN: reseta a coleção "Capture o Uniko" — de TODOS ou de um jogador específico.
// Apaga as capturas (coleção) e o lock do evento (libera nova captura).
export async function resetCaptures({ player } = {}) {
  const wipe = async (table, col) => {
    let q = _supabase.from(table).delete();
    q = player ? q.eq('player', player) : q.neq(col, '__none__'); // sem player → apaga tudo
    const { error } = await q;
    if (error) throw new Error(error.message);
  };
  // capturas (coleção) por player; evento (lock) por player também (libera quem ele ganhou)
  await wipe('capture_uniko_captures', 'uniko_id');
  await wipe('capture_uniko_event', 'event_id');
}

/* ── Registro do ALVO + pub/sub do ARREMESSO do assistente ──────────────────
   O widget registra uma função que devolve o DOMRect do alvo (o uniko grande);
   o assistente, ao ser solto em cima, dispara o arremesso. ────────────────── */
let _targetFn = null;
export function registerCaptureTarget(fn) { _targetFn = fn; }
export function getCaptureTargetRect() { try { return _targetFn ? _targetFn() : null; } catch { return null; } }

const THROW_EV = 'capture-uniko:throw';
export function emitCaptureThrow() { try { window.dispatchEvent(new CustomEvent(THROW_EV)); } catch {} }
export function onCaptureThrow(cb) {
  const h = () => cb();
  window.addEventListener(THROW_EV, h);
  return () => window.removeEventListener(THROW_EV, h);
}
