-- Corrige linhas duplicadas já existentes em capture_uniko_captures (mesmo player +
-- mesmo uniko_id gravado 2x, causado por saveCaptureToCollection/giftUnikoToPlayer
-- usando INSERT puro sem proteção contra corrida/retry) e impede que aconteça de novo.
--
-- Rodar no SQL Editor do Supabase.

-- 1) Remove as duplicatas, mantendo a captura mais ANTIGA de cada (player, uniko_id).
delete from public.capture_uniko_captures a
using public.capture_uniko_captures b
where a.player = b.player
  and a.uniko_id = b.uniko_id
  and a.captured_at > b.captured_at;

-- 2) Impede duplicata nova de vez — necessário pro .upsert(..., {onConflict:'player,uniko_id'})
--    usado agora em saveCaptureToCollection/giftUnikoToPlayer (captureUniko.js).
alter table public.capture_uniko_captures
  add constraint capture_uniko_captures_player_uniko_unique unique (player, uniko_id);
