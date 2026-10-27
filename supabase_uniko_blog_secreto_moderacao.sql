-- Blog Secreto — moderação obrigatória no servidor.
--
-- Mantém a mesma barreira do cliente para INSERT e UPDATE, inclusive quando alguém
-- tenta chamar a API do Supabase diretamente. A comparação ignora maiúsculas,
-- acentos e pontuação e exige palavras/frases inteiras para reduzir falsos positivos.
--
-- Rode depois de supabase_uniko_blog_secreto_pseudonimo.sql.

create or replace function public.uniko_blog_check_content()
returns trigger
language plpgsql
as $$
declare
  v_norm text;
  v_terms text[] := array[
    -- Palavrões e linguagem imprópria
    'porra', 'caralho', 'merda', 'puta', 'puto', 'foda', 'foder',
    'fodase', 'foda se', 'cacete', 'buceta', 'cuzao',

    -- Ofensas, humilhação e ataques pessoais
    'idiota', 'imbecil', 'burro', 'burra', 'otario', 'otaria',
    'retardado', 'retardada', 'vagabundo', 'vagabunda',
    'desgracado', 'desgracada', 'lixo humano', 'vai morrer', 'se mata',

    -- Racismo e discriminação racial
    'cabelo de bombril', 'cabelo bombril',
    'cabelo pixaim', 'cabelo pichain', 'cabelo pichaim',
    'pixaim', 'pichain', 'pichaim',
    'cabelo duro', 'cabelo feio',
    'preto feio', 'preta feia',
    'preto nojento', 'preta nojenta',
    'pessoa escura',

    -- Preconceito contra orientação sexual ou identidade de gênero
    'viado', 'bicha', 'traveco', 'sapatao', 'aberracao de genero',

    -- Intolerância religiosa e xenofobia
    'crente', 'macumbeiro', 'macumbeira', 'religiao de preto',
    'volta pro seu pais', 'estrangeiro nojento', 'nordestino burro'
  ];
  v_term text;
begin
  if new.text is not null and btrim(new.text) <> '' then
    -- Normaliza acentos antes de trocar pontuação por espaços.
    v_norm := translate(
      lower(new.text),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    );
    v_norm := regexp_replace(v_norm, '[^a-z0-9]+', ' ', 'g');
    v_norm := regexp_replace(v_norm, '[[:space:]]+', ' ', 'g');
    v_norm := ' ' || btrim(v_norm) || ' ';

    foreach v_term in array v_terms loop
      if position(' ' || v_term || ' ' in v_norm) > 0 then
        raise exception 'Conteúdo ofensivo, discriminatório ou impróprio não é permitido no Blog Secreto.'
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists uniko_blog_secreto_moderation
  on public.uniko_blog_secreto;

create trigger uniko_blog_secreto_moderation
  before insert or update on public.uniko_blog_secreto
  for each row
  execute function public.uniko_blog_check_content();
