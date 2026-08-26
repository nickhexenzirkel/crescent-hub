// ─── Uniko Detetive — catálogo de tarefas ────────────────────────────────────
// Mora aqui (e não dentro de TabUnikoSuspect.jsx) porque é usado pelos DOIS
// lados: o jogo, pra escolher o mini-jogo da tarefa, e o editor de mapa do
// Dashboard RH, pra listar quais nomes existem. Arquivo de componente não pode
// exportar função/constante sem quebrar o fast refresh do Vite (regra
// react-refresh/only-export-components), daí o módulo separado.

// Compara sem acento e sem caixa: "Lavar Louça" casa com "lavar louca".
const normalizeTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Nome digitado pelo admin no editor → id do mini-jogo. Inclui apelidos e
// erros de digitação comuns, pra tarefa não cair no genérico por um acento.
const TASK_TYPE_BY_LABEL = {
  'limpar geladeira': 'geladeira',
  'remendar flaminga': 'flamingo',
  'coloque os chocolates no bolso': 'chocolates',
  'lavar louca': 'louca',
  'consertar energia': 'energia',
  'concertar energia': 'energia',   // "concertar" em vez de "consertar" — aceita os dois
  'fazer churrasco': 'churrasco',
  'limpar banheiro': 'banheiro',
  'observar estrelas': 'estrelas',
  'excluir pastas no computador': 'computador',
  'excluir pastas': 'computador',              // versão curta, se o admin abreviar
  'tomar banho na sauna': 'sauna',
  'tomar banho de sauna': 'sauna',             // variação natural do nome
};

// Nome que não bate com nenhum vira 'generica' (o mini-jogo de segurar o
// botão) — assim o admin pode marcar tarefa nova sem quebrar a partida.
export const taskTypeFor = (label) => TASK_TYPE_BY_LABEL[normalizeTxt(label)] || 'generica';

// Só os nomes CANÔNICOS, pro editor mostrar. Os apelidos acima continuam
// funcionando, mas não precisam poluir a lista.
export const TAREFAS_DISPONIVEIS = [
  { label: 'Limpar geladeira',               desc: 'arrastar o que estragou pra lixeira' },
  { label: 'Remendar flaminga',              desc: 'arrastar um remendo pra cima de cada rasgo' },
  { label: 'Coloque os chocolates no bolso', desc: 'arrastar cada chocolate pro bolso' },
  { label: 'Lavar louça',                    desc: 'arrastar cada peça pro suporte certo do escorredor' },
  { label: 'Consertar energia',              desc: 'ligar os fios certos (usada na sabotagem)' },
  { label: 'Fazer churrasco',                desc: 'virar no ponto certo' },
  { label: 'Limpar banheiro',                desc: 'esfregar as manchas' },
  { label: 'Observar estrelas',              desc: 'ligar a constelação na ordem' },
  { label: 'Excluir pastas no computador',   desc: 'arrastar as pastas velhas pra lixeira' },
  { label: 'Tomar banho na sauna',           desc: 'segurar a temperatura na faixa verde' },
];
