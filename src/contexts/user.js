import { createClient as _createSupabaseClient } from '@supabase/supabase-js';

// ─── FESTIVAL INTEGRATION ────────────────────────────────────────────────────
const SERVER_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) || 'http://localhost:3001';
const _supabase  = _createSupabaseClient(
  'https://sifcxfymkmlmbelzolbx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpZmN4Znlta21sbWJlbHpvbGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjQ1NzYsImV4cCI6MjA5NTQwMDU3Nn0.YvMr2aAqfmyBMKky94YfvVSpCurzlet5tZlv4WfCvRA'
);

function getAuthUser() {
  try {
    const token = localStorage.getItem('ch_token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return null; }
}

let USER = {
  name:'Colaborador', short:'Colaborador', role:'Colaborador', avatar:'CO',
  cpf:'***.***.***-**', rg:'—', birth:'—',
  email:'—', phone:'—',
  street:'—', district:'—', cep:'—',
  city:'—', state:'CE', category:'CLT', cargo:'Colaborador',
  admission:'—', dependents:0, horasMes:'160h',
  salary:0, inss:0, ir:0, vt:0, va:0, hours:0,
  trophies:[],
};

// Atualiza USER com dados reais do token ao carregar a página
try {
  const _auth = getAuthUser();
  if (_auth) {
    USER.name   = _auth.name;
    USER.short  = _auth.name.split(' ')[0];
    USER.avatar = _auth.name.split(' ').map(n => n[0]).slice(0, 2).join('');
    USER.cpf    = _auth.cpf
      ? _auth.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-**')
      : '***.***.***-**';
  }
} catch {}
/* ── MOCK DATA — novas features ── */
// Histórico salarial agora vem do banco — sem mock
const SALARY_HISTORY = [];

// Comunicados e notificações agora vêm do banco — sem mock
const COMUNICADOS_DATA = [];
const NOTIFS_DATA = [];

// Dados de equipe, eventos e ranking agora vêm do Supabase — sem mock
const TEAM_DATA = [];
const EVENTS    = [];
const RANK      = [];

export {
  SERVER_URL,
  _supabase as supabase,
  getAuthUser,
  USER,
  SALARY_HISTORY,
  COMUNICADOS_DATA,
  NOTIFS_DATA,
  TEAM_DATA,
  EVENTS,
  RANK,
};
