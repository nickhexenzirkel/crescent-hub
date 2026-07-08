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
export const nowMs = () => Date.now() + _clockOffsetMs;
export async function syncServerClock() {
  try {
    const t0 = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const t1 = Date.now();
    const serverMs = Date.parse(res.headers.get('date'));
    if (Number.isNaN(serverMs)) return;
    _clockOffsetMs = (serverMs + (t1 - t0) / 2) - t1; // meio do round-trip ≈ instante t1 no servidor
  } catch {}
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

const _slugify = (s) => (s || '')
  .toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'uniko';

// Monta a entrada no formato CAPTURE_UNIKOS a partir de uma linha da tabela custom_unikos.
function _buildCustomCaptureUniko(row) {
  return {
    id: row.id, name: row.name, shortName: row.name, img: row.img_main,
    tagline: row.tagline || 'Uniko criado na Oficina',
    perks: ['Uniko personalizado — feito na Oficina de Uniko', 'Assistente flutuante e foto de perfil próprios'],
    canBeAssistant: true,
    reward: { comum: row.reward_comum ?? 100, premium: row.reward_premium ?? 100 },
    theme: deriveUnikoTheme(row.accent),
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
export function pickSpawnAt(startIso, endIso) {
  const s = Date.parse(startIso), e = Date.parse(endIso);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return startIso;
  const durationMin = (e - s) / 60000;
  const REF_MIN = 30;
  const p = Math.min(6, Math.max(0.15, REF_MIN / durationMin));
  const t = Math.pow(Math.random(), p);
  return new Date(s + t * (e - s)).toISOString();
}

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
    const { error } = await _supabase.from('capture_uniko_captures').insert({
      player: a.name,
      uniko_id: uniko.id,
      uniko_name: uniko.name,
      captured_at: new Date().toISOString(),
    });
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

/* ── Até 3 capturadores por evento ────────────────────────────────────────
   `capture_uniko_event` aceita até 3 linhas por event_id (1 slot cada, ver
   supabase_capture_uniko_multi.sql) — as 3 primeiras pessoas a capturar
   ganham; da 4ª tentativa em diante o evento já está esgotado. ─────────── */
const CAPTURE_MAX_WINNERS = 3;

// Devolve TODOS os vencedores desse evento (0 a 3); undefined = erro de rede.
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

export { CAPTURE_MAX_WINNERS };

/* ── Credita os prismas na carteira do vencedor (mercado_state) + histórico ── */
export async function awardPrismas(player, comum, premium) {
  try {
    const { data: rowData } = await _supabase.from('mercado_state').select('data').eq('player', player).maybeSingle();
    const base = (rowData?.data && Object.keys(rowData.data).length) ? rowData.data : {};
    const data = { ...base, comum: (base.comum || 0) + comum, premium: (base.premium || 0) + premium, updatedAt: Date.now() };
    await _supabase.from('mercado_state').upsert({ player, data, updated_at: new Date().toISOString() });
    await _supabase.from('mercado_history').insert({ player, kind: 'captura', descr: 'Capture o Uniko', comum, premium });
  } catch {}
}

/* ── Coleção do My Uniko (localStorage por usuário) ──────────────────────────
   O uniko capturado vira um "skin" equipável no My Uniko. ─────────────────── */
const COLLECTION_KEY = () => `uniko_captured_${userTag()}`;
export function getCapturedCollection() {
  try { return JSON.parse(localStorage.getItem(COLLECTION_KEY()) || '[]'); } catch { return []; }
}
// Busca a coleção de capturas de um colega (Supabase) — pra Colegas mostrar a coleção dele.
export async function fetchCapturesFor(player) {
  try {
    const { data } = await _supabase.from('capture_uniko_captures')
      .select('uniko_id,uniko_name,captured_at').eq('player', player).order('captured_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

export function addToMyUnikoCollection(uniko) {
  try {
    const list = getCapturedCollection();
    if (list.some(u => u.id === uniko.id)) return;
    list.push({ id: uniko.id, name: uniko.name, img: uniko.img, at: new Date().toISOString() });
    localStorage.setItem(COLLECTION_KEY(), JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('uniko-collection:changed'));
  } catch {}
}

// Sincroniza a coleção LOCAL com o servidor (fonte da verdade). Usada ao abrir o Portal:
// se o admin resetou (apagou no Supabase), a coleção local some também. Reconcilia o
// assistente: se a skin ativa não é mais possuída, volta ao UNIKO padrão.
export async function syncCollectionFromServer() {
  try {
    const a = getAuthUser();
    if (!a?.name) return getCapturedCollection();
    const rows = await fetchCapturesFor(a.name);
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      if (seen.has(r.uniko_id)) continue;
      seen.add(r.uniko_id);
      const u = getUniko(r.uniko_id);
      list.push({ id: r.uniko_id, name: r.uniko_name || u.name, img: u.img, at: r.captured_at });
    }
    localStorage.setItem(COLLECTION_KEY(), JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('uniko-collection:changed'));
    const active = getActiveAssistantSkinId();
    if (active && active !== 'default' && !list.some(x => x.id === active)) setActiveAssistantSkin('default');
    return list;
  } catch { return getCapturedCollection(); }
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
