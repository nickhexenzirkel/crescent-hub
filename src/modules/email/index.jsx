import { useCallback, useEffect, useMemo, useState } from 'react';
import { T } from '../../contexts/theme';
import { disconnect, downloadAttachment, getMessage, getStatus, listMessages, startOAuth } from './api';

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

function dataEmail(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function iframeEmail(html) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"></head><body>${html}</body></html>`;
}

export default function Email({ onBack, authUser }) {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState(null);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [detailVersion, setDetailVersion] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const refreshStatus = useCallback(async () => {
    const current = await getStatus();
    setStatus(current);
    return current;
  }, []);

  const loadMessages = useCallback(async (search = '', pageToken = '', append = false) => {
    setLoading(true);
    setError('');
    try {
      const result = await listMessages(search, pageToken);
      setMessages(previous => append ? [...previous, ...result.messages] : result.messages);
      setNextPageToken(result.nextPageToken || '');
      if (!append) {
        setSelectedId(result.messages[0]?.id || '');
        setMessage(null);
        setLoadingMessage(Boolean(result.messages[0]));
        setDetailVersion(version => version + 1);
      }
    } catch (e) {
      setError(e.message);
      if (!append) setLoadingMessage(false);
    } finally {
      setLoading(false);
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
  }, [selectedId, detailVersion]);

  const bodySrc = useMemo(() => message?.bodyHtml ? iframeEmail(message.bodyHtml) : '', [message]);

  const connect = async () => {
    const popup = window.open('about:blank', 'uniko-gmail-oauth', 'popup,width=620,height=760');
    if (!popup) {
      setError('O navegador bloqueou a janela de conexão. Permita pop-ups para o Uniko e tente novamente.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const { url } = await startOAuth();
      popup.location.href = url;
      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const current = await refreshStatus();
        if (current.connected) {
          if (!popup.closed) popup.close();
          setQuery('');
          setQueryInput('');
          await loadMessages('');
          return;
        }
        if (popup.closed) {
          throw new Error('A conexão foi fechada antes de ser concluída. Tente novamente e confirme a conta Google.');
        }
      }
      if (!popup.closed) popup.close();
      throw new Error('A conexão não foi concluída. Tente novamente e confirme a conta Google.');
    } catch (e) {
      if (!popup.closed) popup.close();
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const runSearch = async (event) => {
    event?.preventDefault();
    const search = queryInput.trim();
    setQuery(search);
    await loadMessages(search);
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
      await downloadAttachment(selectedId, attachment.id);
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
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: T.page, color: T.text, fontFamily: 'var(--font-body)' }}>
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

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
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
            <form onSubmit={runSearch} style={{ display: 'flex', gap: 8 }}>
              <input
                value={queryInput}
                onChange={event => setQueryInput(event.target.value)}
                placeholder="Pesquisar no Gmail: nota fiscal, from:, has:attachment…"
                aria-label="Pesquisar mensagens no Gmail"
                style={{ flex: 1, minWidth: 0, padding: '10px 13px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, font: '14px var(--font-body)', outline: 'none' }}
              />
              <button type="submit" disabled={loading} style={{ ...buttonStyle, background: T.gold, color: '#fff', border: 'none' }}>Pesquisar</button>
              <button type="button" onClick={() => loadMessages(query)} disabled={loading} style={buttonStyle}>Atualizar</button>
            </form>

            <div className="email-grid" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(260px, 34%) minmax(0, 1fr)', border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', background: T.surface }}>
              <section aria-label="Lista de mensagens" style={{ minHeight: 0, overflowY: 'auto', borderRight: `1px solid ${T.border}` }}>
                {loading && !messages.length ? <div style={{ padding: 18, ...muted }}>Carregando mensagens…</div>
                  : !messages.length ? <div style={{ padding: 18, ...muted }}>Nenhuma mensagem encontrada.</div>
                    : messages.map(item => (
                      <button key={item.id} onClick={() => selectMessage(item.id)} style={{
                        display: 'block', width: '100%', padding: '13px 15px', border: 'none', borderBottom: `1px solid ${T.border}`,
                        borderLeft: selectedId === item.id ? `3px solid ${T.gold}` : '3px solid transparent',
                        background: selectedId === item.id ? (T.goldGl || `${T.gold}18`) : 'transparent', color: T.text, textAlign: 'left', cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.from || 'Remetente desconhecido'}</strong>
                          <span style={{ ...muted, fontSize: 11, whiteSpace: 'nowrap' }}>{dataEmail(item.date)}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{item.subject || '(sem assunto)'}</div>
                        <div style={{ ...muted, fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.snippet}</div>
                      </button>
                    ))}
                {nextPageToken && <button onClick={() => loadMessages(query, nextPageToken, true)} disabled={loading} style={{ ...buttonStyle, display: 'block', margin: 12 }}>Carregar mais</button>}
              </section>

              <section aria-label="Mensagem selecionada" style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {loadingMessage ? <div style={{ padding: 20, ...muted }}>Abrindo mensagem…</div>
                  : !message ? <div style={{ margin: 'auto', padding: 20, ...muted }}>Selecione uma mensagem para ler.</div>
                    : (
                      <>
                        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}` }}>
                          <h2 style={{ fontSize: 20, margin: '0 0 12px', overflowWrap: 'anywhere' }}>{message.subject || '(sem assunto)'}</h2>
                          <div style={{ ...muted, lineHeight: 1.7, overflowWrap: 'anywhere' }}>
                            <div><strong>De:</strong> {message.from || '—'}</div>
                            <div><strong>Para:</strong> {message.to || '—'}</div>
                            {message.cc && <div><strong>Cc:</strong> {message.cc}</div>}
                            <div><strong>Data:</strong> {dataEmail(message.date)}</div>
                          </div>
                          {message.attachments?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                              {message.attachments.map(attachment => (
                                <button key={attachment.id} onClick={() => handleDownload(attachment)} disabled={downloading === attachment.id} style={{ ...buttonStyle, color: T.gold, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                                  {downloading === attachment.id ? 'Baixando…' : `↓ ${attachment.filename} (${Math.ceil((attachment.size || 0) / 1024)} KB)`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
                          {message.bodyHtml
                            ? <iframe title="Conteúdo da mensagem" sandbox="" srcDoc={bodySrc} style={{ width: '100%', minHeight: 480, height: '100%', border: `1px solid ${T.border}`, borderRadius: 8, background: '#fff' }} />
                            : <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: '14px/1.65 var(--font-body)' }}>{message.bodyText || message.snippet || 'Esta mensagem não possui conteúdo textual.'}</pre>}
                        </div>
                      </>
                    )}
              </section>
            </div>
          </>
        )}
      </main>
      <style>{`@media(max-width:720px){.email-grid{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(150px,34%) minmax(0,1fr)}.email-grid>section:first-child{border-right:none!important;border-bottom:1px solid ${T.border}}}`}</style>
    </div>
  );
}
