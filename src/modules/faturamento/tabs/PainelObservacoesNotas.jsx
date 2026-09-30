import { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { T } from '../../../contexts/theme';
import { montarRelatorio } from '../observacoesNotas.js';
import { lerArquivoPlanilha, lerArquivos, textoDoPdf } from '../observacoesNotasIO.js';
import { buscarNoEmail, detectarExtensao } from '../extensaoNotasEmail.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ── Observações das notas ────────────────────────────────────────────────
   Anexa a planilha de Finanças (Contas a Receber) e os ZIPs/PDFs das notas
   (ex.: pastas baixadas do OneDrive). Para cada nota o sistema abre o PDF,
   confere o número e o CNPJ do cliente e devolve, num Excel:
       NOTA | OBSERVAÇÃO  →  "MANUTENCAO, FAT. 02/05 A 02/06/2026"
   Tudo é lido aqui no navegador — nada é enviado a servidor. */

const fmtEmissao = (v) => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('pt-BR');
};

const fmtMoeda = (v) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROTULO = {
  lida: 'Lida do PDF',
  'sem-pdf': 'PDF não encontrado',
  'outro-cliente': 'PDF de outro cliente',
  'sem-dados': 'Sem categoria/período',
};
const COR = {
  lida: '#1A9C70',
  'sem-pdf': '#C98A1B',
  'outro-cliente': '#C04050',
  'sem-dados': '#C04050',
};

const ZonaSoltar = ({ titulo, dica, aceita, multiplo, onFiles, ocupado }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const lidar = useCallback(
    (files) => {
      const ok = [...files].filter((f) => aceita.test(f.name));
      if (ok.length) onFiles(ok);
    },
    [aceita, onFiles],
  );
  return (
    <div
      onClick={() => !ocupado && ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!ocupado) lidar(e.dataTransfer.files); }}
      style={{
        border: `2px dashed ${drag ? T.gold : T.border}`, borderRadius: 14, padding: '26px 24px',
        textAlign: 'center', cursor: ocupado ? 'wait' : 'pointer',
        background: drag ? T.goldGl : T.surface, transition: 'all .18s', opacity: ocupado ? 0.7 : 1,
      }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 13, color: T.textT }}>{dica}</div>
      <input
        ref={ref} type="file" multiple={multiplo} style={{ display: 'none' }}
        accept={aceita.source.includes('zip') ? '.zip,.pdf' : '.xlsx,.xls'}
        onChange={(e) => { if (e.target.files.length) lidar([...e.target.files]); e.target.value = ''; }}
      />
    </div>
  );
};

const Chip = ({ n, rotulo, cor }) => (
  <div style={{ padding: '8px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textS }}>
    <strong style={{ color: cor || T.text, fontSize: 16 }}>{n}</strong>
    <span style={{ marginLeft: 6 }}>{rotulo}</span>
  </div>
);

export const PainelObservacoesNotas = () => {
  const [planilha, setPlanilha] = useState(null); // { nome, notas }
  const [arquivos, setArquivos] = useState([]); // nomes dos ZIPs/PDFs já lidos
  const [pdfs, setPdfs] = useState([]); // texto dos PDFs já lidos (espelho do cache)
  const [progresso, setProgresso] = useState(null); // { feitos, total }
  const [erro, setErro] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [contasGmail, setContasGmail] = useState(() => {
    try { return localStorage.getItem('uniko_notas_contas_gmail') || '1,2'; } catch { return '1,2'; }
  });
  const [email, setEmail] = useState(null); // { rodando, log:[], feitos, total, resumo }
  const cancelarEmail = useRef(null);
  const cache = useRef(new Map()); // PDFs já lidos (chave = arquivo::caminho) — só mexe em eventos, nunca na renderização

  const ocupado = !!progresso;

  const carregarPlanilha = async ([file]) => {
    setErro(null);
    try {
      const notas = await lerArquivoPlanilha(file);
      if (!notas.length) throw new Error('Nenhuma nota encontrada na planilha.');
      setPlanilha({ nome: file.name, notas });
    } catch (e) {
      setErro(e?.message || 'Não foi possível ler a planilha.');
    }
  };

  const carregarArquivos = async (files) => {
    if (!planilha) return;
    setErro(null);
    setProgresso({ feitos: 0, total: 0 });
    try {
      const r = await lerArquivos(
        pdfjsLib, files, planilha.notas.map((n) => n.numero), cache.current,
        (p) => setProgresso({ feitos: p.feitos, total: p.total }),
      );
      setArquivos((prev) => [...prev, ...files.map((f) => f.name).filter((n) => !prev.includes(n))]);
      setAvisos(r.erros);
      setPdfs([...cache.current.values()]);
    } catch (e) {
      setErro(e?.message || 'Não foi possível ler os arquivos.');
    } finally {
      setProgresso(null);
    }
  };

  const relatorio = useMemo(
    () => (planilha ? montarRelatorio(planilha.notas, pdfs) : null),
    [planilha, pdfs],
  );

  const linhas = useMemo(() => {
    if (!relatorio) return [];
    const q = busca.trim().toLowerCase();
    return relatorio.linhas.filter((l) => {
      if (filtro === 'lidas' && l.situacao !== 'lida') return false;
      if (filtro === 'faltam' && l.situacao === 'lida') return false;
      if (!q) return true;
      return String(l.numero).includes(q) || (l.cliente || '').toLowerCase().includes(q) || (l.observacao || '').toLowerCase().includes(q);
    });
  }, [relatorio, filtro, busca]);

  // Procura no Gmail (pela extensão) as notas que ainda não têm observação.
  const procurarNosEmails = async () => {
    const faltantes = relatorio.linhas.filter((l) => l.situacao !== 'lida').map((l) => String(l.numero));
    const contas = [...new Set(contasGmail.split(/[^0-9]+/).filter(Boolean).map(Number))];
    if (!faltantes.length) return;
    if (!contas.length || contas.some((c) => c > 9)) {
      setErro('Informe os números das contas do Gmail (ex.: 1,2 — o número que aparece em mail.google.com/mail/u/2/).');
      return;
    }
    try { localStorage.setItem('uniko_notas_contas_gmail', contasGmail); } catch { /* sem armazenamento */ }
    setErro(null);
    setEmail({ rodando: true, log: ['Procurando a extensão…'], feitos: 0, total: 0 });
    const ext = await detectarExtensao();
    if (!ext) {
      setEmail(null);
      setErro('Extensão "Uniko — Notas por e-mail" não encontrada. Instale a extensão (pasta extension-notas-email do projeto) no Chrome e recarregue esta página (F5).');
      return;
    }
    let recebidos = 0;
    const { promessa, cancelar } = buscarNoEmail({
      numeros: faltantes,
      contas,
      onLog: (t) => setEmail((e) => e && { ...e, log: [...e.log.slice(-4), t] }),
      onProgresso: (p) => setEmail((e) => e && { ...e, feitos: p.feitos, total: p.total, conta: p.conta }),
      onArquivo: async (a) => {
        const texto = await textoDoPdf(pdfjsLib, a.bytes);
        recebidos++;
        cache.current.set(`email::${a.conta}::${a.assunto}::${a.nome}`, {
          nome: a.nome,
          caminho: `E-mail ${a.email || 'conta ' + a.conta} › ${a.assunto} (${a.dataEmail}) › ${a.nome}`,
          texto,
          assunto: a.assunto,
        });
        setPdfs([...cache.current.values()]);
      },
    });
    cancelarEmail.current = cancelar;
    try {
      const r = await promessa;
      setEmail({ rodando: false, log: [], resumo: { ...r, recebidos } });
    } catch (e) {
      setEmail(null);
      setErro(e?.message || 'Falha ao procurar nos e-mails.');
    } finally {
      cancelarEmail.current = null;
    }
  };

  const baixarExcel = () => {
    const dados = relatorio.linhas.map((l) => ({
      'NOTA': l.numero,
      'OBSERVAÇÃO': l.observacao,
      'VALOR BRUTO': l.valores?.bruto ?? '',
      'DESCONTO': l.valores?.desconto ?? '',
      'VALOR LÍQUIDO': l.valores?.liquido ?? '',
      'CLIENTE': l.cliente,
      'SITUAÇÃO': ROTULO[l.situacao] + (l.situacao === 'lida' ? '' : ` — ${l.detalhe}`),
      'ARQUIVO (PDF)': l.arquivo,
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 10 }, { wch: 42 }, { wch: 15 }, { wch: 13 }, { wch: 15 }, { wch: 34 }, { wch: 46 }, { wch: 80 }];
    // Colunas C, D e E (valores) como moeda, para o Excel somar e filtrar direito.
    for (let r = 1; r <= dados.length; r++)
      for (const c of ['C', 'D', 'E']) {
        const cel = ws[`${c}${r + 1}`];
        if (cel && typeof cel.v === 'number') cel.z = '"R$" #,##0.00';
      }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Observações');
    XLSX.writeFile(wb, `observacoes_notas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  // Lista só das que ainda não têm observação — é o que será procurado nos e-mails.
  const baixarFaltantes = () => {
    const dados = relatorio.linhas.filter((l) => l.situacao !== 'lida').map((l) => ({
      'NOTA': l.numero,
      'CLIENTE': l.cliente,
      'CNPJ': l.cnpj,
      'EMISSÃO': fmtEmissao(l.emissao),
      'MOTIVO': ROTULO[l.situacao],
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), 'Faltam');
    XLSX.writeFile(wb, `notas_sem_observacao_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  const limpar = () => {
    cache.current = new Map();
    setPlanilha(null); setArquivos([]); setAvisos([]); setErro(null);
    setPdfs([]); setFiltro('todas'); setBusca('');
  };

  const r = relatorio?.resumo;
  const faltam = r ? r.total - r.lidas : 0;

  return (
    <div>
      <div style={{ fontSize: 13, color: T.textS, marginBottom: 16, lineHeight: 1.6 }}>
        1) Anexe a planilha de <strong>Finanças</strong> (Contas a Receber) com as notas. 2) Anexe os <strong>ZIPs</strong> (ou PDFs) das notas —
        por exemplo as pastas baixadas do OneDrive. O sistema abre cada PDF, confere o <strong>número</strong> e o <strong>CNPJ do cliente</strong> e
        devolve a observação no formato <strong>CATEGORIA, FAT. PERÍODO</strong> e os valores <strong>bruto</strong>, <strong>desconto</strong> e <strong>líquido</strong> de cada nota. Nada sai do seu navegador.
      </div>

      {erro && (
        <div style={{ background: 'rgba(192,64,80,0.06)', border: '1px solid rgba(192,64,80,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: T.danger }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <ZonaSoltar
            titulo={planilha ? 'Trocar a planilha' : '1 · Planilha de notas (Finanças)'}
            dica={planilha ? `${planilha.nome} — ${planilha.notas.length} notas` : 'Arquivo .xlsx exportado de Contas a Receber'}
            aceita={/\.xlsx?$/i} multiplo={false} onFiles={carregarPlanilha} ocupado={ocupado}
          />
        </div>
        <div>
          <ZonaSoltar
            titulo="2 · ZIPs ou PDFs das notas"
            dica={planilha ? 'Pode soltar vários de uma vez e ir adicionando — tudo acumula' : 'Anexe primeiro a planilha'}
            aceita={/\.(zip|pdf)$/i} multiplo onFiles={carregarArquivos} ocupado={ocupado || !planilha}
          />
        </div>
      </div>

      {progresso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: T.goldGl, borderRadius: 10, marginBottom: 20, fontSize: 14, color: T.textS }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${T.gold}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }} />
          {progresso.total ? `Lendo as notas… ${progresso.feitos} de ${progresso.total}` : 'Abrindo os arquivos…'}
        </div>
      )}

      {arquivos.length > 0 && (
        <div style={{ fontSize: 12, color: T.textT, marginBottom: 14 }}>
          Arquivos lidos: {arquivos.join(' · ')}
        </div>
      )}
      {avisos.length > 0 && (
        <div style={{ fontSize: 12, color: T.danger, marginBottom: 14 }}>
          {avisos.length} arquivo(s) não puderam ser lidos: {avisos.slice(0, 3).join(' · ')}
        </div>
      )}

      {relatorio && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <Chip n={r.total} rotulo="notas na planilha" />
            <Chip n={r.lidas} rotulo="com observação (lidas do PDF)" cor={COR.lida} />
            <Chip n={r.semPdf} rotulo="sem PDF nos arquivos" cor={COR['sem-pdf']} />
            {r.deAssunto > 0 && <Chip n={r.deAssunto} rotulo="com período/categoria tirados do assunto do e-mail" cor={COR['sem-pdf']} />}
            {r.outroCliente > 0 && <Chip n={r.outroCliente} rotulo="PDF de outro cliente" cor={COR['outro-cliente']} />}
            {r.semDados > 0 && <Chip n={r.semDados} rotulo="PDF sem categoria/período" cor={COR['sem-dados']} />}
          </div>

          {faltam > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                Procurar as {faltam} que faltam nos e-mails
              </div>
              <div style={{ fontSize: 12, color: T.textT, marginBottom: 12, lineHeight: 1.5 }}>
                Usa a extensão <strong>Uniko — Notas por e-mail</strong>: ela abre o Gmail das contas abaixo (que precisam estar logadas neste Chrome),
                acha o PDF de cada nota, e o Uniko lê o corpo, conferindo número e CNPJ. Deixe a janela do Gmail que abrir visível até terminar.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, color: T.textS }}>
                  Contas do Gmail (número da URL, ex.: 1,2)
                  <input
                    value={contasGmail} onChange={(e) => setContasGmail(e.target.value)} disabled={email?.rodando}
                    style={{ marginLeft: 8, width: 90, padding: '7px 10px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, outline: 'none', fontSize: 13, color: T.text }}
                  />
                </label>
                {email?.rodando ? (
                  <button
                    onClick={() => cancelarEmail.current?.()}
                    style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Cancelar busca
                  </button>
                ) : (
                  <button
                    onClick={procurarNosEmails} disabled={ocupado}
                    style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: T.gold, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Procurar nos e-mails
                  </button>
                )}
              </div>
              {email?.rodando && (
                <div style={{ marginTop: 12, fontSize: 12, color: T.textS, lineHeight: 1.6 }}>
                  {email.total > 0 && <div><strong>{email.feitos} de {email.total}</strong> nota(s) verificadas na conta /u/{email.conta}/</div>}
                  {email.log.map((t, i) => <div key={i} style={{ color: T.textT }}>{t}</div>)}
                </div>
              )}
              {email && !email.rodando && email.resumo && (
                <div style={{ marginTop: 12, fontSize: 12, color: T.textS }}>
                  {email.resumo.cancelado ? 'Busca cancelada. ' : 'Busca concluída. '}
                  Foram recebidos {email.resumo.recebidos} PDF(s) dos e-mails; o resultado já está na tabela abaixo.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nota, cliente ou observação…"
              style={{ flex: 1, minWidth: 200, padding: '9px 14px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, outline: 'none', fontSize: 14, color: T.text, fontFamily: 'var(--font-body)' }}
            />
            <select
              value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}>
              <option value="todas">Todas</option>
              <option value="lidas">Só as lidas</option>
              <option value="faltam">Só as que faltam</option>
            </select>
            <button
              onClick={baixarExcel}
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: T.gold, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Baixar Excel
            </button>
            {faltam > 0 && (
              <button
                onClick={baixarFaltantes}
                style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Baixar só as {faltam} que faltam
              </button>
            )}
            <button
              onClick={limpar}
              style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'transparent', color: T.textS, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Limpar
            </button>
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: T.sh }}>
            <div style={{ overflowX: 'auto', maxHeight: 520 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: T.goldGl, borderBottom: `1px solid ${T.border}` }}>
                    {['Nota', 'Observação', 'Valor bruto', 'Desconto', 'Valor líquido', 'Cliente', 'Situação'].map((h) => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.textS, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.goldGl }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={`${l.numero}-${i}`} style={{ borderBottom: `1px solid ${T.divider}` }}>
                      <td style={{ padding: '10px 14px', color: T.text, fontWeight: 600 }}>{l.numero}</td>
                      <td style={{ padding: '10px 14px', color: T.text, whiteSpace: 'nowrap' }}>{l.observacao || '—'}</td>
                      <td style={{ padding: '10px 14px', color: T.text, whiteSpace: 'nowrap', textAlign: 'right' }}>{fmtMoeda(l.valores?.bruto)}</td>
                      <td style={{ padding: '10px 14px', color: T.textS, whiteSpace: 'nowrap', textAlign: 'right' }}>{fmtMoeda(l.valores?.desconto)}</td>
                      <td style={{ padding: '10px 14px', color: T.text, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{fmtMoeda(l.valores?.liquido)}</td>
                      <td style={{ padding: '10px 14px', color: T.textS, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.cliente}>{l.cliente}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} title={l.arquivo || l.detalhe}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: COR[l.situacao], background: `${COR[l.situacao]}1A` }}>
                          {ROTULO[l.situacao]}{l.deAssunto ? ' · assunto do e-mail' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {linhas.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: T.textT, fontSize: 14 }}>
                        Nenhuma nota para o filtro aplicado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
