// src/shared/tituloAba.js
// Título da aba com bolinha de notificação: "🔴 (4) Mensagens - UNIKO".
// Várias fontes podem ter não lidas (caixa de entrada do menu, Blog Secreto do
// assistente); cada uma informa a sua contagem e o título mostra a soma. Sem nada
// pendente, volta pro título normal. Um lugar só escreve em document.title — antes
// o Blog Secreto e a caixa se atropelariam.
const TITULO_BASE = 'UNIKO';
const contagens = {};

export function setContadorTitulo(fonte, n) {
  if (typeof document === 'undefined') return;
  contagens[fonte] = Math.max(0, Number(n) || 0);
  const total = Object.values(contagens).reduce((a, b) => a + b, 0);
  document.title = total > 0
    ? `🔴 (${total}) ${total === 1 ? 'Mensagem' : 'Mensagens'} - ${TITULO_BASE}`
    : TITULO_BASE;
}
