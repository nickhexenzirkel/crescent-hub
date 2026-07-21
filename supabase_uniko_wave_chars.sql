-- Oficina Uniko Wave (Dashboard RH): personagens criadas pelo admin pro jogo
-- Uniko Wave. Entram no roster (modo ritmo + gacha da Audição) e na Guerra
-- Estelar. Só imagens (splash + passo 1-5 + atacar/pular/segurar) + nome/desc/cor.
create table if not exists uniko_wave_chars (
  id text primary key,             -- slug estável (ex.: 'oficina-fulana-ab12')
  name text not null,
  "desc" text,
  color text default '#ff00cc',
  splash_url text,                 -- splash art (gacha + mascote do ritmo)
  run_urls jsonb default '[]'::jsonb, -- passo 1..5 (andar); 1º frame também é o "base"
  atk_url text,                    -- atacar
  jump_url text,                   -- pular
  hold_url text,                   -- segurar
  created_by text,
  created_at timestamptz not null default now()
);

alter table uniko_wave_chars enable row level security;

drop policy if exists "uniko_wave_chars select" on uniko_wave_chars;
create policy "uniko_wave_chars select" on uniko_wave_chars for select using (true);
drop policy if exists "uniko_wave_chars insert" on uniko_wave_chars;
create policy "uniko_wave_chars insert" on uniko_wave_chars for insert with check (true);
drop policy if exists "uniko_wave_chars update" on uniko_wave_chars;
create policy "uniko_wave_chars update" on uniko_wave_chars for update using (true);
drop policy if exists "uniko_wave_chars delete" on uniko_wave_chars;
create policy "uniko_wave_chars delete" on uniko_wave_chars for delete using (true);

-- Bucket público pras imagens dos personagens (PNG com transparência, até 12MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('uniko-wave-chars', 'uniko-wave-chars', true, 12582912)
on conflict (id) do update set public = true, file_size_limit = 12582912;

drop policy if exists "uniko-wave-chars read" on storage.objects;
create policy "uniko-wave-chars read" on storage.objects
  for select using (bucket_id = 'uniko-wave-chars');
drop policy if exists "uniko-wave-chars insert" on storage.objects;
create policy "uniko-wave-chars insert" on storage.objects
  for insert with check (bucket_id = 'uniko-wave-chars');
drop policy if exists "uniko-wave-chars update" on storage.objects;
create policy "uniko-wave-chars update" on storage.objects
  for update using (bucket_id = 'uniko-wave-chars');
drop policy if exists "uniko-wave-chars delete" on storage.objects;
create policy "uniko-wave-chars delete" on storage.objects
  for delete using (bucket_id = 'uniko-wave-chars');
