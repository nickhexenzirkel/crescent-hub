-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SUSPECT — sabotagem da GELADEIRA (ago/2026)
--
--  Sabotagem nova do Impostor: ele estraga as geladeiras da casa e elas só
--  voltam ao normal quando DUAS PESSOAS DIFERENTES limparem — uma em cada
--  geladeira. Ninguém resolve sozinho correndo de uma pra outra: quem já
--  limpou uma não consegue abrir a outra.
--
--  Os pontos das geladeiras são marcados pelo admin em
--  Dashboard RH → Uniko Detetive → modo "🧊 Geladeiras", no mesmo formato já
--  usado por `tasks`/`vortexes`/`cameras`: [{id, label, x, y}] em coordenadas
--  do MAPA (não da tela). Com menos de 2 marcadas a ação nem aparece pro
--  Impostor (não daria pra exigir duas pessoas).
--
--  Ver src/modules/central-colaborador/tabs/TabUnikoSuspect.jsx e
--      src/modules/dashboard-rh/UnikoSuspectMapTab.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_suspect_map
  add column if not exists geladeiras jsonb;

comment on column public.uniko_suspect_map.geladeiras is
  'Geladeiras da sabotagem: [{id,label,x,y}] em coordenadas do mapa. Precisa de 2+ pra sabotagem existir (uma pessoa por geladeira).';
