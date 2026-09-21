-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SAFER — organizador manual de conversas exportadas do WhatsApp:
--  cadastro de contatos e histórico de exportações (.txt/.zip) importadas
--  pela tela. Portado do app desktop (Electron) "uniko safer" — SEM a parte
--  de automação (isso fica pra uma integração futura com WhatsApp Web).
--  Módulo admin/moderador (mesmo padrão do Dashboard RH e Ponto Eletrônico) —
--  ver src/modules/uniko-safer/index.jsx.
--
--  Pensado pra rodar num projeto Supabase PRÓPRIO (ver saferSupabase.js) —
--  o Safer vai reter conversas por anos com exportação semanal automática
--  de todos os contatos, volume que não deve dividir cota com o resto do
--  Portal. Funciona igual num projeto compartilhado, se for essa a escolha.
--
--  Rode este script no SQL Editor do Supabase (do projeto que for usar).
--  É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_safer_contacts (
  id           bigint generated always as identity primary key,
  name         text not null,
  phone_number text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists uniko_safer_contacts_name_idx on public.uniko_safer_contacts (lower(name));

-- Metadados de CADA importação (auditoria: quando, arquivo, tamanho). Não
-- guarda o texto das mensagens — isso vive só em uniko_safer_messages, pra
-- não duplicar a conversa inteira a cada exportação semanal (o export do
-- WhatsApp é sempre cumulativo: reimportar sempre traz o histórico inteiro
-- de novo, não só o que mudou).
create table if not exists public.uniko_safer_exports (
  id                bigint generated always as identity primary key,
  contact_id        bigint not null references public.uniko_safer_contacts(id) on delete cascade,
  original_filename text not null,
  storage_path      text not null,        -- caminho no bucket 'uniko-safer', pra dar delete depois
  file_type         text not null check (file_type in ('txt','zip','other')),
  file_size         bigint not null default 0,
  message_count     integer,               -- total de mensagens NO ARQUIVO (cumulativo)
  new_message_count integer,               -- quantas eram realmente novas (não vistas em importação anterior)
  date_range_start  text,
  date_range_end    text,
  imported_at       timestamptz not null default now()
);
create index if not exists uniko_safer_exports_contact_idx on public.uniko_safer_exports (contact_id, imported_at);
-- Migração de uma versão anterior deste script (que guardava as mensagens
-- aqui em jsonb) — sem efeito se a tabela já nasceu no formato novo.
alter table public.uniko_safer_exports drop column if exists messages;
alter table public.uniko_safer_exports add column if not exists new_message_count integer;

-- Mensagens MESCLADAS por contato — uma linha por mensagem, única por
-- (contact_id, message_hash). Reimportar a MESMA conversa toda semana só
-- insere o que é de fato novo (o client faz upsert com ON CONFLICT DO
-- NOTHING); o que já existe é ignorado sem duplicar espaço.
create table if not exists public.uniko_safer_messages (
  id           bigint generated always as identity primary key,
  contact_id   bigint not null references public.uniko_safer_contacts(id) on delete cascade,
  sent_at      timestamptz not null,
  sender       text,             -- null = mensagem de sistema (sem remetente)
  text         text not null,
  message_hash text not null,    -- sha256(sent_at|sender|text), calculado no client (ver parseWhatsapp.js)
  created_at   timestamptz not null default now(),
  unique (contact_id, message_hash)
);
create index if not exists uniko_safer_messages_contact_idx on public.uniko_safer_messages (contact_id, sent_at);

alter table public.uniko_safer_contacts enable row level security;
alter table public.uniko_safer_exports  enable row level security;
alter table public.uniko_safer_messages enable row level security;

drop policy if exists uniko_safer_contacts_all on public.uniko_safer_contacts;
drop policy if exists uniko_safer_exports_all  on public.uniko_safer_exports;
drop policy if exists uniko_safer_messages_all on public.uniko_safer_messages;
-- Política permissiva (chave anon, sem Supabase Auth) — mesmo padrão do resto
-- do Portal: o acesso ao módulo (admin/moderador) é aplicado no CLIENTE.
create policy uniko_safer_contacts_all on public.uniko_safer_contacts for all using (true) with check (true);
create policy uniko_safer_exports_all  on public.uniko_safer_exports  for all using (true) with check (true);
create policy uniko_safer_messages_all on public.uniko_safer_messages for all using (true) with check (true);

-- Bucket com os arquivos originais (.zip/.txt) importados.
insert into storage.buckets (id, name, public)
  values ('uniko-safer', 'uniko-safer', true)
  on conflict (id) do nothing;

drop policy if exists "uniko safer arquivos read"   on storage.objects;
drop policy if exists "uniko safer arquivos insert" on storage.objects;
drop policy if exists "uniko safer arquivos delete" on storage.objects;
create policy "uniko safer arquivos read"   on storage.objects for select using (bucket_id = 'uniko-safer');
create policy "uniko safer arquivos insert" on storage.objects for insert with check (bucket_id = 'uniko-safer');
create policy "uniko safer arquivos delete" on storage.objects for delete using (bucket_id = 'uniko-safer');
