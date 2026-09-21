// src/modules/uniko-safer/saferSupabase.js
// Client Supabase DEDICADO do Uniko Safer — separado do projeto principal
// do Portal de propósito. Motivo: o Safer vai reter conversas por 3-4 anos
// com exportação semanal automática de todos os contatos, um volume e um
// tipo de dado (conversa de terceiros externos) bem diferente do resto do
// sistema (RH, ponto, jogos). Isolar evita que o crescimento desse arquivo
// dispute cota/desempenho com o resto do Portal.
//
// Ainda não existe um projeto Supabase próprio pra ele (decisão de plano
// pendente de aprovação). Enquanto SAFER_SUPABASE_URL/ANON_KEY estiverem
// vazios, cai de volta pro client compartilhado — o módulo funciona
// normalmente contra o projeto principal até a migração.
//
// Quando o projeto novo for criado: Supabase Dashboard → Settings → API,
// cole a URL e a chave "anon" (pública) aqui embaixo, e rode
// supabase_uniko_safer.sql nesse projeto novo.
import { createClient } from '@supabase/supabase-js';
import { supabase as sharedSupabase } from '../../contexts/user';

const SAFER_SUPABASE_URL = '';      // ex: https://xxxxxxxxxxxx.supabase.co
const SAFER_SUPABASE_ANON_KEY = ''; // chave "anon" (pública) do projeto dedicado

const supabase = (SAFER_SUPABASE_URL && SAFER_SUPABASE_ANON_KEY)
  ? createClient(SAFER_SUPABASE_URL, SAFER_SUPABASE_ANON_KEY)
  : sharedSupabase;

export { supabase };
