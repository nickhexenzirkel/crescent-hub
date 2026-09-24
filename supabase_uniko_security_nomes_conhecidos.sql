-- ════════════════════════════════════════════════════════════════════════
--  UNIKO SECURITY — nomes conhecidos (agenda salva no celular, via
--  smb_app_state_sync). Antes, esse evento só atualizava um contato que JÁ
--  existia aqui — se a pessoa mandasse a 1ª mensagem DEPOIS da sincronização
--  já ter passado (o caso comum: sync roda cedo, logo que o Coexistence
--  conecta, antes da maioria ter mandado mensagem), o nome nunca chegava e
--  ficava só o número pra sempre. Agora o nome fica guardado aqui, à parte,
--  e é consultado toda vez que um contato NOVO é criado — funciona não
--  importa a ordem de chegada.
--
--  Rode no MESMO projeto Supabase do Uniko Safer/Security. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.uniko_security_known_names (
  wa_id      text not null,
  category   text not null,
  name       text not null,
  updated_at timestamptz not null default now(),
  primary key (wa_id, category)
);
