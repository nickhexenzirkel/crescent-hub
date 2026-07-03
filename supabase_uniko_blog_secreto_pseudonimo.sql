-- Blog Secreto — dá um "rosto" anônimo CONSISTENTE pra cada pessoa diferente, sem
-- revelar quem ela é. Problema: hoje toda mensagem de "outra pessoa" mostra o mesmo
-- rótulo genérico "ANÔNIMO" — impossível saber se são a MESMA pessoa mandando várias
-- mensagens ou VÁRIAS pessoas diferentes, tudo parece "uma pessoa só".
--
-- Solução: `pseudo_tag` — um número pequeno, atribuído automaticamente (trigger) na
-- 1ª mensagem de cada autor(a) e reaproveitado nas próximas. O cliente usa esse número
-- só pra escolher um emoji/cor fixos (ex.: 🦊 Anônimo) — NUNCA pra saber quem é.
--
-- Por que não usar um hash do nome (md5(author) etc.): numa empresa o universo de nomes
-- é conhecido/pequeno — dá pra calcular o hash de cada funcionário e comparar (ataque de
-- dicionário), desanonimizando todo mundo. Em vez disso, `pseudo_tag` é um contador
-- SEQUENCIAL sem relação matemática com o nome — não tem como "calcular" de trás pra
-- frente quem é quem, só olhando os bancos.
--
-- A tabela de mapeamento (`uniko_blog_authors`) fica com RLS ligado e ZERO políticas —
-- o cliente não consegue ler NEM escrever nela direto; só a função SECURITY DEFINER
-- (roda com privilégio de dono, ignora RLS) consegue, disparada pelo trigger no insert.
-- Rode depois de supabase_uniko_blog_secreto_editar.sql.

create table if not exists public.uniko_blog_authors (
  author     text primary key,
  pseudo_tag int generated always as identity,
  first_seen timestamptz not null default now()
);
alter table public.uniko_blog_authors enable row level security;
-- sem nenhuma policy pra anon/authenticated → SELECT/INSERT direto do cliente é negado

alter table public.uniko_blog_secreto add column if not exists pseudo_tag int;

create or replace function public.uniko_blog_assign_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_tag int;
begin
  insert into public.uniko_blog_authors(author) values (new.author)
    on conflict (author) do nothing;
  select pseudo_tag into v_tag from public.uniko_blog_authors where author = new.author;
  new.pseudo_tag := v_tag;
  return new;
end;
$$;

drop trigger if exists uniko_blog_secreto_tag on public.uniko_blog_secreto;
create trigger uniko_blog_secreto_tag
  before insert on public.uniko_blog_secreto
  for each row execute function public.uniko_blog_assign_tag();

-- Preenche o pseudo_tag de mensagens já existentes (antes desta migração), senão elas
-- ficam sem tag (o cliente cai no avatar "genérico" pra essas linhas antigas).
do $$
declare r record;
begin
  for r in select distinct author from public.uniko_blog_secreto where pseudo_tag is null loop
    insert into public.uniko_blog_authors(author) values (r.author) on conflict (author) do nothing;
    update public.uniko_blog_secreto b set pseudo_tag = a.pseudo_tag
      from public.uniko_blog_authors a where a.author = r.author and b.author = r.author and b.pseudo_tag is null;
  end loop;
end $$;
