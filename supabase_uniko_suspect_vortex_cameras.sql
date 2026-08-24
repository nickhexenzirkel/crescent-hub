-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SUSPECT — vórtex (teleporte do Impostor) e câmeras de segurança
--
--  Os dois são pontos marcados no mapa pelo admin (Dashboard RH → Uniko
--  Suspect → modos "Vórtex" e "Câmeras"), no mesmo formato já usado pela
--  coluna `tasks`: [{id, label, x, y}] em coordenadas do MAPA (não da tela).
--
--    vortexes → portais ligados entre si. Só o Impostor usa: chega perto de
--               um, escolhe outro e se teletransporta (as "tubulações" do
--               Among Us). Com menos de 2 marcados não há pra onde ir, e o
--               jogo simplesmente não oferece a ação.
--    cameras  → pontos de vigilância. Qualquer jogador que chegar perto de
--               um ponto de câmera abre o painel e vê as OUTRAS câmeras ao
--               vivo, passando de uma pra outra (dá pra flagrar um
--               assassinato acontecendo).
--
--  Ver src/modules/central-colaborador/tabs/TabUnikoSuspect.jsx e
--      src/modules/dashboard-rh/UnikoSuspectMapTab.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_suspect_map
  add column if not exists vortexes jsonb,
  add column if not exists cameras  jsonb;

comment on column public.uniko_suspect_map.vortexes is
  'Portais de teleporte do Impostor: [{id,label,x,y}] em coordenadas do mapa. Precisa de 2+ pra funcionar.';
comment on column public.uniko_suspect_map.cameras is
  'Pontos de câmera de segurança: [{id,label,x,y}] em coordenadas do mapa.';
