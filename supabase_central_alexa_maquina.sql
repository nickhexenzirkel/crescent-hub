-- Estatísticas da Máquina do Tempo (Central Alexa) agregadas NO SERVIDOR.
-- Evita baixar milhares de linhas brutas da fila pro cliente — a agregação
-- por mês, por música, por artista e por DJ é feita no Postgres.
-- Rode no SQL Editor do Supabase.

-- ── View: plays por mês e por música (retrospectiva mensal) ──────────────
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
  and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'  -- Autoplay/sistema NÃO conta como play
group by 1, spotify_id;

-- ── View: plays por mês e por DJ (quem mais colocou música no mês) ───────
create or replace view public.maquina_monthly_djs as
select
  to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
  requested_by,
  count(*)::int as plays
from public.queue
where status in ('played','skipped')
  and requested_by is not null and trim(requested_by) <> ''
  and requested_by !~* '(autoplay|uniko|alexa|sistema)'  -- Autoplay/sistema NÃO conta
group by 1, requested_by;

-- ── Top músicas agregadas desde p_since (null = desde sempre) ────────────
-- Usada pela Visão Geral e pelo collage da Semaninha (qualquer período).
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
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'  -- Autoplay/sistema NÃO conta
  group by spotify_id
  order by plays desc
  limit p_limit;
$$;

-- ── Top artistas agregados (separa "A, B" em linhas) desde p_since ───────
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
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'  -- Autoplay/sistema NÃO conta
  group by trim(a)
  order by plays desc
  limit p_limit;
$$;

-- ── Ranking de quem mais coloca música desde p_since ─────────────────────
-- (a filtragem de nomes do sistema — autoplay/Uniko/Alexa — é feita no app)
create or replace function public.maquina_dj_stats(
  p_since timestamptz default null
)
returns table(requested_by text, plays int)
language sql stable as $$
  select requested_by, count(*)::int as plays
  from public.queue
  where status in ('played','skipped')
    and requested_by is not null and trim(requested_by) <> ''
    and requested_by !~* '(autoplay|uniko|alexa|sistema)'  -- Autoplay/sistema NÃO conta
    and (p_since is null or created_at >= p_since)
  group by requested_by
  order by plays desc;
$$;

-- ── Total de plays desde p_since (pra rótulos "N plays") ─────────────────
create or replace function public.maquina_play_count(
  p_since timestamptz default null
)
returns int
language sql stable as $$
  select count(*)::int
  from public.queue
  where status in ('played','skipped')
    and coalesce(requested_by,'') !~* '(autoplay|uniko|alexa|sistema)'  -- Autoplay/sistema NÃO conta
    and (p_since is null or created_at >= p_since);
$$;

-- ── Permissões (o app usa a chave anônima) ───────────────────────────────
grant select  on public.maquina_monthly_songs                          to anon, authenticated;
grant select  on public.maquina_monthly_djs                            to anon, authenticated;
grant execute on function public.maquina_song_stats(timestamptz,int)   to anon, authenticated;
grant execute on function public.maquina_artist_stats(timestamptz,int) to anon, authenticated;
grant execute on function public.maquina_dj_stats(timestamptz)         to anon, authenticated;
grant execute on function public.maquina_play_count(timestamptz)       to anon, authenticated;
