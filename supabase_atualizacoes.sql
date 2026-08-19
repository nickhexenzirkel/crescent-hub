-- ════════════════════════════════════════════════════════════════════════
--  ATUALIZAÇÕES — mural de novidades emitido pelo Dashboard RH (Admin/Moderador).
--  Ao "Emitir atualização", uma linha entra aqui; TODOS os computadores logados
--  recebem em tempo real e mostram a moldura "ATUALIZAÇÕES" em tela cheia, com
--  som e notificação no desktop (ver src/App.jsx + src/shared/atualizacao.jsx).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.atualizacoes (
  id          bigint generated always as identity primary key,
  titulo      text not null,
  descricao   text,
  autor       text,                                  -- quem emitiu (nome do RH)
  active      boolean not null default true,          -- desativar = some do mural/reenvio
  created_at  timestamptz not null default now()
);

create index if not exists atualizacoes_created_idx on public.atualizacoes (created_at desc);

alter table public.atualizacoes enable row level security;

-- App usa a chave anônima → políticas permissivas (o gate de "quem emite" é no app:
-- a aba só aparece pra Admin/Moderador). Leitura pública p/ o overlay chegar a todos.
drop policy if exists atualizacoes_read   on public.atualizacoes;
drop policy if exists atualizacoes_insert on public.atualizacoes;
drop policy if exists atualizacoes_update on public.atualizacoes;
drop policy if exists atualizacoes_delete on public.atualizacoes;

create policy atualizacoes_read   on public.atualizacoes for select using (true);
create policy atualizacoes_insert on public.atualizacoes for insert with check (true);
create policy atualizacoes_update on public.atualizacoes for update using (true) with check (true);
create policy atualizacoes_delete on public.atualizacoes for delete using (true);

-- Realtime: entrega o INSERT ~instantâneo a todos (o app tem poll de fallback).
alter table public.atualizacoes replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'atualizacoes'
  ) then
    alter publication supabase_realtime add table public.atualizacoes;
  end if;
end $$;
