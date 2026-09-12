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

/* Status do check-in diário da Prisma Store.
   'carregando' | 'disponivel' | 'feito' | 'folga' (fim de semana/feriado). */
export const useCheckinHoje = (authUser) => {
  const nome = authUser?.name;
  const [status, setStatus] = useState(() => (isNonCheckinDay(new Date()) ? 'folga' : 'carregando'));
  useEffect(() => {
    if (!nome || isNonCheckinDay(new Date())) return;
    let vivo = true;
    supabase.from('mercado_state').select('data').eq('player', nome).maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        const feitos = Array.isArray(data?.data?.checkins) ? data.data.checkins : [];
        setStatus(feitos.includes(localDateStr(new Date())) ? 'feito' : 'disponivel');
      }, () => { if (vivo) setStatus('disponivel'); });
    return () => { vivo = false; };
  }, [nome]);
  return status;
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
