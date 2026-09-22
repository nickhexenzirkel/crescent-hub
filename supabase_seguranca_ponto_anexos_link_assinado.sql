-- ════════════════════════════════════════════════════════════════════════
--  PONTO-ANEXOS — mesmo tratamento já aplicado aos holerites (ver
--  supabase_seguranca_contracheques_link_assinado.sql): o bucket 'ponto-anexos'
--  guarda os anexos de justificativa (atestado etc., enviado pelo colaborador
--  em ponto_solicitacoes ou pelo RH em ponto_justificativas) e estava com
--  public=true — qualquer um com o link direto abria o arquivo sem passar
--  por nenhuma checagem. Agora o app gera um link assinado (expira em 10 min)
--  na hora de exibir.
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql e
--  supabase_seguranca_rls_ponto.sql (usa e_meu_ponto()) já rodados neste
--  projeto.
--
--  Rode no SQL Editor do projeto Supabase principal. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

alter table public.ponto_solicitacoes    add column if not exists storage_path text;
alter table public.ponto_justificativas  add column if not exists storage_path text;

-- Backfill dos registros existentes a partir da URL pública antiga.
update public.ponto_solicitacoes
set storage_path = substring(file_url from '/object/public/ponto-anexos/(.*)$')
where storage_path is null and file_url like '%/object/public/ponto-anexos/%';

update public.ponto_justificativas
set storage_path = substring(file_url from '/object/public/ponto-anexos/(.*)$')
where storage_path is null and file_url like '%/object/public/ponto-anexos/%';

update storage.buckets set public = false where id = 'ponto-anexos';

drop policy if exists "ponto anexos read"   on storage.objects;
drop policy if exists "ponto anexos insert" on storage.objects;
drop policy if exists ponto_anexos_read     on storage.objects;
drop policy if exists ponto_anexos_insert   on storage.objects;
drop policy if exists ponto_anexos_update   on storage.objects;
drop policy if exists ponto_anexos_delete   on storage.objects;

-- Leitura: admin/moderador sempre; colaborador só se o caminho pertencer a
-- uma solicitação PRÓPRIA (cpf = login) ou a uma justificativa do PRÓPRIO
-- ponto (e_meu_ponto — mesma regra usada em ponto_justificativas).
create policy ponto_anexos_read on storage.objects
  for select using (
    bucket_id = 'ponto-anexos' and (
      is_admin_ou_moderador()
      or exists (
        select 1 from public.ponto_solicitacoes s
        where s.storage_path = storage.objects.name and s.cpf = current_cpf()
      )
      or exists (
        select 1 from public.ponto_justificativas j
        where j.storage_path = storage.objects.name and public.e_meu_ponto(j.cpf)
      )
    )
  );

-- Upload: admin/moderador sempre (anexo de justificativa, qualquer pasta);
-- colaborador só dentro da PRÓPRIA pasta (primeiro segmento do caminho =
-- o CPF de login — é assim que o app já nomeia o arquivo da solicitação).
-- Não dá pra checar contra a tabela aqui porque o arquivo sobe ANTES da
-- linha existir.
create policy ponto_anexos_insert on storage.objects
  for insert with check (
    bucket_id = 'ponto-anexos' and (
      is_admin_ou_moderador()
      or (storage.foldername(name))[1] = current_cpf()
    )
  );

create policy ponto_anexos_update on storage.objects
  for update using (bucket_id = 'ponto-anexos' and is_admin_ou_moderador())
  with check (bucket_id = 'ponto-anexos' and is_admin_ou_moderador());

create policy ponto_anexos_delete on storage.objects
  for delete using (bucket_id = 'ponto-anexos' and is_admin_ou_moderador());

-- ── ROLLBACK (reverter às pressas, se algo travar acesso indevido) ─────
-- update storage.buckets set public = true where id = 'ponto-anexos';
-- create policy "ponto anexos read"   on storage.objects for select using (bucket_id = 'ponto-anexos');
-- create policy "ponto anexos insert" on storage.objects for insert with check (bucket_id = 'ponto-anexos');
