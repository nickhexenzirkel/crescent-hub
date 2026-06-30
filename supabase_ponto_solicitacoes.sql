-- Solicitações de JUSTIFICATIVA do ponto: o colaborador anexa um arquivo + título +
-- descrição explicando por que precisa justificar as horas negativas/falta de um dia.
-- O RH recebe na Dashboard e usa pra entender antes de abonar o dia no Ponto Eletrônico.
-- Rode no SQL Editor do Supabase.

create table if not exists public.ponto_solicitacoes (
  id          bigint generated always as identity primary key,
  cpf         text not null,
  nome        text,
  titulo      text not null,
  descricao   text,
  data_ref    text,                              -- dia que está justificando (YYYY-MM-DD)
  file_url    text,
  file_name   text,
  status      text not null default 'pendente',  -- pendente | resolvido
  created_at  timestamptz not null default now()
);

create index if not exists ponto_solic_cpf_idx    on public.ponto_solicitacoes (cpf, created_at desc);
create index if not exists ponto_solic_status_idx on public.ponto_solicitacoes (status, created_at desc);

alter table public.ponto_solicitacoes enable row level security;

drop policy if exists ponto_solic_read   on public.ponto_solicitacoes;
drop policy if exists ponto_solic_insert on public.ponto_solicitacoes;
drop policy if exists ponto_solic_update on public.ponto_solicitacoes;
drop policy if exists ponto_solic_delete on public.ponto_solicitacoes;

create policy ponto_solic_read   on public.ponto_solicitacoes for select using (true);
create policy ponto_solic_insert on public.ponto_solicitacoes for insert with check (true);
create policy ponto_solic_update on public.ponto_solicitacoes for update using (true) with check (true);
create policy ponto_solic_delete on public.ponto_solicitacoes for delete using (true);

-- ── Bucket de anexos (público) p/ os arquivos das solicitações ──────────────
insert into storage.buckets (id, name, public)
  values ('ponto-anexos', 'ponto-anexos', true)
  on conflict (id) do nothing;

drop policy if exists "ponto anexos read"   on storage.objects;
drop policy if exists "ponto anexos insert" on storage.objects;

create policy "ponto anexos read"   on storage.objects for select using (bucket_id = 'ponto-anexos');
create policy "ponto anexos insert" on storage.objects for insert with check (bucket_id = 'ponto-anexos');
