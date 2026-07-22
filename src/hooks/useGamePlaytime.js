import { useEffect, useRef } from 'react';
import { addGamePlaytime } from '../shared/gamePlaytime';

// Conta o tempo de PARTIDA de um jogo e manda pro Supabase (uniko_playtime).
//
//   useGamePlaytime('paint', room !== null)
//
// Só corre enquanto `active` for true E a aba estiver visível — deixar o Portal
// aberto num monitor não pode virar "8 horas de Uniko Paint". Descarrega a cada
// FLUSH_MS (e ao pausar/desmontar) em vez de a cada segundo, pra não transformar
// uma partida em centenas de writes.
//
// O Uniko Wave NÃO usa este hook: lá o jogo roda num iframe e manda o tempo
// exato de cada partida por postMessage (UNIKO_PLAYTIME) — ver TabUnikoWave.
const FLUSH_MS = 60_000;

export const useGamePlaytime = (game, active) => {
  const startedAt = useRef(null);  // quando o cronômetro atual começou (ms)
  const pending   = useRef(0);     // segundos acumulados ainda não enviados

  useEffect(() => {
    if (!game) return;

    const isVisible = () => document.visibilityState !== 'hidden';

    // Fecha o trecho aberto e joga os segundos no acumulado.
    const stopClock = () => {
      if (startedAt.current == null) return;
      pending.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    };
    const startClock = () => { if (startedAt.current == null) startedAt.current = Date.now(); };

    // Fechar a aba no meio de um trecho pode perder até 1 minuto: o `pagehide`
    // dispara o envio, mas o navegador não garante que uma request assíncrona
    // termine no unload. É perda aceitável — tempo jogado é métrica, não saldo.
    const flush = () => {
      stopClock();
      const secs = Math.floor(pending.current);
      if (secs <= 0) return;
      pending.current -= secs;
      addGamePlaytime(game, secs);
    };

    const sync = () => { if (active && isVisible()) startClock(); else stopClock(); };

    sync();
    const onVis = () => { if (!isVisible()) flush(); else sync(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);

    const timer = setInterval(() => { if (startedAt.current != null) { flush(); sync(); } }, FLUSH_MS);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [game, active]);
};
