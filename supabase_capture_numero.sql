-- "Capture o Número" — sorteio de números da sorte (1 a 100), mesmo mecanismo do
-- "Capture o Uniko" (arremesso do assistente, até 5 vagas por evento), só que sem
-- recompensa em Prismas por enquanto (só captura + coleção) e sem tema/cenário por
-- número. A CONFIG do evento (ativo? janela? quais números?) fica em `settings`,
-- chave 'capture_numero_config' (igual o Uniko usa 'capture_uniko_config') — esta
-- tabela guarda só o histórico/coleção de quem capturou. Rode no SQL Editor do
-- Supabase (idempotente, seguro rodar de novo).

create table if not exists public.capture_numero_captures (
  id            bigint generated always as identity primary key,
  player        text not null,
  numero_value  integer not null,
  captured_at   timestamptz not null default now()
);

-- Um player nunca captura o MESMO número duas vezes (upsert com onConflict usa isto).
create unique index if not exists capture_numero_captures_player_numero_uidx
  on public.capture_numero_captures (player, numero_value);

-- Varrer a coleção de um jogador rapidamente.
create index if not exists capture_numero_player_idx on public.capture_numero_captures (player, captured_at desc);

alter table public.capture_numero_captures enable row level security;

drop policy if exists capture_numero_read   on public.capture_numero_captures;
drop policy if exists capture_numero_insert on public.capture_numero_captures;
drop policy if exists capture_numero_delete on public.capture_numero_captures;

create policy capture_numero_read   on public.capture_numero_captures for select using (true);
create policy capture_numero_insert on public.capture_numero_captures for insert with check (true);
create policy capture_numero_delete on public.capture_numero_captures for delete using (true);

-- ── Vagas do evento: até 5 capturadores por evento (event_id, player), 1 slot cada ──
create table if not exists public.capture_numero_event (
  event_id      text not null,
  player        text not null,
  numero_value  integer,
  slot          integer,
  captured_at   timestamptz not null default now(),
  primary key (event_id, player)
);

-- No máximo 1 pessoa por slot, por evento.
create unique index if not exists capture_numero_event_slot_uidx
  on public.capture_numero_event (event_id, slot) where slot is not null;

alter table public.capture_numero_event enable row level security;

drop policy if exists capture_numero_event_read   on public.capture_numero_event;
drop policy if exists capture_numero_event_insert on public.capture_numero_event;
drop policy if exists capture_numero_event_delete on public.capture_numero_event;

create policy capture_numero_event_read   on public.capture_numero_event for select using (true);
create policy capture_numero_event_insert on public.capture_numero_event for insert with check (true);
create policy capture_numero_event_delete on public.capture_numero_event for delete using (true);

-- Função atômica: tenta ocupar o PRÓXIMO slot livre (1 a p_max_winners) pra esse
-- evento+jogador. Mesma lógica de supabase_capture_uniko_multi.sql (capture_uniko_try):
-- tenta slot por slot com INSERT direto — o índice único acima garante que só um
-- jogador ganha cada slot mesmo com duas tentativas simultâneas (unique_violation
-- no perdedor, que passa pro próximo slot).
drop function if exists public.capture_numero_try(text, text, integer, integer);

create or replace function public.capture_numero_try(
  p_event_id text, p_player text, p_numero_value integer, p_max_winners integer default 3
) returns table(ok boolean, already_mine boolean, is_full boolean) as $$
declare
  v_slot  integer;
  v_count integer;
  v_max   integer := greatest(1, least(coalesce(p_max_winners, 3), 5));
begin
  if exists (select 1 from public.capture_numero_event where event_id = p_event_id and player = p_player) then
    return query select false, true, false;
    return;
  end if;

  select count(*) into v_count from public.capture_numero_event where event_id = p_event_id;
  if v_count >= v_max then
    return query select false, false, true;
    return;
  end if;

  for v_slot in 1..v_max loop
    begin
      insert into public.capture_numero_event (event_id, player, numero_value, slot, captured_at)
      values (p_event_id, p_player, p_numero_value, v_slot, now());
      return query select true, false, false;
      return;
    exception when unique_violation then
      continue; -- esse slot foi pego por outra pessoa nesse exato instante — tenta o próximo
    end;
  end loop;

  -- todos os slots foram preenchidos entre a checagem do count e a tentativa (corrida rara)
  return query select false, false, true;
end;
$$ language plpgsql;

grant execute on function public.capture_numero_try(text, text, integer, integer) to anon, authenticated;

-- ── Realtime (mesmo padrão de supabase_capture_uniko_realtime.sql) — o "Spawnar
--    agora" e a captura por outra pessoa propagam ~na hora pra todo mundo. ──
alter table public.capture_numero_event replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- `settings` provavelmente já foi adicionada pelo supabase_capture_uniko_realtime.sql;
  -- a checagem abaixo cobre os dois casos (já adicionada ou não) sem duplicar.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'capture_numero_event'
  ) then
    alter publication supabase_realtime add table public.capture_numero_event;
  end if;
end $$;

-- Conferência — deve retornar as linhas de settings e capture_numero_event.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('settings', 'capture_numero_event')
order by tablename;
