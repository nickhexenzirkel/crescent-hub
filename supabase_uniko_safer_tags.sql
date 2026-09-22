-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SAFER — etiquetas personalizadas (nome + cor), compartilhadas entre
--  os setores (Faturamento/Financeiro), várias por contato.
--  Ver src/modules/uniko-safer/index.jsx.
--
--  Rode no SQL Editor do projeto Supabase DEDICADO do Uniko Safer (o mesmo
--  onde já rodou supabase_uniko_safer.sql, supabase_seguranca_auth_helper.sql
--  e supabase_seguranca_rls_uniko_safer.sql). É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_safer_tags (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  color      text not null default '#d4a017',
  created_at timestamptz not null default now()
);

-- Lista de ids de uniko_safer_tags aplicadas ao contato — array simples em
-- vez de tabela de junção (escala pequena, várias etiquetas por contato).
-- Sem foreign key no array (Postgres não suporta FK em array); apagar uma
-- etiqueta remove a referência de todo mundo (ver client, deleteTag()).
alter table public.uniko_safer_contacts add column if not exists tag_ids bigint[] not null default '{}';
create index if not exists uniko_safer_contacts_tag_ids_idx on public.uniko_safer_contacts using gin (tag_ids);

alter table public.uniko_safer_tags enable row level security;
drop policy if exists uniko_safer_tags_all on public.uniko_safer_tags;
-- Mesmo padrão de segurança do resto do Safer (ver
-- supabase_seguranca_rls_uniko_safer.sql) — exige admin/moderador de
-- verdade via jwt_claims(), não só a chave anon.
create policy uniko_safer_tags_all on public.uniko_safer_tags
  for all using (is_admin_ou_moderador()) with check (is_admin_ou_moderador());
