-- ═══════════════════════════════════════════════════════════════════════════
-- CORREÇÃO dos rankings do Uniko Stop! e Uniko Paint (rode no SQL Editor).
--
-- Dois problemas:
--   1. As tabelas de ranking nasceram SEM policy de DELETE, então nem o app nem
--      um admin conseguiam limpar — o RLS bloqueava tudo. Sem isso não dá pra
--      zerar o ranking nem apagar entrada de jogo bugado.
--   2. O ranking do Stop tinha uma entrada LIXO: um jogo de teste terminou com
--      só um jogador pontuando (efeito do bug do host, já corrigido no código),
--      e gravou "Rondiney 100" num jogo que na prática não valeu.
--
-- Este arquivo adiciona a policy de DELETE e ZERA os dois rankings, pra começar
-- limpo agora que o bug do host está corrigido. Rodar UMA vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- policy de DELETE nas duas tabelas de ranking
drop policy if exists uniko_stop_ranking_delete  on public.uniko_stop_ranking;
create policy uniko_stop_ranking_delete  on public.uniko_stop_ranking  for delete using (true);

drop policy if exists uniko_paint_ranking_delete on public.uniko_paint_ranking;
create policy uniko_paint_ranking_delete on public.uniko_paint_ranking for delete using (true);

-- começa limpo (o Stop tinha o "Rondiney 100" de um jogo bugado; o Paint já está
-- vazio, mas trunca por garantia)
truncate table public.uniko_stop_ranking;
truncate table public.uniko_paint_ranking;
