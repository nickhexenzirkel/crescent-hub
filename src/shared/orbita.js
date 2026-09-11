/* ══════════════════════════════════════════════════════════════════════════
   ÓRBITA DO SELETOR DE MÓDULOS — onde cada bolha fica no anel

   O QUE JÁ DEU ERRADO AQUI (pra não repetir)

   1) Bolhas se encostando. A conta antiga dividia o perímetro medindo o arco
      num espaço misturado — o x em "% da largura" e o y em "% da altura",
      somados com Pitágoras como se fossem a mesma unidade, e convertidos
      depois por uma média única. Mas 1% da largura são 11,8px e 1% da altura
      7,2px: nas pontas laterais do anel a conta achava 32% mais espaço do que
      havia, e era ali que elas colavam. Além disso reservava ARCO, quando
      quem encosta é a CORDA — a linha reta entre dois centros, até 12% menor
      que o arco nas pontas de uma elipse achatada.

   2) Trio apertado no topo. A tentativa seguinte agrupou os três primeiros
      módulos lá em cima e jogou toda a sobra do anel pros outros pares. Ficou
      pior: três colados no alto e buracos enormes nos lados.

   COMO É AGORA
   Espaçamento UNIFORME — a mesma folga entre todos os pares, medida na
   distância real entre centros. E em vez de sobrar buraco, as bolhas CRESCEM
   juntas até a folga chegar no alvo; quando nem crescendo elas dão conta (são
   poucos módulos), aí sim o anel inteiro encolhe. Assim a órbita fica cheia
   com 4 ou com 11 módulos, sem vão.

   Como a corda depende de onde os pontos caem e onde eles caem depende da
   corda, não há fórmula fechada: o layout parte do arco e se ajusta em
   algumas voltas até bater. Converge sempre em bem menos de 60 iterações.

   O módulo de índice 1 fica cravado no topo (-90°), o de índice 0 à esquerda
   dele e o de índice 2 à direita — é o que define a ordem padrão da tela.
══════════════════════════════════════════════════════════════════════════ */

/* Tabela de comprimento de arco da elipse, em px, começando no topo. */
function tabelaDeArco(RXpx, RYpx) {
  const AMOSTRAS = 1440, PASSO = 360 / AMOSTRAS;
  const arco = [0], graus = [-90];
  let px = RXpx * Math.cos(-Math.PI / 2), py = RYpx * Math.sin(-Math.PI / 2), acc = 0;
  for (let i = 1; i <= AMOSTRAS; i++) {
    const a = (-90 + i * PASSO) * Math.PI / 180;
    const x = RXpx * Math.cos(a), y = RYpx * Math.sin(a);
    acc += Math.hypot(x - px, y - py);
    arco.push(acc); graus.push(-90 + i * PASSO); px = x; py = y;
  }
  const perimetro = acc;
  const grauDoArco = (t) => {
    let u = t % perimetro; if (u < 0) u += perimetro;
    let lo = 0, hi = arco.length - 1;
    while (lo < hi - 1) { const meio = (lo + hi) >> 1; if (arco[meio] <= u) lo = meio; else hi = meio; }
    const f = (u - arco[lo]) / Math.max(1e-9, arco[hi] - arco[lo]);
    return graus[lo] + f * (graus[hi] - graus[lo]);
  };
  const ponto = (g) => { const a = g * Math.PI / 180; return { x: RXpx * Math.cos(a), y: RYpx * Math.sin(a) }; };
  return { perimetro, grauDoArco, ponto };
}

/* Espalha os centros com a MESMA folga entre todos os pares. */
function posicionar({ diams, RXpx, RYpx, gap }) {
  const N = diams.length;
  const { perimetro: P, grauDoArco, ponto } = tabelaDeArco(RXpx, RYpx);

  const D = diams.map((d, i) => (d + diams[(i + 1) % N]) / 2 + gap);
  const somaD = D.reduce((a, b) => a + b, 0) || 1;
  let fatia = D.map(v => v / somaD * P);
  let angulos = [];

  for (let volta = 0; volta < 60; volta++) {
    /* O índice 1 fica cravado no topo; os outros saem dele pra frente, e o
       índice 0 pra trás (fica à esquerda do topo). */
    const ts = new Array(N);
    ts[1 % N] = 0;
    for (let k = 2; k < N; k++) ts[k] = ts[k - 1] + fatia[k - 1];
    if (N > 1) ts[0] = -fatia[0];
    angulos = ts.map(grauDoArco);

    const pts = angulos.map(ponto);
    const cordas = pts.map((p, i) => { const q = pts[(i + 1) % N]; return Math.hypot(p.x - q.x, p.y - q.y); });
    const somaC = cordas.reduce((a, b) => a + b, 0) || 1;

    let maiorAjuste = 0;
    fatia = fatia.map((f, i) => {
      const corr = (D[i] / somaD) / Math.max(1e-9, cordas[i] / somaC);
      maiorAjuste = Math.max(maiorAjuste, Math.abs(corr - 1));
      return f * corr;
    });
    const s = fatia.reduce((a, b) => a + b, 0) || 1;
    fatia = fatia.map(f => f / s * P);
    if (maiorAjuste < 1e-4) break;
  }

  const pts = angulos.map(ponto);
  const folga = N > 1
    ? Math.min(...pts.map((p, i) => {
      const j = (i + 1) % N, q = pts[j];
      return Math.hypot(p.x - q.x, p.y - q.y) - (diams[i] + diams[j]) / 2;
    }))
    : Infinity;
  /* Quanto sobra de espaço vazio no miolo do anel: a menor distância entre o
     centro e a BORDA de alguma bolha. Numa elipse achatada esse mínimo cai
     sempre em cima ou embaixo, que é onde o mascote era espremido. */
  const vaoCentral = Math.min(...pts.map((p, i) => Math.hypot(p.x, p.y) - diams[i] / 2));
  return { angulos, ponto, folga, vaoCentral };
}

/* ─────────────────────────────────────────────────────────────────────────
   Entrada de verdade.

   mults   — multiplicador de tamanho de cada módulo (P/M/G/GG), na ordem do anel
   W, H    — caixa disponível, em px
   base    — diâmetro de referência de uma bolha "M", em px
   gapAlvo — folga que se quer entre todas as bolhas
   gapMax  — passou disso, o anel inteiro encolhe (senão sobra vão com poucos módulos)
   vaoMin  — raio que precisa ficar LIVRE no meio do anel (o mascote mora ali)
   dMin/dMax — limites do tamanho BASE (o de uma bolha "M")
   dTeto   — teto de uma bolha individual, já com o multiplicador aplicado
   margem  — respiro entre a bolha mais externa e a borda da caixa

   Devolve os ângulos, os diâmetros finais e os raios da elipse — os anéis
   decorativos do seletor são desenhados a partir DESTES raios, senão eles
   deixam de passar por baixo das bolhas.
   ───────────────────────────────────────────────────────────────────────── */
export function calcularOrbita({
  mults, W, H, base = 178, gapAlvo = 46, gapMax = 95, vaoMin = 0,
  dMin = 120, dMax = 250, dTeto = 330, margem = 12,
}) {
  const N = mults?.length || 0;
  if (!N) return { angulos: [], diams: [], RXpx: 0, RYpx: 0, ponto: () => ({ x: 0, y: 0 }) };

  const somaMults = mults.reduce((a, b) => a + b, 0) || 1;

  /* d0 é o tamanho de uma bolha "M"; o P/G/GG de cada módulo multiplica em
     cima dele. O teto individual (dTeto) existe só pra uma GG sozinha não
     virar um terço da tela — repare que ele NÃO pode ser o que limita o
     tamanho base, senão come a diferença entre os passos (foi o bug: com o
     teto na bolha maior, G e GG davam os mesmos 250px, e com 7 módulos o M já
     nascia no teto, então mudar o tamanho não mudava nada na tela). */
  const tamanhos = (d0) => mults.map(m => Math.min(dTeto, d0 * m));
  /* `estreita` aperta o anel SÓ na horizontal. Encolher os dois raios juntos
     seria o óbvio, mas rouba justamente o espaço do mascote: numa elipse
     achatada o vão do meio é medido em cima e embaixo, ou seja, vale RY. Já
     mexer só no RX corta perímetro (junta as bolhas) sem tocar nesse vão. */
  const rodar = (d0, estreita) => {
    const diams = tamanhos(d0);
    const maior = Math.max(...diams);
    const RYpx = Math.max(40, H / 2 - maior / 2 - margem);
    const RXpx = Math.max(RYpx * 1.2, (W / 2 - maior / 2 - margem) * estreita);
    return { ...posicionar({ diams, RXpx, RYpx, gap: gapAlvo }), diams, RXpx, RYpx };
  };

  /* Teto do tamanho base imposto pelo vão do meio: é o maior d0 que ainda
     deixa o mascote respirar. Entra ANTES de tudo, senão as bolhas crescem
     pra ocupar o anel e só depois são obrigadas a encolher — o que reabriria
     os buracos que o crescimento tinha fechado. */
  let capVao = Infinity;
  if (vaoMin > 0 && N > 0) {
    let lo = dMin * 0.5, hi = dTeto;
    if (rodar(hi, 1).vaoCentral < vaoMin) {
      for (let i = 0; i < 24; i++) {
        const meio = (lo + hi) / 2;
        if (rodar(meio, 1).vaoCentral >= vaoMin) lo = meio; else hi = meio;
      }
      capVao = lo;
    }
  }

  /* 1ª etapa — as bolhas crescem (ou encolhem) até a folga bater no alvo.
     Crescer muda os raios, que mudam o perímetro: repete até estabilizar. */
  let d0 = base, r = rodar(d0, 1);
  for (let volta = 0; volta < 10; volta++) {
    const pts = r.angulos.map(r.ponto);
    const poli = N > 1
      ? pts.reduce((s, p, i) => { const q = pts[(i + 1) % N]; return s + Math.hypot(p.x - q.x, p.y - q.y); }, 0)
      : 0;
    const querido = N > 1 ? (poli - N * gapAlvo) / somaMults : base;
    const novo = Math.max(dMin, Math.min(dMax, capVao, querido));
    const parou = Math.abs(novo - d0) < 0.5;
    d0 = novo; r = rodar(d0, 1);
    if (parou) break;
  }

  /* 2ª etapa — se mesmo na bolha máxima ainda sobra vão (poucos módulos),
     encolhe o anel inteiro até a folga chegar no teto. Busca binária: a
     folga cai junto com o raio, então o intervalo é bem-comportado. */
  let estreita = 1;
  if (r.folga > gapMax && N > 1) {
    /* Aperta na horizontal até a folga chegar no teto. Os dois limites —
       folga e vão do meio — crescem junto com o anel, então "cabe" vale pra
       anel grande e falha pra anel pequeno: basta procurar o menor que cabe. */
    const cabe = (t) => t.folga >= gapMax && t.vaoCentral >= vaoMin;
    let lo = 0.3, hi = 1;
    for (let i = 0; i < 24; i++) {
      const meio = (lo + hi) / 2;
      if (cabe(rodar(d0, meio))) hi = meio; else lo = meio;
    }
    const final = rodar(d0, hi);
    if (final.folga >= gapAlvo * 0.9) { estreita = hi; r = final; }  // nunca apertar a ponto de encostar
  }

  /* 3ª etapa — rede de segurança: se por qualquer motivo ainda houver
     encosto, todo mundo encolhe JUNTO (nunca uma bolha come a vizinha). */
  for (let volta = 0; volta < 3 && r.folga < 0; volta++) {
    d0 = Math.max(dMin * 0.6, d0 * Math.max(0.5, 1 + r.folga / Math.max(...tamanhos(d0))));
    r = rodar(d0, estreita);
  }

  return { angulos: r.angulos, diams: r.diams, RXpx: r.RXpx, RYpx: r.RYpx, ponto: r.ponto };
}
