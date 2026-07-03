-- Máquina do Tempo — data do primeiro play do período atual (pra saber há quanto
-- tempo a Visão Geral vem acumulando dados desde o último "Zerar contador").
-- Rode no SQL Editor do Supabase (depois de supabase_central_alexa_maquina.sql
-- e supabase_central_alexa_maquina_horario.sql).

create or replace function public.maquina_period_start(
  p_since timestamptz default null
)
returns timestamptz
language sql stable as $$
  select min(created_at)
  from public.queue
  where status in ('played','skipped')
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'
    and (p_since is null or created_at >= p_since)
    and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18;
$$;

grant execute on function public.maquina_period_start(timestamptz) to anon, authenticated;
