-- ════════════════════════════════════════════════════════════════════════
--  UNIKO FIT — notificações push no CELULAR (comentários/reações no seu
--  check-in + mensagens novas no Bate-Papo), mesmo com o app fechado.
--  Guarda a "inscrição" de Web Push de cada dispositivo (gerada no navegador
--  via `pushManager.subscribe`) — quem manda o push de verdade é o
--  crescent-hub-server (repo separado, roda 24/7 na VPS), que faz polling
--  nas tabelas de check-in/comentário/reação/chat e usa a lib `web-push`
--  com as chaves VAPID (ver .env do servidor).
--  Ver src/utils/pushNotify.js e public/sw.js (service worker).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_fit_push_subscriptions (
  id         bigint generated always as identity primary key,
  player     text not null,       -- mesmo nome usado em uniko_fit_checkins.player
  endpoint   text not null unique, -- 1 endpoint = 1 dispositivo/navegador — upsert por aqui
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists uniko_fit_push_subscriptions_player_idx on public.uniko_fit_push_subscriptions (player);

alter table public.uniko_fit_push_subscriptions enable row level security;

drop policy if exists "uniko_fit_push_subscriptions select" on public.uniko_fit_push_subscriptions;
create policy "uniko_fit_push_subscriptions select" on public.uniko_fit_push_subscriptions for select using (true);
drop policy if exists "uniko_fit_push_subscriptions insert" on public.uniko_fit_push_subscriptions;
create policy "uniko_fit_push_subscriptions insert" on public.uniko_fit_push_subscriptions for insert with check (true);
drop policy if exists "uniko_fit_push_subscriptions update" on public.uniko_fit_push_subscriptions;
create policy "uniko_fit_push_subscriptions update" on public.uniko_fit_push_subscriptions for update using (true);
drop policy if exists "uniko_fit_push_subscriptions delete" on public.uniko_fit_push_subscriptions;
create policy "uniko_fit_push_subscriptions delete" on public.uniko_fit_push_subscriptions for delete using (true);
