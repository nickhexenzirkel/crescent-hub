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
