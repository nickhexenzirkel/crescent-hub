-- Assistente UNIKO — modo "Blog Secreto": chat global anônimo (todo mundo vê a mesma
-- conversa, ninguém sabe quem escreveu o quê). `author` é gravado (só pra rastro em
-- caso de abuso grave, acessível só direto no Supabase) mas o CLIENTE NUNCA seleciona
-- essa coluna nas leituras (nem pra si mesmo) — quem escreveu cada mensagem "própria"
-- é rastreado só no navegador de quem enviou (id retornado no insert), não no servidor.
-- Rode no SQL Editor do Supabase.

create table if not exists public.uniko_blog_secreto (
  id bigint generated always as identity primary key,
  author text not null,           -- NUNCA selecionado pelo cliente — só existe pra moderação extrema
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.uniko_blog_secreto enable row level security;

create policy "uniko_blog_select" on public.uniko_blog_secreto for select using (true);
create policy "uniko_blog_insert" on public.uniko_blog_secreto for insert with check (true);
create policy "uniko_blog_delete" on public.uniko_blog_secreto for delete using (true);

grant select, insert, delete on public.uniko_blog_secreto to anon, authenticated;
