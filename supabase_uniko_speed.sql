-- ═══════════════════════════════════════════════════════════════════════════
-- UNIKO SPEED — corrida multiplayer em tempo real (salas com código).
-- Rode no SQL Editor do Supabase. Sem isso a tela de "Multiplayer" mostra
-- aviso amigável em vez de quebrar.
--
-- ARQUITETURA (mesmo padrão já em produção no Uniko Paint — sem servidor de
-- jogo dedicado):
--   • POSIÇÃO de cada carro (60x/s localmente, ~12x/s pela rede) trafega por
--     Realtime BROADCAST (efêmero, não toca no banco) — uma corrida de vários
--     minutos a 12Hz por jogador viraria dezenas de milhares de linhas se
--     fosse gravada.
--   • Só o ESTADO DA SALA (fase, quem criou, traçado/mapa/música escolhidos,
--     a seed da pista, quando a corrida começou) mora aqui — precisa
--     sobreviver a F5 e a quem entra no meio.
--   • A pista em si NUNCA trafega — cada cliente reconstrói a mesma pista
--     localmente a partir da `seed` gravada aqui (ver montarPista/rndFactory
--     em TabUnikoFaster.jsx). Isso é o que garante que todo mundo numa sala
--     veja as MESMAS rampas de turbo e obstáculos, nos mesmos lugares.
--   • Uma linha por sala, `id` = código da sala (igual ao Uniko Paint).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_speed_state (
  id          text primary key,              -- 'geral' (sala fixa) ou código gerado ao criar
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Sala Geral: fixa, sempre disponível no lobby, nunca apagada (assim o lobby
-- nunca fica vazio) — mesmo papel da "Sala Geral" do Uniko Paint.
insert into public.uniko_speed_state (id, state)
values ('geral', '{"phase":"waiting","nome":"Sala Geral","raceCounter":0}'::jsonb)
on conflict (id) do nothing;

alter table public.uniko_speed_state enable row level security;

-- App usa a chave anônima → políticas permissivas, igual ao resto do projeto.
drop policy if exists uniko_speed_state_read   on public.uniko_speed_state;
drop policy if exists uniko_speed_state_insert on public.uniko_speed_state;
drop policy if exists uniko_speed_state_update on public.uniko_speed_state;
drop policy if exists uniko_speed_state_delete on public.uniko_speed_state;

create policy uniko_speed_state_read   on public.uniko_speed_state for select using (true);
create policy uniko_speed_state_insert on public.uniko_speed_state for insert with check (true);
create policy uniko_speed_state_update on public.uniko_speed_state for update using (true) with check (true);
create policy uniko_speed_state_delete on public.uniko_speed_state for delete using (true);   -- faxina de sala vazia (feita pelo app)

-- Índice pro lobby listar as salas por atividade recente.
create index if not exists uniko_speed_state_updated_idx
  on public.uniko_speed_state (updated_at desc);

-- Realtime: o app escuta postgres_changes nesta tabela pra sincronizar a sala
-- (fase, contagem regressiva, etc). Poll de alguns segundos como reforço.
do $$
begin
  alter publication supabase_realtime add table public.uniko_speed_state;
exception
  when duplicate_object then null;
  when others then null;
end $$;
