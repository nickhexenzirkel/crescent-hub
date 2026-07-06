-- "Loja de Unikos" — preço (em Prisma Comum) que o admin define pra cada Uniko (do roster
-- fixo ou da Oficina de Uniko) poder ser COMPRADO na Prisma Store, além de capturado no evento.
-- Sem linha aqui (ou price nulo/0) = Uniko não está à venda.
-- Rode no SQL Editor do Supabase.

create table if not exists public.uniko_store_prices (
  uniko_id   text primary key,
  price      integer,
  updated_at timestamptz not null default now()
);

alter table public.uniko_store_prices enable row level security;

drop policy if exists uniko_store_prices_read   on public.uniko_store_prices;
drop policy if exists uniko_store_prices_upsert on public.uniko_store_prices;
drop policy if exists uniko_store_prices_delete on public.uniko_store_prices;

create policy uniko_store_prices_read   on public.uniko_store_prices for select using (true);
create policy uniko_store_prices_upsert on public.uniko_store_prices for insert with check (true);
create policy uniko_store_prices_update on public.uniko_store_prices for update using (true);
create policy uniko_store_prices_delete on public.uniko_store_prices for delete using (true);
