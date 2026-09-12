/* ══════════════════════════════════════════════════════════════════════════
   CATÁLOGO DE ATALHOS — abas internas que podem virar item na tela de módulos

   Um atalho leva direto pra uma aba de dentro de um módulo: o Banco de Horas
   do Portal, o Check-in da Prisma Store, a Playlist da Central Alexa, o
   Controle de Notas da Oficina Estelar...

   As listas NÃO são copiadas aqui: cada módulo exporta as próprias abas e
   este arquivo só as reúne. Assim uma aba nova nasce disponível como atalho
   sem ninguém lembrar de duplicar rótulo e ícone.

   Chave guardada nas preferências da pessoa:
     'horas'                  → aba do Portal (formato antigo, mantido sem
                                prefixo pra não perder atalhos já salvos)
     'mercado-estelar:checkin' → módulo:aba, pra todos os outros

   Quem pode ver o quê segue as mesmas regras de dentro de cada módulo — a
   Oficina Estelar tem abas só de admin e abas liberadas por CPF.
══════════════════════════════════════════════════════════════════════════ */
import { NAV as NAV_PORTAL } from '../modules/central-colaborador/Sidebar';
import { NAV as NAV_OFICINA, canSeeTab } from '../modules/faturamento/Sidebar';
import { TAB_DEFS as ABAS_ALEXA } from '../modules/central-alexa';
import { ABAS_PRISMA } from '../modules/mercado-estelar';

export const catalogoAtalhos = (authUser) => {
  const isAdmin = authUser?.role === 'admin';
  return [
    { modulo:'colaborador', nome:'Portal do Colaborador',
      abas: NAV_PORTAL.filter(n => !n.adminOnly || isAdmin) },
    { modulo:'mercado-estelar', nome:'Prisma Store', abas: ABAS_PRISMA },
    { modulo:'alexa', nome:'Central Alexa', abas: ABAS_ALEXA.filter(t => !t.adminOnly || isAdmin) },
    { modulo:'faturamento', nome:'Oficina Estelar',
      abas: NAV_OFICINA.filter(n => n.id !== 'inicio'
        && (n.tabGate ? canSeeTab(n.id, authUser, isAdmin) : (!n.adminOnly || isAdmin))) },
  ].map(g => ({
    ...g,
    abas: g.abas.map(a => ({ id:a.id, label:a.label, icon:a.icon, chave: chaveAtalho(g.modulo, a.id) })),
  }));
};

export const chaveAtalho = (modulo, aba) => (modulo === 'colaborador' ? aba : `${modulo}:${aba}`);

/* Chave → { modulo, nomeModulo, aba, label, icon }, ou null se a aba não
   existe mais ou a pessoa perdeu acesso a ela (o atalho some sozinho). */
export const resolverAtalho = (chave, catalogo) => {
  const [modulo, aba] = chave.includes(':') ? chave.split(':') : ['colaborador', chave];
  const grupo = catalogo.find(g => g.modulo === modulo);
  const item = grupo?.abas.find(a => a.id === aba);
  return item ? { modulo, nomeModulo: grupo.nome, aba, label: item.label, icon: item.icon } : null;
};
