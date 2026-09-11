/* ══════════════════════════════════════════════════════════════════════════
   BOLHAS DO FUNDO — degradês que imitam desfoque sem custar por frame
   Usado pelo lava lamp global (shared/components.jsx) e pelo fundo do
   Festival na Central Alexa.
══════════════════════════════════════════════════════════════════════════ */
/* ── Por que este fundo NÃO usa mais filter: blur() ────────────────────────
   Até set/2026 cada bolha era um degradê duro levando `filter: blur(78px)`.
   O visual era o certo, mas o preço era absurdo: são 8 bolhas de 40-58vw
   (~1000px cada) animadas em laço infinito, e o navegador tem que refazer
   esse desfoque de raio 78 A CADA FRAME, na tela inteira — mais ainda porque
   há ~180 elementos com backdrop-filter por cima, e cada um deles precisa
   reamostrar esse fundo que nunca para de mudar. Medido com o diagnóstico
   (Ctrl+Alt+P, tecla 2): 6 fps com o fundo ligado, 144 fps sem ele.

   A saída é que o desfoque aqui nunca foi necessário: uma bolha borrada é
   só um degradê radial com queda suave, e degradê o GPU pinta de graça.
   Então a gaussiana que o blur calculava a cada frame virou uma curva de
   sino amostrada em 9 paradas, escrita direto no degradê. Mesmo visual,
   custo de desenho perto de zero.

   comAlfa multiplica a transparência de uma cor; é o que permite desenhar a
   queda da curva. Aceita os formatos que circulam no projeto: 'rgba(...)' e
   'rgb(...)' (paleta dos temas), '#RRGGBB', '#RGB' e '#RRGGBBAA' (as cores
   tiradas da capa do álbum na Central Alexa vêm com o alfa colado no fim). */
export const comAlfa = (cor, f) => {
  const txt = String(cor).trim();
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(txt);
  if (rgba) {
    const p = rgba[1].split(',').map(s => s.trim());
    const a = p.length > 3 ? parseFloat(p[3]) : 1;
    return `rgba(${p[0]},${p[1]},${p[2]},${+(a * f).toFixed(3)})`;
  }
  const hex = /^#([0-9a-f]{3,8})$/i.exec(txt);
  if (hex) {
    let d = hex[1];
    if (d.length === 3 || d.length === 4) d = d.split('').map(c => c + c).join('');
    if (d.length === 6 || d.length === 8) {
      const a = d.length === 8 ? parseInt(d.slice(6, 8), 16) / 255 : 1;
      const n = parseInt(d.slice(0, 6), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${+(a * f).toFixed(3)})`;
    }
  }
  return cor; // formato inesperado — devolve como veio, sem quebrar o tema
};

/* Curva de sino (gaussiana com σ≈0,35) amostrada em 9 paradas. As posições
   param em 82% pra a bolha ocupar o mesmo tamanho aparente que ocupava com
   o degradê de 62% + os ~78px que o blur espalhava pra fora.
   A última parada é a própria cor com alfa 0, e não a palavra `transparent`:
   `transparent` é preto transparente, e degradê até ele suja a borda de
   cinza nos temas claros. */
const QUEDA_BOLHA = [[0,1],[10,.94],[20,.78],[31,.55],[41,.36],[51,.21],[61,.10],[72,.04],[82,0]];
export const bolhaGradiente = (cor, forma = 'circle') =>
  `radial-gradient(${forma} at 50% 50%, ${QUEDA_BOLHA.map(([pos, a]) => `${comAlfa(cor, a)} ${pos}%`).join(', ')})`;

/* ── Paleta do fundo ───────────────────────────────────────────────────────
   O tema entrega 7 cores de bolha (b1..b7) e 3 de apoio (sb1..sb3). Rodando
   só essas 7 em 10+ bolhas, metade delas sai repetida e o fundo lê como uma
   mancha só. Aqui elas viram uma escala maior: além das originais, entram as
   misturas entre vizinhas — a mesma família de cor, em degraus intermediários
   que o tema não traz prontos. Dá variedade sem inventar cor que não pertence
   ao tema. */
const paraRgb = (cor) => {
  const t = comAlfa(cor, 1);                        // normaliza pra rgba(...)
  const m = /^rgba?\(([^)]+)\)$/i.exec(String(t).trim());
  if (!m) return null;
  const p = m[1].split(',').map(s => parseFloat(s.trim()));
  return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
};

/* Mistura duas cores do tema (t=0 devolve a primeira, t=1 a segunda). */
export const misturar = (c1, c2, t = 0.5) => {
  const a = paraRgb(c1), b = paraRgb(c2);
  if (!a || !b) return c1;
  const m = (x, y) => Math.round(x + (y - x) * t);
  // o alfa original de cada cor do tema se perde na normalização acima, então
  // remonta a partir das cores cruas
  const alfaDe = (cor) => { const r = /^rgba\(([^)]+)\)$/i.exec(String(cor).trim());
    if (r) { const p = r[1].split(','); return p.length > 3 ? parseFloat(p[3]) : 1; }
    const h = /^#([0-9a-f]{8})$/i.exec(String(cor).trim());
    return h ? parseInt(h[1].slice(6, 8), 16) / 255 : 1; };
  const al = alfaDe(c1) + (alfaDe(c2) - alfaDe(c1)) * t;
  return `rgba(${m(a.r, b.r)},${m(a.g, b.g)},${m(a.b, b.b)},${+al.toFixed(3)})`;
};

/* 13 tons a partir das cores de bolha do tema: as 7 originais intercaladas
   com as misturas das vizinhas. A ordem alterna escuro/claro de propósito —
   bolhas vizinhas no anel não podem cair com o mesmo tom. */
export const paletaDeBolhas = (T) => {
  const b = [T.b1, T.b2, T.b3, T.b4, T.b5, T.b6, T.b7].filter(Boolean);
  if (!b.length) return ['rgba(120,120,160,0.5)'];
  const escala = [];
  for (let i = 0; i < b.length; i++) {
    escala.push(b[i]);
    escala.push(misturar(b[i], b[(i + 1) % b.length], 0.5));
  }
  // intercala a metade de cima com a de baixo pra não sair em degradê ordenado
  const meio = Math.ceil(escala.length / 2), fora = [];
  for (let i = 0; i < meio; i++) {
    fora.push(escala[i]);
    if (escala[i + meio]) fora.push(escala[i + meio]);
  }
  return fora;
};
