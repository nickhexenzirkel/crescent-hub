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

/* ── Foto de perfil enxuta (300x300 JPEG) ────────────────────────────────────
   Toda foto de perfil PRECISA passar por aqui antes de ser guardada. Sem isso o
   dataURL CRU do arquivo escolhido (foto de celular = vários MB) ia inteiro pro
   localStorage e, pela sincronização logo abaixo, pro Supabase: em produção uma
   chave `uniko_photo_<cpf>` chegou a 4,7MB e estourou sozinha a cota de ~5MB do
   navegador — daí em diante QUALQUER outra gravação falhava com
   QuotaExceededError (foi assim que a Coleção do Capture o Uniko parou de
   atualizar). 300x300 JPEG 0.88 é o mesmo formato que o modal de foto do Portal
   (TabInicio) já usava, e dá ~30KB. Recorte "cover" centralizado, igual ao
   preview redondo. Se algo falhar, devolve a original (nunca perde a foto). ── */
const PHOTO_MAX_CHARS = 300 * 1024; // acima disso é foto crua, não comprimida
const shrinkPhoto = (dataUrl) => new Promise((resolve) => {
  if (!dataUrl || typeof dataUrl !== 'string') return resolve(dataUrl);
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const SIZE = 300;
        const c = document.createElement('canvas');
        c.width = c.height = SIZE;
        const ctx = c.getContext('2d');
        const s = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        // PNG continua PNG: as fotos de perfil feitas a partir de um Uniko (Coleção /
        // Uniko Paint) têm fundo transparente, e JPEG não tem canal alfa — sairiam com
        // o fundo PRETO. Foto de câmera é JPEG e segue como JPEG, que comprime bem mais.
        const isPng = /^data:image\/png/i.test(dataUrl);
        resolve(isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  } catch { resolve(dataUrl); }
});

/* ── Faxina do cache de fotos ────────────────────────────────────────────────
   Encolhe, NO NAVEGADOR, qualquer `uniko_photo_*` que ainda esteja gravada crua.
   Não dá pra contar só com o loadUserPhoto pra isso: ele sobrescreve apenas a
   chave do usuário atual e apenas quando a foto vem do Supabase — chaves de
   outras sessões/formatos antigos (por nome em vez de CPF, outra pessoa que
   entrou nessa máquina) ficam órfãs ocupando MBs pra sempre, e é o conjunto
   delas que estoura a cota de ~5MB do navegador (limite do Chrome por site —
   nada a ver com o plano do Supabase). Encolher em vez de apagar: se a foto só
   existir aqui e ainda não tiver subido pro banco, ela não se perde. ── */
const compactPhotoCache = async () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('uniko_photo_'));
    for (const k of keys) {
      let val;
      try { val = localStorage.getItem(k); } catch { continue; }
      if (!val || val.length <= PHOTO_MAX_CHARS) continue;
      const small = await shrinkPhoto(val);
      try {
        // Encolher é assíncrono (decodifica a imagem): se nesse meio-tempo o
        // loadUserPhoto já gravou a foto boa vinda do banco nessa mesma chave,
        // não sobrescreve — senão a foto ANTIGA voltaria por cima da atual.
        if (localStorage.getItem(k) !== val) continue;
        if (small && small.length < val.length) localStorage.setItem(k, small);
        else localStorage.removeItem(k); // insalvável (não é imagem válida) — é só cache
      } catch {}
    }
  } catch {}
};

const loadUserPhoto = async () => {
  compactPhotoCache(); // best-effort, em paralelo — nunca segura o login
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
      // Foto antiga gravada CRUA (antes da compressão existir) — encolhe uma vez e
      // devolve pro banco já pequena, senão ela continuaria enchendo o localStorage
      // de todo mundo que a vê e trafegando MBs a cada abertura do Portal.
      if (data.photo.length > PHOTO_MAX_CHARS) {
        const small = await shrinkPhoto(data.photo);
        if (small && small.length < data.photo.length) {
          try { localStorage.setItem(dynKey, small); } catch {}
          try { await _supabase.from('profile_photos').upsert({ employee_name: name, photo: small, updated_at: new Date().toISOString() }); } catch {}
          return small;
        }
      }
      try { localStorage.setItem(dynKey, data.photo); } catch {}
      return data.photo;
    }
  } catch {}
  // Foto não está no Supabase — pega do cache local e sincroniza para que outros possam ver.
  // Passa pelo shrinkPhoto se for crua: era por AQUI que a foto gigante do onboarding
  // (só local) acabava virando uma linha de vários MB em profile_photos.
  let cached = localStorage.getItem(dynKey) || null;
  if (cached && cached.length > PHOTO_MAX_CHARS) {
    const small = await shrinkPhoto(cached);
    if (small && small.length < cached.length) {
      cached = small;
      try { localStorage.setItem(dynKey, small); } catch {}
    }
  }
  if (cached) {
    const photo = cached;
    (async () => { try { await _supabase.from('profile_photos').upsert({ employee_name: name, photo, updated_at: new Date().toISOString() }); } catch {} })();
  }
  return cached;
};

const saveUserPhoto = async (base64) => {
  const _auth = getAuthUser();
  const name = _auth?.name || USER.name;
  const dynKey = _auth?.cpf ? `uniko_photo_${_auth.cpf}` : `uniko_photo_${name}`;
  // Rede de segurança pra QUALQUER caminho que salve foto (Portal, Coleção, Paint,
  // onboarding): o que já vem comprimido passa direto (fica abaixo do limite).
  const photo = base64 && base64.length > PHOTO_MAX_CHARS ? await shrinkPhoto(base64) : base64;
  try { localStorage.setItem(dynKey, photo); } catch {}
  try { await _supabase.from('profile_photos').upsert({ employee_name: name, photo, updated_at: new Date().toISOString() }); } catch {}
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
  shrinkPhoto,
  compactPhotoCache,
  fetchPhotoByName,
  isProfileComplete,
  podeConexaoSetorial,
};
