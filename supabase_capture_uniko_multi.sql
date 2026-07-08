-- "Capture o Uniko" — permite ATÉ 5 capturas por evento (antes era só 1: quem
-- capturava primeiro "trancava" o evento pra todo mundo). Agora as 5 primeiras
-- pessoas que conseguirem capturar ganham; a 6ª tentativa em diante encontra o
-- evento já esgotado. Rode no SQL Editor do Supabase.

-- Cada capturador ocupa um "slot" (1 a 5) dentro do mesmo evento.
alter table public.capture_uniko_event add column if not exists slot integer;

-- Troca a chave: antes só event_id (por isso só 1 linha por evento). Agora
-- composta (event_id, player) — permite até 5 jogadores DIFERENTES por
-- evento, cada um só uma vez (não dá pra capturar 2x o mesmo evento).
alter table public.capture_uniko_event drop constraint if exists capture_uniko_event_pkey;
alter table public.capture_uniko_event add constraint capture_uniko_event_pkey primary key (event_id, player);

-- No máximo 1 pessoa por slot, por evento — é isso que trava em 5 no total.
create unique index if not exists capture_uniko_event_slot_uidx
  on public.capture_uniko_event (event_id, slot) where slot is not null;

-- Função atômica: tenta ocupar o PRÓXIMO slot livre (1 a 5) pra esse
-- evento+jogador. Tenta slot por slot com INSERT direto — se dois jogadores
-- tentarem o MESMO slot ao mesmo tempo, o índice único acima garante que só
-- um consegue (unique_violation no outro, que passa pro próximo slot). Isso
-- evita a corrida de "6 pessoas capturando ao mesmo tempo" sem precisar de
-- lock explícito.
create or replace function public.capture_uniko_try(
  p_event_id text, p_player text, p_uniko_id text, p_uniko_name text,
  p_comum integer, p_premium integer
) returns table(ok boolean, already_mine boolean, is_full boolean) as $$
declare
  v_slot  integer;
  v_count integer;
begin
  if exists (select 1 from public.capture_uniko_event where event_id = p_event_id and player = p_player) then
    return query select false, true, false;
    return;
  end if;

  select count(*) into v_count from public.capture_uniko_event where event_id = p_event_id;
  if v_count >= 5 then
    return query select false, false, true;
    return;
  end if;

  for v_slot in 1..5 loop
    begin
      insert into public.capture_uniko_event (event_id, player, uniko_id, uniko_name, comum, premium, slot, captured_at)
      values (p_event_id, p_player, p_uniko_id, p_uniko_name, p_comum, p_premium, v_slot, now());
      return query select true, false, false;
      return;
    exception when unique_violation then
      continue; -- esse slot foi pego por outra pessoa nesse exato instante — tenta o próximo
    end;
  end loop;

  -- todos os 5 slots foram preenchidos entre a checagem do count e a tentativa (corrida rara)
  return query select false, false, true;
end;
$$ language plpgsql;

grant execute on function public.capture_uniko_try(text, text, text, text, integer, integer) to anon, authenticated;
