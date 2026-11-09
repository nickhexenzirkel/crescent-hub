import { useRef, useState } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { analisarLoteRecibos, gerarPacoteRecibos } from '../gerarRecibos';
import { formatarReais } from '../oficioEmissao';

const botao = {
  display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 10,
  padding: '11px 20px', fontSize: 13.5, fontWeight: 650, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};
const celula = {
  padding: '10px 12px', borderTop: `1px solid ${T.border}`, color: T.text,
  fontSize: 12.5, verticalAlign: 'top',
};
const encurtarNome = (nome) => nome.length > 52 ? `${nome.slice(0, 49)}...` : nome;

export const TabGerarRecibos = () => {
  const [planilha, setPlanilha] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [semCorrespondencia, setSemCorrespondencia] = useState([]);
  const [confirmado, setConfirmado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState('');
  const [arrastandoPlanilha, setArrastandoPlanilha] = useState(false);
  const [arrastandoPdf, setArrastandoPdf] = useState(false);
  const planilhaRef = useRef(null);
  const pdfsRef = useRef(null);

  const limparResultado = () => {
    setLinhas([]);
    setSemCorrespondencia([]);
    setConfirmado(false);
  };

  const selecionarPdfs = (files) => {
    const escolhidos = [...files].filter((file) => /\.pdf$/i.test(file.name));
    if (!escolhidos.length) return;
    setPdfs((atuais) => [
      ...atuais,
      ...escolhidos.filter((file) => !atuais.some((atual) =>
        atual.name === file.name && atual.size === file.size && atual.lastModified === file.lastModified)),
    ]);
    limparResultado();
  };

  const analisar = async () => {
    if (!planilha) {
      setErro('Selecione a planilha de faturamento primeiro.');
      return;
    }
    setBusy(true);
    setErro('');
    limparResultado();
    setProgresso('Lendo a planilha...');
    try {
      const resultado = await analisarLoteRecibos(planilha, pdfs, (atual, total, nome) => {
        setProgresso(`Lendo PDF ${atual}/${total}: ${nome}`);
      });
      setLinhas(resultado.linhas);
      setSemCorrespondencia(resultado.pdfsSemCorrespondencia);
      setProgresso('');
    } catch (e) {
      setErro(e?.message || 'Não foi possível ler os arquivos selecionados.');
      setProgresso('');
    } finally {
      setBusy(false);
    }
  };

  const baixar = async () => {
    if (!confirmado) {
      setErro('Confirme que os recebimentos desta remessa foram efetuados antes de gerar os recibos.');
      return;
    }
    setBusy(true);
    setErro('');
    try {
      const blob = await gerarPacoteRecibos(linhas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recibos_7SERV_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErro(e?.message || 'Não foi possível gerar os recibos.');
    } finally {
      setBusy(false);
    }
  };

  const areaArquivo = {
    border: `1px dashed ${T.border}`,
    borderRadius: 12,
    padding: 18,
    background: T.surface,
    cursor: busy ? 'default' : 'pointer',
    color: T.text,
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <StellarHero
        compact
        eyebrow="7SERV · Recibos"
        title="Gerar Recibos"
        subtitle="Prepare recibos a partir da planilha e das notas fiscais, para conferência e assinatura."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h8M8 17h8" />
          </svg>
        )}
      />

      <div style={{ maxWidth: 1050, display: 'grid', gap: 16 }}>
        <section>
          <label htmlFor="planilha-recibos" style={{ display: 'block', marginBottom: 8, color: T.textT, fontSize: 11.5, fontWeight: 700 }}>
            1 · Planilha de faturamento
          </label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => planilhaRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter') planilhaRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setArrastandoPlanilha(true); }}
            onDragLeave={() => setArrastandoPlanilha(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastandoPlanilha(false);
              const arquivo = [...e.dataTransfer.files].find((item) => /\.(xlsx|xlsm)$/i.test(item.name));
              if (arquivo) {
                setPlanilha(arquivo);
                limparResultado();
                setErro('');
              }
            }}
            style={{ ...areaArquivo, borderColor: arrastandoPlanilha ? T.gold : T.border, background: arrastandoPlanilha ? T.goldGl : T.surface }}
          >
            {planilha ? encurtarNome(planilha.name) : 'Clique para selecionar uma planilha .xlsx'}
          </div>
          <input
            ref={planilhaRef}
            id="planilha-recibos"
            type="file"
            accept=".xlsx,.xlsm"
            hidden
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) {
                setPlanilha(arquivo);
                limparResultado();
                setErro('');
              }
              e.target.value = '';
            }}
          />
        </section>

        <section>
          <label htmlFor="pdfs-recibos" style={{ display: 'block', marginBottom: 8, color: T.textT, fontSize: 11.5, fontWeight: 700 }}>
            2 · PDFs das notas fiscais (opcional)
          </label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => pdfsRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter') pdfsRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setArrastandoPdf(true); }}
            onDragLeave={() => setArrastandoPdf(false)}
            onDrop={(e) => { e.preventDefault(); setArrastandoPdf(false); selecionarPdfs(e.dataTransfer.files); }}
            style={{ ...areaArquivo, borderColor: arrastandoPdf ? T.gold : T.border, background: arrastandoPdf ? T.goldGl : T.surface }}
          >
            {pdfs.length ? `${pdfs.length} PDF(s): ${pdfs.map((file) => file.name).join(' · ')}` : 'Clique para anexar os PDFs das NFS-e'}
          </div>
          <input
            ref={pdfsRef}
            id="pdfs-recibos"
            type="file"
            accept=".pdf"
            multiple
            hidden
            onChange={(e) => {
              selecionarPdfs(e.target.files || []);
              e.target.value = '';
            }}
          />
          {pdfs.length > 0 && (
            <button type="button" onClick={() => { setPdfs([]); limparResultado(); }} style={{ ...botao, marginTop: 7, padding: '5px 8px', background: 'transparent', color: T.textT }}>
              Remover PDFs
            </button>
          )}
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={!planilha || busy} onClick={analisar} style={{ ...botao, background: T.gold, color: '#fff', opacity: !planilha || busy ? 0.6 : 1 }}>
            {busy ? 'Processando...' : 'Ler planilha e notas'}
          </button>
          {linhas.length > 0 && (
            <button type="button" disabled={busy || !confirmado} onClick={baixar} style={{ ...botao, background: T.surface, color: T.text, border: `1px solid ${T.border}` }}>
              Gerar recibos (.zip)
            </button>
          )}
          {progresso && <span style={{ color: T.textT, fontSize: 12 }}>{progresso}</span>}
        </div>

        {erro && <div role="alert" style={{ padding: 12, borderRadius: 10, background: 'rgba(192,64,80,.08)', color: T.text }}>{erro}</div>}

        {linhas.length > 0 && (
          <>
            <StarDivider my={3} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: T.text, fontSize: 13, lineHeight: 1.5 }}>
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} style={{ marginTop: 3, accentColor: T.gold }} />
              Confirmo que os recebimentos ocorreram e que os valores e destinatários foram conferidos para assinatura.
            </label>
            {semCorrespondencia.length > 0 && (
              <div role="status" style={{ color: T.textT, fontSize: 12 }}>PDFs sem nota correspondente: {semCorrespondencia.join(' · ')}</div>
            )}
            <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface }}>
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    {['Nota', 'Município', 'Secretaria / setor', 'Valor bruto', 'Comparação'].map((titulo) => (
                      <th key={titulo} style={{ padding: '10px 12px', color: T.textT, fontSize: 10.5, textTransform: 'uppercase' }}>{titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, i) => (
                    <tr key={`${linha.numero}-${linha.linhaPlanilha}-${i}`}>
                      <td style={celula}><b>{linha.numero}</b></td>
                      <td style={celula}>{linha.municipio || '—'}</td>
                      <td style={celula}>{linha.secretaria || '—'}</td>
                      <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                        {linha.valorBrutoRecibo == null ? '—' : `R$ ${formatarReais(linha.valorBrutoRecibo)}`}
                        <div style={{ color: T.textT, fontSize: 10.5 }}>{linha.origemValorBrutoRecibo}</div>
                      </td>
                      <td style={celula}>
                        {linha.pdf ? `PDF: ${linha.pdf}` : 'Sem PDF correspondente'}
                        {linha.divergencias.map((item) => <div key={item}>{item}</div>)}
                        {linha.problemas.map((item) => <div key={item}>{item}</div>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
