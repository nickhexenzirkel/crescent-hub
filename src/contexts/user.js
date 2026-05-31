import { createClient as _createSupabaseClient } from '@supabase/supabase-js';

// ─── FESTIVAL INTEGRATION ────────────────────────────────────────────────────
const SERVER_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) || 'http://localhost:3001';
const _supabase  = _createSupabaseClient(
  'https://iqsufxvuufkaswellisy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxc3VmeHZ1dWZrYXN3ZWxsaXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTQ5MzUsImV4cCI6MjA5NTY3MDkzNX0.Cl6h-HM_RK0In5UTn2Hc-mhPQ2p8iOsG23EYfG8PX4c'
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

/* ── Foto de perfil — salva no Supabase e cache no localStorage ── */
const _photoAuth = getAuthUser();
const PHOTO_KEY  = _photoAuth?.cpf
  ? `uniko_photo_${_photoAuth.cpf}`
  : (_photoAuth?.name ? `uniko_photo_${_photoAuth.name}` : 'uniko_photo');

const getUserPhotoFromCache = () => {
  try { return localStorage.getItem(PHOTO_KEY) || null; } catch { return null; }
};

const loadUserPhoto = async () => {
  if (!USER.name || USER.name === 'Colaborador') return null;
  try {
    const { data } = await _supabase.from('profile_photos').select('photo').eq('employee_name', USER.name).single();
    if (data?.photo) { localStorage.setItem(PHOTO_KEY, data.photo); return data.photo; }
  } catch {}
  return getUserPhotoFromCache();
};

const saveUserPhoto = async (base64) => {
  try { localStorage.setItem(PHOTO_KEY, base64); } catch {}
  try { await _supabase.from('profile_photos').upsert({ employee_name: USER.name, photo: base64, updated_at: new Date().toISOString() }); } catch {}
};

const fetchPhotoByName = async (name) => {
  try {
    const { data } = await _supabase.from('profile_photos').select('photo').eq('employee_name', name).maybeSingle();
    return data?.photo || null;
  } catch { return null; }
};

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
  PHOTO_KEY,
  getUserPhotoFromCache,
  loadUserPhoto,
  saveUserPhoto,
  fetchPhotoByName,
};
