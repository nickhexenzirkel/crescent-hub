-- Máquina do Tempo — não conta stream/play de ADMINISTRADORES nas estatísticas
-- (músicas mais tocadas, artistas, ranking de quem mais coloca música, contador total).
-- Pedido: administradores (ex.: Nicolas Andrade Barboza) não devem aparecer nem
-- influenciar os números — só streams de colaboradores comuns contam.
--
-- AUTOSSUFICIENTE: inclui de novo a função maquina_horario_valido (originalmente de
-- supabase_central_alexa_maquina_horario_comercial.sql) — descobrimos que aquela
-- migração nunca tinha sido rodada nesse banco (dava "function does not exist"), então
-- este arquivo já recria ela também, além de não contar admin. Só precisa rodar ESTE
-- arquivo (depois de supabase_central_alexa_maquina.sql, que cria as views/funções base
-- pela 1ª vez) — não depende mais de _horario.sql/_horario_comercial.sql/_periodo.sql
-- terem sido rodados antes; se já tiverem sido, `create or replace` não quebra nada.
-- Rode no SQL Editor do Supabase.

-- Helper: true se o instante cai dentro do "horário comercial" contado pela Máquina do
-- Tempo (seg-sex, 08:00–12:00 e 13:00–17:00, horário de Brasília — sem DST desde 2019).
create or replace function public.maquina_horario_valido(ts timestamptz)
returns boolean
language sql immutable as $$
  select
    extract(dow from ts at time zone 'America/Sao_Paulo') between 1 and 5
    and (
      extract(hour from ts at time zone 'America/Sao_Paulo') between 8 and 11
      or extract(hour from ts at time zone 'America/Sao_Paulo') between 13 and 16
    );
$$;

-- Helper: true se `requested_by` corresponde a um admin em public.employees. Centraliza
-- a regra num lugar só (mesmo espírito do maquina_horario_valido) — nome null/vazio
-- (ex.: faixa tocada sem pedido de ninguém) nunca é admin, então não é excluído por isso.
create or replace function public.maquina_requester_is_admin(p_name text)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.employees
    where name = p_name and role = 'admin'
  );
$$;

create or replace view public.maquina_monthly_songs as
select
  to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
  spotify_id,
  max(title)     as title,
  max(artist)    as artist,
  max(album_art) as album_art,
  count(*)::int  as plays
from public.queue
where status in ('played','skipped') and spotify_id is not null
  and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'
  and public.maquina_horario_valido(created_at)
  and not public.maquina_requester_is_admin(requested_by)
group by 1, spotify_id;

create or replace view public.maquina_monthly_djs as
select
  to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
  requested_by,
  count(*)::int as plays
from public.queue
where status in ('played','skipped')
  and requested_by is not null and trim(requested_by) <> ''
  and requested_by !~* '(autoplay|uniko|alexa|sistema)'
  and public.maquina_horario_valido(created_at)
  and not public.maquina_requester_is_admin(requested_by)
group by 1, requested_by;

create or replace function public.maquina_song_stats(
  p_since timestamptz default null,
  p_limit int default 2000
)
returns table(spotify_id text, title text, artist text, album_art text, plays int)
language sql stable as $$
  select spotify_id, max(title), max(artist), max(album_art), count(*)::int as plays
  from public.queue
  where status in ('played','skipped') and spotify_id is not null
    and (p_since is null or created_at >= p_since)
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'
    and public.maquina_horario_valido(created_at)
    and not public.maquina_requester_is_admin(requested_by)
  group by spotify_id
  order by plays desc
  limit p_limit;
$$;

create or replace function public.maquina_artist_stats(
  p_since timestamptz default null,
  p_limit int default 50
)
returns table(artist text, plays int)
language sql stable as $$
  select trim(a) as artist, count(*)::int as plays
  from public.queue
       cross join lateral unnest(string_to_array(artist, ', ')) as a
  where status in ('played','skipped')
    and (p_since is null or created_at >= p_since)
    and trim(a) <> ''
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'
    and public.maquina_horario_valido(created_at)
    and not public.maquina_requester_is_admin(requested_by)
  group by trim(a)
  order by plays desc
  limit p_limit;
$$;

create or replace function public.maquina_dj_stats(
  p_since timestamptz default null
)
returns table(requested_by text, plays int)
language sql stable as $$
  select requested_by, count(*)::int as plays
  from public.queue
  where status in ('played','skipped')
    and requested_by is not null and trim(requested_by) <> ''
    and requested_by !~* '(autoplay|uniko|alexa|sistema)'
    and (p_since is null or created_at >= p_since)
    and public.maquina_horario_valido(created_at)
    and not public.maquina_requester_is_admin(requested_by)
  group by requested_by
  order by plays desc;
$$;

create or replace function public.maquina_play_count(
  p_since timestamptz default null
)
returns int
language sql stable as $$
  select count(*)::int
  from public.queue
  where status in ('played','skipped')
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'
    and (p_since is null or created_at >= p_since)
    and public.maquina_horario_valido(created_at)
    and not public.maquina_requester_is_admin(requested_by);
$$;

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
    and public.maquina_horario_valido(created_at)
    and not public.maquina_requester_is_admin(requested_by);
$$;

grant execute on function public.maquina_horario_valido(timestamptz)    to anon, authenticated;
grant execute on function public.maquina_requester_is_admin(text)       to anon, authenticated;
grant select  on public.maquina_monthly_songs                          to anon, authenticated;
grant select  on public.maquina_monthly_djs                            to anon, authenticated;
grant execute on function public.maquina_song_stats(timestamptz,int)   to anon, authenticated;
grant execute on function public.maquina_artist_stats(timestamptz,int) to anon, authenticated;
grant execute on function public.maquina_dj_stats(timestamptz)         to anon, authenticated;
grant execute on function public.maquina_play_count(timestamptz)       to anon, authenticated;
grant execute on function public.maquina_period_start(timestamptz)     to anon, authenticated;
