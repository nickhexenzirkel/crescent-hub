// src/shared/imageContentOffset.js
// Uploads da Oficina de Uniko às vezes têm o desenho fora do centro do canvas
// (moldura/arte com padding transparente assimétrico, ou detalhes decorativos
// finos — corrente, laço — que se estendem bem mais pra um lado que pro outro).
// Aqui a gente lê o canal alfa e calcula o CENTROIDE ponderado por opacidade
// (não a bounding box): cada pixel "puxa" o centro na proporção da sua opacidade,
// então um detalhe fino e comprido pesa pouco perto do corpo denso do desenho —
// bem mais parecido com onde um humano diria que é "o centro" da arte. Devolve
// o deslocamento (fração do tamanho da imagem) necessário pra recentralizar.
// Resultado cacheado por URL — só precisa calcular uma vez.
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
        let sumA = 0, sumAX = 0, sumAY = 0;
        for (let y = 0; y < h; y += strideY) {
          const row = y * w;
          for (let x = 0; x < w; x += strideX) {
            const a = data[(row + x) * 4 + 3];
            if (a > ALPHA_MIN) { sumA += a; sumAX += a * x; sumAY += a * y; }
          }
        }
        if (sumA <= 0) { resolve(null); return; }

        const centroidX = sumAX / sumA, centroidY = sumAY / sumA;
        const dxFrac = (w / 2 - centroidX) / w;
        const dyFrac = (h / 2 - centroidY) / h;
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
