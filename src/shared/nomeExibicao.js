// src/shared/nomeExibicao.js
// NOME DE EXIBIÇÃO: como a pessoa quer ser chamada no Uniko (ex.: "Maria Renata Souza"
// que atende por "Renata"). É só APRESENTAÇÃO — o nome completo (USER.name / authUser.name)
// continua sendo a chave de tudo no banco (banco de horas, contracheques, fotos, jogos...),
// então NUNCA troque o nome completo por este em consultas/gravações.
//
// Guardado em `nomes_exibicao` (supabase_nome_exibicao.sql), chave = nome completo, pra
// que os colegas também vejam. Cache no localStorage pra aparecer já no primeiro render.
// Sem registro → primeiro nome (o comportamento de sempre).
import { useSyncExternalStore } from 'react';
import { supabase } from '../contexts/user';

const CACHE_KEY = 'uniko_nomes_exibicao';
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

let mapa = {};   // norm(nome completo) → nome de exibição
let versao = 0;
const ouvintes = new Set();
const avisar = () => { versao++; ouvintes.forEach(fn => fn()); };

try { mapa = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { mapa = {}; }
const gravarCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(mapa)); } catch {} };

// Palavras do nome que podem ser escolhidas (sem "de", "da", "dos"...), na ordem do nome.
export const partesDoNome = (nomeCompleto) =>
  (nomeCompleto || '').trim().split(/\s+/).filter(p => p && !PARTICULAS.has(norm(p)));

const primeiroNome = (nomeCompleto) => partesDoNome(nomeCompleto)[0] || (nomeCompleto || '').trim().split(/\s+/)[0] || '';

// Como chamar a pessoa (saudações, menu, avisos): nome escolhido ou primeiro nome.
export const nomeChamado = (nomeCompleto) => mapa[norm(nomeCompleto)] || primeiroNome(nomeCompleto);

// Nome pra títulos/cartões: nome escolhido ou o nome completo.
export const nomeExibido = (nomeCompleto) => mapa[norm(nomeCompleto)] || (nomeCompleto || '');

// A pessoa escolheu um nome próprio?
export const temNomeEscolhido = (nomeCompleto) => !!mapa[norm(nomeCompleto)];

// O nome escolhido só pode usar palavras do próprio nome completo (sem apelidos livres).
export const nomeValido = (escolhido, nomeCompleto) => {
  const permitidas = new Set(partesDoNome(nomeCompleto).map(norm));
  const ps = (escolhido || '').trim().split(/\s+/).filter(Boolean);
  return ps.length > 0 && ps.every(p => permitidas.has(norm(p)));
};

let carregando = null;
export const carregarNomesExibicao = () => {
  if (carregando) return carregando;
  carregando = (async () => {
    try {
      const { data, error } = await supabase.from('nomes_exibicao').select('employee_name,nome_exibicao');
      if (error || !data) return;
      const novo = {};
      for (const r of data) if (r.employee_name && r.nome_exibicao) novo[norm(r.employee_name)] = r.nome_exibicao.trim();
      mapa = novo;
      gravarCache();
      avisar();
    } catch {} finally { carregando = null; }
  })();
  return carregando;
};

// nome vazio = voltar ao padrão (primeiro nome). Devolve { ok } ou { erro }.
export const salvarNomeExibicao = async ({ nomeCompleto, cpf, nome }) => {
  const k = norm(nomeCompleto);
  if (!k) return { erro: 'Nome completo indisponível.' };
  const limpo = (nome || '').trim().replace(/\s+/g, ' ');
  if (limpo && !nomeValido(limpo, nomeCompleto)) return { erro: 'Use só partes do seu nome completo.' };
  try {
    const { error } = limpo
      ? await supabase.from('nomes_exibicao').upsert({
          employee_name: nomeCompleto, cpf: (cpf || '').replace(/\D/g, '') || null,
          nome_exibicao: limpo, updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_name' })
      : await supabase.from('nomes_exibicao').delete().eq('employee_name', nomeCompleto);
    if (error) {
      const semTabela = error.code === '42P01' || error.code === 'PGRST205' || /nomes_exibicao/.test(error.message || '');
      return { erro: semTabela ? 'O recurso ainda não foi ativado no banco (rode supabase_nome_exibicao.sql).' : error.message };
    }
  } catch (e) { return { erro: e?.message || 'Erro de conexão' }; }
  if (limpo) mapa = { ...mapa, [k]: limpo };
  else { const { [k]: _, ...resto } = mapa; mapa = resto; }
  gravarCache();
  avisar();
  return { ok: true };
};

// Re-renderiza o componente quando algum nome de exibição muda (carregou do banco / salvou).
export const useNomesExibicao = () =>
  useSyncExternalStore(fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); }, () => versao, () => versao);
