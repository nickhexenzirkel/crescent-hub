-- ════════════════════════════════════════════════════════════════════════
--  LOG DE AUDITORIA — quem abriu qual conversa do Uniko Safer, e quando.
--  Pendência da correção de segurança de set/2026 (ver
--  supabase_seguranca_rls_uniko_safer.sql): a RLS já impede acesso de quem
--  não é admin/moderador; este log é a camada de ACCOUNTABILITY entre quem
--  já tem acesso legítimo — permite responder "quem viu a conversa do
--  fulano, e quando" se algum dia for preciso.
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql já rodado NESTE
--  projeto (usa is_admin_ou_moderador(), current_name(), current_role_uniko()).
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_safer_access_log (
  id           bigint generated always as identity primary key,
  contact_id   bigint references public.uniko_safer_contacts(id) on delete set null,
  contact_name text,        -- snapshot: continua legível mesmo se o contato for renomeado/excluído depois
  viewer_name  text,        -- quem abriu (nome do token de login)
  viewer_role  text,        -- 'admin' | 'moderador' — o que ele era NA HORA (não muda se o cargo mudar depois)
  viewed_at    timestamptz not null default now()
);

create index if not exists uniko_safer_access_log_contact_idx on public.uniko_safer_access_log (contact_id, viewed_at desc);
create index if not exists uniko_safer_access_log_viewed_idx  on public.uniko_safer_access_log (viewed_at desc);

alter table public.uniko_safer_access_log enable row level security;

drop policy if exists uniko_safer_access_log_insert on public.uniko_safer_access_log;
drop policy if exists uniko_safer_access_log_select on public.uniko_safer_access_log;

-- Só quem já tem acesso ao módulo (admin/moderador) grava e lê o próprio log —
-- ninguém mais enxerga que o log existe. Sem política de update/delete: o
-- registro é IMUTÁVEL por design, nem admin edita/apaga pela aplicação (se um
-- dia precisar purgar por retenção, é uma ação deliberada no SQL Editor).
create policy uniko_safer_access_log_insert on public.uniko_safer_access_log
  for insert with check (is_admin_ou_moderador());
create policy uniko_safer_access_log_select on public.uniko_safer_access_log
  for select using (is_admin_ou_moderador());
