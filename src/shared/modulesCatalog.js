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
  { id: 'comercial', label: 'Comercial (em breve)' },
];
