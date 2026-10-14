-- Uniko Safer — nome do contato NO WHATSAPP (rodar no projeto DEDICADO do Safer).
-- A sincronização casa a conversa exportada com o contato pelo nome. Se alguém renomear o
-- contato no Safer, o nome do WhatsApp deixava de bater e a sync criava um contato novo em
-- vez de continuar a conversa. Esta coluna guarda o nome original (ou apelido do WhatsApp)
-- para o casamento continuar funcionando. Idempotente.
alter table public.uniko_safer_contacts add column if not exists whatsapp_name text;
