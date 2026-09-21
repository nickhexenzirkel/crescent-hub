// src/modules/uniko-safer/saferSupabase.js
// Client Supabase DEDICADO do Uniko Safer — separado do projeto principal
// do Portal de propósito. Motivo: o Safer vai reter conversas por 3-4 anos
// com exportação semanal automática de todos os contatos, um volume e um
// tipo de dado (conversa de terceiros externos) bem diferente do resto do
// sistema (RH, ponto, jogos). Isolar evita que o crescimento desse arquivo
// dispute cota/desempenho com o resto do Portal.
//
// Projeto dedicado (plano Micro) — ver Settings → API do projeto no
// dashboard da Supabase. Só a chave "anon" (pública) vai aqui — o módulo
// não usa nem precisa da service_role/secret key pra nada (todo o controle
// de acesso é RLS + gating de admin/moderador no cliente, mesmo padrão do
// resto do Portal).
import { createClient } from '@supabase/supabase-js';

const SAFER_SUPABASE_URL = 'https://npfgggoavzzyzcjjachi.supabase.co';
const SAFER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmdnZ29hdnp6eXpjamphY2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDEwNzgsImV4cCI6MjEwNTU3NzA3OH0.XUexLOmbg7zKknw_xx7pTegi7uoAHQ_gKI6_She3RZA';

const supabase = createClient(SAFER_SUPABASE_URL, SAFER_SUPABASE_ANON_KEY);

export { supabase };
