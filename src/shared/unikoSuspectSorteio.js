// ─── Uniko Suspect — sorteio dos papéis ──────────────────────────────────────
// Mora fora do componente de propósito: é a regra que decide QUEM é impostor,
// e aqui ela pode ser lida (e testada) sem subir o jogo inteiro.

// `array.sort(() => Math.random() - .5)` NÃO embaralha de verdade — o
// comparador quebra as regras que o sort espera (não é transitivo), então o
// resultado fica enviesado pela ordem/algoritmo de sort do motor (mais forte
// ainda em arrays pequenos, tipo a lista de jogadores). Fisher-Yates é o
// shuffle de verdade, sem viés.
export const embaralhar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ── Rodízio do impostor (ago/2026) ─────────────────────────────────────────
   Pedido do usuário: "recomeço a partida na mesma sala e o mesmo cai de
   impostor de novo — tenho que criar sala nova e apagar a antiga". Depois:
   "no longo prazo, dê impostor pra quem está há mais tempo sem ser".

   Sorteio aleatório honesto INCLUI repetir: com 4 pessoas, 1 em cada 4
   partidas volta pro mesmo. Então aqui não é aleatório puro. São DUAS regras,
   nesta ordem:

   1) FILA (curto prazo) — a sala guarda quem já foi impostor no ciclo atual
      (`ciclo`); quem já foi fica fora do chapéu até TODO MUNDO ter sido uma
      vez. Quando o ciclo fecha ele recomeça, e mesmo aí quem foi impostor na
      última partida (`ultimos`) continua de fora, pra virada de ciclo não
      emendar duas partidas seguidas na mesma pessoa.
   2) ANTIGUIDADE (longo prazo) — entre os que sobraram, NÃO é sorteio cego:
      entra primeiro quem está há mais partidas sem ser impostor, medido pelo
      `historico` (nome → número da partida em que foi impostor pela última
      vez). Quem NUNCA foi passa na frente de todo mundo. O sorteio só decide
      os EMPATES (quem nunca foi entre si, ou dois com a mesma espera) — é o
      que impede a ordem de virar uma escala fixa e decorável.

   Por que as duas: a fila sozinha zera a cada ciclo e não lembra de nada; com
   gente entrando e saindo (sala nova, alguém que faltou umas partidas), quem
   passou tempo fora podia levar impostor de novo antes de quem está jogando
   direto sem nunca pegar. O histórico atravessa os ciclos e resolve isso.

   Garantia: com 3 ou mais jogadores e 1 impostor, é IMPOSSÍVEL alguém ser
   impostor duas partidas seguidas. Único caso em que a repetição sobra é a
   sala de 2 pessoas com 2 impostores (aí não há quem sortear) — o jogo nem
   permite isso na prática.

   • `nomes`     quem está na sala AGORA (a lista de presença)
   • `qtd`       quantos impostores esta partida terá
   • `ciclo`     quem já foi impostor no ciclo atual (state.cicloImpostores)
   • `ultimos`   quem foi impostor na partida anterior (state.ultimosImpostores)
   • `historico` nome → partida da última vez que foi impostor (state.historicoImpostores)
   • `rodada`    número desta partida (state.round + 1)
   Devolve { escolhidos, ciclo, historico } — tudo pra gravar de volta no estado. */
const HISTORICO_MAX = 60;   // nomes guardados no histórico (o resto é podado pelo mais antigo)

export const sortearImpostores = (nomes, qtd, ciclo = [], ultimos = [], historico = {}, rodada = 0) => {
  const lista = [...new Set(nomes || [])];
  const alvo = Math.max(1, Math.min(qtd || 1, lista.length));
  const hist = historico || {};
  // Quem saiu da sala não segura a fila: se o ciclo guardasse gente que foi
  // embora, os que ficaram viravam "todos já foram" cedo demais e a fila
  // reiniciava à toa.
  const jaForam = new Set((ciclo || []).filter(n => lista.includes(n)));
  const recentes = new Set((ultimos || []).filter(n => lista.includes(n)));

  let disponiveis = lista.filter(n => !jaForam.has(n));
  let cicloNovo = false;
  if (disponiveis.length < alvo) {
    // Ciclo fechado (todo mundo já foi): começa outro, sem os da última rodada.
    cicloNovo = true;
    disponiveis = lista.filter(n => !recentes.has(n));
    // Sala pequena demais pra respeitar até isso (ex.: 2 pessoas, 2
    // impostores): melhor repetir do que não ter impostor nenhum.
    if (disponiveis.length < alvo) disponiveis = [...lista];
  }

  /* Ordena por espera: quem nunca foi impostor (sem registro) vem primeiro,
     depois o de registro mais ANTIGO. `embaralhar` antes da ordenação é o que
     desempata sozinho — `sort` é estável, então nomes com a mesma espera saem
     na ordem embaralhada em vez de sempre na mesma ordem da lista. */
  const espera = (n) => (hist[n] === undefined ? -Infinity : hist[n]);
  const escolhidos = embaralhar(disponiveis).sort((a, b) => espera(a) - espera(b)).slice(0, alvo);

  // Histórico novo: os escolhidos carimbam esta partida. Podado pelos mais
  // antigos pra não crescer sem fim numa sala que vive há semanas.
  const atualizado = { ...hist };
  escolhidos.forEach(n => { atualizado[n] = rodada; });
  const chaves = Object.keys(atualizado);
  if (chaves.length > HISTORICO_MAX) {
    chaves.sort((a, b) => atualizado[a] - atualizado[b]).slice(0, chaves.length - HISTORICO_MAX)
      .forEach(n => { delete atualizado[n]; });
  }

  return { escolhidos, ciclo: cicloNovo ? escolhidos : [...jaForam, ...escolhidos], historico: atualizado };
};
