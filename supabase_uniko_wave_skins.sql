-- Oficina Uniko Wave (Dashboard RH → aba Skins): visual ALTERNATIVO pra um
-- personagem JÁ EXISTENTE do jogo (char_id = uma das chaves de CHARACTERS em
-- public/unikowave/index.html: dodoco, icy, columbina, linnea, madoka,
-- homura, stella, natsumi, venebra, oceania, ashen, icydoll — ou o id de uma
-- personagem criada na própria Oficina, ver uniko_wave_chars). Diferente de
-- uniko_wave_chars: não cria personagem novo, só uma imagem/título/descrição
-- a mais pra um que já existe. Comprada com GW (Ghost Waves) ganho jogando
-- partidas — mesma carteira de sempre, sem gacha, preço fixo.
create table if not exists uniko_wave_skins (
  id text primary key,             -- slug estável (ex.: 'linnea-natalina-ab12')
  char_id text not null,           -- a quem essa skin pertence
  titulo text not null,
  descricao text,
  imagem_url text not null,        -- substitui a splash/retrato do personagem quando equipada
  gw_price integer not null default 500,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists uniko_wave_skins_char_id_idx on uniko_wave_skins (char_id);

alter table uniko_wave_skins enable row level security;

drop policy if exists "uniko_wave_skins select" on uniko_wave_skins;
create policy "uniko_wave_skins select" on uniko_wave_skins for select using (true);
drop policy if exists "uniko_wave_skins insert" on uniko_wave_skins;
create policy "uniko_wave_skins insert" on uniko_wave_skins for insert with check (true);
drop policy if exists "uniko_wave_skins update" on uniko_wave_skins;
create policy "uniko_wave_skins update" on uniko_wave_skins for update using (true);
drop policy if exists "uniko_wave_skins delete" on uniko_wave_skins;
create policy "uniko_wave_skins delete" on uniko_wave_skins for delete using (true);

-- Bucket público pra imagem da skin (PNG com transparência, até 12MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('uniko-wave-skins', 'uniko-wave-skins', true, 12582912)
on conflict (id) do update set public = true, file_size_limit = 12582912;

drop policy if exists "uniko-wave-skins read" on storage.objects;
create policy "uniko-wave-skins read" on storage.objects
  for select using (bucket_id = 'uniko-wave-skins');
drop policy if exists "uniko-wave-skins insert" on storage.objects;
create policy "uniko-wave-skins insert" on storage.objects
  for insert with check (bucket_id = 'uniko-wave-skins');
drop policy if exists "uniko-wave-skins update" on storage.objects;
create policy "uniko-wave-skins update" on storage.objects
  for update using (bucket_id = 'uniko-wave-skins');
drop policy if exists "uniko-wave-skins delete" on storage.objects;
create policy "uniko-wave-skins delete" on storage.objects
  for delete using (bucket_id = 'uniko-wave-skins');

notify pgrst, 'reload schema';
