-- Permite que um item do catálogo da Prisma Store (mercado_items) REPRESENTE um Uniko
-- em vez de um prêmio físico — a Loja passa a ter Unikos misturados na MESMA lista dos
-- outros prêmios (não numa seção separada), e o admin reordena tudo junto (usa a coluna
-- `sort` que já existia). Rode no SQL Editor do Supabase.
--
-- Substitui a ideia da tabela `uniko_store_prices` (se você rodou aquele SQL antes,
-- pode deixar — ela só fica sem uso, não atrapalha nada).

alter table public.mercado_items add column if not exists uniko_id text;
