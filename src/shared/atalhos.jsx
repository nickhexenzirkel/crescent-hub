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
     'conexao-setorial:<id>'   → uma SALA da Conexão Setorial (o id da sala)

   As salas não são uma lista fixa no código: vêm da tabela conexao_rooms.
   `useSalasConexao` busca e guarda uma cópia no navegador, pra o atalho de
   uma sala aparecer na hora ao abrir a tela em vez de piscar até a consulta
   voltar. Sala apagada some do catálogo e o atalho some junto.

   Quem pode ver o quê segue as mesmas regras de dentro de cada módulo — a
   Oficina Estelar tem abas só de admin e abas liberadas por CPF.
══════════════════════════════════════════════════════════════════════════ */
import { NAV as NAV_PORTAL } from '../modules/central-colaborador/Sidebar';
import { NAV as NAV_OFICINA, canSeeTab } from '../modules/faturamento/Sidebar';
import { TAB_DEFS as ABAS_ALEXA } from '../modules/central-alexa';
import { ABAS_PRISMA } from '../modules/mercado-estelar';
import { useState, useEffect } from 'react';
import { supabase } from '../contexts/user';

/* Quadro com colunas — o ícone de uma sala. */
const IcoSala = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>
  </svg>
);

const SALAS_CACHE = 'uniko_conexao_salas_cache';
export const useSalasConexao = () => {
  const [salas, setSalas] = useState(() => {
    try { const r = JSON.parse(localStorage.getItem(SALAS_CACHE) || '[]'); return Array.isArray(r) ? r : []; }
    catch { return []; }
  });
  useEffect(() => {
    let vivo = true;
    supabase.from('conexao_rooms').select('id,name,color,position').order('position', { ascending: true })
      .then(({ data, error }) => {
        if (!vivo || error || !Array.isArray(data)) return;
        setSalas(data);
        try { localStorage.setItem(SALAS_CACHE, JSON.stringify(data)); } catch { /* ignora */ }
      }, () => {});
    return () => { vivo = false; };
  }, []);
  return salas;
};

export const catalogoAtalhos = (authUser, salas = []) => {
  const isAdmin = authUser?.role === 'admin';
  return [
    { modulo:'colaborador', nome:'Portal do Colaborador',
      abas: NAV_PORTAL.filter(n => !n.adminOnly || isAdmin) },
    { modulo:'mercado-estelar', nome:'Prisma Store', abas: ABAS_PRISMA },
    { modulo:'alexa', nome:'Central Alexa', abas: ABAS_ALEXA.filter(t => !t.adminOnly || isAdmin) },
    { modulo:'faturamento', nome:'Oficina Estelar',
      abas: NAV_OFICINA.filter(n => n.id !== 'inicio'
        && (n.tabGate ? canSeeTab(n.id, authUser, isAdmin) : (!n.adminOnly || isAdmin))) },
    { modulo:'conexao-setorial', nome:'Conexão Setorial',
      abas: salas.map(s => ({ id:s.id, label:s.name || 'Sala', icon:IcoSala, cor: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : null })) },
  ].filter(g => g.abas.length).map(g => ({
    ...g,
    abas: g.abas.map(a => ({ id:a.id, label:a.label, icon:a.icon, cor:a.cor || null, chave: chaveAtalho(g.modulo, a.id) })),
  }));
};

export const chaveAtalho = (modulo, aba) => (modulo === 'colaborador' ? aba : `${modulo}:${aba}`);

/* Chave → { modulo, nomeModulo, aba, label, icon }, ou null se a aba não
   existe mais ou a pessoa perdeu acesso a ela (o atalho some sozinho). */
export const resolverAtalho = (chave, catalogo) => {
  // Corta só no PRIMEIRO ":" — o que vem depois é o id da aba/sala inteiro.
  const i = chave.indexOf(':');
  const [modulo, aba] = i >= 0 ? [chave.slice(0, i), chave.slice(i + 1)] : ['colaborador', chave];
  const grupo = catalogo.find(g => g.modulo === modulo);
  const item = grupo?.abas.find(a => a.id === aba);
  return item ? { modulo, nomeModulo: grupo.nome, aba, label: item.label, icon: item.icon, cor: item.cor } : null;
};
