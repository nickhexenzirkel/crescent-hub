// Regras do Tetris (puras, sem React/DOM) — usadas por TabTetris.jsx e testáveis à parte.
export const COLS = 10;
export const ROWS = 20;

// Cada peça é uma matriz; os números (1..7) escolhem a cor.
export const PECAS = {
  I: { cor: 1, m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { cor: 2, m: [[1, 1], [1, 1]] },
  T: { cor: 3, m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { cor: 4, m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { cor: 5, m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { cor: 6, m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { cor: 7, m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};
export const NOMES = Object.keys(PECAS);

export const criarTabuleiro = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

/** Gira a matriz 90°: dir = 1 (horário) ou -1 (anti-horário). */
export function rotacionar(m, dir = 1) {
  const n = m.length;
  const r = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (dir === 1) r[x][n - 1 - y] = m[y][x]; else r[n - 1 - x][y] = m[y][x];
  }
  return r;
}

/** A peça (matriz m) na posição (px,py) bate nas paredes, no chão ou em blocos já fixos? */
export function colide(tab, m, px, py) {
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
    if (!m[y][x]) continue;
    const tx = px + x, ty = py + y;
    if (tx < 0 || tx >= COLS || ty >= ROWS) return true;
    if (ty >= 0 && tab[ty][tx]) return true;
  }
  return false;
}

/** Cola a peça no tabuleiro (devolve um tabuleiro novo). */
export function fixar(tab, m, px, py, cor) {
  const novo = tab.map(l => [...l]);
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
    if (m[y][x] && py + y >= 0) novo[py + y][px + x] = cor;
  }
  return novo;
}

/** Remove as linhas completas. → { tab, linhas } */
export function limparLinhas(tab) {
  const restantes = tab.filter(l => l.some(c => !c));
  const linhas = ROWS - restantes.length;
  const vazias = Array.from({ length: linhas }, () => Array(COLS).fill(0));
  return { tab: [...vazias, ...restantes], linhas };
}

/** Pontos por linhas feitas de uma vez (clássico: 100/300/500/800 × nível). */
export const pontosPorLinhas = (n, nivel) => ([0, 100, 300, 500, 800][n] || 0) * nivel;

/** Nível sobe a cada 10 linhas. */
export const nivelPorLinhas = (linhas) => 1 + Math.floor(linhas / 10);

/** Milissegundos entre quedas automáticas. */
export const velocidade = (nivel) => Math.max(90, 800 - (nivel - 1) * 70);

/** Saco de 7 peças embaralhadas (todas aparecem antes de repetir). */
export function sacoDePecas(rnd = Math.random) {
  const s = [...NOMES];
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
}

/** Tenta girar com pequenos "chutes" pros lados (wall kick). → { m, x } ou null. */
export function girarComChute(tab, m, px, py, dir) {
  const g = rotacionar(m, dir);
  for (const dx of [0, -1, 1, -2, 2]) if (!colide(tab, g, px + dx, py)) return { m: g, x: px + dx };
  return null;
}
