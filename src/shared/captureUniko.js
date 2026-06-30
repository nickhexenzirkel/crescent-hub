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

/* ──────────────────────────────────────────────────────────────────────────
   ROSTER — cada Uniko capturável traz sua arte + tema (borda/cenário do widget).
   Pra adicionar outro Uniko depois, basta uma entrada nova aqui.
   ────────────────────────────────────────────────────────────────────────── */
export const CAPTURE_UNIKOS = {
  'vampire-robot': {
    id: 'vampire-robot',
    name: 'Uniko Vampire-Robot',
    img: '/DarkCatBotMinions.png',
    tagline: 'Robô-vampiro cibernético das sombras',
    // Tema: preto / roxo / cinza, estética cibernética + vampírica, cenário pixel
    // (morcegos de pixel, castelo de pixel, partículas roxas).
    theme: {
      accent:  '#a855f7',   // roxo principal
      accent2: '#7c3aed',
      glow:    '#c084fc',
      deep:    '#120821',
      ink:     '#e9d5ff',
      // cores que giram na borda cônica animada do widget
      border: ['#3b1063', '#7c3aed', '#a855f7', '#c084fc', '#4b5563', '#6b21a8', '#3b1063'],
      // fundo do cenário interno
      scene: 'radial-gradient(120% 90% at 50% 0%, #2a1147 0%, #1a0b2e 45%, #0b0512 100%)',
      castle: '#2a164d',
      bat:    '#1c0d33',
      pixel:  '#a855f7',
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

const userTag = () => { try { return getAuthUser()?.cpf || getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };
const doneKey = (cfg) => `capture_uniko_done_${userTag()}_${captureEventId(cfg)}`;

export function isCaptureDone(cfg) {
  try { return localStorage.getItem(doneKey(cfg)) === '1'; } catch { return false; }
}
export function markCaptureDone(cfg) {
  try { localStorage.setItem(doneKey(cfg), '1'); } catch {}
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
