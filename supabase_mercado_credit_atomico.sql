-- ════════════════════════════════════════════════════════════════════
-- PRISMA STORE — crédito atômico de prismas (jul/2026).
--
-- BUG: comum/premium eram salvos com um "select o estado inteiro, soma
-- na memória, regrava o estado inteiro de volta" — tanto no client
-- (Prisma Store: check-in, missão, compra, enviar, trocar) quanto em
-- vários pontos separados (Capture o Uniko `awardPrismas`, presente do
-- RH `giftUnikoToPlayer`, transferência/zerar do Admin). Se dois desses
-- caminhos gravassem perto um do outro (ex.: colaborador capturando um
-- Uniko enquanto tinha a Prisma Store aberta), o que gravasse por
-- último APAGAVA tudo que o outro tinha acabado de mudar — não só o
-- saldo, o ESTADO INTEIRO (checkins, missões resgatadas, etc.), porque
-- cada lado regravava o objeto `data` inteiro por cima. Foi assim que
-- o check-in de um colaborador "voltou pro dia 1" e missões de resgate
-- único (Primeira/Segunda compra, Colecionador) puderam ser resgatadas
-- de novo — o snapshot regravado por cima era mais antigo que o real.
--
-- FIX: uma função no banco que incrementa comum/premium de forma
-- ATÔMICA (um único UPDATE, sem select-e-regravar do lado do client) —
-- nunca mais precisa reescrever o resto do `data` (checkins/missões/
-- coleção) só pra creditar prisma, então não tem mais como um crédito
-- apagar o outro. Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.mercado_credit(p_player text, p_comum int default 0, p_premium int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mercado_state (player, data, updated_at)
  values (
    p_player,
    jsonb_build_object(
      'comum', greatest(0, p_comum),
      'premium', greatest(0, p_premium),
      'updatedAt', (extract(epoch from now()) * 1000)::bigint
    ),
    now()
  )
  on conflict (player) do update set
    data = jsonb_set(
             jsonb_set(
               coalesce(mercado_state.data, '{}'::jsonb),
               '{comum}',
               to_jsonb(greatest(0, coalesce((mercado_state.data->>'comum')::numeric, 0)::int + p_comum))
             ),
             '{premium}',
             to_jsonb(greatest(0, coalesce((mercado_state.data->>'premium')::numeric, 0)::int + p_premium))
           ) || jsonb_build_object('updatedAt', (extract(epoch from now()) * 1000)::bigint),
    updated_at = now();
end;
$$;

grant execute on function public.mercado_credit(text, int, int) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────
-- Save do "resto" do estado (check-ins, missões, coleção, catálogo de
-- prisma resgatado, etc.) — SEM NUNCA TOCAR em comum/premium. O client
-- ainda regrava esse pedaço inteiro a cada mudança (debounce de 400ms),
-- mas agora via MERGE no banco (`data || p_patch`, operador jsonb) em
-- vez de substituir a coluna inteira — como `p_patch` nunca contém
-- comum/premium, o merge simplesmente NÃO MEXE nessas chaves, não
-- importa quantos créditos atômicos (mercado_credit) tenham acontecido
-- no meio do caminho. É isso que fecha a corrida de vez.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.mercado_patch_state(p_player text, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mercado_state (player, data, updated_at)
  values (p_player, p_patch, now())
  on conflict (player) do update set
    data = coalesce(mercado_state.data, '{}'::jsonb) || p_patch,
    updated_at = now();
end;
$$;

grant execute on function public.mercado_patch_state(text, jsonb) to anon, authenticated;
