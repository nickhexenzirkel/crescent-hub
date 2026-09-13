/* ══════════════════════════════════════════════════════════════════════════
   URL PRÓPRIA PARA CADA FERRAMENTA DE PDF
   Editor, Organizar e Mesclar moravam os três em `#faturamento`, junto com o
   resto do módulo: não dava pra mandar o link de uma ferramenta pra alguém,
   e o Voltar do navegador saía do módulo inteiro em vez de devolver pra
   escolha de ferramenta. Aqui elas ganham endereço:

     #faturamento/oficina/editor
     #faturamento/oficina/organizar
     #faturamento/oficina/mesclar

   As outras abas do módulo continuam em `#faturamento` (decisão de 13/09/2026
   — o pedido era só pelas três ferramentas de PDF).

   O que este arquivo NÃO faz, de propósito: abrir a ferramenta quando a URL é
   carregada de fora (F5, link colado). Quem manda no carregamento é o App, que
   restaura a sessão e cai no seletor de módulos sem olhar o hash — mudar isso
   mexeria no comportamento de F5 de TODOS os módulos, e ficou fora do pedido.
   Por isso `ferramentaDaUrl` só é consultada com o módulo já aberto, onde o
   hash é sempre fruto de uma navegação nossa.

   O `state` do histórico carrega `screen: 'faturamento'` porque o App escuta
   popstate e lê justamente esse campo pra saber qual tela mostrar (ver navPush
   em App.jsx) — sem ele, o Voltar cairia na landing.
══════════════════════════════════════════════════════════════════════════ */

const BASE = '#faturamento';
const ROTA = /^#faturamento\/oficina\/([a-z]+)$/;

/* Lista fechada: hash com nome de ferramenta que não existe lê como nenhuma,
   em vez de abrir uma tela em branco. */
const FERRAMENTAS = ['editor', 'organizar', 'mesclar'];

/* Ferramenta que a URL atual aponta, ou null (inclui hash desconhecido). */
export const ferramentaDaUrl = () => {
  const m = ROTA.exec(window.location.hash);
  return m && FERRAMENTAS.includes(m[1]) ? m[1] : null;
};

/* Nova entrada no histórico: o Voltar do navegador devolve pra escolha de
   ferramenta, igual ao botão "Trocar ferramenta". */
export const irParaFerramenta = (f) => {
  window.history.pushState({ screen: 'faturamento', ferramenta: f }, '', `${BASE}/oficina/${f}`);
};

/* Desfaz a entrada da ferramenta. Todo caminho de saída passa por aqui — o
   botão "Trocar ferramenta", o Voltar do navegador e a troca de aba na sidebar
   —, e é o que garante que a entrada nunca fique órfã no histórico: se ela
   sobrasse, o "Sair" do módulo gastaria um clique voltando pra ela sem sair
   de lugar nenhum. */
export const voltarDaFerramenta = () => { window.history.back(); };

