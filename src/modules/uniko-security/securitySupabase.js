// src/modules/uniko-security/securitySupabase.js
// Client Supabase do Uniko Security — MESMO projeto dedicado do Uniko Safer
// (decisão deliberada, ver supabase_uniko_security.sql: reaproveita
// jwt_claims()/current_role_uniko() já configurados ali, em vez de duplicar
// segredo e criar um projeto do zero). As tabelas são outras
// (uniko_security_*), então não há risco de misturar dado com o Safer.
//
// Chave "anon" (pública) — igual ao Safer, o módulo não usa nem precisa da
// service_role/secret key (essa só existe no SERVIDOR, usada pelo webhook em
// crescent-hub-server/whatsappCloudApi.js pra gravar mensagem sem RLS).
import { createClient } from '@supabase/supabase-js';

const SECURITY_SUPABASE_URL = 'https://npfgggoavzzyzcjjachi.supabase.co';
const SECURITY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmdnZ29hdnp6eXpjamphY2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDEwNzgsImV4cCI6MjEwNTU3NzA3OH0.XUexLOmbg7zKknw_xx7pTegi7uoAHQ_gKI6_She3RZA';

// Mesmo padrão de saferSupabase.js/src/contexts/user.js: manda o ch_token no
// cabeçalho x-ch-auth pra RLS poder checar admin de verdade (ver
// jwt_claims() em supabase_seguranca_auth_helper.sql e as políticas em
// supabase_uniko_security.sql — SÓ admin, nem moderador, pedido explícito
// pra esse módulo).
const _securityFetch = (url, options = {}) => {
  const token = localStorage.getItem('ch_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('x-ch-auth', token);
  return fetch(url, { ...options, headers });
};
const supabase = createClient(SECURITY_SUPABASE_URL, SECURITY_SUPABASE_ANON_KEY, {
  global: { fetch: _securityFetch },
});

export { supabase };
