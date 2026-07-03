-- Blog Secreto — permite editar a própria mensagem (marca `edited` pra mostrar
-- "(editado)" no cliente). Roda depois de supabase_uniko_blog_secreto_midia.sql.

alter table public.uniko_blog_secreto
  add column if not exists edited boolean not null default false;
