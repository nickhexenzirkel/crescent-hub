import { useCallback, useEffect, useRef, useState } from 'react';
import { T } from '../../contexts/theme';
import { disconnect, downloadAttachment, getAttachment, getMessage, getStatus, listMessages, startOAuth } from './api';

const buttonStyle = {
  border: `1px solid ${T.border}`,
  borderRadius: 9,
  padding: '8px 12px',
  color: T.text,
  background: T.surface,
  cursor: 'pointer',
  font: '600 13px var(--font-body)',
};
const muted = { color: T.textS, fontSize: 13 };
const MUNICIPIOS = [
  'Acaraú', 'Acopiara', 'Alcântaras', 'Alexânia', 'Amontada', 'Angical do Piauí', 'Apuiarés', 'Aquiraz',
  'Aracati', 'Aracoiaba', 'Aratuba', 'Assaré', 'Aurora', 'Barreira', 'Baturité', 'Beberibe', 'Boa Viagem',
  'Campos Sales', 'Canindé', 'Capistrano', 'Caridade', 'Cariré', 'Carnaubal', 'Cascavel', 'Caucaia',
  'Chaval', 'Choró', 'Chorozinho', 'Coreaú', 'Crateús', 'Cruz', 'Deputado Irapuan Pinheiro', 'Eusébio',
  'Forquilha', 'Fortaleza', 'Frecheirinha', 'General Sampaio', 'Granja', 'Granjeiro', 'Groaíras', 'Guaiúba',
  'Guaraciaba do Norte', 'Guaramiranga', 'Horizonte', 'Ibaretama', 'Ibicuitinga', 'Icapuí', 'Icó', 'Iguatu',
  'Ipu', 'Iracema', 'Itaitinga', 'Itapajé', 'Itapipoca', 'Itapiúna', 'Itarema', 'Jaguaretama', 'Jaguaribara',
  'Jaguaribe', 'Jijoca de Jericoacoara', 'Joaquim Pires', 'Juazeiro do Piauí', 'Lavras da Mangabeira',
  'Madalena', 'Maracanaú', 'Maranguape', 'Marco', 'Martinópole', 'Massapê', 'Meruoca', 'Miguel Alves', 'Milhã',
  'Miraíma', 'Missão Velha', 'Mombaça', 'Monsenhor Tabosa', 'Moraújo', 'Morrinhos', 'Morro do Pilar', 'Mulungu',
  'Nazária', 'Orós', 'Pacatuba', 'Pacujá', 'Palhano', 'Palmares', 'Palmácia', 'Paracuru', 'Paraipaba',
  'Parnaíba', 'Pedra Branca', 'Penaforte', 'Pentecoste', 'Pereiro', 'Piquet Carneiro', 'Pires Ferreira',
  'Poranga', 'Potengi', 'Quixadá', 'Quixeré', 'Russas', 'Saboeiro', 'São Benedito', 'São Gonçalo do Amarante',
  'São Luís do Curu', 'Senador Pompeu', 'Senador Sá', 'Sobral', 'Solonópole', 'Tabuleiro do Norte', 'Tarrafas',
  'Tauá', 'Tejuçuoca', 'Tianguá', 'Trairi', 'Tururu', 'Ubajara', 'Umirim', 'Uruburetama', 'Uruoca',
  'Várzea Grande', 'Viçosa do Ceará',
];
const INSTITUICOES = [
  'Cagece', 'Câmara Municipal de Acaraú', 'Câmara Municipal de Acopiara', 'Câmara Municipal de Aquiraz',
  'Câmara Municipal de Capistrano', 'Câmara Municipal de Eusébio', 'Câmara Municipal de Forquilha',
  'Câmara Municipal de Groaíras', 'Câmara Municipal de Guaramiranga', 'Câmara Municipal de Itaitinga',
  'Câmara Municipal de Itapiúna', 'Câmara Municipal de Itarema', 'Câmara Municipal de Meruoca',
  'Câmara Municipal de Mucambo', 'Câmara Municipal de Pacujá', 'Câmara Municipal de Paracuru',
  'Câmara Municipal de Pereiro', 'Câmara Municipal de Sobral', 'Câmara Municipal de Solonópole',
  'Câmara Municipal de Viçosa do Ceará', 'Companhia Docas do Ceará',
  'Departamento Estadual de Trânsito do Ceará', 'Fundação Cultural de Quixadá', 'Fungerhp',
  'Instituto de Pesos e Medidas do Ceará', 'Instituto de Pesquisa e Estratégia Econômica do Ceará',
  'Instituto Evolute', 'Instituto Elo Brasil', 'Instituto Municipal de Meio Ambiente',
  'Instituto de Previdência', 'Ipece', 'Ipem/CE', 'Tribunal Regional Eleitoral do Ceará',
  'Tribunal de Contas do Estado do Ceará', 'Tribunal Regional Federal',
  'Serviço Autônomo de Água e Esgoto', 'Instituto São Vicente',
];
const EMPRESAS = [
  '7Beneficios', 'Bras Go Mobilidade Ltda', 'Cariri Edificações, Serviços e Conduções Ltda',
  'Dom Incorporação Ltda', 'Forma Digital Assessoria e Consultoria em Gestão Empresarial Ltda',
  'Jaguaribe Petróleo Ltda', 'Locker Blindagem de Veículos Ltda',
  'LPM Saúde Humana e Serviços Sociais Ltda', 'M Franklin Castro Gondim Ltda',
];
const CLIENTES = [...MUNICIPIOS, ...INSTITUICOES, ...EMPRESAS];
const ALIASES_CLIENTES = { 'LPM Saúde Humana e Serviços Sociais Ltda': ['lpm'] };

function normalizarNome(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const CLIENTES_NORMALIZADOS = CLIENTES
  .map(nome => {
    const normalizado = normalizarNome(nome);
    const aliasCompacto = normalizado
      .split(' ')
      .filter(palavra => !['da', 'das', 'de', 'do', 'dos', 'e', 'epp', 'estadual', 'ltda', 'me', 'municipal', 'regional', 'sa'].includes(palavra))
      .join('');
    const aliases = (ALIASES_CLIENTES[nome] || []).map(normalizarNome);
    return { nome, normalizado, aliasCompacto, aliases };
  })
  .sort((a, b) => b.normalizado.replace(/\s/g, '').length - a.normalizado.replace(/\s/g, '').length);

function dataEmail(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function dataRelativaEmail(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  const hoje = new Date();
  const dataDia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diferenca = Math.round((hojeDia - dataDia) / 86_400_000);
  if (diferenca === 0) return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diferenca === 1) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(/\.$/, '') + '.';
}

function formatarAssunto(valor) {
  const assunto = String(valor || '').trim().toLocaleLowerCase('pt-BR');
  if (!assunto) return '(sem assunto)';
  const palavrasDeLigacao = new Set(['a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'para', 'por']);
  let primeiraPalavra = true;
  return assunto.replace(/[\p{L}\p{N}]+/gu, palavra => {
    if (!primeiraPalavra && palavrasDeLigacao.has(palavra)) return palavra;
    primeiraPalavra = false;
    return palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1);
  });
}

function termoPesquisaExato(valor) {
  return `"${String(valor).trim().replace(/["\\]/g, '\\$&')}"`;
}

function dataPesquisaGmail(valor) {
  const [ano, mes, dia] = valor.split('-').map(Number);
  return `${ano}/${String(mes).padStart(2, '0')}/${String(dia).padStart(2, '0')}`;
}

function montarConsultaPesquisa(termo, filtros) {
  const partes = [String(termo || '').trim()].filter(Boolean);
  if (filtros.cliente.trim()) partes.push(termoPesquisaExato(filtros.cliente));
  if (filtros.destinatario.trim()) partes.push(`to:${termoPesquisaExato(filtros.destinatario)}`);
  if (filtros.dataInicio) partes.push(`after:${dataPesquisaGmail(filtros.dataInicio)}`);
  if (filtros.dataFim) {
    const dataLimite = new Date(`${filtros.dataFim}T00:00:00Z`);
    dataLimite.setUTCDate(dataLimite.getUTCDate() + 1);
    partes.push(`before:${dataLimite.toISOString().slice(0, 10).replace(/-/g, '/')}`);
  }
  const termosNota = filtros.notaFiscalTermo.trim().split(/\s+/).filter(Boolean);
  if (filtros.notaFiscal || termosNota.length) {
    partes.push('{ "nota fiscal" "nota fiscal eletrônica" "NF-e" DANFE }');
    if (termosNota.length) partes.push(termosNota.map(termoPesquisaExato).join(' '));
  }
  return partes.join(' ');
}

function consultaComPasta(termos, pasta) {
  const consultaPasta = {
    recebidos: 'in:inbox',
    enviados: 'in:sent',
    ambos: '{in:inbox in:sent}',
  }[pasta] || '';
  const termosPesquisa = termos.trim();
  if (pasta === 'recebidos' && !termosPesquisa) return '';
  return [termosPesquisa, consultaPasta].filter(Boolean).join(' ');
}

function pastaDasMensagens(mensagens) {
  const possuiRecebidos = mensagens.some(mensagem => mensagem.labelIds?.includes('INBOX'));
  const possuiEnviados = mensagens.some(mensagem => mensagem.labelIds?.includes('SENT'));
  if (possuiRecebidos && possuiEnviados) return 'ambos';
  if (possuiEnviados) return 'enviados';
  if (possuiRecebidos) return 'recebidos';
  return '';
}

function tamanhoArquivo(bytes) {
  if (!bytes) return 'Tamanho indisponível';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`;
}

function dadosRemetente(from) {
  const valor = String(from || '').trim();
  const correspondencia = valor.match(/^(.*?)\s*<([^<>]+)>$/);
  const email = correspondencia ? correspondencia[2].trim() : valor;
  const nomeInformado = correspondencia?.[1].trim().replace(/^["']|["']$/g, '');
  const nome = nomeInformado || email.split('@')[0].replace(/[._-]+/g, ' ');
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0].toLocaleUpperCase('pt-BR'))
    .join('') || '?';
  return { nome, iniciais };
}

function clienteRemetente(from, nomeRemetente) {
  const texto = normalizarNome(`${from || ''} ${nomeRemetente || ''}`);
  const palavras = new Set(texto.split(' '));
  const compacto = texto.replace(/\s/g, '');
  const cliente = CLIENTES_NORMALIZADOS.find(({ normalizado, aliasCompacto, aliases }) => {
    if (normalizado.includes(' ')) {
      return ` ${texto} `.includes(` ${normalizado} `)
        || (normalizado.replace(/\s/g, '').length >= 6 && compacto.includes(normalizado.replace(/\s/g, '')))
        || (aliasCompacto.length >= 6 && compacto.includes(aliasCompacto))
        || aliases.some(alias => palavras.has(alias) || (alias.length >= 6 && compacto.includes(alias)));
    }
    return palavras.has(normalizado) || (normalizado.length >= 6 && compacto.includes(normalizado));
  });
  if (!cliente) return '';
  return cliente.nome
    .split(' ')
    .map((palavra, indice) => indice > 0 && ['da', 'das', 'de', 'do', 'dos'].includes(palavra.toLowerCase())
      ? palavra.toLowerCase()
      : palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1).toLocaleLowerCase('pt-BR'))
    .join(' ');
}

function iframeEmail(html, background, color) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none"><style>html,body{min-height:100%;background:${background}!important;color:${color}!important}body{margin:0;padding:24px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important;font-size:15px;line-height:1.75}body *{background-color:transparent!important;color:inherit!important;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif!important}p{margin:0 0 1em}a{color:${T.gold}!important;text-decoration:underline}img{max-width:100%;height:auto}blockquote{margin:1em 0;padding:.5em 1em;border-left:3px solid ${T.gold};background:${T.goldGl}!important;border-radius:0 10px 10px 0}</style></head><body>${html}</body></html>`;
}

function isIgnoredMessage(message) {
  return /mailsuite|mail[\s._-]*track/i.test(`${message.from || ''} ${message.subject || ''}`);
}

export default function Email({ onBack, authUser }) {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState(null);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [pasta, setPasta] = useState('recebidos');
  const [detectarPastaDaNota, setDetectarPastaDaNota] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ cliente: '', destinatario: '', dataInicio: '', dataFim: '', notaFiscal: false, notaFiscalTermo: '' });
  const [expandedAttachmentsFor, setExpandedAttachmentsFor] = useState('');
  const messageListRequest = useRef(0);
  const [nextPageToken, setNextPageToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [preview, setPreview] = useState(null);
  const buscaAutomaticaDaNota = detectarPastaDaNota && Boolean(filters.notaFiscalTermo.trim());
  const search = consultaComPasta(montarConsultaPesquisa(queryInput, filters), buscaAutomaticaDaNota ? 'ambos' : pasta);
  const intervaloInvalido = Boolean(filters.dataInicio && filters.dataFim && filters.dataInicio > filters.dataFim);

  const refreshStatus = useCallback(async () => {
    const current = await getStatus();
    setStatus(current);
    return current;
  }, []);

  const loadMessages = useCallback(async (search = '', pageToken = '', append = false, detectFolder = false) => {
    const requestId = ++messageListRequest.current;
    setLoading(true);
    setError('');
    try {
      const result = await listMessages(search, pageToken);
      if (requestId !== messageListRequest.current) return;
      const visibleMessages = result.messages.filter(message => !isIgnoredMessage(message));
      setMessages(previous => append ? [...previous, ...visibleMessages] : visibleMessages);
      setNextPageToken(result.nextPageToken || '');
      if (detectFolder) {
        const pastaEncontrada = pastaDasMensagens(visibleMessages);
        if (pastaEncontrada) setPasta(pastaEncontrada);
      }
      if (!append) {
        setSelectedId('');
        setMessage(null);
        setLoadingMessage(false);
      }
    } catch (e) {
      if (requestId === messageListRequest.current) {
        setError(e.message);
        if (!append) setLoadingMessage(false);
      }
    } finally {
      if (requestId === messageListRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getStatus()
      .then(current => {
        if (!active) return;
        setStatus(current);
        if (current.connected) return loadMessages('');
        setLoading(false);
      })
      .catch(e => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [loadMessages]);

  useEffect(() => {
    if (!selectedId) {
      return undefined;
    }
    let active = true;
    getMessage(selectedId)
      .then(data => { if (active) setMessage(data); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoadingMessage(false); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!status?.connected) return undefined;
    if (intervaloInvalido) return undefined;
    if (search === query) return undefined;
    const timeout = window.setTimeout(() => {
      setQuery(search);
      loadMessages(search, '', false, buscaAutomaticaDaNota);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [buscaAutomaticaDaNota, intervaloInvalido, loadMessages, query, search, status?.connected]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const connect = async () => {
    const popup = window.open('about:blank', 'uniko-gmail-oauth', 'popup,width=620,height=760');
    if (!popup) {
      setError('O navegador bloqueou a janela de conexão. Permita pop-ups para o Uniko e tente novamente.');
      return;
    }
    setConnecting(true);
    setError('');
    let redirected = false;
    try {
      const { url } = await startOAuth();
      popup.location.href = url;
      redirected = true;
      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const current = await refreshStatus();
        if (current.connected) {
          setQuery('');
          setQueryInput('');
          await loadMessages('');
          return;
        }
      }
      throw new Error('A conexão não foi concluída. Tente novamente e confirme a conta Google.');
    } catch (e) {
      if (!redirected) popup.close();
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const runSearch = async (event) => {
    event?.preventDefault();
    if (intervaloInvalido) return;
    setQuery(search);
    await loadMessages(search, '', false, buscaAutomaticaDaNota);
  };

  const selectMessage = id => {
    if (id === selectedId) return;
    setSelectedId(id);
    setMessage(null);
    setLoadingMessage(true);
    setError('');
  };

  const handleDownload = async attachment => {
    setDownloading(attachment.id);
    setError('');
    try {
      await downloadAttachment(selectedId, attachment);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading('');
    }
  };

  const handlePreview = async attachment => {
    setDownloading(attachment.id);
    setError('');
    try {
      const { blob, filename } = await getAttachment(selectedId, attachment);
      const ext = filename.split('.').pop()?.toLowerCase();
      const isPdf = blob.type === 'application/pdf' || ext === 'pdf';
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'].includes(blob.type)
        || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
      if (!isPdf && !isImage) throw new Error('Este tipo de anexo não pode ser visualizado aqui. Use Baixar anexo.');
      const previewBlob = isPdf && blob.type !== 'application/pdf'
        ? new Blob([blob], { type: 'application/pdf' })
        : blob;
      setPreview({ url: URL.createObjectURL(previewBlob), filename, isPdf });
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading('');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Desconectar esta conta Gmail do seu usuário?')) return;
    setError('');
    try {
      await disconnect();
      setStatus(current => ({ ...current, connected: false, email: '' }));
      setMessages([]);
      setSelectedId('');
      setMessage(null);
      setLoadingMessage(false);
    } catch (e) {
      setError(e.message);
    }
  };

  if (authUser?.role !== 'admin') {
    return <div style={{ padding: 32, color: T.text }}>Este módulo está disponível apenas para administradores.</div>;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T.page, color: T.text, fontFamily: 'var(--font-body)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.topbarBg || T.surface }}>
        <button onClick={onBack} style={{ ...buttonStyle, border: 'none', background: 'transparent' }}>‹ Módulos</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 19 }}>
          <span style={{ color: T.gold }}>✉</span> E-mail
        </div>
        {status?.connected && (
          <div style={{ ...muted, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{status.email}</span>
            <button onClick={handleDisconnect} style={buttonStyle}>Desconectar</button>
          </div>
        )}
      </header>

      <main style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
        {!status && loading ? <div style={muted}>Verificando conexão…</div> : null}
        {error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 9, background: T.dangerGl || '#FDECEC', color: T.danger || '#B42318', fontSize: 13 }}>{error}</div>}

        {status && !status.connected && (
          <section style={{ maxWidth: 620, margin: 'auto', padding: 28, borderRadius: 18, border: `1px solid ${T.border}`, background: T.surface, textAlign: 'center', boxShadow: '0 12px 36px rgba(0,0,0,.08)' }}>
            <div style={{ color: T.gold, fontSize: 42, marginBottom: 8 }}>✉</div>
            <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 24, margin: '0 0 10px' }}>Sua caixa de entrada no Uniko</h1>
            <p style={{ ...muted, lineHeight: 1.7, margin: '0 0 20px' }}>
              Conecte sua conta Gmail para pesquisar e consultar mensagens e anexos. O conteúdo continua no Gmail e não é copiado para o Uniko.
            </p>
            <button onClick={connect} disabled={connecting || status.configured === false} style={{ ...buttonStyle, border: 'none', background: T.gold, color: '#fff', padding: '11px 20px', opacity: connecting || status.configured === false ? .65 : 1 }}>
              {connecting ? 'Conectando…' : 'Conectar conta Google'}
            </button>
            {status.configured === false && <p style={{ ...muted, margin: '14px 0 0' }}>A integração ainda precisa ser configurada no servidor.</p>}
            <p style={{ ...muted, fontSize: 12, margin: '16px 0 0' }}>A autorização solicita somente leitura do Gmail. Cada administrador conecta sua própria conta.</p>
          </section>
        )}

        {status?.connected && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <form onSubmit={runSearch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={queryInput}
                  onChange={event => setQueryInput(event.target.value)}
                  placeholder="Pesquisar nota fiscal, cliente, prefeitura, refaturamento, ofício..."
                  aria-label="Pesquisar mensagens no Gmail"
                  style={{ flex: '1 1 260px', minWidth: 0, padding: '10px 13px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '14px var(--font-body)', outline: 'none' }}
                />
                <button type="submit" disabled={loading || intervaloInvalido} style={{ ...buttonStyle, background: T.gold, color: '#fff', border: 'none', opacity: intervaloInvalido ? .6 : 1 }}>
                  {loading ? 'Pesquisando…' : 'Pesquisar'}
                </button>
                <button type="button" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen} style={buttonStyle}>
                  {filtersOpen ? 'Ocultar filtros' : 'Adicionar filtros'}
                  {Object.values(filters).filter(Boolean).length > 0 && (
                    <span style={{ marginLeft: 7, padding: '2px 6px', borderRadius: 999, background: T.goldGl || `${T.gold}25`, color: T.gold, fontSize: 11 }}>
                      {Object.values(filters).filter(Boolean).length}
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => loadMessages(query)} disabled={loading} style={buttonStyle}>Atualizar</button>
              </form>
              {filtersOpen && (
                <section aria-label="Filtros de pesquisa" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 12, padding: 14, border: `1px solid ${T.border}`, borderRadius: 14, background: `linear-gradient(145deg, ${T.surface}, ${T.page})`, boxShadow: '0 8px 22px rgba(0,0,0,.1)' }}>
                  <label style={{ display: 'grid', gap: 5, color: T.text, fontSize: 12, fontWeight: 700 }}>
                    Cliente
                    <input
                      list="email-client-filter-options"
                      value={filters.cliente}
                      onChange={event => setFilters(current => ({ ...current, cliente: event.target.value }))}
                      placeholder="Nome do cliente"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '13px var(--font-body)' }}
                    />
                    <datalist id="email-client-filter-options">
                      {CLIENTES.map(cliente => <option key={cliente} value={cliente} />)}
                    </datalist>
                  </label>
                  <label style={{ display: 'grid', gap: 5, color: T.text, fontSize: 12, fontWeight: 700 }}>
                    Destinatário
                    <input
                      type="text"
                      value={filters.destinatario}
                      onChange={event => setFilters(current => ({ ...current, destinatario: event.target.value }))}
                      placeholder="E-mail ou nome"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '13px var(--font-body)' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 5, color: T.text, fontSize: 12, fontWeight: 700 }}>
                    Data inicial
                    <input
                      type="date"
                      value={filters.dataInicio}
                      max={filters.dataFim || undefined}
                      onChange={event => setFilters(current => ({ ...current, dataInicio: event.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '13px var(--font-body)' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 5, color: T.text, fontSize: 12, fontWeight: 700 }}>
                    Data final
                    <input
                      type="date"
                      value={filters.dataFim}
                      min={filters.dataInicio || undefined}
                      onChange={event => setFilters(current => ({ ...current, dataFim: event.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '13px var(--font-body)' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: T.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filters.notaFiscal}
                      onChange={event => setFilters(current => ({ ...current, notaFiscal: event.target.checked }))}
                      style={{ accentColor: T.gold, width: 16, height: 16 }}
                    />
                    Somente notas fiscais / NF-e
                  </label>
                  <label style={{ display: 'grid', gap: 5, color: T.text, fontSize: 12, fontWeight: 700 }}>
                    Número da nota ou município
                    <input
                      type="text"
                      value={filters.notaFiscalTermo}
                      onChange={event => {
                        const notaFiscalTermo = event.target.value;
                        setFilters(current => ({ ...current, notaFiscalTermo }));
                        setDetectarPastaDaNota(Boolean(notaFiscalTermo.trim()));
                      }}
                      placeholder="Ex.: 58989 Ipu"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '13px var(--font-body)' }}
                    />
                  </label>
                  <button type="button" onClick={() => {
                    setFilters({ cliente: '', destinatario: '', dataInicio: '', dataFim: '', notaFiscal: false, notaFiscalTermo: '' });
                    setDetectarPastaDaNota(false);
                  }} style={{ ...buttonStyle, justifySelf: 'start' }}>
                    Limpar filtros
                  </button>
                  {intervaloInvalido && (
                    <div role="alert" style={{ gridColumn: '1 / -1', color: T.danger || '#B42318', fontSize: 12 }}>
                      A data inicial não pode ser posterior à data final.
                    </div>
                  )}
                </section>
              )}
            </div>
            <div style={{ ...muted, fontSize: 12 }}>
              A pesquisa é feita automaticamente após você parar de digitar ou ajustar os filtros. Respostas e notificações do Mailsuite/Mailtrack são ocultadas.
            </div>

            <div className="email-grid" style={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(260px, 34%) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)', border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden', background: `linear-gradient(145deg, ${T.surface}, ${T.page})`, boxShadow: '0 18px 48px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.12)', backdropFilter: 'blur(24px) saturate(150%)' }}>
              <section aria-label="Lista de mensagens" style={{ minHeight: 0, overflowY: 'auto', borderRight: `1px solid ${T.border}`, background: T.sidebarBg || T.surface, backdropFilter: 'blur(22px) saturate(150%)' }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${T.border}`, background: `${T.surface}ee`, backdropFilter: 'blur(18px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    <h2 style={{ margin: 0, color: T.text, fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800 }}>Caixa de Entrada</h2>
                  </div>
                  <div role="group" aria-label="Filtrar por pasta" style={{ display: 'flex', gap: 3, padding: 3, border: `1px solid ${T.border}`, borderRadius: 10, background: T.page }}>
                    {[
                      ['recebidos', 'Recebidos'],
                      ['enviados', 'Enviados'],
                      ['ambos', 'Ambos'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={pasta === value}
                        onClick={() => {
                          setDetectarPastaDaNota(false);
                          setPasta(value);
                        }}
                        style={{
                          border: 'none',
                          borderRadius: 7,
                          padding: '6px 8px',
                          background: pasta === value ? (T.goldGl || `${T.gold}28`) : 'transparent',
                          color: pasta === value ? T.gold : T.textS,
                          cursor: 'pointer',
                          font: '700 11px var(--font-body)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {loading && !messages.length ? <div style={{ padding: 18, ...muted }}>Carregando mensagens…</div>
                  : !messages.length ? <div style={{ padding: 18, ...muted }}>Nenhuma mensagem encontrada.</div>
                    : messages.map(item => {
                      const remetente = dadosRemetente(item.from);
                      const cliente = clienteRemetente(item.from, remetente.nome);
                      const selecionado = selectedId === item.id;
                      return (
                        <button className="email-message-row" key={item.id} onClick={() => selectMessage(item.id)} style={{
                          position: 'relative', display: 'block', width: '100%', minHeight: 83, padding: '13px 15px 11px 18px', border: 'none', borderBottom: `1px solid ${T.border}`,
                          borderLeft: selecionado ? `4px solid ${T.gold}` : '4px solid transparent',
                          background: selecionado ? `linear-gradient(100deg, ${T.goldGl || `${T.gold}28`}, transparent 88%), ${T.surface}` : 'transparent', color: T.text, textAlign: 'left', cursor: 'pointer', transition: 'background .18s ease, box-shadow .18s ease',
                          boxShadow: selecionado ? 'inset 0 1px 0 rgba(255,255,255,.12), 0 6px 20px rgba(0,0,0,.10)' : 'none',
                        }} title={formatarAssunto(item.subject)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span aria-hidden="true" style={{ flex: '0 0 36px', width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: '50%', background: `linear-gradient(145deg, ${T.goldGl || `${T.gold}30`}, ${T.surface}99)`, color: T.gold, fontSize: 13, fontWeight: 800, boxShadow: `0 4px 14px ${T.goldGl || `${T.gold}30`}, inset 0 1px 0 rgba(255,255,255,.26)` }}>
                              {remetente.iniciais}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 750, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                                  {formatarAssunto(item.subject)}
                                </div>
                                <time title={dataEmail(item.date)} style={{ flex: '0 0 auto', padding: '3px 7px', borderRadius: 999, background: selecionado ? (T.goldGl || `${T.gold}22`) : `${T.surface}55`, color: selecionado ? T.gold : T.textS, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {dataRelativaEmail(item.date)}
                                </time>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, marginTop: 5 }}>
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.textS, fontSize: 11, fontWeight: 600 }}>
                                  {remetente.nome}
                                </span>
                                {cliente && (
                                  <span style={{ flex: '0 0 auto', maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 999, background: T.goldGl || `${T.gold}18`, color: T.gold, fontSize: 10, fontWeight: 750, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16)' }}>
                                    {cliente}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                {nextPageToken && <button onClick={() => loadMessages(query, nextPageToken, true)} disabled={loading} style={{ ...buttonStyle, display: 'block', margin: 12 }}>Carregar mais</button>}
              </section>

              <section aria-label="Mensagem selecionada" style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: `linear-gradient(155deg, ${T.page}80, ${T.surface}55)` }}>
                {loadingMessage ? <div style={{ padding: 20, ...muted }}>Abrindo mensagem…</div>
                  : !message ? <div style={{ margin: 'auto', padding: 20, ...muted }}>Selecione uma mensagem para ler.</div>
                    : (
                    <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ position: 'relative', flex: '0 0 auto', padding: '22px 24px 18px', borderBottom: `1px solid ${T.border}`, background: `linear-gradient(125deg, ${T.goldGl || `${T.gold}12`}, transparent 68%), ${T.surface}55`, boxShadow: '0 8px 24px rgba(0,0,0,.08)', backdropFilter: 'blur(18px)' }}>
                          <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 4, background: `linear-gradient(180deg, ${T.goldL || T.gold}, ${T.gold}40)` }} />
                          <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: 21, lineHeight: 1.35, fontWeight: 800, margin: '0 0 17px', overflowWrap: 'anywhere' }}>{message.subject || '(sem assunto)'}</h2>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 9 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 12, background: `${T.surface}88`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
                              <span aria-hidden="true" style={{ flex: '0 0 34px', width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: T.goldGl || `${T.gold}22`, color: T.gold, fontSize: 11, fontWeight: 800 }}>
                                {dadosRemetente(message.from).iniciais}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: T.textT, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>De</div>
                                <div title={message.from} style={{ color: T.text, fontSize: 12, fontWeight: 650, overflowWrap: 'anywhere' }}>{message.from || 'Remetente não informado'}</div>
                              </div>
                            </div>
                            <div style={{ minWidth: 0, padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 12, background: `${T.surface}88`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
                              <div style={{ color: T.textT, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Para</div>
                              <div title={message.to} style={{ marginTop: 4, color: T.text, fontSize: 12, lineHeight: 1.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{message.to || 'Destinatário não informado'}</div>
                            </div>
                            {message.cc && (
                              <div style={{ minWidth: 0, padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 12, background: `${T.surface}88`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
                                <div style={{ color: T.textT, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Cc</div>
                                <div title={message.cc} style={{ marginTop: 4, color: T.text, fontSize: 12, lineHeight: 1.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{message.cc}</div>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 12, background: `${T.surface}88`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>
                              <span aria-hidden="true" style={{ fontSize: 18 }}>◷</span>
                              <div>
                                <div style={{ color: T.textT, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Recebido</div>
                                <time title={dataEmail(message.date)} style={{ color: T.text, fontSize: 12, fontWeight: 650 }}>{dataEmail(message.date)}</time>
                              </div>
                            </div>
                          </div>
                        </div>
                        {message.attachments?.length > 0 && (
                          <section aria-label="Anexos da mensagem" style={{ flex: '0 0 auto', padding: '15px 20px 17px', borderBottom: `1px solid ${T.border}`, background: `${T.surface}50`, backdropFilter: 'blur(14px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 13, fontWeight: 800 }}>
                                <span aria-hidden="true" style={{ color: T.gold, fontSize: 16 }}>▤</span>
                                Anexos <span style={{ ...muted, fontWeight: 500 }}>({message.attachments.length})</span>
                              </h3>
                              {message.attachments.length > 3 && (
                                <button
                                  type="button"
                                  aria-expanded={expandedAttachmentsFor === selectedId}
                                  onClick={() => setExpandedAttachmentsFor(current => current === selectedId ? '' : selectedId)}
                                  style={{ ...buttonStyle, flex: '0 0 auto', padding: '6px 10px', color: T.gold, fontSize: 12 }}
                                >
                                  {expandedAttachmentsFor === selectedId
                                    ? 'Recolher anexos'
                                    : `+${message.attachments.length - 3} visualizar ${message.attachments.length - 3 === 1 ? 'anexo' : 'anexos'}`}
                                </button>
                              )}
                            </div>
                            <div className="email-attachments-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
                              {(expandedAttachmentsFor === selectedId ? message.attachments : message.attachments.slice(0, 3))
                                .map(attachment => {
                                const extension = attachment.filename.split('.').pop()?.toLowerCase();
                                const previewable = attachment.mimeType === 'application/pdf'
                                  || ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'].includes(attachment.mimeType)
                                  || ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
                                return (
                                  <article key={attachment.id} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 12, border: `1px solid ${T.border}`, borderRadius: 14, background: `linear-gradient(145deg, ${T.surface}, ${T.page}90)`, boxShadow: '0 8px 22px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.14)', backdropFilter: 'blur(14px)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      <span aria-hidden="true" style={{ flex: '0 0 38px', width: 38, height: 42, display: 'grid', placeItems: 'center', borderRadius: 9, background: T.goldGl || `${T.gold}18`, color: T.gold, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>
                                        {extension || 'file'}
                                      </span>
                                      <div style={{ minWidth: 0 }}>
                                        <div title={attachment.filename} style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                          {attachment.filename}
                                        </div>
                                        <div style={{ ...muted, marginTop: 3, fontSize: 11 }}>{tamanhoArquivo(attachment.size)}</div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                      {previewable && (
                                        <button onClick={() => handlePreview(attachment)} disabled={downloading === attachment.id} style={{ ...buttonStyle, flex: 1, color: T.gold }}>
                                          {downloading === attachment.id ? 'Carregando…' : 'Visualizar'}
                                        </button>
                                      )}
                                      <button onClick={() => handleDownload(attachment)} disabled={downloading === attachment.id} style={{ ...buttonStyle, flex: 1 }}>
                                        Baixar
                                      </button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </section>
                        )}
                        <div style={{ flex: '1 0 320px', minHeight: 320, overflow: 'auto', padding: 18, background: `radial-gradient(ellipse at 12% 0%, ${T.goldGl || `${T.gold}12`}, transparent 55%), ${T.page}55` }}>
                          {message.bodyHtml
                            ? <iframe title="Conteúdo da mensagem" sandbox="" srcDoc={iframeEmail(message.bodyHtml, T.surface, T.text)} style={{ display: 'block', width: '100%', minHeight: '100%', height: '100%', border: `1px solid ${T.border}`, borderRadius: 16, background: T.surface, boxShadow: '0 16px 38px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.18)' }} />
                            : <pre style={{ minHeight: 240, margin: 0, padding: 24, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', border: `1px solid ${T.border}`, borderRadius: 16, background: `linear-gradient(145deg, ${T.surface}, ${T.page})`, boxShadow: '0 16px 38px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.18)', font: '15px/1.8 var(--font-body)' }}>{message.bodyText || message.snippet || 'Esta mensagem não possui conteúdo textual.'}</pre>}
                        </div>
                      </div>
                    )}
              </section>
            </div>
          </>
        )}
      </main>
      {preview && (
        <div role="presentation" onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(0,0,0,.72)' }}>
          <section role="dialog" aria-modal="true" aria-label={`Anexo ${preview.filename}`} onClick={event => event.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', width: 'min(1100px, 96vw)', height: 'min(900px, 92vh)', background: T.surface, color: T.text, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 70px rgba(0,0,0,.4)' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
              <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.filename}</strong>
              <button onClick={() => setPreview(null)} aria-label="Fechar visualização" style={buttonStyle}>Fechar</button>
            </header>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 12 }}>
              {preview.isPdf
                ? <iframe title={`Visualização de ${preview.filename}`} src={preview.url} style={{ width: '100%', height: '100%', minHeight: 400, border: 0, background: '#fff' }} />
                : <img src={preview.url} alt={preview.filename} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
            </div>
          </section>
        </div>
      )}
      <style>{`.email-message-row:hover{background:${T.goldGl || `${T.gold}18`} !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 18px rgba(0,0,0,.08)}@media(max-width:720px){.email-grid{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(170px,36%) minmax(0,1fr)}.email-grid>section:first-child{border-right:none!important;border-bottom:1px solid ${T.border}}}`}</style>
    </div>
  );
}
