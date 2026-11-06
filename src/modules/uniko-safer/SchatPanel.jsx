import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { supabase } from './saferSupabase';
import { importarBackupSchat } from './schatImport';

const formatarData = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? ''
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatarHora = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? ''
    : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatarDataCurta = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
};

const normalizar = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

const dataLocal = (valor) => {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
};

const limiteDataIso = (valor, finalDoDia = false) => {
  if (!valor) return null;
  const data = new Date(`${valor}T${finalDoDia ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
};

const botao = (ativo) => ({
  padding: '9px 13px',
  borderRadius: 10,
  border: `1px solid ${ativo ? T.gold : T.border}`,
  background: ativo ? T.goldGl : T.surface,
  color: ativo ? T.gold : T.textS,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

export default function SchatPanel({ isAdmin, logSaferAction }) {
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const chatRef = useRef(null);
  const requestMensagens = useRef(0);
  const [threads, setThreads] = useState([]);
  const [conversaId, setConversaId] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [buscaContatos, setBuscaContatos] = useState('');
  const [buscaMensagens, setBuscaMensagens] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [dataConversaDe, setDataConversaDe] = useState('');
  const [dataConversaAte, setDataConversaAte] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscandoMensagens, setBuscandoMensagens] = useState(false);
  const [erroBusca, setErroBusca] = useState('');
  const [carregandoConversas, setCarregandoConversas] = useState(true);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const conversaSelecionada = threads.find((item) => item.id === conversaId) || null;

  const carregarConversas = useCallback(async () => {
    const resultado = [];
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error: erroConsulta } = await supabase.from('uniko_safer_schat_threads')
        .select('id, contact, contact_name, last_message_at')
        .eq('sector', 'geral')
        .order('last_message_at', { ascending: false })
        .order('contact')
        .order('id')
        .range(inicio, inicio + 999);
      if (erroConsulta) throw new Error(`Não foi possível carregar as conversas: ${erroConsulta.message}`);
      resultado.push(...(data || []));
      if ((data || []).length < 1000) break;
    }
    return resultado;
  }, []);

  const contatosEncontrados = useMemo(() => {
    const termo = normalizar(buscaContatos);
    if (!termo) return [];
    const numero = termo.replace(/\D/g, '');
    const telefoneBusca = numero.startsWith('55') && numero.length > 11 ? numero.slice(2) : numero;
    return threads.filter((item) => (
      normalizar(item.contact_name).includes(termo)
      || (telefoneBusca && String(item.contact).includes(telefoneBusca))
    ));
  }, [buscaContatos, threads]);
  const buscaPorContato = contatosEncontrados.length > 0;

  useEffect(() => {
    let ativa = true;
    carregarConversas().then((resultado) => {
      if (ativa) setThreads(resultado);
    }).catch((e) => {
      if (ativa) {
        setErro(e.message);
      }
    }).finally(() => {
      if (ativa) setCarregandoConversas(false);
    });
    return () => { ativa = false; };
  }, [carregarConversas]);

  useEffect(() => {
    let ativa = true;
    const timer = setTimeout(async () => {
      const termo = buscaContatos.trim();
      const inicio = limiteDataIso(dataDe);
      const fim = limiteDataIso(dataAte, true);
      if ((termo.length < 2 && !inicio && !fim) || (buscaPorContato && !inicio && !fim)) {
        setResultadosBusca([]);
        setErroBusca('');
        setBuscandoMensagens(false);
        return;
      }

      setBuscandoMensagens(true);
      setResultadosBusca([]);
      setErroBusca('');
      try {
        let consulta = supabase.from('uniko_safer_schat_messages')
          .select('thread_id, sent_at, message')
          .order('sent_at', { ascending: false })
          .limit(1000);
        if (termo.length >= 2 && !buscaPorContato) {
          const padrao = termo.replace(/[\\%_]/g, '\\$&');
          consulta = consulta.ilike('message', `%${padrao}%`);
        }
        if (inicio) consulta = consulta.gte('sent_at', inicio);
        if (fim) consulta = consulta.lte('sent_at', fim);

        const { data, error: erroConsulta } = await consulta;
        if (erroConsulta) throw new Error(`Não foi possível pesquisar as mensagens: ${erroConsulta.message}`);
        if (ativa) setResultadosBusca(data || []);
      } catch (e) {
        if (ativa) {
          setResultadosBusca([]);
          setErroBusca(e.message);
        }
      } finally {
        if (ativa) setBuscandoMensagens(false);
      }
    }, 350);

    return () => {
      ativa = false;
      clearTimeout(timer);
    };
  }, [buscaContatos, buscaPorContato, contatosEncontrados, dataDe, dataAte]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensagens, conversaId]);

  const resultadosPorThread = useMemo(() => {
    const porThread = new Map();
    resultadosBusca.forEach((resultado) => {
      const atual = porThread.get(resultado.thread_id);
      if (atual) atual.quantidade += 1;
      else porThread.set(resultado.thread_id, { quantidade: 1, mensagem: resultado.message });
    });
    return porThread;
  }, [resultadosBusca]);

  const conversasVisiveis = useMemo(() => {
    const termo = normalizar(buscaContatos);
    const buscaAtiva = Boolean(termo || dataDe || dataAte);
    if (!buscaAtiva) return threads;
    const idsContatos = new Set(contatosEncontrados.map((item) => item.id));
    if (termo && idsContatos.size) {
      return threads.filter((item) => idsContatos.has(item.id)
        && ((!dataDe && !dataAte) || resultadosPorThread.has(item.id)));
    }
    if (termo) return threads.filter((item) => resultadosPorThread.has(item.id));
    return threads.filter((item) => (
      resultadosPorThread.has(item.id)
    ));
  }, [buscaContatos, contatosEncontrados, dataDe, dataAte, resultadosPorThread, threads]);

  const mensagensVisiveis = useMemo(() => {
    const termo = normalizar(buscaMensagens);
    return mensagens.filter((item) => {
      const data = dataLocal(item.sent_at);
      return (!termo || normalizar(item.message).includes(termo))
        && (!dataConversaDe || data >= dataConversaDe)
        && (!dataConversaAte || data <= dataConversaAte);
    });
  }, [buscaMensagens, dataConversaAte, dataConversaDe, mensagens]);

  const selecionarConversa = async (id, filtros = {}) => {
    const requestId = ++requestMensagens.current;
    setConversaId(id);
    setBuscaMensagens(filtros.termo || '');
    setDataConversaDe(filtros.de || '');
    setDataConversaAte(filtros.ate || '');
    setMensagens([]);
    setCarregandoMensagens(true);
    setErro('');
    try {
      const linhas = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error: erroConsulta } = await supabase.from('uniko_safer_schat_messages')
          .select('id, sent_at, sender, message')
          .eq('thread_id', id)
          .order('sent_at')
          .order('id')
          .range(inicio, inicio + 999);
        if (erroConsulta) throw new Error(`Não foi possível carregar as mensagens: ${erroConsulta.message}`);
        linhas.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      if (requestId === requestMensagens.current) setMensagens(linhas);
    } catch (e) {
      if (requestId === requestMensagens.current) setErro(e.message);
    } finally {
      if (requestId === requestMensagens.current) setCarregandoMensagens(false);
    }
  };

  const importarArquivo = async (evento) => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo || !isAdmin || importando) return;
    const confirmado = window.confirm(
      `Importar "${arquivo.name}" para SCHAT Geral?\n\nAs mensagens serão agrupadas pelo número do contato e mescladas ao histórico. Registros repetidos serão ignorados e nenhum backup existente será apagado.`,
    );
    if (!confirmado) return;

    setImportando(true);
    setErro('');
    setAviso('');
    setProgresso({ etapa: 'Preparando importação', concluidos: 0, total: 0 });
    try {
      const resultado = await importarBackupSchat(arquivo, setProgresso);
      setAviso(
        `Importação concluída: ${resultado.novas.toLocaleString('pt-BR')} novas mensagens em ${resultado.conversas.toLocaleString('pt-BR')} conversas. ${resultado.ignoradas.toLocaleString('pt-BR')} linhas sem texto foram ignoradas.`,
      );
      logSaferAction?.('import', {
        contactName: 'SCHAT · Geral',
        details: `${resultado.novas} mensagens novas de "${arquivo.name}"`,
      });
      setThreads(await carregarConversas());
    } catch (e) {
      setErro(`Importação interrompida. Os registros já gravados foram mantidos; reenvie o mesmo arquivo para continuar sem duplicar mensagens. ${e.message}`);
    } finally {
      setImportando(false);
      setProgresso(null);
    }
  };

  const mostrarLista = !isMobile || !conversaSelecionada;
  const mostrarChat = !isMobile || !!conversaSelecionada;
  const atualizarConversas = async () => {
    setCarregandoConversas(true);
    setErro('');
    try {
      setThreads(await carregarConversas());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregandoConversas(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: isMobile ? '12px 12px 10px' : '14px 20px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        borderBottom: `1px solid ${T.border}`, background: T.surface,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>SCHAT · Geral</div>
          <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>Mensagens organizadas pelo número de cada contato</div>
        </div>
        {isAdmin && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={importarArquivo} />
            <button onClick={() => fileRef.current?.click()} disabled={importando} style={{
              ...botao(true), background: T.gold, color: '#fff',
              opacity: importando ? 0.65 : 1, cursor: importando ? 'wait' : 'pointer',
            }}>
              {importando ? 'Importando planilha…' : 'Importar backup Excel'}
            </button>
          </>
        )}
      </div>

      {importando && progresso && (
        <div style={{ padding: '10px 18px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: T.textS, marginBottom: 6 }}>
            <span>{progresso.etapa}</span>
            <span>{progresso.total ? `${progresso.concluidos.toLocaleString('pt-BR')} / ${progresso.total.toLocaleString('pt-BR')}` : 'Aguarde…'}</span>
          </div>
          <div style={{ height: 6, overflow: 'hidden', borderRadius: 10, background: T.border }}>
            <div style={{
              width: progresso.total ? `${Math.min(100, (progresso.concluidos / progresso.total) * 100)}%` : '12%',
              height: '100%', background: T.gold, transition: 'width .2s ease',
            }} />
          </div>
        </div>
      )}

      {erro && <div role="alert" style={{ padding: '10px 16px', color: T.danger, background: T.dangerGl, fontSize: 12.5 }}>{erro}</div>}
      {aviso && <div role="status" style={{ padding: '10px 16px', color: T.green || T.gold, background: T.greenGl || T.goldGl, fontSize: 12.5 }}>{aviso}</div>}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {mostrarLista && (
          <aside style={{
            width: isMobile ? '100%' : 320, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
            background: T.surface, borderRight: isMobile ? 'none' : `1px solid ${T.border}`,
          }}>
            <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Contatos</div>
                <div style={{ fontSize: 11.5, color: T.textT, marginTop: 2 }}>
                  {conversasVisiveis.length.toLocaleString('pt-BR')} de {threads.length.toLocaleString('pt-BR')} conversas
                </div>
              </div>
              <button onClick={atualizarConversas} disabled={carregandoConversas || importando}
                title="Atualizar conversas" style={{ ...botao(false), padding: '7px 10px', fontSize: 16 }}>↻</button>
            </div>
            <div style={{ padding: '4px 14px 12px' }}>
              <input value={buscaContatos} onChange={(e) => setBuscaContatos(e.target.value)}
                placeholder="Pesquisar nome, telefone ou mensagem" aria-label="Pesquisar nome, telefone ou mensagem" style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10,
                  border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 12.5,
                  outline: 'none', fontFamily: 'var(--font-body)',
                }} />
              <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)}
                  aria-label="Data inicial da pesquisa geral" title="Data inicial" style={{
                    width: 'calc(50% - 4px)', minWidth: 0, boxSizing: 'border-box', padding: '7px 6px', borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11,
                  }} />
                <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)}
                  aria-label="Data final da pesquisa geral" title="Data final" style={{
                    width: 'calc(50% - 4px)', minWidth: 0, boxSizing: 'border-box', padding: '7px 6px', borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11,
                  }} />
              </div>
              {buscandoMensagens && (
                <div style={{ marginTop: 7, fontSize: 11, color: T.textT }}>Pesquisando mensagens…</div>
              )}
              {erroBusca && (
                <div role="alert" style={{ marginTop: 7, color: T.danger, fontSize: 11 }}>{erroBusca}</div>
              )}
              {resultadosBusca.length === 1000 && (
                <div style={{ marginTop: 7, fontSize: 10.5, color: T.textT }}>
                  Exibindo as correspondências mais recentes; refine a busca ou o período para localizar outras.
                </div>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 9px 16px' }}>
              {carregandoConversas ? (
                <div style={{ padding: 22, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando conversas…</div>
              ) : buscandoMensagens ? (
                <div style={{ padding: 22, textAlign: 'center', color: T.textT, fontSize: 13 }}>Pesquisando conversas…</div>
              ) : conversasVisiveis.length ? conversasVisiveis.map((item) => (
                <button key={item.id} onClick={() => selecionarConversa(item.id, {
                  termo: !buscaPorContato && resultadosPorThread.has(item.id) ? buscaContatos.trim() : '',
                  de: dataDe,
                  ate: dataAte,
                })} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  border: 'none', borderRadius: 11, padding: '11px 10px', marginBottom: 3,
                  background: conversaId === item.id ? T.goldGl : 'transparent', cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}>
                  <span style={{
                    width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center',
                    borderRadius: '50%', color: T.gold, background: T.goldGl, fontSize: 14, fontWeight: 800,
                  }}>{String(item.contact_name || item.contact || '?').trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span title={item.contact_name || item.contact} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, color: T.text }}>
                        {item.contact_name || item.contact}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 10, color: T.textT }}>{formatarDataCurta(item.last_message_at)}</span>
                    </span>
                    {item.contact_name && (
                      <span style={{ display: 'block', marginTop: 2, color: T.textT, fontSize: 10.5 }}>{item.contact}</span>
                    )}
                    {resultadosPorThread.has(item.id) && (
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3, color: T.textS, fontSize: 10.5 }}>
                        {resultadosPorThread.get(item.id).quantidade} mensagem(ns): {resultadosPorThread.get(item.id).mensagem}
                      </span>
                    )}
                  </span>
                </button>
              )) : (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: T.textT, fontSize: 13 }}>
                  {threads.length ? 'Nenhum contato encontrado.' : 'Nenhum contato importado para o SCHAT Geral.'}
                </div>
              )}
            </div>
          </aside>
        )}

        {mostrarChat && (
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: T.page }}>
            {conversaSelecionada ? (
              <>
                <header style={{
                  minHeight: 58, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '9px 16px', background: T.surface, borderBottom: `1px solid ${T.border}`,
                }}>
                  {isMobile && <button onClick={() => setConversaId(null)} style={botao(false)}>‹ Conversas</button>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                      {conversaSelecionada.contact_name || conversaSelecionada.contact}
                    </div>
                    {conversaSelecionada.contact_name && (
                      <div style={{ marginTop: 2, color: T.textT, fontSize: 10.5 }}>{conversaSelecionada.contact}</div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 'auto',
                    width: isMobile ? '100%' : 'auto',
                  }}>
                    <input value={buscaMensagens} onChange={(e) => setBuscaMensagens(e.target.value)}
                      placeholder="Buscar nesta conversa" aria-label="Buscar mensagens nesta conversa" style={{
                        width: isMobile ? '100%' : 190, boxSizing: 'border-box', padding: '8px 10px',
                        borderRadius: 9, border: `1px solid ${T.border}`, background: T.page,
                        color: T.text, fontSize: 12, outline: 'none', fontFamily: 'var(--font-body)',
                      }} />
                    <input type="date" value={dataConversaDe} onChange={(e) => setDataConversaDe(e.target.value)}
                      aria-label="Data inicial desta conversa" title="Data inicial" style={{
                        width: isMobile ? 'calc(50% - 3px)' : 132, minWidth: 0, boxSizing: 'border-box', padding: '7px 5px', borderRadius: 8,
                        border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11,
                      }} />
                    <input type="date" value={dataConversaAte} onChange={(e) => setDataConversaAte(e.target.value)}
                      aria-label="Data final desta conversa" title="Data final" style={{
                        width: isMobile ? 'calc(50% - 3px)' : 132, minWidth: 0, boxSizing: 'border-box', padding: '7px 5px', borderRadius: 8,
                        border: `1px solid ${T.border}`, background: T.page, color: T.text, fontSize: 11,
                      }} />
                  </div>
                </header>
                <div ref={chatRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '8px 10px 22px' : '12px 24px 28px', display: 'flex', flexDirection: 'column' }}>
                  {carregandoMensagens ? (
                    <div style={{ padding: 30, textAlign: 'center', color: T.textT, fontSize: 13 }}>Carregando mensagens…</div>
                  ) : !mensagens.length ? (
                    <div style={{ margin: '40px auto', padding: 25, textAlign: 'center', color: T.textT, fontSize: 13, background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
                      Esta conversa ainda não tem mensagens importadas.
                    </div>
                  ) : !mensagensVisiveis.length ? (
                    <div style={{ padding: 22, textAlign: 'center', color: T.textT, fontSize: 13 }}>Nenhuma mensagem encontrada.</div>
                  ) : (
                    <>
                      {mensagensVisiveis.map((mensagem, indice) => {
                        const atual = new Date(mensagem.sent_at);
                        const anterior = indice ? new Date(mensagensVisiveis[indice - 1].sent_at) : null;
                        const dataAtual = Number.isNaN(atual.getTime()) ? '' : atual.toISOString().slice(0, 10);
                        const dataAnterior = anterior && !Number.isNaN(anterior.getTime()) ? anterior.toISOString().slice(0, 10) : '';
                        const mostrarData = dataAtual && dataAtual !== dataAnterior;
                        const deDentro = ['bot', 'atendente'].includes(normalizar(mensagem.sender));
                        return (
                          <div key={mensagem.id}>
                            {mostrarData && <div style={{
                              alignSelf: 'center', margin: '15px auto 8px', padding: '4px 12px',
                              borderRadius: 20, border: `1px solid ${T.border}`, background: T.surface,
                              color: T.textT, fontSize: 10.5, fontWeight: 700,
                            }}>{formatarData(mensagem.sent_at)}</div>}
                            <div style={{ display: 'flex', justifyContent: deDentro ? 'flex-end' : 'flex-start', width: '100%', marginTop: 7 }}>
                              <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: deDentro ? 'flex-end' : 'flex-start' }}>
                                {!deDentro && <div style={{ margin: '0 4px 3px', color: T.green || T.gold, fontSize: 10.5, fontWeight: 700 }}>{mensagem.sender}</div>}
                                <div style={{
                                  padding: '8px 11px', borderRadius: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                  lineHeight: 1.45, fontSize: 13, background: deDentro ? (T.green || T.gold) : T.surface,
                                  color: deDentro ? '#fff' : T.text,
                                  border: deDentro ? 'none' : `1px solid ${T.border}`,
                                  borderBottomRightRadius: deDentro ? 4 : 15,
                                  borderBottomLeftRadius: deDentro ? 15 : 4,
                                }}>{mensagem.message}</div>
                                <div style={{ margin: '3px 4px 0', color: T.textT, fontSize: 10 }}>{formatarHora(mensagem.sent_at)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: T.textT }}>
                <div>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>▤</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>SCHAT · Geral</div>
                  <div style={{ marginTop: 5, fontSize: 12.5 }}>Selecione uma conversa para consultar as mensagens.</div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
