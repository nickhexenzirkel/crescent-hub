import { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../contexts/theme';
import { MUNICIPIOS } from '../email';
import {
  carregarCadastroFaturamento,
  carregarCoresRegionais,
  corPadraoRegional,
  chaveRegionalFaturamento,
  normalizarCadastroFaturamento,
  nomeRegionalFaturamento,
  REGIONAIS_FATURAMENTO,
  salvarCoresRegionais,
  salvarCadastroFaturamento,
} from '../../shared/faturamentoComerciais';

const REGIONAIS_SUGERIDAS = REGIONAIS_FATURAMENTO.map(({ nome }) => nome);
const FORM_VAZIO = { municipio: '', regional: '', responsavelFaturamento: '' };
const CAMPOS_EM_LOTE = [
  { campo: 'regional', rotulo: 'Regional' },
  { campo: 'responsavelFaturamento', rotulo: 'Faturista' },
];

export default function GerenciarComercialTab() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [importando, setImportando] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [coresRegionais, setCoresRegionais] = useState({});
  const [coresRascunho, setCoresRascunho] = useState({});
  const [salvandoCor, setSalvandoCor] = useState('');
  const [nomesEmLote, setNomesEmLote] = useState({ regional: '', responsavelFaturamento: '' });
  const [novosNomesEmLote, setNovosNomesEmLote] = useState({ regional: '', responsavelFaturamento: '' });
  const arquivoRef = useRef(null);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [cadastro, cores] = await Promise.all([carregarCadastroFaturamento(), carregarCoresRegionais()]);
      setClientes(cadastro);
      setCoresRegionais(cores);
      setCoresRascunho({});
    } catch (error) {
      setErro(`Não foi possível carregar o cadastro: ${error.message || 'erro desconhecido'}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const nomesPorCampo = useMemo(() => Object.fromEntries(CAMPOS_EM_LOTE.map(({ campo }) => [
    campo,
    [...new Set(clientes.map(item => item[campo]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
  ])), [clientes]);
  const listaVisivel = useMemo(() => clientes
    .filter(item => normalizarCadastroFaturamento(`${item.municipio} ${item.regional} ${item.responsavelFaturamento}`)
      .includes(normalizarCadastroFaturamento(busca)))
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR')), [clientes, busca]);
  const chavesVisiveis = listaVisivel.map(item => normalizarCadastroFaturamento(item.municipio));
  const todosVisiveisSelecionados = chavesVisiveis.length > 0 && chavesVisiveis.every(chave => selecionados.includes(chave));
  const regionaisCadastradas = useMemo(() => {
    const regionais = new Map(REGIONAIS_FATURAMENTO.map(({ nome }) => [chaveRegionalFaturamento(nome), nome]));
    clientes.forEach(cliente => {
      if (cliente.regional) {
        const nome = nomeRegionalFaturamento(cliente.regional);
        regionais.set(chaveRegionalFaturamento(nome), nome);
      }
    });
    return [...regionais.entries()].map(([chave, nome]) => ({ chave, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [clientes]);

  const salvarListaAtualizada = async (atualizados, mensagem) => {
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      setClientes(await salvarCadastroFaturamento(atualizados));
      setSucesso(mensagem);
      return true;
    } catch (error) {
      setErro(`Não foi possível salvar as alterações: ${error.message || 'erro desconhecido'}`);
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const renomearEmLote = async campo => {
    const nomeAtual = nomesEmLote[campo];
    const novoNome = novosNomesEmLote[campo].trim();
    if (!nomeAtual || !novoNome) {
      setErro('Selecione o nome atual e informe o novo nome.');
      return;
    }
    if (normalizarCadastroFaturamento(nomeAtual) === normalizarCadastroFaturamento(novoNome)) {
      setErro('O novo nome precisa ser diferente do atual.');
      return;
    }
    const quantidade = clientes.filter(item => normalizarCadastroFaturamento(item[campo]) === normalizarCadastroFaturamento(nomeAtual)).length;
    if (!window.confirm(`Alterar "${nomeAtual}" para "${novoNome}" em ${quantidade} ${quantidade === 1 ? 'cadastro' : 'cadastros'}?`)) return;
    const atualizados = clientes.map(item => normalizarCadastroFaturamento(item[campo]) === normalizarCadastroFaturamento(nomeAtual)
      ? { ...item, [campo]: novoNome }
      : item);
    if (await salvarListaAtualizada(atualizados, `${quantidade} ${quantidade === 1 ? 'cadastro atualizado' : 'cadastros atualizados'}: ${nomeAtual} → ${novoNome}.`)) {
      setNomesEmLote(current => ({ ...current, [campo]: '' }));
      setNovosNomesEmLote(current => ({ ...current, [campo]: '' }));
    }
  };

  const alternarSelecao = municipio => {
    const chave = normalizarCadastroFaturamento(municipio);
    setSelecionados(current => current.includes(chave) ? current.filter(item => item !== chave) : [...current, chave]);
  };

  const alternarSelecaoVisivel = () => {
    if (todosVisiveisSelecionados) {
      setSelecionados(current => current.filter(chave => !chavesVisiveis.includes(chave)));
    } else {
      setSelecionados(current => [...new Set([...current, ...chavesVisiveis])]);
    }
  };

  const alternarSelecaoTodos = () => {
    const chavesTodos = clientes.map(item => normalizarCadastroFaturamento(item.municipio));
    if (chavesTodos.length && chavesTodos.every(chave => selecionados.includes(chave))) setSelecionados([]);
    else setSelecionados(chavesTodos);
  };

  const removerSelecionados = async () => {
    if (!selecionados.length) return;
    const removidos = new Set(selecionados);
    const quantidade = clientes.filter(item => removidos.has(normalizarCadastroFaturamento(item.municipio))).length;
    if (!window.confirm(`Remover ${quantidade} ${quantidade === 1 ? 'cliente selecionado' : 'clientes selecionados'}? Esta ação não pode ser desfeita.`)) return;
    const restante = clientes.filter(item => !removidos.has(normalizarCadastroFaturamento(item.municipio)));
    if (await salvarListaAtualizada(restante, `${quantidade} ${quantidade === 1 ? 'cliente removido' : 'clientes removidos'}.`)) {
      setSelecionados([]);
      if (editando && removidos.has(normalizarCadastroFaturamento(editando))) {
        setEditando('');
        setForm(FORM_VAZIO);
      }
    }
  };

  const salvarCorRegional = async (regional, cor) => {
    const chave = chaveRegionalFaturamento(regional);
    setSalvandoCor(chave);
    setErro('');
    setSucesso('');
    try {
      const cores = await salvarCoresRegionais({ ...coresRegionais, [chave]: cor });
      setCoresRegionais(cores);
      setCoresRascunho(current => {
        const { [chave]: _removida, ...restante } = current;
        return restante;
      });
      setSucesso(`Cor da regional ${regional} atualizada.`);
    } catch (error) {
      setErro(`Não foi possível salvar a cor da regional: ${error.message || 'erro desconhecido'}`);
    } finally {
      setSalvandoCor('');
    }
  };

  const salvar = async event => {
    event.preventDefault();
    const municipio = form.municipio.trim();
    if (!municipio) { setErro('Informe o município ou cliente.'); return; }
    const chave = normalizarCadastroFaturamento(municipio);
    if (clientes.some(item => normalizarCadastroFaturamento(item.municipio) === chave && item.municipio !== editando)) {
      setErro('Esse município já está cadastrado. Edite a linha existente.');
      return;
    }
    const novo = { ...form, municipio };
    const atualizados = editando
      ? clientes.map(item => item.municipio === editando ? novo : item)
      : [...clientes, novo];
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      setClientes(await salvarCadastroFaturamento(atualizados));
      setForm(FORM_VAZIO);
      setEditando('');
      setSucesso(editando ? 'Associação atualizada.' : 'Município cadastrado.');
    } catch (error) {
      setErro(`Não foi possível salvar: ${error.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  };

  const editar = item => {
    setForm({ ...item });
    setEditando(item.municipio);
    setErro('');
    setSucesso('');
  };

  const remover = async municipio => {
    if (!window.confirm(`Remover a associação de ${municipio}?`)) return;
    setSalvando(true);
    setErro('');
    try {
      setClientes(await salvarCadastroFaturamento(clientes.filter(item => item.municipio !== municipio)));
      if (editando === municipio) { setForm(FORM_VAZIO); setEditando(''); }
      setSucesso(`${municipio} removido do cadastro.`);
    } catch (error) {
      setErro(`Não foi possível remover: ${error.message || 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  };

  const importarPlanilha = async event => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setImportando(true);
    setErro('');
    setSucesso('');
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
      const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
      if (!primeiraAba) throw new Error('A planilha não tem uma aba com dados.');
      const linhas = XLSX.utils.sheet_to_json(primeiraAba, { header: 1, defval: '' });
      const normalizarCabecalho = valor => normalizarCadastroFaturamento(valor);
      const cabecalho = linhas.slice(0, 30).findIndex(linha => {
        const colunas = linha.map(normalizarCabecalho);
        const temCliente = colunas.some(coluna => /(^| )(municipio|cliente|nome)( |$)/.test(coluna) || coluna.includes('nome do cliente'));
        const temRegional = colunas.some(coluna => /(^| )(regional|comercial)( |$)/.test(coluna));
        const temFaturista = colunas.some(coluna => /(^| )(faturista|quem fatura)( |$)/.test(coluna) || coluna.includes('responsavel pelo faturamento'));
        return temCliente && temRegional && temFaturista;
      });
      if (cabecalho < 0) {
        throw new Error('Não encontrei cabeçalhos para Cliente/Município, Regional (ou Comercial em planilhas antigas) e Faturista/Quem fatura.');
      }

      const titulos = linhas[cabecalho].map(normalizarCabecalho);
      const indiceCliente = titulos.findIndex(coluna => /(^| )(municipio|cliente|nome)( |$)/.test(coluna) || coluna.includes('nome do cliente'));
      const indiceRegional = titulos.findIndex(coluna => /(^| )(regional|comercial)( |$)/.test(coluna));
      const indiceFaturista = titulos.findIndex(coluna => /(^| )(faturista|quem fatura)( |$)/.test(coluna) || coluna.includes('responsavel pelo faturamento'));
      const importados = [];
      const indices = new Map();
      const invalidos = [];
      linhas.slice(cabecalho + 1).forEach((linha, index) => {
        const numeroLinha = cabecalho + index + 2;
        const cliente = String(linha[indiceCliente] ?? '').trim();
        const regional = String(linha[indiceRegional] ?? '').trim();
        const faturista = String(linha[indiceFaturista] ?? '').trim();
        if (!cliente && !regional && !faturista) return;
        if (!cliente || !regional || !faturista) {
          invalidos.push(numeroLinha);
          return;
        }
        const chave = normalizarCadastroFaturamento(cliente);
        if (indices.has(chave)) {
          throw new Error(`O cliente "${cliente}" aparece mais de uma vez nas linhas ${indices.get(chave)} e ${numeroLinha}.`);
        }
        indices.set(chave, numeroLinha);
        importados.push({
          municipio: cliente,
          regional,
          responsavelFaturamento: faturista,
        });
      });
      if (invalidos.length) {
        throw new Error(`Preencha Cliente, Regional e Faturista nas linhas ${invalidos.slice(0, 8).join(', ')}${invalidos.length > 8 ? '…' : ''}. Nenhuma alteração foi salva.`);
      }
      if (!importados.length) throw new Error('Não encontrei linhas de clientes válidas para importar.');

      const existentes = new Map(clientes.map(item => [normalizarCadastroFaturamento(item.municipio), item]));
      let novos = 0;
      let atualizados = 0;
      for (const item of importados) {
        if (existentes.has(normalizarCadastroFaturamento(item.municipio))) atualizados += 1;
        else novos += 1;
        existentes.set(normalizarCadastroFaturamento(item.municipio), item);
      }
      const atualizadosCadastro = await salvarCadastroFaturamento([...existentes.values()]);
      setClientes(atualizadosCadastro);
      setSucesso(`Planilha "${arquivo.name}" importada: ${novos} novos e ${atualizados} atualizados.`);
    } catch (error) {
      setErro(`Não foi possível importar a planilha: ${error.message || 'erro desconhecido'}`);
    } finally {
      setImportando(false);
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 9,
    border: `1px solid ${T.border}`, background: T.page || T.surface, color: T.text,
    font: '13px var(--font-body)', outline: 'none',
  };
  const btnStyle = {
    padding: '9px 13px', borderRadius: 9, border: `1px solid ${T.border}`,
    background: T.surface, color: T.text, cursor: 'pointer', font: '600 12px var(--font-body)',
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <header style={{ padding: '17px 20px', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <h1 style={{ margin: 0, color: T.text, fontSize: 19 }}>Gerenciar Regionais e Faturistas</h1>
        <p style={{ margin: '6px 0 0', color: T.textS, fontSize: 13, lineHeight: 1.5 }}>
          Associe cada município ou cliente a uma regional e à pessoa responsável pelo faturamento.
          Essas informações são compartilhadas com o Acompanhar Faturamento.
        </p>
      </header>

      <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', alignItems: 'end', gap: 11, padding: 16, borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <label style={{ display: 'grid', gap: 5, color: T.textS, fontSize: 11, fontWeight: 650 }}>
          Município / cliente
          <input list="faturamento-municipios" required value={form.municipio} onChange={event => setForm(current => ({ ...current, municipio: event.target.value }))} placeholder="Selecione ou digite" style={inputStyle} />
          <datalist id="faturamento-municipios">{MUNICIPIOS.map(nome => <option key={nome} value={nome} />)}</datalist>
        </label>
        <label style={{ display: 'grid', gap: 5, color: T.textS, fontSize: 11, fontWeight: 650 }}>
          Regional
          <input list="faturamento-regionais" value={form.regional} onChange={event => setForm(current => ({ ...current, regional: event.target.value }))} placeholder="Ex.: Rene" style={inputStyle} />
          <datalist id="faturamento-regionais">{REGIONAIS_SUGERIDAS.map(nome => <option key={nome} value={nome} />)}</datalist>
        </label>
        <label style={{ display: 'grid', gap: 5, color: T.textS, fontSize: 11, fontWeight: 650 }}>
          Faturista
          <input value={form.responsavelFaturamento} onChange={event => setForm(current => ({ ...current, responsavelFaturamento: event.target.value }))} placeholder="Nome da pessoa responsável" style={inputStyle} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={salvando || carregando} style={{ ...btnStyle, flex: 1, border: 0, color: '#fff', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, opacity: salvando ? 0.65 : 1 }}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alteração' : 'Adicionar'}
          </button>
          {editando && <button type="button" onClick={() => { setEditando(''); setForm(FORM_VAZIO); }} style={btnStyle}>Cancelar</button>}
        </div>
      </form>

      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <div>
          <strong style={{ display: 'block', color: T.text, fontSize: 13 }}>Importar planilha de clientes</strong>
          <span style={{ display: 'block', marginTop: 4, color: T.textS, fontSize: 11.5, lineHeight: 1.5 }}>
            Colunas obrigatórias: nome do cliente, regional e faturista. Linhas existentes serão atualizadas; as demais serão adicionadas.
          </span>
        </div>
        <input ref={arquivoRef} type="file" accept=".xlsx,.xls,.csv" onChange={importarPlanilha} style={{ display: 'none' }} />
        <button type="button" disabled={importando || salvando || carregando} onClick={() => arquivoRef.current?.click()} style={{ ...btnStyle, border: 0, color: '#fff', background: `linear-gradient(135deg,${T.gold},${T.goldL || T.gold}cc)`, opacity: importando ? 0.65 : 1 }}>
          {importando ? 'Importando…' : 'Anexar planilha'}
        </button>
      </section>

      <section style={{ display: 'grid', gap: 10, padding: '15px 16px', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <div>
          <strong style={{ display: 'block', color: T.text, fontSize: 13 }}>Renomear em lote</strong>
          <span style={{ display: 'block', marginTop: 4, color: T.textS, fontSize: 11.5 }}>
            Atualiza todos os clientes que usam o nome selecionado, sem editar um por um.
          </span>
        </div>
        {CAMPOS_EM_LOTE.map(({ campo, rotulo }) => (
          <div key={campo} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', alignItems: 'end', gap: 9 }}>
            <strong style={{ alignSelf: 'center', color: T.textS, fontSize: 12 }}>{rotulo}</strong>
            <label style={{ display: 'grid', gap: 4, color: T.textT, fontSize: 10 }}>
              Nome atual
              <select value={nomesEmLote[campo]} onChange={event => setNomesEmLote(current => ({ ...current, [campo]: event.target.value }))} style={inputStyle}>
                <option value="">Selecione…</option>
                {nomesPorCampo[campo].map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, color: T.textT, fontSize: 10 }}>
              Novo nome
              <input value={novosNomesEmLote[campo]} onChange={event => setNovosNomesEmLote(current => ({ ...current, [campo]: event.target.value }))} placeholder={`Novo nome de ${rotulo.toLowerCase()}`} style={inputStyle} />
            </label>
            <button type="button" disabled={salvando || carregando || !nomesPorCampo[campo].length} onClick={() => renomearEmLote(campo)} style={{ ...btnStyle, minWidth: 105, opacity: salvando || carregando || !nomesPorCampo[campo].length ? 0.55 : 1 }}>
              {salvando ? 'Salvando…' : 'Renomear todos'}
            </button>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gap: 11, padding: '15px 16px', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <div>
          <strong style={{ display: 'block', color: T.text, fontSize: 13 }}>Cores das regionais</strong>
          <span style={{ display: 'block', marginTop: 4, color: T.textS, fontSize: 11.5 }}>
            Escolha uma cor para identificar cada regional no Acompanhar Faturamento.
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8 }}>
          {regionaisCadastradas.map(({ chave, nome }) => {
            const corAtual = coresRegionais[chave] || corPadraoRegional(nome);
            const corEscolhida = coresRascunho[chave] || corAtual;
            const alterada = corEscolhida.toUpperCase() !== corAtual.toUpperCase();
            return (
              <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <input
                  type="color"
                  aria-label={`Cor da regional ${nome}`}
                  value={corEscolhida}
                  onChange={event => setCoresRascunho(current => ({ ...current, [chave]: event.target.value }))}
                  style={{ width: 36, height: 32, padding: 2, border: `1px solid ${T.border}`, borderRadius: 7, background: T.surface, cursor: 'pointer' }}
                />
                <span style={{ flex: 1, color: T.text, fontSize: 12, fontWeight: 650 }}>{nome}</span>
                <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: corEscolhida, border: `1px solid ${T.border}` }} />
                {alterada && (
                  <button type="button" disabled={salvandoCor === chave} onClick={() => salvarCorRegional(nome, corEscolhida)} style={{ ...btnStyle, padding: '6px 9px' }}>
                    {salvandoCor === chave ? 'Salvando…' : 'Salvar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {(erro || sucesso) && (
        <div role="status" style={{ padding: '10px 13px', borderRadius: 9, color: erro ? (T.danger || '#C04050') : (T.success || '#16845D'), background: erro ? 'rgba(192,64,80,.08)' : 'rgba(22,132,93,.08)', fontSize: 12 }}>
          {erro || sucesso}
        </div>
      )}

      <section style={{ overflow: 'hidden', borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14 }}>
          <strong style={{ color: T.text, fontSize: 14 }}>{clientes.length} municípios cadastrados</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar município, regional ou pessoa…" style={{ ...inputStyle, width: 'min(320px,65vw)' }} />
            <button type="button" onClick={carregar} disabled={carregando || salvando} style={btnStyle}>{carregando ? 'Carregando…' : 'Atualizar'}</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '0 14px 12px' }}>
          <button type="button" onClick={alternarSelecaoTodos} disabled={carregando || salvando || !clientes.length} style={btnStyle}>
            {clientes.length > 0 && clientes.every(item => selecionados.includes(normalizarCadastroFaturamento(item.municipio))) ? 'Desmarcar todos' : 'Selecionar todos os clientes'}
          </button>
          {busca && <button type="button" onClick={alternarSelecaoVisivel} disabled={carregando || salvando || !listaVisivel.length} style={btnStyle}>
            {todosVisiveisSelecionados ? 'Desmarcar resultados' : 'Selecionar resultados'}
          </button>}
          {selecionados.length > 0 && (
            <>
              <span style={{ color: T.textS, fontSize: 12 }}>{selecionados.length} selecionados</span>
              <button type="button" onClick={removerSelecionados} disabled={salvando || carregando} style={{ ...btnStyle, color: '#C04050', borderColor: 'rgba(192,64,80,.35)' }}>
                {salvando ? 'Salvando…' : `Remover selecionados (${selecionados.length})`}
              </button>
              <button type="button" onClick={() => setSelecionados([])} disabled={salvando} style={btnStyle}>Limpar seleção</button>
            </>
          )}
        </div>
        {carregando ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.textS, fontSize: 13 }}>Carregando cadastro…</div>
        ) : !listaVisivel.length ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.textS, fontSize: 13 }}>{clientes.length ? 'Nenhum resultado para essa busca.' : 'Ainda não há municípios cadastrados.'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ textAlign: 'left', color: T.textS, background: T.page || T.surface }}>
                <th scope="col" style={{ padding: '10px 12px' }}>
                  <input type="checkbox" aria-label="Selecionar todos os resultados visíveis" checked={todosVisiveisSelecionados} onChange={alternarSelecaoVisivel} />
                </th>
                {['Município / cliente', 'Regional', 'Faturista', 'Ações'].map(label => <th key={label} scope="col" style={{ padding: '10px 12px', fontSize: 10.5 }}>{label}</th>)}
              </tr></thead>
              <tbody>{listaVisivel.map(item => (
                <tr key={item.municipio} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="checkbox" aria-label={`Selecionar ${item.municipio}`} checked={selecionados.includes(normalizarCadastroFaturamento(item.municipio))} onChange={() => alternarSelecao(item.municipio)} />
                  </td>
                  <td style={{ padding: '11px 12px', color: T.text, fontWeight: 700 }}>{item.municipio}</td>
                  {[item.regional, item.responsavelFaturamento].map((valor, index) => <td key={index} style={{ padding: '11px 12px', color: valor ? T.textS : T.textT }}>{valor || 'Não definido'}</td>)}
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => editar(item)} disabled={salvando} style={btnStyle}>Editar</button>
                    <button type="button" onClick={() => remover(item.municipio)} disabled={salvando} style={{ ...btnStyle, marginLeft: 6, color: T.danger || '#C04050' }}>Remover</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
