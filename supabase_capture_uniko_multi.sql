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

-- Assinaturas antigas — remove pra evitar overload duplicado quando recriar a
-- função abaixo com os parâmetros novos.
drop function if exists public.capture_uniko_try(text, text, text, text, integer, integer);
drop function if exists public.capture_uniko_try(text, text, text, text, integer, integer, integer);
drop function if exists public.capture_uniko_try(text, text, text[], text[], integer[], integer[], integer);

-- Função atômica: tenta ocupar o PRÓXIMO slot livre (1 a p_max_winners) pra esse
-- evento+jogador. Tenta slot por slot com INSERT direto — se dois jogadores
-- tentarem o MESMO slot ao mesmo tempo, o índice único acima garante que só
-- um consegue (unique_violation no outro, que passa pro próximo slot). Isso
-- evita a corrida de "N+1 pessoas capturando ao mesmo tempo" sem precisar de
-- lock explícito. p_max_winners vem do maxWinners configurado no evento
-- (travado entre 1 e 5 aqui também, por segurança, mesmo que o cliente já trave).
--
-- p_uniko_ids/p_uniko_names/p_comums/p_premiums (ago/2026, corrige bug): recebe
-- a lista INTEIRA de Unikos possíveis (um por vaga, `cfg.slotUnikoIds`) em vez
-- de um Uniko já escolhido pelo cliente. Antes, no modo "Uniko aleatório por
-- vaga", cada navegador ADIVINHAVA qual Uniko lhe cabia a partir de quantos
-- vencedores ele via localmente (`winners.length`, defasado por
-- realtime/poll) — duas capturas quase simultâneas apostavam na mesma vaga e
-- mandavam pro servidor o MESMO Uniko (e a mesma recompensa), mesmo a função
-- aqui atribuindo corretamente vagas DIFERENTES pra cada uma (o índice do
-- array nunca era conferido contra a vaga real — mesma causa do bug já
-- corrigido em capture_numero_try, ver supabase_capture_numero.sql). Agora
-- quem decide o Uniko (e a recompensa) é o próprio INSERT atômico: pega
-- p_uniko_ids[vaga_conquistada] e os arrays paralelos correspondentes.
create or replace function public.capture_uniko_try(
  p_event_id text, p_player text,
  p_uniko_ids text[], p_uniko_names text[], p_comums integer[], p_premiums integer[],
  p_max_winners integer default 3
) returns table(ok boolean, already_mine boolean, is_full boolean, uniko_id text, uniko_name text, comum integer, premium integer) as $$
declare
  v_slot  integer;
  v_count integer;
  v_max   integer := greatest(1, least(coalesce(p_max_winners, 3), 5));
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
      -- arrays mais curtos que v_max em configs antigas travam no último valor
      -- disponível em vez de estourar o array.
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
      continue; -- esse slot foi pego por outra pessoa nesse exato instante — tenta o próximo
    end;
  end loop;

  -- todos os slots foram preenchidos entre a checagem do count e a tentativa (corrida rara)
  return query select false, false, true, null::text, null::text, null::integer, null::integer;
end;
$$ language plpgsql;

grant execute on function public.capture_uniko_try(text, text, text[], text[], integer[], integer[], integer) to anon, authenticated;
