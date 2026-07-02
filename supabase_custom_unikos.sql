-- "Oficina de Uniko" — Unikos CRIADOS PELO ADMIN (Dashboard RH → aba Capture o Uniko),
-- fora do roster fixo em código (CAPTURE_UNIKOS). O admin anexa as imagens dos frames
-- (frame principal é obrigatório; os outros são opcionais e caem no principal se faltar)
-- e o Uniko passa a poder ser escolhido como o Uniko do evento "Capture o Uniko" e
-- usado como assistente/foto de perfil por quem capturar.
-- Rode no SQL Editor do Supabase.

create table if not exists public.custom_unikos (
  id               text primary key,                 -- slug gerado do nome (+ sufixo aleatório)
  name             text not null,
  tagline          text,
  accent           text not null default '#6C5CE7',   -- cor base escolhida pelo admin (deriva o tema)
  reward_comum     integer not null default 100,
  reward_premium   integer not null default 100,
  img_main         text not null,                     -- frame principal (estático) — OBRIGATÓRIO
  img_notif        text,                               -- frame de notificação (opcional)
  img_alert        text,                               -- frame de aviso (opcional)
  img_closed       text,                               -- frame de olhos fechados (opcional)
  img_capture      text,                               -- frame de capturar (opcional)
  created_by       text,
  created_at       timestamptz not null default now()
);

alter table public.custom_unikos enable row level security;

-- App usa a chave anônima → políticas permissivas (o Dashboard RH já é área restrita no app).
drop policy if exists custom_unikos_read   on public.custom_unikos;
drop policy if exists custom_unikos_insert on public.custom_unikos;
drop policy if exists custom_unikos_delete on public.custom_unikos;

create policy custom_unikos_read   on public.custom_unikos for select using (true);
create policy custom_unikos_insert on public.custom_unikos for insert with check (true);
create policy custom_unikos_delete on public.custom_unikos for delete using (true);
