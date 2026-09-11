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

/* Curva de sino (gaussiana) amostrada em 13 paradas — é o perfil que um
   desfoque de verdade produz, só que calculado uma vez na hora de pintar em
   vez de a cada frame (ver o bloco acima pro histórico).

   Duas escolhas que decidem se a bolha lê como MANCHA ou como CÍRCULO:

   • o pico vai a 0,6 do alfa da cor, não a 1. Um blur real não só espalha a
     mancha, ele REBAIXA o centro (a média puxa o miolo brilhante pra baixo
     junto com a vizinhança transparente). Mantendo o alfa cheio no centro, a
     bolha ganhava um miolo sólido e o olho fechava o contorno em volta dele
     — foi o que fez as formas ficarem visíveis demais;
   • a cauda vai até 92% em 13 degraus. Terminar cedo (ou em poucos degraus)
     deixa a borda perceptível e faz aparecer faixa.

   A última parada é a própria cor com alfa 0, e não a palavra `transparent`:
   `transparent` é preto transparente, e degradê até ele suja a borda de
   cinza nos temas claros. */
const QUEDA_BOLHA = [
  [0, 0.600], [8, 0.586], [15, 0.545], [23, 0.483], [31, 0.408], [38, 0.329],
  [46, 0.252], [54, 0.185], [61, 0.129], [69, 0.086], [77, 0.054], [84, 0.033], [92, 0],
];
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

/* Luminância relativa (0-255) — é o que diz se uma cor vai APARECER sobre o
   fundo do tema ou sumir nele. */
const luminancia = (cor) => {
  const c = paraRgb(cor);
  return c ? 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b : 128;
};

/* Tons das bolhas, montados a partir do tema.

   Duas regras:

   1) Só entram cores que CONTRASTAM com o fundo, e no sentido certo: no tema
      claro as bolhas são mais escuras que o fundo; no escuro, mais claras.
      Isso importa porque a paleta de um tema escuro traz tanto azuis vivos
      quanto um azul-quase-preto (b6) — esse último, sobre o fundo #060D18,
      seria uma bolha invisível. A conta é por luminância, então vale pros dez
      temas sem lista escrita à mão.

   2) Sobre as que passaram, entram também as misturas entre vizinhas. O tema
      traz 7 cores de bolha e repetir 7 em 9 bolhas deixa o fundo monótono;
      misturar dá degraus intermediários da MESMA família, sem inventar cor
      que não pertence ao tema. */
export const paletaDeBolhas = (T) => {
  const fundo = luminancia(T.blobBase || (T.dark ? '#0A0A12' : '#FFFFFF'));
  const escuro = T.dark ?? fundo < 128;
  const candidatas = [T.b1, T.b2, T.b3, T.b4, T.b5, T.b6, T.b7, T.sb1, T.sb2, T.sb3].filter(Boolean);

  const MIN_CONTRASTE = 26;
  let base = candidatas.filter(c => escuro
    ? luminancia(c) > fundo + MIN_CONTRASTE
    : luminancia(c) < fundo - MIN_CONTRASTE);
  // tema de contraste apertado: fica com as mais distantes do fundo em vez de vazio
  if (base.length < 3) {
    base = candidatas.slice()
      .sort((a, b) => Math.abs(luminancia(b) - fundo) - Math.abs(luminancia(a) - fundo))
      .slice(0, Math.min(5, candidatas.length));
  }
  if (!base.length) return ['rgba(120,120,160,0.5)'];

  const escala = [];
  for (let i = 0; i < base.length; i++) {
    escala.push(base[i]);
    escala.push(misturar(base[i], base[(i + 1) % base.length], 0.5));
  }
  // intercala as duas metades pra não sair um degradê ordenado do escuro ao claro
  const meio = Math.ceil(escala.length / 2), fora = [];
  for (let i = 0; i < meio; i++) {
    fora.push(escala[i]);
    if (escala[i + meio]) fora.push(escala[i + meio]);
  }
  return fora;
};
