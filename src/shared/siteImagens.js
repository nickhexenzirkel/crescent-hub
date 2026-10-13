// "Imagens do Site": o admin troca uma imagem do Uniko pela tela (Dashboard RH → Imagens do Site)
// e ela muda pra TODO MUNDO, sem mexer em código nem esperar deploy. Como funciona:
//  • tabela uniko_site_imagens: { path: "/UNIKO_NEW.png", url: "<imagem nova no Storage>" };
//  • ao abrir o site, o mapa vem do cache local (instantâneo) e é atualizado do Supabase em
//    seguida (a cada 3 min e ao voltar pra aba);
//  • todo <img> cujo src seja um desses caminhos recebe a imagem nova (ver siteImagensCore.js).
// Só vale pra imagens que estão em /public (ex.: /UNIKO_NEW.png) — as que o código importa de
// src/assets ganham um nome com hash no build e não têm caminho estável.
// SQL: supabase_site_imagens.sql (projeto PRINCIPAL).
import { supabase } from '../contexts/user';
import { criarReescritor, instalarGanchos, reaplicar } from './siteImagensCore';

const CACHE_KEY = 'uniko_site_imagens_v1';
const BUCKET = 'site-imagens';

/* Imagens que o painel oferece (todas em /public). `dica` aparece na tela. */
export const SLOTS = [
  { path: '/UNIKO_NEW.png',          label: 'Mascote do Uniko', onde: 'Tela inicial, Portal, jogos, perfil, convites', dica: 'PNG com fundo transparente, de preferência quadrado' },
  { path: '/UNIKO_LOGO.png',         label: 'Logo quadrada do Uniko', onde: 'Barras laterais e topos dos módulos', dica: 'Quadrada, o mascote enche o quadrado' },
  { path: '/UNIKO_ASSIST.png',       label: 'Uniko Assistente', onde: 'Robô flutuante do assistente', dica: 'PNG transparente' },
  { path: '/UNIKO_ALEXA.png',        label: 'Uniko Alexa', onde: 'Central Alexa', dica: 'PNG transparente' },
  { path: '/UNIKO_CALL.png',         label: 'Uniko Call', onde: 'Módulo Uniko Call', dica: 'PNG transparente' },
  { path: '/UNIKO_CAPTURAR.png',     label: 'Uniko Capturar', onde: 'Capture o Uniko', dica: 'PNG transparente' },
  { path: '/uniko-paint.png',        label: 'Uniko Paint', onde: 'Card do Uniko Paint', dica: 'PNG' },
  { path: '/uniko-palavras.png',     label: 'Uniko Palavras', onde: 'Card do Uniko Palavras', dica: 'PNG' },
  { path: '/uniko-speed.png',        label: 'Uniko Speed', onde: 'Card do Uniko Speed', dica: 'PNG' },
  { path: '/PrismaComum.png',        label: 'Prisma comum', onde: 'Prisma Store e carteira', dica: 'PNG transparente' },
  { path: '/PrismaPremium.png',      label: 'Prisma premium', onde: 'Prisma Store e carteira', dica: 'PNG transparente' },
];

let mapa = {};
let setAttrNativo = null;
const reescrever = criarReescritor(() => mapa, typeof location !== 'undefined' ? location.href : 'http://localhost/');

const lerCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { return {}; } };

export const imagemAtual = (path) => mapa[path] || null;

/** Busca o mapa no Supabase (e reaplica na tela se mudou). Devolve as linhas (pro painel). */
export async function carregarSiteImagens() {
  try {
    const { data, error } = await supabase.from('uniko_site_imagens').select('path,url,label,updated_at,updated_by');
    if (error || !Array.isArray(data)) return null;
    const novo = {};
    data.forEach(r => { if (r.path && r.url) novo[r.path] = r.url; });
    const mudou = JSON.stringify(novo) !== JSON.stringify(mapa);
    mapa = novo;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(novo)); } catch { /* sem storage */ }
    if (mudou && setAttrNativo && typeof document !== 'undefined') reaplicar(document.querySelectorAll('img'), reescrever, setAttrNativo);
    return data;
  } catch { return null; }
}

/** Chamar UMA vez, antes do React montar (main.jsx). */
export function iniciarSiteImagens() {
  if (typeof window === 'undefined') return;
  mapa = lerCache();
  const nativo = instalarGanchos({ HTMLImageElement: window.HTMLImageElement, Element: window.Element }, reescrever);
  if (nativo) setAttrNativo = nativo;
  carregarSiteImagens();
  setInterval(carregarSiteImagens, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregarSiteImagens(); });
}

/* ── Admin: enviar / restaurar ─────────────────────────────────────────────── */

const MAX_LADO = 1400;          // px — maior que isso é reduzido (o mascote não precisa de mais)
const MAX_BYTES = 3 * 1024 * 1024;

// Reduz a imagem (mantendo transparência) e devolve { blob, ext }. GIF vai como está.
async function prepararImagem(file) {
  if (!/^image\//.test(file.type)) throw new Error('O arquivo precisa ser uma imagem (PNG, JPG, WebP ou GIF).');
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('GIF grande demais (máx. 3 MB).');
    return { blob: file, ext: 'gif' };
  }
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * escala)), h = Math.max(1, Math.round(bmp.height * escala));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const paraBlob = (tipo, q) => new Promise(res => cv.toBlob(res, tipo, q));
  let blob = await paraBlob('image/png'), ext = 'png';
  if (blob && blob.size > MAX_BYTES) { blob = await paraBlob('image/webp', 0.9); ext = 'webp'; }   // webp mantém transparência e pesa menos
  if (!blob) throw new Error('Não consegui processar essa imagem.');
  if (blob.size > MAX_BYTES) throw new Error('Imagem pesada demais mesmo reduzida (máx. 3 MB).');
  return { blob, ext };
}

export async function salvarSiteImagem(path, file, { label, usuario } = {}) {
  if (!path || !path.startsWith('/')) throw new Error('Caminho inválido (precisa começar com /).');
  const { blob, ext } = await prepararImagem(file);
  const nome = `${path.replace(/^\//, '').replace(/[^a-zA-Z0-9_-]+/g, '-')}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(nome, blob, { contentType: blob.type || 'image/png', upsert: false });
  if (up.error) throw new Error(up.error.message.includes('not found') ? 'O armazenamento "site-imagens" não existe — rode supabase_site_imagens.sql no Supabase principal.' : up.error.message);
  const url = supabase.storage.from(BUCKET).getPublicUrl(nome).data.publicUrl;
  const { data: antes } = await supabase.from('uniko_site_imagens').select('url').eq('path', path).maybeSingle();
  const { error } = await supabase.from('uniko_site_imagens').upsert({ path, url, label: label || null, updated_by: usuario || null, updated_at: new Date().toISOString() }, { onConflict: 'path' });
  if (error) throw new Error(error.message);
  await apagarArquivo(antes?.url);          // não deixa lixo no Storage
  await carregarSiteImagens();
  return url;
}

export async function restaurarSiteImagem(path) {
  const { data: antes } = await supabase.from('uniko_site_imagens').select('url').eq('path', path).maybeSingle();
  const { error } = await supabase.from('uniko_site_imagens').delete().eq('path', path);
  if (error) throw new Error(error.message);
  await apagarArquivo(antes?.url);
  await carregarSiteImagens();
}

async function apagarArquivo(url) {
  const i = url ? url.indexOf(`/${BUCKET}/`) : -1;
  if (i === -1) return;
  try { await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + BUCKET.length + 2).split('?')[0])]); } catch { /* sem problema */ }
}
