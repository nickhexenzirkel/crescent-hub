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
import { supabase as _supabase, getAuthUser } from '../contexts/user';
import { getActiveAssistantSkinId, setActiveAssistantSkin } from './assistantSkin';

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
    },
  },
};

export const DEFAULT_UNIKO_ID = 'vampire-robot';
export const getUniko = (id) => CAPTURE_UNIKOS[id] || CAPTURE_UNIKOS[DEFAULT_UNIKO_ID];

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

export function isWithinWindow(cfg, now = Date.now()) {
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
export function isSpawned(cfg, now = Date.now()) {
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
    await _supabase.from('capture_uniko_captures').insert({
      player: a.name,
      uniko_id: uniko.id,
      uniko_name: uniko.name,
      captured_at: new Date().toISOString(),
    });
  } catch {}
}

/* ── Recompensa fixa do evento ───────────────────────────────────────────── */
export const CAPTURE_REWARD = { comum: 100, premium: 100 };

/* ── Lock GLOBAL: só UM colaborador captura por evento ──────────────────────
   `capture_uniko_event` tem event_id como chave única → o 1º insert vence.
   Se der conflito (já capturado), devolve quem capturou. ─────────────────── */
// Devolve o vencedor; null = sem vencedor (ok); undefined = erro de rede (estado desconhecido).
export async function fetchCaptureWinner(cfg) {
  try {
    const { data, error } = await _supabase.from('capture_uniko_event')
      .select('*').eq('event_id', captureEventId(cfg)).maybeSingle();
    if (error) return undefined;
    if (!data) return null;
    return { player: data.player, unikoId: data.uniko_id, unikoName: data.uniko_name,
             comum: data.comum || 0, premium: data.premium || 0, at: data.captured_at };
  } catch { return undefined; }
}

// Limpa o estado LOCAL de captura de um evento (usado quando o servidor diz que não há vencedor).
export function clearCaptureLocal(cfg) {
  try { localStorage.removeItem(doneKey(cfg)); localStorage.removeItem(resultKey(cfg)); } catch {}
}

export async function claimCapture(cfg, uniko) {
  const me = getAuthUser()?.name || 'Você';
  const row = {
    event_id: captureEventId(cfg), player: me,
    uniko_id: uniko.id, uniko_name: uniko.name,
    comum: CAPTURE_REWARD.comum, premium: CAPTURE_REWARD.premium,
    captured_at: new Date().toISOString(),
  };
  try {
    const { error } = await _supabase.from('capture_uniko_event').insert(row);
    if (!error) return { won: true, winner: { player: me, unikoId: uniko.id, unikoName: uniko.name, comum: row.comum, premium: row.premium, at: row.captured_at } };
    // conflito (23505) ou outro → busca o vencedor real
    const winner = await fetchCaptureWinner(cfg);
    return { won: false, winner: winner || { player: '—', comum: 0, premium: 0 } };
  } catch {
    // sem tabela/offline → deixa capturar localmente (fail-safe)
    return { won: true, winner: { player: me, unikoId: uniko.id, unikoName: uniko.name, comum: row.comum, premium: row.premium, at: row.captured_at } };
  }
}

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
