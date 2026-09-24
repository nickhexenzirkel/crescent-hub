// src/shared/modulesCatalog.js
// Lista de todos os módulos do Uniko, pra liberar por cargo em Dashboard RH
// → Gerenciar Permissões. Mantida em sincronia manual com o array `allMods`
// de ModuleSelector.jsx — se um módulo novo entrar lá, adicione aqui também
// (os `id` têm que ser IDÊNTICOS aos usados em ModuleSelector/App.jsx).
export const MODULES_CATALOG = [
  { id: 'colaborador', label: 'Portal do Colaborador' },
  { id: 'alexa', label: 'Central Alexa' },
  { id: 'faturamento', label: 'Oficina Estelar' },
  { id: 'uniko-fit', label: 'Uniko FIT' },
  { id: 'dashboard', label: 'Dashboard RH' },
  { id: 'ponto', label: 'Ponto Eletrônico' },
  { id: 'mercado-estelar', label: 'Prisma Store' },
  { id: 'conexao-setorial', label: 'Trello' },
  { id: 'info-adicional', label: 'Informações Adicionais' },
  { id: 'uniko-safer', label: 'Uniko Safer' },
  { id: 'uniko-security', label: 'Uniko Security' },
  { id: '7-beneficios', label: 'Portal dos Credenciados' },
  { id: 'uniko-call', label: 'Uniko Call' },
  { id: 'prestacao-contas', label: 'Prestações de Contas' },
];

// Restrição de ABA: só os módulos que têm navegação interna por abas (Portal
// do Colaborador, Oficina Estelar) entram aqui. "Início" fica de fora de
// propósito — não tem como marcar ela numa restrição (vira a home sozinha,
// ver homeTab em central-colaborador/index.jsx e faturamento/index.jsx).
// Mantido em sincronia manual com NAV_FOR (Sidebar.jsx de cada módulo).
export const MODULE_TABS_CATALOG = {
  colaborador: [
    { id: 'dados', label: 'Seus Dados' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'horas', label: 'Banco de Horas' },
    { id: 'ponto', label: 'Ponto Eletrônico' },
    { id: 'lembretes', label: 'Meus Lembretes' },
    { id: 'comunicados', label: 'Comunicados' },
    { id: 'eventos', label: 'Eventos' },
    { id: 'colegas', label: 'Colegas' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'uniko', label: 'Coleção' },
    { id: 'roleta', label: 'Roleta da Sorte' },
    { id: 'unikosuspect', label: 'Uniko Detetive' },
    { id: 'unikowave', label: 'Uniko Wave' },
    { id: 'unikopaint', label: 'Uniko Paint' },
    { id: 'unikocamera', label: 'Uniko Camera' },
    { id: 'quizmm', label: 'Quiz do M&M' },
    { id: 'unikostop', label: 'Uniko Stop!' },
    { id: 'unikofaster', label: 'Uniko Speed' },
  ],
  faturamento: [
    { id: 'pdf-editor', label: 'Editor de PDF' },
    { id: 'pdf-organizar', label: 'Organizar PDF' },
    { id: 'pdf-mesclar', label: 'Mesclar PDF' },
    { id: 'xml', label: 'Controle de Notas' },
    { id: 'assinatura', label: 'Assinatura Automática' },
    { id: 'historico-assinatura', label: 'Histórico de Assinatura' },
    { id: 'carta', label: 'Carta de Correção' },
  ],
};
