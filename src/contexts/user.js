import { createClient as _createSupabaseClient } from '@supabase/supabase-js';

// ─── FESTIVAL INTEGRATION ────────────────────────────────────────────────────
// Padrão = backend de produção na VPS (HTTPS). Pra dev local com backend na
// própria máquina, crie um .env.local com VITE_SERVER_URL=http://localhost:3001
const SERVER_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) || 'https://api.centraluniko.com.br';
const SUPABASE_URL = 'https://iqsufxvuufkaswellisy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc3VmeHZ1dWZrYXN3ZWxsaXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTQ5MzUsImV4cCI6MjA5NTY3MDkzNX0.Cl6h-HM_RK0In5UTn2Hc-mhPQ2p8iOsG23EYfG8PX4c';
const _supabase  = _createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Decodifica o payload (base64url) do JWT preservando UTF-8.
// `atob` devolve uma string binária (latin1); ler os bytes como UTF-8 evita
// que acentos virem mojibake (ex.: "Lourenço" → "LourenÃ§o").
function decodeJwtPayload(token) {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

function getAuthUser() {
  try {
    const token = localStorage.getItem('ch_token');
    if (!token) return null;
    return decodeJwtPayload(token);
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

/* ── Foto de perfil — salva no Supabase e cache no localStorage ── */
const _photoAuth = getAuthUser();
const PHOTO_KEY  = _photoAuth?.cpf
  ? `uniko_photo_${_photoAuth.cpf}`
  : (_photoAuth?.name ? `uniko_photo_${_photoAuth.name}` : 'uniko_photo');

const getUserPhotoFromCache = () => {
  try { return localStorage.getItem(PHOTO_KEY) || null; } catch { return null; }
};

const loadUserPhoto = async () => {
  // Lê o token atual (pode ter sido salvo após o carregamento do módulo)
  const _auth = getAuthUser();
  const name = _auth?.name || USER.name;
  if (!name || name === 'Colaborador') return null;
  const dynKey = _auth?.cpf ? `uniko_photo_${_auth.cpf}` : `uniko_photo_${name}`;
  try {
    const { data } = await _supabase.from('profile_photos').select('photo').eq('employee_name', name).maybeSingle();
    // O cache local é só conveniência: a foto vem do Supabase de qualquer jeito.
    // Sem o try, uma foto grande com o localStorage cheio derrubava o login.
    if (data?.photo) {
      try { localStorage.setItem(dynKey, data.photo); } catch {}
      return data.photo;
    }
  } catch {}
  // Foto não está no Supabase — pega do cache local e sincroniza para que outros possam ver
  const cached = localStorage.getItem(dynKey) || null;
  if (cached) {
    (async () => { try { await _supabase.from('profile_photos').upsert({ employee_name: name, photo: cached, updated_at: new Date().toISOString() }); } catch {} })();
  }
  return cached;
};

const saveUserPhoto = async (base64) => {
  const _auth = getAuthUser();
  const name = _auth?.name || USER.name;
  const dynKey = _auth?.cpf ? `uniko_photo_${_auth.cpf}` : `uniko_photo_${name}`;
  try { localStorage.setItem(dynKey, base64); } catch {}
  try { await _supabase.from('profile_photos').upsert({ employee_name: name, photo: base64, updated_at: new Date().toISOString() }); } catch {}
};

const fetchPhotoByName = async (name) => {
  try {
    const { data } = await _supabase.from('profile_photos').select('photo').eq('employee_name', name).maybeSingle();
    return data?.photo || null;
  } catch { return null; }
};

const isProfileComplete = () => {
  const needed = [USER.email, USER.phone, USER.street, USER.district, USER.cep, USER.city, USER.state];
  return needed.every(f => f && f !== '—' && String(f).trim() !== '');
};

// Conexão Setorial é liberada pra todo mundo (era restrita a admins + uma
// lista de CPFs — pedido do usuário pra abrir geral). Mantida como função
// (em vez de simplesmente remover as checagens nos 3 lugares que chamam)
// pra não precisar tocar em ModuleSelector/App.jsx de novo se um dia quiserem
// voltar a restringir — só mudaria aqui.
const podeConexaoSetorial = () => true;

export {
  SERVER_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  _supabase as supabase,
  getAuthUser,
  USER,
  SALARY_HISTORY,
  COMUNICADOS_DATA,
  NOTIFS_DATA,
  TEAM_DATA,
  EVENTS,
  RANK,
  PHOTO_KEY,
  getUserPhotoFromCache,
  loadUserPhoto,
  saveUserPhoto,
  fetchPhotoByName,
  isProfileComplete,
  podeConexaoSetorial,
};
