-- Cargo DJ UNIKO (employees.role = 'dj').
-- Quem tem esse cargo controla o player da Central Alexa: pausar/tocar, volume e
-- escolher dispositivo — mas NÃO pula música. Atribuído no Dashboard RH →
-- Funcionários / Editar Perfil → "DJ Uniko". As permissões ficam no servidor
-- (crescent-hub-server: requireAdminOrDJ / requireVolumeControl).
--
-- A tabela nasceu com CHECK (role IN ('employee','admin')) e o 'moderador' foi
-- incluído depois. Esta migração recria a restrição com os 4 cargos. NOT VALID não
-- revalida as linhas antigas (não falha se existir algum valor legado), mas vale
-- pra toda gravação nova. Rode no SQL Editor do Supabase.

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees
  add constraint employees_role_check
  check (role in ('employee', 'moderador', 'admin', 'dj')) not valid;
