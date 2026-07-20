-- Capture o Uniko: override de recompensa (prismas) pros Unikos FIXOS do roster
-- (vampire-robot, uniko-sereia, uniko-comum) — editável pelo admin no Dashboard RH,
-- sem precisar mudar código. Unikos da Oficina já têm reward_comum/reward_premium
-- próprios na tabela custom_unikos; essa tabela aqui é só pros fixos.
create table if not exists uniko_reward_overrides (
  uniko_id text primary key,
  reward_comum integer not null default 100,
  reward_premium integer not null default 100,
  updated_at timestamptz not null default now()
);

alter table uniko_reward_overrides enable row level security;

drop policy if exists "uniko_reward_overrides select" on uniko_reward_overrides;
create policy "uniko_reward_overrides select" on uniko_reward_overrides for select using (true);
drop policy if exists "uniko_reward_overrides insert" on uniko_reward_overrides;
create policy "uniko_reward_overrides insert" on uniko_reward_overrides for insert with check (true);
drop policy if exists "uniko_reward_overrides update" on uniko_reward_overrides;
create policy "uniko_reward_overrides update" on uniko_reward_overrides for update using (true);
drop policy if exists "uniko_reward_overrides delete" on uniko_reward_overrides;
create policy "uniko_reward_overrides delete" on uniko_reward_overrides for delete using (true);
