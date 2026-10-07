import { useState, useRef } from 'react';
import { T } from '../../../contexts/theme';
import { StarDivider } from '../../../shared/components';
import { StellarHero } from '../StellarHero';
import { lerEmpenho, gerarPlanilhaEmpenhos, encerrarOcr } from '../empenho';
import { formatarReais } from '../oficioEmissao';

/* ═══════════════════════════════════════════════════════════════
   LEITURA DE EMPENHO — a mesma função do Uniko Detetive, no navegador.
   Arraste quantas Notas de Empenho quiser e baixe UMA planilha, uma linha
   por empenho: secretaria/unidade orçamentária, nº do empenho e valor
   empenhado. Empenho digitalizado/fotografado é lido por OCR (mais lento).
═══════════════════════════════════════════════════════════════ */

const I = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{p.children}</svg>
);
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 8, background: T.gold, color: '#fff', border: 'none',
  borderRadius: 10, padding: '12px 26px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-body)', boxShadow: `0 2px 10px ${T.gold}44`,
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: T.textS,
  border: `1px solid ${T.border}`, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: T.textT, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8, display: 'block' };

let seq = 0;
const carimbo = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };

export const TabEmpenho = () => {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();
  const fila = useRef(Promise.resolve());

  const patch = (id, p) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  /** Lê os PDFs um de cada vez (o OCR é pesado), na ordem em que foram soltos. */
  const adicionar = (files) => {
    const pdfs = [...files].filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return;
    const novos = pdfs.map((file) => ({ id: ++seq, file, arquivo: file.name, estado: 'fila' }));
    setRows((rs) => [...rs, ...novos]);
    setBusy(true);
    fila.current = fila.current.then(async () => {
      for (const r of novos) {
        patch(r.id, { estado: 'lendo' });
        try {
          const d = await lerEmpenho(r.file, { aoUsarOcr: () => patch(r.id, { estado: 'ocr' }) });
          patch(r.id, { ...d, estado: d.status });
        } catch (e) {
          patch(r.id, { estado: 'erro', problemas: [`Não consegui ler o PDF (${e?.message || 'arquivo inválido'}).`] });
        }
      }
    }).catch((e) => setErro(e?.message || 'Falha na leitura.'))
      .finally(async () => { await encerrarOcr(); setBusy(false); });
  };

  const prontos = rows.filter((r) => ['lido', 'incompleto', 'nao_e_empenho', 'erro'].includes(r.estado));
  const lidos = rows.filter((r) => r.estado === 'lido').length;
  const comProblema = rows.filter((r) => ['incompleto', 'nao_e_empenho', 'erro'].includes(r.estado)).length;
  const podeBaixar = !busy && prontos.length > 0;

  const baixar = async () => {
    setErro('');
    try {
      const blob = await gerarPlanilhaEmpenhos(prontos);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Empenhos_${carimbo()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { setErro(e?.message || 'Não foi possível gerar a planilha.'); }
  };

  const situacao = (r) => {
    if (r.estado === 'fila') return <span style={{ color: T.textT }}>Na fila…</span>;
    if (r.estado === 'lendo') return <span style={{ color: T.textT }}>Lendo…</span>;
    if (r.estado === 'ocr') return <span style={{ color: T.textT }}>Lendo por OCR (imagem — leva alguns segundos)…</span>;
    if (r.estado === 'lido') return <span style={{ color: '#1A9C70', fontWeight: 600 }}>✓ Lido{r.ocr ? ' (OCR — confira os valores)' : ''}</span>;
    return <span style={{ color: r.estado === 'nao_e_empenho' ? T.textT : '#C98A1B' }}>{(r.problemas || []).join(' ')}</span>;
  };
  const falta = <span title="Não encontrado no PDF — confira o arquivo" style={{ color: '#C98A1B' }}>—</span>;
  const cell = { padding: '10px 12px', fontSize: 13, color: T.text, verticalAlign: 'top', borderTop: `1px solid ${T.border}` };

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <StellarHero
        compact
        eyebrow="Documentos · PDF"
        title="Leitura de Empenho"
        subtitle="Arraste as Notas de Empenho e baixe uma única planilha, uma linha por empenho, com a secretaria, o número e o valor empenhado."
        icon={(
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" />
            <line x1="14" y1="14" x2="18" y2="14" /><line x1="14" y1="17.5" x2="17" y2="17.5" />
          </svg>
        )}
      />

      <div style={{ maxWidth: 940 }}>
        <span style={labelStyle}>Notas de empenho (PDF)</span>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); adicionar(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${drag || rows.length ? T.gold : T.border}`, borderRadius: 14, padding: '30px 24px', textAlign: 'center',
            cursor: 'pointer', background: drag || rows.length ? T.goldGl : T.surface, transition: 'all .18s',
          }}>
          <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
            {rows.length ? `${rows.length} empenho(s) na lista — arraste ou clique pra adicionar mais` : 'Arraste aqui os PDFs dos empenhos'}
          </div>
          <div style={{ fontSize: 12.5, color: T.textT, marginTop: 5 }}>
            Pode ser um empenho ou a remessa inteira. Todos entram na mesma planilha, na ordem em que forem lidos. Empenhos escaneados ou fotografados são lidos por OCR.
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <div style={{ marginTop: 16, border: `1px solid ${T.border}`, borderRadius: 14, background: T.surface, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    {['Secretaria / Unidade orçamentária', 'Nº empenho', 'Valor empenhado', 'Arquivo e situação', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: T.textT, letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const lida = ['lido', 'incompleto'].includes(r.estado);
                    return (
                      <tr key={r.id}>
                        <td style={{ ...cell, whiteSpace: 'pre-wrap', fontSize: 12.5, minWidth: 220 }}>{lida ? (r.secretaria || falta) : '—'}</td>
                        <td style={{ ...cell, fontWeight: 700 }}>{lida ? (r.numero || falta) : '—'}</td>
                        <td style={{ ...cell, whiteSpace: 'nowrap', fontSize: 12.5 }}>{lida ? (r.valorEmpenhado == null ? falta : `R$ ${formatarReais(r.valorEmpenhado)}`) : '—'}</td>
                        <td style={cell}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, wordBreak: 'break-word' }}>{r.arquivo}</div>
                          <div style={{ fontSize: 11.5, marginTop: 2 }}>{situacao(r)}</div>
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          <button style={{ ...btnGhost, padding: '6px 9px', border: 'none' }} title="Tirar da lista" disabled={busy && ['fila', 'lendo', 'ocr'].includes(r.estado)}
                            onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: T.textT, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{lidos} empenho(s) lido(s) por completo{comProblema ? ` · ${comProblema} com algum campo faltando` : ''}</span>
              <button style={{ ...btnGhost, padding: '5px 11px', fontSize: 12 }} disabled={busy} onClick={() => setRows([])}>Limpar lista</button>
            </div>
          </>
        )}

        {erro && (
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(192,64,80,0.06)', border: '1px solid rgba(192,64,80,0.2)', borderRadius: 10, fontSize: 13.5, color: T.danger }}>{erro}</div>
        )}

        <StarDivider my={22} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={baixar} disabled={!podeBaixar} style={{
            ...btnPrimary,
            background: podeBaixar ? T.gold : 'transparent', color: podeBaixar ? '#fff' : T.textD,
            boxShadow: podeBaixar ? btnPrimary.boxShadow : 'none', border: podeBaixar ? 'none' : `1px solid ${T.border}`,
            cursor: podeBaixar ? 'pointer' : 'not-allowed',
          }}>
            {busy ? 'Lendo…' : <><I><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 21h14" /></I> Baixar planilha (.xlsx)</>}
          </button>
          {!podeBaixar && !busy && <span style={{ fontSize: 12.5, color: T.textT }}>Arraste os empenhos para começar.</span>}
          {comProblema > 0 && !busy && <span style={{ fontSize: 12.5, color: '#C98A1B' }}>Campos que não deram pra ler saem em amarelo na planilha.</span>}
        </div>
      </div>
    </div>
  );
};
