/* ══════════════════════════════════════════════════════════════════════════
   DADOS DOS WIDGETS do layout novo do menu de módulos

   O MenuLayoutNovo só desenha; o que é dado de verdade (vem do banco) nasce
   aqui, em hooks pequenos. Cada um faz UMA leitura ao montar — a tela de
   módulos é remontada toda vez que a pessoa volta de um módulo, então quem fez
   o check-in na Prisma Store e voltou já vê o widget atualizado sem precisar
   de realtime nem de polling.

   Falhou a leitura (sem rede, tabela fora do ar)? O widget fica no estado
   neutro — nunca inventa um número.
══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { supabase } from '../contexts/user';
import { isNonCheckinDay, localDateStr } from '../modules/mercado-estelar';
import { computePontoDays, loadColaboradorPonto } from './pontoCalc';

/* Check-in diário da Prisma Store.
   status: 'carregando' | 'disponivel' | 'feito' | 'folga' (fim de semana/feriado)
   semana: os 5 dias úteis desta semana, pra versão grande do widget —
           [{ iso, dia:'Seg', feito, hoje, folga, futuro }] */
export const useCheckinHoje = (authUser) => {
  const nome = authUser?.name;
  const [feitos, setFeitos] = useState(null);   // null = ainda não chegou
  useEffect(() => {
    if (!nome) return;
    let vivo = true;
    supabase.from('mercado_state').select('data').eq('player', nome).maybeSingle()
      .then(({ data }) => { if (vivo) setFeitos(Array.isArray(data?.data?.checkins) ? data.data.checkins : []); },
            () => { if (vivo) setFeitos([]); });
    return () => { vivo = false; };
  }, [nome]);

  const agora = new Date();
  const hojeISO = localDateStr(agora);
  const status = isNonCheckinDay(agora) ? 'folga'
    : feitos === null ? 'carregando'
    : feitos.includes(hojeISO) ? 'feito' : 'disponivel';

  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - ((agora.getDay() + 6) % 7));
  const semana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((dia, i) => {
    const d = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
    const iso = localDateStr(d);
    return { iso, dia, feito: !!feitos?.includes(iso), hoje: iso === hojeISO, folga: isNonCheckinDay(d), futuro: iso > hojeISO };
  });
  return { status, semana };
};

/* Resumo do ponto pras versões grandes de Banco de Horas e Ponto Eletrônico.
   É a MESMA conta da aba Banco de Horas (extras não rejeitadas + saldo do
   ponto), só que resumida. Carrega as marcações da pessoa, que não é leitura
   pequena — por isso só roda com `ativo` (algum dos dois widgets está grande);
   no tamanho pequeno ninguém paga por isso.
   null enquanto carrega; { saldoMin, extraMin, pontoMin, ultimoDia } depois. */
export const usePontoResumo = (authUser, ativo) => {
  const nome = authUser?.name, cpf = authUser?.cpf;
  const [resumo, setResumo] = useState(null);
  useEffect(() => {
    if (!ativo || !nome) return;
    let vivo = true;
    (async () => {
      try {
        const [{ marcacoes, justifs, limiteISO }, extras] = await Promise.all([
          loadColaboradorPonto({ cpf, name: nome }),
          supabase.from('banco_horas').select('horas_calculadas,status').eq('created_by', nome),
        ]);
        if (!vivo) return;
        const abonado = new Set((justifs || []).filter(j => j.texto && j.abonado !== false).map(j => j.data));
        const dias = computePontoDays(marcacoes, abonado, { limiteISO });
        const pontoMin = dias.reduce((a, d) => a + d.balance, 0);
        const extraMin = (extras.data || []).filter(r => r.status !== 'rejeitado')
          .reduce((a, r) => a + Number(r.horas_calculadas || 0) * 60, 0);
        const comBatida = dias.filter(d => d.times?.length);
        const ult = comBatida[comBatida.length - 1];
        setResumo({ saldoMin: extraMin + pontoMin, extraMin, pontoMin,
          ultimoDia: ult ? { data: ult.date, horas: ult.times } : null });
      } catch { if (vivo) setResumo({ erro: true }); }
    })();
    return () => { vivo = false; };
  }, [ativo, nome, cpf]);
  return ativo ? resumo : null;
};

/* Comunicados ativos: o mais recente e quantos a pessoa ainda não abriu.
   "Lido" é a mesma lista local que a aba Comunicados grava ao abrir um. */
const LIDOS_KEY = 'uniko_comunicados_lidos';
export const useComunicadosResumo = () => {
  const [resumo, setResumo] = useState(null);
  useEffect(() => {
    let vivo = true;
    supabase.from('comunicados').select('id,title,created_at').eq('active', true)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (!vivo || error || !Array.isArray(data)) return;
        let lidos = [];
        try { lidos = JSON.parse(localStorage.getItem(LIDOS_KEY) || '[]'); } catch { /* ignora */ }
        setResumo({ ultimo: data[0] || null, naoLidos: data.filter(c => !lidos.includes(c.id)).length });
      }, () => {});
    return () => { vivo = false; };
  }, []);
  return resumo;
};

/* Janela em que o catálogo conta como "atualizado". O Admin da loja regrava o
   catálogo inteiro a cada edição (updated_at de todos os itens muda junto),
   então o maior updated_at é, na prática, "a última vez que mexeram na loja". */
const DIAS_NOVIDADE = 10;

/* Resumo do catálogo pra o cartão da Prisma Store nas novidades.
   null enquanto carrega ou se a leitura falhar. */
export const usePrismaResumo = () => {
  const [resumo, setResumo] = useState(null);
  useEffect(() => {
    let vivo = true;
    supabase.from('mercado_items').select('name,emoji,featured,stock,updated_at')
      .then(({ data, error }) => {
        if (!vivo || error || !Array.isArray(data) || !data.length) return;
        const disponiveis = data.filter(i => Number(i.stock) > 0);
        const ultima = data.reduce((m, i) => (i.updated_at && i.updated_at > m ? i.updated_at : m), '');
        const recente = !!ultima && (Date.now() - new Date(ultima).getTime()) < DIAS_NOVIDADE * 864e5;
        const destaque = disponiveis.find(i => i.featured) || disponiveis[0] || null;
        setResumo({ total: disponiveis.length, recente, destaque });
      }, () => {});
    return () => { vivo = false; };
  }, []);
  return resumo;
};
