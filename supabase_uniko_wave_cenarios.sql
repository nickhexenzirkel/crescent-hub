-- ═══════════════════════════════════════════════════════════════════════════
-- MAPAS & TEXTURAS DO UNIKO WAVE (Dashboard RH → Oficina Uniko Wave)
--
-- Um "cenário" é um pacote visual que o admin monta e o jogo aplica sozinho:
-- cenário de fundo (IMAGEM ou VÍDEO) + as texturas do Guerra Estelar (esteira,
-- minions terrestres/voadores, minion grande e boss).
--
-- Antes tudo isso era arquivo fixo em public/unikowave/images/ com o caminho
-- escrito no código do jogo — trocar a esteira ou o boss exigia commit+deploy.
--
-- COMO O JOGO LÊ: mesmo caminho já usado pelas personagens da Oficina
-- (uniko_wave_chars → localStorage 'dw_custom_chars'): o React busca a tabela e
-- escreve em localStorage ANTES de montar o iframe, que é da mesma origem.
--
-- QUAL CENÁRIO VALE: `active` = PUBLICADO, ou seja, aparece no seletor "Mapa"
-- da tela de preview do jogo. Podem ser vários ao mesmo tempo — quem joga
-- escolhe (a escolha fica em localStorage, separada por modo). Quem nunca
-- escolheu joga com o primeiro publicado do modo, por ordem de `sort`. O
-- seletor sempre oferece "Original" (o visual que vem com o jogo).
--
-- Campo de imagem VAZIO = mantém a textura original do jogo. Dá pra trocar só
-- a esteira, por exemplo, sem precisar refazer minions e boss.
--
-- Rode no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_wave_scenes (
  id          text primary key,
  name        text not null,
  -- Onde o cenário se aplica: 'classic' (Teclado Estelar) | 'wargame'
  -- (Guerra Estelar) | 'both'. As texturas só têm efeito no Guerra Estelar;
  -- o fundo vale nos dois.
  mode        text not null default 'both',

  -- ── Cenário de fundo ──
  bg_kind     text not null default 'none',   -- 'none' | 'image' | 'video'
  bg_url      text,
  -- Escurecimento por cima do fundo (0-90%). Existe porque um fundo claro
  -- demais faz as notas sumirem — é o mesmo truque da camada preta que o
  -- vídeo do YouTube já usa (#videoBgWrap::after).
  bg_dim      integer not null default 55,

  -- ── Texturas do Guerra Estelar (todas opcionais) ──
  belt_url            text,   -- esteira (chão que rola)
  minion_url          text,   -- minion terrestre
  minion_smile_url    text,   -- minion terrestre sorrindo (alterna → parece rir)
  minion_air_url      text,   -- minion voador, asa pra CIMA
  minion_air_down_url text,   -- minion voador, asa pra BAIXO (alterna → bate asa)
  minion_big_url      text,   -- minion GRANDE (evento de combo 50)
  boss_url            text,   -- boss
  boss_defeated_url   text,   -- boss derrotado

  active      boolean not null default true,
  sort        integer not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists uniko_wave_scenes_sort_idx on public.uniko_wave_scenes (sort);

alter table public.uniko_wave_scenes enable row level security;

-- App usa a chave anônima → políticas permissivas (mesmo padrão de uniko_wave_chars).
drop policy if exists uniko_wave_scenes_read   on public.uniko_wave_scenes;
drop policy if exists uniko_wave_scenes_insert on public.uniko_wave_scenes;
drop policy if exists uniko_wave_scenes_update on public.uniko_wave_scenes;
drop policy if exists uniko_wave_scenes_delete on public.uniko_wave_scenes;

create policy uniko_wave_scenes_read   on public.uniko_wave_scenes for select using (true);
create policy uniko_wave_scenes_insert on public.uniko_wave_scenes for insert with check (true);
create policy uniko_wave_scenes_update on public.uniko_wave_scenes for update using (true) with check (true);
create policy uniko_wave_scenes_delete on public.uniko_wave_scenes for delete using (true);

-- Bucket público pros arquivos. 80MB porque o fundo pode ser VÍDEO — as
-- texturas (PNG) são pequenas, mas dividem o mesmo bucket pra simplificar.
insert into storage.buckets (id, name, public, file_size_limit)
values ('uniko-wave-scenes', 'uniko-wave-scenes', true, 83886080)
on conflict (id) do update set public = true, file_size_limit = 83886080;

drop policy if exists "uniko-wave-scenes read" on storage.objects;
create policy "uniko-wave-scenes read" on storage.objects
  for select using (bucket_id = 'uniko-wave-scenes');
drop policy if exists "uniko-wave-scenes insert" on storage.objects;
create policy "uniko-wave-scenes insert" on storage.objects
  for insert with check (bucket_id = 'uniko-wave-scenes');
drop policy if exists "uniko-wave-scenes update" on storage.objects;
create policy "uniko-wave-scenes update" on storage.objects
  for update using (bucket_id = 'uniko-wave-scenes');
drop policy if exists "uniko-wave-scenes delete" on storage.objects;
create policy "uniko-wave-scenes delete" on storage.objects
  for delete using (bucket_id = 'uniko-wave-scenes');
