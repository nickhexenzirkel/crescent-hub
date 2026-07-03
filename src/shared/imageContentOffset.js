// src/shared/imageContentOffset.js
// Uploads da Oficina de Uniko às vezes têm o desenho fora do centro do canvas
// (moldura/arte com padding transparente assimétrico) — o que faz o personagem
// aparecer "puxado" pra um canto dentro do card, mesmo com o card centralizando
// a imagem via flexbox. Aqui a gente lê o canal alfa, acha a caixa do conteúdo
// visível e devolve o deslocamento (fração do tamanho da imagem) necessário pra
// recentralizar. Resultado cacheado por URL — só precisa calcular uma vez.
const _cache = new Map();
const ALPHA_MIN = 10; // ignora ruído quase-transparente nas bordas

export function getContentOffset(src) {
  if (!src) return Promise.resolve(null);
  if (_cache.has(src)) return _cache.get(src);

  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, w, h);

        // Amostra em passos (não precisa ler pixel a pixel em imagens grandes)
        const strideX = Math.max(1, Math.floor(w / 400));
        const strideY = Math.max(1, Math.floor(h / 400));
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y += strideY) {
          const row = y * w;
          for (let x = 0; x < w; x += strideX) {
            if (data[(row + x) * 4 + 3] > ALPHA_MIN) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < minX || maxY < minY) { resolve(null); return; }

        const bboxCx = (minX + maxX) / 2, bboxCy = (minY + maxY) / 2;
        const dxFrac = (w / 2 - bboxCx) / w;
        const dyFrac = (h / 2 - bboxCy) / h;
        // Deslocamento desprezível — não vale a pena aplicar transform nenhum
        if (Math.abs(dxFrac) < 0.01 && Math.abs(dyFrac) < 0.01) { resolve(null); return; }
        resolve({ dxFrac, dyFrac });
      } catch {
        resolve(null); // canvas "tainted" (CORS) ou outro erro — segue sem correção
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  _cache.set(src, p);
  return p;
}
