-- Aumenta de 10 para 15 o limite de capturadores por evento no RPC.
-- Aplicar no SQL Editor do Supabase antes de configurar eventos com mais de
-- 10 vagas no Dashboard RH. Não cria nem inicia nenhum spawn.
create or replace function public.capture_uniko_try(
  p_event_id text, p_player text,
  p_uniko_ids text[], p_uniko_names text[], p_comums integer[], p_premiums integer[],
  p_max_winners integer default 3
) returns table(ok boolean, already_mine boolean, is_full boolean, uniko_id text, uniko_name text, comum integer, premium integer) as $$
declare
  v_slot  integer;
  v_count integer;
  v_max   integer := greatest(1, least(coalesce(p_max_winners, 3), 15));
  v_idx   integer;
  v_uid   text;
  v_uname text;
  v_com   integer;
  v_prem  integer;
begin
  if exists (select 1 from public.capture_uniko_event where event_id = p_event_id and player = p_player) then
    return query select false, true, false, null::text, null::text, null::integer, null::integer;
    return;
  end if;

  select count(*) into v_count from public.capture_uniko_event where event_id = p_event_id;
  if v_count >= v_max then
    return query select false, false, true, null::text, null::text, null::integer, null::integer;
    return;
  end if;

  for v_slot in 1..v_max loop
    begin
      v_idx   := least(v_slot, greatest(array_length(p_uniko_ids, 1), 1));
      v_uid   := p_uniko_ids[v_idx];
      v_uname := p_uniko_names[v_idx];
      v_com   := p_comums[v_idx];
      v_prem  := p_premiums[v_idx];
      insert into public.capture_uniko_event (event_id, player, uniko_id, uniko_name, comum, premium, slot, captured_at)
      values (p_event_id, p_player, v_uid, v_uname, v_com, v_prem, v_slot, now());
      return query select true, false, false, v_uid, v_uname, v_com, v_prem;
      return;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return query select false, false, true, null::text, null::text, null::integer, null::integer;
end;
$$ language plpgsql;

grant execute on function public.capture_uniko_try(text, text, text[], text[], integer[], integer[], integer) to anon, authenticated;
