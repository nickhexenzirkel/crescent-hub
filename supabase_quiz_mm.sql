-- ═══════════════════════════════════════════════════════════════════════════
-- QUIZ DO M&M — quiz de perguntas e respostas com prêmio pro primeiro que
-- acertar tudo. Rode no SQL Editor do Supabase.
--
-- SEGURANÇA (o motivo do desenho ser assim): o prêmio é DE VERDADE, então o
-- gabarito não pode chegar no navegador — qualquer um abriria o devtools, leria
-- as respostas e ganharia. Por isso:
--
--   • mm_quiz          → só a vitrine (título, prêmio, horário, vencedor).
--                        Leitura liberada: é o que todo mundo precisa ver.
--   • mm_quiz_conteudo → perguntas E gabarito. NÃO TEM POLICY DE SELECT, então
--                        ninguém lê pela API, nem com a chave anônima.
--   • as duas RPCs abaixo são SECURITY DEFINER: elas enxergam o conteúdo e
--     devolvem só o que pode ser visto —
--        mm_quiz_abrir     → perguntas SEM o gabarito, e só depois do horário
--        mm_quiz_responder → confere as respostas DENTRO do banco
--
-- Ou seja: nem o gabarito nem as perguntas-antes-da-hora saem daqui.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.mm_quiz (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  premio       text not null,
  lanca_em     timestamptz not null,          -- quando abre pra todo mundo
  total        integer not null default 0,    -- nº de perguntas (pra vitrine)
  criador      text not null,
  vencedor     text,                          -- null = ninguém ganhou ainda
  vencedor_em  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists mm_quiz_lanca_idx on public.mm_quiz (lanca_em desc);

-- Perguntas + gabarito. Fica FORA da tabela da vitrine de propósito.
create table if not exists public.mm_quiz_conteudo (
  quiz_id    uuid primary key references public.mm_quiz(id) on delete cascade,
  perguntas  jsonb not null,   -- [{ "q": "...", "opcoes": ["a","b","c","d"] }]
  gabarito   jsonb not null    -- [0, 2, 1]  (índice da opção certa de cada pergunta)
);

alter table public.mm_quiz enable row level security;
alter table public.mm_quiz_conteudo enable row level security;

-- Vitrine: todo mundo lê; criar/editar/apagar é liberado (o app é quem restringe
-- a admins + Marcos, mesmo padrão do resto do projeto).
drop policy if exists mm_quiz_read   on public.mm_quiz;
drop policy if exists mm_quiz_insert on public.mm_quiz;
drop policy if exists mm_quiz_update on public.mm_quiz;
drop policy if exists mm_quiz_delete on public.mm_quiz;
create policy mm_quiz_read   on public.mm_quiz for select using (true);
create policy mm_quiz_insert on public.mm_quiz for insert with check (true);
create policy mm_quiz_update on public.mm_quiz for update using (true) with check (true);
create policy mm_quiz_delete on public.mm_quiz for delete using (true);

-- Conteúdo: escrever pode (pra criar o quiz), LER NÃO — repare que não existe
-- policy de SELECT aqui, e é exatamente esse o ponto.
drop policy if exists mm_quiz_conteudo_insert on public.mm_quiz_conteudo;
drop policy if exists mm_quiz_conteudo_update on public.mm_quiz_conteudo;
drop policy if exists mm_quiz_conteudo_delete on public.mm_quiz_conteudo;
create policy mm_quiz_conteudo_insert on public.mm_quiz_conteudo for insert with check (true);
create policy mm_quiz_conteudo_update on public.mm_quiz_conteudo for update using (true) with check (true);
create policy mm_quiz_conteudo_delete on public.mm_quiz_conteudo for delete using (true);

-- ── Abrir o quiz: entrega as perguntas SEM o gabarito, e só depois do horário.
create or replace function public.mm_quiz_abrir(p_quiz uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.mm_quiz%rowtype;
  c public.mm_quiz_conteudo%rowtype;
begin
  select * into q from public.mm_quiz where id = p_quiz;
  if not found then return jsonb_build_object('erro', 'quiz não encontrado'); end if;
  if q.lanca_em > now() then
    -- Antes da hora ninguém vê as perguntas — nem por chamada direta na API.
    return jsonb_build_object('erro', 'ainda não lançou', 'lanca_em', q.lanca_em);
  end if;
  select * into c from public.mm_quiz_conteudo where quiz_id = p_quiz;
  if not found then return jsonb_build_object('erro', 'quiz sem perguntas'); end if;
  return jsonb_build_object(
    'id', q.id, 'titulo', q.titulo, 'premio', q.premio,
    'vencedor', q.vencedor,
    'perguntas', c.perguntas          -- gabarito fica aqui dentro, não vai junto
  );
end $$;

-- ── Responder: confere DENTRO do banco e crava o vencedor (o primeiro que
--    acertar tudo). O `where vencedor is null` faz a corrida ser decidida pelo
--    Postgres — dois acertos no mesmo instante não viram dois vencedores.
create or replace function public.mm_quiz_responder(
  p_quiz uuid, p_player text, p_respostas jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.mm_quiz%rowtype;
  c public.mm_quiz_conteudo%rowtype;
  erradas int := 0;
  i int;
  venc text;
begin
  select * into q from public.mm_quiz where id = p_quiz;
  if not found then return jsonb_build_object('erro', 'quiz não encontrado'); end if;
  if q.lanca_em > now() then return jsonb_build_object('erro', 'ainda não lançou'); end if;

  select * into c from public.mm_quiz_conteudo where quiz_id = p_quiz;
  if not found then return jsonb_build_object('erro', 'quiz sem perguntas'); end if;

  for i in 0 .. jsonb_array_length(c.gabarito) - 1 loop
    if (p_respostas -> i) is distinct from (c.gabarito -> i) then
      erradas := erradas + 1;
    end if;
  end loop;

  if erradas > 0 then
    -- Devolve QUANTAS erradas, nunca QUAIS: com tentativa ilimitada, dizer quais
    -- entregaria o gabarito por eliminação.
    return jsonb_build_object('acertou', false, 'erradas', erradas, 'vencedor', q.vencedor);
  end if;

  update public.mm_quiz
     set vencedor = p_player, vencedor_em = now()
   where id = p_quiz and vencedor is null;

  select vencedor into venc from public.mm_quiz where id = p_quiz;
  return jsonb_build_object('acertou', true, 'erradas', 0, 'vencedor', venc,
                            'ganhou', venc = p_player);
end $$;

grant execute on function public.mm_quiz_abrir(uuid) to anon, authenticated;
grant execute on function public.mm_quiz_responder(uuid, text, jsonb) to anon, authenticated;
