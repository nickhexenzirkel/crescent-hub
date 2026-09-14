-- ════════════════════════════════════════════════════════════════════
-- PRISMA STORE — baixa de estoque ATÔMICA na hora de resgatar (set/2026).
--
-- BUG relatado: um prêmio com estoque 2 (ex.: "PIX de R$ 200") foi
-- resgatado por 3 pessoas. Causa: a checagem de estoque no `buyItem`
-- (mercado-estelar/index.jsx) olhava só o `item.stock` da CÓPIA LOCAL
-- em memória de cada cliente, e a baixa era feita subtraindo 1 nessa
-- cópia e reenviando o CATÁLOGO INTEIRO pro Supabase (upsert de
-- `state.items`) num efeito com debounce de 400ms — nunca existiu uma
-- checagem no BANCO na hora do clique. Se duas ou mais pessoas
-- clicassem "resgatar" no mesmo item quase ao mesmo tempo (cada uma
-- vendo estoque=2 na sua própria tela), as duas passavam na checagem
-- local, as duas debitavam a carteira e entravam na coleção — o
-- estoque nunca chegava a bloquear ninguém depois da primeira pessoa
-- que carregou a página. Mesma classe de corrida que o Capture o Uniko/
-- Número já resolvia com RPC atômica (ver supabase_capture_uniko_multi.sql).
--
-- FIX: uma função no banco que só decrementa `stock` se `stock > 0`,
-- num único UPDATE — o Postgres serializa updates concorrentes na MESMA
-- linha, então só o número exato de compradores que cabe no estoque
-- consegue um `stock` de volta; o restante recebe NULL (esgotado) e a
-- compra é cancelada no client ANTES de debitar carteira ou entregar
-- o item. Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.mercado_buy_stock(p_item_id text)
returns int -- novo estoque (>=0) se conseguiu baixar; NULL se esgotado ou item não existe
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new int;
begin
  update public.mercado_items
    set stock = stock - 1
    where id = p_item_id and stock > 0
    returning stock into v_new;
  return v_new; -- v_new fica NULL quando o WHERE não bate (esgotado)
end;
$$;

grant execute on function public.mercado_buy_stock(text) to anon, authenticated;
