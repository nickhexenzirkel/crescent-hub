import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T, THEMES } from '../../contexts/theme';
import { SERVER_URL, supabase } from '../../contexts/user';
import { CAPTURE_UNIKOS } from '../../shared/captureUniko';

const MODULOS = {
  modules: 'Seletor de módulos',
  colaborador: 'Portal do Colaborador',
  ponto: 'Ponto Eletrônico',
  dashboard: 'Dashboard RH',
  alexa: 'Central Alexa',
  faturamento: 'Oficina Estelar',
  'conexao-setorial': 'Conexão Setorial',
  'info-adicional': 'Informações Adicionais',
  'uniko-safer': 'Uniko Safer',
  'uniko-security': 'Uniko Security',
  '7-beneficios': '7 Benefícios',
  'mercado-estelar': 'Prisma Store',
  'uniko-fit': 'Uniko FIT',
  'uniko-call': 'Uniko Call',
  'prestacao-contas': 'Prestações de Contas',
};

const CORES = ['#4F8FE8', '#A66BE8', '#E46DA9', '#29A985', '#E7A63D', '#35AFC1'];
const fmtNumero = (n) => Number(n || 0).toLocaleString('pt-BR');
const fmtTempo = (segundos) => {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  if (horas) return `${horas}h ${minutos}min`;
  if (minutos) return `${minutos}min`;
  return `${total}s`;
};
const normalizarNome = (nome) => (nome || '').trim().toLocaleLowerCase('pt-BR');
const diaUTC = (data) => data.toISOString().slice(0, 10);
const rotuloDia = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

async function buscarTodasPaginas(criarConsulta) {
  const tamanhoPagina = 1000;
  const resultados = [];
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await criarConsulta().range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw new Error(error.message);
    resultados.push(...(data || []));
    if (!data || data.length < tamanhoPagina) return resultados;
  }
}

function Cartao({ titulo, subtitulo, children, extra }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, boxShadow: T.shM || T.sh }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: T.text, fontSize: 15, fontWeight: 700 }}>{titulo}</div>
          {subtitulo && <div style={{ color: T.textT, fontSize: 12, marginTop: 3 }}>{subtitulo}</div>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function GraficoBarras({ itens, cor = T.gold, vazio = 'Ainda não há dados neste período.' }) {
  const maior = Math.max(1, ...itens.map((item) => item.valor));
  if (!itens.length) return <div style={{ padding: '22px 4px', color: T.textT, fontSize: 13 }}>{vazio}</div>;
  const passoRotulo = Math.max(1, Math.ceil(itens.length / 7));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 170, overflowX: itens.length > 35 ? 'auto' : 'visible', padding: '8px 2px 0' }}>
      {itens.map((item, index) => {
        const altura = item.valor > 0 ? Math.max(4, (item.valor / maior) * 124) : 2;
        const mostraRotulo = index % passoRotulo === 0 || index === itens.length - 1;
        return (
          <div key={item.chave} title={`${item.rotulo}: ${fmtTempo(item.valor)}`}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 7, minWidth: itens.length > 35 ? 22 : 0, flex: 1, height: '100%' }}>
            <div style={{ width: 'min(100%, 24px)', minWidth: 5, height: altura, borderRadius: '5px 5px 2px 2px', background: item.valor ? cor : T.border, opacity: item.valor ? 0.88 : 0.35 }} />
            <span style={{ height: 14, fontSize: 9, lineHeight: '14px', color: T.textT, whiteSpace: 'nowrap', visibility: mostraRotulo ? 'visible' : 'hidden' }}>{item.rotulo}</span>
          </div>
        );
      })}
    </div>
  );
}

function BarraProgresso({ rotulo, valor, maximo, cor, detalhe }) {
  const largura = maximo ? Math.min(100, (valor / maximo) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) minmax(90px, 2fr) auto', gap: 10, alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotulo}</span>
      <div style={{ height: 8, borderRadius: 99, background: T.surfaceSub || 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <div style={{ width: `${largura}%`, height: '100%', borderRadius: 99, background: cor }} />
      </div>
      <span style={{ color: T.textS, whiteSpace: 'nowrap' }}>{detalhe}</span>
    </div>
  );
}

const JOGOS_VITORIA = {
  palavras: 'Uniko Palavras',
  stop: 'Uniko Stop',
  paint: 'Uniko Paint',
  speed: 'Uniko Speed',
};

function VitoriasUnikoGames({ funcionarios }) {
  const [vitorias, setVitorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [mensagemErro, setMensagemErro] = useState(false);
  const [busy, setBusy] = useState('');
  const [colaborador, setColaborador] = useState('');
  const [jogo, setJogo] = useState('palavras');

  const carregar = useCallback(async () => {
    try {
      const [wins, claims] = await Promise.all([
        buscarTodasPaginas(() => supabase.from('mercado_history')
          .select('id,player,descr,comum,premium,created_at')
          .eq('kind', 'uniko_game_win').order('created_at', { ascending: false })),
        buscarTodasPaginas(() => supabase.from('mercado_history')
          .select('player,descr,created_at')
          .eq('kind', 'uniko_game_win_claim').order('created_at', { ascending: false })),
      ]);
      const resgates = new Set(claims.map((claim) => `${claim.player}|${claim.descr}`));
      setVitorias(wins.map((win) => ({
        ...win,
        resgatada: resgates.has(`${win.player}|Vitória: ${win.id}`),
      })));
      setErro('');
    } catch (e) {
      console.error('[monitoramento-uso] Falha ao carregar o histórico de vitórias:', e);
      setErro(e?.message || 'Não foi possível carregar o histórico de vitórias.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const primeiraCarga = setTimeout(() => { void carregar(); }, 0);
    const intervalo = setInterval(carregar, 30000);
    return () => {
      clearTimeout(primeiraCarga);
      clearInterval(intervalo);
    };
  }, [carregar]);

  const creditarVitoria = async (win) => {
    if (busy) return;
    setBusy(win.id);
    setMensagem('');
    setMensagemErro(false);
    try {
      const { data, error: rpcError } = await supabase.rpc('mercado_claim_uniko_game_win', {
        p_player: win.player,
        p_win_id: win.id,
      });
      if (rpcError) throw rpcError;
      const premio = Array.isArray(data) ? data[0] : data;
      setMensagem(`Prêmio creditado para ${win.player}: ${fmtNumero(premio?.comum)} Prisma Comum e ${fmtNumero(premio?.premium)} Prisma Premium.`);
      await carregar();
    } catch (e) {
      console.error('[monitoramento-uso] Falha ao creditar vitória:', e);
      setMensagemErro(true);
      setMensagem(`Não foi possível creditar a vitória de ${win.player}: ${e?.message || 'falha ao processar o resgate.'}`);
    } finally {
      setBusy('');
    }
  };

  const registrarVitoriaManual = async () => {
    if (!colaborador || busy) return;
    if (!window.confirm(`Registrar e creditar uma vitória de ${colaborador} em ${JOGOS_VITORIA[jogo]} usando a recompensa configurada na missão?`)) return;
    const matchId = globalThis.crypto?.randomUUID?.();
    if (!matchId) {
      setMensagem('Este navegador não permite criar um identificador seguro para o registro manual.');
      return;
    }
    setBusy('manual');
    setMensagem('');
    setMensagemErro(false);
    try {
      const { data: registrada, error: recordError } = await supabase.rpc('mercado_record_uniko_game_win', {
        p_match_id: matchId,
        p_player: colaborador,
        p_game: jogo,
      });
      if (recordError) throw recordError;
      if (registrada !== true) {
        throw new Error('A missão de vitórias está inativa ou sem recompensa configurada; nenhuma vitória foi registrada.');
      }
      const { data, error: claimError } = await supabase.rpc('mercado_claim_uniko_game_win', {
        p_player: colaborador,
        p_win_id: matchId,
      });
      if (claimError) throw claimError;
      const premio = Array.isArray(data) ? data[0] : data;
      setMensagem(`Vitória registrada e prêmio creditado para ${colaborador}: ${fmtNumero(premio?.comum)} Prisma Comum e ${fmtNumero(premio?.premium)} Prisma Premium.`);
      setColaborador('');
      await carregar();
    } catch (e) {
      console.error('[monitoramento-uso] Falha ao registrar vitória manual:', e);
      setMensagemErro(true);
      setMensagem(`Não foi possível concluir o registro manual: ${e?.message || 'falha ao processar.'}`);
      await carregar();
    } finally {
      setBusy('');
    }
  };

  const cell = { padding: '9px 10px', borderTop: `1px solid ${T.border}`, color: T.textS, fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap' };

  return (
    <Cartao titulo="Vitórias recentes dos Uniko Games" subtitulo="Histórico de partidas, resgates e recuperação de recompensas"
      extra={<button onClick={() => { setCarregando(true); void carregar(); }} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 10px', background: T.surface, color: T.textS, fontWeight: 600, cursor: 'pointer' }}>Atualizar</button>}>
      <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap', padding: '0 0 14px' }}>
        <label style={{ minWidth: 210, flex: 1, color: T.textT, fontSize: 11, fontWeight: 700 }}>
          REGISTRAR VITÓRIA NÃO LISTADA
          <select value={colaborador} onChange={(e) => setColaborador(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, color: T.text, background: T.surface, font: 'inherit' }}>
            <option value="">Selecione o colaborador</option>
            {funcionarios.filter((pessoa) => pessoa.role !== 'admin').map((pessoa) => (
              <option key={pessoa.id} value={pessoa.name}>{pessoa.name}</option>
            ))}
          </select>
        </label>
        <label style={{ minWidth: 150, color: T.textT, fontSize: 11, fontWeight: 700 }}>
          JOGO
          <select value={jogo} onChange={(e) => setJogo(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}`, color: T.text, background: T.surface, font: 'inherit' }}>
            {Object.entries(JOGOS_VITORIA).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <button disabled={!colaborador || !!busy} onClick={registrarVitoriaManual}
          style={{ border: 0, borderRadius: 8, padding: '9px 12px', background: T.gold, color: '#fff', fontWeight: 700, cursor: !colaborador || busy ? 'not-allowed' : 'pointer', opacity: !colaborador || busy ? 0.6 : 1 }}>
          {busy === 'manual' ? 'Registrando…' : 'Registrar e creditar'}
        </button>
      </div>
      <div style={{ color: T.textT, fontSize: 11, marginBottom: 12 }}>
        A recuperação usa a recompensa atual configurada para a missão e registra a operação no histórico. Para vitórias já listadas, use a ação da linha pendente; o resgate é atômico e não duplica o crédito.
      </div>
      {mensagem && <div role={mensagemErro ? 'alert' : 'status'} style={{ color: mensagemErro ? T.danger : T.textS, fontSize: 12, marginBottom: 10 }}>{mensagem}</div>}
      {erro && <div role="alert" style={{ color: T.danger, fontSize: 12, marginBottom: 10 }}>Erro ao carregar vitórias: {erro}</div>}
      {carregando ? <div style={{ color: T.textT, fontSize: 13 }}>Carregando histórico…</div>
        : vitorias.length ? (
          <div style={{ maxHeight: 420, overflow: 'auto', border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead style={{ position: 'sticky', top: 0, background: T.surface }}>
                <tr>
                  {['Data', 'Colaborador', 'Jogo', 'Recompensa', 'Situação', ''].map((titulo) => <th key={titulo} style={{ ...cell, borderTop: 0, fontWeight: 700 }}>{titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {vitorias.map((win) => {
                  const jogoId = Object.keys(JOGOS_VITORIA).find((id) => win.descr?.toLowerCase().includes(id)) || '';
                  const nomeCadastrado = funcionarios.some((pessoa) => pessoa.name === win.player);
                  return (
                    <tr key={win.id}>
                      <td style={cell}>{win.created_at ? new Date(win.created_at).toLocaleString('pt-BR') : '—'}</td>
                      <td style={{ ...cell, color: T.text, fontWeight: 600 }}>{win.player}</td>
                      <td style={cell}>{JOGOS_VITORIA[jogoId] || win.descr}</td>
                      <td style={cell}>{fmtNumero(win.comum)} comum · {fmtNumero(win.premium)} premium</td>
                      <td style={{ ...cell, color: win.resgatada ? '#2BA879' : nomeCadastrado ? T.gold : T.danger, fontWeight: 700 }}>
                        {win.resgatada ? 'Resgatada' : nomeCadastrado ? 'Pendente' : 'Nome não vinculado'}
                      </td>
                      <td style={cell}>
                        {!win.resgatada && nomeCadastrado && (
                          <button disabled={!!busy} onClick={() => creditarVitoria(win)}
                            style={{ border: `1px solid ${T.border}`, borderRadius: 7, padding: '6px 9px', color: T.text, background: T.surface, cursor: busy ? 'wait' : 'pointer' }}>
                            {busy === win.id ? 'Creditando…' : 'Creditar prêmio'}
                          </button>
                        )}
                        {!win.resgatada && !nomeCadastrado && <span title="Use o formulário acima para registrar pelo nome oficial do colaborador.">Confira o nome</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div style={{ color: T.textT, fontSize: 13 }}>Nenhuma vitória registrada ainda.</div>}
    </Cartao>
  );
}

export default function MonitoramentoUsoTab() {
  const [periodo, setPeriodo] = useState(30);
  const [dados, setDados] = useState({ funcionarios: [], dias: [], presencas: [], capturas: [], roster: [] });
  const [selecionado, setSelecionado] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [erro, setErro] = useState('');
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async () => {
    const idRequisicao = ++requisicaoAtual.current;
    setErro('');
    try {
      const inicio = diaUTC(new Date(Date.now() - (periodo - 1) * 24 * 60 * 60 * 1000));
      const token = localStorage.getItem('ch_token') || '';
      const resposta = await fetch(`${SERVER_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error || `Falha ao carregar funcionários (HTTP ${resposta.status}).`);

      const [dias, presencas, capturas, personalizados] = await Promise.all([
        buscarTodasPaginas(() => supabase.from('uniko_usage_daily')
          .select('employee_id,usage_day,total_seconds,module_seconds,theme_seconds')
          .gte('usage_day', inicio).order('usage_day').order('employee_id')),
        buscarTodasPaginas(() => supabase.from('uniko_usage_presence')
          .select('employee_id,module_key,theme_key,is_active,last_seen_at').order('employee_id')),
        buscarTodasPaginas(() => supabase.from('capture_uniko_captures')
          .select('player,uniko_id').order('id')),
        buscarTodasPaginas(() => supabase.from('custom_unikos').select('id,name').order('created_at')),
      ]);
      if (idRequisicao !== requisicaoAtual.current) return;
      const funcionarios = (corpo.employees || []).filter((pessoa) => pessoa?.id && pessoa?.name);
      const roster = [
        ...Object.values(CAPTURE_UNIKOS).map(({ id, name }) => ({ id, name })),
        ...personalizados.map(({ id, name }) => ({ id, name })),
      ];
      setDados({ funcionarios, dias, presencas, capturas, roster });
      setSelecionado((atual) => funcionarios.some((pessoa) => pessoa.id === atual) ? atual : '');
      setAtualizadoEm(new Date());
    } catch (e) {
      if (idRequisicao !== requisicaoAtual.current) return;
      console.error('[monitoramento-uso] Falha ao carregar os dados:', e);
      setErro(e.message || 'Não foi possível carregar os dados do monitoramento.');
    } finally {
      if (idRequisicao === requisicaoAtual.current) setCarregando(false);
    }
  }, [periodo]);

  useEffect(() => {
    const primeiraCarga = setTimeout(() => { void carregar(); }, 0);
    const id = setInterval(carregar, 30000);
    return () => {
      requisicaoAtual.current += 1;
      clearTimeout(primeiraCarga);
      clearInterval(id);
    };
  }, [carregar]);

  const resumo = useMemo(() => {
    const funcionarioPorId = new Map(dados.funcionarios.map((pessoa) => [pessoa.id, pessoa]));
    const porPessoa = new Map();
    const porDia = new Map();
    const porModulo = new Map();
    for (const linha of dados.dias) {
      const pessoa = porPessoa.get(linha.employee_id) || { segundos: 0, dias: new Map(), modulos: {} };
      pessoa.segundos += Number(linha.total_seconds) || 0;
      pessoa.dias.set(linha.usage_day, Number(linha.total_seconds) || 0);
      const modulos = linha.module_seconds || {};
      for (const [modulo, segundos] of Object.entries(modulos)) {
        pessoa.modulos[modulo] = (pessoa.modulos[modulo] || 0) + (Number(segundos) || 0);
        const total = porModulo.get(modulo) || 0;
        porModulo.set(modulo, total + (Number(segundos) || 0));
      }
      porPessoa.set(linha.employee_id, pessoa);
      porDia.set(linha.usage_day, (porDia.get(linha.usage_day) || 0) + (Number(linha.total_seconds) || 0));
    }
    const ranking = [...porPessoa.entries()]
      .map(([id, uso]) => ({ id, nome: funcionarioPorId.get(id)?.name || 'Colaborador', ...uso }))
      .sort((a, b) => b.segundos - a.segundos);
    const usados = ranking.filter((pessoa) => pessoa.segundos > 0);
    const total = ranking.reduce((soma, pessoa) => soma + pessoa.segundos, 0);
    const agora = atualizadoEm?.getTime() || 0;
    const online = dados.presencas.filter((presenca) =>
      (agora - new Date(presenca.last_seen_at).getTime()) <= 180000)
      .map((presenca) => ({ ...presenca, pessoa: funcionarioPorId.get(presenca.employee_id) }))
      .filter((presenca) => presenca.pessoa);
    const temas = new Map();
    for (const presenca of dados.presencas) {
      if (presenca.theme_key && funcionarioPorId.has(presenca.employee_id)) {
        temas.set(presenca.theme_key, (temas.get(presenca.theme_key) || 0) + 1);
      }
    }
    const temaMaisUsado = [...temas.entries()].sort((a, b) => b[1] - a[1]);
    const labelsDias = Array.from({ length: periodo }, (_, indice) => {
      const dia = diaUTC(new Date(agora - (periodo - 1 - indice) * 24 * 60 * 60 * 1000));
      return { chave: dia, rotulo: rotuloDia(dia), valor: porDia.get(dia) || 0 };
    });
    const modulos = [...porModulo.entries()]
      .map(([id, segundos]) => ({ id, nome: MODULOS[id] || id, segundos }))
      .sort((a, b) => b.segundos - a.segundos);
    return {
      ranking, usados, total, online, modulos, temas: temaMaisUsado, labelsDias,
      media: usados.length ? total / usados.length : 0,
      maximo: ranking[0] || null,
      funcionarioPorId,
    };
  }, [dados, periodo, atualizadoEm]);

  const pessoaSelecionada = resumo.funcionarioPorId.get(selecionado);
  const usoSelecionado = resumo.ranking.find((pessoa) => pessoa.id === selecionado);
  const modulosExibidos = selecionado
    ? Object.entries(usoSelecionado?.modulos || {})
      .filter(([, segundos]) => segundos > 0)
      .map(([id, segundos]) => ({ id, nome: MODULOS[id] || id, segundos }))
      .sort((a, b) => b.segundos - a.segundos)
    : resumo.modulos;
  const presencaSelecionada = dados.presencas.find((presenca) => presenca.employee_id === selecionado);
  const diasPessoa = resumo.labelsDias.map((dia) => ({
    ...dia,
    valor: usoSelecionado?.dias.get(dia.chave) || 0,
  }));
  const nomeParaCapturas = normalizarNome(pessoaSelecionada?.name);
  const idsPossuidos = new Set(dados.capturas
    .filter((captura) => normalizarNome(captura.player) === nomeParaCapturas)
    .map((captura) => captura.uniko_id));
  const ehAdmin = pessoaSelecionada?.role === 'admin';
  const unikosPossuidos = dados.roster.filter((uniko) => ehAdmin || idsPossuidos.has(uniko.id));
  const unikosFaltantes = ehAdmin ? [] : dados.roster.filter((uniko) => !idsPossuidos.has(uniko.id));
  const themes = resumo.temas;
  const maxModulo = Math.max(1, ...modulosExibidos.map((modulo) => modulo.segundos));
  const maxTema = Math.max(1, ...themes.map(([, quantidade]) => quantidade));
  const maxPessoa = Math.max(1, ...resumo.ranking.slice(0, 8).map((pessoa) => pessoa.segundos));

  if (carregando) return <div style={{ padding: 24, color: T.textS }}>Carregando monitoramento de uso…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: T.text, fontSize: 20, fontWeight: 700 }}>Monitoramento de Uso</div>
          <div style={{ color: T.textT, fontSize: 12, marginTop: 3 }}>
            Tempo ativo no sistema · presença atualizada a cada 20 segundos
            {atualizadoEm && ` · Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={periodo} onChange={(e) => { setCarregando(true); setPeriodo(Number(e.target.value)); }}
            style={{ padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, color: T.text, background: T.surface, font: 'inherit' }}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button onClick={() => { setCarregando(true); void carregar(); }} style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: '8px 12px', background: T.surface, color: T.textS, fontWeight: 600, cursor: 'pointer' }}>Atualizar</button>
        </div>
      </div>

      {erro && (
        <div role="alert" style={{ padding: 14, borderRadius: 12, background: 'rgba(192,64,80,.08)', border: '1px solid rgba(192,64,80,.28)', color: T.danger, fontSize: 13 }}>
          Não foi possível carregar o monitoramento: {erro}. Confirme se o arquivo <code>supabase_monitoramento_uso.sql</code> já foi executado no Supabase principal.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12 }}>
        {[
          ['Tempo total', fmtTempo(resumo.total)],
          ['Online agora', fmtNumero(resumo.online.length)],
          ['Média por usuário ativo', fmtTempo(resumo.media)],
          ['Maior uso individual', resumo.maximo ? fmtTempo(resumo.maximo.segundos) : '—'],
        ].map(([label, valor]) => (
          <div key={label} style={{ padding: 16, borderRadius: 14, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ color: T.textT, fontSize: 12 }}>{label}</div>
            <div style={{ color: T.text, fontSize: 21, fontWeight: 700, marginTop: 5 }}>{valor}</div>
            {label === 'Maior uso individual' && resumo.maximo && <div style={{ color: T.textS, fontSize: 11, marginTop: 3 }}>{resumo.maximo.nome}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 16 }}>
        <Cartao titulo="Uso geral" subtitulo={`Tempo ativo por dia nos últimos ${periodo} dias`}>
          <GraficoBarras itens={resumo.labelsDias} cor={T.gold} />
        </Cartao>
        <Cartao titulo="Pessoas online" subtitulo="Uniko aberto no navegador com conexão recente (até 3 minutos)">
          {resumo.online.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumo.online.map((presenca) => (
                <div key={presenca.employee_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, background: T.surfaceSub || 'rgba(0,0,0,.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2BA879', flexShrink: 0 }} />
                    <span style={{ color: T.text, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{presenca.pessoa.name}</span>
                  </div>
                  <span style={{ color: T.textT, fontSize: 11, textAlign: 'right' }}>
                    {MODULOS[presenca.module_key] || presenca.module_key} · {THEMES[presenca.theme_key]?.name || presenca.theme_key}
                  </span>
                </div>
              ))}
            </div>
          ) : <div style={{ color: T.textT, fontSize: 13, padding: '18px 0' }}>Nenhum colaborador online no momento.</div>}
        </Cartao>
      </div>

      <VitoriasUnikoGames funcionarios={dados.funcionarios} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 16 }}>
        <Cartao titulo="Uso por módulo" subtitulo={`Tempo acumulado no período selecionado${pessoaSelecionada ? ` · ${pessoaSelecionada.name}` : ' · todos os colaboradores'}`}>
          {modulosExibidos.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {modulosExibidos.map((modulo, indice) => (
                <BarraProgresso key={modulo.id} rotulo={modulo.nome} valor={modulo.segundos} maximo={maxModulo}
                  cor={CORES[indice % CORES.length]} detalhe={fmtTempo(modulo.segundos)} />
              ))}
            </div>
          ) : <div style={{ color: T.textT, fontSize: 13 }}>{selecionado ? 'Essa pessoa ainda não tem uso registrado no período.' : 'Ainda não há uso registrado no período.'}</div>}
        </Cartao>
        <Cartao titulo="Temas registrados" subtitulo="Último tema observado por colaborador">
          {themes.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {themes.map(([tema, quantidade], indice) => (
                <BarraProgresso key={tema} rotulo={THEMES[tema]?.name || tema} valor={quantidade} maximo={maxTema}
                  cor={CORES[indice % CORES.length]} detalhe={`${fmtNumero(quantidade)} pessoa${quantidade === 1 ? '' : 's'}`} />
              ))}
            </div>
          ) : <div style={{ color: T.textT, fontSize: 13 }}>Os temas aparecerão conforme as pessoas acessarem o sistema.</div>}
        </Cartao>
      </div>

      <Cartao titulo="Uso individual" subtitulo="Ranking e histórico diário por colaborador"
        extra={<span style={{ color: T.textT, fontSize: 12 }}>{fmtNumero(resumo.usados.length)} com uso no período</span>}>
        {resumo.ranking.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumo.ranking.slice(0, 8).map((pessoa, indice) => (
                <div key={pessoa.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,1fr) minmax(80px,1.3fr) auto', gap: 9, alignItems: 'center' }}>
                  <button onClick={() => setSelecionado(pessoa.id)} title={`Ver dados de ${pessoa.nome}`}
                    style={{ color: selecionado === pessoa.id ? T.gold : T.text, background: 'transparent', border: 0, padding: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }}>
                    {pessoa.nome}
                  </button>
                  <div style={{ height: 8, background: T.surfaceSub || 'rgba(0,0,0,.07)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${(pessoa.segundos / maxPessoa) * 100}%`, height: '100%', background: CORES[indice % CORES.length], borderRadius: 99 }} />
                  </div>
                  <span style={{ color: T.textS, fontSize: 11, whiteSpace: 'nowrap' }}>{fmtTempo(pessoa.segundos)}</span>
                </div>
              ))}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <strong style={{ color: T.text, fontSize: 13 }}>{pessoaSelecionada?.name || 'Selecione uma pessoa'}</strong>
                <select aria-label="Selecionar colaborador" value={selecionado} onChange={(e) => setSelecionado(e.target.value)}
                  style={{ maxWidth: 170, padding: '6px 8px', borderRadius: 8, border: `1px solid ${T.border}`, color: T.text, background: T.surface, font: 'inherit', fontSize: 12 }}>
                  <option value="">Todos os colaboradores</option>
                  {dados.funcionarios.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.name}</option>)}
                </select>
              </div>
              {selecionado ? (
                <>
                  <GraficoBarras itens={diasPessoa} cor={T.purple || '#8B6CE8'} />
                  <div style={{ color: T.textT, fontSize: 11, marginTop: -4 }}>
                    {fmtTempo(usoSelecionado?.segundos || 0)} no período
                    {presencaSelecionada?.theme_key && ` · Tema: ${THEMES[presencaSelecionada.theme_key]?.name || presencaSelecionada.theme_key}`}
                    {' · '}{resumo.modulos
                      .filter((modulo) => usoSelecionado?.modulos[modulo.id])
                      .sort((a, b) => (usoSelecionado?.modulos[b.id] || 0) - (usoSelecionado?.modulos[a.id] || 0))
                      .slice(0, 3)
                      .map((modulo) => `${modulo.nome}: ${fmtTempo(usoSelecionado.modulos[modulo.id])}`).join(' · ') || 'Sem uso registrado'}
                  </div>
                </>
              ) : <div style={{ color: T.textT, fontSize: 12, padding: '22px 4px' }}>Selecione uma pessoa para ver o histórico diário individual.</div>}
            </div>
          </div>
        ) : <div style={{ color: T.textT, fontSize: 13 }}>Ainda não há dados de uso. O histórico começa após a instalação do monitoramento.</div>}
      </Cartao>

      <Cartao titulo="Coleção de Unikos" subtitulo="Unikos registrados como capturados e os que ainda faltam para a pessoa selecionada"
        extra={dados.roster.length ? <span style={{ color: T.textT, fontSize: 12 }}>{dados.roster.length} Unikos no catálogo</span> : null}>
        {pessoaSelecionada ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 18 }}>
            <div>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Possui · {unikosPossuidos.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {unikosPossuidos.map((uniko) => <span key={uniko.id} style={{ padding: '5px 8px', borderRadius: 99, color: '#208465', background: 'rgba(32,132,101,.1)', fontSize: 11 }}>{uniko.name}</span>)}
                {!unikosPossuidos.length && <span style={{ color: T.textT, fontSize: 12 }}>Nenhum Uniko registrado.</span>}
              </div>
            </div>
            <div>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ainda não possui · {unikosFaltantes.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {unikosFaltantes.map((uniko) => <span key={uniko.id} style={{ padding: '5px 8px', borderRadius: 99, color: T.textS, background: T.surfaceSub || 'rgba(0,0,0,.04)', fontSize: 11 }}>{uniko.name}</span>)}
                {!unikosFaltantes.length && <span style={{ color: T.textT, fontSize: 12 }}>Coleção completa.</span>}
              </div>
              {ehAdmin && <div style={{ color: T.textT, fontSize: 11, marginTop: 8 }}>Administradores têm todos os Unikos liberados.</div>}
            </div>
          </div>
        ) : <div style={{ color: T.textT, fontSize: 13 }}>Selecione um colaborador para ver a coleção.</div>}
      </Cartao>

      <div style={{ color: T.textT, fontSize: 11, lineHeight: 1.5 }}>
        O tempo é contado somente com o sistema aberto em uma aba visível e em foco. A presença online continua enquanto o Uniko estiver aberto no navegador e pode levar até 3 minutos para desaparecer após fechar a aba ou perder a conexão. O histórico não é retroativo.
      </div>
    </div>
  );
}
