// src/modules/uniko-call/callSupabase.js
// Client Supabase do Uniko Call — MESMO projeto dedicado do Uniko Safer/
// Security (ver supabase_uniko_call.sql: reaproveita jwt_claims()/
// current_role_uniko() já configurados ali). Tabelas próprias
// (uniko_call_*), sem risco de misturar dado com Safer/Security.
import { createClient } from '@supabase/supabase-js';

const SECURITY_SUPABASE_URL = 'https://npfgggoavzzyzcjjachi.supabase.co';
const SECURITY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmdnZ29hdnp6eXpjamphY2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDEwNzgsImV4cCI6MjEwNTU3NzA3OH0.XUexLOmbg7zKknw_xx7pTegi7uoAHQ_gKI6_She3RZA';

// Mesmo padrão de securitySupabase.js: manda o ch_token no cabeçalho
// x-ch-auth pra RLS poder checar admin de verdade.
const _callFetch = (url, options = {}) => {
  const token = localStorage.getItem('ch_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('x-ch-auth', token);
  return fetch(url, { ...options, headers });
};
const supabase = createClient(SECURITY_SUPABASE_URL, SECURITY_SUPABASE_ANON_KEY, {
  global: { fetch: _callFetch },
});

export { supabase };
