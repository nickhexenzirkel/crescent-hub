-- ════════════════════════════════════════════════════════════════════
-- PRISMA STORE — estorno de compra pelo admin (set/2026).
--
-- Nova aba "Compras da loja" (Dashboard → Prisma Store → Administrador)
-- lista todo mundo que comprou algo e deixa o admin ESTORNAR uma compra
-- específica: devolve o valor pra carteira da pessoa, tira o prêmio da
-- coleção dela (e, se for Uniko, revoga a posse também) e repõe 1
-- unidade no estoque do item.
--
-- Pra isso funcionar com precisão (sem depender de reler o NOME do
-- prêmio de dentro do texto salvo em `descr`, que pode ter mudado ou
-- sido removido do catálogo depois), cada linha de compra em
-- `mercado_history` passa a guardar o ID do item comprado. E cada linha
-- ganha uma marca de "já estornada", pra não dar pra estornar 2x.
-- ════════════════════════════════════════════════════════════════════

alter table public.mercado_history add column if not exists item_id text;
alter table public.mercado_history add column if not exists refunded_at timestamptz;

-- Devolve 1 unidade ao estoque (usada no estorno) — sempre soma, sem
-- checagem de corrida (diferente de mercado_buy_stock, que só baixa se
-- stock>0): aqui não tem concorrência, é uma ação manual única do admin.
create or replace function public.mercado_refund_stock(p_item_id text)
returns int -- novo estoque, ou NULL se o item não existe mais no catálogo (ok, só não repõe)
language plpgsql
security definer
set search_path = public
as $$
declare v_new int;
begin
  update public.mercado_items set stock = stock + 1 where id = p_item_id returning stock into v_new;
  return v_new;
end;
$$;

grant execute on function public.mercado_refund_stock(text) to anon, authenticated;
