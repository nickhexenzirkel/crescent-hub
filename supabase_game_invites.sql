-- ════════════════════════════════════════════════════════════════════════
--  CONVITES DE JOGO — "vem jogar Uniko Paint/Stop!". Um colaborador convida um
--  colega (ou todos) direto do lobby/sala do jogo; o convidado recebe uma
--  notificação in-site + no desktop e, ao aceitar, é levado direto pro jogo (e
--  entra na sala, se o convite trouxe uma). Ver src/shared/gameInvites.js.
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.game_invites (
  id          bigint generated always as identity primary key,
  from_name   text not null,                 -- quem convidou
  from_photo  text,                           -- URL da arte do Uniko de quem convidou (leve)
  to_name     text not null,                  -- quem recebe (nome do colaborador)
  game        text not null,                  -- 'paint' | 'stop'
  room_id     text,                           -- sala pra entrar direto (null = só abre o jogo)
  room_name   text,
  created_at  timestamptz not null default now()
);

create index if not exists game_invites_to_idx on public.game_invites (to_name, created_at desc);

alter table public.game_invites enable row level security;

-- App usa a chave anônima → políticas permissivas (leitura/gravação públicas).
drop policy if exists game_invites_read   on public.game_invites;
drop policy if exists game_invites_insert on public.game_invites;
drop policy if exists game_invites_delete on public.game_invites;

create policy game_invites_read   on public.game_invites for select using (true);
create policy game_invites_insert on public.game_invites for insert with check (true);
create policy game_invites_delete on public.game_invites for delete using (true);

-- Realtime: entrega o INSERT ~instantâneo pro convidado.
alter table public.game_invites replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_invites'
  ) then
    alter publication supabase_realtime add table public.game_invites;
  end if;
end $$;
