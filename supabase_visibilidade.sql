-- ════════════════════════════════════════════════════════════════════════
--  VISIBILIDADE DE MÓDULOS E ABAS — esconder (pra todos ou só pra algumas pessoas)
--  e renomear módulos (cards da tela inicial) e abas do Portal, sem mexer em
--  código. Escrito pelo agente de Pedidos de Ajuste; lido por todo o site
--  (src/shared/visibilidade.js). Também guarda o "como desfazer" das ações do
--  agente na própria tabela de pedidos.
--  Rode no projeto Supabase PRINCIPAL, DEPOIS de supabase_pedidos_ajuste.sql. Idempotente.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.uniko_visibilidade (
  tipo          text not null check (tipo in ('modulo','aba')),
  item_id       text not null,                       -- id do card (ex.: uniko-fit) ou da aba (ex.: unikosuspect)
  nome          text,                                -- novo nome exibido (null = nome original)
  oculto_todos  boolean not null default false,      -- escondido pra todo mundo
  ocultar_para  text[] not null default '{}',        -- nomes completos de quem NÃO vê
  updated_by    text,
  updated_at    timestamptz not null default now(),
  primary key (tipo, item_id)
);

alter table public.uniko_visibilidade enable row level security;
drop policy if exists uniko_visibilidade_all on public.uniko_visibilidade;
create policy uniko_visibilidade_all on public.uniko_visibilidade for all using (true) with check (true);

-- Ação administrativa do agente (plano + como desfazer) guardada no pedido.
alter table public.uniko_pedidos_ajuste add column if not exists acao jsonb;

notify pgrst, 'reload schema';
