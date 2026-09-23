-- ════════════════════════════════════════════════════════════════════════
--  VERIFICAÇÃO DE IDENTIDADE PARA RLS — peça central da correção de
--  segurança de set/2026. Até aqui, toda política de RLS do Portal era
--  `using (true)` — ou seja, qualquer um com a chave anon (que fica exposta
--  no JS do navegador, não é segredo) conseguia ler/escrever qualquer linha
--  de qualquer tabela chamando a API REST do Supabase direto, sem passar
--  pelo login nem pelas checagens de admin/moderador do React.
--
--  Este script cria uma forma de a política de RLS verificar quem é o
--  usuário de verdade, sem depender das configurações de Auth do painel do
--  Supabase (que exigiriam trocar o segredo de JWT do projeto e sincronizar
--  com o backend externo — fora do que dá pra fazer só por código).
--
--  Como funciona:
--   1) O cliente (ver src/contexts/user.js e saferSupabase.js) manda o
--      MESMO token que já usa pra falar com o backend (`ch_token`,
--      localStorage) num cabeçalho próprio: `x-ch-auth`. Não usamos o
--      cabeçalho `Authorization` porque esse o PostgREST tenta validar com
--      o PRÓPRIO segredo de Auth do projeto — sem trocar aquele segredo
--      (painel do Supabase, fora do alcance deste script), ele rejeitaria
--      a requisição inteira antes de chegar na nossa função.
--   2) A função `jwt_claims()` abaixo lê esse cabeçalho, refaz a assinatura
--      HMAC-SHA256 do token com o MESMO segredo que o backend usa pra
--      assinar (você cola esse segredo abaixo, uma vez, por projeto), e só
--      devolve os dados do token se a assinatura bater e o token não tiver
--      expirado. Um token forjado ou copiado de outro lugar simplesmente
--      não bate a assinatura e a função devolve NULL.
--   3) As políticas de RLS (nos outros scripts `supabase_seguranca_rls_*`)
--      chamam essa função pra decidir quem pode ver o quê.
--
--  ⚠️ IMPORTANTE — SEGREDO NÃO VAI PRO GIT:
--   O placeholder `<COLE_AQUI_O_JWT_SECRET_DO_BACKEND>` abaixo tem que ser
--   substituído pelo valor REAL antes de rodar no SQL Editor do Supabase —
--   mas SÓ ali. Não salve o valor real de volta neste arquivo antes de
--   commitar (rode com o valor real colado, depois desfaça a edição local
--   antes de dar commit/push, ou rode direto colando no SQL Editor sem
--   salvar o arquivo). O segredo é o mesmo JWT_SECRET (ou nome equivalente)
--   que o crescent-hub-server usa pra assinar o `ch_token` no login — veja a
--   variável de ambiente do servidor (era referenciada em
--   crescent-hub-server/index.js).
--
--  Este script é IDÊNTICO nos dois projetos Supabase (principal e o
--  dedicado do Uniko Safer) — rode uma vez em CADA UM, com o MESMO segredo
--  nos dois, porque são bancos de dados separados. É idempotente.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create schema if not exists private;
-- Nunca exposto pela API REST (PostgREST só expõe o schema `public` por
-- padrão) — mesmo com a chave anon em mãos, não tem rota que leia esta tabela.
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);
revoke all on private.app_secrets from public, anon, authenticated;

insert into private.app_secrets (key, value)
values ('ch_jwt_secret', '<COLE_AQUI_O_JWT_SECRET_DO_BACKEND>')
on conflict (key) do update set value = excluded.value;

-- ── base64url (formato usado pelo JWT — sem os mesmos caracteres/padding
--    do base64 padrão) ────────────────────────────────────────────────────
create or replace function private.base64url_decode(input text)
returns bytea language sql immutable as $$
  select decode(
    translate(input, '-_', '+/') || repeat('=', (4 - length(input) % 4) % 4),
    'base64'
  );
$$;

create or replace function private.base64url_encode(input bytea)
returns text language sql immutable as $$
  select regexp_replace(translate(encode(input, 'base64'), '+/', '-_'), '=+$', '');
$$;

-- ── Verifica a assinatura do token (cabeçalho x-ch-auth) e devolve o
--    payload (claims) se for válido e ainda não tiver expirado; NULL caso
--    contrário. `security definer` pra poder ler o segredo em `private`
--    mesmo chamada pelo papel `anon`. Falha SEMPRE fechada (nunca lança
--    erro pra fora — token ruim = null = sem acesso, não erro 500). ──────
create or replace function public.jwt_claims()
returns jsonb
language plpgsql
stable -- CAUSA RAIZ ACHADA AO VIVO (22/09/2026): sem isso, o Postgres não sabe
       -- que o resultado é o mesmo durante toda a consulta e recalcula a
       -- assinatura HMAC-SHA256 (+ parsing) LINHA POR LINHA em toda política
       -- de RLS que chama is_admin_ou_moderador()/current_role_uniko() — numa
       -- tabela com dezenas de milhares de linhas (ex: uniko_safer_messages)
       -- isso sozinho estourava o statement_timeout, mesmo com os índices
       -- certos no lugar (confirmado: mesma query direto no SQL Editor, que
       -- roda como superusuário e ignora RLS, levava 6ms). `request.headers`
       -- não muda no meio de uma consulta, então marcar como stable é seguro.
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  token        text;
  parts        text[];
  secret       text;
  expected_sig text;
  payload_json jsonb;
  exp_val      bigint;
begin
  token := current_setting('request.headers', true)::json ->> 'x-ch-auth';
  if token is null or token = '' then
    return null;
  end if;

  parts := string_to_array(token, '.');
  if array_length(parts, 1) <> 3 then
    return null;
  end if;

  select value into secret from private.app_secrets where key = 'ch_jwt_secret';
  if secret is null or secret = '<COLE_AQUI_O_JWT_SECRET_DO_BACKEND>' then
    return null; -- placeholder ainda não substituído — nega por segurança, não libera
  end if;

  expected_sig := private.base64url_encode(extensions.hmac(parts[1] || '.' || parts[2], secret, 'sha256'));
  if expected_sig is distinct from parts[3] then
    return null; -- assinatura não bate: token forjado, alterado, ou secret errado
  end if;

  payload_json := convert_from(private.base64url_decode(parts[2]), 'utf8')::jsonb;

  exp_val := (payload_json ->> 'exp')::bigint;
  if exp_val is not null and exp_val < extract(epoch from now()) then
    return null; -- token expirado
  end if;

  return payload_json;
exception when others then
  return null; -- qualquer erro de parsing = nega, nunca derruba a query
end;
$$;

revoke all on function public.jwt_claims() from public;
grant execute on function public.jwt_claims() to anon, authenticated;

-- ── Atalhos usados nas políticas de RLS ──────────────────────────────────
create or replace function public.current_employee_id()
returns uuid language sql stable as $$
  select (jwt_claims() ->> 'id')::uuid;
$$;

create or replace function public.current_cpf()
returns text language sql stable as $$
  select jwt_claims() ->> 'cpf';
$$;

create or replace function public.current_name()
returns text language sql stable as $$
  select jwt_claims() ->> 'name';
$$;

create or replace function public.current_role_uniko()
returns text language sql stable as $$
  select jwt_claims() ->> 'role';
$$;

-- Mesmo critério que o front usa (App.jsx: authUser.role === 'admin' ||
-- 'moderador') pros módulos hoje marcados como adminOnly.
create or replace function public.is_admin_ou_moderador()
returns boolean language sql stable as $$
  select current_role_uniko() in ('admin', 'moderador');
$$;

-- Token presente e com assinatura válida (independente do cargo) — usado
-- em tabelas onde só precisamos garantir "está logado de verdade".
create or replace function public.esta_logado()
returns boolean language sql stable as $$
  select jwt_claims() is not null;
$$;

grant execute on function
  public.current_employee_id(), public.current_cpf(), public.current_name(),
  public.current_role_uniko(), public.is_admin_ou_moderador(), public.esta_logado()
to anon, authenticated;
