/* ══════════════════════════════════════════════════════════════════════════
   URL PRÓPRIA PARA AS ABAS DE PDF DA OFICINA ESTELAR
   Editor, Organizar e Mesclar são abas soltas na sidebar (15/09/2026 — antes
   viviam dentro de UMA aba "Ferramentas de Edição", cada uma escolhida por
   dentro dela como uma "ferramenta"; esse arquivo cuidava só de ir e voltar
   dessa escolha). Agora cada uma tem endereço fixo:

     #faturamento/pdf-editor
     #faturamento/pdf-organizar
     #faturamento/pdf-mesclar

   pra dar pra favoritar no navegador (barra de favoritos do Chrome) e abrir
   DIRETO nela — sem passar pelo seletor de módulos. Quem decide isso no
   carregamento é o App (`abaDaUrl`, lido uma vez no boot e de novo dentro do
   handleLogin caso a pessoa precise logar primeiro) — ver App.jsx.

   `refletirAbaNaUrl` roda a cada troca de aba do módulo e usa replaceState
   (NUNCA pushState): não empilha histórico, só mantém a URL visível fiel à
   aba atual, que é o que faz o botão de favoritar do navegador "pegar" o
   endereço certo. O botão Voltar do navegador continua sem andar ENTRE as
   abas do módulo — nunca andou, nem pras outras (Início, Controle de
   Notas...) —, só sai do módulo inteiro, exatamente como sempre foi.
══════════════════════════════════════════════════════════════════════════ */

const BASE = '#faturamento';

/* Lista fechada: só estas abas têm endereço próprio. As outras (Início,
   Controle de Notas, Assinatura Automática...) caem no hash genérico do
   módulo — ninguém pediu favoritar aquelas, e um hash desconhecido no boot
   tem que ler como "nenhum alvo" em vez de abrir uma tela em branco. */
const ABAS_COM_URL = ['pdf-editor', 'pdf-organizar', 'pdf-mesclar'];

/* Chamado a cada troca de aba do módulo (ver useEffect em index.jsx) —
   mantém a URL fiel à aba atual sem criar entrada nova no histórico. */
export const refletirAbaNaUrl = (tab) => {
  const hash = ABAS_COM_URL.includes(tab) ? `${BASE}/${tab}` : BASE;
  if (window.location.hash !== hash) window.history.replaceState({ screen: 'faturamento' }, '', hash);
};

/* Lê um hash #faturamento/<aba> e devolve { tab, hash } se for uma das abas
   com endereço próprio, ou null — usado só no BOOT do App (e no login, se a
   pessoa precisou entrar com senha primeiro) pra decidir se abre direto
   numa aba do módulo em vez de cair no seletor de módulos. */
export const abaDaUrl = (hash) => {
  const m = /^#faturamento\/([a-z-]+)$/.exec(hash || '');
  const tab = m && m[1];
  return tab && ABAS_COM_URL.includes(tab) ? { tab, hash: `${BASE}/${tab}` } : null;
};
