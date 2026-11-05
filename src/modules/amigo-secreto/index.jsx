import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../contexts/theme';
import { useIsMobile } from '../../hooks/useIsMobile';
import marcaSete from '../../assets/logo-7beneficios.png';
import { carregarAmigoSecreto, publicarAmigoSecreto } from './api';
import { lerPlanilhaAmigoSecreto } from './planilha';
import { gerarPdfAmigoSecreto } from './pdf';

const normalizar = (valor) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

const IconePresente = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 1 1 2.4-3.2L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 7Z" />
  </svg>
);

const Icone = ({ tipo }) => {
  const paths = {
    estrela: <><path d="m12 3 2.5 5.2 5.7.8-4.1 4 .97 5.7L12 16l-5.07 2.7.97-5.7-4.1-4 5.7-.8L12 3Z" /></>,
    coracao: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></>,
    roupa: <><path d="m16 3 5 4-3 4-2-1v11H8V10L6 11 3 7l5-4 2 2h4l2-2Z" /></>,
    calcado: <><path d="M3 16c2.5 0 4.5-.8 6-2l3 2c2 1.3 4.2 2 8 2a1 1 0 0 1 1 1v2H3v-5Z" /><path d="m9 14 2-5 3 2 2 4M6 18h.01M10 18h.01M14 18h.01" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[tipo]}
    </svg>
  );
};

const coluna = { padding: '15px 16px', verticalAlign: 'top', borderBottom: `1px solid ${T.border}` };
const valorVazio = (valor) => valor?.trim() || '—';

export default function AmigoSecreto({ onBack, authUser }) {
  const isMobile = useIsMobile();
  const isAdmin = authUser?.role === 'admin';
  const fileRef = useRef(null);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState(null);

  const buscarDados = useCallback(() => carregarAmigoSecreto(), []);
  const atualizar = useCallback(async () => {
    try {
      const lista = await buscarDados();
      setDados(lista);
      setErro('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [buscarDados]);

  useEffect(() => {
    let ativa = true;
    buscarDados()
      .then((lista) => {
        if (ativa) {
          setDados(lista);
          setErro('');
        }
      })
      .catch((e) => {
        if (ativa) setErro(e.message);
      })
      .finally(() => {
        if (ativa) setCarregando(false);
      });
    return () => { ativa = false; };
  }, [buscarDados]);

  const participantes = useMemo(() => dados?.participantes || [], [dados]);
  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return participantes;
    return participantes.filter((p) => [p.nome, p.presente, p.gostos, p.cores, p.roupa, p.calcado]
      .some((v) => normalizar(v).includes(termo)));
  }, [busca, participantes]);

  const selecionarPlanilha = async (arquivo) => {
    if (!arquivo) return;
    setErro('');
    setRascunho(null);
    try {
      const lista = await lerPlanilhaAmigoSecreto(arquivo);
      setRascunho(lista);
    } catch (e) {
      setErro(`Não foi possível ler a planilha: ${e.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const publicar = async () => {
    if (!rascunho?.length || !isAdmin) return;
    if (!window.confirm(`Publicar ${rascunho.length} participantes? A lista atual será substituída para todos.`)) return;
    setSalvando(true);
    setErro('');
    try {
      setDados(await publicarAmigoSecreto(rascunho));
      setRascunho(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const recarregar = () => {
    setCarregando(true);
    setErro('');
    void atualizar();
  };

  const exportarPdf = async () => {
    if (!filtrados.length || exportando) return;
    setExportando(true);
    setErro('');
    try {
      const bytes = await gerarPdfAmigoSecreto(filtrados, marcaSete);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'amigo-secreto-2026.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErro(`Não foi possível gerar o PDF: ${e.message}`);
    } finally {
      setExportando(false);
    }
  };

  const tagTemporaria = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
    borderRadius: 999, color: T.gold || T.blue, background: T.goldGl || T.blueGl,
    border: `1px solid ${T.gold || T.blue}33`, fontSize: 11, fontWeight: 800,
    letterSpacing: '.08em', textTransform: 'uppercase',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: T.page, color: T.text, fontFamily: 'var(--font-body)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 14, minHeight: 66, padding: '10px 24px',
        background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px',
          borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface,
          color: T.textS, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 650,
        }}>
          <span aria-hidden="true">‹</span> Módulos
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <img src={marcaSete} alt="" style={{ width: 30, height: 34, objectFit: 'contain' }} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.06em', color: T.text }}>7 BENEFÍCIOS</span>
        </div>
        <span style={{ marginLeft: 'auto', ...tagTemporaria }}>Temporário</span>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '18px 12px 32px' : '28px 24px 44px' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <section style={{
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            padding: isMobile ? '22px 18px' : '30px 34px', marginBottom: 22,
            borderRadius: 24, border: `1px solid ${T.border}`,
            background: `linear-gradient(125deg, ${T.blueGl || T.surface} 0%, ${T.surface} 68%)`,
            boxShadow: `0 14px 36px ${T.blue || T.gold}18`,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, display: 'grid', placeItems: 'center',
              color: T.blue || T.gold, background: T.blueGl || T.goldGl, boxShadow: `0 9px 20px ${T.blue || T.gold}22`,
              flexShrink: 0,
            }}>
              <IconePresente size={34} />
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <span style={tagTemporaria}>Evento 2026</span>
              <h1 style={{ marginTop: 10, fontFamily: 'var(--font-brand)', fontSize: isMobile ? 28 : 38, lineHeight: 1.12, fontWeight: 850, color: T.text }}>
                Amigo Secreto
              </h1>
              <p style={{ marginTop: 8, maxWidth: 740, color: T.textS, fontSize: 14, lineHeight: 1.55 }}>
                Consulte as sugestões de presentes, gostos e tamanhos informados pelos participantes.
              </p>
            </div>
            <div style={{
              padding: '12px 18px', borderRadius: 16, background: T.surface,
              border: `1px solid ${T.border}`, textAlign: 'center', minWidth: 112,
            }}>
              <div style={{ fontSize: 24, fontWeight: 850, color: T.blue || T.gold }}>{participantes.length}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textT, textTransform: 'uppercase', letterSpacing: '.08em' }}>participantes</div>
            </div>
          </section>

          {isAdmin && (
            <section style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18,
              padding: '14px 16px', borderRadius: 16, background: T.surface, border: `1px solid ${T.border}`,
            }}>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => selecionarPlanilha(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={salvando} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${T.blue || T.gold}`,
                borderRadius: 11, padding: '11px 16px', background: T.blueGl || T.goldGl,
                color: T.blue || T.gold, fontSize: 13, fontWeight: 750, cursor: salvando ? 'wait' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}>
                <IconePresente size={17} /> Carregar planilha (.xlsx)
              </button>
              {rascunho && (
                <>
                  <span style={{ flex: '1 1 190px', fontSize: 13, color: T.textS }}>
                    Prévia pronta: <b>{rascunho.length} participantes</b> — {rascunho.slice(0, 3).map((p) => p.nome).join(' · ')}{rascunho.length > 3 ? '…' : ''}. Ao publicar, a lista anterior será substituída.
                  </span>
                  <button onClick={publicar} disabled={salvando} style={{
                    border: `1px solid ${T.blue || T.gold}`, borderRadius: 10, padding: '10px 15px',
                    background: T.blueGl || T.goldGl, color: T.blue || T.gold, fontWeight: 750,
                    cursor: salvando ? 'wait' : 'pointer', fontFamily: 'var(--font-body)',
                  }}>{salvando ? 'Publicando…' : 'Publicar para todos'}</button>
                  <button onClick={() => setRascunho(null)} disabled={salvando} style={{
                    border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px',
                    background: 'transparent', color: T.textS, fontWeight: 650, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}>Cancelar</button>
                </>
              )}
              {dados?.atualizado_em && !rascunho && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: T.textT }}>
                  Atualizada em {new Date(dados.atualizado_em).toLocaleString('pt-BR')}
                </span>
              )}
            </section>
          )}

          {erro && (
            <div role="alert" style={{
              marginBottom: 16, padding: '12px 15px', borderRadius: 12,
              color: T.danger, background: T.dangerGl,
              border: `1px solid ${T.danger}40`, fontSize: 13,
            }}>{erro}</div>
          )}

          {carregando ? (
            <div style={{ padding: 28, textAlign: 'center', color: T.textS }}>Carregando participantes…</div>
          ) : erro && !dados ? null : !dados?.participantes?.length ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center', borderRadius: 20,
              background: T.surface, border: `1px dashed ${T.border}`, color: T.textS,
            }}>
              <div style={{ color: T.blue || T.gold, marginBottom: 10 }}><IconePresente size={30} /></div>
              <b>A lista ainda não foi publicada.</b>
              <div style={{ marginTop: 5, fontSize: 13 }}>{isAdmin ? 'Carregue a planilha e publique as sugestões para todos.' : 'O administrador ainda vai disponibilizar as sugestões.'}</div>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12, marginBottom: 12,
              }}>
                <div style={{ fontSize: 13, color: T.textS }}>
                  Exibindo <b>{filtrados.length}</b> de <b>{participantes.length}</b> participantes
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: isMobile ? '1 1 100%' : '0 1 520px' }}>
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar participante ou sugestão…"
                    style={{
                      flex: '1 1 190px', minWidth: 0, padding: '10px 13px', borderRadius: 11,
                      border: `1px solid ${T.border}`, background: T.surface, color: T.text,
                      fontSize: 13, outline: 'none', fontFamily: 'var(--font-body)',
                    }} />
                  <button onClick={recarregar} disabled={carregando} title="Atualizar lista" style={{
                    padding: '9px 13px', borderRadius: 11, border: `1px solid ${T.border}`,
                    background: T.surface, color: T.textS, cursor: 'pointer', fontSize: 16,
                  }}>↻</button>
                  <button onClick={exportarPdf} disabled={exportando || !filtrados.length} title="Exporta os participantes exibidos"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '9px 13px', borderRadius: 11, border: `1px solid ${T.blue || T.gold}`,
                      background: T.blueGl || T.goldGl, color: T.blue || T.gold,
                      cursor: exportando || !filtrados.length ? 'not-allowed' : 'pointer',
                      opacity: exportando || !filtrados.length ? 0.65 : 1,
                      fontSize: 12, fontWeight: 750, fontFamily: 'var(--font-body)',
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v4h14v-4" />
                    </svg>
                    {exportando ? 'Gerando PDF…' : 'Exportar PDF'}
                  </button>
                </div>
              </div>

              {isMobile ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {filtrados.map((p, index) => (
                    <article key={`${p.nome}-${index}`} style={{
                      padding: 16, borderRadius: 18, background: T.surface,
                      border: `1px solid ${T.border}`, boxShadow: `0 7px 20px ${T.blue || T.gold}10`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                        <span style={{
                          width: 34, height: 34, display: 'grid', placeItems: 'center', flexShrink: 0,
                          borderRadius: 12, color: T.blue || T.gold, background: T.blueGl || T.goldGl, fontSize: 12, fontWeight: 800,
                        }}>{String(participantes.indexOf(p) + 1).padStart(2, '0')}</span>
                        <h2 style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 800, color: T.text }}>{p.nome}</h2>
                      </div>
                      <div style={{ display: 'grid', gap: 11 }}>
                        <CampoMobile icone="estrela" titulo="Presente desejado" valor={p.presente} />
                        <CampoMobile icone="coracao" titulo="Gostos pessoais" valor={p.gostos} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                          <CampoMobile titulo="Cor favorita" valor={p.cores} />
                          <CampoMobile icone="roupa" titulo="Roupa" valor={p.roupa} />
                          <CampoMobile icone="calcado" titulo="Calçado" valor={p.calcado} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div style={{
                  overflow: 'auto', borderRadius: 20, background: T.surface,
                  border: `1px solid ${T.border}`, boxShadow: `0 12px 30px ${T.blue || T.gold}12`,
                }}>
                  <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ background: T.blueGl || T.goldGl, color: T.blue || T.gold, textAlign: 'left' }}>
                        {[
                          ['#', 54], ['Participante', 190], ['Presente desejado', 250],
                          ['Gostos pessoais', 260], ['Cor favorita', 135], ['Roupa', 90], ['Calçado', 95],
                        ].map(([titulo, largura]) => (
                          <th key={titulo} style={{
                            padding: '15px 14px', width: largura, fontSize: 11,
                            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
                          }}>{titulo}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((p, index) => (
                        <tr key={`${p.nome}-${index}`} style={{ background: index % 2 ? T.surface : (T.blueGl || T.page) }}>
                          <td style={{ ...coluna, width: 54, color: T.blue || T.gold, fontWeight: 850 }}>{String(participantes.indexOf(p) + 1).padStart(2, '0')}</td>
                          <td style={{ ...coluna, fontSize: 13, fontWeight: 800, color: T.text }}>{p.nome}</td>
                          <td style={{ ...coluna, fontSize: 12.5, lineHeight: 1.5, color: T.textS, whiteSpace: 'pre-wrap' }}>{valorVazio(p.presente)}</td>
                          <td style={{ ...coluna, fontSize: 12.5, lineHeight: 1.5, color: T.textS, whiteSpace: 'pre-wrap' }}>{valorVazio(p.gostos)}</td>
                          <td style={{ ...coluna, fontSize: 12.5, lineHeight: 1.5, color: T.textS }}>{valorVazio(p.cores)}</td>
                          <td style={{ ...coluna, fontSize: 12.5, color: T.textS }}>{valorVazio(p.roupa)}</td>
                          <td style={{ ...coluna, fontSize: 12.5, color: T.textS }}>{valorVazio(p.calcado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <footer style={{ padding: '22px 0 6px', textAlign: 'center', color: T.textT, fontSize: 11.5 }}>
            Lista compartilhada da edição 2026 · atualizada pelo administrador
          </footer>
        </div>
      </main>
    </div>
  );
}

function CampoMobile({ icone, titulo, valor }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.blue || T.gold, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.035em' }}>
        {icone && <Icone tipo={icone} />} {titulo}
      </div>
      <div style={{ marginTop: 4, color: T.textS, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{valorVazio(valor)}</div>
    </div>
  );
}
