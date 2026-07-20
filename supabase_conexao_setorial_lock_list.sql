-- Conexão Setorial: trancar coluna (impede excluir clicando no X até destravar)
alter table conexao_lists add column if not exists locked boolean not null default false;
