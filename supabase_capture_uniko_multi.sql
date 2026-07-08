-- "Capture o Uniko" — permite MÚLTIPLAS capturas por evento (antes era só 1: quem
-- capturava primeiro "trancava" o evento pra todo mundo). O número de vagas agora é
-- CONFIGURÁVEL pelo admin no Dashboard RH (1 a 5, campo "Vagas" — padrão 3 se não
-- definido) via o parâmetro p_max_winners. As N primeiras pessoas que conseguirem
-- capturar ganham; a próxima tentativa em diante encontra o evento já esgotado.
-- Rode no SQL Editor do Supabase (seguro rodar de novo, mesmo se já rodou versões
-- anteriores desse arquivo).

-- Cada capturador ocupa um "slot" (1 a 5) dentro do mesmo evento.
alter table public.capture_uniko_event add column if not exists slot integer;

-- Troca a chave: antes só event_id (por isso só 1 linha por evento). Agora
-- composta (event_id, player) — permite até 5 jogadores DIFERENTES por
-- evento, cada um só uma vez (não dá pra capturar 2x o mesmo evento).
alter table public.capture_uniko_event drop constraint if exists capture_uniko_event_pkey;
alter table public.capture_uniko_event add constraint capture_uniko_event_pkey primary key (event_id, player);

-- No máximo 1 pessoa por slot, por evento.
create unique index if not exists capture_uniko_event_slot_uidx
  on public.capture_uniko_event (event_id, slot) where slot is not null;

-- Assinatura antiga (sem p_max_winners) — remove pra evitar overload duplicado
-- quando recriar a função abaixo com o parâmetro novo.
drop function if exists public.capture_uniko_try(text, text, text, text, integer, integer);

-- Função atômica: tenta ocupar o PRÓXIMO slot livre (1 a p_max_winners) pra esse
-- evento+jogador. Tenta slot por slot com INSERT direto — se dois jogadores
-- tentarem o MESMO slot ao mesmo tempo, o índice único acima garante que só
-- um consegue (unique_violation no outro, que passa pro próximo slot). Isso
-- evita a corrida de "N+1 pessoas capturando ao mesmo tempo" sem precisar de
-- lock explícito. p_max_winners vem do maxWinners configurado no evento
-- (travado entre 1 e 5 aqui também, por segurança, mesmo que o cliente já trave).
create or replace function public.capture_uniko_try(
  p_event_id text, p_player text, p_uniko_id text, p_uniko_name text,
  p_comum integer, p_premium integer, p_max_winners integer default 3
) returns table(ok boolean, already_mine boolean, is_full boolean) as $$
declare
  v_slot  integer;
  v_count integer;
  v_max   integer := greatest(1, least(coalesce(p_max_winners, 3), 5));
begin
  if exists (select 1 from public.capture_uniko_event where event_id = p_event_id and player = p_player) then
    return query select false, true, false;
    return;
  end if;

  select count(*) into v_count from public.capture_uniko_event where event_id = p_event_id;
  if v_count >= v_max then
    return query select false, false, true;
    return;
  end if;

  for v_slot in 1..v_max loop
    begin
      insert into public.capture_uniko_event (event_id, player, uniko_id, uniko_name, comum, premium, slot, captured_at)
      values (p_event_id, p_player, p_uniko_id, p_uniko_name, p_comum, p_premium, v_slot, now());
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

grant execute on function public.capture_uniko_try(text, text, text, text, integer, integer, integer) to anon, authenticated;
