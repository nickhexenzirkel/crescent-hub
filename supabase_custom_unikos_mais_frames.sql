-- Oficina de Uniko — 4 frames novos além dos 5 que já existiam (principal/notificação/
-- aviso/olhos fechados/capturar): Prisma Comum, Prisma Premium, Alexa e Uniko Wave —
-- os mesmos "humores" que o UNIKO clássico e o Vampire-Robot já têm frame próprio.
-- Rode no SQL Editor do Supabase (depois de supabase_custom_unikos.sql).

alter table public.custom_unikos add column if not exists img_prisma_comum   text;
alter table public.custom_unikos add column if not exists img_prisma_premium text;
alter table public.custom_unikos add column if not exists img_alexa         text;
alter table public.custom_unikos add column if not exists img_wave          text;
