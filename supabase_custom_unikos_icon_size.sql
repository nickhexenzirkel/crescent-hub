-- Oficina de Uniko — permite ajustar o tamanho do assistente (ícone flutuante/mascote) de
-- cada Uniko personalizado, além de editar nome/tagline/cor/recompensa de um já criado.
-- Rode no SQL Editor do Supabase (depois de supabase_custom_unikos.sql).

alter table public.custom_unikos add column if not exists icon_size integer not null default 84;
