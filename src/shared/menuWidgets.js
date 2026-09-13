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

/* ══ CAIXA DE ENTRADA ══════════════════════════════════════════════════════
   Avisos do que ACONTECEU COM a pessoa — não do que ela mesma fez:
     • banco de horas: o RH lançou horas pra ela (registro que já nasce
       aprovado) ou decidiu um pedido dela (aprovou/recusou depois);
     • prismas recebidos: envio de colega, presente ou crédito do RH
       (check-in e missão ela mesma fez, então ficam de fora);
     • convite pra jogar Uniko Paint / Uniko Stop;
     • evento novo na agenda.
   Tempo real por postgres_changes (filtrado no cliente — nome com espaço e
   acento quebra o filtro do realtime, ver gameInvites.js) e uma consulta a
   cada 45s de rede de segurança, porque nem toda tabela está garantida na
   publicação do realtime. Janela de 60 dias, 200 itens no máximo.

   Tudo que é da CAIXA fica no navegador, por conta:
     ids       — itens abertos (lidos);
     ate       — "visto até": o "marcar todas" lê tudo que chegou antes disso;
     naoLido   — itens que a pessoa marcou de volta como não lidos (ganha do `ate`);
     excluidos — itens tirados da caixa.
   EXCLUIR SÓ TIRA O AVISO DA CAIXA. O registro de origem (as horas no banco, o
   histórico de prismas, o evento) continua intacto — apagar isso por aqui
   seria apagar dado de RH a partir de uma notificação. */
const CAIXA_DIAS = 60, CAIXA_MAX = 200, CAIXA_POLL_MS = 45000;
const caixaKey = (authUser) => 'uniko_caixa_entrada_' + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
const lerLidos = (k) => {
  const lista = (v) => (Array.isArray(v) ? v : []);
  try { const r = JSON.parse(localStorage.getItem(k) || '{}'); return { ids: lista(r.ids), ate: r.ate || '', naoLido: lista(r.naoLido), excluidos: lista(r.excluidos) }; }
  catch { return { ids: [], ate: '', naoLido: [], excluidos: [] }; }
};

const JOGO = { paint: { nome: 'Uniko Paint', aba: 'unikopaint' }, stop: { nome: 'Uniko Stop!', aba: 'unikostop' } };
const horasTxt = (h) => { const m = Math.round(Number(h || 0) * 60); return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`; };
const diaTxt = (iso) => { if (!iso) return ''; const [, mo, d] = String(iso).slice(0, 10).split('-'); return `${d}/${mo}`; };
const prismasTxt = (r) => [r.premium > 0 && `${r.premium} Premium`, r.comum > 0 && `${r.comum} Comuns`].filter(Boolean).join(' + ');

/* Linha do banco → item da caixa. O id carrega o status: um registro que o
   RH aprova depois vira um aviso NOVO, em vez de reaproveitar um já lido. */
const itemBanco = (r) => {
  const decididoDepois = r.updated_at && r.created_at && (new Date(r.updated_at) - new Date(r.created_at)) > 60000;
  if (r.status === 'aprovado' && !decididoDepois)
    return { id: `bh:${r.id}`, tipo: 'banco', quando: r.created_at, titulo: `RH lançou ${horasTxt(r.horas_calculadas)} no seu banco`,
      sub: `${diaTxt(r.data)} · ${r.descricao || 'Horas extras'}`, destino: ['colaborador', 'horas'] };
  if ((r.status === 'aprovado' || r.status === 'rejeitado') && decididoDepois)
    return { id: `bh:${r.id}:${r.status}`, tipo: 'banco', quando: r.updated_at, ruim: r.status === 'rejeitado',
      titulo: r.status === 'aprovado' ? `Horas de ${diaTxt(r.data)} aprovadas` : `Horas de ${diaTxt(r.data)} recusadas`,
      sub: `${horasTxt(r.horas_calculadas)} · ${r.descricao || 'Horas extras'}`, destino: ['colaborador', 'horas'] };
  return null;                                  // pendente: foi a própria pessoa que registrou
};
const itemPrisma = (r) => {
  if (!['envio', 'presente', 'admin'].includes(r.kind)) return null;
  const txt = prismasTxt(r);
  if (!txt) return null;                        // retirada, ou envio que ELA fez (valor negativo)
  return { id: `ph:${r.id}`, tipo: 'prisma', quando: r.created_at, titulo: `Você recebeu ${txt}`,
    sub: r.descr || 'Prisma Store', destino: ['mercado-estelar', 'historico'] };
};
const itemConvite = (r) => ({ id: `gi:${r.id}`, tipo: 'convite', quando: r.created_at, jogo: r.game, sala: r.room_id,
  titulo: `${(r.from_name || 'Alguém').split(' ')[0]} te chamou pra jogar ${JOGO[r.game]?.nome || 'um jogo'}`,
  sub: r.room_name ? `Sala ${r.room_name}` : 'Toque pra entrar', destino: ['colaborador', JOGO[r.game]?.aba || 'inicio'] });
const itemEvento = (r) => ({ id: `ev:${r.id}`, tipo: 'evento', quando: r.created_at, titulo: `Novo na agenda: ${r.title || 'Evento'}`,
  sub: [diaTxt(r.event_date), r.event_time, r.type].filter(Boolean).join(' · '), destino: ['colaborador', 'eventos'] });

export const useCaixaEntrada = (authUser) => {
  const nome = authUser?.name;
  const chave = caixaKey(authUser);
  const [mapa, setMapa] = useState({});         // id → item
  const [lidos, setLidos] = useState(() => lerLidos(chave));

  useEffect(() => {
    if (!nome) return;
    let vivo = true;
    const juntar = (itens) => {
      const bons = itens.filter(Boolean);
      if (!vivo || !bons.length) return;
      setMapa(m => { const n = { ...m }; for (const it of bons) n[it.id] = it; return n; });
    };
    const buscar = async () => {
      const d = new Date(Date.now() - CAIXA_DIAS * 864e5).toISOString();
      const [bh, ph, gi, ev] = await Promise.all([
        supabase.from('banco_horas').select('id,data,descricao,horas_calculadas,status,created_at,updated_at')
          .eq('created_by', nome).gte('updated_at', d).order('updated_at', { ascending: false }).limit(CAIXA_MAX),
        supabase.from('mercado_history').select('id,kind,descr,comum,premium,created_at')
          .eq('player', nome).in('kind', ['envio', 'presente', 'admin']).gte('created_at', d).order('created_at', { ascending: false }).limit(CAIXA_MAX),
        supabase.from('game_invites').select('id,from_name,to_name,game,room_id,room_name,created_at')
          .eq('to_name', nome).gte('created_at', d).order('created_at', { ascending: false }).limit(CAIXA_MAX),
        supabase.from('calendar_events').select('id,title,event_date,event_time,type,created_by,created_at')
          .gte('created_at', d).order('created_at', { ascending: false }).limit(CAIXA_MAX),
      ].map(q => q.then(r => r.data || [], () => [])));
      juntar([...bh.map(itemBanco), ...ph.map(itemPrisma), ...gi.map(itemConvite),
        ...ev.filter(e => e.created_by !== nome).map(itemEvento)]);
    };
    buscar();
    const poll = setInterval(buscar, CAIXA_POLL_MS);

    // Nome único: o App já tem um canal de convites, e dois canais com o mesmo
    // nome no mesmo cliente se atropelam.
    const ch = supabase.channel('caixa-entrada-' + Math.random().toString(36).slice(2, 8))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banco_horas' },
        ({ new: r }) => { if (r?.created_by === nome) juntar([itemBanco(r)]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mercado_history' },
        ({ new: r }) => { if (r?.player === nome) juntar([itemPrisma(r)]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_invites' },
        ({ new: r }) => { if (r?.to_name === nome) juntar([itemConvite(r)]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events' },
        ({ new: r }) => { if (r && r.created_by !== nome) juntar([itemEvento(r)]); })
      .subscribe();

    return () => { vivo = false; clearInterval(poll); try { supabase.removeChannel(ch); } catch { /* ignora */ } };
  }, [nome]);

  const salvar = (next) => { setLidos(next); try { localStorage.setItem(chave, JSON.stringify(next)); } catch { /* ignora */ } };
  const excluidos = new Set(lidos.excluidos);
  const itens = Object.values(mapa)
    .filter(it => !excluidos.has(it.id))
    .sort((a, b) => String(b.quando).localeCompare(String(a.quando)))
    .slice(0, CAIXA_MAX)
    .map(it => ({ ...it, lido: !lidos.naoLido.includes(it.id)
      && (lidos.ids.includes(it.id) || (!!lidos.ate && String(it.quando) <= lidos.ate)) }));

  const semRepetir = (arr) => [...new Set(arr)];
  return {
    itens,
    naoLidos: itens.filter(i => !i.lido).length,
    marcarLido: (id) => salvar({ ...lidos, ids: semRepetir([...lidos.ids, id]).slice(-500), naoLido: lidos.naoLido.filter(x => x !== id) }),
    marcarNaoLido: (id) => salvar({ ...lidos, ids: lidos.ids.filter(x => x !== id), naoLido: semRepetir([...lidos.naoLido, id]).slice(-500) }),
    marcarTodos: () => salvar({ ...lidos, ids: [], naoLido: [], ate: new Date().toISOString() }),
    excluir: (ids) => salvar({ ...lidos, excluidos: semRepetir([...lidos.excluidos, ...ids]).slice(-1000) }),
    restaurar: (ids) => salvar({ ...lidos, excluidos: lidos.excluidos.filter(x => !ids.includes(x)) }),
  };
};
