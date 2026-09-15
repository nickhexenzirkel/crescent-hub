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
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../contexts/user';
import { isNonCheckinDay, localDateStr } from '../modules/mercado-estelar';
import { computePontoDays, loadColaboradorPonto } from './pontoCalc';
import { nomeChamado } from './nomeExibicao';

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
     • convite pra uma COLUNA do Trello (Conexão Setorial) compartilhada com ela;
     • Uniko Fit: curtida/comentário na foto dela, mensagem nova no grupo;
     • evento novo na agenda;
     • justificativa do ponto: a solicitação dela em análise, aprovada (o RH
       aceitou e abonou o dia) ou resolvida, e dias que o RH abonou direto;
     • atualização do sistema publicada pelo RH;
     • avisos do RH: urgentes, lembretes e comunicados.
   Justificativa RECUSADA não tem aviso: recusar, no Dashboard RH, apaga a
   solicitação — não sobra registro pra dizer que foi recusada.
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
   seria apagar dado de RH a partir de uma notificação.

   PERÍODO: o automático (tempo real + consulta a cada 45s) cobre só os
   últimos 60 dias, que é o que a caixa mostra de cara. Filtrar um mês mais
   antigo na janela chama `carregarDesde(data)`, que busca aquele trecho uma
   vez e junta no resto — sem pôr meses de histórico no polling de todo mundo. */
const CAIXA_DIAS = 60, CAIXA_MAX = 200, CAIXA_LOTE_ANTIGO = 500, CAIXA_POLL_MS = 45000;
const caixaKey = (authUser) => 'uniko_caixa_entrada_' + (authUser?.cpf || authUser?.name || 'anon').toLowerCase();
/* Versão do "lido": sobe quando a caixa passa a trazer um tipo novo de aviso.
   Numa conta nova ou que ainda não viu esta versão, tudo que chegou há mais de
   3 dias entra como lido UMA vez — senão quem abre a caixa pela primeira vez
   (ou logo depois de ganhar justificativas/avisos/atualizações) encontraria o
   selo com dezenas de "não lidas" antigas. Daí pra frente só o novo acende. */
const LIDOS_VERSAO = 2, LIDOS_JANELA_DIAS = 3;
const lerLidos = (k) => {
  const lista = (v) => (Array.isArray(v) ? v : []);
  try {
    const r = JSON.parse(localStorage.getItem(k) || '{}');
    const lidos = { ids: lista(r.ids), ate: r.ate || '', naoLido: lista(r.naoLido), excluidos: lista(r.excluidos), v: r.v || 0 };
    if (lidos.v < LIDOS_VERSAO) {
      const corte = new Date(Date.now() - LIDOS_JANELA_DIAS * 864e5).toISOString();
      if (corte > lidos.ate) lidos.ate = corte;
      lidos.v = LIDOS_VERSAO;
      localStorage.setItem(k, JSON.stringify(lidos));
    }
    return lidos;
  }
  catch { return { ids: [], ate: '', naoLido: [], excluidos: [], v: LIDOS_VERSAO }; }
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
    return { id: `bh:${r.id}`, tipo: 'banco', subtipo: 'rh', quando: r.created_at, titulo: `RH lançou ${horasTxt(r.horas_calculadas)} no seu banco`,
      sub: `${diaTxt(r.data)} · ${r.descricao || 'Horas extras'}`, destino: ['colaborador', 'horas'] };
  if ((r.status === 'aprovado' || r.status === 'rejeitado') && decididoDepois)
    return { id: `bh:${r.id}:${r.status}`, tipo: 'banco', subtipo: r.status === 'aprovado' ? 'aprovada' : 'recusada', quando: r.updated_at, ruim: r.status === 'rejeitado',
      titulo: r.status === 'aprovado' ? `Horas de ${diaTxt(r.data)} aprovadas` : `Horas de ${diaTxt(r.data)} recusadas`,
      sub: `${horasTxt(r.horas_calculadas)} · ${r.descricao || 'Horas extras'}`, destino: ['colaborador', 'horas'] };
  return null;                                  // pendente: foi a própria pessoa que registrou
};
const itemPrisma = (r) => {
  if (!['envio', 'presente', 'admin'].includes(r.kind)) return null;
  const txt = prismasTxt(r);
  if (!txt) return null;                        // retirada, ou envio que ELA fez (valor negativo)
  return { id: `ph:${r.id}`, tipo: 'prisma', subtipo: { envio: 'colega', presente: 'presente', admin: 'rh' }[r.kind], quando: r.created_at, titulo: `Você recebeu ${txt}`,
    sub: r.descr || 'Prisma Store', destino: ['mercado-estelar', 'historico'] };
};
const itemConvite = (r) => ({ id: `gi:${r.id}`, tipo: 'convite', subtipo: r.game, quando: r.created_at, jogo: r.game, sala: r.room_id,
  titulo: `${r.from_name ? nomeChamado(r.from_name) : 'Alguém'} te chamou pra jogar ${JOGO[r.game]?.nome || 'um jogo'}`,
  sub: r.room_name ? `Sala ${r.room_name}` : 'Toque pra entrar', destino: ['colaborador', JOGO[r.game]?.aba || 'inicio'] });
// Convite pra uma COLUNA do Trello (Conexão Setorial) — não a sala inteira. Ver
// listShares.js/conexao-setorial (guestListIds). shareId carrega pro clique
// deixar o convite "pendente" pro Trello mostrar o aceitar/recusar ao abrir.
const itemListaCompartilhada = (r) => ({ id: `cls:${r.id}`, tipo: 'lista_compartilhada', subtipo: 'pendente', quando: r.created_at, shareId: r.id,
  titulo: `${r.from_name ? nomeChamado(r.from_name) : 'Alguém'} compartilhou a coluna "${r.list_title}" com você no Trello`,
  sub: r.room_name ? `Sala ${r.room_name} · Toque pra ver e aceitar` : 'Toque pra ver e aceitar', destino: ['conexao-setorial'] });
// Uniko Fit — curtida/comentário na SUA foto e mensagem no grupo (chat geral).
const itemFitCurtida = (r) => {
  const dono = r.uniko_fit_checkins?.player;
  if (!dono || r.player === dono) return null;
  return { id: `fr:${r.id}`, tipo: 'fit', subtipo: 'curtida', quando: r.created_at,
    titulo: `${nomeChamado(r.player)} curtiu sua foto no Uniko Fit`, sub: r.emoji ? `Reação ${r.emoji}` : 'Toque pra ver', destino: ['uniko-fit'] };
};
const itemFitComentario = (r) => {
  const dono = r.uniko_fit_checkins?.player;
  if (!dono || r.player === dono) return null;
  return { id: `fc:${r.id}`, tipo: 'fit', subtipo: 'comentario', quando: r.created_at,
    titulo: `${nomeChamado(r.player)} comentou na sua foto no Uniko Fit`, sub: r.texto || 'Toque pra ver', destino: ['uniko-fit'] };
};
const itemFitChat = (r) => ({ id: `fch:${r.id}`, tipo: 'fit', subtipo: 'chat', quando: r.created_at,
  titulo: `${nomeChamado(r.player)} mandou mensagem no grupo do Uniko Fit`,
  sub: r.tipo === 'imagem' ? '📷 Imagem' : r.tipo === 'audio' ? '🎤 Áudio' : (r.texto || ''), destino: ['uniko-fit'] });
const itemEvento = (r) => ({ id: `ev:${r.id}`, tipo: 'evento', subtipo: r.type || 'Evento', quando: r.created_at, titulo: `Novo na agenda: ${r.title || 'Evento'}`,
  sub: [diaTxt(r.event_date), r.event_time, r.type].filter(Boolean).join(' · '), destino: ['colaborador', 'eventos'] });

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

/* Solicitação de justificativa do ponto. `abonos` = { 'AAAA-MM-DD': justificativa }
   do colaborador, pra saber se o "resolvido" foi um aceite (abonou o dia). */
const itemSolicitacao = (r, abonos) => {
  const dia = diaTxt(r.data_ref);
  if (r.status === 'pendente')
    return { id: `ps:${r.id}:pendente`, tipo: 'justificativa', subtipo: 'andamento', quando: r.created_at,
      titulo: `Justificativa em análise: ${r.titulo || 'ponto'}`, sub: `${dia ? dia + ' · ' : ''}aguardando o RH`, destino: ['colaborador', 'ponto'] };
  const abono = r.data_ref && abonos[r.data_ref];
  return { id: `ps:${r.id}:resolvido`, tipo: 'justificativa', subtipo: abono ? 'aprovada' : 'resolvida',
    quando: abono?.updated_at || r.created_at,
    titulo: abono ? `Justificativa de ${dia} aprovada` : `Justificativa${dia ? ' de ' + dia : ''} resolvida pelo RH`,
    sub: abono ? `${r.titulo || 'Ponto'} · dia abonado no seu ponto` : (r.titulo || 'Ponto'), destino: ['colaborador', 'ponto'] };
};
const itemAbono = (j) => (j.texto && j.abonado !== false ? {
  id: `pj:${j.cpf}:${j.data}`, tipo: 'justificativa', subtipo: 'abonada', quando: j.updated_at,
  titulo: `RH abonou seu ponto de ${diaTxt(j.data)}`, sub: j.texto, destino: ['colaborador', 'ponto'],
} : null);
const itemAtualizacao = (r) => (r.active === false ? null : {
  id: `at:${r.id}`, tipo: 'atualizacao', subtipo: 'sistema', quando: r.created_at,
  titulo: r.titulo || 'Atualização do Uniko', sub: r.descricao || (r.imagem_url ? 'Toque pra ver a novidade' : 'Novidade no sistema'),
  corpo: r.descricao || '', imagem: r.imagem_url || null,
});
const itemAviso = (r) => (r.active === false ? null : {
  id: `nt:${r.id}`, tipo: 'aviso', subtipo: r.type === 'aviso_urgente' ? 'urgente' : 'lembrete', quando: r.created_at,
  titulo: r.type === 'aviso_urgente' ? `Aviso urgente: ${r.title || ''}` : (r.title || 'Aviso do RH'),
  sub: r.message || 'Aviso do RH', corpo: r.message || '', ruim: r.type === 'aviso_urgente',
});
const itemComunicado = (r) => (r.active === false ? null : {
  id: `cm:${r.id}`, tipo: 'aviso', subtipo: 'comunicado', quando: r.created_at,
  titulo: `Comunicado: ${r.title || ''}`, sub: r.body || r.cat || 'Comunicado do RH', destino: ['colaborador', 'comunicados'],
});

export const useCaixaEntrada = (authUser) => {
  const nome = authUser?.name;
  const cpf = soDigitos(authUser?.cpf);
  const chave = caixaKey(authUser);
  const [mapa, setMapa] = useState({});         // id → item
  const [lidos, setLidos] = useState(() => lerLidos(chave));
  // Mais de um lugar usa a caixa (widget do menu + contador no título da aba): quando
  // um marca como lido, os outros releem na hora. Também relê ao trocar de conta.
  useEffect(() => {
    setLidos(lerLidos(chave));
    const reler = (e) => { if (!e.detail || e.detail === chave) setLidos(lerLidos(chave)); };
    const outraAba = (e) => { if (e.key === chave) setLidos(lerLidos(chave)); };
    window.addEventListener('uniko-caixa-lidos', reler);
    window.addEventListener('storage', outraAba);
    return () => { window.removeEventListener('uniko-caixa-lidos', reler); window.removeEventListener('storage', outraAba); };
  }, [chave]);

  const vivoRef = useRef(true);
  useEffect(() => { vivoRef.current = true; return () => { vivoRef.current = false; }; }, []);
  /* `sair(item)` opcional: tira do mapa o que ficou velho (a solicitação que
     estava "em análise" e agora voltou "resolvida", ou foi apagada). */
  const juntar = useCallback((itens, sair) => {
    const bons = itens.filter(Boolean);
    if (!vivoRef.current || (!bons.length && !sair)) return;
    setMapa(m => {
      const n = { ...m };
      if (sair) for (const id of Object.keys(n)) if (sair(n[id])) delete n[id];
      for (const it of bons) n[it.id] = it;
      return n;
    });
  }, []);

  /* Uma consulta a todas as fontes entre `de` e `ate` (ISO; `ate` opcional). */
  const consultar = useCallback(async (de, ate, limite) => {
    if (!nome) return;
    const faixa = (q, col) => { q = q.gte(col, de); if (ate) q = q.lt(col, ate); return q.order(col, { ascending: false }).limit(limite); };
    const [bh, ph, gi, ev, ps, at, nt, cm, cls, fr, fc, fch] = await Promise.all([
      faixa(supabase.from('banco_horas').select('id,data,descricao,horas_calculadas,status,created_at,updated_at').eq('created_by', nome), 'updated_at'),
      faixa(supabase.from('mercado_history').select('id,kind,descr,comum,premium,created_at').eq('player', nome).in('kind', ['envio', 'presente', 'admin']), 'created_at'),
      faixa(supabase.from('game_invites').select('id,from_name,to_name,game,room_id,room_name,created_at').eq('to_name', nome), 'created_at'),
      faixa(supabase.from('calendar_events').select('id,title,event_date,event_time,type,created_by,created_at'), 'created_at'),
      faixa(cpf ? supabase.from('ponto_solicitacoes').select('id,cpf,ponto_cpf,titulo,data_ref,status,created_at').eq('cpf', cpf)
                : supabase.from('ponto_solicitacoes').select('id,cpf,ponto_cpf,titulo,data_ref,status,created_at').eq('nome', nome), 'created_at'),
      faixa(supabase.from('atualizacoes').select('id,titulo,descricao,imagem_url,active,created_at').eq('active', true), 'created_at'),
      faixa(supabase.from('notifications').select('id,type,title,message,active,created_at').eq('active', true), 'created_at'),
      faixa(supabase.from('comunicados').select('id,title,body,cat,active,created_at').eq('active', true), 'created_at'),
      faixa(supabase.from('conexao_list_shares').select('id,from_name,to_name,room_name,list_title,status,created_at').eq('to_name', nome), 'created_at'),
      faixa(supabase.from('uniko_fit_reactions').select('id,player,emoji,created_at,uniko_fit_checkins(player)'), 'created_at'),
      faixa(supabase.from('uniko_fit_comments').select('id,player,texto,created_at,uniko_fit_checkins(player)'), 'created_at'),
      faixa(supabase.from('uniko_fit_chat').select('id,player,texto,tipo,created_at').neq('tipo', 'checkin'), 'created_at'),
    ].map(q => q.then(r => r.data || [], () => [])));

    /* Abonos do ponto: pelo id de ponto que as solicitações usam (PIS) e pelo
       CPF. Um só pedido, que ainda liga "resolvido" a "aprovado". */
    const idsPonto = [...new Set([cpf, ...ps.map(x => x.ponto_cpf), ...ps.map(x => x.cpf)].filter(Boolean))];
    const pj = idsPonto.length
      ? await faixa(supabase.from('ponto_justificativas').select('cpf,data,texto,abonado,updated_at').in('cpf', idsPonto), 'updated_at')
          .then(r => r.data || [], () => [])
      : [];
    const abonos = {};
    for (const j of pj) if (j.abonado !== false) abonos[j.data] = j;
    const diasDeSolicitacao = new Set(ps.filter(x => x.status !== 'pendente').map(x => x.data_ref));
    const idsAtuais = new Set(ps.map(x => itemSolicitacao(x, abonos).id));
    // Convite de coluna do Trello: só mostra enquanto "pendente" — aceito/recusado sai sozinho.
    const idsClsPendentes = new Set(cls.filter(x => x.status === 'pendente').map(x => `cls:${x.id}`));

    juntar([...bh.map(itemBanco), ...ph.map(itemPrisma), ...gi.map(itemConvite),
      ...ev.filter(e => e.created_by !== nome).map(itemEvento),
      ...ps.map(x => itemSolicitacao(x, abonos)),
      // abono que veio de uma solicitação já aparece como "aprovada" — não repete
      ...pj.filter(j => !diasDeSolicitacao.has(j.data)).map(itemAbono),
      ...at.map(itemAtualizacao), ...nt.map(itemAviso), ...cm.map(itemComunicado),
      ...cls.filter(x => x.status === 'pendente').map(itemListaCompartilhada),
      ...fr.map(itemFitCurtida), ...fc.map(itemFitComentario),
      ...fch.filter(x => x.player !== nome).map(itemFitChat)],
    // Registro desta faixa que mudou de estado ou sumiu: a versão velha sai do
    // mapa (solicitação de ponto resolvida/recusada, convite de coluna decidido).
    (it) => ((it.id.startsWith('ps:') && !idsAtuais.has(it.id)) || (it.id.startsWith('cls:') && !idsClsPendentes.has(it.id)))
      && String(it.quando) >= de && (!ate || String(it.quando) < ate));
  }, [nome, cpf, juntar]);

  // Até onde já foi carregado pra trás (ISO). Começa nos 60 dias automáticos.
  const [desde, setDesde] = useState(() => new Date(Date.now() - CAIXA_DIAS * 864e5).toISOString());
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const carregarDesde = useCallback(async (de) => {
    if (!de || de >= desde) return;
    setCarregandoAntigas(true);
    await consultar(de, desde, CAIXA_LOTE_ANTIGO);
    if (vivoRef.current) { setDesde(de); setCarregandoAntigas(false); }
  }, [desde, consultar]);

  useEffect(() => {
    if (!nome) return;
    const buscar = () => consultar(new Date(Date.now() - CAIXA_DIAS * 864e5).toISOString(), null, CAIXA_MAX);
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
      // Justificativa depende de duas tabelas (solicitação + abono) e o aceite
      // mexe nas duas quase juntas: em vez de montar o item pela metade, refaz a
      // consulta. É barato e só roda quando alguém mexe no ponto.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ponto_solicitacoes' }, () => buscar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ponto_justificativas' }, () => buscar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'atualizacoes' },
        ({ new: r }) => { if (r) juntar([itemAtualizacao(r)]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        ({ new: r }) => { if (r) juntar([itemAviso(r)]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comunicados' },
        ({ new: r }) => { if (r) juntar([itemComunicado(r)]); })
      // Convite de coluna do Trello: o payload do realtime não traz o join com a
      // sala/lista (isso já vem no INSERT em si), então dá pra montar direto; já
      // aceitar/recusar só muda o status — refaz a consulta pra sumir da caixa.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conexao_list_shares' },
        ({ new: r }) => { if (r?.to_name === nome && r.status === 'pendente') juntar([itemListaCompartilhada(r)]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conexao_list_shares' }, () => buscar())
      // Uniko Fit: reação/comentário dependem de saber o DONO do check-in (join
      // que o payload do realtime não traz) — refaz a consulta, é barata.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_reactions' }, () => buscar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_comments' }, () => buscar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uniko_fit_chat' },
        ({ new: r }) => { if (r && r.player !== nome && r.tipo !== 'checkin') juntar([itemFitChat(r)]); })
      .subscribe();

    return () => { clearInterval(poll); try { supabase.removeChannel(ch); } catch { /* ignora */ } };
  }, [nome, consultar, juntar]);

  const salvar = (next) => {
    setLidos(next);
    try { localStorage.setItem(chave, JSON.stringify(next)); } catch { /* ignora */ }
    try { window.dispatchEvent(new CustomEvent('uniko-caixa-lidos', { detail: chave })); } catch { /* ignora */ }
  };
  const excluidos = new Set(lidos.excluidos);
  const itens = Object.values(mapa)
    .filter(it => !excluidos.has(it.id))
    .sort((a, b) => String(b.quando).localeCompare(String(a.quando)))
    .map(it => ({ ...it, lido: !lidos.naoLido.includes(it.id)
      && (lidos.ids.includes(it.id) || (!!lidos.ate && String(it.quando) <= lidos.ate)) }));

  const semRepetir = (arr) => [...new Set(arr)];
  const [janelaAuto] = useState(() => new Date(Date.now() - CAIXA_DIAS * 864e5).toISOString());
  return {
    itens,
    desde, carregarDesde, carregandoAntigas,
    // O selo só conta a janela automática: consultar um mês antigo na janela
    // não pode fazer o número vermelho do widget pular de 3 pra 30.
    naoLidos: itens.filter(i => !i.lido && String(i.quando) >= janelaAuto).length,
    marcarLido: (id) => salvar({ ...lidos, ids: semRepetir([...lidos.ids, id]).slice(-500), naoLido: lidos.naoLido.filter(x => x !== id) }),
    marcarNaoLido: (id) => salvar({ ...lidos, ids: lidos.ids.filter(x => x !== id), naoLido: semRepetir([...lidos.naoLido, id]).slice(-500) }),
    marcarTodos: () => salvar({ ...lidos, ids: [], naoLido: [], ate: new Date().toISOString() }),
    excluir: (ids) => salvar({ ...lidos, excluidos: semRepetir([...lidos.excluidos, ...ids]).slice(-1000) }),
    restaurar: (ids) => salvar({ ...lidos, excluidos: lidos.excluidos.filter(x => !ids.includes(x)) }),
  };
};
