-- Oficina de Uniko — permite ajustar o tamanho do assistente (ícone flutuante/mascote) de
-- cada Uniko personalizado, além de editar nome/tagline/cor/recompensa de um já criado.
-- Rode no SQL Editor do Supabase (depois de supabase_custom_unikos.sql).

alter table public.custom_unikos add column if not exists icon_size integer not null default 84;

-- A migração original só tinha políticas de select/insert/delete — EDITAR (upsert) precisa
-- de uma política de UPDATE, senão o Postgres bloqueia com "violates row-level security
-- policy (USING expression)" ao tentar atualizar uma linha já existente.
drop policy if exists custom_unikos_update on public.custom_unikos;
create policy custom_unikos_update on public.custom_unikos for update using (true) with check (true);
