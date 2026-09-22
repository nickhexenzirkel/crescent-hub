-- ════════════════════════════════════════════════════════════════════════
--  CONTRACHEQUES — fecha o último ponto pendente da correção de set/2026:
--  a tabela já exige token válido (supabase_seguranca_rls_dados_sensiveis.sql),
--  mas o ARQUIVO em si ainda era servido por URL pública fixa (bucket
--  'contracheques' com public=true) — quem já tivesse esse link específico
--  ainda abria o holerite sem passar por nenhuma checagem.
--
--  Agora: bucket fica privado, e o app passa a gerar um link ASSINADO
--  (expira em minutos) na hora de exibir, em vez de guardar/usar o link
--  público fixo salvo no banco.
--
--  Pré-requisito: supabase_seguranca_auth_helper.sql e
--  supabase_seguranca_rls_dados_sensiveis.sql já rodados neste projeto.
--
--  Rode no SQL Editor do projeto Supabase principal. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- Caminho dentro do bucket (ex.: "joao-silva/setembro-2026_1737..._0.pdf"),
-- pra poder emitir link assinado e also amarrar a política de storage à
-- MESMA regra de dono já validada na tabela — sem depender de reconstruir
-- o nome da pasta a partir do employee_name (que teria que reproduzir a
-- sanitização feita em JS, frágil e duplicado).
alter table public.contracheques add column if not exists storage_path text;

-- Backfill dos registros existentes: extrai o caminho de dentro da URL
-- pública antiga (formato padrão do Supabase Storage). Registros que já
-- tiverem storage_path (enviados depois desta correção) não são tocados.
update public.contracheques
set storage_path = substring(file_url from '/object/public/contracheques/(.*)$')
where storage_path is null
  and file_url like '%/object/public/contracheques/%';

-- Bucket deixa de servir arquivo por URL pública direta.
update storage.buckets set public = false where id = 'contracheques';

drop policy if exists contracheques_read   on storage.objects;
drop policy if exists contracheques_insert on storage.objects;
drop policy if exists contracheques_update on storage.objects;
drop policy if exists contracheques_delete on storage.objects;

-- Leitura (necessária pra emitir link assinado): admin/moderador sempre;
-- colaborador só se o caminho pertencer a um registro dele em `contracheques`
-- (mesma checagem de employee_name já usada na política da tabela).
create policy contracheques_read on storage.objects
  for select using (
    bucket_id = 'contracheques' and (
      is_admin_ou_moderador()
      or exists (
        select 1 from public.contracheques c
        where c.storage_path = storage.objects.name
          and c.employee_name = current_name()
      )
    )
  );

create policy contracheques_insert on storage.objects
  for insert with check (bucket_id = 'contracheques' and is_admin_ou_moderador());

create policy contracheques_update on storage.objects
  for update using (bucket_id = 'contracheques' and is_admin_ou_moderador())
  with check (bucket_id = 'contracheques' and is_admin_ou_moderador());

create policy contracheques_delete on storage.objects
  for delete using (bucket_id = 'contracheques' and is_admin_ou_moderador());

-- ── ROLLBACK (reverter às pressas, se algo quebrar em produção) ────────
-- update storage.buckets set public = true where id = 'contracheques';
-- (as políticas antigas de storage.objects tinham using(true)/with check(true) —
--  ver histórico em supabase_contracheques_storage.sql)
