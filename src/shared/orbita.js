/* ══════════════════════════════════════════════════════════════════════════
   ÓRBITA DO SELETOR DE MÓDULOS — onde cada bolha fica no anel

   O PROBLEMA QUE ISTO RESOLVE (set/2026)
   As bolhas se encostavam uma na outra, principalmente as de baixo. A conta
   antiga dividia o PERÍMETRO da elipse entre os módulos, o que parecia certo,
   mas errava em dois pontos:

   1) Media o arco num espaço misturado: o x em "% da largura" e o y em "% da
      altura", somados com Pitágoras como se fossem a mesma unidade. Só que
      1% da largura são 11,8px e 1% da altura são 7,2px. Depois convertia tudo
      por uma média única (9,5px). Resultado: nas pontas laterais do anel —
      onde o caminho é quase todo vertical — a conta achava que havia 32% mais
      espaço do que havia de verdade, e era exatamente ali que as bolhas se
      colavam.

   2) Reservava ARCO, mas quem encosta é a CORDA — a linha reta entre os dois
      centros. Numa elipse achatada (519×252px) as pontas curvam muito, e ali
      a corda chega a ser 12% menor que o arco.

   Medido com 9 módulos do mesmo tamanho: as folgas deveriam ser 30px iguais e
   iam de 23px a 147px. Agora são exatas.

   COMO FUNCIONA AGORA
   Trabalha na elipse em PIXELS de verdade e mira na distância real entre
   centros. Como não dá pra resolver isso de forma fechada (a corda depende de
   onde os pontos caem, e onde eles caem depende da corda), o layout começa
   proporcional ao arco e se ajusta em algumas voltas até a corda bater com o
   pedido — converge em menos de 60 iterações, sempre.

   O TRIO DO TOPO
   Os três primeiros módulos da ordem ficam agrupados no alto: o do meio
   cravado exatamente no topo (-90°) e os outros dois ladeando, com uma folga
   menor de propósito. Toda a sobra de perímetro vai pros outros pares, então
   o trio lê como um grupo e o resto respira.
══════════════════════════════════════════════════════════════════════════ */

/* Posiciona os centros. Devolve os ângulos em graus, na mesma convenção do
   resto do seletor (-90° = topo, crescendo no sentido horário). */
function posicionar({ diams, RXpx, RYpx, gaps, trio }) {
  const N = diams.length;

  /* Tabela de comprimento de arco da elipse, em px, começando no topo. */
  const AMOSTRAS = 1440, PASSO = 360 / AMOSTRAS;
  const arco = [0], graus = [-90];
  let px = RXpx * Math.cos(-Math.PI / 2), py = RYpx * Math.sin(-Math.PI / 2), acc = 0;
  for (let i = 1; i <= AMOSTRAS; i++) {
    const a = (-90 + i * PASSO) * Math.PI / 180;
    const x = RXpx * Math.cos(a), y = RYpx * Math.sin(a);
    acc += Math.hypot(x - px, y - py);
    arco.push(acc); graus.push(-90 + i * PASSO); px = x; py = y;
  }
  const P = acc; // perímetro real, em px

  const grauDoArco = (t) => {
    let u = t % P; if (u < 0) u += P;
    let lo = 0, hi = arco.length - 1;
    while (lo < hi - 1) { const meio = (lo + hi) >> 1; if (arco[meio] <= u) lo = meio; else hi = meio; }
    const f = (u - arco[lo]) / Math.max(1e-9, arco[hi] - arco[lo]);
    return graus[lo] + f * (graus[hi] - graus[lo]);
  };
  const ponto = (g) => { const a = g * Math.PI / 180; return { x: RXpx * Math.cos(a), y: RYpx * Math.sin(a) }; };

  /* Distância de centro a centro que cada par PRECISA pra não encostar. */
  const D = diams.map((d, i) => (d + diams[(i + 1) % N]) / 2 + gaps[i]);
  const somaD = D.reduce((a, b) => a + b, 0);

  /* A sobra vai só pros pares de fora do trio — é isso que mantém o trio do
     topo agrupado e espalha o resto. O que há pra repartir é o perímetro do
     POLÍGONO (soma das cordas), não o da elipse: a corda sempre corta caminho.
     Como o polígono depende das posições, começamos pelo perímetro da elipse
     e corrigimos a cada volta. */
  const foraDoTrio = D.map((_, i) => i >= trio - 1);
  const nFora = foraDoTrio.filter(Boolean).length || N;
  let utilizavel = P;
  const alvos = () => {
    const sobra = Math.max(0, utilizavel - somaD);
    return D.map((d, i) => d + (foraDoTrio[i] ? sobra / nFora : 0));
  };

  let fatia = (() => { const a = alvos(), s = a.reduce((x, y) => x + y, 0) || 1; return a.map(v => v / s * P); })();
  let angulos = [];
  for (let volta = 0; volta < 60; volta++) {
    /* A bolha 1 (a do meio do trio) fica cravada no topo; as outras saem dela
       pra frente e pra trás. */
    const ts = new Array(N);
    ts[1 % N] = 0;
    for (let k = 2; k < N; k++) ts[k] = ts[k - 1] + fatia[k - 1];
    if (N > 1) ts[0] = -fatia[0];
    angulos = ts.map(grauDoArco);

    const pts = angulos.map(ponto);
    const cordas = pts.map((p, i) => { const q = pts[(i + 1) % N]; return Math.hypot(p.x - q.x, p.y - q.y); });
    const somaC = cordas.reduce((a, b) => a + b, 0) || 1;

    utilizavel = somaC;
    const alvo = alvos(), somaAlvo = alvo.reduce((a, b) => a + b, 0) || 1;
    let maiorAjuste = 0;
    fatia = fatia.map((f, i) => {
      const quer = alvo[i] / somaAlvo, tem = cordas[i] / somaC;
      const corr = quer / Math.max(1e-9, tem);
      maiorAjuste = Math.max(maiorAjuste, Math.abs(corr - 1));
      return f * corr;
    });
    const s = fatia.reduce((a, b) => a + b, 0) || 1;
    fatia = fatia.map(f => f / s * P);
    if (maiorAjuste < 1e-4) break;
  }
  return { angulos, ponto };
}

/* ─────────────────────────────────────────────────────────────────────────
   Entrada de verdade. Se os tamanhos pedidos não couberem no anel, TODO MUNDO
   encolhe junto na mesma proporção — uma bolha nunca come o espaço da vizinha.
   Encolher muda as cordas, então roda 3 voltas (converge bem antes).

   diamsPedidos — diâmetro que cada módulo quer, em px, na ordem do anel
   RXpx/RYpx    — raios da elipse, em px de tela
   gaps         — folga mínima desejada entre cada par (i → i+1), em px
   trio         — quantos módulos formam o grupo do topo (padrão 3)
   ───────────────────────────────────────────────────────────────────────── */
export function calcularOrbita({ diamsPedidos, RXpx, RYpx, gaps, trio = 3, diamMin = 90 }) {
  const N = diamsPedidos.length;
  if (!N) return { angulos: [], diams: [], ponto: () => ({ x: 0, y: 0 }) };

  let diams = diamsPedidos.slice(), r = null;
  for (let volta = 0; volta < 3; volta++) {
    r = posicionar({ diams, RXpx, RYpx, gaps, trio: Math.min(trio, N) });
    const pts = r.angulos.map(r.ponto);
    let encolhe = 1;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (i === j) continue;                       // um módulo só: nada a comparar
      const corda = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      const cabe = 2 * (corda - gaps[i]) / (diams[i] + diams[j]);
      if (cabe < encolhe) encolhe = cabe;
    }
    if (encolhe >= 0.999) break;
    diams = diamsPedidos.map(d => Math.max(diamMin, d * encolhe));
  }
  return { angulos: r.angulos, diams, ponto: r.ponto };
}
