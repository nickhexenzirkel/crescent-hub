-- ════════════════════════════════════════════════════════════════════════
-- DESLIGAMENTO DE COLABORADOR
-- Dashboard RH → aba "Gerenciar Usuários" → botão "Desligamento".
--
-- • desligado        → para de contabilizar banco de horas, faltas e tudo
--                      mais no Ponto Eletrônico e no Portal do Colaborador.
-- • acesso_bloqueado → opção separada: a pessoa não consegue MAIS entrar no
--                      Uniko (login barrado e sessões já abertas derrubadas).
--
-- São flags independentes de propósito: dá pra desligar sem cortar o acesso
-- (ex.: aviso prévio) e dá pra cortar o acesso sem desligar (ex.: suspensão).
-- Rode no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════════

alter table public.employees add column if not exists desligado           boolean not null default false;
alter table public.employees add column if not exists desligamento_data   date;      -- último dia contabilizado
alter table public.employees add column if not exists desligamento_motivo text;
alter table public.employees add column if not exists desligamento_por    text;      -- quem registrou (RH)
alter table public.employees add column if not exists desligamento_em     timestamptz;
alter table public.employees add column if not exists acesso_bloqueado    boolean not null default false;

-- Consultado a cada request autenticado (cache de 30s no servidor) — ver
-- refreshBlocked() no crescent-hub-server.
create index if not exists employees_acesso_bloqueado_idx on public.employees (acesso_bloqueado) where acesso_bloqueado;
create index if not exists employees_desligado_idx        on public.employees (desligado)        where desligado;
