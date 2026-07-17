-- Conexão Setorial v2 — arquivar cards + histórico de alterações
-- Rode no SQL Editor do Supabase.

alter table conexao_cards add column if not exists archived boolean not null default false;
alter table conexao_cards add column if not exists history  jsonb   not null default '[]'::jsonb;
