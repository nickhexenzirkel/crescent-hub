-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — número de protocolo (sequencial, 1/2/3...) + aviso prévio de
--  gravação (LGPD): o servidor busca automaticamente na transcrição se a
--  frase "Por questões de segurança, esse atendimento está gravado" (ou
--  variação próxima) foi dita. Se NÃO foi, o áudio e a transcrição são
--  APAGADOS por segurança/proteção de dados — só sobra o registro (protocolo
--  + horário) pra auditoria, sem conteúdo nenhum da ligação.
--
--  Rode no MESMO projeto Supabase do Uniko Call (o mesmo do Safer/Security).
--  É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create sequence if not exists public.uniko_call_protocol_seq;

alter table public.uniko_call_recordings add column if not exists protocol bigint;
alter table public.uniko_call_recordings add column if not exists consent_given boolean; -- null = ainda não determinado (transcrevendo/erro); true = aviso dito; false = aviso NÃO dito (áudio/transcrição apagados)

-- Backfill: chamadas que já existem ganham protocolo agora, em ordem
-- cronológica (a mesma sequência continua pras chamadas novas, sem colisão).
do $$
declare r record;
begin
  for r in select id from public.uniko_call_recordings where protocol is null order by started_at asc, id asc loop
    update public.uniko_call_recordings set protocol = nextval('public.uniko_call_protocol_seq') where id = r.id;
  end loop;
end $$;

alter table public.uniko_call_recordings alter column protocol set default nextval('public.uniko_call_protocol_seq');
alter table public.uniko_call_recordings alter column protocol set not null;
create unique index if not exists uniko_call_recordings_protocol_idx on public.uniko_call_recordings (protocol);
