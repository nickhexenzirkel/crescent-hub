-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SUSPECT — editor de mapa (Dashboard RH → aba "Uniko Suspect").
--  Guarda a máscara de paredes (imagem preto-e-branco), os pontos de
--  TAREFA e a posição/ícone do BOTÃO DE EMERGÊNCIA — tudo numa linha só
--  (id=1, é 1 mapa único por enquanto). Cada "salvar" no editor sobe um
--  arquivo NOVO no Storage (nome com timestamp) em vez de sobrescrever o
--  mesmo nome — isso evita de vez o problema de cache do navegador que
--  rolava com o arquivo estático em public/uniko-suspect-wallmask.png.
--  Ver src/modules/dashboard-rh/UnikoSuspectMapTab.jsx (edita) e
--  src/modules/central-colaborador/tabs/TabUnikoSuspect.jsx (lê/joga).
--
--  Rode este script no SQL Editor do Supabase. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_suspect_map (
  id               int primary key default 1,
  wall_mask_url    text,
  tasks            jsonb not null default '[]'::jsonb,   -- [{id,label,x,y}]
  emergency_x      double precision,
  emergency_y      double precision,
  emergency_icon_url text,
  updated_by       text,
  updated_at       timestamptz not null default now()
);
insert into public.uniko_suspect_map (id) values (1) on conflict (id) do nothing;

alter table public.uniko_suspect_map enable row level security;
drop policy if exists "uniko_suspect_map select" on public.uniko_suspect_map;
create policy "uniko_suspect_map select" on public.uniko_suspect_map for select using (true);
drop policy if exists "uniko_suspect_map upsert" on public.uniko_suspect_map;
create policy "uniko_suspect_map upsert" on public.uniko_suspect_map for insert with check (true);
drop policy if exists "uniko_suspect_map update" on public.uniko_suspect_map;
create policy "uniko_suspect_map update" on public.uniko_suspect_map for update using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('uniko-suspect-map', 'uniko-suspect-map', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "uniko-suspect-map read" on storage.objects;
create policy "uniko-suspect-map read" on storage.objects
  for select using (bucket_id = 'uniko-suspect-map');
drop policy if exists "uniko-suspect-map insert" on storage.objects;
create policy "uniko-suspect-map insert" on storage.objects
  for insert with check (bucket_id = 'uniko-suspect-map');
drop policy if exists "uniko-suspect-map update" on storage.objects;
create policy "uniko-suspect-map update" on storage.objects
  for update using (bucket_id = 'uniko-suspect-map');
drop policy if exists "uniko-suspect-map delete" on storage.objects;
create policy "uniko-suspect-map delete" on storage.objects
  for delete using (bucket_id = 'uniko-suspect-map');
