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
   impostor de novo — tenho que criar sala nova e apagar a antiga".

   Sorteio aleatório honesto INCLUI repetir: com 4 pessoas, 1 em cada 4
   partidas volta pro mesmo. Então aqui não é aleatório puro — é FILA. A sala
   guarda quem já foi impostor no ciclo atual (`ciclo`); quem já foi fica fora
   do chapéu até TODO MUNDO ter sido uma vez. Só quando o ciclo fecha ele
   recomeça — e mesmo aí quem foi impostor na última partida (`ultimos`) fica
   de fora, pra virada de ciclo não emendar duas partidas seguidas na mesma
   pessoa.

   Garantia: com 3 ou mais jogadores e 1 impostor, é IMPOSSÍVEL alguém ser
   impostor duas partidas seguidas. Único caso em que a repetição sobra é a
   sala de 2 pessoas com 2 impostores (aí não há quem sortear) — o jogo nem
   permite isso na prática.

   • `nomes`   quem está na sala AGORA (a lista de presença)
   • `qtd`     quantos impostores esta partida terá
   • `ciclo`   quem já foi impostor no ciclo atual (state.cicloImpostores)
   • `ultimos` quem foi impostor na partida anterior (state.ultimosImpostores)
   Devolve { escolhidos, ciclo } — o `ciclo` novo pra gravar no estado. */
export const sortearImpostores = (nomes, qtd, ciclo = [], ultimos = []) => {
  const lista = [...new Set(nomes || [])];
  const alvo = Math.max(1, Math.min(qtd || 1, lista.length));
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

  const escolhidos = embaralhar(disponiveis).slice(0, alvo);
  return { escolhidos, ciclo: cicloNovo ? escolhidos : [...jaForam, ...escolhidos] };
};
