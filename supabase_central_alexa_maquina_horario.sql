-- Máquina do Tempo — NÃO conta streams/plays depois das 18h (horário de Brasília).
-- Atualiza as views/RPCs de supabase_central_alexa_maquina.sql com esse corte de horário.
-- Rode no SQL Editor do Supabase (depois de supabase_central_alexa_maquina.sql).

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
  and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18
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
  and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18
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
    and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18
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
    and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18
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
    and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18
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
    and extract(hour from created_at at time zone 'America/Sao_Paulo') < 18;
$$;

grant select on public.maquina_monthly_songs to anon, authenticated;
grant select on public.maquina_monthly_djs   to anon, authenticated;
