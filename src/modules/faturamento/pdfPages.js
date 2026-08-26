/* ════════════════════════════════════════════════════════════════
   Base compartilhada pelas ferramentas de página de PDF (Editor de PDF e
   Organizar PDF): carregar documento, medir páginas, cache de miniaturas e
   o observador que diz o que está na tela.
   Só funções — os componentes ficam em pdfPagesUI.jsx.
════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const loadPdfDoc = (bytes) => pdfjsLib.getDocument({ data: bytes }).promise;

/* keyframes do "carregando" das miniaturas — injetado uma vez por sessão */
if (typeof document !== 'undefined' && !document.getElementById('pdf-pages-css')) {
  const _st = document.createElement('style');
  _st.id = 'pdf-pages-css';
  _st.textContent = '@keyframes pdfShimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}';
  document.head.appendChild(_st);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* ════════════════════════════════════════════════════════════════
   Miniaturas — cache + fila global
   Um PDF de 300 páginas tem 300 miniaturas. Renderizar todas de uma vez (um
   <canvas> vivo por página, como era antes) trava a aba por dezenas de
   segundos e segura centenas de MB de memória de vídeo. Agora cada miniatura:
     1) só é pedida quando entra (ou está quase entrando) na tela;
     2) passa por uma fila que desenha no máximo 2 páginas por vez;
     3) vira um JPEG (data URL) guardado em cache — reordenar/arrastar depois
        é só trocar um <img> de lugar, sem re-renderizar nada.
════════════════════════════════════════════════════════════════ */
const THUMB_W   = 170;   // largura do JPEG da miniatura
const THUMB_MAX = 700;   // teto do cache (JPEG pequeno: poucos MB no total)
export const thumbCache = new Map();   // `${poolId}:${ref}` → dataURL
let _poolSeq = 0;
/* cada PDF aberto ganha um "pool" novo — é o que separa as miniaturas de um
   documento das do anterior dentro do mesmo cache */
export const novoPoolId = () => ++_poolSeq;
const _thumbQ = [];
let _thumbRunning = 0;

const _drawThumb = async (job) => {
  const page = await job.pdf.getPage(job.ref + 1);
  const base = page.getViewport({ scale: 1 });
  const vp   = page.getViewport({ scale: THUMB_W / base.width });
  const cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.round(vp.width));
  cv.height = Math.max(1, Math.round(vp.height));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);  // JPEG não tem transparência
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const url = cv.toDataURL('image/jpeg', 0.72);
  cv.width = cv.height = 0;   // devolve a memória do canvas na hora
  if (thumbCache.size >= THUMB_MAX) thumbCache.delete(thumbCache.keys().next().value);
  thumbCache.set(job.key, url);
  return url;
};

const _pumpThumbs = () => {
  while (_thumbRunning < 2 && _thumbQ.length) {
    // LIFO: o último pedido é o que o usuário está olhando AGORA (ele rolou
    // até lá). Atender por ordem de chegada deixaria a tela em branco enquanto
    // a fila desenha páginas que já saíram de vista.
    const job = _thumbQ.pop();
    if (job.cancelled) { job.resolve(null); continue; }
    _thumbRunning++;
    _drawThumb(job).then(job.resolve, () => job.resolve(null))
      .then(() => { _thumbRunning--; _pumpThumbs(); });
  }
};

export const requestThumb = (pdf, poolId, ref) => {
  const key = poolId + ':' + ref;
  const hit = thumbCache.get(key);
  if (hit) return { promise: Promise.resolve(hit), cancel: () => {} };
  const job = { pdf, ref, key, cancelled: false, resolve: null };
  const promise = new Promise(res => { job.resolve = res; });
  _thumbQ.push(job);
  _pumpThumbs();
  return { promise, cancel: () => { job.cancelled = true; } };
};

export const limparThumbs = (poolId) => {
  const pre = poolId + ':';
  for (const k of [...thumbCache.keys()]) if (k.startsWith(pre)) thumbCache.delete(k);
};

/* Só monta/renderiza o que está (ou está perto de estar) na tela.
   UM observer por (container, margem) em vez de um por elemento: num PDF de
   centenas de páginas seriam centenas de IntersectionObserver vivos ao mesmo
   tempo, cada um com seu próprio custo de bookkeeping. */
const _ioPorRoot = new WeakMap();   // elemento que rola → Map<margem, entrada>
let _ioDaJanela = null;             // idem, pra quando o root é a viewport

const _getIO = (root, rootMargin) => {
  let porMargem;
  if (root) {
    porMargem = _ioPorRoot.get(root);
    if (!porMargem) { porMargem = new Map(); _ioPorRoot.set(root, porMargem); }
  } else {
    porMargem = _ioDaJanela || (_ioDaJanela = new Map());
  }
  let entrada = porMargem.get(rootMargin);
  if (!entrada) {
    const cbs = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const cb = cbs.get(e.target);
        if (cb) cb(e.isIntersecting);
      }
    }, { root: root || null, rootMargin });
    entrada = { io, cbs };
    porMargem.set(rootMargin, entrada);
  }
  return entrada;
};

export const useInView = (root, rootMargin = '600px 0px') => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') { setInView(true); return; }
    const { io, cbs } = _getIO(root, rootMargin);
    cbs.set(el, setInView);
    io.observe(el);
    return () => { cbs.delete(el); io.unobserve(el); };
  }, [root, rootMargin]);
  return [ref, inView];
};

/* Dimensões de todas as páginas (a partir de `from`). É o mínimo necessário
   pra montar o editor — e o único trabalho feito na ABERTURA do arquivo.
   Em blocos, porque 1 `await` por página num PDF grande é tempo jogado fora. */
export const readPageSizes = async (doc, from = 0) => {
  const out = [];
  const BLOCO = 16;
  for (let i = from; i < doc.numPages; i += BLOCO) {
    const fim = Math.min(doc.numPages, i + BLOCO);
    const lote = [];
    for (let j = i; j < fim; j++) lote.push(doc.getPage(j + 1));
    for (const page of await Promise.all(lote)) {
      const vp = page.getViewport({ scale: 1 });
      out.push({ w: vp.width, h: vp.height });
    }
  }
  return out;
};

/* Nova ordem depois de mover um bloco de páginas pra posição `destino` da
   lista ATUAL. Puro de propósito: é a mesma conta usada pelo arraste na
   grade do organizador e na tirinha de miniaturas do editor. */
export const reordenarPaginas = (atual, ids, destino) => {
  const alvo = new Set(ids);
  const bloco = atual.filter(p => alvo.has(p.id));
  if (!bloco.length) return atual;
  const restante = atual.filter(p => !alvo.has(p.id));
  // `destino` conta com o bloco ainda no lugar → desconta o que ficou pra trás
  const antes = atual.slice(0, clamp(destino, 0, atual.length)).filter(p => alvo.has(p.id)).length;
  const pos = clamp(destino - antes, 0, restante.length);
  const novo = [...restante.slice(0, pos), ...bloco, ...restante.slice(pos)];
  return novo.every((p, i) => p === atual[i]) ? atual : novo;
};
