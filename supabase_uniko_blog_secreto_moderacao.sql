-- Blog Secreto — bloqueia conteúdo racista/discriminatório também NO SERVIDOR (o
-- cliente já barra antes de mandar, mas isso é só JS — dá pra burlar chamando a API
-- do Supabase direto com a chave anônima, que já é pública). Esse trigger rejeita
-- o INSERT/UPDATE de verdade, então nem chamando a API na unha passa.
--
-- Lista curada: só o que foi pedido + variações óbvias de grafia — não é um dicionário
-- geral de ofensas, o escopo é racismo mesmo. Pra adicionar mais termos, só incluir no
-- array `v_terms` abaixo e rodar o CREATE OR REPLACE de novo.
--
-- Rode depois de supabase_uniko_blog_secreto_pseudonimo.sql.

create or replace function public.uniko_blog_check_content()
returns trigger
language plpgsql
as $$
declare
  v_norm text;
  v_terms text[] := array[
    'cabelo de bombril', 'cabelo bombril',
    'cabelo pixaim', 'cabelo pichain', 'cabelo pichaim',
    'preto feio', 'preta feia',
    'preto nojento', 'preta nojenta'
  ];
  v_term text;
begin
  if new.text is not null then
    v_norm := lower(new.text);
    foreach v_term in array v_terms loop
      if v_norm like '%' || v_term || '%' then
        raise exception 'Conteúdo racista/discriminatório não é permitido no Blog Secreto.'
          using errcode = 'P0001';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists uniko_blog_secreto_moderation on public.uniko_blog_secreto;
create trigger uniko_blog_secreto_moderation
  before insert or update on public.uniko_blog_secreto
  for each row execute function public.uniko_blog_check_content();
