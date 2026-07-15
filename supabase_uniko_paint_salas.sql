-- ═══════════════════════════════════════════════════════════════════════════
-- UNIKO PAINT — múltiplas salas (rode DEPOIS de supabase_uniko_paint.sql).
--
-- O schema original já aguentava várias salas (o `id` vira o código da sala),
-- mas faltavam duas coisas:
--   1. Policy de DELETE — salas vazias precisam ser faxinadas pelo app.
--   2. Índice por updated_at — o lobby lista as salas por atividade.
--
-- A linha id='global' continua existindo e vira a "Sala Geral": fixa, sempre
-- disponível no lobby e nunca apagada (assim nunca existe lobby vazio).
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists uniko_paint_state_delete on public.uniko_paint_state;
create policy uniko_paint_state_delete on public.uniko_paint_state for delete using (true);

create index if not exists uniko_paint_state_updated_idx
  on public.uniko_paint_state (updated_at desc);

-- Garante a Sala Geral.
insert into public.uniko_paint_state (id, state)
values ('global', '{"phase":"lobby","round":0,"scores":{},"nome":"Sala Geral","themeId":"geral"}'::jsonb)
on conflict (id) do nothing;

-- A linha 'global' já existia desde a migração anterior, criada SEM `nome` e
-- SEM `themeId` — e o `do nothing` acima nunca preenche o que falta. Sem isso a
-- Sala Geral fica sem nome/tema no banco e só funciona por fallback do app.
-- Preenche apenas o que estiver faltando, sem tocar em phase/scores/rodada.
update public.uniko_paint_state
   set state = state || jsonb_build_object('nome', 'Sala Geral', 'themeId', 'geral')
 where id = 'global'
   and (state->>'nome' is null or state->>'themeId' is null);
