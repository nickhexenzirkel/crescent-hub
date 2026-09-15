// src/shared/captureNumero.js
// "Capture o Número" — sorteio de números da sorte (1 a 100), mesma mecânica do
// "Capture o Uniko" (arremesso do assistente, até 5 vagas por evento, FILA de
// spawns agendados), só que:
//   • SEM recompensa em Prismas por enquanto — só grava a captura na coleção
//     (o sorteio/prêmio de verdade fica pra depois, é decisão explícita).
//   • SEM tema/cenário por número — visual é um cartão dourado fixo (ver
//     CaptureNumeroWidget.jsx), não precisa de Oficina pra criar números novos.
// Reaproveita do captureUniko.js tudo que já é GENÉRICO (relógio sincronizado com
// o servidor, sorteio do instante de spawn, checagem de janela, cálculo de
// ocorrência da fila, hash+PRNG semeado) em vez de duplicar — nada nessas
// funções depende do conceito de "Uniko".
import { supabase as _supabase, getAuthUser } from '../contexts/user';
import {
  nowMs, ensureServerClock, pickSpawnAt, pickSpawnAtSeeded,
  isWithinWindow, spawnMoment, isSpawned, WINNER_PANEL_MS,
  activeOccurrence, nextOccurrence, hashStr, mulberry32,
} from './captureUniko';

export {
  nowMs, ensureServerClock, pickSpawnAt, pickSpawnAtSeeded, isWithinWindow, spawnMoment, isSpawned, WINNER_PANEL_MS,
  activeOccurrence, nextOccurrence,
};

const userTag = () => { try { return getAuthUser()?.cpf || getAuthUser()?.name || 'anon'; } catch { return 'anon'; } };

/* ── Config do evento (settings.capture_numero_config) ──────────────────────
   { enabled, startAt(ISO), endAt(ISO), pool:[1..100], numeroValue, slotNumeroValues?, maxWinners } */
export const CONFIG_KEY = 'capture_numero_config';

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

/* ── NÚMERO ALEATÓRIO ────────────────────────────────────────────────────────
   O admin escolhe um POOL de números elegíveis (cfg.pool, ex.: [7, 13, 42]) e um
   modo: número fixo (pool com 1 item só), sortear 1 do pool, ou sortear 1
   DIFERENTE por vaga. O sorteio acontece na hora de SALVAR o config (nunca no
   widget): o config sempre guarda um `numeroValue` concreto (o da 1ª vaga), e no
   modo por vaga vem junto `slotNumeroValues`. */
export const RANDOM_NUMERO_ID   = '__random__';
export const RANDOM_PER_SLOT_ID = '__random_slot__';
export const isRandomNumeroChoice = (id) => id === RANDOM_NUMERO_ID || id === RANDOM_PER_SLOT_ID;

const cleanPool = (pool) => Array.isArray(pool)
  ? [...new Set(pool.filter(n => Number.isInteger(n) && n >= 1 && n <= 100))].sort((a, b) => a - b)
  : [];

// Resolve a escolha do admin → { numeroValue, slotNumeroValues? }. Escolha fixa passa direto.
export function resolveNumeroChoice(choice, pool, maxWinners, rnd = Math.random) {
  if (!isRandomNumeroChoice(choice)) return { numeroValue: Number(choice) };
  const p = cleanPool(pool);
  if (!p.length) return { numeroValue: 1 }; // sem pool (não deveria acontecer — o admin sempre marca pelo menos 1)
  if (choice === RANDOM_NUMERO_ID) return { numeroValue: p[Math.floor(rnd() * p.length)] };
  // Por vaga: embaralha e distribui sem repetir enquanto houver número diferente sobrando.
  const values = [];
  while (values.length < maxWinners) {
    const deck = [...p];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    values.push(...deck);
  }
  const slotNumeroValues = values.slice(0, maxWinners);
  return { numeroValue: slotNumeroValues[0], slotNumeroValues };
}

// Número da PRÓXIMA vaga livre (`taken` = quantas já foram capturadas).
export function numeroValueForSlot(cfg, taken = 0) {
  const list = cfg?.slotNumeroValues;
  if (Array.isArray(list) && list.length) return list[Math.min(Math.max(0, taken), list.length - 1)];
  return cfg?.numeroValue;
}

/* ── Até N capturadores por evento (1 a 5, padrão 3 — mesmo teto do Uniko) ── */
export const CAPTURE_MAX_WINNERS_DEFAULT = 3;
export const CAPTURE_MAX_WINNERS_CAP = 5;
export function maxWinnersFor(cfg) {
  const n = Math.floor(Number(cfg?.maxWinners));
  if (!Number.isFinite(n) || n < 1) return CAPTURE_MAX_WINNERS_DEFAULT;
  return Math.min(n, CAPTURE_MAX_WINNERS_CAP);
}

/* ── "Já fiz esse evento" localmente (marca otimista; o servidor manda) ────── */
const doneKey   = (cfg) => `capture_numero_done_${userTag()}_${captureEventId(cfg)}`;
export function isCaptureDone(cfg) { try { return localStorage.getItem(doneKey(cfg)) === '1'; } catch { return false; } }
export function markCaptureDone(cfg) { try { localStorage.setItem(doneKey(cfg), '1'); } catch {} }

const resultKey = (cfg) => `capture_numero_result_${userTag()}_${captureEventId(cfg)}`;
export function getCaptureResult(cfg) { try { const r = localStorage.getItem(resultKey(cfg)); return r ? JSON.parse(r) : null; } catch { return null; } }
export function setCaptureResult(cfg, result) { try { localStorage.setItem(resultKey(cfg), JSON.stringify(result)); } catch {} }
export function clearCaptureDone(cfg) { try { localStorage.removeItem(doneKey(cfg)); } catch {} }
export function clearCaptureLocal(cfg) { try { localStorage.removeItem(doneKey(cfg)); localStorage.removeItem(resultKey(cfg)); } catch {} }

/* ── Pub/sub widget ⇆ assistente — eventos PRÓPRIOS (não misturam com os do
   Capture o Uniko; o assistente escuta os dois em paralelo, ver UnikoAssistant.jsx) ── */
const STATE_EV = 'capture-numero:state';
let _lastState = { available: false, numeroValue: null };

// state: { available: boolean, numeroValue: number|null, captured?: boolean }
export function emitCaptureNumeroState(state) {
  _lastState = state;
  try { window.dispatchEvent(new CustomEvent(STATE_EV, { detail: state })); } catch {}
}
export function onCaptureNumeroState(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(STATE_EV, h);
  if (_lastState) cb(_lastState);
  return () => window.removeEventListener(STATE_EV, h);
}

const SLOT_EV = 'capture-numero:slot';
let _lastSlot = false;
export function emitCaptureNumeroSlotBusy(busy) {
  _lastSlot = !!busy;
  try { window.dispatchEvent(new CustomEvent(SLOT_EV, { detail: _lastSlot })); } catch {}
}
export function onCaptureNumeroSlotBusy(cb) {
  const h = (e) => cb(e.detail);
  window.addEventListener(SLOT_EV, h);
  cb(_lastSlot);
  return () => window.removeEventListener(SLOT_EV, h);
}

/* ── Registro do ALVO + pub/sub do ARREMESSO — singleton PRÓPRIO (nunca conflita
   com o do Uniko, mesmo se os dois eventos estiverem rolando ao mesmo tempo) ── */
let _targetFn = null;
export function registerCaptureNumeroTarget(fn) { _targetFn = fn; }
export function getCaptureNumeroTargetRect() { try { return _targetFn ? _targetFn() : null; } catch { return null; } }

const THROW_EV = 'capture-numero:throw';
export function emitCaptureNumeroThrow() { try { window.dispatchEvent(new CustomEvent(THROW_EV)); } catch {} }
export function onCaptureNumeroThrow(cb) {
  const h = () => cb();
  window.addEventListener(THROW_EV, h);
  return () => window.removeEventListener(THROW_EV, h);
}

/* ── Vencedores do evento (0 a maxWinnersFor(cfg)); undefined = erro de rede ── */
export async function fetchCaptureWinners(cfg) {
  try {
    const { data, error } = await _supabase.from('capture_numero_event')
      .select('*').eq('event_id', captureEventId(cfg)).order('slot', { ascending: true });
    if (error) return undefined;
    return (data || []).map(row => ({ player: row.player, numeroValue: row.numero_value, at: row.captured_at }));
  } catch { return undefined; }
}

// Realtime: avisa TODOS os clientes ~na hora quando alguém captura, em vez de
// esperar o próximo poll. Precisa do publication setup em supabase_capture_numero.sql;
// sem ele, cai só no poll (fallback já existente no widget) — não quebra nada.
export function subscribeCaptureWinner(cfg, onWinner) {
  if (!cfg) return () => {};
  let ch;
  try {
    ch = _supabase.channel(`capture-numero-event-${captureEventId(cfg)}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'capture_numero_event',
        filter: `event_id=eq.${captureEventId(cfg)}`,
      }, (payload) => {
        const row = payload?.new;
        if (!row) return;
        onWinner({ player: row.player, numeroValue: row.numero_value, at: row.captured_at });
      })
      .subscribe();
  } catch { return () => {}; }
  return () => { try { _supabase.removeChannel(ch); } catch {} };
}

// Tenta ocupar um dos slots do evento via função atômica no banco (capture_numero_try)
// — evita a corrida de duas pessoas "ganhando" o mesmo slot ao capturar quase ao
// mesmo tempo (ver supabase_capture_numero.sql).
export async function claimCapture(cfg, numeroValue) {
  const me = getAuthUser()?.name || 'Você';
  try {
    const { data, error } = await _supabase.rpc('capture_numero_try', {
      p_event_id: captureEventId(cfg), p_player: me,
      p_numero_value: numeroValue, p_max_winners: maxWinnersFor(cfg),
    });
    if (error) {
      console.error('[capture-numero] claimCapture (rpc) falhou:', error);
      return { won: false, alreadyMine: false, isFull: false, winner: null, networkError: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.ok) {
      return { won: true, alreadyMine: false, isFull: false,
        winner: { player: me, numeroValue, at: new Date().toISOString() } };
    }
    if (row?.already_mine) return { won: false, alreadyMine: true, isFull: false, winner: null };
    // Não ganhou e não é meu — só é "esgotado" se a lista real estiver cheia; senão
    // é recusa (`rejected`) e quem chamou deixa tentar de novo (mesmo raciocínio do
    // claimCapture do Uniko: a função pode recusar por outro motivo além de esgotar).
    const winners = await fetchCaptureWinners(cfg);
    const lista = winners || [];
    const cheio = lista.length >= maxWinnersFor(cfg);
    return { won: false, alreadyMine: false, isFull: cheio, rejected: !cheio, winner: null, winners: lista };
  } catch (e) {
    console.error('[capture-numero] claimCapture lançou exceção:', e);
    return { won: false, alreadyMine: false, isFull: false, winner: null, networkError: true };
  }
}

export async function saveCaptureToCollection(numeroValue) {
  try {
    const a = getAuthUser();
    if (!a?.name) return;
    const { error } = await _supabase.from('capture_numero_captures')
      .upsert({ player: a.name, numero_value: numeroValue, captured_at: new Date().toISOString() },
        { onConflict: 'player,numero_value', ignoreDuplicates: true });
    if (error) console.error('[capture-numero] falha ao salvar na coleção:', error);
  } catch (e) { console.error('[capture-numero] falha ao salvar na coleção:', e); }
}

/* ── Coleção de números (localStorage por usuário, espelho do servidor) ────── */
const COLLECTION_KEY = () => `numero_captured_${userTag()}`;
let _collectionMem = { key: '', list: null };

export function getCapturedNumeros() {
  const key = COLLECTION_KEY();
  if (_collectionMem.key === key && _collectionMem.list) return _collectionMem.list;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function setCapturedNumeros(list) {
  const key = COLLECTION_KEY();
  _collectionMem = { key, list };
  try { localStorage.setItem(key, JSON.stringify(list)); }
  catch (e) { console.warn('[capture-numero] coleção não coube no localStorage — seguindo só em memória:', e?.name || e); }
  try { window.dispatchEvent(new CustomEvent('numero-collection:changed')); } catch {}
}

// Busca a coleção de capturas de um jogador específico (Supabase).
export async function fetchCapturesFor(player) {
  try {
    const { data } = await _supabase.from('capture_numero_captures')
      .select('numero_value,captured_at').eq('player', player).order('captured_at', { ascending: false });
    return data || [];
  } catch { return []; }
}

// ADMIN: busca TODAS as capturas já feitas (de qualquer jogador), agrupadas por
// número — usada na grade global 1-100 do Dashboard RH pra mostrar quais números
// já saíram e quem já pegou cada um (um mesmo número pode ter mais de um dono,
// já que o sorteio pode repetir número entre eventos/jogadores diferentes).
export async function fetchAllCaptures() {
  try {
    const { data, error } = await _supabase.from('capture_numero_captures')
      .select('player,numero_value,captured_at').order('captured_at', { ascending: true });
    if (error) return {};
    const byNumero = {};
    for (const row of (data || [])) {
      (byNumero[row.numero_value] ||= []).push({ player: row.player, at: row.captured_at });
    }
    return byNumero;
  } catch { return {}; }
}

export function addToMyNumeroCollection(numeroValue) {
  try {
    const list = getCapturedNumeros();
    if (list.some(n => n.value === numeroValue)) return;
    setCapturedNumeros([...list, { value: numeroValue, at: new Date().toISOString() }]);
  } catch {}
}

// Sincroniza a coleção LOCAL com o servidor (fonte da verdade) — usada ao abrir a
// Coleção de Números: se o admin resetou, a coleção local some também.
export async function syncNumeroCollectionFromServer() {
  try {
    const a = getAuthUser();
    if (!a?.name) return getCapturedNumeros();
    const rows = await fetchCapturesFor(a.name);
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      if (seen.has(r.numero_value)) continue;
      seen.add(r.numero_value);
      list.push({ value: r.numero_value, at: r.captured_at });
    }
    setCapturedNumeros(list);
    return list;
  } catch (e) {
    console.error('[capture-numero] syncNumeroCollectionFromServer falhou:', e);
    return getCapturedNumeros();
  }
}

// ADMIN: reseta a coleção "Capture o Número" — de TODOS ou de um jogador específico.
// Apaga as capturas (coleção) e o lock do evento (libera nova captura).
export async function resetNumeroCaptures({ player } = {}) {
  // Sempre filtra por `player` (texto, presente nas duas tabelas) — `numero_value`/
  // `event_id` não servem de coluna "apaga tudo" aqui: numero_value é integer (um
  // neq('__none__') nele vira erro 400 de cast) e nada garante event_id não-nulo.
  const wipe = async (table) => {
    let q = _supabase.from(table).delete();
    q = player ? q.eq('player', player) : q.neq('player', '__none__'); // sem player → apaga tudo
    const { error } = await q;
    if (error) throw new Error(error.message);
  };
  await wipe('capture_numero_captures');
  await wipe('capture_numero_event');
}

/* ══════════════════════════════════════════════════════════════════════════
   FILA DE SPAWNS AGENDADOS (agenda do Capture o Número) — mesmo mecanismo do
   Capture o Uniko (ver bloco equivalente em captureUniko.js): o admin monta
   uma LISTA de eventos ("das 10:00 às 11:30 sorteia entre 7/13/42, todo dia"),
   cada item guarda só o MOLDE — a janela concreta ("ocorrência") é calculada
   na hora, no fuso local (`activeOccurrence`/`nextOccurrence`, reaproveitados
   de captureUniko.js — são cálculo puro de janela, nada de "Uniko" neles).

   Quando a hora de uma ocorrência chega, ela é PROMOVIDA: vira o
   `capture_numero_config` normal (mesmo formato de sempre). Nada mais no
   sistema precisa saber que veio da fila — widget e assistente continuam
   lendo só o config.

   Item da fila:
     { id, pool:[1,7,42], numeroMode: number|RANDOM_NUMERO_ID|RANDOM_PER_SLOT_ID,
       maxWinners, mode:'daily'|'once', date:'2026-09-14' (só no 'once'),
       startTime:'10:00', endTime:'11:30', enabled }
   (campo `mode` aqui é a REPETIÇÃO diário/único — não confundir com o
   `numeroMode` de sorteio, nome deliberadamente diferente.)
   ══════════════════════════════════════════════════════════════════════════ */
export const SCHEDULE_KEY     = 'capture_numero_schedule';
export const AGENDA_STATE_KEY = 'capture_numero_agenda_state';

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

// Item da fila → config do evento (formato de sempre do capture_numero_config).
// Sorteio semeado pela ocorrência (igual o spawnAt) → gravação idempotente entre
// navegadores (dois clientes promovendo a MESMA ocorrência calculam o MESMO config).
export function cfgFromScheduleEntry(entry, occ) {
  const maxWinners = maxWinnersFor(entry);
  const choice = isRandomNumeroChoice(entry.numeroMode) ? entry.numeroMode : Number(entry.numeroMode);
  return {
    enabled: true,
    startAt: occ.startIso,
    endAt: occ.endIso,
    spawnAt: pickSpawnAtSeeded(occ.startIso, occ.endIso, occ.key),
    pool: entry.pool,
    ...resolveNumeroChoice(choice, entry.pool, maxWinners, mulberry32(hashStr(`${occ.key}#numero`))),
    maxWinners,
    agendaKey: occ.key, // rastro de qual item da fila gerou este evento
  };
}

/* Ocorrências já disparadas — mesma lógica do Uniko: guardadas no settings pra
   NENHUM cliente repetir um evento que já rolou. Mantém só as últimas 60. */
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
    // (ex.: um "Spawnar agora" manual no meio de uma janela agendada).
    const curStart = currentCfg?.startAt ? Date.parse(currentCfg.startAt) : NaN;
    const curEnd   = currentCfg?.endAt   ? Date.parse(currentCfg.endAt)   : NaN;
    if (currentCfg?.enabled && !Number.isNaN(curStart) && curStart > best.occ.startMs
        && (Number.isNaN(curEnd) || now <= curEnd)) return null;

    const cfg = cfgFromScheduleEntry(best.entry, best.occ);
    await saveCaptureConfig(cfg);
    await markAgendaDone(best.occ.key);
    // 'Única vez' já cumpriu seu papel: sai da fila sozinho pra não poluir a lista.
    if (best.entry.mode === 'once') {
      try { await saveCaptureSchedule((await loadCaptureSchedule()).filter(e => e.id !== best.entry.id)); } catch {}
    }
    return cfg;
  } catch (e) {
    console.error('[capture-numero] runCaptureScheduler falhou:', e);
    return null;
  }
}
