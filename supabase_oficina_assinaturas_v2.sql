-- ════════════════════════════════════════════════════════════════════
-- OFICINA ESTELAR — Histórico de Assinatura v2
-- Adiciona `tipo` (pra diferenciar Assinatura Automática de Carta de
-- Correção, e futuras ferramentas) e `arquivo_url` (link do documento
-- gerado, guardado no Storage — permite ao admin ver/baixar depois).
-- Rode DEPOIS do supabase_oficina_assinaturas.sql, no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════════════

alter table public.assinatura_historico add column if not exists tipo text not null default 'assinatura_automatica';
alter table public.assinatura_historico add column if not exists arquivo_url text;
