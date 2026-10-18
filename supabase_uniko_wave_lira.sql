-- Lira Estelar (Uniko Wave): músicas extras criadas pelo RH no Dashboard →
-- Oficina Uniko Wave → aba "Lira Estelar". `tab` é a tablatura em texto
-- (uma linha por trecho: letras = teclas Q-U / A-J / Z-M, letras coladas =
-- acorde, "-" ou "_" = pausa). O wrapper TabUnikoWave.jsx lê esta tabela e
-- grava em localStorage['dw_lira_songs'] antes do jogo abrir; o jogo
-- (public/unikowave/lira.js) soma essas músicas às que já vêm no código.
-- Rodar no projeto Supabase PRINCIPAL (o mesmo das skins). Idempotente.
create table if not exists uniko_wave_lira_songs (
  id text primary key,                 -- slug estável (ex.: 'nodkrai-ab12')
  nome text not null,
  nivel text not null default 'Médio', -- Fácil | Médio | Difícil
  unit integer not null default 105,   -- ms por "-" (afeta o ritmo da demo e do Frenesi)
  tab text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table uniko_wave_lira_songs enable row level security;

drop policy if exists "uniko_wave_lira_songs select" on uniko_wave_lira_songs;
create policy "uniko_wave_lira_songs select" on uniko_wave_lira_songs for select using (true);
drop policy if exists "uniko_wave_lira_songs insert" on uniko_wave_lira_songs;
create policy "uniko_wave_lira_songs insert" on uniko_wave_lira_songs for insert with check (true);
drop policy if exists "uniko_wave_lira_songs update" on uniko_wave_lira_songs;
create policy "uniko_wave_lira_songs update" on uniko_wave_lira_songs for update using (true);
drop policy if exists "uniko_wave_lira_songs delete" on uniko_wave_lira_songs;
create policy "uniko_wave_lira_songs delete" on uniko_wave_lira_songs for delete using (true);
