-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — estilo GymRats: check-in de treino (foto), feed "Para Você"
--  (estilo TikTok), reações, comentários, chat do grupo e ranking por
--  frequência de treino. Módulo próprio no seletor de módulos (ao lado da
--  Prisma Store), liberado pra TODOS os colaboradores.
--  Ver src/modules/uniko-fit/index.jsx.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- Check-ins (posts com foto do treino)
create table if not exists public.uniko_fit_checkins (
  id          bigint generated always as identity primary key,
  player      text not null,
  photo_url   text not null,
  caption     text,
  created_at  timestamptz not null default now()
);
create index if not exists uniko_fit_checkins_created_idx on public.uniko_fit_checkins (created_at desc);
create index if not exists uniko_fit_checkins_player_idx  on public.uniko_fit_checkins (player);

-- Reações (1 por jogador por check-in — upsert troca, clicar de novo no mesmo remove)
create table if not exists public.uniko_fit_reactions (
  id          bigint generated always as identity primary key,
  checkin_id  bigint not null references public.uniko_fit_checkins(id) on delete cascade,
  player      text not null,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (checkin_id, player)
);
create index if not exists uniko_fit_reactions_checkin_idx on public.uniko_fit_reactions (checkin_id);

-- Comentários por check-in
create table if not exists public.uniko_fit_comments (
  id          bigint generated always as identity primary key,
  checkin_id  bigint not null references public.uniko_fit_checkins(id) on delete cascade,
  player      text not null,
  texto       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists uniko_fit_comments_checkin_idx on public.uniko_fit_comments (checkin_id, created_at);

-- Chat do grupo (bate-papo geral, pra combinar treinos)
create table if not exists public.uniko_fit_chat (
  id          bigint generated always as identity primary key,
  player      text not null,
  texto       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists uniko_fit_chat_created_idx on public.uniko_fit_chat (created_at);

-- RLS — chave anônima, políticas permissivas (mesmo padrão dos outros módulos sociais)
alter table public.uniko_fit_checkins  enable row level security;
alter table public.uniko_fit_reactions enable row level security;
alter table public.uniko_fit_comments  enable row level security;
alter table public.uniko_fit_chat      enable row level security;

drop policy if exists uniko_fit_checkins_read    on public.uniko_fit_checkins;
drop policy if exists uniko_fit_checkins_insert  on public.uniko_fit_checkins;
drop policy if exists uniko_fit_checkins_delete  on public.uniko_fit_checkins;
create policy uniko_fit_checkins_read   on public.uniko_fit_checkins for select using (true);
create policy uniko_fit_checkins_insert on public.uniko_fit_checkins for insert with check (true);
create policy uniko_fit_checkins_delete on public.uniko_fit_checkins for delete using (true);

drop policy if exists uniko_fit_reactions_read   on public.uniko_fit_reactions;
drop policy if exists uniko_fit_reactions_insert on public.uniko_fit_reactions;
drop policy if exists uniko_fit_reactions_update on public.uniko_fit_reactions;
drop policy if exists uniko_fit_reactions_delete on public.uniko_fit_reactions;
create policy uniko_fit_reactions_read   on public.uniko_fit_reactions for select using (true);
create policy uniko_fit_reactions_insert on public.uniko_fit_reactions for insert with check (true);
create policy uniko_fit_reactions_update on public.uniko_fit_reactions for update using (true) with check (true);
create policy uniko_fit_reactions_delete on public.uniko_fit_reactions for delete using (true);

drop policy if exists uniko_fit_comments_read   on public.uniko_fit_comments;
drop policy if exists uniko_fit_comments_insert on public.uniko_fit_comments;
create policy uniko_fit_comments_read   on public.uniko_fit_comments for select using (true);
create policy uniko_fit_comments_insert on public.uniko_fit_comments for insert with check (true);

drop policy if exists uniko_fit_chat_read   on public.uniko_fit_chat;
drop policy if exists uniko_fit_chat_insert on public.uniko_fit_chat;
create policy uniko_fit_chat_read   on public.uniko_fit_chat for select using (true);
create policy uniko_fit_chat_insert on public.uniko_fit_chat for insert with check (true);

-- Bucket de fotos dos check-ins (público)
insert into storage.buckets (id, name, public)
  values ('uniko-fit-fotos', 'uniko-fit-fotos', true)
  on conflict (id) do nothing;

drop policy if exists "uniko fit fotos read"   on storage.objects;
drop policy if exists "uniko fit fotos insert" on storage.objects;
create policy "uniko fit fotos read"   on storage.objects for select using (bucket_id = 'uniko-fit-fotos');
create policy "uniko fit fotos insert" on storage.objects for insert with check (bucket_id = 'uniko-fit-fotos');

-- Realtime: feed, reações, comentários e chat chegam ~na hora pra todo mundo.
alter table public.uniko_fit_checkins  replica identity full;
alter table public.uniko_fit_reactions replica identity full;
alter table public.uniko_fit_comments  replica identity full;
alter table public.uniko_fit_chat      replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='uniko_fit_checkins') then
    alter publication supabase_realtime add table public.uniko_fit_checkins;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='uniko_fit_reactions') then
    alter publication supabase_realtime add table public.uniko_fit_reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='uniko_fit_comments') then
    alter publication supabase_realtime add table public.uniko_fit_comments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='uniko_fit_chat') then
    alter publication supabase_realtime add table public.uniko_fit_chat;
  end if;
end $$;
