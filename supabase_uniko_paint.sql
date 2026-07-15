-- ═══════════════════════════════════════════════════════════════════════════
-- UNIKO PAINT — jogo de desenho e adivinhação em tempo real (estilo Gartic).
-- Rode no SQL Editor do Supabase. Sem isso a aba mostra aviso e não funciona.
--
-- ARQUITETURA (por que só UMA tabela):
--   • Os TRAÇOS do desenho e o CHAT trafegam por Realtime BROADCAST (efêmero,
--     não toca no banco). Um traço a cada ~16ms por desenhista viraria milhares
--     de INSERTs por partida — broadcast é o transporte certo pra isso.
--   • Só o ESTADO DA PARTIDA (fase, rodada, quem desenha, placar) mora aqui,
--     porque precisa sobreviver a F5 e a quem entra no meio do jogo.
--   • É uma SALA GLOBAL única: uma linha, id='global'. Se um dia quisermos
--     várias salas, basta usar o id como código da sala — o schema já aguenta.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_paint_state (
  id          text primary key,              -- 'global' (sala única por enquanto)
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Sala global nasce em lobby.
insert into public.uniko_paint_state (id, state)
values ('global', '{"phase":"lobby","round":0,"scores":{}}'::jsonb)
on conflict (id) do nothing;

alter table public.uniko_paint_state enable row level security;

-- App usa a chave anônima → políticas permissivas, igual ao resto do projeto.
drop policy if exists uniko_paint_state_read   on public.uniko_paint_state;
drop policy if exists uniko_paint_state_insert on public.uniko_paint_state;
drop policy if exists uniko_paint_state_update on public.uniko_paint_state;

create policy uniko_paint_state_read   on public.uniko_paint_state for select using (true);
create policy uniko_paint_state_insert on public.uniko_paint_state for insert with check (true);
create policy uniko_paint_state_update on public.uniko_paint_state for update using (true) with check (true);

-- Realtime: o app escuta postgres_changes nesta tabela pra sincronizar a partida.
-- (Se a tabela já estiver na publicação, o Postgres devolve erro — daí o bloco.)
do $$
begin
  alter publication supabase_realtime add table public.uniko_paint_state;
exception
  when duplicate_object then null;
  when others then null;
end $$;
