import { useRef, useState } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { analisarLoteRecibos, gerarPacoteConferencia } from '../gerarRecibos';
import { formatarReais } from '../oficioEmissao';

const btn = {
  display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 10,
  padding: '11px 20px', fontSize: 13.5, fontWeight: 650, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};
const label = {
  display: 'block', marginBottom: 8, color: T.textT, fontSize: 11.5,
  fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
};
const cell = { padding: '10px 12px', borderTop: `1px solid ${T.border}`, color: T.text, fontSize: 12.5, verticalAlign: 'top' };

const dataBr = (data) => data.toLocaleDateString('pt-BR').replace(/\//g, '-');
const tituloArquivo = (nome) => nome.length > 52 ? `${nome.slice(0, 49)}...` : nome;

function statusPdf(linha) {
  if (linha.pdfStatus === 'conferida') return { texto: 'PDF conferido', cor: '#1A9C70' };
  if (linha.pdfStatus === 'divergente') return { texto: 'Divergência de valor', cor: '#C04050' };
  if (linha.pdfStatus === 'ambigua') return { texto: 'Mais de um PDF', cor: '#C98A1B' };
  if (linha.pdfStatus === 'nao_validada') return { texto: 'PDF não validado', cor: '#C98A1B' };
  return { texto: 'Sem PDF correspondente', cor: T.textT };
}

export const TabGerarRecibos = () => {
  const [planilha, setPlanilha] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [pdfsSemCorrespondencia, setPdfsSemCorrespondencia] = useState([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState('');
  const [dragPlanilha, setDragPlanilha] = useState(false);
  const [dragPdfs, setDragPdfs] = useState(false);
  const planilhaRef = useRef(null);
  const pdfsRef = useRef(null);

  const adicionarPdfs = (files) => {
    const escolhidos = [...files].filter((file) => /\.pdf$/i.test(file.name));
    if (!escolhidos.length) return;
    setPdfs((atuais) => {
      const novos = escolhidos.filter((file) => !atuais.some((atual) =>
        atual.name === file.name && atual.size === file.size && atual.lastModified === file.lastModified));
      return [...atuais, ...novos];
    });
    setLinhas([]);
    setPdfsSemCorrespondencia([]);
  };

  const conferir = async () => {
    if (!planilha) {
      setErro('Selecione a planilha de faturamento primeiro.');
      return;
    }
    setBusy(true);
    setErro('');
    setLinhas([]);
    setProgresso('Lendo a planilha...');
    try {
      const resultado = await analisarLoteRecibos(planilha, pdfs, (atual, total, nome) => {
        setProgresso(`Lendo PDF ${atual}/${total}: ${nome}`);
      });
      setLinhas(resultado.linhas);
      setPdfsSemCorrespondencia(resultado.pdfsSemCorrespondencia);
      setProgresso('');
    } catch (e) {
      setErro(e?.message || 'Não foi possível conferir os arquivos.');
      setProgresso('');
    } finally {
      setBusy(false);
    }
  };

  const baixarPacote = async () => {
    setBusy(true);
    setErro('');
    try {
      const blob = await gerarPacoteConferencia(linhas);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Conferencias_Internas_${dataBr(new Date())}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErro(e?.message || 'Não foi possível gerar o pacote interno.');
    } finally {
      setBusy(false);
    }
  };

  const alerta = {
    padding: '13px 15px', borderRadius: 11, border: '1px solid rgba(192,64,80,.35)',
    background: 'rgba(192,64,80,.08)', color: T.text, fontSize: 13, lineHeight: 1.55,
  };
  const drop = (ativo, cheio) => ({
    border: `2px dashed ${ativo || cheio ? T.gold : T.border}`,
    borderRadius: 13, padding: '22px 18px', textAlign: 'center',
    cursor: busy ? 'default' : 'pointer', background: ativo || cheio ? T.goldGl : T.surface,
    transition: 'all .18s',
  });

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <StellarHero
        compact
        eyebrow="Conferência · Documentos internos"
        title="Gerar Recibos"
        subtitle="Cruze a planilha de faturamento com os PDFs das notas e gere um pacote de conferência interna por nota."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h8M8 17h8" />
          </svg>
        )}
      />

      <div style={{ maxWidth: 1020, display: 'grid', gap: 18 }}>
        <div style={alerta}>
          <b>NÃO OFICIAL — NÃO COMPROVA PAGAMENTO.</b> Os PDFs gerados são documentos internos de conferência, não recibos da Omie. Os valores vêm da planilha e não confirmam que houve baixa ou recebimento.
        </div>

        <section>
          <span style={label}>1 · Planilha de faturamento (.xlsx)</span>
          <div
            onClick={() => !busy && planilhaRef.current?.click()}
            onDragOver={(e) => { if (!busy) { e.preventDefault(); setDragPlanilha(true); } }}
            onDragLeave={() => setDragPlanilha(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragPlanilha(false);
              const file = [...e.dataTransfer.files].find((item) => /\.(?:xlsx|xlsm)$/i.test(item.name));
              if (file) { setPlanilha(file); setLinhas([]); setPdfsSemCorrespondencia([]); setErro(''); }
            }}
            style={drop(dragPlanilha, !!planilha)}
          >
            <input ref={planilhaRef} type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) { setPlanilha(file); setLinhas([]); setPdfsSemCorrespondencia([]); setErro(''); } e.target.value = ''; }} />
            <div style={{ color: T.text, fontSize: 14, fontWeight: 650 }}>
              {planilha ? tituloArquivo(planilha.name) : 'Arraste ou clique para selecionar a planilha'}
            </div>
            <div style={{ color: T.textT, fontSize: 12, marginTop: 5 }}>
              Lê as colunas de nota, município, secretaria/setor e valores pelo cabeçalho.
            </div>
          </div>
        </section>

        <section>
          <span style={label}>2 · PDFs das notas fiscais (opcional)</span>
          <div
            onClick={() => !busy && pdfsRef.current?.click()}
            onDragOver={(e) => { if (!busy) { e.preventDefault(); setDragPdfs(true); } }}
            onDragLeave={() => setDragPdfs(false)}
            onDrop={(e) => { e.preventDefault(); setDragPdfs(false); adicionarPdfs(e.dataTransfer.files); }}
            style={drop(dragPdfs, pdfs.length > 0)}
          >
            <input ref={pdfsRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
              onChange={(e) => { adicionarPdfs(e.target.files || []); e.target.value = ''; }} />
            <div style={{ color: T.text, fontSize: 14, fontWeight: 650 }}>
              {pdfs.length ? `${pdfs.length} PDF(s) selecionado(s) — clique ou arraste para acrescentar` : 'Arraste ou clique para selecionar as notas fiscais'}
            </div>
            <div style={{ color: T.textT, fontSize: 12, marginTop: 5 }}>
              O Uniko confere o número e os valores disponíveis no conteúdo do PDF; não valida pagamento.
            </div>
          </div>
          {pdfs.length > 0 && (
            <div style={{ marginTop: 8, color: T.textT, fontSize: 11.5 }}>
              {pdfs.map((file) => file.name).join(' · ')}
              <button type="button" onClick={() => { setPdfs([]); setLinhas([]); setPdfsSemCorrespondencia([]); }}
                style={{ ...btn, marginLeft: 8, padding: '4px 8px', background: 'transparent', color: T.textT }}>
                Remover PDFs
              </button>
            </div>
          )}
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button type="button" disabled={!planilha || busy} onClick={conferir}
            style={{ ...btn, background: T.gold, color: '#fff', opacity: !planilha || busy ? .6 : 1 }}>
            {busy ? 'Processando...' : 'Conferir arquivos'}
          </button>
          {linhas.length > 0 && (
            <button type="button" disabled={busy} onClick={baixarPacote}
              style={{ ...btn, background: T.surface, color: T.text, border: `1px solid ${T.border}` }}>
              Baixar PDFs internos (.zip)
            </button>
          )}
          {progresso && <span style={{ color: T.textT, fontSize: 12 }}>{progresso}</span>}
        </div>

        {erro && <div role="alert" style={alerta}>{erro}</div>}

        {linhas.length > 0 && (
          <>
            <StarDivider my={4} />
            <div style={{ color: T.textT, fontSize: 12.5 }}>
              {linhas.length} nota(s) lida(s). O pacote contém um PDF interno por linha da planilha.
            </div>
            {pdfsSemCorrespondencia.length > 0 && (
              <div role="status" style={{ ...alerta, borderColor: T.border, background: T.surface }}>
                PDF(s) sem correspondência na planilha: {pdfsSemCorrespondencia.join(' · ')}
              </div>
            )}
            <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    {['Nota', 'Município', 'Secretaria / setor', 'Valor bruto', 'PDF da nota', 'Conferência'].map((titulo) => (
                      <th key={titulo} style={{ padding: '10px 12px', color: T.textT, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, i) => {
                    const status = statusPdf(linha);
                    return (
                      <tr key={`${linha.numero}-${linha.linhaPlanilha}-${i}`}>
                        <td style={cell}><b>{linha.numero}</b></td>
                        <td style={cell}>{linha.municipio || '—'}</td>
                        <td style={{ ...cell, maxWidth: 280 }}>{linha.secretaria || '—'}</td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>{linha.valorBruto == null ? '—' : `R$ ${formatarReais(linha.valorBruto)}`}</td>
                        <td style={{ ...cell, maxWidth: 180, overflowWrap: 'anywhere' }}>{linha.pdf || 'Não anexado'}</td>
                        <td style={{ ...cell, color: status.cor, minWidth: 165 }}>
                          <b>{status.texto}</b>
                          {linha.divergencias.map((item) => <div key={item} style={{ marginTop: 4, color: T.text }}>{item}</div>)}
                          {linha.problemas.map((item) => <div key={item} style={{ marginTop: 4, color: T.textT }}>{item}</div>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
