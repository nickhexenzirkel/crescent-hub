-- Anexo na justificativa do RH: quando o colaborador NÃO enviou solicitação (motivo +
-- atestado) para um dia, o Administrador/Moderador pode anexar o documento na hora de
-- justificar/abonar o dia, direto no módulo Ponto Eletrônico. O arquivo vai pro bucket
-- público `ponto-anexos` (o mesmo das solicitações, criado em supabase_ponto_solicitacoes.sql).
-- Rode no SQL Editor do Supabase.

alter table public.ponto_justificativas add column if not exists file_url  text;
alter table public.ponto_justificativas add column if not exists file_name text;
