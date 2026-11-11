import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../../contexts/theme';
import { MUNICIPIOS } from '../../email';
import { getFaturamento } from '../../email/api';
import { agruparMensagensPorConversa, assuntoIndicaFaturamento, formatarDataTempoReal, municipioExibidoNoAssunto, periodoFaturadoDoAssunto, secretariaFaturadaDoAssunto } from '../faturamentoEmailUtils';
import {
  carregarCoresRegionais,
  carregarCadastroFaturamento,
  carregarEstadoNotificacoesFaturamento,
  corPadraoRegional,
  chaveRegionalFaturamento,
  emitirNotificacaoFaturamento,
  normalizarCadastroFaturamento,
  nomeRegionalFaturamento,
  ouvirCadastroFaturamento,
  REGIONAIS_FATURAMENTO,
  salvarEstadoNotificacoesFaturamento,
  carregarVinculosRegionaisFaturamento,
} from '../../../shared/faturamentoComerciais';

const REGIONAIS = REGIONAIS_FATURAMENTO.map(regional => ({
  ...regional,
  nome: `Regional ${regional.nome}`,
}));
const INTERVALO_SINCRONIZACAO_MS = 15 * 60 * 1000;

const normalizar = valor => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

function municipioDaMensagem(mensagem, clientes = []) {
  const texto = normalizar(`${mensagem.subject} ${mensagem.to} ${mensagem.snippet}`);
  const compacto = texto.replace(/\s/g, '');
  const nomes = [...new Set([...MUNICIPIOS, ...clientes.map(cliente => cliente.municipio)])]
    .sort((a, b) => b.length - a.length);
  return nomes.find(nome => {
    const municipio = normalizar(nome);
    const comEspacos = ` ${texto} `.includes(` ${municipio} `);
    const semEspacos = municipio.replace(/\s/g, '');
    return comEspacos || (semEspacos.length >= 7 && compacto.includes(semEspacos));
  }) || '';
}

function regionaisDaMensagem(mensagem) {
  const texto = ` ${normalizar(`${mensagem.subject} ${mensagem.to} ${mensagem.snippet} ${mensagem.from}`)} `;
  return REGIONAIS.filter(regional => regional.aliases.some(alias => {
    const termo = normalizar(alias);
    return texto.includes(` ${termo} `);
  }));
}

function mesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function intervaloDoMes(valor) {
  const [ano, mes] = valor.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${valor}-01`,
    fim: `${valor}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function hojeLocal() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function dataCurta(valor) {
  if (!valor) return '';
  return new Date(`${valor}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatarData(valor) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data indisponível';
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const dias = Math.round((inicioHoje - inicioData) / 86_400_000);
  const dia = dias === 0
    ? 'Hoje'
    : dias === 1
      ? 'Ontem'
      : data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(/\.$/, '');
  return `${dia}, ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function nomeRemetente(valor) {
  const texto = String(valor || '').trim();
  const nome = texto.match(/^"?([^"<]+?)"?\s*<[^<>]+>$/)?.[1]?.trim();
  return nome || texto.match(/<([^<>]+)>/)?.[1] || texto || 'Não identificado';
}

function nomeRegional(mensagem) {
  return mensagem.regionais[0]?.nome.replace(/^Regional\s+/i, '') || 'Não identificada';
}

function nomeRegionalCadastro(nome) {
  return `Regional ${nomeRegionalFaturamento(nome)}`;
}

function dataFortaleza(valor) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(valor));
}

function mesPorExtenso(valor) {
  if (!valor) return '';
  const [ano, mes] = valor.split('-').map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function corTextoFundo(hex) {
  const valores = hex.match(/[0-9a-f]{2}/gi)?.map(valor => parseInt(valor, 16) / 255) || [0, 0, 0];
  const linear = valores.map(valor => valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.42 ? '#17212B' : '#FFFFFF';
}

async function notificarFaturamentosNovos(resultado, iniciouEm, clientes, vinculos) {
  const mailbox = String(resultado.mailbox || '').trim().toLowerCase();
  if (!mailbox || resultado.cached) return '';
  try {
    const estado = await carregarEstadoNotificacoesFaturamento(mailbox);
    if (!estado) {
      await salvarEstadoNotificacoesFaturamento(mailbox, iniciouEm);
      return '';
    }

    for (const mensagem of resultado.messages || []) {
      if (!assuntoIndicaFaturamento(mensagem.subject)) continue;
      const faturadoEm = Date.parse(mensagem.date || '');
      if (!Number.isFinite(faturadoEm)) continue;
      const depoisDoInicio = faturadoEm > Date.parse(estado.iniciadoEm);
      const mesmoDiaDaAtivacao = dataFortaleza(faturadoEm) === dataFortaleza(estado.iniciadoEm);
      if (!depoisDoInicio && !mesmoDiaDaAtivacao) continue;
      const municipio = municipioDaMensagem(mensagem, clientes);
      const cadastro = clientes.find(cliente => normalizarCadastroFaturamento(cliente.municipio) === normalizarCadastroFaturamento(municipio));
      if (!cadastro?.regional) continue;
      const regional = nomeRegionalFaturamento(cadastro.regional);
      const recipientId = vinculos[chaveRegionalFaturamento(regional)];
      if (!recipientId) continue;
      await emitirNotificacaoFaturamento({
        messageId: mensagem.id,
        threadId: mensagem.threadId,
        mailbox,
        recipientId,
        municipio,
        regional,
        faturista: cadastro.responsavelFaturamento || mensagem.senderName || nomeRemetente(mensagem.from),
        faturadoEm,
      });
    }
    return '';
  } catch (error) {
    return `Os dados foram carregados, mas não foi possível emitir a notificação de faturamento: ${error.message || 'erro desconhecido'}`;
  }
}

const estiloBotao = {
  border: `1px solid ${T.border}`,
  borderRadius: 9,
  padding: '9px 13px',
  color: T.text,
  background: T.surface,
  cursor: 'pointer',
  font: '600 13px var(--font-body)',
};

export default function TabFaturamento({ onOpenEmail }) {
  const [periodo, setPeriodo] = useState(mesAtual);
  const [periodoRascunho, setPeriodoRascunho] = useState(mesAtual);
  const [modoPeriodo, setModoPeriodo] = useState('mes');
  const [modoPeriodoRascunho, setModoPeriodoRascunho] = useState('mes');
  const [dataInicio, setDataInicio] = useState(() => intervaloDoMes(mesAtual()).inicio);
  const [dataInicioRascunho, setDataInicioRascunho] = useState(() => intervaloDoMes(mesAtual()).inicio);
  const [dataFim, setDataFim] = useState(hojeLocal);
  const [dataFimRascunho, setDataFimRascunho] = useState(hojeLocal);
  const [dados, setDados] = useState(null);
  const [busca, setBusca] = useState('');
  const [buscaRascunho, setBuscaRascunho] = useState('');
  const [regionalSelecionada, setRegionalSelecionada] = useState('');
  const [regionalRascunho, setRegionalRascunho] = useState('');
  const [pagina, setPagina] = useState(1);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [cadastroClientes, setCadastroClientes] = useState([]);
  const [cadastroCarregado, setCadastroCarregado] = useState(false);
  const [coresRegionais, setCoresRegionais] = useState({});
  const [erroCadastro, setErroCadastro] = useState('');
  const [quotaAte, setQuotaAte] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const requisicaoAtual = useRef(0);
  const quotaAteRef = useRef(0);
  const cadastroNotificacaoRef = useRef({ clientes: [], vinculos: {} });
  const filtroConsulta = useMemo(() => modoPeriodo === 'mes'
    ? { month: periodo }
    : { startDate: dataInicio, endDate: dataFim }, [modoPeriodo, periodo, dataInicio, dataFim]);
  const consultaKey = modoPeriodo === 'mes'
    ? `month:${periodo}`
    : `date:${dataInicio}:${dataFim}`;
  const segundosEspera = Math.max(0, Math.ceil((quotaAte - agora) / 1000));
  const periodoValido = modoPeriodo === 'mes' || (dataInicio && dataFim && dataFim >= dataInicio);
  const filtrosRascunhoValidos = modoPeriodoRascunho === 'mes'
    || (dataInicioRascunho && dataFimRascunho && dataFimRascunho >= dataInicioRascunho);

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const aplicarFiltros = () => {
    setPeriodo(periodoRascunho);
    setModoPeriodo(modoPeriodoRascunho);
    setDataInicio(dataInicioRascunho);
    setDataFim(dataFimRascunho);
    setBusca(buscaRascunho.trim());
    setRegionalSelecionada(regionalRascunho);
    setPagina(1);
    setPaginaHistorico(1);
  };

  useEffect(() => {
    let vivo = true;
    const carregarCadastro = async () => {
      try {
        const [clientes, cores, vinculos] = await Promise.all([
          carregarCadastroFaturamento(),
          carregarCoresRegionais(),
          carregarVinculosRegionaisFaturamento(),
        ]);
        if (vivo) {
          setCadastroClientes(clientes);
          setCoresRegionais(cores);
          cadastroNotificacaoRef.current = { clientes, vinculos };
          setErroCadastro('');
        }
      } catch (error) {
        if (vivo) {
          setErroCadastro(error.message || 'Não foi possível carregar as associações comerciais.');
          cadastroNotificacaoRef.current = { clientes: [], vinculos: {} };
        }
      } finally {
        if (vivo) setCadastroCarregado(true);
      }
    };
    carregarCadastro();
    const removerOuvinte = ouvirCadastroFaturamento(carregarCadastro);
    return () => {
      vivo = false;
      removerOuvinte();
    };
  }, []);

  useEffect(() => {
    if (!segundosEspera) return undefined;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [segundosEspera]);

  const atualizar = useCallback(async (silencioso = false, forcar = false) => {
    if (Date.now() < quotaAteRef.current) return;
    const requisicao = ++requisicaoAtual.current;
    setAtualizando(true);
    if (!silencioso) setCarregando(true);
    setErro('');
    if (!periodoValido) {
      setErro('A data final precisa ser igual ou posterior à data inicial.');
      setCarregando(false);
      setAtualizando(false);
      return;
    }
    try {
      const iniciouEm = new Date().toISOString();
      const resultado = await getFaturamento(filtroConsulta, '', { force: forcar });
      if (requisicao !== requisicaoAtual.current) return;
      setDados(anterior => {
        if (anterior?.filterKey !== consultaKey) return resultado;
        const idsRecentes = new Set((resultado.messages || []).map(mensagem => mensagem.id));
        const mensagensAntigas = anterior.messages.filter(mensagem => !idsRecentes.has(mensagem.id));
        return {
          ...resultado,
          messages: [...resultado.messages, ...mensagensAntigas],
          nextPageToken: anterior.loadedMore ? anterior.nextPageToken : resultado.nextPageToken,
          loadedMore: anterior.loadedMore,
        };
      });
      const { clientes, vinculos } = cadastroNotificacaoRef.current;
      const avisoNotificacao = await notificarFaturamentosNovos(resultado, iniciouEm, clientes, vinculos);
      setAviso(resultado.warning || avisoNotificacao);
      setAtualizadoEm(resultado.cachedAt ? new Date(resultado.cachedAt) : new Date());
    } catch (error) {
      if (requisicao === requisicaoAtual.current) {
        setErro(error.message || 'Não foi possível consultar os faturamentos.');
        const espera = Number(error.retryAfter) || 0;
        if (espera > 0) {
          quotaAteRef.current = Date.now() + espera * 1000;
          setQuotaAte(quotaAteRef.current);
          setAgora(Date.now());
        }
      }
    } finally {
      if (requisicao === requisicaoAtual.current) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, [consultaKey, filtroConsulta, periodoValido]);

  const carregarMais = async () => {
    const token = dados?.nextPageToken;
    if (!token || carregandoMais || segundosEspera > 0 || !periodoValido) return;
    setCarregandoMais(true);
    setErro('');
    try {
      const iniciouEm = new Date().toISOString();
      const resultado = await getFaturamento(filtroConsulta, token);
      const { clientes, vinculos } = cadastroNotificacaoRef.current;
      const avisoNotificacao = await notificarFaturamentosNovos(resultado, iniciouEm, clientes, vinculos);
      setDados(anterior => {
        if (anterior?.filterKey !== consultaKey) return anterior;
        const ids = new Set(anterior.messages.map(mensagem => mensagem.id));
        return {
          ...anterior,
          messages: [...anterior.messages, ...resultado.messages.filter(mensagem => !ids.has(mensagem.id))],
          nextPageToken: resultado.nextPageToken || '',
          truncated: Boolean(resultado.nextPageToken),
          loadedMore: true,
        };
      });
      setAviso(resultado.warning || avisoNotificacao);
      setAtualizadoEm(resultado.cachedAt ? new Date(resultado.cachedAt) : new Date());
    } catch (error) {
      setErro(error.message || 'Não foi possível carregar mais registros.');
      const espera = Number(error.retryAfter) || 0;
      if (espera > 0) {
        quotaAteRef.current = Date.now() + espera * 1000;
        setQuotaAte(quotaAteRef.current);
        setAgora(Date.now());
      }
    } finally {
      setCarregandoMais(false);
    }
  };

  useEffect(() => {
    if (!cadastroCarregado) return undefined;
    const primeiraConsulta = window.setTimeout(() => atualizar(false, true), 0);
    const sincronizacaoAutomatica = window.setInterval(() => {
      if (document.visibilityState === 'visible') atualizar(true, true);
    }, INTERVALO_SINCRONIZACAO_MS);
    return () => {
      window.clearTimeout(primeiraConsulta);
      window.clearInterval(sincronizacaoAutomatica);
      requisicaoAtual.current += 1;
    };
  }, [atualizar, cadastroCarregado]);

  const dadosDoPeriodo = dados?.filterKey === consultaKey ? dados : null;
  const mensagens = useMemo(() => {
    const mapeadas = (dadosDoPeriodo?.messages || [])
      .map(mensagem => {
        const municipio = municipioDaMensagem(mensagem, cadastroClientes);
        const cadastro = cadastroClientes.find(cliente => normalizarCadastroFaturamento(cliente.municipio) === normalizarCadastroFaturamento(municipio));
        const regionalConfigurada = cadastro?.regional ? [nomeRegionalCadastro(cadastro.regional)] : [];
        return {
          ...mensagem,
          municipio: municipioExibidoNoAssunto(mensagem.subject, municipio),
          secretaria: secretariaFaturadaDoAssunto(mensagem.subject),
          periodoFaturado: periodoFaturadoDoAssunto(mensagem.subject),
          responsavelFaturamento: cadastro?.responsavelFaturamento || '',
          regionais: regionalConfigurada.length ? regionalConfigurada.map(nome => ({ nome, aliases: [] })) : regionaisDaMensagem(mensagem),
        };
      })
      .filter(mensagem => mensagem.municipio && assuntoIndicaFaturamento(mensagem.subject));
    return agruparMensagensPorConversa(mapeadas)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dadosDoPeriodo, cadastroClientes]);
  const regionaisExibidas = useMemo(() => {
    const mapa = new Map(REGIONAIS.map(regional => [normalizarCadastroFaturamento(regional.nome), regional]));
    cadastroClientes.forEach(cliente => {
      if (cliente.regional) {
        const nome = nomeRegionalCadastro(cliente.regional);
        mapa.set(normalizarCadastroFaturamento(nome), { nome, aliases: [] });
      }
    });
    return [...mapa.values()];
  }, [cadastroClientes]);
  const mensagensVisiveis = useMemo(() => regionalSelecionada
    ? mensagens.filter(mensagem => mensagem.regionais.some(regional => regional.nome === regionalSelecionada))
    : mensagens, [mensagens, regionalSelecionada]);
  const registrosFiltrados = useMemo(() => mensagensVisiveis
    .filter(mensagem => normalizar(mensagem.municipio).includes(normalizar(busca))), [busca, mensagensVisiveis]);
  const registrosAgrupadosPorMunicipio = useMemo(() => {
    const grupos = new Map();
    registrosFiltrados.forEach(mensagem => {
      if (!grupos.has(mensagem.municipio)) grupos.set(mensagem.municipio, []);
      grupos.get(mensagem.municipio).push(mensagem);
    });
    return [...grupos.values()].flat();
  }, [registrosFiltrados]);
  const registrosPorPagina = 11;
  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / registrosPorPagina));
  const paginaExibida = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosAgrupadosPorMunicipio.slice((paginaExibida - 1) * registrosPorPagina, paginaExibida * registrosPorPagina);
  const registrosPaginaComAgrupamento = registrosPagina.map((mensagem, indice) => {
    const municipioAnterior = registrosPagina[indice - 1]?.municipio;
    if (municipioAnterior === mensagem.municipio) return { ...mensagem, exibirMunicipio: false };
    let quantidade = 1;
    while (registrosPagina[indice + quantidade]?.municipio === mensagem.municipio) quantidade += 1;
    return { ...mensagem, exibirMunicipio: true, linhasMunicipio: quantidade };
  });
  const registrosHistoricoPorPagina = 10;
  const totalPaginasHistorico = Math.max(1, Math.ceil(registrosFiltrados.length / registrosHistoricoPorPagina));
  const paginaHistoricoExibida = Math.min(paginaHistorico, totalPaginasHistorico);
  const registrosHistoricoPagina = registrosAgrupadosPorMunicipio.slice(
    (paginaHistoricoExibida - 1) * registrosHistoricoPorPagina,
    paginaHistoricoExibida * registrosHistoricoPorPagina,
  );
  const registrosHistoricoComAgrupamento = registrosHistoricoPagina.map((mensagem, indice) => {
    const municipioAnterior = registrosHistoricoPagina[indice - 1]?.municipio;
    if (municipioAnterior === mensagem.municipio) return { ...mensagem, exibirMunicipio: false };
    let quantidade = 1;
    while (registrosHistoricoPagina[indice + quantidade]?.municipio === mensagem.municipio) quantidade += 1;
    return { ...mensagem, exibirMunicipio: true, linhasMunicipio: quantidade };
  });
  const corRegional = mensagem => {
    const nome = mensagem.regionais[0]?.nome;
    if (!nome) return T.textT;
    return coresRegionais[chaveRegionalFaturamento(nome)] || corPadraoRegional(nome);
  };
  const remetenteExibido = mensagem => mensagem.responsavelFaturamento || mensagem.senderName || nomeRemetente(mensagem.from);
  const tituloPeriodo = modoPeriodo === 'mes'
    ? mesPorExtenso(periodo)
    : `${dataCurta(dataInicio)} a ${dataCurta(dataFim)}`;

  return (
    <div style={{ maxWidth: 1480, margin: '0 auto', color: T.text, fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes faturamentoPulse { 50% { opacity: .35; transform: scale(.82); } }
        @media (prefers-reduced-motion: reduce) { .faturamento-pulse { animation: none !important; } }
        @media (max-width: 1050px) { .faturamento-grade { grid-template-columns: minmax(0,1fr) !important; } }
        @media (max-width: 700px) { .faturamento-regional { overflow-x: auto; flex-wrap: nowrap !important; padding-bottom: 4px; } .faturamento-regional button { flex-shrink: 0; } .faturamento-filtros { flex-direction: column; align-items: stretch !important; } .faturamento-filtros label, .faturamento-filtros input { width: 100% !important; box-sizing: border-box; } .faturamento-filtros-separador { display: none; } }
      `}</style>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: 16, display: 'grid', placeItems: 'center', color: T.gold, background: T.goldGl, border: `1px solid ${T.gold}66` }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 750, letterSpacing: '-.03em' }}>Acompanhar Faturamento</h1>
            <div style={{ marginTop: 4, color: T.textS, fontSize: 13.5 }}>Municípios com faturamento enviado, por regional.</div>
          </div>
        </div>
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 15px', borderRadius: 999, color: T.text, background: T.surface, border: `1px solid ${T.border}`, fontSize: 12.5 }}>
          <span className={!erro ? 'faturamento-pulse' : undefined} style={{ width: 9, height: 9, borderRadius: '50%', background: erro ? (T.danger || '#C04050') : (T.success || '#14B86E'), animation: erro ? undefined : `faturamentoPulse ${atualizando ? '0.8s' : '1.8s'} infinite` }} />
          {erro ? 'Não sincronizado' : atualizando ? 'Sincronizando…' : 'Sincronização ativa'}
        </div>
      </header>

      {erro && (
        <div role="alert" style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, color: T.danger || '#B42318', background: `${T.danger || '#B42318'}12`, border: `1px solid ${T.danger || '#B42318'}30`, fontSize: 13 }}>
          {erro}
          {/Conecte uma conta Gmail/i.test(erro) && (
            <button type="button" onClick={() => onOpenEmail?.()} style={{ ...estiloBotao, marginLeft: 10 }}>Abrir E-mail e conectar</button>
          )}
        </div>
      )}

      {aviso && (
        <div role="status" style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, color: T.text, background: T.goldGl, border: `1px solid ${T.gold}33`, fontSize: 12 }}>
          {aviso}
        </div>
      )}

      {dadosDoPeriodo?.nextPageToken && (
        <div role="status" style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, color: T.text, background: T.goldGl, border: `1px solid ${T.gold}33`, fontSize: 12 }}>
          Há mais resultados neste período. Carregue a próxima página para continuar o histórico.
        </div>
      )}

      <section style={{ marginBottom: 15, padding: '15px 16px', borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 13, borderBottom: `1px solid ${T.border}` }}>
          <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: T.textS }}>Regional</span>
          <div className="faturamento-regional" style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 7 }}>
            {[{ nome: '', label: 'Todas' }, ...regionaisExibidas.map(regional => ({ nome: regional.nome, label: regional.nome.replace(/^Regional\s+/i, '') }))].map(regional => {
              const ativa = regionalRascunho === regional.nome;
              const cor = regional.nome ? corRegional({ regionais: [regional] }) : T.gold;
              return (
                <button
                  type="button"
                  key={regional.nome || 'todas'}
                  aria-pressed={ativa}
                  onClick={() => setRegionalRascunho(regional.nome)}
                  style={{ padding: '8px 15px', border: `1px solid ${ativa ? cor : T.border}`, borderRadius: 999, color: ativa ? corTextoFundo(cor) : T.textS, background: ativa ? cor : 'transparent', cursor: 'pointer', font: '600 12px var(--font-body)', transition: 'all .15s', whiteSpace: 'nowrap' }}
                >
                  {regional.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="faturamento-filtros" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingTop: 13 }}>
          <label style={{ display: 'flex', flex: '1 1 200px', alignItems: 'center', gap: 9, minWidth: 180, padding: '0 12px', border: `1px solid ${T.border}`, borderRadius: 999, background: T.page || T.surface }}>
            <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={T.textS} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input
              type="search"
              value={buscaRascunho}
              onChange={event => setBuscaRascunho(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && filtrosRascunhoValidos) aplicarFiltros(); }}
              placeholder="Buscar município..."
              aria-label="Buscar município"
              style={{ width: '100%', padding: '12px 0', border: 0, outline: 'none', background: 'transparent', color: T.text, font: '13px var(--font-body)' }}
            />
          </label>
          <span aria-hidden="true" className="faturamento-filtros-separador" style={{ width: 1, height: 38, flexShrink: 0, background: T.border }} />
          <div role="group" aria-label="Tipo de período" style={{ display: 'flex', flexShrink: 0, padding: 3, border: `1px solid ${T.border}`, borderRadius: 999, background: T.page || T.surface }}>
              {[
                ['mes', 'Mês'],
                ['dias', 'Período'],
              ].map(([modo, rotulo]) => (
                <button
                  type="button"
                  key={modo}
                  aria-pressed={modoPeriodoRascunho === modo}
                  onClick={() => setModoPeriodoRascunho(modo)}
                  style={{ padding: '9px 14px', border: 0, borderRadius: 999, color: modoPeriodoRascunho === modo ? T.text : T.textS, background: modoPeriodoRascunho === modo ? T.goldGl : 'transparent', cursor: 'pointer', font: '600 12px var(--font-body)', whiteSpace: 'nowrap' }}
                >
                  {rotulo}
                </button>
              ))}
          </div>
          {modoPeriodoRascunho === 'mes' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 175, padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 12, background: T.page || T.surface, color: T.text }}>
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={T.textS} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
              <input
                type="month"
                aria-label="Mês do faturamento"
                value={periodoRascunho}
                onChange={event => {
                  if (!event.target.value) return;
                  const intervalo = intervaloDoMes(event.target.value);
                  setPeriodoRascunho(event.target.value);
                  setDataInicioRascunho(intervalo.inicio);
                  setDataFimRascunho(intervalo.fim);
                }}
                style={{ width: '100%', minWidth: 130, border: 0, background: 'transparent', color: T.text, font: '600 12px var(--font-body)' }}
              />
            </label>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: 12, background: T.page || T.surface }}>
                <input
                  type="date"
                  aria-label="Data inicial do faturamento"
                  value={dataInicioRascunho}
                  max={dataFimRascunho || undefined}
                  onChange={event => setDataInicioRascunho(event.target.value)}
                  style={{ width: 135, border: 0, background: 'transparent', color: T.text, font: '600 12px var(--font-body)' }}
                />
              </label>
              <span style={{ color: T.textS, fontSize: 12 }}>até</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', border: `1px solid ${T.border}`, borderRadius: 12, background: T.page || T.surface }}>
                <input
                  type="date"
                  aria-label="Data final do faturamento"
                  value={dataFimRascunho}
                  min={dataInicioRascunho || undefined}
                  onChange={event => setDataFimRascunho(event.target.value)}
                  style={{ width: 135, border: 0, background: 'transparent', color: T.text, font: '600 12px var(--font-body)' }}
                />
              </label>
            </>
          )}
          <span aria-hidden="true" className="faturamento-filtros-separador" style={{ width: 1, height: 38, flexShrink: 0, background: T.border }} />
          <button
            type="button"
            onClick={aplicarFiltros}
            disabled={!filtrosRascunhoValidos}
            style={{ ...estiloBotao, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginLeft: 'auto', minHeight: 44, padding: '10px 18px', borderRadius: 999, color: '#111827', background: '#F3F4F6', borderColor: '#D1D5DB', whiteSpace: 'nowrap', opacity: filtrosRascunhoValidos ? 1 : 0.55 }}
          >
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/></svg>
            Aplicar Filtros
          </button>
        </div>
      </section>

      <div style={{ marginBottom: 14, color: T.textT, fontSize: 11.5, lineHeight: 1.5 }}>
        Consulta apenas a caixa Gmail conectada por este administrador. Ao abrir o painel, ele sincroniza automaticamente e repete a consulta a cada 15 minutos enquanto esta tela estiver visível. O botão permite sincronizar imediatamente. A atualização automática consome cota do Gmail; os resultados ficam em cache no servidor entre as consultas.
        {dadosDoPeriodo?.mailbox && <> Conta: {dadosDoPeriodo.mailbox}.</>}
        {atualizadoEm && <> Última sincronização: {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</>}
        {regionalSelecionada && <> A associação cadastrada no Dashboard RH prevalece; quando não existe, a regional ainda é identificada pelo texto do e-mail.</>}
      </div>
      {erroCadastro && (
        <div role="status" style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 10, color: T.danger || '#C04050', background: 'rgba(192,64,80,.08)', border: '1px solid rgba(192,64,80,.22)', fontSize: 12 }}>
          Não foi possível carregar as associações do Dashboard RH: {erroCadastro}. As regionais exibidas usam a identificação pelo texto dos e-mails.
        </div>
      )}

      <div className="faturamento-grade" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.8fr) minmax(270px,.75fr)', alignItems: 'stretch', gap: 14 }}>
        <section style={{ minWidth: 0, overflow: 'hidden', border: `1px solid ${T.border}`, borderRadius: 15, background: T.surface }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '15px 16px 12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750 }}>Faturamentos enviados</h2>
              <div style={{ marginTop: 4, color: T.textS, fontSize: 11.5, textTransform: 'capitalize' }}>{tituloPeriodo} · {registrosFiltrados.length} registros encontrados</div>
            </div>
            {carregando && <span style={{ color: T.textS, fontSize: 11.5 }}>Carregando…</span>}
          </div>

          {!dadosDoPeriodo ? (
            <div style={{ padding: 26, color: T.textS, textAlign: 'center', fontSize: 13 }}>
              {carregando ? 'Consultando os e-mails fiscais…' : erro || 'Não foi possível carregar os dados deste período.'}
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <div style={{ padding: 28, color: T.textS, textAlign: 'center', fontSize: 13 }}>
              Nenhum faturamento encontrado{regionalSelecionada ? ` para ${regionalSelecionada.replace(/^Regional\s+/i, '')}` : ''}{busca ? ` em ${busca}` : ''} neste período.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
                  <colgroup>
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ color: T.textS, background: T.page || T.surface }}>
                        {['Município', 'Secretaria', 'Período Faturado', 'Regional', 'Faturista', 'Data do envio', 'Enviado por', 'Ações'].map(titulo => (
                        <th key={titulo} scope="col" style={{ padding: '10px 7px', textAlign: titulo === 'Ações' ? 'center' : 'left', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{titulo}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrosPaginaComAgrupamento.map(mensagem => (
                      <tr key={mensagem.id} style={{ borderTop: `1px solid ${T.border}` }}>
                        {mensagem.exibirMunicipio && <td rowSpan={mensagem.linhasMunicipio} title={mensagem.municipio} style={{ padding: '10px 7px', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 15, height: 15, marginRight: 8, borderRadius: '50%', color: '#fff', background: T.success || '#17805D', fontSize: 10, lineHeight: 1 }}>✓</span>{mensagem.municipio}
                        </td>}
                        <td title={mensagem.secretaria} style={{ padding: '10px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mensagem.secretaria}</td>
                        <td title={mensagem.periodoFaturado || '—'} style={{ padding: '10px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span>{mensagem.periodoFaturado || '—'}</span>
                          {mensagem.quantidadeNaConversa > 1 && (
                            <span title={`${mensagem.quantidadeNaConversa} e-mails agrupados nesta conversa`} style={{ display: 'block', marginTop: 3, color: T.textT, fontSize: 10 }}>
                              {mensagem.quantidadeNaConversa} e-mails agrupados
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 7px', overflow: 'hidden' }}>
                          <span title={nomeRegional(mensagem)} style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', padding: '5px 8px', borderRadius: 999, color: corTextoFundo(corRegional(mensagem)), background: corRegional(mensagem), fontSize: 10, fontWeight: 700, textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{nomeRegional(mensagem)}</span>
                        </td>
                        <td title={mensagem.responsavelFaturamento || '—'} style={{ padding: '10px 7px', overflow: 'hidden', color: mensagem.responsavelFaturamento ? T.text : T.textT, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mensagem.responsavelFaturamento || '—'}</td>
                        <td style={{ padding: '10px 7px', overflow: 'hidden', color: T.textS, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatarData(mensagem.date)}</td>
                        <td style={{ padding: '10px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={remetenteExibido(mensagem)}>
                          <span style={{ marginRight: 7, color: T.textS }}>♙</span>{remetenteExibido(mensagem)}
                        </td>
                        <td style={{ padding: '8px 5px', textAlign: 'center' }}>
                          <button type="button" onClick={() => onOpenEmail?.(mensagem.id)} style={{ ...estiloBotao, padding: '5px 7px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: 10 }}>
                            ✉&nbsp; Ver e-mail&nbsp; ›
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 15px', borderTop: `1px solid ${T.border}` }}>
                <span style={{ color: T.textS, fontSize: 11.5 }}>
                  Exibindo {registrosFiltrados.length ? (paginaExibida - 1) * registrosPorPagina + 1 : 0}–{Math.min(paginaExibida * registrosPorPagina, registrosFiltrados.length)} de {registrosFiltrados.length} faturamentos
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <button type="button" aria-label="Página anterior" disabled={paginaExibida <= 1} onClick={() => setPagina(Math.max(1, paginaExibida - 1))} style={{ ...estiloBotao, padding: '6px 10px', opacity: paginaExibida <= 1 ? 0.45 : 1 }}>‹</button>
                  <span style={{ minWidth: 76, color: T.textS, textAlign: 'center', fontSize: 11.5 }}>Página {paginaExibida} de {totalPaginas}</span>
                  <button type="button" aria-label="Próxima página" disabled={paginaExibida >= totalPaginas} onClick={() => setPagina(Math.min(totalPaginas, paginaExibida + 1))} style={{ ...estiloBotao, padding: '6px 10px', opacity: paginaExibida >= totalPaginas ? 0.45 : 1 }}>›</button>
                  {dadosDoPeriodo.nextPageToken && (
                    <button type="button" disabled={carregandoMais || segundosEspera > 0} onClick={carregarMais} style={{ ...estiloBotao, padding: '6px 10px', opacity: carregandoMais || segundosEspera > 0 ? 0.6 : 1 }}>
                      {carregandoMais ? 'Carregando…' : segundosEspera > 0 ? `Aguarde ${segundosEspera}s` : 'Carregar mais do Gmail'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <aside style={{ minWidth: 0, padding: '16px 15px', border: `1px solid ${T.border}`, borderRadius: 15, background: T.surface }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 15 }}>
            <button
              type="button"
              onClick={() => atualizar(true, true)}
              disabled={carregando || atualizando || segundosEspera > 0 || !periodoValido}
              aria-label={atualizando ? 'Sincronizando faturamentos' : 'Sincronizar faturamentos agora'}
              title={erro || (segundosEspera > 0 ? `Aguarde ${segundosEspera}s` : 'Sincronizar faturamentos agora')}
              className={!erro && !carregando && segundosEspera === 0 ? 'faturamento-pulse' : undefined}
              style={{
                display: 'grid',
                placeItems: 'center',
                marginTop: 3,
                width: 18,
                height: 18,
                flexShrink: 0,
                padding: 0,
                border: '1px solid #3B82F6',
                borderRadius: '50%',
                color: '#fff',
                background: erro ? (T.danger || '#C04050') : '#3B82F6',
                boxShadow: erro ? 'none' : '0 0 0 4px rgba(59,130,246,.14)',
                cursor: carregando || atualizando || segundosEspera > 0 || !periodoValido ? 'default' : 'pointer',
                opacity: carregando || atualizando || segundosEspera > 0 || !periodoValido ? 0.65 : 1,
                animation: erro || carregando || segundosEspera > 0 ? undefined : `faturamentoPulse ${atualizando ? '0.8s' : '1.8s'} infinite`,
              }}
            />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>Tempo Real</h2>
              <div style={{ marginTop: 4, color: T.textS, fontSize: 11.5 }}>Faturamentos enviados recentemente.</div>
            </div>
            <span
              className={!erro ? 'faturamento-pulse' : undefined}
              aria-label={erro ? 'Sincronização com erro' : atualizando ? 'Sincronizando faturamentos' : 'Sincronização ativa'}
              title={erro ? 'Sincronização com erro' : atualizando ? 'Sincronizando faturamentos' : 'Sincronização ativa'}
              style={{ width: 8, height: 8, marginTop: 5, borderRadius: '50%', background: erro ? (T.danger || '#C04050') : (T.success || '#14B86E'), animation: erro ? undefined : `faturamentoPulse ${atualizando ? '0.8s' : '1.8s'} infinite` }}
            />
          </div>
          {!dadosDoPeriodo ? (
            <div style={{ padding: '18px 4px', color: T.textS, textAlign: 'center', fontSize: 12 }}>
              {carregando ? 'Aguardando os dados…' : 'Atividade indisponível.'}
            </div>
          ) : mensagensVisiveis.length === 0 ? (
            <div style={{ padding: '18px 4px', color: T.textS, textAlign: 'center', fontSize: 12 }}>Nenhum envio recente neste filtro.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {mensagensVisiveis.slice(0, 5).map((mensagem, indice) => (
                <button
                  type="button"
                  key={mensagem.id}
                  onClick={() => onOpenEmail?.(mensagem.id)}
                  style={{ position: 'relative', display: 'grid', gridTemplateColumns: '23px minmax(0,1fr)', gap: 9, width: '100%', padding: '11px 0', textAlign: 'left', cursor: 'pointer', border: 0, borderBottom: indice === 4 ? 0 : `1px solid ${T.border}`, background: 'transparent', color: T.text, fontFamily: 'var(--font-body)' }}
                >
                  <span aria-hidden="true" style={{ position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', color: '#fff', background: T.success || '#17805D', fontSize: 12 }}>✓</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ minWidth: 0, fontSize: 11.5, lineHeight: 1.45 }}>
                        <strong>{mensagem.municipio}</strong> — Faturamento enviado por {remetenteExibido(mensagem)}
                        {mensagem.responsavelFaturamento && <span style={{ display: 'block', marginTop: 3, color: T.textS, fontSize: 10.5 }}>Faturista: {mensagem.responsavelFaturamento}</span>}
                      </span>
                      <span style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 999, color: corTextoFundo(corRegional(mensagem)), background: corRegional(mensagem), fontSize: 9.5, fontWeight: 700 }}>{nomeRegional(mensagem)}</span>
                    </span>
                    <span style={{ display: 'block', marginTop: 5, color: T.textS, fontSize: 10.5, textAlign: 'right' }}>{formatarDataTempoReal(mensagem.date, agora)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setHistoricoAberto(true); setPaginaHistorico(1); }} disabled={!registrosFiltrados.length} style={{ ...estiloBotao, width: '100%', marginTop: 12, padding: '10px 12px', justifyContent: 'center', opacity: registrosFiltrados.length ? 1 : 0.5 }}>
            Ver todo o histórico&nbsp; ›
          </button>
          <div style={{ marginTop: 9, color: T.textT, fontSize: 10.5, textAlign: 'center' }}>
            {dadosDoPeriodo?.mailbox ? `Conta: ${dadosDoPeriodo.mailbox}` : 'Apenas a conta conectada'}
          </div>
        </aside>
      </div>

      {historicoAberto && (
        <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setHistoricoAberto(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(5px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="historico-faturamento-titulo" style={{ display: 'flex', flexDirection: 'column', width: 'min(1050px,100%)', maxHeight: '90vh', overflow: 'hidden', border: `1px solid ${T.border}`, borderRadius: 16, background: T.surface, color: T.text, boxShadow: '0 25px 80px rgba(0,0,0,.35)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 id="historico-faturamento-titulo" style={{ margin: 0, fontSize: 18 }}>Histórico de faturamentos</h2>
                <div style={{ marginTop: 4, color: T.textS, fontSize: 12, textTransform: 'capitalize' }}>{tituloPeriodo} · {registrosFiltrados.length} registros{regionalSelecionada ? ` · ${regionalSelecionada.replace(/^Regional\s+/i, '')}` : ''}</div>
              </div>
              <button type="button" aria-label="Fechar histórico" onClick={() => setHistoricoAberto(false)} style={{ ...estiloBotao, padding: '7px 11px', fontSize: 18 }}>×</button>
            </header>
            {registrosFiltrados.length === 0 ? (
              <div style={{ padding: 24, color: T.textS }}>Não há registros no período e nos filtros selecionados.</div>
            ) : (
              <>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 1020, borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: T.page || T.surface }}>
                      <tr>{['Município', 'Secretaria', 'Período Faturado', 'Regional', 'Faturista', 'Data do envio', 'Enviado por', 'Ações'].map(titulo => <th key={titulo} scope="col" style={{ padding: '11px 14px', color: T.textS, textAlign: 'left', fontSize: 10.5, whiteSpace: 'nowrap' }}>{titulo}</th>)}</tr>
                    </thead>
                    <tbody>
                      {registrosHistoricoComAgrupamento.map(mensagem => (
                        <tr key={mensagem.id} style={{ borderTop: `1px solid ${T.border}` }}>
                          {mensagem.exibirMunicipio && <td rowSpan={mensagem.linhasMunicipio} style={{ padding: '10px 14px', fontWeight: 700, verticalAlign: 'middle' }}>{mensagem.municipio}</td>}
                          <td style={{ padding: '10px 14px' }}>{mensagem.secretaria}</td>
                          <td style={{ padding: '10px 14px', minWidth: 170 }}>
                            <span>{mensagem.periodoFaturado || '—'}</span>
                            {mensagem.quantidadeNaConversa > 1 && (
                              <span title={`${mensagem.quantidadeNaConversa} e-mails agrupados nesta conversa`} style={{ display: 'block', marginTop: 3, color: T.textT, fontSize: 10 }}>
                                {mensagem.quantidadeNaConversa} e-mails agrupados
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}><span style={{ display: 'inline-block', padding: '5px 10px', borderRadius: 999, color: corTextoFundo(corRegional(mensagem)), background: corRegional(mensagem), fontSize: 10, fontWeight: 700 }}>{nomeRegional(mensagem)}</span></td>
                          <td style={{ padding: '10px 14px', color: mensagem.responsavelFaturamento ? T.text : T.textT }}>{mensagem.responsavelFaturamento || '—'}</td>
                          <td style={{ padding: '10px 14px', color: T.textS, whiteSpace: 'nowrap' }}>{formatarData(mensagem.date)}</td>
                          <td style={{ padding: '10px 14px' }}>{remetenteExibido(mensagem)}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right' }}><button type="button" onClick={() => onOpenEmail?.(mensagem.id)} style={{ ...estiloBotao, padding: '6px 10px', fontSize: 11 }}>Ver e-mail ›</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 16px', borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.textS, fontSize: 11.5 }}>Página {paginaHistoricoExibida} de {totalPaginasHistorico}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {dadosDoPeriodo?.nextPageToken && <button type="button" disabled={carregandoMais || segundosEspera > 0} onClick={carregarMais} style={{ ...estiloBotao, opacity: carregandoMais || segundosEspera > 0 ? 0.6 : 1 }}>{carregandoMais ? 'Carregando…' : segundosEspera > 0 ? `Aguarde ${segundosEspera}s` : 'Carregar mais do Gmail'}</button>}
                    <button type="button" disabled={paginaHistoricoExibida <= 1} onClick={() => setPaginaHistorico(Math.max(1, paginaHistoricoExibida - 1))} style={{ ...estiloBotao, opacity: paginaHistoricoExibida <= 1 ? 0.5 : 1 }}>Anterior</button>
                    <button type="button" disabled={paginaHistoricoExibida >= totalPaginasHistorico} onClick={() => setPaginaHistorico(Math.min(totalPaginasHistorico, paginaHistoricoExibida + 1))} style={{ ...estiloBotao, opacity: paginaHistoricoExibida >= totalPaginasHistorico ? 0.5 : 1 }}>Próxima</button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
