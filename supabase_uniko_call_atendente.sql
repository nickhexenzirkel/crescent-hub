-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — atendente e setor de cada ligação.
--
--  A extensão agora faz login (CPF + senha do Portal) no popup e manda o
--  token junto de cada upload. O servidor resolve quem é o colaborador e
--  grava, NA HORA da ligação, o id/nome dele e os setores dele (tags
--  "colegas_setores" do Portal). É um retrato do momento: se a pessoa
--  mudar de setor depois, as ligações antigas continuam no setor em que
--  foram feitas.
--
--  Ligações antigas (antes disso) ficam com attendant_* nulo e aparecem
--  como "Sem atendente identificado".
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer (o mesmo do
--  supabase_uniko_call.sql). É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.uniko_call_recordings add column if not exists attendant_id   text;
alter table public.uniko_call_recordings add column if not exists attendant_name text;
alter table public.uniko_call_recordings add column if not exists sectors        text[] not null default '{}';

create index if not exists uniko_call_recordings_attendant_idx on public.uniko_call_recordings (attendant_id, started_at);
create index if not exists uniko_call_recordings_started_idx   on public.uniko_call_recordings (started_at);
