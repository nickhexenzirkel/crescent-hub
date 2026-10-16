-- ════════════════════════════════════════════════════════════════════════
--  UNIKO CALL — "Minhas ligações" (Minhas Tarefas → aba Uniko Call).
--
--  Espelho só de leitura: o colaborador comum passa a LER apenas as
--  ligações em que ele foi o atendente (uniko_call_recordings.attendant_id
--  = id do token dele) e os contatos dessas ligações. Nada é copiado:
--  é a mesma linha e o mesmo áudio do bucket 'uniko-call'. Admin continua
--  vendo tudo pela política que já existe; INSERT/UPDATE/DELETE continuam
--  só admin/servidor.
--
--  Rode no SQL Editor do projeto Supabase do Uniko Safer (o mesmo do
--  supabase_uniko_call.sql). É idempotente.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists uniko_call_recordings_minhas on public.uniko_call_recordings;
create policy uniko_call_recordings_minhas on public.uniko_call_recordings
  for select using (
    attendant_id is not null
    and attendant_id = (select jwt_claims() ->> 'id')
  );

-- Contato visível só se existir ligação do próprio colaborador com ele.
drop policy if exists uniko_call_contacts_minhas on public.uniko_call_contacts;
create policy uniko_call_contacts_minhas on public.uniko_call_contacts
  for select using (
    exists (
      select 1 from public.uniko_call_recordings r
      where r.contact_id = uniko_call_contacts.id
        and r.attendant_id = (select jwt_claims() ->> 'id')
    )
  );
