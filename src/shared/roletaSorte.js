// src/shared/roletaSorte.js
// "Roleta da Sorte" — roleta de prêmios ao vivo no Portal do Colaborador. Só o
// admin monta a lista de participantes (número ou nome, tanto faz — é só um
// rótulo em texto) e aperta "Girar"; todo mundo que estiver com a aba aberta,
// em QUALQUER computador, vê a MESMA roleta girando ao mesmo tempo — sem
// controle nenhum, só assistindo.
//
// Sincronização em tempo real = mesma receita do "Capture o Uniko"/"Capture o
// Número": o giro é um evento com um instante ABSOLUTO (spin.startedAt) e uma
// duração fixa; cada cliente calcula sozinho, a cada frame, "quantos graus a
// roleta já girou até agora" a partir do relógio SINCRONIZADO com o servidor
// (nowMs()/ensureServerClock(), reaproveitados de captureUniko.js — não tem
// nada de "Uniko" nessas duas funções, é cálculo de relógio puro). Não existe
// frame nenhum viajando pela rede: quem entra no meio do giro calcula o
// ângulo exato daquele instante e continua dali, e quem entra depois do giro
// já acabado vê a roleta parada direto no resultado.
//
// Config inteira mora em `settings` (key = 'roleta_sorte_config'), mesma
// tabela/realtime que o resto do sistema já usa:
//   {
//     entries: [{ id, label }],       // pool configurado pelo admin
//     spin: null | {
//       id,                           // muda a cada giro (detecta giro NOVO)
//       entries: [{ id, label }],     // congela quem participou DESSE giro
//       winnerIndex,                  // índice do vencedor dentro de `entries`
//       baseAngle, finalAngle,        // graus ACUMULADOS (nunca normalizados)
//       startedAt,                    // ISO — instante absoluto do giro
//       durationMs, turns,
//     }
//   }
import { supabase as _supabase } from '../contexts/user';
export { nowMs, ensureServerClock } from './captureUniko';
import { nowMs } from './captureUniko';

export const CONFIG_KEY = 'roleta_sorte_config';

export async function loadRoletaConfig() {
  try {
    const { data } = await _supabase.from('settings').select('value').eq('key', CONFIG_KEY).maybeSingle();
    if (data?.value) return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  } catch {}
  return null;
}

export async function saveRoletaConfig(cfg) {
  const { error } = await _supabase.from('settings').upsert(
    { key: CONFIG_KEY, value: JSON.stringify(cfg) }, { onConflict: 'key' },
  );
  if (error) throw error;
}

// Realtime: reflete o giro/config em TODOS os computadores quase na hora, sem
// depender de poll. `settings` já está na publication supabase_realtime (ver
// supabase_capture_uniko_realtime.sql/supabase_capture_numero.sql) — nenhuma
// migração nova é necessária.
export function subscribeRoletaConfig(onChange) {
  let ch;
  try {
    ch = _supabase.channel('roleta-sorte-config-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${CONFIG_KEY}` },
        (payload) => {
          const raw = payload?.new?.value;
          if (raw === undefined) return;
          try { onChange(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch {}
        })
      .subscribe();
  } catch { return () => {}; }
  return () => { try { _supabase.removeChannel(ch); } catch {} };
}

/* ── Aviso "vem ver a roleta" ────────────────────────────────────────────────
   Botão do admin: manda um aviso EFÊMERO (Realtime Broadcast — não grava nada
   no banco, não precisa de tabela/migração) pra quem estiver com o Portal
   aberto em QUALQUER computador. Vira um toast dentro do app (não é
   notificação de desktop — de propósito: pedido explícito de não usar aquele
   canal aqui) com um botão que leva direto pra aba Roleta da Sorte. Quem não
   estiver com o Portal aberto no instante simplesmente não recebe (é um
   convite pra vir ver agora, não um lembrete persistente). */
const PING_CHANNEL = 'roleta-sorte-ping';

export async function notifyRoletaPing(message) {
  const ch = _supabase.channel(PING_CHANNEL);
  await new Promise((resolve) => {
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); });
    setTimeout(resolve, 2000); // não trava pra sempre se o realtime demorar
  });
  try {
    await ch.send({ type: 'broadcast', event: 'ping', payload: { message: message || 'Vem ver a Roleta da Sorte!', at: Date.now() } });
  } finally {
    setTimeout(() => { try { _supabase.removeChannel(ch); } catch {} }, 500);
  }
}

export function subscribeRoletaPing(onPing) {
  let ch;
  try {
    ch = _supabase.channel(PING_CHANNEL)
      .on('broadcast', { event: 'ping' }, ({ payload }) => onPing(payload))
      .subscribe();
  } catch { return () => {}; }
  return () => { try { _supabase.removeChannel(ch); } catch {} };
}

/* Ângulo de descanso ATUAL (acumulado, nunca normalizado) — de onde o
   PRÓXIMO giro deve continuar pra roleta não "pular" visualmente. */
export const restAngleOf = (cfg) => cfg?.spin?.finalAngle || 0;

export const ROLETA_TURNS_DEFAULT = 9;       // voltas completas antes de desacelerar
export const ROLETA_DURATION_MS   = 7200;    // duração total do giro

// Monta o objeto do PRÓXIMO giro: sorteia um vencedor dentre `entries` e
// calcula o ângulo final (a partir do ângulo de descanso atual) pra esse
// vencedor terminar centralizado sob o ponteiro fixo no topo da roleta.
export function buildSpin(entries, restAngle, { turns = ROLETA_TURNS_DEFAULT, durationMs = ROLETA_DURATION_MS } = {}) {
  const n = entries.length;
  const winnerIndex = Math.floor(Math.random() * n);
  const segWidth = 360 / n;
  const segCenter = winnerIndex * segWidth + segWidth / 2; // a partir do topo, sentido horário
  const jitter = (Math.random() - 0.5) * segWidth * 0.6;   // não cai sempre bem no centro do gomo
  // Ponteiro fixo em 0° (topo): depois de rotacionar R°, o gomo que estava em
  // `segCenter` passa a estar em `segCenter + R` (mod 360) — queremos isso ≡ 0.
  const targetMod = ((360 - (segCenter + jitter)) % 360 + 360) % 360;
  const baseMod = ((restAngle % 360) + 360) % 360;
  let delta = targetMod - baseMod;
  if (delta <= 0) delta += 360; // sempre gira PRA FRENTE, nunca volta
  const finalAngle = restAngle + turns * 360 + delta;
  return {
    id: `sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    entries, winnerIndex, baseAngle: restAngle, finalAngle,
    startedAt: new Date(nowMs()).toISOString(),
    durationMs, turns,
  };
}

/* Progresso do giro (0 a 1) no instante atual — >=1 quando já terminou. */
export function spinProgress(spin) {
  if (!spin) return 1;
  const t0 = Date.parse(spin.startedAt);
  if (Number.isNaN(t0)) return 1;
  return (nowMs() - t0) / (spin.durationMs || ROLETA_DURATION_MS);
}
