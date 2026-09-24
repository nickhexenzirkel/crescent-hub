-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SECURITY — Backup criptografado automático (mensal). Guarda só o
--  METADADO do histórico de backups automáticos (data/tamanho/caminho no
--  Storage) — o conteúdo em si (texto + mídia, cifrado com AES-256-GCM) fica
--  no bucket PRIVADO uniko-security-backups-auto.
--
--  Diferente do uniko-security-media (público): um backup completo é muito
--  mais sensível que uma mídia isolada, então esse bucket NÃO tem nenhuma
--  policy pra anon/authenticated — só a service_role (bypassa RLS) lê/
--  escreve, e todo download passa pelo servidor (crescent-hub-server/
--  unikoSecurityBackup.js), nunca por link direto. Backups manuais (tudo ou
--  1 contato, disparados pelo admin) não passam por aqui — são gerados,
--  baixados na hora e descartados do servidor, sem registro nenhum.
--
--  Rode no MESMO projeto Supabase do Uniko Safer/Security. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_security_backups (
  id         bigint generated always as identity primary key,
  path       text not null,           -- nome do arquivo dentro do bucket privado
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists uniko_security_backups_created_idx on public.uniko_security_backups (created_at desc);

-- RLS ligada, SEM nenhuma policy (mesmo padrão do uniko_security_webhook_raw)
-- — só a service_role do backend lê/escreve; o cliente nunca consulta essa
-- tabela direto, sempre via /api/security/backup/auto/list (que já checa
-- admin pelo próprio JWT do app).
alter table public.uniko_security_backups enable row level security;

insert into storage.buckets (id, name, public)
  values ('uniko-security-backups-auto', 'uniko-security-backups-auto', false)
  on conflict (id) do nothing;
-- Bucket privado de propósito — sem policy nenhuma em storage.objects pra
-- esse bucket (nem select, nem insert): só a service_role passa.
